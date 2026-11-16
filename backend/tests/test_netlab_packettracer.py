"""Packet Tracer engine: cabling, hub and switch behaviour, ARP rules, routing, RIP convergence and failover, and the experiments' runs."""
import pytest

from app.netlab import pt_lab
from app.netlab.pkttracer import Network, TopologyError, validate


def lan(kind, names, ips):
    network = Network()
    for name, ip in zip(names, ips):
        network.add("pc", name).configure(ip, "255.255.255.0")
    network.add(kind, "Core0")
    prefix = "Port %d" if kind == "hub" else "FastEthernet0/%d"
    for index, name in enumerate(names, 0 if kind == "hub" else 1):
        network.connect(name, "FastEthernet0", "Core0", prefix % index)
    return network


def deliveries(result, kind, action, startswith=""):
    return [e["at"] for e in result["events"] if e["type"] == kind and e["action"] == action and e["info"].startswith(startswith)]


# ------------------------------------------------------------------------------------------------ cables
def test_cable_types_decide_the_link_light():
    network = Network()
    network.add("pc", "PC0").configure("10.0.0.1", "255.255.255.0")
    network.add("pc", "PC1").configure("10.0.0.2", "255.255.255.0")
    network.add("hub", "Hub0")
    network.add("hub", "Hub1")
    network.add("switch", "Switch0")
    assert network.connect("PC0", "FastEthernet0", "Hub0", "Port 0").color == "green"              # unlike devices: straight-through
    assert network.connect("PC1", "FastEthernet0", "Switch0", "FastEthernet0/1", cable="cross").color == "red"   # wrong cable
    assert network.connect("Hub0", "Port 1", "Hub1", "Port 0").cable == "cross"                    # like devices need a crossover
    assert network.connect("Hub1", "Port 1", "Switch0", "FastEthernet0/2", cable="straight").color == "red"
    assert network.ping("PC1", "10.0.0.1")["success"] is False                                    # a red link carries nothing


def test_a_port_can_hold_one_cable_only():
    network = lan("hub", ["PC0", "PC1"], ["10.0.0.1", "10.0.0.2"])
    network.add("pc", "PC9")
    with pytest.raises(TopologyError):
        network.connect("PC9", "FastEthernet0", "Core0", "Port 0")


# ------------------------------------------------------------------------------------------------ hub and ARP rules
def test_hub_repeats_every_frame_to_every_other_port():
    network = lan("hub", ["PC0", "PC1", "PC2"], ["192.168.3.1", "192.168.3.2", "192.168.3.3"])
    first = network.ping("PC0", "192.168.3.2")
    assert first["success"] and first["l3_path"] == ["PC0", "PC1"] and first["path"] == ["PC0", "Core0", "PC1"]
    assert deliveries(first, "ARP", "accepted", "Who has") == ["PC1"] and deliveries(first, "ARP", "discarded", "Who has") == ["PC2"]
    # the unicast ARP reply and both ICMP packets are repeated to PC2 too, because a hub has no address table
    assert deliveries(first, "ARP", "discarded", "192.168.3.2 is at") == ["PC2"]
    assert sorted(deliveries(first, "ICMP", "discarded")) == ["PC2", "PC2"]


def test_arp_cache_rules_follow_rfc_826():
    network = lan("hub", ["PC0", "PC1", "PC2"], ["192.168.3.1", "192.168.3.2", "192.168.3.3"])
    a = network.ping("PC0", "192.168.3.2")
    assert any(e["type"] == "ARP" for e in a["events"])
    b = network.ping("PC1", "192.168.3.1")                       # PC1 learned PC0's address from PC0's request (it was the target)
    assert not any(e["type"] == "ARP" for e in b["events"]) and b["success"]
    arp = network.arp_tables()
    assert "192.168.3.1" not in arp["PC2"], "PC2 only overheard the request; it was not the target, so it creates no entry"
    c = network.ping("PC2", "192.168.3.1")
    assert any(e["type"] == "ARP" and e["info"].startswith("Who has 192.168.3.1") and e["action"] == "created" for e in c["events"])
    assert arp["PC0"]["192.168.3.2"] == network.devices["PC1"].nic.mac


def test_ping_to_a_missing_host_fails_after_the_arp_timeout():
    network = lan("switch", ["PC0", "PC1"], ["192.168.3.1", "192.168.3.2"])
    result = network.ping("PC0", "192.168.3.99")
    assert result["success"] is False and result["error"] == "no arp reply"
    assert any("No ARP reply from 192.168.3.99" in e["info"] for e in result["events"])


def test_pc_without_a_gateway_cannot_leave_its_network():
    network = lan("switch", ["PC0", "PC1"], ["192.168.3.1", "192.168.3.2"])
    result = network.ping("PC0", "8.8.8.8")
    assert result["success"] is False and result["error"] == "no route"


# ------------------------------------------------------------------------------------------------ switch
def test_switch_learns_and_stops_flooding():
    network = lan("switch", ["PC3", "PC4", "PC5"], ["192.168.3.1", "192.168.3.2", "192.168.3.3"])
    one = network.ping("PC3", "192.168.3.2")
    assert deliveries(one, "ARP", "accepted", "Who has") == ["PC4"] and deliveries(one, "ARP", "discarded", "Who has") == ["PC5"]
    assert deliveries(one, "ARP", "discarded", "192.168.3.2 is at") == [], "the reply is unicast to the learned port only"
    assert deliveries(one, "ICMP", "discarded") == []
    assert network.switch_tables()["Core0"][network.devices["PC3"].nic.mac] == "FastEthernet0/1"
    network.ping("PC4", "192.168.3.3")
    three = network.ping("PC4", "192.168.3.1")
    assert not any(e["type"] == "ARP" for e in three["events"])
    assert [e["at"] for e in three["events"] if e["type"] == "ICMP" and e["action"] == "accepted"] == ["PC3", "PC4"]
    assert deliveries(three, "ICMP", "discarded") == []


def test_switch_floods_unknown_destinations_and_broadcasts_only():
    network = lan("switch", ["PC0", "PC1", "PC2"], ["10.0.0.1", "10.0.0.2", "10.0.0.3"])
    network.devices["PC0"].arp["10.0.0.2"] = network.devices["PC1"].nic.mac           # skip ARP: the switch has learned nothing yet
    result = network.ping("PC0", "10.0.0.2")
    assert sorted(deliveries(result, "ICMP", "discarded")) == ["PC2"], "an unknown unicast is flooded like a broadcast"
    again = network.ping("PC0", "10.0.0.2")
    assert deliveries(again, "ICMP", "discarded") == [], "after the reply the switch knows both ports"


# ------------------------------------------------------------------------------------------------ loops
def test_spanning_tree_blocks_the_redundant_switch_link():
    result = pt_lab.run_exp7("mesh")
    assert all(p["status"] == "Successful" for p in result["pdus"])
    blocked = [frame["topology"]["blocked"] for frame in result["frames"] if frame["id"] == "ping_mesh"][0]
    assert len(blocked) == 1 and blocked[0].startswith("Switch")


def test_a_loop_of_hubs_is_reported_not_run_forever():
    network = Network()
    network.add("pc", "PC0").configure("10.0.0.1", "255.255.255.0")
    network.add("pc", "PC1").configure("10.0.0.2", "255.255.255.0")
    for name in ("HubA", "HubB", "HubC"):
        network.add("hub", name)
    network.connect("PC0", "FastEthernet0", "HubA", "Port 0")
    network.connect("PC1", "FastEthernet0", "HubB", "Port 0")
    network.connect("HubA", "Port 1", "HubB", "Port 1")
    network.connect("HubB", "Port 2", "HubC", "Port 0")
    network.connect("HubC", "Port 1", "HubA", "Port 2")
    with pytest.raises(TopologyError, match="broadcast storm"):
        network.ping("PC0", "10.0.0.2")


# ------------------------------------------------------------------------------------------------ routing and RIP
@pytest.fixture()
def triangle():
    return pt_lab.make_network(pt_lab.exp9_spec())


def table(network, router):
    return {(r["code"], r["network"]): (r["metric"], r["next_hop"], r["interface"]) for r in network.routing_tables()[router]}


def test_rip_learns_every_network_with_hop_count_metrics(triangle):
    assert table(triangle, "Router0") == {
        ("C", "192.168.1.0/24"): (0, "", "FastEthernet0/0"),
        ("C", "192.168.12.0/24"): (0, "", "FastEthernet1/0"),
        ("C", "192.168.13.0/24"): (0, "", "FastEthernet2/0"),
        ("R", "192.168.2.0/24"): (1, "192.168.12.2", "FastEthernet1/0"),
        ("R", "192.168.3.0/24"): (1, "192.168.13.2", "FastEthernet2/0"),
        ("R", "192.168.23.0/24"): (1, "192.168.12.2", "FastEthernet1/0"),
    }
    for router in ("Router0", "Router1", "Router2"):
        assert len(table(triangle, router)) == 6
    show = "\n".join(triangle.devices["Router1"].show_ip_route())
    assert "R    192.168.1.0/24 [120/1] via 192.168.12.1" in show and "C    192.168.2.0/24 is directly connected, FastEthernet0/0" in show


def test_ping_across_routers_follows_the_table_and_decrements_ttl(triangle):
    result = triangle.ping("PC0", "192.168.2.2")
    assert result["success"] and result["l3_path"] == ["PC0", "Router0", "Router1", "PC1"]
    request_ttls = [int(e["info"].rsplit("ttl=", 1)[1]) for e in result["events"] if e["info"].startswith("Echo request") and e["action"] in {"forwarded", "accepted"}
                    and e["at"] in {"Router0", "Router1", "PC1"}]
    assert request_ttls == [128, 127, 126]
    assert result["reply_from"] == "192.168.2.2"


def test_routers_resolve_each_next_hop_with_arp(triangle):
    result = triangle.ping("PC0", "192.168.2.2")
    created = [(e["at"], e["info"]) for e in result["events"] if e["type"] == "ARP" and e["action"] == "created" and e["info"].startswith("Who has")]
    assert created == [("PC0", "Who has 192.168.1.1? Tell 192.168.1.2"), ("Router0", "Who has 192.168.12.2? Tell 192.168.12.1"),
                       ("Router1", "Who has 192.168.2.2? Tell 192.168.2.1")]
    second = triangle.ping("PC0", "192.168.2.2")
    assert not any(e["type"] == "ARP" for e in second["events"]), "every hop is cached now"


def test_disabled_link_is_routed_around(triangle):
    before = triangle.ping("PC0", "192.168.2.2")
    triangle.set_link("Router0", "Router1", False)
    triangle.converge()
    assert triangle.link_between("Router0", "Router1").color == "red"
    after = triangle.ping("PC0", "192.168.2.2")
    assert before["l3_path"] == ["PC0", "Router0", "Router1", "PC1"]
    assert after["success"] and after["l3_path"] == ["PC0", "Router0", "Router2", "Router1", "PC1"]
    t0 = table(triangle, "Router0")
    assert ("C", "192.168.12.0/24") not in t0 and not any(key[1] == "192.168.12.0/24" for key in t0)
    assert t0[("R", "192.168.2.0/24")] == (2, "192.168.13.2", "FastEthernet2/0")
    assert t0[("R", "192.168.3.0/24")] == (1, "192.168.13.2", "FastEthernet2/0")
    t2 = table(triangle, "Router2")
    assert not any(key[1] == "192.168.12.0/24" for key in t2), "the neighbours dropped the dead network (route poisoning)"
    request_ttls = [int(e["info"].rsplit("ttl=", 1)[1]) for e in after["events"] if e["info"].startswith("Echo request") and e["at"] == "PC1"]
    assert request_ttls == [125]


def test_the_link_can_come_back(triangle):
    triangle.set_link("Router0", "Router1", False)
    triangle.converge()
    triangle.set_link("Router0", "Router1", True)
    triangle.converge()
    result = triangle.ping("PC0", "192.168.2.2")
    assert result["success"] and result["l3_path"] == ["PC0", "Router0", "Router1", "PC1"]
    assert table(triangle, "Router0")[("R", "192.168.2.0/24")][0] == 1


def test_a_ping_to_an_unknown_network_gets_destination_unreachable(triangle):
    result = triangle.ping("PC0", "172.16.5.5")
    assert result["success"] is False and result["error"] == "net-unreachable" and result["reply_from"] == "192.168.1.1"


def test_split_horizon_never_advertises_a_route_back_to_its_source(triangle):
    captured = []
    original = triangle.transmit

    def spy(device, port, frame, action):
        if device.type == "router" and getattr(frame.payload, "protocol", "") == "RIP":
            captured.append((device.name, port.name, frame.payload.data.entries))
        original(device, port, frame, action)
    triangle.transmit = spy
    triangle.run(until=triangle.now + 31)
    assert captured
    for name, interface, entries in captured:
        learned_here = {r["network"] for r in triangle.routing_tables()[name] if r["code"] == "R" and r["interface"] == interface}
        advertised = {"%s/24" % n for n, _m, _metric in entries}
        assert not learned_here & advertised, (name, interface)


def test_rip_stops_at_16_hops():
    network = Network()
    names = ["R%d" % i for i in range(18)]
    for name in names:
        network.add("router", name)
    for i in range(17):
        a, b = network.devices[names[i]], network.devices[names[i + 1]]
        a.configure("FastEthernet1/0", "10.%d.0.1" % i, "255.255.255.0")
        b.configure("FastEthernet0/0", "10.%d.0.2" % i, "255.255.255.0")
        network.connect(names[i], "FastEthernet1/0", names[i + 1], "FastEthernet0/0")
    for name in names:
        network.devices[name].enable_rip(["10.%d.0.0" % i for i in range(17)])
    network.converge(600)
    metrics = [r["metric"] for r in network.routing_tables()["R0"] if r["code"] == "R"]
    assert max(metrics) == 15 and "10.16.0.0/24" not in {r["network"] for r in network.routing_tables()["R0"]}


# ------------------------------------------------------------------------------------------------ validation
def test_validate_reports_what_would_not_work():
    spec = {"devices": [{"type": "pc", "name": "PC0", "ip": "10.0.0.1", "mask": "255.255.255.0", "gateway": "10.0.1.1"},
                        {"type": "pc", "name": "PC1", "ip": "10.0.0.1", "mask": "255.255.255.0"},
                        {"type": "pc", "name": "PC1", "ip": "bad", "mask": "255.255.255.0"},
                        {"type": "toaster", "name": "T0"}],
            "links": [{"a": "PC0", "ap": "FastEthernet0", "b": "Nope", "bp": "x"}]}
    problems = " | ".join(validate(spec))
    for expected in ("outside its network", "share the address 10.0.0.1", "used twice", "invalid address", "unknown device type", "unknown device Nope"):
        assert expected in problems, expected
    assert validate(pt_lab.exp9_spec()) == [] and all(validate(pt_lab.exp7_spec(s)) == [] for s in (1, 2, 3, "mesh"))


# ------------------------------------------------------------------------------------------------ the experiments' runs
def test_exp7_scenario1_observations_state_what_happened():
    result = pt_lab.run_exp7(1)
    assert [f["id"] for f in result["frames"]] == ["topology", "ping_a", "ping_b", "ping_c"]
    a, b = result["observations"]
    assert "broadcast" in a and "no ARP packet appears at all" in a and "4 ARP frames" in a
    assert "PC2" in b and "needed ARP again" in b and "needed no ARP at all" in b
    assert [p["status"] for p in result["pdus"]] == ["Successful"] * 4
    assert [p["source"] for p in result["pdus"]] == ["PC0", "PC1", "PC2", "PC1"]
    assert result["ip_table"]["rows"][0] == ["PC0", "192.168.3.1", "255.255.255.0"]
    for frame in result["frames"][1:]:
        assert frame["filter"] == ["ARP"]


def test_exp7_scenario2_switch_stops_flooding_on_the_third_ping():
    result = pt_lab.run_exp7(2)
    first, second, third = [f["explain"] for f in result["frames"][1:]]
    assert "flooded the request" in first and "flooded the request" in second
    assert "No ARP packet was needed" in third and "forwarded the request only to PC3" in third
    assert "PC3 is on FastEthernet0/1; PC4 is on FastEthernet0/2; PC5 is on FastEthernet0/3" in result["observations"][0]


def test_exp7_scenario3_crosses_the_chain_of_hubs():
    result = pt_lab.run_exp7(3)
    assert [f["id"] for f in result["frames"]] == ["topology", "ping_1", "ping_2", "ping_3"]
    assert "crossover" in result["frames"][0]["explain"]
    assert all(p["status"] == "Successful" for p in result["pdus"])
    assert "Hub0" in result["frames"][1]["explain"] and "Hub2" in result["frames"][1]["explain"]


def test_exp9_run_shows_the_path_before_and_after_the_failure():
    result = pt_lab.run_exp9()
    assert result["path_before"] == ["PC0", "Router0", "Router1", "PC1"]
    assert result["path_after"] == ["PC0", "Router0", "Router2", "Router1", "PC1"]
    assert [f["id"] for f in result["frames"]] == ["topology", "routes_Router0", "routes_Router1", "routes_Router2", "ping_before", "ping_pc2",
                                                  "link_down", "routes_after", "ping_after"]
    assert [p["status"] for p in result["pdus"]] == ["Successful"] * 3
    rows = result["config"]["routers"]["rows"]
    assert len(rows) == 3 and "RIP network addresses: 192.168.1.0, 192.168.12.0, 192.168.13.0" in rows[0][3]
    after = next(f for f in result["frames"] if f["id"] == "routes_after")
    assert not any("192.168.12.0" in line for line in after["lines"])
    assert "next hop 192.168.13.2" in after["explain"] and "metric 2" in after["explain"]


def test_replay_is_stateless_and_deterministic():
    spec = pt_lab.exp9_spec()
    actions = [{"type": "ping", "from": "PC0", "to": "192.168.2.2"}, {"type": "link", "a": "Router0", "b": "Router1", "up": False},
               {"type": "ping", "from": "PC0", "to": "192.168.2.2"}]
    one, two = pt_lab.replay(spec, actions), pt_lab.replay(spec, actions)
    assert one == two
    assert [r["l3_path"] for r in one["results"]] == [["PC0", "Router0", "Router1", "PC1"], ["PC0", "Router0", "Router2", "Router1", "PC1"]]
    assert any(l["color"] == "red" for l in one["snapshot"]["links"])
    with pytest.raises(TopologyError):
        pt_lab.replay({"devices": [{"type": "pc", "name": "A", "ip": "1.1.1.1", "mask": "255.255.255.0"}, {"type": "pc", "name": "A"}], "links": []}, [])
