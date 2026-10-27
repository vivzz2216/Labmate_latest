import pytest
import os
from PIL import Image
from app.services.screenshot_service import screenshot_service

@pytest.mark.asyncio
async def test_sql_workbench_screenshot_capture():
    sql = """CREATE TABLE Students (
  id INTEGER PRIMARY KEY,
  name VARCHAR(50),
  marks DECIMAL(5,2)
);
INSERT INTO Students VALUES (1, 'Amit', 85.00), (2, 'Neha', 95.00);
SELECT * FROM Students WHERE marks >= 90;"""

    success, path, width, height = await screenshot_service.generate_screenshot(
        code=sql,
        output="",
        theme="sql",
        filename="students.sql"
    )

    assert success is True, "Screenshot generation should succeed"
    assert os.path.isfile(path), f"Screenshot file should exist at {path}"
    assert width == 1440, f"Expected width 1440, got {width}"
    assert height == 900, f"Expected height 900, got {height}"

    with Image.open(path) as img:
        assert img.width == 1440
        assert img.height == 900

    # Clean up
    if os.path.exists(path):
        os.remove(path)
