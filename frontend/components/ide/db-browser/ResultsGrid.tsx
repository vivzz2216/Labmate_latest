"use client";

import React from "react";
import type { SqlValue } from "@/lib/ide/sqliteEngine";
import styles from "./db-browser.module.css";

export interface SelectedGridCell {
  rowIdx: number;
  colIdx: number;
  columnName: string;
  value: SqlValue;
  tableName?: string;
  sourceRowIndex?: number;
  origin?: "sql" | "browse";
}

interface ResultsGridProps {
  columns: string[];
  rows: SqlValue[][];
  selectedCell: SelectedGridCell | null;
  defaultBoldHeader?: { rowIdx: number; colIdx: number } | null;
  onSelectCell: (rowIdx: number, colIdx: number) => void;
  showFilterRow?: boolean;
  filters?: Record<string, string>;
  onFilterChange?: (colName: string, val: string) => void;
  sortCol?: string | null;
  sortDir?: "asc" | "desc";
  onHeaderClick?: (colName: string) => void;
  rowNumbers?: number[];
  emptyMessage?: string;
  /** Per column: declared REAL affinity (Browse Data). */
  realColumns?: boolean[];
  /** Per cell: SQLite stored a REAL (query results). */
  realCells?: boolean[][];
}

function cellText(val: SqlValue, isReal: boolean): string {
  if (val === null) return "NULL";
  // DB Browser for SQLite prints a whole REAL with one decimal place (38000.0), unlike an INTEGER.
  if (isReal && typeof val === "number" && Number.isInteger(val)) return val.toFixed(1);
  return String(val);
}

export function ResultsGrid({
  columns,
  rows,
  selectedCell,
  defaultBoldHeader = null,
  onSelectCell,
  showFilterRow = false,
  filters,
  onFilterChange,
  sortCol,
  sortDir,
  onHeaderClick,
  rowNumbers,
  emptyMessage = "No rows returned.",
  realColumns,
  realCells,
}: ResultsGridProps) {
  const activeRowIdx = selectedCell ? selectedCell.rowIdx : defaultBoldHeader ? defaultBoldHeader.rowIdx : -1;
  const activeColIdx = selectedCell ? selectedCell.colIdx : defaultBoldHeader ? defaultBoldHeader.colIdx : -1;

  if (columns.length === 0) {
    return (
      <div className={styles.gridFrame} style={{ padding: "8px", color: "#666666" }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={styles.gridFrame}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th className={styles.dataCornerCell} aria-label="Row" />
            {columns.map((col, colIdx) => {
              const isBold = colIdx === activeColIdx;
              const isSorted = sortCol === col;
              return (
                <th
                  key={col + "_" + colIdx}
                  className={
                    styles.dataColHeader +
                    (isBold ? " " + styles.dataColHeaderActive : "")
                  }
                  onClick={() => {
                    if (onHeaderClick) onHeaderClick(col);
                  }}
                  title={onHeaderClick ? "Click to sort by " + col : col}
                >
                  {col}
                  {isSorted ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              );
            })}
          </tr>
          {showFilterRow && (
            <tr className={styles.filterInputRow}>
              <th className={styles.dataRowHeader} aria-hidden="true" />
              {columns.map((col, colIdx) => (
                <th key={"filter_" + col + "_" + colIdx}>
                  <input
                    type="text"
                    className={styles.filterInput}
                    placeholder="Filter"
                    aria-label={"Filter " + col}
                    value={(filters && filters[col]) || ""}
                    onChange={(e) => {
                      if (onFilterChange) onFilterChange(col, e.target.value);
                    }}
                  />
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => {
            const isRowBold = rowIdx === activeRowIdx;
            const displayRowNum = rowNumbers ? rowNumbers[rowIdx] : rowIdx + 1;
            return (
              <tr key={rowIdx}>
                <th
                  className={
                    styles.dataRowHeader +
                    (isRowBold ? " " + styles.dataRowHeaderActive : "")
                  }
                  onClick={() => onSelectCell(rowIdx, 0)}
                >
                  {displayRowNum}
                </th>
                {columns.map((col, colIdx) => {
                  const val = row[colIdx] !== undefined ? row[colIdx] : null;
                  const isSelected =
                    selectedCell !== null &&
                    selectedCell.rowIdx === rowIdx &&
                    selectedCell.colIdx === colIdx;
                  const isNumeric = typeof val === "number";
                  return (
                    <td
                      key={colIdx}
                      className={
                        styles.dataCell +
                        (isNumeric ? " " + styles.dataCellNum : "") +
                        (val === null ? " " + styles.dataCellNull : "") +
                        (isSelected ? " " + styles.dataCellSelected : "")
                      }
                      onClick={() => onSelectCell(rowIdx, colIdx)}
                      title={cellText(val, !!(realColumns?.[colIdx] || realCells?.[rowIdx]?.[colIdx]))}
                    >
                      {cellText(val, !!(realColumns?.[colIdx] || realCells?.[rowIdx]?.[colIdx]))}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
