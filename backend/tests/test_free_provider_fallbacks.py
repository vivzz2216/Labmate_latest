"""Owned HTTP fixtures for automatic free-only fallback and failure isolation."""
import json
import asyncio
import tempfile
import unittest
from contextlib import ExitStack
from unittest.mock import AsyncMock,patch

import httpx

from app.config import settings
from app.services.free_provider_service import generate_free_json
from app.services.generation_service import GenerationService,GenerationError,GenerationUnavailableError

SCHEMA={'type':'OBJECT','properties':{'answer':{'type':'STRING'}},'required':['answer']}


def answer(text='ready',**kwargs):
    return httpx.Response(200,json={'model':'fixture/free','choices':[{'finish_reason':'stop','message':{'content':json.dumps({'answer':text})}}],**kwargs})


class FreeProviderTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.stack=ExitStack();self.addCleanup(self.stack.close)
        for key,value in {'LLM_PROVIDER':'groq','OPENROUTER_API_KEY':'private-router-key','OPENROUTER_MODEL':'openrouter/free',
                'OPENCODE_ENABLED':True,'OPENCODE_API_KEY':'','OPENCODE_MODEL':'big-pickle',
                'FREE_LLM_FALLBACK_ORDER':'openrouter,opencode','LLM_FALLBACK_COOLDOWN_SECONDS':60}.items():
            self.stack.enter_context(patch.object(settings,key,value))
        self.service=GenerationService()
        self.configured=self.stack.enter_context(patch.object(self.service,'_configured_generation',AsyncMock(side_effect=GenerationUnavailableError('old quota'))))
        self.calls=[]

    def transport(self,handler):
        actual=httpx.AsyncClient
        def observed(request):
            self.calls.append(request)
            return handler(request)
        return patch('app.services.free_provider_service.AsyncClient',side_effect=lambda **kw:actual(transport=httpx.MockTransport(observed),**kw))

    async def generate(self):
        return await self.service.generate_json('Return JSON.','Question',SCHEMA)

    async def test_groq_failure_routes_to_openrouter_with_zero_price_ceiling(self):
        with self.transport(lambda request:answer()):
            self.assertEqual(await self.generate(),{'answer':'ready'})
        self.assertEqual(len(self.calls),1)
        request=self.calls[0];payload=json.loads(request.content)
        self.assertEqual(str(request.url),'https://openrouter.ai/api/v1/chat/completions')
        self.assertEqual(request.headers['Authorization'],'Bearer private-router-key')
        self.assertEqual(payload['model'],'openrouter/free')
        self.assertEqual(payload['provider']['max_price'],{'prompt':0,'completion':0,'request':0})
        self.assertTrue(payload['provider']['require_parameters'])
        self.assertTrue(payload['response_format']['json_schema']['strict'])
        self.assertEqual(payload['reasoning'],{'effort':'low','exclude':True})
        primary=AsyncMock(side_effect=GenerationUnavailableError('Groq down'))
        legacy=GenerationService._configured_generation.__get__(self.service,GenerationService)
        with patch.object(self.service,'_configured_generation',legacy),patch.object(self.service,'_primary',primary),\
             patch.object(settings,'GROQ_FALLBACK_MODEL',''),patch.object(settings,'GEMINI_API_KEY',''),\
             patch.object(settings,'OPENCODE_ENABLED',False),self.transport(lambda request:answer()):
            self.assertEqual(await self.generate(),{'answer':'ready'})
            primary.assert_awaited_once()
            self.assertTrue(primary.await_args.args[-1])

    async def test_rate_limited_router_diverts_to_opencode_and_cools_down(self):
        def handler(request):
            if request.url.host=='openrouter.ai':return httpx.Response(429,headers={'Retry-After':'3600'})
            self.assertNotIn('authorization',request.headers)
            self.assertFalse(any(name.startswith('x-opencode') for name in request.headers))
            payload=json.loads(request.content)
            self.assertEqual(payload['model'],'big-pickle')
            self.assertIn('additionalProperties',payload['messages'][0]['content'])
            return answer('recovered')
        with self.transport(handler):
            self.assertEqual(await self.generate(),{'answer':'recovered'})
            self.assertEqual(await self.generate(),{'answer':'recovered'})
        self.assertEqual([r.url.host for r in self.calls],['openrouter.ai','opencode.ai','opencode.ai'])

    async def test_invalid_primary_and_invalid_router_json_try_next_provider(self):
        self.configured.side_effect=GenerationError('Invalid primary JSON')
        with self.transport(lambda request:answer(123) if request.url.host=='openrouter.ai' else answer()):
            self.assertEqual(await self.generate(),{'answer':'ready'})
        self.assertEqual(len(self.calls),2)

    async def test_permanent_router_errors_do_not_stop_the_next_provider(self):
        for status in [400,401,402,403,404,503]:
            with self.subTest(status=status):
                self.service._free_unavailable_until.clear();self.calls.clear()
                with self.transport(lambda request:httpx.Response(status) if request.url.host=='openrouter.ai' else answer()):
                    self.assertEqual(await self.generate(),{'answer':'ready'})
                self.assertEqual(len(self.calls),2)

    async def test_network_failure_moves_to_next_provider(self):
        def handler(request):
            if request.url.host=='openrouter.ai':raise httpx.ConnectError('private-router-key',request=request)
            return answer()
        with self.transport(handler):self.assertEqual(await self.generate(),{'answer':'ready'})

    async def test_continuous_keepalive_body_cannot_defeat_total_deadline(self):
        class KeepAlive(httpx.AsyncByteStream):
            closed=False
            async def __aiter__(self):
                while True:
                    await asyncio.sleep(.01)
                    yield b' '
            async def aclose(self):self.closed=True
        stream=KeepAlive()
        def handler(request):
            return httpx.Response(200,stream=stream) if request.url.host=='openrouter.ai' else answer()
        start=asyncio.get_running_loop().time()
        with patch.object(settings,'FREE_LLM_REQUEST_TIMEOUT',1),self.transport(handler):
            self.assertEqual(await self.generate(),{'answer':'ready'})
        self.assertLess(asyncio.get_running_loop().time()-start,2)
        self.assertEqual(len(self.calls),2)
        self.assertTrue(stream.closed)

    async def test_http_200_upstream_error_is_an_outage_not_a_code_repair(self):
        with patch.object(settings,'OPENCODE_ENABLED',False),self.transport(lambda request:httpx.Response(200,json={'error':{'code':429,'message':'private-router-key'}})):
            with self.assertRaises(GenerationUnavailableError) as caught:await self.generate()
        self.assertNotIn('private-router-key',str(caught.exception))

    async def test_invalid_answer_keeps_repair_draft_and_does_not_cool_down_model(self):
        with patch.object(settings,'OPENCODE_ENABLED',False),self.transport(lambda request:answer(123)):
            for _ in range(2):
                with self.assertRaises(GenerationError) as caught:await self.generate()
                self.assertNotIsInstance(caught.exception,GenerationUnavailableError)
                self.assertEqual(caught.exception.draft,{'answer':123})
        self.assertEqual(len(self.calls),2)

    async def test_opencode_access_denial_is_not_bypassed_or_leaked(self):
        with self.transport(lambda request:httpx.Response(403,json={'error':{'message':'private-router-key'}})):
            with self.assertRaises(GenerationError) as caught:
                await generate_free_json('opencode','i','q',SCHEMA)
        self.assertIn('denied external application access',str(caught.exception))
        self.assertNotIn('private-router-key',str(caught.exception))
        self.assertEqual(len(self.calls),1)

    async def test_all_down_pause_without_loop_and_skip_cooling_providers(self):
        def handler(request):
            return httpx.Response(429,headers={'Retry-After':'3600'}) if request.url.host=='openrouter.ai' else httpx.Response(403)
        with self.transport(handler):
            for _ in range(2):
                with self.assertRaises(GenerationUnavailableError):await self.generate()
        self.assertEqual(len(self.calls),2)
        self.service._free_unavailable_until.clear()
        self.configured.side_effect=GenerationError('Configured credentials rejected')
        with self.transport(lambda request:httpx.Response(403)):
            with self.assertRaises(GenerationUnavailableError):await self.generate()

    async def test_missing_credentials_and_disabled_opencode_make_no_requests(self):
        with patch.object(settings,'OPENROUTER_API_KEY',''),patch.object(settings,'OPENCODE_ENABLED',False),self.transport(lambda request:answer()):
            with self.assertRaises(GenerationUnavailableError):await self.generate()
        self.assertEqual(self.calls,[])

    async def test_paid_model_ids_are_rejected_before_network(self):
        with self.transport(lambda request:answer()):
            with patch.object(settings,'OPENROUTER_MODEL','openai/gpt-5'):
                with self.assertRaisesRegex(GenerationError,'free-only'):await generate_free_json('openrouter','i','q',SCHEMA)
            with patch.object(settings,'OPENCODE_MODEL','gpt-5'):
                with self.assertRaisesRegex(GenerationError,'free chat'):await generate_free_json('opencode','i','q',SCHEMA)
        self.assertEqual(self.calls,[])

    async def test_explicit_free_variant_and_model_output_limit(self):
        with patch.object(settings,'OPENROUTER_MODEL','openai/gpt-oss-120b:free'),self.transport(lambda request:answer()):
            await generate_free_json('openrouter','i','q',SCHEMA)
        self.assertEqual(json.loads(self.calls[0].content)['model'],'openai/gpt-oss-120b:free')
        with self.transport(lambda request:httpx.Response(200,json={'choices':[{'finish_reason':'length','message':{'content':'{"answer":'}}]})):
            with self.assertRaisesRegex(GenerationError,'output limit'):await generate_free_json('openrouter','i','q',SCHEMA)

    async def test_schema_violation_extra_fields_malformed_and_refusal_fail_closed(self):
        for body in ['invalid','{"answer":2}','{"answer":"ok","script":"run"}']:
            with self.subTest(body=body),self.transport(lambda request:httpx.Response(200,json={'choices':[{'message':{'content':body}}]})):
                with self.assertRaises(GenerationError):await generate_free_json('openrouter','i','q',SCHEMA)
        with self.transport(lambda request:httpx.Response(200,json={'choices':[{'message':{'refusal':'no','content':'{}'}}]})):
            with self.assertRaises(GenerationError):await generate_free_json('opencode','i','q',SCHEMA)
        for body in [None,[],{'choices':[None]},{'choices':[{'message':None}]}]:
            with self.subTest(container=body),self.transport(lambda request:httpx.Response(200,json=body)):
                with self.assertRaises(GenerationError):await generate_free_json('openrouter','i','q',SCHEMA)

    async def test_primary_openrouter_then_opencode_does_not_repeat_primary(self):
        with patch.object(settings,'LLM_PROVIDER','openrouter'),self.transport(lambda request:httpx.Response(503) if request.url.host=='openrouter.ai' else answer()):
            self.assertEqual(await self.generate(),{'answer':'ready'})
        self.configured.assert_not_awaited()
        self.assertEqual(len(self.calls),2)

    async def test_rotated_key_resets_cooldown_without_logging_keys(self):
        with self.transport(lambda request:httpx.Response(401) if request.headers.get('authorization')=='Bearer private-router-key' else answer()):
            with patch.object(settings,'OPENCODE_ENABLED',False):
                with self.assertRaises(GenerationUnavailableError):await self.generate()
                with patch.object(settings,'OPENROUTER_API_KEY','new-key'):
                    self.assertEqual(await self.generate(),{'answer':'ready'})
        self.assertEqual(len(self.calls),2)

    async def test_invalid_fallback_order_is_rejected(self):
        for order in ['openrouter,openrouter','opencode,unknown','openrouter,opencode,gemini']:
            with self.subTest(order=order),patch.object(settings,'FREE_LLM_FALLBACK_ORDER',order):
                with self.assertRaises(GenerationError):await self.generate()

    async def test_fallback_generated_add_project_executes_in_real_browser(self):
        from app.services.assignment_workflow import execute_web_assignment
        source='<label>First<input id="a"></label><label>Second<input id="b"></label><button id="add">Add</button><output id="result"></output><script>add.onclick=()=>result.textContent=Number(a.value)+Number(b.value)</script>'
        response={'answer':'Adds two entered numbers.','entrypoint':'index.html','readme':'Open index.html in a browser.','files':[{'path':'index.html','content':source}],
            'source_capture_files':['index.html'],
            'browser_tests':[{'name':'Add 2 and 3','requirement_ids':['calculation'],'viewport':{'width':1366,'height':768},
                'steps':[{'action':a,'locator_type':k,'locator':l,'value':v} for a,k,l,v in [('fill','label','First','2'),('fill','label','Second','3'),('click','role:button','Add',''),('assert_visible','text','5','')]]}]}
        def handler(request):
            payload=json.loads(request.content)
            self.assertIn('files',payload['response_format']['json_schema']['schema']['properties'])
            return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps(response)}}]})
        with tempfile.TemporaryDirectory() as folder,patch.object(settings,'SCREENSHOT_DIR',folder+'/screenshots'),patch.object(settings,'REACT_TEMP_DIR',folder+'/runtime'),\
             patch('app.services.web_project.generation_service',self.service),self.transport(handler):
            generated,project,result=await execute_web_assignment('Build an HTML calculator to add two numbers.','html','fallback_audit','Student',None,lambda n:None)
            self.assertTrue(result.success,result.error)
            self.assertEqual(result.verification['status'],'passed')
            self.assertEqual(len(result.verification['attempts']),1)
            self.assertTrue(result.screenshots)
        self.assertEqual(len(self.calls),1)
