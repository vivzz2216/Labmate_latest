import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pydantic import ValidationError

from app.config import settings
from app.routers.workflows import QuestionInput
from app.services.screenshot_service import screenshot_service
from app.services.source_evidence import capture_source_evidence


class JupyterScreenshotTests(unittest.IsolatedAsyncioTestCase):
    def test_template_choice_is_validated_and_defaults_to_idle(self):
        self.assertEqual(QuestionInput(id=1, text='Print a sum').python_template, 'idle')
        self.assertEqual(QuestionInput(id=1, text='Print a sum', python_template='jupyter').python_template, 'jupyter')
        with self.assertRaises(ValidationError):
            QuestionInput(id=1, text='Print a sum', python_template='arbitrary-template')

    async def test_output_preserves_transcript_and_escapes_untrusted_text(self):
        html = await screenshot_service._render_template(
            screenshot_service._highlight_code('print("hello")', 'jupyter'),
            '<script>alert(1)</script>\nhello\n', 'jupyter',
            filename='hello.py', source_code='print("hello")', view_mode='output',
            input_echoed=True, error='ValueError: sample')
        self.assertIn('hello.ipynb', html)
        self.assertIn('Python 3 (ipykernel)', html)
        self.assertIn('&lt;script&gt;alert(1)&lt;/script&gt;', html)
        self.assertNotIn('<script>', html)
        self.assertIn('ValueError: sample', html)
        self.assertNotIn('IDLE Shell', html)

    async def test_long_source_is_complete_across_notebook_pages(self):
        code = '\n'.join(f'print("Line {i}")' for i in range(1, 72))
        with tempfile.TemporaryDirectory() as directory, patch.object(settings, 'SCREENSHOT_DIR', directory), \
             patch('app.services.storage_service.storage_service.sync_file'):
            frames, errors = await capture_source_evidence(
                None, code, 'lines.py', theme='jupyter', group='jupyter-test', username='Student',
                language='python', screenshot_style='style_1', policy='complete')
            self.assertFalse(errors, errors)
            self.assertEqual([f['source_ranges'] for f in frames], [[[1, 32]], [[33, 64]], [[65, 71]]])
            self.assertTrue(all(Path(f['path']).is_file() for f in frames))
            ok, path, width, height = await screenshot_service.generate_screenshot(
                code, 'Line 71\n', 'jupyter', filename='lines.py', job_id='jupyter-test',
                view_mode='output', input_echoed=True, presentation='ide_evidence')
            self.assertTrue(ok, path)
            self.assertEqual(width, 1100)
            self.assertGreaterEqual(height, 440)
