-- Add React project support fields to ai_tasks table
ALTER TABLE ai_tasks ADD COLUMN IF NOT EXISTS project_files JSON;
ALTER TABLE ai_tasks ADD COLUMN IF NOT EXISTS routes JSON;
ALTER TABLE ai_tasks ADD COLUMN IF NOT EXISTS screenshot_urls JSON;

