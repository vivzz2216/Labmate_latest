import io
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException, UploadFile

from app.config import settings
from app.routers.upload import SetFilenameRequest, set_custom_filename, upload_file


class CountingFile(io.BytesIO):
    def __init__(self, content):
        super().__init__(content)
        self.largest_read = 0

    def read(self, size=-1):
        self.largest_read = max(self.largest_read, size)
        if size < 0:
            raise AssertionError("Upload read without a size bound")
        return super().read(size)


class StreamingUploadTests(unittest.IsolatedAsyncioTestCase):
    async def test_large_upload_is_streamed_in_bounded_chunks(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(settings, "UPLOAD_DIR", directory):
            payload = CountingFile(b"%PDF-1.4\n" + b"a" * (3 * 1024 * 1024))
            file = UploadFile(filename="lab.pdf", file=payload)
            db = Mock()
            def refresh(upload):
                upload.id = 42
                upload.uploaded_at = datetime.now(timezone.utc)
            db.refresh.side_effect = refresh
            with patch("app.routers.upload.magic") as magic:
                magic.Magic.return_value.from_buffer.return_value = "application/pdf"
                result = await upload_file(None, file, db, SimpleNamespace(id=1), True)
            self.assertEqual(result.id, 42)
            self.assertLessEqual(payload.largest_read, 1024 * 1024)

    async def test_oversize_upload_is_rejected_and_removed(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(settings, "UPLOAD_DIR", directory), patch.object(settings, "MAX_FILE_SIZE", 1024):
            file = UploadFile(filename="lab.pdf", file=CountingFile(b"%PDF-1.4\n" + b"a" * 2048))
            with self.assertRaises(HTTPException) as result:
                await upload_file(None, file, Mock(), SimpleNamespace(id=1), True)
            self.assertEqual(result.exception.status_code, 400)
            self.assertEqual(list(Path(directory).iterdir()), [])

    async def test_filename_change_requires_ownership(self):
        db = Mock()
        db.query.return_value.filter.return_value.first.return_value = None
        with self.assertRaises(HTTPException) as result:
            await set_custom_filename(SetFilenameRequest(upload_id=7, filename="mine"), db, SimpleNamespace(id=1), True)
        self.assertEqual(result.exception.status_code, 404)
        db.query.return_value.filter.assert_called_once()
