"""Durable, bounded workflow consumers. API requests only enqueue database work.

Ownership: ``claim_next`` issues a random claim token and a lease. Heartbeats, progress,
checkpoints, terminal status, claim release and failure marking all require the *current*
token, enforced by a conditional UPDATE in the database. Recovery and release replace the token,
so a worker that went stale (but is still running) loses write authority and is cancelled at its
next heartbeat. This fences durable writes only; it does not make external side effects such as a
compiler run or a provider request exactly-once.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.exc import OperationalError

from ..config import settings
from ..database import SessionLocal
from ..models import AssignmentWorkflow
from .assignment_workflow import WorkflowClaimLost, extract_assignment, process_assignment

logger = logging.getLogger(__name__)
_workers = []
ACTIVE_STATUSES = ("extracting", "processing")


class ClaimedJob(tuple):
    """``(workflow_id, stage)`` pair that also carries the fencing ``claim_token``."""

    def __new__(cls, workflow_id, stage, claim_token):
        job = super().__new__(cls, (workflow_id, stage))
        job.claim_token = claim_token
        return job


def _now():
    return datetime.now(timezone.utc)


def _lease_end(now):
    return now + timedelta(seconds=settings.WORKFLOW_STALE_SECONDS)


def recover_stale_workflows():
    """Return interrupted work to the queue; completed question results remain intact.

    A claim with a lease is stale only once that lease has expired. Rows written before leases
    existed fall back to ``updated_at``. Each row is requeued with a fresh token so the previous
    worker, if it is still alive, can no longer write.
    """
    now = _now()
    cutoff = now - timedelta(seconds=settings.WORKFLOW_STALE_SECONDS)
    lease = AssignmentWorkflow.lease_expires_at
    expired = or_(and_(lease.is_not(None), lease < now),
                  and_(lease.is_(None), AssignmentWorkflow.updated_at < cutoff))
    recovered = 0
    with SessionLocal() as db:
        stale_ids = db.execute(select(AssignmentWorkflow.id)
                               .where(AssignmentWorkflow.status.in_(ACTIVE_STATUSES), expired)).scalars().all()
        for workflow_id in stale_ids:
            recovered += db.execute(
                update(AssignmentWorkflow)
                .where(AssignmentWorkflow.id == workflow_id,
                       AssignmentWorkflow.status.in_(ACTIVE_STATUSES), expired)
                .values(status="queued", claim_token="recovered-" + uuid.uuid4().hex,
                        lease_expires_at=None, updated_at=now)
            ).rowcount
        db.commit()
    return recovered


def claim_next():
    """Compare and swap permits one worker, even across multiple API processes."""
    with SessionLocal() as db:
        candidates = db.query(AssignmentWorkflow.id, AssignmentWorkflow.stage).filter_by(status="queued") \
            .order_by(AssignmentWorkflow.updated_at, AssignmentWorkflow.id).limit(16).all()
        for workflow_id, stage in candidates:
            new_status = "extracting" if stage == "extract" else "processing"
            now = _now()
            token = uuid.uuid4().hex
            changed = db.execute(
                update(AssignmentWorkflow).where(AssignmentWorkflow.id == workflow_id,
                                                 AssignmentWorkflow.status == "queued")
                .values(status=new_status, claim_token=token, lease_expires_at=_lease_end(now), updated_at=now)
            ).rowcount
            db.commit()
            if changed:
                return ClaimedJob(workflow_id, stage, token)
    return None


def refresh_lease(workflow_id, claim_token):
    """Extend our lease. False means another worker (or recovery) now owns the job."""
    now = _now()
    with SessionLocal() as db:
        changed = db.execute(
            update(AssignmentWorkflow)
            .where(AssignmentWorkflow.id == workflow_id, AssignmentWorkflow.claim_token == claim_token,
                   AssignmentWorkflow.status.in_(ACTIVE_STATUSES))
            .values(updated_at=now, lease_expires_at=_lease_end(now))
        ).rowcount
        if changed:
            db.commit()
            return True
        owner = db.execute(select(AssignmentWorkflow.claim_token)
                           .where(AssignmentWorkflow.id == workflow_id)).scalar_one_or_none()
        db.rollback()
    # Our own job may have legitimately advanced to a non-active stage (e.g. queued for generation).
    return owner == claim_token


def release_claim(workflow_id, claim_token):
    """Immediately requeue a job when its worker shuts down gracefully. No-op if no longer owned."""
    with SessionLocal() as db:
        changed = db.execute(
            update(AssignmentWorkflow)
            .where(AssignmentWorkflow.id == workflow_id, AssignmentWorkflow.claim_token == claim_token,
                   AssignmentWorkflow.status.in_(ACTIVE_STATUSES))
            .values(status="queued", claim_token=None, lease_expires_at=None, updated_at=_now())
        ).rowcount
        db.commit()
    return changed == 1


def fail_claim(workflow_id, claim_token, message):
    """Mark an owned, still-active job failed. A stale worker cannot fail a newer worker's job."""
    with SessionLocal() as db:
        changed = db.execute(
            update(AssignmentWorkflow)
            .where(AssignmentWorkflow.id == workflow_id, AssignmentWorkflow.claim_token == claim_token,
                   AssignmentWorkflow.status.in_(ACTIVE_STATUSES))
            .values(status="failed", error=func.coalesce(AssignmentWorkflow.error, message),
                    lease_expires_at=None, updated_at=_now())
        ).rowcount
        db.commit()
    return changed == 1


async def _heartbeat(workflow_id, claim_token, job, lost, interval):
    """Keep the lease alive; stop the job as soon as ownership is lost."""
    while True:
        await asyncio.sleep(interval)
        try:
            owned = await asyncio.to_thread(refresh_lease, workflow_id, claim_token)
        except Exception:
            logger.exception("Could not refresh workflow %s lease", workflow_id)
            continue
        if not owned:
            lost.set()
            logger.error("Workflow %s lease was taken over; stopping this worker's job", workflow_id)
            job.cancel()
            return


async def run_claimed(claim, heartbeat_seconds=None):
    """Run one claimed job under lease supervision."""
    workflow_id, stage = claim
    token = claim.claim_token
    interval = heartbeat_seconds or settings.WORKFLOW_HEARTBEAT_SECONDS
    lost = asyncio.Event()
    runner = extract_assignment if stage == "extract" else process_assignment
    job = asyncio.create_task(runner(workflow_id, claim_token=token))
    heartbeat = asyncio.create_task(_heartbeat(workflow_id, token, job, lost, interval))
    try:
        await job
    except WorkflowClaimLost:
        logger.error("Workflow %s was reclaimed while this worker ran; its writes were discarded", workflow_id)
    except asyncio.CancelledError:
        current = asyncio.current_task()
        shutting_down = getattr(current, "cancelling", lambda: 0)() > 0
        if lost.is_set() and not shutting_down:
            return  # Heartbeat stopped a worker that no longer owns the job; nothing to release.
        job.cancel()
        await asyncio.gather(job, return_exceptions=True)
        await asyncio.to_thread(release_claim, workflow_id, token)
        raise
    except Exception as exc:
        logger.exception("Workflow %s failed during %s stage: %s", workflow_id, stage, exc)
        try:
            await asyncio.to_thread(fail_claim, workflow_id, token, "Processing failed unexpectedly. Please retry.")
        except Exception:
            logger.exception("Could not mark failed workflow %s", workflow_id)
    finally:
        heartbeat.cancel()
        await asyncio.gather(heartbeat, return_exceptions=True)


async def worker_loop(worker_id):
    last_recovery = asyncio.get_running_loop().time()
    while True:
        try:
            claimed = await asyncio.to_thread(claim_next)
            if not claimed:
                now = asyncio.get_running_loop().time()
                if now - last_recovery >= 60:
                    await asyncio.to_thread(recover_stale_workflows)
                    last_recovery = now
                await asyncio.sleep(.25)
                continue
            await run_claimed(claimed)
        except asyncio.CancelledError:
            raise
        except OperationalError:
            logger.warning("Workflow queue is busy; worker %s will retry", worker_id)
            await asyncio.sleep(.5)
        except Exception:
            logger.exception("Workflow worker %s failed", worker_id)
            await asyncio.sleep(.5)


def start_workflow_workers():
    if SessionLocal is None or _workers:
        return
    recovered = recover_stale_workflows()
    if recovered:
        logger.warning("Recovered %s interrupted workflows", recovered)
    for worker_id in range(max(0, settings.WORKFLOW_WORKERS)):
        _workers.append(asyncio.create_task(worker_loop(worker_id)))


async def stop_workflow_workers():
    for worker in _workers:
        worker.cancel()
    if _workers:
        await asyncio.gather(*_workers, return_exceptions=True)
    _workers.clear()


async def run_worker_process():
    """Run a dedicated consumer when WORKFLOW_WORKERS=0 on web instances."""
    await asyncio.to_thread(recover_stale_workflows)
    await asyncio.gather(*(worker_loop(number) for number in range(max(1, settings.WORKFLOW_WORKERS))))


if __name__ == "__main__":
    asyncio.run(run_worker_process())
