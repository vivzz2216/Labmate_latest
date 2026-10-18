"""Admission control for the existing controlled beta process runner.

This limits who may execute code; it is not a per-run security sandbox.
"""
import os

from fastapi import Depends, HTTPException

from ..config import settings
from ..middleware.auth import get_current_user


def check_execution_access(user):
    allowed={email.strip().casefold() for email in settings.EXECUTION_ALLOWED_EMAILS.split(',') if email.strip()}
    if not allowed and not os.getenv('RAILWAY_ENVIRONMENT_ID'):
        return
    if not allowed:
        raise ValueError('Code execution is closed until the operator configures EXECUTION_ALLOWED_EMAILS for invited beta accounts.')
    if not user or str(getattr(user,'email','')).casefold() not in allowed:
        raise ValueError('Code execution is currently available to invited beta accounts only.')


async def execution_user(user=Depends(get_current_user)):
    try:
        check_execution_access(user)
    except ValueError as error:
        raise HTTPException(403,str(error)) from None
    return user


async def legacy_execution_user(user=Depends(execution_user)):
    if settings.BILLING_ENABLED:
        raise HTTPException(402, 'Use Code execution (/code-execution) to run an assignment with experiment credits.')
    return user
