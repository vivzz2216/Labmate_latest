import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app as main_app, serve_screenshot
from app.security.signed_assets import screenshot_url


class PrivateAssetsTests(unittest.TestCase):
    def test_app_does_not_expose_upload_or_report_directories(self):
        client = TestClient(main_app)
        self.assertEqual(client.get("/uploads/private.docx").status_code, 404)
        self.assertEqual(client.get("/reports/private.docx").status_code, 404)

    def test_screenshot_requires_valid_short_lived_link(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(settings, "SCREENSHOT_DIR", folder), patch.object(settings, "SECRET_KEY", "test-only-signing-key"):
            asset = Path(folder) / "job_1" / "actual.png"
            asset.parent.mkdir()
            asset.write_bytes(b"\x89PNG\r\n\x1a\n")
            app = FastAPI()
            app.add_api_route("/screenshots/{file_path:path}", serve_screenshot)
            with TestClient(app) as client:
                self.assertEqual(client.get("/screenshots/job_1/actual.png").status_code, 404)
                signed = screenshot_url(asset)
                self.assertEqual(client.get(signed).status_code, 200)
                self.assertEqual(client.get(signed.replace("job_1", "job_2")).status_code, 404)
                self.assertEqual(client.get(screenshot_url(asset, expires_at=1)).status_code, 404)
                self.assertEqual(client.get("/reports/secret.docx").status_code, 404)
