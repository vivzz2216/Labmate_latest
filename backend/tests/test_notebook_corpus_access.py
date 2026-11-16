"""Approved library resources remain readable without permitting writes or private files."""
import os
from pathlib import Path
import subprocess
import zipfile

from app.services.notebook_runtime import _notebook_python_executable


def test_corpus_archive_is_read_only_and_does_not_open_private_paths(tmp_path):
    cache = tmp_path / 'approved-corpora'
    cache.mkdir()
    archive = cache / 'lexicon.zip'
    with zipfile.ZipFile(archive, 'w') as target:
        target.writestr('lexicon.txt', 'great\t3.1')
    workspace = tmp_path / 'workspace'
    workspace.mkdir()
    private = tmp_path / 'private.txt'
    private.write_text('private')
    backend = str(Path(__file__).resolve().parents[1])
    source = """
import sys, json, zipfile
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from app.services import colab_worker
cache, workspace, private = map(Path, sys.argv[2:])
colab_worker.APPROVED_CORPUS_DIR = cache
colab_worker.restrict_runtime(workspace)
with zipfile.ZipFile(cache / 'lexicon.zip') as archive:
    assert archive.read('lexicon.txt') == b'great\\t3.1'
for path, mode in ((cache / 'lexicon.zip', 'wb'), (private, 'r')):
    try:
        with open(path, mode):
            pass
    except PermissionError:
        continue
    raise AssertionError('Private read or corpus write was permitted')
print('APPROVED_READ_ONLY')
"""
    env = {key: value for key, value in os.environ.items()
           if key.upper() in {'PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'}}
    result = subprocess.run([_notebook_python_executable(), '-I', '-B', '-c', source,
                             backend, str(cache), str(workspace), str(private)],
                            cwd=workspace, env=env, capture_output=True, text=True, timeout=45)
    assert result.returncode == 0, result.stderr
    assert 'APPROVED_READ_ONLY' in result.stdout
    assert private.read_text() == 'private'
    with zipfile.ZipFile(archive) as target:
        assert target.read('lexicon.txt') == b'great\t3.1'
