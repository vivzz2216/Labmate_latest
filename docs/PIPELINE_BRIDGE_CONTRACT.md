# Runtime bridge contract

Codex owns Python, backend integration, SQL execution, process limits, tests and packaging. Gemini owns the two lab UI directories' JavaScript, HTML, CSS and static UI assets. Do not move those directories.

The browser captures expose these existing JavaScript bindings before loading the page:

- `window.pySqliteBridge(statement)` returns a Promise containing `success`, `dialect: "sqlite"`, `type`, `statement`, `columns`, `rows`, `affectedRows`, `message`, `duration`, `schemaName`, `activeSchema` and `schemas`; failures contain `error`. A session is private, has actual transactions, and rejects file attachment, unsafe PRAGMAs/extensions, oversized results and overdue queries. Process complete scripts in source order; do not substitute a primary query or a JavaScript SQL interpreter.
- `schemas[name].tables[table]` contains real `columns`, a bounded `rows` preview, the exact `rowCount`, and `rowsTruncated`. Display `rowCount`, not preview length, as the table's row total. Update the current schema from `activeSchema`.
- `window.pyColabBridge({cellIndex, code})` returns the real executed-cell payload: `type`, `code`, `stdout`, `stderr`, `repr`, `html`, `plots` (PNG data URLs), `error`, `execCount`, `execTime`, and dataset provenance. Never locally evaluate Python. Screenshot adapters include a labelled stderr transcript in display output so warnings remain visible. Machine verification retains stdout/stderr separately.
- UI-only pages without a binding must say that the runtime is not connected; they must not report fabricated Python, SQL or GPU results.
- Notebook requests may additionally contain `datasets: {filename: csvText}`; unchanged uploads do not overwrite files modified by earlier cells. Use `{command: "reset"}` for an explicit runtime restart. The main process API accepts the same dataset mapping in each `questions[].datasets`; the main assignment-page CSV attachment picker remains a UI follow-up.
- Runtime identity is local Python, not a Google-hosted GPU. Hardware availability is unknown unless explicitly measured; current workers provide no GPU claim.
- Notebook upload code may be Python source or an ipynb JSON document. Saved notebook outputs are ignored and code is executed again. Teacher datasets are supplied as text/bytes; `/content/` aliases map into a private workspace. Drive mounts and remote downloads are unavailable. Missing data fails with an upload request; synthetic data requires explicit opt-in and is labelled.
- Native notebook execution requires an explicit application beta allowlist. Resource limits, restricted environment, process isolation, filesystem/network restrictions and timeout termination are defense in depth; this is not a claim of an unrestricted public OS sandbox.

Root and backend Dockerfiles now build from the repository root and install UI assets under `/app/lab_resources`. Backend Railway source root must therefore be the repository root; use the root Railway config or `backend/railway.json` with the backend Dockerfile path. Linux builds and live deployment require separate verification.
