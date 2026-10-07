import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from playwright.async_api import async_playwright

async def test_browser():
    async with async_playwright() as p:
        chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
        if not os.path.exists(chrome_path):
            chrome_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
            
        print(f"Launching browser using executable: {chrome_path}")
        browser = await p.chromium.launch(executable_path=chrome_path, headless=True)
        page = await browser.new_page()
        await page.set_content("<html><body><h1>LabMate Screenshot Engine Test</h1></body></html>")
        os.makedirs("test_screenshots", exist_ok=True)
        out = "test_screenshots/sample_test.png"
        await page.screenshot(path=out)
        await browser.close()
        print(f"Screenshot successfully captured at: {out} (size: {os.path.getsize(out)} bytes)")

if __name__ == "__main__":
    asyncio.run(test_browser())
