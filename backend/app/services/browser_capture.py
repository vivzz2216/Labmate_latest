"""Launch a fresh capture browser, with portable Windows installations as fallback."""

import os
from playwright.async_api import Error


async def launch_capture_browser(playwright):
    try:
        return await playwright.chromium.launch(headless=True)
    except Error as original:
        for executable in (r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"):
            if os.path.isfile(executable):
                try:
                    return await playwright.chromium.launch(executable_path=executable, headless=True)
                except Error:
                    continue
        if os.name == "nt":
            try:
                return await playwright.chromium.launch(channel="chrome", headless=True)
            except Error:
                pass
        raise RuntimeError("No capture browser is available. Run python -m playwright install chromium.") from original
