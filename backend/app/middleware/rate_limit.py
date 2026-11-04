"""Rate limiting middleware using Redis"""
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from ..config import settings
from ..cache import redis_client
import time
import logging
import asyncio
import ipaddress
import secrets

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware to prevent abuse"""
    
    def __init__(self, app, requests_per_minute: int = None):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute or settings.RATE_LIMIT_PER_MINUTE
        self.enabled = settings.RATE_LIMIT_ENABLED
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks and static files
        if request.url.path in ["/health", "/api/health", "/health/live", "/health/ready"] or \
           request.url.path.startswith(("/static", "/_next", "/uploads", "/screenshots", "/reports")):
            return await call_next(request)
        
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)
        if not redis_client:
            logger.error("Rate limiting is enabled but Redis is unavailable")
            return JSONResponse(status_code=503, content={"error": "Rate limiting unavailable"})
        
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        # Only our authenticated frontend proxy may relay the edge's client address.
        # Never trust an arbitrary X-Forwarded-For header from a direct caller.
        if settings.TRUSTED_PROXY_KEY and secrets.compare_digest(request.headers.get('x-labmate-proxy-key', ''), settings.TRUSTED_PROXY_KEY):
            try: client_ip = str(ipaddress.ip_address(request.headers.get('x-labmate-client-ip', '')))
            except ValueError: pass
        
        # Create rate limit key
        auth=request.url.path in {'/api/basic-auth/login','/api/basic-auth/signup','/api/basic-auth/refresh'}
        limit=settings.AUTH_RATE_LIMIT_PER_MINUTE if auth else self.requests_per_minute
        rate_limit_key = f"rate_limit:{'auth' if auth else 'api'}:{client_ip}"
        
        try:
            def count_request():
                with redis_client.pipeline(transaction=True) as pipe:
                    pipe.incr(rate_limit_key)
                    pipe.expire(rate_limit_key,60,nx=True)
                    return int(pipe.execute()[0])
            current_count=await asyncio.to_thread(count_request)
            if current_count > limit:
                # Rate limit exceeded
                logger.warning(f"Rate limit exceeded for IP: {client_ip}")
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "Too many requests",
                        "message": f"Rate limit exceeded. Maximum {limit} requests per minute.",
                        "retry_after": 60
                    },
                    headers={"Retry-After": "60"}
                )
            
        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            return JSONResponse(status_code=503, content={"error": "Rate limiting unavailable"})
        
        return await call_next(request)

