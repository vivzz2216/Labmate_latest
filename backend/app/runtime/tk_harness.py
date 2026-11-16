"""Runs a student's Tkinter program on a private display, drives it, and captures real window pixels.

Usage (started by app/services/tk_gui_runtime.py):  python tk_harness.py <script> <out_dir> <plan.json> <events.tsv>

The program runs unmodified. Only blocking calls are replaced: mainloop() drives the window instead of waiting for a person, and
message boxes / simple dialogs answer immediately (and are recorded). The harness then fills the entries it finds, presses the buttons it
finds, reads back every piece of text on screen, and grabs the window's pixels after each step. Results go to the events file.
"""
import base64
import json
import os
import re
import runpy
import sys
import time
import traceback
from pathlib import Path

script, out_dir, plan_path, events_path = sys.argv[1:5]
plan = json.loads(Path(plan_path).read_text(encoding="utf-8"))
OUT = Path(out_dir)
EVENTS = []
DIALOGS = []
ERRORS = []
INPUTS = [str(v) for v in plan.get("inputs", [])] or ["5", "3", "2"]
MAX_CLICKS = int(plan.get("max_clicks", 8))
SKIP_BUTTON = re.compile(r"\b(?:exit|quit|close|close\s+window)\b", re.I)


def b64(text):
    return base64.b64encode(str(text).encode("utf-8")).decode("ascii")


def event(*columns):
    EVENTS.append("\t".join(str(c) for c in columns))


def flush(status):
    event("DONE", status)
    Path(events_path).write_text("\n".join(EVENTS), encoding="utf-8")


if os.name == "nt":
    try:                                    # one pixel coordinate system for Tk and the screen grab
        import ctypes
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        pass

import tkinter as tk  # noqa: E402
from tkinter import messagebox, simpledialog, filedialog  # noqa: E402

_input_cursor = [0]


def next_input():
    value = INPUTS[_input_cursor[0] % len(INPUTS)]
    _input_cursor[0] += 1
    return value


def record_dialog(kind, args, kwargs):
    parts = [str(a) for a in args[:2]] + [str(kwargs.get(k)) for k in ("title", "message") if kwargs.get(k)]
    DIALOGS.append("%s: %s" % (kind, " | ".join(parts)))


def make_message(kind, answer):
    def fake(*args, **kwargs):
        record_dialog(kind, args, kwargs)
        return answer
    return fake


for name, answer in (("showinfo", "ok"), ("showwarning", "ok"), ("showerror", "ok"), ("askquestion", "yes"), ("askokcancel", True),
                     ("askyesno", True), ("askyesnocancel", True), ("askretrycancel", False)):
    setattr(messagebox, name, make_message(name, answer))


def make_ask(kind, convert):
    def fake(*args, **kwargs):
        record_dialog(kind, args, kwargs)
        try:
            return convert(next_input())
        except ValueError:
            return None
    return fake


simpledialog.askstring = make_ask("askstring", str)
simpledialog.askinteger = make_ask("askinteger", int)
simpledialog.askfloat = make_ask("askfloat", float)
filedialog.askopenfilename = lambda *a, **k: ""
filedialog.asksaveasfilename = lambda *a, **k: ""
filedialog.askdirectory = lambda *a, **k: ""


def walk(widget):
    yield widget
    for child in widget.winfo_children():
        yield from walk(child)


def cls(widget):
    return widget.winfo_class()


ENTRY = {"Entry", "TEntry", "Spinbox", "TSpinbox"}
BUTTON = {"Button", "TButton", "Checkbutton", "TCheckbutton", "Radiobutton", "TRadiobutton", "Menubutton"}


def text_of(widget):
    kind = cls(widget)
    try:
        if kind in ("Label", "TLabel", "Button", "TButton", "Checkbutton", "TCheckbutton", "Radiobutton", "TRadiobutton", "Labelframe", "TLabelframe", "Message"):
            variable = str(widget.cget("textvariable")) if "textvariable" in widget.keys() else ""
            if variable:
                return str(widget.getvar(variable))
            return str(widget.cget("text"))
        if kind in ENTRY or kind == "TCombobox":
            return str(widget.get())
        if kind == "Text":
            return widget.get("1.0", "end-1c")
        if kind == "Listbox":
            return "\n".join(str(widget.get(i)) for i in range(widget.size()))
        if kind == "Canvas":
            found = []
            for item in widget.find_all():
                if widget.type(item) == "text":
                    found.append(str(widget.itemcget(item, "text")))
            return "\n".join(found)
        if kind == "Treeview":
            rows = []
            for item in widget.get_children(""):
                rows.append(" ".join([str(widget.item(item, "text"))] + [str(v) for v in widget.item(item, "values")]))
            return "\n".join(rows)
    except Exception:
        return ""
    return ""


def observed(root):
    lines = []
    try:
        lines.append(str(root.title()))
    except Exception:
        pass
    for widget in walk(root):
        value = text_of(widget).strip()
        if value:
            lines.extend(part for part in value.split("\n") if part.strip())
    lines.extend(DIALOGS)
    return "\n".join(lines)


def settle(root, seconds=0.25):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        root.update()
        time.sleep(0.02)


def window_box(root):
    """The window with its title bar (Windows: the frame bounds), or the client area elsewhere."""
    if os.name == "nt":
        try:
            import ctypes
            from ctypes import wintypes
            hwnd = ctypes.windll.user32.GetParent(root.winfo_id()) or root.winfo_id()
            rect = wintypes.RECT()
            if ctypes.windll.dwmapi.DwmGetWindowAttribute(wintypes.HWND(hwnd), 9, ctypes.byref(rect), ctypes.sizeof(rect)) != 0:
                ctypes.windll.user32.GetWindowRect(wintypes.HWND(hwnd), ctypes.byref(rect))
            if rect.right > rect.left and rect.bottom > rect.top:
                return rect.left, rect.top, rect.right, rect.bottom
        except Exception:
            pass
    x, y = root.winfo_rootx(), root.winfo_rooty()
    return x, y, x + max(root.winfo_width(), 1), y + max(root.winfo_height(), 1)


def grab(root, name):
    from PIL import ImageGrab
    settle(root, 0.12)
    try:
        root.lift()
        root.attributes("-topmost", True)
    except Exception:
        pass
    root.update()
    image = ImageGrab.grab(bbox=window_box(root))
    path = OUT / ("tk_%s.png" % name)
    image.save(path)
    event("IMAGE", path.name)


def drive(root):
    root.report_callback_exception = lambda exc, val, tb: ERRORS.append("".join(traceback.format_exception(exc, val, tb))[-600:])
    settle(root, 0.5)
    grab(root, "01_initial")
    snapshots = [observed(root)]
    entries = [w for w in walk(root) if cls(w) in ENTRY and str(w.cget("state")) != "disabled"]
    for entry in entries:
        value = next_input()
        try:
            entry.delete(0, "end")
            entry.insert(0, value)
        except Exception:
            pass
    for widget in walk(root):
        if cls(widget) == "TCombobox":
            values = widget.cget("values")
            if values:
                widget.set(values[0] if isinstance(values, (tuple, list)) else str(values).split()[0])
        elif cls(widget) in ("Scale", "TScale") and "from" in widget.keys():
            try:
                widget.set((float(widget.cget("from")) + float(widget.cget("to"))) / 2)
            except Exception:
                pass
    if entries:
        grab(root, "02_filled")
        snapshots.append(observed(root))
    clicks = 0
    for button in [w for w in walk(root) if cls(w) in BUTTON]:
        if clicks >= MAX_CLICKS:
            break
        label = text_of(button)
        if SKIP_BUTTON.search(label) or str(button.cget("state")) == "disabled":
            continue
        try:
            button.invoke()
        except Exception as error:
            ERRORS.append("Button %r raised %s: %s" % (label, type(error).__name__, error))
        clicks += 1
        event("CLICK", b64(label))
        settle(root, 0.2)
        grab(root, "%02d_click_%d" % (2 + clicks, clicks))
        snapshots.append(observed(root))
    event("OBSERVED", b64("\n".join(dict.fromkeys(line for snap in snapshots for line in snap.split("\n")))))


def patched_mainloop(self, n=0):
    root = self._root()
    try:
        drive(root)
    except Exception as error:
        ERRORS.append("Harness error: %s: %s" % (type(error).__name__, error))
    state["driven"] = True
    try:
        root.destroy()
    except Exception:
        pass


state = {"driven": False}
tk.Misc.mainloop = patched_mainloop
tk.mainloop = lambda n=0: None
sys.argv = [script]
os.chdir(OUT.parent)
try:
    runpy.run_path(script, run_name="__main__")
except SystemExit:
    pass
except BaseException as error:  # the student's own program failed
    ERRORS.append("".join(traceback.format_exception(type(error), error, error.__traceback__))[-900:])
if not state["driven"]:
    ERRORS.append("No Tkinter window was shown: the program never reached mainloop().")
for message in ERRORS:
    event("ERROR", b64(message))
flush("failed" if ERRORS else "passed")
sys.stdout.flush()
os._exit(0)
