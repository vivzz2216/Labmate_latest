"""Executable capability regression matrix; blocked capabilities are asserted as unsupported."""
import pytest
from app.config import settings
from app.services.runtime_engine import runtime_engine
from app.services.evidence_planner import experiment_category
from fixtures.capability_cases import all_cases

@pytest.mark.asyncio
@pytest.mark.parametrize('case',all_cases(),ids=lambda case:case['id'])
async def test_capability_fixture(case,tmp_path,monkeypatch):
    # Persistent pinned dependency cache, private workspace for each execution.
    monkeypatch.setattr(settings,'REACT_TEMP_DIR',str(tmp_path.parent/'audit-runtime'))
    monkeypatch.setattr(settings,'SCREENSHOT_DIR',str(tmp_path/'screenshots'))
    monkeypatch.setattr(settings,'EXECUTION_TIMEOUT',case.get('timeout',10))
    result=await runtime_engine.execute(case['code'],case['language'],stdin=case.get('stdin'),project_files=case.get('project_files'),routes=case.get('routes'),browser_tests=case.get('browser_tests'),api_tests=case.get('api_tests'),objective=case.get('objective',''))
    if case.get('blocked'):
        assert not result.success and result.exit_code==69
        assert case['blocked'] in result.error
        assert not result.screenshots, 'No GUI evidence may be manufactured'
    elif case.get('failure'):
        assert not result.success
        if case['failure']=='compile':assert result.stages.get('compile')=='failed'
        if case['failure']=='runtime' and case['language'] in {'c','cpp','java'}:assert result.stages.get('compile')=='passed'
        if case['failure']=='timeout':assert result.exit_code==124
    else:
        assert result.success,result.error
        if case.get('expected'):
            if experiment_category(case['language'], case.get('objective',''), case['code']) == 'console':
                assert result.output.strip().splitlines()[-1] == case['expected']
            else:
                assert case['expected'] in result.output
        if case.get('browser_tests') or case.get('api_tests'):assert result.verification['status']=='passed'
