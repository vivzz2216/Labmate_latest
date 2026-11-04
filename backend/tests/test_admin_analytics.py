"""Owner-only reads, exact payment accounting, and aggregate fan-out regressions."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.models import User, UserProfile, Upload, AssignmentWorkflow, Report, PackPurchase, CreditWallet, Subscription
from app.routers import admin, basic_auth
from app.security.jwt import create_access_token


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setattr(settings, 'ADMIN_USERID', 'owner@example.com')
    monkeypatch.setattr(settings, 'ADMIN_PASSWORD', 'fixture-owner-password')
    monkeypatch.setattr(settings, 'RAZORPAY_MODE', 'test')
    engine = create_engine('sqlite://', connect_args={'check_same_thread':False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    now = datetime.now(timezone.utc)
    with factory() as db:
        for uid, name, email, days, active in [(1,'Owner','owner@example.com',0,True),
            (2,'Asha 100%','asha@example.com',2,True),(3,'Bharat','bharat@example.com',40,True),
            (4,'Cara','cara@example.com',40,False)]:
            db.add(User(id=uid,name=name,email=email,is_active=active,created_at=now-timedelta(days=50),last_login=now-timedelta(days=days)))
        db.flush()
        db.add(UserProfile(user_id=2,institution='Example College',course='Computer Science'))
        for uid, owner in [(1,2),(2,2),(3,3),(4,1)]:
            db.add(Upload(id=uid,user_id=owner,filename='manual.docx',original_filename='manual.docx',file_path='/fixture/manual.docx',file_type='docx',file_size=100,uploaded_at=now-timedelta(days=1)))
        db.flush()
        for uid, state in [(1,'completed'),(2,'processing'),(3,'failed'),(4,'completed')]:
            db.add(AssignmentWorkflow(upload_id=uid,status=state,updated_at=now))
        for n in range(2):
            db.add(Report(upload_id=1,filename=f'report{n}.docx',file_path=f'/fixture/report{n}',file_size=50))
        db.add(Subscription(user_id=4,plan='legacy',is_active=True))  # Access grant is not payment proof.
        def purchase(key, user, amount, refund=0, mode='live', status='paid', captured=True, currency='INR'):
            db.add(PackPurchase(id=key,user_id=user,request_key=key,mode=mode,pack_id='lab-pack',
                amount=amount,currency=currency,credits=3,status=status,key_id='fixture-key',
                gateway_order_id='order_'+key,gateway_payment_id='pay_'+key if captured else None,
                fulfilled_at=now if captured else None,refunded_amount=refund))
        purchase('one',2,2900)
        purchase('two',2,7900,1000,status='partly_refunded')
        purchase('full',3,2900,2900,status='refunded')
        purchase('pending',2,14900,status='created',captured=False)
        purchase('unverified',2,99999,captured=False)
        purchase('simulation',2,14900,mode='test')
        purchase('owner',1,99999)
        purchase('foreign',2,10000,currency='USD')
        db.add_all([CreditWallet(user_id=2,mode='live',balance=5,reserved=1),CreditWallet(user_id=2,mode='test',balance=2,reserved=0)])
        db.commit()
    app=FastAPI();app.include_router(admin.router,prefix='/api');app.include_router(basic_auth.router,prefix='/api/basic-auth')
    def connection():
        with factory() as db:yield db
    app.dependency_overrides[get_db]=connection
    with TestClient(app) as client:
        yield SimpleNamespace(client=client,factory=factory)
    engine.dispose()


def headers(uid=1, **claims):
    return {'Authorization':'Bearer '+create_access_token({'sub':str(uid),**claims})}


@pytest.mark.parametrize('path',['/overview','/users','/payments','/feedback','/ping'])
def test_admin_data_denies_anonymous_and_students_even_with_spoofed_claims(env,path):
    assert env.client.get('/api/admin'+path).status_code in {401,403}
    r=env.client.get('/api/admin'+path,headers=headers(2,is_admin=True,role='admin',email='owner@example.com'))
    assert r.status_code==403
    assert 'asha@example.com' not in r.text


def test_no_http_basic_fallback_and_disabled_owner_is_denied(env):
    assert env.client.get('/api/admin/overview',auth=('owner@example.com','fixture-owner-password')).status_code in {401,403}
    with env.factory() as db:
        db.get(User,1).is_active=False;db.commit()
    assert env.client.get('/api/admin/overview',headers=headers()).status_code==403


def test_revenue_excludes_test_pending_owner_and_foreign_currency_and_nets_refunds(env):
    response=env.client.get('/api/admin/overview',headers=headers());assert response.status_code==200,response.text
    assert response.headers['cache-control']=='private, no-store'
    data=response.json()
    assert data['total_students']==3 and data['enabled_students']==2 and data['active_students_7d']==2
    assert (data['uploads_total'],data['completed_manuals'],data['running_manuals'],data['reports_total'],data['failed_or_paused_manuals'])==(3,1,1,2,1)
    assert data['revenue']['live']=={'gross_paise':13700,'refunds_paise':3900,'net_paise':9800,'captured_orders':3,'paying_students':1}
    assert data['revenue']['test']['net_paise']==14900


def test_students_aggregate_once_and_search_filters_are_bounded(env):
    r=env.client.get('/api/admin/users',headers=headers(),params={'search':'%'});assert r.status_code==200,r.text
    data=r.json();assert data['total']==1
    student=data['users'][0]
    assert student['name']=='Asha 100%' and student['institution']=='Example College'
    assert (student['uploads_total'],student['completed_manuals'],student['reports_total'],student['net_paid_paise'],student['paid_orders'])==(2,1,2,9800,2)
    assert student['credits']['live']=={'balance':5,'reserved':1}
    assert 'password_hash' not in student
    paid=env.client.get('/api/admin/users',headers=headers(),params={'paid':True}).json()
    assert paid['total']==1
    free=env.client.get('/api/admin/users',headers=headers(),params={'paid':False}).json()
    assert free['total']==2
    page=env.client.get('/api/admin/users',headers=headers(),params={'limit':1,'offset':1}).json()
    assert page['total']==3 and len(page['users'])==1
    assert env.client.get('/api/admin/users',headers=headers(),params={'search':"' OR 1=1 --"}).json()['total']==0
    assert env.client.get('/api/admin/users',headers=headers(),params={'limit':1000}).status_code==422


def test_payment_pages_separate_modes_and_do_not_expose_gateway_secrets(env):
    data=env.client.get('/api/admin/payments',headers=headers(),params={'mode':'test'}).json()
    assert data['total']==1 and data['payments'][0]['mode']=='test'
    assert 'key_id' not in data['payments'][0]
    assert env.client.get('/api/admin/payments',headers=headers(),params={'mode':'invalid'}).status_code==422


def test_me_role_is_server_derived_not_jwt_claim(env):
    assert env.client.get('/api/basic-auth/me',headers=headers(2,is_admin=True)).json()['is_admin'] is False
    assert env.client.get('/api/basic-auth/me',headers=headers()).json()['is_admin'] is True


def test_admin_mutation_requires_csrf_and_students_cannot_call_it(env):
    r=env.client.post('/api/admin/subscription/2',headers=headers(),json={'is_active':True})
    assert r.status_code==403
    r=env.client.post('/api/admin/subscription/2',headers=headers(2),json={'is_active':True})
    assert r.status_code==403


def test_empty_database_and_unconfigured_owner_fail_closed(env,monkeypatch):
    with env.factory() as db:
        for table in reversed(Base.metadata.sorted_tables):db.execute(table.delete())
        db.add(User(id=1,email='owner@example.com',name='Owner'));db.commit()
    response=env.client.get('/api/admin/overview',headers=headers());assert response.status_code==200,response.text
    assert response.json()['total_students']==0 and response.json()['revenue']['live']['net_paise']==0
    monkeypatch.setattr(settings,'ADMIN_PASSWORD','')
    assert env.client.get('/api/admin/overview',headers=headers()).status_code==403
