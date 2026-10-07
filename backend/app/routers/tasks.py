from fastapi import APIRouter, Depends, HTTPException, Path, Request
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import TasksSubmitRequest, TasksSubmitResponse, JobStatusResponse
from ..services.task_service import task_service
from ..middleware.auth import get_current_user, verify_upload_ownership
from ..middleware.csrf import require_csrf_token
from ..models import User

router = APIRouter()


@router.post("/tasks/submit", response_model=TasksSubmitResponse)
async def submit_tasks(
    http_request: Request,
    request: TasksSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    csrf_valid: bool = Depends(require_csrf_token)
):
    """
    Submit selected tasks for AI processing
    Requires JWT authentication, CSRF protection, and verifies upload ownership
    """
    try:
        # Verify user owns the upload
        upload = await verify_upload_ownership(request.file_id, current_user, db)
        
        # Submit tasks (now runs in background)
        job_id = await task_service.submit_tasks(
            request.file_id,
            request.tasks,
            request.theme,
            request.insertion_preference,
            db
        )
        
        return TasksSubmitResponse(job_id=job_id, status="submitted")
        
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Task submission failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Task submission failed")


@router.get("/tasks/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: int = Path(..., description="ID of the job"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get status and results of a job
    Requires JWT authentication and verifies job ownership
    """
    try:
        # Verify user owns the job
        from ..middleware.auth import verify_job_ownership
        await verify_job_ownership(job_id, current_user, db)
        
        job_status = await task_service.get_job_status(job_id, db)
        return JobStatusResponse(**job_status)
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to get job status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get job status")
