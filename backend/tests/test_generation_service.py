import json
import unittest
from unittest.mock import AsyncMock, patch

import httpx

from app.config import settings
from app.services.gemini_service import GeminiUnavailableError
from app.services.generation_service import (
    GenerationError, GenerationUnavailableError, generation_service, strict_json_schema,
)

SCHEMA = {"type": "OBJECT", "properties": {"answer": {"type": "STRING"}}, "required": ["answer"]}


class GenerationServiceTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.patches = [patch.object(settings, "LLM_PROVIDER", "groq"), patch.object(settings, "GROQ_API_KEY", "unit-test-key"),
                        patch.object(settings, "GROQ_MODEL", "openai/gpt-oss-120b"), patch.object(settings, "GROQ_RETRY_ATTEMPTS", 2),
                        patch.object(settings, "GROQ_RETRY_BASE_DELAY", 0), patch.object(settings, "GROQ_RETRY_MAX_DELAY", 0)]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)

    async def request(self, handler, callback=None):
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        with patch("app.services.generation_service.httpx.AsyncClient", return_value=client):
            return await generation_service.generate_json("Return JSON.", "Question", SCHEMA, on_retry=callback)

    def test_strict_schema_conversion_does_not_modify_input(self):
        source = {"type": "OBJECT", "properties": {"questions": {"type": "ARRAY", "items": SCHEMA}}}
        result = strict_json_schema(source)
        self.assertEqual(source["type"], "OBJECT")
        self.assertEqual(result["required"], ["questions"])
        self.assertFalse(result["additionalProperties"])
        self.assertFalse(result["properties"]["questions"]["items"]["additionalProperties"])
        self.assertEqual(result["properties"]["questions"]["items"]["properties"]["answer"]["type"], "string")

    async def test_groq_request_uses_requested_model_and_strict_json(self):
        def handler(request):
            self.assertEqual(str(request.url), "https://api.groq.com/openai/v1/chat/completions")
            self.assertEqual(request.headers["Authorization"], "Bearer unit-test-key")
            body = json.loads(request.content)
            self.assertEqual(body["model"], "openai/gpt-oss-120b")
            self.assertTrue(body["response_format"]["json_schema"]["strict"])
            return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": '{"answer":"120"}', "reasoning": "ignored"}}]})
        self.assertEqual(await self.request(handler), {"answer": "120"})

    async def test_transient_503_retries_then_returns_answer(self):
        calls = []
        callback = AsyncMock()
        def handler(request):
            calls.append(request)
            return httpx.Response(503) if len(calls) == 1 else httpx.Response(200, json={"choices": [{"message": {"content": '{"answer":"done"}'}}]})
        self.assertEqual(await self.request(handler, callback), {"answer": "done"})
        self.assertEqual(len(calls), 2)
        callback.assert_awaited_once()

    async def test_exhausted_rate_limit_is_checkpoint_compatible(self):
        with self.assertRaises(GenerationUnavailableError):
            await self.request(lambda request: httpx.Response(429))

    async def test_long_rate_limit_pauses_without_sleeping_on_a_worker(self):
        calls = []
        with patch.object(settings, "GROQ_RETRY_MAX_DELAY", 30):
            with self.assertRaises(GenerationUnavailableError):
                await self.request(lambda request: (calls.append(request) or httpx.Response(429, headers={"Retry-After": "3600"})))
        self.assertEqual(len(calls), 1)

    async def test_rejected_key_and_invalid_json_do_not_leak_provider_body(self):
        with self.assertRaises(GenerationError) as error:
            await self.request(lambda request: httpx.Response(401, json={"error": "unit-test-key"}))
        self.assertNotIn("unit-test-key", str(error.exception))
        for content in ('{"answer":7}', '{"answer":"ok","extra":"bad"}', 'invalid'):
            with self.subTest(content=content), self.assertRaises(GenerationError):
                await self.request(lambda request: httpx.Response(200, json={"choices": [{"message": {"content": content}}]}))

    async def test_gemini_remains_explicit_and_converts_outages(self):
        with patch.object(settings, "LLM_PROVIDER", "gemini"), patch("app.services.generation_service.gemini_service.generate_json", AsyncMock(side_effect=GeminiUnavailableError("Provider busy"))):
            with self.assertRaises(GenerationUnavailableError):
                await generation_service.generate_json("Return JSON", "Question", SCHEMA)
