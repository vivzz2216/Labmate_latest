"""Computer Networks experiments inside the report workflow: recognising them in an uploaded manual and building each part.

A manual that is about Wireshark or about Packet Tracer (hubs and switches, or routers with RIP) is not a programming
assignment, so it is not sent through the language model. It becomes a few "studio" parts, one per scenario. Each part is built by
the Python engines in app/netlab (packet decoder, network simulator) and its screenshots are taken in LabMate's own practice studios;
every sentence of the report is generated from what those engines computed, so the written observations always agree with the
screenshots. The parts are labelled as practice-environment results (the studios carry a visible banner in every image).
"""
import asyncio
import logging
import os
import re
import uuid

from ..config import settings
from ..netlab import pt_lab, wireshark_lab
from ..netlab.pcap import CaptureError

logger = logging.getLogger(__name__)

CAPTURE_SLOT = "wireshark_pcap"
CAPTURE_LABEL = "Your Wireshark capture (.pcap or .pcapng) - optional"

PT7_SCENARIOS = {1: ("exp7-1", "Scenario 1: Star topology using a hub"), 2: ("exp7-2", "Scenario 2: Star topology using a switch"),
                 3: ("exp7-3", "Scenario 3: Bus topology using a hub")}
PT7_MESH = ("exp7-mesh", "Post-experimental exercise: Mesh topology using a hub and switches")
PT9 = ("exp9", "Three routers with RIP dynamic routing")
PRACTICALS = {
    "switched ipv4 lan": "switched-lan",
    "static routing": "static-routing",
    "vlan isolation": "vlan-isolation",
    "dhcp address assignment": "dhcp-lan",
    "wireless access point": "wireless-ssid",
}
POWERBI_PRACTICALS = {
    "sales dashboard": "sales-dashboard",
    "data cleaning": "clean-sales",
    "table relationships": "relationships",
    "dax measures": "dax-measures",
    "interactive report": "region-slicer",
}
ANDROID_PRACTICALS = {
    "greeting application": "greeting",
    "two activity navigation": "navigation",
    "simple calculator": "calculator",
    "student registration form": "registration",
    "persistent counter": "counter",
}


def _part(number, title, studio, args, text, slots=()):
    part = {"id": number, "text": text, "language": "theory", "is_theory": True, "kind": "evidence", "part_title": title[:120],
            "studio": studio, "studio_args": dict(args)}
    if slots:
        part["evidence_slots"] = [{"id": slot_id, "label": label} for slot_id, label in slots]
    return part


def detect_network_lab(manual_text, strict=False):
    """Question parts for a Wireshark or Packet Tracer manual, or None when the manual is something else.

    strict (one experiment's own text, see network_parts_for): the three-router exercise is used only when the experiment
    asks for RIP routing, so a different Packet Tracer lab (one router, two subnets) is not swapped for it.
    """
    text = str(manual_text or "")
    low = text.lower()
    heading = next((line for line in text.splitlines() if re.match(r"^\s*experiment\s+\d+\s*:", line, re.I)), "")
    title = heading.partition(":")[2].strip()
    if re.search(r"^\s*laboratory\s*:\s*(?:cisco\s+)?packet tracer\s*$", low, re.M) and title.lower() in PRACTICALS:
        return [_part(1, title, "packettracer", {"experiment": PRACTICALS[title.lower()]}, text)]
    if re.search(r"^\s*laboratory\s*:\s*power\s+bi\s*$", low, re.M) and title.lower() in POWERBI_PRACTICALS:
        return [_part(1, title, "powerbi", {"experiment": POWERBI_PRACTICALS[title.lower()]}, text)]
    if re.search(r"^\s*laboratory\s*:\s*android\s+studio\s*$", low, re.M) and title.lower() in ANDROID_PRACTICALS:
        return [_part(1, title, "android", {"experiment": ANDROID_PRACTICALS[title.lower()]}, text)]
    focused = re.search(r"^\s*laboratory\s*:\s*wireshark\s*$", low, re.M)
    if focused:
        for pattern, topic in [
            (r"\barp\s+and\s+icmp\b", "arp-icmp"), (r"\btcp handshake\b", "tcp-handshake"),
            (r"\bdns query\b", "dns"), (r"\bhttp request\b", "http"), (r"\budp\b.*\btcp\b", "tcp-udp"),
        ]:
            if re.search(pattern, title, re.I):
                return [_part(1, title, "wireshark", {"experiment": topic}, text, [(CAPTURE_SLOT, CAPTURE_LABEL)])]
    if low.count("wireshark") >= 3 and re.search(r"\bpackets?\b", low) and not re.search(r"packet\s+tracer", low):
        return [_part(1, "Introduction to Wireshark and traffic analysis", "wireshark", {},
                      "Capture and analyse ARP, ICMP, DNS, TCP and HTTP traffic with Wireshark, attach each screenshot the manual lists with a brief "
                      "explanation, and answer the post-experimental questions about the Ethernet and ARP frames.", [(CAPTURE_SLOT, CAPTURE_LABEL)])]
    if "packet tracer" in low:
        scenarios = [number for number in (1, 2, 3) if re.search(r"scenario\s*%d\b" % number, low)]
        if scenarios and "hub" in low and "switch" in low:
            parts = [_part(n, PT7_SCENARIOS[number][1], "packettracer", {"experiment": PT7_SCENARIOS[number][0]},
                           "Implement %s in Packet Tracer, use Simulation mode with the Event List Filters the manual names, and comment on how the "
                           "devices processed the ARP and ICMP packets." % PT7_SCENARIOS[number][1].split(":", 1)[0].lower())
                     for n, number in enumerate(scenarios, 1)]
            if "mesh" in low:
                parts.append(_part(len(parts) + 1, PT7_MESH[1], "packettracer", {"experiment": PT7_MESH[0]},
                                   "Post-experimental exercise: implement a mesh topology using a hub and switches."))
            return parts
        if len(re.findall(r"\brouters?\b", low)) >= 3 and (not strict or re.search(r"\brip(?:v2)?\b", low)):
            return [_part(1, PT9[1], "packettracer", {"experiment": PT9[0]},
                          "Design a network of three routers, configure the interfaces and RIP dynamic routing, test with Simple PDUs, then disable one "
                          "router-to-router link and show the path the network chooses.")]
    return None


# ------------------------------------------------------------------------------------------------ the written procedures
def network_parts_for(questions):
    """Replace only the experiments that are themselves a Wireshark or Packet Tracer exercise LabMate builds.

    A whole-document check used to turn any manual mentioning Packet Tracer and routers into one built-in exercise, dropping
    every other experiment (a 3-experiment networks manual and a 21-experiment mixed manual, 2026-11-20 audit). Each
    experiment is now checked on its own text; the rest stay as they are. Returns (questions renumbered from 1, replaced count).
    """
    out, replaced = [], 0
    for question in questions:
        parts = None if question.get("studio") else detect_network_lab(question.get("text", ""), strict=True)
        if parts:
            replaced += 1
            out.extend(parts)
        else:
            out.append(question)
    if not replaced:
        return questions, 0  # keep the manual's own experiment numbers
    return [{**item, "id": index} for index, item in enumerate(out, 1)], replaced


def experiment_heading_count(text):
    """Distinct 'Experiment N' headings in a document (a networks manual is recognised as a whole only when there is one)."""
    from .manual_sections import HEADING
    return len({match.group(1).upper() for line in str(text or "").splitlines() if (match := HEADING.match(line))})


def _pt7_procedure(experiment, spec):
    devices = spec["devices"]
    kinds = {d["type"] for d in devices}
    pcs = [d["name"] for d in devices if d["type"] == "pc"]
    hubs = [d["name"] for d in devices if d["type"] == "hub"]
    switches = [d["name"] for d in devices if d["type"] == "switch"]
    middle = ", ".join(switches + hubs)
    lines = ["1. Opened Cisco Packet Tracer and placed %d computers (%s) and the %s (%s) from the device palette." % (
        len(pcs), ", ".join(pcs), "hub and switches" if hubs and switches else "switch" if switches else "hub" + ("s" if len(hubs) > 1 else ""), middle)]
    cables = "Connected the devices with straight-through cables, because they join dissimilar devices"
    if len(hubs) > 1 or len(switches) > 1:
        cables += ", and used crossover cables between the hubs/switches themselves"
    lines.append("2. %s. Waited until every link light turned green%s." % (
        cables, " (the switch takes a while to bring its ports up)" if switches else ""))
    lines.append("3. Entered the IP addresses and subnet mask of the table below in the IP Configuration of each computer.")
    if experiment == "exp7-1":
        lines += ["4. Switched to Simulation mode and, in the Event List Filters, enabled only ARP.",
                  "5. Used Add Simple PDU to send a ping, played it with Capture/Forward and watched how the hub handled the ARP packets; then repeated this "
                  "for the pings listed in the manual (cases a, b and c)."]
    elif "pc" in kinds:
        lines += ["4. Switched to Simulation mode and, in the Event List Filters, enabled only ICMP and ARP.",
                  "5. Used Add Simple PDU for each ping of the scenario and played the simulation with Capture/Forward, noting how the %s processed the "
                  "ICMP and ARP packets." % ("switch" if switches else "hubs")]
    return "\n".join(lines)


def _pt9_procedure():
    return "\n".join([
        "1. Started Packet Tracer and placed three routers, a switch and one computer for each router, and connected them as in Figure 1 "
        "(routers to each other, each router to its switch and each switch to its computer).",
        "2. Powered each router off and on in the Physical tab, then in the Config tab chose each interface in turn and entered its IP address "
        "and subnet mask (the table below lists them).",
        "3. Opened the routing table (magnifying glass tool) of a router: it held only the directly connected networks, marked C.",
        "4. In the RIP section of the Config tab entered the networks each router is attached to, so the routers learn the other networks "
        "from their neighbours.",
        "5. Gave every computer its IP address, subnet mask and default gateway, then tested the network with Simple PDUs between computers "
        "on different networks.",
        "6. Post-experimental exercise: disabled one router-to-router link and sent the Simple PDU again to see which path the network chose."])


def _wireshark_note(source):
    return ("Note: no capture file was attached, so this report uses LabMate's practice capture (a fictitious computer, the practice host "
            "login.labmate.test and a made-up student login); the screenshots show the LabMate practice analyser, not Wireshark itself."
            if source == "scenario" else "")


_ASSUMPTIONS = {
    "exp7-1": [],
    "exp7-2": ["The IP table lists PC0 to PC2; the three computers of this scenario (PC3, PC4 and PC5) used the same three addresses in that order."],
    "exp7-3": ["The bus topology was built from three hubs in a row, one computer on each hub, joined with crossover cables (the figure of the manual "
               "is an image, so this layout was chosen)."],
    "exp7-mesh": ["The hint figure of the manual is an image, so the mesh was built as three switches connected to each other, one of them serving a hub "
                  "shared by two computers; spanning tree blocks the redundant cable."],
    "exp9": ["Figure 1 of the manual is an image, so the network was built as three routers connected in a triangle, each with a switch and one computer "
             "on its own network; the addresses used are in the tables above."],
}


def _assumptions(experiment):
    return list(_ASSUMPTIONS.get(experiment, []))


# ------------------------------------------------------------------------------------------------ building one part
async def _stored_capture(workflow, db, question):
    from ..models import WorkflowEvidence
    from .storage_service import storage_service
    row = db.query(WorkflowEvidence).filter_by(workflow_id=workflow.id, question_id=question["id"], slot=CAPTURE_SLOT).first()
    if row is None:
        return None
    try:
        path = await asyncio.to_thread(storage_service.ensure_local, row.file_path)
        return await asyncio.to_thread(lambda: open(path, "rb").read())
    except (FileNotFoundError, OSError):
        return None


async def _shots(tool, state, steps, out_dir):
    from .storage_service import storage_service
    from .studio_capture import StudioCaptureUnavailable, capture_studio
    try:
        taken = await capture_studio(tool, state, steps, out_dir)
    except StudioCaptureUnavailable as error:
        logger.warning("Studio screenshots unavailable (%s): %s", tool, error)
        return [], str(error)
    by_id = {shot["id"]: shot["path"] for shot in taken}
    out = []
    for step in steps:
        path = by_id.get(step["id"])
        if path:
            await asyncio.to_thread(storage_service.sync_file, path)
            out.append({"slot": None, "path": path, "caption": step["title"] + " (LabMate practice environment)", "explain": step["explain"]})
    return out, None


async def run_studio_part(workflow, db, question):
    """The finished result dict of one studio part (answer, screenshots, tables and observations)."""
    from .instruction_policy import parse_instruction_preferences

    prefs = parse_instruction_preferences(getattr(workflow, "instructions", ""))
    studio = question["studio"]
    out_dir = os.path.join(settings.SCREENSHOT_DIR, f"studio_{workflow.id}_{question['id']}_{uuid.uuid4().hex[:6]}")
    base = {"id": question["id"], "question": question["text"], "language": "theory", "is_theory": True, "code": "", "output": "", "error": "",
            "status": "completed", "screenshot_paths": [], "kind": "evidence", "part_title": question.get("part_title", "")}
    experiment = question.get("studio_args", {}).get("experiment", "")
    if (studio == "packettracer" and experiment in PRACTICALS.values()
            or studio == "powerbi" and experiment in POWERBI_PRACTICALS.values()
            or studio == "android" and experiment in ANDROID_PRACTICALS.values()):
        from .storage_service import storage_service
        from .studio_capture import StudioCaptureUnavailable, capture_studio
        try:
            taken = await capture_studio(studio, {}, [], out_dir, practical=experiment)
            if not taken:
                raise StudioCaptureUnavailable("The studio returned no evidence.")
        except StudioCaptureUnavailable as error:
            return {**base, "status": "failed", "error": str(error)}
        shots = []
        for shot in taken:
            await asyncio.to_thread(storage_service.sync_file, shot["path"])
            shots.append({"slot": None, "path": shot["path"], "caption": shot["title"], "explain": shot["explain"]})
        answer = "Executed in the LabMate practice environment."
        if studio == "powerbi":
            answer += " This practical uses a sample dataset."
        if studio == "android":
            answer += " The screenshots show the interactive browser Android runtime."
        return {**base, "answer": answer, "auto_evidence": shots}
    if studio == "wireshark":
        capture = await _stored_capture(workflow, db, question)
        try:
            session, source, _facts = await asyncio.to_thread(wireshark_lab.load, capture)
        except CaptureError:
            session, source, _facts = await asyncio.to_thread(wireshark_lab.load, None)
        topic = question.get("studio_args", {}).get("experiment")
        focused = topic in wireshark_lab.FOCUSED_TRACES
        steps, missing = (await asyncio.to_thread(wireshark_lab.focused_plan, session, topic) if focused
                          else await asyncio.to_thread(wireshark_lab.plan, session))
        state = await asyncio.to_thread(wireshark_lab.studio_state, session, source, steps)
        shots, failure = await _shots("wireshark", state, steps, out_dir)
        answer = "" if (prefs.output_only_screenshots and prefs.no_extra_questions) else (
            "\n".join(step["explain"] for step in steps) if focused else wireshark_lab.procedure(session, source, steps))
        note = "" if (prefs.output_only_screenshots and prefs.no_extra_questions) else (
            "LabMate analysed its generated practice capture." if focused and source == "scenario" else "" if focused else _wireshark_note(source))
        if note:
            answer += "\n" + note
        tables = [] if focused or prefs.no_extra_questions else await asyncio.to_thread(wireshark_lab.tables, session)
        result = {**base, "answer": answer, "auto_evidence": shots, "tables_after": tables,
                  "notes": [] if (prefs.output_only_screenshots and prefs.no_extra_questions) else missing}
        if failure:
            result["studio_error"] = "The Wireshark screenshots could not be captured automatically (%s). Generate the report again." % failure
        if focused and (failure or missing or len(shots) != len(steps)):
            result.update(status="failed", error=failure or " ".join(missing) or "One or more packet screenshots are missing.")
        return result
    if studio == "packettracer":
        if experiment == PT9[0]:
            run = await asyncio.to_thread(pt_lab.run_exp9)
            procedure, before = _pt9_procedure(), [{"title": "End devices", **run["config"]["hosts"]}, {"title": "Router configuration", **run["config"]["routers"]}]
        elif experiment in {"exp7-1", "exp7-2", "exp7-3", "exp7-mesh"}:
            scenario = {"exp7-1": 1, "exp7-2": 2, "exp7-3": 3, "exp7-mesh": "mesh"}[experiment]
            run = await asyncio.to_thread(pt_lab.run_exp7, scenario)
            procedure, before = _pt7_procedure(experiment, run["spec"]), [{"title": "IP addresses used", **run["ip_table"]}]
        else:
            raise ValueError("Unknown Packet Tracer experiment.")
        state = {"tool": "packettracer", "spec": run["spec"], "name": run["title"]}
        shots, failure = await _shots("packettracer", state, run["frames"], out_dir)
        result = {
            **base,
            "answer": "" if (prefs.output_only_screenshots and prefs.no_extra_questions) else procedure,
            "auto_evidence": shots,
            "tables_before": [] if (prefs.output_only_screenshots and prefs.no_extra_questions) else before,
            "observations": [] if prefs.no_extra_questions else run["observations"],
            "notes": [] if (prefs.output_only_screenshots and prefs.no_extra_questions) else _assumptions(experiment),
        }
        if failure:
            result["studio_error"] = "The Cisco Packet Tracer screenshots could not be captured automatically (%s). Generate the report again." % failure
        return result
    raise ValueError("Unknown studio.")
