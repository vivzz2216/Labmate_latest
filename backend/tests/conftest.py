"""
Pytest configuration for backend tests.
This file ensures the backend directory is in the Python path for imports.
"""
import ipaddress
import os
import socket
import sys
import tempfile
from pathlib import Path

import pytest
import pytest_asyncio

# Add the backend directory to Python path so we can import 'app'
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Route dependency overrides do not replace the database used by app lifespan
# startup. Isolate it BEFORE any app imports, even when a developer .env exists.
session_parent = backend_dir / 'react_temp'
session_parent.mkdir(parents=True, exist_ok=True)
session_root = Path(tempfile.mkdtemp(prefix='pytest-session-', dir=session_parent)).resolve()
os.environ['DATABASE_URL'] = 'sqlite:///' + (session_root / 'state.db').as_posix()
os.environ['DATA_DIR'] = str(session_root)
for name, folder in [('UPLOAD_DIR', 'uploads'), ('REPORT_DIR', 'reports'), ('SCREENSHOT_DIR', 'screenshots'),
                     ('REACT_TEMP_DIR', 'runtime'), ('LOG_DIR', 'logs')]:
    os.environ[name] = str(session_root / folder)
os.environ['SECRET_KEY'] = 'test-only-session-secret-' + 'x' * 40
os.environ['ADMIN_USERID'] = 'suite-owner@example.test'
os.environ['ADMIN_PASSWORD'] = 'suite-owner-test-password'
os.environ['CREDIT_EXEMPT_EMAILS'] = ''
os.environ['REDIS_URL'] = 'redis://127.0.0.1:6399/15'
os.environ['REDIS_REQUIRED'] = 'false'
os.environ['STORAGE_BACKEND'] = 'local'
os.environ.pop('RAILWAY_ENVIRONMENT_ID', None)


# Every provider credential/flag that can enable an outbound generation route, plus deployment gates.
# Tests that need one set it explicitly; nothing may leak in from a developer's .env.
_PROVIDER_ISOLATION = {
    "LLM_PROVIDER": "groq",
    "LLM_FALLBACK_PROVIDER": "",
    "GROQ_API_KEY": "",
    "GROQ_FALLBACK_MODEL": "",
    "GEMINI_API_KEY": "",
    "OPENROUTER_API_KEY": "",
    "OPENCODE_ENABLED": False,
    "OPENCODE_API_KEY": "",
    "DEEPSEEK_ENABLED": False,
    "DEEPSEEK_API_KEY": "",
    "GLM_ENABLED": False,
    "GLM_API_KEY": "",
    # Deployment gates that a developer's .env commonly enables; tests opt in explicitly.
    "EXECUTION_ALLOWED_EMAILS": "",
    "EXECUTION_ISOLATION": "development",
    "RATE_LIMIT_ENABLED": False,
    "BILLING_ENABLED": False,
    "STORAGE_BACKEND": "local",
    "EXECUTION_BACKEND": "ssh",
    "MYSQL_URL": "",
    "MYSQL_HOST": "127.0.0.1",
    "PROVIDER_BUDGET_ENABLED": True,
    "PROVIDER_MAX_WAIT_SECONDS": 30.0,
    "GROQ_RPM_LIMIT": 30,
    "GROQ_TPM_LIMIT": 30000,
    "GEMINI_RPM_LIMIT": 15,
    "GEMINI_TPM_LIMIT": 1000000,
    "OPENROUTER_RPM_LIMIT": 20,
    "OPENROUTER_TPM_LIMIT": 40000,
    "OPENCODE_RPM_LIMIT": 20,
    "OPENCODE_TPM_LIMIT": 40000,
}


def student_profile(**overrides):
    """A complete student profile. Lab execution refuses an account without one."""
    from app.models import UserProfile
    values = {'institution': 'Example College', 'course': 'Computer Science', **overrides}
    values['profile_metadata'] = {'roll_number': 'CS01', 'year': '2nd Year', 'graduation_year': '2028',
                                  **(overrides.get('profile_metadata') or {})}
    return UserProfile(**values)


def _is_local_host(host, extra=()):
    if host is None:
        return True
    if isinstance(host, bytes):
        host = host.decode("ascii", "ignore")
    host = str(host).strip().lower()
    if host in {"", "localhost", "testserver", "test", *extra}:
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


@pytest.fixture(autouse=True)
def isolate_providers_and_block_network(request, monkeypatch):
    """Zero all provider credentials, reset cooldown state and refuse non-local name resolution.

    Provider HTTP in tests must use httpx.MockTransport. A test that genuinely needs the network
    must opt in with @pytest.mark.allow_network.
    """
    from app.config import settings
    from app.services.generation_service import generation_service
    monkeypatch.delenv('RAILWAY_API_TOKEN', raising=False)

    for name, value in _PROVIDER_ISOLATION.items():
        monkeypatch.setattr(settings, name, value, raising=False)
    generation_service._groq_unavailable_until = 0
    generation_service._backup_unavailable_until = 0
    generation_service._free_unavailable_until.clear()
    from app.services.provider_budget import provider_budget
    provider_budget.reset()

    if request.node.get_closest_marker("allow_network") is None:
        allowed = {str(getattr(settings, "MYSQL_HOST", "") or "").lower()}
        real_getaddrinfo = socket.getaddrinfo

        def guarded_getaddrinfo(host, *args, **kwargs):
            if not _is_local_host(host, allowed):
                raise OSError(f"Network blocked in tests (resolve {host!r}). Use httpx.MockTransport or @pytest.mark.allow_network.")
            return real_getaddrinfo(host, *args, **kwargs)

        monkeypatch.setattr(socket, "getaddrinfo", guarded_getaddrinfo)
    yield


@pytest_asyncio.fixture(autouse=True)
async def close_capture_browsers_after_test():
    yield
    from app.services.browser_capture import close_browser_pools
    await close_browser_pools()
