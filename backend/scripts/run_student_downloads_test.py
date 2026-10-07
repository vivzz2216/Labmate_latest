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
from app.services.profile_service import UserProfileService

DOWNLOADS_DIR = r"C:\Users\pilla\Downloads\Labmate_documents\Labmate_documents"
ROOT_DIR = str(Path(BACKEND_DIR).parent)
BOSS_DIR = os.path.join(ROOT_DIR, "final_boss_manuals")

async def test_single_document(file_path: str, lang: str, mode: str = "code_only"):
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
        db.refresh(profile)
        
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

    print(f"[2/3] Generating code, executing, capturing screenshots, and assembling Word document...")
    # Attempt processing with automatic resume if rate limited
    max_attempts = 4
    for attempt in range(max_attempts):
        await process_assignment(workflow_id)
        with SessionLocal() as db:
            wf = db.get(AssignmentWorkflow, workflow_id)
            if wf.status == "completed":
                break
            if wf.status == "paused":
                print(f"  Rate limit encountered. Waiting 20s before resuming (attempt {attempt + 1}/{max_attempts})...")
                await asyncio.sleep(20)

    with SessionLocal() as db:
        wf = db.get(AssignmentWorkflow, workflow_id)
        print(f"  Workflow Status: {wf.status}")
        if wf.error:
            print(f"  Error: {wf.error}")
        if wf.report_id:
            rep = db.get(Report, wf.report_id)
            if rep:
                print(f"  Report generated: {rep.file_path} ({rep.file_size} bytes)")
        print(f"[3/3] Completed {len(wf.results or [])} results.")
        for res in wf.results or []:
            print(f"   - Question {res['id']}: status={res.get('status')}, screenshots={len(res.get('screenshot_paths') or [])}")
            for sc in res.get('screenshot_paths') or []:
                print(f"       Screenshot: {sc} (exists: {os.path.exists(sc)})")
    
    return wf.status == "completed"


async def main():
    Base.metadata.create_all(bind=engine)
    
    # 1. Test Python Documents (Downloaded)
    python_files = [
        os.path.join(DOWNLOADS_DIR, "python", "EXP 3 Conditional statement.docx"),
        os.path.join(DOWNLOADS_DIR, "python", "EXP 8 inheritance.docx"),
    ]
    
    # 2. Test WebDev Documents (Downloaded)
    webdev_files = [
        os.path.join(DOWNLOADS_DIR, "webdev", "EXP-1_IP_TEITA_202425.docx"),
    ]

    # 3. Test Java Final Boss Manuals
    java_files = [
        os.path.join(BOSS_DIR, "java", "java_manual_1_fundamentals_arrays.docx"),
    ]

    # 4. Test C and C++ Final Boss Manuals
    c_cpp_files = [
        os.path.join(BOSS_DIR, "c_cpp", "c_manual_1_arrays_strings_pointers.docx"),
        os.path.join(BOSS_DIR, "c_cpp", "cpp_manual_1_stacks_and_queues.docx"),
    ]
    
    print("\n=========================================")
    print("--- PHASE 1: PYTHON REAL LAB MANUALS ---")
    print("=========================================")
    for p_file in python_files:
        if os.path.exists(p_file):
            ok = await test_single_document(p_file, "python", mode="code_only")
            print(f">> Result for {os.path.basename(p_file)}: {'SUCCESS' if ok else 'FAILED'}")
            await asyncio.sleep(8)
        else:
            print(f"File not found: {p_file}")

    print("\n=========================================")
    print("--- PHASE 2: WEBDEV REAL LAB MANUALS ---")
    print("=========================================")
    for w_file in webdev_files:
        if os.path.exists(w_file):
            ok = await test_single_document(w_file, "webdev", mode="code_only")
            print(f">> Result for {os.path.basename(w_file)}: {'SUCCESS' if ok else 'FAILED'}")
            await asyncio.sleep(8)
        else:
            print(f"File not found: {w_file}")

    print("\n=========================================")
    print("--- PHASE 3: JAVA FINAL BOSS MANUALS ---")
    print("=========================================")
    for j_file in java_files:
        if os.path.exists(j_file):
            ok = await test_single_document(j_file, "java", mode="code_only")
            print(f">> Result for {os.path.basename(j_file)}: {'SUCCESS' if ok else 'FAILED'}")
            await asyncio.sleep(8)
        else:
            print(f"File not found: {j_file}")

    print("\n=========================================")
    print("--- PHASE 4: C / C++ FINAL BOSS MANUALS -")
    print("=========================================")
    for c_file in c_cpp_files:
        if os.path.exists(c_file):
            lang = "c" if "c_manual" in c_file else "cpp"
            ok = await test_single_document(c_file, lang, mode="code_only")
            print(f">> Result for {os.path.basename(c_file)}: {'SUCCESS' if ok else 'FAILED'}")
            await asyncio.sleep(8)
        else:
            print(f"File not found: {c_file}")

if __name__ == "__main__":
    asyncio.run(main())
