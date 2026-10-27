"""
CSRF protection middleware
"""
from fastapi import Request, HTTPException, status, Header, Depends
from typing import Optional
import secrets
import logging
import asyncio
from ..cache import redis_client
from ..models import User
from .auth import get_optional_user

logger = logging.getLogger(__name__)

# CSRF token length
CSRF_TOKEN_LENGTH = 32
CSRF_TOKEN_HEADER = "X-CSRF-Token"
CSRF_TOKEN_COOKIE = "csrf_token"
CSRF_TOKEN_TTL = 3600  # 1 hour


def generate_csrf_token() -> str:
    """
    Generate a secure random CSRF token
    
    Returns:
        Base64-encoded random token
    """
    return secrets.token_urlsafe(CSRF_TOKEN_LENGTH)


def store_csrf_token(token: str, user_id: Optional[int] = None) -> bool:
    """
    Store CSRF token in Redis with optional user association
    """
    if not redis_client:
        logger.warning("Redis not available, CSRF token not stored")
        return False
    
    key = f"csrf_token:{token}"
    if user_id:
        key = f"csrf_token:{user_id}:{token}"

    try:
        redis_client.setex(key, CSRF_TOKEN_TTL, "1")
        return True
    except Exception:
        logger.error("Redis store failed; CSRF token was not stored")
        return False


def verify_csrf_token(token: str, user_id: Optional[int] = None) -> bool:
    """
    Verify CSRF token exists and is valid
    """
    if not redis_client:
        logger.error("Redis not available; CSRF verification denied")
        return False
    
    if not token:
        return False
    
    key = f"csrf_token:{token}"
    if user_id:
        key = f"csrf_token:{user_id}:{token}"

    try:
        return bool(redis_client.exists(key))
    except Exception:
        logger.error("Redis check failed; CSRF verification denied")
        return False


async def validate_csrf_token(
    request: Request,
    x_csrf_token: Optional[str] = Header(None, alias=CSRF_TOKEN_HEADER),
    current_user: Optional[object] = None
) -> bool:
    """
    Validate CSRF token from request header
    
    Args:
        request: FastAPI request object
        x_csrf_token: CSRF token from X-CSRF-Token header
        current_user: Optional authenticated user object
        
    Returns:
        True if token is valid
        
    Raises:
        HTTPException: If CSRF token is missing or invalid
    """
    # Skip CSRF validation for safe methods (GET, HEAD, OPTIONS)
    if request.method in ["GET", "HEAD", "OPTIONS"]:
        return True
    
    # Skip CSRF validation for health checks and static files
    if request.url.path in ["/health", "/api/health", "/docs", "/openapi.json"]:
        return True

    if not x_csrf_token:
        logger.warning(f"CSRF token missing for {request.method} {request.url.path}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token is required"
        )
    
    # Get user ID if authenticated
    user_id = None
    if current_user and hasattr(current_user, 'id'):
        user_id = current_user.id
    
    # Verify token
    if not await asyncio.to_thread(verify_csrf_token,x_csrf_token,user_id):
        logger.warning(f"Invalid CSRF token for {request.method} {request.url.path}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid CSRF token"
        )
    
    return True


async def require_csrf_token(
    request: Request,
    x_csrf_token: Optional[str] = Header(None, alias=CSRF_TOKEN_HEADER),
    current_user: Optional[User] = Depends(get_optional_user)
) -> bool:
    """
    FastAPI dependency to validate CSRF token
    Use with Depends(require_csrf_token) in route handlers
    
    This dependency validates CSRF tokens using the current authenticated user if available.
    """
    return await validate_csrf_token(request, x_csrf_token, current_user)

