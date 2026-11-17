"""Computer Networks studios: the Wireshark-style analyser and the Packet Tracer-style simulator.

The studios in the browser call these endpoints; the engines live in app/netlab and know nothing about the web. Capture files are
parsed in memory and never written to disk. A parsed capture is kept for half an hour under a random token so the page can ask
for packet details and filters without uploading the file again; when the token has expired the page uploads it once more.
"""
import asyncio
import secrets
import threading
import time
from collections import OrderedDict
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from ..netlab import pkttracer, pt_lab, wireshark_lab
from ..netlab.dfilter import FilterError, apply_filter
from ..netlab.pcap import CaptureError

router = APIRouter(prefix="/netlab", tags=["netlab"])

MAX_CAPTURE_BYTES = 8 * 1024 * 1024
SESSION_TTL_SECONDS = 1800
# A whole class opens captures during one lab. Twenty-four sessions in total meant the 25th student evicted the first
# one's capture mid-lab ("no longer open"); bound memory by the capture bytes held instead, and evict the least recently used.
MAX_SESSIONS = 400
MAX_SESSION_BYTES = 256 * 1024 * 1024
_sessions: "OrderedDict[str, tuple]" = OrderedDict()   # token -> (expires, session, source, size)
_sessions_lock = threading.Lock()                      # the sync routes run in worker threads


def _remember(session, source, size=0):
    now = time.time()
    size = max(int(size), 64 * 1024)
    with _sessions_lock:
        for token in [t for t, (expires, *_rest) in _sessions.items() if expires < now]:
            _sessions.pop(token, None)
        while _sessions and (len(_sessions) >= MAX_SESSIONS
                             or sum(entry[3] for entry in _sessions.values()) + size > MAX_SESSION_BYTES):
            _sessions.popitem(last=False)
        token = secrets.token_urlsafe(12)
        _sessions[token] = (now + SESSION_TTL_SECONDS, session, source, size)
    return token


def _recall(token):
    with _sessions_lock:
        entry = _sessions.get(token)
        if entry is None or entry[0] < time.time():
            _sessions.pop(token, None)
            raise HTTPException(status_code=410, detail="This capture is no longer open. Open the file again.")
        _sessions.move_to_end(token)
    return entry[1], entry[2]


@router.post("/wireshark/open")
async def open_capture(file: Optional[UploadFile] = File(None), scenario: bool = Form(False)):
    """Open the student's .pcap/.pcapng, or LabMate's practice capture when none is given."""
    data = None
    if file is not None and not scenario:
        data = await file.read(MAX_CAPTURE_BYTES + 1)
        if len(data) > MAX_CAPTURE_BYTES:
            raise HTTPException(status_code=413, detail="The capture is larger than 8 MB. Save a shorter capture or apply a capture filter.")
    # Parsing up to 8 MB is CPU work; on the event loop it froze every other request while it ran (and this route is public).
    try:
        session, source, _facts = await asyncio.to_thread(wireshark_lab.load, data)
    except CaptureError as error:
        raise HTTPException(status_code=400, detail=str(error))
    steps, missing = await asyncio.to_thread(wireshark_lab.plan, session)
    return {"token": _remember(session, source, len(data or b"")), "source": source, "total": len(session.packets), "rows": session.rows(), "steps": steps,
            "missing": missing, "interfaces": wireshark_lab.INTERFACES,
            "file": (file.filename if file is not None and not scenario else "practice-capture.pcap")}


@router.get("/wireshark/{token}/packet/{number}")
def packet_detail(token: str, number: int):
    session, _ = _recall(token)
    try:
        return session.detail(number)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error.args[0]))


@router.get("/wireshark/{token}/filter")
def display_filter(token: str, expr: str = Query("", max_length=300)):
    session, _ = _recall(token)
    try:
        numbers = apply_filter(session, expr)
    except FilterError as error:
        raise HTTPException(status_code=422, detail=str(error))
    return {"numbers": numbers, "count": len(numbers)}


@router.get("/wireshark/{token}/stream/{index}")
def follow_stream(token: str, index: int):
    session, _ = _recall(token)
    try:
        return session.stream_text(index)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error.args[0]))


EXPERIMENTS = {"exp7-1": lambda: pt_lab.run_exp7(1), "exp7-2": lambda: pt_lab.run_exp7(2), "exp7-3": lambda: pt_lab.run_exp7(3),
               "exp7-mesh": lambda: pt_lab.run_exp7("mesh"), "exp9": pt_lab.run_exp9}


@router.get("/packettracer/experiments")
def packet_tracer_experiments():
    return [{"id": key, "title": (pt_lab.exp7_spec({"exp7-1": 1, "exp7-2": 2, "exp7-3": 3, "exp7-mesh": "mesh"}[key])["name"]
                                  if key.startswith("exp7") else pt_lab.exp9_spec()["name"])} for key in EXPERIMENTS]


@router.get("/packettracer/run/{experiment}")
def packet_tracer_run(experiment: str):
    if experiment not in EXPERIMENTS:
        raise HTTPException(status_code=404, detail="Unknown experiment.")
    return EXPERIMENTS[experiment]()


class ReplayRequest(BaseModel):
    spec: Dict[str, Any]
    actions: List[Dict[str, Any]] = Field(default_factory=list, max_length=60)


@router.post("/packettracer/replay")
def packet_tracer_replay(request: ReplayRequest):
    spec = request.spec
    devices, links = spec.get("devices", []), spec.get("links", [])
    if not isinstance(devices, list) or not isinstance(links, list):
        raise HTTPException(status_code=422, detail="The topology must list its devices and cables.")
    if len(devices) > 40 or len(links) > 80:
        raise HTTPException(status_code=413, detail="The topology is too large for the practice environment (40 devices, 80 cables).")
    try:
        return pt_lab.replay(spec, request.actions)
    except (pkttracer.TopologyError, KeyError, ValueError) as error:
        raise HTTPException(status_code=422, detail=str(error.args[0]) if error.args else "The topology could not be built.")
