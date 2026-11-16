"""Reader and writer for packet capture files: classic pcap (both byte orders, micro- and nanosecond) and pcapng.

Only the bytes are handled here. Decoding them into protocols is dissect.py.
"""
import struct
from dataclasses import dataclass


class CaptureError(ValueError):
    """The file is not a capture this reader can use."""


MAX_PACKETS = 20000
LINKTYPE_ETHERNET = 1

PCAP_MAGICS = {
    b"\xd4\xc3\xb2\xa1": ("<", 1e-6),
    b"\xa1\xb2\xc3\xd4": (">", 1e-6),
    b"\x4d\x3c\xb2\xa1": ("<", 1e-9),
    b"\xa1\xb2\x3c\x4d": (">", 1e-9),
}
PCAPNG_MAGIC = b"\x0a\x0d\x0d\x0a"


@dataclass
class RawFrame:
    number: int
    timestamp: float          # seconds since the epoch
    data: bytes               # the captured bytes
    original_length: int      # length on the wire (can exceed len(data) when a snap length cut the frame)


@dataclass
class Capture:
    frames: list
    linktype: int
    format: str               # "pcap" or "pcapng"


def looks_like_capture(head):
    return head[:4] in PCAP_MAGICS or head[:4] == PCAPNG_MAGIC


def read_capture(data, limit=MAX_PACKETS):
    """Frames of a capture file's bytes. Raises CaptureError for anything that is not a usable Ethernet capture."""
    data = bytes(data)
    if len(data) < 24:
        raise CaptureError("This file is too small to be a packet capture.")
    if data[:4] in PCAP_MAGICS:
        capture = _read_pcap(data, limit)
    elif data[:4] == PCAPNG_MAGIC:
        capture = _read_pcapng(data, limit)
    else:
        raise CaptureError("This is not a .pcap or .pcapng file. Save the capture from Wireshark with File > Save As.")
    if capture.linktype != LINKTYPE_ETHERNET:
        raise CaptureError("Only Ethernet captures are supported (this one uses link type %d). In Wireshark, capture on the "
                           "Ethernet or Wi-Fi interface of your computer." % capture.linktype)
    if not capture.frames:
        raise CaptureError("The capture holds no packets.")
    return capture


def _read_pcap(data, limit):
    order, resolution = PCAP_MAGICS[data[:4]]
    major, minor, _zone, _sigfigs, _snaplen, linktype = struct.unpack(order + "HHiIII", data[4:24])
    if major != 2:
        raise CaptureError("Unsupported pcap version %d.%d." % (major, minor))
    linktype &= 0x0FFFFFFF
    frames, position = [], 24
    while position + 16 <= len(data):
        seconds, fraction, caplen, origlen = struct.unpack(order + "IIII", data[position:position + 16])
        position += 16
        if caplen > 262144 or position + caplen > len(data):
            break                                       # a capture cut short by a crash or a copy: keep what is whole
        frames.append(RawFrame(len(frames) + 1, seconds + fraction * resolution, data[position:position + caplen], origlen))
        position += caplen
        if len(frames) >= limit:
            break
    return Capture(frames, linktype, "pcap")


def _read_pcapng(data, limit):
    order = "<"
    interfaces = []                                    # (linktype, seconds per tick)
    frames, position = [], 0
    while position + 12 <= len(data):
        block_type = data[position:position + 4]
        if block_type == PCAPNG_MAGIC:                 # a section header fixes the byte order of everything after it
            marker = data[position + 8:position + 12]
            if marker == b"\x4d\x3c\x2b\x1a":
                order = "<"
            elif marker == b"\x1a\x2b\x3c\x4d":
                order = ">"
            else:
                raise CaptureError("The pcapng file has a damaged header.")
            interfaces = []
        (kind,) = struct.unpack(order + "I", block_type)
        (length,) = struct.unpack(order + "I", data[position + 4:position + 8])
        if length < 12 or length % 4 or position + length > len(data):
            break
        body = data[position + 8:position + length - 4]
        if kind == 1 and len(body) >= 8:               # interface description block
            linktype = struct.unpack(order + "H", body[:2])[0]
            interfaces.append((linktype, _tick(body[8:], order)))
        elif kind == 6 and len(body) >= 20:            # enhanced packet block
            index, high, low, caplen, origlen = struct.unpack(order + "IIIII", body[:20])
            if index >= len(interfaces):
                raise CaptureError("The pcapng file refers to an unknown interface.")
            tick = interfaces[index][1]
            frames.append(RawFrame(len(frames) + 1, ((high << 32) | low) * tick, body[20:20 + caplen], origlen))
            if len(frames) >= limit:
                break
        elif kind == 3 and interfaces and len(body) >= 4:   # simple packet block: no timestamp
            (origlen,) = struct.unpack(order + "I", body[:4])
            frames.append(RawFrame(len(frames) + 1, 0.0, body[4:4 + origlen], origlen))
        position += length
    linktypes = {linktype for linktype, _ in interfaces}
    if len(linktypes) > 1:
        raise CaptureError("The capture mixes several interface types; capture on one interface.")
    return Capture(frames, linktypes.pop() if linktypes else 0, "pcapng")


def _tick(options, order):
    """Seconds per timestamp unit, from the if_tsresol option (default: microseconds)."""
    position = 0
    while position + 4 <= len(options):
        code, length = struct.unpack(order + "HH", options[position:position + 4])
        if code == 0:
            break
        if code == 9 and length >= 1:
            value = options[position + 4]
            return 2.0 ** -(value & 0x7F) if value & 0x80 else 10.0 ** -value
        position += 4 + (length + 3) // 4 * 4
    return 1e-6


def write_pcap(frames, linktype=LINKTYPE_ETHERNET):
    """Classic little-endian microsecond pcap bytes from (timestamp, frame_bytes) pairs."""
    out = [struct.pack("<IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 262144, linktype)]
    for timestamp, payload in frames:
        seconds = int(timestamp)
        micro = int(round((timestamp - seconds) * 1_000_000))
        if micro >= 1_000_000:
            seconds, micro = seconds + 1, micro - 1_000_000
        out.append(struct.pack("<IIII", seconds, micro, len(payload), len(payload)))
        out.append(payload)
    return b"".join(out)
