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


def student(email):
    return SimpleNamespace(email=email, name='Student', profile=SimpleNamespace(
        institution='College', course='Computer Science',
        profile_metadata={'roll_number':'CS01','year':'2nd Year','graduation_year':'2028'}))


class ExecutionAccessTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.local_open = patch.object(settings, 'LOCAL_OPEN_EXECUTION', False)
        self.local_open.start()
        self.addCleanup(self.local_open.stop)

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
            self.assertEqual((await execution_user(student('OWNER@example.com'))).email,'OWNER@example.com')
            for email in ['other@example.com','owner@example.com.attacker.test','notowner@example.com']:
                with self.assertRaises(ValueError): check_execution_access(SimpleNamespace(email=email))

    async def test_named_beta_test_account_gets_only_execution_admission(self):
        with patch.dict('os.environ',{'RAILWAY_ENVIRONMENT_ID':'test-environment'}), \
             patch.object(settings,'EXECUTION_ALLOWED_EMAILS','current-beta@example.com'), \
             patch.object(settings,'BETA_TEST_EMAILS',' qa@example.org '):
            self.assertEqual((await execution_user(student('QA@example.org'))).email,'QA@example.org')
            with self.assertRaises(ValueError): check_execution_access(SimpleNamespace(email='outsider@example.org'))

    async def test_runtime_gate_agrees_with_admission(self):
        from app.security.operator_access import execution_opted_in
        with patch.object(settings,'EXECUTION_ALLOWED_EMAILS',''),patch.object(settings,'BETA_TEST_EMAILS',''):
            with patch.dict('os.environ',{},clear=True):
                self.assertTrue(execution_opted_in())  # an open local install runs notebook and Ubuntu labs too
            with patch.dict('os.environ',{'RAILWAY_ENVIRONMENT_ID':'production'}):
                self.assertFalse(execution_opted_in())
        with patch.dict('os.environ',{'RAILWAY_ENVIRONMENT_ID':'production'}),patch.object(settings,'EXECUTION_ALLOWED_EMAILS','*'):
            self.assertTrue(execution_opted_in())

    async def test_unconfigured_local_development_remains_available(self):
        with patch.dict('os.environ',{},clear=True),patch.object(settings,'EXECUTION_ALLOWED_EMAILS',''):
            check_execution_access(student('local@example.com'))

    async def test_open_local_execution_preserves_profile_and_authentication(self):
        with patch.dict('os.environ',{},clear=True), patch.object(settings,'LOCAL_OPEN_EXECUTION',True), \
             patch.object(settings,'EXECUTION_ALLOWED_EMAILS','another@example.com'):
            check_execution_access(student('student@example.com'))
            with self.assertRaises(ValueError): check_execution_access(None)
            with self.assertRaises(ValueError): check_execution_access(SimpleNamespace(email='student@example.com', is_active=False))
            with self.assertRaises(HTTPException) as caught: check_execution_access(SimpleNamespace(email='student@example.com'))
            self.assertEqual(caught.exception.status_code, 428)

    async def test_local_open_flag_cannot_override_railway_allowlist(self):
        with patch.dict('os.environ',{'RAILWAY_ENVIRONMENT_ID':'production'}), \
             patch.object(settings,'LOCAL_OPEN_EXECUTION',True), patch.object(settings,'EXECUTION_ALLOWED_EMAILS','invited@example.com'), \
             patch.object(settings,'BETA_TEST_EMAILS',''):
            with self.assertRaisesRegex(ValueError,'invited'): check_execution_access(student('student@example.com'))


    async def test_public_railway_execution_requires_active_account_and_profile(self):
        with patch.dict('os.environ', {'RAILWAY_ENVIRONMENT_ID': 'production'}), \
             patch.object(settings, 'EXECUTION_ALLOWED_EMAILS', '*'), \
             patch.object(settings, 'BETA_TEST_EMAILS', ''):
            for email in ('student@example.com', 'another@example.org'):
                self.assertEqual((await execution_user(student(email))).email, email)
            for user in (None, SimpleNamespace(email='student@example.com', is_active=False)):
                with self.assertRaises(ValueError):
                    check_execution_access(user)
            with self.assertRaises(HTTPException) as caught:
                check_execution_access(SimpleNamespace(email='student@example.com'))
            self.assertEqual(caught.exception.status_code, 428)
            check_execution_access(SimpleNamespace(email='student@example.com'), require_profile=False)

    async def test_public_execution_does_not_bypass_legacy_billing(self):
        from app.security.execution_access import legacy_execution_user
        with patch.object(settings, 'BILLING_ENABLED', True):
            with self.assertRaises(HTTPException) as caught:
                await legacy_execution_user(student('student@example.com'))
            self.assertEqual(caught.exception.status_code, 402)
