"""Packet analyser HTTP API: samples, filter check, statistics, find, export, and the live-capture switch."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import settings
from app.netlab.pcap import read_capture
from app.routers import netlab


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(settings, "UNAVAILABLE_LAB_TRACKS", "")
    monkeypatch.setattr(settings, "NETLAB_LIVE_CAPTURE", False)
    app = FastAPI()
    app.include_router(netlab.router, prefix="/api")
    return TestClient(app)


def _open(client, sample):
    response = client.post("/api/netlab/wireshark/open", data={"sample": sample})
    assert response.status_code == 200, response.text
    return response.json()


def test_samples_list_and_open(client):
    listing = client.get("/api/netlab/wireshark/samples").json()
    assert {s["id"] for s in listing["samples"]} == {"practice", "dhcp-arp", "dns", "http", "icmp"} and "scapy" in listing["note"]
    opened = _open(client, "http")
    assert opened["file"] == "http-browsing.pcap" and opened["total"] == 21 and opened["meta"]["format"] == "pcap"
    assert len(opened["meta"]["sha256"]) == 64
    assert client.post("/api/netlab/wireshark/open", data={"sample": "nope"}).status_code == 404
    detail = client.get("/api/netlab/wireshark/%s/packet/13" % opened["token"]).json()
    http = next(node for node in detail["tree"] if node.get("abbrev") == "http")
    assert http["filter"] == "http"
    method = http["children"][0]["children"][0]
    assert method["abbrev"] == "http.request.method" and method["filter"] == 'http.request.method == "POST"'


def test_filter_check_endpoint(client):
    assert client.get("/api/netlab/wireshark/check", params={"expr": "tcp.port == 80"}).json() == {"valid": True, "error": "", "warning": ""}
    bad = client.get("/api/netlab/wireshark/check", params={"expr": "tcp.prot == 80"}).json()
    assert bad["valid"] is False and "not a valid protocol or protocol field" in bad["error"]
    assert client.get("/api/netlab/wireshark/check", params={"expr": "bootp"}).json()["warning"]


def test_statistics_endpoints(client):
    token = _open(client, "dns")["token"]
    hierarchy = client.get("/api/netlab/wireshark/%s/stats/hierarchy" % token).json()
    assert hierarchy["rows"][0]["protocol"] == "Frame" and hierarchy["rows"][0]["packets"] == 15
    v6 = client.get("/api/netlab/wireshark/%s/stats/hierarchy" % token, params={"expr": "ipv6"}).json()
    assert v6["packets"] == 2
    conv = client.get("/api/netlab/wireshark/%s/stats/conversations" % token, params={"kind": "udp"}).json()
    assert conv["title"] == "UDP" and len(conv["rows"]) == 7
    ends = client.get("/api/netlab/wireshark/%s/stats/endpoints" % token, params={"kind": "ipv4"}).json()
    assert {r["address"] for r in ends["rows"]} == {"192.168.1.10", "192.168.1.1"}
    props = client.get("/api/netlab/wireshark/%s/stats/properties" % token, params={"marked": 2}).json()
    assert props["file"]["name"] == "dns-queries.pcapng" and props["marked"] == 2 and props["file"]["source"]
    assert client.get("/api/netlab/wireshark/%s/stats/conversations" % token, params={"kind": "bogus"}).status_code == 422
    assert client.get("/api/netlab/wireshark/%s/stats/hierarchy" % token, params={"expr": "tcp.prot"}).status_code == 422


def test_find_and_exports(client):
    token = _open(client, "http")["token"]
    hit = client.get("/api/netlab/wireshark/%s/find" % token, params={"q": "404", "mode": "string", "scope": "list"}).json()
    assert hit["found"] and hit["number"] == 11
    miss = client.get("/api/netlab/wireshark/%s/find" % token, params={"q": "nothing-like-this", "mode": "string", "scope": "bytes"}).json()
    assert miss == {"found": False}
    assert client.get("/api/netlab/wireshark/%s/find" % token, params={"q": "zz", "mode": "hex", "scope": "bytes"}).status_code == 422
    saved = client.get("/api/netlab/wireshark/%s/export" % token, params={"format": "pcapng"})
    assert saved.headers["content-disposition"] == 'attachment; filename="http-browsing.pcapng"'
    assert len(read_capture(saved.content).frames) == 21
    shown = client.get("/api/netlab/wireshark/%s/export" % token, params={"format": "pcap", "which": "displayed", "expr": "http"})
    assert len(read_capture(shown.content).frames) == 6 and "http-browsing-displayed.pcap" in shown.headers["content-disposition"]
    marked = client.get("/api/netlab/wireshark/%s/export" % token, params={"which": "marked", "marked": "3,4,5"})
    assert len(read_capture(marked.content).frames) == 3
    text = client.get("/api/netlab/wireshark/%s/dissections" % token, params={"format": "txt", "which": "displayed", "expr": "tcp.flags.reset == 1"})
    assert "[RST, ACK]" in text.text and text.text.count("No.     Time") == 1
    csv = client.get("/api/netlab/wireshark/%s/dissections" % token, params={"format": "csv", "which": "all"})
    assert csv.text.count("\n") == 22


def test_live_capture_switched_off_on_the_server(client):
    listing = client.get("/api/netlab/wireshark/capture/interfaces").json()
    assert listing["available"] is False and listing["interfaces"] == []
    started = client.post("/api/netlab/wireshark/capture/start", json={"interface": "eth0"})
    assert started.status_code == 409 and "switched off" in started.json()["detail"]
