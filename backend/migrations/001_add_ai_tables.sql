-- Migration: Add AI job and task tables
-- Created: 2025-10-11
-- Description: Add tables for AI-powered document analysis and task execution

-- Create ai_jobs table
CREATE TABLE ai_jobs (
    id SERIAL PRIMARY KEY,
    upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    theme VARCHAR(20) NOT NULL DEFAULT 'idle',
    insertion_preference VARCHAR(20) NOT NULL DEFAULT 'below_question',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create ai_tasks table
CREATE TABLE ai_tasks (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES ai_jobs(id) ON DELETE CASCADE,
    task_id VARCHAR(100) NOT NULL,
    task_type VARCHAR(30) NOT NULL,
    question_context TEXT NOT NULL,
    suggested_code TEXT,
    user_code TEXT,
    extracted_code TEXT,
    assistant_answer TEXT,
    confidence INTEGER NOT NULL DEFAULT 0,
    suggested_insertion VARCHAR(20) NOT NULL DEFAULT 'below_question',
    brief_description TEXT,
    follow_up TEXT,
    follow_up_answer TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    screenshot_path VARCHAR(500),
    stdout TEXT,
    exit_code INTEGER,
    caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX idx_ai_jobs_upload_id ON ai_jobs(upload_id);
CREATE INDEX idx_ai_jobs_status ON ai_jobs(status);
CREATE INDEX idx_ai_tasks_job_id ON ai_tasks(job_id);
CREATE INDEX idx_ai_tasks_task_id ON ai_tasks(task_id);
CREATE INDEX idx_ai_tasks_status ON ai_tasks(status);

-- Add comments for documentation
COMMENT ON TABLE ai_jobs IS 'Batch jobs for AI-powered task processing';
COMMENT ON TABLE ai_tasks IS 'Individual AI-generated tasks within a job';

COMMENT ON COLUMN ai_jobs.status IS 'Job status: pending, running, completed, failed';
COMMENT ON COLUMN ai_jobs.theme IS 'Editor theme: idle or vscode';
COMMENT ON COLUMN ai_jobs.insertion_preference IS 'Where to insert results: below_question or bottom_of_page';

COMMENT ON COLUMN ai_tasks.task_type IS 'Type of task: screenshot_request, answer_request, code_execution';
COMMENT ON COLUMN ai_tasks.confidence IS 'AI confidence score 0-100';
COMMENT ON COLUMN ai_tasks.status IS 'Task status: pending, running, completed, failed';
COMMENT ON COLUMN ai_tasks.screenshot_path IS 'Path to generated screenshot file';
COMMENT ON COLUMN ai_tasks.exit_code IS 'Code execution exit code';
