"""Render verified report data in LabMate's existing workspaces."""
from urllib.parse import urlsplit

from .browser_capture import CaptureBrowserUnavailable, acquire_capture_context
from .studio_capture import studio_origin, HIDE_DEV_OVERLAY

ROUTES = {"eclipse": "/eclipse", "intellij": "/intellij", "sqlite": "/db-browser"}


async def open_report_workspace(context, ide):
    base = studio_origin()
    parts = urlsplit(base)
    origin = f"{parts.scheme}://{parts.netloc}"
    url = base + ROUTES[ide] + "?capture=report"

    async def guard(route):
        target = route.request.url
        if (route.request.method == "GET" and
                (target == url or target.startswith((origin + "/_next/static/", origin + "/images/", origin + "/fonts/")))):
            await route.continue_()
        else:
            await route.abort()

    page = await context.new_page()
    await page.route("**/*", guard)
    try:
        response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        if not response or not response.ok:
            raise CaptureBrowserUnavailable("Report workspace is unavailable.")
        await page.wait_for_function("typeof window.__labmateReportFrame === 'function'", timeout=20000)
        await page.add_style_tag(content=HIDE_DEV_OVERLAY)
    except Exception as error:
        raise CaptureBrowserUnavailable(f"The {ide} report workspace could not be opened.") from error
    return page


async def render_report_frame(page, frame, path, *, fit_selectors=()):
    await page.evaluate("""async (frame) => {
        window.__labmateReportFrame(frame);
        await document.fonts.ready;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }""", frame)
    if fit_selectors and await page.evaluate("""selectors => selectors.some(selector => {
        const element = document.querySelector(selector);
        return !element || element.scrollHeight > element.clientHeight + 2 || element.scrollWidth > element.clientWidth + 2;
    })""", list(fit_selectors)):
        raise ValueError("The report frame exceeds the workspace capture area.")
    await page.screenshot(path=str(path), animations="disabled")


async def capture_java_report(ide, code, output, filename, show_output, path):
    viewport = {"width": 1320, "height": 900}
    async with acquire_capture_context(viewport=viewport, service_workers="block") as context:
        page = await open_report_workspace(context, ide)
        await render_report_frame(page, {"filename": filename, "code": code, "output": output,
                                         "showOutput": show_output}, path)
    return viewport["width"], viewport["height"]
