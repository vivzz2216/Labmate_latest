-- Apply once to existing PostgreSQL or SQLite deployments before scaling workers.
CREATE INDEX IF NOT EXISTS idx_workflows_status_updated
ON assignment_workflows(status, updated_at, id);
