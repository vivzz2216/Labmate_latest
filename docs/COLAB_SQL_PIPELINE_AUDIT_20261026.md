# Colab and SQL pipeline audit 2026 10 26

Follow-up: the findings below record the original audited state. Backend fixes and current test results are documented in `COLAB_SQL_FIXES_20261026.md`; use that follow-up for implementation status.

**FAIL for public deployment and complete manual processing.** Basic captures and local Python ML execution work. The adversarial and stateful cases below expose reproducible defects. This audit changes no application code and makes no model API calls.

## Tested scope

- Existing `backend/tests/test_sql_screenshot.py`: **1 passed**. It checks that a 1440 by 900 image exists, not SQL correctness.
- Seven browser SQL cases compared with an independent SQLite oracle for shared SQL semantics: **1 passed, 6 failed**. These tests run the same JavaScript engine used by ScreenshotService. They do not claim SQLite is a complete MySQL substitute.
- Real local Colab kernel: state persists between two cells; teacher CSV reads correctly initially; linear regression predicts 8; a Matplotlib PNG is captured. These five checks pass.
- Finite queue timeout, controlled two-kernel plotting interleaving, teacher-file mutation, uploaded-data paths, browser rerun, language/theme contracts and isolated SQLite bridge access were also exercised.
- No genuine Google-hosted runtime, MySQL server or Railway container was tested. Deployment findings below come from inspecting the actual build files, dependency declarations and path construction.

## Findings

### P1 Incorrect SQL results and unsupported statements reported as successful

Locations: `sql_workbench/app.js:763`, `sql_workbench/app.js:877`, `sql_workbench/app.js:912`.

Using a table containing NULL, 10 and 20:

| Case | Expected | Observed |
| --- | --- | --- |
| Plain SELECT | Original three rows | Correct |
| AVG and MIN | AVG 15, MIN 10 | AVG 10, MIN 0; success true |
| Unknown column | SQL error | Returns the column name as a literal value in each row; success true |
| `v * 2 AS doubled` | NULL, 20, 40 | Returns literal expression text in every row; success true |
| JOIN | Three joined rows | Parse failure |
| `THIS IS NOT SQL` | Syntax error | General no-op; success true |
| BEGIN, UPDATE to 999, ROLLBACK | Original value 10 | Value remains 999; success true |

Root causes: `Number(null)` becomes zero during aggregate input conversion; projection falls back to the source expression as a string; unsupported statements fall through to a successful GENERAL result; transactions have no real state semantics in this engine.

Minimal direction: route execution through one real, isolated database engine; compare actual result values and types, and reject unsupported syntax explicitly. Do not label SQLite-only execution as verified MySQL compatibility.

### P1 Advanced SQL tests and screenshot capture use different engines

Locations: `sql_workbench/automate_advanced_sql.py:407`, `sql_workbench/app.js:1270`, `backend/app/services/screenshot_service.py:926`.

The advanced runner installs `window.pySqliteBridge`, using actual SQLite. ScreenshotService never installs this bridge and instead uses the incomplete JavaScript engine. A passing advanced-demo run therefore does not verify the execution path used by SQL screenshot generation. The live JOIN probe above fails on that path.

Minimal direction: share the validated execution implementation between the runner and the service instead of installing it only in the demonstration script.

### P1 Timeout does not stop execution and kernels share the host process

Locations: `google_colab/colab_pipeline.py:291`, `google_colab/colab_pipeline.py:322`, `google_colab/colab_pipeline.py:535`.

`submit_job` returns an execution timeout while its ThreadPool worker continues running. With a 0.1 second limit, the call returned after approximately 0.115 seconds, and a finite 0.7 second student job subsequently wrote the audit marker file. An endless job would retain the worker and kernel lock; this audit deliberately did not execute one.

The kernel also directly executes code inside the application process, inherits its environment and changes its process-wide working directory. A harmless environment marker planted by this audit was readable by a cell. No real secret was read.

The SQLite bridge has a corresponding boundary problem: executing its actual function against an innocuous audit-only database allowed ATTACH and reading a table outside an isolated in-memory database. No application database was accessed.

Minimal direction: execute untrusted Python and SQL in restricted processes/services with enforceable kill, resource, filesystem, environment and network limits. Deny SQLite file attachment/access where applicable. Restrict access until that boundary exists.

### P1 Concurrent students can erase each other's plot evidence

Locations: `google_colab/colab_pipeline.py:264`, `google_colab/colab_pipeline.py:274`, `google_colab/colab_pipeline.py:280`.

Only cell execution takes the kernel lock. Constructing another kernel calls reset and `plt.close("all")` outside that lock. A controlled interleaving created student A's plot, constructed student B's kernel, then allowed A to capture: **0 plots instead of 1**, with no execution error.

Minimal direction: process isolation per kernel. Locking constructor/reset as well as execution can prevent this specific interleaving, but does not isolate the shared process from unrelated backend work.

### P1 Manual upload routing and production packaging are incomplete

Locations: `backend/app/routers/workflows.py:28`, `backend/app/services/assignment_workflow.py:35`, `backend/app/schemas.py:37`, `backend/app/services/screenshot_service.py:927`, `backend/Dockerfile:22`.

Observed through real model validation and execution boundaries:

- SQL is rejected by the question language contract and runtime. A numbered SQL exercise is extracted as Python.
- Colab is not an accepted screenshot theme in RunRequest; the ordinary Python workflow selects IDLE. Treating Colab as Python is reasonable, but a notebook execution/presentation mode still needs to be routed explicitly.
- Docker copies only backend app/templates/migrations/startup files. It does not copy the sibling `google_colab` or `sql_workbench` directories. Both are currently untracked by Git.
- Three-parent path construction assumes the development repository layout. With the declared `/app/app/services` image layout it points to root-level `/google_colab` and `/sql_workbench`, not an installed shared resource directory.
- The Colab module imports numpy, pandas, scikit-learn and matplotlib, none of which is declared in `backend/requirements.txt` or a separate requirements file in the pipeline directories.
- Dedicated Colab rendering chooses hardcoded Windows Chrome/Edge paths (`google_colab/colab_pipeline.py:367`), so that renderer is not portable to the Linux image even if its other resources are supplied.

Minimal direction: add a deliberate SQL language and notebook mode through extraction, API, execution and evidence planning; package assets and modules under a configured runtime resource root; declare the ML dependencies; reuse the existing portable browser launcher; verify a clean Linux build.

### P2 Teacher data changes disappear between cells and Colab paths fail

Locations: `google_colab/colab_pipeline.py:223`, `google_colab/colab_pipeline.py:237`, `google_colab/colab_pipeline.py:289`.

Teacher files are copied/written before every cell, overwriting the student's file changes. After writing a teacher CSV containing only value 999, the next cell reads the original values **10, 20, 30**.

Dataset provisioning strips paths to basenames, while code still uses its original path. `pd.read_csv("/content/teacher.csv")` fails with FileNotFoundError despite teacher.csv being supplied successfully. Relative subdirectories have the same path mismatch.

Minimal direction: provision teacher data once per kernel or on explicit upload/reset; safely map supported notebook paths into the workspace. Keep actual file changes stateful between cells.

### P2 Rerunning a displayed Colab cell changes execution engines

Locations: `google_colab/app.js:87`, `google_colab/app.js:153`, `google_colab/app.js:619`.

Initial snapshots can contain actual Python results, but the Run button calls a JavaScript Python approximation, not the real kernel. `print(2+3)` works; `print(7 // 2)` produces a JavaScript syntax error instead of 3. The simulated torch module also hardcodes CUDA availability true and the device name Tesla T4.

Minimal direction: route interactive runs to the same stateful backend kernel, and derive hardware metadata from that runtime. Do not substitute JavaScript evaluation for Python execution.

### P2 Verification coverage can miss incorrect advanced SQL answers

Inspection-only finding: `sql_workbench/automate_advanced_sql.py:566` obtains columns but does not compare them with the numerous `expected_columns` fixtures. It mostly checks row counts and occasionally the first employee name. Incorrect salaries, aggregates and ranks with the right row count can escape these checks.

Minimal direction: compare ordered/unordered full expected rows, column names and relevant value tolerances, with explicit assertions for transaction/constraint effects. Expand the screenshot test to check execution results separately from image success.

### P2 Synthetic data and capture success need explicit provenance

A missing CSV silently produced a 150-row synthetic file with no cell error or structured provenance in the result. Automatic synthesis is an intentional option in this code, so the issue is undisclosed substitution when real assignment data is expected. Label synthetic data and require a choice when the manual calls for a specific real dataset.

Both screenshot helpers also return a successful capture for a visible runtime/SQL error. That is consistent with an image-capture boolean; it is **not** evidence of successful execution. The Colab queue does check cell errors, so the audit does not claim that queue falsely passed the deliberate exception. Keep capture success and verified execution status separate in every eventual API/report integration.

## Evidence and reproduction

Directory: `C:/Users/pilla/OneDrive/Desktop/Startup-projects/labmate_latest/backend/audit_artifacts/colab-sql-audit-20261026/`.

- `probe.py` / `browser-and-contract-evidence.json`: real browser SQL comparisons, API/theme boundaries, interactive Colab reruns and capture return values.
- `probe_kernel.py` / `kernel-evidence.json`: actual Python/ML outputs, teacher-file reset, path error, finite timeout and controlled cross-kernel plot loss.
- `probe_sql_bridge.py` / `sql-bridge-evidence.json`: actual bridge function, with only a harmless audit-owned external SQLite fixture.
- `existing-sql-test.log`: existing screenshot test passes.
- `screenshots/`: genuine captures, including visible SQL and Python diagnostic errors.

Run probes using the project's `backend/.venv/Scripts/python.exe`. The bridge probe extracts the unchanged nested function into a harness and substitutes only the schema metadata helper; it executes its real SQL statements against SQLite. The queue timeout probe stubs rendering because it tests cancellation, not image capture. Other screenshot probes render real pages using the production browser launcher.

Priority: isolate and terminate execution, unify SQL engines and validate result values, fix shared-state/data bugs, then wire and package the pipelines for deployment.
