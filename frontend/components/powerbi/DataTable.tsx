"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Eraser,
  Filter,
  FunctionSquare,
  Search,
  Table2,
  Trash2,
} from "lucide-react";
import { aggregateKpi, isMissingCellValue } from "@/lib/powerbi/csvEngine";
import type { ColumnMeta, ColumnType, DataRow, DatasetModel } from "@/lib/powerbi/types";
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
  // Enhanced Table View props (used when !compact in Table View mode)
  tables?: DatasetModel[];
  activeTableId?: string;
  onSelectTable?: (tableId: string) => void;
  selectedColName?: string | null;
  onSelectColumn?: (colName: string) => void;
  onRenameColumn?: (oldName: string, newName: string) => void;
  onChangeColumnType?: (colName: string, type: ColumnType) => void;
  onDeleteColumn?: (colName: string) => void;
  onUpdateCalculatedColumn?: (colName: string, formula: string) => string | undefined;
  onOpenNewColumn?: () => void;
  onOpenNewMeasure?: () => void;
  onOpenTransformData?: () => void;
}

/** Sortable Power BI data grid supporting compact canvas Table visual and full Table View with Column Tools & Filters. */
export function DataTable({
  columns,
  rows,
  compact = false,
  pageSize = 25,
  searchable = false,
  onRowClick,
  activeColumn,
  activeValue,
  tables,
  activeTableId,
  onSelectTable,
  selectedColName,
  onSelectColumn,
  onRenameColumn,
  onChangeColumnType,
  onDeleteColumn,
  onUpdateCalculatedColumn,
  onOpenNewColumn,
  onOpenNewMeasure,
  onOpenTransformData,
}: DataTableProps) {
  const [query, setQuery] = useState("");
  const [sortCol, setSortCol] = useState<string>(columns[0]?.name || "");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  // Per-column interactive filter state inside Table View
  const [colFilters, setColFilters] = useState<Record<string, string[]>>({});
  const [openColMenu, setOpenColMenu] = useState<string | null>(null);
  const [colMenuSearch, setColMenuSearch] = useState("");

  // Column rename / formula draft for Column Tools
  const effectiveSelectedCol =
    columns.find((c) => c.name === selectedColName) || columns[0] || null;
  const [renameDraft, setRenameDraft] = useState<string | null>(null);
  const [formulaDraft, setFormulaDraft] = useState<string | null>(null);
  const [formulaErr, setFormulaErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filterEntries = Object.entries(colFilters);

    const matched = rows.filter((r) => {
      for (let i = 0; i < filterEntries.length; i++) {
        const [fCol, allowed] = filterEntries[i];
        if (allowed.length > 0) {
          const val = isMissingCellValue(r[fCol]) ? "(Blank)" : String(r[fCol]);
          if (allowed.indexOf(val) === -1) return false;
        }
      }
      if (!q) return true;
      return columns.some((c) => String(r[c.name] ?? "").toLowerCase().includes(q));
    });

    if (!sortCol) return matched;
    return [...matched].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (av === null && bv === null) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [rows, columns, query, colFilters, sortCol, sortDir]);

  const effectiveRows = compact
    ? filtered.slice(0, pageSize)
    : filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (colName: string, forcedDir?: "asc" | "desc") => {
    if (forcedDir) {
      setSortCol(colName);
      setSortDir(forcedDir);
    } else if (sortCol === colName) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(colName);
      setSortDir("asc");
    }
    setPage(1);
  };

  const toggleColFilterValue = (colName: string, val: string) => {
    setColFilters((prev) => {
      const cur = prev[colName] || [];
      const next = cur.indexOf(val) !== -1 ? cur.filter((x) => x !== val) : [...cur, val];
      const out = { ...prev };
      if (next.length === 0) delete out[colName];
      else out[colName] = next;
      return out;
    });
    setPage(1);
  };

  const selectedColStats = useMemo(() => {
    if (compact || !effectiveSelectedCol) return null;
    const col = effectiveSelectedCol;
    const min = col.isNumeric ? aggregateKpi(filtered, col.name, "min") : undefined;
    const max = col.isNumeric ? aggregateKpi(filtered, col.name, "max") : undefined;
    const avg = col.isNumeric ? aggregateKpi(filtered, col.name, "average") : undefined;
    return { min, max, avg };
  }, [compact, effectiveSelectedCol, filtered]);

  const openMenuValues = useMemo(() => {
    if (!openColMenu) return [];
    const seen = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const v = rows[i][openColMenu];
      seen.add(isMissingCellValue(v) ? "(Blank)" : String(v));
    }
    const vals = Array.from(seen).sort();
    const q = colMenuSearch.trim().toLowerCase();
    return q ? vals.filter((v) => v.toLowerCase().includes(q)) : vals;
  }, [openColMenu, rows, colMenuSearch]);

  const fullMode = !compact && Boolean(onRenameColumn);

  return (
    <div className={styles.tableViewWrap} onClick={() => setOpenColMenu(null)}>
      {fullMode ? (
        <div className={styles.columnToolsBar}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {tables && tables.length > 1 && onSelectTable ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Table2 size={13} color="#117865" />
                <select
                  aria-label="Active table"
                  value={activeTableId || tables[0].id || tables[0].name}
                  onChange={(e) => {
                    onSelectTable(e.target.value);
                    setColFilters({});
                    setPage(1);
                  }}
                  className={styles.chipSelect}
                >
                  {tables.map((t) => (
                    <option key={t.id || t.name} value={t.id || t.name}>
                      {t.name} ({t.rows.length})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {effectiveSelectedCol ? (
              <>
                <span style={{ fontSize: 11, color: "#605e5c", fontWeight: 600 }}>Column:</span>
                <input
                  type="text"
                  aria-label="Rename selected column"
                  value={renameDraft ?? effectiveSelectedCol.name}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && renameDraft && onRenameColumn) {
                      onRenameColumn(effectiveSelectedCol.name, renameDraft);
                      setRenameDraft(null);
                    }
                  }}
                  style={{
                    width: 130,
                    height: 24,
                    padding: "0 6px",
                    border: "1px solid #c8c6c4",
                    borderRadius: 2,
                    fontSize: 11.5,
                    background: "#ffffff",
                  }}
                />
                {renameDraft !== null && renameDraft !== effectiveSelectedCol.name ? (
                  <button
                    type="button"
                    className={styles.ribbonSmBtn}
                    style={{ background: "#117865", color: "#ffffff", fontWeight: 600 }}
                    onClick={() => {
                      onRenameColumn?.(effectiveSelectedCol.name, renameDraft);
                      setRenameDraft(null);
                    }}
                  >
                    Rename
                  </button>
                ) : null}

                {onChangeColumnType ? (
                  <select
                    aria-label="Column data type"
                    value={effectiveSelectedCol.type}
                    onChange={(e) =>
                      onChangeColumnType(effectiveSelectedCol.name, e.target.value as ColumnType)
                    }
                    className={styles.chipSelect}
                  >
                    <option value="text">Data type: Text</option>
                    <option value="number">Data type: Number</option>
                    <option value="date">Data type: Date</option>
                  </select>
                ) : null}

                <button
                  type="button"
                  className={styles.ribbonSmBtn}
                  onClick={() => toggleSort(effectiveSelectedCol.name, "asc")}
                  title="Sort ascending"
                >
                  <ArrowUp size={11} /> Asc
                </button>
                <button
                  type="button"
                  className={styles.ribbonSmBtn}
                  onClick={() => toggleSort(effectiveSelectedCol.name, "desc")}
                  title="Sort descending"
                >
                  <ArrowDown size={11} /> Desc
                </button>

                {columns.length > 1 && onDeleteColumn ? (
                  <button
                    type="button"
                    className={styles.ribbonSmBtn}
                    style={{ color: "#a4262c" }}
                    onClick={() => onDeleteColumn(effectiveSelectedCol.name)}
                    title="Delete selected column"
                  >
                    <Trash2 size={11} /> Delete column
                  </button>
                ) : null}
              </>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {selectedColStats && effectiveSelectedCol ? (
              <span style={{ fontSize: 11, color: "#605e5c" }}>
                Distinct: <strong>{effectiveSelectedCol.uniqueCount}</strong>
                {(effectiveSelectedCol.missingCount ?? 0) > 0
                  ? ` · Missing: ${effectiveSelectedCol.missingCount}`
                  : ""}
                {selectedColStats.avg !== undefined
                  ? ` · Avg: ${selectedColStats.avg.toFixed(1)}`
                  : ""}
              </span>
            ) : null}
            {onOpenNewColumn ? (
              <button type="button" className={styles.ribbonSmBtn} onClick={onOpenNewColumn}>
                <FunctionSquare size={12} color="#117865" /> New column
              </button>
            ) : null}
            {onOpenNewMeasure ? (
              <button type="button" className={styles.ribbonSmBtn} onClick={onOpenNewMeasure}>
                New measure
              </button>
            ) : null}
            {onOpenTransformData ? (
              <button type="button" className={styles.ribbonSmBtn} onClick={onOpenTransformData}>
                Transform data
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {fullMode && effectiveSelectedCol?.isCalculated ? (
        <div className={styles.formulaBar}>
          <span className={styles.formulaFx}>fx</span>
          <input
            type="text"
            aria-label="Calculated column formula bar"
            value={formulaDraft ?? `${effectiveSelectedCol.name} = ${effectiveSelectedCol.formula || ""}`}
            onChange={(e) => {
              setFormulaDraft(e.target.value);
              setFormulaErr(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && formulaDraft !== null && onUpdateCalculatedColumn) {
                const eqIdx = formulaDraft.indexOf("=");
                const expr = eqIdx !== -1 ? formulaDraft.slice(eqIdx + 1).trim() : formulaDraft;
                const err = onUpdateCalculatedColumn(effectiveSelectedCol.name, expr);
                if (err) setFormulaErr(err);
                else setFormulaDraft(null);
              }
            }}
            className={styles.formulaInput}
          />
          {formulaDraft !== null ? (
            <button
              type="button"
              className={styles.ribbonSmBtn}
              style={{ background: "#117865", color: "#ffffff" }}
              onClick={() => {
                if (!onUpdateCalculatedColumn) return;
                const eqIdx = formulaDraft.indexOf("=");
                const expr = eqIdx !== -1 ? formulaDraft.slice(eqIdx + 1).trim() : formulaDraft;
                const err = onUpdateCalculatedColumn(effectiveSelectedCol.name, expr);
                if (err) setFormulaErr(err);
                else setFormulaDraft(null);
              }}
            >
              Apply
            </button>
          ) : null}
          {formulaErr ? (
            <span style={{ fontSize: 11, color: "#a4262c" }}>{formulaErr}</span>
          ) : null}
        </div>
      ) : null}

      {searchable ? (
        <div className={styles.tableViewToolbar}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative", width: 250, maxWidth: "100%" }}>
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
            {Object.keys(colFilters).length > 0 ? (
              <button
                type="button"
                className={styles.ribbonSmBtn}
                onClick={() => setColFilters({})}
              >
                <Eraser size={11} /> Clear table filters
              </button>
            ) : null}
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
              {columns.map((col) => {
                const isSelectedCol = fullMode && effectiveSelectedCol?.name === col.name;
                const hasFilter = (colFilters[col.name]?.length ?? 0) > 0;
                return (
                  <th
                    key={col.name}
                    onClick={() => {
                      if (fullMode && onSelectColumn) {
                        onSelectColumn(col.name);
                        setRenameDraft(null);
                        setFormulaDraft(null);
                        setFormulaErr(null);
                      } else {
                        toggleSort(col.name);
                      }
                    }}
                    style={{
                      background: isSelectedCol ? "#e6f2ef" : undefined,
                      position: "sticky",
                      top: 0,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span
                        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                        onClick={(e) => {
                          if (fullMode) {
                            e.stopPropagation();
                            onSelectColumn?.(col.name);
                            setRenameDraft(null);
                            setFormulaDraft(null);
                          }
                        }}
                      >
                        {col.isCalculated ? (
                          <span style={{ fontSize: 10, color: "#117865", fontStyle: "italic" }}>fx</span>
                        ) : null}
                        {col.label}
                        {sortCol === col.name ? (
                          sortDir === "asc" ? (
                            <ArrowUp size={11} color="#117865" />
                          ) : (
                            <ArrowDown size={11} color="#117865" />
                          )
                        ) : null}
                      </span>

                      {fullMode ? (
                        <button
                          type="button"
                          aria-label={`Sort or filter ${col.label}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setColMenuSearch("");
                            setOpenColMenu((cur) => (cur === col.name ? null : col.name));
                          }}
                          style={{
                            border: 0,
                            background: hasFilter ? "#117865" : "transparent",
                            color: hasFilter ? "#ffffff" : "#605e5c",
                            borderRadius: 2,
                            padding: "1px 3px",
                            display: "inline-flex",
                            alignItems: "center",
                            cursor: "pointer",
                          }}
                        >
                          {hasFilter ? <Filter size={10} /> : <ChevronDown size={11} />}
                        </button>
                      ) : null}
                    </div>

                    {fullMode && openColMenu === col.name ? (
                      <div
                        className={styles.colHeaderPopover}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className={styles.popoverActionBtn}
                          onClick={() => {
                            toggleSort(col.name, "asc");
                            setOpenColMenu(null);
                          }}
                        >
                          <ArrowUp size={11} /> Sort Ascending
                        </button>
                        <button
                          type="button"
                          className={styles.popoverActionBtn}
                          onClick={() => {
                            toggleSort(col.name, "desc");
                            setOpenColMenu(null);
                          }}
                        >
                          <ArrowDown size={11} /> Sort Descending
                        </button>
                        <div style={{ borderTop: "1px solid #e1dfdd", margin: "4px 0", paddingTop: 4 }}>
                          <input
                            type="text"
                            placeholder="Filter values..."
                            value={colMenuSearch}
                            onChange={(e) => setColMenuSearch(e.target.value)}
                            style={{
                              width: "100%",
                              height: 22,
                              padding: "0 6px",
                              border: "1px solid #c8c6c4",
                              borderRadius: 2,
                              fontSize: 11,
                              marginBottom: 4,
                            }}
                          />
                          <div style={{ maxHeight: 140, overflowY: "auto", display: "grid", gap: 2 }}>
                            {openMenuValues.slice(0, 40).map((val) => {
                              const checked = (colFilters[col.name] || []).indexOf(val) !== -1;
                              return (
                                <label
                                  key={val}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    fontSize: 11,
                                    fontWeight: 400,
                                    cursor: "pointer",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleColFilterValue(col.name, val)}
                                    style={{ accentColor: "#117865" }}
                                  />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {val}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                          {hasFilter ? (
                            <button
                              type="button"
                              className={styles.popoverActionBtn}
                              style={{ marginTop: 4, color: "#117865", fontWeight: 600 }}
                              onClick={() => {
                                setColFilters((prev) => {
                                  const out = { ...prev };
                                  delete out[col.name];
                                  return out;
                                });
                              }}
                            >
                              Clear filter
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </th>
                );
              })}
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
                    const isBlank = val === null || val === undefined || val === "";
                    const formatted = isBlank
                      ? ""
                      : typeof val === "number"
                        ? val.toLocaleString("en-US", { maximumFractionDigits: 2 })
                        : String(val);
                    const highlightCol = fullMode && effectiveSelectedCol?.name === col.name;
                    return (
                      <td
                        key={col.name}
                        style={{
                          textAlign: col.isNumeric ? "right" : "left",
                          background: highlightCol ? "rgba(17, 120, 101, 0.04)" : undefined,
                          color: isBlank ? "#a19f9d" : undefined,
                        }}
                      >
                        {isBlank ? "—" : formatted}
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
