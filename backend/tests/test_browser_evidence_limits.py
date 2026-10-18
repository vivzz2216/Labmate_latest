import pytest

from app.config import settings
from app.services.runtime_engine import runtime_engine, write_project_files


@pytest.mark.asyncio
async def test_explicit_console_errors_are_recorded(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'SCREENSHOT_DIR', str(tmp_path/'screenshots'))
    monkeypatch.setattr(settings, 'REACT_TEMP_DIR', str(tmp_path/'runtime'))
    result = await runtime_engine.execute('<h1>Static page</h1><script>console.error("Audit diagnostic")</script>', 'html')
    assert 'Audit diagnostic' in result.verification['console_errors']


@pytest.mark.asyncio
async def test_overlong_browser_page_fails_instead_of_silently_clipping(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'SCREENSHOT_DIR', str(tmp_path/'screenshots'))
    monkeypatch.setattr(settings, 'REACT_TEMP_DIR', str(tmp_path/'runtime'))
    result = await runtime_engine.execute('<main style="height:17000px">Evidence exceeds capture limit</main>', 'html')
    assert not result.success
    assert not result.screenshots
    assert 'could not be captured' in result.error


@pytest.mark.parametrize('files', [{'../outside.js': 'bad'}, {42: 'bad'}, {'source.js': b'bad'}, {'node_modules/evil.js': 'bad'}])
def test_project_files_cannot_escape_or_supply_binary_contents(tmp_path, files):
    with pytest.raises(ValueError): write_project_files(tmp_path, files)
