"""Security and saved-work regressions reproduced during the platform audit."""
import pickle
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from docx import Document
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.middleware.auth import get_current_user
from app.models import AssignmentWorkflow, Upload, User
from app.security.file_preview import file_preview
from app.security.html_preview import PREVIEW_HEADERS


def test_pickle_preview_never_calls_object_constructor(tmp_path):
    marker = tmp_path / 'executed.txt'
    class Payload:
        def __reduce__(self):
            return (eval, (f"open({str(marker)!r}, 'w').write('executed')",))
    source = tmp_path / 'record.pkl'
    source.write_bytes(pickle.dumps(Payload()))
    assert 'deserialization is disabled' in file_preview(source)
    assert not marker.exists()
    source.write_bytes(pickle.dumps([{'roll': 7, 'marks': [82, 91]}]))
    assert '82' in file_preview(source)
    source.write_bytes(b'x' * 65537)
    assert 'exceeds' in file_preview(source)
    source.write_bytes(pickle.dumps([[['x'] * 100] * 100] * 100))
    assert 'deserialization is disabled' in file_preview(source)
    recursive = []; recursive.append(recursive)
    source.write_bytes(pickle.dumps(recursive))
    assert 'deserialization is disabled' in file_preview(source)


def test_uploaded_preview_blocks_scripts_forms_and_external_fetches():
    policy = PREVIEW_HEADERS['Content-Security-Policy']
    assert "sandbox;" in policy
    assert "default-src 'none'" in policy
    assert "form-action 'none'" in policy
    assert 'allow-scripts' not in policy and 'allow-same-origin' not in policy


def test_auth_payloads_are_bounded_below_document_upload_limit():
    from app.middleware.body_limit import RequestBodyLimitMiddleware
    app = FastAPI(); app.add_middleware(RequestBodyLimitMiddleware)
    @app.post('/api/basic-auth/refresh')
    async def handler():
        raise AssertionError('Oversized authentication payload must be rejected before parsing.')
    with TestClient(app) as client:
        assert client.post('/api/basic-auth/refresh', content=b'x' * 65537).status_code == 413


def test_workspace_preserves_pending_questions_answers_and_multifile_projects(tmp_path):
    from app.routers import assignments
    engine = create_engine('sqlite:///' + str(tmp_path / 'state.db'), connect_args={'check_same_thread': False})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        owner = User(email='owner-restore@example.test', name='Student')
        other = User(email='other-restore@example.test', name='Other')
        db.add_all([owner, other]); db.flush()
        owner_id, other_id = owner.id, other.id
        upload = Upload(user_id=owner_id, filename='manual.docx', original_filename='manual.docx',
                        file_path=str(tmp_path / 'manual.docx'), file_type='docx', file_size=1)
        db.add(upload); db.flush(); upload_id = upload.id
        db.add(AssignmentWorkflow(upload_id=upload_id, status='failed', stage='generate',
            questions=[{'id': 1, 'text': 'Build a page', 'language': 'html'}, {'id': 2, 'text': 'Explain inheritance', 'language': 'theory'}],
            results=[{'id': 1, 'question': 'Build a page', 'answer': 'Actual explanation', 'status': 'failed',
                      'error': 'Missing button', 'project_files': {'index.html': '<h1>Page</h1>', 'script.js': 'let n=1;'}}]))
        db.commit()
    app = FastAPI(); app.include_router(assignments.router, prefix='/api/assignments')
    def database():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=owner_id)
    with TestClient(app) as client:
        response = client.get(f'/api/assignments/{upload_id}/workspace')
        assert response.status_code == 200, response.text
        questions = response.json()['questions']
        assert len(questions) == 2
        assert questions[0]['question_text'] == 'Build a page'
        assert questions[0]['theory_answer'] == 'Actual explanation'
        assert questions[0]['error_message'] == 'Missing button'
        assert set(questions[0]['project_files']) == {'index.html', 'script.js'}
        assert questions[1]['question_text'] == 'Explain inheritance'
        assert questions[1]['status'] == 'pending'
        assert questions[1]['is_theory'] is True
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=other_id)
        assert client.get(f'/api/assignments/{upload_id}/workspace').status_code == 404
    engine.dispose()


def test_logout_revokes_tokens_and_refresh_cannot_be_replayed(tmp_path, monkeypatch):
    import fakeredis
    from app import cache
    from app.middleware import csrf
    from app.routers import basic_auth
    from app.security.jwt import create_access_token, create_refresh_token
    redis = fakeredis.FakeRedis()
    monkeypatch.setattr(cache, 'redis_client', redis)
    monkeypatch.setattr(csrf, 'redis_client', redis)
    engine = create_engine('sqlite:///' + str(tmp_path / 'logout.db'), connect_args={'check_same_thread': False})
    Base.metadata.create_all(engine); factory = sessionmaker(bind=engine)
    with factory() as db:
        user = User(email='logout@example.test', name='Student', is_active=True)
        db.add(user); db.commit(); user_id = user.id
    app = FastAPI(); app.include_router(basic_auth.router, prefix='/api/basic-auth')
    def database():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = database
    claims = {'sub': str(user_id), 'email': 'logout@example.test'}
    refresh = create_refresh_token(claims)
    with TestClient(app) as client:
        rotated = client.post('/api/basic-auth/refresh', json={'refresh_token': refresh})
        assert rotated.status_code == 200, rotated.text
        assert client.post('/api/basic-auth/refresh', json={'refresh_token': refresh}).status_code == 401
        credentials = rotated.json()
        headers = {'Authorization': 'Bearer ' + credentials['access_token'], 'X-CSRF-Token': credentials['csrf_token']}
        assert client.get('/api/basic-auth/profile', headers=headers).status_code == 200
        assert client.post('/api/basic-auth/logout', json={'refresh_token': credentials['refresh_token']}, headers=headers).status_code == 200
        assert client.get('/api/basic-auth/profile', headers=headers).status_code == 401
        assert client.post('/api/basic-auth/refresh', json={'refresh_token': credentials['refresh_token']}).status_code == 401
    engine.dispose()


def test_compact_theory_report_has_answer_without_requiring_fake_screenshots(tmp_path, monkeypatch):
    from app.config import settings
    from app.services.compact_report import build_compact_report
    monkeypatch.setattr(settings, 'REPORT_DIR', str(tmp_path))
    workflow = SimpleNamespace(id=9, output_name='theory', student_name='Student', results=[
        {'id': 1, 'question': 'Explain encapsulation', 'language': 'theory', 'is_theory': True,
         'answer': 'Encapsulation groups state and operations.', 'status': 'completed'}])
    with patch('app.services.storage_service.storage_service.sync_file'):
        path, _ = build_compact_report(SimpleNamespace(), workflow)
    document = Document(path)
    assert 'Encapsulation groups state and operations.' in '\n'.join(p.text for p in document.paragraphs)
    assert not document.inline_shapes


@pytest.mark.asyncio
@pytest.mark.parametrize('body', [{'message': 2}, {'message': 'x' * 5001}, {'message': 'hello', 'rating': True}, {'message': 'hello', 'rating': 2.5}])
async def test_feedback_rejects_invalid_types_and_oversized_text(body):
    from fastapi import HTTPException
    from app.routers.feedback import submit_feedback
    with pytest.raises(HTTPException) as error:
        await submit_feedback(body, db=None, current_user=SimpleNamespace(id=1), csrf_valid=True)
    assert error.value.status_code == 400


def test_quoted_mysql_system_schemas_rejected_before_database_access():
    from app.services.sql_runtime import SQLSession
    session = object.__new__(SQLSession)
    session.allow_dcl = False
    session.server_version = 'test'
    session.physical_schema = 'private_test'
    session.db_user = 'private_user'
    session.active_schema = 'student'
    for source in ['SELECT * FROM `mysql`.user', 'SELECT * FROM `information_schema`/**/.tables', 'SELECT * FROM sys . version']:
        result = session.execute(source)
        assert result['success'] is False
        assert 'system schemas' in result['error'].lower()


def test_session_tokens_are_unique_revocable_and_fail_closed(monkeypatch):
    import fakeredis
    from fastapi import HTTPException
    from app import cache
    from app.security.jwt import create_access_token, create_refresh_token, verify_token, revoke_token
    monkeypatch.setattr(cache, 'redis_client', fakeredis.FakeRedis())
    token = create_refresh_token({'sub': '7'})
    assert token != create_refresh_token({'sub': '7'})
    payload = verify_token(token, 'refresh')
    revoke_token(token, payload, single_use=True)
    with pytest.raises(HTTPException) as error:
        verify_token(token, 'refresh')
    assert error.value.status_code == 401
    with pytest.raises(HTTPException):
        revoke_token(token, payload, single_use=True)
    access = create_access_token({'sub': '7'})
    assert verify_token(access)['sub'] == '7'
    monkeypatch.setattr(cache, 'redis_client', None)
    with pytest.raises(HTTPException) as error:
        verify_token(access)
    assert error.value.status_code == 503


def test_jwt_helper_accepts_legacy_hs256_wire_format_and_rejects_other_algorithms(monkeypatch):
    import base64, hashlib, hmac, json
    import fakeredis
    from fastapi import HTTPException
    from app import cache
    from app.config import settings
    from app.security.jwt import verify_token
    monkeypatch.setattr(cache, 'redis_client', fakeredis.FakeRedis())
    key = 'legacy-test-key-' + 'x' * 32
    monkeypatch.setattr(settings, 'SECRET_KEY', key)
    def encode(value):
        return base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).rstrip(b'=')
    body = encode({'sub':'7', 'type':'access', 'iat':1, 'exp':4070908800})
    header = encode({'alg':'HS256', 'typ':'JWT'})
    content = header + b'.' + body
    token = (content + b'.' + base64.urlsafe_b64encode(hmac.new(key.encode(), content, hashlib.sha256).digest()).rstrip(b'=')).decode()
    assert verify_token(token)['sub'] == '7'
    with pytest.raises(HTTPException) as error:
        verify_token((encode({'alg':'none'}) + b'.' + body + b'.').decode())
    assert error.value.status_code == 401


@pytest.mark.asyncio
async def test_profile_second_metadata_update_is_persisted(tmp_path):
    from app.models import UserProfile
    from app.routers.basic_auth import ProfileUpdateRequest, update_user_profile
    engine = create_engine('sqlite:///' + str(tmp_path / 'profile.db'))
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        user = User(email='profile-save@example.test', name='Original')
        db.add(user); db.commit(); user_id = user.id
        for roll in ['11', '12']:
            await update_user_profile(ProfileUpdateRequest(name='Student', profile_metadata={'roll_number': roll, 'year': '3'}), user, db, True)
    with factory() as db:
        profile = db.query(UserProfile).filter_by(user_id=user_id).one()
        assert profile.profile_metadata == {'roll_number': '12', 'year': '3'}
        assert db.get(User, user_id).name == 'Student'
    engine.dispose()
