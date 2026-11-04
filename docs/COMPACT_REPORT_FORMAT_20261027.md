# Compact code report format

Default code-only reports now contain one short question heading, the saved source/output screenshots, and a short caption below each image. They omit copied manual pages, generated explanations, setup prose, summary tables and conclusions. This applies to Python, Java, C/C++, WebDev, React/Node, Colab and SQL. Explicit theory mode retains its requested answers. The separate Ubuntu report remains outside this change because Ubuntu work was deferred.

Captions use existing evidence metadata and make no additional model request. Code-generation instructions now ask for no more than one 20-word explanation sentence while preserving complete code and verification plans. Original uploads and saved execution receipts remain unchanged.

Failed runs retain concise diagnostic details, including failed browser actions and expected/observed results. Missing screenshots cannot be silently omitted from a successful report.

Validation: 27 formatting, theory and planner tests passed; the subsequent evidence-integrity run passed 17 cases including the five new formatting cases. TypeScript checking passed. Saved receipts rebuilt five example reports without AI calls. The complete Python and Java examples were rendered and visually reviewed; each fits one page. Examples are under `backend/audit_artifacts/compact-reports-20261027/`. These changes are local, with no Railway deployment performed.
