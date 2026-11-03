# Railway execution without a local or Google VM

This optional transport creates a fresh Railway sandbox for a job, runs the
existing runtime inside Bubblewrap namespaces, validates its receipt, and destroys
the sandbox. SQL continues to use restricted per-run MySQL schemas. The SSH/Google
worker transport remains the default and its provisioning files remain available.

## Status

Eight Node lifecycle tests passed, including read-only network retry limits.
The authenticated namespace probe and seven direct execution cases passed on
real Railway sandboxes: Python functions/OOP, Java, C, C++, HTML interaction and
NumPy notebook capture. The candidate upload/report suite passed ten questions
across seven manuals, including preserving completed Java evidence on resume.
Candidate SQL used local MySQL 8.0.46; production MySQL and public deployment
verification are tracked separately. The focused backend suite passed 88 tests.

## Configuration

The backend image installs the pinned `railway` SDK with Node 22. Add these
server-only variables to the Labmate_latest service:

```
EXECUTION_ISOLATION=required
EXECUTION_BACKEND=railway_sandbox
RAILWAY_API_TOKEN=<account-or-workspace-token-with-project-access>
HEAVY_EXECUTION_LOCAL_LIMIT=1
HEAVY_EXECUTION_GLOBAL_LIMIT=1
BROWSER_CAPTURE_LOCAL_LIMIT=1
BROWSER_CAPTURE_GLOBAL_LIMIT=1
```

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
