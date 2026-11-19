"""With GLM as the main model, Groq, Gemini and the free OpenRouter route back it up in that order (2026-11-19)."""
from unittest.mock import AsyncMock, patch

import pytest

from app.config import settings
from app.services import glm_service
from app.services.generation_service import GenerationService, GenerationUnavailableError


@pytest.fixture()
def chain(monkeypatch):
    monkeypatch.setattr(settings, 'LLM_PROVIDER', 'glm')
    monkeypatch.setattr(settings, 'GLM_ENABLED', True)
    monkeypatch.setattr(settings, 'GLM_API_KEY', 'glm-key')
    monkeypatch.setattr(settings, 'GROQ_API_KEY', 'groq-key')
    monkeypatch.setattr(settings, 'GEMINI_API_KEY', 'gemini-key')
    monkeypatch.setattr(settings, 'OPENROUTER_API_KEY', 'or-key')
    monkeypatch.setattr(settings, 'FREE_LLM_FALLBACK_ORDER', 'openrouter')
    monkeypatch.setattr(settings, 'DEEPSEEK_ENABLED', False)
    service = GenerationService()
    calls = []

    def fail(name):
        async def inner(*a, **k):
            calls.append(name)
            raise GenerationUnavailableError(name + ' down')
        return inner

    def ok(name):
        async def inner(*a, **k):
            calls.append(name)
            return {'from': name}
        return inner

    return service, calls, fail, ok


@pytest.mark.asyncio
async def test_glm_failure_falls_through_groq_then_gemini_then_openrouter(chain, monkeypatch):
    service, calls, fail, ok = chain
    monkeypatch.setattr(glm_service, 'generate_glm_json', fail('glm'))
    monkeypatch.setattr(service, '_primary', AsyncMock(side_effect=fail('groq')))
    monkeypatch.setattr(service, '_gemini', AsyncMock(side_effect=fail('gemini')))
    monkeypatch.setattr(service, '_free_generation', ok('openrouter'))
    assert await service.generate_json('i', 'c', {}) == {'from': 'openrouter'}
    assert calls == ['glm', 'groq', 'gemini', 'openrouter']
    assert service._primary.await_args.kwargs['provider_override'] == 'groq'
    service._primary.assert_awaited_once()
    service._gemini.assert_awaited_once()


@pytest.mark.asyncio
async def test_groq_answers_when_glm_is_down(chain, monkeypatch):
    service, calls, fail, ok = chain
    monkeypatch.setattr(glm_service, 'generate_glm_json', fail('glm'))
    monkeypatch.setattr(service, '_primary', AsyncMock(return_value={'from': 'groq'}))
    monkeypatch.setattr(service, '_gemini', AsyncMock(return_value={'from': 'gemini'}))
    assert await service.generate_json('i', 'c', {}) == {'from': 'groq'}
    service._gemini.assert_not_awaited()


@pytest.mark.asyncio
async def test_glm_answers_without_touching_backups(chain, monkeypatch):
    service, calls, fail, ok = chain
    monkeypatch.setattr(glm_service, 'generate_glm_json', ok('glm'))
    monkeypatch.setattr(service, '_primary', AsyncMock())
    assert await service.generate_json('i', 'c', {}) == {'from': 'glm'}
    service._primary.assert_not_awaited()


def test_providers_without_keys_are_skipped(chain, monkeypatch):
    service, *_ = chain
    monkeypatch.setattr(settings, 'GEMINI_API_KEY', '')
    assert service._key_backups() == ['groq']
    monkeypatch.setattr(settings, 'GROQ_API_KEY', '')
    assert service._key_backups() == []
    assert service._route_identity('groq')[0] == 'groq' and service._route_identity('gemini')[0] == 'gemini'
