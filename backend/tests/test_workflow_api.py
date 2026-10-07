import tempfile
import unittest
from pathlib import Path

from docx import Document
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.middleware.auth import get_current_user
from app.models import AssignmentWorkflow, Report, Upload, User
from app.routers import assignments, download, workflows


class WorkflowApiTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        root = Path(self.folder.name)
        document = Document()
        document.add_paragraph("Original document + captured results")
        path = root / "final.docx"
        document.save(path)
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.factory = sessionmaker(bind=self.engine)
        with self.factory() as db:
            user = User(email="api-test@example.com", name="API Test")
            db.add(user); db.flush()
            upload = Upload(user_id=user.id, filename="source.docx", original_filename="source.docx", file_path=str(path), file_type="docx", file_size=path.stat().st_size)
            db.add(upload); db.flush()
            report = Report(upload_id=upload.id, filename="final.docx", file_path=str(path), file_size=path.stat().st_size)
            db.add(report); db.flush()
            db.add(AssignmentWorkflow(upload_id=upload.id, report_id=report.id, status="completed", stage="complete", progress=100, questions=[], results=[]))
            db.commit()
            self.upload_id, self.report_id, self.user_id = upload.id, report.id, user.id
        app = FastAPI()
        app.include_router(workflows.router, prefix="/api")
        app.include_router(download.router, prefix="/api")
        app.include_router(assignments.router, prefix="/api/assignments")
        def session():
            with self.factory() as db:
                yield db
        self.current_user = User(id=self.user_id, email="api-test@example.com", name="API Test")
        app.dependency_overrides[get_db] = session
        app.dependency_overrides[get_current_user] = lambda: self.current_user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()
        self.folder.cleanup()

    def test_completed_document_preview_download_and_real_report_link(self):
        state = self.client.get(f"/api/workflows/{self.upload_id}")
        self.assertEqual(state.status_code, 200)
        self.assertEqual(state.json()["report"]["id"], self.report_id)
        preview = self.client.get(f"/api/workflows/{self.upload_id}/preview")
        self.assertEqual(preview.status_code, 200)
        self.assertIn("Original document + captured results", preview.text)
        self.assertIn("Content-Security-Policy", preview.text)
        document = self.client.get(f"/api/download/{self.report_id}")
        self.assertEqual(document.status_code, 200)
        self.assertTrue(document.content.startswith(b"PK"))
        rows = self.client.get("/api/assignments/").json()
        self.assertEqual(rows[0]["report_download_url"], f"/api/download/{self.report_id}")

    def test_other_accounts_cannot_read_preview_or_download(self):
        self.current_user = User(id=self.user_id + 100, email="other@example.com", name="Other")
        self.assertEqual(self.client.get(f"/api/workflows/{self.upload_id}/preview").status_code, 404)
        self.assertEqual(self.client.get(f"/api/download/{self.report_id}").status_code, 403)
