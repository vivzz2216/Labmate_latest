"""Live capture for the packet analyser, through Wireshark's dumpcap or tcpdump on the machine the backend runs on.

It is off unless NETLAB_LIVE_CAPTURE is set, because a capture sees every packet on the chosen interface of that machine: on a
shared server that would be other people's traffic. Nothing is simulated here. When capture is not possible the interface list
is empty and `reason` says why, and the analyser offers to open a capture file instead.
"""
import os
import re
import secrets
import shutil
import subprocess
import tempfile
import threading
import time
from pathlib import Path

from ..config import settings
from .pcap import CaptureError, read_capture

MAX_PACKETS = 5000
MAX_SECONDS = 120
MAX_BYTES = 8 * 1024 * 1024
MAX_JOBS = 2
JOB_TTL_SECONDS = 600
CAPTURE_FILTER = re.compile(r"^[A-Za-z0-9 ._:/()!&|<>=\-\[\]]{0,200}$")   # BPF text: no quotes, no shell metacharacters needed


class LiveCaptureError(RuntimeError):
    pass


def _tool():
    configured = (settings.NETLAB_CAPTURE_TOOL or "").strip()
    if configured:
        return configured if Path(configured).exists() else shutil.which(configured)
    for name in ("dumpcap", "tcpdump"):
        found = shutil.which(name)
        if found:
            return found
    for candidate in (r"C:\Program Files\Wireshark\dumpcap.exe", "/usr/bin/dumpcap", "/usr/sbin/tcpdump"):
        if Path(candidate).exists():
            return candidate
    return None


def _kind(tool):
    return "tcpdump" if "tcpdump" in Path(tool).name.lower() else "dumpcap"


def availability():
    """(tool path or None, reason it cannot be used or "")."""
    if not settings.NETLAB_LIVE_CAPTURE:
        return None, ("Live capture is switched off on this LabMate server, because a capture on a shared server would see other "
                      "people's traffic. Capture on your own computer with Wireshark or tcpdump, save the file, and open it here.")
    tool = _tool()
    if not tool:
        return None, "Neither dumpcap (part of Wireshark) nor tcpdump is installed on the machine running LabMate."
    return tool, ""


_LINE_DUMPCAP = re.compile(r"^\s*(\d+)\.\s+(\S+)(?:\s+\((.*)\))?\s*$")
_LINE_TCPDUMP = re.compile(r"^\s*(\d+)\.(\S+)(?:\s+\((.*?)\))?(?:\s+\[(.*)\])?\s*$")


def list_interfaces():
    """{"available": bool, "reason": str, "tool": str, "interfaces": [{"id", "name", "description", "flags"}]}."""
    tool, reason = availability()
    if not tool:
        return {"available": False, "reason": reason, "tool": "", "interfaces": []}
    try:
        result = subprocess.run([tool, "-D"], capture_output=True, text=True, timeout=15)
    except (OSError, subprocess.TimeoutExpired) as error:
        return {"available": False, "reason": "The capture tool could not be started: %s" % error, "tool": tool, "interfaces": []}
    interfaces = []
    pattern = _LINE_TCPDUMP if _kind(tool) == "tcpdump" else _LINE_DUMPCAP
    for line in (result.stdout or "").splitlines():
        match = pattern.match(line)
        if match:
            groups = match.groups()
            interfaces.append({"id": groups[1], "name": groups[2] or groups[1], "description": groups[2] or "",
                               "flags": groups[3] if len(groups) > 3 and groups[3] else ""})
    if not interfaces:
        message = (result.stderr or "").strip().splitlines()
        return {"available": False, "tool": tool, "interfaces": [],
                "reason": "No capture interfaces were found%s. Capturing usually needs administrator rights or Npcap/libpcap permissions." % (
                    ": " + message[-1] if message else "")}
    return {"available": True, "reason": "", "tool": tool, "interfaces": interfaces}


class _Job:
    def __init__(self, tool, interface, capture_filter, max_packets, max_seconds):
        self.id = secrets.token_urlsafe(10)
        self.interface = interface
        self.capture_filter = capture_filter
        handle, name = tempfile.mkstemp(prefix="labmate-capture-", suffix=".pcapng" if _kind(tool) == "dumpcap" else ".pcap")
        os.close(handle)
        self.path = Path(name)
        self.started = time.time()
        self.deadline = self.started + max_seconds
        if _kind(tool) == "dumpcap":
            command = [tool, "-i", interface, "-w", str(self.path), "-c", str(max_packets), "-a", "duration:%d" % max_seconds,
                       "-a", "filesize:%d" % (MAX_BYTES // 1024), "-q"]
        else:
            command = [tool, "-i", interface, "-U", "-w", str(self.path), "-c", str(max_packets), "-s", "262144"]
        if capture_filter:
            command += ["-f", capture_filter] if _kind(tool) == "dumpcap" else [capture_filter]
        # The tool's messages go to a file: a pipe would block stop() whenever a child process still holds it open.
        self.log = self.path.with_suffix(".log")
        with open(self.log, "wb") as log:
            self.process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=log)
        self.error = ""

    def running(self):
        if self.process.poll() is None and time.time() > self.deadline + 2:
            self.process.terminate()
        return self.process.poll() is None

    def read(self):
        data = self.path.read_bytes()[:MAX_BYTES] if self.path.exists() else b""
        if len(data) < 24:
            return None
        try:
            return read_capture(data)
        except CaptureError as error:
            if "holds no packets" in str(error):
                return None
            raise

    def stop(self):
        if self.process.poll() is None:
            if os.name == "nt":       # end the whole process tree (a wrapper's child would otherwise keep capturing)
                subprocess.run(["taskkill", "/T", "/F", "/PID", str(self.process.pid)], capture_output=True, timeout=15)
            else:
                self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
        text = self.log.read_text(encoding="utf-8", errors="replace").strip() if self.log.exists() else ""
        if "permission" in text.lower() or "denied" in text.lower() or "privilege" in text.lower():
            self.error = text.splitlines()[-1]
        for attempt in range(3):
            try:
                self.log.unlink(missing_ok=True)
                break
            except PermissionError:
                if attempt < 2:
                    time.sleep(0.05)


_jobs = {}
_lock = threading.Lock()


def _expire():
    now = time.time()
    for job_id in [key for key, job in _jobs.items() if now - job.started > JOB_TTL_SECONDS]:
        job = _jobs.pop(job_id)
        job.stop()
        job.path.unlink(missing_ok=True)


def start(interface, capture_filter="", max_packets=1000, max_seconds=60):
    tool, reason = availability()
    if not tool:
        raise LiveCaptureError(reason)
    listed = list_interfaces()
    if interface not in {item["id"] for item in listed["interfaces"]}:
        raise LiveCaptureError("Choose one of the interfaces in the list.")
    capture_filter = (capture_filter or "").strip()
    if not CAPTURE_FILTER.match(capture_filter):
        raise LiveCaptureError("The capture filter contains characters that are not allowed in a capture filter.")
    max_packets = max(1, min(int(max_packets), MAX_PACKETS))
    max_seconds = max(1, min(int(max_seconds), MAX_SECONDS))
    with _lock:
        _expire()
        if len(_jobs) >= MAX_JOBS:
            raise LiveCaptureError("A capture is already running. Stop it first.")
        job = _Job(tool, interface, capture_filter, max_packets, max_seconds)
        _jobs[job.id] = job
    return job


def get(job_id):
    with _lock:
        job = _jobs.get(job_id)
    if job is None:
        raise LiveCaptureError("This capture has finished or expired.")
    return job


def finish(job_id):
    """Stop the capture and return (Capture or None, raw bytes, error text). The temporary file is deleted."""
    with _lock:
        job = _jobs.pop(job_id, None)
    if job is None:
        raise LiveCaptureError("This capture has finished or expired.")
    job.stop()
    try:
        data = job.path.read_bytes()[:MAX_BYTES] if job.path.exists() else b""
        capture = None
        if len(data) >= 24:
            try:
                capture = read_capture(data)
            except CaptureError as error:
                if "holds no packets" not in str(error):
                    job.error = job.error or str(error)
        return capture, data, job.error, job.interface
    finally:
        job.path.unlink(missing_ok=True)
