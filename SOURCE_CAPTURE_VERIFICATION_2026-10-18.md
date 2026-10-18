# Source screenshot verification

## Current policy after the University XYZ request

The user's later request supersedes the complete-file screenshot policy below. WebDev source figures now use `vscode_evidence.html`: a labelled VS Code-style source preview with explorer, tabs, syntax highlighting, original line numbers and a status bar. These are rendered source figures; real browser/HTTP output remains separate.

The structured generation response includes `source_capture_files`, naming at most three real functional files. Selection is validated against the complete project. React/Node CSS, HTML shells, assets and mounting-only files are omitted from source screenshots when functional files are available. Invalid paths fail validation. Missing selected captures fail evidence validation. Complete source still executes and stays in the saved project.

Files longer than 48 logical lines show their first 20 and last 20 lines with an explicit omission label. Captures record full-source and excerpt hashes, original ranges, line counts, omitted counts and selection provenance. Short files remain complete. The Word export no longer dumps every React/Node source file as text after these focused code figures.

University XYZ's five reviewed solutions passed 9 browser scenarios, 43 browser assertions and 16 API tests. The delivered record contains 7 selected source figures, 15 browser states and 4 grouped HTTP figures across 32 visually checked pages. The full source ZIP retains omitted CSS and components. Local assignment 21 / workflow 20 completed; report 13 downloads and previews successfully. Its standard report includes the original PDF pages and additional state captures, so its 34 image objects differ from the curated record's 26 figures.

The app check also fixed an Express-only assignment being classified as fullstack when report preferences mentioned React. Original questions and additional instructions are now passed separately; screenshot preferences do not require a React client. An explicit request to add a React frontend still selects fullstack.

Focused verification passed 30 capture/parser/provider tests and 55 workflow/interaction/report tests. The final full backend regression passed **368 tests** in 381.13 seconds with the real JDK and GCC toolchains configured. Independently rendered source text matched all seven selected files' original ranges exactly, with no horizontal overflow; all 26 original PNGs are embedded unchanged. This is a reviewed-solution execution result, not a claim of reliable live free-provider generation. No Railway deployment was performed for this change.

## Earlier complete-source audit (retained historical result)

The original WebDev workflow captured one source preview per experiment. React previews therefore showed the mounting file rather than complete application logic. Full source text was already in the report, but source screenshot coverage was incomplete.

The capture stage now renders every supplied HTML, CSS, JS, JSX, CJS, MJS, JSON and SVG source file separately, using its real filename and filename-appropriate syntax highlighting. README instructions remain text rather than code images. Each source capture records a SHA256 and logical line count. A missing file capture fails evidence validation even if other source images exist. Rendered previews remain explicitly labelled; they are not presented as screenshots from an IDE.

Whitespace is preserved during highlighting, requested line ranges are respected, and line numbering starts at the requested source line. Console source labels match the runner's actual Java/C/C++/Node filenames. Existing template styling was not redesigned.

Assignment 20's saved code screenshots were refreshed without an AI call, source change, or rerun of verified execution. **39 of 39 source files** passed independent rendered-text, line-order, filename, hash, image-validity and horizontal-overflow checks. All existing browser and HTTP evidence was retained. The refreshed full application report is report 11; the workflow remains completed at 100% with ten completed experiments. Source images can be sliced into multiple Word images by the existing page-fitting helper, so image-object counts need not equal source-file counts.

Verification passed **33 source/browser/evidence/resume tests** and **18 report/API/batch/limit tests**. The initial C transcript regression assertion expected transcript data on source-only previews; it was corrected to assert empty output for source images and unchanged stdin/echo handling on the actual transcript. Both source and output behavior were then rechecked.

Private evidence: `backend/audit_artifacts/source-capture-check/manifest.json`, `precision-checks.json`, `source-capture-regression-final.log`, and `source-report-api-regression.log`.

The WebDev 10/10 result applies to the reviewed solutions and real execution described in `VERUANCE_REVIEWED_RESULTS_2026-10-18.md`; it does not establish reliable free-provider generation for new uploads. Flask and Java native GUI execution are separate capability work. Flask is currently missing from the backend environment and is rejected by the Python import policy. AWT/Swing compile probes passed, but the current headless probe does not provide a window or interaction capture; JavaFX modules are absent. These categories remain unavailable rather than being marked passed by console output.
