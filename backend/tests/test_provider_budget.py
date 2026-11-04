"""Tests for shared provider RPM/TPM budgeting, Retry-After backoff, and correctness."""

import asyncio
import time
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base
from app.models import AssignmentWorkflow, Upload, User
from app.services.generation_service import (
    GenerationError,
    GenerationUnavailableError,
    generation_service,
)
from app.services.provider_budget import (
    ProviderBudgetManager,
    account_hash,
    provider_budget,
)


class TestProviderBudget(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mgr = ProviderBudgetManager()
        self.mgr.reset()
        provider_budget.reset()

    def tearDown(self):
        self.mgr.reset()
        provider_budget.reset()

    def test_account_hash_is_one_way_and_safe(self):
        key = "gsk_secret_1234567890abcdef"
        hashed = account_hash(key)
        self.assertNotIn(key, hashed)
        self.assertEqual(len(hashed), 16)
        self.assertEqual(hashed, account_hash(key))
        self.assertEqual(account_hash(""), "none")
        self.assertEqual(account_hash(None), "none")

    async def test_rpm_limit_throttling_and_admission(self):
        with patch.object(settings, "GROQ_RPM_LIMIT", 2), patch.object(
            settings, "PROVIDER_MAX_WAIT_SECONDS", 1.0
        ):
            await self.mgr.acquire("groq", "model-a", "acc1", estimated_tokens=100)
            await self.mgr.acquire("groq", "model-a", "acc1", estimated_tokens=100)

            with self.assertRaises(GenerationUnavailableError) as ctx:
                await self.mgr.acquire("groq", "model-a", "acc1", estimated_tokens=100)
            self.assertIn("rate-limited", str(ctx.exception))
            self.assertIn("retry to resume", str(ctx.exception))

    async def test_tpm_limit_throttles_large_requests(self):
        with patch.object(settings, "GROQ_TPM_LIMIT", 2000), patch.object(
            settings, "PROVIDER_MAX_WAIT_SECONDS", 1.0
        ):
            await self.mgr.acquire("groq", "model-b", "acc1", estimated_tokens=1500)
            with self.assertRaises(GenerationUnavailableError):
                await self.mgr.acquire("groq", "model-b", "acc1", estimated_tokens=1000)

    async def test_retry_after_cooldown_reported_and_honored(self):
        self.mgr.report_rate_limit("groq", "model-c", "acc1", retry_after_seconds=10.0)

        with patch.object(settings, "PROVIDER_MAX_WAIT_SECONDS", 2.0):
            with self.assertRaises(GenerationUnavailableError) as ctx:
                await self.mgr.acquire("groq", "model-c", "acc1")
            self.assertIn("rate-limited", str(ctx.exception))

    async def test_short_wait_sleeps_and_proceeds(self):
        self.mgr.report_rate_limit("groq", "model-d", "acc1", retry_after_seconds=0.1)
        with patch.object(settings, "PROVIDER_MAX_WAIT_SECONDS", 5.0):
            t0 = time.monotonic()
            await self.mgr.acquire("groq", "model-d", "acc1")
            elapsed = time.monotonic() - t0
            self.assertGreaterEqual(elapsed, 0.08)

    async def test_redis_failure_falls_back_to_local_gracefully(self):
        mock_redis = MagicMock()
        mock_redis.pipeline.side_effect = RuntimeError("Redis connection lost")

        with patch("app.services.provider_budget._get_redis", return_value=mock_redis):
            await self.mgr.acquire("gemini", "gemini-flash", "acc1", estimated_tokens=500)

    async def test_cancellation_during_budget_wait(self):
        self.mgr.report_rate_limit("groq", "model-e", "acc1", retry_after_seconds=5.0)
        with patch.object(settings, "PROVIDER_MAX_WAIT_SECONDS", 10.0):
            task = asyncio.create_task(self.mgr.acquire("groq", "model-e", "acc1"))
            await asyncio.sleep(0.01)
            self.assertFalse(task.done())
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task

    async def test_slot_context_manager(self):
        async with self.mgr.slot("groq", "model-f", "acc1", estimated_tokens=100):
            pass


@pytest.mark.asyncio
async def test_no_silent_code_generation_on_ai_error(monkeypatch):
    """Verify that GenerationError does NOT trigger parser_service fallback code generation."""
    from app.services import assignment_workflow
    from app.services.parser_service import parser_service

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    mock_fallback = MagicMock(side_effect=AssertionError("Fallback code generator must NOT be called!"))
    monkeypatch.setattr(parser_service, "_generate_code_from_prompt", mock_fallback)
    monkeypatch.setattr(parser_service, "_generate_ai_answer", mock_fallback)

    monkeypatch.setattr("app.services.assignment_workflow.SessionLocal", lambda: Session())

    async def mock_generate_json(*args, **kwargs):
        raise GenerationError("Model quota depleted or model refusal.")

    monkeypatch.setattr(generation_service, "generate_json", mock_generate_json)

    user = User(
        id=1,
        email="student@example.com",
        name="Test Student",
        password_hash="pw",
        is_active=True,
    )
    db.add(user)

    upload = Upload(
        id=1,
        user_id=1,
        filename="test_lab.docx",
        original_filename="test_lab.docx",
        file_path="dummy.docx",
        file_type="docx",
        file_size=100,
    )
    db.add(upload)

    workflow = AssignmentWorkflow(
        id=1,
        upload_id=upload.id,
        mode="code_only",
        language="python",
        status="queued",
        claim_token="claim-12345",
        lease_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        questions=[{"id": 1, "text": "Write a python program to calculate factorial.", "language": "python"}],
        results=[],
    )
    db.add(workflow)
    db.commit()
    workflow_id = workflow.id

    monkeypatch.setattr(
        "app.services.assignment_workflow.document_text",
        lambda *args, **kwargs: "Lab Manual Document Text",
    )
    monkeypatch.setattr(
        "app.services.assignment_workflow.build_word_report",
        lambda *args, **kwargs: ("dummy_report.docx", "test_report.docx"),
    )
    monkeypatch.setattr("os.path.getsize", lambda *args: 1024)
    monkeypatch.setattr("os.path.isfile", lambda *args: True)

    try:
        await assignment_workflow.process_assignment(workflow_id, claim_token="claim-12345")

        db.close()
        check_db = Session()
        wf = check_db.get(AssignmentWorkflow, workflow_id)

        mock_fallback.assert_not_called()

        results = wf.results or []
        assert len(results) == 1
        assert results[0]["status"] == "failed"
        assert "AI code generation failed" in results[0]["error"]
        assert wf.status == "failed"
        check_db.close()
    finally:
        engine.dispose()
