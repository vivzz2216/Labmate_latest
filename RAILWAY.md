# Deploy LabMate on Railway

Deploy two services from the same repository and add PostgreSQL and Redis. The frontend serves the website and proxies API requests, signed screenshots, downloads, and health requests to the backend over private networking. The backend runs its own workflow consumers, compilers, Node runtime, and Chromium browser. A separate worker service is not needed for this layout.

## Service settings

Use these service settings in Railway. Railway has deprecated Config as Code, so configure the service fields directly; the legacy `railway.json` files are retained only for older services that already use them.

| Setting | backend | frontend |
| --- | --- | --- |
| Root Directory | `/backend` | `/frontend` |
| Builder | Dockerfile | Dockerfile |
| Dockerfile Path | `Dockerfile` | `Dockerfile` |
| Build / Start Command overrides | Leave empty | Leave empty |
| Healthcheck | `/health/ready` | `/health/live` |
| Public domain | Not required | Generate a Railway domain |
| Replicas | 1 | 1 initially |
| Volume | Mount at `/data` | None |
| App sleeping | Disable while workflows run | Optional |

The root `Dockerfile` and `/railway.json` provide an alternative **backend-only** deployment with Root Directory `/`. They do not deploy the frontend. Prefer the isolated roots above. The root and backend Dockerfiles use the same dependencies and startup command, with COPY paths adjusted for their build contexts.

## PostgreSQL, Redis, and backend variables

Add Railway's PostgreSQL database service, named `Postgres`, and Redis service, named `Redis`. Set these variables on **backend**, with the service references entered literally in Railway's Variables editor:

```dotenv
DATABASE_URL=${{Postgres.DATABASE_URL}}
SECRET_KEY=<a unique random secret with at least 32 characters>
PORT=8000
DATA_DIR=/data
STORAGE_BACKEND=local
WORKFLOW_WORKERS=2
RATE_LIMIT_ENABLED=true
REDIS_URL=${{Redis.REDIS_URL}}
REDIS_REQUIRED=true
LLM_PROVIDER=groq
GROQ_API_KEY=<your Groq API key>
GROQ_MODEL=openai/gpt-oss-120b
GROQ_FALLBACK_MODEL=openai/gpt-oss-20b
GROQ_MAX_COMPLETION_TOKENS=12000
GROQ_REASONING_EFFORT=low
LLM_FALLBACK_PROVIDER=gemini
FREE_LLM_FALLBACK_ORDER=openrouter,opencode
OPENROUTER_API_KEY=<optional backend OpenRouter key>
OPENROUTER_MODEL=openrouter/free
OPENROUTER_REASONING_EFFORT=low
OPENCODE_ENABLED=false
OPENCODE_MODEL=big-pickle
GEMINI_API_KEY=<optional configured backup key with available quota>
GEMINI_MODEL=gemini-3.8-flash
EXECUTION_ALLOWED_EMAILS=<comma-separated exact invited account emails>
```

Generate SECRET_KEY locally with `python -c "import secrets; print(secrets.token_hex(32))"`. Keep the same secret across deploys: authentication tokens and screenshot signatures depend on it. Railway startup rejects a missing/short/generated secret or a non-PostgreSQL DATABASE_URL. `DATABASE_PUBLIC_URL` also remains supported as a fallback, but the private reference above is preferred.

`PORT=8000` is explicitly fixed here so the frontend can reach the backend through its private domain on a known port. The startup script still honors any Railway-injected PORT. If you use another backend port, change the frontend BACKEND_URL port to match. Both services bind to `0.0.0.0`.

You may instead use `LLM_PROVIDER=gemini` with `GEMINI_API_KEY` and `GEMINI_MODEL`, or the provider configurations supported in `app/config.py`. Without a valid provider key, deployment and authentication can work, but AI analysis/generation cannot. Set optional admin credentials (`ADMIN_USERID`, `ADMIN_PASSWORD`) only if you use the admin dashboard. If any beta-key-protected routes are used, set the same `BETA_KEY` on backend and frontend; the frontend adds it on the server.

Redis is required even when rate limiting is disabled: login stores CSRF tokens there, and authenticated writes validate them. Railway readiness fails if Redis is unavailable. To enable the Redis-backed rate limiter as well, set `RATE_LIMIT_ENABLED=true` and your desired `RATE_LIMIT_PER_MINUTE`. Never put database, model, or auth credentials in NEXT_PUBLIC variables.

## Frontend variables

Name the backend service `backend`, then set these on **frontend**:

```dotenv
BACKEND_URL=http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:8000
NEXT_PUBLIC_SITE_URL=https://<your-frontend-domain>
```

BACKEND_URL is read on the server at runtime, so it can be changed without baking a private hostname into browser JavaScript. Browser requests stay on the frontend origin. Leave `NEXT_PUBLIC_API_URL` unset; it is supported only as a legacy fallback. Set `NEXT_PUBLIC_SITE_URL` before building for sitemap/SEO. After generating the public frontend domain, update it and rebuild the frontend. NEXT_PUBLIC_GOOGLE_VERIFICATION is an optional build argument.

You can set backend `ALLOWED_ORIGINS` and `FRONTEND_URL` to the frontend's public HTTPS URL if you also expose the backend publicly. The normal private-proxy layout does not require browser CORS configuration.

## Durable files and workers

Attach one Railway volume to backend at `/data` **before deploying**. The backend config requires this mount and enforces one replica with app sleeping disabled. DATA_DIR places uploads, screenshots, reports, public files, and runtime workspaces under that mount. Do not set the older individual directory variables to `/app/...`; either remove them or place them under `/data`. Existing files on your PC are not transferred automatically.

Use one backend replica with in-process WORKFLOW_WORKERS. An independent worker with another volume cannot see the API's local uploads, and Railway does not share one volume between services. Splitting workers or adding backend replicas requires a shared storage design first. Volume contents exist only at runtime, so database initialization and directory creation happen at startup rather than during the image build. PostgreSQL/schema initialization retries startup failures and refuses to serve a partially initialized database.

The active execution engine uses bounded local subprocesses when a Docker daemon is absent, including Python, Java, C/C++, React, Node, and HTML capture. The image includes the required runtimes and a Chromium version matching the installed Playwright package. The subprocess fallback's environment filtering, code validation, and resource limits are not a container security boundary. Hostile multi-tenant code execution needs a separate isolated execution service before opening unrestricted access.

On Railway, execution submissions are denied until `EXECUTION_ALLOWED_EMAILS` names the invited beta accounts. The same check runs again in queued workers. An uninvited signed-in account cannot execute through `/run`, `/tasks/submit`, workflow processing, or batch upload. The shared frontend `BETA_KEY` does not replace this account check. Local development stays available when this setting is empty and Railway is not detected. This admission gate does not provide per-run process or filesystem isolation; keep invitations restricted to trusted users.

Web assignments use complete text-file manifests, local import/asset validation, and declarative browser tests. React and Express start as separate processes with same-origin API proxying. The runner supplies a controlled local mock users endpoint for loading/error/retry scenarios. Static pages remain render-tested. Failed tests remain failed and can produce diagnostic Word reports containing the complete files and actual evidence. No generated test scripts are executed.

When the primary Groq model is unavailable, configured Gemini is tried without discarding completed results. If Gemini is unavailable, `GROQ_FALLBACK_MODEL` uses the existing Groq key and the same strict validation/execution checks. Set it empty to disable model fallback. Both backups require available model access and quota; they are not unlimited or automatically free. If all configured choices are unavailable, the workflow retains its checkpoint. Short quota delays use bounded retries.

If that configured route fails, free-only backups run in `FREE_LLM_FALLBACK_ORDER` order. OpenRouter is skipped until `OPENROUTER_API_KEY` is set; its default `openrouter/free` selects only free models, and every request also sets a zero price ceiling for prompt, completion and per-request fees. Explicit OpenRouter models must end in `:free`. These new routes never substitute paid model IDs. Each free provider is attempted once per generation call; outages, quota and access denials trigger a bounded cooldown and the next enabled provider. Invalid JSON is rejected and remains available to the existing repair workflow.

OpenCode's adapter uses the current documented inference endpoint and a reviewed list of free chat models. `OPENCODE_ENABLED=false` is intentional: the actual 17 October probe returned HTTP 403 `FreeTierError`, stating that free-tier access is limited to OpenCode itself. The adapter does not impersonate its CLI or bypass this restriction. Enable only when the provider grants external application access; optional `OPENCODE_API_KEY` stays on the backend. A 403 immediately skips that route. Free models and quotas may change, and a configured adapter is not proof of live availability. Set `FREE_LLM_FALLBACK_ORDER=` to disable these additions. `LLM_PROVIDER=openrouter` or `opencode` explicitly selects a new provider as primary; the other enabled free route remains its backup.

Official references for these integrations: [OpenRouter free router](https://openrouter.ai/docs/guides/routing/routers/free-router), [provider price ceilings](https://openrouter.ai/docs/guides/routing/provider-selection#max-price), [OpenCode inference](https://opencode.ai/v2/docs/console/api/inference/), [OpenCode free models](https://opencode.ai/v2/docs/console/models/#free-models).

## Verify

After deploying:

1. Backend deployment should pass `/health/ready` with database and Redis status `healthy`.
2. Frontend `/health/live` should return HTTP 200. Frontend `/health/ready` should report the backend database status; `/api/health` should return the API version.
3. Sign up and sign in through the frontend, upload a small DOCX, and process a programming question with your configured AI provider.
4. Open the returned signed screenshot URL on the frontend and download the composed report.
5. Redeploy backend and confirm the uploaded document, screenshot, and report are still available from the volume.

Local image checks (Docker engine required), from the repository root:

```sh
docker build -t labmate-backend ./backend
docker build -t labmate-frontend ./frontend
docker build -t labmate-backend-root .
docker compose -f docker-compose.railway.yml up --build
```

The Railway-like Compose file runs frontend, backend, Postgres, and Redis with private proxying and a persistent backend data volume. Copy `env.example` to `.env`, replace SECRET_KEY and provider credentials, and use `http://localhost:3000`. This is a local smoke-test harness; Railway does not automatically deploy this Compose file.

Official references: [monorepo roots and config paths](https://docs.railway.com/deployments/monorepo), [Dockerfiles](https://docs.railway.com/builds/dockerfiles), [private networking](https://docs.railway.com/networking/private-networking), [healthchecks](https://docs.railway.com/deployments/healthchecks), [volumes](https://docs.railway.com/volumes).

## Flask and Java UI runtime update

Both backend build contexts now install Flask 3.1.3, a desktop-capable JDK, Xvfb, xauth and fonts. Student execution still requires no Docker daemon. Flask runs on an ephemeral loopback WSGI server; AWT/Swing run under a fresh `xvfb-run` display on Linux. `JAVA_GUI_TEST_TIMEOUT` defaults to 30 seconds per scenario and `JAVA_GUI_TOTAL_TIMEOUT` to 90 seconds per assignment. Missing display support fails explicitly; the runner does not attach another desktop as a fallback.

Windows private-desktop execution and real Flask/AWT/Swing interaction, report and diagnostic flows were verified locally. This update has not been deployed or tested on Railway. Keep the existing controlled-beta invitation gate. JavaFX, Tkinter and database experiment adapters remain unavailable. See `FLASK_JAVA_UI_VERIFICATION_2026-10-18.md` for evidence and capture limitations.
# Optional Razorpay experiment packs

See [PAYMENTS.md](PAYMENTS.md) for the backend-only environment variables, additive PostgreSQL migration, webhook configuration and test-to-live procedure. Billing defaults to disabled. Keep the controlled-beta execution allowlist enabled when introducing packs; payment does not automatically invite an account. Test-mode purchases never grant live credits.
