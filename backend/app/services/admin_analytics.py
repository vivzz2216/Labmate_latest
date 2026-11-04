"""Owner analytics from verified payments and durable workflow records."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import case, func, or_
from sqlalchemy.orm import aliased

from ..config import settings
from ..models import User, UserProfile, Upload, AssignmentWorkflow, Report, PackPurchase, CreditWallet
from ..security.operator_access import admin_email


def student_filter():
    return func.lower(func.trim(User.email)) != admin_email()


def iso(value):
    return (value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)).isoformat() if value else None


def net_amount():
    return case((PackPurchase.refunded_amount >= PackPurchase.amount, 0),
                else_=PackPurchase.amount - func.coalesce(PackPurchase.refunded_amount, 0))


def settled():
    return (PackPurchase.fulfilled_at.isnot(None), PackPurchase.gateway_payment_id.isnot(None),
            PackPurchase.currency == 'INR', PackPurchase.amount > 0)


def overview(db):
    now = datetime.now(timezone.utc)
    users = db.query(User).filter(student_filter())
    active_since = now - timedelta(days=7)
    recent_upload = db.query(Upload.id).filter(Upload.user_id == User.id, Upload.uploaded_at >= active_since).exists()
    recent_workflow = (db.query(AssignmentWorkflow.id).join(Upload, Upload.id == AssignmentWorkflow.upload_id)
                       .filter(Upload.user_id == User.id, AssignmentWorkflow.updated_at >= active_since).exists())
    financial = {}
    for mode in ('live', 'test'):
        receipts = (db.query(PackPurchase).join(User, User.id == PackPurchase.user_id)
                    .filter(student_filter(), PackPurchase.mode == mode, *settled()))
        gross, refunds, net = receipts.with_entities(func.coalesce(func.sum(PackPurchase.amount), 0),
            func.coalesce(func.sum(PackPurchase.refunded_amount), 0), func.coalesce(func.sum(net_amount()), 0)).one()
        financial[mode] = {'gross_paise':int(gross), 'refunds_paise':int(refunds), 'net_paise':int(net),
                           'captured_orders':receipts.count(),
                           'paying_students':receipts.filter(net_amount() > 0).with_entities(PackPurchase.user_id).distinct().count()}
    statuses = dict(db.query(AssignmentWorkflow.status, func.count(AssignmentWorkflow.id))
        .join(Upload, Upload.id == AssignmentWorkflow.upload_id).join(User, User.id == Upload.user_id)
        .filter(student_filter()).group_by(AssignmentWorkflow.status).all())
    return {'generated_at':iso(now), 'owner_email':admin_email(), 'billing_mode':settings.RAZORPAY_MODE,
            'total_students':users.count(), 'enabled_students':users.filter(User.is_active.is_(True)).count(),
            'active_students_7d':users.filter(or_(User.last_login >= active_since, recent_upload, recent_workflow)).count(),
            'students_with_uploads':db.query(Upload.user_id).join(User, User.id == Upload.user_id)
                .filter(student_filter()).distinct().count(),
            'uploads_total':db.query(Upload.id).join(User, User.id == Upload.user_id).filter(student_filter()).count(),
            'reports_total':db.query(Report.id).join(Upload, Upload.id == Report.upload_id)
                .join(User, User.id == Upload.user_id).filter(student_filter()).count(),
            'completed_manuals':statuses.get('completed', 0),
            'running_manuals':sum(statuses.get(s, 0) for s in ('queued','extracting','processing')),
            'failed_or_paused_manuals':sum(statuses.get(s, 0) for s in ('failed','paused')),
            'revenue':financial}


def users(db, *, search='', paid=None, active=None, limit=25, offset=0):
    uploads = db.query(Upload.user_id.label('uid'), func.count(Upload.id).label('uploads'),
        func.max(Upload.uploaded_at).label('last_upload')).group_by(Upload.user_id).subquery()
    workflows = (db.query(Upload.user_id.label('uid'),
        func.sum(case((AssignmentWorkflow.status == 'completed', 1), else_=0)).label('completed'),
        func.sum(case((AssignmentWorkflow.status.in_(['failed','paused']), 1), else_=0)).label('failed'),
        func.max(AssignmentWorkflow.updated_at).label('last_workflow'))
        .join(Upload, Upload.id == AssignmentWorkflow.upload_id).group_by(Upload.user_id).subquery())
    reports = (db.query(Upload.user_id.label('uid'), func.count(Report.id).label('reports'))
        .join(Upload, Upload.id == Report.upload_id).group_by(Upload.user_id).subquery())
    money = (db.query(PackPurchase.user_id.label('uid'), func.sum(net_amount()).label('net'),
        func.sum(PackPurchase.amount).label('gross'), func.sum(PackPurchase.refunded_amount).label('refunds'),
        func.count(PackPurchase.id).label('orders'))
        .filter(PackPurchase.mode == 'live', *settled()).group_by(PackPurchase.user_id).subquery())
    live, test = aliased(CreditWallet), aliased(CreditWallet)
    query = (db.query(User.id, User.name, User.email, User.is_active, User.created_at, User.last_login,
        UserProfile.institution, UserProfile.course, uploads.c.uploads, uploads.c.last_upload,
        workflows.c.completed, workflows.c.failed, workflows.c.last_workflow, reports.c.reports,
        money.c.net, money.c.gross, money.c.refunds, money.c.orders,
        live.balance.label('live_balance'), live.reserved.label('live_reserved'),
        test.balance.label('test_balance'), test.reserved.label('test_reserved'))
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .outerjoin(uploads, uploads.c.uid == User.id).outerjoin(workflows, workflows.c.uid == User.id)
        .outerjoin(reports, reports.c.uid == User.id).outerjoin(money, money.c.uid == User.id)
        .outerjoin(live, (live.user_id == User.id) & (live.mode == 'live'))
        .outerjoin(test, (test.user_id == User.id) & (test.mode == 'test')).filter(student_filter()))
    if search.strip():
        term = search.strip().replace('\\','\\\\').replace('%','\\%').replace('_','\\_')
        query = query.filter(or_(User.name.ilike('%'+term+'%', escape='\\'), User.email.ilike('%'+term+'%', escape='\\')))
    if paid is not None:
        query = query.filter(func.coalesce(money.c.net, 0) > 0 if paid else func.coalesce(money.c.net, 0) <= 0)
    if active is not None:
        query = query.filter(User.is_active.is_(active))
    total = query.count()
    result = []
    for row in query.order_by(User.created_at.desc(), User.id.desc()).offset(offset).limit(limit):
        activity = [iso(t) for t in (row.last_login, row.last_upload, row.last_workflow) if t]
        result.append({'id':row.id, 'name':row.name, 'email':row.email, 'is_active':row.is_active,
            'created_at':iso(row.created_at), 'last_login':iso(row.last_login),
            'last_activity':max(activity) if activity else None, 'institution':row.institution, 'course':row.course,
            'uploads_total':int(row.uploads or 0), 'completed_manuals':int(row.completed or 0),
            'failed_or_paused_manuals':int(row.failed or 0), 'reports_total':int(row.reports or 0),
            'paid_orders':int(row.orders or 0), 'gross_paid_paise':int(row.gross or 0),
            'refunded_paise':int(row.refunds or 0), 'net_paid_paise':int(row.net or 0),
            'is_paying':bool(row.net and row.net > 0),
            'credits':{'live':{'balance':int(row.live_balance or 0),'reserved':int(row.live_reserved or 0)},
                       'test':{'balance':int(row.test_balance or 0),'reserved':int(row.test_reserved or 0)}}})
    return {'users':result, 'total':total, 'limit':limit, 'offset':offset}


def payments(db, *, mode='live', limit=25, offset=0):
    query = (db.query(PackPurchase, User.name, User.email).join(User, User.id == PackPurchase.user_id)
             .filter(student_filter(), PackPurchase.mode == mode))
    total = query.count()
    result = []
    for purchase, name, email in query.order_by(PackPurchase.created_at.desc(), PackPurchase.id.desc()).offset(offset).limit(limit):
        verified = bool(purchase.fulfilled_at and purchase.gateway_payment_id)
        result.append({'id':purchase.id, 'user_id':purchase.user_id, 'name':name, 'email':email,
            'mode':purchase.mode, 'pack_id':purchase.pack_id, 'amount_paise':purchase.amount,
            'currency':purchase.currency, 'status':purchase.status, 'captured':verified,
            'refunded_paise':purchase.refunded_amount,
            'net_paise':max(0,purchase.amount-purchase.refunded_amount) if verified else 0,
            'credits':purchase.credits, 'gateway_order_id':purchase.gateway_order_id,
            'gateway_payment_id':purchase.gateway_payment_id, 'created_at':iso(purchase.created_at),
            'fulfilled_at':iso(purchase.fulfilled_at)})
    return {'payments':result, 'total':total, 'limit':limit, 'offset':offset, 'mode':mode}
