from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException
from contextlib import contextmanager
from typing import Generator
from .config import settings
import logging

logger = logging.getLogger(__name__)


def effective_pool_size(configured_size: int, workflow_workers: int) -> int:
    """Connections kept per process.

    Each running workflow holds a database session for its whole run, and the claim loop and
    heartbeats need a few more. A pool smaller than the worker count makes workflows wait
    pool_timeout seconds and then fail, so never size it below the workers plus a margin.
    """
    return max(int(configured_size), int(workflow_workers) + 3)


# Check if DATABASE_URL is set
if not settings.DATABASE_URL:
    print("[WARNING] DATABASE_URL is empty. Database features will be disabled.")
    # Create a dummy engine for development
    engine = None
    SessionLocal = None
    Base = declarative_base()
else:
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    # SQLAlchemy 2.1 picks psycopg (v3) for a bare postgresql:// URL, and Railway may supply a
    # postgresql+psycopg:// URL; the image installs psycopg2, so name that driver explicitly.
    for prefix in ("postgresql://", "postgresql+psycopg://"):
        if db_url.startswith(prefix):
            db_url = "postgresql+psycopg2://" + db_url[len(prefix):]
            break

    if db_url.startswith("sqlite:"):
        # Local recovery runs can use a file database without PostgreSQL.
        from sqlalchemy import event

        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            connect_args={"check_same_thread": False, "timeout": 30},
        )

        @event.listens_for(engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=30000")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.close()
    else:
        # Production PostgreSQL pool settings.
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_recycle=300,
            pool_size=effective_pool_size(settings.DB_POOL_SIZE, settings.WORKFLOW_WORKERS),
            max_overflow=settings.DB_POOL_MAX_OVERFLOW,
            pool_timeout=30,
            echo=False,
            isolation_level="READ COMMITTED",
            connect_args={
                "connect_timeout": 5,
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
