"""Railway-only runtime transport. No local host-execution fallback."""
import asyncio
import base64
from functools import lru_cache
import io
import json
import os
import logging
from pathlib import Path
import tarfile

from ..config import settings
from .isolated_runtime import read_bounded, import_receipt

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


async def exchange(job):
    environment_id = settings.RAILWAY_SANDBOX_ENVIRONMENT_ID or os.environ.get('RAILWAY_ENVIRONMENT_ID')
    if not os.environ.get('RAILWAY_API_TOKEN') or not environment_id:
        raise ValueError('Railway sandbox credentials are not configured.')
    def encode(value):
        if isinstance(value,bytes):return {'__labmate_bytes__':base64.b64encode(value).decode()}
        raise TypeError('Unsupported runtime payload.')
    if len(json.dumps(job,default=encode).encode())>12*1024**2:
        raise ValueError('Runtime job exceeds 12 MiB.')
    payload=json.dumps({'bundle':runtime_bundle(),'job':job},default=encode).encode()
    env={key:value for key,value in os.environ.items() if key.upper() in
         {'PATH','PATHEXT','SYSTEMROOT','WINDIR','TEMP','TMP','RAILWAY_API_TOKEN','RAILWAY_ENVIRONMENT_ID'}}
    env['RAILWAY_ENVIRONMENT_ID']=environment_id
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
                detail=error.decode('utf-8','replace').replace(os.environ.get('RAILWAY_API_TOKEN','<unset>'),'<redacted>')[-1600:]
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


async def execute(job):
    from .runtime_engine import RuntimeResult
    try:return import_receipt(await exchange(job),isolation='railway_microvm')
    except asyncio.CancelledError:raise
    except Exception as error:
        detail = str(error).replace(os.environ.get('RAILWAY_API_TOKEN') or '<unset>', '<redacted>')
        logging.getLogger(__name__).warning('Sandbox execution failed (%s): %s', type(error).__name__, detail[-1600:])
        # No host fallback, provider error details or automatic code-repair loop.
        return RuntimeResult(False,error='Railway sandbox execution unavailable; completed results are saved.',exit_code=126,
                             stages={'execution':'not_run','isolation':'failed'})
