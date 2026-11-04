# LabMate manual pipeline checks

Local result: 7 of 7 exercises pass across five new test manuals. SQL and Colab received two exercises each; Python, Java and standalone HTML received one smoke exercise each. All questions were extracted with the expected language classification.

Three failures were reproduced and fixed:

- Pandas Copy on Write made a generated chained inplace fill ineffective. The isolated notebook worker now fails cells on ChainedAssignmentError; Colab generation requests explicit assignments. The rerun has zero missing scores and section totals of 240 each.
- The Java planner interpreted "No GUI" as a GUI request. Negated framework requests now stay on the console path unless actual generated GUI code requires otherwise.
- Unrelated "before" and "after" wording invented an intermediate-state screenshot requirement after the HTML Add test had passed. The planner now scopes this requirement to related clauses or explicit state capture requests; positive before/after and invalid/successful cases remain covered.

Evidence: 43 independent checks, a second browser calculation, and 36 distinct focused pytest cases passed. Deliberately failing SQL and notebook runs produced diagnostic Word reports while retaining failed status. All 33 final source/output screenshots are present in the five Word exports. All 37 report pages and seven input pages were rendered and reviewed.

Artifacts: `backend/audit_artifacts/pipeline-check-20261027/`. Start with `README.md`, `oracle-results.json`, the three pytest XML files, or `LabMate_Test_Manuals_and_Results.zip`.

Limits: these were local direct-workflow tests without Docker, using native MySQL and local Python. They do not verify Railway, browser login/upload, payments, concurrency, Google-hosted notebooks, Java GUI or React/Node. Long Colab captures have small output text at printed scale; original full-resolution PNGs are included. Some explanation text retains Markdown markers. Provider rate limiting occurred in the initial burst; fallback eventually completed generation. The entire backend/frontend suite was not run. Ubuntu was outside this task.
