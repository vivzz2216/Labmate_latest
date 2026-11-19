"""Command demonstrations use one real interactive terminal, without student scripts."""
import re
import shlex


def command_lab_plan(objective,student_name='Student',experiment_number=None,**details):
    from scripts.ubuntu_curriculum import student_profile,build_curriculum,profile_text
    from .instruction_policy import clean_instructions, parse_instruction_preferences

    extra = clean_instructions(details.pop('instructions', '') or '')
    if extra:
        prefs = parse_instruction_preferences(extra)
        # If the user supplied custom task/command instructions beyond pure report-layout hints,
        # let the AI bash pipeline generate a script that obeys them instead of a fixed template.
        if not (prefs.output_only_screenshots or prefs.paste_under_question or prefs.no_extra_questions or prefs.no_conclusion or prefs.font_name or prefs.font_size):
            return None
        if re.search(r'\b(?:use|write|create|run|command|script|file|chmod|grep|awk|sed|cut|sort|find|loop|function)\b', extra, re.I):
            return None
    # The fixed demonstrations are for manuals that leave fixtures unspecified.
    # A manual naming its own files or input literals must use normal generation
    # so those requirements are retained rather than replaced by sample data.
    if re.search(r'\b(?!filename\.)[\w./-]+\.(?:txt|csv|dat|sh|pl|awk|tar|gz)\b|'
                 r'\b(?:content|sentence|pattern)\s*[:=]\s*[\'"]|'
                 r'\b(?:input|year|temperature|range)\s*(?:=|:|is|as)\s*\d+',str(objective),re.I):return None
    match=re.search(r'(?:Experiment|Expt)\s*[-–—:]?\s*(\d+[A-Za-z]?)',str(objective),re.I)
    profile=student_profile(student_name,experiment_number or (match.group(1) if match else '2'),**details)
    plan=build_curriculum(objective,profile)
    if plan:return plan
    plan=_basic_plan(objective)
    if not plan:return None
    plan['profile']=profile
    if 'network_scope' not in plan:
        stem=profile['stem']
        replacements={'notes.txt':stem+'.txt','copy.txt':stem+'_copy.txt','renamed.txt':stem+'_renamed.txt','UnixLab':stem}
        for step in plan['steps']:
            for field in ('command','label','view_path'):
                if field in step:
                    for before,after in replacements.items():step[field]=step[field].replace(before,after)
            if step['command'].startswith('cat > '):step['input']=profile_text(profile,'UNIX general purpose utilities')
            if step['command']=="echo 'Hello from UNIX lab'":
                message=profile['name']+' - UNIX practical '+profile['experiment']
                step['command']='echo '+shlex.quote(message);step['expected']=re.escape(message)
            if step.get('expected')==r'(?m)^UNIX general purpose utilities':step['expected']=re.escape('Student: '+profile['name'])
            if step.get('expected')==r'renamed\.txt':step['expected']=re.escape(stem+'_renamed.txt')
    return plan


def _basic_plan(objective):
    text=str(objective or '')
    if not re.search(r'UNIX|Ubuntu',text,re.I):return None
    steps=[]
    def add(command,label,**kwargs):
        steps.append({'command':command,'label':label,'capture':True,**kwargs})
    if all(re.search(r'\b'+name+r'\b',text,re.I) for name in ('nslookup','whois','tcpdump','traceroute')):
        add('ifconfig -a','Network interface configuration')
        add('ping -c 2 127.0.0.1','Loopback connectivity',expected=r'2 received')
        add('traceroute -n -m 3 127.0.0.1','Route to the local loopback interface',expected=r'1\s+127\.0\.0\.1')
        add('netstat -tuln','Listening ports')
        add('nslookup -port=5353 student.lab 127.0.0.1','DNS lookup using the private teaching service',expected=r'Address:\s+127\.0\.0\.2')
        add('whois -h 127.0.0.1 -p 4343 student.lab','WHOIS using the private teaching service',expected=r'Domain Name: STUDENT\.LAB')
        add('hostname','Machine hostname',expected=r'(?m)^ubuntu\s*$')
        add('tcpdump -i lo -c 4 -w /tmp/packets.pcap icmp 2>/tmp/tcpdump.log &','Start a bounded local packet capture')
        add('capture_pid=$!','Keep the packet capture process ID',capture=False)
        add('ping -c 2 127.0.0.1','Generate actual ICMP traffic',expected=r'2 received')
        add('wait "$capture_pid"','Wait for four captured packets')
        add('tcpdump -nn -r /tmp/packets.pcap','Inspect the actual captured packets',expected=r'ICMP echo reply')
        add('ip link show lo','Loopback MAC format; no physical Ethernet interface is exposed',expected=r'link/loopback 00:00:00:00:00:00')
        return {'version':1,'title':'UNIX networking commands','steps':steps,'network_scope':'private_loopback_fixtures'}
    if not (re.search(r'general purpose|utility commands',text,re.I) and all(re.search(r'\b'+name+r'\b',text,re.I) for name in ('mkdir','cal','logout','bc'))):return None
    add('pwd','Current directory',expected=r'/home/ubuntu')
    add('ls','Standard Ubuntu home folders',expected=r'Desktop')
    add('mkdir Desktop/UnixLab','Create the practical folder',view='files',view_path='Desktop')
    add('cd Desktop/UnixLab','Change directory')
    add('mkdir Drafts','Create a subdirectory')
    add('rmdir Drafts','Remove an empty directory')
    add('cat > notes.txt','Create the text file required for file demonstrations',input='UNIX general purpose utilities\nSecond line of the practical file.\n',input_eof=True,view='editor',view_path='Desktop/UnixLab/notes.txt')
    add('cat notes.txt','Display file contents',expected=r'(?m)^UNIX general purpose utilities')
    add('cp notes.txt copy.txt','Copy a file')
    add('mv copy.txt renamed.txt','Rename the copied file')
    add('ls -l','Display the original and renamed file',expected=r'renamed\.txt')
    add('rm renamed.txt','Remove the copied file')
    add("MANPAGER='less -X' man date",'Read the date manual',keys=['q'])
    add('who','Users recorded as logged in; the isolated session may have none')
    add('whoami','Current user',expected=r'(?m)^ubuntu\s*$')
    add("echo 'Hello from UNIX lab'",'Display a message',expected=r'(?m)^Hello from UNIX lab')
    add('date','Current date and time')
    add('time ls','Measure command execution time',expected=r'(?m)^real\s+')
    add('sleep 30 &','Start a disposable process for the kill demonstration')
    add('kill %1','Terminate the disposable process')
    add('cal','Current month calendar')
    add('history 8','Command history')
    add('more notes.txt','Read the file with more',keys=['q'])
    add('less -X notes.txt','Read the file with less',keys=['q'])
    add('bc','Calculate 5 times 4 plus 2',input='5 * 4 + 2\nquit\n',expected=r'(?m)^22\s*$')
    add('finger ubuntu','Inspect the local account')
    add('clear','Clear the terminal display')
    add('bash --noprofile --norc --login -c logout','Demonstrate logout in a disposable login shell')
    add('gedit --help | head -n 12','Text editor command syntax; notes.txt is opened separately in the native editor')
    for command in ('reboot','halt','shutdown','poweroff'):
        add(command+' --help | head -n 12',command+' syntax only; the machine is not powered off')
    for command,label in [
        ('ls -lh','Post lab 1 Human readable file sizes'),
        ('ls -lt','Post lab 2 Last modification time in descending order'),
        ('ls -R','Post lab 3 Recursive file listing'),
        ("date '+%A (%a)'",'Post lab 4 Full and abbreviated weekday'),
        ("date '+%D'",'Post lab 5 Date in MM/DD/YY format'),
        ("date '+%T'",'Post lab 6 Time in 24 hour HH:MM:SS format'),
        ("date '+%U'",'Post lab 7 Sunday first week number 00 to 53'),
        ('cal -j','Post lab 8 Julian calendar and ordinal days'),
        ('cal -j -B 1 -A 1','Post lab 9 One month before and after the current month'),
        ('ps -e -o pid,ppid,comm --forest','Post lab 10 Process hierarchy'),
    ]:add(command,label)
    return {'version':1,'title':'UNIX general purpose utility commands','steps':steps}


async def run_command_lab(question,plan):
    from .ubuntu_runtime import capture_ubuntu
    from .evidence_planner import plan_experiment,select_evidence,verification_summary
    code='\n'.join(step['command'] for step in plan['steps'])
    run=await capture_ubuntu(code,objective=question['text'],commands=plan)
    evidence=plan_experiment(question['text'],'ubuntu',code)
    # The implementation is the command sequence itself, visible in its terminal.
    evidence['requirements']=[row for row in evidence['requirements'] if row['id']!='source']
    evidence['recommended_screenshots']=['ubuntu_desktop']
    verification=run.verification or {}
    frames=verification.get('evidence_frames',[])
    selection=select_evidence(evidence,frames)
    summary=verification_summary(evidence,run.success,run.output,verification)
    summary['checks']['evidence']='passed' if not selection['missing_requirements'] and not selection['invalid'] else 'failed'
    success=run.success and summary['status']!='failed' and summary['checks']['evidence']=='passed'
    return {'id':question['id'],'question':question['text'],'language':'ubuntu','answer':'',
            'code':code,'output':run.output,'error':run.error,'status':'completed' if success else 'failed',
            'ubuntu_command_plan':plan,'screenshot_paths':[frame['path'] for frame in frames],
            'screenshot_captions':[frame['caption'] for frame in frames],
            'verification':verification,'verification_summary':summary,'evidence_plan':evidence,
            'execution_stages':run.stages}
