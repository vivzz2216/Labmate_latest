"""Grounded overview for the standard UNIX introduction, without invented aliases."""
import re


def unix_postlab_notes(question,profile=None):
    """Concise factual answers for conceptual post-lab questions, without a model call.

    Commands and computed results still require actual execution evidence.
    """
    text=str(question or '')
    notes=[]
    filename=(profile or {}).get('stem','Student_Exp4')+'.txt'
    if re.search(r'absolute and relative file path',text,re.I):
        notes.append('An absolute path starts at /, for example /home/ubuntu/'+filename+'. A relative path starts at the current directory; from /home/ubuntu, '+filename+' names the same file. .. refers to the parent directory.')
    if re.search(r'file access modes',text,re.I):
        notes.append('Permissions apply separately to owner, group and others. Read is 4, write is 2 and execute is 1. For a regular file these allow reading, editing and execution. For a directory they allow listing names, changing entries and traversing the directory. Mode 640 gives owner read/write and group read access, with no access for others.')
    if re.search(r"machine.s MAC address",text,re.I):
        notes.append('Use ip link show or ifconfig -a and read the link/ether or ether value for the Ethernet or Wi-Fi interface. A MAC address identifies a network interface at the link layer. The isolated lab exposes only lo: its all-zero loopback address is not a physical Ethernet MAC address.')
    for pattern,answer in [
        (r'When to use shell scripts', 'Shell scripts automate repeated command sequences, backups, file processing and routine administration. Interactive or complex applications may be better suited to a general-purpose language.'),
        (r'default permissions', 'New regular files normally start from mode 666 and directories from 777, with the process umask removing permissions. The actual umask must be inspected; it is not always 022.'),
        (r'\bumask\b', 'umask specifies permission bits to remove at creation time. With umask 022, a requested file mode 666 becomes 644 and directory mode 777 becomes 755; existing files are unchanged.'),
        (r'mkdir a a/b', 'In a fresh directory, mkdir a/b/c fails because its parent directories do not exist. mkdir a a/b succeeds: mkdir creates a first, then creates a/b using that new parent. The order of the operands matters.'),
        (r'kill,?\s+pkill.*killall', 'kill targets process IDs; pkill selects processes by a matching pattern; killall selects processes by name. The default signal is SIGTERM. Demonstrations must target only disposable lab processes.'),
        (r'\bPPID\b', 'PPID is the parent process ID. ps -o ppid= -p PID displays it for the selected process. A shell exposes its parent through the PPID variable.'),
        (r'adduser.*useradd', 'On Ubuntu, adduser is a higher-level helper that normally prompts for details and creates a home directory. useradd is a lower-level command whose flags and configured defaults control account creation.'),
        (r'delete a nonempty user group', 'groupdel refuses to remove a group that is the primary group of an existing user. Reassign primary groups first. Supplementary memberships and files owned by the group require separate review.'),
    ]:
        if re.search(pattern,text,re.I|re.S):notes.append(answer)
    return notes


def unix_conclusion(result):
    if result.get('status')!='completed' or not re.search(r'\bConclusion\s*:',result.get('question',''),re.I):return []
    plan=result.get('ubuntu_command_plan') or {}
    kind=plan.get('curriculum') or ('network' if plan.get('network_scope') else 'utilities')
    topics={
        'utilities':('file operations, calendars, dates and process commands','file organisation and routine command-line work','choosing the correct options for each task'),
        'network':('network commands using private local services and real loopback traffic','local connectivity checks and packet inspection','distinguishing interface information, routing and name lookup'),
        'permissions':('file types, archives, comparisons and access permissions','managing shared files and checking backups','how ownership, access modes and the creation mask work together'),
        'administration':('processes, memory, a disposable disk image, a temporary filesystem and isolated practice accounts','resource monitoring and controlled account administration','checking changes and cleaning up practice resources safely'),
        'shell':('shell scripts for arithmetic, file copying and number classification','automating repeated calculations and backups','validating input and verifying each script result'),
        'sed':('shell loops and sed line selection, pattern selection, substitution and duplication','editing text files and processing repeated records','selecting the right addressing and substitution rules'),
        'grep':('grep and extended patterns for matching text, counting and selecting filenames','searching logs and checking text records','distinguishing matched content from whole-file counts'),
        'awk':('AWK arithmetic, occurrence replacement, column selection and row filtering','processing tabular text and preparing summaries','using fields, patterns and state variables correctly'),
        'perl':('Perl programs for temperature conversion, powers, primes and leap years','small calculation and validation tools','handling input and testing boundary cases'),
    }
    done,applications,significance=topics[kind]
    return ['I practised '+done+'. The recorded outputs show the completed examples.',
            'Applications include '+applications+'.','This experiment helped me understand '+significance+'.']

def unix_overview(question):
    if not all(re.search(pattern,question,re.I) for pattern in [r'\bUNIX\b',r'\bhistory\b',r'\bflavours?\b',r'\barchitecture\b']):return None
    return '''UNIX operating system
UNIX supports multiple users and concurrent processes. A shell interprets commands; utilities perform focused operations and can be combined using pipes and redirection.

History
Work began at Bell Labs in 1969 with Ken Thompson, Dennis Ritchie and colleagues on a PDP-7. The Fourth Edition was rewritten in C in 1973, improving portability. Later development produced the BSD and System V families.

Variants
Examples include AIX, HP-UX and Solaris. FreeBSD, OpenBSD and NetBSD belong to the BSD family. Linux is a separately developed Unix-like kernel; Ubuntu combines Linux with userspace tools and desktop applications.

Architecture
The kernel manages processes, memory, devices and filesystems. Applications request kernel services through system calls. Libraries, shells and utilities run in userspace. Files and directories form a hierarchy rooted at /.

Advantages and applications
Multiuser access, process isolation, permissions, scripting and composable tools support servers, scientific computing and software development. Portable interfaces help applications run across compatible systems.

Limitations
Administration requires training. Commands and package management differ among systems, and some applications or hardware drivers are available only on particular platforms. Security depends on configuration and maintenance.

Comparison
Windows belongs to a different operating-system family and commonly uses PowerShell or Command Prompt. macOS combines a graphical desktop with a Darwin and BSD-based foundation. UNIX names a historical family and a certified specification; Linux was developed separately while following many Unix conventions. A Linux distribution is not automatically a certified UNIX product.

Reference
The Open Group UNIX history https://www.unix.org/unix_history.html'''
