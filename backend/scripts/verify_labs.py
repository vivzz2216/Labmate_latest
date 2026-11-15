"""Run a lab manual through the real LabMate pipeline for each lab and report the outcome.

For every selected lab this script: extracts the questions from a manual, generates code with the
configured LLM, executes it with the local runtimes, captures screenshots, and builds the Word
report. It uses a throw-away database and data directory, so real uploads are never touched.
It calls the configured LLM provider (it spends real provider quota).

    python backend/scripts/verify_labs.py                     # all labs, 2 questions each
    python backend/scripts/verify_labs.py --labs python sql   # only some labs
    python backend/scripts/verify_labs.py --questions 1

Concurrency test: N students, each a separate account, submit at the same instant through the
real workflow queue. Labs are assigned round-robin (or pass one lab to make everyone press the
same lab). It reports each student's wait before a worker picked the job up, total time, and any
pause or failure. Limits are set with flags (they override backend/.env for this run):

    python backend/scripts/verify_labs.py --parallel 10 --workers 12 --heavy 12 --browsers 4
    python backend/scripts/verify_labs.py --parallel 10 --labs python --questions 1
    python backend/scripts/verify_labs.py --parallel 10 --database-url postgresql://user:pw@host/db

SQLite (the default here) serialises writes; use --database-url with a throw-away PostgreSQL for
numbers that resemble production.

Labs: python java web colab sql cpp deep_learning distributed
"""
import argparse
import asyncio
import json
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
MANUAL_DIR = ROOT / "Labmate_documents" / "Labmate_documents"

def _early_flag(flag, env_name):
    """Limits must reach the settings object before the app is imported."""
    if flag in sys.argv:
        os.environ[env_name] = sys.argv[sys.argv.index(flag) + 1]


_early_flag("--workers", "WORKFLOW_WORKERS")
_early_flag("--heavy", "HEAVY_EXECUTION_LOCAL_LIMIT")
_early_flag("--browsers", "BROWSER_CAPTURE_LOCAL_LIMIT")
_early_flag("--database-url", "VERIFY_DATABASE_URL")

WORK = Path(tempfile.mkdtemp(prefix="labmate-verify-"))
os.environ.update({
    "DATABASE_URL": os.environ.get("VERIFY_DATABASE_URL") or "sqlite:///" + (WORK / "state.db").as_posix(),
    "DATA_DIR": str(WORK),
    "REDIS_REQUIRED": "false",
    "STORAGE_BACKEND": "local",
    "EXECUTION_ISOLATION": "development",
    "RATE_LIMIT_ENABLED": "false",
    "BILLING_ENABLED": "false",
})
os.environ.pop("RAILWAY_ENVIRONMENT_ID", None)
for folder in ("uploads", "screenshots", "reports"):
    (WORK / folder).mkdir(exist_ok=True)
    os.environ[folder.upper() + "_DIR"] = str(WORK / folder)
sys.path[:0] = [str(BACKEND), str(ROOT)]

from docx import Document  # noqa: E402

# lab -> (existing manual under Labmate_documents or None, language per question, track)
EXISTING = {
    "python": ("python/EXP 3 Conditional statement.docx", ["python"], None),
    "sql": ("sql/SQLExp3.docx", ["sql"], None),
    "web": ("webdev/EXP-1_IP_TEITA_202425.docx", ["html"], None),
}

# Manuals written for labs that have no sample manual yet: (title, [(aim, task), ...])
GENERATED = {
    "java": ("Java Programming Lab", ["java", "java"], None, [
        ("Inheritance and polymorphism",
         "Create an abstract class Shape with method area(). Extend it with Circle (radius 3) and Rectangle (4 x 5). "
         "Store both in a Shape array and print the shape name and area of each using polymorphism."),
        ("Interfaces and exception handling",
         "Define an interface Account with deposit(double) and withdraw(double). Implement it in SavingsAccount with a "
         "starting balance of 1000. Withdrawing more than the balance must throw a custom InsufficientFundsException. "
         "Deposit 500, withdraw 300, then try to withdraw 5000 and print the caught message."),
    ]),
    "cpp": ("C and C++ Data Structures Lab", ["c", "cpp"], None, [
        ("Singly linked list in C",
         "Write a C program implementing a singly linked list with insert at beginning, insert at end, delete by value "
         "and display. Insert 10, 20, 30 at the end, 5 at the beginning, delete 20 and display the list after each step."),
        ("Stack using a class in C++",
         "Write a C++ program implementing a Stack class with a fixed-size array and push, pop, peek and isEmpty. "
         "Push 1, 2, 3, print the top, pop twice and print the remaining top."),
    ]),
    "deep_learning": ("Deep Learning Lab", ["colab", "colab"], "deep_learning", [
        ("MLP for XOR classification with PyTorch",
         "Train a multilayer perceptron with one hidden layer of 4 units on the XOR problem using PyTorch. Train for "
         "2000 epochs with Adam, print the loss every 500 epochs, print the final predictions, and plot the loss curve."),
        ("Neural network classification with Keras",
         "Using Keras, build a small dense network to classify a synthetic two-class dataset generated with "
         "scikit-learn make_moons (500 samples, noise 0.2). Train for 30 epochs, print the test accuracy and plot the "
         "training accuracy and loss curves."),
    ]),
    "distributed": ("Distributed Computing Lab", ["distributed", "distributed"], "distributed", [
        ("TCP client-server communication",
         "Write a Java TCP server that listens on a port and echoes every line it receives in upper case, and a "
         "client that sends the messages hello and distributed systems and prints the replies. Run both on localhost."),
        ("Lamport logical clocks",
         "Simulate three processes in Java using threads that exchange messages and maintain Lamport logical clocks. "
         "Print each event with its updated clock value, showing the clock increments on send and the max rule on receive."),
    ]),
    "colab": ("Notebook Lab", ["colab", "colab"], None, [
        ("Exploratory data analysis with pandas",
         "In a notebook, create a pandas DataFrame of 100 synthetic students with columns marks and hours_studied "
         "(use a fixed random seed). Show df.head(), df.describe(), the correlation between the columns, and a "
         "matplotlib scatter plot of hours_studied against marks."),
        ("Linear regression with scikit-learn",
         "Fit a LinearRegression model on synthetic data y = 3x + 5 + noise (200 points, fixed seed). Print the "
         "learned slope, intercept and R2 score, and plot the data with the fitted line."),
    ]),
}

LABS = ["python", "java", "web", "colab", "sql", "cpp", "deep_learning", "distributed"]


CATALOG_SLUG = {"deep_learning": "dl", "distributed": "dc"}
CATALOG_FILE = ROOT / "frontend" / "lib" / "labCatalog.ts"


def catalog_items(lab):
    """The experiments the product lists for a lab (frontend/lib/labCatalog.ts), as (aim, task) pairs."""
    import re
    prefix = CATALOG_SLUG[lab]
    text = CATALOG_FILE.read_text(encoding="utf-8")
    pattern = re.compile(r'id:\s*"%s-\d+".*?title:\s*"([^"]+)".*?aim:\s*"([^"]+)".*?description:\s*"([^"]+)"' % prefix, re.S)
    return [(title, f"{aim} {task}") for title, aim, task in pattern.findall(text)]


def build_manual(lab):
    title, langs, track, items = GENERATED[lab]
    if "--catalog" in sys.argv and lab in CATALOG_SLUG:
        items = catalog_items(lab) or items
    path = WORK / f"{lab}_manual.docx"
    doc = Document()
    doc.add_heading(title, 0)
    for number, (aim, task) in enumerate(items, 1):
        doc.add_heading(f"Experiment {number}: {aim}", 1)
        doc.add_paragraph("Aim: " + aim + ".")
        doc.add_paragraph("Task: " + task)
        doc.add_paragraph("Output: Attach the program source and the output screenshot.")
    doc.save(path)
    return path, langs, track


def manual_for(lab):
    if lab in EXISTING:
        rel, langs, track = EXISTING[lab]
        src = MANUAL_DIR / rel
        dst = WORK / f"{lab}_manual{src.suffix}"
        shutil.copy(src, dst)
        return dst, langs, track
    return build_manual(lab)


async def run_lab(lab, limit, factory):
    from app.models import AssignmentWorkflow, Report, Upload, User, UserProfile
    from app.services import assignment_workflow as flow

    manual, langs, track = manual_for(lab)
    started = time.time()
    row = {"lab": lab, "manual": manual.name, "questions": 0, "results": [], "status": "not run", "error": None}
    with factory() as db:
        user = User(email=f"{lab}@example.test", name="Verify Student",
                    profile=UserProfile(institution="Example College", course="Computer Science",
                                        profile_metadata={"roll_number": "CS01", "year": "2nd Year", "graduation_year": "2028"}))
        db.add(user)
        db.flush()
        stored = WORK / "uploads" / manual.name
        shutil.copy(manual, stored)
        upload = Upload(user_id=user.id, filename=manual.name, original_filename=manual.name, file_path=str(stored),
                        file_type=manual.suffix.lstrip("."), file_size=stored.stat().st_size)
        db.add(upload)
        db.flush()
        wf = AssignmentWorkflow(upload_id=upload.id, status="queued", stage="extract", progress=0, questions=[],
                                results=[], logs=[], output_name=f"{lab}_report", mode="code_only")
        db.add(wf)
        db.commit()
        wid = wf.id

    await flow.extract_assignment(wid)
    with factory() as db:
        wf = db.get(AssignmentWorkflow, wid)
        if wf.status == "failed" or not wf.questions:
            row.update(status="extract failed", error=wf.error or "no questions extracted")
            return row
        picked = wf.questions[:limit]
        row["questions"] = len(wf.questions)
        questions = []
        for index, question in enumerate(picked):
            item = {"id": question["id"], "text": question["text"], "language": langs[min(index, len(langs) - 1)]}
            if track:
                item["track"] = track
            if item["language"] == "colab":
                item["colab_theme"] = "dark"
            questions.append(item)
        wf.questions, wf.language, wf.status, wf.stage, wf.results = questions, "auto", "queued", "generate", []
        wf.progress = 20
        db.commit()

    await flow.process_assignment(wid)
    with factory() as db:
        wf = db.get(AssignmentWorkflow, wid)
        row["status"], row["error"] = wf.status, wf.error
        for result in wf.results or []:
            shots = [p for p in (result.get("screenshot_paths") or []) if p]
            row["results"].append({
                "id": result.get("id"), "language": result.get("language"), "status": result.get("status"),
                "verification": (result.get("verification") or {}).get("status"),
                "stages": result.get("execution_stages"), "output_chars": len(result.get("output") or ""),
                "screenshots": len(shots),
                "screenshots_exist": all(os.path.exists(p) for p in shots) if shots else False,
                "error": (result.get("error") or "")[:300],
            })
        if wf.report_id:
            report = db.get(Report, wf.report_id)
            if report and os.path.exists(report.file_path):
                document = Document(report.file_path)
                row["report"] = {"file": report.file_path, "paragraphs": len(document.paragraphs),
                                 "images": len(document.inline_shapes)}
    row["seconds"] = round(time.time() - started)
    return row


def seed_student(factory, lab, index):
    """Create one separate account with its own upload and a workflow waiting to be extracted."""
    from app.models import AssignmentWorkflow, Upload, User, UserProfile

    manual, langs, track = manual_for(lab)
    with factory() as db:
        user = User(email=f"student{index}@example.test", name=f"Student {index}",
                    profile=UserProfile(institution="Example College", course="Computer Science",
                                        profile_metadata={"roll_number": f"CS{index:02d}", "year": "2nd Year",
                                                          "graduation_year": "2028"}))
        db.add(user)
        db.flush()
        stored = WORK / "uploads" / f"s{index}_{manual.name}"
        shutil.copy(manual, stored)
        upload = Upload(user_id=user.id, filename=stored.name, original_filename=manual.name, file_path=str(stored),
                        file_type=manual.suffix.lstrip("."), file_size=stored.stat().st_size)
        db.add(upload)
        db.flush()
        wf = AssignmentWorkflow(upload_id=upload.id, status="queued", stage="extract", progress=0, questions=[],
                                results=[], logs=[], output_name=f"s{index}_{lab}", mode="code_only")
        db.add(wf)
        db.commit()
        return wf.id, langs, track


async def poll(factory, students, done_states, key, started, timeout, first_key=None, first_states=(), peak=None):
    """Record when each student's workflow reaches a state, checking the database every half second."""
    from app.models import AssignmentWorkflow

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        active = 0
        with factory() as db:
            for student in students:
                if key in student or student.get("skip"):
                    continue
                wf = db.get(AssignmentWorkflow, student["id"])
                elapsed = round(time.monotonic() - started, 1)
                student["status"], student["error"] = wf.status, wf.error
                active += wf.status in ("extracting", "processing")
                if first_key and first_key not in student and wf.status in first_states:
                    student[first_key] = elapsed
                if wf.status in done_states:
                    student[key] = elapsed
        if peak is not None:
            peak["max"] = max(peak["max"], active)
        if all(key in s or s.get("skip") for s in students):
            return True
        await asyncio.sleep(0.5)
    return False


def percentile(values, share):
    values = sorted(values)
    return values[min(len(values) - 1, int(round(share * (len(values) - 1))))] if values else None


async def run_parallel(count, labs, limit, factory, timeout):
    from app.config import settings
    from app.models import AssignmentWorkflow
    from app.services import workflow_queue as queue

    print(f"Limits for this run: workflow workers={settings.WORKFLOW_WORKERS}, "
          f"heavy executions={settings.HEAVY_EXECUTION_LOCAL_LIMIT}, "
          f"screenshot browsers={settings.BROWSER_CAPTURE_LOCAL_LIMIT}, "
          f"provider RPM/TPM={getattr(settings, 'GLM_RPM_LIMIT', '?')}/{getattr(settings, 'GLM_TPM_LIMIT', '?')}, "
          f"database={factory.kw['bind'].dialect.name}", flush=True)
    students = []
    for index in range(count):
        lab = labs[index % len(labs)]
        wid, langs, track = seed_student(factory, lab, index + 1)
        students.append({"student": index + 1, "lab": lab, "id": wid, "langs": langs, "track": track})

    queue.start_workflow_workers()
    peak = {"max": 0}
    try:
        started = time.monotonic()
        await poll(factory, students, {"ready", "failed", "paused"}, "extract_done", started, timeout, peak=peak)
        for student in students:
            if student.get("status") != "ready":
                student["skip"] = True  # nothing to submit; reported below as an extraction problem

        # Every student presses the button in the same instant: one transaction changes all rows.
        with factory() as db:
            for student in students:
                if student.get("skip"):
                    continue
                wf = db.get(AssignmentWorkflow, student["id"])
                chosen = []
                for position, question in enumerate(wf.questions[:limit]):
                    item = {"id": question["id"], "text": question["text"],
                            "language": student["langs"][min(position, len(student["langs"]) - 1)]}
                    if student["track"]:
                        item["track"] = student["track"]
                    if item["language"] == "colab":
                        item["colab_theme"] = "dark"
                    chosen.append(item)
                wf.questions, wf.language, wf.results, wf.progress = chosen, "auto", [], 20
                wf.status, wf.stage, wf.claim_token = "queued", "generate", None
            db.commit()
        submitted = time.monotonic()
        finished = await poll(factory, students, {"completed", "failed", "paused"}, "total", submitted, timeout,
                              first_key="queue_wait", first_states={"extracting", "processing"}, peak=peak)
    finally:
        await queue.stop_workflow_workers()

    rows = []
    with factory() as db:
        for student in students:
            wf = db.get(AssignmentWorkflow, student["id"])
            good = [r for r in (wf.results or []) if r.get("status") == "completed" and not r.get("error")
                    and r.get("output") and r.get("screenshot_paths")]
            rows.append({"student": student["student"], "lab": student["lab"], "final": wf.status,
                         "extract_seconds": student.get("extract_done"), "queue_wait_seconds": student.get("queue_wait"),
                         "total_seconds": student.get("total"), "questions_ok": f"{len(good)}/{len(wf.questions or [])}",
                         "error": (wf.error or "")[:200]})
    totals = [r["total_seconds"] for r in rows if r["total_seconds"] is not None]
    waits = [r["queue_wait_seconds"] for r in rows if r["queue_wait_seconds"] is not None]
    summary = {
        "students": count, "finished_in_time": finished, "peak_jobs_running_together": peak["max"],
        "completed": sum(r["final"] == "completed" for r in rows), "failed": sum(r["final"] == "failed" for r in rows),
        "paused": sum(r["final"] == "paused" for r in rows),
        "not_finished": sum(r["total_seconds"] is None for r in rows),
        "queue_wait_seconds": {"median": percentile(waits, .5), "p95": percentile(waits, .95), "max": max(waits, default=None)},
        "total_seconds": {"median": percentile(totals, .5), "p95": percentile(totals, .95), "max": max(totals, default=None)},
    }
    print("\nPER STUDENT")
    for r in rows:
        print(f"  #{r['student']:<3}{r['lab']:<14}{r['final']:<10} wait {r['queue_wait_seconds']}s  total {r['total_seconds']}s"
              f"  ok {r['questions_ok']}  {r['error']}")
    print("\nCONCURRENCY SUMMARY\n" + json.dumps(summary, indent=2))
    return {"summary": summary, "students": rows}


async def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--labs", nargs="+", choices=LABS, default=LABS)
    parser.add_argument("--questions", type=int, default=2)
    parser.add_argument("--catalog", action="store_true",
                        help="deep_learning/distributed: use every experiment listed in the lab catalog as the manual")
    parser.add_argument("--json", help="write the full results to this file")
    parser.add_argument("--parallel", type=int, metavar="N", help="concurrency test with N separate student accounts")
    parser.add_argument("--timeout", type=int, default=1200, help="seconds to wait per phase in the concurrency test")
    parser.add_argument("--workers", type=int, help="workflow workers for this run")
    parser.add_argument("--heavy", type=int, help="concurrent sandbox executions for this run")
    parser.add_argument("--browsers", type=int, help="concurrent screenshot browsers for this run")
    parser.add_argument("--database-url", help="database for this run (default: throw-away SQLite)")
    args = parser.parse_args()

    from sqlalchemy.orm import sessionmaker
    from app.database import Base, engine
    from app.services import assignment_workflow as flow
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    flow.SessionLocal = factory

    if args.parallel:
        result = await run_parallel(args.parallel, args.labs, args.questions, factory, args.timeout)
        if args.json:
            Path(args.json).write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")
        print(f"\nWorking files kept in {WORK}")
        await asyncio.sleep(0.5)
        return

    rows = []
    for lab in args.labs:
        print(f"\n=== {lab} ===", flush=True)
        try:
            row = await run_lab(lab, args.questions, factory)
        except Exception as exc:  # report the failure and continue with the next lab
            row = {"lab": lab, "status": "crashed", "error": f"{type(exc).__name__}: {exc}", "results": []}
        rows.append(row)
        print(json.dumps(row, indent=2, default=str), flush=True)

    print("\n\nSUMMARY")
    for row in rows:
        # A question is good when it completed without error, produced output, and its screenshots exist.
        good = [r for r in row["results"] if r["status"] == "completed" and not r["error"]
                and r["output_chars"] and r["screenshots_exist"] and r["verification"] in (None, "passed")]
        verdict = "OK" if row["status"] == "completed" and row["results"] and len(good) == len(row["results"]) else "FAIL"
        print(f"{verdict:<5}{row['lab']:<14} workflow {row['status']:<10} questions ok {len(good)}/{len(row['results'])}"
              f"  {row.get('error') or ''}"[:200])
    if args.json:
        Path(args.json).write_text(json.dumps(rows, indent=2, default=str), encoding="utf-8")
    print(f"\nWorking files kept in {WORK}")
    await asyncio.sleep(0.5)  # let Windows close subprocess transports before the loop ends


if __name__ == "__main__":
    asyncio.run(main())
