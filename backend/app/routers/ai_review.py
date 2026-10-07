from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..middleware.auth import get_current_user
from ..middleware.csrf import require_csrf_token
from ..models import User
from ..services.code_review_service import CodeReviewService

router = APIRouter()
service = CodeReviewService()


class VariantRequest(BaseModel):
    original_code: str = Field(..., min_length=1)
    problem_statement: str | None = None
    review_id: str | None = None


@router.post("/review")
async def review_python_file(
    file: UploadFile = File(...),
    problem_statement: str | None = Form(default=None, max_length=600),
    current_user: User = Depends(get_current_user),
    csrf_valid: bool = Depends(require_csrf_token),
    db: Session = Depends(get_db),
):
    del csrf_valid  # value not used beyond dependency check
    try:
        code_bytes = await file.read()
    except Exception as exc:  # pragma: no cover - upload errors
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to read file: {exc}") from exc

    try:
        return await service.review_code(
            user=current_user,
            db=db,
            filename=file.filename or "assignment.py",
            code_bytes=code_bytes,
            problem_statement=problem_statement,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/variant")
async def generate_alternative_solution(
    request: VariantRequest,
    current_user: User = Depends(get_current_user),
    csrf_valid: bool = Depends(require_csrf_token),
    db: Session = Depends(get_db),
):
    del csrf_valid
    original_code = request.original_code.strip()
    if not original_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="original_code cannot be empty.")

    try:
        return await service.generate_variant(
            user=current_user,
            db=db,
            original_code=original_code,
            problem_statement=request.problem_statement,
            variant_of=request.review_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

