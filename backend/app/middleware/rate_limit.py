"""Rate limiting middleware using Redis"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from ..config import settings
from ..cache import redis_client
from ..security.jwt import rate_limit_subject
import logging
import asyncio
import ipaddress
import secrets

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware to prevent abuse"""
    
    def __init__(self, app, requests_per_minute: int = None, user_requests_per_minute: int = None):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute or settings.RATE_LIMIT_PER_MINUTE
        self.user_requests_per_minute = user_requests_per_minute or settings.USER_RATE_LIMIT_PER_MINUTE
        self.enabled = settings.RATE_LIMIT_ENABLED

    @staticmethod
    def _bearer_token(request: Request) -> str:
        header = request.headers.get('authorization', '')
        scheme, _, token = header.partition(' ')
        return token.strip() if scheme.lower() == 'bearer' else ''
    
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
        
        # Choose the bucket. Login, signup and refresh stay per-IP (there is no user yet).
        # A request carrying a validly signed access token is counted against that user, so
        # students behind one campus address do not share a bucket. Every other request,
        # including one with a forged, expired or malformed token, is counted per IP.
        auth=request.url.path in {'/api/basic-auth/login','/api/basic-auth/signup','/api/basic-auth/refresh'}
        subject = None if auth else rate_limit_subject(self._bearer_token(request))
        buckets = []  # (redis key, limit, label for logs)
        if auth:
            buckets.append((f"rate_limit:auth:{client_ip}", settings.AUTH_RATE_LIMIT_PER_MINUTE, f"IP {client_ip}"))
        elif subject is not None:
            buckets.append((f"rate_limit:user:{subject}", self.user_requests_per_minute, f"user {subject}"))
            if settings.AUTHENTICATED_IP_RATE_LIMIT_PER_MINUTE > 0:
                # A wide ceiling so one address cannot drive unlimited traffic through many accounts.
                buckets.append((f"rate_limit:ip-user:{client_ip}", settings.AUTHENTICATED_IP_RATE_LIMIT_PER_MINUTE,
                                f"IP {client_ip} (authenticated)"))
        else:
            buckets.append((f"rate_limit:api:{client_ip}", self.requests_per_minute, f"IP {client_ip}"))

        try:
            def count_request():
                with redis_client.pipeline(transaction=True) as pipe:
                    for key, _, _ in buckets:
                        pipe.incr(key)
                        pipe.expire(key, 60, nx=True)
                    results = pipe.execute()
                return [int(results[2 * index]) for index in range(len(buckets))]
            counts = await asyncio.to_thread(count_request)
            for (key, limit, label), current_count in zip(buckets, counts):
                if current_count > limit:
                    # Rate limit exceeded
                    logger.warning(f"Rate limit exceeded for {label}")
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

