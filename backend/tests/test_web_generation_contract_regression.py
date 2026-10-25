from unittest.mock import AsyncMock, patch

import pytest
from jsonschema import ValidationError, validate

from app.services.generation_service import strict_json_schema
from app.services.web_project import generate_web_project
from app.services.web_generation_protocol import canonical_web_data


def test_react_html_shell_resolves_only_an_existing_unambiguous_module():
    schema={'properties':{'entrypoint':{},'files':{}}}
    raw={'entrypoint':'index.html','files':[{'path':'index.html','content':'<div id="root"></div><script type="module" src="/src/main.jsx"></script>'},
        {'path':'src/main.jsx','content':'import App from "./App.jsx";'},{'path':'src/App.jsx','content':'export default function App(){return <main/>}'}]}
    canonical=canonical_web_data(raw,schema,[],project_type='react')
    assert canonical['entrypoint']=='src/main.jsx'
    assert raw['entrypoint']=='index.html'
    assert canonical['files']==raw['files']
    missing={**raw,'files':raw['files'][:1]}
    assert canonical_web_data(missing,schema,[],project_type='react')['entrypoint']=='index.html'


@pytest.mark.asyncio
async def test_single_page_schema_rejects_unnecessary_navigation():
    source = '<main><h1>Calculator</h1><label>First<input></label><label>Second<input></label><button>Add</button><output>Result: 5</output></main>'
    response = {'answer':'Calculator page.','entrypoint':'index.html', 'source_capture_files':['index.html'],
        'files':[{'path':'index.html','content':source}], 'readme':'Open index.html in a browser.',
        'browser_tests':[{'name':'Calculation','requirement_ids':['calculation'],'viewport':{'width':1366,'height':768},
            'steps':[{'action':'fill','locator_type':'label','locator':'First','value':'2'},
                     {'action':'fill','locator_type':'label','locator':'Second','value':'3'},
                     {'action':'click','locator_type':'role:button','locator':'Add','value':''},
                     {'action':'assert_visible','locator_type':'text','locator':'Result: 5','value':''}]}]}
    with patch('app.services.web_project.generation_service.generate_json',AsyncMock(return_value=response)) as generate:
        await generate_web_project('Create a standalone HTML calculator with an Add button.','html')
    schema = generate.await_args.args[2]
    step_schema = strict_json_schema(schema)['properties']['browser_tests']['items']['properties']['steps']['items']
    validate({'action':'assert_visible','locator_type':'text','locator':'Result: 5','value':''},step_schema)
    for path in ['', 'index.html','http://localhost:3000/','/']:
        with pytest.raises(ValidationError):
            validate({'action':'goto','locator_type':'page','locator':'','value':path},step_schema)


@pytest.mark.asyncio
async def test_requested_navigation_remains_supported_by_generation_schema():
    response = {'answer':'Static navigation.','entrypoint':'index.html','source_capture_files':['index.html'],
        'files':[{'path':'index.html','content':'<main><a href="/details">Details</a><h1>Home</h1></main>'}],
        'readme':'Open index.html in a browser.',
        'browser_tests':[{'name':'Navigation','requirement_ids':['navigation'],'viewport':{'width':1366,'height':768},
            'steps':[{'action':'click','locator_type':'role:link','locator':'Details','value':''},
                     {'action':'assert_visible','locator_type':'text','locator':'Home','value':''}]}]}
    with patch('app.services.web_project.generation_service.generate_json',AsyncMock(return_value=response)) as generate:
        await generate_web_project('Create an HTML page with navigation links.','html')
    schema = generate.await_args.args[2]
    step_schema = strict_json_schema(schema)['properties']['browser_tests']['items']['properties']['steps']['items']
    validate({'action':'goto','locator_type':'page','locator':'','value':'/details'},step_schema)
