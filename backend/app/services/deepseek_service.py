"""Backend-only DeepSeek JSON output with local schema validation and a total deadline."""
import asyncio
import json
import re

import httpx
from httpx import AsyncClient
from jsonschema import ValidationError, validate

from ..config import settings
from .generation_service import GenerationError, GenerationUnavailableError, invalid_answer, strict_json_schema
from .retry import TRANSIENT_STATUSES, retry_after


def rejected(status, delay=0):
    transient = status in TRANSIENT_STATUSES
    message = f'DeepSeek rejected the request (HTTP {status}).'
    if status == 402:
        message += ' DeepSeek account balance is insufficient; other configured routes may still work.'
    elif status in {401, 403}:
        message += ' Check the backend API key and account permissions.'
    elif status == 404:
        message += ' Check DEEPSEEK_MODEL on the backend.'
    error = (GenerationUnavailableError if transient else GenerationError)(message)
    error.status_code = status
    error.cooldown = max(settings.LLM_FALLBACK_COOLDOWN_SECONDS, min(delay, 3600)) if transient else 300
    return error


def invalid_output(message, draft=None):
    error = invalid_answer(message, draft)
    error.cooldown = 0
    return error


async def generate_deepseek_json(instructions, content, schema):
    if not settings.DEEPSEEK_ENABLED or not settings.DEEPSEEK_API_KEY:
        raise GenerationError('DeepSeek is not enabled with a backend API key.')
    if not re.fullmatch(r'[A-Za-z0-9._-]{1,100}', settings.DEEPSEEK_MODEL):
        raise GenerationError('DEEPSEEK_MODEL is invalid.')
    converted = strict_json_schema(schema)
    payload = {
        'model': settings.DEEPSEEK_MODEL,
        'messages': [
            {'role': 'system', 'content': instructions + '\nReturn only one JSON object matching this schema, with all fields and no extra keys:\n' + json.dumps(converted)},
            {'role': 'user', 'content': content},
        ],
        'response_format': {'type': 'json_object'},
        'thinking': {'type': 'disabled'},
        'max_tokens': max(128, min(settings.DEEPSEEK_MAX_TOKENS, 16000)),
        'temperature': 0.2,
        'stream': False,
    }
    deadline = max(1, min(settings.DEEPSEEK_REQUEST_TIMEOUT, 120))
    try:
        async with asyncio.timeout(deadline):
            async with AsyncClient(timeout=deadline, follow_redirects=False) as client:
                response = await client.post('https://api.deepseek.com/chat/completions',
                    headers={'Authorization': 'Bearer ' + settings.DEEPSEEK_API_KEY, 'Content-Type': 'application/json'}, json=payload)
    except TimeoutError:
        raise GenerationUnavailableError('DeepSeek exceeded the total response deadline; the request was stopped.') from None
    except httpx.TransportError:
        raise GenerationUnavailableError('DeepSeek transport is temporarily unavailable.') from None
    if not response.is_success:
        # Provider bodies can echo submitted source and credentials. Never expose them.
        raise rejected(response.status_code, retry_after(response))
    try:
        body = response.json()
        if isinstance(body, dict) and body.get('error'):
            upstream = body['error']
            try:
                status = int(upstream.get('code', 502)) if isinstance(upstream, dict) else 502
            except (TypeError, ValueError):
                status = 502
            raise rejected(status)
        choice = body['choices'][0]
        reason = choice.get('finish_reason')
        if reason == 'length':
            raise invalid_output('DeepSeek response exceeded the output limit; incomplete JSON was rejected.')
        if reason in {'insufficient_system_resource', 'aborted'}:
            raise GenerationUnavailableError('DeepSeek interrupted its response; retry when provider access is available.')
        if reason != 'stop' or choice['message'].get('refusal'):
            raise GenerationError('DeepSeek did not produce a complete structured answer.')
        result = json.loads(choice['message']['content'])
        validate(result, converted)
    except ValidationError:
        raise invalid_output('DeepSeek returned an answer that does not match the required JSON schema.', result) from None
    except (ValueError, TypeError, KeyError, IndexError, AttributeError):
        raise invalid_output('DeepSeek returned invalid or empty JSON.') from None
    return result
