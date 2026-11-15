"use client";

import React, { useState } from "react";
import { Db4sAppIcon } from "./DbBrowserIcons";
import styles from "./db-browser.module.css";

export type ActiveModalType =
  | null
  | "createTable"
  | "newDatabase"
  | "openDatabase"
  | "attachDatabase"
  | "preferences"
  | "about";

interface DbBrowserDialogsProps {
  modal: ActiveModalType;
  onClose: () => void;
  onCreateTableSql: (sql: string) => void;
  onCreateNewDatabase: (filename: string) => void;
  onSwitchPresetDatabase: (preset: "northwind" | "university" | "blank") => void;
  onImportSqlFile: (sqlText: string, filename: string) => void;
  onAttachDatabase: (alias: string, path: string) => void;
}

interface ColumnDraft {
  name: string;
  type: string;
  notNull: boolean;
  pk: boolean;
  ai: boolean;
}

export function DbBrowserDialogs({
  modal,
  onClose,
  onCreateTableSql,
  onCreateNewDatabase,
  onSwitchPresetDatabase,
  onImportSqlFile,
  onAttachDatabase,
}: DbBrowserDialogsProps) {
  const [tableName, setTableName] = useState("NewTable");
  const [cols, setCols] = useState<ColumnDraft[]>([
    { name: "id", type: "INTEGER", notNull: false, pk: true, ai: true },
    { name: "name", type: "TEXT", notNull: true, pk: false, ai: false },
  ]);
  const [newDbName, setNewDbName] = useState("D:\\BD\\SQLite\\lab_practice.db");
  const [attachAlias, setAttachAlias] = useState("aux_db");
  const [attachPath, setAttachPath] = useState("D:\\BD\\SQLite\\university.db");

  if (!modal) return null;

  const previewCreateSql = (() => {
    const parts = cols
      .filter((c) => c.name.trim().length > 0)
      .map((c) => {
        let s = c.name.trim() + " " + c.type;
        if (c.pk) s += " PRIMARY KEY";
        if (c.ai && c.type === "INTEGER") s += " AUTOINCREMENT";
        if (c.notNull) s += " NOT NULL";
        return s;
      });
    return "CREATE TABLE " + (tableName.trim() || "NewTable") + " ( " + parts.join(", ") + " );";
  })();

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalWindow} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTitlebar}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Db4sAppIcon size={14} />
            <span>
              {modal === "createTable" && "Edit table definition"}
              {modal === "newDatabase" && "Choose a filename to save under"}
              {modal === "openDatabase" && "Open SQLite Database"}
              {modal === "attachDatabase" && "Attach Database"}
              {modal === "preferences" && "Preferences"}
              {modal === "about" && "About DB Browser for SQLite"}
            </span>
          </div>
          <button type="button" className={styles.winBtn} style={{ width: 32, height: 26 }} onClick={onClose}>
            ✕
          </button>
        </div>

        {modal === "createTable" && (
          <>
            <div className={styles.modalBody}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label htmlFor="db4s-table-name" style={{ width: 70 }}>Table:</label>
                <input
                  id="db4s-table-name"
                  className={styles.winInput}
                  style={{ flex: 1 }}
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                />
              </div>
              <div style={{ border: "1px solid #a0a0a0", background: "#ffffff", padding: 6 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f0f0f0" }}>
                      <th style={{ textAlign: "left", padding: 3 }}>Name</th>
                      <th style={{ textAlign: "left", padding: 3 }}>Type</th>
                      <th style={{ padding: 3 }}>NN</th>
                      <th style={{ padding: 3 }}>PK</th>
                      <th style={{ padding: 3 }}>AI</th>
                      <th style={{ padding: 3 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {cols.map((col, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: 2 }}>
                          <input
                            className={styles.winInput}
                            style={{ width: "100%" }}
                            value={col.name}
                            onChange={(e) => {
                              const next = cols.slice();
                              next[idx] = { ...col, name: e.target.value };
                              setCols(next);
                            }}
                          />
                        </td>
                        <td style={{ padding: 2 }}>
                          <select
                            className={styles.winSelect}
                            value={col.type}
                            onChange={(e) => {
                              const next = cols.slice();
                              next[idx] = { ...col, type: e.target.value };
                              setCols(next);
                            }}
                          >
                            <option value="INTEGER">INTEGER</option>
                            <option value="TEXT">TEXT</option>
                            <option value="REAL">REAL</option>
                            <option value="BLOB">BLOB</option>
                            <option value="NUMERIC">NUMERIC</option>
                            <option value="VARCHAR(40)">VARCHAR(40)</option>
                          </select>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={col.notNull}
                            onChange={(e) => {
                              const next = cols.slice();
                              next[idx] = { ...col, notNull: e.target.checked };
                              setCols(next);
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={col.pk}
                            onChange={(e) => {
                              const next = cols.slice();
                              next[idx] = { ...col, pk: e.target.checked };
                              setCols(next);
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={col.ai}
                            onChange={(e) => {
                              const next = cols.slice();
                              next[idx] = { ...col, ai: e.target.checked };
                              setCols(next);
                            }}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.winButton}
                            style={{ minWidth: 26, padding: "0 6px" }}
                            onClick={() => setCols(cols.filter((_, i) => i !== idx))}
                          >
                            -
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 6 }}>
                  <button
                    type="button"
                    className={styles.winButton}
                    onClick={() =>
                      setCols(
                        cols.concat([
                          {
                            name: "field_" + (cols.length + 1),
                            type: "TEXT",
                            notNull: false,
                            pk: false,
                            ai: false,
                          },
                        ])
                      )
                    }
                  >
                    Add field
                  </button>
                </div>
              </div>
              <div style={{ fontFamily: "Consolas, monospace", fontSize: 11, background: "#ffffff", border: "1px solid #cccccc", padding: 6 }}>
                {previewCreateSql}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.winButton} onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.winButton}
                onClick={() => {
                  onCreateTableSql(previewCreateSql);
                  onClose();
                }}
              >
                OK
              </button>
            </div>
          </>
        )}

        {modal === "newDatabase" && (
          <>
            <div className={styles.modalBody}>
              <div>Enter new SQLite database path:</div>
              <input
                className={styles.winInput}
                value={newDbName}
                onChange={(e) => setNewDbName(e.target.value)}
              />
              <div style={{ color: "#555555", fontSize: 11 }}>
                Creates a fresh empty SQLite database in memory and opens the Create Table dialog.
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.winButton} onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.winButton}
                onClick={() => {
                  onCreateNewDatabase(newDbName);
                  onClose();
                }}
              >
                Save
              </button>
            </div>
          </>
        )}

        {modal === "openDatabase" && (
          <>
            <div className={styles.modalBody}>
              <div>Select a built-in workspace database or import a `.sql` script file:</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={styles.winButton}
                  onClick={() => {
                    onSwitchPresetDatabase("northwind");
                    onClose();
                  }}
                >
                  Open northwind.db (9 tables)
                </button>
                <button
                  type="button"
                  className={styles.winButton}
                  onClick={() => {
                    onSwitchPresetDatabase("university");
                    onClose();
                  }}
                >
                  Open university.db (Starter Lab)
                </button>
                <button
                  type="button"
                  className={styles.winButton}
                  onClick={() => {
                    onSwitchPresetDatabase("blank");
                    onClose();
                  }}
                >
                  Open Empty Database
                </button>
              </div>
              <div style={{ marginTop: 4 }}>
                <label style={{ display: "block", marginBottom: 4 }}>Import `.sql` file into database:</label>
                <input
                  type="file"
                  accept=".sql,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      onImportSqlFile(String(reader.result || ""), f.name);
                      onClose();
                    };
                    reader.readAsText(f);
                  }}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.winButton} onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}

        {modal === "attachDatabase" && (
          <>
            <div className={styles.modalBody}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 90 }}>Schema Alias:</span>
                <input
                  className={styles.winInput}
                  style={{ flex: 1 }}
                  value={attachAlias}
                  onChange={(e) => setAttachAlias(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 90 }}>Database Path:</span>
                <input
                  className={styles.winInput}
                  style={{ flex: 1 }}
                  value={attachPath}
                  onChange={(e) => setAttachPath(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.winButton} onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.winButton}
                onClick={() => {
                  onAttachDatabase(attachAlias, attachPath);
                  onClose();
                }}
              >
                Attach
              </button>
            </div>
          </>
        )}

        {modal === "preferences" && (
          <>
            <div className={styles.modalBody}>
              <div><strong>General</strong></div>
              <div>Default SQL encoding: UTF-8</div>
              <div>SQLite engine version: 3.45.1 (in-browser workbench)</div>
              <div>Tab size: 2 spaces</div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.winButton} onClick={onClose}>
                OK
              </button>
            </div>
          </>
        )}

        {modal === "about" && (
          <>
            <div className={styles.modalBody}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Db4sAppIcon size={32} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>DB Browser for SQLite</div>
                  <div>Version 3.12.2 (LabMate SQLite Workbench Replica)</div>
                </div>
              </div>
              <div style={{ color: "#444444" }}>
                Built for interactive SQLite database schema design, data browsing, PRAGMA tuning, and SQL query execution directly in the browser.
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.winButton} onClick={onClose}>
                OK
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
