"""Bounded admission for scarce, process-hungry resources (Chromium captures, heavy runtimes).

Two limits apply to every slot:

* a per-process cap, shared by asyncio callers and synchronous worker threads (one counter, so a
  ``sync_playwright`` thread and an async capture compete for the same budget), and
* an optional deployment-wide cap held in Redis, so N API/worker replicas do not each assume they
  own the whole machine. Holders are leases in a sorted set scored by expiry, so a crashed holder
  frees its slot when its lease lapses. If Redis is unavailable the per-process cap still holds and
  the degradation is counted in ``snapshot()['redis_errors']``.

Lock ordering (prevents deadlock): ``heavy_execution`` may be held while acquiring
``browser_capture``; never the reverse.
"""

import asyncio
import contextlib
import contextvars
import logging
import random
import threading
import time
import uuid
from typing import Callable

from ..config import settings

logger = logging.getLogger(__name__)


class BudgetTimeout(RuntimeError):
    """Capacity was not available within the bounded wait."""


class ResourceBudget:
    def __init__(self, name: str, local_limit: Callable[[], int], global_limit: Callable[[], int]):
        self.name = name
        self._local_limit, self._global_limit = local_limit, global_limit
        self._lock = threading.Lock()
        self._in_use = self._peak = self._waiting = 0
        self.acquired = self.timeouts = self.redis_errors = 0
        self.total_wait = self.max_wait = 0.0
        self._last_warning = 0.0
        # Re-entrancy: a context already holding this budget (e.g. execute -> capture_sql) must not
        # queue behind itself. asyncio tasks and asyncio.to_thread copy this context.
        self._held = contextvars.ContextVar(f"{name}_held", default=False)

    # ------------------------------------------------------------------ introspection
    def snapshot(self):
        with self._lock:
            return {"name": self.name, "in_use": self._in_use, "peak": self._peak, "waiting": self._waiting,
                    "acquired": self.acquired, "timeouts": self.timeouts, "redis_errors": self.redis_errors,
                    "total_wait_seconds": round(self.total_wait, 4), "max_wait_seconds": round(self.max_wait, 4),
                    "local_limit": max(1, int(self._local_limit())), "global_limit": int(self._global_limit())}

    def reset_metrics(self):
        with self._lock:
            self._peak = self._in_use
            self.acquired = self.timeouts = self.redis_errors = 0
            self.total_wait = self.max_wait = 0.0

    # ------------------------------------------------------------------ local cap
    def _try_local(self):
        with self._lock:
            if self._in_use < max(1, int(self._local_limit())):
                self._in_use += 1
                self._peak = max(self._peak, self._in_use)
                return True
            return False

    def _release_local(self):
        with self._lock:
            self._in_use = max(0, self._in_use - 1)

    # ------------------------------------------------------------------ deployment-wide cap
    def _global_enabled(self):
        return int(self._global_limit()) > 0

    def _key(self):
        return f"labmate:budget:{self.name}"

    def _redis(self):
        from .. import cache
        return cache.redis_client

    def _redis_failed(self, error):
        with self._lock:
            self.redis_errors += 1
            quiet = time.monotonic() - self._last_warning < 30
            self._last_warning = self._last_warning if quiet else time.monotonic()
        if not quiet:  # never include the URL: it may carry credentials
            logger.warning("Shared %s budget unavailable (%s); enforcing the per-process cap only.",
                           self.name, type(error).__name__)

    def _try_global(self, token):
        limit = int(self._global_limit())
        if limit <= 0:
            return True
        client = self._redis()
        if client is None:
            self._redis_failed(RuntimeError("no redis client"))
            return True
        try:
            now = time.time()
            pipe = client.pipeline(transaction=True)
            pipe.zremrangebyscore(self._key(), "-inf", now)
            pipe.zadd(self._key(), {token: now + max(1, int(settings.RESOURCE_LEASE_SECONDS))})
            pipe.zcard(self._key())
            count = pipe.execute()[-1]
            if count > limit:  # we were the over-limit entrant; the add and count were atomic
                client.zrem(self._key(), token)
                return False
            return True
        except Exception as error:
            self._redis_failed(error)
            return True

    def _release_global(self, token):
        if not self._global_enabled():
            return
        try:
            client = self._redis()
            if client is not None:
                client.zrem(self._key(), token)
        except Exception as error:  # the lease expires on its own
            self._redis_failed(error)

    # ------------------------------------------------------------------ bookkeeping
    def _begin_wait(self):
        with self._lock:
            self._waiting += 1

    def _end_wait(self, started, got):
        waited = time.monotonic() - started
        with self._lock:
            self._waiting -= 1
            if got:
                self.acquired += 1
                self.total_wait += waited
                self.max_wait = max(self.max_wait, waited)
            else:
                self.timeouts += 1

    @staticmethod
    def _pause():
        return random.uniform(0.03, 0.15)

    # ------------------------------------------------------------------ asynchronous API
    async def _acquire(self):
        token, started = uuid.uuid4().hex, time.monotonic()
        deadline = started + max(1.0, float(settings.RESOURCE_WAIT_SECONDS))
        self._begin_wait()
        got = False
        try:
            while True:
                if self._try_local():
                    try:
                        if not self._global_enabled():
                            got = True
                        else:
                            got = await asyncio.to_thread(self._try_global, token)
                    except BaseException:
                        self._release_local()
                        asyncio.get_running_loop().run_in_executor(None, self._release_global, token)
                        raise
                    if got:
                        return token
                    self._release_local()
                if time.monotonic() >= deadline:
                    raise BudgetTimeout(f"No {self.name.replace('_', ' ')} capacity became available; retry shortly.")
                await asyncio.sleep(self._pause())
        finally:
            self._end_wait(started, got)

    @contextlib.asynccontextmanager
    async def slot(self):
        if self._held.get():
            yield
            return
        token = await self._acquire()
        marker = self._held.set(True)
        try:
            yield
        finally:
            self._held.reset(marker)
            self._release_local()
            # Fire and forget: a cancelled caller must still free its shared lease promptly.
            asyncio.get_running_loop().run_in_executor(None, self._release_global, token)

    # ------------------------------------------------------------------ synchronous API (worker threads)
    @contextlib.contextmanager
    def slot_sync(self):
        if self._held.get():
            yield
            return
        token, started = uuid.uuid4().hex, time.monotonic()
        deadline = started + max(1.0, float(settings.RESOURCE_WAIT_SECONDS))
        self._begin_wait()
        got = False
        try:
            while True:
                if self._try_local():
                    got = self._try_global(token)
                    if got:
                        break
                    self._release_local()
                if time.monotonic() >= deadline:
                    raise BudgetTimeout(f"No {self.name.replace('_', ' ')} capacity became available; retry shortly.")
                time.sleep(self._pause())
        finally:
            self._end_wait(started, got)
        marker = self._held.set(True)
        try:
            yield
        finally:
            self._held.reset(marker)
            self._release_local()
            self._release_global(token)


browser_capture_budget = ResourceBudget(
    "browser_capture", lambda: settings.BROWSER_CAPTURE_LOCAL_LIMIT, lambda: settings.BROWSER_CAPTURE_GLOBAL_LIMIT)
heavy_execution_budget = ResourceBudget(
    "heavy_execution", lambda: settings.HEAVY_EXECUTION_LOCAL_LIMIT, lambda: settings.HEAVY_EXECUTION_GLOBAL_LIMIT)
