"""Trusted checks on observed program results, separate from generated assertions."""
import json
import re
from collections import Counter, defaultdict


EVENT_PREFIX = 'LABMATE_EVENT '


def semantic_failures(objective, output, language=''):
    failures=[]
    for line in str(output or '').splitlines():
        if re.search(r'(?i)^\s*(?:CHECK\s+FAILED\b|FAIL(?:ED)?\s*:|INCONSISTENCY\b)|\bINCONSISTENCY at\b|\b->\s*FAIL\b|\bMatch:\s*False\b',line):
            failures.append('Observed failed program check: '+line.strip()[:240])
    text=objective.lower()
    if re.search(r'perceptron|logic gates?|truth table',text) and re.search(r'\b(?:and|or|xor)\b',text):
        for match in re.finditer(r'(?i)accuracy\s*:\s*(\d+(?:\.\d+)?)\s*(%)?',output or ''):
            value=float(match[1]);value=value/100 if match[2] or value>1 else value
            if value < .999999:failures.append('Logic-gate classification must match every truth-table row; observed accuracy '+match[0])
        for match in re.finditer(r'(?i)Predictions:\s*\[([^\]]+)\]\s*Targets:\s*\[([^\]]+)\]',output or ''):
            pred=[float(x) for x in re.findall(r'-?\d+(?:\.\d+)?',match[1])]
            target=[float(x) for x in re.findall(r'-?\d+(?:\.\d+)?',match[2])]
            if pred != target:failures.append('Observed predictions do not match the truth-table targets.')
    if language != 'distributed':return list(dict.fromkeys(failures))
    events=[]
    for line in str(output or '').splitlines():
        if line.startswith(EVENT_PREFIX):
            try:
                event=json.loads(line[len(EVENT_PREFIX):])
                if not isinstance(event,dict):raise ValueError()
                events.append(event)
            except (ValueError,TypeError):failures.append('Invalid distributed event receipt.')
    try:
        if re.search(r'mutual exclusion|token ring|ricart',text):
            active=set();entered=set();exited=set();times=[]
            for event in events:
                if event.get('type') not in {'cs_enter','cs_exit'}:continue
                node=event['node'];stamp=event['time_ns']
                if not isinstance(stamp,int) or isinstance(stamp,bool):raise ValueError('Invalid critical-section time.')
                times.append((stamp,event['type'],str(node)))
            if not times:raise ValueError('Missing critical-section event evidence.')
            for stamp,kind,node in sorted(times,key=lambda e:(e[0],e[1]!='cs_exit')):
                if kind=='cs_enter':
                    if active:raise ValueError('Critical sections overlap.')
                    active.add(node);entered.add(node)
                else:
                    if node not in active:raise ValueError('Unmatched critical-section exit.')
                    active.remove(node);exited.add(node)
            if active or len(entered)<2 or entered!=exited:raise ValueError('Incomplete critical-section participation or shutdown.')
        elif re.search(r'lamport|logical clocks?',text):
            sends={};receives={};clocks={}
            for event in events:
                if event.get('type') not in {'clock_local','clock_send','clock_receive'}:continue
                node=str(event['node']);clock=event['clock']
                if type(clock) is not int or clock<=clocks.get(node,0):raise ValueError('Node clock did not increase.')
                clocks[node]=clock
                if event['type']=='clock_send':
                    key=event['message_id']
                    if key in sends:raise ValueError('Message IDs must be unique.')
                    sends[key]=(node,str(event['target']),clock)
                elif event['type']=='clock_receive':
                    key=event['message_id']
                    if key in receives:raise ValueError('Duplicate receive event.')
                    receives[key]=(str(event['source']),node,clock)
            if not sends or set(sends)!=set(receives):raise ValueError('Missing matching send and receive events.')
            for key,(source,target,clock) in sends.items():
                recv=receives[key]
                if recv[:2]!=(source,target) or recv[2]<=clock:raise ValueError('Lamport happens-before relation failed.')
        elif re.search(r'bully|leader election',text):
            elected=[e for e in events if e.get('type')=='leader_elected']
            if not elected:raise ValueError('Missing leader-election evidence.')
            for e in elected:
                alive=e['alive']
                if not alive or any(type(x) is not int for x in alive) or e['node']!=max(alive):raise ValueError('Elected leader is not the highest surviving node.')
        elif 'mapreduce' in text or 'map reduce' in text:
            results=[e for e in events if e.get('type')=='mapreduce_result']
            if not results:raise ValueError('Missing MapReduce input/result evidence.')
            for e in results:
                if not isinstance(e['inputs'],list) or not all(isinstance(x,str) for x in e['inputs']):raise ValueError('Invalid mapper inputs.')
                expected=Counter(word for part in e['inputs'] for word in part.split())
                if dict(expected)!=e['counts']:raise ValueError('Reducer counts differ from the actual input word counts.')
        elif re.search(r'shared memory|key.value|consistency|replica',text):
            states=defaultdict(dict)
            for e in events:
                if e.get('type')=='replica_state':states[str(e['key'])][str(e['node'])]=(e['value'],e['version'])
            if not states:raise ValueError('Missing final replica-state evidence.')
            for key,values in states.items():
                if len(values)<2 or any(v!=next(iter(values.values())) for v in values.values()):raise ValueError('Final replicas disagree for '+key)
    except (KeyError,TypeError,ValueError) as error:
        failures.append('Distributed behavior verification failed: '+str(error))
    return list(dict.fromkeys(failures))


def distributed_instructions():
    return '''
Verify actual observations, not labels. Emit one JSON object per line prefixed LABMATE_EVENT (no other text on that line):
- Mutual exclusion: {"type":"cs_enter"|"cs_exit","node":node_id,"time_ns":System.nanoTime()}. Each node must enter and exit; no overlap. Use one poison pill per waiting node and bounded joins; never leave a node blocked. Track first entry with a per-node boolean, not a global pass-number/id comparison.
- Lamport: {"type":"clock_local"|"clock_send"|"clock_receive","node":id,"clock":integer,"message_id":"m1","target":receiver_id,"source":sender_id}. Emit applicable fields, and carry the identical stable message_id in send/receive. Do not parse human-readable labels to match messages.
- Bully: {"type":"leader_elected","node":integer,"alive":[surviving integer IDs]}. Winner is max(alive); stop all listeners/threads when done.
- MapReduce: {"type":"mapreduce_result","inputs":[actual input partitions],"counts":{word:integer}}. Count whitespace-separated words without hidden normalization.
- Replication/DSM: emit final {"type":"replica_state","key":key,"node":node_id,"value":actual_value,"version":integer} for every replica and key after conflict repair. Use the same deterministic version/value ordering on writes AND reads, or increment the authoritative version before repair. A rejected conflicting write is not an acknowledgement of the committed value. Assert all replicas agree, throwing on failure.
- RMI: provide separate // File: Server.java and // File: Client.java programs with public main methods and a Remote interface file. Client uses LocateRegistry.getRegistry("127.0.0.1", port), never the server's in-memory registry object. Server binds and prints READY; client tests real remote calls and exits nonzero if incorrect.
Threads in one JVM are local simulations. Do not describe them as separate processes or cloud machines. Use complete Java 17 stdlib source and no external dependencies. Do not print fictitious success or topology evidence.
'''
