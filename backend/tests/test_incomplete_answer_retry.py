from unittest.mock import AsyncMock
import pytest
from app.services import assignment_workflow as flow
from app.services.generation_service import GenerationError, GenerationUnavailableError

VALID={'language':'java','answer':'Prints 42.','code':'class Main {public static void main(String[] x){System.out.println(42);}}'}

@pytest.mark.asyncio
async def test_empty_solution_gets_one_regeneration(monkeypatch):
    generate=AsyncMock(side_effect=[{'language':'java','answer':'','code':''},VALID])
    monkeypatch.setattr(flow.generation_service,'generate_json',generate)
    assert await flow.generate_complete_answer('instructions','question',{}) == VALID
    assert generate.await_count == 2
    assert 'previous response omitted' in generate.call_args.args[1]

@pytest.mark.asyncio
async def test_repeated_incomplete_answers_fail_without_substitute(monkeypatch):
    generate=AsyncMock(return_value={'language':'java','answer':'','code':''})
    monkeypatch.setattr(flow.generation_service,'generate_json',generate)
    with pytest.raises(GenerationError,match='after one regeneration'):
        await flow.generate_complete_answer('instructions','question',{})
    assert generate.await_count == 2

@pytest.mark.asyncio
async def test_provider_outage_is_not_retried_here(monkeypatch):
    generate=AsyncMock(side_effect=GenerationUnavailableError('rate limited'))
    monkeypatch.setattr(flow.generation_service,'generate_json',generate)
    with pytest.raises(GenerationUnavailableError):
        await flow.generate_complete_answer('instructions','question',{})
    generate.assert_awaited_once()
