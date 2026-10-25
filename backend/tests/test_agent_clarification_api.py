import tempfile
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base,get_db
from app.models import User,Upload,AssignmentWorkflow
from app.middleware.csrf import require_csrf_token
from app.security.execution_access import execution_user
from app.routers.workflows import router


class ClarificationTests(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.engine=create_engine('sqlite:///'+self.folder.name.replace('\\','/')+'/test.db',connect_args={'check_same_thread':False})
        Base.metadata.create_all(self.engine);self.factory=sessionmaker(bind=self.engine,expire_on_commit=False)
        with self.factory() as db:
            self.user=User(email='owner@example.com',name='Owner');other=User(email='other@example.com',name='Other');db.add_all([self.user,other]);db.flush()
            self.ids=[]
            for user in [self.user,other]:
                upload=Upload(user_id=user.id,filename='x.docx',original_filename='x.docx',file_path='fixture',file_type='docx',file_size=1);db.add(upload);db.flush()
                wf=AssignmentWorkflow(upload_id=upload.id,status='awaiting_clarification',agent_plan={'revision':1,'questions':[{'id':'topic-9','prompt':'Topic?','options':['Restaurant']}],'answers':{}});db.add(wf);self.ids.append(upload.id)
            db.commit()
        app=FastAPI();app.include_router(router,prefix='/api')
        def database():
            with self.factory() as db:yield db
        app.dependency_overrides[get_db]=database
        app.dependency_overrides[execution_user]=lambda:self.user
        app.dependency_overrides[require_csrf_token]=lambda:True
        self.client=TestClient(app)

    def tearDown(self):
        self.client.close();self.engine.dispose();self.folder.cleanup()

    def test_answers_persist_and_duplicate_submission_is_rejected(self):
        path=f'/api/workflows/{self.ids[0]}/clarify'
        payload={'revision':1,'answers':{'topic-9':'Restaurant'}}
        response=self.client.post(path,json=payload)
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['status'],'queued')
        self.assertEqual(response.json()['agent_plan']['answers'],payload['answers'])
        self.assertEqual(self.client.post(path,json=payload).status_code,409)

    def test_stale_revision_other_owner_missing_and_extra_answers_are_rejected(self):
        path=f'/api/workflows/{self.ids[0]}/clarify'
        self.assertEqual(self.client.post(path,json={'revision':2,'answers':{'topic-9':'Restaurant'}}).status_code,409)
        for answers in [{},{'unknown':'value'},{'topic-9':''}]:
            self.assertEqual(self.client.post(path,json={'revision':1,'answers':answers}).status_code,422)
        self.assertEqual(self.client.post(f'/api/workflows/{self.ids[1]}/clarify',json={'revision':1,'answers':{'topic-9':'Restaurant'}}).status_code,404)
