import json
import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx

from app.config import settings
from app.services.browser_scenarios import normalize_v2, validate_coverage_plan
from app.services.browser_scenarios import validate_run_coverage
from app.services.gemini_service import response_schema
from app.services.generation_service import GenerationService, GenerationError, GenerationUnavailableError
from app.services.gemini_service import GeminiUnavailableError, GeminiError
from app.services.manual_sections import numbered_experiments, ManualStructureError
from app.services.runtime_engine import runtime_engine
from app.services.web_project import validate_project, source_checks, web_requirements, generate_web_project


def step(action, locator='', value='', kind='page', role=''):
    return {'action': action, 'locator_type': kind, 'locator': locator, 'role': role, 'value': value}


def scenario(steps, ids=None, name='Scenario', width=1366):
    return {'version': 2, 'name': name, 'steps': steps, 'requirement_ids': ids or [], 'viewport': {'width': width, 'height': 768}}


def html_project(html, tests):
    return {'project_type': 'html', 'entrypoint': 'index.html', 'server_entrypoint': '',
            'project_files': {'index.html': html}, 'browser_tests': tests}


class WebContractTests(unittest.TestCase):
    def test_original_numbered_requirements_are_preserved(self):
        text = 'General Requirements\nUse labels.\nIndex\n' + '\n'.join(f'{i}. Index title' for i in range(1,11))
        for i in range(1,11):
            text += f'\nExperiment {i}: React app {i}\nProblem Statement\nBuild app {i}.\nTasks\nSupport editing original title {i}.\nEvidence to Submit\nCapture after reload.\nVerification Checklist\nNo duplicates.'
        result = numbered_experiments(text)
        self.assertEqual([r['id'] for r in result], list(range(1,11)))
        self.assertTrue(all('Use labels.' in r['text'] and 'No duplicates.' in r['text'] for r in result))
        self.assertIn('editing original title 9', result[8]['text'])
        with self.assertRaises(ManualStructureError): numbered_experiments(text+'\nExperiment 1: Duplicate\nBuild it.')
        with self.assertRaises(ManualStructureError): numbered_experiments('10 Experiments\nExperiment 1: Portfolio\nBuild an HTML page.')

    def test_static_text_and_coverage_labels_do_not_prove_creation(self):
        req=[{'id':'create','kind':'behavior'}]
        with self.assertRaisesRegex(ValueError,'no asserted state change'):
            validate_run_coverage(req,{'tests':[{'status':'passed','requirement_ids':['create'],'assertions':[{'action':'assert_visible','changed':False}]}]})

    def test_gemini_transport_preserves_local_integer_enum_validation(self):
        schema={'type':'OBJECT','properties':{'version':{'type':'INTEGER','enum':[2]}}}
        converted=response_schema(schema)
        self.assertNotIn('enum',converted['properties']['version'])
        self.assertEqual(schema['properties']['version']['enum'],[2])

    def test_missing_css_and_imports_rejected_before_browser(self):
        for name, content in [('index.html','<link rel="stylesheet" href="styles.css">'), ('App.jsx',"import './App.css';export default function App(){return <main/>}")]:
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, 'Unresolved'):
                validate_project({'files':[{'path':name,'content':content}], 'project_type':'html', 'entrypoint':name})

    def test_semantics_and_setup_follow_the_actual_page_requirements(self):
        requirements=web_requirements('Use semantic HTML where relevant. Record setup requirements.','html')
        project=html_project('<main><form></form></main>',[])
        project['project_files']['README.md']='Open index.html in your browser; no installation is needed.'
        self.assertTrue(all(source_checks(requirements,project).values()))
        requirements=web_requirements('Use semantic HTML: header, nav, main, section, article, footer.','html')
        self.assertFalse(source_checks(requirements,project)['semantic_html'])

    def test_malformed_svg_cannot_reach_browser_as_a_broken_asset(self):
        data={'project_type':'html','entrypoint':'index.html','files':[{'path':'index.html','content':'<img src="profile.svg">'}, {'path':'profile.svg','content':'<svg><rect width="20" height="20"/></svg>'}]}
        with self.assertRaisesRegex(ValueError,'xmlns'): validate_project(data)
        data['files'][1]['content']='<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20"/></svg>'
        self.assertIn('profile.svg',validate_project(data)['project_files'])

    def test_project_paths_and_node_jsx_rejected(self):
        for name in ('../x.js', 'C:/x.js', '/x.js', 'node_modules/x.js', 'src/../x.js', 'package.json'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                validate_project({'files':[{'path':name,'content':'x'}], 'entrypoint':name, 'project_type':'react'})
        with self.assertRaisesRegex(ValueError, 'JSX'):
            validate_project({'files':[{'path':'server.cjs','content':'function App(){return <main/>}'}], 'entrypoint':'server.cjs','project_type':'node'})

    def test_missing_edit_cannot_pass_coverage_with_add_delete_only(self):
        req = web_requirements('Create notes. Edit and delete notes.', 'react')
        tests = [scenario([step('fill','Title','A','label'),step('click','Add','','role','button'),step('assert_visible','A','','text'),step('click','Delete','','role','button'),step('assert_absent','A','','text')], ['create','edit','delete'])]
        with self.assertRaisesRegex(ValueError, 'edit'): validate_coverage_plan(req,normalize_v2(tests))

    def test_external_navigation_script_unknown_role_and_excess_steps_rejected(self):
        for bad in [step('goto',value='//example.com'),step('evaluate',value='alert(1)'),step('click','X',kind='role',role='script')]:
            with self.subTest(bad=bad), self.assertRaises(ValueError): normalize_v2([scenario([bad])])
        with self.assertRaises(ValueError): normalize_v2([scenario([step('assert_no_overflow')]*25)])

    def test_name_only_operations_are_canonicalized_without_losing_steps(self):
        original=[step('click','','Save','role','button'),step('assert_visible','Saved','','text', 'status')]
        test=normalize_v2([scenario(original)])[0]
        self.assertEqual(len(test['steps']),2)
        self.assertEqual(test['steps'][0]['locator'],'Save')
        self.assertEqual(test['steps'][1]['role'],'')
        self.assertEqual(original[0]['locator'],'')


class ProviderBackupTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        # These tests cover Groq/Gemini only, regardless of local backup keys.
        routes = patch.object(GenerationService, '_backup_routes', return_value=[])
        routes.start()
        self.addCleanup(routes.stop)

    async def test_flask_manifest_accepts_python_files_with_consistent_generation_contract(self):
        from fixtures.app_ui_cases import FLASK_FILES, FLASK_TESTS
        response={'answer':'Adds and validates on the Flask server.','entrypoint':'app.py','readme':FLASK_FILES['README.md'],
            'source_capture_files':['app.py','templates/index.html'],
            'files':[{'path':name,'content':source} for name,source in FLASK_FILES.items() if name!='README.md'],
            'browser_tests':[{k:v for k,v in test.items() if k!='version'} for test in FLASK_TESTS]}
        with patch('app.services.web_project.generation_service.generate_json',AsyncMock(return_value=response)) as generate:
            _,project=await generate_web_project('Build a Flask calculator to add two numbers with server-side validation for invalid input.','python')
        instructions,_,schema=generate.await_args.args
        self.assertIn('Allowed files: py/html/css/js/md/svg.',instructions)
        self.assertNotIn('Allowed files: html/css/js/jsx/cjs/mjs/json/md/svg.',instructions)
        self.assertIn('two concise sentences',instructions)
        self.assertIn('integer versus decimal formatting',instructions)
        self.assertIn('Flask startup',schema['properties']['readme']['description'])
        self.assertEqual(project['project_type'],'flask')
        self.assertEqual(project['project_files']['app.py'],FLASK_FILES['app.py'])
        self.assertEqual(len(project['browser_tests']),2)

    async def test_react_source_screenshot_preferences_do_not_change_node_assignment_type(self):
        response={'answer':'List records','entrypoint':'server.cjs','source_capture_files':['server.cjs'],
            'readme':'Run npm install express, then node server.cjs.',
            'files':[{'path':'server.cjs','content':"const app=require('express')();app.get('/api/records',(req,res)=>res.json([]));app.listen(process.env.PORT||4000);"}],
            'api_tests':[{'name':'List records','path':'/api/records','method':'GET','body_json':'','expected_status':200,'expected_json':'[]'}]}
        preferences='For React and Node source screenshots, omit CSS and use the VS Code-style UI.'
        with patch('app.services.web_project.generation_service.generate_json',AsyncMock(return_value=response)) as generate:
            _,project=await generate_web_project('Create a Node Express API that lists records.','node',additional_instructions=preferences)
        self.assertEqual(project['project_type'],'node')
        self.assertNotIn('browser_tests',generate.await_args.args[2]['properties'])
        self.assertIn(preferences,generate.await_args.args[1])
        with patch('app.services.web_project.generation_service.generate_json',AsyncMock(return_value=response)),self.assertRaisesRegex(GenerationError,'server_entrypoint'):
            await generate_web_project('Create a Node Express API that lists records.','node',additional_instructions='Add a React frontend.')

    async def test_web_draft_defaults_never_invent_a_missing_plan(self):
        draft={'answer':'Static page','entrypoint':'index.html','files':[{'path':'index.html','content':'<main><h1>Hello</h1></main>'}],
            'browser_tests':[{'name':'Heading','requirement_ids':[],'steps':[{'action':'assert_visible','locator_type':'text','locator':'Hello'}]}]}
        error=GenerationError('Missing formatting metadata');error.draft=draft
        with patch('app.services.web_project.generation_service.generate_json',AsyncMock(side_effect=error)):
            data,project=await generate_web_project('Create a static HTML heading Hello.','html')
        self.assertEqual(project['browser_tests'][0]['steps'][0]['role'],'')
        self.assertEqual(project['browser_tests'][0]['viewport']['width'],1366)
        self.assertNotIn('role',draft['browser_tests'][0]['steps'][0])
        missing=GenerationError('Missing required plan');missing.draft={k:v for k,v in draft.items() if k!='browser_tests'}
        with patch('app.services.web_project.generation_service.generate_json',AsyncMock(side_effect=missing)),self.assertRaises(GenerationError):
            await generate_web_project('Build an interactive calculator with an Add button.','html')
    async def test_depleted_gemini_uses_separate_groq_model_and_keeps_primary_cooldown(self):
        service=GenerationService();models=[];actual_client=httpx.AsyncClient
        def handler(request):
            model=json.loads(request.content)['model'];models.append(model)
            if model=='openai/gpt-oss-120b': return httpx.Response(429,headers={'Retry-After':'3600'})
            return httpx.Response(200,json={'choices':[{'message':{'content':'{"answer":"recovered"}'}}]})
        schema={'type':'OBJECT','properties':{'answer':{'type':'STRING'}},'required':['answer']}
        with patch.object(settings,'LLM_PROVIDER','groq'),patch.object(settings,'GROQ_API_KEY','test'),patch.object(settings,'GROQ_MODEL','openai/gpt-oss-120b'),patch.object(settings,'GROQ_FALLBACK_MODEL','openai/gpt-oss-20b'),patch.object(settings,'GEMINI_API_KEY','backup'),patch.object(settings,'LLM_FALLBACK_PROVIDER','gemini'),patch('app.services.generation_service.httpx.AsyncClient',side_effect=lambda **kw:actual_client(transport=httpx.MockTransport(handler))),patch('app.services.generation_service.gemini_service.generate_json',AsyncMock(side_effect=GeminiError('credits depleted'))) as backup:
            self.assertEqual(await service.generate_json('i','q',schema),{'answer':'recovered'})
            self.assertEqual(await service.generate_json('i','q',schema),{'answer':'recovered'})
            self.assertEqual(models,['openai/gpt-oss-120b','openai/gpt-oss-20b','openai/gpt-oss-20b'])
            self.assertEqual(backup.await_count,1)

    async def test_both_groq_models_exhausted_stop_without_fallback_loop(self):
        service=GenerationService();models=[];actual_client=httpx.AsyncClient
        def handler(request):
            models.append(json.loads(request.content)['model'])
            return httpx.Response(429,headers={'Retry-After':'3600'})
        with patch.object(settings,'LLM_PROVIDER','groq'),patch.object(settings,'GROQ_API_KEY','test'),patch.object(settings,'GROQ_MODEL','openai/gpt-oss-120b'),patch.object(settings,'GROQ_FALLBACK_MODEL','openai/gpt-oss-20b'),patch.object(settings,'GEMINI_API_KEY',''),patch('app.services.generation_service.httpx.AsyncClient',side_effect=lambda **kw:actual_client(transport=httpx.MockTransport(handler))):
            with self.assertRaises(GenerationUnavailableError): await service.generate_json('i','q',{'type':'OBJECT','properties':{}})
            self.assertEqual(models,['openai/gpt-oss-120b','openai/gpt-oss-20b'])

    async def test_depleted_backup_returns_to_primary_retries(self):
        service=GenerationService()
        schema={'type':'OBJECT','properties':{'answer':{'type':'STRING'}},'required':['answer']}
        primary=AsyncMock(side_effect=[GenerationUnavailableError('busy'),{'answer':'recovered'}])
        with patch.object(settings,'LLM_PROVIDER','groq'), patch.object(settings,'GEMINI_API_KEY','backup'), patch.object(settings,'LLM_FALLBACK_PROVIDER','gemini'), patch.object(service,'_primary',primary), patch.object(service,'_gemini',AsyncMock(side_effect=GenerationError('credits depleted'))):
            self.assertEqual(await service.generate_json('i','q',schema),{'answer':'recovered'})
            self.assertFalse(primary.await_args.args[-1])
            self.assertGreater(service._backup_unavailable_until,0)
    async def test_transient_outage_uses_validated_gemini_and_cooldown(self):
        service = GenerationService()
        primary_calls=[]
        def handler(request):
            primary_calls.append(request)
            return httpx.Response(429, headers={'Retry-After':'300'})
        schema={'type':'OBJECT','properties':{'answer':{'type':'STRING'}},'required':['answer']}
        actual_client=httpx.AsyncClient
        with patch.object(settings,'LLM_PROVIDER','groq'), patch.object(settings,'GROQ_API_KEY','test'), patch.object(settings,'GEMINI_API_KEY','backup'), patch.object(settings,'LLM_FALLBACK_PROVIDER','gemini'), patch('app.services.generation_service.httpx.AsyncClient',side_effect=lambda **kwargs: actual_client(transport=httpx.MockTransport(handler))), patch('app.services.generation_service.gemini_service.generate_json',AsyncMock(return_value={'answer':'correct'})) as backup:
            self.assertEqual(await service.generate_json('i','q',schema), {'answer':'correct'})
            self.assertEqual(await service.generate_json('i','q',schema), {'answer':'correct'})
            self.assertEqual(len(primary_calls),1)
            self.assertEqual(backup.await_count,2)
            backup.return_value={'answer':23}
            with self.assertRaises(GenerationError): await service._gemini('i','q',schema,None)
            backup.side_effect=GeminiUnavailableError('busy')
            with self.assertRaises(GenerationUnavailableError): await service._gemini('i','q',schema,None)

    async def test_permanent_auth_failure_does_not_switch_provider(self):
        actual_client=httpx.AsyncClient
        with patch.object(settings,'LLM_PROVIDER','groq'), patch.object(settings,'GROQ_API_KEY','test'), patch.object(settings,'GEMINI_API_KEY','backup'), patch('app.services.generation_service.httpx.AsyncClient',side_effect=lambda **kwargs: actual_client(transport=httpx.MockTransport(lambda req:httpx.Response(401)))), patch('app.services.generation_service.gemini_service.generate_json',AsyncMock()) as backup:
            with self.assertRaises(GenerationError): await GenerationService().generate_json('i','q',{'type':'OBJECT','properties':{}})
            backup.assert_not_awaited()


class BrowserV2Tests(unittest.IsolatedAsyncioTestCase):
    async def test_malformed_previous_file_lists_do_not_crash_repair_generation(self):
        response={'answer':'Page','entrypoint':'index.html','readme':'Open index.html in a browser.',
                  'files':[{'path':'index.html','content':'<main>Hello</main>'}],
                  'browser_tests':[{'name':'Page','requirement_ids':[],'viewport':{'width':1366,'height':768},
                    'steps':[{'action':'assert_visible','locator_type':'text','locator':'Hello','value':''}]}]}
        for files in [['index.html'],None,{'index.html':'wrong shape'},[{'path':['bad'],'content':None}]]:
            with self.subTest(files=files),patch('app.services.web_project.generation_service.generate_json',AsyncMock(return_value=response)) as generate:
                data,project=await generate_web_project('Create a static HTML page.','html',previous={'files':files,'entrypoint':{'bad':'shape'}},failure='Invalid file structure')
                self.assertEqual(project['entrypoint'],'index.html')
                self.assertIn('Invalid file structure',generate.await_args.args[1])

    async def test_named_step_transport_and_explicit_readme_are_validated(self):
        response={'answer':'Page','entrypoint':'index.html','readme':'Open index.html in a browser.',
                  'files':[{'path':'index.html','content':'<main>Hello</main>'}],
                  'browser_tests':[{'name':'Page','requirement_ids':[],'viewport':{'width':1366,'height':768},
                    'steps':[{'action':'assert_visible','locator_type':'text','locator':'Hello','value':''}]}]}
        with patch('app.services.web_project.generation_service.generate_json',AsyncMock(return_value=response)):
            data,project=await generate_web_project('Create a static HTML page. Include README startup instructions.','html')
        self.assertEqual(project['project_files']['README.md'],response['readme'])
        self.assertTrue(project['source_checks']['startup'])
        self.assertEqual(project['browser_tests'][0]['steps'][0]['role'],'')
        response['browser_tests'][0]['steps'][0]['script']='alert(1)'
        with patch('app.services.web_project.generation_service.generate_json',AsyncMock(return_value=response)),self.assertRaises(GenerationError):
            await generate_web_project('Create a static HTML page.','html')
        response.pop('browser_tests')
        with patch('app.services.web_project.generation_service.generate_json',AsyncMock(return_value=response)),self.assertRaisesRegex(GenerationError,'missing required fields browser_tests'):
            await generate_web_project('Create a static HTML page.','html')

    async def test_native_delete_confirmation_checks_message_and_captures_result(self):
        html='<p id="note">Saved note</p><button onclick="if(confirm(\'Delete this note?\'))document.getElementById(\'note\').remove()">Delete note</button>'
        for message,success in [('Delete this note?',True),('A different message',False)]:
            with self.subTest(message=message):
                plan=[scenario([step('assert_visible','Saved note','','text'),
                    step('click_confirm','Delete note',message,'role','button'),step('assert_absent','Saved note','','text')],['delete'])]
                validate_coverage_plan([{'id':'delete','kind':'behavior'}],normalize_v2(plan))
                result=await self.run_project(html_project(html,plan))
                self.assertEqual(result.success,success,result.error)
                self.assertTrue(result.screenshots,result.error)
                if success:self.assertEqual(result.verification['tests'][0]['dialogs'],[{'type':'confirm','message':'Delete this note?'}])
        result=await self.run_project(html_project(html,[scenario([step('click','Delete note','','role','button'),
            step('assert_visible','Saved note','','text')])]))
        self.assertTrue(result.success,result.error)

    async def test_repair_feedback_survives_missing_or_malformed_previous_response(self):
        response={'answer':'Page','entrypoint':'index.html','files':[{'path':'index.html','content':'<main>Hello</main>'}],
                  'browser_tests':[{'name':'Page','requirement_ids':[],'viewport':{'width':1366,'height':768},'steps':[['assert_visible','text','Hello','']]}]}
        with patch('app.services.web_project.generation_service.generate_json',AsyncMock(return_value=response)) as generate:
            await generate_web_project('Create a static HTML page.','html',failure='Invalid JSON at the response boundary.')
            self.assertIn('Invalid JSON at the response boundary.',generate.await_args.args[1])
        response['browser_tests'][0]['steps']=[['click','role:button','Add']]
        with patch('app.services.web_project.generation_service.generate_json',AsyncMock(return_value=response)):
            with self.assertRaises(GenerationError) as caught:
                await generate_web_project('Create a static HTML page.','html')
            self.assertEqual(caught.exception.project_data,response)

    async def test_checked_state_and_local_url_are_observed(self):
        html='<label><input type="checkbox">Complete task</label><a href="#done">Details</a><main id="done">Task details</main>'
        tests=[scenario([step('assert_checked','Complete task','false','role','checkbox'),
                         step('click','Complete task','','role','checkbox'),
                         step('assert_checked','Complete task','true','role','checkbox'),
                         step('click','Details','','role','link'),step('assert_url',value='/#done'),
                         step('assert_visible','Task details','','text')])]
        result=await self.run_project(html_project(html,tests))
        self.assertTrue(result.success,result.error)

    async def test_static_generation_uses_small_schema_and_remains_render_tested(self):
        plan=scenario([step('assert_visible','Hello','','text')])
        plan.pop('version')
        plan['steps']=[['assert_visible','text','Hello','']]
        response={'answer':'Static page.','entrypoint':'index.html','files':[{'path':'index.html','content':'<main><h1>Hello</h1></main>'}],'browser_tests':[plan]}
        with patch('app.services.web_project.generation_service.generate_json',AsyncMock(return_value=response)) as generate:
            data,project=await generate_web_project('Create a static HTML page with heading Hello.','html')
        self.assertNotIn('api_tests',generate.await_args.args[2]['properties'])
        self.assertNotIn('language',generate.await_args.args[2]['properties'])
        transport=generate.await_args.args[2]['properties']['browser_tests']['items']['properties']['steps']['items']
        self.assertEqual(transport['type'],'OBJECT')
        self.assertIn('role:button',transport['properties']['locator_type']['enum'])
        self.assertIn('readme',generate.await_args.args[2]['properties'])
        self.assertEqual(data['language'],'html')
        result=await self.run_project(project)
        self.assertTrue(result.success,result.error)
        self.assertFalse(result.verification['required'])
        self.assertEqual(result.verification['status'],'not_required')
        self.assertEqual(result.verification['tests'][0]['status'],'passed')

    async def test_compact_script_or_unknown_action_is_rejected(self):
        for bad in [['evaluate','page','','alert(1)'],['click','css','button',''],['click','role:button','Add']]:
            plan=scenario([step('assert_visible','Hello','','text')]);plan.pop('version');plan['steps']=[bad]
            data={'answer':'Page','entrypoint':'index.html','files':[{'path':'index.html','content':'<main>Hello</main>'}],'browser_tests':[plan]}
            with patch('app.services.web_project.generation_service.generate_json',AsyncMock(return_value=data)),self.assertRaises((GenerationError,ValueError)):
                await generate_web_project('Create a static HTML page.','html')

    async def test_websocket_egress_is_blocked_before_network_contact(self):
        contacts=[]
        async def accept(reader,writer):
            contacts.append(True)
            writer.close()
        server=await asyncio.start_server(accept,'127.0.0.1',0)
        try:
            port=server.sockets[0].getsockname()[1]
            html=f'''<p id="result">Pending</p><script>const socket=new WebSocket('ws://127.0.0.1:{port}/');socket.onerror=()=>document.getElementById('result').textContent='Blocked';</script>'''
            result=await self.run_project(html_project(html,[scenario([step('assert_visible','Blocked','','text')])]))
            self.assertTrue(result.success,result.error)
            self.assertEqual(contacts,[])
        finally:
            server.close()
            await server.wait_closed()

    async def test_old_navigation_http_response_cannot_prove_a_retry(self):
        html='''<button id="retry">Retry</button><p id="state">Loading</p><script>const bad=location.search.includes('error');fetch('/__labmate__/users'+(bad?'?state=error':'')).then(r=>state.textContent=r.ok?'Loaded':'Error');retry.onclick=()=>state.textContent='Loaded'</script>'''
        tests=[scenario([step('assert_visible','Loaded','','text'),step('goto',value='/?error=1'),step('assert_visible','Error','','text'),step('click','Retry','','role','button'),step('assert_visible','Loaded','','text'),step('assert_http',value=json.dumps({'method':'GET','path':'/__labmate__/users','status':200}))])]
        result=await self.run_project(html_project(html,tests))
        self.assertFalse(result.success)
        self.assertIn('HTTP response not observed',result.error)
    async def run_project(self, project):
        with tempfile.TemporaryDirectory() as folder, patch.object(settings,'REACT_TEMP_DIR',folder+'/run'), patch.object(settings,'SCREENSHOT_DIR',folder+'/screenshots'):
            result=await runtime_engine.execute(project['project_files'][project['entrypoint']], 'html', project_files=project['project_files'], project_config=project, browser_tests=project['browser_tests'], interaction_is_required=True)
            self.assertTrue(all(Path(p).is_file() for p in result.screenshots.values()))
            return result

    async def test_add_passes_and_wrong_missing_handler_or_control_fail(self):
        tests=[scenario([step('fill','First','2','label'),step('fill','Second','3','label'),step('click','Add','','role','button'),step('assert_visible','5','','text')])]
        template='<label>First<input id="a"></label><label>Second<input id="b"></label><button id="add">Add</button><output id="result"></output><script>{}</script>'
        for js, expected in [("add.onclick=()=>result.textContent=Number(a.value)+Number(b.value)",True),('',False),("add.onclick=()=>result.textContent=a.value+b.value",False)]:
            with self.subTest(js=js):
                result=await self.run_project(html_project(template.format(js), tests))
                self.assertEqual(result.success,expected,result.error)
                self.assertTrue(result.screenshots,result.error)
        result=await self.run_project(html_project('<p>No controls here</p>',tests))
        self.assertFalse(result.success)
        self.assertTrue(result.screenshots,result.error)

    async def test_select_reload_absence_and_intermediate_evidence(self):
        html='''<label for="course">Course</label><select id="course"><option>Java</option><option>Web</option></select><button id="save">Save</button><p id="selected"></p><script>selected.textContent=localStorage.getItem('course')||'Nothing saved';save.onclick=()=>{localStorage.setItem('course',course.value);selected.textContent=course.value}</script>'''
        tests=[scenario([step('select','Course','Web','label'),step('click','Save','','role','button'),step('assert_visible','Web','','text'),step('screenshot'),step('reload'),step('assert_visible','Web','','text'),step('assert_absent','Nothing saved','','text')])]
        result=await self.run_project(html_project(html,tests))
        self.assertTrue(result.success,result.error)
        self.assertEqual(len(result.screenshots),2)

    async def test_external_requests_remain_blocked(self):
        html='<p id="status">Pending</p><script>fetch("https://example.com/private").then(()=>status.textContent="Leaked").catch(()=>document.getElementById("status").textContent="Blocked")</script>'
        result=await self.run_project(html_project(html,[scenario([step('assert_visible','Blocked','','text')])]))
        self.assertTrue(result.success,result.error)

    async def test_mock_endpoint_is_real_http_including_failure_and_retry(self):
        html='''<button id="retry">Retry</button><p id="state">Loading</p><script>async function load(path){const r=await fetch(path);state.textContent=r.ok?'Loaded':'Error'}retry.onclick=()=>load('/__labmate__/users');load('/__labmate__/users?state=error')</script>'''
        tests=[scenario([step('assert_visible','Error','','text'),step('assert_http',value=json.dumps({'method':'GET','path':'/__labmate__/users?state=error','status':503})),step('click','Retry','','role','button'),step('assert_visible','Loaded','','text'),step('assert_http',value=json.dumps({'method':'GET','path':'/__labmate__/users','status':200}))])]
        result=await self.run_project(html_project(html,tests))
        self.assertTrue(result.success,result.error)
