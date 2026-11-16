---
name: memory-navigate
description: Navigate the LabMate codebase, resolve symbols, find FastAPI/Next.js routes, and trace dependencies using memory.graph without scanning all repository files. Use at task start or before grepping across backend/frontend.
---

# Memory Navigate

Locate relevant files, classes, functions, routes, and dependencies via targeted CLI queries against `memory.graph`. Never load `.memory/symbols.json` or `.memory/dependencies.json` directly into context.

## Steps

1. Read `memory.graph` (only if you need the high-level domain map or entry points), or run:
   ```bash
   python .claude/tools/memory_graph.py query overview
   ```
2. Query the specific slice you need:
   - **Find a function/class:** `python .claude/tools/memory_graph.py query symbol <SymbolName>`
   - **Inspect one module:** `python .claude/tools/memory_graph.py query file <path_or_partial_name>`
   - **Trace callers & tests before refactoring:** `python .claude/tools/memory_graph.py query deps <path_or_partial_name>`
   - **Locate an API or page route:** `python .claude/tools/memory_graph.py query route <path_or_handler>`
   - **Explore a subsystem:** `python .claude/tools/memory_graph.py query domain <domain_name>`
3. Read only the matched source file(s) and line ranges returned by the query. Queries automatically refresh any matched file whose live SHA-256 differs from `.memory/meta.json`.

