# Veruance manual reviewed solution results

On 18 October 2026, all ten experiments from the original Veruance Web Development Lab Manual passed a local run using complete engineer-reviewed solutions. The solution-generation responses were supplied from reviewed manifests; execution, browser actions, HTTP tests, source checks, evidence capture, and report export were real. This is not a claim that the free API generated all ten projects successfully.

The run passed 22 browser scenarios with 105 assertions and four Express API tests, and captured 59 browser screenshots. Every capture occurrence is embedded in the final test-result Word document, including repeated initial and final frames. The source manual SHA256 is recorded in that document and the private run manifest.

| Experiment | Result | Browser assertions | Captures |
| --- | --- | ---: | ---: |
| Portfolio and responsive navigation | Passed | 6 | 3 |
| Registration validation and successful submission | Passed | 9 | 6 |
| React components props biography and themes | Passed | 6 | 4 |
| Shared navigation dynamic routing and Not Found | Passed | 9 | 7 |
| Task creation completion filters deletion and persistence | Passed | 14 | 6 |
| Catalogue search combined filters both sort orders counts and empty state | Passed | 14 | 7 |
| Desktop and mobile dashboard with upcoming deadlines | Passed | 8 | 5 |
| Real HTTP data fetching loading error retry search and empty state | Passed | 13 | 8 |
| Notes validation create edit search confirmed delete and persistence | Passed | 15 | 7 |
| React and Express list validation add and reload | Passed | 11 | 6 |

The repaired solutions were then run through the owned assignment 20 workflow. Experiment 1's earlier verified checkpoint was retained; experiments 2–10 ran through normal workflow execution and evidence selection. The workflow reached completed at 100%, all ten result statuses were completed, and its authenticated Word download returned HTTP 200. The workflow log explicitly records reviewed solution provenance.

The final test-result report is created by `backend/scripts/build_manual_test_report.py`. It is separate from the application export, which preserves the original manual and includes source files and selected evidence. Report tests passed four cases: every repeated capture is embedded, failed runs remain failed, missing images block report creation, and the workflow Word exporter rechecks image existence at write time. Earlier browser/workflow/report regression cases also passed; the initial report-test assertion had a capitalization error, which was corrected and rechecked.

The final DOCX was rendered to 58 pages with LibreOffice, visually reviewed and checked for page-boundary overflow. The rendered PDF contains exactly 59 screenshot occurrences. All 57 distinct embedded PNG byte streams match their original capture files; repeated frames account for the 59 occurrences. ZIP integrity passed for both the delivered report and the authenticated application download.

The earlier 351-test backend regression and 30-test provider/resume/parser regression remain relevant; they predate the final missing-screenshot export guard and report builder. The four report tests and real assignment 20 completion cover these final changes. No frontend code changed in this repair.

Provider capacity remains a separate limitation: the live free-provider run had paused after quota, timeout and malformed-generation failures. No paid service was activated, no production fallback was hardcoded to this manual, and no provider output or execution result was silently upgraded to passing. This local reviewed run does not establish unrestricted public runner isolation or Railway deployment readiness.

Private evidence is under `backend/audit_artifacts/veruance-reviewed/`, excluded from Git. The delivery file is `C:/Users/pilla/Documents/Codex/2026-10-13/r/outputs/Veruance_Web_Development_Manual_Test_Result.docx`.
