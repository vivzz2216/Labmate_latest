"""Durable, bounded workflow consumers. API requests only enqueue database work."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import update
from sqlalchemy.exc import OperationalError

from ..config import settings
from ..database import SessionLocal
from ..models import AssignmentWorkflow
from .assignment_workflow import extract_assignment, process_assignment

logger = logging.getLogger(__name__)
_workers = []


def recover_stale_workflows():
    """Return interrupted work to the queue; completed question results remain intact."""
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=settings.WORKFLOW_STALE_SECONDS)
    with SessionLocal() as db:
        changed = db.execute(
            update(AssignmentWorkflow)
            .where(AssignmentWorkflow.status.in_(("extracting", "processing")),
                   AssignmentWorkflow.updated_at < cutoff)
            .values(status="queued", updated_at=datetime.now(timezone.utc))
        ).rowcount
        db.commit()
        return changed


def claim_next():
    """Compare and swap permits one worker, even across multiple API processes."""
    with SessionLocal() as db:
        candidates = db.query(AssignmentWorkflow.id, AssignmentWorkflow.stage).filter_by(status="queued") \
            .order_by(AssignmentWorkflow.updated_at, AssignmentWorkflow.id).limit(16).all()
        for workflow_id, stage in candidates:
            new_status = "extracting" if stage == "extract" else "processing"
            changed = db.execute(
                update(AssignmentWorkflow).where(AssignmentWorkflow.id == workflow_id,
                                                 AssignmentWorkflow.status == "queued")
                .values(status=new_status, updated_at=datetime.now(timezone.utc))
            ).rowcount
            db.commit()
            if changed:
                return workflow_id, stage
    return None


def release_claim(workflow_id):
    """Immediately requeue a job when its worker shuts down gracefully."""
    with SessionLocal() as db:
        db.execute(update(AssignmentWorkflow)
                   .where(AssignmentWorkflow.id == workflow_id,
                          AssignmentWorkflow.status.in_(("extracting", "processing")))
                   .values(status="queued", updated_at=datetime.now(timezone.utc)))
        db.commit()


async def _heartbeat(workflow_id):
    while True:
        await asyncio.sleep(30)
        try:
            def refresh():
                with SessionLocal() as db:
                    db.execute(update(AssignmentWorkflow)
                               .where(AssignmentWorkflow.id == workflow_id,
                                      AssignmentWorkflow.status.in_(("extracting", "processing")))
                               .values(updated_at=datetime.now(timezone.utc)))
                    db.commit()
            await asyncio.to_thread(refresh)
        except Exception:
            logger.exception("Could not refresh workflow %s lease", workflow_id)


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
            workflow_id, stage = claimed
            heartbeat = asyncio.create_task(_heartbeat(workflow_id))
            try:
                if stage == "extract":
                    await extract_assignment(workflow_id)
                else:
                    await process_assignment(workflow_id)
            except asyncio.CancelledError:
                await asyncio.to_thread(release_claim, workflow_id)
                raise
            finally:
                heartbeat.cancel()
                await asyncio.gather(heartbeat, return_exceptions=True)
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
