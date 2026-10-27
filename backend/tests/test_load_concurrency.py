"""Deterministic Concurrency and Load Testing (20-50 Submissions).

Verifies capacity, queue wait, throughput, peak memory, browser budget admission,
event-loop lag, and DB connection stability without external network or LLM API usage.
"""
import asyncio
import time
import tracemalloc
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base
from app.models import AssignmentWorkflow, Report, Upload, User
from app.monitoring import performance_monitor
from app.services import assignment_workflow as flow
from app.services import workflow_queue as queue
from app.services.resource_budget import browser_capture_budget


@pytest.fixture
def load_db(tmp_path):
    db_file = tmp_path / "load_test.db"
    engine = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"check_same_thread": False, "timeout": 30},
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    with patch.object(queue, "SessionLocal", factory), patch.object(flow, "SessionLocal", factory):
        yield SimpleNamespace(factory=factory, engine=engine)
    engine.dispose()


def seed_submissions(db, count=25):
    """Seed `count` queued workflow submissions."""
    workflow_ids = []
    enqueue_times = {}
    with db.factory() as session:
        for i in range(count):
            user = User(email=f"student{i}@university.edu", name=f"Student {i}")
            session.add(user)
            session.flush()

            upload = Upload(
                user_id=user.id,
                filename=f"assignment_{i}.docx",
                original_filename=f"lab_{i}.docx",
                file_path="dummy.docx",
                file_type="docx",
                file_size=1024,
            )
            session.add(upload)
            session.flush()

            now = datetime.now(timezone.utc)
            wf = AssignmentWorkflow(
                upload_id=upload.id,
                status="queued",
                stage="generate",
                language="python",
                questions=[
                    {
                        "id": 1,
                        "text": f"Question 1: Compute factorial of {i % 10 + 1}",
                        "language": "python",
                    }
                ],
                results=[],
                updated_at=now,
            )
            session.add(wf)
            session.flush()
            workflow_ids.append(wf.id)
            enqueue_times[wf.id] = time.time()
        session.commit()
    return workflow_ids, enqueue_times


@pytest.mark.asyncio
async def test_concurrent_claims_race_condition(load_db):
    """Verify that multiple concurrent workers never claim the same job."""
    workflow_ids, _ = seed_submissions(load_db, count=10)

    claimed_results = []

    def attempt_claim():
        return queue.claim_next()

    async def worker_task():
        # Each worker attempts to claim jobs until queue is empty
        while True:
            c = await asyncio.to_thread(attempt_claim)
            if not c:
                break
            claimed_results.append(c)

    # Launch 6 concurrent workers competing for the 10 jobs
    workers = [asyncio.create_task(worker_task()) for _ in range(6)]
    await asyncio.gather(*workers)

    # All 10 jobs must have been claimed exactly once
    claimed_ids = [c[0] for c in claimed_results]
    claimed_tokens = [c.claim_token for c in claimed_results]

    assert len(claimed_results) == 10
    assert set(claimed_ids) == set(workflow_ids)
    assert len(set(claimed_tokens)) == 10  # All claim tokens are strictly unique


@pytest.mark.asyncio
async def test_load_25_submissions_deterministic(load_db, monkeypatch, tmp_path):
    """
    Simulate 25 student submissions under 2 concurrent workers with deterministic stubs.
    Measures:
    1. Queue wait time
    2. Processing time & throughput
    3. Peak memory usage
    4. Browser budget concurrency enforcement (<= BROWSER_CAPTURE_LOCAL_LIMIT)
    5. Event-loop lag
    6. Database integrity & zero connection errors
    """
    total_jobs = 25
    workflow_ids, enqueue_times = seed_submissions(load_db, count=total_jobs)

    claim_times = {}
    completion_times = {}
    peak_browser_slots = 0

    # Create dummy screenshot and report files so os.path.isfile() passes
    screenshot_file = tmp_path / "test_shot.png"
    screenshot_file.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    report_file = tmp_path / "test_report.docx"
    report_file.write_bytes(b"PK\x03\x04" + b"\x00" * 100)

    # Deterministic document text reader
    monkeypatch.setattr(flow, "document_text", lambda snap: "Lab Manual: Python Functions and Control Flow")

    # Deterministic LLM response stub
    async def mock_generate_json(*args, **kwargs):
        await asyncio.sleep(0.015)  # 15ms simulated deterministic generation
        return {
            "answer": "This calculates factorial in Python.",
            "code": "def factorial(n):\n    return 1 if n <= 1 else n * factorial(n - 1)\nprint('Deterministic Result:', factorial(5))",
            "language": "python",
            "stdin": "",
            "browser_tests": [],
        }

    # Deterministic screenshot stub under browser budget
    async def mock_generate_screenshot(*args, **kwargs):
        nonlocal peak_browser_slots
        async with browser_capture_budget.slot():
            current_slots = browser_capture_budget._in_use
            if current_slots > peak_browser_slots:
                peak_browser_slots = current_slots
            await asyncio.sleep(0.010)  # 10ms simulated capture
            return True, str(screenshot_file), 800, 600

    # Deterministic report builder stub
    def mock_build_word_report(snapshot, report_data):
        return str(report_file), "Lab_Report.docx"

    # Deterministic execution stub
    async def mock_execute_solution(*args, **kwargs):
        return {
            "status": "completed",
            "output": "Deterministic Result: 120",
            "error": "",
            "checks": {"syntax": "passed", "execution": "passed"},
        }

    monkeypatch.setattr(flow.generation_service, "generate_json", mock_generate_json)
    monkeypatch.setattr(flow.screenshot_service, "generate_screenshot", mock_generate_screenshot)
    monkeypatch.setattr(flow, "build_word_report", mock_build_word_report)
    monkeypatch.setattr(flow, "execute_solution", mock_execute_solution)
    monkeypatch.setattr(flow, "capture_source_evidence", AsyncMock(return_value=([], [])))
    monkeypatch.setattr(
        flow,
        "select_evidence",
        lambda plan, candidates: {
            "selected": [
                {
                    "path": str(screenshot_file),
                    "kind": "terminal",
                    "caption": "Captured process transcript",
                }
            ],
            "redundant": [],
            "invalid": [],
            "missing_requirements": [],
        },
    )

    # Start event loop monitoring
    await performance_monitor.start_monitoring(interval=0.1)
    tracemalloc.start()
    start_time = time.time()

    completed_count = 0
    done_event = asyncio.Event()

    async def simulated_worker(worker_id: int):
        nonlocal completed_count
        while not done_event.is_set():
            claimed = await asyncio.to_thread(queue.claim_next)
            if not claimed:
                if completed_count >= total_jobs:
                    break
                await asyncio.sleep(0.02)
                continue

            wf_id = claimed[0]
            claim_times[wf_id] = time.time()

            try:
                await queue.run_claimed(claimed, heartbeat_seconds=5)
                completion_times[wf_id] = time.time()
                completed_count += 1
                if completed_count >= total_jobs:
                    done_event.set()
            except Exception as e:
                completion_times[wf_id] = time.time()
                completed_count += 1
                if completed_count >= total_jobs:
                    done_event.set()

    # Launch 2 concurrent workers (matching default settings.WORKFLOW_WORKERS = 2)
    worker_tasks = [
        asyncio.create_task(simulated_worker(1)),
        asyncio.create_task(simulated_worker(2)),
    ]

    try:
        await asyncio.wait_for(done_event.wait(), timeout=30.0)
    finally:
        done_event.set()
        await asyncio.gather(*worker_tasks, return_exceptions=True)
        await performance_monitor.stop_monitoring()

    total_duration = time.time() - start_time
    current_mem, peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    perf_metrics = performance_monitor.get_metrics()

    # Calculate queue waits and durations
    queue_waits = [
        claim_times[wid] - enqueue_times[wid]
        for wid in workflow_ids
        if wid in claim_times
    ]
    process_durations = [
        completion_times[wid] - claim_times[wid]
        for wid in workflow_ids
        if wid in completion_times and wid in claim_times
    ]

    avg_queue_wait = sum(queue_waits) / len(queue_waits) if queue_waits else 0
    max_queue_wait = max(queue_waits) if queue_waits else 0
    avg_process_time = sum(process_durations) / len(process_durations) if process_durations else 0
    throughput_per_min = (completed_count / total_duration) * 60.0

    print("\n" + "=" * 60)
    print("LOAD TEST CAPACITY METRICS (25 CONCURRENT SUBMISSIONS):")
    print(f"  Total Submissions:     {total_jobs}")
    print(f"  Successfully Completed:{completed_count}/{total_jobs}")
    print(f"  Total Duration:        {total_duration:.2f} s")
    print(f"  Throughput:            {throughput_per_min:.1f} jobs/min")
    print(f"  Avg Queue Wait:        {avg_queue_wait*1000:.1f} ms (max: {max_queue_wait*1000:.1f} ms)")
    print(f"  Avg Processing Time:   {avg_process_time*1000:.1f} ms")
    print(f"  Peak Memory Allocation:{peak_mem / (1024*1024):.2f} MB")
    print(f"  Peak Browser Slots:    {peak_browser_slots} (limit: {settings.BROWSER_CAPTURE_LOCAL_LIMIT})")
    print(f"  Event-Loop Peak Lag:   {perf_metrics['event_loop_lag']['peak_lag_ms']} ms")
    print(f"  Event-Loop Avg Lag:    {perf_metrics['event_loop_lag']['avg_lag_ms']} ms")
    print("=" * 60)

    # Assertions
    assert completed_count == total_jobs
    assert peak_browser_slots <= settings.BROWSER_CAPTURE_LOCAL_LIMIT
    assert peak_browser_slots > 0  # Confirms browser budget was actively exercised
    assert perf_metrics['event_loop_lag']['avg_lag_ms'] < 150.0  # Smooth responsive event loop
    assert perf_metrics['event_loop_lag']['peak_lag_ms'] < 1500.0  # Bounded peak under heavy allocation

    # Verify all 25 rows in database are completed with valid results
    with load_db.factory() as session:
        for wid in workflow_ids:
            row = session.get(AssignmentWorkflow, wid)
            print(f"Workflow {wid} status={row.status} error={row.error}")
            assert row.status == "completed"
            assert len(row.results) == 1
            assert row.claim_token is not None  # Retains audit token
            assert row.lease_expires_at is None  # Lease properly cleared on completion
