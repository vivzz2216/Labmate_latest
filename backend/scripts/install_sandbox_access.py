"""Operator-only setup of a forced-command key; never copies a private key to the worker."""
import os
from pathlib import Path
import pwd
import subprocess

account = pwd.getpwnam('labmate')
public = Path('/tmp/sandbox_identity.pub').read_text().strip()
if not public.startswith('ssh-ed25519 ') or '\n' in public: raise ValueError('Invalid public key.')
ssh = Path(account.pw_dir) / '.ssh'
ssh.mkdir(mode=0o700, exist_ok=True)
os.chown(ssh, account.pw_uid, account.pw_gid)
keys = ssh / 'authorized_keys'
old = keys.read_text() if keys.exists() else ''
entry = 'restrict,command="sudo -n /usr/bin/python3 /opt/labmate-runtime/broker.py" ' + public
if entry not in old: keys.write_text(old.rstrip() + '\n' + entry + '\n')
os.chown(keys, account.pw_uid, account.pw_gid)
keys.chmod(0o600)
sudo = Path('/etc/sudoers.d/labmate-runtime')
sudo.write_text('labmate ALL=(root) NOPASSWD: /usr/bin/python3 /opt/labmate-runtime/broker.py\n')
sudo.chmod(0o440)
subprocess.run(['visudo','-cf',str(sudo)], check=True)
print('Restricted sandbox SSH access configured.')
