from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import LabRequest, User
from ..middleware.auth import get_current_user
from ..middleware.csrf import require_csrf_token


router = APIRouter()


class LabRequestPayload(BaseModel):
    lab_name: str = Field(..., min_length=1, max_length=200)
    details: Optional[str] = Field(default=None, max_length=2000)
    question: Optional[str] = Field(default="What lab do you need?", max_length=255)


@router.post("/lab-requests")
async def create_lab_request(
    payload: LabRequestPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    csrf_valid: bool = Depends(require_csrf_token),
):
    """
    Student submits an answer to the dashboard Q&A: 'What lab do you need?'.
    Persists their request in the database.
    """
    lab_name = payload.lab_name.strip()
    if not lab_name:
        raise HTTPException(status_code=400, detail="lab_name is required")

    question = (payload.question or "What lab do you need?").strip()[:255]
    details = payload.details.strip() if payload.details and payload.details.strip() else None

    req = LabRequest(
        user_id=current_user.id,
        question=question,
        lab_name=lab_name,
        details=details,
        status="received",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    return {
        "ok": True,
        "id": req.id,
        "question": req.question,
        "lab_name": req.lab_name,
        "details": req.details,
        "status": req.status,
        "created_at": req.created_at.isoformat() if req.created_at else None,
    }


@router.get("/lab-requests/my")
def get_my_lab_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(default=20, ge=1, le=100),
):
    """
    Return the current signed-in student's lab requests.
    """
    rows = (
        db.query(LabRequest)
        .filter(LabRequest.user_id == current_user.id)
        .order_by(LabRequest.created_at.desc(), LabRequest.id.desc())
        .limit(limit)
        .all()
    )
    return {
        "requests": [
            {
                "id": r.id,
                "question": r.question,
                "lab_name": r.lab_name,
                "details": r.details,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    }
