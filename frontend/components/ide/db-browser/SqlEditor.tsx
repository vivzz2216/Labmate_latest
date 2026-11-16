"use client";

import React, { useCallback, useMemo, useRef } from "react";
import styles from "./db-browser.module.css";

interface SqlEditorProps {
  value: string;
  onChange: (next: string) => void;
  onExecuteAll: () => void;
  onExecuteCurrentLine: (cursorOffset: number) => void;
  onToggleFind: () => void;
  onCursorChange: (line: number, col: number, offset: number) => void;
  activeLine: number;
  heightStyle: React.CSSProperties;
}

const SQL_KEYWORDS: Record<string, boolean> = {
  SELECT: true,
  FROM: true,
  WHERE: true,
  AND: true,
  OR: true,
  NOT: true,
  IN: true,
  LIKE: true,
  BETWEEN: true,
  IS: true,
  NULL: true,
  AS: true,
  JOIN: true,
  INNER: true,
  LEFT: true,
  OUTER: true,
  CROSS: true,
  ON: true,
  ORDER: true,
  BY: true,
  ASC: true,
  DESC: true,
  GROUP: true,
  HAVING: true,
  LIMIT: true,
  OFFSET: true,
  DISTINCT: true,
  ALL: true,
  INSERT: true,
  INTO: true,
  VALUES: true,
  UPDATE: true,
  SET: true,
  DELETE: true,
  CREATE: true,
  TABLE: true,
  DROP: true,
  ALTER: true,
  ADD: true,
  RENAME: true,
  TO: true,
  INDEX: true,
  UNIQUE: true,
  VIEW: true,
  TRIGGER: true,
  IF: true,
  EXISTS: true,
  PRIMARY: true,
  KEY: true,
  AUTOINCREMENT: true,
  DEFAULT: true,
  PRAGMA: true,
  BEGIN: true,
  COMMIT: true,
  ROLLBACK: true,
  CASE: true,
  WHEN: true,
  THEN: true,
  ELSE: true,
  END: true,
  CAST: true,
  INTEGER: true,
  INT: true,
  TEXT: true,
  VARCHAR: true,
  REAL: true,
  DECIMAL: true,
  BLOB: true,
  DATETIME: true,
  TRUE: true,
  FALSE: true,
};

const SQL_FUNCTIONS: Record<string, boolean> = {
  COUNT: true,
  SUM: true,
  AVG: true,
  MIN: true,
  MAX: true,
  TOTAL: true,
  GROUP_CONCAT: true,
  UPPER: true,
  LOWER: true,
  LENGTH: true,
  TRIM: true,
  LTRIM: true,
  RTRIM: true,
  SUBSTR: true,
  SUBSTRING: true,
  REPLACE: true,
  COALESCE: true,
  IFNULL: true,
  NULLIF: true,
  IIF: true,
  ABS: true,
  ROUND: true,
  TYPEOF: true,
  SQLITE_VERSION: true,
  DATE: true,
  DATETIME: true,
};

interface HighlightSpan {
  text: string;
  kind: "plain" | "keyword" | "function" | "string" | "number" | "comment";
}

function tokenizeHighlight(sql: string): HighlightSpan[] {
  const spans: HighlightSpan[] = [];
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : "";

    if (ch === "-" && next === "-") {
      let end = sql.indexOf("\n", i);
      if (end === -1) end = sql.length;
      spans.push({ text: sql.slice(i, end), kind: "comment" });
      i = end;
      continue;
    }

    if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      spans.push({ text: sql.slice(i, stop), kind: "comment" });
      i = stop;
      continue;
    }

    if (ch === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2;
        } else if (sql[j] === "'") {
          j++;
          break;
        } else {
          j++;
        }
      }
      spans.push({ text: sql.slice(i, j), kind: "string" });
      i = j;
      continue;
    }

    if (/[0-9]/.test(ch) && (i === 0 || !/[A-Za-z0-9_]/.test(sql[i - 1]))) {
      let j = i;
      while (j < sql.length && /[0-9.]/.test(sql[j])) j++;
      spans.push({ text: sql.slice(i, j), kind: "number" });
      i = j;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < sql.length && /[A-Za-z0-9_$]/.test(sql[j])) j++;
      const word = sql.slice(i, j);
      const upper = word.toUpperCase();
      if (SQL_KEYWORDS[upper]) {
        spans.push({ text: word, kind: "keyword" });
      } else if (SQL_FUNCTIONS[upper] && sql[j] === "(") {
        spans.push({ text: word, kind: "function" });
      } else {
        spans.push({ text: word, kind: "plain" });
      }
      i = j;
      continue;
    }

    let j = i + 1;
    while (
      j < sql.length &&
      !/[A-Za-z0-9_'\-/]/.test(sql[j])
    ) {
      j++;
    }
    spans.push({ text: sql.slice(i, j), kind: "plain" });
    i = j;
  }

  return spans;
}

export function SqlEditor({
  value,
  onChange,
  onExecuteAll,
  onExecuteCurrentLine,
  onToggleFind,
  onCursorChange,
  activeLine,
  heightStyle,
}: SqlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const lines = useMemo(() => value.split("\n"), [value]);
  const spans = useMemo(() => tokenizeHighlight(value), [value]);

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.style.transform =
        "translate(" + -ta.scrollLeft + "px, " + -ta.scrollTop + "px)";
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
  }, []);

  const updateCursorFromTarget = useCallback(
    (ta: HTMLTextAreaElement) => {
      const pos = ta.selectionStart || 0;
      const before = ta.value.slice(0, pos);
      const split = before.split("\n");
      const line = split.length;
      const col = split[split.length - 1].length + 1;
      onCursorChange(line, col, pos);
    },
    [onCursorChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        onExecuteAll();
        return;
      }
      if (e.key === "F5" && !e.shiftKey) {
        e.preventDefault();
        onExecuteAll();
        return;
      }
      if ((e.key === "F5" && e.shiftKey) || e.key === "F9") {
        e.preventDefault();
        onExecuteCurrentLine(e.currentTarget.selectionStart || 0);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        onToggleFind();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const nextVal = value.slice(0, start) + "  " + value.slice(end);
        onChange(nextVal);
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
          updateCursorFromTarget(ta);
        }, 0);
      }
    },
    [onChange, onExecuteAll, onExecuteCurrentLine, onToggleFind, updateCursorFromTarget, value]
  );

  const activeLineTop = (activeLine - 1) * 18 + 3;

  return (
    <div className={styles.sqlEditorFrame} style={heightStyle}>
      <div className={styles.sqlGutter} ref={gutterRef} aria-hidden="true">
        {lines.map((_, idx) => (
          <div key={idx}>{idx + 1}</div>
        ))}
      </div>
      <div className={styles.sqlCodeSurface}>
        <div
          className={styles.sqlActiveLineBg}
          style={{ top: activeLineTop + "px" }}
          aria-hidden="true"
        />
        <pre ref={preRef} className={styles.sqlHighlightPre} aria-hidden="true">
          {spans.map((sp, idx) => {
            if (sp.kind === "keyword") {
              return (
                <span key={idx} className={styles.tokKeyword}>
                  {sp.text}
                </span>
              );
            }
            if (sp.kind === "function") {
              return (
                <span key={idx} className={styles.tokFunction}>
                  {sp.text}
                </span>
              );
            }
            if (sp.kind === "string") {
              return (
                <span key={idx} className={styles.tokString}>
                  {sp.text}
                </span>
              );
            }
            if (sp.kind === "number") {
              return (
                <span key={idx} className={styles.tokNumber}>
                  {sp.text}
                </span>
              );
            }
            if (sp.kind === "comment") {
              return (
                <span key={idx} className={styles.tokComment}>
                  {sp.text}
                </span>
              );
            }
            return <React.Fragment key={idx}>{sp.text}</React.Fragment>;
          })}
          {value.endsWith("\n") ? " " : ""}
        </pre>
        <textarea
          ref={textareaRef}
          aria-label="SQL Editor"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className={styles.sqlTextarea}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            updateCursorFromTarget(e.currentTarget);
          }}
          onClick={(e) => updateCursorFromTarget(e.currentTarget)}
          onKeyUp={(e) => updateCursorFromTarget(e.currentTarget)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}
