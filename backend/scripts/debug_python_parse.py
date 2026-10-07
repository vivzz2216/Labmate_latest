import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from docx import Document
from app.services.parser_service import parser_service

doc = Document("sample_lab_manuals/python_lab_manual.docx")
lines = [p.text.strip() for p in doc.paragraphs if p.text.strip()]

tasks = []
current_task = None
skip_block = False
in_post_lab_section = False
in_theory_section = False

for idx, raw_line in enumerate(lines):
    line = raw_line.strip()
    original_line = raw_line
    lower_line = line.lower()

    if any(k in lower_line for k in ["theory & viva", "theory questions", "viva questions", "review questions", "theoretical concepts"]):
        in_theory_section = True
        skip_block = True
        print(f"[{idx}] Entered theory section")
        continue

    if any(k in lower_line for k in ["laboratory exercises", "programming tasks", "lab exercises", "programming questions", "practical exercises"]) or (
        parser_service._is_separate_numbered_question(line) and ("program" in lower_line or "write" in lower_line)
    ):
        in_theory_section = False
        skip_block = False
        print(f"[{idx}] Exited theory section")

    if in_theory_section:
        print(f"[{idx}] Skipped in theory section: {line[:40]}")
        continue

    if parser_service._should_skip_line(lower_line, line):
        skip_block = True
        print(f"[{idx}] _should_skip_line: {line[:40]}")
        continue

    if skip_block:
        print(f"[{idx}] skip_block is True: {line[:40]}")
        continue

    if lower_line.startswith("aim") and current_task and not current_task.get("collecting_code", False):
        aim_clean = parser_service._clean_prompt_text(line)
        current_task["question_text"] = f"{current_task['question_text']} (Aim: {aim_clean})"
        print(f"[{idx}] Attached Aim to current_task")
        continue

    starts_task_block = (
        lower_line.startswith("aim") or
        lower_line.startswith("experiment") or
        lower_line.startswith("program:") or
        lower_line.startswith("problem:") or
        lower_line.startswith("question:") or
        parser_service._is_program_prompt(line) or
        (in_post_lab_section and parser_service._looks_like_enumerated_prompt(line))
    )
    is_separate_question = parser_service._is_separate_numbered_question(line)

    if starts_task_block or is_separate_question:
        if current_task:
            print(f"[{idx}] Finalizing previous task: {current_task['question_text'][:50]}")
            tasks.append(parser_service._finalize_task(current_task))
        current_task = parser_service._initialize_task(line)
        print(f"[{idx}] Started new task: {current_task['question_text'][:50]}")
        continue

if current_task:
    print(f"[END] Finalizing last task: {current_task['question_text'][:50]}")
    tasks.append(parser_service._finalize_task(current_task))

print(f"\nTotal tasks in trace: {len(tasks)}")
for i, t in enumerate(tasks, 1):
    print(f"Task {i}: {t['question_text'][:80]}")
