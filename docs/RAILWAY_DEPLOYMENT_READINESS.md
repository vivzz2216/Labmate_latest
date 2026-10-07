# LabMate Railway Deployment Readiness

**Status: Not ready for a public Railway launch yet.** Eight corrected reports are in place. A fresh full backend run passed 143 tests, and a targeted runtime/evidence run passed 37 tests. Functional tests do not establish launch readiness, and the screenshot review below found additional defects. The following go-live gates remain, in priority order.

1. **Isolate student code.** *(Verified complete; 6 sandbox & security tests pass)*
   - Universal static security inspection across all supported languages (Python, Java, C, C++, Node) in [generated_code.py](../backend/app/security/generated_code.py) and [runtime_engine.py](../backend/app/services/runtime_engine.py). Rejects `fork()`, `system()`, `popen()`, `ProcessBuilder`, `Runtime.getRuntime()`, sockets, and environment traversal with code 126 before touching the compiler.
   - Enforced Linux kernel process resource bounds via `preexec_fn` (`make_resource_limiter`): `RLIMIT_AS` memory ceiling (512MB for Python/C/C++, 1024MB for Java), `RLIMIT_CPU` (15s ceiling), `RLIMIT_NPROC` (max 64 processes to eliminate fork bombs), `RLIMIT_FSIZE` (20MB disk write limit), and disabled core dumps (`RLIMIT_CORE = 0`).
   - Signal handling catches memory exhaustion (`SIGSEGV`, `SIGKILL`, exit code 137/139) and CPU limits (`SIGXCPU`, exit code 152) and maps them to clean student-facing diagnostics. Tested and covered by `tests/test_execution_sandbox.py`.

2. **Make files durable.** *(Verified complete; live Cloudflare R2 bucket `labmate-storage` operational; 5 storage tests pass)*
   - Implemented [storage_service.py](../backend/app/services/storage_service.py) supporting S3-compatible cloud storage (Cloudflare R2, AWS S3) with automatic local disk fallback.
   - Connected and verified against the live bucket `labmate-storage` on Cloudflare R2 (put, read, download, delete, presigned URLs).
   - Integrated with upload processing ([upload.py](../backend/app/routers/upload.py)), report generation ([composer_service.py](../backend/app/services/composer_service.py), [assignment_workflow.py](../backend/app/services/assignment_workflow.py)), report downloads ([download.py](../backend/app/routers/download.py)), batch ZIP archives ([workflow_batch.py](../backend/app/services/workflow_batch.py)), and screenshot signing ([signed_assets.py](../backend/app/security/signed_assets.py)).

3. **Secure production configuration.** Rotate the Gemini and Groq keys shared earlier. Set a stable `SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`, the selected provider key, admin credentials, allowed origins, and `RATE_LIMIT_ENABLED=true` through [Railway variables](https://docs.railway.com/variables). Keep secrets out of source control and deployment images.

4. **Fix deployment readiness checks.** *(Verified complete; 7/7 startup security tests pass)*
   - Hardened `/health` and `/health/ready` in [main.py](../backend/app/main.py) to fail closed with HTTP 503 (`ready: false`) whenever database connectivity (`SELECT 1`) or required Redis instances are degraded or uninitialized.
   - Added `/health/live` returning HTTP 200 for process liveness checks. Tested and covered by `tests/test_startup_security.py`.

5. **Prove the 500-student target in staging.** Load-test simultaneous uploads, ten-file batches, every supported language, report downloads, retries, crashes, and recovery. Measure queue time, failure rate, memory, and cost. Passing 143 functional tests does **not** establish 500-student capacity.

6. **Repair screenshot evidence and Word pagination.** *(Verified complete; 149/149 backend tests pass; visual inspection verified)*
   - **Single-pass, idempotent stdin interleaving:** Stdin values for C, C++, and Java are interleaved exactly once without duplicate value echoes (`Enter first number: 25`, not `25 25`). `assignment_workflow.py` sets `input_echoed=True` when reconstructing interactive outputs, `screenshot_service._render_template()` bypasses re-interleaving for pre-echoed inputs, and `_interleave_stdin_output()` is strictly idempotent against repeated passes. Verified end-to-end with workflow regression test `test_c_workflow_interleaves_inputs_exactly_once_without_duplicates`.
   - **C/C++ and Java output captured:** Workflow capture views map `codeblocks` and `notepad` to `("editor", "output")`, capturing both the source editor and the authentic execution console window. Controlled runs for Python, C, C++, and Java were regenerated, verified, and visually inspected in `C:/Users/pilla/Downloads/LabMate_Runtime_QA/`.
   - **Word screenshot pagination & captions:** `embed_screenshot()` and report builder proportionally scale images within 25% of usable page height to prevent unnecessary splits. Tall listings split cleanly across inter-line gaps with `page_break_before` and titled continuation captions (`Code (Part 1 of N)`, `Code (Part 2 of N — continued)`), eliminating untitled code fragments and accidental blank pages. All eight Word reports were regenerated and visually reviewed in `C:/Users/pilla/Downloads/LabMate_Verified_Reports/qa_render/`.

7. **Rehearse launch and recovery.** Deploy to an isolated staging environment, complete end-to-end smoke tests, configure error and queue alerts, verify backups with a restore drill, and practice rollback. Monitor production continuously: Railway's deployment healthcheck does not continue monitoring after the deployment goes live. See [Railway healthchecks](https://docs.railway.com/deployments/healthchecks) and [Postgres backup and restore guidance](https://docs.railway.com/guides/postgres-backups-restores).

## Latest report and runtime QA

- The eight saved DOCX reports in `C:/Users/pilla/Downloads/LabMate_Verified_Reports/` were rebuilt across all 32 questions with fresh, authentic execution screenshots and clean Word layout.
- The Word documents were exported to PDF and rasterized to 68 PNG pages (EXP 1: 10 pages, EXP 2: 8 pages, EXP 3: 6 pages, EXP 4: 10 pages, EXP 5: 12 pages, EXP 6: 12 pages, EXP 7: 4 pages, EXP 8: 6 pages).
- All previous pagination defects (Experiments 1, 2, 5, 6) were visually verified as resolved:
  - EXP 1 Question 2 (65 lines) proportionally scaled to fit page 5 cleanly; Question 4 splits with `Code (Part 1 of 2)` on page 8 and `Code (Part 2 of 2 — continued)` on page 9 without blank pages.
  - EXP 2 Question 2 splits with `Code (Part 1 of 2)` on page 6 and `Code (Part 2 of 2 — continued)` on page 7 directly followed by output on page 8.
  - EXP 5 Question 4 splits cleanly with titled continuation captions across pages 7–9; output on page 10.
  - EXP 6 Question 2 fits page 5 cleanly; output on page 6.
- Controlled smoke test runs for Python, C, C++, and Java were regenerated: stdin values interleave exactly once without duplicate numbers, and C/C++/Java workflows capture both editor and console views (`C:/Users/pilla/Downloads/LabMate_Runtime_QA/`).
- The full backend suite passed **149/149** tests (including `WorkflowInterleaveRegressionTests::test_c_workflow_interleaves_inputs_exactly_once_without_duplicates`).
- These eight saved reports cover the Python experiment set. Full report-generation quality for Java/C/C++ manuals and web-development reports remains to be rendered and visually inspected as part of staging verification.
- Controlled captures and a machine-readable run record are in `C:/Users/pilla/Downloads/LabMate_Runtime_QA/`; the eight reviewed reports are in `C:/Users/pilla/Downloads/LabMate_Verified_Reports/`.

**Public-launch decision:** No-go until isolation, durable storage, secrets, readiness checks, screenshot evidence, and staging capacity/recovery checks are verified. Passing functional tests and executable examples are useful progress, but they are not a production safety, capacity, or report-quality guarantee.
