from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional

from ..database import get_db
from ..models import Upload, Job, User
from ..middleware.auth import get_current_user

router = APIRouter()


class AssignmentResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    language: Optional[str]
    uploaded_at: str
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    in_progress_tasks: int
    report_download_url: Optional[str] = None


@router.get("/", response_model=List[AssignmentResponse])
async def get_user_assignments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all assignments for the authenticated user with task counts
    Requires JWT authentication.
    """
    # Get uploads for the authenticated user
    uploads = db.query(Upload).filter(Upload.user_id == current_user.id).all()
    
    assignments = []
    for upload in uploads:
        # Count tasks for this upload
        total_tasks = db.query(Job).filter(Job.upload_id == upload.id).count()
        completed_tasks = db.query(Job).filter(
            Job.upload_id == upload.id,
            Job.status == 'completed'
        ).count()
        failed_tasks = db.query(Job).filter(
            Job.upload_id == upload.id,
            Job.status == 'failed'
        ).count()
        in_progress_tasks = db.query(Job).filter(
            Job.upload_id == upload.id,
            Job.status.in_(['pending', 'running'])
        ).count()
        
        # Check if there's a report available
        report_url = None
        if completed_tasks > 0:
            # For now, we'll generate the report URL based on the upload
            # In a real implementation, you'd check if a report actually exists
            report_url = f"/api/reports/download/{upload.id}"
        
        assignments.append(AssignmentResponse(
            id=upload.id,
            filename=upload.filename,
            original_filename=upload.original_filename,
            language=upload.language,
            uploaded_at=upload.uploaded_at.isoformat(),
            total_tasks=total_tasks,
            completed_tasks=completed_tasks,
            failed_tasks=failed_tasks,
            in_progress_tasks=in_progress_tasks,
            report_download_url=report_url
        ))
    
    # Sort by upload date (newest first)
    assignments.sort(key=lambda x: x.uploaded_at, reverse=True)
    
    return assignments


@router.get("/{assignment_id}", response_model=AssignmentResponse)
async def get_assignment_details(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a specific assignment
    Requires JWT authentication and verifies ownership.
    """
    # Get the specific upload and verify ownership
    upload = db.query(Upload).filter(
        Upload.id == assignment_id,
        Upload.user_id == current_user.id
    ).first()
    
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Count tasks for this upload
    total_tasks = db.query(Job).filter(Job.upload_id == upload.id).count()
    completed_tasks = db.query(Job).filter(
        Job.upload_id == upload.id,
        Job.status == 'completed'
    ).count()
    failed_tasks = db.query(Job).filter(
        Job.upload_id == upload.id,
        Job.status == 'failed'
    ).count()
    in_progress_tasks = db.query(Job).filter(
        Job.upload_id == upload.id,
        Job.status.in_(['pending', 'running'])
    ).count()
    
    # Check if there's a report available
    report_url = None
    if completed_tasks > 0:
        report_url = f"/api/reports/download/{upload.id}"
    
    return AssignmentResponse(
        id=upload.id,
        filename=upload.filename,
        original_filename=upload.original_filename,
        language=upload.language,
        uploaded_at=upload.uploaded_at.isoformat(),
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        failed_tasks=failed_tasks,
        in_progress_tasks=in_progress_tasks,
        report_download_url=report_url
    )
