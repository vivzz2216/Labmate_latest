"""Response compression middleware for FastAPI"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import gzip
import json
from typing import Callable


class CompressionMiddleware(BaseHTTPMiddleware):
    """Gzip compression middleware for responses"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check if client accepts gzip encoding
        accept_encoding = request.headers.get("Accept-Encoding", "")
        
        response = await call_next(request)
        
        # Only compress if client accepts gzip and response is compressible
        if "gzip" in accept_encoding and self._should_compress(response):
            # Get response body
            response_body = b""
            async for chunk in response.body_iterator:
                response_body += chunk
            
            # Compress the body
            compressed_body = gzip.compress(response_body, compresslevel=6)
            
            # Create new response with compressed body
            return Response(
                content=compressed_body,
                status_code=response.status_code,
                headers={
                    **dict(response.headers),
                    "Content-Encoding": "gzip",
                    "Content-Length": str(len(compressed_body)),
                    "Vary": "Accept-Encoding"
                },
                media_type=response.media_type
            )
        
        return response
    
    def _should_compress(self, response: Response) -> bool:
        """Check if response should be compressed"""
        # Don't compress if already compressed
        if response.headers.get("Content-Encoding"):
            return False
        
        # Only compress text-based content types
        content_type = response.headers.get("Content-Type", "")
        compressible_types = [
            "application/json",
            "application/javascript",
            "text/html",
            "text/css",
            "text/plain",
            "text/xml",
            "application/xml"
        ]
        
        return any(ct in content_type for ct in compressible_types) and \
               int(response.headers.get("Content-Length", 0)) > 1024  # Only compress > 1KB

