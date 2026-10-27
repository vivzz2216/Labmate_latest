"""Isolated real MySQL runtime and semantic verifier for SQL lab assignments."""

from __future__ import annotations

import copy
from datetime import date, datetime, time as dt_time
from decimal import Decimal
import re
import secrets
import threading
import time
from urllib.parse import unquote, urlparse
import uuid
from typing import Any

import pymysql
import pymysql.cursors

from ..config import settings

MAX_STATEMENTS = 80
MAX_ROWS = 1000
MAX_SCHEMAS = 8

BLOCKED_SQL_RE = re.compile(
    r"\b(?:GRANT|REVOKE|CREATE\s+USER|DROP\s+USER|ALTER\s+USER|RENAME\s+USER|"
    r"SET\s+GLOBAL|SET\s+PERSIST|SHUTDOWN|RESTART|INSTALL\s+PLUGIN|UNINSTALL\s+PLUGIN|"
    r"INSTALL\s+COMPONENT|UNINSTALL\s+COMPONENT|LOAD\s+DATA|LOAD\s+XML|"
    r"INTO\s+OUTFILE|INTO\s+DUMPFILE|LOAD_FILE)\b",
    re.IGNORECASE,
)

SYSTEM_SCHEMA_RE = re.compile(
    r"\b(?:information_schema|performance_schema|mysql|sys)\s*\.",
    re.IGNORECASE,
)


def _json_safe_value(val: Any) -> Any:
    """Convert MySQL driver values (Decimal, date, datetime, bytes) to JSON-serializable primitives."""
    if val is None or isinstance(val, (bool, int, float, str)):
        return val
    if isinstance(val, Decimal):
        if val.as_tuple().exponent == 0:
            return int(val)
        return float(val)
    if isinstance(val, (datetime, date, dt_time)):
        return val.isoformat()
    if isinstance(val, (bytes, bytearray)):
        return val.decode("utf-8", errors="replace")
    return str(val)


def _resolve_mysql_admin_config(
    host: str | None = None,
    port: int | None = None,
    user: str | None = None,
    password: str | None = None,
) -> dict[str, Any]:
    """Resolve MySQL admin connection parameters from settings or explicit overrides."""
    cfg_host = host or settings.MYSQL_HOST or "127.0.0.1"
    cfg_port = int(port if port is not None else (settings.MYSQL_PORT or 3306))
    cfg_user = user or settings.MYSQL_ADMIN_USER or "root"
    cfg_password = password if password is not None else (settings.MYSQL_ADMIN_PASSWORD or "")

    if settings.MYSQL_URL and not any([host, port, user, password]):
        parsed = urlparse(settings.MYSQL_URL)
        if parsed.hostname:
            cfg_host = parsed.hostname
        if parsed.port:
            cfg_port = int(parsed.port)
        if parsed.username:
            cfg_user = unquote(parsed.username)
        if parsed.password is not None:
            cfg_password = unquote(parsed.password)

    return {
        "host": cfg_host,
        "port": cfg_port,
        "user": cfg_user,
        "password": cfg_password,
    }


def split_sql_statements(sql: str) -> list[dict[str, Any]]:
    """
    Split a SQL script into individual statements while tracking 1-based line ranges
    and any immediately preceding comment headers.
    """
    text = str(sql or "").replace("\r\n", "\n").replace("\r", "\n")
    statements: list[dict[str, Any]] = []
    buf: list[str] = []
    quote: str | None = None
    in_line_comment = False
    in_block_comment = False
    line_num = 1
    stmt_start_line: int | None = None
    stmt_last_non_ws_line: int = 1
    pending_comments: list[str] = []
    current_comment_buf: list[str] = []
    comment_start_line: int | None = None
    delimiter = ";"

    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""

        if in_line_comment:
            if ch == "\n":
                in_line_comment = False
                comment_txt = "".join(current_comment_buf).strip()
                if comment_txt:
                    pending_comments.append(comment_txt)
                current_comment_buf = []
                line_num += 1
            else:
                current_comment_buf.append(ch)
            i += 1
            continue

        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                comment_txt = "".join(current_comment_buf).strip()
                if comment_txt:
                    pending_comments.append(comment_txt)
                current_comment_buf = []
                i += 2
                continue
            if ch == "\n":
                line_num += 1
            current_comment_buf.append(ch)
            i += 1
            continue

        if quote:
            buf.append(ch)
            if not ch.isspace():
                stmt_last_non_ws_line = line_num
            if ch == "\n":
                line_num += 1
            elif ch == "\\" and quote in ("'", '"') and i + 1 < n:
                # MySQL backslash escape inside string literal
                i += 1
                buf.append(text[i])
                if text[i] == "\n":
                    line_num += 1
            elif ch == quote:
                if nxt == quote:
                    buf.append(nxt)
                    i += 1
                else:
                    quote = None
            i += 1
            continue

        # Not inside string or comment
        if (i == 0 or text[i - 1] == '\n') and stmt_start_line is None:
            directive = re.match(r'[ \t]*DELIMITER[ \t]+(\S+)[ \t]*(?:\n|$)', text[i:], re.I)
            if directive:
                delimiter = directive.group(1)
                line_num += directive.group(0).count('\n')
                i += len(directive.group(0))
                continue
        if (ch == "-" and nxt == "-") or ch == "#":
            if comment_start_line is None and stmt_start_line is None:
                comment_start_line = line_num
            in_line_comment = True
            i += 2 if ch == "-" else 1
            continue

        if ch == "/" and nxt == "*":
            if comment_start_line is None and stmt_start_line is None:
                comment_start_line = line_num
            in_block_comment = True
            i += 2
            continue

        if ch in ("'", '"', "`"):
            if stmt_start_line is None:
                stmt_start_line = line_num
            quote = ch
            buf.append(ch)
            stmt_last_non_ws_line = line_num
            i += 1
            continue

        if text.startswith(delimiter, i):
            stmt_text = "".join(buf).strip()
            if stmt_text:
                s_line = stmt_start_line or line_num
                e_line = max(s_line, stmt_last_non_ws_line)
                statements.append(
                    {
                        "statement": stmt_text,
                        "start_line": s_line,
                        "end_line": e_line,
                        "comment_start_line": comment_start_line or s_line,
                        "leading_comment": " | ".join(pending_comments).strip(),
                    }
                )
            buf = []
            stmt_start_line = None
            comment_start_line = None
            pending_comments = []
            i += len(delimiter)
            continue

        if ch == "\n":
            if stmt_start_line is not None:
                buf.append(ch)
            line_num += 1
            i += 1
            continue

        if not ch.isspace():
            if stmt_start_line is None:
                stmt_start_line = line_num
            stmt_last_non_ws_line = line_num
            buf.append(ch)
        else:
            if stmt_start_line is not None:
                buf.append(ch)
        i += 1

    tail = "".join(buf).strip()
    if tail:
        s_line = stmt_start_line or line_num
        e_line = max(s_line, stmt_last_non_ws_line)
        statements.append(
            {
                "statement": tail,
                "start_line": s_line,
                "end_line": e_line,
                "comment_start_line": comment_start_line or s_line,
                "leading_comment": " | ".join(pending_comments).strip(),
            }
        )
    return statements


def split_sql(sql: str) -> list[str]:
    """Return plain SQL statements list from a script."""
    return [item["statement"] for item in split_sql_statements(sql)]


def _clean_ident(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_]", "", (name or "").strip().strip("`\"'[]"))[:40]


def _extract_table_name(stmt: str, kind: str) -> str:
    patterns = {
        "SELECT": r"\bFROM\s+[`\"'\[]?([A-Za-z0-9_.]+)[`\"'\]]?",
        "INSERT": r"\bINTO\s+[`\"'\[]?([A-Za-z0-9_.]+)[`\"'\]]?",
        "REPLACE": r"\bINTO\s+[`\"'\[]?([A-Za-z0-9_.]+)[`\"'\]]?",
        "UPDATE": r"\bUPDATE\s+[`\"'\[]?([A-Za-z0-9_.]+)[`\"'\]]?",
        "DELETE": r"\bFROM\s+[`\"'\[]?([A-Za-z0-9_.]+)[`\"'\]]?",
        "CREATE": r"\b(?:TABLE|VIEW|DATABASE|SCHEMA)\s+(?:IF\s+NOT\s+EXISTS\s+)?[`\"'\[]?([A-Za-z0-9_.]+)[`\"'\]]?",
        "ALTER": r"\bTABLE\s+[`\"'\[]?([A-Za-z0-9_.]+)[`\"'\]]?",
        "DROP": r"\b(?:TABLE|VIEW|DATABASE|SCHEMA)\s+(?:IF\s+EXISTS\s+)?[`\"'\[]?([A-Za-z0-9_.]+)[`\"'\]]?",
        "DESCRIBE": r"\b(?:DESCRIBE|DESC)\s+[`\"'\[]?([A-Za-z0-9_.]+)[`\"'\]]?",
    }
    pattern = patterns.get(kind)
    if not pattern:
        return "Result"
    match = re.search(pattern, stmt, re.IGNORECASE)
    if not match:
        return "Result"
    return match.group(1).split(".")[-1].strip("`\"'[]") or "Result"


def _normalize_mysql_statement(stmt: str) -> str:
    """
    Normalize minor standard-SQL idioms into MySQL 8.0 equivalents:
    - Inline column-level `col TYPE REFERENCES parent(id)` -> adds explicit InnoDB `FOREIGN KEY (col) REFERENCES parent(id)`
    - `WITH RECURSIVE ... AS (VALUES(1) UNION ...)` -> `AS (SELECT 1 UNION ...)`
    """
    out = stmt
    if re.match(r"^WITH\s+RECURSIVE\b", out, re.IGNORECASE):
        out = re.sub(
            r"\bAS\s*\(\s*VALUES\s*\(([^()]+)\)\s*UNION\b",
            r"AS (SELECT \1 UNION",
            out,
            flags=re.IGNORECASE,
        )
    if re.match(r"^CREATE\s+TABLE\b", out, re.IGNORECASE) and not re.search(r"\bFOREIGN\s+KEY\b", out, re.IGNORECASE):
        inline_refs = re.findall(
            r"(?:^|[,(])\s*[`\"'\[]?([A-Za-z_][A-Za-z0-9_]*)[`\"'\]]?\s+[A-Za-z0-9_()]+(?:\s+(?:NOT\s+NULL|NULL|UNIQUE|DEFAULT\s+\S+))*\s+REFERENCES\s+([`\"'\[]?[A-Za-z_][A-Za-z0-9_]*[`\"'\]]?\s*\([^()]+\))",
            out,
            flags=re.IGNORECASE,
        )
        if inline_refs and out.endswith(")"):
            fk_clauses = [f"FOREIGN KEY (`{col}`) REFERENCES {ref}" for col, ref in inline_refs]
            out = out[:-1] + ", " + ", ".join(fk_clauses) + ")"
    return out


class SQLSession:
    """
    Isolated MySQL execution session.
    Provisions a private schema (`lab_<id>`) and restricted user (`labu_<id>`) per session,
    enforces query deadlines with a watchdog `KILL QUERY`, and cleans up on close/reset.
    """

    def __init__(
        self,
        timeout: float | None = None,
        max_rows: int | None = None,
        host: str | None = None,
        port: int | None = None,
        admin_user: str | None = None,
        admin_password: str | None = None,
        allow_dcl: bool = False,
    ):
        self.dialect = "mysql"
        self.allow_dcl = allow_dcl
        self.exercise_users = {}
        self.timeout = max(0.02, float(timeout if timeout is not None else (settings.MYSQL_QUERY_TIMEOUT or 5.0)))
        self.max_rows = max(1, min(int(max_rows if max_rows is not None else (settings.MYSQL_MAX_ROWS or MAX_ROWS)), 5000))
        self.max_result_bytes = int(getattr(settings, "MYSQL_MAX_RESULT_BYTES", 1048576) or 1048576)
        self._admin_cfg = _resolve_mysql_admin_config(host=host, port=port, user=admin_user, password=admin_password)

        self.session_token = uuid.uuid4().hex[:12]
        self.physical_schema = f"lab_{self.session_token}"
        self.db_user = f"labu_{self.session_token}"
        self._db_password = secrets.token_urlsafe(24)
        self.active_schema = "lab"
        self.schema_map: dict[str, str] = {"lab": self.physical_schema}
        self.server_version: str = ""
        self.conn: pymysql.connections.Connection | None = None
        self.conn_thread_id: int | None = None
        self._in_transaction: bool = False
        self._tx_created_tables: list[str] = []
        self._closed = False
        self._lock = threading.Lock()

        self._provision_isolated_session()

    def _open_admin_connection(self) -> pymysql.connections.Connection:
        try:
            return pymysql.connect(
                host=self._admin_cfg["host"],
                port=self._admin_cfg["port"],
                user=self._admin_cfg["user"],
                password=self._admin_cfg["password"],
                charset="utf8mb4",
                connect_timeout=max(2, int(self.timeout) + 2),
                read_timeout=max(2, int(self.timeout) + 2),
                write_timeout=max(2, int(self.timeout) + 2),
                autocommit=True,
            )
        except Exception as exc:
            raise RuntimeError(
                f"MySQL runtime is unavailable at {self._admin_cfg['host']}:{self._admin_cfg['port']}: {exc}"
            ) from exc

    def _grant_schema_to_session_user(self, cur, physical_db: str) -> None:
        privs = (
            "SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER, "
            "CREATE VIEW, SHOW VIEW, TRIGGER, REFERENCES, CREATE ROUTINE, ALTER ROUTINE, EXECUTE"
        )
        for host_spec in ("%", "localhost", "127.0.0.1"):
            cur.execute(f"GRANT {privs} ON `{physical_db}`.* TO %s@%s", (self.db_user, host_spec))

    def _provision_isolated_session(self) -> None:
        admin_conn = self._open_admin_connection()
        try:
            with admin_conn.cursor() as cur:
                cur.execute("SELECT VERSION()")
                row = cur.fetchone()
                self.server_version = str(row[0]) if row and row[0] else "8.0"

                cur.execute(
                    f"CREATE DATABASE `{self.physical_schema}` "
                    "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                )
                for host_spec in ("%", "localhost", "127.0.0.1"):
                    cur.execute(
                        "CREATE USER IF NOT EXISTS %s@%s IDENTIFIED BY %s",
                        (self.db_user, host_spec, self._db_password),
                    )
                self._grant_schema_to_session_user(cur, self.physical_schema)
                cur.execute("FLUSH PRIVILEGES")
        except Exception as exc:
            try:
                self._cleanup_server_objects(admin_conn)
            finally:
                admin_conn.close()
            raise RuntimeError(f"Failed to provision isolated MySQL schema: {exc}") from exc
        admin_conn.close()

        self._connect_session_user()

    def _connect_session_user(self) -> None:
        if self.conn is not None:
            try:
                self.conn.close()
            except Exception:
                pass
            self.conn = None

        target_physical = self.schema_map.get(self.active_schema, self.physical_schema)
        sock_timeout = max(1, int(self.timeout) + 2)
        try:
            self.conn = pymysql.connect(
                host=self._admin_cfg["host"],
                port=self._admin_cfg["port"],
                user=self.db_user,
                password=self._db_password,
                database=target_physical,
                charset="utf8mb4",
                connect_timeout=sock_timeout,
                read_timeout=sock_timeout,
                write_timeout=sock_timeout,
                autocommit=True,
                cursorclass=pymysql.cursors.Cursor,
            )
            self.conn_thread_id = self.conn.thread_id()
            with self.conn.cursor() as cur:
                max_exec_ms = max(100, int(self.timeout * 1000))
                try:
                    cur.execute(f"SET SESSION max_execution_time = {max_exec_ms}")
                except Exception:
                    pass
        except Exception as exc:
            raise RuntimeError(f"MySQL restricted session connection failed: {exc}") from exc

    def _ensure_user_connection(self) -> None:
        if self.conn is None or not getattr(self.conn, "open", False):
            self._connect_session_user()
            return
        try:
            self.conn.ping(reconnect=True)
            self.conn_thread_id = self.conn.thread_id()
        except Exception:
            self._connect_session_user()

    def _kill_query_on_timeout(self, thread_id: int | None, timed_out_flag: list[bool]) -> None:
        timed_out_flag[0] = True
        if not thread_id:
            return
        try:
            admin_conn = self._open_admin_connection()
            try:
                with admin_conn.cursor() as cur:
                    try:
                        cur.execute(f"KILL QUERY {int(thread_id)}")
                    except Exception:
                        cur.execute(f"KILL {int(thread_id)}")
            finally:
                admin_conn.close()
        except Exception:
            pass

    def _cleanup_server_objects(self, admin_conn: pymysql.connections.Connection | None = None) -> None:
        own_conn = False
        if admin_conn is None:
            try:
                admin_conn = self._open_admin_connection()
                own_conn = True
            except Exception:
                return
        try:
            with admin_conn.cursor() as cur:
                for actual, _ in list(self.exercise_users.values()):
                    cur.execute('DROP USER IF EXISTS %s@%s', (actual, 'localhost'))
                self.exercise_users.clear()
                for phys_db in list(set(self.schema_map.values())):
                    if phys_db.startswith("lab_"):
                        try:
                            cur.execute(f"DROP DATABASE IF EXISTS `{phys_db}`")
                        except Exception:
                            pass
                if self.db_user.startswith("labu_"):
                    for host_spec in ("%", "localhost", "127.0.0.1"):
                        try:
                            cur.execute("DROP USER IF EXISTS %s@%s", (self.db_user, host_spec))
                        except Exception:
                            pass
        finally:
            if own_conn and admin_conn is not None:
                try:
                    admin_conn.close()
                except Exception:
                    pass

    def reset(self) -> None:
        with self._lock:
            if self.conn is not None:
                try:
                    self.conn.close()
                except Exception:
                    pass
                self.conn = None
            self._cleanup_server_objects()
            self.session_token = uuid.uuid4().hex[:12]
            self.physical_schema = f"lab_{self.session_token}"
            self.db_user = f"labu_{self.session_token}"
            self._db_password = secrets.token_urlsafe(24)
            self.active_schema = "lab"
            self.schema_map = {"lab": self.physical_schema}
            self._closed = False
            self._provision_isolated_session()

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            self._closed = True
            if self.conn is not None:
                try:
                    self.conn.close()
                except Exception:
                    pass
                self.conn = None
            self._cleanup_server_objects()

    def __del__(self):
        try:
            self.close()
        except Exception:
            pass

    def _find_logical_schema(self, name: str) -> str | None:
        clean = _clean_ident(name)
        for key in self.schema_map:
            if key.lower() == clean.lower():
                return key
        return None

    def _create_mapped_schema(self, logical_name: str) -> str:
        existing = self._find_logical_schema(logical_name)
        if existing:
            return existing
        if len(self.schema_map) >= MAX_SCHEMAS:
            raise ValueError(f"Maximum schema limit ({MAX_SCHEMAS}) reached for this session.")
        clean_logical = _clean_ident(logical_name) or f"db_{len(self.schema_map) + 1}"
        phys_name = f"lab_{self.session_token}_{clean_logical.lower()[:24]}"
        admin_conn = self._open_admin_connection()
        try:
            with admin_conn.cursor() as cur:
                cur.execute(
                    f"CREATE DATABASE IF NOT EXISTS `{phys_name}` "
                    "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                )
                self._grant_schema_to_session_user(cur, phys_name)
        finally:
            admin_conn.close()
        self.schema_map[clean_logical] = phys_name
        return clean_logical

    def _drop_mapped_schema(self, logical_name: str) -> None:
        existing = self._find_logical_schema(logical_name)
        if not existing:
            return
        phys_name = self.schema_map[existing]
        admin_conn = self._open_admin_connection()
        try:
            with admin_conn.cursor() as cur:
                cur.execute(f"DROP DATABASE IF EXISTS `{phys_name}`")
        finally:
            admin_conn.close()
        if existing != "lab":
            self.schema_map.pop(existing, None)
            if self.active_schema == existing:
                self.active_schema = "lab"
        else:
            # Recreate empty default 'lab' schema
            admin_conn = self._open_admin_connection()
            try:
                with admin_conn.cursor() as cur:
                    cur.execute(
                        f"CREATE DATABASE `{phys_name}` "
                        "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                    )
                    self._grant_schema_to_session_user(cur, phys_name)
            finally:
                admin_conn.close()
        self._connect_session_user()

    def _schemas(self) -> dict[str, Any]:
        """Inspect actual MySQL tables, views, columns, and sample rows across session schemas."""
        out: dict[str, Any] = {}
        self._ensure_user_connection()
        assert self.conn is not None

        for logical_schema, phys_schema in self.schema_map.items():
            tables_meta: dict[str, Any] = {}
            views_meta: dict[str, Any] = {}
            try:
                with self.conn.cursor() as cur:
                    cur.execute(f"SHOW FULL TABLES FROM `{phys_schema}`")
                    entries = cur.fetchall()
                    for entry in entries:
                        obj_name = str(entry[0])
                        obj_type = str(entry[1]).upper() if len(entry) > 1 else "BASE TABLE"
                        cur.execute(f"SHOW COLUMNS FROM `{phys_schema}`.`{obj_name}`")
                        col_rows = cur.fetchall()
                        cols = [
                            {
                                "name": str(c[0]),
                                "type": str(c[1]).upper(),
                                "notNull": str(c[2]).upper() == "NO",
                                "isPk": str(c[3]).upper() == "PRI",
                            }
                            for c in col_rows
                        ]
                        cur.execute(f"SELECT * FROM `{phys_schema}`.`{obj_name}` LIMIT 100")
                        desc = [d[0] for d in (cur.description or [])]
                        sample_rows = [
                            {desc[idx]: _json_safe_value(val) for idx, val in enumerate(r)}
                            for r in cur.fetchall()
                        ]
                        obj_info = {
                            "name": obj_name,
                            "type": "VIEW" if "VIEW" in obj_type else "TABLE",
                            "columns": cols,
                            "rows": sample_rows,
                        }
                        if "VIEW" in obj_type:
                            views_meta[obj_name] = obj_info
                        else:
                            tables_meta[obj_name] = obj_info
            except Exception:
                pass
            out[logical_schema] = {
                "name": logical_schema,
                "physicalName": phys_schema,
                "tables": tables_meta,
                "views": views_meta,
            }
        return out

    def _failure(self, message: str, started: float, kind: str = "ERROR", stmt: str = "") -> dict[str, Any]:
        duration_sec = max(0.0, time.perf_counter() - started)
        try:
            schemas = self._schemas()
        except Exception:
            schemas = {}
        return {
            "success": False,
            "dialect": "mysql",
            "engine": f"MySQL {self.server_version}",
            "server_version": self.server_version,
            "isolatedSchema": self.physical_schema,
            "dbUser": self.db_user,
            "type": kind,
            "statement": stmt,
            "error": message,
            "message": f"Error: {message}",
            "duration": f"{duration_sec:.3f} sec",
            "durationMs": round(duration_sec * 1000, 2),
            "rowcount": 0,
            "columns": [],
            "rows": [],
            "schemas": schemas,
            "activeSchema": self.active_schema,
        }

    def execute(self, statement: str) -> dict[str, Any]:
        """Execute one SQL statement or multi-statement script against the isolated MySQL session."""
        statements = split_sql_statements(statement)
        if not statements:
            return self._failure("SQL statement is empty.", time.perf_counter())
        if len(statements) > MAX_STATEMENTS:
            return self._failure(f"Too many SQL statements (limit {MAX_STATEMENTS}).", time.perf_counter())

        last: dict[str, Any] | None = None
        for item in statements:
            last = self._execute_one(item["statement"])
            if not last["success"]:
                return last
        assert last is not None
        return last

    def _execute_one(self, stmt: str) -> dict[str, Any]:
        started = time.perf_counter()
        cleaned = stmt.strip().rstrip(";").strip()
        if not cleaned:
            return self._failure("SQL statement is empty.", started)

        from .sql_accounts import execute_dcl
        dcl_result = execute_dcl(self, cleaned, started)
        if dcl_result is not None:
            return dcl_result

        if BLOCKED_SQL_RE.search(cleaned):
            return self._failure("Administrative or file-access SQL statements are not permitted in the lab sandbox.", started, stmt=cleaned)

        if SYSTEM_SCHEMA_RE.search(cleaned):
            return self._failure("Access to MySQL system schemas is not permitted in the isolated lab runtime.", started, stmt=cleaned)

        words = cleaned.split()
        kind = words[0].upper() if words else "SQL"

        try:
            # Handle logical CREATE DATABASE / USE / DROP DATABASE transparently inside isolated schemas
            create_db_match = re.match(
                r"^CREATE\s+(?:DATABASE|SCHEMA)\s+(?:IF\s+NOT\s+EXISTS\s+)?[`\"'\[]?([A-Za-z0-9_]+)[`\"'\]]?\s*$",
                cleaned,
                re.IGNORECASE,
            )
            if create_db_match:
                logical_db = self._create_mapped_schema(create_db_match.group(1))
                return self._ok(
                    kind="CREATE",
                    table=logical_db,
                    columns=[],
                    rows=[],
                    rowcount=1,
                    message="1 row(s) affected",
                    started=started,
                    stmt=cleaned,
                )

            use_db_match = re.match(
                r"^USE\s+[`\"'\[]?([A-Za-z0-9_]+)[`\"'\]]?\s*$",
                cleaned,
                re.IGNORECASE,
            )
            if use_db_match:
                requested_db = use_db_match.group(1)
                logical_db = self._find_logical_schema(requested_db)
                if not logical_db:
                    return self._failure(
                        f"Access denied or unknown database '{requested_db}' in isolated session.",
                        started,
                        kind="USE",
                        stmt=cleaned,
                    )
                self.active_schema = logical_db
                self._ensure_user_connection()
                assert self.conn is not None
                with self.conn.cursor() as cur:
                    cur.execute(f"USE `{self.schema_map[logical_db]}`")
                return self._ok(
                    kind="USE",
                    table=logical_db,
                    columns=[],
                    rows=[],
                    rowcount=0,
                    message="0 row(s) affected",
                    started=started,
                    stmt=cleaned,
                )

            drop_db_match = re.match(
                r"^DROP\s+(?:DATABASE|SCHEMA)\s+(?:IF\s+EXISTS\s+)?[`\"'\[]?([A-Za-z0-9_]+)[`\"'\]]?\s*$",
                cleaned,
                re.IGNORECASE,
            )
            if drop_db_match:
                target_db = drop_db_match.group(1)
                self._drop_mapped_schema(target_db)
                return self._ok(
                    kind="DROP",
                    table=target_db,
                    columns=[],
                    rows=[],
                    rowcount=0,
                    message="0 row(s) affected",
                    started=started,
                    stmt=cleaned,
                )

            if re.match(r"^SHOW\s+(?:DATABASES|SCHEMAS)\b", cleaned, re.IGNORECASE):
                rows = [{"Database": name} for name in self.schema_map.keys()]
                return self._ok(
                    kind="SELECT",
                    table="SCHEMAS",
                    columns=["Database"],
                    rows=rows,
                    rowcount=len(rows),
                    message=f"{len(rows)} row(s) returned",
                    started=started,
                    stmt=cleaned,
                )

            if re.search(r'\bDEFINER\b', cleaned[:200], re.I) and re.search(r'\b(PROCEDURE|FUNCTION|TRIGGER|VIEW|EVENT)\b', cleaned[:200], re.I):
                raise ValueError('Explicit DEFINER is prohibited; routines use the private exercise account.')

            metadata = re.fullmatch(r'SHOW\s+CREATE\s+(PROCEDURE|FUNCTION)\s+`?([A-Za-z_][A-Za-z0-9_]*)`?', cleaned, re.I)
            if metadata:
                # Restricted connections may receive NULL definitions under
                # MySQL's metadata visibility rules. Read only our own object.
                admin = self._open_admin_connection()
                try:
                    physical = self.schema_map[self.active_schema]
                    with admin.cursor() as cur:
                        cur.execute(f'SHOW CREATE {metadata.group(1)} `{physical}`.`{metadata.group(2)}`')
                        columns = [d[0] for d in cur.description]
                        rows = [{key:_json_safe_value(value) for key,value in zip(columns,row)} for row in cur.fetchall()]
                    return self._ok(kind='SELECT',table=metadata.group(2),columns=columns,rows=rows,rowcount=len(rows),message='Private routine definition returned.',started=started,stmt=cleaned)
                finally:admin.close()

            routine = re.match(r'^CREATE\s+(?:OR\s+REPLACE\s+)?(PROCEDURE|FUNCTION|TRIGGER)\s+((?:`?[A-Za-z_][A-Za-z0-9_]*`?\s*\.\s*)?`?[A-Za-z_][A-Za-z0-9_]*`?)(?=[\s(]|$)', cleaned, re.I)
            if routine:
                # Binary-logged MySQL requires privileged creation even for a
                # deterministic function/trigger. Create only in our private
                # schema and force its runtime DEFINER to the restricted user.
                name = routine.group(2).replace('`', '').strip()
                if '.' in name:
                    logical, name = [part.strip() for part in name.split('.', 1)]
                    if self._find_logical_schema(logical) != self.active_schema:
                        raise ValueError('Routine objects must belong to the active private schema.')
                remainder = cleaned[routine.end():]
                if routine.group(1).upper() == 'TRIGGER':
                    target = re.search(r'\bON\s+((?:`?[A-Za-z0-9_]+`?\s*\.\s*)?`?[A-Za-z0-9_]+`?)(?=[\s;]|$)', remainder, re.I)
                    if not target:
                        raise ValueError('Trigger target table not found.')
                    raw_target = target.group(1).replace('`', '').strip()
                    if '.' in raw_target:
                        target_schema, target_table = [part.strip() for part in raw_target.split('.', 1)]
                        if self._find_logical_schema(target_schema) != self.active_schema:
                            raise ValueError('Trigger target must be an unqualified table in the private schema.')
                        remainder = remainder[:target.start(1)] + f"`{target_table}`" + remainder[target.end(1):]
                definition = (f"CREATE DEFINER=`{self.db_user}`@`localhost` " + routine.group(1) +
                              ' `' + name + '`' + remainder)
                admin = self._open_admin_connection()
                flag = [False]
                watchdog = threading.Timer(self.timeout, self._kill_query_on_timeout, args=(admin.thread_id(), flag))
                try:
                    admin.select_db(self.schema_map[self.active_schema])
                    watchdog.start()
                    with admin.cursor() as cur:
                        cur.execute(definition)
                finally:
                    watchdog.cancel()
                    admin.close()
                return self._ok(kind='CREATE', table=name, columns=[], rows=[], rowcount=0,
                                message='Created in private schema with restricted execution definer.', started=started, stmt=cleaned)

            self._ensure_user_connection()
            assert self.conn is not None

            is_begin = bool(re.match(r"^(?:BEGIN(?:\s+WORK)?|START\s+TRANSACTION)\s*$", cleaned, re.IGNORECASE))
            is_commit = bool(re.match(r"^COMMIT(?:\s+WORK)?\s*$", cleaned, re.IGNORECASE))
            is_rollback = bool(re.match(r"^ROLLBACK(?:\s+WORK)?\s*$", cleaned, re.IGNORECASE))
            exec_sql = _normalize_mysql_statement(cleaned)

            timed_out = [False]
            timer = threading.Timer(self.timeout, self._kill_query_on_timeout, args=(self.conn_thread_id, timed_out))
            timer.daemon = True
            timer.start()
            try:
                with self.conn.cursor() as cur:
                    cur.execute(exec_sql)
                    if is_begin:
                        self._in_transaction = True
                    elif is_commit or is_rollback:
                        self._in_transaction = False

                    if timed_out[0] or (time.perf_counter() - started) >= self.timeout:
                        raise TimeoutError(f"Query execution was interrupted (timeout exceeded: {self.timeout:.2f}s limit).")
                    if cur.description:
                        cols = [str(col[0]) for col in cur.description]
                        fetched = cur.fetchmany(self.max_rows + 1)
                        truncated = len(fetched) > self.max_rows
                        raw_rows = fetched[: self.max_rows]
                        rows: list[dict[str, Any]] = []
                        total_bytes = 0
                        for r in raw_rows:
                            row_dict = {cols[idx]: _json_safe_value(val) for idx, val in enumerate(r)}
                            total_bytes += sum(len(str(v)) for v in row_dict.values())
                            if total_bytes > self.max_result_bytes:
                                truncated = True
                                break
                            rows.append(row_dict)
                        msg = f"{len(rows)} row(s) returned" + (" (truncated)" if truncated else "")
                        result_sets = [{'columns': cols[:], 'rows': rows[:]}]
                        while cur.nextset():
                            if not cur.description:continue
                            if len(result_sets) >= 20:raise ValueError('Procedure returned more than 20 result sets.')
                            extra_cols = [str(c[0]) for c in cur.description]
                            remaining = max(0, self.max_rows - sum(len(s['rows']) for s in result_sets))
                            extra_raw = cur.fetchmany(remaining + 1)
                            truncated = truncated or len(extra_raw) > remaining
                            extra_rows = []
                            for values in extra_raw[:remaining]:
                                row = {key:_json_safe_value(value) for key,value in zip(extra_cols,values)}
                                total_bytes += sum(len(str(v)) for v in row.values())
                                if total_bytes > self.max_result_bytes:truncated = True;break
                                extra_rows.append(row)
                            result_sets.append({'columns':extra_cols,'rows':extra_rows})
                        if len(result_sets)>1:
                            if all(s['columns']==cols for s in result_sets):
                                rows = [r for s in result_sets for r in s['rows']]
                            else:
                                cols = ['Result set'] + list(dict.fromkeys(c for s in result_sets for c in s['columns']))
                                rows = [{'Result set':i, **{c:r.get(c,'—') for c in cols[1:]}} for i,s in enumerate(result_sets,1) for r in s['rows']]
                            msg = f'{len(rows)} row(s) from {len(result_sets)} procedure result sets'
                        result = self._ok(
                            kind="SELECT",
                            table=_extract_table_name(cleaned, kind),
                            columns=cols,
                            rows=rows,
                            rowcount=len(rows),
                            message=msg,
                            started=started,
                            stmt=cleaned,
                            truncated=truncated,
                        )
                        result['result_sets'] = result_sets
                        result['result_set_count'] = len(result_sets)
                        return result
                    affected = cur.rowcount if cur.rowcount is not None and cur.rowcount >= 0 else 0
                    return self._ok(
                        kind=kind,
                        table=_extract_table_name(cleaned, kind),
                        columns=[],
                        rows=[],
                        rowcount=affected,
                        message=f"{affected} row(s) affected",
                        started=started,
                        stmt=cleaned,
                    )
            finally:
                timer.cancel()
        except Exception as exc:
            if timed_out[0] if "timed_out" in locals() else False:
                self._connect_session_user()
                return self._failure(
                    f"Query execution was interrupted (timeout exceeded: {self.timeout:.2f}s limit).",
                    started,
                    kind=kind,
                    stmt=cleaned,
                )
            err_str = str(exc)
            # MySQL error 1317 = Query execution was interrupted, 3024 = max_execution_time exceeded, 3636 = recursion depth
            if (
                "1317" in err_str
                or "3024" in err_str
                or "3636" in err_str
                or "timed out" in err_str.lower()
                or "interrupted" in err_str.lower()
                or "max_recursion_depth" in err_str.lower()
            ):
                self._connect_session_user()
                return self._failure(
                    f"Query execution was interrupted ({self.timeout:.2f}s limit): {err_str}",
                    started,
                    kind=kind,
                    stmt=cleaned,
                )
            return self._failure(err_str, started, kind=kind, stmt=cleaned)

    def _ok(
        self,
        kind: str,
        table: str,
        columns: list[str],
        rows: list[dict[str, Any]],
        rowcount: int,
        message: str,
        started: float,
        stmt: str = "",
        truncated: bool = False,
    ) -> dict[str, Any]:
        duration_sec = max(0.0, time.perf_counter() - started)
        schemas_snap = self._schemas()
        return {
            "success": True,
            "dialect": "mysql",
            "engine": f"MySQL {self.server_version}",
            "server_version": self.server_version,
            "isolatedSchema": self.physical_schema,
            "dbUser": self.db_user,
            "type": kind,
            "statement": stmt,
            "tableName": table,
            "schemaName": self.active_schema,
            "columns": columns,
            "rows": rows,
            "rowcount": rowcount,
            "truncated": truncated,
            "message": message,
            "duration": f"{duration_sec:.3f} sec",
            "durationMs": round(duration_sec * 1000, 2),
            "schemas": schemas_snap,
            "activeSchema": self.active_schema,
        }

    def execute_script(self, sql: str) -> dict[str, Any]:
        """
        Execute a multi-statement SQL script once in order and record a complete
        per-statement receipt (including schema snapshots before later cleanup/DROP VIEW).
        """
        started = time.perf_counter()
        parsed_statements = split_sql_statements(sql)
        if not parsed_statements:
            return {
                "success": False,
                "dialect": "mysql",
                "engine": f"MySQL {self.server_version}",
                "server_version": self.server_version,
                "isolated_schema": self.physical_schema,
                "db_user": self.db_user,
                "error": "No SQL statements found to execute.",
                "statements": [],
                "select_results": [],
                "stdout": "",
                "stderr": "No SQL statements found to execute.",
                "execution_time": 0.0,
            }
        if len(parsed_statements) > MAX_STATEMENTS:
            err = f"Too many SQL statements ({len(parsed_statements)} > limit {MAX_STATEMENTS})."
            return {
                "success": False,
                "dialect": "mysql",
                "engine": f"MySQL {self.server_version}",
                "server_version": self.server_version,
                "isolated_schema": self.physical_schema,
                "db_user": self.db_user,
                "error": err,
                "statements": [],
                "select_results": [],
                "stdout": "",
                "stderr": err,
                "execution_time": 0.0,
            }

        statement_receipts: list[dict[str, Any]] = []
        select_results: list[dict[str, Any]] = []
        stdout_lines: list[str] = [
            f"-- Runtime: MySQL {self.server_version} (Isolated schema: {self.physical_schema})"
        ]
        tab_counts: dict[str, int] = {}
        overall_success = True
        error_msg = ""

        for idx, meta in enumerate(parsed_statements, start=1):
            stmt_text = meta["statement"]
            res = self._execute_one(stmt_text)
            is_ok = bool(res.get("success"))
            is_select = is_ok and res.get("type") == "SELECT" and bool(res.get("columns"))
            display_action = (
                f"{stmt_text} LIMIT 0, 1000"
                if is_select and not re.search(r"\bLIMIT\b", stmt_text, re.IGNORECASE)
                else stmt_text
            )
            tab_title = None
            if is_select:
                t_name = res.get("tableName") or "Result"
                tab_counts[t_name] = tab_counts.get(t_name, 0) + 1
                tab_title = f"{t_name} {tab_counts[t_name]}"

            receipt = {
                "index": idx,
                "statement": stmt_text,
                "display_action": display_action,
                "leading_comment": meta.get("leading_comment", ""),
                "start_line": meta["start_line"],
                "end_line": meta["end_line"],
                "comment_start_line": meta.get("comment_start_line", meta["start_line"]),
                "type": res.get("type", "SQL"),
                "tableName": res.get("tableName", "Result"),
                "tab_title": tab_title,
                "schemaName": res.get("schemaName", self.active_schema),
                "success": is_ok,
                "message": res.get("message", ""),
                "error": res.get("error"),
                "duration": res.get("duration", "0.001 sec"),
                "durationMs": res.get("durationMs", 1.0),
                "rowcount": res.get("rowcount", 0),
                "columns": res.get("columns", []),
                "rows": res.get("rows", []),
                "result_sets": res.get("result_sets", []),
                "result_set_count": res.get("result_set_count", 1),
                "truncated": res.get("truncated", False),
                "schemas_snapshot": copy.deepcopy(res.get("schemas", {})),
                "active_schema": res.get("activeSchema", self.active_schema),
            }
            statement_receipts.append(receipt)

            if is_select:
                select_results.append(receipt)
                header = " | ".join(receipt["columns"])
                stdout_lines.append(f"\n-- Query {len(select_results)}: {stmt_text}")
                stdout_lines.append(header)
                stdout_lines.append("-" * max(len(header), 12))
                for r in receipt["rows"][:25]:
                    stdout_lines.append(
                        " | ".join("NULL" if r.get(c) is None else str(r.get(c)) for c in receipt["columns"])
                    )
                stdout_lines.append(f"({len(receipt['rows'])} row(s) returned)")
            elif is_ok:
                stdout_lines.append(f"-- [{idx}] {stmt_text} -> {receipt['message']}")
            else:
                overall_success = False
                error_msg = res.get("error") or res.get("message") or "SQL execution error"
                stdout_lines.append(f"-- [{idx}] ERROR in `{stmt_text}`: {error_msg}")
                break

        total_time = round(max(0.0, time.perf_counter() - started), 3)
        final_schemas = statement_receipts[-1]["schemas_snapshot"] if statement_receipts else {}
        return {
            "success": overall_success and len(statement_receipts) > 0,
            "dialect": "mysql",
            "engine": f"MySQL {self.server_version}",
            "server_version": self.server_version,
            "isolated_schema": self.physical_schema,
            "db_user": self.db_user,
            "active_schema": self.active_schema,
            "statements": statement_receipts,
            "select_results": select_results,
            "schemas": final_schemas,
            "stdout": "\n".join(stdout_lines).strip(),
            "stderr": error_msg,
            "error": error_msg or None,
            "execution_time": total_time,
        }


def execute_sql(sql: str, timeout: float | None = None) -> dict[str, Any]:
    """Execute a SQL script once in a fresh isolated MySQL session and clean up."""
    session: SQLSession | None = None
    try:
        session = SQLSession(timeout=timeout)
        return session.execute_script(sql)
    except Exception as exc:
        return {
            "success": False,
            "dialect": "mysql",
            "engine": "MySQL (unavailable)",
            "server_version": "",
            "isolated_schema": "",
            "db_user": "",
            "active_schema": "lab",
            "statements": [],
            "select_results": [],
            "schemas": {},
            "stdout": "",
            "stderr": str(exc),
            "error": str(exc),
            "execution_time": 0.0,
        }
    finally:
        if session is not None:
            session.close()


def verify_sql_exercise(objective: str, code: str, execution_result: dict[str, Any]) -> dict[str, Any]:
    """
    Independently verify SQL execution receipts, join semantics (matched rows, unmatched
    customers, unmatched employees in RIGHT JOIN, FULL OUTER JOIN equivalent multiplicities),
    and view creation/querying against the exercise requirements.
    """
    checks: list[dict[str, Any]] = []
    failures: list[str] = []

    def add_check(name: str, passed: bool, detail: str) -> None:
        checks.append({"name": name, "passed": bool(passed), "detail": detail})
        if not passed:
            failures.append(f"{name}: {detail}")

    dialect = execution_result.get("dialect")
    server_version = execution_result.get("server_version") or ""
    add_check(
        "MySQL engine verification",
        dialect == "mysql" and bool(server_version),
        f"Executed on MySQL {server_version}" if (dialect == "mysql" and server_version) else "Real MySQL execution receipt is missing.",
    )

    exec_ok = bool(execution_result.get("success"))
    add_check(
        "SQL script execution",
        exec_ok,
        "All SQL statements executed without errors." if exec_ok else (execution_result.get("error") or execution_result.get("stderr") or "SQL execution failed."),
    )

    statements: list[dict[str, Any]] = execution_result.get("statements") or []
    select_results: list[dict[str, Any]] = execution_result.get("select_results") or []
    from .sql_result_checks import independent_checks
    for check in independent_checks(statements):
        add_check(check['name'], check['passed'], check['detail'])
    add_check('Complete query output', not any(s.get('truncated') for s in statements),
              'All result rows fit the execution limits.' if not any(s.get('truncated') for s in statements) else 'A query output exceeded the capture limits. Reduce sample size before claiming complete evidence.')
    if re.search(r'\btriggers?\b', objective, re.I) and not re.search(r'\bviews?\b', objective, re.I):
        extra_views = [s for s in statements if re.match(r'^CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\b', s.get('statement',''), re.I)]
        add_check('Trigger experiment scope', not extra_views,
                  'No unrelated view was added.' if not extra_views else 'Remove the unrelated view definition and its SELECT queries. This exercise requires triggers, not a view demonstration.')
    if statements and re.match(r'^DROP\s+DATABASE\b', statements[-1].get('statement',''), re.I):
        add_check('Inspectable demo script', False, 'Remove the final DROP DATABASE and final cleanup-only DROP TABLE statements. The private runtime cleans up after capturing evidence; the submitted script should leave the demo available for inspection.')
    add_check(
        "Query result evidence",
        len(select_results) > 0,
        f"{len(select_results)} SELECT query result set(s) captured." if select_results else "No SELECT query results were produced.",
    )

    combined_context = f"{objective or ''}\n{code or ''}"
    wants_joins = bool(re.search(r"\bJOIN\b", combined_context, re.IGNORECASE))
    wants_all_joins = bool(
        re.search(r"\bINNER\s+JOIN\b", combined_context, re.IGNORECASE)
        and re.search(r"\bLEFT\s+(?:OUTER\s+)?JOIN\b", combined_context, re.IGNORECASE)
        and re.search(r"\bRIGHT\s+(?:OUTER\s+)?JOIN\b", combined_context, re.IGNORECASE)
    )
    wants_full_join = bool(re.search(r"\bFULL\s+(?:OUTER\s+)?JOIN\b", combined_context, re.IGNORECASE))
    wants_views = bool(re.search(r"\bCREATE\s+(?:OR\s+REPLACE\s+)?VIEW\b|\bVIEWS?\b", combined_context, re.IGNORECASE))
    wants_8_to_10_rows = bool(re.search(r"8\s*(?:to|-)\s*10\s+records", combined_context, re.IGNORECASE))

    # Check minimum row counts if manual specifies 8 to 10 records per table
    if wants_8_to_10_rows and statements:
        final_schemas = execution_result.get("schemas") or {}
        active_db = final_schemas.get(execution_result.get("active_schema", "lab")) or next(iter(final_schemas.values()), {})
        tables_dict = (active_db or {}).get("tables") or {}
        for expected_tbl in ("Customers", "Employees", "Orders"):
            matched_tbl = next((v for k, v in tables_dict.items() if k.lower() == expected_tbl.lower()), None)
            if matched_tbl is not None:
                row_cnt = len(matched_tbl.get("rows") or [])
                add_check(
                    f"Table '{expected_tbl}' population (>= 8 rows)",
                    row_cnt >= 8,
                    f"{expected_tbl} has {row_cnt} row(s).",
                )

    if wants_joins or wants_all_joins:
        # 1. INNER JOIN check
        inner_selects = [
            s for s in select_results
            if re.search(r"\bINNER\s+JOIN\b", s["statement"], re.IGNORECASE)
            and not re.search(r"\bUNION\b", s["statement"], re.IGNORECASE)
        ]
        if inner_selects:
            s_inner = inner_selects[0]
            rows = s_inner.get("rows") or []
            has_rows = len(rows) > 0
            no_null_keys = has_rows and all(
                all(v is not None for v in r.values()) for r in rows
            )
            add_check(
                "INNER JOIN matched records",
                has_rows and no_null_keys,
                f"Returned {len(rows)} matched row(s) with non-NULL columns.",
            )
        elif wants_all_joins:
            add_check("INNER JOIN matched records", False, "No standalone INNER JOIN SELECT query was executed.")

        # 2. LEFT OUTER JOIN check
        left_selects = [
            s for s in select_results
            if re.search(r"\bLEFT\s+(?:OUTER\s+)?JOIN\b", s["statement"], re.IGNORECASE)
            and not re.search(r"\bUNION\b", s["statement"], re.IGNORECASE)
        ]
        if left_selects:
            s_left = left_selects[0]
            rows = s_left.get("rows") or []
            has_unmatched_left = any(
                any(v is None for v in r.values()) for r in rows
            )
            add_check(
                "LEFT JOIN preserves unmatched left records",
                len(rows) > 0 and has_unmatched_left,
                f"Returned {len(rows)} row(s); includes unmatched left-table rows with NULL right columns."
                if (len(rows) > 0 and has_unmatched_left)
                else "LEFT JOIN did not demonstrate any unmatched left-table rows (NULL right columns).",
            )
        elif wants_all_joins:
            add_check("LEFT JOIN preserves unmatched left records", False, "No standalone LEFT JOIN SELECT query was executed.")

        # 3. RIGHT OUTER JOIN check
        right_selects = [
            s for s in select_results
            if re.search(r"\bRIGHT\s+(?:OUTER\s+)?JOIN\b", s["statement"], re.IGNORECASE)
            and not re.search(r"\bUNION\b", s["statement"], re.IGNORECASE)
        ]
        if right_selects:
            s_right = right_selects[0]
            stmt_txt = s_right["statement"]
            rows = s_right.get("rows") or []
            filters_out_nulls = bool(
                re.search(r"\bWHERE\b.*\bOrderID\s+IS\s+NOT\s+NULL\b", stmt_txt, re.IGNORECASE | re.DOTALL)
            )
            has_unmatched_right = any(
                any(v is None for v in r.values()) for r in rows
            )
            # Also check if Employees table exists in snapshot, all employees are preserved
            snap = s_right.get("schemas_snapshot") or {}
            active_db = snap.get(s_right.get("active_schema", "lab")) or next(iter(snap.values()), {})
            emp_tbl = next(
                (v for k, v in ((active_db or {}).get("tables") or {}).items() if k.lower() == "employees"),
                None,
            )
            emp_count = len(emp_tbl.get("rows") or []) if emp_tbl else 0
            preserves_all_emp = len(rows) >= emp_count if emp_count > 0 else len(rows) > 0

            right_ok = (
                len(rows) > 0
                and not filters_out_nulls
                and has_unmatched_right
                and preserves_all_emp
            )
            add_check(
                "RIGHT JOIN preserves all right-table (Employees) records including unmatched",
                right_ok,
                f"Native RIGHT JOIN returned {len(rows)} row(s), preserving all {emp_count or len(rows)} employees including unmatched rows (OrderID IS NULL)."
                if right_ok
                else (
                    "RIGHT JOIN test data/coverage is incomplete. Keep the RIGHT JOIN; seed 10 employees and make orders reference ONLY employees 1 through 8, so employees 9 and 10 have no orders. Do not filter NULL OrderID."
                ),
            )
        elif wants_all_joins:
            add_check(
                "RIGHT JOIN preserves all right-table (Employees) records including unmatched",
                False,
                "No standalone native RIGHT JOIN query was executed.",
            )

        # 4. FULL OUTER JOIN equivalent check
        union_selects = [
            s for s in select_results
            if re.search(r"\bLEFT\s+(?:OUTER\s+)?JOIN\b", s["statement"], re.IGNORECASE)
            and re.search(r"\bUNION\s+ALL\b", s["statement"], re.IGNORECASE)
            and re.search(r"\bRIGHT\s+(?:OUTER\s+)?JOIN\b", s["statement"], re.IGNORECASE)
        ]
        if union_selects:
            s_full = union_selects[0]
            rows = s_full.get("rows") or []
            has_nulls = any(any(v is None for v in r.values()) for r in rows)
            add_check(
                "MySQL FULL OUTER JOIN equivalent (LEFT JOIN UNION ALL RIGHT JOIN)",
                len(rows) > 0 and has_nulls,
                f"Returned {len(rows)} row(s) preserving unmatched rows and duplicate-row semantics via UNION ALL.",
            )
        elif wants_full_join:
            add_check(
                "MySQL FULL OUTER JOIN equivalent (LEFT JOIN UNION ALL RIGHT JOIN)",
                False,
                "Missing MySQL FULL OUTER JOIN equivalent using LEFT JOIN ... UNION ALL ... RIGHT JOIN ... WHERE ... IS NULL.",
            )

    # 5. Views verification
    if wants_views:
        created_views: list[str] = []
        for s in statements:
            m = re.match(
                r"^CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+[`\"'\[]?([A-Za-z0-9_ ]+)[`\"'\]]?\s+AS\b",
                s["statement"],
                re.IGNORECASE,
            )
            if m and s.get("success"):
                created_views.append(m.group(1).strip())

        add_check(
            "View creation (CREATE VIEW)",
            len(created_views) > 0,
            f"Created view(s): {', '.join(created_views)}" if created_views else "No views were created.",
        )

        for v_name in created_views:
            v_queries = [
                s for s in select_results
                if re.search(rf"\bFROM\s+[`\"'\[]?{re.escape(v_name)}[`\"'\]]?\b", s["statement"], re.IGNORECASE)
            ]
            has_non_empty = any(len(q.get("rows") or []) > 0 for q in v_queries)
            add_check(
                f"View '{v_name}' queried with non-empty results",
                bool(v_queries) and has_non_empty,
                f"View '{v_name}' queried in {len(v_queries)} SELECT statement(s) and returned rows."
                if (v_queries and has_non_empty)
                else f"View '{v_name}' was never queried or returned 0 rows.",
            )
            if v_name.lower() == "product_data" and v_queries:
                for q in v_queries:
                    for r in q.get("rows") or []:
                        if all(k in r for k in ("qty", "price", "value")):
                            if r["qty"] is not None and r["price"] is not None:
                                if r["value"] != r["qty"] * r["price"]:
                                    add_check(
                                        "product_data computed column (qty * price AS value)",
                                        False,
                                        f"Expected {r['qty'] * r['price']}, got {r['value']}",
                                    )

    verified = len(failures) == 0 and exec_ok and len(select_results) > 0
    engine_label = execution_result.get("engine") or f"MySQL {server_version}".strip()
    summary = (
        f"Verified against real {engine_label} ({len(statements)} statements, {len(select_results)} result sets)."
        if verified
        else f"SQL verification failed on {engine_label}: {'; '.join(failures)}"
    )
    return {
        "kind": "database",
        "verified": verified,
        "dialect": "mysql",
        "engine": engine_label,
        "server_version": server_version,
        "isolated_schema": execution_result.get("isolated_schema", ""),
        "statement_count": len(statements),
        "select_count": len(select_results),
        "checks": checks,
        "failures": failures,
        "summary": summary,
    }
