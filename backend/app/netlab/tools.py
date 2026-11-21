"""Edit > Find Packet and File > Export of the packet analyser, working on the dissected packets."""
import csv
import io
import re

from .dfilter import FilterError, compile_filter
from .pcap import write_pcap, write_pcapng

FIND_MODES = ("filter", "hex", "string", "regex")
FIND_SCOPES = ("list", "details", "bytes")


class FindError(ValueError):
    pass


def _hex_needle(text):
    cleaned = re.sub(r"[\s:.\-]", "", text)
    if not cleaned or len(cleaned) % 2 or not re.fullmatch(r"[0-9A-Fa-f]+", cleaned):
        raise FindError('"%s" is not a valid hex value. Use pairs of hex digits such as 00:1b:21 or 0800.' % text)
    return bytes.fromhex(cleaned)


def _row_text(packet):
    row = packet.row()
    return " ".join(str(row[key]) for key in ("no", "time", "source", "destination", "protocol", "length", "info"))


def _walk(nodes, path=()):
    for index, node in enumerate(nodes):
        here = path + (index,)
        yield here, node
        yield from _walk(node.children, here)


def find_packet(session, mode, scope, query, after=0, backward=False, case_sensitive=False, numbers=None):
    """The next packet (after packet `after`, wrapping round) that matches. Returns {"number", "path", "range"} or None.

    mode "filter" uses a display filter; "hex", "string" and "regex" search the packet list text, the details lines or the
    raw bytes depending on scope, as Wireshark's Find Packet bar does."""
    if mode not in FIND_MODES:
        raise FindError("Unknown search type.")
    if scope not in FIND_SCOPES:
        raise FindError("Unknown search area.")
    query = query or ""
    if not query.strip():
        raise FindError("Enter something to search for.")
    candidates = session.packets if numbers is None else [session.packets[n - 1] for n in numbers if 1 <= n <= len(session.packets)]
    if not candidates:
        return None
    position = next((i for i, p in enumerate(candidates) if p.number == after), -1)
    if backward:
        order = candidates[:position][::-1] + candidates[position:][::-1] if position >= 0 else candidates[::-1]
    else:
        order = candidates[position + 1:] + candidates[:position + 1]

    if mode == "filter":
        try:
            predicate = compile_filter(query)
        except FilterError as error:
            raise FindError(str(error))
        hit = next((packet for packet in order if predicate(packet)), None)
        return {"number": hit.number, "path": None, "range": None} if hit else None

    flags = 0 if case_sensitive else re.I
    if mode == "hex":
        needle = _hex_needle(query)
        if scope != "bytes":
            text_needle = needle.hex()
            matcher = lambda text: text_needle in text.replace(":", "").replace(" ", "").lower()
        else:
            matcher = None
    elif mode == "regex":
        try:
            pattern = re.compile(query, flags)
        except re.error as error:
            raise FindError('"%s" is not a valid regular expression: %s.' % (query, error))
        matcher = lambda text: bool(pattern.search(text))
    else:
        wanted = query if case_sensitive else query.lower()
        matcher = lambda text: wanted in (text if case_sensitive else text.lower())

    for packet in order:
        if scope == "list":
            if matcher(_row_text(packet)):
                return {"number": packet.number, "path": None, "range": None}
        elif scope == "details":
            for path, node in _walk(packet.tree):
                if matcher(node.label):
                    return {"number": packet.number, "path": ".".join(str(i) for i in path),
                            "range": [node.start, node.end] if node.end > node.start else None}
        else:
            data = packet.data
            if mode == "hex":
                at = data.find(needle)
                if at >= 0:
                    return {"number": packet.number, "path": None, "range": [at, at + len(needle)]}
            elif mode == "regex":
                found = pattern.search(data.decode("latin-1"))
                if found:
                    return {"number": packet.number, "path": None, "range": [found.start(), found.end()]}
            else:
                haystack = data if case_sensitive else data.lower()
                needle_bytes = (query if case_sensitive else query.lower()).encode("latin-1", "replace")
                at = haystack.find(needle_bytes)
                if at >= 0:
                    return {"number": packet.number, "path": None, "range": [at, at + len(needle_bytes)]}
    return None


# --------------------------------------------------------------------------------------------- export
def _chosen(session, numbers):
    if numbers is None:
        return list(session.packets)
    wanted = set(numbers)
    return [packet for packet in session.packets if packet.number in wanted]


def export_capture(session, numbers=None, fmt="pcapng"):
    """File > Save As / Export Specified Packets: the chosen packets' original bytes in a new capture file."""
    frames = [(packet.epoch, packet.data, packet.original_length) for packet in _chosen(session, numbers)]
    if fmt == "pcap":
        return write_pcap(frames)
    if fmt == "pcapng":
        return write_pcapng(frames)
    raise ValueError("Unknown capture format.")


SUMMARY_HEADER = "No.     Time           Source                Destination           Protocol Length Info"


def _summary_line(packet):
    row = packet.row()
    return "%7d %-14.6f %-21s %-21s %-8s %-6d %s" % (row["no"], row["time"], row["source"], row["destination"], row["protocol"],
                                                     row["length"], row["info"])


def _tree_lines(nodes, depth=0):
    for node in nodes:
        yield "    " * depth + node.label
        yield from _tree_lines(node.children, depth + 1)


def _hex_dump(data):
    for offset in range(0, len(data), 16):
        chunk = data[offset:offset + 16]
        hex_part = " ".join("%02x" % b for b in chunk[:8]) + ("  " if len(chunk) > 8 else "") + " ".join("%02x" % b for b in chunk[8:])
        yield "%04x  %-49s %s" % (offset, hex_part, "".join(chr(b) if 32 <= b < 127 else "." for b in chunk))


def export_text(session, numbers=None, details=True, include_bytes=False):
    """File > Export Packet Dissections > As Plain Text: summary line, the expanded details and optionally the bytes."""
    out = []
    for packet in _chosen(session, numbers):
        out.append(SUMMARY_HEADER)
        out.append(_summary_line(packet))
        if details:
            out.append("")
            out.extend(_tree_lines(packet.tree))
        if include_bytes:
            out.append("")
            out.extend(_hex_dump(packet.data))
        out.append("")
    return "\n".join(out) + "\n"


def export_csv(session, numbers=None):
    """File > Export Packet Dissections > As CSV: the packet list columns."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, quoting=csv.QUOTE_ALL, lineterminator="\n")
    writer.writerow(["No.", "Time", "Source", "Destination", "Protocol", "Length", "Info"])
    for packet in _chosen(session, numbers):
        row = packet.row()
        writer.writerow([row["no"], "%.6f" % row["time"], row["source"], row["destination"], row["protocol"], row["length"], row["info"]])
    return buffer.getvalue()
