"""Isolated Android Studio project build, XML validation, and APK archive endpoint."""

import asyncio
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from ..config import settings
from ..middleware.csrf import require_csrf_token
from ..security.execution_access import execution_user
from ..services.android_runtime import detect_android_capabilities
from ..services.ide_sessions import ide_sessions
from ..services.isolated_runtime import isolation_required
from ..services.runtime_engine import RuntimeEngine

router = APIRouter(prefix="/ide/android", tags=["ide-android"])

MAX_FILES = 80
MAX_TOTAL_CHARS = 400_000
MAX_FILE_CHARS = 100_000
MAX_OUTPUT_CHARS = 80_000
BUILDS_PER_MINUTE = 20
BUILDS_PER_HOUR = 120

_engine = RuntimeEngine()
_recent = defaultdict(deque)
_busy: dict[int, asyncio.Lock] = {}


class AndroidBuildRequest(BaseModel):
    files: dict[str, str]
    task: Literal["compile", "assembleDebug", "clean", "test"] = "assembleDebug"
    package_name: str = Field(default="com.example.myapp", min_length=3, max_length=120)

    @field_validator("files")
    @classmethod
    def validate_files(cls, value: dict[str, str]) -> dict[str, str]:
        if not value or len(value) > MAX_FILES:
            raise ValueError(f"Project must contain between 1 and {MAX_FILES} files.")
        total = 0
        for rel_path, content in value.items():
            if not isinstance(rel_path, str) or not rel_path or len(rel_path) > 240:
                raise ValueError("Invalid project file path.")
            if "\\" in rel_path or rel_path.startswith("/") or "\x00" in rel_path:
                raise ValueError("Project paths must be relative POSIX paths.")
            parts = Path(rel_path).parts
            if not parts or ".." in parts or parts[0] in {"_android_stubs", "_out", "node_modules"}:
                raise ValueError("Invalid directory segment in project file path.")
            if not isinstance(content, str) or len(content) > MAX_FILE_CHARS:
                raise ValueError("Project file exceeds maximum allowed size.")
            total += len(content)
        if total > MAX_TOTAL_CHARS:
            raise ValueError("Total project source size exceeds limit.")
        return value


def _admit(user_id: int) -> None:
    window = _recent[user_id]
    now = time.monotonic()
    while window and now - window[0] > 3600:
        window.popleft()
    if len(window) >= BUILDS_PER_HOUR:
        raise HTTPException(429, f"You have used this hour's {BUILDS_PER_HOUR} Android builds. Try again later.")
    if sum(1 for t in window if now - t <= 60) >= BUILDS_PER_MINUTE:
        raise HTTPException(429, "Too many builds. Wait a few seconds and try again.")
    window.append(now)


def _clip(text: str) -> str:
    clean = str(text or "").replace("\r\n", "\n")
    return clean if len(clean) <= MAX_OUTPUT_CHARS else clean[:MAX_OUTPUT_CHARS] + "\n... output truncated ..."


@router.get("/capabilities")
async def android_capabilities(user=Depends(execution_user)):
    """Report actual compiler/emulator capabilities available in this environment."""
    caps = detect_android_capabilities()
    caps["isolation_mode"] = settings.EXECUTION_ISOLATION
    caps["execution_backend"] = settings.EXECUTION_BACKEND
    caps["worker_isolated"] = isolation_required()
    return caps


@router.post("/build")
async def build_android(
    body: AndroidBuildRequest,
    user=Depends(execution_user),
    csrf: bool = Depends(require_csrf_token),
):
    """Validate XML/manifest and compile project Java files inside the isolated execution boundary."""
    _admit(user.id)
    lock = _busy.setdefault(user.id, asyncio.Lock())
    if lock.locked():
        raise HTTPException(409, "An Android build is already running. Wait for it to finish.")

    entry_code = ""
    for rel_path, content in sorted(body.files.items()):
        if rel_path.endswith((".java", ".kt")):
            entry_code = content
            break

    started = time.monotonic()
    async with lock, ide_sessions.use(user.id):
        result = await _engine.execute(
            code=entry_code,
            language="android",
            project_files=body.files,
            project_config={"task": body.task, "package_name": body.package_name},
        )

    verification = result.verification if isinstance(result.verification, dict) else {}
    logs_text = _clip(result.output or result.error or "")
    logs = [line for line in logs_text.splitlines() if line != ""]
    diagnostics = list(verification.get("diagnostics") or [])
    if not result.success and result.error and not diagnostics:
        diagnostics.append({
            "file": "build",
            "line": 1,
            "column": 1,
            "severity": "error",
            "message": _clip(result.error),
        })

    return {
        "success": bool(result.success),
        "task": body.task,
        "exit_code": int(result.exit_code),
        "duration_ms": int((time.monotonic() - started) * 1000),
        "steps": verification.get("steps") or [],
        "diagnostics": diagnostics,
        "logs": logs,
        "error": _clip(result.error) if not result.success else "",
        "artifact": verification.get("artifact"),
        "capabilities": verification.get("capabilities") or detect_android_capabilities(),
        "compiled_classes": verification.get("compiled_classes") or [],
        "package_name": verification.get("package_name") or body.package_name,
    }
