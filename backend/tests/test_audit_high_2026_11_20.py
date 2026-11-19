"""High findings of the 2026-11-20 live audit.

- The sandbox check rejected the manual's own `sh.__class__.__name__`, so the same experiment passed or failed depending on
  how the model wrote that line (Python manual Exp 3).
- Substituted results (offline MNIST/IMDB stand-ins, a swapped dataset, an Android app as a console simulation) were
  reported as completed with no visible note.
"""
from pathlib import Path
from types import SimpleNamespace

import pytest
from docx import Document

from app.security.generated_code import validate_generated_code
from app.services.colab_worker import validate_cell
from app.services.substitutions import GENERATION_RULE, report_note, substitution_notes

SHAPES = '''class Shape:
    def area(self):
        return 0
class Circle(Shape):
    def area(self):
        return 78.54
for sh in [Circle()]:
    print(f"{sh.__class__.__name__} Area: {sh.area():.2f}")
    print(type(sh).__name__, sh.__class__.__qualname__)
'''


def test_class_name_reads_are_allowed_in_programs_and_notebooks():
    validate_generated_code(SHAPES, "python")
    validate_cell(SHAPES)


@pytest.mark.parametrize("code", [
    "print(().__class__.__bases__[0].__subclasses__())",
    "x = 1\nprint(x.__class__)",
    "x = 1\nprint(x.__class__.__mro__)",
    "x = 1\nprint(x.__class__.__dict__)",
    "class A: pass\na = A()\na.__class__.__name__ = 'B'",
    "class A: pass\na = A()\na.__class__ = int",
])
def test_class_escapes_stay_blocked(code):
    with pytest.raises(ValueError):
        validate_generated_code(code, "python")
    with pytest.raises(PermissionError):
        validate_cell(code)


def test_offline_dataset_stand_in_becomes_a_plain_note():
    output = ("Note: this runtime is offline. keras.datasets.mnist.load_data() returned a small built-in sample "
              "(120 training and 30 test items), not the full mnist dataset.\nMNIST CNN Test Accuracy: 53.33%")
    notes = substitution_notes(output)
    assert len(notes) == 1 and "mnist dataset could not be downloaded" in notes[0] and "120 training and 30 test" in notes[0]


def test_declared_substitutions_are_collected_once_each():
    output = ("SUBSTITUTION: The Android emulator was replaced by a Java console program because no Android runtime is available\n"
              "Monthly EMI: 8791.59\nSUBSTITUTION: The Android emulator was replaced by a Java console program because no Android runtime is available")
    assert substitution_notes(output) == [
        "The Android emulator was replaced by a Java console program because no Android runtime is available."]
    assert substitution_notes("Monthly EMI: 8791.59") == []
    assert report_note([]) == ""


def test_generation_rule_asks_for_the_first_line():
    assert "SUBSTITUTION:" in GENERATION_RULE and "FIRST output line" in GENERATION_RULE


def test_compact_report_prints_the_note_under_the_heading(tmp_path, monkeypatch):
    from PIL import Image
    from app.config import settings
    from app.services.compact_report import build_compact_report
    monkeypatch.setattr(settings, "REPORT_DIR", str(tmp_path))
    shot = tmp_path / "out.png"
    Image.new("RGB", (400, 200), "white").save(shot)
    upload = SimpleNamespace(file_type="txt", file_path="", original_filename="m.txt")
    workflow = SimpleNamespace(id=1, output_name="r", student_name="S", results=[{
        "id": 1, "question": "Experiment 2: CNN on MNIST", "language": "python", "status": "completed",
        "screenshot_paths": [str(shot)], "screenshot_captions": ["Output"],
        "substitutions": substitution_notes("Note: this runtime is offline. keras.datasets.mnist.load_data() returned a small "
                                            "built-in sample (120 training and 30 test items), not the full mnist dataset.")}])
    path, _ = build_compact_report(upload, workflow)
    text = [p.text for p in Document(path).paragraphs]
    heading = next(i for i, t in enumerate(text) if t.startswith("Experiment 2"))
    note = next(i for i, t in enumerate(text) if t.startswith("Differs from the manual:"))
    assert note > heading and "120 training" in text[note]


def test_dataset_swap_is_flagged_without_the_models_cooperation():
    from app.services.substitutions import all_substitution_notes, dataset_swap_notes
    question = ("Experiment 2: Exploratory Data Analysis and Locally Weighted Regression\n"
                "Load the California Housing dataset with fetch_california_housing() and print the top correlations with MedHouseVal.")
    swapped = "from sklearn.datasets import load_diabetes\n# NOTE: download disabled\nraw = load_diabetes(as_frame=True)\n"
    notes = dataset_swap_notes(question, swapped)
    assert len(notes) == 1 and "California Housing" in notes[0] and "load_diabetes" in notes[0]
    assert dataset_swap_notes(question, "from sklearn.datasets import fetch_california_housing\nd = fetch_california_housing()") == []
    assert dataset_swap_notes("Experiment 1: KNN on the Iris dataset", "from sklearn.datasets import load_iris\nload_iris()") == []
    generated = "from sklearn.datasets import make_regression\nX, y = make_regression(n_samples=200)"
    assert "make_regression" in dataset_swap_notes(question, generated)[0]
    # an explicit SUBSTITUTION line about the same dataset is not repeated
    declared = "SUBSTITUTION: The California Housing dataset was replaced by load_diabetes because downloads are disabled"
    assert len(all_substitution_notes(declared, question, swapped)) == 1
