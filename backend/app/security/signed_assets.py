"""Short lived bearer links for screenshots already authorized in API responses."""

import hashlib
import hmac
import time
from pathlib import Path
from urllib.parse import quote

from fastapi import HTTPException

from ..config import settings


def screenshot_url(file_path, expires_at=None):
    root = Path(settings.SCREENSHOT_DIR).resolve()
    try:
        relative = Path(file_path).resolve().relative_to(root).as_posix()
    except ValueError:
        raise ValueError("Screenshot must be inside the screenshot directory.") from None
    expires = int(expires_at or time.time() + 3600)
    message = f"{relative}\n{expires}".encode()
    signature = hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()
    return f"/screenshots/{quote(relative, safe='/')}?expires={expires}&signature={signature}"


def verified_screenshot(file_path, expires, signature):
    root = Path(settings.SCREENSHOT_DIR).resolve()
    try:
        relative = Path(file_path)
        path = (root / relative).resolve()
        normalized = path.relative_to(root).as_posix()
        if relative.is_absolute() or normalized != relative.as_posix() or int(expires) < time.time():
            raise ValueError
        expected = hmac.new(settings.SECRET_KEY.encode(), f"{normalized}\n{int(expires)}".encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise ValueError
        if not path.is_file():
            from ..services.storage_service import storage_service
            try:
                storage_service.ensure_local(path)
            except Exception:
                pass
        if not path.is_file():
            raise ValueError
    except (ValueError, TypeError):
        raise HTTPException(404, "Screenshot not found or link expired.") from None
    return path
