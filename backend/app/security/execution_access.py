"""Admission control for the existing controlled beta process runner.

This limits who may execute code; it is not a per-run security sandbox.
"""
import os

from fastapi import Depends, HTTPException

from ..config import settings
from ..middleware.auth import get_current_user
from .operator_access import is_admin_user, is_user_credit_exempt


def check_execution_access(user, *, require_profile=True):
    if not user or not getattr(user, 'is_active', True):
        raise ValueError('Sign in with an active account to run labs.')
    if is_admin_user(user):
        return
    if settings.LOCAL_OPEN_EXECUTION and not os.getenv('RAILWAY_ENVIRONMENT_ID'):
        if require_profile:
            from ..services.profile_service import require_student_profile
            require_student_profile(user)
        return
    allowed={email.strip().casefold() for email in settings.EXECUTION_ALLOWED_EMAILS.split(',') if email.strip()}
    allowed.update(email.strip().casefold() for email in settings.BETA_TEST_EMAILS.split(',') if email.strip())
    if not allowed and os.getenv('RAILWAY_ENVIRONMENT_ID'):
        raise ValueError('Code execution is closed until the operator configures EXECUTION_ALLOWED_EMAILS for invited beta accounts.')
    # An explicit wildcard admits all authenticated students; isolation and billing still apply.
    if allowed and '*' not in allowed and str(getattr(user,'email','')).casefold() not in allowed:
        raise ValueError('Code execution is currently available to invited beta accounts only.')
    if require_profile:
        from ..services.profile_service import require_student_profile
        require_student_profile(user)


async def execution_user(user=Depends(get_current_user)):
    try:
        check_execution_access(user)
    except ValueError as error:
        raise HTTPException(403,str(error)) from None
    return user


async def legacy_execution_user(user=Depends(execution_user)):
    if settings.BILLING_ENABLED and not is_user_credit_exempt(user):
        raise HTTPException(402, 'Use Code execution (/code-execution) to run an assignment with experiment credits.')
    return user
