"""Run Java on the real JDK for the Eclipse and IntelliJ IDE replicas.

The replicas used to interpret Java in the browser with a small subset of the language. Their Run button now calls this endpoint, which
compiles and runs the program through the same bounded runtime as the lab pipeline (isolated workspace, heap and CPU limits,
timeouts, isolated worker when configured). Only signed-in accounts that are allowed to execute code can use it; each account runs
one program at a time, at most RUNS_PER_MINUTE per minute and RUNS_PER_HOUR per hour. On Railway a student's runs share one kept
sandbox (services/ide_sessions.py), so repeat runs take seconds and do not spend the hourly Railway API allowance.
"""
import asyncio
import re
import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..middleware.csrf import require_csrf_token
from ..security.execution_access import execution_user
from ..services.ide_sessions import ide_sessions
from ..services.runtime_engine import RuntimeEngine, java_class_name

router = APIRouter(prefix="/ide/java", tags=["ide-java"])

MAX_CODE_CHARS = 100_000
MAX_STDIN_CHARS = 20_000
MAX_OUTPUT_CHARS = 60_000
RUNS_PER_MINUTE = 12
RUNS_PER_HOUR = 60

_engine = RuntimeEngine()
_recent = defaultdict(deque)          # user id -> times of recent runs
_busy = {}                            # user id -> asyncio.Lock


class JavaRunInput(BaseModel):
    code: str = Field(min_length=1, max_length=MAX_CODE_CHARS)
    stdin: str = Field(default="", max_length=MAX_STDIN_CHARS)


def clean_messages(text, class_name):
    """javac messages without the server's temporary directory in front of the file name."""
    text = re.sub(r"(?:[A-Za-z]:)?[^\s:\"']*[\\/](?=[\w$]+\.java:\d+)", "", str(text or ""))
    text = re.sub(r"^Compilation error:\s*", "", text)
    return text.strip("\n")


def clip(text):
    text = str(text or "").replace("\r\n", "\n")      # Windows javac/java end lines with CRLF; clients expect LF
    return text if len(text) <= MAX_OUTPUT_CHARS else text[:MAX_OUTPUT_CHARS] + "\n... output truncated ..."


def admit(user_id):
    window = _recent[user_id]
    now = time.monotonic()
    while window and now - window[0] > 3600:
        window.popleft()
    if len(window) >= RUNS_PER_HOUR:
        minutes = max(1, round((3600 - (now - window[0])) / 60))
        raise HTTPException(429, f"You have used this hour's {RUNS_PER_HOUR} runs. Try again in about {minutes} minute"
                                 f"{'s' if minutes != 1 else ''}.")
    if sum(1 for t in window if now - t <= 60) >= RUNS_PER_MINUTE:
        raise HTTPException(429, "Too many runs. Wait a few seconds and try again.")
    window.append(now)


async def run_editor_program(user_id, code, language, stdin):
    admit(user_id)
    lock = _busy.setdefault(user_id, asyncio.Lock())
    if lock.locked():
        raise HTTPException(409, "A program is already running. Wait for it to finish.")
    async with lock, ide_sessions.use(user_id):
        return await _engine.execute(code, language=language, stdin=stdin)


@router.post("/run")
async def run_java(body: JavaRunInput, user=Depends(execution_user), csrf: bool = Depends(require_csrf_token)):
    """Compile and run one Java source file; stdout and stderr stay separate, and a program's output before an exception is kept."""
    name = java_class_name(body.code)
    if not name:
        return {"phase": "compile", "success": False, "stdout": "", "stderr": "error: no class declaration found", "exit_code": 1,
                "class_name": "", "duration_ms": 0}
    started = time.monotonic()
    result = await run_editor_program(user.id, body.code, "java", body.stdin)
    stages = result.stages or {}
    compile_failed = stages.get("compile") == "failed" or str(result.error).startswith("Compilation error")
    return {"phase": "compile" if compile_failed else "run", "success": bool(result.success), "stdout": clip(result.output),
            "stderr": clip(clean_messages(result.error, name)), "exit_code": result.exit_code, "class_name": name,
            "duration_ms": int((time.monotonic() - started) * 1000)}
