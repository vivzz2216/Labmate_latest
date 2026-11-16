# CLAUDE.md — LabMate Project Guide

## Project Overview
LabMate AI automates lab manual parsing, multi-language sandbox execution (Python, Java, C/C++, HTML/React/Node/Flask, MySQL, Google Colab/Deep Learning, Distributed Java, Ubuntu), IDE-themed screenshot capture, and Word (`.docx`) report generation.

- **Backend (`backend/app/`):** Python / FastAPI (`backend/app/main.py` mounts 15 `/api` routers), SQLAlchemy 2.0, Pydantic 2.13, Playwright, `python-docx`, `pdfplumber`.
- **Frontend (`frontend/`):** Next.js 15.5.28, React 18.2, TypeScript 5.2, Tailwind CSS, Axios (`/api/[...path]` proxies to backend).
- **Entry Points:** `backend/app/main.py`, `backend/app/services/assignment_workflow.py`, `backend/app/services/runtime_engine.py`, `frontend/app/page.tsx`, `frontend/app/code-execution/page.tsx`, `frontend/app/labs/page.tsx`.

## Navigation & Memory Protocol (Token Efficiency)
Query the sharded graph before scanning directories or grepping across 200+ files. Source code on disk is always the single source of truth; verify live files before editing.

- **Root Index:** Read [memory.graph](memory.graph) for architecture map & stats (never load full `.memory/symbols.json` into context).
- **Targeted Queries:**
  - `python .claude/tools/memory_graph.py query overview` — compact architecture + freshness check
  - `python .claude/tools/memory_graph.py query symbol <Name>` — exact file, line numbers, args & callers
  - `python .claude/tools/memory_graph.py query file <path_or_stem>` — classes, functions, routes & edges
  - `python .claude/tools/memory_graph.py query deps <path_or_stem>` — imports, reverse callers & direct tests
  - `python .claude/tools/memory_graph.py query route <url_or_handler>` — FastAPI & Next.js route lookup
  - `python .claude/tools/memory_graph.py query domain <domain>` — module summary (`api_routers`, `execution_runtimes`, `capture_reports`, `workflow_services`, `security_auth`, `billing`, `frontend_pages`, etc.)
- **Skills:** Use `.claude/skills/memory-navigate/SKILL.md` for navigation and `.claude/skills/memory-sync/SKILL.md` for refreshing memory, recording ADRs (`.memory/decisions.json`), and saving session notes (`.memory/session.json`).

## Verified Local Commands (Windows)
- **Backend Tests (use Python 3.11 via `uv`; Python 3.14 `.venv` hits `_wmi_query` `0xc06d007e`):**
  ```powershell
  $env:PYTHONPATH = "$PWD;$PWD\backend"
  uv run --python "$env:APPDATA\uv\python\cpython-3.11-windows-x86_64-none\python.exe" --with-requirements backend/requirements.txt --with pytest --with pytest-asyncio python -m pytest -o addopts="" backend/tests/<suite>.py -q
  ```
- **Frontend Checks & Dev Server:**
  ```powershell
  cd frontend
  npx tsc --noEmit
  npm run lint
  npm run dev -- -p 3000
  ```

## Environment & Safety Guardrails
- Preserve `.env`, `backend/.env`, `frontend/.env.local`, `backend/labmate.db`, `backend/uploads/`, `backend/screenshots/`, and compiler paths in `backend/audit_artifacts/` (`local-check-20261025/java-runtime` and `stress-20261026/compiler/mingw64`).
- On Windows, MinGW `gcc`/`g++` require a writable `TEMP` directory (such as `backend/react_temp`). Portable JDK 17 binaries under `audit_artifacts` return `0xC0000142` on Windows 11; use a system JDK or Linux/Docker container for Java execution.
- Read `.memory/decisions.json` before modifying auth, billing, or `RootLayout` (`BasicAuthContext` avoids `useRouter` inside `RootLayout`).
