import os
import sys
import time
from playwright.sync_api import sync_playwright

output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "test_screenshots"))
os.makedirs(output_dir, exist_ok=True)
manual = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "Python_Functions_Laboratory_Manual.docx"))

with sync_playwright() as p:
    print("Launching Chromium / Chrome...")
    browser = p.chromium.launch(
        executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        headless=True
    )
    context = browser.new_context(viewport={"width": 1440, "height": 950})
    page = context.new_page()

    # Step 1: Go to homepage
    print("Step 1: Navigating to http://localhost:3000 ...")
    page.goto("http://localhost:3000", wait_until="networkidle")
    time.sleep(1)
    page.screenshot(path=os.path.join(output_dir, "e2e_web_1_homepage.png"), full_page=True)

    # Step 2: Open Sign in Modal
    print("Step 2: Clicking Sign in button...")
    sign_in_btn = page.locator('button:has-text("Sign in")').first
    sign_in_btn.click()
    page.wait_for_selector('input[type="email"]', timeout=5000)
    time.sleep(1)
    page.screenshot(path=os.path.join(output_dir, "e2e_web_2_login_modal.png"))

    # Step 3: Fill credentials and log in
    print("Step 3: Submitting login credentials...")
    page.fill('input[type="email"]', "pillaivivek16@gmail.com")
    page.fill('input[type="password"]', "TestPassword123!")
    page.click('button[type="submit"]')
    
    # Wait for navigation / modal close
    time.sleep(3)
    print("Current URL after login:", page.url)
    page.screenshot(path=os.path.join(output_dir, "e2e_web_3_after_login.png"), full_page=True)

    # Step 4: Navigate to /code-execution
    print("Step 4: Navigating to /code-execution ...")
    page.goto("http://localhost:3000/code-execution", wait_until="networkidle")
    page.wait_for_selector('h1', timeout=10000)
    time.sleep(2)
    page.screenshot(path=os.path.join(output_dir, "e2e_web_4_assignment_upload_ready.png"), full_page=True)

    # Step 5: Upload Python_Functions_Laboratory_Manual.docx
    print(f"Step 5: Uploading manual: {manual} ...")
    page.set_input_files('input[type="file"]', manual)
    print("Attached file to input! Waiting for upload processing...")
    time.sleep(5)
    page.screenshot(path=os.path.join(output_dir, "e2e_web_5_file_uploaded.png"), full_page=True)

    # Step 6: Trigger question extraction if button visible
    print("Step 6: Checking for question extraction triggers...")
    extract_btn = page.locator('button:has-text("Extract questions"), button:has-text("Retry extraction")')
    if extract_btn.count() > 0:
        print("Clicking Extract questions...")
        extract_btn.first.click()
        # Poll for extraction completion up to 25 seconds
        for _ in range(5):
            time.sleep(3)
            txt = page.inner_text("body")
            if "questions detected" in txt or "questions extracted" in txt:
                print("Extraction detected in UI!")
                break
    else:
        # Auto extraction in background
        time.sleep(8)

    page.screenshot(path=os.path.join(output_dir, "e2e_web_6_extracted_questions_result.png"), full_page=True)

    # Check extracted questions
    review_btn = page.locator('button:has-text("Review"), button:has-text("questions detected")')
    if review_btn.count() > 0:
        print("Clicking Review questions...")
        review_btn.first.click()
        time.sleep(1)
        page.screenshot(path=os.path.join(output_dir, "e2e_web_7_reviewed_questions_list.png"), full_page=True)

    # Step 7: Check Start Processing button
    start_btn = page.locator('button:has-text("Start processing")')
    if start_btn.count() > 0 and start_btn.is_enabled():
        print("Step 7: Clicking Start processing...")
        start_btn.click()
        time.sleep(5)
        page.screenshot(path=os.path.join(output_dir, "e2e_web_8_processing_in_progress.png"), full_page=True)

    # Step 8: Test Preview & Download Page
    print("Step 8: Navigating to /preview ...")
    page.goto("http://localhost:3000/preview", wait_until="networkidle")
    time.sleep(2)
    page.screenshot(path=os.path.join(output_dir, "e2e_web_9_preview_and_download.png"), full_page=True)

    browser.close()
    print("\n[SUCCESS] All live web browser end-to-end steps completed!")

if __name__ == "__main__":
    run_live_browser_automation = None
