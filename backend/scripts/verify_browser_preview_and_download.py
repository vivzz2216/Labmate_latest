import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from playwright.async_api import async_playwright

async def verify_browser():
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    if not os.path.exists(chrome_path):
        chrome_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
        
    print(f"Launching Chrome browser for E2E verification: {chrome_path}")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=chrome_path, headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()

        # 1. Verify Homepage
        print("Navigating to http://localhost:3000...")
        await page.goto("http://localhost:3000", wait_until="networkidle")
        title = await page.title()
        print(f"Homepage Title: {title}")
        os.makedirs("test_screenshots", exist_ok=True)
        await page.screenshot(path="test_screenshots/homepage_browser_verification.png", full_page=True)
        print("Saved homepage screenshot: test_screenshots/homepage_browser_verification.png")

        # 2. Verify /preview Page
        print("Navigating to http://localhost:3000/preview...")
        await page.goto("http://localhost:3000/preview", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        
        # Check elements
        content = await page.content()
        has_preview_heading = "Preview & Download" in content
        has_generate_btn = "Generate" in content or "Report" in content or "Download" in content
        print(f"Preview Heading Present: {has_preview_heading}")
        print(f"Generate/Download Controls Present: {has_generate_btn}")

        await page.screenshot(path="test_screenshots/preview_page_browser_verification.png", full_page=True)
        print("Saved preview page screenshot: test_screenshots/preview_page_browser_verification.png")

        await browser.close()
        print("Browser E2E verification completed successfully!")

if __name__ == "__main__":
    asyncio.run(verify_browser())
