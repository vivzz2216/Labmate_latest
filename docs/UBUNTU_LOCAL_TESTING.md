# Local Ubuntu lab execution

Ubuntu labs execute inside private Linux namespaces in a dedicated Ubuntu VM.
No Git Bash, Windows shell, or unisolated WSL fallback is allowed.

The original VM disk, diagnostic backing disk, and crash logs are preserved.
The current diagnostic overlay and writable lifecycle state are in the ignored
`backend/react_temp/unix_worker_20261116` folder. Do not commit or delete a running
VM's disk or state. The old default user-cache folder was readable but not writable
by this Python process; a separate state directory fixes logging without changing
Windows security settings or permissions.

Run from `backend`:

```powershell
.venv/Scripts/python.exe scripts/local_worker.py --state-dir react_temp/unix_worker_20261116 start
.venv/Scripts/python.exe scripts/local_worker.py --state-dir react_temp/unix_worker_20261116 status
```

`LABMATE_WORKER_STATE_DIR` can set the state directory instead of passing the option.
Status requires the authenticated execution probe and Redis, not just an open SSH port.
The SSH listener and Redis tunnel remain on localhost. The cloud configuration is inactive.

For this local audit, start the backend with two workflow consumers and one
execution/capture slot. These process settings override any larger development
values without changing other environments:

```powershell
$env:WORKFLOW_WORKERS='2'
$env:HEAVY_EXECUTION_LOCAL_LIMIT='1'
$env:BROWSER_CAPTURE_LOCAL_LIMIT='1'
$env:HEAVY_EXECUTION_GLOBAL_LIMIT='1'
$env:BROWSER_CAPTURE_GLOBAL_LIMIT='1'
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The trusted guest files `ubuntu_worker.py` and `ubuntu_network_fixtures.py` must match
the versions under `backend/scripts`. The network fixture belongs at
`/usr/local/lib/labmate/ubuntu_network_fixtures.py`; it starts **inside each private
network namespace**, serves only student.lab on loopback ports 5353/4343, and never
forwards queries or accesses public DNS/WHOIS. Generated code must identify these as
local teaching examples. They cannot prove an explicitly requested public-network task.

Run the real workflow audit with a private SQLite test database and GLM:

```powershell
.venv/Scripts/python.exe -u scripts/run_unix_manuals_e2e.py INPUT_FOLDER react_temp/unix_e2e_20261116
```

It preserves reports and native screenshots and uses no production accounts or credits.
Completed results are inspected and reused; failed cases can be retried individually
by passing their exact input filenames as additional arguments.

A script's last zero exit code cannot hide arithmetic or child-script errors.
Shell error and pipeline handling propagate into Bash helper scripts, runtime
diagnostics are rejected, and explicit command lists require traced execution.
These checks establish execution and command coverage, not arbitrary semantic correctness.
Inspect fixed sample results and every report screenshot as part of the audit.

Installation and physical partition/mount tasks require their own genuine evidence.
Reference examples are labelled and never turn a failed verification into a pass.
