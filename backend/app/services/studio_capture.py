"""Screenshots of LabMate's network studios (the Wireshark-style analyser and the Packet Tracer-style simulator).

A studio page is a normal frontend route (/networks/wireshark, /networks/packet-tracer). It exposes a small hook,
window.__labmate, with load(state) to hand it everything to draw and show(step) to display one step. A headless browser opens
the page, loads the state computed by the Python engines, shows each step in turn and screenshots it. The browser may only talk to
the studio's own origin, and nothing here can fail a report: when the page is unreachable StudioCaptureUnavailable is raised and the
caller keeps the written part without images.
"""
import asyncio
import logging
from pathlib import Path
from urllib.parse import urlsplit

from ..config import settings
from .browser_capture import launch_capture_browser, run_capture_job

logger = logging.getLogger(__name__)

VIEWPORT = {"width": 1600, "height": 900}
SCALE = 1.25
OVERALL_TIMEOUT_SECONDS = 150
HIDE_DEV_OVERLAY = "nextjs-portal, [data-nextjs-toast], [data-next-badge-root], #__next-build-watcher {display: none !important}"
ROUTES = {"wireshark": "/networks/wireshark", "packettracer": "/networks/packet-tracer", "powerbi": "/power-bi", "android": "/android-studio"}


class StudioCaptureUnavailable(RuntimeError):
    """The studio page could not be reached or did not draw the requested step."""


def studio_origin():
    base = (settings.STUDIO_URL or settings.POWERBI_STUDIO_URL or settings.FRONTEND_URL or "http://localhost:3000").strip().rstrip("/")
    parts = urlsplit(base)
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        raise StudioCaptureUnavailable("The studio address is not a valid http(s) URL.")
    return base


def studio_url(tool):
    if tool not in ROUTES:
        raise StudioCaptureUnavailable("Unknown studio.")
    return studio_origin() + ROUTES[tool] + "?capture=1"


async def _capture(tool, state, steps, out_dir, practical=None):
    from playwright.async_api import Error as PlaywrightError, async_playwright
    url = studio_url(tool) if practical is None else studio_origin() + ROUTES[tool] + "?capture=practical"
    origin = "{0.scheme}://{0.netloc}".format(urlsplit(url))
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    shots = []
    async with async_playwright() as playwright:
        browser = await launch_capture_browser(playwright)
        try:
            context = await browser.new_context(viewport=VIEWPORT, device_scale_factor=SCALE, accept_downloads=False,
                                                service_workers="block", java_script_enabled=True)

            async def only_studio_origin(route):
                target = route.request.url
                if target.startswith(("data:", "blob:", origin + "/")):
                    await route.continue_()
                else:
                    await route.abort()
            await context.route("**/*", only_studio_origin)
            page = await context.new_page()
            response = None
            for attempt in range(2):
                try:
                    response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                except PlaywrightError as error:
                    if attempt == 0:
                        await asyncio.sleep(0.6)
                        continue
                    raise StudioCaptureUnavailable("The studio page could not be reached.") from error
                if response is not None and response.status < 400:
                    break
                logger.warning("Studio page %s returned HTTP %s (attempt %d)", url, getattr(response, "status", None), attempt + 1)
                if attempt == 0:
                    await asyncio.sleep(0.8)
            if response is None or response.status >= 400:
                raise StudioCaptureUnavailable(f"The studio page returned HTTP {getattr(response, 'status', 'none')}.")
            try:
                # The hook appears once React has attached; evaluate again until it does.
                await page.wait_for_function("() => window.__labmate && window.__labmate.ready === true", timeout=45000)
                if practical is not None:
                    await page.wait_for_function("() => typeof window.__labmatePractical === 'function'", timeout=20000)
                    steps = await page.evaluate("topic => window.__labmatePractical(topic)", practical)
                else:
                    await page.evaluate("state => window.__labmate.load(state)", state)
            except PlaywrightError as error:
                raise StudioCaptureUnavailable("The studio did not become ready.") from error
            await page.add_style_tag(content=HIDE_DEV_OVERLAY)
            for number, step in enumerate(steps, 1):
                try:
                    await page.evaluate("step => window.__labmate.show(step)", step)
                    await page.wait_for_function("() => window.__labmate.settled === true", timeout=10000)
                except PlaywrightError as error:
                    raise StudioCaptureUnavailable("The studio could not draw step %s." % step.get("id", number)) from error
                await page.wait_for_timeout(250)
                path = out_dir / ("%02d_%s.png" % (number, "".join(c if c.isalnum() else "_" for c in str(step.get("id", number)))[:40]))
                await page.screenshot(path=str(path), full_page=practical is not None)
                shot = {"id": step.get("id"), "path": str(path)}
                if practical is not None:
                    shot.update(title=step["title"], explain=step["explain"])
                shots.append(shot)
            return shots
        finally:
            await browser.close()


async def capture_studio(tool, state, steps, out_dir, *, practical=None):
    """Screenshots, one per step, as [{"id", "path"}]. Raises StudioCaptureUnavailable when the studio cannot produce them."""
    try:
        def job():
            return _capture(tool, state, steps, out_dir) if practical is None else _capture(tool, state, steps, out_dir, practical)
        return await run_capture_job(job, OVERALL_TIMEOUT_SECONDS)
    except asyncio.TimeoutError as error:
        raise StudioCaptureUnavailable("The studio took too long to render.") from error
    except StudioCaptureUnavailable:
        raise
    except Exception as error:   # browser missing, crashed, ...: never take the report down with it
        logger.warning("Studio capture failed: %s", type(error).__name__)
        raise StudioCaptureUnavailable("The capture browser is not available.") from error
