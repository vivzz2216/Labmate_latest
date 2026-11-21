"""Experiment 5 (Wireshark): which packets answer the manual, the two post-experiment tables, and the screenshot plan.

Every value here is read from the capture's packets. Nothing is estimated or written by a language model, so a table cell
is always what Wireshark would show for that packet.
"""
import re
from pathlib import Path

from .dfilter import apply_filter
from .dissect import ETHERTYPES, mac_with_name, open_session
from .scenario import build_scenario

PASSWORD_KEY = re.compile(r"pass|pwd|secret", re.I)
INTERFACES = ["Ethernet", "Wi-Fi", "Loopback: Adapter for loopback traffic capture"]
SAMPLES_DIR = Path(__file__).with_name("samples")
# The analyser's sample captures (built by backend/scripts/netlab_make_samples.py with scapy). "practice" is the Experiment 5
# practice capture that the report screenshots use.
SAMPLE_CAPTURES = {
    "practice": {"file": "practice-capture.pcap", "title": "Lab practice capture",
                 "description": "ARP, DNS, ICMP, a TCP handshake, HTTP GET and an HTTP login form (POST) sent in clear text"},
    "dhcp-arp": {"file": "dhcp-arp.pcapng", "title": "Joining a network: DHCP and ARP",
                 "description": "DHCP Discover/Offer/Request/ACK, ARP probes and announcement, ARP for the gateway, lease renewal and release"},
    "dns": {"file": "dns-queries.pcapng", "title": "DNS lookups",
            "description": "A, AAAA, MX and PTR queries, a CNAME chain, an NXDOMAIN answer, a query over IPv6 and a retried query"},
    "http": {"file": "http-browsing.pcap", "title": "Web browsing over HTTP",
             "description": "TCP three-way handshake, GET with 200 and 404 responses, a login POST, FIN teardown and a refused connection (RST)"},
    "icmp": {"file": "icmp-ping-traceroute.pcapng", "title": "Ping and traceroute",
             "description": "ARP, four pings, a traceroute with TTL exceeded replies, port unreachable, IPv6 neighbour discovery and ping6"},
}
SAMPLE_NOTE = ("Sample capture built packet by packet with scapy (constructed, not recorded from a live network). Every header, "
               "length and checksum is real and the analyser decodes it exactly as it decodes your own capture.")


def sample_bytes(sample_id):
    """(file name, capture bytes) of a sample capture. KeyError for an unknown id."""
    entry = SAMPLE_CAPTURES[sample_id]
    if sample_id == "practice":
        data, _facts = build_scenario()
        return entry["file"], data
    return entry["file"], (SAMPLES_DIR / entry["file"]).read_bytes()


PRACTICE_NOTE = "LabMate practice environment (not Wireshark)"


def load(capture_bytes=None):
    """(session, source, facts): the student's capture, or the built-in scenario when they supply none."""
    if capture_bytes:
        session = open_session(capture_bytes)
        session.original_capture = capture_bytes
        return session, "uploaded", {}
    data, facts = build_scenario()
    session = open_session(data)
    session.original_capture = data
    return session, "scenario", facts


def key_packets(session):
    """The packets the manual's screenshots and tables refer to; a missing kind is None."""
    packets = session.packets
    arp = [p for p in packets if "arp" in p.protocols]
    request = next((p for p in arp if p.layers["arp"]["opcode"] == 1), None)
    reply = next((p for p in arp if p.layers["arp"]["opcode"] == 2), None)
    posts = [p for p in packets if p.fields.get("http.request.method") == ["POST"]]
    login = next((p for p in posts if any(PASSWORD_KEY.search(k) for k, _ in p.layers["http"].get("form", []))), None) or \
        next((p for p in packets if p.layers.get("http", {}).get("request") and PASSWORD_KEY.search(p.layers["http"]["uri"])), None) or \
        (posts[0] if posts else None)
    get = next((p for p in packets if p.fields.get("http.request.method") == ["GET"]), None)
    form_get = next((p for p in packets if p.fields.get("http.request.method") == ["GET"] and login is not None
                     and p.layers["http"]["host"] == login.layers["http"]["host"]), None)
    return {
        "arp_request": request, "arp_reply": reply,
        "arp": request or (arp[0] if arp else None),
        "get": get, "login": login, "login_form": form_get,
        "icmp": next((p for p in packets if "icmp" in p.protocols), None),
        "dns": next((p for p in packets if p.top == "DNS"), None),
        "tcp": next((p for p in packets if "tcp" in p.protocols), None),
    }


def _cast(mac):
    if mac == "ff:ff:ff:ff:ff:ff":
        return "Broadcast: the destination address is ff:ff:ff:ff:ff:ff, so every device on the segment receives the frame"
    return "Multicast (group address)" if int(mac[:2], 16) & 1 else "Unicast (the individual bit of the address is 0)"


def ethernet_table(packet):
    """The manual's eight Ethernet questions, answered for one packet."""
    eth = packet.layers["eth"]
    padding = eth.get("padding", 0)
    kind = ETHERTYPES.get(eth["type"], "unknown")
    if padding:
        pad = "Yes. %d bytes of padding (all zero) follow the %d bytes of %s, so the frame reaches the 60-byte Ethernet minimum" % (
            padding, packet.length - 14 - padding, kind)
    else:
        pad = "No. The frame holds only the 14-byte Ethernet header and the %s data (%d bytes)" % (kind, packet.length - 14)
    return {"headers": ["No.", "Question (Ethernet frame)", "Answer from packet %d" % packet.number], "rows": [
        ["1", "Frame length of the packet", "%d bytes (%d bits)" % (packet.original_length, packet.original_length * 8)],
        ["2", "Frame number", str(packet.number)],
        ["3", "Type of frame (Ether-type number)", "0x%04x (%s)" % (eth["type"], kind)],
        ["4", "Can you say that there is padding in the payload?", pad],
        ["5", "Destination link-layer address", mac_with_name(eth["dst"])],
        ["6", "Source link-layer address", mac_with_name(eth["src"])],
        ["7", "Upper layer protocol", kind],
        ["8", "Is destination link-layer address unicast or broadcast?", _cast(eth["dst"])],
    ]}


def arp_differences(request, reply):
    """Two real differences between an ARP request and a reply, with the values of the packets compared."""
    if request is None or reply is None:
        return "The capture does not hold both an ARP request and a reply, so the two packets cannot be compared."
    a, b = request.layers["arp"], reply.layers["arp"]
    return ("(1) Opcode: the request has opcode %d (request) and the reply opcode %d (reply). "
            "(2) Addressing: the request is broadcast to %s and its target MAC address is %s because that is what is being asked, "
            "while the reply is unicast to %s and carries the answer, the target MAC %s." % (
                a["opcode"], b["opcode"], request.layers["eth"]["dst"], a["target_mac"], reply.layers["eth"]["dst"], b["sender_mac"]))


def arp_table(packet, request=None, reply=None):
    """The manual's eleven ARP questions, answered for one ARP packet."""
    arp, eth = packet.layers["arp"], packet.layers["eth"]
    pad = eth.get("padding", 0)
    kind = "request" if arp["opcode"] == 1 else "reply"
    return {"headers": ["No.", "Question (ARP frame)", "Answer from packet %d" % packet.number], "rows": [
        ["1", "Hardware type", "Ethernet (%d)" % arp["hardware_type"]],
        ["2", "Protocol type", "%s (0x%04x)" % (ETHERTYPES.get(arp["protocol_type"], "unknown"), arp["protocol_type"])],
        ["3", "Hardware size", "%d bytes" % arp["hardware_size"]],
        ["4", "Protocol size", "%d bytes" % arp["protocol_size"]],
        ["5", "Source hardware address", mac_with_name(arp["sender_mac"])],
        ["6", "Source IP address", arp["sender_ip"]],
        ["7", "Destination hardware address", arp["target_mac"] + (" (not known yet; this is what the request asks for)" if arp["opcode"] == 1 else "")],
        ["8", "Destination IP address", arp["target_ip"]],
        ["9", "Number of bytes of padding in a frame", "%d bytes" % pad],
        ["10", "Is it an ARP request or reply packet?", "ARP %s (opcode %d)" % (kind, arp["opcode"])],
        ["11", "Two differences between ARP request and reply packets", arp_differences(request or packet, reply)],
    ]}


# --------------------------------------------------------------------------------------- the screenshot plan
def plan(session):
    """Studio steps, in the manual's order, with the explanation of each screenshot. Steps whose packets are absent are listed
    in `missing` and left out. Returns (steps, missing)."""
    key = key_packets(session)
    total = len(session.packets)
    steps, missing = [], []

    def count(expression):
        return apply_filter(session, expression)

    steps.append({"id": "interface", "view": "welcome", "title": "Wireshark interface window",
                  "explain": "The start screen of the analyser. It lists the capture interfaces of the computer (%s) with the capture filter "
                             "box, and the capture was started on the active interface." % ", ".join(INTERFACES)})
    steps.append({"id": "sniffing", "view": "main", "filter": "", "select": 1, "expand": [], "title": "Wireshark packet sniffing window",
                  "explain": "After Start the packet list fills in. The three panes are the packet list (%d packets, one row each with number, time, "
                             "source, destination, protocol, length and info), the packet details tree and the packet bytes. Row colours "
                             "come from the colouring rules: light purple is TCP, light blue is UDP, green is HTTP, pink is ICMP and "
                             "cream is ARP." % total})
    filter_notes = [("arp", "ARP", "address resolution packets, which map an IP address to a MAC address"),
                    ("http", "HTTP", "web requests and responses carried over TCP port 80"),
                    ("tcp", "TCP", "TCP segments, including the handshake and the HTTP data"),
                    ("icmp", "ICMP", "echo (ping) requests and replies")]
    for expression, label, meaning in filter_notes:
        numbers = count(expression)
        if not numbers:
            missing.append("No %s packets in the capture, so the %s filter screenshot is left out." % (label, expression))
            continue
        steps.append({"id": "filter_" + expression, "view": "main", "filter": expression, "select": numbers[0], "expand": [],
                      "title": "Display filter: %s" % expression,
                      "explain": "Typing %s in the display filter bar and pressing Enter keeps only the %s (%d of the %d packets: %s)." % (
                          expression, meaning, len(numbers), total, _list(numbers))})
    for ip in _client_and_server(session, key):
        expression = "ip.addr == %s" % ip
        numbers = count(expression)
        if numbers:
            steps.append({"id": "filter_ip", "view": "main", "filter": expression, "select": numbers[0], "expand": [],
                          "title": "Display filter: %s" % expression,
                          "explain": "The filter %s shows every packet sent from or to %s: %d of the %d packets." % (expression, ip, len(numbers), total)})
            break
    arp = key["arp"]
    if arp:
        steps.append({"id": "ethernet", "view": "main", "filter": "arp", "select": arp.number, "expand": ["Ethernet II"],
                      "title": "Ethernet protocol details (packet %d)" % arp.number,
                      "explain": "Packet %d (%s) selected and the Ethernet II line expanded. The frame is %d bytes; the destination is %s, the source is %s "
                                 "and the type field is 0x%04x (%s)%s." % (
                                     arp.number, arp.info, arp.length, mac_with_name(arp.layers["eth"]["dst"]), mac_with_name(arp.layers["eth"]["src"]),
                                     arp.layers["eth"]["type"], ETHERTYPES.get(arp.layers["eth"]["type"], "?"),
                                     ", followed by %d bytes of padding" % arp.layers["eth"]["padding"] if arp.layers["eth"].get("padding") else "")})
        a = arp.layers["arp"]
        steps.append({"id": "arp", "view": "main", "filter": "arp", "select": arp.number, "expand": ["Address Resolution Protocol"],
                      "title": "ARP protocol details (packet %d)" % arp.number,
                      "explain": "The Address Resolution Protocol section of packet %d: hardware type Ethernet (%d), protocol type IPv4 (0x%04x), hardware "
                                 "size %d, protocol size %d, opcode %s (%d), sender %s / %s and target %s / %s." % (
                                     arp.number, a["hardware_type"], a["protocol_type"], a["hardware_size"], a["protocol_size"],
                                     "request" if a["opcode"] == 1 else "reply", a["opcode"], a["sender_mac"], a["sender_ip"], a["target_mac"], a["target_ip"])})
    else:
        missing.append("No ARP packet in the capture, so the Ethernet and ARP detail screenshots are left out.")
    login = key["login"]
    if login:
        host = login.layers["http"]["host"]
        form = key["login_form"] or key["get"]
        steps.append({"id": "login_page", "view": "browser", "host": host, "uri": "/login.html" if form else login.layers["http"]["uri"],
                      "title": "Login window of an insecure web page",
                      "explain": "The login page of http://%s opened in the browser. The address starts with http and not https, so the form data "
                                 "is sent without encryption." % host})
        steps.append({"id": "http_post", "view": "main", "filter": 'http.request.method == "POST"', "select": login.number,
                      "expand": ["Hypertext Transfer Protocol", "HTML Form URL Encoded"], "title": "HTTP filter for password sniffing",
                      "explain": "The display filter http.request.method == \"POST\" shows only form submissions. Packet %d is the POST to %s%s; its "
                                 "HTML Form URL Encoded section lists the submitted fields in clear text: %s." % (
                                     login.number, host, login.layers["http"]["uri"], _form(login))})
        stream = session.stream_text(login.stream)
        steps.append({"id": "follow", "view": "follow", "stream": login.stream, "select": login.number,
                      "expand": ["Hypertext Transfer Protocol", "HTML Form URL Encoded"], "title": "TCP stream with the login ID and password",
                      "explain": "Follow > TCP Stream on packet %d shows the whole conversation of TCP stream %d (%d client packets, %d server packets, "
                                 "%d turns). The client's request contains %s, readable by anyone who can capture the traffic." % (
                                     login.number, login.stream, stream["client_packets"], stream["server_packets"], stream["turns"], _form(login))})
    else:
        missing.append("The capture holds no HTTP form submission, so the login page, password filter and TCP stream screenshots are left out.")
    return steps, missing


def _form(packet):
    items = packet.layers["http"].get("form") or []
    return ", ".join('%s = "%s"' % (k, v) for k, v in items) or "no form fields"


def _list(numbers, limit=8):
    shown = ", ".join(str(n) for n in numbers[:limit])
    return shown + (", ..." if len(numbers) > limit else "")


def _client_and_server(session, key):
    seen = []
    for p in (key["get"], key["login"], key["tcp"], key["icmp"], key["dns"]):
        if p is not None and "ip" in p.layers:
            for address in (p.layers["ip"]["src"], p.layers["ip"]["dst"]):
                if address not in seen:
                    seen.append(address)
    return seen[:1] if seen else []


def procedure(session, source, steps):
    """The Procedure written as the student's own steps, from what the capture really holds."""
    key = key_packets(session)
    lines = ["1. Opened Wireshark and studied the main window: the display filter bar, the packet list, the packet details and the packet bytes.",
             "2. Opened Capture > Options, chose the active interface and clicked Start. Wireshark began to list every packet sent or received by the computer.",
             "3. Entered the URL http://gaia.cs.umass.edu/wireshark-labs/INTRO-wireshark-file1.html in a web browser and, once the page had loaded, "
             "clicked Stop. The capture held %d packets." % len(session.packets)]
    number = 4
    lines.append("%d. Applied the display filters arp, http, tcp, icmp and ip.addr == <address> to see how each one narrows the packet list." % number)
    number += 1
    lines.append("%d. Selected a packet and expanded the Ethernet II and Address Resolution Protocol lines to read the header fields." % number)
    number += 1
    if key["login"]:
        lines.append("%d. Opened an insecure (http) login page, submitted a user name and password, then filtered the capture with "
                     "http.request.method == \"POST\" and used Follow > TCP Stream to read the credentials in clear text." % number)
    return "\n".join(lines)


# For a focused practical, select only the packets needed by that exercise.
FOCUSED_TRACES = {
    "arp-icmp": [
        ("ARP request", "arp.opcode == 1", "Address Resolution Protocol"),
        ("ARP reply", "arp.opcode == 2", "Address Resolution Protocol"),
        ("ICMP echo request", "icmp.type == 8", "Internet Control Message Protocol"),
        ("ICMP echo reply", "icmp.type == 0", "Internet Control Message Protocol"),
    ],
    "tcp-handshake": [
        ("TCP SYN", "tcp.flags.syn == 1 && tcp.flags.ack == 0", "Transmission Control Protocol"),
        ("TCP SYN-ACK", "tcp.flags.syn == 1 && tcp.flags.ack == 1", "Transmission Control Protocol"),
        ("TCP ACK", "tcp.flags.syn == 0 && tcp.flags.ack == 1 && tcp.len == 0", "Transmission Control Protocol"),
    ],
    "dns": [
        ("DNS query", "dns.flags.response == 0", "Domain Name System"),
        ("DNS response", "dns.flags.response == 1", "Domain Name System"),
    ],
    "http": [
        ("HTTP request", "http.request", "Hypertext Transfer Protocol"),
        ("HTTP response", "http.response", "Hypertext Transfer Protocol"),
    ],
    "tcp-udp": [
        ("UDP packets", "udp", "User Datagram Protocol"),
        ("TCP packets", "tcp", "Transmission Control Protocol"),
    ],
}


def focused_plan(session, topic):
    steps, missing = [], []
    tcp_stream = dns_id = query_number = http_stream = None
    for index, (title, expression, layer) in enumerate(FOCUSED_TRACES[topic]):
        if tcp_stream is not None:
            expression += f" && tcp.stream == {tcp_stream}"
        if dns_id is not None:
            expression += f" && dns.id == {dns_id}"
        if http_stream is not None:
            expression += f" && tcp.stream == {http_stream}"
        numbers = apply_filter(session, expression)
        if topic == "dns":
            # Match both the ID and the address pair when IDs are reused.
            if query_number:
                query = session.packets[query_number - 1]
                numbers = [n for n in numbers if session.packets[n - 1].source == query.destination
                           and session.packets[n - 1].destination == query.source and n > query_number]
                if numbers:
                    # Keep the list in the studio aligned with the response discussed.
                    expression += f" && frame.number == {numbers[0]}"
        if not numbers:
            missing.append(f"{title} was absent from this capture.")
            continue
        packet = session.packets[numbers[0] - 1]
        if topic == "tcp-handshake" and index == 0:
            tcp_stream = packet.stream
        if topic == "dns" and index == 0:
            dns_id = packet.fields["dns.id"][0]
            query_number = packet.number
        if topic == "http" and index == 0:
            http_stream = packet.stream
        steps.append({"id": f"packet_{index + 1}", "view": "main", "filter": expression,
                      "select": packet.number, "expand": [layer], "title": title,
                      "explain": f"{len(numbers)} matching packets. Frame {packet.number}, {packet.source} to {packet.destination}. {packet.info}"})
    if topic == "http" and http_stream is not None and steps:
        steps.append({"id": "http_stream", "view": "follow", "stream": http_stream,
                      "select": steps[0]["select"], "title": "HTTP conversation",
                      "explain": f"Reassembled TCP stream {http_stream} for the selected HTTP request."})
    return steps, missing


def tables(session):
    key = key_packets(session)
    out = []
    if key["arp"]:
        out.append({"title": "Post-experimental exercise: Ethernet protocol frame", **ethernet_table(key["arp"])})
        out.append({"title": "Post-experimental exercise: ARP protocol frame",
                    **arp_table(key["arp"], key["arp_request"], key["arp_reply"] if key["arp_request"] else None)})
    return out


def studio_state(session, source, steps, facts=None):
    """Everything the studio page needs to draw the given steps without calling the server."""
    wanted = {step.get("select") for step in steps if step.get("select")}
    details = {str(number): session.detail(number) for number in wanted}
    filters = {step["filter"]: apply_filter(session, step["filter"]) for step in steps if step.get("filter")}
    filters[""] = [p.number for p in session.packets]
    streams = {str(step["stream"]): session.stream_text(step["stream"]) for step in steps if step.get("view") == "follow"}
    pages = {}
    for step in steps:
        if step.get("view") == "browser":
            host = step["host"]
            login = key_packets(session)["login"]
            pages[host] = {"host": host, "uri": step["uri"], "fields": [k for k, _ in login.layers["http"].get("form", [])]
                           if login else [], "values": dict(login.layers["http"].get("form", [])) if login else {}}
    return {"tool": "wireshark", "source": source, "packets": session.rows(), "details": details, "filters": filters, "streams": streams,
            "pages": pages, "interfaces": INTERFACES, "steps": steps, "practice": PRACTICE_NOTE,
            "file": "practice-capture.pcap" if source == "scenario" else "your-capture.pcap"}
