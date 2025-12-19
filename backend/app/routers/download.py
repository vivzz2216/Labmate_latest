from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Report, User
from ..middleware.auth import get_current_user, verify_report_ownership
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
    
    # Check if file exists
    if not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="Report file not found on disk")
    
    try:
        # Return file for download
        return FileResponse(
            path=report.file_path,
            filename=report.filename,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")
