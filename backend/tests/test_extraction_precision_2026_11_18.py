"""Extraction precision fixes found by the 18-manual evaluation and production uploads (2026-11-18)."""
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import AssignmentWorkflow, Upload, User
from app.services.assignment_workflow import CONCLUSION_TASK, extract_assignment
from app.services.lab_question_filter import filter_lab_tasks
from app.services.manual_sections import numbered_experiments


def test_single_line_experiments_use_the_heading_as_the_problem_statement():
    text = ("Python Lab Manual\n"
            "Experiment 1: Write a Python program to print the sum of the first 10 natural numbers.\n"
            "Experiment 2: Write a Python program to check whether a given number is even or odd.\n"
            "Experiment 3: Write a Python program to print the multiplication table of 5.\n")
    tasks = numbered_experiments(text)
    assert [task["id"] for task in tasks] == [1, 2, 3]
    assert "even or odd" in tasks[1]["text"]
    assert all(task["language"] == "python" for task in tasks)


def test_heading_without_a_task_still_needs_a_problem_statement():
    from app.services.manual_sections import ManualStructureError
    with pytest.raises(ManualStructureError):
        numbered_experiments("Experiment 1: Recursion\nExperiment 2: Strings\n")


def test_model_labelled_tasks_keep_verbs_outside_the_conservative_list():
    tasks = [{"text": "Count the null values in every column and fill missing Rent values with the mean.", "language": "colab"},
             {"text": "WAP to swap two numbers without using a third variable.", "language": "python"},
             {"text": "Save the preprocessed DataFrame to a new CSV file.", "language": "colab"},
             {"text": "Explain the difference between a list and a tuple.", "language": "python"},
             {"text": "Draw the class diagram neatly by hand in your journal.", "language": "java"}]
    kept = [task["text"] for task in filter_lab_tasks(tasks, model_labelled=True)]
    assert kept == [tasks[0]["text"], tasks[1]["text"], tasks[2]["text"]]
    # The local parser fallback keeps the conservative behaviour.
    assert filter_lab_tasks(tasks[:1]) == []


@pytest.mark.parametrize("text", [
    "Write the conclusion of the experiment (Client Server Implementation using Java socket programming).",
    "Write the summary, importance, and application of the experiment.",
    "Write the summary, importance, and application of the RMI experiment (conclusion).",
    "Conclusion",
])
def test_write_up_tasks_are_recognised(text):
    assert CONCLUSION_TASK.match(text)


@pytest.mark.parametrize("text", [
    "Write the summary statistics of the dataset using describe().",
    "Write a Java program to print the summary of student marks.",
])
def test_programs_mentioning_a_summary_are_not_write_ups(text):
    assert not CONCLUSION_TASK.match(text)


async def _extract(model_questions, mode="code_only"):
    with TemporaryDirectory() as folder:
        engine = create_engine("sqlite:///" + folder.replace("\\", "/") + "/t.db", connect_args={"check_same_thread": False})
        Base.metadata.create_all(engine)
        factory = sessionmaker(bind=engine)
        with factory() as db:
            user = User(email="precision@example.com", name="Precision")
            db.add(user); db.flush()
            upload = Upload(user_id=user.id, filename="m.docx", original_filename="m.docx", file_path="fixture", file_type="docx", file_size=1)
            db.add(upload); db.flush()
            workflow = AssignmentWorkflow(upload_id=upload.id, status="extracting", mode=mode)
            db.add(workflow); db.commit(); workflow_id = workflow.id
        with patch("app.services.assignment_workflow.SessionLocal", factory), \
             patch("app.services.assignment_workflow.document_text", return_value="Big Data Analytics Lab\nPractical 2\nSteps:\n1. ..."), \
             patch("app.services.assignment_workflow.generation_service.generate_json", AsyncMock(return_value={"questions": model_questions})):
            await extract_assignment(workflow_id)
        with factory() as db:
            result = db.get(AssignmentWorkflow, workflow_id)
            out = result.status, result.error, list(result.questions or [])
        engine.dispose()
        return out


@pytest.mark.asyncio
async def test_code_only_extraction_drops_write_ups_and_routes_pyspark_to_the_notebook():
    status, error, questions = await _extract([
        {"text": "Create a SparkSession, load House_Rent_Dataset.csv with spark.read.csv and print df.printSchema().", "language": "python"},
        {"text": "Write the conclusion of the experiment (PySpark preprocessing).", "language": "python"},
    ])
    assert status == "ready", error
    assert len(questions) == 1
    assert questions[0]["language"] == "colab"


@pytest.mark.asyncio
async def test_extraction_with_only_a_write_up_fails_instead_of_returning_nothing():
    status, error, questions = await _extract([{"text": "Write the conclusion of the experiment.", "language": "python"}])
    assert status == "failed"
    assert questions == []


class _Page:
    def __init__(self, text, images=0):
        self._text, self.images = text, [{}] * images

    def extract_text(self):
        return self._text


class _Pdf:
    def __init__(self, pages):
        self.pages = pages

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def _pdf_pages(pages, ocr_result):
    from app.services import pdf_ocr
    calls = []

    def fake_ocr(filename, numbers, allow_empty=False):
        calls.append(list(numbers))
        return {number: ocr_result.get(number, "") for number in numbers}
    with patch("pdfplumber.open", return_value=_Pdf(pages)), patch.object(pdf_ocr, "ocr_pdf_pages", fake_ocr):
        return pdf_ocr.pdf_text_pages("manual.pdf"), calls


QUESTION = "Experiment 1: Write a C program to reverse a string entered by the user."


def test_blank_page_is_not_sent_to_ocr_and_does_not_fail_the_manual():
    pages, calls = _pdf_pages([_Page(QUESTION), _Page(""), _Page("Page 3")], {})
    assert calls == [[]]
    assert pages[0] == QUESTION


def test_screenshot_page_that_ocr_reads_as_nothing_is_kept_empty():
    pages, calls = _pdf_pages([_Page(QUESTION), _Page("", images=1)], {2: "ok"})
    assert calls == [[2]]
    assert pages == [QUESTION, "ok"]


def test_scanned_manual_that_ocr_cannot_read_is_still_rejected():
    with pytest.raises(ValueError, match="clearer scan"):
        _pdf_pages([_Page("", images=1), _Page("", images=1)], {1: "x"})


def test_scanned_manual_with_one_unreadable_page_keeps_the_rest():
    text = "Experiment 2: Write a Java program to sort names alphabetically."
    pages, _ = _pdf_pages([_Page("", images=1), _Page("", images=1), _Page("", images=1)], {1: text, 2: text})
    assert pages[:2] == [text, text] and pages[2] == ""


def test_damaged_pdf_gets_a_specific_message():
    from app.services.pdf_ocr import UNREADABLE_PDF, pdf_text_pages
    with TemporaryDirectory() as folder:
        path = folder + "/broken.pdf"
        with open(path, "wb") as handle:
            handle.write(b"%PDF-1.4 junk")
        with pytest.raises(ValueError) as error:
            pdf_text_pages(path)
    assert str(error.value) == UNREADABLE_PDF


@pytest.mark.parametrize("text, language, expected", [
    ("Experiment 1\nAim: To write a Python program that prints the sum of the first 10 natural numbers.", "python",
     "Experiment_01_sum_first_natural.py"),
    ("Experiment 2\nAim: To write a Python program that checks whether a number is even or odd.", "python",
     "Experiment_02_number_even_odd.py"),
    ("Write a C program to sort an array using bubble sort.", "c", "exp3_sort_array_bubble.c"),
])
def test_program_file_names_come_from_the_task_not_the_aim_label(text, language, expected):
    from app.services.assignment_workflow import student_friendly_filename
    assert student_friendly_filename(text, language, 2) == expected
