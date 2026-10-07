import asyncio
import os
from playwright.async_api import async_playwright

async def main():
    video_dir = os.path.abspath("test_video_out")
    os.makedirs(video_dir, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, channel="msedge")
        context = await browser.new_context(
            record_video_dir=video_dir,
            record_video_size={"width": 1280, "height": 720},
            viewport={"width": 1280, "height": 720}
        )
        page = await context.new_page()
        await page.set_content("""
        <html>
        <body style="margin:0; background:#000; color:#fff; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
            <h1 style="font-size:48px; color:#6366f1;">⚡ LABMATE VIDEO ENGINE</h1>
        </body>
        </html>
        """)
        await asyncio.sleep(2)
        await context.close()
        await browser.close()
    
    files = os.listdir(video_dir)
    print("Recorded files:", files)

if __name__ == "__main__":
    asyncio.run(main())
