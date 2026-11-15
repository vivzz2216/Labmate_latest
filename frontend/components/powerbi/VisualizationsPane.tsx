"use client";

import React, { useState } from "react";
import { BarChart3, ChevronsRight, Paintbrush, Plus, Search, X } from "lucide-react";
import { POWERBI_SERIES_PALETTE } from "@/lib/powerbi/palette";
import type { AggregationFn, ColumnMeta, PowerBiVisual, PowerBiVisualType } from "@/lib/powerbi/types";
import { Dropdown } from "./Dropdown";
import { DESKTOP_VIZ_GRID_TILES, DesktopVizTileGlyph } from "./VisualIcons";
import styles from "./powerbi.module.css";

interface VisualizationsPaneProps {
  expanded: boolean;
  onToggleExpand: () => void;
  columns: ColumnMeta[];
  selectedVisual: PowerBiVisual | null;
  onSelectVisualType: (type: PowerBiVisualType) => void;
  onUpdateFields: (patch: {
    xAxis?: string;
    yAxis?: string[];
    aggregation?: AggregationFn;
  }) => void;
  onUpdateFormat: (patch: Partial<PowerBiVisual["format"]>, nextTitle?: string) => void;
}

/** Right docked Visualizations pane matching Power BI Desktop: Build/Format/Analytics, 6-col gallery, field wells & Drill through. */
export function VisualizationsPane({
  expanded,
  onToggleExpand,
  columns,
  selectedVisual,
  onSelectVisualType,
  onUpdateFields,
  onUpdateFormat,
}: VisualizationsPaneProps) {
  const [subTab, setSubTab] = useState<"build" | "format" | "analytics">("build");
  const [addYField, setAddYField] = useState("");
  const [activeTileId, setActiveTileId] = useState<string | null>(null);
  const [crossReport, setCrossReport] = useState(false);
  const [keepAllFilters, setKeepAllFilters] = useState(true);

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

  const numericCols = columns.filter((c) => c.isNumeric);
  const allColsOptions = columns.map((c) => ({ value: c.name, label: c.label }));
  const yColsOptions = (numericCols.length > 0 ? numericCols : columns).map((c) => ({
    value: c.name,
    label: c.label,
  }));

  const subHeading =
    subTab === "build"
      ? "Build visual"
      : subTab === "format"
        ? "Format your visual"
        : "Add further analyses";

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

      <div className={styles.vizModeTabsIconRow} role="tablist" aria-label="Visualization pane sections">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === "build"}
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
          role="tab"
          aria-selected={subTab === "format"}
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
          role="tab"
          aria-selected={subTab === "analytics"}
          aria-label="Add further analyses"
          title="Add further analyses to your visual"
          onClick={() => setSubTab("analytics")}
          className={`${styles.vizModeIconBtn} ${subTab === "analytics" ? styles.vizModeIconBtnActive : ""}`}
        >
          <span className={styles.vizModeIconBox}>
            <Search size={15} color={subTab === "analytics" ? "#117865" : "#484644"} />
          </span>
        </button>
      </div>

      <div className={styles.paneBodyScroll}>
        {subTab === "build" ? (
          <>
            <div className={styles.vizIconGrid} role="group" aria-label="Visualization types">
              {DESKTOP_VIZ_GRID_TILES.map((tile) => {
                const isSelected =
                  activeTileId === tile.id ||
                  (tile.isPrimaryForType && selectedVisual?.type === tile.targetType);
                return (
                  <button
                    key={tile.id}
                    type="button"
                    title={tile.label}
                    aria-label={tile.label}
                    onClick={() => {
                      setActiveTileId(tile.id);
                      onSelectVisualType(tile.targetType);
                    }}
                    className={`${styles.vizTileBtn} ${isSelected ? styles.vizTileActive : ""}`}
                  >
                    <DesktopVizTileGlyph tileId={tile.id} />
                  </button>
                );
              })}
              <button
                type="button"
                title="Get more visuals"
                aria-label="Get more visuals"
                onClick={() => onSelectVisualType("clusteredColumn")}
                className={styles.vizTileBtn}
                style={{ fontSize: 12, fontWeight: 700, color: "#605e5c" }}
              >
                ···
              </button>
            </div>

            {selectedVisual ? (
              <>
                {selectedVisual.type !== "card" ? (
                  <div className={styles.fieldWellSection}>
                    <div className={styles.fieldWellLabel}>
                      <span>{selectedVisual.type === "slicer" ? "Field" : "X-axis / Category"}</span>
                    </div>
                    <div className={styles.fieldWellDropBox}>
                      <Dropdown
                        ariaLabel="X-axis field"
                        placeholder="Add data fields here"
                        value={selectedVisual.xAxis || ""}
                        options={allColsOptions}
                        onChange={(val) => onUpdateFields({ xAxis: val || undefined })}
                      />
                    </div>
                  </div>
                ) : null}

                {selectedVisual.type !== "slicer" ? (
                  <div className={styles.fieldWellSection}>
                    <div className={styles.fieldWellLabel}>
                      <span>{selectedVisual.type === "card" ? "Fields" : "Y-axis / Values"}</span>
                    </div>
                    <div className={styles.fieldWellDropBox}>
                      {selectedVisual.yAxis.map((field) => (
                        <div key={field} className={styles.fieldChip}>
                          <span className={styles.fieldChipName}>{field}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${field} from Y-axis`}
                            onClick={() =>
                              onUpdateFields({
                                yAxis: selectedVisual.yAxis.filter((f) => f !== field),
                              })
                            }
                            style={{
                              border: 0,
                              background: "transparent",
                              color: "#605e5c",
                              cursor: "pointer",
                              padding: 0,
                              display: "inline-flex",
                            }}
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}

                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Plus size={11} color="#605e5c" />
                        <Dropdown
                          ariaLabel="Add value field"
                          placeholder="Add data fields here"
                          value={addYField}
                          options={yColsOptions.filter((o) => !selectedVisual.yAxis.includes(o.value))}
                          onChange={(val) => {
                            if (!val) return;
                            const next =
                              selectedVisual.type === "card"
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

                <div className={styles.fieldWellSection}>
                  <div className={styles.fieldWellLabel}>
                    <span>Summarization</span>
                  </div>
                  <Dropdown
                    ariaLabel="Aggregation function"
                    value={selectedVisual.aggregation}
                    options={[
                      { value: "sum", label: "Sum" },
                      { value: "average", label: "Average" },
                      { value: "count", label: "Count" },
                      { value: "min", label: "Minimum" },
                      { value: "max", label: "Maximum" },
                    ]}
                    onChange={(val) =>
                      onUpdateFields({ aggregation: (val || "sum") as AggregationFn })
                    }
                  />
                </div>
              </>
            ) : (
              <div className={styles.fieldWellSection}>
                <div className={styles.fieldWellLabel}>
                  <span>Values</span>
                </div>
                <div className={styles.emptyFieldWellPlaceholder}>Add data fields here</div>
              </div>
            )}

            {/* Authentic Power BI Drill through section */}
            <div className={styles.drillThroughBox}>
              <div className={styles.fieldWellLabel} style={{ marginBottom: 6 }}>
                <span>Drill through</span>
              </div>

              <div className={styles.toggleRow}>
                <span>Cross-report</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={crossReport}
                  onClick={() => setCrossReport((v) => !v)}
                  className={`${styles.pbiSwitch} ${crossReport ? styles.pbiSwitchOn : ""}`}
                >
                  <span>{crossReport ? "On" : "Off"}</span>
                  <span className={styles.pbiSwitchKnob} />
                </button>
              </div>

              <div className={styles.toggleRow}>
                <span>Keep all filters</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={keepAllFilters}
                  onClick={() => setKeepAllFilters((v) => !v)}
                  className={`${styles.pbiSwitch} ${keepAllFilters ? styles.pbiSwitchOn : ""}`}
                >
                  <span>{keepAllFilters ? "On" : "Off"}</span>
                  <span className={styles.pbiSwitchKnob} />
                </button>
              </div>

              <div className={styles.emptyFieldWellPlaceholder} style={{ marginTop: 6 }}>
                Add drill-through fields here
              </div>
            </div>
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
                      aria-label={`Color ${hex}`}
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
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: "#605e5c", lineHeight: 1.45 }}>
              Select a visual on the canvas to format its title, data labels, legend, or colors.
            </div>
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11.5, color: "#605e5c" }}>
            <div style={{ padding: 8, background: "#fafafa", border: "1px solid #e1dfdd", borderRadius: 3 }}>
              <strong style={{ color: "#252423", display: "block", marginBottom: 3 }}>Trend & Constant Lines</strong>
              Select any line, area, or bar chart to inspect min/max bounds and category breakdown.
            </div>
            <div style={{ padding: 8, background: "#fafafa", border: "1px solid #e1dfdd", borderRadius: 3 }}>
              <strong style={{ color: "#252423", display: "block", marginBottom: 3 }}>Forecasting</strong>
              Use time-series columns (`Date`) on the X-axis to compare daily progression.
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
