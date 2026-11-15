import ast
import importlib.util
from pathlib import Path
from unittest.mock import AsyncMock
import pytest

from app.services import sql_accounts, glm_service, dc_runtime
from app.config import settings


BACKEND_ROOT = Path(__file__).resolve().parent.parent


class _FakeCursor:
    def __init__(self):
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, sql, params=None):
        self.executed.append((sql, params))

    def fetchall(self):
        return []


class _FakeConn:
    def __init__(self, cursor):
        self._cursor = cursor

    def cursor(self):
        return self._cursor

    def close(self):
        pass


class _FakeSession:
    def __init__(self):
        self.allow_dcl = True
        self.db_user = "admin"
        self.session_token = "tok"
        self.exercise_users = {"reader": ("labd_tok_0", "pw")}
        self.schema_map = {"shop": "run_1_shop"}
        self.active_schema = "shop"
        self.cur = _FakeCursor()

    def _find_logical_schema(self, name):
        return name if name in self.schema_map else None

    def _open_admin_connection(self):
        return _FakeConn(self.cur)

    def _ok(self, **kwargs):
        return {"success": True, **kwargs}

    def _failure(self, message, started, stmt=""):
        return {"success": False, "error": message, "stmt": stmt}


def test_sql_accounts_rejects_embedded_backticks_and_allows_valid_grants():
    session = _FakeSession()
    ok = sql_accounts.execute_dcl(
        session,
        "GRANT SELECT (`name`, `email`) ON `shop`.`orders` TO 'reader'@'localhost'",
        0.0,
    )
    assert ok["success"] is True

    for injected in [
        "GRANT SELECT ON `shop`.`a`b` TO 'reader'@'localhost'",
        "GRANT SELECT ON `sh`op`.`orders` TO 'reader'@'localhost'",
        "GRANT SELECT (`a`b`) ON `shop`.`orders` TO 'reader'@'localhost'",
    ]:
        session.cur.executed.clear()
        res = sql_accounts.execute_dcl(session, injected, 0.0)
        assert res["success"] is False, f"Injection payload unexpectedly succeeded: {injected}"
        assert not session.cur.executed


@pytest.mark.asyncio
async def test_glm_service_disables_redirect_following(monkeypatch):
    captured = {}

    class FakeResp:
        status_code = 200
        is_success = True
        headers = {}
        text = '{"choices":[{"finish_reason":"stop","message":{"content":"{\\"ok\\":true}"}}]}'

        def json(self):
            return {"choices": [{"finish_reason": "stop", "message": {"content": '{"ok": true}'}}]}

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            captured.update(kwargs)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, *args, **kwargs):
            return FakeResp()

    monkeypatch.setattr(glm_service, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(settings, "GLM_ENABLED", True, raising=False)
    monkeypatch.setattr(settings, "GLM_API_KEY", "test-key", raising=False)
    monkeypatch.setattr(settings, "GLM_MODEL", "glm-test", raising=False)
    res = await glm_service.generate_glm_json(
        "return json",
        "hello",
        {"type": "object", "properties": {"ok": {"type": "boolean"}}, "required": ["ok"]},
    )
    assert res == {"ok": True}
    assert captured.get("follow_redirects") is False


@pytest.mark.asyncio
async def test_dc_runtime_sanitizes_env_and_requires_worker(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-super-secret-leak")
    recorded_kwargs = []

    class FakeStream:
        async def read(self, n=-1):
            return b""

    class FakeProc:
        returncode = 0
        stdout = FakeStream()
        stderr = FakeStream()

        def kill(self):
            pass

        async def wait(self):
            return 0

        async def communicate(self, input=None):
            return b"Server listening\n", b""

    async def fake_exec(*cmd, **kwargs):
        recorded_kwargs.append(kwargs)
        return FakeProc()

    monkeypatch.setattr(dc_runtime.asyncio, "create_subprocess_exec", fake_exec)
    monkeypatch.setattr(dc_runtime.asyncio, "sleep", AsyncMock())
    monkeypatch.setattr(settings, "EXECUTION_ISOLATION", "development")

    await dc_runtime._run_server_client(tmp_path, "LabServer", "LabClient", None, 20.0)
    assert recorded_kwargs, "Expected subprocess execution"
    for kw in recorded_kwargs:
        assert "env" in kw and isinstance(kw["env"], dict)
        assert "OPENAI_API_KEY" not in kw["env"]

    monkeypatch.setattr(settings, "EXECUTION_ISOLATION", "required")
    monkeypatch.delenv("LABMATE_SANDBOX_WORKER", raising=False)
    before = len(recorded_kwargs)
    result = await dc_runtime._run_server_client(tmp_path, "LabServer", "LabClient", None, 20.0)
    assert not result.success
    assert len(recorded_kwargs) == before


def test_ubuntu_desktop_binds_novnc_to_localhost():
    if not (BACKEND_ROOT / "scripts" / "ubuntu_desktop.sh").is_file():
        pytest.skip("Ubuntu is excluded from this release.")
    content = (BACKEND_ROOT / "scripts" / "ubuntu_desktop.sh").read_text(encoding="utf-8")
    assert "0.0.0.0:6080" not in content
    assert "127.0.0.1:6080" in content


def test_colab_worker_has_no_broken_colab_html_path():
    content = (BACKEND_ROOT / "app" / "services" / "colab_worker.py").read_text(encoding="utf-8")
    assert "COLAB_HTML_PATH" not in content


def test_railway_job_imports_cross_platform():
    job_path = BACKEND_ROOT / "railway_runtime" / "job.py"
    spec = importlib.util.spec_from_file_location("railway_runtime_job_test", job_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert callable(mod.run)


def test_task_service_and_screenshot_service_have_no_bare_except():
    for rel in ("app/services/task_service.py", "app/services/screenshot_service.py"):
        tree = ast.parse((BACKEND_ROOT / rel).read_text(encoding="utf-8"))
        bare = [n.lineno for n in ast.walk(tree) if isinstance(n, ast.ExceptHandler) and n.type is None]
        assert not bare, f"Bare except found in {rel} at lines {bare}"


def test_assignment_workflow_missing_stdin_does_not_abort_manual():
    content = (BACKEND_ROOT / "app" / "services" / "assignment_workflow.py").read_text(encoding="utf-8")
    idx = content.find("needs explicit sample input before it can be verified.")
    assert idx != -1
    snippet = content[max(0, idx - 120):idx + 60]
    assert "raise ValueError" not in snippet
