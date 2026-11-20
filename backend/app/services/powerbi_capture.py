"""Automatic Power BI dashboard capture: load the student's CSV into LabMate's Power BI Desktop studio and screenshot it.

The studio is the frontend page /power-bi. It parses the CSV in the browser and builds a dashboard from the columns
(KPI cards, a slicer, column, line, donut and bar charts and a summary table). A headless browser opens the page, hands
it the student's file through the page's own file picker, waits for the dashboard, and takes screenshots of the Report
view and the Table view. The CSV never leaves this process: the page is the only origin the browser may talk to.

Nothing here can fail a report. When the studio cannot be reached, PowerBiCaptureUnavailable is raised and the caller
falls back to the student's own screenshot slot.
"""
import asyncio
import logging
import re
from pathlib import Path
from urllib.parse import urlsplit

from ..config import settings
from .browser_capture import launch_capture_browser, run_capture_job

logger = logging.getLogger(__name__)

VIEWPORT = {"width": 1920, "height": 1080}      # a large window, so the report canvas is shown at a readable size
OVERALL_TIMEOUT_SECONDS = 90
SCALE = 1.25
# A development server draws its own badge over the page; a production build does not. Never let it into evidence.
HIDE_DEV_OVERLAY = "nextjs-portal, [data-nextjs-toast], [data-next-badge-root], #__next-build-watcher {display: none !important}"


class PowerBiCaptureUnavailable(RuntimeError):
    """The studio page could not be reached or did not render the dataset."""


def studio_url():
    base = (settings.POWERBI_STUDIO_URL or settings.FRONTEND_URL or "http://localhost:3000").strip().rstrip("/")
    parts = urlsplit(base)
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        raise PowerBiCaptureUnavailable("POWERBI_STUDIO_URL is not a valid http(s) address.")
    return base + "/power-bi"


VISUAL_NAMES = {"card": "Card", "slicer": "Slicer", "clusteredColumn": "Clustered column chart", "stackedColumn": "Stacked column chart",
                "clusteredBar": "Clustered bar chart", "stackedBar": "Stacked bar chart", "line": "Line chart", "area": "Area chart",
                "pie": "Pie chart", "donut": "Donut chart", "funnel": "Funnel chart", "scatter": "Scatter chart", "treemap": "Treemap",
                "gauge": "Gauge", "table": "Table", "matrix": "Matrix"}


def visual_inventory(visuals):
    """'4 x Card; Slicer "Platform"; Line chart "Sum of Likes by Date"; ...' from the page's visuals, in report order."""
    cards = sum(1 for visual in visuals if visual.get("type") == "card")
    parts = ["%d x Card" % cards] if cards else []
    for visual in visuals:
        if visual.get("type") == "card":
            continue
        name = VISUAL_NAMES.get(visual.get("type"), str(visual.get("type")))
        title = str(visual.get("title") or "")[:80]
        parts.append('%s "%s"' % (name, title) if title else name)
    return "; ".join(parts)[:900]


def _clean(text, limit=1800):
    return re.sub(r"[ \t]+", " ", re.sub(r"\n{2,}", "\n", str(text or ""))).strip()[:limit]


def _upload_payload(csv_path, display_name):
    """The file as the page should see it: the student's own file name, not the random name it is stored under (the
    studio titles the report and names its pages after the file)."""
    name = re.sub(r"[^A-Za-z0-9._ -]+", "_", str(display_name or Path(csv_path).name))[:120] or "dataset.csv"
    if not name.lower().endswith((".csv", ".txt")):
        name += ".csv"
    return {"name": name, "mimeType": "text/csv", "buffer": Path(csv_path).read_bytes()}


async def _capture(csv_path, out_dir, label, display_name=None):
    from playwright.async_api import Error as PlaywrightError, async_playwright
    payload = _upload_payload(csv_path, display_name)
    url = studio_url()
    origin = "{0.scheme}://{0.netloc}".format(urlsplit(url))
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        browser = await launch_capture_browser(playwright)
        try:
            context = await browser.new_context(viewport=VIEWPORT, device_scale_factor=SCALE, accept_downloads=False,
                                                service_workers="block", java_script_enabled=True)

            async def only_studio_origin(route):
                target = route.request.url
                if target.startswith(("data:", "blob:")) or target.startswith(origin):
                    await route.continue_()
                else:
                    await route.abort()
            await context.route("**/*", only_studio_origin)
            page = await context.new_page()
            try:
                response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            except PlaywrightError as error:
                raise PowerBiCaptureUnavailable("The Power BI studio page could not be reached.") from error
            if response is None or response.status >= 400:
                raise PowerBiCaptureUnavailable("The Power BI studio page returned an error.")
            loaded = ("() => document.body.innerText.includes(' - Power BI Desktop')"
                      " && !document.body.innerText.includes('Untitled - Power BI Desktop')"
                      " && !document.body.innerText.includes('Loading ')")
            try:
                await page.wait_for_selector("input[type=file]", state="attached", timeout=20000)
                try:
                    await page.wait_for_load_state("networkidle", timeout=15000)
                except PlaywrightError:
                    pass                    # a dev server keeps a socket open; the retry below covers it
                # The input is in the server-rendered HTML before React attaches its change handler, so a file handed
                # over too early is silently lost. Hand it over again until the title bar changes from
                # "Untitled - Power BI Desktop" to the dataset's name.
                for attempt in range(4):
                    # Clear first: choosing the same file again does not fire a new change event.
                    await page.set_input_files("input[type=file]", [])
                    await page.set_input_files("input[type=file]", payload)
                    try:
                        await page.wait_for_function(loaded, timeout=9000)
                        break
                    except PlaywrightError:
                        if attempt == 3:
                            raise
            except PlaywrightError as error:
                raise PowerBiCaptureUnavailable("The studio did not load the dataset.") from error
            await page.add_style_tag(content=HIDE_DEV_OVERLAY)
            await page.wait_for_timeout(1200)    # charts animate in
            body = await page.inner_text("body")
            if "Add data to your report" in body:
                raise PowerBiCaptureUnavailable("The studio shows no data for this file.")
            summary = _clean(await page.inner_text("main")) if await page.locator("main").count() else _clean(body)
            # The exact inventory of the report page, so the written procedure names the visuals that really exist.
            visuals = await page.evaluate(
                "() => [...document.querySelectorAll('[data-visual-type]')].map(e => ({type: e.getAttribute('data-visual-type'),"
                " title: e.getAttribute('aria-label') || ''}))")
            pages = await page.evaluate(
                "() => [...document.querySelectorAll('[role=tab]')].map(e => e.textContent.trim()).filter(Boolean)")
            report = out_dir / "powerbi_report_view.png"
            await page.screenshot(path=str(report), full_page=False)
            shots = [{"slot": "powerbi_dashboard", "path": str(report), "caption": "Report view: " + label}]
            table_button = page.get_by_role("button", name="Table view")
            if await table_button.count():
                await table_button.first.click()
                await page.wait_for_timeout(900)
                table = out_dir / "powerbi_table_view.png"
                await page.screenshot(path=str(table), full_page=False)
                shots.append({"slot": None, "path": str(table), "caption": "Table view: the loaded dataset"})
            return {"shots": shots, "summary": summary, "visuals": visual_inventory(visuals), "pages": pages[:6]}
        finally:
            await browser.close()


async def capture_powerbi(csv_path, out_dir, label="dashboard built from your dataset", display_name=None):
    """Screenshots of the dashboard the studio builds from csv_path (shown to the page as display_name).

    Returns {"shots": [{"slot", "path", "caption"}, ...], "summary", "visuals", "pages"}.
    Raises PowerBiCaptureUnavailable when the studio cannot produce it.
    """
    try:
        return await run_capture_job(lambda: _capture(csv_path, out_dir, label, display_name), OVERALL_TIMEOUT_SECONDS)
    except asyncio.TimeoutError as error:
        raise PowerBiCaptureUnavailable("The Power BI studio took too long to render.") from error
    except PowerBiCaptureUnavailable:
        raise
    except Exception as error:   # browser missing, crashed, ...: never take the report down with it
        logger.warning("Power BI capture failed: %s", type(error).__name__)
        raise PowerBiCaptureUnavailable("The capture browser is not available.") from error
