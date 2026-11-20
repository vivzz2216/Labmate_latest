"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsRight, Eraser, Filter, Plus, Search, X } from "lucide-react";
import type { ColumnMeta, DataRow, NumericRangeFilter, PowerBiVisual } from "@/lib/powerbi/types";
import type { DraggedFieldPayload } from "./DashboardCard";
import { Dropdown } from "./Dropdown";
import styles from "./powerbi.module.css";

interface FilterPanelProps {
  expanded: boolean;
  onToggleExpand: () => void;
  columns: ColumnMeta[];
  rows: DataRow[];
  selectedVisual: PowerBiVisual | null;
  pageFilters: Record<string, string[]>;
  reportFilters: Record<string, string[]>;
  numericFilters?: Record<string, NumericRangeFilter>;
  onToggleFilterValue: (scope: "visual" | "page" | "report", column: string, value: string) => void;
  onClearFilterField: (scope: "visual" | "page" | "report", column: string) => void;
  onUpdateNumericFilter: (column: string, bounds: NumericRangeFilter | null) => void;
}

/** Authentic collapsible Power BI Filters pane supporting categorical checklists, numeric ranges, and field drag-and-drop. */
export function FilterPanel({
  expanded,
  onToggleExpand,
  columns,
  rows,
  selectedVisual,
  pageFilters,
  reportFilters,
  numericFilters = {},
  onToggleFilterValue,
  onClearFilterField,
  onUpdateNumericFilter,
}: FilterPanelProps) {
  const [search, setSearch] = useState("");
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});
  const [addedPageFields, setAddedPageFields] = useState<string[]>([]);
  const [addedReportFields, setAddedReportFields] = useState<string[]>([]);
  const [addedVisualFields, setAddedVisualFields] = useState<string[]>([]);
  const [dropZone, setDropZone] = useState<"visual" | "page" | "report" | null>(null);

  const categoricalCols = useMemo(
    () => columns.filter((c) => c.type !== "number" && c.uniqueCount <= 40),
    [columns],
  );

  const pageFields = useMemo(() => {
    const keys = new Set<string>(Object.keys(pageFilters));
    if (categoricalCols[0]) keys.add(categoricalCols[0].name);
    for (let i = 0; i < addedPageFields.length; i++) keys.add(addedPageFields[i]);
    const numKeys = Object.keys(numericFilters);
    for (let i = 0; i < numKeys.length; i++) keys.add(numKeys[i]);
    return Array.from(keys);
  }, [categoricalCols, pageFilters, addedPageFields, numericFilters]);

  const visualFields = useMemo(() => {
    if (!selectedVisual) return [];
    const keys = new Set<string>(Object.keys(selectedVisual.visualFilters));
    if (selectedVisual.xAxis) keys.add(selectedVisual.xAxis);
    for (let i = 0; i < addedVisualFields.length; i++) keys.add(addedVisualFields[i]);
    return Array.from(keys);
  }, [selectedVisual, addedVisualFields]);

  const reportFields = useMemo(() => {
    const keys = new Set<string>(Object.keys(reportFilters));
    if (categoricalCols[1]) keys.add(categoricalCols[1].name);
    for (let i = 0; i < addedReportFields.length; i++) keys.add(addedReportFields[i]);
    return Array.from(keys);
  }, [categoricalCols, reportFilters, addedReportFields]);

  const addFieldToScope = (scope: "visual" | "page" | "report", colName: string) => {
    if (!colName) return;
    if (scope === "page" && addedPageFields.indexOf(colName) === -1) {
      setAddedPageFields((p) => [...p, colName]);
    } else if (scope === "report" && addedReportFields.indexOf(colName) === -1) {
      setAddedReportFields((p) => [...p, colName]);
    } else if (scope === "visual" && addedVisualFields.indexOf(colName) === -1) {
      setAddedVisualFields((p) => [...p, colName]);
    }
    setOpenCards((p) => ({ ...p, [`${scope}:${colName}`]: true }));
  };

  const handleScopeDrop = (e: React.DragEvent, scope: "visual" | "page" | "report") => {
    setDropZone(null);
    const raw = e.dataTransfer.getData("application/x-powerbi-field");
    if (!raw) return;
    e.preventDefault();
    try {
      const payload = JSON.parse(raw) as DraggedFieldPayload;
      if (payload?.columnName && !payload.isMeasure) {
        addFieldToScope(scope, payload.columnName);
      }
    } catch {
      // ignore
    }
  };

  if (!expanded) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label="Expand Filters pane"
        onClick={onToggleExpand}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggleExpand();
        }}
        className={styles.paneCollapsed}
      >
        <ChevronsRight size={14} style={{ transform: "rotate(180deg)", color: "#605e5c" }} />
        <Filter size={13} color="#605e5c" />
        <span className={styles.paneVerticalLabel}>Filters</span>
      </div>
    );
  }

  const renderScopeCard = (
    scope: "visual" | "page" | "report",
    colName: string,
    activeMap: Record<string, string[]>,
  ) => {
    const cardKey = `${scope}:${colName}`;
    const meta = columns.find((c) => c.name === colName);
    const active = activeMap[colName] || [];
    const numBound = numericFilters[colName];
    const hasNumericActive = Boolean(
      scope === "page" && numBound && (numBound.min !== undefined || numBound.max !== undefined),
    );
    const isOpen = Boolean(openCards[cardKey] || active.length > 0 || hasNumericActive);

    const uniqueSet = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const v = rows[i][colName];
      if (v !== null && v !== undefined && String(v) !== "") uniqueSet.add(String(v));
    }
    const uniqueVals = Array.from(uniqueSet).sort();

    const filteredVals = search.trim()
      ? uniqueVals.filter((v) => v.toLowerCase().includes(search.trim().toLowerCase()))
      : uniqueVals;

    return (
      <div key={cardKey} className={styles.filterCard}>
        <div
          className={styles.filterCardHead}
          onClick={() => setOpenCards((prev) => ({ ...prev, [cardKey]: !isOpen }))}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: "#252423", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {meta?.label || colName}
            </div>
            <div style={{ fontSize: 10.5, color: "#605e5c" }}>
              {hasNumericActive
                ? `${numBound?.min ?? meta?.min ?? "…"} to ${numBound?.max ?? meta?.max ?? "…"}`
                : active.length > 0
                  ? `is ${active.slice(0, 2).join(", ")}${active.length > 2 ? ` +${active.length - 2}` : ""}`
                  : "is (All)"}
            </div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            {active.length > 0 || hasNumericActive ? (
              <button
                type="button"
                aria-label={`Clear filter for ${colName}`}
                className={styles.visualIconBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onClearFilterField(scope, colName);
                  if (hasNumericActive) onUpdateNumericFilter(colName, null);
                }}
              >
                <Eraser size={11} />
              </button>
            ) : null}
            {(addedPageFields.indexOf(colName) !== -1 ||
              addedReportFields.indexOf(colName) !== -1 ||
              addedVisualFields.indexOf(colName) !== -1) ? (
              <button
                type="button"
                aria-label={`Remove ${colName} filter card`}
                className={styles.visualIconBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onClearFilterField(scope, colName);
                  if (hasNumericActive) onUpdateNumericFilter(colName, null);
                  if (scope === "page") setAddedPageFields((p) => p.filter((x) => x !== colName));
                  if (scope === "report") setAddedReportFields((p) => p.filter((x) => x !== colName));
                  if (scope === "visual") setAddedVisualFields((p) => p.filter((x) => x !== colName));
                }}
              >
                <X size={11} />
              </button>
            ) : null}
            {isOpen ? <ChevronDown size={13} color="#605e5c" /> : <ChevronRight size={13} color="#605e5c" />}
          </div>
        </div>

        {isOpen ? (
          <div className={styles.filterCardBody}>
            {meta?.isNumeric && scope === "page" ? (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 10.5, color: "#605e5c" }}>
                  Numeric range ({meta.min ?? 0} – {meta.max ?? 0})
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  <input
                    type="number"
                    placeholder="Min"
                    aria-label={`${colName} minimum`}
                    value={numBound?.min ?? ""}
                    onChange={(e) =>
                      onUpdateNumericFilter(colName, {
                        ...(numBound || {}),
                        min: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      height: 24,
                      padding: "0 5px",
                      border: "1px solid #c8c6c4",
                      borderRadius: 2,
                      fontSize: 11,
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    aria-label={`${colName} maximum`}
                    value={numBound?.max ?? ""}
                    onChange={(e) =>
                      onUpdateNumericFilter(colName, {
                        ...(numBound || {}),
                        max: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      height: 24,
                      padding: "0 5px",
                      border: "1px solid #c8c6c4",
                      borderRadius: 2,
                      fontSize: 11,
                    }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 10.5, color: "#605e5c", marginBottom: 4 }}>Basic filtering</div>
                <div style={{ maxHeight: 130, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                  {filteredVals.slice(0, 25).map((val) => {
                    const checked = active.indexOf(val) !== -1;
                    return (
                      <label
                        key={val}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 11,
                          padding: "2px 0",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleFilterValue(scope, colName, val)}
                          style={{ accentColor: "#252423", width: 12, height: 12 }}
                        />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {val}
                        </span>
                      </label>
                    );
                  })}
                  {filteredVals.length === 0 ? (
                    <span style={{ fontSize: 11, color: "#797775" }}>No matching values</span>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  const renderDropWell = (scope: "visual" | "page" | "report", placeholder: string) => (
    <div
      className={`${styles.fieldWellDropBox} ${dropZone === scope ? styles.fieldWellDropActive : ""}`}
      style={{ marginBottom: 10 }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.indexOf("application/x-powerbi-field") !== -1) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          if (dropZone !== scope) setDropZone(scope);
        }
      }}
      onDragLeave={() => setDropZone(null)}
      onDrop={(e) => handleScopeDrop(e, scope)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <Plus size={11} color="#605e5c" />
        <Dropdown
          ariaLabel={`Add ${scope} filter field`}
          placeholder={placeholder}
          value=""
          options={columns.map((c) => ({ value: c.name, label: c.label }))}
          onChange={(val) => addFieldToScope(scope, val)}
        />
      </div>
    </div>
  );

  return (
    <aside className={styles.paneExpanded} aria-label="Filters pane">
      <div className={styles.paneHeader}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Filter size={13} color="#605e5c" />
          Filters
        </span>
        <button
          type="button"
          className={styles.visualIconBtn}
          aria-label="Collapse Filters pane"
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
            aria-label="Search filter values"
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

        {selectedVisual ? (
          <>
            <div className={styles.filterGroupHeading}>Filters on this visual</div>
            {visualFields.map((col) => renderScopeCard("visual", col, selectedVisual.visualFilters))}
            {columns.length > 0 ? renderDropWell("visual", "Add visual filter field") : null}
          </>
        ) : null}

        <div className={styles.filterGroupHeading}>Filters on this page</div>
        {pageFields.map((col) => renderScopeCard("page", col, pageFilters))}
        {columns.length > 0 ? renderDropWell("page", "Add page filter field") : null}

        <div className={styles.filterGroupHeading}>Filters on all pages</div>
        {reportFields.map((col) => renderScopeCard("report", col, reportFilters))}
        {columns.length > 0 ? renderDropWell("report", "Add all-page filter field") : null}
      </div>
    </aside>
  );
}
