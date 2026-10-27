"""Exercise authentication, ownership and CSRF with real token TTL semantics."""
from types import SimpleNamespace
from unittest.mock import MagicMock

import fakeredis
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from starlette.requests import Request

from app.config import settings
from app.middleware import auth, csrf


@pytest.mark.asyncio
async def test_unverified_bearer_header_cannot_skip_csrf():
    request = Request({'type': 'http', 'method': 'POST', 'path': '/api/workflows',
                       'headers': [(b'authorization', b'Bearer fabricated')]})
    with pytest.raises(HTTPException) as error:
        await csrf.validate_csrf_token(request)
    assert error.value.status_code == 403


def test_csrf_does_not_create_non_expiring_tokens_during_redis_failure(monkeypatch):
    redis = fakeredis.FakeRedis()
    monkeypatch.setattr(csrf, 'redis_client', redis)
    csrf.store_csrf_token('normal-token', 11)
    assert 0 < redis.ttl('csrf_token:11:normal-token') <= csrf.CSRF_TOKEN_TTL
    assert csrf.verify_csrf_token('normal-token', 11)
    assert not csrf.verify_csrf_token('normal-token', 12)
    broken = MagicMock()
    broken.setex.side_effect = ConnectionError('Redis unavailable')
    broken.exists.side_effect = ConnectionError('Redis unavailable')
    monkeypatch.setattr(csrf, 'redis_client', broken)
    csrf.store_csrf_token('outage-token', 11)
    assert not csrf.verify_csrf_token('outage-token', 11)
    monkeypatch.setattr(csrf, 'redis_client', redis)
    redis.delete('csrf_token:11:normal-token')
    assert not csrf.verify_csrf_token('normal-token', 11)


@pytest.mark.asyncio
async def test_optional_user_passes_request_credentials_and_db(monkeypatch):
    request = Request({'type': 'http', 'method': 'GET', 'path': '/', 'headers': []})
    credentials = HTTPAuthorizationCredentials(scheme='Bearer', credentials='test')
    user = SimpleNamespace(id=11, is_active=True)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = user
    monkeypatch.setattr(auth, 'get_user_id_from_token', lambda token: 11)
    assert await auth.get_optional_user(request, credentials, db) is user


@pytest.mark.asyncio
@pytest.mark.parametrize('kind', ['upload', 'job', 'report'])
@pytest.mark.parametrize('owner_id', [77, None])
async def test_ownership_uses_configured_admin_and_denies_orphans(monkeypatch, kind, owner_id):
    monkeypatch.setattr(settings, 'ADMIN_USERID', 'configured-owner@example.com')
    monkeypatch.setattr(settings, 'ADMIN_PASSWORD', 'test-password')
    user = SimpleNamespace(id=11, email='labmateowner@gmail.com', is_active=True)
    upload = SimpleNamespace(id=9, user_id=owner_id)
    resource = SimpleNamespace(id=5, upload_id=9)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = ([upload] if kind == 'upload' else [resource, upload])
    verify = getattr(auth, 'verify_' + kind + '_ownership')
    with pytest.raises(HTTPException) as error:
        await verify(5, user, db)
    assert error.value.status_code == 403
    db.query.return_value.filter.return_value.first.side_effect = ([upload] if kind == 'upload' else [resource, upload])
    user.email = 'configured-owner@example.com'
    assert await verify(5, user, db) is (upload if kind == 'upload' else resource)
