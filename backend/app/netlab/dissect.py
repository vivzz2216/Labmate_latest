"""Protocol dissection of captured Ethernet frames: packet list rows, details trees, hex rows, TCP streams.

Everything shown by the Wireshark-style studio is computed here from the captured bytes; nothing is typed in. Field
names, labels and the Info column follow Wireshark's, so what a student sees matches what Wireshark would show for the
same file.
"""
import ipaddress
import re
import struct
import time as _time
from dataclasses import dataclass, field
from urllib.parse import unquote_plus


ETHERTYPES = {0x0800: "IPv4", 0x0806: "ARP", 0x86DD: "IPv6", 0x8100: "802.1Q Virtual LAN", 0x88CC: "LLDP"}
IP_PROTOCOLS = {1: "ICMP", 2: "IGMP", 6: "TCP", 17: "UDP", 41: "IPv6", 58: "IPv6-ICMP"}
ICMP_TYPES = {0: "Echo (ping) reply", 3: "Destination unreachable", 4: "Source quench", 5: "Redirect", 8: "Echo (ping) request",
              9: "Router advertisement", 10: "Router solicitation", 11: "Time-to-live exceeded", 12: "Parameter problem",
              13: "Timestamp request", 14: "Timestamp reply"}
ICMP_UNREACHABLE = {0: "Network unreachable", 1: "Host unreachable", 2: "Protocol unreachable", 3: "Port unreachable",
                    4: "Fragmentation needed"}
ARP_OPCODES = {1: "request", 2: "reply"}
OUI = {"08:00:27": "PcsCompu", "00:50:56": "VMware", "00:0c:29": "VMware", "b8:27:eb": "Raspberr", "dc:a6:32": "Raspberr",
       "52:54:00": "RealtekU", "00:1c:b3": "Apple", "00:1a:a0": "Dell", "00:14:22": "Dell", "f8:bc:12": "Dell", "00:0d:3a": "Microsoft",
       "00:15:5d": "Microsoft", "3c:22:fb": "Apple", "a4:83:e7": "Apple", "00:e0:4c": "RealtekS", "00:1b:21": "Intel"}
KNOWN_PORTS = {53: "DNS", 80: "HTTP", 123: "NTP", 443: "TLS", 5353: "MDNS", 1900: "SSDP", 67: "DHCP", 68: "DHCP"}
HTTP_METHODS = (b"GET ", b"POST ", b"HEAD ", b"PUT ", b"DELETE ", b"OPTIONS ", b"PATCH ", b"CONNECT ")
HTTP_HEADER_FIELDS = {"host": "http.host", "user-agent": "http.user_agent", "content-type": "http.content_type",
                      "content-length": "http.content_length_header", "server": "http.server", "accept": "http.accept",
                      "accept-language": "http.accept_language", "accept-encoding": "http.accept_encoding", "connection": "http.connection",
                      "referer": "http.referer", "cookie": "http.cookie", "set-cookie": "http.set_cookie", "location": "http.location",
                      "date": "http.date", "last-modified": "http.last_modified", "cache-control": "http.cache_control",
                      "authorization": "http.authorization"}
TLS_RECORDS = {20: "Change Cipher Spec", 21: "Alert", 22: "Handshake", 23: "Application Data"}
TLS_VERSIONS = {0x0301: "TLSv1", 0x0302: "TLSv1.1", 0x0303: "TLSv1.2", 0x0304: "TLSv1.3"}
# Wireshark's default colouring rules, in the order it applies them (first match wins): (name, filter text, background, foreground)
COLOR_RULES = [
    ("ARP", "arp", "#FAF0D7", "#12272E"),
    ("ICMP", "icmp || icmpv6", "#FCE0FF", "#12272E"),
    ("TCP RST", "tcp.flags.reset eq 1", "#A40000", "#FFFC9C"),
    ("HTTP", "http || tcp.port == 80 || http2", "#E4FFC7", "#12272E"),
    ("TCP SYN/FIN", "tcp.flags & 0x02 || tcp.flags.fin eq 1", "#A0A0A0", "#12272E"),
    ("TCP", "tcp", "#E7E6FF", "#12272E"),
    ("UDP", "udp", "#DAEEFF", "#12272E"),
    ("Broadcast", "eth[0] & 1", "#FFFFFF", "#12272E"),
]


def mac_text(raw):
    return ":".join("%02x" % byte for byte in raw)


def mac_name(text):
    """Wireshark's resolved name for a MAC address: Broadcast, Vendor_xx:xx:xx, or the plain address."""
    if text == "ff:ff:ff:ff:ff:ff":
        return "Broadcast"
    if text.startswith("01:00:5e"):
        return "IPv4mcast_" + text[9:]
    if text.startswith("33:33"):
        return "IPv6mcast_" + text[9:]
    vendor = OUI.get(text[:8])
    return "%s_%s" % (vendor, text[9:]) if vendor else text


def mac_with_name(text):
    name = mac_name(text)
    return text if name == text else "%s (%s)" % (name, text)


def ipv4_text(raw):
    return ".".join(str(byte) for byte in raw)


def ipv6_text(raw):
    return str(ipaddress.IPv6Address(bytes(raw)))


def bitline(width, mask, value, label, set_text="Set", unset_text="Not set"):
    """Wireshark's bit-field line: '.... ...1 .... = Label: Set' (width bits; only the bits in mask are shown)."""
    chars = []
    for position in range(width - 1, -1, -1):
        bit = 1 << position
        chars.append(("1" if value & bit else "0") if mask & bit else ".")
    grouped = " ".join("".join(chars[i:i + 4]) for i in range(0, width, 4))
    return "%s = %s: %s" % (grouped, label, set_text if value & mask else unset_text)


def printable(data, limit=None):
    chunk = data if limit is None else data[:limit]
    return "".join(chr(byte) if 32 <= byte < 127 else "." for byte in chunk)


@dataclass
class Node:
    label: str
    start: int = 0
    end: int = 0
    children: list = field(default_factory=list)
    abbrev: str = ""          # the display-filter name of the field ("ip.src"), shown in the status bar and used by Apply as Filter
    value: object = None      # the value Apply as Filter compares with; None for protocol lines and text-only lines

    def to_dict(self):
        out = {"label": self.label, "start": self.start, "end": self.end, "children": [child.to_dict() for child in self.children]}
        if self.abbrev:
            out["abbrev"] = self.abbrev
            if self.value is not None:
                out["value"] = self.value if isinstance(self.value, (int, float)) else str(self.value)
                out["filter"] = filter_text(self.abbrev, self.value)
            elif "." not in self.abbrev:
                out["filter"] = self.abbrev                       # a protocol line: "Apply as Filter" gives the protocol name
        return out


_LITERAL = re.compile(r"^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f]{2}(?::[0-9a-f]{2}){5}|0x[0-9a-f]+|-?\d+(?:\.\d+)?|"
                      r"[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7})$", re.I)


def filter_text(abbrev, value):
    """The display filter that selects this field's value, as Wireshark's Apply as Filter > Selected writes it."""
    if isinstance(value, bool):
        value = int(value)
    if isinstance(value, (int, float)):
        return "%s == %s" % (abbrev, value)
    text = str(value)
    if _LITERAL.match(text):
        return "%s == %s" % (abbrev, text)
    return '%s == "%s"' % (abbrev, text.replace("\\", "\\\\").replace('"', '\\"'))


def F(label, start, end, abbrev, value=None, children=None):
    """A details line that is a filterable field."""
    return Node(label, start, end, children or [], abbrev, value)


@dataclass
class Dissected:
    number: int
    time: float                      # seconds since the first packet
    epoch: float
    data: bytes
    original_length: int
    protocols: list = field(default_factory=list)     # e.g. ["eth", "ethertype", "ip", "tcp", "http"]
    top: str = "Ethernet"
    source: str = ""
    destination: str = ""
    info: str = ""
    fields: dict = field(default_factory=dict)        # display-filter field -> list of values
    tree: list = field(default_factory=list)
    layers: dict = field(default_factory=dict)        # raw per-protocol facts used by the lab answers
    stream: int = -1
    color: tuple = ("", "#FFFFFF", "#12272E")

    @property
    def length(self):
        return len(self.data)

    def row(self):
        eth = self.layers.get("eth", {})
        transport = self.layers.get("tcp") or self.layers.get("udp") or {}
        return {"srcport": transport.get("srcport"), "dstport": transport.get("dstport"),"no": self.number, "time": round(self.time, 6), "epoch": round(self.epoch, 6), "source": self.source,
                "destination": self.destination, "protocol": self.top, "length": self.original_length, "info": self.info, "stream": self.stream,
                "udp_stream": self.layers.get("udp", {}).get("stream", -1), "eth_src": eth.get("src", ""), "eth_dst": eth.get("dst", ""),
                "ip_src": self.layers.get("ip", {}).get("src", ""), "ip_dst": self.layers.get("ip", {}).get("dst", ""),
                "color": {"rule": self.color[0], "bg": self.color[1], "fg": self.color[2]}}


class TcpStream:
    def __init__(self, index, client, server):
        self.index, self.client, self.server = index, client, server      # (ip, port) endpoints; client sent the first packet seen
        self.isn = {}                                                    # direction -> first sequence number seen
        self.segments = {"c": {}, "s": {}}                               # direction -> {relative seq: bytes}
        self.wscale = {}                                                 # direction -> window scale shift from its SYN (None: option absent)
        self.packets = []

    def direction(self, source):
        return "c" if source == self.client else "s"


class Session:
    """All dissected packets of one capture, plus the state that spans packets (TCP streams, echo matching)."""

    def __init__(self, capture):
        self.capture = capture
        self.packets = []
        self.streams = []
        self._stream_by_key = {}
        self._udp_streams = {}
        self._echo = {}
        self._dns_queries = {}
        self._http_pending = {}
        self._t0 = capture.frames[0].timestamp if capture.frames else 0.0
        for frame in capture.frames:
            self.packets.append(self._dissect(frame))
        self._link_echoes()

    # ------------------------------------------------------------------ public views
    def rows(self, numbers=None):
        wanted = None if numbers is None else set(numbers)
        return [packet.row() for packet in self.packets if wanted is None or packet.number in wanted]

    def packet(self, number):
        if not 1 <= number <= len(self.packets):
            raise KeyError("There is no packet number %s in this capture." % number)
        return self.packets[number - 1]

    def detail(self, number):
        packet = self.packet(number)
        return {"no": packet.number, "tree": [node.to_dict() for node in packet.tree], "hex": hex_rows(packet.data),
                "bytes": len(packet.data), "row": packet.row()}

    def stream_text(self, index):
        """The conversation of one TCP stream as Wireshark's Follow TCP Stream shows it."""
        if not 0 <= index < len(self.streams):
            raise KeyError("There is no TCP stream %s." % index)
        stream = self.streams[index]
        chunks, seen = [], set()
        for packet in stream.packets:
            payload = packet.layers.get("tcp", {}).get("payload", b"")
            if not payload:
                continue
            side = stream.direction((packet.layers["ip"]["src"], packet.layers["tcp"]["srcport"]))
            marker = (side, packet.layers["tcp"]["rel_seq"], len(payload))
            if marker in seen:
                continue                                     # a retransmission of data already shown
            seen.add(marker)
            if chunks and chunks[-1]["side"] == side:
                chunks[-1]["data"] += payload
            else:
                chunks.append({"side": side, "data": payload})
        client_packets = sum(1 for p in stream.packets if p.layers["ip"]["src"] == stream.client[0] and p.layers["tcp"]["srcport"] == stream.client[1])
        return {"stream": index, "packets": [p.number for p in stream.packets], "client": "%s:%d" % stream.client, "server": "%s:%d" % stream.server,
                "client_packets": client_packets, "server_packets": len(stream.packets) - client_packets, "turns": len(chunks),
                "chunks": [{"side": c["side"], "text": printable_text(c["data"]), "bytes": len(c["data"])} for c in chunks]}

    # ------------------------------------------------------------------ dissection
    def _dissect(self, frame):
        # Epoch seconds near 1.8e9 carry only ~0.2 microsecond of float precision, so relative times are rounded to the microsecond
        # (the resolution of almost every capture file) instead of showing 0.004199982 for a packet captured 4.2 ms later.
        packet = Dissected(frame.number, round(frame.timestamp - self._t0, 6), frame.timestamp, frame.data, frame.original_length)
        data = frame.data
        packet.protocols = ["frame"]
        if len(data) < 14:
            packet.top, packet.info = "Ethernet", "Malformed frame (%d bytes)" % len(data)
            packet.tree = [self._frame_node(packet)]
            packet.fields = {"frame.number": [packet.number], "frame.len": [packet.original_length], "frame.cap_len": [len(data)]}
            packet.color = ("", "#FFFFFF", "#12272E")
            return packet
        dst, src = mac_text(data[0:6]), mac_text(data[6:12])
        ethertype = struct.unpack("!H", data[12:14])[0]
        offset = 14
        packet.protocols += ["eth"]
        vlan = None
        if ethertype == 0x8100 and len(data) >= 18:
            vlan = struct.unpack("!H", data[14:16])[0] & 0x0FFF
            ethertype = struct.unpack("!H", data[16:18])[0]
            offset = 18
        packet.protocols += ["ethertype"]
        packet.source, packet.destination = mac_name(src), mac_name(dst)
        packet.fields.update({"frame.number": [packet.number], "frame.len": [packet.original_length], "frame.cap_len": [len(data)],
                              "frame.time_relative": [round(packet.time, 9)], "eth.dst": [dst], "eth.src": [src], "eth.addr": [dst, src],
                              "eth.type": [ethertype], "eth.ig": [int(bool(data[0] & 1)), int(bool(data[6] & 1))],
                              "eth.lg": [int(bool(data[0] & 2)), int(bool(data[6] & 2))], "eth.dst.ig": [int(bool(data[0] & 1))],
                              "eth.src.ig": [int(bool(data[6] & 1))]})
        packet.layers["eth"] = {"dst": dst, "src": src, "type": ethertype, "vlan": vlan}
        eth_node = Node("Ethernet II, Src: %s, Dst: %s" % (mac_with_name(src), mac_with_name(dst)), 0, offset, abbrev="eth")
        eth_node.children = [self._mac_node("Destination", dst, 0, "eth.dst"), self._mac_node("Source", src, 6, "eth.src")]
        if vlan is not None:
            eth_node.children.append(F("802.1Q Virtual LAN, ID: %d" % vlan, 12, 16, "vlan.id", vlan))
        eth_node.children.append(F("Type: %s (0x%04x)" % (ETHERTYPES.get(ethertype, "Unknown"), ethertype), offset - 2, offset,
                                   "eth.type", "0x%04x" % ethertype))
        nodes = [self._frame_node(packet), eth_node]
        packet.top = ETHERTYPES.get(ethertype, "Ethernet")
        packet.info = "Ethernet type 0x%04x" % ethertype

        end = len(data)
        if ethertype == 0x0806:
            end = self._arp(packet, data, offset, nodes)
        elif ethertype == 0x0800:
            end = self._ipv4(packet, data, offset, nodes)
        elif ethertype == 0x86DD:
            end = self._ipv6(packet, data, offset, nodes)
        if end < len(data):
            trailer = data[end:]
            eth_node.children.append(Node("Padding: " + trailer.hex(), end, len(data)))
            packet.layers["eth"]["padding"] = len(trailer)
            packet.fields["eth.padding"] = [trailer.hex()]
        packet.fields.setdefault("eth.padding", [])
        packet.tree = nodes
        packet.tree[0].children.append(Node("[Protocols in frame: %s]" % ":".join(p for p in packet.protocols if p != "frame")))
        _fields_from_tree(packet.tree, packet.fields)
        _merge_tree_fields(packet.fields)
        packet.fields["_protocols"] = list(packet.protocols)
        packet.color = self._color(packet)
        packet.tree[0].children.append(Node("[Coloring Rule Name: %s]" % packet.color[0])) if packet.color[0] else None
        rule_text = next((text for name, text, _bg, _fg in COLOR_RULES if name == packet.color[0]), "")
        if rule_text:
            packet.tree[0].children.append(Node("[Coloring Rule String: %s]" % rule_text))
        return packet

    def _frame_node(self, packet):
        bits = packet.original_length * 8
        captured = len(packet.data)
        arrival = _time.strftime("%b %d, %Y %H:%M:%S", _time.gmtime(packet.epoch))
        fraction = ("%.6f" % (packet.epoch - int(packet.epoch)))[1:] + "000"
        node = Node("Frame %d: %d bytes on wire (%d bits), %d bytes captured (%d bits)"
                    % (packet.number, packet.original_length, bits, captured, captured * 8), 0, captured, abbrev="frame")
        node.children = [
            F("Encapsulation type: Ethernet (1)", 0, 0, "frame.encap_type", 1),
            F("Arrival Time: %s%s UTC" % (arrival, fraction), 0, 0, "frame.time"),
            F("Epoch Arrival Time: %.6f000" % packet.epoch, 0, 0, "frame.time_epoch"),
            F("[Time since first frame in this capture: %.6f000 seconds]" % packet.time, 0, 0, "frame.time_relative", round(packet.time, 6)),
            F("Frame Number: %d" % packet.number, 0, 0, "frame.number", packet.number),
            F("Frame Length: %d bytes (%d bits)" % (packet.original_length, bits), 0, 0, "frame.len", packet.original_length),
            F("Capture Length: %d bytes (%d bits)" % (captured, captured * 8), 0, 0, "frame.cap_len", captured),
            F("[Frame is marked: False]", 0, 0, "frame.marked"),
            F("[Frame is ignored: False]", 0, 0, "frame.ignored"),
        ]
        return node

    def _mac_node(self, label, text, start, abbrev):
        node = F("%s: %s" % (label, mac_with_name(text)), start, start + 6, abbrev, text)
        oui = int(text[:8].replace(":", ""), 16)       # the first three bytes carry the LG and IG bits
        node.children = [F("Address: %s" % mac_with_name(text), start, start + 6, "eth.addr", text),
                         F(bitline(24, 0x020000, oui, "LG bit", "Locally administered address (this is NOT the factory default)",
                                   "Globally unique address (factory default)"), start, start + 3, "eth.lg", int(bool(oui & 0x020000))),
                         F(bitline(24, 0x010000, oui, "IG bit", "Group address (multicast/broadcast)", "Individual address (unicast)"),
                           start, start + 3, "eth.ig", int(bool(oui & 0x010000)))]
        return node

    # ------------------------------------------------------------------ ARP
    def _arp(self, packet, data, offset, nodes):
        packet.protocols.append("arp")
        body = data[offset:offset + 28]
        if len(body) < 28:
            packet.top, packet.info = "ARP", "Malformed ARP"
            return len(data)
        htype, ptype, hlen, plen, opcode = struct.unpack("!HHBBH", body[:8])
        sha, spa, tha, tpa = mac_text(body[8:14]), ipv4_text(body[14:18]), mac_text(body[18:24]), ipv4_text(body[24:28])
        kind = ARP_OPCODES.get(opcode, "unknown")
        packet.top = "ARP"
        if opcode == 1 and spa == "0.0.0.0":
            packet.info = "Who has %s? (ARP Probe)" % tpa
        elif opcode == 1 and spa == tpa:
            packet.info = ("ARP Announcement for %s" % spa) if tha == "00:00:00:00:00:00" else "Gratuitous ARP for %s (Request)" % spa
        elif opcode == 1:
            packet.info = "Who has %s? Tell %s" % (tpa, spa)
        elif opcode == 2 and spa == tpa:
            packet.info = "Gratuitous ARP for %s (Reply)" % spa
        elif opcode == 2:
            packet.info = "%s is at %s" % (spa, sha)
        else:
            packet.info = "ARP opcode %d" % opcode
        packet.layers["arp"] = {"hardware_type": htype, "protocol_type": ptype, "hardware_size": hlen, "protocol_size": plen,
                                "opcode": opcode, "sender_mac": sha, "sender_ip": spa, "target_mac": tha, "target_ip": tpa}
        packet.fields.update({"arp.opcode": [opcode], "arp.hw.type": [htype], "arp.proto.type": [ptype], "arp.hw.size": [hlen],
                              "arp.proto.size": [plen], "arp.src.hw_mac": [sha], "arp.src.proto_ipv4": [spa],
                              "arp.dst.hw_mac": [tha], "arp.dst.proto_ipv4": [tpa]})
        node = Node("Address Resolution Protocol (%s%s)" % (kind, "/gratuitous ARP" if spa == tpa and opcode in (1, 2) else ""),
                    offset, offset + 28, abbrev="arp")
        node.children = [
            F("Hardware type: %s (%d)" % ("Ethernet" if htype == 1 else "Unknown", htype), offset, offset + 2, "arp.hw.type", htype),
            F("Protocol type: %s (0x%04x)" % (ETHERTYPES.get(ptype, "Unknown"), ptype), offset + 2, offset + 4, "arp.proto.type", "0x%04x" % ptype),
            F("Hardware size: %d" % hlen, offset + 4, offset + 5, "arp.hw.size", hlen),
            F("Protocol size: %d" % plen, offset + 5, offset + 6, "arp.proto.size", plen),
            F("Opcode: %s (%d)" % (kind, opcode), offset + 6, offset + 8, "arp.opcode", opcode),
            F("Sender MAC address: %s" % mac_with_name(sha), offset + 8, offset + 14, "arp.src.hw_mac", sha),
            F("Sender IP address: %s" % spa, offset + 14, offset + 18, "arp.src.proto_ipv4", spa),
            F("Target MAC address: %s" % mac_with_name(tha), offset + 18, offset + 24, "arp.dst.hw_mac", tha),
            F("Target IP address: %s" % tpa, offset + 24, offset + 28, "arp.dst.proto_ipv4", tpa),
        ]
        if spa == tpa and opcode in (1, 2):
            node.children.insert(5, Node("[Is gratuitous: True]"))
            packet.fields["arp.isgratuitous"] = [1]
        nodes.append(node)
        return offset + 28

    # ------------------------------------------------------------------ IPv4 / IPv6
    def _ipv4(self, packet, data, offset, nodes):
        header = data[offset:offset + 20]
        if len(header) < 20 or header[0] >> 4 != 4:
            packet.top, packet.info = "IPv4", "Malformed IPv4 header"
            return len(data)
        ihl = (header[0] & 0x0F) * 4
        tos, total, ident, flags_frag, ttl, proto, checksum = struct.unpack("!BHHHBBH", header[1:12])
        src, dst = ipv4_text(header[12:16]), ipv4_text(header[16:20])
        if ihl < 20 or total < ihl or offset + ihl > len(data):
            packet.top, packet.info = "IPv4", "Malformed IPv4 header"
            return len(data)
        packet.protocols.append("ip")
        packet.source, packet.destination, packet.top = src, dst, IP_PROTOCOLS.get(proto, "IPv4")
        packet.info = "IPv4 protocol %d" % proto
        end = min(len(data), offset + total)
        fragment = (flags_frag & 0x1FFF) * 8
        packet.layers["ip"] = {"src": src, "dst": dst, "ttl": ttl, "protocol": proto, "id": ident, "total_length": total,
                               "header_length": ihl, "flags": flags_frag >> 13, "fragment_offset": fragment, "checksum": checksum}
        packet.fields.update({"ip.version": [4], "ip.src": [src], "ip.dst": [dst], "ip.addr": [src, dst], "ip.ttl": [ttl], "ip.proto": [proto],
                              "ip.len": [total], "ip.id": [ident], "ip.hdr_len": [ihl], "ip.flags.df": [int(bool(flags_frag & 0x4000))],
                              "ip.flags.mf": [int(bool(flags_frag & 0x2000))], "ip.frag_offset": [fragment]})
        flags_value = flags_frag >> 13
        ip_node = Node("Internet Protocol Version 4, Src: %s, Dst: %s" % (src, dst), offset, offset + ihl, abbrev="ip")
        ip_node.children = [
            F("0100 .... = Version: 4", offset, offset + 1, "ip.version", 4),
            F(".... %s = Header Length: %d bytes (%d)" % (format(ihl // 4, "04b"), ihl, ihl // 4), offset, offset + 1, "ip.hdr_len", ihl),
            F("Differentiated Services Field: 0x%02x (DSCP: %s, ECN: %s)" % (
                tos, "CS%d" % ((tos >> 2) // 8) if (tos >> 2) % 8 == 0 else "DSCP %d" % (tos >> 2), ["Not-ECT", "ECT(1)", "ECT(0)", "CE"][tos & 3]),
                offset + 1, offset + 2, "ip.dsfield", "0x%02x" % tos),
            F("Total Length: %d" % total, offset + 2, offset + 4, "ip.len", total),
            F("Identification: 0x%04x (%d)" % (ident, ident), offset + 4, offset + 6, "ip.id", "0x%04x" % ident),
            F("%s. .... = Flags: 0x%x%s" % (format(flags_value, "03b"), flags_value, ", Don't fragment" if flags_value & 2 else
                                             ", More fragments" if flags_value & 1 else ""), offset + 6, offset + 7, "ip.flags", "0x%x" % flags_value, [
                F(bitline(8, 0x80, flags_value << 5, "Reserved bit", "Set", "Not set"), offset + 6, offset + 7, "ip.flags.rb", int(bool(flags_value & 4))),
                F(bitline(8, 0x40, flags_value << 5, "Don't fragment", "Set", "Not set"), offset + 6, offset + 7, "ip.flags.df", int(bool(flags_value & 2))),
                F(bitline(8, 0x20, flags_value << 5, "More fragments", "Set", "Not set"), offset + 6, offset + 7, "ip.flags.mf", int(bool(flags_value & 1)))]),
            F("Fragment Offset: %d" % fragment, offset + 6, offset + 8, "ip.frag_offset", fragment),
            F("Time to Live: %d" % ttl, offset + 8, offset + 9, "ip.ttl", ttl),
            F("Protocol: %s (%d)" % (IP_PROTOCOLS.get(proto, "Unknown"), proto), offset + 9, offset + 10, "ip.proto", proto),
            F("Header Checksum: 0x%04x [validation disabled]" % checksum, offset + 10, offset + 12, "ip.checksum", "0x%04x" % checksum,
              [Node("[Header checksum status: Unverified]", offset + 10, offset + 12)]),
            F("Source Address: %s" % src, offset + 12, offset + 16, "ip.src", src),
            F("Destination Address: %s" % dst, offset + 16, offset + 20, "ip.dst", dst),
        ]
        nodes.append(ip_node)
        body = offset + ihl
        if fragment or flags_frag & 0x2000:                  # any fragment, including the first: the transport header is not decoded
            packet.info = "Fragmented IP protocol (proto=%s 0x%02x, off=%d, ID=%04x)" % (IP_PROTOCOLS.get(proto, "?"), proto, fragment, ident)
            return end
        return self._transport(packet, data, body, end, proto, src, dst, nodes, v6=False)

    def _ipv6(self, packet, data, offset, nodes):
        header = data[offset:offset + 40]
        if len(header) < 40 or header[0] >> 4 != 6:
            packet.top, packet.info = "IPv6", "Malformed IPv6 header"
            return len(data)
        first_word = struct.unpack("!I", header[0:4])[0]
        traffic_class, flow = (first_word >> 20) & 0xFF, first_word & 0xFFFFF
        payload_length, next_header, hop_limit = struct.unpack("!HBB", header[4:8])
        src, dst = ipv6_text(header[8:24]), ipv6_text(header[24:40])
        packet.protocols.append("ipv6")
        packet.source, packet.destination = src, dst
        packet.top = {6: "TCP", 17: "UDP", 58: "ICMPv6"}.get(next_header, "IPv6")
        packet.info = "IPv6 next header %d" % next_header
        packet.layers["ip"] = {"src": src, "dst": dst, "ttl": hop_limit, "protocol": next_header, "v6": True}
        packet.fields.update({"ipv6.version": [6], "ipv6.src": [src], "ipv6.dst": [dst], "ipv6.addr": [src, dst], "ipv6.hlim": [hop_limit],
                              "ipv6.nxt": [next_header], "ipv6.plen": [payload_length], "ipv6.flow": [flow], "ipv6.tclass": [traffic_class]})
        node = Node("Internet Protocol Version 6, Src: %s, Dst: %s" % (src, dst), offset, offset + 40, abbrev="ipv6")
        node.children = [F("0110 .... = Version: 6", offset, offset + 1, "ipv6.version", 6),
                         F(".... %s .... .... .... .... .... = Traffic Class: 0x%02x" % (_group(format(traffic_class, "08b")), traffic_class),
                           offset, offset + 2, "ipv6.tclass", "0x%02x" % traffic_class),
                         F(".... %s = Flow Label: 0x%05x" % (_group(format(flow, "020b")), flow), offset + 1, offset + 4, "ipv6.flow", "0x%05x" % flow),
                         F("Payload Length: %d" % payload_length, offset + 4, offset + 6, "ipv6.plen", payload_length),
                         F("Next Header: %s (%d)" % ({58: "ICMPv6"}.get(next_header) or IP_PROTOCOLS.get(next_header, "Unknown"), next_header),
                           offset + 6, offset + 7, "ipv6.nxt", next_header),
                         F("Hop Limit: %d" % hop_limit, offset + 7, offset + 8, "ipv6.hlim", hop_limit),
                         F("Source Address: %s" % src, offset + 8, offset + 24, "ipv6.src", src),
                         F("Destination Address: %s" % dst, offset + 24, offset + 40, "ipv6.dst", dst)]
        nodes.append(node)
        end = min(len(data), offset + 40 + payload_length)
        if next_header == 58:
            return self._icmpv6(packet, data, offset + 40, end, nodes)
        return self._transport(packet, data, offset + 40, end, next_header, src, dst, nodes, v6=True)

    ICMPV6_TYPES = {1: "Destination Unreachable", 2: "Packet Too Big", 3: "Time Exceeded", 4: "Parameter Problem",
                    128: "Echo (ping) request", 129: "Echo (ping) reply", 133: "Router Solicitation", 134: "Router Advertisement",
                    135: "Neighbor Solicitation", 136: "Neighbor Advertisement", 137: "Redirect", 143: "Multicast Listener Report Message v2"}
    NDP_OPTIONS = {1: "Source link-layer address", 2: "Target link-layer address", 3: "Prefix information", 5: "MTU"}

    def _icmpv6(self, packet, data, body, end, nodes):
        packet.protocols.append("icmpv6")
        packet.top = "ICMPv6"
        segment = data[body:end]
        if len(segment) < 4:
            packet.info = "Malformed ICMPv6"
            return end
        icmp_type, code, checksum = struct.unpack("!BBH", segment[:4])
        name = self.ICMPV6_TYPES.get(icmp_type, "Unknown")
        packet.info = name if name != "Unknown" else "ICMPv6 type %d" % icmp_type
        packet.fields.update({"icmpv6.type": [icmp_type], "icmpv6.code": [code], "icmpv6.checksum": [checksum]})
        node = Node("Internet Control Message Protocol v6", body, end, abbrev="icmpv6")
        node.children = [F("Type: %s (%d)" % (name, icmp_type), body, body + 1, "icmpv6.type", icmp_type),
                         F("Code: %d" % code, body + 1, body + 2, "icmpv6.code", code),
                         F("Checksum: 0x%04x [unverified]" % checksum, body + 2, body + 4, "icmpv6.checksum", "0x%04x" % checksum,
                           [Node("[Checksum Status: Unverified]", body + 2, body + 4)])]
        layer = {"type": icmp_type, "code": code}
        if icmp_type in (128, 129) and len(segment) >= 8:
            ident, seq = struct.unpack("!HH", segment[4:8])
            gap = "  " if icmp_type == 128 else "    "
            packet.info = "%s%sid=0x%04x, seq=%d, hop limit=%d" % (name, gap, ident, seq, packet.layers["ip"]["ttl"])
            packet.fields.update({"icmpv6.echo.identifier": [ident], "icmpv6.echo.sequence_number": [seq]})
            node.children += [F("Identifier: 0x%04x" % ident, body + 4, body + 6, "icmpv6.echo.identifier", "0x%04x" % ident),
                              F("Sequence: %d" % seq, body + 6, body + 8, "icmpv6.echo.sequence_number", seq)]
            if len(segment) > 8:
                node.children.append(Node("Data (%d bytes)" % (len(segment) - 8), body + 8, end, [F("Data: " + segment[8:].hex(), body + 8, end, "data.data")]))
            layer.update(identifier=ident, sequence=seq)
            src, dst = packet.layers["ip"]["src"], packet.layers["ip"]["dst"]
            self._echo.setdefault((src if icmp_type == 128 else dst, dst if icmp_type == 128 else src, ident, seq, 6), {})[
                8 if icmp_type == 128 else 0] = packet
        elif icmp_type in (135, 136) and len(segment) >= 24:
            target = ipv6_text(segment[8:24])
            packet.fields["icmpv6.nd.ns.target_address" if icmp_type == 135 else "icmpv6.nd.na.target_address"] = [target]
            if icmp_type == 136:
                flags = segment[4]
                named = [word for bit, word in ((0x80, "Router"), (0x40, "Solicited"), (0x20, "Override")) if flags & bit]
                node.children.append(F("Flags: 0x%02x000000%s" % (flags, "".join(", " + word for word in named)), body + 4, body + 8,
                                       "icmpv6.nd.na.flag", "0x%02x000000" % flags))
                packet.info = "Neighbor Advertisement %s%s" % (target, " (%s)" % ", ".join(
                    word for bit, word in ((0x80, "rtr"), (0x40, "sol"), (0x20, "ovr")) if flags & bit) if flags & 0xE0 else "")
            else:
                packet.info = "Neighbor Solicitation for %s" % target
            node.children.append(F("Target Address: %s" % target, body + 8, body + 24,
                                   "icmpv6.nd.ns.target_address" if icmp_type == 135 else "icmpv6.nd.na.target_address", target))
            position = body + 24
            while position + 2 <= end:
                kind, length = data[position], data[position + 1] * 8
                if length == 0 or position + length > end:
                    break
                option = Node("ICMPv6 Option (%s)" % self.NDP_OPTIONS.get(kind, "type %d" % kind), position, position + length)
                if kind in (1, 2) and length >= 8:
                    mac = mac_text(data[position + 2:position + 8])
                    option.children.append(F("Link-layer address: %s" % mac_with_name(mac), position + 2, position + 8,
                                             "icmpv6.opt.linkaddr", mac))
                    if kind == 1:
                        packet.info += " from %s" % mac
                    elif icmp_type == 136:
                        packet.info += " is at %s" % mac
                node.children.append(option)
                position += length
        packet.layers["icmpv6"] = layer
        nodes.append(node)
        return end

    # ------------------------------------------------------------------ transport
    def _transport(self, packet, data, body, end, proto, src, dst, nodes, v6):
        if proto == 1 and not v6:
            return self._icmp(packet, data, body, end, nodes)
        if proto == 6:
            return self._tcp(packet, data, body, end, src, dst, nodes)
        if proto == 17:
            return self._udp(packet, data, body, end, src, dst, nodes)
        return end

    def _icmp(self, packet, data, body, end, nodes):
        segment = data[body:end]
        if len(segment) < 8:
            packet.top, packet.info = "ICMP", "Malformed ICMP"
            return end
        icmp_type, code, checksum = struct.unpack("!BBH", segment[:4])
        packet.protocols.append("icmp")
        packet.top = "ICMP"
        name = ICMP_TYPES.get(icmp_type, "Type %d" % icmp_type)
        packet.fields.update({"icmp.type": [icmp_type], "icmp.code": [code], "icmp.checksum": [checksum]})
        node = Node("Internet Control Message Protocol", body, end, abbrev="icmp")
        node.children = [F("Type: %d (%s)" % (icmp_type, name), body, body + 1, "icmp.type", icmp_type),
                         F("Code: %d" % code, body + 1, body + 2, "icmp.code", code),
                         F("Checksum: 0x%04x [unverified]" % checksum, body + 2, body + 4, "icmp.checksum", "0x%04x" % checksum,
                           [Node("[Checksum Status: Unverified]", body + 2, body + 4)])]
        layer = {"type": icmp_type, "code": code}
        if icmp_type in (0, 8):
            ident, seq = struct.unpack("!HH", segment[4:8])
            ttl = packet.layers["ip"]["ttl"]
            ident_le, seq_le = _swap16(ident), _swap16(seq)
            gap = "  " if icmp_type == 8 else "    "              # Wireshark pads "request"/"reply" so the ids line up
            packet.info = "%s%sid=0x%04x, seq=%d/%d, ttl=%d" % (name, gap, ident, seq, seq_le, ttl)
            packet.fields.update({"icmp.ident": [ident, ident_le], "icmp.seq": [seq], "icmp.seq_le": [seq_le]})
            node.children += [F("Identifier (BE): %d (0x%04x)" % (ident, ident), body + 4, body + 6, "icmp.ident", ident),
                              F("Identifier (LE): %d (0x%04x)" % (ident_le, ident_le), body + 4, body + 6, "icmp.ident_le", ident_le),
                              F("Sequence Number (BE): %d (0x%04x)" % (seq, seq), body + 6, body + 8, "icmp.seq", seq),
                              F("Sequence Number (LE): %d (0x%04x)" % (seq_le, seq_le), body + 6, body + 8, "icmp.seq_le", seq_le)]
            if len(segment) > 8:
                node.children.append(Node("Data (%d bytes)" % (len(segment) - 8), body + 8, end,
                                          [F("Data: " + segment[8:].hex(), body + 8, end, "data.data"), Node("[Length: %d]" % (len(segment) - 8), body + 8, end)]))
            layer.update(identifier=ident, sequence=seq)
            self._echo.setdefault((packet.layers["ip"]["src"] if icmp_type == 8 else packet.layers["ip"]["dst"],
                                   packet.layers["ip"]["dst"] if icmp_type == 8 else packet.layers["ip"]["src"], ident, seq), {})[icmp_type] = packet
        elif icmp_type == 3:
            packet.info = "Destination unreachable (%s)" % ICMP_UNREACHABLE.get(code, "code %d" % code)
        elif icmp_type == 11:
            packet.info = "Time-to-live exceeded (%s)" % ("Time to live exceeded in transit" if code == 0 else "Fragment reassembly time exceeded")
        else:
            packet.info = name
        if icmp_type in (3, 4, 5, 11, 12) and len(segment) >= 28:
            node.children.append(F("Unused: %s" % segment[4:8].hex(), body + 4, body + 8, "icmp.unused"))
            self._icmp_quoted(packet, data, body + 8, end, node)
        packet.layers["icmp"] = layer
        nodes.append(node)
        return end

    def _icmp_quoted(self, packet, data, start, end, parent):
        """The IP header and first 8 bytes of the datagram an ICMP error is about. Wireshark decodes them too, so their
        addresses and ports also match display filters (ip.addr, udp, udp.port ...)."""
        header = data[start:start + 20]
        if len(header) < 20 or header[0] >> 4 != 4:
            return
        ihl = (header[0] & 0x0F) * 4
        total, ident, _flags, ttl, proto, checksum = struct.unpack("!HHHBBH", header[2:12])
        src, dst = ipv4_text(header[12:16]), ipv4_text(header[16:20])
        inner = Node("Internet Protocol Version 4, Src: %s, Dst: %s" % (src, dst), start, start + ihl, [
            F("0100 .... = Version: 4", start, start + 1, "ip.version", 4),
            F("Total Length: %d" % total, start + 2, start + 4, "ip.len", total),
            F("Identification: 0x%04x (%d)" % (ident, ident), start + 4, start + 6, "ip.id", "0x%04x" % ident),
            F("Time to Live: %d" % ttl, start + 8, start + 9, "ip.ttl", ttl),
            F("Protocol: %s (%d)" % (IP_PROTOCOLS.get(proto, "Unknown"), proto), start + 9, start + 10, "ip.proto", proto),
            F("Header Checksum: 0x%04x [validation disabled]" % checksum, start + 10, start + 12, "ip.checksum", "0x%04x" % checksum),
            F("Source Address: %s" % src, start + 12, start + 16, "ip.src", src),
            F("Destination Address: %s" % dst, start + 16, start + 20, "ip.dst", dst)], "ip")
        parent.children.append(inner)
        fields = packet.fields
        packet.protocols.append("ip")
        for key, value in (("ip.src", src), ("ip.dst", dst), ("ip.addr", src), ("ip.addr", dst), ("ip.ttl", ttl), ("ip.proto", proto), ("ip.id", ident),
                           ("ip.len", total)):
            fields.setdefault(key, []).append(value)
        body = start + ihl
        rest = data[body:min(end, body + 8)]
        if proto == 17 and len(rest) >= 8:
            sport, dport, length, checksum = struct.unpack("!HHHH", rest)
            packet.protocols.append("udp")
            parent.children.append(Node("User Datagram Protocol, Src Port: %d, Dst Port: %d" % (sport, dport), body, body + 8, [
                F("Source Port: %d" % sport, body, body + 2, "udp.srcport", sport), F("Destination Port: %d" % dport, body + 2, body + 4, "udp.dstport", dport),
                F("Length: %d" % length, body + 4, body + 6, "udp.length", length),
                F("Checksum: 0x%04x [unverified]" % checksum, body + 6, body + 8, "udp.checksum", "0x%04x" % checksum)], "udp"))
            for key, value in (("udp.srcport", sport), ("udp.dstport", dport), ("udp.port", sport), ("udp.port", dport), ("udp.length", length)):
                fields.setdefault(key, []).append(value)
        elif proto == 6 and len(rest) >= 8:
            sport, dport, seq = struct.unpack("!HHI", rest)
            packet.protocols.append("tcp")
            parent.children.append(Node("Transmission Control Protocol, Src Port: %d, Dst Port: %d" % (sport, dport), body, body + 8, [
                F("Source Port: %d" % sport, body, body + 2, "tcp.srcport", sport), F("Destination Port: %d" % dport, body + 2, body + 4, "tcp.dstport", dport),
                F("Sequence Number (raw): %d" % seq, body + 4, body + 8, "tcp.seq_raw", seq)], "tcp"))
            for key, value in (("tcp.srcport", sport), ("tcp.dstport", dport), ("tcp.port", sport), ("tcp.port", dport)):
                fields.setdefault(key, []).append(value)
        elif proto == 1 and len(rest) >= 8:
            itype, icode, _sum, ident2, seq2 = struct.unpack("!BBHHH", rest)
            packet.protocols.append("icmp")
            parent.children.append(Node("Internet Control Message Protocol", body, body + 8, [
                F("Type: %d (%s)" % (itype, ICMP_TYPES.get(itype, "Type %d" % itype)), body, body + 1, "icmp.type", itype),
                F("Code: %d" % icode, body + 1, body + 2, "icmp.code", icode),
                F("Identifier (BE): %d (0x%04x)" % (ident2, ident2), body + 4, body + 6, "icmp.ident", ident2),
                F("Sequence Number (BE): %d (0x%04x)" % (seq2, seq2), body + 6, body + 8, "icmp.seq", seq2)], "icmp"))
            for key, value in (("icmp.type", itype), ("icmp.code", icode), ("icmp.ident", ident2), ("icmp.seq", seq2)):
                fields.setdefault(key, []).append(value)

    def _link_echoes(self):
        for pair in self._echo.values():
            request, reply = pair.get(8), pair.get(0)
            if request and reply:
                request.info += " (reply in %d)" % reply.number
                reply.info += " (request in %d)" % request.number
                layer = "icmp" if "icmp" in request.protocols else "icmpv6"
                for item, label in ((request, "[Response frame: %d]" % reply.number), (reply, "[Request frame: %d]" % request.number)):
                    tree = next((n for n in item.tree if n.abbrev == layer), None)
                    if tree is not None:
                        tree.children.insert(3, Node(label))
                elapsed = (reply.epoch - request.epoch) * 1000
                tree = next((n for n in reply.tree if n.abbrev == layer), None)
                if tree is not None:
                    tree.children.insert(4, F("[Response time: %.3f ms]" % elapsed, 0, 0, layer + ".resptime", round(elapsed, 3)))
                    reply.fields[layer + ".resptime"] = [round(elapsed, 3)]
            elif request and not reply:
                request.info += " (no response found!)"

    def _udp(self, packet, data, body, end, src, dst, nodes):
        header = data[body:body + 8]
        if len(header) < 8:
            packet.top, packet.info = "UDP", "Malformed UDP"
            return end
        sport, dport, length, checksum = struct.unpack("!HHHH", header)
        packet.protocols.append("udp")
        packet.top = "UDP"
        payload = data[body + 8:min(end, body + length)]
        key = tuple(sorted([(src, sport), (dst, dport)]))
        stream = self._udp_streams.setdefault(key, len(self._udp_streams))
        packet.info = "%d → %d Len=%d" % (sport, dport, len(payload))
        packet.layers["udp"] = {"srcport": sport, "dstport": dport, "length": length, "payload": payload, "stream": stream}
        packet.fields.update({"udp.srcport": [sport], "udp.dstport": [dport], "udp.port": [sport, dport], "udp.length": [length],
                              "udp.checksum": [checksum], "udp.stream": [stream]})
        node = Node("User Datagram Protocol, Src Port: %d, Dst Port: %d" % (sport, dport), body, body + 8, abbrev="udp")
        node.children = [F("Source Port: %d" % sport, body, body + 2, "udp.srcport", sport),
                         F("Destination Port: %d" % dport, body + 2, body + 4, "udp.dstport", dport),
                         F("Length: %d" % length, body + 4, body + 6, "udp.length", length),
                         F("Checksum: 0x%04x [unverified]" % checksum, body + 6, body + 8, "udp.checksum", "0x%04x" % checksum,
                           [Node("[Checksum Status: Unverified]", body + 6, body + 8)]),
                         F("[Stream index: %d]" % stream, 0, 0, "udp.stream", stream),
                         F("UDP payload (%d bytes)" % len(payload), body + 8, body + 8 + len(payload), "udp.payload")]
        nodes.append(node)
        start, stop = body + 8, body + 8 + len(payload)
        if 53 in (sport, dport) or 5353 in (sport, dport):
            self._dns(packet, data, start, stop, nodes, "MDNS" if 5353 in (sport, dport) else "DNS")
        elif {sport, dport} <= {67, 68}:
            self._dhcp(packet, data, start, stop, nodes)
        elif 1900 in (sport, dport):
            packet.protocols.append("ssdp")
            packet.top, packet.info = "SSDP", payload.split(b"\r\n", 1)[0].decode("latin-1", "replace") + " "
        elif 123 in (sport, dport):
            packet.protocols.append("ntp")
            packet.top = "NTP"
            mode = payload[0] & 7 if payload else 0
            packet.info = "NTP Version %d, %s" % ((payload[0] >> 3) & 7 if payload else 0,
                                                 {1: "symmetric active", 3: "client", 4: "server", 5: "broadcast"}.get(mode, "mode %d" % mode))
        elif 443 in (sport, dport):
            packet.protocols.append("quic")
            packet.top, packet.info = "QUIC", "QUIC (%d bytes)" % len(payload)
        elif payload:
            packet.protocols.append("data")
            nodes.append(Node("Data (%d bytes)" % len(payload), start, stop, [F("Data: " + payload[:64].hex() + ("…" if len(payload) > 64 else ""),
                                                                                 start, stop, "data.data"), Node("[Length: %d]" % len(payload))],
                              abbrev="data"))
        return min(end, body + max(length, 8))

    # ------------------------------------------------------------------ DNS
    DNS_TYPES = {1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 12: "PTR", 15: "MX", 16: "TXT", 28: "AAAA", 33: "SRV", 65: "HTTPS", 255: "ANY"}
    DNS_RCODES = {0: "No error", 1: "Format error", 2: "Server failure", 3: "No such name", 4: "Not implemented", 5: "Refused"}

    def _dns_rdata(self, message, atype, start, rdlength):
        """(text for the Info column, details label, filter field, value) of one resource record's data."""
        rdata = message[start:start + rdlength]
        if atype == 1 and rdlength == 4:
            value = ipv4_text(rdata)
            return value, "addr " + value, "dns.a", value
        if atype == 28 and rdlength == 16:
            value = ipv6_text(rdata)
            return value, "addr " + value, "dns.aaaa", value
        if atype in (2, 5, 12):
            value = _dns_name(message, start)[0]
            label = {2: "ns", 5: "cname", 12: "ptr"}[atype]
            return value, "%s %s" % (label, value), {2: "dns.ns", 5: "dns.cname", 12: "dns.ptr.domain_name"}[atype], value
        if atype == 15 and rdlength >= 3:
            preference = struct.unpack("!H", rdata[:2])[0]
            value = _dns_name(message, start + 2)[0]
            return "%d %s" % (preference, value), "preference %d, mx %s" % (preference, value), "dns.mx.mail_exchange", value
        if atype == 6:
            primary = _dns_name(message, start)[0]
            return primary, "mname %s" % primary, "dns.soa.mname", primary
        if atype == 16 and rdata:
            text = rdata[1:1 + rdata[0]].decode("latin-1", "replace")
            return text, 'txt "%s"' % text, "dns.txt", text
        return "", "", "", None

    def _dns(self, packet, data, start, end, nodes, name):
        message = data[start:end]
        if len(message) < 12:
            return
        ident, flags, qd, an, ns, ar = struct.unpack("!HHHHHH", message[:12])
        response = bool(flags & 0x8000)
        opcode, rcode = (flags >> 11) & 0xF, flags & 0xF
        types = self.DNS_TYPES
        packet.protocols.append("mdns" if name == "MDNS" else "dns")
        packet.top = name
        node = Node("%s (%s)" % ("Multicast Domain Name System" if name == "MDNS" else "Domain Name System", "response" if response else "query"),
                    start, end, abbrev="mdns" if name == "MDNS" else "dns")
        flag_node = F("Flags: 0x%04x %s%s" % (flags, "Standard query response" if response else "Standard query",
                                              ", " + self.DNS_RCODES.get(rcode, "rcode %d" % rcode) if response else ""),
                      start + 2, start + 4, "dns.flags", "0x%04x" % flags, [
            F(bitline(16, 0x8000, flags, "Response", "Message is a response", "Message is a query"), start + 2, start + 4, "dns.flags.response", int(response)),
            F(".%s %s... .... .... = Opcode: %s (%d)" % (format(opcode, "04b")[:3], format(opcode, "04b")[3], "Standard query" if opcode == 0 else "Other", opcode),
              start + 2, start + 4, "dns.flags.opcode", opcode)])
        if response:
            flag_node.children += [
                F(bitline(16, 0x0400, flags, "Authoritative", "Server is an authority for domain", "Server is not an authority for domain"),
                  start + 2, start + 4, "dns.flags.authoritative", int(bool(flags & 0x0400))),
                F(bitline(16, 0x0200, flags, "Truncated", "Message is truncated", "Message is not truncated"), start + 2, start + 4,
                  "dns.flags.truncated", int(bool(flags & 0x0200))),
                F(bitline(16, 0x0100, flags, "Recursion desired", "Do query recursively", "Do not query recursively"), start + 2, start + 4,
                  "dns.flags.recdesired", int(bool(flags & 0x0100))),
                F(bitline(16, 0x0080, flags, "Recursion available", "Server can do recursive queries", "Server can't do recursive queries"),
                  start + 2, start + 4, "dns.flags.recavail", int(bool(flags & 0x0080))),
                F(".... .... .... %s = Reply code: %s (%d)" % (format(rcode, "04b"), self.DNS_RCODES.get(rcode, "Unknown"), rcode),
                  start + 2, start + 4, "dns.flags.rcode", rcode)]
        else:
            flag_node.children += [
                F(bitline(16, 0x0200, flags, "Truncated", "Message is truncated", "Message is not truncated"), start + 2, start + 4,
                  "dns.flags.truncated", int(bool(flags & 0x0200))),
                F(bitline(16, 0x0100, flags, "Recursion desired", "Do query recursively", "Do not query recursively"), start + 2, start + 4,
                  "dns.flags.recdesired", int(bool(flags & 0x0100)))]
        node.children = [F("Transaction ID: 0x%04x" % ident, start, start + 2, "dns.id", "0x%04x" % ident), flag_node,
                         F("Questions: %d" % qd, start + 4, start + 6, "dns.count.queries", qd),
                         F("Answer RRs: %d" % an, start + 6, start + 8, "dns.count.answers", an),
                         F("Authority RRs: %d" % ns, start + 8, start + 10, "dns.count.auth_rr", ns),
                         F("Additional RRs: %d" % ar, start + 10, start + 12, "dns.count.add_rr", ar)]
        fields = {"dns.id": [ident], "dns.flags.response": [int(response)], "dns.flags.rcode": [rcode], "dns.flags.opcode": [opcode],
                  "dns.count.queries": [qd], "dns.count.answers": [an], "dns.qry.name": [], "dns.qry.type": [], "dns.qry.class": [],
                  "dns.resp.name": [], "dns.resp.type": [], "dns.resp.ttl": [], "dns.a": [], "dns.aaaa": [], "dns.cname": []}
        position = 12
        questions, records = [], []
        try:
            for _ in range(min(qd, 32)):
                begin = position
                qname, position = _dns_name(message, position)
                qtype, qclass = struct.unpack("!HH", message[position:position + 4])
                position += 4
                questions.append((qname, qtype, qclass & 0x7FFF, begin, position))
            for section in (("Answers", an), ("Authoritative nameservers", ns), ("Additional records", ar)):
                for _ in range(min(section[1], 64)):
                    begin = position
                    rname, position = _dns_name(message, position)
                    rtype, rclass, ttl, rdlength = struct.unpack("!HHIH", message[position:position + 10])
                    position += 10
                    info, label, field_name, value = self._dns_rdata(message, rtype, position, rdlength)
                    records.append((section[0], rname, rtype, rclass & 0x7FFF, ttl, rdlength, info, label, field_name, value, begin, position + rdlength))
                    position += rdlength
        except (struct.error, IndexError, ValueError):
            pass
        if questions:
            queries = Node("Queries", start + 12, start + questions[-1][4])
            for qname, qtype, qclass, begin, stop in questions:
                tname = types.get(qtype, str(qtype))
                labels = qname.count(".") + 1 if qname != "<Root>" else 0
                queries.children.append(Node("%s: type %s, class %s" % (qname, tname, "IN" if qclass == 1 else qclass), start + begin, start + stop, [
                    F("Name: %s" % qname, start + begin, start + stop - 4, "dns.qry.name", qname),
                    Node("[Name Length: %d]" % len(qname)), Node("[Label Count: %d]" % labels),
                    F("Type: %s (%d)" % (tname, qtype), start + stop - 4, start + stop - 2, "dns.qry.type", qtype),
                    F("Class: %s (0x%04x)" % ("IN" if qclass == 1 else "Unknown", qclass), start + stop - 2, start + stop, "dns.qry.class", qclass)],
                    "dns.qry.name", qname))
                fields["dns.qry.name"].append(qname)
                fields["dns.qry.type"].append(qtype)
                fields["dns.qry.class"].append(qclass)
            node.children.append(queries)
        for section in ("Answers", "Authoritative nameservers", "Additional records"):
            items = [r for r in records if r[0] == section]
            if not items:
                continue
            group = Node(section, start + items[0][10], start + items[-1][11])
            for _sec, rname, rtype, rclass, ttl, rdlength, info, label, field_name, value, begin, stop in items:
                tname = types.get(rtype, str(rtype))
                children = [F("Name: %s" % rname, start + begin, start + stop - 10 - rdlength, "dns.resp.name", rname),
                            F("Type: %s (%d)" % (tname, rtype), start + stop - 10 - rdlength, start + stop - 8 - rdlength, "dns.resp.type", rtype),
                            F("Class: %s (0x%04x)" % ("IN" if rclass == 1 else "Unknown", rclass), start + stop - 8 - rdlength, start + stop - 6 - rdlength,
                              "dns.resp.class", rclass),
                            F("Time to live: %d (%s)" % (ttl, _duration(ttl)), start + stop - 6 - rdlength, start + stop - 2 - rdlength, "dns.resp.ttl", ttl),
                            F("Data length: %d" % rdlength, start + stop - 2 - rdlength, start + stop - rdlength, "dns.resp.len", rdlength)]
                if field_name:
                    children.append(F("%s: %s" % ({"dns.a": "Address", "dns.aaaa": "AAAA Address", "dns.cname": "CNAME", "dns.ns": "Name Server",
                                                   "dns.mx.mail_exchange": "Mail Exchange", "dns.soa.mname": "Primary name server",
                                                   "dns.ptr.domain_name": "Domain Name", "dns.txt": "TXT"}[field_name], value),
                                      start + stop - rdlength, start + stop, field_name, value))
                group.children.append(Node("%s: type %s, class %s%s" % (rname, tname, "IN" if rclass == 1 else rclass, ", " + label if label else ""),
                                           start + begin, start + stop, children))
                fields["dns.resp.name"].append(rname)
                fields["dns.resp.type"].append(rtype)
                fields["dns.resp.ttl"].append(ttl)
                if field_name in fields:
                    fields[field_name].append(value)
            node.children.append(group)
        qtext = " ".join("%s %s" % (types.get(t, t), n) for n, t, _c, _b, _e in questions)
        if response:
            answers = " ".join("%s %s" % (types.get(r[2], r[2]), r[6]) for r in records if r[0] == "Answers" and r[6])
            soa = next((r for r in records if r[0] == "Authoritative nameservers" and r[2] == 6), None)
            status = "" if rcode == 0 else " " + self.DNS_RCODES.get(rcode, "rcode %d" % rcode)
            tail = (" " + answers) if answers else (" SOA %s" % soa[6] if soa else "")
            packet.info = "Standard query response 0x%04x%s %s%s" % (ident, status, qtext, tail)
        else:
            packet.info = "Standard query 0x%04x %s" % (ident, qtext)
        # A query and its response share the transaction id between the same two hosts.
        ip = packet.layers.get("ip", {})
        key = (ident, ip.get("src"), ip.get("dst")) if not response else (ident, ip.get("dst"), ip.get("src"))
        if not response:
            self._dns_queries[key] = packet
        else:
            query = self._dns_queries.pop(key, None)
            if query is not None:
                query_node = next((n for n in query.tree if n.abbrev in ("dns", "mdns")), None)
                if query_node is not None:
                    query_node.children.append(F("[Response In: %d]" % packet.number, 0, 0, "dns.response_in", packet.number))
                elapsed = packet.epoch - query.epoch
                node.children += [F("[Request In: %d]" % query.number, 0, 0, "dns.response_to", query.number),
                                  F("[Time: %.9f seconds]" % elapsed, 0, 0, "dns.time", round(elapsed, 9))]
                fields["dns.response_to"] = [query.number]
                fields["dns.time"] = [round(elapsed, 9)]
                query.fields["dns.response_in"] = [packet.number]
        packet.layers["dns"] = {"id": ident, "response": response, "rcode": rcode, "questions": [(n, t) for n, t, _c, _b, _e in questions],
                                "answers": [(r[1], r[2], r[9] if r[2] == 1 else "") for r in records if r[0] == "Answers"]}
        packet.fields.update(fields)
        nodes.append(node)

    # ------------------------------------------------------------------ DHCP
    DHCP_MESSAGES = {1: "Discover", 2: "Offer", 3: "Request", 4: "Decline", 5: "ACK", 6: "NAK", 7: "Release", 8: "Inform"}
    DHCP_OPTIONS = {1: "Subnet Mask", 3: "Router", 6: "Domain Name Server", 12: "Host Name", 15: "Domain Name", 28: "Broadcast Address",
                    50: "Requested IP Address", 51: "IP Address Lease Time", 53: "DHCP Message Type", 54: "DHCP Server Identifier",
                    55: "Parameter Request List", 57: "Maximum DHCP Message Size", 58: "Renewal Time Value", 59: "Rebinding Time Value",
                    60: "Vendor class identifier", 61: "Client identifier", 81: "Client Fully Qualified Domain Name", 255: "End"}
    DHCP_IP_OPTIONS = {1: "dhcp.option.subnet_mask", 3: "dhcp.option.router", 6: "dhcp.option.domain_name_server", 28: "dhcp.option.broadcast_address",
                       50: "dhcp.option.requested_ip_address", 54: "dhcp.option.dhcp_server_id"}
    DHCP_TIME_OPTIONS = {51: "dhcp.option.ip_address_lease_time", 58: "dhcp.option.renewal_time_value", 59: "dhcp.option.rebinding_time_value"}

    def _dhcp(self, packet, data, start, end, nodes):
        message = data[start:end]
        if len(message) < 240 or message[236:240] != b"\x63\x82\x53\x63":
            packet.protocols.append("dhcp")
            packet.top, packet.info = "DHCP", "Malformed DHCP message"
            return
        packet.protocols.append("dhcp")
        packet.top = "DHCP"
        op, htype, hlen, hops = message[0], message[1], message[2], message[3]
        xid, secs, bflags = struct.unpack("!IHH", message[4:12])
        ciaddr, yiaddr, siaddr, giaddr = (ipv4_text(message[i:i + 4]) for i in (12, 16, 20, 24))
        chaddr = mac_text(message[28:34])
        sname = message[44:108].split(b"\0", 1)[0].decode("latin-1", "replace")
        filename = message[108:236].split(b"\0", 1)[0].decode("latin-1", "replace")
        fields = {"dhcp.type": [op], "dhcp.hw.type": [htype], "dhcp.hw.len": [hlen], "dhcp.hops": [hops], "dhcp.id": [xid], "dhcp.secs": [secs],
                  "dhcp.flags": [bflags], "dhcp.flags.bc": [int(bool(bflags & 0x8000))], "dhcp.ip.client": [ciaddr], "dhcp.ip.your": [yiaddr],
                  "dhcp.ip.server": [siaddr], "dhcp.ip.relay": [giaddr], "dhcp.hw.mac_addr": [chaddr], "dhcp.cookie": [1]}
        s = start
        node = Node("Dynamic Host Configuration Protocol", start, end, abbrev="dhcp")
        node.children = [
            F("Message type: %s (%d)" % ("Boot Request" if op == 1 else "Boot Reply" if op == 2 else "Unknown", op), s, s + 1, "dhcp.type", op),
            F("Hardware type: %s (0x%02x)" % ("Ethernet" if htype == 1 else "Unknown", htype), s + 1, s + 2, "dhcp.hw.type", "0x%02x" % htype),
            F("Hardware address length: %d" % hlen, s + 2, s + 3, "dhcp.hw.len", hlen),
            F("Hops: %d" % hops, s + 3, s + 4, "dhcp.hops", hops),
            F("Transaction ID: 0x%08x" % xid, s + 4, s + 8, "dhcp.id", "0x%08x" % xid),
            F("Seconds elapsed: %d" % secs, s + 8, s + 10, "dhcp.secs", secs),
            F("Bootp flags: 0x%04x (%s)" % (bflags, "Broadcast" if bflags & 0x8000 else "Unicast"), s + 10, s + 12, "dhcp.flags", "0x%04x" % bflags, [
                F(bitline(16, 0x8000, bflags, "Broadcast flag", "Broadcast", "Unicast"), s + 10, s + 12, "dhcp.flags.bc", int(bool(bflags & 0x8000))),
                F(bitline(16, 0x7FFF, bflags, "Reserved flags", "0x%04x" % (bflags & 0x7FFF), "0x0000"), s + 10, s + 12, "dhcp.flags.reserved")]),
            F("Client IP address: %s" % ciaddr, s + 12, s + 16, "dhcp.ip.client", ciaddr),
            F("Your (client) IP address: %s" % yiaddr, s + 16, s + 20, "dhcp.ip.your", yiaddr),
            F("Next server IP address: %s" % siaddr, s + 20, s + 24, "dhcp.ip.server", siaddr),
            F("Relay agent IP address: %s" % giaddr, s + 24, s + 28, "dhcp.ip.relay", giaddr),
            F("Client MAC address: %s" % mac_with_name(chaddr), s + 28, s + 34, "dhcp.hw.mac_addr", chaddr),
            F("Client hardware address padding: %s" % message[34:44].hex(), s + 34, s + 44, "dhcp.hw.addr_padding"),
            F("Server host name: %s" % sname if sname else "Server host name not given", s + 44, s + 108, "dhcp.server", sname),
            F("Boot file name: %s" % filename if filename else "Boot file name not given", s + 108, s + 236, "dhcp.file", filename),
            F("Magic cookie: DHCP", s + 236, s + 240, "dhcp.cookie"),
        ]
        position, kind_name = 240, ""
        while position < len(message):
            code = message[position]
            if code == 0:
                position += 1
                continue
            if code == 255:
                node.children.append(F("Option: (255) End", s + position, s + position + 1, "dhcp.option.type", 255,
                                       [F("Option End: 255", s + position, s + position + 1, "dhcp.option.end", 255)]))
                fields.setdefault("dhcp.option.type", []).append(255)
                position += 1
                break
            if position + 2 > len(message):
                break
            length = message[position + 1]
            value = message[position + 2:position + 2 + length]
            if len(value) < length:
                break
            name = self.DHCP_OPTIONS.get(code, "Unknown")
            begin, stop = s + position, s + position + 2 + length
            children = [F("Length: %d" % length, begin + 1, begin + 2, "dhcp.option.length", length)]
            label = "Option: (%d) %s" % (code, name)
            if code == 53 and length == 1:
                kind_name = self.DHCP_MESSAGES.get(value[0], "Unknown")
                label += " (%s)" % kind_name
                children.append(F("DHCP: %s (%d)" % (kind_name, value[0]), begin + 2, stop, "dhcp.option.dhcp", value[0]))
                fields["dhcp.option.dhcp"] = [value[0]]
            elif code in self.DHCP_IP_OPTIONS and length >= 4 and length % 4 == 0:
                addresses = [ipv4_text(value[i:i + 4]) for i in range(0, length, 4)]
                field_name = self.DHCP_IP_OPTIONS[code]
                if code in (50, 54, 1):
                    label += " (%s)" % addresses[0]
                for index, address in enumerate(addresses):
                    caption = {1: "Subnet Mask", 3: "Router", 6: "Domain Name Server", 28: "Broadcast Address", 50: "Requested IP Address",
                               54: "DHCP Server Identifier"}[code]
                    children.append(F("%s: %s" % (caption, address), begin + 2 + index * 4, begin + 6 + index * 4, field_name, address))
                fields.setdefault(field_name, []).extend(addresses)
            elif code in self.DHCP_TIME_OPTIONS and length == 4:
                seconds = struct.unpack("!I", value)[0]
                label += " (%s)" % _duration(seconds)
                children.append(F("%s: %s (%d)" % (name, _duration(seconds), seconds), begin + 2, stop, self.DHCP_TIME_OPTIONS[code], seconds))
                fields[self.DHCP_TIME_OPTIONS[code]] = [seconds]
            elif code in (12, 15, 60):
                text = value.decode("latin-1", "replace")
                children.append(F("%s: %s" % (name, text), begin + 2, stop,
                                  {12: "dhcp.option.hostname", 15: "dhcp.option.domain_name", 60: "dhcp.option.vendor_class_id"}[code], text))
                fields[{12: "dhcp.option.hostname", 15: "dhcp.option.domain_name", 60: "dhcp.option.vendor_class_id"}[code]] = [text]
            elif code == 55:
                for index, item in enumerate(value):
                    children.append(F("Parameter Request List Item: (%d) %s" % (item, self.DHCP_OPTIONS.get(item, "Unknown")),
                                      begin + 2 + index, begin + 3 + index, "dhcp.option.request_list_item", item))
                fields["dhcp.option.request_list_item"] = list(value)
            elif code == 61 and length >= 1:
                children.append(F("Hardware type: %s (0x%02x)" % ("Ethernet" if value[0] == 1 else "Unknown", value[0]), begin + 2, begin + 3,
                                  "dhcp.hw.type", "0x%02x" % value[0]))
                if value[0] == 1 and length == 7:
                    mac = mac_text(value[1:7])
                    children.append(F("Client MAC address: %s" % mac_with_name(mac), begin + 3, stop, "dhcp.hw.mac_addr", mac))
            elif code == 57 and length == 2:
                size = struct.unpack("!H", value)[0]
                children.append(F("Maximum DHCP Message Size: %d" % size, begin + 2, stop, "dhcp.option.max_dhcp_message_size", size))
            else:
                children.append(F("Value: %s" % value.hex(), begin + 2, stop, "dhcp.option.value", value.hex()))
            node.children.append(F(label, begin, stop, "dhcp.option.type", code,
                                   [F("Length: %d" % length, begin + 1, begin + 2, "dhcp.option.length", length)] + children[1:]))
            fields.setdefault("dhcp.option.type", []).append(code)
            position += 2 + length
        if kind_name:
            node.label = "Dynamic Host Configuration Protocol (%s)" % kind_name
        packet.info = "DHCP %s - Transaction ID 0x%x" % (kind_name or "message", xid)
        packet.layers["dhcp"] = {"op": op, "xid": xid, "message": kind_name, "client_mac": chaddr, "your_ip": yiaddr,
                                 "options": fields.get("dhcp.option.type", [])}
        packet.fields.update(fields)
        nodes.append(node)

    def _tcp(self, packet, data, body, end, src, dst, nodes):
        header = data[body:body + 20]
        if len(header) < 20:
            packet.top, packet.info = "TCP", "Malformed TCP"
            return end
        sport, dport, seq, ack, offset_flags, window, checksum, urgent = struct.unpack("!HHIIHHHH", header)
        header_length = (offset_flags >> 12) * 4
        flags = offset_flags & 0x1FF
        if header_length < 20 or body + header_length > len(data):
            packet.top, packet.info = "TCP", "Malformed TCP"
            return end
        payload = data[body + header_length:end]
        packet.protocols.append("tcp")
        packet.top = "TCP"
        # Stream bookkeeping: relative sequence numbers count from the first segment seen in each direction.
        key = tuple(sorted([(src, sport), (dst, dport)]))
        stream = self._stream_by_key.get(key)
        if stream is None:
            stream = TcpStream(len(self.streams), (src, sport), (dst, dport))
            self.streams.append(stream)
            self._stream_by_key[key] = stream
        side = stream.direction((src, sport))
        other = "s" if side == "c" else "c"
        stream.isn.setdefault(side, seq)
        stream.packets.append(packet)
        rel_seq = (seq - stream.isn[side]) & 0xFFFFFFFF
        rel_ack = (ack - stream.isn[other]) & 0xFFFFFFFF if (flags & 0x10) and other in stream.isn else ack
        # A SYN occupies one sequence number, so data starts at ISN+1 (that is already how rel_seq counts it).
        stream.segments[side][rel_seq] = payload if payload else stream.segments[side].get(rel_seq)
        packet.stream = stream.index
        options, option_info, shift = self._tcp_options(data, body + 20, body + header_length)
        if flags & 0x02:
            stream.wscale[side] = shift                      # None when the SYN carries no window scale option
        scaling = stream.wscale.get(side) if None not in (stream.wscale.get("c", None), stream.wscale.get("s", None))             and len(stream.wscale) == 2 else None
        scaled = window << scaling if (scaling is not None and not flags & 0x02) else window
        names = [("FIN", 0x01), ("SYN", 0x02), ("RST", 0x04), ("PSH", 0x08), ("ACK", 0x10), ("URG", 0x20), ("ECE", 0x40), ("CWR", 0x80)]
        flag_names = [name for name, bit in names if flags & bit]
        info = "%d → %d [%s] Seq=%d" % (sport, dport, ", ".join(flag_names), rel_seq)
        if flags & 0x10:
            info += " Ack=%d" % rel_ack
        info += " Win=%d Len=%d" % (scaled, len(payload)) + option_info
        packet.info = info
        packet.layers["tcp"] = {"srcport": sport, "dstport": dport, "seq": seq, "ack": ack, "rel_seq": rel_seq, "rel_ack": rel_ack, "flags": flags,
                                "window": window, "window_scaled": scaled, "payload": payload, "stream": stream.index,
                                "options": options}
        packet.fields.update({"tcp.srcport": [sport], "tcp.dstport": [dport], "tcp.port": [sport, dport], "tcp.seq": [rel_seq], "tcp.ack": [rel_ack],
                              "tcp.flags": [flags], "tcp.flags.fin": [int(bool(flags & 1))], "tcp.flags.syn": [int(bool(flags & 2))],
                              "tcp.flags.reset": [int(bool(flags & 4))], "tcp.flags.push": [int(bool(flags & 8))], "tcp.flags.ack": [int(bool(flags & 16))],
                              "tcp.flags.urg": [int(bool(flags & 32))], "tcp.len": [len(payload)], "tcp.stream": [stream.index],
                              "tcp.window_size": [scaled], "tcp.window_size_value": [window], "tcp.hdr_len": [header_length]})
        flag_text = ", ".join(flag_names)
        tcp_node = Node("Transmission Control Protocol, Src Port: %d, Dst Port: %d, Seq: %d%s, Len: %d" % (
            sport, dport, rel_seq, ", Ack: %d" % rel_ack if flags & 0x10 else "", len(payload)), body, body + header_length, abbrev="tcp")
        tcp_node.children = [
            F("Source Port: %d" % sport, body, body + 2, "tcp.srcport", sport), F("Destination Port: %d" % dport, body + 2, body + 4, "tcp.dstport", dport),
            F("[Stream index: %d]" % stream.index, 0, 0, "tcp.stream", stream.index),
            F("[TCP Segment Len: %d]" % len(payload), body + 12, body + 13, "tcp.len", len(payload)),
            F("Sequence Number: %d    (relative sequence number)" % rel_seq, body + 4, body + 8, "tcp.seq", rel_seq),
            F("Sequence Number (raw): %d" % seq, body + 4, body + 8, "tcp.seq_raw", seq),
            F("[Next Sequence Number: %d    (relative sequence number)]" % (rel_seq + len(payload) + (1 if flags & 3 else 0)), 0, 0, "tcp.nxtseq",
              rel_seq + len(payload) + (1 if flags & 3 else 0)),
        ]
        if flags & 0x10:
            tcp_node.children += [F("Acknowledgment Number: %d    (relative ack number)" % rel_ack, body + 8, body + 12, "tcp.ack", rel_ack),
                                  F("Acknowledgment number (raw): %d" % ack, body + 8, body + 12, "tcp.ack_raw", ack)]
        tcp_node.children += [
            F("%s .... = Header Length: %d bytes (%d)" % (format(header_length // 4, "04b"), header_length, header_length // 4), body + 12, body + 13,
              "tcp.hdr_len", header_length),
            F("Flags: 0x%03x (%s)" % (flags, flag_text), body + 12, body + 14, "tcp.flags", "0x%03x" % flags, [
                F(bitline(12, 0x800 | 0x400 | 0x200, flags, "Reserved", "Set", "Not set"), body + 12, body + 13, "tcp.flags.res", int(bool(flags & 0xE00))),
                F(bitline(12, 0x100, flags, "Accurate ECN", "Set", "Not set"), body + 12, body + 13, "tcp.flags.ae", int(bool(flags & 0x100))),
                F(bitline(12, 0x080, flags, "Congestion Window Reduced", "Set", "Not set"), body + 13, body + 14, "tcp.flags.cwr", int(bool(flags & 0x80))),
                F(bitline(12, 0x040, flags, "ECN-Echo", "Set", "Not set"), body + 13, body + 14, "tcp.flags.ece", int(bool(flags & 0x40))),
                F(bitline(12, 0x020, flags, "Urgent", "Set", "Not set"), body + 13, body + 14, "tcp.flags.urg", int(bool(flags & 0x20))),
                F(bitline(12, 0x010, flags, "Acknowledgment", "Set", "Not set"), body + 13, body + 14, "tcp.flags.ack", int(bool(flags & 0x10))),
                F(bitline(12, 0x008, flags, "Push", "Set", "Not set"), body + 13, body + 14, "tcp.flags.push", int(bool(flags & 0x08))),
                F(bitline(12, 0x004, flags, "Reset", "Set", "Not set"), body + 13, body + 14, "tcp.flags.reset", int(bool(flags & 0x04))),
                F(bitline(12, 0x002, flags, "Syn", "Set", "Not set"), body + 13, body + 14, "tcp.flags.syn", int(bool(flags & 0x02))),
                F(bitline(12, 0x001, flags, "Fin", "Set", "Not set"), body + 13, body + 14, "tcp.flags.fin", int(bool(flags & 0x01))),
                F("[TCP Flags: %s]" % "".join(ch if flags & bit else "·" for ch, bit in zip("···ACEUAPRSF", (
                    0x800, 0x400, 0x200, 0x100, 0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01))), 0, 0, "tcp.flags.str")]),
            F("Window: %d" % window, body + 14, body + 16, "tcp.window_size_value", window),
            F("[Calculated window size: %d]" % scaled, 0, 0, "tcp.window_size", scaled),
            F("[Window size scaling factor: %s]" % (str(1 << scaling) if scaling is not None else "-1 (unknown)" if len(stream.wscale) < 2 else "-2 (no window scaling used)"),
              0, 0, "tcp.window_size_scalefactor"),
            F("Checksum: 0x%04x [unverified]" % checksum, body + 16, body + 18, "tcp.checksum", "0x%04x" % checksum,
              [Node("[Checksum Status: Unverified]", body + 16, body + 18)]),
            F("Urgent Pointer: %d" % urgent, body + 18, body + 20, "tcp.urgent_pointer", urgent),
        ]
        if header_length > 20:
            tcp_node.children.append(F("Options: (%d bytes), %s" % (header_length - 20, ", ".join(options) or "End of Option List (EOL)"),
                                       body + 20, body + header_length, "tcp.options"))
        nodes.append(tcp_node)
        if payload:
            tcp_node.children.append(F("TCP payload (%d bytes)" % len(payload), body + header_length, end, "tcp.payload"))
            self._application(packet, data, body + header_length, end, payload, sport, dport, nodes)
        return end

    def _tcp_options(self, data, start, end):
        names, info, position, shift = [], "", start, None
        while position < end:
            kind = data[position]
            if kind == 0:
                names.append("End of Option List (EOL)")
                break
            if kind == 1:
                names.append("No-Operation (NOP)")
                position += 1
                continue
            if position + 1 >= end:
                break
            length = data[position + 1]
            if length < 2 or position + length > end:
                break
            body = data[position + 2:position + length]
            if kind == 2 and len(body) == 2:
                value = struct.unpack("!H", body)[0]
                names.append("Maximum segment size")
                info += " MSS=%d" % value
            elif kind == 3 and len(body) == 1:
                names.append("Window scale")
                shift = body[0]
                info += " WS=%d" % (1 << body[0])
            elif kind == 4:
                names.append("SACK permitted")
                info += " SACK_PERM"
            elif kind == 8 and len(body) == 8:
                tsval, tsecr = struct.unpack("!II", body)
                names.append("Timestamps")
                info += " TSval=%d TSecr=%d" % (tsval, tsecr)
            else:
                names.append("Option kind %d" % kind)
            position += length
        return names, info, shift

    # ------------------------------------------------------------------ application layer
    def _application(self, packet, data, start, end, payload, sport, dport, nodes):
        if payload.startswith(HTTP_METHODS) or payload.startswith(b"HTTP/1."):
            self._http(packet, start, end, payload, nodes)
        elif len(payload) >= 5 and payload[0] in TLS_RECORDS and payload[1] == 3 and payload[2] <= 4:
            version = TLS_VERSIONS.get(struct.unpack("!H", payload[1:3])[0], "TLS")
            packet.protocols.append("tls")
            packet.top = version
            packet.info = TLS_RECORDS[payload[0]]
            if payload[0] == 22 and len(payload) > 5:
                packet.info = {1: "Client Hello", 2: "Server Hello", 11: "Certificate", 14: "Server Hello Done", 16: "Client Key Exchange"}.get(payload[5], "Handshake")
            nodes.append(Node("Transport Layer Security", start, end, [Node("%s Record Layer: %s Protocol" % (version, TLS_RECORDS[payload[0]]), start, end,
                                                                            [F("Content Type: %s (%d)" % (TLS_RECORDS[payload[0]], payload[0]), start, start + 1,
                                                                               "tls.record.content_type", payload[0])])], "tls"))
            packet.fields["tls.record.content_type"] = [payload[0]]
            if payload[0] == 22 and len(payload) > 5:
                packet.fields["tls.handshake.type"] = [payload[5]]
        elif 80 in (sport, dport) or 8080 in (sport, dport):
            packet.info += " [TCP segment of a reassembled PDU]"

    def _http(self, packet, start, end, payload, nodes):
        head, _sep, body = payload.partition(b"\r\n\r\n")
        lines = head.decode("latin-1").split("\r\n")
        first = lines[0]
        packet.protocols.append("http")
        packet.top = "HTTP"
        headers = {}
        for line in lines[1:]:
            if ":" in line:
                key, value = line.split(":", 1)
                headers[key.strip().lower()] = value.strip()
        children, position = [], start
        is_request = not first.startswith("HTTP/")
        for index, line in enumerate(lines):
            length = len(line) + 2
            stop = min(end, position + length)
            if index == 0:
                parts = line.split(" ", 2)
                if not is_request:
                    sub = [F("Response Version: %s" % parts[0], position, position + len(parts[0]), "http.response.version", parts[0])]
                    if len(parts) > 1:
                        sub.append(F("Status Code: %s" % parts[1], position + len(parts[0]) + 1, position + len(parts[0]) + 1 + len(parts[1]),
                                     "http.response.code", int(parts[1]) if parts[1].isdigit() else parts[1]))
                    if len(parts) > 2:
                        sub.append(F("Response Phrase: %s" % parts[2], stop - 2 - len(parts[2]), stop - 2, "http.response.phrase", parts[2]))
                    children.append(F(line + "\\r\\n", position, stop, "http.response.line", None, sub))
                else:
                    cursor, sub = position, []
                    for label, key, value in zip(("Request Method", "Request URI", "Request Version"),
                                                 ("http.request.method", "http.request.uri", "http.request.version"), parts):
                        sub.append(F("%s: %s" % (label, value), cursor, cursor + len(value), key, value))
                        cursor += len(value) + 1
                    children.append(F(line + "\\r\\n", position, stop, "http.request.line", None, sub))
            else:
                key = line.split(":", 1)[0].strip().lower() if ":" in line else ""
                value = line.split(":", 1)[1].strip() if ":" in line else ""
                abbrev = HTTP_HEADER_FIELDS.get(key, "http.request.line" if is_request else "http.response.line")
                children.append(F(line + "\\r\\n", position, stop, abbrev, value if key in HTTP_HEADER_FIELDS else None))
            position += length
        has_blank = _sep != b""
        if has_blank:
            children.append(Node("\\r\\n", min(end, position), min(end, position + 2)))
        request = not first.startswith("HTTP/")
        content_type = headers.get("content-type", "")
        layer = {"first_line": first, "headers": headers, "body": body, "request": request}
        if request:
            parts = first.split(" ")
            method, uri = parts[0], parts[1] if len(parts) > 1 else ""
            host = headers.get("host", "")
            layer.update(method=method, uri=uri, host=host)
            packet.fields.update({"http": [1], "http.request": [1], "http.request.method": [method], "http.request.uri": [uri],
                                  "http.host": [host], "http.user_agent": [headers.get("user-agent", "")]})
            children.append(F("[Full request URI: http://%s%s]" % (host, uri), 0, 0, "http.request.full_uri", "http://%s%s" % (host, uri)))
            packet.info = "%s %s %s " % (method, uri, parts[2] if len(parts) > 2 else "HTTP/1.1")
            if method == "POST" and "x-www-form-urlencoded" in content_type:
                packet.info = packet.info.rstrip() + "  (application/x-www-form-urlencoded)"
        else:
            parts = first.split(" ", 2)
            code = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
            phrase = parts[2] if len(parts) > 2 else ""
            layer.update(code=code, phrase=phrase)
            packet.fields.update({"http": [1], "http.response": [1], "http.response.code": [code], "http.content_type": [content_type]})
            packet.info = "%s  (%s)" % (first, content_type.split(";")[0]) if content_type else first
        packet.fields["http.file_data"] = [body.decode("latin-1")] if body else []
        if headers.get("content-length", "").isdigit():
            packet.fields["http.content_length"] = [int(headers["content-length"])]
        # Requests and responses of one TCP connection pair up in order.
        pending = self._http_pending.setdefault(packet.stream, [])
        if request:
            pending.append(packet)
        elif pending:
            asked = pending.pop(0)
            elapsed = packet.epoch - asked.epoch
            asked_node = next((n for n in asked.tree if n.abbrev == "http"), None)
            if asked_node is not None:
                asked_node.children.append(F("[Response in frame: %d]" % packet.number, 0, 0, "http.response_in", packet.number))
            asked.fields["http.response_in"] = [packet.number]
            full = "http://%s%s" % (asked.layers["http"].get("host", ""), asked.layers["http"].get("uri", ""))
            children += [F("[Time since request: %.9f seconds]" % elapsed, 0, 0, "http.time", round(elapsed, 9)),
                         F("[Request in frame: %d]" % asked.number, 0, 0, "http.request_in", asked.number),
                         F("[Request URI: %s]" % full, 0, 0, "http.response_for.uri", full)]
            packet.fields.update({"http.time": [round(elapsed, 9)], "http.request_in": [asked.number]})
        if body:
            children.append(F("File Data: %d bytes" % len(body), end - len(body), end, "http.file_data"))
        node = Node("Hypertext Transfer Protocol", start, end, children, "http")
        nodes.append(node)
        if body:
            body_start = end - len(body)
            if "x-www-form-urlencoded" in content_type:
                packet.protocols.append("urlencoded-form")
                items = []
                text = body.decode("latin-1")
                for pair in text.split("&"):
                    key, _eq, value = pair.partition("=")
                    items.append((unquote_plus(key), unquote_plus(value)))
                layer["form"] = items
                packet.fields["urlencoded-form.key"] = [k for k, _ in items]
                packet.fields["urlencoded-form.value"] = [v for _, v in items]
                form = Node("HTML Form URL Encoded: application/x-www-form-urlencoded", body_start, end, abbrev="urlencoded-form")
                cursor = body_start
                for pair, (key, value) in zip(text.split("&"), items):
                    form.children.append(Node('Form item: "%s" = "%s"' % (key, value), cursor, cursor + len(pair),
                                              [F("Key: %s" % key, cursor, cursor + len(key), "urlencoded-form.key", key),
                                               F("Value: %s" % value, cursor + len(key) + 1, cursor + len(pair), "urlencoded-form.value", value)]))
                    cursor += len(pair) + 1
                nodes.append(form)
            elif "text" in content_type or "html" in content_type:
                lines_in_body = body.decode("latin-1").count("\n") + 1
                nodes.append(Node("Line-based text data: %s (%d lines)" % (content_type.split(";")[0] or "text/plain", lines_in_body), body_start, end,
                                  [Node(printable_line(line), body_start, end) for line in body.decode("latin-1").splitlines()[:40]], "data-text-lines"))
                packet.protocols.append("data-text-lines")
        packet.layers["http"] = layer

    # ------------------------------------------------------------------ colouring
    def _color(self, packet):
        protocols = set(packet.protocols)
        tcp = packet.layers.get("tcp")
        for name, _text, bg, fg in COLOR_RULES:
            if name == "ARP" and "arp" in protocols:
                return (name, bg, fg)
            if name == "ICMP" and ("icmp" in protocols or "icmpv6" in protocols):
                return (name, bg, fg)
            if name == "TCP RST" and tcp and tcp["flags"] & 0x04:
                return (name, bg, fg)
            if name == "HTTP" and ("http" in protocols or (tcp and 80 in (tcp["srcport"], tcp["dstport"]))):
                return (name, bg, fg)
            if name == "TCP SYN/FIN" and tcp and tcp["flags"] & 0x03:
                return (name, bg, fg)
            if name == "TCP" and tcp:
                return (name, bg, fg)
            if name == "UDP" and "udp" in protocols:
                return (name, bg, fg)
            if name == "Broadcast" and packet.data[0] & 1:
                return (name, bg, fg)
        return ("", "#FFFFFF", "#12272E")


def _swap16(value):
    return ((value & 0xFF) << 8) | (value >> 8)


def _fields_from_tree(nodes, fields):
    """Every filterable details line is also a display-filter field, so Apply as Filter on any line finds this packet again."""
    for node in nodes:
        if node.abbrev and node.value is not None and node.abbrev not in fields:
            fields.setdefault("_tree_" + node.abbrev, []).append(node.value)
        _fields_from_tree(node.children, fields)


def _merge_tree_fields(fields):
    for key in [k for k in fields if k.startswith("_tree_")]:
        fields.setdefault(key[6:], fields.pop(key))


def _duration(seconds):
    """Wireshark's time-span wording: 300 -> '5 minutes', 86400 -> '1 day', 3725 -> '1 hour, 2 minutes, 5 seconds'."""
    seconds = int(seconds)
    if seconds == 0:
        return "0 seconds"
    parts = []
    for size, word in ((86400, "day"), (3600, "hour"), (60, "minute"), (1, "second")):
        count, seconds = divmod(seconds, size)
        if count:
            parts.append("%d %s%s" % (count, word, "" if count == 1 else "s"))
    return ", ".join(parts)


def _group(bits):
    return " ".join(bits[i:i + 4] for i in range(0, len(bits), 4))


def _dns_name(message, position):
    labels, jumped, original = [], False, position
    for _ in range(64):
        length = message[position]
        if length == 0:
            position += 1
            break
        if length & 0xC0 == 0xC0:
            pointer = ((length & 0x3F) << 8) | message[position + 1]
            if not jumped:
                original = position + 2
            jumped, position = True, pointer
            continue
        labels.append(message[position + 1:position + 1 + length].decode("latin-1"))
        position += 1 + length
    else:
        raise ValueError("DNS name too long")
    return ".".join(labels) or "<Root>", (original if jumped else position)


def printable_line(text):
    return re.sub(r"[^\x20-\x7e]", ".", text)[:200]


def printable_text(data):
    """Follow-stream text: printable ASCII, line breaks kept, everything else a dot (as Wireshark's ASCII view)."""
    return "".join(chr(b) if 32 <= b < 127 or b in (10, 13) else "." for b in data)


def hex_rows(data):
    rows = []
    for offset in range(0, len(data), 16):
        chunk = data[offset:offset + 16]
        rows.append({"offset": offset, "hex": [("%02x" % byte) for byte in chunk], "ascii": printable(chunk)})
    return rows


def open_session(capture_bytes):
    from .pcap import read_capture
    return Session(read_capture(capture_bytes))
