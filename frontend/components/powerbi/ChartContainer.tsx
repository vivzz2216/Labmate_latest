"use client";

import React, { useMemo, useState } from "react";
import { Check, Eraser, Search } from "lucide-react";
import {
  aggregateByDimension,
  aggregateKpi,
  applyDatasetFilters,
} from "@/lib/powerbi/csvEngine";
import type {
  ColumnMeta,
  CrossFilterSelection,
  DataRow,
  DateRangeFilter,
  PowerBiVisual,
} from "@/lib/powerbi/types";
import { DataTable } from "./DataTable";
import { DateRangePicker } from "./DateRangePicker";
import { MetricCard } from "./MetricCard";
import { PowerBiSvgCharts } from "./PowerBiSvgCharts";
import styles from "./powerbi.module.css";

interface ChartContainerProps {
  visual: PowerBiVisual;
  columns: ColumnMeta[];
  allRows: DataRow[];
  reportFilters: Record<string, string[]>;
  pageFilters: Record<string, string[]>;
  slicerFilters: Record<string, string[]>;
  dateRange: DateRangeFilter | null;
  crossFilter: CrossFilterSelection | null;
  onCrossFilter: (next: CrossFilterSelection | null) => void;
  onToggleSlicerValue: (column: string, value: string) => void;
  onClearSlicerColumn: (column: string) => void;
  onDateRangeChange: (next: DateRangeFilter | null) => void;
  /** Value of a DAX measure over a set of rows, or null when the field is not a measure. */
  measureEval?: (field: string, rows: DataRow[]) => number | null;
}

/** Dispatches each PowerBiVisual with real live aggregation, slicing, and cross-filtering. */
export function ChartContainer({
  visual,
  columns,
  allRows,
  reportFilters,
  pageFilters,
  slicerFilters,
  dateRange,
  crossFilter,
  onCrossFilter,
  onToggleSlicerValue,
  onClearSlicerColumn,
  onDateRangeChange,
  measureEval,
}: ChartContainerProps) {
  const [slicerSearch, setSlicerSearch] = useState("");

  // A visual ignores its own emitted cross-filter so bars stay visible for deselection
  const effectiveCross =
    crossFilter && crossFilter.sourceVisualId !== visual.id ? crossFilter : null;

  const scopedRows = useMemo(
    () =>
      applyDatasetFilters(allRows, {
        reportFilters,
        pageFilters,
        slicerFilters: visual.type === "slicer" ? {} : slicerFilters,
        visualFilters: visual.visualFilters,
        crossFilter: effectiveCross,
        dateRange: visual.type === "slicer" ? null : dateRange,
      }),
    [allRows, reportFilters, pageFilters, slicerFilters, visual, effectiveCross, dateRange],
  );

  const sliceColName = visual.xAxis || columns[0]?.name || "";
  const uniqueSlicerValues = useMemo(() => {
    if (visual.type !== "slicer") return [];
    const vals = Array.from(
      new Set(allRows.map((r) => String(r[sliceColName] ?? "")).filter(Boolean)),
    ).sort();
    const q = slicerSearch.trim().toLowerCase();
    return q ? vals.filter((v) => v.toLowerCase().includes(q)) : vals;
  }, [visual.type, allRows, sliceColName, slicerSearch]);

  const grouped = useMemo(
    () =>
      aggregateByDimension(
        scopedRows,
        visual.xAxis,
        visual.yAxis,
        visual.aggregation,
        visual.format.accentColor,
        measureEval,
      ),
    [scopedRows, visual.xAxis, visual.yAxis, visual.aggregation, visual.format.accentColor, measureEval],
  );

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
    const measured = measureEval ? measureEval(field, scopedRows) : null;
    const val = measured !== null ? measured : aggregateKpi(scopedRows, field, visual.aggregation);
    return (
      <MetricCard
        value={val}
        field={field}
        label={meta?.label || field || "Metric"}
        aggregation={visual.aggregation}
        showDataLabels={visual.format.showDataLabels}
      />
    );
  }

  // ---------- TABLE / MATRIX ----------
  if (visual.type === "table" || visual.type === "matrix") {
    const axisCol = visual.xAxis;
    const xMeta = columns.find((c) => c.name === axisCol);
    const yMetas = visual.yAxis
      .map((name) => columns.find((c) => c.name === name))
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
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <DataTable
          columns={tableColumns.length > 0 ? tableColumns : columns.slice(0, 4)}
          rows={tableRows}
          compact
          pageSize={12}
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
                    onCrossFilter({ column: axisCol, value: val, sourceVisualId: visual.id });
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
      onSelectCategory={(cat) => {
        if (!visual.xAxis) return;
        if (crossFilter?.column === visual.xAxis && crossFilter.value === cat) {
          onCrossFilter(null);
        } else {
          onCrossFilter({
            column: visual.xAxis,
            value: cat,
            sourceVisualId: visual.id,
          });
        }
      }}
    />
  );
}
