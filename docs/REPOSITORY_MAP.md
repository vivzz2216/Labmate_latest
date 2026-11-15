# Repository map

Where things live and how a request moves through the system. This is a map of the code as it is
today; "Proposed layout" at the end lists cleanups that need code changes and are not applied.

## Top level

| Path | What it is |
| --- | --- |
| `backend/` | FastAPI API, workflow workers, runtimes, tests |
| `frontend/` | Next.js app (UI) and the same-origin `/api` proxy |
| `google_colab/`, `sql_workbench/` | Static HTML/JS lab UIs; the backend renders them in Chromium for screenshots |
| `chrome_extension/` | Manifest V3 extension: "Send to LabMate" from Google Drive |
| `infra/gcp-worker/` | Terraform and startup script for the Linux execution worker |
| `docs/` | Operational and design documentation (index in the root `README.md`) |
| `Dockerfile`, `docker-compose*.yml`, `railway.json`, `start.sh` | Container and Railway deployment |
| `RAILWAY.md`, `PAYMENTS.md`, `PRODUCT.md`, `CLAUDE.md` | Deployment, billing, product context, contributor guide |
| `.claude/`, `.memory/`, `memory.graph` | Assistant tooling for navigating the codebase; not part of the product |

## Backend (`backend/app/`)

| Folder / file | Responsibility |
| --- | --- |
| `main.py` | App factory: middleware, router mounting, startup and shutdown of workers |
| `config.py` | All settings (environment variables) with startup validation |
| `database.py`, `models.py`, `workflow_schema.py` | Database engine and pool, ORM models, runtime schema upgrades |
| `schemas.py` | Pydantic request and response models |
| `cache.py`, `monitoring.py` | Redis client; health and metrics helpers |
| `routers/` | HTTP endpoints, one module per area (below) |
| `middleware/` | `auth`, `csrf`, `rate_limit`, `body_limit` |
| `security/` | JWT, signed asset URLs, execution admission, upload and generated-code safety checks |
| `services/` | Business logic (grouped below) |
| `runtime/GuiHarness.java`, `scripts/windows_ocr.ps1`, `public/` | Helper resources used by runtimes and screenshots (Java GUI harness, Windows OCR, IDE icon fonts) |

### Routers (`routers/`)

| Module | Area |
| --- | --- |
| `basic_auth.py` | Signup, login, refresh, profile |
| `upload.py`, `download.py` | Manual upload and preview; report download |
| `workflows.py` | The current assignment workflow API (create, status, results, report) |
| `lab_catalog.py` | Lab types and capabilities shown in the UI |
| `billing.py` | Credit packs and Razorpay checkout and webhooks |
| `admin.py`, `feedback.py`, `ai_review.py` | Operator dashboard, feedback, code review |
| `assignments.py` | Assignment records |
| `parse.py`, `run.py`, `analyze.py`, `tasks.py`, `compose.py` | Older step-by-step API from before the workflow queue. Only the frontend `preview` page is known to call `compose`; confirm no callers before removing any of these |

### Services (`services/`), by area

| Area | Modules |
| --- | --- |
| Workflow orchestration | `assignment_workflow`, `workflow_queue`, `workflow_batch`, `background_tasks`, `brain_agent` |
| Manual parsing and planning | `manual_sections`, `lab_question_filter`, `pdf_ocr`, `evidence_planner`, `project_detector`, `unix_manual`, `unix_theory` |
| LLM generation | `generation_service`, `gemini_service`, `glm_service`, `deepseek_service`, `free_provider_service`, `claude_client`, `provider_budget`, `retry`, `code_review_service` |
| Execution transport | `isolated_runtime` (SSH worker or Railway sandbox), `railway_sandbox`, `runtime_engine`, `resource_budget`, `worker_health` |
| Language runtimes | `executor_service`, `flask_runtime`, `web_runtime`, `web_project`, `gui_project`, `java_gui_runtime`, `dc_runtime`, `spark_runtime`, `notebook_runtime`, `notebook_limits`, `notebook_magics`, `colab_worker`, `colab_pipeline`, `colab_requirements`, `ubuntu_runtime`, `sql_runtime` |
| SQL labs | `sql_runtime`, `sql_accounts`, `sql_instructions`, `sql_result_checks`, `sql_report` |
| Screenshots and evidence | `screenshot_service`, `lab_capture`, `lab_resources`, `browser_capture`, `browser_scenarios`, `source_evidence`, `report_evidence`, `vscode_presentation`, `viewport_policy`, `ubuntu_reference_outputs` |
| Reports | `compact_report`, `ubuntu_report`, `sql_report`, `docx_layout` |
| Accounts and billing | `profile_service`, `billing_service`, `admin_analytics` |
| Storage | `storage_service` (local disk or S3) |
| Legacy (older pipeline) | `parser_service`, `analysis_service`, `composer_service`, `task_service`, `webdev_intelligence`. The active workflow still imports a few helpers from `analysis_service` and `parser_service`, so these are not yet safe to delete |

### Request flow

1. The browser calls `/api/...` on the Next.js app, which proxies to the FastAPI service.
2. `upload` stores the manual; `workflows` creates an `AssignmentWorkflow` row in PostgreSQL.
3. A workflow worker (`workflow_queue`, in the API process or as `LABMATE_ROLE=worker`) claims the
   row with a lease, parses the manual, and calls the LLM for each question.
4. Each generated project runs through `isolated_runtime` in the sandbox, bounded by
   `resource_budget`.
5. `screenshot_service` renders IDE-styled evidence from `backend/templates/`, and a report
   builder writes the `.docx`, stored through `storage_service`.
6. The UI polls the workflow until the report is ready.

### Other backend folders

| Path | Contents |
| --- | --- |
| `backend/templates/` | HTML themes used to render screenshots (IDLE, VS Code, Notepad, Code::Blocks, Jupyter, browser) |
| `backend/app/workflow_schema.py` | Idempotent startup schema column and index provisioning alongside SQLAlchemy `create_all` |
| `backend/scripts/` | Operator tooling: `verify_labs.py` (run every lab end to end), sandbox broker and job runner, worker provisioning, namespace verification, local worker, Ubuntu worker and desktop scripts |
| `backend/railway_runtime/` | Node bridge and job runner for Railway sandboxes, with its own tests |
| `backend/tests/` | Backend tests (`pytest`); `conftest.py` isolates database, network and temp directories |
| `backend/railway.json`, `railway.worker.json` | Railway service configs for the API and the worker service |

## Frontend (`frontend/`)

| Path | Contents |
| --- | --- |
| `app/` | Pages (App Router): `/` home, `/login`, `/dashboard`, `/workspace`, `/code-execution` (main studio), `/labs`, `/reports`, `/checkout`, `/user-dashboard`, `/admin`; `/preview` and `/ubuntu` are older pages |
| `app/api/[...path]` | Proxy to the backend (see `lib/backend-proxy.ts`) |
| `components/` | UI by area: `auth`, `billing`, `brand`, `dashboard`, `hero`, `home`, `preview`, `ui` (shared primitives), `visual`, `workflow` |
| `contexts/` | `BasicAuthContext` (session state) |
| `lib/` | `api.ts` (HTTP client), `workflow.ts`, `labCatalog.ts`, `billing.ts`, `adminApi.ts`, `sanitize.ts`, `utils.ts` |
| `public/` | Static images, favicon and robots |

## Common tasks

| I want to... | Look at |
| --- | --- |
| Change how a manual is split into questions | `services/manual_sections.py`, `lab_question_filter.py` |
| Change a prompt or add an LLM provider | `services/generation_service.py` and the provider modules |
| Add a language runtime | `services/runtime_engine.py`, the matching `*_runtime.py`, and `security/generated_code.py` |
| Change what a screenshot looks like | `backend/templates/*.html`, `services/screenshot_service.py` |
| Change report layout | `services/compact_report.py`, `docx_layout.py` |
| Change limits for many students | `config.py`, `middleware/rate_limit.py`, `RAILWAY.md` |
| Add an API endpoint | a module in `routers/`, mounted in `main.py` |

## Proposed layout (not applied; needs code changes)

- Group `services/` into packages: `llm/`, `runtimes/`, `capture/`, `reports/`, `workflow/`, `sql/`.
- Move the older step-by-step API and its services into a `legacy/` package, then delete it once
  no caller remains.
- Split `assignment_workflow.py` (about 1,250 lines) and the largest frontend pages
  (`code-execution`, `user-dashboard`, `workspace`) into smaller modules and hooks.
- Group `backend/tests/` into `unit/`, `integration/` and `security/`.
- Add Alembic for migrations and a CI workflow.
