import os
import re
import shutil
from pathlib import Path

import pytest

from app.routers.lab_catalog import LAB_CATALOG_DATA
from app.services.evidence_planner import plan_experiment, verification_summary
from app.services.lab_question_filter import filter_lab_tasks, is_handwritten_question
from app.services.sql_result_checks import practical_table_checks


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_handwritten_dataset_is_not_a_handwritten_submission():
    task = {'id': 1, 'language': 'colab', 'text': 'Implement a CNN to classify handwritten digits with Python.'}
    assert [item['text'] for item in filter_lab_tasks([task])] == [task['text']]
    assert is_handwritten_question('The answer must be handwritten on paper.')


@pytest.mark.parametrize('output', [
    'Total entries: 4 (expected 7)\nCHECK FAILED: safety violation detected!',
    'CHECK expected consistent value, actual=[MISS] -> FAIL',
    'FAIL: ordering violation detected',
])
def test_failed_execution_checks_never_become_verified(output):
    summary = verification_summary(plan_experiment('Simulate token ring', 'distributed'), True, output)
    assert summary['status'] == 'failed'
    assert summary['failures']


def test_generic_distributed_execution_is_not_labelled_independently_verified():
    summary = verification_summary(plan_experiment('Run distributed code', 'distributed'), True, 'Execution finished.')
    assert summary['status'] == 'execution_tested'


def test_colab_python_optimization_route_stays_notebook():
    objective = (
        'Implement and compare Batch Gradient Descent, Mini-Batch Gradient Descent, '
        'and Adam optimizer on a non-trivial dataset.'
    )
    assert plan_experiment(objective, 'python')['category'] == 'notebook'
    assert plan_experiment(objective, 'colab')['category'] == 'notebook'


def test_rollback_insert_does_not_invalidate_initial_table_evidence():
    def step(index, kind, sql, rows, snapshot):
        return {
            'index': index,
            'type': kind,
            'statement': sql,
            'success': True,
            'active_schema': 'lab',
            'tableName': 'items',
            'rows': rows,
            'schemas_snapshot': {'lab': {'tables': {'items': {'rows': snapshot}}}},
        }

    initial = [{'id': 1}, {'id': 2}]
    statements = [
        step(1, 'INSERT', 'INSERT INTO items VALUES (1),(2)', [], initial),
        step(2, 'SELECT', 'SELECT * FROM items', initial, initial),
        step(3, 'INSERT', 'INSERT INTO items VALUES (3)', [], initial + [{'id': 3}]),
        step(4, 'ROLLBACK', 'ROLLBACK', [], initial),
        step(5, 'SELECT', 'SELECT COUNT(*) FROM items', [{'count': 2}], initial),
    ]
    assert practical_table_checks(statements)[0]['passed']
    assert not practical_table_checks([statements[0], statements[2], statements[3], statements[4]])[0]['passed']


def test_long_notebook_error_is_split_into_readable_sections(monkeypatch, tmp_path):
    from app.services import colab_pipeline

    captured = []

    def fake_capture(cells, path, **kwargs):
        captured.append(cells[0])
        Path(path).write_bytes(b'test')
        return True, 1100, 500

    monkeypatch.setattr(colab_pipeline, 'render_and_capture_colab', fake_capture)
    trace = '\n'.join('line %d: ' % n + 'x' * 200 for n in range(40))
    frames, lines = colab_pipeline.capture_colab_evidence(
        [{'type': 'code', 'code': 'print(1)', 'error': trace}],
        tmp_path / 'test.png',
    )
    error_frames = [item['error'] for item in captured if 'error' in item]
    assert len(error_frames) > 1 and all(len(item.splitlines()) <= 18 for item in error_frames)
    assert ''.join(''.join(item.splitlines()) for item in error_frames) == ''.join(trace.splitlines())
    assert frames and lines == 1


@pytest.mark.asyncio
async def test_distributed_process_timeout_and_environment(monkeypatch, tmp_path):
    from app.config import settings
    from app.services.dc_runtime import execute_distributed_java

    java = os.environ.get('AUDIT_JAVA') or shutil.which('java') or (settings.JAVA_COMMAND if Path(settings.JAVA_COMMAND).is_file() else None)
    javac = os.environ.get('AUDIT_JAVAC') or shutil.which('javac') or (settings.JAVAC_COMMAND if Path(settings.JAVAC_COMMAND).is_file() else None)
    if not java or not javac:
        pytest.skip('JDK unavailable')
    monkeypatch.setattr(settings, 'JAVA_COMMAND', java)
    monkeypatch.setattr(settings, 'JAVAC_COMMAND', javac)
    monkeypatch.setattr(settings, 'EXECUTION_ISOLATION', 'development')
    monkeypatch.setenv('LABMATE_AUDIT_CANARY', 'not-a-secret')
    source = '''public class Main { public static void main(String[] args) throws Exception {
        Object value = System.class.getMethod("get"+"env", String.class).invoke(null,"LABMATE_AUDIT_CANARY");
        System.out.println(value == null ? "CLEAN" : "INHERITED");
    }}'''
    result = await execute_distributed_java(source, tmp_path, timeout=5)
    assert result.success and 'CLEAN' in result.output and 'INHERITED' not in result.output
    result = await execute_distributed_java(
        'public class Main { public static void main(String[] a) throws Exception { Thread.sleep(20000); }}',
        tmp_path,
        timeout=0.3,
    )
    assert not result.success and result.exit_code == 124
    psutil = pytest.importorskip('psutil')
    assert not any(
        str(tmp_path) in ' '.join(p.info['cmdline'] or [])
        for p in psutil.process_iter(['name', 'cmdline'])
        if 'java' in (p.info['name'] or '').lower()
    )


@pytest.mark.asyncio
async def test_jupyter_evidence_uses_selected_theme_and_real_receipt(monkeypatch, tmp_path):
    from app.services.lab_capture import capture_jupyter_evidence
    from app.services.screenshot_service import screenshot_service

    captures = []

    async def fake_capture(code, output, theme, group, user, filename, **kwargs):
        captures.append((code, output, theme, kwargs))
        path = tmp_path / f'{len(captures)}.png'
        path.write_bytes(b'png')
        return True, str(path), 1100, 600

    monkeypatch.setattr(screenshot_service, 'generate_screenshot', fake_capture)
    cells = [{
        'type': 'code',
        'code': 'print(7 * 7)',
        'stdout': '49',
        'plots': ['data:image/png;base64,aGVsbG8='],
    }]
    frames, count = await capture_jupyter_evidence(cells, tmp_path / 'out.png', 'answer.py', 'light')
    assert count == 1 and [f['kind'] for f in frames] == ['source_preview', 'notebook', 'notebook']
    assert all(item[2] == 'jupyter' and item[3]['palette'] == 'light' for item in captures)
    assert captures[1][1] == '49' and captures[2][3]['jupyter_plot'].startswith('data:image/png;base64,')


@pytest.mark.asyncio
async def test_notebook_capture_error_keeps_original_failure(monkeypatch):
    from app.services import colab_pipeline, lab_capture

    class Kernel:
        def __init__(self, **kwargs):
            pass

        def execute_cell(self, code):
            return {'type': 'code', 'code': code, 'error': 'Original execution failed'}

        def cleanup(self):
            pass

    monkeypatch.setattr(lab_capture, 'ColabPythonKernel', Kernel)
    monkeypatch.setattr(
        colab_pipeline,
        'capture_colab_evidence',
        lambda **kwargs: (_ for _ in ()).throw(ValueError('too tall')),
    )
    monkeypatch.setattr('app.services.isolated_runtime.isolation_required', lambda: False)
    result = await lab_capture.capture_notebook('print(1)')
    assert not result.success and 'Original execution failed' in result.error and 'too tall' in result.error


def test_colab_save_does_not_claim_saved_without_persistence():
    js = (REPO_ROOT / 'google_colab' / 'app.js').read_text(encoding='utf-8')
    assert 'All changes saved' not in js
    assert 'Notebook saving is unavailable in this preview' in js


def test_catalog_counts_match_frontend_definitions():
    import json
    data = json.loads((REPO_ROOT / 'frontend/lib/lab-catalog.json').read_text(encoding='utf-8-sig'))
    assert {item['slug']: item['experiment_count'] for item in LAB_CATALOG_DATA} == {
        item['slug']: len(item['experiments']) for item in data}
    assert not any('powerbi' in str(item).lower() or 'power bi' in str(item).lower() for item in data)
