"""Regression tests for the C/C++ lab manual's actual code and captures."""

import pytest
from PIL import Image

from app.services.runtime_engine import RuntimeEngine
from app.services.screenshot_service import ScreenshotService
from scripts.c_cpp_boss_cases import SAMPLE_STDIN, source_for
from scripts.run_c_cpp_boss_manuals import MANUALS_DATA, balanced_line_ranges


EXERCISES = [exercise for manual in MANUALS_DATA for exercise in manual["exercises"]]


@pytest.mark.parametrize("count", [1, 26, 29, 30, 31, 52, 53, 73, 100])
def test_balanced_ranges_cover_every_line_without_short_tail(count):
    ranges = balanced_line_ranges(count)
    assert [line for start, end in ranges for line in range(start, end + 1)] == list(range(1, count + 1))
    lengths = [end - start + 1 for start, end in ranges]
    assert max(lengths) <= 30
    assert max(lengths) - min(lengths) <= 1


@pytest.mark.asyncio
@pytest.mark.parametrize("exercise", EXERCISES, ids=lambda case: case["filename"])
async def test_manual_example_compiles_runs_and_has_real_stdout(exercise):
    name = exercise["filename"]
    code = source_for(exercise)
    result = await RuntimeEngine().execute(code, "cpp" if name.endswith(".cpp") else "c", name, stdin=SAMPLE_STDIN[name])
    assert result.success, f"{name}: {result.error}\n{result.output}"
    assert result.output.strip()
    assert "Process returned" not in result.output
    assert "Press any key" not in result.output
    assert all(end - start + 1 > 1 for start, end in balanced_line_ranges(len(code.splitlines())) if len(code.splitlines()) > 1)


@pytest.mark.asyncio
async def test_dynamic_statistics_reports_calculated_variance():
    exercise = next(case for case in EXERCISES if case["filename"] == "dynamic_stats.c")
    result = await RuntimeEngine().execute(source_for(exercise), "c", exercise["filename"], stdin=SAMPLE_STDIN[exercise["filename"]])
    assert result.success, result.error
    assert "Variance = 22.9000" in result.output


@pytest.mark.asyncio
async def test_tall_screenshot_is_not_cropped_to_initial_viewport(tmp_path):
    target = tmp_path / "long.png"
    html = "<html><body><pre>" + "\n".join(f"output line {i}" for i in range(80)) + "</pre></body></html>"
    ok, width, height = await ScreenshotService()._take_screenshot(html, str(target), width=600, minimum_height=480)
    assert ok
    with Image.open(target) as capture:
        assert capture.size == (width, height)
        assert height > 1000
