"""Server-only structured generation through the explicitly selected provider."""

import json
import logging
import time
import re
from copy import deepcopy

import httpx
from jsonschema import ValidationError, validate

from ..config import settings
from .gemini_service import GeminiError, GeminiUnavailableError, gemini_service
from .retry import RetryExhausted, RetryPolicy, retry_request, TRANSIENT_STATUSES, retry_after

logger = logging.getLogger(__name__)


class GenerationError(RuntimeError):
    pass


class GenerationUnavailableError(GenerationError):
    """The workflow must retain its checkpoint after a transient provider failure."""


def student_personalization_prompt(student_name, roll_no, department, institution):
    """Keep the same student identity across generated examples and test runs."""
    return (
        "CRITICAL REQUIREMENT: For all code examples requiring sample data, records, classes, "
        "test cases, or comments (such as student records, banking accounts, employee management, "
        "or greeting outputs), DO NOT USE 'John Doe' or generic placeholders. You MUST use the "
        "student's actual details:\n"
        f"- Student Name: {student_name}\n"
        f"- Roll No / USN: {roll_no}\n"
        f"- Department: {department}\n"
        f"- Institution: {institution}\n"
        "Ensure variable assignments, print statements, and test runs reflect these exact details."
    )


def strict_json_schema(schema):
    """Convert the existing Gemini schemas into Groq's strict JSON Schema subset."""
    result = deepcopy(schema)

    def convert(node):
        if not isinstance(node, dict):
            return
        if isinstance(node.get("type"), str):
            node["type"] = node["type"].lower()
        if node.get("type") == "object":
            node["additionalProperties"] = False
            node["required"] = list(node.get("properties", {}))
        for child in node.get("properties", {}).values():
            convert(child)
        convert(node.get("items"))
        for keyword in ("anyOf", "oneOf", "allOf"):
            for child in node.get(keyword, []):
                convert(child)

    convert(result)
    return result


class GenerationService:
    def __init__(self):
        self._groq_unavailable_until = 0
        self._backup_unavailable_until = 0
        self._free_unavailable_until = {}

    @property
    def provider_name(self):
        if self._free_providers(): return 'AI providers'
        return {"groq": "Groq", "gemini": "Gemini", "openrouter":"OpenRouter", "opencode":"OpenCode"}.get(settings.LLM_PROVIDER.lower(), "AI provider")

    async def generate_json(self, instructions, content, schema, on_retry=None):
        primary=settings.LLM_PROVIDER.lower()
        if primary not in {'groq','gemini','openrouter','opencode'}:
            raise GenerationError('Unsupported LLM_PROVIDER. Use groq, gemini, openrouter, or opencode.')
        routes=self._free_providers()
        errors=[]
        if primary not in {'openrouter','opencode'}:
            try:
                return await self._configured_generation(instructions,content,schema,on_retry)
            except GenerationError as error:
                if not routes: raise
                errors.append(error)
                logger.warning('Configured AI route failed; trying free-only backups (%s).',type(error).__name__)
        else:
            routes=[primary]+[p for p in routes if p!=primary]
        for provider in routes:
            identity=self._free_identity(provider)
            if time.monotonic()<self._free_unavailable_until.get(identity,0):
                errors.append(GenerationUnavailableError(provider+' is cooling down.'))
                continue
            try:
                logger.info('Trying free-only provider %s.',provider)
                return await self._free_generation(provider,instructions,content,schema)
            except GenerationError as error:
                errors.append(error)
                delay=getattr(error,'cooldown',settings.LLM_FALLBACK_COOLDOWN_SECONDS)
                if delay>0: self._free_unavailable_until[identity]=time.monotonic()+min(delay,3600)
                logger.warning('Free-only provider %s failed (%s); continuing fallback chain.',provider,type(error).__name__)
                if on_retry: await on_retry(len(errors),0,getattr(error,'status_code',None))
        # Keep transient outages checkpoint-compatible; never silently replace a
        # failed generation with fabricated lab code when every route is down.
        repairable=[error for error in errors if getattr(error,'repairable',False) or isinstance(getattr(error,'draft',None),dict)]
        if repairable:
            # A reachable model returned a bad answer. Preserve that diagnostic
            # for the existing bounded code/test repair workflow.
            raise repairable[-1]
        if any(isinstance(e,GenerationUnavailableError) for e in errors):
            raise GenerationUnavailableError('All configured AI routes are unavailable, rate-limited, or cooling down. Completed results are saved; retry to resume.') from None
        if errors:
            # Authentication/model access requires an operator fix, not a toy
            # local answer. Preserve the job for retry, including non-web jobs.
            raise GenerationUnavailableError('All configured AI routes failed. '+str(errors[-1])+' Completed results are saved; retry after correcting provider access.') from None
        raise GenerationError('No AI provider is configured for this request.')

    def _free_providers(self):
        enabled={'openrouter':bool(settings.OPENROUTER_API_KEY),'opencode':settings.OPENCODE_ENABLED}
        order=[p.strip().lower() for p in settings.FREE_LLM_FALLBACK_ORDER.split(',') if p.strip()]
        if len(order)>2 or len(set(order))!=len(order) or any(p not in enabled for p in order):
            raise GenerationError('FREE_LLM_FALLBACK_ORDER must list openrouter and/or opencode once each.')
        return [p for p in order if enabled[p]]

    def _free_identity(self,provider):
        import hashlib
        key=settings.OPENROUTER_API_KEY if provider=='openrouter' else settings.OPENCODE_API_KEY
        model=settings.OPENROUTER_MODEL if provider=='openrouter' else settings.OPENCODE_MODEL
        return provider,model,hashlib.sha256(key.encode()).digest()

    async def _free_generation(self,provider,instructions,content,schema):
        from .free_provider_service import generate_free_json
        return await generate_free_json(provider,instructions,content,schema)

    async def _configured_generation(self, instructions, content, schema, on_retry=None):
        fallback = settings.LLM_FALLBACK_PROVIDER.lower()
        available = fallback == "gemini" and bool(settings.GEMINI_API_KEY) and settings.LLM_PROVIDER.lower() == "groq" and time.monotonic() >= self._backup_unavailable_until
        model_backup = bool(settings.LLM_PROVIDER.lower()=='groq' and settings.GROQ_API_KEY and settings.GROQ_FALLBACK_MODEL and settings.GROQ_FALLBACK_MODEL!=settings.GROQ_MODEL)
        async def recover():
            if available:
                try:
                    logger.warning('Trying configured Gemini backup after Groq unavailability.')
                    return await self._gemini(instructions, content, schema, on_retry)
                except GenerationError:
                    self._backup_unavailable_until = time.monotonic() + 300
            if model_backup:
                logger.warning('Trying configured Groq backup model %s.',settings.GROQ_FALLBACK_MODEL)
                return await self._primary(instructions, content, schema, on_retry, bool(self._free_providers()), model_override=settings.GROQ_FALLBACK_MODEL)
            self._groq_unavailable_until=0
            return await self._primary(instructions, content, schema, on_retry, bool(self._free_providers()))
        if (available or model_backup) and time.monotonic() < self._groq_unavailable_until:
            return await recover()
        try:
            return await self._primary(instructions, content, schema, on_retry, available or model_backup or bool(self._free_providers()))
        except GenerationUnavailableError:
            if not available and not model_backup: raise
            self._groq_unavailable_until = max(self._groq_unavailable_until, time.monotonic() + settings.LLM_FALLBACK_COOLDOWN_SECONDS)
            if on_retry: await on_retry(1, 0, 429)
            return await recover()

    async def _gemini(self, instructions, content, schema, on_retry):
        try:
            result = await gemini_service.generate_json(instructions, content, schema, on_retry=on_retry)
            validate(instance=result, schema=strict_json_schema(schema))
            return result
        except GeminiUnavailableError as error:
            raise GenerationUnavailableError(str(error)) from None
        except (GeminiError, ValidationError) as error:
            raise GenerationError("Gemini returned an invalid structured answer." if isinstance(error, ValidationError) else str(error)) from None

    async def _primary(self, instructions, content, schema, on_retry, can_fallback=False, model_override=None):
        provider = settings.LLM_PROVIDER.lower()
        if provider == "gemini":
            return await self._gemini(instructions, content, schema, on_retry)
        if provider != "groq":
            raise GenerationError("Unsupported LLM_PROVIDER. Use groq or gemini.")
        if not settings.GROQ_API_KEY:
            raise GenerationError("Groq is not configured. Add GROQ_API_KEY to the backend environment.")
        model = model_override or settings.GROQ_MODEL
        if not model or any(char not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/._" for char in model):
            raise GenerationError("The configured Groq model name is invalid.")
        converted = strict_json_schema(schema)
        payload = {
            "model": model,
            "messages": [{"role": "system", "content": instructions}, {"role": "user", "content": content}],
            "response_format": {"type": "json_schema", "json_schema": {
                "name": "labmate_response", "strict": True, "schema": converted,
            }},
            "temperature": 0.2,
            "max_completion_tokens": settings.GROQ_MAX_COMPLETION_TOKENS,
        }
        if model in {'openai/gpt-oss-120b', 'openai/gpt-oss-20b'}:
            if settings.GROQ_REASONING_EFFORT not in {'low', 'medium', 'high'}:
                raise GenerationError('GROQ_REASONING_EFFORT must be low, medium, or high.')
            payload['reasoning_effort'] = settings.GROQ_REASONING_EFFORT

        async def notify(attempt, delay, status):
            logger.warning("Groq transient failure (%s); retry %s in %.2fs.", status or "network", attempt, delay)
            if on_retry:
                await on_retry(attempt, delay, status)

        async with httpx.AsyncClient(timeout=settings.GROQ_REQUEST_TIMEOUT) as client:
            async def request():
                try:
                    response = await client.post("https://api.groq.com/openai/v1/chat/completions",
                                        headers={"Authorization": "Bearer " + settings.GROQ_API_KEY}, json=payload)
                except httpx.TransportError:
                    if can_fallback: raise GenerationUnavailableError("Groq transport unavailable.") from None
                    raise
                if response.status_code == 429:
                    try:
                        message=str(response.json().get('error',{}).get('message',''))
                        windows=[window for window in ('tokens per minute','tokens per day','requests per minute','requests per day') if window in message.lower()]
                        counters=re.findall(r'(?:Limit|Used|Requested)\s*\d+',message,re.I)
                        logger.warning('Groq quota windows=%s counters=%s retry_after_seconds=%.1f',windows,counters,retry_after(response))
                    except (ValueError,AttributeError): pass
                if can_fallback and response.status_code in TRANSIENT_STATUSES:
                    self._groq_unavailable_until = time.monotonic() + max(settings.LLM_FALLBACK_COOLDOWN_SECONDS, min(retry_after(response), 3600))
                    raise GenerationUnavailableError("Groq is temporarily rate-limited or unavailable.")
                return response
            try:
                response = await retry_request(
                    request,
                    RetryPolicy(settings.GROQ_RETRY_ATTEMPTS, settings.GROQ_RETRY_BASE_DELAY, settings.GROQ_RETRY_MAX_DELAY),
                    on_retry=notify,
                )
            except RetryExhausted:
                raise GenerationUnavailableError("Groq is temporarily unavailable or rate-limited. Your completed results are saved; retry to resume.") from None
        # Do not return raw provider responses, which could contain sensitive inputs.
        if response.status_code in (401, 403):
            raise GenerationError("Groq rejected access. Check the backend GROQ_API_KEY and model permissions.")
        if response.status_code == 404:
            raise GenerationError("The configured Groq model is unavailable. Check GROQ_MODEL.")
        if not response.is_success:
            try:
                error_data = response.json().get("error", {})
                logger.warning("Groq request failed: HTTP %s, type=%s, code=%s", response.status_code,
                               str(error_data.get("type", "unknown"))[:80],
                               str(error_data.get("code", "unknown"))[:80])
                if error_data.get('code') == 'json_validate_failed':
                    try:
                        draft = json.loads(error_data.get('failed_generation', ''))
                        validate(instance=draft, schema=converted)
                        return draft
                    except ValidationError as validation_error:
                        path = '.'.join(str(p) for p in validation_error.absolute_path)[:150] or 'root'
                        fields = ', missing ' + ', '.join(k for k in validation_error.validator_value if k not in validation_error.instance) if validation_error.validator == 'required' else ''
                        error=GenerationError(f'Provider JSON draft violates {validation_error.validator} at {path}{fields}. Regenerate using the exact response schema.')
                        error.draft=draft
                        raise error from None
                    except json.JSONDecodeError as error:
                        raise GenerationError(f'Provider returned invalid JSON: {error.msg} at character {error.pos}. Return one complete JSON object with escaped source strings; no markdown fences or trailing text.') from None
                    except (ValueError, TypeError):
                        raise GenerationError('Provider returned truncated or invalid JSON. Keep the complete project and tests concise enough for the response token limit.') from None
            except (ValueError, AttributeError):
                pass
            raise GenerationError(f"Groq rejected the request (HTTP {response.status_code}). Check the model, schema, and document size.")
        try:
            message = response.json()["choices"][0]
            if message.get("finish_reason") == "length":
                raise GenerationError("Groq's answer exceeded the response limit. Try a smaller programming question.")
            if message["message"].get("refusal"):
                raise GenerationError("Groq could not answer this programming question.")
            result = json.loads(message["message"]["content"])
            validate(instance=result, schema=converted)
        except ValidationError:
            error=GenerationError('Groq returned an invalid structured answer. Retry processing.')
            error.draft=result
            raise error from None
        except (ValueError, TypeError, KeyError, IndexError):
            raise GenerationError("Groq returned an incomplete or invalid structured answer. Retry processing.") from None
        return result


generation_service = GenerationService()
