"use client";

import React, { useState } from "react";
import type { SqlSnapshot } from "@/lib/ide/sqliteEngine";
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

interface DatabaseStructureTabProps {
  snapshot: SqlSnapshot;
  onOpenCreateTable: () => void;
  onBrowseTable: (tableName: string) => void;
  onRunSql: (sql: string) => void;
  onDeleteObject: (kind: "table" | "index" | "view", name: string) => void;
}

export function DatabaseStructureTab({
  snapshot,
  onOpenCreateTable,
  onBrowseTable,
  onRunSql,
  onDeleteObject,
}: DatabaseStructureTabProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    tables: true,
    indices: true,
    views: false,
    triggers: false,
  });
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({
    Shipper: true,
  });
  const [selectedItem, setSelectedItem] = useState<{
    kind: "table" | "index" | "view";
    name: string;
  } | null>(null);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleTable = (name: string) => {
    setExpandedTables((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className={styles.tabActionToolbar}>
        <button type="button" className={styles.winButton} style={{ minWidth: 82 }} onClick={onOpenCreateTable}>
          Create Table
        </button>
        <button
          type="button"
          className={styles.winButton}
          style={{ minWidth: 74 }}
          disabled={!selectedItem || selectedItem.kind !== "table"}
          onClick={() => {
            if (selectedItem && selectedItem.kind === "table") {
              onBrowseTable(selectedItem.name);
            }
          }}
        >
          Browse Table
        </button>
        <button
          type="button"
          className={styles.winButton}
          style={{ minWidth: 68 }}
          disabled={!selectedItem || selectedItem.name === "sqlite_sequence"}
          onClick={() => {
            if (selectedItem) {
              onDeleteObject(selectedItem.kind, selectedItem.name);
              setSelectedItem(null);
            }
          }}
        >
          Delete
        </button>
        <button
          type="button"
          className={styles.winButton}
          style={{ minWidth: 96 }}
          disabled={!selectedItem || selectedItem.kind !== "table"}
          onClick={() => {
            if (selectedItem && selectedItem.kind === "table") {
              onRunSql("SELECT * FROM " + selectedItem.name + ";");
            }
          }}
        >
          Query in SQL
        </button>
      </div>

      <div className={styles.schemaTreeViewport} style={{ margin: "3px" }}>
        <table className={styles.schemaTable}>
          <thead>
            <tr>
              <th className={styles.schemaTh} style={{ width: "42%" }}>Name</th>
              <th className={styles.schemaTh} style={{ width: "18%" }}>Type</th>
              <th className={styles.schemaTh} style={{ width: "40%" }}>Schema</th>
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
                const isSel = selectedItem?.kind === "table" && selectedItem.name === tableName;
                return (
                  <React.Fragment key={tableName}>
                    <tr
                      className={styles.schemaRow + (isSel ? " " + styles.schemaRowSelected : "")}
                      onClick={() => setSelectedItem({ kind: "table", name: tableName })}
                      onDoubleClick={() => onBrowseTable(tableName)}
                    >
                      <td className={styles.schemaTd} style={{ paddingLeft: "22px" }}>
                        <span className={styles.schemaNameCell}>
                          <button
                            type="button"
                            className={styles.treeChevronBtn}
                            aria-label={"Toggle " + tableName}
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
                      <td className={styles.schemaTd}>
                        <span style={{ color: "#666666" }}>{table.rows.length} rows</span>
                      </td>
                      <td className={styles.schemaTd}>{table.createSql}</td>
                    </tr>
                    {isExp &&
                      table.columns.map((col) => (
                        <tr key={tableName + "." + col.name} className={styles.schemaRow}>
                          <td className={styles.schemaTd} style={{ paddingLeft: "44px" }}>
                            <span className={styles.schemaNameCell}>
                              <ColumnFieldIcon isPrimaryKey={col.primaryKey} />
                              <span>{col.name}</span>
                            </span>
                          </td>
                          <td className={styles.schemaTd}>{col.type || "ANY"}</td>
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
              snapshot.indices.map((idx) => {
                const isSel = selectedItem?.kind === "index" && selectedItem.name === idx.name;
                return (
                  <tr
                    key={idx.name}
                    className={styles.schemaRow + (isSel ? " " + styles.schemaRowSelected : "")}
                    onClick={() => setSelectedItem({ kind: "index", name: idx.name })}
                  >
                    <td className={styles.schemaTd} style={{ paddingLeft: "28px" }}>
                      <span className={styles.schemaNameCell}>
                        <IndexItemIcon />
                        <span>{idx.name}</span>
                      </span>
                    </td>
                    <td className={styles.schemaTd}>{idx.unique ? "UNIQUE" : "INDEX"}</td>
                    <td className={styles.schemaTd}>{idx.createSql}</td>
                  </tr>
                );
              })}

            <tr className={styles.schemaRow} onClick={() => toggleGroup("views")}>
              <td className={styles.schemaTd}>
                <span className={styles.schemaNameCell}>
                  <span className={styles.treeChevronBtn}>{expandedGroups.views ? "▾" : "▸"}</span>
                  <ViewsGroupIcon />
                  <span>Views ({snapshot.views.length})</span>
                </span>
              </td>
              <td className={styles.schemaTd} />
              <td className={styles.schemaTd} />
            </tr>
            {expandedGroups.views &&
              snapshot.views.map((v) => {
                const isSel = selectedItem?.kind === "view" && selectedItem.name === v.name;
                return (
                  <tr
                    key={v.name}
                    className={styles.schemaRow + (isSel ? " " + styles.schemaRowSelected : "")}
                    onClick={() => setSelectedItem({ kind: "view", name: v.name })}
                  >
                    <td className={styles.schemaTd} style={{ paddingLeft: "28px" }}>
                      <span className={styles.schemaNameCell}>
                        <ViewsGroupIcon />
                        <span>{v.name}</span>
                      </span>
                    </td>
                    <td className={styles.schemaTd}>VIEW</td>
                    <td className={styles.schemaTd}>{v.createSql}</td>
                  </tr>
                );
              })}

            <tr className={styles.schemaRow} onClick={() => toggleGroup("triggers")}>
              <td className={styles.schemaTd}>
                <span className={styles.schemaNameCell}>
                  <span className={styles.treeChevronBtn}>{expandedGroups.triggers ? "▾" : "▸"}</span>
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
    </div>
  );
}
