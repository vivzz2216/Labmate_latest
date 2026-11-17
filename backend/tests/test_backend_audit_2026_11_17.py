"""Regression tests for the backend audit of 2026-11-17 (docs/LAB_TESTING_OPEN_ISSUES_2026-11-16.md)."""
import asyncio
import threading
import time

import httpx
import pytest
from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.exc import DataError

from app.config import settings


@pytest.mark.asyncio
async def test_ids_no_row_can_have_are_404_not_a_database_crash():
    from app.middleware.path_ids import PathIdRangeMiddleware
    app = FastAPI()
    app.add_middleware(PathIdRangeMiddleware)

    @app.get('/api/workflows/{upload_id}')
    def workflow(upload_id: int):
        return {'id': upload_id}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        assert (await client.get('/api/workflows/2147483647')).json() == {'id': 2147483647}
        for big in ('2147483648', '999999999999999999999', '00000000000000000001'):
            assert (await client.get(f'/api/workflows/{big}')).status_code == 404


@pytest.mark.asyncio
async def test_an_out_of_range_database_value_is_a_422(monkeypatch):
    from app.main import app as main_app, database_value_out_of_range
    assert main_app.exception_handlers[DataError] is database_value_out_of_range
    app = FastAPI()
    app.add_exception_handler(DataError, database_value_out_of_range)

    @app.get('/boom')
    def boom():
        raise DataError('SELECT 1', {}, Exception('integer out of range'))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        response = await client.get('/boom')
    assert response.status_code == 422


def test_capture_sessions_are_least_recently_used_and_bounded_by_bytes(monkeypatch):
    from app.routers import netlab
    monkeypatch.setattr(netlab, '_sessions', type(netlab._sessions)())
    monkeypatch.setattr(netlab, 'MAX_SESSION_BYTES', 3 * 1024 * 1024)
    first = netlab._remember('s1', 'a', 1024 * 1024)
    second = netlab._remember('s2', 'b', 1024 * 1024)
    netlab._recall(first)                                  # used again: now the most recent
    third = netlab._remember('s3', 'c', 1024 * 1024)
    fourth = netlab._remember('s4', 'd', 1024 * 1024)      # over budget: evicts the least recently used (second)
    assert netlab._recall(first) == ('s1', 'a') and netlab._recall(third) and netlab._recall(fourth)
    with pytest.raises(HTTPException) as gone:
        netlab._recall(second)
    assert gone.value.status_code == 410
    # A class of small captures fits: the old cap of 24 sessions evicted the 25th student's neighbour.
    monkeypatch.setattr(netlab, '_sessions', type(netlab._sessions)())
    tokens = [netlab._remember(f's{i}', 'x', 50 * 1024) for i in range(40)]
    assert all(netlab._recall(token) for token in tokens)


@pytest.mark.asyncio
async def test_opening_a_capture_parses_off_the_event_loop(monkeypatch):
    from app.routers import netlab
    loop_thread = threading.get_ident()
    seen = {}

    def load(data):
        seen['load'] = threading.get_ident()
        return type('S', (), {'packets': [], 'rows': lambda self: []})(), 'practice', {}

    monkeypatch.setattr(netlab.wireshark_lab, 'load', load)
    monkeypatch.setattr(netlab.wireshark_lab, 'plan', lambda session: ([], []))
    result = await netlab.open_capture(None, False)
    assert result['total'] == 0 and seen['load'] != loop_thread


@pytest.mark.asyncio
async def test_idle_mysql_sessions_are_closed_off_the_event_loop(monkeypatch):
    from app.routers import ide_mysql
    loop_thread = threading.get_ident()
    closed = []

    class Session:
        schema_map, active_schema = {}, None
        def close(self): closed.append(threading.get_ident())
        def execute(self, statement): return {'success': True, 'type': 'ok', 'columns': [], 'rowcount': 0}

    monkeypatch.setattr(ide_mysql, '_sessions', {99: (Session(), time.monotonic() - ide_mysql.IDLE_SECONDS - 5)})
    monkeypatch.setattr(ide_mysql, 'SQLSession', Session)
    user = type('U', (), {'id': 7})()
    await ide_mysql.execute(ide_mysql.MysqlStatementInput(statement='SELECT 1'), user, True)
    assert closed and closed[0] != loop_thread and 99 not in ide_mysql._sessions


def test_legacy_model_endpoints_require_paid_execution_access():
    from app.routers import ai_review, analyze
    from app.security.execution_access import legacy_execution_user
    for router in (ai_review.router, analyze.router):
        for route in router.routes:
            calls = {dependency.call for dependency in route.dependant.dependencies}
            assert legacy_execution_user in calls, route.path


def test_server_errors_do_not_echo_exception_text_to_the_client():
    """D1: messages like "Download failed: [Errno 2] /data/reports/..." exposed paths and library errors."""
    import pathlib
    import re
    leak = re.compile(r'detail\s*=\s*f["\'][^"\']*\{\s*(str\()?(e|exc|error|err)\b')
    routers = pathlib.Path(__file__).resolve().parents[1] / 'app' / 'routers'
    offenders = [f'{path.name}:{number}' for path in routers.glob('*.py')
                 for number, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1) if leak.search(line)]
    assert offenders == []


@pytest.mark.asyncio
async def test_a_failed_report_composition_hides_the_internal_error(monkeypatch):
    from types import SimpleNamespace
    from app.routers import compose

    async def owned(*_):
        return SimpleNamespace(id=1)

    async def boom(*_):
        raise OSError("[Errno 28] No space left on device: '/data/reports/secret.docx'")

    monkeypatch.setattr(compose, 'verify_upload_ownership', owned)
    monkeypatch.setattr(compose.composer_service, 'compose_report', boom)
    with pytest.raises(HTTPException) as failed:
        await compose.compose_report(None, SimpleNamespace(upload_id=1, screenshot_order=[]), None, SimpleNamespace(id=7), True)
    assert failed.value.status_code == 500 and '/data' not in failed.value.detail and 'Errno' not in failed.value.detail
