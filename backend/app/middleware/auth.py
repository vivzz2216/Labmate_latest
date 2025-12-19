"""
Authentication and authorization middleware
"""
from fastapi import Depends, HTTPException, status, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
import logging

from ..database import get_db
from ..models import User, Upload, AIJob, Report
from ..security.jwt import verify_token, get_user_id_from_token

logger = logging.getLogger(__name__)

# HTTP Bearer token scheme
security = HTTPBearer()


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to get the current authenticated user from JWT token
    
    Args:
        credentials: HTTP Bearer token credentials
        db: Database session
        
    Returns:
        User object for the authenticated user
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    token = credentials.credentials
    
    try:
        # Verify token and get user ID
        user_id = get_user_id_from_token(token)
        
        # Get user from database
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            logger.warning(f"User {user_id} from token not found in database")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if user is active
        if not user.is_active:
            logger.warning(f"Inactive user {user_id} attempted to access protected resource")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account has been deactivated"
            )
        
        # Cache user on request state for reuse (e.g., CSRF validation)
        if request:
            request.state.user = user
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error authenticating user: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def verify_upload_ownership(
    upload_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Upload:
    """
    Verify that the current user owns the specified upload
    
    Args:
        upload_id: ID of the upload to verify
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Upload object if user owns it
        
    Raises:
        HTTPException: If upload not found or user doesn't own it
    """
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload not found"
        )
    
    # Check ownership (allow if user_id is None for backward compatibility, but log warning)
    if upload.user_id is not None and upload.user_id != current_user.id:
        logger.warning(
            f"User {current_user.id} attempted to access upload {upload_id} owned by user {upload.user_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource"
        )
    
    return upload


async def verify_job_ownership(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> AIJob:
    """
    Verify that the current user owns the job (via upload ownership)
    
    Args:
        job_id: ID of the job to verify
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        AIJob object if user owns it
        
    Raises:
        HTTPException: If job not found or user doesn't own it
    """
    job = db.query(AIJob).filter(AIJob.id == job_id).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    # Verify ownership through upload
    upload = db.query(Upload).filter(Upload.id == job.upload_id).first()
    
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated upload not found"
        )
    
    if upload.user_id is not None and upload.user_id != current_user.id:
        logger.warning(
            f"User {current_user.id} attempted to access job {job_id} owned by user {upload.user_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource"
        )
    
    return job


async def verify_report_ownership(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Report:
    """
    Verify that the current user owns the report (via upload ownership)
    
    Args:
        report_id: ID of the report to verify
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Report object if user owns it
        
    Raises:
        HTTPException: If report not found or user doesn't own it
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Verify ownership through upload
    upload = db.query(Upload).filter(Upload.id == report.upload_id).first()
    
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated upload not found"
        )
    
    if upload.user_id is not None and upload.user_id != current_user.id:
        logger.warning(
            f"User {current_user.id} attempted to access report {report_id} owned by user {upload.user_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource"
        )
    
    return report


async def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Optional authentication - returns user if token is valid, None otherwise
    Useful for endpoints that work both with and without authentication
    """
    cached_user = getattr(request.state, 'user', None) if request else None
    if cached_user:
        return cached_user

    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None

