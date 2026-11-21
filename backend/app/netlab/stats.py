"""Statistics menu of the packet analyser, computed from the dissected packets: Capture File Properties, Protocol Hierarchy,
Conversations and Endpoints. Every number is counted from the capture; the layouts follow Wireshark's dialogs.

`numbers` is the list of packet numbers to count (the packets the display filter shows); None counts every packet.
"""
import time as _time

# Full protocol names as Wireshark's Protocol Hierarchy shows them. ethertype is a dissector step, not a protocol layer.
PROTOCOL_NAMES = {
    "frame": "Frame", "eth": "Ethernet", "arp": "Address Resolution Protocol", "ip": "Internet Protocol Version 4",
    "ipv6": "Internet Protocol Version 6", "icmp": "Internet Control Message Protocol", "icmpv6": "Internet Control Message Protocol v6",
    "tcp": "Transmission Control Protocol", "udp": "User Datagram Protocol", "dns": "Domain Name System", "mdns": "Multicast Domain Name System",
    "dhcp": "Dynamic Host Configuration Protocol", "http": "Hypertext Transfer Protocol", "urlencoded-form": "HTML Form URL Encoded",
    "data-text-lines": "Line-based text data", "tls": "Transport Layer Security", "ssdp": "Simple Service Discovery Protocol",
    "ntp": "Network Time Protocol", "quic": "QUIC IETF", "data": "Data",
}
CONVERSATION_KINDS = ("eth", "ipv4", "ipv6", "tcp", "udp")
KIND_TITLES = {"eth": "Ethernet", "ipv4": "IPv4", "ipv6": "IPv6", "tcp": "TCP", "udp": "UDP"}


def _selected(session, numbers):
    if numbers is None:
        return list(session.packets)
    wanted = set(numbers)
    return [packet for packet in session.packets if packet.number in wanted]


def _span(packets):
    if len(packets) < 2:
        return 0.0
    return max(p.epoch for p in packets) - min(p.epoch for p in packets)


def _layer_starts(packet):
    """Byte offset where each protocol layer starts, from the details tree."""
    starts = {"frame": 0, "eth": 0}
    for node in packet.tree:
        if node.abbrev and node.abbrev not in starts:
            starts[node.abbrev] = node.start
    return starts


def protocol_hierarchy(session, numbers=None):
    """The Protocol Hierarchy Statistics tree: one row per protocol path, with packets, bytes and end packets/bytes."""
    packets = _selected(session, numbers)
    total_packets = len(packets) or 1
    total_bytes = sum(p.length for p in packets) or 1
    seconds = _span(packets)
    root = {"children": {}}
    for packet in packets:
        path = [name for name in packet.protocols if name != "ethertype"]
        starts = _layer_starts(packet)
        cursor, previous = root, 0
        for depth, name in enumerate(path):
            start = starts.get(name, previous)
            previous = start
            node = cursor["children"].setdefault(name, {"name": name, "packets": 0, "bytes": 0, "end_packets": 0, "end_bytes": 0, "children": {}})
            layer_bytes = max(0, packet.length - start)
            node["packets"] += 1
            node["bytes"] += layer_bytes
            if depth == len(path) - 1:
                node["end_packets"] += 1
                node["end_bytes"] += layer_bytes
            cursor = node

    def rows(node, depth):
        out = []
        for child in sorted(node["children"].values(), key=lambda item: -item["packets"]):
            out.append({"protocol": PROTOCOL_NAMES.get(child["name"], child["name"]), "abbrev": child["name"], "depth": depth,
                        "percent_packets": round(100.0 * child["packets"] / total_packets, 1), "packets": child["packets"],
                        "percent_bytes": round(100.0 * child["bytes"] / total_bytes, 1), "bytes": child["bytes"],
                        "bits_per_second": round(child["bytes"] * 8 / seconds) if seconds else None,
                        "end_packets": child["end_packets"], "end_bytes": child["end_bytes"],
                        "end_bits_per_second": round(child["end_bytes"] * 8 / seconds) if seconds else None})
            out.extend(rows(child, depth + 1))
        return out

    return {"packets": len(packets), "rows": rows(root, 0)}


def _endpoints_of(packet, kind):
    """(source, destination) endpoint keys of one packet for a conversation kind, or None when the packet has no such layer."""
    if kind == "eth" and "eth" in packet.layers:
        return (packet.layers["eth"]["src"], None), (packet.layers["eth"]["dst"], None)
    ip = packet.layers.get("ip")
    if kind in ("ipv4", "ipv6") and ip and bool(ip.get("v6")) == (kind == "ipv6"):
        return (ip["src"], None), (ip["dst"], None)
    if kind in ("tcp", "udp") and ip and kind in packet.layers:
        layer = packet.layers[kind]
        return (ip["src"], layer["srcport"]), (ip["dst"], layer["dstport"])
    return None


def conversations(session, kind, numbers=None):
    if kind not in CONVERSATION_KINDS:
        raise ValueError("Unknown conversation type.")
    packets = _selected(session, numbers)
    first_epoch = session.packets[0].epoch if session.packets else 0.0
    table = {}
    for packet in packets:
        ends = _endpoints_of(packet, kind)
        if ends is None:
            continue
        source, destination = ends
        key = tuple(sorted([source, destination], key=lambda item: (str(item[0]), item[1] or 0)))
        row = table.get(key)
        if row is None:
            row = table[key] = {"a": source, "b": destination, "packets": 0, "bytes": 0, "packets_ab": 0, "bytes_ab": 0, "packets_ba": 0,
                                "bytes_ba": 0, "start": packet.epoch, "end": packet.epoch,
                                "stream": packet.layers[kind]["stream"] if kind in ("tcp", "udp") else None}
        row["packets"] += 1
        row["bytes"] += packet.original_length
        if source == row["a"]:
            row["packets_ab"] += 1
            row["bytes_ab"] += packet.original_length
        else:
            row["packets_ba"] += 1
            row["bytes_ba"] += packet.original_length
        row["end"] = max(row["end"], packet.epoch)
    out = []
    for row in table.values():
        duration = row["end"] - row["start"]
        out.append({"address_a": row["a"][0], "port_a": row["a"][1], "address_b": row["b"][0], "port_b": row["b"][1],
                    "packets": row["packets"], "bytes": row["bytes"], "stream": row["stream"],
                    "packets_ab": row["packets_ab"], "bytes_ab": row["bytes_ab"], "packets_ba": row["packets_ba"], "bytes_ba": row["bytes_ba"],
                    "rel_start": round(row["start"] - first_epoch, 6), "duration": round(duration, 6),
                    "bits_per_second_ab": round(row["bytes_ab"] * 8 / duration) if duration > 0 else None,
                    "bits_per_second_ba": round(row["bytes_ba"] * 8 / duration) if duration > 0 else None})
    out.sort(key=lambda item: (item["rel_start"], -item["packets"]))
    return {"kind": kind, "title": KIND_TITLES[kind], "rows": out}


def endpoints(session, kind, numbers=None):
    if kind not in CONVERSATION_KINDS:
        raise ValueError("Unknown endpoint type.")
    packets = _selected(session, numbers)
    table = {}
    for packet in packets:
        ends = _endpoints_of(packet, kind)
        if ends is None:
            continue
        source, destination = ends
        for endpoint, sent in ((source, True), (destination, False)):
            row = table.setdefault(endpoint, {"packets": 0, "bytes": 0, "tx_packets": 0, "tx_bytes": 0, "rx_packets": 0, "rx_bytes": 0})
            row["packets"] += 1
            row["bytes"] += packet.original_length
            row["tx_packets" if sent else "rx_packets"] += 1
            row["tx_bytes" if sent else "rx_bytes"] += packet.original_length
    out = [{"address": key[0], "port": key[1], **value} for key, value in table.items()]
    out.sort(key=lambda item: -item["packets"])
    return {"kind": kind, "title": KIND_TITLES[kind], "rows": out}


def _clock(epoch):
    return _time.strftime("%Y-%m-%d %H:%M:%S", _time.gmtime(epoch)) + ("%.6f" % (epoch - int(epoch)))[1:]


def _elapsed(seconds):
    whole = int(seconds)
    return "%02d:%02d:%02d" % (whole // 3600, whole // 60 % 60, whole % 60)


def _measure(packets):
    span = _span(packets)
    count = len(packets)
    size = sum(p.original_length for p in packets)
    return {"packets": count, "time_span": round(span, 3), "average_pps": round(count / span, 1) if span else None,
            "average_packet_size": round(size / count) if count else 0, "bytes": size,
            "average_bytes_per_second": round(size / span) if span else None, "average_bits_per_second": round(size * 8 / span) if span else None}


def capture_properties(session, meta, numbers=None, marked=0):
    """Statistics > Capture File Properties."""
    packets = session.packets
    shown = _selected(session, numbers)
    first, last = (packets[0].epoch, packets[-1].epoch) if packets else (0.0, 0.0)
    fmt = meta.get("format", "pcap")
    return {
        "file": {"name": meta.get("name", ""), "length": meta.get("length", 0), "sha256": meta.get("sha256", ""),
                 "format": "Wireshark/... - pcapng" if fmt == "pcapng" else "Wireshark/tcpdump/... - pcap", "encapsulation": "Ethernet",
                 "source": meta.get("source_note", "")},
        "time": {"first_packet": _clock(first) if packets else "", "last_packet": _clock(last) if packets else "",
                 "elapsed": _elapsed(max(0.0, last - first))},
        "captured": _measure(packets), "displayed": _measure(shown),
        "displayed_percent": round(100.0 * len(shown) / len(packets), 1) if packets else 0.0,
        "marked": marked,
    }
