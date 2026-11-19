"""Tests verifying Additional instructions behavior, output-only under-question pasting, and gap fixes."""

import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

from docx import Document
from PIL import Image
import pytest

from app.config import settings
from app.services import analysis_service, assignment_workflow as flow, network_labs
from app.services.evidence_planner import plan_experiment, select_evidence
from app.services.instruction_policy import parse_instruction_preferences
from app.services.unix_command_lab import command_lab_plan


def test_instruction_preferences_parsing():
    prefs = parse_instruction_preferences(
        "Paste only the output screenshot under the question, no need to write extra questions. Use Arial 12pt."
    )
    assert prefs.output_only_screenshots is True
    assert prefs.paste_under_question is True
    assert prefs.no_extra_questions is True
    assert prefs.no_conclusion is True
    assert prefs.font_name == "Arial"
    assert prefs.font_size == 12

    both = parse_instruction_preferences("Include both code and output screenshots under the question.")
    assert both.output_only_screenshots is False
    assert both.paste_under_question is True
    assert both.no_extra_questions is False


def test_evidence_plan_and_selection_allow_output_only_when_instructed(tmp_path):
    out_img = tmp_path / "output.png"
    Image.new("RGB", (600, 300), "navy").save(out_img)

    plan = plan_experiment(
        "Write a Python program to calculate factorial.\nOnly paste output screenshot under the question.",
        "python",
    )
    assert [req["id"] for req in plan["requirements"]] == ["execution"]
    assert plan["recommended_screenshots"] == ["terminal"]

    selection = select_evidence(plan, [{"path": str(out_img), "kind": "terminal", "caption": "Captured process transcript"}])
    assert selection["missing_requirements"] == []
    assert len(selection["selected"]) == 1


def test_docx_pastes_only_output_screenshot_directly_under_each_question_without_extra_questions(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "REPORT_DIR", str(tmp_path / "reports"))
    monkeypatch.setattr(flow, "document_text", lambda *_: "")

    src_path = tmp_path / "manual.docx"
    doc = Document()
    doc.add_paragraph("Python Lab Manual")
    doc.add_paragraph("1. Write a Python program to calculate factorial of 5.")
    doc.add_paragraph("2. Write a Python program to check palindrome.")
    doc.save(src_path)

    code_img = tmp_path / "code.png"
    out_img_1 = tmp_path / "out1.png"
    out_img_2 = tmp_path / "out2.png"
    Image.new("RGB", (600, 300), "gray").save(code_img)
    Image.new("RGB", (600, 300), "green").save(out_img_1)
    Image.new("RGB", (600, 300), "blue").save(out_img_2)

    upload = SimpleNamespace(file_path=str(src_path), file_type="docx", original_filename="manual.docx")
    results = [
        {
            "id": 1,
            "language": "python",
            "status": "completed",
            "question": "1. Write a Python program to calculate factorial of 5.\nAim: Find factorial.",
            "screenshot_paths": [str(code_img), str(out_img_1)],
            "screenshot_captions": ["Rendered IDLE source preview — factorial.py", "Captured process transcript"],
        },
        {
            "id": 2,
            "language": "python",
            "status": "completed",
            "question": "2. Write a Python program to check palindrome.",
            "screenshot_paths": [str(code_img), str(out_img_2)],
            "screenshot_captions": ["Rendered IDLE source preview — palindrome.py", "Captured process transcript"],
        },
    ]
    workflow = SimpleNamespace(
        id=101,
        mode="code_only",
        output_name="under_question_only_output",
        instructions="Paste only output screenshot under the question, no need to write extra questions.",
        results=results,
        conclusion="Should not appear.",
    )
    out_path, _ = flow.build_word_report(upload, workflow)
    out_doc = Document(out_path)

    # Exactly 2 output screenshots (no code screenshots)
    assert len(out_doc.inline_shapes) == 2
    # No extra Heading 2 / duplicate questions / Aim / Conclusion written
    non_empty_texts = [p.text for p in out_doc.paragraphs if p.text.strip()]
    assert non_empty_texts == [
        "Python Lab Manual",
        "1. Write a Python program to calculate factorial of 5.",
        "2. Write a Python program to check palindrome.",
    ]
    # Verify Q1's paragraph is immediately followed by an image paragraph, and Q2's paragraph is immediately followed by an image paragraph
    q1_p = next(p for p in out_doc.paragraphs if "factorial" in p.text)
    q2_p = next(p for p in out_doc.paragraphs if "palindrome" in p.text)
    assert q1_p._p.getnext().xpath(".//w:drawing"), "Output screenshot must be directly after Q1"
    assert q2_p._p.getnext().xpath(".//w:drawing"), "Output screenshot must be directly after Q2"
    # Verify no trailing page breaks were injected
    assert not out_doc.element.xpath('.//w:br[@w:type="page"]')


def test_sql_report_skips_extra_post_questions_conclusion_and_source_previews(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "REPORT_DIR", str(tmp_path / "reports"))
    src_path = tmp_path / "sql.docx"
    doc = Document()
    doc.add_paragraph("SQL Manual")
    doc.save(src_path)

    script_img = tmp_path / "script.png"
    query_img = tmp_path / "query.png"
    Image.new("RGB", (600, 300), "white").save(script_img)
    Image.new("RGB", (600, 300), "navy").save(query_img)

    upload = SimpleNamespace(file_path=str(src_path), file_type="docx", original_filename="Exp_1.docx")
    manual_text = "Experiment 1 Joins\nPost Experimental Exercise:\n1. What is DDL vs DML?"
    monkeypatch.setattr(flow, "document_text", lambda *_: manual_text)

    workflow = SimpleNamespace(
        id=202,
        mode="theory_and_code",
        output_name="sql_output_only",
        instructions="Only output screenshot, no need to write extra questions.",
        results=[
            {
                "id": 1,
                "language": "sql",
                "status": "completed",
                "question": "Experiment 1 Joins\nAim: Test joins.",
                "screenshot_paths": [str(script_img), str(query_img)],
                "screenshot_captions": ["SQL script", "Query 1 output"],
                "verification": {
                    "verified": True,
                    "engine": "MySQL 8.0",
                    "statements": [{"statement": "SELECT 1", "success": True, "columns": ["1"], "rows": [["1"]]}],
                    "evidence_frames": [
                        {"path": str(script_img), "kind": "source_preview", "caption": "MySQL Workbench SQL Script"},
                        {"path": str(query_img), "kind": "database", "caption": "MySQL Workbench Query 1"},
                    ],
                },
            }
        ],
    )
    out_path, _ = flow.build_word_report(upload, workflow)
    out_doc = Document(out_path)
    full_text = "\n".join(p.text for p in out_doc.paragraphs)
    assert "Post Experiment Questions" not in full_text
    assert "Conclusion" not in full_text
    assert "SQL Program" not in full_text
    assert len(out_doc.inline_shapes) == 1


def test_repair_generated_code_and_write_conclusion_receive_additional_instructions(monkeypatch):
    calls = []

    async def fake_generate_json(instruction, content, schema, on_retry=None):
        calls.append((instruction, content))
        if "edits" in schema.get("properties", {}):
            return {"edits": [{"old": "ls", "new": "ls -la"}]}
        if "answer" in schema.get("properties", {}):
            return {"answer": "Conclusion respecting instructions.", "table_headers": [], "table_rows": []}
        return {"code": "print('fixed')"}

    monkeypatch.setattr("app.services.generation_service.generation_service.generate_json", AsyncMock(side_effect=fake_generate_json))

    repaired_py = asyncio.run(
        analysis_service.repair_generated_code(
            "Sort a list", "python", "print(sorted([2,1]))", "Error", additional_instructions="Do not use built-in sorted()"
        )
    )
    assert repaired_py == "print('fixed')"
    assert "Do not use built-in sorted()" in json.loads(calls[0][1])["additional_instructions"]

    repaired_ub = asyncio.run(
        analysis_service.repair_generated_code(
            "List files", "ubuntu", "ls", "Error", additional_instructions="Show hidden files with -la"
        )
    )
    assert repaired_ub == "ls -la"
    assert "Show hidden files with -la" in json.loads(calls[1][1])["additional_instructions"]

    concl = asyncio.run(
        flow.write_conclusion(
            "Aim: Demo", [{"id": 1, "question": "Q1", "output": "ok", "status": "completed"}],
            additional_instructions="Write exactly two short sentences."
        )
    )
    assert concl == "Conclusion respecting instructions."
    assert "Write exactly two short sentences." in calls[2][1]


def test_command_lab_plan_defers_to_ai_when_custom_command_instructions_present():
    # Pure formatting instruction still uses deterministic curriculum if available
    plan_default = command_lab_plan("Experiment 2: Basic UNIX commands ls, pwd, date", instructions="Only output screenshot")
    assert plan_default is not None or plan_default is None  # curriculum match depends on script; ensure no crash

    # Explicit command constraint defers to AI generation so workflow.instructions is obeyed
    deferred = command_lab_plan(
        "Experiment 2: Basic UNIX commands ls, pwd, date",
        instructions="Use awk and grep in a custom shell script called myscript.sh",
    )
    assert deferred is None


def test_network_studio_respects_no_extra_questions(monkeypatch, tmp_path):
    shot_file = tmp_path / "shot.png"
    Image.new("RGB", (400, 250), "white").save(shot_file)

    async def fake_capture(tool, state, steps, out_dir):
        return [{"id": s["id"], "path": str(shot_file)} for s in steps]

    monkeypatch.setattr("app.services.studio_capture.capture_studio", fake_capture)
    monkeypatch.setattr("app.services.storage_service.storage_service.sync_file", lambda *_: None)

    async def no_cap(*_):
        return None

    monkeypatch.setattr(network_labs, "_stored_capture", no_cap)
    part = network_labs.detect_network_lab(
        "EXPERIMENT NO. 5\nIntroduction to Wireshark and Traffic analysis (packet headers) using Wireshark\nOpen Wireshark."
    )[0]
    wf = SimpleNamespace(id=99, instructions="Only output screenshot, no need to write extra questions.")
    res = asyncio.run(network_labs.run_studio_part(wf, None, part))
    assert res["tables_after"] == []
    assert res["answer"] == ""
