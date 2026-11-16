"""Conservative coverage of explicit Unix command lists, using real Bash traces.

This checks command coverage, not semantic correctness of arbitrary shell scripts.
Reference examples and a zero exit code cannot satisfy a missing command.
"""
import re
import shlex

COMMANDS = set(('cd mkdir rmdir pwd gedit cat mv rm ls cp ps man who whoami echo date time kill '
                'cal history more less bc finger clear logout reboot halt shutdown poweroff '
                'ifconfig ping traceroute netstat nslookup whois hostname tcpdump dig route host arp mtr '
                'file whereis which tar stat chmod chown chgrp wc split cmp diff comm find gzip gunzip '
                'pstree pidof pgrep nice renice free meminfo vmstat top htop ipcs fdisk mount umount df du '
                'useradd passwd userdel usermod groupadd groupdel groupmod grep egrep awk sed perl').split())


def runtime_diagnostics(transcript,include_shell_io=False):
    """Shell diagnostics are not successful arithmetic, even if a later echo exits zero."""
    return [line[:500] for line in str(transcript).splitlines() if not line.startswith('+') and
            (re.search(r':\s*line\s+\d+:.*(?:integer expression expected|unbound variable|'
                      r'syntax error|division by 0|bad substitution|command not found)',line,re.I) or
             include_shell_io and re.search(r'^bash: .*:\s*(?:Permission denied|No such file or directory|command not found)\s*$',line,re.I))]


def validate_unix_semantics(code, objective):
    """Reject common mistakes in these practical requirements before capture."""
    executable='\n'.join(line for line in code.splitlines() if not line.lstrip().startswith('#'))
    if re.search(r'Julian\s+calendar',objective,re.I):
        if not re.search(r'\b(?:n?cal)\s+[^\n]*(?:-[A-Za-z]*j\b|--julian\b)',executable):
            raise ValueError('The requested Julian calendar needs cal -j (ordinal days in the calendar). '
                             'cal -y is a Gregorian year view, and date +%j alone is not a Julian calendar.')
        if re.search(r'months\s+before\s+or\s+after',objective,re.I) and not re.search(r'\b(?:n?cal)\s+[^\n]*-[AB]\s*\d+',executable):
            raise ValueError('Show surrounding calendar months with cal -B 1 -A 1 or the requested counts. '
                             'date -d changes a date value rather than displaying the requested extra calendar months.')
    if re.search(r'matched\s+characters',objective,re.I) and re.search(
            r'grep\s+-\S*o\b[^\n|]*\|\s*wc\s+-(?:m|c)\b',code):
        raise ValueError('Matched-character counts must exclude the newlines that grep -o appends. '
                         'Remove those separators before wc -m, or sum actual match lengths; verify the count against the pattern length.')
    if re.search(r'duplicate\s+(?:each|every)\s+line',objective,re.I) and re.search(r'\bsed\s+([\'"]?)G\1(?:\s|$)',code):
        raise ValueError('sed G with an empty hold space inserts blank lines; it does not duplicate each line. '
                         'Use sed p or sed h;G as appropriate, and assert complete output x/x/y/y, not just its line count.')
    examples=re.findall(r'^\s*[a-z][.)]\s*(mkdir\s+[^\n]+)',objective,re.M)
    if len(examples)>1 and re.search(r'Which of these commands will work',objective,re.I):
        executable='\n'.join(line for line in code.splitlines() if not line.lstrip().startswith('#'))
        positions=[executable.find(command.strip()) for command in examples]
        if all(position>=0 for position in positions) and positions!=sorted(positions):
            raise ValueError('Preserve the manual mkdir examples in their original order in a fresh directory. '
                             'Capture the expected first failure explicitly, explain it, then run the next command; '
                             'do not pre-create its parents and change the answer.')


def required_commands(objective):
    from .lab_question_filter import practical_text
    required = set()
    for line in practical_text(objective).splitlines():
        if ',' not in line: continue
        names=[]
        for part in line.split(','):
            part=re.sub(r'^.*\bcommands?\s*:?\s*','',part,flags=re.I).strip(' .;:\t')
            if not re.fullmatch(r'[A-Za-z]+',part):continue
            name='ls' if part=='Is' else part.lower()
            if name in COMMANDS:names.append(name)
        if len(names) >= 2: required.update(names)
    return sorted(required)


def command_coverage(objective, transcript, source_code=''):
    required = required_commands(objective)
    observed = set()
    for line in transcript.splitlines():
        if not re.match(r'^\++ ', line): continue
        try: tokens = shlex.split(re.sub(r'^\++ ', '', line))
        except ValueError: continue
        while tokens and (tokens[0] in {'command','builtin','exec'} or re.match(r'^\w+=',tokens[0])):tokens.pop(0)
        if tokens and tokens[0] == 'timeout':
            tokens = tokens[2:]
        if tokens:
            command = tokens[0].rsplit('/',1)[-1]
            observed.add(command)
            if command == 'grep' and '-E' in tokens: observed.add('egrep')
            if command == 'cat' and '/proc/meminfo' in tokens: observed.add('meminfo')
    # `time` is Bash syntax, not a separately traced executable. Require both
    # its source statement and its actual three measured result lines.
    if re.search(r'(?m)^\s*time\s+\S',source_code) and all(re.search(
            r'(?m)^'+label+r'\s+\d+m[\d.]+s\s*$',transcript) for label in ['real','user','sys']):
        observed.add('time')
    return {'required': required, 'observed': sorted(observed),
            'missing': sorted(set(required) - observed),
            'scope': 'Explicit command-list coverage only; semantic correctness requires the experiment assertions.'}
