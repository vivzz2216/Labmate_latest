"""Small idempotent migration for workflow columns on existing deployments."""

from sqlalchemy import inspect, text


def ensure_workflow_columns(engine):
    if engine is None or not inspect(engine).has_table("assignment_workflows"):
        return
    dialect = engine.dialect.name
    definitions = {
        "batch_id": "VARCHAR(36)",
        "mode": "VARCHAR(24) NOT NULL DEFAULT 'code_only'",
        "screenshot_style": "VARCHAR(40) NOT NULL DEFAULT 'style_1'",
    }
    with engine.begin() as connection:
        if dialect == "postgresql":
            for name, definition in definitions.items():
                connection.execute(text(
                    f"ALTER TABLE assignment_workflows ADD COLUMN IF NOT EXISTS {name} {definition}"))
        elif dialect == "sqlite":
            present = {column["name"] for column in inspect(connection).get_columns("assignment_workflows")}
            for name, definition in definitions.items():
                if name not in present:
                    connection.execute(text(f"ALTER TABLE assignment_workflows ADD COLUMN {name} {definition}"))
        else:
            raise RuntimeError(f"Unsupported workflow schema migration dialect: {dialect}")
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_assignment_workflows_batch_id "
            "ON assignment_workflows (batch_id)"))
