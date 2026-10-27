"""Root-owned forced-command SSH broker on a dedicated Linux VM, never on the API host.

Each job gets private mount/PID/network/IPC/user namespaces and an aggregate cgroup.
Only immutable tools/code and that job's writable directory are mounted. No secrets.
"""
import json
import os
from pathlib import Path
import resource
import subprocess
import sys
import tempfile
import uuid

ROOT = Path('/opt/labmate-runtime')


def validate_resources():
    """Reject stale report/screenshot files before exposing resources to a job."""
    allowed = {'assets', 'index.html', 'app.js', 'style.css'}
    extensions = {'.svg', '.png', '.jpg', '.jpeg', '.webp', '.json', '.woff', '.woff2', '.ttf'}
    for name in ('google_colab', 'sql_workbench'):
        folder = ROOT / 'resources' / name
        if folder.is_symlink() or not folder.is_dir():
            raise ValueError('Worker lab resources are missing or unsafe.')
        for item in folder.iterdir():
            if item.name not in allowed or item.is_symlink():
                raise ValueError('Worker lab resources contain unintended files; install a clean bundle.')
        assets = folder / 'assets'
        if not assets.is_dir() or assets.is_symlink():
            raise ValueError('Worker lab assets are missing or unsafe.')
        for item in assets.rglob('*'):
            if item.is_symlink() or item.name.startswith('.env') or (item.is_file() and item.suffix.lower() not in extensions):
                raise ValueError('Worker lab assets contain an unsafe file; install a clean bundle.')


def command(work, unit):
    validate_resources()
    system = ROOT / 'system'
    system.mkdir(exist_ok=True)
    for name, text in {'passwd':'labmate:x:65534:65534:LabMate Runtime:/work:/usr/sbin/nologin\n',
                       'group':'labmate:x:65534:\n', 'hosts':'127.0.0.1 localhost\n::1 localhost\n'}.items():
        try:
            with (system / name).open('x') as file: file.write(text)
        except FileExistsError: pass
    env = {'PATH': '/opt/labmate-runtime/venv/bin:/usr/local/bin:/usr/bin:/bin', 'HOME': '/work',
           'LABMATE_SANDBOX_WORKER': '1', 'EXECUTION_ISOLATION': 'required',
           'EXECUTION_ALLOWED_EMAILS': 'worker@localhost', 'USE_DOCKER': 'false',
           'DATA_DIR': '/work', 'LAB_RESOURCES_DIR': str(ROOT / 'resources'),
           'PYTHONPATH': str(ROOT / 'backend'), 'PLAYWRIGHT_BROWSERS_PATH': str(ROOT / 'browsers'),
           'NODE_RUNTIME_CACHE': str(ROOT / 'node_cache'),
           'COMPILATION_TIMEOUT': '60',
           'REDIS_URL': 'redis://127.0.0.1:6379', 'REDIS_REQUIRED': 'true',
           'OPENBLAS_NUM_THREADS': '1', 'OMP_NUM_THREADS': '1', 'LANG': 'C.UTF-8'}
    args = ['systemd-run', '--quiet', '--scope', '--unit=' + unit,
            '-p', 'MemoryMax=1536M', '-p', 'MemorySwapMax=0', '-p', 'TasksMax=160', '-p', 'CPUQuota=100%',
            'bwrap', '--die-with-parent', '--new-session', '--unshare-user', '--unshare-pid', '--as-pid-1', '--unshare-net',
            '--unshare-ipc', '--unshare-uts', '--unshare-cgroup-try', '--uid', '65534', '--gid', '65534',
            '--cap-drop', 'ALL', '--clearenv', '--ro-bind', '/usr', '/usr', '--symlink', 'usr/bin', '/bin',
            '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/lib64', '/lib64',
            '--ro-bind', str(ROOT), str(ROOT), '--size', str(512 * 1024**2), '--tmpfs', '/work',
            '--proc', '/proc', '--dev', '/dev', '--size', str(128 * 1024**2), '--tmpfs', '/tmp', '--dir', '/etc', '--chdir', '/work']
    for name in ['passwd', 'group', 'hosts']:
        args += ['--ro-bind', str(system / name), '/etc/' + name]
    for source in ['/etc/ld.so.cache', '/etc/alternatives', '/etc/fonts', '/etc/java-21-openjdk', '/usr/local']:
        if Path(source).exists(): args += ['--ro-bind', source, source]
    for key, value in env.items(): args += ['--setenv', key, value]
    return args + ['--', str(ROOT / 'venv/bin/python'), str(ROOT / 'sandbox_job.py')]


def main():
    request = sys.stdin.buffer.read(12 * 1024**2 + 1)
    if len(request) > 12 * 1024**2: raise ValueError('Job exceeds input budget.')
    job = json.loads(request)
    allowed = {'code', 'language', 'filename', 'stdin', 'project_files', 'routes', 'browser_tests',
               'interaction_is_required', 'objective', 'api_tests', 'project_config', 'file_mode'}
    if not isinstance(job, dict) or set(job) - allowed: raise ValueError('Invalid job schema.')
    # rlimits also apply to wrapper/log files; cgroup bounds total descendants' RAM and processes.
    resource.setrlimit(resource.RLIMIT_FSIZE, (32 * 1024**2, 32 * 1024**2))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    unit = 'labmate-job-' + uuid.uuid4().hex + '.scope'
    Path('/var/lib/labmate-jobs').mkdir(mode=0o700, parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir='/var/lib/labmate-jobs') as folder:
        work = Path(folder)
        with tempfile.TemporaryFile() as output, tempfile.TemporaryFile() as error:
            try:
                proc = subprocess.run(command(work, unit), input=request, stdout=output, stderr=error, timeout=220)
                output.seek(0); data = output.read(32 * 1024**2 + 1)
                if proc.returncode or len(data) > 32 * 1024**2:
                    error.seek(0)
                    raise RuntimeError('Namespace job failed: ' + error.read(2048).decode('utf-8', 'replace'))
                receipt = json.loads(data)
                sys.stdout.write(json.dumps(receipt))
            finally:
                subprocess.run(['systemctl', 'kill', '--kill-whom=all', '--signal=KILL', unit],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)


if __name__ == '__main__':
    try: main()
    except Exception as error:
        sys.stdout.write(json.dumps({'success': False, 'error': str(error), 'exit_code': 126}))
