from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Upload, Report, User
from ..schemas import ComposeRequest, ComposeResponse
from ..services.composer_service import composer_service
from ..middleware.auth import get_current_user, verify_upload_ownership
from ..middleware.csrf import require_csrf_token
import os

router = APIRouter()


@router.post("/compose", response_model=ComposeResponse)
async def compose_report(
    http_request: Request,
    request: ComposeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    csrf_valid: bool = Depends(require_csrf_token)
):
    """
    Generate final DOCX report with embedded screenshots
    Requires JWT authentication, CSRF protection, and verifies upload ownership
    """
    # Verify user owns the upload
    upload = await verify_upload_ownership(request.upload_id, current_user, db)
    
    try:
        # Compose the report using our new composer service
        result = await composer_service.compose_report(
            request.upload_id, 
            request.screenshot_order, 
            db
        )
        
        # Create report record
        report = Report(
            upload_id=request.upload_id,
            filename=result["filename"],
            file_path=result["report_path"],
            file_size=os.path.getsize(result["report_path"]),
            screenshot_order=request.screenshot_order
        )
        
        db.add(report)
        db.commit()
        db.refresh(report)
        
        return ComposeResponse(
            report_id=report.id,
            filename=result["filename"],
            download_url=result["download_url"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report composition failed: {str(e)}")
