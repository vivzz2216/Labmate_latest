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
    def test_blank_capture_uses_source_filename_in_frame(self):
        async def capture(root):
            screenshots=root/'screenshots'; screenshots.mkdir()
            raw=screenshots/'raw.png'; Image.new('RGB',(400,200),'white').save(raw)
            rendered=[]
            async def fake_header(html,path,width,height):
                rendered.append(html);Image.new('RGB',(width,height),'white').save(path)
                return True,width,height
            with patch.object(settings,'SCREENSHOT_DIR',str(screenshots)), \
                 patch.object(screenshot_service,'_take_screenshot',side_effect=fake_header):
                ok,_,_,_=await screenshot_service.generate_browser_preview_from_image(
                    str(raw),'test','folder/my_lab.html',page_url='about:blank')
            self.assertTrue(ok)
            self.assertIn('my_lab.html',rendered[0])
            self.assertNotIn('about:blank',rendered[0])
            self.assertNotIn('folder/my_lab.html',rendered[0])
        with tempfile.TemporaryDirectory(prefix='labmate-browser-name-') as folder:
            asyncio.run(capture(Path(folder)))

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

    def test_windows_frames_preserve_actual_page_pixels_and_localhost_origin(self):
        async def capture(root):
            with patch.object(settings, "SCREENSHOT_DIR", str(root / "screenshots")), \
                 patch.object(settings, "REACT_TEMP_DIR", str(root / "runtime")):
                execution = await runtime_engine.execute(
                    "<!doctype html><html><head><title>Laboratory result</title></head><body><h1>Laboratory result</h1></body></html>",
                    "html", "index.html")
                self.assertTrue(execution.success, execution.error)
                raw = next(iter(execution.screenshots.values()))
                metadata = execution.verification['captures'][0]
                self.assertEqual(metadata['url'], 'http://localhost/index.html')
                self.assertEqual(metadata['title'], 'Laboratory result')
                headers=[]
                for theme in ['edge', 'chrome']:
                    ok, path, width, height = await screenshot_service.generate_browser_preview_from_image(
                        raw, "preview_test", "index.html", browser_theme=theme,
                        page_url=metadata['url'], page_title=metadata['title'])
                    self.assertTrue(ok, path)
                    self.assertNotEqual(path, raw)
                    with Image.open(path) as image, Image.open(raw) as content:
                        self.assertEqual(image.size, (content.width, content.height + 88))
                        self.assertEqual(image.crop((0,88,width,height)).tobytes(), content.convert('RGB').tobytes())
                        headers.append(image.crop((0,0,width,88)).tobytes())
                self.assertNotEqual(headers[0], headers[1])

        with tempfile.TemporaryDirectory(prefix="labmate-browser-preview-") as folder:
            asyncio.run(capture(Path(folder)))

    def test_api_defaults_to_edge_and_rejects_unknown_frames(self):
        from pydantic import ValidationError
        from app.routers.workflows import QuestionInput
        self.assertEqual(QuestionInput(id=1,text='Build a web page',language='html').browser_theme,'edge')
        self.assertEqual(QuestionInput(id=1,text='Build a web page',language='react',browser_theme='chrome').browser_theme,'chrome')
        with self.assertRaises(ValidationError):
            QuestionInput(id=1,text='Build a web page',browser_theme='safari')
