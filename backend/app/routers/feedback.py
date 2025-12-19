from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import StudentFeedback
from ..middleware.auth import get_current_user
from ..models import User


router = APIRouter()


@router.post("/feedback")
async def submit_feedback(
    body: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Student submits feedback.
    body: { rating?: 1-5, message: string }
    """
    message = (body.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    rating = body.get("rating")
    if rating is not None:
        try:
            rating = int(rating)
        except Exception:
            raise HTTPException(status_code=400, detail="rating must be an integer 1-5")
        if rating < 1 or rating > 5:
            raise HTTPException(status_code=400, detail="rating must be between 1 and 5")

    fb = StudentFeedback(user_id=current_user.id if current_user else None, rating=rating, message=message)
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return {"ok": True, "id": fb.id}



