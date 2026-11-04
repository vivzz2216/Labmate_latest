import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.config import settings
from app.services import worker_health as health


@pytest.mark.asyncio
@pytest.mark.parametrize('reply,expected', [('valid', True), ('wrong_nonce', False), ('garbage', False), ('old_broker', False)])
async def test_health_requires_authenticated_execution_receipt(monkeypatch, reply, expected):
    monkeypatch.setattr(health, 'isolation_required', lambda: True)
    monkeypatch.setattr(health, 'worker_command', lambda: ['pinned-ssh'])
    request = {}
    def write(data): request.update(json.loads(data))
    async def read_out(_):
        if reply == 'garbage': return b'invalid'
        return json.dumps({'protocol': 1, 'nonce': request['nonce'] if reply == 'valid' else 'wrong',
                           'status': 'healthy', 'isolation': 'linux_namespaces'} if reply != 'old_broker'
                          else {'success':False,'error':'Invalid job schema.'}).encode()
    # read_bounded must receive EOF, not an endless successful response.
    stdout = SimpleNamespace(read=AsyncMock(side_effect=lambda n: None))
    calls = 0
    async def bounded(stream, limit):
        nonlocal calls
        calls += 1
        return await read_out(limit) if stream is stdout else b''
    process = SimpleNamespace(returncode=0, stdin=SimpleNamespace(write=write,drain=AsyncMock(),close=Mock()),
                              stdout=stdout,stderr=object(),wait=AsyncMock(),kill=Mock())
    launch = AsyncMock(return_value=process)
    monkeypatch.setattr(asyncio, 'create_subprocess_exec', launch)
    monkeypatch.setattr(health, 'read_bounded', bounded)
    probe = health.WorkerHealth()
    first, second = await asyncio.gather(probe.check(), probe.check())
    assert first['available'] is expected and second == first
    assert first['status'] == ('healthy' if expected else 'unavailable')
    launch.assert_awaited_once()
    assert calls == 2
    assert set(request) == {'operation','nonce'} and request['operation'] == 'health'


@pytest.mark.asyncio
async def test_health_timeout_kills_probe_and_invalidated_cache_rechecks(monkeypatch):
    monkeypatch.setattr(health, 'isolation_required', lambda: True)
    monkeypatch.setattr(health, 'worker_command', lambda: ['pinned-ssh'])
    process=SimpleNamespace(returncode=None,stdin=SimpleNamespace(write=Mock(),drain=AsyncMock(),close=Mock()),
        stdout=object(),stderr=object(),wait=AsyncMock(),kill=Mock())
    launch=AsyncMock(return_value=process)
    async def fail(*args): raise TimeoutError()
    monkeypatch.setattr(asyncio,'create_subprocess_exec',launch)
    monkeypatch.setattr(health,'read_bounded',fail)
    probe=health.WorkerHealth()
    assert not (await probe.check())['available']
    process.kill.assert_called_once()
    assert not (await probe.check())['available']
    launch.assert_awaited_once()
    probe.invalidate()
    await probe.check()
    assert launch.await_count == 2


@pytest.mark.asyncio
async def test_website_readiness_separates_worker_outage(monkeypatch):
    from app import main
    from fastapi import Response
    monkeypatch.setattr(main,'_health_check_sync',lambda response: {'ready':True,'services':{'database':'healthy','redis':'healthy'}})
    monkeypatch.setattr(health.worker_health,'check',AsyncMock(return_value={'status':'unavailable','available':False}))
    response=Response()
    result=await main.health_check(response)
    assert response.status_code == 200 and result['ready'] is True
    assert result['execution_ready'] is False and result['services']['execution_worker']=='unavailable'


@pytest.mark.asyncio
async def test_worker_outage_does_not_enter_code_repair(monkeypatch):
    from app.services import assignment_workflow as flow
    monkeypatch.setattr(flow.executor_service,'execute_code',AsyncMock(return_value=(False,'','unavailable',126,
        [{'type':'execution_stages','stages':{'isolation':'failed'}}])))
    with pytest.raises(health.WorkerUnavailableError):
        await flow.execute_solution('print(5)','python','Add numbers','test','Student')


def test_broker_capacity_failure_is_not_mislabeled_as_verified_isolation():
    from app.services.isolated_runtime import import_receipt
    result=import_receipt({'success':False,'error':'Worker busy','exit_code':126,
                           'stages':{'isolation':'failed','execution':'not_run'}})
    assert not result.success and result.stages['isolation']=='failed'


def test_broker_health_rejects_supplied_scripts_before_execution(monkeypatch):
    import importlib.util
    import sys
    from pathlib import Path
    monkeypatch.setitem(sys.modules,'resource',Mock())  # broker is Linux-only; schema validation is portable
    spec=importlib.util.spec_from_file_location('health_broker',Path(__file__).parents[1]/'scripts/sandbox_broker.py')
    broker=importlib.util.module_from_spec(spec);spec.loader.exec_module(broker)
    command=Mock(side_effect=AssertionError('must not execute'))
    monkeypatch.setattr(broker,'command',command)
    for request in [{'operation':'health','nonce':'x'}, {'operation':'health','nonce':'a'*32,'code':'arbitrary'}]:
        with pytest.raises(ValueError): broker.health(request)
    command.assert_not_called()
