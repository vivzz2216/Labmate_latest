"""Power BI dataset upload, the required-dataset rule, the automatic dashboard capture and its report merge."""
import asyncio
import io
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from types import SimpleNamespace

import pytest
from docx import Document
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.middleware.auth import get_current_user
from app.middleware.csrf import require_csrf_token
from app.models import AssignmentWorkflow, Upload, User, WorkflowEvidence
from app.routers import workflows
from app.services import evidence_files, powerbi_capture
from app.services.assignment_workflow import attach_evidence, powerbi_brief

KPI_CSV = Path(__file__).resolve().parents[1] / "app" / "lab_data" / "sma" / "social_kpi_powerbi.csv"
SLOTS = [{"id": "powerbi_dataset", "label": "Dataset for the dashboard (CSV)"},
         {"id": "powerbi_dashboard", "label": "Power BI dashboard screenshot"},
         {"id": "powerbi_certificate", "label": "Course certificate"}]


# ----------------------------------------------------------------------------- dataset validation
def test_a_real_csv_is_accepted_and_normalised():
    out = evidence_files.normalize_dataset(KPI_CSV.read_bytes())
    assert out.startswith(b"date,platform,impressions") and b"\r" not in out
    bom = evidence_files.normalize_dataset(b"\xef\xbb\xbfa,b\r\n1,2\r\n")
    assert bom == b"a,b\n1,2\n"
    assert evidence_files.normalize_dataset("name,city\nJos\xe9,Pune\n".encode("cp1252")).decode("utf-8").splitlines()[1] == "Jos\u00e9,Pune"
    assert evidence_files.normalize_dataset(b"a,b\n1,2\n\n\n3,4\n").decode().count("\n") == 5   # blank lines are tolerated


@pytest.mark.parametrize("data,reason", [
    (b"", "empty"), (b"a,b\n", "at least one data row"), (b"only\n1\n2\n", "at least two columns"),
    (b"PK\x03\x04rest of an xlsx", "Excel"), (b"%PDF-1.4 ...", "Excel workbooks and PDFs"), (b"a,b\x00\n1,2", "Excel"),
    (b"<html><body>a,b</body></html>", "web page"), (b",,,\n1,2,3\n", "header row and at least one data row"),
    (b"x" * (evidence_files.MAX_DATASET_BYTES + 1), "5 MB"),
    ("a," * 61 + "z\n" + "1," * 61 + "1\n", "columns"),
])
def test_bad_datasets_are_refused_with_a_reason(data, reason):
    if isinstance(data, str):
        data = data.encode()
    with pytest.raises(ValueError, match=reason):
        evidence_files.normalize_dataset(data)


def test_too_many_rows_are_refused():
    with pytest.raises(ValueError, match="rows"):
        evidence_files.normalize_dataset(b"a,b\n" + b"1,2\n" * (evidence_files.MAX_DATASET_ROWS + 1))


# ----------------------------------------------------------------------------- the dataset is required
def question(slots=SLOTS, qid=2):
    return {"id": qid, "text": "Create a dashboard", "kind": "evidence", "evidence_slots": slots,
            "part_title": "Power BI dashboard"}


def test_a_power_bi_part_without_a_dataset_or_own_screenshot_is_reported_missing():
    assert workflows.missing_required_datasets([question()], []) == ["Power BI dashboard"]
    assert workflows.missing_required_datasets([question()], [(2, "powerbi_dataset")]) == []
    # A student who built it in real Power BI and attached that screenshot needs no dataset.
    assert workflows.missing_required_datasets([question()], [(2, "powerbi_dashboard")]) == []
    assert workflows.missing_required_datasets([question()], [(2, "powerbi_certificate")]) == ["Power BI dashboard"]
    assert workflows.missing_required_datasets([question()], [(9, "powerbi_dataset")]) == ["Power BI dashboard"]
    # Parts without a dataset slot (Canva, certificate only, theory, code) are never blocked.
    canva = question([{"id": "canva_poster", "label": "Poster"}], qid=3)
    cert = question([{"id": "powerbi_certificate", "label": "Certificate"}], qid=4)
    theory = {"id": 1, "text": "Explain", "kind": "theory"}
    assert workflows.missing_required_datasets([canva, cert, theory], []) == []


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
        db.add(AssignmentWorkflow(upload_id=upload.id, status="ready", stage="review", results=[], logs=[],
                                  questions=[{"id": 1, "text": "t", "language": "theory", "kind": "theory"}, question()]))
        db.commit()
        upload_id = upload.id
    app = FastAPI()
    app.include_router(workflows.router, prefix="/api")

    def database():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_current_user] = lambda: owner
    app.dependency_overrides[require_csrf_token] = lambda: True
    client = TestClient(app)
    yield SimpleNamespace(client=client, factory=factory, upload=upload_id, tmp=tmp_path)
    client.close()
    engine.dispose()


def post(env, slot, data, name):
    return env.client.post(f"/api/workflows/{env.upload}/evidence", data={"question_id": 2, "slot": slot},
                           files={"file": (name, data, "application/octet-stream")})


def test_dataset_upload_stores_a_private_csv_and_is_never_served_as_an_image(env):
    ok = post(env, "powerbi_dataset", KPI_CSV.read_bytes(), "my data.csv")
    assert ok.status_code == 200, ok.text
    row = ok.json()
    assert row["slot"] == "powerbi_dataset" and row["filename"] == "my data.csv"
    with env.factory() as db:
        stored = db.query(WorkflowEvidence).one()
    assert stored.file_path.endswith(".csv") and Path(stored.file_path).read_bytes().startswith(b"date,platform")
    assert env.client.get(f"/api/workflows/{env.upload}/evidence/{row['id']}/image").status_code == 404
    # Replacing keeps one row.
    again = post(env, "powerbi_dataset", b"a,b\n1,2\n", "other.csv")
    assert again.status_code == 200 and again.json()["id"] == row["id"] and not Path(stored.file_path).exists()
    assert len(env.client.get(f"/api/workflows/{env.upload}/evidence").json()) == 1


def test_the_dataset_slot_refuses_images_and_the_image_slot_refuses_csv(env):
    png = io.BytesIO()
    Image.new("RGB", (8, 8)).save(png, format="PNG")
    assert post(env, "powerbi_dataset", png.getvalue(), "x.png").status_code == 400
    assert post(env, "powerbi_dashboard", KPI_CSV.read_bytes(), "x.csv").status_code == 400
    assert post(env, "powerbi_dataset", b"<script>alert(1)</script>", "x.csv").status_code == 400
    with env.factory() as db:
        assert db.query(WorkflowEvidence).count() == 0


def test_api_responses_never_expose_captured_file_paths(env):
    with env.factory() as db:
        workflow = db.query(AssignmentWorkflow).one()
        workflow.results = [{"id": 2, "question": "q", "language": "theory", "kind": "evidence", "status": "completed",
                             "auto_evidence": [{"slot": "powerbi_dashboard", "path": "C:/secret/server/path.png", "caption": "c"}],
                             "screenshot_paths": []}]
        db.commit()
    body = env.client.get(f"/api/workflows/{env.upload}").json()
    assert "secret" not in str(body) and body["results"][0]["screenshots"] == 1 and "auto_evidence" not in body["results"][0]


# ----------------------------------------------------------------------------- the report merge
def png(path, colour=(10, 120, 200)):
    Image.new("RGB", (64, 40), colour).save(path)
    return str(path)


def test_the_built_dashboard_fills_the_dashboard_slot_and_the_dataset_is_never_embedded(tmp_path):
    report, table, dataset = png(tmp_path / "r.png"), png(tmp_path / "t.png"), tmp_path / "d.csv"
    dataset.write_text("a,b\n1,2\n")
    result = {"id": 2, "kind": "evidence", "auto_evidence": [
        {"slot": "powerbi_dashboard", "path": report, "caption": "Report view: dashboard built from d.csv"},
        {"slot": None, "path": table, "caption": "Table view: the loaded dataset"}]}
    out = attach_evidence([result], [{"id": 2, "evidence_slots": SLOTS}], [(2, "powerbi_dataset", str(dataset))])[0]
    assert out["screenshot_paths"] == [report, table]
    assert out["screenshot_captions"] == ["Report view: dashboard built from d.csv", "Table view: the loaded dataset"]
    assert out["evidence_missing"] == ["Course certificate"]          # only the certificate; the dataset slot is not a picture


def test_the_students_own_screenshot_wins_over_the_built_one(tmp_path):
    report, own, cert = png(tmp_path / "r.png"), png(tmp_path / "own.png", (200, 10, 10)), png(tmp_path / "c.png")
    result = {"id": 2, "kind": "evidence", "auto_evidence": [{"slot": "powerbi_dashboard", "path": report, "caption": "auto"}]}
    out = attach_evidence([result], [{"id": 2, "evidence_slots": SLOTS}],
                          [(2, "powerbi_dashboard", own), (2, "powerbi_certificate", cert)])[0]
    assert out["screenshot_paths"] == [own, cert]
    assert out["screenshot_captions"] == ["Student-supplied: Power BI dashboard screenshot", "Student-supplied: Course certificate"]
    assert out["evidence_missing"] == []


def test_a_capture_that_failed_leaves_a_visible_placeholder_not_a_missing_report(tmp_path):
    out = attach_evidence([{"id": 2, "kind": "evidence"}], [{"id": 2, "evidence_slots": SLOTS}], [])[0]
    assert out["screenshot_paths"] == [] and out["evidence_missing"] == ["Power BI dashboard screenshot", "Course certificate"]


def test_the_procedure_prompt_is_grounded_in_the_captured_dashboard():
    assert powerbi_brief(None) == "" and powerbi_brief({"error": "down"}) == "" and powerbi_brief({"shots": []}) == ""
    brief = powerbi_brief({"shots": [{}], "filename": "kpi.csv", "header": "date,platform,impressions", "summary": "2.66M\nImpressions",
                           "visuals": '4 x Card; Donut chart "Impressions by Platform"', "pages": ["Overview", "Trends"]})
    assert "kpi.csv" in brief and "date,platform,impressions" in brief and "2.66M" in brief
    assert "4 x Card" in brief and "Donut chart" in brief and "Overview, Trends" in brief and "not a Pie" in brief
    assert "do not describe renaming" in brief and "FIRST" in brief


def test_the_visual_inventory_names_chart_types_and_counts_cards():
    inventory = powerbi_capture.visual_inventory([
        {"type": "card", "title": "Impressions"}, {"type": "card", "title": "Reach"}, {"type": "slicer", "title": "Platform"},
        {"type": "donut", "title": "Sum of Impressions by Platform"}, {"type": "line", "title": ""}, {"type": "weird", "title": "x"}])
    assert inventory == '2 x Card; Slicer "Platform"; Donut chart "Sum of Impressions by Platform"; Line chart; weird "x"'
    assert powerbi_capture.visual_inventory([]) == ""


# ----------------------------------------------------------------------------- the capture driver
STUDIO_PAGE = b"""<!doctype html><html><head><title>studio</title></head><body>
<header><span id="t">Untitled - Power BI Desktop</span></header>
<main id="m"><p>Add data to your report</p></main>
<button aria-label="Table view" onclick="document.getElementById('m').dataset.view='table'">T</button>
<input type="file">
<script>
// Like the real page, the file handler is attached late: a file handed over earlier is lost.
setTimeout(function () {
  document.querySelector('input[type=file]').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    f.text().then(function (text) {
      var cols = text.split('\\n')[0];
      document.getElementById('t').textContent = f.name.replace('.csv', '') + ' - Power BI Desktop';
      document.getElementById('m').innerHTML = '<div style="width:300px;height:100px;background:#6cf">KPI ' + cols + '</div>';
    });
  });
}, 1500);
</script></body></html>"""


@pytest.fixture
def studio():
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200 if self.path.startswith("/power-bi") else 404)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(STUDIO_PAGE if self.path.startswith("/power-bi") else b"no")

        def log_message(self, *args):
            pass
    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield "http://127.0.0.1:%d" % server.server_port
    server.shutdown()


def test_the_driver_loads_the_csv_survives_a_late_handler_and_screenshots_both_views(studio, tmp_path, monkeypatch):
    pytest.importorskip("playwright")
    monkeypatch.setattr(powerbi_capture.settings, "POWERBI_STUDIO_URL", studio)
    try:
        result = asyncio.run(powerbi_capture.capture_powerbi(KPI_CSV, tmp_path / "out", "dashboard built from kpi.csv"))
    except powerbi_capture.PowerBiCaptureUnavailable as error:
        # Only a missing browser is an environment problem. A page that did not take the file is a real failure.
        if "capture browser is not available" in str(error):
            pytest.skip("no capture browser here")
        raise
    assert [shot["slot"] for shot in result["shots"]] == ["powerbi_dashboard", None]
    for shot in result["shots"]:
        assert Image.open(shot["path"]).size[0] >= 1800
    assert "KPI date,platform,impressions" in result["summary"] and "Add data" not in result["summary"]
    assert result["shots"][0]["caption"].startswith("Report view")


def test_the_studio_sees_the_students_file_name_not_the_random_stored_name(studio, tmp_path, monkeypatch):
    pytest.importorskip("playwright")
    monkeypatch.setattr(powerbi_capture.settings, "POWERBI_STUDIO_URL", studio)
    stored = tmp_path / "ac6a895a05f743839c92e253a5758a86.csv"
    stored.write_bytes(b"a,b\n1,2\n")
    payload = powerbi_capture._upload_payload(stored, "my kpis.csv")
    assert payload["name"] == "my kpis.csv" and payload["buffer"] == b"a,b\n1,2\n"
    assert powerbi_capture._upload_payload(stored, "../../evil name?.csv")["name"] == ".._.._evil name_.csv"
    assert powerbi_capture._upload_payload(stored, "report")["name"] == "report.csv"
    assert powerbi_capture._upload_payload(stored, None)["name"] == stored.name
    try:
        result = asyncio.run(powerbi_capture.capture_powerbi(stored, tmp_path / "out", "x", display_name="my kpis.csv"))
    except powerbi_capture.PowerBiCaptureUnavailable as error:
        if "capture browser is not available" in str(error):
            pytest.skip("no capture browser here")
        raise
    # The fake studio titles itself from the file name it receives, exactly like the real page.
    assert "KPI a,b" in result["summary"]


def test_an_unreachable_studio_is_reported_not_raised_as_a_crash(tmp_path, monkeypatch):
    pytest.importorskip("playwright")
    monkeypatch.setattr(powerbi_capture.settings, "POWERBI_STUDIO_URL", "http://127.0.0.1:9")
    with pytest.raises(powerbi_capture.PowerBiCaptureUnavailable):
        asyncio.run(powerbi_capture.capture_powerbi(KPI_CSV, tmp_path / "out"))


@pytest.mark.parametrize("url", ["ftp://example.com", "javascript:alert(1)", "http://", "file:///etc/passwd"])
def test_only_http_studio_addresses_are_used(url, monkeypatch):
    monkeypatch.setattr(powerbi_capture.settings, "POWERBI_STUDIO_URL", url)
    with pytest.raises(powerbi_capture.PowerBiCaptureUnavailable):
        powerbi_capture.studio_url()


def test_studio_url_prefers_its_own_setting_then_the_frontend(monkeypatch):
    s = powerbi_capture.settings
    monkeypatch.setattr(s, "POWERBI_STUDIO_URL", "https://studio.example.com/")
    assert powerbi_capture.studio_url() == "https://studio.example.com/power-bi"
    monkeypatch.setattr(s, "POWERBI_STUDIO_URL", "")
    monkeypatch.setattr(s, "FRONTEND_URL", "https://app.example.com")
    assert powerbi_capture.studio_url() == "https://app.example.com/power-bi"
    monkeypatch.setattr(s, "FRONTEND_URL", "")
    assert powerbi_capture.studio_url() == "http://localhost:3000/power-bi"
