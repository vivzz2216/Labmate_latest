"use client";

import React from "react";
import type { PowerBiVisualType } from "@/lib/powerbi/types";

export interface DesktopVizTileItem {
  id: PowerBiVisualType;
  label: string;
}

/**
 * Clean Visualizations pane gallery: contains ONLY the 17 genuinely implemented Power BI visual types
 * so every visible button creates or switches to its exact visualization.
 */
export const DESKTOP_VIZ_GRID_TILES: ReadonlyArray<DesktopVizTileItem> = [
  { id: "stackedBar", label: "Stacked bar chart" },
  { id: "stackedColumn", label: "Stacked column chart" },
  { id: "clusteredBar", label: "Clustered bar chart" },
  { id: "clusteredColumn", label: "Clustered column chart" },
  { id: "line", label: "Line chart" },
  { id: "area", label: "Area chart" },
  { id: "funnel", label: "Funnel" },
  { id: "scatter", label: "Scatter chart" },
  { id: "pie", label: "Pie chart" },
  { id: "donut", label: "Donut chart" },
  { id: "treemap", label: "Treemap" },
  { id: "gauge", label: "Gauge" },
  { id: "card", label: "Card" },
  { id: "slicer", label: "Slicer" },
  { id: "table", label: "Table" },
  { id: "matrix", label: "Matrix" },
  { id: "textbox", label: "Text box" },
];

/** Authentic miniature Power BI Visualizations pane SVG icons matching Desktop 6-column gallery. */
export function DesktopVizTileGlyph({ tileId }: { tileId: string }) {
  const b = "#3b7ec2";
  const bLight = "#73b2eb";
  const g = "#797775";
  const d = "#323130";

  switch (tileId) {
    case "stackedBar":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <path d="M2 2v16h18" fill="none" stroke={d} strokeWidth="1.4" />
          <rect x="3" y="4" width="6" height="4" fill={b} />
          <rect x="9" y="4" width="5" height="4" fill={g} />
          <rect x="3" y="10.5" width="9" height="4" fill={b} />
          <rect x="12" y="10.5" width="5" height="4" fill={g} />
        </svg>
      );
    case "stackedColumn":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <path d="M2 2v16h18" fill="none" stroke={d} strokeWidth="1.4" />
          <rect x="5" y="9" width="4" height="8" fill={b} />
          <rect x="5" y="5" width="4" height="4" fill={g} />
          <rect x="12" y="11" width="4" height="6" fill={b} />
          <rect x="12" y="3" width="4" height="8" fill={g} />
        </svg>
      );
    case "clusteredBar":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <path d="M2 2v16h18" fill="none" stroke={d} strokeWidth="1.4" />
          <rect x="3" y="3" width="13" height="3.2" fill={b} />
          <rect x="3" y="6.8" width="8" height="3.2" fill={g} />
          <rect x="3" y="12" width="11" height="3.2" fill={bLight} />
        </svg>
      );
    case "clusteredColumn":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <path d="M2 2v16h18" fill="none" stroke={d} strokeWidth="1.4" />
          <rect x="4" y="4" width="3.5" height="13" fill={b} />
          <rect x="8.5" y="9" width="3.5" height="8" fill={g} />
          <rect x="13" y="6" width="3.5" height="11" fill={b} />
          <rect x="17" y="11" width="2.8" height="6" fill={g} />
        </svg>
      );
    case "line":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <path d="M2 2v16h18" fill="none" stroke={d} strokeWidth="1.4" />
          <polyline points="3,10 9,13 14,6 19,9" fill="none" stroke={g} strokeWidth="1.2" />
          <polyline points="3,13 8,7 13,10 19,4" fill="none" stroke={b} strokeWidth="1.7" />
        </svg>
      );
    case "area":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <path d="M2 2v16h18" fill="none" stroke={d} strokeWidth="1.4" />
          <polygon points="3,17 3,11 9,6 15,10 19,5 19,17" fill={b} fillOpacity="0.45" />
          <polyline points="3,11 9,6 15,10 19,5" fill="none" stroke={b} strokeWidth="1.5" />
        </svg>
      );
    case "funnel":
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
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <rect x="2.5" y="3" width="8.5" height="14" fill={b} fillOpacity="0.65" stroke={d} strokeWidth="1" />
          <rect x="11" y="3" width="8" height="7" fill="none" stroke={d} strokeWidth="1" />
          <rect x="11" y="10" width="8" height="7" fill={g} fillOpacity="0.35" stroke={d} strokeWidth="1" />
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
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <rect x="2.5" y="3.5" width="17" height="13" rx="1" fill="none" stroke={d} strokeWidth="1.2" />
          <text x="11" y="12.5" textAnchor="middle" fontSize="7.2" fontWeight="700" fill={b} fontFamily="Segoe UI, sans-serif">
            123
          </text>
        </svg>
      );
    case "slicer":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <rect x="2.5" y="3" width="13" height="14" fill="none" stroke={d} strokeWidth="1.2" />
          <rect x="4.5" y="5.5" width="3" height="3" fill={b} />
          <rect x="4.5" y="11" width="3" height="3" fill={g} />
          <polygon points="12,9 19.5,9 16.5,13 16.5,17.5 14.5,17.5 14.5,13" fill={g} stroke={d} strokeWidth="0.9" />
        </svg>
      );
    case "table":
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
    case "textbox":
      return (
        <svg viewBox="0 0 22 20" width={19} height={17}>
          <rect x="3" y="3.5" width="16" height="13" rx="1" fill="#ffffff" stroke={d} strokeWidth="1.2" />
          <text x="11" y="13.5" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={b} fontFamily="Segoe UI, sans-serif">
            A
          </text>
        </svg>
      );
    default:
      return <DesktopVizTileGlyph tileId="clusteredColumn" />;
  }
}

export function VisualTypeGlyph({ type }: { type: PowerBiVisualType }) {
  return <DesktopVizTileGlyph tileId={type} />;
}
