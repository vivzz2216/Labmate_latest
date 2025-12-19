"""
CSRF protection middleware
"""
from fastapi import Request, HTTPException, status, Header, Depends
from typing import Optional
import secrets
import logging
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


def store_csrf_token(token: str, user_id: Optional[int] = None) -> None:
    """
    Store CSRF token in Redis with optional user association
    
    Args:
        token: CSRF token to store
        user_id: Optional user ID to associate with token
    """
    if not redis_client:
        # If Redis is not available, skip CSRF token storage
        # In production, Redis should always be available
        logger.warning("Redis not available, CSRF token not stored")
        return
    
    try:
        key = f"csrf_token:{token}"
        if user_id:
            key = f"csrf_token:{user_id}:{token}"
        
        redis_client.setex(key, CSRF_TOKEN_TTL, "1")
    except Exception as e:
        logger.error(f"Failed to store CSRF token: {e}")


def verify_csrf_token(token: str, user_id: Optional[int] = None) -> bool:
    """
    Verify CSRF token exists and is valid
    
    Args:
        token: CSRF token to verify
        user_id: Optional user ID to check token against
        
    Returns:
        True if token is valid, False otherwise
    """
    if not redis_client:
        # If Redis is not available, allow request (fail open)
        # In production, this should be logged as an error
        logger.warning("Redis not available, CSRF verification skipped")
        return True
    
    if not token:
        return False
    
    try:
        key = f"csrf_token:{token}"
        if user_id:
            key = f"csrf_token:{user_id}:{token}"
        
        exists = redis_client.exists(key)
        return bool(exists)
    except Exception as e:
        logger.error(f"Failed to verify CSRF token: {e}")
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
    if not verify_csrf_token(x_csrf_token, user_id):
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

