"""
Distributed Computing Runtime Engine.
Supports compiling multi-file Java applications and orchestrating concurrent
Server-Client topologies or single-driver distributed simulations.
"""

import asyncio
import os
import re
import signal
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from ..config import settings
from .runtime_engine import RuntimeResult, java_class_name


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
        starts = [m.start() for m in public_classes] + [len(code)]
        for i in range(len(public_classes)):
            cname = public_classes[i].group(1)
            segment = code[starts[i]:starts[i+1]].strip()
            files[f"{cname}.java"] = segment
        return files

    # 4. Fallback: single file
    cname = java_class_name(code) or "DistributedLab"
    files[f"{cname}.java"] = code
    return files


def detect_topology(files: Dict[str, str]) -> Tuple[Optional[str], Optional[str], List[str]]:
    """
    Detect the server class and client class from the set of files.
    Returns: (server_main_class, client_main_class, all_classes_with_main)
    """
    mains: List[str] = []
    server_class: Optional[str] = None
    client_class: Optional[str] = None

    for fname, content in files.items():
        # Check if file has public static void main
        if re.search(r"public\s+static\s+void\s+main\s*\(\s*String", content):
            cname = Path(fname).stem
            mains.append(cname)

            # Heuristics for Server vs Client
            is_server = bool(re.search(
                r"\b(?:Server|Master|Registry|Coordinator|Broker)\b|ServerSocket|LocateRegistry\.createRegistry|rebind\(",
                content + " " + fname,
                re.I,
            ))
            is_client = bool(re.search(
                r"\b(?:Client|Worker|Node|Consumer)\b|new\s+Socket\(|LocateRegistry\.getRegistry|lookup\(",
                content + " " + fname,
                re.I,
            ))

            if is_server and not is_client:
                server_class = cname
            elif is_client and not is_server:
                client_class = cname
            elif is_server and is_client:
                if re.search(r"server", fname, re.I):
                    server_class = cname
                elif re.search(r"client", fname, re.I):
                    client_class = cname

    return server_class, client_class, mains


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

    try:
        proc = await asyncio.create_subprocess_exec(
            *compile_cmd,
            cwd=str(directory),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        c_stdout, c_stderr = await asyncio.wait_for(proc.communicate(), timeout=30.0)
    except asyncio.TimeoutError:
        return RuntimeResult(False, error="Compilation timed out.", exit_code=124, stages={"compile": "failed", "execution": "not_run"})
    except Exception as e:
        return RuntimeResult(False, error=f"Compilation launch failed: {e}", exit_code=1, stages={"compile": "failed", "execution": "not_run"})

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

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(directory),
            stdin=asyncio.subprocess.PIPE if stdin else None,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
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

    server_proc = None
    try:
        # 1. Start Server
        server_proc = await asyncio.create_subprocess_exec(
            *server_cmd,
            cwd=str(directory),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        # 2. Allow server to bind socket or initialize RMI
        await asyncio.sleep(1.8)

        # 3. Check if server died prematurely
        if server_proc.returncode is not None:
            s_out, s_err = await server_proc.communicate()
            err_msg = s_err.decode("utf-8", errors="replace") or s_out.decode("utf-8", errors="replace")
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
            stdin=asyncio.subprocess.PIPE if stdin else None,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        input_bytes = stdin.encode("utf-8") if stdin else None
        c_stdout, c_stderr = await asyncio.wait_for(client_proc.communicate(input=input_bytes), timeout=timeout - 5.0)

        # 5. Give server 1 second to flush final logs, then terminate
        await asyncio.sleep(0.8)
        if server_proc.returncode is None:
            try:
                server_proc.terminate()
                s_stdout, s_stderr = await asyncio.wait_for(server_proc.communicate(), timeout=3.0)
            except Exception:
                server_proc.kill()
                s_stdout, s_stderr = await server_proc.communicate()
        else:
            s_stdout, s_stderr = await server_proc.communicate()

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
        return RuntimeResult(
            success=success,
            output=combined_output,
            error=c_err_text if not success else "",
            exit_code=client_proc.returncode or 0,
            stages={"compile": "passed", "execution": "passed" if success else "failed"},
        )

    except asyncio.TimeoutError:
        return RuntimeResult(False, error="Distributed execution timed out.", exit_code=124, stages={"compile": "passed", "execution": "failed"})
    except Exception as e:
        return RuntimeResult(False, error=f"Distributed execution failed: {e}", exit_code=1, stages={"compile": "passed", "execution": "failed"})
    finally:
        if server_proc and server_proc.returncode is None:
            try:
                server_proc.kill()
            except Exception:
                pass

