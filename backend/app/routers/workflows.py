import base64
import asyncio
import html
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

import mammoth
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import event, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..middleware.auth import get_current_user
from ..security.execution_access import execution_user
from ..security.validators import normalize_output_name
from ..middleware.csrf import require_csrf_token
from ..models import AssignmentWorkflow, Report, Upload, User, WorkflowBatch, WorkflowBatchItem, WorkflowEvidence
from ..config import settings
from ..security.html_preview import PREVIEW_HEADERS
from ..services.lab_question_filter import filter_lab_tasks
from ..services.billing_service import reserve_workflow_credits, settle_workflow_credits
from ..services.workflow_batch import archive_chunks, create_batch_archive, stage_batch_file

router = APIRouter(prefix="/workflows")
Language = Literal["auto", "python", "java", "c", "cpp", "html", "react", "node", "sql", "colab", "ubuntu", "theory", "distributed", "r"]


class EvidenceSlot(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9_]{1,40}$")
    label: str = Field(min_length=1, max_length=120)


class QuestionInput(BaseModel):
    id: int = Field(gt=0)
    text: str = Field(min_length=1, max_length=15000)
    language: Language = "python"
    track: Optional[str] = None
    # One part of a multi-part lab experiment (Social Media Analytics). A declared kind is the lab's own decision,
    # so it is not second-guessed by the heuristics that classify uploaded manuals.
    kind: Optional[Literal["theory", "code", "evidence"]] = None
    part_title: str = Field(default="", max_length=120)
    experiment_no: Optional[int] = Field(default=None, ge=1, le=99)
    builtin_datasets: list[str] = Field(default_factory=list, max_length=8)
    evidence_slots: list[EvidenceSlot] = Field(default_factory=list, max_length=6)
    datasets: dict[str,str] = Field(default_factory=dict,max_length=20)
    colab_theme: Literal["light", "dark"] = "dark"
    rstudio_theme: Literal["light", "dark"] = "light"
    browser_theme: Literal["edge", "chrome"] = "edge"
    python_template: Literal["idle", "jupyter"] = "idle"
    jupyter_theme: Literal["light", "dark"] = "light"


class ProcessInput(BaseModel):
    questions: list[QuestionInput] = Field(min_length=1, max_length=100)
    language: Language = "auto"
    track: Optional[str] = None
    instructions: str = Field(default="", max_length=5000)
    output_name: str = Field(default="lab_report", min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    screenshot_style: str = Field(default="style_1", max_length=40)
    mode: Literal["code_only", "theory_and_code"] = "code_only"

    @field_validator("output_name", mode="before")
    @classmethod
    def _clean_output_name(cls, value):
        if not isinstance(value, str):
            return value
        normalized = normalize_output_name(value, default="")
        if not normalized:
            raise ValueError("Output filename must contain at least one alphanumeric character.")
        return normalized


def multi_part_fields(question, data):
    """Validated multi-part fields of one question (Social Media Analytics parts), or nothing for an ordinary question."""
    if not (question.kind or question.builtin_datasets or question.evidence_slots or question.experiment_no):
        return {}
    track = (question.track or getattr(data, "track", None) or "").lower()
    from ..services.lab_tools import SLOT_IDS
    # Any uploaded manual may contain a task done in an outside tool (extraction marks it as an evidence part); everything
    # else multi-part belongs to the Social Media Analytics lab.
    outside_tool = (question.kind == "evidence" and bool(question.evidence_slots) and not question.builtin_datasets
                    and all(slot.id in SLOT_IDS for slot in question.evidence_slots))
    if track != "sma" and not outside_tool:
        raise HTTPException(400, "Multi-part experiments are only available in the Social Media Analytics lab.")
    if question.kind != "evidence" and question.evidence_slots:
        raise HTTPException(400, "Only evidence parts take upload slots.")
    from ..services.sma_datasets import DATASETS
    unknown = [name for name in question.builtin_datasets if name not in DATASETS]
    if unknown:
        raise HTTPException(400, "Unknown practice dataset: %s" % unknown[0][:60])
    if len({slot.id for slot in question.evidence_slots}) != len(question.evidence_slots):
        raise HTTPException(400, "Evidence slot ids must be unique.")
    fields = {}
    if question.kind:
        fields["kind"] = question.kind
    if question.part_title:
        fields["part_title"] = question.part_title.strip()
    if question.experiment_no:
        fields["experiment_no"] = question.experiment_no
    if question.builtin_datasets:
        fields["builtin_datasets"] = list(dict.fromkeys(question.builtin_datasets))
    if question.evidence_slots:
        fields["evidence_slots"] = [slot.model_dump() for slot in question.evidence_slots]
    return fields


def owned_upload(upload_id, user, db):
    upload = db.query(Upload).filter(Upload.id == upload_id, Upload.user_id == user.id).first()
    if not upload:
        raise HTTPException(404, "Assignment not found.")
    return upload


def workflow_elapsed_seconds(workflow):
    logs = workflow.logs or []
    starts = [entry.get('time') for entry in logs if entry.get('message') == 'Processing requested.']
    # Older workflows have dated stage logs but no explicit start marker.
    if not starts:
        starts = [entry.get('time') for entry in logs if str(entry.get('message', '')).startswith(('Generating', 'Planning'))]
        starts = starts[:1]
    if not starts:
        return None
    try:
        start = datetime.fromisoformat(starts[-1])
        start = start.replace(tzinfo=timezone.utc) if start.tzinfo is None else start
        end = datetime.now(timezone.utc) if workflow.status in {'queued', 'processing'} else workflow.updated_at
        if end is None:
            return None
        end = end.replace(tzinfo=timezone.utc) if end.tzinfo is None else end
        return round(max(0, (end - start).total_seconds()), 1)
    except (ValueError, TypeError):
        return None


def same_questions(previous, current):
    """Old saved jobs omit presentation defaults now supplied by the client."""
    defaults = {'python_template':'idle', 'jupyter_theme':'light',
                'colab_theme':'dark', 'rstudio_theme':'light', 'browser_theme':'edge',
                'datasets':{}, 'track':None}
    def canonical(items):
        return [{key:value for key,value in item.items()
                 if key not in defaults or value != defaults[key]} for item in (items or [])]
    return canonical(previous) == canonical(current)


def workflow_response(workflow, db):
    report = db.query(Report).get(workflow.report_id) if workflow.report_id else None
    results = [{key: value for key, value in result.items() if key not in {"screenshot_paths", "project_files"}}
               | {"screenshots": len(result.get("screenshot_paths", [])),
                  **({"project_file_names": list(result['project_files'])} if result.get('project_files') else {})}
               for result in (workflow.results or [])]
    queue_position = None
    if workflow.status == "queued":
        queue_position = db.query(AssignmentWorkflow.id).filter(
            AssignmentWorkflow.status == "queued",
            AssignmentWorkflow.updated_at <= workflow.updated_at,
        ).count()
    return {
        "id": workflow.id, "upload_id": workflow.upload_id, "status": workflow.status,
        "stage": 'generate' if workflow.stage=='resume' else workflow.stage, "progress": workflow.progress, "questions": workflow.questions,
        "results": results, "logs": workflow.logs, "error": workflow.error,
        "language": workflow.language, "instructions": workflow.instructions, "output_name": workflow.output_name,
        "mode": workflow.mode, "screenshot_style": workflow.screenshot_style, "batch_id": workflow.batch_id,
        "agent_plan": workflow.agent_plan or {},
        "queue_position": queue_position,
        "elapsed_seconds": workflow_elapsed_seconds(workflow),
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
    db.info["_queue_capacity_user_id"] = user_id
    if not db.info.get("_queue_capacity_hook_registered"):
        db.info["_queue_capacity_hook_registered"] = True

        @event.listens_for(db, "before_commit")
        def _verify_flushed_capacity(session):
            uid = session.info.pop("_queue_capacity_user_id", None)
            if uid is None or session.get_bind().dialect.name == "postgresql":
                return
            if session.query(AssignmentWorkflow.id).join(Upload, Upload.id == AssignmentWorkflow.upload_id).filter(
                Upload.user_id == uid, AssignmentWorkflow.status.in_(queued)
            ).count() > settings.WORKFLOW_USER_QUEUE_LIMIT:
                raise HTTPException(429, "Finish an active assignment before starting another.", headers={"Retry-After": "30"})
            if session.query(AssignmentWorkflow.id).filter(AssignmentWorkflow.status.in_(queued)).count() > settings.WORKFLOW_QUEUE_LIMIT:
                raise HTTPException(503, "Assignment queue is full. Please retry shortly.", headers={"Retry-After": "30"})

        @event.listens_for(db, "after_soft_rollback")
        def _clear_capacity_check(session, previous_transaction):
            session.info.pop("_queue_capacity_user_id", None)


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
    terminal = bool(states) and all(row["status"] in {"completed", "failed", "paused"} for row in states)
    return {
        "batch_id": batch_id, "total": len(states),
        "completed": sum(row["status"] == "completed" for row in states),
        "failed": sum(row["status"] == "failed" for row in states),
        "ready_to_download": terminal and any(row["report_id"] for row in states),
        "files": states,
    }


class PromptStartInput(BaseModel):
    questions: list[QuestionInput] = Field(min_length=1, max_length=20)
    title: str = Field(default="Lab experiment", min_length=1, max_length=120)


def _write_prompt_manual(path, title, questions):
    from docx import Document
    document = Document()
    document.add_heading(title, level=1)
    for question in questions:
        document.add_heading(f"Experiment {question['id']}", level=2)
        document.add_paragraph(question["text"])
    document.save(path)


@router.post("/from-prompt")
async def start_from_prompt(data: PromptStartInput, user: User = Depends(get_current_user),
                            db: Session = Depends(get_db), csrf: bool = Depends(require_csrf_token)):
    """Start a lab from typed experiment text (a lab catalogue launch) with no uploaded manual.

    The text is saved as a small Word manual, so review, execution and the report
    treat it exactly like an upload whose questions are already extracted.
    """
    if len({q.id for q in data.questions}) != len(data.questions):
        raise HTTPException(400, "Question IDs must be unique.")
    questions = [{"id": q.id, "text": q.text.strip(), "language": "python" if q.language == "auto" else q.language,
                  **({"track": q.track} if q.track else {}), **multi_part_fields(q, data)} for q in data.questions]
    if any(not question["text"] for question in questions):
        raise HTTPException(400, "Every question needs some text.")
    title = re.sub(r"\s+", " ", data.title).strip() or "Lab experiment"
    name = normalize_output_name(title, default="lab_experiment", max_length=60)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    stored = os.path.join(settings.UPLOAD_DIR, f"{uuid.uuid4().hex}.docx")
    try:
        await asyncio.to_thread(_write_prompt_manual, stored, title, questions)
        os.chmod(stored, 0o600)
        from ..services.storage_service import storage_service
        await asyncio.to_thread(storage_service.sync_file, stored)
        upload = Upload(user_id=user.id, filename=os.path.basename(stored), original_filename=name + ".docx",
                        file_path=stored, file_type="docx", file_size=os.path.getsize(stored),
                        language=next((q["language"] for q in questions if q["language"] != "theory"), "theory"))
        db.add(upload)
        db.flush()
        workflow = AssignmentWorkflow(upload_id=upload.id, status="ready", stage="review", progress=20, language="auto",
                                      output_name=name, questions=questions, results=[], logs=[])
        db.add(workflow)
        db.commit()
    except Exception:
        db.rollback()
        if os.path.exists(stored):
            os.unlink(stored)
        raise
    db.refresh(upload)
    db.refresh(workflow)
    return {"upload": {"id": upload.id, "filename": upload.filename, "original_filename": upload.original_filename,
                       "file_type": upload.file_type, "file_size": upload.file_size,
                       "uploaded_at": upload.uploaded_at.isoformat() if upload.uploaded_at else None,
                       "language": upload.language},
            "workflow": workflow_response(workflow, db)}


@router.post("/batch-upload")
async def batch_upload(
    files: list[UploadFile] = File(...),
    mode: str = Form("code_only"),
    screenshot_style: str = Form("style_1"),
    user: User = Depends(execution_user),
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
                output_name = normalize_output_name(metadata["original_filename"])
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
        if row["status"] in {"completed", "failed"} and row["report_id"]:
            report = db.query(Report).filter_by(id=row["report_id"], upload_id=row["upload_id"]).first()
            if report is None:
                item["error"] = "The completed report is missing."
            else:
                workflow = db.get(AssignmentWorkflow, row["workflow_id"]) if row.get("workflow_id") else None
                item.update(report_path=report.file_path, report_filename=report.filename,
                            screenshots=[path for result in ((workflow.results or []) if workflow else [])
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
    if workflow and (workflow.status in {"queued", "extracting", "processing"}
                     or (workflow.status in {"ready", "completed"}
                         and (mode is None or mode == workflow.mode))):
        return workflow_response(workflow, db)
    try:
        check_queue_capacity(db, user.id)
    except HTTPException:
        # Another request may have filled the last queue slot with this upload.
        # That duplicate is a read of its existing job, not a new admission.
        db.expire_all()
        current = db.query(AssignmentWorkflow).filter_by(upload_id=upload_id).first()
        if current and (current.status in {"queued", "extracting", "processing"}
                        or (current.status in {"ready", "completed"}
                            and (mode is None or mode == current.mode))):
            return workflow_response(current, db)
        raise
    values = dict(status="queued", stage="extract", progress=0, error=None,
                  questions=[], results=[], logs=[], report_id=None,
                  claim_token=uuid.uuid4().hex, lease_expires_at=None,
                  updated_at=datetime.now(timezone.utc))
    if mode is not None:
        values["mode"] = mode
    if workflow is None:
        workflow = AssignmentWorkflow(upload_id=upload_id,
            output_name=normalize_output_name(upload.original_filename), **values)
        db.add(workflow)
        try:
            db.commit()
        except IntegrityError:
            # The unique upload_id constraint elects one creator across API
            # processes. A loser must reload without resetting the winner.
            db.rollback()
            current = db.query(AssignmentWorkflow).filter_by(upload_id=upload_id).first()
            if current is None:
                raise
            return workflow_response(current, db)
    else:
        # A retry of an existing failed job must also have only one winner.
        # The token fences a stale request even if a worker has already cycled
        # from queued back to the original status while that request waited.
        changed = db.execute(update(AssignmentWorkflow).where(
            AssignmentWorkflow.id == workflow.id,
            AssignmentWorkflow.status == workflow.status,
            AssignmentWorkflow.claim_token == workflow.claim_token,
        ).values(**values), execution_options={"synchronize_session": False}).rowcount
        if changed != 1:
            db.rollback()
            db.refresh(workflow)
            return workflow_response(workflow, db)
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
async def process(upload_id: int, data: ProcessInput, request: Request, background: BackgroundTasks, user: User = Depends(execution_user), db: Session = Depends(get_db), csrf: bool = Depends(require_csrf_token)):
    owned_upload(upload_id, user, db)
    workflow = db.query(AssignmentWorkflow).filter_by(upload_id=upload_id).first()
    if not workflow or workflow.status == "extracting" or (workflow.status == "queued" and workflow.stage == "extract"):
        raise HTTPException(409, "Extract and review the questions first.")
    if workflow.status == "queued" and workflow.stage != "extract":
        return workflow_response(workflow, db)
    if workflow.status == "processing":
        raise HTTPException(409, "This assignment is already being processed.")
    check_queue_capacity(db, user.id)
    if len({q.id for q in data.questions}) != len(data.questions):
        raise HTTPException(400, 'Question IDs must be unique; original experiment numbers are preserved.')
    questions = [{"id": q.id, "text": q.text.strip(), "language": "python" if q.language == "auto" else q.language,
                  **({'track': q.track or data.track} if (q.track or data.track) else {}),
                  **multi_part_fields(q, data),
                  **({'datasets':q.datasets} if q.datasets else {}),
                  **({'python_template':q.python_template, 'jupyter_theme':q.jupyter_theme} if q.language in {'python','auto'} or data.language in {'python','auto'} else {}),
                  **({'colab_theme':q.colab_theme} if q.language=='colab' or data.language=='colab' else {}),
                  **({'rstudio_theme':q.rstudio_theme} if q.language=='r' or data.language=='r' else {}),
                  **({'browser_theme':q.browser_theme} if q.browser_theme == 'chrome' or q.language in {'html','react','node'} or data.language in {'html','react','node'} else {})} for q in data.questions]
    if sum(sum(len(name)+len(content) for name,content in q.datasets.items()) for q in data.questions)>8*1024*1024:
        raise HTTPException(400,'Dataset upload exceeds 8 MiB.')
    # Parts the lab itself declared (kind) keep that decision; only undeclared questions go through the heuristics.
    undeclared = [question for question in questions if not question.get("kind")]
    filtered = filter_lab_tasks(undeclared, mode=data.mode)
    if len(filtered) != len(undeclared):
        raise HTTPException(400, "Only valid laboratory questions can be processed. Handwritten exercises are excluded.")
    classified_rows = iter(filtered)
    for question in questions:
        if question.get("kind"):
            # An evidence part is written up like a theory answer (no execution); the student's own screenshots
            # are attached to it afterwards.
            if question["kind"] in {"theory", "evidence"}:
                question["language"] = "theory"
                question["is_theory"] = True
            else:
                question["language"] = "colab"
            continue
        classified = next(classified_rows)
        if data.mode == "theory_and_code" and classified.get("is_theory"):
            question["language"] = "theory"
            question["is_theory"] = True
        elif question.get("track") == "sma" and question["language"] in {"python", "colab"}:
            # A Social Media Analytics manual uploaded by the student: run its code tasks as notebooks on the practice
            # data that fits each task, as the catalogue launch does, instead of on data the model would invent.
            from ..services.sma_datasets import suggest_datasets
            question["language"] = "colab"
            if not question.get("builtin_datasets"):
                names = suggest_datasets(question["text"])
                if names:
                    question["builtin_datasets"] = names
    previous_instructions = re.sub(r"^\[screenshot_style:[^\]]+\]\s*", "", workflow.instructions or "")
    resume = (workflow.status in {"paused", "failed"} and same_questions(workflow.questions, questions)
              and workflow.language == data.language and previous_instructions == data.instructions
              and workflow.mode == data.mode and workflow.screenshot_style == data.screenshot_style)
    unchanged = (same_questions(workflow.questions, questions) and workflow.language == data.language
                 and previous_instructions == data.instructions and workflow.mode == data.mode
                 and workflow.screenshot_style == data.screenshot_style)
    if workflow.status == 'completed' and unchanged and workflow.report_id:
        return workflow_response(workflow, db)
    if settings.BILLING_ENABLED:
        settle_workflow_credits(db, workflow)
    continue_pending=resume and workflow.status=='paused'
    workflow.questions = questions
    workflow.language, workflow.instructions, workflow.output_name = data.language, data.instructions, data.output_name
    workflow.mode, workflow.screenshot_style = data.mode, data.screenshot_style
    workflow.results = workflow.results if resume else []
    from ..services.brain_agent import needs_planning
    if not needs_planning(questions, data.instructions):
        reserve_workflow_credits(db, workflow, user.id)
    workflow.error, workflow.report_id = None, None
    workflow.status, workflow.stage = "queued", 'resume' if continue_pending else 'generate'
    workflow.progress = 20 + int(65 * len(workflow.results) / len(questions))
    workflow.updated_at = datetime.now(timezone.utc)
    workflow.logs = [*(workflow.logs or []), {"time": workflow.updated_at.isoformat(), "message": "Processing requested."}]
    db.commit()
    return workflow_response(workflow, db)


class ClarificationInput(BaseModel):
    revision: int = Field(ge=1)
    answers: dict[str, str]


@router.post('/{upload_id}/clarify')
async def clarify(upload_id: int, data: ClarificationInput, user: User = Depends(execution_user),
                  db: Session = Depends(get_db), csrf: bool = Depends(require_csrf_token)):
    owned_upload(upload_id, user, db)
    workflow = db.query(AssignmentWorkflow).filter_by(upload_id=upload_id).with_for_update().first()
    if not workflow or workflow.status != 'awaiting_clarification':
        raise HTTPException(409, 'This assignment is not waiting for clarification.')
    plan = dict(workflow.agent_plan or {})
    if plan.get('revision') != data.revision:
        raise HTTPException(409, 'These questions changed. Refresh the assignment before answering.')
    expected = {q['id']: q for q in plan.get('questions', [])}
    if not expected or set(data.answers) != set(expected) or len(data.answers)>3:
        raise HTTPException(422, 'Answer each pending question exactly once.')
    for key, answer in data.answers.items():
        if not answer.strip() or len(answer)>1000:
            raise HTTPException(422, 'Answers must contain between 1 and 1000 characters.')
        if expected[key].get('options') and not key.startswith('topic-') and answer not in expected[key]['options']:
            raise HTTPException(422, 'Choose one of the listed supported options.')
    check_queue_capacity(db, user.id)
    plan['answers'] = {**plan.get('answers', {}), **{k:v.strip() for k,v in data.answers.items()}}
    changed=db.execute(update(AssignmentWorkflow).where(AssignmentWorkflow.id==workflow.id,
        AssignmentWorkflow.status=='awaiting_clarification',AssignmentWorkflow.agent_plan['revision'].as_integer()==data.revision)
        .values(agent_plan=plan,status='queued',stage='generate',error=None,updated_at=datetime.now(timezone.utc)),
        execution_options={'synchronize_session':False})
    if changed.rowcount!=1:
        raise HTTPException(409,'Another response already changed this assignment. Refresh before continuing.')
    db.commit()
    db.refresh(workflow)
    return workflow_response(workflow, db)


EVIDENCE_LIMIT_PER_WORKFLOW = 16
BUSY_STATES = {"queued", "extracting", "processing"}


def _evidence_slot(workflow, question_id, slot):
    for question in workflow.questions or []:
        if question.get("id") == question_id and question.get("kind") == "evidence":
            return next((item for item in question.get("evidence_slots") or [] if item.get("id") == slot), None)
    return None


def _evidence_json(row):
    return {"id": row.id, "question_id": row.question_id, "slot": row.slot, "filename": row.original_filename,
            "size": row.file_size}


def _workflow_for_evidence(upload_id, user, db):
    owned_upload(upload_id, user, db)
    workflow = db.query(AssignmentWorkflow).filter_by(upload_id=upload_id).first()
    if workflow is None:
        raise HTTPException(404, "This assignment has not been processed yet.")
    return workflow


@router.get("/{upload_id}/evidence")
async def list_evidence(upload_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workflow = _workflow_for_evidence(upload_id, user, db)
    rows = db.query(WorkflowEvidence).filter_by(workflow_id=workflow.id).order_by(WorkflowEvidence.id).all()
    return [_evidence_json(row) for row in rows]


@router.post("/{upload_id}/evidence")
async def add_evidence(upload_id: int, question_id: int = Form(...), slot: str = Form(..., max_length=40),
                       file: UploadFile = File(...), user: User = Depends(get_current_user),
                       db: Session = Depends(get_db), csrf: bool = Depends(require_csrf_token)):
    """Attach the student's own screenshot (PNG, JPG or PDF) to one slot of an evidence part."""
    from ..services.evidence_files import MAX_BYTES, normalize_evidence
    from ..services.storage_service import storage_service
    workflow = _workflow_for_evidence(upload_id, user, db)
    if workflow.status in BUSY_STATES:
        raise HTTPException(409, "Wait for the current run to finish before changing screenshots.")
    slot_definition = _evidence_slot(workflow, question_id, slot)
    if slot_definition is None:
        raise HTTPException(400, "This experiment has no such screenshot slot.")
    data = await file.read(MAX_BYTES + 1)
    try:
        png = await asyncio.to_thread(normalize_evidence, data)
    except ValueError as error:
        raise HTTPException(400, str(error)) from None
    existing = db.query(WorkflowEvidence).filter_by(workflow_id=workflow.id, question_id=question_id, slot=slot).first()
    total = db.query(WorkflowEvidence).filter_by(workflow_id=workflow.id).count()
    if existing is None and total >= EVIDENCE_LIMIT_PER_WORKFLOW:
        raise HTTPException(400, "This assignment already has the maximum number of screenshots.")
    directory = os.path.join(settings.UPLOAD_DIR, "evidence")
    os.makedirs(directory, exist_ok=True)
    stored = os.path.join(directory, f"{uuid.uuid4().hex}.png")
    safe_name = re.sub(r"[^A-Za-z0-9._ -]+", "_", os.path.basename(file.filename or "screenshot.png"))[:120] or "screenshot.png"
    try:
        with open(stored, "wb") as handle:
            handle.write(png)
        os.chmod(stored, 0o600)
        storage_service.sync_file(stored)
        old_path = existing.file_path if existing else None
        if existing is None:
            existing = WorkflowEvidence(workflow_id=workflow.id, question_id=question_id, slot=slot, file_path=stored,
                                        original_filename=safe_name, file_size=len(png))
            db.add(existing)
        else:
            existing.file_path, existing.original_filename, existing.file_size = stored, safe_name, len(png)
        # A finished report was built from the earlier screenshots; the student runs again to include this one.
        reset = workflow.status == "completed"
        if reset:
            workflow.status, workflow.stage = "ready", "review"
        db.commit()
    except Exception:
        db.rollback()
        if os.path.exists(stored):
            os.unlink(stored)
        raise
    if old_path and old_path != stored:
        try:
            storage_service.delete_file(old_path)
        except OSError:
            pass
    db.refresh(existing)
    return {**_evidence_json(existing), "label": slot_definition.get("label"), "report_outdated": reset}


@router.get("/{upload_id}/evidence/{evidence_id}/image")
async def evidence_image(upload_id: int, evidence_id: int, user: User = Depends(get_current_user),
                         db: Session = Depends(get_db)):
    from ..services.storage_service import storage_service
    workflow = _workflow_for_evidence(upload_id, user, db)
    row = db.query(WorkflowEvidence).filter_by(id=evidence_id, workflow_id=workflow.id).first()
    if row is None:
        raise HTTPException(404, "Screenshot not found.")
    try:
        path = await asyncio.to_thread(storage_service.ensure_local, row.file_path)
    except FileNotFoundError:
        raise HTTPException(404, "Screenshot not found.") from None
    return FileResponse(path, media_type="image/png",
                        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=300",
                                 "Content-Security-Policy": "default-src 'none'"})


@router.delete("/{upload_id}/evidence/{evidence_id}")
async def delete_evidence(upload_id: int, evidence_id: int, user: User = Depends(get_current_user),
                          db: Session = Depends(get_db), csrf: bool = Depends(require_csrf_token)):
    from ..services.storage_service import storage_service
    workflow = _workflow_for_evidence(upload_id, user, db)
    if workflow.status in BUSY_STATES:
        raise HTTPException(409, "Wait for the current run to finish before changing screenshots.")
    row = db.query(WorkflowEvidence).filter_by(id=evidence_id, workflow_id=workflow.id).first()
    if row is None:
        raise HTTPException(404, "Screenshot not found.")
    path = row.file_path
    db.delete(row)
    reset = workflow.status == "completed"
    if reset:
        workflow.status, workflow.stage = "ready", "review"
    db.commit()
    try:
        storage_service.delete_file(path)
    except OSError:
        pass
    return {"deleted": evidence_id, "report_outdated": reset}


def _convert_docx_to_html(file_path: str) -> str:
    def convert_image(image):
        with image.open() as stream:
            encoded = base64.b64encode(stream.read()).decode("ascii")
        return {"src": f"data:{image.content_type};base64,{encoded}"}
    with open(file_path, "rb") as source:
        result = mammoth.convert_to_html(source, convert_image=mammoth.images.img_element(convert_image))
    return result.value


@router.get("/{upload_id}/preview", response_class=HTMLResponse)
async def preview(upload_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_upload(upload_id, user, db)
    workflow = db.query(AssignmentWorkflow).filter_by(upload_id=upload_id).first()
    report = db.query(Report).get(workflow.report_id) if workflow and workflow.report_id else None
    if not report or not os.path.isfile(report.file_path):
        raise HTTPException(404, "The Word document is not ready yet.")
    html_value = await asyncio.to_thread(_convert_docx_to_html, report.file_path)
    # Browser sandbox plus restrictive CSP protect previews of user-supplied documents.
    return HTMLResponse(f'''<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>{html.escape(report.filename)}</title><style>body{{max-width:780px;margin:24px auto;padding:28px;background:white;color:#172747;font:14px/1.6 Arial,sans-serif}}img{{max-width:100%;height:auto}}table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #ccd5e3;padding:8px}}pre{{white-space:pre-wrap}}h1,h2,h3{{line-height:1.3}}a{{color:#075cf7;pointer-events:none}}</style></head><body>{html_value}</body></html>''', headers=PREVIEW_HEADERS)
