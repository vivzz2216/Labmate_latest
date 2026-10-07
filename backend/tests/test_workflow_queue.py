import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import AssignmentWorkflow, Upload, User
from app.routers.workflows import check_queue_capacity
from app.services import workflow_queue


class DurableQueueTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.engine = create_engine("sqlite:///" + str(Path(self.folder.name) / "queue.db"),
                                    connect_args={"check_same_thread": False})
        Base.metadata.create_all(self.engine)
        self.factory = sessionmaker(bind=self.engine, expire_on_commit=False)

    def tearDown(self):
        self.engine.dispose()
        self.folder.cleanup()

    def seed(self, count):
        with self.factory() as db:
            for number in range(count):
                user = User(email=f"student-{number}@example.test", name="Load student")
                db.add(user); db.flush()
                upload = Upload(user_id=user.id, filename="lab.docx", original_filename="lab.docx",
                                file_path="unused", file_type="docx", file_size=100)
                db.add(upload); db.flush()
                db.add(AssignmentWorkflow(upload_id=upload.id, status="queued", stage="extract"))
            db.commit()

    def test_500_students_are_queued_and_each_claim_is_unique(self):
        self.seed(500)
        with patch.object(workflow_queue, "SessionLocal", self.factory):
            claimed = [workflow_queue.claim_next() for _ in range(500)]
            self.assertEqual(len(set(item[0] for item in claimed)), 500)
            self.assertTrue(all(stage == "extract" for _, stage in claimed))
            self.assertIsNone(workflow_queue.claim_next())
        with self.factory() as db:
            self.assertEqual(db.query(AssignmentWorkflow).filter_by(status="extracting").count(), 500)

    def test_worker_restart_recovers_stale_processing_without_losing_results(self):
        self.seed(1)
        with self.factory() as db:
            item = db.query(AssignmentWorkflow).first()
            item.status = "processing"
            item.stage = "generate"
            item.results = [{"id": 1, "status": "completed"}]
            item.updated_at = datetime.now(timezone.utc) - timedelta(hours=1)
            db.commit()
        with patch.object(workflow_queue, "SessionLocal", self.factory):
            self.assertEqual(workflow_queue.recover_stale_workflows(), 1)
            self.assertEqual(workflow_queue.claim_next()[1], "generate")
        with self.factory() as db:
            self.assertEqual(len(db.query(AssignmentWorkflow).first().results), 1)

    def test_per_student_active_limit_returns_429(self):
        self.seed(1)
        with self.factory() as db, patch("app.routers.workflows.settings.WORKFLOW_USER_QUEUE_LIMIT", 1):
            user = db.query(User).first()
            with self.assertRaises(HTTPException) as failure:
                check_queue_capacity(db, user.id)
            self.assertEqual(failure.exception.status_code, 429)
