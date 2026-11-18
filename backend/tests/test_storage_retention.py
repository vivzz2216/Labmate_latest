"""Storage retention: old, unreferenced files go; anything still in use or recent stays."""
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import (AITask, AIJob, AssignmentWorkflow, Base, Job, Report, Screenshot, Upload, User,
                        WorkflowEvidence)
from app.services import storage_retention
from app.services.storage_retention import run_retention

DAY = 86400


@pytest.fixture
def env(tmp_path, monkeypatch):
    data = tmp_path / "data"
    dirs = {name: data / folder for name, folder in (
        ("UPLOAD_DIR", "uploads"), ("SCREENSHOT_DIR", "screenshots"), ("REPORT_DIR", "reports"),
        ("REACT_TEMP_DIR", "react_temp"))}
    for name, path in dirs.items():
        path.mkdir(parents=True)
        monkeypatch.setattr(settings, name, str(path))
    monkeypatch.setattr(settings, "DATA_DIR", str(data))
    monkeypatch.setattr(settings, "RETENTION_DAYS", 30)
    monkeypatch.setattr(settings, "RETENTION_TEMP_HOURS", 24)
    monkeypatch.setattr(settings, "RETENTION_DRY_RUN", False)
    engine = create_engine("sqlite:///" + (tmp_path / "t.db").as_posix())
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        db.add(User(id=1, email="s@example.test", name="S"))
        db.commit()
    return dirs, factory


def make(path: Path, age_days: float, content: bytes = b"x" * 100) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    stamp = time.time() - age_days * DAY
    os.utime(path, (stamp, stamp))
    return path


def ago(days: float) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def add_upload(db, upload_id: int, path: Path, uploaded_days_ago: float) -> Upload:
    upload = Upload(id=upload_id, user_id=1, filename=path.name, original_filename=path.name,
                    file_path=str(path), file_type="docx", file_size=1, uploaded_at=ago(uploaded_days_ago))
    db.add(upload)
    return upload


def test_old_orphans_go_and_recent_files_stay(env):
    dirs, factory = env
    old_upload = make(dirs["UPLOAD_DIR"] / "old.docx", 45)
    new_upload = make(dirs["UPLOAD_DIR"] / "new.docx", 2)
    old_shot = make(dirs["SCREENSHOT_DIR"] / "web_abc" / "a.png", 31)
    old_report = make(dirs["REPORT_DIR"] / "old_report.docx", 60)

    result = run_retention(session_factory=factory)

    assert not old_upload.exists() and not old_shot.exists() and not old_report.exists()
    assert new_upload.exists()
    assert not (dirs["SCREENSHOT_DIR"] / "web_abc").exists(), "empty folders are tidied"
    assert dirs["SCREENSHOT_DIR"].is_dir(), "the root itself is never removed"
    assert result.files_deleted == 3 and result.bytes_freed == 300 and result.errors == 0


def test_dry_run_deletes_nothing(env):
    dirs, factory = env
    old = make(dirs["UPLOAD_DIR"] / "old.docx", 45)
    result = run_retention(session_factory=factory, dry_run=True)
    assert old.exists()
    assert result.files_deleted == 1 and result.dry_run


def test_files_of_a_recently_active_workflow_are_kept(env):
    """An old manual whose workflow was touched yesterday keeps its manual, report, evidence and screenshots."""
    dirs, factory = env
    manual = make(dirs["UPLOAD_DIR"] / "manual.docx", 90)
    report = make(dirs["REPORT_DIR"] / "workflows" / "7" / "lab.docx", 90)
    stray_in_folder = make(dirs["REPORT_DIR"] / "workflows" / "7" / "older_copy.docx", 90)
    shot = make(dirs["SCREENSHOT_DIR"] / "runtime_x" / "q1.png", 90)
    served = make(dirs["SCREENSHOT_DIR"] / "154" / "s.png", 90)
    evidence = make(dirs["UPLOAD_DIR"] / "evidence" / "canva.png", 90)
    unrelated = make(dirs["SCREENSHOT_DIR"] / "runtime_y" / "q1.png", 90)
    with factory() as db:
        add_upload(db, 1, manual, 90)
        db.add(Report(id=3, upload_id=1, filename="lab.docx", file_path=str(report), file_size=1, created_at=ago(90)))
        db.add(AssignmentWorkflow(id=7, upload_id=1, status="completed", report_id=3, updated_at=ago(1),
                                  results=[{"screenshot_paths": [str(shot)],
                                            "evidence": {"url": "/screenshots/154/s.png?sig=abc"}}]))
        db.add(WorkflowEvidence(workflow_id=7, question_id=1, slot="a", file_path=str(evidence),
                                original_filename="c.png", file_size=1))
        db.commit()

    result = run_retention(session_factory=factory)

    for kept in (manual, report, stray_in_folder, shot, served, evidence):
        assert kept.exists(), kept
    assert not unrelated.exists()
    assert result.files_kept_in_use == 6


def test_busy_workflow_is_kept_even_if_untouched_for_months(env):
    dirs, factory = env
    manual = make(dirs["UPLOAD_DIR"] / "manual.docx", 90)
    with factory() as db:
        add_upload(db, 1, manual, 90)
        db.add(AssignmentWorkflow(id=1, upload_id=1, status="processing", updated_at=ago(90)))
        db.commit()
    run_retention(session_factory=factory)
    assert manual.exists()


def test_old_inactive_workflow_files_are_removed(env):
    dirs, factory = env
    manual = make(dirs["UPLOAD_DIR"] / "manual.docx", 90)
    report = make(dirs["REPORT_DIR"] / "workflows" / "1" / "lab.docx", 90)
    with factory() as db:
        add_upload(db, 1, manual, 90)
        db.add(Report(id=1, upload_id=1, filename="lab.docx", file_path=str(report), file_size=1, created_at=ago(90)))
        db.add(AssignmentWorkflow(id=1, upload_id=1, status="completed", report_id=1, updated_at=ago(60)))
        db.commit()
    run_retention(session_factory=factory)
    assert not manual.exists() and not report.exists()
    with factory() as db:
        assert db.get(Report, 1) is not None, "database rows are kept"


def test_legacy_job_and_ai_task_screenshots_are_kept_while_recent(env):
    dirs, factory = env
    manual = make(dirs["UPLOAD_DIR"] / "legacy.docx", 90)
    job_shot = make(dirs["SCREENSHOT_DIR"] / "5" / "idle.png", 90)
    task_shot = make(dirs["SCREENSHOT_DIR"] / "9" / "task.png", 90)
    with factory() as db:
        add_upload(db, 1, manual, 90)
        db.add(Job(id=5, upload_id=1, task_id=1, question_text="q", code_snippet="c", status="completed",
                   created_at=ago(3), completed_at=ago(3)))
        db.add(Screenshot(job_id=5, file_path=str(job_shot), file_size=1, width=1, height=1))
        db.add(AIJob(id=9, upload_id=1, status="completed", created_at=ago(90)))
        db.add(AITask(job_id=9, task_id="t", task_type="screenshot_request", question_context="q", confidence=90,
                      status="completed", screenshot_path="/screenshots/9/task.png"))
        db.commit()
    run_retention(session_factory=factory)
    assert manual.exists() and job_shot.exists() and task_shot.exists()


def test_symlinks_are_never_followed_or_deleted(env, tmp_path):
    dirs, factory = env
    outside = make(tmp_path / "outside" / "precious.txt", 400)
    os.symlink(outside.parent, dirs["SCREENSHOT_DIR"] / "linked_dir")
    os.symlink(outside, dirs["UPLOAD_DIR"] / "linked_file.docx")
    run_retention(session_factory=factory)
    assert outside.exists()
    assert (dirs["UPLOAD_DIR"] / "linked_file.docx").is_symlink()


def test_database_failure_deletes_nothing(env):
    dirs, _ = env
    old = make(dirs["UPLOAD_DIR"] / "old.docx", 45)

    def broken():
        raise RuntimeError("database down")

    result = run_retention(session_factory=broken)
    assert old.exists() and result.skipped_reason == "database error"


def test_no_database_deletes_nothing(env, monkeypatch):
    dirs, _ = env
    old = make(dirs["UPLOAD_DIR"] / "old.docx", 45)
    monkeypatch.setattr("app.database.SessionLocal", None)
    result = run_retention()
    assert old.exists() and result.skipped_reason == "no database"


def test_invalid_window_deletes_nothing(env, monkeypatch):
    dirs, factory = env
    monkeypatch.setattr(settings, "RETENTION_DAYS", 0)
    fresh = make(dirs["UPLOAD_DIR"] / "today.docx", 0)
    result = run_retention(session_factory=factory)
    assert fresh.exists() and result.skipped_reason


def test_crashed_runtime_scratch_folders_are_removed_but_cache_kept(env):
    dirs, factory = env
    temp = dirs["REACT_TEMP_DIR"]
    stale = make(temp / "labmate_abc" / "main.py", 3).parent
    os.utime(stale, (time.time() - 3 * DAY,) * 2)
    live = make(temp / "labmate_r_live" / "work.R", 0).parent
    cache = make(temp / "runtime_packages" / "python" / "pkg.whl", 300).parent
    result = run_retention(session_factory=factory)
    assert not stale.exists() and live.exists() and cache.exists()
    assert result.temp_dirs_deleted == 1


def test_second_process_skips_while_one_is_sweeping(env):
    pytest.importorskip("fcntl")
    dirs, factory = env
    old = make(dirs["UPLOAD_DIR"] / "old.docx", 45)
    with storage_retention._single_runner(Path(settings.DATA_DIR)) as first:
        assert first
        result = run_retention(session_factory=factory)
    assert old.exists() and result.skipped_reason == "another process is sweeping"


@pytest.mark.asyncio
async def test_background_job_starts_and_stops(env, monkeypatch):
    monkeypatch.setattr(settings, "RETENTION_ENABLED", True)
    monkeypatch.setattr(settings, "RETENTION_START_DELAY_SECONDS", 3600)
    storage_retention.start_retention_job()
    assert storage_retention._task is not None and not storage_retention._task.done()
    await storage_retention.stop_retention_job()
    assert storage_retention._task is None


@pytest.mark.asyncio
async def test_background_job_disabled(env, monkeypatch):
    monkeypatch.setattr(settings, "RETENTION_ENABLED", False)
    storage_retention.start_retention_job()
    assert storage_retention._task is None


def test_server_default_timestamps_count_as_recent(env):
    """Rows stamped by the database clock (naive UTC in SQLite) still protect their files."""
    dirs, factory = env
    manual = make(dirs["UPLOAD_DIR"] / "manual.docx", 90)
    with factory() as db:
        db.add(Upload(id=1, user_id=1, filename="m", original_filename="m", file_path=str(manual),
                      file_type="docx", file_size=1))
        db.commit()
    run_retention(session_factory=factory)
    assert manual.exists()
