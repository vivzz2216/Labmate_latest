# Railway execution without a local or Google VM

This optional transport creates a fresh Railway sandbox for a job, runs the
existing runtime inside Bubblewrap namespaces, validates its receipt, and destroys
the sandbox. SQL continues to use restricted per-run MySQL schemas. The SSH/Google
worker transport remains the default and its provisioning files remain available.

## Configuration

The backend image installs the pinned `railway` SDK with Node 22. Add these
server-only variables to the Labmate_latest service:

```
EXECUTION_ISOLATION=required
EXECUTION_BACKEND=railway_sandbox
RAILWAY_API_TOKEN=<account-or-workspace-token-with-project-access>
WORKFLOW_WORKERS=6
HEAVY_EXECUTION_LOCAL_LIMIT=6
HEAVY_EXECUTION_GLOBAL_LIMIT=6
BROWSER_CAPTURE_LOCAL_LIMIT=2
BROWSER_CAPTURE_GLOBAL_LIMIT=2
```

Each program runs in its own VM, so the execution limit should match `WORKFLOW_WORKERS`. A limit of 1
(right only for the single SSH worker) makes every student's program wait for everyone else's: in the
2026-11-18 live test six 3-program manuals took 7.5–17.6 minutes at 1 and 1.8–3 minutes at 6.

### Railway API allowance

Creating a VM costs about 15 public-API requests (create, status polls while it boots, destroy), and the
token's account has an hourly allowance: 1,000 requests on Hobby, 10,000 on Pro (check the
`x-ratelimit-limit` response header). One VM per program capped the whole site at about 60 programs an
hour. So:

- `process_assignment` opens `sandbox_session()`: one bridge process (`bridge.mjs --session`) and one VM
  serve all of a manual's programs. Each job still runs in its own Bubblewrap namespaces with fresh
  `/work` and `/tmp`. A job needing a different image (Spark, notebook extras, DL caches) gets a second VM.
- A 429 whose `retry-after` fits in 90 s is waited out and retried; a longer one pauses the manual with
  "resumes in about N minutes (at HH:MM UTC)", and no further sandbox is attempted until then.
- `/health/ready` (polled by every open student page) never creates a sandbox; it reports the startup
  probe and the outcome of real jobs.

Railway supplies RAILWAY_ENVIRONMENT_ID. Never set LABMATE_SANDBOX_WORKER on the
API service and never put the API token in frontend variables or sandbox env.
Keep PostgreSQL/Redis configuration unchanged. A missing token fails closed.
Local candidate APIs can set RAILWAY_SANDBOX_ENVIRONMENT_ID to target Railway
without pretending that the local API itself is hosted there.

## Validation before release

1. Build the backend image and warm the dependency template using a fixed health
   request through `app.services.railway_sandbox.exchange`.
2. Confirm the nonce-bound probe runs as uid 65534 / pid 1 with a private writable
   directory and loopback network namespace. If namespaces are unsupported by
   the actual sandbox host, stop; there is no direct-host fallback.
3. Run the ten-question Python/Java/C/C++/HTML/MySQL/notebook local audit against
   the candidate release; check actual outputs and embedded report evidence.
4. Check cancellation, timeout and failed jobs leave no running sandboxes, verify
   completed results survive, and inspect credit settlement.
5. Only then switch the production transport and repeat live smoke tests.

Each VM requests one CPU and 2 GB RAM, with a five-minute idle expiry and explicit
teardown. These are billable Railway resources, not free compute. Dependencies
are built into a cached template; the first build can take several minutes. Jobs
have no external network, API credentials or access to other Railway services.
The first health probe can therefore be slow; successful probes cache for five
minutes and failed probes for the existing short health TTL.

Rollback: set EXECUTION_BACKEND=ssh and redeploy; execution then depends on the
configured SSH worker again. Neither transport executes submitted code on the API.

Reference: https://docs.railway.com/sandboxes/quickstart
