"""Railway's public API allows 1,000 requests an hour on Hobby (10,000 on Pro); found by the 2026-11-18 live load test.

Each new sandbox VM costs ~15 requests, so one VM per program capped the whole site at ~60 programs an hour, and
the 61st run failed with a generic "worker unavailable". These tests pin the fixes: one VM per manual, a clear
"resumes at" message while the allowance is used up, and health polling that never creates a sandbox.
"""
import asyncio
import sys
import textwrap
import time
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.config import settings
from app.services import railway_sandbox as adapter
from app.services import worker_health as health


@pytest.fixture(autouse=True)
def clean_rate_limit(monkeypatch):
    monkeypatch.setattr(adapter, '_rate_limited_until', 0.0)
    monkeypatch.setattr(health, 'worker_health', health.WorkerHealth())
    yield


FAKE_BRIDGE = textwrap.dedent('''
    import json, sys
    open(sys.argv[1], 'a').write('x')
    first = json.loads(sys.stdin.readline())
    assert first == {'bundle': 'BUNDLE'}, first
    for n, line in enumerate(sys.stdin, 1):
        job = json.loads(line)['job']
        if job.get('code') == 'fail':
            reply = {'ok': False, 'error': 'Incomplete sandbox receipt (exit=137)'}
        else:
            reply = {'ok': True, 'receipt': {'n': n, 'code': job['code']}}
        sys.stdout.write(json.dumps(reply) + chr(10))
        sys.stdout.flush()
''')


@pytest.fixture
def fake_bridge(tmp_path, monkeypatch):
    script = tmp_path / 'fake_bridge.py'
    script.write_text(FAKE_BRIDGE, encoding='utf-8')
    started = tmp_path / 'started.txt'
    started.write_text('', encoding='utf-8')
    real_exec = asyncio.create_subprocess_exec

    async def launch(*args, **kwargs):
        assert '--session' in args
        kwargs.pop('env', None)
        return await real_exec(sys.executable, str(script), str(started), **kwargs)

    monkeypatch.setenv('RAILWAY_API_TOKEN', 'token-for-test')
    monkeypatch.setenv('RAILWAY_ENVIRONMENT_ID', 'env-for-test')
    monkeypatch.setattr(settings, 'EXECUTION_BACKEND', 'railway_sandbox')
    monkeypatch.setattr(adapter, 'runtime_bundle', lambda: 'BUNDLE')
    monkeypatch.setattr(adapter.asyncio, 'create_subprocess_exec', launch)
    return started


@pytest.mark.asyncio
async def test_one_manual_uses_one_bridge_and_its_programs_share_it(fake_bridge):
    async with adapter.sandbox_session() as session:
        receipts = [await adapter.exchange({'code': f'print({n})'}) for n in range(1, 4)]
        assert session.jobs == 3
    assert [r['n'] for r in receipts] == [1, 2, 3]
    assert fake_bridge.read_text() == 'x'


@pytest.mark.asyncio
async def test_failed_job_reports_error_and_the_session_keeps_working(fake_bridge):
    async with adapter.sandbox_session():
        with pytest.raises(RuntimeError, match='exit=137'):
            await adapter.exchange({'code': 'fail'})
        assert (await adapter.exchange({'code': 'print(1)'}))['code'] == 'print(1)'
    assert fake_bridge.read_text() == 'x'


@pytest.mark.asyncio
async def test_sessions_are_per_manual_and_off_for_other_backends(fake_bridge, monkeypatch):
    async with adapter.sandbox_session():
        await adapter.exchange({'code': 'a'})
    async with adapter.sandbox_session():
        await adapter.exchange({'code': 'b'})
    assert fake_bridge.read_text() == 'xx'
    monkeypatch.setattr(settings, 'EXECUTION_BACKEND', 'ssh')
    async with adapter.sandbox_session() as session:
        assert session is None


@pytest.mark.asyncio
async def test_hourly_limit_pauses_with_resume_time_and_stops_calling_railway(monkeypatch):
    reset = datetime.fromtimestamp(time.time() + 1500, timezone.utc).isoformat().replace('+00:00', 'Z')
    exchange = AsyncMock(side_effect=RuntimeError(
        f'Railway sandbox failed: Railway sandbox operation failed: RAILWAY_RATE_LIMITED reset={reset} retry_after=1500'))
    monkeypatch.setattr(adapter, 'exchange', exchange)
    first = await adapter.execute({'code': 'print(1)'})
    assert not first.success and first.stages['isolation'] == 'rate_limited'
    assert 'resumes in about 25 minutes' in first.error and 'Retry' in first.error
    second = await adapter.execute({'code': 'print(2)'})
    assert second.stages['isolation'] == 'rate_limited'
    exchange.assert_awaited_once()
    monkeypatch.setattr(settings, 'EXECUTION_BACKEND', 'railway_sandbox')
    monkeypatch.setattr(health, 'isolation_required', lambda: True)
    state = await health.worker_health.check(wait_timeout=2.0)
    assert state['status'] == 'rate_limited' and not state['available'] and state['resumes_at']
    error = health.ExecutionRateLimitedError(state['resumes_at'])
    assert isinstance(error, health.WorkerUnavailableError) and 'resumes in about' in str(error)


def test_rate_limit_time_parsing_is_bounded():
    now = 1_000_000.0
    assert adapter.note_rate_limit('RAILWAY_RATE_LIMITED reset= retry_after=120', now=now) == now + 120
    adapter._rate_limited_until = 0.0
    assert adapter.note_rate_limit('RAILWAY_RATE_LIMITED reset=garbage retry_after=', now=now) == now + 300
    adapter._rate_limited_until = 0.0
    assert adapter.note_rate_limit('RAILWAY_RATE_LIMITED reset=2099-01-01T00:00:00Z retry_after=', now=now) == now + 3600


@pytest.mark.asyncio
async def test_rate_limited_stage_pauses_the_manual_with_the_resume_message(monkeypatch):
    from app.services import assignment_workflow
    adapter.note_rate_limit('RAILWAY_RATE_LIMITED reset= retry_after=600')
    result = await adapter.execute({'code': 'print(7)'})
    monkeypatch.setattr(assignment_workflow.executor_service, 'execute_code',
                        AsyncMock(return_value=(False, '', result.error, 0, [{'type': 'execution_stages', 'stages': result.stages}])))
    with pytest.raises(health.ExecutionRateLimitedError, match='resumes in about 10 minutes'):
        await assignment_workflow.execute_solution('print(7)', 'python', 'Print 7', 'group', 'Student')


@pytest.mark.asyncio
async def test_successful_and_failed_jobs_update_health_without_probing(monkeypatch):
    monkeypatch.setattr(settings, 'EXECUTION_BACKEND', 'railway_sandbox')
    monkeypatch.setattr(health, 'isolation_required', lambda: True)
    monkeypatch.setattr(adapter, 'exchange', AsyncMock(side_effect=RuntimeError('connection reset')))
    assert (await adapter.execute({'code': 'x'})).stages['isolation'] == 'failed'
    assert (await health.worker_health.check())['status'] == 'unavailable'
    health.worker_health.invalidate()  # the workflow calls this on failure; it must not hide the recorded failure
    assert (await health.worker_health.check())['status'] == 'unavailable'
    monkeypatch.setattr(adapter, 'exchange', AsyncMock(return_value={'success': True, 'output': '7', 'frames': []}))
    assert (await adapter.execute({'code': 'print(7)'})).success
    assert (await health.worker_health.check())['status'] == 'healthy'
