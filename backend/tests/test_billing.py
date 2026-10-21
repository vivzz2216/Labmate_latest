import asyncio
import hashlib
import hmac
import json
import uuid
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base, get_db
from app.middleware.auth import get_current_user
from app.middleware.csrf import require_csrf_token
from app.models import (AssignmentWorkflow, CreditLedger, CreditWallet, PackPurchase, Upload, User, WorkflowCreditHold)
from app.routers import billing as routes
from app.services import billing_service as billing


@pytest.fixture
def env(tmp_path,monkeypatch):
    for name,value in {'BILLING_ENABLED':True,'BILLING_TRIAL_CREDITS':3,'RAZORPAY_MODE':'test',
        'RAZORPAY_KEY_ID':'rzp_test_fixture','RAZORPAY_KEY_SECRET':'fixture-secret',
        'RAZORPAY_WEBHOOK_SECRET':'fixture-webhook-secret','EXECUTION_ALLOWED_EMAILS':''}.items():
        monkeypatch.setattr(settings,name,value)
    monkeypatch.delenv('RAILWAY_ENVIRONMENT_ID',raising=False)
    engine=create_engine('sqlite:///'+str(tmp_path/'payments.db'),connect_args={'check_same_thread':False,'timeout':20})
    Base.metadata.create_all(engine);factory=sessionmaker(bind=engine,expire_on_commit=False,autoflush=False)
    with factory() as db:
        db.add_all([User(id=1,email='buyer@example.test',name='Buyer'),User(id=2,email='other@example.test',name='Other')]);db.commit()
    app=FastAPI();app.include_router(routes.router,prefix='/api')
    def database():
        with factory() as db:
            try:yield db;db.commit()
            except Exception:db.rollback();raise
    app.dependency_overrides[get_db]=database
    app.dependency_overrides[get_current_user]=lambda:SimpleNamespace(id=1,email='buyer@example.test')
    app.dependency_overrides[require_csrf_token]=lambda:True
    gateway=AsyncMock();monkeypatch.setattr(billing,'gateway_request',gateway)
    with TestClient(app) as client:yield SimpleNamespace(client=client,factory=factory,gateway=gateway,app=app)
    engine.dispose()


def purchase(env,**extra):
    with env.factory() as db:
        row=PackPurchase(id=str(uuid.uuid4()),user_id=1,mode='test',request_key=str(uuid.uuid4()),
            pack_id='quick-lab',amount=2900,currency='INR',credits=10,status='created',
            gateway_order_id='order_fixture',key_id='rzp_test_fixture',**extra)
        db.add(row);db.commit();return row.id


def payment(**changes):
    return {'id':'pay_fixture','order_id':'order_fixture','amount':2900,'currency':'INR',
            'status':'captured','captured':True,'amount_refunded':0,**changes}


def signed(order='order_fixture',payment_id='pay_fixture'):
    return {'razorpay_order_id':order,'razorpay_payment_id':payment_id,'razorpay_signature':
        hmac.new(b'fixture-secret',(order+'|'+payment_id).encode(),hashlib.sha256).hexdigest()}


def credits(env):return env.client.get('/api/billing/wallet').json()


def webhook(env,kind='payment.captured',payload=None,bad=False):
    body=json.dumps({'event':kind,'payload':payload or {'payment':{'entity':payment()}}}).encode()
    signature=hmac.new(b'fixture-webhook-secret',body,hashlib.sha256).hexdigest()
    return env.client.post('/api/billing/webhook',content=body,headers={'X-Razorpay-Signature':'0'*64 if bad else signature})


def test_catalogue_and_wallet_are_server_owned(env):
    data=env.client.get('/api/billing/plans').json()
    assert [(p['amount'],p['credits']) for p in data['packs']]==[(2900,10),(7900,35),(14900,80)]
    assert 'fixture-secret' not in json.dumps(data) and data['mode']=='test'
    assert credits(env)['available']==3
    assert credits(env)['available']==3
    with env.factory() as db:assert db.query(CreditLedger).filter_by(kind='trial').count()==1


def test_amount_and_credits_cannot_be_injected(env):
    for field in ['amount','credits','currency','user_id']:
        r=env.client.post('/api/billing/orders',json={'pack_id':'quick-lab','request_key':str(uuid.uuid4()),field:1})
        assert r.status_code==422
    assert env.client.post('/api/billing/orders',json={'pack_id':'free-hacked','request_key':str(uuid.uuid4())}).status_code==400
    env.gateway.assert_not_called()


def test_create_is_idempotent_and_uses_paise(env):
    env.gateway.return_value={'id':'order_created','amount':2900,'currency':'INR'}
    data={'pack_id':'quick-lab','request_key':str(uuid.uuid4())}
    first=env.client.post('/api/billing/orders',json=data);assert first.status_code==200,first.text
    assert first.json()['amount']==2900 and first.json()['credits']==10
    assert env.client.post('/api/billing/orders',json=data).json()['id']==first.json()['id']
    env.gateway.assert_awaited_once()
    call=env.gateway.call_args
    assert call.kwargs['payload']['amount']==2900 and call.kwargs['payload']['currency']=='INR'
    assert env.client.post('/api/billing/orders',json={**data,'pack_id':'lab-pack'}).status_code==409


def test_unmatched_gateway_order_is_rejected(env):
    env.gateway.return_value={'id':'order_created','amount':1,'currency':'INR'}
    assert env.client.post('/api/billing/orders',json={'pack_id':'quick-lab','request_key':str(uuid.uuid4())}).status_code==502
    assert credits(env)['available']==3


def test_lost_order_creation_response_recovers_by_receipt(env):
    key=str(uuid.uuid4());pid=str(uuid.uuid4())
    with env.factory() as db:
        db.add(PackPurchase(id=pid,user_id=1,mode='test',request_key=key,pack_id='quick-lab',amount=2900,
            credits=10,currency='INR',status='creating',key_id='rzp_test_fixture'));db.commit()
    env.gateway.return_value={'items':[{'id':'order_recovered','amount':2900,'currency':'INR','receipt':'lm_'+pid.replace('-','')}]}
    r=env.client.post('/api/billing/orders',json={'pack_id':'quick-lab','request_key':key})
    assert r.status_code==200 and r.json()['gateway_order_id']=='order_recovered'
    assert env.gateway.call_args.args==('GET','/orders')


def test_foreign_order_and_invalid_signature_never_call_provider(env):
    pid=purchase(env)
    env.app.dependency_overrides[get_current_user]=lambda:SimpleNamespace(id=2,email='other@example.test')
    assert env.client.get('/api/billing/orders/'+pid).status_code==404
    assert env.client.post('/api/billing/orders/'+pid+'/verify',json=signed()).status_code==404
    env.app.dependency_overrides[get_current_user]=lambda:SimpleNamespace(id=1,email='buyer@example.test')
    assert env.client.post('/api/billing/orders/'+pid+'/verify',json={**signed(),'razorpay_signature':'0'*64}).status_code==400
    assert env.client.post('/api/billing/orders/'+pid+'/verify',json=signed(order='order_wrong')).status_code==400
    env.gateway.assert_not_called();assert credits(env)['available']==3


@pytest.mark.parametrize('change',[{'order_id':'order_other'},{'amount':7900},{'currency':'USD'}])
def test_signed_but_mismatched_payment_cannot_grant_credits(env,change):
    pid=purchase(env);env.gateway.return_value=payment(**change)
    assert env.client.post('/api/billing/orders/'+pid+'/verify',json=signed()).status_code==400
    assert credits(env)['available']==3


def test_captured_callback_and_webhook_replays_grant_once(env):
    pid=purchase(env);env.gateway.return_value=payment()
    url='/api/billing/orders/'+pid+'/verify'
    for _ in range(2):assert env.client.post(url,json=signed()).json()['status']=='paid'
    assert webhook(env).status_code==200
    assert webhook(env).json()['duplicate'] is True
    assert credits(env)['available']==13
    with env.factory() as db:assert db.query(CreditLedger).filter_by(kind='pack_purchase').count()==1


def test_authorized_payment_is_captured_for_saved_amount(env):
    pid=purchase(env)
    env.gateway.side_effect=[payment(status='authorized',captured=False),payment(),payment()]
    r=env.client.post('/api/billing/orders/'+pid+'/verify',json=signed());assert r.json()['status']=='paid'
    assert env.gateway.await_args_list[1].args==('POST','/payments/pay_fixture/capture')
    assert env.gateway.await_args_list[1].kwargs['payload']=={'amount':2900,'currency':'INR'}
    assert credits(env)['available']==13


@pytest.mark.parametrize('state',['failed','created','authorized'])
def test_uncaptured_failed_and_cancelled_checkout_do_not_unlock(env,state):
    pid=purchase(env);env.gateway.return_value=payment(status=state,captured=False)
    r=env.client.post('/api/billing/orders/'+pid+'/verify',json=signed())
    assert r.status_code==200 and r.json()['status']=='created'
    assert credits(env)['available']==3


def test_reconcile_recovers_lost_success_callback(env):
    pid=purchase(env);env.gateway.side_effect=[{'items':[payment()]},payment()]
    r=env.client.post('/api/billing/orders/'+pid+'/reconcile');assert r.json()['status']=='paid'
    assert credits(env)['available']==13


def test_webhook_signatures_raw_body_and_refunds(env):
    purchase(env);env.gateway.return_value=payment()
    assert webhook(env,bad=True).status_code==400
    env.gateway.assert_not_called()
    assert webhook(env).status_code==200
    env.gateway.return_value=payment(amount_refunded=1000)
    partial={'refund':{'entity':{'id':'rfnd_partial','payment_id':'pay_fixture'}}}
    assert webhook(env,'refund.processed',partial).status_code==200
    assert credits(env)['available']==9  # ceil(10 * 1000 / 2900) credits reversed
    assert webhook(env,'refund.processed',partial).json()['duplicate']
    env.gateway.return_value=payment(status='refunded',amount_refunded=2900)
    assert webhook(env,'payment.refunded').status_code==200
    assert credits(env)['available']==3
    env.gateway.return_value=payment()  # delayed older captured payload cannot regrant
    webhook(env)
    assert credits(env)['available']==3


def test_test_balances_and_orders_never_unlock_live_mode(env,monkeypatch):
    pid=purchase(env);env.gateway.return_value=payment()
    assert env.client.post('/api/billing/orders/'+pid+'/verify',json=signed()).status_code==200
    monkeypatch.setattr(settings,'RAZORPAY_MODE','live')
    assert not billing.configuration_ready()  # Test key cannot charge a live checkout.
    assert credits(env)['available']==3
    assert env.client.get('/api/billing/orders/'+pid).status_code==404


def add_workflow(env,number=1):
    with env.factory() as db:
        upload=Upload(user_id=1,filename=f'm{number}.pdf',original_filename='manual.pdf',file_path='/unused',file_type='pdf',file_size=1)
        db.add(upload);db.flush()
        w=AssignmentWorkflow(upload_id=upload.id,questions=[{'id':1,'text':'Add two numbers','language':'python'},
            {'id':2,'text':'Reverse a string','language':'python'}],results=[],status='queued')
        db.add(w);db.commit();return w.id


def test_reservation_settlement_and_resume_do_not_charge_failures_twice(env):
    wid=add_workflow(env)
    with env.factory() as db:
        w=db.get(AssignmentWorkflow,wid);billing.reserve_workflow_credits(db,w,1);db.commit()
        assert billing.wallet(db,1)['available']==1
        billing.reserve_workflow_credits(db,w,1);db.commit()  # durable worker reservation
        w.results=[{'id':1,'status':'completed'},{'id':2,'status':'failed'}];db.commit()
        billing.settle_workflow_credits(db,w);db.commit();billing.settle_workflow_credits(db,w);db.commit()
        assert billing.wallet(db,1)['available']==2 and billing.wallet(db,1)['reserved']==0
        billing.reserve_workflow_credits(db,w,1);db.commit()
        w.results=[{'id':1,'status':'completed'},{'id':2,'status':'completed'}];db.commit()
        billing.settle_workflow_credits(db,w);db.commit()
        assert billing.wallet(db,1)['available']==1 and billing.wallet(db,1)['reserved']==0


def test_entire_failed_run_returns_all_reserved_credits(env):
    wid=add_workflow(env)
    with env.factory() as db:
        w=db.get(AssignmentWorkflow,wid);billing.reserve_workflow_credits(db,w,1);db.commit()
        w.results=[{'id':1,'status':'failed'}];db.commit();billing.settle_workflow_credits(db,w);db.commit()
        assert billing.wallet(db,1)['available']==3


def test_concurrent_runs_cannot_overspend_the_same_balance(env):
    ids=[add_workflow(env,n) for n in [1,2]]
    with env.factory() as db:billing.wallet(db,1);db.commit()
    def reserve(wid):
        with env.factory() as db:
            try:billing.reserve_workflow_credits(db,db.get(AssignmentWorkflow,wid),1);db.commit();return True
            except HTTPException as e:db.rollback();assert e.status_code==402;return False
    with ThreadPoolExecutor(max_workers=2) as pool:assert sum(pool.map(reserve,ids))==1
    assert credits(env)['available']==1 and credits(env)['reserved']==2


def test_checkout_requires_authentication_csrf_and_beta_access(env,monkeypatch):
    data={'pack_id':'quick-lab','request_key':str(uuid.uuid4())}
    env.app.dependency_overrides[require_csrf_token]=lambda:(_ for _ in ()).throw(HTTPException(403,'CSRF required'))
    assert env.client.post('/api/billing/orders',json=data).status_code==403
    env.app.dependency_overrides[require_csrf_token]=lambda:True
    env.app.dependency_overrides[get_current_user]=lambda:(_ for _ in ()).throw(HTTPException(401,'Sign in'))
    assert env.client.post('/api/billing/orders',json=data).status_code==401
    env.app.dependency_overrides[get_current_user]=lambda:SimpleNamespace(id=1,email='buyer@example.test')
    monkeypatch.setattr(settings,'EXECUTION_ALLOWED_EMAILS','invited@example.test')
    assert env.client.post('/api/billing/orders',json=data).status_code==403
    env.gateway.assert_not_called()


@pytest.mark.parametrize('scenario',['timeout','unauthorized','invalid_json','invalid_shape'])
def test_gateway_transport_errors_are_recoverable_without_exposing_credentials(monkeypatch,scenario):
    import asyncio
    import httpx
    monkeypatch.setattr(settings,'BILLING_ENABLED',True)
    monkeypatch.setattr(settings,'RAZORPAY_MODE','test')
    monkeypatch.setattr(settings,'RAZORPAY_KEY_ID','rzp_test_transport')
    monkeypatch.setattr(settings,'RAZORPAY_KEY_SECRET','private-fixture-secret')
    real_client=httpx.AsyncClient
    def respond(request):
        assert request.url.host=='api.razorpay.com'
        if scenario=='timeout':raise httpx.ConnectTimeout('private-fixture-secret',request=request)
        if scenario=='unauthorized':return httpx.Response(401,json={'error':'private-fixture-secret'})
        if scenario=='invalid_json':return httpx.Response(200,text='not-json private-fixture-secret')
        return httpx.Response(200,json=['unexpected'])
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kwargs:real_client(transport=httpx.MockTransport(respond),**kwargs))
    with pytest.raises(HTTPException) as failure:
        asyncio.run(billing.gateway_request('GET','/orders'))
    assert failure.value.status_code==503
    assert 'private-fixture-secret' not in failure.value.detail


@pytest.mark.parametrize('mode', ['test', 'live'])
def test_retired_payment_shortcut_never_creates_captured_payments(env, monkeypatch, mode):
    pid = purchase(env)
    with env.factory() as db:
        db.get(PackPurchase, pid).mode = mode
        db.commit()
    monkeypatch.setattr(settings, 'RAZORPAY_MODE', mode)
    response = env.client.post(f'/api/billing/orders/{pid}/test-pay')
    assert response.status_code == 410
    assert credits(env)['available'] == 3
    env.gateway.assert_not_called()
    with env.factory() as db:
        assert db.get(PackPurchase, pid).status == 'created'
        assert db.query(CreditLedger).filter_by(kind='pack_purchase').count() == 0


def test_gateway_failure_never_fabricates_a_test_order(env):
    env.gateway.side_effect = HTTPException(503, 'Gateway unavailable')
    key = str(uuid.uuid4())
    response = env.client.post('/api/billing/orders', json={'pack_id':'quick-lab','request_key':key})
    assert response.status_code == 503
    assert credits(env)['available'] == 3
    with env.factory() as db:
        row = db.query(PackPurchase).filter_by(request_key=key).one()
        assert row.status == 'creating' and row.gateway_order_id is None
        receipt = 'lm_' + row.id.replace('-', '')
    env.gateway.side_effect = None
    env.gateway.return_value = {'items':[{'id':'order_recovered','receipt':receipt,'amount':2900,'currency':'INR'}]}
    recovered = env.client.post('/api/billing/orders', json={'pack_id':'quick-lab','request_key':key})
    assert recovered.status_code == 200
    assert recovered.json()['gateway_order_id'] == 'order_recovered'
    assert credits(env)['available'] == 3


