"""Tkinter experiments run in a real window on a private display and are verified from what the window shows."""
import asyncio
import os
import shutil
import tempfile
from pathlib import Path

import pytest

from app.services import tk_gui_runtime
from app.services.evidence_planner import plan_experiment, verification_summary

needs_display = pytest.mark.skipif(os.name != "nt" and not shutil.which("xvfb-run"), reason="a private display (Windows desktop or Xvfb) is required")

CALCULATOR = '''
import tkinter as tk
from tkinter import messagebox
root = tk.Tk()
root.title("Simple Calculator")
a = tk.Entry(root); a.pack()
b = tk.Entry(root); b.pack()
out = tk.Label(root, text="Result: "); out.pack()
def add():
    out.config(text="Result: %g" % (float(a.get()) + float(b.get())))
def divide():
    if float(b.get()) == 0:
        messagebox.showerror("Error", "Cannot divide by zero")
    else:
        out.config(text="Result: %g" % (float(a.get()) / float(b.get())))
tk.Button(root, text="Add", command=add).pack()
tk.Button(root, text="Divide", command=divide).pack()
tk.Button(root, text="Quit", command=root.destroy).pack()
root.mainloop()
'''


def run(code, objective=""):
    async def go():
        with tempfile.TemporaryDirectory() as folder:
            return await tk_gui_runtime.capture_tkinter(Path(folder), code, "solution.py", objective)
    return asyncio.run(go())


def test_the_category_is_supported_and_verified_from_observed_window_text():
    plan = plan_experiment("Build a Tkinter calculator. Expected output: Result: 16", "python")
    assert plan["category"] == "tkinter" and plan["supported"] is True and plan["expected_output"] == ["Result: 16"]
    good = {"status": "passed", "kind": "gui", "required": True, "tests": [{"status": "passed", "observed_text": "Add\nResult: 16"}]}
    bad = {"status": "passed", "kind": "gui", "required": True, "tests": [{"status": "passed", "observed_text": "Add\nResult: 17"}]}
    assert verification_summary(plan, True, "", good)["checks"]["output"] == "passed"
    assert verification_summary(plan, True, "", bad)["checks"]["output"] == "failed"


def test_sample_inputs_are_read_from_the_manual():
    assert tk_gui_runtime.sample_inputs("Sample input: 12 and 4.") == ["12", "4"]
    assert tk_gui_runtime.sample_inputs("Expected input (sample): 7, -2.5") == ["7", "-2.5"]
    assert tk_gui_runtime.sample_inputs("Sample input: Asha, Ravi") == ["Asha", "Ravi"]
    assert tk_gui_runtime.sample_inputs("no sample here") == []


@needs_display
def test_a_real_window_is_filled_clicked_read_back_and_photographed():
    result = run(CALCULATOR, "Sample input: 12 and 4")
    assert result.success, result.error
    test = result.verification["tests"][0]
    assert test["clicks"] == ["Add", "Divide"]                      # Quit is never pressed
    text = test["observed_text"].splitlines()
    assert "Simple Calculator" in text and "Result: 16" in text and "Result: 3" in text
    assert len(result.screenshots) >= 3
    from PIL import Image
    for path in result.screenshots.values():
        assert Image.open(path).size[0] > 100


@needs_display
def test_message_boxes_are_answered_and_recorded_instead_of_blocking():
    result = run(CALCULATOR, "Sample input: 5 and 0")
    assert result.success, result.error
    assert "showerror: Error | Cannot divide by zero" in result.verification["tests"][0]["observed_text"]


@needs_display
def test_a_program_that_fails_in_a_button_callback_is_reported():
    broken = CALCULATOR.replace("float(a.get()) + float(b.get())", "float(a.get()) + undefined_name")
    result = run(broken, "Sample input: 1 and 2")
    assert not result.success and "NameError" in result.error


@needs_display
def test_a_program_without_a_window_is_not_reported_as_a_gui_pass():
    result = run("print('hello')")
    assert not result.success and "No Tkinter window" in result.error


def test_unsafe_imports_are_refused_before_anything_runs():
    result = run("import os\nimport tkinter\nos.system('echo no')\n")
    assert not result.success and "unsupported import" in result.error and result.exit_code == 126
