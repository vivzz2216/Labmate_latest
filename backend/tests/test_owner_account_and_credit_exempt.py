"""Operators skip student setup and credit charging, not authentication."""
import asyncio
from types import SimpleNamespace
import fakeredis
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.database import Base, get_db
from app.main import ensure_owner_account
from app.middleware import csrf
from app.models import User, UserProfile, Upload, AssignmentWorkflow, CreditWallet, WorkflowCreditHold
from app.routers import basic_auth, billing as billing_routes
from app.security.execution_access import check_execution_access, legacy_execution_user
from app.security.operator_access import is_admin_user
from app.services import billing_service as billing

OWNER='operator@example.com'
PASSWORD='owner-fixture-secret'


@pytest.fixture
def env(tmp_path,monkeypatch):
    for name,value in {'ADMIN_USERID':OWNER,'ADMIN_PASSWORD':PASSWORD,'CREDIT_EXEMPT_EMAILS':'',
            'EXECUTION_ALLOWED_EMAILS':OWNER,'BILLING_ENABLED':True,'RAZORPAY_MODE':'test',
            'SECRET_KEY':'fixture-secret-key-that-is-at-least-32-characters'}.items():monkeypatch.setattr(settings,name,value)
    engine=create_engine('sqlite:///'+str(tmp_path/'owner.db'),connect_args={'check_same_thread':False})
    Base.metadata.create_all(engine)
    factory=sessionmaker(bind=engine,expire_on_commit=False)
    ensure_owner_account(engine)
    with factory() as db:
        db.add(User(email='student@example.com',name='Student',is_active=True,password_hash=basic_auth.hash_password('Student!Fixture1')));db.commit()
    app=FastAPI();app.include_router(basic_auth.router,prefix='/api/basic-auth');app.include_router(billing_routes.router,prefix='/api')
    def database():
        with factory() as db:
            yield db
            db.commit()
    app.dependency_overrides[get_db]=database
    monkeypatch.setattr(csrf,'redis_client',fakeredis.FakeRedis())
    with TestClient(app) as client:yield SimpleNamespace(client=client,factory=factory,engine=engine)
    engine.dispose()


def sign_in(env,email=OWNER,password=PASSWORD):
    response=env.client.post('/api/basic-auth/login',json={'email':email,'password':password})
    assert response.status_code==200,response.text
    result=response.json();env.client.headers.update({'Authorization':'Bearer '+result['access_token'],'X-CSRF-Token':result['csrf_token']})
    return result


def test_owner_login_and_empty_profile_skip_onboarding(env):
    sign_in(env)
    profile=env.client.get('/api/basic-auth/profile').json()
    assert profile['is_complete'] is True and profile['onboarding_required'] is False
    assert profile['institution'] is None
    with env.factory() as db:assert db.query(UserProfile).count()==0
    assert env.client.get('/api/billing/wallet').json()['unlimited'] is True


def test_owner_with_partial_profile_still_skips_university_questions(env):
    uid=sign_in(env)['user']['id']
    with env.factory() as db:db.add(UserProfile(user_id=uid,institution='Partial value'));db.commit()
    assert env.client.get('/api/basic-auth/profile').json()['onboarding_required'] is False


def test_student_still_requires_profile_and_normal_credits(env):
    sign_in(env,'student@example.com','Student!Fixture1')
    profile=env.client.get('/api/basic-auth/profile').json()
    assert profile['is_complete'] is False and profile['onboarding_required'] is True
    wallet=env.client.get('/api/billing/wallet').json()
    assert wallet['unlimited'] is False and wallet['billing_enabled'] is True


def test_owner_cannot_be_claimed_with_signup_or_wrong_password(env):
    assert env.client.post('/api/basic-auth/signup',json={'email':OWNER,'password':'Student!Fixture1','name':'Pretender'}).status_code==400
    assert env.client.post('/api/basic-auth/login',json={'email':OWNER,'password':'incorrect'}).status_code==401
    assert env.client.post('/api/basic-auth/signup',json={'email':'new@example.com','password':PASSWORD,'name':'Student'}).status_code==422


def test_owner_runs_with_zero_balance_and_no_credit_hold(env):
    uid=sign_in(env)['user']['id']
    with env.factory() as db:
        billing.wallet(db,uid);db.get(CreditWallet,(uid,'test')).balance=0
        upload=Upload(user_id=uid,filename='owner.docx',original_filename='owner.docx',file_path='fixture',file_type='docx',file_size=10)
        db.add(upload);db.flush()
        workflow=AssignmentWorkflow(upload_id=upload.id,status='ready',questions=[{'id':i,'text':'Print a number.'} for i in range(1,101)])
        db.add(workflow);db.flush();billing.reserve_workflow_credits(db,workflow,uid)
        assert db.get(WorkflowCreditHold,workflow.id) is None
        assert billing.wallet(db,uid)['available']==0 and billing.wallet(db,uid)['unlimited'] is True
        user=db.get(User,uid);check_execution_access(user)
        assert asyncio.run(legacy_execution_user(user)).id==uid


def test_exempt_student_is_not_admin_and_still_needs_beta_admission(env,monkeypatch):
    monkeypatch.setattr(settings,'CREDIT_EXEMPT_EMAILS','student@example.com')
    with env.factory() as db:
        user=db.query(User).filter_by(email='student@example.com').one()
        assert billing.is_credit_exempt(db,user.id) is True and is_admin_user(user) is False
        with pytest.raises(ValueError):check_execution_access(user)


def test_bootstrap_is_idempotent_and_uses_env_password(env,monkeypatch):
    with env.factory() as db:old=db.query(User).filter_by(email=OWNER).one().password_hash
    ensure_owner_account(env.engine)
    with env.factory() as db:assert db.query(User).filter_by(email=OWNER).one().password_hash==old
    monkeypatch.setattr(settings,'ADMIN_PASSWORD','new-fixture-password');ensure_owner_account(env.engine)
    sign_in(env,password='new-fixture-password')


def test_no_builtin_owner_when_admin_env_is_empty(env,monkeypatch):
    monkeypatch.setattr(settings,'ADMIN_USERID','');monkeypatch.setattr(settings,'ADMIN_PASSWORD','')
    ensure_owner_account(env.engine)
    assert is_admin_user(SimpleNamespace(email=OWNER,is_active=True)) is False
    with env.factory() as db:assert db.query(User).count()==2
