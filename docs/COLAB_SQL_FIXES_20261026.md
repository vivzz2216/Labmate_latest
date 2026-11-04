# Colab and SQL fixes 2026 10 26

**Local backend verification passes. Public deployment remains restricted to the configured beta allowlist.** The native notebook restrictions are defense in depth, not a substitute for an OS sandbox. No Railway deployment was applied or claimed.

## Implemented

- SQL screenshots and the advanced runner share `SQLSession`, a real SQLite adapter. Joins, expressions, NULL handling, HAVING, LIMIT, set operations and transactions are evaluated by SQLite. Unknown SQL/columns fail rather than returning invented values. The runtime is labelled SQLite; native MySQL compatibility is not claimed.
- SQL file attachment/detachment, unsafe PRAGMAs, extensions and file functions are denied. Statement count, result size, database count, column count and query duration are bounded. Foreign keys remain enabled. Transaction rollback is real.
- Colab cells run in persistent private child interpreters with a restricted environment, filesystem/network/process controls and enforceable timeout termination. Windows Job Objects enforce memory/process limits and kill the process tree; Linux workers apply resource limits and drop root privileges when started by root. Python execution no longer changes the backend's cwd or Matplotlib/Pandas state.
- Each student has independent state and plots. Uploaded datasets are provisioned once and can be updated by later cells. `/content/` and relative dataset aliases resolve inside the student's workspace. Drive mounts and remote downloads fail clearly.
- Missing CSVs request supplied data. Synthetic CSV generation requires explicit opt-in and emits provenance and hashes. Runtime stderr and full cell tracebacks are retained. Failed executions stay failed even when a diagnostic image is successfully captured.
- Notebook capture accepts multiple ipynb cells, ignores saved outputs and executes source again. Rendering preserves notebook naming, student initials and dataset metadata; captures block external requests and use the portable browser launcher.
- The workflow accepts SQL and notebook modes, preserves their extraction classification, supports provided dataset text in question metadata, selects real database/notebook evidence, and creates successful or diagnostic Word reports. The execution page exposes SQL and Python Notebook language choices. Dataset text is supported by the process API and standalone pipeline; a dedicated CSV attachment picker on the main assignment page has not been added in this backend change.
- Root-context Docker builds include both UI resource directories, with an explicit resource root and declared ML dependencies. NumPy pins distinguish Python 3.11 from newer interpreters. Backend Railway builds must use repository root context as documented in `PIPELINE_BRIDGE_CONTRACT.md`.
- The advanced SQL runner executes every displayed statement, validates primary-query columns and independent fixture values, checks transaction effects, and embeds a screenshot for every SELECT result. The 10-question sample report contains 14 execution images.
- The six Colab sample experiments pass with the new runtime. One bundled sample used `mean()` on mixed text/numeric columns; its source now explicitly uses `mean(numeric_only=True)`. The sample no longer claims that corrected code is verbatim. Uploaded manuals were not changed, and no global pandas monkey patch was restored.

## Verification

| Check | Result |
| --- | --- |
| Full backend suite | 534 passed |
| Focused native/runtime, live browser bridges, queue isolation and receipt-preservation checks | 11 passed |
| Advanced SQL sample with full scripts, columns, values and rollback checks | 10 of 10 passed |
| Concurrent Colab ML samples | 6 of 6 passed |
| SQL/notebook assignment to Word, supplied CSV and failed SQL diagnostic | 4 cases |
| Frontend TypeScript check | Passed |
| Installed dependency consistency | `pip check` passed |
| Linux image and live Railway | Not verified; Docker daemon unavailable |

The focused checks were rerun during implementation; counts overlap and are not an aggregate total. Additional changes after the broad suite were checked through the relevant focused tests and the SQL/ML sample runners. No model API calls were required. Fresh AI-generated solutions and Google-hosted/GPU execution were not tested or claimed.

The current UI JavaScript was tested through the real `pySqliteBridge` and `pyColabBridge` callbacks, including Python floor division, stderr display and removal of malicious Markdown event handlers. UI files remained in Gemini's ownership; backend callbacks and their contract are documented separately.

## Evidence

All raw logs and outputs are in `backend/audit_artifacts/colab-sql-fixes-20261026/`:

- `backend-tests.log` / `backend-tests.xml`
- `bridge-tests-final.log`, `runtime-tests.log`, `os-limits-tests.log`
- `workflow-tests-final.log` and `workflow-proof/` including the diagnostic Word report
- `advanced-sql-tests.log` and `advanced-sql/` including 14 per-result screenshots and the SQL Word report
- `colab-sample-tests-final.log` and `colab-samples/` including six student captures, combined notebook PNG, printable PDF and Word report
- `frontend-typecheck.log` and `pip-check.log`

Application deployment, native MySQL support, public unrestricted execution and a main-page dataset attachment UI remain separate from these verified backend fixes.
