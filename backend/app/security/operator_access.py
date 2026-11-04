"""Operator identity is configured on the server, never by a browser flag."""
from ..config import settings


def admin_email():
    email = (settings.ADMIN_USERID or '').strip().strip("'\"").casefold()
    password = (settings.ADMIN_PASSWORD or '').strip().strip("'\"")
    return email if '@' in email and password else ''


def is_admin_user(user):
    return bool(user and admin_email() and getattr(user, 'is_active', True)
                and str(getattr(user, 'email', '')).strip().casefold() == admin_email())


def is_user_credit_exempt(user):
    if not user or not getattr(user, 'is_active', True):
        return False
    email = str(getattr(user, 'email', '')).strip().casefold()
    exempt = {value.strip().casefold() for value in settings.CREDIT_EXEMPT_EMAILS.split(',') if value.strip()}
    return bool(email and (is_admin_user(user) or email in exempt))
