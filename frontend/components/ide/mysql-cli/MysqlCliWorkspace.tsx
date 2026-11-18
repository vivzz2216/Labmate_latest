"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createMysqlSession,
  executeMysqlInput,
  formatMysqlPrompt,
  getMysqlCompletions,
  MYSQL_WELCOME_BANNER,
  submitMysqlLine,
  type MysqlOutputBlock,
  type MysqlSession,
} from "@/lib/ide/mysqlEngine";
import { MYSQL_OFFLINE_NOTICE, renderRemoteMysql, resetMysqlRemote, runMysqlRemote } from "@/lib/ide/mysqlRemote";
import {
  MysqlCmdWindowIcon,
  MysqlDolphinIcon,
  WinCloseIcon,
  WinMaximizeIcon,
  WinMinimizeIcon,
  WinRestoreIcon,
} from "./MysqlCliIcons";
import styles from "./mysqlCli.module.css";

interface TerminalEntry {
  id: number;
  text: string;
  kind: "prompt" | "text" | "error" | "table" | "vertical" | "status" | "help" | "bye";
}

type WindowMode = "maximized" | "restored" | "minimized" | "closed";
type AuthMode = "connected" | "password" | "exited";
type CursorShape = "underscore" | "block" | "bar";
type ThemeId = "campbell" | "legacy" | "green" | "amber";
type PropsTabId = "options" | "font" | "colors" | "snippets";

interface ConsolePreferences {
  cursorShape: CursorShape;
  quickEdit: boolean;
  fontSize: number;
  fontFamily: string;
  theme: ThemeId;
  historyLimit: number;
}

const CONSOLE_THEMES: Record<
  ThemeId,
  { label: string; bg: string; fg: string; cursor: string; errorFg: string }
> = {
  campbell: {
    label: "Windows 10/11 Console (Default #0C0C0C)",
    bg: "#0C0C0C",
    fg: "#CCCCCC",
    cursor: "#CCCCCC",
    errorFg: "#CCCCCC",
  },
  legacy: {
    label: "Classic Legacy Black (#000000)",
    bg: "#000000",
    fg: "#C0C0C0",
    cursor: "#FFFFFF",
    errorFg: "#C0C0C0",
  },
  green: {
    label: "Retro Phosphor Green",
    bg: "#041108",
    fg: "#33FF66",
    cursor: "#33FF66",
    errorFg: "#FF7B72",
  },
  amber: {
    label: "Amber Monochrome CRT",
    bg: "#120B02",
    fg: "#FFB000",
    cursor: "#FFB000",
    errorFg: "#FF6B6B",
  },
};

const QUICK_LAB_SNIPPETS: Array<{ label: string; sql: string }> = [
  { label: "List databases", sql: "SHOW DATABASES;" },
  { label: "Select university DB", sql: "USE university;" },
  { label: "List tables", sql: "SHOW TABLES;" },
  { label: "Describe students", sql: "DESC students;" },
  { label: "Top students", sql: "SELECT roll_no, name, semester, cgpa FROM students ORDER BY cgpa DESC;" },
  {
    label: "Dept aggregation",
    sql: "SELECT d.dept_name, COUNT(s.student_id) AS students, ROUND(AVG(s.cgpa), 2) AS avg_cgpa FROM departments d LEFT JOIN students s ON d.dept_id = s.dept_id GROUP BY d.dept_id, d.dept_name;",
  },
  {
    label: "Student enrollments JOIN",
    sql: "SELECT s.name, c.course_code, c.title, e.grade, e.marks FROM students s JOIN enrollments e ON s.student_id = e.student_id JOIN courses c ON e.course_id = c.course_id WHERE e.marks >= 85;",
  },
  { label: "Vertical output (\\G)", sql: "SELECT * FROM students LIMIT 2\\G" },
  { label: "Server status (\\s)", sql: "\\s" },
  { label: "Client help (\\h)", sql: "\\h" },
];

function createInitialEntries(): TerminalEntry[] {
  return [
    { id: 1, kind: "text", text: "Enter password: ****" },
    { id: 2, kind: "text", text: MYSQL_WELCOME_BANNER },
    { id: 3, kind: "text", text: "" },
  ];
}

function renderTextWithHighlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let matchIdx = lowerText.indexOf(lowerQuery, cursor);
  let keyIdx = 0;

  while (matchIdx !== -1) {
    if (matchIdx > cursor) {
      parts.push(text.slice(cursor, matchIdx));
    }
    parts.push(
      <mark key={keyIdx++} className={styles.findHighlight}>
        {text.slice(matchIdx, matchIdx + query.length)}
      </mark>
    );
    cursor = matchIdx + query.length;
    matchIdx = lowerText.indexOf(lowerQuery, cursor);
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }
  return parts.length > 0 ? parts : text;
}

export function MysqlCliWorkspace() {
  // SQL is run by a real MySQL server; if the student is signed out or the server cannot be reached the offline interpreter answers instead.
  const sessionRef = useRef<MysqlSession>(Object.assign(createMysqlSession(null), { remote: true }));
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const nextIdRef = useRef<number>(10);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const terminalContentRef = useRef<HTMLDivElement | null>(null);
  const findInputRef = useRef<HTMLInputElement | null>(null);

  const [entries, setEntries] = useState<TerminalEntry[]>(createInitialEntries);
  const [authMode, setAuthMode] = useState<AuthMode>("connected");
  const [activePrompt, setActivePrompt] = useState<string>("mysql> ");
  const [inputValue, setInputValue] = useState<string>("");
  const [caretPos, setCaretPos] = useState<number>(0);
  const [isTerminalFocused, setIsTerminalFocused] = useState<boolean>(true);
  const [isTypingActive, setIsTypingActive] = useState<boolean>(false);
  const typingTimerRef = useRef<number | null>(null);

  // Command history
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const draftBeforeHistoryRef = useRef<string>("");

  // Tab completion cycle state
  const completionStateRef = useRef<{
    baseBeforeWord: string;
    afterCaret: string;
    matches: string[];
    index: number;
  } | null>(null);

  // Window state
  const [windowMode, setWindowMode] = useState<WindowMode>("maximized");
  const [windowRect, setWindowRect] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 90,
    y: 54,
    w: 980,
    h: 620,
  });
  const [markMode, setMarkMode] = useState<boolean>(false);

  // Menus & Modals
  const [sysMenuPos, setSysMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [editSubmenuOpen, setEditSubmenuOpen] = useState<boolean>(false);
  const [propsOpen, setPropsOpen] = useState<boolean>(false);
  const [propsTab, setPropsTab] = useState<PropsTabId>("options");
  const [prefs, setPrefs] = useState<ConsolePreferences>({
    cursorShape: "underscore",
    quickEdit: true,
    fontSize: 16,
    fontFamily: '"Consolas", "Lucida Console", "Courier New", monospace',
    theme: "campbell",
    historyLimit: 100,
  });
  const [draftPrefs, setDraftPrefs] = useState<ConsolePreferences>(prefs);

  // Find bar
  const [findOpen, setFindOpen] = useState<boolean>(false);
  const [findQuery, setFindQuery] = useState<string>("");

  const allocId = useCallback(() => {
    nextIdRef.current += 1;
    return nextIdRef.current;
  }, []);

  const focusTerminal = useCallback(() => {
    if (propsOpen || findOpen || windowMode === "minimized" || windowMode === "closed") return;
    window.setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
      }
    }, 0);
  }, [propsOpen, findOpen, windowMode]);

  const pulseTyping = useCallback(() => {
    setIsTypingActive(true);
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = window.setTimeout(() => {
      setIsTypingActive(false);
    }, 520);
  }, []);

  const scrollToBottom = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [entries, activePrompt, authMode, scrollToBottom]);

  useEffect(() => {
    focusTerminal();
  }, [focusTerminal]);

  // Global keyboard shortcuts (Alt+Space, Ctrl+F, Esc)
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.code === "Space") {
        e.preventDefault();
        setSysMenuPos((prev) =>
          prev
            ? null
            : {
                x: windowMode === "restored" ? windowRect.x + 2 : 0,
                y: windowMode === "restored" ? windowRect.y + 30 : 30,
              }
        );
        setEditSubmenuOpen(false);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindOpen(true);
        window.setTimeout(() => findInputRef.current?.focus(), 0);
        return;
      }
      if (e.key === "Escape") {
        if (sysMenuPos) {
          setSysMenuPos(null);
          setEditSubmenuOpen(false);
          focusTerminal();
        } else if (findOpen) {
          setFindOpen(false);
          setFindQuery("");
          focusTerminal();
        } else if (markMode) {
          setMarkMode(false);
        }
      }
    };
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, [sysMenuPos, findOpen, markMode, windowMode, windowRect, focusTerminal]);

  const appendEntries = useCallback(
    (newItems: Array<{ kind: TerminalEntry["kind"]; text: string }>) => {
      setEntries((prev) => {
        const next = prev.slice();
        for (let i = 0; i < newItems.length; i++) {
          next.push({
            id: allocId(),
            kind: newItems[i].kind,
            text: newItems[i].text,
          });
        }
        // Keep console buffer crisp up to 1500 blocks
        if (next.length > 1500) {
          return next.slice(next.length - 1500);
        }
        return next;
      });
    },
    [allocId]
  );

  const startPasswordReconnect = useCallback(
    (clearBufferFirst: boolean) => {
      if (clearBufferFirst) {
        setEntries([]);
      }
      sessionRef.current.exited = false;
      sessionRef.current.buffer = "";
      setAuthMode("password");
      setActivePrompt("Enter password: ");
      setInputValue("");
      setCaretPos(0);
      setWindowMode((prev) => (prev === "closed" || prev === "minimized" ? "maximized" : prev));
      focusTerminal();
    },
    [focusTerminal]
  );

  const runSubmittedLine = useCallback(
    async (lineText: string) => {
      if (authMode === "password") {
        const masked = new Array(lineText.length + 1).join("*");
        appendEntries([
          { kind: "text", text: "Enter password: " + masked },
          { kind: "text", text: MYSQL_WELCOME_BANNER },
          { kind: "text", text: "" },
        ]);
        sessionRef.current.exited = false;
        sessionRef.current.buffer = "";
        setAuthMode("connected");
        setActivePrompt(formatMysqlPrompt("main", sessionRef.current.promptPattern));
        setInputValue("");
        setCaretPos(0);
        return;
      }

      if (authMode === "exited") {
        appendEntries([
          { kind: "prompt", text: "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin> " + lineText },
        ]);
        startPasswordReconnect(false);
        return;
      }

      const echoedPromptLine = activePrompt + lineText;
      if (lineText.trim()) {
        setHistory((prev) => {
          if (prev.length > 0 && prev[prev.length - 1] === lineText) return prev;
          const next = prev.concat([lineText]);
          return next.length > prefs.historyLimit
            ? next.slice(next.length - prefs.historyLimit)
            : next;
        });
      }
      setHistoryIndex(-1);
      draftBeforeHistoryRef.current = "";

      const res = submitMysqlLine(sessionRef.current, lineText);
      if (res.outputs.some((block) => block.kind === "remote")) {
        const resolved: MysqlOutputBlock[] = [];
        for (const block of res.outputs) {
          if (block.kind !== "remote") {
            resolved.push(block);
            continue;
          }
          if (sessionRef.current.remote) {
            const outcome = await runMysqlRemote(block.text);
            if (outcome.ok) {
              resolved.push(renderRemoteMysql(outcome.result, Boolean(block.vertical)));
              if ((outcome.result.type || "").toUpperCase() === "USE" && outcome.result.success) {
                sessionRef.current.currentDb = outcome.result.database ?? null;
              }
              continue;
            }
            sessionRef.current.remote = false;
            resolved.push({ kind: "text", text: outcome.reason === "unavailable" ? outcome.message + " Using the offline practice interpreter; results may differ." : MYSQL_OFFLINE_NOTICE });
          }
          const local = executeMysqlInput(sessionRef.current, block.text);
          for (const piece of local.outputs) resolved.push(piece);
        }
        res.outputs = resolved;
      }
      if (res.exited && sessionRef.current.remote) void resetMysqlRemote();

      if (res.clearScreen) {
        setEntries([]);
      } else {
        const toAppend: Array<{ kind: TerminalEntry["kind"]; text: string }> = [
          { kind: "prompt", text: echoedPromptLine },
        ];
        for (let i = 0; i < res.outputs.length; i++) {
          const out: MysqlOutputBlock = res.outputs[i];
          if (out.text !== "") {
            toAppend.push({ kind: out.kind as TerminalEntry["kind"], text: out.text });
          }
        }
        if (res.exited) {
          toAppend.push({ kind: "text", text: "" });
          toAppend.push({
            kind: "text",
            text: "Session closed. Press Enter to reconnect (Enter password: )...",
          });
        } else if (res.outputs.length > 0 && res.promptType === "main") {
          toAppend.push({ kind: "text", text: "" });
        }
        appendEntries(toAppend);
      }

      if (res.exited) {
        setAuthMode("exited");
      }
      setActivePrompt(res.prompt);
      setInputValue("");
      setCaretPos(0);
      completionStateRef.current = null;
    },
    [authMode, activePrompt, appendEntries, prefs.historyLimit, startPasswordReconnect]
  );

  // Lines are answered one after another, in the order they were entered (a pasted script is several lines).
  const executeSubmittedLine = useCallback(
    (lineText: string) => {
      queueRef.current = queueRef.current.then(() => runSubmittedLine(lineText)).catch(() => undefined);
    },
    [runSubmittedLine]
  );

  const handlePasteText = useCallback(
    (pasted: string) => {
      if (!pasted) return;
      const normalized = pasted.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      if (normalized.indexOf("\n") === -1) {
        const before = inputValue.slice(0, caretPos);
        const after = inputValue.slice(caretPos);
        const nextVal = before + normalized + after;
        const nextCaret = before.length + normalized.length;
        setInputValue(nextVal);
        setCaretPos(nextCaret);
        if (inputRef.current) {
          window.setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.selectionStart = nextCaret;
              inputRef.current.selectionEnd = nextCaret;
            }
          }, 0);
        }
        return;
      }

      const lines = normalized.split("\n");
      const firstLine = inputValue.slice(0, caretPos) + lines[0];
      executeSubmittedLine(firstLine);
      for (let i = 1; i < lines.length - 1; i++) {
        executeSubmittedLine(lines[i]);
      }
      const tail = lines[lines.length - 1];
      if (tail.trim().endsWith(";") || tail.trim().endsWith("\\G") || tail.trim().endsWith("\\g")) {
        executeSubmittedLine(tail);
      } else {
        setInputValue(tail);
        setCaretPos(tail.length);
      }
    },
    [inputValue, caretPos, executeSubmittedLine]
  );

  const handleCopySelection = useCallback(() => {
    const sel = window.getSelection();
    const selText = sel ? sel.toString() : "";
    const textToCopy = selText || entries.map((e) => e.text).join("\n");
    if (navigator.clipboard && textToCopy) {
      navigator.clipboard.writeText(textToCopy).catch(() => {});
    }
    if (sel && selText) {
      sel.removeAllRanges();
    }
    setMarkMode(false);
    focusTerminal();
  }, [entries, focusTerminal]);

  const handleSelectAllTerminal = useCallback(() => {
    const node = terminalContentRef.current;
    if (!node) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, []);

  const handleClearBuffer = useCallback(() => {
    setEntries([]);
    sessionRef.current.buffer = "";
    setActivePrompt(formatMysqlPrompt("main", sessionRef.current.promptPattern));
    setInputValue("");
    setCaretPos(0);
    focusTerminal();
  }, [focusTerminal]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    pulseTyping();

    if (e.key === "Enter") {
      e.preventDefault();
      executeSubmittedLine(inputValue);
      return;
    }

    // Ctrl+C: copy if selected, else abort current statement (^C)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      const sel = window.getSelection();
      const selText = sel ? sel.toString() : "";
      if (selText.length > 0) {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(selText).catch(() => {});
        }
        return;
      }
      e.preventDefault();
      if (authMode === "connected") {
        appendEntries([{ kind: "prompt", text: activePrompt + inputValue + "^C" }]);
        sessionRef.current.buffer = "";
        setActivePrompt(formatMysqlPrompt("main", sessionRef.current.promptPattern));
        setInputValue("");
        setCaretPos(0);
        completionStateRef.current = null;
      } else if (authMode === "password") {
        const masked = new Array(inputValue.length + 1).join("*");
        appendEntries([{ kind: "text", text: "Enter password: " + masked + "^C" }]);
        setInputValue("");
        setCaretPos(0);
      }
      return;
    }

    // Ctrl+L: clear console screen
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setEntries([]);
      return;
    }

    // Ctrl+D on empty line exits like standard CLI
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && !inputValue && authMode === "connected") {
      e.preventDefault();
      executeSubmittedLine("\\q");
      return;
    }

    // History ArrowUp / ArrowDown
    if (e.key === "ArrowUp" && authMode === "connected") {
      e.preventDefault();
      if (history.length === 0) return;
      if (historyIndex === -1) {
        draftBeforeHistoryRef.current = inputValue;
        const nextIdx = history.length - 1;
        const cmd = history[nextIdx];
        setHistoryIndex(nextIdx);
        setInputValue(cmd);
        setCaretPos(cmd.length);
      } else if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        const cmd = history[nextIdx];
        setHistoryIndex(nextIdx);
        setInputValue(cmd);
        setCaretPos(cmd.length);
      }
      completionStateRef.current = null;
      return;
    }

    if (e.key === "ArrowDown" && authMode === "connected") {
      e.preventDefault();
      if (historyIndex === -1) return;
      if (historyIndex < history.length - 1) {
        const nextIdx = historyIndex + 1;
        const cmd = history[nextIdx];
        setHistoryIndex(nextIdx);
        setInputValue(cmd);
        setCaretPos(cmd.length);
      } else {
        const draft = draftBeforeHistoryRef.current;
        setHistoryIndex(-1);
        setInputValue(draft);
        setCaretPos(draft.length);
      }
      completionStateRef.current = null;
      return;
    }

    // Tab auto-completion for SQL keywords, databases, tables, columns
    if (e.key === "Tab" && authMode === "connected") {
      e.preventDefault();
      if (completionStateRef.current && completionStateRef.current.matches.length > 0) {
        const st = completionStateRef.current;
        const nextIndex = (st.index + 1) % st.matches.length;
        st.index = nextIndex;
        const chosen = st.matches[nextIndex];
        const nextVal = st.baseBeforeWord + chosen + st.afterCaret;
        const nextCaret = st.baseBeforeWord.length + chosen.length;
        setInputValue(nextVal);
        setCaretPos(nextCaret);
        return;
      }

      const before = inputValue.slice(0, caretPos);
      const after = inputValue.slice(caretPos);
      const match = /([A-Za-z0-9_@$]*)$/.exec(before);
      const prefix = match ? match[1] : "";
      const baseBeforeWord = before.slice(0, before.length - prefix.length);
      const matches = getMysqlCompletions(sessionRef.current, prefix);
      if (matches.length > 0) {
        const chosen = matches[0];
        completionStateRef.current = {
          baseBeforeWord: baseBeforeWord,
          afterCaret: after,
          matches: matches,
          index: 0,
        };
        const nextVal = baseBeforeWord + chosen + after;
        const nextCaret = baseBeforeWord.length + chosen.length;
        setInputValue(nextVal);
        setCaretPos(nextCaret);
      }
      return;
    }

    if (e.key !== "Shift" && e.key !== "Control" && e.key !== "Alt" && e.key !== "Meta") {
      completionStateRef.current = null;
    }
  };

  const syncCaret = () => {
    if (inputRef.current && typeof inputRef.current.selectionStart === "number") {
      setCaretPos(inputRef.current.selectionStart);
    }
  };

  // Dragging & resizing in restored windowed mode
  const startWindowDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (windowMode !== "restored" || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const initX = windowRect.x;
    const initY = windowRect.y;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setWindowRect((prev) => ({
        ...prev,
        x: Math.max(-prev.w + 180, Math.min(window.innerWidth - 180, initX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 40, initY + dy)),
      }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startWindowResize = (axis: "e" | "s" | "se") => (e: React.MouseEvent<HTMLDivElement>) => {
    if (windowMode !== "restored") return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const initW = windowRect.w;
    const initH = windowRect.h;

    const onMove = (ev: MouseEvent) => {
      setWindowRect((prev) => ({
        ...prev,
        w: axis === "s" ? prev.w : Math.max(540, initW + (ev.clientX - startX)),
        h: axis === "e" ? prev.h : Math.max(340, initH + (ev.clientY - startY)),
      }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const themeVars = useMemo(() => {
    const t = CONSOLE_THEMES[prefs.theme];
    return {
      "--cli-bg": t.bg,
      "--cli-fg": t.fg,
      "--cli-cursor": t.cursor,
      "--cli-error-fg": t.errorFg,
      "--cli-font-size": prefs.fontSize + "px",
      "--cli-font": prefs.fontFamily,
    } as React.CSSProperties;
  }, [prefs]);

  const findMatchCount = useMemo(() => {
    if (!findOpen || !findQuery) return 0;
    const q = findQuery.toLowerCase();
    let count = 0;
    for (let i = 0; i < entries.length; i++) {
      const txt = entries[i].text.toLowerCase();
      let idx = txt.indexOf(q);
      while (idx !== -1) {
        count++;
        idx = txt.indexOf(q, idx + q.length);
      }
    }
    return count;
  }, [findOpen, findQuery, entries]);

  // Display text for active input line (masked with * when entering password)
  const displayedInput =
    authMode === "password" ? new Array(inputValue.length + 1).join("*") : inputValue;
  const safeCaret = Math.max(0, Math.min(caretPos, displayedInput.length));
  const beforeCaret = displayedInput.slice(0, safeCaret);
  const atCaretChar = safeCaret < displayedInput.length ? displayedInput[safeCaret] : " ";
  const afterCaret = safeCaret < displayedInput.length ? displayedInput.slice(safeCaret + 1) : "";

  const cursorShapeClass =
    prefs.cursorShape === "block"
      ? styles.cursorBlock
      : prefs.cursorShape === "bar"
        ? styles.cursorBar
        : styles.cursorUnderscore;

  const cursorClassName = [
    styles.cursorCell,
    cursorShapeClass,
    isTerminalFocused
      ? isTypingActive
        ? ""
        : styles.cursorBlinking
      : styles.cursorBlurred,
  ]
    .filter(Boolean)
    .join(" ");

  const windowTitle = (markMode ? "Select " : "") + "MySQL 8.0 Command Line Client - Unicode";

  const handleTerminalMouseUp = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) {
      return;
    }
    focusTerminal();
  };

  const handleTerminalContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const sel = window.getSelection();
    const selText = sel ? sel.toString() : "";
    if (prefs.quickEdit && selText.length > 0) {
      handleCopySelection();
      return;
    }
    if (prefs.quickEdit && !e.shiftKey && navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard
        .readText()
        .then((clip) => {
          if (clip) {
            handlePasteText(clip);
            focusTerminal();
          } else {
            setSysMenuPos({ x: e.clientX, y: e.clientY });
          }
        })
        .catch(() => {
          setSysMenuPos({ x: e.clientX, y: e.clientY });
        });
      return;
    }
    setSysMenuPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className={styles.viewport} style={themeVars}>
      {/* Desktop shortcut + Taskbar shown when minimized or closed */}
      {(windowMode === "minimized" || windowMode === "closed" || windowMode === "restored") && (
        <>
          <button
            type="button"
            className={styles.desktopIconWrap}
            onClick={() => {
              if (windowMode === "closed") {
                startPasswordReconnect(true);
              } else {
                setWindowMode("maximized");
              }
            }}
            title="Open MySQL 8.0 Command Line Client - Unicode"
          >
            <MysqlCmdWindowIcon size={40} />
            <span className={styles.desktopIconLabel}>MySQL 8.0 Command Line Client - Unicode</span>
          </button>

          {windowMode === "minimized" && (
            <div className={styles.winTaskbar}>
              <button
                type="button"
                className={styles.taskbarAppBtn}
                onClick={() => {
                  setWindowMode("maximized");
                  focusTerminal();
                }}
              >
                <MysqlCmdWindowIcon size={16} />
                <span>MySQL 8.0 Command Line Client - Unicode</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Main MySQL 8.0 Command Line Client Window */}
      {windowMode !== "minimized" && windowMode !== "closed" && (
        <div
          className={[
            styles.windowFrame,
            windowMode === "maximized" ? styles.windowMaximized : styles.windowRestored,
            isTerminalFocused ? styles.windowFocused : "",
          ].join(" ")}
          style={
            windowMode === "restored"
              ? {
                  left: windowRect.x + "px",
                  top: windowRect.y + "px",
                  width: windowRect.w + "px",
                  height: windowRect.h + "px",
                }
              : undefined
          }
        >
          {/* Windows 10/11 Console Titlebar */}
          <div
            className={[
              styles.titleBar,
              !isTerminalFocused ? styles.titleBarUnfocused : "",
            ].join(" ")}
            onMouseDown={startWindowDrag}
            onDoubleClick={(e) => {
              if ((e.target as HTMLElement).closest("button")) return;
              setWindowMode((prev) => (prev === "maximized" ? "restored" : "maximized"));
              focusTerminal();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setSysMenuPos({ x: e.clientX, y: e.clientY });
              setEditSubmenuOpen(false);
            }}
          >
            <div className={styles.titleLeft}>
              <button
                type="button"
                aria-label="System Menu"
                aria-haspopup="menu"
                aria-expanded={Boolean(sysMenuPos)}
                className={[
                  styles.sysMenuBtn,
                  sysMenuPos ? styles.sysMenuBtnActive : "",
                ].join(" ")}
                onClick={(e) => {
                  e.stopPropagation();
                  if (sysMenuPos) {
                    setSysMenuPos(null);
                    setEditSubmenuOpen(false);
                  } else {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setSysMenuPos({ x: rect.left, y: rect.bottom });
                    setEditSubmenuOpen(false);
                  }
                }}
              >
                <MysqlCmdWindowIcon size={16} />
              </button>
              <span className={styles.titleText}>{windowTitle}</span>
            </div>

            <div className={styles.captionButtons}>
              <button
                type="button"
                aria-label="Minimize"
                title="Minimize"
                className={styles.captionBtn}
                onClick={() => setWindowMode("minimized")}
              >
                <WinMinimizeIcon />
              </button>
              <button
                type="button"
                aria-label={windowMode === "maximized" ? "Restore Down" : "Maximize"}
                title={windowMode === "maximized" ? "Restore Down" : "Maximize"}
                className={styles.captionBtn}
                onClick={() => {
                  setWindowMode((prev) => (prev === "maximized" ? "restored" : "maximized"));
                  focusTerminal();
                }}
              >
                {windowMode === "maximized" ? <WinRestoreIcon /> : <WinMaximizeIcon />}
              </button>
              <button
                type="button"
                aria-label="Close"
                title="Close"
                className={[styles.captionBtn, styles.captionBtnClose].join(" ")}
                onClick={() => setWindowMode("closed")}
              >
                <WinCloseIcon />
              </button>
            </div>
          </div>

          {/* Terminal Screen */}
          <div className={styles.terminalSurface}>
            {findOpen && (
              <div className={styles.findBar} role="search" aria-label="Find in terminal">
                <input
                  ref={findInputRef}
                  type="text"
                  value={findQuery}
                  onChange={(e) => setFindQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setFindOpen(false);
                      setFindQuery("");
                      focusTerminal();
                    }
                  }}
                  placeholder="Find..."
                  className={styles.findInput}
                />
                <span className={styles.findCount}>
                  {findQuery ? findMatchCount + " found" : ""}
                </span>
                <button
                  type="button"
                  className={styles.findCloseBtn}
                  onClick={() => {
                    setFindOpen(false);
                    setFindQuery("");
                    focusTerminal();
                  }}
                  aria-label="Close Find"
                >
                  ✕
                </button>
              </div>
            )}

            <div
              ref={scrollRef}
              className={styles.terminalScroll}
              onMouseUp={handleTerminalMouseUp}
              onContextMenu={handleTerminalContextMenu}
              onClick={() => {
                if (markMode) setMarkMode(false);
                focusTerminal();
              }}
            >
              <div ref={terminalContentRef}>
                {entries.map((entry) => (
                  <pre
                    key={entry.id}
                    className={[
                      styles.lineBlock,
                      entry.kind === "table" ? styles.lineTable : "",
                      entry.kind === "error" ? styles.lineError : "",
                    ].join(" ")}
                  >
                    {findOpen && findQuery
                      ? renderTextWithHighlight(entry.text, findQuery)
                      : entry.text}
                  </pre>
                ))}
              </div>

              {/* Active Interactive Input Line */}
              <div className={styles.activePromptRow}>
                {authMode === "exited" ? (
                  <span>
                    <span>{"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin> "}</span>
                    <span className={cursorClassName}>{" "}</span>
                  </span>
                ) : (
                  <span>
                    <span>{authMode === "password" ? "Enter password: " : activePrompt}</span>
                    <span>{beforeCaret}</span>
                    <span className={cursorClassName}>{atCaretChar}</span>
                    <span>{afterCaret}</span>
                  </span>
                )}

                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  aria-label="MySQL 8.0 Command Line Client terminal input"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className={styles.hiddenInput}
                  onFocus={() => setIsTerminalFocused(true)}
                  onBlur={() => setIsTerminalFocused(false)}
                  onChange={(e) => {
                    pulseTyping();
                    setInputValue(e.target.value);
                    const nextCaret =
                      typeof e.target.selectionStart === "number"
                        ? e.target.selectionStart
                        : e.target.value.length;
                    setCaretPos(nextCaret);
                  }}
                  onKeyDown={handleInputKeyDown}
                  onKeyUp={syncCaret}
                  onSelect={syncCaret}
                  onClick={syncCaret}
                  onPaste={(e) => {
                    const pasted = e.clipboardData ? e.clipboardData.getData("text") : "";
                    if (pasted) {
                      e.preventDefault();
                      handlePasteText(pasted);
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Windowed Resize Handles */}
          {windowMode === "restored" && (
            <>
              <div className={styles.resizeHandleE} onMouseDown={startWindowResize("e")} />
              <div className={styles.resizeHandleS} onMouseDown={startWindowResize("s")} />
              <div className={styles.resizeHandleSE} onMouseDown={startWindowResize("se")} />
            </>
          )}
        </div>
      )}

      {/* Windows Console System Menu */}
      {sysMenuPos && (
        <>
          <div
            className={styles.sysMenuBackdrop}
            onMouseDown={() => {
              setSysMenuPos(null);
              setEditSubmenuOpen(false);
              focusTerminal();
            }}
          />
          <div
            role="menu"
            className={styles.sysMenuPopup}
            style={{
              left: Math.min(sysMenuPos.x, window.innerWidth - 220) + "px",
              top: Math.min(sysMenuPos.y, window.innerHeight - 320) + "px",
            }}
          >
            <button
              type="button"
              role="menuitem"
              className={styles.sysMenuItem}
              disabled={windowMode === "restored"}
              onClick={() => {
                setWindowMode("restored");
                setSysMenuPos(null);
                focusTerminal();
              }}
            >
              <span>Restore</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.sysMenuItem}
              disabled={windowMode === "maximized"}
              onClick={() => {
                setSysMenuPos(null);
                focusTerminal();
              }}
            >
              <span>Move</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.sysMenuItem}
              disabled={windowMode === "maximized"}
              onClick={() => {
                setSysMenuPos(null);
                focusTerminal();
              }}
            >
              <span>Size</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.sysMenuItem}
              onClick={() => {
                setWindowMode("minimized");
                setSysMenuPos(null);
              }}
            >
              <span>Minimize</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.sysMenuItem}
              disabled={windowMode === "maximized"}
              onClick={() => {
                setWindowMode("maximized");
                setSysMenuPos(null);
                focusTerminal();
              }}
            >
              <span>Maximize</span>
            </button>

            <div className={styles.sysMenuDivider} />

            {/* Edit Submenu */}
            <div
              className={styles.sysMenuItem}
              role="menuitem"
              onMouseEnter={() => setEditSubmenuOpen(true)}
              onClick={() => setEditSubmenuOpen((prev) => !prev)}
            >
              <span>Edit</span>
              <span>▸</span>
              {editSubmenuOpen && (
                <div className={styles.sysSubmenu} role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.sysMenuItem}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMarkMode(true);
                      setSysMenuPos(null);
                      setEditSubmenuOpen(false);
                    }}
                  >
                    <span>Mark</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.sysMenuItem}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSysMenuPos(null);
                      setEditSubmenuOpen(false);
                      handleCopySelection();
                    }}
                  >
                    <span>Copy</span>
                    <span className={styles.sysMenuShortcut}>Enter</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.sysMenuItem}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSysMenuPos(null);
                      setEditSubmenuOpen(false);
                      if (navigator.clipboard && navigator.clipboard.readText) {
                        navigator.clipboard
                          .readText()
                          .then((txt) => {
                            if (txt) handlePasteText(txt);
                            focusTerminal();
                          })
                          .catch(() => focusTerminal());
                      }
                    }}
                  >
                    <span>Paste</span>
                    <span className={styles.sysMenuShortcut}>Ctrl+V</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.sysMenuItem}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSysMenuPos(null);
                      setEditSubmenuOpen(false);
                      handleSelectAllTerminal();
                    }}
                  >
                    <span>Select All</span>
                    <span className={styles.sysMenuShortcut}>Ctrl+A</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.sysMenuItem}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSysMenuPos(null);
                      setEditSubmenuOpen(false);
                      setFindOpen(true);
                      window.setTimeout(() => findInputRef.current?.focus(), 0);
                    }}
                  >
                    <span>Find...</span>
                    <span className={styles.sysMenuShortcut}>Ctrl+F</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              role="menuitem"
              className={styles.sysMenuItem}
              onClick={() => {
                setSysMenuPos(null);
                setEditSubmenuOpen(false);
                handleClearBuffer();
              }}
            >
              <span>Clear Buffer</span>
              <span className={styles.sysMenuShortcut}>Ctrl+L</span>
            </button>

            <button
              type="button"
              role="menuitem"
              className={styles.sysMenuItem}
              onClick={() => {
                setSysMenuPos(null);
                setEditSubmenuOpen(false);
                setDraftPrefs(prefs);
                setPropsTab("options");
                setPropsOpen(true);
              }}
            >
              <span>Properties</span>
            </button>

            <button
              type="button"
              role="menuitem"
              className={styles.sysMenuItem}
              onClick={() => {
                setSysMenuPos(null);
                setEditSubmenuOpen(false);
                setDraftPrefs(prefs);
                setPropsTab("snippets");
                setPropsOpen(true);
              }}
            >
              <span>Quick SQL Snippets...</span>
            </button>

            <button
              type="button"
              role="menuitem"
              className={styles.sysMenuItem}
              onClick={() => {
                setSysMenuPos(null);
                setEditSubmenuOpen(false);
                startPasswordReconnect(true);
              }}
            >
              <span>Reconnect (Password Prompt)</span>
            </button>

            <div className={styles.sysMenuDivider} />

            <button
              type="button"
              role="menuitem"
              className={styles.sysMenuItem}
              onClick={() => {
                setSysMenuPos(null);
                setEditSubmenuOpen(false);
                setWindowMode("closed");
              }}
            >
              <span>Close</span>
              <span className={styles.sysMenuShortcut}>Alt+F4</span>
            </button>
          </div>
        </>
      )}

      {/* Windows Console Properties Dialog */}
      {propsOpen && (
        <div
          className={styles.dialogBackdrop}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setPropsOpen(false);
              focusTerminal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="MySQL 8.0 Command Line Client - Unicode Properties"
            className={styles.propsDialog}
          >
            <div className={styles.propsTitleBar}>
              <span className={styles.propsTitleText} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <MysqlDolphinIcon size={16} />
                &quot;MySQL 8.0 Command Line Client - Unicode&quot; Properties
              </span>
              <button
                type="button"
                aria-label="Close Properties"
                className={styles.propsCloseX}
                onClick={() => {
                  setPropsOpen(false);
                  focusTerminal();
                }}
              >
                <WinCloseIcon />
              </button>
            </div>

            <div className={styles.propsTabs}>
              {(
                [
                  ["options", "Options"],
                  ["font", "Font"],
                  ["colors", "Colors"],
                  ["snippets", "Lab SQL Snippets"],
                ] as Array<[PropsTabId, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={[
                    styles.propsTab,
                    propsTab === id ? styles.propsTabActive : "",
                  ].join(" ")}
                  onClick={() => setPropsTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={styles.propsBody}>
              {propsTab === "options" && (
                <>
                  <div className={styles.propsGroup}>
                    <div className={styles.propsGroupTitle}>Cursor Size</div>
                    {(
                      [
                        ["underscore", "Small (Underscore _)"],
                        ["block", "Large (Block █)"],
                        ["bar", "Vertical Bar (|)"],
                      ] as Array<[CursorShape, string]>
                    ).map(([shape, label]) => (
                      <label key={shape} className={styles.propsRadioRow}>
                        <input
                          type="radio"
                          name="cursorShape"
                          checked={draftPrefs.cursorShape === shape}
                          onChange={() =>
                            setDraftPrefs((prev) => ({ ...prev, cursorShape: shape }))
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>

                  <div className={styles.propsGroup}>
                    <div className={styles.propsGroupTitle}>Edit Options</div>
                    <label className={styles.propsRadioRow}>
                      <input
                        type="checkbox"
                        checked={draftPrefs.quickEdit}
                        onChange={(e) =>
                          setDraftPrefs((prev) => ({ ...prev, quickEdit: e.target.checked }))
                        }
                      />
                      <span>QuickEdit Mode (right-click copies selection or pastes)</span>
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <span>Command History Buffer Size:</span>
                      <select
                        className={styles.propsSelect}
                        value={draftPrefs.historyLimit}
                        onChange={(e) =>
                          setDraftPrefs((prev) => ({
                            ...prev,
                            historyLimit: Number(e.target.value),
                          }))
                        }
                      >
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={250}>250</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {propsTab === "font" && (
                <>
                  <div className={styles.propsGroup}>
                    <div className={styles.propsGroupTitle}>Size &amp; Font</div>
                    <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 10 }}>
                      <label>
                        <span style={{ display: "block", marginBottom: 4 }}>Size:</span>
                        <select
                          className={styles.propsSelect}
                          value={draftPrefs.fontSize}
                          onChange={(e) =>
                            setDraftPrefs((prev) => ({
                              ...prev,
                              fontSize: Number(e.target.value),
                            }))
                          }
                        >
                          <option value={14}>14 px</option>
                          <option value={15}>15 px</option>
                          <option value={16}>16 px (Default)</option>
                          <option value={18}>18 px</option>
                          <option value={20}>20 px</option>
                        </select>
                      </label>

                      <label style={{ flex: 1 }}>
                        <span style={{ display: "block", marginBottom: 4 }}>Font:</span>
                        <select
                          className={styles.propsSelect}
                          style={{ width: "100%" }}
                          value={draftPrefs.fontFamily}
                          onChange={(e) =>
                            setDraftPrefs((prev) => ({ ...prev, fontFamily: e.target.value }))
                          }
                        >
                          <option value='"Consolas", "Lucida Console", "Courier New", monospace'>
                            Consolas
                          </option>
                          <option value='"Lucida Console", "Consolas", monospace'>
                            Lucida Console
                          </option>
                          <option value='"Courier New", monospace'>Courier New</option>
                        </select>
                      </label>
                    </div>
                    <div
                      style={{
                        padding: 10,
                        background: CONSOLE_THEMES[draftPrefs.theme].bg,
                        color: CONSOLE_THEMES[draftPrefs.theme].fg,
                        fontFamily: draftPrefs.fontFamily,
                        fontSize: draftPrefs.fontSize + "px",
                        border: "1px solid #71717a",
                      }}
                    >
                      mysql&gt; SELECT * FROM students;
                    </div>
                  </div>
                </>
              )}

              {propsTab === "colors" && (
                <div className={styles.propsGroup}>
                  <div className={styles.propsGroupTitle}>Console Color Scheme</div>
                  {(Object.keys(CONSOLE_THEMES) as ThemeId[]).map((tid) => (
                    <label key={tid} className={styles.propsRadioRow}>
                      <input
                        type="radio"
                        name="consoleTheme"
                        checked={draftPrefs.theme === tid}
                        onChange={() => setDraftPrefs((prev) => ({ ...prev, theme: tid }))}
                      />
                      <span
                        style={{
                          display: "inline-block",
                          width: 14,
                          height: 14,
                          background: CONSOLE_THEMES[tid].bg,
                          border: "1px solid #71717a",
                          position: "relative",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            inset: 3,
                            background: CONSOLE_THEMES[tid].fg,
                          }}
                        />
                      </span>
                      <span>{CONSOLE_THEMES[tid].label}</span>
                    </label>
                  ))}
                </div>
              )}

              {propsTab === "snippets" && (
                <div>
                  <div style={{ marginBottom: 8, color: "#3f3f46" }}>
                    Click a lab SQL snippet to run it immediately in the MySQL monitor:
                  </div>
                  <div className={styles.snippetList}>
                    {QUICK_LAB_SNIPPETS.map((snip) => (
                      <button
                        key={snip.label}
                        type="button"
                        className={styles.snippetItem}
                        onClick={() => {
                          setPropsOpen(false);
                          if (authMode === "connected") {
                            executeSubmittedLine(snip.sql);
                          }
                          focusTerminal();
                        }}
                      >
                        <span className={styles.snippetCode}>{snip.sql}</span>
                        <span className={styles.snippetLabel}>{snip.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.propsFooter}>
              <button
                type="button"
                className={[styles.winBtn, styles.winBtnPrimary].join(" ")}
                onClick={() => {
                  setPrefs(draftPrefs);
                  setPropsOpen(false);
                  focusTerminal();
                }}
              >
                OK
              </button>
              <button
                type="button"
                className={styles.winBtn}
                onClick={() => {
                  setPropsOpen(false);
                  focusTerminal();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
