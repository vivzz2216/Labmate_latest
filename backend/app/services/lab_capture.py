"""Real MySQL and notebook execution with step-by-step Workbench/Colab evidence capture."""

from __future__ import annotations

import asyncio
import json
import math
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from ..config import settings
from .browser_capture import CaptureBrowserUnavailable, acquire_capture_context, launch_capture_browser
from .lab_resources import allowed_resource, resource_file
from .notebook_magics import neutralize_magics
from .notebook_runtime import ColabPythonKernel
from .sql_runtime import SQLSession, verify_sql_exercise

CODE_LINES_PER_PAGE = 18
RESULT_ROWS_PER_PAGE = 12
RESULT_EDITOR_WINDOW_LINES = 10


def format_mysql_cli_rows(columns, rows):
    def display(value):
        return "NULL" if value is None else str(value).replace("\r", "\\r").replace("\n", "\\n").replace("\t", "\\t")

    records = [[display(column) for column in columns]]
    records.extend([display(row.get(column) if isinstance(row, dict) else row[i])
                    for i, column in enumerate(columns)] for row in rows)
    widths = [max(map(len, cells)) for cells in zip(*records)]
    border = "+" + "+".join("-" * (width + 2) for width in widths) + "+"

    def line(cells):
        return "| " + " | ".join(cell.ljust(width) for cell, width in zip(cells, widths)) + " |"

    return "\n".join([border, line(records[0]), border, *(line(row) for row in records[1:]), border])


async def capture_sql_frame(page, path):
    height = int(await page.evaluate('''() => {
        const pane = document.getElementById('result-pane');
        const container = document.querySelector('.rg-table-container');
        const table = document.querySelector('.rg-table');
        let height = Number(document.body.dataset.captureHeight) || 900;
        if (table && container && getComputedStyle(pane).display !== 'none') {
            const previous = pane.getBoundingClientRect().height;
            const chrome = previous - container.clientHeight;
            const required = Math.ceil(table.getBoundingClientRect().height + chrome + 3);
            pane.style.height = `${required}px`;
            pane.style.flex = `0 0 ${required}px`;
            height += required - previous;
        }
        return Math.max(420, height);
    }'''))
    if not 420 <= height <= 1200:
        raise ValueError('SQL evidence frame exceeds readable capture bounds.')
    await page.set_viewport_size({'width':1200, 'height':height})
    clipped = await page.evaluate('''() => {
        const source = document.querySelector('.sql-highlight-layer');
        const editor = document.getElementById('wb-code-section');
        const table = document.querySelector('.rg-table');
        const grid = document.querySelector('.rg-table-container');
        const pane = document.getElementById('result-pane');
        const gridClipped = table && grid && getComputedStyle(pane).display !== 'none' &&
            (table.getBoundingClientRect().bottom > grid.getBoundingClientRect().bottom + 2 ||
             table.scrollWidth > grid.clientWidth + 2);
        return source.scrollWidth > source.clientWidth + 2 ||
            source.getBoundingClientRect().bottom > editor.getBoundingClientRect().bottom + 2 || gridClipped;
    }''')
    if clipped:
        raise ValueError('SQL source or result grid would be clipped; split long statements or oversized result sets into smaller sections.')
    await page.screenshot(path=str(path))


def sql_code_page_end(lines, start, boundary):
    """Budget wrapped display rows while retaining every original source line."""
    end, visual_rows = start - 1, 0
    while end < boundary:
        rows = max(1, math.ceil(len(lines[end]) / 76))
        if end >= start and visual_rows + rows > CODE_LINES_PER_PAGE:
            break
        visual_rows += rows
        end += 1
    return end


def sql_result_label(statement):
    sql = statement.upper()
    if 'HAVING' in sql: return 'HAVING example'
    if len(re.findall(r'\bSELECT\b', sql)) > 1: return 'Nested query example'
    if re.search(r'\bGROUP\s+BY\b', sql): return 'GROUP BY example'
    for function in ('COUNT', 'AVG', 'SUM', 'MAX', 'MIN'):
        if re.search(r'\b'+function+r'\s*\(', sql): return function+' example'
    match = re.match(r'\s*SELECT\s+\*\s+FROM\s+`?(\w+)', statement, re.I)
    return 'Display '+match.group(1) if match else 'Query result'


def notebook_cells(code):
    if isinstance(code, str) and code.lstrip().startswith("{"):
        try:
            notebook = json.loads(code)
        except ValueError:
            notebook = None
        if isinstance(notebook, dict) and "cells" in notebook:
            cells = notebook["cells"]
            if not isinstance(cells, list) or not 1 <= len(cells) <= 40:
                raise ValueError("Notebooks require 1 to 40 cells.")
            result = []
            for cell in cells:
                if not isinstance(cell, dict) or cell.get("cell_type") not in {"code", "markdown"}:
                    raise ValueError("Unsupported notebook cell.")
                source = cell.get("source", "")
                if isinstance(source, list) and all(isinstance(s, str) for s in source):
                    source = "".join(source)
                if not isinstance(source, str):
                    raise ValueError("Invalid notebook source.")
                result.append(
                    {"type": cell["cell_type"], "code": neutralize_magics(source)}
                    if cell["cell_type"] == "code"
                    else {"type": "markdown", "content": source}
                )
            return result
    return [{"type": "code", "code": neutralize_magics(code)}]


def _summarize_sql_statement(stmt: str, leading_comment: str = "") -> str:
    """Create a concise human-readable label for a SQL query/statement."""
    one_line = " ".join(stmt.strip().split())
    if re.search(r"\bLEFT\s+(?:OUTER\s+)?JOIN\b", one_line, re.IGNORECASE) and re.search(
        r"\bUNION\s+ALL\b", one_line, re.IGNORECASE
    ):
        return "FULL OUTER JOIN Equivalent (LEFT JOIN UNION ALL RIGHT JOIN)"
    if re.search(r"\bINNER\s+JOIN\b", one_line, re.IGNORECASE):
        return f"INNER JOIN ({one_line[:54]}...)" if len(one_line) > 54 else f"INNER JOIN ({one_line})"
    if re.search(r"\bLEFT\s+(?:OUTER\s+)?JOIN\b", one_line, re.IGNORECASE):
        return f"LEFT OUTER JOIN ({one_line[:50]}...)" if len(one_line) > 50 else f"LEFT OUTER JOIN ({one_line})"
    if re.search(r"\bRIGHT\s+(?:OUTER\s+)?JOIN\b", one_line, re.IGNORECASE):
        return f"RIGHT OUTER JOIN ({one_line[:50]}...)" if len(one_line) > 50 else f"RIGHT OUTER JOIN ({one_line})"
    if len(one_line) <= 68:
        return one_line
    return one_line[:65] + "..."


def _editor_window_for_statement(
    all_lines: list[str],
    stmt_meta: dict[str, Any],
    window_size: int = RESULT_EDITOR_WINDOW_LINES,
) -> tuple[str, int, list[int]]:
    """
    Slice a readable window of lines around the active statement for the Workbench editor
    so the active statement (and its comment header if nearby) is visible without clipping.
    """
    total = len(all_lines)
    s_line = max(1, int(stmt_meta.get("start_line") or 1))
    e_line = min(total, max(s_line, int(stmt_meta.get("end_line") or s_line)))
    c_line = max(1, int(stmt_meta.get("comment_start_line") or s_line))

    anchor_start = c_line if (e_line - c_line + 1) <= window_size else s_line
    stmt_span = e_line - anchor_start + 1

    if stmt_span >= window_size:
        win_start = anchor_start
        win_end = min(total, anchor_start + max(window_size, stmt_span) - 1)
    else:
        padding_before = max(0, (window_size - stmt_span) // 2)
        win_start = max(1, anchor_start - padding_before)
        win_end = min(total, win_start + window_size - 1)
        if win_end - win_start + 1 < window_size:
            win_start = max(1, win_end - window_size + 1)

    chunk = "\n".join(all_lines[win_start - 1 : win_end])
    return chunk, win_start, [s_line, e_line]


async def capture_sql(
    code: str,
    output_path: str | Path | None = None,
    filename: str | None = None,
    objective: str = "",
    template: str = "workbench",
):
    """
    Execute SQL once against an isolated real MySQL session, verify results semantically,
    and render consistent MySQL Workbench-style frames from the stored execution receipts:
      1. Paginated SQL script frames covering all lines without gaps or duplicates.
      2. Step-by-step query & result frames for each executed SELECT (and final DDL cleanup),
         captured from the exact receipt at that step before subsequent queries or DROP VIEW.
    """
    from .runtime_engine import RuntimeResult

    screenshot_dir = Path(settings.SCREENSHOT_DIR).resolve()
    screenshot_dir.mkdir(parents=True, exist_ok=True)
    primary_target = Path(output_path) if output_path else screenshot_dir / f"sql_{uuid.uuid4().hex}.png"
    primary_target.parent.mkdir(parents=True, exist_ok=True)
    src_filename = Path(filename or "solution.sql").name

    session: SQLSession | None = None
    sqlite = template == "sqlite"
    dialect = "sqlite" if sqlite else "mysql"
    try:
        if sqlite:
            from .sqlite_runtime import execute_sqlite_script
            receipt = await asyncio.to_thread(execute_sqlite_script, code)
        else:
            session = await asyncio.to_thread(SQLSession, allow_dcl=bool(re.search(r'\b(?:GRANT|REVOKE|DCL|authorization)\b', objective, re.I)))
            receipt = await asyncio.to_thread(session.execute_script, code)
        sem_verification = verify_sql_exercise(objective or "", code, receipt)

        statements: list[dict[str, Any]] = receipt.get("statements") or []
        select_results: list[dict[str, Any]] = receipt.get("select_results") or []
        server_version = receipt.get("server_version") or (session.server_version if session else "")
        engine_label = f"{'SQLite' if sqlite else 'MySQL'} {server_version}"
        cli = template == "mysql-cli"
        interface = "DB Browser for SQLite" if sqlite else "MySQL CLI" if cli else "MySQL Workbench"
        conn_title = f"{engine_label} — Localhost (Isolated Lab)"
        time_str = datetime.now().strftime("%H:%M:%S")

        normalized_code = str(code or "").replace("\r\n", "\n").replace("\r", "\n")
        all_lines = normalized_code.splitlines() or [""]
        total_lines = len(all_lines)

        def build_action_logs(upto_index: int) -> list[dict[str, Any]]:
            logs = []
            for st in statements[:upto_index]:
                logs.append(
                    {
                        "seq": st["index"],
                        "time": time_str,
                        "action": st["display_action"].replace("\n", " "),
                        "message": st["message"],
                        "duration": st["duration"],
                        "success": st["success"],
                        "isCurrent": st["index"] == upto_index,
                    }
                )
            return logs

        # Build cumulative result tabs up to any statement index
        def build_result_tabs_upto(upto_index: int, row_slice: list[dict[str, Any]] | None = None, page_suffix: str = "") -> list[dict[str, Any]]:
            tabs = []
            for st in statements[:upto_index]:
                if st.get("success") and st.get("type") == "SELECT" and st.get("columns"):
                    is_target = st["index"] == upto_index
                    title = (st.get("tab_title") or f"{st.get('tableName', 'Result')} 1") + (page_suffix if is_target else "")
                    tabs.append(
                        {
                            "title": title,
                            "tableName": st.get("tableName", "Result"),
                            "schemaName": st.get("schemaName", "lab"),
                            "columns": st["columns"],
                            "rows": row_slice if (is_target and row_slice is not None) else (st.get("shown_rows") or st["rows"])[:RESULT_ROWS_PER_PAGE],
                        }
                    )
            return tabs

        def _is_unfiltered_select_star(stmt_text: str) -> bool:
            return bool(re.match(r"^\s*SELECT\s+\*\s+FROM\s+[`\"'\w.]+\s*;?\s*$", (stmt_text or "").strip(), re.I))

        def resolve_tabs_for_statement(target_st: dict[str, Any] | None) -> list[dict[str, Any]]:
            # Workbench retains earlier SELECT tabs for DDL/DML; it never shows
            # rows from a statement that has not executed yet.
            return build_result_tabs_upto(target_st['index']) if target_st else []

        evidence_frames: list[dict[str, Any]] = []
        screenshots_map: dict[str, str] = {}

        html = resource_file("sql_workbench", "index.html")
        async with acquire_capture_context(viewport={"width": 1200, "height": 900}, service_workers="block") as context:
            async def guard(route):
                if allowed_resource(route.request.url, html.parent):
                    await route.continue_()
                else:
                    await route.abort()

            if sqlite:
                from .ide_report_capture import open_report_workspace, render_report_frame
                page = await open_report_workspace(context, "sqlite")
            else:
                await context.route("**/*", guard)
                page = await context.new_page()
            if not sqlite and cli:
                await page.set_content("""<!doctype html><html lang="en"><meta charset="utf-8">
                    <title>MySQL Command Line Client</title><style>
                    body{margin:0;background:#101010;color:#e4e4e4;font:17px/1.4 Consolas,monospace}
                    header{background:#292929;padding:10px 18px;color:#fff;font:600 15px system-ui}
                    pre{margin:0;padding:18px;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}
                    </style><header>MySQL Command Line Client</header><main><pre></pre></main></html>""")
            elif not sqlite:
                await page.goto(html.as_uri(), wait_until="domcontentloaded", timeout=15000)
                await page.wait_for_function("!!window.MySQLWorkbench && typeof window.MySQLWorkbench.renderFrame === 'function'", timeout=5000)

            async def render_frame(config, path):
                if sqlite:
                    tabs = config["resultSets"]
                    index = config["activeResultIndex"]
                    active = tabs[index] if tabs and index >= 0 else {}
                    columns = active.get("columns", [])
                    last_step = config["actionLogs"][-1] if config["actionLogs"] else None
                    await render_report_frame(page, {
                        "filename": config["tabTitle"], "code": config["editorSql"], "columns": columns,
                        "rows": [[row.get(column) for column in columns] for row in active.get("rows", [])],
                        "status": last_step["message"] if last_step else "", "failed": bool(last_step and not last_step["success"]),
                        "activeLine": (config["highlightRange"][0] - config["startLine"] + 1) if config["highlightRange"] else 0,
                        "firstLine": config["startLine"],
                    }, path, fit_selectors=('[class*="sqlTextarea"]', '[class*="gridFrame"]'))
                    return
                if not cli:
                    await page.evaluate("(cfg) => window.MySQLWorkbench.renderFrame(cfg)", config)
                    await capture_sql_frame(page, path)
                    return
                lines = [engine_label, "", config["tabTitle"], ""]
                sql_lines = config["editorSql"].splitlines()
                lines.extend(("mysql> " if i == 0 else "    -> ") + line for i, line in enumerate(sql_lines))
                tabs = config["resultSets"]
                active = tabs[config["activeResultIndex"]] if tabs and config["activeResultIndex"] >= 0 else None
                if active:
                    lines.extend(["", active["title"], format_mysql_cli_rows(active["columns"], active["rows"])])
                if config["actionLogs"]:
                    lines.extend(["", config["actionLogs"][-1]["message"]])
                await page.locator("pre").evaluate("(el, content) => { el.textContent = content; }", "\n".join(lines))
                await page.set_viewport_size({"width": 1200, "height": 420})
                height = await page.locator("body").evaluate("(el) => Math.ceil(el.getBoundingClientRect().height)")
                if height > 1600:
                    raise ValueError("MySQL CLI evidence exceeds readable capture bounds.")
                await page.set_viewport_size({"width": 1200, "height": max(420, height)})
                await page.screenshot(path=str(path))

            # 1. Render paginated Workbench SQL Script frames (covering lines 1..total_lines without gaps/duplicates)
            # End a code section at every SELECT, so each example is visibly
            # executed with its own grid instead of sharing the last result.
            boundaries = sorted({s['end_line'] for s in statements if s.get('success') and s.get('type')=='SELECT' and s.get('columns')} | {total_lines})
            code_pages = []
            cursor = 1
            for boundary in boundaries:
                while cursor <= boundary:
                    end = sql_code_page_end(all_lines, cursor, boundary)
                    code_pages.append((cursor, end));cursor=end+1
            total_code_pages = len(code_pages)
            final_schemas = receipt.get("schemas") or {}
            final_active_schema = receipt.get("active_schema") or "lab"

            for page_idx, (start_line, end_line) in enumerate(code_pages):
                # The editor shows a full page: a short section continues under the lines before it instead of starting a new, mostly empty page.
                shown_start = max(1, min(start_line, end_line - CODE_LINES_PER_PAGE + 1))
                chunk_text = "\n".join(all_lines[shown_start - 1 : end_line])
                part_label = f"Part {page_idx + 1} of {total_code_pages}"
                frame_path = screenshot_dir / f"sql_code_{uuid.uuid4().hex[:12]}_p{page_idx + 1}.png"

                page_statements = [
                    st for st in statements
                    if st.get("end_line", 1) <= end_line and st.get("end_line", 1) >= start_line
                ]
                page_selects = [
                    st for st in page_statements
                    if st.get("success") and st.get("type") == "SELECT" and st.get("columns")
                ]
                page_star_selects = [
                    st for st in page_selects if _is_unfiltered_select_star(st.get("statement", ""))
                ]

                if page_star_selects:
                    page_target_st = page_star_selects[-1]
                elif page_selects:
                    page_target_st = page_selects[-1]
                elif page_statements:
                    page_target_st = page_statements[-1]
                else:
                    completed = [st for st in statements if st.get('end_line', 1) <= end_line]
                    page_target_st = completed[-1] if completed else None

                page_tabs = resolve_tabs_for_statement(page_target_st)
                visible_page_tabs = page_tabs[-6:] if page_tabs else []
                active_page_tab = visible_page_tabs[-1] if visible_page_tabs else None

                page_hl_range = None
                if (
                    page_target_st
                    and page_target_st.get("start_line", 0) >= start_line
                    and page_target_st.get("end_line", 0) <= end_line
                ):
                    page_hl_range = [page_target_st["start_line"], page_target_st["end_line"]]

                log_upto = page_target_st['index'] if page_target_st else 0
                page_logs = build_action_logs(log_upto)
                page_schemas = page_target_st.get('schemas_snapshot', {}) if page_target_st else {}
                page_active_schema = page_target_st.get('active_schema', 'lab') if page_target_st else 'lab'

                frame_cfg = {
                    "layoutMode": "code",
                    "connectionTitle": conn_title,
                    "serverVersion": server_version,
                    "tabTitle": f"{src_filename} (Lines {shown_start}–{end_line})",
                    "editorSql": chunk_text,
                    "startLine": shown_start,
                    "highlightRange": page_hl_range,
                    "schemas": page_schemas,
                    "activeSchema": page_active_schema,
                    "focusObject": active_page_tab["tableName"] if active_page_tab else None,
                    "resultSets": visible_page_tabs,
                    "activeResultIndex": max(0, len(visible_page_tabs) - 1) if visible_page_tabs else -1,
                    "actionLogs": page_logs,
                }
                await render_frame(frame_cfg, frame_path)
                key = f"source_page_{page_idx + 1}"
                screenshots_map[key] = str(frame_path)
                evidence_frames.append(
                    {
                        "path": str(frame_path),
                        "kind": "source_preview",
                        "source_file": src_filename,
                        "source_ranges": [(start_line, end_line)],
                        "result_statement_index": page_target_st['index'] if page_target_st and page_target_st.get('success') and page_target_st.get('type')=='SELECT' else None,
                        "result_complete": bool(page_target_st and page_target_st.get('success') and page_target_st.get('type')=='SELECT' and page_target_st.get('start_line',0)>=start_line and not page_target_st.get('truncated') and len(page_target_st.get('rows',[]))<=RESULT_ROWS_PER_PAGE),
                        "active_result_title": active_page_tab["title"] if active_page_tab else None,
                        "active_result_table": active_page_tab["tableName"] if active_page_tab else None,
                        "active_result_columns": active_page_tab["columns"] if active_page_tab else [],
                        "active_result_rows": active_page_tab["rows"] if active_page_tab else [],
                        "caption": (
                            f"{sql_result_label(page_target_st['statement']) if page_target_st and page_target_st.get('type')=='SELECT' else 'SQL setup'} — {src_filename} (Lines {shown_start}–{end_line}, {part_label}) "
                            f"[{interface} evidence from {engine_label}]"
                        ),
                    }
                )

            # 2. Render per-query Workbench Execution & Result frames at each query's exact execution step
            query_counter = 0
            expected_db_frames = 0
            last_rendered_path: Path | None = None

            for st in statements:
                is_select = st.get("success") and st.get("type") == "SELECT" and bool(st.get("columns"))
                is_update = st.get("success") and st.get("type") == "UPDATE"
                is_failed = not st.get("success")
                if not (is_select or is_update or is_failed):
                    continue

                editor_chunk, win_start, hl_range = _editor_window_for_statement(all_lines, st)
                step_logs = build_action_logs(st["index"])
                step_schemas = st.get("schemas_snapshot") or final_schemas
                step_active_schema = st.get("active_schema") or final_active_schema
                stmt_summary = _summarize_sql_statement(st["statement"], st.get("leading_comment", ""))

                command_lines = st['statement'].splitlines()
                if len(command_lines) > RESULT_EDITOR_WINDOW_LINES:
                    for part in range(math.ceil(len(command_lines) / CODE_LINES_PER_PAGE)):
                        first = part * CODE_LINES_PER_PAGE
                        command_path = screenshot_dir / f"sql_command_{uuid.uuid4().hex[:12]}_s{st['index']}_p{part + 1}.png"
                        previous = statements[st['index'] - 2] if st['index'] > 1 else None
                        await render_frame({
                            'layoutMode': 'code', 'connectionTitle': conn_title, 'serverVersion': server_version,
                            'tabTitle': f"{src_filename} — Step {st['index']} command, part {part + 1}",
                            'editorSql': '\n'.join(command_lines[first:first + CODE_LINES_PER_PAGE]),
                            'startLine': st.get('start_line', 1) + first, 'highlightRange': None,
                            'schemas': previous.get('schemas_snapshot', {}) if previous else {},
                            'activeSchema': previous.get('active_schema', 'lab') if previous else 'lab',
                            'resultSets': [], 'activeResultIndex': -1, 'actionLogs': build_action_logs(st['index'] - 1),
                        }, command_path)
                        screenshots_map[f"database_command_{st['index']}_{part + 1}"] = str(command_path)
                        evidence_frames.append({'path': str(command_path), 'kind': 'database', 'phase': 'command',
                            'statement_index': st['index'], 'statement': st['statement'],
                            'caption': f"Step {st['index']} complete SQL command — part {part + 1}"})
                        expected_db_frames += 1

                if is_select:
                    query_counter += 1
                    rows = st.get("shown_rows") or st.get("rows") or []
                    total_row_pages = max(1, math.ceil(max(1, len(rows)) / RESULT_ROWS_PER_PAGE))
                    for r_page in range(total_row_pages):
                        expected_db_frames += 1
                        r_start = r_page * RESULT_ROWS_PER_PAGE
                        r_end = min(len(rows), (r_page + 1) * RESULT_ROWS_PER_PAGE)
                        row_slice = rows[r_start:r_end]
                        page_suffix = f" (Rows {r_start + 1}–{r_end})" if total_row_pages > 1 else ""
                        tabs = build_result_tabs_upto(st["index"], row_slice=row_slice, page_suffix=page_suffix)
                        visible_tabs = tabs[-7:]
                        active_tab = visible_tabs[-1] if visible_tabs else None
                        frame_path = screenshot_dir / f"sql_query_{uuid.uuid4().hex[:12]}_q{query_counter}_p{r_page + 1}.png"

                        frame_cfg = {
                            "layoutMode": "result",
                            "connectionTitle": conn_title,
                            "serverVersion": server_version,
                            "tabTitle": f"{src_filename} — Query {query_counter}",
                            "editorSql": editor_chunk,
                            "startLine": win_start,
                            "highlightRange": hl_range,
                            "schemas": step_schemas,
                            "activeSchema": step_active_schema,
                            "focusObject": st.get("tableName"),
                            "resultSets": visible_tabs,
                            "activeResultIndex": max(0, len(visible_tabs) - 1),
                            "actionLogs": step_logs,
                        }
                        await render_frame(frame_cfg, frame_path)
                        last_rendered_path = frame_path
                        q_key = f"database_q{query_counter}_p{r_page + 1}"
                        screenshots_map[q_key] = str(frame_path)
                        row_desc = (
                            f"Rows {r_start + 1}–{r_end} of {len(rows)}"
                            if total_row_pages > 1
                            else f"{len(rows)} row(s) returned"
                        )
                        if st.get('result_set_count',1)>1:
                            row_desc += f"; combined output from {st['result_set_count']} procedure result sets"
                        stage = ""
                        if st["index"] < len(statements) and statements[st["index"]].get("type") == "UPDATE":
                            stage = "Before UPDATE — "
                        elif st["index"] > 1 and statements[st["index"] - 2].get("type") == "UPDATE":
                            stage = "After UPDATE — "
                        evidence_frames.append(
                            {
                                "path": str(frame_path),
                                "kind": "database",
                                "query_index": query_counter,
                                "statement_index": st["index"],
                                "statement": st["statement"],
                                "active_result_title": active_tab["title"] if active_tab else None,
                                "active_result_table": active_tab["tableName"] if active_tab else None,
                                "active_result_columns": active_tab["columns"] if active_tab else [],
                                "active_result_rows": active_tab["rows"] if active_tab else [],
                                "caption": (
                                    f"{interface} {stage}Query {query_counter}: {stmt_summary} ({row_desc}) "
                                    f"[{interface} evidence from {engine_label}]"
                                ),
                            }
                        )
                else:
                    # Non-SELECT step (DDL, DML, UPDATE, or failed statement)
                    expected_db_frames += 1
                    tabs = resolve_tabs_for_statement(st)
                    visible_tabs = tabs[-7:]
                    active_tab = visible_tabs[-1] if visible_tabs else None
                    frame_path = screenshot_dir / f"sql_step_{uuid.uuid4().hex[:12]}_s{st['index']}.png"
                    frame_cfg = {
                        "layoutMode": "result",
                        "connectionTitle": conn_title,
                        "serverVersion": server_version,
                        "tabTitle": f"{src_filename} — {'Update' if is_update else 'Step'} {st['index']}",
                        "editorSql": editor_chunk,
                        "startLine": win_start,
                        "highlightRange": hl_range,
                        "schemas": step_schemas,
                        "activeSchema": step_active_schema,
                        "focusObject": st.get("tableName") or (active_tab["tableName"] if active_tab else None),
                        "resultSets": visible_tabs,
                        "activeResultIndex": max(0, len(visible_tabs) - 1) if visible_tabs else -1,
                        "actionLogs": step_logs,
                    }
                    await render_frame(frame_cfg, frame_path)
                    last_rendered_path = frame_path
                    s_key = f"database_step_{st['index']}"
                    screenshots_map[s_key] = str(frame_path)
                    status_desc = st.get("message") or ("Execution error" if is_failed else "Completed")
                    if is_update:
                        status_desc += "; result grid shows the last SELECT before this update"
                    evidence_frames.append(
                        {
                            "path": str(frame_path),
                            "kind": "database",
                            "statement_index": st["index"],
                            "statement": st["statement"],
                            "active_result_title": active_tab["title"] if active_tab else None,
                            "active_result_table": active_tab["tableName"] if active_tab else None,
                            "active_result_columns": active_tab["columns"] if active_tab else [],
                            "active_result_rows": active_tab["rows"] if active_tab else [],
                            "caption": (
                                f"{interface} {'UPDATE' if is_update else 'Execution Step'} {st['index']}: {stmt_summary} ({status_desc}) "
                                f"[{interface} evidence from {engine_label}]"
                            ),
                        }
                    )

            # Copy or write primary_target if caller passed an explicit output_path (or if no query frames were produced)
            if last_rendered_path and last_rendered_path.is_file():
                if output_path:
                    import shutil
                    shutil.copyfile(last_rendered_path, primary_target)
                    screenshots_map["database"] = str(primary_target)
            elif evidence_frames:
                first_path = Path(evidence_frames[0]["path"])
                if output_path and first_path.is_file():
                    import shutil
                    shutil.copyfile(first_path, primary_target)
                    screenshots_map["database"] = str(primary_target)

        overall_ok = bool(receipt.get("success") and sem_verification.get("verified") and expected_db_frames > 0)
        err_list: list[str] = []
        if receipt.get("error"):
            err_list.append(str(receipt["error"]))
        for f_msg in sem_verification.get("failures") or []:
            if f_msg not in err_list:
                err_list.append(f_msg)
        combined_error = "\n".join(err_list).strip()
        if not statements and not combined_error:
            combined_error = "No SQL statements were executed."

        verification_payload = {
            "kind": "database",
            "dialect": dialect,
            "engine": engine_label,
            "server_version": server_version,
            "isolated_schema": receipt.get("isolated_schema", ""),
            "interface": (f"{interface} evidence rendered from real {engine_label} execution" if sqlite
                          else f"{interface}-style rendered interface connected to real MySQL"),
            "status": "passed" if overall_ok else "failed",
            "verified": overall_ok,
            "statements": statements,
            "select_count": len(select_results),
            "expected_database_frames": max(1, expected_db_frames),
            "checks": sem_verification.get("checks", []),
            "failures": sem_verification.get("failures", []),
            "summary": sem_verification.get("summary", ""),
            "evidence_frames": evidence_frames,
        }
        return RuntimeResult(
            overall_ok,
            output=receipt.get("stdout", ""),
            error=combined_error,
            exit_code=0 if overall_ok else 1,
            screenshots=screenshots_map,
            verification=verification_payload,
        )
    except Exception as error:
        return RuntimeResult(
            False,
            error=str(error),
            exit_code=1,
            stages={'capture': 'unavailable'} if isinstance(error, CaptureBrowserUnavailable) else {},
            verification={
                "kind": "database",
                "dialect": dialect,
                "status": "failed",
                "verified": False,
                "failures": [str(error)],
                "error": str(error),
            },
        )
    finally:
        if session is not None:
            session.close()


def _wrap_notebook_text(text: str, width: int = 90, chunk_lines: int = 18) -> list[str]:
    """Wrap long notebook stream lines at fixed width and page them into bounded line chunks."""
    import textwrap

    wrapped: list[str] = []
    for raw_line in str(text).splitlines():
        wrapped.extend(
            textwrap.wrap(
                raw_line,
                width=width,
                replace_whitespace=False,
                drop_whitespace=False,
                break_on_hyphens=False,
            )
            or [""]
        )
    return ["\n".join(wrapped[i : i + chunk_lines]) for i in range(0, len(wrapped), chunk_lines)]


async def capture_jupyter_evidence(
    cells,
    screenshot_path,
    source_filename: str = "notebook.py",
    theme: str = "dark",
    **metadata,
):
    """Render readable sections of one saved execution receipt in JupyterLab theme."""
    if theme not in {"light", "dark"}:
        raise ValueError("Choose a light or dark Jupyter theme.")
    from .screenshot_service import screenshot_service

    student_name = str(metadata.get("student_name") or "Student")
    group = metadata.get("job_id")
    frames: list[dict[str, Any]] = []
    code_cells = [
        (c.get("code", "") or "").splitlines() or [""]
        for c in cells
        if c.get("type") not in {"markdown", "text"}
    ]
    full_source = "\n".join("\n".join(cell_lines) for cell_lines in code_cells)
    offset = 0

    async def capture(
        code_arg: str,
        output_arg: str,
        kind: str,
        caption: str,
        *,
        view_mode: str,
        details: dict[str, Any] | None = None,
        **extra_kwargs,
    ):
        if len(frames) >= 80:
            raise ValueError("Notebook exceeds the 80 evidence section limit.")
        ok, rendered_path, width, height = await screenshot_service.generate_screenshot(
            code_arg,
            output_arg,
            "jupyter",
            group,
            student_name,
            source_filename,
            view_mode=view_mode,
            presentation="ide_evidence",
            language="python",
            palette=theme,
            input_echoed=True,
            **extra_kwargs,
        )
        if not ok:
            raise RuntimeError("Jupyter evidence capture failed.")
        frame = dict(path=rendered_path, kind=kind, caption=caption, width=width, height=height)
        if details:
            frame.update(details)
        frames.append(frame)

    for number, cell in enumerate(cells, 1):
        if cell.get("type") in {"markdown", "text"}:
            await capture(
                cell.get("code", "") or "",
                "",
                "notebook",
                f"Jupyter Notebook text — cell {number}",
                view_mode="output",
            )
            continue

        lines = (cell.get("code", "") or "").splitlines() or [""]
        for start in range(0, len(lines), 22):
            end = min(start + 22, len(lines))
            await capture(
                full_source,
                "",
                "source_preview",
                f"Jupyter Notebook code — cell {number}, lines {start + 1}–{end}",
                view_mode="editor",
                details={
                    "source_file": source_filename,
                    "source_ranges": [(offset + start + 1, offset + end)],
                },
                source_ranges=[[offset + start + 1, offset + end]],
            )
        offset += len(lines)

        context = "\n".join(lines[-3:])
        emitted_output = False
        for key in ("stdout", "repr"):
            text = cell.get(key)
            if text:
                for part, chunk in enumerate(_wrap_notebook_text(text), 1):
                    emitted_output = True
                    await capture(
                        context,
                        chunk,
                        "notebook",
                        f"Jupyter Notebook output — cell {number}, part {part}",
                        view_mode="output",
                    )
        for key in ("stderr", "error"):
            text = cell.get(key)
            if text:
                for part, chunk in enumerate(_wrap_notebook_text(text), 1):
                    emitted_output = True
                    await capture(
                        context,
                        "",
                        "notebook",
                        f"Jupyter Notebook output — cell {number}, error part {part}",
                        view_mode="output",
                        error=chunk,
                    )
        for idx, plot in enumerate(cell.get("plots") or [], 1):
            plot_str = str(plot or "").strip()
            if not re.fullmatch(r"data:image/png;base64,[A-Za-z0-9+/=]+", plot_str):
                raise ValueError("Invalid Jupyter plot image data.")
            emitted_output = True
            await capture(
                context,
                "",
                "notebook",
                f"Jupyter Notebook plot — cell {number}, plot {idx}",
                view_mode="output",
                jupyter_plot=plot_str,
            )
        if not emitted_output:
            await capture(
                context,
                "",
                "notebook",
                f"Jupyter Notebook execution — cell {number}",
                view_mode="output",
            )

    return frames, offset


async def capture_notebook(code, datasets=None, output_path=None, **metadata):
    from .isolated_runtime import isolation_required
    if isolation_required():
        from .runtime_engine import runtime_engine
        config = dict(
            metadata,
            datasets=datasets,
            colab_theme=metadata.get('theme', 'dark'),
            notebook_template=metadata.get('notebook_template', 'colab'),
            jupyter_theme=metadata.get('jupyter_theme', 'light'),
        )
        return await runtime_engine.execute(code, 'colab', filename=metadata.get('source_filename', 'notebook.py'), project_config=config)
    if re.search(r'\bpyspark\b', code, re.I):
        from .spark_runtime import capture_spark
        return await capture_spark(code, datasets=datasets, output_path=output_path, **metadata)
    from .colab_pipeline import capture_colab_evidence
    from .runtime_engine import RuntimeResult

    target = (
        Path(output_path)
        if output_path
        else Path(settings.SCREENSHOT_DIR).resolve() / ("notebook_" + uuid.uuid4().hex + ".png")
    )
    theme=metadata.get('theme','dark')
    notebook_template = str(metadata.pop('notebook_template', 'colab') or 'colab').lower()
    jupyter_theme = str(metadata.pop('jupyter_theme', 'light') or 'light').lower()
    source_filename=metadata.pop('source_filename','notebook.py')
    notebook_template=metadata.pop('notebook_template', 'colab')
    jupyter_theme=metadata.pop('jupyter_theme', 'light')
    if notebook_template not in {'colab', 'jupyter'} or jupyter_theme not in {'light', 'dark'}:
        return RuntimeResult(False, error='Invalid notebook presentation.', exit_code=2)
    kernel = ColabPythonKernel(
        teacher_datasets=datasets,
        allow_synthetic=bool(metadata.pop("allow_synthetic", False)),
        theme=theme,
    )
    cells = []
    try:
        for cell in notebook_cells(code):
            if cell["type"] == "markdown":
                cells.append(cell)
            else:
                result = await asyncio.to_thread(kernel.execute_cell, cell["code"])
                cells.append(result)
                if result.get("error"):
                    break
        success = any(c.get("type") == "code" for c in cells) and not any(c.get("error") for c in cells)
        if notebook_template == 'jupyter':
            frames, source_lines = await capture_jupyter_evidence(cells, target, source_filename, jupyter_theme)
        else:
            frames, source_lines = await asyncio.to_thread(
                capture_colab_evidence,
                cells=cells,
                screenshot_path=str(target),
                source_filename=source_filename,
                datasets=datasets,
                kernel=kernel,
                **metadata,
            )
        ok=bool(frames)
        width=max((frame['width'] for frame in frames),default=0)
        height=max((frame['height'] for frame in frames),default=0)
        output = "\n".join(
            "\n".join(str(c[k]) for k in ("stdout", "stderr", "repr") if c.get(k))
            for c in cells
            if c.get("type") == "code"
        ).strip()
        error = "\n".join(c["error"] for c in cells if c.get("error"))
        return RuntimeResult(
            bool(success and ok),
            output=output,
            error=error,
            exit_code=0 if success and ok else 1,
            screenshots={f"notebook_{i}":frame['path'] for i,frame in enumerate(frames)},
            verification={
                "kind": "notebook",
                "status": "passed" if success and ok else "failed",
                "cells": cells,
                "width": width,
                "height": height,
                "runtime": "local-python",
                "accelerator": "CPU",
                "gpu": None,
                "theme":jupyter_theme if notebook_template == 'jupyter' else theme,
                "template":notebook_template,"source_lines":source_lines,"evidence_frames":frames,
            },
        )
    except Exception as error:
        execution_error = "\n".join(str(c.get("error")) for c in cells if c.get("error"))
        return RuntimeResult(
            False,
            output='\n'.join(str(c.get('stdout','')) for c in cells),
            error="\n".join(part for part in (execution_error, f"Evidence capture failed: {error}") if part),
            exit_code=1,
            stages={'execution':'failed' if execution_error else 'passed','capture':'unavailable'},
            verification={"kind": "notebook", "status": "failed", "cells": cells},
        )
    finally:
        kernel.cleanup()


async def capture_jupyter_evidence(cells, target, source_filename, theme):
    """Render the real notebook receipt in the student's selected presentation."""
    import textwrap
    from html.parser import HTMLParser
    from .screenshot_service import screenshot_service

    class TextExtractor(HTMLParser):
        def __init__(self):
            super().__init__()
            self.parts = []
        def handle_data(self, data):
            self.parts.append(data)
        def handle_endtag(self, tag):
            if tag in {'tr', 'p', 'div', 'br'}:
                self.parts.append('\n')

    frames, offset = [], 0
    group = 'jupyter_' + uuid.uuid4().hex
    async def capture(code, output, kind, caption, plot='', **details):
        if len(frames) >= 40:
            raise ValueError('Notebook exceeds the 40 evidence section limit; split the assignment.')
        ok, path, width, height = await screenshot_service.generate_screenshot(
            code, output, 'jupyter', group, 'Student', source_filename,
            view_mode='editor' if kind == 'source_preview' else 'output',
            presentation='ide_evidence', language='python', palette=theme,
            input_echoed=True, jupyter_plot=plot)
        if not ok:
            raise ValueError('Jupyter evidence capture failed.')
        frames.append({'path': path, 'kind': kind, 'caption': caption,
                       'width': width, 'height': height, **details})

    for number, cell in enumerate(cells, 1):
        if cell.get('type') != 'code':
            await capture('', str(cell.get('content', '')), 'notebook', 'Notebook text')
            continue
        lines = cell.get('code', '').splitlines() or ['']
        for start in range(0, len(lines), 22):
            end = min(start + 22, len(lines))
            await capture('\n'.join(lines[start:end]), '', 'source_preview', 'Jupyter notebook code',
                          source_file=source_filename, source_ranges=[(offset + start + 1, offset + end)])
        offset += len(lines)
        context = '\n'.join(lines[-3:])
        output = '\n'.join(str(cell[k]) for k in ('stdout', 'stderr', 'repr', 'error') if cell.get(k))
        if cell.get('html') and not cell.get('repr'):
            parser = TextExtractor()
            parser.feed(str(cell['html']))
            output += '\n' + ''.join(parser.parts)
        visual_lines = [part for line in output.splitlines() for part in
                        (textwrap.wrap(line, 90, replace_whitespace=False, drop_whitespace=False,
                                       break_on_hyphens=False) or [''])]
        for start in range(0, len(visual_lines), 18):
            await capture(context, '\n'.join(visual_lines[start:start+18]), 'notebook', 'Jupyter notebook output')
        for plot in cell.get('plots', []):
            if not isinstance(plot, str) or not re.fullmatch(r'data:image/png;base64,[A-Za-z0-9+/=]+', plot):
                raise ValueError('Invalid notebook plot evidence.')
            await capture(context, '', 'notebook', 'Jupyter notebook plot', plot=plot)
        if not visual_lines and not cell.get('plots'):
            await capture(context, '', 'notebook', 'Jupyter notebook output')
    return frames, offset
