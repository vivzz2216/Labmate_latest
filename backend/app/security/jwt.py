"""
JWT token generation and validation for secure authentication
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import HTTPException, status
from ..config import settings
import logging

logger = logging.getLogger(__name__)

# JWT Configuration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30  # Short-lived access tokens
REFRESH_TOKEN_EXPIRE_DAYS = 7  # Longer-lived refresh tokens


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token
    
    Args:
        data: Dictionary containing user claims (e.g., {"sub": user_id, "email": email})
        expires_delta: Optional custom expiration time
        
    Returns:
        Encoded JWT token string
    """
    if not settings.SECRET_KEY:
        raise ValueError("SECRET_KEY must be set for JWT token generation")
    
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "access"})
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """
    Create a JWT refresh token
    
    Args:
        data: Dictionary containing user claims
        
    Returns:
        Encoded JWT refresh token string
    """
    if not settings.SECRET_KEY:
        raise ValueError("SECRET_KEY must be set for JWT token generation")
    
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "refresh"})
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str, token_type: str = "access") -> dict:
    """
    Verify and decode a JWT token
    
    Args:
        token: JWT token string to verify
        token_type: Expected token type ("access" or "refresh")
        
    Returns:
        Decoded token payload
        
    Raises:
        HTTPException: If token is invalid, expired, or wrong type
    """
    if not settings.SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error"
        )
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        
        # Verify token type
        if payload.get("type") != token_type:
            logger.warning(f"Token type mismatch: expected {token_type}, got {payload.get('type')}")
            raise credentials_exception
        
        # Verify required claims
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
            
        return payload
        
    except JWTError as e:
        logger.warning(f"JWT validation failed: {e}")
        raise credentials_exception
    except Exception as e:
        logger.error(f"Unexpected error during token verification: {e}")
        raise credentials_exception


def get_user_id_from_token(token: str) -> int:
    """
    Extract user ID from JWT token
    
    Args:
        token: JWT token string
        
    Returns:
        User ID as integer
        
    Raises:
        HTTPException: If token is invalid
    """
    payload = verify_token(token)
    user_id_str = payload.get("sub")
    
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user ID"
        )
    
    try:
        return int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: invalid user ID format"
        )

