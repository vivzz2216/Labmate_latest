"""Pinned-SSH execution probe, cached independently from website readiness."""
import asyncio
from datetime import datetime, timezone
import json
import secrets
import time

from ..config import settings
from .isolated_runtime import read_bounded, worker_command, isolation_required


class WorkerUnavailableError(RuntimeError):
    def __init__(self):
        super().__init__('Execution worker unavailable. Completed results are saved; retry processing after the worker recovers.')


class WorkerHealth:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._expires = 0.0
        self._identity = None
        self._result = {'status': 'checking', 'available': False, 'checked_at': None}

    def invalidate(self):
        self._expires = 0.0

    async def check(self, force=False):
        if not isolation_required():
            return {'status': 'not_required', 'available': True, 'checked_at': None}
        identity = (settings.SANDBOX_SSH_HOST, settings.SANDBOX_SSH_PORT,
                    settings.SANDBOX_SSH_USER, settings.SANDBOX_SSH_KEY, settings.SANDBOX_KNOWN_HOSTS)
        async with self._lock:
            if not force and self._identity == identity and time.monotonic() < self._expires:
                return dict(self._result)
            process = None
            available = False
            nonce = secrets.token_hex(16)
            try:
                async def probe():
                    nonlocal process
                    process = await asyncio.create_subprocess_exec(*worker_command(),
                        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                    process.stdin.write(json.dumps({'operation': 'health', 'nonce': nonce}).encode())
                    await process.stdin.drain()
                    process.stdin.close()
                    out, _ = await asyncio.gather(read_bounded(process.stdout, 8192), read_bounded(process.stderr, 8192))
                    await process.wait()
                    receipt = json.loads(out)
                    if not isinstance(receipt, dict):
                        return False
                    return (process.returncode == 0 and receipt.get('protocol') == 1
                            and receipt.get('nonce') == nonce and receipt.get('status') == 'healthy'
                            and receipt.get('isolation') == 'linux_namespaces')
                available = await asyncio.wait_for(probe(), max(1, settings.WORKER_HEALTH_TIMEOUT))
            except (OSError, ValueError, RuntimeError, TimeoutError):
                pass
            finally:
                if process and process.returncode is None:
                    process.kill()
                    await process.wait()
            self._identity = identity
            self._expires = time.monotonic() + max(1, settings.WORKER_HEALTH_TTL)
            self._result = {'status': 'healthy' if available else 'unavailable', 'available': bool(available),
                            'checked_at': datetime.now(timezone.utc).isoformat()}
            return dict(self._result)


worker_health = WorkerHealth()
