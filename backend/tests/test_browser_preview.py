import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from app.config import settings
from app.services.runtime_engine import runtime_engine
from app.services.screenshot_service import screenshot_service


class BrowserPreviewTests(unittest.TestCase):
    def test_offline_browser_rejects_broken_external_images(self):
        async def capture(root):
            with patch.object(settings, "SCREENSHOT_DIR", str(root / "screenshots")), \
                 patch.object(settings, "REACT_TEMP_DIR", str(root / "runtime")):
                result = await runtime_engine.execute(
                    '<html><body><img src="https://example.invalid/product.png"></body></html>',
                    "html", "index.html")
                self.assertFalse(result.success)
                self.assertIn("broken image", result.error)

        with tempfile.TemporaryDirectory(prefix="labmate-broken-image-") as folder:
            asyncio.run(capture(Path(folder)))

    def test_real_page_capture_is_framed_by_chrome_template(self):
        async def capture(root):
            with patch.object(settings, "SCREENSHOT_DIR", str(root / "screenshots")), \
                 patch.object(settings, "REACT_TEMP_DIR", str(root / "runtime")):
                execution = await runtime_engine.execute(
                    "<!doctype html><html><body><h1>Laboratory result</h1></body></html>",
                    "html", "index.html")
                self.assertTrue(execution.success, execution.error)
                raw = next(iter(execution.screenshots.values()))
                ok, path, width, height = await screenshot_service.generate_browser_preview_from_image(
                    raw, "preview_test", "index.html")
                self.assertTrue(ok, path)
                self.assertGreaterEqual(width, 1100)
                self.assertGreater(height, 700)
                with Image.open(path) as image:
                    self.assertEqual(image.size, (width, height))

        with tempfile.TemporaryDirectory(prefix="labmate-browser-preview-") as folder:
            asyncio.run(capture(Path(folder)))
