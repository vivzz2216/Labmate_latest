"use client";

import React, { useMemo, useState } from "react";
import { Calendar, ChevronDown, ChevronRight, ChevronsRight, Database, Search, Table2 } from "lucide-react";
import type { ColumnMeta, PowerBiVisual } from "@/lib/powerbi/types";
import styles from "./powerbi.module.css";

interface DataPaneProps {
  expanded: boolean;
  onToggleExpand: () => void;
  tableName: string;
  columns: ColumnMeta[];
  selectedVisual: PowerBiVisual | null;
  onToggleFieldOnVisual: (col: ColumnMeta) => void;
}

/** Right docked Power BI Data pane with searchable columns, Sigma numeric icons, and checkboxes. */
export function DataPane({
  expanded,
  onToggleExpand,
  tableName,
  columns,
  selectedVisual,
  onToggleFieldOnVisual,
}: DataPaneProps) {
  const [search, setSearch] = useState("");
  const [tableOpen, setTableOpen] = useState(true);

  const visibleCols = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? columns.filter(
          (c) => c.name.toLowerCase().includes(q) || c.label.toLowerCase().includes(q),
        )
      : columns;
  }, [columns, search]);

  if (!expanded) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label="Expand Data pane"
        onClick={onToggleExpand}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggleExpand();
        }}
        className={styles.paneCollapsed}
      >
        <ChevronsRight size={14} style={{ transform: "rotate(180deg)", color: "#605e5c" }} />
        <Database size={13} color="#605e5c" />
        <span className={styles.paneVerticalLabel}>Data</span>
      </div>
    );
  }

  return (
    <aside className={styles.paneExpanded} aria-label="Data pane">
      <div className={styles.paneHeader}>
        <span>Data</span>
        <button
          type="button"
          className={styles.visualIconBtn}
          aria-label="Collapse Data pane"
          onClick={onToggleExpand}
        >
          <ChevronsRight size={14} />
        </button>
      </div>

      <div className={styles.paneBodyScroll}>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <Search size={12} style={{ position: "absolute", left: 7, top: 6, color: "#797775" }} />
          <input
            type="text"
            aria-label="Search Data fields"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              height: 24,
              padding: "0 8px 0 24px",
              border: "1px solid #c8c6c4",
              borderRadius: 2,
              fontSize: 11.5,
              background: "#ffffff",
            }}
          />
        </div>

        {columns.length === 0 ? (
          <div style={{ fontSize: 11.5, color: "#797775", padding: "12px 4px", lineHeight: 1.45 }}>
            No dataset loaded yet. Load a CSV or sample dataset to browse fields here.
          </div>
        ) : (
          <div>
            <div
              className={styles.dataTableHeader}
              onClick={() => setTableOpen((prev) => !prev)}
            >
              {tableOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Table2 size={14} color="#117865" />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {tableName}
              </span>
            </div>

            {tableOpen ? (
              <div role="list" aria-label={`${tableName} columns`}>
                {visibleCols.map((col) => {
                  const isUsed = Boolean(
                    selectedVisual &&
                      (selectedVisual.xAxis === col.name ||
                        selectedVisual.yAxis.includes(col.name)),
                  );

                  return (
                    <button
                      key={col.name}
                      type="button"
                      className={styles.dataColumnRow}
                      title={`${col.label} (${col.type}) — Click to toggle on selected visual`}
                      onClick={() => onToggleFieldOnVisual(col)}
                    >
                      <input
                        type="checkbox"
                        readOnly
                        checked={isUsed}
                        tabIndex={-1}
                        style={{ accentColor: "#252423", width: 12, height: 12, flexShrink: 0 }}
                      />
                      <span className={styles.sigmaGlyph}>
                        {col.isNumeric ? (
                          "Σ"
                        ) : col.type === "date" ? (
                          <Calendar size={11} color="#605e5c" />
                        ) : null}
                      </span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {col.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
