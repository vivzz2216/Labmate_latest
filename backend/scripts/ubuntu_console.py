"""Sequential real terminal input and native views of an isolated Ubuntu shell."""
import base64
import json
import os
from pathlib import Path
import re
import shlex
import stat
import subprocess
import time
import uuid


def validate_plan(plan):
    if not isinstance(plan,dict) or plan.get('version')!=1:raise ValueError('Invalid Ubuntu command plan.')
    steps=plan.get('steps')
    if not isinstance(steps,list) or not 1<=len(steps)<=46:raise ValueError('Ubuntu command plans need 1 to 46 steps.')
    frames=0
    for step in steps:
        if not isinstance(step,dict):raise ValueError('Invalid command step.')
        command=step.get('command','')
        if not isinstance(command,str) or not 1<=len(command)<=240 or any(ord(c)<32 for c in command):
            raise ValueError('Enter one bounded command line at a time.')
        if re.search(r'(?m)(?:^|[;&|]\s*)(?:sudo\s+)?(?:reboot|shutdown|poweroff|halt)\b(?![^\n]*--help)',command):
            raise ValueError('Power changes are not permitted.')
        if step.get('keys',[]) not in ([],['q']):raise ValueError('Unsupported interactive key.')
        if not isinstance(step.get('input',''),str) or len(step.get('input',''))>2000 or any(ord(c)<32 and c!='\n' for c in step.get('input','')):
            raise ValueError('Invalid finite command input.')
        prompts=step.get('input_prompts')
        if prompts is not None and (not isinstance(prompts,list) or len(prompts)!=len(step.get('input','').splitlines()) or
            len(prompts)>16 or any(not isinstance(p,str) or not 1<=len(p)<=100 or any(ord(c)<32 for c in p) for p in prompts)):
            raise ValueError('Finite inputs require one bounded prompt per line.')
        if step.get('view') not in (None,'files','editor'):raise ValueError('Invalid native view.')
        path=step.get('view_path','')
        if path and (not isinstance(path,str) or path.startswith('/') or '..' in path.split('/') or '\\' in path):
            raise ValueError('Native views require a relative lab path.')
        if len(step.get('label',''))>180 or len(step.get('expected',''))>300:raise ValueError('Command metadata is too long.')
        frames+=bool(step.get('capture',True))+bool(step.get('view'))
    if frames>48:raise ValueError('The command plan exceeds 48 native evidence frames.')
    if plan.get('administrator'):
        try:from ubuntu_curriculum import validate_administrator_plan
        except ImportError:from scripts.ubuntu_curriculum import validate_administrator_plan
        validate_administrator_plan(plan)
    return steps


def read_regular(path,limit):
    descriptor=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
    with os.fdopen(descriptor,'rb') as stream:
        info=os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size>limit:raise ValueError('Unsafe or oversized console state.')
        return stream.read(limit+1)


def clean_terminal(raw):
    text=raw.decode('utf8','replace')
    text=re.sub(r'\x1b\][^\x07]*(?:\x07|\x1b\\)','',text)
    text=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',text).replace('\r','')
    text=''.join(c for c in text if c in '\n\t' or ord(c)>=32)
    return '\n'.join(line for line in text.splitlines() if not line.startswith(('Script started on','Script done on')))


def snapshot_home(home,target):
    """A native viewer gets a bounded snapshot, never a student-controlled symlink."""
    target.mkdir(mode=0o755,exist_ok=True)
    count=0
    for directory,dirs,files,descriptor in os.fwalk(home,follow_symlinks=False):
        relative=Path(directory).relative_to(home)
        if len(relative.parts)>6:dirs[:]=[];continue
        output=target/relative;output.mkdir(mode=0o755,parents=True,exist_ok=True)
        for name in files:
            if name.startswith('.'):continue
            count+=1
            if count>160:raise ValueError('Too many files for a native directory view.')
            try:
                fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=descriptor)
                with os.fdopen(fd,'rb') as stream:
                    metadata=os.fstat(stream.fileno())
                    if not stat.S_ISREG(metadata.st_mode) or metadata.st_size>1024*1024:continue
                    data=stream.read(1024*1024+1)
                if len(data)>1024*1024:continue
                path=output/name;path.write_bytes(data);path.chmod(0o444)
            except OSError:continue


def execute_commands(data,folder):
    from ubuntu_worker import prepare_sandbox,native_desktop,MAX_OUTPUT
    steps=validate_plan(data['commands'])
    administrator=data['commands'].get('administrator') is True
    home,etc,argv=prepare_sandbox(folder)
    # Give the interactive student their own account while retaining only raw
    # networking capabilities in this private network namespace.
    for filename,entry in [('passwd','ubuntu:x:1000:1000:Ubuntu Student:/home/ubuntu:/bin/bash'),
                           ('group','ubuntu:x:1000:')]:
        path=etc/filename
        rows=[line for line in path.read_text().splitlines() if line.split(':')[2]!='1000']
        path.write_text('\n'.join(rows+[entry])+'\n')
    os.chown(home,1000,1000);home.chmod(0o755)
    for name in ('Desktop','Documents','Downloads','Music','Pictures','Public','Templates','Videos'):
        path=home/name;path.mkdir();os.chown(path,1000,1000)
    argv=['/home/ubuntu' if arg=='/home/student' else arg for arg in argv]
    control=folder/'console-state';control.mkdir(mode=0o700);os.chown(control,1000,1000)
    os.mkfifo(control/'input',0o600);os.chown(control/'input',1000,1000)
    keyboard=os.open(control/'input',os.O_RDWR|os.O_NONBLOCK)
    rc=etc/'labmate-console.bashrc'
    rc.write_text("PS1='\\[\\e]0;\\u@\\h: \\w\\a\\]\\u@\\h:\\w\\$ '\nHISTFILE=/dev/null\nalias ls='ls --color=auto'\nbind 'set enable-bracketed-paste off'\n"
                  "__lab_sequence=0\n__lab_prompt() { local result=$?; __lab_sequence=$((__lab_sequence+1)); "
                  "printf '%s %s\\n%s\\n' \"$__lab_sequence\" \"$result\" \"$PWD\" > /run/labmate-console/.next; "
                  "mv /run/labmate-console/.next /run/labmate-console/ready; }\nPROMPT_COMMAND=__lab_prompt\n")
    with rc.open('a') as startup:
        startup.write("__lab_input_sequence=0\n__lab_input_line() { "
            "__lab_input_sequence=$((__lab_input_sequence+1)); "
            "builtin printf '%s\\n%s\\n' \"$__lab_input_sequence\" \"$READLINE_LINE\" > /run/labmate-console/input-line; }\n"
            "bind -x '\"\\C-x\\C-v\":__lab_input_line'\n")
    # No source or helper script is created in the student's home directory.
    # Only the exact root-owned administration curriculum can receive mount
    # capability. Arbitrary plans and generated scripts never receive it.
    if administrator:argv+=['--cap-add','CAP_FOWNER']
    if administrator and data['commands']['curriculum']=='administration':argv+=['--cap-add','CAP_SYS_ADMIN']
    identity='root' if administrator else 'ubuntu'
    privilege='exec ' if administrator else ('exec setpriv --reuid=1000 --regid=1000 --clear-groups '
        '--inh-caps=+net_raw,+net_admin --ambient-caps=+net_raw,+net_admin ')
    argv += ['--bind',str(control),'/run/labmate-console','--setenv','HOME','/home/ubuntu',
             '--setenv','USER',identity,'--setenv','LOGNAME',identity,'--unsetenv','SHELLOPTS',
             '/bin/bash','-c',
             'ip link set lo up; chmod 1777 /tmp; chmod 755 /home; '
             'python3 /usr/local/lib/labmate/ubuntu_network_fixtures.py /tmp/fixture-ready >/tmp/fixture.log 2>&1 & '
             'for attempt in $(seq 1 40); do [ -f /tmp/fixture-ready ] && break; sleep .05; done; '
             '[ -f /tmp/fixture-ready ] || exit 70; '
             +privilege+'python3 /usr/local/lib/labmate/ubuntu_terminal_bridge.py']
    token=uuid.uuid4().hex;unit='labmate-console-'+token
    ticket_root=Path('/run/labmate-console-tickets');ticket_root.mkdir(mode=0o700,exist_ok=True)
    ticket=ticket_root/token
    # The bridge owns the interactive PTY. A second systemd PTY can stop
    # forwarding keystrokes after job-control or EOF transitions.
    ticket.write_text(json.dumps({'argv':['/usr/bin/systemd-run','--quiet','--wait','--pipe','--collect','--unit',unit,
        '-p','MemoryMax=1G','-p','TasksMax=128','-p','RuntimeMaxSec=350','-p','KillMode=control-group','-p','OOMPolicy=kill',*argv]}))
    ticket.chmod(0o600)
    account,gui,launch,capture,close=native_desktop(folder,budget=360)
    os.chown(folder,account.pw_uid,account.pw_gid);folder.chmod(0o755)
    deadline=time.monotonic()+330;windows=[];frames=[];results=[];output='';error=''
    old_font=gui(['gsettings','get','org.gnome.Ptyxis','font-name']).stdout.decode().strip()
    def state():
        try:
            lines=read_regular(control/'ready',2048).decode().splitlines()
            number,exit_code=map(int,lines[0].split())
            return number,exit_code,lines[1]
        except (FileNotFoundError,ValueError,IndexError):return None
    def wait_next(previous):
        stop=min(deadline,time.monotonic()+12)
        while time.monotonic()<stop:
            current=state()
            if current and current[0]>previous:return current
            time.sleep(.08)
        raise ValueError('A command did not return to the Ubuntu prompt within its time limit.')
    def input_line():
        try:
            value=read_regular(control/'input-line',1024).decode('utf8').splitlines()
            return int(value[0]),value[1] if len(value)>1 else ''
        except (FileNotFoundError,ValueError,IndexError):return 0,''
    def submit(command):
        # PROMPT_COMMAND runs before Readline restores the terminal settings;
        # a prompt receipt alone cannot prove that queued input survived.
        # Check Readline's actual unexecuted line before sending Enter.
        for attempt in range(3):
            sequence=input_line()[0]
            os.write(keyboard,b'\x15\x0c'+command.encode('utf8')+b'\x18\x16')
            until=min(deadline,time.monotonic()+2)
            while time.monotonic()<until:
                number,line=input_line()
                if number>sequence and line==command:
                    time.sleep(.1);os.write(keyboard,b'\r');return
                time.sleep(.05)
        raise ValueError('Bash did not acknowledge the exact input line; no Enter was sent.')
    def frame(win,step,component,step_number=None):
        path=folder/f'command-{len(frames)+1}.png'
        for attempt in range(3 if component=='editor' else 1):
            gui(['xdotool','windowraise',win])
            capture(win,path,687 if component=='editor' else 972,522 if component=='editor' else 586,settle=3 if component=='editor' else 1)
            if component!='editor':break
            from PIL import Image
            with Image.open(path) as image:
                body=image.convert('L').crop((0,60,image.width,image.height))
                if sum(body.histogram()[240:])>body.width*body.height*.5:break
        else:raise ValueError('The native text editor was obscured; no source image was accepted.')
        frames.append({'kind':'ubuntu_desktop','component':component,'caption':step['label']+' — '+step['command'],
                       'step':len(results) if step_number is None else step_number,'png':base64.b64encode(path.read_bytes()).decode()})
    try:
        gui(['gsettings','set','org.gnome.Ptyxis','font-name','Ubuntu Mono 16'])
        command=shlex.join(['sudo','-n','/usr/bin/python3','/opt/labmate/ubuntu_console_launch.py',token])
        win=launch(['ptyxis','--new-window','-x',command],'@ptyxis')
        windows.append(win)
        # Fix geometry before the first command so the real PTY knows its width.
        capture(win,folder/'initial.png',972,586,settle=1)
        current=wait_next(0)
        for step in steps:
            if time.monotonic()>deadline:raise ValueError('The Ubuntu command session exceeded its total budget.')
            previous=current[0]
            offset=len(read_regular(control/'transcript',MAX_OUTPUT))
            # Send real terminal input through a private pipe into script's
            # PTY. Desktop focus and stuck modifiers cannot swallow Enter.
            # The shell itself echoes commands and produces every output.
            submit(step['command'])
            if step.get('input'):
                time.sleep(.5)
                prompt_offset=offset
                for input_index,line in enumerate(step['input'].splitlines()):
                    if step.get('input_prompts'):
                        prompt=step['input_prompts'][input_index].encode('utf8')
                        until=min(deadline,time.monotonic()+8)
                        while time.monotonic()<until:
                            pending=read_regular(control/'transcript',MAX_OUTPUT)[prompt_offset:]
                            location=pending.find(prompt)
                            if location>=0:
                                prompt_offset+=location+len(prompt);break
                            time.sleep(.08)
                        else:raise ValueError('The next finite input prompt did not appear.')
                    os.write(keyboard,line.encode('utf8')+b'\r')
                if step.get('input_eof'):os.write(keyboard,b'\x04')
            if step.get('keys'):
                time.sleep(.35)
                if step.get('capture_before_keys'):
                    frame(win,step,'terminal',len(results)+1)
                if not state() or state()[0]==previous:os.write(keyboard,b'q')
            current=wait_next(previous)
            time.sleep(.15)
            raw=read_regular(control/'transcript',MAX_OUTPUT)
            observed=clean_terminal(raw[offset:])
            passed=current[1]==0 and (not step.get('expected') or re.search(step['expected'],observed) is not None)
            results.append({'command':step['command'],'label':step['label'],'exit_code':current[1],
                            'cwd':current[2],'observed':observed,'status':'passed' if passed else 'failed'})
            if step.get('capture',True) and not step.get('capture_before_keys'):frame(win,step,'terminal')
            if not passed:raise ValueError('Command verification failed: '+step['command'])
            if step.get('view'):
                view=folder/f'view-{len(results)}'
                snapshot_home(home,view)
                path=view/step['view_path']
                if not path.exists():raise ValueError('A required desktop file is missing.')
                if step['view']=='files':args=['nautilus','--new-window',str(path)];title=path.name
                else:args=['gnome-text-editor','--standalone','--ignore-session','--new-window',str(path)];title=path.name
                other=launch(args,title);windows.append(other)
                frame(other,step,step['view']);close([other]);windows.remove(other)
        output=clean_terminal(read_regular(control/'transcript',MAX_OUTPUT))
    except Exception as exception:
        error=str(exception)+(' Command: '+steps[len(results)]['command'] if len(results)<len(steps) else '')
        if windows and len(results)<len(steps):
            try:frame(win,{**steps[len(results)],'label':'Interaction failed'},'terminal')
            except Exception:pass
        try:output=clean_terminal(read_regular(control/'transcript',MAX_OUTPUT))
        except OSError:pass
    finally:
        subprocess.run(['systemctl','stop',unit],timeout=12,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        os.close(keyboard)
        ticket.unlink(missing_ok=True)
        try:close(windows)
        finally:gui(['gsettings','set','org.gnome.Ptyxis','font-name',old_font],check=False)
    snapshots=[]
    for path in sorted(home.rglob('*')):
        if len(snapshots)>=80:break
        if path.is_file() and not path.is_symlink():
            descriptor=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
            with os.fdopen(descriptor,'rb') as stream:
                metadata=os.fstat(stream.fileno())
                if not stat.S_ISREG(metadata.st_mode):continue
                preview=stream.read(8192)
            snapshots.append({'name':str(path.relative_to(home)),'size':metadata.st_size,
                              'text':preview.decode('utf8','replace') if b'\0' not in preview else '',
                              'preview_truncated':metadata.st_size>8192})
    return {'success':not error and len(results)==len(steps),'execution_success':not error and len(results)==len(steps),
            'exit_code':0 if not error else 1,'output':output,'error':error,'frames':frames,
            'command_results':results,'command_mode':True,'files':snapshots,
            'administrative_scope':'private_namespaces_image_tmpfs' if administrator and data['commands']['curriculum']=='administration' and not error else '',
            'keyboard_tail':clean_terminal(read_regular(control/'keyboard',MAX_OUTPUT))[-500:] if (control/'keyboard').exists() else ''}
