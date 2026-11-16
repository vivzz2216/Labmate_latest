"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Database, FileSpreadsheet, Upload } from "lucide-react";
import {
  aggregateKpi,
  applyDatasetFilters,
  createDefaultReportPages,
  formatPowerBiNumber,
  getVisualDefaultTitle,
  parseCsvText,
} from "@/lib/powerbi/csvEngine";
import { POWERBI_SERIES_PALETTE } from "@/lib/powerbi/palette";
import { RETAIL_SAMPLE_CSV, SOCIAL_KPI_POWERBI_CSV } from "@/lib/powerbi/sampleCsv";
import type {
  AggregationFn,
  ColumnMeta,
  CrossFilterSelection,
  DatasetModel,
  DateRangeFilter,
  PowerBiVisual,
  PowerBiVisualType,
  ReportPage,
  RibbonTab,
  ViewMode,
} from "@/lib/powerbi/types";
import { ApplicationHeader } from "./ApplicationHeader";
import { ChartContainer } from "./ChartContainer";
import { DashboardCard } from "./DashboardCard";
import { DataPane } from "./DataPane";
import { DataTable } from "./DataTable";
import { DaxTmdlView } from "./DaxTmdlView";
import { EmptyState } from "./EmptyState";
import { FilterPanel } from "./FilterPanel";
import { LoadingState } from "./LoadingState";
import { Modal } from "./Modal";
import { ModelView } from "./ModelView";
import { PowerBiServiceView } from "./PowerBiServiceView";
import { Sidebar } from "./Sidebar";
import { Tabs } from "./Tabs";
import { VisualizationsPane } from "./VisualizationsPane";
import styles from "./powerbi.module.css";

/** Full interactive Microsoft Power BI Desktop & Service replica tailored for manual CSV datasets. */
export function PowerBiWorkspace() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [surfaceMode, setSurfaceMode] = useState<"desktop" | "service-home" | "service-create">("desktop");
  const [dataset, setDataset] = useState<DatasetModel | null>(null);
  const [pages, setPages] = useState<ReportPage[]>([
    { id: "page-1", name: "Page 1", visuals: [], pageFilters: {} },
  ]);
  const [activePageId, setActivePageId] = useState("page-1");
  const [activeView, setActiveView] = useState<ViewMode>("report");
  const [activeTab, setActiveTab] = useState<RibbonTab>("Home");
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false);
  const [readingView, setReadingView] = useState(false);
  const [mobileLayoutPreview, setMobileLayoutPreview] = useState(false);

  const [selectedVisualId, setSelectedVisualId] = useState<string | null>(null);
  const [focusVisualId, setFocusVisualId] = useState<string | null>(null);

  const [showFiltersPane, setShowFiltersPane] = useState(false);
  const [showVizPane, setShowVizPane] = useState(true);
  const [showDataPane, setShowDataPane] = useState(false);
  const [showGridlines, setShowGridlines] = useState(false);

  const [reportFilters, setReportFilters] = useState<Record<string, string[]>>({});
  const [slicerFilters, setSlicerFilters] = useState<Record<string, string[]>>({});
  const [dateRange, setDateRange] = useState<DateRangeFilter | null>(null);
  const [crossFilter, setCrossFilter] = useState<CrossFilterSelection | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Fit-to-page scale computed from viewport size vs 1280x720 page
  const [fitScale, setFitScale] = useState(0.76);
  const [manualZoomPct, setManualZoomPct] = useState<number | null>(null);

  // Dialog states
  const [getDataOpen, setGetDataOpen] = useState(false);
  const [enterDataOpen, setEnterDataOpen] = useState(false);
  const [transformOpen, setTransformOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [pasteName, setPasteName] = useState("CustomTable");
  const [pasteText, setPasteText] = useState(
    "category,region,sales,units\nElectronics,North,42000,120\nSoftware,West,68500,95\nServices,East,31200,80",
  );

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
      const next = Math.min(availW / 1280, availH / 720, 1);
      setFitScale(Number(Math.max(0.18, next).toFixed(3)));
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showFiltersPane, showVizPane, showDataPane, ribbonCollapsed, readingView, activeView, surfaceMode]);

  const effectiveScale = manualZoomPct !== null ? manualZoomPct / 100 : fitScale;
  const displayedZoomPct = Math.round(effectiveScale * 100);

  const activePage = useMemo(
    () => pages.find((p) => p.id === activePageId) || pages[0],
    [pages, activePageId],
  );

  const selectedVisual = useMemo(
    () => activePage?.visuals.find((v) => v.id === selectedVisualId) || null,
    [activePage, selectedVisualId],
  );

  const loadCsvIntoModel = useCallback((csvText: string, tableName: string, fileName: string) => {
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
        const generated = createDefaultReportPages(parsed);
        setDataset(parsed);
        setPages(generated);
        setActivePageId(generated[0].id);
        setSelectedVisualId(generated[0].visuals[0]?.id || null);
        setFocusVisualId(null);
        setReportFilters({});
        setSlicerFilters({});
        setDateRange(null);
        setCrossFilter(null);
        const isWide = typeof window === "undefined" || window.innerWidth > 900;
        setShowFiltersPane(isWide);
        setShowDataPane(isWide);
        setShowVizPane(isWide);
        setSurfaceMode("desktop");
        setActiveView("report");
      } catch {
        setUploadError("Could not parse CSV. Ensure comma-separated rows with a header line.");
      } finally {
        setLoadingMsg(null);
      }
    }, 120);
  }, []);

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      loadCsvIntoModel(content, file.name.replace(/\.[^.]+$/, ""), file.name);
    };
    reader.readAsText(file);
  };

  const updateVisual = useCallback(
    (visualId: string, updater: (v: PowerBiVisual) => PowerBiVisual) => {
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
    [activePageId],
  );

  const addVisual = useCallback(
    (type: PowerBiVisualType) => {
      if (!dataset) return;
      const textCol = dataset.columns.find((c) => c.type !== "number")?.name || dataset.columns[0]?.name;
      const numCol = dataset.columns.find((c) => c.isNumeric)?.name;
      const idx = activePage.visuals.length;
      const offset = (idx % 5) * 26;
      const isCard = type === "card";
      const isSlicer = type === "slicer";

      const newVisual: PowerBiVisual = {
        id: `v-${Date.now().toString(36)}-${idx}`,
        type,
        title: getVisualDefaultTitle(type, textCol, isSlicer || !numCol ? [] : [numCol], "sum"),
        xAxis: isCard ? undefined : textCol,
        yAxis: isSlicer || !numCol ? [] : [numCol],
        aggregation: "sum",
        layout: {
          x: Math.min(800, 48 + offset),
          y: Math.min(440, 48 + offset),
          w: isCard ? 236 : isSlicer ? 268 : 460,
          h: isCard ? 110 : isSlicer ? 240 : 272,
        },
        format: {
          showTitle: !isCard,
          showDataLabels: true,
          showLegend: true,
          accentColor: POWERBI_SERIES_PALETTE[idx % POWERBI_SERIES_PALETTE.length],
          backgroundColor: "#ffffff",
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
    [dataset, activePage, activePageId],
  );

  const deleteVisual = useCallback(
    (visualId: string) => {
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
    [activePageId, selectedVisualId, focusVisualId],
  );

  const duplicateSelected = () => {
    if (!selectedVisual) return;
    const copy: PowerBiVisual = {
      ...selectedVisual,
      id: `v-copy-${Date.now().toString(36)}`,
      title: `${selectedVisual.title} (Copy)`,
      layout: {
        ...selectedVisual.layout,
        x: Math.min(1280 - selectedVisual.layout.w, selectedVisual.layout.x + 24),
        y: Math.min(720 - selectedVisual.layout.h, selectedVisual.layout.y + 24),
      },
    };
    setPages((prev) =>
      prev.map((p) =>
        p.id !== activePageId ? p : { ...p, visuals: [...p.visuals, copy] },
      ),
    );
    setSelectedVisualId(copy.id);
  };

  const handleToggleFilterValue = (
    scope: "visual" | "page" | "report",
    column: string,
    value: string,
  ) => {
    const toggleList = (map: Record<string, string[]>) => {
      const cur = map[column] || [];
      const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
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

  const handleToggleFieldOnVisual = (col: ColumnMeta) => {
    if (!selectedVisual) {
      addVisual(col.isNumeric ? "clusteredColumn" : "table");
      return;
    }

    updateVisual(selectedVisual.id, (v) => {
      if (col.isNumeric) {
        const exists = v.yAxis.includes(col.name);
        const nextY = exists
          ? v.yAxis.filter((y) => y !== col.name)
          : v.type === "card"
            ? [col.name]
            : [...v.yAxis, col.name];
        return {
          ...v,
          yAxis: nextY,
          title: getVisualDefaultTitle(v.type, v.xAxis, nextY, v.aggregation),
        };
      }
      const nextX = v.xAxis === col.name ? undefined : col.name;
      return {
        ...v,
        xAxis: nextX,
        title: getVisualDefaultTitle(v.type, nextX, v.yAxis, v.aggregation),
      };
    });
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

  const filteredRowCount = useMemo(() => {
    if (!dataset) return 0;
    return applyDatasetFilters(dataset.rows, {
      reportFilters,
      pageFilters: activePage?.pageFilters,
      slicerFilters,
      dateRange,
      crossFilter,
    }).length;
  }, [dataset, reportFilters, activePage, slicerFilters, dateRange, crossFilter]);

  const activeFilterCount =
    Object.keys(reportFilters).length +
    Object.keys(activePage?.pageFilters || {}).length +
    Object.keys(slicerFilters).length +
    (dateRange ? 1 : 0) +
    (crossFilter ? 1 : 0);

  return (
    <>
      {/* Hidden native CSV file picker shared by Desktop & Service screens */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt,text/csv"
        onChange={handleFilePicked}
        style={{ display: "none" }}
      />

      {surfaceMode !== "desktop" ? (
        <PowerBiServiceView
          mode={surfaceMode === "service-home" ? "home" : "create"}
          onChangeMode={(m) => setSurfaceMode(m === "home" ? "service-home" : "service-create")}
          onSwitchToDesktop={() => setSurfaceMode("desktop")}
          onUploadCsv={() => fileInputRef.current?.click()}
          onLoadSocialSample={() =>
            loadCsvIntoModel(SOCIAL_KPI_POWERBI_CSV, "social_kpi_powerbi", "social_kpi_powerbi.csv")
          }
          onLoadRetailSample={() =>
            loadCsvIntoModel(RETAIL_SAMPLE_CSV, "retail_sales_sample", "retail_sales_sample.csv")
          }
          onOpenEnterData={() => setEnterDataOpen(true)}
          onOpenGetDataModal={() => setGetDataOpen(true)}
          currentDataset={dataset}
        />
      ) : (
        <div className={styles.workspaceRoot}>
          <ApplicationHeader
            documentName={dataset?.name || ""}
            activeTab={activeTab}
            onSelectTab={(tab) => {
              setActiveTab(tab);
              if (ribbonCollapsed) setRibbonCollapsed(false);
            }}
            ribbonCollapsed={ribbonCollapsed}
            onToggleRibbon={() => setRibbonCollapsed((c) => !c)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            hasDataset={Boolean(dataset)}
            selectedVisual={selectedVisual}
            readingView={readingView}
            onToggleReadingView={() => setReadingView((r) => !r)}
            onUploadCsvClick={() => fileInputRef.current?.click()}
            onLoadSocialSample={() =>
              loadCsvIntoModel(SOCIAL_KPI_POWERBI_CSV, "social_kpi_powerbi", "social_kpi_powerbi.csv")
            }
            onLoadRetailSample={() =>
              loadCsvIntoModel(RETAIL_SAMPLE_CSV, "retail_sales_sample", "retail_sales_sample.csv")
            }
            onOpenGetDataModal={() => setGetDataOpen(true)}
            onOpenEnterData={() => setEnterDataOpen(true)}
            onOpenTransformModal={() => setTransformOpen(true)}
            onAddVisual={addVisual}
            onDuplicateSelected={duplicateSelected}
            onDeleteSelected={() => selectedVisualId && deleteVisual(selectedVisualId)}
            onResetReport={() => {
              if (!dataset) return;
              const resetPages = createDefaultReportPages(dataset);
              setPages(resetPages);
              setActivePageId(resetPages[0].id);
              setSelectedVisualId(resetPages[0].visuals[0]?.id || null);
              handleClearAllFilters();
            }}
            onClearAllFilters={handleClearAllFilters}
            showFiltersPane={showFiltersPane}
            showVizPane={showVizPane}
            showDataPane={showDataPane}
            showGridlines={showGridlines}
            onTogglePane={toggleRightPane}
            onToggleGridlines={() => setShowGridlines((g) => !g)}
            onChangeAggregation={(agg) => {
              if (!selectedVisual) return;
              updateVisual(selectedVisual.id, (v) => ({
                ...v,
                aggregation: agg,
                title: getVisualDefaultTitle(v.type, v.xAxis, v.yAxis, agg),
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
            onOpenExportHelp={() => setShareOpen(true)}
            onOpenDaxView={() => setActiveView("dax")}
            onOpenModelView={() => setActiveView("model")}
            onOpenCopilotModal={() => setCopilotOpen(true)}
            onSwitchToService={(m) =>
              setSurfaceMode(m === "home" ? "service-home" : "service-create")
            }
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
              onClick={() => setSelectedVisualId(null)}
            >
              <div
                className={styles.canvasScaleFrame}
                style={{
                  width: Math.round(1280 * effectiveScale),
                  height: Math.round(720 * effectiveScale),
                }}
              >
                <div
                  className={`${styles.canvasSheet} ${showGridlines ? styles.canvasGridOverlay : ""}`}
                  style={{ transform: `scale(${effectiveScale})` }}
                >
                  {loadingMsg ? (
                    <LoadingState message={loadingMsg} />
                  ) : !dataset ? (
                    <EmptyState
                      onUploadCsv={() => fileInputRef.current?.click()}
                      onLoadSocialSample={() =>
                        loadCsvIntoModel(
                          SOCIAL_KPI_POWERBI_CSV,
                          "social_kpi_powerbi",
                          "social_kpi_powerbi.csv",
                        )
                      }
                      onOpenEnterData={() => setEnterDataOpen(true)}
                      onLoadRetailSample={() =>
                        loadCsvIntoModel(
                          RETAIL_SAMPLE_CSV,
                          "retail_sales_sample",
                          "retail_sales_sample.csv",
                        )
                      }
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
                      ).map((visual) => (
                        <DashboardCard
                          key={visual.id}
                          visual={visual}
                          selected={selectedVisualId === visual.id}
                          isFocusMode={focusVisualId === visual.id}
                          activeFilterCount={
                            activeFilterCount + Object.keys(visual.visualFilters).length
                          }
                          onSelect={() => setSelectedVisualId(visual.id)}
                          onToggleFocus={() =>
                            setFocusVisualId((cur) => (cur === visual.id ? null : visual.id))
                          }
                          onDelete={() => deleteVisual(visual.id)}
                        >
                          <ChartContainer
                            visual={visual}
                            columns={dataset.columns}
                            allRows={dataset.rows}
                            reportFilters={reportFilters}
                            pageFilters={activePage.pageFilters}
                            slicerFilters={slicerFilters}
                            dateRange={dateRange}
                            crossFilter={crossFilter}
                            onCrossFilter={setCrossFilter}
                            onToggleSlicerValue={(col, val) => {
                              setSlicerFilters((prev) => {
                                const cur = prev[col] || [];
                                const next = cur.includes(val)
                                  ? cur.filter((x) => x !== val)
                                  : [...cur, val];
                                const out = { ...prev };
                                if (next.length === 0) delete out[col];
                                else out[col] = next;
                                return out;
                              });
                            }}
                            onClearSlicerColumn={(col) =>
                              setSlicerFilters((prev) => {
                                const out = { ...prev };
                                delete out[col];
                                return out;
                              })
                            }
                            onDateRangeChange={setDateRange}
                          />
                        </DashboardCard>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeView === "table" ? (
            dataset ? (
              <DataTable
                columns={dataset.columns}
                rows={applyDatasetFilters(dataset.rows, {
                  reportFilters,
                  pageFilters: activePage?.pageFilters,
                  slicerFilters,
                  dateRange,
                  crossFilter,
                })}
                searchable
                pageSize={25}
              />
            ) : (
              <div style={{ flex: 1, background: "#ffffff" }}>
                <EmptyState
                  onUploadCsv={() => fileInputRef.current?.click()}
                  onLoadSocialSample={() =>
                    loadCsvIntoModel(
                      SOCIAL_KPI_POWERBI_CSV,
                      "social_kpi_powerbi",
                      "social_kpi_powerbi.csv",
                    )
                  }
                  onOpenEnterData={() => setEnterDataOpen(true)}
                  onLoadRetailSample={() =>
                    loadCsvIntoModel(
                      RETAIL_SAMPLE_CSV,
                      "retail_sales_sample",
                      "retail_sales_sample.csv",
                    )
                  }
                  onOpenGetDataModal={() => setGetDataOpen(true)}
                />
              </div>
            )
          ) : null}

          {activeView === "model" ? (
            dataset ? (
              <ModelView dataset={dataset} />
            ) : (
              <div style={{ flex: 1, background: "#ffffff" }}>
                <EmptyState
                  onUploadCsv={() => fileInputRef.current?.click()}
                  onLoadSocialSample={() =>
                    loadCsvIntoModel(
                      SOCIAL_KPI_POWERBI_CSV,
                      "social_kpi_powerbi",
                      "social_kpi_powerbi.csv",
                    )
                  }
                  onOpenEnterData={() => setEnterDataOpen(true)}
                  onLoadRetailSample={() =>
                    loadCsvIntoModel(
                      RETAIL_SAMPLE_CSV,
                      "retail_sales_sample",
                      "retail_sales_sample.csv",
                    )
                  }
                  onOpenGetDataModal={() => setGetDataOpen(true)}
                />
              </div>
            )
          ) : null}

          {activeView === "dax" || activeView === "tmdl" ? (
            dataset ? (
              <DaxTmdlView mode={activeView} dataset={dataset} />
            ) : (
              <div style={{ flex: 1, background: "#ffffff" }}>
                <EmptyState
                  onUploadCsv={() => fileInputRef.current?.click()}
                  onLoadSocialSample={() =>
                    loadCsvIntoModel(
                      SOCIAL_KPI_POWERBI_CSV,
                      "social_kpi_powerbi",
                      "social_kpi_powerbi.csv",
                    )
                  }
                  onOpenEnterData={() => setEnterDataOpen(true)}
                  onLoadRetailSample={() =>
                    loadCsvIntoModel(
                      RETAIL_SAMPLE_CSV,
                      "retail_sales_sample",
                      "retail_sales_sample.csv",
                    )
                  }
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
            onAddPage={() => {
              const id = `page-${Date.now().toString(36)}`;
              const num = pages.length + 1;
              setPages((prev) => [
                ...prev,
                { id, name: `Page ${num}`, visuals: [], pageFilters: {} },
              ]);
              setActivePageId(id);
              setSelectedVisualId(null);
              setFocusVisualId(null);
              setActiveView("report");
            }}
            onRenamePage={(id, name) =>
              setPages((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
            }
            onDeletePage={(id) => {
              setPages((prev) => {
                const next = prev.filter((p) => p.id !== id);
                if (activePageId === id && next[0]) setActivePageId(next[0].id);
                return next;
              });
            }}
            zoomPct={displayedZoomPct}
            onZoomChange={(pct) => setManualZoomPct(pct)}
            onResetZoom={() => setManualZoomPct(null)}
            rowCount={dataset?.rows.length || 0}
            filteredRowCount={filteredRowCount}
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
              columns={dataset?.columns || []}
              rows={dataset?.rows || []}
              selectedVisual={selectedVisual}
              pageFilters={activePage?.pageFilters || {}}
              reportFilters={reportFilters}
              onToggleFilterValue={handleToggleFilterValue}
              onClearFilterField={handleClearFilterField}
            />

            <VisualizationsPane
              expanded={showVizPane}
              onToggleExpand={() => toggleRightPane("viz")}
              columns={dataset?.columns || []}
              selectedVisual={selectedVisual}
              onSelectVisualType={(type) => {
                if (!dataset) return;
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
                  const nextAgg = patch.aggregation || v.aggregation;
                  return {
                    ...v,
                    xAxis: nextX,
                    yAxis: nextY,
                    aggregation: nextAgg,
                    title: getVisualDefaultTitle(v.type, nextX, nextY, nextAgg),
                  };
                });
              }}
              onUpdateFormat={(patch, nextTitle) => {
                if (!selectedVisual) return;
                updateVisual(selectedVisual.id, (v) => ({
                  ...v,
                  title: nextTitle !== undefined ? nextTitle : v.title,
                  format: { ...v.format, ...patch },
                }));
              }}
            />

            <DataPane
              expanded={showDataPane}
              onToggleExpand={() => toggleRightPane("data")}
              tableName={dataset?.name || "Tables"}
              columns={dataset?.columns || []}
              selectedVisual={selectedVisual}
              onToggleFieldOnVisual={handleToggleFieldOnVisual}
            />
          </div>
        ) : null}
      </div>
        </div>
      )}

      {/* ---------- Shared Modals (available from Desktop & Service screens) ---------- */}
      <Modal
        open={getDataOpen}
        title="Get Data"
        onClose={() => setGetDataOpen(false)}
      >
        <p style={{ marginTop: 0, fontSize: 12.5, color: "#605e5c" }}>
          Choose a dataset source to populate the Power BI Data pane and build your manual report.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              setGetDataOpen(false);
              fileInputRef.current?.click();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              border: "1px solid #e1dfdd",
              borderRadius: 3,
              background: "#faf9f8",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <Upload size={18} color="#117865" />
            <div>
              <div style={{ fontWeight: 600 }}>Text/CSV File Upload</div>
              <div style={{ fontSize: 11, color: "#605e5c" }}>
                Import any local .csv file (e.g. social_kpi_powerbi.csv from your lab manual)
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
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              border: "1px solid #e1dfdd",
              borderRadius: 3,
              background: "#faf9f8",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <Database size={18} color="#118DFF" />
            <div>
              <div style={{ fontWeight: 600 }}>Social Media KPI Dataset (Built-in SMA Lab 7)</div>
              <div style={{ fontSize: 11, color: "#605e5c" }}>
                360 rows · date, platform, impressions, reach, likes, comments, shares, clicks, followers, engagement_rate
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setGetDataOpen(false);
              loadCsvIntoModel(RETAIL_SAMPLE_CSV, "retail_sales_sample", "retail_sales_sample.csv");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              border: "1px solid #e1dfdd",
              borderRadius: 3,
              background: "#faf9f8",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <FileSpreadsheet size={18} color="#107c41" />
            <div>
              <div style={{ fontWeight: 600 }}>Retail Sales Sample</div>
              <div style={{ fontSize: 11, color: "#605e5c" }}>
                12 regional transactions with revenue, units_sold, profit, and margin_rate
              </div>
            </div>
          </button>
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
              Paste CSV rows (header row required)
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

      <Modal
        open={transformOpen}
        title={`Power Query Schema Preview — ${dataset?.name || "Dataset"}`}
        onClose={() => setTransformOpen(false)}
        width={680}
      >
        {dataset ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 12, color: "#605e5c" }}>
              Loaded <strong>{dataset.rows.length}</strong> rows across{" "}
              <strong>{dataset.columns.length}</strong> columns from <code>{dataset.fileName}</code>.
            </div>
            <DataTable columns={dataset.columns} rows={dataset.rows.slice(0, 12)} compact pageSize={12} />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={shareOpen}
        title="Manual Screenshot & Export Options"
        onClose={() => setShareOpen(false)}
      >
        <div style={{ display: "grid", gap: 10, fontSize: 12.5, lineHeight: 1.5 }}>
          <p style={{ margin: 0, color: "#605e5c" }}>
            To capture crisp dashboard figures for your lab manual:
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#252423" }}>
            <li>Keep the full desktop view for a Power BI workspace screenshot showing Ribbon, Panes &amp; Canvas.</li>
            <li>Or toggle <strong>Screenshot / Clean view</strong> below to hide the ribbon and side panes, leaving only the white 16:9 report sheet.</li>
          </ul>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => {
                setReadingView((r) => !r);
                setShareOpen(false);
              }}
              style={{
                height: 30,
                padding: "0 14px",
                border: 0,
                borderRadius: 3,
                background: "#117865",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {readingView ? "Restore Authoring Workspace" : "Switch to Clean Screenshot View"}
            </button>
            <a
              href="/samples/social_kpi_powerbi.csv"
              download="social_kpi_powerbi.csv"
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 30,
                padding: "0 12px",
                border: "1px solid #c8c6c4",
                borderRadius: 3,
                color: "#252423",
                textDecoration: "none",
              }}
            >
              Download social_kpi_powerbi.csv
            </a>
          </div>
        </div>
      </Modal>

      <Modal
        open={copilotOpen}
        title="Copilot — Report Summary"
        onClose={() => setCopilotOpen(false)}
      >
        {dataset ? (
          <div style={{ display: "grid", gap: 8, fontSize: 12.5, lineHeight: 1.55 }}>
            <div>
              <strong>Dataset:</strong> <code>{dataset.fileName}</code> ({dataset.rows.length.toLocaleString()} rows,{" "}
              {dataset.columns.length} columns)
            </div>
            <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
              {dataset.columns
                .filter((c) => c.isNumeric)
                .slice(0, 4)
                .map((c) => (
                  <div
                    key={c.name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      background: "#faf9f8",
                      border: "1px solid #e1dfdd",
                      borderRadius: 3,
                    }}
                  >
                    <span>Total {c.label}</span>
                    <strong>{formatPowerBiNumber(aggregateKpi(dataset.rows, c.name, "sum"), c.name)}</strong>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: "#605e5c" }}>
            Load a CSV dataset or click <strong>Use sample data</strong> to generate metric summaries.
          </p>
        )}
      </Modal>
    </>
  );
}
