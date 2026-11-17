"""Real Ubuntu VM adapter. No host-shell or simulated desktop fallback."""
import asyncio
import base64
import io
import json
import re
import uuid
from pathlib import Path
from PIL import Image,ImageStat
from ..config import settings
from .isolated_runtime import ssh_executable


def ssh_command():
    if not settings.UBUNTU_SSH_HOST or not settings.UBUNTU_SSH_KEY or not settings.UBUNTU_KNOWN_HOSTS:
        raise ValueError('Ubuntu runtime is not configured. A dedicated Ubuntu VM, SSH identity and pinned host key are required.')
    if not re.fullmatch(r'[A-Za-z0-9_.:-]+',settings.UBUNTU_SSH_HOST) or settings.UBUNTU_SSH_HOST.startswith('-'):
        raise ValueError('Invalid Ubuntu SSH host.')
    if not re.fullmatch(r'[a-z_][a-z0-9_-]{0,31}',settings.UBUNTU_SSH_USER):raise ValueError('Invalid Ubuntu SSH user.')
    for filename in [settings.UBUNTU_SSH_KEY,settings.UBUNTU_KNOWN_HOSTS]:
        if not Path(filename).is_file():raise ValueError('Ubuntu SSH identity or pinned host key is missing.')
    return [ssh_executable(),'-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes',
            '-o','UserKnownHostsFile='+settings.UBUNTU_KNOWN_HOSTS,'-o','ConnectTimeout=8',
            '-o','ServerAliveInterval=10','-o','ServerAliveCountMax=2',
            '-i',settings.UBUNTU_SSH_KEY,'-p',str(settings.UBUNTU_SSH_PORT),
            settings.UBUNTU_SSH_USER+'@'+settings.UBUNTU_SSH_HOST,
            'sudo -n /usr/bin/python3 /opt/labmate/ubuntu_worker.py']


def requires_public_network(objective):
    from .lab_question_filter import practical_text
    work=practical_text(objective)
    return bool(re.search(r'\b(?:public|external|internet)\b|\b(?:google|example)\.com\b',work,re.I) and
                re.search(r'\b(?:nslookup|whois|traceroute|tcpdump)\b',work,re.I))


async def capture_ubuntu(code,filename=None,stdin='',objective='',commands=None):
    from .runtime_engine import RuntimeResult
    verification={'kind':'ubuntu','required':True,'status':'failed','engine':'Ubuntu VM / Bash',
                  'evidence_frames':[],'isolation':'Private Linux namespaces inside a dedicated Ubuntu VM'}
    from .ubuntu_reference_outputs import simulated_reference_outputs
    references = simulated_reference_outputs(objective)
    if references:
        verification.update(simulated_outputs=references, simulated_output_notice=
            'Reference examples only. These outputs were not produced by the Ubuntu VM and are not execution evidence.')
    process=None
    try:
        from ..security.operator_access import execution_opted_in
        if not execution_opted_in():raise ValueError('Ubuntu execution requires the controlled beta allowlist.')
        if not isinstance(code,str) or (not code.strip() and commands is None) or len(code)>50000:raise ValueError('Invalid Ubuntu source size.')
        filename=filename or 'solution.sh'
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,100}\.sh',filename):raise ValueError('Ubuntu source needs a safe .sh basename.')
        process=await asyncio.create_subprocess_exec(*ssh_command(),stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
        request=json.dumps({'code':code,'filename':filename,'stdin':stdin or '',**({'commands':commands} if commands else {})}).encode()+b'\n'
        async def read_bounded(stream,limit):
            out=bytearray()
            while chunk:=await stream.read(65536):
                out.extend(chunk)
                if len(out)>limit:raise ValueError('Ubuntu response exceeds the evidence budget.')
            return bytes(out)
        async def exchange():
            process.stdin.write(request);await process.stdin.drain();process.stdin.close()
            out,err=await asyncio.gather(read_bounded(process.stdout,24*1024**2),read_bounded(process.stderr,8192))
            await process.wait()
            return out,err
        # The guest permits 55s of execution and 130s of native capture. Include
        # connection/startup slack so the parent cannot cut off a valid receipt.
        out,err=await asyncio.wait_for(exchange(),400 if commands is not None else 210)
        try:receipt=json.loads(out)
        except ValueError:raise ValueError('Ubuntu worker returned no valid receipt: '+err.decode('utf-8','replace')[:500]) from None
        frames=receipt.get('frames') or []
        command_mode=commands is not None
        if command_mode and commands.get('administrator'):
            from scripts.ubuntu_curriculum import validate_administrator_plan
            validate_administrator_plan(commands)
        if not isinstance(frames,list) or len(frames)>(48 if command_mode else 28):raise ValueError('Invalid Ubuntu evidence frame count.')
        if command_mode:
            steps=commands['steps'];observations=receipt.get('command_results',[])
            if not receipt.get('command_mode') or len(observations)!=len(steps):receipt['success']=False
            for step,observed in zip(steps,observations):
                if observed.get('command')!=step['command'] or observed.get('exit_code')!=0 or observed.get('status')!='passed':receipt['success']=False
                if step.get('expected') and not re.search(step['expected'],observed.get('observed','')):receipt['success']=False
            required={(i+1,component) for i,step in enumerate(steps) for component in
                      (['terminal'] if step.get('capture',True) else [])+([step['view']] if step.get('view') else [])}
            if not required.issubset({(frame.get('step'),frame.get('component')) for frame in frames}):receipt['success']=False
            verification.update(command_mode=True,command_results=observations,keyboard_tail=receipt.get('keyboard_tail',''))
            if commands.get('curriculum')=='administration' and commands.get('administrator') and receipt.get('administrative_scope')=='private_namespaces_image_tmpfs':
                verification['administrative_scope']=receipt['administrative_scope']
        root=Path(settings.SCREENSHOT_DIR).resolve();root.mkdir(parents=True,exist_ok=True)
        screenshots={};evidence=[];discarded_frames=[]
        for index,frame in enumerate(frames):
            if frame.get('kind') not in {'source_preview','ubuntu_desktop'}:raise ValueError('Invalid Ubuntu evidence kind.')
            raw=base64.b64decode(frame.pop('png',''),validate=True)
            expected_size=((687,522) if frame.get('component')=='editor' else (972,586)) if command_mode else {'source_preview':(687,522),'ubuntu_desktop':(647,486)}[frame['kind']]
            with Image.open(io.BytesIO(raw)) as image:
                if image.format!='PNG' or image.size!=expected_size:
                    raise ValueError('Ubuntu evidence must match the native Text Editor (687x522) or Ptyxis (647x486) window size.')
                image.load()
                if max(ImageStat.Stat(image.convert('RGB')).stddev)<3:raise ValueError('Ubuntu returned a blank desktop capture; no evidence was accepted.')
                if frame.get('kind')=='source_preview' or frame.get('component')=='editor':
                    body=image.convert('L').crop((0,45,image.width,image.height))
                    minimum_white=.5 if frame.get('component')=='editor' else .1
                    if sum(body.histogram()[240:])<body.width*body.height*minimum_white:
                        raise ValueError('Ubuntu Text Editor was not visible in its capture; no source evidence was accepted.')
                if frame.get('kind')=='ubuntu_desktop':
                    terminal_body=image.convert('L').crop((0,40,image.width,image.height))
                    if sum(terminal_body.histogram()[141:])<20:
                        discarded_frames.append({'kind':'ubuntu_desktop','reason':'Blank terminal frame excluded.'})
                        continue
            target=root/f'ubuntu_{uuid.uuid4().hex}_{index}.png';target.write_bytes(raw)
            screenshots[str(index)]=str(target);evidence.append({**frame,'path':str(target)})
        if discarded_frames:verification['discarded_frames']=discarded_frames
        from .unix_requirements import runtime_diagnostics
        diagnostics=runtime_diagnostics(receipt.get('output',''),include_shell_io=command_mode)
        executed=receipt.get('execution_success',receipt.get('success')) is True and receipt.get('exit_code')==0 and not diagnostics
        verification['runtime_diagnostics']=diagnostics
        passed=executed and receipt.get('success') is True and bool(str(receipt.get('output','')).strip())
        required_kinds={'ubuntu_desktop'} if command_mode else {'source_preview','ubuntu_desktop'}
        if not required_kinds.issubset({f['kind'] for f in evidence}):passed=False
        verification.update(status='passed' if passed else 'failed',evidence_frames=evidence,
            engine=receipt.get('engine','Ubuntu VM'),files=receipt.get('files',[]),seconds=receipt.get('seconds'))
        error=receipt.get('error','')
        if diagnostics:error='Bash reported runtime errors: '+'; '.join(diagnostics)
        if executed and not str(receipt.get('output','')).strip():error='Ubuntu run produced no output; execution evidence could not be verified.'
        if not executed and not error:
            output_tail=str(receipt.get('output',''))[-1500:]
            if len(str(receipt.get('output','')))>1500 and '\n' in output_tail:
                output_tail=output_tail.split('\n',1)[1]
            error='Bash exited with status '+str(receipt.get('exit_code'))+'.\n'+output_tail
        if not passed and not error:error='Required native Ubuntu evidence failed.'
        limitations=[]
        from .lab_question_filter import practical_text
        requested_work=practical_text(objective)
        if re.search(r'\b(?:install(?:ation)?|partitions?)\b.{0,60}\b(?:Ubuntu|operating system)\b|\binstall Ubuntu\b',objective,re.I):
            limitations.append('A running Ubuntu VM does not prove the manual installation and partitioning procedure; installer evidence needs manual review.')
        visible_output='\n'.join(line for line in str(receipt.get('output','')).splitlines() if not line.startswith('+'))
        local_network_verified = bool('student.lab' in code and '-port=5353' in code and
            re.search(r'whois[^\n]*-p\s+4343',code) and
            re.search(r'Name:\s*student\.lab',visible_output,re.I) and '127.0.0.2' in visible_output and
            'Domain Name: STUDENT.LAB' in visible_output and 'Local teaching fixture - not a public registry' in visible_output)
        if local_network_verified:verification['network_scope']='private_loopback_fixtures'
        if re.search(r'\b(?:networking commands|nslookup|whois|traceroute|tcpdump)\b',objective,re.I) and not local_network_verified:
            limitations.append('The private runtime has loopback networking only. External DNS, routing and WHOIS demonstrations are unverified.')
        if requires_public_network(objective):
            limitations.append('Public network requirements cannot be verified by the private loopback fixtures.')
        if ((re.search(r'\b(?:fdisk|umount)\b',objective,re.I) or
            re.search(r'\bmount(?:ing)?\b.{0,40}\b(?:partition|disk|filesystem|file system|device)\b',objective,re.I)) and
            (not verification.get('administrative_scope') or re.search(r'physical\s+disk|/dev/[sv]d[a-z]',requested_work,re.I))):
            limitations.append('Physical disk partitioning and mounting require a disposable privileged VM; help/read-only examples do not verify these operations.')
        from .unix_requirements import command_coverage
        trace=str(receipt.get('output',''))
        if command_mode:
            observed_commands=[item['command'] for item in receipt.get('command_results',[]) if item.get('status')=='passed']
            trace+='\n'+'\n'.join('+ '+command for command in observed_commands)
            if 'bash --noprofile --norc --login -c logout' in observed_commands:trace+='\n+ logout'
        coverage = command_coverage(objective, trace,code)
        verification['command_coverage'] = coverage
        verification['repairable_errors'] = diagnostics + (['Missing required command demonstrations: '+', '.join(coverage['missing'])] if coverage['missing'] else [])
        if coverage['missing']:
            limitations.append('Command execution evidence is missing for: '+', '.join(coverage['missing']))
        verification['limitations']=limitations
        if limitations:
            passed=False;verification['status']='failed'
            error='\n'.join(filter(None,[error,*limitations]))
        elif passed and (local_network_verified or command_mode):
            verification.pop('simulated_outputs',None);verification.pop('simulated_output_notice',None)
        captured = required_kinds.issubset({f['kind'] for f in evidence}) and (not command_mode or receipt.get('success') is True)
        verification.update(execution_status='passed' if executed else 'failed',
                            capture_status='passed' if captured else 'failed',
                            requirements_status='unverified' if limitations else 'execution_tested' if passed else 'failed')
        return RuntimeResult(passed,receipt.get('output',''),error,int(receipt.get('exit_code') if receipt.get('exit_code') is not None else 1),
            screenshots=screenshots,verification=verification,stages={'execution':'passed' if executed else 'failed','capture':'passed' if captured else 'failed'})
    except (ValueError,OSError,TimeoutError) as error:
        verification['error']=str(error)
        verification.update(execution_status='unavailable',capture_status='unavailable',requirements_status='unverified')
        return RuntimeResult(False,error=str(error),exit_code=69,verification=verification)
    finally:
        if process and process.returncode is None:
            process.kill();await process.wait()


def ubuntu_instructions():
    return '''
UBUNTU RUNTIME: Return a complete Bash .sh script, with real commands and finite stdin.
For shell, sed, grep, AWK or Perl exercises, implement every Procedure and post-lab
question in the requested language; invoke awk/sed/perl from the Bash wrapper.
Provide finite sample input for interactive exercises. Do not omit post-lab tasks.
Pass explicit finite here-documents or pipes to each interactive helper script.
Never let missing input turn into zero or an empty number. Check read success and
numeric arguments before calculation. Include simple assertions for fixed sample
results, copied file contents, and text transformations; stop if they differ.
grep -o appends a newline per match: those newlines are not matched characters.
Remove them before counting matched characters. Preserve the original order and
preconditions of command examples asking which commands succeed or fail; catch
expected errors in explicit if statements and show their real diagnostics.
Use alternate sed substitution delimiters when replacements contain slashes,
for example sed 's|Linux|GNU/Linux|g'. Bash pipeline groups run in subshells:
do not pipe input into a read group and then use those variables in the parent.
Use a here-document or process substitution attached directly to the read group.
For duplicating each input line use sed 'p' (default printing plus p), or sed
'h;G'. sed 'G' alone inserts empty lines instead. Verify actual repeated content,
not merely the resulting number of lines. Count regular files with find -type f.
Use cal -j for a Julian calendar; date +%j alone only prints a day number. Show
additional surrounding calendar months with cal -B 1 -A 1 or the requested counts.
The runner propagates errexit, nounset and pipefail into Bash helper scripts.
Demonstrate logout only in a disposable login subshell, using
bash --noprofile --norc --login -c logout; do not terminate the runner's shell.
Create fixture files inside the exact directory later listed or searched. Check
that those paths and expected file counts agree; do not place them in its parent.
Keep Bash command tracing enabled. Do not hide unexpected errors with blanket
"|| true" or set +e; scope expected failures individually and disclose them.
The runner is an actual Ubuntu VM. Bash executes in a fresh private Linux filesystem,
PID and network namespace with a root identity confined to that namespace. /usr is
read-only; /etc, /var, /tmp and /home/student are disposable private data. Local loopback
is enabled. There is NO public internet, physical block device, or host administrator access.
Use real commands, not hard-coded imitations of their output. Keep source <= 200 lines,
prefer <= 80 clear lines, and omit duplicate demonstrations or decorative comments.
Use readable process columns such as ps -eo pid,ppid,comm or pstree instead of
dumping long internal command arguments; preserve the requested process information.
each source line <= 110 columns, with clear line breaks. OCR may spell ls as Is and ps
as PS; use the correct lowercase commands. meminfo means reading /proc/meminfo.
output <= 200 lines, and stop on unexpected failures. Create small local fixtures as needed.
Implement every practical command requested by the manual; explain conceptual questions
in answer, not by printing a fake success. Use bounded ps/top/htop (noninteractive), ping -c,
tcpdump -c with a timeout, local loopback tests and offline command syntax where needed.
For networking demonstrations without an explicitly required external host, real
private loopback services are available automatically: DNS at 127.0.0.1 port 5353
for student.lab (A 127.0.0.2, AAAA ::1), WHOIS at 127.0.0.1 port 4343 for student.lab.
Use nslookup -port=5353 student.lab 127.0.0.1 and whois -h 127.0.0.1 -p 4343 student.lab.
Label these as local teaching fixtures, not public DNS or registry results. Verify
their returned values. Use loopback ping/traceroute and capture real ICMP packets
by starting bounded tcpdump on lo before sending a local ping. Use ip link show lo
for the MAC address. Do not silently substitute ip/ss for requested ifconfig/netstat.
For commands that need public DNS or remote hosts (nslookup, dig, host, whois, mtr,
external traceroute), apply a short timeout and record the unavailable result without
aborting later local checks. Never invent successful DNS/WHOIS/remote traffic. Clearly
disclose unavailable external-network demonstrations in answer; the workflow will remain
unverified. When user/group administration is requested, perform safe useradd/groupadd,
membership and cleanup operations using unique disposable names inside the job's private
/etc and home; do not merely print syntax when the isolated operation is practical.
Use only temporary files and disposable users/groups.
The namespace has no CAP_SYS_NICE: a normal process can increase its nice value
but cannot lower it. Demonstrate nice -n 5 followed by renice 10 on that same
disposable sleep process, then kill and reap it. Do not request extra capabilities.
Do not start an interactive htop session; use a bounded noninteractive option if
available or display its own help and disclose that no interactive session ran.
Do not attempt nested unshare/nsenter or losetup to gain capabilities: those
operations are unavailable. fdisk may inspect or partition a disposable regular
image file without loop devices. Demonstrate mount by listing current mounts and
show umount --help; explicitly state that an actual mount/unmount was not verified.
Continue the permitted tasks after this known limitation. Do not fake a mount.
Never reboot, shutdown, halt, poweroff, repartition or install the host OS. Describe those
procedures for manual review and show --help where applicable. No sudo/systemctl, package
installs, curl/wget, ssh or reading credentials. Actual Ptyxis and GNOME Text Editor
will capture the complete source and real process transcript; do not launch GUI applications in the script.
If a manual requires actual installation/reboot or external networking, state the missing
evidence explicitly instead of claiming full verification. Return browser_tests=[].
'''
