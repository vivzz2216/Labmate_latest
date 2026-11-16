"use client";

import React, { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, ChevronsRight, Eraser, Filter, Plus, Search } from "lucide-react";
import type { ColumnMeta, DataRow, PowerBiVisual } from "@/lib/powerbi/types";
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
  onToggleFilterValue: (scope: "visual" | "page" | "report", column: string, value: string) => void;
  onClearFilterField: (scope: "visual" | "page" | "report", column: string) => void;
}

/** Authentic collapsible Power BI Filters pane supporting visual, page & report scopes. */
export function FilterPanel({
  expanded,
  onToggleExpand,
  columns,
  rows,
  selectedVisual,
  pageFilters,
  reportFilters,
  onToggleFilterValue,
  onClearFilterField,
}: FilterPanelProps) {
  const [search, setSearch] = useState("");
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});
  const [extraPageField, setExtraPageField] = useState("");

  const categoricalCols = useMemo(
    () => columns.filter((c) => c.type !== "number" && c.uniqueCount <= 40),
    [columns],
  );

  const pageFields = useMemo(() => {
    const keys = new Set<string>(Object.keys(pageFilters));
    if (categoricalCols[0]) keys.add(categoricalCols[0].name);
    if (extraPageField) keys.add(extraPageField);
    return Array.from(keys);
  }, [categoricalCols, pageFilters, extraPageField]);

  const visualFields = useMemo(() => {
    if (!selectedVisual) return [];
    const keys = new Set<string>(Object.keys(selectedVisual.visualFilters));
    if (selectedVisual.xAxis) keys.add(selectedVisual.xAxis);
    return Array.from(keys);
  }, [selectedVisual]);

  const reportFields = useMemo(() => {
    const keys = new Set<string>(Object.keys(reportFilters));
    if (categoricalCols[0] && categoricalCols.length > 1 && categoricalCols[1]) {
      keys.add(categoricalCols[1].name);
    }
    return Array.from(keys);
  }, [categoricalCols, reportFilters]);

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
    const isOpen = Boolean(openCards[cardKey] || active.length > 0);

    const uniqueVals = Array.from(
      new Set(rows.map((r) => String(r[colName] ?? "")).filter(Boolean)),
    ).sort();

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
              {active.length > 0 ? `is ${active.slice(0, 2).join(", ")}${active.length > 2 ? ` +${active.length - 2}` : ""}` : "is (All)"}
            </div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            {active.length > 0 ? (
              <button
                type="button"
                aria-label={`Clear filter for ${colName}`}
                className={styles.visualIconBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onClearFilterField(scope, colName);
                }}
              >
                <Eraser size={11} />
              </button>
            ) : null}
            {isOpen ? <ChevronDown size={13} color="#605e5c" /> : <ChevronRight size={13} color="#605e5c" />}
          </div>
        </div>

        {isOpen ? (
          <div className={styles.filterCardBody}>
            <div style={{ fontSize: 10.5, color: "#605e5c", marginBottom: 4 }}>Basic filtering</div>
            <div style={{ maxHeight: 130, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {filteredVals.slice(0, 25).map((val) => {
                const checked = active.includes(val);
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
          </div>
        ) : null}
      </div>
    );
  };

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
            {visualFields.length > 0 ? (
              visualFields.map((col) => renderScopeCard("visual", col, selectedVisual.visualFilters))
            ) : (
              <div style={{ fontSize: 11, color: "#797775", marginBottom: 6 }}>
                Select an X-axis field to filter this visual.
              </div>
            )}
          </>
        ) : null}

        <div className={styles.filterGroupHeading}>Filters on this page</div>
        {pageFields.map((col) => renderScopeCard("page", col, pageFilters))}

        {categoricalCols.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, marginBottom: 10 }}>
            <Plus size={12} color="#605e5c" />
            <Dropdown
              ariaLabel="Add page filter field"
              placeholder="Add data field here"
              value={extraPageField}
              options={categoricalCols.map((c) => ({ value: c.name, label: c.label }))}
              onChange={(val) => {
                if (val) setExtraPageField(val);
              }}
            />
          </div>
        ) : null}

        <div className={styles.filterGroupHeading}>Filters on all pages</div>
        {reportFields.length > 0 ? (
          reportFields.map((col) => renderScopeCard("report", col, reportFilters))
        ) : (
          <div style={{ fontSize: 11, color: "#797775" }}>
            <Check size={10} style={{ display: "inline", marginRight: 4 }} />
            Applies across every report page
          </div>
        )}
      </div>
    </aside>
  );
}
