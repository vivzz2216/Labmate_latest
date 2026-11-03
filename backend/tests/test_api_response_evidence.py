import httpx
import pytest

from app.services.runtime_engine import runtime_engine


@pytest.mark.asyncio
@pytest.mark.parametrize('content,content_type,expected,passed', [
    ('Hello LabMate', 'text/plain; charset=utf-8', 'Hello LabMate', True),
    ('Wrong response', 'text/plain', 'Hello LabMate', False),
    ('{"message":"Hello LabMate"}', 'application/json', {'message': 'Hello LabMate'}, True),
    ('not json', 'application/json', {'message': 'Hello LabMate'}, False),
    ('{"message":"wrong"}', 'application/json', {'message': 'Hello LabMate'}, False),
])
async def test_api_response_assertions_match_actual_content(monkeypatch, content, content_type, expected, passed):
    original = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(200, text=content, headers={'content-type': content_type}))
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kwargs: original(transport=transport, **kwargs))
    result = await runtime_engine._capture_api('http://127.0.0.1:1234', [
        {'name': 'response', 'path': '/', 'method': 'GET', 'expected_status': 200, 'expected_json': expected}
    ])
    assert result.success is passed
