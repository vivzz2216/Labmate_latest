"""The built-in capture for the Wireshark experiment: real frames with correct lengths and checksums.

A student normally captures their own traffic and uploads it. When they have no capture, this builds one that holds
every item the manual asks about: an ARP exchange, DNS, a TCP connection and an HTTP GET of the lab page, ICMP echo,
and an insecure HTML login whose form post carries the credentials in clear text. All names, addresses and the login are
fictional (documentation address ranges and a made-up host), and the studio labels the capture as a practice scenario.
"""
import socket
import struct

from .pcap import write_pcap

CLIENT_MAC, GATEWAY_MAC = "08:00:27:3a:5c:11", "00:0c:29:7e:41:b2"
CLIENT_IP, GATEWAY_IP = "192.168.1.10", "192.168.1.1"
GAIA_IP = "128.119.245.12"                       # the host the manual's URL points to
LOGIN_IP, LOGIN_HOST = "198.51.100.20", "login.labmate.test"
LOGIN_USER, LOGIN_PASSWORD = "student01", "LabAccess@2024"
START_EPOCH = 1794304863.512345                  # fixed so the scenario is identical on every run


def _mac(text):
    return bytes(int(part, 16) for part in text.split(":"))


def _checksum(data):
    if len(data) % 2:
        data += b"\x00"
    total = sum(struct.unpack("!%dH" % (len(data) // 2), data))
    while total >> 16:
        total = (total & 0xFFFF) + (total >> 16)
    return (~total) & 0xFFFF


def _pseudo(src, dst, proto, length):
    return socket.inet_aton(src) + socket.inet_aton(dst) + struct.pack("!BBH", 0, proto, length)


def ethernet(dst, src, ethertype, payload, pad=True):
    frame = _mac(dst) + _mac(src) + struct.pack("!H", ethertype) + payload
    return frame + b"\x00" * (60 - len(frame)) if pad and len(frame) < 60 else frame


def ipv4(src, dst, proto, payload, ident, ttl=64, dont_fragment=True):
    header = struct.pack("!BBHHHBBH", 0x45, 0, 20 + len(payload), ident, 0x4000 if dont_fragment else 0, ttl, proto, 0) \
        + socket.inet_aton(src) + socket.inet_aton(dst)
    header = header[:10] + struct.pack("!H", _checksum(header)) + header[12:]
    return header + payload


def tcp_segment(src, dst, sport, dport, seq, ack, flags, payload=b"", window=64240, options=b""):
    offset = (20 + len(options)) // 4
    header = struct.pack("!HHIIBBHHH", sport, dport, seq, ack, offset << 4, flags, window, 0, 0) + options
    checksum = _checksum(_pseudo(src, dst, 6, len(header) + len(payload)) + header + payload)
    return header[:16] + struct.pack("!H", checksum) + header[18:] + payload


def udp_datagram(src, dst, sport, dport, payload):
    length = 8 + len(payload)
    header = struct.pack("!HHHH", sport, dport, length, 0)
    checksum = _checksum(_pseudo(src, dst, 17, length) + header + payload) or 0xFFFF
    return struct.pack("!HHHH", sport, dport, length, checksum) + payload


def icmp_echo(kind, ident, seq, payload):
    header = struct.pack("!BBHHH", kind, 0, 0, ident, seq)
    return header[:2] + struct.pack("!H", _checksum(header + payload)) + header[4:] + payload


def arp_message(opcode, sender_mac, sender_ip, target_mac, target_ip):
    return struct.pack("!HHBBH", 1, 0x0800, 6, 4, opcode) + _mac(sender_mac) + socket.inet_aton(sender_ip) + _mac(target_mac) \
        + socket.inet_aton(target_ip)


def dns_query(ident, name):
    labels = b"".join(bytes([len(part)]) + part.encode() for part in name.split(".")) + b"\x00"
    return struct.pack("!HHHHHH", ident, 0x0100, 1, 0, 0, 0) + labels + struct.pack("!HH", 1, 1)


def dns_answer(ident, name, address, ttl=300):
    labels = b"".join(bytes([len(part)]) + part.encode() for part in name.split(".")) + b"\x00"
    return (struct.pack("!HHHHHH", ident, 0x8180, 1, 1, 0, 0) + labels + struct.pack("!HH", 1, 1)
            + b"\xc0\x0c" + struct.pack("!HHIH", 1, 1, ttl, 4) + socket.inet_aton(address))


SYN_OPTIONS = bytes.fromhex("020405b401030308" "0101" "0402")          # MSS 1460, NOP, WS 8, NOP, NOP, SACK permitted
SYNACK_OPTIONS = bytes.fromhex("020405b4" "01" "030307" "0101" "0402")


class _Builder:
    def __init__(self):
        self.frames = []
        self.clock = 0.0
        self.ident = 0x2a00

    def add(self, delta, frame):
        self.clock += delta
        self.frames.append((START_EPOCH + self.clock, frame))

    def next_id(self):
        self.ident += 1
        return self.ident

    def client_to(self, ip, mac, proto, payload, ttl=128):
        return ethernet(mac, CLIENT_MAC, 0x0800, ipv4(CLIENT_IP, ip, proto, payload, self.next_id(), ttl))

    def to_client(self, ip, proto, payload, ttl=64):
        return ethernet(CLIENT_MAC, GATEWAY_MAC, 0x0800, ipv4(ip, CLIENT_IP, proto, payload, self.next_id(), ttl))


def _http_exchange(builder, server_ip, client_port, request, response, isn_client, isn_server, rtt=0.032):
    """A full TCP connection carrying one request and one response: handshake, data, acknowledgements, close."""
    c_seq, s_seq = isn_client, isn_server
    add, to_server, to_client = builder.add, builder.client_to, builder.to_client

    def c(flags, payload=b"", options=b"", seq=None, ack=None):
        return to_server(server_ip, GATEWAY_MAC, 6, tcp_segment(CLIENT_IP, server_ip, client_port, 80, c_seq if seq is None else seq,
                                                                s_seq if ack is None else ack, flags, payload,
                                                                window=64240 if flags & 2 else 513, options=options))

    def s(flags, payload=b"", options=b""):
        return to_client(server_ip, 6, tcp_segment(server_ip, CLIENT_IP, 80, client_port, s_seq, c_seq, flags, payload,
                                                        window=65535 if flags & 2 else 502, options=options))

    add(0.001, c(0x02, options=SYN_OPTIONS, ack=0))
    c_seq += 1
    add(rtt, s(0x12, options=SYNACK_OPTIONS))
    s_seq += 1
    add(0.0004, c(0x10))
    add(0.0011, c(0x18, request))
    c_seq += len(request)
    add(rtt, s(0x10))
    add(0.021, s(0x18, response))
    s_seq += len(response)
    add(0.0006, c(0x10))
    add(0.0009, c(0x11))
    c_seq += 1
    add(rtt, s(0x11))
    s_seq += 1
    add(0.0005, c(0x10))


GAIA_PAGE = (b"<html>\n<head><title>Wireshark Lab 1</title></head>\n"
             b"<body>Congratulations! You have downloaded the first lab file.</body>\n</html>\n")
LOGIN_FORM = (b"<html>\n<head><title>Student Portal</title></head>\n<body>\n<h2>Student Portal Login</h2>\n"
              b"<form method=\"POST\" action=\"/login.php\">\nUsername: <input name=\"uname\" type=\"text\">\n"
              b"Password: <input name=\"pass\" type=\"password\">\n<input type=\"submit\" value=\"Login\">\n</form>\n</body>\n</html>\n")
LOGIN_DONE = b"<html>\n<body>Welcome, %s. You are logged in.</body>\n</html>\n" % LOGIN_USER.encode()


def _response(body, content_type="text/html"):
    return (b"HTTP/1.1 200 OK\r\nDate: Tue, 10 Nov 2026 10:01:04 GMT\r\nServer: Apache/2.4.58\r\nContent-Length: %d\r\n"
            b"Keep-Alive: timeout=5, max=100\r\nConnection: Keep-Alive\r\nContent-Type: %s; charset=UTF-8\r\n\r\n"
            % (len(body), content_type.encode())) + body


def build_scenario():
    """(frames, description): the capture as pcap bytes plus facts the lab text can rely on."""
    b = _Builder()
    # 1-2: ARP. The frames are shown as seen from a tap, so each is padded to the 60-byte Ethernet minimum.
    b.add(0.0, ethernet("ff:ff:ff:ff:ff:ff", CLIENT_MAC, 0x0806, arp_message(1, CLIENT_MAC, CLIENT_IP, "00:00:00:00:00:00", GATEWAY_IP)))
    b.add(0.0009, ethernet(CLIENT_MAC, GATEWAY_MAC, 0x0806, arp_message(2, GATEWAY_MAC, GATEWAY_IP, CLIENT_MAC, CLIENT_IP)))
    # 3-4: DNS for the lab page host
    b.add(0.004, b.client_to(GATEWAY_IP, GATEWAY_MAC, 17, udp_datagram(CLIENT_IP, GATEWAY_IP, 53011, 53, dns_query(0x4a2b, "gaia.cs.umass.edu"))))
    b.add(0.018, b.to_client(GATEWAY_IP, 17, udp_datagram(GATEWAY_IP, CLIENT_IP, 53, 53011, dns_answer(0x4a2b, "gaia.cs.umass.edu", GAIA_IP))))
    # 5-15: browser fetches the lab page
    request = (b"GET /wireshark-labs/INTRO-wireshark-file1.html HTTP/1.1\r\nHost: gaia.cs.umass.edu\r\nConnection: keep-alive\r\n"
               b"Upgrade-Insecure-Requests: 1\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
               b"Chrome/130.0 Safari/537.36\r\nAccept: text/html,application/xhtml+xml\r\nAccept-Language: en-US,en;q=0.9\r\n\r\n")
    _http_exchange(b, GAIA_IP, 52418, request, _response(GAIA_PAGE), 3112908840, 1884702161)
    # ICMP: two echo exchanges with the gateway, as `ping 192.168.1.1` produces them
    payload = b"abcdefghijklmnopqrstuvwabcdefghi"
    for seq in (1, 2):
        b.add(0.9 if seq == 1 else 1.0, b.client_to(GATEWAY_IP, GATEWAY_MAC, 1, icmp_echo(8, 0x0001, seq, payload)))
        b.add(0.0012, b.to_client(GATEWAY_IP, 1, icmp_echo(0, 0x0001, seq, payload), ttl=64))
    # The insecure login: DNS, then the form page, then the form post with the password in clear text
    b.add(2.0, b.client_to(GATEWAY_IP, GATEWAY_MAC, 17, udp_datagram(CLIENT_IP, GATEWAY_IP, 53042, 53, dns_query(0x7c11, LOGIN_HOST))))
    b.add(0.016, b.to_client(GATEWAY_IP, 17, udp_datagram(GATEWAY_IP, CLIENT_IP, 53, 53042, dns_answer(0x7c11, LOGIN_HOST, LOGIN_IP))))
    get_form = (b"GET /login.html HTTP/1.1\r\nHost: %s\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36\r\n"
                b"Accept: text/html\r\n\r\n" % LOGIN_HOST.encode())
    _http_exchange(b, LOGIN_IP, 52431, get_form, _response(LOGIN_FORM), 2201552310, 937116402)
    form = b"uname=%s&pass=%s" % (LOGIN_USER.encode(), LOGIN_PASSWORD.encode())
    post = (b"POST /login.php HTTP/1.1\r\nHost: %s\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36\r\n"
            b"Content-Type: application/x-www-form-urlencoded\r\nContent-Length: %d\r\nReferer: http://%s/login.html\r\n\r\n%s"
            % (LOGIN_HOST.encode(), len(form), LOGIN_HOST.encode(), form))
    b.clock += 4.2                                                      # the student types the credentials
    _http_exchange(b, LOGIN_IP, 52437, post, _response(LOGIN_DONE), 2201771004, 937208119)
    return write_pcap(b.frames), {"login_host": LOGIN_HOST, "login_user": LOGIN_USER, "login_password": LOGIN_PASSWORD, "page_host": "gaia.cs.umass.edu"}
