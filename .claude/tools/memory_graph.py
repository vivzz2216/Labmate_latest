#!/usr/bin/env python3
"""Incremental AST & Dependency Memory Graph engine for LabMate.

Zero external dependencies (Python standard library only).
Builds and incrementally maintains `memory.graph` and `.memory/` JSON shards so
coding agents can resolve symbols, call/import edges, API routes, and module
summaries without scanning 200+ repository files repeatedly.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "1.0.0"

SKIP_DIRS = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    ".next",
    "__pycache__",
    "audit_artifacts",
    "react_temp",
    "uploads",
    "screenshots",
    "reports",
    "htmlcov",
    ".pytest_cache",
    "dist",
    "build",
    "out",
    ".memory",
    ".claude",
    "logs",
    "local_data",
}

INDEX_EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".jsx", ".mjs"}

TS_IMPORT_RE = re.compile(
    r"""(?:import\s+(?:[\s\S]*?\s+from\s+)?|require\s*\(\s*|import\s*\(\s*)['"]([^'"]+)['"]""",
    re.MULTILINE,
)
TS_EXPORT_RE = re.compile(
    r"""^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|type|interface|enum)\s+([A-Za-z0-9_]+)""",
    re.MULTILINE,
)
TS_DEFAULT_FUNC_RE = re.compile(
    r"""^\s*export\s+default\s+(?:async\s+)?function\s*([A-Za-z0-9_]*)""",
    re.MULTILINE,
)

HTTP_METHODS = {"get", "post", "put", "patch", "delete", "options", "head", "websocket"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def find_repo_root(start: Path | None = None) -> Path:
    cur = (start or Path(__file__)).resolve()
    if cur.is_file():
        cur = cur.parent
    for candidate in [cur, *cur.parents]:
        if (candidate / "backend" / "app" / "main.py").exists() or (candidate / ".git").exists():
            return candidate
    return Path.cwd().resolve()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_head(root: Path) -> str:
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(root),
            stderr=subprocess.DEVNULL,
            timeout=2,
        )
        return out.decode("utf-8", "ignore").strip()
    except Exception:
        return "unknown"


def classify_domain(rel_path: str) -> str:
    p = rel_path.replace("\\", "/")
    if p.startswith("backend/app/routers/"):
        return "api_routers"
    if p.startswith("backend/app/security/") or p.startswith("backend/app/middleware/"):
        return "security_auth"
    if p.startswith("backend/app/services/"):
        name = Path(p).stem
        if any(k in name for k in ("runtime", "colab", "sql_", "dc_", "spark", "ubuntu", "web_project", "webdev", "flask", "java_gui", "executor")):
            return "execution_runtimes"
        if any(k in name for k in ("screenshot", "capture", "composer", "docx", "report", "browser", "viewport")):
            return "capture_reports"
        if "billing" in name:
            return "billing"
        return "workflow_services"
    if p.startswith("backend/app/"):
        return "backend_core"
    if p.startswith("backend/tests/"):
        return "backend_tests"
    if p.startswith("backend/scripts/") or p.startswith("backend/railway_runtime/"):
        return "workers_scripts"
    if p.startswith("frontend/app/"):
        return "frontend_pages"
    if p.startswith("frontend/components/"):
        return "frontend_components"
    if p.startswith("frontend/lib/") or p.startswith("frontend/contexts/"):
        return "frontend_lib"
    if p.startswith("frontend/"):
        return "frontend_other"
    if p.startswith(("chrome_extension/", "google_colab/", "sql_workbench/")):
        return "extensions_templates"
    return "other"


def _decorator_name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return f"{_decorator_name(node.value)}.{node.attr}"
    if isinstance(node, ast.Call):
        return _decorator_name(node.func)
    return ""


def _extract_route(dec: ast.AST) -> tuple[str, str] | None:
    if not isinstance(dec, ast.Call) or not isinstance(dec.func, ast.Attribute):
        return None
    method = dec.func.attr.lower()
    if method not in HTTP_METHODS:
        return None
    base = _decorator_name(dec.func.value).lower()
    if "router" not in base and "app" not in base:
        return None
    route_path = ""
    if dec.args and isinstance(dec.args[0], ast.Constant) and isinstance(dec.args[0].value, str):
        route_path = dec.args[0].value
    return (method.upper(), route_path)


def _format_args(args: ast.arguments) -> list[str]:
    out = [a.arg for a in getattr(args, "posonlyargs", [])]
    out.extend(a.arg for a in args.args)
    if args.vararg:
        out.append(f"*{args.vararg.arg}")
    out.extend(a.arg for a in args.kwonlyargs)
    if args.kwarg:
        out.append(f"**{args.kwarg.arg}")
    return out


def parse_python_file(rel_path: str, raw: bytes) -> dict[str, Any]:
    text = raw.decode("utf-8", errors="replace")
    loc = len(text.splitlines())
    entry: dict[str, Any] = {
        "lang": "python",
        "domain": classify_domain(rel_path),
        "loc": loc,
        "doc": "",
        "imports": [],
        "classes": [],
        "functions": [],
        "routes": [],
        "exports": [],
        "parse_error": None,
    }
    try:
        tree = ast.parse(text, filename=rel_path)
    except SyntaxError as exc:
        entry["parse_error"] = f"SyntaxError line {exc.lineno}: {exc.msg}"
        return entry

    doc = ast.get_docstring(tree) or ""
    entry["doc"] = doc.strip().splitlines()[0][:180] if doc.strip() else ""

    router_prefix = ""
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for tgt in node.targets:
                if isinstance(tgt, ast.Name) and tgt.id == "__all__" and isinstance(node.value, (ast.List, ast.Tuple, ast.Set)):
                    entry["exports"] = [
                        elt.value for elt in node.value.elts if isinstance(elt, ast.Constant) and isinstance(elt.value, str)
                    ]
                if isinstance(tgt, ast.Name) and tgt.id == "router" and isinstance(node.value, ast.Call):
                    for kw in node.value.keywords:
                        if kw.arg == "prefix" and isinstance(kw.value, ast.Constant) and isinstance(kw.value.value, str):
                            router_prefix = kw.value.value

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                entry["imports"].append({
                    "module": alias.name,
                    "names": [],
                    "level": 0,
                    "line": node.lineno,
                })
        elif isinstance(node, ast.ImportFrom):
            entry["imports"].append({
                "module": node.module or "",
                "names": [a.name for a in node.names],
                "level": node.level or 0,
                "line": node.lineno,
            })

    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            methods = []
            for item in node.body:
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    methods.append({
                        "name": item.name,
                        "line": item.lineno,
                        "async": isinstance(item, ast.AsyncFunctionDef),
                        "args": _format_args(item.args),
                    })
            cdoc = ast.get_docstring(node) or ""
            entry["classes"].append({
                "name": node.name,
                "line": node.lineno,
                "bases": [_decorator_name(b) or ast.unparse(b) for b in node.bases][:5],
                "doc": cdoc.strip().splitlines()[0][:140] if cdoc.strip() else "",
                "methods": methods,
            })
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            decs = [_decorator_name(d) for d in node.decorator_list]
            routes = []
            for d in node.decorator_list:
                rt = _extract_route(d)
                if rt:
                    m, path = rt
                    full_path = f"/api{router_prefix}{path}" if router_prefix or not path.startswith("/api") else path
                    if rel_path == "backend/app/main.py":
                        full_path = path
                    routes.append({"method": m, "path": full_path, "handler": node.name, "line": node.lineno})
                    entry["routes"].append({"method": m, "path": full_path, "handler": node.name, "line": node.lineno})
            fdoc = ast.get_docstring(node) or ""
            entry["functions"].append({
                "name": node.name,
                "line": node.lineno,
                "async": isinstance(node, ast.AsyncFunctionDef),
                "args": _format_args(node.args),
                "doc": fdoc.strip().splitlines()[0][:140] if fdoc.strip() else "",
                "decorators": [d for d in decs if d],
            })

    if not entry["exports"]:
        entry["exports"] = [
            *(c["name"] for c in entry["classes"] if not c["name"].startswith("_")),
            *(f["name"] for f in entry["functions"] if not f["name"].startswith("_")),
        ]
    return entry


def parse_ts_js_file(rel_path: str, raw: bytes) -> dict[str, Any]:
    text = raw.decode("utf-8", errors="replace")
    ext = Path(rel_path).suffix.lower()
    lang = "typescript" if ext in {".ts", ".tsx"} else "javascript"
    imports = [{"module": m.group(1), "names": [], "level": 0, "line": text[:m.start()].count("\n") + 1} for m in TS_IMPORT_RE.finditer(text)]
    exports = list(dict.fromkeys(m.group(1) for m in TS_EXPORT_RE.finditer(text)))
    for m in TS_DEFAULT_FUNC_RE.finditer(text):
        nm = m.group(1) or "default"
        if nm not in exports:
            exports.append(nm)

    routes = []
    norm = rel_path.replace("\\", "/")
    if norm.startswith("frontend/app/") and (norm.endswith("/page.tsx") or norm.endswith("/route.ts")):
        sub = norm[len("frontend/app"):]
        sub = sub.rsplit("/", 1)[0] or "/"
        if not sub.startswith("/"):
            sub = "/" + sub
        routes.append({"method": "PAGE" if norm.endswith("/page.tsx") else "API", "path": sub, "handler": exports[0] if exports else "default", "line": 1})

    return {
        "lang": lang,
        "domain": classify_domain(rel_path),
        "loc": len(text.splitlines()),
        "doc": "",
        "imports": imports,
        "classes": [],
        "functions": [{"name": e, "line": 1, "async": False, "args": [], "doc": "", "decorators": []} for e in exports],
        "routes": routes,
        "exports": exports,
        "parse_error": None,
    }


def parse_source_file(rel_path: str, raw: bytes) -> dict[str, Any]:
    if rel_path.endswith(".py"):
        return parse_python_file(rel_path, raw)
    return parse_ts_js_file(rel_path, raw)


def scan_repo_files(root: Path) -> dict[str, Path]:
    found: dict[str, Path] = {}
    for dp, dns, fs in os.walk(root):
        dns[:] = sorted(d for d in dns if d not in SKIP_DIRS and not d.startswith(".venv"))
        for fname in sorted(fs):
            ext = os.path.splitext(fname)[1].lower()
            if ext in INDEX_EXTENSIONS:
                full = Path(dp) / fname
                rel = full.relative_to(root).as_posix()
                found[rel] = full
    return found


def build_module_lookup(files: list[str]) -> tuple[dict[str, str], dict[str, str]]:
    """Map Python dotted module names and frontend POSIX paths to relative file paths."""
    py_map: dict[str, str] = {}
    fe_map: dict[str, str] = {}
    for rel in files:
        if rel.endswith(".py"):
            no_ext = rel[:-3]
            dotted = no_ext.replace("/", ".")
            py_map[dotted] = rel
            if no_ext.endswith("/__init__"):
                py_map[no_ext[:-9].replace("/", ".")] = rel
            if rel.startswith("backend/"):
                sub = dotted[len("backend."):]
                py_map[sub] = rel
                if no_ext.endswith("/__init__"):
                    py_map[sub[:-9]] = rel
        else:
            fe_map[rel] = rel
            stem = os.path.splitext(rel)[0]
            fe_map[stem] = rel
            if os.path.basename(stem) == "index":
                fe_map[os.path.dirname(stem)] = rel
    return py_map, fe_map


def resolve_file_imports(
    rel_path: str,
    imports: list[dict[str, Any]],
    py_map: dict[str, str],
    fe_map: dict[str, str],
) -> tuple[list[str], list[str]]:
    internal: list[str] = []
    external: list[str] = []

    if rel_path.endswith(".py"):
        rel_dir = os.path.dirname(rel_path)
        pkg_parts = rel_dir.split("/") if rel_dir else []
        for imp in imports:
            mod = imp.get("module") or ""
            level = int(imp.get("level") or 0)
            names = imp.get("names") or []
            resolved_targets: list[str] = []

            if level > 0:
                up = level - 1
                base_parts = pkg_parts[: len(pkg_parts) - up] if up <= len(pkg_parts) else []
                prefix = ".".join(base_parts)
                cand_mod = f"{prefix}.{mod}".strip(".") if mod else prefix
                if cand_mod in py_map:
                    resolved_targets.append(py_map[cand_mod])
                else:
                    for nm in names:
                        sub = f"{cand_mod}.{nm}".strip(".")
                        if sub in py_map:
                            resolved_targets.append(py_map[sub])
            else:
                if mod in py_map:
                    resolved_targets.append(py_map[mod])
                else:
                    for nm in names:
                        sub = f"{mod}.{nm}".strip(".")
                        if sub in py_map:
                            resolved_targets.append(py_map[sub])

            if resolved_targets:
                for t in resolved_targets:
                    if t != rel_path and t not in internal:
                        internal.append(t)
            else:
                top = (mod.split(".")[0] if mod else "") or (names[0] if names else "")
                if top and top not in external:
                    external.append(top)
    else:
        rel_dir = os.path.dirname(rel_path)
        for imp in imports:
            mod = imp.get("module") or ""
            target = None
            if mod.startswith("@/"):
                cand = "frontend/" + mod[2:]
                target = fe_map.get(cand)
            elif mod.startswith("."):
                joined = os.path.normpath(os.path.join(rel_dir, mod)).replace("\\", "/")
                target = fe_map.get(joined)
            if target and target != rel_path:
                if target not in internal:
                    internal.append(target)
            elif not mod.startswith((".", "@/")):
                pkg = mod.split("/")[0] if not mod.startswith("@") else "/".join(mod.split("/")[:2])
                if pkg and pkg not in external:
                    external.append(pkg)

    return sorted(internal), sorted(external)


def rebuild_dependency_graph(symbols: dict[str, dict[str, Any]]) -> dict[str, dict[str, list[str]]]:
    all_files = sorted(symbols.keys())
    py_map, fe_map = build_module_lookup(all_files)
    edges: dict[str, dict[str, list[str]]] = {
        rel: {"imports_from": [], "imported_by": [], "external": []} for rel in all_files
    }
    rev: dict[str, list[str]] = defaultdict(list)

    for rel in all_files:
        internal, external = resolve_file_imports(rel, symbols[rel].get("imports", []), py_map, fe_map)
        edges[rel]["imports_from"] = internal
        edges[rel]["external"] = external
        for target in internal:
            if target in edges:
                rev[target].append(rel)

    for target, callers in rev.items():
        edges[target]["imported_by"] = sorted(set(callers))
    return edges


def build_modules_summary(
    symbols: dict[str, dict[str, Any]],
    deps: dict[str, dict[str, list[str]]],
) -> dict[str, Any]:
    domains: dict[str, dict[str, Any]] = {}
    for rel, info in sorted(symbols.items()):
        dom = info.get("domain", "other")
        bucket = domains.setdefault(
            dom,
            {"file_count": 0, "total_loc": 0, "routes_count": 0, "top_files": [], "_ranked": []},
        )
        bucket["file_count"] += 1
        bucket["total_loc"] += info.get("loc", 0)
        bucket["routes_count"] += len(info.get("routes", []))
        inbound = len(deps.get(rel, {}).get("imported_by", []))
        bucket["_ranked"].append((inbound, info.get("loc", 0), rel, info.get("doc", "")))

    for dom, bucket in domains.items():
        ranked = sorted(bucket.pop("_ranked"), key=lambda x: (-x[0], -x[1], x[2]))
        bucket["top_files"] = [
            {"path": r[2], "imported_by": r[0], "loc": r[1], "summary": r[3]}
            for r in ranked[:10]
        ]
    return domains


DEFAULT_DECISIONS = [
    {
        "id": "ADR-001",
        "title": "Python 3.11 via uv for Windows local backend & tests",
        "status": "active",
        "reason": "Python 3.14 hits Windows fatal exception 0xc06d007e in platform._wmi_query when importing SQLAlchemy.",
        "files": ["backend/app/database.py", "backend/requirements.txt"],
    },
    {
        "id": "ADR-002",
        "title": "Portable Temurin JDK 17 Windows 11 DLL issue & MinGW TEMP path",
        "status": "active",
        "reason": "Portable JDK binaries under backend/audit_artifacts fail with 0xC0000142 on Windows 11; MinGW gcc/g++ work cleanly when TEMP points to writable backend/react_temp.",
        "files": ["backend/.env", "backend/app/services/runtime_engine.py"],
    },
    {
        "id": "ADR-003",
        "title": "FakeRedis local fallback & execution isolation gate",
        "status": "active",
        "reason": "Local dev falls back to FakeRedis when 127.0.0.1:6379 is absent; backend/.env sets EXECUTION_ISOLATION=required.",
        "files": ["backend/app/cache.py", "backend/app/services/isolated_runtime.py"],
    },
    {
        "id": "ADR-004",
        "title": "RootLayout AuthProvider avoids Next useRouter invariant",
        "status": "active",
        "reason": "BasicAuthContext uses window.location.assign instead of Next useRouter inside RootLayout to avoid E238 router-not-mounted errors.",
        "files": ["frontend/contexts/BasicAuthContext.tsx", "frontend/app/layout.tsx"],
    },
    {
        "id": "ADR-005",
        "title": "Strict Quarantine & Active Asset Protection Policy",
        "status": "active",
        "reason": "Keep backend/labmate.db, .env files, 94 active uploads, 537 active screenshots, and .env compiler folders untouched.",
        "files": ["backend/labmate.db", ".env", "backend/.env", "frontend/.env.local"],
    },
]


class MemoryGraphManager:
    def __init__(self, root: Path | None = None):
        self.root = find_repo_root(root)
        self.memory_dir = self.root / ".memory"
        self.graph_file = self.root / "memory.graph"
        self.meta_file = self.memory_dir / "meta.json"
        self.symbols_file = self.memory_dir / "symbols.json"
        self.deps_file = self.memory_dir / "dependencies.json"
        self.modules_file = self.memory_dir / "modules.json"
        self.decisions_file = self.memory_dir / "decisions.json"
        self.session_file = self.memory_dir / "session.json"

    def _read_json(self, path: Path, default: Any) -> Any:
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                return default
        return default

    def _write_json(self, path: Path, data: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2, sort_keys=False) + "\n", encoding="utf-8")

    def _ensure_decisions_and_session(self) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        decisions = self._read_json(self.decisions_file, DEFAULT_DECISIONS)
        if not self.decisions_file.exists():
            self._write_json(self.decisions_file, decisions)

        session = self._read_json(
            self.session_file,
            {
                "updated_at": utc_now(),
                "active_focus": "Persistent memory.graph indexing & codebase navigation",
                "recent_changes": [],
                "environment_notes": [
                    "Run backend/pytest with Python 3.11 via uv + local_requirements.txt",
                    "Backend: http://127.0.0.1:8000 | Frontend: http://localhost:3000",
                ],
                "handoff_notes": "Initial memory.graph built cleanly.",
            },
        )
        if not self.session_file.exists():
            self._write_json(self.session_file, session)
        return decisions, session

    def build_or_update(self, force_full: bool = False) -> dict[str, Any]:
        t0 = time.perf_counter()
        self.memory_dir.mkdir(parents=True, exist_ok=True)

        old_meta = {} if force_full else self._read_json(self.meta_file, {})
        old_hashes: dict[str, dict[str, Any]] = old_meta.get("files", {})
        symbols: dict[str, dict[str, Any]] = {} if force_full else self._read_json(self.symbols_file, {})

        disk_files = scan_repo_files(self.root)
        new_hashes: dict[str, dict[str, Any]] = {}

        added, modified, deleted, unchanged = [], [], [], []

        for rel in list(symbols.keys()):
            if rel not in disk_files:
                deleted.append(rel)
                symbols.pop(rel, None)

        for rel, full_path in disk_files.items():
            try:
                st = full_path.stat()
            except OSError:
                continue
            prev = old_hashes.get(rel)
            if (
                not force_full
                and prev
                and rel in symbols
                and prev.get("mtime_ns") == st.st_mtime_ns
                and prev.get("size") == st.st_size
            ):
                new_hashes[rel] = prev
                unchanged.append(rel)
                continue

            raw = full_path.read_bytes()
            digest = sha256_bytes(raw)
            new_hashes[rel] = {
                "sha256": digest,
                "size": st.st_size,
                "mtime_ns": st.st_mtime_ns,
            }

            if not force_full and prev and prev.get("sha256") == digest and rel in symbols:
                unchanged.append(rel)
                continue

            if rel in old_hashes and rel in symbols:
                modified.append(rel)
            else:
                added.append(rel)

            symbols[rel] = parse_source_file(rel, raw)

        deps = rebuild_dependency_graph(symbols)
        modules = build_modules_summary(symbols, deps)
        decisions, session = self._ensure_decisions_and_session()

        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
        head = git_head(self.root)
        now = utc_now()

        py_count = sum(1 for v in symbols.values() if v.get("lang") == "python")
        ts_count = sum(1 for v in symbols.values() if v.get("lang") == "typescript")
        js_count = sum(1 for v in symbols.values() if v.get("lang") == "javascript")
        routes_count = sum(len(v.get("routes", [])) for v in symbols.values())

        meta = {
            "schema_version": SCHEMA_VERSION,
            "indexed_at": now,
            "git_head": head,
            "last_duration_ms": elapsed_ms,
            "last_diff": {
                "added": len(added),
                "modified": len(modified),
                "deleted": len(deleted),
                "unchanged": len(unchanged),
            },
            "files": new_hashes,
        }

        graph_manifest = {
            "schema_version": SCHEMA_VERSION,
            "project": {
                "name": "LabMate AI (labmate_latest)",
                "summary": "Automated lab manual parser, multi-language sandbox execution studio, screenshot capture engine, and Word (.docx) report generator.",
                "stack": {
                    "backend": "Python (FastAPI, SQLAlchemy 2.0, Pydantic 2, Playwright, python-docx, pdfplumber)",
                    "frontend": "Next.js 15.5.28, React 18.2, TypeScript 5.2, Tailwind CSS, Axios",
                    "runtimes": ["python", "java", "c", "cpp", "html", "react", "node", "flask", "sql", "colab", "distributed", "ubuntu"],
                },
                "entry_points": {
                    "backend_api": "backend/app/main.py",
                    "workflow_orchestrator": "backend/app/services/assignment_workflow.py",
                    "execution_dispatcher": "backend/app/services/runtime_engine.py",
                    "frontend_home": "frontend/app/page.tsx",
                    "frontend_studio": "frontend/app/code-execution/page.tsx",
                    "frontend_labs_hub": "frontend/app/labs/page.tsx",
                },
            },
            "architecture_map": {
                dom: {
                    "files": info["file_count"],
                    "loc": info["total_loc"],
                    "routes": info["routes_count"],
                    "key_files": [f["path"] for f in info["top_files"][:5]],
                }
                for dom, info in modules.items()
            },
            "shards": {
                "meta": ".memory/meta.json",
                "symbols": ".memory/symbols.json",
                "dependencies": ".memory/dependencies.json",
                "modules": ".memory/modules.json",
                "decisions": ".memory/decisions.json",
                "session": ".memory/session.json",
            },
            "stats": {
                "total_files": len(symbols),
                "python_files": py_count,
                "typescript_files": ts_count,
                "javascript_files": js_count,
                "routes_indexed": routes_count,
                "decisions_count": len(decisions),
                "indexed_at": now,
                "git_head": head,
                "last_duration_ms": elapsed_ms,
            },
        }

        self._write_json(self.meta_file, meta)
        self._write_json(self.symbols_file, symbols)
        self._write_json(self.deps_file, deps)
        self._write_json(self.modules_file, modules)
        self._write_json(self.graph_file, graph_manifest)

        return {
            "total_files": len(symbols),
            "added": added,
            "modified": modified,
            "deleted": deleted,
            "unchanged_count": len(unchanged),
            "duration_ms": elapsed_ms,
        }

    def update_single_file(self, file_path: str) -> dict[str, Any]:
        t0 = time.perf_counter()
        target = Path(file_path)
        if not target.is_absolute():
            target = (self.root / target).resolve()
        else:
            target = target.resolve()

        try:
            rel = target.relative_to(self.root).as_posix()
        except ValueError:
            return {"status": "ignored_outside_repo", "path": str(file_path)}

        if any(part in SKIP_DIRS or part.startswith(".venv") for part in Path(rel).parts):
            return {"status": "ignored_skip_dir", "path": rel}
        if Path(rel).suffix.lower() not in INDEX_EXTENSIONS:
            return {"status": "ignored_extension", "path": rel}

        if not self.symbols_file.exists() or not self.meta_file.exists():
            res = self.build_or_update(force_full=True)
            return {"status": "full_init", "path": rel, "duration_ms": res["duration_ms"]}

        meta = self._read_json(self.meta_file, {"files": {}})
        symbols = self._read_json(self.symbols_file, {})

        if not target.exists():
            action = "deleted" if rel in symbols else "missing"
            symbols.pop(rel, None)
            meta.get("files", {}).pop(rel, None)
        else:
            raw = target.read_bytes()
            st = target.stat()
            digest = sha256_bytes(raw)
            prev = meta.get("files", {}).get(rel)
            if prev and prev.get("sha256") == digest and rel in symbols:
                return {"status": "unchanged", "path": rel, "duration_ms": round((time.perf_counter() - t0) * 1000, 2)}
            action = "modified" if rel in symbols else "added"
            symbols[rel] = parse_source_file(rel, raw)
            meta.setdefault("files", {})[rel] = {
                "sha256": digest,
                "size": st.st_size,
                "mtime_ns": st.st_mtime_ns,
            }

        deps = rebuild_dependency_graph(symbols)
        modules = build_modules_summary(symbols, deps)
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

        meta["indexed_at"] = utc_now()
        meta["git_head"] = git_head(self.root)
        meta["last_duration_ms"] = elapsed_ms

        self._write_json(self.meta_file, meta)
        self._write_json(self.symbols_file, symbols)
        self._write_json(self.deps_file, deps)
        self._write_json(self.modules_file, modules)

        graph = self._read_json(self.graph_file, {})
        if graph:
            graph.setdefault("stats", {})["indexed_at"] = meta["indexed_at"]
            graph["stats"]["total_files"] = len(symbols)
            graph["stats"]["last_duration_ms"] = elapsed_ms
            self._write_json(self.graph_file, graph)

        return {"status": action, "path": rel, "duration_ms": elapsed_ms}

    def verify_freshness(self) -> dict[str, Any]:
        if not self.meta_file.exists() or not self.symbols_file.exists():
            return {"fresh": False, "reason": "memory_not_initialized", "stale": [], "unindexed": [], "deleted": []}

        meta = self._read_json(self.meta_file, {})
        indexed = meta.get("files", {})
        disk = scan_repo_files(self.root)

        stale, unindexed, deleted = [], [], []
        for rel in indexed:
            if rel not in disk:
                deleted.append(rel)
        for rel, full_path in disk.items():
            if rel not in indexed:
                unindexed.append(rel)
                continue
            try:
                st = full_path.stat()
            except OSError:
                continue
            prev = indexed[rel]
            if prev.get("mtime_ns") == st.st_mtime_ns and prev.get("size") == st.st_size:
                continue
            if sha256_bytes(full_path.read_bytes()) != prev.get("sha256"):
                stale.append(rel)

        return {
            "fresh": not (stale or unindexed or deleted),
            "total_indexed": len(indexed),
            "total_on_disk": len(disk),
            "stale": stale,
            "unindexed": unindexed,
            "deleted": deleted,
        }

    def _ensure_live_files(self, paths: list[str]) -> None:
        meta = self._read_json(self.meta_file, {}).get("files", {})
        for rel in paths:
            full = self.root / rel
            if not full.exists():
                self.update_single_file(rel)
                continue
            st = full.stat()
            prev = meta.get(rel)
            if not prev or prev.get("mtime_ns") != st.st_mtime_ns or prev.get("size") != st.st_size:
                if not prev or sha256_bytes(full.read_bytes()) != prev.get("sha256"):
                    self.update_single_file(rel)

    def query_overview(self) -> dict[str, Any]:
        if not self.graph_file.exists():
            self.build_or_update(force_full=True)
        graph = self._read_json(self.graph_file, {})
        session = self._read_json(self.session_file, {})
        decisions = self._read_json(self.decisions_file, [])
        fresh = self.verify_freshness()
        return {
            "project": graph.get("project", {}),
            "stats": graph.get("stats", {}),
            "domains": graph.get("architecture_map", {}),
            "fresh": fresh["fresh"],
            "stale_count": len(fresh["stale"]) + len(fresh["unindexed"]) + len(fresh["deleted"]),
            "active_focus": session.get("active_focus"),
            "decisions_summary": [{"id": d["id"], "title": d["title"]} for d in decisions],
        }

    def query_symbol(self, name: str, limit: int = 20) -> dict[str, Any]:
        symbols = self._read_json(self.symbols_file, {})
        deps = self._read_json(self.deps_file, {})
        needle = name.lower()
        matches = []
        touched_files = []

        for rel, info in symbols.items():
            hit = False
            for cls in info.get("classes", []):
                if needle in cls["name"].lower():
                    hit = True
                    matches.append({"file": rel, "kind": "class", "name": cls["name"], "line": cls["line"], "bases": cls.get("bases", [])})
                for m in cls.get("methods", []):
                    if needle in m["name"].lower():
                        hit = True
                        matches.append({"file": rel, "kind": "method", "name": f"{cls['name']}.{m['name']}", "line": m["line"], "args": m.get("args", [])})
            for fn in info.get("functions", []):
                if needle in fn["name"].lower():
                    hit = True
                    matches.append({"file": rel, "kind": "function", "name": fn["name"], "line": fn["line"], "async": fn.get("async", False), "args": fn.get("args", [])})
            if hit:
                touched_files.append(rel)

        # Truth enforcement: refresh any stale matching file on disk
        if touched_files:
            self._ensure_live_files(touched_files[:30])
            symbols = self._read_json(self.symbols_file, {})
            deps = self._read_json(self.deps_file, {})

        for m in matches[:limit]:
            m["imported_by"] = deps.get(m["file"], {}).get("imported_by", [])[:8]

        return {"query": name, "count": len(matches), "matches": matches[:limit]}

    def query_file(self, rel_or_substr: str) -> dict[str, Any]:
        symbols = self._read_json(self.symbols_file, {})
        norm = rel_or_substr.replace("\\", "/").lstrip("./")
        matched = [rel for rel in symbols if rel == norm]
        if not matched:
            matched = [rel for rel in symbols if norm.lower() in rel.lower()]
        if not matched:
            return {"query": rel_or_substr, "error": "file_not_indexed"}

        self._ensure_live_files(matched[:5])
        symbols = self._read_json(self.symbols_file, {})
        deps = self._read_json(self.deps_file, {})

        results = []
        for rel in matched[:5]:
            info = symbols.get(rel, {})
            results.append({
                "file": rel,
                "domain": info.get("domain"),
                "loc": info.get("loc"),
                "doc": info.get("doc"),
                "classes": [{"name": c["name"], "line": c["line"], "methods": [m["name"] for m in c.get("methods", [])[:12]]} for c in info.get("classes", [])],
                "functions": [{"name": f["name"], "line": f["line"], "args": f.get("args", [])} for f in info.get("functions", [])[:25]],
                "routes": info.get("routes", []),
                "imports_from": deps.get(rel, {}).get("imports_from", []),
                "imported_by": deps.get(rel, {}).get("imported_by", []),
            })
        return {"query": rel_or_substr, "files": results}

    def query_deps(self, target: str) -> dict[str, Any]:
        symbols = self._read_json(self.symbols_file, {})
        deps = self._read_json(self.deps_file, {})
        norm = target.replace("\\", "/").lstrip("./")
        matched = [rel for rel in symbols if rel == norm] or [rel for rel in symbols if norm.lower() in rel.lower()]
        if not matched:
            return {"query": target, "error": "module_not_found"}

        self._ensure_live_files(matched[:5])
        deps = self._read_json(self.deps_file, {})
        out = []
        for rel in matched[:5]:
            edge = deps.get(rel, {})
            tests = [c for c in edge.get("imported_by", []) if c.startswith("backend/tests/")]
            out.append({
                "file": rel,
                "imports_from": edge.get("imports_from", []),
                "imported_by": edge.get("imported_by", []),
                "external_packages": edge.get("external", []),
                "direct_tests": tests,
            })
        return {"query": target, "results": out}

    def query_route(self, route_substr: str) -> dict[str, Any]:
        symbols = self._read_json(self.symbols_file, {})
        needle = route_substr.lower()
        hits = []
        for rel, info in symbols.items():
            for rt in info.get("routes", []):
                if needle in rt["path"].lower() or needle in rt["handler"].lower():
                    hits.append({"file": rel, **rt})
        return {"query": route_substr, "count": len(hits), "routes": hits[:30]}

    def query_domain(self, domain_name: str) -> dict[str, Any]:
        modules = self._read_json(self.modules_file, {})
        if domain_name in modules:
            return {"domain": domain_name, **modules[domain_name]}
        matches = {k: v for k, v in modules.items() if domain_name.lower() in k.lower()}
        return {"query": domain_name, "domains": matches}

    def record_decision(self, adr_id: str, title: str, reason: str, files: list[str]) -> dict[str, Any]:
        decisions, _ = self._ensure_decisions_and_session()
        decisions = [d for d in decisions if d.get("id") != adr_id]
        entry = {"id": adr_id, "title": title, "status": "active", "reason": reason, "files": files, "recorded_at": utc_now()}
        decisions.append(entry)
        self._write_json(self.decisions_file, decisions)
        return entry

    def save_session(self, focus: str, notes: str, changed: list[str]) -> dict[str, Any]:
        _, session = self._ensure_decisions_and_session()
        session["updated_at"] = utc_now()
        if focus:
            session["active_focus"] = focus
        if notes:
            session["handoff_notes"] = notes
        if changed:
            existing = session.get("recent_changes", [])
            session["recent_changes"] = (changed + [c for c in existing if c not in changed])[:15]
        self._write_json(self.session_file, session)
        return session


def main() -> int:
    parser = argparse.ArgumentParser(description="LabMate memory.graph incremental indexer & query tool")
    parser.add_argument("--root", type=Path, default=None, help="Repository root override")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("build", help="Full rebuild of memory.graph and .memory shards")
    sub.add_parser("update", help="Incremental update (only changed/added/deleted files)")
    sub.add_parser("verify", help="Verify memory freshness against live file hashes")
    sub.add_parser("sync-summary", help="Incremental update + compact session startup summary")

    p_uf = sub.add_parser("update-file", help="Incrementally update a single file")
    p_uf.add_argument("path")

    sub.add_parser("hook-post-edit", help="Claude Code PostToolUse hook handler (reads JSON on stdin)")

    p_q = sub.add_parser("query", help="Token-efficient graph queries")
    p_q.add_argument("kind", choices=["overview", "symbol", "file", "deps", "route", "domain"])
    p_q.add_argument("target", nargs="?", default="")

    p_adr = sub.add_parser("record-decision", help="Record an architecture decision in .memory/decisions.json")
    p_adr.add_argument("--id", required=True)
    p_adr.add_argument("--title", required=True)
    p_adr.add_argument("--reason", required=True)
    p_adr.add_argument("--files", nargs="*", default=[])

    p_sess = sub.add_parser("save-session", help="Update .memory/session.json")
    p_sess.add_argument("--focus", default="")
    p_sess.add_argument("--notes", default="")
    p_sess.add_argument("--changed", nargs="*", default=[])

    args = parser.parse_args()
    mgr = MemoryGraphManager(args.root)

    if args.cmd == "build":
        res = mgr.build_or_update(force_full=True)
        print(json.dumps(res, indent=2))
        return 0

    if args.cmd == "update":
        res = mgr.build_or_update(force_full=False)
        print(json.dumps(res, indent=2))
        return 0

    if args.cmd == "update-file":
        res = mgr.update_single_file(args.path)
        print(json.dumps(res))
        return 0

    if args.cmd == "hook-post-edit":
        raw_stdin = sys.stdin.read().strip() if not sys.stdin.isatty() else ""
        file_path = ""
        if raw_stdin:
            try:
                payload = json.loads(raw_stdin)
                ti = payload.get("tool_input") or {}
                file_path = ti.get("file_path") or ti.get("path") or ""
            except Exception:
                file_path = ""
        if file_path:
            mgr.update_single_file(file_path)
        return 0

    if args.cmd == "verify":
        res = mgr.verify_freshness()
        print(json.dumps(res, indent=2))
        return 0 if res["fresh"] else 1

    if args.cmd == "sync-summary":
        res = mgr.build_or_update(force_full=False)
        ov = mgr.query_overview()
        print(
            f"[memory.graph] files={ov['stats'].get('total_files')} "
            f"(py={ov['stats'].get('python_files')}, ts={ov['stats'].get('typescript_files')}) "
            f"routes={ov['stats'].get('routes_indexed')} "
            f"delta=+{len(res['added'])}/~{len(res['modified'])}/-{len(res['deleted'])} "
            f"in {res['duration_ms']}ms | focus: {ov.get('active_focus')}"
        )
        return 0

    if args.cmd == "query":
        if args.kind == "overview":
            out = mgr.query_overview()
        elif args.kind == "symbol":
            out = mgr.query_symbol(args.target)
        elif args.kind == "file":
            out = mgr.query_file(args.target)
        elif args.kind == "deps":
            out = mgr.query_deps(args.target)
        elif args.kind == "route":
            out = mgr.query_route(args.target)
        elif args.kind == "domain":
            out = mgr.query_domain(args.target)
        else:
            out = {}
        print(json.dumps(out, indent=2))
        return 0

    if args.cmd == "record-decision":
        out = mgr.record_decision(args.id, args.title, args.reason, args.files)
        print(json.dumps(out, indent=2))
        return 0

    if args.cmd == "save-session":
        out = mgr.save_session(args.focus, args.notes, args.changed)
        print(json.dumps(out, indent=2))
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())

