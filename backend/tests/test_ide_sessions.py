"""Eclipse/IntelliJ Run keeps one Railway sandbox per student instead of creating one per click (2026-11-19).

A new VM spends ~14-56 Railway API requests of the account's 1,000 an hour, so ~70 Run clicks used to block code
execution for every student on the site.
"""
import asyncio
import time
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import settings
from app.middleware.csrf import require_csrf_token
from app.routers import ide_java
from app.security.execution_access import execution_user
from app.services import ide_sessions as module
from app.services import railway_sandbox


class FakeSession:
    made = []

    def __init__(self):
        self.loop = asyncio.get_running_loop()
        self.closed = False
        FakeSession.made.append(self)

    async def close(self):
        self.closed = True


@pytest.fixture()
def railway(monkeypatch):
    FakeSession.made = []
    monkeypatch.setattr(settings, 'EXECUTION_BACKEND', 'railway_sandbox')
    monkeypatch.setattr(railway_sandbox, 'SandboxSession', FakeSession)
    return module.IdeSessions()


@pytest.mark.asyncio
async def test_a_students_runs_share_one_sandbox_and_students_do_not_share(railway):
    async with railway.use(1) as first:
        assert railway_sandbox._session.get() is first
    async with railway.use(1) as again:
        assert again is first
    async with railway.use(2) as other:
        assert other is not first
    assert railway_sandbox._session.get() is None
    assert len(FakeSession.made) == 2
    await railway.close_all()
    assert all(s.closed for s in FakeSession.made)


@pytest.mark.asyncio
async def test_idle_sandboxes_are_closed_before_railway_reaps_them(railway):
    async with railway.use(1):
        pass
    assert railway.reap(now=time.monotonic() + module.IDLE_SECONDS - 5) == 0
    assert railway.reap(now=time.monotonic() + module.IDLE_SECONDS + 1) == 1
    await asyncio.sleep(0)
    assert FakeSession.made[0].closed
    async with railway.use(1) as fresh:
        assert fresh is FakeSession.made[1]
    await railway.close_all()


@pytest.mark.asyncio
async def test_a_running_sandbox_is_never_reaped_and_the_oldest_idle_one_makes_room(railway, monkeypatch):
    monkeypatch.setattr(module, 'MAX_SESSIONS', 2)
    async with railway.use(1):
        assert railway.reap(now=time.monotonic() + 10_000) == 0  # mid-run
    await asyncio.sleep(0.01)
    async with railway.use(2):
        pass
    async with railway.use(3):
        pass
    await asyncio.sleep(0)
    assert FakeSession.made[0].closed and not FakeSession.made[1].closed
    await railway.close_all()


@pytest.mark.asyncio
async def test_other_backends_are_untouched(monkeypatch):
    monkeypatch.setattr(settings, 'EXECUTION_BACKEND', 'ssh')
    sessions = module.IdeSessions()
    async with sessions.use(1) as session:
        assert session is None and railway_sandbox._session.get() is None


def _client(monkeypatch, seen):
    ide_java._recent.clear()
    ide_java._busy.clear()
    monkeypatch.setattr(ide_java, 'ide_sessions', module.IdeSessions())

    async def fake_execute(code, language, stdin=''):
        seen.append(railway_sandbox._session.get())
        return SimpleNamespace(success=True, output='hi\n', error='', exit_code=0, stages={})

    monkeypatch.setattr(ide_java._engine, 'execute', fake_execute)
    app = FastAPI()
    app.include_router(ide_java.router, prefix='/api')
    app.dependency_overrides[execution_user] = lambda: SimpleNamespace(id=7, email='s@example.com')
    app.dependency_overrides[require_csrf_token] = lambda: True
    return TestClient(app)


CODE = 'public class A { public static void main(String[] a) { System.out.println("hi"); } }'


def test_run_button_reuses_the_students_sandbox(monkeypatch):
    FakeSession.made = []
    monkeypatch.setattr(settings, 'EXECUTION_BACKEND', 'railway_sandbox')
    monkeypatch.setattr(railway_sandbox, 'SandboxSession', FakeSession)
    seen = []
    with _client(monkeypatch, seen) as client:
        for _ in range(3):
            reply = client.post('/api/ide/java/run', json={'code': CODE})
            assert reply.status_code == 200 and reply.json()['stdout'] == 'hi\n'
    assert len(seen) == 3 and seen[0] is not None and all(s is seen[0] for s in seen)
    assert len(FakeSession.made) == 1


def test_hourly_run_cap_names_the_wait(monkeypatch):
    seen = []
    with _client(monkeypatch, seen) as client:
        now = time.monotonic()
        ide_java._recent[7].extend(now - 3000 + i for i in range(ide_java.RUNS_PER_HOUR))
        reply = client.post('/api/ide/java/run', json={'code': CODE})
        assert reply.status_code == 429 and f"this hour's {ide_java.RUNS_PER_HOUR} runs" in reply.json()['detail']
        assert 'about 10 minutes' in reply.json()['detail']
        ide_java._recent[7].clear()
        ide_java._recent[7].extend([now - 120] * (ide_java.RUNS_PER_HOUR - 1))  # older than a minute: only the hour counts
        assert client.post('/api/ide/java/run', json={'code': CODE}).status_code == 200
    assert len(seen) == 1
