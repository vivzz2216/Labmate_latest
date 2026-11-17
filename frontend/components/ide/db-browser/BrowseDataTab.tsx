"use client";

import React, { useMemo, useState } from "react";
import type { SqlSnapshot, SqlValue } from "@/lib/ide/sqliteEngine";
import { ResultsGrid, type SelectedGridCell } from "./ResultsGrid";
import styles from "./db-browser.module.css";

interface BrowseDataTabProps {
  snapshot: SqlSnapshot;
  activeTable: string;
  onChangeTable: (tableName: string) => void;
  selectedCell: SelectedGridCell | null;
  onSelectCell: (cell: SelectedGridCell) => void;
  onNewRecord: (tableName: string) => void;
  onDeleteRecord: (tableName: string, rowIndex: number) => void;
  onExportCsv: (columns: string[], rows: SqlValue[][], filename: string) => void;
}

export function BrowseDataTab({
  snapshot,
  activeTable,
  onChangeTable,
  selectedCell,
  onSelectCell,
  onNewRecord,
  onDeleteRecord,
  onExportCsv,
}: BrowseDataTabProps) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const table = snapshot.tables[activeTable] || snapshot.tables[snapshot.tableOrder[0]];
  const tableName = table ? table.name : "";

  const processed = useMemo(() => {
    if (!table) {
      return { columns: [] as string[], rows: [] as SqlValue[][], sourceIndices: [] as number[] };
    }
    const cols = table.columns.map((c) => c.name);
    const items: { rowIdx: number; values: SqlValue[]; rowObj: Record<string, SqlValue> }[] = [];

    for (let r = 0; r < table.rows.length; r++) {
      const obj = table.rows[r];
      let passes = true;
      for (let c = 0; c < cols.length; c++) {
        const f = (filters[cols[c]] || "").trim().toLowerCase();
        if (f.length > 0) {
          const valStr = obj[cols[c]] === null ? "null" : String(obj[cols[c]]).toLowerCase();
          if (valStr.indexOf(f) === -1) {
            passes = false;
            break;
          }
        }
      }
      if (passes) {
        items.push({
          rowIdx: r,
          values: cols.map((cn) => (obj[cn] !== undefined ? obj[cn] : null)),
          rowObj: obj,
        });
      }
    }

    if (sortCol) {
      const colIdx = cols.indexOf(sortCol);
      if (colIdx !== -1) {
        items.sort((a, b) => {
          const va = a.values[colIdx];
          const vb = b.values[colIdx];
          if (va === null && vb === null) return 0;
          if (va === null) return sortDir === "asc" ? -1 : 1;
          if (vb === null) return sortDir === "asc" ? 1 : -1;
          if (typeof va === "number" && typeof vb === "number") {
            return sortDir === "asc" ? va - vb : vb - va;
          }
          const cmp = String(va).localeCompare(String(vb));
          return sortDir === "asc" ? cmp : -cmp;
        });
      }
    }

    return {
      columns: cols,
      rows: items.map((it) => it.values),
      sourceIndices: items.map((it) => it.rowIdx),
    };
  }, [filters, sortCol, sortDir, table]);

  const handleHeaderClick = (colName: string) => {
    if (sortCol === colName) {
      if (sortDir === "asc") setSortDir("desc");
      else {
        setSortCol(null);
        setSortDir("asc");
      }
    } else {
      setSortCol(colName);
      setSortDir("asc");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className={styles.tabActionToolbar} style={{ flexWrap: "wrap", height: "auto", minHeight: 28, padding: "3px 6px" }}>
        <span>Table:</span>
        <select
          aria-label="Browse Table Selector"
          className={styles.winSelect}
          style={{ minWidth: 130 }}
          value={tableName}
          onChange={(e) => {
            setFilters({});
            setSortCol(null);
            onChangeTable(e.target.value);
          }}
        >
          {snapshot.tableOrder.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={styles.winButton}
          style={{ minWidth: 64 }}
          onClick={() => {
            setFilters({});
            setSortCol(null);
          }}
        >
          Clear Filters
        </button>

        <button
          type="button"
          className={styles.winButton}
          style={{ minWidth: 82 }}
          disabled={!tableName}
          onClick={() => {
            if (tableName) onNewRecord(tableName);
          }}
        >
          New Record
        </button>

        <button
          type="button"
          className={styles.winButton}
          style={{ minWidth: 88 }}
          disabled={
            !tableName ||
            !selectedCell ||
            selectedCell.tableName !== tableName ||
            selectedCell.sourceRowIndex === undefined
          }
          onClick={() => {
            if (
              tableName &&
              selectedCell &&
              selectedCell.tableName === tableName &&
              selectedCell.sourceRowIndex !== undefined
            ) {
              onDeleteRecord(tableName, selectedCell.sourceRowIndex);
            }
          }}
        >
          Delete Record
        </button>

        <button
          type="button"
          className={styles.winButton}
          style={{ minWidth: 74 }}
          disabled={processed.columns.length === 0}
          onClick={() => onExportCsv(processed.columns, processed.rows, tableName + ".csv")}
        >
          Export CSV
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", padding: "3px" }}>
        <ResultsGrid
          columns={processed.columns}
          rows={processed.rows}
          realColumns={table ? table.columns.map((c) => /REAL|FLOA|DOUB/i.test(c.type || "")) : undefined}
          selectedCell={
            selectedCell && selectedCell.tableName === tableName ? selectedCell : null
          }
          showFilterRow={true}
          filters={filters}
          onFilterChange={(col, val) => setFilters((prev) => ({ ...prev, [col]: val }))}
          sortCol={sortCol}
          sortDir={sortDir}
          onHeaderClick={handleHeaderClick}
          rowNumbers={processed.sourceIndices.map((idx) => idx + 1)}
          onSelectCell={(rowIdx, colIdx) => {
            const colName = processed.columns[colIdx];
            const val = processed.rows[rowIdx][colIdx];
            const sourceRowIndex = processed.sourceIndices[rowIdx];
            onSelectCell({
              rowIdx,
              colIdx,
              columnName: colName,
              value: val,
              tableName,
              sourceRowIndex,
              origin: "browse",
            });
          }}
          emptyMessage="This table has no matching rows."
        />
      </div>

      <div
        style={{
          height: 22,
          padding: "2px 8px",
          fontSize: 11.5,
          color: "#555555",
          borderTop: "1px solid #d4d4d4",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>
          {table ? processed.rows.length + " of " + table.rows.length + " rows" : "No table"}
        </span>
        <span>Click any cell to edit in Edit Database Cell</span>
      </div>
    </div>
  );
}
