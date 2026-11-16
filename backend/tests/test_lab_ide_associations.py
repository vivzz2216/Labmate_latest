from unittest.mock import AsyncMock, patch
import pytest
from pydantic import ValidationError
from app.routers.workflows import QuestionInput
from app.services.source_evidence import capture_source_evidence

def test_ide_contract_rejects_nonexistent_templates():
    assert QuestionInput(id=1,text='Write C code',language='c',source_ide='vscode').source_ide == 'vscode'
    with pytest.raises(ValidationError):
        QuestionInput(id=1,text='Write C code',language='c',source_ide='eclipse')

@pytest.mark.asyncio
@pytest.mark.parametrize('language,filename',[('c','main.c'),('cpp','main.cpp'),('java','Main.java'),('python','main.py')])
async def test_vscode_source_selection_keeps_every_source_line(language,filename):
    capture=AsyncMock(return_value=(True,'screenshot.png',1200,800))
    code='\n'.join('// line '+str(n) for n in range(75))
    with patch('app.services.source_evidence.screenshot_service.generate_screenshot',capture):
        frames,errors=await capture_source_evidence(None,code,filename,theme='vscode',group='test',username='Student',
            language=language,screenshot_style='style_1',policy='complete')
    assert not errors and len(frames)==3
    assert all(call.kwargs['presentation']=='vscode_evidence' for call in capture.await_args_list)
    assert [frame['source_ranges'] for frame in frames]==[[[1,32]],[[33,64]],[[65,75]]]
