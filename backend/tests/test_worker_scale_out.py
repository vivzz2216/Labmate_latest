"""Support for running workflow workers as a separate service with no shared volume."""
import json
from pathlib import Path
from types import SimpleNamespace

from docx import Document
import pytest

from app.config import Settings
from app.database import effective_pool_size
from app.services import assignment_workflow as flow
from app.services.storage_service import storage_service


@pytest.mark.parametrize('configured,workers,expected', [(5, 0, 5), (5, 2, 5), (5, 25, 28), (40, 25, 40)])
def test_pool_is_never_smaller_than_the_workers_it_serves(configured, workers, expected):
    assert effective_pool_size(configured, workers) == expected


def make_manual(path: Path):
    document = Document()
    document.add_paragraph('1. Write a program that prints hello.')
    document.save(path)


def test_document_text_fetches_the_upload_when_it_is_not_on_this_disk(tmp_path, monkeypatch):
    remote = tmp_path / 'remote' / 'manual.docx'
    remote.parent.mkdir()
    make_manual(remote)
    missing = str(tmp_path / 'worker-disk' / 'uploads' / 'manual.docx')
    requested = []

    def fake_ensure_local(path):
        requested.append(str(path))
        return remote

    monkeypatch.setattr(storage_service, 'ensure_local', fake_ensure_local)
    text = flow.document_text(SimpleNamespace(file_path=missing, file_type='docx'))
    assert 'prints hello' in text
    assert requested == [missing]


def test_local_files_are_used_without_any_storage_call(tmp_path, monkeypatch):
    monkeypatch.setattr(type(storage_service), 'is_s3_enabled', property(lambda self: True))
    monkeypatch.setattr(storage_service, '_get_client', lambda: pytest.fail('must not contact object storage'))
    manual = tmp_path / 'manual.docx'
    make_manual(manual)
    assert flow.local_upload_path(str(manual)) == str(manual)
    assert 'prints hello' in flow.document_text(SimpleNamespace(file_path=str(manual), file_type='docx'))


def test_missing_upload_without_object_storage_still_fails_clearly(tmp_path, monkeypatch):
    monkeypatch.setattr(type(storage_service), 'is_s3_enabled', property(lambda self: False))
    with pytest.raises(FileNotFoundError):
        flow.local_upload_path(str(tmp_path / 'gone.docx'))


def test_report_builder_resolves_the_manual_once_for_every_report_type(tmp_path, monkeypatch):
    remote = tmp_path / 'remote.docx'
    make_manual(remote)
    seen = []
    monkeypatch.setattr(flow, 'local_upload_path', lambda path: seen.append(path) or str(remote))
    import app.services.compact_report as compact
    captured = {}

    def fake_compact(upload, workflow):
        captured['path'] = upload.file_path
        return 'report.docx', 'report.docx'

    monkeypatch.setattr(compact, 'build_compact_report', fake_compact)
    workflow = SimpleNamespace(id=1, mode='code_only', output_name='x',
                               results=[{'language': 'python', 'is_theory': False}])
    upload = SimpleNamespace(file_path='/data/uploads/manual.docx', file_type='docx', original_filename='manual.docx')
    flow.build_word_report(upload, workflow)
    assert seen == ['/data/uploads/manual.docx']
    assert captured['path'] == str(remote)
    assert upload.file_path == '/data/uploads/manual.docx'  # the caller's object is not mutated


def test_ssh_transport_with_a_raised_limit_warns(capsys):
    Settings(EXECUTION_BACKEND='ssh', EXECUTION_ISOLATION='required', HEAVY_EXECUTION_LOCAL_LIMIT=25)
    assert 'one job at a time' in capsys.readouterr().out
    Settings(EXECUTION_BACKEND='railway_sandbox', EXECUTION_ISOLATION='required', HEAVY_EXECUTION_LOCAL_LIMIT=25)
    assert 'one job at a time' not in capsys.readouterr().out


def test_worker_service_config_has_no_volume_and_no_http_healthcheck():
    config = json.loads((Path(__file__).parents[1] / 'railway.worker.json').read_text(encoding='utf-8'))
    deploy = config['deploy']
    assert 'requiredMountPath' not in deploy and 'healthcheckPath' not in deploy
    assert deploy['numReplicas'] >= 1 and deploy['sleepApplication'] is False


def test_start_script_selects_the_worker_role_after_dropping_privileges():
    script = (Path(__file__).parents[1] / 'start.sh').read_text(encoding='utf-8')
    assert script.index('gosu 10001:10001') < script.index('LABMATE_ROLE') < script.index('uvicorn app.main:app')
    assert 'python -m app.services.workflow_queue' in script
