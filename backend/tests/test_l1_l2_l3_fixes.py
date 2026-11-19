"""Regression tests for L1 (NumPy scalar formatting), L2 (Viva Questions section), and L3 (Result/Conclusion text)."""

import subprocess
import sys
from types import SimpleNamespace

from docx import Document
from PIL import Image

from app.config import settings
from app.services import assignment_workflow as flow
from app.services.colab_worker import clean_notebook_text, strip_numpy_scalar_repr
from app.services.manual_sections import extract_manual_conclusion, extract_viva_questions
from app.services.runtime_engine import PYTHON_INPUT_ECHO_RUNNER


def test_l1_numpy_int64_prints_as_plain_integers_in_python_runner(tmp_path):
    script = tmp_path / "np_test.py"
    script.write_text(
        "import numpy as np\n"
        "arr = np.array([10, 20, 30])\n"
        "print([arr.argmin(), np.int64(0), np.int32(7)])\n"
        "print({'count': np.int64(42)})\n",
        encoding="utf-8",
    )
    proc = subprocess.run(
        [sys.executable, "-I", "-X", "utf8", "-u", "-c", PYTHON_INPUT_ECHO_RUNNER, str(script)],
        capture_output=True,
        text=True,
        check=True,
    )
    assert "np.int64" not in proc.stdout
    assert "np.int32" not in proc.stdout
    assert "[0, 0, 7]" in proc.stdout
    assert "{'count': 42}" in proc.stdout


def test_l1_strip_numpy_scalar_repr_and_clean_notebook_text():
    raw = "Index: np.int64(0)\nList: [np.int64(1), np.int32(2), np.uint64(3)]"
    cleaned = clean_notebook_text(raw)
    assert cleaned == "Index: 0\nList: [1, 2, 3]"
    assert strip_numpy_scalar_repr("np.int64(-5)") == "-5"


def test_l2_and_l3_extract_viva_questions_and_manual_conclusion():
    manual = (
        "Experiment 1: Linear Regression\n"
        "Aim: Implement simple linear regression in Python.\n"
        "Viva Questions:\n"
        "1. What is overfitting in machine learning?\n"
        "2. How does gradient descent minimize cost?\n"
        "Result and Conclusion:\n"
        "Thus we have studied and implemented linear regression with MSE 0.04.\n"
        "References:\n"
        "1. Bishop PRML\n"
    )
    viva = extract_viva_questions(manual)
    assert viva == [
        "What is overfitting in machine learning?",
        "How does gradient descent minimize cost?",
    ]
    conclusion = extract_manual_conclusion(manual)
    assert "Thus we have studied and implemented linear regression with MSE 0.04." in conclusion
    assert "Bishop PRML" not in conclusion


def test_l2_recover_viva_questions_tags_and_restores_missing_viva():
    manual = (
        "Experiment 1: Write a program.\n"
        "Viva-Voce Questions:\n"
        "1. Define polymorphism in Java.\n"
        "2. What is method overloading?\n"
    )
    extracted = [{"id": 1, "text": "Define polymorphism in Java.", "language": "theory", "is_theory": True}]
    recovered = flow.recover_viva_questions(manual, extracted)
    assert len(recovered) == 2
    assert all(q.get("section") == "viva" for q in recovered)
    assert recovered[1]["text"] == "What is method overloading?"


def test_l2_and_l3_pdf_report_includes_viva_section_and_conclusion_text(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "REPORT_DIR", str(tmp_path / "reports"))
    pdf_path = tmp_path / "manual.pdf"
    Image.new("RGB", (400, 600), "white").save(pdf_path, "PDF")
    img_path = tmp_path / "out.png"
    Image.new("RGB", (600, 300), "navy").save(img_path)

    pdf_text = (
        "Experiment 2: K-Means Clustering\n"
        "Aim: Cluster iris data.\n"
        "Viva Questions:\n"
        "1. What is the elbow method?\n"
        "2. Why normalize features before clustering?\n"
        "Conclusion:\n"
        "Successfully grouped dataset into 3 clusters using K-Means.\n"
    )
    monkeypatch.setattr(flow, "document_text", lambda *_: pdf_text)

    upload = SimpleNamespace(file_path=str(pdf_path), file_type="pdf", original_filename="manual.pdf")
    workflow = SimpleNamespace(
        id=501,
        mode="code_only",
        output_name="pdf_with_viva_conclusion",
        instructions="",
        results=[
            {
                "id": 1,
                "language": "colab",
                "status": "completed",
                "question": "Experiment 2: K-Means Clustering",
                "screenshot_paths": [str(img_path)],
                "screenshot_captions": ["Cluster plot"],
            }
        ],
    )
    out_path, _ = flow.build_word_report(upload, workflow)
    doc = Document(out_path)
    texts = [p.text for p in doc.paragraphs if p.text.strip()]

    assert "Viva Questions" in texts
    assert any("What is the elbow method?" in t for t in texts)
    assert any("Why normalize features before clustering?" in t for t in texts)
    assert "Conclusion" in texts
    assert any("Successfully grouped dataset into 3 clusters using K-Means." in t for t in texts)


def test_l2_theory_and_code_renders_separate_viva_section_with_answers(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "REPORT_DIR", str(tmp_path / "reports"))
    src_path = tmp_path / "manual.docx"
    Document().save(src_path)
    img_path = tmp_path / "out.png"
    Image.new("RGB", (600, 300), "navy").save(img_path)

    upload = SimpleNamespace(file_path=str(src_path), file_type="docx", original_filename="manual.docx")
    workflow = SimpleNamespace(
        id=502,
        mode="theory_and_code",
        output_name="theory_viva",
        instructions="",
        conclusion="Experiment verified all linear search test cases.",
        results=[
            {
                "id": 1,
                "language": "python",
                "status": "completed",
                "question": "Implement linear search.",
                "screenshot_paths": [str(img_path)],
                "screenshot_captions": ["Output"],
            },
            {
                "id": 2,
                "language": "theory",
                "is_theory": True,
                "section": "viva",
                "status": "completed",
                "question": "What is the worst-case time complexity of linear search?",
                "answer": "O(n), when the target is at the last index or absent.",
            },
        ],
    )
    out_path, _ = flow.build_word_report(upload, workflow)
    doc = Document(out_path)
    texts = [p.text for p in doc.paragraphs if p.text.strip()]

    assert "Viva Questions" in texts
    viva_idx = texts.index("Viva Questions")
    concl_idx = texts.index("Conclusion")
    assert viva_idx < concl_idx
    viva_block = "\n".join(texts[viva_idx:concl_idx])
    assert "worst-case time complexity" in viva_block
    assert "O(n)" in viva_block
    assert "Experiment verified all linear search test cases." in texts[concl_idx + 1]
