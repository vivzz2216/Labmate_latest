"""Killable stateful notebook workers. No model/application secrets enter cells."""
import base64
import json
import os
import queue
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path


class ColabPythonKernel:
    def __init__(self, work_dir=None, teacher_datasets=None, timeout_sec=45, allow_synthetic=False, theme='dark'):
        from .isolated_runtime import require_worker
        require_worker()
        if theme not in {'light','dark'}:raise ValueError('Invalid Colab theme.')
        self.theme=theme
        initial={} if teacher_datasets is None else teacher_datasets
        self._encoded(initial)
        self._owns_work_dir = work_dir is None
        self.work_dir = str(Path(work_dir or tempfile.mkdtemp(prefix='labmate_notebook_')).resolve())
        Path(self.work_dir).mkdir(parents=True,exist_ok=True)
        self.timeout_sec = timeout_sec
        self.teacher_datasets = dict(initial)
        self.allow_synthetic = allow_synthetic
        self.exec_counter = 0
        self._process = None
        self._close_job = None
        self._lock = threading.RLock()
        self._replies = queue.Queue()

    def _start(self, deadline):
        allowed={'PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','LANG','LC_ALL'}
        environment={k:v for k,v in os.environ.items() if k.upper() in allowed}
        environment.update(LABMATE_NOTEBOOK_THEME=self.theme,TMP=self.work_dir,TEMP=self.work_dir,TMPDIR=self.work_dir,
            HOME=self.work_dir,
            MPLCONFIGDIR=str(Path(self.work_dir)/'.matplotlib'),PYTHONIOENCODING='utf-8',
            OPENBLAS_NUM_THREADS='1',OMP_NUM_THREADS='1',MKL_NUM_THREADS='1',NUMEXPR_NUM_THREADS='1')
        flags={'creationflags':subprocess.CREATE_NO_WINDOW} if os.name=='nt' else {'start_new_session':True}
        if os.name!='nt' and os.geteuid()==0:
            # Drop root privileges in the image; local non-root callers retain their UID.
            os.chown(self.work_dir,65534,65534)
            flags.update(user=65534,group=65534,extra_groups=[],umask=0o077)
        self._process=subprocess.Popen([sys.executable,'-I','-u',str(Path(__file__).with_name('colab_worker.py'))],
            stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,encoding='utf-8',
            cwd=self.work_dir,env=environment,**flags)
        if os.name=='nt':
            from .notebook_limits import attach_windows_job
            self._close_job=attach_windows_job(self._process)
        process=self._process; replies=self._replies=queue.Queue()
        def reader():
            try:
                for line in process.stdout:
                    try: replies.put(json.loads(line))
                    except ValueError: replies.put({'error':'Notebook worker returned invalid protocol data.'})
            except (OSError,ValueError):
                pass
            finally:
                replies.put({'error':'Notebook worker exited before completing the cell.'})
        threading.Thread(target=reader,daemon=True).start()
        ready=self._receive(deadline)
        if not ready.get('ready'):
            raise RuntimeError(ready.get('error','Notebook runtime could not start.'))
        if self._close_job:self._close_job.ensure_pid(ready['pid'])
        uploaded=self._send({'command':'upload','datasets':self._encoded(self.teacher_datasets),'allow_synthetic':self.allow_synthetic},deadline)
        if uploaded.get('error'):raise ValueError(uploaded['error'])

    @staticmethod
    def _encoded(datasets):
        if not isinstance(datasets,dict) or len(datasets)>20:
            raise ValueError('Supply at most 20 dataset files.')
        if any(not isinstance(name,str) or len(name)>512 or not isinstance(data,(str,bytes)) for name,data in datasets.items()):
            raise ValueError('Dataset values must be CSV text or bytes, not server file paths.')
        if any(len(data)>8*1024*1024 for data in datasets.values()):
            raise ValueError('Notebook datasets exceed the 8 MiB upload limit.')
        encoded={name: {'base64':base64.b64encode(data).decode()} if isinstance(data,bytes) else data for name,data in datasets.items()}
        if len(json.dumps(encoded,ensure_ascii=False).encode('utf-8'))>8*1024*1024:
            raise ValueError('Notebook datasets exceed the 8 MiB upload limit.')
        return encoded

    def _receive(self, deadline):
        try: return self._replies.get(timeout=max(.001,deadline-time.monotonic()))
        except queue.Empty: raise TimeoutError('Notebook execution exceeded its time limit.')

    def _send(self, request, deadline):
        if not self._process or self._process.poll() is not None:
            raise RuntimeError('Notebook runtime is stopped; reset it before running more cells.')
        self._process.stdin.write(json.dumps(request)+'\n');self._process.stdin.flush()
        return self._receive(deadline)

    def terminate(self):
        process=self._process
        self._process=None
        if process is None: return
        if self._close_job:
            self._close_job();self._close_job=None
        if process.poll() is None:
            if os.name=='nt':
                subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],capture_output=True,timeout=5,creationflags=subprocess.CREATE_NO_WINDOW)
            else:
                try: os.killpg(process.pid,signal.SIGKILL)
                except ProcessLookupError: pass
            try: process.wait(timeout=5)
            except subprocess.TimeoutExpired: process.kill();process.wait(timeout=5)
        for stream in (process.stdin,process.stdout):
            if stream: stream.close()

    def execute_cell(self, code, timeout_sec=None):
        with self._lock:
            deadline=time.monotonic()+(self.timeout_sec if timeout_sec is None else timeout_sec)
            self.exec_counter+=1
            try:
                if self._process is None: self._start(deadline)
                result=self._send({'command':'execute','code':code},deadline)
                result.setdefault('execCount',self.exec_counter)
                return result
            except (TimeoutError,RuntimeError,OSError,ValueError) as error:
                self.terminate()
                return {'type':'code','code':code,'stdout':'','stderr':'','repr':None,'html':None,'plots':[],
                        'error':str(error),'execCount':self.exec_counter,'execTime':'timeout' if isinstance(error,TimeoutError) else 'failed'}

    def reset(self):
        with self._lock:
            self.terminate();self.exec_counter=0

    def upload_dataset(self, filename, content):
        with self._lock:
            self._encoded({**self.teacher_datasets,filename:content})
            self.teacher_datasets[filename]=content
            if self._process:
                response=self._send({'command':'upload','datasets':self._encoded({filename:content}),
                                     'allow_synthetic':self.allow_synthetic},time.monotonic()+self.timeout_sec)
                if response.get('error'): raise ValueError(response['error'])

    def cleanup(self):
        self.terminate()
        if self._owns_work_dir:
            shutil.rmtree(self.work_dir,ignore_errors=True)
