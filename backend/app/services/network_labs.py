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

_TOP_SECTION_TIERS = (
    # Tier 1: Explicit top-level Experiment / Practical / Lab Assignment headings (integer or Roman numeral, never dotted sub-steps)
    re.compile(
        r"(?m)^\s*(?:#+\s*)?(?:experiment|practical|lab(?:\s+(?:assignment|exercise|sheet))?)\s*(?:no\.?|number)?\s*(?:\d+[A-Za-z]?|[IVXLCDM]+)\s*[:.)–—-](?!\d)",
        re.I,
    ),
    # Tier 2: Top-level Module / Part headings (integer or Roman numeral, never Part I.1 / Module 1.1)
    re.compile(
        r"(?m)^\s*(?:#+\s*)?(?:module|part)\s*(?:no\.?|number)?\s*(?:\d+[A-Za-z]?|[IVXLCDM]+)\s*[:.)–—-](?!\d)",
        re.I,
    ),
)

_PT_PRACTICAL_TITLES = {
    "switched-lan": "Switched IPv4 LAN configuration",
    "static-routing": "Static routing across two subnets",
    "vlan-isolation": "VLAN isolation and access-port segmentation",
    "dhcp-lan": "DHCP address assignment pool",
    "wireless-ssid": "Wireless access point SSID association",
}

_WS_FOCUSED_TITLES = {
    "arp-icmp": "ARP resolution and ICMP echo packet analysis",
    "tcp-handshake": "TCP three-way handshake analysis",
    "dns": "DNS query and response analysis",
    "http": "HTTP transaction and TCP stream analysis",
    "tcp-udp": "UDP and TCP transport header analysis",
}

_POWERBI_PRACTICAL_TITLES = {
    "sales-dashboard": "Retail Sales Dashboard and Calculated Column in Power BI",
    "clean-sales": "Data Cleaning and Power Query Transformations in Power BI",
    "relationships": "One-to-Many Table Relationships and Filter Propagation in Power BI",
    "dax-measures": "Explicit DAX Measures and KPI Cards in Power BI",
    "region-slicer": "Interactive Slicer and Cross-Filter Report in Power BI",
}

_ANDROID_PRACTICAL_TITLES = {
    "greeting": "Greeting Application using EditText and Button in Android Studio",
    "navigation": "Two-Activity Explicit Intent Navigation in Android Studio",
    "calculator": "Arithmetic Calculator with Input Validation in Android Studio",
    "registration": "Student Registration Form Validation in Android Studio",
    "counter": "Persistent Counter using SharedPreferences in Android Studio",
}


def _part(number, title, studio, args, text, slots=()):
    part = {"id": number, "text": text, "language": "theory", "is_theory": True, "kind": "evidence", "part_title": title[:120],
            "studio": studio, "studio_args": dict(args)}
    if slots:
        part["evidence_slots"] = [{"id": slot_id, "label": label} for slot_id, label in slots]
    return part


def _split_lab_sections(text):
    """Split a manual into top-level Experiment/Practical or Module/Part blocks without splitting nested sub-steps."""
    raw = str(text or "")
    for pattern in _TOP_SECTION_TIERS:
        matches = list(pattern.finditer(raw))
        if len(matches) >= 2:
            sections = []
            for idx, m in enumerate(matches):
                start = m.start()
                end = matches[idx + 1].start() if idx + 1 < len(matches) else len(raw)
                chunk = raw[start:end].strip()
                if chunk:
                    sections.append(chunk)
            if len(sections) >= 2:
                return sections
    return [raw]


def _match_pt_practical_topic(low):
    if re.search(r"\bvlan(?:s|\s*\d+|\s+isolation|\s+segmentation)\b", low):
        return "vlan-isolation"
    if re.search(r"\bdhcp\b", low) and re.search(r"\b(?:pool|lease|dora|discover|offer|server|assign(?:ment|ed)?|dynamic(?:ally)?)\b", low):
        return "dhcp-lan"
    if re.search(r"\b(?:wireless|wi-?fi|access\s+point|802\.11)\b", low) and re.search(r"\b(?:ssid|associat|laptop|ap1|wireless)\b", low):
        return "wireless-ssid"
    if re.search(r"\bstatic\s+rout(?:e|es|ing)\b|\bip\s+route\b", low) and not re.search(r"\brip(?:v2)?\b|three\s+routers?|3\s+routers?", low):
        return "static-routing"
    if re.search(r"\bswitched\s+(?:ipv4\s+)?lan\b", low) or (
        re.search(r"\b(?:pc1|pc2|hosts?|computers?)\b", low)
        and re.search(r"\b(?:192\.168\.|ipv4|ip\s+address|ping|icmp|fastethernet|switch\d*)\b", low)
        and not re.search(r"\bhubs?\b|\bbus\s+topology\b|\bmesh\s+topology\b|\bscenario\s*[123]\b|\brouters?\b|\brip\b", low)
    ):
        return "switched-lan"
    return None


def _match_ws_topic(low):
    # Full 12-step intro lab: explicit introduction/password-sniffing manual or multi-protocol suite covering ARP + HTTP + TCP + ICMP.
    has_all_four = all(re.search(rf"\b{proto}\b", low) for proto in ("arp", "http", "tcp", "icmp"))
    looks_full_intro = (
        bool(re.search(r"introduction\s+to\s+wireshark|password\s+sniffing|ethernet\s+protocol\s+frame", low))
        or (has_all_four and bool(re.search(r"\b(?:filters?|capture|login|credentials)\b", low)))
    )
    if looks_full_intro and not re.search(r"\b(?:three[- ]way\s+handshake|tcp\s+handshake)\b", low):
        return "intro"
    if re.search(r"\barp\b", low) and re.search(r"\bicmp\b|\becho\b|\bping\b", low) and re.search(r"\b(?:opcode|icmp\.type|filter|packet|capture|analy|inspect|request|reply)\b", low):
        return "arp-icmp"
    if re.search(r"\btcp\b", low) and re.search(r"\b(?:three[- ]way|3[- ]way|handshake|syn[- ,]*ack|flags\.syn)\b", low):
        return "tcp-handshake"
    if re.search(r"\bdns\b|\bdomain\s+name\s+system\b", low) and re.search(r"\b(?:query|response|flags\.response|resol|record|lookup|packet|filter)\b", low):
        return "dns"
    if re.search(r"\bhttp\b", low) and re.search(r"\b(?:request|response|follow|tcp\s+stream|reassembl|get|post|status)\b", low) and not re.search(r"\barp\b.*\bicmp\b", low, re.S):
        return "http"
    if re.search(r"\budp\b", low) and re.search(r"\btcp\b", low) and re.search(r"\b(?:header|transport|compar|protocol|datagram|segment|filter|inspect)\b", low):
        return "tcp-udp"
    return None


def _match_powerbi_practical_topic(low):
    # Leave external Social Media Analytics workflows (ParseHub, Canva, SimilarWeb, Google Trends, etc.) as manual slots.
    if re.search(r"\b(?:parsehub|canva|similarweb|google\s+trends|social\s+media|instagram|followers?|youtube\s+analytics)\b", low):
        return None
    if re.search(r"\b(?:power\s+query|clean(?:ing)?|deduplicat|remove\s+duplicates?|drop\s+blank|blank\s+(?:quantity|rows?)|applied\s+steps|trim(?:med)?\s+(?:text|region)|data\s+type)\b", low):
        return "clean-sales"
    if re.search(r"\b(?:relationship|one[- ]to[- ]many|1:\*|cardinality|model\s+view|customers\s*\[customerid\]|filter\s+propagation|foreign\s+key|primary\s+key)\b", low):
        return "relationships"
    if re.search(r"\bdax\b|\bexplicit\s+measures?\b", low) or (re.search(r"\bsum\s*\(|\baverage\s*\(", low) and re.search(r"\bmeasures?\b", low)):
        return "dax-measures"
    if re.search(r"\bslicer\b", low) or (re.search(r"\binteractive\s+report\b", low) and re.search(r"\bfilter(?:ing|ed)?\b|\bline\s+chart\b", low)):
        return "region-slicer"
    if re.search(r"\bsales\s+dashboard\b|\bcalculated\s+column\b|\bclustered\s+bar\b|\bretail\s+sales\b|\bkpi\s+card\b|\bimport\s+sales\s+csv\b|\bsalesamount\b", low):
        return "sales-dashboard"
    return None


def _match_android_practical_topic(low):
    if re.search(r"\b(?:sharedpreferences|getsharedpreferences|persistent\s+counter|persist(?:s|ent)?|relaunch|increment\s+and\s+reset)\b", low):
        return "counter"
    if re.search(r"\b(?:secondactivity|two[- ]?activity|explicit\s+intent|putextra|getstringextra|startactivity)\b", low):
        return "navigation"
    if re.search(r"\bcalculator\b|\b(?:arithmetic|add\s+and\s+subtract)\b", low):
        return "calculator"
    if re.search(r"\bregistration\b|\b(?:student\s+form|course\s+edittext|email\s+and\s+course)\b", low):
        return "registration"
    if re.search(r"\bgreeting\b|\bshow\s+greeting\b|\bhello\s*<|\bhello\s+(?:name|user|world)\b", low) or (
        re.search(r"\bedittext\b", low) and re.search(r"\bbutton\b", low) and re.search(r"\bactivity_main\b", low)
    ):
        return "greeting"
    return None


def _detect_single_section(section_text, strict=False, doc_tool_hint=None):
    text = str(section_text or "")
    low = text.lower()
    heading = next((line for line in text.splitlines() if re.match(r"^\s*experiment\s+\d+\s*:", line, re.I)), "")
    title = heading.partition(":")[2].strip()
    if re.search(r"^\s*laboratory\s*:\s*(?:cisco\s+)?packet tracer\s*$", low, re.M) and title.lower() in PRACTICALS:
        return [_part(1, title, "packettracer", {"experiment": PRACTICALS[title.lower()]}, text)]
    if re.search(r"^\s*laboratory\s*:\s*power\s+bi\s*$", low, re.M):
        if title.lower() in POWERBI_PRACTICALS:
            return [_part(1, title, "powerbi", {"experiment": POWERBI_PRACTICALS[title.lower()]}, text)]
        topic = _match_powerbi_practical_topic(low)
        if topic:
            return [_part(1, title or _POWERBI_PRACTICAL_TITLES[topic], "powerbi", {"experiment": topic}, text)]
    if re.search(r"^\s*laboratory\s*:\s*android\s+studio\s*$", low, re.M):
        if title.lower() in ANDROID_PRACTICALS:
            return [_part(1, title, "android", {"experiment": ANDROID_PRACTICALS[title.lower()]}, text)]
        topic = _match_android_practical_topic(low)
        if topic:
            return [_part(1, title or _ANDROID_PRACTICAL_TITLES[topic], "android", {"experiment": topic}, text)]
    focused = re.search(r"^\s*laboratory\s*:\s*wireshark\s*$", low, re.M)
    if focused:
        for pattern, topic in [
            (r"\barp\s+and\s+icmp\b", "arp-icmp"), (r"\btcp handshake\b", "tcp-handshake"),
            (r"\bdns query\b", "dns"), (r"\bhttp request\b", "http"), (r"\budp\b.*\btcp\b", "tcp-udp"),
        ]:
            if re.search(pattern, title, re.I):
                return [_part(1, title, "wireshark", {"experiment": topic}, text, [(CAPTURE_SLOT, CAPTURE_LABEL)])]

    first_line = next((line.strip() for line in text.splitlines() if line.strip()), "")
    has_pt = "packet tracer" in low or (doc_tool_hint == "packettracer" and "wireshark" not in low)
    has_ws = "wireshark" in low or (doc_tool_hint == "wireshark" and "packet tracer" not in low)

    if has_pt and "wireshark" not in low:
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
        router_hits = len(re.findall(r"\b(?:routers?\s*\d+|routers?)\b", low))
        if (router_hits >= 3 or re.search(r"\b(?:three|3)\s+routers?\b", low)) and (not strict or re.search(r"\brip(?:v2)?\b", low)):
            return [_part(1, PT9[1], "packettracer", {"experiment": PT9[0]},
                          "Design a network of three routers, configure the interfaces and RIP dynamic routing, test with Simple PDUs, then disable one "
                          "router-to-router link and show the path the network chooses.")]
        pt_topic = _match_pt_practical_topic(low)
        if pt_topic:
            part_title = first_line[:120] or _PT_PRACTICAL_TITLES[pt_topic]
            return [_part(1, part_title, "packettracer", {"experiment": pt_topic}, text)]

    if has_ws and not re.search(r"packet\s+tracer", low):
        ws_topic = _match_ws_topic(low)
        if ws_topic == "intro":
            return [_part(1, "Introduction to Wireshark and traffic analysis", "wireshark", {},
                          "Capture and analyse ARP, ICMP, DNS, TCP and HTTP traffic with Wireshark, attach each screenshot the manual lists with a brief "
                          "explanation, and answer the post-experimental questions about the Ethernet and ARP frames.", [(CAPTURE_SLOT, CAPTURE_LABEL)])]
        if ws_topic:
            part_title = first_line[:120] or _WS_FOCUSED_TITLES[ws_topic]
            return [_part(1, part_title, "wireshark", {"experiment": ws_topic}, text, [(CAPTURE_SLOT, CAPTURE_LABEL)])]

    if low.count("wireshark") >= 3 and re.search(r"\bpackets?\b", low) and not re.search(r"packet\s+tracer", low):
        return [_part(1, "Introduction to Wireshark and traffic analysis", "wireshark", {},
                      "Capture and analyse ARP, ICMP, DNS, TCP and HTTP traffic with Wireshark, attach each screenshot the manual lists with a brief "
                      "explanation, and answer the post-experimental questions about the Ethernet and ARP frames.", [(CAPTURE_SLOT, CAPTURE_LABEL)])]
    section_title = title or first_line.lstrip("#").strip()
    has_pbi = bool(re.search(r"\bpower\s*bi\b|\bpower\s+query\b|\bdax\b", low)) or (
        doc_tool_hint == "powerbi" and not re.search(r"\bandroid\s+studio\b", low)
    )
    if has_pbi and "packet tracer" not in low and "wireshark" not in low:
        topic = _match_powerbi_practical_topic(low)
        if topic:
            return [_part(1, section_title or _POWERBI_PRACTICAL_TITLES[topic], "powerbi", {"experiment": topic}, text)]
    has_android = bool(re.search(
        r"\bandroid\s+studio\b|\bactivity_main\.xml\b|\bmainactivity\b|\bsharedpreferences\b|\bputextra\b|\bgetstringextra\b|\bstartactivity\b",
        low,
    )) or (doc_tool_hint == "android" and not re.search(r"\bpower\s*bi\b", low))
    if has_android and "packet tracer" not in low and "wireshark" not in low:
        topic = _match_android_practical_topic(low)
        if topic:
            return [_part(1, section_title or _ANDROID_PRACTICAL_TITLES[topic], "android", {"experiment": topic}, text)]
    return None


def detect_network_lab(manual_text, strict=False):
    """Question parts for Wireshark, Packet Tracer, Power BI, or Android Studio manuals, or None otherwise.

    strict (one experiment's own text, see network_parts_for): the three-router exercise is used only when the experiment
    asks for RIP routing, so a different Packet Tracer lab (one router, two subnets) is not swapped for it.
    """
    text = str(manual_text or "")
    low = text.lower()
    if not text.strip():
        return None
    doc_tool_hint = (
        "packettracer" if "packet tracer" in low and "wireshark" not in low
        else "wireshark" if "wireshark" in low and not re.search(r"packet\s+tracer", low)
        else "powerbi" if re.search(r"\bpower\s*bi\b", low) and not re.search(r"\bandroid\s+studio\b", low)
        else "android" if re.search(r"\bandroid\s+studio\b", low) and not re.search(r"\bpower\s*bi\b", low)
        else None
    )
    sections = _split_lab_sections(text) if not strict else [text]
    if len(sections) > 1:
        collected = []
        for sec in sections:
            matched = _detect_single_section(sec, strict=True, doc_tool_hint=doc_tool_hint)
            if matched:
                collected.extend(matched)
        if collected:
            return [{**item, "id": idx} for idx, item in enumerate(collected, 1)]
    return _detect_single_section(text, strict=strict, doc_tool_hint=doc_tool_hint)


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
    return ("no capture file was attached, so this report uses LabMate's practice capture (a fictitious computer, the practice host "
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


def _pt_practical_details(experiment):
    meta = {
        "switched-lan": {
            "procedure": "\n".join([
                "1. Placed two workstations (PC1 and PC2) connected to an access switch (Switch1) on FastEthernet0/1 and FastEthernet0/2.",
                "2. Configured PC1 Eth0 with IPv4 address 192.168.10.10/24 and PC2 Eth0 with 192.168.10.20/24.",
                "3. Switched to Simulation Mode and sent ICMP Echo PDUs from PC1 to PC2 and from PC2 to PC1, verifying ARP resolution followed by unicast switch forwarding.",
            ]),
            "tables": [{
                "title": "Switched IPv4 LAN Addressing Table",
                "headers": ["Device", "Interface", "IPv4 Address", "Subnet Mask", "Connected Switch Port"],
                "rows": [
                    ["PC1", "Eth0", "192.168.10.10", "255.255.255.0", "SW1 Fa0/1"],
                    ["PC2", "Eth0", "192.168.10.20", "255.255.255.0", "SW1 Fa0/2"],
                ],
            }],
            "observations": [
                "On the initial ping from PC1 to PC2, ARP resolved PC2's MAC address and SW1 populated its MAC address table; the reverse ping from PC2 to PC1 succeeded via direct unicast forwarding without repeating ARP broadcast."
            ],
        },
        "static-routing": {
            "procedure": "\n".join([
                "1. Built a two-subnet routed topology with PC1 (192.168.10.10/24), Router R1, Router R2 joined across transit link 10.0.0.0/30, and remote host PC2 (192.168.20.10/24).",
                "2. Configured R1 static route 192.168.20.0/24 via next-hop 10.0.0.2 and R2 return static route 192.168.10.0/24 via next-hop 10.0.0.1.",
                "3. Sent an ICMP Echo PDU from PC1 to 192.168.20.10 across R1 and R2 and confirmed bidirectional reachability in Simulation Mode.",
            ]),
            "tables": [{
                "title": "Static Routing Interface & Next-Hop Summary",
                "headers": ["Device", "Interface / Prefix", "Address / Mask", "Next Hop"],
                "rows": [
                    ["PC1", "Eth0", "192.168.10.10 / 255.255.255.0", "Gateway 192.168.10.1"],
                    ["R1", "Gi0/0 (LAN) | Gi0/1 (WAN)", "192.168.10.1/24 | 10.0.0.1/30", "192.168.20.0/24 -> 10.0.0.2"],
                    ["R2", "Gi0/0 (WAN) | Gi0/1 (LAN)", "10.0.0.2/30 | 192.168.20.1/24", "192.168.10.0/24 -> 10.0.0.1"],
                    ["PC2", "Eth0", "192.168.20.10 / 255.255.255.0", "Gateway 192.168.20.1"],
                ],
            }],
            "observations": [
                "With symmetric static routes configured on both R1 and R2, ICMP packets crossed 10.0.0.0/30 end-to-end and the Echo Reply returned cleanly via R2 -> R1 -> PC1."
            ],
        },
        "vlan-isolation": {
            "procedure": "\n".join([
                "1. Assigned SW1 access port Fa0/1 (PC1: 192.168.1.10/24) to VLAN 10 and access port Fa0/2 (PC2: 192.168.1.20/24) to VLAN 20.",
                "2. Sent an ICMP ping from PC1 to PC2 while the hosts resided in separate VLANs and observed Layer-2 isolation dropping the frame at SW1.",
                "3. Reassigned SW1 port Fa0/2 from VLAN 20 to VLAN 10 and re-tested the ICMP ping, confirming successful forwarding inside VLAN 10.",
            ]),
            "tables": [{
                "title": "Switch Access-Port VLAN Assignment",
                "headers": ["Host", "IPv4 Address", "Switch Port", "Initial VLAN (Blocked)", "Updated VLAN (Allowed)"],
                "rows": [
                    ["PC1", "192.168.1.10/24", "SW1 Fa0/1", "VLAN 10", "VLAN 10"],
                    ["PC2", "192.168.1.20/24", "SW1 Fa0/2", "VLAN 20", "VLAN 10"],
                ],
            }],
            "observations": [
                "Frames cannot cross Layer-2 access VLAN boundaries without a router: ping failed with PC1 in VLAN 10 and PC2 in VLAN 20, and succeeded immediately once Fa0/2 joined VLAN 10."
            ],
        },
        "dhcp-lan": {
            "procedure": "\n".join([
                "1. Configured Server SRV1 (192.168.30.2/24) with an active DHCP pool starting at 192.168.30.10 (mask 255.255.255.0, default gateway 192.168.30.1).",
                "2. Triggered the DORA (Discover, Offer, Request, Ack) sequence on PC1 via Switch1 and verified its leased address in 192.168.30.0/24.",
                "3. Triggered the DHCP lease exchange on PC2 and confirmed distinct dynamic IPv4 assignment with no address conflict.",
            ]),
            "tables": [{
                "title": "DHCP Server Pool & Client Leases",
                "headers": ["Role", "Device", "Pool / Lease Parameter", "Value"],
                "rows": [
                    ["DHCP Server", "SRV1", "Static IP / Pool Start / Gateway", "192.168.30.2 / 192.168.30.10 / 192.168.30.1"],
                    ["DHCP Client 1", "PC1", "Dynamic Lease Exchange", "DORA -> 192.168.30.10/24"],
                    ["DHCP Client 2", "PC2", "Dynamic Lease Exchange", "DORA -> 192.168.30.11/24"],
                ],
            }],
            "observations": [
                "Both workstations completed the four-step DHCP DORA handshake cleanly and received unique IPv4 leases from SRV1's configured pool."
            ],
        },
        "wireless-ssid": {
            "procedure": "\n".join([
                "1. Connected Laptop LT1 to Access Point AP1 using the matching SSID ('LabMate Wi-Fi') and verified wireless association.",
                "2. Sent an ICMP Echo ping from LT1 (192.168.40.10/24) through AP1 to Server SRV1 (192.168.40.2/24) and confirmed delivery.",
                "3. Changed LT1's target SSID to an unmatched network name ('Unmatched network'), verified loss of association, and confirmed the subsequent ping was blocked.",
            ]),
            "tables": [{
                "title": "Wireless SSID Association Test Matrix",
                "headers": ["Test Stage", "AP1 SSID", "Laptop LT1 Target SSID", "Association & Ping Result"],
                "rows": [
                    ["Matching SSID", "LabMate Wi-Fi", "LabMate Wi-Fi", "Associated — Ping to 192.168.40.2 Succeeded"],
                    ["Mismatched SSID", "LabMate Wi-Fi", "Unmatched network", "Not Associated — Ping to 192.168.40.2 Failed"],
                ],
            }],
            "observations": [
                "IEEE 802.11 association strictly requires an exact SSID match between client and Access Point; changing LT1's SSID dropped Layer-2 wireless association and prevented ICMP forwarding."
            ],
        },
    }
    return meta[experiment]


def _powerbi_practical_details(experiment):
    meta = {
        "sales-dashboard": {
            "procedure": "\n".join([
                "1. Imported the sample Sales dataset into Microsoft Power BI Desktop (Get Data > Text/CSV).",
                "2. Added the calculated column SalesAmount = [Units] * [UnitPrice] in Table view and verified row-level calculations.",
                "3. Built a Total Sales KPI Card and Sales by Region Clustered Bar Chart in Report view.",
            ]),
            "tables": [{
                "title": "Sales Dashboard Schema & Visual Summary",
                "headers": ["Artifact", "Definition / Expression", "Role in Report"],
                "rows": [
                    ["Source Table", "Sales (Region, Category, Month, Units, UnitPrice)", "Base transactional sales dataset"],
                    ["Calculated Column", "SalesAmount = [Units] * [UnitPrice]", "Computes line-item sales amount"],
                    ["KPI Card & Bar Chart", "Sum of SalesAmount by Region", "Displays KPI total and regional comparison"],
                ],
            }],
            "observations": [
                "Executed in the LabMate Power BI practice environment using the sample Sales dataset; the SalesAmount calculated column immediately populated both the KPI Card and Clustered Bar Chart visuals."
            ],
        },
        "clean-sales": {
            "procedure": "\n".join([
                "1. Opened the raw Sales dataset inside Power Query Editor (Home > Transform Data).",
                "2. Removed blank Quantity rows, changed Quantity to Whole Number, trimmed Region whitespace, and removed duplicates via Applied Steps.",
                "3. Applied transformations back to the model and verified cleaned rows and updated Report view visuals.",
            ]),
            "tables": [{
                "title": "Power Query Applied Transformations",
                "headers": ["Step", "Transformation", "Target Field", "Outcome"],
                "rows": [
                    ["1", "Remove Blank Rows", "Quantity", "Eliminates rows with empty quantities"],
                    ["2", "Change Type (Whole Number)", "Quantity", "Enforces numeric aggregation type"],
                    ["3", "Trim Text", "Region", "Normalizes region names before grouping"],
                    ["4", "Remove Duplicates", "All Columns", "Prevents double-counting in visuals"],
                ],
            }],
            "observations": [
                "Power Query Applied Steps cleanly transformed and deduplicated the sample Sales dataset prior to loading it into Report view visuals."
            ],
        },
        "relationships": {
            "procedure": "\n".join([
                "1. Loaded the sample Customers and Orders tables and opened Model view (Manage Relationships).",
                "2. Configured an active one-to-many (1:*) single-direction relationship on Customers[CustomerID] -> Orders[CustomerID].",
                "3. Verified filter propagation from Customers to Orders across customer KPI cards (Asha = 550, Dev = 150).",
            ]),
            "tables": [{
                "title": "Model View Relationship & Filter Propagation",
                "headers": ["Relationship", "Cardinality / Filter", "Verified Result"],
                "rows": [
                    ["Customers[CustomerID] -> Orders[CustomerID]", "One-to-Many (1:*), Single Direction", "Active relationship propagates customer filters"],
                    ["Filtered Order Totals", "Customer Filter Context", "Asha: 550 | Dev: 150"],
                ],
            }],
            "observations": [
                "Establishing an active 1:* relationship on CustomerID propagated filter context from Customers into Orders accurately (Asha = 550, Dev = 150)."
            ],
        },
        "dax-measures": {
            "procedure": "\n".join([
                "1. Inspected the sample Sales table and verified SalesAmount = [Quantity] * [UnitPrice] alongside explicit model measures in Table view.",
                "2. Authored Total Sales = SUM([SalesAmount]), Total Units = SUM([Quantity]), and Average Sale = AVERAGE([SalesAmount]).",
                "3. Displayed all three DAX measures on KPI Cards in Report view (Total Sales = 3600, Total Units = 10, Average Sale = 900).",
            ]),
            "tables": [{
                "title": "Explicit DAX Measures Evaluation",
                "headers": ["Measure", "DAX Formula", "Verified Output"],
                "rows": [
                    ["Total Sales", "SUM([SalesAmount])", "3600"],
                    ["Total Units", "SUM([Quantity])", "10"],
                    ["Average Sale", "AVERAGE([SalesAmount])", "900"],
                ],
            }],
            "observations": [
                "All three explicit DAX measures evaluated dynamically against the sample Sales dataset (Total Sales = 3600, Total Units = 10, Average Sale = 900)."
            ],
        },
        "region-slicer": {
            "procedure": "\n".join([
                "1. Built the interactive Sales report page with a KPI Card, Sales by Region bar chart, Sales by Month line chart, and Region slicer (All Regions = 3,600).",
                "2. Selected North in the Region slicer and verified cross-filtering across all page visuals (North = 2,200).",
            ]),
            "tables": [{
                "title": "Region Slicer Filter Context Comparison",
                "headers": ["Filter Selection", "Total Sales KPI", "Visuals Affected"],
                "rows": [
                    ["All Regions (Unfiltered)", "3,600", "KPI Card, Sales by Region Bar, Sales by Month Line"],
                    ["Region = North", "2,200", "All report visuals cross-filtered to North rows"],
                ],
            }],
            "observations": [
                "Selecting North in the Region slicer filtered the entire Report view dynamically, narrowing Total Sales from 3,600 to 2,200."
            ],
        },
    }
    return meta[experiment]


def _android_practical_details(experiment):
    meta = {
        "greeting": {
            "procedure": "\n".join([
                "1. Designed activity_main.xml with a name EditText, Show greeting Button, and greeting TextView.",
                "2. Implemented input validation and greeting string formatting ('Hello, <name>!') in MainActivity.java OnClickListener.",
                "3. Launched the app in LabMate's interactive browser Android runtime to verify both empty-input validation and live greeting output.",
            ]),
            "tables": [{
                "title": "Greeting App UI & Runtime Checkpoints",
                "headers": ["Artifact / Event", "File / Component", "Observed Runtime Behavior"],
                "rows": [
                    ["XML Layout", "activity_main.xml", "Renders EditText, Button, and output TextView"],
                    ["Click Handler", "MainActivity.java", "Validates blank text and renders 'Hello, <name>!'"],
                ],
            }],
            "observations": [
                "Screenshots show both the Android Studio editor/layout view and the live interactive browser Android runtime displaying validated greeting output."
            ],
        },
        "navigation": {
            "procedure": "\n".join([
                "1. Configured MainActivity.java and activity_main.xml with an input field and navigation action button.",
                "2. Built an explicit Intent targeting SecondActivity.class, attached extras via putExtra(), and launched it with startActivity(intent).",
                "3. Extracted the incoming extra via getIntent().getStringExtra() inside SecondActivity.java and verified it in the running device preview.",
            ]),
            "tables": [{
                "title": "Two-Activity Intent Navigation Flow",
                "headers": ["Activity", "Intent Operation", "Verified Output"],
                "rows": [
                    ["MainActivity", "Intent(this, SecondActivity.class) + putExtra()", "Packages user extra and starts SecondActivity"],
                    ["SecondActivity", "getIntent().getStringExtra()", "Renders forwarded student extra on screen"],
                ],
            }],
            "observations": [
                "Explicit Intent navigation delivered string extras reliably from MainActivity to SecondActivity inside the interactive browser Android runtime."
            ],
        },
        "calculator": {
            "procedure": "\n".join([
                "1. Built activity_main.xml with two numeric EditText inputs, Add/Subtract buttons, and a result TextView.",
                "2. Added empty-input checks and arithmetic OnClickListeners in MainActivity.java before updating the result TextView.",
                "3. Tested blank validation, addition, and subtraction inside the interactive Android device preview.",
            ]),
            "tables": [{
                "title": "Calculator Validation & Arithmetic Verification",
                "headers": ["Test Scenario", "Handler Logic", "Observed Result"],
                "rows": [
                    ["Empty Input", "Guards blank EditText before numeric parse", "Shows input prompt instead of crashing"],
                    ["Add / Subtract", "Computes A + B and A - B on click", "Updates result TextView cleanly"],
                ],
            }],
            "observations": [
                "Blank-input validation prevented parse failures and both Add and Subtract operations displayed exact results in the interactive Android runtime."
            ],
        },
        "registration": {
            "procedure": "\n".join([
                "1. Created activity_main.xml containing Student Name, Email, Course EditText inputs, and Submit Button.",
                "2. Implemented field validation in MainActivity.java enforcing required inputs and valid email structure ('@').",
                "3. Verified validation prompts on incomplete input and the 'Registered' confirmation state on valid submission.",
            ]),
            "tables": [{
                "title": "Student Registration Validation Checkpoints",
                "headers": ["Field / Stage", "Validation Rule", "Observed Runtime State"],
                "rows": [
                    ["Name & Course", "Non-empty trimmed strings required", "Blocks submission when left blank"],
                    ["Email Field", "Requires valid email format ('@')", "Prompts user on malformed email"],
                    ["Valid Submit", "All checks pass", "Displays Registered confirmation message"],
                ],
            }],
            "observations": [
                "Student registration form validation blocked incomplete submissions cleanly and rendered the Registered summary once all inputs satisfied rules."
            ],
        },
        "counter": {
            "procedure": "\n".join([
                "1. Initialized SharedPreferences in MainActivity.java to restore the stored integer count on launch.",
                "2. Implemented Increment and Reset click handlers persisting updates with SharedPreferences.Editor.",
                "3. Verified value persistence across simulated app relaunch and reset back to 0 in the interactive Android runtime.",
            ]),
            "tables": [{
                "title": "SharedPreferences Persistent Counter Lifecycle",
                "headers": ["Action", "SharedPreferences API", "Verified State"],
                "rows": [
                    ["Increment", "editor.putInt(key, count).apply()", "Persists incremented value immediately"],
                    ["Relaunch", "prefs.getInt(key, 0)", "Restores saved counter without resetting to 0"],
                    ["Reset", "editor.putInt(key, 0).apply()", "Resets persisted counter to 0"],
                ],
            }],
            "observations": [
                "SharedPreferences retained incremented counter state cleanly across relaunch and cleared back to 0 when Reset was triggered."
            ],
        },
    }
    return meta[experiment]


def _ws_focused_details(topic, session, steps):
    summary = {
        "arp-icmp": {
            "title": "ARP and ICMP Display Filter Checkpoints",
            "procedure": "\n".join([
                "1. Opened the packet capture in Wireshark and verified Layer-2/Layer-3 frame traffic on Ethernet.",
                "2. Filtered arp.opcode == 1 to inspect the broadcast ARP request asking for the target hardware address, then filtered arp.opcode == 2 for the unicast ARP reply.",
                "3. Filtered icmp.type == 8 and icmp.type == 0 to inspect the ICMP Echo Request and Echo Reply sequence and checksum fields.",
            ]),
            "obs": "ARP resolves IPv4 addresses into 48-bit MAC addresses via broadcast/unicast exchange before ICMP Echo Request/Reply probes test Layer-3 reachability.",
        },
        "tcp-handshake": {
            "title": "TCP Three-Way Handshake Sequence",
            "procedure": "\n".join([
                "1. Applied tcp.flags.syn == 1 && tcp.flags.ack == 0 to locate the client [SYN] packet initiating a new TCP stream.",
                "2. Restricted the filter to the same tcp.stream and selected tcp.flags.syn == 1 && tcp.flags.ack == 1 to verify the server [SYN, ACK] response.",
                "3. Selected the client's final pure [ACK] segment (tcp.flags.syn == 0 && tcp.flags.ack == 1 && tcp.len == 0) establishing the full-duplex TCP connection.",
            ]),
            "obs": "Sequence and acknowledgment numbers advance synchronously (+1 for SYN flags) across the SYN, SYN-ACK, and ACK segments on a single TCP stream before application data flows.",
        },
        "dns": {
            "title": "DNS Query and Response Dissection",
            "procedure": "\n".join([
                "1. Applied dns.flags.response == 0 to isolate the client UDP port 53 DNS Standard Query and expanded the Domain Name System tree.",
                "2. Matched the same Transaction ID (dns.id) with dns.flags.response == 1 to inspect the authoritative DNS Response carrying the resolved IPv4 A-record.",
            ]),
            "obs": "The DNS client and resolver correlate UDP datagrams on port 53 using the 16-bit Transaction ID, returning the resolved IPv4 answer record for HTTP connection setup.",
        },
        "http": {
            "title": "HTTP Transaction & Stream Reassembly",
            "procedure": "\n".join([
                "1. Applied display filter http.request and expanded Hypertext Transfer Protocol to inspect the client request method, host header, and URI.",
                "2. Filtered http.response on the same tcp.stream to examine the HTTP 200 OK status line and content headers returned by the server.",
                "3. Executed Follow > TCP Stream to reassemble and display the full plaintext HTTP conversation across client and server turns.",
            ]),
            "obs": "Plaintext HTTP/1.1 headers and payload bodies are directly legible in both individual packet detail trees and the Follow TCP Stream reconstruction.",
        },
        "tcp-udp": {
            "title": "UDP vs TCP Transport Header Comparison",
            "procedure": "\n".join([
                "1. Filtered udp packets and expanded the User Datagram Protocol tree to inspect its compact 8-byte header (Source Port, Destination Port, Length, Checksum).",
                "2. Filtered tcp packets and expanded the Transmission Control Protocol tree to examine Sequence Number, Acknowledgment Number, Header Length, Flags, and Window Size.",
            ]),
            "obs": "UDP uses a minimal stateless 8-byte header suited to short DNS datagrams, whereas TCP adds at least 20 bytes of sequence, acknowledgment, flag, and flow-control fields.",
        },
    }[topic]
    rows = [[step["title"], step.get("filter") or f"tcp.stream eq {step.get('stream', '')}", str(step.get("select", "—")), step["explain"]] for step in steps]
    table = {
        "title": summary["title"],
        "headers": ["Step / Stage", "Display Filter", "Frame #", "Captured Observation"],
        "rows": rows or [["No matching frames", "—", "—", "Capture did not contain matching frames."]],
    }
    return summary["procedure"], [table], [summary["obs"]]


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
            return {**base, "status": "failed", "error": str(error), "studio_error": str(error)}
        shots = []
        for shot in taken:
            await asyncio.to_thread(storage_service.sync_file, shot["path"])
            shots.append({"slot": None, "path": shot["path"], "caption": shot["title"] + " (LabMate practice environment)", "explain": shot["explain"]})
        detail_fn = {
            "packettracer": _pt_practical_details,
            "powerbi": _powerbi_practical_details,
            "android": _android_practical_details,
        }[studio]
        details = detail_fn(experiment)
        return {
            **base,
            "answer": "" if (prefs.output_only_screenshots and prefs.no_extra_questions) else details["procedure"],
            "auto_evidence": shots,
            "tables_before": [] if (prefs.output_only_screenshots and prefs.no_extra_questions) else details["tables"],
            "observations": [] if prefs.no_extra_questions else details["observations"],
            "notes": [],
        }
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
        if focused:
            proc, f_tables, f_obs = _ws_focused_details(topic, session, steps)
            answer = "" if (prefs.output_only_screenshots and prefs.no_extra_questions) else proc
            note = "" if (prefs.output_only_screenshots and prefs.no_extra_questions) else _wireshark_note(source)
            tables_before = [] if (prefs.output_only_screenshots and prefs.no_extra_questions) else f_tables
            observations = [] if prefs.no_extra_questions else f_obs
            tables = []
            notes = ([note] if note else []) + list(missing)
        else:
            answer = "" if (prefs.output_only_screenshots and prefs.no_extra_questions) else wireshark_lab.procedure(session, source, steps)
            note = "" if (prefs.output_only_screenshots and prefs.no_extra_questions) else _wireshark_note(source)
            if note:
                answer += "\nNote: " + note
            tables_before = []
            observations = []
            tables = [] if prefs.no_extra_questions else await asyncio.to_thread(wireshark_lab.tables, session)
            notes = list(missing)
        result = {**base, "answer": answer, "auto_evidence": shots, "tables_before": tables_before,
                  "observations": observations, "tables_after": tables, "notes": notes}
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
            # The assumed topology and practice-environment notes are disclosures; they stay whatever the instructions say.
            "notes": _assumptions(experiment),
        }
        if failure:
            result["studio_error"] = "The practice simulator screenshots could not be captured automatically (%s). Generate the report again." % failure
        return result
    raise ValueError("Unknown studio.")
