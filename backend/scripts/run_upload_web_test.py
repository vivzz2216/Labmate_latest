import os
import sys
import time
from playwright.sync_api import sync_playwright

output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "test_screenshots"))
manual = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "Python_Functions_Laboratory_Manual.docx"))

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        headless=True
    )
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()
    
    print("Navigating to http://localhost:3000/code-execution ...")
    page.goto("http://localhost:3000/code-execution", wait_until="networkidle")
    page.wait_for_selector("h1", timeout=10000)
    
    inputs = page.query_selector_all("input")
    print(f"Total inputs found on page: {len(inputs)}")
    for i in inputs:
        print(f"  Input type: {i.get_attribute('type')}, hidden: {i.get_attribute('hidden')}")
        
    print(f"Uploading file: {manual} ...")
    page.set_input_files('input[type="file"]', manual)
    print("File attached! Waiting 6 seconds for upload & extraction...")
    time.sleep(6)
    
    upload_shot = os.path.join(output_dir, "web_app_upload_live.png")
    page.screenshot(path=upload_shot, full_page=True)
    print(f"Saved live screenshot: {upload_shot}")
    
    # Check text
    text = page.inner_text("body")
    print("\nPage Text:")
    for line in text.splitlines():
        if any(k in line.lower() for k in ["python", "question", "task", "extract", "upload", "ready", "paused", "error"]):
            print(f"  > {line}")
            
    browser.close()
    print("Finished web test!")
