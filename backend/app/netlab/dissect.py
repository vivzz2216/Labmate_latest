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

    def to_dict(self):
        return {"label": self.label, "start": self.start, "end": self.end, "children": [child.to_dict() for child in self.children]}


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
        return {"no": self.number, "time": round(self.time, 6), "source": self.source, "destination": self.destination,
                "protocol": self.top, "length": self.original_length, "info": self.info, "stream": self.stream,
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
        self._echo = {}
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
        packet = Dissected(frame.number, frame.timestamp - self._t0, frame.timestamp, frame.data, frame.original_length)
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
                              "frame.time_relative": [packet.time], "eth.dst": [dst], "eth.src": [src], "eth.addr": [dst, src],
                              "eth.type": [ethertype], "eth.ig": [int(bool(data[0] & 1))], "eth.lg": [int(bool(data[0] & 2))]})
        packet.layers["eth"] = {"dst": dst, "src": src, "type": ethertype, "vlan": vlan}
        eth_node = Node("Ethernet II, Src: %s, Dst: %s" % (mac_with_name(src), mac_with_name(dst)), 0, offset)
        eth_node.children = [self._mac_node("Destination", dst, 0), self._mac_node("Source", src, 6)]
        if vlan is not None:
            eth_node.children.append(Node("802.1Q Virtual LAN, ID: %d" % vlan, 12, 16))
        eth_node.children.append(Node("Type: %s (0x%04x)" % (ETHERTYPES.get(ethertype, "Unknown"), ethertype), offset - 2, offset))
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
                    % (packet.number, packet.original_length, bits, captured, captured * 8), 0, captured)
        node.children = [
            Node("Encapsulation type: Ethernet (1)"),
            Node("Arrival Time: %s%s UTC" % (arrival, fraction)),
            Node("Epoch Arrival Time: %.6f000" % packet.epoch),
            Node("[Time since first frame in this capture: %.6f000 seconds]" % packet.time),
            Node("Frame Number: %d" % packet.number),
            Node("Frame Length: %d bytes (%d bits)" % (packet.original_length, bits)),
            Node("Capture Length: %d bytes (%d bits)" % (captured, captured * 8)),
            Node("[Frame is marked: False]"),
            Node("[Frame is ignored: False]"),
        ]
        return node

    def _mac_node(self, label, text, start):
        node = Node("%s: %s" % (label, mac_with_name(text)), start, start + 6)
        oui = int(text[:8].replace(":", ""), 16)       # the first three bytes carry the LG and IG bits
        node.children = [Node("Address: %s" % mac_with_name(text), start, start + 6),
                         Node(bitline(24, 0x020000, oui, "LG bit", "Locally administered address (this is NOT the factory default)",
                                      "Globally unique address (factory default)"), start, start + 3),
                         Node(bitline(24, 0x010000, oui, "IG bit", "Group address (multicast/broadcast)", "Individual address (unicast)"),
                              start, start + 3)]
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
        if opcode == 1:
            packet.info = ("ARP Announcement for %s" % spa) if spa == tpa else "Who has %s? Tell %s" % (tpa, spa)
        elif opcode == 2:
            packet.info = "%s is at %s" % (spa, sha)
        else:
            packet.info = "ARP opcode %d" % opcode
        packet.layers["arp"] = {"hardware_type": htype, "protocol_type": ptype, "hardware_size": hlen, "protocol_size": plen,
                                "opcode": opcode, "sender_mac": sha, "sender_ip": spa, "target_mac": tha, "target_ip": tpa}
        packet.fields.update({"arp.opcode": [opcode], "arp.hw.type": [htype], "arp.proto.type": [ptype], "arp.hw.size": [hlen],
                              "arp.proto.size": [plen], "arp.src.hw_mac": [sha], "arp.src.proto_ipv4": [spa],
                              "arp.dst.hw_mac": [tha], "arp.dst.proto_ipv4": [tpa]})
        node = Node("Address Resolution Protocol (%s)" % kind, offset, offset + 28)
        node.children = [
            Node("Hardware type: %s (%d)" % ("Ethernet" if htype == 1 else "Unknown", htype), offset, offset + 2),
            Node("Protocol type: %s (0x%04x)" % (ETHERTYPES.get(ptype, "Unknown"), ptype), offset + 2, offset + 4),
            Node("Hardware size: %d" % hlen, offset + 4, offset + 5),
            Node("Protocol size: %d" % plen, offset + 5, offset + 6),
            Node("Opcode: %s (%d)" % (kind, opcode), offset + 6, offset + 8),
            Node("Sender MAC address: %s" % mac_with_name(sha), offset + 8, offset + 14),
            Node("Sender IP address: %s" % spa, offset + 14, offset + 18),
            Node("Target MAC address: %s" % mac_with_name(tha), offset + 18, offset + 24),
            Node("Target IP address: %s" % tpa, offset + 24, offset + 28),
        ]
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
        ip_node = Node("Internet Protocol Version 4, Src: %s, Dst: %s" % (src, dst), offset, offset + ihl)
        ip_node.children = [
            Node("0100 .... = Version: 4", offset, offset + 1),
            Node(".... %s = Header Length: %d bytes (%d)" % (format(ihl // 4, "04b"), ihl, ihl // 4), offset, offset + 1),
            Node("Differentiated Services Field: 0x%02x (DSCP: %s, ECN: %s)" % (
                tos, "CS%d" % ((tos >> 2) // 8) if (tos >> 2) % 8 == 0 else "DSCP %d" % (tos >> 2), ["Not-ECT", "ECT(1)", "ECT(0)", "CE"][tos & 3]),
                offset + 1, offset + 2),
            Node("Total Length: %d" % total, offset + 2, offset + 4),
            Node("Identification: 0x%04x (%d)" % (ident, ident), offset + 4, offset + 6),
            Node("%s. .... = Flags: 0x%x%s" % (format(flags_value, "03b"), flags_value, ", Don't fragment" if flags_value & 2 else
                                                ", More fragments" if flags_value & 1 else ""), offset + 6, offset + 7, [
                Node(bitline(8, 0x80, flags_value << 5, "Reserved bit", "Set", "Not set"), offset + 6, offset + 7),
                Node(bitline(8, 0x40, flags_value << 5, "Don't fragment", "Set", "Not set"), offset + 6, offset + 7),
                Node(bitline(8, 0x20, flags_value << 5, "More fragments", "Set", "Not set"), offset + 6, offset + 7)]),
            Node("Fragment Offset: %d" % fragment, offset + 6, offset + 8),
            Node("Time to Live: %d" % ttl, offset + 8, offset + 9),
            Node("Protocol: %s (%d)" % (IP_PROTOCOLS.get(proto, "Unknown"), proto), offset + 9, offset + 10),
            Node("Header Checksum: 0x%04x [validation disabled]" % checksum, offset + 10, offset + 12,
                 [Node("[Header checksum status: Unverified]", offset + 10, offset + 12)]),
            Node("Source Address: %s" % src, offset + 12, offset + 16),
            Node("Destination Address: %s" % dst, offset + 16, offset + 20),
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
        payload_length, next_header, hop_limit = struct.unpack("!HBB", header[4:8])
        src, dst = ipv6_text(header[8:24]), ipv6_text(header[24:40])
        packet.protocols.append("ipv6")
        packet.source, packet.destination = src, dst
        packet.top = {6: "TCP", 17: "UDP", 58: "ICMPv6"}.get(next_header, "IPv6")
        packet.info = "IPv6 next header %d" % next_header
        packet.layers["ip"] = {"src": src, "dst": dst, "ttl": hop_limit, "protocol": next_header, "v6": True}
        packet.fields.update({"ipv6.src": [src], "ipv6.dst": [dst], "ipv6.addr": [src, dst], "ipv6.hlim": [hop_limit]})
        node = Node("Internet Protocol Version 6, Src: %s, Dst: %s" % (src, dst), offset, offset + 40)
        node.children = [Node("0110 .... = Version: 6", offset, offset + 1), Node("Payload Length: %d" % payload_length, offset + 4, offset + 6),
                         Node("Next Header: %s (%d)" % (IP_PROTOCOLS.get(next_header, "Unknown"), next_header), offset + 6, offset + 7),
                         Node("Hop Limit: %d" % hop_limit, offset + 7, offset + 8), Node("Source Address: %s" % src, offset + 8, offset + 24),
                         Node("Destination Address: %s" % dst, offset + 24, offset + 40)]
        nodes.append(node)
        end = min(len(data), offset + 40 + payload_length)
        if next_header == 58:
            packet.protocols.append("icmpv6")
            packet.top = "ICMPv6"
            icmp_type = data[offset + 40] if offset + 40 < end else 0
            names = {128: "Echo (ping) request", 129: "Echo (ping) reply", 133: "Router Solicitation", 134: "Router Advertisement",
                     135: "Neighbor Solicitation", 136: "Neighbor Advertisement"}
            packet.info = names.get(icmp_type, "ICMPv6 type %d" % icmp_type)
            packet.fields["icmpv6.type"] = [icmp_type]
            nodes.append(Node("Internet Control Message Protocol v6", offset + 40, end,
                              [Node("Type: %s (%d)" % (names.get(icmp_type, "Unknown"), icmp_type), offset + 40, offset + 41)]))
            return end
        return self._transport(packet, data, offset + 40, end, next_header, src, dst, nodes, v6=True)

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
        packet.fields.update({"icmp.type": [icmp_type], "icmp.code": [code]})
        node = Node("Internet Control Message Protocol", body, end)
        node.children = [Node("Type: %d (%s)" % (icmp_type, name), body, body + 1), Node("Code: %d" % code, body + 1, body + 2),
                         Node("Checksum: 0x%04x [unverified]" % checksum, body + 2, body + 4,
                              [Node("[Checksum Status: Unverified]", body + 2, body + 4)])]
        layer = {"type": icmp_type, "code": code}
        if icmp_type in (0, 8):
            ident, seq = struct.unpack("!HH", segment[4:8])
            ttl = packet.layers["ip"]["ttl"]
            ident_le, seq_le = _swap16(ident), _swap16(seq)
            gap = "  " if icmp_type == 8 else "    "              # Wireshark pads "request"/"reply" so the ids line up
            packet.info = "%s%sid=0x%04x, seq=%d/%d, ttl=%d" % (name, gap, ident, seq, seq_le, ttl)
            node.children += [Node("Identifier (BE): %d (0x%04x)" % (ident, ident), body + 4, body + 6),
                              Node("Identifier (LE): %d (0x%04x)" % (ident_le, ident_le), body + 4, body + 6),
                              Node("Sequence Number (BE): %d (0x%04x)" % (seq, seq), body + 6, body + 8),
                              Node("Sequence Number (LE): %d (0x%04x)" % (seq_le, seq_le), body + 6, body + 8)]
            if len(segment) > 8:
                node.children.append(Node("Data (%d bytes)" % (len(segment) - 8), body + 8, end,
                                          [Node("Data: " + segment[8:].hex(), body + 8, end), Node("[Length: %d]" % (len(segment) - 8), body + 8, end)]))
            layer.update(identifier=ident, sequence=seq)
            self._echo.setdefault((packet.layers["ip"]["src"] if icmp_type == 8 else packet.layers["ip"]["dst"],
                                   packet.layers["ip"]["dst"] if icmp_type == 8 else packet.layers["ip"]["src"], ident, seq), {})[icmp_type] = packet
        elif icmp_type == 3:
            packet.info = "Destination unreachable (%s)" % ICMP_UNREACHABLE.get(code, "code %d" % code)
        elif icmp_type == 11:
            packet.info = "Time-to-live exceeded (%s)" % ("Time to live exceeded in transit" if code == 0 else "Fragment reassembly time exceeded")
        else:
            packet.info = name
        packet.layers["icmp"] = layer
        nodes.append(node)
        return end

    def _link_echoes(self):
        for pair in self._echo.values():
            request, reply = pair.get(8), pair.get(0)
            if request and reply:
                request.info += " (reply in %d)" % reply.number
                reply.info += " (request in %d)" % request.number

    def _udp(self, packet, data, body, end, src, dst, nodes):
        header = data[body:body + 8]
        if len(header) < 8:
            packet.top, packet.info = "UDP", "Malformed UDP"
            return end
        sport, dport, length, checksum = struct.unpack("!HHHH", header)
        packet.protocols.append("udp")
        packet.top = "UDP"
        payload = data[body + 8:min(end, body + length)]
        packet.info = "%d → %d Len=%d" % (sport, dport, len(payload))
        packet.layers["udp"] = {"srcport": sport, "dstport": dport, "length": length, "payload": payload}
        packet.fields.update({"udp.srcport": [sport], "udp.dstport": [dport], "udp.port": [sport, dport], "udp.length": [length]})
        node = Node("User Datagram Protocol, Src Port: %d, Dst Port: %d" % (sport, dport), body, body + 8)
        node.children = [Node("Source Port: %d" % sport, body, body + 2), Node("Destination Port: %d" % dport, body + 2, body + 4),
                         Node("Length: %d" % length, body + 4, body + 6),
                         Node("Checksum: 0x%04x [unverified]" % checksum, body + 6, body + 8, [Node("[Checksum Status: Unverified]", body + 6, body + 8)]),
                         Node("[Stream index: 0]"), Node("UDP payload (%d bytes)" % len(payload), body + 8, body + 8 + len(payload))]
        nodes.append(node)
        if 53 in (sport, dport) or 5353 in (sport, dport):
            self._dns(packet, data, body + 8, body + 8 + len(payload), nodes, "MDNS" if 5353 in (sport, dport) else "DNS")
        elif {sport, dport} == {67, 68} or {sport, dport} == {68, 67}:
            packet.protocols.append("dhcp")
            packet.top, packet.info = "DHCP", "DHCP message"
        elif 1900 in (sport, dport):
            packet.protocols.append("ssdp")
            packet.top, packet.info = "SSDP", payload.split(b"\r\n", 1)[0].decode("latin-1", "replace") + " "
        elif 123 in (sport, dport):
            packet.protocols.append("ntp")
            packet.top, packet.info = "NTP", "NTP"
        elif 443 in (sport, dport):
            packet.protocols.append("quic")
            packet.top, packet.info = "QUIC", "QUIC (%d bytes)" % len(payload)
        return min(end, body + max(length, 8))

    def _dns(self, packet, data, start, end, nodes, name):
        message = data[start:end]
        if len(message) < 12:
            return
        ident, flags, qd, an, ns, ar = struct.unpack("!HHHHHH", message[:12])
        response = bool(flags & 0x8000)
        position = 12
        questions, answers = [], []
        try:
            for _ in range(qd):
                qname, position = _dns_name(message, position)
                qtype, qclass = struct.unpack("!HH", message[position:position + 4])
                position += 4
                questions.append((qname, qtype))
            for _ in range(an):
                aname, position = _dns_name(message, position)
                atype, _aclass, ttl, rdlength = struct.unpack("!HHIH", message[position:position + 10])
                position += 10
                rdata = message[position:position + rdlength]
                position += rdlength
                answers.append((aname, atype, ttl, rdata, message))
        except (struct.error, IndexError, ValueError):
            pass
        types = {1: "A", 2: "NS", 5: "CNAME", 12: "PTR", 15: "MX", 16: "TXT", 28: "AAAA"}
        packet.protocols.append("dns")
        packet.top = name
        qtext = " ".join("%s %s" % (types.get(t, t), n) for n, t in questions)
        if response:
            rendered = []
            for aname, atype, _ttl, rdata, whole in answers:
                value = ipv4_text(rdata) if atype == 1 and len(rdata) == 4 else ipv6_text(rdata) if atype == 28 and len(rdata) == 16 else \
                    (_dns_name(whole, whole.find(rdata))[0] if atype in (2, 5, 12) and rdata else "")
                rendered.append("%s %s" % (types.get(atype, atype), value))
            packet.info = "Standard query response 0x%04x %s %s" % (ident, qtext, " ".join(rendered)) if rendered else \
                "Standard query response 0x%04x %s" % (ident, qtext)
        else:
            packet.info = "Standard query 0x%04x %s" % (ident, qtext)
        packet.layers["dns"] = {"id": ident, "response": response, "questions": questions, "answers": [(n, t, ipv4_text(r) if t == 1 and len(r) == 4 else "") for n, t, _l, r, _w in answers]}
        packet.fields.update({"dns.id": [ident], "dns.flags.response": [int(response)], "dns.qry.name": [n for n, _ in questions],
                              "dns.qry.type": [t for _, t in questions], "dns.a": [ipv4_text(r) for _n, t, _l, r, _w in answers if t == 1 and len(r) == 4]})
        node = Node("Domain Name System (%s)" % ("response" if response else "query"), start, end)
        node.children = [Node("Transaction ID: 0x%04x" % ident, start, start + 2), Node("Flags: 0x%04x" % flags, start + 2, start + 4),
                         Node("Questions: %d" % qd, start + 4, start + 6), Node("Answer RRs: %d" % an, start + 6, start + 8),
                         Node("Authority RRs: %d" % ns, start + 8, start + 10), Node("Additional RRs: %d" % ar, start + 10, start + 12)]
        if questions:
            node.children.append(Node("Queries", start + 12, start + 12, [Node("%s: type %s, class IN" % (n, types.get(t, t))) for n, t in questions]))
        if answers:
            node.children.append(Node("Answers", start, end, [Node("%s: type %s, class IN, addr %s" % (n, types.get(t, t), ipv4_text(r)) if t == 1 and len(r) == 4
                                                                 else "%s: type %s, class IN" % (n, types.get(t, t))) for n, t, _l, r, _w in answers]))
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
            sport, dport, rel_seq, ", Ack: %d" % rel_ack if flags & 0x10 else "", len(payload)), body, body + header_length)
        tcp_node.children = [
            Node("Source Port: %d" % sport, body, body + 2), Node("Destination Port: %d" % dport, body + 2, body + 4),
            Node("[Stream index: %d]" % stream.index), Node("[TCP Segment Len: %d]" % len(payload), body + 12, body + 13),
            Node("Sequence Number: %d    (relative sequence number)" % rel_seq, body + 4, body + 8),
            Node("Sequence Number (raw): %d" % seq, body + 4, body + 8),
            Node("[Next Sequence Number: %d    (relative sequence number)]" % (rel_seq + len(payload) + (1 if flags & 3 else 0))),
        ]
        if flags & 0x10:
            tcp_node.children += [Node("Acknowledgment Number: %d    (relative ack number)" % rel_ack, body + 8, body + 12),
                                  Node("Acknowledgment number (raw): %d" % ack, body + 8, body + 12)]
        tcp_node.children += [
            Node("%s .... = Header Length: %d bytes (%d)" % (format(header_length // 4, "04b"), header_length, header_length // 4), body + 12, body + 13),
            Node("Flags: 0x%03x (%s)" % (flags, flag_text), body + 12, body + 14, [
                Node(bitline(12, 0x800 | 0x400 | 0x200, flags, "Reserved", "Set", "Not set"), body + 12, body + 13),
                Node(bitline(12, 0x100, flags, "Accurate ECN", "Set", "Not set"), body + 12, body + 13),
                Node(bitline(12, 0x080, flags, "Congestion Window Reduced", "Set", "Not set"), body + 13, body + 14),
                Node(bitline(12, 0x040, flags, "ECN-Echo", "Set", "Not set"), body + 13, body + 14),
                Node(bitline(12, 0x020, flags, "Urgent", "Set", "Not set"), body + 13, body + 14),
                Node(bitline(12, 0x010, flags, "Acknowledgment", "Set", "Not set"), body + 13, body + 14),
                Node(bitline(12, 0x008, flags, "Push", "Set", "Not set"), body + 13, body + 14),
                Node(bitline(12, 0x004, flags, "Reset", "Set", "Not set"), body + 13, body + 14),
                Node(bitline(12, 0x002, flags, "Syn", "Set", "Not set"), body + 13, body + 14),
                Node(bitline(12, 0x001, flags, "Fin", "Set", "Not set"), body + 13, body + 14)]),
            Node("Window: %d" % window, body + 14, body + 16),
            Node("[Calculated window size: %d]" % scaled),
            Node("[Window size scaling factor: %s]" % (str(1 << scaling) if scaling is not None else "-1 (unknown)" if len(stream.wscale) < 2 else "-2 (no window scaling used)")),
            Node("Checksum: 0x%04x [unverified]" % checksum, body + 16, body + 18, [Node("[Checksum Status: Unverified]", body + 16, body + 18)]),
            Node("Urgent Pointer: %d" % urgent, body + 18, body + 20),
        ]
        if header_length > 20:
            tcp_node.children.append(Node("Options: (%d bytes), %s" % (header_length - 20, ", ".join(options) or "End of Option List (EOL)"),
                                          body + 20, body + header_length))
        nodes.append(tcp_node)
        if payload:
            tcp_node.children.append(Node("TCP payload (%d bytes)" % len(payload), body + header_length, end))
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
            nodes.append(Node("Transport Layer Security", start, end, [Node("%s Record Layer: %s Protocol" % (version, TLS_RECORDS[payload[0]]), start, end)]))
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
        for line in lines:
            length = len(line) + 2
            children.append(Node(line + "\\r\\n", position, min(end, position + length)))
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
            children.append(Node("[Full request URI: http://%s%s]" % (host, uri)))
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
        node = Node("Hypertext Transfer Protocol", start, end, children)
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
                form = Node("HTML Form URL Encoded: application/x-www-form-urlencoded", body_start, end)
                cursor = body_start
                for pair, (key, value) in zip(text.split("&"), items):
                    form.children.append(Node('Form item: "%s" = "%s"' % (key, value), cursor, cursor + len(pair),
                                              [Node("Key: %s" % key, cursor, cursor + len(key)), Node("Value: %s" % value, cursor + len(key) + 1, cursor + len(pair))]))
                    cursor += len(pair) + 1
                nodes.append(form)
            elif "text" in content_type or "html" in content_type:
                lines_in_body = body.decode("latin-1").count("\n") + 1
                nodes.append(Node("Line-based text data: %s (%d lines)" % (content_type.split(";")[0] or "text/plain", lines_in_body), body_start, end,
                                  [Node(printable_line(line) , body_start, end) for line in body.decode("latin-1").splitlines()[:40]]))
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
