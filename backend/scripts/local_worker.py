"""Local worker lifecycle. Never starts cloud resources or executes student code on Windows.

configure --base-disk must reference a stopped, tested VM image. A new writable overlay
preserves that image. State, keys, logs and disks remain outside the checkout.
"""
import argparse
import asyncio
from contextlib import redirect_stdout
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time

ROOT = Path.home() / '.cache' / 'labmate-worker'
LEGACY = Path.home() / '.cache' / 'labmate-ubuntu'
BACKEND = Path(__file__).resolve().parents[1]


def listening(port):
    with socket.socket() as sock:
        sock.settimeout(.5)
        return sock.connect_ex(('127.0.0.1', port)) == 0


def owned_process(saved, expected_exe, required_arg):
    """Never stop a reused PID or a process belonging to another task."""
    import psutil
    if not saved:
        return None
    try:
        proc = psutil.Process(saved['pid'])
        same_exe = Path(proc.exe()).resolve() == Path(expected_exe).resolve()
        same_time = abs(proc.create_time()-saved['created']) < .01
        needle = required_arg.replace('\\','/').casefold()
        return proc if same_exe and same_time and any(needle in arg.replace('\\','/').casefold() for arg in proc.cmdline()) else None
    except (psutil.Error, KeyError, OSError):
        return None


def save(path, data):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(data, indent=2))
    temp.replace(path)


def configure(args):
    config_path = ROOT / 'config.json'
    if config_path.exists():
        raise RuntimeError('Already configured; preserve the current configuration and disk.')
    base = Path(args.base_disk).resolve(strict=True)
    qemu = Path(args.qemu).resolve(strict=True)
    seed = Path(args.seed).resolve(strict=True)
    if base.suffix != '.qcow2' or any('\n' in str(p) or '\r' in str(p) for p in (base,qemu,seed)):
        raise ValueError('Expected safe paths and a qcow2 backing image.')
    import psutil
    for proc in psutil.process_iter(['name','cmdline']):
        if (proc.info['name'] or '').lower().startswith('qemu-system') and any(str(base).replace('\\','/').lower() in arg.replace('\\','/').lower() for arg in proc.info['cmdline'] or []):
            raise RuntimeError('Backing VM is still running; shut it down before taking an overlay.')
    ROOT.mkdir(parents=True,exist_ok=True)
    disk = ROOT / 'worker.qcow2'
    if disk.exists(): raise RuntimeError('Worker disk already exists; refusing to overwrite it.')
    subprocess.run([str(qemu.with_name('qemu-img.exe' if os.name=='nt' else 'qemu-img')),
                    'create','-f','qcow2','-F','qcow2','-b',str(base),str(disk)],check=True,stdout=subprocess.DEVNULL)
    config = {'qemu':str(qemu),'disk':str(disk),'seed':str(seed),'ssh_port':2226,'redis_port':6379,
              'qmp_port':4446,
              'operator_key':str(LEGACY/'identity'),'sandbox_key':str(LEGACY/'sandbox_identity'),
              'known_hosts':str(LEGACY/'known_hosts'),'memory_mb':4096,'cpus':1,
              'cpu':'qemu64,vendor=GenuineIntel,-svm,+ssse3,+sse4.1,+sse4.2,+popcnt,+cx16'}
    save(config_path,config)
    env = {'EXECUTION_ISOLATION':'required','SANDBOX_SSH_HOST':'127.0.0.1',
           'SANDBOX_SSH_PORT':str(config['ssh_port']),'SANDBOX_SSH_USER':'labmate',
           'SANDBOX_SSH_KEY':config['sandbox_key'],'SANDBOX_KNOWN_HOSTS':config['known_hosts'],
           'WORKFLOW_WORKERS':'2','HEAVY_EXECUTION_LOCAL_LIMIT':'1','BROWSER_CAPTURE_LOCAL_LIMIT':'1',
           'HEAVY_EXECUTION_GLOBAL_LIMIT':'1','BROWSER_CAPTURE_GLOBAL_LIMIT':'1',
           'REDIS_URL':'redis://127.0.0.1:6379/0','REDIS_REQUIRED':'true'}
    (ROOT/'worker.env').write_text(''.join(k+'='+v.replace('\\','/')+'\n' for k,v in env.items()))
    return {'configured':True,'env_file':str(ROOT/'worker.env')}


def vm_args(config, serial):
    return [config['qemu'],'-name','LabMate isolated worker','-machine','q35','-accel','whpx',
            '-cpu',config['cpu'],'-m',str(config['memory_mb']),'-smp',str(config['cpus']),
            '-drive',f"file={config['disk']},if=virtio,format=qcow2",
            '-drive',f"file={config['seed']},media=cdrom,readonly=on",
            '-nic',f"user,model=virtio-net-pci,mac=52:54:00:12:34:56,hostfwd=tcp:127.0.0.1:{config['ssh_port']}-:22",
            '-vga','none','-display','none','-serial','file:'+str(serial),
            '-qmp',f"tcp:127.0.0.1:{config.get('qmp_port',4446)},server=on,wait=off"]


def graceful_shutdown(proc, config):
    """Use ACPI only when the QMP listener belongs to the verified VM PID."""
    import psutil
    port=config.get('qmp_port',4446)
    try:
        owns=any(c.pid==proc.pid and c.status==psutil.CONN_LISTEN and c.laddr.port==port
                 and c.laddr.ip=='127.0.0.1' for c in psutil.net_connections(kind='tcp'))
        if not owns: return False
        with socket.create_connection(('127.0.0.1',port),timeout=3) as sock:
            with sock.makefile('rw',encoding='utf-8',newline='\n') as stream:
                if 'QMP' not in json.loads(stream.readline()): return False
                for number, command in enumerate(['qmp_capabilities','system_powerdown']):
                    stream.write(json.dumps({'execute':command,'id':number})+'\n');stream.flush()
                    while True:
                        reply=json.loads(stream.readline())
                        if reply.get('id')==number:
                            if 'error' in reply: return False
                            break
        proc.wait(timeout=30)
        return True
    except (OSError,ValueError,psutil.Error):
        return False


def launch(command, label):
    import psutil
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    with (ROOT/(label+'-'+stamp+'.log')).open('ab') as log:
        proc=subprocess.Popen(command,stdin=subprocess.DEVNULL,stdout=log,stderr=log,
                              creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
    return {'pid':proc.pid,'created':psutil.Process(proc.pid).create_time()}


def ssh_exe():
    found=shutil.which('ssh')
    if not found: raise RuntimeError('OpenSSH client is required.')
    return str(Path(found).resolve())


def tunnel_args(config):
    return [ssh_exe(),'-N','-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes',
            '-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+config['known_hosts'],
            '-o','ExitOnForwardFailure=yes','-o','ConnectTimeout=8','-o','ServerAliveInterval=10',
            '-o','ServerAliveCountMax=2','-i',config['operator_key'],'-p',str(config['ssh_port']),
            '-L',f"127.0.0.1:{config['redis_port']}:127.0.0.1:6379",'root@127.0.0.1']


async def probe(config):
    from dotenv import dotenv_values
    for key,value in dotenv_values(ROOT/'worker.env').items():
        if value is not None: os.environ[key]=value
    sys.path.insert(0,str(BACKEND))
    with redirect_stdout(sys.stderr):
        from app.services.worker_health import worker_health
        result=await worker_health.check(force=True)
    return result


def status(config, state):
    vm=owned_process(state.get('vm'),config['qemu'],config['disk'])
    tunnel=owned_process(state.get('tunnel'),ssh_exe(),f"127.0.0.1:{config['redis_port']}:127.0.0.1:6379")
    try:
        import redis
        redis_ok=bool(redis.Redis(host='127.0.0.1',port=config['redis_port'],socket_timeout=1,
                                 socket_connect_timeout=1).ping())
    except Exception:
        redis_ok=False
    health=asyncio.run(probe(config))
    panic=False
    if state.get('serial') and Path(state['serial']).is_file():
        panic='Kernel panic' in Path(state['serial']).read_text(errors='replace')
    return {'vm_process_owned':bool(vm),'vm_panicked':panic,'execution_worker':health,
            'redis_tunnel_owned':bool(tunnel),'redis_available':redis_ok,
            'ready':bool(vm) and health['available'] and redis_ok and not panic}


def main():
    global ROOT
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state-dir',type=Path,default=ROOT)
    parser.add_argument('action',choices=['configure','start','status','stop'])
    parser.add_argument('--base-disk')
    parser.add_argument('--qemu',default=str(LEGACY/'qemu/qemu-system-x86_64.exe'))
    parser.add_argument('--seed',default=str(LEGACY/'seed-v2.iso'))
    args=parser.parse_args()
    ROOT=args.state_dir.resolve()
    if args.action=='configure':
        if not args.base_disk: parser.error('configure requires --base-disk (a stopped, tested image)')
        print(json.dumps(configure(args)));return
    config_path=ROOT/'config.json'
    if not config_path.is_file(): raise RuntimeError('Run configure with a tested worker image first.')
    config=json.loads(config_path.read_text())
    state_path=ROOT/'state.json'
    state=json.loads(state_path.read_text()) if state_path.is_file() else {}
    if args.action=='stop':
        for key,exe,arg in [('tunnel',ssh_exe(),f"127.0.0.1:{config['redis_port']}:127.0.0.1:6379"),
                            ('vm',config['qemu'],config['disk'])]:
            proc=owned_process(state.get(key),exe,arg)
            if proc and not (key=='vm' and graceful_shutdown(proc,config)):
                proc.terminate();proc.wait(timeout=15)
        print(json.dumps({'stopped_owned_processes':True}));return
    if args.action=='start':
        vm=owned_process(state.get('vm'),config['qemu'],config['disk'])
        if not vm:
            if listening(config['ssh_port']) or listening(config.get('qmp_port',4446)):
                raise RuntimeError('A VM control/SSH port belongs to another process; preserving it.')
            serial=ROOT/('serial-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.log')
            state['vm']=launch(vm_args(config,serial),'qemu');state['serial']=str(serial)
            save(state_path,state)
        deadline=time.monotonic()+120
        while time.monotonic()<deadline:
            if asyncio.run(probe(config))['available']: break
            time.sleep(2)
        else: raise RuntimeError('Worker did not pass sandbox execution health; VM logs preserved, no automatic restart.')
        if not listening(config['redis_port']):
            state['tunnel']=launch(tunnel_args(config),'redis-tunnel');save(state_path,state)
            time.sleep(1)
    result=status(config,state)
    print(json.dumps(result,indent=2))
    if not result['ready']: raise SystemExit(1)


if __name__=='__main__':
    try: main()
    except (OSError,ValueError,RuntimeError,subprocess.SubprocessError) as error:
        print(json.dumps({'ready':False,'error':str(error)}));raise SystemExit(1)
