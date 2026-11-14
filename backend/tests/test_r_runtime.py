import re

import pytest
from PIL import Image

from app.security.generated_code import validate_generated_code
from app.services import r_runtime
from app.services.evidence_planner import experiment_category, plan_experiment, select_evidence
from app.services.manual_sections import section_language

@pytest.fixture(autouse=True)
def _open_execution(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, 'EXECUTION_ALLOWED_EMAILS', 'r@example.com')


needs_r = pytest.mark.skipif(r_runtime.find_rscript() is None, reason='Rscript is not installed')


def check(code):
    validate_generated_code(code, 'r')


def test_validator_accepts_ordinary_lab_scripts():
    check('library(ggplot2)\nq <- quantile(c(1, 2, 3))\nurl <- "label"\nsource <- "x"  # system("ls")\n'
          'dplyr::filter(mtcars, mpg > 20)\ncat("km/h and a/b\\n")\nwrite.csv(mtcars, "out.csv")\nView(mtcars)\n')


@pytest.mark.parametrize('code', [
    'system("ls")', 'x <- Sys.getenv("HOME")', 'library(torch)', 'torch::tensor(1)', 'read.csv("/etc/passwd")',
    'read.csv("../secret.csv")', 'read.csv("C:\\\\Users\\\\a.csv")', 'read.csv("http://example.com/a.csv")',
    'do.call("system", list("ls"))', 'lapply(1, system)', 'eval(parse(text = "1"))', 'quit()', 'q()', 'setwd("a")',
    'source("a.R")', 'sink("a.txt")', 'install.packages("x")', 'Sys.setenv(A = "1")', 'Sys.info()',
    'dyn.load("a.so")', 'match.fun("system")', 'socketConnection("localhost", 80)',
])
def test_validator_rejects_host_network_and_session_access(code):
    with pytest.raises(ValueError):
        check(code)


def test_validator_message_names_the_problem():
    with pytest.raises(ValueError, match='torch'):
        check('library(torch)')


def test_r_is_a_first_class_language():
    assert experiment_category('r', 'Fit a model') == 'rstudio'
    assert experiment_category('rstudio', '') == 'rstudio'
    plan = plan_experiment('Draw a histogram in R', 'r', 'hist(mtcars$mpg)')
    assert plan['supported'] and plan['category'] == 'rstudio'
    assert plan['recommended_screenshots'] == ['source_preview', 'rstudio']


def test_manual_sections_route_r_titles_and_scripts():
    assert section_language('Experiment 4: Linear regression in R', 'Fit lm') == 'r'
    assert section_language('R Programming Lab', 'x') == 'r'
    assert section_language('Statistics with RStudio', 'x') == 'r'
    assert section_language('Experiment 2: Arrays', 'int a[3];') != 'r'
    assert section_language('Experiment 5: Loops', 'for i in range(3): print(i)') != 'r'
    assert section_language('Experiment 5', 'library(ggplot2)\nggplot(df)') == 'r'


def synthetic_receipt(lines=30, plots=1):
    return {'rShort': 'R 4.4.0', 'banner': [f'banner {i}' for i in range(16)],
            'lines': [{'k': 'cmd', 'prompt': '> ', 'text': f'x{i} <- {i}'} if i % 2 == 0 else {'k': 'out', 'text': f'[1] {i}'}
                      for i in range(lines)] + [{'k': 'prompt', 'text': ''}],
            'history': [], 'env': [{'name': 'x0', 'kind': 'values', 'value': '0'}], 'files': [], 'packages': [],
            'views': [], 'plot_uris': ['data:image/png;base64,iVBORw0KGgo='] * plots}


def test_frames_cover_every_source_line_once_and_are_balanced():
    code = '\n'.join(f'x{i} <- {i}' for i in range(33)) + '\n'
    frames = r_runtime.build_frames(synthetic_receipt(), code, 'a.R', 'light')
    ranges = [f['source_ranges'][0] for f in frames if f['kind'] == 'source_preview']
    assert ranges[0][0] == 1 and ranges[-1][1] == 33
    assert all(b[0] == a[1] + 1 for a, b in zip(ranges, ranges[1:]))
    sizes = [b - a + 1 for a, b in ranges]
    assert max(sizes) <= r_runtime.SOURCE_LINES and max(sizes) - min(sizes) <= 1


def test_console_output_is_split_into_balanced_frames_and_plots_get_their_own():
    receipt = synthetic_receipt(lines=50, plots=3)
    frames = r_runtime.build_frames(receipt, 'x <- 1\n', 'a.R', 'dark')
    results = [f for f in frames if f['kind'] == 'rstudio']
    consoles = [f['data']['console'] for f in results]
    assert len(results) == 3 + 2  # 51 console rows -> 3 balanced frames, plus plots 1 and 2 on their own
    rows = [len(c) for c in consoles[:3]]
    assert sum(rows) == 51 and max(rows) <= r_runtime.CONSOLE_LINES and max(rows) - min(rows) <= 1
    assert all(f['data']['theme'] == 'dark' for f in frames)
    assert results[0]['data']['rightTab'] == 'plots' and results[0]['data']['plotCount'] == 3


def test_oversized_output_is_truncated_visibly_not_silently():
    receipt = synthetic_receipt(lines=r_runtime.MAX_CONSOLE_FRAMES * r_runtime.CONSOLE_LINES + 40, plots=0)
    frames = r_runtime.build_frames(receipt, 'x <- 1\n', 'a.R', 'light')
    results = [f for f in frames if f['kind'] == 'rstudio']
    assert len(results) == r_runtime.MAX_CONSOLE_FRAMES
    assert any('output truncated' in line['text'] for line in results[-1]['data']['console'])


def test_rstudio_workspace_renders_both_themes(tmp_path):
    from app.services.browser_capture import CaptureBrowserUnavailable
    receipt = synthetic_receipt(lines=6, plots=0)
    for theme in ('light', 'dark'):
        frames = r_runtime.build_frames(receipt, 'x0 <- 0\nx2 <- 2\n', 'a.R', theme)
        try:
            rendered = r_runtime.render_frames(frames, tmp_path, 'ui_' + theme)
        except CaptureBrowserUnavailable as error:
            pytest.skip(str(error))
        assert [f['kind'] for f in rendered] == ['source_preview', 'rstudio']
        with Image.open(rendered[1]['path']) as image:
            assert image.size == (2160, 1440)
            background = image.convert('RGB').getpixel((700, 1100))
        assert (background[0] < 80) == (theme == 'dark')


@needs_r
@pytest.mark.asyncio
async def test_real_r_runs_script_like_the_console_and_captures_the_workspace():
    from app.services.runtime_engine import RuntimeEngine
    code = ('# demo\nx <- c(2, 4, 6)\nmean(x)\ncat("n =", length(x), "\\n")\nsq <- function(v) v^2\n'
            'y <- log(-1)\nhist(x)\nmessage("note")\nmin(x); max(x)\n')
    result = await RuntimeEngine().execute(code, 'r', 'demo.R', objective='Summarise a vector in R')
    assert result.success, result.error
    assert 'n = 3' in result.output and '[1] 4' in result.output and 'Warning message:' in result.output
    assert re.search(r'\[1\] 2\s*\n\[1\] 6', result.output)
    verification = result.verification
    assert verification['kind'] == 'rstudio' and verification['status'] == 'passed' and verification['plots'] == 1
    kinds = [f['kind'] for f in verification['evidence_frames']]
    assert kinds[0] == 'source_preview' and 'rstudio' in kinds
    assert verification['engine'].startswith('R version')
    for frame in verification['evidence_frames']:
        with Image.open(frame['path']) as image:
            assert image.width == 2160 and image.height == 1440


@needs_r
@pytest.mark.asyncio
async def test_real_r_error_fails_without_inventing_evidence_of_success():
    from app.services.runtime_engine import RuntimeEngine
    result = await RuntimeEngine().execute('x <- 1\nstop("boom")\ny <- 2\n', 'r', 'bad.R')
    assert not result.success
    assert 'Error: boom' in result.error
    assert result.verification['status'] == 'failed'
    assert 'y <- 2' not in (result.output or '')


@needs_r
@pytest.mark.asyncio
async def test_real_r_environment_shows_only_student_variables():
    from app.services.runtime_engine import RuntimeEngine
    result = await RuntimeEngine().execute('a <- 1\nb <- "t"\nf <- function(z) z\ndf <- data.frame(p = 1:3)\n', 'r', 'env.R')
    assert result.success, result.error
    assert result.verification['evidence_frames']
    receipt = await r_runtime.run_r_script('a <- 1\nb <- "t"\nf <- function(z) z\ndf <- data.frame(p = 1:3)\n', 'env.R')
    names = {e['name']: e for e in receipt['env']}
    assert set(names) == {'a', 'b', 'f', 'df'}
    assert names['df']['kind'] == 'data' and names['df']['value'] == '3 obs. of  1 variable'
    assert names['f']['kind'] == 'functions' and names['b']['value'] == '"t"'


@needs_r
@pytest.mark.asyncio
async def test_real_r_blocks_forbidden_code_before_running_it():
    from app.services.runtime_engine import RuntimeEngine
    result = await RuntimeEngine().execute('system("echo hi")\n', 'r', 'evil.R')
    assert not result.success and 'system' in result.error
    assert not result.verification['evidence_frames']


@needs_r
@pytest.mark.asyncio
async def test_real_r_evidence_passes_the_report_evidence_selection():
    from app.services.runtime_engine import RuntimeEngine
    code = 'x <- c(1, 2, 3)\nsummary(x)\nplot(x)\n'
    result = await RuntimeEngine().execute(code, 'r', 'sel.R', objective='Summarise and plot x in R')
    assert result.success, result.error
    plan = plan_experiment('Summarise and plot x in R', 'r', code)
    plan['required_source_files'] = ['sel.R']
    plan['complete_source_lines'] = {'sel.R': 3}
    selection = select_evidence(plan, result.verification['evidence_frames'])
    assert not selection['missing_requirements'], selection
    assert not selection['invalid']


@needs_r
@pytest.mark.asyncio
async def test_full_workflow_turns_an_r_manual_question_into_a_word_report_with_rstudio_evidence(tmp_path):
    """Question -> (stubbed model) R script -> real Rscript -> RStudio frames -> evidence gate -> Word report."""
    from pathlib import Path
    from unittest.mock import AsyncMock, patch

    from docx import Document
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.database import Base
    from app.models import AssignmentWorkflow, Report, Upload, User
    from app.services.assignment_workflow import process_assignment
    from app.models import UserProfile
    from scripts.r_manual_cases import CASES

    case = CASES[4]  # Experiment 5: regression, with console tables and a plot
    source = tmp_path / 'manual.docx'
    manual = Document()
    manual.add_paragraph('Statistical Computing with R Laboratory - Experiment 5: ' + case['title'])
    manual.add_paragraph('Aim: ' + case['aim'])
    manual.add_paragraph(case['task'])
    manual.save(source)
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        user = User(email='r@example.com', name='R Student', profile=UserProfile(
            institution='Test College', course='Computer Science',
            profile_metadata={'roll_number': '21CS001', 'year': '3', 'graduation_year': '2027'}))
        db.add(user)
        db.flush()
        upload = Upload(user_id=user.id, filename='manual.docx', original_filename='EXP 5 Regression in R.docx',
                        file_path=str(source), file_type='docx', file_size=source.stat().st_size)
        db.add(upload)
        db.flush()
        workflow = AssignmentWorkflow(upload_id=upload.id, status='processing', stage='generate', language='r',
                                      questions=[{'id': 1, 'text': case['task'], 'language': 'r', 'rstudio_theme': 'dark'}],
                                      results=[], output_name='r_regression')
        db.add(workflow)
        db.commit()
        workflow_id = workflow.id
    generate = AsyncMock(return_value={'answer': 'Fitted simple and multiple regression models.', 'code': case['code'],
                                       'language': 'r', 'stdin': '', 'browser_tests': []})
    with patch('app.services.assignment_workflow.SessionLocal', factory), \
         patch('app.services.assignment_workflow.generation_service.generate_json', generate), \
         patch('app.services.assignment_workflow.settings.REPORT_DIR', str(tmp_path / 'reports')), \
         patch('app.services.assignment_workflow.settings.SCREENSHOT_DIR', str(tmp_path / 'screenshots')), \
         patch('app.services.assignment_workflow.settings.REACT_TEMP_DIR', str(tmp_path / 'runtime')), \
         patch('app.services.r_runtime.settings.SCREENSHOT_DIR', str(tmp_path / 'screenshots')), \
         patch('app.services.r_runtime.settings.REACT_TEMP_DIR', str(tmp_path / 'runtime')):
        await process_assignment(workflow_id)
    with factory() as db:
        workflow = db.get(AssignmentWorkflow, workflow_id)
        assert workflow.results, (workflow.status, workflow.stage, workflow.error, workflow.progress)
        result = workflow.results[0]
        assert result['status'] == 'completed', result.get('error')
        assert result['language'] == 'r' and 'Multiple R-squared:  0.8268' in result['output']
        assert result['verification']['kind'] == 'rstudio' and result['verification']['theme'] == 'dark'
        assert len(result['screenshot_paths']) >= 4
        report = db.get(Report, workflow.report_id)
        document = Document(report.file_path)
        assert len(document.inline_shapes) >= len(result['screenshot_paths'])
    assert 'RStudio' in generate.call_args.args[0] or 'R RUNTIME' in generate.call_args.args[0]
    engine.dispose()
