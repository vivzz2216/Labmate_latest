"""Bounded batch upload storage and ZIP assembly for durable workflows."""

import json
import os
import re
import tempfile
import uuid
from pathlib import Path
from zipfile import ZIP_DEFLATED, BadZipFile, ZipFile

from ..config import settings
from ..security.validators import sanitize_filename, validate_file_path


async def stage_batch_file(file):
    """Stream one file to isolated storage; return metadata or a safe error."""
    stored = None
    try:
        safe_name = sanitize_filename(file.filename or "")
        extension = Path(safe_name).suffix.lower().lstrip(".")
        if extension not in {"pdf", "docx"}:
            raise ValueError("Only PDF and DOCX files are supported.")
        stored = Path(settings.UPLOAD_DIR) / f"{uuid.uuid4().hex}.{extension}"
        valid, _ = validate_file_path(str(stored), [settings.UPLOAD_DIR])
        if not valid:
            raise ValueError("Upload storage path is invalid.")
        stored.parent.mkdir(parents=True, exist_ok=True)
        total = 0
        header = b""
        with stored.open("wb") as destination:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > settings.MAX_FILE_SIZE:
                    raise ValueError(f"File exceeds the {settings.MAX_FILE_SIZE // (1024 * 1024)} MB limit.")
                if len(header) < 8:
                    header += chunk[:8 - len(header)]
                destination.write(chunk)
        if not total:
            raise ValueError("File is empty.")
        if extension == "pdf" and not header.startswith(b"%PDF-"):
            raise ValueError("The file is not a valid PDF.")
        if extension == "docx":
            try:
                with ZipFile(stored) as package:
                    names = set(package.namelist())
                    if not {"[Content_Types].xml", "word/document.xml"} <= names:
                        raise ValueError("The file is not a valid Word document.")
                    if len(names) > 3000 or sum(info.file_size for info in package.infolist()) > 200 * 1024 * 1024:
                        raise ValueError("The Word document is too large after decompression.")
            except BadZipFile:
                raise ValueError("The file is not a valid Word document.") from None
        os.chmod(stored, 0o600)
        from .storage_service import storage_service
        storage_service.sync_file(stored)
        return {"original_filename": safe_name, "filename": stored.name,
                "file_path": str(stored), "file_type": extension, "file_size": total}, None
    except (ValueError, OSError) as error:
        if stored is not None:
            stored.unlink(missing_ok=True)
        return None, str(error)
    finally:
        await file.close()


def archive_basename(value):
    return re.sub(r"[^A-Za-z0-9._-]", "_", Path(str(value)).name)[:100] or "file"


def contained_file(path, root):
    candidate = Path(path).resolve()
    base = Path(root).resolve()
    if not candidate.is_file():
        from .storage_service import storage_service
        try:
            candidate = storage_service.ensure_local(candidate)
        except Exception:
            pass
    if not candidate.is_file() or not candidate.is_relative_to(base):
        raise ValueError("A report or screenshot is unavailable.")
    return candidate


def create_batch_archive(items):
    """Return a disk-spooled ZIP; caller closes it after streaming."""
    archive = tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024, mode="w+b")
    try:
        with ZipFile(archive, "w", compression=ZIP_DEFLATED, compresslevel=6) as package:
            errors = []
            report_count = 0
            for item in items:
                number = item["position"]
                if item.get("error"):
                    errors.append({"file": item["original_filename"], "error": item["error"]})
                report_path = item.get("report_path")
                if not report_path:
                    continue
                folder = f"{number:02d}_{archive_basename(Path(item['original_filename']).stem)}"
                try:
                    report = contained_file(report_path, settings.REPORT_DIR)
                    package.write(report, f"reports/{folder}/{archive_basename(item['report_filename'])}")
                    report_count += 1
                except (OSError, ValueError):
                    errors.append({"file": item["original_filename"], "error": "Report file is unavailable."})
                    continue
                for index, screenshot_path in enumerate(dict.fromkeys(item.get("screenshots", [])), 1):
                    try:
                        screenshot = contained_file(screenshot_path, settings.SCREENSHOT_DIR)
                        package.write(screenshot, f"screenshots/{folder}/{index:03d}_{archive_basename(screenshot.name)}")
                    except (OSError, ValueError):
                        errors.append({"file": item["original_filename"], "error": f"Screenshot {index} is unavailable."})
            if report_count == 0:
                raise ValueError("No completed reports are available to package.")
            if errors:
                package.writestr("errors.json", json.dumps(errors, indent=2, ensure_ascii=False))
        archive.seek(0)
        return archive
    except Exception:
        archive.close()
        raise


def archive_chunks(archive):
    try:
        while chunk := archive.read(1024 * 1024):
            yield chunk
    finally:
        archive.close()
