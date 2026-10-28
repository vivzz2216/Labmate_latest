# Local execution and deferred cloud migration

Keep two workflow consumers, one heavy execution slot and one browser slot. A
dedicated Linux namespace worker remains mandatory; an unavailable worker never
falls back to executing student code on Windows or inside the API service.

## Local VM compatibility

The original VM's logs show systemd PID 1 dying with an x86 page-fault error `44`,
followed by `Attempted to kill init`. Its CPU advertised `user_shstk`. The controlled
local compatibility experiment changes only the guest kernel option `nousershstk`.
This disables userspace CET shadow stacks, a defense-in-depth feature, on the local
guest; it does not disable namespaces, cgroups, restricted SSH or blocked egress.
It must not be applied to the cloud worker. An extended passing run establishes
the tested workaround's observed stability, not a proof of the exact QEMU defect.

Preserve the original disk and logs. Create a qcow2 overlay with `qemu-img create
-f qcow2 -F qcow2 -b ORIGINAL.qcow2 DISPOSABLE.qcow2`; never boot or modify the
original during diagnosis. In the disposable QEMU guest only, run
`LABMATE_LOCAL_VM_REPAIR=1 bash local_kernel_compat.sh`, then reboot. Confirm
`nousershstk` in `/proc/cmdline`. Test the image before adopting it.

## Startup and status

Use the backend virtual environment to run `backend/scripts/local_worker.py`:

```powershell
python backend/scripts/local_worker.py configure --base-disk C:/absolute/path/to/stopped-tested.qcow2
python backend/scripts/local_worker.py start
python backend/scripts/local_worker.py status
python backend/scripts/local_worker.py stop
```

Configuration, writable overlay, per-boot logs and process identities live under
`~/.cache/labmate-worker`. Existing QEMU, operator identity, restricted sandbox
identity and pinned host keys are reused from the local installation. Configure
refuses to overwrite an existing setup or take a backing image from a running VM.
Stop verifies executable, command arguments and process creation time before
touching a PID. Unknown port owners are preserved.

Load the generated `worker.env` into the local backend environment. It contains
paths and connection settings, not private-key contents. The startup command
waits for a real sandbox probe, then starts a loopback-only Redis SSH tunnel.
No automatic restart loop masks a failed guest; inspect status/logs and retry
explicitly. `status` exits nonzero unless the owned VM, sandbox and Redis are ready.

`/health/ready` retains website database/Redis readiness and adds
`services.execution_worker` plus `execution_ready`. The worker probe uses pinned
SSH and a nonce-bound, fixed sandbox command; it is cached for 15 seconds and has
a 10-second deadline. The processing screen shows execution availability.
Worker outages pause workflows before generation or repair, preserve completed
checkpoints and settle credits once. Explicit processing retry resumes them.

## Acceptance

Run `verify_isolated_runtime.py` for all 11 samples and run
`verify_namespace_boundary.py` inside the VM as its operator. Verify a five-job
burst with the single heavy-execution cap. For sustained acceptance:

```powershell
python backend/scripts/soak_worker.py --env-file C:/Users/USER/.cache/labmate-worker/worker.env --duration 7200 --output C:/absolute/path/to/new-soak-evidence
```

This uses real Python/C execution and HTML/Colab browsers without generation API
calls. Preserve JSONL results and kernel logs, check resource usage and leaked
job scopes after completion, and test interruption/recovery without duplicate
credit settlement. A crash or incomplete soak is a failure, not a stability pass.

## Later: Google Cloud

`infra/gcp-worker` is inactive (`enabled=false`) and needs no cloud account now.
It describes a non-Spot x86 Ubuntu 24.04 e2-standard-2 worker in Singapore, 8 GB RAM
and 50 GB disk. Before enabling, review billing/trial eligibility, validate the
current estimate, supply explicit project/SSH ingress/public keys and an HTTPS
runtime bundle with its SHA256. The VM uses a dedicated service account with no
project roles, and only SSH is exposed. Runtime keys remain separate from operator
keys. Verify/pin the cloud host key out-of-band before switching the SANDBOX_* env
values. Never copy API/provider/database secrets onto the execution worker.

No trial, project, VM or paid resource is created by these changes. Review migration
near 100 paying users, or earlier when queue waits or local reliability require it.
One worker is still a single point of failure; 100 registrations is not a capacity
guarantee. SQL's production MySQL setup and the Ubuntu lab are separate work.
