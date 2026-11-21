"use client";

import React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Database,
  Eye,
  Filter,
  Grid,
  LayoutGrid,
  Minus,
  PlusSquare,
  RotateCcw,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Square,
  Sun,
  UserCircle2,
  X,
} from "lucide-react";
import { POWERBI_SERIES_PALETTE } from "@/lib/powerbi/palette";
import type {
  AggregationFn,
  PowerBiVisual,
  PowerBiVisualType,
  RibbonTab,
} from "@/lib/powerbi/types";
import {
  CalculatorRibbonIcon,
  CopilotRibbonIcon,
  CopyIcon,
  CutIcon,
  DataverseRibbonIcon,
  EnterDataRibbonIcon,
  ExcelWorkbookIcon,
  FormatPainterIcon,
  GetDataRibbonIcon,
  MoreVisualsRibbonIcon,
  NewVisualRibbonIcon,
  OneLakeCatalogIcon,
  PasteIcon,
  PowerBiLogoMark,
  PrepAiRibbonIcon,
  PublishRibbonIcon,
  RecentSourcesRibbonIcon,
  RefreshRibbonIcon,
  SaveIcon,
  SensitivityRibbonIcon,
  SqlServerRibbonIcon,
  TextBoxRibbonIcon,
  TransformDataRibbonIcon,
  UndoIcon,
  VisualCalcRibbonIcon,
} from "./PowerBiDesktopIcons";
import styles from "./powerbi.module.css";

interface ApplicationHeaderProps {
  documentName: string;
  activeTab: RibbonTab;
  onSelectTab: (tab: RibbonTab) => void;
  ribbonCollapsed: boolean;
  onToggleRibbon: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  hasDataset: boolean;
  selectedVisual: PowerBiVisual | null;
  readingView: boolean;
  onToggleReadingView: () => void;
  onUploadCsvClick: () => void;
  onLoadSocialSample: () => void;
  onLoadRetailSample: () => void;
  onOpenGetDataModal: () => void;
  onOpenEnterData: () => void;
  onOpenTransformModal: () => void;
  onAddVisual: (type: PowerBiVisualType) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onResetReport: () => void;
  onClearAllFilters: () => void;
  showFiltersPane: boolean;
  showVizPane: boolean;
  showDataPane: boolean;
  showGridlines: boolean;
  onTogglePane: (pane: "filters" | "viz" | "data") => void;
  onToggleGridlines: () => void;
  onChangeAggregation: (agg: AggregationFn) => void;
  onUpdateSelectedFormat: (patch: Partial<PowerBiVisual["format"]>, newTitle?: string) => void;
  onOpenExportHelp: () => void;
  onOpenDaxView: () => void;
  onNewMeasure: () => void;
  onQuickMeasure: () => void;
  onSaveReport: () => void;
  onOpenReportFile: () => void;
  onOpenModelView: () => void;
  onOpenCopilotModal: () => void;
  onSwitchToService: (mode: "home" | "create") => void;
}

const RIBBON_TABS: RibbonTab[] = [
  "File",
  "Home",
  "Insert",
  "Modeling",
  "Design",
  "View",
  "Optimize",
  "Help",
];

/** Authentic Microsoft Power BI Desktop title bar, QAT, Search, Ribbon tabs & Home icons. */
export function ApplicationHeader({
  documentName,
  activeTab,
  onSelectTab,
  ribbonCollapsed,
  onToggleRibbon,
  searchQuery,
  onSearchChange,
  hasDataset,
  selectedVisual,
  readingView,
  onToggleReadingView,
  onUploadCsvClick,
  onLoadSocialSample,
  onLoadRetailSample,
  onOpenGetDataModal,
  onOpenEnterData,
  onOpenTransformModal,
  onAddVisual,
  onDuplicateSelected,
  onDeleteSelected,
  onResetReport,
  onClearAllFilters,
  showFiltersPane,
  showVizPane,
  showDataPane,
  showGridlines,
  onTogglePane,
  onToggleGridlines,
  onChangeAggregation,
  onUpdateSelectedFormat,
  onOpenExportHelp,
  onOpenDaxView,
  onNewMeasure,
  onQuickMeasure,
  onSaveReport,
  onOpenReportFile,
  onOpenModelView,
  onOpenCopilotModal,
  onSwitchToService,
}: ApplicationHeaderProps) {
  return (
    <header aria-label="Power BI Desktop Header">
      {/* Row 1: Windows Desktop Title Bar */}
      <div className={styles.titleBar}>
        <div className={styles.titleLeft}>
          <button
            type="button"
            className={styles.qatBtn}
            title="Switch to Power BI Service Home"
            aria-label="Power BI Desktop logo / Service Home"
            onClick={() => onSwitchToService("home")}
          >
            <PowerBiLogoMark size={18} />
          </button>

          <button
            type="button"
            className={styles.qatBtn}
            title="Save report (downloads a .labmate-report.json file and keeps a copy in this browser)"
            aria-label="Save report"
            disabled={!hasDataset}
            onClick={onSaveReport}
          >
            <SaveIcon size={14} />
          </button>
          <button
            type="button"
            className={styles.qatBtn}
            title="Reset default report layout"
            aria-label="Reset report"
            disabled={!hasDataset}
            onClick={onResetReport}
          >
            <UndoIcon size={14} />
          </button>

          <span className={styles.docTitle}>
            {documentName ? `${documentName} - Power BI practice environment (LabMate)` : "Untitled - Power BI practice environment (LabMate)"}
          </span>
        </div>

        <div className={styles.searchWrap}>
          <Search size={13} className={styles.searchIcon} />
          <input
            type="text"
            aria-label="Search report visuals and fields"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={styles.topSearchInput}
          />
          {searchQuery ? (
            <button
              type="button"
              aria-label="Clear top search"
              onClick={() => onSearchChange("")}
              style={{
                position: "absolute",
                right: 5,
                top: 4,
                border: 0,
                background: "transparent",
                color: "#797775",
                cursor: "pointer",
              }}
            >
              <X size={12} />
            </button>
          ) : null}
        </div>

        <div className={styles.titleRight}>
          <button
            type="button"
            className={styles.qatBtn}
            title="Open Power BI Service (Home & Create)"
            aria-label="Power BI Service"
            onClick={() => onSwitchToService("home")}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            type="button"
            className={styles.qatBtn}
            title="Options & settings"
            aria-label="Options"
            onClick={onOpenExportHelp}
          >
            <Settings size={14} />
          </button>
          <button
            type="button"
            className={styles.qatBtn}
            title="Preview Reading / Screenshot view"
            aria-label="Toggle reading mode"
            onClick={onToggleReadingView}
          >
            <Sun size={14} />
          </button>

          <button
            type="button"
            className={styles.signInPill}
            onClick={onToggleReadingView}
            title="Toggle clean Reading / Screenshot mode"
          >
            <span>{readingView ? "Exit view" : hasDataset ? "Student" : "Sign in"}</span>
            <UserCircle2 size={16} color="#605e5c" />
          </button>

          <div className={styles.winCtrlGroup} aria-label="Window controls">
            <button
              type="button"
              className={styles.winBtn}
              title={ribbonCollapsed ? "Expand ribbon" : "Minimize ribbon"}
              onClick={onToggleRibbon}
            >
              <Minus size={12} />
            </button>
            <button
              type="button"
              className={styles.winBtn}
              title="Toggle fullscreen reading view"
              onClick={onToggleReadingView}
            >
              <Square size={10.5} />
            </button>
            <Link
              href="/labs/social-media-analytics"
              className={styles.winBtn}
              title="Return to LabMate SMA Labs"
              aria-label="Close and return to LabMate"
            >
              <X size={13} />
            </Link>
          </div>
        </div>
      </div>

      {/* Row 2 & 3: Fluent Ribbon Tabs & Commands */}
      {!readingView ? (
        <div className={styles.ribbonShell}>
          <div className={styles.ribbonTabBar}>
            <nav className={styles.ribbonTabs} aria-label="Ribbon tabs">
              {RIBBON_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => onSelectTab(tab)}
                  className={`${styles.ribbonTabBtn} ${activeTab === tab ? styles.ribbonTabActive : ""}`}
                >
                  {tab}
                </button>
              ))}
              {selectedVisual ? (
                <button
                  type="button"
                  onClick={() => onSelectTab("Format")}
                  className={`${styles.ribbonTabBtn} ${styles.ribbonTabContextual} ${activeTab === "Format" ? styles.ribbonTabActive : ""}`}
                >
                  Format
                </button>
              ) : null}
            </nav>

            <div className={styles.ribbonRightActions}>
              <button
                type="button"
                className={styles.collapseChevronBtn}
                onClick={onToggleRibbon}
                title={ribbonCollapsed ? "Show ribbon" : "Collapse ribbon"}
                aria-label="Toggle ribbon"
              >
                {ribbonCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
              <button
                type="button"
                className={styles.shareBtn}
                onClick={onOpenExportHelp}
              >
                <Share2 size={12.5} />
                <span>Share</span>
                <ChevronDown size={11} />
              </button>
            </div>
          </div>

          {!ribbonCollapsed ? (
            <div className={styles.ribbonStrip} role="toolbar" aria-label={`${activeTab} ribbon commands`}>
              {activeTab === "File" ? (
                <>
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onUploadCsvClick}>
                        <ExcelWorkbookIcon size={22} />
                        <span>Upload CSV</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onLoadSocialSample}>
                        <OneLakeCatalogIcon size={22} />
                        <span>Social KPI</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onLoadRetailSample}>
                        <SqlServerRibbonIcon size={22} />
                        <span>Retail SQL</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Import</span>
                  </div>
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button type="button" className={styles.ribbonLgBtn} disabled={!hasDataset} onClick={onSaveReport}>
                        <SaveIcon size={20} />
                        <span>Save report</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onOpenReportFile}>
                        <ExcelWorkbookIcon size={22} />
                        <span>Open report</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Report file</span>
                  </div>
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button type="button" className={styles.ribbonLgBtn} onClick={() => onSwitchToService("home")}>
                        <PowerBiLogoMark size={20} />
                        <span>Service Home</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={() => onSwitchToService("create")}>
                        <PlusSquare size={20} color="#117865" />
                        <span>Service Create</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Power BI Web</span>
                  </div>
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onOpenExportHelp}>
                        <Eye size={20} color="#117865" />
                        <span>Manual Guide</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Export</span>
                  </div>
                </>
              ) : null}

              {activeTab === "Home" || activeTab === "Help" ? (
                <>
                  {/* 1. Clipboard */}
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        onClick={selectedVisual ? onDuplicateSelected : onOpenEnterData}
                        title={selectedVisual ? "Duplicate selected visual" : "Paste CSV table"}
                      >
                        <PasteIcon size={22} />
                        <span>Paste ▾</span>
                      </button>
                      <div className={styles.ribbonColStack}>
                        <button
                          type="button"
                          className={styles.ribbonSmBtn}
                          disabled={!selectedVisual}
                          onClick={onDeleteSelected}
                        >
                          <CutIcon size={12} />
                          <span>Cut</span>
                        </button>
                        <button
                          type="button"
                          className={styles.ribbonSmBtn}
                          disabled={!selectedVisual}
                          onClick={onDuplicateSelected}
                        >
                          <CopyIcon size={12} />
                          <span>Copy</span>
                        </button>
                        <button
                          type="button"
                          className={styles.ribbonSmBtn}
                          disabled={!selectedVisual}
                          onClick={() => onSelectTab("Format")}
                        >
                          <FormatPainterIcon size={12} />
                          <span>Format painter</span>
                        </button>
                      </div>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Clipboard</span>
                  </div>

                  {/* 2. Data */}
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onOpenGetDataModal}>
                        <GetDataRibbonIcon size={22} />
                        <span>Get<br />data ▾</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onUploadCsvClick}>
                        <ExcelWorkbookIcon size={22} />
                        <span>Excel<br />workbook</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onLoadSocialSample}>
                        <OneLakeCatalogIcon size={22} />
                        <span>OneLake<br />catalog ▾</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onLoadRetailSample}>
                        <SqlServerRibbonIcon size={22} />
                        <span>SQL<br />Server</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onOpenEnterData}>
                        <EnterDataRibbonIcon size={22} />
                        <span>Enter<br />data</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onOpenGetDataModal}>
                        <DataverseRibbonIcon size={22} />
                        <span>Dataverse</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onOpenGetDataModal}>
                        <RecentSourcesRibbonIcon size={22} />
                        <span>Recent<br />sources ▾</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Data</span>
                  </div>

                  {/* 3. Queries */}
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset}
                        onClick={onOpenTransformModal}
                      >
                        <TransformDataRibbonIcon size={22} />
                        <span>Transform<br />data ▾</span>
                      </button>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset}
                        onClick={onResetReport}
                      >
                        <RefreshRibbonIcon size={22} />
                        <span>Refresh</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Queries</span>
                  </div>

                  {/* 4. Insert */}
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        onClick={() => (hasDataset ? onAddVisual("clusteredColumn") : onOpenGetDataModal())}
                      >
                        <NewVisualRibbonIcon size={22} />
                        <span>New<br />visual</span>
                      </button>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        onClick={() => (hasDataset ? onAddVisual("card") : onOpenGetDataModal())}
                      >
                        <TextBoxRibbonIcon size={22} />
                        <span>Text<br />box</span>
                      </button>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        onClick={() => {
                          if (!showVizPane) onTogglePane("viz");
                        }}
                      >
                        <MoreVisualsRibbonIcon size={22} />
                        <span>More<br />visuals ▾</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Insert</span>
                  </div>

                  {/* 5. Calculations */}
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled
                        title="Visual calculations are not available in the LabMate practice lab. Use New measure or Quick measure."
                        onClick={onOpenDaxView}
                      >
                        <VisualCalcRibbonIcon size={22} />
                        <span>New visual<br />calculation ▾</span>
                      </button>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset}
                        onClick={onNewMeasure}
                      >
                        <CalculatorRibbonIcon size={22} />
                        <span>New<br />measure</span>
                      </button>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset}
                        onClick={onQuickMeasure}
                      >
                        <CalculatorRibbonIcon size={22} lightning />
                        <span>Quick<br />measure</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Calculations</span>
                  </div>

                  {/* 6. Sensitivity */}
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset}
                        onClick={onClearAllFilters}
                        title="Clear active filters / sensitivity status"
                      >
                        <SensitivityRibbonIcon size={22} />
                        <span>Sensitivity</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Sensitivity</span>
                  </div>

                  {/* 7. Share */}
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset}
                        onClick={() => onSwitchToService("home")}
                        title="Publish to Power BI Service"
                      >
                        <PublishRibbonIcon size={22} />
                        <span>Publish</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Share</span>
                  </div>

                  {/* 8. Copilot */}
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset}
                        onClick={onOpenModelView}
                      >
                        <PrepAiRibbonIcon size={22} />
                        <span>Prep data for<br />AI</span>
                      </button>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        onClick={onOpenCopilotModal}
                        title="Dataset summary: totals of the numeric columns (no AI is involved)"
                      >
                        <CopilotRibbonIcon size={22} />
                        <span>Data<br />summary</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Summary</span>
                  </div>
                </>
              ) : null}

              {activeTab === "Insert" ? (
                <div className={styles.ribbonGroup}>
                  <div className={styles.ribbonGroupItems}>
                    {(
                      [
                        ["clusteredColumn", "Column"],
                        ["clusteredBar", "Bar"],
                        ["line", "Line"],
                        ["area", "Area"],
                        ["donut", "Donut"],
                        ["funnel", "Funnel"],
                        ["card", "Card"],
                        ["slicer", "Slicer"],
                        ["table", "Table"],
                      ] as Array<[PowerBiVisualType, string]>
                    ).map(([vType, label]) => (
                      <button
                        key={vType}
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset}
                        onClick={() => onAddVisual(vType)}
                      >
                        <NewVisualRibbonIcon size={19} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  <span className={styles.ribbonGroupLabel}>Visuals</span>
                </div>
              ) : null}

              {activeTab === "Modeling" || activeTab === "Optimize" ? (
                <div className={styles.ribbonGroup}>
                  <div className={styles.ribbonGroupItems}>
                    {(["sum", "average", "count", "min", "max"] as AggregationFn[]).map((fn) => (
                      <button
                        key={fn}
                        type="button"
                        disabled={!selectedVisual}
                        onClick={() => onChangeAggregation(fn)}
                        className={`${styles.ribbonLgBtn} ${selectedVisual?.aggregation === fn ? styles.ribbonLgBtnActive : ""}`}
                      >
                        <SlidersHorizontal size={17} color="#117865" />
                        <span style={{ textTransform: "capitalize" }}>{fn}</span>
                      </button>
                    ))}
                  </div>
                  <span className={styles.ribbonGroupLabel}>Active Visual Summarization</span>
                </div>
              ) : null}

              {activeTab === "Design" ? (
                <div className={styles.ribbonGroup}>
                  <div className={styles.ribbonGroupItems} style={{ gap: 8 }}>
                    {POWERBI_SERIES_PALETTE.slice(0, 6).map((hex, i) => (
                      <button
                        key={hex}
                        type="button"
                        disabled={!selectedVisual}
                        onClick={() => onUpdateSelectedFormat({ accentColor: hex })}
                        className={styles.ribbonLgBtn}
                      >
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 3,
                            background: hex,
                            border: "1px solid #c8c6c4",
                          }}
                        />
                        <span>Theme {i + 1}</span>
                      </button>
                    ))}
                  </div>
                  <span className={styles.ribbonGroupLabel}>Themes</span>
                </div>
              ) : null}

              {activeTab === "View" ? (
                <>
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button
                        type="button"
                        onClick={() => onTogglePane("filters")}
                        className={`${styles.ribbonLgBtn} ${showFiltersPane ? styles.ribbonLgBtnActive : ""}`}
                      >
                        <Filter size={17} />
                        <span>Filters</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onTogglePane("viz")}
                        className={`${styles.ribbonLgBtn} ${showVizPane ? styles.ribbonLgBtnActive : ""}`}
                      >
                        <LayoutGrid size={17} />
                        <span>Visualizations</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onTogglePane("data")}
                        className={`${styles.ribbonLgBtn} ${showDataPane ? styles.ribbonLgBtnActive : ""}`}
                      >
                        <Database size={17} />
                        <span>Data</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Show panes</span>
                  </div>
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button
                        type="button"
                        onClick={onToggleGridlines}
                        className={`${styles.ribbonLgBtn} ${showGridlines ? styles.ribbonLgBtnActive : ""}`}
                      >
                        <Grid size={17} />
                        <span>Gridlines</span>
                      </button>
                      <button
                        type="button"
                        onClick={onToggleReadingView}
                        className={`${styles.ribbonLgBtn} ${readingView ? styles.ribbonLgBtnActive : ""}`}
                      >
                        <Sparkles size={17} color="#117865" />
                        <span>Reading view</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Page view</span>
                  </div>
                </>
              ) : null}

              {activeTab === "Format" && selectedVisual ? (
                <div className={styles.ribbonGroup}>
                  <div className={styles.ribbonGroupItems} style={{ gap: 10 }}>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSelectedFormat({ showDataLabels: !selectedVisual.format.showDataLabels })
                      }
                      className={`${styles.ribbonLgBtn} ${selectedVisual.format.showDataLabels ? styles.ribbonLgBtnActive : ""}`}
                    >
                      <SlidersHorizontal size={16} />
                      <span>Data labels</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSelectedFormat({ showLegend: !selectedVisual.format.showLegend })
                      }
                      className={`${styles.ribbonLgBtn} ${selectedVisual.format.showLegend ? styles.ribbonLgBtnActive : ""}`}
                    >
                      <LayoutGrid size={16} />
                      <span>Legend</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSelectedFormat({ showBorder: !selectedVisual.format.showBorder })
                      }
                      className={`${styles.ribbonLgBtn} ${selectedVisual.format.showBorder ? styles.ribbonLgBtnActive : ""}`}
                    >
                      <Square size={16} />
                      <span>Border</span>
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {POWERBI_SERIES_PALETTE.slice(0, 6).map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          aria-label={`Set color ${hex}`}
                          onClick={() => onUpdateSelectedFormat({ accentColor: hex })}
                          style={{
                            width: 18,
                            height: 18,
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
                  <span className={styles.ribbonGroupLabel}>Visual Style</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
