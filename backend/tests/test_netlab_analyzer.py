"""Packet analyser (2026-11-20): sample captures cross-checked against scapy, display filters, Apply as Filter on every details
line, statistics, Find Packet, export/save, and live capture through a stand-in for dumpcap."""
import os
import struct
import sys
import textwrap
from collections import Counter
from pathlib import Path

import pytest
from scapy.all import ARP, BOOTP, DHCP, DNS, ICMP, IP, TCP, UDP, Ether, ICMPv6EchoRequest, IPerror, IPv6, TCPerror, UDPerror, rdpcap

from app.netlab import live, stats, tools, wireshark_lab
from app.netlab.dfilter import FilterError, apply_filter, check_filter, compile_filter
from app.netlab.dissect import open_session
from app.netlab.pcap import read_capture

SAMPLES = Path(wireshark_lab.__file__).with_name("samples")
FILES = sorted(p.name for p in SAMPLES.iterdir() if p.suffix in (".pcap", ".pcapng"))


@pytest.fixture(scope="module")
def sessions():
    return {name: open_session((SAMPLES / name).read_bytes()) for name in FILES}


@pytest.fixture(scope="module")
def scapy_packets():
    return {name: rdpcap(str(SAMPLES / name)) for name in FILES}


def test_every_sample_is_listed_and_opens(sessions):
    listed = {entry["file"] for key, entry in wireshark_lab.SAMPLE_CAPTURES.items() if key != "practice"}
    assert listed == set(FILES)
    for name, session in sessions.items():
        assert session.packets, name
        assert not [p.number for p in session.packets if "Malformed" in p.info], name
    assert read_capture((SAMPLES / "http-browsing.pcap").read_bytes()).format == "pcap"
    assert read_capture((SAMPLES / "dns-queries.pcapng").read_bytes()).format == "pcapng"


# ---------------------------------------------------------------------------------------- against scapy
def test_addresses_ports_and_lengths_match_scapy(sessions, scapy_packets):
    for name in FILES:
        for ours, theirs in zip(sessions[name].packets, scapy_packets[name]):
            assert ours.length == len(theirs)
            assert ours.layers["eth"]["src"] == theirs[Ether].src and ours.layers["eth"]["dst"] == theirs[Ether].dst
            for layer in (IP, IPv6):
                if theirs.haslayer(layer):
                    assert ours.layers["ip"]["src"] == theirs[layer].src and ours.layers["ip"]["dst"] == theirs[layer].dst
                    break
            if theirs.haslayer(ICMP):                       # an ICMP error quotes a UDP/TCP header; checked separately below
                continue
            for layer, key in ((TCP, "tcp"), (UDP, "udp")):
                if theirs.haslayer(layer):
                    assert (ours.layers[key]["srcport"], ours.layers[key]["dstport"]) == (theirs[layer].sport, theirs[layer].dport)


def test_dhcp_decoding_matches_scapy(sessions, scapy_packets):
    kinds = {1: "Discover", 2: "Offer", 3: "Request", 5: "ACK", 7: "Release"}
    name = "dhcp-arp.pcapng"
    seen = []
    for ours, theirs in zip(sessions[name].packets, scapy_packets[name]):
        if not theirs.haslayer(DHCP):
            continue
        options = {o[0]: o[1] for o in theirs[DHCP].options if isinstance(o, tuple)}
        assert ours.top == "DHCP"
        assert ours.layers["dhcp"]["xid"] == theirs[BOOTP].xid
        assert ours.layers["dhcp"]["message"] == kinds[options["message-type"]]
        assert ours.fields["dhcp.ip.your"] == [theirs[BOOTP].yiaddr]
        assert ours.info == "DHCP %s - Transaction ID 0x%x" % (kinds[options["message-type"]], theirs[BOOTP].xid)
        if "server_id" in options:
            assert ours.fields["dhcp.option.dhcp_server_id"] == [options["server_id"]]
        if "lease_time" in options:
            assert ours.fields["dhcp.option.ip_address_lease_time"] == [options["lease_time"]]
        seen.append(ours.layers["dhcp"]["message"])
    assert seen[:4] == ["Discover", "Offer", "Request", "ACK"] and seen[-1] == "Release"


def test_dns_decoding_matches_scapy(sessions, scapy_packets):
    name = "dns-queries.pcapng"
    for ours, theirs in zip(sessions[name].packets, scapy_packets[name]):
        dns = theirs[DNS]
        assert ours.fields["dns.id"] == [dns.id]
        assert ours.fields["dns.qry.name"] == [dns.qd[0].qname.decode().rstrip(".")]
        assert ours.fields["dns.flags.rcode"] == [dns.rcode]
        assert ours.fields["dns.count.answers"] == [dns.ancount]
        answers = [rr for rr in (dns.an or [])]
        assert len(ours.fields["dns.resp.name"]) == len(answers) + len(dns.ns or [])
        expected_a = [rr.rdata for rr in answers if rr.type == 1]
        assert ours.fields["dns.a"] == expected_a
    nxdomain = next(p for p in sessions[name].packets if p.fields["dns.flags.rcode"] == [3])
    assert "No such name" in nxdomain.info and "SOA ns1.example.com" in nxdomain.info
    query = sessions[name].packets[0]
    assert query.fields["dns.response_in"] == [2] and sessions[name].packets[1].fields["dns.response_to"] == [1]


def test_icmp_and_icmpv6_match_scapy(sessions, scapy_packets):
    name = "icmp-ping-traceroute.pcapng"
    for ours, theirs in zip(sessions[name].packets, scapy_packets[name]):
        if theirs.haslayer(ICMP):
            assert ours.fields["icmp.type"][0] == theirs[ICMP].type and ours.fields["icmp.code"][0] == theirs[ICMP].code
            if theirs.haslayer(IPerror):                    # the datagram an ICMP error quotes is decoded as well
                assert theirs[IPerror].src in ours.fields["ip.src"] and theirs[IPerror].dst in ours.fields["ip.dst"]
        if theirs.haslayer(ICMPv6EchoRequest):
            assert ours.fields["icmpv6.echo.sequence_number"] == [theirs[ICMPv6EchoRequest].seq]
    infos = [p.info for p in sessions[name].packets]
    assert sum("Time-to-live exceeded" in i for i in infos) == 4
    assert any("Port unreachable" in i for i in infos)
    assert any(i.startswith("Neighbor Advertisement") and "is at f8:bc:12:4e:20:01" in i for i in infos)
    reply = next(p for p in sessions[name].packets if p.fields.get("icmp.type") == [0])
    assert reply.fields["icmp.resptime"][0] > 0


# ---------------------------------------------------------------------------------------- display filters
def _scapy_count(packets, test):
    return sum(1 for packet in packets if test(packet))


def _ipv4_addresses(packet):
    """Addresses of every IPv4 header in the packet, including the one an ICMP error quotes (Wireshark matches both)."""
    out, layer = set(), packet
    while layer:
        if isinstance(layer, IP):
            out.update({layer.src, layer.dst})
        layer = layer.payload if layer.payload else None
    return out


REQUIRED_FILTERS = [
    ("ip", lambda p: p.haslayer(IP)),
    ("ipv6", lambda p: p.haslayer(IPv6)),
    ("tcp", lambda p: p.haslayer(TCP) or p.haslayer(TCPerror)),
    ("udp", lambda p: p.haslayer(UDP) or p.haslayer(UDPerror)),
    ("dns", lambda p: p.haslayer(DNS)),
    ("icmp", lambda p: p.haslayer(ICMP)),
    ("arp", lambda p: p.haslayer(ARP)),
    ("dhcp", lambda p: p.haslayer(DHCP)),
    ("tcp.port == 80", lambda p: p.haslayer(TCP) and 80 in (p[TCP].sport, p[TCP].dport)),
    ("udp.port == 53", lambda p: p.haslayer(UDP) and 53 in (p[UDP].sport, p[UDP].dport)),
    ("ip.addr == 192.168.1.1", lambda p: "192.168.1.1" in _ipv4_addresses(p)),
    ("tcp.flags.syn == 1", lambda p: p.haslayer(TCP) and bool(p[TCP].flags & 0x02)),
    ("tcp.flags.syn == 1 && tcp.flags.ack == 0", lambda p: p.haslayer(TCP) and p[TCP].flags & 0x12 == 0x02),
    ("ip.addr == 192.168.1.0/24 and not arp", lambda p: any(a.startswith("192.168.1.") for a in _ipv4_addresses(p))),
    ("eth.dst == ff:ff:ff:ff:ff:ff", lambda p: p[Ether].dst == "ff:ff:ff:ff:ff:ff"),
    ("ipv6.addr == fe80::fabc:12ff:fe4e:2001", lambda p: p.haslayer(IPv6) and "fe80::fabc:12ff:fe4e:2001" in (p[IPv6].src, p[IPv6].dst)),
]


@pytest.mark.parametrize("expression,truth", REQUIRED_FILTERS, ids=[f for f, _ in REQUIRED_FILTERS])
def test_required_filters_count_what_scapy_counts(expression, truth, sessions, scapy_packets):
    for name in FILES:
        assert len(apply_filter(sessions[name], expression)) == _scapy_count(scapy_packets[name], truth), name


def test_http_filter_and_its_fields(sessions):
    session = sessions["http-browsing.pcap"]
    assert apply_filter(session, "http") == [6, 8, 10, 11, 13, 14]
    assert apply_filter(session, 'http.request.method == "POST"') == [13]
    assert apply_filter(session, "http.response.code == 404") == [11]
    assert apply_filter(session, 'http.host matches "EXAMPLE\\\\.com"') == [6, 10, 13]
    assert apply_filter(session, "tcp.flags.reset == 1") == [21]
    assert apply_filter(session, 'urlencoded-form.key == "password"') == [13]
    assert session.packets[5].fields["http.response_in"] == [8] and session.packets[7].fields["http.request_in"] == [6]


def test_every_details_line_filters_back_to_its_packet(sessions):
    """Apply as Filter > Selected on any line must select that packet (Wireshark's guarantee)."""
    checked = 0
    for name, session in sessions.items():
        for packet in session.packets:
            stack = [node.to_dict() for node in packet.tree]
            while stack:
                node = stack.pop()
                stack.extend(node["children"])
                if "filter" not in node:
                    continue
                predicate = compile_filter(node["filter"])
                assert predicate(packet), (name, packet.number, node["filter"])
                checked += 1
    assert checked > 2000


@pytest.mark.parametrize("expression,valid,warns", [
    ("tcp.port == 80", True, False), ("ip.addr==192.168.1.1", True, False), ("bootp", True, True), ("tcp.port == ", False, False),
    ("tcp.prot == 80", False, False), ("frame.time_relative > 1.5", True, False), ('dns.qry.name contains "example"', True, False),
    ('http.host matches "("', False, False), ("tcp == 80", False, False),
])
def test_filter_bar_feedback(expression, valid, warns):
    result = check_filter(expression)
    assert result["valid"] is valid and bool(result["warning"]) is warns and bool(result["error"]) is not valid


def test_deprecated_name_still_filters(sessions):
    assert apply_filter(sessions["dhcp-arp.pcapng"], "bootp") == apply_filter(sessions["dhcp-arp.pcapng"], "dhcp")


# ---------------------------------------------------------------------------------------- statistics
def test_protocol_hierarchy_counts(sessions, scapy_packets):
    session = sessions["http-browsing.pcap"]
    rows = {row["abbrev"]: row for row in stats.protocol_hierarchy(session)["rows"]}
    assert rows["frame"]["packets"] == 21 and rows["frame"]["percent_packets"] == 100.0
    assert rows["frame"]["bytes"] == sum(len(p) for p in scapy_packets["http-browsing.pcap"])
    assert rows["tcp"]["packets"] == 19 and rows["udp"]["packets"] == 2 and rows["http"]["packets"] == 6
    assert rows["ip"]["bytes"] == rows["frame"]["bytes"] - 14 * 21
    assert rows["tcp"]["end_packets"] == 13
    filtered = stats.protocol_hierarchy(session, apply_filter(session, "http"))
    assert filtered["packets"] == 6


def test_conversations_and_endpoints(sessions):
    session = sessions["http-browsing.pcap"]
    tcp = stats.conversations(session, "tcp")["rows"]
    assert [(r["port_a"], r["port_b"], r["packets"]) for r in tcp] == [(50214, 80, 17), (50220, 8080, 2)]
    first = tcp[0]
    assert first["address_a"] == "192.168.1.10" and first["packets_ab"] + first["packets_ba"] == 17
    assert first["bytes"] == sum(p.original_length for p in session.packets if p.stream == 0)
    ipv4 = stats.endpoints(session, "ipv4")["rows"]
    pc = next(r for r in ipv4 if r["address"] == "192.168.1.10")
    assert pc["packets"] == 21 and pc["tx_packets"] + pc["rx_packets"] == 21
    eth = stats.conversations(sessions["dhcp-arp.pcapng"], "eth")["rows"]
    assert sum(r["packets"] for r in eth) == 15
    v6 = stats.endpoints(sessions["icmp-ping-traceroute.pcapng"], "ipv6")["rows"]
    assert {r["address"] for r in v6} == {"fe80::21b:21ff:fe3a:4f5c", "fe80::fabc:12ff:fe4e:2001", "ff02::1:ff4e:2001"}
    udp = stats.conversations(sessions["dns-queries.pcapng"], "udp")["rows"]
    assert len(udp) == 7 and sorted(r["stream"] for r in udp) == list(range(7))      # the retried query reuses its port


def test_capture_properties(sessions):
    data = (SAMPLES / "dns-queries.pcapng").read_bytes()
    props = stats.capture_properties(sessions["dns-queries.pcapng"], {"name": "dns-queries.pcapng", "length": len(data), "format": "pcapng"},
                                     apply_filter(sessions["dns-queries.pcapng"], "ipv6"))
    assert props["captured"]["packets"] == 15 and props["displayed"]["packets"] == 2
    assert props["file"]["format"] == "Wireshark/... - pcapng" and props["time"]["first_packet"].startswith("2026-11-20 09:30:00")
    assert props["captured"]["time_span"] == pytest.approx(10.260, abs=0.001)


# ---------------------------------------------------------------------------------------- find, export
def test_find_packet(sessions):
    session = sessions["http-browsing.pcap"]
    assert tools.find_packet(session, "filter", "list", "http.response.code == 404")["number"] == 11
    assert tools.find_packet(session, "string", "list", "favicon", after=0)["number"] == 10
    hit = tools.find_packet(session, "string", "details", "Set-Cookie")
    assert hit["number"] == 14 and hit["path"] and hit["range"]
    hit = tools.find_packet(session, "hex", "bytes", "f8:bc:12")
    assert hit["number"] == 1 and hit["range"] == [0, 3]
    hit = tools.find_packet(session, "string", "bytes", "PASSWORD")                 # not case sensitive by default
    assert hit["number"] == 8
    assert tools.find_packet(session, "string", "bytes", "PASSWORD", case_sensitive=True) is None
    assert tools.find_packet(session, "regex", "list", r"\[RST", after=21)["number"] == 21     # wraps round
    assert tools.find_packet(session, "string", "list", "GET", after=10, backward=True)["number"] == 6
    with pytest.raises(tools.FindError):
        tools.find_packet(session, "hex", "bytes", "zz")


@pytest.mark.parametrize("fmt", ["pcap", "pcapng"])
def test_export_round_trip(sessions, fmt):
    session = sessions["icmp-ping-traceroute.pcapng"]
    everything = read_capture(tools.export_capture(session, None, fmt))
    assert everything.format == fmt and [f.data for f in everything.frames] == [p.data for p in session.packets]
    assert [round(f.timestamp, 6) for f in everything.frames] == [round(p.epoch, 6) for p in session.packets]
    shown = apply_filter(session, "icmpv6")
    subset = read_capture(tools.export_capture(session, shown, fmt))
    assert [f.data for f in subset.frames] == [session.packets[n - 1].data for n in shown]


def test_dissection_exports(sessions):
    session = sessions["dns-queries.pcapng"]
    text = tools.export_text(session, [1, 2], details=True, include_bytes=True)
    assert text.count("No.     Time") == 2 and "Domain Name System (response)" in text and "    Transaction ID: 0x1a2b" in text
    assert "0000  " in text
    csv_text = tools.export_csv(session, None).splitlines()
    assert csv_text[0] == '"No.","Time","Source","Destination","Protocol","Length","Info"' and len(csv_text) == 16


# ---------------------------------------------------------------------------------------- live capture
def test_live_capture_is_off_by_default(monkeypatch):
    monkeypatch.setattr(live.settings, "NETLAB_LIVE_CAPTURE", False)
    listing = live.list_interfaces()
    assert listing["available"] is False and "switched off" in listing["reason"] and listing["interfaces"] == []
    with pytest.raises(live.LiveCaptureError):
        live.start("eth0")


@pytest.fixture()
def fake_dumpcap(tmp_path, monkeypatch):
    """A stand-in for dumpcap: lists two interfaces and 'captures' by writing a sample file, one packet at a time."""
    script = tmp_path / "fake_dumpcap.py"
    script.write_text(textwrap.dedent('''
        import sys, time
        args = sys.argv[1:]
        if args == ["-D"]:
            print("1. \\\\Device\\\\NPF_{0000-TEST} (Ethernet)")
            print("2. \\\\Device\\\\NPF_Loopback (Adapter for loopback traffic capture)")
            sys.exit(0)
        out = args[args.index("-w") + 1]
        data = open(sys.argv[0].replace("fake_dumpcap.py", "sample.pcap"), "rb").read()
        with open(out, "wb") as handle:
            handle.write(data[:24]); handle.flush()
            position = 24
            while position < len(data):
                import struct
                length = struct.unpack("<I", data[position + 8:position + 12])[0]
                handle.write(data[position:position + 16 + length]); handle.flush()
                position += 16 + length
                time.sleep(0.02)
        time.sleep(30)
    '''))
    (tmp_path / "sample.pcap").write_bytes((SAMPLES / "http-browsing.pcap").read_bytes())
    if os.name == "nt":
        tool = tmp_path / "dumpcap.cmd"
        tool.write_text('@"%s" "%s" %%*\n' % (sys.executable, script))
    else:
        tool = tmp_path / "dumpcap"
        tool.write_text('#!/bin/sh\nexec "%s" "%s" "$@"\n' % (sys.executable, script))
        tool.chmod(0o755)
    monkeypatch.setattr(live.settings, "NETLAB_LIVE_CAPTURE", True)
    monkeypatch.setattr(live.settings, "NETLAB_CAPTURE_TOOL", str(tool))
    return tool


def test_live_capture_through_dumpcap(fake_dumpcap):
    import time
    listing = live.list_interfaces()
    assert listing["available"] and [i["id"] for i in listing["interfaces"]] == ["\\Device\\NPF_{0000-TEST}", "\\Device\\NPF_Loopback"]
    assert listing["interfaces"][0]["name"] == "Ethernet"
    with pytest.raises(live.LiveCaptureError, match="Choose one"):
        live.start("eth9")
    with pytest.raises(live.LiveCaptureError, match="not allowed"):
        live.start("\\Device\\NPF_{0000-TEST}", capture_filter="port 80; rm -rf /")
    job = live.start("\\Device\\NPF_{0000-TEST}", capture_filter="tcp port 80", max_packets=100, max_seconds=20)
    deadline = time.time() + 20
    count = 0
    while time.time() < deadline:
        capture = job.read()
        count = len(capture.frames) if capture else 0
        if count >= 21:
            break
        time.sleep(0.2)
    assert count == 21 and job.running()
    capture, data, error, interface = live.finish(job.id)
    assert len(capture.frames) == 21 and data[:4] == b"\xd4\xc3\xb2\xa1" and interface.endswith("TEST}")
    assert not job.path.exists()
    with pytest.raises(live.LiveCaptureError):
        live.finish(job.id)
