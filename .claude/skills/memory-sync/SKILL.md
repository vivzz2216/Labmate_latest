---
name: memory-sync
description: Incrementally update memory.graph, verify freshness against live file hashes, record architecture decisions, or save session handoff notes after making code changes.
---

# Memory Sync

Keep `memory.graph` and `.memory/` synchronized with source code as the single source of truth.

## Operations

- **Incremental update (changed/added/deleted files only):**
  ```bash
  python .claude/tools/memory_graph.py update
  ```
- **Single-file fast refresh:**
  ```bash
  python .claude/tools/memory_graph.py update-file <path>
  ```
- **Verify zero stale entries:**
  ```bash
  python .claude/tools/memory_graph.py verify
  ```
- **Record an Architecture Decision (ADR):**
  ```bash
  python .claude/tools/memory_graph.py record-decision --id ADR-006 --title "<Title>" --reason "<Why>" --files path1 path2
  ```
- **Save Session Handoff Notes:**
  ```bash
  python .claude/tools/memory_graph.py save-session --focus "<Current Focus>" --notes "<Key findings>" --changed path1 path2
  ```

