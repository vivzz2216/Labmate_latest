# Isolated execution (no Docker daemon)

The API sends the complete code/build/browser job over pinned SSH to a **dedicated Linux VM**.
The root-owned broker creates a new mount, user, PID, IPC and network namespace for each job.
Only immutable runtimes/resources are visible. The API filesystem, secrets, other jobs and
external network are absent. Private loopback permits genuine browser/server tests.
The trusted, non-dumpable orchestrator owns PID 1; student descendants cannot open its
receipt descriptor through /proc. The real boundary probe verifies this restriction too.

Per-job bounds: 220-second broker deadline, 1.5 GiB aggregate cgroup RAM, zero swap,
160 tasks, one CPU, 512 MiB workspace tmpfs, 128 MiB temporary tmpfs, 32 MiB receipt,
40 validated PNG frames. Existing per-process restrictions remain in force.
The API imposes a 240-second SSH deadline. Broker cleanup kills the complete job cgroup.
No installation or package download occurs inside submitted jobs; Node dependencies are preinstalled.

## Provision the worker

Use a dedicated Ubuntu 24.04 VM with systemd, not the API container or a shared personal machine.
From the repository run `backend/.venv/Scripts/python.exe backend/scripts/package_sandbox.py`.
Transfer the resulting secret-free `runtime.tar.gz` and `backend/scripts/provision_sandbox.sh`
to the VM. Extract the bundle into `/opt/labmate-runtime`, then run the provisioning script as root.
It installs the pinned Python requirements, Chromium, JDK, compilers and offline Node dependencies.
Rebuild the bundle whenever runtime code changes. Never copy `.env`, uploads, reports or SSH keys into it.
The broker refuses stale resource folders containing unexpected files; install the bundle into a
clean root-owned runtime directory so older screenshots or reports cannot become worker-readable.

Use a separate SSH key. Put its public key in the dedicated `labmate` account's authorized_keys:

```
restrict,command="sudo -n /usr/bin/python3 /opt/labmate-runtime/broker.py" ssh-ed25519 PUBLIC_KEY
```

Allow **only** that exact root-owned command in sudoers. Keep `/opt/labmate-runtime` root-owned
and unwritable to the SSH account. Pin the verified VM host key in a known_hosts file.
Store the client key and known_hosts outside all uploaded/generated directories, readable only by
the API service user. Do not disable host-key checking or give the runtime API/model/database credentials.

Backend environment:

```
EXECUTION_ISOLATION=required
SANDBOX_SSH_HOST=dedicated-worker-address
SANDBOX_SSH_PORT=22
SANDBOX_SSH_USER=labmate
SANDBOX_SSH_KEY=/secure/sandbox_identity
SANDBOX_KNOWN_HOSTS=/secure/sandbox_known_hosts
REDIS_URL=${{Redis.REDIS_URL}}
REDIS_REQUIRED=true
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=180
AUTH_RATE_LIMIT_PER_MINUTE=20
HEAVY_EXECUTION_LOCAL_LIMIT=1
HEAVY_EXECUTION_GLOBAL_LIMIT=1
BROWSER_CAPTURE_LOCAL_LIMIT=1
BROWSER_CAPTURE_GLOBAL_LIMIT=1
```

Set the same server-only random `TRUSTED_PROXY_KEY` on frontend and backend. The frontend
authenticates its relay of Railway's X-Real-IP so students have separate admission buckets.
Do not expose that key through a NEXT_PUBLIC variable. Direct callers cannot select their own bucket.

`EXECUTION_ISOLATION=development` is an explicit opt-out for trusted local tests. Railway refuses it.
Missing worker configuration causes code runs to fail closed with an isolation error; it does not
silently run student code inside the API process/container. SQL retains its disposable MySQL schema
and restricted account boundary.

## Verification and deployment boundary

Run `backend/scripts/verify_namespace_boundary.py` on the VM, then run the actual runtime smoke
tests through the API's isolated adapter. Verify source/evidence, timeout cleanup and all required languages.
Unit tests deliberately use development mode when testing individual adapters; those passes do not
prove the VM boundary. Production requires an always-on reachable worker; a Windows localhost VM
address cannot be used from Railway. An unavailable worker must never be bypassed to make a deployment pass.

Redis was live-verified on Railway on 2026-10-27 through `/health/ready`, which returned healthy
database and Redis. Local Redis is reached via a loopback-only SSH tunnel to the local VM; that
tunnel/VM must be running. Re-check real readiness after deployment. Retention quotas, monitoring
and real concurrent-load sizing remain operational requirements; no unlimited-user capacity is claimed.
