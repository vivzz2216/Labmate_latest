"""A deterministic network simulator for the Packet Tracer experiments (hub, switch, ARP, ICMP, routers, RIP).

It follows the protocol rules, not a script: a hub repeats every frame out of every other port; a switch learns source
addresses and forwards known unicasts only to the learned port; hosts and routers resolve next hops with ARP (RFC 826,
including its "update an existing entry from any request" rule); routers forward by longest prefix, decrement TTL and
answer with ICMP errors; RIP exchanges distance-vector updates with split horizon and triggered updates, so a failed
link is routed around once the tables settle. Every frame delivery is recorded as an event, which is what the
Simulation-mode event list shows.
"""
import heapq
import ipaddress
import itertools
import re
import zlib
from dataclasses import dataclass

LINK_DELAY = 0.001           # seconds of simulated time a frame needs to cross one cable
ARP_TIMEOUT = 1.0
RIP_UPDATE_INTERVAL = 30.0
RIP_TRIGGER_DELAY = 1.0
RIP_INFINITY = 16
STORM_EVENTS = 1500           # one ping needs a few dozen events; far more means frames are circulating in a loop
RIP_DISTANCE = 120
PC_TTL, ROUTER_TTL = 128, 255
BROADCAST = "ff:ff:ff:ff:ff:ff"
END_TYPES = {"pc", "router"}            # NICs of these are "MDI": a straight-through cable joins them to a hub or switch


class TopologyError(ValueError):
    pass


def classful_network(address):
    """The classful network of an address ('192.168.1.7' -> '192.168.1.0'), as RIP's network statement uses."""
    first = int(address.split(".")[0])
    octets = address.split(".")
    keep = 1 if first < 128 else 2 if first < 192 else 3
    return ".".join(octets[:keep] + ["0"] * (4 - keep))


def _network(ip, mask):
    return ipaddress.ip_network("%s/%s" % (ip, mask), strict=False)


@dataclass
class Port:
    name: str
    device: "Device"
    mac: str = ""
    ip: str = ""
    mask: str = ""
    link: "Link" = None
    shutdown: bool = False
    stp_blocking: bool = False

    @property
    def peer(self):
        if self.link is None:
            return None
        return self.link.b if self.link.a is self else self.link.a

    @property
    def up(self):
        link = self.link
        return bool(link and link.up and not self.shutdown and not self.peer.shutdown)

    @property
    def network(self):
        return _network(self.ip, self.mask) if self.ip else None

    def label(self):
        return "%s %s" % (self.device.name, self.name)


@dataclass
class Link:
    a: Port
    b: Port
    cable: str = "straight"
    enabled: bool = True

    @property
    def cable_ok(self):
        like = (self.a.device.mdi_x == self.b.device.mdi_x)
        return (self.cable == "cross") == like

    @property
    def up(self):
        return self.enabled and self.cable_ok

    @property
    def color(self):
        return "green" if self.up else "red"


@dataclass
class ArpPacket:
    op: str                     # "request" | "reply"
    sender_mac: str
    sender_ip: str
    target_mac: str
    target_ip: str


@dataclass
class IcmpMessage:
    kind: str                   # echo-request | echo-reply | ttl-exceeded | net-unreachable | host-unreachable
    ident: int = 1
    seq: int = 1
    original_src: str = ""
    original_dst: str = ""


@dataclass
class RipMessage:
    entries: list               # (network, mask, metric)


@dataclass
class IpPacket:
    src: str
    dst: str
    ttl: int
    protocol: str               # "ICMP" | "RIP"
    data: object


@dataclass
class Frame:
    src_mac: str
    dst_mac: str
    kind: str                   # "ARP" | "IPv4"
    payload: object
    pdu: int = 0


@dataclass
class Event:
    time: float
    pdu: int
    last: str
    at: str
    kind: str                   # ARP | ICMP | RIP
    info: str
    action: str                 # created | forwarded | accepted | discarded | dropped
    src_mac: str = ""
    dst_mac: str = ""

    def row(self, offset=0.0):
        return {"time": round(self.time - offset, 3) + 0.0, "pdu": self.pdu, "last": self.last, "at": self.at, "type": self.kind, "info": self.info,
                "action": self.action, "src_mac": self.src_mac, "dst_mac": self.dst_mac}


class Device:
    mdi_x = False
    type = "device"

    def __init__(self, network, name):
        self.network, self.name = network, name
        self.ports = {}

    def add_port(self, name):
        port = Port(name, self)
        port.mac = self.network.make_mac("%s/%s" % (self.name, name))
        self.ports[name] = port
        return port

    def receive(self, port, frame):
        raise NotImplementedError


class Hub(Device):
    type = "hub"
    mdi_x = True

    def receive(self, port, frame):
        targets = [other for other in self.ports.values() if other is not port and other.up]
        self.network.log(self, port, frame, "forwarded" if targets else "dropped")
        for other in targets:
            self.network.transmit(self, other, frame, "forwarded")


class Switch(Device):
    type = "switch"
    mdi_x = True

    def __init__(self, network, name):
        super().__init__(network, name)
        self.table = {}                       # mac -> port name
        self.bridge_id = None

    def receive(self, port, frame):
        if port.stp_blocking:
            self.network.log(self, port, frame, "discarded")
            return
        self.table[frame.src_mac] = port.name
        targets = None
        if frame.dst_mac != BROADCAST:
            out = self.table.get(frame.dst_mac)
            if out is not None:
                target = self.ports[out]
                if target is port:
                    self.network.log(self, port, frame, "discarded")               # the destination is on the arrival segment
                    return
                if target.up and not target.stp_blocking:
                    targets = [target]
                else:
                    del self.table[frame.dst_mac]
        if targets is None:
            targets = [other for other in self.ports.values() if other is not port and other.up and not other.stp_blocking]
        self.network.log(self, port, frame, "forwarded" if targets else "dropped")
        for target in targets:
            self.network.transmit(self, target, frame, "forwarded")

    def flush_port(self, port_name):
        self.table = {mac: p for mac, p in self.table.items() if p != port_name}


class IpNode(Device):
    """Behaviour shared by hosts and routers: an ARP cache and resolution of next hops."""

    def __init__(self, network, name):
        super().__init__(network, name)
        self.arp = {}                                         # ip -> mac
        self.waiting = {}                                     # (port name, next-hop ip) -> [(IpPacket, pdu)]
        self.ttl = PC_TTL

    def learn(self, ip, mac, new_entries_allowed):
        if ip in self.arp or new_entries_allowed:
            self.arp[ip] = mac

    def handle_arp(self, port, frame):
        arp = frame.payload
        mine = arp.target_ip == port.ip
        self.learn(arp.sender_ip, arp.sender_mac, mine)                         # RFC 826: merge always, create only if addressed to us
        if arp.op == "request" and mine:
            reply = ArpPacket("reply", port.mac, port.ip, arp.sender_mac, arp.sender_ip)
            self.network.note(self, frame.pdu, "ARP", "%s is at %s" % (port.ip, port.mac), "created")
            self.network.transmit(self, port, Frame(port.mac, arp.sender_mac, "ARP", reply, frame.pdu), "created")
        elif arp.op == "reply" and mine:
            self.flush_waiting(port, arp.sender_ip)

    def resolve_and_send(self, port, next_hop, packet, pdu):
        mac = self.arp.get(next_hop)
        if mac:
            self.network.transmit(self, port, Frame(port.mac, mac, "IPv4", packet, pdu), "created")
            return
        key = (port.name, next_hop)
        first = key not in self.waiting
        self.waiting.setdefault(key, []).append((packet, pdu))
        if first:
            request = ArpPacket("request", port.mac, port.ip, "00:00:00:00:00:00", next_hop)
            self.network.note(self, pdu, "ARP", "Who has %s? Tell %s" % (next_hop, port.ip), "created")
            self.network.transmit(self, port, Frame(port.mac, BROADCAST, "ARP", request, pdu), "created")
            self.network.after(ARP_TIMEOUT, lambda: self.arp_timeout(port, next_hop, pdu))

    def flush_waiting(self, port, next_hop):
        for packet, pdu in self.waiting.pop((port.name, next_hop), []):
            mac = self.arp.get(next_hop)
            if mac:
                self.network.transmit(self, port, Frame(port.mac, mac, "IPv4", packet, pdu), "created")

    def arp_timeout(self, port, next_hop, pdu):
        pending = self.waiting.pop((port.name, next_hop), None)
        if not pending:
            return
        self.network.note(self, pdu, "ARP", "No ARP reply from %s: the host did not answer" % next_hop, "dropped")
        for packet, _ in pending:
            self.undeliverable(packet, pdu)

    def undeliverable(self, packet, pdu):
        pass


class Host(IpNode):
    type = "pc"

    def __init__(self, network, name):
        super().__init__(network, name)
        self.gateway = ""
        self.nic = self.add_port("FastEthernet0")
        self.replies = {}                                     # (ident, seq) -> reply message info
        self.failures = {}

    def configure(self, ip, mask, gateway=""):
        self.nic.ip, self.nic.mask, self.gateway = ip, mask, gateway

    def next_hop(self, dst):
        if not self.nic.ip:
            return None
        if ipaddress.ip_address(dst) in self.nic.network:
            return dst
        return self.gateway or None

    def send_echo(self, dst, pdu, ident=1, seq=1):
        packet = IpPacket(self.nic.ip, dst, self.ttl, "ICMP", IcmpMessage("echo-request", ident, seq))
        self.network.note(self, pdu, "ICMP", "Echo request to %s" % dst, "created")
        hop = self.next_hop(dst)
        if hop is None or not self.nic.up:
            self.failures[(ident, seq)] = "no route" if self.nic.up else "link down"
            return
        self.resolve_and_send(self.nic, hop, packet, pdu)

    def undeliverable(self, packet, pdu):
        message = packet.data
        if isinstance(message, IcmpMessage) and message.kind == "echo-request":
            self.failures[(message.ident, message.seq)] = "no arp reply"

    def receive(self, port, frame):
        if frame.dst_mac not in (port.mac, BROADCAST):
            self.network.log(self, port, frame, "discarded")
            return
        if frame.kind == "ARP":
            arp = frame.payload
            wanted = arp.target_ip == port.ip and (arp.op == "request" or frame.dst_mac == port.mac)
            self.network.log(self, port, frame, "accepted" if wanted else "discarded")
            self.handle_arp(port, frame)
            return
        packet = frame.payload
        if packet.protocol != "ICMP" or packet.dst != port.ip:
            self.network.log(self, port, frame, "discarded")
            return
        self.network.log(self, port, frame, "accepted")
        message = packet.data
        if message.kind == "echo-request":
            reply = IpPacket(port.ip, packet.src, self.ttl, "ICMP", IcmpMessage("echo-reply", message.ident, message.seq))
            hop = self.next_hop(packet.src)
            if hop:
                self.resolve_and_send(port, hop, reply, frame.pdu)
        elif message.kind == "echo-reply":
            self.replies[(message.ident, message.seq)] = {"from": packet.src, "ttl": packet.ttl}
        else:
            self.failures[(message.ident, message.seq)] = message.kind
            self.replies.setdefault(("error", message.ident, message.seq), {"from": packet.src, "kind": message.kind})


@dataclass
class Route:
    network: ipaddress.IPv4Network
    code: str                   # "C" connected | "S" static | "R" RIP
    interface: str
    next_hop: str = ""
    metric: int = 0
    changed_at: float = 0.0
    poisoned: bool = False


class Router(IpNode):
    type = "router"

    def __init__(self, network, name, interfaces=("FastEthernet0/0", "FastEthernet1/0", "FastEthernet2/0")):
        super().__init__(network, name)
        self.ttl = ROUTER_TTL
        for interface in interfaces:
            self.add_port(interface)
        self.routes = {}
        self.static_routes = []            # (network, next hop) pairs entered with 'ip route'
        self.rip_networks = []
        self.rip_started = False
        self.trigger_pending = False

    def configure(self, interface, ip, mask):
        port = self.ports[interface]
        port.ip, port.mask = ip, mask
        self.refresh_connected()

    def add_static_route(self, network, mask, next_hop):
        self.static_routes.append((_network(network, mask), next_hop))
        self.refresh_connected()

    def install_static(self):
        """A static route is in the table while its next hop lies on an interface that is up (administrative distance 1, so
        it beats RIP but never a connected network)."""
        changed = False
        for network, next_hop in self.static_routes:
            key = str(network)
            existing = self.routes.get(key)
            if existing is not None and existing.code == "C" and not existing.poisoned:
                continue
            port = next((p for p in self.ports.values() if p.ip and p.up and ipaddress.ip_address(next_hop) in p.network), None)
            if port is None:
                if existing is not None and existing.code == "S":
                    del self.routes[key]
                    changed = True
                continue
            if existing is None or existing.code != "S" or existing.interface != port.name or existing.next_hop != next_hop:
                self.routes[key] = Route(network, "S", port.name, next_hop, 0, self.network.now)
                changed = True
        return changed

    def enable_rip(self, networks):
        self.rip_networks = [classful_network(n) for n in networks]

    def rip_ports(self):
        return [p for p in self.ports.values() if p.ip and p.up and classful_network(p.ip) in self.rip_networks]

    # ------------------------------------------------------------------ routing table
    def refresh_connected(self):
        """Keep connected routes equal to the interfaces that are configured and up. A connected route whose interface went
        down is poisoned (advertised once with metric 16) so neighbours drop routes that went through it."""
        now = self.network.now
        changed = False
        for port in self.ports.values():
            if port.ip and port.up:
                key = str(port.network)
                existing = self.routes.get(key)
                if existing is None or existing.code != "C" or existing.interface != port.name or existing.poisoned:
                    self.routes[key] = Route(port.network, "C", port.name, "", 0, now)
                    changed = True
        for key, route in list(self.routes.items()):
            port = self.ports.get(route.interface)
            if route.poisoned or route.code == "S":
                continue
            if route.code == "C" and (port is None or not port.ip or str(port.network) != key):
                del self.routes[key]
                changed = True
            elif port is not None and not port.up:
                route.metric, route.poisoned, route.changed_at = RIP_INFINITY, True, now
                changed = True
        changed = self.install_static() or changed
        if changed and self.rip_networks:
            self.schedule_trigger()
        return changed

    def lookup(self, destination):
        """Longest-prefix match; between equal prefixes the lower administrative distance wins (connected 0, static 1, RIP 120),
        then the lower metric."""
        address = ipaddress.ip_address(destination)
        candidates = [r for r in self.routes.values() if not r.poisoned and address in r.network]
        return min(candidates, key=lambda r: (-r.network.prefixlen, {"C": 0, "S": 1}.get(r.code, RIP_DISTANCE), r.metric), default=None)

    def show_ip_route(self):
        """The table as the router's 'show ip route' prints it."""
        lines = ["Codes: C - connected, S - static, R - RIP"]
        lines.append("")
        for route in sorted(self.routes.values(), key=lambda r: (int(r.network.network_address), r.network.prefixlen)):
            if route.poisoned:
                continue
            if route.code == "C":
                lines.append("C    %s is directly connected, %s" % (route.network, route.interface))
            elif route.code == "S":
                lines.append("S    %s [1/0] via %s" % (route.network, route.next_hop))
            else:
                age = int(self.network.now - route.changed_at)
                lines.append("R    %s [120/%d] via %s, 00:00:%02d, %s" % (route.network, route.metric, route.next_hop, age % 60, route.interface))
        return lines

    def table(self):
        return [{"code": r.code, "network": str(r.network), "interface": r.interface, "next_hop": r.next_hop,
                 "metric": r.metric, "distance": {"C": 0, "S": 1}.get(r.code, RIP_DISTANCE)}
                for r in sorted(self.routes.values(), key=lambda r: (int(r.network.network_address), r.network.prefixlen)) if not r.poisoned]

    # ------------------------------------------------------------------ RIP
    def start_rip(self):
        if self.rip_started or not self.rip_networks:
            return
        self.rip_started = True
        self.send_updates()
        self.network.after(RIP_UPDATE_INTERVAL, self.periodic)

    def periodic(self):
        if not self.rip_networks:
            return
        self.send_updates()
        self.network.after(RIP_UPDATE_INTERVAL, self.periodic)

    def schedule_trigger(self):
        if self.trigger_pending or not self.rip_started:
            return
        self.trigger_pending = True
        self.network.after(RIP_TRIGGER_DELAY, self.triggered)

    def triggered(self):
        self.trigger_pending = False
        self.send_updates()
        for key, route in list(self.routes.items()):
            if route.poisoned:
                del self.routes[key]                                   # a poisoned route is advertised once, then flushed

    def send_updates(self):
        for port in self.rip_ports():
            entries = []
            for route in self.routes.values():
                if route.code == "S":
                    continue                                              # static routes are not redistributed into RIP
                if route.code == "R" and route.interface == port.name and not route.poisoned:
                    continue                                              # split horizon
                if route.code == "C" and route.interface == port.name:
                    continue
                if route.code == "C" and classful_network(str(route.network.network_address)) not in self.rip_networks:
                    continue
                entries.append((str(route.network.network_address), str(route.network.netmask), min(route.metric + 1, RIP_INFINITY)))
            if not entries:
                continue
            packet = IpPacket(port.ip, "255.255.255.255", 1, "RIP", RipMessage(entries))
            self.network.transmit(self, port, Frame(port.mac, BROADCAST, "IPv4", packet, 0), "created")

    def receive_rip(self, port, packet):
        if port not in self.rip_ports():
            return
        now, changed = self.network.now, False
        for network_address, mask, metric in packet.data.entries:
            network = _network(network_address, mask)
            key = str(network)
            if any(p.ip and p.up and p.network == network for p in self.ports.values()):
                continue                                                      # a directly connected network always wins
            metric = min(metric, RIP_INFINITY)
            route = self.routes.get(key)
            if route is None:
                if metric < RIP_INFINITY:
                    self.routes[key] = Route(network, "R", port.name, packet.src, metric, now)
                    changed = True
            elif route.code == "R":
                if route.next_hop == packet.src:
                    if metric != route.metric or route.poisoned:
                        route.metric, route.interface, route.poisoned, route.changed_at = metric, port.name, metric >= RIP_INFINITY, now
                        changed = True
                    else:
                        route.changed_at = now
                elif metric < route.metric:
                    route.next_hop, route.metric, route.interface, route.poisoned, route.changed_at = packet.src, metric, port.name, False, now
                    changed = True
        if changed:
            self.schedule_trigger()

    # ------------------------------------------------------------------ forwarding
    def receive(self, port, frame):
        if frame.dst_mac not in (port.mac, BROADCAST):
            self.network.log(self, port, frame, "discarded")
            return
        if frame.kind == "ARP":
            arp = frame.payload
            wanted = arp.target_ip == port.ip and (arp.op == "request" or frame.dst_mac == port.mac)
            self.network.log(self, port, frame, "accepted" if wanted else "discarded")
            self.handle_arp(port, frame)
            return
        packet = frame.payload
        if packet.protocol == "RIP":
            self.network.log(self, port, frame, "accepted")
            self.receive_rip(port, packet)
            return
        local = {p.ip for p in self.ports.values() if p.ip}
        if packet.dst in local:
            self.network.log(self, port, frame, "accepted")
            message = packet.data
            if packet.protocol == "ICMP" and message.kind == "echo-request":
                reply = IpPacket(packet.dst, packet.src, self.ttl, "ICMP", IcmpMessage("echo-reply", message.ident, message.seq))
                self.route(reply, frame.pdu)
            return
        if packet.ttl <= 1:
            self.network.log(self, port, frame, "dropped")
            self.icmp_error(packet, "ttl-exceeded", port.ip, frame.pdu)
            return
        route = self.lookup(packet.dst)
        if route is None:
            self.network.log(self, port, frame, "dropped")
            self.icmp_error(packet, "net-unreachable", port.ip, frame.pdu)
            return
        self.network.log(self, port, frame, "forwarded")
        self.route(IpPacket(packet.src, packet.dst, packet.ttl - 1, packet.protocol, packet.data), frame.pdu, route)

    def route(self, packet, pdu, route=None):
        route = route or self.lookup(packet.dst)
        if route is None:
            return
        port = self.ports[route.interface]
        next_hop = route.next_hop or packet.dst
        self.resolve_and_send(port, next_hop, packet, pdu)

    def icmp_error(self, original, kind, source_ip, pdu):
        if isinstance(original.data, IcmpMessage) and original.data.kind not in {"echo-request", "echo-reply"}:
            return
        inner = original.data if isinstance(original.data, IcmpMessage) else IcmpMessage("echo-request")
        message = IcmpMessage(kind, inner.ident, inner.seq, original.src, original.dst)
        reply = IpPacket(source_ip, original.src, self.ttl, "ICMP", message)
        self.route(reply, pdu)

    def undeliverable(self, packet, pdu):
        if packet.protocol == "ICMP" and isinstance(packet.data, IcmpMessage) and packet.data.kind == "echo-request":
            local = next((p.ip for p in self.ports.values() if p.ip), "")
            self.icmp_error(packet, "host-unreachable", local, pdu)


class Network:
    def __init__(self):
        self.devices = {}
        self.links = []
        self.now = 0.0
        self.events = []
        self._queue = []
        self._counter = itertools.count()
        self._pdu = itertools.count(1)
        self._start = 0.0

    # ------------------------------------------------------------------ building
    def make_mac(self, seed):
        value = zlib.crc32(seed.encode()) & 0xFFFFFF
        return "00:01:42:%02x:%02x:%02x" % (value >> 16, (value >> 8) & 0xFF, value & 0xFF)

    def add(self, kind, name, **options):
        if name in self.devices:
            raise TopologyError("The name %s is used twice." % name)
        device = {"pc": Host, "hub": Hub, "switch": Switch, "router": Router}[kind](self, name)
        if kind == "hub":
            for index in range(8):
                device.add_port("Port %d" % index)
        elif kind == "switch":
            for index in range(1, 25):
                device.add_port("FastEthernet0/%d" % index)
        self.devices[name] = device
        return device

    def connect(self, a, port_a, b, port_b, cable=None):
        if a == b:
            raise TopologyError("A cable must join two different devices.")
        left, right = self.devices[a].ports[port_a], self.devices[b].ports[port_b]
        if left.link or right.link:
            raise TopologyError("%s or %s is already connected." % (left.label(), right.label()))
        like = self.devices[a].mdi_x == self.devices[b].mdi_x
        link = Link(left, right, cable or ("cross" if like else "straight"))
        left.link = right.link = link
        self.links.append(link)
        self.recompute()
        return link

    def free_port(self, name):
        return next(port for port in self.devices[name].ports.values() if port.link is None)

    def link_between(self, a, b):
        for link in self.links:
            if {link.a.device.name, link.b.device.name} == {a, b}:
                return link
        raise TopologyError("%s and %s are not connected." % (a, b))

    # ------------------------------------------------------------------ simulation core
    def after(self, delay, action):
        heapq.heappush(self._queue, (self.now + delay, next(self._counter), action))

    def run(self, until=None, limit=200000):
        steps = 0
        while self._queue and (until is None or self._queue[0][0] <= until):
            time, _, action = heapq.heappop(self._queue)
            self.now = max(self.now, time)
            action()
            steps += 1
            if steps > limit:
                raise TopologyError("The simulation did not settle: frames keep circulating (a loop between hubs).")
        if until is not None:
            self.now = max(self.now, until)

    def transmit(self, device, port, frame, action):
        if not port.up:
            return
        peer = port.peer
        self.after(LINK_DELAY, lambda: self._deliver(peer, frame))

    def _deliver(self, peer, frame):
        if peer.up:
            peer.device.receive(peer, frame)

    def log(self, device, port, frame, action):
        kind, info = self.describe(frame)
        # A frame is logged when it arrives; the sender is the device on the other end of the cable it arrived on.
        last = port.peer.device.name if port.peer else ""
        self.events.append(Event(self.now, frame.pdu, last, device.name, kind, info, action, frame.src_mac, frame.dst_mac))

    def note(self, device, pdu, kind, info, action):
        self.events.append(Event(self.now, pdu, "", device.name, kind, info, action))

    @staticmethod
    def describe(frame):
        if frame.kind == "ARP":
            arp = frame.payload
            if arp.op == "request":
                return "ARP", "Who has %s? Tell %s" % (arp.target_ip, arp.sender_ip)
            return "ARP", "%s is at %s" % (arp.sender_ip, arp.sender_mac)
        packet = frame.payload
        if packet.protocol == "RIP":
            return "RIP", "RIP response from %s: %d routes" % (packet.src, len(packet.data.entries))
        message = packet.data
        text = {"echo-request": "Echo request %s -> %s ttl=%d", "echo-reply": "Echo reply %s -> %s ttl=%d",
                "ttl-exceeded": "Time exceeded %s -> %s ttl=%d", "net-unreachable": "Destination unreachable %s -> %s ttl=%d",
                "host-unreachable": "Host unreachable %s -> %s ttl=%d"}[message.kind]
        return "ICMP", text % (packet.src, packet.dst, packet.ttl)

    # ------------------------------------------------------------------ topology state
    def recompute(self):
        """Refresh everything derived from the cables: spanning tree, connected routes, switch tables."""
        self.compute_stp()
        for device in self.devices.values():
            if isinstance(device, Router):
                device.refresh_connected()
            if isinstance(device, Switch):
                for port in device.ports.values():
                    if not port.up:
                        device.flush_port(port.name)

    def compute_stp(self):
        """Spanning tree over the switches, as 802.1D settles: the lowest bridge id is the root of each switched network, the
        tree reaches every switch and hub once, and a cable that would close a loop is blocked at its switch end."""
        for device in self.devices.values():
            for port in device.ports.values():
                port.stp_blocking = False
        switches = sorted((d for d in self.devices.values() if isinstance(d, Switch)), key=lambda d: (32768, d.ports["FastEthernet0/1"].mac))
        l2_links = [l for l in self.links if l.up and not isinstance(l.a.device, (Host, Router)) and not isinstance(l.b.device, (Host, Router))]
        visited, tree = set(), set()
        for root in switches:
            if root.name in visited:
                continue
            visited.add(root.name)
            queue = [root.name]
            while queue:
                current = queue.pop(0)
                for link in l2_links:
                    for here, there in ((link.a, link.b), (link.b, link.a)):
                        if here.device.name == current and there.device.name not in visited:
                            visited.add(there.device.name)
                            tree.add(id(link))
                            queue.append(there.device.name)
        for link in l2_links:
            if id(link) not in tree:
                (link.b if isinstance(link.b.device, Switch) else link.a).stp_blocking = True

    def set_link(self, a, b, up):
        """Disable or enable the cable between two devices (shutting both interfaces), then let routing settle."""
        link = self.link_between(a, b)
        link.enabled = up
        self.recompute()
        for device in self.devices.values():
            if isinstance(device, Router) and device.rip_started:
                device.schedule_trigger()

    def converge(self, seconds=100.0):
        """Run routing for some simulated seconds so the tables settle (initial convergence or after a failure)."""
        for device in self.devices.values():
            if isinstance(device, Router):
                device.refresh_connected()
                device.start_rip()
        self.run(until=self.now + seconds)

    # ------------------------------------------------------------------ the Simple PDU
    def ping(self, source, destination_ip, ident=1, seq=1):
        """Send one echo request from a host, run until nothing is left to do, and report what happened."""
        host = self.devices[source]
        if not isinstance(host, Host):
            raise TopologyError("%s is not a computer." % source)
        pdu = next(self._pdu)
        start_index = len(self.events)
        host.replies.pop((ident, seq), None)
        host.failures.pop((ident, seq), None)
        start = self.now
        # RIP and its timers keep running in the background; a ping only runs until its own frames are done.
        horizon = self.now + 10.0
        host.send_echo(destination_ip, pdu, ident, seq)
        steps = 0
        while self._queue and self._queue[0][0] <= horizon and not self._pdu_finished(host, ident, seq):
            time, _, action = heapq.heappop(self._queue)
            self.now = max(self.now, time)
            action()
            steps += 1
            if steps > 50000:
                raise TopologyError("The simulation did not settle: frames keep circulating (a loop between hubs).")
        self.run(until=self.now + 0.05)
        events = [e for e in self.events[start_index:] if e.pdu == pdu]
        if len(events) > STORM_EVENTS:
            raise TopologyError("A loop between hubs is making every frame circulate forever (a broadcast storm). Remove the redundant cable "
                                "or use a switch, which runs spanning tree.")
        reply = host.replies.get((ident, seq))
        error = host.replies.get(("error", ident, seq))
        path = self._path(events, source)
        l3_path = [name for name in path if self.devices[name].type in {"pc", "router"}]
        result = {"pdu": pdu, "source": source, "destination": destination_ip, "success": reply is not None,
                  "reply_from": (reply or error or {}).get("from"), "error": None if reply else (error or {}).get("kind") or host.failures.get((ident, seq), "timeout"),
                  "path": path, "l3_path": l3_path, "events": [e.row(start) for e in events], "elapsed": round(self.now - start, 3)}
        return result

    def _pdu_finished(self, host, ident, seq):
        return (ident, seq) in host.replies or ("error", ident, seq) in host.replies or (ident, seq) in host.failures

    @staticmethod
    def _path(events, source):
        """Devices the echo request travelled through, found by walking back from where it was delivered (a flooded copy that
        went elsewhere is not part of the path)."""
        requests = [(i, e) for i, e in enumerate(events) if e.kind == "ICMP" and e.info.startswith("Echo request") and e.last]
        accepted = [(i, e) for i, e in requests if e.action == "accepted"]
        end = accepted[0] if accepted else (requests[-1] if requests else None)
        if end is None:
            return [source]
        chain, index, event = [end[1].at], end[0], end[1]
        while event.last and event.last != source:
            previous = next(((i, e) for i, e in reversed(requests) if i < index and e.at == event.last), None)
            chain.append(event.last)
            if previous is None:
                break
            index, event = previous
        chain.append(source)
        return chain[::-1]

    # ------------------------------------------------------------------ views
    def routing_tables(self):
        return {name: device.table() for name, device in self.devices.items() if isinstance(device, Router)}

    def arp_tables(self):
        return {name: dict(device.arp) for name, device in self.devices.items() if isinstance(device, IpNode)}

    def switch_tables(self):
        return {name: dict(device.table) for name, device in self.devices.items() if isinstance(device, Switch)}

    def snapshot(self):
        return {"devices": [{"name": d.name, "type": d.type, "ports": [
            {"name": p.name, "mac": p.mac, "ip": p.ip, "mask": p.mask, "up": p.up, "blocking": p.stp_blocking} for p in d.ports.values()
            if d.type not in {"hub", "switch"} or p.link is not None]} for d in self.devices.values()],
                "links": [{"a": l.a.device.name, "ap": l.a.name, "b": l.b.device.name, "bp": l.b.name, "cable": l.cable, "up": l.up,
                           "color": l.color} for l in self.links]}


def build(spec):
    """A Network from a topology spec: {"devices": [...], "links": [...]} (see packettracer_lab for the experiments' specs)."""
    network = Network()
    routers = []
    for item in spec.get("devices", []):
        kind = HOST_TYPES.get(item["type"], item["type"])
        device = network.add(kind, item["name"])
        if kind == "pc":
            device.configure(item.get("ip", ""), item.get("mask", "255.255.255.0"), item.get("gateway", ""))
        elif kind == "router":
            for interface, config in (item.get("interfaces") or {}).items():
                if interface not in device.ports:
                    device.add_port(interface)
                device.ports[interface].shutdown = bool(config.get("shutdown"))
                device.configure(interface, config.get("ip", ""), config.get("mask", "255.255.255.0"))
            device.enable_rip(item.get("rip", []))
            routers.append((device, item))
    for item in spec.get("links", []):
        for end, port in ((item["a"], item["ap"]), (item["b"], item["bp"])):
            device = network.devices.get(end)
            if device is not None and device.type in {"switch", "hub", "router"} and port not in device.ports:
                device.add_port(port)                  # models with more ports than the defaults (2960 GigabitEthernet uplinks, 1941 ...)
        network.connect(item["a"], item["ap"], item["b"], item["bp"], item.get("cable"))
    for device, item in routers:      # routes need the cables in place to find the interface towards the next hop
        device.refresh_connected()
        for route in item.get("staticRoutes") or []:
            device.add_static_route(route["network"], route.get("mask", "255.255.255.0"), route["nextHop"])
    return network


# Laptops and servers are hosts like a PC as far as addressing, ARP and ping are concerned.
HOST_TYPES = {"laptop": "pc", "server": "pc"}


_NAME = re.compile(r"^[A-Za-z][A-Za-z0-9_-]{0,23}$")


def validate(spec):
    """Reasons a topology spec cannot be built (empty when it is fine): duplicate names or IPs, bad addresses, off-subnet gateways."""
    problems, names, addresses = [], set(), {}
    for item in spec.get("devices", []):
        name = item.get("name", "")
        if not _NAME.match(name):
            problems.append("%r is not a valid device name." % name)
        if name in names:
            problems.append("The name %s is used twice." % name)
        names.add(name)
        kind = HOST_TYPES.get(item.get("type"), item.get("type"))
        if kind not in {"pc", "hub", "switch", "router"}:
            problems.append("%s has an unknown device type." % name)
        configs = [(name, item.get("ip"), item.get("mask", "255.255.255.0"))] if kind == "pc" else \
            [(name + " " + interface, c.get("ip"), c.get("mask")) for interface, c in (item.get("interfaces") or {}).items()]
        for label, ip, mask in configs:
            if not ip:
                continue
            try:
                ipaddress.ip_address(ip)
                network = _network(ip, mask)
            except ValueError:
                problems.append("%s has an invalid address or mask (%s / %s)." % (label, ip, mask))
                continue
            if ip in addresses:
                problems.append("%s and %s share the address %s." % (label, addresses[ip], ip))
            addresses[ip] = label
            gateway = item.get("gateway")
            if kind == "pc" and gateway:
                try:
                    if ipaddress.ip_address(gateway) not in network:
                        problems.append("The gateway %s of %s is outside its network %s." % (gateway, name, network))
                except ValueError:
                    problems.append("%s has an invalid gateway." % name)
    for item in spec.get("links", []):
        for end in ("a", "b"):
            if item.get(end) not in names:
                problems.append("A cable refers to the unknown device %s." % item.get(end))
        if item.get("a") == item.get("b"):
            problems.append("A cable must join two different devices (%s is joined to itself)." % item.get("a"))
    return problems
