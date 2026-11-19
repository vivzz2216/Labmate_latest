"""Railway-only runtime transport. No local host-execution fallback."""
import asyncio
import base64
from contextlib import asynccontextmanager, contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from functools import lru_cache
import io
import json
import os
import logging
from pathlib import Path
import re
import tarfile
import time

from ..config import settings
from .isolated_runtime import read_bounded, import_receipt

logger = logging.getLogger(__name__)
RATE_LIMIT_MARK = 'RAILWAY_RATE_LIMITED'
# Wall-clock time until which Railway's API refuses requests. While it is set no sandbox is attempted,
# so students get a clear "resumes at" message instead of a run that waits and fails.
_rate_limited_until = 0.0
_session = ContextVar('railway_sandbox_session', default=None)

BACKEND = Path(__file__).resolve().parents[2]


@lru_cache(maxsize=1)
def runtime_bundle():
    """Only trusted application source/assets are shipped; never the data volume."""
    scripts = BACKEND / 'scripts'
    if not scripts.is_dir():
        scripts = BACKEND / 'runtime_scripts'
    resources = Path(os.environ['LAB_RESOURCES_DIR']) if os.environ.get('LAB_RESOURCES_DIR') else BACKEND.parent
    output = io.BytesIO()
    def clean(member):
        member.uid = member.gid = 0
        member.uname = member.gname = 'root'
        member.mode = 0o755 if member.isdir() else 0o644
        return member
    with tarfile.open(fileobj=output, mode='w:gz') as archive:
        for source, target in [(BACKEND/'app','backend/app'),(BACKEND/'templates','backend/templates'),
                               (resources/'google_colab','resources/google_colab'),(resources/'sql_workbench','resources/sql_workbench'),
                               (resources/'rstudio','resources/rstudio')]:
            if not source.is_dir():
                raise ValueError('Required Railway runtime resources are missing.')
            for path in sorted(source.rglob('*')):
                if not path.is_file() or path.is_symlink() or any(p.startswith('.') or p=='__pycache__' for p in path.relative_to(source).parts):
                    continue
                rel = path.relative_to(source)
                if target.startswith('resources/'):
                    valid = rel.as_posix() in {'index.html','app.js','style.css'} or (rel.parts[0]=='assets' and path.suffix.lower() in {'.svg','.png','.jpg','.jpeg','.webp','.json','.woff','.woff2','.ttf'})
                else:
                    valid = path.suffix.lower() in {'.py','.r','.java','.html','.css','.js','.svg','.png','.jpg','.gif','.woff','.woff2','.ttf','.json'}
                if valid:
                    archive.add(path, str(Path(target)/rel), filter=clean)
        for source, target in [(scripts/'sandbox_job.py','sandbox_job.py'),(scripts/'sandbox_broker.py','broker.py'),
                               (BACKEND/'railway_runtime/job.py','railway_job.py')]:
            archive.add(source,target,filter=clean)
    data = output.getvalue()
    if len(data)>24*1024**2:
        raise ValueError('Railway runtime bundle exceeds its limit.')
    return base64.b64encode(data).decode('ascii')


def _credentials():
    environment_id = settings.RAILWAY_SANDBOX_ENVIRONMENT_ID or os.environ.get('RAILWAY_ENVIRONMENT_ID')
    if not os.environ.get('RAILWAY_API_TOKEN') or not environment_id:
        raise ValueError('Railway sandbox credentials are not configured.')
    env={key:value for key,value in os.environ.items() if key.upper() in
         {'PATH','PATHEXT','SYSTEMROOT','WINDIR','TEMP','TMP','RAILWAY_API_TOKEN','RAILWAY_ENVIRONMENT_ID'}}
    env['RAILWAY_ENVIRONMENT_ID']=environment_id
    return env


def _encode(value):
    if isinstance(value,bytes):return {'__labmate_bytes__':base64.b64encode(value).decode()}
    raise TypeError('Unsupported runtime payload.')


def _scrub(text):
    return str(text).replace(os.environ.get('RAILWAY_API_TOKEN') or '<unset>', '<redacted>')


class SandboxSession:
    """One bridge process, and so as few VMs as possible, for all jobs of one manual.

    Every new VM costs Railway API requests (create, status polls while it boots, destroy) and the account
    has an hourly allowance, so reusing the VM across a manual's questions is what lets many students run
    labs in the same hour. Jobs still run in separate namespaces with fresh /work and /tmp inside the VM.
    """

    def __init__(self):
        self.loop = asyncio.get_running_loop()
        self.jobs = 0
        self._process = None
        self._stderr = None
        self._lock = asyncio.Lock()

    async def _start(self):
        env = _credentials()
        # A receipt can hold 32 MiB of output and arrives as one line.
        self._process = await asyncio.create_subprocess_exec(
            settings.NODE_COMMAND, str(BACKEND/'railway_runtime/bridge.mjs'), '--session', env=env,
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            limit=40*1024**2)
        # Drain stderr continuously so the bridge never blocks on a full pipe.
        self._stderr = asyncio.ensure_future(read_bounded(self._process.stderr, 8192))
        self._process.stdin.write(json.dumps({'bundle': runtime_bundle()}).encode() + b'\n')
        await self._process.stdin.drain()

    async def run(self, job):
        async with self._lock:
            if self._process is None or self._process.returncode is not None:
                await self._start()
            payload = json.dumps({'job': job}, default=_encode).encode() + b'\n'
            try:
                self._process.stdin.write(payload)
                await self._process.stdin.drain()
                line = await asyncio.wait_for(self._process.stdout.readline(), settings.RAILWAY_SANDBOX_TIMEOUT)
            except BaseException:
                # The stream position is unknown after a timeout or cancellation; the bridge destroys its VMs on SIGTERM.
                await self._stop()
                raise
            if not line:
                await self._stop()
                detail = ''
                if self._stderr is not None and self._stderr.done() and not self._stderr.cancelled() \
                        and self._stderr.exception() is None:
                    detail = self._stderr.result().decode('utf-8', 'replace')[-1600:]
                raise RuntimeError('Railway sandbox failed: ' + _scrub(detail or 'the sandbox bridge exited.'))
            reply = json.loads(line)
            if not reply.get('ok'):
                raise RuntimeError('Railway sandbox failed: Railway sandbox operation failed: ' + _scrub(reply.get('error', '')))
            self.jobs += 1
            return reply['receipt']

    async def _stop(self):
        process, self._process = self._process, None
        if process is None or process.returncode is not None:
            return
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), 15)
        except (TimeoutError, asyncio.TimeoutError):
            process.kill()
            await process.wait()

    async def close(self):
        process = self._process
        if process is None or process.returncode is not None:
            return
        try:
            # End of input makes the bridge destroy its VMs and exit.
            process.stdin.close()
            await asyncio.wait_for(process.wait(), 60)
        except (TimeoutError, asyncio.TimeoutError, OSError):
            pass
        finally:
            await self._stop()


@contextmanager
def use_session(session):
    """Run the block's sandbox jobs on an existing session (the IDE keeps one per student)."""
    token = _session.set(session)
    try:
        yield session
    finally:
        _session.reset(token)


@asynccontextmanager
async def sandbox_session():
    """Share sandbox VMs between the jobs run inside this block (one manual's questions)."""
    if settings.EXECUTION_BACKEND != 'railway_sandbox' or _session.get() is not None:
        yield None
        return
    session = SandboxSession()
    token = _session.set(session)
    try:
        yield session
    finally:
        _session.reset(token)
        await session.close()


async def exchange(job):
    env = _credentials()
    if len(json.dumps(job,default=_encode).encode())>12*1024**2:
        raise ValueError('Runtime job exceeds 12 MiB.')
    session = _session.get()
    # Health probes always use their own VM. A job started on another event loop (a worker thread) cannot
    # share this session's pipes, so it runs one-shot.
    if session is not None and job.get('operation') != 'health':
        try:
            same_loop = asyncio.get_running_loop() is session.loop
        except RuntimeError:
            same_loop = False
        if same_loop:
            return await session.run(job)
    payload=json.dumps({'bundle':runtime_bundle(),'job':job},default=_encode).encode()
    process=await asyncio.create_subprocess_exec(settings.NODE_COMMAND,str(BACKEND/'railway_runtime/bridge.mjs'),
        env=env,stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
    try:
        async def communicate():
            process.stdin.write(payload)
            await process.stdin.drain()
            process.stdin.close()
            out,error=await asyncio.gather(read_bounded(process.stdout,32*1024**2),read_bounded(process.stderr,8192))
            await process.wait()
            if process.returncode:
                detail=_scrub(error.decode('utf-8','replace'))[-1600:]
                raise RuntimeError('Railway sandbox failed: '+detail)
            return json.loads(out)
        return await asyncio.wait_for(communicate(),settings.RAILWAY_SANDBOX_TIMEOUT)
    finally:
        if process.returncode is None:
            process.terminate()
            try:await asyncio.wait_for(process.wait(),10)
            except TimeoutError:
                process.kill()
                await process.wait()


def rate_limited_until():
    """Epoch seconds until which Railway refuses sandbox requests, or 0."""
    return _rate_limited_until if _rate_limited_until > time.time() else 0.0


def note_rate_limit(detail, now=None):
    """Remember when Railway's hourly allowance resets, from the bridge's RAILWAY_RATE_LIMITED message."""
    global _rate_limited_until
    now = time.time() if now is None else now
    until = 0.0
    match = re.search(RATE_LIMIT_MARK + r' reset=(\S*) retry_after=(\d*)', detail or '')
    if match and match.group(1):
        try:
            until = datetime.fromisoformat(match.group(1).replace('Z', '+00:00')).timestamp()
        except ValueError:
            until = 0.0
    if not until and match and match.group(2):
        until = now + int(match.group(2))
    if until <= now:
        until = now + 300
    _rate_limited_until = max(_rate_limited_until, min(until, now + 3600))
    return _rate_limited_until


def rate_limit_message(until, now=None):
    now = time.time() if now is None else now
    minutes = max(1, round((until - now) / 60))
    at = datetime.fromtimestamp(until, timezone.utc).strftime('%H:%M UTC')
    plural = 's' if minutes != 1 else ''
    return (f'Code execution has reached its hourly limit with the sandbox provider. It resumes in about {minutes} '
            f'minute{plural} (at {at}). Completed results are saved; press Retry after that.')


def _rate_limited_result(until):
    from .runtime_engine import RuntimeResult
    return RuntimeResult(False, error=rate_limit_message(until), exit_code=75,
                         stages={'execution':'not_run', 'isolation':'rate_limited',
                                 'resumes_at': datetime.fromtimestamp(until, timezone.utc).isoformat()})


def _record_health(available):
    from .worker_health import worker_health
    worker_health.record_job(available)


async def execute(job):
    from .runtime_engine import RuntimeResult
    until = rate_limited_until()
    if until:
        return _rate_limited_result(until)
    try:
        result = import_receipt(await exchange(job),isolation='railway_microvm')
        _record_health(True)
        return result
    except asyncio.CancelledError:raise
    except Exception as error:
        detail = _scrub(error)
        logger.warning('Sandbox execution failed (%s): %s', type(error).__name__, detail[-1600:])
        if RATE_LIMIT_MARK in detail:
            return _rate_limited_result(note_rate_limit(detail))
        if 'waiting for template' in detail and 'last status: BUILDING' in detail:
            return RuntimeResult(False, error='Execution environment preparation is still in progress.', exit_code=75,
                                 stages={'execution':'not_run', 'preparation':'pending', 'isolation':'not_started'})
        _record_health(False)
        # No host fallback, provider error details or automatic code-repair loop.
        return RuntimeResult(False,error='Railway sandbox execution unavailable; completed results are saved.',exit_code=126,
                             stages={'execution':'not_run','isolation':'failed'})
