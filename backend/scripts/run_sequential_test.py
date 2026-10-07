import asyncio
import os
import sys
from pathlib import Path

BACKEND_DIR = str(Path(__file__).resolve().parent.parent)
os.chdir(BACKEND_DIR)
sys.path.insert(0, BACKEND_DIR)

from app.database import SessionLocal, Base, engine
from app.models import User, Upload, AssignmentWorkflow, Report, UserProfile
from app.services.assignment_workflow import extract_assignment, process_assignment

DOWNLOADS_DIR = r"C:\Users\pilla\Downloads\Labmate_documents\Labmate_documents"
ROOT_DIR = str(Path(BACKEND_DIR).parent)
BOSS_DIR = os.path.join(ROOT_DIR, "final_boss_manuals")

async def test_manual(file_path: str, lang: str, mode: str = "code_only"):
    print(f"\n========================================================")
    print(f"Testing: {os.path.basename(file_path)} [{lang.upper()}] (mode={mode})")
    print(f"========================================================")
    
    with SessionLocal() as db:
        user = db.query(User).first()
        if not user:
            user = User(name="Rohit Verma", email="rohit.verma@example.edu")
            db.add(user)
            db.commit()
            db.refresh(user)
        
        profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        if not profile:
            profile = UserProfile(user_id=user.id)
            db.add(profile)
        profile.course = "Computer Science & Engineering"
        profile.institution = "Ramaiah Institute of Technology"
        profile.profile_metadata = {"roll_number": "1MS21CS089"}
        db.commit()
        
        file_type = "docx" if file_path.endswith(".docx") else "pdf"
        output_name = Path(file_path).stem.replace(" ", "_")
        
        upload = Upload(
            user_id=user.id,
            filename=os.path.basename(file_path),
            original_filename=os.path.basename(file_path),
            file_path=file_path,
            file_type=file_type,
            file_size=os.path.getsize(file_path),
            language=lang,
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)
        
        workflow = AssignmentWorkflow(
            upload_id=upload.id,
            output_name=output_name,
            language=lang,
            mode=mode,
            instructions="Use clean student coding style with student header and realistic test cases."
        )
        db.add(workflow)
        db.commit()
        db.refresh(workflow)
        workflow_id = workflow.id

    print(f"[1/3] Extracting questions from {os.path.basename(file_path)}...")
    await extract_assignment(workflow_id)

    with SessionLocal() as db:
        wf = db.get(AssignmentWorkflow, workflow_id)
        print(f"  Extracted {len(wf.questions or [])} questions:")
        for q in wf.questions or []:
            print(f"   - Q{q['id']}: ({q.get('language')}) {q['text'][:80]}...")

    print(f"[2/3] Processing questions with resume support...")
    for attempt in range(5):
        await process_assignment(workflow_id)
        with SessionLocal() as db:
            wf = db.get(AssignmentWorkflow, workflow_id)
            if wf.status == "completed":
                break
            print(f"  Attempt {attempt + 1} status: {wf.status} ({wf.error}). Waiting 15s to resume...")
            await asyncio.sleep(15)

    with SessionLocal() as db:
        wf = db.get(AssignmentWorkflow, workflow_id)
        print(f"  Final Status: {wf.status}")
        if wf.report_id:
            rep = db.get(Report, wf.report_id)
            if rep:
                print(f"  Report generated: {rep.file_path} ({rep.file_size} bytes)")
        print(f"[3/3] Results ({len(wf.results or [])}):")
        for res in wf.results or []:
            print(f"   - Question {res['id']}: status={res.get('status')}, screenshots={len(res.get('screenshot_paths') or [])}")
            for sc in res.get('screenshot_paths') or []:
                print(f"       Screenshot: {sc} (exists: {os.path.exists(sc)})")
    
    return wf.status == "completed"


async def main():
    Base.metadata.create_all(bind=engine)
    
    manuals = [
        # 1. Real Downloaded Python Manual
        (os.path.join(DOWNLOADS_DIR, "python", "EXP 3 Conditional statement.docx"), "python"),
        # 2. Real Downloaded WebDev Manual
        (os.path.join(DOWNLOADS_DIR, "webdev", "EXP-1_IP_TEITA_202425.docx"), "webdev"),
        # 3. Final Boss Java Manual
        (os.path.join(BOSS_DIR, "java", "java_manual_1_fundamentals_arrays.docx"), "java"),
        # 4. Final Boss C Manual
        (os.path.join(BOSS_DIR, "c_cpp", "c_manual_1_arrays_strings_pointers.docx"), "c"),
        # 5. Final Boss C++ Manual
        (os.path.join(BOSS_DIR, "c_cpp", "cpp_manual_1_stacks_and_queues.docx"), "cpp"),
    ]
    
    results = {}
    for path, lang in manuals:
        if os.path.exists(path):
            ok = await test_manual(path, lang, mode="code_only")
            results[os.path.basename(path)] = "SUCCESS" if ok else "FAILED"
            print(f">> {os.path.basename(path)}: {results[os.path.basename(path)]}")
            await asyncio.sleep(10)
        else:
            print(f"File not found: {path}")
            results[os.path.basename(path)] = "NOT FOUND"
            
    print("\n=========================================")
    print("--- FINAL SUMMARY ACROSS ALL MANUALS ---")
    print("=========================================")
    for name, status in results.items():
        print(f"  - {name}: {status}")

if __name__ == "__main__":
    asyncio.run(main())
