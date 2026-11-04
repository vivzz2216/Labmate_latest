# SQL submission fixes and verification

Seven source manuals were tested through authenticated upload, extraction,
generation, real MySQL 8.0.46 execution and Word download. Assignments 67 through
73 all completed. The final downloaded files were checked against the delivered
reports by SHA-256. Original source manuals were not modified.

## Confirmed fixes

- Independent join checks compare complete projected row multisets against saved
  input tables. This caught the earlier FULL OUTER emulation repeating unmatched
  customers and omitting unmatched orders. The regenerated query passes.
- HAVING COUNT greater than five requires sample data with a qualifying group.
- WorkCenterStats is checked against the sum of actual saved capacities. The
  observed totals are 100 and 300; contradictory model explanations are excluded.
- Procedures retain all result sets. The cursor example now records Bangalore,
  Delhi and Mumbai, rather than losing later results. Private routine metadata
  retrieval returns the actual definition instead of NULL.
- SQL submission reports use saved execution receipts for query counts, not AI
  explanations that may be stale after a repair. Original invalid examples,
  copied class headers and inherited pagination are not appended to submissions.
- Completed post-experiment answers and a conclusion are supplied. Internal
  verification logs, raw Markdown and irrelevant adaptation boilerplate are absent.
- Each Workbench frame has its own landscape page. Explicit section page breaks
  avoid caption/image splits and blank pages. No title border is inherited.
- SQL_Exp_8 uses the filename's submission number 8; its source heading says 7.
  Source question identifiers remain unchanged. Missing identity fields are omitted.

## Verification

- 50 focused extraction, MySQL runtime, report and workflow tests passed. Later
  formatting/answer checks were rerun: 4 passed. These counts overlap.
- All seven real manual runs completed; only bounded repairs were used.
- The cursor example was re-executed from its saved generated code after the
  result-set fix, without another generation call.
- All 130 final Word pages were rendered and visually checked, containing 118
  Workbench frames. Structural checks found no blank or caption-only pages.
- Final authenticated report downloads match the delivered files.

Reports, ZIP, JSON execution receipts, test XML/logs and QA evidence are under
`backend/audit_artifacts/sql-submission-fixes-20261026/`.

These are local verification results. A full backend suite and a new Railway
deployment were not performed for this change. Workbench evidence is rendered in
the browser from real MySQL receipts, not captured from the native desktop app.
