import os
import uuid
import textwrap
import re
from typing import Tuple
from html import escape as html_escape
from playwright.async_api import async_playwright
from pygments import highlight
from pygments.lexers import PythonLexer
from pygments.lexers import JavaLexer, CLexer, JavascriptLexer, HtmlLexer
from pygments.formatters import HtmlFormatter
from jinja2 import Template
from ..config import settings


class ScreenshotService:
    """Service for generating code screenshots using Playwright"""
    
    def __init__(self):
        self.template_dir = os.path.join(os.path.dirname(__file__), "..", "..", "templates")

    def _sanitize_screenshot_filename(self, filename: str) -> str:
        safe = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', filename or "file")
        return safe or "file"
    
    async def generate_screenshot(
        self, 
        code: str, 
        output: str, 
        theme: str = "idle",
        job_id: int = None,
        username: str = "User",
        filename: str = "new.py",
        project_files: dict = None
    ) -> Tuple[bool, str, int, int]:
        """
        Generate screenshot of code and output
        
        Args:
            code: Python code to display
            output: Execution output
            theme: 'idle', 'notepad', or 'codeblocks'
            job_id: Job ID for organizing screenshots
            
        Returns:
            Tuple of (success, file_path, width, height)
        """
        
        try:
            # Ensure screenshot directory exists
            screenshot_dir = os.path.join(settings.SCREENSHOT_DIR, str(job_id) if job_id else "temp")
            os.makedirs(screenshot_dir, exist_ok=True)
            
            # For Java/C themes, extract the class name from code to use as filename
            if theme == 'notepad':  # Java
                class_name = self._extract_java_class_name(code)
                if class_name:
                    filename = f"{class_name}.java"
            elif theme == 'codeblocks':  # C
                # Keep existing filename logic for C
                pass
            
            # Generate syntax-highlighted HTML
            highlighted_code = self._highlight_code(code, theme)
            
            # Load and render template
            html_content = await self._render_template(
                highlighted_code, output, theme, username, filename, project_files
            )
            
            # Take screenshot
            screenshot_path = os.path.join(
                screenshot_dir, 
                f"screenshot_{uuid.uuid4().hex[:8]}.png"
            )
            
            success, width, height = await self._take_screenshot(
                html_content, screenshot_path
            )
            
            if success:
                return True, screenshot_path, width, height
            else:
                return False, "", 0, 0
                
        except Exception as e:
            print(f"Screenshot generation error: {str(e)}")
            return False, str(e), 0, 0

    def _wrap_browser_content(self, body: str, url: str = "http://localhost") -> str:
        """
        Wrap arbitrary server response content into a lightweight "browser-like" page for screenshotting.
        - If content looks like HTML, embed it directly in the page body.
        - Otherwise, render it inside a <pre>.
        """
        body = body or ""
        looks_like_html = bool(re.search(r"<!doctype|<html|<head|<body|</\w+>", body, re.IGNORECASE))

        if looks_like_html:
            rendered = body
        else:
            rendered = f"<pre class='plain'>{html_escape(body)}</pre>"

        # Faux Chrome (Windows) frame: minimal, no outer shadow/border, looks like a normal Chrome window.
        return f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Browser Output</title>
    <style>
      :root {{
        --chrome-bg: #f3f3f3;
        --chrome-border: #e5e7eb;
        --addr-bg: #ffffff;
        --addr-border: #d1d5db;
        --text: #111827;
        --muted: #6b7280;
      }}
      html, body {{
        margin: 0;
        padding: 0;
        background: #ffffff;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }}
      .window {{
        width: 100%;
        height: 100vh;
        background: #ffffff;
        overflow: hidden;
      }}
      .topbar {{
        height: 44px;
        background: var(--chrome-bg);
        border-bottom: 1px solid var(--chrome-border);
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 10px;
        color: var(--text);
      }}
      .nav {{
        display: flex;
        gap: 8px;
        align-items: center;
      }}
      .icon-btn {{
        width: 28px;
        height: 28px;
        border-radius: 6px;
        display: grid;
        place-items: center;
        color: #374151;
        user-select: none;
      }}
      .icon-btn:hover {{ background: rgba(0,0,0,0.06); }}
      .addr {{
        flex: 1;
        height: 30px;
        border-radius: 16px;
        background: var(--addr-bg);
        border: 1px solid var(--addr-border);
        display: flex;
        align-items: center;
        padding: 0 12px;
        font-size: 12px;
        color: #111827;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }}
      .addr .lock {{
        font-size: 12px;
        margin-right: 8px;
        color: #16a34a;
      }}
      .win-controls {{
        display: flex;
        gap: 2px;
        margin-left: 6px;
      }}
      .win {{
        width: 38px;
        height: 30px;
        display: grid;
        place-items: center;
        border-radius: 6px;
        color: #374151;
        user-select: none;
      }}
      .win:hover {{ background: rgba(0,0,0,0.06); }}
      .content {{
        padding: 18px;
      }}
      pre.plain {{
        margin: 0;
        padding: 14px;
        background: #ffffff;
        color: #111827;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        overflow: auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 13px;
        line-height: 1.45;
      }}
    </style>
  </head>
  <body>
    <div class="window">
      <div class="topbar">
        <div class="nav">
          <div class="icon-btn" title="Back">←</div>
          <div class="icon-btn" title="Forward">→</div>
          <div class="icon-btn" title="Reload">⟳</div>
        </div>
        <div class="addr"><span class="lock">🔒</span>{html_escape(url)}</div>
        <div class="win-controls" aria-hidden="true">
          <div class="win" title="Minimize">—</div>
          <div class="win" title="Maximize">□</div>
          <div class="win" title="Close">✕</div>
        </div>
      </div>
      <div class="content">
        {rendered}
      </div>
    </div>
  </body>
</html>"""

    async def generate_browser_screenshot(
        self,
        response_body: str,
        job_id: int,
        url: str,
    ) -> Tuple[bool, str, int, int]:
        """
        Generate a real browser-style screenshot of a Node/Express server response.
        """
        try:
            screenshot_dir = os.path.join(settings.SCREENSHOT_DIR, str(job_id) if job_id else "temp")
            os.makedirs(screenshot_dir, exist_ok=True)

            html_content = self._wrap_browser_content(response_body or "", url=url or "http://localhost")
            screenshot_path = os.path.join(screenshot_dir, f"browser_{uuid.uuid4().hex[:8]}.png")

            # Use a Chrome-like viewport (Windows common: 1366x768)
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page(viewport={"width": 1366, "height": 768})
                await page.set_content(html_content)
                await page.wait_for_timeout(500)
                await page.screenshot(path=screenshot_path, full_page=False, type="png")
                await browser.close()

            # Return viewport dimensions (screenshot matches viewport)
            return True, screenshot_path, 1366, 768
        except Exception as e:
            print(f"Browser screenshot generation error: {str(e)}")
            return False, str(e), 0, 0
    
    
    def _highlight_code(self, code: str, theme: str = "idle") -> str:
        """Apply syntax highlighting based on theme/language"""
        try:
            # Map theme to appropriate lexer
            lexer_map = {
                'idle': PythonLexer(),
                'notepad': JavaLexer(),
                'codeblocks': CLexer(),
                'html': HtmlLexer(),
                'react': JavascriptLexer(),
                'node': JavascriptLexer()
            }
            
            lexer = lexer_map.get(theme, PythonLexer())
            
            formatter = HtmlFormatter(
                nowrap=True,
                cssclass="code-highlight",
                style="default"
            )
            highlighted = highlight(code, lexer, formatter)
            
            # Replace Pygments classes with theme-specific classes
            if theme == 'idle':
                # Python IDLE colors
                replacements = {
                    'class="k"': 'class="keyword"',  # keywords (def, for, in) - ORANGE
                    'class="s"': 'class="string"',   # strings - GREEN
                    'class="c"': 'class="comment"',  # comments - RED
                    'class="m"': 'class="number"',   # numbers - PURPLE
                    'class="nb"': 'class="builtin"', # built-in functions (print, range) - BLACK
                    'class="nf"': 'class="function"', # function names (fibonacci) - BLUE
                    'class="n"': 'class="variable"', # variables - BLACK
                    'class="o"': 'class="operator"', # operators - BLACK
                }
            elif theme == 'notepad':
                # Java Notepad colors
                replacements = {
                    'class="k"': 'class="keyword"',  # keywords - BLUE
                    'class="s"': 'class="string"',   # strings - GREEN
                    'class="c"': 'class="comment"',  # comments - GRAY
                    'class="m"': 'class="number"',   # numbers - RED
                    'class="nf"': 'class="function"', # functions - BLUE
                    'class="n"': 'class="variable"', # variables - BLACK
                    'class="o"': 'class="operator"', # operators - BLACK
                }
            elif theme == 'codeblocks':
                # C CodeBlocks colors
                replacements = {
                    'class="k"': 'class="keyword"',  # keywords - Bold Navy Blue
                    'class="s"': 'class="string"',   # strings - Light Navy Blue
                    'class="c"': 'class="comment"',  # comments - Green
                    'class="m"': 'class="number"',   # numbers - Dark Red
                    'class="nf"': 'class="function"', # functions - Black
                    'class="n"': 'class="variable"', # variables - Black
                    'class="o"': 'class="operator"', # operators - Black
                    'class="cp"': 'class="preprocessor"', # preprocessor - Light Green
                    'class="nb"': 'class="macro"', # macros - Light Green
                    'class="c1"': 'class="preprocessor"', # Alternative preprocessor class
                    'class="cpf"': 'class="preprocessor"', # Preprocessor function
                    'class="kt"': 'class="keyword"', # Type keywords
                    'class="kr"': 'class="keyword"', # Reserved keywords
                }
            else:
                # Default replacements
                replacements = {
                    'class="k"': 'class="keyword"',
                    'class="s"': 'class="string"',
                    'class="c"': 'class="comment"',
                    'class="m"': 'class="number"',
                    'class="nf"': 'class="function"',
                    'class="n"': 'class="variable"',
                    'class="o"': 'class="operator"',
                }
            
            for old_class, new_class in replacements.items():
                highlighted = highlighted.replace(old_class, new_class)
            
            return highlighted
        except Exception as e:
            # Fallback to plain text if highlighting fails
            print(f"Syntax highlighting failed: {e}")
            return code
    
    async def _render_template(
        self, 
        highlighted_code: str, 
        output: str, 
        theme: str,
        username: str = "User",
        filename: str = "new.py",
        project_files: dict = None
    ) -> str:
        """Render HTML template with code and output"""
        
        # Select template file
        template_file = f"{theme}_theme.html"
        template_path = os.path.join(self.template_dir, template_file)
        
        if not os.path.exists(template_path):
            # Fallback to idle theme
            template_path = os.path.join(self.template_dir, "idle_theme.html")
        
        # Read template
        with open(template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()
        
        # Render template
        template = Template(template_content)
        
        # Clean output for display
        clean_output = self._clean_output(output)
        
        html_content = template.render(
            code_content=highlighted_code,
            output_content=clean_output,
            username=username,
            filename=filename,
            project_files=project_files or {}
        )
        
        return html_content
    
    def _extract_java_class_name(self, code: str) -> str:
        """Extract the public class name from Java code"""
        for line in code.split('\n'):
            line = line.strip()
            if line.startswith('public class') and '{' in line:
                # Extract class name from "public class ClassName {"
                parts = line.split()
                if len(parts) >= 3:
                    return parts[2].split('{')[0].strip()
            elif line.startswith('class') and '{' in line:
                # Handle "class ClassName {" without public
                parts = line.split()
                if len(parts) >= 2:
                    return parts[1].split('{')[0].strip()
        return None
    
    def _clean_output(self, output: str) -> str:
        """Clean and format output text to match IDLE shell format"""
        if not output:
            return ""
        
        # Remove excessive whitespace while preserving line structure
        lines = output.strip().split('\n')
        cleaned_lines = []
        
        for line in lines:
            # Remove trailing whitespace
            cleaned_line = line.rstrip()
            if cleaned_line:  # Only add non-empty lines
                cleaned_lines.append(cleaned_line)
        
        if not cleaned_lines:
            return ""
        
        # Wrap long lines to prevent overflow in the UI
        wrapped_lines = []
        for line in cleaned_lines:
            if len(line) > 90:
                wrapped_lines.extend(
                    textwrap.wrap(
                        line,
                        width=90,
                        replace_whitespace=False,
                        drop_whitespace=False,
                    )
                )
            else:
                wrapped_lines.append(line)
        
        cleaned_output = '\n'.join(wrapped_lines)
        
        # Limit to reasonable length for screenshot
        if len(cleaned_output) > 2000:
            cleaned_output = cleaned_output[:2000] + " ..."
        
        return cleaned_output

    async def generate_file_screenshots(
        self,
        files: list,
        job_id: int,
        username: str = "User"
    ) -> list:
        """Generate Notepad-style screenshots for file contents."""
        results = []
        if not files:
            return results
        
        screenshot_dir = os.path.join(settings.SCREENSHOT_DIR, str(job_id))
        os.makedirs(screenshot_dir, exist_ok=True)
        
        template_path = os.path.join(self.template_dir, "notepad_file_theme.html")
        with open(template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()
        template = Template(template_content)
        
        for file_data in files:
            filename = file_data.get("filename", "file.txt")
            content = file_data.get("content", "")
            file_type = file_data.get("type", "generated")
            html_content = template.render(
                filename=filename,
                file_content=content,
                file_type=file_type,
                username=username
            )
            safe_name = self._sanitize_screenshot_filename(filename)
            screenshot_path = os.path.join(
                screenshot_dir,
                f"file_{safe_name}_{uuid.uuid4().hex[:6]}.png"
            )
            success, width, height = await self._take_screenshot(html_content, screenshot_path)
            if success:
                results.append({
                    "filename": filename,
                    "path": screenshot_path,
                    "width": width,
                    "height": height
                })
        
        return results
    
    async def _take_screenshot(
        self, 
        html_content: str, 
        output_path: str
    ) -> Tuple[bool, int, int]:
        """Take screenshot using Playwright"""
        
        try:
            async with async_playwright() as p:
                # Launch browser
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                
                # Set viewport size for consistent screenshots
                await page.set_viewport_size({"width": 900, "height": 600})
                
                # Replace relative URLs with absolute URLs so images can load
                html_content = html_content.replace('src="/public/', 'src="http://localhost:8000/public/')
                
                # Set content
                await page.set_content(html_content)
                
                # Wait for content to render
                await page.wait_for_timeout(1000)
                
                # Take screenshot
                await page.screenshot(
                    path=output_path,
                    full_page=True,
                    type='png'
                )
                
                # Get dimensions
                dimensions = await page.evaluate("""
                    () => {
                        const body = document.body;
                        return {
                            width: Math.max(body.scrollWidth, body.offsetWidth),
                            height: Math.max(body.scrollHeight, body.offsetHeight)
                        };
                }
                """)
                
                await browser.close()
                
                return True, dimensions['width'], dimensions['height']
                
        except Exception as e:
            print(f"Playwright screenshot error: {str(e)}")
            return False, 0, 0
    
    async def test_screenshot(self) -> bool:
        """Test screenshot generation with sample code"""
        test_code = '''
def greet(name):
    return f"Hello, {name}!"

result = greet("LabMate AI")
print(result)
print("Screenshot test successful!")
'''
        
        test_output = "Hello, LabMate AI!\nScreenshot test successful!"
        
        success, path, width, height = await self.generate_screenshot(
            test_code, test_output, "idle"
        )
        
        if success:
            # Clean up test file
            try:
                os.unlink(path)
            except:
                pass
        
        return success and width > 0 and height > 0
    
    async def generate_project_screenshots(
        self,
        project_files: dict,
        screenshots_by_route: dict,
        job_id: int,
        task_id: int,
        username: str = "User"
    ) -> list:
        """
        Generate screenshot for each route in a React project
        
        Args:
            project_files: Dictionary of {filepath: content}
            screenshots_by_route: Dictionary of {route: html_content}
            job_id: Job ID for directory structure
            task_id: Task ID for naming
            username: Username for display
        
        Returns:
            List of {"route": "/path", "url": "/screenshots/..."}
        """
        screenshot_urls = []
        
        print(f"[Screenshot Service] Generating combined screenshots for React project")
        
        # Map route components to their routes
        route_component_mapping = {
            "src/components/Home.js": "/",
            "src/components/Home.jsx": "/",
            "src/components/About.js": "/about", 
            "src/components/About.jsx": "/about",
            "src/components/Contact.js": "/contact",
            "src/components/Contact.jsx": "/contact"
        }
        
        # Files that should only show VS Code (no browser output)
        code_only_files = {
            "src/App.css"
        }
        
        # Files that should show browser output (entry points and main components)
        browser_output_files = {
            "src/App.js",
            "src/App.jsx",
            "src/index.js",
            "src/index.jsx",
            "src/main.js",
            "src/main.jsx"
        }
        
        # Generate screenshots for each file
        for file_path, file_content in project_files.items():
            try:
                # Create filename based on the file path
                filename = file_path.replace("src/", "").replace("/", "_").replace("\\", "_")
                
                # Check if this file should only show VS Code (no browser output)
                if file_path in code_only_files:
                    # Generate code-only screenshot for CSS files, etc.
                    success, screenshot_path, width, height = await self.generate_screenshot(
                        code=file_content,
                        output="",  # No output for code-only files
                        theme="react",
                        job_id=job_id,
                        username=username,
                        filename=filename,
                        project_files=project_files
                    )
                    print(f"[Screenshot Service] Generated code-only screenshot for {file_path}: {screenshot_path}")
                # Check if this is a main component/entry point that should show browser output
                elif file_path in browser_output_files:
                    # For main components, use the first route's output (usually "/")
                    main_route = "/" if "/" in screenshots_by_route else list(screenshots_by_route.keys())[0] if screenshots_by_route else ""
                    if main_route and main_route in screenshots_by_route:
                        html_content = screenshots_by_route[main_route]
                        success, screenshot_path, width, height = await self.generate_screenshot(
                            code=file_content,
                            output=html_content,  # Include browser output
                            theme="react",
                            job_id=job_id,
                            username=username,
                            filename=filename,
                            project_files=project_files
                        )
                        print(f"[Screenshot Service] Generated combined screenshot for {file_path} + {main_route}: {screenshot_path}")
                    else:
                        # Fallback to code-only if no route output available
                        success, screenshot_path, width, height = await self.generate_screenshot(
                            code=file_content,
                            output="",  # No output
                            theme="react",
                            job_id=job_id,
                            username=username,
                            filename=filename,
                            project_files=project_files
                        )
                        print(f"[Screenshot Service] Generated code-only screenshot for {file_path}: {screenshot_path}")
                # Check if this is a route component that should have combined input+output
                elif file_path in route_component_mapping:
                    route = route_component_mapping[file_path]
                    if route in screenshots_by_route:
                        # Generate combined input+output screenshot for route components
                        html_content = screenshots_by_route[route]
                        success, screenshot_path, width, height = await self.generate_screenshot(
                            code=file_content,
                            output=html_content,  # Include browser output
                            theme="react",
                            job_id=job_id,
                            username=username,
                            filename=filename,
                            project_files=project_files
                        )
                        print(f"[Screenshot Service] Generated combined screenshot for {file_path} + {route}: {screenshot_path}")
                    else:
                        # Fallback to code-only if route not found
                        success, screenshot_path, width, height = await self.generate_screenshot(
                            code=file_content,
                            output="",  # No output
                            theme="react",
                            job_id=job_id,
                            username=username,
                            filename=filename,
                            project_files=project_files
                        )
                        print(f"[Screenshot Service] Generated code-only screenshot for {file_path}: {screenshot_path}")
                else:
                    # Generate code-only screenshot for any other files
                    success, screenshot_path, width, height = await self.generate_screenshot(
                        code=file_content,
                        output="",  # No output for other files
                        theme="react",
                        job_id=job_id,
                        username=username,
                        filename=filename,
                        project_files=project_files
                    )
                    print(f"[Screenshot Service] Generated code-only screenshot for {file_path}: {screenshot_path}")
                
                if success:
                    # Convert absolute path to URL path
                    url_path = screenshot_path.replace("/app", "")
                    screenshot_urls.append({
                        "file": file_path,
                        "url": url_path,
                        "path": screenshot_path,
                        "width": width,
                        "height": height
                    })
                else:
                    print(f"[Screenshot Service] Failed to generate screenshot for file {file_path}")
                    
            except Exception as e:
                print(f"[Screenshot Service] Error generating screenshot for file {file_path}: {str(e)}")
        
        return screenshot_urls


# Global instance
screenshot_service = ScreenshotService()
