"""Failures found by load testing many students at once (see docs/LAB_TESTING_OPEN_ISSUES_2026-11-16.md)."""
import asyncio
import threading
from types import SimpleNamespace

import httpx
import pytest

from app.config import settings
from app.middleware import auth as auth_middleware
from tests.test_rate_limit_per_user import make_app


@pytest.mark.asyncio
async def test_the_signed_in_user_lookup_does_not_block_the_event_loop(monkeypatch):
    """A pool checkout on the loop thread stalls every request once all connections are in use."""
    seen = {}
    loop_thread = threading.get_ident()

    class Query:
        def filter(self, *_): return self
        def first(self):
            seen['thread'] = threading.get_ident()
            return SimpleNamespace(id=7, is_active=True)

    db = SimpleNamespace(query=lambda *_: Query())
    monkeypatch.setattr(auth_middleware, 'get_user_id_from_token', lambda token: 7)
    request = SimpleNamespace(state=SimpleNamespace())
    credentials = SimpleNamespace(credentials='token')
    user = await auth_middleware.get_current_user(request, credentials, db)
    assert user.id == 7 and seen['thread'] != loop_thread


@pytest.mark.asyncio
async def test_a_class_behind_one_address_can_all_sign_in_and_sign_up(monkeypatch):
    app, redis = make_app(monkeypatch)
    fields = type(settings).model_fields   # defaults, not whatever a local .env overrides
    assert fields['AUTH_RATE_LIMIT_PER_MINUTE'].default >= 300 and fields['SIGNUP_RATE_LIMIT_PER_MINUTE'].default >= 60
    monkeypatch.setattr(settings, 'AUTH_RATE_LIMIT_PER_MINUTE', fields['AUTH_RATE_LIMIT_PER_MINUTE'].default)
    monkeypatch.setattr(settings, 'SIGNUP_RATE_LIMIT_PER_MINUTE', fields['SIGNUP_RATE_LIMIT_PER_MINUTE'].default)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        logins = [(await client.post('/api/basic-auth/login')).status_code for _ in range(150)]
        signups = [(await client.post('/api/basic-auth/signup')).status_code for _ in range(60)]
    assert logins == [200] * 150 and signups == [200] * 60
    assert int(redis.get('rate_limit:auth:127.0.0.1')) == 150 and int(redis.get('rate_limit:signup:127.0.0.1')) == 60


@pytest.mark.asyncio
async def test_signups_have_their_own_bucket_and_cannot_use_up_logins(monkeypatch):
    app, _ = make_app(monkeypatch)
    monkeypatch.setattr(settings, 'SIGNUP_RATE_LIMIT_PER_MINUTE', 3)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        signups = [(await client.post('/api/basic-auth/signup')).status_code for _ in range(5)]
        login = (await client.post('/api/basic-auth/login')).status_code
    assert signups == [200, 200, 200, 429, 429] and login == 200


def test_uploads_are_refused_cleanly_when_the_storage_volume_is_nearly_full(monkeypatch):
    import asyncio as aio
    from fastapi import HTTPException
    from app.routers import upload as upload_router
    monkeypatch.setattr(upload_router.shutil, 'disk_usage', lambda _: SimpleNamespace(free=50 * 1024**2))
    monkeypatch.setattr(settings, 'MIN_FREE_DISK_MB', 200)
    file = SimpleNamespace(filename='manual.docx')
    with pytest.raises(HTTPException) as refused:
        aio.run(upload_router.upload_file(SimpleNamespace(), file, None, SimpleNamespace(id=1), True))
    assert refused.value.status_code == 507
