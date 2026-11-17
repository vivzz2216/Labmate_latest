"""Refuse numeric path IDs that no database row can have.

Every table key is a 32-bit INTEGER. A larger number in a route such as ``/api/workflows/{upload_id}`` made
PostgreSQL raise "integer out of range" (SQLite: "Python int too large") and the request failed with HTTP 500.
No such row can exist, so answer 404 before the route runs.
"""
from starlette.responses import JSONResponse

MAX_ID = 2**31 - 1


class PathIdRangeMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] == 'http' and scope.get('path', '').startswith('/api/'):
            for segment in scope['path'].split('/'):
                if segment.isdigit() and segment.isascii() and (len(segment) > 10 or int(segment) > MAX_ID):
                    return await JSONResponse({'detail': 'Not found.'}, 404)(scope, receive, send)
        return await self.app(scope, receive, send)
