"""Validation for restricted local execution when a container runtime is unavailable."""

import ast
import re

def validate_generated_code(code: str, language: str):
    """Restrict generated lab programs before the existing local execution fallback."""
    if len(code) > 50000:
        raise ValueError("Generated code exceeds the supported size.")
    if language == "python":
        tree = ast.parse(code)
        safe_modules = {"math", "random", "statistics", "decimal", "fractions", "collections", "itertools", "functools", "operator", "string", "re", "json", "csv", "datetime", "copy", "heapq", "bisect", "array", "typing", "dataclasses", "enum", "abc"}
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                modules = [name.name for name in node.names] if isinstance(node, ast.Import) else [node.module or ""]
                if any(module.split(".")[0] not in safe_modules for module in modules):
                    raise ValueError("This program needs an unsupported import for local execution.")
            safe_parent_initializer = (
                isinstance(node, ast.Attribute) and node.attr == "__init__"
                and isinstance(node.value, ast.Call)
                and isinstance(node.value.func, ast.Name)
                and node.value.func.id == "super" and not node.value.args and not node.value.keywords
            )
            if isinstance(node, ast.Attribute) and node.attr.startswith("__") and not safe_parent_initializer:
                raise ValueError("Runtime introspection is not supported in lab execution.")
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                if node.func.id in {"eval", "exec", "compile", "__import__", "getattr", "setattr", "globals", "locals", "vars", "breakpoint"}:
                    raise ValueError("This program uses an unsupported runtime operation.")
                if node.func.id == "open":
                    if not node.args or not isinstance(node.args[0], ast.Constant) or not isinstance(node.args[0].value, str):
                        raise ValueError("File exercises must use a named file in the lab working directory.")
                    name = node.args[0].value
                    if name in {".", ".."} or any(char in name for char in "/\\:"):
                        raise ValueError("File access must stay inside the lab working directory.")
    elif language in {"java", "c", "cpp", "node"}:
        stripped = re.sub(r'//[^\n]*|/\*.*?\*/|"(?:\\.|[^"\\])*"', '', code, flags=re.S)
        guarded_code = re.sub(r"process\.env\.PORT\b", "runtime_port", stripped)
        if re.search(r"ProcessBuilder|Runtime\s*\.\s*getRuntime|\b(system|popen|exec|fork|socket|spawn|execSync|getenv)\s*\(|child_process|process\.env|/etc/|/proc/|cmd\.exe|powershell\.exe", guarded_code, re.I):
            raise ValueError("This program requests system access outside the lab runtime.")
