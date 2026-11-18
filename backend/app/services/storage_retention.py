"""Delete old uploads, screenshots and reports so the storage volume does not fill.

Safety rules (a file is deleted only when every one holds):
  * it is a regular file (never a symlink) inside UPLOAD_DIR, SCREENSHOT_DIR or REPORT_DIR;
  * it was last modified more than RETENTION_DAYS ago, checked again right before deletion;
  * nothing active in that window refers to it: an upload whose workflow is running or was
    updated, whose jobs ran, whose reports were made, or which was itself uploaded inside the
    window keeps its manual, its reports, its job screenshots, its evidence files, every path
    in its workflow results, and its whole ``reports/workflows/<id>`` folder.

Runtime scratch folders (``labmate_*``, ``labmate_r_*``, ``spark_*`` in REACT_TEMP_DIR) that a
crash left behind are removed after RETENTION_TEMP_HOURS; the package cache is never touched.

Database rows are kept. A download of a removed file already answers 404, and the student can
regenerate the report. If the database cannot be read, nothing is deleted.

Run by hand:  python -m app.services.storage_retention --dry-run
"""
from __future__ import annotations

import argparse
import asyncio
import contextlib
import logging
import os
import shutil
import stat
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable, Iterator

from ..config import settings

logger = logging.getLogger(__name__)

BUSY_WORKFLOW_STATES = {"queued", "extracting", "processing"}
BUSY_JOB_STATES = {"pending", "running"}
TEMP_PREFIXES = ("labmate_", "spark_")
LOCK_NAME = ".storage_retention.lock"
URL_PREFIXES = {"/screenshots/": "SCREENSHOT_DIR", "/reports/": "REPORT_DIR", "/uploads/": "UPLOAD_DIR"}


@dataclass
class SweepResult:
    dry_run: bool
    files_deleted: int = 0
    bytes_freed: int = 0
    files_kept_in_use: int = 0
    temp_dirs_deleted: int = 0
    errors: int = 0
    skipped_reason: str | None = None
    by_root: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return dict(self.__dict__)


def _resolve(path: str | os.PathLike) -> Path | None:
    try:
        return Path(path).resolve()
    except (OSError, RuntimeError, ValueError):
        return None


def _is_within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def _strings(value) -> Iterator[str]:
    """Every string inside a JSON value (workflow results hold screenshot paths in nested lists)."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _strings(item)
    elif isinstance(value, (list, tuple)):
        for item in value:
            yield from _strings(item)


@dataclass
class Protected:
    files: set[Path] = field(default_factory=set)
    folders: set[Path] = field(default_factory=set)

    def add_path(self, value, roots: Iterable[Path]) -> None:
        if not value or not isinstance(value, str) or len(value) > 4096:
            return
        value = value.split("?", 1)[0]
        for prefix, folder in URL_PREFIXES.items():     # "/screenshots/154/x.png" is a served URL
            if value.startswith(prefix):
                value = os.path.join(getattr(settings, folder), value[len(prefix):])
                break
        resolved = _resolve(value)
        if resolved is None:
            return
        if any(_is_within(resolved, root) for root in roots):
            self.files.add(resolved)

    def covers(self, path: Path) -> bool:
        return path in self.files or any(_is_within(path, folder) for folder in self.folders)


def collect_protected(db, cutoff: datetime, roots: list[Path]) -> Protected:
    """Paths still in use: everything tied to an upload that saw any activity since ``cutoff``."""
    from sqlalchemy import or_
    from ..models import (AITask, AIJob, AssignmentWorkflow, Job, Report, Screenshot, Upload,
                          WorkflowEvidence)

    keep = Protected()
    active_uploads: set[int] = set()
    active_uploads.update(row[0] for row in db.query(Upload.id).filter(Upload.uploaded_at >= cutoff))
    active_uploads.update(row[0] for row in db.query(AssignmentWorkflow.upload_id).filter(or_(
        AssignmentWorkflow.status.in_(BUSY_WORKFLOW_STATES), AssignmentWorkflow.updated_at >= cutoff)))
    active_uploads.update(row[0] for row in db.query(Job.upload_id).filter(or_(
        Job.status.in_(BUSY_JOB_STATES), Job.created_at >= cutoff, Job.completed_at >= cutoff)))
    active_uploads.update(row[0] for row in db.query(Report.upload_id).filter(Report.created_at >= cutoff))
    active_uploads.update(row[0] for row in db.query(AIJob.upload_id).filter(or_(
        AIJob.status.in_(BUSY_JOB_STATES), AIJob.created_at >= cutoff)))
    active_uploads.discard(None)

    # AI tasks carry their own screenshot path; keep any that are running or recent.
    for path, urls in db.query(AITask.screenshot_path, AITask.screenshot_urls).filter(or_(
            AITask.status.in_(BUSY_JOB_STATES), AITask.created_at >= cutoff, AITask.updated_at >= cutoff)):
        for text in _strings([path, urls]):
            keep.add_path(text, roots)

    report_root = Path(settings.REPORT_DIR).resolve()
    ids = sorted(active_uploads)
    for start in range(0, len(ids), 500):
        chunk = ids[start:start + 500]
        for (path,) in db.query(Upload.file_path).filter(Upload.id.in_(chunk)):
            keep.add_path(path, roots)
        for (path,) in db.query(Report.file_path).filter(Report.upload_id.in_(chunk)):
            keep.add_path(path, roots)
        for (path,) in (db.query(Screenshot.file_path).join(Job, Screenshot.job_id == Job.id)
                        .filter(Job.upload_id.in_(chunk))):
            keep.add_path(path, roots)
        for path, urls in (db.query(AITask.screenshot_path, AITask.screenshot_urls)
                           .join(AIJob, AITask.job_id == AIJob.id).filter(AIJob.upload_id.in_(chunk))):
            for text in _strings([path, urls]):
                keep.add_path(text, roots)
        workflows = db.query(AssignmentWorkflow).filter(AssignmentWorkflow.upload_id.in_(chunk)).all()
        for workflow in workflows:
            keep.folders.add(report_root / "workflows" / str(workflow.id))
            for blob in (workflow.results, workflow.questions, workflow.agent_plan):
                for text in _strings(blob):
                    keep.add_path(text, roots)
            if workflow.report_id:
                for (path,) in db.query(Report.file_path).filter(Report.id == workflow.report_id):
                    keep.add_path(path, roots)
        workflow_ids = [workflow.id for workflow in workflows]
        if workflow_ids:
            for (path,) in db.query(WorkflowEvidence.file_path).filter(WorkflowEvidence.workflow_id.in_(workflow_ids)):
                keep.add_path(path, roots)
    return keep


def _old_files(root: Path, cutoff_ts: float) -> Iterator[tuple[Path, int]]:
    for folder, dirs, files in os.walk(root, followlinks=False):
        # The lock file and dot folders belong to the app, not to students.
        dirs[:] = [name for name in dirs if not name.startswith(".")]
        for name in files:
            if name.startswith("."):
                continue
            path = Path(folder) / name
            try:
                info = path.lstat()
            except OSError:
                continue
            if stat.S_ISREG(info.st_mode) and info.st_mtime < cutoff_ts:
                yield path, info.st_size


def _remove_empty_folders(root: Path) -> None:
    for folder, dirs, files in os.walk(root, topdown=False, followlinks=False):
        current = Path(folder)
        if current == root or current.is_symlink():
            continue
        with contextlib.suppress(OSError):
            current.rmdir()          # only succeeds when empty


def _newest_mtime(folder: Path) -> float:
    newest = folder.lstat().st_mtime
    for current, dirs, files in os.walk(folder, followlinks=False):
        for name in dirs + files:
            with contextlib.suppress(OSError):
                newest = max(newest, (Path(current) / name).lstat().st_mtime)
    return newest


def _sweep_temp(result: SweepResult, now: float, dry_run: bool) -> None:
    root = _resolve(settings.REACT_TEMP_DIR)
    if root is None or not root.is_dir():
        return
    cutoff_ts = now - max(1, settings.RETENTION_TEMP_HOURS) * 3600
    for entry in root.iterdir():
        if not entry.name.startswith(TEMP_PREFIXES) or entry.is_symlink() or not entry.is_dir():
            continue
        try:
            if _newest_mtime(entry) >= cutoff_ts:
                continue
            if not dry_run:
                shutil.rmtree(entry)
            result.temp_dirs_deleted += 1
        except OSError as exc:
            result.errors += 1
            logger.warning("Retention could not remove scratch folder %s: %s", entry.name, exc)


@contextlib.contextmanager
def _single_runner(data_dir: Path):
    """Only one process sharing the volume sweeps at a time. Yields False if another holds it."""
    try:
        import fcntl
    except ImportError:          # Windows development machines run one process
        yield True
        return
    data_dir.mkdir(parents=True, exist_ok=True)
    with open(data_dir / LOCK_NAME, "a+") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            yield False
            return
        try:
            yield True
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def run_retention(*, dry_run: bool | None = None, now: float | None = None, session_factory=None) -> SweepResult:
    dry_run = settings.RETENTION_DRY_RUN if dry_run is None else dry_run
    now = time.time() if now is None else now
    result = SweepResult(dry_run=dry_run)
    days = int(settings.RETENTION_DAYS)
    if days < 1:
        result.skipped_reason = "RETENTION_DAYS must be at least 1"
        logger.error("Storage retention skipped: %s", result.skipped_reason)
        return result
    if session_factory is None:
        from ..database import SessionLocal
        session_factory = SessionLocal
    if session_factory is None:
        result.skipped_reason = "no database"
        logger.warning("Storage retention skipped: no database, so files in use cannot be identified")
        return result

    roots = [r for r in (_resolve(d) for d in (settings.UPLOAD_DIR, settings.SCREENSHOT_DIR, settings.REPORT_DIR)) if r]
    data_dir = _resolve(settings.DATA_DIR) or Path(settings.DATA_DIR)
    with _single_runner(data_dir) as acquired:
        if not acquired:
            result.skipped_reason = "another process is sweeping"
            return result
        cutoff_ts = now - days * 86400
        cutoff = datetime.fromtimestamp(cutoff_ts, tz=timezone.utc)
        try:
            db = session_factory()
            try:
                keep = collect_protected(db, cutoff, roots)
            finally:
                db.close()
        except Exception:
            # Unknown in-use set: deleting anything could break a student's report.
            logger.exception("Storage retention skipped: could not read which files are in use")
            result.skipped_reason = "database error"
            return result

        for root in roots:
            if not root.is_dir() or root == Path(root.anchor):
                continue
            freed = deleted = 0
            for path, size in _old_files(root, cutoff_ts):
                resolved = _resolve(path)
                if resolved is None or not _is_within(resolved, root):
                    continue
                if keep.covers(resolved):
                    result.files_kept_in_use += 1
                    continue
                try:
                    info = path.lstat()       # re-check: a writer may have touched it since the walk
                    if not stat.S_ISREG(info.st_mode) or info.st_mtime >= cutoff_ts:
                        continue
                    if not dry_run:
                        path.unlink()
                    deleted += 1
                    freed += size
                except FileNotFoundError:
                    continue
                except OSError as exc:
                    result.errors += 1
                    logger.warning("Retention could not delete %s: %s", path, exc)
            if not dry_run:
                _remove_empty_folders(root)
            result.by_root[root.name] = {"files": deleted, "bytes": freed}
            result.files_deleted += deleted
            result.bytes_freed += freed

        _sweep_temp(result, now, dry_run)

    logger.info("Storage retention %s: %s files (%.1f MB), %s scratch folders, %s kept in use, %s errors",
                "dry run" if dry_run else "done", result.files_deleted, result.bytes_freed / 1024 ** 2,
                result.temp_dirs_deleted, result.files_kept_in_use, result.errors)
    return result


_task: asyncio.Task | None = None


async def _loop() -> None:
    await asyncio.sleep(max(0, settings.RETENTION_START_DELAY_SECONDS))
    while True:
        try:
            await asyncio.to_thread(run_retention)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Storage retention run failed")
        await asyncio.sleep(max(0.25, float(settings.RETENTION_INTERVAL_HOURS)) * 3600)


def start_retention_job() -> None:
    global _task
    if not settings.RETENTION_ENABLED or (_task and not _task.done()):
        return
    _task = asyncio.create_task(_loop(), name="storage-retention")


async def stop_retention_job() -> None:
    global _task
    if _task is None:
        return
    _task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await _task
    _task = None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="list counts without deleting")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO)
    result = run_retention(dry_run=args.dry_run or None)
    print(result.as_dict())
    return 1 if result.skipped_reason else 0


if __name__ == "__main__":
    raise SystemExit(main())
