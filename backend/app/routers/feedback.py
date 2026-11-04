from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import StudentFeedback
from ..middleware.auth import get_current_user
from ..middleware.csrf import require_csrf_token
from ..models import User


router = APIRouter()


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



