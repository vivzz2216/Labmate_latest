import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.config import settings
from app.security.execution_access import check_execution_access, execution_user
from fastapi import HTTPException
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.database import get_db
from app.middleware.auth import get_current_user


class ExecutionAccessTests(unittest.IsolatedAsyncioTestCase):
    def test_all_execution_submission_routes_reject_noninvited_users(self):
        from app.routers import run, tasks, workflows
        app=FastAPI()
        for router in (run.router,tasks.router,workflows.router): app.include_router(router,prefix='/api')
        app.dependency_overrides[get_current_user]=lambda:SimpleNamespace(id=1,email='outsider@example.com')
        app.dependency_overrides[get_db]=lambda:None
        with patch.object(settings,'EXECUTION_ALLOWED_EMAILS','owner@example.com'),TestClient(app) as client:
            for path,body in [('/api/run',{'upload_id':1,'task_ids':[1]}),('/api/tasks/submit',{'file_id':1,'tasks':[]}),('/api/workflows/1/process',{'questions':[{'id':1,'text':'Build an HTML form','language':'html'}]})]:
                with self.subTest(path=path):
                    response=client.post(path,json=body)
                    self.assertEqual(response.status_code,403,response.text)
                    self.assertIn('invited',response.json()['detail'])
            response=client.post('/api/workflows/batch-upload',files={'files':('test.docx',b'fake','application/octet-stream')})
            self.assertEqual(response.status_code,403,response.text)

    async def test_railway_execution_is_closed_without_invites(self):
        with patch.dict('os.environ',{'RAILWAY_ENVIRONMENT_ID':'test-environment'}),patch.object(settings,'EXECUTION_ALLOWED_EMAILS',''):
            with self.assertRaisesRegex(ValueError,'closed'):
                check_execution_access(SimpleNamespace(email='student@example.com'))
            with self.assertRaises(HTTPException) as caught:
                await execution_user(SimpleNamespace(email='student@example.com'))
            self.assertEqual(caught.exception.status_code,403)

    async def test_invites_are_case_insensitive_exact_accounts(self):
        with patch.object(settings,'EXECUTION_ALLOWED_EMAILS',' owner@example.com, beta@example.com '):
            self.assertEqual((await execution_user(SimpleNamespace(email='OWNER@example.com'))).email,'OWNER@example.com')
            for email in ['other@example.com','owner@example.com.attacker.test','notowner@example.com']:
                with self.assertRaises(ValueError): check_execution_access(SimpleNamespace(email=email))

    async def test_unconfigured_local_development_remains_available(self):
        with patch.dict('os.environ',{},clear=True),patch.object(settings,'EXECUTION_ALLOWED_EMAILS',''):
            check_execution_access(SimpleNamespace(email='local@example.com'))
