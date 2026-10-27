"""An idle browser connection cannot starve the CSP fetch connection."""
import asyncio
import socket
from urllib.request import urlopen
from urllib.parse import urlsplit

import pytest
from app.services.runtime_engine import RuntimeEngine, RuntimeResult


@pytest.mark.asyncio
async def test_html_server_handles_idle_preconnection(monkeypatch, tmp_path):
    engine = RuntimeEngine()

    async def capture(url, **kwargs):
        parsed = urlsplit(url)
        idle = socket.create_connection((parsed.hostname, parsed.port), timeout=2)
        try:
            def fetch():
                with urlopen(url, timeout=2) as response:
                    return response.read().decode()
            html = await asyncio.to_thread(fetch)
            return RuntimeResult('Preconnection proof' in html, output=html)
        finally:
            idle.close()

    monkeypatch.setattr(engine, '_capture', capture)
    result = await engine._web('<h1>Preconnection proof</h1>', 'html', tmp_path,
                              {'index.html': '<h1>Preconnection proof</h1>'}, None)
    assert result.success
