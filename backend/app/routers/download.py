from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Report, User
from ..middleware.auth import get_current_user, verify_report_ownership
from ..services.storage_service import storage_service
import os

router = APIRouter()


@router.get("/download/{doc_id}")
async def download_report(
    doc_id: int = Path(..., description="ID of the generated report"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Download the generated report file
    Requires JWT authentication and verifies report ownership
    """
    # Verify user owns the report
    report = await verify_report_ownership(doc_id, current_user, db)
    
    # Check if file exists locally or retrieve from durable cloud storage
    try:
        resolved_path = storage_service.ensure_local(report.file_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Report file not found on disk or cloud storage")
    
    try:
        # Return file for download
        return FileResponse(
            path=str(resolved_path),
            filename=report.filename,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")
