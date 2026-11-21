"""Execute report SQL in a private, bounded, in-memory SQLite database."""
import re
import sqlite3
import time

from .sql_runtime import _extract_table_name, expects_error, split_sql_statements

MAX_ROWS = 100
MAX_STATEMENTS = 100
_ALLOWED = {getattr(sqlite3, f"SQLITE_{name}") for name in (
    "ALTER_TABLE", "CREATE_INDEX", "CREATE_TABLE", "CREATE_TRIGGER", "CREATE_VIEW",
    "DELETE", "DROP_INDEX", "DROP_TABLE", "DROP_TRIGGER", "DROP_VIEW", "FUNCTION",
    "INSERT", "READ", "RECURSIVE", "REINDEX", "SAVEPOINT", "SELECT", "TRANSACTION", "UPDATE",
)}


def _authorize(action, first, second, database, _source):
    if action == sqlite3.SQLITE_PRAGMA:
        if (first or "").lower() in {"table_info", "table_xinfo", "index_list", "index_info", "foreign_key_list"}:
            return sqlite3.SQLITE_OK
        return sqlite3.SQLITE_DENY
    if action not in _ALLOWED or database not in (None, "main"):
        return sqlite3.SQLITE_DENY
    if action == sqlite3.SQLITE_FUNCTION and (second or "").lower() in {"load_extension", "readfile", "writefile", "fts3_tokenizer"}:
        return sqlite3.SQLITE_DENY
    return sqlite3.SQLITE_OK


def _value(value):
    return value.hex() if isinstance(value, bytes) else value


def _headers(cursor):
    columns = []
    for item in cursor.description:
        label = item[0]
        unique = label
        suffix = 2
        while unique in columns:
            unique = f"{label} ({suffix})"
            suffix += 1
        columns.append(unique)
    return columns


def _snapshot(db):
    tables = {}
    catalog = db.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 24")
    for (name,) in catalog:
        quoted = '"' + name.replace('"', '""') + '"'
        cursor = db.execute(f"SELECT * FROM {quoted} LIMIT {MAX_ROWS}")
        columns = _headers(cursor)
        tables[name] = {"columns": columns, "rows": [
            dict(zip(columns, map(_value, row))) for row in cursor
        ]}
    return {"main": {"tables": tables}}


def execute_sqlite_script(code):
    if len(code) > 64000:
        raise ValueError("SQLite script exceeds the report limit.")
    parts = split_sql_statements(code, sqlite=True)
    if len(parts) > MAX_STATEMENTS:
        raise ValueError("SQLite reports support up to 100 statements per exercise.")
    db = sqlite3.connect(":memory:", isolation_level=None)
    statements, select_results, errors = [], [], []
    budget_ticks = 0
    deadline = time.monotonic() + 8

    def limits():
        nonlocal budget_ticks
        budget_ticks += 1
        return int(budget_ticks > 3500 or time.monotonic() > deadline)

    try:
        db.execute("PRAGMA temp_store = MEMORY")
        db.execute("PRAGMA trusted_schema = OFF")
        db.execute("PRAGMA foreign_keys = ON")
        db.execute("PRAGMA max_page_count = 256")
        db.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, 4096)
        db.setlimit(sqlite3.SQLITE_LIMIT_COLUMN, 48)
        db.set_authorizer(_authorize)
        db.set_progress_handler(limits, 1000)
        schemas = {"main": {"tables": {}}}
        for index, part in enumerate(parts, 1):
            sql = part["statement"]
            kind = (re.match(r"\w+", sql) or [""])[0].upper()
            started = time.monotonic()
            columns, rows, truncated = [], [], False
            expected = expects_error(part["leading_comment"])
            requested_error = False
            try:
                cursor = db.execute(sql)
                if cursor.description:
                    columns = _headers(cursor)
                    raw_rows = cursor.fetchmany(MAX_ROWS + 1)
                    truncated = len(raw_rows) > MAX_ROWS
                    rows = [dict(zip(columns, map(_value, row))) for row in raw_rows[:MAX_ROWS]]
                    kind = "SELECT"
                    message = f"{len(rows)} row(s) returned"
                else:
                    message = f"{cursor.rowcount} row(s) affected" if cursor.rowcount >= 0 else "Statement completed"
                    if kind in {"CREATE", "DROP", "ALTER", "UPDATE", "INSERT", "DELETE", "REPLACE", "ROLLBACK", "COMMIT", "WITH"}:
                        schemas = _snapshot(db)
                success = not expected
                if expected:
                    message = "Expected a constraint error, but the statement succeeded."
            except sqlite3.Error as exc:
                requested_error = expected and isinstance(exc, sqlite3.IntegrityError)
                success = requested_error
                message = f"Expected error: {exc}" if requested_error else str(exc)
            table = _extract_table_name(sql, kind)
            record = {**part, "index": index, "type": kind, "display_action": sql, "message": message,
                      "success": success, "expected_error": requested_error,
                      "duration": f"{time.monotonic() - started:.3f} sec", "columns": columns, "rows": rows,
                      "tableName": table, "schemaName": "main", "active_schema": "main",
                      "schemas_snapshot": schemas, "truncated": truncated}
            statements.append(record)
            if not success:
                errors.append(f"Line {part['start_line']}: {message}")
                break
            if columns:
                select_results.append(record)
        return {"success": bool(statements) and not errors, "dialect": "sqlite",
                "server_version": sqlite3.sqlite_version, "statements": statements, "select_results": select_results,
                "schemas": schemas, "active_schema": "main", "error": "\n".join(errors),
                "stdout": "\n".join(f"{item['display_action']}\n{item['message']}" for item in statements)}
    finally:
        db.close()
