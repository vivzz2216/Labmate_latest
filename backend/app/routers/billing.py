import hashlib
import hmac
import json
import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..middleware.auth import get_current_user
from ..middleware.csrf import require_csrf_token
from ..models import PackPurchase, PaymentWebhookEvent, User
from ..security.execution_access import check_execution_access
from ..services import billing_service as billing

router = APIRouter(prefix='/billing', tags=['billing'])


class OrderInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    pack_id: str = Field(max_length=32)
    request_key: UUID


class VerifyInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    razorpay_order_id: str = Field(pattern=r'^order_[A-Za-z0-9]{1,56}$')
    razorpay_payment_id: str = Field(pattern=r'^pay_[A-Za-z0-9]{1,56}$')
    razorpay_signature: str = Field(pattern=r'^[a-f0-9]{64}$')


@router.get('/plans')
def plans():
    return {'packs': [{**p, 'currency': 'INR'} for p in billing.PACKS],
        'trial_credits': max(0, min(settings.BILLING_TRIAL_CREDITS, 100)),
        'mode': settings.RAZORPAY_MODE, 'checkout_available': billing.configuration_ready(),
        'billing_enabled': settings.BILLING_ENABLED}


@router.get('/wallet')
def balance(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return billing.wallet(db, user.id)


@router.post('/orders')
async def order(data: OrderInput, user: User = Depends(get_current_user),
                db: Session = Depends(get_db), csrf: bool = Depends(require_csrf_token)):
    try:
        check_execution_access(user)
    except ValueError:
        raise HTTPException(403, 'Packs are currently available to invited beta accounts only.') from None
    return await billing.create_order(db, user.id, data.pack_id, str(data.request_key))


@router.get('/orders/{purchase_id}')
def order_status(purchase_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return billing.order_view(db, billing.owned_purchase(db, str(purchase_id), user.id))


@router.post('/orders/{purchase_id}/verify')
async def verify(purchase_id: UUID, data: VerifyInput, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db), csrf: bool = Depends(require_csrf_token)):
    return await billing.verify_checkout(db, user.id, str(purchase_id), data.razorpay_order_id,
        data.razorpay_payment_id, data.razorpay_signature)


@router.post('/orders/{purchase_id}/reconcile')
async def reconcile(purchase_id: UUID, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db), csrf: bool = Depends(require_csrf_token)):
    return await billing.reconcile_order(db, user.id, str(purchase_id))


@router.post('/orders/{purchase_id}/test-pay')
async def test_pay(purchase_id: UUID, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db), csrf: bool = Depends(require_csrf_token)):
    if settings.RAZORPAY_MODE != 'test':
        raise HTTPException(403, 'Test payments are only available when RAZORPAY_MODE is test.')
    return await billing.simulate_test_payment(db, user.id, str(purchase_id))



@router.post('/webhook')
async def webhook(request: Request, db: Session = Depends(get_db)):
    # No browser JWT or CSRF: this endpoint authenticates the untouched body.
    secret = settings.RAZORPAY_WEBHOOK_SECRET
    if not secret or not billing.configuration_ready():
        raise HTTPException(503, 'Payment webhook is not configured.')
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 131072: raise HTTPException(413, 'Webhook payload is too large.')
    signature = request.headers.get('X-Razorpay-Signature', '')
    expected = hmac.new(secret.encode(), bytes(body), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(400, 'Invalid webhook signature.')
    try:
        event = json.loads(body)
        if not isinstance(event, dict) or not isinstance(event.get('payload'), dict): raise ValueError()
    except (ValueError, TypeError):
        raise HTTPException(400, 'Invalid webhook event.') from None
    event_id = 'body:' + hashlib.sha256(body).hexdigest()
    if db.get(PaymentWebhookEvent, event_id): return {'received': True, 'duplicate': True}
    kind, payload = event.get('event'), event['payload']
    if kind not in {'payment.captured', 'order.paid', 'refund.processed', 'payment.refunded'}:
        return {'received': True, 'ignored': True}
    def entity(name):
        value = payload.get(name, {})
        return value.get('entity', {}) if isinstance(value, dict) and isinstance(value.get('entity', {}), dict) else {}
    payment_id = entity('payment').get('id') or entity('refund').get('payment_id')
    order_id = entity('payment').get('order_id') or entity('order').get('id')
    if payment_id:
        if not re.fullmatch(r'pay_[A-Za-z0-9]{1,56}', str(payment_id)): raise HTTPException(400, 'Invalid payment identifier.')
        payment = await billing.gateway_request('GET', '/payments/' + payment_id)
        order_id = payment.get('order_id')
    else:
        payment = None
    purchase = db.query(PackPurchase).filter_by(gateway_order_id=order_id, mode=settings.RAZORPAY_MODE).first() if order_id else None
    if purchase:
        if payment:
            billing.apply_payment(db, purchase.id, payment)
        else:
            await billing.reconcile_order(db, purchase.user_id, purchase.id)
    db.add(PaymentWebhookEvent(id=event_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()  # A concurrent delivery already committed the same event.
    return {'received': True}
