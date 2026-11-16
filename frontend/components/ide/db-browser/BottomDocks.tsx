"use client";

import React, { useMemo, useState } from "react";
import type { SqlLogEntry, SqlSnapshot, SqlValue } from "@/lib/ide/sqliteEngine";
import {
  ColumnFieldIcon,
  IndicesGroupIcon,
  IndexItemIcon,
  TableItemIcon,
  TablesGroupIcon,
  TriggersGroupIcon,
  ViewsGroupIcon,
} from "./DbBrowserIcons";
import styles from "./db-browser.module.css";

export type BottomDockTabId = "SQL Log" | "Plot" | "DB Schema" | "Remote";

interface BottomDocksProps {
  activeTab: BottomDockTabId;
  onChangeTab: (tab: BottomDockTabId) => void;
  snapshot: SqlSnapshot;
  sqlLog: SqlLogEntry[];
  onClearLog: () => void;
  onInsertSqlSnippet: (sql: string) => void;
  onBrowseTable: (tableName: string) => void;
  plotColumns: string[];
  plotRows: SqlValue[][];
  onExportSqlDump: () => void;
  onToggleUndock: () => void;
  onHideDock: () => void;
}

export function BottomDocks({
  activeTab,
  onChangeTab,
  snapshot,
  sqlLog,
  onClearLog,
  onInsertSqlSnippet,
  onBrowseTable,
  plotColumns,
  plotRows,
  onExportSqlDump,
  onToggleUndock,
  onHideDock,
}: BottomDocksProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    tables: true,
    indices: true,
    views: false,
    triggers: false,
  });
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [selectedSchemaNode, setSelectedSchemaNode] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<"All" | "User" | "DB Browser">("All");
  const [plotXCol, setPlotXCol] = useState<string>("");
  const [plotYCol, setPlotYCol] = useState<string>("");
  const [plotKind, setPlotKind] = useState<"bar" | "line">("bar");

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleTable = (name: string) => {
    setExpandedTables((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const filteredLog = useMemo(() => {
    if (logFilter === "All") return sqlLog;
    return sqlLog.filter((l) => l.source === logFilter);
  }, [logFilter, sqlLog]);

  const numericColumns = useMemo(() => {
    if (plotColumns.length === 0 || plotRows.length === 0) return [];
    return plotColumns.filter((_, idx) => {
      for (let r = 0; r < plotRows.length; r++) {
        const v = plotRows[r][idx];
        if (v !== null && typeof v === "number") return true;
      }
      return false;
    });
  }, [plotColumns, plotRows]);

  const resolvedXCol =
    plotXCol && plotColumns.indexOf(plotXCol) !== -1
      ? plotXCol
      : plotColumns[1] || plotColumns[0] || "";
  const resolvedYCol =
    plotYCol && numericColumns.indexOf(plotYCol) !== -1
      ? plotYCol
      : numericColumns[0] || "";

  const plotPoints = useMemo(() => {
    const xi = plotColumns.indexOf(resolvedXCol);
    const yi = plotColumns.indexOf(resolvedYCol);
    if (xi === -1 || yi === -1) return [];
    return plotRows.slice(0, 20).map((r, i) => ({
      label: r[xi] === null ? "Row " + (i + 1) : String(r[xi]),
      value: typeof r[yi] === "number" ? (r[yi] as number) : Number(r[yi] || 0),
    }));
  }, [plotColumns, plotRows, resolvedXCol, resolvedYCol]);

  return (
    <div className={styles.bottomDockWrapper}>
      <div className={styles.bottomDockContent}>
        <div className={styles.dockHeader}>
          <span className={styles.dockTitle}>{activeTab}</span>
          <div className={styles.dockHeaderActions}>
            <button
              type="button"
              className={styles.dockMiniBtn}
              title="Undock / Toggle Expand"
              aria-label={"Undock " + activeTab}
              onClick={onToggleUndock}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect x="1" y="3" width="6" height="6" stroke="#555555" strokeWidth="1" />
                <path d="M3 3V1H9V7H7" stroke="#555555" strokeWidth="1" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.dockMiniBtn}
              title={"Close " + activeTab}
              aria-label={"Close " + activeTab}
              onClick={onHideDock}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2L8 8M8 2L2 8" stroke="#555555" strokeWidth="1.2" />
              </svg>
            </button>
          </div>
        </div>

        {activeTab === "DB Schema" && (
          <div className={styles.schemaTreeViewport}>
            <table className={styles.schemaTable}>
              <thead>
                <tr>
                  <th className={styles.schemaTh} style={{ width: "33%" }}>Name</th>
                  <th className={styles.schemaTh} style={{ width: "16%" }}>Type</th>
                  <th className={styles.schemaTh} style={{ width: "51%" }}>Schema</th>
                </tr>
              </thead>
              <tbody>
                <tr className={styles.schemaRow} onClick={() => toggleGroup("tables")}>
                  <td className={styles.schemaTd}>
                    <span className={styles.schemaNameCell}>
                      <span className={styles.treeChevronBtn}>{expandedGroups.tables ? "▾" : "▸"}</span>
                      <TablesGroupIcon />
                      <span>Tables ({snapshot.tableOrder.length})</span>
                    </span>
                  </td>
                  <td className={styles.schemaTd} />
                  <td className={styles.schemaTd} />
                </tr>

                {expandedGroups.tables &&
                  snapshot.tableOrder.map((tableName) => {
                    const table = snapshot.tables[tableName];
                    if (!table) return null;
                    const isExp = Boolean(expandedTables[tableName]);
                    const isSel = selectedSchemaNode === "table:" + tableName;
                    return (
                      <React.Fragment key={tableName}>
                        <tr
                          className={styles.schemaRow + (isSel ? " " + styles.schemaRowSelected : "")}
                          onClick={() => setSelectedSchemaNode("table:" + tableName)}
                          onDoubleClick={() => onBrowseTable(tableName)}
                          title="Click arrow to view columns, double-click to browse data"
                        >
                          <td className={styles.schemaTd} style={{ paddingLeft: "20px" }}>
                            <span className={styles.schemaNameCell}>
                              <button
                                type="button"
                                className={styles.treeChevronBtn}
                                aria-label={"Expand " + tableName}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTable(tableName);
                                }}
                              >
                                {isExp ? "▾" : "▸"}
                              </button>
                              <TableItemIcon />
                              <span>{table.name}</span>
                            </span>
                          </td>
                          <td className={styles.schemaTd} />
                          <td className={styles.schemaTd}>{table.createSql}</td>
                        </tr>
                        {isExp &&
                          table.columns.map((col) => (
                            <tr
                              key={tableName + "." + col.name}
                              className={styles.schemaRow}
                              onDoubleClick={() =>
                                onInsertSqlSnippet("SELECT " + col.name + " FROM " + tableName + ";")
                              }
                            >
                              <td className={styles.schemaTd} style={{ paddingLeft: "42px" }}>
                                <span className={styles.schemaNameCell}>
                                  <ColumnFieldIcon isPrimaryKey={col.primaryKey} />
                                  <span>{col.name}</span>
                                </span>
                              </td>
                              <td className={styles.schemaTd}>{col.type}</td>
                              <td className={styles.schemaTd}>{col.definitionSql}</td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}

                <tr className={styles.schemaRow} onClick={() => toggleGroup("indices")}>
                  <td className={styles.schemaTd}>
                    <span className={styles.schemaNameCell}>
                      <span className={styles.treeChevronBtn}>{expandedGroups.indices ? "▾" : "▸"}</span>
                      <IndicesGroupIcon />
                      <span>Indices ({snapshot.indices.length})</span>
                    </span>
                  </td>
                  <td className={styles.schemaTd} />
                  <td className={styles.schemaTd} />
                </tr>

                {expandedGroups.indices &&
                  snapshot.indices.map((idx) => (
                    <tr
                      key={idx.name}
                      className={
                        styles.schemaRow +
                        (selectedSchemaNode === "idx:" + idx.name
                          ? " " + styles.schemaRowSelected
                          : "")
                      }
                      onClick={() => setSelectedSchemaNode("idx:" + idx.name)}
                    >
                      <td className={styles.schemaTd} style={{ paddingLeft: "20px" }}>
                        <span className={styles.schemaNameCell}>
                          <span className={styles.treeChevronBtn}>▸</span>
                          <IndexItemIcon />
                          <span>{idx.name}</span>
                        </span>
                      </td>
                      <td className={styles.schemaTd} />
                      <td className={styles.schemaTd}>{idx.createSql}</td>
                    </tr>
                  ))}

                <tr className={styles.schemaRow} onClick={() => toggleGroup("views")}>
                  <td className={styles.schemaTd}>
                    <span className={styles.schemaNameCell}>
                      <span className={styles.treeChevronBtn}>
                        {snapshot.views.length > 0 ? (expandedGroups.views ? "▾" : "▸") : ""}
                      </span>
                      <ViewsGroupIcon />
                      <span>Views ({snapshot.views.length})</span>
                    </span>
                  </td>
                  <td className={styles.schemaTd} />
                  <td className={styles.schemaTd} />
                </tr>

                {expandedGroups.views &&
                  snapshot.views.map((v) => (
                    <tr key={v.name} className={styles.schemaRow}>
                      <td className={styles.schemaTd} style={{ paddingLeft: "36px" }}>
                        <span className={styles.schemaNameCell}>
                          <ViewsGroupIcon />
                          <span>{v.name}</span>
                        </span>
                      </td>
                      <td className={styles.schemaTd}>VIEW</td>
                      <td className={styles.schemaTd}>{v.createSql}</td>
                    </tr>
                  ))}

                <tr className={styles.schemaRow} onClick={() => toggleGroup("triggers")}>
                  <td className={styles.schemaTd}>
                    <span className={styles.schemaNameCell}>
                      <span className={styles.treeChevronBtn}>
                        {snapshot.triggers.length > 0 ? (expandedGroups.triggers ? "▾" : "▸") : ""}
                      </span>
                      <TriggersGroupIcon />
                      <span>Triggers ({snapshot.triggers.length})</span>
                    </span>
                  </td>
                  <td className={styles.schemaTd} />
                  <td className={styles.schemaTd} />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "SQL Log" && (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: 4, gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>Show SQL executed by:</span>
                <select
                  className={styles.winSelect}
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value as "All" | "User" | "DB Browser")}
                >
                  <option value="All">All</option>
                  <option value="User">User</option>
                  <option value="DB Browser">DB Browser</option>
                </select>
              </div>
              <button type="button" className={styles.winButton} onClick={onClearLog}>
                Clear
              </button>
            </div>
            <div className={styles.schemaTreeViewport} style={{ margin: 0 }}>
              <table className={styles.schemaTable} style={{ minWidth: 500 }}>
                <thead>
                  <tr>
                    <th className={styles.schemaTh} style={{ width: 130 }}>Timestamp</th>
                    <th className={styles.schemaTh} style={{ width: 85 }}>Source</th>
                    <th className={styles.schemaTh}>SQL</th>
                    <th className={styles.schemaTh} style={{ width: 140 }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLog.map((entry) => (
                    <tr
                      key={entry.id}
                      className={styles.schemaRow}
                      onDoubleClick={() => onInsertSqlSnippet(entry.sql)}
                    >
                      <td className={styles.schemaTd} style={{ color: "#555555" }}>{entry.timestamp}</td>
                      <td className={styles.schemaTd}>{entry.source}</td>
                      <td className={styles.schemaTd} style={{ fontFamily: "Consolas, monospace" }}>{entry.sql}</td>
                      <td
                        className={styles.schemaTd}
                        style={{ color: entry.status === "error" ? "#c41e1e" : "#2e6b1e" }}
                      >
                        {entry.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "Plot" && (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: 4, gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>X:</span>
              <select
                className={styles.winSelect}
                value={resolvedXCol}
                onChange={(e) => setPlotXCol(e.target.value)}
              >
                {plotColumns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span>Y:</span>
              <select
                className={styles.winSelect}
                value={resolvedYCol}
                onChange={(e) => setPlotYCol(e.target.value)}
              >
                {numericColumns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span>Type:</span>
              <select
                className={styles.winSelect}
                value={plotKind}
                onChange={(e) => setPlotKind(e.target.value as "bar" | "line")}
              >
                <option value="bar">Bar</option>
                <option value="line">Line</option>
              </select>
            </div>
            <div className={styles.schemaTreeViewport} style={{ margin: 0, padding: 8 }}>
              {plotPoints.length === 0 ? (
                <div style={{ color: "#666666", padding: 12 }}>
                  Run a query with at least one numeric column (e.g. SELECT productName, unitPrice FROM Product;) to render a plot.
                </div>
              ) : (
                <svg width="100%" height="180" viewBox="0 0 540 180" preserveAspectRatio="none">
                  <line x1="45" y1="15" x2="45" y2="145" stroke="#888888" strokeWidth="1" />
                  <line x1="45" y1="145" x2="525" y2="145" stroke="#888888" strokeWidth="1" />
                  {(() => {
                    const maxVal = Math.max.apply(
                      null,
                      plotPoints.map((p) => p.value).concat([1])
                    );
                    const slotW = 470 / plotPoints.length;
                    if (plotKind === "bar") {
                      return plotPoints.map((pt, i) => {
                        const h = Math.max(2, (pt.value / maxVal) * 120);
                        const x = 52 + i * slotW;
                        const w = Math.max(6, slotW - 6);
                        return (
                          <g key={i}>
                            <rect
                              x={x}
                              y={145 - h}
                              width={w}
                              height={h}
                              fill="#4E86C6"
                              stroke="#2D5B8E"
                            >
                              <title>{pt.label + ": " + pt.value}</title>
                            </rect>
                            <text
                              x={x + w / 2}
                              y={162}
                              textAnchor="middle"
                              fontSize="9"
                              fill="#333333"
                            >
                              {pt.label.slice(0, 8)}
                            </text>
                          </g>
                        );
                      });
                    }
                    const poly = plotPoints
                      .map((pt, i) => {
                        const x = 52 + i * slotW + slotW / 2;
                        const y = 145 - (pt.value / maxVal) * 120;
                        return x + "," + y;
                      })
                      .join(" ");
                    return (
                      <>
                        <polyline fill="none" stroke="#2D6DB5" strokeWidth="2" points={poly} />
                        {plotPoints.map((pt, i) => {
                          const x = 52 + i * slotW + slotW / 2;
                          const y = 145 - (pt.value / maxVal) * 120;
                          return (
                            <circle key={i} cx={x} cy={y} r="3.5" fill="#4E86C6" stroke="#1E4B7A">
                              <title>{pt.label + ": " + pt.value}</title>
                            </circle>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              )}
            </div>
          </div>
        )}

        {activeTab === "Remote" && (
          <div style={{ flex: 1, minHeight: 0, padding: 10, background: "#ffffff", margin: 4, border: "1px solid #a0a0a0", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>DBHub.io Remote Databases</div>
            <div style={{ color: "#444444", lineHeight: 1.45 }}>
              Connected locally to <strong>{snapshot.dbPath}</strong> ({snapshot.tableOrder.length} tables, UTF-8).
              You can export the entire in-memory database as a portable SQLite dump anytime.
            </div>
            <div>
              <button type="button" className={styles.winButton} onClick={onExportSqlDump}>
                Export Database to SQL File...
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.bottomDockTabBar} role="tablist" aria-label="Bottom Dock Tabs">
        {(["SQL Log", "Plot", "DB Schema", "Remote"] as BottomDockTabId[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={
                styles.bottomDockTab + (isActive ? " " + styles.bottomDockTabActive : "")
              }
              onClick={() => onChangeTab(tab)}
            >
              {tab}
            </button>
          );
        })}
      </div>
    </div>
  );
}
