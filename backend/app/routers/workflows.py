import base64
import asyncio
import html
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Literal

import mammoth
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..middleware.auth import get_current_user
from ..middleware.csrf import require_csrf_token
from ..models import AssignmentWorkflow, Report, Upload, User, WorkflowBatch, WorkflowBatchItem
from ..config import settings
from ..services.lab_question_filter import filter_lab_tasks
from ..services.workflow_batch import archive_chunks, create_batch_archive, stage_batch_file

router = APIRouter(prefix="/workflows")
Language = Literal["auto", "python", "java", "c", "cpp", "html", "react", "node", "theory"]


class QuestionInput(BaseModel):
    id: int = Field(gt=0)
    text: str = Field(min_length=1, max_length=15000)
    language: Language = "python"


class ProcessInput(BaseModel):
    questions: list[QuestionInput] = Field(min_length=1, max_length=100)
    language: Language = "auto"
    instructions: str = Field(default="", max_length=5000)
    output_name: str = Field(default="lab_report", min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    screenshot_style: str = Field(default="style_1", max_length=40)
    mode: Literal["code_only", "theory_and_code"] = "code_only"


def owned_upload(upload_id, user, db):
    upload = db.query(Upload).filter(Upload.id == upload_id, Upload.user_id == user.id).first()
    if not upload:
        raise HTTPException(404, "Assignment not found.")
    return upload


def workflow_response(workflow, db):
    report = db.query(Report).get(workflow.report_id) if workflow.report_id else None
    results = [{key: value for key, value in result.items() if key != "screenshot_paths"} | {"screenshots": len(result.get("screenshot_paths", []))} for result in (workflow.results or [])]
    queue_position = None
    if workflow.status == "queued":
        queue_position = db.query(AssignmentWorkflow.id).filter(
            AssignmentWorkflow.status == "queued",
            AssignmentWorkflow.updated_at <= workflow.updated_at,
        ).count()
    return {
        "id": workflow.id, "upload_id": workflow.upload_id, "status": workflow.status,
        "stage": workflow.stage, "progress": workflow.progress, "questions": workflow.questions,
        "results": results, "logs": workflow.logs, "error": workflow.error,
        "language": workflow.language, "instructions": workflow.instructions, "output_name": workflow.output_name,
        "mode": workflow.mode, "screenshot_style": workflow.screenshot_style, "batch_id": workflow.batch_id,
        "queue_position": queue_position,
        "report": {"id": report.id, "filename": report.filename, "size": report.file_size, "download_url": f"/api/download/{report.id}"} if report else None,
    }


def check_queue_capacity(db, user_id, additional=1):
    queued = ("queued", "extracting", "processing")
    if db.get_bind().dialect.name == "postgresql":
        # Serialize the global count with submissions in other API processes.
        db.execute(text("SELECT pg_advisory_xact_lock(92410351)"))
    # Serialize submissions for one account on PostgreSQL. SQLite keeps its
    # usual single-writer behavior for local development.
    db.query(User).filter(User.id == user_id).with_for_update().first()
    if db.query(AssignmentWorkflow.id).join(Upload, Upload.id == AssignmentWorkflow.upload_id).filter(
        Upload.user_id == user_id, AssignmentWorkflow.status.in_(queued)
    ).count() + additional > settings.WORKFLOW_USER_QUEUE_LIMIT:
        raise HTTPException(429, "Finish an active assignment before starting another.", headers={"Retry-After": "30"})
    if db.query(AssignmentWorkflow.id).filter(AssignmentWorkflow.status.in_(queued)).count() + additional > settings.WORKFLOW_QUEUE_LIMIT:
        raise HTTPException(503, "Assignment queue is full. Please retry shortly.", headers={"Retry-After": "30"})


def owned_batch(batch_id, user, db):
    batch = db.query(WorkflowBatch).filter_by(id=batch_id, user_id=user.id).first()
    if batch is None:
        raise HTTPException(404, "Batch not found.")
    return batch


def batch_status(batch_id, user, db):
    owned_batch(batch_id, user, db)
    items = db.query(WorkflowBatchItem).filter_by(batch_id=batch_id).order_by(WorkflowBatchItem.position).all()
    states = []
    for item in items:
        workflow = db.get(AssignmentWorkflow, item.workflow_id) if item.workflow_id else None
        status = workflow.status if workflow else "failed"
        states.append({
            "position": item.position, "filename": item.original_filename,
            "upload_id": item.upload_id, "workflow_id": item.workflow_id,
            "status": status, "stage": workflow.stage if workflow else "upload",
            "progress": workflow.progress if workflow else 0,
            "error": (workflow.error if workflow else item.error),
            "report_id": workflow.report_id if workflow else None,
        })
    terminal = bool(states) and all(row["status"] in {"completed", "failed"} for row in states)
    return {
        "batch_id": batch_id, "total": len(states),
        "completed": sum(row["status"] == "completed" for row in states),
        "failed": sum(row["status"] == "failed" for row in states),
        "ready_to_download": terminal and any(row["status"] == "completed" for row in states),
        "files": states,
    }


@router.post("/batch-upload")
async def batch_upload(
    files: list[UploadFile] = File(...),
    mode: str = Form("code_only"),
    screenshot_style: str = Form("style_1"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    csrf: bool = Depends(require_csrf_token),
):
    if not 1 <= len(files) <= 10:
        raise HTTPException(400, "Submit between 1 and 10 documents per batch.")
    if mode not in {"code_only", "theory_and_code"}:
        raise HTTPException(400, "Invalid processing mode.")
    if screenshot_style not in {"style_1", "style_2", "style_3"}:
        raise HTTPException(400, "Invalid screenshot style.")
    staged = []
    try:
        for file in files:
            metadata, error = await stage_batch_file(file)
            display_name = (file.filename or "unnamed")[:255]
            staged.append({"metadata": metadata, "error": error, "display_name": display_name})
        accepted = sum(row["metadata"] is not None for row in staged)
        if accepted:
            check_queue_capacity(db, user.id, additional=accepted)
        batch_id = uuid.uuid4().hex
        db.add(WorkflowBatch(id=batch_id, user_id=user.id))
        db.flush()
        for position, row in enumerate(staged, 1):
            metadata = row["metadata"]
            item = WorkflowBatchItem(batch_id=batch_id, position=position,
                                     original_filename=metadata["original_filename"] if metadata else row["display_name"],
                                     error=row["error"])
            if metadata:
                upload = Upload(user_id=user.id, **metadata)
                db.add(upload)
                db.flush()
                output_name = re.sub(r"[^A-Za-z0-9_-]", "_", os.path.splitext(metadata["original_filename"])[0])[:70].strip("_") or "lab_report"
                workflow = AssignmentWorkflow(
                    upload_id=upload.id, batch_id=batch_id, status="queued", stage="extract",
                    progress=0, language="auto", mode=mode, screenshot_style=screenshot_style,
                    output_name=output_name, questions=[], results=[], logs=[],
                )
                db.add(workflow)
                db.flush()
                item.upload_id, item.workflow_id = upload.id, workflow.id
            db.add(item)
        db.commit()
    except Exception:
        db.rollback()
        for row in staged:
            if row["metadata"]:
                from pathlib import Path
                Path(row["metadata"]["file_path"]).unlink(missing_ok=True)
        raise
    return batch_status(batch_id, user, db)


@router.get("/batch/{batch_id}")
async def get_batch(batch_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return batch_status(batch_id, user, db)


@router.get("/batch/{batch_id}/download-zip")
async def download_batch_zip(batch_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    state = batch_status(batch_id, user, db)
    if not state["ready_to_download"]:
        raise HTTPException(409, "Wait for every file to finish; at least one report must be ready.")
    archive_items = []
    for row in state["files"]:
        item = {"position": row["position"], "original_filename": row["filename"], "error": row["error"]}
        if row["status"] == "completed" and row["report_id"]:
            report = db.query(Report).filter_by(id=row["report_id"], upload_id=row["upload_id"]).first()
            if report is None:
                item["error"] = "The completed report is missing."
            else:
                workflow = db.get(AssignmentWorkflow, row["workflow_id"])
                item.update(report_path=report.file_path, report_filename=report.filename,
                            screenshots=[path for result in (workflow.results or [])
                                         for path in result.get("screenshot_paths", [])])
        elif row["status"] == "completed":
            item["error"] = "The completed report is missing."
        archive_items.append(item)
    try:
        archive = await asyncio.to_thread(create_batch_archive, archive_items)
    except (OSError, ValueError):
        raise HTTPException(409, "A report or screenshot is unavailable; retry after it is restored.") from None
    filename = f"LabMate_Completed_Batch_{batch_id[:8]}.zip"
    return StreamingResponse(archive_chunks(archive), media_type="application/zip",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"',
                                      "Cache-Control": "no-store"})


@router.post("/{upload_id}/extract")
async def extract(upload_id: int, request: Request, background: BackgroundTasks, mode: Literal["code_only", "theory_and_code"] | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db), csrf: bool = Depends(require_csrf_token)):
    upload = owned_upload(upload_id, user, db)
    workflow = db.query(AssignmentWorkflow).filter_by(upload_id=upload_id).first()
    if workflow and workflow.status in {"queued", "extracting", "processing"}:
        return workflow_response(workflow, db)
    check_queue_capacity(db, user.id)
    if workflow is None:
        workflow = AssignmentWorkflow(upload_id=upload_id, output_name=os.path.splitext(upload.original_filename)[0].replace(" ", "_")[:70] or "lab_report")
        db.add(workflow)
    if mode is not None:
        workflow.mode = mode
    workflow.status, workflow.stage, workflow.progress = "queued", "extract", 0
    workflow.error, workflow.questions, workflow.results, workflow.logs = None, [], [], []
    workflow.report_id = None
    workflow.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(workflow)
    return workflow_response(workflow, db)


@router.get("/{upload_id}")
async def get_workflow(upload_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_upload(upload_id, user, db)
    workflow = db.query(AssignmentWorkflow).filter_by(upload_id=upload_id).first()
    if not workflow:
        raise HTTPException(404, "This assignment has not been processed yet.")
    return workflow_response(workflow, db)


@router.post("/{upload_id}/process")
async def process(upload_id: int, data: ProcessInput, request: Request, background: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db), csrf: bool = Depends(require_csrf_token)):
    owned_upload(upload_id, user, db)
    workflow = db.query(AssignmentWorkflow).filter_by(upload_id=upload_id).first()
    if not workflow or workflow.status == "extracting" or (workflow.status == "queued" and workflow.stage == "extract"):
        raise HTTPException(409, "Extract and review the questions first.")
    if workflow.status == "queued" and workflow.stage != "extract":
        return workflow_response(workflow, db)
    if workflow.status == "processing":
        raise HTTPException(409, "This assignment is already being processed.")
    check_queue_capacity(db, user.id)
    questions = [{"id": index + 1, "text": q.text.strip(), "language": "python" if q.language == "auto" else q.language} for index, q in enumerate(data.questions)]
    filtered = filter_lab_tasks(questions, mode=data.mode)
    if len(filtered) != len(questions):
        raise HTTPException(400, "Only valid laboratory questions can be processed. Handwritten exercises are excluded.")
    if data.mode == "theory_and_code":
        for question, classified in zip(questions, filtered):
            if classified.get("is_theory"):
                question["language"] = "theory"
                question["is_theory"] = True
    previous_instructions = re.sub(r"^\[screenshot_style:[^\]]+\]\s*", "", workflow.instructions or "")
    resume = (workflow.status in {"paused", "failed"} and workflow.questions == questions
              and workflow.language == data.language and previous_instructions == data.instructions
              and workflow.mode == data.mode and workflow.screenshot_style == data.screenshot_style)
    workflow.questions = questions
    workflow.language, workflow.instructions, workflow.output_name = data.language, data.instructions, data.output_name
    workflow.mode, workflow.screenshot_style = data.mode, data.screenshot_style
    workflow.results = workflow.results if resume else []
    workflow.error, workflow.report_id = None, None
    workflow.status, workflow.stage = "queued", "generate"
    workflow.progress = 20 + int(65 * len(workflow.results) / len(questions))
    workflow.updated_at = datetime.now(timezone.utc)
    db.commit()
    return workflow_response(workflow, db)


@router.get("/{upload_id}/preview", response_class=HTMLResponse)
async def preview(upload_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_upload(upload_id, user, db)
    workflow = db.query(AssignmentWorkflow).filter_by(upload_id=upload_id).first()
    report = db.query(Report).get(workflow.report_id) if workflow and workflow.report_id else None
    if not report or not os.path.isfile(report.file_path):
        raise HTTPException(404, "The Word document is not ready yet.")
    def convert_image(image):
        with image.open() as stream:
            encoded = base64.b64encode(stream.read()).decode("ascii")
        return {"src": f"data:{image.content_type};base64,{encoded}"}
    with open(report.file_path, "rb") as source:
        result = mammoth.convert_to_html(source, convert_image=mammoth.images.img_element(convert_image))
    # Browser sandbox plus restrictive CSP protect previews of user-supplied documents.
    return HTMLResponse(f'''<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>{html.escape(report.filename)}</title><style>body{{max-width:780px;margin:24px auto;padding:28px;background:white;color:#172747;font:14px/1.6 Arial,sans-serif}}img{{max-width:100%;height:auto}}table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #ccd5e3;padding:8px}}pre{{white-space:pre-wrap}}h1,h2,h3{{line-height:1.3}}a{{color:#075cf7;pointer-events:none}}</style></head><body>{result.value}</body></html>''', headers={"Cache-Control": "no-store"})
