"""Deployment regressions: persistent paths, credentials, and startup readiness."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import Response
from pydantic import ValidationError

from app.config import Settings
from app import main


def test_explicit_local_storage_ignores_inherited_cloud_credentials():
    from app.services.storage_service import storage_service
    with patch.object(main.settings, "STORAGE_BACKEND", "local"), \
         patch.object(main.settings, "S3_ENDPOINT_URL", "https://storage.example.com"), \
         patch.object(main.settings, "S3_ACCESS_KEY_ID", "test-key"), \
         patch.object(main.settings, "S3_SECRET_ACCESS_KEY", "test-secret"):
        assert storage_service.is_s3_enabled is False


def test_data_directory_controls_all_artifacts(tmp_path, monkeypatch):
    for name in ("UPLOAD_DIR", "SCREENSHOT_DIR", "REPORT_DIR", "REACT_TEMP_DIR"):
        monkeypatch.delenv(name, raising=False)
    config = Settings(_env_file=None, DATA_DIR=str(tmp_path), DATABASE_URL="",
                      SECRET_KEY="s" * 64)
    assert config.UPLOAD_DIR == str(tmp_path / "uploads")
    assert config.SCREENSHOT_DIR == str(tmp_path / "screenshots")
    assert config.REPORT_DIR == str(tmp_path / "reports")
    assert config.REACT_TEMP_DIR == str(tmp_path / "react_temp")


def test_explicit_directory_override_is_preserved(tmp_path, monkeypatch):
    for name in ("UPLOAD_DIR", "SCREENSHOT_DIR", "REPORT_DIR", "REACT_TEMP_DIR"):
        monkeypatch.delenv(name, raising=False)
    config = Settings(_env_file=None, DATA_DIR=str(tmp_path), REPORT_DIR=str(tmp_path / "custom"),
                      DATABASE_URL="", SECRET_KEY="s" * 64)
    assert config.REPORT_DIR == str(tmp_path / "custom")


def test_railway_requires_postgres_and_a_stable_secret(monkeypatch):
    monkeypatch.setenv("RAILWAY_ENVIRONMENT_ID", "test-environment")
    with pytest.raises(ValidationError, match="DATABASE_URL"):
        Settings(_env_file=None, DATABASE_URL="sqlite://", SECRET_KEY="s" * 64)
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(_env_file=None, DATABASE_URL="postgresql://test:test@postgres/test", SECRET_KEY="short")
    with pytest.raises(ValidationError, match="REDIS_URL"):
        Settings(_env_file=None, DATABASE_URL="postgresql://test:test@postgres/test", SECRET_KEY="s" * 64, REDIS_URL="")
    config = Settings(_env_file=None, DATABASE_URL="postgres://test:test@postgres/test", SECRET_KEY="s" * 64,
                      REDIS_URL="redis://redis:6379/0")
    assert config.SECRET_KEY == "s" * 64


@pytest.mark.asyncio
async def test_startup_retries_schema_before_workers_start():
    order = []

    def initialize():
        order.append("database")
        if len(order) == 1:
            raise RuntimeError("database still starting")

    with patch.object(main, "engine", object()), \
         patch.object(main, "initialize_database", side_effect=initialize), \
         patch.object(main.asyncio, "sleep", new_callable=AsyncMock), \
         patch.object(main, "start_background_workers", side_effect=lambda **_: order.append("background")), \
         patch.object(main, "start_workflow_workers", side_effect=lambda: order.append("workflow")), \
         patch.object(main, "stop_background_workers") as stop_background, \
         patch.object(main, "stop_workflow_workers", new_callable=AsyncMock) as stop_workflow:
        async with main.lifespan(main.app):
            assert order == ["database", "database", "background", "workflow"]
        stop_background.assert_called_once()
        stop_workflow.assert_awaited_once()


@pytest.mark.asyncio
async def test_failed_schema_initialization_prevents_workers_and_readiness():
    with patch.object(main, "engine", object()), \
         patch.object(main, "initialize_database", side_effect=RuntimeError("unavailable")), \
         patch.object(main.asyncio, "sleep", new_callable=AsyncMock), \
         patch.object(main, "start_background_workers") as workers:
        with pytest.raises(RuntimeError, match="refusing to start"):
            async with main.lifespan(main.app):
                pytest.fail("An uninitialized database must not serve requests")
        workers.assert_not_called()


@pytest.mark.asyncio
async def test_missing_database_is_not_ready():
    with patch("app.database.engine", None), patch("app.cache.redis_client", None):
        response = Response()
        result = await main.health_check(response)
    assert response.status_code == 503
    assert result["ready"] is False


@pytest.mark.asyncio
async def test_required_redis_outage_is_not_ready():
    from unittest.mock import MagicMock
    database = MagicMock()
    with patch("app.database.engine", database), patch("app.cache.redis_client", None), \
         patch.object(main.settings, "REDIS_REQUIRED", True):
        response = Response()
        result = await main.health_check(response)
    assert response.status_code == 503
    assert result["services"]["database"] == "healthy"
    assert result["ready"] is False
