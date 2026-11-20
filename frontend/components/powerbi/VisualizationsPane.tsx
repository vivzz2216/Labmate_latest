"use client";

import React, { useMemo, useState } from "react";
import { BarChart3, ChevronsRight, LineChart, Paintbrush, Plus, X } from "lucide-react";
import { aggregateByDimension, formatPowerBiNumber } from "@/lib/powerbi/csvEngine";
import { POWERBI_SERIES_PALETTE } from "@/lib/powerbi/palette";
import type {
  AggregationFn,
  ColumnMeta,
  DataRow,
  MeasureDef,
  PowerBiVisual,
  PowerBiVisualType,
  VisualAnalytics,
  VisualLayout,
} from "@/lib/powerbi/types";
import type { DraggedFieldPayload } from "./DashboardCard";
import { Dropdown } from "./Dropdown";
import { DESKTOP_VIZ_GRID_TILES, DesktopVizTileGlyph } from "./VisualIcons";
import styles from "./powerbi.module.css";

interface VisualizationsPaneProps {
  expanded: boolean;
  onToggleExpand: () => void;
  columns: ColumnMeta[];
  measures: MeasureDef[];
  scopedRows: DataRow[];
  selectedVisual: PowerBiVisual | null;
  onSelectVisualType: (type: PowerBiVisualType) => void;
  onUpdateFields: (patch: {
    xAxis?: string;
    yAxis?: string[];
    legend?: string;
    aggregation?: AggregationFn;
    perFieldAggregations?: Record<string, AggregationFn>;
    sortBy?: "value" | "category";
    sortDir?: "asc" | "desc";
  }) => void;
  onUpdateFormat: (
    patch: Partial<PowerBiVisual["format"]>,
    nextTitle?: string,
    extraPatch?: Partial<PowerBiVisual>,
  ) => void;
  onUpdateLayout: (nextLayout: VisualLayout) => void;
  onUpdateAnalytics: (next: VisualAnalytics) => void;
  onDropFieldToWell: (
    well: "xAxis" | "yAxis" | "legend",
    payload: DraggedFieldPayload,
  ) => void;
}

const CANVAS_BG_SWATCHES = ["#ffffff", "#faf9f8", "#f3f2f1", "#eef5f3", "#eef6fc"];

/** Right docked Visualizations pane matching Power BI Desktop: Build, Format, Analytics, drag-drop field wells & real stats. */
export function VisualizationsPane({
  expanded,
  onToggleExpand,
  columns,
  measures,
  scopedRows,
  selectedVisual,
  onSelectVisualType,
  onUpdateFields,
  onUpdateFormat,
  onUpdateLayout,
  onUpdateAnalytics,
  onDropFieldToWell,
}: VisualizationsPaneProps) {
  const [subTab, setSubTab] = useState<"build" | "format" | "analytics">("build");
  const [addYField, setAddYField] = useState("");
  const [dragTargetWell, setDragTargetWell] = useState<"xAxis" | "yAxis" | "legend" | null>(null);

  const analyticsStats = useMemo(() => {
    if (!selectedVisual || selectedVisual.yAxis.length === 0 || scopedRows.length === 0) {
      return null;
    }
    const grouped = aggregateByDimension(
      scopedRows,
      selectedVisual.xAxis,
      selectedVisual.yAxis,
      selectedVisual.aggregation,
      selectedVisual.format.accentColor,
      {
        measures,
        columns,
        perFieldAggregations: selectedVisual.perFieldAggregations,
      },
    );
    const key = grouped.series[0]?.key || selectedVisual.yAxis[0];
    const vals = grouped.rows.map((r) => r.values[key] ?? 0);
    if (vals.length === 0) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return {
      field: selectedVisual.yAxis[0],
      count: vals.length,
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: sum / vals.length,
    };
  }, [selectedVisual, scopedRows, measures, columns]);

  if (!expanded) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label="Expand Visualizations pane"
        onClick={onToggleExpand}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggleExpand();
        }}
        className={styles.paneCollapsed}
      >
        <ChevronsRight size={14} style={{ transform: "rotate(180deg)", color: "#605e5c" }} />
        <BarChart3 size={13} color="#605e5c" />
        <span className={styles.paneVerticalLabel}>Visualizations</span>
      </div>
    );
  }

  const allColsOptions = columns.map((c) => ({ value: c.name, label: c.label }));
  const numericAndMeasureOptions = [
    ...measures.map((m) => ({ value: m.name, label: `${m.name} (fx)` })),
    ...columns.map((c) => ({
      value: c.name,
      label: c.isNumeric ? `${c.label} (Σ)` : c.label,
    })),
  ];

  const handleWellDragOver = (
    e: React.DragEvent,
    well: "xAxis" | "yAxis" | "legend",
  ) => {
    if (e.dataTransfer.types.indexOf("application/x-powerbi-field") !== -1) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (dragTargetWell !== well) setDragTargetWell(well);
    }
  };

  const handleWellDrop = (e: React.DragEvent, well: "xAxis" | "yAxis" | "legend") => {
    setDragTargetWell(null);
    const raw = e.dataTransfer.getData("application/x-powerbi-field");
    if (!raw) return;
    e.preventDefault();
    try {
      const payload = JSON.parse(raw) as DraggedFieldPayload;
      if (payload?.columnName) onDropFieldToWell(well, payload);
    } catch {
      // ignore
    }
  };

  const vType = selectedVisual?.type;
  const showsXAxis =
    selectedVisual && vType !== "card" && vType !== "gauge" && vType !== "textbox";
  const showsLegendWell =
    selectedVisual &&
    (vType === "clusteredColumn" ||
      vType === "stackedColumn" ||
      vType === "clusteredBar" ||
      vType === "stackedBar" ||
      vType === "line" ||
      vType === "area" ||
      vType === "scatter" ||
      vType === "matrix");
  const showsYAxis = selectedVisual && vType !== "slicer" && vType !== "textbox";

  const xAxisLabel =
    vType === "slicer"
      ? "Field"
      : vType === "matrix"
        ? "Rows"
        : vType === "pie" || vType === "donut" || vType === "treemap" || vType === "funnel"
          ? "Legend"
          : vType === "table"
            ? "Primary Column"
            : "X-axis / Category";

  const legendLabel = vType === "matrix" ? "Columns" : "Legend";
  const yAxisLabel =
    vType === "card" || vType === "gauge"
      ? "Fields"
      : vType === "table"
        ? "Additional Columns"
        : "Y-axis / Values";

  const subHeading =
    subTab === "build"
      ? "Build visual"
      : subTab === "format"
        ? "Format your visual"
        : "Analytics";

  return (
    <aside className={styles.paneExpanded} aria-label="Visualizations pane">
      <div className={styles.paneHeader}>
        <span>Visualizations</span>
        <button
          type="button"
          className={styles.visualIconBtn}
          aria-label="Collapse Visualizations pane"
          onClick={onToggleExpand}
        >
          <ChevronsRight size={14} />
        </button>
      </div>

      <div className={styles.vizSubHeader}>{subHeading}</div>

      <div className={styles.vizModeTabsIconRow} role="group" aria-label="Visualization pane sections">
        <button
          type="button"
          aria-pressed={subTab === "build"}
          aria-label="Build visual"
          title="Build visual"
          onClick={() => setSubTab("build")}
          className={`${styles.vizModeIconBtn} ${subTab === "build" ? styles.vizModeIconBtnActive : ""}`}
        >
          <span className={styles.vizModeIconBox}>
            <BarChart3 size={15} color={subTab === "build" ? "#117865" : "#484644"} />
          </span>
        </button>

        <button
          type="button"
          aria-pressed={subTab === "format"}
          aria-label="Format visual"
          title="Format your visual"
          onClick={() => setSubTab("format")}
          className={`${styles.vizModeIconBtn} ${subTab === "format" ? styles.vizModeIconBtnActive : ""}`}
        >
          <span className={styles.vizModeIconBox}>
            <Paintbrush size={15} color={subTab === "format" ? "#117865" : "#484644"} />
          </span>
        </button>

        <button
          type="button"
          aria-pressed={subTab === "analytics"}
          aria-label="Analytics"
          title="Add reference & average lines"
          onClick={() => setSubTab("analytics")}
          className={`${styles.vizModeIconBtn} ${subTab === "analytics" ? styles.vizModeIconBtnActive : ""}`}
        >
          <span className={styles.vizModeIconBox}>
            <LineChart size={15} color={subTab === "analytics" ? "#117865" : "#484644"} />
          </span>
        </button>
      </div>

      <div className={styles.paneBodyScroll}>
        {subTab === "build" ? (
          <>
            <div className={styles.vizIconGrid} role="group" aria-label="Visualization types">
              {DESKTOP_VIZ_GRID_TILES.map((tile) => {
                const isSelected = selectedVisual?.type === tile.id;
                return (
                  <button
                    key={tile.id}
                    type="button"
                    title={tile.label}
                    aria-label={tile.label}
                    onClick={() => onSelectVisualType(tile.id)}
                    className={`${styles.vizTileBtn} ${isSelected ? styles.vizTileActive : ""}`}
                  >
                    <DesktopVizTileGlyph tileId={tile.id} />
                  </button>
                );
              })}
            </div>

            {selectedVisual ? (
              <>
                {vType === "textbox" ? (
                  <div className={styles.fieldWellSection}>
                    <div className={styles.fieldWellLabel}>
                      <span>Text box content</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#605e5c", lineHeight: 1.45 }}>
                      Click inside the text box on the canvas to edit your report commentary or heading.
                    </div>
                  </div>
                ) : null}

                {showsXAxis ? (
                  <div className={styles.fieldWellSection}>
                    <div className={styles.fieldWellLabel}>
                      <span>{xAxisLabel}</span>
                    </div>
                    <div
                      className={`${styles.fieldWellDropBox} ${dragTargetWell === "xAxis" ? styles.fieldWellDropActive : ""}`}
                      onDragOver={(e) => handleWellDragOver(e, "xAxis")}
                      onDragLeave={() => setDragTargetWell(null)}
                      onDrop={(e) => handleWellDrop(e, "xAxis")}
                    >
                      {selectedVisual.xAxis ? (
                        <div className={styles.fieldChip}>
                          <span className={styles.fieldChipName}>{selectedVisual.xAxis}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${selectedVisual.xAxis} from X-axis`}
                            onClick={() => onUpdateFields({ xAxis: undefined })}
                            className={styles.chipRemoveBtn}
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ) : null}
                      <Dropdown
                        ariaLabel="X-axis field"
                        placeholder="Drag or select field"
                        value={selectedVisual.xAxis || ""}
                        options={allColsOptions}
                        onChange={(val) => onUpdateFields({ xAxis: val || undefined })}
                      />
                    </div>
                  </div>
                ) : null}

                {showsLegendWell ? (
                  <div className={styles.fieldWellSection}>
                    <div className={styles.fieldWellLabel}>
                      <span>{legendLabel}</span>
                    </div>
                    <div
                      className={`${styles.fieldWellDropBox} ${dragTargetWell === "legend" ? styles.fieldWellDropActive : ""}`}
                      onDragOver={(e) => handleWellDragOver(e, "legend")}
                      onDragLeave={() => setDragTargetWell(null)}
                      onDrop={(e) => handleWellDrop(e, "legend")}
                    >
                      {selectedVisual.legend ? (
                        <div className={styles.fieldChip}>
                          <span className={styles.fieldChipName}>{selectedVisual.legend}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${selectedVisual.legend} from Legend`}
                            onClick={() => onUpdateFields({ legend: undefined })}
                            className={styles.chipRemoveBtn}
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ) : null}
                      <Dropdown
                        ariaLabel="Legend field"
                        placeholder="Optional legend column"
                        value={selectedVisual.legend || ""}
                        options={allColsOptions.filter((o) => o.value !== selectedVisual.xAxis)}
                        onChange={(val) => onUpdateFields({ legend: val || undefined })}
                      />
                    </div>
                  </div>
                ) : null}

                {showsYAxis ? (
                  <div className={styles.fieldWellSection}>
                    <div className={styles.fieldWellLabel}>
                      <span>{yAxisLabel}</span>
                    </div>
                    <div
                      className={`${styles.fieldWellDropBox} ${dragTargetWell === "yAxis" ? styles.fieldWellDropActive : ""}`}
                      onDragOver={(e) => handleWellDragOver(e, "yAxis")}
                      onDragLeave={() => setDragTargetWell(null)}
                      onDrop={(e) => handleWellDrop(e, "yAxis")}
                    >
                      {selectedVisual.yAxis.map((field) => {
                        const isMeasure = measures.some((m) => m.name === field);
                        const fieldAgg =
                          selectedVisual.perFieldAggregations?.[field] ||
                          selectedVisual.aggregation;
                        return (
                          <div key={field} className={styles.fieldChip}>
                            <span className={styles.fieldChipName} title={field}>
                              {field}
                            </span>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                              {!isMeasure && vType !== "table" ? (
                                <select
                                  aria-label={`Aggregation for ${field}`}
                                  value={fieldAgg}
                                  onChange={(e) =>
                                    onUpdateFields({
                                      perFieldAggregations: {
                                        ...(selectedVisual.perFieldAggregations || {}),
                                        [field]: e.target.value as AggregationFn,
                                      },
                                    })
                                  }
                                  className={styles.chipAggSelect}
                                >
                                  <option value="sum">Sum</option>
                                  <option value="average">Avg</option>
                                  <option value="count">Count</option>
                                  <option value="min">Min</option>
                                  <option value="max">Max</option>
                                </select>
                              ) : isMeasure ? (
                                <span style={{ fontSize: 9.5, color: "#117865", fontWeight: 700 }}>
                                  fx
                                </span>
                              ) : null}
                              <button
                                type="button"
                                aria-label={`Remove ${field} from Y-axis`}
                                onClick={() =>
                                  onUpdateFields({
                                    yAxis: selectedVisual.yAxis.filter((f) => f !== field),
                                  })
                                }
                                className={styles.chipRemoveBtn}
                              >
                                <X size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Plus size={11} color="#605e5c" />
                        <Dropdown
                          ariaLabel="Add value field"
                          placeholder="Drag or add value"
                          value={addYField}
                          options={numericAndMeasureOptions.filter(
                            (o) => selectedVisual.yAxis.indexOf(o.value) === -1,
                          )}
                          onChange={(val) => {
                            if (!val) return;
                            const next =
                              vType === "card" || vType === "gauge"
                                ? [val]
                                : [...selectedVisual.yAxis, val];
                            onUpdateFields({ yAxis: next });
                            setAddYField("");
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                {vType !== "textbox" && vType !== "slicer" ? (
                  <div className={styles.fieldWellSection}>
                    <div className={styles.fieldWellLabel}>
                      <span>Sort &amp; Summarization</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      <Dropdown
                        ariaLabel="Sort axis"
                        value={selectedVisual.sortBy || "value"}
                        options={[
                          { value: "value", label: "By Value" },
                          { value: "category", label: "By Category" },
                        ]}
                        onChange={(val) =>
                          onUpdateFields({ sortBy: (val || "value") as "value" | "category" })
                        }
                      />
                      <Dropdown
                        ariaLabel="Sort direction"
                        value={selectedVisual.sortDir || "desc"}
                        options={[
                          { value: "desc", label: "Descending" },
                          { value: "asc", label: "Ascending" },
                        ]}
                        onChange={(val) =>
                          onUpdateFields({ sortDir: (val || "desc") as "asc" | "desc" })
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className={styles.fieldWellSection}>
                <div className={styles.emptyFieldWellPlaceholder}>
                  Click a chart icon above or drag fields onto the canvas to create a visual.
                </div>
              </div>
            )}
          </>
        ) : subTab === "format" ? (
          selectedVisual ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                  Title text
                </label>
                <input
                  type="text"
                  aria-label="Visual title"
                  value={selectedVisual.title}
                  onChange={(e) => onUpdateFormat({}, e.target.value)}
                  style={{
                    width: "100%",
                    height: 26,
                    padding: "0 7px",
                    border: "1px solid #c8c6c4",
                    borderRadius: 2,
                    fontSize: 11.5,
                  }}
                />
              </div>

              {selectedVisual.type === "textbox" ? (
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                    Text font size (px)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={48}
                    value={selectedVisual.fontSize || 14}
                    onChange={(e) =>
                      onUpdateFormat({}, undefined, {
                        fontSize: Math.max(10, Math.min(48, Number(e.target.value) || 14)),
                      })
                    }
                    style={{
                      width: "100%",
                      height: 26,
                      padding: "0 7px",
                      border: "1px solid #c8c6c4",
                      borderRadius: 2,
                      fontSize: 11.5,
                    }}
                  />
                </div>
              ) : null}

              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, cursor: "pointer" }}>
                <span>Show title</span>
                <input
                  type="checkbox"
                  checked={selectedVisual.format.showTitle}
                  onChange={(e) => onUpdateFormat({ showTitle: e.target.checked })}
                  style={{ accentColor: "#117865" }}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, cursor: "pointer" }}>
                <span>Data labels</span>
                <input
                  type="checkbox"
                  checked={selectedVisual.format.showDataLabels}
                  onChange={(e) => onUpdateFormat({ showDataLabels: e.target.checked })}
                  style={{ accentColor: "#117865" }}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, cursor: "pointer" }}>
                <span>Legend</span>
                <input
                  type="checkbox"
                  checked={selectedVisual.format.showLegend}
                  onChange={(e) => onUpdateFormat({ showLegend: e.target.checked })}
                  style={{ accentColor: "#117865" }}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, cursor: "pointer" }}>
                <span>Visual border</span>
                <input
                  type="checkbox"
                  checked={selectedVisual.format.showBorder}
                  onChange={(e) => onUpdateFormat({ showBorder: e.target.checked })}
                  style={{ accentColor: "#117865" }}
                />
              </label>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Series accent color</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {POWERBI_SERIES_PALETTE.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Accent color ${hex}`}
                      onClick={() => onUpdateFormat({ accentColor: hex })}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 3,
                        background: hex,
                        border:
                          selectedVisual.format.accentColor === hex
                            ? "2px solid #252423"
                            : "1px solid #c8c6c4",
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Card background</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {CANVAS_BG_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Background color ${hex}`}
                      onClick={() => onUpdateFormat({ backgroundColor: hex })}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 3,
                        background: hex,
                        border:
                          selectedVisual.format.backgroundColor === hex
                            ? "2px solid #117865"
                            : "1px solid #c8c6c4",
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ borderTop: "1px solid #e1dfdd", paddingTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Size &amp; Position (px)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {(
                    [
                      ["X", "x"],
                      ["Y", "y"],
                      ["Width", "w"],
                      ["Height", "h"],
                    ] as Array<[string, keyof VisualLayout]>
                  ).map(([lbl, key]) => (
                    <label key={key} style={{ fontSize: 10.5, color: "#605e5c" }}>
                      {lbl}
                      <input
                        type="number"
                        value={Math.round(selectedVisual.layout[key])}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isFinite(v)) return;
                          onUpdateLayout({
                            ...selectedVisual.layout,
                            [key]:
                              key === "w"
                                ? Math.max(140, Math.min(1280, v))
                                : key === "h"
                                  ? Math.max(72, Math.min(720, v))
                                  : Math.max(0, v),
                          });
                        }}
                        style={{
                          width: "100%",
                          height: 24,
                          marginTop: 2,
                          padding: "0 6px",
                          border: "1px solid #c8c6c4",
                          borderRadius: 2,
                          fontSize: 11,
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: "#605e5c", lineHeight: 1.45 }}>
              Select a visual on the canvas to format its title, colors, size, or borders.
            </div>
          )
        ) : selectedVisual ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 11.5 }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <span style={{ fontWeight: 600 }}>Average line</span>
              <input
                type="checkbox"
                checked={Boolean(selectedVisual.analytics?.showAverageLine)}
                onChange={(e) =>
                  onUpdateAnalytics({
                    ...(selectedVisual.analytics || {}),
                    showAverageLine: e.target.checked,
                  })
                }
                style={{ accentColor: "#117865" }}
              />
            </label>

            <div style={{ borderTop: "1px solid #e1dfdd", paddingTop: 8 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                Constant target line
              </label>
              <input
                type="number"
                placeholder="Enter target value (blank = off)"
                value={selectedVisual.analytics?.constantLineValue ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  onUpdateAnalytics({
                    ...(selectedVisual.analytics || {}),
                    constantLineValue: raw === "" ? undefined : Number(raw),
                  });
                }}
                style={{
                  width: "100%",
                  height: 26,
                  padding: "0 7px",
                  border: "1px solid #c8c6c4",
                  borderRadius: 2,
                  fontSize: 11.5,
                  marginBottom: 6,
                }}
              />
              <input
                type="text"
                placeholder="Line label (e.g. Goal)"
                value={selectedVisual.analytics?.constantLineLabel ?? ""}
                onChange={(e) =>
                  onUpdateAnalytics({
                    ...(selectedVisual.analytics || {}),
                    constantLineLabel: e.target.value || undefined,
                  })
                }
                style={{
                  width: "100%",
                  height: 24,
                  padding: "0 7px",
                  border: "1px solid #c8c6c4",
                  borderRadius: 2,
                  fontSize: 11,
                }}
              />
            </div>

            {analyticsStats ? (
              <div
                style={{
                  padding: 8,
                  background: "#faf9f8",
                  border: "1px solid #e1dfdd",
                  borderRadius: 3,
                  display: "grid",
                  gap: 4,
                }}
              >
                <strong style={{ color: "#252423", fontSize: 11 }}>Summary ({analyticsStats.field})</strong>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#605e5c" }}>
                  <span>Groups</span>
                  <span>{analyticsStats.count}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#605e5c" }}>
                  <span>Minimum</span>
                  <span>{formatPowerBiNumber(analyticsStats.min, analyticsStats.field)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#605e5c" }}>
                  <span>Average</span>
                  <span>{formatPowerBiNumber(analyticsStats.avg, analyticsStats.field)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#605e5c" }}>
                  <span>Maximum</span>
                  <span>{formatPowerBiNumber(analyticsStats.max, analyticsStats.field)}</span>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ fontSize: 11.5, color: "#605e5c", lineHeight: 1.45 }}>
            Select a chart visual to add Average or Constant target reference lines.
          </div>
        )}
      </div>
    </aside>
  );
}
