"""Build the packet analyser's sample capture files with scapy (an independent packet library, not LabMate's own code).

The packets are constructed, not recorded from a network: every header, length and checksum is computed by scapy, and the
exchanges follow the protocols' real message sequences (DHCP DORA, ARP probe/announce, DNS with CNAME/NXDOMAIN, a TCP
handshake and teardown, HTTP GET/POST, ping, traceroute, IPv6 neighbour discovery). The analyser then reads these files
exactly like a student's own capture.

    uv run --python 3.11 --no-project --with scapy python backend/scripts/netlab_make_samples.py
"""
from pathlib import Path

from scapy.all import (ARP, DHCP, DNS, DNSQR, DNSRR, DNSRRMX, DNSRRSOA, ICMP, IP, TCP, UDP, BOOTP, Ether, ICMPv6EchoReply,
                       ICMPv6EchoRequest, ICMPv6ND_NA, ICMPv6ND_NS, ICMPv6NDOptDstLLAddr, ICMPv6NDOptSrcLLAddr, IPerror, IPv6,
                       Raw, UDPerror, wrpcap, wrpcapng)

OUT = Path(__file__).resolve().parents[1] / "app" / "netlab" / "samples"
START = 1795167000.0                      # 2026-11-20 09:30:00 UTC

PC_MAC, PC_IP = "00:1b:21:3a:4f:5c", "192.168.1.10"          # the student's computer (Intel NIC)
GW_MAC, GW_IP = "f8:bc:12:4e:20:01", "192.168.1.1"            # home router: gateway, DHCP and DNS server
BCAST = "ff:ff:ff:ff:ff:ff"
PC_LL6, GW_LL6 = "fe80::21b:21ff:fe3a:4f5c", "fe80::fabc:12ff:fe4e:2001"
WEB_IP = "203.0.113.80"                                       # documentation address standing in for www.example.com


class Timeline:
    def __init__(self):
        self.now, self.packets = START, []

    def add(self, delay, packet):
        self.now += delay
        packet.time = self.now
        self.packets.append(packet)


def to_router(payload):
    return Ether(src=PC_MAC, dst=GW_MAC) / IP(src=PC_IP, dst=GW_IP, ttl=128, flags="DF") / payload


def from_router(payload, src=GW_IP, ttl=64):
    return Ether(src=GW_MAC, dst=PC_MAC) / IP(src=src, dst=PC_IP, ttl=ttl) / payload


def dhcp_arp():
    t = Timeline()
    xid = 0x5E3A91C2
    chaddr = bytes.fromhex(PC_MAC.replace(":", "")) + b"\0" * 10
    common = [("client_id", b"\x01" + bytes.fromhex(PC_MAC.replace(":", ""))), ("hostname", b"LAB-PC-07"),
              ("vendor_class_id", b"MSFT 5.0"), ("param_req_list", [1, 3, 6, 15, 31, 33, 43, 44, 46, 47, 119, 121, 249, 252])]
    boot = Ether(src=PC_MAC, dst=BCAST) / IP(src="0.0.0.0", dst="255.255.255.255", ttl=128) / UDP(sport=68, dport=67)
    reply = Ether(src=GW_MAC, dst=BCAST) / IP(src=GW_IP, dst="255.255.255.255", ttl=64) / UDP(sport=67, dport=68)
    server = [("server_id", GW_IP), ("lease_time", 86400), ("renewal_time", 43200), ("rebinding_time", 75600),
              ("subnet_mask", "255.255.255.0"), ("router", GW_IP), ("name_server", GW_IP), ("domain", b"lab.local")]
    t.add(0.0, boot / BOOTP(op=1, xid=xid, chaddr=chaddr, flags=0x8000) / DHCP(options=[("message-type", "discover"), *common, "end"]))
    t.add(0.0042, reply / BOOTP(op=2, xid=xid, yiaddr=PC_IP, siaddr=GW_IP, chaddr=chaddr, flags=0x8000) /
          DHCP(options=[("message-type", "offer"), *server, "end"]))
    t.add(0.0013, boot / BOOTP(op=1, xid=xid, chaddr=chaddr, flags=0x8000) /
          DHCP(options=[("message-type", "request"), *common[:3], ("requested_addr", PC_IP), ("server_id", GW_IP), common[3], "end"]))
    t.add(0.0051, reply / BOOTP(op=2, xid=xid, yiaddr=PC_IP, siaddr=GW_IP, chaddr=chaddr, flags=0x8000) /
          DHCP(options=[("message-type", "ack"), *server, "end"]))
    # RFC 5227: probe the new address three times, then announce it.
    for delay in (0.2, 1.1, 1.3):
        t.add(delay, Ether(src=PC_MAC, dst=BCAST) / ARP(op=1, hwsrc=PC_MAC, psrc="0.0.0.0", hwdst="00:00:00:00:00:00", pdst=PC_IP))
    t.add(2.0, Ether(src=PC_MAC, dst=BCAST) / ARP(op=1, hwsrc=PC_MAC, psrc=PC_IP, hwdst="00:00:00:00:00:00", pdst=PC_IP))
    t.add(0.35, Ether(src=PC_MAC, dst=BCAST) / ARP(op=1, hwsrc=PC_MAC, psrc=PC_IP, hwdst="00:00:00:00:00:00", pdst=GW_IP))
    t.add(0.0009, Ether(src=GW_MAC, dst=PC_MAC) / ARP(op=2, hwsrc=GW_MAC, psrc=GW_IP, hwdst=PC_MAC, pdst=PC_IP))
    # The router asks who has another address on the LAN; nobody answers.
    t.add(3.7, Ether(src=GW_MAC, dst=BCAST) / ARP(op=1, hwsrc=GW_MAC, psrc=GW_IP, hwdst="00:00:00:00:00:00", pdst="192.168.1.23"))
    t.add(1.0, Ether(src=GW_MAC, dst=BCAST) / ARP(op=1, hwsrc=GW_MAC, psrc=GW_IP, hwdst="00:00:00:00:00:00", pdst="192.168.1.23"))
    # Renewal half way through the lease is unicast to the server, and the client later releases the address.
    renew = Ether(src=PC_MAC, dst=GW_MAC) / IP(src=PC_IP, dst=GW_IP, ttl=128) / UDP(sport=68, dport=67)
    t.add(6.0, renew / BOOTP(op=1, xid=xid + 1, ciaddr=PC_IP, chaddr=chaddr) / DHCP(options=[("message-type", "request"), *common[:3], common[3], "end"]))
    t.add(0.0038, Ether(src=GW_MAC, dst=PC_MAC) / IP(src=GW_IP, dst=PC_IP, ttl=64) / UDP(sport=67, dport=68) /
          BOOTP(op=2, xid=xid + 1, ciaddr=PC_IP, yiaddr=PC_IP, siaddr=GW_IP, chaddr=chaddr) / DHCP(options=[("message-type", "ack"), *server, "end"]))
    t.add(4.2, renew / BOOTP(op=1, xid=xid + 2, ciaddr=PC_IP, chaddr=chaddr) /
          DHCP(options=[("message-type", "release"), ("server_id", GW_IP), common[0], "end"]))
    return t.packets


def dns_queries():
    t = Timeline()
    q = lambda ident, name, qtype, sport: to_router(UDP(sport=sport, dport=53) / DNS(id=ident, rd=1, qd=DNSQR(qname=name, qtype=qtype)))
    r = lambda ident, name, qtype, sport, **kw: from_router(UDP(sport=53, dport=sport) /
                                                           DNS(id=ident, qr=1, rd=1, ra=1, qd=DNSQR(qname=name, qtype=qtype), **kw))
    t.add(0.0, q(0x1a2b, "www.example.com", "A", 51734))
    t.add(0.0186, r(0x1a2b, "www.example.com", "A", 51734, an=[DNSRR(rrname="www.example.com", type="CNAME", ttl=3600, rdata="example.com"),
                    DNSRR(rrname="example.com", type="A", ttl=300, rdata=WEB_IP)]))
    t.add(0.0007, q(0x1a2c, "www.example.com", "AAAA", 51735))
    t.add(0.0211, r(0x1a2c, "www.example.com", "AAAA", 51735, an=[DNSRR(rrname="www.example.com", type="CNAME", ttl=3600, rdata="example.com"),
                    DNSRR(rrname="example.com", type="AAAA", ttl=300, rdata="2001:db8:85a3::80")]))
    t.add(1.42, q(0x3c11, "example.com", "MX", 55102))
    t.add(0.0302, r(0x3c11, "example.com", "MX", 55102, an=[DNSRRMX(rrname="example.com", ttl=1800, preference=10, exchange="mail.example.com"),
                    DNSRRMX(rrname="example.com", ttl=1800, preference=20, exchange="mail2.example.com")]))
    t.add(2.07, q(0x4d02, "nosuch.example.com", "A", 60411))
    t.add(0.0254, from_router(UDP(sport=53, dport=60411) / DNS(id=0x4d02, qr=1, rd=1, ra=1, rcode=3, qd=DNSQR(qname="nosuch.example.com", qtype="A"),
                                                              ns=DNSRRSOA(rrname="example.com", ttl=900, mname="ns1.example.com",
                                                                          rname="hostmaster.example.com", serial=2026112001,
                                                                          refresh=7200, retry=3600, expire=1209600, minimum=900))))
    t.add(1.88, q(0x5e7f, "8.8.8.8.in-addr.arpa", "PTR", 61900))
    t.add(0.0331, r(0x5e7f, "8.8.8.8.in-addr.arpa", "PTR", 61900, an=DNSRR(rrname="8.8.8.8.in-addr.arpa", type="PTR", ttl=7200, rdata="dns.google")))
    # The same lookup over IPv6 link-local, and a query that times out and is retried.
    t.add(1.2, Ether(src=PC_MAC, dst=GW_MAC) / IPv6(src=PC_LL6, dst=GW_LL6, hlim=64) / UDP(sport=50555, dport=53) /
          DNS(id=0x6a01, rd=1, qd=DNSQR(qname="labmate.example.org", qtype="A")))
    t.add(0.0198, Ether(src=GW_MAC, dst=PC_MAC) / IPv6(src=GW_LL6, dst=PC_LL6, hlim=64) / UDP(sport=53, dport=50555) /
          DNS(id=0x6a01, qr=1, rd=1, ra=1, qd=DNSQR(qname="labmate.example.org", qtype="A"),
              an=DNSRR(rrname="labmate.example.org", type="A", ttl=600, rdata="198.51.100.24")))
    t.add(2.5, q(0x7b33, "timeout.example.net", "A", 62010))
    t.add(1.0, q(0x7b33, "timeout.example.net", "A", 62010))
    t.add(0.0412, r(0x7b33, "timeout.example.net", "A", 62010, an=DNSRR(rrname="timeout.example.net", type="A", ttl=60, rdata="198.51.100.77")))
    return t.packets


def http_browsing():
    t = Timeline()
    port, isn_c, isn_s = 50214, 2741190002, 3311871456
    up = lambda flags, seq, ack, payload=b"", **kw: Ether(src=PC_MAC, dst=GW_MAC) / IP(src=PC_IP, dst=WEB_IP, ttl=128, flags="DF") / \
        TCP(sport=port, dport=80, flags=flags, seq=seq, ack=ack, window=kw.get("window", 1026), options=kw.get("options", [])) / Raw(payload)
    down = lambda flags, seq, ack, payload=b"", **kw: Ether(src=GW_MAC, dst=PC_MAC) / IP(src=WEB_IP, dst=PC_IP, ttl=52, flags="DF") / \
        TCP(sport=80, dport=port, flags=flags, seq=seq, ack=ack, window=kw.get("window", 501), options=kw.get("options", [])) / Raw(payload)
    t.add(0.0, to_router(UDP(sport=52000, dport=53) / DNS(id=0x0b1e, rd=1, qd=DNSQR(qname="www.example.com", qtype="A"))))
    t.add(0.0172, from_router(UDP(sport=53, dport=52000) / DNS(id=0x0b1e, qr=1, rd=1, ra=1, qd=DNSQR(qname="www.example.com", qtype="A"),
                                                               an=DNSRR(rrname="www.example.com", type="A", ttl=300, rdata=WEB_IP))))
    syn_opts = [("MSS", 1460), ("NOP", None), ("WScale", 8), ("NOP", None), ("NOP", None), ("SAckOK", b"")]
    t.add(0.0011, up("S", isn_c, 0, window=64240, options=syn_opts))
    t.add(0.0384, down("SA", isn_s, isn_c + 1, window=65535, options=[("MSS", 1400), ("NOP", None), ("NOP", None), ("SAckOK", b""),
                                                                        ("NOP", None), ("WScale", 9)]))
    t.add(0.0002, up("A", isn_c + 1, isn_s + 1))
    get = (b"GET /index.html HTTP/1.1\r\nHost: www.example.com\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/133.0\r\n"
           b"Accept: text/html,application/xhtml+xml\r\nAccept-Language: en-IN,en;q=0.9\r\nAccept-Encoding: identity\r\n"
           b"Connection: keep-alive\r\n\r\n")
    t.add(0.0006, up("PA", isn_c + 1, isn_s + 1, get))
    html = (b"<!doctype html>\n<html>\n<head>\n<title>Example Domain</title>\n<meta charset=\"utf-8\">\n</head>\n<body>\n"
            b"<h1>Example Domain</h1>\n<p>This domain is for use in documentation examples.</p>\n"
            b"<form method=\"post\" action=\"/login\">\n<input name=\"username\"> <input name=\"password\" type=\"password\">\n"
            b"<button>Sign in</button>\n</form>\n</body>\n</html>\n")
    ok = (b"HTTP/1.1 200 OK\r\nDate: Fri, 20 Nov 2026 09:30:00 GMT\r\nServer: nginx/1.26.2\r\nContent-Type: text/html; charset=UTF-8\r\n"
          b"Content-Length: %d\r\nLast-Modified: Mon, 02 Nov 2026 09:00:00 GMT\r\nConnection: keep-alive\r\n\r\n" % len(html)) + html
    t.add(0.0391, down("A", isn_s + 1, isn_c + 1 + len(get)))
    t.add(0.0014, down("PA", isn_s + 1, isn_c + 1 + len(get), ok))
    t.add(0.0003, up("A", isn_c + 1 + len(get), isn_s + 1 + len(ok)))
    favicon = (b"GET /favicon.ico HTTP/1.1\r\nHost: www.example.com\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/133.0\r\n"
               b"Accept: image/avif,image/webp,*/*\r\nReferer: http://www.example.com/index.html\r\nConnection: keep-alive\r\n\r\n")
    c_seq, s_seq = isn_c + 1 + len(get), isn_s + 1 + len(ok)
    t.add(0.118, up("PA", c_seq, s_seq, favicon))
    notfound_body = b"<html><body><h1>404 Not Found</h1></body></html>\n"
    notfound = (b"HTTP/1.1 404 Not Found\r\nServer: nginx/1.26.2\r\nContent-Type: text/html\r\nContent-Length: %d\r\n"
                b"Connection: keep-alive\r\n\r\n" % len(notfound_body)) + notfound_body
    t.add(0.0402, down("PA", s_seq, c_seq + len(favicon), notfound))
    c_seq, s_seq = c_seq + len(favicon), s_seq + len(notfound)
    t.add(0.0002, up("A", c_seq, s_seq))
    form = b"username=student07&password=LabPass%2123"
    post = (b"POST /login HTTP/1.1\r\nHost: www.example.com\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/133.0\r\n"
            b"Content-Type: application/x-www-form-urlencoded\r\nContent-Length: %d\r\nOrigin: http://www.example.com\r\n"
            b"Referer: http://www.example.com/index.html\r\nConnection: keep-alive\r\n\r\n" % len(form)) + form
    t.add(6.42, up("PA", c_seq, s_seq, post))
    welcome_body = b"<html><body><p>Welcome, student07.</p></body></html>\n"
    welcome = (b"HTTP/1.1 200 OK\r\nServer: nginx/1.26.2\r\nContent-Type: text/html\r\nSet-Cookie: session=7f3c2a91; HttpOnly\r\n"
               b"Content-Length: %d\r\nConnection: close\r\n\r\n" % len(welcome_body)) + welcome_body
    t.add(0.0455, down("PA", s_seq, c_seq + len(post), welcome))
    c_seq, s_seq = c_seq + len(post), s_seq + len(welcome)
    t.add(0.0002, up("A", c_seq, s_seq))
    t.add(0.0011, down("FA", s_seq, c_seq))
    t.add(0.0004, up("A", c_seq, s_seq + 1))
    t.add(0.0008, up("FA", c_seq, s_seq + 1))
    t.add(0.0379, down("A", s_seq + 1, c_seq + 1))
    # A connection attempt to a port where nothing listens is refused with RST.
    probe = lambda flags, seq, ack, window: Ether(src=PC_MAC, dst=GW_MAC) / IP(src=PC_IP, dst=WEB_IP, ttl=128, flags="DF") / \
        TCP(sport=50220, dport=8080, flags=flags, seq=seq, ack=ack, window=window, options=syn_opts if flags == "S" else [])
    t.add(1.9, probe("S", 911200400, 0, 64240))
    t.add(0.0381, Ether(src=GW_MAC, dst=PC_MAC) / IP(src=WEB_IP, dst=PC_IP, ttl=52) / TCP(sport=8080, dport=50220, flags="RA", seq=0, ack=911200401, window=0))
    return t.packets


def ping_traceroute():
    t = Timeline()
    target = "8.8.8.8"
    t.add(0.0, Ether(src=PC_MAC, dst=BCAST) / ARP(op=1, hwsrc=PC_MAC, psrc=PC_IP, hwdst="00:00:00:00:00:00", pdst=GW_IP))
    t.add(0.0011, Ether(src=GW_MAC, dst=PC_MAC) / ARP(op=2, hwsrc=GW_MAC, psrc=GW_IP, hwdst=PC_MAC, pdst=PC_IP))
    payload = bytes(range(0x61, 0x77)) + bytes(range(0x61, 0x6a))       # Windows ping data: "abcdefghijklmnopqrstuvwabcdefghi"
    for seq in range(1, 5):
        t.add(0.0004 if seq == 1 else 0.98, Ether(src=PC_MAC, dst=GW_MAC) / IP(src=PC_IP, dst=target, ttl=128) / ICMP(type=8, id=1, seq=seq + 40) / Raw(payload))
        t.add(0.0213 + seq * 0.0011, Ether(src=GW_MAC, dst=PC_MAC) / IP(src=target, dst=PC_IP, ttl=117) / ICMP(type=0, id=1, seq=seq + 40) / Raw(payload))
    # tracert: echo requests with TTL 1, 2, 3; routers on the way answer "time-to-live exceeded".
    hops = [(1, GW_IP, 64), (2, "10.20.0.1", 254), (3, None, 117)]
    seq = 60
    for ttl, router, router_ttl in hops:
        for _ in range(2):
            seq += 1
            request = IP(src=PC_IP, dst=target, ttl=ttl, id=0x4000 + seq) / ICMP(type=8, id=1, seq=seq) / Raw(b"\0" * 64)
            t.add(0.5, Ether(src=PC_MAC, dst=GW_MAC) / request)
            if router is None:
                t.add(0.0231, Ether(src=GW_MAC, dst=PC_MAC) / IP(src=target, dst=PC_IP, ttl=router_ttl) / ICMP(type=0, id=1, seq=seq) / Raw(b"\0" * 64))
            else:
                quoted = IPerror(bytes(request)[:28])
                t.add(0.0018 * ttl + 0.0009, Ether(src=GW_MAC, dst=PC_MAC) / IP(src=router, dst=PC_IP, ttl=router_ttl) / ICMP(type=11, code=0) / quoted)
    # A UDP datagram to a closed port on the router: ICMP destination unreachable (port unreachable).
    probe = IP(src=PC_IP, dst=GW_IP, ttl=128, id=0x5101) / UDP(sport=50999, dport=33434) / Raw(b"LabMate probe")
    t.add(1.2, Ether(src=PC_MAC, dst=GW_MAC) / probe)
    t.add(0.0007, Ether(src=GW_MAC, dst=PC_MAC) / IP(src=GW_IP, dst=PC_IP, ttl=64) / ICMP(type=3, code=3) / IPerror(bytes(probe)[:28]) /
          UDPerror(bytes(probe)[20:28]))
    # IPv6: neighbour discovery, then ping6 the router's link-local address.
    t.add(0.9, Ether(src=PC_MAC, dst="33:33:ff:4e:20:01") / IPv6(src=PC_LL6, dst="ff02::1:ff4e:2001", hlim=255) /
          ICMPv6ND_NS(tgt=GW_LL6) / ICMPv6NDOptSrcLLAddr(lladdr=PC_MAC))
    t.add(0.0006, Ether(src=GW_MAC, dst=PC_MAC) / IPv6(src=GW_LL6, dst=PC_LL6, hlim=255) / ICMPv6ND_NA(tgt=GW_LL6, R=1, S=1, O=1) /
          ICMPv6NDOptDstLLAddr(lladdr=GW_MAC))
    for seq in range(1, 4):
        t.add(0.0003 if seq == 1 else 1.0, Ether(src=PC_MAC, dst=GW_MAC) / IPv6(src=PC_LL6, dst=GW_LL6, hlim=128) /
              ICMPv6EchoRequest(id=0x0001, seq=seq, data=payload))
        t.add(0.0004, Ether(src=GW_MAC, dst=PC_MAC) / IPv6(src=GW_LL6, dst=PC_LL6, hlim=64) / ICMPv6EchoReply(id=0x0001, seq=seq, data=payload))
    return t.packets


SAMPLES = [
    ("dhcp-arp.pcapng", dhcp_arp, "pcapng"),
    ("dns-queries.pcapng", dns_queries, "pcapng"),
    ("http-browsing.pcap", http_browsing, "pcap"),
    ("icmp-ping-traceroute.pcapng", ping_traceroute, "pcapng"),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, build, fmt in SAMPLES:
        packets = []
        for packet in build():                      # frames below Ethernet's 60-byte minimum carry trailing padding on the wire
            raw = bytes(packet)
            framed = Ether(raw + b"\x00" * (60 - len(raw))) if len(raw) < 60 else Ether(raw)
            framed.time = packet.time
            packets.append(framed)
        path = OUT / name
        (wrpcapng if fmt == "pcapng" else wrpcap)(str(path), packets)
        print("%-30s %3d packets  %6d bytes" % (name, len(packets), path.stat().st_size))


if __name__ == "__main__":
    main()
