"""Curated reference output for Ubuntu operations unavailable in the sandbox."""
import re


def simulated_reference_outputs(objective):
    """Return clearly marked sample output; these fixtures never execute commands."""
    text = str(objective or "")
    outputs = []

    if re.search(r"\b(?:nslookup|dig|host)\b", text, re.IGNORECASE):
        outputs.append({
            "status": "simulated",
            "command": "nslookup google.com",
            "output": (
                "Server:  dns.google\n"
                "Address:  8.8.8.8\n\n"
                "Non-authoritative answer:\n"
                "Name:    google.com\n"
                "Addresses:  142.250.183.14\n"
                "          2404:6800:4007:82a::200e"
            ),
            "note": "Illustrative DNS sample supplied for the exercise. DNS answers can change; this lookup was not run.",
        })

    disk_required = (
        re.search(r"\b(?:fdisk|umount)\b", text, re.IGNORECASE)
        or re.search(
            r"\bmount(?:ing)?\b.{0,40}\b(?:partition|disk|filesystem|file system|device)\b",
            text,
            re.IGNORECASE,
        )
    )
    if disk_required:
        outputs.extend([
            {
                "status": "simulated",
                "command": "fdisk -l /dev/vdb",
                "output": (
                    "Disk /dev/vdb: 64 MiB, 67108864 bytes, 131072 sectors\n"
                    "Disklabel type: dos\n"
                    "Device     Boot Start    End Sectors Size Id Type\n"
                    "/dev/vdb1        2048 131071  129024  63M 83 Linux"
                ),
                "note": "Illustrative disposable virtual-disk sample; no disk was partitioned.",
            },
            {
                "status": "simulated",
                "command": "findmnt -no SOURCE,FSTYPE,TARGET /mnt/lab",
                "output": "/dev/vdb1 ext4 /mnt/lab",
                "note": "Illustrative expected mount verification; no filesystem was mounted.",
            },
        ])

    # Syntax guides supplement unavailable exercises without pretending they ran.
    guides = {
        'ifconfig': 'Inspect interfaces: ifconfig -a (or ip address show).',
        'ping': 'Loopback example: ping -c 3 127.0.0.1. External connectivity is not implied.',
        'traceroute': 'Syntax: traceroute -m 3 -w 1 HOST. External routes require network access.',
        'netstat': 'Inspect listening sockets: netstat -tuln.',
        'whois': 'Syntax: whois DOMAIN. Requires access to a WHOIS server.',
        'hostname': 'Syntax: hostname. Displays the actual isolated hostname when executed.',
        'tcpdump': 'Bounded example: timeout 5 tcpdump -i lo -c 3. Requires capture capabilities.',
        'dig': 'Syntax: dig DOMAIN. Requires a reachable DNS resolver.',
        'host': 'Syntax: host DOMAIN. Requires a reachable DNS resolver.',
        'route': 'Inspect routing table: route -n (or ip route show).',
        'arp': 'Inspect neighbour cache: arp -a (or ip neigh show).',
        'mtr': 'Bounded example: mtr --report --report-cycles 3 HOST.',
        'logout': 'Shell session command: logout. Not executed in the report runner.',
        'reboot': 'Syntax: reboot. Not executed: it would restart the operating system.',
        'halt': 'Syntax: halt. Not executed: it would stop the operating system.',
        'shutdown': 'Syntax: shutdown -h now. Not executed in the report runner.',
        'poweroff': 'Syntax: poweroff. Not executed: it would power off the operating system.',
    }
    for command, guide in guides.items():
        if re.search(r'\b'+command+r'\b', text, re.I):
            outputs.append({'status':'reference', 'command':command, 'output':guide,
                            'note':'Syntax reference only; this block is not execution evidence.'})
    if re.search(r'\binstall(?:ation)?\b.{0,70}\b(?:Ubuntu|UNIX)\b', text, re.I):
        outputs.append({'status':'reference','command':'Ubuntu installation',
            'output':'A running system can be inspected with uname -a, cat /etc/os-release, lsblk -f and df -hT.\n'
                     'These commands do not prove installation or partition creation.',
            'note':'Installer steps and partitioning require genuine installer evidence and manual review.'})
    return outputs
