"""Real-provider manual regression. Private artifacts stay in the supplied folder.

This exercises the same generation/execution helper as queued workflows. It does
not claim browser coverage of LabMate's own UI. No credentials are saved.
"""
import argparse
import asyncio
import json
import os
import hashlib
import sys
from copy import deepcopy
from dataclasses import asdict
from pathlib import Path


async def main(args):
    from dotenv import dotenv_values
    allowed={'FREE_LLM_FALLBACK_ORDER','OPENROUTER_API_KEY','OPENROUTER_MODEL','OPENROUTER_REASONING_EFFORT','OPENCODE_ENABLED','OPENCODE_API_KEY','OPENCODE_MODEL','FREE_LLM_REQUEST_TIMEOUT','FREE_LLM_MAX_TOKENS','LLM_PROVIDER','LLM_FALLBACK_PROVIDER','GROQ_API_KEY','GROQ_MODEL','GROQ_FALLBACK_MODEL','GROQ_MAX_COMPLETION_TOKENS','GROQ_REASONING_EFFORT','GEMINI_API_KEY','GEMINI_MODEL'}
    for name in args.config:
        os.environ.update({k:v for k,v in dotenv_values(name).items() if k in allowed and v is not None and (v or k in {'LLM_FALLBACK_PROVIDER','GROQ_FALLBACK_MODEL'})})
    os.environ['USE_DOCKER']='false'
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
    from app.config import settings
    from app.services.assignment_workflow import execute_web_assignment, document_text
    from app.services.generation_service import generation_service, GenerationUnavailableError
    from app.services.manual_sections import numbered_experiments
    from types import SimpleNamespace
    root=Path(args.output).resolve();root.mkdir(parents=True,exist_ok=True)
    settings.SCREENSHOT_DIR=str(root/'screenshots')
    settings.REACT_TEMP_DIR=str(Path(__file__).resolve().parents[1]/'audit_artifacts/local-app/runtime')
    manual=Path(args.manual).resolve()
    original=document_text(SimpleNamespace(file_type=manual.suffix[1:],file_path=str(manual)))
    questions=numbered_experiments(original)
    (root/'run.json').write_text(json.dumps({'manual':str(manual),'sha256':hashlib.sha256(manual.read_bytes()).hexdigest(),
        'experiments_extracted':len(questions),'primary_model':settings.GROQ_MODEL,'backup_model':settings.GROQ_FALLBACK_MODEL,
        'completion_cap':settings.GROQ_MAX_COMPLETION_TOKENS,'replays':args.replay,
        'replay_provenance':args.replay_provenance},indent=2),encoding='utf-8')
    (root/'extracted.json').write_text(json.dumps(questions,indent=2),encoding='utf-8')
    generate=generation_service.generate_json
    call=0
    current_question_id=None
    replays={int(item.split('=',1)[0]):json.loads(Path(item.split('=',1)[1]).read_text(encoding='utf-8')) for item in args.replay}
    async def traced(*a,**kw):
        nonlocal call
        call+=1
        answer=deepcopy(replays[current_question_id]) if current_question_id in replays else await generate(*a,**kw)
        (root/f'generation_{call:02}.json').write_text(json.dumps(answer,indent=2),encoding='utf-8')
        return answer
    generation_service.generate_json=traced
    results=[]
    for q in questions:
        if args.ids and q['id'] not in args.ids: continue
        current_question_id=q['id']
        print('EXPERIMENT',q['id'],q['language'],flush=True)
        try:
            data,project,result=await execute_web_assignment(q['text'],q['language'],f'audit_{q["id"]}','Audit Student',
                lambda attempt,delay,status: retry(attempt,delay,status),
                lambda n: print('ATTEMPT',q['id'],n+1,flush=True))
            replay_source=('engineer-reviewed complete solution, no live provider call' if args.replay_provenance=='engineer_reviewed'
                           else 'recorded provider response replay, no model call')
            record={'id':q['id'],'source':replay_source if q['id'] in replays else 'real configured provider, shared workflow helper',
                'generated':data,'project':project,'execution':asdict(result)}
            (root/f'experiment_{q["id"]:02}.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
            results.append({'id':q['id'],'status':'passed' if result.success else 'failed','error':result.error})
            print('RESULT',q['id'],results[-1]['status'],result.error[:180].encode('ascii','backslashreplace').decode(),flush=True)
        except GenerationUnavailableError as error:
            results.append({'id':q['id'],'status':'provider_unavailable','error':str(error)})
            print('PROVIDER UNAVAILABLE',q['id'],str(error),flush=True)
            break
        finally:
            (root/'summary.json').write_text(json.dumps(results,indent=2),encoding='utf-8')


async def retry(attempt,delay,status):
    print('PROVIDER RETRY',attempt,round(delay,1),status,flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--manual',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--config',action='append',default=[])
    parser.add_argument('--ids',nargs='*',type=int)
    parser.add_argument('--replay',action='append',default=[],help='EXPERIMENT_NUMBER=recorded_generation.json; use --ids to select only these cases')
    parser.add_argument('--replay-provenance',choices=['recorded_provider','engineer_reviewed'],default='recorded_provider',
                        help='Explicitly identify reviewed solutions instead of claiming live provider generation.')
    asyncio.run(main(parser.parse_args()))
