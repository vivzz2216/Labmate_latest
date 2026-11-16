"""Bounded, offline Unix practical plans; shared by the backend and trusted VM."""
import re
import shlex
import unicodedata


def student_profile(name='Student',experiment='2',**details):
    def clean(value,limit=90):
        return ' '.join(''.join(c for c in str(value or '') if ord(c)>=32 and ord(c)!=127).split())[:limit]
    name=clean(name,72) or 'Student'
    label=re.sub('[^0-9A-Za-z]','',str(experiment or '2'))[:4] or '2'
    slug=re.sub('[^A-Za-z0-9]+','_',unicodedata.normalize('NFKD',name.split()[0]).encode('ascii','ignore').decode()).strip('_')[:16] or 'Student'
    return {'name':name,'experiment':label,'stem':slug+'_Exp'+label,
            **{key:clean(details.get(key)) for key in ('roll_no','department','institution')}}


def profile_text(profile,topic):
    lines=['Student: '+profile['name'],'Experiment: '+profile['experiment'],'Topic: '+topic]
    for key,label in [('roll_no','Roll number'),('department','Department'),('institution','College')]:
        if profile.get(key):lines.append(label+': '+profile[key])
    return '\n'.join(lines)+'\n'


def new_plan(profile,title,kind):
    return {'version':1,'title':title,'profile':profile,'curriculum':kind,'steps':[]}


def add(plan,command,label,**options):
    plan['steps'].append({'command':command,'label':label,'capture':True,**options})


def text_file(plan,name,text,label='Prepare the practical data',editor=False):
    add(plan,'cat > '+name,label,input=text,input_eof=True,capture=not editor,
        **({'view':'editor','view_path':name} if editor else {}))


def script(plan,suffix,body,language='bash',inputs='',expected=''):
    p=plan['profile'];extension={'bash':'sh','awk':'awk','perl':'pl'}[language]
    name=p['stem']+'_'+suffix+'.'+extension
    shebang={'bash':'#!/bin/bash','awk':'#!/usr/bin/awk -f','perl':'#!/usr/bin/perl'}[language]
    content=shebang+'\n# Student: '+p['name']+'\n# Experiment '+p['experiment']+'\n'+body.strip()+'\n'
    if max(map(len,content.splitlines()))>88 or len(content.splitlines())>22:
        raise ValueError('A practical script needs shorter readable source lines.')
    text_file(plan,name,content,'Source code '+suffix.replace('_',' '),editor=True)
    add(plan,'chmod u+x '+name,'Make the practical script executable',capture=False)
    command=('awk -f ' if language=='awk' else language+' ')+name
    add(plan,command,suffix.replace('_',' ').capitalize(),input=inputs,expected=expected)
    return name


def permissions_plan(p):
    plan=new_plan(p,'UNIX file system and permissions','permissions');plan['administrator']=True
    f=p['stem']+'.txt';copy=p['stem']+'_copy.txt';archive=p['stem']+'.tar'
    text_file(plan,f,profile_text(p,'UNIX file system and permissions'),editor=True)
    for command,label,expected in [
        ('file '+f,'Identify the file type','text'),('whereis bash','Locate Bash binaries and manuals','bash:'),
        ('which bash','Find the Bash executable','/bin/bash'),
        ('tar -cf '+archive+' '+f,'Create an archive',''),('tar -tf '+archive,'List the archive contents',re.escape(f)),
        ('stat '+f,'Inspect file metadata','Size:'),('chmod 640 '+f,'Set owner and group permissions',''),
        ("stat -c '%a %U %G %n' "+f,'Check mode 640','640'),
        ('chown 1000 '+f,'Assign the file to the isolated student account',''),
        ('chgrp 1000 '+f,'Assign the isolated student group',''),
        ('ls -l '+f,'Verify owner group and permissions',r'-rw-r-----.*ubuntu.*ubuntu'),
        ('wc -l -w -m '+f,'Count lines words and characters',''),
        ('split -l 2 '+f+' '+p['stem']+'_part_','Split the practical text into two-line files',''),
        ('ls '+p['stem']+'_part_*','Show the split files',re.escape(p['stem']+'_part_')),
        ('cp '+f+' '+copy,'Make the comparison copy',''),
        ('cmp '+f+' '+copy+" && echo 'Files are identical'",'Compare the two files','Files are identical'),
        ('diff -s '+f+' '+copy,'Display the comparison result','identical'),
        ('sort '+f+' > '+p['stem']+'_sorted.txt','Sort the first comparison file',''),
        ('sort '+copy+' > '+p['stem']+'_copy_sorted.txt','Sort the second comparison file',''),
        ('comm '+p['stem']+'_sorted.txt '+p['stem']+'_copy_sorted.txt','Compare the sorted files',re.escape(p['name'])),
        ("find . -maxdepth 1 -type f -name '"+p['stem']+"*'",'Find the experiment files',re.escape(f)),
        ('gzip '+copy,'Compress the copy',''),('ls -lh '+copy+'.gz','Inspect the compressed file',r'\.gz'),
        ('gunzip '+copy+'.gz','Restore the compressed copy',''),
        ('cmp '+f+' '+copy+" && echo 'Restored copy matches'",'Verify restored contents','Restored copy matches'),
        ('umask','Post lab default creation mask',''),('umask 022','Post lab set a known mask',''),
        ('touch '+p['stem']+'_permissions.txt','Post lab create a regular file',''),
        ('mkdir '+p['stem']+'_folder','Post lab create a directory',''),
        ("stat -c '%a %n' "+p['stem']+'_permissions.txt '+p['stem']+'_folder','Post lab verify file 644 and directory 755',r'644[\s\S]*755'),
        ("if mkdir a/b/c; then exit 1; else echo 'Parent a/b does not exist'; fi",'Post lab first mkdir fails because parents are absent','Parent a/b does not exist'),
        ('mkdir a a/b','Post lab second mkdir creates a then a/b',''),('ls -ld a a/b','Post lab inspect both created directories',r'a/b'),
    ]:add(plan,command,label,expected=expected)
    return plan


def administration_plan(p):
    plan=new_plan(p,'UNIX system administration','administration');plan['administrator']=True
    plan['disk_scope']='private_image_and_tmpfs'
    account='u'+p['stem'].lower().replace('_','')[:12];team=account+'_g';renamed=account+'_new'
    image=p['stem']+'.img';mount=p['stem']+'_Mount';file=p['stem']+'.txt'
    for command,label in [('sleep 300 &','Start a disposable process'),('target=$!','Remember its PID')]:add(plan,command,label,capture=False)
    for command,label in [
        ('ps -o pid,ppid,ni,comm -p "$target"','Inspect the disposable process and its PPID'),
        ('pstree -p $$','Display the process hierarchy'),('pidof sleep','Find the sleep PID'),
        ('pgrep -a sleep','Find the process by name'),
        ("nice -n 5 sh -c 'ps -o ni,comm -p $$'",'Start a process with niceness 5'),
        ('renice -n 10 -p "$target"','Change the disposable process niceness'),('kill "$target"','Terminate only the disposable process'),
        ('free -h','Display memory usage'),('cat /proc/meminfo | head -n 12','Inspect actual kernel memory counters'),
        ('vmstat 1 2','Sample virtual memory and CPU activity twice'),
        ('top -b -n 1 -w 80 | head -n 16','Capture a bounded top snapshot'),
    ]:add(plan,command,label)
    add(plan,'htop','Interactive process monitor',keys=['q'],capture_before_keys=True)
    add(plan,'ipcs','Inspect System V IPC resources')
    add(plan,'truncate -s 64M '+image,'Create the disposable 64 MiB disk-image file')
    add(plan,'fdisk '+image,'Create a Linux partition inside the image file',input='n\np\n1\n\n\nw\n',expected='partition')
    add(plan,'fdisk -l '+image,'Inspect the real partition table in the image',expected=r'Linux')
    add(plan,'mkdir '+mount,'Create a temporary mount point')
    add(plan,'mount -t tmpfs -o size=8m tmpfs '+mount,'Mount a private in-memory practice filesystem')
    add(plan,'findmnt -n -o TARGET,FSTYPE --target '+mount,'Verify the actual tmpfs mount',expected='tmpfs')
    text_file(plan,mount+'/'+file,profile_text(p,'System administration'),'Write the personalised practical file inside the mounted filesystem')
    add(plan,'cat '+mount+'/'+file,'Read back the mounted file',expected=re.escape(p['name']))
    add(plan,'df -h '+mount,'Inspect the mounted filesystem capacity')
    add(plan,'du -h '+mount,'Measure the practical file disk usage')
    add(plan,'umount '+mount,'Unmount the temporary filesystem')
    add(plan,"if mountpoint -q "+mount+"; then exit 1; else echo 'Filesystem unmounted'; fi",'Verify the mount was removed',expected='Filesystem unmounted')
    add(plan,'groupadd '+team,'Create an isolated practice group')
    add(plan,'useradd -m -g '+team+' -s /bin/bash '+account,'Create an isolated practice account')
    add(plan,'passwd '+account,'Set a password for the disposable practice account',input='UnixPractical5!\nUnixPractical5!\n',input_prompts=['New password:','Retype new password:'],expected='successfully')
    add(plan,'id '+account,'Inspect the practice account identity',expected=re.escape(team))
    add(plan,'usermod -s /bin/sh '+account,'Change the practice account shell')
    add(plan,'getent passwd '+account,'Verify the updated shell',expected='/bin/sh')
    add(plan,'groupmod -n '+renamed+' '+team,'Rename the practice group')
    add(plan,'getent group '+renamed,'Inspect the renamed group',expected=re.escape(renamed))
    add(plan,"if groupdel "+renamed+"; then exit 1; else echo 'Primary group is still in use'; fi",'Post lab demonstrate the primary-group deletion restriction',expected='Primary group is still in use')
    add(plan,'userdel -r '+account,'Remove the disposable account and its home')
    add(plan,'groupdel '+renamed,'Remove the practice group after deleting its user')
    add(plan,'getent passwd '+account+" || echo 'Practice account removed'",'Verify account removal',expected='Practice account removed')
    add(plan,'rm '+image,'Remove only the disposable disk-image file')
    add(plan,'rmdir '+mount,'Remove the unused mount directory')
    add(plan,'ps -p $$ -o pid,ppid,comm','Post lab inspect the current shell PID and PPID')
    return plan


def scripting_plan(p,kind):
    plan=new_plan(p,'UNIX '+kind+' practical',kind);f=p['stem']+'.txt'
    q=shlex.quote
    data=profile_text(p,'UNIX '+kind)+'UNIX task completed\nPython task pending\nUNIX backup completed\n'
    if kind in {'shell','sed','grep'}:text_file(plan,f,data,editor=True)
    if kind=='shell':
        script(plan,'logged_in_users',"who\n",expected='')
        script(plan,'arithmetic','''read -r -p 'Enter two integers: ' a b
[[ $a =~ ^-?[0-9]+$ && $b =~ ^-?[0-9]+$ ]] || exit 1
printf 'Sum: %s\\n' "$((a+b))"
printf 'Difference: %s\\n' "$((a-b))"
printf 'Product: %s\\n' "$((a*b))"
if ((b!=0)); then printf 'Quotient: %s\\n' "$((a/b))"; fi
''',inputs='12 4\n',expected=r'Sum: 16[\s\S]*Difference: 8[\s\S]*Product: 48[\s\S]*Quotient: 3')
        copy=p['stem']+'_copy.txt'
        script(plan,'copy_file','cp '+f+' '+copy+'\ncmp '+f+' '+copy+" && echo 'File copied successfully'",expected='File copied successfully')
        add(plan,'cat '+copy,'Verify copied student information',expected=re.escape(p['name']))
        parity=script(plan,'even_odd',"read -r -p 'Enter an integer: ' n\n[[ $n =~ ^-?[0-9]+$ ]] || exit 1\nif ((n%2==0)); then echo 'Even'; else echo 'Odd'; fi",inputs='14\n',expected='Even')
        add(plan,'bash '+parity,'Post lab odd input',input='15\n',expected='Odd')
        add(plan,'command -v bash','Post lab Bash executable location',expected='/bin/bash')
        add(plan,'ps -p $$ -o comm=','Post lab inspect the running shell',expected='bash')
    elif kind=='sed':
        script(plan,'multiplication_table',"read -r -p 'Enter number and range: ' n limit\n[[ $n =~ ^[0-9]+$ && $limit =~ ^[0-9]+$ ]] || exit 1\nfor ((i=1;i<=limit;i++)); do\n  printf '%s x %s = %s\\n' \"$n\" \"$i\" \"$((n*i))\"\ndone",inputs='5 5\n',expected='5 x 5 = 25')
        script(plan,'count_files',"count=$(find . -maxdepth 1 -type f | wc -l)\nprintf 'Files: %s\\n' \"$count\"",expected=r'Files: [0-9]+')
        script(plan,'line_addressing',"sed -n '2,3p' "+f,expected='Experiment:')
        script(plan,'context_addressing',"sed -n '/UNIX/p' "+f,expected='UNIX task completed')
        script(plan,'substitution',"sed 's/UNIX/Ubuntu/g' "+f,expected='Ubuntu task completed')
        add(plan,"sed 'p' "+f,'Post lab duplicate each input line',expected=re.escape('Student: '+p['name'])+r'\s+Student:')
    elif kind=='grep':
        script(plan,'matched_counts',"file="+q(f)+"\npattern='completed'\nchars=$(grep -o \"$pattern\" \"$file\" | tr -d '\\n' | wc -m)\nwords=$(grep -o \"$pattern\" \"$file\" | wc -w)\nlines=$(grep -c \"$pattern\" \"$file\")\nprintf 'Matched characters: %s\\n' \"$chars\"\nprintf 'Matched words: %s\\n' \"$words\"\nprintf 'Matched lines: %s\\n' \"$lines\"\ntest \"$chars\" -eq 18 && test \"$words\" -eq 2 && test \"$lines\" -eq 2",expected=r'Matched characters: 18[\s\S]*Matched words: 2[\s\S]*Matched lines: 2')
        script(plan,'file_counts',"file="+q(f)+"\ngrep -E '.*' \"$file\" | wc -m -w -l",expected=r'\d+')
        pattern='^'+re.escape(p['stem'][0])
        script(plan,'matching_filenames',"find . -maxdepth 1 -type f -printf '%f\\n' | grep -E "+q(pattern),expected=re.escape(p['stem']))
        script(plan,'count_files',"count=$(find . -maxdepth 1 -type f -printf '%f\\n' | grep -c .)\nprintf 'Files: %s\\n' \"$count\"",expected=r'Files: [0-9]+')
    elif kind=='awk':
        script(plan,'fibonacci','''BEGIN {
  a=0; b=1
  for (i=0; i<8; i++) {
    printf "%s%d", (i ? " " : ""), a
    next_value=a+b; a=b; b=next_value
  }
  print ""; exit
}''',language='awk',expected='0 1 1 2 3 5 8 13')
        sentence=p['stem']+'_sentence.txt';text_file(plan,sentence,p['name']+' studies UNIX with UNIX tools and UNIX examples.\n',editor=True)
        nth=script(plan,'replace_second_match','''{
  for (i=1; i<=NF; i++) {
    if ($i=="UNIX" && ++matches==2) $i="Ubuntu"
  }
  print
}''',language='awk')
        # AWK reads its input file as an argument, not as an interactive prompt.
        plan['steps'][-1]['command']='awk -f '+nth+' '+sentence
        plan['steps'][-1]['expected']='UNIX with Ubuntu tools and UNIX'
        table=p['stem']+'_marks.txt';text_file(plan,table,p['name'].replace(' ','_')+' 92 UNIX\nAarav 88 Python\nMeera 95 UNIX\n',editor=True)
        columns=script(plan,'selected_columns','{ print $1, $2 }',language='awk')
        plan['steps'][-1].update(command='awk -f '+columns+' '+table,expected=re.escape(p['name'].replace(' ','_'))+' 92')
        matching=script(plan,'matching_rows','/UNIX/ { print }',language='awk')
        plan['steps'][-1].update(command='awk -f '+matching+' '+table,expected='Meera 95 UNIX')
    elif kind=='perl':
        script(plan,'temperature','''use strict;
use warnings;
print "Enter Celsius: ";
chomp(my $c=<STDIN>);
die "Invalid number\\n" unless $c =~ /^-?\\d+(?:\\.\\d+)?$/;
my $f=$c*9/5+32;
print "Fahrenheit: $f\\n";''',language='perl',inputs='25\n',expected='Fahrenheit: 77')
        script(plan,'power','''use strict;
use warnings;
print "Enter base: "; chomp(my $base=<STDIN>);
print "Enter exponent: "; chomp(my $exp=<STDIN>);
die "Invalid input\\n" unless $base =~ /^-?\\d+$/ && $exp =~ /^\\d+$/;
my $answer=$base ** $exp;
print "Power: $answer\\n";''',language='perl',inputs='3\n4\n',expected='Power: 81')
        prime=script(plan,'prime','''use strict;
use warnings;
print "Enter integer: "; chomp(my $n=<STDIN>);
die "Invalid integer\\n" unless $n =~ /^\\d+$/;
my $prime=($n>=2);
for(my $i=2; $i*$i<=$n; $i++) {
  if($n % $i == 0) { $prime=0; last; }
}
print $prime ? "Prime\\n" : "Not prime\\n";''',language='perl',inputs='29\n',expected=r'(?m)^Prime')
        add(plan,'perl '+prime,'Check the non-prime boundary 1',input='1\n',expected='Not prime')
        leap=script(plan,'leap_year','''use strict;
use warnings;
print "Enter year: "; chomp(my $year=<STDIN>);
die "Invalid year\\n" unless $year =~ /^\\d+$/;
my $leap=($year%400==0 || ($year%4==0 && $year%100!=0));
print $leap ? "Leap year\\n" : "Not a leap year\\n";''',language='perl',inputs='2024\n',expected=r'(?m)^Leap year')
        add(plan,'perl '+leap,'Post lab century year 1900',input='1900\n',expected='Not a leap year')
    return plan


def build_curriculum(objective,p):
    text=str(objective)
    if all(re.search(r'\b'+word+r'\b',text,re.I) for word in ['fdisk','useradd','groupmod','htop']):return administration_plan(p)
    if all(re.search(r'\b'+word+r'\b',text,re.I) for word in ['chmod','chown','split','comm']):return permissions_plan(p)
    if re.search(r'perl.*programming',text,re.I):return scripting_plan(p,'perl')
    if re.search(r'AWK.*programming',text,re.I):return scripting_plan(p,'awk')
    if re.search(r'grep/\s*egrep|grep script',text,re.I):return scripting_plan(p,'grep')
    if re.search(r'sed programming|programming and sed',text,re.I):return scripting_plan(p,'sed')
    if re.search(r'Shell scripts\s*-?\s*I\b|basic Shell scripting',text,re.I):return scripting_plan(p,'shell')
    return None


def validate_administrator_plan(plan):
    p=plan.get('profile',{})
    canonical=student_profile(p.get('name'),p.get('experiment'),**{k:p.get(k) for k in ('roll_no','department','institution')})
    constructors={'administration':administration_plan,'permissions':permissions_plan}
    constructor=constructors.get(plan.get('curriculum'))
    if not constructor or plan!=constructor(canonical):
        raise ValueError('Administrative practical must match the fixed trusted curriculum exactly.')
    return plan.get('curriculum')=='administration'
