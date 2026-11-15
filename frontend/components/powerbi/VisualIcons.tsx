"use client";

import React from "react";
import type { PowerBiVisualType } from "@/lib/powerbi/types";

export interface DesktopVizTileItem {
  id: string;
  label: string;
  targetType: PowerBiVisualType;
  isPrimaryForType?: boolean;
}

/**
 * Full 6-column Power BI Desktop Visualizations pane gallery (matches Microsoft Power BI Desktop).
 * Interactive core types map directly onto our live SVG charts; specialized visuals cleanly map or trigger helpers.
 */
export const DESKTOP_VIZ_GRID_TILES: ReadonlyArray<DesktopVizTileItem> = [
  // Row 1
  { id: "stackedBar", label: "Stacked bar chart", targetType: "stackedBar", isPrimaryForType: true },
  { id: "stackedColumn", label: "Stacked column chart", targetType: "stackedColumn", isPrimaryForType: true },
  { id: "clusteredBar", label: "Clustered bar chart", targetType: "clusteredBar", isPrimaryForType: true },
  { id: "clusteredColumn", label: "Clustered column chart", targetType: "clusteredColumn", isPrimaryForType: true },
  { id: "100StackedBar", label: "100% Stacked bar chart", targetType: "stackedBar" },
  { id: "100StackedColumn", label: "100% Stacked column chart", targetType: "stackedColumn" },
  // Row 2
  { id: "line", label: "Line chart", targetType: "line", isPrimaryForType: true },
  { id: "area", label: "Area chart", targetType: "area", isPrimaryForType: true },
  { id: "stackedArea", label: "Stacked area chart", targetType: "area" },
  { id: "lineStackedCol", label: "Line and stacked column chart", targetType: "clusteredColumn" },
  { id: "lineClusteredCol", label: "Line and clustered column chart", targetType: "clusteredColumn" },
  { id: "ribbon", label: "Ribbon chart", targetType: "area" },
  // Row 3
  { id: "waterfall", label: "Waterfall chart", targetType: "clusteredColumn" },
  { id: "funnel", label: "Funnel", targetType: "funnel", isPrimaryForType: true },
  { id: "scatter", label: "Scatter chart", targetType: "scatter", isPrimaryForType: true },
  { id: "pie", label: "Pie chart", targetType: "pie", isPrimaryForType: true },
  { id: "donut", label: "Donut chart", targetType: "donut", isPrimaryForType: true },
  { id: "treemap", label: "Treemap", targetType: "treemap", isPrimaryForType: true },
  // Row 4
  { id: "map", label: "Map", targetType: "scatter" },
  { id: "filledMap", label: "Filled map", targetType: "treemap" },
  { id: "azureMap", label: "Azure Map", targetType: "scatter" },
  { id: "shapeMap", label: "ArcGIS Maps for Power BI", targetType: "scatter" },
  { id: "funnelMap", label: "Shape map", targetType: "funnel" },
  { id: "gauge", label: "Gauge", targetType: "gauge", isPrimaryForType: true },
  // Row 5
  { id: "card", label: "Card", targetType: "card", isPrimaryForType: true },
  { id: "multiRowCard", label: "Multi-row card", targetType: "card" },
  { id: "kpi", label: "KPI", targetType: "card" },
  { id: "slicer", label: "Slicer", targetType: "slicer", isPrimaryForType: true },
  { id: "table", label: "Table", targetType: "table", isPrimaryForType: true },
  { id: "matrix", label: "Matrix", targetType: "matrix", isPrimaryForType: true },
  // Row 6
  { id: "rVisual", label: "R script visual", targetType: "scatter" },
  { id: "pyVisual", label: "Python visual", targetType: "line" },
  { id: "keyInfluencers", label: "Key influencers", targetType: "clusteredBar" },
  { id: "decompTree", label: "Decomposition tree", targetType: "treemap" },
  { id: "qaVisual", label: "Q&A", targetType: "card" },
  { id: "smartNarrative", label: "Smart narrative", targetType: "card" },
  // Row 7
  { id: "metrics", label: "Metrics", targetType: "card" },
  { id: "paginatedReport", label: "Paginated report", targetType: "table" },
  { id: "slicerNew", label: "Slicer (new)", targetType: "slicer" },
  { id: "cardNew", label: "Card (new)", targetType: "card" },
  { id: "textSlicer", label: "Text slicer", targetType: "slicer" },
  { id: "listSlicer", label: "List slicer", targetType: "slicer" },
  // Row 8
  { id: "powerApps", label: "Power Apps for Power BI", targetType: "table" },
  { id: "powerAutomate", label: "Power Automate for Power BI", targetType: "funnel" },
];

/** Authentic miniature Power BI Visualizations pane SVG icons matching Desktop 6-column gallery. */
export function DesktopVizTileGlyph({ tileId }: { tileId: string }) {
  const b = "#3b7ec2";
  const bLight = "#73b2eb";
  const g = "#797775";
  const d = "#323130";
  const t = "#117865";
  const a = "#ca6b14";

  switch (tileId) {
    case "stackedBar":
    case "100StackedBar":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <path d="M2 2v16h18" fill="none" stroke={d} strokeWidth="1.4" />
          <rect x="3" y="4" width={tileId === "100StackedBar" ? 8 : 6} height="4" fill={b} />
          <rect x={tileId === "100StackedBar" ? 11 : 9} y="4" width={tileId === "100StackedBar" ? 7 : 5} height="4" fill={tileId === "100StackedBar" ? bLight : g} />
          <rect x="3" y="10.5" width="9" height="4" fill={b} />
          <rect x="12" y="10.5" width={tileId === "100StackedBar" ? 6 : 5} height="4" fill={tileId === "100StackedBar" ? bLight : g} />
        </svg>
      );
    case "stackedColumn":
    case "100StackedColumn":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <path d="M2 2v16h18" fill="none" stroke={d} strokeWidth="1.4" />
          <rect x="5" y="9" width="4" height="8" fill={b} />
          <rect x="5" y={tileId === "100StackedColumn" ? 3 : 5} width="4" height={tileId === "100StackedColumn" ? 6 : 4} fill={tileId === "100StackedColumn" ? bLight : g} />
          <rect x="12" y="11" width="4" height="6" fill={b} />
          <rect x="12" y="3" width="4" height="8" fill={tileId === "100StackedColumn" ? bLight : g} />
        </svg>
      );
    case "clusteredBar":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <path d="M2 2v16h18" fill="none" stroke={d} strokeWidth="1.4" />
          <rect x="3" y="3" width="13" height="3.2" fill={b} />
          <rect x="3" y="6.8" width="8" height="3.2" fill={g} />
          <rect x="3" y="12" width="11" height="3.2" fill={g} />
        </svg>
      );
    case "clusteredColumn":
    case "waterfall":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <path d="M2 2v16h18" fill="none" stroke={d} strokeWidth="1.4" />
          <rect x="4" y={tileId === "waterfall" ? 9 : 4} width="3.5" height={tileId === "waterfall" ? 8 : 13} fill={b} />
          <rect x="8.5" y={tileId === "waterfall" ? 5 : 9} width="3.5" height={tileId === "waterfall" ? 4.5 : 8} fill={tileId === "waterfall" ? t : g} />
          <rect x="13" y="6" width="3.5" height={tileId === "waterfall" ? 5 : 11} fill={b} />
          <rect x="17" y="11" width="2.8" height="6" fill={g} />
        </svg>
      );
    case "line":
    case "lineStackedCol":
    case "lineClusteredCol":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <path d="M2 2v16h18" fill="none" stroke={d} strokeWidth="1.4" />
          {tileId !== "line" ? (
            <>
              <rect x="4.5" y="11" width="3" height="6" fill={bLight} />
              <rect x="9.5" y="9" width="3" height="8" fill={g} opacity="0.6" />
              <rect x="14.5" y="10" width="3" height="7" fill={bLight} />
            </>
          ) : (
            <polyline points="3,10 9,13 14,6 19,9" fill="none" stroke={d} strokeWidth="1.2" />
          )}
          <polyline points="3,13 8,7 13,10 19,4" fill="none" stroke={b} strokeWidth="1.7" />
        </svg>
      );
    case "area":
    case "stackedArea":
    case "ribbon":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <path d="M2 2v16h18" fill="none" stroke={d} strokeWidth="1.4" />
          <polygon points="3,17 3,11 9,6 15,10 19,5 19,17" fill={b} fillOpacity="0.45" />
          {tileId !== "area" ? (
            <polygon points="3,17 3,13 9,10 15,13 19,9 19,17" fill={t} fillOpacity="0.4" />
          ) : null}
          <polyline points="3,11 9,6 15,10 19,5" fill="none" stroke={b} strokeWidth="1.5" />
        </svg>
      );
    case "funnel":
    case "funnelMap":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <rect x="3" y="3" width="16" height="3.5" fill={b} />
          <rect x="5" y="8" width="12" height="3.5" fill={b} opacity="0.8" />
          <rect x="7.5" y="13" width="7" height="3.5" fill={g} />
        </svg>
      );
    case "scatter":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <path d="M2 2v16h18" fill="none" stroke={d} strokeWidth="1.4" />
          <circle cx="6" cy="13" r="1.7" fill={d} />
          <circle cx="10" cy="8" r="2" fill={b} />
          <circle cx="15" cy="11" r="1.6" fill={b} opacity="0.7" />
          <circle cx="16" cy="5" r="2" fill={d} />
        </svg>
      );
    case "pie":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <circle cx="11" cy="10" r="7.2" fill="none" stroke={d} strokeWidth="1.3" />
          <path d="M11 10V2.8A7.2 7.2 0 0 1 17.2 13.6z" fill={b} fillOpacity="0.7" stroke={b} />
        </svg>
      );
    case "donut":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <circle cx="11" cy="10" r="5.8" fill="none" stroke={g} strokeWidth="3.4" />
          <path d="M11 4.2a5.8 5.8 0 0 1 5.2 8.2" fill="none" stroke={b} strokeWidth="3.4" />
        </svg>
      );
    case "treemap":
    case "decompTree":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <rect x="2.5" y="3" width="8.5" height="14" fill={b} fillOpacity="0.65" stroke={d} strokeWidth="1" />
          <rect x="11" y="3" width="8" height="7" fill="none" stroke={d} strokeWidth="1" />
          <rect x="11" y="10" width="8" height="7" fill={g} fillOpacity="0.35" stroke={d} strokeWidth="1" />
        </svg>
      );
    case "map":
    case "filledMap":
    case "azureMap":
    case "shapeMap":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <circle cx="11" cy="10" r="7.2" fill={tileId === "filledMap" || tileId === "azureMap" ? "#d9ecff" : "none"} stroke={tileId === "azureMap" ? b : d} strokeWidth="1.2" />
          <path d="M6.5 8.5c2-1 3.5 1 5 0s3-1.5 4 1.5c.8 2.2-1.5 3.8-4 3.8s-5-2-5-5.3Z" fill={b} fillOpacity="0.65" />
          <circle cx="14" cy="6.5" r="1.5" fill={a} />
        </svg>
      );
    case "gauge":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <path d="M4 15a7 7 0 0 1 14 0" fill="none" stroke={g} strokeWidth="3.3" />
          <path d="M4 15a7 7 0 0 1 10-6.2" fill="none" stroke={b} strokeWidth="3.3" />
          <line x1="11" y1="15" x2="14.5" y2="9.5" stroke={d} strokeWidth="1.4" />
        </svg>
      );
    case "card":
    case "cardNew":
    case "multiRowCard":
    case "kpi":
    case "metrics":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <rect x="2.5" y="3.5" width="17" height="13" rx="1" fill="none" stroke={d} strokeWidth="1.2" />
          {tileId === "kpi" ? (
            <>
              <polygon points="6,13 9,8 12,13" fill={t} />
              <polygon points="13,9 16,14 19,9" fill="#d13438" />
            </>
          ) : tileId === "multiRowCard" ? (
            <>
              <rect x="4.5" y="6" width="5" height="2" fill={b} />
              <line x1="11" y1="7" x2="17" y2="7" stroke={g} strokeWidth="1.5" />
              <rect x="4.5" y="11" width="5" height="2" fill={b} />
              <line x1="11" y1="12" x2="17" y2="12" stroke={g} strokeWidth="1.5" />
            </>
          ) : (
            <text x="11" y="12.5" textAnchor="middle" fontSize="7.2" fontWeight="700" fill={b} fontFamily="Segoe UI, sans-serif">
              123
            </text>
          )}
        </svg>
      );
    case "slicer":
    case "slicerNew":
    case "textSlicer":
    case "listSlicer":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <rect x="2.5" y="3" width="13" height="14" fill="none" stroke={d} strokeWidth="1.2" />
          <rect x="4.5" y="5.5" width="3" height="3" fill={tileId === "slicerNew" ? b : g} />
          <rect x="4.5" y="11" width="3" height="3" fill={g} />
          <polygon points="12,9 19.5,9 16.5,13 16.5,17.5 14.5,17.5 14.5,13" fill={g} stroke={d} strokeWidth="0.9" />
        </svg>
      );
    case "table":
    case "paginatedReport":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <rect x="2.5" y="3" width="17" height="14" fill="none" stroke={d} strokeWidth="1.2" />
          <line x1="2.5" y1="7" x2="19.5" y2="7" stroke={d} strokeWidth="1.2" />
          <line x1="2.5" y1="12" x2="19.5" y2="12" stroke={g} strokeWidth="1" />
          <line x1="8" y1="3" x2="8" y2="17" stroke={g} strokeWidth="1" />
          <line x1="14" y1="3" x2="14" y2="17" stroke={g} strokeWidth="1" />
        </svg>
      );
    case "matrix":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <rect x="2.5" y="3" width="17" height="14" fill="none" stroke={d} strokeWidth="1.2" />
          <rect x="2.5" y="3" width="17" height="4" fill={b} fillOpacity="0.45" />
          <rect x="2.5" y="7" width="5.5" height="10" fill={b} fillOpacity="0.3" />
          <line x1="8" y1="3" x2="8" y2="17" stroke={d} strokeWidth="1" />
          <line x1="14" y1="3" x2="14" y2="17" stroke={d} strokeWidth="1" />
          <line x1="2.5" y1="12" x2="19.5" y2="12" stroke={d} strokeWidth="1" />
        </svg>
      );
    case "rVisual":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <text x="11" y="14.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#276dc3" fontFamily="Segoe UI, sans-serif">
            R
          </text>
        </svg>
      );
    case "pyVisual":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <text x="11" y="14" textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#3776ab" fontFamily="Segoe UI, sans-serif">
            Py
          </text>
        </svg>
      );
    case "keyInfluencers":
    case "qaVisual":
    case "smartNarrative":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <rect x="3" y="3.5" width="16" height="11" rx="2" fill="#e6f2ff" stroke={b} strokeWidth="1.1" />
          <polygon points="7,14.5 7,18 11,14.5" fill="#e6f2ff" stroke={b} strokeWidth="1" />
          <line x1="6" y1="7.5" x2="16" y2="7.5" stroke={b} strokeWidth="1.3" />
          <line x1="6" y1="10.8" x2="13" y2="10.8" stroke={d} strokeWidth="1.1" />
        </svg>
      );
    case "powerApps":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <polygon points="4,10 11,3 18,10 11,17" fill="#742774" fillOpacity="0.82" />
          <polygon points="10,10 14,6 18,10 14,14" fill="#c060c0" />
        </svg>
      );
    case "powerAutomate":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <path d="M4 5h8l5 5-5 5H4l5-5-5-5Z" fill="#0066ff" fillOpacity="0.85" />
        </svg>
      );
    default:
      return <DesktopVizTileGlyph tileId="clusteredColumn" />;
  }
}

export function VisualTypeGlyph({ type }: { type: PowerBiVisualType }) {
  return <DesktopVizTileGlyph tileId={type} />;
}
