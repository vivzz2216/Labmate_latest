from copy import deepcopy
import os
import shutil
from unittest.mock import AsyncMock,patch
import pytest
from PIL import Image
from app.config import settings
from app.services.runtime_engine import runtime_engine
from fixtures.app_ui_cases import FLASK_FILES,FLASK_TESTS,SWING_SOURCE,AWT_SOURCE,GUI_TESTS


@pytest.fixture
def app_environment(tmp_path,monkeypatch):
    monkeypatch.setattr(settings,'REACT_TEMP_DIR',str(tmp_path/'runtime'))
    monkeypatch.setattr(settings,'SCREENSHOT_DIR',str(tmp_path/'screenshots'))


def flask_config(files=None):
    return dict(project_type='flask',entrypoint='app.py',project_files=files or FLASK_FILES,browser_tests=FLASK_TESTS,interaction_is_required=True)


@pytest.mark.asyncio
async def test_actual_flask_get_post_validation_and_external_request_block(app_environment):
    files=deepcopy(FLASK_FILES)
    files['templates/index.html']=files['templates/index.html'].replace('</main>','<img src="https://example.invalid/private.png" alt="">\n</main>')
    with pytest.raises(ValueError,match='External'):
        await runtime_engine.execute(files['app.py'],'python',objective='Flask calculator',project_config=flask_config(files),project_files=files)
    result=await runtime_engine.execute(FLASK_FILES['app.py'],'python',objective='Flask calculator',project_config=flask_config(),project_files=FLASK_FILES)
    assert result.success,result.error
    assert result.verification['status']=='passed'
    assert len(result.verification['tests'])==2
    assert all(t['status']=='passed' for t in result.verification['tests'])
    assert result.screenshots


@pytest.mark.asyncio
async def test_wrong_flask_result_fails_with_browser_diagnostics(app_environment):
    files=deepcopy(FLASK_FILES);files['app.py']=files['app.py'].replace('str(first + second)','str(first) + str(second)')
    result=await runtime_engine.execute(files['app.py'],'python',objective='Flask calculator',project_config=flask_config(files),project_files=files)
    assert not result.success and result.verification['status']=='failed'
    assert result.screenshots


@pytest.mark.asyncio
async def test_flask_import_is_scoped_to_flask_projects(app_environment):
    result=await runtime_engine.execute(FLASK_FILES['app.py'],'python')
    assert not result.success and result.exit_code==126


@pytest.mark.skipif(os.name!='nt' and not shutil.which('xvfb-run'),reason='Private GUI display unavailable')
@pytest.mark.parametrize('source',[SWING_SOURCE,AWT_SOURCE],ids=['swing','awt'])
@pytest.mark.asyncio
async def test_actual_java_ui_handlers_and_invalid_input_capture(source,app_environment):
    config={'project_type':'java_swing' if source==SWING_SOURCE else 'java_awt','entrypoint':'Calculator.java','project_files':{'Calculator.java':source},'gui_tests':GUI_TESTS}
    result=await runtime_engine.execute(source,'java',objective='Java UI calculator',project_config=config,project_files=config['project_files'])
    assert result.success,result.error
    assert result.verification['kind']=='gui' and all(t['status']=='passed' for t in result.verification['tests'])
    for path in result.screenshots.values():
        with Image.open(path) as image:
            assert image.width>400 and image.height>200
            assert len(image.convert('RGB').getcolors(image.width*image.height))>20


@pytest.mark.skipif(os.name!='nt' and not shutil.which('xvfb-run'),reason='Private GUI display unavailable')
@pytest.mark.parametrize('defect',['wrong_result','no_handler','missing_control','preexisting_result'])
@pytest.mark.asyncio
async def test_java_gui_defects_never_become_verified(defect,app_environment):
    source=SWING_SOURCE
    if defect=='wrong_result':source=source.replace('Integer.parseInt(first.getText()) + Integer.parseInt(second.getText())','23')
    if defect=='no_handler':source=source.replace('result.setText(String.valueOf(Integer.parseInt(first.getText()) + Integer.parseInt(second.getText())));','')
    if defect=='missing_control':source=source.replace('new JButton("Add")','new JButton("Calculate")')
    if defect=='preexisting_result':source=source.replace('Result will appear here.','5').replace('result.setText(String.valueOf(Integer.parseInt(first.getText()) + Integer.parseInt(second.getText())));','')
    config={'project_type':'java_swing','entrypoint':'Calculator.java','project_files':{'Calculator.java':source},'gui_tests':GUI_TESTS[:1]}
    result=await runtime_engine.execute(source,'java',objective='Java Swing calculator',project_config=config,project_files=config['project_files'])
    if defect=='preexisting_result':
        from app.services.browser_scenarios import validate_run_coverage
        with pytest.raises(ValueError):validate_run_coverage([{'id':'calculation','kind':'behavior'}],result.verification)
    else:assert not result.success
    assert result.screenshots,'A failed interaction retains actual UI evidence.'


@pytest.mark.skipif(os.name!='nt' and not shutil.which('xvfb-run'),reason='Private GUI display unavailable')
@pytest.mark.asyncio
async def test_java_modal_dialog_is_real_and_can_be_dismissed(app_environment):
    from fixtures.app_ui_cases import step,scenario
    source=SWING_SOURCE.replace('result.setText(String.valueOf(Integer.parseInt(first.getText()) + Integer.parseInt(second.getText())));',
        'JOptionPane.showMessageDialog(frame, "5");')
    plan=deepcopy(GUI_TESTS[:1]);plan[0]['steps'] += [step('click','OK','','role','button'),step('assert_absent','5','','text')]
    config={'entrypoint':'Calculator.java','project_type':'java_swing','project_files':{'Calculator.java':source},'gui_tests':plan}
    result=await runtime_engine.execute(source,'java',objective='Java Swing calculator',project_config=config,project_files=config['project_files'])
    assert result.success,result.error
    assert result.verification['tests'][0]['assertions'][-1]['status']=='passed'


@pytest.mark.skipif(os.name!='nt' and not shutil.which('xvfb-run'),reason='Private GUI display unavailable')
@pytest.mark.asyncio
async def test_hung_gui_handler_times_out_and_retains_initial_evidence(app_environment,monkeypatch):
    source=SWING_SOURCE.replace('result.setText(String.valueOf(Integer.parseInt(first.getText()) + Integer.parseInt(second.getText())));','while(true) { Thread.onSpinWait(); }')
    monkeypatch.setattr(settings,'JAVA_GUI_TEST_TIMEOUT',2.5)
    config={'entrypoint':'Calculator.java','project_type':'java_swing','project_files':{'Calculator.java':source},'gui_tests':GUI_TESTS[:1]}
    result=await runtime_engine.execute(source,'java',objective='Java Swing calculator',project_config=config,project_files=config['project_files'])
    assert not result.success and result.screenshots
    assert 'timeout' in result.error.lower()


def test_flask_paths_and_templates_cannot_request_host_files():
    from app.security.generated_code import validate_generated_code
    for code in ['from flask import send_file\nsend_file("/etc/passwd")',
                 'from flask import Flask\napp=Flask(__name__,static_folder="/app")']:
        with pytest.raises(ValueError):validate_generated_code(code,'python',capability='flask')
    from app.services.web_project import validate_project
    files=deepcopy(FLASK_FILES);files['templates/index.html']='{{ config.__class__ }}'
    with pytest.raises(ValueError,match='introspection'):
        validate_project({'project_type':'flask','entrypoint':'app.py','files':[{'path':n,'content':c} for n,c in files.items()]})

