from fastapi import HTTPException, Header
from typing import Optional
from ..config import settings


def verify_beta_key(x_beta_key: Optional[str] = Header(None)):
    """Middleware to verify beta key in headers"""
    if not x_beta_key or x_beta_key != settings.BETA_KEY:
        raise HTTPException(
            status_code=403,
            detail="Invalid or missing beta key. Please provide a valid beta key in the X-Beta-Key header."
        )
    return True
