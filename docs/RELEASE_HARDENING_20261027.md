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
| Isolation | New forced-command SSH broker wraps complete code/build/browser jobs in a dedicated VM's private Linux namespaces and aggregate cgroup. Host execution is disabled by default. Missing worker fails closed. SQL retains its existing database boundary. See ISOLATED_RUNTIME.md. |

Verification of the Ubuntu-free candidate covered **239 distinct backend tests** across runs.
The first full run passed 228 tests; eight Java checks initially failed because the test environment
omitted the configured compiler path. They passed on rerun with the configured compiler, alongside
three new hardening tests. The frontend production build and five Axios refresh scenarios passed.
Unit tests opt into trusted development mode for individual runtime adapters; those passes alone
do not establish namespace isolation.

The actual Linux OS probe blocked outside-canary/SSH-key reads, tool writes and external network;
allowed own-workspace writes and private loopback; confirmed unprivileged UID and a different
PID namespace. Before separating out the Ubuntu lab, **11/11 isolated runtime checks passed**: Python, C, C++, Java, Node,
HTML Add interaction (2+3=5), React, Colab light theme, C outside-file denial, Flask and Swing UI.
They returned seven real browser/GUI evidence images. Results are in
[`validation/isolated-smoke-results.json`](validation/isolated-smoke-results.json). The resource
filter added afterward was separately tested; full isolated execution needs retesting on the
configured production worker.

Integration testing also found missing HOME/passwd metadata for Vite in the minimal namespace;
the runner now supplies a job-local HOME and minimal account/localhost files. Java compilation
gets a bounded 60-second worker budget with a separate CPU ceiling. The local TCG VM's old
qemu64 CPU caused a reproduced NumPy illegal-instruction exit; TCG now adds the required SIMD
features to a compatible CPU model. Hardware acceleration initially produced practical execution
times (roughly 3–17 seconds for these small checks), but the local VM later suffered a kernel panic.
Local accelerated VM stability is therefore unverified. Java UI now waits up to 15 seconds for a
visible window. All affected runtime cases passed before the VM failure; production still needs a
dedicated Linux worker and its own end-to-end verification.

After those checks, packaging was tightened to exclude generated lab reports and screenshots.
The worker now refuses stale resource folders containing unintended files. Reinstall a clean
bundle before starting a worker that received an earlier bundle.

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
