"""Regressions for failures observed in the November production lab audit."""
import hashlib
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services.semantic_checks import semantic_failures, distributed_instructions
from app.services.browser_scenarios import normalize_v2
from app.services.dc_runtime import split_java_files
from app.services.notebook_runtime import provision_approved_cache


def events(*values):
    return '\n'.join('LABMATE_EVENT ' + json.dumps(value) for value in values)


def test_logic_gate_zero_exit_does_not_hide_wrong_predictions():
    assert semantic_failures('Implement AND and OR perceptron logic gates', 'Accuracy: 75%', 'colab')
    assert semantic_failures('Implement AND truth table', 'Predictions: [0 0 0 0] Targets: [0 0 0 1]', 'colab')
    assert not semantic_failures('Implement AND truth table', 'Accuracy: 100%\nPredictions: [0 0 0 1] Targets: [0 0 0 1]', 'colab')
    assert not semantic_failures('Image classification', 'Accuracy: 75%', 'colab')


def test_required_optimizer_and_accuracy_outcomes_cannot_silently_disappear():
    objective='Compare SGD, Adam and RMSProp. Test accuracy exceeding 95%.'
    assert not semantic_failures(objective,'SGD: 0.5\nAdam: 0.3\nRMSProp: 0.2\nTest accuracy: 96%', 'colab')
    assert not semantic_failures(objective,'SGD Adam RMSProp\nTest set accuracy on held-out images: 0.96', 'colab')
    assert semantic_failures(objective,'Adam: 0.3\nTest accuracy: 96%', 'colab')
    assert semantic_failures(objective,'SGD Adam RMSProp\nTest accuracy: 0.90', 'colab')
    assert semantic_failures(objective,'SGD Adam RMSProp', 'colab')


def test_replica_conflict_cannot_pass_even_at_equal_version():
    def state(node, value):
        return dict(type='replica_state', key='grade', node=node, value=value, version=3)
    assert semantic_failures('Replicated key-value consistency', events(state(1, 'A'), state(2, 'B')), 'distributed')
    assert not semantic_failures('Replicated key-value consistency', events(state(1, 'A'), state(2, 'A')), 'distributed')
    assert semantic_failures('Replicated key-value consistency', 'INCONSISTENCY at replica 3', 'distributed')


def test_ring_requires_balanced_nonoverlapping_participation():
    def stamp(kind, node, time):
        return dict(type=kind, node=node, time_ns=time)
    valid=[stamp('cs_enter',1,1),stamp('cs_exit',1,2),stamp('cs_enter',2,3),stamp('cs_exit',2,4)]
    assert not semantic_failures('Token ring mutual exclusion', events(*valid), 'distributed')
    valid[2]['time_ns']=1
    assert semantic_failures('Token ring mutual exclusion', events(*valid), 'distributed')
    assert semantic_failures('Token ring mutual exclusion', 'All nodes passed', 'distributed')


def test_lamport_matches_stable_ids_and_happens_before():
    send=dict(type='clock_send',node=1,clock=1,message_id='m1',target=2)
    receive=dict(type='clock_receive',node=2,clock=2,message_id='m1',source=1)
    assert not semantic_failures('Lamport logical clocks', events(send,receive), 'distributed')
    receive['message_id']='m1 from P1'
    assert semantic_failures('Lamport logical clocks', events(send,receive), 'distributed')


def test_mapreduce_checks_actual_inputs_and_election_survivors():
    result=dict(type='mapreduce_result',inputs=['red blue','red'],counts={'red':2,'blue':1})
    assert not semantic_failures('MapReduce word count', events(result), 'distributed')
    result['counts']['red']=3
    assert semantic_failures('MapReduce word count', events(result), 'distributed')
    assert semantic_failures('Bully leader election', events(dict(type='leader_elected',node=2,alive=[1,2,3])), 'distributed')


@pytest.mark.parametrize('path',['/#about','#about','?view=about','/about.html','about.html','pages/contact.html'])
def test_same_origin_navigation_is_valid(path):
    steps=[dict(action='goto',locator_type='page',locator='',role='',value=path),
           dict(action='assert_url',locator_type='page',locator='',role='',value=path)]
    assert normalize_v2([dict(version=2,name='Navigation',requirement_ids=[],steps=steps,viewport={'width':1366,'height':768})])


@pytest.mark.parametrize('path',['https://example.com','//example.com','/\\example.com','javascript:alert(1)','../private'])
def test_external_navigation_remains_rejected(path):
    with pytest.raises(ValueError):
        test_same_origin_navigation_is_valid(path)


def test_nested_public_java_class_is_not_split_out():
    source='import java.util.*;\npublic class Driver { public static class Node {} public static void main(String[] args) {} }'
    assert split_java_files(source)=={'Driver.java':source}
    files=split_java_files('import java.util.*;\npublic class A {}\npublic class B {}')
    assert set(files)=={'A.java','B.java'}
    assert all('import java.util.*;' in code for code in files.values())


def test_only_checksum_verified_cache_artifacts_enter_notebooks(tmp_path):
    cache=tmp_path/'cache'; source=cache/'keras'/'datasets'/'mnist.npz'
    source.parent.mkdir(parents=True); source.write_bytes(b'fixture-not-a-dataset')
    (cache/'manifest.json').write_text(json.dumps({'datasets/mnist.npz':hashlib.sha256(source.read_bytes()).hexdigest()}))
    work=tmp_path/'work'
    provision_approved_cache(work,cache)
    assert (work/'.keras/datasets/mnist.npz').read_bytes()==source.read_bytes()
    source.write_bytes(b'changed')
    with pytest.raises(ValueError,match='checksum'):
        provision_approved_cache(work,cache)
    (cache/'manifest.json').write_text(json.dumps({'../escape':'bad'}))
    with pytest.raises(ValueError,match='Unsafe'):
        provision_approved_cache(work,cache)


def test_catalog_counts_are_the_actual_frontend_experiments():
    from app.routers.lab_catalog import LAB_CATALOG_DATA
    source=json.loads((Path(__file__).resolve().parents[2]/'frontend/lib/lab-catalog.json').read_text(encoding='utf-8-sig'))
    assert {c['slug']:c['experiment_count'] for c in LAB_CATALOG_DATA} == {c['slug']:len(c['experiments']) for c in source}
    assert sum(c['experiment_count'] for c in LAB_CATALOG_DATA)==30
    assert 'ubuntu' not in {c['slug'] for c in LAB_CATALOG_DATA}
    cpp=next(c for c in source if c['slug']=='c-cpp')['experiments'][0]
    assert all(word in cpp['starterPrompt'].lower() for word in ('linked list','stack','binary search tree'))
    root=Path(__file__).resolve().parents[2]
    for dockerfile in (root/'Dockerfile',root/'backend/Dockerfile'):
        assert 'COPY frontend/lib/lab-catalog.json ./app/data/lab_catalog.json' in dockerfile.read_text()
        assert 'COPY rstudio/assets' in dockerfile.read_text()


def test_completed_workflow_restores_server_elapsed_time():
    from app.routers.workflows import workflow_elapsed_seconds
    start=datetime(2026,11,14,12,tzinfo=timezone.utc)
    workflow=SimpleNamespace(status='completed',updated_at=start+timedelta(seconds=73.2),
        logs=[dict(time=start.isoformat(),message='Processing requested.')])
    assert workflow_elapsed_seconds(workflow)==73.2
    workflow.logs=[]
    assert workflow_elapsed_seconds(workflow) is None


def test_resume_ignores_new_default_fields_but_honors_real_template_changes():
    from app.routers.workflows import same_questions
    original=[dict(id=1,text='Print 7',language='python')]
    current=[dict(original[0],python_template='idle',jupyter_theme='light')]
    assert same_questions(original,current)
    current[0]['python_template']='jupyter'
    assert not same_questions(original,current)


def test_generation_and_repair_share_distributed_observation_contract():
    source=Path(__file__).resolve().parents[1]/'app/services'
    assert 'distributed_instructions()' in (source/'assignment_workflow.py').read_text()
    assert 'distributed_instructions()' in (source/'analysis_service.py').read_text()
    assert 'message_id' in distributed_instructions()


def test_sql_repair_advice_preserves_linux_table_case_and_experiment_scope():
    from app.services.sql_result_checks import practical_table_checks
    from app.services.sql_instructions import sql_instructions
    checks=practical_table_checks([dict(index=1,type='INSERT',success=True,active_schema='lab',tableName='Department')])
    assert 'SELECT * FROM `Department`' in checks[0]['detail']
    advice=sql_instructions('Create Employee and Department tables and show department-wise JOIN queries.')
    assert 'Use 10 Employees' not in advice
    assert 'case-sensitive' in advice
    assert 'only the manual tables' in advice


def test_tall_notebook_sections_split_without_losing_source_or_output(tmp_path,monkeypatch):
    from app.services import colab_pipeline
    rendered=[]
    def render(cells,path,**kwargs):
        cell=cells[0]
        key='stdout' if cell.get('stdout') else 'code'
        if len(cell.get(key,'').splitlines())>5:
            raise ValueError('Colab section is too tall for readable print evidence')
        rendered.append(cell)
        return True,1100,500
    monkeypatch.setattr(colab_pipeline,'render_and_capture_colab',render)
    code='\n'.join(f'print({n})' for n in range(30))
    output='\n'.join(f'Result {n}' for n in range(30))
    frames,count=colab_pipeline.capture_colab_evidence([dict(type='code',code=code,stdout=output)],tmp_path/'frame.png')
    assert count==30
    assert [n for frame in frames if frame['kind']=='source_preview' for first,last in frame['source_ranges'] for n in range(first,last+1)]==list(range(1,31))
    assert '\n'.join(cell['stdout'] for cell in rendered if cell.get('stdout'))==output


@pytest.mark.asyncio
async def test_capture_failure_preserves_original_notebook_error(tmp_path,monkeypatch):
    from app.services import lab_capture,colab_pipeline
    class Kernel:
        def __init__(self,**kwargs):pass
        def execute_cell(self,code):return dict(type='code',code=code,stdout='Started real computation',error='ValueError: original model error')
        def cleanup(self):pass
    monkeypatch.setattr(lab_capture,'ColabPythonKernel',Kernel)
    def broken(**kwargs):raise ValueError('Colab section is too tall')
    monkeypatch.setattr(colab_pipeline,'capture_colab_evidence',broken)
    result=await lab_capture.capture_notebook('raise ValueError()',output_path=str(tmp_path/'failed.png'))
    assert not result.success
    assert 'original model error' in result.error
    assert 'Started real computation' in result.output
    assert result.stages=={'execution':'failed','capture':'unavailable'}


@pytest.mark.asyncio
async def test_first_image_preparation_does_not_mark_all_execution_unhealthy(monkeypatch):
    from unittest.mock import AsyncMock,Mock
    from app.services import railway_sandbox,assignment_workflow,worker_health
    monkeypatch.setattr(railway_sandbox,'exchange',AsyncMock(side_effect=RuntimeError('Timed out waiting for template "id" to become ready (last status: BUILDING).')))
    result=await railway_sandbox.execute({'code':'print(7)'})
    assert result.stages['preparation']=='pending'
    assert result.stages['isolation']!='failed'
    invalidate=Mock()
    monkeypatch.setattr(worker_health.worker_health,'invalidate',invalidate)
    monkeypatch.setattr(assignment_workflow.executor_service,'execute_code',AsyncMock(return_value=(False,'',result.error,0,[{'type':'execution_stages','stages':result.stages}])))
    with pytest.raises(worker_health.RuntimePreparingError,match='prepared for its first run'):
        await assignment_workflow.execute_solution('print(7)','python','Print 7','group','Student')
    invalidate.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize('failure_mode',['compile','runtime_missing','stdout_only'])
@pytest.mark.parametrize('language',['java','distributed'])
async def test_workflow_repairs_program_failures_but_not_missing_runtimes(tmp_path,monkeypatch,failure_mode,language):
    from unittest.mock import AsyncMock
    from docx import Document
    from PIL import Image
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.database import Base
    from app.models import User,UserProfile,Upload,AssignmentWorkflow
    from app.services import assignment_workflow as flow
    document=Document();document.add_paragraph('Write a Java program to print 5.')
    source=tmp_path/'manual.docx';document.save(source)
    image=tmp_path/'output.png';Image.new('RGB',(800,300),'white').save(image)
    engine=create_engine('sqlite:///'+str(tmp_path/'state.db'));Base.metadata.create_all(engine);factory=sessionmaker(bind=engine)
    with factory() as db:
        user=User(email='compiler-qa@example.test',name='Compiler Student',
            profile=UserProfile(institution='Test College',course='Computer Science',profile_metadata={'year':'4','graduation_year':'2026','roll_number':'QA03'}))
        db.add(user);db.flush()
        upload=Upload(user_id=user.id,filename='manual.docx',original_filename='manual.docx',file_path=str(source),file_type='docx',file_size=source.stat().st_size)
        db.add(upload);db.flush()
        job=AssignmentWorkflow(upload_id=upload.id,status='processing',stage='generate',language=language,questions=[dict(id=1,text='Write a Java program to print 5.',language=language)],results=[],output_name='compiler_test')
        db.add(job);db.commit();job_id=job.id
    original='public class Main { public static void main(String[] args) { MissingType x; System.out.println(5); } }'
    corrected='public class Main { public static void main(String[] args) { System.out.println(5); } }'
    if language=='distributed':
        prefix='// File: Helper.java\nclass Helper { static int value() { return 5; } }\n// File: Main.java\n'
        original=prefix+original.replace('println(5)','println(Helper.value())')
        corrected=prefix+corrected.replace('println(5)','println(Helper.value())')
    generation=AsyncMock(return_value=dict(answer='',code=original,language=language))
    repair=AsyncMock(return_value=corrected)
    repairable=failure_mode!='runtime_missing'
    first=flow.SolutionExecution(False,'FAIL: expected 700, observed 5800' if failure_mode=='stdout_only' else '',
        'cannot find symbol MissingType' if failure_mode=='compile' else 'Java runtime unavailable' if failure_mode=='runtime_missing' else '',[],None,
        {'compile':'failed' if failure_mode=='compile' else 'passed' if failure_mode=='stdout_only' else 'not_run',
         'execution':'failed' if failure_mode=='stdout_only' else 'not_run'})
    executor=AsyncMock(side_effect=[first,flow.SolutionExecution(True,'5','',[str(image)],None,{'compile':'passed','execution':'passed'})])
    monkeypatch.setattr(flow,'SessionLocal',factory)
    monkeypatch.setattr(flow.generation_service,'generate_json',generation)
    monkeypatch.setattr(flow,'repair_generated_code',repair)
    monkeypatch.setattr(flow,'execute_solution',executor)
    for name,directory in [('REPORT_DIR','reports'),('SCREENSHOT_DIR','screenshots'),('REACT_TEMP_DIR','runtime')]:monkeypatch.setattr(flow.settings,name,str(tmp_path/directory))
    await flow.process_assignment(job_id)
    with factory() as db:
        job=db.get(AssignmentWorkflow,job_id)
        assert job.status==('completed' if repairable else 'failed'),job.error
        assert job.report_id
        assert repair.await_count==(1 if repairable else 0)
        assert executor.await_count==(2 if repairable else 1)
        if failure_mode=='stdout_only':assert 'expected 700, observed 5800' in repair.call_args.args[3]
        if language=='distributed':
            plan=job.results[0]['evidence_plan']
            assert set(plan['required_source_files'])=={'Helper.java','Main.java'}
            assert set(plan['complete_source_lines'])=={'Helper.java','Main.java'}
    engine.dispose()


def test_long_screenshot_tail_cannot_push_image_beyond_printable_page(tmp_path):
    from docx import Document
    from docx.shared import Inches
    from PIL import Image
    from app.services.docx_layout import embed_screenshot
    document=Document();section=document.sections[-1]
    width=section.page_width-section.left_margin-section.right_margin
    height=section.page_height-section.top_margin-section.bottom_margin-Inches(.8)
    pixel_width=1000;limit=int(pixel_width*height/width)
    pixels=limit*2+100
    source=tmp_path/'long-evidence.png';Image.new('RGB',(pixel_width,pixels),'white').save(source)
    embed_screenshot(document,source,caption='Actual output')
    assert all(shape.height<=height for shape in document.inline_shapes)
    assert abs(sum(shape.height/shape.width*pixel_width for shape in document.inline_shapes)-pixels)<4
