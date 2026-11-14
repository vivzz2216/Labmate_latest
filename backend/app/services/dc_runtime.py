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
from .runtime_engine import RuntimeResult, java_class_name, run_process, start_process, collect_output, kill_process_tree


def split_java_files(code: str) -> Dict[str, str]:
    """
    Split a combined Java source code string into individual files.
    Supports:
    1. Explicit file headers: '// File: Server.java' or '/* Filename: Client.java */'
    2. Multiple class declarations: 'public class Foo' / 'class Bar'
    """
    files: Dict[str, str] = {}
    # A fenced multi-file response must not leave closing fences/prose in .java.
    blocks = re.findall(r'```(?:java)?\s*\n(.*?)```', code, re.S)
    if blocks:
        code = '\n'.join(blocks)
    
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
    masked = re.sub(r'//[^\n]*|/\*.*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'',
                    lambda m: ' ' * len(m[0]), code, flags=re.S)
    depth = 0
    depths = []
    for character in masked:
        depths.append(depth)
        depth += (character == '{') - (character == '}')
    public_classes = [m for m in re.finditer(r"public\s+(?:final\s+|abstract\s+)?(?:class|interface|enum)\s+(\w+)", masked)
                      if depths[m.start()] == 0]
    if len(public_classes) > 1:
        starts = [m.start() for m in public_classes] + [len(code)]
        for i in range(len(public_classes)):
            cname = public_classes[i].group(1)
            segment = code[starts[i]:starts[i+1]].strip()
            imports = '\n'.join(re.findall(r'(?m)^\s*(?:package|import)\s+[^;]+;', code[:starts[0]]))
            files[f"{cname}.java"] = imports + '\n' + segment
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

    compiled = await run_process(compile_cmd, directory, timeout=30.0,
                                 resource_limits={"max_memory_bytes": 0, "max_cpu_seconds": 30})
    if not compiled.success:
        return RuntimeResult(False, error="Compilation error:\n" + (compiled.error or compiled.output),
                             exit_code=compiled.exit_code, stages={"compile": "failed", "execution": "not_run"})

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

    result = await run_process(cmd, directory, stdin=stdin or "", timeout=timeout,
                               resource_limits={"max_memory_bytes": 0, "max_cpu_seconds": max(1, int(timeout))})
    result.stages = {"compile": "passed", "execution": "passed" if result.success else "failed"}
    result.stages['topology'] = 'single_jvm_local_simulation'
    return result


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
    streams = []
    try:
        # 1. Start Server
        server_proc = await start_process(server_cmd, directory, resource_limits={"max_memory_bytes": 0, "max_cpu_seconds": max(1, int(timeout))})
        server_proc.stdin.close()
        streams = [asyncio.create_task(collect_output(server_proc.stdout, server_proc)),
                   asyncio.create_task(collect_output(server_proc.stderr, server_proc))]

        # 2. Allow server to bind socket or initialize RMI
        await asyncio.sleep(1.8)

        # 3. Check if server died prematurely
        if server_proc.returncode is not None:
            s_out, s_err = await asyncio.gather(*streams)
            err_msg = s_err[0] or s_out[0]
            return RuntimeResult(
                False,
                error=f"Server process terminated unexpectedly:\n{err_msg}",
                exit_code=server_proc.returncode,
                stages={"compile": "passed", "execution": "failed"},
            )

        # 4. Start Client
        client = await run_process(client_cmd, directory, stdin=stdin or "", timeout=max(0.1, timeout - 2.0),
                                   resource_limits={"max_memory_bytes": 0, "max_cpu_seconds": max(1, int(timeout))})

        # 5. Give server 1 second to flush final logs, then terminate
        await asyncio.sleep(0.8)
        await kill_process_tree(server_proc)
        server_out, server_err = await asyncio.gather(*streams)
        s_out_text = server_out[0].strip()
        c_out_text = client.output.strip()
        c_err_text = client.error.strip()

        combined_output = (
            f"=== [SERVER: {server_class}] ===\n"
            f"{s_out_text}\n\n"
            f"=== [CLIENT: {client_class}] ===\n"
            f"{c_out_text}"
        )

        success = client.success and not server_out[1] and not server_err[1]
        return RuntimeResult(
            success=success,
            output=combined_output,
            error=c_err_text if not success else "",
            exit_code=client.exit_code if client.exit_code else (0 if success else 125),
            stages={"compile": "passed", "execution": "passed" if success else "failed",
                    "topology": "separate_jvm_loopback"},
        )

    except asyncio.TimeoutError:
        return RuntimeResult(False, error="Distributed execution timed out.", exit_code=124, stages={"compile": "passed", "execution": "failed"})
    except Exception as e:
        return RuntimeResult(False, error=f"Distributed execution failed: {e}", exit_code=1, stages={"compile": "passed", "execution": "failed"})
    finally:
        if server_proc:
            await kill_process_tree(server_proc)
        for task in streams:
            if not task.done():
                task.cancel()
        if streams:
            await asyncio.gather(*streams, return_exceptions=True)

