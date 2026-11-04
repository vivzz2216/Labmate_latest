"""Shared provider/account/model RPM and TPM budgeting with bounded admission.

Provides proactive rate and token budgeting across worker processes via Redis,
falling back smoothly to an in-process thread-safe sliding window if Redis is
unavailable or disconnected. Honors explicit Retry-After headers and bounds
wait durations to preserve workflow responsiveness and checkpoints.
"""

import asyncio
import hashlib
import logging
import threading
import time
from collections import deque
from contextlib import asynccontextmanager
from typing import Optional, Tuple

from ..config import settings

logger = logging.getLogger(__name__)

_redis_last_check = 0.0
_redis_available = False


def account_hash(api_key: Optional[str]) -> str:
    """Produce a safe, non-reversible identifier for account-level quota tracking without logging credentials."""
    if not api_key:
        return "none"
    return hashlib.sha256(str(api_key).encode("utf-8")).hexdigest()[:16]


def _get_redis():
    global _redis_last_check, _redis_available
    if not getattr(settings, "REDIS_URL", None):
        return None
    now = time.monotonic()
    if not _redis_available and (now - _redis_last_check) < 30.0:
        return None
    try:
        from .. import cache
        client = getattr(cache, "redis_client", None)
        if client is None:
            return None
        _redis_last_check = now
        client.ping()
        _redis_available = True
        return client
    except Exception as e:
        _redis_available = False
        _redis_last_check = now
        logger.debug("Redis not available for provider budget: %s", e)
        return None


class _LocalProviderBudget:
    """Thread-safe, in-process sliding window budget tracker."""

    def __init__(self):
        self._lock = threading.Lock()
        # key: (provider, model, account_hash) -> deque of (timestamp, tokens)
        self._windows: dict[Tuple[str, str, str], deque] = {}
        # key: (provider, model, account_hash) -> float (monotonic cooldown expiry)
        self._cooldowns: dict[Tuple[str, str, str], float] = {}

    def reset(self):
        with self._lock:
            self._windows.clear()
            self._cooldowns.clear()

    def report_cooldown(self, provider: str, model: str, account_id: str, cooldown_seconds: float):
        key = (provider.lower(), model.lower(), account_id)
        expiry = time.monotonic() + max(0.0, float(cooldown_seconds))
        with self._lock:
            self._cooldowns[key] = max(self._cooldowns.get(key, 0.0), expiry)

    def check_admission(
        self,
        provider: str,
        model: str,
        account_id: str,
        rpm_limit: int,
        tpm_limit: int,
        estimated_tokens: int,
    ) -> Tuple[bool, float]:
        """Check if request can be admitted now; returns (allowed, wait_seconds)."""
        key = (provider.lower(), model.lower(), account_id)
        now_mono = time.monotonic()
        now_wall = time.time()

        with self._lock:
            # 1. Check cooldown (e.g. from Retry-After or provider 429)
            cooldown_expiry = self._cooldowns.get(key, 0.0)
            if cooldown_expiry > now_mono:
                return False, max(0.1, cooldown_expiry - now_mono)

            window = self._windows.setdefault(key, deque())
            # Clean up events older than 60 seconds
            cutoff = now_wall - 60.0
            while window and window[0][0] < cutoff:
                window.popleft()

            # 2. Check RPM
            if rpm_limit > 0 and len(window) >= rpm_limit:
                oldest_time = window[0][0]
                wait = max(0.1, (oldest_time + 60.0) - now_wall)
                return False, wait

            # 3. Check TPM
            if tpm_limit > 0:
                current_tokens = sum(t for _, t in window)
                if current_tokens + estimated_tokens > tpm_limit:
                    needed_reduction = (current_tokens + estimated_tokens) - tpm_limit
                    freed = 0
                    wait = 0.1
                    for ts, toks in window:
                        freed += toks
                        wait = max(0.1, (ts + 60.0) - now_wall)
                        if freed >= needed_reduction:
                            break
                    return False, wait

            return True, 0.0

    def record_admission(self, provider: str, model: str, account_id: str, tokens: int):
        key = (provider.lower(), model.lower(), account_id)
        now_wall = time.time()
        with self._lock:
            window = self._windows.setdefault(key, deque())
            window.append((now_wall, max(1, tokens)))


class ProviderBudgetManager:
    """Coordinates provider RPM and TPM limits across workers with bounded wait times."""

    def __init__(self):
        self._local = _LocalProviderBudget()

    def reset(self):
        """Reset local tracking state. Essential for test isolation."""
        global _redis_last_check, _redis_available
        _redis_last_check = 0.0
        _redis_available = False
        self._local.reset()
        try:
            from .. import cache
            client = getattr(cache, "redis_client", None)
            if client is not None:
                keys = client.keys("labmate:budget:*")
                if keys:
                    client.delete(*keys)
        except Exception:
            pass

    def get_rpm_limit(self, provider: str, model: str) -> int:
        p = provider.lower()
        if p == "groq":
            return int(getattr(settings, "GROQ_RPM_LIMIT", 30))
        elif p == "gemini":
            return int(getattr(settings, "GEMINI_RPM_LIMIT", 15))
        elif p == "openrouter":
            return int(getattr(settings, "OPENROUTER_RPM_LIMIT", 20))
        elif p == "opencode":
            return int(getattr(settings, "OPENCODE_RPM_LIMIT", 20))
        elif p == "deepseek":
            return int(getattr(settings, "DEEPSEEK_RPM_LIMIT", 30))
        elif p == "glm":
            return int(getattr(settings, "GLM_RPM_LIMIT", 30))
        return int(getattr(settings, "PROVIDER_DEFAULT_RPM_LIMIT", 30))

    def get_tpm_limit(self, provider: str, model: str) -> int:
        p = provider.lower()
        if p == "groq":
            return int(getattr(settings, "GROQ_TPM_LIMIT", 30000))
        elif p == "gemini":
            return int(getattr(settings, "GEMINI_TPM_LIMIT", 1000000))
        elif p == "openrouter":
            return int(getattr(settings, "OPENROUTER_TPM_LIMIT", 40000))
        elif p == "opencode":
            return int(getattr(settings, "OPENCODE_TPM_LIMIT", 40000))
        elif p == "deepseek":
            return int(getattr(settings, "DEEPSEEK_TPM_LIMIT", 60000))
        elif p == "glm":
            return int(getattr(settings, "GLM_TPM_LIMIT", 60000))
        return int(getattr(settings, "PROVIDER_DEFAULT_TPM_LIMIT", 40000))

    def report_rate_limit(
        self,
        provider: str,
        model: str,
        account_id: str = "none",
        retry_after_seconds: float = 60.0,
    ):
        """Record an explicit 429 Retry-After signal to proactively cool down this provider route."""
        wait = max(1.0, float(retry_after_seconds))
        self._local.report_cooldown(provider, model, account_id, wait)
        r = _get_redis()
        if r:
            try:
                cooldown_key = f"labmate:budget:cooldown:{provider.lower()}:{model.lower()}:{account_id}"
                r.set(cooldown_key, str(time.time() + wait), ex=int(wait) + 5)
            except Exception as e:
                logger.debug("Failed to set Redis cooldown: %s", e)

    def _check_admission(
        self,
        provider: str,
        model: str,
        account_id: str,
        rpm_limit: int,
        tpm_limit: int,
        estimated_tokens: int,
    ) -> Tuple[bool, float]:
        r = _get_redis()
        if r:
            try:
                now_wall = time.time()
                cooldown_key = f"labmate:budget:cooldown:{provider.lower()}:{model.lower()}:{account_id}"
                rpm_key = f"labmate:budget:rpm:{provider.lower()}:{model.lower()}:{account_id}"
                minute_bucket = int(now_wall // 60)
                tpm_key = f"labmate:budget:tpm:{provider.lower()}:{model.lower()}:{account_id}:{minute_bucket}"

                pipe = r.pipeline()
                pipe.get(cooldown_key)
                pipe.zremrangebyscore(rpm_key, 0, now_wall - 60.0)
                pipe.zcard(rpm_key)
                pipe.zrange(rpm_key, 0, 0, withscores=True)
                pipe.get(tpm_key)
                cooldown_val, _, rpm_count, oldest_rpm, tpm_val = pipe.execute()

                # Check cooldown
                if cooldown_val:
                    try:
                        exp = float(cooldown_val)
                        if exp > now_wall:
                            return False, max(0.1, exp - now_wall)
                    except (ValueError, TypeError):
                        pass

                # Check RPM
                if rpm_limit > 0 and int(rpm_count or 0) >= rpm_limit:
                    if oldest_rpm and len(oldest_rpm) > 0:
                        oldest_ts = float(oldest_rpm[0][1])
                        return False, max(0.1, (oldest_ts + 60.0) - now_wall)
                    return False, 1.0

                # Check TPM
                if tpm_limit > 0 and (int(tpm_val or 0) + estimated_tokens) > tpm_limit:
                    seconds_left_in_minute = max(0.1, float(((minute_bucket + 1) * 60) - now_wall))
                    return False, seconds_left_in_minute

                # Also verify with local budget for in-process safety
                return self._local.check_admission(
                    provider, model, account_id, rpm_limit, tpm_limit, estimated_tokens
                )
            except Exception as e:
                logger.debug("Redis admission check failed, using local: %s", e)

        return self._local.check_admission(
            provider, model, account_id, rpm_limit, tpm_limit, estimated_tokens
        )

    def _record_admission(
        self,
        provider: str,
        model: str,
        account_id: str,
        tokens: int,
    ):
        self._local.record_admission(provider, model, account_id, tokens)
        r = _get_redis()
        if r:
            try:
                import uuid
                now_wall = time.time()
                minute_bucket = int(now_wall // 60)
                rpm_key = f"labmate:budget:rpm:{provider.lower()}:{model.lower()}:{account_id}"
                tpm_key = f"labmate:budget:tpm:{provider.lower()}:{model.lower()}:{account_id}:{minute_bucket}"

                pipe = r.pipeline()
                pipe.zadd(rpm_key, {f"{now_wall}:{uuid.uuid4().hex[:8]}": now_wall})
                pipe.expire(rpm_key, 120)
                pipe.incrby(tpm_key, max(1, tokens))
                pipe.expire(tpm_key, 120)
                pipe.execute()
            except Exception as e:
                logger.debug("Redis record admission failed: %s", e)

    async def acquire(
        self,
        provider: str,
        model: str,
        account_id: str = "none",
        estimated_tokens: int = 1000,
    ):
        """Bounded proactive admission for provider request.

        Honors Retry-After and rate limits, sleeping if wait <= PROVIDER_MAX_WAIT_SECONDS.
        Raises GenerationUnavailableError if wait > PROVIDER_MAX_WAIT_SECONDS or if cancelled.
        """
        if not getattr(settings, "PROVIDER_BUDGET_ENABLED", True):
            return

        rpm_limit = self.get_rpm_limit(provider, model)
        tpm_limit = self.get_tpm_limit(provider, model)
        max_wait = float(getattr(settings, "PROVIDER_MAX_WAIT_SECONDS", 30.0))

        start_time = time.monotonic()
        while True:
            allowed, wait_seconds = self._check_admission(
                provider, model, account_id, rpm_limit, tpm_limit, estimated_tokens
            )
            if allowed:
                self._record_admission(provider, model, account_id, estimated_tokens)
                return

            elapsed = time.monotonic() - start_time
            remaining_max_wait = max_wait - elapsed
            if wait_seconds > remaining_max_wait or remaining_max_wait <= 0:
                from .generation_service import GenerationUnavailableError
                raise GenerationUnavailableError(
                    f"AI provider {provider} ({model}) is rate-limited (wait {wait_seconds:.1f}s exceeds "
                    f"limit {max_wait:.1f}s). Completed results are saved; retry to resume."
                )

            sleep_time = min(wait_seconds, remaining_max_wait)
            logger.info(
                "Throttling %s (%s) for %.2fs under RPM=%s/TPM=%s budget.",
                provider, model, sleep_time, rpm_limit, tpm_limit,
            )
            await asyncio.sleep(sleep_time)

    @asynccontextmanager
    async def slot(
        self,
        provider: str,
        model: str,
        account_id: str = "none",
        estimated_tokens: int = 1000,
    ):
        """Context manager acquiring a budgeted slot and recording admission."""
        await self.acquire(provider, model, account_id, estimated_tokens)
        try:
            yield
        finally:
            pass


provider_budget = ProviderBudgetManager()
