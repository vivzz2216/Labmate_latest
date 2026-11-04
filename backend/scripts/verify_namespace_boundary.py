"""Harmless OS boundary probe, run on the dedicated worker VM as its operator."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid

spec = importlib.util.spec_from_file_location('broker', '/opt/labmate-runtime/broker.py')
broker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(broker)
canary = Path('/var/lib/labmate-outside-canary.txt')
canary.write_text('LABMATE_HARMLESS_BOUNDARY_CANARY')
unit = 'labmate-probe-' + uuid.uuid4().hex + '.scope'
probe = 'OUTER_PID_NS = ' + repr(os.readlink('/proc/self/ns/pid')) + '\n' + '''import json,os,socket,ctypes,subprocess
assert ctypes.CDLL(None).prctl(4,0,0,0,0)==0
checks={}
for name,path in [('outside_canary','/var/lib/labmate-outside-canary.txt'),('ssh_identity','/root/.ssh/authorized_keys')]:
 try:open(path).read();checks[name]=False
 except (FileNotFoundError,PermissionError):checks[name]=True
try:open('/opt/labmate-runtime/should-not-write','w').write('x');checks['readonly_tools']=False
except OSError:checks['readonly_tools']=True
open('/work/own.txt','w').write('own')
checks['own_workspace']=open('/work/own.txt').read()=='own'
try:socket.create_connection(('1.1.1.1',53),timeout=1);checks['egress_blocked']=False
except OSError:checks['egress_blocked']=True
s=socket.socket();s.bind(('127.0.0.1',0));s.listen(1)
c=socket.create_connection(s.getsockname(),timeout=1);conn,_=s.accept()
c.sendall(b'loopback');checks['private_loopback']=conn.recv(20)==b'loopback'
checks['unprivileged_uid']=os.getuid()==65534
checks['private_pid']=os.readlink('/proc/self/ns/pid')!=OUTER_PID_NS and len([p for p in os.listdir('/proc') if p.isdigit()])<8
child="import os\\ntry: os.open('/proc/1/fd/1',os.O_WRONLY); raise SystemExit(1)\\nexcept PermissionError: pass"
checks['receipt_fd_protected']=os.getpid()==1 and subprocess.run(['/usr/bin/python3','-c',child]).returncode==0
print(json.dumps(checks))
assert all(checks.values()),checks
'''
try:
    cmd = broker.command(Path('/unused'), unit)
    cmd[-2:] = ['/usr/bin/python3', '-c', probe]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    print(result.stdout)
    if result.returncode: raise RuntimeError(result.stderr)
finally:
    subprocess.run(['systemctl','kill','--kill-whom=all','--signal=KILL',unit], capture_output=True)
    if '--keep-canary' not in sys.argv: canary.unlink(missing_ok=True)
