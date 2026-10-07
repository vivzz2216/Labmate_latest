# LabMate

LabMate is a web app for programming labs. It accepts PDF and DOCX assignments, organizes questions, helps produce and run code, captures output, and prepares downloadable reports.

## Project layout

| Path | Purpose |
| --- | --- |
| `frontend/` | Next.js application, including the homepage and student workspace |
| `backend/` | FastAPI API, parsers, execution services, screenshots, and reports |
| `docs/` | Setup, workflow, deployment, and security notes |
| `docs/archive/` | Historical reviews and one-off setup summaries |
| `docker-compose.yml` | PostgreSQL, backend, and frontend services |
| `env.example` | Environment variable template |

## Run with Docker

1. Copy `env.example` to `.env` and set the required secrets and service keys. Never commit the completed `.env` file.
2. Start Docker Desktop.
3. Run `docker compose up --build` from this directory.
4. Open `http://localhost:3000`. The API is at `http://localhost:8000`, with API documentation at `http://localhost:8000/docs`.

The existing `start_labmate.ps1` is a Windows helper for the Docker setup. If you are running without Docker or PostgreSQL, use the local setup notes in `docs/`; some execution features require installed compilers or a container runtime.

## Development

From `frontend/`, run `npm install` and `npm run dev`. Run `npm run build` before shipping changes. The frontend targets Node 18 as specified in `frontend/package.json`.

From `backend/`, install `requirements.txt`, configure environment variables, and run `uvicorn app.main:app --reload --port 8000`. PostgreSQL is the configured database in Docker; it is not a student-facing programming language. The executor contains handlers for Python, Java, C/C++, and web-related work, but availability depends on the local runtime and configured services.

## Notes

- The homepage product panel is an illustrative example, not a live assignment or measured product claim.
- Code execution and generated content should be reviewed before submitting coursework.
- Older status reports and troubleshooting notes were preserved under `docs/archive/` for reference.
