"""Capture selected functional source without changing complete executed files."""
import hashlib
import re
from pathlib import PurePosixPath

from .screenshot_service import screenshot_service

SOURCE_SUFFIXES={'.html','.css','.js','.jsx','.cjs','.mjs','.json','.svg','.py','.java'}


def source_files(project_files,code,filename,language=None):
    if project_files:
        return [(name,text) for name,text in project_files.items()
                if PurePosixPath(name).suffix.lower() in SOURCE_SUFFIXES]
    # Match the filenames actually written by the existing console runner.
    if language=='java':
        from .runtime_engine import java_class_name
        name=java_class_name(code)
        if name:filename=name+'.java'
    elif language in {'c','cpp'}:
        from .runtime_engine import detect_cpp
        filename='solution.cpp' if detect_cpp(code,language,filename) else 'solution.c'
    elif language=='node' and not re.search(r'\.listen\s*\(|\bcreateServer\s*\(',code):
        filename='solution.mjs' if re.search(r'^\s*(?:import |export )',code,re.M) else 'solution.cjs'
    return [(filename,code)]


def source_capture_plan(project_files,code,filename,language,requested_files=None):
    files=source_files(project_files,code,filename,language)
    if language not in {'html','react','node','flask','java_gui'}:
        return {'files':files,'omitted':[],'selection':'complete console source'}
    available=dict(files)
    if requested_files is not None and (not isinstance(requested_files,list) or len(requested_files)>3
            or any(not isinstance(n,str) or n not in available for n in requested_files)):
        raise ValueError('Source capture selection must name at most three actual source files.')
    def bootstrap(name):
        text=available[name]
        return (PurePosixPath(name).stem in {'main','index'} and bool(re.search(r'createRoot|ReactDOM\.render|\bmount\s*\(',text))
                and not re.search(r'\bfunction\b|\buseState\b|<Routes\b',text))
    candidates=[n for n in available if PurePosixPath(n).suffix not in {'.svg','.json'}
                and not (language in {'react','node'} and PurePosixPath(n).suffix in {'.css','.html'})]
    functional=[n for n in candidates if not bootstrap(n)]
    candidates=functional or candidates or list(available)[:1]
    chosen=[n for n in (requested_files or []) if n in candidates]
    ai_selected=bool(chosen)
    if not chosen:
        if language=='html':
            order={'.html':0,'.js':1,'.css':2}
            chosen=sorted(candidates,key=lambda n:(order.get(PurePosixPath(n).suffix,3),n))[:3]
        else:
            # Real component/server logic takes precedence over mounting files.
            chosen=sorted(candidates,key=lambda n:(-len(available[n]),n))[:3]
    chosen=list(dict.fromkeys(chosen))
    return {'files':[(n,available[n]) for n in chosen],
            'omitted':[n for n in available if n not in chosen],
            'selection':'AI selected functional files' if ai_selected else 'primary functional source files',
            'policy':'React/Node CSS, HTML shell, assets and mounting-only files omitted from code screenshots; complete project still executed.'}


def excerpt_ranges(text):
    count=len(text.splitlines())
    return [[1,20],[count-19,count]] if count>48 else [[1,count]] if count else []


async def capture_source_evidence(project_files,code,filename,*,theme,group,username,language,screenshot_style,requested_files=None):
    plan=source_capture_plan(project_files,code,filename,language,requested_files)
    files=plan['files']
    candidates,failures=[],[]
    if not files:return [],['No executable source files were available for capture.']
    for name,text in files:
        digest=hashlib.sha256(text.encode('utf-8')).hexdigest()
        web=language in {'html','react','node','flask','java_gui'}
        ranges=excerpt_ranges(text) if web else []
        excerpt=''.join(''.join(text.splitlines(keepends=True)[start-1:end]) for start,end in ranges) if ranges else text
        ok,path,width,height=await screenshot_service.generate_screenshot(
            text,'',theme,group,username,name,view_mode='editor',presentation='vscode_evidence' if web else 'evidence',
            language=language,screenshot_style=screenshot_style,
            palette='dark' if web or screenshot_style=='style_2' else 'light',
            source_ranges=ranges if web else None,project_files=project_files)
        if not ok:
            failures.append(f'Source screenshot could not be captured completely: {name}')
            continue
        label='VS Code-style source excerpt' if web and len(ranges)>1 else 'VS Code-style source preview' if web else 'Rendered source preview'
        candidates.append({'path':path,'kind':'source_preview','caption':label+' — '+name,
                           'source_file':name,'source_sha256':digest,'source_line_count':len(text.splitlines()),
                           'source_ranges':ranges,'excerpt_sha256':hashlib.sha256(excerpt.encode()).hexdigest(),
                           'omitted_line_count':len(text.splitlines())-sum(b-a+1 for a,b in ranges) if web else 0,
                           'selection':plan['selection'],'width':width,'height':height})
    return candidates,failures
