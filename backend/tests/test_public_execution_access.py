"""Public execution admission must retain account, profile and billing checks."""
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.config import settings
from app.middleware.auth import get_current_user
from app.security.execution_access import check_execution_access, execution_user, legacy_execution_user


def student(email='student@example.org'):
    return SimpleNamespace(email=email, is_active=True, name='Student', profile=SimpleNamespace(
        institution='College', course='Computer Science',
        profile_metadata={'roll_number': 'CS01', 'year': '2nd Year', 'graduation_year': '2028'}))


@pytest.fixture(autouse=True)
def public_railway():
    with patch.dict('os.environ', {'RAILWAY_ENVIRONMENT_ID': 'production'}), \
         patch.object(settings, 'EXECUTION_ALLOWED_EMAILS', '*'), \
         patch.object(settings, 'BETA_TEST_EMAILS', ''):
        yield


def test_wildcard_admits_different_students_but_not_missing_or_inactive_users():
    for email in ('one@example.org', 'two@example.net'):
        check_execution_access(student(email))
    for user in (None, SimpleNamespace(email='student@example.org', is_active=False)):
        with pytest.raises(ValueError, match='active account'):
            check_execution_access(user)


def test_public_access_retains_required_profile():
    user = SimpleNamespace(email='student@example.org', is_active=True)
    with pytest.raises(HTTPException) as caught:
        check_execution_access(user)
    assert caught.value.status_code == 428
    check_execution_access(user, require_profile=False)


def test_invite_only_mode_remains_exact_when_wildcard_removed():
    with patch.object(settings, 'EXECUTION_ALLOWED_EMAILS', 'invited@example.org'):
        check_execution_access(student('invited@example.org'))
        with pytest.raises(ValueError, match='invited'):
            check_execution_access(student('other@example.org'))


def test_http_admission_requires_authentication_and_accepts_signed_in_student():
    app = FastAPI()

    @app.get('/protected')
    def protected(user=Depends(execution_user)):
        return {'email': user.email}

    with TestClient(app) as client:
        assert client.get('/protected').status_code in (401, 403)
        app.dependency_overrides[get_current_user] = lambda: student()
        assert client.get('/protected').json() == {'email': 'student@example.org'}


@pytest.mark.asyncio
async def test_public_admission_does_not_bypass_legacy_credit_billing():
    with patch.object(settings, 'BILLING_ENABLED', True):
        with pytest.raises(HTTPException) as caught:
            await legacy_execution_user(student())
        assert caught.value.status_code == 402
