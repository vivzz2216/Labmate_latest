"""Preserve scanned UNIX command exercises instead of misclassifying them as Python."""
import re


def unix_manual_tasks(text, mode="theory_and_code"):
    if not re.search(r'\bUNIX\s+LAB\b|\bUbuntu\s+(?:OS|Operating System)\b|\bITL\s*402\b',text,re.I):return []
    pattern=re.compile(r'^\s*(?:Experiment|Expt\.?)\s*[-–—:]?\s*([1-9]\d{0,2}[A-Z]?|IA)\s*[:.)–—-]\s*(.*)$',re.M|re.I)
    headings=list(pattern.finditer(text))
    if not headings:return []
    tasks=[]
    for i,match in enumerate(headings):
        label=match.group(1).upper().replace('IA','1A')
        source=text[match.start():headings[i+1].start() if i+1<len(headings) else len(text)].strip()
        if len(source)>15000:raise ValueError('UNIX exercise exceeds 15000 characters; split this manual.')
        original_source = source
        from .lab_question_filter import programming_lines
        if mode == 'code_only' and re.search(r'Laboratory\s+Exercise', source, re.I):
            source = '\n'.join(programming_lines(source.splitlines(), mode=mode))
        theory=bool(re.search(r'Prepare a document on the following',original_source,re.I))
        tasks.append({'id':i+1,'text':source,'language':'theory' if theory else 'ubuntu',
                      'is_theory':theory,'experiment_label':label,'manual_text':original_source})
    if len(tasks)>100:raise ValueError('Assignments are limited to 100 experiments.')
    if len({q['experiment_label'] for q in tasks})!=len(tasks):raise ValueError('Duplicate UNIX experiment labels require review.')
    return tasks
