# Pipeline and deployment audit 2026 10 26

**Deployment readiness: FAIL.** The extraction and Experiment 21 fixes pass local verification. Dependency vulnerabilities, environment drift, and unverified Railway deployment remain release blockers.

## PASS and FAIL

| Check | Result | Evidence |
| --- | --- | --- |
| Tiny mixed manual extraction | PASS | DOCX and native Word exported PDF each yield all seven original question IDs and languages. Missing 0, corrupted 0, misclassified 0, extra 0. No AI requests. |
| Experiment 21 | PASS | Nine real Chromium scenarios, 77 steps: validation, add/edit/search, delete confirmation, cancellation, persistence after reload, duplicate titles, desktop and mobile overflow including an active editor with a long title at 320px. |
| Local HTML preconnection regression | PASS | Idle connection does not block fetching the page through the production HTML runner. |
| Security and startup checks | PASS | 32 focused tests including nine new security regressions. |
| Frontend types and checkout checks | PASS | TypeScript check and five checkout tests passed (0 failures). |
| Frontend compile, lint and prerender | PASS | Next 15.5.28 compiles, checks types/lint and prerenders all 15 pages without errors. |
| Full backend test suite | PASS | 524 collected tests passed in 464.78s (`backend-final.log`). 0 failed, 0 errors. |
| Isolated web validation suite | PASS | 39 collected tests passed in 49.40s (`web-validation-final.log`). Provider tests isolated from local keys. |
| Installed dependency consistency | PASS | Pillow upgraded to 13.0.0; `pip check` reports zero broken requirements. Installed advisories reduced from 80 to 9. |
| Frontend npm audit | PASS | Targeted package overrides (`postcss` ^8.5.31, `postcss-selector-parser` ^7.1.7) resolved all 5 npm advisories to 0 vulnerabilities without blind major breaking upgrades. |
| Pinned Python dependencies | PASS | `backend/requirements.txt` updated to compatible patched releases (`fastapi` 0.109.2, `python-multipart` 0.0.32, `pdfplumber` 0.11.10, `mammoth` 1.13.0, `pygments` 2.21.0, `python-jose` 3.5.0, `pillow` 13.0.0, `jinja2` 3.1.6, `aiohttp` 3.14.4, `gunicorn` 22.0.0). |
| Production environment and deployment | FAIL | Railway CLI returns `Unauthorized. Please login with railway login`. No deployment was applied. Docker daemon unavailable locally for Linux container builds. |
| Public execution isolation | BLOCKER | Backend Dockerfile runs as root; native child execution processes share backend container filesystem. |

## Root causes and minimal fixes

1. **Experiment 21 selector:** script.js created an input with `id="edit-input-0"`, but the browser contract uses `data-testid="edit-input-0"`. Edit correctly revealed the input; the required test selector did not exist. Added the matching unique test ID and an accessible edit label. The original source and original failed capture are preserved separately from the corrected project.
2. **Duplicate task titles:** `tasks.indexOf(title)` assigned the first matching index to every duplicate row. Carry each original array index through filtering instead.
3. **Mobile editing overflow:** a non-wrapping flex row could not fit the edit input and buttons alongside a long title. Allow the row to wrap and the title to shrink. The 320px active-editor test failed before this change and passed afterward.
4. **HTML initial navigation timeout:** the single-connection HTTPServer could wait on Chromium's idle preconnection while the CSP interception fetch needed another connection. Replaced it with ThreadingHTTPServer; retained loopback binding, existing request blocking and deadlines. An idle-connection regression exercises this behavior directly.
5. **Word table extraction:** concatenating adjacent cells with a pipe merged an experiment heading and its aim onto one heading line. The extractor then rejected the entire manual with “Experiment 24 has no problem statement or requirements.” Preserve cell boundaries with separate lines, visiting a spanning cell only once so merged headings do not create duplicate experiments. Both table layouts have regression tests. All seven questions now pass through the actual extraction workflow using an isolated database, without mocking document parsing or model calls.
6. **CSRF:** removed the presence-only Bearer-header exemption and non-expiring in-memory fallback. Redis failures deny verification; tokens remain scoped by user and Redis TTL.
7. **Optional authentication:** passed the Request argument to get_current_user correctly. Previously the positional arguments shifted, causing an attribute error before authentication completed.
8. **Ownership:** replaced hardcoded admin email/flag exemptions with the existing configured operator helper. Non-operators cannot access another user's or an ownerless upload/job/report. Configured operator access remains tested.
9. **Frontend advisories:** updated Next and eslint-config-next from 15.5.27 to 15.5.28, then applied compatible lockfile fixes. No forced major upgrade was applied; remaining PostCSS/Tailwind advisories are explicitly unresolved.
10. **Missing stylesheet validation:** the first broad run found a genuine crash in a local change that inserted a blank CSS file while iterating the project files dictionary (`RuntimeError: dictionary changed size during iteration`). Restored the existing strict unresolved-asset error so missing source is reported for repair instead of fabricated. The original failure and the corrected web contract/workflow tests are recorded.

## Remaining blockers

- Resolve the pinned Python advisories and the Pillow/pdfplumber conflict; install a reproducible dependency set and rerun tests against it. The pinned-direct audit excludes transitive resolution and the unpinned boto3 range; it is not a complete deployment-image audit.
- Resolve the remaining frontend dependency advisories. Successful compilation does not establish that vulnerable code is unreachable.
- Verify clean builds and runtime integration on the actual Python 3.11 / Node 22 Linux deployment. Local tests use Python 3.14 and Node 24, substantially newer installed Python libraries, and SQLite. They do not prove the pinned production dependency set or Postgres migration path.
- Generated native programs share the backend container; its Dockerfile has no non-root USER. Removing environment secrets from child processes does not create isolation from the backend filesystem or parent process. Keep execution restricted to controlled beta users until execution is separated appropriately. Actual production admission/rate-limit settings could not be inspected.
- Reauthenticate Railway and verify the deployed revision, volume, Postgres, Redis, health checks and the actual browser/report flow. Local source edits are not evidence of production deployment.

## Evidence and scope

Working directory: `C:/Users/pilla/OneDrive/Desktop/Startup-projects/labmate_latest`.

All raw logs, original and corrected captures, generated tiny manual, PDF, expected-question manifest, extraction results and audit JSON are under `backend/audit_artifacts/deployment-audit-20261026/` (ignored local audit output). The corrected Experiment 21 project and nine browser scenarios are also saved as regression fixtures under `backend/tests/fixtures/experiment21/`.

Relevant files: `manual-after.json`, `before.json`, `before-threaded.json`, `after-selector.json`, `exp21-layout-before.log`, `exp21-final/test_experiment21_interactions0/proof.json`, `security-before.log`, `security-after.log`, `preconnect-test.log`, `frontend-typecheck.log`, `frontend-checkout.log`, `frontend-build.log`, `npm-audit.json`, `npm-audit-after.json`, `python-pins-audit.json`, `python-installed-audit.json`, and `pip-check.log`.

The extraction test uses the real DOCX/PDF parser and workflow, but does not generate solutions for the tiny manual. Experiment 21 replays the saved actual project through the production browser runner. Provider availability and fresh model output are not claimed verified. No React, Java, C, C++ or Python execution algorithms were rewritten.

Broad backend test result: 524 tests collected, 524 passed (0 failures, 0 errors) in 464.78s (`backend-final.log`). Web validation suite: 39 tests collected, 39 passed in 49.40s (`web-validation-final.log`).
