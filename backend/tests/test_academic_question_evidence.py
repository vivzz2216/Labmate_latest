from types import SimpleNamespace

import pytest
from docx import Document
from PIL import Image

from app.config import settings
from app.services.assignment_workflow import build_word_report, document_text
from app.services.docx_layout import find_question_anchor
from app.services.instruction_policy import parse_instruction_preferences
from app.services.manual_sections import numbered_experiments


INSTRUCTIONS = 'Paste each post-experiment question’s screenshots directly under that question.'
MANUAL = '''Subject: Python Lab
Experiment – 6: Functions and Exception Handling in Python
Aim: To implement a python program to define functions for the following:
Linear Search Algorithm
To implement a python program to define functions for the following:
I. To handle multiple exceptions.
II. Create a list of strings, if the string ends with ing replace it by ly.
III. To implement anonymous functions (lambda, map, reduce, filter).
5. Pre-Experiment Exercise
Theory:
Explain functions in Python.
6. Laboratory Exercise
Procedure:
Open IDLE and save your file.
Program code with comments:
Write and execute your program code to achieve the given aim.
7. Post-Experiments Exercise
A. Extended Theory:
Explain recursion with an example.
B. Questions/Programs:
Write a Python program to demonstrate iterator and generator functions.
Write a Python program to calculate sum of first 5 natural numbers using recursion.
C. Conclusion:
Write what was performed.
'''


def test_academic_manual_splits_six_programs_and_keeps_locations():
    tasks = numbered_experiments(MANUAL)
    assert len(tasks) == 6
    assert [item['id'] for item in tasks] == list(range(1, 7))
    assert all(item['experiment_number'] == 6 for item in tasks)
    assert all(item['language'] == 'python' for item in tasks)
    assert 'lambda, map, reduce, filter' in tasks[3]['text']
    assert tasks[-1]['source_section'] == 'Post-lab programs'
    for item in tasks:
        assert MANUAL.splitlines()[item['source_line']] == item['text']
    assert not any('Explain' in item['text'] for item in tasks)
    assert parse_instruction_preferences(INSTRUCTIONS).paste_under_question


def test_different_post_lab_heading_and_wrapped_question():
    source = '''Subject: Python Lab
Experiment 12: Lists and recursion
6. Laboratory Exercise
1) Write a Python program to reverse a list.
Use the list [1, 2, 3] and print both lists.
7. Post-lab exercises
Programming exercises:
a) Write a Python program to calculate a factorial using recursion.
b) Write a Python program to generate squares using a generator.
Results/Observations/Program output:
Present the program input/output results and comment on the same.
References:
Python documentation
'''
    tasks = numbered_experiments(source)
    assert len(tasks) == 3
    assert 'Use the list [1, 2, 3]' in tasks[0]['source_question']
    assert 'Results/Observations' not in tasks[-1]['source_question']
    doc = Document()
    for line in source.splitlines():
        doc.add_paragraph(line)
    anchor = find_question_anchor(doc, tasks[0]['source_question'], strict=True)
    assert anchor[2].text == 'Use the list [1, 2, 3] and print both lists.'
    assert find_question_anchor(doc, 'Write a Python program that is absent.', strict=True) is None


def test_duplicate_question_wording_uses_original_location():
    doc = Document()
    question = 'Write a Python program to calculate a factorial.'
    doc.add_paragraph('Laboratory exercise')
    doc.add_paragraph(question)
    doc.add_paragraph('Post-lab programs')
    doc.add_paragraph(question)
    anchor = find_question_anchor(doc, question, strict=True, source_line=3)
    assert anchor[1] == 3


@pytest.mark.parametrize('instructions', ['', 'Use readable screenshots.', 'Do not paste screenshots under each question.'])
def test_default_and_unrelated_instructions_append_all_evidence(tmp_path, monkeypatch, instructions):
    monkeypatch.setattr(settings, 'REPORT_DIR', str(tmp_path / 'reports'))
    source = tmp_path / 'manual.docx'
    original = Document()
    for line in MANUAL.splitlines():
        original.add_paragraph(line)
    original.save(source)
    image = tmp_path / 'evidence.png'
    Image.new('RGB', (640, 240), 'navy').save(image)
    tasks = numbered_experiments(MANUAL)
    results = [dict(item, question=item['text'], status='completed',
                    screenshot_paths=[str(image), str(image)], screenshot_captions=['Source code', 'Output'])
               for item in tasks]
    upload = SimpleNamespace(file_path=str(source), file_type='docx', original_filename=source.name)
    workflow = SimpleNamespace(id=1, mode='code_only', instructions=instructions,
                               output_name='appended', results=results)
    path, _ = build_word_report(upload, workflow)
    report = Document(path)
    count = len(original.paragraphs)
    assert [p.text for p in report.paragraphs[:count]] == [p.text for p in original.paragraphs]
    assert not any(p._p.xpath('.//w:drawing') for p in report.paragraphs[:count])
    assert len(report.inline_shapes) == 12


def test_split_code_and_output_stay_under_each_exact_question(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'REPORT_DIR', str(tmp_path / 'reports'))
    source = tmp_path / 'manual.docx'
    doc = Document()
    for line in MANUAL.splitlines():
        doc.add_paragraph(line)
    original_margin = doc.sections[0].top_margin
    doc.save(source)
    before = source.read_bytes()
    upload = SimpleNamespace(file_path=str(source), file_type='docx', original_filename=source.name)
    tasks = numbered_experiments(document_text(upload))
    tall = tmp_path / 'source.png'
    output = tmp_path / 'output.png'
    Image.new('RGB', (700, 1800), 'navy').save(tall)
    Image.new('RGB', (700, 200), 'green').save(output)
    results = [dict(item, question=item['text'], status='completed',
                    screenshot_paths=[str(tall), str(output)],
                    screenshot_captions=['Rendered IDLE source preview — exp6.py', 'Captured process transcript'])
               for item in tasks]
    workflow = SimpleNamespace(id=1, mode='code_only', instructions=INSTRUCTIONS,
                               output_name='completed', results=results)
    path, _ = build_word_report(upload, workflow)
    report = Document(path)
    assert source.read_bytes() == before
    assert report.sections[0].top_margin == original_margin
    for item in tasks:
        anchor = find_question_anchor(report, item['source_question'], strict=True)
        cursor = anchor[2]._p.getnext()
        captions = []
        images = 0
        while cursor is not None:
            text = ''.join(cursor.itertext()).strip()
            if cursor.xpath('.//w:drawing'):
                images += 1
            elif text.startswith(('Code', 'Output')):
                captions.append(text)
            else:
                break
            cursor = cursor.getnext()
        assert images >= 3  # Multi-page source, then output, never interleaved.
        assert all(cap.startswith('Code') for cap in captions[:-1])
        assert captions[-1].startswith('Output')
    workflow.results[0]['source_question'] = 'This original question cannot be located.'
    with pytest.raises(ValueError, match='Report needs review'):
        build_word_report(upload, workflow)
