import importlib.util
from pathlib import Path
import pytest
from app.services.unix_command_lab import command_lab_plan

spec=importlib.util.spec_from_file_location('console_validation',Path(__file__).parents[1]/'scripts/ubuntu_console.py')
console=importlib.util.module_from_spec(spec);spec.loader.exec_module(console)


def test_utility_plan_covers_all_ten_postlab_questions_without_a_script():
    plan=command_lab_plan('UNIX general purpose utility commands: mkdir, cal, logout, bc.')
    console.validate_plan(plan)
    questions=[step for step in plan['steps'] if step['label'].startswith('Post lab')]
    assert len(questions)==10
    assert [step['command'] for step in questions[:7]]==[
        'ls -lh','ls -lt','ls -R',"date '+%A (%a)'","date '+%D'","date '+%T'","date '+%U'"]
    assert not any('.sh' in step['command'] for step in plan['steps'])
    assert any(step.get('view')=='files' for step in plan['steps'])
    assert any(step.get('view')=='editor' for step in plan['steps'])


def test_network_plan_runs_a_local_service_and_actual_packet_capture():
    plan=command_lab_plan('UNIX networking commands: nslookup, whois, tcpdump, traceroute.')
    console.validate_plan(plan)
    assert plan['network_scope']=='private_loopback_fixtures'
    commands='\n'.join(step['command'] for step in plan['steps'])
    assert '-port=5353 student.lab 127.0.0.1' in commands
    assert 'tcpdump -nn -r /tmp/packets.pcap' in commands
    assert 'google.com' not in commands and '.sh' not in commands
    assert command_lab_plan('UNIX write a shell script to add two numbers') is None


@pytest.mark.parametrize('command',['pwd\nwhoami','pwd\x1b[2J','reboot','shutdown now'])
def test_one_enter_cannot_hide_extra_command_lines_or_power_changes(command):
    with pytest.raises(ValueError):console.validate_plan({'version':1,'steps':[{'command':command}]})


def test_native_views_cannot_escape_the_lab_directory():
    with pytest.raises(ValueError):console.validate_plan({'version':1,'steps':[{
        'command':'ls','view':'files','view_path':'../.ssh'}]})


def test_network_mac_answer_distinguishes_loopback_from_physical_hardware():
    from app.services.unix_theory import unix_postlab_notes
    notes=unix_postlab_notes("How do you find out your machine's MAC address?")
    assert len(notes)==1 and 'ip link show' in notes[0]
    assert 'not a physical Ethernet MAC address' in notes[0]


def test_student_filenames_contents_and_shell_metacharacters_are_safe():
    plan=command_lab_plan('UNIX Experiment 2: general purpose utility commands mkdir cal logout bc',
                          student_name="Vivzz O'Brien; $(id)",roll_no='42')
    console.validate_plan(plan)
    creation=next(s for s in plan['steps'] if s['command'].startswith('cat > '))
    assert creation['command']=='cat > Vivzz_Exp2.txt'
    assert "Student: Vivzz O'Brien; $(id)" in creation['input']
    assert 'Roll number: 42' in creation['input']
    import shlex
    echo=next(s for s in plan['steps'] if s['command'].startswith('echo '))
    assert shlex.split(echo['command'])==['echo',"Vivzz O'Brien; $(id) - UNIX practical 2"]
    assert all('notes.txt' not in s['command'] for s in plan['steps'])


@pytest.mark.parametrize('kind,objective,label',[
    ('permissions','UNIX chmod chown split comm','4'),
    ('administration','UNIX fdisk useradd groupmod htop','5'),
    ('shell','UNIX basic Shell scripting','7'),
    ('sed','UNIX shell script programming and sed','8'),
    ('grep','grep/ egrep script programming','9A'),
    ('awk','AWK script programming','9B'),
    ('perl','perl script programming','10'),
])
def test_remaining_curricula_are_bounded_personalised_and_keep_complete_source(kind,objective,label):
    plan=command_lab_plan(objective,student_name='Vivzz',experiment_number=label)
    console.validate_plan(plan)
    assert plan['curriculum']==kind and plan['profile']['stem']=='Vivzz_Exp'+label
    for step in plan['steps']:
        if step['command'].startswith('cat > '):assert 'Vivzz' in step['input']
        if step.get('view')=='editor':
            assert len(step['input'].splitlines())<=22


def test_administrator_capability_rejects_changed_command_input_and_metadata():
    import copy
    plan=command_lab_plan('UNIX fdisk useradd groupmod htop',student_name='Vivzz',experiment_number='5')
    for mutation in ('command','input','metadata'):
        bad=copy.deepcopy(plan)
        if mutation=='metadata':bad['profile']['stem']='other'
        else:bad['steps'][0][mutation]='mount -o remount,rw /usr'
        with pytest.raises(ValueError,match='fixed trusted curriculum'):console.validate_plan(bad)


def test_password_inputs_wait_for_each_prompt_and_reject_unbounded_prompts():
    plan=command_lab_plan('UNIX fdisk useradd groupmod htop',student_name='Vivzz',experiment_number='5')
    step=next(s for s in plan['steps'] if s['command'].startswith('passwd '))
    assert step['input_prompts']==['New password:','Retype new password:']
    for prompts in [['one'],['x'*101,'two']]:
        with pytest.raises(ValueError,match='one bounded prompt'):
            console.validate_plan({'version':1,'steps':[{'command':'read','input':'a\nb\n','input_prompts':prompts}]})


def test_extended_theory_and_mkdir_operand_order_are_explained():
    from app.services.unix_theory import unix_postlab_notes
    notes=unix_postlab_notes('Explain absolute and relative file path. Explain file access modes. mkdir a a/b',{'stem':'Vivzz_Exp4'})
    assert len(notes)==3
    assert '/home/ubuntu/Vivzz_Exp4.txt' in notes[0]
    assert 'owner, group and others' in notes[1]
    assert 'order of the operands matters' in notes[2]


def test_explicit_manual_filenames_and_values_are_not_replaced_by_sample_fixtures():
    objective='UNIX general purpose utility commands: mkdir cal logout bc.'
    assert command_lab_plan(objective+' Create the file college.txt with the given contents.') is None
    assert command_lab_plan('UNIX perl script programming, temperature: 35') is None
    plan=command_lab_plan('UNIX perl script programming. Save as filename.pl',student_name='Vivzz',experiment_number='10')
    assert plan
    assert any(s['input'].startswith('#!/usr/bin/perl') for s in plan['steps'] if s.get('view')=='editor')
    assert any(s['command'].startswith('chmod u+x ') for s in plan['steps'])


def test_background_internet_description_is_not_a_public_network_exercise():
    from app.services.ubuntu_runtime import requires_public_network
    text='UNIX LAB\nExperiment 3: Networking\nTheory\nThe Internet connects networks.\nLaboratory Exercise\nA. Procedure\nExplain UNIX commands with syntax and example:\nnslookup, whois, traceroute, tcpdump.'
    assert not requires_public_network(text)
    assert requires_public_network('Run nslookup google.com.')
    assert requires_public_network('Test an external server using traceroute.')
