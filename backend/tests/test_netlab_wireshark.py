"""Wireshark engine: capture reader, dissector (cross-checked against scapy), display filters, Follow TCP Stream."""
import struct

import pytest

from app.netlab import scenario
from app.netlab.dfilter import FilterError, apply_filter, compile_filter
from app.netlab.dissect import open_session
from app.netlab.pcap import CaptureError, read_capture, write_pcap


@pytest.fixture(scope="module")
def built():
    data, facts = scenario.build_scenario()
    return data, facts, open_session(data)


@pytest.fixture(scope="module")
def session(built):
    return built[2]


# ----------------------------------------------------------------------------------------------- the file reader
def _to_big_endian(data):
    """The same capture with a big-endian header and records (a capture taken on another kind of machine)."""
    out = [struct.pack(">IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 262144, 1)]
    position = 24
    while position < len(data):
        sec, usec, caplen, origlen = struct.unpack("<IIII", data[position:position + 16])
        out.append(struct.pack(">IIII", sec, usec, caplen, origlen))
        out.append(data[position + 16:position + 16 + caplen])
        position += 16 + caplen
    return b"".join(out)


def _to_pcapng(data, big=False):
    order = ">" if big else "<"

    def block(kind, body):
        padded = body + b"\x00" * (-len(body) % 4)
        total = 12 + len(padded)
        return struct.pack(order + "II", kind, total) + padded + struct.pack(order + "I", total)

    out = [block(0x0A0D0D0A, struct.pack(order + "IHHq", 0x1A2B3C4D, 1, 0, -1))]
    out.append(block(1, struct.pack(order + "HHI", 1, 0, 0)))
    position = 24
    while position < len(data):
        sec, usec, caplen, origlen = struct.unpack("<IIII", data[position:position + 16])
        stamp = sec * 1_000_000 + usec
        body = struct.pack(order + "IIIII", 0, stamp >> 32, stamp & 0xFFFFFFFF, caplen, origlen) + data[position + 16:position + 16 + caplen]
        out.append(block(6, body))
        position += 16 + caplen
    return b"".join(out)


def test_reader_formats_agree(built):
    data = built[0]
    reference = read_capture(data)
    assert len(reference.frames) == 40 and reference.format == "pcap"
    for variant, name in ((_to_big_endian(data), "pcap"), (_to_pcapng(data), "pcapng"), (_to_pcapng(data, big=True), "pcapng")):
        other = read_capture(variant)
        assert other.format == name
        assert [f.data for f in other.frames] == [f.data for f in reference.frames]
        assert [round(f.timestamp, 6) for f in other.frames] == [round(f.timestamp, 6) for f in reference.frames]


def test_reader_nanosecond_pcap(built):
    data = bytearray(built[0])
    data[0:4] = b"\x4d\x3c\xb2\xa1"                      # nanosecond magic: the fraction field now counts nanoseconds
    first = struct.unpack("<II", data[24:32])
    frames = read_capture(bytes(data)).frames
    assert abs(frames[0].timestamp - (first[0] + first[1] * 1e-9)) < 1e-9


@pytest.mark.parametrize("payload, message", [
    (b"not a capture file at all, just text" * 3, "not a .pcap"),
    (b"\xd4\xc3\xb2\xa1" + b"\x00" * 10, "too small"),
])
def test_reader_refuses_non_captures(payload, message):
    with pytest.raises(CaptureError, match=message):
        read_capture(payload)


def test_reader_refuses_wrong_link_type_and_empty(built):
    wifi = write_pcap([(1.0, b"\x00" * 60)], linktype=105)
    with pytest.raises(CaptureError, match="Ethernet"):
        read_capture(wifi)
    with pytest.raises(CaptureError, match="no packets"):
        read_capture(write_pcap([]))


def test_reader_keeps_whole_packets_of_a_cut_off_file(built):
    data = built[0]
    cut = read_capture(data[:-30])                       # the last record is incomplete
    assert len(cut.frames) == 39


# ----------------------------------------------------------------------------------------------- scapy as an oracle
def test_every_packet_matches_scapy(built, session):
    pytest.importorskip("scapy.layers.inet")
    from scapy.layers.dns import DNS
    from scapy.layers.inet import ICMP, IP, TCP, UDP
    from scapy.layers.l2 import ARP, Ether
    from scapy.packet import Raw
    for packet in session.packets:
        reference = Ether(packet.data)
        eth = packet.layers["eth"]
        assert (eth["dst"], eth["src"], eth["type"]) == (reference.dst, reference.src, reference.type), packet.number
        if ARP in reference:
            arp, ours = reference[ARP], packet.layers["arp"]
            assert (ours["opcode"], ours["sender_mac"], ours["sender_ip"], ours["target_mac"], ours["target_ip"]) == \
                   (arp.op, arp.hwsrc, arp.psrc, arp.hwdst, arp.pdst), packet.number
            assert (ours["hardware_type"], ours["protocol_type"], ours["hardware_size"], ours["protocol_size"]) == (arp.hwtype, arp.ptype, arp.hwlen, arp.plen)
            continue
        ip, ours = reference[IP], packet.layers["ip"]
        assert (ours["src"], ours["dst"], ours["ttl"], ours["protocol"], ours["id"], ours["total_length"]) == \
               (ip.src, ip.dst, ip.ttl, ip.proto, ip.id, ip.len), packet.number
        assert ip.chksum == _recomputed(ip), "builder wrote a wrong IP checksum in packet %d" % packet.number
        if TCP in reference:
            tcp, mine = reference[TCP], packet.layers["tcp"]
            assert (mine["srcport"], mine["dstport"], mine["seq"], mine["ack"], mine["window"]) == (tcp.sport, tcp.dport, tcp.seq, tcp.ack, tcp.window)
            assert int(tcp.flags) & 0x1FF == mine["flags"]
            carried = tcp.getlayer(Raw)                       # scapy counts Ethernet padding as TCP payload; Raw is the data
            assert (bytes(carried) if carried is not None else b"") == mine["payload"], packet.number
            assert tcp.chksum == _recomputed(ip, TCP), "wrong TCP checksum in packet %d" % packet.number
        elif UDP in reference:
            udp, mine = reference[UDP], packet.layers["udp"]
            assert (mine["srcport"], mine["dstport"], mine["length"]) == (udp.sport, udp.dport, udp.len)
            assert udp.chksum == _recomputed(ip, UDP), "wrong UDP checksum in packet %d" % packet.number
            if DNS in reference:
                dns, dmine = reference[DNS], packet.layers["dns"]
                assert dmine["id"] == dns.id and dmine["response"] == bool(dns.qr)
                assert dmine["questions"][0][0] == dns.qd.qname.decode().rstrip(".")
                if dns.an:
                    assert dmine["answers"][0][2] == dns.an.rdata
        elif ICMP in reference:
            icmp, mine = reference[ICMP], packet.layers["icmp"]
            assert (mine["type"], mine["code"], mine["identifier"], mine["sequence"]) == (icmp.type, icmp.code, icmp.id, icmp.seq)
            assert icmp.chksum == _recomputed(ip, ICMP), "wrong ICMP checksum in packet %d" % packet.number
        assert packet.fields["ip.src"] == [ip.src] and packet.fields["ip.addr"] == [ip.src, ip.dst]
        assert not (Raw in reference and TCP not in reference and UDP not in reference and ICMP not in reference)


def _recomputed(ip, layer=None):
    """The checksum scapy itself would write for this packet (ours must equal it)."""
    from scapy.layers.inet import IP
    clone = IP(bytes(ip))
    target = clone if layer is None else clone[layer]
    del target.chksum
    rebuilt = IP(bytes(clone))
    return (rebuilt if layer is None else rebuilt[layer]).chksum


# ----------------------------------------------------------------------------------------------- the lab's facts
def test_scenario_has_what_the_manual_asks_for(session):
    protocols = {p.top for p in session.packets}
    assert {"ARP", "DNS", "TCP", "HTTP", "ICMP"} <= protocols
    arp_request, arp_reply = session.packet(1), session.packet(2)
    assert arp_request.info == "Who has 192.168.1.1? Tell 192.168.1.10"
    assert arp_reply.info == "192.168.1.1 is at 00:0c:29:7e:41:b2"
    assert arp_request.layers["eth"]["padding"] == 18 and arp_request.length == 60
    assert arp_request.source == "PcsCompu_3a:5c:11" and arp_request.destination == "Broadcast"
    post = next(p for p in session.packets if p.fields.get("http.request.method") == ["POST"])
    assert post.layers["http"]["form"] == [("uname", scenario.LOGIN_USER), ("pass", scenario.LOGIN_PASSWORD)]
    assert post.info == "POST /login.php HTTP/1.1  (application/x-www-form-urlencoded)"


def test_info_column_matches_wireshark_wording(session):
    info = {p.number: p.info for p in session.packets}
    assert info[5] == "52418 → 80 [SYN] Seq=0 Win=64240 Len=0 MSS=1460 WS=256 SACK_PERM"
    assert info[6] == "80 → 52418 [SYN, ACK] Seq=0 Ack=1 Win=65535 Len=0 MSS=1460 WS=128 SACK_PERM"
    assert info[7] == "52418 → 80 [ACK] Seq=1 Ack=1 Win=131328 Len=0"           # 513 << 8: the window is scaled once both SYNs agree
    assert info[8] == "GET /wireshark-labs/INTRO-wireshark-file1.html HTTP/1.1 "
    assert info[10] == "HTTP/1.1 200 OK  (text/html)"
    assert info[12].startswith("52418 → 80 [FIN, ACK] Seq=334 Ack=324")
    assert info[15] == "Echo (ping) request  id=0x0001, seq=1/256, ttl=128 (reply in 16)"
    assert info[16] == "Echo (ping) reply    id=0x0001, seq=1/256, ttl=64 (request in 15)"
    assert info[3] == "Standard query 0x4a2b A gaia.cs.umass.edu"
    assert info[4] == "Standard query response 0x4a2b A gaia.cs.umass.edu A 128.119.245.12"


def test_colours_follow_wireshark_default_rules(session):
    rules = {p.number: p.color[0] for p in session.packets}
    assert rules[1] == "ARP" and rules[15] == "ICMP" and rules[3] == "UDP" and rules[8] == "HTTP"
    assert session.packet(1).color[1] == "#FAF0D7" and session.packet(3).color[1] == "#DAEEFF"


def _walk(nodes, size, parent=None):
    for node in nodes:
        assert 0 <= node["start"] <= node["end"] <= size, node["label"]
        if parent and node["end"] > node["start"] and parent["end"] > parent["start"] and not node["label"].startswith(("Padding", "UDP payload", "TCP payload")):
            assert parent["start"] <= node["start"] and node["end"] <= parent["end"], (parent["label"], node["label"])
        _walk(node["children"], size, node)


def test_details_tree_offsets_stay_inside_their_parents(session):
    for packet in session.packets:
        detail = session.detail(packet.number)
        _walk(detail["tree"], len(packet.data))
        rebuilt = b"".join(bytes.fromhex("".join(row["hex"])) for row in detail["hex"])
        assert rebuilt == packet.data


def test_ethernet_and_arp_fields_for_the_post_experiment_table(session):
    detail = session.detail(1)
    labels = []

    def collect(nodes):
        for node in nodes:
            labels.append(node["label"])
            collect(node["children"])
    collect(detail["tree"])
    for expected in ("Frame 1: 60 bytes on wire (480 bits), 60 bytes captured (480 bits)", "Type: ARP (0x0806)", "Hardware type: Ethernet (1)",
                     "Protocol type: IPv4 (0x0800)", "Hardware size: 6", "Protocol size: 4", "Opcode: request (1)",
                     "Sender IP address: 192.168.1.10", "Target IP address: 192.168.1.1", "Padding: " + "00" * 18):
        assert expected in labels, expected
    assert ".... ..1. .... .... .... .... = LG bit: Locally administered address (this is NOT the factory default)" in labels
    assert ".... ...1 .... .... .... .... = IG bit: Group address (multicast/broadcast)" in labels


def test_tcp_flag_lines_and_relative_numbers(session):
    labels = []

    def collect(nodes):
        for node in nodes:
            labels.append(node["label"])
            collect(node["children"])
    collect(session.detail(8)["tree"])
    assert "Flags: 0x018 (PSH, ACK)" in labels
    assert "000. .... .... = Reserved: Not set" in labels
    assert ".... .... 1... = Push: Set" in labels
    assert ".... ...1 .... = Acknowledgment: Set" in labels
    assert ".... .... ..0. = Syn: Not set" in labels
    assert "Sequence Number: 1    (relative sequence number)" in labels
    assert "Acknowledgment Number: 1    (relative ack number)" in labels


# ----------------------------------------------------------------------------------------------- display filters
@pytest.mark.parametrize("expression, expected", [
    ("arp", [1, 2]),
    ("icmp", [15, 16, 17, 18]),
    ("dns", [3, 4, 19, 20]),
    ("http", [8, 10, 24, 26, 34, 36]),
    ("ip.addr == 192.168.1.1", [3, 4, 15, 16, 17, 18, 19, 20]),
    ("ip.src == 192.168.1.1 and icmp", [16, 18]),
    ("ip.dst == 198.51.100.20 and tcp.flags.syn == 1", [21, 31]),
    ('http.request.method == "POST"', [34]),
    ('http.request.method == "GET" || http.response.code == 200', [8, 10, 24, 26, 36]),
    ("tcp.port == 52437 and tcp.len > 0", [34, 36]),
    (f'http contains "{scenario.LOGIN_PASSWORD}"', [34]),
    ('frame contains "Welcome"', [36]),
    ("eth.dst == ff:ff:ff:ff:ff:ff", [1]),
    ("ip.dst == 198.51.100.20 and tcp.stream == 2 and tcp.len == 0 and not tcp.flags.fin == 1", [31, 33, 37, 40]),
    ("ip.addr in {128.119.245.12, 192.168.1.1} and udp", [3, 4, 19, 20]),
    ("arp.opcode == 2", [2]),
    ("frame.number >= 38", [38, 39, 40]),
    ("!(tcp or udp or icmp)", [1, 2]),
    ("ip.src != 192.168.1.10 and icmp", [16, 18]),
    ("ip.addr != 192.168.1.1 and udp", []),                                     # != means no address of the packet equals it
    ("ip.addr != 128.119.245.12 and http", [24, 26, 34, 36]),
    (f'urlencoded-form.value == "{scenario.LOGIN_PASSWORD}"', [34]),
    ('dns.qry.name == "login.labmate.test" and dns.flags.response == 1', [20]),
])
def test_display_filters(session, expression, expected):
    assert apply_filter(session, expression) == expected, expression


@pytest.mark.parametrize("expression, message", [
    ("htp", 'is not a valid protocol or protocol field'),
    ("tcp == 80", 'is a protocol and cannot be compared'),
    ("ipv6.addr == fe80::zz", 'unexpected in this context'),
    ("ip.addr ==", "cannot be used as a value"),
    ("(arp", "to close the parenthesis"),
    ("arp and", "Unexpected end"),
    ("ip.addr == 192.168.1.1 192.168.1.2", "unexpected in this context"),
    ("tcp.flags.syn == @", "unexpected in this context"),
])
def test_bad_filters_report_like_wireshark(expression, message):
    with pytest.raises(FilterError, match=message):
        compile_filter(expression)


def test_empty_filter_shows_everything(session):
    assert len(apply_filter(session, "")) == 40


# ----------------------------------------------------------------------------------------------- follow stream
def test_follow_tcp_stream_shows_the_clear_text_login(session, built):
    post = next(p for p in session.packets if p.fields.get("http.request.method") == ["POST"])
    stream = session.stream_text(post.stream)
    assert stream["client"].startswith("192.168.1.10:") and stream["server"] == "198.51.100.20:80"
    assert stream["turns"] == 2 and stream["client_packets"] == 6 and stream["server_packets"] == 4
    first, second = stream["chunks"]
    assert first["side"] == "c" and second["side"] == "s"
    assert first["text"].endswith("uname=%s&pass=%s" % (scenario.LOGIN_USER, scenario.LOGIN_PASSWORD))
    assert "Welcome, student01" in second["text"]
    assert session.stream_text(post.stream) == stream                            # asking twice gives the same text


def test_retransmitted_data_is_shown_once():
    data, _ = scenario.build_scenario()
    capture = read_capture(data)
    frames = [(f.timestamp, f.data) for f in capture.frames]
    request_frame = frames[7]
    frames.insert(8, (request_frame[0] + 0.0001, request_frame[1]))               # the same segment again
    session = open_session(write_pcap(frames))
    stream = session.stream_text(session.packet(8).stream)
    assert stream["chunks"][0]["text"].count("GET /wireshark-labs") == 1


def test_unknown_numbers_raise(session):
    with pytest.raises(KeyError):
        session.packet(0)
    with pytest.raises(KeyError):
        session.packet(41)
    with pytest.raises(KeyError):
        session.stream_text(99)


def test_scenario_is_identical_every_time():
    assert scenario.build_scenario()[0] == scenario.build_scenario()[0]


# ----------------------------------------------------------------------------------------------- the experiment's answers
def test_exp5_tables_are_read_from_the_packets():
    from app.netlab import wireshark_lab
    session, source, _ = wireshark_lab.load(None)
    assert source == "scenario"
    ethernet, arp = wireshark_lab.tables(session)
    rows = {row[1]: row[2] for row in ethernet["rows"]}
    assert rows["Frame length of the packet"] == "60 bytes (480 bits)"
    assert rows["Frame number"] == "1"
    assert rows["Type of frame (Ether-type number)"] == "0x0806 (ARP)"
    assert rows["Can you say that there is padding in the payload?"].startswith("Yes. 18 bytes of padding")
    assert rows["Destination link-layer address"] == "Broadcast (ff:ff:ff:ff:ff:ff)"
    assert rows["Source link-layer address"] == "PcsCompu_3a:5c:11 (08:00:27:3a:5c:11)"
    assert rows["Upper layer protocol"] == "ARP"
    assert rows["Is destination link-layer address unicast or broadcast?"].startswith("Broadcast")
    assert len(ethernet["rows"]) == 8 and len(arp["rows"]) == 11
    answers = {row[1]: row[2] for row in arp["rows"]}
    assert answers["Hardware type"] == "Ethernet (1)" and answers["Protocol type"] == "IPv4 (0x0800)"
    assert answers["Hardware size"] == "6 bytes" and answers["Protocol size"] == "4 bytes"
    assert answers["Source IP address"] == "192.168.1.10" and answers["Destination IP address"] == "192.168.1.1"
    assert answers["Destination hardware address"].startswith("00:00:00:00:00:00")
    assert answers["Number of bytes of padding in a frame"] == "18 bytes"
    assert answers["Is it an ARP request or reply packet?"] == "ARP request (opcode 1)"
    differences = answers["Two differences between ARP request and reply packets"]
    assert "opcode 1" in differences and "opcode 2" in differences and "00:0c:29:7e:41:b2" in differences


def test_exp5_plan_covers_every_screenshot_the_manual_lists():
    from app.netlab import wireshark_lab
    session, source, _ = wireshark_lab.load(None)
    steps, missing = wireshark_lab.plan(session)
    assert missing == []
    assert [s["id"] for s in steps] == ["interface", "sniffing", "filter_arp", "filter_http", "filter_tcp", "filter_icmp", "filter_ip",
                                        "ethernet", "arp", "login_page", "http_post", "follow"]
    post = next(s for s in steps if s["id"] == "http_post")
    assert "uname" in post["explain"] and scenario.LOGIN_PASSWORD in post["explain"]
    assert scenario.LOGIN_PASSWORD in next(s for s in steps if s["id"] == "follow")["explain"]
    state = wireshark_lab.studio_state(session, source, steps)
    assert len(state["packets"]) == 40 and state["filters"]["arp"] == [1, 2] and state["filters"][""][0] == 1
    assert state["details"]["34"]["tree"] and state["streams"]["2"]["turns"] == 2
    assert all(isinstance(key, str) for key in (*state["details"], *state["streams"], *state["filters"]))   # browsers need string keys


def test_a_capture_without_a_login_leaves_those_screenshots_out_and_says_so():
    from app.netlab import wireshark_lab
    data, _ = scenario.build_scenario()
    frames = [(f.timestamp, f.data) for f in read_capture(data).frames[:4]] + \
             [(f.timestamp, f.data) for f in read_capture(data).frames[14:18]]          # ARP, DNS, ICMP only
    session, source, _ = wireshark_lab.load(write_pcap(frames))
    assert source == "uploaded"
    steps, missing = wireshark_lab.plan(session)
    assert not any(s["id"] in {"login_page", "http_post", "follow"} for s in steps)
    assert any("login" in m or "HTTP form" in m for m in missing)
    assert any("No HTTP packets" in m for m in missing)
    assert [s["id"] for s in steps if s["id"].startswith("filter_")] == ["filter_arp", "filter_icmp", "filter_ip"]


# ----------------------------------------------------------------------------------------------- untrusted input
def test_corrupted_captures_never_crash_the_decoder():
    """A student's file is untrusted: flip bytes, truncate frames and cut headers; every packet must still list and open."""
    import random
    data, _ = scenario.build_scenario()
    frames = [(f.timestamp, bytearray(f.data)) for f in read_capture(data).frames]
    rng = random.Random(20261115)
    for round_number in range(300):
        mutated = []
        for timestamp, frame in frames:
            frame = bytearray(frame)
            roll = rng.random()
            if roll < 0.35 and frame:
                for _ in range(rng.randint(1, 6)):
                    frame[rng.randrange(len(frame))] = rng.randrange(256)
            elif roll < 0.55:
                del frame[rng.randrange(1, len(frame) + 1):]
            elif roll < 0.65:
                frame.extend(rng.randbytes(rng.randint(1, 40)))
            mutated.append((timestamp, bytes(frame)))
        try:
            session = open_session(write_pcap(mutated))
        except CaptureError:
            continue
        for packet in session.packets:
            session.detail(packet.number)
        for expression in ("arp", "http", "tcp.port == 80", 'http contains "pass"', "ip.addr == 192.168.1.10", "dns and udp", "not icmp"):
            apply_filter(session, expression)
        for index in range(len(session.streams)):
            session.stream_text(index)
        assert len(session.rows()) == len(session.packets)


def _frame(ethertype, payload, dst="ff:ff:ff:ff:ff:ff", src="08:00:27:3a:5c:11"):
    return scenario.ethernet(dst, src, ethertype, payload)


def test_other_real_world_protocols_decode_without_pretending():
    import socket
    import struct as s
    vlan = _frame(0x8100, s.pack("!HH", 0x0064, 0x0806) + scenario.arp_message(1, "08:00:27:3a:5c:11", "10.0.0.2", "00:00:00:00:00:00", "10.0.0.1"))
    query = scenario.dns_query(0, "printer._tcp.local")
    udp = s.pack("!HHHH", 5353, 5353, 8 + len(query), 0) + query
    ipv6_header = s.pack("!IHBB", 0x60000000, len(udp), 17, 255) + socket.inet_pton(socket.AF_INET6, "fe80::1") + socket.inet_pton(socket.AF_INET6, "ff02::fb")
    mdns = _frame(0x86DD, ipv6_header + udp, dst="33:33:00:00:00:fb")
    tls = scenario.ipv4("10.0.0.2", "93.184.216.34", 6, scenario.tcp_segment("10.0.0.2", "93.184.216.34", 50000, 443, 1, 1, 0x18,
                                                                          b"\x16\x03\x01\x00\x05\x01\x00\x00\x01\x00"), 7)
    fragment = scenario.ipv4("10.0.0.2", "10.0.0.9", 17, b"x" * 24, 9, dont_fragment=False)
    fragment = fragment[:6] + s.pack("!H", 0x2000 | 0) + fragment[8:]
    unknown = _frame(0x88B5, b"vendor specific payload")
    session = open_session(write_pcap([(1.0, vlan), (1.1, mdns), (1.2, _frame(0x0800, tls)), (1.3, _frame(0x0800, fragment)), (1.4, unknown)]))
    rows = session.rows()
    assert session.packet(1).layers["eth"]["vlan"] == 100 and rows[0]["info"] == "Who has 10.0.0.1? Tell 10.0.0.2"
    assert rows[1]["source"] == "fe80::1" and rows[1]["destination"] == "ff02::fb" and rows[1]["protocol"] == "MDNS"
    assert rows[1]["info"] == "Standard query 0x0000 PTR printer._tcp.local" or "printer._tcp.local" in rows[1]["info"]
    assert rows[2]["protocol"] == "TLSv1" and rows[2]["info"] == "Client Hello"
    assert rows[3]["info"].startswith("Fragmented IP protocol")
    assert rows[4]["protocol"] == "Ethernet" and rows[4]["info"] == "Ethernet type 0x88b5"
    assert apply_filter(session, "arp") == [1] and apply_filter(session, "ipv6") == [2] and apply_filter(session, "tls") == [3]
