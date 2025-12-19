from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Union, Any
from datetime import datetime


# Upload schemas
class UploadResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    uploaded_at: datetime
    language: Optional[str] = None  # Detected language from code snippets
    
    class Config:
        from_attributes = True


# Task schemas
class Task(BaseModel):
    id: int
    question_text: str
    code_snippet: str
    requires_screenshot: bool
    ai_answer: str


class ParseResponse(BaseModel):
    tasks: List[Task]


# Job schemas
class RunRequest(BaseModel):
    upload_id: int
    task_ids: List[int]
    theme: str = Field(default="idle", pattern="^(idle|vscode|notepad|codeblocks|html|react|node)$")
    screenshot_task_ids: Optional[List[int]] = None


class FileResult(BaseModel):
    filename: str
    content: str
    type: str
    screenshot_url: Optional[str] = None


class JobStatus(BaseModel):
    id: int
    task_id: int
    question_text: str
    status: str
    output_text: Optional[str] = None
    error_message: Optional[str] = None
    execution_time: Optional[int] = None
    screenshot_url: Optional[str] = None
    screenshot_urls: Optional[List[str]] = None
    files: Optional[List[FileResult]] = None
    code_snippet: Optional[str] = None
    
    class Config:
        from_attributes = True


class RunResponse(BaseModel):
    jobs: List[JobStatus]


# Compose schemas
class ComposeRequest(BaseModel):
    upload_id: int
    screenshot_order: Optional[List[int]] = None


class ComposeResponse(BaseModel):
    report_id: int
    filename: str
    download_url: str


# Screenshot schemas
class ScreenshotInfo(BaseModel):
    id: int
    job_id: int
    file_path: str
    width: int
    height: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# AI Analysis schemas
class AITaskCandidate(BaseModel):
    task_id: str
    question_context: str
    task_type: str  # screenshot_request, answer_request, code_execution, react_project
    suggested_code: Optional[Union[str, Dict[str, str]]] = None  # String for normal tasks, Dict for React projects
    extracted_code: Optional[str] = None
    confidence: float  # 0-1
    suggested_insertion: str = "below_question"  # below_question, bottom_of_page
    brief_description: str
    follow_up: Optional[str] = None
    project_files: Optional[Dict[str, str]] = None  # For React projects
    routes: Optional[List[str]] = None  # For React projects
    project_type: Optional[str] = None  # Detected project type (html/react/node/python)
    project_confidence: Optional[float] = None  # Detector confidence
    project_indicators: Optional[List[str]] = None  # Detector indicators


class AnalyzeRequest(BaseModel):
    file_id: int
    language: Optional[str] = None


class AnalyzeResponse(BaseModel):
    candidates: List[AITaskCandidate]


class TaskSubmission(BaseModel):
    task_id: str
    selected: bool
    user_code: Optional[str] = None
    follow_up_answer: Optional[str] = None
    insertion_preference: str = "below_question"
    task_type: Optional[str] = None  # For react_project
    question_context: Optional[str] = None
    project_files: Optional[Dict[str, str]] = None  # For React projects
    routes: Optional[List[str]] = None  # For React projects
    project_type: Optional[str] = None  # Detected/overridden project type
    project_config: Optional[Dict[str, Any]] = None  # Additional execution config


class TasksSubmitRequest(BaseModel):
    file_id: int
    tasks: List[TaskSubmission]
    theme: str = Field(default="idle", pattern="^(idle|vscode|notepad|codeblocks|html|react|node)$")
    insertion_preference: str = Field(default="below_question")


class TasksSubmitResponse(BaseModel):
    job_id: int
    status: str


class TaskResult(BaseModel):
    id: int
    task_id: str
    task_type: str
    status: str
    screenshot_url: Optional[str] = None
    stdout: Optional[str] = None
    exit_code: Optional[int] = None
    caption: Optional[str] = None
    assistant_answer: Optional[str] = None
    
    class Config:
        from_attributes = True


class JobStatusResponse(BaseModel):
    job_id: int
    status: str
    tasks: List[TaskResult]
    
    class Config:
        from_attributes = True
