"""Real mixed execution acceptance; no LLM calls and no automatic VM restarts."""
import argparse
import asyncio
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
import time


async def run(args):
    from app.services.runtime_engine import runtime_engine
    from app.services.worker_health import worker_health
    cases=[('python','print(sum(range(101)))','5050'),
           ('c','#include <stdio.h>\nint main(){puts("5050");}','5050'),
           ('html','<h1>Stable browser execution</h1>','Stable browser execution'),
           ('colab','print(sum(range(101)))','5050')]
    started=time.monotonic();total=0
    args.output.mkdir(parents=True,exist_ok=True)
    def record(row):
        row['time']=datetime.now(timezone.utc).isoformat()
        with (args.output/'jobs.jsonl').open('a') as f: f.write(json.dumps(row)+'\n')
        print(json.dumps(row),flush=True)
    try:
        while time.monotonic()-started<args.duration:
            if args.serial_log and 'Kernel panic' in args.serial_log.read_text(errors='replace'):
                raise RuntimeError('Kernel panic recorded; refusing automatic recovery during acceptance.')
            if not (await worker_health.check(force=True))['available']:
                raise RuntimeError('Authenticated sandbox execution health failed.')
            language,code,expected=cases[total%len(cases)]
            result=await runtime_engine.execute(code,language)
            total+=1
            row={'elapsed_seconds':round(time.monotonic()-started,2),'job':total,'language':language,
                 'success':result.success and expected in result.output,'screenshots':len(result.screenshots),
                 'error':result.error}
            record(row)
            if not row['success']: raise RuntimeError('Execution or output verification failed.')
            await asyncio.sleep(min(args.interval,max(0,args.duration-(time.monotonic()-started))))
        summary={'status':'passed','duration_seconds':round(time.monotonic()-started,2),'jobs':total}
    except Exception as error:
        summary={'status':'failed','duration_seconds':round(time.monotonic()-started,2),'jobs':total,'error':str(error)}
    (args.output/'result.json').write_text(json.dumps(summary,indent=2))
    record(summary)
    return 0 if summary['status']=='passed' else 1


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--duration',type=float,default=7200)
    parser.add_argument('--interval',type=float,default=15)
    parser.add_argument('--env-file',type=Path)
    parser.add_argument('--serial-log',type=Path)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if args.duration<1 or args.interval<0: parser.error('duration must be positive and interval nonnegative')
    if args.output.exists() and any(args.output.iterdir()): parser.error('use a fresh output directory to preserve earlier evidence')
    if args.env_file:
        from dotenv import dotenv_values
        for key,value in dotenv_values(args.env_file).items():
            if value is not None: os.environ[key]=value
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
    raise SystemExit(asyncio.run(run(args)))


if __name__=='__main__':main()
