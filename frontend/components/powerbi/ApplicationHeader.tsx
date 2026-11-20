"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  Eraser,
  Eye,
  Filter,
  FolderOpen,
  Grid,
  LayoutGrid,
  Magnet,
  Maximize2,
  Minus,
  PlusSquare,
  Search,
  SlidersHorizontal,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { POWERBI_THEMES } from "@/lib/powerbi/palette";
import type {
  AggregationFn,
  ColumnMeta,
  ColumnType,
  PowerBiVisual,
  PowerBiVisualType,
  RibbonTab,
} from "@/lib/powerbi/types";
import {
  CalculatorRibbonIcon,
  CopyIcon,
  CutIcon,
  EnterDataRibbonIcon,
  ExcelWorkbookIcon,
  FormatPainterIcon,
  GetDataRibbonIcon,
  MoreVisualsRibbonIcon,
  NewColumnRibbonIcon,
  NewVisualRibbonIcon,
  PasteIcon,
  PowerBiLogoMark,
  RedoIcon,
  RefreshRibbonIcon,
  RelationshipRibbonIcon,
  SaveIcon,
  TextBoxRibbonIcon,
  TransformDataRibbonIcon,
  UndoIcon,
} from "./PowerBiDesktopIcons";
import { DesktopVizTileGlyph } from "./VisualIcons";
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
  selectedColumn: ColumnMeta | null;
  activeThemeId: string;
  readingView: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasCopiedVisual: boolean;
  formatPainterActive: boolean;
  activeFilterCount: number;
  onUndo: () => void;
  onRedo: () => void;
  onSaveProject: () => void;
  onLoadProjectClick: () => void;
  onExportCsv: () => void;
  onToggleReadingView: () => void;
  onUploadFileClick: () => void;
  onLoadSocialSample: () => void;
  onLoadRetailSample: () => void;
  onLoadStudentSample: () => void;
  onLoadRelationalSample: () => void;
  onOpenGetDataModal: () => void;
  onOpenEnterData: () => void;
  onOpenTransformModal: () => void;
  onRefreshData: () => void;
  onResetReport: () => void;
  onAddVisual: (type: PowerBiVisualType) => void;
  onAddPage: () => void;
  onDuplicatePage: () => void;
  onCutSelected: () => void;
  onCopySelected: () => void;
  onPasteVisual: () => void;
  onToggleFormatPainter: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onClearAllFilters: () => void;
  showFiltersPane: boolean;
  showVizPane: boolean;
  showDataPane: boolean;
  showGridlines: boolean;
  snapToGrid: boolean;
  onTogglePane: (pane: "filters" | "viz" | "data") => void;
  onToggleGridlines: () => void;
  onToggleSnapToGrid: () => void;
  onResetZoom: () => void;
  onActualZoom: () => void;
  onSelectTheme: (themeId: string) => void;
  onChangeAggregation: (agg: AggregationFn) => void;
  onChangeSort: (dir: "asc" | "desc") => void;
  onUpdateSelectedFormat: (patch: Partial<PowerBiVisual["format"]>, newTitle?: string) => void;
  onOpenNewMeasure: () => void;
  onOpenNewColumn: () => void;
  onOpenRelationships: () => void;
  onChangeSelectedColumnType: (type: ColumnType) => void;
}

const RIBBON_TABS: RibbonTab[] = ["File", "Home", "Insert", "Modeling", "View"];

const INSERT_GALLERY: Array<[PowerBiVisualType, string]> = [
  ["clusteredColumn", "Column"],
  ["stackedColumn", "Stacked col"],
  ["clusteredBar", "Bar"],
  ["stackedBar", "Stacked bar"],
  ["line", "Line"],
  ["area", "Area"],
  ["pie", "Pie"],
  ["donut", "Donut"],
  ["card", "Card"],
  ["slicer", "Slicer"],
  ["table", "Table"],
  ["matrix", "Matrix"],
];

/** Authentic Microsoft Power BI Desktop title bar, QAT, Search, Ribbon tabs & functional toolbars. */
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
  selectedColumn,
  activeThemeId,
  readingView,
  canUndo,
  canRedo,
  hasCopiedVisual,
  formatPainterActive,
  activeFilterCount,
  onUndo,
  onRedo,
  onSaveProject,
  onLoadProjectClick,
  onExportCsv,
  onToggleReadingView,
  onUploadFileClick,
  onLoadSocialSample,
  onLoadRetailSample,
  onLoadStudentSample,
  onLoadRelationalSample,
  onOpenGetDataModal,
  onOpenEnterData,
  onOpenTransformModal,
  onRefreshData,
  onResetReport,
  onAddVisual,
  onAddPage,
  onDuplicatePage,
  onCutSelected,
  onCopySelected,
  onPasteVisual,
  onToggleFormatPainter,
  onDuplicateSelected,
  onDeleteSelected,
  onBringForward,
  onSendBackward,
  onClearAllFilters,
  showFiltersPane,
  showVizPane,
  showDataPane,
  showGridlines,
  snapToGrid,
  onTogglePane,
  onToggleGridlines,
  onToggleSnapToGrid,
  onResetZoom,
  onActualZoom,
  onSelectTheme,
  onChangeAggregation,
  onChangeSort,
  onUpdateSelectedFormat,
  onOpenNewMeasure,
  onOpenNewColumn,
  onOpenRelationships,
  onChangeSelectedColumnType,
}: ApplicationHeaderProps) {
  const activeTheme =
    POWERBI_THEMES.find((t) => t.id === activeThemeId) || POWERBI_THEMES[0];

  return (
    <header aria-label="Power BI Desktop Header">
      {/* Row 1: Windows Desktop Title Bar */}
      <div className={styles.titleBar}>
        <div className={styles.titleLeft}>
          <span
            className={styles.qatBtn}
            style={{ cursor: "default" }}
            aria-hidden="true"
            title="Power BI Desktop"
          >
            <PowerBiLogoMark size={18} />
          </span>

          <button
            type="button"
            className={styles.qatBtn}
            title="Save report project (.json)"
            aria-label="Save report project"
            disabled={!hasDataset}
            onClick={onSaveProject}
          >
            <SaveIcon size={14} />
          </button>
          <button
            type="button"
            className={styles.qatBtn}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <UndoIcon size={14} />
          </button>
          <button
            type="button"
            className={styles.qatBtn}
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={onRedo}
          >
            <RedoIcon size={14} />
          </button>

          <span className={styles.docTitle}>
            {documentName ? `${documentName} - Power BI Desktop` : "Untitled - Power BI Desktop"}
          </span>
        </div>

        <div className={styles.searchWrap}>
          <Search size={13} className={styles.searchIcon} />
          <input
            type="text"
            aria-label="Search report visuals and fields"
            placeholder="Search visuals & fields"
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
            title={readingView ? "Exit clean view" : "Clean screenshot view"}
            aria-label="Toggle reading mode"
            onClick={onToggleReadingView}
          >
            <Eye size={14} color={readingView ? "#117865" : undefined} />
          </button>

          <div className={styles.winCtrlGroup} aria-label="Window controls">
            <button
              type="button"
              className={styles.winBtn}
              title={ribbonCollapsed ? "Expand ribbon" : "Minimize ribbon"}
              aria-label={ribbonCollapsed ? "Expand ribbon" : "Minimize ribbon"}
              onClick={onToggleRibbon}
            >
              <Minus size={12} />
            </button>
            <button
              type="button"
              className={styles.winBtn}
              title="Toggle fullscreen canvas view"
              aria-label="Toggle fullscreen canvas view"
              onClick={onToggleReadingView}
            >
              <Square size={10.5} />
            </button>
            <Link
              href="/labs"
              className={styles.winBtn}
              title="Exit Power BI Studio to LabMate"
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
              {readingView ? null : (
                <button
                  type="button"
                  className={styles.ribbonSmBtn}
                  onClick={onToggleReadingView}
                  title="Hide toolbars & panes for clean manual screenshot"
                  style={{ border: "1px solid #d2d0ce", background: "#ffffff" }}
                >
                  <Eye size={12} color="#117865" />
                  <span>Clean view</span>
                </button>
              )}
              <button
                type="button"
                className={styles.collapseChevronBtn}
                onClick={onToggleRibbon}
                title={ribbonCollapsed ? "Show ribbon" : "Collapse ribbon"}
                aria-label="Toggle ribbon"
              >
                {ribbonCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            </div>
          </div>

          {!ribbonCollapsed ? (
            <div className={styles.ribbonStrip} role="toolbar" aria-label={`${activeTab} ribbon commands`}>
              {activeTab === "File" ? (
                <>
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onUploadFileClick}>
                        <ExcelWorkbookIcon size={22} />
                        <span>Import<br />CSV / Excel</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onOpenGetDataModal}>
                        <GetDataRibbonIcon size={22} />
                        <span>Sample<br />datasets</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Data Import</span>
                  </div>

                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onLoadSocialSample}>
                        <Database size={18} color="#118DFF" />
                        <span>Social KPI</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onLoadRetailSample}>
                        <Database size={18} color="#117865" />
                        <span>Retail Sales</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onLoadStudentSample}>
                        <Database size={18} color="#744EC2" />
                        <span>Students</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onLoadRelationalSample}>
                        <RelationshipRibbonIcon size={20} />
                        <span>Orders +<br />Products</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Sample Workbooks</span>
                  </div>

                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset}
                        onClick={onSaveProject}
                      >
                        <SaveIcon size={20} />
                        <span>Save<br />Project</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onLoadProjectClick}>
                        <FolderOpen size={20} color="#117865" />
                        <span>Open<br />Project</span>
                      </button>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset}
                        onClick={onExportCsv}
                      >
                        <Download size={20} color="#107c41" />
                        <span>Export<br />CSV</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Project &amp; Export</span>
                  </div>

                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset}
                        onClick={onResetReport}
                      >
                        <RefreshRibbonIcon size={20} />
                        <span>Reset<br />Layout</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Report</span>
                  </div>
                </>
              ) : null}

              {activeTab === "Home" ? (
                <>
                  {/* 1. Clipboard */}
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasCopiedVisual}
                        onClick={onPasteVisual}
                        title="Paste copied visual (Ctrl+V)"
                      >
                        <PasteIcon size={22} />
                        <span>Paste</span>
                      </button>
                      <div className={styles.ribbonColStack}>
                        <button
                          type="button"
                          className={styles.ribbonSmBtn}
                          disabled={!selectedVisual}
                          onClick={onCutSelected}
                        >
                          <CutIcon size={12} />
                          <span>Cut</span>
                        </button>
                        <button
                          type="button"
                          className={styles.ribbonSmBtn}
                          disabled={!selectedVisual}
                          onClick={onCopySelected}
                        >
                          <CopyIcon size={12} />
                          <span>Copy</span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.ribbonSmBtn} ${formatPainterActive ? styles.ribbonLgBtnActive : ""}`}
                          disabled={!selectedVisual}
                          onClick={onToggleFormatPainter}
                          title="Copy styling from selected visual to another visual"
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
                      <button type="button" className={styles.ribbonLgBtn} onClick={onUploadFileClick}>
                        <ExcelWorkbookIcon size={22} />
                        <span>Excel<br />workbook</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onUploadFileClick}>
                        <Database size={20} color="#117865" />
                        <span>Text /<br />CSV</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onOpenEnterData}>
                        <EnterDataRibbonIcon size={22} />
                        <span>Enter<br />data</span>
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
                        <span>Transform<br />data</span>
                      </button>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset}
                        onClick={onRefreshData}
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
                        onClick={() => (hasDataset ? onAddVisual("textbox") : onOpenGetDataModal())}
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
                        <span>Visuals<br />pane</span>
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
                        disabled={!hasDataset}
                        onClick={onOpenNewMeasure}
                      >
                        <CalculatorRibbonIcon size={22} />
                        <span>New<br />measure</span>
                      </button>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset}
                        onClick={onOpenNewColumn}
                      >
                        <NewColumnRibbonIcon size={22} />
                        <span>New<br />column</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Calculations</span>
                  </div>

                  {/* 6. Filters */}
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset || activeFilterCount === 0}
                        onClick={onClearAllFilters}
                        title="Clear all active slicers, page, report, and visual filters"
                      >
                        <Eraser size={20} color={activeFilterCount > 0 ? "#117865" : "#605e5c"} />
                        <span>Clear filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Filters</span>
                  </div>
                </>
              ) : null}

              {activeTab === "Insert" ? (
                <>
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onAddPage}>
                        <PlusSquare size={20} color="#117865" />
                        <span>New<br />page</span>
                      </button>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        onClick={onDuplicatePage}
                      >
                        <CopyIcon size={18} />
                        <span>Duplicate<br />page</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Pages</span>
                  </div>

                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems} style={{ gap: 4 }}>
                      {INSERT_GALLERY.map(([vType, label]) => (
                        <button
                          key={vType}
                          type="button"
                          className={styles.ribbonLgBtn}
                          disabled={!hasDataset}
                          onClick={() => onAddVisual(vType)}
                          title={`Insert ${label} visual`}
                        >
                          <DesktopVizTileGlyph tileId={vType} />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                    <span className={styles.ribbonGroupLabel}>Visuals</span>
                  </div>

                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset}
                        onClick={() => onAddVisual("textbox")}
                      >
                        <TextBoxRibbonIcon size={22} />
                        <span>Text<br />box</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Elements</span>
                  </div>
                </>
              ) : null}

              {activeTab === "Modeling" ? (
                <>
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset}
                        onClick={onOpenNewMeasure}
                      >
                        <CalculatorRibbonIcon size={22} />
                        <span>New<br />measure</span>
                      </button>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset}
                        onClick={onOpenNewColumn}
                      >
                        <NewColumnRibbonIcon size={22} />
                        <span>New<br />column</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Calculations</span>
                  </div>

                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        disabled={!hasDataset}
                        onClick={onOpenRelationships}
                      >
                        <RelationshipRibbonIcon size={22} />
                        <span>Manage<br />relationships</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Relationships</span>
                  </div>

                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems} style={{ gap: 8 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 10.5, color: "#605e5c" }}>
                          {selectedColumn ? `Column: ${selectedColumn.label}` : "Select column in Data"}
                        </span>
                        <select
                          aria-label="Selected column data type"
                          disabled={!selectedColumn}
                          value={selectedColumn?.type || "text"}
                          onChange={(e) => onChangeSelectedColumnType(e.target.value as ColumnType)}
                          className={styles.chipSelect}
                          style={{ height: 24, fontSize: 11 }}
                        >
                          <option value="text">Data type: Text</option>
                          <option value="number">Data type: Whole / Decimal</option>
                          <option value="date">Data type: Date</option>
                        </select>
                      </div>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Formatting</span>
                  </div>

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
                          <SlidersHorizontal size={16} color="#117865" />
                          <span style={{ textTransform: "capitalize" }}>{fn}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={!selectedVisual}
                        onClick={() => onChangeSort("asc")}
                        className={`${styles.ribbonLgBtn} ${selectedVisual?.sortDir === "asc" ? styles.ribbonLgBtnActive : ""}`}
                      >
                        <ArrowUp size={16} />
                        <span>Sort Asc</span>
                      </button>
                      <button
                        type="button"
                        disabled={!selectedVisual}
                        onClick={() => onChangeSort("desc")}
                        className={`${styles.ribbonLgBtn} ${selectedVisual?.sortDir === "desc" ? styles.ribbonLgBtnActive : ""}`}
                      >
                        <ArrowDown size={16} />
                        <span>Sort Desc</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Active Visual Summarization</span>
                  </div>
                </>
              ) : null}

              {activeTab === "View" ? (
                <>
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems} style={{ gap: 4 }}>
                      {POWERBI_THEMES.map((theme) => (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => onSelectTheme(theme.id)}
                          className={`${styles.ribbonLgBtn} ${activeTheme.id === theme.id ? styles.ribbonLgBtnActive : ""}`}
                          title={`Apply ${theme.name} theme`}
                        >
                          <span style={{ display: "inline-flex", gap: 2 }}>
                            {theme.palette.slice(0, 3).map((hex) => (
                              <span
                                key={hex}
                                style={{
                                  width: 8,
                                  height: 16,
                                  borderRadius: 1,
                                  background: hex,
                                }}
                              />
                            ))}
                          </span>
                          <span>{theme.name}</span>
                        </button>
                      ))}
                    </div>
                    <span className={styles.ribbonGroupLabel}>Themes</span>
                  </div>

                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onResetZoom}>
                        <Maximize2 size={17} />
                        <span>Fit to<br />page</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onActualZoom}>
                        <Square size={17} />
                        <span>Actual<br />size</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Page View</span>
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
                        onClick={onToggleSnapToGrid}
                        className={`${styles.ribbonLgBtn} ${snapToGrid ? styles.ribbonLgBtnActive : ""}`}
                      >
                        <Magnet size={17} />
                        <span>Snap to<br />grid</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Page Options</span>
                  </div>

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
                        <span>Visuals</span>
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
                    <span className={styles.ribbonGroupLabel}>Show Panes</span>
                  </div>
                </>
              ) : null}

              {activeTab === "Format" && selectedVisual ? (
                <>
                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems} style={{ gap: 6 }}>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateSelectedFormat({ showTitle: !selectedVisual.format.showTitle })
                        }
                        className={`${styles.ribbonLgBtn} ${selectedVisual.format.showTitle ? styles.ribbonLgBtnActive : ""}`}
                      >
                        <TextBoxRibbonIcon size={18} />
                        <span>Title</span>
                      </button>
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
                      <div style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: 4 }}>
                        {activeTheme.palette.slice(0, 6).map((hex) => (
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

                  <div className={styles.ribbonGroup}>
                    <div className={styles.ribbonGroupItems}>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onBringForward}>
                        <ArrowUp size={16} />
                        <span>Bring<br />forward</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onSendBackward}>
                        <ArrowDown size={16} />
                        <span>Send<br />backward</span>
                      </button>
                      <button type="button" className={styles.ribbonLgBtn} onClick={onDuplicateSelected}>
                        <CopyIcon size={16} />
                        <span>Duplicate</span>
                      </button>
                      <button
                        type="button"
                        className={styles.ribbonLgBtn}
                        onClick={onDeleteSelected}
                        style={{ color: "#a4262c" }}
                      >
                        <Trash2 size={16} />
                        <span>Delete</span>
                      </button>
                    </div>
                    <span className={styles.ribbonGroupLabel}>Arrange</span>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
