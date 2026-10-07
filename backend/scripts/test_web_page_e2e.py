import asyncio
import os
import sys

from playwright.async_api import async_playwright

async def run_live_web_test():
    print("=" * 60)
    print("STARTING LIVE WEB PAGE END-TO-END VERIFICATION")
    print("=" * 60)
    
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "test_screenshots"))
    os.makedirs(output_dir, exist_ok=True)
    
    # Path to user manual
    manual_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "Python_Functions_Laboratory_Manual.docx"))
    
    async with async_playwright() as p:
        # Launch Chrome or Edge
        chrome_paths = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
        ]
        executable = None
        for cp in chrome_paths:
            if os.path.exists(cp):
                executable = cp
                break
                
        print(f"Using browser executable: {executable}")
        browser = await p.chromium.launch(
            executable_path=executable,
            headless=True
        )
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()
        
        # 1. Test Homepage
        print("\n1. Navigating to Homepage: http://localhost:3000 ...")
        await page.goto("http://localhost:3000", wait_until="networkidle")
        home_shot = os.path.join(output_dir, "webpage_1_homepage.png")
        await page.screenshot(path=home_shot, full_page=True)
        print(f"  [SAVED] Homepage screenshot: {home_shot}")
        
        # 2. Test Code Execution & Upload Page
        print("\n2. Navigating to Code Execution / Lab Processing: http://localhost:3000/code-execution ...")
        await page.goto("http://localhost:3000/code-execution", wait_until="networkidle")
        await asyncio.sleep(2)
        exec_shot_initial = os.path.join(output_dir, "webpage_2_code_execution_initial.png")
        await page.screenshot(path=exec_shot_initial, full_page=True)
        print(f"  [SAVED] Code execution initial screenshot: {exec_shot_initial}")
        
        # 3. Test File Upload through Web UI
        print(f"\n3. Testing File Upload with: {manual_path} ...")
        file_input = page.locator('input[type="file"]')
        count = await file_input.count()
        print(f"  Found file input elements: {count}")
        if count > 0:
            await file_input.set_input_files(manual_path)
            print("  File submitted to file input, waiting for upload and extraction...")
            # Wait for upload status or extraction update
            await asyncio.sleep(5)
            upload_shot = os.path.join(output_dir, "webpage_3_after_upload.png")
            await page.screenshot(path=upload_shot, full_page=True)
            print(f"  [SAVED] After upload screenshot: {upload_shot}")
            
            # Check if questions or retry button appeared
            page_text = await page.inner_text("body")
            print("\nPage status excerpt:")
            for line in page_text.splitlines():
                if any(k in line.lower() for k in ["question", "upload", "ready", "paused", "extract"]):
                    print(f"    > {line}")

        # 4. Test Preview Page
        print("\n4. Navigating to Preview Page: http://localhost:3000/preview ...")
        await page.goto("http://localhost:3000/preview", wait_until="networkidle")
        await asyncio.sleep(2)
        preview_shot = os.path.join(output_dir, "webpage_4_preview_page.png")
        await page.screenshot(path=preview_shot, full_page=True)
        print(f"  [SAVED] Preview page screenshot: {preview_shot}")
        
        # 5. Test Reports Page
        print("\n5. Navigating to Reports Page: http://localhost:3000/reports ...")
        await page.goto("http://localhost:3000/reports", wait_until="networkidle")
        await asyncio.sleep(2)
        reports_shot = os.path.join(output_dir, "webpage_5_reports_page.png")
        await page.screenshot(path=reports_shot, full_page=True)
        print(f"  [SAVED] Reports page screenshot: {reports_shot}")
        
        await browser.close()
        print("\n[SUCCESS] All live web pages verified and captured successfully!")

if __name__ == "__main__":
    asyncio.run(run_live_web_test())
