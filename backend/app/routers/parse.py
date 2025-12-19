from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Upload
from ..schemas import ParseResponse, Task
from ..services.parser_service import parser_service
from ..middleware.auth import get_current_user, verify_upload_ownership
from ..models import User
import logging

# Set up logging for debugging
logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/parse/{file_id}", response_model=ParseResponse)
async def parse_file(
    file_id: int = Path(..., description="ID of the uploaded file"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Parse uploaded file and extract code blocks and tasks.
    Requires JWT authentication and verifies upload ownership.
    """
    logger.debug(f"Parse request received for file_id: {file_id}")
    
    # Verify user owns the upload
    upload = await verify_upload_ownership(file_id, current_user, db)
    
    logger.debug(f"Found upload: id={upload.id}, file_path={upload.file_path}, file_type={upload.file_type}")
    
    try:
        # Parse the file
        logger.debug(f"Calling parser_service.parse_file for {upload.file_path}")
        tasks_data = await parser_service.parse_file(upload.file_path, upload.file_type)
        logger.debug(f"Parser returned {len(tasks_data) if tasks_data else 0} tasks")
        
        # FIXED: Ensure tasks_data is always a list
        if not isinstance(tasks_data, list):
            logger.warning(f"Parser returned non-list data: {type(tasks_data)}, converting to list")
            tasks_data = []
        
        # Convert to Task objects and detect language
        tasks = []
        detected_languages = []
        
        for idx, task_data in enumerate(tasks_data):
            try:
                # FIXED: Validate task_data structure before creating Task
                if not isinstance(task_data, dict):
                    logger.warning(f"Task data at index {idx} is not a dict: {type(task_data)}, skipping")
                    continue
                
                # Ensure all required fields exist with defaults
                ai_answer_value = task_data.get("ai_answer")
                if not isinstance(ai_answer_value, str):
                    ai_answer_value = ""

                # Collect detected language from task
                detected_lang = task_data.get("detected_language")
                if detected_lang and detected_lang not in detected_languages:
                    detected_languages.append(detected_lang)

                task = Task(
                    id=task_data.get("id", idx + 1),  # Use index+1 as fallback ID
                    question_text=task_data.get("question_text", ""),
                    code_snippet=task_data.get("code_snippet", ""),
                    requires_screenshot=task_data.get("requires_screenshot", False),
                    ai_answer=ai_answer_value
                )
                tasks.append(task)
                logger.debug(f"Created task {task.id}: question_text length={len(task.question_text)}, code_snippet length={len(task.code_snippet)}")
            except Exception as task_error:
                logger.error(f"Error creating task from data at index {idx}: {task_error}", exc_info=True)
                # Continue processing other tasks instead of failing completely
                continue
        
        # Detect and set upload language based on detected languages from code snippets
        if detected_languages:
            # Use the most common language, or first non-Python language found
            language_counts = {}
            for lang in detected_languages:
                language_counts[lang] = language_counts.get(lang, 0) + 1
            
            # Prefer non-Python languages if found
            non_python_langs = [lang for lang in detected_languages if lang != "python"]
            if non_python_langs:
                # Get most common non-Python language
                most_common = max(non_python_langs, key=lambda x: detected_languages.count(x))
                upload.language = most_common
            else:
                # Default to most common language (likely Python)
                upload.language = max(language_counts, key=language_counts.get)
            
            db.commit()
            db.refresh(upload)  # Refresh to get updated language
            logger.info(f"Detected language from code snippets: {upload.language} (from {len(detected_languages)} detections)")
        
        # FIXED: Always return ParseResponse with tasks array (even if empty)
        logger.info(f"Parse completed: {len(tasks)} tasks extracted from file_id={file_id}")
        response = ParseResponse(tasks=tasks)
        logger.debug(f"Returning ParseResponse with {len(response.tasks)} tasks")
        return response
        
    except HTTPException:
        # Re-raise HTTPExceptions as-is
        raise
    except FileNotFoundError as e:
        logger.error(f"Parse failed: File not found on disk - {upload.file_path}: {e}")
        raise HTTPException(status_code=404, detail=f"File not found on disk: {str(e)}")
    except Exception as e:
        logger.error(f"Parse failed for file_id={file_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)}")
