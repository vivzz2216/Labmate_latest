import io
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from PIL import Image, ImageDraw
from docx import Document
from app.services.unix_manual import unix_manual_tasks
from app.services.manual_sections import numbered_experiments, ManualStructureError, section_language
from app.services.lab_question_filter import is_actionable_lab_question
from app.services.unix_requirements import command_coverage, runtime_diagnostics, validate_unix_semantics, required_commands

MANUAL = '''Subject: UNIX LAB
Experiment - 9A: grep/egrep script programming.
1. Aim: Implement grep.
6. Pre-Experiment Exercise:
Brief Theory:
UNWANTED THEORY
7. Laboratory Exercise
A. Procedure
Write a grep script to count matching lines.
8. Post-Experiments Exercise
A. Extended Theory:
UNWANTED EXTENSION
B. Questions:
Write a script to count files in a directory.
Experiment - 9B: Advanced filtering with AWK script programming.
Aim: Write an AWK script to print Fibonacci numbers.
'''


def test_alphanumeric_ids_and_modes_preserve_every_practical():
    for mode in ['code_only','theory_and_code']:
        tasks=unix_manual_tasks(MANUAL,mode=mode)
        assert [q['experiment_label'] for q in tasks]==['9A','9B']
        assert [q['id'] for q in tasks]==[1,2]
        assert all(q['language']=='ubuntu' for q in tasks)
        assert 'count files' in tasks[0]['text']
        assert ('UNWANTED THEORY' in tasks[0]['text'])==(mode=='theory_and_code')
        assert ('UNWANTED EXTENSION' in tasks[0]['text'])==(mode=='theory_and_code')
        assert 'UNWANTED EXTENSION' in tasks[0]['manual_text']
    generic=numbered_experiments(MANUAL)
    assert [q['experiment_label'] for q in generic]==['9A','9B']
    with pytest.raises(ManualStructureError):numbered_experiments(MANUAL+'\n'+MANUAL)


@pytest.mark.parametrize('title',['Shell scripts -I','Shell script and sed programming','grep/egrep script programming',
    'Advanced filtering with AWK script programming','Text processing using perl script programming','Basic system administrative tasks'])
def test_unix_language_routing(title):
    assert section_language(title,'Write the required scripts.')=='ubuntu'
    assert section_language('Python file processing','Use Python to count words.')=='python'
    assert section_language('Administrative tasks','Subject: UNIX LAB\nUse ps and free.')=='ubuntu'
    assert section_language('Python functions','Requirements: Ubuntu OS.\nWrite a Python function.')=='python'


def test_practical_explanation_filter_stays_scoped():
    question='Explain the following UNIX networking commands with syntax and example: ifconfig, ping, nslookup.'
    assert is_actionable_lab_question(question,'ubuntu')
    assert not is_actionable_lab_question(question,'theory')
    assert not is_actionable_lab_question('Explain the history of UNIX.','ubuntu')
    assert not is_actionable_lab_question(question,'ubuntu',excluded_section=True)


def test_echo_or_reference_does_not_satisfy_command_execution():
    objective='Explain UNIX commands with syntax and example:\nls, pwd, whoami.'
    check=command_coverage(objective,'+ echo ls pwd whoami\nls pwd whoami')
    assert check['missing']==['ls','pwd','whoami']
    check=command_coverage(objective,'+ ls\na.txt\n+ pwd\n/home/student\n+ whoami\nstudent')
    assert not check['missing']


def test_time_reserved_word_needs_real_timing_output():
    objective='UNIX commands: time, pwd, ls.'
    transcript='+ pwd\n/home/student\n+ ls\nfile.txt\nreal\t0m0.012s\nuser\t0m0.001s\nsys\t0m0.002s'
    assert 'time' not in command_coverage(objective,transcript,'time ls')['missing']
    assert 'time' in command_coverage(objective,'+ echo real','time ls')['missing']


def test_command_lists_do_not_treat_prose_find_or_file_as_commands():
    question='Write a grep script to find matched characters, words and lines in a file.'
    assert required_commands(question)==[]
    assert required_commands('Explain these commands: file, whereis, which, stat.')==['file','stat','whereis','which']
    assert required_commands('commands fdisk, mount,\numount, df, du')==['df','du','fdisk','mount','umount']


def test_source_repairs_preserve_other_tasks_and_reject_ambiguous_changes():
    from app.services.analysis_service import apply_source_edits
    source='mkdir "$work/demo"\ntouch "$work/file.txt"\necho other_task\n'
    fixed=apply_source_edits(source,[{'old':'touch "$work/file.txt"','new':'touch "$work/demo/file.txt"'}])
    assert fixed=='mkdir "$work/demo"\ntouch "$work/demo/file.txt"\necho other_task\n'
    for edits in [[],[{'old':'not present','new':'bad'}],[{'old':'echo','new':'echo'}],
                  [{'old':'echo other_task','new':'a'},{'old':'other_task','new':'b'}]]:
        with pytest.raises(ValueError):apply_source_edits(source,edits)
    with pytest.raises(ValueError):apply_source_edits('echo x\necho x',[{'old':'echo x','new':'echo y'}])


def test_failed_unix_retry_preserves_source_and_actual_sample_input():
    from app.services.assignment_workflow import saved_ubuntu_draft
    result={'id':1,'language':'ubuntu','status':'failed','code':'read n; echo "$n"',
            'verification':{'files':[{'name':'stdin.txt','text':'17\n5\n42\n'}]},'error':'capture unavailable'}
    draft=saved_ubuntu_draft(result,{'id':1})
    assert draft['code']==result['code'] and draft['stdin']=='17\n5\n42\n'
    assert saved_ubuntu_draft(result,{'id':2}) is None
    assert saved_ubuntu_draft({**result,'language':'python'},{'id':1}) is None
    assert saved_ubuntu_draft({**result,'status':'completed'},{'id':1}) is None


def test_unsupported_requirements_do_not_misreport_successful_execution():
    from app.services.evidence_planner import verification_summary,plan_experiment
    result=verification_summary(plan_experiment('Explain mount and umount.','ubuntu'),False,'Actual command output',
        {'status':'failed','execution_status':'passed','capture_status':'passed','requirements_status':'unverified'})
    assert result['status']=='failed' and result['checks']['execution']=='passed'
    assert 'remain unverified' in result['failures'][0]


def test_shell_false_pass_diagnostics_are_rejected():
    assert runtime_diagnostics('./arith.sh: line 8: [: : integer expression expected')
    assert not runtime_diagnostics('+ echo "./arith.sh: line 8: integer expression expected"')
    assert not runtime_diagnostics('mkdir: cannot create directory a/b: No such file or directory')


def test_grep_match_lengths_exclude_added_newlines():
    objective='Find the number of matched characters, words and lines.'
    with pytest.raises(ValueError,match='newlines'):
        validate_unix_semantics('grep -o "$pat" sample.txt | wc -m',objective)
    validate_unix_semantics('grep -o "$pat" sample.txt | tr -d "\\n" | wc -m',objective)
    validate_unix_semantics('wc -m < sample.txt','Count all characters in the file.')


def test_sed_duplicate_lines_does_not_mean_insert_blank_lines():
    objective='Write a sed command to duplicate each line in a file.'
    with pytest.raises(ValueError,match='blank lines'):validate_unix_semantics("sed 'G' input.txt",objective)
    validate_unix_semantics("sed 'p' input.txt",objective)
    validate_unix_semantics("sed 'h;G' input.txt",objective)


def test_julian_calendar_and_surrounding_months_are_actually_calendars():
    objective='Display a Julian calendar and Julian days. Add months before or after the current one.'
    with pytest.raises(ValueError,match='cal -j'):validate_unix_semantics('cal -y\ndate +%j',objective)
    with pytest.raises(ValueError,match='surrounding'):validate_unix_semantics('cal -j\ndate +%j',objective)
    validate_unix_semantics('cal -j\ndate +%j\ncal -B 1 -A 1',objective)


def test_mkdir_comparison_does_not_change_preconditions():
    objective='Which of these commands will work?\na. mkdir a/b/c\nb. mkdir a'
    with pytest.raises(ValueError,match='original order'):
        validate_unix_semantics('mkdir a\nmkdir a/b\nmkdir a/b/c',objective)
    validate_unix_semantics('if mkdir a/b/c; then echo unexpected; else echo expected refusal; fi\nmkdir a',objective)


def test_private_dns_fixture_answers_only_its_own_domain():
    import importlib.util, struct
    spec=importlib.util.spec_from_file_location('fixture',Path(__file__).parents[1]/'scripts/ubuntu_network_fixtures.py')
    fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)
    header=struct.pack('!HHHHHH',42,0x100,1,0,0,0)
    packet=header+b'\x07student\x03lab\0'+struct.pack('!HH',1,1)
    response=fixture.dns_reply(packet)
    assert response[:2]==packet[:2] and response[-4:]==bytes([127,0,0,2])
    assert struct.unpack('!H',response[6:8])[0]==1
    missing=fixture.dns_reply(header+b'\x06google\x03com\0'+struct.pack('!HH',1,1))
    assert struct.unpack('!H',missing[2:4])[0]&15==3
    assert not fixture.dns_reply(b'bad')


@pytest.mark.asyncio
@pytest.mark.parametrize('mode',['code_only','theory_and_code'])
async def test_workflow_calls_deterministic_unix_extractor_before_ai(mode):
    from app.services import assignment_workflow as module
    workflow=SimpleNamespace(upload_id=1,mode=mode,batch_id=None)
    upload=SimpleNamespace(file_path='fixture',file_type='docx',original_filename='manual.docx')
    session=MagicMock();session.__enter__.return_value.get.side_effect=[workflow,upload]
    generator=AsyncMock(side_effect=AssertionError('Unix extraction must not call the model'))
    with patch.object(module,'SessionLocal',return_value=session),patch.object(module,'document_text',return_value=MANUAL),\
         patch.object(module,'record'),patch.object(module.generation_service,'generate_json',generator):
        await module._extract_assignment(1)
    assert workflow.status=='ready'
    assert upload.language=='ubuntu'
    assert [q['experiment_label'] for q in workflow.questions]==['9A','9B']
    generator.assert_not_awaited()


def test_pdf_render_fallback_preserves_a_page_without_poppler(tmp_path,monkeypatch):
    from app.services.pdf_ocr import _render_without_poppler
    page=Image.new('RGB',(600,800),'white')
    ImageDraw.Draw(page).text((20,30),'Experiment 9A: UNIX commands',fill='black')
    source=tmp_path/'scan.pdf';page.save(source,'PDF')
    for no_pdfium in [False,True]:
        if no_pdfium:monkeypatch.setitem(sys.modules,'pypdfium2',None)
        _render_without_poppler(source,[1],tmp_path)
        with Image.open(tmp_path/'page-001.png') as image:
            assert image.width>0 and image.height>image.width
            assert image.convert('L').getextrema()[0]<100


def test_diagnostic_report_preserves_original_and_never_claims_success(tmp_path,monkeypatch):
    from app.config import settings
    from app.services.ubuntu_report import build_ubuntu_report
    from app.services.storage_service import storage_service
    original=Document();original.add_paragraph('ORIGINAL MANUAL MUST REMAIN');source=tmp_path/'manual.docx';original.save(source)
    monkeypatch.setattr(settings,'REPORT_DIR',str(tmp_path/'reports'))
    monkeypatch.setattr(storage_service,'sync_file',lambda path:None)
    upload=SimpleNamespace(file_type='docx',file_path=str(source),original_filename='manual.docx')
    workflow=SimpleNamespace(id=1,output_name='diagnostic',results=[{'language':'ubuntu','status':'failed',
        'question':'Experiment 2: UNIX commands','error':'Ubuntu worker unavailable.',
        'verification':{'status':'failed','execution_status':'unavailable','capture_status':'unavailable','requirements_status':'unverified'}}])
    path,_=build_ubuntu_report(upload,workflow)
    document=Document(path);text='\n'.join(p.text for p in document.paragraphs)
    assert text.index('ORIGINAL MANUAL MUST REMAIN')<text.index('Ubuntu Laboratory Results')
    assert 'Execution: unavailable' in text and 'Diagnostic report.' in text
    assert 'Execution completed.' not in text and not document.inline_shapes


def test_executed_logout_does_not_get_a_contradictory_reference():
    from app.services.ubuntu_report import add_simulated_output_section
    document=Document()
    add_simulated_output_section(document,{'verification':{
        'command_coverage':{'observed':['bash','logout']},
        'simulated_outputs':[{'command':'logout','output':'Logout not executed'},
                             {'command':'reboot','output':'Reboot not executed'}]}})
    text='\n'.join(paragraph.text for paragraph in document.paragraphs)
    assert 'Logout not executed' not in text
    assert 'Reboot not executed' in text


def test_command_report_packs_two_captures_and_preserves_private_network_notice(tmp_path,monkeypatch):
    from app.config import settings
    from app.services.ubuntu_report import build_ubuntu_report
    from app.services.storage_service import storage_service
    from PIL import Image
    source=tmp_path/'manual.docx';doc=Document();doc.add_paragraph('ORIGINAL NETWORK MANUAL');doc.save(source)
    image=tmp_path/'terminal.png';Image.new('RGB',(972,586),'#300a24').save(image)
    monkeypatch.setattr(settings,'REPORT_DIR',str(tmp_path/'reports'))
    monkeypatch.setattr(storage_service,'sync_file',lambda path:None)
    upload=SimpleNamespace(file_type='docx',file_path=str(source),original_filename='manual.docx')
    frames=[{'kind':'ubuntu_desktop','component':'terminal','path':str(image),'caption':command} for command in ['hostname','ifconfig -a']]
    workflow=SimpleNamespace(id=1,output_name='commands',results=[{'language':'ubuntu','status':'completed',
        'question':'UNIX networking commands','verification':{'status':'passed','command_mode':True,
        'network_scope':'private_loopback_fixtures','evidence_frames':frames}}])
    path,_=build_ubuntu_report(upload,workflow);result=Document(path)
    text='\n'.join(p.text for p in result.paragraphs)
    assert text.index('ORIGINAL NETWORK MANUAL')<text.index('Ubuntu Laboratory Results')
    assert 'private local DNS and WHOIS' in text and 'commands and actual recorded output' in text
    assert len(result.inline_shapes)==2
    assert result.sections[-1].page_height>result.sections[-1].page_width
    assert not next(p for p in result.paragraphs if p.text=='ifconfig -a').paragraph_format.page_break_before
