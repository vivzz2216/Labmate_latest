"""Real Tkinter windows on a private display, with the window's own pixels as evidence.

Like the Java GUI runtime this keeps the windows off the user's desktop (a private Windows desktop, or Xvfb on Linux); it is not an
untrusted-code VM. The harness (app/runtime/tk_harness.py) fills entries, presses buttons and reads back all on-screen text.
"""
import base64
import json
import os
import re
import shutil
import sys
import uuid
from pathlib import Path

from ..config import settings


def decode(value):
    return base64.b64decode(value).decode("utf-8", "replace")


def sample_inputs(objective):
    """Values the manual gives for the entries ('Sample input: 12 and 4'), in order; empty when it gives none."""
    found = re.search(r"(?:sample|expected)" + r"\s+input[^:\n]*:\s*([^\n]+)", objective or "", re.I)
    if not found:
        return []
    text = re.split(r"\.(?:\s|$)", found.group(1).strip())[0].strip()      # the sample ends at the end of its sentence
    if re.fullmatch(r"[-\d.,\s]*(?:and[-\d.,\s]*)*", text):
        return re.findall(r"-?\d+(?:\.\d+)?", text)[:8]
    return [part.strip() for part in re.split(r"\s*(?:,|;|\band\b)\s*", text) if part.strip()][:8]


async def capture_tkinter(directory, code, filename=None, objective=""):
    from ..security.generated_code import validate_generated_code
    from .java_gui_runtime import private_desktop
    from .runtime_engine import RuntimeResult, run_process
    try:
        validate_generated_code(code, "python")
    except (ValueError, SyntaxError) as error:
        return RuntimeResult(False, error="Security policy violation: %s" % error, exit_code=126)
    if os.name != "nt" and not shutil.which("xvfb-run"):
        return RuntimeResult(False, error="Tkinter needs xvfb-run on this server. No active display will be used as a fallback.", exit_code=69)
    name = Path(filename or "solution.py").name
    if not name.endswith(".py"):
        name += ".py"
    source = directory / name
    source.write_text(code, encoding="utf-8")
    harness = Path(__file__).parents[1] / "runtime" / "tk_harness.py"
    output_dir = Path(settings.SCREENSHOT_DIR).resolve() / ("tk_gui_" + uuid.uuid4().hex)
    output_dir.mkdir(parents=True)
    plan = directory / "_tk_plan.json"
    events = directory / "_tk_events.tsv"
    plan.write_text(json.dumps({"inputs": sample_inputs(objective), "max_clicks": 8}), encoding="utf-8")
    command = [sys.executable, "-u", harness, source, output_dir, plan, events]
    if os.name != "nt":
        command = ["xvfb-run", "-a", "--server-args=-screen 0 1600x1200x24 -nolisten tcp", *command]
    with private_desktop() as desktop:
        run = await run_process(command, directory, timeout=settings.JAVA_GUI_TEST_TIMEOUT,
                                resource_limits={"max_memory_bytes": 0, "max_cpu_seconds": 25}, desktop=desktop)
    screenshots, clicks, errors, observed_text, done = {}, [], [], "", ""
    for row in events.read_text(encoding="utf-8").splitlines() if events.exists() else []:
        columns = row.split("\t")
        if columns[0] == "IMAGE" and len(columns) == 2 and re.fullmatch(r"tk_[\w]+\.png", columns[1]) and (output_dir / columns[1]).is_file():
            screenshots[columns[1]] = str(output_dir / columns[1])
        elif columns[0] == "CLICK" and len(columns) == 2:
            clicks.append(decode(columns[1]))
        elif columns[0] == "ERROR" and len(columns) == 2:
            errors.append(decode(columns[1]))
        elif columns[0] == "OBSERVED" and len(columns) == 2:
            observed_text = decode(columns[1])
        elif columns[0] == "DONE":
            done = columns[1]
    passed = done == "passed" and bool(screenshots) and run.success is not False
    if not screenshots and not errors:
        errors.append("No Tkinter window evidence was captured.")
    test = {"name": "Tkinter window", "status": "passed" if passed else "failed", "observed_text": observed_text, "clicks": clicks,
            "assertions": [], "mutations": [{"action": "click", "locator": label} for label in clicks]}
    verification = {"kind": "gui", "required": True, "status": "passed" if passed else "failed", "tests": [test],
                    "capture_method": "actual Tkinter window pixels on a private desktop/display",
                    "display_backend": "private Windows desktop" if os.name == "nt" else "Xvfb"}
    return RuntimeResult(passed, run.output, "\n".join(errors), 0 if passed else 1, screenshots=screenshots, verification=verification,
                         stages={"gui": "passed" if passed else "failed"})
