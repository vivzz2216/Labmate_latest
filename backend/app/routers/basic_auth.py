from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
from datetime import datetime, timedelta
import bcrypt
import secrets
import re
import logging

from ..database import get_db, get_db_transaction
from ..models import User, UserProfile
from ..security.jwt import create_access_token, create_refresh_token, verify_token
from ..middleware.auth import get_current_user
from ..middleware.csrf import generate_csrf_token, store_csrf_token

# Set up logging for debugging
logger = logging.getLogger(__name__)

router = APIRouter()

# Password requirements
MIN_PASSWORD_LENGTH = 8
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

class UserSignup(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=MIN_PASSWORD_LENGTH)
    
    @validator('password')
    def validate_password_strength(cls, v):
        """Ensure password meets minimum security requirements"""
        if len(v) < MIN_PASSWORD_LENGTH:
            raise ValueError(f'Password must be at least {MIN_PASSWORD_LENGTH} characters long')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one digit')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        return v
    
    @validator('name')
    def validate_name(cls, v):
        """Sanitize and validate name"""
        # Remove any non-alphanumeric characters except spaces, hyphens, apostrophes
        if not re.match(r"^[a-zA-Z\s\-']+$", v):
            raise ValueError('Name can only contain letters, spaces, hyphens, and apostrophes')
        return v.strip()

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    profile_picture: Optional[str] = None
    created_at: str
    last_login: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
    csrf_token: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str

def hash_password(password: str) -> str:
    """Hash a password using bcrypt with secure rounds"""
    # Use 12 rounds for bcrypt (good balance of security and performance)
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

def check_account_lockout(user: User) -> bool:
    """Check if account is locked due to failed login attempts"""
    if user.locked_until and user.locked_until > datetime.utcnow():
        return True
    return False

def handle_failed_login(db: Session, user: User):
    """Handle failed login attempt with progressive lockout"""
    # Best-effort: never let tracking/lockout updates turn a normal 401 into a 500.
    try:
        user.failed_login_attempts = int(user.failed_login_attempts or 0) + 1

        if user.failed_login_attempts >= MAX_LOGIN_ATTEMPTS:
            # Lock account for LOCKOUT_DURATION_MINUTES
            user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)

        db.commit()
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        logger.warning(f"Failed to update failed_login_attempts for user {getattr(user, 'id', None)}: {e}", exc_info=True)

def reset_failed_attempts(db: Session, user: User):
    """Reset failed login attempts after successful login"""
    # Best-effort: do not fail login if this bookkeeping update fails.
    try:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.commit()
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        logger.warning(f"Failed to reset failed_login_attempts for user {getattr(user, 'id', None)}: {e}", exc_info=True)

@router.post("/signup", response_model=TokenResponse)
async def signup(request: UserSignup, db: Session = Depends(get_db)):
    """
    Create a new user account with secure password hashing and JWT tokens.
    Uses database transaction to prevent race conditions.
    """
    logger.debug(f"Signup request received for email: {request.email}")
    
    user = None

    try:
        # Check if user already exists (case-insensitive email check)
        logger.debug(f"Checking if user exists with email: {request.email}")
        existing_user = db.query(User).filter(
            func.lower(User.email) == func.lower(request.email)
        ).first()

        if existing_user:
            logger.warning(f"Signup failed: Email already registered - {request.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # Hash the password securely
        logger.debug("Hashing password...")
        hashed_password = hash_password(request.password)
        logger.debug("Password hashed successfully")

        # Create new user with hashed password
        logger.debug(f"Creating user record for: {request.email}")
        user = User(
            email=request.email.lower(),  # Store email in lowercase for consistency
            name=request.name,
            password_hash=hashed_password,
            google_id=None,
            profile_picture=None,
            is_active=True,
            failed_login_attempts=0,
            created_at=datetime.utcnow(),
            last_login=datetime.utcnow()
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        logger.info(f"User created successfully: id={user.id}, email={user.email}")

    except HTTPException:
        raise
    except IntegrityError as e:
        # Handle unique constraint violation (race condition caught)
        logger.warning(f"Signup race condition detected for email {request.email}: {e}")
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    except Exception as e:
        logger.error(f"Signup failed for email {request.email}: {e}", exc_info=True)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user account"
        )
    
    try:
        token_data = {"sub": str(user.id), "email": user.email}
        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)
        
        # Generate CSRF token
        csrf_token = generate_csrf_token()
        store_csrf_token(csrf_token, user.id)
    except ValueError as jwt_error:
        # JWT generation failed (e.g., SECRET_KEY not set)
        logger.error(f"JWT token generation failed: {jwt_error}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error: JWT token generation failed"
        )
    
    # Return tokens and user info
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=30 * 60,  # 30 minutes in seconds
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            profile_picture=user.profile_picture,
            created_at=user.created_at.isoformat(),
            last_login=user.last_login.isoformat()
        ),
        csrf_token=csrf_token
    )

@router.post("/login", response_model=TokenResponse)
async def login(request: UserLogin, db: Session = Depends(get_db)):
    """
    Secure login with email and password verification.
    Returns JWT access and refresh tokens.
    Includes brute force protection with account lockout.
    """
    logger.debug(f"Login request received for email: {request.email}")
    
    try:
        # Find user by email (case-insensitive)
        logger.debug(f"Looking up user with email: {request.email}")
        user = db.query(User).filter(
            func.lower(User.email) == func.lower(request.email)
        ).first()
        
        # Use constant-time comparison to prevent timing attacks
        # Return same error message whether user exists or password is wrong
        if not user:
            logger.warning(f"Login failed: User not found for email {request.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        logger.debug(f"User found: id={user.id}, is_active={user.is_active}, failed_attempts={user.failed_login_attempts}")
        
        # Check if account is locked
        if check_account_lockout(user):
            remaining_time = int((user.locked_until - datetime.utcnow()).total_seconds() / 60)
            logger.warning(f"Login failed: Account locked for user {user.id}, remaining time: {remaining_time} minutes")
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account is temporarily locked due to multiple failed login attempts. Please try again in {remaining_time} minutes."
            )
        
        # Check if account is active
        if not user.is_active:
            logger.warning(f"Login failed: Account deactivated for user {user.id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account has been deactivated. Please contact support."
            )
        
        # Verify password with stored hash
        if not user.password_hash:
            logger.warning(f"Login failed: No password hash for user {user.id} (email: {user.email})")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="This account was created before password authentication was enabled. Please sign up with a new account or contact support to reset your password."
            )
        
        logger.debug("Verifying password...")
        if not verify_password(request.password, user.password_hash):
            # Password incorrect - increment failed attempts
            logger.warning(f"Login failed: Invalid password for user {user.id}, incrementing failed attempts")
            handle_failed_login(db, user)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Successful login - reset failed attempts and update last login
        logger.debug(f"Password verified successfully for user {user.id}")
        reset_failed_attempts(db, user)
        user.last_login = datetime.utcnow()
        # Note: db.commit() is called automatically by get_db() dependency
        
        # Generate JWT tokens
        token_data = {"sub": str(user.id), "email": user.email}
        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)
        
        # Generate CSRF token
        csrf_token = generate_csrf_token()
        store_csrf_token(csrf_token, user.id)
        
        logger.info(f"Login successful for user {user.id}, email: {user.email}")
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=30 * 60,  # 30 minutes in seconds
            user=UserResponse(
                id=user.id,
                email=user.email,
                name=user.name,
                profile_picture=user.profile_picture,
                created_at=user.created_at.isoformat(),
                last_login=user.last_login.isoformat()
            ),
            csrf_token=csrf_token
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login failed due to server error for email {request.email}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed due to server error"
        )

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Refresh access token using refresh token
    """
    try:
        # Verify refresh token
        payload = verify_token(request.refresh_token, token_type="refresh")
        user_id = int(payload.get("sub"))
        
        # Get user from database
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Generate new tokens
        token_data = {"sub": str(user.id), "email": user.email}
        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)
        
        # Generate new CSRF token
        csrf_token = generate_csrf_token()
        store_csrf_token(csrf_token, user.id)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=30 * 60,
            user=UserResponse(
                id=user.id,
                email=user.email,
                name=user.name,
                profile_picture=user.profile_picture,
                created_at=user.created_at.isoformat(),
                last_login=user.last_login.isoformat()
            ),
            csrf_token=csrf_token
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    Get current authenticated user information from JWT token
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        profile_picture=current_user.profile_picture,
        created_at=current_user.created_at.isoformat(),
        last_login=current_user.last_login.isoformat()
    )


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    institution: Optional[str] = None
    course: Optional[str] = None
    profile_metadata: Optional[dict] = None


@router.post("/profile")
async def update_user_profile(
    request: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update or create user profile information
    """
    try:
        # Get or create profile
        profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
        
        if not profile:
            profile = UserProfile(
                user_id=current_user.id,
                profile_metadata={}
            )
            db.add(profile)
        
        # Update user name if provided
        if request.name:
            current_user.name = request.name
        
        # Update profile fields
        if request.institution:
            profile.institution = request.institution
        if request.course:
            profile.course = request.course
        if request.profile_metadata:
            existing_metadata = profile.profile_metadata or {}
            existing_metadata.update(request.profile_metadata)
            profile.profile_metadata = existing_metadata
        
        db.commit()
        db.refresh(profile)
        db.refresh(current_user)
        
        return {
            "message": "Profile updated successfully",
            "profile": {
                "name": current_user.name,
                "institution": profile.institution,
                "course": profile.course,
                "profile_metadata": profile.profile_metadata
            }
        }
    except Exception as e:
        logger.error(f"Failed to update profile for user {current_user.id}: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )


@router.get("/profile")
async def get_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user profile information
    """
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    
    if not profile:
        return {
            "name": current_user.name,
            "institution": None,
            "course": None,
            "profile_metadata": None,
            "is_complete": False
        }
    
    # Check if profile is complete
    is_complete = bool(
        profile.institution and 
        profile.course and 
        profile.profile_metadata and
        profile.profile_metadata.get("year") and
        profile.profile_metadata.get("graduation_year")
    )
    
    return {
        "name": current_user.name,
        "institution": profile.institution,
        "course": profile.course,
        "profile_metadata": profile.profile_metadata,
        "is_complete": is_complete
    }
