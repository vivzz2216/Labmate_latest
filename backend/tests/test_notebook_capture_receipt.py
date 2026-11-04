from unittest.mock import AsyncMock
import pytest


@pytest.mark.asyncio
async def test_capture_preserves_existing_execution_receipt_without_rerunning(monkeypatch,tmp_path):
    from app.services import lab_capture,colab_pipeline
    from app.services.screenshot_service import screenshot_service
    run=AsyncMock(side_effect=AssertionError('A renderer must not rerun an existing receipt'))
    monkeypatch.setattr(lab_capture,'capture_notebook',run)
    received={}
    def render(**kwargs):
        received.update(kwargs)
        return True,1600,900
    monkeypatch.setattr(colab_pipeline,'render_and_capture_colab',render)
    capture=await screenshot_service._capture_colab('print(random.random())','0.12345',str(tmp_path/'capture.png'))
    assert capture==(True,1600,900)
    assert received['cells'][0]['stdout']=='0.12345'
    run.assert_not_awaited()
