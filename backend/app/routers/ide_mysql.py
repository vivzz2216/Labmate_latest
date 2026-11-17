"""Run the MySQL command-line replica against a real MySQL server.

The replica used to answer with its own small SQL interpreter in the browser. Each statement typed into it is now sent here and
executed by MySQL itself, inside a private schema (the same isolated session the lab pipeline uses: restricted account, no system
schemas, no administrative statements, query deadline). One session per signed-in account is kept between statements so that
USE, transactions, views, triggers and session variables behave like a real connection, and is dropped after IDLE_SECONDS.
"""
import asyncio
import os
import re
import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..middleware.csrf import require_csrf_token
from ..security.execution_access import execution_user
from ..services.sql_runtime import SQLSession

router = APIRouter(prefix="/ide/mysql", tags=["ide-mysql"])

MAX_STATEMENT_CHARS = 20_000
STATEMENTS_PER_MINUTE = 60
IDLE_SECONDS = 20 * 60
# Each session holds a MySQL connection and private schemas; raise with the MySQL server's capacity (max_connections).
MAX_SESSIONS = int(os.getenv("MYSQL_IDE_MAX_SESSIONS", "40"))
# When every slot is taken, a session idle this long gives its slot to a new student instead of the newcomer being refused.
RECLAIM_IDLE_SECONDS = 10 * 60

# SQLSTATE for the errors students meet most; the client prints it as ERROR 1062 (23000).
SQLSTATE = {
    1007: "HY000", 1008: "HY000", 1044: "42000", 1045: "28000", 1046: "3D000", 1048: "23000", 1049: "42000", 1050: "42S01",
    1051: "42S02", 1054: "42S22", 1060: "42S21", 1061: "42000", 1062: "23000", 1064: "42000", 1065: "42000", 1067: "42000",
    1068: "42000", 1072: "42000", 1075: "42000", 1091: "42000", 1093: "HY000", 1100: "HY000", 1105: "HY000", 1109: "42S02",
    1111: "HY000", 1136: "21S01", 1146: "42S02", 1166: "42000", 1169: "23000", 1170: "42000", 1171: "42000",
    1215: "HY000", 1216: "23000", 1217: "23000", 1226: "42000", 1227: "42000", 1241: "21000", 1242: "21000", 1247: "42S22",
    1264: "22003", 1265: "01000", 1292: "22007", 1305: "42000", 1317: "70100", 1318: "42000", 1319: "42000", 1328: "HY000",
    1329: "02000", 1349: "HY000", 1356: "HY000", 1359: "HY000", 1360: "HY000", 1364: "HY000", 1366: "HY000", 1396: "HY000",
    1406: "22001", 1415: "0A000", 1422: "HY000", 1451: "23000", 1452: "23000", 1471: "HY000", 1557: "23000", 1630: "42000",
    1644: "45000", 1690: "22003", 1701: "42000", 1706: "42000", 1822: "HY000", 3105: "HY000", 3819: "HY000", 3140: "22032",
}

_sessions = {}          # user id -> (SQLSession, last used)
_recent = defaultdict(deque)
_locks = {}


class MysqlStatementInput(BaseModel):
    statement: str = Field(min_length=1, max_length=MAX_STATEMENT_CHARS)


def _admit(user_id):
    window = _recent[user_id]
    now = time.monotonic()
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= STATEMENTS_PER_MINUTE:
        raise HTTPException(429, "Too many statements. Wait a few seconds and try again.")
    window.append(now)


def _expire():
    """Forget idle sessions and return them; closing one drops schemas over the network, so callers do it off the loop."""
    now = time.monotonic()
    stale = []
    for user_id, (session, used) in list(_sessions.items()):
        if now - used > IDLE_SECONDS:
            _sessions.pop(user_id, None)
            stale.append(session)
    return stale


def _reclaim_idle_slot():
    """Free the slot of the session idle longest, if it has been idle RECLAIM_IDLE_SECONDS; return it for closing."""
    now = time.monotonic()
    idle = [(used, user_id) for user_id, (_session, used) in _sessions.items()
            if now - used > RECLAIM_IDLE_SECONDS and not (_locks.get(user_id) and _locks[user_id].locked())]
    if not idle:
        return None
    _used, user_id = min(idle)
    return _sessions.pop(user_id)[0]


def _close_all(sessions):
    for session in sessions:
        try:
            session.close()
        except Exception:
            pass


def _logical(text, session):
    """Show the student's own database name, not the private schema the server really created."""
    text = str(text or "")
    for logical, physical in sorted(session.schema_map.items(), key=lambda item: -len(item[1])):
        text = text.replace(physical, logical)
    return text


def _run(session, statement):
    started = time.perf_counter()
    result = session.execute(statement)
    result["elapsed"] = time.perf_counter() - started
    return result


def _shape(result, session):
    if result.get("success"):
        out = {
            "success": True,
            "type": result.get("type"),
            "columns": [_logical(c, session) for c in result.get("columns") or []],
            "rows": result.get("display_rows"),
            "numeric": result.get("numeric"),
            "affected": result.get("rowcount", 0),
            "info": _logical(result.get("info", ""), session),
            "elapsed": round(result.get("elapsed", 0.0), 2),
            "database": session.active_schema,
            "truncated": bool(result.get("truncated")),
        }
        if out["rows"] is None and result.get("columns"):
            out["rows"] = [[None if v is None else str(v) for v in (row.get(c) for c in result["columns"])] for row in result.get("rows") or []]
            out["numeric"] = [False] * len(out["columns"])
        return out
    code = result.get("error_code")
    text = result.get("error_text") or re.sub(r"^Error:\s*", "", str(result.get("message") or result.get("error") or "error"))
    return {"success": False, "error_code": code or 1105, "sqlstate": SQLSTATE.get(code, "HY000"), "error": _logical(text, session),
            "elapsed": round(result.get("elapsed", 0.0), 2), "database": session.active_schema}


@router.post("/execute")
async def execute(body: MysqlStatementInput, user=Depends(execution_user), csrf: bool = Depends(require_csrf_token)):
    """Execute one statement on this account's MySQL session and return the rows or the error the server produced."""
    _admit(user.id)
    stale = _expire()
    if stale:
        await asyncio.to_thread(_close_all, stale)
    lock = _locks.setdefault(user.id, asyncio.Lock())
    async with lock:
        entry = _sessions.get(user.id)
        if entry is None:
            if len(_sessions) >= MAX_SESSIONS:
                reclaimed = _reclaim_idle_slot()
                if reclaimed is None:
                    raise HTTPException(503, "The MySQL practice server is busy. Try again in a few minutes.")
                await asyncio.to_thread(_close_all, [reclaimed])
            try:
                session = await asyncio.to_thread(SQLSession)
            except Exception:
                raise HTTPException(503, "The MySQL server is not reachable right now.")
        else:
            session = entry[0]
        _sessions[user.id] = (session, time.monotonic())
        result = await asyncio.to_thread(_run, session, body.statement)
        return _shape(result, session)


@router.post("/reset")
async def reset(user=Depends(execution_user), csrf: bool = Depends(require_csrf_token)):
    """Drop this account's session and its private databases (exit, or start over)."""
    lock = _locks.setdefault(user.id, asyncio.Lock())
    async with lock:
        entry = _sessions.pop(user.id, None)
        if entry:
            await asyncio.to_thread(entry[0].close)
    return {"ok": True}
