#!/usr/bin/python3
"""Trusted VM-side worker. Run only on a dedicated disposable Ubuntu VM.

Generated Bash runs in private mount/PID/network namespaces, never as
VM administrator. Native GNOME windows display the exact source and receipt.
"""
import base64
import fcntl
import json
import os
from pathlib import Path
import pwd
import re
import resource
import shutil
import shlex
import signal
import subprocess
import tempfile
import time
import uuid

MAX_OUTPUT=65536
SOURCE_ROWS=23
TERMINAL_ROWS=22
WRAP_COLUMNS=78


def source_pages(code):
    """Keep every source line readable after the native editor wraps long lines."""
    pages=[];lines=[];rows=0;first=1
    for number,line in enumerate(code.splitlines(),1):
        cost=max(1,(len(line.expandtabs(8))+WRAP_COLUMNS-1)//WRAP_COLUMNS)
        if cost>SOURCE_ROWS:raise ValueError('A source line is too long for a readable Ubuntu capture.')
        if lines and rows+cost>SOURCE_ROWS:
            pages.append((first,number-1,lines));lines=[];rows=0;first=number
        lines.append(line);rows+=cost
    if lines:pages.append((first,len(code.splitlines()),lines))
    return pages

def run(args,**kwargs):
    return subprocess.run(args,check=True,timeout=20,stdout=subprocess.PIPE,stderr=subprocess.PIPE,**kwargs)

def limits():
    os.setsid()
    for kind,limit in [(resource.RLIMIT_AS,768*1024**2),(resource.RLIMIT_CPU,30),
                       (resource.RLIMIT_FSIZE,8*1024**2),(resource.RLIMIT_CORE,0),
                       (resource.RLIMIT_NPROC,128),(resource.RLIMIT_NOFILE,128)]:
        resource.setrlimit(kind,(limit,limit))

def validate(data):
    if data.get('commands') is not None:
        from ubuntu_console import validate_plan
        steps=validate_plan(data['commands'])
        return '\n'.join(step['command'] for step in steps),'commands'
    code=data.get('code')
    name=data.get('filename','solution.sh')
    if not isinstance(code,str) or not code.strip() or len(code)>50000:raise ValueError('Ubuntu source must contain 1 to 50000 characters.')
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,100}\.sh',name):raise ValueError('Use a basename ending in .sh.')
    if not isinstance(data.get('stdin',''),str) or len(data.get('stdin',''))>8000:raise ValueError('Invalid Ubuntu stdin.')
    # These are documented instead of powering off a lab session. Namespace
    # boundaries remain the security control, never this convenience check.
    if re.search(r'(?m)(?:^|[;&|]\s*)(?:sudo\s+)?(?:reboot|shutdown|poweroff|halt)\b(?![^\n]*--help)',code):
        raise ValueError('Power-state changes require manual review; use --help to document syntax.')
    return code,name

def prepare_sandbox(folder):
    home=folder/'home';home.mkdir()
    etc=folder/'etc';shutil.copytree('/etc',etc,symlinks=True)
    for item in ['ssh','ssl/private','shadow','gshadow','sudoers','sudoers.d','profile.d']:
        p=etc/item
        if p.is_dir() and not p.is_symlink():shutil.rmtree(p)
        elif p.exists() or p.is_symlink():p.unlink()
    # Optional VM login plugins (for example Byobu) assume an interactive login
    # environment. Do not import those into a strict, deterministic student job.
    # This changes only the disposable /etc copy, never the VM's actual profiles.
    (etc/'profile.d').mkdir()
    (etc/'shadow').write_text('root:*:20000:0:99999:7:::\n');(etc/'shadow').chmod(0o600)
    (etc/'gshadow').write_text('root:*::\n');(etc/'gshadow').chmod(0o600)
    env=['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
         'HOME=/home/student','USER=root','LOGNAME=root','LANG=C.UTF-8','TERM=xterm-256color',
         'SHELLOPTS=errexit:nounset:pipefail']
    argv=['bwrap','--unshare-ipc','--unshare-pid','--unshare-net','--unshare-uts','--unshare-cgroup',
          '--die-with-parent','--new-session','--hostname','ubuntu','--cap-drop','ALL',
          '--ro-bind','/usr','/usr','--symlink','usr/bin','/bin','--symlink','usr/sbin','/sbin',
          '--symlink','usr/lib','/lib','--symlink','usr/lib64','/lib64',
          '--bind',str(etc),'/etc','--bind',str(home),'/home/student',
          '--tmpfs','/var','--dir','/var/log','--dir','/var/lib','--dir','/var/spool',
          '--tmpfs','/root','--tmpfs','/run','--tmpfs','/tmp','--proc','/proc','--remount-ro','/proc','--dev','/dev',
          '--chdir','/home/student','--clearenv']
    for value in env:argv+=['--setenv',*value.split('=',1)]
    # Namespace root can administer only its private files and processes.
    argv+=['--cap-add','CAP_NET_ADMIN','--cap-add','CAP_NET_RAW','--cap-add','CAP_CHOWN','--cap-add','CAP_SETUID',
           '--cap-add','CAP_SETGID','--cap-add','CAP_DAC_OVERRIDE']
    return home,etc,argv


def execute(data,folder):
    code,name=validate(data)
    home,etc,argv=prepare_sandbox(folder)
    (home/name).write_text(code.replace('\r\n','\n'))
    (home/'stdin.txt').write_text(data.get('stdin',''))
    argv += ['/bin/bash','-c',
           'ip link set lo up; '
           'if [ -f /usr/local/lib/labmate/ubuntu_network_fixtures.py ]; then '
           'python3 /usr/local/lib/labmate/ubuntu_network_fixtures.py /tmp/labmate-network-ready >/tmp/labmate-network.log 2>&1 & '
           'for attempt in $(seq 1 40); do [ -f /tmp/labmate-network-ready ] && break; sleep .05; done; '
           '[ -f /tmp/labmate-network-ready ] || exit 70; fi; '
           'exec /bin/bash -e -x "$1" < stdin.txt','labmate',name]
    unit='labmate-ubuntu-'+uuid.uuid4().hex
    argv=['systemd-run','--quiet','--wait','--pipe','--collect','--unit',unit,
          '-p','MemoryMax=1G','-p','TasksMax=128','-p','RuntimeMaxSec=60',
          '-p','KillMode=control-group','-p','OOMPolicy=kill',*argv]
    log=folder/'transcript.txt'
    with log.open('wb') as out:
        p=subprocess.Popen(argv,stdin=subprocess.DEVNULL,stdout=out,stderr=out,preexec_fn=limits)
        started=time.monotonic();error=''
        while p.poll() is None:
            if time.monotonic()-started>55 or log.stat().st_size>MAX_OUTPUT:
                error='Ubuntu command exceeded the execution time/output budget.'
                subprocess.run(['systemctl','stop',unit],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10)
                os.killpg(p.pid,signal.SIGKILL);p.wait();break
            time.sleep(.1)
    raw=log.read_bytes()
    if len(raw)>MAX_OUTPUT:error='Ubuntu output exceeded the evidence budget.'
    output=raw[:MAX_OUTPUT].decode('utf-8','replace')
    output=re.sub(r'\x1b\[[0-9;?]*[A-Za-z]','',output)
    output=''.join(c for c in output if c in '\n\t' or ord(c)>=32)
    snapshots=[]
    for path in sorted(home.rglob('*')):
        if len(snapshots)>=80:break
        if path.is_file() and not path.is_symlink():
            snapshots.append({'name':str(path.relative_to(home)),'mode':oct(path.stat().st_mode & 0o777),
                              'size':path.stat().st_size,'text':path.read_bytes()[:8192].decode('utf-8','replace')})
    return {'success':p.returncode==0 and not error,'exit_code':p.returncode,'output':output,
            'error':error,'files':snapshots,'seconds':round(time.monotonic()-started,3)}

def native_desktop(folder,budget=130):
    account=pwd.getpwnam('labmate')
    # A separate genuine GNOME desktop is dedicated to this controlled beta VM.
    env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':account.pw_dir,'USER':'labmate',
         'DISPLAY':':1','LANG':'C.UTF-8','LC_ALL':'C.UTF-8','XDG_RUNTIME_DIR':f'/run/user/{account.pw_uid}'}
    session=Path(account.pw_dir)/'.vnc/session.env'
    if session.exists():
        for line in session.read_text().splitlines():
            k,_,v=line.partition('=')
            if k=='DBUS_SESSION_BUS_ADDRESS':env[k]=v
    deadline=time.monotonic()+budget
    def gui(args,timeout=20,check=True):
        remaining=deadline-time.monotonic()
        if remaining<=0:raise ValueError('Ubuntu native capture exceeded its total time budget.')
        with subprocess.Popen(['/usr/sbin/runuser','-u','labmate','--',*args],env=env,
                              cwd=account.pw_dir,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True) as p:
            try:out,err=p.communicate(timeout=min(timeout,remaining))
            except subprocess.TimeoutExpired:
                os.killpg(p.pid,signal.SIGKILL);p.communicate()
                raise ValueError('Native desktop control timed out: '+args[0]) from None
            if p.returncode and check:raise ValueError('Native desktop control failed: '+err.decode('utf-8','replace')[:500])
            return subprocess.CompletedProcess(args,p.returncode,out,err)
    def find_window(title,existing=()):
        # GTK creates short-lived leader windows too. Accept only an actual
        # mapped application window with a useful client area, never its leader.
        stop=min(deadline,time.monotonic()+15)
        while time.monotonic()<stop:
            selector=['--class','[Pp]tyxis'] if title=='@ptyxis' else ['--name',re.escape(title)]
            found=gui(['xdotool','search','--onlyvisible',*selector],timeout=2,check=False)
            for wid in reversed(found.stdout.decode().splitlines()):
                if wid in existing:continue
                geometry=gui(['xdotool','getwindowgeometry','--shell',wid],timeout=2,check=False)
                values=dict(re.findall(r'^(\w+)=(\d+)$',geometry.stdout.decode(),re.M))
                if geometry.returncode==0 and int(values.get('WIDTH',0))>=400 and int(values.get('HEIGHT',0))>=200:
                    return wid
            time.sleep(.2)
        raise ValueError('The native application window did not become ready: '+title)
    def capture_window(win,path,width,height,settle=2):
        # GTK client windows include invisible CSD shadow margins. scrot -u
        # captures those margins as desktop pixels. Use the native visible bounds.
        extents=gui(['xprop','-id',win,'_GTK_FRAME_EXTENTS'],check=False).stdout.decode()
        values=re.findall(r'\d+',extents.partition('=')[2])
        left,right,top,bottom=map(int,values[:4]) if len(values)>=4 else (0,0,0,0)
        gui(['xdotool','windowactivate','--sync',win,'windowsize',win,
             str(width+left+right),str(height+top+bottom),'windowmove',win,'0','32'])
        time.sleep(settle)
        geometry=gui(['xdotool','getwindowgeometry','--shell',win]).stdout.decode()
        bounds=dict(re.findall(r'^(\w+)=(-?\d+)$',geometry,re.M))
        x=int(bounds['X'])+left;y=int(bounds['Y'])+top
        gui(['scrot','-a',f'{x},{y},{width},{height}','-o',str(path)])
    def close_windows(windows):
        for wid in reversed(windows):
            if gui(['xdotool','getwindowname',wid],timeout=2,check=False).returncode:continue
            try:gui(['xdotool','windowactivate','--sync',wid,'key','alt+F4'],timeout=3)
            except ValueError as error:
                if 'BadWindow' not in str(error):raise
    def start_gui(args):
        with (folder/'gui.log').open('ab') as log:
            return subprocess.Popen(['/usr/sbin/runuser','-u','labmate','--',*args],env=env,
                cwd=account.pw_dir,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
    def launch_window(args,title):
        last_error=''
        selector=['--class','[Pp]tyxis'] if title=='@ptyxis' else ['--name',re.escape(title)]
        existing=set(gui(['xdotool','search','--onlyvisible',*selector],check=False).stdout.decode().splitlines())
        for attempt in range(3):
            start_gui(args)
            try:return find_window(title,existing)
            except ValueError as error:
                last_error=str(error)
                if attempt<2:time.sleep(1)
        raise ValueError(last_error or 'The native application window did not become ready: '+title)
    return account,gui,launch_window,capture_window,close_windows


def capture(data,result,folder):
    account,gui,launch_window,capture_window,close_windows=native_desktop(folder)
    evidence=result.setdefault('frames',[])
    # Source pages cover all lines in the native Ubuntu Text Editor window.
    name=data.get('filename','solution.sh')
    # Editor pages use the submitted source below. Never chmod or follow a
    # student-controlled source path outside its sandbox after execution.
    os.chown(folder,account.pw_uid,account.pw_gid)
    os.chown(folder/'home',account.pw_uid,account.pw_gid)
    folder.chmod(0o755);(folder/'home').chmod(0o755)
    pages=source_pages(data['code'])
    if len(pages)>12:raise ValueError('Ubuntu source needs more than twelve readable editor frames; split the assignment.')
    for index,(first,last,lines) in enumerate(pages):
        excerpt=folder/f'{Path(name).stem}-page-{index+1}.sh'
        excerpt.write_text('\n'.join(lines)+'\n');excerpt.chmod(0o644)
        os.chown(excerpt,account.pw_uid,account.pw_gid)
        win=launch_window(['gnome-text-editor','--standalone','--ignore-session','--new-window',str(excerpt)],excerpt.name)
        gui(['xdotool','windowactivate','--sync',win])
        gui(['xdotool','key','Escape'])
        time.sleep(.8)
        path=folder/f'source-{index+1}.png';capture_window(win,path,687,522)
        evidence.append({'kind':'source_preview','caption':f'Actual Ubuntu Text Editor source, page {index+1}',
                         'source_file':name,'source_ranges':[[first,last]],
                         'png':base64.b64encode(path.read_bytes()).decode()})
        close_windows([win])
    # Feed the exact stored execution transcript to a genuine GNOME terminal.
    # Escape/control bytes were removed above; do not execute output as commands.
    text=(f'root@ubuntu:/home/student# bash {name}\n'+result['output']+
          f'\nProcess exit: {result["exit_code"]}\n'+result['error'])
    lines=[]
    import textwrap
    for line in text.splitlines():lines.extend(textwrap.wrap(line.expandtabs(8),WRAP_COLUMNS,replace_whitespace=False,drop_whitespace=False) or [''])
    chunks=[lines[i:i+TERMINAL_ROWS] for i in range(0,len(lines),TERMINAL_ROWS)] or [[]]
    terminal_budget=28-len(evidence)
    if len(chunks)>terminal_budget:
        raise ValueError(f'Ubuntu output needs {len(chunks)} terminal frames but {terminal_budget} remain in the 28-frame evidence budget; split the assignment.')
    terminal_windows=[]
    for index,chunk in enumerate(chunks):
        if index==0 and chunk and chunk[0].startswith('root@ubuntu:/home/student# '):
            chunk[0]=chunk[0].replace('root@ubuntu:/home/student# ',
                '\033[1;32mroot@ubuntu\033[0m:\033[1;34m/home/student\033[0m# ',1)
        transcript=folder/f'output-{index+1}.txt';transcript.write_text('\n'.join(chunk)+'\n');transcript.chmod(0o644)
        title='ubuntu@ubuntu: ~'
        command=shlex.join(['/bin/bash','-c',
            'printf "\\033]0;ubuntu@ubuntu: ~\\007\\033]7;file://ubuntu/home/labmate\\007"; cat -- "$1"; exec /bin/sleep 120','labmate',str(transcript)])
        win=launch_window(['ptyxis','--new-window','--working-directory=/home/labmate','-x',command],title)
        terminal_windows.append(win)
        gui(['xdotool','windowactivate','--sync',win])
        # Give Ptyxis time to paint the transcript before capture.
        time.sleep(.8)
        path=folder/f'terminal-{index+1}.png';capture_window(win,path,647,486)
        evidence.append({'kind':'ubuntu_desktop','caption':f'Ptyxis terminal displaying captured Bash transcript, page {index+1}',
                         'png':base64.b64encode(path.read_bytes()).decode()})
    close_windows(terminal_windows)
    return evidence

def main():
    if os.geteuid()!=0:raise SystemExit('Use the fixed sudo worker entrypoint on the dedicated Ubuntu VM.')
    if not Path('/home/labmate/.vnc/ready').exists():raise ValueError('The native Ubuntu desktop is starting; retry after GNOME is ready.')
    raw=os.read(0,100001)
    if len(raw)>100000:raise ValueError('Request exceeds Ubuntu worker budget.')
    # stdin is small; collect the remainder if the transport split the request.
    while not raw.endswith(b'\n'):
        chunk=os.read(0,100001-len(raw))
        if not chunk:break
        raw+=chunk
        if len(raw)>100000:raise ValueError('Request exceeds Ubuntu worker budget.')
    data=json.loads(raw)
    validate(data)
    with open('/run/labmate-ubuntu.lock','w') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise ValueError('Ubuntu VM is busy; retry when its current capture finishes.')
        with tempfile.TemporaryDirectory(prefix='labmate-ubuntu-') as directory:
            folder=Path(directory)
            if data.get('commands') is not None:
                from ubuntu_console import execute_commands
                result=execute_commands(data,folder)
            else:
                result=execute(data,folder)
                result['execution_success']=result['success']
                try:result['frames']=capture(data,result,folder)
                except Exception as error:
                    detail=(folder/'gui.log').read_text(errors='replace')[-800:] if (folder/'gui.log').exists() else ''
                    result.update(success=False,error=(result['error']+' Native desktop evidence failed: '+str(error)+' '+detail)[:2000])
            result['engine']=Path('/etc/os-release').read_text()
            print(json.dumps(result),flush=True)

if __name__=='__main__':
    try:main()
    except Exception as error:print(json.dumps({'success':False,'exit_code':1,'error':str(error)[:2000],'frames':[]}));raise SystemExit(1)
