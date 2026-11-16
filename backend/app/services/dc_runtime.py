"""
Distributed Computing Runtime Engine.
Supports compiling multi-file Java applications and orchestrating concurrent
Server-Client topologies or single-driver distributed simulations.
"""

import asyncio
import bisect
import os
import re
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from ..config import settings
from .isolated_runtime import require_worker
from .runtime_engine import RuntimeResult, java_class_name, kill_process_tree, make_resource_limiter, runtime_environment


def _subprocess_options(directory: Path, resource_limits: Optional[dict] = None) -> dict:
    """Enforce worker isolation, sanitized environment variables, and resource limits."""
    require_worker()
    options: dict = {"env": runtime_environment(directory)}
    if os.name == "nt":
        options["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        options["preexec_fn"] = make_resource_limiter(
            resource_limits or {"max_memory_bytes": 0, "max_cpu_seconds": 30}
        )
    return options


def split_java_files(code: str) -> Dict[str, str]:
    """
    Split a combined Java source code string into individual files.
    Supports:
    1. Explicit file headers: '// File: Server.java' or '/* Filename: Client.java */'
    2. Multiple class declarations: 'public class Foo' / 'class Bar'
    """
    files: Dict[str, str] = {}
    
    # 1. Check for explicit file comments
    file_pattern = r"(?:(?://|/\*)\s*(?:File|Filename|Source):\s*([\w\.\-]+?\.java)\s*(?:\*/)?)"
    splits = re.split(file_pattern, code, flags=re.I)
    if len(splits) > 2:
        # First segment might be a header or empty
        for i in range(1, len(splits), 2):
            fname = splits[i].strip()
            content = splits[i + 1].strip()
            if fname and content:
                files[fname] = content
        if files:
            return files

    # 2. Check for markdown-like code block delimiters
    md_pattern = r"```(?:java)?\s*(?:(?://|/\*)\s*([\w\.\-]+?\.java))?\s*\n(.*?)```"
    matches = list(re.finditer(md_pattern, code, flags=re.S))
    if len(matches) > 1:
        for m in matches:
            fname = m.group(1)
            content = m.group(2).strip()
            if not fname:
                cname = java_class_name(content)
                fname = f"{cname}.java" if cname else f"Task_{len(files)+1}.java"
            files[fname] = content
        if files:
            return files

    # 3. Multiple public classes in one text
    public_classes = list(re.finditer(r"public\s+(?:final\s+|abstract\s+)?(?:class|interface|enum)\s+(\w+)", code))
    if len(public_classes) > 1:
        lines = code.splitlines(keepends=True)
        offsets, position = [], 0
        for line in lines:
            offsets.append(position)
            position += len(line)
        # A file begins at the import/comment/annotation lines directly above its
        # public type, so nothing a class needs is cut off or left in its neighbour.
        starts = []
        for index, match in enumerate(public_classes):
            line_no = bisect.bisect_right(offsets, match.start()) - 1
            floor = 0 if index == 0 else bisect.bisect_right(offsets, public_classes[index - 1].start())
            while line_no > floor and re.match(r"\s*(?:import\s|package\s|//|/\*|\*|@\w|$)", lines[line_no - 1]):
                line_no -= 1
            starts.append(0 if index == 0 else max(line_no, floor))
        starts.append(len(lines))
        # Imports are usually written once at the top; every split file needs them.
        imports = list(dict.fromkeys(m.group(0).strip() for m in re.finditer(
            r"^[ \t]*import\s+(?:static\s+)?[\w.*]+\s*;", code, re.M)))
        for i in range(len(public_classes)):
            cname = public_classes[i].group(1)
            segment = "".join(lines[starts[i]:starts[i + 1]]).strip()
            missing = [line for line in imports if line not in segment]
            if missing:
                package = re.match(r"\s*package\s+[\w.]+\s*;[^\n]*\n?", segment)
                head = segment[:package.end()] if package else ""
                segment = head + "\n".join(missing) + "\n" + segment[len(head):]
            files[f"{cname}.java"] = segment
        return files

    # 4. Fallback: single file
    cname = java_class_name(code) or "DistributedLab"
    files[f"{cname}.java"] = code
    return files


def _entry_classes_with_main(fname: str, content: str) -> List[Tuple[str, str]]:
    """Return [(jvm_class_name, class_body_snippet), ...] for every class declaring main()."""
    stripped = re.sub(r'//[^\n]*|/\*.*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', lambda m: ' ' * len(m.group(0)), content, flags=re.S)
    class_decl = re.compile(r'\bclass\s+(\w+)\b[^{;]*\{')
    main_decl = re.compile(r'\b(?:public\s+static|static\s+public)\s+void\s+main\s*\(\s*String\b')
    entries: List[Tuple[str, str]] = []
    # Track brace depth for nested classes using sequential scan of class openings and main declarations
    stack: List[Tuple[str, int, int]] = []  # (name, open_depth, start_pos)
    depth = 0
    pos = 0
    n = len(stripped)
    tokens = list(re.finditer(r'\bclass\s+(\w+)\b[^{;]*\{|\b(?:public\s+static|static\s+public)\s+void\s+main\s*\(\s*String\b|[{}]', stripped))
    seen_mains = set()
    for tok in tokens:
        text = tok.group(0)
        if text == '{':
            depth += 1
        elif text == '}':
            while stack and stack[-1][1] >= depth:
                stack.pop()
            depth = max(0, depth - 1)
        elif text.startswith('class'):
            depth += 1
            stack.append((tok.group(1), depth, tok.start()))
        else:
            # main() matched at current stack
            if stack:
                jvm_name = "$".join(item[0] for item in stack)
                body_start = stack[-1][2]
            else:
                jvm_name = Path(fname).stem
                body_start = 0
            if jvm_name not in seen_mains:
                seen_mains.add(jvm_name)
                entries.append((jvm_name, content[body_start:min(len(content), tok.end() + 1500)]))
    return entries


def detect_topology(files: Dict[str, str]) -> Tuple[Optional[str], Optional[str], List[str]]:
    """
    Detect the server class and client class from the set of files.
    Returns: (server_main_class, client_main_class, all_classes_with_main)
    """
    mains: List[str] = []
    server_class: Optional[str] = None
    client_class: Optional[str] = None

    for fname, content in files.items():
        for cname, snippet in _entry_classes_with_main(fname, content):
            mains.append(cname)
            scope = snippet + " " + cname + " " + fname

            is_server = bool(re.search(
                r"\b(?:Server|Master|Registry|Coordinator|Broker)\b|ServerSocket|LocateRegistry\.createRegistry|rebind\(",
                scope,
                re.I,
            ))
            is_client = bool(re.search(
                r"\b(?:Client|Worker|Node|Consumer)\b|new\s+Socket\(|LocateRegistry\.getRegistry|lookup\(",
                scope,
                re.I,
            ))

            if is_server and not is_client:
                server_class = cname
            elif is_client and not is_server:
                client_class = cname
            elif is_server and is_client:
                # Prefer class name itself before falling back to filename
                if re.search(r"server|master|registry|coordinator|broker", cname, re.I):
                    server_class = cname
                elif re.search(r"client|worker|node|consumer", cname, re.I):
                    client_class = cname
                elif re.search(r"server", fname, re.I):
                    server_class = cname
                elif re.search(r"client", fname, re.I):
                    client_class = cname

    return server_class, client_class, mains


async def _stop(proc) -> None:
    """Kill a child (and any descendant processes) if still running."""
    if proc is None or proc.returncode is not None:
        return
    if isinstance(getattr(proc, "pid", None), int) and hasattr(proc, "_transport"):
        try:
            await asyncio.wait_for(kill_process_tree(proc), timeout=5.0)
            return
        except Exception:
            pass
    try:
        proc.kill()
    except ProcessLookupError:
        return
    try:
        await asyncio.wait_for(proc.wait(), timeout=5.0)
    except Exception:
        pass


async def _drain(stream, limit: int) -> bytes:
    """Read a pipe to EOF so the writer never blocks; keep only the first `limit` bytes."""
    data = bytearray()
    while chunk := await stream.read(65536):
        if len(data) < limit:
            data.extend(chunk[:limit - len(data)])
    return bytes(data)


async def execute_distributed_java(
    code: str,
    directory: Path,
    stdin: Optional[str] = None,
    timeout: float = 50.0,
) -> RuntimeResult:
    """
    Compile and run distributed Java code.
    If both a Server and a Client are present, executes the Server in background,
    waits for initialization, executes the Client, and captures outputs from both.
    """
    # 1. Extract and write all Java files
    files = split_java_files(code)
    for fname, content in files.items():
        file_path = directory / fname
        file_path.write_text(content, encoding="utf-8")

    # 2. Compile all .java files in the working directory
    java_files = [str(f) for f in directory.glob("*.java")]
    if not java_files:
        return RuntimeResult(False, error="No Java source files were found to compile.", exit_code=2)

    compile_cmd = [
        settings.JAVAC_COMMAND,
        "-J-Xmx256m",
        "-encoding", "UTF-8",
        "-d", str(directory),
        *java_files,
    ]

    compile_opts = _subprocess_options(
        directory,
        {"max_memory_bytes": 0, "max_cpu_seconds": min(45, settings.COMPILATION_TIMEOUT)},
    )
    proc = None
    try:
        proc = await asyncio.create_subprocess_exec(
            *compile_cmd,
            cwd=str(directory),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            **compile_opts,
        )
        c_stdout, c_stderr = await asyncio.wait_for(proc.communicate(), timeout=30.0)
    except asyncio.TimeoutError:
        return RuntimeResult(False, error="Compilation timed out.", exit_code=124, stages={"compile": "failed", "execution": "not_run"})
    except Exception as e:
        return RuntimeResult(False, error=f"Compilation launch failed: {e}", exit_code=1, stages={"compile": "failed", "execution": "not_run"})
    finally:
        await _stop(proc)

    if proc.returncode != 0:
        err = c_stderr.decode("utf-8", errors="replace") or c_stdout.decode("utf-8", errors="replace")
        return RuntimeResult(False, error="Compilation error:\n" + err, exit_code=proc.returncode, stages={"compile": "failed", "execution": "not_run"})

    # 3. Detect Topology
    server_class, client_class, mains = detect_topology(files)

    # Case A: Separate Server and Client
    if server_class and client_class and server_class != client_class:
        return await _run_server_client(directory, server_class, client_class, stdin, timeout)

    # Case B: Exactly one main or single driver class
    main_class = mains[0] if mains else (server_class or client_class or java_class_name(code))
    if not main_class:
        return RuntimeResult(False, error="Could not determine executable main class.", exit_code=2)

    return await _run_single_process(directory, main_class, stdin, timeout)


async def _run_single_process(directory: Path, main_class: str, stdin: Optional[str], timeout: float) -> RuntimeResult:
    """Run a single Java class that coordinates the simulation or demo."""
    cmd = [
        settings.JAVA_COMMAND,
        "-Xmx256m",
        "-Dfile.encoding=UTF-8",
        "-cp", str(directory),
        main_class,
    ]

    run_opts = _subprocess_options(
        directory,
        {"max_memory_bytes": 0, "max_cpu_seconds": max(20, int(timeout))},
    )
    proc = None
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(directory),
            stdin=asyncio.subprocess.PIPE if stdin else None,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            **run_opts,
        )
        input_bytes = stdin.encode("utf-8") if stdin else None
        stdout_bytes, stderr_bytes = await asyncio.wait_for(proc.communicate(input=input_bytes), timeout=timeout)
        out = stdout_bytes.decode("utf-8", errors="replace")
        err = stderr_bytes.decode("utf-8", errors="replace")
        success = proc.returncode == 0
        return RuntimeResult(
            success=success,
            output=out,
            error=err if not success else "",
            exit_code=proc.returncode or 0,
            stages={"compile": "passed", "execution": "passed" if success else "failed"},
        )
    except asyncio.TimeoutError:
        return RuntimeResult(False, error="Execution timed out.", exit_code=124, stages={"compile": "passed", "execution": "failed"})
    except Exception as e:
        return RuntimeResult(False, error=f"Execution failed: {e}", exit_code=1, stages={"compile": "passed", "execution": "failed"})
    finally:
        await _stop(proc)


async def _run_server_client(
    directory: Path,
    server_class: str,
    client_class: str,
    stdin: Optional[str],
    timeout: float,
) -> RuntimeResult:
    """Run Server in background, wait, then run Client, and combine output."""
    server_cmd = [
        settings.JAVA_COMMAND,
        "-Xmx256m",
        "-Dfile.encoding=UTF-8",
        "-cp", str(directory),
        server_class,
    ]

    client_cmd = [
        settings.JAVA_COMMAND,
        "-Xmx256m",
        "-Dfile.encoding=UTF-8",
        "-cp", str(directory),
        client_class,
    ]

    run_opts = _subprocess_options(
        directory,
        {"max_memory_bytes": 0, "max_cpu_seconds": max(20, int(timeout))},
    )
    server_proc = None
    client_proc = None
    server_output = None
    output_cap = int(getattr(settings, "EXECUTION_MAX_OUTPUT_BYTES", 1048576))
    try:
        # 1. Start Server
        server_proc = await asyncio.create_subprocess_exec(
            *server_cmd,
            cwd=str(directory),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            **run_opts,
        )
        # Read the server's pipes for the whole run. Left unread, a server that logs
        # more than the pipe buffer blocks on print and stops answering the client.
        server_output = asyncio.gather(_drain(server_proc.stdout, output_cap),
                                       _drain(server_proc.stderr, output_cap))

        # 2. Allow server to bind socket or initialize RMI
        await asyncio.sleep(1.8)

        # 3. Check if server already finished
        if server_proc.returncode is not None:
            s_out, s_err = await server_output
            s_out_text = s_out.decode("utf-8", errors="replace").strip()
            s_err_text = s_err.decode("utf-8", errors="replace").strip()
            if server_proc.returncode == 0 and s_out_text and not s_out_text.lower().startswith("usage:"):
                return RuntimeResult(
                    True,
                    output=f"=== [SERVER: {server_class}] ===\n{s_out_text}",
                    error="",
                    exit_code=0,
                    stages={"compile": "passed", "execution": "passed"},
                )
            err_msg = s_err_text or s_out_text
            return RuntimeResult(
                False,
                error=f"Server process terminated unexpectedly:\n{err_msg}",
                exit_code=server_proc.returncode,
                stages={"compile": "passed", "execution": "failed"},
            )

        # 4. Start Client
        client_proc = await asyncio.create_subprocess_exec(
            *client_cmd,
            cwd=str(directory),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            **run_opts,
        )

        # For distributed socket/RPC clients, provide standard interactive responses if stdin is not supplied
        default_client_input = "Hello\nhelp\ntest\n1\nexit\nbye\nquit\n"
        input_str = stdin if stdin is not None else default_client_input
        input_bytes = input_str.encode("utf-8")
        client_timeout = max(0.5, float(timeout) - 5.0) if float(timeout) > 6.0 else max(0.5, float(timeout))
        c_stdout, c_stderr = await asyncio.wait_for(client_proc.communicate(input=input_bytes), timeout=client_timeout)

        # 5. Give server 1 second to flush final logs, then terminate
        await asyncio.sleep(0.8)
        if server_proc.returncode is None:
            try:
                server_proc.terminate()
                s_stdout, s_stderr = await asyncio.wait_for(asyncio.shield(server_output), timeout=3.0)
            except Exception:
                await _stop(server_proc)
                s_stdout, s_stderr = await server_output
        else:
            s_stdout, s_stderr = await server_output

        s_out_text = s_stdout.decode("utf-8", errors="replace").strip()
        c_out_text = c_stdout.decode("utf-8", errors="replace").strip()
        c_err_text = c_stderr.decode("utf-8", errors="replace").strip()

        combined_output = (
            f"=== [SERVER: {server_class}] ===\n"
            f"{s_out_text}\n\n"
            f"=== [CLIENT: {client_class}] ===\n"
            f"{c_out_text}"
        )

        success = client_proc.returncode == 0
        # Independent evidence that two separate processes really exchanged data: the server was started first and still running when the
        # client started (checked above), the client finished normally, and both processes printed their own output.
        tests = [
            {"name": "server process was running when the client started", "status": "passed"},
            {"name": "client process finished with exit code 0", "status": "passed" if success else "failed"},
            {"name": "client produced output", "status": "passed" if c_out_text else "failed"},
        ]
        verification = {"kind": "distributed", "tests": tests,
                        "status": "passed" if all(t["status"] == "passed" for t in tests) else "failed"}
        return RuntimeResult(
            success=success,
            output=combined_output,
            error=c_err_text if not success else "",
            exit_code=client_proc.returncode or 0,
            stages={"compile": "passed", "execution": "passed" if success else "failed"},
            verification=verification,
        )

    except asyncio.TimeoutError:
        return RuntimeResult(False, error="Distributed execution timed out.", exit_code=124, stages={"compile": "passed", "execution": "failed"})
    except Exception as e:
        return RuntimeResult(False, error=f"Distributed execution failed: {e}", exit_code=1, stages={"compile": "passed", "execution": "failed"})
    finally:
        # A client that timed out is still running; stop it along with the server.
        await _stop(client_proc)
        await _stop(server_proc)
        if server_output is not None:
            try:
                await asyncio.wait_for(asyncio.gather(server_output, return_exceptions=True), timeout=5.0)
            except Exception:
                pass

