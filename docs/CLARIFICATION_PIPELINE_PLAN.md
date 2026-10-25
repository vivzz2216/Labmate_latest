# Assignment planning and clarification

Implemented locally, with an end-to-end Experiment 9 check on 25 October 2026. This replaces the earlier proposal to ask every student three routine preference questions. The user has authorized automatic topic selection when the manual offers alternatives.

## Behavior

The planner preserves the extracted assignment and selects one suitable topic from the manual's alternatives. An explicit student topic takes precedence. For mini-projects it proposes two to four locally testable features and uses the framework already required by the assignment. Clear ordinary exercises and theory questions need no additional planning API call.

Missing essential facts can produce up to three focused questions, grounded in literal source excerpts. Unsupported frameworks prompt a supported-runtime or manual-review choice. Unsupported external-service requirements must be reviewed or revised; the planner cannot silently replace database/payment evidence with a mock. Questions never request credentials. A maximum of two clarification rounds prevents an endless interview.

The single-assignment page shows the project plan or pending questions above its processing controls. A batch item that needs clarification links to that assignment. Other uploaded files continue independently; questions within one assignment share its planning checkpoint.

## Persistence and authority

AssignmentWorkflow.agent_plan stores the source/instruction fingerprint, revision, decisions, pending questions and answers. The additive, idempotent startup migration supports existing SQLite and PostgreSQL installations. Refreshes and worker restarts retain this record. Identical resumes reuse a ready plan; changed inputs invalidate it.

The ownership-checked, authenticated, CSRF-protected clarification endpoint validates the revision and exact pending question IDs. A conditional database update rejects a stale or duplicate submission. Essential decisions are resolved before credit reservation or execution.

This is a structured planner around the existing pipeline. It chooses among existing generation, console, browser, API, Flask and Java UI adapters, source capture, output capture, verification, bounded repairs and report composition. It cannot install arbitrary tools, execute planner-generated scripts, change admission/billing rules, acquire credentials or grant new capabilities. Documents and model output remain task data.

## Mini-project evidence

Every authored source file is captured, including CSS, HTML shells, React mounting code, components and data. Captures use readable pages of 32 original lines; no middle section is silently dropped. Original line ranges and source hashes are recorded. Missing pages fail the evidence check. Projects exceeding 80 source-image pages must be split.

Mini-project reports append source/output images and captions to the original manual. Generated source is not pasted as Word text. A generated description is included only when requested. Failure details remain visible in diagnostic reports. Ordinary exercise/report behavior is preserved.

React responses that name index.html as the entrypoint can be normalized only when that file references exactly one supplied local JS/JSX module. No missing module is invented. Browser results remain required evidence; a model's success claim never establishes verification.

## Providers

The planner uses the existing generation/fallback service. DeepSeek uses configurable DEEPSEEK_MODEL (default deepseek-flash). The optional international Z.ai route uses GLM_ENABLED, GLM_API_KEY, GLM_MODEL (default glm-5.3-flash), GLM_ENDPOINT and bounded timeout/output settings. Keys stay on the backend. Outages, quota failures and invalid JSON retain normal fallback and checkpoint behavior. Configuring a provider does not establish that its account has usable quota.

## Verification

The real EXP-9 document produced one React Restaurant project. Menu filtering and adding two cart items passed browser tests, including the observed total of 19.98. All 121 source lines in seven authored files were covered by eight source images; two browser images completed the ten-image Word report. Download through the app passed, with no raw generated solution code in Word paragraphs.

A separate unsupported-framework fixture paused before execution, retained questions after reload, displayed at desktop/mobile sizes, persisted the selected answer and stopped for manual review. Regression tests cover complete source coverage, missing-page failure, provider validation, clarification ownership/revisions, diagnostic reports, ordinary workflows and theory handling. Local verification does not establish Railway deployment or unrestricted production isolation.
