"""Managed browser pooling and bounded admission for capture processes.

Provides managed Playwright browser pooling per event loop / thread:
- Thread-safe, event-loop-safe: async operations run on the current event loop;
  synchronous operations (colab_pipeline) run on thread-local sync instances.
- Re-entrant budget admission: acquire_capture_context and acquire_capture_context_sync
  acquire a slot from browser_capture_budget (supporting local and Redis deployment caps).
- Fresh BrowserContext per job: tenant isolation, custom viewports, blocked service workers,
  private routes.
- Robust recycling and crash recovery: close context and pages on success, failure, or cancellation.
  If a browser crashes or disconnects (not browser.is_connected()), it is discarded and relaunched.
"""

import asyncio
import contextlib
import logging
import os
import threading
from typing import Any, AsyncIterator, Iterator, Optional
from playwright.async_api import Browser as AsyncBrowser, BrowserContext as AsyncContext, Error as AsyncPlaywrightError, async_playwright
from playwright.sync_api import Browser as SyncBrowser, BrowserContext as SyncContext, Error as SyncPlaywrightError, sync_playwright

from .resource_budget import browser_capture_budget

logger = logging.getLogger(__name__)


def launch_capture_browser_sync(playwright):
    """Launch a headless Chromium browser using sync API, falling back to local Chrome/Edge."""
    try:
        return playwright.chromium.launch(headless=True)
    except SyncPlaywrightError as original:
        for path in (r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"):
            if os.path.isfile(path):
                try:
                    return playwright.chromium.launch(executable_path=path, headless=True)
                except SyncPlaywrightError:
                    pass
        raise RuntimeError("No capture browser is installed. Run playwright install chromium.") from original


async def launch_capture_browser(playwright):
    """Launch a headless Chromium browser using async API, falling back to local Chrome/Edge."""
    try:
        return await playwright.chromium.launch(headless=True)
    except AsyncPlaywrightError as original:
        for executable in (r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"):
            if os.path.isfile(executable):
                try:
                    return await playwright.chromium.launch(executable_path=executable, headless=True)
                except AsyncPlaywrightError:
                    continue
        if os.name == "nt":
            try:
                return await playwright.chromium.launch(channel="chrome", headless=True)
            except AsyncPlaywrightError:
                pass
        raise RuntimeError("No capture browser is available. Run python -m playwright install chromium.") from original


class _AsyncBrowserPool:
    """Manages an async Chromium browser instance bound to the running event loop."""

    def __init__(self):
        self._lock = asyncio.Lock()
        self._playwright = None
        self._browser = None

    async def get_browser(self) -> AsyncBrowser:
        async with self._lock:
            if self._browser is not None:
                try:
                    if self._browser.is_connected():
                        return self._browser
                except Exception:
                    pass
                # Stale or disconnected browser
                await self._close_locked()

            pw = await async_playwright().start()
            try:
                browser = await launch_capture_browser(pw)
                self._playwright = pw
                self._browser = browser
                return browser
            except BaseException:
                try:
                    await pw.stop()
                except Exception:
                    pass
                raise

    async def _close_locked(self):
        if self._browser is not None:
            try:
                await self._browser.close()
            except Exception:
                pass
            self._browser = None
        if self._playwright is not None:
            try:
                await self._playwright.stop()
            except Exception:
                pass
            self._playwright = None

    async def close(self):
        async with self._lock:
            await self._close_locked()


class _SyncBrowserPool:
    """Thread-local sync Playwright browser pool for worker threads (e.g. colab_pipeline)."""

    def __init__(self):
        self._local = threading.local()

    def get_browser(self) -> SyncBrowser:
        browser = getattr(self._local, "browser", None)
        if browser is not None:
            try:
                if browser.is_connected():
                    return browser
            except Exception:
                pass
            self.close()

        pw = sync_playwright().start()
        try:
            b = launch_capture_browser_sync(pw)
            self._local.playwright = pw
            self._local.browser = b
            return b
        except BaseException:
            try:
                pw.stop()
            except Exception:
                pass
            raise

    def close(self):
        browser = getattr(self._local, "browser", None)
        if browser is not None:
            try:
                browser.close()
            except Exception:
                pass
            self._local.browser = None
        pw = getattr(self._local, "playwright", None)
        if pw is not None:
            try:
                pw.stop()
            except Exception:
                pass
            self._local.playwright = None


_async_pools: dict[asyncio.AbstractEventLoop, _AsyncBrowserPool] = {}
_pools_lock = threading.Lock()
_sync_pool = _SyncBrowserPool()


def _get_async_pool() -> _AsyncBrowserPool:
    loop = asyncio.get_running_loop()
    with _pools_lock:
        pool = _async_pools.get(loop)
        if pool is None:
            pool = _AsyncBrowserPool()
            _async_pools[loop] = pool
        return pool


@contextlib.asynccontextmanager
async def acquire_capture_context(**context_kwargs) -> AsyncIterator[AsyncContext]:
    """Acquire a fresh, isolated BrowserContext within the bounded browser_capture_budget.

    Closes the context cleanly on exit, failure, or cancellation.
    Recovers automatically if the underlying browser crashes or disconnects.
    """
    async with browser_capture_budget.slot():
        pool = _get_async_pool()
        browser = await pool.get_browser()
        try:
            context = await browser.new_context(**context_kwargs)
        except Exception as err:
            logger.warning("Browser context creation failed (%s); refreshing browser instance.", err)
            await pool.close()
            browser = await pool.get_browser()
            context = await browser.new_context(**context_kwargs)

        try:
            yield context
        finally:
            try:
                await context.close()
            except Exception:
                pass


@contextlib.contextmanager
def acquire_capture_context_sync(**context_kwargs) -> Iterator[SyncContext]:
    """Synchronous version of acquire_capture_context for worker threads."""
    with browser_capture_budget.slot_sync():
        browser = _sync_pool.get_browser()
        try:
            context = browser.new_context(**context_kwargs)
        except Exception as err:
            logger.warning("Sync browser context creation failed (%s); refreshing browser.", err)
            _sync_pool.close()
            browser = _sync_pool.get_browser()
            context = browser.new_context(**context_kwargs)

        try:
            yield context
        finally:
            try:
                context.close()
            except Exception:
                pass


async def close_browser_pools():
    """Gracefully close all event loop browser pools."""
    with _pools_lock:
        pools = list(_async_pools.values())
        _async_pools.clear()
    for pool in pools:
        await pool.close()
    _sync_pool.close()
