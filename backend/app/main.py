from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import os
import logging
from .config import settings
from .database import engine, Base
from .routers import upload, parse, run, compose, download, analyze, tasks, assignments, basic_auth, ai_review, admin, feedback
from .middleware.rate_limit import RateLimitMiddleware
from .services.background_tasks import start_background_workers, stop_background_workers

logger = logging.getLogger(__name__)

# Create database tables with error handling
try:
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables created successfully")
except Exception as e:
    print(f"⚠ Warning: Could not create database tables: {e}")
    print("The application will continue, but database features may not work.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan - start/stop background workers"""
    # Startup
    logger.info("Starting background workers...")
    start_background_workers(num_workers=3)
    yield
    # Shutdown
    logger.info("Stopping background workers...")
    stop_background_workers()

# Create FastAPI app
app = FastAPI(
    title="LabMate AI API",
    description="Automated lab assignment processing platform",
    version="1.0.0",
    lifespan=lifespan
)

# Add compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Add rate limiting middleware (only if enabled via env var)
if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(RateLimitMiddleware)

# Configure CORS with security best practices
# In production, set ALLOWED_ORIGINS environment variable to your frontend domain
allowed_origins = settings.ALLOWED_ORIGINS if hasattr(settings, 'ALLOWED_ORIGINS') else [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # Only allow specified origins
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS if hasattr(settings, 'CORS_ALLOW_CREDENTIALS') else True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Explicit methods only
    allow_headers=["Content-Type", "Authorization", "X-Beta-Key", "X-CSRF-Token"],  # Explicit headers
    max_age=settings.CORS_MAX_AGE if hasattr(settings, 'CORS_MAX_AGE') else 600,
)

# Serve static frontend files (Next.js export)
frontend_path = "/app/frontend"
if os.path.exists(frontend_path):
    # Mount static frontend files
    app.mount("/_next", StaticFiles(directory=f"{frontend_path}/_next"), name="next")
    app.mount("/static", StaticFiles(directory=f"{frontend_path}/_next/static"), name="static")

# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Health check endpoint that returns service status, database connectivity, 
    Redis status, and performance metrics.
    FIXED: Added proper error handling for missing modules and graceful degradation.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Initialize default values in case imports fail
    redis_status = "not_configured"
    db_status = "not_configured"
    metrics = {
        "requests_total": 0,
        "avg_response_time": 0.0,
        "error_rate": 0.0
    }
    
    # Check Redis connection with error handling
    try:
        from .cache import redis_client
        if redis_client:
            try:
                redis_client.ping()
                redis_status = "healthy"
                logger.debug("Redis connection: healthy")
            except Exception as e:
                redis_status = "unhealthy"
                logger.warning(f"Redis connection failed: {e}")
        else:
            redis_status = "not_configured"
            logger.debug("Redis not configured")
    except ImportError as e:
        logger.warning(f"Redis module not available: {e}")
        redis_status = "not_configured"
    except Exception as e:
        logger.error(f"Unexpected error checking Redis: {e}")
        redis_status = "unhealthy"
    
    # Check database connection with error handling
    try:
        from .database import engine
        from sqlalchemy import text
        if engine:
            try:
                with engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                db_status = "healthy"
                logger.debug("Database connection: healthy")
            except Exception as e:
                db_status = "unhealthy"
                logger.warning(f"Database connection failed: {e}")
        else:
            db_status = "not_configured"
            logger.debug("Database not configured")
    except ImportError as e:
        logger.warning(f"Database module not available: {e}")
        db_status = "not_configured"
    except Exception as e:
        logger.error(f"Unexpected error checking database: {e}")
        db_status = "unhealthy"
    
    # Get performance metrics with error handling
    try:
        from .monitoring import performance_monitor
        metrics = performance_monitor.get_metrics()
        logger.debug(f"Performance metrics retrieved: {metrics}")
    except ImportError as e:
        logger.warning(f"Performance monitor not available: {e}")
        # Use default metrics already set above
    except Exception as e:
        logger.error(f"Error getting performance metrics: {e}")
        # Use default metrics already set above
    
    # Determine overall status
    overall_status = "healthy"
    if db_status == "unhealthy" or redis_status == "unhealthy":
        overall_status = "degraded"
    elif db_status == "not_configured" and redis_status == "not_configured":
        overall_status = "degraded"
    
    # Build response with all required fields
    response = {
        "status": overall_status,
        "message": "LabMate API is running",
        "services": {
            "database": db_status,
            "redis": redis_status
        },
        "metrics": {
            "total_requests": metrics.get("requests_total", 0),
            "avg_response_time": f"{metrics.get('avg_response_time', 0.0):.3f}s",
            "error_rate": f"{metrics.get('error_rate', 0.0)*100:.2f}%"
        }
    }
    
    logger.debug(f"Health check response: {response}")
    return response

# Root endpoint
@app.get("/")
async def root():
    return {"message": "LabMate AI API", "version": "1.0.0"}

# Create directories if they don't exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.SCREENSHOT_DIR, exist_ok=True)
os.makedirs(settings.REPORT_DIR, exist_ok=True)
os.makedirs("/app/public", exist_ok=True)

# Mount static files
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
app.mount("/screenshots", StaticFiles(directory=settings.SCREENSHOT_DIR), name="screenshots")
app.mount("/reports", StaticFiles(directory=settings.REPORT_DIR), name="reports")
app.mount("/public", StaticFiles(directory="/app/public"), name="public")

# Include routers
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(parse.router, prefix="/api", tags=["parse"])
app.include_router(run.router, prefix="/api", tags=["run"])
app.include_router(compose.router, prefix="/api", tags=["compose"])
app.include_router(download.router, prefix="/api", tags=["download"])
app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(tasks.router, prefix="/api", tags=["tasks"])
app.include_router(assignments.router, prefix="/api/assignments", tags=["assignments"])
app.include_router(basic_auth.router, prefix="/api/basic-auth", tags=["basic-auth"])
app.include_router(ai_review.router, prefix="/api/ai-review", tags=["ai-review"])
app.include_router(admin.router, prefix="/api", tags=["admin"])
app.include_router(feedback.router, prefix="/api", tags=["feedback"])

# Serve frontend for all non-API routes (must come after API routes to prevent interception)

@app.get("/api/health")
async def api_health_check():
    """
    API health check endpoint that returns API status, service name, and version.
    FIXED: Ensured all required fields (status, service, version) are returned.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    response = {
        "status": "healthy",
        "service": "LabMate AI API",
        "version": "1.0.0"
    }
    
    logger.debug(f"API health check response: {response}")
    return response

@app.get("/api/test-patterns")
async def test_patterns():
    """Test endpoint to verify question pattern matching"""
    import re
    from .services.composer_service import ComposerService
    
    composer = ComposerService()
    test_texts = [
        "1.Write a Python program to demonstrate the use of iterator and generator functions.",
        "2.Write a Python program to calculate sum of first 5 natural numbers using recursion.",
        "B. Questions/Programs:",
        "Question 1: Write a program",
        "Task 2: Demonstrate recursion"
    ]
    
    results = {}
    for text in test_texts:
        pattern_match = composer._find_question_pattern(text)
        results[text] = {
            "matched": pattern_match is not None,
            "task_number": pattern_match
        }
    
    return {"pattern_tests": results}


@app.get("/{path:path}", include_in_schema=False)
async def serve_frontend(path: str):
    """
    Serve the static frontend for any non-API route.
    FIXED: Placed after API routes so it no longer intercepts API GET requests.
    """
    if path.startswith(("api/", "health", "docs", "uploads", "screenshots", "reports", "public")):
        return {"message": "Not found"}

    frontend_index = "/app/frontend/index.html"
    if os.path.exists(frontend_index):
        try:
            with open(frontend_index, 'r', encoding='utf-8') as f:
                html = f.read()

            shim = '''<script>(function(){
try{
    if(window.WebSocket){
        var OriginalWebSocket = window.WebSocket;
        window.WebSocket = function(){
            return {
                addEventListener: function(){},
                removeEventListener: function(){},
                send: function(){},
                close: function(){},
                onopen: null, onmessage: null, onclose: null, onerror: null
            };
        };
        window.__LABMATE_STUBBED_WS = true;
        window.__LABMATE_ORIGINAL_WS = OriginalWebSocket;
    }
}catch(e){}
})();</script>'''

            if "</head>" in html:
                html = html.replace("</head>", shim + "</head>")
            else:
                html = shim + html

            return HTMLResponse(content=html, status_code=200)
        except Exception:
            return FileResponse(frontend_index)
    else:
        return {"message": "Frontend not built. Please build the frontend first."}
