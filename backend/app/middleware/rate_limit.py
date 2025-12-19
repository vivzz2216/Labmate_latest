"""Rate limiting middleware using Redis"""
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from ..config import settings
from ..cache import redis_client
import time
import logging

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware to prevent abuse"""
    
    def __init__(self, app, requests_per_minute: int = None):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute or settings.RATE_LIMIT_PER_MINUTE
        self.enabled = settings.RATE_LIMIT_ENABLED
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks and static files
        if request.url.path in ["/health", "/api/health"] or \
           request.url.path.startswith(("/static", "/_next", "/uploads", "/screenshots", "/reports")):
            return await call_next(request)
        
        if not self.enabled or not redis_client:
            return await call_next(request)
        
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        
        # Create rate limit key
        rate_limit_key = f"rate_limit:{client_ip}"
        
        try:
            # Get current request count
            current_count = redis_client.get(rate_limit_key)
            
            if current_count is None:
                # First request in this window
                redis_client.setex(rate_limit_key, 60, "1")
                return await call_next(request)
            
            current_count = int(current_count)
            
            if current_count >= self.requests_per_minute:
                # Rate limit exceeded
                logger.warning(f"Rate limit exceeded for IP: {client_ip}")
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "Too many requests",
                        "message": f"Rate limit exceeded. Maximum {self.requests_per_minute} requests per minute.",
                        "retry_after": 60
                    },
                    headers={"Retry-After": "60"}
                )
            
            # Increment counter
            redis_client.incr(rate_limit_key)
            
        except Exception as e:
            # If Redis fails, allow request through (fail open)
            logger.error(f"Rate limit check failed: {e}")
        
        return await call_next(request)

