import asyncio
import threading
import pytest
from app.services.browser_capture import acquire_capture_context, acquire_capture_context_sync, _get_async_pool, _sync_pool
from app.services.resource_budget import browser_capture_budget, heavy_execution_budget, BudgetTimeout


@pytest.mark.asyncio
async def test_acquire_capture_context_concurrency_and_budget_tracking():
    # Verify slot tracking and isolation
    initial_snapshot = browser_capture_budget.snapshot()

    async with acquire_capture_context(viewport={"width": 800, "height": 600}) as ctx1:
        assert ctx1 is not None
        page1 = await ctx1.new_page()
        await page1.set_content("<h1>Page 1</h1>")

        # Verify budget is in use
        snap = browser_capture_budget.snapshot()
        assert snap["in_use"] >= 1

        # Re-entrant acquisition from same context does not deadlock
        async with acquire_capture_context(viewport={"width": 800, "height": 600}) as ctx2:
            assert ctx2 is not None
            page2 = await ctx2.new_page()
            await page2.set_content("<h1>Page 2</h1>")
            # Both pages are independent
            assert await page1.inner_text("h1") == "Page 1"
            assert await page2.inner_text("h1") == "Page 2"
            await page2.close()

        await page1.close()

    # Budget released after context exit
    snap_after = browser_capture_budget.snapshot()
    assert snap_after["in_use"] == initial_snapshot["in_use"]


@pytest.mark.asyncio
async def test_browser_crash_or_disconnect_recovery():
    pool = _get_async_pool()
    browser = await pool.get_browser()
    assert browser.is_connected()

    # Simulate browser disconnect/crash
    await browser.close()
    assert not browser.is_connected()

    # acquire_capture_context should detect the disconnection and relaunch cleanly
    async with acquire_capture_context(viewport={"width": 1000, "height": 700}) as ctx:
        assert ctx is not None
        page = await ctx.new_page()
        await page.set_content("<p>Recovered</p>")
        text = await page.inner_text("p")
        assert text == "Recovered"
        await page.close()


def test_sync_capture_context_isolation_and_recycling():
    # Test worker thread context acquisition
    def run_sync_capture():
        with acquire_capture_context_sync(viewport={"width": 1200, "height": 800}) as ctx:
            assert ctx is not None
            page = ctx.new_page()
            page.set_content("<div>Sync Worker</div>")
            text = page.inner_text("div")
            assert text == "Sync Worker"
            page.close()

    thread = threading.Thread(target=run_sync_capture)
    thread.start()
    thread.join(timeout=30)
    assert not thread.is_alive()


@pytest.mark.asyncio
async def test_heavy_execution_budget_enforcement():
    initial = heavy_execution_budget.snapshot()
    async with heavy_execution_budget.slot():
        snap = heavy_execution_budget.snapshot()
        assert snap["in_use"] >= 1

        # Re-entrant slot does not block
        async with heavy_execution_budget.slot():
            assert heavy_execution_budget.snapshot()["in_use"] >= 1

    assert heavy_execution_budget.snapshot()["in_use"] == initial["in_use"]
