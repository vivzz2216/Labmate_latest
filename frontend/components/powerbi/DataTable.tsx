"use client";

import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import type { ColumnMeta, DataRow } from "@/lib/powerbi/types";
import { Pagination } from "./Pagination";
import styles from "./powerbi.module.css";

interface DataTableProps {
  columns: ColumnMeta[];
  rows: DataRow[];
  compact?: boolean;
  pageSize?: number;
  searchable?: boolean;
  onRowClick?: (row: DataRow) => void;
  activeValue?: string;
  activeColumn?: string;
}

/** Sortable Power BI data grid used both as a canvas Table visual and full Table View. */
export function DataTable({
  columns,
  rows,
  compact = false,
  pageSize = 25,
  searchable = false,
  onRowClick,
  activeColumn,
  activeValue,
}: DataTableProps) {
  const [query, setQuery] = useState("");
  const [sortCol, setSortCol] = useState<string>(columns[0]?.name || "");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? rows.filter((r) =>
          columns.some((c) => String(r[c.name] ?? "").toLowerCase().includes(q)),
        )
      : rows;

    if (!sortCol) return matched;
    return [...matched].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : String(bv ?? "").localeCompare(String(av ?? ""));
    });
  }, [rows, columns, query, sortCol, sortDir]);

  const effectiveRows = compact ? filtered.slice(0, pageSize) : filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (colName: string) => {
    if (sortCol === colName) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(colName);
      setSortDir("asc");
    }
    setPage(1);
  };

  return (
    <div className={styles.tableViewWrap}>
      {searchable ? (
        <div className={styles.tableViewToolbar}>
          <div style={{ position: "relative", width: 260, maxWidth: "100%" }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 8,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#797775",
              }}
            />
            <input
              type="text"
              aria-label="Search table rows"
              placeholder="Search dataset values..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              style={{
                width: "100%",
                height: 26,
                padding: "0 8px 0 26px",
                border: "1px solid #c8c6c4",
                borderRadius: 2,
                fontSize: 11.5,
                background: "#ffffff",
                color: "#252423",
              }}
            />
          </div>
          <span style={{ fontSize: 11.5, color: "#605e5c" }}>
            {columns.length} columns · {filtered.length.toLocaleString()} rows
          </span>
        </div>
      ) : null}

      <div className={styles.pbiTableScroll}>
        <table className={styles.pbiTable}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.name} onClick={() => toggleSort(col.name)}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {col.label}
                    {sortCol === col.name ? (
                      sortDir === "asc" ? (
                        <ArrowUp size={11} color="#117865" />
                      ) : (
                        <ArrowDown size={11} color="#117865" />
                      )
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {effectiveRows.map((row, idx) => {
              const isSelected =
                activeColumn && activeValue && String(row[activeColumn] ?? "") === activeValue;
              return (
                <tr
                  key={idx}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={{
                    cursor: onRowClick ? "pointer" : "default",
                    background: isSelected ? "#d9ede8" : undefined,
                    fontWeight: isSelected ? 600 : undefined,
                  }}
                >
                  {columns.map((col) => {
                    const val = row[col.name];
                    const formatted =
                      typeof val === "number" ? val.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(val ?? "");
                    return (
                      <td
                        key={col.name}
                        style={{ textAlign: col.isNumeric ? "right" : "left" }}
                      >
                        {formatted}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!compact ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
