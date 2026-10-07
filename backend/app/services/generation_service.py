"""Server-only structured generation through the explicitly selected provider."""

import json
import logging
from copy import deepcopy

import httpx
from jsonschema import ValidationError, validate

from ..config import settings
from .gemini_service import GeminiError, GeminiUnavailableError, gemini_service
from .retry import RetryExhausted, RetryPolicy, retry_request

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
    @property
    def provider_name(self):
        return {"groq": "Groq", "gemini": "Gemini"}.get(settings.LLM_PROVIDER.lower(), "AI provider")

    async def generate_json(self, instructions, content, schema, on_retry=None):
        provider = settings.LLM_PROVIDER.lower()
        if provider == "gemini":
            try:
                return await gemini_service.generate_json(instructions, content, schema, on_retry=on_retry)
            except GeminiUnavailableError as error:
                raise GenerationUnavailableError(str(error)) from None
            except GeminiError as error:
                raise GenerationError(str(error)) from None
        if provider != "groq":
            raise GenerationError("Unsupported LLM_PROVIDER. Use groq or gemini.")
        if not settings.GROQ_API_KEY:
            raise GenerationError("Groq is not configured. Add GROQ_API_KEY to the backend environment.")
        model = settings.GROQ_MODEL
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
            "max_completion_tokens": 16384,
        }

        async def notify(attempt, delay, status):
            logger.warning("Groq transient failure (%s); retry %s in %.2fs.", status or "network", attempt, delay)
            if on_retry:
                await on_retry(attempt, delay, status)

        async with httpx.AsyncClient(timeout=settings.GROQ_REQUEST_TIMEOUT) as client:
            try:
                response = await retry_request(
                    lambda: client.post("https://api.groq.com/openai/v1/chat/completions",
                                        headers={"Authorization": "Bearer " + settings.GROQ_API_KEY}, json=payload),
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
        except (ValueError, TypeError, KeyError, IndexError, ValidationError):
            raise GenerationError("Groq returned an incomplete or invalid structured answer. Retry processing.") from None
        return result


generation_service = GenerationService()
