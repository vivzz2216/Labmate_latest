"""Signed-in requests are rate limited per user; everything else stays per IP."""
import asyncio
from datetime import timedelta

import fakeredis
from fastapi import FastAPI
import httpx
import jwt
import pytest

from app.config import settings
from app.middleware import rate_limit
from app.security.jwt import ALGORITHM, create_access_token, create_refresh_token, rate_limit_subject


def make_app(monkeypatch, *, ip_limit=5, user_limit=3, ceiling=0):
    redis = fakeredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(rate_limit, 'redis_client', redis)
    monkeypatch.setattr(settings, 'RATE_LIMIT_ENABLED', True)
    monkeypatch.setattr(settings, 'AUTHENTICATED_IP_RATE_LIMIT_PER_MINUTE', ceiling)
    app = FastAPI()
    app.add_middleware(rate_limit.RateLimitMiddleware, requests_per_minute=ip_limit, user_requests_per_minute=user_limit)

    @app.api_route('/{path:path}', methods=['GET', 'POST'])
    def ok(path): return {'ok': True}
    return app, redis


def bearer(user_id, **kwargs):
    return {'authorization': 'Bearer ' + create_access_token({'sub': str(user_id)}, **kwargs)}


async def statuses(client, count, headers=None, path='/api/workflows/1'):
    return [(await client.get(path, headers=headers)).status_code for _ in range(count)]


@pytest.mark.asyncio
async def test_students_on_one_address_get_separate_buckets(monkeypatch):
    app, redis = make_app(monkeypatch)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        first, second = bearer(1), bearer(2)
        assert await statuses(client, 5, first) == [200, 200, 200, 429, 429]
        # Same IP, different user: untouched by the first student's exhausted bucket.
        assert await statuses(client, 3, second) == [200, 200, 200]
        assert redis.ttl('rate_limit:user:1') > 0 and redis.ttl('rate_limit:user:2') > 0
        assert redis.get('rate_limit:api:127.0.0.1') is None


@pytest.mark.asyncio
@pytest.mark.parametrize('kind', ['forged', 'expired', 'refresh', 'garbage', 'non_numeric'])
async def test_untrusted_tokens_fall_back_to_the_ip_bucket(monkeypatch, kind):
    app, redis = make_app(monkeypatch)
    if kind == 'forged':
        token = jwt.encode({'sub': '9', 'type': 'access'}, 'some-other-secret-key-of-32-bytes!!', algorithm=ALGORITHM)
    elif kind == 'expired':
        token = create_access_token({'sub': '9'}, expires_delta=timedelta(seconds=-5))
    elif kind == 'refresh':
        token = create_refresh_token({'sub': '9'})
    elif kind == 'non_numeric':
        token = create_access_token({'sub': 'admin'})
    else:
        token = 'not-a-jwt'
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        # Rotating the claimed subject must not open a fresh bucket; the IP limit (5) applies.
        results = await statuses(client, 7, {'authorization': 'Bearer ' + token})
    assert results == [200] * 5 + [429] * 2
    assert not [key for key in redis.keys('rate_limit:user:*')]


@pytest.mark.asyncio
async def test_login_stays_per_ip_even_with_a_valid_token(monkeypatch):
    app, redis = make_app(monkeypatch)
    monkeypatch.setattr(settings, 'AUTH_RATE_LIMIT_PER_MINUTE', 2)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        results = [(await client.post('/api/basic-auth/login', headers=bearer(1))).status_code for _ in range(4)]
    assert results == [200, 200, 429, 429]
    assert redis.get('rate_limit:user:1') is None


@pytest.mark.asyncio
async def test_ip_ceiling_bounds_many_accounts_behind_one_address(monkeypatch):
    app, _ = make_app(monkeypatch, user_limit=100, ceiling=6)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        results = [(await client.get('/api/x', headers=bearer(user))).status_code for user in range(1, 9)]
    assert results == [200] * 6 + [429] * 2


@pytest.mark.asyncio
async def test_concurrent_requests_are_counted_exactly(monkeypatch):
    app, _ = make_app(monkeypatch, user_limit=10)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        responses = await asyncio.gather(*(client.get('/api/x', headers=bearer(4)) for _ in range(25)))
    assert sum(r.status_code == 200 for r in responses) == 10
    assert sum(r.status_code == 429 for r in responses) == 15


def test_subject_helper_accepts_only_valid_access_tokens():
    assert rate_limit_subject(create_access_token({'sub': '42'})) == '42'
    assert rate_limit_subject(create_refresh_token({'sub': '42'})) is None
    assert rate_limit_subject('') is None
