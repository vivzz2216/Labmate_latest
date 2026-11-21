"use client";

import React, { useMemo, useState } from "react";
import { Check, Eraser, Search } from "lucide-react";
import {
  aggregateByDimension,
  aggregateKpi,
  buildPivotMatrix,
  resolveTableRows,
} from "@/lib/powerbi/csvEngine";
import { POWERBI_SERIES_PALETTE } from "@/lib/powerbi/palette";
import type {
  ColumnMeta,
  CrossFilterSelection,
  DataRow,
  DatasetModel,
  DateRangeFilter,
  MeasureDef,
  NumericRangeFilter,
  PowerBiVisual,
  TableRelationship,
} from "@/lib/powerbi/types";
import { DataTable } from "./DataTable";
import { DateRangePicker } from "./DateRangePicker";
import { MatrixVisual } from "./MatrixVisual";
import { MetricCard } from "./MetricCard";
import { PowerBiSvgCharts } from "./PowerBiSvgCharts";
import styles from "./powerbi.module.css";

interface ChartContainerProps {
  visual: PowerBiVisual;
  tables: DatasetModel[];
  measures: MeasureDef[];
  relationships: TableRelationship[];
  reportFilters: Record<string, string[]>;
  pageFilters: Record<string, string[]>;
  numericFilters?: Record<string, NumericRangeFilter>;
  slicerFilters: Record<string, string[]>;
  dateRange: DateRangeFilter | null;
  crossFilter: CrossFilterSelection | null;
  themePalette?: readonly string[];
  onCrossFilter: (next: CrossFilterSelection | null) => void;
  onToggleSlicerValue: (column: string, value: string) => void;
  onSelectAllSlicerValues: (column: string, allValues: string[]) => void;
  onClearSlicerColumn: (column: string) => void;
  onDateRangeChange: (next: DateRangeFilter | null) => void;
  onUpdateTextBox?: (visualId: string, textContent: string) => void;
}

/** Dispatches each PowerBiVisual with live aggregation, relationships, measures, matrix pivot, slicing & cross-filtering. */
export function ChartContainer({
  visual,
  tables,
  measures,
  relationships,
  reportFilters,
  pageFilters,
  numericFilters,
  slicerFilters,
  dateRange,
  crossFilter,
  themePalette = POWERBI_SERIES_PALETTE,
  onCrossFilter,
  onToggleSlicerValue,
  onSelectAllSlicerValues,
  onClearSlicerColumn,
  onDateRangeChange,
  onUpdateTextBox,
}: ChartContainerProps) {
  const [slicerSearch, setSlicerSearch] = useState("");

  const activeTable = useMemo(() => {
    if (visual.tableId) {
      const exact = tables.find((t) => (t.id || t.name) === visual.tableId);
      if (exact) return exact;
    }
    return tables[0];
  }, [tables, visual.tableId]);

  const columns: ColumnMeta[] = useMemo(
    () => activeTable?.columns || [],
    [activeTable],
  );
  const tableId = activeTable ? activeTable.id || activeTable.name : "";
  const tableMeasures = useMemo(
    () => measures.filter((m) => m.tableId === tableId || !m.tableId),
    [measures, tableId],
  );

  // A visual ignores its own emitted cross-filter so items stay visible for deselection
  const effectiveCross =
    crossFilter && crossFilter.sourceVisualId !== visual.id ? crossFilter : null;

  const scopedRows = useMemo(
    () =>
      resolveTableRows(tableId, tables, relationships, {
        reportFilters,
        pageFilters,
        slicerFilters: visual.type === "slicer" ? {} : slicerFilters,
        visualFilters: visual.visualFilters,
        numericFilters: { ...(numericFilters || {}), ...(visual.numericFilters || {}) },
        crossFilter: effectiveCross,
        dateRange: visual.type === "slicer" ? null : dateRange,
      }),
    [tableId, tables, relationships, reportFilters, pageFilters, slicerFilters, numericFilters, visual, effectiveCross, dateRange],
  );

  const sliceColName = visual.xAxis || columns[0]?.name || "";
  const allRowsForTable = useMemo(
    () => activeTable?.rows || [],
    [activeTable],
  );

  const uniqueSlicerValues = useMemo(() => {
    if (visual.type !== "slicer") return [];
    const seen = new Set<string>();
    for (let i = 0; i < allRowsForTable.length; i++) {
      const v = allRowsForTable[i][sliceColName];
      if (v !== null && v !== undefined && String(v) !== "") {
        seen.add(String(v));
      }
    }
    const vals = Array.from(seen).sort();
    const q = slicerSearch.trim().toLowerCase();
    return q ? vals.filter((v) => v.toLowerCase().includes(q)) : vals;
  }, [visual.type, allRowsForTable, sliceColName, slicerSearch]);

  // What CALCULATE may widen to: the table after the report filters and slicers, and the whole table.
  const measureScope = useMemo(() => ({ scope: scopedRows, all: allRowsForTable }), [scopedRows, allRowsForTable]);

  const grouped = useMemo(
    () =>
      aggregateByDimension(
        scopedRows,
        visual.xAxis,
        visual.yAxis,
        visual.aggregation,
        visual.format.accentColor,
        {
          legendCol: visual.type !== "matrix" ? visual.legend : undefined,
          sortBy: visual.sortBy,
          sortDir: visual.sortDir,
          perFieldAggregations: visual.perFieldAggregations,
          measures: tableMeasures,
          columns,
          palette: themePalette,
          scope: measureScope,
        },
      ),
    [scopedRows, visual, tableMeasures, columns, themePalette, measureScope],
  );

  // ---------- TEXT BOX VISUAL ----------
  if (visual.type === "textbox") {
    return (
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <textarea
          aria-label={visual.title || "Report text box"}
          value={visual.textContent ?? "Double-click or type report notes here..."}
          onChange={(e) => onUpdateTextBox?.(visual.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            width: "100%",
            border: "1px solid transparent",
            background: "transparent",
            resize: "none",
            outline: "none",
            fontFamily: '"Segoe UI", sans-serif',
            fontSize: visual.fontSize || 14,
            lineHeight: 1.45,
            color: "#252423",
            padding: 4,
          }}
        />
      </div>
    );
  }

  // ---------- SLICER VISUAL ----------
  if (visual.type === "slicer") {
    const colMeta = columns.find((c) => c.name === sliceColName);
    const activeSelections = slicerFilters[sliceColName] || [];
    const minDate = uniqueSlicerValues[0];
    const maxDate = uniqueSlicerValues[uniqueSlicerValues.length - 1];

    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div className={styles.slicerHeaderRow}>
          <span style={{ fontSize: 11, color: "#605e5c" }}>
            {activeSelections.length > 0 ? `${activeSelections.length} selected` : "All"}
          </span>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            {uniqueSlicerValues.length > 0 && activeSelections.length > 0 ? (
              <button
                type="button"
                className={styles.ribbonSmBtn}
                style={{ fontSize: 10, height: 18, padding: "0 4px" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClearSlicerColumn(sliceColName);
                }}
              >
                All
              </button>
            ) : uniqueSlicerValues.length > 1 ? (
              <button
                type="button"
                className={styles.ribbonSmBtn}
                style={{ fontSize: 10, height: 18, padding: "0 4px" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAllSlicerValues(sliceColName, uniqueSlicerValues.slice(0, 80));
                }}
              >
                Select all
              </button>
            ) : null}
            {(activeSelections.length > 0 || (colMeta?.type === "date" && dateRange)) ? (
              <button
                type="button"
                className={styles.visualIconBtn}
                title="Clear selections"
                aria-label="Clear slicer selections"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearSlicerColumn(sliceColName);
                  if (colMeta?.type === "date") onDateRangeChange(null);
                }}
              >
                <Eraser size={12} />
              </button>
            ) : null}
          </div>
        </div>

        {colMeta?.type === "date" ? (
          <div onClick={(e) => e.stopPropagation()} style={{ marginBottom: 8 }}>
            <DateRangePicker
              from={dateRange?.column === sliceColName ? dateRange.from : ""}
              to={dateRange?.column === sliceColName ? dateRange.to : ""}
              min={minDate}
              max={maxDate}
              onChange={(next) =>
                onDateRangeChange(
                  next.from || next.to ? { column: sliceColName, ...next } : null,
                )
              }
              onClear={() => onDateRangeChange(null)}
            />
          </div>
        ) : null}

        <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
          <Search
            size={12}
            style={{ position: "absolute", left: 7, top: 6, color: "#797775", pointerEvents: "none" }}
          />
          <input
            type="text"
            aria-label={`Search ${sliceColName}`}
            placeholder="Search"
            value={slicerSearch}
            onChange={(e) => setSlicerSearch(e.target.value)}
            className={styles.slicerSearchInput}
          />
        </div>

        <div className={styles.slicerList} onClick={(e) => e.stopPropagation()}>
          {uniqueSlicerValues.slice(0, 80).map((val) => {
            const checked = activeSelections.includes(val);
            return (
              <div
                key={val}
                role="checkbox"
                aria-checked={checked}
                className={styles.slicerItem}
                onClick={() => onToggleSlicerValue(sliceColName, val)}
              >
                <span
                  className={`${styles.slicerCheckbox} ${checked ? styles.slicerCheckboxChecked : ""}`}
                >
                  {checked ? <Check size={10} strokeWidth={3} /> : null}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {val}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------- KPI CARD ----------
  if (visual.type === "card") {
    const field = visual.yAxis[0] || visual.xAxis || "";
    const meta = columns.find((c) => c.name === field);
    const measureMeta = tableMeasures.find((m) => m.name === field);
    const agg = visual.perFieldAggregations?.[field] || visual.aggregation;
    const val = aggregateKpi(scopedRows, field, agg, tableMeasures, columns, measureScope);
    return (
      <MetricCard
        value={val}
        field={field}
        label={meta?.label || measureMeta?.name || field || "Metric"}
        aggregation={measureMeta ? "sum" : agg}
        isMeasure={Boolean(measureMeta)}
        showDataLabels={visual.format.showDataLabels}
      />
    );
  }

  // ---------- MATRIX PIVOT VISUAL ----------
  if (visual.type === "matrix") {
    const valField = visual.yAxis[0];
    const pivot = buildPivotMatrix(
      scopedRows,
      visual.xAxis,
      visual.legend,
      valField,
      visual.aggregation,
      tableMeasures,
      columns,
      measureScope,
    );
    return (
      <MatrixVisual
        matrix={pivot}
        rowField={visual.xAxis}
        colField={visual.legend}
        valueField={valField}
        accentColor={visual.format.accentColor}
        activeRowValue={
          crossFilter && crossFilter.column === visual.xAxis ? crossFilter.value : undefined
        }
        onSelectRow={
          visual.xAxis
            ? (rowVal) => {
              if (
                crossFilter &&
                crossFilter.column === visual.xAxis &&
                crossFilter.value === rowVal
              ) {
                onCrossFilter(null);
              } else {
                onCrossFilter({
                  tableId,
                  column: visual.xAxis!,
                  value: rowVal,
                  sourceVisualId: visual.id,
                });
              }
            }
            : undefined
        }
      />
    );
  }

  // ---------- TABLE VISUAL ----------
  if (visual.type === "table") {
    const axisCol = visual.xAxis;
    const xMeta = columns.find((c) => c.name === axisCol);
    const yMetas: ColumnMeta[] = visual.yAxis
      .map((name) => {
        const col = columns.find((c) => c.name === name);
        if (col) return col;
        const m = tableMeasures.find((ms) => ms.name === name);
        if (m) {
          return {
            name: m.name,
            label: m.name,
            type: "number" as const,
            isNumeric: true,
            uniqueCount: 0,
            sampleValues: [],
          };
        }
        return null;
      })
      .filter(Boolean) as ColumnMeta[];

    const tableColumns: ColumnMeta[] = [
      ...(xMeta ? [xMeta] : []),
      ...yMetas,
    ];

    const tableRows: DataRow[] =
      axisCol && yMetas.length > 0
        ? grouped.rows.map((gr) => ({
          [axisCol]: gr.category,
          ...gr.values,
        }))
        : scopedRows.slice(0, 60);

    return (
      <div
        style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <DataTable
          columns={tableColumns.length > 0 ? tableColumns : columns.slice(0, 4)}
          rows={tableRows}
          compact
          pageSize={15}
          activeColumn={axisCol}
          activeValue={crossFilter && crossFilter.column === axisCol ? crossFilter.value : undefined}
          onRowClick={
            axisCol
              ? (row) => {
                const val = String(row[axisCol] ?? "");
                if (!val) return;
                if (crossFilter && crossFilter.column === axisCol && crossFilter.value === val) {
                  onCrossFilter(null);
                } else {
                  onCrossFilter({
                    tableId,
                    column: axisCol,
                    value: val,
                    sourceVisualId: visual.id,
                  });
                }
              }
              : undefined
          }
        />
      </div>
    );
  }

  // ---------- SVG CHARTS ----------
  return (
    <PowerBiSvgCharts
      visual={visual}
      grouped={grouped}
      rawRows={scopedRows}
      crossFilter={crossFilter}
      themePalette={themePalette}
      onSelectCategory={(cat) => {
        if (!visual.xAxis) return;
        if (crossFilter?.column === visual.xAxis && crossFilter.value === cat) {
          onCrossFilter(null);
        } else {
          onCrossFilter({
            tableId,
            column: visual.xAxis,
            value: cat,
            sourceVisualId: visual.id,
          });
        }
      }}
    />
  );
}
