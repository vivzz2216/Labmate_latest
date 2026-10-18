# Veruance web development manual test results

Historical baseline before the remediation below. For current code, the ten-experiment rerun and remaining release blockers, read [Release verification](RELEASE_VERIFICATION_2026-10-17.md). The original observations here are retained as evidence.

Test date: 17 October 2026, Asia/Calcutta.

**This manual does not currently pass LabMate end to end.** The first automatic extraction retained 9 of 10 experiments. Of those nine, LabMate marked two completed and seven failed. The omitted registration experiment was then submitted separately using its original requirements and also failed automated verification. The Notes experiment was marked completed despite missing the required edit feature.

The test used the running local application at http://127.0.0.1:3016, actual configured Groq calls, real runtime adapters/headless browsers, original generated source and actual downloadable reports. No application source was changed for this test. Supplemental checks changed only trusted test plans or requested routes, not the generated application code. This was not a Railway deployment test.

Input: `C:/Users/pilla/Downloads/Veruance_Web_Development_Lab_Manual_10_Experiments.docx`. Both uploads had the same SHA-256. The original file was not edited. Manual instructions were treated as experiment requirements, not instructions for operating this computer.

## Experiment results

The numbers below are the original manual numbers. After skipping experiment 2, LabMate renumbered the remaining results 1–9; those result IDs must not be confused with the source manual's numbers.

| Manual experiment | Automatic workflow result | What actually worked | What failed or remains unverified |
| --- | --- | --- | --- |
| 1. HTML/CSS portfolio | Failed | Portfolio content rendered in an actual browser capture | No valid browser test plan. Required mobile and desktop evidence was not produced. Source references styles.css but no separate stylesheet was supplied; inline CSS does not satisfy delivery of the requested external CSS file. Navigation/overflow/alt-text checks were not established. |
| 2. JavaScript registration form | Skipped in first extraction; supplemental single-experiment test failed | Form rendered; Name and Phone fields were filled | Test step 3 tried fill on the Course select/combobox, which Playwright rejects. The valid-submission scenario never ran. Repaired code also uses Register while the retained test expects Submit. Invalid/successful form behavior was not confirmed; required distinct states were missing. This is a test-runner/test-plan failure, not proof that all form validation code is broken. |
| 3. React profile | Failed | Source contains the requested component shapes and state handlers, but this alone is not execution proof | Actual browser screenshot shows Vite failed to resolve ./App.css. That file was not generated/supplied. No valid interaction plan was available either. Biography/theme behavior did not pass verification. |
| 4. React Router campus app | Completed for the generated tests | Generated tests passed Home navigation and a department dynamic route. Five independent direct-route checks also passed: /home, /events, /about, /departments/cse, /missing-audit-route | Original workflow report captured only its two scenarios, not every requested state. Active-route styling and all accessibility details were not independently audited. This is the strongest working experiment in this run. |
| 5. React to-do list | Failed | With independently authored valid plans, the unchanged source passed adding tasks, completing a task and displaying it through the Completed filter | Model-authored plans were rejected because label/placeholder locators included a nonempty role. The automatic workflow therefore failed. Explicit reload persistence, blank-input rejection, deletion and the complete filter matrix remain unverified. |
| 6. Product catalogue | Failed | Eight sample products and catalogue code were generated; that is source evidence only | Invalid locator fields prevented automatic testing. Actual browser capture also shows missing ./App.css. Product images refer to external placeholder URLs, incompatible with the runner's blocked external requests. Search/filter/sort/count correctness was not verified. |
| 7. Responsive dashboard | Failed | Dashboard content rendered | The test could not find its expected filter control. Required interaction and mobile/desktop evidence did not pass. No full responsive-layout pass is claimed. |
| 8. Data fetching/loading/error/retry | Failed | User cards rendered from an immediate local Promise. An independent correctly located Search test passed the no-results state | Original test could not find its search control. Generated fetchUsers uses Promise.resolve over a hardcoded array, rather than a public/supplied HTTP endpoint. It supplies no controlled failure mode. Actual endpoint fetching, visible loading/error states and retry recovery were not verified. |
| 9. React notes CRUD | Completed by LabMate, but incomplete against the manual | Actual add-note and confirm-delete scenarios passed; the second fresh page restored the first scenario's note sufficiently to delete it | Generated source has no Edit control or update handler. The extracted question omitted the manual's explicit editing requirement. Search and an explicit post-reload evidence scenario were not tested. LabMate's completed/verified label is too broad for the full manual requirement. |
| 10. React + Express events app | Failed | Combined frontend/backend source was generated | Raw React JSX was placed in a Node server script; Node stopped with SyntaxError: Unexpected token '<'. Neither full-stack startup nor API/frontend integration passed. No successful add-event/validation response is claimed. |

**Counts:** initial automatic run = 2 completed, 7 failed, 1 omitted. Including the supplemental registration run = 8 experiments with failed automatic verification, 2 marked completed; one of the completed experiments has a confirmed missing feature. These counts do not mean eight applications are entirely nonfunctional: some failures are in the test-generation/verification workflow, and the independent successes above are intentionally retained.

## Extraction and requirement integrity

The first extraction omitted experiment 2. A second extraction of the identical file retained only three questions, corresponding to Router, Catalogue and Events API. The saved source hashes are equal, so this was not an input-file difference.

A direct probe of the existing actionable-question filter rejected the original problem-statement text for experiments 1–9 even when the correct language argument was supplied; experiment 10 was accepted. Many valid UI problem statements do not contain the filter's chosen programming keywords. Generated rewording that happens to include React/HTML/program terminology can therefore change which tasks survive filtering. The raw pre-filter model response is not persisted, so the exact model-versus-filter contribution to each omitted question cannot be reconstructed; the observable count loss and filter weakness are independently reproduced.

Extraction also failed to preserve all evidence/checklist requirements. In particular, Notes editing was absent from the extracted question and generated code even though the original manual explicitly requires it. A few passing model-authored scenarios cannot establish full manual coverage.

## What worked in the pipeline

- Authenticated upload, queue processing, real model calls, configured runtime startup and browser capture.
- Genuine failure handling: the overall workflow stayed failed and produced a diagnostic report.
- The original nine-result report downloaded with HTTP 200 and opened structurally using python-docx. Its 33 embedded images decoded successfully and retained correct aspect ratios.
- The supplemental registration diagnostic downloaded with HTTP 200; its four embedded images also decoded and retained their aspect ratios.
- Generated Router navigation and Notes add/delete scenarios passed actual browser assertions.
- Independently authored tests on unchanged generated code passed five Router routes, to-do add/complete/filter, and directory no-results search.

The main automatic run took 411.226 seconds, including model retry delays and report generation. Groq returned transient/rate-limit conditions on several calls; LabMate retried while preserving progress. The registration supplemental run took 242.511 seconds including time queued behind the main run and its retries/repair attempts.

Physical Word page rendering remains unverified because the required bundled LibreOffice executable is unavailable. Structural opening, image decoding and aspect-ratio checks do not establish print-layout correctness. The browser evidence here comes from LabMate's headless experiment runner, not a claim of having manually exercised LabMate's frontend UI.

## Highest-priority fixes exposed by this manual

1. Preserve explicit experiment boundaries/numbers and validate extracted count against the document before processing. Avoid filtering valid UI assignments solely by prose keywords; retain titles, tasks, evidence requirements and checklists.
2. Generate and validate a bounded source-file manifest so CSS/component imports resolve. A single code string cannot reliably represent the requested multi-file and full-stack projects.
3. Validate generated browser plans before execution, enforce locator-field consistency, support bounded select/reload/absence checks, and regenerate/revalidate plans after source repair changes labels or controls.
4. Track requirement coverage. A Notes add/delete test must not make an edit/create/delete/search/persistence assignment fully verified.
5. Provide controlled fetch/error fixtures and separate Node/React launch paths. Keep external browser requests blocked; do not bypass isolation to make the examples appear successful.

No fixes were applied as part of this test; these are findings for the next implementation pass.

## Saved evidence

All detailed data is under `backend/audit_artifacts/veruance-20261017/`:

- `extraction.json`, `workflow.json`, `internal-results.json`, `run.json`, `run.log`: first automatic run.
- `missing-registration/`: separate test of original experiment 2, including the second extraction and actual failed step.
- `supplemental-route-tests.json`, `supplemental-todo-tests.json`, `supplemental-search-tests.json`: independent checks with generated source unchanged.
- `filter-probes.json`: direct filtering results for the manual's original problem statements.
- `experiment_01_generated.txt` through `experiment_10_generated.txt`: actual final generated source used in the tests.
- `evidence/experiment_XX/`: source previews and original browser captures mapped back to original experiment numbers.
- `report-validation.json`, `final-artifact-validation.json`: report/image checks.
- `Veruance_WebDev_10_Experiments_Test.docx` and `missing-registration/Veruance_Registration_Supplemental_Test.docx`: diagnostic artifacts, not successful lab submissions and not visually certified Word layouts.

This real-manual test reveals larger gaps than the earlier small-fixture audit. Basic React/runtime support works, but this ten-experiment manual is not reliably extracted, generated and fully verified by the current workflow.
