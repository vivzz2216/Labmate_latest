"""Lab tracks that are switched off on the live site (2026-11-20: Ubuntu, Computer Networks, Power BI, Android Studio).

settings.UNAVAILABLE_LAB_TRACKS lists them. An experiment of an unavailable track is left out at extraction, with a line in the
workflow log, so the rest of the manual still runs and no credit is spent on it; a manual made only of such experiments stops
with a plain message. The Process endpoint refuses them too (workflows extracted before the switch, or edited questions).

Work the student does in an outside tool and documents with their OWN screenshots (an evidence part with upload slots, such
as the Social Media Analytics dashboard part) is not a LabMate-run lab and stays available.
"""
import re

from ..config import settings
from .manual_sections import ManualStructureError

TRACK_LABELS = {
    "ubuntu": "Ubuntu / Linux command labs",
    "networks": "Computer Networks labs (Wireshark, Cisco Packet Tracer)",
    "powerbi": "Power BI labs",
    "android": "Android Studio labs",
}
NETWORK_TITLE = re.compile(r"\b(?:packet\s*tracer|wireshark|gns3|cisco\s+ios|network\s+simulator)\b", re.I)
POWER_BI_TITLE = re.compile(r"\bpower\s*bi\b", re.I)
ANDROID_TITLE = re.compile(r"\bandroid\b", re.I)


class LabsUnavailableError(ManualStructureError):
    """Every experiment in the manual belongs to a lab track that is not available yet."""


def unavailable_tracks():
    raw = str(getattr(settings, "UNAVAILABLE_LAB_TRACKS", "") or "")
    return {part.strip().lower() for part in raw.split(",") if part.strip().lower() in TRACK_LABELS}


def track_unavailable(track):
    return track in unavailable_tracks()


def _title(question):
    return next((line.strip() for line in str(question.get("text") or "").splitlines() if line.strip()), "")


def question_track(question):
    """The restricted track an experiment belongs to, or None."""
    if question.get("studio") in {"wireshark", "packettracer"}:
        return "networks"
    if question.get("kind") == "evidence" and question.get("evidence_slots"):
        return None  # the student's own screenshots of an outside tool
    if str(question.get("language") or "").lower() in {"ubuntu", "unix", "bash", "shell"}:
        return "ubuntu"
    title = _title(question)
    if NETWORK_TITLE.search(title):
        return "networks"
    if POWER_BI_TITLE.search(title):
        return "powerbi"
    if ANDROID_TITLE.search(title):
        return "android"
    return None


def describe(question):
    title = _title(question)
    return title if len(title) <= 90 else title[:87] + "..."


def split_available(questions):
    """(questions that can run, [(question, track)] left out). Raises when nothing can run."""
    blocked_tracks = unavailable_tracks()
    kept, left_out = [], []
    for question in questions or []:
        track = question_track(question)
        if track and track in blocked_tracks:
            left_out.append((question, track))
        else:
            kept.append(question)
    if left_out and not kept:
        labels = sorted({TRACK_LABELS[track] for _, track in left_out})
        raise LabsUnavailableError(
            "This manual only contains " + " and ".join(labels) + ", which are not available on LabMate yet. "
            "Upload a manual with Python, Java, C/C++, SQL, web, notebook or R experiments.")
    return kept, left_out


def left_out_message(left_out):
    if not left_out:
        return ""
    parts = [f"{describe(question)} ({TRACK_LABELS[track]})" for question, track in left_out]
    return " Left out because these labs are not available yet: " + "; ".join(parts) + "."


def blocked_message(questions):
    """For the Process endpoint: a message naming the experiments that cannot run, or ''."""
    blocked = [(question, question_track(question)) for question in questions or []]
    blocked = [(question, track) for question, track in blocked if track and track in unavailable_tracks()]
    if not blocked:
        return ""
    return ("These experiments use labs that are not available yet: "
            + "; ".join(f"{describe(question)} ({TRACK_LABELS[track]})" for question, track in blocked)
            + ". Upload the manual again to process the remaining experiments.")
