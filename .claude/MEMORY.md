# LabMate Auto-Memory

Compact cross-session pointer index. Always verify against live source files before acting.

- **Structured Shards:**
  - Architecture Decisions: `.memory/decisions.json`
  - Active Session Context: `.memory/session.json`
  - Module Summaries: `.memory/modules.json`
- **Key Operational Facts:**
  - Run backend/pytest with Python 3.11 via `uv` (`PYTHONPATH` must include repo root + `backend/`).
  - Never load `.memory/symbols.json` or `.memory/dependencies.json` in full; query via `.claude/tools/memory_graph.py query`.
  - Keep `backend/labmate.db`, `.env*`, `backend/uploads/`, and `backend/screenshots/` untouched.

