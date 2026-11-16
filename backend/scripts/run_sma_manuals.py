"""Run every Social Media Analytics experiment through LabMate's real execution and report code, with no language model.

    python -m scripts.run_sma_manuals [--only 1,2] [--theme light|dark] [--out DIR]

For each experiment this runs the code parts in the real notebook runtime on the bundled practice data (through
assignment_workflow.execute_solution, the call the live workflow makes), attaches labelled stand-in images to the
evidence parts, builds the Word report with assignment_workflow.build_word_report, and checks the output.

Writes, under Labmate_documents/Labmate_documents/sma/completed/, one report per experiment, and copies every
screenshot to <out>/screenshots. The evidence stand-ins say so on their face: they are not Power BI, Canva, ParseHub,
Google Trends or Similarweb screens. Exits non-zero if any experiment fails its checks.
"""
import argparse
import asyncio
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace

os.environ.setdefault('EXECUTION_ISOLATION', 'development')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from PIL import Image, ImageDraw

from scripts.sma_manual_cases import CASES

REPO = Path(__file__).resolve().parents[2]
REPORT_DIR = REPO / 'Labmate_documents' / 'Labmate_documents' / 'sma' / 'completed'
LEFT_UNATTACHED = {'powerbi_certificate'}   # Experiment 7 keeps one slot empty to show the "Not attached" placeholder.


def stand_in(path, label):
    image = Image.new('RGB', (1280, 720), (245, 247, 250))
    draw = ImageDraw.Draw(image)
    draw.rectangle((8, 8, 1271, 711), outline=(120, 130, 150), width=4)
    draw.text((40, 40), 'STAND-IN FOR THE STUDENT\'S OWN SCREENSHOT', fill=(180, 35, 24))
    draw.text((40, 80), label, fill=(30, 41, 59))
    draw.text((40, 120), 'LabMate never creates Power BI, Canva, ParseHub, Google Trends or Similarweb images.', fill=(71, 85, 105))
    image.save(path)


async def run_case(case, theme, work, out):
    from app.services.assignment_workflow import attach_evidence, build_word_report, execute_solution, student_friendly_filename
    from app.routers.workflows import _write_prompt_manual
    from app.services.sma_datasets import load_datasets
    from app.services.sma_requirements import sma_shortfall

    number = case['number']
    problems, results, questions, rows = [], [], [], []
    for index, part in enumerate(case['parts'], 1):
        question = {'id': index, 'text': part['title'], 'language': 'colab' if part['kind'] == 'code' else 'theory',
                    'track': 'sma', 'kind': part['kind'], 'part_title': part['title']}
        base = {'id': index, 'question': part['title'], 'kind': part['kind'], 'part_title': part['title']}
        if part['kind'] == 'code':
            short = sma_shortfall(question, part['code'])
            if short:
                problems.append(f"{part['title']}: {short}")
            config = {'colab_theme': theme, 'notebook_template': 'colab', 'jupyter_theme': 'light',
                      'datasets': load_datasets(part['datasets']) or None, 'exp_no': f'{number:02d}',
                      'student_name': 'Test Student', 'subject': 'SMALab',
                      'notebook_title': f'SMALab_Test_Exp{number:02d}.ipynb'}
            execution = await execute_solution(part['code'], 'colab', part['title'], f'sma_{number}_{index}', 'Student',
                                               filename=f'sma_exp{number}_{index}.py', project_config=config)
            output = execution.output or ''
            if not execution.success:
                problems.append(f"{part['title']}: execution failed: {execution.error or (execution.verification or {}).get('error')}")
            for pattern in part['expect']:
                if not re.search(pattern, output):
                    problems.append(f"{part['title']}: output is missing /{pattern}/")
            if len(execution.screenshots) < 1:
                problems.append(f"{part['title']}: no screenshots were captured")
            results.append({**base, 'language': 'colab', 'answer': 'Program for the experiment.', 'code': part['code'],
                            'output': output, 'error': execution.error or '', 'status': 'completed' if execution.success else 'failed',
                            'screenshot_paths': list(execution.screenshots), 'verification': execution.verification,
                            'execution_stages': execution.stages})
            print(f"      {part['title']}: {len(execution.screenshots)} screenshots, plots={len(re.findall('plot', output))}")
        else:
            results.append({**base, 'language': 'theory', 'is_theory': True, 'answer': part['answer'], 'code': '', 'output': '',
                            'error': '', 'status': 'completed', 'screenshot_paths': [],
                            **({'table': part['table']} if part.get('table') else {})})
            if part['kind'] == 'evidence':
                question['evidence_slots'] = [{'id': slot, 'label': label} for slot, label in part['slots']]
                for slot, label in part['slots']:
                    if slot in LEFT_UNATTACHED:
                        continue
                    path = work / f'standin_{number}_{slot}.png'
                    stand_in(path, label)
                    rows.append((index, slot, str(path)))
        questions.append(question)

    results = attach_evidence(results, questions, rows)
    manual = work / f'manual_{number}.docx'
    _write_prompt_manual(str(manual), case['title'], [{'id': q['id'], 'text': q['text']} for q in questions])
    upload = SimpleNamespace(file_path=str(manual), file_type='docx', original_filename=f"EXP {number} {case['title']}.docx")
    workflow = SimpleNamespace(id=number, mode='theory_and_code', instructions='', results=results, output_name=f'sma_exp{number}',
                               student_name='Test Student', roll_no='', department='', institution='')
    path, filename = await asyncio.to_thread(build_word_report, upload, workflow)
    target = REPORT_DIR / (re.sub(r'[^A-Za-z0-9 ()_-]+', '', f"EXP {number} {case['title']} (SMA {theme})") + '.docx')
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, target)

    import docx
    document = docx.Document(target)
    text = '\n'.join(p.text for p in document.paragraphs)
    for part in case['parts']:
        if part['title'] not in text:
            problems.append(f"report is missing the heading {part['title']!r}")
    if any(part['kind'] == 'evidence' for part in case['parts']) and 'Student-supplied' not in text:
        problems.append('report is missing the student-supplied captions')
    if number == 7 and '[Not attached: Power BI Basics course certificate' not in text:
        problems.append('Experiment 7 should show the Not attached placeholder')
    if any(part.get('table') for part in case['parts']) and not document.tables:
        problems.append('report is missing the comparison table')
    for result in results:
        for shot in result.get('screenshot_paths') or []:
            if Path(shot).is_file():
                shutil.copyfile(shot, out / 'screenshots' / f"exp{number}_{theme}_{result['id']}_{Path(shot).name}")
    return problems, target


async def main(args):
    selected = {int(n) for n in args.only.split(',')} if args.only else None
    out = Path(args.out).resolve()
    (out / 'screenshots').mkdir(parents=True, exist_ok=True)
    failures = 0
    with tempfile.TemporaryDirectory(prefix='sma_manuals_') as folder:
        for case in CASES:
            if selected and case['number'] not in selected:
                continue
            problems, target = await run_case(case, args.theme, Path(folder), out)
            failures += bool(problems)
            print(f"[{'PASS' if not problems else 'FAIL'}] exp{case['number']} {case['title']} -> {target.name}")
            for problem in problems:
                print('        - ' + problem)
    print('%d failed' % failures)
    return 1 if failures else 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--theme', choices=['light', 'dark'], default='light')
    parser.add_argument('--only', default='')
    parser.add_argument('--out', default=str(REPO / 'test_screenshots' / 'sma_verified_screenshots'))
    sys.exit(asyncio.run(main(parser.parse_args())))
