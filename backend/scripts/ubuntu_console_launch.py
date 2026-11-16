#!/usr/bin/python3
"""Consume one root-owned launch ticket; never accept a caller-supplied command."""
import json
import os
from pathlib import Path
import re
import stat
import sys

def main():
    if os.geteuid()!=0 or len(sys.argv)!=2 or not re.fullmatch('[a-f0-9]{32}',sys.argv[1]):
        raise SystemExit('Invalid console launch ticket')
    path=Path('/run/labmate-console-tickets')/sys.argv[1]
    descriptor=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    with os.fdopen(descriptor) as stream:
        metadata=os.fstat(stream.fileno())
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid!=0 or stat.S_IMODE(metadata.st_mode)!=0o600:
            raise SystemExit('Unsafe console launch ticket')
        data=json.loads(stream.read(65537))
    path.unlink()
    argv=data['argv']
    if not isinstance(argv,list) or not argv or argv[0]!='/usr/bin/systemd-run' or not all(isinstance(arg,str) for arg in argv):
        raise SystemExit('Invalid console launcher')
    os.execv(argv[0],argv)

if __name__=='__main__':main()
