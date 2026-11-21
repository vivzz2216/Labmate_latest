"""Polls and 'What's new' updates: students vote and read; the owner creates and closes them (admin endpoints below)."""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..middleware.auth import get_current_user
from ..middleware.csrf import require_csrf_token
from ..models import FeatureUpdate, Poll, PollOption, PollVote, User
from .admin import require_admin

router = APIRouter()

UPDATE_TAGS = {"New", "Improved", "Fixed"}


def _now() -> datetime:
    return datetime.utcnow()


def _is_open(poll: Poll) -> bool:
    if not poll.is_open:
        return False
    if poll.closes_at is None:
        return True
    return poll.closes_at.replace(tzinfo=None) > _now()


def _poll_payload(db: Session, poll: Poll, user_id: Optional[int]) -> Dict[str, Any]:
    counts = dict(db.query(PollVote.option_id, func.count(PollVote.id)).filter(PollVote.poll_id == poll.id).group_by(PollVote.option_id).all())
    mine = None
    if user_id is not None:
        vote = db.query(PollVote).filter(PollVote.poll_id == poll.id, PollVote.user_id == user_id).first()
        mine = vote.option_id if vote else None
    total = sum(counts.values())
    return {
        "id": poll.id,
        "question": poll.question,
        "description": poll.description,
        "open": _is_open(poll),
        "created_at": poll.created_at.isoformat() if poll.created_at else None,
        "closes_at": poll.closes_at.isoformat() if poll.closes_at else None,
        "total_votes": total,
        "my_option_id": mine,
        "options": [{"id": o.id, "label": o.label, "votes": counts.get(o.id, 0),
                     "percent": round(100 * counts.get(o.id, 0) / total, 1) if total else 0.0} for o in poll.options],
    }


@router.get("/community/summary")
def community_summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Numbers for the account-menu badges: newest update id and how many open polls the student has not answered."""
    latest = db.query(func.max(FeatureUpdate.id)).scalar()
    voted = {pid for (pid,) in db.query(PollVote.poll_id).filter(PollVote.user_id == user.id).all()}
    open_polls = [p for p in db.query(Poll).filter(Poll.is_open.is_(True)).all() if _is_open(p)]
    return {"latest_update_id": latest or 0, "unanswered_polls": sum(1 for p in open_polls if p.id not in voted)}


@router.get("/polls")
def list_polls(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    polls = db.query(Poll).order_by(Poll.created_at.desc(), Poll.id.desc()).limit(30).all()
    return {"polls": [_poll_payload(db, p, user.id) for p in polls]}


@router.post("/polls/{poll_id}/vote")
def vote(poll_id: int, body: Dict[str, Any], db: Session = Depends(get_db), user: User = Depends(get_current_user),
         csrf_valid: bool = Depends(require_csrf_token)):
    option_id = body.get("option_id")
    if isinstance(option_id, bool) or not isinstance(option_id, int):
        raise HTTPException(status_code=400, detail="option_id must be a number")
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    if not _is_open(poll):
        raise HTTPException(status_code=409, detail="This poll is closed")
    if option_id not in {o.id for o in poll.options}:
        raise HTTPException(status_code=400, detail="That option does not belong to this poll")
    existing = db.query(PollVote).filter(PollVote.poll_id == poll.id, PollVote.user_id == user.id).first()
    if existing:
        existing.option_id = option_id
    else:
        db.add(PollVote(poll_id=poll.id, option_id=option_id, user_id=user.id))
    db.commit()
    return _poll_payload(db, poll, user.id)


@router.get("/updates")
def list_updates(limit: int = Query(30, ge=1, le=100), db: Session = Depends(get_db)):
    rows = db.query(FeatureUpdate).order_by(FeatureUpdate.created_at.desc(), FeatureUpdate.id.desc()).limit(limit).all()
    return {"updates": [{"id": r.id, "title": r.title, "body": r.body, "tag": r.tag,
                         "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]}


# ---------------------------------------------------------------------------------------------- owner (admin) endpoints
def _clean(text: Any, name: str, low: int, high: int) -> str:
    if not isinstance(text, str):
        raise HTTPException(status_code=400, detail=f"{name} must be text")
    value = " ".join(text.split()) if high <= 300 else text.strip()
    if len(value) < low:
        raise HTTPException(status_code=400, detail=f"{name} is too short")
    if len(value) > high:
        raise HTTPException(status_code=400, detail=f"{name} must be at most {high} characters")
    return value


@router.post("/admin/polls")
def admin_create_poll(body: Dict[str, Any], db: Session = Depends(get_db), owner: User = Depends(require_admin),
                      csrf_valid: bool = Depends(require_csrf_token)):
    question = _clean(body.get("question"), "question", 3, 300)
    raw_options = body.get("options")
    if not isinstance(raw_options, list):
        raise HTTPException(status_code=400, detail="options must be a list")
    labels: List[str] = []
    for item in raw_options:
        label = _clean(item, "option", 1, 200)
        if label.lower() not in [x.lower() for x in labels]:
            labels.append(label)
    if not 2 <= len(labels) <= 8:
        raise HTTPException(status_code=400, detail="A poll needs between 2 and 8 different options")
    description = body.get("description")
    description = _clean(description, "description", 0, 1000) if isinstance(description, str) and description.strip() else None
    closes_at = None
    days = body.get("closes_in_days")
    if days is not None:
        if isinstance(days, bool) or not isinstance(days, int) or not 1 <= days <= 365:
            raise HTTPException(status_code=400, detail="closes_in_days must be between 1 and 365")
        closes_at = _now() + timedelta(days=days)
    poll = Poll(question=question, description=description, closes_at=closes_at,
                options=[PollOption(label=label, position=i) for i, label in enumerate(labels)])
    db.add(poll)
    db.commit()
    db.refresh(poll)
    return _poll_payload(db, poll, None)


@router.post("/admin/polls/{poll_id}/close")
def admin_close_poll(poll_id: int, db: Session = Depends(get_db), owner: User = Depends(require_admin),
                     csrf_valid: bool = Depends(require_csrf_token)):
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    poll.is_open = False
    db.commit()
    return _poll_payload(db, poll, None)


@router.delete("/admin/polls/{poll_id}")
def admin_delete_poll(poll_id: int, db: Session = Depends(get_db), owner: User = Depends(require_admin),
                      csrf_valid: bool = Depends(require_csrf_token)):
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    db.query(PollVote).filter(PollVote.poll_id == poll.id).delete()
    db.delete(poll)
    db.commit()
    return {"ok": True}


@router.post("/admin/updates")
def admin_create_update(body: Dict[str, Any], db: Session = Depends(get_db), owner: User = Depends(require_admin),
                        csrf_valid: bool = Depends(require_csrf_token)):
    title = _clean(body.get("title"), "title", 3, 200)
    text = _clean(body.get("body"), "body", 3, 4000)
    tag = body.get("tag")
    if tag is not None and tag not in UPDATE_TAGS:
        raise HTTPException(status_code=400, detail="tag must be New, Improved or Fixed")
    row = FeatureUpdate(title=title, body=text, tag=tag)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "title": row.title, "body": row.body, "tag": row.tag, "created_at": row.created_at.isoformat() if row.created_at else None}


@router.delete("/admin/updates/{update_id}")
def admin_delete_update(update_id: int, db: Session = Depends(get_db), owner: User = Depends(require_admin),
                        csrf_valid: bool = Depends(require_csrf_token)):
    row = db.query(FeatureUpdate).filter(FeatureUpdate.id == update_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Update not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
