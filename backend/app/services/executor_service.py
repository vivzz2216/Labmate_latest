import ast
import pickle
import os
import re
import json
from pathlib import Path
import hashlib
from typing import Tuple, Dict, Any, Optional, List
from ..config import settings

class ExecutorService:
    """Compatibility adapter over the bounded, isolated runtime engine."""
    
    def __init__(self):
        self.client = None
        self.image = settings.DOCKER_IMAGE

    def is_file_handling(self, text: Optional[str]) -> bool:
        """Detect whether the provided text references file-handling operations."""
        if not text:
            return False
        
        lowered = text.lower()
        keywords = [
            "open(", "with open", ".read", ".write", ".append",
            "text file", "notepad", "store in file", "read contents",
            "write contents", "file handling", "append to file",
            "read last", "write into the file", "a text file", "file named",
            "read line from file", "append data", "r+", "w+", "a+"
        ]
        modes = ['"r"', "'r'", '"w"', "'w'", '"a"', "'a'", '"r+"', "'r+'"]
        
        if any(keyword in lowered for keyword in keywords):
            return True
        if any(mode in lowered for mode in modes):
            return True
        if re.search(r'\b[a-zA-Z0-9_\-]+\.(?:txt|csv|dat)\b', lowered):
            return True
        return False

    # CamelCase alias for spec compliance
    isFileHandling = is_file_handling

    def _sanitize_filename(self, filename: str) -> str:
        sanitized = re.sub(r'[^a-zA-Z0-9_\-\.\/]', '_', filename.strip())
        sanitized = sanitized.strip(".")
        if not sanitized:
            sanitized = "output.txt"
        # Prevent directory traversal
        sanitized = re.sub(r'\.\.(\/|\\)', '', sanitized)
        if sanitized.startswith(('/', '\\')):
            sanitized = sanitized.lstrip('/\\')
        return sanitized or "file.txt"

    def _extract_code_file_names(self, code: str) -> List[str]:
        if not code:
            return []

        filenames: set[str] = set()
        assigned_literals: Dict[str, str] = {}
        # Map of variable -> filename set via simple assignments anywhere in code
        var_to_filename: Dict[str, str] = self._extract_variable_filename_mapping(code)

        try:
            tree = ast.parse(code)
        except SyntaxError:
            return self._extract_code_file_names_regex(code)

        class OpenVisitor(ast.NodeVisitor):
            def __init__(self, outer: "ExecutorService"):
                self.outer = outer

            def visit_Assign(self, node: ast.AST):
                if isinstance(node, ast.Assign):
                    value = self.outer._resolve_str_literal(node.value, assigned_literals)
                    if value is not None:
                        for target in node.targets:
                            if isinstance(target, ast.Name):
                                assigned_literals[target.id] = value
                self.generic_visit(node)

            def visit_Call(self, node: ast.Call):
                if isinstance(node.func, ast.Name) and node.func.id == "open" and node.args:
                    mode = None
                    if len(node.args) > 1:
                        mode = self.outer._resolve_str_literal(node.args[1], assigned_literals)
                    if mode is None:
                        for kw in node.keywords or []:
                            if kw.arg == "mode":
                                mode = self.outer._resolve_str_literal(kw.value, assigned_literals)
                                break
                    if mode is None:
                        mode = "r"
                    if isinstance(mode, str):
                        mode_lower = mode.lower()
                        if "r" not in mode_lower:
                            return
                    filename = self.outer._resolve_str_literal(node.args[0], assigned_literals)
                    if filename:
                        filenames.add(filename)
                # Also check all string arguments in ANY function call for filename patterns
                # This catches cases like: read_file('example.txt') or process('data.csv')
                for arg in node.args:
                    if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                        if self.outer._is_supported_file_extension(arg.value):
                            filenames.add(arg.value)
                self.generic_visit(node)

        OpenVisitor(self).visit(tree)

        # Also detect open(var, 'r') patterns where var was assigned a filename elsewhere
        var_open_pattern = r'open\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:,\s*[\'"]([a-zA-Z\+\-b]*)[\'"])?'
        for var, mode in re.findall(var_open_pattern, code or ""):
            mode = (mode or "r").lower()
            if "r" in mode and var in var_to_filename:
                filenames.add(var_to_filename[var])

        return [name for name in filenames if self._is_supported_file_extension(name)]

    def _extract_code_file_names_regex(self, code: str) -> List[str]:
        names: set[str] = set()
        # Pattern 1: open() calls
        pattern = r'open\s*\(\s*[\'"]([^\'"]+)[\'"]\s*(?:,\s*[\'"]([a-zA-Z\+\-b]*)[\'"])?'
        for filename, mode in re.findall(pattern, code or ""):
            mode = (mode or "r").lower()
            if "r" in mode:
                names.add(filename)
        
        # Pattern 2: ANY string literal that looks like a filename (e.g., 'example.txt', "data.csv")
        # This catches function arguments like: read_file('example.txt')
        filename_pattern = r'[\'"]([a-zA-Z0-9_\-]+\.(?:txt|csv|dat|json|log|ini|cfg|md|pkl|xml|yaml|yml))[\'"]'
        for filename in re.findall(filename_pattern, code or ""):
            names.add(filename)
        
        return [name for name in names if self._is_supported_file_extension(name)]

    def _extract_variable_filename_mapping(self, code: str) -> Dict[str, str]:
        """
        Extract simple variable = 'filename.ext' assignments to help resolve open(var, 'r').
        We intentionally keep this conservative to avoid over-creating files.
        """
        mapping: Dict[str, str] = {}
        assign_pattern = r'([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[\'"]([^\'"]+\.(?:txt|csv|dat|json|log|ini|cfg|md|pkl|xml|yaml|yml))[\'"]'
        for var, fname in re.findall(assign_pattern, code or ""):
            mapping[var] = fname
        return mapping
    def _resolve_str_literal(self, node: Optional[ast.AST], assigned: Dict[str, str]) -> Optional[str]:
        if node is None:
            return None
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            return node.value
        if isinstance(node, ast.Name):
            return assigned.get(node.id)
        return None

    def _is_supported_file_extension(self, filename: str) -> bool:
        ext = os.path.splitext(filename)[1].lower()
        return ext in {".txt", ".csv", ".log", ".dat", ".json", ".cfg", ".ini", ".md", ".pkl", ".xml", ".yaml", ".yml"}

    def _extract_question_file_contents(self, question_text: Optional[str]) -> Dict[str, str]:
        if not question_text:
            return {}
        
        results: Dict[str, str] = {}
        lines = question_text.splitlines()
        current_file = None
        buffer: List[str] = []
        
        def flush():
            nonlocal current_file, buffer
            if current_file and buffer:
                snippet = "\n".join(buffer).strip()
                if snippet:
                    results[current_file] = snippet
            current_file = None
            buffer = []
        
        for line in lines:
            lowered = line.lower()
            file_match = re.search(r'([a-zA-Z0-9_\-]+\.(?:txt|csv|dat))', line)
            starts_new_block = (
                file_match is not None and
                any(kw in lowered for kw in ["content", "contains", "data", "input:", "as follows"])
            )
            
            if starts_new_block:
                flush()
                current_file = file_match.group(1)
                maybe_after_colon = line.split(":", 1)
                if len(maybe_after_colon) > 1:
                    remainder = maybe_after_colon[1].strip()
                    if remainder:
                        buffer.append(remainder)
                continue
            
            if current_file:
                if not line.strip():
                    flush()
                else:
                    buffer.append(line.rstrip())
        flush()
        return results

    def _default_sample_files(self) -> Dict[str, str]:
        # No global defaults; files are created only when referenced
        return {}

    def _hash_content(self, content: str) -> str:
        return hashlib.md5(content.encode("utf-8", errors="ignore")).hexdigest()

    def _safe_write_file(self, path: str, content: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def _read_text_safe(self, path: str) -> str:
        try:
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        except UnicodeDecodeError:
            try:
                with open(path, "r", encoding="latin-1", errors="ignore") as f:
                    return f.read()
            except Exception:
                return ""
        except Exception:
            return ""

    def _write_sample_file(self, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        ext = os.path.splitext(path)[1].lower()
        try:
            if ext in {".txt", ".log", ".md", ".cfg", ".ini"}:
                self._safe_write_file(path, "Sample line 1\nSample line 2\nSample line 3\n")
            elif ext == ".csv":
                self._safe_write_file(path, "ID,Name,Value\n1,Alice,42\n2,Bob,37\n3,Charlie,29\n")
            elif ext == ".json":
                sample = [
                    {"id": 1, "name": "Alice", "score": 85},
                    {"id": 2, "name": "Bob", "score": 78}
                ]
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(sample, f, indent=2)
            elif ext == ".pkl":
                sample = [
                    {"roll_number": 1, "name": "Alice", "age": 20},
                    {"roll_number": 2, "name": "Bob", "age": 21}
                ]
                with open(path, "wb") as f:
                    pickle.dump(sample, f)
            else:
                self._safe_write_file(path, "Sample data from LabMate sandbox.\n")
        except Exception:
            self._safe_write_file(path, "Sample data from LabMate sandbox.\n")

    def _get_file_preview_content(self, path: str) -> str:
        from ..security.file_preview import file_preview
        return file_preview(path)

    def prepare_sandbox_files(
        self,
        question_text: Optional[str],
        code: str,
        temp_dir: str
    ) -> Optional[Dict[str, Any]]:
        """Create default input files for file-handling programs."""
        extracted_names = set(self._extract_code_file_names(code))
        
        question_files = self._extract_question_file_contents(question_text)
        extracted_names.update(question_files.keys())
        
        if not extracted_names:
            return None
        
        snapshot: Dict[str, str] = {}
        input_files: Dict[str, Dict[str, Any]] = {}
        
        for name in sorted(extracted_names):
            sanitized = self._sanitize_filename(name)
            # Preserve original extension (e.g., .pkl). Only add .txt if none provided.
            ext = os.path.splitext(sanitized)[1].lower()
            if not ext:
                sanitized = f"{sanitized}.txt"
            
            content = question_files.get(name) or question_files.get(sanitized)
            file_path = os.path.join(temp_dir, sanitized)
            if content is not None:
                self._safe_write_file(file_path, content)
            else:
                self._write_sample_file(file_path)
            preview = self._get_file_preview_content(file_path)
            
            rel_path = os.path.relpath(file_path, temp_dir)
            snapshot[rel_path] = self._hash_content(preview)
            input_files[rel_path] = {
                "filename": sanitized,
                "path": file_path,
                "content": preview
            }
        
        return {
            "input_files": input_files,
            "snapshot": snapshot
        }

    # CamelCase alias
    prepareSandboxFiles = prepare_sandbox_files

    def collect_output_files(
        self,
        temp_dir: str,
        file_context: Optional[Dict[str, Any]],
        skip_files: Optional[List[str]] = None
    ) -> List[Dict[str, str]]:
        """Collect new or modified files from the sandbox."""
        # Allow collection even when no input files were pre-created (e.g., write-only tasks like pickle)
        snapshot = (file_context or {}).get("snapshot", {})
        input_files = (file_context or {}).get("input_files", {})
        skip_set = set(skip_files or [])
        collected: List[Dict[str, str]] = []
        
        for root, _, files in os.walk(temp_dir):
            for name in files:
                rel_path = os.path.relpath(os.path.join(root, name), temp_dir)
                rel_path = rel_path.replace("\\", "/")
                if rel_path in skip_set or name in skip_set:
                    continue
                absolute_path = os.path.join(root, name)
                
                content = self._get_file_preview_content(absolute_path)
                file_type = "input" if rel_path in input_files else "generated"
                previous_hash = snapshot.get(rel_path)
                current_hash = self._hash_content(content)
                
                if file_type == "input" or (previous_hash != current_hash):
                    collected.append({
                        "filename": rel_path,
                        "content": content,
                        "type": file_type
                    })
        
        return collected

    collectOutputFiles = collect_output_files

    async def run_python_with_files(
        self,
        code: str,
        filename: Optional[str],
        question_text: Optional[str] = None
    ):
        """Execute Python code with sandboxed file context."""
        return await self.execute_code(code, 'python', filename, question_text)

    runPythonWithFiles = run_python_with_files
    
    async def execute_code(self, code: str, language: str = "python", filename: Optional[str] = None,
                           question_text: Optional[str] = None, project_type: Optional[str] = None,
                           project_config: Optional[Dict[str, Any]] = None, stdin_data: Optional[str] = None,
                           browser_tests=None, interaction_is_required=False):
        """Execute only through the bounded runtime engine; preserve the public result tuple."""
        from .runtime_engine import runtime_engine
        config = project_config or {}
        file_mode = language == "python" and (self.is_file_handling(code) or self.is_file_handling(question_text))
        prepare = (lambda directory: self.prepare_sandbox_files(question_text, code, str(directory))) if file_mode else None
        collect = (lambda directory, context, name: self.collect_output_files(str(directory), context, skip_files=[name])) if file_mode else None
        try:
            result = await runtime_engine.execute(code, language, filename,
                stdin=stdin_data if stdin_data is not None else config.get("stdin"),
                project_files=config.get("project_files"), routes=config.get("routes"),
                prepare_files=prepare, collect_files=collect, browser_tests=browser_tests,
                interaction_is_required=interaction_is_required, objective=question_text or "",
                api_tests=config.get("api_tests"), project_config=config)
            files = result.files + [{"filename": Path(path).name, "content": "", "type": "generated",
                                     "path": path, "route": route, "screenshot_url": "/screenshots/" + os.path.relpath(path, settings.SCREENSHOT_DIR).replace("\\", "/")}
                                    for route, path in result.screenshots.items()]
            if result.verification is not None:
                files.append({"type": "browser_verification", "verification": result.verification})
            if result.stages:
                files.append({"type": "execution_stages", "stages": result.stages})
            return result.success, result.output, result.error, result.exit_code, files
        except Exception as error:
            return False, "", f"Runtime error: {error}", 1, []
    
    def normalize_output(self, output: str) -> str:
        """
        Normalize output by cropping if too large
        
        Rules:
        - If > 20 lines → crop (keep first 10, "...", last 5)
        - If max line width > 120 chars → crop lines
        - Returns safe text for screenshot
        
        Args:
            output: Raw output string
            
        Returns:
            Cropped/normalized output string
        """
        if not output:
            return output
        
        lines = output.split('\n')
        total_lines = len(lines)
        
        # Check if output needs cropping
        needs_cropping = False
        max_line_width = 0
        
        for line in lines:
            line_width = len(line)
            if line_width > max_line_width:
                max_line_width = line_width
        
        # Crop if too many lines
        if total_lines > 20:
            needs_cropping = True
            # Keep first 10 lines, "...", last 5 lines
            cropped_lines = lines[:10] + ["..."] + lines[-5:]
            lines = cropped_lines
        
        # Crop lines if too wide
        if max_line_width > 120:
            needs_cropping = True
            cropped_lines = []
            for line in lines:
                if len(line) > 120:
                    # Keep first 100 chars, "...", last 15 chars
                    cropped_line = line[:100] + "..." + line[-15:]
                    cropped_lines.append(cropped_line)
                else:
                    cropped_lines.append(line)
            lines = cropped_lines
        
        # If we cropped, add truncation notice
        if needs_cropping:
            result = '\n'.join(lines)
            if "Output truncated" not in result:
                result = result + "\n[Output truncated for display]"
            return result
        
        return output

    async def execute_react_project(self, project_files: dict, routes: list = None,
                                    job_id: str = None, task_id: str = None, username: str = None):
        from .runtime_engine import runtime_engine
        try:
            result = await runtime_engine.execute("", "react", project_files=project_files, routes=routes or ["/"])
            return result.success, result.output, result.error, result.exit_code, result.screenshots
        except Exception as error:
            return False, "", f"React execution error: {error}", 1, {}

# Create singleton instance
executor_service = ExecutorService()
