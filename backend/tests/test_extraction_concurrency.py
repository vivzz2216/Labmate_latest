"""Duplicate extraction requests use one durable job across independent API loops."""
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
import threading

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base, get_db
from app.middleware.auth import get_current_user
from app.middleware.csrf import require_csrf_token
from app.models import AssignmentWorkflow, Upload, User
from app.routers import workflows


@pytest.fixture
def extraction_app(tmp_path):
    engine = create_engine('sqlite:///' + str(tmp_path / 'extraction.db'),
        connect_args={'check_same_thread': False, 'timeout': 30})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        user = User(email='extraction@example.com', name='Extraction Student')
        db.add(user); db.flush()
        upload = Upload(user_id=user.id, filename='manual.docx', original_filename='manual.docx',
            file_path='unused', file_type='docx', file_size=1)
        db.add(upload); db.commit()
        user_id, upload_id = user.id, upload.id
    app = FastAPI()
    app.include_router(workflows.router, prefix='/api')
    def database():
        with factory() as db:
            try:
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=user_id)
    app.dependency_overrides[require_csrf_token] = lambda: True
    yield SimpleNamespace(app=app, engine=engine, factory=factory, upload_id=upload_id, user_id=user_id)
    engine.dispose()


@pytest.mark.parametrize('initial_status', [None, 'failed', 'paused'])
def test_ten_simultaneous_extractions_return_one_job(extraction_app, monkeypatch, initial_status):
    env = extraction_app
    # Force every request to read the same pre-enqueue state. This schedule
    # previously produced nine IntegrityErrors when the workflow did not exist.
    if initial_status:
        with env.factory() as db:
            db.add(AssignmentWorkflow(upload_id=env.upload_id, status=initial_status,
                stage='extract', claim_token='previous-owner', lease_expires_at=None))
            db.commit()
    else:
        # Duplicates must also succeed if the winning request filled the queue.
        monkeypatch.setattr(settings, 'WORKFLOW_QUEUE_LIMIT', 1)
    gate = threading.Barrier(10)
    aligned = threading.local()
    @event.listens_for(env.engine, 'after_cursor_execute')
    def align(conn, cursor, statement, parameters, context, executemany):
        sql = ' '.join(statement.lower().split())
        if (sql.startswith('select assignment_workflows.')
                and 'where assignment_workflows.upload_id = ?' in sql
                and not getattr(aligned, 'done', False)):
            aligned.done = True
            gate.wait(timeout=15)
    def submit(_):
        with TestClient(env.app, raise_server_exceptions=False) as client:
            response = client.post(f'/api/workflows/{env.upload_id}/extract')
            return response.status_code, response.json()
    try:
        with ThreadPoolExecutor(max_workers=10) as pool:
            responses = list(pool.map(submit, range(10)))
    finally:
        event.remove(env.engine, 'after_cursor_execute', align)
    assert all(status == 200 for status, _ in responses), responses
    assert len({data['id'] for _, data in responses}) == 1
    with env.factory() as db:
        assert db.query(AssignmentWorkflow).count() == 1
        workflow = db.query(AssignmentWorkflow).one()
        assert (workflow.status, workflow.stage) == ('queued', 'extract')
        assert workflow.claim_token != 'previous-owner'


@pytest.mark.parametrize('status', ['ready', 'completed'])
def test_delayed_duplicate_preserves_extracted_questions_and_results(extraction_app, status):
    env = extraction_app
    questions = [{'id': 1, 'text': 'Print 5', 'language': 'python'}]
    results = [{'id': 1, 'status': 'completed', 'output': '5'}]
    with env.factory() as db:
        db.add(AssignmentWorkflow(upload_id=env.upload_id, status=status, stage='review',
            mode='code_only', questions=questions, results=results, claim_token='worker-token'))
        db.commit()
    with TestClient(env.app) as client:
        response = client.post(f'/api/workflows/{env.upload_id}/extract')
    assert response.status_code == 200
    assert response.json()['questions'] == questions
    with env.factory() as db:
        workflow = db.query(AssignmentWorkflow).one()
        assert workflow.results == results and workflow.status == status
        assert workflow.claim_token == 'worker-token'


def test_explicit_mode_change_can_reextract_a_ready_workflow(extraction_app):
    env = extraction_app
    with env.factory() as db:
        db.add(AssignmentWorkflow(upload_id=env.upload_id, status='ready', stage='review', mode='code_only'))
        db.commit()
    with TestClient(env.app) as client:
        response = client.post(f'/api/workflows/{env.upload_id}/extract?mode=theory_and_code')
    assert response.status_code == 200
    assert response.json()['mode'] == 'theory_and_code'
    assert response.json()['status'] == 'queued'


def test_stale_retry_cannot_erase_a_newer_worker_result(extraction_app, monkeypatch):
    env = extraction_app
    saved = [{'id': 1, 'status': 'completed', 'output': '5'}]
    with env.factory() as db:
        db.add(AssignmentWorkflow(upload_id=env.upload_id, status='failed', stage='extract',
            claim_token='old-owner'))
        db.commit()
    original = workflows.check_queue_capacity
    def finish_newer_run(db, user_id, additional=1):
        original(db, user_id, additional)
        with env.factory() as peer:
            workflow = peer.query(AssignmentWorkflow).one()
            workflow.claim_token = 'new-owner'
            workflow.results = saved
            # The status has returned to the value the stale request read.
            workflow.status = 'failed'
            peer.commit()
    monkeypatch.setattr(workflows, 'check_queue_capacity', finish_newer_run)
    with TestClient(env.app) as client:
        response = client.post(f'/api/workflows/{env.upload_id}/extract')
    assert response.status_code == 200
    with env.factory() as db:
        workflow = db.query(AssignmentWorkflow).one()
        assert workflow.results == saved
        assert workflow.claim_token == 'new-owner' and workflow.status == 'failed'


def test_extraction_still_checks_upload_ownership(extraction_app):
    env = extraction_app
    env.app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=env.user_id + 1)
    with TestClient(env.app) as client:
        assert client.post(f'/api/workflows/{env.upload_id}/extract').status_code == 404


def test_ten_simultaneous_submissions_enforce_queue_capacity_limit(tmp_path, monkeypatch):
    engine = create_engine('sqlite:///' + str(tmp_path / 'queue_limit.db'),
        connect_args={'check_same_thread': False, 'timeout': 30})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        for i in range(10):
            u = User(email=f'q{i}@example.com', name='Concurrent Student')
            db.add(u); db.flush()
            db.add(Upload(user_id=u.id, filename=f'{i}.docx', original_filename='manual.docx',
                file_path='unused', file_type='docx', file_size=1))
        db.commit()
    gate = threading.Barrier(10)
    aligned = threading.local()
    @event.listens_for(engine, 'after_cursor_execute')
    def align(conn, cursor, statement, parameters, context, executemany):
        sql = ' '.join(statement.lower().split())
        if (sql.startswith('select count(') and 'from assignment_workflows' in sql
                and 'join uploads' not in sql and not getattr(aligned, 'done', False)):
            aligned.done = True
            gate.wait(timeout=15)
    monkeypatch.setattr(settings, 'WORKFLOW_QUEUE_LIMIT', 1)
    def contender(index):
        with factory() as db:
            try:
                user = db.get(User, index + 1)
                workflows.check_queue_capacity(db, user.id)
                db.add(AssignmentWorkflow(upload_id=index + 1, status='queued', stage='extract'))
                db.commit()
                return 200
            except workflows.HTTPException as exc:
                db.rollback()
                return exc.status_code
    try:
        with ThreadPoolExecutor(max_workers=10) as pool:
            statuses = list(pool.map(contender, range(10)))
    finally:
        event.remove(engine, 'after_cursor_execute', align)
    with factory() as db:
        count = db.query(AssignmentWorkflow).count()
    engine.dispose()
    assert count == 1
    assert statuses.count(200) == 1
    assert statuses.count(503) == 9
