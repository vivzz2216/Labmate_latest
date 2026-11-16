# LabMate

LabMate is a web app for programming labs. A student uploads a PDF or DOCX lab manual; LabMate
extracts the questions, generates and runs the code in an isolated sandbox, captures IDE-style
screenshots of the real output, and builds a downloadable Word report.

Supported lab types: Python, Java, C/C++, web (HTML, React, Node, Flask), MySQL, notebooks and
deep learning, distributed Java, and Ubuntu.

## Architecture

| Path | Purpose |
| --- | --- |
| `frontend/` | Next.js 15 app (App Router, TypeScript, Tailwind) with a same-origin `/api` proxy to the backend |
| `backend/app/` | FastAPI API, workflow queue and workers, runtimes, screenshot capture, report generation |
| `backend/scripts/` | Sandbox broker, worker provisioning and operator tooling |
| `backend/railway_runtime/` | Railway sandbox bridge (one microVM per job) |
| `backend/tests/` | Backend test suite |
| `google_colab/`, `sql_workbench/` | Static lab UIs rendered by the screenshot service |
| `chrome_extension/` | Chrome extension that sends a Drive file to LabMate |
| `infra/` | Terraform for the execution worker |

Student code never runs in the API process. Jobs go to an isolated Linux worker (SSH broker with
namespaces and cgroups) or to a Railway sandbox. The workflow queue is stored in PostgreSQL, so
workers can run as a separate, horizontally scaled service.

## Quick start

Requirements: Python 3.11, Node 22, PostgreSQL and Redis (or Docker).

```bash
cp backend/.env.example backend/.env   # then set SECRET_KEY, DATABASE_URL, REDIS_URL and a provider key
docker compose up --build              # frontend :3000, API :8000, docs at :8000/docs
```

Without Docker:

```bash
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000
cd frontend && npm ci && npm run dev
```

`backend/scripts/audit_app.py` starts a loopback-only launcher with SQLite and emulated Redis for
local testing.

## Tests and checks

```bash
cd backend && python -m pytest -o addopts="" tests -q
cd frontend && npx tsc --noEmit && npm run lint
```

To check every lab end to end (manual in, generated code run, screenshots, Word report out), run
`python backend/scripts/verify_labs.py` (add `--labs python sql` to pick labs; add
`--parallel 10 --workers 12 --heavy 12` for a concurrency test with separate accounts). It calls the
configured LLM provider, so it uses real quota. On Windows it needs a JDK (`JAVA_COMMAND`), a C
compiler (`C_COMPILER`, `CPP_COMPILER`), MySQL, and an environment with `torch` and `tensorflow-cpu`.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/REPOSITORY_MAP.md](docs/REPOSITORY_MAP.md) | Where every folder and service lives; request flow |
| [RAILWAY.md](RAILWAY.md) | Deployment, variables, private networking, scaling out to many students |
| [PAYMENTS.md](PAYMENTS.md) | Razorpay packs, webhooks, test-to-live procedure |
| [docs/ISOLATED_RUNTIME.md](docs/ISOLATED_RUNTIME.md) | Sandbox boundary and worker provisioning |
| [docs/LOCAL_WORKER.md](docs/LOCAL_WORKER.md) | Local VM worker notes |
| [docs/BACKEND_ENGINE.md](docs/BACKEND_ENGINE.md) | Execution and reporting engine |
| [docs/LLM_PROVIDERS.md](docs/LLM_PROVIDERS.md) | Provider routing, fallbacks and limits |
| [docs/SCREENSHOT_INTELLIGENCE.md](docs/SCREENSHOT_INTELLIGENCE.md) | Evidence planning and capture |
| [docs/TEMPLATE_ARCHITECTURE.md](docs/TEMPLATE_ARCHITECTURE.md) | Capture templates and categories |
| [docs/PIPELINE_BRIDGE_CONTRACT.md](docs/PIPELINE_BRIDGE_CONTRACT.md) | Browser bridge contract for the lab UIs |
| [CLAUDE.md](CLAUDE.md) | Contributor and assistant guide |

## Notes

- Execution on Railway is limited to the accounts in `EXECUTION_ALLOWED_EMAILS`; an empty list
  closes execution.
- Generated code and reports should be reviewed before submitting coursework.
