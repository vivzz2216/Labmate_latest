"""Independent field checks against an unchanged recorded registration project.

No model calls or source repairs. This supplements, rather than replaces, the
model's scenarios. Artifacts and all evidence stay in the supplied output folder.
"""
import argparse
import asyncio
import json
import sys
from dataclasses import asdict
from pathlib import Path


async def main(args):
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
    from app.config import settings
    from app.services.browser_scenarios import normalize_v2
    from app.services.runtime_engine import runtime_engine
    record=json.loads(Path(args.record).read_text(encoding='utf-8'))
    project=record['project']
    output=Path(args.output).resolve();output.mkdir(parents=True,exist_ok=True)
    settings.SCREENSHOT_DIR=str(output/'screenshots')
    settings.REACT_TEMP_DIR=str(output/'runtime')
    def step(action,target='',value='',kind='testid'):
        return dict(action=action,locator_type=kind,locator=target,role='',value=value)
    valid={'name-input':'Audit Student','email-input':'audit@example.test','phone-input':'9876543210',
           'course-select':'Computer Science','password-input':'valid-password'}
    errors={'name-input':('','Name is required.'),'email-input':('invalid','Enter a valid email address.'),
            'phone-input':('123','Phone must be exactly 10 digits.'),'course-select':('Select a course','Please select a course.'),
            'password-input':('123','Password must be at least 6 characters.')}
    plans=[]
    for field,(invalid,error) in errors.items():
        steps=[step('select' if key=='course-select' else 'fill',key,value) for key,value in valid.items()]
        steps += [step('select' if field=='course-select' else 'fill',field,invalid),step('click','submit-button'),
                  step('assert_visible',error,kind='text'),step('assert_absent','success-message')]
        plans.append(dict(version=2,name='Independent invalid '+field,requirement_ids=[],viewport={'width':1366,'height':768},steps=steps))
    plans.append(dict(version=2,name='Independent valid submission',requirement_ids=[],viewport={'width':1366,'height':768},
                      steps=[step('select' if key=='course-select' else 'fill',key,value) for key,value in valid.items()]+
                      [step('click','submit-button'),step('assert_visible','Registration successful!',kind='text')]))
    project['browser_tests']=normalize_v2(plans)
    result=await runtime_engine.execute(project['project_files'][project['entrypoint']],'html',project_files=project['project_files'],
        project_config=project,browser_tests=project['browser_tests'],interaction_is_required=True)
    (output/'result.json').write_text(json.dumps({'source_record':str(Path(args.record).resolve()),
        'provenance':'Independent audit scenarios, unchanged recorded provider source, no model calls',
        'execution':asdict(result)},indent=2),encoding='utf-8')
    print(json.dumps({'success':result.success,'error':result.error,'tests':len((result.verification or {}).get('tests',[]))}))
    if not result.success:raise SystemExit(1)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--record',required=True);parser.add_argument('--output',required=True)
    asyncio.run(main(parser.parse_args()))
