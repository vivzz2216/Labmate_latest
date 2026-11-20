"use client";

import React, { useMemo, useState } from "react";
import {
  Calculator,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronsRight,
  Database,
  FunctionSquare,
  Plus,
  Search,
  Table2,
  Trash2,
} from "lucide-react";
import type {
  ColumnMeta,
  DatasetModel,
  MeasureDef,
  PowerBiVisual,
} from "@/lib/powerbi/types";
import styles from "./powerbi.module.css";

interface DataPaneProps {
  expanded: boolean;
  onToggleExpand: () => void;
  tables: DatasetModel[];
  activeTableId: string;
  onSelectTable: (tableId: string) => void;
  measures: MeasureDef[];
  selectedVisual: PowerBiVisual | null;
  selectedColumn: { tableId: string; columnName: string } | null;
  onSelectColumn: (tableId: string, columnName: string) => void;
  onToggleFieldOnVisual: (tableId: string, fieldName: string, isNumeric: boolean, isMeasure?: boolean) => void;
  onOpenNewMeasure: (tableId: string) => void;
  onOpenNewColumn: (tableId: string) => void;
  onDeleteMeasure: (measureId: string) => void;
}

/** Right docked Power BI Data pane: multi-table tree, Sigma/Date/fx/Measure icons, drag-and-drop & field selection. */
export function DataPane({
  expanded,
  onToggleExpand,
  tables,
  activeTableId,
  onSelectTable,
  measures,
  selectedVisual,
  selectedColumn,
  onSelectColumn,
  onToggleFieldOnVisual,
  onOpenNewMeasure,
  onOpenNewColumn,
  onDeleteMeasure,
}: DataPaneProps) {
  const [search, setSearch] = useState("");
  const [collapsedTables, setCollapsedTables] = useState<Record<string, boolean>>({});

  const query = search.trim().toLowerCase();

  const toggleTableOpen = (id: string) => {
    setCollapsedTables((prev) => ({ ...prev, [id]: !prev[id] }));
    onSelectTable(id);
  };

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
        <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
          {tables.length > 0 ? (
            <button
              type="button"
              className={styles.visualIconBtn}
              title="New measure"
              aria-label="New measure from Data pane"
              onClick={() => onOpenNewMeasure(activeTableId)}
            >
              <Plus size={13} />
            </button>
          ) : null}
          <button
            type="button"
            className={styles.visualIconBtn}
            aria-label="Collapse Data pane"
            onClick={onToggleExpand}
          >
            <ChevronsRight size={14} />
          </button>
        </div>
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

        {tables.length === 0 ? (
          <div style={{ fontSize: 11.5, color: "#797775", padding: "12px 4px", lineHeight: 1.45 }}>
            No dataset loaded yet. Import CSV/Excel or load a sample dataset to browse fields here.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tables.map((table) => {
              const tableId = table.id || table.name;
              const isOpen = !collapsedTables[tableId];
              const isActiveTable = tableId === activeTableId;
              const tableMeasures = measures.filter((m) => m.tableId === tableId);

              const visibleCols = query
                ? table.columns.filter(
                    (c) =>
                      c.name.toLowerCase().includes(query) ||
                      c.label.toLowerCase().includes(query),
                  )
                : table.columns;

              const visibleMeasures = query
                ? tableMeasures.filter((m) => m.name.toLowerCase().includes(query))
                : tableMeasures;

              return (
                <div key={tableId}>
                  <div
                    className={styles.dataTableHeader}
                    style={{
                      background: isActiveTable ? "#eef5f3" : "transparent",
                      borderRadius: 2,
                      paddingRight: 4,
                      justifyContent: "space-between",
                    }}
                    onClick={() => toggleTableOpen(tableId)}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                      {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <Table2 size={13.5} color="#117865" />
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {table.name}
                      </span>
                    </span>

                    <div
                      style={{ display: "inline-flex", alignItems: "center", gap: 2 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className={styles.visualIconBtn}
                        style={{ width: 18, height: 18 }}
                        title="Add calculated column"
                        aria-label={`New column in ${table.name}`}
                        onClick={() => onOpenNewColumn(tableId)}
                      >
                        <FunctionSquare size={11} color="#117865" />
                      </button>
                      <button
                        type="button"
                        className={styles.visualIconBtn}
                        style={{ width: 18, height: 18 }}
                        title="Add measure"
                        aria-label={`New measure in ${table.name}`}
                        onClick={() => onOpenNewMeasure(tableId)}
                      >
                        <Calculator size={11} color="#117865" />
                      </button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div role="list" aria-label={`${table.name} columns`}>
                      {visibleMeasures.map((m) => {
                        const isUsed = Boolean(
                          selectedVisual &&
                            (!selectedVisual.tableId || selectedVisual.tableId === tableId) &&
                            selectedVisual.yAxis.indexOf(m.name) !== -1,
                        );
                        return (
                          <div
                            key={m.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(
                                "application/x-powerbi-field",
                                JSON.stringify({ tableId, columnName: m.name, isMeasure: true }),
                              );
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            className={styles.dataColumnRow}
                            title={`Measure: ${m.name} = ${m.formula} (Drag to visual or check box)`}
                            style={{ justifyContent: "space-between", paddingRight: 4 }}
                          >
                            <span
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}
                              onClick={() => onToggleFieldOnVisual(tableId, m.name, true, true)}
                            >
                              <input
                                type="checkbox"
                                readOnly
                                checked={isUsed}
                                tabIndex={-1}
                                style={{ accentColor: "#252423", width: 12, height: 12, flexShrink: 0 }}
                              />
                              <span className={styles.sigmaGlyph}>
                                <Calculator size={11} color="#117865" />
                              </span>
                              <span
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  fontWeight: 600,
                                }}
                              >
                                {m.name}
                              </span>
                            </span>
                            <button
                              type="button"
                              aria-label={`Delete measure ${m.name}`}
                              className={styles.visualIconBtn}
                              style={{ width: 16, height: 16 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteMeasure(m.id);
                              }}
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        );
                      })}

                      {visibleCols.map((col: ColumnMeta) => {
                        const isUsed = Boolean(
                          selectedVisual &&
                            (!selectedVisual.tableId || selectedVisual.tableId === tableId) &&
                            (selectedVisual.xAxis === col.name ||
                              selectedVisual.legend === col.name ||
                              selectedVisual.yAxis.indexOf(col.name) !== -1),
                        );
                        const isColSelected =
                          selectedColumn?.tableId === tableId &&
                          selectedColumn?.columnName === col.name;

                        return (
                          <div
                            key={col.name}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(
                                "application/x-powerbi-field",
                                JSON.stringify({ tableId, columnName: col.name, isMeasure: false }),
                              );
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            onClick={() => onSelectColumn(tableId, col.name)}
                            className={`${styles.dataColumnRow} ${isColSelected ? styles.dataColumnRowSelected : ""}`}
                            title={`${col.label} (${col.type}) — Drag to visual/well or click checkbox`}
                          >
                            <input
                              type="checkbox"
                              checked={isUsed}
                              aria-label={`Include ${col.label} in selected visual`}
                              onChange={(e) => {
                                e.stopPropagation();
                                onToggleFieldOnVisual(tableId, col.name, col.isNumeric, false);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              style={{ accentColor: "#252423", width: 12, height: 12, flexShrink: 0, cursor: "pointer" }}
                            />
                            <span className={styles.sigmaGlyph}>
                              {col.isCalculated ? (
                                <FunctionSquare size={11} color="#117865" />
                              ) : col.isNumeric ? (
                                "Σ"
                              ) : col.type === "date" ? (
                                <Calendar size={11} color="#605e5c" />
                              ) : null}
                            </span>
                            <span
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                              }}
                            >
                              {col.label}
                            </span>
                            {(col.missingCount ?? 0) > 0 ? (
                              <span
                                title={`${col.missingCount} missing value(s)`}
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 99,
                                  background: "#ca6b14",
                                  flexShrink: 0,
                                }}
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
