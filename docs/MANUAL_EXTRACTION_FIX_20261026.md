# SQL and Data Science Experiment 6 extraction fix

## Reproduced cause

Both supplied four-page PDFs returned zero numbered tasks before the fix.
The SQL manual's handwritten theory instruction excluded its complete practical.
The data-science manual's theory example mentioning handwritten digit recognition
also excluded its complete practical. The fallback section filter then excluded
the commands under Laboratory Exercise / Procedure, leaving only a short preamble.

## Changes

- Filter academic theory sections before applying whole-exercise exclusions.
- Preserve practical procedures, post-lab questions, dataset references and
  result/program-code evidence requirements. Entire handwritten experiments remain excluded.
- Infer SQL from SQL statements and notebook execution from scientific Python imports
  when the experiment title does not specify a language. Explicit web-language titles retain priority.
- Add regression text fixtures taken from the supplied PDFs and extraction/process-submission tests.

## Verified locally

- 61 tests passed across extraction, original manual boundaries, theory/handwriting,
  workflow submission/report and backend engine regression tests (110.34 seconds).
- Through the running frontend API proxy: authenticated, uploaded each original PDF,
  queued extraction and polled completion. Both returned ready, original experiment
  ID 6, correct SQL/Colab language and preserved practical requirements.
- Original failed assignment 47 (data science) and 48 (SQL) were retried and are ready.
- Fresh verification uploads are 49 (SQL) and 50 (data science).
- No AI request is needed for these numbered extractions. No generation API was
  called by the new automated extraction/submission regression tests.
- Local frontend returned HTTP 200; updated backend is running on port 8000.

Raw live results and the reproducible verifier are under
`backend/audit_artifacts/manual-extraction-20261026/`.

## Scope

This verifies upload, extraction, classification and process submission, not a new
full code-generation/execution/Word run of these two manuals. The data-science
exercise references `home_loan_train.csv`, which is not supplied by the PDF itself.
No Railway deployment was performed.
