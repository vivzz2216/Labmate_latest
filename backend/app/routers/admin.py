from datetime import datetime
from typing import Optional, List, Dict, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Response, Query
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import User, Subscription, StudentFeedback
from ..middleware.auth import get_current_user
from ..middleware.csrf import require_csrf_token
from ..security.operator_access import is_admin_user
from ..services import admin_analytics

router = APIRouter()


def require_admin(response: Response, current_user: User = Depends(get_current_user)) -> User:
    if not is_admin_user(current_user):
        raise HTTPException(status_code=403, detail="This page is restricted to the platform owner.")
    response.headers["Cache-Control"] = "private, no-store"
    return current_user


@router.get("/admin/ping")
def admin_ping(_owner: User = Depends(require_admin)):
    return {"ok": True, "owner_email": _owner.email}


@router.get("/admin/overview")
def admin_overview(db: Session = Depends(get_db), _owner: User = Depends(require_admin)):
    return admin_analytics.overview(db)


@router.get("/admin/users")
def admin_users(search: str = Query(default="", max_length=120), paid: Optional[bool] = None,
                active: Optional[bool] = None, limit: int = Query(default=25, ge=1, le=100),
                offset: int = Query(default=0, ge=0, le=1000000),
                db: Session = Depends(get_db), _owner: User = Depends(require_admin)):
    return admin_analytics.users(db, search=search, paid=paid, active=active, limit=limit, offset=offset)


@router.get("/admin/payments")
def admin_payments(mode: Literal["live", "test"] = "live", limit: int = Query(default=25, ge=1, le=100),
                   offset: int = Query(default=0, ge=0, le=1000000),
                   db: Session = Depends(get_db), _owner: User = Depends(require_admin)):
    return admin_analytics.payments(db, mode=mode, limit=limit, offset=offset)


@router.get("/admin/feedback")
def admin_feedback(db: Session = Depends(get_db), _ok: User = Depends(require_admin)):
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
    _ok: User = Depends(require_admin),
    _csrf: bool = Depends(require_csrf_token),
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
