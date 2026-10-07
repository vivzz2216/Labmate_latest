# Deploying LabMate Backend to Railway

This guide covers deploying the backend-only service of LabMate to Railway (recommended). The repo contains a monorepo Dockerfile that builds both frontend and backend; that can fail on Railway. We configure Railway to build the `backend/Dockerfile` instead.

## Summary
- We will deploy only the backend (FastAPI) image using `backend/Dockerfile`.
- Railway sets the container `PORT` environment variable automatically — the backend image respects `PORT`.

## Quick checklist
- Push your code to GitHub (branch `main` or whichever branch you choose).
- On Railway create a project -> Deploy from GitHub -> select the `Labmate` repo.
- In Railway project settings, set the Dockerfile path to: `backend/Dockerfile` (or ensure `railway.json` points to it).
- Add the environment variables listed below.
- Add a PostgreSQL plugin (or external Postgres) and set `DATABASE_URL` accordingly.
- Add a Redis plugin or provide an external `REDIS_URL`.

## Required environment variables (Railway: Environment > Variables)
- `DATABASE_URL` — e.g. `postgresql://user:pass@host:5432/dbname` (from Railway Postgres plugin)
- `REDIS_URL` — e.g. `redis://:password@hostname:port/0` (or leave unset to disable Redis features)
- `OPENAI_API_KEY` — OpenAI credentials if you use AI features
- `BETA_KEY` — API beta key for LabMate
- `UPLOAD_DIR` — `/app/uploads` (default)
- `SCREENSHOT_DIR` — `/app/screenshots` (default)
- `REPORT_DIR` — `/app/reports` (default)
- `REACT_TEMP_DIR` — `/app/react_temp` (default)
- `RATE_LIMIT_ENABLED` — `true` or `false`
- `RATE_LIMIT_PER_MINUTE` — e.g. `60`
- Optional Firebase vars: `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` (if using Firebase features)

Railway automatically exposes the `PORT` env var; the backend image now uses `${PORT:-8000}` so no manual `PORT` setting is required.

## Important implementation notes and known issues
- Top-level `Dockerfile` (root) currently attempts to build the frontend and expects files like `frontend/package*.json.bak` and an exported `out` directory. This is brittle and will often fail during builds. For Railway, point the build to `backend/Dockerfile` (as recommended) rather than using the root Dockerfile.
- The backend image installs Playwright and the browsers. This increases image size and build time; builds may take several minutes.
- The application uses Docker-in-Docker in development (it expects to mount `/var/run/docker.sock` and may attempt to run containerized code). Railway does not allow mounting the host Docker socket; any features that depend on running Docker inside the container will fail. Consider replacing Docker-based execution with a remote execution service or a sandboxed runner.
- Playwright may require additional flags or tweaks in container environments (for example `--no-sandbox` for Chromium). If Playwright fails in production, consider using a browser service or a lighter approach for screenshots.

## Healthcheck
- Railway will hit `/health`. Ensure the app starts and binds to the provided `PORT`.

## Local testing (PowerShell)
Build the backend image and run locally (simulates Railway's `PORT` env):

```powershell
docker build -f backend/Dockerfile -t labmate-backend .
docker run --rm -e PORT=8000 -p 8000:8000 labmate-backend
```

Open http://localhost:8000/health to verify.

## Troubleshooting
- Build fails with missing `package.json.bak` or missing `out` folder: set Railway to build `backend/Dockerfile` (not the root Dockerfile) or fix the frontend build process.
- Database connection errors: confirm `DATABASE_URL` is set and the Postgres plugin is healthy.
- Redis errors: set `REDIS_URL` or disable Redis-dependent features.
- Long build times or OOM: Playwright and browser installs increase image size; consider removing Playwright or using a smaller base image and multi-stage caching.

## Frontend deployment
- The frontend is a Next.js app and is better hosted on Vercel or Railway separately (Vercel is recommended for Next.js). If you want to deploy frontend on Railway, create a separate service using `frontend/Dockerfile` or a Node build configuration.

## Next steps I can take for you
- Add a `DEPLOY` CI workflow that pushes images automatically.
- Fix the top-level `Dockerfile` to build both frontend and backend reliably (if you prefer a single-image deployment).
- Prepare a step-by-step "push + deploy" checklist and optionally push a commit/PR for you.

---

If you want, I can now:
- prepare a Git commit and push these changes, and/or
- fix the root `Dockerfile` so the monorepo builds successfully in Railway.

Please tell me which follow-up you'd like.
