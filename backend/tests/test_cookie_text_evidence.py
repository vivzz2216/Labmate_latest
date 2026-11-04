from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

import pytest

from app.services.runtime_engine import runtime_engine
from app.services.web_project import api_tests


@pytest.mark.asyncio
async def test_plain_text_cookie_sequence_and_mismatch():
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            if self.path == '/set':
                self.send_header('Set-Cookie', 'username=student; Path=/')
            self.end_headers()
            self.wfile.write(('cookie set' if self.path == '/set' else self.headers.get('Cookie', '')).encode())
        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        tests = api_tests({'api_tests': [
            {'name':'set', 'path':'/set', 'method':'GET', 'expected_status':200, 'expected_text':'cookie set'},
            {'name':'read', 'path':'/read', 'method':'GET', 'expected_status':200, 'expected_text':'username=student'},
        ]})
        origin = f'http://127.0.0.1:{server.server_port}'
        good = await runtime_engine._capture_api(origin, tests)
        assert good.success, good.error
        tests[1]['expected_text'] = 'username=wrong'
        bad = await runtime_engine._capture_api(origin, tests)
        assert not bad.success and 'Response text' in bad.error
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
