import ast
import base64
import os
import uuid
import textwrap
import re
from typing import Tuple
from html import escape as html_escape
from playwright.async_api import async_playwright
from pygments import highlight
from pygments.lexers import PythonLexer
from pygments.lexers import JavaLexer, CLexer, CppLexer, JavascriptLexer, HtmlLexer
from pygments.formatters import HtmlFormatter
from jinja2 import Environment, FileSystemLoader, Template
from markupsafe import Markup
from ..config import settings
from .browser_capture import launch_capture_browser


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
        project_files: dict = None,
        screenshot_style: str = "style_1",
        error: str = "",
        stdin_data: str = None,
        view_mode: str = "split",
        **kwargs
    ) -> Tuple[bool, str, int, int]:
        """
        Generate screenshot of code and output
        
        Args:
            code: Program code to display
            output: Execution output
            theme: 'idle' (Python), 'notepad' (Java), 'codeblocks' (C/C++), 'vscode' (WebDev)
            job_id: Job ID for organizing screenshots
            screenshot_style: For Python IDLE: 'style_1' (output down), 'style_2' (output side), 'style_3' (two windows)
            
        Returns:
            Tuple of (success, file_path, width, height)
        """
        try:
            raw_theme = (theme or "idle").lower()
            theme_map = {
                'python': 'idle',
                'idle': 'idle',
                'java': 'notepad',
                'notepad': 'notepad',
                'c': 'codeblocks',
                'cpp': 'codeblocks',
                'c++': 'codeblocks',
                'codeblocks': 'codeblocks',
                'webdev': 'vscode',
                'html': 'vscode',
                'react': 'vscode',
                'node': 'vscode',
                'vscode': 'vscode',
                'browser': 'browser_preview',
                'browser_preview': 'browser_preview',
            }
            theme = theme_map.get(raw_theme, 'idle')

            # Normalize screenshot_style (for IDLE: style_1=down, style_2=side, style_3=two windows)
            style_str = str(screenshot_style or "style_1").lower()
            if "2" in style_str or "side" in style_str:
                norm_style = "style_2"
            elif "3" in style_str or "different" in style_str or "separate" in style_str or "two" in style_str:
                norm_style = "style_3"
            else:
                norm_style = "style_1"

            # Ensure screenshot directory exists
            screenshot_dir = os.path.join(settings.SCREENSHOT_DIR, str(job_id) if job_id else "temp")
            os.makedirs(screenshot_dir, exist_ok=True)
            
            # For Java themes, extract the class name from code to use as filename
            if theme == 'notepad':
                class_name = self._extract_java_class_name(code)
                if class_name:
                    filename = f"{class_name}.java"
            elif theme == 'codeblocks':
                if not filename.endswith(('.c', '.cpp')):
                    filename = "main.cpp" if "iostream" in code or "class " in code else "main.c"
            elif theme == 'vscode':
                if not filename.endswith(('.html', '.js', '.jsx', '.ts', '.tsx', '.css')):
                    filename = "index.html" if "<!doctype" in code.lower() or "<html" in code.lower() else "app.jsx"
            
            start_line = kwargs.get("start_line", 1)
            end_line = kwargs.get("end_line", None)
            
            code_to_highlight = code
            if start_line > 1 or end_line is not None:
                all_code_lines = code.splitlines()
                actual_end = end_line if end_line is not None else len(all_code_lines)
                code_to_highlight = "\n".join(all_code_lines[start_line - 1 : actual_end])
            
            # Generate syntax-highlighted HTML
            highlighted_code = self._highlight_code(code_to_highlight, theme)
            
            clean_kwargs = {k: v for k, v in kwargs.items() if k not in ("start_line", "end_line")}
            html_content = await self._render_template(
                highlighted_code=highlighted_code,
                output=output,
                theme=theme,
                username=username,
                filename=filename,
                project_files=project_files,
                screenshot_style=norm_style,
                error=error,
                source_code=code,
                stdin_data=stdin_data,
                view_mode=view_mode,
                start_line=start_line,
                end_line=end_line if end_line is not None else len(code.splitlines()),
                **clean_kwargs
            )
            
            # Select optimal viewport width and min height based on theme and style
            if theme == 'idle':
                if view_mode == 'editor':
                    vp_width, min_height = 920, 560
                elif view_mode in ('shell', 'output'):
                    vp_width, min_height = 840, 520
                else:
                    vp_width, min_height = 1000, 700
            elif theme == 'notepad':
                if view_mode == 'editor':
                    vp_width, min_height = 1040, 520
                elif view_mode in ('output', 'shell'):
                    vp_width, min_height = 1040, 420
                else:
                    vp_width, min_height = 1040, 780
            elif theme == 'codeblocks':
                if view_mode == 'output':
                    vp_width, min_height = 1040, 480
                else:
                    vp_width, min_height = 1060, 760
            elif theme == 'vscode':
                # Fixed height: 35 titlebar + 35 tabbar + 22 breadcrumb + 480 editor + 30 term-hdr + 220 terminal + 22 statusbar = ~844
                vp_width, min_height = 1128, 850
            elif theme == 'browser_preview':
                vp_width, min_height = 1128, 600
            else:
                vp_width, min_height = 1000, 750

            screenshot_path = os.path.join(
                screenshot_dir, 
                f"screenshot_{uuid.uuid4().hex[:8]}.png"
            )
            
            success, width, height = await self._take_screenshot(
                html_content, screenshot_path, width=vp_width, minimum_height=min_height
            )
            
            if success:
                from .storage_service import storage_service
                storage_service.sync_file(screenshot_path)
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

            # Compatibility previews use the same script-disabled, network-blocked renderer.
            success, width, height = await self._take_screenshot(html_content, screenshot_path, 1366, 768)
            return success, screenshot_path if success else "", width, height
        except Exception as e:
            print(f"Browser screenshot generation error: {str(e)}")
            return False, str(e), 0, 0

    async def generate_browser_preview_from_image(
        self, image_path: str, job_id: str, filename: str,
    ) -> Tuple[bool, str, int, int]:
        """Place an actual Playwright page capture inside the Chrome preview template."""
        source = os.path.realpath(image_path)
        screenshot_root = os.path.realpath(settings.SCREENSHOT_DIR)
        if os.path.commonpath([source, screenshot_root]) != screenshot_root or not os.path.isfile(source):
            return False, "Browser capture is outside the screenshot directory.", 0, 0
        if os.path.getsize(source) > 15 * 1024 * 1024:
            return False, "Browser capture exceeds the preview size limit.", 0, 0
        destination = os.path.join(settings.SCREENSHOT_DIR, self._sanitize_screenshot_filename(str(job_id)))
        os.makedirs(destination, exist_ok=True)
        output_path = os.path.join(destination, f"browser_preview_{uuid.uuid4().hex[:8]}.png")
        template = Environment(loader=FileSystemLoader(self.template_dir), autoescape=True).get_template(
            "browser_preview_theme.html")
        with open(source, "rb") as image_file:
            preview_image = base64.b64encode(image_file.read()).decode("ascii")
        html_content = template.render(
            filename=self._sanitize_screenshot_filename(filename), output_content="",
            preview_image=preview_image,
        )
        ok, width, height = await self._take_screenshot(html_content, output_path, 1130, 768)
        if ok:
            from .storage_service import storage_service
            storage_service.sync_file(output_path)
        return ok, output_path if ok else "Browser preview capture failed.", width, height
    
    
    def _highlight_code(self, code: str, theme: str = "idle") -> str:
        """Apply syntax highlighting based on theme/language"""
        try:
            # Map theme to appropriate lexer
            lexer_map = {
                'idle': PythonLexer(),
                'notepad': JavaLexer(),
                'codeblocks': CppLexer() if re.search(r'\bstd::|#\s*include\s*<iostream>|class\s+\w+', code) else CLexer(),
                'html': HtmlLexer(),
                'react': JavascriptLexer(),
                'node': JavascriptLexer(),
                'vscode': HtmlLexer() if re.search(r'<!doctype|<html', code, re.I) else JavascriptLexer()
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
                # Exact Python IDLE colors mapping
                replacements = {
                    'class="k"': 'class="keyword"',
                    'class="kd"': 'class="keyword"',
                    'class="kn"': 'class="keyword"',
                    'class="kp"': 'class="keyword"',
                    'class="kr"': 'class="keyword"',
                    'class="ow"': 'class="keyword"',
                    'class="s"': 'class="string"',
                    'class="s2"': 'class="string"',
                    'class="s1"': 'class="string"',
                    'class="sa"': 'class="string"',
                    'class="si"': 'class="string"',
                    'class="se"': 'class="string"',
                    'class="sd"': 'class="string"',
                    'class="c"': 'class="comment"',
                    'class="c1"': 'class="comment"',
                    'class="m"': 'class="number"',
                    'class="mi"': 'class="number"',
                    'class="mf"': 'class="number"',
                    'class="nb"': 'class="builtin"',
                    'class="bp"': 'class="builtin"',
                    'class="nf"': 'class="function"',
                    'class="fm"': 'class="function"',
                    'class="nc"': 'class="class-name"',
                    'class="n"': 'class="variable"',
                    'class="o"': 'class="operator"',
                }
            elif theme == 'notepad':
                # Java Notepad colors
                replacements = {
                    'class="k"': 'class="keyword"',
                    'class="kd"': 'class="keyword"',
                    'class="kn"': 'class="keyword"',
                    'class="s"': 'class="string"',
                    'class="s2"': 'class="string"',
                    'class="c"': 'class="comment"',
                    'class="c1"': 'class="comment"',
                    'class="m"': 'class="number"',
                    'class="mi"': 'class="number"',
                    'class="nf"': 'class="function"',
                    'class="nc"': 'class="class-name"',
                    'class="n"': 'class="variable"',
                    'class="o"': 'class="operator"',
                }
            elif theme == 'codeblocks':
                # C/C++ CodeBlocks colors
                replacements = {
                    'class="cp"': 'class="preprocessor"',
                    'class="cpf"': 'class="preprocessor"',
                    'class="c1"': 'class="comment"',
                    'class="c"': 'class="comment"',
                    'class="k"': 'class="keyword"',
                    'class="kt"': 'class="keyword"',
                    'class="kr"': 'class="keyword"',
                    'class="kd"': 'class="keyword"',
                    'class="s"': 'class="string"',
                    'class="s2"': 'class="string"',
                    'class="m"': 'class="number"',
                    'class="mi"': 'class="number"',
                    'class="nf"': 'class="function"',
                    'class="n"': 'class="variable"',
                    'class="o"': 'class="operator"',
                }
            elif theme == 'vscode':
                # VS Code Dark+ colors
                replacements = {
                    'class="k"': 'class="keyword"',
                    'class="kd"': 'class="keyword"',
                    'class="kn"': 'class="keyword"',
                    'class="s"': 'class="string"',
                    'class="s2"': 'class="string"',
                    'class="s1"': 'class="string"',
                    'class="c"': 'class="comment"',
                    'class="c1"': 'class="comment"',
                    'class="m"': 'class="number"',
                    'class="mi"': 'class="number"',
                    'class="nf"': 'class="function"',
                    'class="nc"': 'class="class-name"',
                    'class="na"': 'class="attribute"',
                    'class="nt"': 'class="tag"',
                    'class="n"': 'class="variable"',
                }
            else:
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
        project_files: dict = None,
        screenshot_style: str = "style_1",
        error: str = "",
        source_code: str = "",
        stdin_data: str = None,
        view_mode: str = "split",
        **kwargs
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
        template = Environment(loader=FileSystemLoader(self.template_dir), autoescape=True).get_template(os.path.basename(template_path))
        
        if theme == "idle":
            output_content = output or ""
            if kwargs.get("input_echoed"):
                # The runtime already captured a real, ordered input/output
                # transcript. Do not guess prompt positions or invent echoes.
                session_segments = [{"kind": "stdout", "text": output_content}] if output_content else []
                if error:
                    session_segments.append({"kind": "stderr", "text": error})
            else:
                session_segments = self._idle_session_segments(source_code, output_content, stdin_data, error)
        # Keep the existing formatting path for non-IDLE themes.
        elif output and ("<span" in output or "<div" in output or "<b" in output):
            output_content = Markup(output)
            session_segments = []
        elif kwargs.get("input_echoed"):
            # Output is already interleaved with inputs — do not duplicate
            output_content = self._clean_output(output)
            session_segments = []
        else:
            # For C/C++/Java: interleave stdin values into the output so the
            # terminal screenshot proves which inputs produced the result.
            output_content = self._interleave_stdin_output(output, stdin_data, source_code=source_code)
            session_segments = []
        safe_filename = self._sanitize_screenshot_filename(os.path.basename(filename.replace("\\", "/")))
        
        start_line = kwargs.get("start_line", 1)
        end_line = kwargs.get("end_line", len(source_code.splitlines()) if source_code else 1)

        html_content = template.render(
            code_content=Markup(highlighted_code),
            highlighted_code=Markup(highlighted_code),
            output_content=output_content,
            error_content=error,
            username=username,
            filename=safe_filename if theme == "idle" else filename,
            screenshot_style=screenshot_style,
            project_files=project_files or {},
            session_segments=session_segments,
            view_mode=view_mode if view_mode in {"split", "shell", "editor", "output"} else "split",
            start_line=start_line,
            end_line=end_line,
            source_code=source_code or "",
        )
        
        return html_content

    def _idle_session_segments(self, code: str, output: str, stdin_data: str = None, error: str = "") -> list:
        """Echo real input values beside matching literal prompts, preserving stdout."""
        segments = []
        try:
            from .runtime_engine import python_stdin
            tree = ast.parse(code)
            calls = sorted(
                (node for node in ast.walk(tree) if isinstance(node, ast.Call)
                 and isinstance(node.func, ast.Name) and node.func.id == "input"),
                key=lambda node: (node.lineno, node.col_offset),
            )
            values = (python_stdin(code) if stdin_data is None else stdin_data).splitlines()
        except (SyntaxError, ValueError, TypeError):
            calls, values = [], []
        prompts = [call.args[0].value for call in calls
                   if call.args and isinstance(call.args[0], ast.Constant)
                   and isinstance(call.args[0].value, str) and call.args[0].value]
        position = 0
        for value in values:
            matches = [(output.find(prompt, position), prompt) for prompt in prompts]
            matches = [(found, prompt) for found, prompt in matches if found >= 0]
            if not matches:
                break
            found, prompt = min(matches, key=lambda item: item[0])
            if found < 0:
                continue
            if found > position:
                segments.append({"kind": "stdout", "text": output[position:found]})
            segments.append({"kind": "input", "text": prompt + value + "\n"})
            position = found + len(prompt)
        if position < len(output):
            segments.append({"kind": "stdout", "text": output[position:]})
        if error:
            if segments and not segments[-1]["text"].endswith("\n"):
                segments.append({"kind": "stderr", "text": "\n"})
            segments.append({"kind": "stderr", "text": error})
        return segments
    
    def _extract_java_class_name(self, code: str) -> str:
        from .runtime_engine import java_class_name
        return java_class_name(code)
    
    def _interleave_stdin_output(self, output: str, stdin_data: str = None, source_code: str = "") -> str:
        """Reconstruct a realistic terminal transcript with stdin values interleaved.

        For compiled languages (C/C++/Java) the runtime engine pipes stdin, but
        anonymous OS pipes do not echo keystrokes, causing consecutive prompts to run
        together without line breaks or entered values (e.g. 'Enter a: Enter b: Sum: 42').
        This method rebuilds the exact terminal transcript matching interactive terminal execution.
        """
        if not output and not stdin_data:
            return ""
        if not stdin_data or not stdin_data.strip():
            return self._clean_output(output)

        stdin_values = [v.strip() for v in stdin_data.splitlines() if v.strip()]
        if not stdin_values:
            return self._clean_output(output)

        clean_out = (output or "").replace("\r\n", "\n").strip()

        # 1. Extract literal prompt strings from source code if available
        prompts = []
        if source_code:
            import re
            c_matches = re.findall(r'(?:printf|puts)\s*\(\s*(?:"([^"]+)"|\'([^\']+)\')', source_code)
            for m in c_matches:
                p = m[0] or m[1]
                if p and not p.strip().startswith("%") and len(p.strip()) > 1:
                    prompts.append(p)
            cpp_matches = re.findall(r'cout\s*<<\s*"([^"]+)"', source_code)
            for p in cpp_matches:
                if p and len(p.strip()) > 1:
                    prompts.append(p)
            java_matches = re.findall(r'System\.out\.print(?:ln)?\s*\(\s*"([^"]+)"', source_code)
            for p in java_matches:
                if p and len(p.strip()) > 1:
                    prompts.append(p)

        active_prompts = []
        for p in prompts:
            p_clean = p.replace("\n", "").replace("\r", "")
            if p_clean and p_clean in clean_out and p_clean not in active_prompts:
                active_prompts.append(p_clean)

        if active_prompts:
            active_prompts.sort(key=lambda p: clean_out.find(p))
            result = clean_out
            stdin_idx = 0
            for p in active_prompts:
                if stdin_idx >= len(stdin_values):
                    break
                pos = result.find(p)
                if pos != -1:
                    val = stdin_values[stdin_idx]
                    stdin_idx += 1
                    end_p = pos + len(p)
                    # Check if the text immediately following prompt already begins with val
                    after_prompt = result[end_p:].lstrip(" \t")
                    if after_prompt.startswith(val) and (
                        len(after_prompt) == len(val)
                        or after_prompt[len(val):len(val)+1] in ("\n", "\r", " ", "\t")
                    ):
                        continue
                    sep = "" if p.endswith(" ") or p.endswith("\t") else " "
                    remainder = result[end_p:].lstrip(" ")
                    if remainder.startswith("\n"):
                        remainder = remainder[1:]
                    result = result[:end_p] + sep + val + "\n" + remainder

            if stdin_idx < len(stdin_values):
                remaining = stdin_values[stdin_idx:]
                lines = [l for l in result.splitlines() if l.strip()]
                if len(lines) > 1:
                    lines = lines[:-1] + remaining + lines[-1:]
                    result = "\n".join(lines)
                else:
                    result = result + "\n" + "\n".join(remaining)
            return self._clean_output(result)

        # 2. If no literal code prompts matched, use heuristic regex for prompt patterns in output
        import re
        prompt_regex = re.compile(
            r'([A-Za-z0-9_ ]*(?:enter|input|give|provide|read|scan|choice|value|number)[^:\n]*:?\s*)',
            re.IGNORECASE
        )
        matches = list(prompt_regex.finditer(clean_out))
        if matches:
            result = clean_out
            offset = 0
            stdin_idx = 0
            for m in matches:
                if stdin_idx >= len(stdin_values):
                    break
                val = stdin_values[stdin_idx]
                stdin_idx += 1
                end_pos = m.end() + offset
                after_match = result[end_pos:].lstrip(" \t")
                if after_match.startswith(val) and (
                    len(after_match) == len(val)
                    or after_match[len(val):len(val)+1] in ("\n", "\r", " ", "\t")
                ):
                    continue
                sep = "" if m.group(0).endswith(" ") else " "
                insertion = sep + val + "\n"
                result = result[:end_pos] + insertion + result[end_pos:].lstrip(" \n")
                offset += len(insertion)

            if stdin_idx < len(stdin_values):
                remaining = stdin_values[stdin_idx:]
                result = result + "\n" + "\n".join(remaining)
            return self._clean_output(result)

        # 3. Promptless execution: user typed inputs at terminal, followed by output
        input_str = "\n".join(stdin_values)
        if clean_out.startswith(input_str):
            return self._clean_output(clean_out)
        return self._clean_output(f"{input_str}\n{clean_out}")

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
    
    async def _take_screenshot(self, html_content: str, output_path: str, width=1000, minimum_height=700):
        """Render static IDE templates with scripts disabled and a bounded image size."""
        browser = None
        try:
            async with async_playwright() as playwright:
                browser = await launch_capture_browser(playwright)
                try:
                    context = await browser.new_context(viewport={"width": width, "height": minimum_height}, java_script_enabled=False)
                    await context.route("**/*", lambda route: route.abort())
                    page = await context.new_page()
                    await page.set_content(html_content, wait_until="load", timeout=15000)
                    required_height = await page.evaluate(
                        "Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)")
                    if required_height > 16000:
                        raise ValueError("Screenshot content is too tall to capture completely.")
                    height = max(minimum_height, required_height)
                    # A clip taller than the viewport is truncated by some
                    # browser builds. Grow the viewport before taking the image.
                    await page.set_viewport_size({"width": width, "height": height})
                    height = max(height, await page.evaluate(
                        "Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)"))
                    if height > 16000:
                        raise ValueError("Screenshot content is too tall to capture completely.")
                    await page.set_viewport_size({"width": width, "height": height})
                    await page.screenshot(path=output_path, full_page=True, timeout=15000)
                    from PIL import Image
                    with Image.open(output_path) as capture:
                        if capture.width != width or capture.height < height:
                            raise ValueError("Screenshot was cropped during capture.")
                        height = capture.height
                    await context.close()
                    return True, width, height
                finally:
                    await browser.close()
        except Exception as error:
            print(f"Screenshot capture failed: {type(error).__name__}")
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
    
    async def generate_project_screenshots(self, project_files: dict, screenshots_by_route: dict,
                                           job_id: int, task_id: int, username: str = "User"):
        """Register real browser captures and separate source/output captures."""
        from PIL import Image
        screenshots = []
        root = os.path.realpath(settings.SCREENSHOT_DIR)
        for route, path in screenshots_by_route.items():
            candidate = os.path.realpath(path)
            if os.path.commonpath([root, candidate]) != root or not os.path.isfile(candidate):
                raise ValueError("A browser capture is missing or outside the screenshot directory.")
            with Image.open(candidate) as image:
                width, height = image.size
            screenshots.append({"route": route, "path": candidate, "url": "/screenshots/" + os.path.relpath(candidate, root).replace("\\", "/"),
                                "width": width, "height": height})
        for name, source in list(project_files.items())[:12]:
            if not name.endswith((".js", ".jsx", ".ts", ".tsx", ".css")):
                continue
            success, path, width, height = await self.generate_screenshot(source, "", "react", job_id, username, name, project_files)
            if success:
                screenshots.append({"route": name, "path": path, "url": "/screenshots/" + os.path.relpath(path, settings.SCREENSHOT_DIR).replace("\\", "/"),
                                    "width": width, "height": height})
        return screenshots


# Global instance
screenshot_service = ScreenshotService()
