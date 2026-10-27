"""Notebook execution and offline rendering; compatibility API for local runners."""
import re
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from pathlib import Path
from playwright.sync_api import sync_playwright
from .notebook_runtime import ColabPythonKernel
from .lab_resources import resource_file, allowed_resource
from .browser_capture import acquire_capture_context_sync, launch_capture_browser_sync


def ensure_home_loan_dataset(target_dir):
    from .colab_worker import ensure_home_loan_dataset as create
    return create(target_dir)


def synthesize_csv_from_code(code_text,csv_path):
    from .colab_worker import synthesize_csv_from_code as create
    return create(code_text,csv_path)


def format_natural_notebook_title(student_name=None,subject='DSLab',exp_no='6',custom_title=None):
    if custom_title:return custom_title if custom_title.endswith('.ipynb') else custom_title+'.ipynb'
    parts=(student_name or 'Student').split()
    student=re.sub(r'[^A-Za-z0-9]','',parts[0] if parts else 'Student') or 'Student'
    subject=re.sub(r'[^A-Za-z0-9_]','',subject or 'DSLab')
    return f'{subject}_{student}_Exp{exp_no}.ipynb'


def display_cell(cell):
    if not cell.get('stderr'):return dict(cell)
    return dict(cell,stdout=(cell.get('stdout','')+'\n[stderr]\n'+cell['stderr']).strip(),stderr='')


def notebook_bridge(kernel,request):
    if request.get('command')=='reset':
        kernel.reset()
        return {'type':'code','stdout':'Runtime reset','error':None,'plots':[]}
    uploads=request.get('datasets',{})
    if not isinstance(uploads,dict):raise ValueError('Datasets must be a file-content mapping.')
    for name,content in uploads.items():
        if kernel.teacher_datasets.get(name)!=content:
            kernel.upload_dataset(name,content)
    return display_cell(kernel.execute_cell(request['code']))


def render_and_capture_colab(cells,screenshot_path,notebook_title=None,student_name='Student',subject='DSLab',
        exp_no='6',datasets=None,pdf_path=None,expand_full=False,unfocus_cells=True,
        viewport_width=1600,viewport_height=900,kernel=None,timeout_sec=30,theme='dark',print_readable=False):
    if theme not in {'light','dark'}:raise ValueError('Choose a light or dark Colab theme.')
    html=resource_file('google_colab','index.html')
    Path(screenshot_path).parent.mkdir(parents=True,exist_ok=True)
    with acquire_capture_context_sync(viewport={'width':viewport_width,'height':viewport_height},service_workers='block') as context:
        context.route('**/*',lambda route:route.continue_() if allowed_resource(route.request.url,html.parent) else route.abort())
        page=context.new_page();page.set_default_timeout(max(1,int(timeout_sec*1000)))
        if kernel is not None:
            page.expose_function('pyColabBridge',lambda request:notebook_bridge(kernel,request))
        page.goto(html.as_uri(),wait_until='domcontentloaded',timeout=max(1,int(timeout_sec*1000)))
        page.wait_for_function('!!window.ColabNotebook')
        page.evaluate('(data)=>window.ColabNotebook.loadCells(data.cells,data.options)',{'cells':[display_cell(c) for c in cells],'options':{
            'title':format_natural_notebook_title(student_name,subject,exp_no,notebook_title),
            'studentName':student_name,'subject':subject,'expNo':str(exp_no),
            'datasets':{name:True for name in (datasets or {})},'expandFull':expand_full,'unfocusCells':unfocus_cells,'theme':theme,
            'runtime':{'engine':'local-python','gpu':None,'connected':kernel is not None}}})
        if print_readable:
            page.add_style_tag(content='''
                .notebook-surface {padding:14px 12px 18px 4px}
                .cell-code-highlight,.cell-code-textarea,.cell-output-content {
                    font-size:18px;line-height:27px}
                .cell-output-content table.colab-df-table {font-size:16px}
                .colab-plot-img {max-width:760px}
            ''')
            page.evaluate('document.querySelectorAll(".cell-code-textarea").forEach(el=>{el.style.height="auto";el.style.height=el.scrollHeight+"px"})')
        page.evaluate('()=>Promise.all(Array.from(document.images).map(img=>img.decode().catch(()=>{})))')
        page.wait_for_timeout(100)
        height=viewport_height
        if expand_full:
            needed=page.evaluate('Math.max(document.body.scrollHeight,document.documentElement.scrollHeight)')
            if needed>14000:raise ValueError('Notebook exceeds one screenshot; split it into smaller sections.')
            if print_readable and needed>1400:raise ValueError('Colab section is too tall for readable print evidence; split the cell or output.')
            height=max(viewport_height,needed+8 if print_readable else needed+40);page.set_viewport_size({'width':viewport_width,'height':height})
        page.screenshot(path=screenshot_path)
        if pdf_path:
            Path(pdf_path).parent.mkdir(parents=True,exist_ok=True)
            page.pdf(path=pdf_path,format='A4',print_background=True)
        return True,viewport_width,height


def capture_colab_evidence(cells,screenshot_path,source_filename='notebook.py',**metadata):
    """Render readable sections of one saved execution receipt; never rerun code."""
    target=Path(screenshot_path)
    frames=[]
    offset=0
    def capture(cell,kind,caption,**details):
        if len(frames)>=80:raise ValueError('Notebook exceeds the 80 evidence section limit.')
        path=target.with_name(f'{target.stem}_{len(frames)+1:02d}.png')
        ok,width,height=render_and_capture_colab([cell],str(path),expand_full=True,
            viewport_width=1100,viewport_height=260,print_readable=True,**metadata)
        if not ok:raise RuntimeError('Colab evidence capture failed.')
        frames.append(dict(path=str(path),kind=kind,caption=caption,width=width,height=height,**details))
    for number,cell in enumerate(cells,1):
        if cell.get('type') in {'markdown','text'}:
            capture(cell,'notebook',f'Colab notebook text — cell {number}')
            continue
        lines=cell.get('code','').splitlines() or ['']
        for start in range(0,len(lines),22):
            end=min(start+22,len(lines))
            preview={'type':'code','code':'\n'.join(lines[start:end]),'execCount':number}
            capture(preview,'source_preview',f'Colab code — cell {number}, lines {start+1}–{end}',
                source_file=source_filename,source_ranges=[(offset+start+1,offset+end)])
        offset+=len(lines)
        context={'type':'code','code':'\n'.join(lines[-3:]),'execCount':number}
        parts=[]
        for key in ('stdout','stderr','repr'):
            text=cell.get(key)
            if text:
                output_lines=str(text).splitlines()
                parts.extend({key:'\n'.join(output_lines[i:i+18])} for i in range(0,len(output_lines),18))
        if cell.get('html'):parts.append({'html':cell['html']})
        parts.extend({'plots':[plot]} for plot in cell.get('plots',[]))
        if cell.get('error'):parts.append({'error':cell['error']})
        for part,output in enumerate(parts or [{}],1):
            capture(dict(context,**output),'notebook',f'Colab execution output — cell {number}, part {part}')
    return frames,offset


class ColabExecutionQueue:
    """Bound admission and terminate a student's process when its deadline expires."""
    def __init__(self,max_workers=4,timeout_sec=45):
        if not 1<=max_workers<=16 or timeout_sec<=0:raise ValueError('Invalid notebook queue limits.')
        self.max_workers,self.timeout_sec=max_workers,timeout_sec
        self._executor=ThreadPoolExecutor(max_workers=max_workers,thread_name_prefix='notebook_job')
        self._slots=threading.BoundedSemaphore(max_workers*2)
        self._active={};self._state=threading.Lock()

    def _run(self,job,token,deadline):
        kernel=ColabPythonKernel(teacher_datasets=job.get('datasets'),timeout_sec=self.timeout_sec,
                                 allow_synthetic=bool(job.get('allow_synthetic',False)))
        with self._state:self._active[token]=kernel
        try:
            cells=[];blocks=job.get('code_blocks') or [job.get('code','')]
            if not 1<=len(blocks)<=40:raise ValueError('Notebooks require 1 to 40 cells.')
            for block in blocks:
                if isinstance(block,dict) and block.get('type') in {'markdown','text'}:cells.append(block)
                else:
                    remaining=deadline-time.monotonic()
                    if remaining<=0:raise TimeoutError('Notebook execution deadline exceeded.')
                    cells.append(kernel.execute_cell(block['code'] if isinstance(block,dict) else str(block),timeout_sec=remaining))
                    if cells[-1].get('error'):break
            remaining=deadline-time.monotonic()
            if remaining<=0:raise TimeoutError('Notebook execution deadline exceeded.')
            ok,w,h=render_and_capture_colab(cells,job['screenshot_path'],student_name=job.get('student_name','Student'),
                subject=job.get('subject','DSLab'),exp_no=job.get('exp_no','6'),notebook_title=job.get('notebook_title'),
                datasets=job.get('datasets'),pdf_path=job.get('pdf_path'),expand_full=True,kernel=kernel,timeout_sec=remaining)
            return {'success':ok and all(not c.get('error') for c in cells),'cells':cells,
                    'avatar_initial':(job.get('student_name') or 'Student').strip()[:1].upper() or 'S',
                    'student_name':job.get('student_name','Student'),'screenshot_path':job['screenshot_path'],
                    'notebook_title':format_natural_notebook_title(job.get('student_name','Student'),job.get('subject','DSLab'),job.get('exp_no','6'),job.get('notebook_title')),
                    'width':w,'height':h,'pdf_path':job.get('pdf_path')}
        except Exception as error:
            return {'success':False,'student_name':job.get('student_name','Student'),'error':str(error),'cells':locals().get('cells',[])}
        finally:
            kernel.cleanup()
            with self._state:self._active.pop(token,None)

    def _submit(self,job):
        if not self._slots.acquire(blocking=False):raise RuntimeError('Notebook queue is full; retry later.')
        token=uuid.uuid4().hex;deadline=time.monotonic()+self.timeout_sec
        future=self._executor.submit(self._run,job,token,deadline)
        future.add_done_callback(lambda _:self._slots.release())
        return job,token,deadline,future

    def _result(self,item):
        job,token,deadline,future=item
        try:return future.result(timeout=max(.001,deadline-time.monotonic()))
        except FuturesTimeoutError:
            future.cancel()
            with self._state:kernel=self._active.get(token)
            if kernel:kernel.terminate()
            return {'success':False,'student_name':job.get('student_name','Student'),'error':'Notebook execution deadline exceeded.'}
        except Exception as error:
            return {'success':False,'student_name':job.get('student_name','Student'),'error':str(error)}

    def submit_job(self,job):return self._result(self._submit(job))

    def run_batch_concurrent(self,jobs):
        results=[]
        for start in range(0,len(jobs),self.max_workers):
            pending=[self._submit(job) for job in jobs[start:start+self.max_workers]]
            results.extend(self._result(item) for item in pending)
        return results

    def close(self):
        with self._state:kernels=list(self._active.values())
        for kernel in kernels:kernel.terminate()
        self._executor.shutdown(wait=True,cancel_futures=True)
