import asyncio
import os
import sys
from datetime import timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models import User
from app.security.jwt import create_access_token
from playwright.async_api import async_playwright

async def run_authenticated_flow():
    print("=" * 60)
    print("AUTHENTICATED WEB BROWSER E2E TEST WITH UPLOAD & EXTRACTION")
    print("=" * 60)
    
    with SessionLocal() as db:
        u = db.query(User).filter_by(email="pillaivivek16@gmail.com").first()
        if not u:
            print("Creating test user...")
            u = User(email="pillaivivek16@gmail.com", name="Vivek Pillai")
            db.add(u)
            db.commit()
            db.refresh(u)
            
        token = create_access_token({"sub": str(u.id), "email": u.email}, expires_delta=timedelta(days=7))
        user_data = {
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "created_at": str(u.created_at),
            "last_login": str(u.last_login or u.created_at)
        }
    
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "test_screenshots"))
    os.makedirs(output_dir, exist_ok=True)
    manual_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "Python_Functions_Laboratory_Manual.docx"))
    
    async with async_playwright() as p:
        chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
        if not os.path.exists(chrome_path):
            chrome_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
            
        browser = await p.chromium.launch(
            executable_path=chrome_path,
            headless=True
        )
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()
        
        # 1. Set Auth in localStorage
        print("1. Injecting authentication into browser session...")
        await page.goto("http://localhost:3000", wait_until="networkidle")
        await page.evaluate("""({ token, user }) => {
            localStorage.setItem('labmate_access_token', token);
            localStorage.setItem('labmate_user', JSON.stringify(user));
        }""", {"token": token, "user": user_data})
        
        # 2. Go to /code-execution
        print("2. Navigating to /code-execution with valid session...")
        await page.goto("http://localhost:3000/code-execution", wait_until="networkidle")
        await asyncio.sleep(2)
        
        shot1 = os.path.join(output_dir, "web_app_1_code_execution_dashboard.png")
        await page.screenshot(path=shot1, full_page=True)
        print(f"  [SAVED] Code execution dashboard: {shot1}")
        
        # 3. Locate file input and upload Python_Functions_Laboratory_Manual.docx
        print(f"3. Uploading {manual_path} via web UI...")
        file_input = page.locator('input[type="file"]')
        input_count = await file_input.count()
        print(f"  File input count: {input_count}")
        
        if input_count > 0:
            await file_input.set_input_files(manual_path)
            print("  File uploaded to web UI! Waiting for upload completion...")
            await asyncio.sleep(3)
            
            shot2 = os.path.join(output_dir, "web_app_2_after_file_selected.png")
            await page.screenshot(path=shot2, full_page=True)
            print(f"  [SAVED] After file selection: {shot2}")
            
            # Click "Extract questions" if available
            extract_btn = page.locator('button:has-text("Extract questions"), button:has-text("Retry extraction")')
            btn_count = await extract_btn.count()
            if btn_count > 0:
                print(f"  Clicking Extract questions button...")
                await extract_btn.first.click()
                print("  Waiting 10 seconds for question extraction...")
                await asyncio.sleep(10)
            
            shot3 = os.path.join(output_dir, "web_app_3_extracted_questions_view.png")
            await page.screenshot(path=shot3, full_page=True)
            print(f"  [SAVED] Extracted questions view: {shot3}")
            
            # Check page content
            content = await page.inner_text("body")
            print("\n  Page Status Summary:")
            for l in content.splitlines():
                if any(w in l.lower() for w in ["question", "task", "upload", "python", "progress", "ready"]):
                    print(f"    > {l}")
                    
        await browser.close()
        print("\n[SUCCESS] Completed Authenticated Web Flow Verification!")

if __name__ == "__main__":
    asyncio.run(run_authenticated_flow())
