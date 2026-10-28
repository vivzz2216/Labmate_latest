"""Lifecycle checks must never stop arbitrary processes or overwrite VM images."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest


@pytest.fixture
def local():
    path=Path(__file__).parents[1]/'scripts/local_worker.py'
    spec=importlib.util.spec_from_file_location('local_lifecycle',path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize('saved_time,exe,args,owned',[
    (10,'ssh.exe',['-L','127.0.0.1:6379:127.0.0.1:6379'],True),
    (11,'ssh.exe',['-L','127.0.0.1:6379:127.0.0.1:6379'],False),
    (10,'other.exe',['-L','127.0.0.1:6379:127.0.0.1:6379'],False),
    (10,'ssh.exe',['unrelated-session'],False),
])
def test_process_ownership_requires_identity_start_time_and_command(local,monkeypatch,saved_time,exe,args,owned):
    import psutil
    process=SimpleNamespace(exe=lambda:exe,create_time=lambda:10,cmdline=lambda:args)
    monkeypatch.setattr(psutil,'Process',lambda pid:process)
    result=local.owned_process({'pid':100,'created':saved_time},'ssh.exe','127.0.0.1:6379:127.0.0.1:6379')
    assert (result is process) is owned


def test_vm_start_is_headless_and_binds_ssh_only_to_loopback(local):
    config={'qemu':'qemu.exe','disk':'copy.qcow2','seed':'seed.iso','cpu':'qemu64','memory_mb':4096,'cpus':1,'ssh_port':2226}
    command=local.vm_args(config,Path('serial.log'))
    assert 'file=copy.qcow2,if=virtio,format=qcow2' in command
    assert any('hostfwd=tcp:127.0.0.1:2226-:22' in arg for arg in command)
    assert command[command.index('-vga')+1]=='none'


def test_configure_preserves_existing_state(local,tmp_path,monkeypatch):
    monkeypatch.setattr(local,'ROOT',tmp_path)
    (tmp_path/'config.json').write_text('keep')
    run=Mock(side_effect=AssertionError('must not run qemu-img'))
    monkeypatch.setattr(local.subprocess,'run',run)
    with pytest.raises(RuntimeError,match='Already configured'):
        local.configure(SimpleNamespace(base_disk='unused'))
    assert (tmp_path/'config.json').read_text()=='keep'
    run.assert_not_called()


def test_shutdown_never_contacts_foreign_qmp_listener(local,monkeypatch):
    import psutil
    foreign=SimpleNamespace(pid=200,status=psutil.CONN_LISTEN,laddr=SimpleNamespace(ip='127.0.0.1',port=4446))
    monkeypatch.setattr(psutil,'net_connections',lambda **kwargs:[foreign])
    connect=Mock(side_effect=AssertionError('foreign QMP must not receive powerdown'))
    monkeypatch.setattr(local.socket,'create_connection',connect)
    assert local.graceful_shutdown(SimpleNamespace(pid=100),{}) is False
    connect.assert_not_called()
