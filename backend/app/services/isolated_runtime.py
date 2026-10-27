"""Send complete runtime jobs to a dedicated Linux namespace worker. No host fallback."""
import asyncio
import base64
import io
import json
import re
import uuid
from pathlib import Path

from PIL import Image
from ..config import settings


def isolation_required():
    return settings.EXECUTION_ISOLATION != 'development' and not worker_context()


def worker_context():
    import os
    return os.environ.get('LABMATE_SANDBOX_WORKER') == '1'


def require_worker():
    if isolation_required():
        raise RuntimeError('Host code execution is disabled. Configure the isolated runtime worker.')


def worker_command():
    host, user = settings.SANDBOX_SSH_HOST, settings.SANDBOX_SSH_USER
    if not host or not re.fullmatch(r'[A-Za-z0-9_.:-]+', host) or host.startswith('-'):
        raise ValueError('An isolated Linux runtime worker is required; SANDBOX_SSH_HOST is not configured.')
    if not re.fullmatch(r'[a-z_][a-z0-9_-]{0,31}', user):
        raise ValueError('Invalid sandbox SSH user.')
    for file in (settings.SANDBOX_SSH_KEY, settings.SANDBOX_KNOWN_HOSTS):
        if not file or not Path(file).is_file():
            raise ValueError('Sandbox identity and pinned SSH host key are required.')
    # The SSH key should have a forced command for this broker on a dedicated worker VM.
    return ['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes',
            '-o', 'UserKnownHostsFile=' + settings.SANDBOX_KNOWN_HOSTS, '-o', 'ConnectTimeout=8',
            '-o', 'ServerAliveInterval=10', '-o', 'ServerAliveCountMax=2', '-i', settings.SANDBOX_SSH_KEY,
            '-p', str(settings.SANDBOX_SSH_PORT), user + '@' + host,
            'sudo -n /usr/bin/python3 /opt/labmate-runtime/broker.py']


async def read_bounded(stream, limit):
    data = bytearray()
    while chunk := await stream.read(65536):
        data.extend(chunk)
        if len(data) > limit:
            raise ValueError('Isolated worker exceeded its response budget.')
    return bytes(data)


def import_receipt(receipt):
    from .runtime_engine import RuntimeResult
    if not isinstance(receipt, dict) or not isinstance(receipt.get('success'), bool):
        raise ValueError('Invalid isolated runtime receipt.')
    frames = receipt.pop('frames', [])
    if not isinstance(frames, list) or len(frames) > 40:
        raise ValueError('Invalid isolated evidence count.')
    root = Path(settings.SCREENSHOT_DIR).resolve()
    root.mkdir(parents=True, exist_ok=True)
    paths = {}
    created = []
    try:
        for frame in frames:
            data = base64.b64decode(frame['data'], validate=True)
            if len(data) > 4 * 1024**2 or not data.startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError('Invalid isolated screenshot.')
            with Image.open(io.BytesIO(data)) as im:
                if im.width < 160 or im.height < 80 or im.width * im.height > 24_000_000:
                    raise ValueError('Isolated screenshot has invalid dimensions.')
                im.verify()
            dest = root / ('isolated_' + uuid.uuid4().hex + '.png')
            dest.write_bytes(data)
            created.append(dest)
            paths[frame['path']] = str(dest)
        def remap(value):
            if isinstance(value, str): return paths.get(value, value)
            if isinstance(value, list): return [remap(v) for v in value]
            if isinstance(value, dict): return {k: remap(v) for k, v in value.items()}
            return value
        result = {k: remap(v) for k, v in receipt.items() if k in RuntimeResult.__dataclass_fields__}
        if any(p not in paths.values() for p in result.get('screenshots', {}).values()):
            raise ValueError('Worker returned an unvalidated screenshot reference.')
        result.setdefault('stages', {})['isolation'] = 'linux_namespaces'
        return RuntimeResult(**result)
    except Exception:
        for path in created: path.unlink(missing_ok=True)
        raise


async def execute_isolated(**job):
    from .runtime_engine import RuntimeResult
    process = None
    try:
        # Dataset bytes use a narrow tagged encoding; arbitrary objects are rejected.
        def encode(value):
            if isinstance(value, bytes): return {'__labmate_bytes__': base64.b64encode(value).decode()}
            raise TypeError('Invalid runtime payload.')
        request = json.dumps(job, default=encode).encode()
        if len(request) > 12 * 1024**2:
            raise ValueError('Isolated runtime job exceeds 12 MiB.')
        process = await asyncio.create_subprocess_exec(*worker_command(), stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        async def exchange():
            process.stdin.write(request)
            await process.stdin.drain()
            process.stdin.close()
            output, error = await asyncio.gather(read_bounded(process.stdout, 32 * 1024**2), read_bounded(process.stderr, 32768))
            await process.wait()
            if process.returncode:
                raise RuntimeError('Isolated worker failed: ' + error.decode('utf-8', 'replace')[-500:])
            return import_receipt(json.loads(output))
        return await asyncio.wait_for(exchange(), 240)
    except (Exception, asyncio.CancelledError) as error:
        if isinstance(error, asyncio.CancelledError): raise
        detail = 'Worker exceeded its 240-second response deadline.' if isinstance(error, TimeoutError) else str(error)
        return RuntimeResult(False, error=f'Isolated execution unavailable: {detail}', exit_code=126,
                             stages={'execution': 'failed' if process else 'not_run', 'isolation': 'failed'})
    finally:
        if process and process.returncode is None:
            process.kill()
            await process.wait()
