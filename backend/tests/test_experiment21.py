"""Run the real saved HTML project through the production capture engine."""
import json
from dataclasses import asdict
from pathlib import Path

import pytest
from app.config import settings
from app.services.runtime_engine import runtime_engine

FIXTURE = Path(__file__).parent / 'fixtures' / 'experiment21'


@pytest.mark.asyncio
async def test_experiment21_interactions_persistence_and_responsive_layout(tmp_path, monkeypatch):
    files = {name: (FIXTURE / name).read_text(encoding='utf-8') for name in ('index.html','script.js','styles.css')}
    tests = json.loads((FIXTURE / 'browser-tests.json').read_text(encoding='utf-8'))
    monkeypatch.setattr(settings, 'SCREENSHOT_DIR', str(tmp_path))
    result = await runtime_engine.execute(files['index.html'], 'html', project_files=files,
        browser_tests=tests, interaction_is_required=True,
        objective='Build an HTML task board with validation, editing, search, confirmed deletion, persistence and responsive layout.')
    (tmp_path / 'proof.json').write_text(json.dumps(asdict(result), indent=2), encoding='utf-8')
    assert result.success, result.error
    assert result.verification['status'] == 'passed'
    assert len(result.verification['tests']) == len(tests)
    assert all(t['status'] == 'passed' for t in result.verification['tests'])
    assert result.screenshots
