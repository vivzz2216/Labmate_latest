# University XYZ manual results

The original seven-page PDF contains five experiments, all preserved in order: portfolio (HTML/CSS), validated registration (JavaScript), academic task manager (React), routed student portal (React Router), and student records REST API (Node/Express).

All five complete reviewed solutions passed real execution without Docker. There were 9 browser scenarios, 43 passing browser assertions and 16 passing HTTP tests. Registration covers empty inputs, invalid email/phone, future birth date, weak and mismatched passwords, and valid submission. Task management covers empty/error states, creation with title/description, completion and deletion. Routing covers Home/Profile/Courses/Contact, three course entries, unknown routes, recovery and direct Profile loading. The API covers CRUD, validation, duplicate IDs, invalid IDs and missing records.

This run supplies engineer-reviewed manifests to the real execution helpers. No execution or assertion is mocked. It does not establish that the live free provider generated all solutions successfully.

The delivered Word record has 32 rendered and visually checked pages and 26 figures: 7 VS Code-style source previews/excerpts, 15 browser captures and 4 HTTP evidence groups. Long sources retain first/last original line numbers and explicit omissions. React/Node CSS, mounting-only files and duplicate output states are omitted from the curated figures; the accompanying ZIP preserves complete tested source. Source ZIP contents were compared byte-for-byte with the executed project files.

Local app assignment 21 / workflow 20 also completed through the real report workflow. Its report 13 returns HTTP 200 for authenticated Word download and preview. The standard report has 34 image objects, including the seven original PDF pages and an intentionally split tall mobile capture. React code figures select `src/App.jsx`; Node selects `server.cjs`.

The app run exposed a stack-classification bug: mentioning React in source-screenshot preferences incorrectly required a React client for an Express-only question. The workflow now passes original question and additional instructions separately. Regression tests cover the screenshot preference and the legitimate explicit React frontend case. The failed diagnostic remains recorded separately; completed experiments were retained during the Node retry.

Focused checks passed 30 source/parser/provider tests and 55 workflow/interaction/report tests. The final full backend regression passed **368 tests** in 381.13 seconds, including real Java, C and C++ execution. The seven selected source previews independently matched their original line ranges, without horizontal overflow. All 26 PNGs were found embedded unchanged in the delivered Word package. All changes are local; no Railway deployment was performed.

Private evidence is under `backend/audit_artifacts/university-xyz/`: original extraction, complete manifests, runner records, source/image metadata, local workflow logs, downloaded app report, report validation and rendered Word QA pages. Deliverables are in the task's `outputs/` folder.
