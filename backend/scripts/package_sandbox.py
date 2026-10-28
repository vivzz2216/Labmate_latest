"""Create a secret-free runtime bundle for the dedicated Linux worker VM."""
from pathlib import Path
import tarfile
import hashlib

repo = Path(__file__).resolve().parents[2]
target = repo / 'backend/audit_artifacts/isolated-runtime/runtime.tar.gz'
target.parent.mkdir(parents=True, exist_ok=True)
def safe_mode(member):
    member.uid = member.gid = 0
    member.uname = member.gname = 'root'
    member.mode = 0o755 if member.isdir() else 0o644
    return member
with tarfile.open(target, 'w:gz') as archive:
    for root, dest in [('backend/app', 'backend/app'), ('google_colab', 'resources/google_colab'),
                       ('sql_workbench', 'resources/sql_workbench')]:
        for path in (repo / root).rglob('*'):
            if path.is_file() and not path.is_symlink() and '__pycache__' not in path.parts and path.suffix != '.pyc' and not path.name.startswith('.env'):
                relative = path.relative_to(repo / root)
                if root in {'google_colab', 'sql_workbench'}:
                    allowed_asset = relative.parts[0] == 'assets' and path.suffix.lower() in {'.svg', '.png', '.jpg', '.jpeg', '.webp', '.json', '.woff', '.woff2', '.ttf'}
                    if not allowed_asset and relative.as_posix() not in {'index.html', 'app.js', 'style.css'}:
                        continue
                archive.add(path, str(Path(dest) / relative), filter=safe_mode)
    for source, dest in [('backend/requirements.txt', 'requirements.txt'),
                         ('backend/scripts/sandbox_job.py', 'sandbox_job.py'),
                         ('backend/scripts/provision_sandbox.sh', 'provision.sh'),
                         ('backend/scripts/sandbox_broker.py', 'broker.py')]:
        archive.add(repo / source, dest, filter=safe_mode)
print(target)
digest = hashlib.sha256(target.read_bytes()).hexdigest()
target.with_suffix(target.suffix + '.sha256').write_text(digest + '  ' + target.name + '\n')
