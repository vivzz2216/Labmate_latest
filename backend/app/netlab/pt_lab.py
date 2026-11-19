"""Experiments 7 and 9 (Packet Tracer): the topologies the manuals describe, the scripted runs, and observations written from the
events the simulator actually produced.

Nothing in an observation is typed in: each sentence is built from the event list of that run (who received a broadcast, which
frames a switch flooded, which path an echo took), so the text always agrees with the screenshots.
"""
from . import pkttracer
from .pkttracer import build

PRACTICE_NOTE = ""
MASK = "255.255.255.0"
FA = "FastEthernet0"


def _pc(name, ip, x, y, gateway=""):
    return {"type": "pc", "name": name, "ip": ip, "mask": MASK, "gateway": gateway, "x": x, "y": y}


def _dev(kind, name, x, y, **extra):
    return {"type": kind, "name": name, "x": x, "y": y, **extra}


def _link(a, ap, b, bp):
    return {"a": a, "ap": ap, "b": b, "bp": bp}


# ------------------------------------------------------------------------------------------------ Experiment 7
def exp7_spec(scenario):
    """scenario: 1 star+hub, 2 star+switch, 3 bus of hubs, 'mesh' post-experimental exercise."""
    if scenario == 1:
        return {"name": "Star topology using a hub", "devices": [
            _dev("hub", "Hub0", 500, 260), _pc("PC0", "192.168.3.1", 250, 110), _pc("PC1", "192.168.3.2", 750, 110), _pc("PC2", "192.168.3.3", 500, 440)],
            "links": [_link("PC0", FA, "Hub0", "Port 0"), _link("PC1", FA, "Hub0", "Port 1"), _link("PC2", FA, "Hub0", "Port 2")]}
    if scenario == 2:
        return {"name": "Star topology using a switch", "devices": [
            _dev("switch", "Switch0", 500, 260), _pc("PC3", "192.168.3.1", 250, 110), _pc("PC4", "192.168.3.2", 750, 110), _pc("PC5", "192.168.3.3", 500, 440)],
            "links": [_link("PC3", FA, "Switch0", "FastEthernet0/1"), _link("PC4", FA, "Switch0", "FastEthernet0/2"),
                      _link("PC5", FA, "Switch0", "FastEthernet0/3")]}
    if scenario == 3:
        return {"name": "Bus topology using hubs", "devices": [
            _dev("hub", "Hub0", 230, 230), _dev("hub", "Hub1", 500, 230), _dev("hub", "Hub2", 770, 230),
            _pc("PC0", "192.168.3.1", 230, 430), _pc("PC1", "192.168.3.2", 500, 430), _pc("PC2", "192.168.3.3", 770, 430)],
            "links": [_link("Hub0", "Port 1", "Hub1", "Port 0"), _link("Hub1", "Port 1", "Hub2", "Port 0"),
                      _link("PC0", FA, "Hub0", "Port 0"), _link("PC1", FA, "Hub1", "Port 2"), _link("PC2", FA, "Hub2", "Port 2")]}
    if scenario == "mesh":
        return {"name": "Mesh topology using switches and a hub", "devices": [
            _dev("switch", "Switch0", 500, 100), _dev("switch", "Switch1", 230, 300), _dev("switch", "Switch2", 770, 300),
            _dev("hub", "Hub0", 230, 450), _pc("PC0", "192.168.3.1", 500, 20), _pc("PC1", "192.168.3.2", 120, 540),
            _pc("PC2", "192.168.3.3", 340, 540), _pc("PC3", "192.168.3.4", 770, 450)],
            "links": [_link("Switch0", "FastEthernet0/1", "Switch1", "FastEthernet0/1"), _link("Switch1", "FastEthernet0/2", "Switch2", "FastEthernet0/1"),
                      _link("Switch2", "FastEthernet0/2", "Switch0", "FastEthernet0/2"), _link("PC0", FA, "Switch0", "FastEthernet0/3"),
                      _link("Switch1", "FastEthernet0/3", "Hub0", "Port 0"), _link("PC1", FA, "Hub0", "Port 1"), _link("PC2", FA, "Hub0", "Port 2"),
                      _link("PC3", FA, "Switch2", "FastEthernet0/3")]}
    raise KeyError("Unknown scenario %r" % (scenario,))


# ------------------------------------------------------------------------------------------------ Experiment 9
ROUTER_LINKS = [("Router0", "FastEthernet1/0", "192.168.12.1", "Router1", "FastEthernet1/0", "192.168.12.2"),
                ("Router1", "FastEthernet2/0", "192.168.23.1", "Router2", "FastEthernet1/0", "192.168.23.2"),
                ("Router2", "FastEthernet2/0", "192.168.13.2", "Router0", "FastEthernet2/0", "192.168.13.1")]


def exp9_spec():
    lans = [("Router0", "Switch0", "PC0", "192.168.1", (230, 150), (100, 270), (100, 420)),
            ("Router1", "Switch1", "PC1", "192.168.2", (770, 150), (900, 270), (900, 420)),
            ("Router2", "Switch2", "PC2", "192.168.3", (500, 340), (500, 450), (500, 550))]
    devices, links = [], []
    interfaces = {}
    for router, switch, pc, net, rpos, spos, ppos in lans:
        interfaces[router] = {"FastEthernet0/0": {"ip": net + ".1", "mask": MASK}}
        devices += [_dev("switch", switch, *spos), _pc(pc, net + ".2", ppos[0], ppos[1], net + ".1")]
        links += [_link(pc, FA, switch, "FastEthernet0/1"), _link(switch, "FastEthernet0/2", router, "FastEthernet0/0")]
    for a, ap, aip, b, bp, bip in ROUTER_LINKS:
        interfaces[a][ap] = {"ip": aip, "mask": MASK}
        interfaces[b][bp] = {"ip": bip, "mask": MASK}
        links.append(_link(a, ap, b, bp))
    for (router, _s, _p, _n, rpos, _sp, _pp) in lans:
        rip = sorted({pkttracer.classful_network(c["ip"]) for c in interfaces[router].values()}, key=lambda a: tuple(int(p) for p in a.split(".")))
        devices.append(_dev("router", router, rpos[0], rpos[1], interfaces=interfaces[router], rip=rip))
    return {"name": "Three routers with RIP dynamic routing", "devices": devices, "links": links}


# ------------------------------------------------------------------------------------------------ running
def make_network(spec, converge=True):
    network = build(spec)
    if converge and any(d["type"] == "router" for d in spec["devices"]):
        network.converge()
    return network


def apply_action(network, action):
    """One studio/recipe action against a live network. Returns a result dict or None."""
    kind = action["type"]
    if kind == "ping":
        return network.ping(action["from"], action["to"], seq=action.get("seq", 1))
    if kind == "link":
        network.set_link(action["a"], action["b"], bool(action["up"]))
        network.converge()
        return None
    raise KeyError("Unknown action %r" % kind)


def tables(network):
    return {"routing": {name: {"table": device.table(), "show": device.show_ip_route()} for name, device in network.devices.items()
                        if device.type == "router"},
            "arp": network.arp_tables(), "mac": network.switch_tables()}


def replay(spec, actions):
    """Replay a list of actions from scratch (the studio keeps no server state) and return each result with the final tables.

    The spec and actions come from the browser, so anything malformed is reported as a TopologyError, never as a crash.
    """
    try:
        problems = pkttracer.validate(spec)
        if problems:
            raise pkttracer.TopologyError(" ".join(problems))
        network = make_network(spec)
        results = []
        for action in actions[:60]:
            result = apply_action(network, action)
            if result is not None:
                results.append(result)
        return {"results": results, "snapshot": network.snapshot(), **tables(network)}
    except pkttracer.TopologyError:
        raise
    except (KeyError, TypeError, AttributeError, ValueError, IndexError, StopIteration) as error:
        raise pkttracer.TopologyError("The topology or an action is not valid (%s)." % type(error).__name__) from None


# ------------------------------------------------------------------------------------------------ observations
def _flow(result):
    """Who received, accepted or discarded each kind of frame in one ping, read from its events."""
    flow = {"arp_needed": False, "arp_request": {"accepted": [], "discarded": []}, "arp_reply": {"accepted": [], "discarded": []},
            "echo_request": {"accepted": [], "discarded": []}, "echo_reply": {"accepted": [], "discarded": []}, "hubs": [], "switches": []}
    for event in result["events"]:
        info = event["info"]
        bucket = None
        if event["type"] == "ARP":
            bucket = flow["arp_request"] if info.startswith("Who has") else flow["arp_reply"]
            if event["action"] == "created":
                if info.startswith("Who has"):
                    flow["arp_needed"] = True
                continue
        elif event["type"] == "ICMP":
            bucket = flow["echo_request"] if info.startswith("Echo request") else flow["echo_reply"] if info.startswith("Echo reply") else None
        if bucket is not None and event["action"] in bucket:
            bucket[event["action"]].append(event["at"])
        if event["at"].startswith("Hub") and event["at"] not in flow["hubs"]:
            flow["hubs"].append(event["at"])
        if event["at"].startswith("Switch") and event["at"] not in flow["switches"]:
            flow["switches"].append(event["at"])
    return flow


def _names(names):
    names = list(dict.fromkeys(names))
    return "nobody" if not names else names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def observe_hub(result):
    """What the hub did with one ping (scenarios 1 and 3)."""
    flow = _flow(result)
    src, dst = result["source"], result["destination"]
    hubs = _names(flow["hubs"]) or "the hub"
    target = next((e["at"] for e in result["events"] if e["type"] == "ICMP" and e["action"] == "accepted" and e["info"].startswith("Echo request")), "the target")
    parts = []
    if flow["arp_needed"]:
        who = flow["arp_request"]
        parts.append("%s did not know the MAC address of %s, so it broadcast an ARP request. %s repeated the request out of every other port: it was "
                     "accepted by %s%s." % (src, dst, hubs, _names(who["accepted"]),
                                           " and discarded by %s because the request was for another address" % _names(who["discarded"]) if who["discarded"] else ""))
        reply = flow["arp_reply"]
        parts.append("%s answered %s directly (a unicast ARP reply), but the hub has no address table, so it repeated the reply to %s as well%s." % (
            target, src, _names(reply["accepted"] + reply["discarded"]),
            " (%s discarded it)" % _names(reply["discarded"]) if reply["discarded"] else ""))
    else:
        parts.append("No ARP packet was sent: %s already held the MAC address of %s in its ARP cache, so the ICMP echo request went out at once." % (src, dst))
    echo = flow["echo_request"]
    if echo["discarded"]:
        parts.append("The hub also repeated the echo request and the echo reply to %s, which discarded both because they were not addressed to it." % _names(echo["discarded"]))
    return " ".join(parts)


def observe_switch(result, mac_table):
    """What the switch did with one ping (scenario 2)."""
    flow = _flow(result)
    src, dst = result["source"], result["destination"]
    switch = _names(flow["switches"]) or "the switch"
    parts = []
    if flow["arp_needed"]:
        who = flow["arp_request"]
        parts.append("%s sent an ARP request (a broadcast) for %s. %s did not know the destination, so it flooded the request out of every other port: it was "
                     "accepted by %s%s." % (src, dst, switch, _names(who["accepted"]),
                                           " and discarded by %s" % _names(who["discarded"]) if who["discarded"] else ""))
        reply = flow["arp_reply"]
        parts.append("The ARP reply was forwarded only to %s: %s had learned the sender's address from the request, so the reply was not flooded%s." % (
            _names(reply["accepted"]), switch, "" if not reply["discarded"] else " (but %s also saw it)" % _names(reply["discarded"])))
    else:
        parts.append("No ARP packet was needed because %s already knew the MAC address of %s." % (src, dst))
    echo = flow["echo_request"]
    parts.append("The ICMP echo request and reply were unicast: %s forwarded the request only to %s%s, because it had already learned that address." % (
        switch, _names(echo["accepted"]), "" if not echo["discarded"] else " but also flooded %s" % _names(echo["discarded"])))
    return " ".join(parts)


def _mac_table_text(network, switch="Switch0"):
    by_port = {}
    for mac, port in sorted(network.switch_tables().get(switch, {}).items(), key=lambda kv: kv[1]):
        owner = next((name for name, device in network.devices.items() if device.type in {"pc", "router"} and
                      any(p.mac == mac for p in device.ports.values())), mac)
        by_port[port] = owner
    return "; ".join("%s is on %s" % (owner, port) for port, owner in by_port.items()) or "empty"


def _snapshot_frame(network, spec):
    return {"links": [{"a": l.a.device.name, "b": l.b.device.name, "color": l.color, "blocked": l.a.stp_blocking or l.b.stp_blocking}
                      for l in network.links], "blocked": [p.label() for d in network.devices.values() for p in d.ports.values() if p.stp_blocking]}


def _pdu(result):
    return {"pdu": result["pdu"], "source": result["source"], "destination": result["destination"],
            "status": "Successful" if result["success"] else "Failed"}


def _frame(frame_id, title, view, explain, network, spec, events=(), filters=("ARP", "ICMP"), pdus=(), **extra):
    return {"id": frame_id, "title": title, "view": view, "explain": explain, "filter": list(filters), "events": list(events),
            "pdus": list(pdus), "topology": _snapshot_frame(network, spec), **extra}


def ip_table(spec):
    return {"headers": ["Device", "IP Address", "Subnet Mask"],
            "rows": [[d["name"], d["ip"], d["mask"]] for d in spec["devices"] if d["type"] == "pc"]}


def run_exp7(scenario):
    """The scripted run of one Exp 7 scenario: frames (for the studio), observations (for the report) and the IP table."""
    spec = exp7_spec(scenario)
    network = make_network(spec)
    pcs = [d["name"] for d in spec["devices"] if d["type"] == "pc"]
    ip = {d["name"]: d["ip"] for d in spec["devices"] if d["type"] == "pc"}
    frames, observations, pdus, events, fresh = [], [], [], [], []
    title = spec["name"]

    def take():
        """The events since the previous screenshot: each frame lists the pings it shows, the PDU list keeps them all."""
        out = list(fresh)
        fresh.clear()
        return out

    def topology_frame():
        links = ", ".join("%s - %s (%s cable, %s)" % (l.a.device.name, l.b.device.name, "straight-through" if l.cable == "straight" else "crossover", l.color)
                          for l in network.links)
        frames.append(_frame("topology", "%s: topology" % title, "workspace",
                             "The devices placed and cabled as required: %s. All link lights are green, so every connection and address is correct." % links,
                             network, spec))

    def ping(src, dst_name, label, comment):
        result = network.ping(src, ip[dst_name])
        pdus.append(_pdu(result))
        events.extend({**e, "pdu": result["pdu"]} for e in result["events"])
        fresh.extend({**e, "pdu": result["pdu"]} for e in result["events"])
        return result

    topology_frame()
    if scenario == 1:
        a, b = pcs[0], pcs[1]
        ra = ping(a, b, "a", "")
        text_a = observe_hub(ra)
        frames.append(_frame("ping_a", "Scenario 1 (a): ping %s to %s, ARP filter" % (a, b), "simulation",
                             "Simulation mode with only ARP enabled in the Event List Filters; Simple PDU from %s to %s played with Capture/Forward. %s" % (a, b, text_a),
                             network, spec, take(), ("ARP",), list(pdus)))
        rb = ping(b, a, "b", "")
        text_b = observe_hub(rb)
        frames.append(_frame("ping_b", "Scenario 1 (b): ping %s to %s, ARP filter" % (b, a), "simulation",
                             "A second Simple PDU, from %s to %s. %s" % (b, a, text_b), network, spec, take(), ("ARP",), list(pdus)))
        c = pcs[2]
        rc1 = ping(c, a, "c1", "")
        rc2 = ping(b, a, "c2", "")
        text_c1, text_c2 = observe_hub(rc1), observe_hub(rc2)
        frames.append(_frame("ping_c", "Scenario 1 (c): pings %s to %s and %s to %s, ARP filter" % (c, a, b, a), "simulation",
                             "Simple PDUs from %s to %s and from %s to %s. Ping from %s to %s: %s Ping from %s to %s: %s" % (c, a, b, a, c, a, text_c1, b, a, text_c2), network, spec, take(), ("ARP",), list(pdus)))
        observations += [
            "Comment on the ARP in case a) and b): " + _compare_ab(ra, rb, a, b),
            "Difference in the ARP packets in case b) and case a): " + _compare_c(rc1, rc2, rb, ra, a, b, c),
        ]
    elif scenario == 2:
        p3, p4, p5 = pcs
        r1 = ping(p3, p4, "1", "")
        frames.append(_frame("ping_1", "Scenario 2: ping %s to %s" % (p3, p4), "simulation",
                             "ICMP and ARP enabled in the Event List Filters; Simple PDU from %s to %s. %s" % (p3, p4, observe_switch(r1, {})),
                             network, spec, take(), ("ARP", "ICMP"), list(pdus), mac_table=_mac_table_text(network)))
        r2 = ping(p4, p5, "2", "")
        frames.append(_frame("ping_2", "Scenario 2: ping %s to %s" % (p4, p5), "simulation",
                             "Next, a Simple PDU from %s to %s. %s" % (p4, p5, observe_switch(r2, {})),
                             network, spec, take(), ("ARP", "ICMP"), list(pdus), mac_table=_mac_table_text(network)))
        r3 = ping(p4, p3, "3", "")
        frames.append(_frame("ping_3", "Scenario 2: ping %s to %s again" % (p4, p3), "simulation",
                             "Finally a Simple PDU from %s to %s. %s" % (p4, p3, observe_switch(r3, {})),
                             network, spec, take(), ("ARP", "ICMP"), list(pdus), mac_table=_mac_table_text(network)))
        observations.append("How the switch's behaviour changed: in the first two pings the switch had not yet learned the destination, so it flooded the ARP "
                            "request to every port; in the third ping %s and %s knew each other, so there was no ARP request and the switch forwarded the "
                            "echo request out of one port only. Switch address table at the end: %s." % (p4, p3, _mac_table_text(network)))
    elif scenario == 3:
        p0, p1, p2 = pcs
        r1 = ping(p0, p1, "1", "")
        frames.append(_frame("ping_1", "Scenario 3: ping %s to %s" % (p0, p1), "simulation",
                             "ICMP and ARP enabled in the Event List Filters; Simple PDU from %s to %s through the hubs. %s" % (p0, p1, observe_hub(r1)),
                             network, spec, take(), ("ARP", "ICMP"), list(pdus)))
        r2 = ping(p1, p2, "2", "")
        frames.append(_frame("ping_2", "Scenario 3: ping %s to %s" % (p1, p2), "simulation",
                             "Simple PDU from %s to %s. %s" % (p1, p2, observe_hub(r2)), network, spec, take(), ("ARP", "ICMP"), list(pdus)))
        r3 = ping(p2, p0, "3", "")
        frames.append(_frame("ping_3", "Scenario 3: ping %s to %s" % (p2, p0), "simulation",
                             "Simple PDU from %s to %s. %s" % (p2, p0, observe_hub(r3)), network, spec, take(), ("ARP", "ICMP"), list(pdus)))
        runs = []
        for result in (r1, r2, r3):
            flow = _flow(result)
            runs.append("ping from %s to %s: %s; the echo request was accepted by %s and discarded by %s" % (
                result["source"], result["destination"],
                "ARP was needed (request broadcast, reply returned)" if flow["arp_needed"] else "no ARP was needed (the address was already cached)",
                _names(flow["echo_request"]["accepted"]), _names(flow["echo_request"]["discarded"])))
        observations.append("How the hubs behaved: a hub repeats every frame it receives out of all its other ports, so each frame crossed the whole chain of "
                            "hubs and reached every computer, whichever one it was meant for; the computers that were not the destination discarded it. "
                            + ("; ".join(runs))[0].upper() + ("; ".join(runs))[1:] + ".")
    else:                                                                  # mesh
        r1 = ping("PC0", "PC3", "1", "")
        r2 = ping("PC1", "PC3", "2", "")
        blocked = _snapshot_frame(network, spec)["blocked"]
        frames.append(_frame("ping_mesh", "Mesh: ping PC0 to PC3 and PC1 to PC3", "simulation",
                             "The three switches are cabled in a full mesh. Spanning tree has blocked %s so frames do not circulate forever; PC1 and PC2 share Hub0, "
                             "so a frame from PC1 is repeated to PC2 as well as to the switch. Both Simple PDUs were %s." % (
                                 _names(blocked), "successful" if r1["success"] and r2["success"] else "not all successful"),
                             network, spec, take(), ("ARP", "ICMP"), list(pdus)))
        observations.append("Mesh topology: three switches are connected to each other (a full mesh) and a hub shares one segment between PC1 and PC2. Spanning "
                            "tree blocked %s, leaving a loop-free path between every pair of switches; the other cables stay as standby links. Pings across the mesh succeeded." % _names(blocked))
    return {"scenario": scenario, "title": title, "spec": spec, "ip_table": ip_table(spec), "frames": frames, "observations": observations,
            "pdus": pdus, "events": events, "tables": tables(network)}


def _arp_count(result):
    return sum(1 for e in result["events"] if e["type"] == "ARP" and e["action"] in {"accepted", "discarded"})


def _compare_ab(ra, rb, a, b):
    if _flow(ra)["arp_needed"] and not _flow(rb)["arp_needed"]:
        return ("in a) %s had to find the MAC address of %s, so an ARP request was broadcast and an ARP reply came back (%d ARP frames were delivered, "
                "the hub repeating each of them to the third computer too). In b) no ARP packet appears at all: while answering, %s stored the address of %s "
                "in its ARP cache, so it could send the ICMP echo request immediately." % (a, b, _arp_count(ra), b, a))
    return "ARP frames delivered in a): %d; in b): %d." % (_arp_count(ra), _arp_count(rb))


def _compare_c(rc1, rc2, rb, ra, a, b, c):
    first, second = _flow(rc1)["arp_needed"], _flow(rc2)["arp_needed"]
    if first and not second:
        return ("a ping from %s to %s needed ARP again (a request broadcast and a reply, like case a), because %s had only overheard the earlier request "
                "and a computer does not add an entry for a request that is not addressed to it. A repeated ping from %s to %s, which already has %s's address, "
                "needed no ARP at all, like case b)." % (c, a, c, b, a, a))
    return "ARP needed for the ping from %s: %s; from %s: %s." % (c, "yes" if first else "no", b, "yes" if second else "no")


# ------------------------------------------------------------------------------------------------ Experiment 9 run
def config_tables(spec):
    """The manual's configuration table: per router the interfaces with address and subnet, and the networks RIP advertises."""
    rows = []
    for number, router in enumerate((d for d in spec["devices"] if d["type"] == "router"), 1):
        lines = []
        for interface, config in router["interfaces"].items():
            lines.append("Interface: %s; IP address: %s; Subnet mask: %s" % (interface, config["ip"], config["mask"]))
        rows.append([str(number), "Generic %s" % router["name"].replace("Router", "Router "), "\n".join(lines),
                     "RIP network addresses: " + ", ".join(router["rip"])])
    hosts = [[d["name"], d["ip"], d["mask"], d["gateway"]] for d in spec["devices"] if d["type"] == "pc"]
    return {"routers": {"headers": ["Sr. No.", "Network Device", "Configuration (interface, IP address, subnet mask)", "Dynamic Routing Table"], "rows": rows},
            "hosts": {"headers": ["End device", "IP address", "Subnet mask", "Default gateway"], "rows": hosts}}


def run_exp9():
    spec = exp9_spec()
    network = make_network(spec)
    frames, observations = [], []
    snap = lambda: _snapshot_frame(network, spec)
    for router in ("Router0", "Router1", "Router2"):
        device = network.devices[router]
        frames.append({"id": "routes_" + router, "title": "Routing table of %s (RIP converged)" % router, "view": "routing", "router": router,
                       "lines": device.show_ip_route(), "table": device.table(), "topology": snap(), "events": [], "pdus": [], "filter": [],
                       "explain": "The routing table of %s after RIP converged: entries marked C are the directly connected networks and entries marked R were "
                                  "learned dynamically from the neighbouring routers (administrative distance 120, metric = hop count)." % router})
    frames.insert(0, {"id": "topology", "title": "Network of three routers", "view": "workspace", "topology": snap(), "events": [], "pdus": [], "filter": [],
                      "explain": "Three routers are connected in a triangle and each has a switch with one computer on its LAN. Every link light is green, "
                                 "every interface has its address and RIP is enabled with the networks each router is attached to."})
    pdus = []
    events = []
    r1 = network.ping("PC0", "192.168.2.2")
    pdus.append(_pdu(r1))
    events += r1["events"]
    frames.append(_frame("ping_before", "Simple PDU from PC0 to PC1 (before the failure)", "simulation",
                         "A Simple PDU from PC0 (192.168.1.2) to PC1 (192.168.2.2), which is on another network. The packet followed %s and the PDU list shows "
                         "Successful, so routing between the networks works. Each router decremented the TTL and used its RIP-learned table." % " > ".join(r1["l3_path"]),
                         network, spec, list(r1["events"]), ("ICMP",), list(pdus), path=r1["l3_path"]))
    r1b = network.ping("PC0", "192.168.3.2")
    pdus.append(_pdu(r1b))
    events += r1b["events"]
    frames.append(_frame("ping_pc2", "Simple PDU from PC0 to PC2", "simulation",
                         "A second Simple PDU from PC0 to PC2 (192.168.3.2) crossed %s and was Successful." % " > ".join(r1b["l3_path"]),
                         network, spec, list(r1b["events"]), ("ICMP",), list(pdus), path=r1b["l3_path"]))
    # Post-experimental exercise: disable the Router0 - Router1 link
    network.set_link("Router0", "Router1", False)
    network.converge()
    frames.append({"id": "link_down", "title": "Link between Router0 and Router1 disabled", "view": "workspace", "topology": snap(), "events": [], "pdus": [], "filter": [],
                   "explain": "The cable between Router0 (FastEthernet1/0) and Router1 (FastEthernet1/0) was disabled; its link light is red. RIP detected the "
                              "failure and the routers recalculated their tables."})
    device = network.devices["Router0"]
    detour = next(r for r in device.table() if r["network"] == "192.168.2.0/24")
    frames.append({"id": "routes_after", "title": "Routing table of Router0 after the failure", "view": "routing", "router": "Router0", "lines": device.show_ip_route(),
                   "table": device.table(), "topology": snap(), "events": [], "pdus": [], "filter": [],
                   "explain": "Router0's table no longer contains the directly connected 192.168.12.0 network. The network behind Router1 (192.168.2.0) is now "
                              "reached through Router2 (next hop %s, interface %s) with metric %d instead of 1." % (detour["next_hop"], detour["interface"], detour["metric"])})
    r2 = network.ping("PC0", "192.168.2.2")
    pdus.append(_pdu(r2))
    events += r2["events"]
    frames.append(_frame("ping_after", "Simple PDU from PC0 to PC1 (after the failure)", "simulation",
                         "The same Simple PDU after the failure. The packet now travelled %s, the longer path through Router2, and the PDU is %s." % (
                             " > ".join(r2["l3_path"]), "Successful" if r2["success"] else "Failed"),
                         network, spec, list(r2["events"]), ("ICMP",), list(pdus), path=r2["l3_path"]))
    observations.append("Path before the failure: %s. After disabling the Router0-Router1 link the network chose %s because RIP removed the direct route and "
                        "learned the route via Router2." % (" > ".join(r1["l3_path"]), " > ".join(r2["l3_path"])))
    return {"title": spec["name"], "spec": spec, "config": config_tables(spec), "frames": frames, "observations": observations, "pdus": pdus, "events": events,
            "path_before": r1["l3_path"], "path_after": r2["l3_path"], "tables": tables(network)}
