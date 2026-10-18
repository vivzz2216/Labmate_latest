"""Run real capability fixtures and write a machine-readable audit matrix."""
import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tests'))
from fixtures.capability_cases import all_cases
from app.config import settings
from app.services.runtime_engine import runtime_engine, run_process
from app.services.evidence_planner import plan_experiment, verification_summary
from app.services.screenshot_service import screenshot_service

async def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',default='audit_artifacts');parser.add_argument('--only',default='');args=parser.parse_args()
 root=Path(args.output).resolve();root.mkdir(parents=True,exist_ok=True)
 settings.REACT_TEMP_DIR=str(root/'workspaces');settings.SCREENSHOT_DIR=str(root/'screenshots')
 results=[]
 for case in all_cases():
  if args.only and args.only not in case['id']: continue
  start=time.perf_counter()
  with patch.object(settings,'EXECUTION_TIMEOUT',case.get('timeout',10)):
   try:
    result=await runtime_engine.execute(case['code'],case['language'],stdin=case.get('stdin'),project_files=case.get('project_files'),routes=case.get('routes'),browser_tests=case.get('browser_tests'),api_tests=case.get('api_tests'),objective=case.get('objective',''))
    checks=[]
    if case.get('blocked'):
     valid=not result.success and result.exit_code==69 and case['blocked'] in result.error
     status='BLOCKED' if valid else 'DEFECT'
    elif case.get('failure'):
     valid=not result.success
     if case['failure']=='compile':valid=valid and result.stages.get('compile')=='failed'
     if case['failure']=='runtime' and case['language'] in {'c','cpp','java'}:valid=valid and result.stages.get('compile')=='passed'
     if case['failure']=='timeout':valid=valid and result.exit_code==124
     status='PASS' if valid else 'DEFECT'
    else:
     valid=result.success and (not case.get('expected') or case['expected'] in result.output)
     if case.get('expected') and plan_experiment(case.get('objective',''),case['language'],case['code'])['category']=='console':
      valid=result.success and bool(result.output.strip()) and result.output.strip().splitlines()[-1]==case['expected']
     if case.get('browser_tests'):valid=valid and result.verification['status']=='passed'
     status='PASS' if valid else 'DEFECT'
    images=list(result.screenshots.values())
    category=plan_experiment(case.get('objective',''),case['language'],case['code'])['category']
    # One representative console transcript per language, plus compile/runtime failure examples.
    if category=='console' and (case['id'].endswith(('hello','console','compile_error','runtime_error'))):
     ok,path,_,_=await screenshot_service.generate_screenshot(case['code'],result.output,'python' if case['language']=='python' else case['language'],job_id=case['id'],filename='source.'+{'python':'py','java':'java','c':'c','cpp':'cpp','node':'js'}[case['language']],view_mode='output',error=result.error,presentation='evidence',language=case['language'],input_echoed=True)
     if ok: images.append(path)
    record={'id':case['id'],'language':case['language'],'category':category,'expected':case.get('expected') or case.get('failure') or case.get('blocked') or 'Required browser/API checks pass',
      'actual_success':result.success,'actual_output':result.output[:2000],'error':result.error[:1000], 'exit_code':result.exit_code,'stages':result.stages,
      'verification':result.verification,'timings':result.timings,'screenshots':images,'status':status,'seconds':round(time.perf_counter()-start,4)}
   except Exception as error:
    record={'id':case['id'],'language':case['language'],'status':'DEFECT','error':repr(error),'seconds':round(time.perf_counter()-start,4)}
  results.append(record)
  print(case['id'],record['status'],str(record.get('seconds'))+'s',record.get('error','')[:100],flush=True)
  (root/'capability-results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
 print('TOTAL',len(results),'PASS',sum(r['status']=='PASS' for r in results),'BLOCKED',sum(r['status']=='BLOCKED' for r in results),'DEFECT',sum(r['status']=='DEFECT' for r in results),flush=True)
 if any(r['status']=='DEFECT' for r in results):raise SystemExit(1)
if __name__=='__main__':asyncio.run(main())
