"""Score the real extraction pipeline (document reading, numbered sections, the AI provider) on corpus.py.

Calls the configured AI provider (backend/.env), so it is not part of pytest. Rerun after changing extraction:
    PYTHONPATH=.;backend python backend/scripts/extraction_eval/run_eval.py 3 --pdf   (runs per manual, optional name filter)
"""
import asyncio, json, os, sys, tempfile, time
from pathlib import Path

HERE = Path(__file__).parent
REPO = HERE.parents[2]
sys.path[:0] = [str(HERE), str(REPO / "backend"), str(REPO)]
os.chdir(REPO / "backend")

from docx import Document
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch

from corpus import M
from app.database import Base
from app.models import AssignmentWorkflow, Upload, User
from app.services import assignment_workflow as aw

OUT = Path(tempfile.gettempdir()) / "labmate_extraction_eval"
OUT.mkdir(exist_ok=True)


def make_docx(name, spec):
    doc = Document()
    for line in spec["text"].splitlines():
        doc.add_paragraph(line)
    if spec.get("table"):
        rows = spec["table"]
        table = doc.add_table(rows=len(rows), cols=len(rows[0]))
        for r, row in enumerate(rows):
            for c, value in enumerate(row):
                table.cell(r, c).text = value
    path = OUT / f"{name}.docx"
    doc.save(path)
    return path


def make_pdf(name, spec):
    from html import escape
    from playwright.sync_api import sync_playwright
    body = "".join(f"<p>{escape(line)}</p>" for line in spec["text"].splitlines())
    if spec.get("table"):
        body += "<table border=1>" + "".join("<tr>" + "".join(f"<td>{escape(c)}</td>" for c in row) + "</tr>" for row in spec["table"]) + "</table>"
    path = OUT / f"{name}.pdf"
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge")
        page = browser.new_page()
        page.set_content(f"<html><body style='font-family:Times New Roman;font-size:12pt'>{body}</body></html>")
        page.pdf(path=str(path), format="A4")
        browser.close()
    return path


def score(spec, questions):
    texts = [(q.get("text", "").lower(), q.get("language")) for q in questions]
    problems = []
    for phrase, language in spec["expect"]:
        hits = [i for i, (t, _) in enumerate(texts) if phrase.lower() in t]
        if not hits:
            problems.append(f"MISSING '{phrase}'")
        elif len(hits) > 1:
            problems.append(f"DUPLICATED '{phrase}' in {[h + 1 for h in hits]}")
        elif texts[hits[0]][1] != language:
            problems.append(f"LANG '{phrase}' got {texts[hits[0]][1]} want {language}")
    if len(questions) != len(spec["expect"]):
        problems.append(f"COUNT {len(questions)} want {len(spec['expect'])}")
    return problems


async def extract(path, file_type, mode):
    folder = tempfile.mkdtemp()
    engine = create_engine("sqlite:///" + folder.replace("\\", "/") + "/e.db", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        user = User(email="eval@example.com", name="Eval")
        db.add(user); db.flush()
        upload = Upload(user_id=user.id, filename=path.name, original_filename=path.name, file_path=str(path),
                        file_type=file_type, file_size=path.stat().st_size)
        db.add(upload); db.flush()
        workflow = AssignmentWorkflow(upload_id=upload.id, status="extracting", mode=mode)
        db.add(workflow); db.commit(); wid = workflow.id
    with patch.object(aw, "SessionLocal", factory), patch.object(aw, "local_upload_path", lambda p: p):
        await aw.extract_assignment(wid)
    with factory() as db:
        w = db.get(AssignmentWorkflow, wid)
        return w.status, w.error, list(w.questions or []), [l.get("message") for l in (w.logs or [])]


runs = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 1
name_filter = next((a for a in sys.argv[1:] if not a.isdigit() and not a.startswith("--")), "")
want_pdf = "--pdf" in sys.argv
FILES = {}
for name, spec in M.items():
    if name_filter and name_filter not in name:
        continue
    FILES[name] = [(make_docx(name, spec), "docx")] + ([(make_pdf(name, spec), "pdf")] if want_pdf else [])


async def main():
    report = []
    for name, files in FILES.items():
        spec = M[name]
        for path, file_type in files:
            for run in range(runs):
                started = time.time()
                status, error, questions, logs = await extract(path, file_type, spec["mode"])
                problems = score(spec, questions) if status == "ready" else [f"STATUS {status}: {error}"]
                verdict = "PASS" if not problems else "FAIL"
                print(f"{verdict} {name} [{file_type} run {run + 1}] {time.time() - started:.0f}s {'; '.join(problems)}", flush=True)
                if problems:
                    for q in questions:
                        print(f"     [{q.get('id')}] {q.get('language')} {q.get('extraction_method', 'ai')}: {q.get('text', '')[:150]!r}")
                    print("     logs:", [str(l)[:120] for l in logs[-2:]])
                report.append(dict(name=name, file_type=file_type, run=run, verdict=verdict, problems=problems,
                                   questions=questions))
    (OUT / "results.json").write_text(json.dumps(report, indent=1))
    total = len(report); passed = sum(r["verdict"] == "PASS" for r in report)
    print(f"\n{passed}/{total} passed")


asyncio.run(main())
