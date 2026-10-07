from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..middleware.auth import get_current_user
from ..models import AssignmentWorkflow, Job, Report, Upload, User

router = APIRouter()


class AssignmentResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    language: Optional[str]
    uploaded_at: str
    file_type: str
    file_size: int
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    in_progress_tasks: int
    report_download_url: Optional[str] = None
    report_id: Optional[int] = None
    report_filename: Optional[str] = None


def assignment_response(upload, db):
    workflow = db.query(AssignmentWorkflow).filter_by(upload_id=upload.id).first()
    if workflow:
        total = len(workflow.questions or [])
        completed = sum(result.get("status") == "completed" for result in (workflow.results or []))
        failed = sum(result.get("status") == "failed" for result in (workflow.results or []))
        running = max(0, total - completed - failed) if workflow.status == "processing" else 0
    else:
        jobs = db.query(Job).filter_by(upload_id=upload.id).all()
        total = len(jobs)
        completed = sum(job.status == "completed" for job in jobs)
        failed = sum(job.status == "failed" for job in jobs)
        running = sum(job.status in {"pending", "running"} for job in jobs)
    report = db.query(Report).filter_by(upload_id=upload.id).order_by(Report.id.desc()).first()
    return AssignmentResponse(
        id=upload.id, filename=upload.filename, original_filename=upload.original_filename,
        language=upload.language, uploaded_at=upload.uploaded_at.isoformat(),
        file_type=upload.file_type, file_size=upload.file_size,
        total_tasks=total, completed_tasks=completed, failed_tasks=failed, in_progress_tasks=running,
        report_download_url=f"/api/download/{report.id}" if report else None,
        report_id=report.id if report else None, report_filename=report.filename if report else None,
    )


@router.get("/", response_model=list[AssignmentResponse])
async def get_user_assignments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    uploads = db.query(Upload).filter_by(user_id=current_user.id).order_by(Upload.uploaded_at.desc()).all()
    return [assignment_response(upload, db) for upload in uploads]


@router.get("/{assignment_id}", response_model=AssignmentResponse)
async def get_assignment_details(assignment_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    upload = db.query(Upload).filter_by(id=assignment_id, user_id=current_user.id).first()
    if not upload:
        raise HTTPException(404, "Assignment not found.")
    return assignment_response(upload, db)


@router.get("/{assignment_id}/workspace")
async def get_assignment_workspace(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    upload = db.query(Upload).filter_by(id=assignment_id, user_id=current_user.id).first()
    if not upload:
        raise HTTPException(404, "Assignment not found.")

    workflow = db.query(AssignmentWorkflow).filter_by(upload_id=upload.id).first()
    report = db.query(Report).filter_by(upload_id=upload.id).order_by(Report.id.desc()).first()

    questions_data = []
    if workflow and workflow.results:
        from ..security.signed_assets import screenshot_url
        for item in workflow.results:
            screenshots = []
            for idx, s_path in enumerate(item.get("screenshot_paths", [])):
                try:
                    s_url = screenshot_url(s_path)
                except Exception:
                    s_url = None

                if idx == 0 and len(item.get("screenshot_paths", [])) > 1:
                    s_title = f"Program {item.get('id', '')} — Code"
                elif idx == 1:
                    s_title = f"Program {item.get('id', '')} — Output"
                else:
                    s_title = f"Program {item.get('id', '')} — Part {idx + 1}"

                screenshots.append({
                    "index": idx + 1,
                    "title": s_title,
                    "url": s_url,
                    "path": s_path,
                })

            questions_data.append({
                "id": item.get("id"),
                "question_text": item.get("question_text", ""),
                "code": item.get("code", ""),
                "output": item.get("output", ""),
                "status": item.get("status", "pending"),
                "language": item.get("language", upload.language or "python"),
                "is_theory": item.get("is_theory", False),
                "theory_answer": item.get("theory_answer", ""),
                "screenshots": screenshots,
            })

    return {
        "assignment": {
            "id": upload.id,
            "filename": upload.filename,
            "original_filename": upload.original_filename,
            "language": upload.language,
            "uploaded_at": upload.uploaded_at.isoformat(),
            "file_type": upload.file_type,
            "file_size": upload.file_size,
            "status": workflow.status if workflow else "uploaded",
            "progress": workflow.progress if workflow else 0,
            "stage": workflow.stage if workflow else "upload",
            "error": workflow.error if workflow else None,
        },
        "report": {
            "id": report.id,
            "filename": report.filename,
            "download_url": f"/api/download/{report.id}",
            "file_size": report.file_size,
        } if report else None,
        "questions": questions_data,
    }
