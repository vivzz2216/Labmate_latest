from typing import Optional, Dict, Any, List
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import StudentFeedback
from ..middleware.auth import get_current_user
from ..middleware.csrf import require_csrf_token
from ..models import User


router = APIRouter()


def anonymous_review_message(message, name=None):
    text = message or ''
    if name and len(name.strip().split()) > 1:
        text = re.sub(r'(?<!\w)' + re.escape(name.strip()) + r'(?!\w)', '[student]', text, flags=re.I)
    text = re.sub(r'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', '[email removed]', text, flags=re.I)
    text = re.sub(r'(?<!\w)(?:\+?\d[\d ()-]{7,}\d)(?!\w)',
                  lambda match: '[phone removed]' if len(re.sub(r'\D', '', match[0])) >= 10 else match[0], text)
    return text[:1200]


@router.get('/feedback/reviews')
def public_reviews(response: Response, limit: int = Query(6, ge=1, le=12),
                   offset: int = Query(0, ge=0, le=1000000), db: Session = Depends(get_db)):
    """Public, anonymous display of rated feedback; unrated support feedback stays private."""
    rated = db.query(StudentFeedback).filter(StudentFeedback.rating.between(1, 5),
                                            func.length(func.trim(StudentFeedback.message)) > 0)
    count, average = rated.with_entities(func.count(StudentFeedback.id), func.avg(StudentFeedback.rating)).one()
    rows = rated.options(joinedload(StudentFeedback.user).load_only(User.name)).order_by(StudentFeedback.created_at.desc(), StudentFeedback.id.desc()).offset(offset).limit(limit).all()
    response.headers['Cache-Control'] = 'public, max-age=60'
    return {'total': count, 'average_rating': round(float(average), 1) if average is not None else None,
            'reviews': [{'id': row.id, 'rating': row.rating,
                         'message': anonymous_review_message(row.message, row.user.name if row.user else None),
                         'created_at': row.created_at.isoformat() if row.created_at else None} for row in rows]}


@router.post("/feedback")
async def submit_feedback(
    body: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    csrf_valid: bool = Depends(require_csrf_token),
):
    """
    Student submits feedback.
    body: { rating?: 1-5, message: string }
    """
    raw_message = body.get("message")
    if not isinstance(raw_message, str):
        raise HTTPException(status_code=400, detail="message must be text")
    message = raw_message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    if len(message) > 5000:
        raise HTTPException(status_code=400, detail="message must be at most 5000 characters")

    rating = body.get("rating")
    if rating is not None:
        if isinstance(rating, bool) or not isinstance(rating, int):
            raise HTTPException(status_code=400, detail="rating must be an integer 1-5")
        if rating < 1 or rating > 5:
            raise HTTPException(status_code=400, detail="rating must be between 1 and 5")

    fb = StudentFeedback(user_id=current_user.id if current_user else None, rating=rating, message=message)
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return {"ok": True, "id": fb.id}



