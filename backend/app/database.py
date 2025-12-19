from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException
from contextlib import contextmanager
from typing import Generator
from .config import settings
import os
import logging

logger = logging.getLogger(__name__)

# Check if DATABASE_URL is set
if not settings.DATABASE_URL:
    print("⚠ WARNING: DATABASE_URL is empty. Database features will be disabled.")
    # Create a dummy engine for development
    engine = None
    SessionLocal = None
    Base = declarative_base()
else:
    # Create database engine with optimized settings for 1000+ users
    # Set isolation level to READ COMMITTED to prevent dirty reads
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,          # Verify connections before use
        pool_recycle=300,            # Recycle connections every 5 minutes
        pool_size=20,                # Number of connections to maintain
        max_overflow=40,             # Maximum overflow connections
        pool_timeout=30,             # Timeout for getting connection from pool
        echo=False,                  # Set to True for debugging
        isolation_level="READ COMMITTED",  # Prevent dirty reads
        connect_args={
            "connect_timeout": 10,   # Connection timeout
            "application_name": "labmate_api"
        }
    )
    
    # Create session factory with explicit transaction management
    SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
        expire_on_commit=False  # Prevent lazy loading issues after commit
    )
    
    # Create base class for models
    Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Dependency to get database session with automatic rollback on error
    
    Yields:
        Database session
        
    Raises:
        Exception: If database is not configured
    """
    if SessionLocal is None:
        # Railway-friendly: return an HTTP error (not a crash / generic 500)
        raise HTTPException(
            status_code=503,
            detail="Database not configured. Please set DATABASE_URL in environment variables.",
        )
    
    db = SessionLocal()
    try:
        yield db
        db.commit()  # Commit if no exception occurred
    except HTTPException:
        # HTTPException is a valid FastAPI response, don't rollback or log as error
        # Just re-raise it so FastAPI can handle it properly
        raise
    except SQLAlchemyError as e:
        db.rollback()  # Rollback on database errors
        logger.error(f"Database error: {e}", exc_info=True)
        raise
    except Exception as e:
        db.rollback()  # Rollback on any other exception
        logger.error(f"Unexpected error in database session: {e}", exc_info=True)
        raise
    finally:
        db.close()


@contextmanager
def get_db_transaction() -> Generator[Session, None, None]:
    """
    Context manager for explicit transaction management with rollback on error
    
    Usage:
        with get_db_transaction() as db:
            # Perform database operations
            db.add(some_object)
            # Transaction commits automatically on exit if no exception
    """
    if SessionLocal is None:
        raise HTTPException(
            status_code=503,
            detail="Database not configured. Please set DATABASE_URL in environment variables.",
        )
    
    db = SessionLocal()
    try:
        yield db
        db.commit()
        logger.debug("Transaction committed successfully")
    except HTTPException:
        # HTTPException is a valid FastAPI response, don't rollback
        # Just re-raise it so FastAPI can handle it properly
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database transaction error, rolled back: {e}", exc_info=True)
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Transaction error, rolled back: {e}", exc_info=True)
        raise
    finally:
        db.close()
