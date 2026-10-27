"""Runs only inside broker-created namespaces. The API never launches this directly."""
import asyncio
import base64
import ctypes
import dataclasses
import json
import os
from pathlib import Path
import sys
from contextlib import redirect_stdout


def read_frame(path):
    path = Path(path)
    if not path.is_relative_to('/work/screenshots'):
        raise ValueError('Evidence must be inside the job screenshot directory.')
    # Reject symlink components and final symlinks before reading student-writable files.
    for part in [path, *path.parents]:
        if part.is_symlink(): raise ValueError('Symlink evidence is not allowed.')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as file:
        data = file.read(4 * 1024**2 + 1)
    if len(data) > 4 * 1024**2: raise ValueError('Evidence exceeds the per-image budget.')
    return {'path': str(path), 'data': base64.b64encode(data).decode()}


async def run():
    from app.services.runtime_engine import runtime_engine
    def decode(value):
        if set(value) == {'__labmate_bytes__'}:
            return base64.b64decode(value['__labmate_bytes__'], validate=True)
        return value
    job = json.load(sys.stdin, object_hook=decode)
    file_mode = job.pop('file_mode', False)
    if file_mode:
        from app.services.executor_service import executor_service
        objective, code = job.get('objective', ''), job.get('code', '')
        job['prepare_files'] = lambda d: executor_service.prepare_sandbox_files(objective, code, str(d))
        job['collect_files'] = lambda d, ctx, name: executor_service.collect_output_files(str(d), ctx, skip_files=[name])
    result = await runtime_engine.execute(**job)
    receipt = dataclasses.asdict(result)
    paths = set(result.screenshots.values())
    for frame in (result.verification or {}).get('evidence_frames', []):
        if frame.get('path'): paths.add(frame['path'])
    if len(paths) > 40: raise ValueError('Too many evidence frames.')
    receipt['frames'] = [read_frame(p) for p in sorted(paths)]
    return receipt


if __name__ == '__main__':
    # Prevent descendants from inspecting or writing the trusted orchestrator via /proc.
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(4, 0, 0, 0, 0): raise RuntimeError('Cannot protect runtime orchestrator.')
    with redirect_stdout(sys.stderr):
        try: receipt = asyncio.run(run())
        except Exception as error: receipt = {'success': False, 'error': str(error), 'exit_code': 1}
    sys.stdout.write(json.dumps(receipt))
