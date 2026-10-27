"""Real AWT/Swing controls on a private display, with component-render evidence.

This separates windows from the user's desktop; it is not an untrusted-code VM.
No screen-grab API ever reads the user's active desktop.
"""
import asyncio
import base64
from contextlib import contextmanager
import os
from pathlib import Path,PurePosixPath
import re
import shutil
import time
import uuid

from ..config import settings
from .browser_scenarios import normalize_v2,validate_coverage_plan

GUI_ACTIONS={'fill','click','select','screenshot','assert_visible','assert_absent','assert_value','assert_count','assert_checked'}


def normalize_gui_tests(plans):
    tests=normalize_v2(plans)
    for test in tests:
        for step in test['steps']:
            if step['action'] not in GUI_ACTIONS:raise ValueError('Unsupported Java GUI test action: '+step['action'])
            if step['action'] in {'assert_visible','assert_absent'} and step['locator_type']!='text':raise ValueError('GUI visibility assertions require expected text.')
    return tests


def validate_gui_project(config):
    from ..security.generated_code import validate_generated_code
    files=config.get('project_files',{})
    if not isinstance(files,dict) or not 1<=len(files)<=12 or sum(len(v) for v in files.values() if isinstance(v,str))>180000:raise ValueError('Java GUI projects support at most twelve bounded text files.')
    for name,source in files.items():
        path=PurePosixPath(name)
        if not isinstance(source,str) or path.is_absolute() or '..' in path.parts or ':' in name or '\\' in name or path.as_posix()!=name or path.suffix not in {'.java','.md'} or name.startswith('labmate/'):
            raise ValueError('Invalid Java GUI project filename.')
        if name.endswith('.java'):
            if re.search(r'\bpackage\s+labmate\b',source):raise ValueError('The host Java namespace is reserved.')
            validate_generated_code(source,'java')
    entry=config.get('entrypoint')
    if entry not in files or not entry.endswith('.java'):raise ValueError('Java GUI needs a supplied .java entrypoint.')
    return files


@contextmanager
def private_desktop():
    if os.name!='nt':
        yield None;return
    import ctypes
    from ctypes import wintypes
    user=ctypes.WinDLL('user32',use_last_error=True)
    user.CreateDesktopW.argtypes=[wintypes.LPCWSTR,wintypes.LPCWSTR,ctypes.c_void_p,wintypes.DWORD,wintypes.DWORD,ctypes.c_void_p]
    user.CreateDesktopW.restype=wintypes.HANDLE
    user.CloseDesktop.argtypes=[wintypes.HANDLE];user.CloseDesktop.restype=wintypes.BOOL
    name='LabMate_'+uuid.uuid4().hex
    handle=user.CreateDesktopW(name,None,None,0,0x01ff,None)
    if not handle:raise OSError(ctypes.get_last_error(),'A private Windows desktop could not be created; the active desktop will not be used.')
    try:yield 'WinSta0\\'+name
    finally:user.CloseDesktop(handle)


def decode(value):return base64.b64decode(value).decode('utf-8')


async def capture_java_gui(directory,config):
    from .runtime_engine import RuntimeResult,run_process,write_project_files,java_class_name
    files=validate_gui_project(config)
    try:tests=normalize_gui_tests(config.get('gui_tests',[]))
    except ValueError as error:
        return RuntimeResult(False,error=str(error),exit_code=2,verification={'kind':'gui','required':True,'status':'failed','tests':[]})
    if os.name!='nt' and not shutil.which('xvfb-run'):
        return RuntimeResult(False,error='Java GUI needs xvfb-run and a desktop-capable JDK. No active display will be used as a fallback.',exit_code=69)
    write_project_files(directory,files)
    source_paths=[directory/name for name in files if name.endswith('.java')]
    classes=directory/'_classes';classes.mkdir()
    harness=Path(__file__).parents[1]/'runtime/GuiHarness.java'
    compile_result=await run_process([settings.JAVAC_COMMAND,'-J-Xmx256m','-encoding','UTF-8','-d',classes,harness,*source_paths],directory,timeout=settings.COMPILATION_TIMEOUT,resource_limits={'max_memory_bytes':0,'max_cpu_seconds':min(45,settings.COMPILATION_TIMEOUT)})
    if not compile_result.success:
        compile_result.error='Compilation error: '+compile_result.error;compile_result.stages={'compile':'failed','execution':'not_run'};return compile_result
    code=files[config['entrypoint']];name=java_class_name(code)
    package=re.search(r'^\s*package\s+([\w.]+)\s*;',code,re.M)
    entry=(package[1]+'.' if package else '')+(name or '')
    if not name:return RuntimeResult(False,error='Java GUI source must declare a main class.',exit_code=2)
    screenshots={};records=[];failures=[];logs=[]
    output_dir=Path(settings.SCREENSHOT_DIR).resolve()/('java_gui_'+uuid.uuid4().hex);output_dir.mkdir(parents=True)
    deadline=time.monotonic()+settings.JAVA_GUI_TOTAL_TIMEOUT
    for index,test in enumerate(tests,1):
        plan=directory/f'_gui_plan_{index}.tsv';events=directory/f'_gui_events_{index}.tsv'
        def encoded(value):return base64.b64encode(value.encode()).decode('ascii')
        plan.write_text('\n'.join('\t'.join([step['action'],step['locator_type'],encoded(step['locator']),encoded(step['role']),encoded(step['value'])]) for step in test['steps']),encoding='utf-8')
        command=[settings.JAVA_COMMAND,'-Xmx256m','-Dfile.encoding=UTF-8','-Djava.awt.headless=false','-cp',classes,'labmate.host.GuiHarness',entry,plan,output_dir,events,str(index)]
        if os.name!='nt':command=['xvfb-run','-a','--server-args=-screen 0 1920x1600x24 -nolisten tcp',*command]
        remaining=deadline-time.monotonic()
        if remaining<=0:
            failures.append('Java GUI exceeded its total verification budget.');break
        with private_desktop() as desktop:
            run=await run_process(command,directory,timeout=min(settings.JAVA_GUI_TEST_TIMEOUT,remaining),resource_limits={'max_memory_bytes':0,'max_cpu_seconds':25},desktop=desktop)
        row={**test,'status':'failed','assertions':[],'mutations':[],'observed_text':'','expected_text':[]}
        done=False
        for event in events.read_text(encoding='utf-8').splitlines() if events.exists() else []:
            columns=event.split('\t')
            if columns[0]=='IMAGE' and len(columns)==2 and re.fullmatch(r'test_\d+(?:_step_\d+|_initial)?\.png',columns[1]):
                path=output_dir/columns[1]
                if path.is_file():screenshots[columns[1]]=str(path)
            elif columns[0]=='ASSERT' and len(columns)==7:
                row['assertions'].append({'step':int(columns[1]),'action':columns[2],'status':columns[3],'expected':decode(columns[4]),'observed':decode(columns[5]),'changed':columns[6]=='true'})
                row['expected_text'].append(decode(columns[4]))
            elif columns[0]=='ERROR':row['error']=decode(columns[2]);row['failed_step']=int(columns[1])
            elif columns[0]=='OBSERVED':row['observed_text']=decode(columns[1])
            elif columns[0]=='DONE':done=True;row['status']=columns[1]
        row['mutations']=[{'step':i,'action':s['action'],'locator':s['locator'],'value':s['value']} for i,s in enumerate(test['steps'],1) if s['action'] in {'fill','click','select'}]
        if not run.success or not done or any(a['status']!='passed' for a in row['assertions']):row['status']='failed'
        if row['status']=='failed':failures.append(row.get('error') or run.error or 'The Java GUI host did not complete verification.')
        records.append(row);logs.append(run.output)
    passed=len(records)==len(tests) and not failures
    verification={'kind':'gui','required':True,'status':'passed' if passed else 'failed','tests':records,
        'capture_method':'actual Java component print on a private desktop/display; native window chrome is excluded',
        'display_backend':'private Windows desktop' if os.name=='nt' else 'Xvfb'}
    if passed:
        from .browser_scenarios import validate_run_coverage
        try:validate_run_coverage(config.get('requirements',[]),verification)
        except ValueError as error:
            passed=False;failures.append(str(error));verification['status']='failed'
    if not screenshots:passed=False;failures.append('No real Java GUI evidence was captured.');verification['status']='failed'
    return RuntimeResult(passed,'\n'.join(logs),'\n'.join(failures),0 if passed else 1,screenshots=screenshots,verification=verification,
        stages={'compile':'passed','gui':'passed' if passed else 'failed'},timings={'compile_seconds':compile_result.timings.get('process_seconds',0)})
