import ast
import pickle
import docker
from docker import types as docker_types
import tempfile
import os
import time
import uuid
import subprocess
import asyncio
import re
import json
import shutil
import aiohttp
import hashlib
from typing import Tuple, Dict, Any, Optional, List
from playwright.async_api import async_playwright
from ..config import settings
from .execution_templates import get_template



class ExecutorService:
    """Service for executing Python code in Docker containers"""
    
    def __init__(self):
        try:
            self.client = docker.from_env()
            self.image = settings.DOCKER_IMAGE
        except Exception as e:
            print(f"Warning: Could not connect to Docker: {e}")
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
        ext = os.path.splitext(path)[1].lower()
        if ext == ".pkl":
            try:
                with open(path, "rb") as f:
                    data = pickle.load(f)
                return json.dumps(data, indent=2, ensure_ascii=False)[:5000]
            except Exception:
                return "[Binary file content]"
        return self._read_text_safe(path)[:5000]

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
        if self.client:
            return await self._execute_python_docker(
                code, filename, question_text=question_text, enable_file_mode=True
            )
        return await self._execute_python_code(
            code, filename, question_text=question_text, enable_file_mode=True
        )

    runPythonWithFiles = run_python_with_files
    
    async def execute_code(
        self,
        code: str,
        language: str = "python",
        filename: Optional[str] = None,
        question_text: Optional[str] = None,
        project_type: Optional[str] = None,
        project_config: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, str, str, int, List[Dict[str, str]]]:
        """
        Execute code in a sandboxed environment
        
        Args:
            code: Code to execute
            language: Programming language ('python', 'c', 'java', 'html', 'react', 'node')
            filename: Optional filename for the code file (e.g., "user_provided_name.py")
            question_text: Question context used to detect file-handling scenarios
            project_type: Detected/overridden project type
            project_config: Optional template overrides (project_files, etc.)
        
        Returns:
            Tuple of (success, output_text, logs, exit_code, files)
        """
        file_mode = (
            language == "python" and (
                self.is_file_handling(code) or self.is_file_handling(question_text)
            )
        )

        # Handle web languages
        #
        # NOTE:
        # `_execute_project_template` relies on docker-py (`self.client.containers.*`). In this repo's
        # container environment docker-py can fail to initialize (http+docker), leaving `self.client = None`
        # and causing the crash:
        #   "Template execution error: 'NoneType' object has no attribute 'containers'"
        #
        # The dedicated web executors below use the Docker CLI + correct Docker networking and are the
        # supported path for HTML/React/Node execution.
        if language in ["html", "react", "node"]:
            success, output, logs, exit_code = await self._execute_web_code(code, language)
            return success, output, logs, exit_code, []
        
        # Use Docker execution for Python to support all libraries
        if language == "python":
            if self.client:
                return await self._execute_python_docker(
                    code, filename, question_text=question_text, enable_file_mode=file_mode
                )
            else:
                # Fallback to subprocess if Docker unavailable
                return await self._execute_python_code(
                    code, filename, question_text=question_text, enable_file_mode=file_mode
                )
        
        # Use subprocess execution for other traditional languages
        success, output, logs, exit_code = await self._subprocess_execute(code, language, filename)
        return success, output, logs, exit_code, []
    
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
    
    async def _subprocess_execute(self, code: str, language: str = "python", filename: Optional[str] = None) -> Tuple[bool, str, str, int]:
        """Execute code using subprocess (safer than Docker-in-Docker for MVP)"""
        temp_file = None
        executable_file = None
        
        try:
            if language == "c":
                # For C code, compile and run
                return await self._execute_c_code(code)
            elif language == "java":
                # For Java code, compile and run
                return await self._execute_java_code(code)
            else:
                # Default to Python (should rarely hit since execute_code routes Python separately)
                success, output, logs, exit_code, _ = await self._execute_python_code(
                    code, filename
                )
                return success, output, logs, exit_code
                
        except Exception as e:
            return False, "", f"Execution error: {str(e)}", 1
        finally:
            # Clean up temporary files
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                except:
                    pass
            if executable_file and os.path.exists(executable_file):
                try:
                    os.unlink(executable_file)
                except:
                    pass
    
    async def _execute_python_docker(
        self,
        code: str,
        filename: Optional[str] = None,
        question_text: Optional[str] = None,
        enable_file_mode: bool = False
    ) -> Tuple[bool, str, str, int, List[Dict[str, str]]]:
        """Execute Python code in Docker container with optional file-handling support"""
        container = None
        temp_file = None
        temp_dir = None
        file_context = None
        
        try:
            # Create temporary directory for code file
            temp_dir = tempfile.mkdtemp(prefix="python_exec_")
            
            # Use user-provided filename if available, otherwise default to main.py
            if filename and filename.endswith('.py'):
                py_filename = filename
            elif filename:
                py_filename = f"{filename}.py"
            else:
                py_filename = "main.py"
            
            temp_file = os.path.join(temp_dir, py_filename)
            
            # Wrap code to handle input() calls if needed
            wrapped_code = self._wrap_code_for_input(code)
            
            # Write code to file
            with open(temp_file, 'w', encoding='utf-8') as f:
                f.write(wrapped_code)

            if enable_file_mode:
                file_context = self.prepare_sandbox_files(question_text, code, temp_dir)
            
            # Detect required packages from imports
            required_packages = self._detect_python_imports(code)
            
            # Create requirements.txt if packages needed
            requirements_file = None
            if required_packages:
                requirements_file = os.path.join(temp_dir, "requirements.txt")
                with open(requirements_file, 'w', encoding='utf-8') as f:
                    for pkg in required_packages:
                        f.write(f"{pkg}\n")
            
            # Build Docker command with actual filename
            if requirements_file:
                # Install packages and run code
                docker_cmd = f"pip install -q -r /code/requirements.txt && python /code/{py_filename}"
            else:
                # Just run code
                docker_cmd = f"python /code/{py_filename}"
            
            # Run container with code mounted
            container = self.client.containers.run(
                self.image,
                docker_cmd,
                volumes={
                    temp_dir: {'bind': '/code', 'mode': 'rw'}  # Read-write for pip install
                },
                working_dir="/code",
                mem_limit=settings.MEMORY_LIMIT,
                cpu_period=settings.CPU_PERIOD,
                cpu_quota=settings.CPU_QUOTA,
                network_disabled=False,  # Allow network for pip install
                read_only=False,  # Need write access for pip cache
                security_opt=['no-new-privileges:true'],
                cap_drop=['ALL'],
                user='nobody',
                remove=False,
                detach=True,
                stdout=True,
                stderr=True,
                pids_limit=20,
                ulimits=[
                    docker_types.Ulimit(name='nofile', soft=100, hard=100),
                ]
            )
            
            # Wait for container with timeout
            try:
                result = container.wait(timeout=settings.CONTAINER_TIMEOUT)
                exit_code = result['StatusCode']
            except Exception as e:
                # Container timeout or error
                container.kill()
                container.wait()
                return False, "", f"Execution timeout or error: {str(e)}", 124
            
            # Get output
            output = container.logs(stdout=True, stderr=False).decode('utf-8')
            logs = container.logs(stdout=False, stderr=True).decode('utf-8')
            
            # Normalize (crop) output before returning
            output = self.normalize_output(output)
            logs = self.normalize_output(logs) if logs else logs
            
            # Clean up container
            container.remove()
            
            success = exit_code == 0
            output_files = self.collect_output_files(
                temp_dir,
                file_context,
                skip_files=[py_filename, "requirements.txt"] if enable_file_mode else [py_filename, "requirements.txt"]
            ) if enable_file_mode else []
            return success, output, logs, exit_code, output_files
            
        except docker.errors.ContainerError as e:
            logs = f"Container execution error: {str(e)}"
            if container:
                try:
                    container_logs = container.logs(stdout=True, stderr=True).decode('utf-8')
                    logs = f"{logs}\nContainer logs: {container_logs}"
                    container.remove()
                except:
                    pass
            return False, "", logs, 1, []
        except Exception as e:
            logs = f"Execution error: {str(e)}"
            return False, "", logs, 1, []
        finally:
            # Cleanup
            if container:
                try:
                    container.remove(force=True)
                except:
                    pass
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                except:
                    pass

    def _ensure_image(self, image: str) -> bool:
        """
        Ensure the docker image is available locally; try to pull if missing.

        IMPORTANT: docker-py is not reliable in this repo's container environment (http+docker scheme),
        so we use the docker CLI, which is already used elsewhere in this service.
        """
        try:
            inspect = subprocess.run(
                ["docker", "image", "inspect", image],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=20,
                check=False,
            )
            if inspect.returncode == 0:
                return True

            pull = subprocess.run(
                ["docker", "pull", image],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=180,
                check=False,
            )
            return pull.returncode == 0
        except Exception:
            return False

    def _get_current_container_network(self) -> Optional[str]:
        """
        Return the Docker network name the backend container is attached to (e.g. labmate-clean_default).
        We must avoid hardcoding compose network names and we must also avoid host port publishing on Windows.
        """
        try:
            container_id = os.environ.get("HOSTNAME")  # Docker sets HOSTNAME=container_id
            if not container_id:
                return None
            proc = subprocess.run(
                ["docker", "inspect", "-f", "{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}", container_id],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            if proc.returncode != 0:
                return None
            networks = [n.strip() for n in (proc.stdout or "").split() if n.strip()]
            if not networks:
                return None
            # Prefer a compose network over the default bridge
            for n in networks:
                if n != "bridge":
                    return n
            return networks[0]
        except Exception:
            return None

    def _to_docker_desktop_host_path(self, host_path: str) -> str:
        """
        Convert a host path to a Docker Desktop compatible path.
        On Windows, Docker Desktop expects /c/Users/... style mounts.
        """
        docker_host_path = (host_path or "").replace("\\", "/")
        # Convert "C:/..." to "/c/..." for Docker Desktop on Windows
        if len(docker_host_path) > 1 and docker_host_path[1] == ":":
            drive_letter = docker_host_path[0].lower()
            path_without_drive = docker_host_path[2:]
            docker_host_path = f"/{drive_letter}{path_without_drive}"
        return docker_host_path

    def _detect_node_listen_port(self, code: str) -> int:
        """
        Best-effort port detection for Node servers.
        Supports patterns like:
        - app.listen(3000)
        - server.listen(8080)
        - listen(process.env.PORT || 3000)
        """
        if not code:
            return 3000
        try:
            m = re.search(r"\blisten\s*\(\s*(\d{2,5})\b", code)
            if m:
                p = int(m.group(1))
                if 1 <= p <= 65535:
                    return p
            m = re.search(r"process\.env\.port\s*\|\|\s*(\d{2,5})", code.lower())
            if m:
                p = int(m.group(1))
                if 1 <= p <= 65535:
                    return p
        except Exception:
            pass
        return 3000

    def _extract_missing_node_modules(self, logs: str) -> List[str]:
        """
        Parse Node.js MODULE_NOT_FOUND errors and extract missing package names.
        Example patterns:
          Error: Cannot find module 'express'
          Cannot find module "lodash"
        We ignore relative paths (./, ../) and Node built-ins.
        """
        if not logs:
            return []
        missing: List[str] = []
        try:
            for m in re.findall(r"Cannot find module ['\"]([^'\"]+)['\"]", logs):
                spec = (m or "").strip()
                if not spec:
                    continue
                if spec.startswith(".") or spec.startswith("/") or spec.startswith(".."):
                    continue
                # normalize to package name (handle scoped + subpath)
                if spec.startswith("@"):
                    parts = spec.split("/")
                    if len(parts) >= 2:
                        pkg = "/".join(parts[:2])
                    else:
                        pkg = spec
                else:
                    pkg = spec.split("/")[0]
                if pkg and pkg not in missing:
                    missing.append(pkg)
        except Exception:
            return []
        return missing

    def _extract_express_routes(self, code: str) -> Dict[str, List[str]]:
        """
        Extract basic Express routes from source code.
        Returns dict of HTTP method -> list of paths (e.g. {"get": ["/", "/set_cookie"]}).
        Best-effort regex (handles: app.get('/path', ...)).
        """
        routes: Dict[str, List[str]] = {}
        if not code:
            return routes
        try:
            for method, path in re.findall(r"\bapp\.(get|post|put|delete|patch)\s*\(\s*['\"]([^'\"]+)['\"]", code, flags=re.IGNORECASE):
                m = (method or "").lower()
                p = (path or "").strip()
                if not p.startswith("/"):
                    p = "/" + p
                routes.setdefault(m, [])
                if p not in routes[m]:
                    routes[m].append(p)
        except Exception:
            return routes
        return routes

    def _extract_npm_packages_from_source(self, source: str) -> List[str]:
        """
        Extract probable npm package names from JS/TS source code.
        Handles:
        - import x from 'pkg'
        - import 'pkg'
        - require('pkg')
        - dynamic import('pkg')
        Returns top-level package names (e.g. 'react-icons' from 'react-icons/fa',
        '@mui/material' from '@mui/material/Button').
        """
        if not source:
            return []

        packages: List[str] = []
        # Basic patterns for JS/TS import/require specifiers
        patterns = [
            r"""import\s+[^;]*?\s+from\s+['"]([^'"]+)['"]""",
            r"""import\s+['"]([^'"]+)['"]""",
            r"""require\(\s*['"]([^'"]+)['"]\s*\)""",
            r"""import\(\s*['"]([^'"]+)['"]\s*\)""",
        ]
        for pat in patterns:
            for m in re.findall(pat, source):
                spec = m.strip()
                # ignore relative/absolute paths
                if spec.startswith(".") or spec.startswith("/") or spec.startswith("http"):
                    continue
                # normalize to package name
                if spec.startswith("@"):
                    parts = spec.split("/")
                    if len(parts) >= 2:
                        packages.append("/".join(parts[:2]))
                else:
                    packages.append(spec.split("/")[0])

        # De-dup while preserving order
        seen = set()
        out: List[str] = []
        for p in packages:
            if p and p not in seen:
                seen.add(p)
                out.append(p)
        return out

    def _infer_npm_dependencies(self, project_files: Dict[str, str], base: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        """
        Infer npm dependencies from the provided project files by scanning imports/requires.
        Uses a conservative allowlist-ish approach:
        - Always includes base deps
        - Adds detected deps with version '*' unless we have a known stable pinned version
        """
        deps: Dict[str, str] = dict(base or {})
        known_versions = {
            # common React ecosystem
            "react-router-dom": "^6.20.0",
            "axios": "^1.6.0",
            "lodash": "^4.17.21",
            "react-icons": "^5.0.0",
            "@reduxjs/toolkit": "^2.0.0",
            "react-redux": "^9.0.0",
            "styled-components": "^6.1.0",
            "@mui/material": "^5.15.0",
            "@emotion/react": "^11.11.0",
            "@emotion/styled": "^11.11.0",
            # Node ecosystem
            "express": "^4.18.2",
            "cors": "^2.8.5",
            "dotenv": "^16.4.0",
            "body-parser": "^1.20.2",
            "jsonwebtoken": "^9.0.2",
            "bcrypt": "^5.1.1",
            "mongoose": "^8.0.0",
            "pg": "^8.11.3",
            "mysql2": "^3.9.0",
        }

        for path, content in (project_files or {}).items():
            # Only scan likely JS/TS files
            if not any(path.endswith(ext) for ext in [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]):
                continue
            for pkg in self._extract_npm_packages_from_source(content or ""):
                if pkg in ["react", "react-dom", "vite", "@vitejs/plugin-react"]:
                    continue
                if pkg not in deps:
                    deps[pkg] = known_versions.get(pkg, "*")

        return deps

    async def _execute_project_template(
        self,
        code: str,
        project_type: str,
        project_config: Dict[str, Any]
    ) -> Tuple[bool, str, str, int]:
        """
        Execute using template metadata (image, setup, run, timeouts).
        Supports html/react/node via dynamic containers (no persistent service).
        """
        template = get_template(project_type)
        image = template.get("image")
        is_server = template.get("is_server", False)
        startup_wait = template.get("startup_wait", 0)
        health_check_url = template.get("health_check_url")
        exposed_port = template.get("exposed_port")
        timeout = template.get("timeout", settings.CONTAINER_TIMEOUT)

        if not template:
            return False, "", f"Unsupported project type: {project_type}", 1

        if not self._ensure_image(image):
            return False, "", f"Docker image {image} unavailable", 1

        temp_dir = None
        container = None
        try:
            temp_dir = tempfile.mkdtemp(prefix=f"{project_type}_")
            files = dict(template.get("files", {}))

            # Merge user provided project files (override template)
            user_files = project_config.get("project_files") or project_config.get("files") or {}
            for path, content in files.items():
                rendered = content.replace("{code}", code or "")
                if path in user_files:
                    rendered = user_files[path]
                self._safe_write_file(os.path.join(temp_dir, path), rendered)

            # Add any additional user files not in template
            for path, content in user_files.items():
                if path not in files:
                    self._safe_write_file(os.path.join(temp_dir, path), content)

            setup_cmd = " && ".join(template.get("setup", [])) if template.get("setup") else ""
            run_cmd = " && ".join(template.get("run", [])) if template.get("run") else ""
            full_cmd = " && ".join([c for c in [setup_cmd, run_cmd] if c]) or "echo ready"

            docker_kwargs = {
                "volumes": {temp_dir: {"bind": "/workspace", "mode": "rw"}},
                "working_dir": "/workspace",
                "mem_limit": settings.MEMORY_LIMIT,
                "cpu_period": settings.CPU_PERIOD,
                "cpu_quota": settings.CPU_QUOTA,
                "read_only": False,
                "remove": False,
                "detach": True,
                "stdout": True,
                "stderr": True,
            }

            if is_server and exposed_port:
                docker_kwargs["ports"] = {f"{exposed_port}/tcp": exposed_port}

            container = self.client.containers.run(
                image,
                ["sh", "-c", full_cmd],
                **docker_kwargs,
            )

            if is_server:
                # give server time to start
                await asyncio.sleep(startup_wait)
                healthy = True
                if health_check_url:
                    healthy = await self._wait_for_health(health_check_url, timeout=timeout)
                if not healthy:
                    logs = container.logs(stdout=True, stderr=True).decode("utf-8", errors="ignore")
                    return False, "", f"Server health check failed\n{logs}", 1
                # For server workloads, keep logs and then stop container
                logs = container.logs(stdout=True, stderr=True).decode("utf-8", errors="ignore")
                try:
                    container.stop(timeout=5)
                    container.remove()
                except Exception:
                    pass
                return True, "Server started successfully", logs, 0

            # Non-server: wait for completion
            result = container.wait(timeout=timeout)
            exit_code = result.get("StatusCode", 1)
            output = container.logs(stdout=True, stderr=False).decode("utf-8", errors="ignore")
            logs = container.logs(stdout=False, stderr=True).decode("utf-8", errors="ignore")
            try:
                container.remove()
            except Exception:
                pass
            return exit_code == 0, output, logs, exit_code

        except Exception as e:
            return False, "", f"Template execution error: {str(e)}", 1
        finally:
            if container:
                try:
                    container.remove(force=True)
                except Exception:
                    pass
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                except Exception:
                    pass

    async def _wait_for_health(self, url: str, timeout: int = 60) -> bool:
        """Poll a URL until it responds or timeout is reached."""
        try:
            async with aiohttp.ClientSession() as session:
                start = time.time()
                while time.time() - start < timeout:
                    try:
                        async with session.get(url, timeout=5) as resp:
                            if resp.status < 500:
                                return True
                    except Exception:
                        await asyncio.sleep(1)
                return False
        except Exception:
            return False
    
    def _wrap_code_for_input(self, code: str) -> str:
        """Wrap code to handle input() calls with realistic mock values that test all scenarios"""
        import re
        
        # Check if code uses input()
        if not re.search(r'\binput\s*\(', code):
            return code  # No input() calls, return as-is
        
        # Detect code patterns to determine appropriate input values
        code_lower = code.lower()
        is_factorial = 'factorial' in code_lower or 'fact' in code_lower
        is_fibonacci = 'fibonacci' in code_lower or 'fib' in code_lower
        is_recursive = 'recursive' in code_lower or 'recursion' in code_lower
        is_power = 'power' in code_lower or '**' in code or 'pow(' in code_lower
        is_matrix = 'matrix' in code_lower or 'array' in code_lower
        
        # Check if code uses int(input()) or numeric operations - indicates numeric input needed
        uses_int_input = bool(re.search(r'int\s*\(\s*input\s*\(', code))
        uses_numeric_ops = bool(re.search(r'[%\/\/\*\-\+]', code)) and ('num' in code_lower or 'number' in code_lower or 'digit' in code_lower)
        
        # String operations: only if clearly string-related (not numeric reverse)
        is_string_op = (
            ('reverse' in code_lower or 'palindrome' in code_lower) and 
            not uses_int_input and 
            not uses_numeric_ops and
            ('str' in code_lower or 'string' in code_lower or '.reverse()' in code_lower or '[::-1]' in code)
        ) or ('string' in code_lower and 'reverse' in code_lower)
        
        is_student_marks = ('student' in code_lower or 'marks' in code_lower) and ('average' in code_lower or 'total' in code_lower)
        is_pass_fail = 'pass' in code_lower or 'fail' in code_lower or 'result' in code_lower
        uses_split_for_marks = 'split' in code_lower and ('marks' in code_lower or 'subjects' in code_lower)
        is_menu_program = (
            'menu' in code_lower and (
                'choice' in code_lower or
                'option' in code_lower or
                'select' in code_lower
            )
        ) or ('while true' in code_lower and 'menu' in code_lower)
        
        # Detect numeric reverse operations (reversing digits of a number)
        is_numeric_reverse = (
            'reverse' in code_lower and 
            (uses_int_input or uses_numeric_ops or 'num % 10' in code_lower or 'num // 10' in code_lower)
        )
        
        # Count total inputs needed
        input_count = len(re.findall(r'\binput\s*\(', code))
        
        # Generate appropriate mock values based on code context
        mock_inputs = []
        
        if is_menu_program:
            # Simulate realistic menu-driven interaction: add items, display, exit
            menu_sequence = ["1", "__ITEM__", "2", "3"]
            item_index = 1
            while len(mock_inputs) < input_count:
                step = len(mock_inputs) % len(menu_sequence)
                value = menu_sequence[step]
                if value == "__ITEM__":
                    value = f"Sample Item {item_index}"
                    item_index += 1
                mock_inputs.append(value)
        elif is_student_marks and is_pass_fail:
            if uses_split_for_marks:
                # Each input collects all marks for a student in one line
                students_count = input_count or 1
                for student_num in range(students_count):
                    if student_num % 3 == 0:
                        mock_inputs.append("78 82 75")  # Passing
                    elif student_num % 3 == 1:
                        mock_inputs.append("35 42 38")  # Failing
                    else:
                        mock_inputs.append("55 48 52")  # Borderline/pass
            else:
                # For student marks with pass/fail: provide realistic mix of passing and failing marks
                # Typically: 3 subjects per student, need average >= 50 to pass (or total >= 150)
                students_count = input_count // 3 if input_count >= 3 else 1
                
                for student_num in range(students_count):
                    if student_num % 3 == 0:
                        # Passing student with good marks
                        mock_inputs.extend(["78", "82", "75"])
                    elif student_num % 3 == 1:
                        # Failing student with low marks
                        mock_inputs.extend(["35", "42", "38"])
                    else:
                        # Borderline/average student
                        mock_inputs.extend(["55", "48", "52"])
                
                # Fill remaining inputs if any
                while len(mock_inputs) < input_count:
                    mock_inputs.append("60")
                
        elif is_factorial or is_power:
            # Use small numbers for factorial/power operations (5 is safe)
            for i in range(input_count):
                mock_inputs.append("5")
                
        elif is_fibonacci:
            # Use moderate number for fibonacci (10 is reasonable)
            for i in range(input_count):
                mock_inputs.append("10")
                
        elif is_recursive:
            # Use small number for recursive operations
            for i in range(input_count):
                mock_inputs.append("5")
                
        elif is_numeric_reverse:
            # Use numeric values for reversing numbers (like 12345)
            for i in range(input_count):
                mock_inputs.append("12345")
                
        elif is_string_op:
            # Use strings for string operations
            for i in range(input_count):
                if i == 0:
                    mock_inputs.append("hello")
                else:
                    mock_inputs.append("world")
                    
        elif is_matrix:
            # Use small number for matrix dimensions
            for i in range(input_count):
                mock_inputs.append("3")
                
        else:
            # Default values
            for i in range(input_count):
                if i == 0:
                    mock_inputs.append("10")
                elif i == 1:
                    mock_inputs.append("20")
                else:
                    mock_inputs.append(str(5 + (i % 5)))
        
        # Trim to exact count needed
        mock_inputs = mock_inputs[:input_count]
        
        # Safety check: If code uses int(input()), ensure all inputs are numeric
        if uses_int_input:
            for i in range(len(mock_inputs)):
                try:
                    # Try to convert to int to validate
                    int(mock_inputs[i])
                except (ValueError, TypeError):
                    # If not numeric, replace with a safe numeric value
                    mock_inputs[i] = "12345"
        
        # Create wrapper that provides mock inputs
        wrapper = f'''import sys
import builtins

# Mock input function with realistic test data
_input_values = iter([{", ".join([repr(val) for val in mock_inputs])}])

def mock_input(prompt=''):
    try:
        value = next(_input_values)
        # Print prompt with value for realistic output
        joined_prompt = (prompt or "")
        print(joined_prompt + value)
        return value
    except StopIteration:
        # Provide a reasonable default if inputs run out
        fallback_value = "60"
        joined_prompt = (prompt or "")
        print(joined_prompt + fallback_value)
        return fallback_value

# Replace input() with mock
builtins.input = mock_input

# User's code
{code}
'''
        return wrapper
    
    def _detect_python_imports(self, code: str) -> list:
        """Detect Python package imports that need to be installed"""
        import re
        
        # Standard library modules (don't need pip install)
        stdlib_modules = {
            'os', 'sys', 'json', 're', 'datetime', 'time', 'random', 'math',
            'collections', 'itertools', 'functools', 'operator', 'string',
            'array', 'bisect', 'heapq', 'queue', 'copy', 'pickle', 'sqlite3',
            'hashlib', 'hmac', 'secrets', 'uuid', 'base64', 'binascii',
            'struct', 'codecs', 'io', 'pathlib', 'tempfile', 'shutil',
            'glob', 'fnmatch', 'linecache', 'stat', 'filecmp', 'tarfile',
            'zipfile', 'csv', 'configparser', 'netrc', 'xdrlib', 'plistlib',
            'logging', 'getopt', 'argparse', 'getpass', 'curses', 'platform',
            'errno', 'ctypes', 'threading', 'multiprocessing', 'concurrent',
            'subprocess', 'sched', 'queue', 'select', 'selectors', 'asyncio',
            'socket', 'ssl', 'email', 'html', 'http', 'urllib', 'xml',
            'ipaddress', 'audioop', 'aifc', 'sunau', 'wave', 'chunk',
            'colorsys', 'imghdr', 'sndhdr', 'stat', 'fileinput', 'locale',
            'gettext', 'readline', 'rlcompleter', 'cmd', 'shlex', 'tkinter',
            'turtle', 'pydoc', 'doctest', 'unittest', 'test', 'lib2to3',
            'typing', 'dataclasses', 'enum', 'numbers', 'decimal', 'fractions',
            'statistics', 'array', 'weakref', 'types', 'copy', 'pprint',
            'reprlib', 'enum', 'graphlib', 'abc', 'atexit', 'traceback',
            'gc', 'inspect', 'site', 'fpectl', 'warnings', 'contextlib',
            'contextvars', 'asyncio', 'collections', 'heapq', 'bisect',
            'array', 'weakref', 'types', 'copy', 'pprint', 'reprlib'
        }
        
        required_packages = set()
        
        # Match import statements
        import_patterns = [
            r'^import\s+(\w+)',  # import module
            r'^from\s+(\w+)',    # from module import ...
        ]
        
        for line in code.split('\n'):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            for pattern in import_patterns:
                match = re.match(pattern, line)
                if match:
                    module_name = match.group(1).split('.')[0]  # Get root module
                    if module_name not in stdlib_modules:
                        required_packages.add(module_name)
        
        return sorted(list(required_packages))
    
    async def _execute_python_code(
        self,
        code: str,
        filename: Optional[str] = None,
        question_text: Optional[str] = None,
        enable_file_mode: bool = False
    ) -> Tuple[bool, str, str, int, List[Dict[str, str]]]:
        """Execute Python code using subprocess (fallback when Docker unavailable)"""
        temp_dir = None
        temp_file = None
        file_context = None
        
        try:
            # Wrap code to handle input() calls if needed
            wrapped_code = self._wrap_code_for_input(code)
            
            temp_dir = tempfile.mkdtemp(prefix="python_exec_sub_")
            if filename and filename.endswith(".py"):
                py_filename = filename
            elif filename:
                py_filename = f"{filename}.py"
            else:
                py_filename = "main.py"
            temp_file = os.path.join(temp_dir, py_filename)
            
            with open(temp_file, "w", encoding="utf-8") as f:
                f.write(wrapped_code)
            
            if enable_file_mode:
                file_context = self.prepare_sandbox_files(question_text, code, temp_dir)
            
            # Execute with timeout
            process = await asyncio.create_subprocess_exec(
                'python3',
                temp_file,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=temp_dir
            )
            
            try:
                stdout_data, stderr_data = await asyncio.wait_for(
                    process.communicate(),
                    timeout=30.0  # 30 second timeout
                )
                
                output = stdout_data.decode('utf-8') if stdout_data else ""
                errors = stderr_data.decode('utf-8') if stderr_data else ""
                exit_code = process.returncode
                
                # Normalize (crop) output before returning
                output = self.normalize_output(output)
                errors = self.normalize_output(errors) if errors else errors
                
                success = exit_code == 0
                output_files = self.collect_output_files(
                    temp_dir,
                    file_context,
                    skip_files=[py_filename]
                ) if enable_file_mode else []
                return success, output, errors, exit_code, output_files
                
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                return False, "", "Execution timeout (30s limit)", 124, []
                
        except Exception as e:
            return False, "", f"Execution error: {str(e)}", 1, []
        finally:
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                except:
                    pass
    
    def _detect_c_input_requirements(self, code: str) -> List[str]:
        """Detect how many inputs the C code needs from scanf"""
        inputs_needed = []
        
        # Find all scanf calls and count format specifiers
        scanf_pattern = r'scanf\s*\([^)]+\)'
        scanf_matches = re.findall(scanf_pattern, code, re.IGNORECASE)
        
        for match in scanf_matches:
            # Count format specifiers in scanf format string
            # %d, %i, %f, %lf, %c, %s, etc.
            format_specs = re.findall(r'%[diouxXeEfFgGaAcspn%]', match)
            # Count actual input specifiers (exclude %% which is literal %)
            input_count = len([spec for spec in format_specs if spec != '%%'])
            
            # Provide default inputs based on format specifier
            for spec in format_specs:
                if spec == '%%':
                    continue
                elif spec in ['%d', '%i', '%o', '%u', '%x', '%X']:
                    inputs_needed.append("42")  # Integer
                elif spec in ['%f', '%lf', '%e', '%E', '%g', '%G', '%a', '%A']:
                    inputs_needed.append("3.14")  # Float
                elif spec == '%c':
                    inputs_needed.append("A")  # Character
                elif spec == '%s':
                    inputs_needed.append("test")  # String
                else:
                    inputs_needed.append("42")  # Default
        
        # If scanf is used but no matches found, provide defaults
        if not inputs_needed and ('scanf' in code.lower()):
            inputs_needed = ["42", "10"]
        
        return inputs_needed
    
    async def _execute_c_code(self, code: str) -> Tuple[bool, str, str, int]:
        """Execute C/C++ code by compiling and running (auto-detects C++ and uses g++)."""
        temp_c_file = None
        executable_file = None
        
        try:
            # Heuristic: treat as C++ if it uses iostream/cout/cin/std:: or common C++ headers
            lowered = (code or "").lower()
            is_cpp = any(tok in lowered for tok in [
                "#include <iostream>",
                "#include<iostream>",
                "using namespace std",
                "std::",
                "cout",
                "cin",
                "#include <bits/stdc++.h>",
                "#include<bits/stdc++.h>",
            ])

            # Create temporary C/C++ file
            with tempfile.NamedTemporaryFile(
                mode='w',
                suffix='.cpp' if is_cpp else '.c',
                delete=False,
                encoding='utf-8'
            ) as f:
                f.write(code)
                temp_c_file = f.name
            
            # Create executable filename
            executable_file = temp_c_file.replace('.cpp', '').replace('.c', '')
            
            # Compile C code
            compile_process = await asyncio.create_subprocess_exec(
                'g++' if is_cpp else 'gcc',
                temp_c_file,
                '-o',
                executable_file,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            compile_stdout, compile_stderr = await compile_process.communicate()
            
            if compile_process.returncode != 0:
                # Compilation failed
                errors = compile_stderr.decode('utf-8') if compile_stderr else ""
                return False, "", f"Compilation error: {errors}", compile_process.returncode
            
            # Detect if code needs input and prepare input string
            input_values = self._detect_c_input_requirements(code)
            input_data = "\n".join(input_values) + "\n" if input_values else None
            
            # Run the executable with input if needed
            if input_data:
                print(f"Providing input to C program: {input_data.strip()}")
                run_process = await asyncio.create_subprocess_exec(
                    executable_file,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                try:
                    stdout_data, stderr_data = await asyncio.wait_for(
                        run_process.communicate(input=input_data.encode('utf-8')),
                        timeout=30.0  # 30 second timeout
                    )
                except asyncio.TimeoutError:
                    run_process.kill()
                    await run_process.wait()
                    return False, "", "Execution timeout (30s limit)", 124
            else:
                # No input needed
                run_process = await asyncio.create_subprocess_exec(
                    executable_file,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                try:
                    stdout_data, stderr_data = await asyncio.wait_for(
                        run_process.communicate(),
                        timeout=30.0  # 30 second timeout
                    )
                except asyncio.TimeoutError:
                    run_process.kill()
                    await run_process.wait()
                    return False, "", "Execution timeout (30s limit)", 124
            
            output = stdout_data.decode('utf-8') if stdout_data else ""
            errors = stderr_data.decode('utf-8') if stderr_data else ""
            exit_code = run_process.returncode
            
            # Normalize (crop) output before returning
            output = self.normalize_output(output)
            errors = self.normalize_output(errors) if errors else errors
            
            success = exit_code == 0
            return success, output, errors, exit_code
                
        except Exception as e:
            return False, "", f"Execution error: {str(e)}", 1
        finally:
            if temp_c_file and os.path.exists(temp_c_file):
                try:
                    os.unlink(temp_c_file)
                except:
                    pass
            if executable_file and os.path.exists(executable_file):
                try:
                    os.unlink(executable_file)
                except:
                    pass
    
    def _detect_java_input_requirements(self, code: str) -> List[str]:
        """Detect how many inputs the Java code needs from Scanner"""
        inputs_needed = []
        
        # Use regex to find all Scanner method calls (case-insensitive)
        # Find all scanner.nextInt(), scanner.nextDouble(), scanner.nextFloat(), scanner.nextLong(), scanner.nextShort(), scanner.nextByte()
        next_int_pattern = r'scanner\.next(?:Int|Double|Float|Long|Short|Byte)\s*\(\)'
        next_int_matches = re.findall(next_int_pattern, code, re.IGNORECASE)
        next_int_count = len(next_int_matches)
        
        # Find scanner.nextLine() and scanner.next()
        next_line_pattern = r'scanner\.nextLine\s*\(\)'
        next_line_matches = re.findall(next_line_pattern, code, re.IGNORECASE)
        next_line_count = len(next_line_matches)
        
        next_pattern = r'scanner\.next\s*\(\)'
        next_matches = re.findall(next_pattern, code, re.IGNORECASE)
        # Exclude nextLine from next count
        next_count = len([m for m in next_matches if 'nextLine' not in m])
        
        # Provide default integer inputs (use varied values for better testing)
        for i in range(next_int_count):
            # Use different values: 42, 10, 5, 7, 3, etc.
            values = [42, 10, 5, 7, 3, 15, 20, 25, 30]
            value = str(values[i % len(values)])
            inputs_needed.append(value)
        
        # Provide default string inputs
        for i in range(next_line_count + next_count):
            inputs_needed.append("test")
        
        # If Scanner is used but no specific calls found, provide defaults
        if not inputs_needed and ('Scanner' in code or 'scanner' in code):
            # Provide some default inputs (common case: one or two integers)
            inputs_needed = ["42", "10"]
        
        return inputs_needed
    
    async def _execute_java_code(self, code: str) -> Tuple[bool, str, str, int]:
        """Execute Java code by compiling and running"""
        temp_java_file = None
        
        try:
            # Extract class name from code (improved approach)
            class_name = "Main"  # Default fallback
            for line in code.split('\n'):
                line = line.strip()
                if line.startswith('public class') and '{' in line:
                    # Extract class name from "public class ClassName {"
                    parts = line.split()
                    if len(parts) >= 3:
                        class_name = parts[2].split('{')[0].strip()
                        break
                elif line.startswith('class') and '{' in line:
                    # Handle "class ClassName {" without public
                    parts = line.split()
                    if len(parts) >= 2:
                        class_name = parts[1].split('{')[0].strip()
                        break
            
            print(f"Detected Java class name: {class_name}")
            
            # Create temporary Java file with class name as filename
            temp_java_file = os.path.join(tempfile.gettempdir(), f"{class_name}.java")
            with open(temp_java_file, 'w', encoding='utf-8') as f:
                f.write(code)
            
            print(f"Created temporary Java file: {temp_java_file}")
            
            # Compile Java code
            compile_process = await asyncio.create_subprocess_exec(
                'javac',
                temp_java_file,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            compile_stdout, compile_stderr = await compile_process.communicate()
            
            if compile_process.returncode != 0:
                # Compilation failed
                errors = compile_stderr.decode('utf-8') if compile_stderr else ""
                print(f"Java compilation failed: {errors}")
                return False, "", f"Compilation error: {errors}", compile_process.returncode
            
            print(f"Java compilation successful, running class: {class_name}")
            
            # Detect if code needs input and prepare input string
            input_values = self._detect_java_input_requirements(code)
            input_data = "\n".join(input_values) + "\n" if input_values else None
            
            # Run the Java program with input if needed
            java_dir = os.path.dirname(temp_java_file)
            
            if input_data:
                print(f"Providing input to Java program: {input_data.strip()}")
                run_process = await asyncio.create_subprocess_exec(
                    'java',
                    '-cp',
                    java_dir,
                    class_name,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                try:
                    stdout_data, stderr_data = await asyncio.wait_for(
                        run_process.communicate(input=input_data.encode('utf-8')),
                        timeout=30.0  # 30 second timeout
                    )
                except asyncio.TimeoutError:
                    run_process.kill()
                    await run_process.wait()
                    return False, "", "Execution timeout (30s limit)", 124
            else:
                # No input needed
                run_process = await asyncio.create_subprocess_exec(
                    'java',
                    '-cp',
                    java_dir,
                    class_name,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                try:
                    stdout_data, stderr_data = await asyncio.wait_for(
                        run_process.communicate(),
                        timeout=30.0  # 30 second timeout
                    )
                except asyncio.TimeoutError:
                    run_process.kill()
                    await run_process.wait()
                    return False, "", "Execution timeout (30s limit)", 124
            
            output = stdout_data.decode('utf-8') if stdout_data else ""
            errors = stderr_data.decode('utf-8') if stderr_data else ""
            exit_code = run_process.returncode
            
            print(f"Java execution completed with exit code: {exit_code}")
            if errors:
                print(f"Java execution errors: {errors}")
            if output:
                print(f"Java execution output: {output}")
            
            # Normalize (crop) output before returning
            output = self.normalize_output(output)
            errors = self.normalize_output(errors) if errors else errors
            
            success = exit_code == 0
            return success, output, errors, exit_code
                
        except Exception as e:
            return False, "", f"Execution error: {str(e)}", 1
        finally:
            if temp_java_file and os.path.exists(temp_java_file):
                try:
                    os.unlink(temp_java_file)
                except:
                    pass
            # Clean up .class files
            if temp_java_file:
                class_file = temp_java_file.replace('.java', '.class')
                if os.path.exists(class_file):
                    try:
                        os.unlink(class_file)
                    except:
                        pass
    
    async def _mock_execute(self, code: str) -> Tuple[bool, str, str, int]:
        """Mock execution when Docker is not available"""
        try:
            # Simple mock execution
            if "print" in code:
                # Extract print statements for mock output
                import re
                print_matches = re.findall(r'print\s*\(\s*["\'](.*?)["\']', code)
                output = '\n'.join(print_matches) if print_matches else "Mock execution successful"
            else:
                output = "Mock execution successful"
            
            return True, output, "", 0  # exit_code 0 for success
            
        except Exception as e:
            logs = f"Execution error: {str(e)}"
            return False, "", logs, 1
    
    async def _docker_execute(self, code: str) -> Tuple[bool, str, str, int]:
        """Execute code in Docker container"""
        container = None
        temp_file = None
        
        try:
            # Create temporary file with code
            with tempfile.NamedTemporaryFile(
                mode='w', 
                suffix='.py', 
                delete=False,
                encoding='utf-8'
            ) as f:
                f.write(code)
                temp_file = f.name
            
            # Run container with enhanced security settings
            container = self.client.containers.run(
                self.image,
                f"python /code/{os.path.basename(temp_file)}",
                volumes={
                    os.path.dirname(temp_file): {'bind': '/code', 'mode': 'ro'}  # Read-only mount
                },
                mem_limit=settings.MEMORY_LIMIT,
                cpu_period=settings.CPU_PERIOD,
                cpu_quota=settings.CPU_QUOTA,
                network_disabled=True,  # No network access
                read_only=True,  # Read-only root filesystem
                security_opt=['no-new-privileges:true'],  # Prevent privilege escalation
                cap_drop=['ALL'],  # Drop all capabilities
                cap_add=[],  # No additional capabilities
                user='nobody',  # Run as non-root user
                remove=False,
                detach=True,
                stdout=True,
                stderr=True,
                pids_limit=10,  # Limit number of processes
                ulimits=[
                    docker_types.Ulimit(name='nofile', soft=10, hard=10),  # Limit file descriptors
                ]
            )
            
            # Wait for container with timeout
            result = container.wait(timeout=settings.CONTAINER_TIMEOUT)
            exit_code = result['StatusCode']
            
            # Get output
            output = container.logs(stdout=True, stderr=False).decode('utf-8')
            logs = container.logs(stdout=False, stderr=True).decode('utf-8')
            
            # Clean up container
            container.remove()
            
            # Clean up temp file
            if temp_file and os.path.exists(temp_file):
                os.unlink(temp_file)
            
            success = exit_code == 0
            return success, output, logs, exit_code
            
        except docker.errors.ContainerError as e:
            logs = f"Container execution error: {str(e)}"
            return False, "", logs, 1
        except Exception as e:
            logs = f"Execution error: {str(e)}"
            return False, "", logs, 1
        finally:
            # Cleanup
            if container:
                try:
                    container.remove(force=True)
                except:
                    pass
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                except:
                    pass
    
    async def _execute_web_code(self, code: str, language: str) -> Tuple[bool, str, str, int]:
        """
        Execute web code (HTML/React/Node) with appropriate framework
        
        Args:
            code: Code to execute
            language: 'html', 'react', or 'node'
        
        Returns:
            Tuple of (success, output_text, logs, exit_code)
        """
        if language == "html":
            return await self._execute_html_code(code)
        elif language == "react":
            return await self._execute_react_code(code)
        elif language == "node":
            return await self._execute_node_code(code)
        else:
            return False, "", f"Unsupported web language: {language}", 1
    
    async def _execute_html_code(self, code: str) -> Tuple[bool, str, str, int]:
        """Execute HTML/CSS/JS code and capture browser output"""
        temp_html_file = None
        temp_dir = None
        
        try:
            # Create temporary directory for HTML file
            temp_dir = tempfile.mkdtemp(prefix="html_")
            temp_html_file = os.path.join(temp_dir, "index.html")
            
            # Write HTML code to file
            with open(temp_html_file, 'w', encoding='utf-8') as f:
                f.write(code)
            
            print(f"Created temporary HTML file: {temp_html_file}")
            
            # Use Playwright to render and capture output
            console_logs = []
            output_html = ""
            
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                
                # Capture console logs
                page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
                
                # Load the HTML file
                await page.goto(f"file://{temp_html_file}")
                
                # Wait for JavaScript execution (timeout from config)
                await page.wait_for_timeout(settings.WEB_EXECUTION_TIMEOUT_HTML * 1000)
                
                # Get rendered HTML
                output_html = await page.content()
                
                await browser.close()
            
            # Format console logs
            logs = "\n".join(console_logs) if console_logs else ""
            
            print(f"HTML execution completed successfully")
            return True, output_html, logs, 0
            
        except Exception as e:
            print(f"HTML execution error: {str(e)}")
            return False, "", f"HTML execution error: {str(e)}", 1
        finally:
            # Cleanup temporary files
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                except:
                    pass
    
    async def _execute_react_code(self, code: str) -> Tuple[bool, str, str, int]:
        """Execute React code using Vite dev server - wrapper around execute_react_project"""
        
        # Check if this is simple code (not a full React project)
        # Simple code doesn't contain React-specific patterns
        is_simple_code = not (
            'import React' in code or 
            'from "react"' in code or 
            'from \'react\'' in code or
            '<' in code or 
            'export default' in code or
            'ReactDOM' in code or
            'BrowserRouter' in code or
            'react-router' in code or
            'useState' in code or
            'useEffect' in code or
            'className=' in code or
            'jsx' in code.lower()
        )
        
        if is_simple_code:
            # For simple code, just execute it as regular JavaScript
            print(f"[React Code] Detected simple code, executing as JavaScript")
            return await self._execute_node_code(code)
        
        # For full React code, use the properly working execute_react_project method
        print(f"[React Code] Detected React code, delegating to execute_react_project")
        
        # Create a simple project structure with the user's code as App.jsx
        project_files = {
            "src/App.jsx": code,
            "src/App.css": ""  # Empty CSS file
        }
        
        # Use the execute_react_project method which handles all the Docker networking properly
        try:
            success, output, logs, exit_code, screenshots = await self.execute_react_project(
                project_files=project_files,
                routes=["/"],
                job_id=f"simple_{uuid.uuid4().hex[:8]}",
                task_id=f"task_{uuid.uuid4().hex[:8]}",
                username="User"
            )
            
            # For simple single-file React execution, we just return the first route's output
            if screenshots and len(screenshots) > 0:
                # Screenshots contain the rendered HTML, but we want to return it as output
                output_html = output if output else "React app rendered successfully"
            else:
                output_html = output if output else "React app executed"
            
            return success, output_html, logs, exit_code
            
        except Exception as e:
            print(f"[React Code] Error: {str(e)}")
            return False, "", f"React execution error: {str(e)}", 1
    
    async def _execute_node_code(self, code: str) -> Tuple[bool, str, str, int]:
        """Execute Node.js/Express code"""
        temp_dir = None
        container_name = None
        project_id = None
        
        try:
            # Create project directory in the mounted react_temp volume.
            # This is CRITICAL on Windows + Docker Desktop: docker run mounts are resolved on the host,
            # not inside the backend container filesystem.
            base_temp_dir = settings.REACT_TEMP_DIR
            os.makedirs(base_temp_dir, exist_ok=True)

            project_id = uuid.uuid4().hex[:8]
            temp_dir = os.path.join(base_temp_dir, f"node_app_{project_id}")
            os.makedirs(temp_dir, exist_ok=True)

            container_name = f"node_app_{project_id}"

            print(f"[Node Project] Created temp directory: {temp_dir}")
            
            # Ensure node image available
            if not (self._ensure_image("node:18") or self._ensure_image("node:18-slim")):
                return False, "", "Docker image node:18 unavailable", 1

            network_name = self._get_current_container_network()
            port = self._detect_node_listen_port(code)

            # If the user's code binds to localhost/127.0.0.1, other containers can't reach it.
            # Patch to 0.0.0.0 so the backend container can GET the page via Docker network DNS.
            patched_code = re.sub(
                r"(\blisten\s*\(\s*\d+\s*,\s*)(['\"])(localhost|127\.0\.0\.1)\2",
                r'\1"0.0.0.0"',
                code or "",
                flags=re.IGNORECASE,
            )
            
            # Infer npm dependencies from code (supports express + other libs)
            inferred = self._infer_npm_dependencies(
                {"server.js": patched_code},
                base={},
            )

            package_json = {
                "name": "node-app",
                "type": "commonjs",
                "scripts": {
                    "start": "node server.js"
                },
                "dependencies": inferred or {}
            }
            
            with open(os.path.join(temp_dir, "package.json"), "w") as f:
                json.dump(package_json, f, indent=2)
            
            # Write user's server code
            with open(os.path.join(temp_dir, "server.js"), "w") as f:
                f.write(patched_code)
            
            # Compute host path for Docker volume mount (mirrors React runner strategy)
            host_project_root = settings.HOST_PROJECT_ROOT
            host_path = os.path.join(host_project_root, "backend", "react_temp", f"node_app_{project_id}")
            docker_host_path = self._to_docker_desktop_host_path(host_path)

            print(f"[Node Project] Spawning container: {container_name} (port {port})")
            print(f"[Node Project] Host path for mount: {host_path}")
            print(f"[Node Project] Docker volume path: {docker_host_path}")

            async def start_container() -> Tuple[bool, str]:
                install_cmd = "npm install --silent --no-audit --no-fund"
                startup_cmd = f"{install_cmd} && node server.js"
                proc = await asyncio.create_subprocess_exec(
                    "docker", "run", "-d",
                    "--name", container_name,
                    *(["--network", network_name] if network_name else []),
                    "-v", f"{docker_host_path}:/app",
                    "-w", "/app",
                    "--memory=512m",
                    "--cpus=0.5",
                    "node:18",
                    "sh", "-lc", startup_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                _stdout, _stderr = await proc.communicate()
                if proc.returncode != 0:
                    err = (_stderr.decode("utf-8", errors="ignore") if _stderr else "").strip()
                    return False, err or "unknown error"
                return True, ""

            # Try once, and if we see missing-module errors, auto-install and retry once.
            started, start_err = await start_container()
            if not started:
                return False, "", f"Failed to start node container: {start_err}", 1

            # Poll server until it responds (or timeout) — we use / here, but later we will fetch
            # the best matching route (e.g. /set_cookie, /get_cookie) based on detected Express routes.
            url = f"http://{container_name}:{port}/"
            output_html = ""
            logs = ""
            healthy = await self._wait_for_health(url, timeout=settings.WEB_EXECUTION_TIMEOUT_NODE)

            # If not healthy, check logs for missing modules and retry once with those deps added.
            if not healthy:
                try:
                    logs_proc = await asyncio.create_subprocess_exec(
                        "docker", "logs", "--tail", "200", container_name,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                    lout, lerr = await logs_proc.communicate()
                    first_logs = ((lout or b"") + (lerr or b"")).decode("utf-8", errors="ignore")
                    missing_pkgs = self._extract_missing_node_modules(first_logs)
                    if missing_pkgs:
                        # Stop/remove current container before retry
                        try:
                            await asyncio.create_subprocess_exec(
                                "docker", "rm", "-f", container_name,
                                stdout=asyncio.subprocess.DEVNULL,
                                stderr=asyncio.subprocess.DEVNULL,
                            )
                        except Exception:
                            pass
                        # Update package.json with missing deps (use known versions if available)
                        deps = package_json.get("dependencies") or {}
                        for pkg in missing_pkgs:
                            if pkg not in deps:
                                deps[pkg] = inferred.get(pkg, "*")
                        package_json["dependencies"] = deps
                        with open(os.path.join(temp_dir, "package.json"), "w") as f:
                            json.dump(package_json, f, indent=2)

                        started, start_err = await start_container()
                        if not started:
                            return False, "", f"Failed to start node container after installing missing deps: {start_err}", 1
                        healthy = await self._wait_for_health(url, timeout=settings.WEB_EXECUTION_TIMEOUT_NODE)
                except Exception:
                    pass

            if healthy:
                try:
                    detected_routes = self._extract_express_routes(patched_code)
                    get_routes = detected_routes.get("get", [])

                    # Pick a better demo route than "/" when "/" isn't defined (avoids "Cannot GET /").
                    # Cookie labs: hit /set_cookie -> /get_cookie (cookie jar) and optionally /clear_cookie*
                    demo_route = "/" if "/" in get_routes else (get_routes[0] if get_routes else "/")

                    # Prefer cookie demo route if present
                    cookie_set = None
                    cookie_get = None
                    cookie_clear = None
                    for r in get_routes:
                        if r.lower() in ["/set_cookie", "/set-cookie", "/setcookie"]:
                            cookie_set = r
                        if r.lower() in ["/get_cookie", "/get-cookie", "/getcookie"]:
                            cookie_get = r
                        if r.lower() in ["/clear_cookie", "/clear-cookie", "/clearcookie", "/clear_cookie_foo", "/clear-cookie-foo"]:
                            cookie_clear = r
                    # Prefer REST collection endpoints when present (common labs: /students)
                    # This avoids confusing outputs like "curl .../" when the real API is on /students.
                    lower_map = {r.lower(): r for r in get_routes}
                    if "/students" in lower_map:
                        demo_route = lower_map["/students"]
                    elif cookie_get:
                        demo_route = cookie_get

                    base = f"http://{container_name}:{port}"
                    jar = aiohttp.CookieJar()
                    async with aiohttp.ClientSession(cookie_jar=jar) as session:
                        # If cookie demo, set cookie first so /get_cookie returns a value
                        if cookie_set:
                            try:
                                await session.get(base + cookie_set, timeout=aiohttp.ClientTimeout(total=8))
                            except Exception:
                                pass

                        # Fetch the chosen demo route
                        async with session.get(base + demo_route, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                            output_html = await resp.text()
                            logs = f"HTTP {resp.status} {resp.reason} @ {demo_route}"

                        # Optionally clear cookie after demonstrating
                        if cookie_clear:
                            try:
                                await session.get(base + cookie_clear, timeout=aiohttp.ClientTimeout(total=8))
                            except Exception:
                                pass

                    # Add "lab commands" so screenshots and users get the correct curl commands (no more `curl /` confusion)
                    public_base = f"http://localhost:{port}"
                    commands: List[str] = []
                    if cookie_set or cookie_get or cookie_clear:
                        # Cookie flow (curl needs cookie jar)
                        if cookie_set:
                            commands.append(f"curl -i -c cookies.txt {public_base}{cookie_set}")
                        if cookie_get:
                            commands.append(f"curl -i -b cookies.txt {public_base}{cookie_get}")
                        if cookie_clear:
                            commands.append(f"curl -i -b cookies.txt {public_base}{cookie_clear}")
                    else:
                        commands.append(f"curl {public_base}{demo_route}")

                    if commands:
                        output_html = (
                            (output_html or "").rstrip()
                            + "\n\nCommands (run in CMD):\n"
                            + "\n".join(commands)
                            + "\n"
                        )
                except Exception as e:
                    logs = f"Server became reachable but fetching response failed: {e}"
            else:
                logs = f"Server did not become reachable at {url} within {settings.WEB_EXECUTION_TIMEOUT_NODE}s."

            # Attach server logs (very helpful for students)
            try:
                logs_proc = await asyncio.create_subprocess_exec(
                    "docker", "logs", "--tail", "200", container_name,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                lout, lerr = await logs_proc.communicate()
                server_logs = ((lout or b"") + (lerr or b"")).decode("utf-8", errors="ignore").strip()
                if server_logs:
                    logs = (logs + "\n\n--- Server logs ---\n" + server_logs).strip()
            except Exception:
                pass

            # If we couldn't capture a page, still return something meaningful for the UI output panel
            if not output_html:
                output_html = (
                    f"Server started, but no HTTP response was captured.\n"
                    f"Try visiting: {url}\n"
                    f"(If your code binds to localhost, bind to 0.0.0.0 instead.)"
                )

            success = healthy
            return success, output_html, logs, 0 if success else 1
            
        except Exception as e:
            print(f"Node.js execution error: {str(e)}")
            return False, "", f"Node.js execution error: {str(e)}", 1
        finally:
            # Cleanup
            if container_name:
                try:
                    rm_process = await asyncio.create_subprocess_exec(
                        "docker", "rm", "-f", container_name,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                    await asyncio.wait_for(rm_process.wait(), timeout=8.0)
                except:
                    pass
            
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                except:
                    pass
    
    async def execute_react_project(self, project_files: dict, routes: list = None, job_id: str = None, task_id: str = None, username: str = None) -> Tuple[bool, str, str, int, dict]:
        """
        Execute complete React project with multiple files
        
        Args:
            project_files: Dictionary of {filepath: content}
            routes: List of routes to capture screenshots for
            job_id: Job identifier
            task_id: Task identifier
            username: Username for the task
        
        Returns:
            Tuple of (success, output, logs, exit_code, screenshots_by_route)
            screenshots_by_route: {"/": "html1", "/about": "html2", ...}
        """
        temp_dir = None
        container_name = None
        
        try:
            # Create project directory in the mounted react_temp volume
            # This ensures the files are accessible to Docker-in-Docker
            base_temp_dir = settings.REACT_TEMP_DIR
            os.makedirs(base_temp_dir, exist_ok=True)
            
            # Create unique project directory
            project_id = uuid.uuid4().hex[:8]
            temp_dir = os.path.join(base_temp_dir, f"react_spa_{project_id}")
            os.makedirs(temp_dir, exist_ok=True)
            
            container_name = f"react_spa_{project_id}"
            
            print(f"[React Project] Created temp directory: {temp_dir}")
            print(f"[React Project] Project files: {list(project_files.keys())}")
            
            # Find an available port first
            import socket
            import random
            def find_free_port():
                # Use ONLY the safest port range for Windows (50000-60000)
                # This avoids Windows reserved ports and Hyper-V dynamic port allocation
                for attempt in range(100):  # Try 100 times with different ports
                    port = random.randint(50000, 60000)
                    try:
                        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                            s.bind(('', port))
                            s.listen(1)
                            print(f"[React Project] Found free port: {port}")
                            return port
                    except OSError as e:
                        if attempt % 20 == 0:
                            print(f"[React Project] Port {port} unavailable (attempt {attempt}), retrying...")
                        continue
                
                # If we still can't find a port, fail with a clear error
                raise Exception("Could not find an available port in the safe range (50000-60000) after 100 attempts. Please check your Windows Hyper-V port exclusions.")
            
            port = find_free_port()
            print(f"[React Project] Using port: {port}")
            
            # Create full project structure with the determined port
            await self._create_react_project_structure(temp_dir, project_files, port)
            
            # Start Docker container with npm install
            await self._start_react_container(temp_dir, project_id, container_name, port)
            
            # Capture screenshots for all routes
            screenshots = await self._capture_react_routes(routes or ["/"], port, container_name)
            
            print(f"[React Project] Successfully captured {len(screenshots)} routes")
            return True, "All routes captured successfully", "All routes captured successfully", 0, screenshots
            
        except Exception as e:
            print(f"[React Project] Error: {str(e)}")
            return False, f"React project execution failed: {str(e)}", f"React project execution failed: {str(e)}", 1, {}
        finally:
            await self._cleanup_react_project(temp_dir, container_name)
    
    async def _create_react_project_structure(self, temp_dir: str, project_files: dict, port: int = 3001):
        """Write all project files to temp directory"""
        # Create directory structure
        src_dir = os.path.join(temp_dir, "src")
        components_dir = os.path.join(src_dir, "components")
        os.makedirs(components_dir, exist_ok=True)
        
        print(f"[React Project] Creating project structure in {temp_dir}")
        
        # Package.json (supports react-router-dom + inferred deps)
        deps = self._infer_npm_dependencies(
            project_files,
            base={
                "react": "^18.2.0",
                "react-dom": "^18.2.0",
                "react-router-dom": "^6.20.0",
            },
        )

        package_json = {
            "name": "react-spa",
            "type": "module",
            "scripts": {
                "dev": "vite --host 0.0.0.0 --port 3001"
            },
            "dependencies": deps,
            "devDependencies": {
                "vite": "^5.0.0",
                "@vitejs/plugin-react": "^4.2.0"
            },
        }
        package_json_path = os.path.join(temp_dir, "package.json")
        print(f"[React Project] Writing package.json to: {package_json_path}")
        with open(package_json_path, "w") as f:
            json.dump(package_json, f, indent=2)
        print(f"[React Project] package.json written successfully")
        
        # Verify file exists
        if os.path.exists(package_json_path):
            print(f"[React Project] package.json exists: {os.path.getsize(package_json_path)} bytes")
        else:
            print(f"[React Project] ERROR: package.json not created!")
        
        # Vite config - use env var for allowed hosts (more robust)
        vite_config = f"""import {{ defineConfig }} from 'vite'
import react from '@vitejs/plugin-react'

const extra = (process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

export default defineConfig({{
  plugins: [react()],
  server: {{
    host: true,
    port: {port},
    strictPort: true,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      ...extra
    ],
    hmr: {{
      host: process.env.HMR_HOST || undefined,
      clientPort: process.env.HMR_CLIENT_PORT ? Number(process.env.HMR_CLIENT_PORT) : undefined
    }}
  }}
}})
"""
        with open(os.path.join(temp_dir, "vite.config.js"), "w") as f:
            f.write(vite_config)
        
        # Index.html
        index_html = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React SPA Lab</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
"""
        with open(os.path.join(temp_dir, "index.html"), "w") as f:
            f.write(index_html)
        
        # Write all user-provided files
        for filepath, content in project_files.items():
            # Normalize path (remove leading src/ if present since we add it)
            normalized = filepath.replace("src/", "").replace("src\\", "")
            
            # Detect JSX usage in content or explicit .jsx extension
            contains_jsx = False
            try:
                if re.search(r'\bimport\s+React\b', content) or re.search(r'<[A-Za-z]', content):
                    contains_jsx = True
            except Exception:
                contains_jsx = False

            # If the file is App.js, or contains JSX, ensure it uses .jsx extension
            base, ext = os.path.splitext(normalized)
            if normalized == "App.js" or contains_jsx:
                normalized = base + ".jsx"
            
            # Determine full path
            full_path = os.path.join(src_dir, normalized)
            
            # Create parent directories
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            
            # Update import statements to use .jsx extensions for JSX files
            updated_content = content
            if contains_jsx or normalized == "App.jsx":
                # Update imports to use .jsx extensions
                updated_content = re.sub(r"import\s+(\w+)\s+from\s+['\"]\.\/components\/(\w+)['\"]", 
                                       r"import \1 from './components/\2.jsx'", updated_content)
            
            # Write file
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(updated_content)
            print(f"[React Project] Wrote file: {normalized}")
        
        # Create FileExplorer component to show project structure
        file_explorer_path = os.path.join(src_dir, "components", "FileExplorer.js")
        file_explorer_content = """import React from 'react';

function FileExplorer({ files }) {
  return (
    <div style={{ 
      backgroundColor: '#1e1e1e', 
      color: '#d4d4d4', 
      padding: '10px', 
      fontFamily: 'Consolas, monospace',
      fontSize: '12px',
      border: '1px solid #333',
      borderRadius: '4px',
      margin: '10px 0'
    }}>
      <div style={{ color: '#569cd6', marginBottom: '5px' }}>📁 React Project</div>
      <div style={{ marginLeft: '20px' }}>
        <div style={{ color: '#569cd6' }}>📁 src</div>
        <div style={{ marginLeft: '20px' }}>
          {files.map((file, index) => (
            <div key={index} style={{ color: '#9cdcfe' }}>
              📄 {file}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FileExplorer;
"""
        with open(file_explorer_path, "w", encoding="utf-8") as f:
            f.write(file_explorer_content)
        print(f"[React Project] Created FileExplorer component")
        
        # DON'T modify user's App.js - keep it as is
        # The FileExplorer will be added via main.jsx wrapper instead
        print("[React Project] User's App.js kept unchanged")
        
        # Create main.jsx with FileExplorer wrapper
        main_jsx_path = os.path.join(src_dir, "main.jsx")
        
        # Determine the actual App filename and CSS filename after JSX detection
        app_filename = "App.jsx"  # Default
        css_filename = "App.css"   # Default
        
        for filepath, content in project_files.items():
            normalized = filepath.replace("src/", "").replace("src\\", "")
            
            # Check App.js file
            if normalized == "App.js":
                # Check if it contains JSX
                contains_jsx = False
                try:
                    if re.search(r'\bimport\s+React\b', content) or re.search(r'<[A-Za-z]', content):
                        contains_jsx = True
                except Exception:
                    contains_jsx = False
                
                if contains_jsx:
                    app_filename = "App.jsx"
                else:
                    app_filename = "App.js"
            
            # Check for CSS files
            if normalized.endswith('.css'):
                css_filename = normalized
        
        main_jsx_content = f"""import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './{app_filename}'
import './{css_filename}'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
"""
        with open(main_jsx_path, "w") as f:
            f.write(main_jsx_content)
        print("[React Project] Created clean main.jsx")
    
    async def _start_react_container(self, temp_dir: str, project_id: str, container_name: str, port: int):
        """Start React dev server with extended timeout and better error handling"""
        print(f"[React Project] Starting container: {container_name}")
        
        # First, check if container already exists and remove it
        try:
            await asyncio.create_subprocess_exec(
                'docker', 'rm', '-f', container_name,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL
            )
        except:
            pass
        
        
        # Calculate host path for Docker volume mount
        # The temp_dir is /app/react_temp/react_spa_xxx inside the backend container
        # We need to mount the host path: <HOST_PROJECT_ROOT>/backend/react_temp/react_spa_xxx
        host_project_root = settings.HOST_PROJECT_ROOT
        host_path = os.path.join(host_project_root, "backend", "react_temp", f"react_spa_{project_id}")
        
        # Convert Windows paths to Docker-compatible format
        docker_host_path = host_path.replace('\\', '/')
        
        # Check if this is a Windows absolute path (e.g., C:/ or C:\)
        if len(docker_host_path) > 1 and docker_host_path[1] == ':':
            # Convert C:/Users/... to /c/Users/... format for Docker Desktop on Windows
            drive_letter = docker_host_path[0].lower()
            path_without_drive = docker_host_path[2:]  # Remove "C:"
            docker_host_path = f'/{drive_letter}{path_without_drive}'
        
        print(f"[React Project] Container temp dir: {temp_dir}")
        print(f"[React Project] Host path for mount: {host_path}")
        print(f"[React Project] Docker volume path: {docker_host_path}")
        
        # Ensure node image is available
        if not (self._ensure_image("node:18") or self._ensure_image("node:18-slim")):
            raise Exception("Docker image node:18 unavailable")

        # Use the same network as the backend container so Playwright can access http://{container_name}:{port}
        network_name = self._get_current_container_network()
        
        # Start container with volume mount and run npm install + vite directly
        startup_cmd = (
            'echo "=== Starting React project ===" && '
            'echo "Current directory: $(pwd)" && '
            'echo "Files in /app:" && ls -la /app && '
            'echo "=== Testing npm registry connectivity ===" && '
            'timeout 10 npm ping || echo "npm registry unreachable, continuing anyway..." && '
            'echo "=== Installing dependencies (timeout: 60s) ===" && '
            'timeout 60 npm install --no-audit --no-fund --loglevel verbose 2>&1 && '
            'echo "=== Dependencies installed successfully ===" && '
            'echo "=== Starting Vite dev server ===" && '
            f'npx vite --host --port {port} --logLevel info 2>&1'
        )
        
        print(f"[React Project] Starting container with command: {startup_cmd[:100]}...")
        
        process = await asyncio.create_subprocess_exec(
            'docker', 'run', '-d',
            '--name', container_name,
            *(['--network', network_name] if network_name else []),
            '-v', f'{docker_host_path}:/app',
            '-w', '/app',
            '--memory=2g', '--cpus=2',
            '-e', f'__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS={container_name}',
            '-e', f'HMR_HOST={container_name}',
            '-e', f'HMR_CLIENT_PORT={port}',
            'node:18',
            'sh', '-c', 
            startup_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            error_msg = stderr.decode() if stderr else "Unknown error"
            print(f"[React Project] Container start failed: {error_msg}")
            raise Exception(f"Failed to start container: {error_msg}")
        
        container_id = stdout.decode().strip()
        print(f"[React Project] Container started: {container_id}")
        
        # Wait for npm install and Vite startup with better health checks
        print("[React Project] Installing dependencies and starting Vite (this may take 90-120s)...")
        
        # Show initial logs after a short delay
        await asyncio.sleep(2)
        try:
            logs_process = await asyncio.create_subprocess_exec(
                'docker', 'logs', '--tail', '20', container_name,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
            logs_stdout, logs_stderr = await logs_process.communicate()
            initial_logs = (logs_stdout.decode() if logs_stdout else "") + (logs_stderr.decode() if logs_stderr else "")
            if initial_logs.strip():
                print(f"[React Project] Initial container output:\n{initial_logs}")
        except:
            pass
        
        # Check container logs periodically for debugging
        for attempt in range(24):  # 24 attempts * 5 seconds = 120 seconds
            try:
                # Check if container is still running
                check_process = await asyncio.create_subprocess_exec(
                    'docker', 'ps', '--filter', f'name={container_name}', '--format', '{{.Names}}',
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                check_stdout, check_stderr = await check_process.communicate()
                if container_name not in check_stdout.decode():
                    print(f"[React Project] Container {container_name} stopped unexpectedly")
                    # Get logs for debugging
                    logs_process = await asyncio.create_subprocess_exec(
                        'docker', 'logs', container_name,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    logs_stdout, logs_stderr = await logs_process.communicate()
                    logs = logs_stdout.decode() + "\n" + logs_stderr.decode()
                    print(f"[React Project] Container logs:\n{logs}")
                    raise Exception(f"Container stopped unexpectedly. Logs:\n{logs}")
                
                # Try to connect to the server via Docker internal networking
                async with aiohttp.ClientSession() as session:
                    try:
                        async with session.get(f"http://{container_name}:{port}", timeout=aiohttp.ClientTimeout(total=3)) as resp:
                            if resp.status == 200:
                                text = await resp.text()
                                # Basic sanity checks: index served and root exists or vite client present
                                if '<div id="root"' in text or 'vite/client' in text or '/@vite/client' in text:
                                    print(f"[React Project] Vite dev server ready! (Status: 200)")
                                    return  # Server is ready
                                else:
                                    print("Server returned 200 but index doesn't contain expected markers; continuing wait.")
                            else:
                                print(f"[React Project] Server responded with {resp.status}; waiting...")
                    except:
                        pass  # Server not ready yet
                
            except aiohttp.ClientError:
                # Server not ready yet, continue waiting
                pass
            except Exception as e:
                print(f"[React Project] Health check error: {e}")
                # Continue waiting unless it's a critical error
                if "Container stopped" in str(e):
                    raise
            
            # Show progress and logs every 3 attempts (15 seconds)
            if attempt > 0 and attempt % 3 == 0:
                print(f"[React Project] Still waiting... ({attempt+1}/24)")
                # Show recent logs
                try:
                    logs_process = await asyncio.create_subprocess_exec(
                        'docker', 'logs', '--tail', '10', container_name,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    logs_stdout, logs_stderr = await logs_process.communicate()
                    recent_logs = logs_stdout.decode() + logs_stderr.decode()
                    if recent_logs.strip():
                        print(f"[React Project] Recent logs:\n{recent_logs}")
                except:
                    pass
            
            await asyncio.sleep(5)
        
        # Get container logs for debugging
        print("[React Project] Timeout reached. Fetching container logs...")
        try:
            logs_process = await asyncio.create_subprocess_exec(
                'docker', 'logs', '--tail', '100', container_name,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            logs_stdout, logs_stderr = await logs_process.communicate()
            logs = logs_stdout.decode() + "\n" + logs_stderr.decode()
            print(f"[React Project] Container logs (last 100 lines):\n{logs}")
        except Exception as log_error:
            print(f"[React Project] Failed to fetch logs: {log_error}")
        
        raise Exception("React dev server failed to start after 120 seconds")
    
    async def _capture_react_routes(self, routes: list, port: int, container_name: str) -> dict:
        """Capture screenshot of each route"""
        screenshots = {}
        
        print(f"[React Project] Capturing {len(routes)} routes: {routes} on port {port}")
        
        # First, test server accessibility with curl (if available)
        print(f"[React Project] Testing server accessibility...")
        try:
            curl_process = await asyncio.create_subprocess_exec(
                'curl', '-I', f'http://{container_name}:{port}',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            curl_stdout, curl_stderr = await curl_process.communicate()
            curl_output = curl_stdout.decode() + curl_stderr.decode()
            print(f"[React Project] Curl test result:\n{curl_output[:500]}")
        except Exception as curl_error:
            print(f"[React Project] Curl not available, skipping test: {str(curl_error)}")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # Set a longer default timeout
            page.set_default_timeout(60000)  # 60 seconds
            
            # --- NEW: more aggressive logging to debug why modules don't load ---
            # Log all network responses (status + content-type) for debugging
            def _on_response(resp):
                try:
                    url = resp.url
                    status = resp.status
                    # Only print script-relevant resources to keep logs readable
                    if any(x in url for x in ['/@vite/client', '/src/', '.js', '.jsx', '.ts', '.tsx']):
                        ct = resp.headers.get('content-type', '') if hasattr(resp, 'headers') else ''
                        print(f"[React Project] RESP {status} {url} (content-type: {ct})")
                except Exception as e:
                    print(f"[React Project] Response handler error: {e}")

            page.on("response", lambda r: _on_response(r))

            # Log failed requests
            page.on("requestfailed", lambda req: print(f"[React Project] REQ FAILED {req.url} -> {req.failure}"))

            # Keep existing console capture and error capture
            page.on("console", lambda msg: print(f"[Playwright console][{msg.type}] {msg.text}"))

            # Add an init script that writes an inline marker into #root as an immediate test.
            # This runs before any page scripts and will tell us if JS execution is blocked at all.
            inline_test_script = """
            // Inline test script injected by ExecutorService debug mode
            (() => {
              try {
                document.addEventListener('DOMContentLoaded', () => {
                  const root = document.getElementById('root');
                  if (root) {
                    const marker = document.createElement('div');
                    marker.id = '__labmate_inline_debug';
                    marker.textContent = 'INLINE_SCRIPT_RAN';
                    root.appendChild(marker);
                  }
                });
              } catch (e) {
                // ensure exceptions don't block other scripts
                console.error('Inline debug script error', e);
              }
            })();
            """
            await page.add_init_script(inline_test_script)

            # Keep existing JS error capture injection (you already had this)
            await page.expose_function("logError", lambda error: print(f"[React Project] JS Error: {error}"))
            await page.add_init_script("""
                window.jsErrors = [];
                window.consoleLogs = [];
                window.addEventListener('error', (e) => {
                  window.jsErrors.push(e.message + ' at ' + e.filename + ':' + e.lineno);
                });
                const originalLog = console.log;
                const originalError = console.error;
                const originalWarn = console.warn;
                console.log = function(...args) {
                    window.consoleLogs.push('LOG: ' + args.join(' '));
                    originalLog.apply(console, args);
                };
                console.error = function(...args) {
                    window.consoleLogs.push('ERROR: ' + args.join(' '));
                    originalError.apply(console, args);
                };
                console.warn = function(...args) {
                    window.consoleLogs.push('WARN: ' + args.join(' '));
                    originalWarn.apply(console, args);
                };
            """)
            # --- END NEW DEBUGGING INSTRUMENTATION ---
            
            for route in routes:
                try:
                    url = f"http://{container_name}:{port}{route}"
                    print(f"[React Project] Navigating to: {url}")
                    
                    # Navigate to the route with longer timeout
                    try:
                        await page.goto(url, timeout=60000, wait_until="load")
                        print(f"[React Project] Page loaded for {route}")
                    except Exception as nav_error:
                        print(f"[React Project] Navigation error for {route}: {str(nav_error)}")
                        raise
                    
                    # CRITICAL: Wait for Vite to compile and send modules, then for React to execute
                    # Vite uses ES modules which load asynchronously
                    print(f"[React Project] Waiting for Vite modules to load and execute...")
                    
                    # Strategy: Wait for the main.jsx script to actually execute
                    # We'll check multiple conditions to ensure React is ready
                    max_wait = 30  # 30 seconds total
                    for attempt in range(max_wait):
                        await page.wait_for_timeout(1000)  # Wait 1 second
                        
                        # Check if React has mounted (root has children)
                        root_children = await page.evaluate("() => document.getElementById('root')?.children.length || 0")
                        if root_children > 0:
                            print(f"[React Project] ✓ React mounted successfully after {attempt + 1} seconds for {route}")
                            break
                        
                        # Check if scripts are executing (React/ReactDOM loaded)
                        react_loaded = await page.evaluate("() => typeof window.React !== 'undefined'")
                        react_dom_loaded = await page.evaluate("() => typeof window.ReactDOM !== 'undefined'")
                        
                        if attempt % 5 == 0:  # Log every 5 seconds
                            print(f"[React Project] Still waiting for React ({attempt + 1}s)... Root children: {root_children}, React loaded: {react_loaded}, ReactDOM loaded: {react_dom_loaded}")
                        
                        if attempt == max_wait - 1:
                            print(f"[React Project] ⚠ React did not mount after {max_wait} seconds for {route}")
                    
                    # Give one final moment for any last renders
                    await page.wait_for_timeout(2000)
                    
                    # Debug: Check what's actually rendered
                    try:
                        page_title = await page.title()
                        body_text = await page.evaluate("() => document.body.innerText")
                        root_element = await page.evaluate("() => document.getElementById('root')")
                        root_content = await page.evaluate("() => document.getElementById('root')?.innerHTML || 'No root element'")
                        h1_content = await page.evaluate("() => document.querySelector('h1')?.textContent || 'No h1 found'")
                        
                        # Check if root element exists
                        root_exists = root_element is not None
                        
                        print(f"[React Project] Route {route} - Title: '{page_title}'")
                        print(f"[React Project] Route {route} - Root element exists: {root_exists}")
                        print(f"[React Project] Route {route} - Body preview: {body_text[:200] if body_text else 'Empty'}...")
                        print(f"[React Project] Route {route} - Root content: {root_content[:200] if root_content else 'Empty'}...")
                        print(f"[React Project] Route {route} - H1 content: '{h1_content}'")
                        
                        # Check for inline debug marker (indicates JS execution is working)
                        inline_marker = await page.evaluate("() => document.getElementById('__labmate_inline_debug')?.textContent || 'NOT_FOUND'")
                        print(f"[React Project] Route {route} - Inline marker: '{inline_marker}'")
                        
                        # Check for JavaScript errors
                        js_errors = await page.evaluate("() => window.jsErrors || []")
                        if js_errors:
                            print(f"[React Project] Route {route} - JS Errors: {js_errors}")
                        
                        # Check console errors
                        console_logs = await page.evaluate("() => window.consoleLogs || []")
                        if console_logs:
                            print(f"[React Project] Route {route} - Console logs: {console_logs}")
                        
                        # Check if React scripts loaded
                        scripts = await page.evaluate("() => Array.from(document.scripts).map(s => s.src)")
                        print(f"[React Project] Route {route} - Scripts loaded: {scripts}")
                        
                        # Check if React is actually loaded
                        react_loaded = await page.evaluate("() => typeof window.React !== 'undefined'")
                        react_dom_loaded = await page.evaluate("() => typeof window.ReactDOM !== 'undefined'")
                        print(f"[React Project] Route {route} - React loaded: {react_loaded}")
                        print(f"[React Project] Route {route} - ReactDOM loaded: {react_dom_loaded}")
                        
                        # Check if there are any elements in the root
                        root_children = await page.evaluate("() => document.getElementById('root')?.children.length || 0")
                        print(f"[React Project] Route {route} - Root children count: {root_children}")
                        
                        # Check if there are any React components mounted
                        react_fiber = await page.evaluate("() => document.getElementById('root')?._reactInternalFiber || document.getElementById('root')?._reactInternalInstance")
                        print(f"[React Project] Route {route} - React fiber exists: {react_fiber is not None}")
                        
                        # Check the actual HTML content of the root
                        root_html = await page.evaluate("() => document.getElementById('root')?.outerHTML || 'No root element'")
                        print(f"[React Project] Route {route} - Root HTML: {root_html[:500]}...")
                        
                        # Check if there are any script execution errors
                        script_errors = await page.evaluate("""
                            () => {
                                const scripts = Array.from(document.scripts);
                                const errors = [];
                                scripts.forEach((script, index) => {
                                    if (script.src && !script.src.includes('@vite/client')) {
                                        // Check if script failed to load
                                        if (!script.textContent && !script.src.includes('main.jsx')) {
                                            errors.push(`Script ${index} (${script.src}) may have failed to load`);
                                        }
                                    }
                                });
                                return errors;
                            }
                        """)
                        if script_errors:
                            print(f"[React Project] Route {route} - Script errors: {script_errors}")
                        
                        # Check if the main.jsx script is actually executing
                        main_script_executed = await page.evaluate("""
                            () => {
                                // Check if ReactDOM.createRoot was called
                                return window.ReactDOM && window.ReactDOM.createRoot;
                            }
                        """)
                        print(f"[React Project] Route {route} - ReactDOM.createRoot available: {main_script_executed}")
                        
                        # Check if there are any network errors
                        network_errors = await page.evaluate("""
                            () => {
                                const scripts = Array.from(document.scripts);
                                return scripts.filter(s => s.src).map(s => ({
                                    src: s.src,
                                    loaded: s.readyState === 'complete' || s.readyState === 'loaded'
                                }));
                            }
                        """)
                        print(f"[React Project] Route {route} - Script loading status: {network_errors}")
                            
                    except Exception as debug_error:
                        print(f"[React Project] Debug error for {route}: {str(debug_error)}")
                    
                    # Get the HTML content
                    html_content = await page.content()
                    screenshots[route] = html_content
                    print(f"[React Project] ✓ Successfully captured route: {route}")
                    
                except Exception as e:
                    print(f"[React Project] ✗ Failed to capture {route}: {str(e)}")
                    import traceback
                    print(f"[React Project] Traceback: {traceback.format_exc()}")
                    screenshots[route] = f"Error capturing route: {str(e)}"
            
            await browser.close()
        
        return screenshots
    
    async def _cleanup_react_project(self, temp_dir: str, container_name: str):
        """Clean up temporary files and containers"""
        print("[React Project] Cleaning up...")
        
        # Stop and remove container
        if container_name:
            try:
                stop_process = await asyncio.create_subprocess_exec(
                    'docker', 'stop', container_name,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await asyncio.wait_for(stop_process.wait(), timeout=5.0)
                print(f"[React Project] Stopped container: {container_name}")
            except Exception as e:
                print(f"[React Project] Failed to stop container: {str(e)}")
        
        # Remove temporary directory
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
                print(f"[React Project] Removed temp directory: {temp_dir}")
            except Exception as e:
                print(f"[React Project] Failed to remove temp directory: {str(e)}")


# Create singleton instance
executor_service = ExecutorService()
