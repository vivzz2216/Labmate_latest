from copy import deepcopy
from unittest.mock import AsyncMock, patch

import pytest

from app.services.assignment_workflow import saved_frontend_draft
from app.services.web_project import generate_web_project


def failed_result():
    return {'status':'failed','language':'react','answer':'Restaurant','error':'Theme attribute was read from the button.',
        'code':'import App from "./App.jsx";',
        'project_files':{'src/main.jsx':'import App from "./App.jsx";',
            'src/App.jsx':'export default function App(){ return <div data-theme="light">COMPONENT_MARKER</div> }',
            'README.md':'Run npm install and npx vite.'},
        'verification':{'tests':[{'version':2,'name':'Theme','status':'failed','requirement_ids':['theme'],
            'viewport':{'width':1366,'height':768},'steps':[{'action':'click','locator_type':'role',
                'role':'button','locator':'Dark mode','value':''}]}]}}


def test_saved_frontend_preserves_source_and_canonical_tests_without_mutation():
    result=failed_result();original=deepcopy(result)
    draft=saved_frontend_draft(result)
    assert draft['entrypoint']=='src/main.jsx'
    assert 'src/App.jsx' in draft['source_capture_files']
    assert draft['browser_tests'][0]['steps'][0]['locator_type']=='role:button'
    assert 'status' not in draft['browser_tests'][0]
    assert result==original
    assert saved_frontend_draft({**result,'status':'completed'}) is None
    result['project_files']['duplicate.jsx']=result['code']
    assert saved_frontend_draft(result) is None  # Never guess an ambiguous entrypoint.


@pytest.mark.asyncio
@pytest.mark.parametrize('large_project',[False,True])
async def test_repair_prompt_contains_functional_component_and_existing_tests(large_project):
    source='<h1>Page</h1>'
    response={'answer':'Page','entrypoint':'index.html','source_capture_files':['index.html'],
        'files':[{'path':'index.html','content':source}],'readme':'Open index.html in a browser.',
        'browser_tests':[{'name':'Render','requirement_ids':[],'viewport':{'width':1366,'height':768},
            'steps':[{'action':'assert_visible','locator_type':'text','locator':'Page','value':''}]}]}
    previous=saved_frontend_draft(failed_result())
    if large_project:previous['files'].append({'path':'src/styles.css','content':'a'*40000})
    with patch('app.services.web_project.generation_service.generate_json',AsyncMock(return_value=response)) as model:
        await generate_web_project('Create a static HTML heading.','html',previous=previous,
            failure='Theme attribute was read from the button.')
    prompt=model.call_args.args[1]
    assert 'COMPONENT_MARKER' in prompt
    assert 'role:button' in prompt and 'Dark mode' in prompt
    assert 'Preserve working behavior' in prompt
    assert 'Theme attribute was read from the button.' in prompt
