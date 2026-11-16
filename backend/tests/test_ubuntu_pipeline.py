import asyncio
import ast
import base64
import io
import json
from pathlib import Path
from unittest.mock import AsyncMock
import pytest
from PIL import Image,ImageDraw
from app.config import settings
from app.services.unix_manual import unix_manual_tasks
from app.services import ubuntu_runtime as ubuntu
from app.services.runtime_engine import RuntimeResult,runtime_engine
from app.services.evidence_planner import plan_experiment,select_evidence,verification_summary
from app.services.brain_agent import make_plan
from app.routers.workflows import QuestionInput


def test_unix_lettered_sections_preserve_theory_and_installation():
    text='Subject: UNIX LAB\nExperiment — IA: Study of UNIX Operating System.\nPrepare a document on the following points.\nWhat is UNIX?\nExperiment — 1B: Installation of UNIX Operating System (Ubuntu OS).\nList down the steps to install Ubuntu OS.'
    tasks=unix_manual_tasks(text)
    assert [q['experiment_label'] for q in tasks]==['1A','1B']
    assert [q['language'] for q in tasks]==['theory','ubuntu']
    assert [q['id'] for q in tasks]==[1,2]
    assert 'List down the steps' in tasks[1]['text']
    assert QuestionInput(id=2,text=tasks[1]['text'],language='ubuntu').language=='ubuntu'


def test_unix_command_exercise_not_discarded_as_theory():
    text='UNIX LAB\nExperiment — 2: UNIX general purpose utility commands.\nA. Procedure\nExplain the following UNIX commands with syntax and example:\ncd, mkdir, gedit, ls, cal.\nB. Questions:\nTo display file size in human readable form.'
    assert unix_manual_tasks(text)[0]['language']=='ubuntu'
    assert 'human readable' in unix_manual_tasks(text)[0]['text']
    with pytest.raises(ValueError,match='Duplicate'):unix_manual_tasks(text+'\n'+text)
    assert unix_manual_tasks('Experiment 2: SQL\nSELECT 1;')==[]


@pytest.mark.asyncio
async def test_agent_chooses_native_ubuntu_tools():
    plan=await make_plan([{'id':1,'text':'UNIX LAB: implement mkdir and stat.','language':'ubuntu'}])
    task=plan['tasks'][0]
    assert task['category']=='ubuntu' and task['source_policy']=='complete'
    assert {'execute_ubuntu','capture_ubuntu_editor','capture_ubuntu_terminal'}<=set(task['tools'])


@pytest.mark.asyncio
@pytest.mark.parametrize('alias',['ubuntu','bash','shell','unix'])
async def test_aliases_go_only_to_real_vm(monkeypatch,alias):
    capture=AsyncMock(return_value=RuntimeResult(True,output='actual'))
    monkeypatch.setattr(ubuntu,'capture_ubuntu',capture)
    result=await runtime_engine.execute('pwd',alias,filename='test.sh')
    assert result.success
    capture.assert_awaited_once_with('pwd','test.sh',None,'')


@pytest.mark.asyncio
async def test_no_local_shell_fallback(monkeypatch):
    monkeypatch.setattr(settings,'UBUNTU_SSH_HOST','')
    monkeypatch.setattr(settings,'EXECUTION_ALLOWED_EMAILS','test@example.com')
    result=await ubuntu.capture_ubuntu('pwd','test.sh')
    assert not result.success and 'not configured' in result.error
    assert result.verification['status']=='failed'


class Writer:
    def __init__(self):self.request=b''
    def write(self,data):self.request+=data
    async def drain(self):pass
    def close(self):pass


def png(size=(687,522)):
    stream=io.BytesIO();im=Image.new('RGB',size,'#300a24');ImageDraw.Draw(im).rectangle((20,20,400,300),fill='white');im.save(stream,format='PNG')
    return base64.b64encode(stream.getvalue()).decode()


def blank_terminal_png(size=(647,486)):
    stream=io.BytesIO();im=Image.new('RGB',size,'#300a24');draw=ImageDraw.Draw(im)
    draw.rectangle((0,0,size[0]-1,39),fill='#4b1238')
    im.save(stream,format='PNG');return base64.b64encode(stream.getvalue()).decode()


@pytest.mark.asyncio
@pytest.mark.parametrize('case,objective,passed',[
    ('ok','Run Bash pwd.',True),('missing','Run pwd',False),('bad_image','Run pwd',False),
    ('missing_editor','Run pwd',False),
    ('blank_terminal','Run pwd',False),
    ('bad_json','Run pwd',False),('nonzero','Run pwd',False),
    ('ok','Study and implement UNIX networking commands: nslookup and whois.',False),
    ('ok','Install Ubuntu operating system.',False),('ok','Demonstrate fdisk, mount and umount.',False),
    ('ok','Inspect the private home mount namespace.',True),
    ('ok','Explain UNIX commands with syntax and example:\nls, pwd, whoami.',False),
    ('empty_output','Run Bash pwd.',False),
])
async def test_receipts_fail_closed(tmp_path,monkeypatch,case,objective,passed):
    monkeypatch.setattr(settings,'SCREENSHOT_DIR',str(tmp_path))
    monkeypatch.setattr(settings,'EXECUTION_ALLOWED_EMAILS','test@example.com')
    for name in ['UBUNTU_SSH_KEY','UBUNTU_KNOWN_HOSTS']:
        path=tmp_path/name;path.write_text('test only');monkeypatch.setattr(settings,name,str(path))
    monkeypatch.setattr(settings,'UBUNTU_SSH_HOST','127.0.0.1')
    frames=[{'kind':'source_preview','png':png(),'source_file':'test.sh','source_ranges':[[1,1]],'caption':'Actual Text Editor'},
            {'kind':'ubuntu_desktop','png':png((647,486)),'caption':'Actual Ptyxis'}]
    if case=='missing':frames=[]
    if case=='bad_image':frames[0]['png']=png((800,600))
    if case=='missing_editor':frames[0]['png']=blank_terminal_png((687,522))
    if case=='blank_terminal':frames[1]['png']=blank_terminal_png()
    receipt={'success':case!='nonzero','exit_code':1 if case=='nonzero' else 0,'output':'' if case=='empty_output' else '/home/student','frames':frames}
    process=type('Process',(),{})();process.stdin=Writer();process.stdout=asyncio.StreamReader();process.stderr=asyncio.StreamReader()
    process.stdout.feed_data(b'invalid' if case=='bad_json' else json.dumps(receipt).encode());process.stdout.feed_eof();process.stderr.feed_eof()
    process.returncode=0;process.wait=AsyncMock(return_value=0)
    create=AsyncMock(return_value=process);monkeypatch.setattr(asyncio,'create_subprocess_exec',create)
    result=await ubuntu.capture_ubuntu('pwd','test.sh',objective=objective)
    assert result.success is passed
    assert result.verification['status']==('passed' if passed else 'failed')
    if case=='missing_editor':assert 'Text Editor was not visible' in result.error
    if case=='blank_terminal':
        assert result.verification['discarded_frames']==[{'kind':'ubuntu_desktop','reason':'Blank terminal frame excluded.'}]
        assert not any(frame['kind']=='ubuntu_desktop' for frame in result.verification['evidence_frames'])
    if 'nslookup' in objective:
        assert not result.success
        assert result.verification['simulated_outputs'][0]['status']=='simulated'
        assert 'not execution evidence' in result.verification['simulated_output_notice']
    if 'fdisk' in objective:
        assert not result.success
        assert all(item['status']=='simulated' for item in result.verification['simulated_outputs'])
    assert json.loads(process.stdin.request)['code']=='pwd'
    assert 'StrictHostKeyChecking=yes' in create.call_args.args
    assert create.call_args.args[-1]=='sudo -n /usr/bin/python3 /opt/labmate/ubuntu_worker.py'
    if passed:
        plan=plan_experiment(objective,'ubuntu','pwd')
        assert not select_evidence(plan,result.verification['evidence_frames'])['missing_requirements']
        assert verification_summary(plan,True,result.output,result.verification)['status']=='execution_tested'


def test_ubuntu_requirements_do_not_claim_browser_or_database():
    plan=plan_experiment('Implement chmod and stat.','ubuntu')
    assert plan['category']=='ubuntu'
    assert {r['evidence'] for r in plan['requirements']}=={'source_preview','ubuntu_desktop'}
    assert verification_summary(plan,False,'',{'status':'failed'})['status']=='failed'


@pytest.mark.asyncio
@pytest.mark.parametrize('case',['ok','missing_step','wrong_command','wrong_exit','wrong_output','missing_frame','io_error_zero_exit','editor_is_terminal'])
async def test_interactive_command_receipts_require_every_step_and_native_frame(tmp_path,monkeypatch,case):
    monkeypatch.setattr(settings,'SCREENSHOT_DIR',str(tmp_path))
    monkeypatch.setattr(settings,'EXECUTION_ALLOWED_EMAILS','test@example.com')
    monkeypatch.setattr(settings,'UBUNTU_SSH_HOST','127.0.0.1')
    for name in ['UBUNTU_SSH_KEY','UBUNTU_KNOWN_HOSTS']:
        path=tmp_path/name;path.write_text('test only');monkeypatch.setattr(settings,name,str(path))
    plan={'version':1,'steps':[{'command':'pwd','label':'Current directory','expected':'/home/ubuntu'}]}
    observations=[{'command':'pwd','exit_code':0,'status':'passed','observed':'/home/ubuntu'}]
    frames=[{'kind':'ubuntu_desktop','component':'terminal','step':1,'png':png((972,586))}]
    if case=='missing_step':observations=[]
    if case=='wrong_command':observations[0]['command']='whoami'
    if case=='wrong_exit':observations[0]['exit_code']=1
    if case=='wrong_output':observations[0]['observed']='/root'
    if case=='missing_frame':frames=[]
    if case=='editor_is_terminal':
        plan['steps'][0].update(view='editor',view_path='practical.txt')
        frames.append({'kind':'ubuntu_desktop','component':'editor','step':1,'png':blank_terminal_png((687,522))})
    receipt={'success':True,'execution_success':True,'command_mode':True,'exit_code':0,
             'output':'/home/ubuntu','command_results':observations,'frames':frames}
    if case=='io_error_zero_exit':receipt['output']='bash: line 1: /home/ubuntu/.bash_logout: Permission denied'
    process=type('Process',(),{})();process.stdin=Writer();process.stdout=asyncio.StreamReader();process.stderr=asyncio.StreamReader()
    process.stdout.feed_data(json.dumps(receipt).encode());process.stdout.feed_eof();process.stderr.feed_eof()
    process.returncode=0;process.wait=AsyncMock(return_value=0)
    monkeypatch.setattr(asyncio,'create_subprocess_exec',AsyncMock(return_value=process))
    result=await ubuntu.capture_ubuntu('pwd',commands=plan)
    assert result.success is (case=='ok')
    assert result.verification['command_mode']
    assert not any(frame['kind']=='source_preview' for frame in result.verification['evidence_frames'])


def test_restricted_network_and_disk_outputs_are_reference_fixtures():
    from app.services.ubuntu_reference_outputs import simulated_reference_outputs
    network=simulated_reference_outputs('Study networking commands: nslookup and whois.')
    assert len(network)==2
    assert network[0]['status']=='simulated'
    assert network[0]['command']=='nslookup google.com'
    assert 'dns.google' in network[0]['output']
    assert 'not run' in network[0]['note']

    disk=simulated_reference_outputs('Demonstrate fdisk, mount and umount on a partition.')
    assert [item['status'] for item in disk]==['simulated','simulated']
    assert '/dev/vdb1' in disk[0]['output'] and 'no disk was partitioned' in disk[0]['note']
    assert '/mnt/lab' in disk[1]['output'] and 'no filesystem was mounted' in disk[1]['note']
    assert simulated_reference_outputs('Inspect the private home mount namespace.')==[]


def test_simulated_output_report_section_is_disclosed():
    from docx import Document
    from app.services.ubuntu_report import add_simulated_output_section
    document=Document()
    add_simulated_output_section(document,{'verification':{
        'simulated_output_notice':'Reference only; not execution evidence.',
        'simulated_outputs':[{'command':'nslookup google.com','output':'Server: dns.google',
                              'note':'Sample only; not run.'}],
    }})
    text='\n'.join(paragraph.text for paragraph in document.paragraphs)
    assert 'Simulated expected output - not executed' in text
    assert 'Reference only; not execution evidence.' in text
    assert 'Server: dns.google' in text and 'Sample only; not run.' in text


def test_ubuntu_instructions_continue_after_offline_network_checks_and_run_safe_users():
    instructions=ubuntu.ubuntu_instructions()
    assert 'short timeout' in instructions
    assert 'without\naborting later local checks' in instructions
    assert "inside the job's private\n/etc and home" in instructions


def test_ocr_pages_are_bounded():
    import app.services.pdf_ocr as module
    assert (Path(module.__file__).resolve().parents[1]/'scripts/windows_ocr.ps1').is_file()
    from app.services.pdf_ocr import ocr_pdf_pages
    with pytest.raises(ValueError,match='25 OCR pages'):ocr_pdf_pages('unused.pdf',list(range(1,27)))
    assert ocr_pdf_pages('unused.pdf',[])=={}


def test_unix_overview_avoids_fabricated_history():
    from app.services.unix_theory import unix_overview
    answer=unix_overview('UNIX history, flavours and architecture')
    assert '1969' in answer and '1973' in answer and 'THENIX' not in answer
    assert unix_overview('Explain a Java interface') is None


def test_native_editor_pages_preserve_long_lines_without_vertical_clipping():
    # The Linux worker imports fcntl/resource, so load only its portable pager
    # when these regression tests run on Windows.
    worker=Path(__file__).resolve().parents[1]/'scripts/ubuntu_worker.py'
    tree=ast.parse(worker.read_text())
    wanted={'SOURCE_ROWS','WRAP_COLUMNS'}
    nodes=[node for node in tree.body if
           isinstance(node,ast.FunctionDef) and node.name=='source_pages' or
           isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id in wanted for t in node.targets)]
    namespace={}
    exec(compile(ast.Module(body=nodes,type_ignores=[]),str(worker),'exec'),namespace)
    code='\n'.join(('\t'+'x'*105 if i%3==0 else 'echo '+str(i)) for i in range(70))
    pages=namespace['source_pages'](code)
    assert '\n'.join(line for _,_,lines in pages for line in lines)==code
    assert pages[0][0]==1 and pages[-1][1]==70
    assert all(left[1]+1==right[0] for left,right in zip(pages,pages[1:]))
    for _,_,lines in pages:
        assert sum(max(1,(len(line.expandtabs(8))+77)//78) for line in lines)<=23
