from pathlib import Path

import pytest
from PIL import Image

from app.services.lab_capture import capture_notebook
from app.services.evidence_planner import plan_experiment,select_evidence


@pytest.mark.asyncio
@pytest.mark.parametrize('theme,background,figure',[('dark',(19,19,20),'#1e1f20'),('light',(248,250,253),'white')])
async def test_colab_uses_one_theme_and_complete_readable_sections(tmp_path,theme,background,figure,monkeypatch):
    from app.services.notebook_runtime import ColabPythonKernel
    execute=ColabPythonKernel.execute_cell
    calls=[]
    def counted(kernel,source):
        calls.append(source)
        return execute(kernel,source)
    monkeypatch.setattr(ColabPythonKernel,'execute_cell',counted)
    # One execution produces a long cell, real printed values and a real plot.
    code='\n'.join(f'# source line {i}' for i in range(48))+'\n'+'''import matplotlib.pyplot as plt
counter=1
print('executions:',counter)
print('plot_theme:',plt.rcParams['figure.facecolor'])
plt.plot([1,2,3],[2,4,6])
plt.show()
'''
    result=await capture_notebook(code,output_path=str(tmp_path/'notebook.png'),theme=theme,source_filename='experiment.py')
    assert result.success,result.error
    assert len(calls)==1
    assert result.output==f'executions: 1\nplot_theme: {figure}'
    assert result.verification['theme']==theme
    frames=result.verification['evidence_frames']
    sources=[f for f in frames if f['kind']=='source_preview']
    assert len(sources)==3
    assert len([f for f in frames if f['kind']=='notebook'])==2
    assert sources[0]['source_ranges']==[(1,22)]
    assert sources[-1]['source_ranges'][-1][1]==len(code.splitlines())
    plan=plan_experiment('Use a Colab notebook.','colab',code)
    plan['required_source_files']=['experiment.py']
    plan['complete_source_lines']={'experiment.py':len(code.splitlines())}
    assert not select_evidence(plan,frames)['missing_requirements']
    for frame in frames:
        with Image.open(frame['path']) as image:
            assert image.width==1100 and image.height<=1408
            assert image.convert('RGB').getpixel((2,2))==background
        assert 'Colab' in frame['caption']
        assert Path(frame['path']).is_file()


def test_colab_theme_contract():
    from app.routers.workflows import QuestionInput
    from pydantic import ValidationError
    assert QuestionInput(id=1,text='Colab notebook').colab_theme=='dark'
    assert QuestionInput(id=1,text='Colab notebook',colab_theme='light').colab_theme=='light'
    with pytest.raises(ValidationError):QuestionInput(id=1,text='Colab notebook',colab_theme='unknown')
