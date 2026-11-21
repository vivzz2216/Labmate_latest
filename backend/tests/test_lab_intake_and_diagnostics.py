from types import SimpleNamespace

from docx import Document
from PIL import Image
import pytest

from app.services.assignment_workflow import build_word_report
from app.services.evidence_planner import plan_experiment
from app.services.manual_sections import numbered_experiments
from app.services.pdf_ocr import NotLabManualError, strip_running_page_text, validate_lab_pdf


def test_pdf_intake_requires_an_exercise():
    for document in (
        "Network Research\nAbstract\nWe evaluated Python scripts.\n"
        "Experiment 1: Runtime comparison\nUse the results to see performance.\nReferences\nA citation",
        "Invoice\nPayment due next month.",
    ):
        with pytest.raises(NotLabManualError, match="lab manual or exercise sheet"):
            validate_lab_pdf(document)
    validate_lab_pdf("Write a Python program to reverse a string.")
    validate_lab_pdf("Experiment 4: Compare local and remote method invocation.")
    validate_lab_pdf("Lab 1: Retail Sales Dashboard in Microsoft Power BI Desktop\nAim: Import Sales CSV and create SalesAmount.")
    validate_lab_pdf("Practical Journal\nStep 1: Load Customers and Orders in Power BI Model View.")


def test_running_margins_are_removed_but_experiments_are_preserved():
    pages = [
        "Computing Lab Manual\nExperiment 1: Python loops\nWrite a program.\nDepartment of IT\nPage 1 of 2",
        "Computing Lab Manual\nExperiment 2: Python lists\nWrite a program.\nDepartment of IT\nPage 2 of 2",
    ]
    margins = [(["Computing Lab Manual"], ["Department of IT", f"Page {n} of 2"]) for n in (1, 2)]
    assert strip_running_page_text(pages, margins) == [
        "Computing Lab Manual\nExperiment 1: Python loops\nWrite a program.",
        "Experiment 2: Python lists\nWrite a program.",
    ]


def test_numbered_java_rmi_routes_to_the_multifile_runner():
    tasks = numbered_experiments("Experiment 2: Java RMI\n"
                                  "Write a Java program with a remote interface, a server and a client.")
    assert [task["language"] for task in tasks] == ["distributed"]


@pytest.mark.parametrize(("objective", "required"), [
    ("Build a web form. Database integration is optional.", False),
    ("Display the word database when the button is clicked.", False),
    ("Build a web form without a database.", False),
    ("Store every submitted form in SQLite.", True),
    ("Use SQLite to persist submitted forms.", True),
    ("Implement a service that inserts records into a database.", True),
])
def test_database_evidence_references_actual_operations(objective, required):
    plan = plan_experiment(objective, "react")
    assert any(requirement["id"] == "database" for requirement in plan["requirements"]) == required


def test_failed_language_mismatch_does_not_embed_stale_output(tmp_path, monkeypatch):
    source = tmp_path / "manual.docx"
    Document().save(source)
    stale_png = tmp_path / "diagnostic.png"
    Image.new("RGB", (320, 240), "black").save(stale_png)
    result = {
        "id": 1, "question": "Write a Python program.", "language": "python", "status": "failed",
        "error": "Generated language c does not match requested language python; execution was not attempted.",
        "screenshot_paths": [str(stale_png)],
    }
    upload = SimpleNamespace(file_type="docx", file_path=str(source), original_filename=source.name)
    workflow = SimpleNamespace(id=1, output_name="diagnostic", instructions="", results=[result])
    monkeypatch.setattr("app.services.assignment_workflow.settings.REPORT_DIR", str(tmp_path))
    path, _ = build_word_report(upload, workflow)
    report = Document(path)
    text = "\n".join(paragraph.text for paragraph in report.paragraphs)
    assert "could not be generated in the selected language" in text
    assert "Generated language c" not in text
    assert len(report.inline_shapes) == 0
    assert result["screenshot_paths"] == [str(stale_png)]
