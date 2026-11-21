"""Computer Networks studios: the Wireshark-style analyser and the Packet Tracer-style simulator.

The studios in the browser call these endpoints; the engines live in app/netlab and know nothing about the web. Capture files are
parsed in memory and never written to disk. A parsed capture is kept for half an hour under a random token so the page can ask
for packet details and filters without uploading the file again; when the token has expired the page uploads it once more.
"""
import asyncio
import hashlib
import re
import secrets
import threading
import time
from collections import OrderedDict
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ..netlab import live, pkttracer, pt_lab, stats, tools, wireshark_lab
from ..netlab.dfilter import FilterError, apply_filter, check_filter
from ..netlab.dissect import Session
from ..netlab.pcap import CaptureError


def networks_available():
    """The studios are switched off while Computer Networks labs are unavailable (settings.UNAVAILABLE_LAB_TRACKS)."""
    from ..services.lab_availability import TRACK_LABELS, track_unavailable
    if track_unavailable("networks"):
        raise HTTPException(404, TRACK_LABELS["networks"] + " are not available yet.")


router = APIRouter(prefix="/netlab", tags=["netlab"], dependencies=[Depends(networks_available)])

MAX_CAPTURE_BYTES = 8 * 1024 * 1024
SESSION_TTL_SECONDS = 1800
# A whole class opens captures during one lab. Twenty-four sessions in total meant the 25th student evicted the first
# one's capture mid-lab ("no longer open"); bound memory by the capture bytes held instead, and evict the least recently used.
MAX_SESSIONS = 400
MAX_SESSION_BYTES = 256 * 1024 * 1024
_sessions: "OrderedDict[str, tuple]" = OrderedDict()   # token -> (expires, session, source, size)
_sessions_lock = threading.Lock()                      # the sync routes run in worker threads
# Opening a capture needs no sign-in and parsing is CPU work. Without a bound, anyone could keep every worker thread busy
# parsing 8 MB files; a class opening captures together waits briefly for a slot instead of being refused.
PARSE_SLOTS = 2
PARSE_WAIT_SECONDS = 20
_parse_slots = asyncio.Semaphore(PARSE_SLOTS)


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


def _meta(name, data, fmt, note=""):
    return {"name": name, "length": len(data), "sha256": hashlib.sha256(data).hexdigest(), "format": fmt, "source_note": note}


@router.get("/wireshark/samples")
def sample_captures():
    """The sample capture files the analyser can open (File > Open Sample)."""
    return {"note": wireshark_lab.SAMPLE_NOTE,
            "samples": [{"id": key, **value} for key, value in wireshark_lab.SAMPLE_CAPTURES.items()]}


@router.get("/wireshark/fields")
def display_filter_fields():
    """Help > Display Filter Reference: every protocol and field name the display filter accepts."""
    from ..netlab.dfilter import FIELDS, PROTOCOLS
    return {"protocols": sorted(PROTOCOLS), "fields": sorted(FIELDS)}


@router.get("/wireshark/check")
def check_display_filter(expr: str = Query("", max_length=300)):
    """Whether a display filter is valid, for the green/red/yellow filter bar while the student types."""
    return check_filter(expr)


@router.post("/wireshark/open")
async def open_capture(file: Optional[UploadFile] = File(None), scenario: bool = Form(False), sample: str = Form("")):
    """Open the student's .pcap/.pcapng, one of the sample captures, or the Experiment 5 practice capture when none is given."""
    data, name, note = None, "practice-capture.pcap", wireshark_lab.SAMPLE_NOTE
    sample = sample if isinstance(sample, str) else ""          # called directly (tests), the default is FastAPI's Form marker
    if sample:
        if sample not in wireshark_lab.SAMPLE_CAPTURES:
            raise HTTPException(status_code=404, detail="There is no sample capture called %s." % sample)
        name, data = wireshark_lab.sample_bytes(sample)
    elif file is not None and not scenario:
        data = await file.read(MAX_CAPTURE_BYTES + 1)
        if len(data) > MAX_CAPTURE_BYTES:
            raise HTTPException(status_code=413, detail="The capture is larger than 8 MB. Save a shorter capture or apply a capture filter.")
        name, note = re.sub(r"[^A-Za-z0-9._ ()-]", "_", (file.filename or "capture.pcapng"))[-120:], ""
    # Parsing up to 8 MB is CPU work; on the event loop it froze every other request while it ran (and this route is public).
    try:
        await asyncio.wait_for(_parse_slots.acquire(), PARSE_WAIT_SECONDS)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=429, detail="Many captures are being opened right now. Try again in a few seconds.")
    try:
        try:
            session, source, _facts = await asyncio.to_thread(wireshark_lab.load, data)
        except CaptureError as error:
            raise HTTPException(status_code=400, detail=str(error))
        steps, missing = await asyncio.to_thread(wireshark_lab.plan, session)
    finally:
        _parse_slots.release()
    if data is None:
        data = wireshark_lab.sample_bytes("practice")[1]
    session.meta = _meta(name, data, getattr(getattr(session, "capture", None), "format", "pcap"), note)
    return {"token": _remember(session, source, len(data)), "source": source, "total": len(session.packets), "rows": session.rows(),
            "steps": steps, "missing": missing, "interfaces": wireshark_lab.INTERFACES, "file": name, "meta": session.meta}


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


def _numbers(session, which, expr, marked):
    """The packets an export or statistic covers: all, the ones the display filter shows, or the marked ones."""
    if which == "all":
        return None
    if which == "displayed":
        try:
            return apply_filter(session, expr)
        except FilterError as error:
            raise HTTPException(status_code=422, detail=str(error))
    if which == "marked":
        try:
            return sorted({int(n) for n in marked.split(",") if n.strip()})[:20000]
        except ValueError:
            raise HTTPException(status_code=422, detail="Marked packets must be packet numbers.")
    raise HTTPException(status_code=422, detail="Choose all, displayed or marked packets.")


@router.get("/wireshark/{token}/stats/{which}")
def statistics(token: str, which: str, expr: str = Query("", max_length=300), kind: str = Query("ipv4"), marked: int = Query(0, ge=0)):
    """Statistics menu: properties, hierarchy, conversations or endpoints, over the packets the display filter shows."""
    session, _ = _recall(token)
    numbers = _numbers(session, "displayed", expr, "") if expr.strip() else None
    try:
        if which == "properties":
            return stats.capture_properties(session, getattr(session, "meta", {}), numbers, marked)
        if which == "hierarchy":
            return {**stats.protocol_hierarchy(session, numbers), "filter": expr}
        if which == "conversations":
            return {**stats.conversations(session, kind, numbers), "filter": expr}
        if which == "endpoints":
            return {**stats.endpoints(session, kind, numbers), "filter": expr}
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))
    raise HTTPException(status_code=404, detail="Unknown statistic.")


@router.get("/wireshark/{token}/find")
def find_packet(token: str, q: str = Query(..., max_length=300), mode: str = Query("filter"), scope: str = Query("list"),
                after: int = Query(0), backward: bool = Query(False), case: bool = Query(False), expr: str = Query("", max_length=300)):
    """Edit > Find Packet: the next matching packet among those the display filter shows."""
    session, _ = _recall(token)
    numbers = _numbers(session, "displayed", expr, "") if expr.strip() else None
    try:
        hit = tools.find_packet(session, mode, scope, q, after, backward, case, numbers)
    except tools.FindError as error:
        raise HTTPException(status_code=422, detail=str(error))
    return {"found": hit is not None, **(hit or {})}


def _download(data, name, media):
    return Response(content=data, media_type=media, headers={"Content-Disposition": 'attachment; filename="%s"' % name})


def _stem(session):
    name = getattr(session, "meta", {}).get("name", "capture") or "capture"
    return re.sub(r"\.(pcapng|pcap|cap)$", "", name, flags=re.I) or "capture"


@router.get("/wireshark/{token}/export")
def export_packets(token: str, format: str = Query("pcapng"), which: str = Query("all"), expr: str = Query("", max_length=300),
                   marked: str = Query("", max_length=200000)):
    """File > Save As (all packets) and File > Export Specified Packets (displayed or marked packets)."""
    session, _ = _recall(token)
    if format not in ("pcap", "pcapng"):
        raise HTTPException(status_code=422, detail="Save as pcapng or pcap.")
    numbers = _numbers(session, which, expr, marked)
    data = tools.export_capture(session, numbers, format)
    suffix = "" if which == "all" else "-" + which
    return _download(data, "%s%s.%s" % (_stem(session), suffix, format), "application/vnd.tcpdump.pcap")


@router.get("/wireshark/{token}/dissections")
def export_dissections(token: str, format: str = Query("txt"), which: str = Query("displayed"), expr: str = Query("", max_length=300),
                       marked: str = Query("", max_length=200000), details: bool = Query(True), bytes_: bool = Query(False, alias="bytes")):
    """File > Export Packet Dissections as plain text or CSV."""
    session, _ = _recall(token)
    numbers = _numbers(session, which, expr, marked)
    if format == "csv":
        return _download(tools.export_csv(session, numbers).encode("utf-8"), "%s.csv" % _stem(session), "text/csv; charset=utf-8")
    if format == "txt":
        return _download(tools.export_text(session, numbers, details, bytes_).encode("utf-8"), "%s.txt" % _stem(session),
                         "text/plain; charset=utf-8")
    raise HTTPException(status_code=422, detail="Export as txt or csv.")


# ------------------------------------------------------------------------------------------------ live capture
@router.get("/wireshark/capture/interfaces")
def capture_interfaces():
    """The capture interfaces of the machine running the backend, or why live capture is not possible here."""
    return live.list_interfaces()


class CaptureRequest(BaseModel):
    interface: str = Field(..., max_length=300)
    capture_filter: str = Field("", max_length=200)
    max_packets: int = Field(1000, ge=1, le=live.MAX_PACKETS)
    max_seconds: int = Field(60, ge=1, le=live.MAX_SECONDS)


@router.post("/wireshark/capture/start")
def capture_start(request: CaptureRequest):
    try:
        job = live.start(request.interface, request.capture_filter, request.max_packets, request.max_seconds)
    except live.LiveCaptureError as error:
        raise HTTPException(status_code=409, detail=str(error))
    except OSError as error:
        raise HTTPException(status_code=500, detail="The capture tool could not be started: %s" % error)
    return {"job": job.id, "interface": job.interface, "max_seconds": int(job.deadline - job.started)}


@router.get("/wireshark/capture/{job_id}")
def capture_poll(job_id: str, since: int = Query(0, ge=0)):
    """Packets captured so far (rows after `since`), while the capture runs."""
    try:
        job = live.get(job_id)
    except live.LiveCaptureError as error:
        raise HTTPException(status_code=410, detail=str(error))
    running = job.running()
    try:
        capture = job.read()
    except CaptureError as error:
        raise HTTPException(status_code=400, detail=str(error))
    rows = Session(capture).rows()[since:] if capture else []
    return {"running": running, "total": since + len(rows), "rows": rows, "elapsed": round(time.time() - job.started, 1)}


@router.post("/wireshark/capture/{job_id}/stop")
def capture_stop(job_id: str):
    """Stop the capture and open what it recorded like any capture file."""
    try:
        capture, data, error, interface = live.finish(job_id)
    except live.LiveCaptureError as problem:
        raise HTTPException(status_code=410, detail=str(problem))
    if capture is None:
        raise HTTPException(status_code=422, detail=error or "No packets were captured. Generate some traffic (open a web page or ping) and try again.")
    session = Session(capture)
    name = "capture-%s.%s" % (time.strftime("%Y%m%d-%H%M%S"), capture.format)
    session.meta = _meta(name, data, capture.format, "Live capture on %s" % interface)
    steps, missing = wireshark_lab.plan(session)
    return {"token": _remember(session, "uploaded", len(data)), "source": "uploaded", "total": len(session.packets), "rows": session.rows(),
            "steps": steps, "missing": missing, "interfaces": wireshark_lab.INTERFACES, "file": name, "meta": session.meta, "warning": error}


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
