-- Performance indexes for 1000+ user scalability
-- These indexes optimize common query patterns

-- Indexes for Upload table
CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_uploads_uploaded_at ON uploads(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploads_language ON uploads(language);

-- Indexes for Job table
CREATE INDEX IF NOT EXISTS idx_jobs_upload_id ON jobs(upload_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_upload_status ON jobs(upload_id, status);

-- Indexes for Screenshot table
CREATE INDEX IF NOT EXISTS idx_screenshots_job_id ON screenshots(job_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_created_at ON screenshots(created_at DESC);

-- Indexes for Report table
CREATE INDEX IF NOT EXISTS idx_reports_upload_id ON reports(upload_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- Indexes for AIJob table
CREATE INDEX IF NOT EXISTS idx_ai_jobs_upload_id ON ai_jobs(upload_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_created_at ON ai_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_upload_status ON ai_jobs(upload_id, status);

-- Indexes for AITask table
CREATE INDEX IF NOT EXISTS idx_ai_tasks_job_id ON ai_tasks(job_id);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_task_type ON ai_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_job_status ON ai_tasks(job_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_created_at ON ai_tasks(created_at DESC);

-- Composite index for common query pattern: get user uploads with status
CREATE INDEX IF NOT EXISTS idx_uploads_user_uploaded ON uploads(user_id, uploaded_at DESC);

-- Composite index for job queries by upload and status
CREATE INDEX IF NOT EXISTS idx_jobs_upload_status_created ON jobs(upload_id, status, created_at DESC);

