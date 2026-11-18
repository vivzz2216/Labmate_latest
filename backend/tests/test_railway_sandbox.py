import base64
import io
from unittest.mock import AsyncMock
import tarfile

import pytest
from app.services import railway_sandbox as adapter
from app.services import worker_health as health
from app.config import settings


def test_bundle_includes_runtime_but_no_data_or_secrets():
    adapter.runtime_bundle.cache_clear()
    with tarfile.open(fileobj=io.BytesIO(base64.b64decode(adapter.runtime_bundle()))) as archive:
        names=archive.getnames()
        assert 'backend/app/services/runtime_engine.py' in names
        assert 'backend/app/runtime/GuiHarness.java' in names
        assert 'railway_job.py' in names and 'broker.py' in names
        assert 'resources/google_colab/index.html' in names
        assert 'resources/sql_workbench/index.html' in names
        assert not any('.env' in n or n.endswith(('.db','.pem','.key')) or n.startswith(('uploads/','reports/','screenshots/')) for n in names)


@pytest.mark.asyncio
async def test_missing_credentials_does_not_launch_a_process(monkeypatch):
    monkeypatch.delenv('RAILWAY_API_TOKEN',raising=False)
    launch=AsyncMock()
    monkeypatch.setattr(adapter.asyncio,'create_subprocess_exec',launch)
    result=await adapter.execute({'code':'print(7)','language':'python'})
    assert not result.success and result.stages['isolation']=='failed'
    launch.assert_not_awaited()


@pytest.mark.asyncio
async def test_railway_receipt_provenance_and_failure(monkeypatch):
    monkeypatch.setattr(adapter,'exchange',AsyncMock(return_value={'success':True,'output':'7','frames':[]}))
    result=await adapter.execute({'code':'print(7)'})
    assert result.success and result.stages['isolation']=='railway_microvm'
    monkeypatch.setattr(adapter,'exchange',AsyncMock(side_effect=RuntimeError('secret provider metadata')))
    result=await adapter.execute({})
    assert not result.success and 'secret' not in result.error


@pytest.mark.asyncio
@pytest.mark.parametrize('valid',[True,False])
async def test_railway_health_executes_nonce_probe_only_when_forced_and_caches(monkeypatch,valid):
    monkeypatch.setattr(settings,'EXECUTION_BACKEND','railway_sandbox')
    monkeypatch.setattr(health,'isolation_required',lambda:True)
    async def reply(job):
        return {'protocol':1,'nonce':job['nonce'] if valid else 'wrong','status':'healthy','isolation':'railway_microvm'}
    exchange=AsyncMock(side_effect=reply)
    monkeypatch.setattr(adapter,'exchange',exchange)
    probe=health.WorkerHealth()
    assert (await probe.check(force=True))['available'] is valid
    assert (await probe.check())['available'] is valid
    exchange.assert_awaited_once()


@pytest.mark.asyncio
async def test_railway_health_nonblocking_refresh(monkeypatch):
    import asyncio
    monkeypatch.setattr(settings, 'EXECUTION_BACKEND', 'railway_sandbox')
    monkeypatch.setattr(health, 'isolation_required', lambda: True)
    started = asyncio.Event()

    async def slow_reply(job):
        started.set()
        await asyncio.sleep(0.05)
        return {'protocol': 1, 'nonce': job['nonce'], 'status': 'healthy', 'isolation': 'railway_microvm'}

    exchange = AsyncMock(side_effect=slow_reply)
    monkeypatch.setattr(adapter, 'exchange', exchange)

    probe = health.WorkerHealth()
    # The startup probe (forced) runs in the background; polls meanwhile report 'checking'.
    res = await probe.check(force=True, wait_timeout=2.0)
    assert res['status'] == 'checking'
    assert res['available'] is False

    await asyncio.wait_for(started.wait(), timeout=1.0)
    assert (await probe.check(wait_timeout=2.0))['status'] == 'checking'
    await asyncio.sleep(0.1)

    # Subsequent polls return the cached healthy status and never start another probe.
    res2 = await probe.check(wait_timeout=2.0)
    assert res2['status'] == 'healthy'
    assert res2['available'] is True
    exchange.assert_awaited_once()


@pytest.mark.asyncio
async def test_polled_health_never_creates_a_sandbox(monkeypatch):
    """Every open student page polls /health/ready; a probe there would spend Railway's hourly API allowance."""
    monkeypatch.setattr(settings, 'EXECUTION_BACKEND', 'railway_sandbox')
    monkeypatch.setattr(health, 'isolation_required', lambda: True)
    exchange = AsyncMock()
    monkeypatch.setattr(adapter, 'exchange', exchange)
    probe = health.WorkerHealth()
    for _ in range(5):
        res = await probe.check(wait_timeout=2.0)
        assert res['available'] is True and res['status'] == 'ready'
        assert (await probe.check())['available'] is True
    exchange.assert_not_awaited()
    probe.record_job(False)
    assert (await probe.check(wait_timeout=2.0))['status'] == 'unavailable'
    probe.record_job(True)
    assert (await probe.check(wait_timeout=2.0))['status'] == 'healthy'
    exchange.assert_not_awaited()

