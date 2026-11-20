"use client";

import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

/** Official 3-bar gold Power BI mark */
export function PowerBiLogoMark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="12" width="4.2" height="9" rx="1" fill="#c88f00" />
      <rect x="9.8" y="8" width="4.2" height="13" rx="1" fill="#e2ad00" />
      <rect x="15.6" y="3" width="4.2" height="18" rx="1" fill="#f2c811" />
    </svg>
  );
}

/** Title bar QAT & Utility icons */
export function SaveIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 2h9l2 2v9.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5V2.5a.5.5 0 0 1 .5-.5Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 2v4h6V2" stroke="currentColor" strokeWidth="1.1" />
      <rect x="5" y="9" width="6" height="5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function UndoIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5.5 4.5 2.5 7l3 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7h6.2a3.3 3.3 0 1 1 0 6.5H6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function RedoIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10.5 4.5 13.5 7l-3 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 7H6.8a3.3 3.3 0 1 0 0 6.5H9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** Clipboard group */
export function PasteIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4.5" width="11.5" height="14.5" rx="1.2" fill="#f5deb3" stroke="#9e7438" strokeWidth="1.2" />
      <path d="M7.5 3.5h4.5v2.2H7.5z" fill="#c89d54" stroke="#7d5922" strokeWidth="1" />
      <rect x="10.5" y="9" width="9" height="11.5" rx="1" fill="#ffffff" stroke="#424242" strokeWidth="1.2" />
      <line x1="12.5" y1="12" x2="17.5" y2="12" stroke="#797775" strokeWidth="1.1" />
      <line x1="12.5" y1="15" x2="17.5" y2="15" stroke="#797775" strokeWidth="1.1" />
    </svg>
  );
}

export function CutIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="4.5" cy="11.5" r="2" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="11.5" cy="11.5" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 10 11.5 2.5M10 10 4.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function CopyIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5" y="4" width="8.5" height="10" rx="1" fill="#ffffff" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3 11.5V3a1 1 0 0 1 1-1h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function FormatPainterIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="9" height="4.5" rx="0.8" fill="#ffe6a3" stroke="#9e7438" strokeWidth="1.1" />
      <path d="M7.5 6.5V9l-1 1.5v3.5h2v-3.5L7.5 9" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

/** Data group */
export function GetDataRibbonIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="9.5" cy="6.2" rx="5.5" ry="2.2" fill="#e1dfdd" stroke="#484644" strokeWidth="1.2" />
      <path d="M4 6.2v9.6c0 1.2 2.5 2.2 5.5 2.2" stroke="#484644" strokeWidth="1.2" />
      <path d="M15 6.2v4.3" stroke="#484644" strokeWidth="1.2" />
      <rect x="11.5" y="11" width="9" height="8" rx="1" fill="#ffffff" stroke="#323130" strokeWidth="1.2" />
      <line x1="11.5" y1="14" x2="20.5" y2="14" stroke="#117865" strokeWidth="1.2" />
      <line x1="15.5" y1="11" x2="15.5" y2="19" stroke="#a19f9d" strokeWidth="1" />
    </svg>
  );
}

export function ExcelWorkbookIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="4" width="13" height="16" rx="1.5" fill="#ffffff" stroke="#8a8886" strokeWidth="1.1" />
      <rect x="13" y="4" width="7" height="16" rx="1" fill="#e6f4ea" />
      <line x1="14" y1="8.5" x2="18.5" y2="8.5" stroke="#107c41" strokeWidth="1.2" />
      <line x1="14" y1="12" x2="18.5" y2="12" stroke="#107c41" strokeWidth="1.2" />
      <line x1="14" y1="15.5" x2="18.5" y2="15.5" stroke="#107c41" strokeWidth="1.2" />
      <rect x="3" y="7" width="10.5" height="10.5" rx="1.5" fill="#107c41" />
      <path d="M6 10l4.5 4.5M10.5 10L6 14.5" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function OneLakeCatalogIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" fill="#d9f2f7" stroke="#0078d4" strokeWidth="1.2" />
      <path d="M12 4.5a7.5 7.5 0 0 1 7.3 5.8c-2 2.4-5.2 1.8-7.3-.2-2-1.8-3.8-1-5 .8A7.5 7.5 0 0 1 12 4.5Z" fill="#0e86c7" />
      <path d="M19.3 10.3A7.5 7.5 0 0 1 8.5 18.6c2.6.5 5.4-1 7.2-3.4 1.3-1.7 2.5-3.2 3.6-4.9Z" fill="#18a48f" />
      <circle cx="12" cy="12" r="2.6" fill="#ffffff" />
    </svg>
  );
}

export function SqlServerRibbonIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="10.5" cy="5.8" rx="6" ry="2.3" fill="#fff0db" stroke="#c86b14" strokeWidth="1.2" />
      <path d="M4.5 5.8v11c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4v-11" fill="#fff7ed" stroke="#c86b14" strokeWidth="1.2" />
      <path d="M4.5 11.2c0 1.3 2.7 2.3 6 2.3s6-1 6-2.3" stroke="#c86b14" strokeWidth="1.1" />
      <rect x="11" y="13.5" width="9.5" height="6.5" rx="1" fill="#0078d4" />
      <text x="15.8" y="18.3" textAnchor="middle" fontSize="5" fontWeight="700" fill="#ffffff" fontFamily="Segoe UI, sans-serif">
        SQL
      </text>
    </svg>
  );
}

export function EnterDataRibbonIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4.5" width="14" height="14" rx="1.2" fill="#ffffff" stroke="#484644" strokeWidth="1.2" />
      <line x1="4" y1="9" x2="18" y2="9" stroke="#107c41" strokeWidth="1.3" />
      <line x1="4" y1="13.5" x2="18" y2="13.5" stroke="#a19f9d" strokeWidth="1" />
      <line x1="9" y1="4.5" x2="9" y2="18.5" stroke="#a19f9d" strokeWidth="1" />
      <line x1="13.5" y1="4.5" x2="13.5" y2="18.5" stroke="#a19f9d" strokeWidth="1" />
      <circle cx="17.5" cy="7.5" r="3.8" fill="#107c41" />
      <path d="M17.5 5.7v3.6M15.7 7.5h3.6" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function DataverseRibbonIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="#107c41" strokeWidth="1.6" />
      <path d="M7.5 11.5c1.5-2.8 5.2-3.4 7.8-1.2 1.8 1.6 2 4.3.2 5.9-2 1.8-5.4 1.6-7.2-.6" stroke="#107c41" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.9" fill="#107c41" />
    </svg>
  );
}

export function RecentSourcesRibbonIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="9.5" cy="6.2" rx="5.2" ry="2" fill="#e1dfdd" stroke="#484644" strokeWidth="1.2" />
      <path d="M4.3 6.2v9c0 1.1 2.3 2 5.2 2" stroke="#484644" strokeWidth="1.2" />
      <path d="M14.7 6.2v4.8" stroke="#484644" strokeWidth="1.2" />
      <circle cx="15.5" cy="15.5" r="4.8" fill="#ffffff" stroke="#0078d4" strokeWidth="1.3" />
      <path d="M15.5 12.8v2.9l2 1.2" stroke="#0078d4" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** Queries group */
export function TransformDataRibbonIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="13.5" height="14.5" rx="1.2" fill="#ffffff" stroke="#484644" strokeWidth="1.2" />
      <rect x="4" y="4" width="13.5" height="4" fill="#d2e8ff" stroke="#484644" strokeWidth="1" />
      <line x1="9" y1="8" x2="9" y2="18.5" stroke="#a19f9d" strokeWidth="1" />
      <line x1="4" y1="13" x2="17.5" y2="13" stroke="#a19f9d" strokeWidth="1" />
      <path d="M13 18l5.5-5.5 2 2L15 20l-2.8.8L13 18Z" fill="#0078d4" stroke="#ffffff" strokeWidth="0.8" />
    </svg>
  );
}

export function RefreshRibbonIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="13" height="13" rx="1.2" fill="#ffffff" stroke="#8a8886" strokeWidth="1.1" />
      <line x1="4" y1="9" x2="17" y2="9" stroke="#c8c6c4" strokeWidth="1" />
      <path d="M19 13.5a4.8 4.8 0 0 1-8.4 3.2" stroke="#107c41" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.5 13.5a4.8 4.8 0 0 1 8-3.4" stroke="#107c41" strokeWidth="1.8" strokeLinecap="round" />
      <polygon points="19.5,8.2 19.6,11.6 16.4,10.9" fill="#107c41" />
    </svg>
  );
}

/** Insert group */
export function NewVisualRibbonIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="10" width="3.5" height="8.5" fill="#118dff" />
      <rect x="9.5" y="6" width="3.5" height="12.5" fill="#117865" />
      <rect x="14.5" y="12" width="3.5" height="6.5" fill="#797775" />
      <circle cx="17.5" cy="7.5" r="3.8" fill="#107c41" />
      <path d="M17.5 5.7v3.6M15.7 7.5h3.6" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function TextBoxRibbonIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="5" width="15" height="14" rx="1.2" fill="#ffffff" stroke="#484644" strokeWidth="1.2" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#0078d4" fontFamily="Segoe UI, sans-serif">
        A
      </text>
    </svg>
  );
}

export function MoreVisualsRibbonIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="13.5" height="13.5" rx="1.2" fill="#ffffff" stroke="#484644" strokeWidth="1.2" />
      <rect x="6.5" y="11" width="2.2" height="5" fill="#118dff" />
      <rect x="9.8" y="8" width="2.2" height="8" fill="#118dff" />
      <path d="M14 17l5-5 1.8 1.8-5 5H14V17Z" fill="#0078d4" />
    </svg>
  );
}

/** Calculations, Sensitivity, Share, Copilot */
export function VisualCalcRibbonIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="5" width="13" height="13" rx="1.2" fill="#faf9f8" stroke="#8a8886" strokeWidth="1.1" />
      <text x="11" y="14.5" textAnchor="middle" fontSize="9.5" fontStyle="italic" fontWeight="700" fill="#484644" fontFamily="Georgia, serif">
        fx
      </text>
      <path d="M18 4.5l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8.8-1.8Z" fill="#0078d4" />
    </svg>
  );
}

export function CalculatorRibbonIcon({ size = 24, lightning = false }: IconProps & { lightning?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="4" width="12.5" height="16" rx="1.5" fill="#ffffff" stroke="#605e5c" strokeWidth="1.2" />
      <rect x="7" y="6" width="8.5" height="3.2" fill="#e1dfdd" />
      <circle cx="8" cy="12" r="0.9" fill="#605e5c" />
      <circle cx="11.2" cy="12" r="0.9" fill="#605e5c" />
      <circle cx="14.4" cy="12" r="0.9" fill="#605e5c" />
      <circle cx="8" cy="15.5" r="0.9" fill="#605e5c" />
      <circle cx="11.2" cy="15.5" r="0.9" fill="#605e5c" />
      {lightning ? (
        <polygon points="16.5,11 13.5,15.5 16,15.5 15,20 19.5,14.5 16.8,14.5" fill="#f2c811" stroke="#b07c00" strokeWidth="0.6" />
      ) : (
        <circle cx="14.4" cy="15.5" r="0.9" fill="#117865" />
      )}
    </svg>
  );
}

export function SensitivityRibbonIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5.5 7.5 12 4l6.5 3.5V13c0 4-3.2 6.8-6.5 7.5C8.7 19.8 5.5 17 5.5 13V7.5Z" fill="#eef6fc" stroke="#0078d4" strokeWidth="1.3" />
      <path d="M9.5 12.5 11.3 14.3 15 10.2" stroke="#0078d4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PublishRibbonIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 14v4.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V14" stroke="#605e5c" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 14.5V5M8.5 8.5 12 5l3.5 3.5" stroke="#0078d4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PrepAiRibbonIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="10.5" cy="7" rx="5.5" ry="2" fill="#e1effa" stroke="#0078d4" strokeWidth="1.2" />
      <path d="M5 7v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V7" stroke="#0078d4" strokeWidth="1.2" />
      <path d="M18.5 4.5l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8.8-1.8Z" fill="#0078d4" />
    </svg>
  );
}

/** Colorful Microsoft Copilot Ribbon Emblem */
export function CopilotRibbonIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="copilotA" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00a4ef" />
          <stop offset="50%" stopColor="#2664eb" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="copilotB" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="50%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <path d="M7.5 6.5c2.2-2.2 5.8-1.8 7.5.6l3 4.2c1.2 1.7.3 4.2-1.8 4.6l-3.6.7c-1.5.3-3-.5-3.6-1.9L6.4 9.5c-.6-1.2-.2-2.2 1.1-3Z" fill="url(#copilotA)" />
      <path d="M16.5 17.5c-2.2 2.2-5.8 1.8-7.5-.6l-3-4.2C4.8 11 5.7 8.5 7.8 8.1l3.6-.7c1.5-.3 3 .5 3.6 1.9l2.6 5.2c.6 1.2.2 2.2-1.1 3Z" fill="url(#copilotB)" opacity="0.92" />
    </svg>
  );
}

/** 5 Left Navigation Rail Icons matching Screenshot 1 */
export function LeftRailIcon({
  kind,
  size = 18,
}: {
  kind: "report" | "table" | "model" | "dax" | "tmdl";
  size?: number;
}) {
  if (kind === "report") {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2.5" y="3" width="15" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <rect x="5.5" y="9.5" width="2.2" height="5" fill="currentColor" />
        <rect x="9" y="6.5" width="2.2" height="8" fill="currentColor" />
        <rect x="12.5" y="11" width="2.2" height="3.5" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "table") {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2.5" y="3" width="15" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <line x1="2.5" y1="7.5" x2="17.5" y2="7.5" stroke="currentColor" strokeWidth="1.3" />
        <line x1="2.5" y1="12" x2="17.5" y2="12" stroke="currentColor" strokeWidth="1.1" />
        <line x1="7.5" y1="7.5" x2="7.5" y2="17" stroke="currentColor" strokeWidth="1.1" />
        <line x1="12.5" y1="7.5" x2="12.5" y2="17" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    );
  }
  if (kind === "model") {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="7" y="2.5" width="6" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
        <rect x="2.5" y="13" width="6" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
        <rect x="11.5" y="13" width="6" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
        <path d="M10 6.5V10H5.5v3M10 10h4.5v3" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }
  if (kind === "dax") {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <text x="10" y="9.2" textAnchor="middle" fontSize="6.3" fontWeight="700" fill="currentColor" fontFamily="Segoe UI, sans-serif">
          DAX
        </text>
        <line x1="3.5" y1="12.5" x2="16.5" y2="12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="3.5" y1="15.8" x2="13.5" y2="15.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <text x="10" y="9.2" textAnchor="middle" fontSize="5.4" fontWeight="700" fill="currentColor" fontFamily="Segoe UI, sans-serif">
        TMDL
      </text>
      <path d="M5 12.2v4.5h10M7.5 14.5h6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** Empty state large tile emblems (Desktop & Service Create) */
export function TileExcelBadge({ size = 38 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="12" y="6" width="21" height="28" rx="2" fill="#21a366" />
      <rect x="22" y="6" width="11" height="14" rx="1" fill="#33c481" />
      <rect x="22" y="20" width="11" height="14" rx="1" fill="#185c37" />
      <rect x="6" y="11" width="18" height="18" rx="2" fill="#107c41" />
      <path d="M11.5 16 18.5 24M18.5 16 11.5 24" stroke="#ffffff" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}

export function TileSqlBadge({ size = 38 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <ellipse cx="20" cy="11" rx="11" ry="4.2" fill="#50a7e8" />
      <path d="M9 11v17.5c0 2.4 4.9 4.3 11 4.3s11-1.9 11-4.3V11" fill="#0078d4" />
      <ellipse cx="20" cy="11" rx="11" ry="4.2" fill="#63b8f2" />
      <text x="20" y="25" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#ffffff" fontFamily="Segoe UI, sans-serif">
        SQL
      </text>
    </svg>
  );
}

export function TilePasteBadge({ size = 38 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="9" y="8" width="17" height="23" rx="2" fill="#f7be47" stroke="#c28312" strokeWidth="1.5" />
      <rect x="14" y="6" width="7" height="4" rx="1" fill="#d99a26" stroke="#8f5d09" strokeWidth="1.2" />
      <rect x="19" y="15" width="12" height="17" rx="1.5" fill="#ffffff" stroke="#484644" strokeWidth="1.5" />
      <line x1="22" y1="20" x2="28" y2="20" stroke="#797775" strokeWidth="1.4" />
      <line x1="22" y1="24" x2="28" y2="24" stroke="#797775" strokeWidth="1.4" />
      <line x1="22" y1="28" x2="26" y2="28" stroke="#797775" strokeWidth="1.4" />
    </svg>
  );
}

export function TileSampleBadge({ size = 38 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <ellipse cx="18" cy="11.5" rx="9" ry="3.3" fill="#e1dfdd" stroke="#484644" strokeWidth="1.5" />
      <path d="M9 11.5v15c0 1.8 4 3.3 9 3.3s9-1.5 9-3.3v-15" stroke="#484644" strokeWidth="1.5" />
      <path d="M9 19c0 1.8 4 3.2 9 3.2" stroke="#484644" strokeWidth="1.3" />
      <path d="M31 24H20M23.5 20.5 20 24l3.5 3.5" stroke="#0078d4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ServiceCsvBadge({ size = 38 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M12 6h12l7 7v21H12V6Z" fill="#ffffff" stroke="#484644" strokeWidth="1.5" />
      <path d="M24 6v7h7" fill="#e1dfdd" stroke="#484644" strokeWidth="1.3" />
      <rect x="6" y="13" width="15" height="15" rx="1.8" fill="#107c41" />
      <path d="M10.5 17.5 16.5 23.5M16.5 17.5 10.5 23.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      <text x="24" y="27" fontSize="6.5" fontWeight="700" fill="#107c41" fontFamily="Segoe UI, sans-serif">
        CSV
      </text>
    </svg>
  );
}

export function SemanticModelBadge({ size = 38 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="13" y="8" width="9" height="8" rx="1" fill="#f3f2f1" stroke="#484644" strokeWidth="1.4" />
      <rect x="7" y="16" width="9" height="13" rx="1" fill="#ffffff" stroke="#484644" strokeWidth="1.4" />
      <ellipse cx="26" cy="18.5" rx="6" ry="2.2" fill="#ffe1b5" stroke="#ca6b14" strokeWidth="1.3" />
      <path d="M20 18.5v9.5c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2v-9.5" fill="#fff2de" stroke="#ca6b14" strokeWidth="1.3" />
      <path d="M20 23.2c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2" stroke="#ca6b14" strokeWidth="1.1" />
    </svg>
  );
}

export function NewColumnRibbonIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4.5" width="15" height="15" rx="1.2" fill="#ffffff" stroke="#484644" strokeWidth="1.2" />
      <rect x="10" y="4.5" width="4.5" height="15" fill="#e6f2ef" stroke="#117865" strokeWidth="1.1" />
      <text x="12.2" y="13.5" textAnchor="middle" fontSize="6.5" fontStyle="italic" fontWeight="700" fill="#117865" fontFamily="Georgia, serif">
        fx
      </text>
    </svg>
  );
}

export function RelationshipRibbonIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="7" height="6" rx="1" fill="#ffffff" stroke="#484644" strokeWidth="1.2" />
      <rect x="13.5" y="13.5" width="7" height="6" rx="1" fill="#e6f2ef" stroke="#117865" strokeWidth="1.2" />
      <path d="M10.5 7.5H17v6" stroke="#117865" strokeWidth="1.5" />
      <circle cx="10.5" cy="7.5" r="1.4" fill="#117865" />
      <circle cx="17" cy="13.5" r="1.4" fill="#117865" />
    </svg>
  );
}
