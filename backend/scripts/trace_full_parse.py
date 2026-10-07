import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.services.parser_service import ParserService
import docx

doc = docx.Document(os.path.join(os.path.dirname(__file__), "..", "..", "Python_Functions_Laboratory_Manual.docx"))
lines = [p.text for p in doc.paragraphs if p.text.strip()]

parser = ParserService()
tasks = []
current_task = None
in_post_lab_section = False
in_theory_section = False
skip_block = False

for idx, raw_line in enumerate(lines):
    line = raw_line.strip()
    lower_line = line.lower()
    
    if any(key in lower_line for key in ['theory & viva', 'theory questions', 'viva questions', 'review questions', 'theoretical concepts']):
        in_theory_section = True
        skip_block = True
        continue
    if any(key in lower_line for key in ['laboratory exercises', 'programming tasks', 'lab exercises', 'programming questions', 'practical exercises']):
        in_theory_section = False
        skip_block = False
    if in_theory_section:
        continue
        
    if parser._starts_post_lab_section(lower_line):
        in_post_lab_section = True
        skip_block = False
        continue

    if in_post_lab_section and parser._is_section_terminator(lower_line):
        in_post_lab_section = False
        continue

    if parser._should_skip_line(lower_line, line):
        skip_block = True
        continue

    if skip_block:
        continue
        
    starts_task_block = (
        lower_line.startswith('aim') or
        lower_line.startswith('experiment') or
        lower_line.startswith('program:') or
        lower_line.startswith('problem:') or
        lower_line.startswith('question:') or
        parser._is_program_prompt(line) or
        (in_post_lab_section and parser._looks_like_enumerated_prompt(line))
    )
    is_separate_question = parser._is_separate_numbered_question(line)
    
    if starts_task_block or is_separate_question:
        if current_task:
            finalized = parser._finalize_task(current_task)
            q_text = finalized.get("question_text", "")
            print(f"Finalized task: {q_text[:70]}")
            tasks.append(finalized)
        if lower_line.startswith('aim'):
            current_task = parser._build_aim_task(line)
        elif in_post_lab_section and parser._looks_like_enumerated_prompt(line):
            current_task = parser._build_prompt_task(line)
        else:
            current_task = parser._initialize_task(line)
        print(f"Started task [{idx}]: {line[:60]}")

if current_task:
    finalized = parser._finalize_task(current_task)
    q_text = finalized.get("question_text", "")
    print(f"Final task: {q_text[:70]}")
    tasks.append(finalized)

print(f"\nTotal tasks before filter: {len(tasks)}")

from app.services.lab_question_filter import filter_lab_tasks
filtered = filter_lab_tasks(tasks)
print(f"Total tasks AFTER filter_lab_tasks: {len(filtered)}")
for i, f in enumerate(filtered):
    print(f"  {i+1}: {f.get('question_text', '')[:80]}")
