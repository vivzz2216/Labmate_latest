"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Database, FileSpreadsheet, GraduationCap, Link2, Upload } from "lucide-react";
import {
  addOrUpdateCalculatedColumn,
  autoDetectRelationships,
  changeColumnType,
  createDefaultReportPages,
  exportTableToCsv,
  getVisualDefaultTitle,
  handleMissingValues,
  parseCsvText,
  recomputeCalculatedColumns,
  removeTableColumn,
  renameTableColumn,
  resolveTableRows,
} from "@/lib/powerbi/csvEngine";
import { parseExcelArrayBuffer, type ParsedExcelSheet } from "@/lib/powerbi/excelParser";
import { POWERBI_THEMES } from "@/lib/powerbi/palette";
import {
  RELATIONAL_ORDERS_CSV,
  RELATIONAL_PRODUCTS_CSV,
  RETAIL_SAMPLE_CSV,
  SOCIAL_KPI_POWERBI_CSV,
  STUDENT_PERFORMANCE_CSV,
} from "@/lib/powerbi/sampleCsv";
import type {
  AggregationFn,
  ColumnType,
  CrossFilterSelection,
  DatasetModel,
  DateRangeFilter,
  MeasureDef,
  NumericRangeFilter,
  PowerBiVisual,
  PowerBiVisualType,
  ReportPage,
  RibbonTab,
  TableRelationship,
  ViewMode,
  VisualAnalytics,
  VisualLayout,
} from "@/lib/powerbi/types";
import { ApplicationHeader } from "./ApplicationHeader";
import { ChartContainer } from "./ChartContainer";
import { DashboardCard, type DraggedFieldPayload } from "./DashboardCard";
import { DataPane } from "./DataPane";
import { DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { ExcelNavigatorModal } from "./ExcelNavigatorModal";
import { FilterPanel } from "./FilterPanel";
import { FormulaModal } from "./FormulaModal";
import { LoadingState } from "./LoadingState";
import { Modal } from "./Modal";
import { ModelView } from "./ModelView";
import { RelationshipsModal } from "./RelationshipsModal";
import { Sidebar } from "./Sidebar";
import { Tabs } from "./Tabs";
import { TransformDataModal } from "./TransformDataModal";
import { useStudioHook } from "../netlab/studioHook";
import { powerBiPractical, type PowerBiPracticalFrame } from "@/lib/powerbi/practicals";
import { VisualizationsPane } from "./VisualizationsPane";
import styles from "./powerbi.module.css";

interface WorkspaceSnapshot {
  tables: DatasetModel[];
  activeTableId: string;
  pages: ReportPage[];
  activePageId: string;
  measures: MeasureDef[];
  relationships: TableRelationship[];
  themeId: string;
}

const MAX_HISTORY = 30;

/** Interactive Microsoft Power BI Desktop workspace for CSV/Excel analytics & college practicals. */
export function PowerBiWorkspace({ capture = false }: { capture?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [tables, setTables] = useState<DatasetModel[]>([]);
  const [activeTableId, setActiveTableId] = useState<string>("");
  const [pages, setPages] = useState<ReportPage[]>([
    { id: "page-1", name: "Page 1", visuals: [], pageFilters: {} },
  ]);
  const [activePageId, setActivePageId] = useState("page-1");
  const [measures, setMeasures] = useState<MeasureDef[]>([]);
  const [relationships, setRelationships] = useState<TableRelationship[]>([]);
  const [themeId, setThemeId] = useState<string>("default");

  const [undoStack, setUndoStack] = useState<WorkspaceSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<WorkspaceSnapshot[]>([]);

  const [activeView, setActiveView] = useState<ViewMode>("report");
  const [activeTab, setActiveTab] = useState<RibbonTab>("Home");
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false);
  const [readingView, setReadingView] = useState(false);
  const [mobileLayoutPreview, setMobileLayoutPreview] = useState(false);

  const [selectedVisualId, setSelectedVisualId] = useState<string | null>(null);
  const [focusVisualId, setFocusVisualId] = useState<string | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<{
    tableId: string;
    columnName: string;
  } | null>(null);

  const [copiedVisual, setCopiedVisual] = useState<PowerBiVisual | null>(null);
  const [copiedFormat, setCopiedFormat] = useState<PowerBiVisual["format"] | null>(null);
  const [formatPainterActive, setFormatPainterActive] = useState(false);

  const [showFiltersPane, setShowFiltersPane] = useState(false);
  const [showVizPane, setShowVizPane] = useState(true);
  const [showDataPane, setShowDataPane] = useState(false);
  const [showGridlines, setShowGridlines] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);

  const [reportFilters, setReportFilters] = useState<Record<string, string[]>>({});
  const [slicerFilters, setSlicerFilters] = useState<Record<string, string[]>>({});
  const [captureFrame, setCaptureFrame] = useState<PowerBiPracticalFrame | null>(null);
  useStudioHook<Record<string, never>, PowerBiPracticalFrame>({
    load: () => {},
    show: (step) => {
      if (!capture) return;
      setTables(step.tables);
      setActiveTableId(step.tables[0].id || step.tables[0].name);
      setPages([step.page]);
      setActivePageId(step.page.id);
      setMeasures(step.measures);
      setRelationships(step.relationships);
      setSlicerFilters(step.slicer || {});
      setActiveView(step.view);
      setShowDataPane(true);
      setShowVizPane(step.view === "report");
      setTransformOpen(Boolean(step.steps));
      setCaptureFrame(step);
    },
  }, captureFrame?.id);
  useEffect(() => {
    if (!capture) return;
    window.__labmatePractical = powerBiPractical;
    return () => { delete window.__labmatePractical; };
  }, [capture]);
  const [numericFilters, setNumericFilters] = useState<Record<string, NumericRangeFilter>>({});
  const [dateRange, setDateRange] = useState<DateRangeFilter | null>(null);
  const [crossFilter, setCrossFilter] = useState<CrossFilterSelection | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Canvas zoom scale
  const [fitScale, setFitScale] = useState(0.76);
  const [manualZoomPct, setManualZoomPct] = useState<number | null>(null);

  // Modals
  const [getDataOpen, setGetDataOpen] = useState(false);
  const [enterDataOpen, setEnterDataOpen] = useState(false);
  const [transformOpen, setTransformOpen] = useState(false);
  const [relationshipsOpen, setRelationshipsOpen] = useState(false);
  const [formulaModal, setFormulaModal] = useState<{
    open: boolean;
    mode: "column" | "measure";
    tableId: string;
  }>({ open: false, mode: "measure", tableId: "" });
  const [excelNav, setExcelNav] = useState<{
    open: boolean;
    fileName: string;
    sheets: ParsedExcelSheet[];
  }>({ open: false, fileName: "", sheets: [] });

  const [pasteName, setPasteName] = useState("CustomTable");
  const [pasteText, setPasteText] = useState(
    "category,region,sales,units\nElectronics,North,42000,120\nSoftware,West,68500,95\nServices,East,31200,80",
  );

  const activeTheme = useMemo(
    () => POWERBI_THEMES.find((t) => t.id === themeId) || POWERBI_THEMES[0],
    [themeId],
  );

  const activeTable = useMemo(
    () => tables.find((t) => (t.id || t.name) === activeTableId) || tables[0] || null,
    [tables, activeTableId],
  );

  const activePage = useMemo(
    () => pages.find((p) => p.id === activePageId) || pages[0],
    [pages, activePageId],
  );

  const selectedVisual = useMemo(
    () => activePage?.visuals.find((v) => v.id === selectedVisualId) || null,
    [activePage, selectedVisualId],
  );

  const visualTable = useMemo(() => {
    if (selectedVisual?.tableId) {
      return tables.find((t) => (t.id || t.name) === selectedVisual.tableId) || activeTable;
    }
    return activeTable;
  }, [selectedVisual, tables, activeTable]);

  const selectedColumnMeta = useMemo(() => {
    if (!selectedColumn) return null;
    const tbl = tables.find((t) => (t.id || t.name) === selectedColumn.tableId);
    return tbl?.columns.find((c) => c.name === selectedColumn.columnName) || null;
  }, [selectedColumn, tables]);

  const canvasW = mobileLayoutPreview ? 390 : 1280;
  const canvasH = mobileLayoutPreview ? 720 : 720;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 900px)");
    const syncNarrow = (matches: boolean) => {
      if (matches) {
        setShowFiltersPane(false);
        setShowVizPane(false);
        setShowDataPane(false);
      }
    };
    syncNarrow(mq.matches);
    const onChange = (e: MediaQueryListEvent) => syncNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const recompute = () => {
      const availW = Math.max(180, el.clientWidth - 16);
      const availH = Math.max(160, el.clientHeight - 16);
      const next = Math.min(availW / canvasW, availH / canvasH, 1);
      setFitScale(Number(Math.max(0.18, next).toFixed(3)));
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [
    showFiltersPane,
    showVizPane,
    showDataPane,
    ribbonCollapsed,
    readingView,
    activeView,
    canvasW,
    canvasH,
  ]);

  const effectiveScale = manualZoomPct !== null ? manualZoomPct / 100 : fitScale;
  const displayedZoomPct = Math.round(effectiveScale * 100);

  const captureSnapshot = useCallback(
    (): WorkspaceSnapshot => ({
      tables,
      activeTableId,
      pages,
      activePageId,
      measures,
      relationships,
      themeId,
    }),
    [tables, activeTableId, pages, activePageId, measures, relationships, themeId],
  );

  const pushHistory = useCallback(() => {
    const snap = captureSnapshot();
    setUndoStack((prev) => [...prev.slice(-(MAX_HISTORY - 1)), snap]);
    setRedoStack([]);
  }, [captureSnapshot]);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const prevSnap = prev[prev.length - 1];
      setRedoStack((r) => [...r, captureSnapshot()]);
      setTables(prevSnap.tables);
      setActiveTableId(prevSnap.activeTableId);
      setPages(prevSnap.pages);
      setActivePageId(prevSnap.activePageId);
      setMeasures(prevSnap.measures);
      setRelationships(prevSnap.relationships);
      setThemeId(prevSnap.themeId);
      return prev.slice(0, -1);
    });
  }, [captureSnapshot]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const nextSnap = prev[prev.length - 1];
      setUndoStack((u) => [...u, captureSnapshot()]);
      setTables(nextSnap.tables);
      setActiveTableId(nextSnap.activeTableId);
      setPages(nextSnap.pages);
      setActivePageId(nextSnap.activePageId);
      setMeasures(nextSnap.measures);
      setRelationships(nextSnap.relationships);
      setThemeId(nextSnap.themeId);
      return prev.slice(0, -1);
    });
  }, [captureSnapshot]);

  const applyLoadedTables = useCallback(
    (loadedTables: DatasetModel[], mode: "replace" | "append" = "replace") => {
      const positioned = loadedTables.map((t, i) => ({
        ...t,
        modelPosition: t.modelPosition || {
          x: 36 + (i % 3) * 410,
          y: 36 + Math.floor(i / 3) * 290,
        },
      }));

      const nextTables =
        mode === "append" ? [...tables, ...positioned] : positioned;
      const autoRels = autoDetectRelationships(
        nextTables,
        mode === "append" ? relationships : [],
      );
      const primary = nextTables[0];
      const primaryId = primary.id || primary.name;
      const generated =
        mode === "append" && tables.length > 0
          ? pages
          : createDefaultReportPages(primary);

      setTables(nextTables);
      setActiveTableId(primaryId);
      setRelationships(autoRels);
      if (mode === "replace") {
        setPages(generated);
        setActivePageId(generated[0].id);
        setSelectedVisualId(generated[0].visuals[0]?.id || null);
        setMeasures([]);
        setReportFilters({});
        setSlicerFilters({});
        setNumericFilters({});
        setDateRange(null);
        setCrossFilter(null);
        setUndoStack([]);
        setRedoStack([]);
      }
      setFocusVisualId(null);
      setSelectedColumn(
        primary.columns[0]
          ? { tableId: primaryId, columnName: primary.columns[0].name }
          : null,
      );

      const isWide = typeof window === "undefined" || window.innerWidth > 900;
      setShowFiltersPane(isWide);
      setShowDataPane(isWide);
      setShowVizPane(isWide);
      setActiveView("report");
    },
    [tables, relationships, pages],
  );

  const loadCsvIntoModel = useCallback(
    (csvText: string, tableName: string, fileName: string, append = false) => {
      setUploadError(null);
      setLoadingMsg(`Loading ${fileName}...`);

      window.setTimeout(() => {
        try {
          const parsed = parseCsvText(csvText, tableName, fileName);
          if (parsed.columns.length === 0 || parsed.rows.length === 0) {
            setUploadError("The CSV file appears empty or missing valid data rows.");
            setLoadingMsg(null);
            return;
          }
          applyLoadedTables([parsed], append ? "append" : "replace");
        } catch {
          setUploadError("Could not parse CSV. Ensure delimited rows with a valid header row.");
        } finally {
          setLoadingMsg(null);
        }
      }, 60);
    },
    [applyLoadedTables],
  );

  const loadRelationalSample = useCallback(() => {
    setUploadError(null);
    setLoadingMsg("Loading Orders & Products...");
    window.setTimeout(() => {
      const orders = parseCsvText(RELATIONAL_ORDERS_CSV, "Orders", "orders.csv");
      const products = parseCsvText(RELATIONAL_PRODUCTS_CSV, "Products", "products.csv");
      applyLoadedTables([orders, products], "replace");
      setLoadingMsg(null);
    }, 60);
  }, [applyLoadedTables]);

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const lower = file.name.toLowerCase();
    setUploadError(null);

    if (lower.endsWith(".json")) {
      try {
        const text = await file.text();
        const proj = JSON.parse(text) as WorkspaceSnapshot;
        if (!Array.isArray(proj.tables) || !Array.isArray(proj.pages)) {
          throw new Error("Invalid report file");
        }
        setTables(proj.tables);
        setActiveTableId(proj.activeTableId || proj.tables[0]?.id || proj.tables[0]?.name || "");
        setPages(proj.pages);
        setActivePageId(proj.activePageId || proj.pages[0]?.id || "page-1");
        setMeasures(proj.measures || []);
        setRelationships(proj.relationships || []);
        setThemeId(proj.themeId || "default");
        setSelectedVisualId(proj.pages[0]?.visuals[0]?.id || null);
      } catch {
        setUploadError("Could not open JSON project file. Ensure it was exported from Power BI Studio.");
      }
      return;
    }

    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      setLoadingMsg(`Reading Excel workbook ${file.name}...`);
      try {
        const buf = await file.arrayBuffer();
        const sheets = await parseExcelArrayBuffer(buf, file.name);
        setLoadingMsg(null);
        if (sheets.length === 1) {
          applyLoadedTables([sheets[0].dataset], "replace");
        } else {
          setExcelNav({ open: true, fileName: file.name, sheets });
        }
      } catch (err) {
        setLoadingMsg(null);
        setUploadError(
          err instanceof Error ? err.message : "Could not read Excel workbook.",
        );
      }
      return;
    }

    // Standard CSV / TSV / TXT
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      loadCsvIntoModel(content, file.name.replace(/\.[^.]+$/, ""), file.name);
    };
    reader.readAsText(file);
  };

  const updateVisual = useCallback(
    (
      visualId: string,
      updater: (v: PowerBiVisual) => PowerBiVisual,
      commitHistory = true,
    ) => {
      if (commitHistory) pushHistory();
      setPages((prev) =>
        prev.map((page) =>
          page.id !== activePageId
            ? page
            : {
                ...page,
                visuals: page.visuals.map((v) => (v.id === visualId ? updater(v) : v)),
              },
        ),
      );
    },
    [activePageId, pushHistory],
  );

  const addVisual = useCallback(
    (type: PowerBiVisualType, customLayout?: Partial<VisualLayout>, initFields?: { tableId: string; columnName: string; isNumeric: boolean }) => {
      const targetTbl = initFields
        ? tables.find((t) => (t.id || t.name) === initFields.tableId) || activeTable
        : activeTable;
      if (!targetTbl) return;

      pushHistory();
      const tId = targetTbl.id || targetTbl.name;
      const textCol =
        initFields && !initFields.isNumeric
          ? initFields.columnName
          : targetTbl.columns.find((c) => c.type !== "number")?.name || targetTbl.columns[0]?.name;
      const numCol =
        initFields && initFields.isNumeric
          ? initFields.columnName
          : targetTbl.columns.find((c) => c.isNumeric)?.name;

      const idx = activePage.visuals.length;
      const offset = (idx % 5) * 26;
      const isCard = type === "card";
      const isSlicer = type === "slicer";
      const isText = type === "textbox";

      const defaultW = isCard ? 236 : isSlicer ? 268 : isText ? 340 : 460;
      const defaultH = isCard ? 110 : isSlicer ? 240 : isText ? 140 : 272;

      const newVisual: PowerBiVisual = {
        id: `v-${Date.now().toString(36)}-${idx}`,
        type,
        tableId: tId,
        title: isText
          ? "Report Notes"
          : getVisualDefaultTitle(type, textCol, isSlicer || !numCol ? [] : [numCol], "sum"),
        xAxis: isCard || isText ? undefined : textCol,
        yAxis: isSlicer || isText || !numCol ? [] : [numCol],
        legend:
          type === "matrix"
            ? targetTbl.columns.filter((c) => !c.isNumeric && c.name !== textCol)[0]?.name
            : undefined,
        aggregation: "sum",
        textContent: isText ? "Key Insights:\n• Edit this note to summarize findings for your lab report." : undefined,
        fontSize: isText ? 14 : undefined,
        layout: {
          x: Math.max(0, Math.min(canvasW - defaultW, customLayout?.x ?? 48 + offset)),
          y: Math.max(0, Math.min(canvasH - defaultH, customLayout?.y ?? 48 + offset)),
          w: customLayout?.w ?? defaultW,
          h: customLayout?.h ?? defaultH,
        },
        format: {
          showTitle: !isCard,
          showDataLabels: true,
          showLegend: true,
          accentColor: activeTheme.palette[idx % activeTheme.palette.length],
          backgroundColor: activeTheme.visualBg || "#ffffff",
          showBorder: true,
        },
        visualFilters: {},
      };

      setPages((prev) =>
        prev.map((p) =>
          p.id !== activePageId ? p : { ...p, visuals: [...p.visuals, newVisual] },
        ),
      );
      setSelectedVisualId(newVisual.id);
      setActiveView("report");
    },
    [tables, activeTable, activePage, activePageId, activeTheme, canvasW, canvasH, pushHistory],
  );

  const deleteVisual = useCallback(
    (visualId: string) => {
      pushHistory();
      setPages((prev) =>
        prev.map((p) =>
          p.id !== activePageId
            ? p
            : { ...p, visuals: p.visuals.filter((v) => v.id !== visualId) },
        ),
      );
      if (selectedVisualId === visualId) setSelectedVisualId(null);
      if (focusVisualId === visualId) setFocusVisualId(null);
    },
    [activePageId, selectedVisualId, focusVisualId, pushHistory],
  );

  const duplicateSelected = useCallback(() => {
    if (!selectedVisual) return;
    pushHistory();
    const copy: PowerBiVisual = {
      ...selectedVisual,
      id: `v-copy-${Date.now().toString(36)}`,
      title: `${selectedVisual.title} (Copy)`,
      layout: {
        ...selectedVisual.layout,
        x: Math.min(canvasW - selectedVisual.layout.w, selectedVisual.layout.x + 24),
        y: Math.min(canvasH - selectedVisual.layout.h, selectedVisual.layout.y + 24),
      },
    };
    setPages((prev) =>
      prev.map((p) =>
        p.id !== activePageId ? p : { ...p, visuals: [...p.visuals, copy] },
      ),
    );
    setSelectedVisualId(copy.id);
  }, [selectedVisual, activePageId, canvasW, canvasH, pushHistory]);

  const handleCopyVisual = useCallback(() => {
    if (!selectedVisual) return;
    setCopiedVisual({ ...selectedVisual });
  }, [selectedVisual]);

  const handleCutVisual = useCallback(() => {
    if (!selectedVisual) return;
    setCopiedVisual({ ...selectedVisual });
    deleteVisual(selectedVisual.id);
  }, [selectedVisual, deleteVisual]);

  const handlePasteVisual = useCallback(() => {
    if (!copiedVisual) return;
    pushHistory();
    const copy: PowerBiVisual = {
      ...copiedVisual,
      id: `v-paste-${Date.now().toString(36)}`,
      layout: {
        ...copiedVisual.layout,
        x: Math.min(canvasW - copiedVisual.layout.w, copiedVisual.layout.x + 20),
        y: Math.min(canvasH - copiedVisual.layout.h, copiedVisual.layout.y + 20),
      },
    };
    setPages((prev) =>
      prev.map((p) =>
        p.id !== activePageId ? p : { ...p, visuals: [...p.visuals, copy] },
      ),
    );
    setSelectedVisualId(copy.id);
  }, [copiedVisual, activePageId, canvasW, canvasH, pushHistory]);

  // Global keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+X, Ctrl+V, Delete)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingText =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isEditingText) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (selectedVisual) {
          e.preventDefault();
          handleCopyVisual();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
        if (selectedVisual) {
          e.preventDefault();
          handleCutVisual();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        if (copiedVisual) {
          e.preventDefault();
          handlePasteVisual();
        }
      } else if (e.key === "Delete" && selectedVisual && activeView === "report") {
        e.preventDefault();
        deleteVisual(selectedVisual.id);
      } else if (e.key === "Escape") {
        if (formatPainterActive) setFormatPainterActive(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    handleUndo,
    handleRedo,
    handleCopyVisual,
    handleCutVisual,
    handlePasteVisual,
    deleteVisual,
    selectedVisual,
    copiedVisual,
    activeView,
    formatPainterActive,
  ]);

  const handleToggleFilterValue = (
    scope: "visual" | "page" | "report",
    column: string,
    value: string,
  ) => {
    const toggleList = (map: Record<string, string[]>) => {
      const cur = map[column] || [];
      const next = cur.indexOf(value) !== -1 ? cur.filter((x) => x !== value) : [...cur, value];
      const out = { ...map };
      if (next.length === 0) delete out[column];
      else out[column] = next;
      return out;
    };

    if (scope === "report") {
      setReportFilters(toggleList);
    } else if (scope === "page") {
      setPages((prev) =>
        prev.map((p) =>
          p.id !== activePageId ? p : { ...p, pageFilters: toggleList(p.pageFilters) },
        ),
      );
    } else if (scope === "visual" && selectedVisualId) {
      updateVisual(selectedVisualId, (v) => ({
        ...v,
        visualFilters: toggleList(v.visualFilters),
      }));
    }
  };

  const handleClearFilterField = (
    scope: "visual" | "page" | "report",
    column: string,
  ) => {
    const removeKey = (map: Record<string, string[]>) => {
      const out = { ...map };
      delete out[column];
      return out;
    };
    if (scope === "report") setReportFilters(removeKey);
    else if (scope === "page") {
      setPages((prev) =>
        prev.map((p) =>
          p.id !== activePageId ? p : { ...p, pageFilters: removeKey(p.pageFilters) },
        ),
      );
    } else if (scope === "visual" && selectedVisualId) {
      updateVisual(selectedVisualId, (v) => ({
        ...v,
        visualFilters: removeKey(v.visualFilters),
      }));
    }
  };

  const handleClearAllFilters = () => {
    setReportFilters({});
    setSlicerFilters({});
    setNumericFilters({});
    setDateRange(null);
    setCrossFilter(null);
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        pageFilters: {},
        visuals: p.visuals.map((v) => ({ ...v, visualFilters: {} })),
      })),
    );
  };

  const applyFieldToVisual = useCallback(
    (
      targetVisual: PowerBiVisual,
      fieldName: string,
      isNumeric: boolean,
      targetWell?: "xAxis" | "yAxis" | "legend",
    ) => {
      updateVisual(targetVisual.id, (v) => {
        if (targetWell === "xAxis") {
          return {
            ...v,
            xAxis: fieldName,
            title: getVisualDefaultTitle(v.type, fieldName, v.yAxis, v.aggregation),
          };
        }
        if (targetWell === "legend") {
          return { ...v, legend: fieldName };
        }
        if (targetWell === "yAxis" || isNumeric) {
          const exists = v.yAxis.indexOf(fieldName) !== -1;
          const nextY =
            targetWell === "yAxis" && exists
              ? v.yAxis
              : exists
                ? v.yAxis.filter((y) => y !== fieldName)
                : v.type === "card" || v.type === "gauge"
                  ? [fieldName]
                  : [...v.yAxis, fieldName];
          return {
            ...v,
            yAxis: nextY,
            title: getVisualDefaultTitle(v.type, v.xAxis, nextY, v.aggregation),
          };
        }

        const nextX = v.xAxis === fieldName ? undefined : fieldName;
        return {
          ...v,
          xAxis: nextX,
          title: getVisualDefaultTitle(v.type, nextX, v.yAxis, v.aggregation),
        };
      });
    },
    [updateVisual],
  );

  const handleToggleFieldOnVisual = (
    tableId: string,
    fieldName: string,
    isNumeric: boolean,
  ) => {
    if (!selectedVisual) {
      addVisual(isNumeric ? "clusteredColumn" : "table", undefined, {
        tableId,
        columnName: fieldName,
        isNumeric,
      });
      return;
    }
    applyFieldToVisual(selectedVisual, fieldName, isNumeric);
  };

  const handleDropFieldPayload = (
    payload: DraggedFieldPayload,
    well?: "xAxis" | "yAxis" | "legend",
    targetVisualOverride?: PowerBiVisual,
  ) => {
    const tbl = tables.find((t) => (t.id || t.name) === payload.tableId) || activeTable;
    const colMeta = tbl?.columns.find((c) => c.name === payload.columnName);
    const isNum = Boolean(payload.isMeasure || colMeta?.isNumeric);
    const v = targetVisualOverride || selectedVisual;
    if (!v) return;
    applyFieldToVisual(v, payload.columnName, isNum, well);
  };

  const toggleRightPane = useCallback((pane: "filters" | "viz" | "data") => {
    const isNarrow = typeof window !== "undefined" && window.innerWidth <= 900;
    if (pane === "filters") {
      setShowFiltersPane((s) => {
        const next = !s;
        if (next && isNarrow) {
          setShowVizPane(false);
          setShowDataPane(false);
        }
        return next;
      });
    } else if (pane === "viz") {
      setShowVizPane((s) => {
        const next = !s;
        if (next && isNarrow) {
          setShowFiltersPane(false);
          setShowDataPane(false);
        }
        return next;
      });
    } else {
      setShowDataPane((s) => {
        const next = !s;
        if (next && isNarrow) {
          setShowFiltersPane(false);
          setShowVizPane(false);
        }
        return next;
      });
    }
  }, []);

  // Data operations across Table View, Transform Data, Modeling & Formula Modal
  const mutateTable = useCallback(
    (tableId: string, fn: (t: DatasetModel) => DatasetModel) => {
      pushHistory();
      setTables((prev) =>
        prev.map((t) => ((t.id || t.name) === tableId ? fn(t) : t)),
      );
    },
    [pushHistory],
  );

  const handleRenameColumnAcrossModel = (
    tableId: string,
    oldName: string,
    newName: string,
  ) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    pushHistory();
    setTables((prev) =>
      prev.map((t) =>
        (t.id || t.name) === tableId ? renameTableColumn(t, oldName, trimmed) : t,
      ),
    );
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        visuals: p.visuals.map((v) => ({
          ...v,
          xAxis: v.xAxis === oldName ? trimmed : v.xAxis,
          legend: v.legend === oldName ? trimmed : v.legend,
          yAxis: v.yAxis.map((y) => (y === oldName ? trimmed : y)),
        })),
      })),
    );
    if (selectedColumn?.tableId === tableId && selectedColumn.columnName === oldName) {
      setSelectedColumn({ tableId, columnName: trimmed });
    }
  };

  const handleSaveCalculatedColumn = (
    tableId: string,
    colName: string,
    formula: string,
  ): string | undefined => {
    const target = tables.find((t) => (t.id || t.name) === tableId);
    if (!target) return "Table not found";
    const res = addOrUpdateCalculatedColumn(target, colName, formula);
    if (res.error) return res.error;
    pushHistory();
    setTables((prev) =>
      prev.map((t) => ((t.id || t.name) === tableId ? res.table : t)),
    );
    setSelectedColumn({ tableId, columnName: colName.trim() });
    return undefined;
  };

  const handleSaveMeasure = (tableId: string, name: string, formula: string) => {
    pushHistory();
    const id = `msr-${Date.now().toString(36)}`;
    setMeasures((prev) => [...prev, { id, name: name.trim(), tableId, formula }]);
  };

  const handleSelectTheme = (nextThemeId: string) => {
    const theme = POWERBI_THEMES.find((t) => t.id === nextThemeId) || POWERBI_THEMES[0];
    pushHistory();
    setThemeId(nextThemeId);
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        visuals: p.visuals.map((v, i) => ({
          ...v,
          format: {
            ...v.format,
            accentColor: theme.palette[i % theme.palette.length],
            backgroundColor: theme.visualBg,
          },
        })),
      })),
    );
  };

  const handleSaveProjectJson = () => {
    if (tables.length === 0) return;
    const snap = captureSnapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTable?.name || "powerbi-report"}.pbi-lite.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportActiveCsv = () => {
    if (!activeTable) return;
    const csv = exportTableToCsv(activeTable);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTable.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddPage = () => {
    pushHistory();
    const id = `page-${Date.now().toString(36)}`;
    const num = pages.length + 1;
    setPages((prev) => [...prev, { id, name: `Page ${num}`, visuals: [], pageFilters: {} }]);
    setActivePageId(id);
    setSelectedVisualId(null);
    setFocusVisualId(null);
    setActiveView("report");
  };

  const handleDuplicatePage = (pageId: string) => {
    const src = pages.find((p) => p.id === pageId);
    if (!src) return;
    pushHistory();
    const id = `page-${Date.now().toString(36)}`;
    const cloned: ReportPage = {
      ...src,
      id,
      name: `${src.name} (Copy)`,
      visuals: src.visuals.map((v, idx) => ({
        ...v,
        id: `${v.id}-dup-${Date.now().toString(36)}-${idx}`,
      })),
    };
    setPages((prev) => [...prev, cloned]);
    setActivePageId(id);
    setSelectedVisualId(cloned.visuals[0]?.id || null);
  };

  const activeTableIdResolved = activeTable ? activeTable.id || activeTable.name : "";
  const filteredRowsActiveTable = useMemo(() => {
    if (!activeTable) return [];
    return resolveTableRows(activeTableIdResolved, tables, relationships, {
      reportFilters,
      pageFilters: activePage?.pageFilters,
      slicerFilters,
      numericFilters,
      dateRange,
      crossFilter,
    });
  }, [activeTable, activeTableIdResolved, tables, relationships, reportFilters, activePage, slicerFilters, numericFilters, dateRange, crossFilter]);

  const activeFilterCount =
    Object.keys(reportFilters).length +
    Object.keys(activePage?.pageFilters || {}).length +
    Object.keys(slicerFilters).length +
    Object.keys(numericFilters).length +
    (dateRange ? 1 : 0) +
    (crossFilter ? 1 : 0);

  const docTitleName =
    tables.length > 1
      ? `${tables[0].name} (+${tables.length - 1})`
      : activeTable?.name || "";

  const visualScopedRows = useMemo(() => {
    if (!selectedVisual || !visualTable) return filteredRowsActiveTable;
    return resolveTableRows(visualTable.id || visualTable.name, tables, relationships, {
      reportFilters,
      pageFilters: activePage?.pageFilters,
      slicerFilters,
      visualFilters: selectedVisual.visualFilters,
      numericFilters,
      dateRange,
      crossFilter: crossFilter?.sourceVisualId !== selectedVisual.id ? crossFilter : null,
    });
  }, [selectedVisual, visualTable, tables, relationships, reportFilters, activePage, slicerFilters, numericFilters, dateRange, crossFilter, filteredRowsActiveTable]);

  return (
    <>
      {/* Single native file picker shared across CSV, Excel (.xlsx/.xls), and Project (.json) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.txt,.xlsx,.xls,.json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={handleFilePicked}
        style={{ display: "none" }}
      />

      <div className={styles.workspaceRoot}>
        <ApplicationHeader
          documentName={docTitleName}
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            if (ribbonCollapsed) setRibbonCollapsed(false);
          }}
          ribbonCollapsed={ribbonCollapsed}
          onToggleRibbon={() => setRibbonCollapsed((c) => !c)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          hasDataset={tables.length > 0}
          selectedVisual={selectedVisual}
          selectedColumn={selectedColumnMeta}
          activeThemeId={themeId}
          readingView={readingView}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          hasCopiedVisual={Boolean(copiedVisual)}
          formatPainterActive={formatPainterActive}
          activeFilterCount={activeFilterCount}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSaveProject={handleSaveProjectJson}
          onLoadProjectClick={() => fileInputRef.current?.click()}
          onExportCsv={handleExportActiveCsv}
          onToggleReadingView={() => setReadingView((r) => !r)}
          onUploadFileClick={() => fileInputRef.current?.click()}
          onLoadSocialSample={() =>
            loadCsvIntoModel(SOCIAL_KPI_POWERBI_CSV, "social_kpi_powerbi", "social_kpi_powerbi.csv")
          }
          onLoadRetailSample={() =>
            loadCsvIntoModel(RETAIL_SAMPLE_CSV, "retail_sales_sample", "retail_sales_sample.csv")
          }
          onLoadStudentSample={() =>
            loadCsvIntoModel(STUDENT_PERFORMANCE_CSV, "student_performance", "student_performance.csv")
          }
          onLoadRelationalSample={loadRelationalSample}
          onOpenGetDataModal={() => setGetDataOpen(true)}
          onOpenEnterData={() => setEnterDataOpen(true)}
          onOpenTransformModal={() => setTransformOpen(true)}
          onRefreshData={() => {
            if (tables.length === 0) return;
            pushHistory();
            setTables((prev) => prev.map((t) => recomputeCalculatedColumns(t)));
          }}
          onResetReport={() => {
            if (!activeTable) return;
            pushHistory();
            const resetPages = createDefaultReportPages(activeTable);
            setPages(resetPages);
            setActivePageId(resetPages[0].id);
            setSelectedVisualId(resetPages[0].visuals[0]?.id || null);
            handleClearAllFilters();
          }}
          onAddVisual={(t) => addVisual(t)}
          onAddPage={handleAddPage}
          onDuplicatePage={() => handleDuplicatePage(activePageId)}
          onCutSelected={handleCutVisual}
          onCopySelected={handleCopyVisual}
          onPasteVisual={handlePasteVisual}
          onToggleFormatPainter={() => {
            if (!selectedVisual) return;
            if (formatPainterActive) {
              setFormatPainterActive(false);
              setCopiedFormat(null);
            } else {
              setCopiedFormat({ ...selectedVisual.format });
              setFormatPainterActive(true);
            }
          }}
          onDuplicateSelected={duplicateSelected}
          onDeleteSelected={() => selectedVisualId && deleteVisual(selectedVisualId)}
          onBringForward={() =>
            selectedVisual &&
            updateVisual(selectedVisual.id, (v) => ({ ...v, zIndex: (v.zIndex || 1) + 1 }))
          }
          onSendBackward={() =>
            selectedVisual &&
            updateVisual(selectedVisual.id, (v) => ({
              ...v,
              zIndex: Math.max(1, (v.zIndex || 1) - 1),
            }))
          }
          onClearAllFilters={handleClearAllFilters}
          showFiltersPane={showFiltersPane}
          showVizPane={showVizPane}
          showDataPane={showDataPane}
          showGridlines={showGridlines}
          snapToGrid={snapToGrid}
          onTogglePane={toggleRightPane}
          onToggleGridlines={() => setShowGridlines((g) => !g)}
          onToggleSnapToGrid={() => setSnapToGrid((s) => !s)}
          onResetZoom={() => setManualZoomPct(null)}
          onActualZoom={() => setManualZoomPct(100)}
          onSelectTheme={handleSelectTheme}
          onChangeAggregation={(agg) => {
            if (!selectedVisual) return;
            updateVisual(selectedVisual.id, (v) => ({
              ...v,
              aggregation: agg,
              title: getVisualDefaultTitle(v.type, v.xAxis, v.yAxis, agg),
            }));
          }}
          onChangeSort={(dir) => {
            if (!selectedVisual) return;
            updateVisual(selectedVisual.id, (v) => ({
              ...v,
              sortBy: v.sortBy || "value",
              sortDir: dir,
            }));
          }}
          onUpdateSelectedFormat={(patch, newTitle) => {
            if (!selectedVisual) return;
            updateVisual(selectedVisual.id, (v) => ({
              ...v,
              title: newTitle !== undefined ? newTitle : v.title,
              format: { ...v.format, ...patch },
            }));
          }}
          onOpenNewMeasure={() =>
            setFormulaModal({
              open: true,
              mode: "measure",
              tableId: activeTableIdResolved,
            })
          }
          onOpenNewColumn={() =>
            setFormulaModal({
              open: true,
              mode: "column",
              tableId: activeTableIdResolved,
            })
          }
          onOpenRelationships={() => setRelationshipsOpen(true)}
          onChangeSelectedColumnType={(newType: ColumnType) => {
            if (!selectedColumn) return;
            mutateTable(selectedColumn.tableId, (t) =>
              changeColumnType(t, selectedColumn.columnName, newType),
            );
          }}
        />

        {uploadError ? (
          <div
            role="alert"
            style={{
              padding: "6px 14px",
              background: "#fde7e9",
              borderBottom: "1px solid #d13438",
              color: "#a4262c",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>{uploadError}</span>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              style={{ border: 0, background: "transparent", cursor: "pointer", fontWeight: 600 }}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className={styles.mainBody}>
          {!readingView ? <Sidebar activeView={activeView} onChangeView={setActiveView} /> : null}

          <main className={styles.canvasColumn}>
            {activeView === "report" ? (
              <div
                ref={viewportRef}
                className={styles.canvasViewport}
                onClick={() => {
                  setSelectedVisualId(null);
                  setFormatPainterActive(false);
                }}
              >
                <div
                  className={styles.canvasScaleFrame}
                  style={{
                    width: Math.round(canvasW * effectiveScale),
                    height: Math.round(canvasH * effectiveScale),
                  }}
                >
                  <div
                    className={`${styles.canvasSheet} ${showGridlines ? styles.canvasGridOverlay : ""}`}
                    style={{
                      width: canvasW,
                      height: canvasH,
                      backgroundColor: activeTheme.canvasBg,
                      transform: `scale(${effectiveScale})`,
                    }}
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.indexOf("application/x-powerbi-field") !== -1) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                      }
                    }}
                    onDrop={(e) => {
                      const raw = e.dataTransfer.getData("application/x-powerbi-field");
                      if (!raw || !activeTable) return;
                      e.preventDefault();
                      try {
                        const payload = JSON.parse(raw) as DraggedFieldPayload;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const dropX = Math.round((e.clientX - rect.left) / effectiveScale);
                        const dropY = Math.round((e.clientY - rect.top) / effectiveScale);
                        const tbl =
                          tables.find((t) => (t.id || t.name) === payload.tableId) || activeTable;
                        const colMeta = tbl.columns.find((c) => c.name === payload.columnName);
                        const isNum = Boolean(payload.isMeasure || colMeta?.isNumeric);
                        addVisual(isNum ? "clusteredColumn" : "table", { x: dropX, y: dropY }, {
                          tableId: tbl.id || tbl.name,
                          columnName: payload.columnName,
                          isNumeric: isNum,
                        });
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    {loadingMsg ? (
                      <LoadingState message={loadingMsg} />
                    ) : tables.length === 0 ? (
                      <EmptyState
                        onUploadFile={() => fileInputRef.current?.click()}
                        onLoadSocialSample={() =>
                          loadCsvIntoModel(
                            SOCIAL_KPI_POWERBI_CSV,
                            "social_kpi_powerbi",
                            "social_kpi_powerbi.csv",
                          )
                        }
                        onOpenEnterData={() => setEnterDataOpen(true)}
                        onLoadRelationalSample={loadRelationalSample}
                        onOpenGetDataModal={() => setGetDataOpen(true)}
                      />
                    ) : (
                      <>
                        {focusVisualId ? (
                          <div
                            className={styles.focusHeaderStrip}
                            style={{ position: "relative", zIndex: 15 }}
                          >
                            <button
                              type="button"
                              className={styles.ribbonSmBtn}
                              onClick={() => setFocusVisualId(null)}
                            >
                              <ArrowLeft size={13} />
                              <span>Back to report</span>
                            </button>
                            <span style={{ fontSize: 11.5, color: "#605e5c" }}>Focus mode</span>
                          </div>
                        ) : null}

                        {(focusVisualId
                          ? activePage.visuals.filter((v) => v.id === focusVisualId)
                          : activePage.visuals.filter(
                              (v) =>
                                !searchQuery.trim() ||
                                v.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                                v.xAxis?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                                v.yAxis.some((y) =>
                                  y.toLowerCase().includes(searchQuery.trim().toLowerCase()),
                                ),
                            )
                        ).map((visual, idx) => {
                          const effectiveVisual: PowerBiVisual = mobileLayoutPreview
                            ? {
                                ...visual,
                                layout: {
                                  x: 10,
                                  y: 10 + idx * 140,
                                  w: 370,
                                  h: 130,
                                },
                              }
                            : visual;
                          return (
                            <DashboardCard
                              key={visual.id}
                              visual={effectiveVisual}
                              selected={selectedVisualId === visual.id}
                              isFocusMode={focusVisualId === visual.id}
                              readingView={readingView}
                              formatPainterActive={formatPainterActive}
                              scale={effectiveScale}
                              snapToGrid={snapToGrid}
                              canvasWidth={canvasW}
                              canvasHeight={canvasH}
                              activeFilterCount={
                                activeFilterCount + Object.keys(visual.visualFilters).length
                              }
                              onSelect={() => setSelectedVisualId(visual.id)}
                              onApplyFormatPainter={() => {
                                if (copiedFormat) {
                                  updateVisual(visual.id, (v) => ({
                                    ...v,
                                    format: { ...copiedFormat },
                                  }));
                                  setFormatPainterActive(false);
                                  setCopiedFormat(null);
                                  setSelectedVisualId(visual.id);
                                }
                              }}
                              onToggleFocus={() =>
                                setFocusVisualId((cur) => (cur === visual.id ? null : visual.id))
                              }
                              onDelete={() => deleteVisual(visual.id)}
                              onMoveResize={(nextLayout, commitHistory) =>
                                updateVisual(
                                  visual.id,
                                  (v) => ({ ...v, layout: nextLayout }),
                                  commitHistory,
                                )
                              }
                              onDropField={(payload) =>
                                handleDropFieldPayload(payload, undefined, visual)
                              }
                            >
                              <ChartContainer
                                visual={effectiveVisual}
                                tables={tables}
                                measures={measures}
                                relationships={relationships}
                                reportFilters={reportFilters}
                                pageFilters={activePage.pageFilters}
                                numericFilters={numericFilters}
                                slicerFilters={slicerFilters}
                                dateRange={dateRange}
                                crossFilter={crossFilter}
                                themePalette={activeTheme.palette}
                                onCrossFilter={setCrossFilter}
                                onToggleSlicerValue={(col, val) => {
                                  setSlicerFilters((prev) => {
                                    const cur = prev[col] || [];
                                    const next =
                                      cur.indexOf(val) !== -1
                                        ? cur.filter((x) => x !== val)
                                        : [...cur, val];
                                    const out = { ...prev };
                                    if (next.length === 0) delete out[col];
                                    else out[col] = next;
                                    return out;
                                  });
                                }}
                                onSelectAllSlicerValues={(col, vals) =>
                                  setSlicerFilters((prev) => ({ ...prev, [col]: vals }))
                                }
                                onClearSlicerColumn={(col) =>
                                  setSlicerFilters((prev) => {
                                    const out = { ...prev };
                                    delete out[col];
                                    return out;
                                  })
                                }
                                onDateRangeChange={setDateRange}
                                onUpdateTextBox={(vId, textContent) =>
                                  updateVisual(
                                    vId,
                                    (v) => ({ ...v, textContent }),
                                    false,
                                  )
                                }
                              />
                            </DashboardCard>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {activeView === "table" ? (
              activeTable ? (
                <DataTable
                  columns={activeTable.columns}
                  rows={filteredRowsActiveTable}
                  searchable
                  pageSize={25}
                  tables={tables}
                  activeTableId={activeTableIdResolved}
                  onSelectTable={(id) => {
                    setActiveTableId(id);
                    const tbl = tables.find((t) => (t.id || t.name) === id);
                    if (tbl?.columns[0]) {
                      setSelectedColumn({ tableId: id, columnName: tbl.columns[0].name });
                    }
                  }}
                  selectedColName={
                    selectedColumn?.tableId === activeTableIdResolved
                      ? selectedColumn.columnName
                      : null
                  }
                  onSelectColumn={(colName) =>
                    setSelectedColumn({ tableId: activeTableIdResolved, columnName: colName })
                  }
                  onRenameColumn={(oldName, newName) =>
                    handleRenameColumnAcrossModel(activeTableIdResolved, oldName, newName)
                  }
                  onChangeColumnType={(colName, newType) =>
                    mutateTable(activeTableIdResolved, (t) =>
                      changeColumnType(t, colName, newType),
                    )
                  }
                  onDeleteColumn={(colName) =>
                    mutateTable(activeTableIdResolved, (t) =>
                      removeTableColumn(t, colName),
                    )
                  }
                  onUpdateCalculatedColumn={(colName, formula) =>
                    handleSaveCalculatedColumn(activeTableIdResolved, colName, formula)
                  }
                  onOpenNewColumn={() =>
                    setFormulaModal({
                      open: true,
                      mode: "column",
                      tableId: activeTableIdResolved,
                    })
                  }
                  onOpenNewMeasure={() =>
                    setFormulaModal({
                      open: true,
                      mode: "measure",
                      tableId: activeTableIdResolved,
                    })
                  }
                  onOpenTransformData={() => setTransformOpen(true)}
                />
              ) : (
                <div style={{ flex: 1, background: "#ffffff" }}>
                  <EmptyState
                    onUploadFile={() => fileInputRef.current?.click()}
                    onLoadSocialSample={() =>
                      loadCsvIntoModel(
                        SOCIAL_KPI_POWERBI_CSV,
                        "social_kpi_powerbi",
                        "social_kpi_powerbi.csv",
                      )
                    }
                    onOpenEnterData={() => setEnterDataOpen(true)}
                    onLoadRelationalSample={loadRelationalSample}
                    onOpenGetDataModal={() => setGetDataOpen(true)}
                  />
                </div>
              )
            ) : null}

            {activeView === "model" ? (
              tables.length > 0 ? (
                <ModelView
                  tables={tables}
                  measures={measures}
                  relationships={relationships}
                  onMoveTableCard={(tableId, pos) =>
                    setTables((prev) =>
                      prev.map((t) =>
                        (t.id || t.name) === tableId ? { ...t, modelPosition: pos } : t,
                      ),
                    )
                  }
                  onAutoDetectRelationships={() =>
                    setRelationships((prev) => autoDetectRelationships(tables, prev))
                  }
                  onOpenManageRelationships={() => setRelationshipsOpen(true)}
                />
              ) : (
                <div style={{ flex: 1, background: "#ffffff" }}>
                  <EmptyState
                    onUploadFile={() => fileInputRef.current?.click()}
                    onLoadSocialSample={() =>
                      loadCsvIntoModel(
                        SOCIAL_KPI_POWERBI_CSV,
                        "social_kpi_powerbi",
                        "social_kpi_powerbi.csv",
                      )
                    }
                    onOpenEnterData={() => setEnterDataOpen(true)}
                    onLoadRelationalSample={loadRelationalSample}
                    onOpenGetDataModal={() => setGetDataOpen(true)}
                  />
                </div>
              )
            ) : null}

            <Tabs
              pages={pages}
              activePageId={activePageId}
              onSelectPage={(id) => {
                setActivePageId(id);
                setFocusVisualId(null);
                const target = pages.find((p) => p.id === id);
                setSelectedVisualId(target?.visuals[0]?.id || null);
              }}
              onAddPage={handleAddPage}
              onDuplicatePage={handleDuplicatePage}
              onRenamePage={(id, name) => {
                pushHistory();
                setPages((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
              }}
              onDeletePage={(id) => {
                if (pages.length <= 1) return;
                pushHistory();
                setPages((prev) => {
                  const next = prev.filter((p) => p.id !== id);
                  if (activePageId === id && next[0]) setActivePageId(next[0].id);
                  return next;
                });
              }}
              zoomPct={displayedZoomPct}
              onZoomChange={(pct) => setManualZoomPct(pct)}
              onResetZoom={() => setManualZoomPct(null)}
              rowCount={activeTable?.rows.length || 0}
              filteredRowCount={filteredRowsActiveTable.length}
              mobileLayoutPreview={mobileLayoutPreview}
              onToggleMobileLayoutPreview={() => setMobileLayoutPreview((m) => !m)}
            />
          </main>

          {!readingView && (activeView === "report" || activeView === "model") ? (
            <div
              className={`${styles.rightDock} ${
                showFiltersPane || showVizPane || showDataPane ? styles.rightDockOverlay : ""
              }`}
            >
              <FilterPanel
                expanded={showFiltersPane}
                onToggleExpand={() => toggleRightPane("filters")}
                columns={visualTable?.columns || []}
                rows={visualTable?.rows || []}
                selectedVisual={selectedVisual}
                pageFilters={activePage?.pageFilters || {}}
                reportFilters={reportFilters}
                numericFilters={numericFilters}
                onToggleFilterValue={handleToggleFilterValue}
                onClearFilterField={handleClearFilterField}
                onUpdateNumericFilter={(col, bounds) =>
                  setNumericFilters((prev) => {
                    const out = { ...prev };
                    if (!bounds || (bounds.min === undefined && bounds.max === undefined)) {
                      delete out[col];
                    } else {
                      out[col] = bounds;
                    }
                    return out;
                  })
                }
              />

              <VisualizationsPane
                expanded={showVizPane}
                onToggleExpand={() => toggleRightPane("viz")}
                columns={visualTable?.columns || []}
                measures={measures}
                scopedRows={visualScopedRows}
                selectedVisual={selectedVisual}
                onSelectVisualType={(type) => {
                  if (tables.length === 0) return;
                  if (selectedVisual) {
                    updateVisual(selectedVisual.id, (v) => ({
                      ...v,
                      type,
                      title: getVisualDefaultTitle(type, v.xAxis, v.yAxis, v.aggregation),
                    }));
                  } else {
                    addVisual(type);
                  }
                }}
                onUpdateFields={(patch) => {
                  if (!selectedVisual) return;
                  updateVisual(selectedVisual.id, (v) => {
                    const nextX = "xAxis" in patch ? patch.xAxis : v.xAxis;
                    const nextY = patch.yAxis !== undefined ? patch.yAxis : v.yAxis;
                    const nextLegend = "legend" in patch ? patch.legend : v.legend;
                    const nextAgg = patch.aggregation || v.aggregation;
                    return {
                      ...v,
                      xAxis: nextX,
                      yAxis: nextY,
                      legend: nextLegend,
                      aggregation: nextAgg,
                      perFieldAggregations:
                        patch.perFieldAggregations !== undefined
                          ? patch.perFieldAggregations
                          : v.perFieldAggregations,
                      sortBy: patch.sortBy !== undefined ? patch.sortBy : v.sortBy,
                      sortDir: patch.sortDir !== undefined ? patch.sortDir : v.sortDir,
                      title: getVisualDefaultTitle(v.type, nextX, nextY, nextAgg),
                    };
                  });
                }}
                onUpdateFormat={(patch, nextTitle, extraPatch) => {
                  if (!selectedVisual) return;
                  updateVisual(selectedVisual.id, (v) => ({
                    ...v,
                    ...(extraPatch || {}),
                    title: nextTitle !== undefined ? nextTitle : v.title,
                    format: { ...v.format, ...patch },
                  }));
                }}
                onUpdateLayout={(nextLayout) => {
                  if (!selectedVisual) return;
                  updateVisual(selectedVisual.id, (v) => ({ ...v, layout: nextLayout }));
                }}
                onUpdateAnalytics={(nextAnalytics: VisualAnalytics) => {
                  if (!selectedVisual) return;
                  updateVisual(selectedVisual.id, (v) => ({ ...v, analytics: nextAnalytics }));
                }}
                onDropFieldToWell={(well, payload) => handleDropFieldPayload(payload, well)}
              />

              <DataPane
                expanded={showDataPane}
                onToggleExpand={() => toggleRightPane("data")}
                tables={tables}
                activeTableId={activeTableIdResolved}
                onSelectTable={(id) => setActiveTableId(id)}
                measures={measures}
                selectedVisual={selectedVisual}
                selectedColumn={selectedColumn}
                onSelectColumn={(tableId, colName) =>
                  setSelectedColumn({ tableId, columnName: colName })
                }
                onToggleFieldOnVisual={handleToggleFieldOnVisual}
                onOpenNewMeasure={(tableId) =>
                  setFormulaModal({ open: true, mode: "measure", tableId })
                }
                onOpenNewColumn={(tableId) =>
                  setFormulaModal({ open: true, mode: "column", tableId })
                }
                onDeleteMeasure={(measureId) => {
                  pushHistory();
                  setMeasures((prev) => prev.filter((m) => m.id !== measureId));
                }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* ---------- Functional Dialogs ---------- */}
      <Modal open={getDataOpen} title="Get Data" onClose={() => setGetDataOpen(false)} width={560}>
        <p style={{ marginTop: 0, fontSize: 12.5, color: "#605e5c" }}>
          Import your own CSV or Excel (.xlsx) workbook, or load a ready-made analytics dataset:
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              setGetDataOpen(false);
              fileInputRef.current?.click();
            }}
            className={styles.getDataOptionBtn}
          >
            <Upload size={18} color="#117865" />
            <div>
              <div style={{ fontWeight: 600 }}>Import Local CSV or Excel (.xlsx) Workbook</div>
              <div style={{ fontSize: 11, color: "#605e5c" }}>
                Supports comma/tab/semicolon CSV files and multi-sheet .xlsx workbooks
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setGetDataOpen(false);
              loadCsvIntoModel(
                SOCIAL_KPI_POWERBI_CSV,
                "social_kpi_powerbi",
                "social_kpi_powerbi.csv",
              );
            }}
            className={styles.getDataOptionBtn}
          >
            <Database size={18} color="#118DFF" />
            <div>
              <div style={{ fontWeight: 600 }}>Social Media KPI Dataset (360 rows)</div>
              <div style={{ fontSize: 11, color: "#605e5c" }}>
                date, platform, impressions, reach, likes, comments, shares, clicks, followers, engagement_rate
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setGetDataOpen(false);
              loadCsvIntoModel(RETAIL_SAMPLE_CSV, "retail_sales_sample", "retail_sales_sample.csv");
            }}
            className={styles.getDataOptionBtn}
          >
            <FileSpreadsheet size={18} color="#107c41" />
            <div>
              <div style={{ fontWeight: 600 }}>Retail Sales &amp; Margin Dataset (36 rows)</div>
              <div style={{ fontSize: 11, color: "#605e5c" }}>
                date, region, category, channel, product, revenue, cost, units_sold, profit, margin_rate
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setGetDataOpen(false);
              loadCsvIntoModel(
                STUDENT_PERFORMANCE_CSV,
                "student_performance",
                "student_performance.csv",
              );
            }}
            className={styles.getDataOptionBtn}
          >
            <GraduationCap size={18} color="#744EC2" />
            <div>
              <div style={{ fontWeight: 600 }}>Student Academic Performance (32 rows)</div>
              <div style={{ fontSize: 11, color: "#605e5c" }}>
                student_id, department, semester, subject, attendance_pct, internal_marks, exam_marks, total_score, grade
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setGetDataOpen(false);
              loadRelationalSample();
            }}
            className={styles.getDataOptionBtn}
          >
            <Link2 size={18} color="#E66C37" />
            <div>
              <div style={{ fontWeight: 600 }}>Relational Sales Model (Orders &amp; Products · 2 tables)</div>
              <div style={{ fontSize: 11, color: "#605e5c" }}>
                Auto-linked on product_id for Model View diagrams and cross-table filtering
              </div>
            </div>
          </button>

          {tables.length > 0 ? (
            <div style={{ paddingTop: 6, borderTop: "1px solid #e1dfdd", fontSize: 11.5, color: "#605e5c" }}>
              Append another table to your current model:{" "}
              <button
                type="button"
                onClick={() => {
                  setGetDataOpen(false);
                  loadCsvIntoModel(
                    RELATIONAL_PRODUCTS_CSV,
                    "Products",
                    "products.csv",
                    true,
                  );
                }}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "#117865",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                + Append Products lookup table
              </button>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={enterDataOpen}
        title="Create Table (Enter Data)"
        onClose={() => setEnterDataOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEnterDataOpen(false)}
              style={{
                height: 28,
                padding: "0 12px",
                border: "1px solid #c8c6c4",
                background: "#ffffff",
                borderRadius: 2,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            {tables.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setEnterDataOpen(false);
                  loadCsvIntoModel(pasteText, pasteName || "CustomTable", `${pasteName || "table"}.csv`, true);
                }}
                style={{
                  height: 28,
                  padding: "0 12px",
                  border: "1px solid #117865",
                  background: "#ffffff",
                  color: "#117865",
                  fontWeight: 600,
                  borderRadius: 2,
                  cursor: "pointer",
                }}
              >
                Add as Table
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setEnterDataOpen(false);
                loadCsvIntoModel(pasteText, pasteName || "CustomTable", `${pasteName || "table"}.csv`);
              }}
              style={{
                height: 28,
                padding: "0 14px",
                border: 0,
                background: "#117865",
                color: "#ffffff",
                fontWeight: 600,
                borderRadius: 2,
                cursor: "pointer",
              }}
            >
              Load
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
              Table Name
            </label>
            <input
              type="text"
              value={pasteName}
              onChange={(e) => setPasteName(e.target.value)}
              style={{
                width: "100%",
                height: 28,
                padding: "0 8px",
                border: "1px solid #c8c6c4",
                borderRadius: 2,
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
              Paste CSV or Tab-separated rows (header row required)
            </label>
            <textarea
              rows={7}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid #c8c6c4",
                borderRadius: 2,
                fontFamily: "Consolas, monospace",
                fontSize: 11.5,
              }}
            />
          </div>
        </div>
      </Modal>

      <TransformDataModal
        open={transformOpen}
        recordedSteps={captureFrame?.steps}
        tables={tables}
        activeTableId={activeTableIdResolved}
        onClose={() => setTransformOpen(false)}
        onRenameColumn={handleRenameColumnAcrossModel}
        onChangeColumnType={(tableId, colName, type) =>
          mutateTable(tableId, (t) => changeColumnType(t, colName, type))
        }
        onRemoveColumn={(tableId, colName) =>
          mutateTable(tableId, (t) => removeTableColumn(t, colName))
        }
        onCleanMissing={(tableId, colName, strat) =>
          mutateTable(tableId, (t) => handleMissingValues(t, colName, strat))
        }
      />

      <FormulaModal
        open={formulaModal.open}
        mode={formulaModal.mode}
        tables={tables}
        initialTableId={formulaModal.tableId || activeTableIdResolved}
        measures={measures}
        onClose={() => setFormulaModal((f) => ({ ...f, open: false }))}
        onSaveColumn={handleSaveCalculatedColumn}
        onSaveMeasure={handleSaveMeasure}
      />

      <ExcelNavigatorModal
        open={excelNav.open}
        fileName={excelNav.fileName}
        sheets={excelNav.sheets}
        onClose={() => setExcelNav({ open: false, fileName: "", sheets: [] })}
        onConfirmLoad={(selected) => {
          setExcelNav({ open: false, fileName: "", sheets: [] });
          applyLoadedTables(
            selected.map((s) => s.dataset),
            "replace",
          );
        }}
      />

      <RelationshipsModal
        open={relationshipsOpen}
        tables={tables}
        relationships={relationships}
        onClose={() => setRelationshipsOpen(false)}
        onAddRelationship={(rel) => {
          pushHistory();
          setRelationships((prev) => [
            ...prev,
            { ...rel, id: `rel-${Date.now().toString(36)}` },
          ]);
        }}
        onToggleActive={(id) => {
          pushHistory();
          setRelationships((prev) =>
            prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
          );
        }}
        onDeleteRelationship={(id) => {
          pushHistory();
          setRelationships((prev) => prev.filter((r) => r.id !== id));
        }}
        onAutoDetect={() => {
          pushHistory();
          setRelationships((prev) => autoDetectRelationships(tables, prev));
        }}
      />
    </>
  );
}
