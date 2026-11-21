"""Packet Tracer engine (2026-11-20 environment test): static routes, shut-down interfaces, laptops/servers and the models the
studio places (1941 routers, 2960 switches), so the server and the browser agree on free-practice topologies."""
from app.netlab import pt_lab


def two_routers(static=True, shutdown=False):
    r0 = {"type": "router", "name": "Router0", "x": 0, "y": 0, "interfaces": {
        "GigabitEthernet0/0": {"ip": "192.168.1.1", "mask": "255.255.255.0", "shutdown": False},
        "GigabitEthernet0/1": {"ip": "10.0.0.1", "mask": "255.255.255.252", "shutdown": shutdown}}}
    r1 = {"type": "router", "name": "Router1", "x": 0, "y": 0, "interfaces": {
        "GigabitEthernet0/0": {"ip": "10.0.0.2", "mask": "255.255.255.252", "shutdown": False},
        "GigabitEthernet0/1": {"ip": "192.168.2.1", "mask": "255.255.255.0", "shutdown": False}}}
    if static:
        r0["staticRoutes"] = [{"network": "192.168.2.0", "mask": "255.255.255.0", "nextHop": "10.0.0.2"}]
        r1["staticRoutes"] = [{"network": "192.168.1.0", "mask": "255.255.255.0", "nextHop": "10.0.0.1"}]
    return {"devices": [
        {"type": "pc", "name": "PC0", "ip": "192.168.1.10", "mask": "255.255.255.0", "gateway": "192.168.1.1", "x": 0, "y": 0},
        r0, r1,
        {"type": "laptop", "name": "Laptop0", "ip": "192.168.2.10", "mask": "255.255.255.0", "gateway": "192.168.2.1", "x": 0, "y": 0},
        {"type": "switch", "name": "Switch0", "x": 0, "y": 0}],
        "links": [{"a": "PC0", "ap": "FastEthernet0", "b": "Switch0", "bp": "FastEthernet0/1", "cable": "straight"},
                  {"a": "Switch0", "ap": "GigabitEthernet0/1", "b": "Router0", "bp": "GigabitEthernet0/0", "cable": "straight"},
                  {"a": "Router0", "ap": "GigabitEthernet0/1", "b": "Router1", "bp": "GigabitEthernet0/0", "cable": "cross"},
                  {"a": "Router1", "ap": "GigabitEthernet0/1", "b": "Laptop0", "bp": "FastEthernet0", "cable": "cross"}]}


def ping(spec):
    return pt_lab.replay(spec, [{"type": "ping", "from": "PC0", "to": "192.168.2.10"}])


def test_static_routes_carry_traffic_between_two_routers():
    result = ping(two_routers(static=True))
    assert result["results"][0]["success"] is True
    table = {row["network"]: row for row in result["routing"]["Router0"]["table"]}
    assert table["192.168.2.0/24"]["code"] == "S" and table["192.168.2.0/24"]["next_hop"] == "10.0.0.2" and table["192.168.2.0/24"]["distance"] == 1
    assert "S    192.168.2.0/24 [1/0] via 10.0.0.2" in result["routing"]["Router0"]["show"]


def test_without_routes_the_far_network_is_unreachable():
    assert ping(two_routers(static=False))["results"][0]["success"] is False


def test_a_shut_down_interface_drops_the_static_route_and_the_ping():
    result = ping(two_routers(static=True, shutdown=True))
    assert result["results"][0]["success"] is False
    assert "192.168.2.0/24" not in {row["network"] for row in result["routing"]["Router0"]["table"]}
