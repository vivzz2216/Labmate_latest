"""Trusted entrypoint in a fresh Railway VM. Submitted code runs in namespaces."""
import json
import re
import resource
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, '/opt/labmate-runtime')
from broker import command


def run(request):
    job = json.loads(request)
    if not isinstance(job, dict):
        raise ValueError('Expected a job object.')
    cmd = command(Path('/unused'), 'railway', managed_vm=True)
    if job.get('operation') == 'health':
        if set(job) != {'operation', 'nonce'} or not isinstance(job['nonce'], str) or not re.fullmatch('[a-f0-9]{32}', job['nonce']):
            raise ValueError('Invalid health probe.')
        source = "import os,socket; assert os.getuid()==65534 and os.getpid()==1; assert not os.getenv('RAILWAY_API_TOKEN'); assert not os.path.exists('/root/.ssh'); open('/work/probe','w').write('ok'); s=socket.socket(); s.bind(('127.0.0.1',0)); s.close(); print('PROBE_OK')"
        cmd[-2:] = ['/usr/bin/python3', '-c', source]
        result = subprocess.run(cmd, capture_output=True, timeout=15)
        if result.returncode or result.stdout.strip() != b'PROBE_OK':
            raise RuntimeError('Railway namespace execution probe failed.')
        return {'protocol':1, 'nonce':job['nonce'], 'status':'healthy', 'isolation':'railway_microvm'}
    allowed = {'code','language','filename','stdin','project_files','routes','browser_tests','interaction_is_required','objective','api_tests','project_config','file_mode'}
    if set(job) - allowed:
        raise ValueError('Unexpected job fields.')
    with tempfile.TemporaryFile() as output, tempfile.TemporaryFile() as error:
        result = subprocess.run(cmd, input=request, stdout=output, stderr=error, timeout=220)
        output.seek(0)
        data = output.read(32 * 1024**2 + 1)
        if result.returncode or len(data) > 32 * 1024**2:
            raise RuntimeError('Railway namespace job failed.')
        return json.loads(data)


if __name__ == '__main__':
    resource.setrlimit(resource.RLIMIT_FSIZE, (32 * 1024**2, 32 * 1024**2))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_NPROC, (160, 160))
    request = sys.stdin.buffer.read(12 * 1024**2 + 1)
    if len(request) > 12 * 1024**2:
        raise ValueError('Job exceeds input budget.')
    print(json.dumps(run(request)))
