"""Install visually reviewed report copies into the recovered local workflow DB.

The existing reports and screenshots remain on disk. This is deliberately limited
to the local SQLite recovery database, not a Railway/production database.
"""

import argparse
import json
import shutil
import sqlite3
import uuid
from pathlib import Path
from zipfile import ZipFile

from sqlalchemy.engine import make_url

from app.config import settings
from app.database import SessionLocal
from app.models import AssignmentWorkflow, Report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--verified-dir", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    root = args.verified_dir.resolve()
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    database_url = make_url(settings.DATABASE_URL)
    if database_url.drivername != "sqlite" or not database_url.database:
        raise RuntimeError("This recovery script only supports the local SQLite database.")
    db_path = Path(database_url.database).resolve()
    if not db_path.is_relative_to(Path.cwd().resolve()):
        raise RuntimeError("SQLite database is outside the backend directory.")

    db = SessionLocal()
    changes = []
    for entry in manifest["reports"]:
        workflow = db.get(AssignmentWorkflow, entry["workflow_id"])
        if not workflow or not workflow.report_id:
            raise ValueError(f"Workflow {entry['workflow_id']} has no report.")
        report = db.get(Report, workflow.report_id)
        source = (root / entry["name"]).resolve()
        if not source.is_relative_to(root) or not source.is_file():
            raise FileNotFoundError(source)
        with ZipFile(source) as package:
            if package.testzip() or "word/document.xml" not in package.namelist():
                raise ValueError(f"Invalid Word file: {source}")
        original_by_id = {item["id"]: item for item in workflow.results or []}
        revised = []
        for item in entry["results"]:
            updated = dict(item)
            updated["screenshot_paths"] = list(item.get("screenshot_paths", []))
            prior = original_by_id.get(item["id"])
            for index, raw_path in enumerate(item.get("screenshot_paths", [])):
                path = Path(raw_path).resolve()
                if not path.is_file():
                    raise FileNotFoundError(path)
                if path.is_relative_to(root):
                    target = Path(settings.SCREENSHOT_DIR).resolve() / "verified" / str(workflow.id) / f"q{item['id']}_{index + 1}_{path.name}"
                    updated["screenshot_paths"][index] = str(target)
                elif prior and raw_path in prior.get("screenshot_paths", []):
                    # Keep existing screenshot paths untouched for unchanged questions.
                    continue
                else:
                    raise ValueError(f"Unexpected screenshot path: {path}")
            revised.append(updated)
        destination = Path(settings.REPORT_DIR).resolve() / "workflows" / str(workflow.id) / f"verified_{uuid.uuid4().hex[:8]}_{source.name}"
        changes.append((workflow, report, source, destination, revised, entry))

    print(f"Validated {len(changes)} local report updates.")
    if not args.apply:
        print("Dry run only. Add --apply to activate verified copies.")
        return

    backup_path = root / f"labmate_before_verified_reports_{uuid.uuid4().hex[:8]}.sqlite3"
    with sqlite3.connect(db_path) as source_db, sqlite3.connect(backup_path) as backup_db:
        source_db.backup(backup_db)
    print(f"Database backup: {backup_path}")

    try:
        for workflow, report, source, destination, revised, entry in changes:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
            for item, original in zip(revised, entry["results"]):
                for updated_path, raw_path in zip(item.get("screenshot_paths", []), original.get("screenshot_paths", [])):
                    if updated_path != raw_path:
                        target = Path(updated_path)
                        target.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(raw_path, target)
            report.file_path = str(destination)
            report.file_size = destination.stat().st_size
            workflow.results = revised
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    print("Activated verified reports and evidence in the recovered local app.")


if __name__ == "__main__":
    main()
