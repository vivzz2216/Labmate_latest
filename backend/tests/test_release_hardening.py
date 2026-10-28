"""Regression tests for lockout, event-loop responsiveness, rate limiting and isolation gates."""
import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import time

import bcrypt
import fakeredis
from fastapi import FastAPI, HTTPException
import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import User
from app.routers import basic_auth
from app.middleware import rate_limit, csrf


@pytest.mark.parametrize('aware', [False, True])
@pytest.mark.parametrize('minutes,locked', [(2, True), (-2, False)])
def test_lockout_handles_both_database_timestamp_formats(aware, minutes, locked):
    date = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    if not aware: date = date.replace(tzinfo=None)
    assert basic_auth.check_account_lockout(SimpleNamespace(locked_until=date)) is locked
    assert basic_auth.check_account_lockout(SimpleNamespace(locked_until=None)) is False


@pytest.fixture
def sessions(tmp_path):
    engine = create_engine('sqlite:///' + str(tmp_path / 'auth.sqlite'))
    User.__table__.create(engine)
    maker = sessionmaker(bind=engine)
    with maker() as db:
        db.add(User(id=1, email='login@example.com', name='Login test', is_active=True,
                    password_hash=bcrypt.hashpw(b'good-password', bcrypt.gensalt(rounds=12)).decode(),
                    failed_login_attempts=0))
        db.commit()
    yield maker
    engine.dispose()


def test_failed_attempts_are_atomic_with_stale_sessions_and_expire(sessions):
    with sessions() as first, sessions() as second:
        a, b = first.get(User, 1), second.get(User, 1)
        basic_auth.handle_failed_login(first, a)
        basic_auth.handle_failed_login(second, b)
    with sessions() as db:
        user = db.get(User, 1)
        assert user.failed_login_attempts == 2
        user.failed_login_attempts = 5
        user.locked_until = datetime.utcnow() - timedelta(minutes=1)
        db.commit()
        basic_auth.handle_failed_login(db, user)
        db.refresh(user)
        assert user.failed_login_attempts == 1
        assert not basic_auth.check_account_lockout(user)


@pytest.mark.asyncio
async def test_login_hashing_does_not_block_event_loop(sessions, monkeypatch):
    monkeypatch.setattr(basic_auth, 'store_csrf_token', lambda *a: True)
    delays = []
    running = True
    async def heartbeat():
        while running:
            start = time.perf_counter()
            await asyncio.sleep(.01)
            delays.append(time.perf_counter() - start - .01)
    monitor = asyncio.create_task(heartbeat())
    async def attempt():
        with sessions() as db:
            with pytest.raises(HTTPException) as error:
                await basic_auth.login(basic_auth.UserLogin(email='login@example.com', password='wrong-password'), db)
            assert error.value.status_code == 401
    try:
        await asyncio.gather(*(attempt() for _ in range(3)))
        with sessions() as db:
            response = await basic_auth.login(basic_auth.UserLogin(email='login@example.com', password='good-password'), db)
            assert response.access_token and response.csrf_token
            db.refresh(db.get(User, 1))
            assert db.get(User, 1).failed_login_attempts == 0
    finally:
        running = False
        await monitor
    assert len(delays) >= 3
    assert max(delays) < .2, f'Event loop stalled for {max(delays):.3f}s'


@pytest.mark.asyncio
async def test_session_storage_failure_is_retryable_not_false_success(monkeypatch):
    monkeypatch.setattr(basic_auth, 'store_csrf_token', lambda *a: False)
    with pytest.raises(HTTPException) as error:
        await basic_auth.persist_csrf('token', 1)
    assert error.value.status_code == 503


@pytest.mark.asyncio
async def test_atomic_rate_limit_and_separate_auth_bucket(monkeypatch):
    redis = fakeredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(rate_limit, 'redis_client', redis)
    monkeypatch.setattr(settings, 'RATE_LIMIT_ENABLED', True)
    monkeypatch.setattr(settings, 'AUTH_RATE_LIMIT_PER_MINUTE', 8)
    app = FastAPI()
    app.add_middleware(rate_limit.RateLimitMiddleware, requests_per_minute=5)
    @app.api_route('/{path:path}', methods=['GET', 'POST'])
    def ok(path): return {'ok': True}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        responses = await asyncio.gather(*(client.post('/api/basic-auth/login') for _ in range(20)))
        assert sum(r.status_code == 200 for r in responses) == 8
        assert sum(r.status_code == 429 for r in responses) == 12
        assert 0 < redis.ttl('rate_limit:auth:127.0.0.1') <= 60
        assert (await client.get('/api/assignments')).status_code == 200
        for _ in range(10): assert (await client.get('/health/ready')).status_code == 200


@pytest.mark.asyncio
async def test_proxy_identity_requires_secret(monkeypatch):
    redis = fakeredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(rate_limit, 'redis_client', redis)
    monkeypatch.setattr(settings, 'RATE_LIMIT_ENABLED', True)
    monkeypatch.setattr(settings, 'TRUSTED_PROXY_KEY', 'test-proxy-secret')
    app = FastAPI()
    app.add_middleware(rate_limit.RateLimitMiddleware, requests_per_minute=1)
    @app.get('/')
    def ok(): return {}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        assert (await client.get('/', headers={'x-labmate-client-ip': '192.0.2.1'})).status_code == 200
        assert (await client.get('/', headers={'x-labmate-client-ip': '192.0.2.2'})).status_code == 429
        for ip in ['192.0.2.1', '192.0.2.2']:
            assert (await client.get('/', headers={'x-labmate-client-ip': ip, 'x-labmate-proxy-key': 'test-proxy-secret'})).status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize('language', ['python', 'java', 'c', 'cpp', 'html', 'react', 'node', 'colab'])
async def test_every_code_runtime_fails_closed_without_worker(monkeypatch, language):
    from app.services.runtime_engine import runtime_engine, run_process
    monkeypatch.setattr(settings, 'EXECUTION_ISOLATION', 'required')
    monkeypatch.setattr(settings, 'SANDBOX_SSH_HOST', '')
    result = await runtime_engine.execute('print(1)', language)
    assert not result.success and result.stages['isolation'] == 'failed'
    with pytest.raises(RuntimeError, match='Host code execution is disabled'):
        await run_process(['never-launched'], '.')


@pytest.mark.asyncio
async def test_unsupported_language_is_rejected_before_dispatch(monkeypatch):
    from unittest.mock import AsyncMock
    from app.services import isolated_runtime
    from app.services.runtime_engine import runtime_engine
    monkeypatch.setattr(settings, 'EXECUTION_ISOLATION', 'required')
    worker = AsyncMock()
    monkeypatch.setattr(isolated_runtime, 'execute_isolated', worker)
    result = await runtime_engine.execute('anything', 'rust')
    assert not result.success and result.exit_code == 2
    worker.assert_not_awaited()


def test_colab_kernel_cannot_bypass_isolation_gate(monkeypatch):
    from app.services.notebook_runtime import ColabPythonKernel
    monkeypatch.setattr(settings, 'EXECUTION_ISOLATION', 'required')
    with pytest.raises(RuntimeError, match='Host code execution is disabled'):
        ColabPythonKernel()


def test_docx_expansion_and_duplicate_entries_are_rejected(tmp_path):
    from zipfile import ZipFile, ZIP_DEFLATED
    from app.security.docx_archive import validate_docx_archive
    file = tmp_path / 'test.docx'
    with ZipFile(file, 'w', compression=ZIP_DEFLATED) as archive:
        archive.writestr('[Content_Types].xml', '<Types/>')
        archive.writestr('word/document.xml', 'x' * 4096)
    validate_docx_archive(file)
    with pytest.raises(ValueError, match='decompression'):
        validate_docx_archive(file, max_bytes=1024)
    with ZipFile(file, 'a') as archive:
        archive.writestr('word/document.xml', 'duplicate')
    with pytest.raises(ValueError, match='duplicate'):
        validate_docx_archive(file)


@pytest.mark.asyncio
async def test_body_limit_rejects_declared_and_chunked_overflow(monkeypatch):
    from fastapi import Request
    from app.middleware.body_limit import RequestBodyLimitMiddleware
    monkeypatch.setattr(settings, 'MAX_FILE_SIZE', 1)
    app = FastAPI()
    app.add_middleware(RequestBodyLimitMiddleware)
    @app.post('/upload')
    async def upload(request: Request):
        await request.body()
        return {'ok': True}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        assert (await client.post('/upload', content=b'ok')).status_code == 200
        assert (await client.post('/upload', content=b'x' * (1024**2 + 2))).status_code == 413
        async def chunks():
            yield b'x' * (1024**2)
            yield b'xx'
        assert (await client.post('/upload', content=chunks())).status_code == 413


@pytest.mark.asyncio
async def test_upload_parser_admission_is_bounded():
    from app.middleware.body_limit import RequestBodyLimitMiddleware
    entered = asyncio.Event()
    release = asyncio.Event()
    count = 0
    app = FastAPI()
    app.add_middleware(RequestBodyLimitMiddleware)
    @app.post('/upload')
    async def upload():
        nonlocal count
        count += 1
        if count == 4: entered.set()
        await release.wait()
        return {}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        pending = [asyncio.create_task(client.post('/upload')) for _ in range(4)]
        try:
            await asyncio.wait_for(entered.wait(), 2)
            assert (await client.post('/upload')).status_code == 429
        finally:
            release.set()
            assert all(r.status_code == 200 for r in await asyncio.gather(*pending))


def test_isolated_evidence_is_validated_and_paths_remapped(monkeypatch, tmp_path):
    import base64
    import io
    from pathlib import Path
    from PIL import Image
    from app.services.isolated_runtime import import_receipt
    monkeypatch.setattr(settings, 'SCREENSHOT_DIR', str(tmp_path))
    data = io.BytesIO()
    Image.new('RGB', (320, 160), 'white').save(data, 'PNG')
    receipt = {'success': True, 'screenshots': {'page': '/work/screenshots/a.png'},
               'verification': {'evidence_frames': [{'path': '/work/screenshots/a.png'}]},
               'frames': [{'path': '/work/screenshots/a.png', 'data': base64.b64encode(data.getvalue()).decode()}]}
    result = import_receipt(receipt)
    saved = result.screenshots['page']
    assert Path(saved).parent == tmp_path and Path(saved).is_file()
    assert result.verification['evidence_frames'][0]['path'] == saved
    with pytest.raises(ValueError, match='unvalidated screenshot'):
        import_receipt({'success': True, 'screenshots': {'page': '/arbitrary/host/path'}})
    with pytest.raises(ValueError, match='Invalid isolated screenshot'):
        import_receipt({'success': True, 'frames': [{'path': '/x', 'data': base64.b64encode(b'not PNG').decode()}]})


@pytest.mark.asyncio
async def test_worker_timeout_has_diagnostic_and_cleans_up_ssh(monkeypatch):
    from unittest.mock import AsyncMock, Mock
    from app.services import isolated_runtime
    process = SimpleNamespace(returncode=None, stdin=SimpleNamespace(write=Mock(), drain=AsyncMock(), close=Mock()),
        stdout=SimpleNamespace(read=AsyncMock(side_effect=TimeoutError)),
        stderr=SimpleNamespace(read=AsyncMock(side_effect=TimeoutError)), kill=Mock(), wait=AsyncMock())
    monkeypatch.setattr(isolated_runtime, 'worker_command', lambda: ['mock-worker'])
    monkeypatch.setattr(asyncio, 'create_subprocess_exec', AsyncMock(return_value=process))
    result = await isolated_runtime.execute_isolated(code='print(5)', language='python')
    assert not result.success and '240-second' in result.error
    assert result.stages['execution'] == 'failed'
    process.kill.assert_called_once()


@pytest.mark.asyncio
async def test_concurrent_logins_release_single_connection_before_hashing(tmp_path, monkeypatch):
    import threading
    from sqlalchemy.pool import QueuePool
    engine = create_engine('sqlite:///' + str(tmp_path / 'single-pool.sqlite'), poolclass=QueuePool,
        pool_size=1, max_overflow=0, pool_timeout=.25, connect_args={'check_same_thread':False})
    User.__table__.create(engine)
    maker = sessionmaker(bind=engine)
    with maker() as db:
        db.add(User(id=1,email='pool@example.com',name='Pool test',is_active=True,password_hash='test-hash'))
        db.commit()
    barrier = threading.Barrier(4, timeout=3)
    def check(*args):
        barrier.wait()
        return True
    monkeypatch.setattr(basic_auth, 'verify_password', check)
    monkeypatch.setattr(basic_auth, 'store_csrf_token', lambda *a: True)
    async def attempt():
        with maker() as db:
            return await basic_auth.login(basic_auth.UserLogin(email='pool@example.com',password='password'), db)
    try:
        results = await asyncio.wait_for(asyncio.gather(*(attempt() for _ in range(4))), 5)
        assert len(results) == 4 and all(r.access_token for r in results)
        assert engine.pool.checkedout() == 0
    finally: engine.dispose()


def test_worker_bundle_excludes_generated_reports_and_private_files(tmp_path):
    import shutil
    import subprocess
    import sys
    import tarfile
    from pathlib import Path
    original = Path(__file__).resolve().parents[1]
    repo = tmp_path / 'repo'
    (repo / 'backend/scripts').mkdir(parents=True)
    (repo / 'backend/app').mkdir()
    for name in ('package_sandbox.py', 'sandbox_job.py', 'sandbox_broker.py', 'provision_sandbox.sh'):
        shutil.copy2(original / 'scripts' / name, repo / 'backend/scripts' / name)
    (repo / 'backend/requirements.txt').write_text('')
    (repo / 'backend/app/__init__.py').write_text('')
    (repo / 'backend/app/.env').write_text('private')
    for lab in ('google_colab', 'sql_workbench'):
        base = repo / lab
        for folder in ('assets', 'screenshots', 'reports'): (base / folder).mkdir(parents=True)
        for name in ('index.html', 'app.js', 'style.css'): (base / name).write_text('static')
        (base / 'assets/logo.svg').write_text('<svg/>')
        (base / 'assets/private.pdf').write_text('private')
        (base / 'screenshots/student.png').write_bytes(b'private')
        (base / 'reports/student.docx').write_bytes(b'private')
        (base / 'screenshot.png').write_bytes(b'private')
    subprocess.run([sys.executable, str(repo / 'backend/scripts/package_sandbox.py')], check=True, capture_output=True)
    with tarfile.open(repo / 'backend/audit_artifacts/isolated-runtime/runtime.tar.gz') as archive:
        names = archive.getnames()
        assert 'resources/google_colab/assets/logo.svg' in names
        assert 'resources/sql_workbench/index.html' in names
        assert not any('student' in name or 'private.pdf' in name or '/.env' in name or name.endswith('/screenshot.png') for name in names)


def test_worker_refuses_stale_reports_without_deleting_them(tmp_path, monkeypatch):
    import importlib.util
    import sys
    from pathlib import Path
    from unittest.mock import MagicMock
    # The broker targets Linux; stub its Linux-only resource module for this validation test on Windows.
    if sys.platform == 'win32': monkeypatch.setitem(sys.modules, 'resource', MagicMock())
    source = Path(__file__).resolve().parents[1] / 'scripts/sandbox_broker.py'
    spec = importlib.util.spec_from_file_location('test_sandbox_broker', source)
    broker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(broker)
    monkeypatch.setattr(broker, 'ROOT', tmp_path)
    for name in ('google_colab', 'sql_workbench'):
        (tmp_path / 'resources' / name / 'assets').mkdir(parents=True)
    broker.validate_resources()
    old_report = tmp_path / 'resources/google_colab/screenshots/student.docx'
    old_report.parent.mkdir()
    old_report.write_text('private')
    with pytest.raises(ValueError, match='unintended files'):
        broker.validate_resources()
    assert old_report.exists()
    old_report.unlink()
    old_report.parent.rmdir()
    env_file = tmp_path / 'resources/google_colab/assets/.env.json'
    env_file.write_text('private')
    with pytest.raises(ValueError, match='unsafe file'):
        broker.validate_resources()
