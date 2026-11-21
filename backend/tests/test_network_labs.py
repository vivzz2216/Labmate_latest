"""Computer Networks experiments in the workflow: recognising manuals, capture uploads, the studio API, the part builder and the report."""
import asyncio
import io
import os
from types import SimpleNamespace

import pytest
from docx import Document
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.middleware.auth import get_current_user
from app.middleware.csrf import require_csrf_token
from app.models import AssignmentWorkflow, Upload, User, WorkflowEvidence
from app.netlab import scenario
from app.netlab.pcap import read_capture, write_pcap
from app.routers import netlab, workflows
from app.services import evidence_files, network_labs
from app.services.assignment_workflow import attach_evidence
from app.services.docx_layout import embed_evidence_block

WIRESHARK_MANUAL = """EXPERIMENT NO. 5
Introduction to Wireshark and Traffic analysis (packet headers) using Wireshark
Aim: To study Wireshark and its applications in traffic analysis and password sniffing.
Open Wireshark. Study Wireshark GUI. Click Start. Packet capture will now begin.
Wireshark window with different filters (arp, http, tcp, icmp, with ip address etc)"""
EXP7_MANUAL = """EXPERIMENT NO. 7
Introduction to packet tracer and implementation of Hub and Switch
Tool: Cisco packet tracer is a network simulator.
Scenario 1(Star Topology using Hub): Go to Simulation mode. Scenario 2(Star Topology using Switch):
Scenario 3(Bus Topology using Hub): Post Experimental Exercise: Implement mesh topology using Hub and Switch."""
EXP9_MANUAL = """EXPERIMENT NO: 9
To design a network using three routers and dynamic routing
Start packet tracer and design the network. Reboot Router by powering it off. Generic Router 0 Generic Router 1 Generic Router 2
RIP option in Config tab. Routing table of Router."""
NS2_MANUAL = "Experiment 2: Introduction to NS-2. Write a Tcl script: set ns [new Simulator]; $ns duplex-link $n0 $n1 1Mb 10ms DropTail"
PYTHON_MANUAL = "Experiment 1: Write a Python program to print the Fibonacci series. Experiment 2: Write a program to sort a list."


# ----------------------------------------------------------------------------------------------- recognising manuals
def test_a_wireshark_manual_becomes_one_analyser_part_with_an_optional_capture_slot():
    parts = network_labs.detect_network_lab(WIRESHARK_MANUAL)
    assert len(parts) == 1
    part = parts[0]
    assert part["studio"] == "wireshark" and part["kind"] == "evidence" and part["is_theory"] and part["language"] == "theory"
    assert [s["id"] for s in part["evidence_slots"]] == ["wireshark_pcap"] and "optional" in part["evidence_slots"][0]["label"]


def test_exp7_manual_gives_one_part_per_scenario_and_the_mesh_exercise():
    parts = network_labs.detect_network_lab(EXP7_MANUAL)
    assert [p["studio_args"]["experiment"] for p in parts] == ["exp7-1", "exp7-2", "exp7-3", "exp7-mesh"]
    assert [p["id"] for p in parts] == [1, 2, 3, 4] and all(p["studio"] == "packettracer" and not p.get("evidence_slots") for p in parts)
    without_mesh = network_labs.detect_network_lab(EXP7_MANUAL.replace("mesh", "ring"))
    assert [p["studio_args"]["experiment"] for p in without_mesh] == ["exp7-1", "exp7-2", "exp7-3"]
    only_two = network_labs.detect_network_lab("Packet Tracer lab. Scenario 1: hub. Scenario 2: switch.")
    assert [p["studio_args"]["experiment"] for p in only_two] == ["exp7-1", "exp7-2"]


def test_exp9_manual_gives_the_router_part():
    parts = network_labs.detect_network_lab(EXP9_MANUAL)
    assert [p["studio_args"]["experiment"] for p in parts] == ["exp9"] and parts[0]["part_title"].startswith("Three routers")


@pytest.mark.parametrize("text", [NS2_MANUAL, PYTHON_MANUAL, "", None, "Wireshark is a tool.", "Packet Tracer overview with a hub."])
def test_other_manuals_are_left_to_the_normal_pipeline(text):
    assert network_labs.detect_network_lab(text) is None


# ----------------------------------------------------------------------------------------------- capture validation
def test_capture_validation_accepts_real_captures_and_refuses_everything_else():
    data, _ = scenario.build_scenario()
    assert evidence_files.normalize_capture(data) == data
    for bad, reason in ((b"", "empty"), (b"hello world " * 10, "not a .pcap"), (write_pcap([]), "no packets"),
                        (write_pcap([(1.0, b"\x00" * 60)], linktype=105), "Ethernet"), (data + b"\x00" * evidence_files.MAX_CAPTURE_BYTES, "8 MB")):
        with pytest.raises(ValueError, match=reason):
            evidence_files.normalize_capture(bad)


# ----------------------------------------------------------------------------------------------- the question fields
def question_input(**fields):
    base = {"id": 1, "text": "Build the part", "language": "theory", "kind": "evidence"}
    return workflows.QuestionInput(**{**base, **fields})


def test_studio_parts_are_accepted_in_any_manual_but_only_with_known_experiments():
    data = SimpleNamespace(track=None)
    fields = workflows.multi_part_fields(question_input(studio="packettracer", studio_args={"experiment": "exp9"}, part_title="Routers"), data)
    assert fields == {"kind": "evidence", "part_title": "Routers", "studio": "packettracer", "studio_args": {"experiment": "exp9"}}
    wire = workflows.multi_part_fields(question_input(studio="wireshark", evidence_slots=[{"id": "wireshark_pcap", "label": "Capture"}]), data)
    assert wire["studio"] == "wireshark" and wire["evidence_slots"][0]["id"] == "wireshark_pcap"
    with pytest.raises(HTTPException) as unknown:
        workflows.multi_part_fields(question_input(studio="packettracer", studio_args={"experiment": "exp99"}), data)
    assert unknown.value.status_code == 400
    with pytest.raises(HTTPException):
        workflows.multi_part_fields(question_input(studio="wireshark", evidence_slots=[{"id": "evil_slot", "label": "x"}]), data)
    with pytest.raises(HTTPException):
        workflows.multi_part_fields(question_input(studio="wireshark", kind="theory"), data)
    assert workflows.multi_part_fields(workflows.QuestionInput(id=1, text="t", language="python"), data) == {}


# ----------------------------------------------------------------------------------------------- uploading a capture
@pytest.fixture
def env(tmp_path, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path / "uploads"))
    engine = create_engine("sqlite:///" + str(tmp_path / "t.db").replace("\\", "/"), connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        owner = User(email="o@example.com", name="Owner")
        db.add(owner)
        db.flush()
        upload = Upload(user_id=owner.id, filename="a.docx", original_filename="a.docx", file_path="fixture", file_type="docx", file_size=1)
        db.add(upload)
        db.flush()
        part = network_labs.detect_network_lab(WIRESHARK_MANUAL)[0]
        db.add(AssignmentWorkflow(upload_id=upload.id, status="ready", stage="review", results=[], logs=[], questions=[part]))
        db.commit()
        upload_id = upload.id
    app = FastAPI()
    app.include_router(workflows.router, prefix="/api")
    app.include_router(netlab.router, prefix="/api")

    def database():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_current_user] = lambda: owner
    app.dependency_overrides[require_csrf_token] = lambda: True
    client = TestClient(app)
    yield SimpleNamespace(client=client, factory=factory, upload=upload_id)
    client.close()
    engine.dispose()


def post_capture(env, data, name="trace.pcap", slot="wireshark_pcap"):
    return env.client.post(f"/api/workflows/{env.upload}/evidence", data={"question_id": 1, "slot": slot},
                           files={"file": (name, data, "application/octet-stream")})


def test_capture_upload_keeps_the_file_private_and_never_serves_it_as_an_image(env):
    data, _ = scenario.build_scenario()
    ok = post_capture(env, data, "my trace.pcap")
    assert ok.status_code == 200, ok.text
    with env.factory() as db:
        stored = db.query(WorkflowEvidence).one()
    assert stored.file_path.endswith(".pcap") and open(stored.file_path, "rb").read() == data and stored.slot == "wireshark_pcap"
    assert env.client.get(f"/api/workflows/{env.upload}/evidence/{ok.json()['id']}/image").status_code == 404
    again = post_capture(env, data[:24 + 16 + 60], "short.pcap")
    assert again.status_code == 200 and again.json()["id"] == ok.json()["id"] and not os.path.exists(stored.file_path)


def test_capture_slot_refuses_screenshots_and_the_image_slot_refuses_captures(env):
    png = io.BytesIO()
    Image.new("RGB", (8, 8)).save(png, format="PNG")
    data, _ = scenario.build_scenario()
    assert post_capture(env, png.getvalue(), "x.png").status_code == 400
    assert post_capture(env, b"just text, not a capture at all, more than 24 bytes", "x.pcap").status_code == 400
    assert post_capture(env, data, "x.pcap", slot="powerbi_dashboard").status_code == 400            # not a slot of this part
    with env.factory() as db:
        assert db.query(WorkflowEvidence).count() == 0


# ----------------------------------------------------------------------------------------------- the studio API
def open_scenario(env):
    response = env.client.post("/api/netlab/wireshark/open", data={"scenario": "true"})
    assert response.status_code == 200, response.text
    return response.json()


def test_open_the_practice_capture_then_query_it(env):
    opened = open_scenario(env)
    token = opened["token"]
    assert opened["total"] == 40 and opened["source"] == "scenario" and len(opened["rows"]) == 40 and opened["missing"] == []
    assert [s["id"] for s in opened["steps"]][:2] == ["interface", "sniffing"]
    detail = env.client.get(f"/api/netlab/wireshark/{token}/packet/1").json()
    assert detail["tree"][1]["label"].startswith("Ethernet II") and detail["hex"][0]["hex"][:6] == ["ff"] * 6
    assert env.client.get(f"/api/netlab/wireshark/{token}/filter", params={"expr": "arp"}).json() == {"numbers": [1, 2], "count": 2}
    assert env.client.get(f"/api/netlab/wireshark/{token}/stream/2").json()["turns"] == 2
    bad = env.client.get(f"/api/netlab/wireshark/{token}/filter", params={"expr": "htp"})
    assert bad.status_code == 422 and "neither a field nor a protocol" in bad.json()["detail"]
    assert env.client.get(f"/api/netlab/wireshark/{token}/packet/99").status_code == 404
    assert env.client.get(f"/api/netlab/wireshark/{token}/stream/99").status_code == 404


def test_open_a_students_own_capture_and_refuse_bad_files(env):
    data, _ = scenario.build_scenario()
    frames = read_capture(data).frames[:4]
    mine = write_pcap([(f.timestamp, f.data) for f in frames])
    opened = env.client.post("/api/netlab/wireshark/open", files={"file": ("lab.pcap", mine, "application/octet-stream")})
    assert opened.status_code == 200 and opened.json()["total"] == 4 and opened.json()["source"] == "uploaded" and opened.json()["file"] == "lab.pcap"
    assert any("No HTTP" in m or "no HTTP" in m for m in opened.json()["missing"])
    refused = env.client.post("/api/netlab/wireshark/open", files={"file": ("x.pcap", b"nope" * 20, "application/octet-stream")})
    assert refused.status_code == 400 and ".pcap" in refused.json()["detail"]
    assert env.client.get("/api/netlab/wireshark/unknown-token/filter").status_code == 410


def test_packet_tracer_endpoints(env):
    listing = env.client.get("/api/netlab/packettracer/experiments").json()
    assert [item["id"] for item in listing] == ["exp7-1", "exp7-2", "exp7-3", "exp7-mesh", "exp9"]
    run = env.client.get("/api/netlab/packettracer/run/exp9").json()
    assert run["path_after"] == ["PC0", "Router0", "Router2", "Router1", "PC1"] and len(run["frames"]) == 9
    assert env.client.get("/api/netlab/packettracer/run/nope").status_code == 404
    spec = run["spec"]
    result = env.client.post("/api/netlab/packettracer/replay", json={"spec": spec, "actions": [
        {"type": "link", "a": "Router0", "b": "Router1", "up": False}, {"type": "ping", "from": "PC0", "to": "192.168.2.2"}]}).json()
    assert result["results"][0]["l3_path"] == ["PC0", "Router0", "Router2", "Router1", "PC1"]
    broken = {"devices": [{"type": "pc", "name": "A", "ip": "10.0.0.1", "mask": "255.255.255.0"}, {"type": "pc", "name": "B", "ip": "10.0.0.1", "mask": "255.255.255.0"}], "links": []}
    refused = env.client.post("/api/netlab/packettracer/replay", json={"spec": broken, "actions": []})
    assert refused.status_code == 422 and "share the address" in refused.json()["detail"]
    too_big = {"devices": [{"type": "pc", "name": "P%d" % i, "ip": "10.0.%d.1" % i, "mask": "255.255.255.0"} for i in range(41)], "links": []}
    assert env.client.post("/api/netlab/packettracer/replay", json={"spec": too_big, "actions": []}).status_code == 413


# ----------------------------------------------------------------------------------------------- building parts
def fake_shots(monkeypatch, tmp_path, failure=None):
    async def shots(tool, state, steps, out_dir):
        if failure:
            return [], failure
        out = []
        for step in steps:
            path = tmp_path / ("%s_%s.png" % (tool, step["id"]))
            Image.new("RGB", (160, 90), (230, 235, 240)).save(path)
            out.append({"slot": None, "path": str(path), "caption": step["title"] + " (LabMate practice environment)", "explain": step["explain"]})
        return out, None
    monkeypatch.setattr(network_labs, "_shots", shots)


def run(coro):
    return asyncio.run(coro)


def test_a_wireshark_part_without_a_capture_uses_the_practice_capture_and_says_so(monkeypatch, tmp_path):
    fake_shots(monkeypatch, tmp_path)

    async def none(*_):
        return None
    monkeypatch.setattr(network_labs, "_stored_capture", none)
    part = network_labs.detect_network_lab(WIRESHARK_MANUAL)[0]
    result = run(network_labs.run_studio_part(SimpleNamespace(id=3), None, part))
    assert result["status"] == "completed" and result["kind"] == "evidence" and result["screenshot_paths"] == []
    assert len(result["auto_evidence"]) == 12 and "practice capture" in result["answer"] and "40 packets" in result["answer"]
    assert [t["title"] for t in result["tables_after"]] == ["Post-experimental exercise: Ethernet protocol frame", "Post-experimental exercise: ARP protocol frame"]
    assert all("(LabMate practice environment)" in shot["caption"] for shot in result["auto_evidence"])
    assert "studio_error" not in result


def test_a_wireshark_part_analyses_the_students_own_capture(monkeypatch, tmp_path):
    fake_shots(monkeypatch, tmp_path)
    data, _ = scenario.build_scenario()
    frames = read_capture(data).frames
    mine = write_pcap([(f.timestamp, f.data) for f in frames[:4] + frames[14:18]])       # ARP, DNS and ICMP only

    async def theirs(*_):
        return mine
    monkeypatch.setattr(network_labs, "_stored_capture", theirs)
    part = network_labs.detect_network_lab(WIRESHARK_MANUAL)[0]
    result = run(network_labs.run_studio_part(SimpleNamespace(id=3), None, part))
    assert "practice capture" not in result["answer"] and "8 packets" in result["answer"]
    ids = [s["caption"] for s in result["auto_evidence"]]
    assert not any("login" in c.lower() or "password" in c.lower() or "TCP stream" in c for c in ids)
    assert any("login" in note for note in result["notes"]) and result["tables_after"][1]["rows"][5][2] == "192.168.1.10"


def test_a_capture_that_cannot_be_read_falls_back_to_the_practice_capture(monkeypatch, tmp_path):
    fake_shots(monkeypatch, tmp_path)

    async def corrupt(*_):
        return b"definitely not a capture" * 5
    monkeypatch.setattr(network_labs, "_stored_capture", corrupt)
    part = network_labs.detect_network_lab(WIRESHARK_MANUAL)[0]
    result = run(network_labs.run_studio_part(SimpleNamespace(id=3), None, part))
    assert "practice capture" in result["answer"]


@pytest.mark.parametrize("experiment, images, before, observed", [
    ("exp7-1", 4, ["IP addresses used"], 2), ("exp7-2", 4, ["IP addresses used"], 1), ("exp7-3", 4, ["IP addresses used"], 1),
    ("exp7-mesh", 2, ["IP addresses used"], 1), ("exp9", 9, ["End devices", "Router configuration"], 1)])
def test_packet_tracer_parts_carry_the_run_and_their_assumptions(monkeypatch, tmp_path, experiment, images, before, observed):
    fake_shots(monkeypatch, tmp_path)
    part = {"id": 1, "text": "x", "studio": "packettracer", "studio_args": {"experiment": experiment}, "part_title": "t"}
    result = run(network_labs.run_studio_part(SimpleNamespace(id=3), None, part))
    assert len(result["auto_evidence"]) == images and [t["title"] for t in result["tables_before"]] == before
    assert len(result["observations"]) == observed and result["answer"].startswith("1. ")
    assert bool(result["notes"]) == (experiment != "exp7-1")


def test_a_studio_that_is_down_leaves_a_visible_note_not_a_failed_report(monkeypatch, tmp_path):
    fake_shots(monkeypatch, tmp_path, failure="The studio page could not be reached.")
    part = {"id": 1, "text": "x", "studio": "packettracer", "studio_args": {"experiment": "exp9"}, "part_title": "t"}
    result = run(network_labs.run_studio_part(SimpleNamespace(id=3), None, part))
    assert result["status"] == "completed" and result["auto_evidence"] == [] and "could not be reached" in result["studio_error"]
    out = attach_evidence([result], [part], [])[0]
    assert out["evidence_missing"] and "could not be captured" in out["evidence_missing"][0]
    with pytest.raises(ValueError):
        run(network_labs.run_studio_part(SimpleNamespace(id=3), None, {**part, "studio_args": {"experiment": "zzz"}}))


# ----------------------------------------------------------------------------------------------- the report
def test_studio_screenshots_keep_their_explanations_and_the_capture_slot_is_not_a_picture(tmp_path):
    shots = []
    for name in ("a", "b"):
        path = tmp_path / ("%s.png" % name)
        Image.new("RGB", (80, 50)).save(path)
        shots.append({"slot": None, "path": str(path), "caption": "Cap " + name, "explain": "Explain " + name})
    part = {"id": 1, "evidence_slots": [{"id": "wireshark_pcap", "label": "Capture"}]}
    out = attach_evidence([{"id": 1, "kind": "evidence", "auto_evidence": shots}], [part], [(1, "wireshark_pcap", str(tmp_path / "x.pcap"))])[0]
    assert out["screenshot_captions"] == ["Cap a", "Cap b"] and out["screenshot_explanations"] == ["Explain a", "Explain b"]
    assert out["evidence_missing"] == []


def test_the_word_block_prints_tables_explanations_observations_and_notes_in_order(tmp_path):
    image = tmp_path / "i.png"
    Image.new("RGB", (200, 100), (200, 210, 220)).save(image)
    document = Document()
    embed_evidence_block(document, "Scenario 1", "1. Placed the devices.", 2, [str(image)], ["Figure caption"], [],
                         tables_before=[{"title": "IP addresses used", "headers": ["Device", "IP"], "rows": [["PC0", "192.168.3.1"]]}],
                         explanations=["What the screenshot shows."], observations=["The hub repeated every frame."], notes=["Assumed layout."],
                         tables_after=[{"title": "Answers", "headers": ["No.", "Answer"], "rows": [["1", "line one\nline two"]]}])
    body = [p.text for p in document.paragraphs if p.text.strip()]
    assert body[0].startswith("Part 2: Scenario 1") and "Procedure:" in body
    order = [body.index(text) for text in ("IP addresses used", "Figure caption", "Explanation: What the screenshot shows.",
                                           "Observation: The hub repeated every frame.", "Answers", "Note: Assumed layout.")]
    assert order == sorted(order), body
    assert [len(t.rows) for t in document.tables] == [2, 2] and document.tables[1].rows[1].cells[1].text == "line one\nline two"
    assert len(document.inline_shapes) == 1


def test_malformed_topologies_and_actions_are_refused_cleanly(env):
    good = {"devices": [{"type": "pc", "name": "A", "ip": "10.0.0.1", "mask": "255.255.255.0"},
                        {"type": "pc", "name": "B", "ip": "10.0.0.2", "mask": "255.255.255.0"}],
            "links": [{"a": "A", "ap": "FastEthernet0", "b": "B", "bp": "FastEthernet0"}]}
    bad_specs = [
        {"devices": "nope", "links": []}, {"devices": [None], "links": []}, {"devices": [{"type": "pc"}], "links": []},
        {"devices": good["devices"], "links": [{"a": "A", "ap": "Gi9/9", "b": "B", "bp": "FastEthernet0"}]},      # a port that does not exist
        {"devices": good["devices"], "links": [{"a": "A", "ap": "FastEthernet0", "b": "A", "bp": "FastEthernet0"}]},   # a cable to itself
        {"devices": [{"type": "pc", "name": "A", "ip": "999.1.1.1", "mask": "255.255.255.0"}], "links": []},
        {"devices": [{"type": "pc", "name": "../../etc", "ip": "10.0.0.1", "mask": "255.255.255.0"}], "links": []},
        {"links": 5},
    ]
    for spec in bad_specs:
        reply = env.client.post("/api/netlab/packettracer/replay", json={"spec": spec, "actions": []})
        assert reply.status_code == 422, (spec, reply.status_code, reply.text)
    bad_actions = [{"type": "ping"}, {"type": "ping", "from": "Z", "to": "10.0.0.2"}, {"type": "link", "a": "A", "b": "Z", "up": True},
                   {"type": "explode"}, {"type": "ping", "from": "A", "to": "not-an-ip"}, {}]
    for action in bad_actions:
        reply = env.client.post("/api/netlab/packettracer/replay", json={"spec": good, "actions": [action]})
        assert reply.status_code == 422, (action, reply.status_code, reply.text)
    ok = env.client.post("/api/netlab/packettracer/replay", json={"spec": good, "actions": [{"type": "ping", "from": "A", "to": "10.0.0.2"}]})
    assert ok.status_code == 200 and ok.json()["results"][0]["success"] is True


# ----------------------------------------------------------------------------------------------- realistic diverse manuals & rich reports
def test_diverse_university_manuals_detect_all_cisco_and_wireshark_practicals():
    pt_single_cases = [
        ("Practical 1: Switched IPv4 LAN Configuration in Cisco Packet Tracer\nConfigure PC1 (192.168.10.10/24) and PC2 (192.168.10.20/24) through a switch and test ICMP ping.", "switched-lan"),
        ("Lab Worksheet: VLAN Segmentation and Access Port Isolation using Packet Tracer\nConfigure Fa0/1 in VLAN 10 and Fa0/2 in VLAN 20, verify ping fails, then move Fa0/2 to VLAN 10.", "vlan-isolation"),
        ("Routing Practical: Static Routing Across Two Routers R1 and R2 in Packet Tracer\nAdd static routes on R1 and R2 across 10.0.0.0/30 and ping from PC1 to PC2.", "static-routing"),
        ("Enterprise Network Lab: DHCP Address Assignment Pool in Packet Tracer\nConfigure DHCP Server pool 192.168.30.10 and lease IPv4 addresses dynamically to PC1 and PC2.", "dhcp-lan"),
        ("WLAN Lab: Wireless Access Point SSID Association in Packet Tracer\nAssociate Laptop1 with AP1 SSID LabMate Wi-Fi, ping server, then change SSID to test mismatch drop.", "wireless-ssid"),
    ]
    for manual_text, expected_exp in pt_single_cases:
        parts = network_labs.detect_network_lab(manual_text)
        assert parts and [p["studio_args"]["experiment"] for p in parts] == [expected_exp], manual_text

    pt_multi = """Department of Computer Engineering — Networks Practical
Experiment 1: DHCP Address Assignment in Cisco Packet Tracer
Configure a DHCP Server pool 192.168.30.10/24 and verify dynamic leases on PC1 and PC2 via DORA.
Experiment 2: Wireless Access Point SSID Configuration in Cisco Packet Tracer
Configure Laptop1 and AP1 with matching SSID first, verify ICMP ping, then test mismatched SSID."""
    multi_parts = network_labs.detect_network_lab(pt_multi)
    assert [p["studio_args"]["experiment"] for p in multi_parts] == ["dhcp-lan", "wireless-ssid"]

    pt_routing_multi = """Honours Computer Networks Lab Assessment
Experiment 1: Inter-Subnet Static Routing Across Two Routers in Cisco Packet Tracer
Configure static routes on R1 and R2 to reach 192.168.20.0/24 and verify with ping.
Experiment 2: Three-Router Dynamic Routing using RIPv2 in Cisco Packet Tracer
Design three routers Router0, Router1, Router2 in a triangle, enable RIP, inspect routing tables, disable one link and verify failover."""
    routing_parts = network_labs.detect_network_lab(pt_routing_multi)
    assert [p["studio_args"]["experiment"] for p in routing_parts] == ["static-routing", "exp9"]

    ws_cases = [
        ("Lab 1: ARP and ICMP Packet Capture Analysis using Wireshark\nAim: Use Wireshark display filters (arp.opcode == 1, arp.opcode == 2, icmp.type == 8, icmp.type == 0) in Wireshark.", ["arp-icmp"]),
        ("Lab 2: TCP Three-Way Handshake (SYN, SYN-ACK, ACK) Analysis in Wireshark\nInspect sequence and acknowledgment numbers.", ["tcp-handshake"]),
        ("Lab 3: HTTP GET/POST Request and Follow TCP Stream Inspection in Wireshark\nFilter http.request and http.response and reassemble the TCP stream.", ["http"]),
    ]
    for manual_text, expected_exps in ws_cases:
        parts = network_labs.detect_network_lab(manual_text)
        assert parts and [p["studio_args"].get("experiment") for p in parts] == expected_exps, manual_text

    ws_multi = """Network Protocol Analysis Assignment (Wireshark)
Experiment 1: DNS Query and Response Resolution Analysis using Wireshark
Apply dns.flags.response == 0 and dns.flags.response == 1 filters to trace A-record resolution.
Experiment 2: UDP vs TCP Transport Header Comparison in Wireshark
Compare User Datagram Protocol and Transmission Control Protocol headers."""
    ws_multi_parts = network_labs.detect_network_lab(ws_multi)
    assert [p["studio_args"].get("experiment") for p in ws_multi_parts] == ["dns", "tcp-udp"]


def test_focused_practicals_produce_procedures_tables_and_observations(monkeypatch, tmp_path):
    from app.services import studio_capture

    async def fake_capture_studio(tool, state, steps, out_dir, *, practical=None):
        if practical is not None:
            out = []
            for idx in range(1, 5):
                p = tmp_path / f"{tool}_{practical}_{idx}.png"
                Image.new("RGB", (320, 180), (220 + idx * 5, 230, 240)).save(p)
                out.append({"id": f"step{idx}", "path": str(p), "title": f"{practical} step {idx}", "explain": f"Step {idx} explanation for {practical}."})
            return out
        out = []
        for idx, step in enumerate(steps, 1):
            p = tmp_path / f"{tool}_{step['id']}_{idx}.png"
            Image.new("RGB", (320, 180), (210 + idx * 5, 225, 245)).save(p)
            out.append({"id": step["id"], "path": str(p)})
        return out

    monkeypatch.setattr(studio_capture, "capture_studio", fake_capture_studio)
    async def none(*_):
        return None
    monkeypatch.setattr(network_labs, "_stored_capture", none)

    for exp in ("switched-lan", "static-routing", "vlan-isolation", "dhcp-lan", "wireless-ssid"):
        part = {"id": 1, "text": exp, "studio": "packettracer", "studio_args": {"experiment": exp}, "part_title": exp}
        res = run(network_labs.run_studio_part(SimpleNamespace(id=10, instructions=""), None, part))
        assert res["status"] == "completed"
        assert res["answer"].startswith("1. "), (exp, res["answer"])
        assert len(res.get("tables_before") or []) >= 1, (exp, res.get("tables_before"))
        assert len(res.get("observations") or []) >= 1, (exp, res.get("observations"))
        assert len(res.get("auto_evidence") or []) == 4

    for topic in ("arp-icmp", "tcp-handshake", "dns", "http", "tcp-udp"):
        part = {"id": 1, "text": topic, "studio": "wireshark", "studio_args": {"experiment": topic}, "part_title": topic,
                "evidence_slots": [{"id": network_labs.CAPTURE_SLOT, "label": network_labs.CAPTURE_LABEL}]}
        res = run(network_labs.run_studio_part(SimpleNamespace(id=11, instructions=""), None, part))
        assert res["status"] == "completed"
        assert res["answer"].startswith("1. "), (topic, res["answer"])
        assert len(res.get("tables_before") or []) >= 1, (topic, res.get("tables_before"))
        assert len(res.get("observations") or []) >= 1, (topic, res.get("observations"))
        assert len(res.get("auto_evidence") or []) >= 2


def test_compact_report_and_word_report_render_evidence_tables_and_all_screenshots(tmp_path, monkeypatch):
    from app.config import settings
    from app.services.compact_report import build_compact_report

    monkeypatch.setattr(settings, "REPORT_DIR", str(tmp_path / "reports"))
    img1 = tmp_path / "shot1.png"
    img2 = tmp_path / "shot2.png"
    Image.new("RGB", (400, 220), (235, 240, 248)).save(img1)
    Image.new("RGB", (400, 220), (225, 245, 235)).save(img2)
    raw_result = {
        "id": 1,
        "question": "Practical 1: Switched IPv4 LAN",
        "part_title": "Switched IPv4 LAN",
        "language": "theory",
        "is_theory": True,
        "kind": "evidence",
        "status": "completed",
        "answer": "1. Configured PC1 and PC2 IPv4 settings.\n2. Sent ICMP ping via Switch1.",
        "tables_before": [{"title": "Device Addressing", "headers": ["Device", "IP"], "rows": [["PC1", "192.168.10.10"], ["PC2", "192.168.10.20"]]}],
        "observations": ["Switch1 learned both MAC addresses and forwarded ICMP echo cleanly."],
        "auto_evidence": [
            {"slot": None, "path": str(img1), "caption": "PC1 IPv4 Configuration (LabMate practice environment)", "explain": "PC1 configured at 192.168.10.10."},
            {"slot": None, "path": str(img2), "caption": "Ping simulation (LabMate practice environment)", "explain": "ICMP Echo Request/Reply succeeded."},
        ],
    }
    attached = attach_evidence([raw_result], [{"id": 1, "evidence_slots": []}], [])
    upload = SimpleNamespace(original_filename="manual.pdf", file_type="pdf", file_path="")
    wf = SimpleNamespace(id=99, mode="code_only", instructions="", results=attached, output_name="pt_compact", student_name="QA Student")
    out_path, _ = build_compact_report(upload, wf)
    doc = Document(out_path)
    assert len(doc.inline_shapes) == 2
    full_text = "\n".join(p.text for p in doc.paragraphs)
    assert "Device Addressing" in full_text
    assert "Explanation: PC1 configured at 192.168.10.10." in full_text
    assert "Observation: Switch1 learned both MAC addresses and forwarded ICMP echo cleanly." in full_text
    assert len(doc.tables) == 1


def test_mixed_manual_does_not_hijack_non_network_experiments_in_whole_doc_detection():
    mixed = """Department Lab Manual
Experiment 1: Write a Python program to compute factorial using recursion.
Aim: Implement recursive factorial in Python and print factorial of 5.
Experiment 2: Switched IPv4 LAN Configuration in Cisco Packet Tracer
Configure PC1 and PC2 connected via Switch1 and ping between them."""
    heading_total = network_labs.experiment_heading_count(mixed)
    detected = network_labs.detect_network_lab(mixed)
    assert heading_total == 2
    assert len(detected) == 1
    assert len(detected) < heading_total


def test_substeps_inside_multi_experiment_manual_do_not_split_extra_parts():
    manual = """Advanced Routing Lab
Experiment 1: Static Routing Across Two Routers in Cisco Packet Tracer
Part I.1: Configure R1 static route.
Part I.2: Configure R2 static route.
Part I.3: Ping across routers.
Experiment 2: Three-Router Dynamic Routing using RIPv2 in Cisco Packet Tracer
Part II.1: Design 3-router triangle with Router0, Router1, Router2.
Part II.2: Inspect Router0, Router1, Router2 routing tables.
Part II.3: Disable Router0-Router1 link and ping PC0 to PC1."""
    parts = network_labs.detect_network_lab(manual)
    assert [p["studio_args"]["experiment"] for p in parts] == ["static-routing", "exp9"]


def test_diverse_university_manuals_detect_all_powerbi_and_android_practicals():
    pbi_cases = [
        ("Lab 1: Retail Sales Dashboard and Calculated Column in Microsoft Power BI Desktop\nImport Sales CSV, create SalesAmount = [Units] * [UnitPrice], and build KPI Card plus Clustered Bar Chart.", "sales-dashboard"),
        ("Experiment 2: Data Cleaning & Power Query Transformations in Power BI\nDrop blank Quantity rows, set Quantity to number, trim Region names, and remove duplicates.", "clean-sales"),
        ("BI Modeling Worksheet: One-to-Many Table Relationships in Power BI Desktop\nLink Customers[CustomerID] to Orders[CustomerID] in Model View and verify customer filter propagation.", "relationships"),
        ("Practical 4: Authoring Explicit DAX Measures and KPIs in Power BI\nEvaluate SUM([SalesAmount]), SUM([Quantity]), and AVERAGE([SalesAmount]) across Sales rows.", "dax-measures"),
        ("Enterprise Reporting Lab: Interactive Region Slicer and Line Chart in Power BI\nFilter SalesAmount across Months using an interactive Region slicer for North.", "region-slicer"),
    ]
    for manual_text, expected_exp in pbi_cases:
        parts = network_labs.detect_network_lab(manual_text)
        assert parts and [p["studio_args"]["experiment"] for p in parts] == [expected_exp], manual_text
        assert all(p["studio"] == "powerbi" for p in parts)

    pbi_multi = """Business Intelligence Practical Suite — Power BI Desktop
Experiment 1: Data Cleaning in Power Query Editor using Power BI
Remove blank quantities, change column types, standardize region names, and deduplicate rows.
Experiment 2: Interactive Slicer Report Filtering in Power BI
Build Total Sales KPI, Sales by Region, Sales by Month line chart, and filter dynamically using a Region slicer."""
    pbi_multi_parts = network_labs.detect_network_lab(pbi_multi)
    assert [p["studio_args"]["experiment"] for p in pbi_multi_parts] == ["clean-sales", "region-slicer"]

    # Outside SMA manual with ParseHub/Social Media must NOT be hijacked into sample Power BI practicals.
    sma_external = "Create a dashboard in Power BI using scraped Social Media followers data exported from ParseHub and attach screenshots."
    assert network_labs.detect_network_lab(sma_external) is None

    android_cases = [
        ("Practical 1: Greeting Application using EditText and Button in Android Studio\nBuild activity_main.xml with EditText and Show greeting button to display Hello <name>.", "greeting"),
        ("Experiment 2: Two-Activity Explicit Intent Navigation in Android Studio\nPass student extra via Intent from MainActivity to SecondActivity using putExtra and getStringExtra.", "navigation"),
        ("Mobile App Lab 3: Arithmetic Calculator with Input Validation in Android Studio\nRead two numbers, handle blank validation, and implement Add and Subtract OnClickListeners.", "calculator"),
        ("UI Practical 4: Student Registration Form Validation in Android Studio\nValidate name, email, and course EditText inputs and show Registered confirmation.", "registration"),
        ("Experiment 5: Persistent Counter using SharedPreferences in Android Studio\nStore integer count on Increment, preserve value across relaunch, and Reset to 0.", "counter"),
    ]
    for manual_text, expected_exp in android_cases:
        parts = network_labs.detect_network_lab(manual_text)
        assert parts and [p["studio_args"]["experiment"] for p in parts] == [expected_exp], manual_text
        assert all(p["studio"] == "android" for p in parts)

    android_multi = """Mobile Application Development Assessment — Android Studio
Experiment 1: Persistent Counter with SharedPreferences in Android Studio
Implement Increment and Reset backed by getSharedPreferences and verify value persists across relaunch.
Experiment 2: Two Activity Intent Navigation in Android Studio
Send student name extra from MainActivity to SecondActivity via startActivity(intent)."""
    android_multi_parts = network_labs.detect_network_lab(android_multi)
    assert [p["studio_args"]["experiment"] for p in android_multi_parts] == ["counter", "navigation"]


def test_powerbi_and_android_practicals_produce_rich_procedures_tables_and_observations(monkeypatch, tmp_path):
    from app.services import studio_capture

    async def fake_capture_studio(tool, state, steps, out_dir, *, practical=None):
        out = []
        for idx in (1, 2):
            p = tmp_path / f"{tool}_{practical}_{idx}.png"
            Image.new("RGB", (320, 180), (210 + idx * 10, 225, 240)).save(p)
            out.append({"id": f"step{idx}", "path": str(p), "title": f"{practical} step {idx}", "explain": f"Step {idx} for {practical}."})
        return out

    monkeypatch.setattr(studio_capture, "capture_studio", fake_capture_studio)

    for exp in ("sales-dashboard", "clean-sales", "relationships", "dax-measures", "region-slicer"):
        part = {"id": 1, "text": exp, "studio": "powerbi", "studio_args": {"experiment": exp}, "part_title": exp}
        res = run(network_labs.run_studio_part(SimpleNamespace(id=21, instructions=""), None, part))
        assert res["status"] == "completed"
        assert res["answer"].startswith("1. "), (exp, res["answer"])
        assert len(res.get("tables_before") or []) >= 1, (exp, res.get("tables_before"))
        assert len(res.get("observations") or []) >= 1, (exp, res.get("observations"))
        assert len(res.get("auto_evidence") or []) == 2

    for exp in ("greeting", "navigation", "calculator", "registration", "counter"):
        part = {"id": 1, "text": exp, "studio": "android", "studio_args": {"experiment": exp}, "part_title": exp}
        res = run(network_labs.run_studio_part(SimpleNamespace(id=22, instructions=""), None, part))
        assert res["status"] == "completed"
        assert res["answer"].startswith("1. "), (exp, res["answer"])
        assert len(res.get("tables_before") or []) >= 1, (exp, res.get("tables_before"))
        assert len(res.get("observations") or []) >= 1, (exp, res.get("observations"))
        assert len(res.get("auto_evidence") or []) == 2




