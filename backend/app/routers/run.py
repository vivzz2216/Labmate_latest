from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Upload, Job, Screenshot, User
from ..schemas import RunRequest, RunResponse, JobStatus
from ..services.parser_service import parser_service
from ..services.executor_service import executor_service
from ..services.screenshot_service import screenshot_service
from ..middleware.auth import get_current_user, verify_upload_ownership
from ..middleware.csrf import require_csrf_token
from ..config import settings
import os

router = APIRouter()


@router.post("/run", response_model=RunResponse)
async def run_tasks(
    http_request: Request,
    request: RunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    csrf_valid: bool = Depends(require_csrf_token)
):
    """
    Execute selected code blocks and generate screenshots
    Requires JWT authentication, CSRF protection, and verifies upload ownership
    """
    # Verify user owns the upload
    upload = await verify_upload_ownership(request.upload_id, current_user, db)
    
    try:
        # Parse file to get tasks
        tasks_data = await parser_service.parse_file(upload.file_path, upload.file_type)
        task_dict = {task["id"]: task for task in tasks_data}
        
        jobs = []
        screenshot_task_id_set = set(request.screenshot_task_ids or [])
        
        # Process each requested task
        for task_id in request.task_ids:
            if task_id not in task_dict:
                continue
            
            task_data = task_dict[task_id]
            code_snippet = parser_service.sanitize_code_snippet(
                task_data["code_snippet"],
                task_data.get("question_text")
            )
            
            if not code_snippet.strip():
                job = Job(
                    upload_id=request.upload_id,
                    task_id=task_id,
                    question_text=task_data["question_text"],
                    code_snippet=task_data["code_snippet"],
                    theme=request.theme,
                    status="failed",
                    error_message="No executable code detected for this task."
                )
                db.add(job)
                db.commit()
                jobs.append(job)
                continue
            
            # Create job record
            job = Job(
                upload_id=request.upload_id,
                task_id=task_id,
                question_text=task_data["question_text"],
                code_snippet=code_snippet,
                theme=request.theme,
                status="running"
            )
            db.add(job)
            db.commit()
            db.refresh(job)
            
            try:
                # Determine language based on theme
                if request.theme == "codeblocks":
                    language = "c"
                elif request.theme == "notepad":
                    language = "java"
                elif request.theme == "html":
                    language = "html"
                elif request.theme == "react":
                    language = "react"
                elif request.theme == "node":
                    language = "node"
                else:
                    language = "python"
                
                # Get filename before execution
                user = db.query(User).filter(User.id == upload.user_id).first() if upload.user_id else None
                if user and user.name:
                    username = user.name.split()[0]
                else:
                    username = "User"
                
                filename = getattr(upload, 'custom_filename', None) if upload else None
                if not filename:
                    extension_map = {
                        "codeblocks": ".c",
                        "notepad": ".java",
                        "html": ".html",
                        "react": ".jsx",
                        "node": ".js",
                    }
                    default_ext = extension_map.get(request.theme, ".py")
                    filename = f"task{task_data['id']}{default_ext}"
                
                # React requires project execution + multiple screenshots (routes).
                if request.theme == "react":
                    # IMPORTANT: Do not execute AI "setup guides" or partially-correct router snippets.
                    # Always materialize a correct React Router v6 template so /, /about, /contact mount reliably.
                    project_files = {
                        "src/App.jsx": (
                            "import React from 'react';\n"
                            "import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';\n"
                            "import Home from './components/Home.jsx';\n"
                            "import About from './components/About.jsx';\n"
                            "import Contact from './components/Contact.jsx';\n\n"
                            "export default function App() {\n"
                            "  return (\n"
                            "    <BrowserRouter>\n"
                            "      <div style={{ padding: '1.5rem', fontFamily: 'Inter, system-ui, sans-serif' }}>\n"
                            "        <h1 style={{ marginTop: 0 }}>React Hello World</h1>\n"
                            "        <nav style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>\n"
                            "          <Link to='/'>Home</Link>\n"
                            "          <Link to='/about'>About</Link>\n"
                            "          <Link to='/contact'>Contact</Link>\n"
                            "        </nav>\n"
                            "        <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: 8 }}>\n"
                            "          <Routes>\n"
                            "            <Route path='/' element={<Home />} />\n"
                            "            <Route path='/about' element={<About />} />\n"
                            "            <Route path='/contact' element={<Contact />} />\n"
                            "          </Routes>\n"
                            "        </div>\n"
                            "      </div>\n"
                            "    </BrowserRouter>\n"
                            "  );\n"
                            "}\n"
                        ),
                        "src/components/Home.jsx": (
                            "import React from 'react';\n"
                            "export default function Home(){\n"
                            "  return <div><h2>Hello, World!</h2><p>This is the Home page.</p></div>;\n"
                            "}\n"
                        ),
                        "src/components/About.jsx": (
                            "import React from 'react';\n"
                            "export default function About(){\n"
                            "  return <div><h2>About</h2><p>React Router v6 route is working.</p></div>;\n"
                            "}\n"
                        ),
                        "src/components/Contact.jsx": (
                            "import React from 'react';\n"
                            "export default function Contact(){\n"
                            "  return <div><h2>Contact</h2><p>Multiple screenshots will be captured.</p></div>;\n"
                            "}\n"
                        ),
                        "src/main.jsx": (
                            "import React from 'react';\n"
                            "import ReactDOM from 'react-dom/client';\n"
                            "import App from './App.jsx';\n"
                            "import './index.css';\n\n"
                            "ReactDOM.createRoot(document.getElementById('root')).render(\n"
                            "  <React.StrictMode>\n"
                            "    <App />\n"
                            "  </React.StrictMode>\n"
                            ");\n"
                        ),
                        "src/index.css": (
                            "body { margin: 0; font-family: Inter, system-ui, -apple-system, sans-serif; }\n"
                            "a { color: #2563eb; text-decoration: none; }\n"
                            "a:hover { text-decoration: underline; }\n"
                        ),
                    }

                    success, out, logs, exit_code, screenshots_by_route = await executor_service.execute_react_project(
                        project_files=project_files,
                        routes=settings.REACT_DEFAULT_ROUTES,
                        job_id=str(job.id),
                        task_id=str(task_id),
                        username=username
                    )

                    output = logs or out
                    error = "" if success else (logs or out)
                    execution_time = 0
                    file_outputs = []

                    # Persist multiple screenshots (one per route)
                    if success and screenshots_by_route:
                        generated = await screenshot_service.generate_project_screenshots(
                            project_files, screenshots_by_route, job.id, task_id, username
                        )
                        for item in generated:
                            path = item.get("path")
                            if path and os.path.exists(path):
                                screenshot_record = Screenshot(
                                    job_id=job.id,
                                    file_path=path,
                                    file_size=os.path.getsize(path),
                                    width=item.get("width", 0),
                                    height=item.get("height", 0)
                                )
                                db.add(screenshot_record)
                        db.commit()
                else:
                    # Execute code with filename
                    success, output, error, execution_time, file_outputs = await executor_service.execute_code(
                        code_snippet,
                        language,
                        filename,
                        question_text=task_data["question_text"]
                    )
                
                # Normalize (crop) output before storing
                normalized_output = executor_service.normalize_output(output)
                normalized_error = executor_service.normalize_output(error) if error else error
                
                job.execution_time = execution_time
                if success:
                    job.status = "completed"
                    job.output_text = normalized_output
                else:
                    job.status = "failed"
                    job.error_message = normalized_error or "Execution failed"
                
                # Generate screenshot for both success and failure (legacy behaviour)
                if screenshot_task_id_set:
                    should_capture = task_id in screenshot_task_id_set
                else:
                    should_capture = task_data.get("requires_screenshot", True)
                if should_capture and request.theme != "react":
                    display_output = normalized_output if success else (normalized_error or "Execution failed")

                    try:
                        # For Node/Express: also generate a REAL browser-style screenshot of the response body.
                        # We do this first so it's the primary screenshot_url returned to the frontend.
                        if request.theme == "node" and success:
                            try:
                                # Pick a representative route for the URL bar (avoid showing "/" when not defined).
                                node_route = "/"
                                node_port = 3000
                                try:
                                    import re as _re
                                    routes = _re.findall(r"\\bapp\\.(?:get|post|put|delete|patch)\\s*\\(\\s*['\\\"]([^'\\\"]+)['\\\"]", code_snippet or "", flags=_re.IGNORECASE)
                                    routes = [r if r.startswith("/") else f"/{r}" for r in routes]
                                    if routes:
                                        # Cookie labs: show /get_cookie if present
                                        lower = {r.lower(): r for r in routes}
                                        if "/students" in lower:
                                            node_route = lower["/students"]
                                        elif "/get_cookie" in lower:
                                            node_route = lower["/get_cookie"]
                                        elif "/" in routes:
                                            node_route = "/"
                                        else:
                                            node_route = routes[0]
                                except Exception:
                                    node_route = "/"

                                # Detect listen port from code for accuracy in the address bar
                                try:
                                    m = _re.search(r"\\blisten\\s*\\(\\s*(\\d{2,5})\\b", code_snippet or "")
                                    if m:
                                        p = int(m.group(1))
                                        if 1 <= p <= 65535:
                                            node_port = p
                                except Exception:
                                    node_port = 3000

                                # Use the non-normalized `output` for browser rendering (avoid truncation).
                                # URL is informational in the screenshot; actual server is internal to Docker.
                                browser_ok, browser_path, b_w, b_h = await screenshot_service.generate_browser_screenshot(
                                    response_body=output,
                                    job_id=job.id,
                                    url=f"http://localhost:{node_port}{node_route}",
                                )
                                if browser_ok:
                                    db.add(Screenshot(
                                        job_id=job.id,
                                        file_path=browser_path,
                                        file_size=os.path.getsize(browser_path),
                                        width=b_w,
                                        height=b_h,
                                    ))
                            except Exception as _browser_err:
                                # Don't fail the whole job if browser screenshot fails; fall back to code screenshot.
                                pass

                        # Always generate the code+output screenshot (IDE-style)
                        screenshot_success, screenshot_path, width, height = await screenshot_service.generate_screenshot(
                            code_snippet, display_output, request.theme, job.id, username, filename
                        )

                        if screenshot_success:
                            screenshot = Screenshot(
                                job_id=job.id,
                                file_path=screenshot_path,
                                file_size=os.path.getsize(screenshot_path),
                                width=width,
                                height=height
                            )
                            db.add(screenshot)
                        elif job.status == "failed" and job.error_message:
                            job.error_message = f"{job.error_message}\nScreenshot error: {screenshot_path}"
                    except Exception as screenshot_error:
                        if job.status == "completed":
                            job.status = "failed"
                            job.error_message = f"Screenshot generation failed: {str(screenshot_error)}"
                        else:
                            job.error_message = f"{job.error_message or ''}\nScreenshot generation failed: {str(screenshot_error)}"
                
                file_preview_records = []
                if file_outputs:
                    try:
                        file_screenshots = await screenshot_service.generate_file_screenshots(
                            file_outputs,
                            job.id,
                            username
                        )
                        screenshot_lookup = {
                            item["filename"]: item["path"]
                            for item in file_screenshots
                        }
                        for fs in file_screenshots:
                            screenshot_record = Screenshot(
                                job_id=job.id,
                                file_path=fs["path"],
                                file_size=os.path.getsize(fs["path"]),
                                width=fs["width"],
                                height=fs["height"]
                            )
                            db.add(screenshot_record)
                    except Exception as file_preview_error:
                        screenshot_lookup = {}
                        print(f"[Run] File screenshot generation failed: {file_preview_error}")
                    for file_item in file_outputs:
                        screenshot_path = screenshot_lookup.get(file_item["filename"])
                        screenshot_url = None
                        if screenshot_path:
                            screenshot_url = f"/screenshots/{job.id}/{os.path.basename(screenshot_path)}"
                        file_preview_records.append({
                            "filename": file_item["filename"],
                            "content": file_item["content"],
                            "type": file_item.get("type", "generated"),
                            "screenshot_url": screenshot_url
                        })
                job.file_outputs = file_preview_records
                
                db.commit()
                
            except Exception as e:
                job.status = "failed"
                job.error_message = f"Execution error: {str(e)}"
                job.execution_time = 0
                db.commit()
            
            jobs.append(job)
        
        # Build response
        job_statuses = []
        for job in jobs:
            # Get screenshot URL if exists
            screenshot_url = None
            screenshots = db.query(Screenshot).filter(Screenshot.job_id == job.id).order_by(Screenshot.created_at).all()
            screenshot_urls = []
            for screenshot in screenshots:
                if screenshot and screenshot.file_path:
                    screenshot_urls.append(f"/screenshots/{job.id}/{os.path.basename(screenshot.file_path)}")
            if screenshot_urls:
                screenshot_url = screenshot_urls[0]
            
            job_status = JobStatus(
                id=job.id,
                task_id=job.task_id,
                question_text=job.question_text,
                status=job.status,
                output_text=job.output_text,
                error_message=job.error_message,
                execution_time=job.execution_time,
                screenshot_url=screenshot_url,
                screenshot_urls=screenshot_urls or None,
                files=getattr(job, "file_outputs", None),
                code_snippet=job.code_snippet
            )
            job_statuses.append(job_status)
        
        return RunResponse(jobs=job_statuses)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")
