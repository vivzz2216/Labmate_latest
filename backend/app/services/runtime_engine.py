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
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

import httpx
from playwright.async_api import async_playwright

try:
    import resource
except ImportError:
    resource = None

from ..config import settings
from .browser_capture import launch_capture_browser


@dataclass
class RuntimeResult:
    success: bool
    output: str = ""
    error: str = ""
    exit_code: int = 0
    files: list = field(default_factory=list)
    screenshots: dict = field(default_factory=dict)


def runtime_environment(directory: Path, extras=None):
    # Model keys, database credentials, and auth secrets never enter student processes.
    allowed = {"PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "JAVA_HOME", "LANG", "LC_ALL"}
    environment = {key: value for key, value in os.environ.items() if key.upper() in allowed}
    tool_directories = [str(Path(value).parent) for value in (settings.JAVA_COMMAND, settings.JAVAC_COMMAND, settings.C_COMPILER, settings.CPP_COMPILER) if Path(value).is_absolute()]
    environment["PATH"] = os.pathsep.join(tool_directories + [environment.get("PATH", "")])
    environment.update({"TMP": str(directory), "TEMP": str(directory), "TMPDIR": str(directory), "PYTHONIOENCODING": "utf-8"})
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


async def start_process(command, directory, extras=None, resource_limits=None):
    if os.name == "nt":
        options = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
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


async def run_process(command, directory, stdin="", timeout=None, extras=None, resource_limits=None):
    try:
        process = await start_process(command, directory, extras, resource_limits=resource_limits)
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

        return RuntimeResult(process.returncode == 0, stdout, stderr, process.returncode)
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
    tree = ast.parse(code)
    calls = sorted((node for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "input"), key=lambda node: (node.lineno, node.col_offset))
    lines = code.splitlines()
    values = ["5" if re.search(r"\b(?:int|float)\s*\(", lines[node.lineno - 1]) else "sample" for node in calls]
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


class RuntimeEngine:
    def __init__(self):
        self._package_locks = {}

    async def execute(self, code, language="python", filename=None, stdin=None, project_files=None, routes=None, prepare_files=None, collect_files=None):
        language = {"c++": "cpp", "javascript": "node", "webdev": "html"}.get(language.lower(), language.lower())
        if language not in {"python", "java", "c", "cpp", "html", "react", "node"}:
            return RuntimeResult(False, error="Unsupported execution language.", exit_code=2)

        # Universal static security policy check across all supported languages
        from ..security.generated_code import validate_generated_code
        try:
            validate_generated_code(code, language)
        except ValueError as val_err:
            return RuntimeResult(False, error=f"Security policy violation: {str(val_err)}", exit_code=126)

        root = Path(settings.REACT_TEMP_DIR).resolve()
        root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="labmate_", dir=root) as folder:
            directory = Path(folder)
            if language == "python":
                name = Path(filename or "solution.py").name
                if not name.endswith(".py"):
                    name += ".py"
                source = directory / name
                source.write_text(code, encoding="utf-8")
                context = prepare_files(directory) if prepare_files else None
                inputs = python_stdin(code) if stdin is None else stdin
                docker = shutil.which("docker")
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
                compiled = await run_process([settings.JAVAC_COMMAND, "-encoding", "UTF-8", "-d", directory, source], directory, timeout=settings.COMPILATION_TIMEOUT)
                if not compiled.success:
                    compiled.error = "Compilation error: " + compiled.error
                    return compiled
                package = re.search(r"^\s*package\s+([\w.]+)\s*;", code, re.M)
                qualified = f"{package.group(1)}.{name}" if package else name
                java_limits = {"max_memory_bytes": 1024 * 1024 * 1024, "max_cpu_seconds": 20}
                return await run_process([settings.JAVA_COMMAND, "-Xmx256m", "-Dfile.encoding=UTF-8", "-cp", directory, qualified], directory, java_stdin(code) if stdin is None else stdin, resource_limits=java_limits)
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
                    return compiled
                c_limits = {"max_memory_bytes": 256 * 1024 * 1024, "max_cpu_seconds": 10}
                return await run_process([executable], directory, c_stdin(code) if stdin is None else stdin, resource_limits=c_limits)
            return await self._web(code, language, directory, project_files, routes)

    async def _install_packages(self, language, directory):
        packages = {"express": "4.21.2"} if language == "node" else {"react": "18.2.0", "react-dom": "18.2.0", "react-router-dom": "6.30.1", "vite": "5.4.21"}
        cache = Path(settings.REACT_TEMP_DIR).resolve() / "runtime_packages" / language
        cache.mkdir(parents=True, exist_ok=True)
        lock = self._package_locks.setdefault(language, asyncio.Lock())
        async with lock:
            if not (cache / ".ready").exists():
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
                                              extras={"npm_config_cache": str(cache / ".npm-cache")})
                if not installed.success:
                    return "Runtime dependency installation failed: " + installed.error[-1500:]
                (cache / ".ready").touch()
            await asyncio.to_thread(shutil.copytree, cache / "node_modules", directory / "node_modules")
        return None

    async def _capture(self, url=None, code=None, routes=None):
        directory = Path(settings.SCREENSHOT_DIR).resolve() / ("web_" + uuid.uuid4().hex)
        directory.mkdir(parents=True, exist_ok=True)
        screenshots = {}
        output, errors = [], []
        async with async_playwright() as playwright:
            browser = await launch_capture_browser(playwright)
            try:
                context = await browser.new_context(viewport={"width": 1366, "height": 768}, accept_downloads=False)
                async def guard(route):
                    parsed = urlparse(route.request.url)
                    origin = urlparse(url) if url else None
                    if parsed.scheme in {"data", "blob", "about"} or (origin and parsed.hostname == origin.hostname and parsed.port == origin.port):
                        await route.continue_()
                    else:
                        await route.abort()
                await context.route("**/*", guard)
                page = await context.new_page()
                page.on("pageerror", lambda error: errors.append(str(error)))
                for index, path in enumerate((routes or ["/"])[:10]):
                    if not path.startswith("/") or path.startswith("//"):
                        raise ValueError("Browser routes must be local paths.")
                    if url:
                        response = await page.goto(url + path, wait_until="networkidle", timeout=30000)
                        # A protected route correctly returns 401/403 to an
                        # unauthenticated browser. Capture that response; it is
                        # not a server or rendering failure.
                        if response and response.status >= 400 and response.status not in {401, 403}:
                            errors.append(f"Route {path} returned HTTP {response.status}.")
                    else:
                        await page.set_content(code, wait_until="load", timeout=15000)
                    await page.evaluate("document.fonts.ready")
                    broken_images = await page.evaluate(
                        "Array.from(document.images).filter(image => !image.complete || image.naturalWidth === 0).length")
                    if broken_images:
                        errors.append(f"Route {path} contains {broken_images} broken image(s); use self-contained assets.")
                    screenshot = directory / f"route_{index}.png"
                    height = min(16000, max(768, await page.evaluate("document.documentElement.scrollHeight")))
                    await page.screenshot(path=str(screenshot), clip={"x": 0, "y": 0, "width": 1366, "height": height}, timeout=15000)
                    from .storage_service import storage_service
                    storage_service.sync_file(screenshot)
                    screenshots[path] = str(screenshot)
                    output.append(await page.locator("body").inner_text())
                await context.close()
            finally:
                await browser.close()
        return RuntimeResult(not errors, "\n".join(output), "\n".join(errors), 0 if not errors else 1, screenshots=screenshots)

    async def _web(self, code, language, directory, project_files, routes):
        if language == "html":
            return await self._capture(code=code)
        error = await self._install_packages(language, directory)
        if error:
            return RuntimeResult(False, error=error, exit_code=127)
        if project_files:
            if len(project_files) > 100 or sum(len(str(value)) for value in project_files.values()) > 1000000:
                return RuntimeResult(False, error="Project exceeds supported file limits.", exit_code=2)
            for name, content in project_files.items():
                target = (directory / name).resolve()
                if directory.resolve() not in target.parents or name.startswith("node_modules/") or "node_modules" in Path(name).parts:
                    return RuntimeResult(False, error="Project filenames must stay inside the workspace.", exit_code=2)
                if name in {"package.json", "package-lock.json"} or re.search(r"(?:^|/)vite\.config\.", name):
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(str(content), encoding="utf-8")
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
            process = await start_process(command, directory, {"PORT": str(port), "NODE_ENV": "development"})
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
            return await self._capture(url=f"http://127.0.0.1:{port}", routes=routes)
        finally:
            await kill_process_tree(process)
            await asyncio.gather(out, err, return_exceptions=True)


runtime_engine = RuntimeEngine()
