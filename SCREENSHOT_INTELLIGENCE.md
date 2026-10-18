# Screenshot intelligence

Updated: 18 October 2026. This describes implemented behavior, not a promise of general program correctness. Current focused source selection is detailed in `SOURCE_CAPTURE_VERIFICATION_2026-10-18.md`.

## Planning before capture

`backend/app/services/evidence_planner.py` provides `plan_experiment`, `verification_summary`, and `select_evidence`. The assignment workflow creates the plan after code generation and before execution/capture. Rules inspect the complete extracted question, additional requirements, selected language, and generated imports/API usage. This stage makes no additional model call.

Each version-1 plan stores the objective, language, capability category, supported flag, requirement IDs, evidence types, expected output, expected states, recommended screenshot types, intermediate-state requirement, responsive requirement, uncertainties, and eventual selection decisions. It is saved in the existing workflow results JSON; no database migration or public endpoint was added.

| Requirement | Evidence | Verification scope |
| --- | --- | --- |
| Source implementation | Labelled syntax-highlighted source preview | Shows supplied code; does not prove execution |
| Console execution | Actual stdout/stderr, separately labelled supplied stdin where necessary | Process exit plus execution stages |
| Explicit expected output | Actual output compared with the manual's `Expected output:` or `Expected stdout:` line | Exact complete output or final contiguous lines; `5` does not match `15`, `-5`, or a preceding echoed input |
| Browser rendering | Original runner PNG | Rendered page, broken-image detection, unhandled JavaScript errors |
| Required browser interaction | Final screenshot per bounded scenario, recorded steps and visible assertions | Assertions must become visible after actions; pre-existing text cannot establish the interaction |
| Invalid and successful / before and after states | At least two distinct captures | Missing or duplicate intermediate evidence fails the report gate |
| Responsive behavior | Mobile and desktop scenarios, actual recorded viewport sizes | Requires widths at most 480 and at least 1024; this is not a complete visual-layout/accessibility audit |
| Node API | Captured HTTP method/path, supplied JSON, status and response body | Status and optional expected JSON assertions; browser image is unnecessary |
| Database behavior | Actual database evidence | No adapter exists: explicitly unverified and failed |
| Java GUI / Tkinter / Flask | Real window/browser result | Unsupported adapter: failed, with no fabricated GUI capture |

Ambiguous console tasks have `output: not_specified`, an uncertainty explaining the absent oracle, and scope `execution_tested`, rather than a correctness claim. Compilation, execution, output, rendering, interaction, responsive coverage, and evidence availability are separate checks. Compile failures have `compile: failed` and `execution: not_run`. Process timing is measured rather than inferred.

## Bounded execution plans

The generated HTML/React response includes version-2 declarative scenarios in the same code-generation call: `name`, `requirement_ids`, `steps` and `viewport`. Steps support bounded input/click/select/navigation and explicit visible-state, count, value, URL and other whitelisted assertions. No model-authored executable test scripts are accepted. Limits are twelve scenarios, twenty-four steps per scenario, 140 total steps, bounded strings and viewport dimensions 240–1920. Version 2 has a cumulative 90-second interaction budget and a 120-second outer capture budget. Legacy version-1 plans retain their tighter limits.

Each scenario gets a fresh page. Multi-file HTML is served on an ephemeral loopback HTTP server so relative assets, controlled fetch, and page navigation work. React uses the separate Vite adapter with trusted configuration. Browser requests are restricted to the current local origin; external assets/requests remain blocked. These browser restrictions do **not** isolate the server-side process: see the security findings in `LABMATE_AUDIT_REPORT.md`.

Viewport examples are 1366×768 desktop and 390×844 mobile. Capture height follows the actual page up to 16,000 pixels; overlong pages fail instead of silently returning a clipped success. Unhandled JavaScript exceptions fail verification. Explicit `console.error` messages are recorded and included in reports; they do not automatically establish that a required assertion failed.

Runtime API tests accept at most sixteen local requests, whitelisted HTTP methods, bounded request bodies, three-second request timeouts, no redirects, and no environment-proxy inheritance. Structured API tests are wired through the standard Node/fullstack upload workflow. A default HTTP GET is weaker evidence than explicit CRUD/validation scenarios.

## Selection and authenticity

Selection validates each image using Pillow, rejects unreadable or too-small images (below 160×80), records dimensions and format, and removes exact duplicate RGB pixels only within the same experiment and evidence kind. It never deduplicates unrelated experiments. The algorithm is deliberately conservative: no perceptual similarity model is used, and near-identical images can remain.

The default assignment layout is source first, followed by the required execution evidence. Console/API experiments use a source preview and actual transcript. Browser/React experiments use source and actual browser pixels; there is no redundant simulated terminal pane. Separate scenarios preserve important intermediate states. Selection records selected, redundant, invalid and missing evidence without exposing filesystem paths in the public result metadata.

Source previews are marked `rendered_source_preview`. Transcript presentations are formatted actual execution data; they are **not native IDE/terminal window captures**. Browser evidence is captured application content, not an operating-system browser-chrome screenshot. GUI images are never synthesized to fill a missing adapter.

All execution/evidence failures keep the workflow `failed` and still permit a diagnostic Word download. Diagnostic-only batch ZIPs include reports and `errors.json` without changing the failed status. Missing or corrupt required images fail verification. Diagnostic documents can contain source and explicit missing-evidence details when no result image exists.

## Borders and readability

Inspection located decorative borders in `browser_preview_theme.html` (24px outer padding, border, rounded corners, shadow, fabricated address bar) and legacy editor templates. Browser captures were also scaled into a 1080px presentation. `generate_browser_preview_from_image` now validates and returns the original PNG and dimensions without wrapping or resizing.

Console/transcript `evidence_theme.html` has shared light/dark palettes, 16px monospace type, optional line numbers, wrapping and no decorative frame. At the user's explicit request, WebDev source now uses a VS Code-style frame in `vscode_evidence.html`, clearly labelled as a source preview. AI selects up to three actual functional files; the host validates the choice and labels first/last excerpts for long files. React/Node CSS and mounting-only files are omitted from source images, while complete source remains saved. Hardcoded C/C++ success (`Process returned 0`, `0.042 s`) was removed. Output is HTML-escaped. C/C++/Java stdin is labelled separately rather than guessed into prompt chronology; Python's launcher records consumed input.

Word composition preserves aspect ratio and slices tall images into ordered parts rather than squeezing an entire long screenshot onto one page. Very long source still has a bounded capture size and can require a smaller exercise; automatic source-file pagination is not complete.

Legacy explicit IDE-theme and `/api/run` presentation paths remain for compatibility and are **not** fully migrated to the new presentation contract. They must not be advertised as native IDE recordings. Their deprecation/migration is remaining work; border removal is verified for the main assignment workflow and raw browser preview path.

## Evidence and regression entry points

- `backend/tests/test_evidence_planner.py`: unknown oracle, incorrect/missing output, unsupported GUI, database gap, corrupt images, experiment-local duplicate selection, output escaping, invented success/time regression.
- `backend/tests/test_audit_workflow.py`: actual runner/report gates for wrong output, missing output, generated-language substitution, GUI substitution, intermediate-state duplicates, and unrelated-manual context exclusion.
- `backend/tests/test_browser_evidence_limits.py`: console-error recording, overlong-page failure, invalid/path-traversing project files.
- `backend/tests/test_web_interaction_review.py` and `test_backend_engine.py`: actual Add actions, wrong arithmetic, missing handler/control, hidden/pre-existing result, fresh scenarios, external-request blocking and bounded hung handlers.
- `backend/tests/test_browser_preview.py`: original PNG returned without framing/resizing.
- `backend/audit_artifacts/`: actual PNGs, downloaded reports, raw observations, logs and JUnit XML. This directory is intentionally ignored by Git.
