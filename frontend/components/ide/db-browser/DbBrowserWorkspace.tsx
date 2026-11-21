"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReportCapture, type SqlReportFrame } from "@/lib/ide/reportCapture";
import {
  applyPragmaUpdate,
  createInitialDatabaseState,
  deleteTableRow,
  executeSqlBatch,
  exportDatabaseToSql,
  exportResultToCsv,
  insertBlankRecord,
  revertChanges,
  splitSqlStatements,
  updateTableCell,
  writeChanges,
  type BatchExecutionResult,
  type DatabaseState,
  type PragmaState,
  type SqlValue,
} from "@/lib/ide/sqliteEngine";
import { loadRealSqlite } from "@/lib/ide/sqliteReal";
import { BottomDocks, type BottomDockTabId } from "./BottomDocks";
import { BrowseDataTab } from "./BrowseDataTab";
import { DatabaseStructureTab } from "./DatabaseStructureTab";
import { DbBrowserDialogs, type ActiveModalType } from "./DbBrowserDialogs";
import {
  AttachDatabaseIcon,
  Db4sAppIcon,
  ExecuteCurrentLineIcon,
  ExecuteSqlIcon,
  ExportResultsIcon,
  FindBinocularsIcon,
  NewDatabaseIcon,
  OpenDatabaseIcon,
  OpenProjectIcon,
  OpenSqlIcon,
  PrintIcon,
  RevertChangesIcon,
  SaveProjectIcon,
  SaveSqlAsIcon,
  SaveSqlIcon,
  SqlTabHourglassIcon,
  StopExecutionIcon,
  TabCloseSquareIcon,
  WriteChangesIcon,
} from "./DbBrowserIcons";
import { EditCellDock } from "./EditCellDock";
import { EditPragmasTab } from "./EditPragmasTab";
import { ResultsGrid, type SelectedGridCell } from "./ResultsGrid";
import { SqlEditor } from "./SqlEditor";
import styles from "./db-browser.module.css";

type MainWorkspaceTab = "Database Structure" | "Browse Data" | "Edit Pragmas" | "Execute SQL";

interface SqlQueryTab {
  id: string;
  title: string;
  sql: string;
  hasExecuted: boolean;
  statusText: string;
  statusIsError: boolean;
  columns: string[];
  rows: SqlValue[][];
  editableTable?: string;
  sourceRowIndices?: number[];
  realCells?: boolean[][];
}

const INITIAL_SQL = "select * from shipper;";

function buildInitialSqlTab(state: DatabaseState): SqlQueryTab {
  const { batch } = executeSqlBatch(state, INITIAL_SQL, "User");
  const q = batch.lastQueryResult;
  return {
    id: "sql-tab-1",
    title: "SQL 1",
    sql: INITIAL_SQL,
    hasExecuted: false,
    statusText: "",
    statusIsError: false,
    columns: q ? q.columns : [],
    rows: q ? q.rows : [],
    realCells: q?.realCells,
    editableTable: q?.editableTable,
    sourceRowIndices: q?.sourceRowIndices,
  };
}

function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DbBrowserWorkspace({ reportCapture = false }: { reportCapture?: boolean } = {}) {
  const [dbState, setDbState] = useState<DatabaseState>(() =>
    reportCapture ? createInitialDatabaseState("blank", ":memory:") : createInitialDatabaseState("northwind"));
  // Statements run on the real SQLite engine (WebAssembly); until it has loaded, or if it cannot load, the built-in interpreter answers.
  useEffect(() => {
    if (!reportCapture) void loadRealSqlite();
  }, [reportCapture]);
  const [mainTab, setMainTab] = useState<MainWorkspaceTab>("Execute SQL");
  const [browseTable, setBrowseTable] = useState<string>("Shipper");

  const [sqlTabs, setSqlTabs] = useState<SqlQueryTab[]>(() => [
    buildInitialSqlTab(createInitialDatabaseState(reportCapture ? "blank" : "northwind")),
  ]);
  const [activeSqlTabId, setActiveSqlTabId] = useState<string>("sql-tab-1");
  const nextSqlTabNumRef = useRef<number>(2);

  const [selectedCell, setSelectedCell] = useState<SelectedGridCell | null>(null);
  const [activeLine, setActiveLine] = useState<number>(1);
  const [firstReportLine, setFirstReportLine] = useState(1);
  const [cursorOffset, setCursorOffset] = useState<number>(INITIAL_SQL.length);

  const [bottomDockTab, setBottomDockTab] = useState<BottomDockTabId>("DB Schema");
  const [showEditCellDock, setShowEditCellDock] = useState<boolean>(true);
  const [showBottomDock, setShowBottomDock] = useState<boolean>(true);

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showOpenDbMenu, setShowOpenDbMenu] = useState<boolean>(false);
  const [modal, setModal] = useState<ActiveModalType>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isMaximized, setIsMaximized] = useState<boolean>(true);

  const [showFindBar, setShowFindBar] = useState<boolean>(false);
  const [findText, setFindText] = useState<string>("");
  const [replaceText, setReplaceText] = useState<string>("");

  // Layout percentages
  const [leftPanePct, setLeftPanePct] = useState<number>(37.5);
  const [sqlEditorPct, setSqlEditorPct] = useState<number>(40);
  const [sqlStatusHeight, setSqlStatusHeight] = useState<number>(54);
  const [editCellDockPct, setEditCellDockPct] = useState<number>(38);

  useReportCapture<SqlReportFrame>(reportCapture, ({ filename, code, columns, rows, status, failed, activeLine, firstLine }) => {
    setShowBottomDock(false);
    setShowEditCellDock(false);
    setSqlEditorPct(columns.length ? 50 : 70);
    setActiveLine(activeLine);
    setFirstReportLine(firstLine);
    setSqlTabs([{ id: "sql-tab-1", title: filename, sql: code, hasExecuted: true,
      statusText: status, statusIsError: failed, columns, rows }]);
  });

  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const leftSplitRef = useRef<HTMLDivElement | null>(null);
  const rightPaneRef = useRef<HTMLDivElement | null>(null);
  const mainTabListRef = useRef<HTMLDivElement | null>(null);
  const openSqlInputRef = useRef<HTMLInputElement | null>(null);
  const openProjectInputRef = useRef<HTMLInputElement | null>(null);

  const activeSqlTab = useMemo(
    () => sqlTabs.find((t) => t.id === activeSqlTabId) || sqlTabs[0],
    [activeSqlTabId, sqlTabs]
  );

  // Close menus on outside click
  useEffect(() => {
    const handleOutside = () => {
      setOpenMenu(null);
      setShowOpenDbMenu(false);
    };
    window.addEventListener("click", handleOutside);
    return () => window.removeEventListener("click", handleOutside);
  }, []);

  // Ensure active main tab (e.g. Execute SQL on narrow viewports) stays scrolled into view
  useEffect(() => {
    const list = mainTabListRef.current;
    if (!list) return;
    if (mainTab === "Execute SQL") {
      list.scrollLeft = list.scrollWidth;
    } else if (mainTab === "Database Structure") {
      list.scrollLeft = 0;
    }
  }, [mainTab, leftPanePct]);

  const flashStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
  }, []);

  const updateActiveSqlTab = useCallback(
    (updater: (tab: SqlQueryTab) => SqlQueryTab) => {
      setSqlTabs((prev) =>
        prev.map((t) => (t.id === activeSqlTabId ? updater(t) : t))
      );
    },
    [activeSqlTabId]
  );

  const runSqlScript = useCallback(
    (script: string, targetTabId?: string) => {
      const tabId = targetTabId || activeSqlTabId;
      const { nextState, batch }: { nextState: DatabaseState; batch: BatchExecutionResult } =
        executeSqlBatch(dbState, script, "User");
      setDbState(nextState);

      const q = batch.lastQueryResult;
      setSqlTabs((prev) =>
        prev.map((t) => {
          if (t.id !== tabId) return t;
          return {
            ...t,
            hasExecuted: true,
            statusText: batch.summaryText,
            statusIsError: !batch.ok,
            columns: q ? q.columns : batch.ok ? t.columns : [],
            rows: q ? q.rows : batch.ok ? t.rows : [],
            realCells: q ? q.realCells : batch.ok ? t.realCells : undefined,
            editableTable: q?.editableTable,
            sourceRowIndices: q?.sourceRowIndices,
          };
        })
      );
      if (q) {
        setSelectedCell(null);
      }
      flashStatus(
        batch.ok
          ? "Executed in " + batch.totalElapsedMs + "ms"
          : "SQL error on execution"
      );
    },
    [activeSqlTabId, dbState, flashStatus]
  );

  const handleExecuteAll = useCallback(() => {
    if (!activeSqlTab) return;
    runSqlScript(activeSqlTab.sql);
  }, [activeSqlTab, runSqlScript]);

  const handleExecuteCurrentLine = useCallback(
    (cursorOffset: number) => {
      if (!activeSqlTab) return;
      const before = activeSqlTab.sql.slice(0, cursorOffset);
      const currentLineNum = before.split("\n").length;
      const stmts = splitSqlStatements(activeSqlTab.sql);
      if (stmts.length === 0) return;
      let chosen = stmts[0];
      for (let i = 0; i < stmts.length; i++) {
        if (stmts[i].startLine <= currentLineNum) {
          chosen = stmts[i];
        }
      }
      runSqlScript(chosen.sql);
    },
    [activeSqlTab, runSqlScript]
  );

  const handleAddSqlTab = useCallback(() => {
    const num = nextSqlTabNumRef.current++;
    const newTab: SqlQueryTab = {
      id: "sql-tab-" + num,
      title: "SQL " + num,
      sql: "",
      hasExecuted: false,
      statusText: "",
      statusIsError: false,
      columns: [],
      rows: [],
    };
    setSqlTabs((prev) => prev.concat([newTab]));
    setActiveSqlTabId(newTab.id);
    setMainTab("Execute SQL");
  }, []);

  const handleCloseSqlTab = useCallback(
    (id: string) => {
      setSqlTabs((prev) => {
        if (prev.length <= 1) {
          const reset: SqlQueryTab = {
            id: "sql-tab-reset-" + Date.now(),
            title: "SQL 1",
            sql: "",
            hasExecuted: false,
            statusText: "",
            statusIsError: false,
            columns: [],
            rows: [],
          };
          setActiveSqlTabId(reset.id);
          return [reset];
        }
        const idx = prev.findIndex((t) => t.id === id);
        const nextList = prev.filter((t) => t.id !== id);
        if (id === activeSqlTabId) {
          const fallback = nextList[Math.max(0, idx - 1)] || nextList[0];
          setActiveSqlTabId(fallback.id);
        }
        return nextList;
      });
    },
    [activeSqlTabId]
  );

  const handleApplyCellEdit = useCallback(
    (cell: SelectedGridCell, newValue: SqlValue) => {
      if (!cell.tableName || cell.sourceRowIndex === undefined || cell.sourceRowIndex < 0) {
        return;
      }
      const next = updateTableCell(
        dbState,
        cell.tableName,
        cell.sourceRowIndex,
        cell.columnName,
        newValue
      );
      setDbState(next);
      setSelectedCell({ ...cell, value: newValue });

      // Refresh current SQL result grid row if displaying this table
      setSqlTabs((prev) =>
        prev.map((tab) => {
          if (
            tab.editableTable === cell.tableName &&
            tab.sourceRowIndices &&
            tab.rows[cell.rowIdx]
          ) {
            const nextRows = tab.rows.map((r, ri) =>
              ri === cell.rowIdx
                ? r.map((v, ci) => (ci === cell.colIdx ? newValue : v))
                : r
            );
            return { ...tab, rows: nextRows };
          }
          return tab;
        })
      );
      flashStatus("Updated " + cell.tableName + "." + cell.columnName);
    },
    [dbState, flashStatus]
  );

  const handleWriteChanges = useCallback(() => {
    if (!dbState.dirty) {
      flashStatus("No pending changes to write");
      return;
    }
    setDbState((prev) => writeChanges(prev));
    flashStatus("Changes written to " + dbState.working.dbName);
  }, [dbState.dirty, dbState.working.dbName, flashStatus]);

  const handleRevertChanges = useCallback(() => {
    if (!dbState.dirty) {
      flashStatus("No pending changes to revert");
      return;
    }
    const reverted = revertChanges(dbState);
    setDbState(reverted);
    setSelectedCell(null);
    if (activeSqlTab && activeSqlTab.sql.trim().length > 0) {
      const { batch } = executeSqlBatch(reverted, activeSqlTab.sql, "DB Browser");
      if (batch.lastQueryResult) {
        const q = batch.lastQueryResult;
        updateActiveSqlTab((t) => ({
          ...t,
          columns: q.columns,
          rows: q.rows,
          realCells: q.realCells,
          editableTable: q.editableTable,
          sourceRowIndices: q.sourceRowIndices,
        }));
      }
    }
    flashStatus("Reverted uncommitted changes");
  }, [activeSqlTab, dbState, flashStatus, updateActiveSqlTab]);

  const handleSwitchPresetDb = useCallback(
    (preset: "northwind" | "university" | "blank", customPath?: string) => {
      const nextDb = createInitialDatabaseState(preset, customPath);
      setDbState(nextDb);
      setSelectedCell(null);
      const firstTbl = nextDb.working.tableOrder[0] || "";
      setBrowseTable(preset === "northwind" ? "Shipper" : firstTbl);
      if (preset === "northwind") {
        setSqlTabs([buildInitialSqlTab(nextDb)]);
        setActiveSqlTabId("sql-tab-1");
      } else if (preset === "university") {
        const q = executeSqlBatch(nextDb, "SELECT * FROM students;", "DB Browser");
        const r = q.batch.lastQueryResult;
        setSqlTabs([
          {
            id: "sql-tab-1",
            title: "SQL 1",
            sql: "SELECT * FROM students;",
            hasExecuted: true,
            statusText: q.batch.summaryText,
            statusIsError: false,
            columns: r ? r.columns : [],
            rows: r ? r.rows : [],
            realCells: r?.realCells,
            editableTable: r?.editableTable,
            sourceRowIndices: r?.sourceRowIndices,
          },
        ]);
        setActiveSqlTabId("sql-tab-1");
      } else {
        setSqlTabs([
          {
            id: "sql-tab-1",
            title: "SQL 1",
            sql: "-- Create a table or run SQL here\n",
            hasExecuted: false,
            statusText: "",
            statusIsError: false,
            columns: [],
            rows: [],
          },
        ]);
        setActiveSqlTabId("sql-tab-1");
      }
      flashStatus("Opened " + nextDb.working.dbName);
    },
    [flashStatus]
  );

  const handleSaveProject = useCallback(() => {
    const project = {
      version: 1,
      dbState,
      sqlTabs,
      activeSqlTabId,
      browseTable,
    };
    const json = JSON.stringify(project, null, 2);
    try {
      localStorage.setItem("db4s_saved_project", json);
    } catch {
      // ignore storage quota errors
    }
    downloadTextFile(dbState.working.dbName.replace(/\.db$/i, "") + ".sqbpro.json", json, "application/json");
    flashStatus("Project saved");
  }, [activeSqlTabId, browseTable, dbState, flashStatus, sqlTabs]);

  const handleApplyAllPragmas = useCallback(
    (nextPragmas: PragmaState) => {
      let next = dbState;
      const keys = Object.keys(nextPragmas) as (keyof PragmaState)[];
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (nextPragmas[k] !== dbState.working.pragmas[k]) {
          next = applyPragmaUpdate(next, k, nextPragmas[k]);
        }
      }
      setDbState(next);
      flashStatus("PRAGMA settings updated (Write Changes to commit)");
    },
    [dbState, flashStatus]
  );

  // Splitter drag handlers
  const startVerticalDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = workspaceRef.current;
    if (!container) return;
    const onMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPanePct(Math.max(24, Math.min(68, pct)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startSqlHorizontalDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = leftSplitRef.current;
    if (!container) return;
    const onMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const pct = ((ev.clientY - rect.top) / rect.height) * 100;
      setSqlEditorPct(Math.max(18, Math.min(72, pct)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startSqlStatusDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = sqlStatusHeight;
    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      setSqlStatusHeight(Math.max(36, Math.min(220, startH + delta)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startRightDockDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = rightPaneRef.current;
    if (!container) return;
    const onMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const pct = ((ev.clientY - rect.top) / rect.height) * 100;
      setEditCellDockPct(Math.max(20, Math.min(70, pct)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const scrollMainTabs = (delta: number) => {
    if (mainTabListRef.current) {
      mainTabListRef.current.scrollLeft += delta;
    }
  };

  const plotColumns = useMemo(() => {
    if (mainTab === "Browse Data" && dbState.working.tables[browseTable]) {
      return dbState.working.tables[browseTable].columns.map((c) => c.name);
    }
    return activeSqlTab?.columns || [];
  }, [activeSqlTab?.columns, browseTable, dbState.working.tables, mainTab]);

  const plotRows = useMemo(() => {
    if (mainTab === "Browse Data" && dbState.working.tables[browseTable]) {
      const tbl = dbState.working.tables[browseTable];
      return tbl.rows.map((r) => tbl.columns.map((c) => r[c.name] ?? null));
    }
    return activeSqlTab?.rows || [];
  }, [activeSqlTab?.rows, browseTable, dbState.working.tables, mainTab]);

  return (
    <div className={styles.dbRoot}>
      {/* Hidden File Inputs */}
      <input
        ref={openSqlInputRef}
        type="file"
        accept=".sql,.txt"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => {
            const content = String(reader.result || "");
            updateActiveSqlTab((t) => ({ ...t, sql: content, title: f.name }));
            flashStatus("Loaded SQL file " + f.name);
          };
          reader.readAsText(f);
        }}
      />
      <input
        ref={openProjectInputRef}
        type="file"
        accept=".json,.sqbpro"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const parsed = JSON.parse(String(reader.result || "{}"));
              if (parsed.dbState) setDbState(parsed.dbState);
              if (Array.isArray(parsed.sqlTabs) && parsed.sqlTabs.length > 0) {
                setSqlTabs(parsed.sqlTabs);
                setActiveSqlTabId(parsed.activeSqlTabId || parsed.sqlTabs[0].id);
              }
              flashStatus("Opened project " + f.name);
            } catch {
              flashStatus("Invalid project file");
            }
          };
          reader.readAsText(f);
        }}
      />

      {/* Windows 10 Classic Title Bar */}
      <div className={styles.titleBar}>
        <div className={styles.titleLeft}>
          <Db4sAppIcon size={16} />
          <span className={styles.titleText}>
            DB Browser for SQLite - {dbState.working.dbPath}
            {dbState.dirty ? " *" : ""}
          </span>
        </div>
        <div className={styles.windowControls}>
          <button
            type="button"
            className={styles.winBtn}
            title="Minimize"
            aria-label="Minimize window"
            onClick={() => flashStatus("Window minimized to workspace tray")}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M1 5.5H9" stroke="#000000" strokeWidth="1" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.winBtn}
            title={isMaximized ? "Restore Down" : "Maximize"}
            aria-label="Maximize window"
            onClick={() => {
              setIsMaximized((m) => !m);
              if (typeof document !== "undefined" && document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
              } else if (typeof document !== "undefined" && document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
              }
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="1.5" y="1.5" width="7" height="7" stroke="#000000" strokeWidth="1" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.winBtn + " " + styles.winBtnClose}
            title="Close"
            aria-label="Close window"
            onClick={() => {
              if (dbState.dirty) {
                flashStatus("Unsaved changes present — click Write Changes or Revert Changes");
              } else {
                flashStatus("Ready");
              }
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="#000000" strokeWidth="1.1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Menu Bar */}
      <div className={styles.menuBar} onClick={(e) => e.stopPropagation()}>
        <div className={styles.menuItemWrap}>
          <button
            type="button"
            className={styles.menuItemBtn + (openMenu === "File" ? " " + styles.menuItemBtnActive : "")}
            onClick={() => setOpenMenu(openMenu === "File" ? null : "File")}
          >
            <u>F</u>ile
          </button>
          {openMenu === "File" && (
            <div className={styles.menuDropdown}>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  setModal("newDatabase");
                }}
              >
                <span>New Database...</span>
                <span className={styles.menuShortcut}>Ctrl+N</span>
              </button>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  setModal("openDatabase");
                }}
              >
                <span>Open Database...</span>
                <span className={styles.menuShortcut}>Ctrl+O</span>
              </button>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  setModal("attachDatabase");
                }}
              >
                <span>Attach Database...</span>
              </button>
              <div className={styles.menuSeparator} />
              <button
                type="button"
                className={styles.menuDropdownItem}
                disabled={!dbState.dirty}
                onClick={() => {
                  setOpenMenu(null);
                  handleWriteChanges();
                }}
              >
                <span>Write Changes</span>
                <span className={styles.menuShortcut}>Ctrl+S</span>
              </button>
              <button
                type="button"
                className={styles.menuDropdownItem}
                disabled={!dbState.dirty}
                onClick={() => {
                  setOpenMenu(null);
                  handleRevertChanges();
                }}
              >
                <span>Revert Changes</span>
              </button>
              <div className={styles.menuSeparator} />
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  openSqlInputRef.current?.click();
                }}
              >
                <span>Open SQL File...</span>
              </button>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  downloadTextFile(
                    dbState.working.dbName.replace(/\.db$/i, "") + ".sql",
                    exportDatabaseToSql(dbState.working)
                  );
                  flashStatus("Exported database SQL dump");
                }}
              >
                <span>Export Database to SQL file...</span>
              </button>
              <button
                type="button"
                className={styles.menuDropdownItem}
                disabled={!activeSqlTab || activeSqlTab.columns.length === 0}
                onClick={() => {
                  setOpenMenu(null);
                  if (activeSqlTab) {
                    downloadTextFile(
                      "query_results.csv",
                      exportResultToCsv(activeSqlTab.columns, activeSqlTab.rows),
                      "text/csv;charset=utf-8"
                    );
                  }
                }}
              >
                <span>Export Results to CSV...</span>
              </button>
              <div className={styles.menuSeparator} />
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  openProjectInputRef.current?.click();
                }}
              >
                <span>Open Project...</span>
              </button>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  handleSaveProject();
                }}
              >
                <span>Save Project</span>
              </button>
            </div>
          )}
        </div>

        <div className={styles.menuItemWrap}>
          <button
            type="button"
            className={styles.menuItemBtn + (openMenu === "Edit" ? " " + styles.menuItemBtnActive : "")}
            onClick={() => setOpenMenu(openMenu === "Edit" ? null : "Edit")}
          >
            <u>E</u>dit
          </button>
          {openMenu === "Edit" && (
            <div className={styles.menuDropdown}>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  setModal("createTable");
                }}
              >
                <span>Create Table...</span>
              </button>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  setShowFindBar(true);
                  setMainTab("Execute SQL");
                }}
              >
                <span>Find &amp; Replace...</span>
                <span className={styles.menuShortcut}>Ctrl+F</span>
              </button>
              <div className={styles.menuSeparator} />
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  setModal("preferences");
                }}
              >
                <span>Preferences...</span>
              </button>
            </div>
          )}
        </div>

        <div className={styles.menuItemWrap}>
          <button
            type="button"
            className={styles.menuItemBtn + (openMenu === "View" ? " " + styles.menuItemBtnActive : "")}
            onClick={() => setOpenMenu(openMenu === "View" ? null : "View")}
          >
            <u>V</u>iew
          </button>
          {openMenu === "View" && (
            <div className={styles.menuDropdown}>
              {(["Database Structure", "Browse Data", "Edit Pragmas", "Execute SQL"] as MainWorkspaceTab[]).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    className={styles.menuDropdownItem}
                    onClick={() => {
                      setOpenMenu(null);
                      setMainTab(t);
                    }}
                  >
                    {mainTab === t && <span className={styles.menuCheck}>✓</span>}
                    <span>{t}</span>
                  </button>
                )
              )}
              <div className={styles.menuSeparator} />
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  setShowEditCellDock((s) => !s);
                }}
              >
                {showEditCellDock && <span className={styles.menuCheck}>✓</span>}
                <span>Edit Database Cell</span>
              </button>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  setShowBottomDock((s) => !s);
                }}
              >
                {showBottomDock && <span className={styles.menuCheck}>✓</span>}
                <span>DB Schema / Bottom Dock</span>
              </button>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  setShowBottomDock(true);
                  setBottomDockTab("SQL Log");
                }}
              >
                <span>SQL Log</span>
              </button>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  setShowBottomDock(true);
                  setBottomDockTab("Plot");
                }}
              >
                <span>Plot</span>
              </button>
            </div>
          )}
        </div>

        <div className={styles.menuItemWrap}>
          <button
            type="button"
            className={styles.menuItemBtn + (openMenu === "Tools" ? " " + styles.menuItemBtnActive : "")}
            onClick={() => setOpenMenu(openMenu === "Tools" ? null : "Tools")}
          >
            <u>T</u>ools
          </button>
          {openMenu === "Tools" && (
            <div className={styles.menuDropdown}>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  setMainTab("Execute SQL");
                  handleExecuteAll();
                }}
              >
                <span>Execute All SQL</span>
                <span className={styles.menuShortcut}>F5</span>
              </button>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  runSqlScript("VACUUM;");
                }}
              >
                <span>Compact Database (VACUUM)</span>
              </button>
            </div>
          )}
        </div>

        <div className={styles.menuItemWrap}>
          <button
            type="button"
            className={styles.menuItemBtn + (openMenu === "Help" ? " " + styles.menuItemBtnActive : "")}
            onClick={() => setOpenMenu(openMenu === "Help" ? null : "Help")}
          >
            <u>H</u>elp
          </button>
          {openMenu === "Help" && (
            <div className={styles.menuDropdown}>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  setMainTab("Execute SQL");
                  updateActiveSqlTab((t) => ({
                    ...t,
                    sql: "-- Northwind Sample Queries\nSELECT p.productName, c.categoryName, p.unitPrice\nFROM Product p\nJOIN Category c ON p.categoryId = c.categoryId\nORDER BY p.unitPrice DESC\nLIMIT 10;",
                  }));
                }}
              >
                <span>Load Sample JOIN Query</span>
              </button>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  setModal("about");
                }}
              >
                <span>About DB Browser for SQLite...</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Icon Toolbar */}
      <div className={styles.mainToolbar} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.toolBtn}
          title="Create a new database file"
          onClick={() => setModal("newDatabase")}
        >
          <NewDatabaseIcon size={17} />
          <span>New Database</span>
        </button>

        <div style={{ position: "relative", display: "inline-flex" }}>
          <button
            type="button"
            className={styles.toolBtn}
            title="Open an existing database file"
            onClick={() => setModal("openDatabase")}
          >
            <OpenDatabaseIcon size={17} />
            <span>Open Database</span>
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            style={{ padding: "2px 3px" }}
            aria-label="Open Database Options"
            onClick={() => setShowOpenDbMenu((s) => !s)}
          >
            <span className={styles.toolDropdownArrow}>▾</span>
          </button>
          {showOpenDbMenu && (
            <div className={styles.menuDropdown} style={{ top: 25, left: 0 }}>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setShowOpenDbMenu(false);
                  handleSwitchPresetDb("northwind");
                }}
              >
                <span>D:\BD\SQLite\northwind.db</span>
              </button>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setShowOpenDbMenu(false);
                  handleSwitchPresetDb("university");
                }}
              >
                <span>D:\BD\SQLite\university.db</span>
              </button>
              <div className={styles.menuSeparator} />
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  setShowOpenDbMenu(false);
                  setModal("openDatabase");
                }}
              >
                <span>Browse / Import SQL...</span>
              </button>
            </div>
          )}
        </div>

        <div className={styles.toolSep} />

        <button
          type="button"
          className={styles.toolBtn}
          title="Write changes to the database file"
          onClick={handleWriteChanges}
        >
          <WriteChangesIcon size={17} />
          <span>Write Changes</span>
          {dbState.dirty && <span className={styles.toolBtnDirtyDot} title="Uncommitted changes" />}
        </button>

        <button
          type="button"
          className={styles.toolBtn}
          title="Revert database to last saved state"
          onClick={handleRevertChanges}
        >
          <RevertChangesIcon size={17} />
          <span>Revert Changes</span>
        </button>

        <div className={styles.toolSep} />

        <button
          type="button"
          className={styles.toolBtn}
          title="Load a working session from a file"
          onClick={() => openProjectInputRef.current?.click()}
        >
          <OpenProjectIcon size={17} />
          <span>Open Project</span>
        </button>

        <button
          type="button"
          className={styles.toolBtn}
          title="Save the current session to a file"
          onClick={handleSaveProject}
        >
          <SaveProjectIcon size={17} />
          <span>Save Project</span>
        </button>

        <div className={styles.toolSep} />

        <button
          type="button"
          className={
            styles.toolBtn +
            (dbState.attachedDatabases.length === 0 ? " " + styles.toolBtnMuted : "")
          }
          title="Add another database file to the current database connection"
          onClick={() => setModal("attachDatabase")}
        >
          <AttachDatabaseIcon size={17} />
          <span>Attach Database</span>
        </button>

        <span className={styles.toolOverflowChevrons} aria-hidden="true">»</span>
      </div>

      {/* Main Split Workspace */}
      <div className={styles.workspace} ref={workspaceRef}>
        {/* Left Main Workspace */}
        <div
          className={styles.leftPane}
          style={{
            width: showEditCellDock || showBottomDock ? leftPanePct + "%" : "100%",
          }}
        >
          <div className={styles.mainTabBar}>
            <div className={styles.mainTabScrollList} ref={mainTabListRef} role="tablist">
              {(["Database Structure", "Browse Data", "Edit Pragmas", "Execute SQL"] as MainWorkspaceTab[]).map(
                (tab) => {
                  const active = mainTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={
                        styles.mainTabBtn + (active ? " " + styles.mainTabBtnActive : "")
                      }
                      onClick={() => setMainTab(tab)}
                    >
                      {tab}
                    </button>
                  );
                }
              )}
            </div>
            <div className={styles.tabScrollControls}>
              <button
                type="button"
                className={styles.tabScrollBtn}
                title="Scroll tabs left"
                aria-label="Scroll tabs left"
                onClick={() => scrollMainTabs(-70)}
              >
                ◂
              </button>
              <button
                type="button"
                className={styles.tabScrollBtn}
                title="Scroll tabs right"
                aria-label="Scroll tabs right"
                onClick={() => scrollMainTabs(70)}
              >
                ▸
              </button>
            </div>
          </div>

          <div className={styles.mainTabBody}>
            {mainTab === "Database Structure" && (
              <DatabaseStructureTab
                snapshot={dbState.working}
                onOpenCreateTable={() => setModal("createTable")}
                onBrowseTable={(tbl) => {
                  setBrowseTable(tbl);
                  setMainTab("Browse Data");
                }}
                onRunSql={(sql) => {
                  setMainTab("Execute SQL");
                  updateActiveSqlTab((t) => ({ ...t, sql }));
                  runSqlScript(sql);
                }}
                onDeleteObject={(kind, name) => {
                  if (kind === "table") runSqlScript("DROP TABLE " + name + ";");
                  else if (kind === "index") runSqlScript("DROP INDEX " + name + ";");
                  else runSqlScript("DROP VIEW " + name + ";");
                }}
              />
            )}

            {mainTab === "Browse Data" && (
              <BrowseDataTab
                snapshot={dbState.working}
                activeTable={browseTable}
                onChangeTable={setBrowseTable}
                selectedCell={selectedCell}
                onSelectCell={(cell) => {
                  setSelectedCell(cell);
                  setShowEditCellDock(true);
                }}
                onNewRecord={(tbl) => {
                  setDbState((prev) => insertBlankRecord(prev, tbl));
                  flashStatus("Inserted new record into " + tbl);
                }}
                onDeleteRecord={(tbl, rowIdx) => {
                  setDbState((prev) => deleteTableRow(prev, tbl, rowIdx));
                  setSelectedCell(null);
                  flashStatus("Deleted row from " + tbl);
                }}
                onExportCsv={(cols, rows, filename) => {
                  downloadTextFile(filename, exportResultToCsv(cols, rows), "text/csv;charset=utf-8");
                  flashStatus("Exported " + filename);
                }}
              />
            )}

            {mainTab === "Edit Pragmas" && (
              <EditPragmasTab
                pragmas={dbState.working.pragmas}
                onApplyAllPragmas={handleApplyAllPragmas}
              />
            )}

            {mainTab === "Execute SQL" && activeSqlTab && (
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                {/* Execute SQL Mini Icon Strip */}
                <div className={styles.sqlMiniToolbar}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    title="Open SQL file"
                    aria-label="Open SQL file"
                    onClick={() => openSqlInputRef.current?.click()}
                  >
                    <OpenSqlIcon size={16} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    title="Save SQL file"
                    aria-label="Save SQL file"
                    onClick={() => {
                      downloadTextFile(
                        activeSqlTab.title.replace(/\s+/g, "_") + ".sql",
                        activeSqlTab.sql
                      );
                      flashStatus("Saved SQL script");
                    }}
                  >
                    <SaveSqlIcon size={16} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    title="Save SQL file as..."
                    aria-label="Save SQL file as"
                    onClick={() => {
                      downloadTextFile("query_" + Date.now() + ".sql", activeSqlTab.sql);
                      flashStatus("Saved SQL script copy");
                    }}
                  >
                    <SaveSqlAsIcon size={16} />
                    <span className={styles.toolDropdownArrow}>▾</span>
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    title="Print SQL"
                    aria-label="Print SQL"
                    onClick={() => window.print()}
                  >
                    <PrintIcon size={16} />
                  </button>

                  <div className={styles.toolSep} style={{ height: 18 }} />

                  <button
                    type="button"
                    className={styles.iconBtn}
                    title="Execute all/selected SQL"
                    aria-label="Execute all/selected SQL"
                    onClick={handleExecuteAll}
                  >
                    <ExecuteSqlIcon size={16} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    title="Execute current line"
                    aria-label="Execute current line"
                    onClick={() => handleExecuteCurrentLine(cursorOffset)}
                  >
                    <ExecuteCurrentLineIcon size={16} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    title="Stop the currently running SQL script"
                    aria-label="Stop the currently running SQL script"
                    onClick={() => {
                      updateActiveSqlTab((t) => ({
                        ...t,
                        hasExecuted: false,
                        statusText: "",
                        statusIsError: false,
                      }));
                      flashStatus("Execution stopped / status cleared");
                    }}
                  >
                    <StopExecutionIcon size={16} />
                  </button>

                  <button
                    type="button"
                    className={styles.iconBtn}
                    title="Export results as CSV"
                    aria-label="Export results as CSV"
                    onClick={() => {
                      if (activeSqlTab.columns.length > 0) {
                        downloadTextFile(
                          "results.csv",
                          exportResultToCsv(activeSqlTab.columns, activeSqlTab.rows),
                          "text/csv;charset=utf-8"
                        );
                        flashStatus("Exported query results to CSV");
                      }
                    }}
                  >
                    <ExportResultsIcon size={16} />
                    <span className={styles.toolDropdownArrow}>▾</span>
                  </button>

                  <button
                    type="button"
                    className={styles.iconBtn + (showFindBar ? " " + styles.iconBtnActive : "")}
                    title="Find & Replace (Ctrl+F)"
                    aria-label="Find and Replace"
                    onClick={() => setShowFindBar((f) => !f)}
                  >
                    <FindBinocularsIcon size={16} />
                  </button>

                  <span className={styles.toolOverflowChevrons} aria-hidden="true">»</span>
                </div>

                {/* Query Sub-Tabs */}
                <div className={styles.sqlSubTabRow}>
                  {sqlTabs.map((tab) => {
                    const isActive = tab.id === activeSqlTab.id;
                    return (
                      <div
                        key={tab.id}
                        className={
                          styles.sqlSubTab + (isActive ? " " + styles.sqlSubTabActive : "")
                        }
                        onClick={() => setActiveSqlTabId(tab.id)}
                      >
                        <SqlTabHourglassIcon size={13} />
                        <span>{tab.title}</span>
                        <button
                          type="button"
                          className={styles.sqlSubTabCloseBtn}
                          title={"Close " + tab.title}
                          aria-label={"Close " + tab.title}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseSqlTab(tab.id);
                          }}
                        >
                          <TabCloseSquareIcon size={11} />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className={styles.sqlAddTabBtn}
                    title="Open a new SQL tab"
                    aria-label="New SQL Tab"
                    onClick={handleAddSqlTab}
                  >
                    +
                  </button>
                </div>

                {/* Optional Find & Replace Bar */}
                {showFindBar && (
                  <div className={styles.findBar}>
                    <input
                      type="text"
                      className={styles.winInput}
                      placeholder="Find..."
                      value={findText}
                      onChange={(e) => setFindText(e.target.value)}
                      style={{ width: 110 }}
                    />
                    <input
                      type="text"
                      className={styles.winInput}
                      placeholder="Replace..."
                      value={replaceText}
                      onChange={(e) => setReplaceText(e.target.value)}
                      style={{ width: 100 }}
                    />
                    <button
                      type="button"
                      className={styles.winButton}
                      style={{ minWidth: 66 }}
                      onClick={() => {
                        if (!findText) return;
                        const nextSql = activeSqlTab.sql.split(findText).join(replaceText);
                        updateActiveSqlTab((t) => ({ ...t, sql: nextSql }));
                        flashStatus("Replaced all occurrences");
                      }}
                    >
                      Replace All
                    </button>
                    <button
                      type="button"
                      className={styles.winButton}
                      style={{ minWidth: 26, padding: "0 6px" }}
                      onClick={() => setShowFindBar(false)}
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* SQL Editor + Results Grid + Execution Status Split */}
                <div className={styles.sqlSplitContainer} ref={leftSplitRef}>
                  <SqlEditor
                    value={activeSqlTab.sql}
                    onChange={(nextSql) => updateActiveSqlTab((t) => ({ ...t, sql: nextSql }))}
                    onExecuteAll={handleExecuteAll}
                    onExecuteCurrentLine={handleExecuteCurrentLine}
                    onToggleFind={() => setShowFindBar((f) => !f)}
                    onCursorChange={(line, _col, offset) => {
                      setActiveLine(line);
                      setCursorOffset(offset);
                    }}
                    activeLine={activeLine}
                    lineNumberStart={firstReportLine}
                    heightStyle={{ flex: "0 0 " + sqlEditorPct + "%" }}
                  />

                  <div
                    className={styles.hSplitter}
                    onMouseDown={startSqlHorizontalDrag}
                    title="Drag to resize editor and grid"
                  />

                  <ResultsGrid
                    columns={activeSqlTab.columns}
                    rows={activeSqlTab.rows}
                    realCells={activeSqlTab.realCells}
                    selectedCell={
                      selectedCell && selectedCell.origin === "sql"
                        ? selectedCell
                        : null
                    }
                    defaultBoldHeader={
                      activeSqlTab.columns.length >= 2 ? { rowIdx: 0, colIdx: 1 } : null
                    }
                    onSelectCell={(rowIdx, colIdx) => {
                      const colName = activeSqlTab.columns[colIdx];
                      const val = activeSqlTab.rows[rowIdx][colIdx];
                      const sourceRowIndex =
                        activeSqlTab.sourceRowIndices &&
                        activeSqlTab.sourceRowIndices[rowIdx] !== undefined
                          ? activeSqlTab.sourceRowIndices[rowIdx]
                          : undefined;
                      const tbl = activeSqlTab.editableTable
                        ? dbState.working.tables[activeSqlTab.editableTable]
                        : undefined;
                      const isRealCol = Boolean(
                        tbl &&
                          tbl.columns.some(
                            (c) => c.name.toLowerCase() === colName.toLowerCase()
                          )
                      );
                      setSelectedCell({
                        rowIdx,
                        colIdx,
                        columnName: colName,
                        value: val,
                        tableName: isRealCol ? activeSqlTab.editableTable : undefined,
                        sourceRowIndex: isRealCol ? sourceRowIndex : undefined,
                        origin: "sql",
                      });
                    }}
                    emptyMessage={
                      activeSqlTab.hasExecuted
                        ? activeSqlTab.statusIsError
                          ? "Query failed — check status log below."
                          : "Query executed with no result set."
                        : "Execute a query to view results."
                    }
                  />

                  <div
                    className={styles.hSplitter}
                    onMouseDown={startSqlStatusDrag}
                    title="Drag to resize status pane"
                  />

                  <div
                    className={styles.sqlStatusBox}
                    style={{ height: sqlStatusHeight + "px" }}
                    aria-label="Execution Status"
                  >
                    {!activeSqlTab.hasExecuted ? (
                      <span className={styles.sqlStatusPlaceholder}>
                        Results of the last executed statements
                      </span>
                    ) : (
                      <span
                        className={
                          activeSqlTab.statusIsError
                            ? styles.sqlStatusError
                            : styles.sqlStatusOk
                        }
                      >
                        {activeSqlTab.statusText}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {(showEditCellDock || showBottomDock) && (
          <div
            className={styles.vSplitter}
            onMouseDown={startVerticalDrag}
            title="Drag to resize left and right panes"
          />
        )}

        {/* Right Docked Panels */}
        {(showEditCellDock || showBottomDock) && (
          <div className={styles.rightPane} ref={rightPaneRef}>
            {showEditCellDock && (
              <EditCellDock
                selectedCell={selectedCell}
                onApplyCell={handleApplyCellEdit}
                onToggleUndock={() => {
                  setEditCellDockPct((pct) => (pct > 55 ? 38 : 68));
                  flashStatus("Toggled Edit Database Cell dock size");
                }}
                onHideDock={() => setShowEditCellDock(false)}
                onStatusNotice={flashStatus}
                heightStyle={
                  showBottomDock
                    ? { flex: "0 0 " + editCellDockPct + "%" }
                    : { flex: 1 }
                }
              />
            )}

            {showEditCellDock && showBottomDock && (
              <div
                className={styles.hSplitter}
                onMouseDown={startRightDockDrag}
                title="Drag to resize Edit Database Cell and DB Schema"
              />
            )}

            {showBottomDock && (
              <BottomDocks
                activeTab={bottomDockTab}
                onChangeTab={setBottomDockTab}
                snapshot={dbState.working}
                sqlLog={dbState.sqlLog}
                onClearLog={() => setDbState((prev) => ({ ...prev, sqlLog: [] }))}
                onInsertSqlSnippet={(snippet) => {
                  setMainTab("Execute SQL");
                  updateActiveSqlTab((t) => ({
                    ...t,
                    sql: t.sql.trim() ? t.sql + "\n" + snippet : snippet,
                  }));
                }}
                onBrowseTable={(tbl) => {
                  setBrowseTable(tbl);
                  setMainTab("Browse Data");
                }}
                plotColumns={plotColumns}
                plotRows={plotRows}
                onExportSqlDump={() => {
                  downloadTextFile(
                    dbState.working.dbName.replace(/\.db$/i, "") + ".sql",
                    exportDatabaseToSql(dbState.working)
                  );
                  flashStatus("Exported database SQL dump");
                }}
                onToggleUndock={() => {
                  setEditCellDockPct((pct) => (pct < 26 ? 38 : 20));
                  flashStatus("Toggled " + bottomDockTab + " dock size");
                }}
                onHideDock={() => setShowBottomDock(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className={styles.statusBar}>
        <span>{statusMessage}</span>
        <span>{dbState.working.pragmas.encoding || "UTF-8"}</span>
      </div>

      <DbBrowserDialogs
        modal={modal}
        onClose={() => setModal(null)}
        onCreateTableSql={(sql) => {
          runSqlScript(sql);
          setMainTab("Database Structure");
        }}
        onCreateNewDatabase={(path) => {
          handleSwitchPresetDb("blank", path);
          setModal("createTable");
        }}
        onSwitchPresetDatabase={(preset) => handleSwitchPresetDb(preset)}
        onImportSqlFile={(sqlText, fname) => {
          setMainTab("Execute SQL");
          updateActiveSqlTab((t) => ({ ...t, sql: sqlText, title: fname }));
          runSqlScript(sqlText);
        }}
        onAttachDatabase={(alias, path) => {
          setDbState((prev) => ({
            ...prev,
            attachedDatabases: prev.attachedDatabases.concat([{ alias, path }]),
          }));
          flashStatus("Attached " + path + " as " + alias);
        }}
      />
    </div>
  );
}
