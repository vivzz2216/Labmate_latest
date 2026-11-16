"""Read-only manual verification; no model calls, database writes or host shell fallback.

Run from backend with its virtualenv: python scripts/verify_unix_manuals.py INPUT OUTPUT
Live execution is explicitly blocked until the isolated Ubuntu probe succeeds.
"""
import asyncio
import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.services import assignment_workflow as workflow
from app.services.unix_manual import unix_manual_tasks
from app.services.parser_service import ParserService
from app.services.lab_question_filter import is_actionable_lab_question
from app.services.ubuntu_runtime import capture_ubuntu

EXPECTED = {
    'Lab 1 Unix.pdf': (['1A','1B'], ['architecture','partitions']),
    'Expt2.pdf': (['2'], ['human readable','Hierarchy']),
    'expt 3 unix.pdf': (['3'], ['tcpdump','MAC address']),
    'expt4 unix.pdf': (['4'], ['umask','mkdir a']),
    'expt5.pdf': (['5'], ['groupmod','PPID']),
    'Expt 7.docx': (['7'], ['even or odd','current shell']),
    'expt8.docx': (['8'], ['sed','script']),
    'expt 9a.docx': (['9A'], ['matched characters','number of files']),
    'expt 9b.docx': (['9B'], ['Fibonacci','certain columns']),
    'expt 10.docx': (['10'], ['prime','leap year']),
}


async def main(source, output):
    output.mkdir(parents=True,exist_ok=True)
    results=[]
    for filename,(labels,requirements) in EXPECTED.items():
        item={'file':filename,'extraction':'failed','workflow':'not tested','execution':'not tested'}
        try:
            path=source/filename
            upload=SimpleNamespace(file_path=str(path),file_type=path.suffix[1:],original_filename=filename)
            text=workflow.document_text(upload)
            (output/(path.stem+'.txt')).write_text(text,encoding='utf-8')
            for mode in ['code_only','theory_and_code']:
                tasks=unix_manual_tasks(text,mode=mode)
                assert [q['experiment_label'] for q in tasks]==labels
                assert all(q['language']==('theory' if q['experiment_label']=='1A' else 'ubuntu') for q in tasks)
                practical='\n'.join(q['text'] for q in tasks).lower()
                for requirement in requirements:assert requirement.lower() in practical, 'Missing '+requirement
                assert all(is_actionable_lab_question(q['text'],q['language']) for q in tasks if q['language']=='ubuntu')
                state=SimpleNamespace(upload_id=1,mode=mode,batch_id=None)
                session=MagicMock();session.__enter__.return_value.get.side_effect=[state,upload]
                generation=AsyncMock(side_effect=AssertionError('Unexpected model call'))
                with patch.object(workflow,'SessionLocal',return_value=session),patch.object(workflow,'document_text',return_value=text),\
                     patch.object(workflow,'record'),patch.object(workflow.generation_service,'generate_json',generation):
                    await workflow._extract_assignment(1)
                assert state.status=='ready'
                generation.assert_not_awaited()
            parser=ParserService()
            with patch.object(parser,'_extract_tasks_with_openai',side_effect=AssertionError('Unexpected model call')):
                fallback=parser._extract_tasks_from_lines(text.splitlines())
            assert [q['experiment_label'] for q in fallback]==labels
            item.update(extraction='passed',workflow='passed (both modes)',fallback_parser='passed',
                        experiment_labels=labels,characters=len(text),questions=unix_manual_tasks(text,mode='code_only'))
        except Exception as error:item['error']=str(error)
        results.append(item)
        print(filename,item['extraction'],flush=True)
    probe=await capture_ubuntu('printf "LabMate isolated Ubuntu probe\\n"; uname -s','probe.sh',objective='Print the operating system name.')
    for item in results:
        item['execution']='not tested (probe passed)' if probe.success else 'blocked (isolated Ubuntu unavailable)'
    summary={'files':results,'all_labs_verified':False,'api_calls':0,'api_tokens':0,'runtime_probe':{
        'passed':probe.success,'error':probe.error,'output':probe.output,'verification':probe.verification},
        'notice':'The runtime probe is not a manual execution test. No assignment is declared executed or verified.'}
    (output/'results.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding='utf-8')
    lines=['# Unix manual verification','', '| Manual | Extraction | Workflow | Live execution |',
           '|---|---|---|---|']
    lines += [f"| {r['file']} | {r['extraction']} | {r['workflow']} | {r['execution']} |" for r in results]
    lines += ['',f"Runtime probe: {'passed' if probe.success else 'blocked'}.",probe.error,
              '', 'AI API calls: 0. Tokens: 0.', '',summary['notice'],
              '', 'Installation/partitioning and external networking still need genuine evidence. '
              'Reference examples never change verification status.']
    (output/'UNIX_TEST_RESULTS.md').write_text('\n'.join(lines),encoding='utf-8')
    if not all(r['extraction']=='passed' for r in results):raise SystemExit(1)
    if not probe.success:raise SystemExit(2)


if __name__=='__main__':
    asyncio.run(main(Path(sys.argv[1]),Path(sys.argv[2])))
