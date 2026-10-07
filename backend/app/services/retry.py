"""Bounded asynchronous retries with exponential full jitter and Retry-After support."""

import asyncio
import random
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Awaitable, Callable, Optional

import httpx

TRANSIENT_STATUSES = frozenset({429, 500, 502, 503, 504})


class RetryExhausted(RuntimeError):
    def __init__(self, attempts: int, status: Optional[int] = None):
        self.attempts, self.status = attempts, status
        super().__init__("The provider is temporarily unavailable after retries.")


@dataclass(frozen=True)
class RetryPolicy:
    attempts: int = 8
    base_delay: float = 1.0
    max_delay: float = 30.0

    def __post_init__(self):
        if self.attempts < 1 or self.base_delay < 0 or self.max_delay < self.base_delay:
            raise ValueError("Invalid retry policy.")


def retry_after(response: Optional[httpx.Response]) -> float:
    raw = response.headers.get("Retry-After", "") if response is not None else ""
    try:
        return max(0.0, float(raw))
    except ValueError:
        try:
            date = parsedate_to_datetime(raw)
            if date.tzinfo is None:
                date = date.replace(tzinfo=timezone.utc)
            return max(0.0, (date - datetime.now(timezone.utc)).total_seconds())
        except (TypeError, ValueError, OverflowError):
            return 0.0


async def retry_request(
    operation: Callable[[], Awaitable[httpx.Response]],
    policy: RetryPolicy = RetryPolicy(),
    on_retry: Optional[Callable[[int, float, Optional[int]], Awaitable[None]]] = None,
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    uniform: Callable[[float, float], float] = random.uniform,
) -> httpx.Response:
    for attempt in range(policy.attempts):
        response = None
        try:
            response = await operation()
            if response.status_code not in TRANSIENT_STATUSES:
                return response
        except (httpx.TransportError, httpx.TimeoutException):
            pass
        # Cancellation propagates naturally; it must never turn into another request.
        status = response.status_code if response is not None else None
        if attempt + 1 == policy.attempts:
            raise RetryExhausted(policy.attempts, status)
        ceiling = min(policy.max_delay, policy.base_delay * 2 ** attempt)
        provider_delay = retry_after(response)
        if provider_delay > max(60.0, policy.max_delay):
            # Honor a short provider cooldown even when it exceeds the jitter
            # ceiling; a daily quota reset must pause instead of occupying a
            # worker for many minutes or hours.
            raise RetryExhausted(attempt + 1, status)
        delay = max(uniform(0.0, ceiling), provider_delay)
        if on_retry:
            await on_retry(attempt + 1, delay, status)
        await sleep(delay)
    raise RetryExhausted(policy.attempts)
