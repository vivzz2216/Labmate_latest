from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, case

from ..config import settings
from ..database import get_db
from ..models import User, Upload, Job, Report, Subscription, StudentFeedback


router = APIRouter()
security = HTTPBasic()


def require_admin(credentials: HTTPBasicCredentials = Depends(security)) -> bool:
    # HTTPBasicCredentials.username/password are plain strings
    ok_user = credentials.username == str(settings.ADMIN_USERID)
    ok_pass = credentials.password == str(settings.ADMIN_PASSWORD)
    if not (ok_user and ok_pass):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return True


@router.get("/admin/ping")
def admin_ping(_ok: bool = Depends(require_admin)):
    return {"ok": True, "ts": datetime.utcnow().isoformat() + "Z"}


@router.get("/admin/overview")
def admin_overview(db: Session = Depends(get_db), _ok: bool = Depends(require_admin)):
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_subs = (
        db.query(func.count(Subscription.id))
        .filter(Subscription.is_active.is_(True))
        .scalar()
        or 0
    )
    total_uploads = db.query(func.count(Upload.id)).scalar() or 0
    completed_jobs = db.query(func.count(Job.id)).filter(Job.status == "completed").scalar() or 0
    feedback_count = db.query(func.count(StudentFeedback.id)).scalar() or 0

    return {
        "total_users": total_users,
        "active_subscriptions": active_subs,
        "total_uploads": total_uploads,
        "completed_jobs": completed_jobs,
        "feedback_count": feedback_count,
    }


@router.get("/admin/users")
def admin_users(db: Session = Depends(get_db), _ok: bool = Depends(require_admin)):
    # Subqueries for aggregates
    uploads_sq = (
        db.query(Upload.user_id.label("user_id"), func.count(Upload.id).label("uploads_total"))
        .group_by(Upload.user_id)
        .subquery()
    )

    completed_jobs_sq = (
        db.query(
            Upload.user_id.label("user_id"),
            func.count(Job.id).label("jobs_completed"),
        )
        .join(Upload, Job.upload_id == Upload.id)
        .filter(Job.status == "completed")
        .group_by(Upload.user_id)
        .subquery()
    )

    completed_uploads_sq = (
        db.query(
            Upload.user_id.label("user_id"),
            func.count(distinct(Upload.id)).label("uploads_with_completed_jobs"),
        )
        .join(Job, Job.upload_id == Upload.id)
        .filter(Job.status == "completed")
        .group_by(Upload.user_id)
        .subquery()
    )

    reports_sq = (
        db.query(
            Upload.user_id.label("user_id"),
            func.count(Report.id).label("reports_total"),
        )
        .join(Upload, Report.upload_id == Upload.id)
        .group_by(Upload.user_id)
        .subquery()
    )

    # subscription: active if ANY active subscription exists
    subs_sq = (
        db.query(
            Subscription.user_id.label("user_id"),
            func.max(case((Subscription.is_active.is_(True), 1), else_=0)).label("subscription_active"),
            func.max(Subscription.plan).label("subscription_plan"),
            func.max(Subscription.expires_at).label("subscription_expires_at"),
        )
        .group_by(Subscription.user_id)
        .subquery()
    )

    feedback_sq = (
        db.query(
            StudentFeedback.user_id.label("user_id"),
            func.count(StudentFeedback.id).label("feedback_count"),
        )
        .group_by(StudentFeedback.user_id)
        .subquery()
    )

    rows = (
        db.query(
            User.id,
            User.email,
            User.name,
            User.created_at,
            User.last_login,
            User.is_active,
            uploads_sq.c.uploads_total,
            completed_jobs_sq.c.jobs_completed,
            completed_uploads_sq.c.uploads_with_completed_jobs,
            reports_sq.c.reports_total,
            subs_sq.c.subscription_active,
            subs_sq.c.subscription_plan,
            subs_sq.c.subscription_expires_at,
            feedback_sq.c.feedback_count,
        )
        .outerjoin(uploads_sq, uploads_sq.c.user_id == User.id)
        .outerjoin(completed_jobs_sq, completed_jobs_sq.c.user_id == User.id)
        .outerjoin(completed_uploads_sq, completed_uploads_sq.c.user_id == User.id)
        .outerjoin(reports_sq, reports_sq.c.user_id == User.id)
        .outerjoin(subs_sq, subs_sq.c.user_id == User.id)
        .outerjoin(feedback_sq, feedback_sq.c.user_id == User.id)
        .order_by(User.created_at.desc())
        .all()
    )

    out: List[Dict[str, Any]] = []
    for r in rows:
        out.append(
            {
                "id": r.id,
                "email": r.email,
                "name": r.name,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "last_login": r.last_login.isoformat() if r.last_login else None,
                "is_active": bool(r.is_active),
                "subscription_active": bool(r.subscription_active or 0),
                "subscription_plan": r.subscription_plan,
                "subscription_expires_at": r.subscription_expires_at.isoformat() if r.subscription_expires_at else None,
                "uploads_total": int(r.uploads_total or 0),
                "assignments_completed": int(r.uploads_with_completed_jobs or 0),
                "jobs_completed": int(r.jobs_completed or 0),
                "reports_total": int(r.reports_total or 0),
                "feedback_count": int(r.feedback_count or 0),
            }
        )

    return {"users": out}


@router.get("/admin/feedback")
def admin_feedback(db: Session = Depends(get_db), _ok: bool = Depends(require_admin)):
    rows = (
        db.query(StudentFeedback, User)
        .outerjoin(User, User.id == StudentFeedback.user_id)
        .order_by(StudentFeedback.created_at.desc())
        .limit(200)
        .all()
    )
    out: List[Dict[str, Any]] = []
    for fb, user in rows:
        out.append(
            {
                "id": fb.id,
                "user_id": fb.user_id,
                "user_email": user.email if user else None,
                "user_name": user.name if user else None,
                "rating": fb.rating,
                "message": fb.message,
                "created_at": fb.created_at.isoformat() if fb.created_at else None,
            }
        )
    return {"feedback": out}


@router.post("/admin/subscription/{user_id}")
def set_subscription(
    user_id: int,
    body: Dict[str, Any],
    db: Session = Depends(get_db),
    _ok: bool = Depends(require_admin),
):
    """
    Upsert a subscription record for a user.
    body: { is_active: bool, plan?: str, expires_at?: ISO8601 string }
    """
    is_active = bool(body.get("is_active", True))
    plan = (body.get("plan") or "hobby").strip()
    expires_at_raw = body.get("expires_at")
    expires_at: Optional[datetime] = None
    if expires_at_raw:
        try:
            expires_at = datetime.fromisoformat(expires_at_raw.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid expires_at; expected ISO8601")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Keep it simple: one active row per user; create a new row each change for auditability
    sub = Subscription(user_id=user_id, plan=plan, is_active=is_active, expires_at=expires_at)
    db.add(sub)
    db.commit()
    db.refresh(sub)

    return {
        "ok": True,
        "subscription": {
            "id": sub.id,
            "user_id": sub.user_id,
            "plan": sub.plan,
            "is_active": sub.is_active,
            "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
        },
    }



