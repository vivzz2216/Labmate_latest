from __future__ import annotations

import asyncio
import logging
from typing import Optional

from ..config import settings

logger = logging.getLogger(__name__)

try:
    from anthropic import AsyncAnthropic
except ImportError:  # pragma: no cover - anthropic is optional in CI
    AsyncAnthropic = None


class ClaudeClient:
    """
    Thin wrapper around Anthropic's Claude API.
    The service degrades gracefully when the SDK or API key is not available.
    """

    def __init__(self) -> None:
        self.api_key = getattr(settings, "CLAUDE_API_KEY", "")
        self.model = getattr(settings, "CLAUDE_MODEL", "claude-3-5-sonnet-20241022")
        self.max_tokens = getattr(settings, "CLAUDE_MAX_TOKENS", 2000)
        self.timeout = getattr(settings, "CLAUDE_REQUEST_TIMEOUT", 45)
        self._client = None

        if self.api_key and AsyncAnthropic:
            self._client = AsyncAnthropic(api_key=self.api_key)
        elif self.api_key and not AsyncAnthropic:
            logger.warning(
                "Anthropic SDK is not installed, but CLAUDE_API_KEY is configured. "
                "Falling back to heuristic responses."
            )

    async def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
    ) -> Optional[str]:
        """
        Execute an Anthropic Messages API call and return the combined text block.
        Returns None when the API key is missing or an error occurs.
        """
        if not self._client:
            return None

        try:
            response = await asyncio.wait_for(
                self._client.messages.create(
                    model=self.model,
                    max_tokens=self.max_tokens,
                    temperature=temperature,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}],
                ),
                timeout=self.timeout,
            )
            chunks = []
            for block in getattr(response, "content", []):
                text = getattr(block, "text", None)
                if text:
                    chunks.append(text)
            return "\n".join(chunks).strip() if chunks else None
        except asyncio.TimeoutError:
            logger.error("Claude request timed out after %ss", self.timeout)
        except Exception as exc:  # pragma: no cover - network failures are non-deterministic
            logger.error("Claude API request failed: %s", exc, exc_info=True)
        return None

