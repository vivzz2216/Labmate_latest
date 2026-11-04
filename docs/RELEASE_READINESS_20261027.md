# LabMate release readiness audit

Follow-up: this is the original pre-fix audit. See
[RELEASE_HARDENING_20261027.md](RELEASE_HARDENING_20261027.md) for subsequent fixes and checks.

27 October 2026

**Public launch readiness: FAIL.** The repository has Railway configuration, but the current execution boundary is unsuitable for unrestricted student code. The production dependency manifest also forces a vulnerable HTTP framework version. Successful local tests do not resolve these blockers.

This audit changes no application behavior and performs no deployment. Probes used isolated local data and a harmless canary file; no real secrets were read and no production stress traffic was sent.

## How accurate is Gemini's pasted report

The supplied text describes ten small code changes. It contains no demonstrated SQL injection. Most described changes are present, but the timezone fix is incomplete and several explanations overstate what the changes establish.

| Claim | Current verification |
| --- | --- |
| Nullable last_login | Present and probed: UserResponse accepts None and all four response serializers guard the call. Ordinary signup already assigns last_login, so a normal new signup was not shown to trigger the old error. |
| Timezone lockout handling | **Incomplete.** The later remaining-time calculation handles aware values, but check_account_lockout compares locked_until to datetime.utcnow first. An aware future value reproduces TypeError before the new calculation runs. |
| Profile CSRF validation | Dependency is present and independently verified. This is useful hardening. A missing CSRF dependency alone does not prove a cross-site exploit when authentication requires an explicit Bearer token. |
| Deleted batch workflow | The None guard is present. Static review confirms the guarded traversal; this audit did not recreate a production deletion race. |
| Plot cleanup on limit error | Confirmed with the real notebook worker: creating 13 small figures raises the limit error; a subsequent cell observes zero open figures. |
| Invalid Python stdin inference | Confirmed: malformed Python returns an empty inferred input instead of raising SyntaxError. |
| Invalid JSON browser assertions | Confirmed for assert_attribute, assert_order and assert_http: each returns the intended descriptive ValueError. JSONDecodeError was already a ValueError subclass, so this primarily improves validation/error reporting. |
| Word image geometry | Clamps are present. Negative margins alone are not the stated division-by-zero cause; invalid or exhausted printable dimensions are the relevant case. |
| Filename rendering | The old path uses a sanitized filename and Jinja autoescaping. A filename containing an HTML element was not emitted as raw executable markup in the tested template. |
| Refresh failure cleanup | Token removal is present. The existing _retry guard already limits one original request; the change prevents repeated refresh attempts by later requests. It is not proof that every interceptor concurrency/error path is correct. |

Eight focused mechanism probes passed. They are recorded in gemini-claim-probes.json. The remaining claims above are explicitly marked as static inspection or incomplete.

## Confirmed release blockers

### Critical execution boundary failure

The C/Java/C++/Node validator filters selected API spellings. Student processes are then launched on the backend filesystem. The backend image has no USER instruction, so its API and ordinary native child processes run as root by default. The notebook worker separately drops to uid 65534 on root Linux, which does not isolate the other language paths.

A generated C program passed validation, compiled, and read LABMATE_AUDIT_CANARY_ONLY from a file outside its temporary execution directory. This demonstrates a missing file boundary. The probe did not read credentials or another user's files. Linux container execution was not reproduced locally, but the image configuration and native launcher expose the same underlying design risk.

References: backend/app/security/generated_code.py:44, backend/app/services/runtime_engine.py:112, backend/Dockerfile.

Minimum release requirement: separate the API and its secrets/files from execution, then enforce a per-job filesystem, process, resource and network boundary. A filename regex, environment-variable filtering or merely changing the backend to a non-root user is insufficient. Preserve the existing invited-beta gate until this is implemented and tested.

### Vulnerable production framework pin and dependency drift

backend/requirements.txt pins FastAPI 0.109.2. Its published dependency constraint admits Starlette >=0.36.3,<0.37.0, and the published matching stable release is 0.36.3. That version is affected by the documented multipart memory-exhaustion issue. File-size checks inside the upload handler occur after framework form parsing and do not repair that parser vulnerability. See the [maintainer advisory](https://github.com/Kludex/starlette/security/advisories/GHSA-f96h-pmfr-66vw).

The installed local environment is substantially different: Python 3.14.8, FastAPI 0.142.2, Starlette 1.7.0, Pydantic 2.13.5, Playwright 1.64.0 and SQLAlchemy 2.1.3. The Dockerfile targets Python 3.11 and pins older application/browser dependencies. Passing tests against the local installation does not validate that deployment image.

Fresh scans reported:

- npm lockfile: zero reported vulnerabilities.
- Installed Python environment: ten scanner entries across six packages; six distinct advisory IDs after deduplication.
- Production direct pins: three scanner entries across two packages; two distinct IDs. This excludes the unpinned boto3 range and transitive dependencies.
- The separately selected Starlette 0.36.3: fourteen entries representing seven distinct advisory IDs. Some are platform/use-case specific; these are not seven proven Railway exploits. The multipart DoS issue is directly relevant to the upload design.

The python-jose advisory concerns asymmetric-key/HMAC confusion. Current JWT decoding explicitly restricts algorithms to HS256 and uses a shared secret, so this audit does not establish that particular token-forgery exploit in this application. The pytest advisory concerns local test-directory behavior; production includes pytest but no internet-facing pytest execution was identified. Advisory presence and reachable exploitation are distinct findings.

Minimum fix: update compatible framework/browser/runtime dependencies, separate development dependencies, resolve a reproducible production set and build/test it on the actual Linux/Python 3.11/Node 22 target. Cross-target pip dry runs from Windows were inconclusive because pip evaluated host-dependent transitive markers; they are not counted as failed Linux builds.

### Authentication can block the API event loop

The asynchronous login and signup routes call synchronous bcrypt functions. A local ASGI probe sent only three failed logins against an isolated account. All returned 401, but they took 1.436 seconds and delayed the event-loop heartbeat by 1374.6 ms. The process recovered and the subsequent health check returned 200; this demonstrates a stall, not a reproduced process crash.

RATE_LIMIT_ENABLED is false in the default/example settings and in the inspected local settings. Production values could not be read. Enable bounded edge/auth admission and move expensive hashing/verification out of the API event loop. Account lockout alone does not bound new-account signup traffic.

References: backend/app/routers/basic_auth.py:86, :93, :247, :304; backend/app/config.py:211.

### Login timezone error remains

check_account_lockout with an aware future datetime raises "can't compare offset-naive and offset-aware datetimes". Normal PostgreSQL timestamp mapping may return naive values, so this is not proof that every current production account is affected. It is a reproduced failure of the condition Gemini claimed to fix.

Minimum fix: normalize the stored timestamp and current time consistently before the first comparison, and use the same normalization for the remaining-time calculation. Add tests for future/past naive and aware timestamps.

## SQL injection verdict

No SQL injection was confirmed in the inspected account/application data queries. Authentication uses SQLAlchemy expressions with bound values. An injection-shaped, syntactically valid email remained a bound PostgreSQL parameter, never became SQL syntax, and matched zero users in the isolated database. An invalid email payload was rejected with HTTP 422.

The dynamic workflow migration column names are hardcoded, not request-controlled. The SQL lab deliberately executes exercise SQL against per-run MySQL schemas/accounts; that feature must not be confused with injection into LabMate's application database. Its existence does not excuse the separate native execution boundary failure above.

This is a bounded review, not a certification that every SQL path is safe. No destructive SQL probes were run against real accounts or unrelated databases.

## When the site could fail

| Trigger | Likely effect | Evidence and limit |
| --- | --- | --- |
| Repeated login/signup requests | Delayed API responses and timeouts | Synchronous bcrypt stall reproduced with three local failed logins. |
| Generated code crossing job boundaries | Unauthorized file access and possible service/data compromise | Harmless outside-folder read reproduced; production exploitation not attempted. |
| Large form fields on the pinned production parser | Memory exhaustion, unresponsive service or OOM termination | Maintainer-documented affected dependency; no memory-exhaustion attack was performed. |
| Concurrent compilers, notebooks and browsers exhausting configured RAM | Child or API termination and failed jobs | Architectural risk; no measured production RAM budget available. |
| Accumulating reports, screenshots and database receipts | Disk/database growth and eventually failed writes | No automated artifact-retention policy was identified in inspected application services. Single-upload DOCX also lacks the batch path's decompressed-size guard. No ZIP bomb was executed. |
| Redis/Postgres unavailable | Controlled failed requests/readiness 503 or startup refusal | Startup/security tests cover fail-closed behavior; this does not necessarily crash the process. |
| All AI provider routes limited/unavailable | Jobs pause or queues grow | Existing provider/queue behavior; current provider quotas were not queried. |
| Redeploying the volume-backed API | Brief planned downtime | Railway documents that volume-backed services cannot use replicas and incur some redeploy downtime. See [volume caveats](https://docs.railway.com/volumes/reference). |

There is no defensible exact student-count crash threshold from this audit. The passing 25-submission test uses deterministic stubs, temporary SQLite and Python allocation tracking. It does not measure real Chromium/compiler/notebook process RSS or live model latency. Default local browser/heavy limits are two, default global limits are disabled, and production overrides are unknown.

## Railway verification status

The local configuration includes a backend readiness check, a /data mount requirement, one replica, a frontend production image, PostgreSQL/Redis validation and a restricted execution allowlist. SQL labs additionally require their MySQL service/credentials. Ubuntu requires its separately provisioned runtime and was not tested in this audit.

The Railway plugin returned UNAUTHORIZED and requested reauthentication. Deployed revision, variables, service metrics, resource limits, mounts, MySQL connectivity, backups and current domain mapping remain unverified. The previously shared gallant-enjoyment-production.up.railway.app URL returned HTTP 404 for the homepage and health paths. This might be an obsolete domain; it does not prove that an unknown replacement deployment crashed.

## Checks completed and limits

- 75 focused security, authorization, billing, extraction, startup, queue, budget and event-loop/database tests passed, with zero failures in that run. This was not a full backend-suite run.
- Local frontend production build passed, including lint/type checks and prerendering; local Node was 24.21.0 rather than the Docker target Node 22.
- Installed Python pip check reported no broken requirements. That checks the installed environment, not agreement with the production manifest.
- Fresh npm and Python advisory scans, the safe native canary, aware-datetime probe, bounded auth-load probe and claim-specific checks are saved under backend/audit_artifacts/release-readiness-20261027/.
- No Linux image build, real production load test, live payment test or new end-to-end AI manual generation was claimed passed. Application code and production configuration were not changed by this audit.

## Release order

1. Establish the execution boundary and keep public code execution closed until its isolation tests pass.
2. Align and patch the deployment dependencies; validate a clean Linux image with PostgreSQL, Redis and MySQL.
3. Repair timezone handling and authentication event-loop blocking; enable appropriate request/auth limits and document resource limits.
4. Apply consistent upload expansion limits and artifact quotas/retention; configure backups and storage alarms.
5. Reconnect Railway, inspect the actual services/revision/domain, and run small real workload tests while measuring total process memory, CPU, disk, queue delay and API latency. Increase load gradually to set a measured admission limit.
# Follow-up

This document records the original audit. Subsequent fixes and verification are in
[RELEASE_HARDENING_20261027.md](RELEASE_HARDENING_20261027.md).
