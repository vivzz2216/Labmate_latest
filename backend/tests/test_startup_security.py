"""Production-sensitive security defaults must fail closed."""

import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException
from fastapi.security import HTTPBasicCredentials

from app.middleware import csrf
from app.middleware import rate_limit
from app.routers import admin


def test_admin_denies_unconfigured_account(monkeypatch):
    monkeypatch.setattr(admin.settings, "ADMIN_USERID", "")
    monkeypatch.setattr(admin.settings, "ADMIN_PASSWORD", "")
    with pytest.raises(HTTPException) as error:
        admin.require_admin(HTTPBasicCredentials(username="", password=""))
    assert error.value.status_code == 401


def test_admin_accepts_only_configured_credentials(monkeypatch):
    monkeypatch.setattr(admin.settings, "ADMIN_USERID", "test-admin")
    monkeypatch.setattr(admin.settings, "ADMIN_PASSWORD", "test-secret")
    assert admin.require_admin(HTTPBasicCredentials(username="test-admin", password="test-secret"))
    with pytest.raises(HTTPException):
        admin.require_admin(HTTPBasicCredentials(username="test-admin", password="wrong"))


def test_csrf_denies_when_redis_unavailable(monkeypatch):
    monkeypatch.setattr(csrf, "redis_client", None)
    assert csrf.verify_csrf_token("any-token") is False


@pytest.mark.asyncio
async def test_enabled_rate_limit_denies_when_redis_unavailable(monkeypatch):
    from starlette.requests import Request

    monkeypatch.setattr(rate_limit, "redis_client", None)
    monkeypatch.setattr(rate_limit.settings, "RATE_LIMIT_ENABLED", True)
    middleware = rate_limit.RateLimitMiddleware(lambda scope, receive, send: None)
    request = Request({"type": "http", "method": "POST", "path": "/api/workflows", "headers": []})

    async def next_handler(_request):
        raise AssertionError("Request must not reach the application")

    response = await middleware.dispatch(request, next_handler)
    assert response.status_code == 503


def test_health_liveness_returns_ok():
    from starlette.testclient import TestClient
    from app.main import app

    client = TestClient(app, raise_server_exceptions=False)
    res = client.get("/health/live")
    assert res.status_code == 200
    assert res.json()["status"] == "alive"


def test_health_readiness_fails_when_database_unhealthy(monkeypatch):
    from unittest.mock import MagicMock
    from starlette.testclient import TestClient
    from app.main import app
    import app.database as app_db

    # Simulate broken database connection
    mock_engine = MagicMock()
    mock_engine.connect.side_effect = RuntimeError("Database down")
    monkeypatch.setattr(app_db, "engine", mock_engine)

    client = TestClient(app, raise_server_exceptions=False)
    res = client.get("/health/ready")
    assert res.status_code == 503
    data = res.json()
    assert data["ready"] is False
    assert data["services"]["database"] == "unhealthy"


def test_health_readiness_fails_when_rate_limiting_enabled_without_redis(monkeypatch):
    from starlette.testclient import TestClient
    from app.main import app
    import app.cache as app_cache
    import app.main as app_main

    # Simulate rate limiting enabled with failed Redis ping
    monkeypatch.setattr(app_main.settings, "RATE_LIMIT_ENABLED", True)
    mock_redis = MagicMock()
    mock_redis.ping.side_effect = RuntimeError("Redis connection refused")
    monkeypatch.setattr(app_cache, "redis_client", mock_redis)

    client = TestClient(app, raise_server_exceptions=False)
    res = client.get("/health")
    assert res.status_code == 503
    data = res.json()
    assert data["ready"] is False
    assert data["services"]["redis"] == "unhealthy"

