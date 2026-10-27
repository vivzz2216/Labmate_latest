"""Bound bodies before multipart spooling and cap simultaneous upload parsers."""
import asyncio
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse
from ..config import settings


class RequestBodyLimitMiddleware:
    def __init__(self, app):
        self.app = app
        self.uploads = asyncio.Semaphore(4)

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        limit = settings.MAX_FILE_SIZE + 1024**2  # multipart framing included; batch total is bounded too
        headers = dict(scope.get('headers', []))
        try:
            length = int(headers.get(b'content-length', b'0'))
            if length < 0: raise ValueError
        except ValueError:
            return await JSONResponse({'detail': 'Invalid Content-Length.'}, 400)(scope, receive, send)
        if length > limit:
            return await JSONResponse({'detail': 'Request body exceeds the upload limit.'}, 413)(scope, receive, send)
        total = 0
        async def bounded_receive():
            nonlocal total
            message = await receive()
            if message['type'] == 'http.request':
                total += len(message.get('body', b''))
                if total > limit: raise HTTPException(413, 'Request body exceeds the upload limit.')
            return message
        upload = scope.get('path', '').rstrip('/').endswith(('/upload', '/batch-upload'))
        if not upload:
            return await self.app(scope, bounded_receive, send)
        if self.uploads.locked():
            return await JSONResponse({'detail': 'Upload capacity is busy. Please retry.'}, 429,
                                      headers={'Retry-After': '5'})(scope, receive, send)
        async with self.uploads:
            return await self.app(scope, bounded_receive, send)
