"""Priority 1: durable claim tokens fence every worker write.

These tests reproduce the verified stale-worker overwrite: worker A claims a job, its lease
expires, recovery requeues it, worker B claims it and saves results, and A must NOT be able
to write, heartbeat, release, fail, publish a report or settle credits afterwards.

Database fencing does not make external execution exactly-once: A may still finish a compiler
run or provider request that was already in flight. It simply loses every durable write.
"""
import asyncio
import threading
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base
from app.models import AssignmentWorkflow, CreditWallet, Report, Upload, User, WorkflowCreditHold
from app.services import assignment_workflow as flow
from app.services import workflow_queue as queue
from app.workflow_schema import ensure_workflow_columns


@pytest.fixture
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'claims.db'}", connect_args={"check_same_thread": False, "timeout": 30})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    with patch.object(queue, "SessionLocal", factory), patch.object(flow, "SessionLocal", factory):
        yield SimpleNamespace(factory=factory, engine=engine)
    engine.dispose()


def seed(db, count=1, stage="generate", status="queued", results=None, email="claims@example.com"):
    ids = []
    with db.factory() as session:
        for number in range(count):
            user = User(email=f"{number}-{email}", name="Claim Student")
            session.add(user); session.flush()
            upload = Upload(user_id=user.id, filename="lab.docx", original_filename="lab.docx",
                            file_path="unused", file_type="docx", file_size=1)
            session.add(upload); session.flush()
            workflow = AssignmentWorkflow(
                upload_id=upload.id, status=status, stage=stage, results=results or [], language="auto",
                questions=[{"id": 1, "text": "Write a Python program to add 2 and 3 and print the sum.", "language": "python"}])
            session.add(workflow); session.flush()
            ids.append(workflow.id)
        session.commit()
    return ids


def row(db, workflow_id):
    with db.factory() as session:
        return session.get(AssignmentWorkflow, workflow_id)


def expire_lease(db, workflow_id):
    with db.factory() as session:
        item = session.get(AssignmentWorkflow, workflow_id)
        item.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=5)
        session.commit()


def takeover(db, workflow_id, results):
    """Original worker went stale: recovery requeues, worker B claims and saves results."""
    expire_lease(db, workflow_id)
    assert queue.recover_stale_workflows() == 1
    second = queue.claim_next()
    assert second is not None and second[0] == workflow_id
    with db.factory() as session:
        item = session.get(AssignmentWorkflow, workflow_id)
        item.results = results
        session.commit()
    return second


# --------------------------------------------------------------------------- claims

def test_claim_issues_a_durable_token_and_lease_and_still_unpacks_as_a_pair(db):
    (workflow_id,) = seed(db, stage="generate")
    claimed = queue.claim_next()
    identifier, stage = claimed
    assert (identifier, stage) == (workflow_id, "generate") and claimed == (workflow_id, "generate")
    assert claimed.claim_token and len(claimed.claim_token) >= 32
    stored = row(db, workflow_id)
    assert stored.claim_token == claimed.claim_token and stored.status == "processing"
    assert stored.lease_expires_at is not None


def test_concurrent_claims_never_hand_one_job_to_two_workers(db):
    ids = set(seed(db, count=40))
    won, errors, gate = [], [], threading.Barrier(8)

    def worker():
        try:
            gate.wait()
            while True:
                job = queue.claim_next()
                if job is None:
                    return
                won.append(job)
        except Exception as error:  # pragma: no cover - failure detail is asserted below
            errors.append(repr(error))

    threads = [threading.Thread(target=worker) for _ in range(8)]
    [thread.start() for thread in threads]
    [thread.join(60) for thread in threads]
    assert not errors, errors
    assert sorted(job[0] for job in won) == sorted(ids)
    assert len({job.claim_token for job in won}) == len(ids)


# --------------------------------------------------------------------------- recovery / lease

def test_recovery_ignores_live_leases_but_requeues_expired_ones_and_keeps_checkpoints(db):
    (workflow_id,) = seed(db, results=[{"id": 1, "status": "completed"}])
    first = queue.claim_next()
    with db.factory() as session:  # an old updated_at must not outrank a valid lease
        session.get(AssignmentWorkflow, workflow_id).updated_at = datetime.now(timezone.utc) - timedelta(hours=2)
        session.commit()
    assert queue.recover_stale_workflows() == 0
    assert row(db, workflow_id).claim_token == first.claim_token
    expire_lease(db, workflow_id)
    assert queue.recover_stale_workflows() == 1
    recovered = row(db, workflow_id)
    assert recovered.status == "queued" and recovered.claim_token != first.claim_token
    assert recovered.results == [{"id": 1, "status": "completed"}]


def test_legacy_row_without_a_lease_falls_back_to_updated_at(db):
    (workflow_id,) = seed(db, status="processing")
    with db.factory() as session:
        session.get(AssignmentWorkflow, workflow_id).updated_at = datetime.now(timezone.utc) - timedelta(hours=1)
        session.commit()
    assert queue.recover_stale_workflows() == 1


def test_original_worker_loses_heartbeat_release_and_failure_after_recovery(db):
    (workflow_id,) = seed(db)
    first = queue.claim_next()
    assert queue.refresh_lease(workflow_id, first.claim_token) is True
    second = takeover(db, workflow_id, [{"id": 1, "status": "completed", "code": "B"}])
    assert queue.refresh_lease(workflow_id, first.claim_token) is False
    assert queue.release_claim(workflow_id, first.claim_token) is False
    assert queue.fail_claim(workflow_id, first.claim_token, "A crashed") is False
    current = row(db, workflow_id)
    assert (current.status, current.claim_token, current.error) == ("processing", second.claim_token, None)
    assert queue.refresh_lease(workflow_id, second.claim_token) is True
    assert queue.release_claim(workflow_id, second.claim_token) is True
    assert row(db, workflow_id).status == "queued"


def test_a_job_that_moved_to_a_later_stage_is_not_mistaken_for_a_lost_lease(db):
    (workflow_id,) = seed(db)
    claim = queue.claim_next()
    with db.factory() as session:  # extract finished and queued generation; token still ours
        session.get(AssignmentWorkflow, workflow_id).status = "queued"
        session.commit()
    assert queue.refresh_lease(workflow_id, claim.claim_token) is True


# --------------------------------------------------------------------------- fenced writes

def test_stale_record_cannot_overwrite_the_new_workers_results(db):
    (workflow_id,) = seed(db)
    first = queue.claim_next()
    with db.factory() as session:
        stale = session.get(AssignmentWorkflow, workflow_id)  # worker A's in-memory copy
        takeover(db, workflow_id, [{"id": 1, "status": "completed", "code": "B-result"}])
        with flow.claim_scope(workflow_id, first.claim_token):
            stale.results = [{"id": 1, "status": "failed", "code": "A-overwrite"}]
            with pytest.raises(flow.WorkflowClaimLost):
                flow.record(stale, session, "generate", 99, "A is still running")
    saved = row(db, workflow_id)
    assert saved.results == [{"id": 1, "status": "completed", "code": "B-result"}]
    assert saved.progress != 99 and not saved.logs


def test_owner_record_still_commits_and_extends_the_lease(db):
    (workflow_id,) = seed(db)
    claim = queue.claim_next()
    expire_lease(db, workflow_id)
    queue.recover_stale_workflows()  # recovered then reclaimed by the same logical worker
    claim = queue.claim_next()
    with db.factory() as session:
        item = session.get(AssignmentWorkflow, workflow_id)
        before = item.lease_expires_at
        with flow.claim_scope(workflow_id, claim.claim_token):
            flow.record(item, session, "execute", 55, "owner write")
    saved = row(db, workflow_id)
    assert saved.progress == 55 and saved.stage == "execute" and saved.logs[-1]["message"] == "owner write"
    assert saved.lease_expires_at is not None and before is not None


# --------------------------------------------------------------------------- end-to-end stale process_assignment

def _patch_run(stack, db, generate):
    stack.enter_context(patch.object(settings, "EXECUTION_ALLOWED_EMAILS", ""))
    stack.enter_context(patch("app.services.assignment_workflow.document_text", return_value="Programming lab"))
    stack.enter_context(patch("app.services.assignment_workflow.generation_service.generate_json", generate))
    execute = AsyncMock(side_effect=AssertionError("a fenced worker must not continue to execution"))
    stack.enter_context(patch("app.services.assignment_workflow.execute_solution", execute))
    return execute


@pytest.mark.asyncio
async def test_stale_process_assignment_loses_writes_report_and_credit_settlement(db):
    from contextlib import ExitStack
    (workflow_id,) = seed(db, status="queued", stage="generate")
    first = queue.claim_next()
    seen = {}
    solution = {"answer": "Adds numbers.", "code": "print(2+3)", "language": "python", "stdin": "", "browser_tests": []}

    async def generate(instructions, content, schema, on_retry=None):
        if schema is flow.ANSWER_SCHEMA and "second" not in seen:  # worker A is mid-generation when it goes stale
            seen["second"] = takeover(db, workflow_id, [{"id": 1, "status": "completed", "code": "B-result", "screenshot_paths": []}])
        return solution

    with ExitStack() as stack:
        stack.enter_context(patch.object(settings, "BILLING_ENABLED", True))
        stack.enter_context(patch.object(settings, "RAZORPAY_MODE", "test"))
        stack.enter_context(patch.object(settings, "BILLING_TRIAL_CREDITS", 3))
        execute = _patch_run(stack, db, generate)
        with pytest.raises(flow.WorkflowClaimLost):
            await flow.process_assignment(workflow_id, claim_token=first.claim_token)
    execute.assert_not_awaited()
    saved = row(db, workflow_id)
    assert saved.results[0]["code"] == "B-result"
    assert saved.claim_token == seen["second"].claim_token and saved.status == "processing"
    assert saved.report_id is None and saved.error is None
    with db.factory() as session:
        assert session.query(Report).count() == 0
        hold = session.query(WorkflowCreditHold).one()
        assert hold.state == "held"  # the stale worker must not settle B's reservation
        assert session.query(CreditWallet).one().reserved == hold.amount


@pytest.mark.asyncio
async def test_owner_can_still_settle_credits_exactly_once_after_a_pause(db):
    from contextlib import ExitStack
    from app.services.generation_service import GenerationUnavailableError
    (workflow_id,) = seed(db, status="queued", stage="generate")
    claim = queue.claim_next()
    with ExitStack() as stack:
        stack.enter_context(patch.object(settings, "BILLING_ENABLED", True))
        stack.enter_context(patch.object(settings, "RAZORPAY_MODE", "test"))
        stack.enter_context(patch.object(settings, "BILLING_TRIAL_CREDITS", 3))
        _patch_run(stack, db, AsyncMock(side_effect=GenerationUnavailableError("provider paused")))
        await flow.process_assignment(workflow_id, claim_token=claim.claim_token)
        saved = row(db, workflow_id)
        assert saved.status == "paused" and "provider paused" in saved.error
        with db.factory() as session:
            assert session.query(WorkflowCreditHold).one().state == "settled"
            wallet = session.query(CreditWallet).one()
            assert (wallet.balance, wallet.reserved) == (3, 0)  # nothing completed, nothing charged


@pytest.mark.asyncio
async def test_unclaimed_direct_callers_keep_working(db):
    from app.services.generation_service import GenerationUnavailableError
    (workflow_id,) = seed(db, status="processing", stage="generate")
    from contextlib import ExitStack
    with ExitStack() as stack:
        _patch_run(stack, db, AsyncMock(side_effect=GenerationUnavailableError("outage")))
        await flow.process_assignment(workflow_id)
    assert row(db, workflow_id).status == "paused"


# --------------------------------------------------------------------------- worker supervision

@pytest.mark.asyncio
async def test_heartbeat_stops_a_worker_that_lost_its_lease_without_touching_the_new_owner(db):
    (workflow_id,) = seed(db, stage="generate")
    first = queue.claim_next()
    started, finished = asyncio.Event(), asyncio.Event()

    async def long_job(identifier, claim_token=None):
        started.set()
        try:
            await asyncio.sleep(30)
        finally:
            finished.set()

    async def scenario():
        with patch.object(queue, "process_assignment", long_job):
            run = asyncio.create_task(queue.run_claimed(first, heartbeat_seconds=0.05))
            await started.wait()
            second = await asyncio.to_thread(takeover, db, workflow_id, [{"id": 1, "status": "completed"}])
            await asyncio.wait_for(run, 5)
            return second

    second = await scenario()
    assert finished.is_set()
    current = row(db, workflow_id)
    assert (current.status, current.claim_token) == ("processing", second.claim_token)
    assert current.results == [{"id": 1, "status": "completed"}]


@pytest.mark.asyncio
async def test_shutdown_cancellation_releases_only_its_own_claim_and_keeps_checkpoints(db):
    (workflow_id,) = seed(db, stage="generate", results=[{"id": 1, "status": "completed"}])
    claim = queue.claim_next()
    started = asyncio.Event()

    async def long_job(identifier, claim_token=None):
        started.set()
        await asyncio.sleep(30)

    with patch.object(queue, "process_assignment", long_job):
        run = asyncio.create_task(queue.run_claimed(claim, heartbeat_seconds=30))
        await started.wait()
        run.cancel()
        with pytest.raises(asyncio.CancelledError):
            await run
    saved = row(db, workflow_id)
    assert saved.status == "queued" and saved.results == [{"id": 1, "status": "completed"}]
    assert queue.claim_next().claim_token != claim.claim_token


@pytest.mark.asyncio
async def test_unexpected_failure_marks_only_the_owned_claim_failed(db):
    (workflow_id,) = seed(db, stage="generate")
    claim = queue.claim_next()
    with patch.object(queue, "process_assignment", AsyncMock(side_effect=RuntimeError("boom"))):
        await queue.run_claimed(claim, heartbeat_seconds=30)
    saved = row(db, workflow_id)
    assert saved.status == "failed" and "unexpectedly" in saved.error


# --------------------------------------------------------------------------- migration

def test_migration_adds_claim_columns_idempotently_and_retains_rows(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE assignment_workflows (id INTEGER PRIMARY KEY, upload_id INTEGER, "
                                    "status VARCHAR, results JSON)"))
            connection.execute(text("INSERT INTO assignment_workflows (id, upload_id, status, results) "
                                    "VALUES (7, 1, 'processing', '[{\"id\": 1}]')"))
        ensure_workflow_columns(engine)
        ensure_workflow_columns(engine)
        columns = {c["name"] for c in inspect(engine).get_columns("assignment_workflows")}
        assert {"claim_token", "lease_expires_at"} <= columns
        with engine.connect() as connection:
            kept = connection.execute(text("SELECT status, results, claim_token, lease_expires_at "
                                           "FROM assignment_workflows WHERE id = 7")).one()
        assert kept == ("processing", '[{"id": 1}]', None, None)
    finally:
        engine.dispose()
