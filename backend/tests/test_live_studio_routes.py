from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.csrf import require_csrf_token
from app.netlab.scenario import build_scenario
from app.routers import ide_python, netlab
from app.security.execution_access import execution_user


def test_saved_capture_can_be_reopened():
    app = FastAPI()
    app.include_router(netlab.router)
    app.dependency_overrides[netlab.networks_available] = lambda: None
    data, _ = build_scenario()
    with TestClient(app) as client:
        opened = client.post('/netlab/wireshark/open', files={'file': ('capture.pcap', data)})
        assert opened.status_code == 200
        downloaded = client.get(f'/netlab/wireshark/{opened.json()["token"]}/download')
        assert downloaded.content == data
        assert downloaded.headers['Cache-Control'] == 'private, no-store'
        again = client.post('/netlab/wireshark/open', files={'file': ('capture.pcap', downloaded.content)})
        assert again.json()['total'] == opened.json()['total']


def test_python_editor_sends_input_through_existing_runtime(monkeypatch):
    async def run(user_id, code, language, stdin):
        assert (user_id, code, language, stdin) == (3, 'print(input())', 'python', 'hello')
        return SimpleNamespace(success=True, output='hello\n', error='', exit_code=0)

    monkeypatch.setattr(ide_python, 'run_editor_program', run)
    app = FastAPI()
    app.include_router(ide_python.router)
    app.dependency_overrides[execution_user] = lambda: SimpleNamespace(id=3)
    app.dependency_overrides[require_csrf_token] = lambda: True
    with TestClient(app) as client:
        response = client.post('/ide/python/run', json={'code': 'print(input())', 'stdin': 'hello'})
    assert response.json() == {'success': True, 'stdout': 'hello\n', 'stderr': '', 'exit_code': 0}
