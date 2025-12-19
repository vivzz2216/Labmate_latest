from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form, Request, Path
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Upload
from ..schemas import UploadResponse
from ..config import settings
from ..security.validators import sanitize_filename, validate_file_path
from ..middleware.auth import get_current_user
from ..middleware.csrf import require_csrf_token
from ..models import User
import os
import uuid
from datetime import datetime
from pydantic import BaseModel, Field, validator
import magic  # python-magic for file type validation
import logging
import mammoth

# Set up logging for debugging
logger = logging.getLogger(__name__)

router = APIRouter()

# Allowed file extensions and MIME types
ALLOWED_EXTENSIONS = {'docx', 'pdf'}
ALLOWED_MIME_TYPES = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  # .docx
    'application/pdf',  # .pdf
}

class SetFilenameRequest(BaseModel):
    upload_id: int = Field(..., gt=0, description="Upload ID must be positive")
    filename: str = Field(..., min_length=1, max_length=255)
    
    @validator('filename')
    def validate_filename(cls, v):
        """Sanitize and validate filename"""
        return sanitize_filename(v)


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    csrf_valid: bool = Depends(require_csrf_token)
):
    """
    Upload a DOCX or PDF file for processing with comprehensive security validation.
    Requires JWT authentication and CSRF protection.
    """
    file_path = None
    
    try:
        logger.debug(f"File upload request received: filename={file.filename if file else None}, user_id={current_user.id}")
        
        # Validate file exists and has a name
        if not file or not file.filename:
            logger.warning("File upload failed: No file provided")
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Sanitize filename to prevent path traversal
        safe_filename = sanitize_filename(file.filename)
        logger.debug(f"Sanitized filename: {safe_filename}")
        
        # Validate file extension
        file_extension = safe_filename.lower().split('.')[-1] if '.' in safe_filename else ''
        logger.debug(f"File extension: {file_extension}")
        
        if file_extension not in ALLOWED_EXTENSIONS:
            logger.warning(f"File upload rejected: Invalid extension '{file_extension}'")
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Only {', '.join(ALLOWED_EXTENSIONS).upper()} files are supported"
            )
        
        # Read file content - do this early to validate size
        logger.debug("Reading file content...")
        file_content = await file.read()
        file_size = len(file_content)
        logger.debug(f"File size: {file_size} bytes ({file_size / (1024*1024):.2f} MB)")
        
        # Validate file is not empty
        if file_size == 0:
            logger.warning("File upload rejected: File is empty")
            raise HTTPException(status_code=400, detail="File is empty")
        
        # Check file size BEFORE any other processing
        # FIXED: This validation happens early to prevent 500 errors
        if file_size > settings.MAX_FILE_SIZE:
            logger.warning(f"File upload rejected: File too large ({file_size} bytes > {settings.MAX_FILE_SIZE} bytes)")
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE / (1024*1024):.1f}MB"
            )
        
        # Validate MIME type using python-magic (more reliable than extension)
        # FIXED: Properly handle MIME validation errors as 400, not 500
        try:
            mime = magic.Magic(mime=True)
            detected_mime = mime.from_buffer(file_content[:2048])  # Check first 2KB
            logger.debug(f"Detected MIME type: {detected_mime}")
            
            if detected_mime not in ALLOWED_MIME_TYPES:
                logger.warning(f"File upload rejected: Invalid MIME type '{detected_mime}'")
                raise HTTPException(
                    status_code=400,
                    detail=f"File content does not match allowed types. Detected: {detected_mime}"
                )
        except HTTPException:
            # Re-raise HTTPExceptions (validation errors) as-is
            raise
        except ImportError:
            # python-magic not available - log warning but continue
            logger.warning("python-magic not available, skipping MIME type validation")
        except Exception as mime_error:
            # Other MIME validation errors - log but don't fail upload
            logger.warning(f"MIME type validation failed (non-fatal): {mime_error}")
            # Continue if magic is not available, but log warning
        
        # Use authenticated user's ID (no need to validate)
        user_id = current_user.id
        
        # Generate unique filename with UUID
        file_id = str(uuid.uuid4())
        filename = f"{file_id}.{file_extension}"
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
        logger.debug(f"Generated file path: {file_path}")
        
        # Validate file path is within allowed directory
        is_valid, error_msg = validate_file_path(file_path, [settings.UPLOAD_DIR])
        if not is_valid:
            logger.warning(f"File upload rejected: Invalid file path - {error_msg}")
            raise HTTPException(status_code=400, detail=f"Invalid file path: {error_msg}")
        
        # Ensure upload directory exists
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        logger.debug(f"Upload directory ensured: {settings.UPLOAD_DIR}")
        
        # Save file with restricted permissions
        logger.debug("Saving file to disk...")
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Set file permissions to read-only for owner
        os.chmod(file_path, 0o600)
        logger.debug(f"File saved with permissions 0o600: {file_path}")
        
        # Create database record
        logger.debug("Creating database record...")
        upload = Upload(
            filename=filename,
            original_filename=safe_filename,  # Store sanitized filename
            file_path=file_path,
            file_type=file_extension,
            file_size=file_size,
            user_id=user_id
        )
        
        db.add(upload)
        db.commit()
        db.refresh(upload)
        logger.info(f"File uploaded successfully: id={upload.id}, filename={filename}")
        
        return UploadResponse(
            id=upload.id,
            filename=upload.filename,
            original_filename=upload.original_filename,
            file_type=upload.file_type,
            file_size=upload.file_size,
            uploaded_at=upload.uploaded_at,
            language=upload.language
        )
        
    except HTTPException as http_exc:
        # HTTPExceptions are validation errors - re-raise as-is (they already have correct status codes)
        logger.debug(f"HTTPException raised: {http_exc.status_code} - {http_exc.detail}")
        # Clean up file if upload failed
        if file_path and os.path.exists(file_path):
            try:
                os.unlink(file_path)
                logger.debug(f"Cleaned up file: {file_path}")
            except Exception as cleanup_error:
                logger.error(f"Failed to clean up file {file_path}: {cleanup_error}")
        raise
    except Exception as e:
        # Unexpected errors - log full traceback and return 500
        logger.error(f"Unexpected error during file upload: {e}", exc_info=True)
        # Clean up file if database save fails
        if file_path and os.path.exists(file_path):
            try:
                os.unlink(file_path)
                logger.debug(f"Cleaned up file after error: {file_path}")
            except Exception as cleanup_error:
                logger.error(f"Failed to clean up file {file_path}: {cleanup_error}")
        raise HTTPException(status_code=500, detail="Upload failed due to server error")


@router.post("/set-filename")
async def set_custom_filename(
    request: SetFilenameRequest,
    db: Session = Depends(get_db)
):
    """
    Set custom filename for an uploaded file with validation.
    FIXED: Made filename validation more lenient and added better error messages.
    """
    logger.debug(f"Set filename request: upload_id={request.upload_id}, filename={request.filename}")
    
    try:
        # Validate upload ID
        if request.upload_id <= 0:
            logger.warning(f"Set filename failed: Invalid upload_id {request.upload_id}")
            raise HTTPException(status_code=400, detail="Invalid upload ID")
        
        # Find the upload record
        upload = db.query(Upload).filter(Upload.id == request.upload_id).first()
        if not upload:
            logger.warning(f"Set filename failed: Upload not found with id={request.upload_id}")
            raise HTTPException(status_code=404, detail="Upload not found")
        
        # Filename is already sanitized by Pydantic validator
        filename = request.filename.strip()
        
        # FIXED: More lenient validation - allow filenames without extension
        # The extension requirement was too strict. Users might want to set custom names.
        if not filename:
            logger.warning(f"Set filename failed: Empty filename for upload_id={request.upload_id}")
            raise HTTPException(status_code=400, detail="Filename cannot be empty")
        
        # Validate filename length
        if len(filename) > 255:
            logger.warning(f"Set filename failed: Filename too long ({len(filename)} chars) for upload_id={request.upload_id}")
            raise HTTPException(status_code=400, detail="Filename must be 255 characters or less")
        
        # Update the custom filename
        logger.debug(f"Updating custom filename for upload_id={request.upload_id} to: {filename}")
        upload.custom_filename = filename
        db.commit()
        db.refresh(upload)
        logger.info(f"Custom filename set successfully: upload_id={request.upload_id}, filename={filename}")
        
        return {"message": f"Filename set to {filename}", "filename": filename}
    
    except HTTPException:
        # Re-raise HTTPExceptions as-is
        raise
    except Exception as e:
        logger.error(f"Set filename failed for upload_id={request.upload_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to set filename: {str(e)}")


@router.get("/upload/preview/{upload_id}", response_class=HTMLResponse)
async def preview_docx(
    upload_id: int = Path(..., description="ID of the uploaded file"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Convert DOCX file to HTML for preview in the browser.
    Returns HTML content that can be displayed in an iframe or div.
    """
    try:
        # Find the upload record
        upload = db.query(Upload).filter(Upload.id == upload_id).first()
        if not upload:
            logger.warning(f"Preview failed: Upload not found with id={upload_id}")
            raise HTTPException(status_code=404, detail="Upload not found")
        
        # Verify user owns the file
        if upload.user_id != current_user.id:
            logger.warning(f"Preview failed: User {current_user.id} attempted to access upload {upload_id} owned by {upload.user_id}")
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Only convert DOCX files
        if upload.file_type != 'docx':
            raise HTTPException(status_code=400, detail="Preview only available for DOCX files")
        
        # Check if file exists
        if not os.path.exists(upload.file_path):
            logger.warning(f"Preview failed: File not found at {upload.file_path}")
            raise HTTPException(status_code=404, detail="File not found")
        
        # Convert DOCX to HTML using Mammoth
        try:
            with open(upload.file_path, "rb") as docx_file:
                result = mammoth.convert_to_html(docx_file)
                html_content = result.value
                
                # Add basic styling for better readability
                styled_html = f"""
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body {{
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            line-height: 1.6;
                            color: #1f2937;
                            max-width: 100%;
                            margin: 0;
                            padding: 20px;
                            background: #ffffff;
                        }}
                        p {{
                            margin: 0.75em 0;
                        }}
                        h1, h2, h3, h4, h5, h6 {{
                            margin-top: 1.5em;
                            margin-bottom: 0.75em;
                            font-weight: 600;
                            color: #111827;
                        }}
                        ul, ol {{
                            margin: 0.75em 0;
                            padding-left: 2em;
                        }}
                        li {{
                            margin: 0.25em 0;
                        }}
                        table {{
                            border-collapse: collapse;
                            width: 100%;
                            margin: 1em 0;
                        }}
                        table td, table th {{
                            border: 1px solid #e5e7eb;
                            padding: 8px 12px;
                            text-align: left;
                        }}
                        table th {{
                            background-color: #f9fafb;
                            font-weight: 600;
                        }}
                        code {{
                            background-color: #f3f4f6;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-family: 'Courier New', monospace;
                            font-size: 0.9em;
                        }}
                        pre {{
                            background-color: #f3f4f6;
                            padding: 12px;
                            border-radius: 6px;
                            overflow-x: auto;
                            margin: 1em 0;
                        }}
                        pre code {{
                            background-color: transparent;
                            padding: 0;
                        }}
                    </style>
                </head>
                <body>
                    {html_content}
                </body>
                </html>
                """
                
                return HTMLResponse(content=styled_html)
                
        except Exception as conversion_error:
            logger.error(f"DOCX to HTML conversion failed for upload_id={upload_id}: {conversion_error}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to convert DOCX to HTML: {str(conversion_error)}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Preview failed for upload_id={upload_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")
