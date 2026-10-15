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
