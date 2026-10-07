import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from app.config import settings
from app.services.screenshot_service import screenshot_service


class IdleScreenshotTests(unittest.IsolatedAsyncioTestCase):
    async def test_prompts_and_typed_values_keep_actual_output_order(self):
        code = 'a = int(input("Enter first number: "))\nb = int(input("Enter second number: "))\nprint("Sum:", a+b)'
        output = "Enter first number: Enter second number: Sum: 30\n"
        rendered = await screenshot_service._render_template(
            screenshot_service._highlight_code(code, "idle"), output, "idle",
            filename="sum.py", username="Student", source_code=code, stdin_data="25\n5\n",
        )
        self.assertIn("Enter first number: 25", rendered)
        self.assertIn("Enter second number: 5", rendered)
        self.assertIn('class="shell-stdout">Sum: 30', rendered)
        self.assertLess(rendered.index("Enter first number: 25"), rendered.index("Enter second number: 5"))
        self.assertLess(rendered.index("Enter second number: 5"), rendered.index("Sum: 30"))
        self.assertIn("C:/Users/Student/Desktop/sum.py", rendered)
        self.assertIn("Python 3.11.4 Shell", rendered)
        self.assertNotIn("#12161c", rendered)
        self.assertNotIn("#e8edf3", rendered)

    async def test_shell_only_preserves_long_output_and_errors(self):
        output = "Line 1\n\n" + "Result " * 310 + "\nLast line\n"
        rendered = await screenshot_service._render_template(
            "print('done')", output, "idle", filename="../../evil.py",
            username="Student", source_code="print('done')", error="Traceback: issue", view_mode="shell",
        )
        self.assertNotIn('class="win-window editor-window"', rendered)
        self.assertIn("Last line", rendered)
        self.assertIn('class="shell-stderr">Traceback: issue', rendered)
        self.assertIn("C:/Users/Student/Desktop/evil.py", rendered)
        self.assertNotIn("../../evil.py", rendered)

    async def test_editor_only_and_repeated_prompts_show_every_input(self):
        code = 'for _ in range(3):\n    value = input("Enter value: ")\n    print(value)'
        output = "Enter value: a\nEnter value: b\nEnter value: c\n"
        editor = await screenshot_service._render_template(
            screenshot_service._highlight_code(code, "idle"), output, "idle",
            filename="values.py", source_code=code, stdin_data="a\nb\nc\n", view_mode="editor",
        )
        shell = await screenshot_service._render_template(
            screenshot_service._highlight_code(code, "idle"), output, "idle",
            filename="values.py", source_code=code, stdin_data="a\nb\nc\n", view_mode="shell",
        )
        self.assertNotIn('class="win-window shell-window"', editor)
        self.assertNotIn('class="win-window editor-window"', shell)
        for value in ("a", "b", "c"):
            self.assertIn(f"Enter value: {value}", shell)

    async def test_real_capture_is_white_and_1000_pixels_wide(self):
        code = 'first = int(input("Enter first number: "))\nprint("Result:", first * 2)'
        with tempfile.TemporaryDirectory() as directory, patch.object(settings, "SCREENSHOT_DIR", directory):
            success, path, width, height = await screenshot_service.generate_screenshot(
                code, "Enter first number: Result: 50\n", "idle",
                job_id="idle-preview", filename="sum.py", stdin_data="25\n", view_mode="shell",
            )
            self.assertTrue(success, path)
            self.assertEqual(width, 840)
            self.assertTrue(Path(path).is_file())
            with Image.open(path).convert("RGB") as image:
                self.assertEqual(image.getpixel((0, 0)), (255, 255, 255))
                self.assertEqual(image.getpixel((500, 200)), (255, 255, 255))
