"""Server-only Gemini generation with recoverable provider failures."""

import json
import logging
from typing import Any, Awaitable, Callable, Optional

import httpx

from ..config import settings
from .retry import RetryExhausted, RetryPolicy, retry_request

logger = logging.getLogger(__name__)


class GeminiError(RuntimeError):
    pass


class GeminiUnavailableError(GeminiError):
    """Transient failure after the retry budget; callers should keep their checkpoint."""


class GeminiService:
    async def generate_json(self, instructions: str, content: str, schema: dict,
                            on_retry: Optional[Callable[[int, float, Optional[int]], Awaitable[None]]] = None) -> dict[str, Any]:
        if not settings.GEMINI_API_KEY:
            raise GeminiError("Gemini is not configured. Add GEMINI_API_KEY to the backend environment.")
        model = settings.GEMINI_MODEL
        if not model or any(char not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._" for char in model):
            raise GeminiError("The configured Gemini model name is invalid.")
        payload = {
            "systemInstruction": {"parts": [{"text": instructions}]},
            "contents": [{"role": "user", "parts": [{"text": content}]}],
            "generationConfig": {"responseMimeType": "application/json", "responseSchema": schema,
                                 "temperature": 0.2, "maxOutputTokens": 16384},
        }

        async def notify(attempt, delay, status):
            logger.warning("Gemini transient failure (%s); retry %s in %.2fs.", status or "network", attempt, delay)
            if on_retry:
                await on_retry(attempt, delay, status)

        async with httpx.AsyncClient(timeout=settings.GEMINI_REQUEST_TIMEOUT) as client:
            try:
                response = await retry_request(
                    lambda: client.post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                                        headers={"x-goog-api-key": settings.GEMINI_API_KEY}, json=payload),
                    RetryPolicy(settings.GEMINI_RETRY_ATTEMPTS, settings.GEMINI_RETRY_BASE_DELAY, settings.GEMINI_RETRY_MAX_DELAY),
                    on_retry=notify,
                )
            except RetryExhausted as error:
                raise GeminiUnavailableError("Gemini is temporarily unavailable. Your completed results are saved; retry to resume.") from error
        if response.status_code in (400, 401, 403):
            try:
                reason = str(response.json().get("error", {}).get("message", "")).lower()
            except ValueError:
                reason = ""
            if "api key" in reason or response.status_code in (401, 403):
                raise GeminiError("Google rejected the Gemini API key. Update the backend's GEMINI_API_KEY.")
            raise GeminiError("Gemini could not accept this request. Check the model and document size.")
        if response.status_code == 404:
            raise GeminiError("The configured Gemini model is unavailable. Update GEMINI_MODEL.")
        if not response.is_success:
            raise GeminiError(f"Gemini rejected the request (HTTP {response.status_code}).")
        try:
            body = response.json()
            candidates = body.get("candidates", [])
            if not candidates:
                raise GeminiError("Gemini returned no answer for this request.")
            text = "".join(part.get("text", "") for part in candidates[0].get("content", {}).get("parts", []) if not part.get("thought"))
            result = json.loads(text)
        except (ValueError, TypeError, AttributeError):
            raise GeminiError("Gemini returned an incomplete answer. Retry processing.") from None
        if not isinstance(result, dict):
            raise GeminiError("Gemini returned an unexpected answer format.")
        return result


gemini_service = GeminiService()
