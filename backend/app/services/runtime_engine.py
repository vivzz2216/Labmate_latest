"""Isolated workspaces, bounded processes, stdin feeding, and real browser captures."""

import asyncio
import ast
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

import httpx
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.async_api import async_playwright

try:
    import resource
except ImportError:
    resource = None

from ..config import settings
from .browser_capture import acquire_capture_context, launch_capture_browser
from .resource_budget import heavy_execution_budget


@dataclass
class RuntimeResult:
    success: bool
    output: str = ""
    error: str = ""
    exit_code: int = 0
    files: list = field(default_factory=list)
    screenshots: dict = field(default_factory=dict)
    verification: dict | None = None
    stages: dict = field(default_factory=dict)
    timings: dict = field(default_factory=dict)


def runtime_environment(directory: Path, extras=None):
    # Model keys, database credentials, and auth secrets never enter student processes.
    allowed = {"PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "JAVA_HOME", "LANG", "LC_ALL"}
    environment = {key: value for key, value in os.environ.items() if key.upper() in allowed}
    tool_directories = [str(Path(value).parent) for value in (settings.JAVA_COMMAND, settings.JAVAC_COMMAND, settings.C_COMPILER, settings.CPP_COMPILER) if Path(value).is_absolute()]
    environment["PATH"] = os.pathsep.join(tool_directories + [environment.get("PATH", "")])
    environment.update({"TMP": str(directory), "TEMP": str(directory), "TMPDIR": str(directory), "PYTHONIOENCODING": "utf-8"})
    environment['HOME'] = str(directory)
    environment.update(extras or {})
    return environment


async def kill_process_tree(process):
    if process.returncode is not None:
        return
    if os.name == "nt":
        killer = await asyncio.create_subprocess_exec("taskkill", "/PID", str(process.pid), "/T", "/F", stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
        await killer.wait()
    else:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    if process.returncode is None:
        try:
            process.kill()
        except ProcessLookupError:
            pass
    await process.wait()


def make_resource_limiter(resource_limits=None):
    limits = resource_limits or {}
    max_mem = limits.get("max_memory_bytes", 512 * 1024 * 1024)
    max_cpu = limits.get("max_cpu_seconds", 15)
    max_fsize = limits.get("max_filesize_bytes", 20 * 1024 * 1024)
    max_procs = limits.get("max_procs", 64)

    def preexec():
        if hasattr(os, "setsid"):
            try:
                os.setsid()
            except Exception:
                pass

        if resource is None:
            return

        try:
            if max_mem and hasattr(resource, "RLIMIT_AS"):
                resource.setrlimit(resource.RLIMIT_AS, (max_mem, max_mem))
            if max_cpu and hasattr(resource, "RLIMIT_CPU"):
                resource.setrlimit(resource.RLIMIT_CPU, (max_cpu, max_cpu + 5))
            if max_fsize and hasattr(resource, "RLIMIT_FSIZE"):
                resource.setrlimit(resource.RLIMIT_FSIZE, (max_fsize, max_fsize))
            if hasattr(resource, "RLIMIT_CORE"):
                resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
            if max_procs and hasattr(resource, "RLIMIT_NPROC"):
                resource.setrlimit(resource.RLIMIT_NPROC, (max_procs, max_procs))
        except Exception:
            pass

    return preexec


async def start_process(command, directory, extras=None, resource_limits=None, desktop=None):
    from .isolated_runtime import require_worker
    require_worker()
    if os.name == "nt":
        options = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
        if desktop:
            startup=subprocess.STARTUPINFO();startup.lpDesktop=desktop
            options.update(startupinfo=startup,creationflags=subprocess.CREATE_NEW_PROCESS_GROUP|subprocess.CREATE_NO_WINDOW)
    else:
        options = {"preexec_fn": make_resource_limiter(resource_limits)}
    return await asyncio.create_subprocess_exec(*map(str, command), cwd=str(directory), env=runtime_environment(directory, extras),
                                               stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, **options)


async def collect_output(stream, process):
    data = bytearray()
    while True:
        chunk = await stream.read(8192)
        if not chunk:
            break
        if len(data) + len(chunk) > settings.EXECUTION_MAX_OUTPUT_BYTES:
            await kill_process_tree(process)
            data.extend(chunk[:max(0, settings.EXECUTION_MAX_OUTPUT_BYTES - len(data))])
            return data.decode("utf-8", errors="replace"), True
        data.extend(chunk)
    return data.decode("utf-8", errors="replace"), False


async def run_process(command, directory, stdin="", timeout=None, extras=None, resource_limits=None, desktop=None):
    from .isolated_runtime import require_worker
    require_worker()
    started = time.perf_counter()
    try:
        process = await start_process(command, directory, extras, resource_limits=resource_limits,desktop=desktop)
    except FileNotFoundError:
        return RuntimeResult(False, error=f"Required runtime is not installed: {Path(str(command[0])).name}", exit_code=127)
    out = asyncio.create_task(collect_output(process.stdout, process))
    err = asyncio.create_task(collect_output(process.stderr, process))
    try:
        if stdin:
            process.stdin.write(stdin.encode("utf-8"))
            await process.stdin.drain()
        process.stdin.close()
        await asyncio.wait_for(process.wait(), timeout=timeout or settings.EXECUTION_TIMEOUT)
        stdout, out_limit = await out
        stderr, err_limit = await err
        if out_limit or err_limit:
            return RuntimeResult(False, stdout, stderr + "\nOutput limit exceeded.", 125)

        # Check for kernel resource signals
        if process.returncode in (-24, 152):
            stderr = (stderr + "\nExecution error: CPU time limit exceeded.").strip()
        elif process.returncode in (-9, 137):
            stderr = (stderr + "\nExecution error: Memory limit exceeded.").strip()
        elif process.returncode in (-11, 139) and not stderr:
            stderr = "Execution error: Segmentation fault (memory limit exceeded or invalid memory access)."

        return RuntimeResult(process.returncode == 0, stdout, stderr, process.returncode,
                             timings={"process_seconds": round(time.perf_counter() - started, 6)})
    except (asyncio.TimeoutError, BrokenPipeError, ConnectionResetError):
        await kill_process_tree(process)
        stdout, _ = await out
        stderr, _ = await err
        return RuntimeResult(False, stdout, stderr + "\nExecution timeout or closed input stream.", 124)
    except BaseException:
        await kill_process_tree(process)
        raise
    finally:
        await kill_process_tree(process)
        for task in (out, err):
            if not task.done():
                task.cancel()
        await asyncio.gather(out, err, return_exceptions=True)


def detect_cpp(code: str, language="c", filename=None):
    return language in {"cpp", "c++"} or bool(filename and filename.endswith((".cpp", ".cc", ".cxx"))) or bool(re.search(r"#\s*include\s*[<\"](?:iostream|vector|string|bits/stdc\+\+\.h)\s*[>\"]|\bstd::|\b(?:cout|cin)\s*[<>]{2}", code))


def java_stdin(code):
    calls = re.findall(r"\b\w+\s*\.\s*next(Int|Double|Float|Long|Short|Byte|Boolean|Line|)\s*\(\s*\)", code)
    values = []
    previous_numeric = False
    for kind in calls:
        if kind == "Line" and previous_numeric:
            previous_numeric = False  # consumes the newline left by nextInt/nextDouble
            continue
        values.append("true" if kind == "Boolean" else "sample" if kind in {"", "Line"} else "5")
        previous_numeric = kind not in {"", "Line", "Boolean"}
    return "\n".join(values) + ("\n" if values else "")


def java_class_name(code):
    stripped = re.sub(r'//[^\n]*|/\*.*?\*/|"(?:\\.|[^"\\])*"', '', code, flags=re.S)
    match = re.search(r"\bpublic\s+(?:(?:final|abstract)\s+)?(?:class|record|enum)\s+([\w$]+)", stripped)
    match = match or re.search(r"\bclass\s+([\w$]+)", stripped)
    return match.group(1) if match else None


def c_stdin(code):
    values = []
    for spec in re.findall(r"(?<!%)%(?:\d+)?(?:l[lf]?|h[hd]?)?([diufegcs])", "\n".join(re.findall(r"scanf\s*\(\s*\"([^\"]+)\"", code))):
        values.append("sample" if spec == "s" else "a" if spec == "c" else "5")
    # C++ extraction operators are consumed in source order.
    if not values:
        for statement in re.findall(r"\bcin\s*>>([^;]+);", code):
            values.extend("5" for _ in re.findall(r"\b[A-Za-z_]\w*\b", statement))
    return "\n".join(values) + ("\n" if values else "")


def python_stdin(code):
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return ""
    calls = sorted((node for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "input"), key=lambda node: (node.lineno, node.col_offset))
    lines = code.splitlines()
    values = ["5" if 0 <= node.lineno - 1 < len(lines) and re.search(r"\b(?:int|float)\s*\(", lines[node.lineno - 1]) else "sample" for node in calls]
    return "\n".join(values * 16) + ("\n" if values else "")


# This trusted launcher echoes the exact input consumed by the program. A pipe
# does not echo keystrokes, so screenshots otherwise have no verifiable inputs.
# Keep the launcher outside the student's source and working directory.
PYTHON_INPUT_ECHO_RUNNER = (
    "import builtins, runpy, sys\n"
    "_original_input = builtins.input\n"
    "def _visible_input(prompt=''):\n"
    "    value = _original_input(prompt)\n"
    "    print(value, flush=True)\n"
    "    return value\n"
    "builtins.input = _visible_input\n"
    "runpy.run_path(sys.argv[1], run_name='__main__')\n"
)

_BROWSER_TEST_ROLES = {"button", "textbox", "spinbutton", "checkbox", "radio", "combobox", "link"}
_HTML_INTERACTION_SECONDS = 20
_HTML_CAPTURE_SECONDS = 40

# Fixed application code, never a script supplied in the generated test plan.
_VISIBLE_PAGE_TEXT = """() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const text = [];
    let node, size = 0, visited = 0;
    while ((node = walker.nextNode()) && ++visited < 20000 && size < 8000) {
        let element = node.parentElement, visible = !!element;
        if (element?.closest('script,style,noscript,template')) continue;
        while (element && visible) {
            const style = getComputedStyle(element);
            visible = style.display !== 'none' && style.visibility !== 'hidden'
                && style.visibility !== 'collapse' && Number(style.opacity) !== 0;
            element = element.parentElement;
        }
        if (visible && node.parentElement.getClientRects().length) {
            const value = node.textContent.replace(/\\s+/g, ' ').trim();
            if (value) { text.push(value); size += value.length; }
        }
    }
    return text.join(' ').slice(0, 8000);
}"""


def normalize_browser_tests(browser_tests):
    """Accept only small, declarative browser actions; never execute model-authored test code."""
    if isinstance(browser_tests, list) and any(isinstance(t, dict) and t.get('version') == 2 for t in browser_tests):
        from .browser_scenarios import normalize_v2
        try:
            return normalize_v2(browser_tests), None
        except (ValueError, TypeError, KeyError) as error:
            return [], str(error)
    if browser_tests is None:
        return [], None
    if not isinstance(browser_tests, list) or len(browser_tests) > 3:
        return [], "The browser test plan must contain no more than three scenarios."
    normalized = []
    for test_index, test in enumerate(browser_tests, 1):
        if not isinstance(test, dict) or not {"name", "actions", "expected_text"}.issubset(test) or set(test) - {"name", "actions", "expected_text", "viewport"}:
            return [], f"Browser test {test_index} has an invalid structure."
        name, actions, expected = test["name"], test["actions"], test["expected_text"]
        if not isinstance(name, str) or not name.strip() or len(name) > 120:
            return [], f"Browser test {test_index} needs a short name."
        if not isinstance(actions, list) or not 1 <= len(actions) <= 8:
            return [], f"Browser test {test_index} must contain between one and eight actions."
        if not isinstance(expected, list) or not 1 <= len(expected) <= 6 or any(
                not isinstance(value, str) or not value.strip() or len(value) > 300 for value in expected):
            return [], f"Browser test {test_index} needs one to six expected visible text values."
        safe_actions = []
        for step_index, action in enumerate(actions, 1):
            if not isinstance(action, dict) or set(action) != {
                    "action", "locator_type", "locator", "role", "value"}:
                return [], f"Browser test {test_index}, step {step_index} has an invalid structure."
            if not isinstance(action["action"], str) or action["action"] not in {"fill", "click"}:
                return [], f"Browser test {test_index}, step {step_index} uses an unsupported action."
            if not isinstance(action["locator_type"], str) or action["locator_type"] not in {"role", "label", "placeholder"}:
                return [], f"Browser test {test_index}, step {step_index} uses an unsupported locator."
            locator = action["locator"]
            role = action["role"]
            value = action["value"]
            if not isinstance(locator, str) or not locator.strip() or len(locator) > 120:
                return [], f"Browser test {test_index}, step {step_index} needs a short locator."
            if not isinstance(role, str) or len(role) > 40:
                return [], f"Browser test {test_index}, step {step_index} has an invalid role."
            if action["locator_type"] == "role" and role not in _BROWSER_TEST_ROLES:
                return [], f"Browser test {test_index}, step {step_index} uses an unsupported accessible role."
            if action["locator_type"] != "role" and role:
                return [], f"Browser test {test_index}, step {step_index} must leave role empty for this locator."
            if not isinstance(value, str) or len(value) > 200:
                return [], f"Browser test {test_index}, step {step_index} has an invalid input value."
            if action["action"] == "click" and value:
                return [], f"Browser test {test_index}, step {step_index} must not include a click value."
            safe_actions.append({"action": action["action"], "locator_type": action["locator_type"],
                                 "locator": locator.strip(), "role": role, "value": value})
        viewport = test.get("viewport", {"width": 1366, "height": 768})
        if not isinstance(viewport, dict) or set(viewport) != {"width", "height"} or any(
                type(viewport[k]) is not int or not 240 <= viewport[k] <= 1920 for k in viewport):
            return [], f"Browser test {test_index} has an invalid viewport."
        normalized.append({"name": name.strip(), "actions": safe_actions,
                           "expected_text": [value.strip() for value in expected], "viewport": viewport})
    return normalized, None


def browser_test_locator(page, action):
    if action["locator_type"] == "role":
        return page.get_by_role(action["role"], name=action["locator"], exact=False)
    if action["locator_type"] == "label":
        return page.get_by_label(action["locator"], exact=False)
    return page.get_by_placeholder(action["locator"], exact=False)


def expected_text_is_visible(body_text, expected):
    if re.fullmatch(r"-?\d+(?:\.\d+)?", expected):
        return bool(re.search(rf"(?<![\w.+-]){re.escape(expected)}(?![\w.])", body_text))
    return expected in body_text


def write_project_files(directory, project_files):
    if not isinstance(project_files, dict) or len(project_files) > 100 or sum(len(str(value)) for value in project_files.values()) > 1000000:
        raise ValueError("Project exceeds supported file limits.")
    for name, content in project_files.items():
        if not isinstance(name, str) or not name or not isinstance(content, str):
            raise ValueError("Project files must have string filenames and text contents.")
        target = (directory / name).resolve()
        if directory.resolve() not in target.parents or "node_modules" in Path(name).parts or "\\" in name:
            raise ValueError("Project filenames must stay inside the workspace.")
        if name in {"package.json", "package-lock.json"} or re.search(r"(?:^|/)vite\.config\.", name):
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(str(content), encoding="utf-8")


class RuntimeEngine:
    def __init__(self):
        self._package_locks = {}

    async def execute(self, code, language="python", filename=None, stdin=None, project_files=None, routes=None,
                      prepare_files=None, collect_files=None, browser_tests=None, interaction_is_required=False,
                      objective="", api_tests=None, project_config=None):
        language = {'c++':'cpp', 'javascript':'node', 'webdev':'html', 'mysql':'sql', 'ipynb':'colab'}.get(language.lower(), language.lower())
        if language not in {'python', 'java', 'c', 'cpp', 'html', 'react', 'node', 'sql', 'colab'}:
            return RuntimeResult(False, error='Unsupported execution language.', exit_code=2)
        async with heavy_execution_budget.slot():
            from .isolated_runtime import isolation_required, execute_isolated
            from .evidence_planner import plan_experiment
            # SQL uses a disposable database/schema and restricted per-run account.
            category = plan_experiment(objective, language, code).get('category')
            if isolation_required() and category != 'database':
                return await execute_isolated(code=code, language=language, filename=filename, stdin=stdin,
                    project_files=project_files, routes=routes, browser_tests=browser_tests,
                    interaction_is_required=interaction_is_required, objective=objective, api_tests=api_tests,
                    project_config=project_config, file_mode=bool(prepare_files or collect_files))
            return await self._execute_direct(
                code, language=language, filename=filename, stdin=stdin, project_files=project_files, routes=routes,
                prepare_files=prepare_files, collect_files=collect_files, browser_tests=browser_tests,
                interaction_is_required=interaction_is_required, objective=objective, api_tests=api_tests,
                project_config=project_config
            )

    async def _execute_direct(self, code, language="python", filename=None, stdin=None, project_files=None, routes=None,
                             prepare_files=None, collect_files=None, browser_tests=None, interaction_is_required=False,
                             objective="", api_tests=None, project_config=None):
        language = {"c++": "cpp", "javascript": "node", "webdev": "html", "mysql":"sql", "ipynb":"colab"}.get(language.lower(), language.lower())
        if language not in {"python", "java", "c", "cpp", "html", "react", "node", "sql", "colab"}:
            return RuntimeResult(False, error="Unsupported execution language.", exit_code=2)
        from .evidence_planner import plan_experiment
        capability = plan_experiment(objective, language, code)
        if capability['category']=='database':
            from .lab_capture import capture_sql
            return await capture_sql(code, filename=filename, objective=objective)
        if capability['category']=='notebook':
            # Native process restrictions are defense in depth, not an OS sandbox.
            if not settings.EXECUTION_ALLOWED_EMAILS.strip():
                return RuntimeResult(False,error='Notebook execution requires an explicit beta execution allowlist.',exit_code=126)
            from .lab_capture import capture_notebook
            cfg = project_config or {}
            return await capture_notebook(code, datasets=cfg.get('datasets'), exp_no=cfg.get('exp_no', '01'), student_name=cfg.get('student_name', 'Student'), subject=cfg.get('subject', 'DSLab'), notebook_title=cfg.get('notebook_title'),theme=cfg.get('colab_theme','dark'),source_filename=filename or 'notebook.py')
        if not capability["supported"]:
            return RuntimeResult(False, error=f"Unsupported capability: {capability['category']} requires an isolated display/server adapter and genuine capture support; it was not executed.",
                                 exit_code=69, stages={"execution": "not_run", "capability": capability["category"]})

        from .isolated_runtime import require_worker
        require_worker()

        # Universal static security policy check across all supported languages
        from ..security.generated_code import validate_generated_code
        try:
            is_flask=(project_config or {}).get('project_type')=='flask'
            modules={Path(n).stem for n in (project_files or {}) if n.endswith('.py')} if is_flask else set()
            validate_generated_code(code, language,capability='flask' if is_flask else None,local_modules=modules)
            for name, content in (project_files or {}).items():
                if is_flask and name.endswith('.py'):validate_generated_code(content,'python',capability='flask',local_modules=modules)
                if name.endswith(('.js', '.jsx', '.cjs', '.mjs', '.html')):
                    backend_entry = (project_config or {}).get('server_entrypoint') or ((project_config or {}).get('entrypoint') if (project_config or {}).get('project_type') == 'node' else None)
                    validate_generated_code(content, 'node' if name == backend_entry or name.endswith(('.cjs', '.mjs')) else 'html' if name.endswith('.html') else 'react')
        except (ValueError, SyntaxError) as val_err:
            return RuntimeResult(False, error=f"Security policy violation: {str(val_err)}", exit_code=126)

        root = Path(settings.REACT_TEMP_DIR).resolve()
        root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="labmate_", dir=root) as folder:
            directory = Path(folder)
            if capability['category'] in {'java_awt','java_swing'}:
                from .java_gui_runtime import capture_java_gui
                config=dict(project_config or {'project_files':{(java_class_name(code) or 'Main')+'.java':code},'entrypoint':(java_class_name(code) or 'Main')+'.java','gui_tests':browser_tests or []})
                from .web_project import web_requirements
                config.setdefault('requirements',web_requirements(objective,'java'))
                return await capture_java_gui(directory,config)
            if project_config and project_config.get('project_type')=='flask':
                from .flask_runtime import capture_flask
                return await capture_flask(self,directory,project_config)
            if project_config and project_config.get('entrypoint'):
                from .web_runtime import capture_project
                return await capture_project(self, directory, project_config)
            if language == "python":
                name = Path(filename or "solution.py").name
                if not name.endswith(".py"):
                    name += ".py"
                source = directory / name
                source.write_text(code, encoding="utf-8")
                context = prepare_files(directory) if prepare_files else None
                inputs = python_stdin(code) if stdin is None else stdin
                docker = shutil.which("docker") if settings.USE_DOCKER else None
                docker_ready = False
                if docker:
                    probe = await run_process([docker, "version", "--format", "{{.Server.Version}}"], directory, timeout=3)
                    docker_ready = probe.success
                if docker_ready:
                    container = "labmate_python_" + uuid.uuid4().hex
                    mount = str(directory)
                    if Path("/.dockerenv").exists() and settings.HOST_PROJECT_ROOT:
                        mount = str(Path(settings.HOST_PROJECT_ROOT) / "backend" / "react_temp" / directory.name)
                    command = [docker, "run", "--rm", "-i", "--name", container, "--network", "none", "--memory", settings.MEMORY_LIMIT,
                               "--cpus", "0.5", "--pids-limit", "64", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true",
                               "--tmpfs", "/tmp:rw,size=64m", "--mount", f"type=bind,source={mount},target=/workspace", "--workdir", "/workspace",
                               settings.DOCKER_IMAGE, "python", "-I", "-u", "-c", PYTHON_INPUT_ECHO_RUNNER, name]
                    try:
                        result = await run_process(command, directory, inputs)
                    finally:
                        await run_process([docker, "rm", "-f", container], directory, timeout=10)
                else:
                    # Restricted local fallback has no credential environment, an isolated cwd, and kernel resource bounds.
                    limits = {"max_memory_bytes": 512 * 1024 * 1024, "max_cpu_seconds": 15}
                    result = await run_process([sys.executable, "-I", "-u", "-c", PYTHON_INPUT_ECHO_RUNNER, source], directory, inputs, resource_limits=limits)
                if collect_files:
                    result.files = collect_files(directory, context, name)
                return result
            if language == "java":
                name = java_class_name(code)
                if not name:
                    return RuntimeResult(False, error="Java source must declare a class.", exit_code=2)
                source = directory / f"{name}.java"
                source.write_text(code, encoding="utf-8")
                # JVMs reserve large virtual address ranges; RLIMIT_AS can stop
                # them before startup. Bound their heap explicitly instead.
                compiled = await run_process([settings.JAVAC_COMMAND, "-J-Xmx256m", "-encoding", "UTF-8", "-d", directory, source], directory,
                                             timeout=settings.COMPILATION_TIMEOUT, resource_limits={"max_memory_bytes": 0, "max_cpu_seconds": min(45, settings.COMPILATION_TIMEOUT)})
                if not compiled.success:
                    compiled.error = "Compilation error: " + compiled.error
                    compiled.stages = {"compile": "failed", "execution": "not_run"}
                    return compiled
                package = re.search(r"^\s*package\s+([\w.]+)\s*;", code, re.M)
                qualified = f"{package.group(1)}.{name}" if package else name
                java_limits = {"max_memory_bytes": 0, "max_cpu_seconds": 20}
                result = await run_process([settings.JAVA_COMMAND, "-Xmx256m", "-Dfile.encoding=UTF-8", "-cp", directory, qualified], directory, java_stdin(code) if stdin is None else stdin, resource_limits=java_limits)
                result.stages = {"compile": "passed", "execution": "passed" if result.success else "failed"}
                result.timings["compile_seconds"] = compiled.timings.get("process_seconds", 0)
                return result
            if language in {"c", "cpp"}:
                cpp = detect_cpp(code, language, filename)
                source = directory / ("solution.cpp" if cpp else "solution.c")
                executable = directory / ("solution.exe" if os.name == "nt" else "solution")
                source.write_text(code, encoding="utf-8")
                command = [settings.CPP_COMPILER if cpp else settings.C_COMPILER,
                           "-std=c++17" if cpp else "-std=c11", "-O0", source,
                           "-o", executable]
                if not cpp:
                    command.append("-lm")  # C math functions such as sqrtf need libm.
                compiled = await run_process(command, directory, timeout=settings.COMPILATION_TIMEOUT)
                if not compiled.success:
                    compiled.error = "Compilation error: " + compiled.error
                    compiled.stages = {"compile": "failed", "execution": "not_run"}
                    return compiled
                c_limits = {"max_memory_bytes": 256 * 1024 * 1024, "max_cpu_seconds": 10}
                result = await run_process([executable], directory, c_stdin(code) if stdin is None else stdin, resource_limits=c_limits)
                result.stages = {"compile": "passed", "execution": "passed" if result.success else "failed"}
                result.timings["compile_seconds"] = compiled.timings.get("process_seconds", 0)
                return result
            if language == "node" and not re.search(r"\.listen\s*\(|\bcreateServer\s*\(", code):
                source = directory / ("solution.mjs" if re.search(r"^\s*(?:import |export )", code, re.M) else "solution.cjs")
                source.write_text(code, encoding="utf-8")
                return await run_process([settings.NODE_COMMAND, source], directory, stdin or "", resource_limits={"max_memory_bytes": 0})
            return await self._web(code, language, directory, project_files, routes,
                                   browser_tests=browser_tests, interaction_is_required=interaction_is_required, api_tests=api_tests)

    async def _install_packages(self, language, directory):
        common_node_packages = {
            "express": "4.21.2",
            "joi": "^17.13.3",
            "cors": "^2.8.5",
            "cookie-parser": "^1.4.7",
            "express-session": "^1.18.1",
        }
        packages = common_node_packages if language == "node" else {
            "react": "18.2.0",
            "react-dom": "18.2.0",
            "react-router-dom": "6.30.1",
            "vite": "5.4.21",
            **common_node_packages,
        }
        cache = Path(settings.REACT_TEMP_DIR).resolve() / "runtime_packages" / language
        if settings.NODE_RUNTIME_CACHE:
            source = Path(settings.NODE_RUNTIME_CACHE) / language / 'node_modules'
            if not source.is_dir(): return 'Preinstalled offline Node runtime dependencies are unavailable.'
            await asyncio.to_thread(shutil.copytree, source, directory / 'node_modules')
            return None
        cache.mkdir(parents=True, exist_ok=True)
        lock = self._package_locks.setdefault(language, asyncio.Lock())
        async with lock:
            marker = cache / '.ready'
            signature = json.dumps(packages, sort_keys=True)
            if not marker.exists() or marker.read_text() != signature:
                (cache / "package.json").write_text(json.dumps({"private": True, "dependencies": packages}), encoding="utf-8")
                node = shutil.which(settings.NODE_COMMAND) or settings.NODE_COMMAND
                npm = Path(node).resolve().parent / "node_modules" / "npm" / "bin" / "npm-cli.js"
                if npm.is_file():
                    command = [node, str(npm)]
                else:
                    npm_executable = shutil.which("npm")
                    if not npm_executable:
                        return "npm is required for React/Express execution."
                    command = [npm_executable]
                installed = await run_process(command + ["install", "--ignore-scripts", "--no-audit", "--no-fund"], cache, timeout=180,
                                              extras={"npm_config_cache": str(cache / ".npm-cache"), "NODE_OPTIONS": "--max-old-space-size=256"},
                                              resource_limits={"max_memory_bytes": 0})
                if not installed.success:
                    return "Runtime dependency installation failed: " + installed.error[-1500:]
                marker.write_text(signature)
            await asyncio.to_thread(shutil.copytree, cache / "node_modules", directory / "node_modules")
        return None

    async def _run_browser_scenario(self, page, test, result):
        initial_text = await page.evaluate(_VISIBLE_PAGE_TEXT)
        for index, action in enumerate(test["actions"], 1):
            result["failed_step"] = index
            locator = browser_test_locator(page, action)
            count = await locator.count()
            if count != 1:
                raise ValueError(f"Step {index}: expected one matching control, found {count}.")
            if action["action"] == "fill":
                await locator.fill(action["value"], timeout=2000)
            else:
                await locator.click(timeout=2000)
            result["executed_steps"] = index
        result["failed_step"] = len(test["actions"]) + 1
        # All assertions must hold together in the final state, including delayed UI updates.
        deadline = asyncio.get_running_loop().time() + 2.5
        while True:
            observed = await page.evaluate(_VISIBLE_PAGE_TEXT)
            result["observed_text"] = observed[:2000]
            if all(expected_text_is_visible(observed, value) for value in test["expected_text"]):
                break
            if asyncio.get_running_loop().time() >= deadline:
                expected = repr(test["expected_text"][0]) if len(test["expected_text"]) == 1 else repr(test["expected_text"])
                raise ValueError(f"Expected visible text {expected} after the actions; observed: {observed[:300]!r}.")
            await asyncio.sleep(.1)
        for expected in test["expected_text"]:
            if expected_text_is_visible(initial_text, expected):
                raise ValueError(f"Expected text '{expected}' was already visible before the actions.")
        result.pop("failed_step", None)
        result["status"] = "passed"

    async def _capture_html(self, code, browser_tests, interaction_is_required, page_url=None):
        from .isolated_runtime import require_worker
        require_worker()
        started = time.perf_counter()
        metrics = {"browser_start_seconds": 0, "interaction_seconds": 0, "screenshot_seconds": 0}
        tests, plan_error = normalize_browser_tests(browser_tests)
        v2 = bool(tests and tests[0].get('version') == 2)
        ui_actions = bool(v2 and any(s['action'] in {'click','click_confirm','fill','select'} for t in tests for s in t['steps']))
        required = bool(interaction_is_required or plan_error or (ui_actions if v2 else browser_tests))
        verification = {"required": required, "status": "failed" if required else "not_required",
                        "tests": [{**test, "status": "not_run", "executed_steps": 0, "observed_text": ""}
                                  for test in tests]}
        if v2:
            for result in verification['tests']:
                result['expected_text']=[s['locator'] for s in result['steps'] if s['action']=='assert_visible' and s['locator_type']=='text']
        directory = Path(settings.SCREENSHOT_DIR).resolve() / ("web_" + uuid.uuid4().hex)
        directory.mkdir(parents=True, exist_ok=True)
        screenshots, output, errors = {}, [], []
        page = None
        try:
            async with acquire_capture_context(viewport={"width": 1366, "height": 768},
                                              accept_downloads=False, service_workers='block' if page_url else 'allow') as context:
                async with asyncio.timeout(120 if v2 else _HTML_CAPTURE_SECONDS):
                        async def guard(route):
                            target = urlparse(route.request.url)
                            origin = urlparse(page_url) if page_url else None
                            if target.scheme in {"about", "data", "blob"} or (origin and target.scheme == origin.scheme and target.hostname == origin.hostname and target.port == origin.port):
                                if origin and route.request.resource_type == 'document':
                                    from .web_runtime import BROWSER_CSP
                                    response=await route.fetch(timeout=5000,max_redirects=0)
                                    await route.fulfill(response=response,headers={**response.headers,'content-security-policy':BROWSER_CSP})
                                else:
                                    await route.continue_()
                            else:
                                await route.abort()
                        await context.route("**/*", guard)
                        test_deadline = asyncio.get_running_loop().time() + (90 if v2 else _HTML_INTERACTION_SECONDS)
                        for index, test in enumerate(tests or [None]):
                            # A fresh page resets top-level const/let declarations, listeners and DOM state.
                            if page is not None:
                                await asyncio.wait_for(page.close(), timeout=2)
                            page = await context.new_page()
                            if v2:
                                async def handle_dialog(dialog):
                                    if not getattr(page,'_labmate_confirm_pending',False):
                                        await dialog.dismiss()
                                page.on('dialog', handle_dialog)
                            observations = []
                            current_requests = set()
                            if v2: page.on('request',lambda request: current_requests.add(request))
                            origin = urlparse(page_url) if page_url else None
                            def observed_response(response):
                                parsed = urlparse(response.url)
                                if origin and parsed.scheme == origin.scheme and parsed.netloc == origin.netloc and (not v2 or response.request in current_requests):
                                    observations.append({'method': response.request.method, 'path': parsed.path + ('?' + parsed.query if parsed.query else ''), 'status': response.status})
                            page.on('response', observed_response)
                            viewport = test.get("viewport") if test else {"width": 1366, "height": 768}
                            await page.set_viewport_size(viewport)
                            page_errors = []
                            page.on("pageerror", lambda error, target=page_errors: target.append(str(error)[:500]))
                            console_errors = []
                            page.on("console", lambda message, target=console_errors: target.append(message.text[:500]) if message.type == "error" else None)
                            result = verification["tests"][index] if test else None
                            try:
                                remaining = test_deadline - asyncio.get_running_loop().time()
                                if remaining <= 0:
                                    raise TimeoutError("Browser interaction tests exceeded the 20-second time limit.")
                                async with asyncio.timeout(remaining):
                                    if page_url:
                                        response = await page.goto(page_url, wait_until='domcontentloaded' if v2 else "networkidle", timeout=5000)
                                        if response and response.status >= 400 and response.status not in {401, 403}:
                                            raise ValueError(f"Route returned HTTP {response.status}.")
                                    else:
                                        from .web_runtime import BROWSER_CSP
                                        meta='<meta http-equiv="Content-Security-Policy" content="'+BROWSER_CSP+'">'
                                        insertion=re.search(r'<head(?:\s[^>]*)?>|<!doctype[^>]*>',code,re.I)
                                        rendered=code[:insertion.end()]+meta+code[insertion.end():] if insertion else meta+code
                                        await page.set_content(rendered, wait_until="load", timeout=5000)
                                    if not required or v2 and not ui_actions:
                                        controls = await page.locator(
                                            'button:visible,input:not([type="hidden"]):visible,textarea:visible,'
                                            'select:visible,[role="button"]:visible,[onclick]:visible,'
                                            '[contenteditable="true"]:visible'
                                        ).count() > 0
                                        required = bool(required or controls)
                                        verification["required"] = required
                                        if controls and v2 and not ui_actions:
                                            raise ValueError('Interactive controls were rendered, but the test plan only checked page rendering.')
                                    if required and (plan_error or not tests):
                                        raise ValueError(plan_error or "The task requires interaction, but no valid browser test plan was generated.")
                                    if test:
                                        interaction_started = time.perf_counter()
                                        if v2:
                                            from .browser_scenarios import run_v2
                                            async def capture_step(step_index):
                                                height = max(viewport['height'], await page.evaluate('document.documentElement.scrollHeight'))
                                                if height > 16000: raise ValueError('Page exceeds evidence height limit.')
                                                path = directory / f'test_{index+1}_step_{step_index}.png'
                                                await page.screenshot(path=str(path), full_page=True, timeout=3000)
                                                key = f'/test-{index+1}/step-{step_index}'
                                                screenshots[key] = str(path)
                                                result.setdefault('screenshot_keys', []).append(key)
                                                from .storage_service import storage_service
                                                await asyncio.to_thread(storage_service.sync_file, path)
                                            local_origin = urlparse(page_url)
                                            def reset_http():
                                                observations.clear()
                                                current_requests.clear()
                                            await run_v2(page, test, result, f'{local_origin.scheme}://{local_origin.netloc}', observations, capture_step, reset_http)
                                        else:
                                            await self._run_browser_scenario(page, test, result)
                                        metrics["interaction_seconds"] += round(time.perf_counter() - interaction_started, 6)
                                    if v2:
                                        try:
                                            await page.wait_for_function('Array.from(document.images).every(image=>image.complete)',timeout=2500)
                                        except Exception:
                                            pass
                                    broken_images = await page.evaluate(
                                        "Array.from(document.images).filter(image => !image.complete || image.naturalWidth === 0).length")
                                    if broken_images:
                                        raise ValueError(f"Page contains {broken_images} broken image(s); use self-contained assets.")
                                    if page_errors:
                                        raise ValueError("Browser JavaScript error: " + page_errors[0])
                            except Exception as error:
                                detail = ("Browser interaction tests exceeded the 20-second time limit."
                                          if isinstance(error, TimeoutError) else str(error)[:500])
                                if page_errors:
                                    detail += " JavaScript errors: " + "; ".join(page_errors[:3])
                                errors.append(f"Browser interaction test '{test['name']}' failed: {detail}" if test else detail)
                                if result is not None:
                                    result.update(status="failed", error=detail)
                                else:
                                    verification["error"] = detail
                            # Diagnostic collection is also bounded if the page has hung or closed.
                            try:
                                observed = await asyncio.wait_for(page.evaluate(_VISIBLE_PAGE_TEXT), timeout=1)
                                output.append(observed[:8000])
                                if result is not None:
                                    result["observed_text"] = observed[:2000]
                                if console_errors:
                                    verification.setdefault("console_errors", []).extend(console_errors[:10])
                                if v2 and result is not None:
                                    result['http_observations'] = observations[-80:]
                            except Exception:
                                pass
                            try:
                                async def screenshot():
                                    height = max(viewport["height"], await page.evaluate("document.documentElement.scrollHeight"))
                                    if height > 16000:
                                        raise ValueError("Page exceeds the 16000-pixel evidence limit; partial capture is not accepted.")
                                    path = directory / f"test_{index + 1}.png"
                                    await page.screenshot(path=str(path), clip={"x": 0, "y": 0, "width": viewport["width"], "height": height}, timeout=3000)
                                    return path
                                screenshot_started = time.perf_counter()
                                path = await asyncio.wait_for(screenshot(), timeout=4)
                                metrics["screenshot_seconds"] += round(time.perf_counter() - screenshot_started, 6)
                                key = "/" if index == 0 else f"/test-{index + 1}"
                                screenshots[key] = str(path)
                                if result is not None:
                                    result["screenshot_key"] = key
                                from .storage_service import storage_service
                                await asyncio.to_thread(storage_service.sync_file, path)
                            except Exception:
                                detail = "Browser evidence could not be captured for this scenario."
                                errors.append(detail)
                                if result is not None:
                                    result.update(status="failed", error=detail + " " + result.get("error", ""))
                                else:
                                    verification["error"] = detail + " " + verification.get("error", "")
                            if errors:
                                break
        except Exception as error:
            detail = ("HTML browser capture exceeded its 40-second time limit."
                      if isinstance(error, TimeoutError) else f"Browser verification could not run: {str(error)[:400]}")
            errors.append(detail)
            verification["error"] = detail
        verification["status"] = "failed" if errors else "passed" if required else "not_required"
        if v2: verification['kind']='browser' if required else 'render'
        if required:
            output.append("Browser interaction verification: " + verification["status"].upper())
            for result in verification["tests"]:
                output.append(f"{result['status'].upper()}: {result['name']}; Expected: {result.get('expected_text', [s.get('value') or s.get('locator') for s in result.get('steps', []) if s['action'].startswith('assert_')])}; Observed: {result['observed_text']}")
        metrics["capture_total_seconds"] = round(time.perf_counter() - started, 6)
        return RuntimeResult(not errors, "\n".join(output), "\n".join(errors), 1 if errors else 0,
                             screenshots=screenshots, verification=verification, timings=metrics)

    async def _capture(self, url=None, code=None, routes=None, browser_tests=None, interaction_is_required=False):
        if code is not None:
            return await self._capture_html(code, browser_tests, interaction_is_required)
        aggregate = RuntimeResult(True, verification={"required": False, "status": "not_required", "tests": []})
        for index, path in enumerate((routes or ["/"])[:10]):
            if not isinstance(path, str) or not path.startswith("/") or path.startswith("//") or "\\" in path:
                raise ValueError("Browser routes must be local paths.")
            result = await self._capture_html(None, browser_tests if index == 0 else None,
                                              interaction_is_required if index == 0 else False, page_url=url + path)
            aggregate.success = aggregate.success and result.success
            aggregate.output += ("\n" if aggregate.output else "") + result.output
            aggregate.error += ("\n" if aggregate.error and result.error else "") + result.error
            aggregate.exit_code = 0 if aggregate.success else 1
            for key, screenshot in result.screenshots.items():
                aggregate.screenshots[path if key == "/" else path + key] = screenshot
            if result.verification:
                aggregate.verification["required"] |= result.verification["required"]
                aggregate.verification["tests"].extend(result.verification["tests"])
                if result.verification.get("error"):
                    aggregate.verification["error"] = result.verification["error"]
            for key, value in result.timings.items():
                aggregate.timings[key] = aggregate.timings.get(key, 0) + value
        aggregate.verification["status"] = "failed" if not aggregate.success else "passed" if aggregate.verification["required"] else "not_required"
        return aggregate

    async def _capture_api(self, origin, tests):
        if not isinstance(tests, list) or not 1 <= len(tests) <= 16:
            return RuntimeResult(False, error="API tests require one to sixteen declarative requests.", exit_code=2)
        normalized = []
        for test in tests:
            if not isinstance(test, dict) or set(test) - {"name", "path", "method", "json", "expected_status", "expected_json"}:
                return RuntimeResult(False, error="API tests accept declarative request fields only.", exit_code=2)
            path, method, status = test.get("path", "/"), test.get("method", "GET"), test.get("expected_status", 200)
            if not isinstance(path, str) or not path.startswith("/") or path.startswith("//") or len(path) > 500 or "\\" in path:
                return RuntimeResult(False, error="API request paths must stay on the local test server.", exit_code=2)
            if not isinstance(method, str) or method not in {"GET", "POST", "PUT", "PATCH", "DELETE"} or type(status) is not int or not 200 <= status <= 599:
                return RuntimeResult(False, error="Unsupported HTTP method or expected status.", exit_code=2)
            if len(json.dumps(test)) > 20000:
                return RuntimeResult(False, error="API test exceeds the request size limit.", exit_code=2)
            normalized.append({**test, "path": path, "method": method, "expected_status": status})
        results = []
        async with httpx.AsyncClient(timeout=3, follow_redirects=False, trust_env=False) as client:
            for test in normalized:
                result = {"name": str(test.get("name", test["method"] + " " + test["path"]))[:120],
                          "status": "failed", "expected_text": [f"HTTP {test['expected_status']}"], "observed_text": ""}
                try:
                    response = await client.request(test["method"], origin + test["path"], json=test.get("json"))
                    result["observed_text"] = f"{test['method']} {test['path']}\nHTTP {response.status_code}\n{response.text[:2000]}"
                    if response.status_code != test["expected_status"]:
                        raise ValueError(f"Expected HTTP {test['expected_status']}, observed {response.status_code}.")
                    if "expected_json" in test:
                        actual, expected = response.json(), test["expected_json"]
                        result["expected_text"].append(json.dumps(expected, sort_keys=True))
                        if (isinstance(expected, dict) and (not isinstance(actual, dict) or any(actual.get(k) != v for k, v in expected.items()))) or (not isinstance(expected, dict) and actual != expected):
                            raise ValueError("Response JSON did not match the expected data.")
                    result["status"] = "passed"
                except Exception as error:
                    result["error"] = str(error)[:500]
                results.append(result)
        success = all(t["status"] == "passed" for t in results)
        return RuntimeResult(success, "\n\n".join(t["observed_text"] for t in results),
                             "\n".join(t.get("error", "") for t in results if t["status"] == "failed"),
                             0 if success else 1, verification={"kind": "http", "required": True,
                                 "status": "passed" if success else "failed", "tests": results})

    async def _web(self, code, language, directory, project_files, routes, browser_tests=None,
                   interaction_is_required=False, api_tests=None):
        if language == "html":
            if project_files:
                try:
                    write_project_files(directory, project_files)
                except ValueError as error:
                    return RuntimeResult(False, error=str(error), exit_code=2)
                if not (directory / "index.html").exists():
                    (directory / "index.html").write_text(code, encoding="utf-8")
                class QuietHandler(SimpleHTTPRequestHandler):
                    def log_message(self, *args):
                        pass
                # Chromium can preconnect before route.fetch makes the CSP request.
                # A single connection server then waits forever on that idle socket.
                server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(directory)))
                task = asyncio.create_task(asyncio.to_thread(server.serve_forever, poll_interval=.05))
                try:
                    return await self._capture(url=f"http://127.0.0.1:{server.server_port}", routes=routes,
                                               browser_tests=browser_tests, interaction_is_required=interaction_is_required)
                finally:
                    await asyncio.to_thread(server.shutdown)
                    server.server_close()
                    await task
            return await self._capture(code=code, browser_tests=browser_tests,
                                       interaction_is_required=interaction_is_required)
        error = await self._install_packages(language, directory)
        if error:
            return RuntimeResult(False, error=error, exit_code=127)
        if project_files:
            try:
                write_project_files(directory, project_files)
            except ValueError as error:
                return RuntimeResult(False, error=str(error), exit_code=2)
        reservation = socket.socket()
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]
        if language == "node":
            esm = bool(re.search(r"^\s*(?:import |export )", code, re.M))
            source = directory / ("server.mjs" if esm else "server.cjs")
            source.write_text(code, encoding="utf-8")
            preload = directory / "bind_local.cjs"
            preload.write_text("const net=require('node:net');const original=net.Server.prototype.listen;net.Server.prototype.listen=function(...args){const port=Number(process.env.PORT);if(typeof args[0]==='object'){args[0]={...args[0],port,host:'127.0.0.1'};}else{args[0]=port;if(typeof args[1]==='string')args[1]='127.0.0.1';else args.splice(1,0,'127.0.0.1');}return original.apply(this,args);};", encoding="utf-8")
            command = [settings.NODE_COMMAND, "--require", preload, source]
            if not routes:
                matches = re.findall(r"\bapp\.get\s*\(\s*['\"](/[^'\"]*)", code)
                routes = [matches[0]] if matches else ["/"]
        else:
            # Trusted configuration: support modern React JSX without executing user Vite config.
            (directory / "vite.config.mjs").write_text(
                'export default {esbuild:{jsx:"automatic"},server:{hmr:false}};', encoding="utf-8")
            if not project_files:
                src = directory / "src"
                src.mkdir(exist_ok=True)
                if re.search(r"createRoot\s*\(|ReactDOM\.render", code):
                    (src / "main.jsx").write_text(code, encoding="utf-8")
                else:
                    if "export default" not in code and re.search(r"(?:function|const|class)\s+App\b", code):
                        code += "\nexport default App;"
                    (src / "App.jsx").write_text(code, encoding="utf-8")
                    (src / "main.jsx").write_text("import React from 'react';import{createRoot}from'react-dom/client';import App from './App.jsx';createRoot(document.getElementById('root')).render(<App/>);", encoding="utf-8")
            if not (directory / "index.html").exists():
                entries = [name for name in ("src/main.jsx", "src/main.js", "src/index.jsx", "src/index.js") if (directory / name).exists()]
                if not entries and (directory / "src/App.jsx").exists():
                    (directory / "src/main.jsx").write_text("import React from 'react';import{createRoot}from'react-dom/client';import App from './App.jsx';createRoot(document.getElementById('root')).render(<App/>);", encoding="utf-8")
                    entries = ["src/main.jsx"]
                if not entries:
                    reservation.close()
                    return RuntimeResult(False, error="React project has no supported entry point.", exit_code=2)
                (directory / "index.html").write_text('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module" src="/' + entries[0] + '"></script></body></html>', encoding="utf-8")
            command = [settings.NODE_COMMAND, directory / "node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", str(port), "--strictPort"]
        reservation.close()  # Release immediately before binding the child; all captures use its assigned port.
        try:
            process = await start_process(command, directory, {"PORT": str(port), "NODE_ENV": "development", "NODE_OPTIONS": "--max-old-space-size=256"},
                                          resource_limits={"max_memory_bytes": 0})
        except FileNotFoundError:
            return RuntimeResult(False, error="Node.js is not installed.", exit_code=127)
        process.stdin.close()
        out = asyncio.create_task(collect_output(process.stdout, process))
        err = asyncio.create_task(collect_output(process.stderr, process))
        try:
            async with httpx.AsyncClient(timeout=2) as client:
                for _ in range(100):
                    if process.returncode is not None:
                        stdout, _ = await out; stderr, _ = await err
                        return RuntimeResult(False, stdout, stderr, process.returncode or 1)
                    try:
                        response = await client.get(f"http://127.0.0.1:{port}")
                        if response.status_code < 500:
                            break
                    except httpx.TransportError:
                        pass
                    await asyncio.sleep(.2)
                else:
                    return RuntimeResult(False, error="Web server did not become ready within 20 seconds.", exit_code=124)
            if language == "node" and (api_tests is not None or re.search(r"\.json\s*\(|application/json", code)):
                return await self._capture_api(f"http://127.0.0.1:{port}", api_tests if api_tests is not None else [
                    {"path": (routes or ["/"])[0], "expected_status": 200}])
            return await self._capture(url=f"http://127.0.0.1:{port}", routes=routes,
                                       browser_tests=browser_tests, interaction_is_required=interaction_is_required)
        finally:
            await kill_process_tree(process)
            await asyncio.gather(out, err, return_exceptions=True)


runtime_engine = RuntimeEngine()
