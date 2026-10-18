# LabMate release verification

Provider follow-up: [Free API setup](FREE_API_SETUP.md) records the subsequent OpenRouter and OpenCode adapters, a 346-test backend run, and the actual activation limits. The manual outcomes below remain unchanged; no new live OpenRouter success is claimed without its key.

The verification pipeline is stricter and the application runs locally without Docker. The ten-experiment Web Development manual has **not** passed as a complete generated record. Unrestricted student execution remains blocked by the shared host process security boundary. Do not interpret passing infrastructure tests as release approval.

## Implemented

- Preserve explicit experiment numbers and complete requirements during extraction. Detect duplicated sections and incomplete numbered manuals. The supplied manual extracts all ten experiments without an AI rewrite.
- Generate complete HTML, React, and React plus Express file manifests. Validate paths, local imports, referenced assets, SVGs, source requirements, and separate server entrypoints before execution. Reject missing files and raw JSX in Node servers.
- Expand bounded declarative browser steps into a strict internal protocol. Test dropdowns, navigation, checkbox state, visible changes, absence, counts, ordering, persistence, responsive overflow, and actual HTTP responses. Generated test scripts remain prohibited.
- Require an explicit confirmed click with the exact expected message for native confirmation dialogs. Dismiss undeclared dialogs. Keep external browser requests and WebSockets blocked.
- Retry the complete code and test bundle together, including validation feedback when the previous response was invalid JSON. Missing coverage and failed interactions remain failed.
- Retain actual screenshots and diagnostic Word reports for failed execution. Report coverage, failure details, expected and observed results, all project files, and the limits of verification. Preserve the original uploaded manual.
- Try configured Gemini after primary Groq unavailability, then the configured secondary Groq model with the existing key. Preserve completed checkpoints if all providers are unavailable. No account was topped up or upgraded.
- On Railway, deny execution until exact invited account emails are configured in `EXECUTION_ALLOWED_EMAILS`. Enforce the same restriction in submission endpoints and queued workers.

## Manual test evidence

Input: `C:/Users/pilla/Downloads/Veruance_Web_Development_Lab_Manual_10_Experiments.docx`.

SHA-256: `e2c09cb9b55070eba658eb53c5470571fb522576f08c0080cbe14229f3ec27a1`.

The original file is unchanged. Recorded real-provider responses are replayed through the current runner for repeatability; replay is explicitly labelled and does not demonstrate a fresh successful generation call. No manually repaired solution is counted as a model pass.

| Experiment | Observed outcome | Evidence or remaining failure |
| --- | --- | --- |
| 1 Portfolio | Passed recorded generated solution | Desktop and mobile layout, navigation, source checks and native evidence |
| 2 Registration | Passed recorded generated solution | Generated scenarios plus six independent field validation and valid submission checks |
| 3 Profile components | Passed recorded generated solution | Components, props, stable keys, theme and biography interactions |
| 4 Routing | Failed live generation | Missing startup instructions, then malformed JSON; earlier response also omitted direct and dynamic route coverage |
| 5 Todo | Failed live generation | Overlong scenarios and invalid locator kinds; earlier executable response had ambiguous repeated controls |
| 6 Catalogue | Failed live generation | External placeholder assets blocked; no passing complete generated catalogue |
| 7 Dashboard | Failed live generation | Invalid locator kinds and malformed JSON; earlier response referenced missing CSS |
| 8 Fetch and retry | Failed live generation | Malformed JSON and malformed declarative steps; earlier response also omitted required fetch and retry coverage |
| 9 Notes | Blocked on final live rerun | Secondary Groq model also exhausted its daily quota. Earlier response used unsupported locators and contained a mismatched create callback; native confirmation now has focused runner coverage |
| 10 React and Express | Not reached on final live rerun | Quota stopped the run at experiment 9. Earlier responses were malformed JSON; separate React and Express runtime is covered by an actual browser and HTTP fixture test |

Private logs, extracted questions, generated files and PNGs are under `backend/audit_artifacts/`, which is ignored by Git. Principal locations: `veruance-provider-r14/`, `veruance-release-replay/`, and `veruance-registration-independent/`.

## Verification and limits

Final backend suite: **330 passed**, 59 warnings, 358.44 seconds, no skipped tests. The run used the installed Java 17 and C/C++ compiler paths. It covers runtime execution, browser boundaries, React and Express, positive and negative Word workflows, access restrictions, batch downloads, queues and resume behavior. The warnings are retained in `backend/audit_artifacts/release-final-suite-2.log`.

The live manual rerun stopped at experiment 9 on quota exhaustion. Current-code replay of the three previously successful generated solutions passed all three on their first attempt. Independent registration testing passed six scenarios against unchanged generated source. Passing deterministic tests does not supersede the failed live-generation outcomes above.

Frontend production build passed (`backend/audit_artifacts/fix-frontend-build.log`), and a final `tsc --noEmit --incremental false` exited successfully. Python compilation and `git diff --check` passed. Local homepage, frontend and backend readiness, and API proxy returned HTTP 200 at `http://127.0.0.1:3016` and `http://127.0.0.1:8016`. The local app was restarted with the updated code after the confirmation fix.

The owned Add workflow test exercises generation fixtures through real Chromium, workflow storage, Word composition, preview, and authenticated report download. It confirms that 2 plus 3 produces a completed report, while 23 remains failed with a downloadable diagnostic report. Deterministic fixture generation is not a live provider test.

LabMate's own UI was not browser interaction tested because browser control is disabled in Work settings. Generated assignment pages were exercised using the application's own Playwright runtime; representative portfolio, invalid registration and profile screenshots were visually inspected for readability. Word packages and embedded images were checked structurally; page layout was not visually approved because the installed workspace lacks LibreOffice. No claim of complete Word layout QA is made.

The primary Groq model hit its daily quota. Configured Gemini returned HTTP 402 for depleted prepaid credits. GPT OSS 20B responded using its separate model quota, but repeatedly generated malformed or incomplete projects, then also exhausted its daily quota. Available quota alone does not establish adequate generation quality. Full manual acceptance requires a successful live rerun with a reliable provider and adequate quota.

## Deployment disposition

Changes are local on `codex/railway-ready-20261016`. They have not been pushed or deployed. Existing Railway deployment remains at the earlier revision.

Before unrestricted public launch, move generated code into a genuine per-run isolated execution service. The beta email gate limits admission but does not isolate filesystem or network access between processes. Before a controlled beta update, configure the invited emails and verify the changed build on Railway with a valid Add run, a failed diagnostic run, and report persistence after restart. The full Web Development promise also requires all ten original experiments to pass without substituting simplified solutions.
