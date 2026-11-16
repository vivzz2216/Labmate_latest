"""Run the real Unix extraction/generation/execution/report pipeline in a private test DB.

No production accounts, credits, uploads or cloud resources are changed.
Resumes the saved test workflows and preserves every failure diagnostic.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
os.environ.update(EXECUTION_BACKEND='ssh',EXECUTION_ISOLATION='required',
                  BILLING_ENABLED='false',STORAGE_BACKEND='local',LLM_PROVIDER='glm',
                  FREE_LLM_FALLBACK_ORDER='',DEEPSEEK_ENABLED='false',GLM_ENABLED='true')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.database import Base
from app.models import User,UserProfile,Upload,AssignmentWorkflow,Report
from app.services import assignment_workflow as flow
from docx import Document
from app.services.unix_requirements import runtime_diagnostics,validate_unix_semantics


async def main(source,output,selected):
    output=output.resolve();output.mkdir(parents=True,exist_ok=True)
    settings.SCREENSHOT_DIR=str(output/'screenshots');settings.REPORT_DIR=str(output/'reports')
    settings.EXECUTION_ALLOWED_EMAILS='unix-local-audit@example.invalid'
    settings.GLM_MAX_TOKENS=6500
    engine=create_engine('sqlite:///'+(output/'workflows.db').as_posix(),connect_args={'check_same_thread':False})
    Base.metadata.create_all(engine);factory=sessionmaker(bind=engine)
    flow.SessionLocal=factory
    with factory() as db:
        user=db.query(User).filter_by(email='unix-local-audit@example.invalid').first()
        if not user:
            user=User(email='unix-local-audit@example.invalid',name='Vivzz',is_active=True,
                profile=UserProfile(institution='St Francis Institute of Technology',course='Information Technology',
                    profile_metadata={'roll_number':'UNIX01','year':'2nd Year','graduation_year':'2028'}))
            db.add(user);db.commit()
        uid=user.id
    summary=json.loads((output/'results.json').read_text(encoding='utf-8')) if (output/'results.json').exists() else []
    for path in sorted(source.iterdir()):
        if path.suffix.lower() not in {'.pdf','.docx'} or (selected and path.name not in selected):continue
        with factory() as db:
            upload=db.query(Upload).filter_by(user_id=uid,original_filename=path.name).first()
            if not upload:
                upload=Upload(user_id=uid,filename=path.name,original_filename=path.name,file_path=str(path),
                    file_type=path.suffix[1:],file_size=path.stat().st_size)
                db.add(upload);db.flush()
                wf=AssignmentWorkflow(upload_id=upload.id,status='extracting',stage='extract',mode='code_only',
                    language='auto',questions=[],results=[],output_name=path.stem.replace(' ','_')+'_output',
                    instructions='Implement all practical and post-lab tasks with finite sample input. '
                    'Keep comments concise and lines readable. For unavailable operations, disclose exactly what was not executed.')
                db.add(wf);db.commit()
            else:wf=db.query(AssignmentWorkflow).filter_by(upload_id=upload.id).one()
            invalid=[]
            for result in wf.results or []:
                if result.get('language')!='ubuntu':continue
                try:validate_unix_semantics(result.get('code',''),result.get('question',''))
                except ValueError as error:invalid.append(str(error))
                invalid.extend(runtime_diagnostics(result.get('output','')))
            if invalid:
                wf.status='failed';wf.error='Audit rejected cached results: '+'; '.join(invalid)
                wf.results=[{**result,'status':'failed','error':wf.error} for result in wf.results]
                db.commit()
            wid=wf.id
            must_extract=not wf.questions
            previous_status=wf.status
        if must_extract:await flow.extract_assignment(wid)
        with factory() as db:
            wf=db.get(AssignmentWorkflow,wid)
            if wf.questions and wf.status!='completed':
                wf.status='processing';wf.stage='generate';db.commit();run=True
            else:run=False
        print('RUN',path.name,'workflow',wid,flush=True)
        if run:await flow.process_assignment(wid)
        with factory() as db:
            wf=db.get(AssignmentWorkflow,wid)
            record={'file':path.name,'workflow_id':wid,'status':wf.status,'error':wf.error,'results':wf.results}
            if wf.report_id:
                report=db.get(Report,wf.report_id)
                document=Document(report.file_path)
                record.update(report=report.file_path,word_images=len(document.inline_shapes),word_paragraphs=len(document.paragraphs))
            summary=[entry for entry in summary if entry['file']!=record['file']]+[record]
            print('RESULT',path.name,wf.status,wf.error,'frames',sum(len(r.get('screenshot_paths',[])) for r in wf.results),flush=True)
            (output/'results.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding='utf-8')
    engine.dispose()


if __name__=='__main__':
    asyncio.run(main(Path(sys.argv[1]),Path(sys.argv[2]),sys.argv[3:]))
