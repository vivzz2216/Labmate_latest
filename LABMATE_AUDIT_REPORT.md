# LabMate capability audit and verified changes

Follow-up: [Release verification](RELEASE_VERIFICATION_2026-10-17.md) records the later manual fixes, current regression results, and provider failures. Counts in this audit describe its earlier snapshot.

**Assessment: PARTIALLY READY.** The supported console/browser workflows are suitable for further trusted local testing. Unrestricted public student execution is blocked by inadequate process isolation. Java GUI, Tkinter, Flask and database experiments are not verified capabilities.

Audit dates: 16–17 October 2026 (India time). Baseline: commit `679354c`, branch `codex/railway-ready-20261016`. Changes were made in the existing deployment worktree without replacing the application architecture. This audit's changes are local; they have not been pushed or deployed to Railway.

Companion documents: `LABMATE_TEST_MATRIX.md`, `SCREENSHOT_INTELLIGENCE.md`, `TEMPLATE_ARCHITECTURE.md`. Raw evidence is in the ignored `backend/audit_artifacts/` folder; compact portable evidence and the matrix are in `docs/audit/`.

## 1. What existed before this audit

| Component | Observed implementation | Initial condition |
| --- | --- | --- |
| Frontend | Next.js 15.5.27, React 18, TypeScript, Tailwind, Axios; Node 22 engine | Homepage, workspace, dashboard, assignment execution, preview and report pages exist |
| Backend | FastAPI, SQLAlchemy, persistent workflow queue, JWT/password auth, CSRF, ownership checks | API and report workflow operational in prior controlled-beta deployment |
| Data | PostgreSQL and Redis on Railway; local SQLite supported | Four live Railway services; local audit uses SQLite and **emulated** Redis |
| Generation | Server-side structured generation via configured Groq or Gemini provider | Local real-model test selected Groq; configured default model is `openai/gpt-oss-120b`. Codex's conversational model is not the app's generator |
| Manual parsing | pdfplumber, python-docx; model extraction plus deterministic fallback and actionable-question filter | Mixed-language fallback silently lost experiments |
| Active execution | `RuntimeEngine` subprocess adapters, private temporary work directories, policy validation, sanitized child environment | Python, Java, C/C++, HTML, React, Node paths; local subprocesses are not a security sandbox |
| Browser tests | Existing bounded declarative HTML interaction tests and diagnostic Word path | Useful baseline; React/Node path and multi-file behavior needed actual verification |
| Screenshots | Playwright + Pygments + Jinja; raw browser capture then simulated editor/browser presentation | Borders, fake window chrome, resizing and a hardcoded C/C++ success/time footer |
| Reports | python-docx composition, image sizing/slicing, Word download and Mammoth HTML preview | Preserves original document structure; generic failures did not all receive diagnostic downloads |
| Containers | Railway backend image has compilers, Node and headless Chromium; legacy Docker helpers also remain | Active no-local-Docker path uses subprocesses; image configuration does not supply native GUI automation |

The README's Node 18 statement was inaccurate and is now aligned with package.json's Node 22 requirement. Presence of legacy executor methods was not counted as proof they execute in the active workflow.

## 2. What actually worked

The original backend suite passed **188 tests** in 207.49 seconds. Additional trusted fixtures then exercised actual compilers/processes, headless browsers, React/Vite startup and local HTTP endpoints. The completed capability harness reports **83 cases: 66 PASS, 17 BLOCKED, 0 DEFECT**. BLOCKED means the runtime correctly rejects an unsupported capability, not that its GUI worked.

- Python: input/output, conditions, loops, functions, collections, classes/inheritance, exceptions and working-directory file handling.
- C and C++: input/output, conditions/loops, functions, arrays, strings, pointers, structures, C++ inheritance, compile failures and nonzero runtime exits.
- Java: console I/O, expressions, conditions/loops, arrays, methods, OOP, handled exceptions and temporary-directory file handling.
- HTML/CSS/JavaScript: registration and invalid-form states, navigation, modal, tabs, to-do interaction, filtering, DOM change, responsive mobile/desktop states, controlled local fetch with separate assets, and a multi-page site.
- React: counter, to-do state, validation form, searchable list, dashboard cards and multi-file component/navigation state. These are representative small fixtures, not claims about every router, package, production build or complex project.
- Node: console, working-directory filesystem operations, handled/unhandled errors, HTTP page rendering, and explicit REST request validation/error/status/JSON checks.

The complete mixed-manual HTTP test used real configured model calls, not generation mocks: frontend proxy -> authenticated upload -> extraction -> C execution (`5`) -> Python execution (`36`) -> HTML modal interaction -> selected evidence -> Word download -> HTML document preview. It preserved all three experiments and their order. The downloaded Word package opened with python-docx, contained nine valid embedded PNGs, and retained image aspect ratios. Media count includes PDF manual-page images and is not the selected-result screenshot count.

The GUI manual retained Swing, Tkinter and Flask as three separate **failed** results, downloaded a diagnostic Word document, and did not manufacture a GUI/browser result for them. Malformed and scanned PDFs ended with explicit extraction failure, not empty successful reports.

## 3. Verified defects fixed

| Defect and evidence | Change | Regression/evidence |
| --- | --- | --- |
| A Node console program printed `Hello Node` but returned failure after about 15.5s because it was treated as a web server | Detect console programs and run them directly with bounded stdin/process handling | `node_console`, `node_file`, `node_error`; baseline-probes.json and final capability JSON |
| Multi-file React navigation fixture raised `React is not defined` in a child component omitting the obsolete per-file import | Trusted Vite automatic JSX-runtime configuration; user Vite config is not executed | Initial harness recorded a defect; `react_navigation` retest and final full harness pass |
| Deterministic parser returned only Python from a C/Python/HTML manual and only Tkinter from a three-framework manual | Recognize actionable prompts across languages; retain title + first objective; preserve continuation requirements, number/title/source-file metadata and hard experiment boundaries | `test_manual_requirements.py`; PDF and DOCX fixtures now retain 3/3 ordered tasks |
| Whole-manual generation context contaminated the HTML answer with earlier C/Python results | Pass the complete current extracted question and explicit instructions to generation, without unrelated manual text; preserve requested language | Actual before/after model observations plus `test_audit_workflow.py` context/substitution gates |
| CodeBlocks template asserted `Process returned 0` and `0.042 s` even with a compilation error | Remove fabricated success/time; record measured compile/process status | `EvidenceTemplateTests`; actual C/C++ failure PNGs |
| Browser preview added shadow, rounded border, padding, fake address bar and resizing | Validate and return original PNG unchanged; use frame-free shared presentation in main workflow | `test_real_page_capture_is_preserved_without_artificial_browser_frame`; visual examples in docs/audit/evidence |
| Non-browser execution failures could leave no downloadable diagnostic | Build diagnostic reports for all execution/evidence failures, keep status failed | Wrong/missing output, unsupported import, language substitution, browser unavailable and interaction failure tests |
| Diagnostic-only batches were unavailable to ZIP download | Include failed workflows with report IDs, retain failed counts and errors.json | `test_diagnostic_only_batch_stays_failed_and_is_downloadable` |
| Presentation guessed C/C++/Java stdin chronology and could confuse rendered output with truth | Main workflow keeps raw result output and labels supplied stdin separately; rendered source vs actual capture/transcript are explicit | Evidence-integrity and report tests |
| Overlong browser pages could be silently cropped at 16,000px | Fail evidence capture instead of accepting a truncated success | `test_overlong_browser_page_fails_instead_of_silently_clipping` |
| Missing browser console diagnostics and incomplete project-file validation | Record console.error; reject non-text filenames/contents, traversal and forbidden dependency paths | `test_browser_evidence_limits.py` |

Generation instructions no longer ask for “zero AI telltales.” They require the exact exercise and prohibit invented verification/accreditation messages or unrelated outputs. This is a generation instruction, not a guarantee of all model behavior; runner observations and explicit verification scope remain authoritative.

## 4. Implemented additions

The deterministic evidence planner separates compilation, execution, expected output, GUI launch, browser render, browser interaction, responsive evidence and database evidence. Selection validates PNGs, deduplicates exact pixels within one experiment, requires distinct intermediate states when specified, and reports uncertainty/missing evidence. No extra model call is used for screenshot planning.

HTML now has bounded multi-file local serving with relative assets, controlled fetch and page navigation. React/Node page adapters can use the existing declarative interaction protocol. Browser scenarios support explicit mobile and desktop viewports. HTTP API fixtures use an appropriate structured request/response adapter instead of a browser screenshot of JSON.

The shared evidence presentation supports light/dark palettes, language-aware syntax, optional line numbers, consistent spacing and readable source/transcript widths. Unsupported GUI categories have truthful diagnostic layouts and remain disabled. Reports include verification scope, actual stages, test observations, uncertainties and missing evidence. Optional frontend result types describe the new metadata; generation progress text no longer calls untested code verified.

## 5. Missing and partial capabilities

| Capability | Actual finding | What is needed |
| --- | --- | --- |
| Java AWT | Compiles; headless launch throws HeadlessException | Separate restricted display worker, full desktop JRE libraries, real window automation/capture |
| Java Swing | Compiles; headless JFrame launch throws HeadlessException | Same infrastructure class as AWT, plus separate Swing interaction tests |
| JavaFX | Compilation fails: javafx.application/javafx.stage absent | Matching JavaFX modules/native libraries plus display/automation adapter |
| Tkinter | Import policy rejects it; no tested native-window automation | Matching Python Tcl/Tk distribution, isolated display adapter, window interaction/assertions |
| Flask | Import policy rejects it; no dedicated Python web-server lifecycle adapter | Allowlisted dependency and separate bounded server/readiness/browser adapter inside a properly isolated worker |
| Database labs | No configured experiment database/evidence adapter | Disposable per-run DB, credentials and query/result assertions; screenshots alone cannot prove persistence |
| General React projects | Trusted multi-file scaffold works; arbitrary package.json, lockfiles, Vite config and dependencies intentionally ignored | Approved dependency catalog and committed transitive scaffold lock; supported routing/build contract |
| Generated API/multi-file projects | Runtime accepts explicit project_files/api_tests; standard model answer does not yet generate those structures | Extend structured generation and task mapping with separate validation/report gates |
| Expected-output correctness | Explicit single-line expected-output markers work; absent oracle means execution_tested | Structured multi-case input/output requirements and independent oracles for more exercises |
| Scanned PDF | No extractable text -> clear failure | OCR service with confidence/manual review; no fabricated extraction |
| Print layout QA | DOCX structural/image checks pass; physical rendering blocked | Required bundled LibreOffice executable or another supported renderer |
| Frontend interaction QA | Browser-control tool returned “Local browser use is disabled in Work settings” | Enable supported browser control for a later UI test; this audit did not bypass that setting |
| Standalone frontend lint | Installed next lint prompts for missing ESLint configuration and exits 1 | Commit a chosen ESLint configuration and resolve its findings; typecheck/build passing is not lint passing |

The 17 GUI/framework guard fixtures share representative unsupported launch shapes; their names do not mean five distinct Swing or Tkinter interfaces were launched. Actual GUI features cannot be tested past the missing adapter. Headless compile/dependency probes are separately recorded in `gui-dependencies.json`.

## 6. Tests and evidence locations

- Baseline: `backend/audit_artifacts/baseline-tests.log` and `.xml`: 188 passed, 55 warnings.
- Full intermediate regression: `verified-tests.log/.xml`: 287 passed, 55 warnings, 188.85 seconds.
- Final full suite: `release-tests.log/.xml`: **293 passed, 55 warnings, zero failures/skips in 243.08 seconds**. This includes the six final browser/project-boundary regressions.
- Last focused browser/workflow/planner/generation/batch checks: `final-targeted-tests.log/.xml`: 40 passed, one warning.
- Final HTTP-evidence gate follow-up: `http-gate-tests.log/.xml`: 26 passed, one warning, 15.09 seconds. This follows the 293-test full run and adds rejection of console text masquerading as an actual HTTP response.
- Actual 83-case harness: `final-capabilities/capability-results.json` and `final-capabilities.log`; original failing run retained in `capabilities/`.
- Real-model upload/download observations and reports: `end-to-end/results.json`, `before-context-fix.json`, `manual_mixed_audit.docx`, `manual_gui_audit.docx`.
- Security: `security/security-probes.json`; compile/headless dependencies: `gui-dependencies.json`.
- Artifact validation: `artifact-validation.json` decoded all 93 audit PNGs without corruption and confirmed both downloaded final Word files exactly match stored report bytes.
- Frontend: typecheck passed; production build log `frontend-final-build.log`; standalone lint configuration blocker in `frontend-lint.log`.

Warnings include legacy SQLAlchemy APIs and naive datetime deprecations. They were not silently discarded. No stress test, measured memory ceiling, hostile-input isolation certification, or comprehensive pixel-level Word-page QA is claimed.

## 7. Security findings and public access

**P0: local subprocess execution is not isolation.** An audit-owned Node fixture successfully read an audit-owned sibling canary outside its working directory. Another contacted an audit-owned loopback HTTP server. No user files, application secrets or unrelated network resources were accessed. Temporary workspaces were cleaned, but that does not prevent cross-run access while processes run. Reproduce with `python scripts/audit_security.py` from backend; expected current observations are accessible=true and allowed=true.

The child environment excludes application/model/database credentials. Python has AST/import/file-name checks; other languages have regex guards; process output and wall time are bounded; process trees and temporary directories are cleaned. POSIX resource limits exist, while Windows has no equivalent tested job-object memory/CPU enforcement. Static checks and fresh directories cannot constrain all filesystem/network APIs, especially native C/C++/Java/Node.

The app itself runs in a Railway service container, but a student subprocess shares that service's filesystem/security context. A container around the entire web backend does not isolate experiments from its private files. Local tests prove the design limitation; this audit did not attempt to read another tenant's real files on Railway.

**P0: controlled-beta access needs an actual admission boundary.** JWT, CSRF and ownership checks are tested, but the signup route has no invitation allowlist. The frontend's server-side beta-key forwarding is not an invitation system. Do not assume that keeping the beta key out of browser JavaScript restricts registration. Restrict network/access and invited users before exposing this execution service widely.

Required design: separate per-run execution worker/VM with no app/database/model secrets or mounts, a fresh read/write workspace, read-only runtime, deny-by-default egress and private-network access, wall/CPU/memory/PID/disk/output limits, and verified teardown. Give it only bounded source/input and return artifacts/observations. The web app can continue running without local Docker. GUI support belongs inside that isolated execution tier; do not weaken the current import policy or expose the host desktop.

Other inspected controls: JWT ownership on assignments/downloads, CSRF-backed mutation protection, filename/path validation, streamed upload size limits, batch count/queue caps, DOCX archive validation/decompression limits on batch upload, blocked browser external requests, script-disabled presentation rendering and escaped output. Single-upload malformed files can be accepted and then rejected during extraction; that differs from batch signature validation. Error logs and upload/parser hardening remain relevant under adversarial load. Model-generated tests share the model's assumptions, so passing them is bounded behavioral evidence, not an independent proof of the whole specification.

## 8. Measured performance

Measurements are single-machine observations, not capacity estimates. The final three-experiment real-model manual took **16.901 seconds** including upload, extraction, processing, polling and report download; the GUI diagnostic manual took **16.793 seconds**. An earlier preserved retest (`end-to-end/after-context-fix.json`) measured 16.498s and 14.519s respectively. Log-derived stage durations from that earlier supported run were extraction/model identification 1.725s; generation C 2.581s, Python 1.246s, HTML 2.621s; execution C compile+run 0.366s, Python 0.102s, HTML browser/test 1.118s; evidence presentation C 2.136s, Python 2.004s, HTML 1.042s; report composition 0.358s. These workflow intervals include bookkeeping; compilation and report-embedding substeps are not all independently timed.

An instrumented responsive two-scenario capture measured 1.615s total: browser startup 0.520s, interactions 0.162s, screenshots 0.123s. A later warmed run was faster; the raw per-case timing dictionaries are retained. Initial React cold preparation was 24.566s versus roughly 6.6–7.0s on subsequent fixtures; final warm-cache tests were faster. Node console's old roughly 15.5s false server wait is eliminated.

Remaining opportunities: cache pinned scaffold dependencies with a committed lock; reuse a browser process with fresh isolated contexts and a bounded pool; combine static source/transcript rendering without launching a browser for each image; avoid redundant full-manual/model prompts; collect per-stage histograms and memory/process high-water marks. Do not reuse mutable student workspaces or browser state across experiments for speed. No concurrency/load benchmark was run, so recommended worker counts require measurement.

## 9. Reproduction

Use Python 3.12 with backend requirements and Playwright Chromium, Node 22 with `npm ci`, and installed JDK/GCC/G++ for compiler tests. This machine used the existing `work/backendenv` interpreter and local JDK17/MinGW paths. Set `JAVA_COMMAND`, `JAVAC_COMMAND`, `C_COMPILER`, `CPP_COMPILER` when they are not on PATH.

From backend:

```powershell
python -m pytest tests -q -o addopts='' --junitxml=audit_artifacts/release-tests.xml
python scripts/audit_capabilities.py --output audit_artifacts/final-capabilities
python scripts/audit_gui_dependencies.py
python scripts/audit_security.py
```

Generate trusted input manuals with `python scripts/audit_manuals.py` using a document/PDF-capable Python environment. Local app test setup additionally needs fakeredis; `audit_app.py` is an audit helper, not a production dependency or launcher. First build frontend, then from backend:

```powershell
python scripts/audit_app.py --config C:/path/to/existing/backend.env
python scripts/audit_e2e.py
```

This binds frontend 3016, backend 8016 and emulated Redis 6386 to loopback, with an audit-only SQLite database. It imports only provider/model credentials from the supplied config and never prints or saves them. E2E uses real configured model calls and may consume model quota. Audit files/logs and process IDs are saved under audit_artifacts/local-app; do not use those sample test accounts for production.

From frontend: `node node_modules/typescript/bin/tsc --noEmit --incremental false`, then `npm run build`. `npm run lint` currently requires configuration and is reported blocked.

Word physical rendering was attempted with the documents skill's `render_docx.py` against the generated diagnostic report. It stopped with `FileNotFoundError: LibreOffice soffice.exe was not found on PATH`. Reproduce after the supported bundled renderer is available:

```powershell
python C:/Users/pilla/.codex/plugins/cache/openai-primary-runtime/documents/26.1013.11914/skills/documents/render_docx.py backend/audit_artifacts/end-to-end/manual_gui_audit.docx --output_dir backend/audit_artifacts/word-render
```

The actual attempt and compiler error are preserved in `backend/audit_artifacts/word-render.log`. No Word-page visual pass is claimed.

The [documents skill](C:/Users/pilla/.codex/plugins/cache/openai-primary-runtime/documents/26.1013.11914/skills/documents/SKILL.md) states: “You do not ‘know’ a DOCX is satisfactory until you’ve rendered it and visually inspected page images.” That gate remains unmet because the bundled renderer cannot find soffice.exe; structural checks do not replace it.

## 10. Readiness and prioritized remaining work

1. **P0:** isolate untrusted execution and restrict beta admission. Keep public self-service execution closed until filesystem/network/PID/resource isolation tests pass. Review default student/institution placeholders before treating report metadata as genuine student data.
2. **P0:** repeat the complete final implementation on the intended Railway runtime before rollout. Railway currently reports frontend, backend, PostgreSQL and Redis Online with no pending work; those are the previously deployed version, not this local audit patch. UI interaction and physical Word-page QA remain blocked as above.
3. **P1:** extend structured requirements/oracles beyond simple expected-output markers; independently validate model-authored tests, source-file mapping and API scenarios; finish legacy presentation migration and large-source pagination.
4. **P2:** implement Flask or native GUI only in a separate isolated execution tier; supply full runtime/display dependencies, readiness, automation, assertions and real captures. Keep AWT/Swing/JavaFX/Tkinter individually disabled until their complete tests pass.
5. **P2:** define supported React project/dependency/routing scope, commit transitive runtime locks, configure frontend lint and address its actual findings.
6. **P3/P4:** finish user-facing verification-scope presentation, physical print-layout QA, bounded browser pooling, stage metrics and multi-user load tests.

**PARTIALLY READY** reflects working and materially improved console/browser workflows alongside real isolation, unsupported-framework and QA blockers. Passing regression tests does not make this an unrestricted production execution service.
