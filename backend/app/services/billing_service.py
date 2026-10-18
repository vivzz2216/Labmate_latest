"""Server-priced packs, captured-payment verification, and transactional credits."""
import hashlib
import hmac
import math
import re
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from ..config import settings
from ..models import (CreditWallet, CreditLedger, PackPurchase, WorkflowCreditHold)

PACKS = (
    {'id': 'quick-lab', 'name': 'Quick Lab', 'amount': 2900, 'credits': 10,
     'description': 'For your next set of practicals.', 'featured': False},
    {'id': 'lab-pack', 'name': 'Lab Pack', 'amount': 7900, 'credits': 35,
     'description': 'Room for a few lab manuals.', 'featured': True},
    {'id': 'semester-pack', 'name': 'Semester Pack', 'amount': 14900, 'credits': 80,
     'description': 'Keep several subjects moving.', 'featured': False},
)
PACK_BY_ID = {p['id']: p for p in PACKS}
GATEWAY = 'https://api.razorpay.com/v1'
ID_PATTERN = r'^[A-Za-z0-9_]{5,64}$'


def configuration_ready():
    return (settings.BILLING_ENABLED and settings.RAZORPAY_MODE in {'test', 'live'}
            and settings.RAZORPAY_KEY_ID.startswith('rzp_' + settings.RAZORPAY_MODE + '_')
            and bool(settings.RAZORPAY_KEY_SECRET))


def require_gateway():
    if not configuration_ready():
        raise HTTPException(503, 'Checkout is temporarily unavailable. Please try again later.')


def wallet(db, user_id, mode=None):
    mode = mode or settings.RAZORPAY_MODE
    # Both supported database dialects offer conflict-safe first-use provisioning.
    dialect = db.get_bind().dialect.name
    if dialect == 'postgresql':
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    trial = max(0, min(settings.BILLING_TRIAL_CREDITS, 100))
    db.execute(insert(CreditWallet).values(user_id=user_id, mode=mode, balance=trial, reserved=0)
               .on_conflict_do_nothing(index_elements=['user_id', 'mode']))
    db.execute(insert(CreditLedger).values(user_id=user_id, mode=mode,
        reference=f'trial:{mode}:{user_id}', kind='trial', delta=trial)
        .on_conflict_do_nothing(index_elements=['reference']))
    row = db.get(CreditWallet, (user_id, mode), populate_existing=True)
    return {'available': row.balance, 'reserved': row.reserved, 'mode': mode,
            'billing_enabled': settings.BILLING_ENABLED}


def ledger(db, user_id, mode, reference, kind, delta):
    db.add(CreditLedger(user_id=user_id, mode=mode, reference=reference, kind=kind, delta=delta))


def settle_workflow_credits(db, workflow):
    hold = db.get(WorkflowCreditHold, workflow.id, populate_existing=True)
    if not hold or hold.state != 'held':
        return
    completed = {r['id'] for r in (workflow.results or []) if r.get('status') == 'completed'}
    used = min(hold.amount, len(completed - set(hold.baseline_ids)))
    changed = db.execute(update(WorkflowCreditHold).where(
        WorkflowCreditHold.workflow_id == workflow.id, WorkflowCreditHold.state == 'held')
        .values(state='settled'), execution_options={'synchronize_session': False})
    if changed.rowcount != 1:
        return
    refund = hold.amount - used
    db.execute(update(CreditWallet).where(CreditWallet.user_id == hold.user_id,
        CreditWallet.mode == hold.mode).values(balance=CreditWallet.balance + refund,
        reserved=CreditWallet.reserved - hold.amount), execution_options={'synchronize_session': False})
    ledger(db, hold.user_id, hold.mode, 'release:' + hold.run_token, 'unused_returned', refund)


def reserve_workflow_credits(db, workflow, user_id):
    if not settings.BILLING_ENABLED:
        return
    existing = db.get(WorkflowCreditHold, workflow.id, populate_existing=True)
    if existing and existing.state == 'held':
        return  # The durable worker can resume an already reserved run.
    baseline = [r['id'] for r in (workflow.results or []) if r.get('status') == 'completed']
    count = sum(q['id'] not in baseline for q in workflow.questions)
    mode = settings.RAZORPAY_MODE
    wallet(db, user_id, mode)
    changed = db.execute(update(CreditWallet).where(CreditWallet.user_id == user_id,
        CreditWallet.mode == mode, CreditWallet.balance >= count)
        .values(balance=CreditWallet.balance - count, reserved=CreditWallet.reserved + count),
        execution_options={'synchronize_session': False})
    if changed.rowcount != 1:
        raise HTTPException(402, f'This run needs {count} experiment credits. Top up a pack on the homepage to continue.')
    token = str(uuid.uuid4())
    if existing:
        existing.mode, existing.run_token, existing.amount = mode, token, count
        existing.baseline_ids, existing.state = baseline, 'held'
    else:
        db.add(WorkflowCreditHold(workflow_id=workflow.id, user_id=user_id, mode=mode,
            run_token=token, amount=count, baseline_ids=baseline, state='held'))
    ledger(db, user_id, mode, 'reserve:' + token, 'run_reserved', -count)


async def gateway_request(method, path, payload=None, params=None):
    require_gateway()
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(20), follow_redirects=False) as client:
            response = await client.request(method, GATEWAY + path,
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET), json=payload, params=params)
    except httpx.HTTPError:
        raise HTTPException(503, 'Payment confirmation is unavailable. Check the order status before trying another payment.') from None
    if not response.is_success:
        raise HTTPException(503, 'Razorpay could not complete this request. No credits have been added; check payment status before retrying.')
    try:
        body = response.json()
        if not isinstance(body, dict): raise ValueError()
        return body
    except ValueError:
        raise HTTPException(503, 'Razorpay returned an incomplete response. Please check the order status.') from None


def owned_purchase(db, purchase_id, user_id):
    row = db.get(PackPurchase, purchase_id, populate_existing=True)
    if not row or row.user_id != user_id or row.mode != settings.RAZORPAY_MODE:
        raise HTTPException(404, 'Payment order not found.')
    return row


def order_view(db, row):
    return {'id': row.id, 'pack_id': row.pack_id, 'pack_name': PACK_BY_ID[row.pack_id]['name'],
        'amount': row.amount, 'currency': row.currency, 'credits': row.credits,
        'status': row.status, 'gateway_order_id': row.gateway_order_id,
        'payment_id': row.gateway_payment_id, 'mode': row.mode,
        'key_id': row.key_id, 'wallet': wallet(db, row.user_id, row.mode)}


async def create_order(db, user_id, pack_id, request_key):
    require_gateway()
    pack = PACK_BY_ID.get(pack_id)
    if not pack: raise HTTPException(400, 'Choose a valid LabMate pack.')
    row = db.scalar(select(PackPurchase).where(PackPurchase.user_id == user_id,
        PackPurchase.mode == settings.RAZORPAY_MODE, PackPurchase.request_key == request_key))
    if row:
        if row.pack_id != pack_id: raise HTTPException(409, 'This checkout request belongs to another pack.')
        if row.gateway_order_id: return order_view(db, row)
        # Recover a response lost after Razorpay accepted the unique receipt.
        found = await gateway_request('GET', '/orders', params={'receipt': 'lm_' + row.id.replace('-', ''), 'count': 10})
        candidates = [o for o in found.get('items', []) if o.get('receipt') == 'lm_' + row.id.replace('-', '')]
        if not candidates:
            raise HTTPException(409, 'This checkout is still being confirmed. Check its status before starting a new payment.')
        data = candidates[0]
    else:
        since = datetime.now(timezone.utc) - timedelta(hours=1)
        recent = db.query(PackPurchase).filter(PackPurchase.user_id == user_id,
            PackPurchase.created_at >= since).count()
        if recent >= 15: raise HTTPException(429, 'Too many checkout attempts. Please try again later.')
        row = PackPurchase(id=str(uuid.uuid4()), user_id=user_id, mode=settings.RAZORPAY_MODE,
            request_key=request_key, pack_id=pack_id, amount=pack['amount'], currency='INR',
            credits=pack['credits'], status='creating', key_id=settings.RAZORPAY_KEY_ID)
        db.add(row)
        try:
            db.commit()  # Claim the idempotency key before the external request.
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, 'Checkout is already being created; check its status.') from None
        data = await gateway_request('POST', '/orders', payload={'amount': row.amount,
            'currency': row.currency, 'receipt': 'lm_' + row.id.replace('-', ''),
            'notes': {'product': 'LabMate', 'pack': row.pack_id}})
    if (not re.fullmatch(r'order_[A-Za-z0-9]+', str(data.get('id', '')))
        or data.get('amount') != row.amount or data.get('currency') != row.currency):
        raise HTTPException(502, 'The payment order did not match the selected pack.')
    row.gateway_order_id, row.status = data['id'], 'created'
    db.commit()
    return order_view(db, row)


def apply_payment(db, purchase_id, payment):
    row = db.scalar(select(PackPurchase).where(PackPurchase.id == purchase_id).with_for_update())
    if (payment.get('order_id') != row.gateway_order_id or payment.get('amount') != row.amount
        or payment.get('currency') != row.currency or not re.fullmatch(r'pay_[A-Za-z0-9]+', str(payment.get('id', '')))):
        raise HTTPException(400, 'Payment details do not match this order.')
    if payment.get('status') not in {'captured', 'refunded'}:
        return order_view(db, row)
    refund = payment.get('amount_refunded', 0)
    if not isinstance(refund, int) or not 0 <= refund <= row.amount:
        raise HTTPException(400, 'Invalid payment refund total.')
    wallet(db, row.user_id, row.mode)
    now = datetime.now(timezone.utc)
    changed = db.execute(update(PackPurchase).where(PackPurchase.id == row.id,
        PackPurchase.fulfilled_at.is_(None)).values(fulfilled_at=now, gateway_payment_id=payment['id']),
        execution_options={'synchronize_session': False})
    if changed.rowcount == 1:
        db.execute(update(CreditWallet).where(CreditWallet.user_id == row.user_id, CreditWallet.mode == row.mode)
            .values(balance=CreditWallet.balance + row.credits), execution_options={'synchronize_session': False})
        ledger(db, row.user_id, row.mode, 'payment:' + row.id, 'pack_purchase', row.credits)
    db.refresh(row)
    if row.gateway_payment_id != payment['id']:
        raise HTTPException(409, 'A different payment already fulfilled this order.')
    reverse = math.ceil(row.credits * refund / row.amount)
    if reverse > row.reversed_credits:
        delta = reverse - row.reversed_credits
        db.execute(update(CreditWallet).where(CreditWallet.user_id == row.user_id, CreditWallet.mode == row.mode)
            .values(balance=CreditWallet.balance - delta), execution_options={'synchronize_session': False})
        ledger(db, row.user_id, row.mode, f'refund:{row.id}:{refund}', 'refund_adjustment', -delta)
        row.refunded_amount, row.reversed_credits = refund, reverse
    row.status = 'refunded' if row.reversed_credits == row.credits else 'partly_refunded' if row.reversed_credits else 'paid'
    db.flush()
    return order_view(db, row)


async def verify_checkout(db, user_id, purchase_id, returned_order, payment_id, signature):
    require_gateway()
    row = owned_purchase(db, purchase_id, user_id)
    if row.key_id != settings.RAZORPAY_KEY_ID or returned_order != row.gateway_order_id:
        raise HTTPException(400, 'The checkout order does not match the saved order.')
    expected = hmac.new(settings.RAZORPAY_KEY_SECRET.encode(),
        (row.gateway_order_id + '|' + payment_id).encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(400, 'Payment signature verification failed. No credits were added.')
    payment = await gateway_request('GET', '/payments/' + payment_id)
    if (payment.get('order_id') != row.gateway_order_id or payment.get('amount') != row.amount
        or payment.get('currency') != 'INR'):
        raise HTTPException(400, 'Payment details do not match this order.')
    if payment.get('status') == 'authorized':
        # Capture only this signed, owned order for the server-stored amount.
        await gateway_request('POST', '/payments/' + payment_id + '/capture',
            payload={'amount': row.amount, 'currency': row.currency})
        payment = await gateway_request('GET', '/payments/' + payment_id)
    result = apply_payment(db, row.id, payment)
    db.commit()
    return result


async def reconcile_order(db, user_id, purchase_id):
    require_gateway()
    row = owned_purchase(db, purchase_id, user_id)
    if not row.gateway_order_id:
        return await create_order(db, user_id, row.pack_id, row.request_key)
    payments = await gateway_request('GET', '/orders/' + row.gateway_order_id + '/payments')
    candidates = [p for p in payments.get('items', []) if p.get('status') in {'captured', 'refunded'}]
    if candidates:
        payment = await gateway_request('GET', '/payments/' + candidates[0]['id'])
        result = apply_payment(db, row.id, payment)
        db.commit()
        return result
    return order_view(db, row)
