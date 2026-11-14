"""Create the R lab manuals, run every experiment in real R and build the RStudio-evidence reports.

    python -m scripts.run_r_manuals [--theme light|dark|both] [--only 1,2] [--manuals-only] [--out DIR]

Writes, under Labmate_documents/Labmate_documents/r/:
  EXP n <title>.docx                      the blank lab manual a student receives
  completed/EXP n <title> (RStudio).docx  the same experiment with the real source and output screenshots
and copies every screenshot to <out>/screenshots. Exits non-zero if any experiment fails its output checks.
"""
import argparse
import asyncio
import os
import re
import shutil
import sys
from pathlib import Path

os.environ.setdefault('EXECUTION_ISOLATION', 'development')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import docx
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, RGBColor

from app.services.docx_layout import embed_screenshot, save_document_atomic
from scripts.r_manual_cases import CASES

REPO = Path(__file__).resolve().parents[2]
MANUAL_DIR = REPO / 'Labmate_documents' / 'Labmate_documents' / 'r'
COURSE = 'Statistical Computing with R Laboratory'


def safe(text):
    return re.sub(r'[^A-Za-z0-9 ]+', '', text).strip()


def manual_name(case, suffix=''):
    return f"EXP {case['number']} {safe(case['title'])} in R{suffix}.docx"


def heading(document, text, size=13, color=(0, 51, 102)):
    paragraph = document.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(10)
    paragraph.paragraph_format.keep_with_next = True
    run = paragraph.add_run(text)
    run.bold = True
    run.font.size = Pt(size)
    run.font.color.rgb = RGBColor(*color)
    return paragraph


def code_block(document, code):
    paragraph = document.add_paragraph()
    for line in code.rstrip().splitlines():
        run = paragraph.add_run(line + '\n')
        run.font.name = 'Consolas'
        run.font.size = Pt(9)


def manual_document(case):
    document = docx.Document()
    title = document.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run(f"{COURSE}\n")
    run.bold = True
    run.font.size = Pt(15)
    run = title.add_run(f"Experiment {case['number']}: {case['title']}")
    run.bold = True
    run.font.size = Pt(13)
    heading(document, 'Aim')
    document.add_paragraph(case['aim'])
    heading(document, 'Software Required')
    document.add_paragraph('R (4.x) and RStudio. Packages: ' + (', '.join(case.get('packages', [])) or 'base R only') + '.')
    heading(document, 'Theory')
    document.add_paragraph(case['theory'])
    heading(document, 'Procedure')
    for number, step in enumerate(case['procedure'], 1):
        document.add_paragraph(f'{number}. {step}')
    heading(document, 'Program')
    document.add_paragraph(case['task'])
    heading(document, 'Output')
    document.add_paragraph('Paste the screenshot of the RStudio source editor, console, Environment and Plots panes here.')
    heading(document, 'Result')
    document.add_paragraph('The program was executed in RStudio and the output was verified.')
    return document


def completed_document(case, verification):
    document = manual_document(case)
    # Replace the placeholder paragraphs with evidence.
    body = document.paragraphs
    for paragraph in list(body):
        if paragraph.text.startswith('Paste the screenshot') or paragraph.text == case['task']:
            paragraph._element.getparent().remove(paragraph._element)
    heading(document, 'Program (R script: %s)' % case['filename'])
    code_block(document, case['code'])
    frames = verification['evidence_frames']
    for frame in (f for f in frames if f['kind'] == 'source_preview'):
        embed_screenshot(document, frame['path'], caption=frame['caption'])
    heading(document, 'Output')
    for frame in (f for f in frames if f['kind'] == 'rstudio'):
        embed_screenshot(document, frame['path'], caption=frame['caption'])
    return document


async def run_case(engine, case, theme):
    result = await engine.execute(case['code'], 'r', case['filename'], objective=case['objective'],
                                  project_config={'rstudio_theme': theme})
    problems = []
    verification = result.verification or {}
    if not result.success:
        problems.append(f"execution failed: {result.error or verification.get('error')}")
    for pattern in case['expect']:
        if not re.search(pattern, result.output or ''):
            problems.append(f'console output is missing /{pattern}/')
    if verification.get('plots', 0) < case['plots']:
        problems.append(f"expected {case['plots']} plot(s), R drew {verification.get('plots', 0)}")
    frames = verification.get('evidence_frames', [])
    if not any(f['kind'] == 'source_preview' for f in frames) or not any(f['kind'] == 'rstudio' for f in frames):
        problems.append('missing source or result screenshots')
    views = sum('data viewer' in f['caption'] for f in frames)
    if views < case.get('views', 0):
        problems.append('expected the data viewer frame')
    return result, problems


async def main(args):
    from app.services.runtime_engine import RuntimeEngine
    selected = {int(n) for n in args.only.split(',')} if args.only else None
    cases = [c for c in CASES if selected is None or c['number'] in selected]
    MANUAL_DIR.mkdir(parents=True, exist_ok=True)
    for case in cases:
        save_document_atomic(manual_document(case), MANUAL_DIR / manual_name(case))
    print(f'Wrote {len(cases)} manual(s) to {MANUAL_DIR}')
    if args.manuals_only:
        return 0
    out = Path(args.out).resolve()
    (out / 'screenshots').mkdir(parents=True, exist_ok=True)
    (MANUAL_DIR / 'completed').mkdir(exist_ok=True)
    engine = RuntimeEngine()
    themes = ['light', 'dark'] if args.theme == 'both' else [args.theme]
    failures = 0
    for theme in themes:
        for case in cases:
            result, problems = await run_case(engine, case, theme)
            frames = (result.verification or {}).get('evidence_frames', [])
            status = 'PASS' if not problems else 'FAIL'
            failures += bool(problems)
            print(f"[{status}] {theme:5} exp{case['number']} {case['title']}: {len(frames)} frames, "
                  f"{(result.verification or {}).get('plots', 0)} plots, {(result.verification or {}).get('seconds')}s")
            for problem in problems:
                print('        - ' + problem)
            if frames:
                for index, frame in enumerate(frames, 1):
                    target = out / 'screenshots' / f"exp{case['number']}_{theme}_{index:02d}_{frame['kind']}.png"
                    shutil.copyfile(frame['path'], target)
            if not problems:
                suffix = ' (RStudio)' if theme == 'light' else ' (RStudio dark)'
                save_document_atomic(completed_document(case, result.verification), MANUAL_DIR / 'completed' / manual_name(case, suffix))
    print(f'{len(cases) * len(themes) - failures} passed, {failures} failed')
    return 1 if failures else 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--theme', choices=['light', 'dark', 'both'], default='light')
    parser.add_argument('--only', default='')
    parser.add_argument('--manuals-only', action='store_true')
    parser.add_argument('--out', default=str(REPO / 'test_screenshots' / 'r_verified_screenshots'))
    sys.exit(asyncio.run(main(parser.parse_args())))
