"use client";

import React from "react";
import { formatPowerBiNumber, toHumanLabel } from "@/lib/powerbi/csvEngine";
import type { PivotMatrixResult } from "@/lib/powerbi/types";
import styles from "./powerbi.module.css";

interface MatrixVisualProps {
  matrix: PivotMatrixResult;
  rowField?: string;
  colField?: string;
  valueField?: string;
  accentColor?: string;
  activeRowValue?: string;
  onSelectRow?: (rowHeader: string) => void;
}

/** Authentic Power BI Pivot Matrix visual with subtotals, grand total, and row cross-filtering. */
export function MatrixVisual({
  matrix,
  rowField,
  colField,
  valueField,
  accentColor = "#118DFF",
  activeRowValue,
  onSelectRow,
}: MatrixVisualProps) {
  if (matrix.rowHeaders.length === 0 || matrix.colHeaders.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          color: "#797775",
          fontSize: 12,
          textAlign: "center",
          padding: 12,
        }}
      >
        Assign Rows, Columns, and Values to display a Matrix.
      </div>
    );
  }

  let maxCell = 1;
  for (let r = 0; r < matrix.rowHeaders.length; r++) {
    const rk = matrix.rowHeaders[r];
    for (let c = 0; c < matrix.colHeaders.length; c++) {
      const ck = matrix.colHeaders[c];
      const v = Math.abs(matrix.cells[rk]?.[ck] ?? 0);
      if (v > maxCell) maxCell = v;
    }
  }

  return (
    <div
      className={styles.pbiTableScroll}
      style={{ flex: 1, minHeight: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <table className={`${styles.pbiTable} ${styles.matrixTable}`}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>
              {rowField ? toHumanLabel(rowField) : "Rows"}
              {colField ? ` \\ ${toHumanLabel(colField)}` : ""}
            </th>
            {matrix.colHeaders.map((colH) => (
              <th key={colH} style={{ textAlign: "right" }}>
                {colH}
              </th>
            ))}
            <th style={{ textAlign: "right", background: "#edebe9" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {matrix.rowHeaders.map((rowH) => {
            const isSelected = activeRowValue === rowH;
            return (
              <tr
                key={rowH}
                onClick={() => onSelectRow?.(rowH)}
                style={{
                  cursor: onSelectRow ? "pointer" : "default",
                  background: isSelected ? "#d9ede8" : undefined,
                  fontWeight: isSelected ? 600 : undefined,
                }}
              >
                <td style={{ fontWeight: 600, background: isSelected ? "#d9ede8" : "#faf9f8" }}>
                  {rowH}
                </td>
                {matrix.colHeaders.map((colH) => {
                  const val = matrix.cells[rowH]?.[colH] ?? 0;
                  const pct = Math.max(0, Math.min(100, (Math.abs(val) / maxCell) * 100));
                  return (
                    <td
                      key={colH}
                      style={{
                        textAlign: "right",
                        position: "relative",
                      }}
                    >
                      {val > 0 ? (
                        <span
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            left: 2,
                            bottom: 2,
                            height: 3,
                            width: `${Math.round(pct * 0.85)}%`,
                            background: accentColor,
                            opacity: 0.25,
                            borderRadius: 1,
                          }}
                        />
                      ) : null}
                      <span style={{ position: "relative" }}>
                        {formatPowerBiNumber(val, valueField)}
                      </span>
                    </td>
                  );
                })}
                <td style={{ textAlign: "right", fontWeight: 600, background: "#f8f7f6" }}>
                  {formatPowerBiNumber(matrix.rowTotals[rowH] ?? 0, valueField)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: "#f3f2f1", fontWeight: 700, borderTop: "2px solid #c8c6c4" }}>
            <td>Total</td>
            {matrix.colHeaders.map((colH) => (
              <td key={colH} style={{ textAlign: "right" }}>
                {formatPowerBiNumber(matrix.colTotals[colH] ?? 0, valueField)}
              </td>
            ))}
            <td style={{ textAlign: "right" }}>
              {formatPowerBiNumber(matrix.grandTotal, valueField)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
