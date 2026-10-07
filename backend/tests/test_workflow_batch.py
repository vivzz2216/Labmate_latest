"""Batch API and ZIP regressions, including invalid-file isolation."""

import io
import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from zipfile import ZipFile

from docx import Document
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.middleware.auth import get_current_user
from app.middleware.csrf import require_csrf_token
from app.models import AssignmentWorkflow, Report, User, WorkflowBatchItem
from app.routers import workflows
from app.services.assignment_workflow import extract_assignment
from app.services.generation_service import GenerationUnavailableError
from app.services.workflow_queue import claim_next
from app.workflow_schema import ensure_workflow_columns
from sqlalchemy import inspect, text
from unittest.mock import AsyncMock


class BatchWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = Path(self.folder.name)
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.factory = sessionmaker(bind=self.engine)
        with self.factory() as db:
            user = User(email="batch@example.test", name="Batch Student")
            db.add(user)
            db.commit()
            self.user_id = user.id
        app = FastAPI()
        app.include_router(workflows.router, prefix="/api")

        def session():
            with self.factory() as db:
                yield db

        app.dependency_overrides[get_db] = session
        app.dependency_overrides[get_current_user] = lambda: User(id=self.user_id, email="batch@example.test", name="Batch Student")
        app.dependency_overrides[require_csrf_token] = lambda: True
        self.client = TestClient(app)
        self.patches = [
            patch.object(settings, "UPLOAD_DIR", str(self.root / "uploads")),
            patch.object(settings, "REPORT_DIR", str(self.root / "reports")),
            patch.object(settings, "SCREENSHOT_DIR", str(self.root / "screenshots")),
        ]
        for item in self.patches:
            item.start()
        document = Document()
        document.add_paragraph("Write a Python program to calculate factorial.")
        stream = io.BytesIO()
        document.save(stream)
        self.docx = stream.getvalue()

    def tearDown(self):
        self.client.close()
        for item in reversed(self.patches):
            item.stop()
        self.engine.dispose()
        self.folder.cleanup()

    def test_batch_status_file_failure_isolation_and_zip(self):
        response = self.client.post("/api/workflows/batch-upload", files=[
            ("files", ("first.docx", self.docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
            ("files", ("broken.pdf", b"not a PDF", "application/pdf")),
        ], data={"mode": "theory_and_code", "screenshot_style": "style_2"})
        self.assertEqual(response.status_code, 200, response.text)
        state = response.json()
        self.assertEqual(state["total"], 2)
        self.assertEqual([row["status"] for row in state["files"]], ["queued", "failed"])
        self.assertIn("valid PDF", state["files"][1]["error"])
        batch_id = state["batch_id"]
        self.assertEqual(self.client.get(f"/api/workflows/batch/{batch_id}/download-zip").status_code, 409)

        with self.factory() as db:
            workflow = db.get(AssignmentWorkflow, state["files"][0]["workflow_id"])
            self.assertEqual((workflow.mode, workflow.screenshot_style, workflow.batch_id),
                             ("theory_and_code", "style_2", batch_id))
            self.assertEqual(db.query(WorkflowBatchItem).filter_by(batch_id=batch_id).count(), 2)
            report_path = self.root / "reports" / "completed.docx"
            report_path.parent.mkdir(parents=True)
            report_path.write_bytes(self.docx)
            screenshot_path = self.root / "screenshots" / "capture.png"
            screenshot_path.parent.mkdir(parents=True)
            Image.new("RGB", (120, 60), "white").save(screenshot_path)
            report = Report(upload_id=workflow.upload_id, filename="completed.docx",
                            file_path=str(report_path), file_size=report_path.stat().st_size)
            db.add(report)
            db.flush()
            workflow.report_id = report.id
            workflow.status, workflow.stage, workflow.progress = "completed", "complete", 100
            workflow.results = [{"screenshot_paths": [str(screenshot_path)]}]
            db.commit()

        status = self.client.get(f"/api/workflows/batch/{batch_id}").json()
        self.assertTrue(status["ready_to_download"])
        self.assertEqual((status["completed"], status["failed"]), (1, 1))
        archive_response = self.client.get(f"/api/workflows/batch/{batch_id}/download-zip")
        self.assertEqual(archive_response.status_code, 200, archive_response.text)
        self.assertIn(f"LabMate_Completed_Batch_{batch_id[:8]}.zip", archive_response.headers["content-disposition"])
        with ZipFile(io.BytesIO(archive_response.content)) as archive:
            names = archive.namelist()
            self.assertTrue(any(name.startswith("reports/") and name.endswith(".docx") for name in names))
            self.assertTrue(any(name.startswith("screenshots/") and name.endswith(".png") for name in names))
            self.assertIn("broken.pdf", archive.read("errors.json").decode())
        with self.factory() as db:
            workflow = db.get(AssignmentWorkflow, state["files"][0]["workflow_id"])
            workflow.results = [{"screenshot_paths": [str(self.root / "screenshots" / "missing.png")]}]
            db.commit()
        retry_archive = self.client.get(f"/api/workflows/batch/{batch_id}/download-zip")
        self.assertEqual(retry_archive.status_code, 200)
        with ZipFile(io.BytesIO(retry_archive.content)) as archive:
            self.assertTrue(any(name.startswith("reports/") for name in archive.namelist()))
            self.assertIn("Screenshot 1 is unavailable", archive.read("errors.json").decode())
        self.user_id += 100
        self.assertEqual(self.client.get(f"/api/workflows/batch/{batch_id}").status_code, 404)
        self.assertEqual(self.client.get(f"/api/workflows/batch/{batch_id}/download-zip").status_code, 404)

    def test_limit_and_capacity_do_not_leave_uploaded_files(self):
        too_many = [("files", (f"{index}.docx", self.docx, "application/octet-stream")) for index in range(11)]
        self.assertEqual(self.client.post("/api/workflows/batch-upload", files=too_many).status_code, 400)
        with patch.object(settings, "WORKFLOW_USER_QUEUE_LIMIT", 0):
            self.assertEqual(self.client.post("/api/workflows/batch-upload", files=[too_many[0]]).status_code, 429)
        self.assertEqual(list((self.root / "uploads").glob("*")), [])

    def test_batch_extraction_automatically_enqueues_generation(self):
        response = self.client.post("/api/workflows/batch-upload", files=[
            ("files", ("lab.docx", self.docx, "application/octet-stream")),
        ])
        self.assertEqual(response.status_code, 200, response.text)
        workflow_id = response.json()["files"][0]["workflow_id"]
        extracted = {"questions": [{"text": "Write a Python program to calculate factorial.", "language": "python"}]}
        with patch("app.services.assignment_workflow.SessionLocal", self.factory), \
             patch("app.services.assignment_workflow.generation_service.generate_json", AsyncMock(return_value=extracted)):
            asyncio.run(extract_assignment(workflow_id))
        with self.factory() as db:
            workflow = db.get(AssignmentWorkflow, workflow_id)
            self.assertEqual((workflow.status, workflow.stage), ("queued", "generate"))
            self.assertEqual(len(workflow.questions), 1)
        with patch("app.services.workflow_queue.SessionLocal", self.factory):
            self.assertEqual(claim_next(), (workflow_id, "generate"))

    def test_one_provider_failure_is_recorded_without_blocking_next_file(self):
        response = self.client.post("/api/workflows/batch-upload", files=[
            ("files", ("one.docx", self.docx, "application/octet-stream")),
            ("files", ("two.docx", self.docx, "application/octet-stream")),
        ])
        self.assertEqual(response.status_code, 200, response.text)
        state = response.json()
        first, second = (item["workflow_id"] for item in state["files"])
        with patch("app.services.assignment_workflow.SessionLocal", self.factory), \
             patch("app.services.assignment_workflow.generation_service.generate_json",
                   AsyncMock(side_effect=GenerationUnavailableError("Provider unavailable"))), \
             patch("app.services.assignment_workflow.parser_service.parse_file", AsyncMock(return_value=[])):
            asyncio.run(extract_assignment(first))
        status = self.client.get(f"/api/workflows/batch/{state['batch_id']}").json()
        self.assertEqual(status["files"][0]["status"], "failed")
        self.assertEqual(status["files"][1]["status"], "queued")
        self.assertIn("Provider unavailable", status["files"][0]["error"])
        with patch("app.services.workflow_queue.SessionLocal", self.factory):
            self.assertEqual(claim_next(), (second, "extract"))


class WorkflowSchemaTests(unittest.TestCase):
    def test_existing_workflow_table_receives_batch_columns(self):
        engine = create_engine("sqlite:///:memory:")
        try:
            with engine.begin() as connection:
                connection.execute(text("CREATE TABLE assignment_workflows (id INTEGER PRIMARY KEY, upload_id INTEGER)"))
            ensure_workflow_columns(engine)
            ensure_workflow_columns(engine)
            columns = {column["name"] for column in inspect(engine).get_columns("assignment_workflows")}
            self.assertTrue({"batch_id", "mode", "screenshot_style"} <= columns)
        finally:
            engine.dispose()
