"""Wireshark display filters: protocol names, fields, comparisons, contains, and/or/not.

compile_filter("http.request.method == \"POST\" and ip.addr == 10.0.0.0/8") returns a function packet -> bool.
Errors are FilterError with Wireshark's wording, so the studio can show them the way Wireshark does.
"""
import ipaddress
import re

from .dissect import Dissected


class FilterError(ValueError):
    pass


PROTOCOLS = {"frame", "eth", "ethertype", "ip", "ipv6", "tcp", "udp", "icmp", "icmpv6", "arp", "dns", "mdns", "http", "tls", "ssdp", "dhcp",
             "ntp", "quic", "urlencoded-form", "data-text-lines"}
FIELDS = {
    "frame.number", "frame.len", "frame.cap_len", "frame.time_relative",
    "eth.dst", "eth.src", "eth.addr", "eth.type", "eth.ig", "eth.lg", "eth.padding",
    "arp.opcode", "arp.hw.type", "arp.proto.type", "arp.hw.size", "arp.proto.size", "arp.src.hw_mac", "arp.src.proto_ipv4",
    "arp.dst.hw_mac", "arp.dst.proto_ipv4",
    "ip.version", "ip.src", "ip.dst", "ip.addr", "ip.ttl", "ip.proto", "ip.len", "ip.id", "ip.hdr_len", "ip.flags.df", "ip.flags.mf", "ip.frag_offset",
    "ipv6.src", "ipv6.dst", "ipv6.addr", "ipv6.hlim",
    "icmp.type", "icmp.code", "icmpv6.type",
    "udp.srcport", "udp.dstport", "udp.port", "udp.length",
    "tcp.srcport", "tcp.dstport", "tcp.port", "tcp.seq", "tcp.ack", "tcp.flags", "tcp.flags.fin", "tcp.flags.syn", "tcp.flags.reset",
    "tcp.flags.push", "tcp.flags.ack", "tcp.flags.urg", "tcp.len", "tcp.stream", "tcp.window_size", "tcp.hdr_len",
    "dns.id", "dns.flags.response", "dns.qry.name", "dns.qry.type", "dns.a",
    "http.request", "http.response", "http.request.method", "http.request.uri", "http.host", "http.user_agent", "http.response.code",
    "http.content_type", "http.file_data", "urlencoded-form.key", "urlencoded-form.value",
}
BOOLEAN_FIELDS = {"tcp.flags.fin", "tcp.flags.syn", "tcp.flags.reset", "tcp.flags.push", "tcp.flags.ack", "tcp.flags.urg", "ip.flags.df",
                  "ip.flags.mf", "eth.ig", "eth.lg", "dns.flags.response", "http.request", "http.response"}
WORD_OPERATORS = {"eq": "==", "ne": "!=", "gt": ">", "lt": "<", "ge": ">=", "le": "<=", "and": "and", "or": "or", "not": "not",
                  "contains": "contains", "in": "in"}
TOKEN = re.compile(r"""\s*(?:
    (?P<string>"(?:[^"\\]|\\.)*")
  | (?P<mac>[0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5})
  | (?P<ip>\d{1,3}(?:\.\d{1,3}){3}(?:/\d{1,2})?)
  | (?P<number>0[xX][0-9A-Fa-f]+|\d+)
  | (?P<op>==|!=|>=|<=|&&|\|\||>|<|&|!|\(|\)|\{|\}|,)
  | (?P<word>[A-Za-z_][A-Za-z0-9_.\-]*)
)""", re.X)


def tokenize(text):
    position, tokens = 0, []
    text = text.rstrip()
    while position < len(text):
        match = TOKEN.match(text, position)
        if not match or match.end() == position:
            raise FilterError('"%s" was unexpected in this context.' % text[position:].strip()[:20])
        position = match.end()
        kind = match.lastgroup
        value = match.group(kind)
        if kind == "word" and value.lower() in WORD_OPERATORS:
            tokens.append(("op", WORD_OPERATORS[value.lower()]))
        elif kind == "op":
            tokens.append(("op", {"&&": "and", "||": "or", "!": "not"}.get(value, value)))
        elif kind == "string":
            tokens.append(("string", bytes(value[1:-1], "utf-8").decode("unicode_escape")))
        elif kind == "number":
            tokens.append(("number", int(value, 16) if value.lower().startswith("0x") else int(value)))
        else:
            tokens.append((kind, value))
    return tokens


class _Parser:
    def __init__(self, tokens):
        self.tokens, self.index = tokens, 0

    def peek(self):
        return self.tokens[self.index] if self.index < len(self.tokens) else (None, None)

    def take(self):
        token = self.peek()
        self.index += 1
        return token

    def parse(self):
        node = self.or_expression()
        if self.index != len(self.tokens):
            raise FilterError('"%s" was unexpected in this context.' % self.peek()[1])
        return node

    def or_expression(self):
        left = self.and_expression()
        while self.peek() == ("op", "or"):
            self.take()
            right = self.and_expression()
            left = (lambda a, b: lambda packet: a(packet) or b(packet))(left, right)
        return left

    def and_expression(self):
        left = self.not_expression()
        while self.peek() == ("op", "and"):
            self.take()
            right = self.not_expression()
            left = (lambda a, b: lambda packet: a(packet) and b(packet))(left, right)
        return left

    def not_expression(self):
        if self.peek() == ("op", "not"):
            self.take()
            inner = self.not_expression()
            return lambda packet: not inner(packet)
        return self.primary()

    def primary(self):
        kind, value = self.take()
        if kind is None:
            raise FilterError("Unexpected end of filter expression.")
        if (kind, value) == ("op", "("):
            node = self.or_expression()
            if self.take() != ("op", ")"):
                raise FilterError('Expected ")" to close the parenthesis.')
            return node
        if kind != "word":
            raise FilterError('"%s" was unexpected in this context.' % value)
        name = value.lower() if value.lower() in PROTOCOLS else value
        if name not in PROTOCOLS and name not in FIELDS:
            raise FilterError('"%s" is neither a field nor a protocol name.' % value)
        operator = self.peek()
        if operator[0] == "op" and operator[1] in {"==", "!=", ">", "<", ">=", "<=", "contains"}:
            self.take()
            literal = self.literal()
            return _comparison(name, operator[1], literal)
        if operator == ("op", "in"):
            self.take()
            members = self.members()
            return lambda packet: any(_comparison(name, "==", member)(packet) for member in members)
        if operator == ("op", "&"):
            self.take()
            mask = self.take()
            if mask[0] != "number":
                raise FilterError("A bit mask must be a number.")
            return lambda packet: any((v & mask[1]) for v in _values(packet, name) if isinstance(v, int))
        return _exists(name)

    def literal(self):
        kind, value = self.take()
        if kind in {"string", "number", "ip", "mac"}:
            return (kind, value)
        if kind == "word" and value.lower() in {"true", "false"}:
            return ("number", 1 if value.lower() == "true" else 0)
        raise FilterError('"%s" cannot be used as a value here.' % (value,))

    def members(self):
        if self.take() != ("op", "{"):
            raise FilterError('Expected "{" after "in".')
        members = []
        while True:
            token = self.peek()
            if token == ("op", "}"):
                self.take()
                return members
            if token == ("op", ","):
                self.take()
                continue
            members.append(self.literal())


def _values(packet, name):
    if name in PROTOCOLS:
        return [1] if _has_protocol(packet, name) else []
    return packet.fields.get(name, [])


def _has_protocol(packet, name):
    protocols = packet.fields.get("_protocols", [])
    if name == "mdns":
        return packet.top == "MDNS"
    if name == "dns":
        return "dns" in protocols and packet.top == "DNS"
    return name in protocols


def _exists(name):
    if name in BOOLEAN_FIELDS:
        return lambda packet: any(bool(v) for v in _values(packet, name))
    return lambda packet: bool(_values(packet, name))


def _compare(kind, wanted, operator, value):
    """One field value against one literal."""
    if operator == "contains":
        return str(wanted) in (value if isinstance(value, str) else str(value))
    try:
        if kind == "ip":
            address = ipaddress.ip_address(str(value))
            if "/" in wanted:
                equal = address in ipaddress.ip_network(wanted, strict=False)
            else:
                equal = address == ipaddress.ip_address(wanted)
            return equal if operator in {"==", "!="} else False
        if kind == "number":
            number = value if isinstance(value, (int, float)) else int(str(value))
            return {"==": number == wanted, "!=": number != wanted, ">": number > wanted, "<": number < wanted,
                    ">=": number >= wanted, "<=": number <= wanted}[operator]
        if kind == "mac":
            return str(value).lower() == wanted.lower()
        return str(value) == wanted
    except (ValueError, TypeError):
        return False


def _comparison(name, operator, literal):
    kind, wanted = literal

    def test(packet):
        if name in PROTOCOLS:
            if operator != "contains":
                raise FilterError("A protocol cannot be compared with %s." % operator)
            if not _has_protocol(packet, name):
                return False
            raw = packet.data if name in {"frame", "eth", "ethertype"} else _layer_bytes(packet, name)
            return str(wanted).encode("latin-1", "replace") in raw
        values = packet.fields.get(name, [])
        if operator == "!=":
            # Wireshark 4: "ip.addr != x" means no value of the field equals x.
            return bool(values) and not any(_compare(kind, wanted, "==", value) for value in values)
        return any(_compare(kind, wanted, operator, value) for value in values)

    return test


def _layer_bytes(packet, name):
    """The bytes of an application layer, for 'http contains "x"'."""
    if name == "http":
        return packet.layers.get("tcp", {}).get("payload", b"")
    if name in {"tcp", "udp"}:
        return packet.layers.get(name, {}).get("payload", b"")
    return packet.data


def compile_filter(text):
    text = (text or "").strip()
    if not text:
        return lambda packet: True
    return _Parser(tokenize(text)).parse()


def apply_filter(session, text):
    """Packet numbers of the session that match the display filter text."""
    predicate = compile_filter(text)
    return [packet.number for packet in session.packets if predicate(packet)]


def is_packet(value):
    return isinstance(value, Dissected)
