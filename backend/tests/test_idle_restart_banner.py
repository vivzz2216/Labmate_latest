import pytest
from playwright.async_api import async_playwright

from app.services.screenshot_service import screenshot_service
from app.services.browser_capture import launch_capture_browser


@pytest.mark.asyncio
@pytest.mark.parametrize('filename', ['exp1.py', 'experiment_12_file_handling_and_exception_management_program.py'])
async def test_idle_restart_banner_stays_on_one_line(tmp_path, filename):
    html = await screenshot_service._render_template('print("hi")', 'hi\n', 'idle', filename=filename)
    async with async_playwright() as playwright:
        browser = await launch_capture_browser(playwright)
        try:
            page = await browser.new_page(viewport={'width': 1000, 'height': 700})
            await page.set_content(html)
            line = page.locator('.restart-line')
            assert await line.count() == 1
            box = await line.bounding_box()
            assert box['height'] < (30 if len(filename) < 40 else 60), box   # the bars shrink; only an over-long path wraps, as in IDLE
            text = await line.inner_text()
            assert 'RESTART: ' in text and filename in text and text.strip().startswith('=') and text.strip().endswith('=')
            await page.screenshot(path=str(tmp_path / 'idle.png'))
        finally:
            await browser.close()


def test_vscode_status_bar_names_the_language_not_file():
    from app.services.screenshot_service import _language_label
    assert _language_label('exp1_stack.c', 'file') == 'C'
    assert _language_label('graph.cpp', 'file') == 'C++'
    assert _language_label('Main.java', 'file') == 'Java'
    assert _language_label('notes.xyz', 'file') == 'File'
