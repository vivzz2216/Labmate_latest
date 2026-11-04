# Release hardening — 2026-10-27

These are local changes, not a claim that the current Railway deployment contains them.

| Area | Change / evidence |
| --- | --- |
| Lockout | Normalize both timezone-aware and naive UTC timestamps. Atomic SQL counters prevent lost concurrent failures; expired lockout starts a fresh attempt window. |
| Login | Move bcrypt to a thread with four-worker admission. DB lookups/counters run off the event loop and release connections before hashing or Redis waits. Four concurrent logins passed with a one-connection database pool. Failed Redis session storage returns retryable 503 instead of issuing an unusable CSRF session. Real owner HTTP login passed. |
| Session refresh | One refresh for parallel requests; bounded request timeouts; retry queues always settle; temporary outages preserve stored credentials; rejected retries cannot refresh forever. Five Axios adapter scenarios passed. |
| Dependencies | Explicit FastAPI 0.142.2 / Starlette 1.7.0 / Pydantic 2.13.5 / Playwright 1.64.0. Official PyPI metadata confirms Python 3.11 compatibility for all 40 selected exact pins. Linux Python 3.12 dependencies resolved into a separate worker bundle. |
| Redis | Railway `REDIS_URL` exists; live `/health/ready` returned healthy database and Redis. Local real Redis passes PING and user-bound CSRF expiry checks through a loopback-only SSH tunnel. Required Redis never silently falls back to fake Redis. |
| Admission | Atomic Redis counter + non-extending expiry; separate auth bucket. Authenticated frontend relay of Railway X-Real-IP prevents all students sharing the proxy's bucket. Requires the same server-only TRUSTED_PROXY_KEY on both services. |
| Uploads | Bound declared/chunked request bodies before complete multipart spooling; cap simultaneous upload parsers at four. Single and batch DOCX share a decompression/member guard and reject duplicate entries. |
| API runtime | Readiness Redis/DB probes run off the event loop. Container startup drops to UID 10001 after initializing fixed data directories. Uvicorn limits outstanding request concurrency and keepalive. Container build/drop-privilege execution has not been tested with Docker locally. |
| Isolation | New forced-command SSH broker wraps complete code/build/browser jobs in a dedicated VM's private Linux namespaces and aggregate cgroup. Host execution is disabled by default. Missing worker fails closed. SQL and Ubuntu retain their existing separate boundaries. See ISOLATED_RUNTIME.md. |

Verification: **186 backend tests passed** in one selected run, followed by 12 Java/Flask tests
and the expanded 24-test hardening suite (200 distinct selected tests in total); frontend production build passed
(all 16 static pages); five actual Axios refresh-interceptor scenarios passed. The test suite
explicitly opts into trusted development mode for individual runtime adapter tests; those unit
passes alone do not establish namespace isolation.

The actual Linux OS probe blocked outside-canary/SSH-key reads, tool writes and external network;
allowed own-workspace writes and private loopback; confirmed unprivileged UID and a different
PID namespace. **11/11 actual isolated runtime checks passed**: Python, C, C++, Java, Node,
HTML Add interaction (2+3=5), React, Colab light theme, C outside-file denial, Flask and Swing UI.
They returned seven real browser/GUI evidence images. Results are in
`backend/audit_artifacts/isolated-runtime/runtime-smoke.json`.

Integration testing also found missing HOME/passwd metadata for Vite in the minimal namespace;
the runner now supplies a job-local HOME and minimal account/localhost files. Java compilation
gets a bounded 60-second worker budget with a separate CPU ceiling. The local TCG VM's old
qemu64 CPU caused a reproduced NumPy illegal-instruction exit; TCG now adds the required SIMD
features to the working CPU model. Hardware acceleration with no legacy VGA device restored
practical execution times (roughly 3–17 seconds for these small checks). Java UI now waits for
a visible window for up to 15 seconds before capturing it. All affected cases passed retesting;
original failed attempts remain in the evidence logs. The tested local VM uses WHPX and a
restricted x86-64-v2 CPU model. See [QEMU's WHPX limitations](https://www.qemu.org/docs/master/system/whpx.html)
for the SIMD/MMIO issue avoided by omitting legacy VGA; native desktop capture uses Xvnc.

One obsolete test expected SQLite transactional DDL rollback. It was corrected to assert MySQL's
implicit DDL commit and use a valid, expensive MySQL SELECT for the cancellation test; the real
MySQL test now passes. The application SQL engine was not changed back to SQLite.

Final local production server checks via frontend proxy (small checks, not a load-capacity claim):
homepage 200 / 0.507s; readiness 200 / 0.243s; four concurrent owner logins all 200 in
0.497s total; profile 200 / 0.025s with `is_complete=true`. Large Word/blob downloads
retain their longer timeout; the five refresh scenarios and download deadline check passed.
The final namespace probe also denied descendant access to the trusted PID 1 receipt descriptor.
Local site: http://127.0.0.1:3000. Production checked: https://labmate-veruance.up.railway.app.

## Deployment boundary

Railway's existing four services are healthy, but these local changes have not been deployed.
Provision an always-on dedicated Linux worker reachable from Railway, install the runtime and
restricted SSH identity/known_hosts as documented, and set the matching frontend/backend proxy
secret before deploying. The Windows-local VM and its 127.0.0.1 address cannot serve Railway.
The production service inventory also has no MySQL service or MYSQL_* configuration; a dedicated
MySQL endpoint must be configured for the new SQL lab. PostgreSQL remains the application database.
Do not remove the isolation gate to make a deployment appear successful.

Artifact retention/quota policy and real multi-user worker sizing still need operational work.
The stubbed 25-submission queue test is not a measurement of 25 browsers/kernels consuming real RAM.
No unlimited-user capacity or crash-proof guarantee is claimed.
