import asyncio
import json
import time
import unittest
from contextlib import ExitStack
from unittest.mock import AsyncMock, patch

import httpx

from app.config import settings
from app.services.deepseek_service import generate_deepseek_json
from app.services.generation_service import GenerationError, GenerationService, GenerationUnavailableError

SCHEMA = {'type':'OBJECT', 'properties':{'answer':{'type':'STRING'}}, 'required':['answer']}


def answer(content='{"answer":"ready"}', reason='stop'):
    return httpx.Response(200, json={'choices':[{'finish_reason':reason, 'message':{'content':content}}]})


class DeepSeekTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        for key, value in {
            'DEEPSEEK_ENABLED':True, 'DEEPSEEK_API_KEY':'fixture-deepseek-key',
            'DEEPSEEK_MODEL':'deepseek-flash', 'DEEPSEEK_REQUEST_TIMEOUT':5,
            'LLM_PROVIDER':'groq', 'FREE_LLM_FALLBACK_ORDER':'openrouter',
            'OPENROUTER_API_KEY':'fixture-router-key', 'OPENCODE_ENABLED':False,
        }.items():
            self.stack.enter_context(patch.object(settings, key, value))
        self.service = GenerationService()
        self.primary = self.stack.enter_context(patch.object(self.service, '_configured_generation',
            AsyncMock(side_effect=GenerationUnavailableError('Primary unavailable'))))
        self.free = self.stack.enter_context(patch.object(self.service, '_free_generation',
            AsyncMock(side_effect=GenerationUnavailableError('Free route unavailable'))))
        self.calls = []

    def transport(self, handler):
        actual = httpx.AsyncClient
        def observed(request):
            self.calls.append(request)
            return handler(request)
        return patch('app.services.deepseek_service.AsyncClient',
            side_effect=lambda **kw:actual(transport=httpx.MockTransport(observed), **kw))

    async def request(self):
        return await self.service.generate_json('Return JSON.', 'Question', SCHEMA)

    async def test_fallback_uses_fixed_endpoint_json_mode_and_local_schema(self):
        with self.transport(lambda request:answer()):
            self.assertEqual(await self.request(), {'answer':'ready'})
        self.primary.assert_awaited_once()
        self.free.assert_awaited_once()
        request = self.calls[0]
        self.assertEqual(str(request.url), 'https://api.deepseek.com/chat/completions')
        self.assertEqual(request.headers['authorization'], 'Bearer fixture-deepseek-key')
        payload = json.loads(request.content)
        self.assertEqual(payload['model'], 'deepseek-flash')
        self.assertEqual(payload['response_format'], {'type':'json_object'})
        self.assertEqual(payload['thinking'], {'type':'disabled'})
        self.assertIn('additionalProperties', payload['messages'][0]['content'])
        self.assertLessEqual(payload['max_tokens'], 16000)

    async def test_successful_free_route_does_not_use_metered_fallback(self):
        self.free.side_effect = None
        self.free.return_value = {'answer':'free'}
        with self.transport(lambda request:answer()):
            self.assertEqual(await self.request(), {'answer':'free'})
        self.assertEqual(self.calls, [])

    async def test_disabled_or_missing_key_never_calls_deepseek(self):
        for key, value in [('DEEPSEEK_ENABLED',False), ('DEEPSEEK_API_KEY','')]:
            with patch.object(settings,key,value), self.transport(lambda request:answer()):
                with self.assertRaises(GenerationUnavailableError):
                    await self.request()
        self.assertEqual(self.calls, [])

    async def test_http_failures_are_sanitized_and_categorized(self):
        for status in [400,401,402,404,429,500,503]:
            with self.subTest(status=status), self.transport(lambda request:httpx.Response(status,
                    headers={'Retry-After':'3600'}, json={'error':{'message':'fixture-deepseek-key'}})):
                with self.assertRaises(GenerationError) as caught:
                    await generate_deepseek_json('i','q',SCHEMA)
                self.assertNotIn('fixture-deepseek-key', str(caught.exception))
                self.assertEqual(caught.exception.status_code, status)
                self.assertEqual(isinstance(caught.exception,GenerationUnavailableError), status in {429,500,503})
                self.assertGreater(caught.exception.cooldown, 0)

    async def test_depleted_balance_pauses_and_skips_cooling_route(self):
        with self.transport(lambda request:httpx.Response(402)):
            for _ in range(2):
                with self.assertRaises(GenerationUnavailableError) as caught:
                    await self.request()
                self.assertIn('Completed results are saved', str(caught.exception))
        self.assertEqual(len(self.calls), 1)

    async def test_key_rotation_can_recover_without_reusing_cooldown(self):
        def handler(request):
            return httpx.Response(402) if request.headers['authorization']=='Bearer fixture-deepseek-key' else answer()
        with self.transport(handler):
            with self.assertRaises(GenerationUnavailableError):
                await self.request()
            with patch.object(settings,'DEEPSEEK_API_KEY','fixture-rotated-key'):
                self.assertEqual(await self.request(), {'answer':'ready'})
        self.assertEqual(len(self.calls), 2)

    async def test_explicit_primary_deepseek_falls_back_once_on_failure(self):
        self.free.side_effect = None
        self.free.return_value = {'answer':'recovered'}
        with patch.object(settings,'LLM_PROVIDER','deepseek'), self.transport(lambda request:httpx.Response(503)):
            self.assertEqual(await self.request(), {'answer':'recovered'})
        self.primary.assert_not_awaited()
        self.free.assert_awaited_once()
        self.assertEqual(len(self.calls), 1)

    async def test_explicit_primary_deepseek_does_not_repeat_after_success(self):
        with patch.object(settings,'LLM_PROVIDER','deepseek'), self.transport(lambda request:answer()):
            self.assertEqual(await self.request(), {'answer':'ready'})
        self.primary.assert_not_awaited()
        self.free.assert_not_awaited()
        self.assertEqual(len(self.calls), 1)

    async def test_schema_failures_remain_repairable_without_cooldown(self):
        for value in [{'answer':7}, {'answer':'ready','extra':'rejected'}]:
            with self.subTest(value=value), self.transport(lambda request:answer(json.dumps(value))):
                with self.assertRaises(GenerationError) as caught:
                    await self.request()
                self.assertTrue(caught.exception.repairable)
                self.assertEqual(caught.exception.draft, value)
                self.assertEqual(caught.exception.cooldown, 0)
        self.assertEqual(len(self.calls), 2)

    async def test_empty_malformed_truncated_and_refused_answers_fail(self):
        cases = [answer(''), answer('invalid'), answer('{"answer":','length'), answer('{}','content_filter'),
                 httpx.Response(200,json=None), httpx.Response(200,json={'choices':[{'message':None}]})]
        for response in cases:
            with self.subTest(response=response), self.transport(lambda request:response):
                with self.assertRaises(GenerationError):
                    await generate_deepseek_json('i','q',SCHEMA)

    async def test_upstream_error_in_http_200_is_not_accepted(self):
        with self.transport(lambda request:httpx.Response(200,json={'error':{'code':402,'message':'fixture-deepseek-key'}})):
            with self.assertRaises(GenerationError) as caught:
                await generate_deepseek_json('i','q',SCHEMA)
        self.assertEqual(caught.exception.status_code, 402)
        self.assertNotIn('fixture-deepseek-key', str(caught.exception))

    async def test_network_error_does_not_leak_credentials(self):
        def fail(request):
            raise httpx.ConnectError('fixture-deepseek-key', request=request)
        with self.transport(fail):
            with self.assertRaises(GenerationUnavailableError) as caught:
                await generate_deepseek_json('i','q',SCHEMA)
        self.assertNotIn('fixture-deepseek-key', str(caught.exception))

    async def test_total_deadline_stops_keepalive_stream(self):
        class KeepAlive(httpx.AsyncByteStream):
            closed = False
            async def __aiter__(self):
                while True:
                    await asyncio.sleep(.01)
                    yield b' '
            async def aclose(self):
                self.closed = True
        stream = KeepAlive()
        started = time.monotonic()
        with patch.object(settings,'DEEPSEEK_REQUEST_TIMEOUT',1), self.transport(lambda request:httpx.Response(200,stream=stream)):
            with self.assertRaises(GenerationUnavailableError):
                await generate_deepseek_json('i','q',SCHEMA)
        self.assertLess(time.monotonic()-started, 2)
        self.assertTrue(stream.closed)

    async def test_invalid_model_is_rejected_before_network(self):
        with patch.object(settings,'DEEPSEEK_MODEL','https://untrusted.invalid/model'), self.transport(lambda request:answer()):
            with self.assertRaisesRegex(GenerationError,'MODEL is invalid'):
                await generate_deepseek_json('i','q',SCHEMA)
        self.assertEqual(self.calls, [])
