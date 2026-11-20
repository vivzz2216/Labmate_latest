"use client";

import React, { useId } from "react";

interface IconProps {
  size?: number;
  className?: string;
}

function useUid(prefix: string): string {
  return prefix + "_" + useId().replace(/[^a-zA-Z0-9_-]/g, "_");
}

/* =========================================================================
 * App Icon & Workspace Bar Icons
 * ========================================================================= */

export function PacketTracerAppIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#0B7B8C" stroke="#064E59" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="6.5" fill="#18A3B8" stroke="#FFFFFF" strokeWidth="1.3" />
      <path d="M5.5 12h13M12 5.5v13M8 8l8 8M16 8l-8 8" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.9" />
      <rect x="13" y="13.5" width="8" height="6" rx="1" fill="#FBBF24" stroke="#78350F" strokeWidth="1" />
    </svg>
  );
}

/* =========================================================================
 * Top Main Toolbar Icons (PT 8.2 Exact Sequence)
 * ========================================================================= */

export function PtNewIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path d="M3.5 2h7.5l3.5 3.5V16h-11z" fill="#FFFFFF" stroke="#5A6775" strokeWidth="1.1" />
      <path d="M11 2v3.5h3.5" fill="#DCE4EE" stroke="#5A6775" strokeWidth="1" />
      <path d="M13 1l.6 1.5 1.5.6-1.5.6L13 5.2l-.6-1.5-1.5-.6 1.5-.6z" fill="#F59E0B" />
    </svg>
  );
}

export function PtOpenIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path d="M2 4.5h4.8l1.6 1.6h7.6v8.4H2z" fill="#D49A2A" stroke="#855C0E" strokeWidth="1" />
      <path d="M3.3 7.8h13.2l-1.7 6.7H2z" fill="#F8D26A" stroke="#855C0E" strokeWidth="1" />
    </svg>
  );
}

export function PtSaveIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path d="M2.5 2.5h10.2l2.8 2.8v10.2h-13z" fill="#3B79B8" stroke="#1E4B7A" strokeWidth="1.1" />
      <rect x="5" y="2.5" width="6.5" height="4.5" fill="#DCE7F3" stroke="#1E4B7A" strokeWidth="0.8" />
      <rect x="4.5" y="9.5" width="9" height="5.5" fill="#FFFFFF" stroke="#1E4B7A" strokeWidth="0.8" />
    </svg>
  );
}

export function PtPrintIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <rect x="4.5" y="2.5" width="9" height="4" fill="#FFFFFF" stroke="#556270" strokeWidth="1" />
      <rect x="2" y="6.2" width="14" height="6.2" rx="1" fill="#A8B5C4" stroke="#465260" strokeWidth="1" />
      <rect x="4.5" y="10.2" width="9" height="5.3" fill="#FFFFFF" stroke="#556270" strokeWidth="1" />
      <circle cx="13.5" cy="8.2" r="0.9" fill="#22C55E" />
    </svg>
  );
}

export function PtActivityWizardIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <rect x="3" y="2.5" width="10.5" height="13" rx="1" fill="#FFF8DC" stroke="#8C6D1F" strokeWidth="1" />
      <line x1="5.2" y1="5.5" x2="11" y2="5.5" stroke="#8C6D1F" strokeWidth="1" />
      <line x1="5.2" y1="8.2" x2="11" y2="8.2" stroke="#8C6D1F" strokeWidth="1" />
      <path d="M11 15l4.2-4.2-1.4-1.4-4.2 4.2-.4 1.8z" fill="#3B82F6" stroke="#1E3A8A" strokeWidth="0.8" />
    </svg>
  );
}

export function PtCopyIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <rect x="3" y="2.5" width="8.5" height="10.5" fill="#FFFFFF" stroke="#556270" strokeWidth="1" />
      <rect x="6.5" y="5.5" width="8.5" height="10.5" fill="#F0F5FA" stroke="#366294" strokeWidth="1" />
    </svg>
  );
}

export function PtPasteIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <rect x="3.5" y="3.5" width="10.5" height="12" rx="1" fill="#C69C6D" stroke="#6B4D2E" strokeWidth="1" />
      <rect x="6" y="2" width="5.5" height="2.4" rx="0.6" fill="#9AA5B1" stroke="#4B5563" strokeWidth="0.9" />
      <rect x="6.5" y="6.8" width="8.5" height="9" fill="#FFFFFF" stroke="#366294" strokeWidth="1" />
    </svg>
  );
}

export function PtUndoIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path d="M6.5 6.5H12a3.5 3.5 0 0 1 0 7H8" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.2 3.5L3.5 6.5l3.7 3z" fill="#2563EB" />
    </svg>
  );
}

export function PtRedoIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path d="M11.5 6.5H6a3.5 3.5 0 0 0 0 7h4" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.8 3.5l3.7 3-3.7 3z" fill="#2563EB" />
    </svg>
  );
}

export function PtZoomInIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="4.8" fill="#E6F2FF" stroke="#475569" strokeWidth="1.4" />
      <path d="M11 11l4.2 4.2" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.5 5.3v4.4M5.3 7.5h4.4" stroke="#1E6FD8" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function PtZoomResetIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="4.8" fill="#E6F2FF" stroke="#475569" strokeWidth="1.4" />
      <path d="M11 11l4.2 4.2" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
      <text x="7.5" y="9.4" textAnchor="middle" fontSize="5.4" fontWeight="700" fill="#1E6FD8">1:1</text>
    </svg>
  );
}

export function PtZoomOutIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="4.8" fill="#E6F2FF" stroke="#475569" strokeWidth="1.4" />
      <path d="M11 11l4.2 4.2" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
      <path d="M5.3 7.5h4.4" stroke="#1E6FD8" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function PtDrawingPaletteIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <rect x="2.5" y="3" width="8.5" height="7" fill="#BFDBFE" stroke="#2563EB" strokeWidth="1" />
      <circle cx="11.5" cy="11" r="4.3" fill="#FDE68A" stroke="#D97706" strokeWidth="1" />
    </svg>
  );
}

/* =========================================================================
 * Right Vertical Common Tools Strip Icons (PT 8.2 Authentic)
 * ========================================================================= */

export function PtSelectIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 2.5v13.2l3.4-3.2 2.3 4.8 1.9-.9-2.3-4.8h4.5z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function PtInspectIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3" y="2.5" width="9.5" height="12.5" fill="#FFFFFF" stroke="#5A6775" strokeWidth="1.1" />
      <line x1="5" y1="5.5" x2="10.5" y2="5.5" stroke="#94A3B8" strokeWidth="1.1" />
      <line x1="5" y1="8.2" x2="10.5" y2="8.2" stroke="#94A3B8" strokeWidth="1.1" />
      <circle cx="12.2" cy="11.8" r="3.8" fill="#E0F2FE" stroke="#1D4ED8" strokeWidth="1.4" />
      <path d="M15 14.6l2.8 2.8" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function PtDeleteIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" stroke="#334155" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" stroke="#DC2626" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function PtResizeIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3.5" y="4" width="12.5" height="11.5" fill="#FFFFFF" stroke="#475569" strokeWidth="1.1" strokeDasharray="2 1.5" />
      <path d="M6.5 13.5l7-7M10.5 6.5h3v3M6.5 10.5v3h3" fill="none" stroke="#1E6FD8" strokeWidth="1.4" />
    </svg>
  );
}

export function PtNoteIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3" y="3" width="12" height="13.5" fill="#FEF08A" stroke="#A16207" strokeWidth="1.1" />
      <line x1="5" y1="6.5" x2="12.5" y2="6.5" stroke="#854D0E" strokeWidth="1" />
      <line x1="5" y1="9.5" x2="12.5" y2="9.5" stroke="#854D0E" strokeWidth="1" />
      <line x1="5" y1="12.5" x2="10" y2="12.5" stroke="#854D0E" strokeWidth="1" />
    </svg>
  );
}

export function PtSimplePduIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2" y="5.5" width="13.5" height="9.5" rx="1" fill="#FDE68A" stroke="#854D0E" strokeWidth="1.1" />
      <path d="M2 5.8l6.75 5.2L15.5 5.8" fill="none" stroke="#854D0E" strokeWidth="1.1" />
      <circle cx="15" cy="14" r="3.6" fill="#22C55E" stroke="#14532D" strokeWidth="0.9" />
      <path d="M15 12.2v3.6M13.2 14h3.6" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function PtComplexPduIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2 7.5L8.8 3l6.7 4.5V15H2z" fill="#FEF3C7" stroke="#92400E" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M2 7.5l6.8 4.4 6.7-4.4" fill="none" stroke="#92400E" strokeWidth="1.1" />
      <circle cx="15" cy="14" r="3.6" fill="#2563EB" stroke="#1E3A8A" strokeWidth="0.9" />
      <path d="M15 12.2v3.6M13.2 14h3.6" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/* =========================================================================
 * Bottom Device-Type & Sub-category Icons + Realtime/Simulation Controls
 * ========================================================================= */

export function PtRealtimeIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="#E0F2FE" stroke="#0369A1" strokeWidth="1.2" />
      <path d="M8 4.5V8l2.5 1.8" fill="none" stroke="#0369A1" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function PtSimulationIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="6.5" y="1.2" width="3" height="1.5" fill="#B45309" />
      <circle cx="8" cy="9" r="5.5" fill="#FEF3C7" stroke="#B45309" strokeWidth="1.2" />
      <path d="M8 6v3l2.2 1.2" fill="none" stroke="#B45309" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function PtPowerCycleIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path d="M14 9A5 5 0 1 1 9 4" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 1.5l3.5 2.5L9 6.5z" fill="#DC2626" />
    </svg>
  );
}

export function PtFastForwardIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path d="M3 4.5l5.5 4.5L3 13.5zM9 4.5l5.5 4.5L9 13.5z" fill="#0E7490" stroke="#155E75" strokeWidth="0.9" strokeLinejoin="round" />
    </svg>
  );
}

/* =========================================================================
 * Bottom Master Category Icons (Network, End Devices, Components, Connections, Misc, Multiuser)
 * ========================================================================= */

export function PtCatNetworkIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="9" cy="12.5" r="5.5" fill="#2B7BB3" stroke="#103754" strokeWidth="1" />
      <path d="M6.5 12.5h5M9 10v5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="11" y="4" width="8.5" height="5" rx="0.8" fill="#4BA3D8" stroke="#164B73" strokeWidth="1" />
    </svg>
  );
}

export function PtCatEndDevicesIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <rect x="3.5" y="4" width="13" height="9" rx="1" fill="#DFE6EE" stroke="#334155" strokeWidth="1.1" />
      <rect x="5" y="5.5" width="10" height="6" fill="#3B82F6" />
      <rect x="2.5" y="14.5" width="15" height="3.2" rx="0.6" fill="#94A3B8" stroke="#334155" strokeWidth="1" />
    </svg>
  );
}

export function PtCatComponentsIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <rect x="5" y="5" width="12" height="12" rx="1.5" fill="#15803D" stroke="#052E16" strokeWidth="1.1" />
      <rect x="7.5" y="7.5" width="7" height="7" fill="#334155" />
      <path d="M8 3v2M11 3v2M14 3v2M8 17v2M11 17v2M14 17v2M3 8h2M3 11h2M3 14h2M17 8h2M17 11h2M17 14h2" stroke="#D97706" strokeWidth="1.3" />
    </svg>
  );
}

export function PtCatConnectionsIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <path d="M12.5 2.5L5.5 12h5l-1 7.5 7.5-10h-5z" fill="#F59E0B" stroke="#92400E" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

export function PtCatMiscIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <rect x="4" y="4" width="14" height="14" rx="2" fill="#E2E8F0" stroke="#475569" strokeWidth="1.1" />
      <rect x="6.5" y="6.5" width="4" height="4" fill="#3B82F6" />
      <rect x="11.5" y="6.5" width="4" height="4" fill="#10B981" />
      <rect x="6.5" y="11.5" width="9" height="4" fill="#F59E0B" />
    </svg>
  );
}

export function PtCatMultiuserIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <path d="M7 16a4 4 0 0 1-.5-7.9A5 5 0 0 1 16 9a3.5 3.5 0 0 1-.5 7z" fill="#BAE6FD" stroke="#0284C7" strokeWidth="1.2" />
    </svg>
  );
}

/** Compact 20x18 Sub-category Icon Tiles for Bottom-Left PT 8.2 Selector */
export function PtSubCatIcon({ kind }: { kind: "routers" | "switches" | "hubs" | "wireless" | "security" | "wan" }) {
  if (kind === "routers") {
    return (
      <svg width="20" height="16" viewBox="0 0 24 18" aria-hidden="true">
        <path d="M3 6v6a9 3.8 0 0 0 18 0V6z" fill="#1F6294" stroke="#0E304D" strokeWidth="1" />
        <ellipse cx="12" cy="6" rx="9" ry="3.8" fill="#52A5D8" stroke="#0E304D" strokeWidth="1" />
        <path d="M8 6h8M12 4v4" stroke="#FFFFFF" strokeWidth="1.3" />
      </svg>
    );
  }
  if (kind === "switches") {
    return (
      <svg width="20" height="16" viewBox="0 0 24 18" aria-hidden="true">
        <rect x="2.5" y="4.5" width="19" height="9" rx="1" fill="#2678B2" stroke="#0E304D" strokeWidth="1" />
        <path d="M6 7.5h12M6 10.5h12" stroke="#FFFFFF" strokeWidth="1.3" />
      </svg>
    );
  }
  if (kind === "hubs") {
    return (
      <svg width="20" height="16" viewBox="0 0 24 18" aria-hidden="true">
        <rect x="2.5" y="5" width="19" height="8" rx="1" fill="#7D93A8" stroke="#334155" strokeWidth="1" />
        <path d="M5 9h14" stroke="#FFFFFF" strokeWidth="1.4" />
      </svg>
    );
  }
  if (kind === "wireless") {
    return (
      <svg width="20" height="16" viewBox="0 0 24 18" aria-hidden="true">
        <rect x="4" y="9" width="16" height="6" rx="1" fill="#2563EB" stroke="#1E3A8A" strokeWidth="1" />
        <line x1="7" y1="9" x2="6" y2="2" stroke="#1E293B" strokeWidth="1.6" />
        <line x1="17" y1="9" x2="18" y2="2" stroke="#1E293B" strokeWidth="1.6" />
      </svg>
    );
  }
  if (kind === "security") {
    return (
      <svg width="20" height="16" viewBox="0 0 24 18" aria-hidden="true">
        <rect x="3" y="4" width="18" height="10" rx="1" fill="#991B1B" stroke="#450A0A" strokeWidth="1" />
        <path d="M12 5.5c2 2.5 2.5 4.5 0 7-2.5-2.5-2-4.5 0-7z" fill="#FBBF24" />
      </svg>
    );
  }
  return (
    <svg width="20" height="16" viewBox="0 0 24 18" aria-hidden="true">
      <path d="M6 14a3.5 3.5 0 0 1-.5-6.9A4.2 4.2 0 0 1 14 7a3.2 3.2 0 0 1-.5 7z" fill="#BAE6FD" stroke="#0284C7" strokeWidth="1.1" />
    </svg>
  );
}

/* =========================================================================
 * Authentic Cisco Packet Tracer 3D Isometric Device Icons (Canvas & Shelf)
 * ========================================================================= */

export function PtCanvasDeviceArtwork({
  type,
  compact = false,
}: {
  type:
    | "pc"
    | "hub"
    | "switch"
    | "router"
    | "laptop"
    | "server"
    | "printer"
    | "ipphone"
    | "tablet"
    | "smartphone"
    | "wireless"
    | "security"
    | "cloud";
  compact?: boolean;
}) {
  const uid = useUid("pt_dev_" + type);
  const scale = compact ? 0.56 : 1;

  if (type === "router") {
    return (
      <g transform={`scale(${scale})`}>
        {/* Soft drop shadow */}
        <ellipse cx="1" cy="14" rx="26" ry="10.5" fill="rgba(15, 23, 42, 0.16)" />
        <defs>
          <linearGradient id={uid + "_cyl"} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#12476B" />
            <stop offset="36%" stopColor="#2680B5" />
            <stop offset="72%" stopColor="#185D8A" />
            <stop offset="100%" stopColor="#0E3854" />
          </linearGradient>
          <linearGradient id={uid + "_top"} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5EB1DF" />
            <stop offset="100%" stopColor="#1D6FA3" />
          </linearGradient>
        </defs>
        {/* Classic Cisco PT Blue-Teal Router cylinder puck (~48x30) */}
        <path
          d="M-24 -3.5 L-24 7.5 A24 10 0 0 0 24 7.5 L24 -3.5 Z"
          fill={`url(#${uid}_cyl)`}
          stroke="#0C2E47"
          strokeWidth="1.15"
        />
        <ellipse cx="0" cy="-3.5" rx="24" ry="10" fill={`url(#${uid}_top)`} stroke="#0C2E47" strokeWidth="1.15" />
        {/* 4 Crisp white Cisco routing arrows (2 pointing inward, 2 pointing outward) */}
        <path d="M-12 -7.2 L-3.8 -4.4 M-6.8 -3.5 L-3.5 -4.3 L-5.1 -6.8" fill="none" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 0.8 L3.8 -2.0 M6.8 -2.9 L3.5 -2.1 L5.1 0.4" fill="none" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M-3 -1.8 L-11.2 1.0 M-8.2 1.8 L-11.6 1.1 L-10.0 -1.4" fill="none" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 -4.6 L11.2 -7.4 M8.2 -8.2 L11.6 -7.5 L10.0 -5.0" fill="none" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }

  if (type === "switch") {
    return (
      <g transform={`scale(${scale})`}>
        <polygon points="-29,10 8,17 32,5 -6,-2" fill="rgba(15, 23, 42, 0.14)" />
        <polygon points="-29,-2 5,-11 30,-2 -4,8" fill="#2b7fb8" stroke="#103652" strokeWidth="1.1" strokeLinejoin="round" />
        <polygon points="-29,-2 -4,8 -4,17 -29,7" fill="#1d5f91" stroke="#103652" strokeWidth="1.1" strokeLinejoin="round" />
        <polygon points="-4,8 30,-2 30,7 -4,17" fill="#164970" stroke="#103652" strokeWidth="1.1" strokeLinejoin="round" />
        {/* Dark front port strip with green LEDs */}
        <polygon points="-26,2.5 -7,10 -7,14.2 -26,6.7" fill="#0B1F30" />
        <circle cx="-23.5" cy="5.2" r="0.95" fill="#22C55E" />
        <circle cx="-20.2" cy="6.6" r="0.95" fill="#22C55E" />
        <circle cx="-16.9" cy="8.0" r="0.95" fill="#22C55E" />
        <circle cx="-13.6" cy="9.4" r="0.95" fill="#22C55E" />
        {/* 4 Opposing crossing white Cisco switch arrows on top */}
        <path d="M-11 -4.5 L2 -7.5 M-0.8 -8.5 L2.5 -7.5 L0.4 -5.3" fill="none" stroke="#FFFFFF" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 -4.8 L-1 -1.8 M1.8 -0.8 L-1.5 -1.8 L0.6 -4.0" fill="none" stroke="#FFFFFF" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M-6 0.2 L7 -2.8 M4.2 -3.8 L7.5 -2.8 L5.4 -0.6" fill="none" stroke="#FFFFFF" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 -0.2 L2 2.8 M4.8 3.8 L1.5 2.8 L3.6 0.6" fill="none" stroke="#FFFFFF" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }

  if (type === "hub") {
    return (
      <g transform={`scale(${scale})`}>
        <polygon points="-32,11 8,19 35,6 -6,-2" fill="rgba(15, 23, 42, 0.14)" />
        {/* Top isometric plate (Silver / Steel Blue Hub) */}
        <polygon points="-32,-2 6,-12 33,-2 -5,8" fill="#8EA7BE" stroke="#394B5C" strokeWidth="1.15" strokeLinejoin="round" />
        <polygon points="-32,-2 -5,8 -5,18 -32,8" fill="#5D748B" stroke="#394B5C" strokeWidth="1.15" strokeLinejoin="round" />
        <polygon points="-5,8 33,-2 33,8 -5,18" fill="#46596C" stroke="#394B5C" strokeWidth="1.15" strokeLinejoin="round" />
        {/* RJ45 Ports along front-left */}
        {[-28, -23, -18, -13].map((px, idx) => (
          <rect key={px} x={px} y={3 + idx * 1.9} width="3.2" height="3.2" fill="#1E293B" />
        ))}
        {/* Single bidirectional white repeater arrow across top */}
        <path d="M-14 -1 L15 -4.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M-10.5 -3.6 L-15 -0.9 L-10 1.1 M11.5 -6.8 L16 -4.6 L12 -1.9" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }

  if (type === "laptop") {
    return (
      <g transform={`scale(${scale})`}>
        <rect x="-16" y="-16" width="30" height="20" rx="1" fill="#B8C7D6" stroke="#334155" strokeWidth="1.2" />
        <rect x="-13" y="-13" width="24" height="14" fill="#5B9FD9" />
        <polygon points="-16,4 14,4 22,15 -22,15" fill="#DCE4EC" stroke="#334155" strokeWidth="1.2" />
      </g>
    );
  }

  if (type === "server") {
    return (
      <g transform={`scale(${scale})`}>
        <ellipse cx="0" cy="22" rx="18" ry="6" fill="rgba(15, 23, 42, 0.14)" />
        <polygon points="-13,-22 -3,-27 13,-22 3,-17" fill="#CFDCE8" stroke="#334155" strokeWidth="1.1" />
        <rect x="-13" y="-22" width="16" height="40" rx="1" fill="#A9BCCF" stroke="#334155" strokeWidth="1.1" />
        <polygon points="3,-17 13,-22 13,13 3,18" fill="#7D93A8" stroke="#334155" strokeWidth="1.1" />
        <rect x="-10" y="-17" width="10" height="3.5" fill="#1E293B" />
        <rect x="-10" y="-11" width="10" height="3.5" fill="#1E293B" />
        <circle cx="-1" cy="11" r="1.6" fill="#22C55E" />
      </g>
    );
  }

  if (type === "printer") {
    return (
      <g transform={`scale(${scale})`}>
        <rect x="-14" y="-20" width="28" height="12" fill="#FFFFFF" stroke="#475569" strokeWidth="1.1" />
        <rect x="-21" y="-10" width="42" height="22" rx="2" fill="#D5DEE7" stroke="#334155" strokeWidth="1.2" />
        <rect x="-15" y="-5" width="30" height="10" fill="#64748B" />
        <rect x="-11" y="7" width="22" height="10" fill="#F8FAFC" stroke="#475569" strokeWidth="1" />
        <circle cx="14" cy="-5" r="1.6" fill="#22C55E" />
      </g>
    );
  }

  if (type === "ipphone") {
    return (
      <g transform={`scale(${scale})`}>
        <rect x="-20" y="-14" width="40" height="28" rx="3" fill="#475569" stroke="#1E293B" strokeWidth="1.2" />
        <rect x="-17" y="-10" width="10" height="22" rx="3" fill="#1E293B" stroke="#94A3B8" strokeWidth="0.9" />
        <rect x="-3" y="-10" width="19" height="10" rx="1" fill="#BAE6FD" stroke="#0284C7" strokeWidth="0.9" />
        <rect x="-3" y="3" width="19" height="8" fill="#CBD5E1" />
      </g>
    );
  }

  if (type === "tablet") {
    return (
      <g transform={`scale(${scale})`}>
        <rect x="-16" y="-20" width="32" height="40" rx="3" fill="#334155" stroke="#0F172A" strokeWidth="1.2" />
        <rect x="-13" y="-16" width="26" height="30" rx="1" fill="#60A5FA" />
        <circle cx="0" cy="17" r="1.4" fill="#94A3B8" />
      </g>
    );
  }

  if (type === "smartphone") {
    return (
      <g transform={`scale(${scale})`}>
        <rect x="-10" y="-20" width="20" height="40" rx="3" fill="#1E293B" stroke="#0F172A" strokeWidth="1.2" />
        <rect x="-8" y="-16" width="16" height="29" rx="1" fill="#38BDF8" />
        <circle cx="0" cy="16.5" r="1.2" fill="#94A3B8" />
      </g>
    );
  }

  if (type === "wireless") {
    return (
      <g transform={`scale(${scale})`}>
        <line x1="-15" y1="-4" x2="-18" y2="-22" stroke="#1E293B" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="15" y1="-4" x2="18" y2="-22" stroke="#1E293B" strokeWidth="2.4" strokeLinecap="round" />
        <polygon points="-24,0 24,0 28,12 -28,12" fill="#2563EB" stroke="#1E3A8A" strokeWidth="1.1" />
        <rect x="-28" y="8" width="56" height="9" rx="1" fill="#1E3A8A" stroke="#0F172A" strokeWidth="1" />
        {[-16, -9, -2, 5, 12].map((lx) => (
          <circle key={lx} cx={lx} cy="12.5" r="1.3" fill="#22C55E" />
        ))}
      </g>
    );
  }

  if (type === "security") {
    return (
      <g transform={`scale(${scale})`}>
        <rect x="-24" y="-12" width="48" height="24" rx="1.5" fill="#991B1B" stroke="#450A0A" strokeWidth="1.2" />
        <path d="M-24 -4h48M-24 4h48M-8 -12v8M8 -12v8M-16 -4v8M0 -4v8M16 -4v8M-8 4v8M8 4v8" stroke="#FCA5A5" strokeWidth="1" opacity="0.65" />
        <path d="M0 -8 C4 -2, 6 2, 0 8 C-6 2, -4 -2, 0 -8 Z" fill="#FBBF24" stroke="#78350F" strokeWidth="0.9" />
      </g>
    );
  }

  if (type === "cloud") {
    return (
      <g transform={`scale(${scale})`}>
        <path d="M-20 12 A10 10 0 0 1 -22 -7 A12 12 0 0 1 2 -16 A11 11 0 0 1 22 -4 A9 9 0 0 1 20 12 Z" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1.5" />
        <text y="3" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0369A1">WAN</text>
      </g>
    );
  }

  // Default: Classic Cisco PT Beige/Light-Grey Monitor + Desktop Chassis + Keyboard
  return (
    <g transform={`scale(${scale})`}>
      <defs>
        <linearGradient id={uid + "_scr"} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#85C7F2" />
          <stop offset="100%" stopColor="#2A6BAC" />
        </linearGradient>
      </defs>
      <ellipse cx="0" cy="21" rx="26" ry="7" fill="rgba(15, 23, 42, 0.14)" />
      {/* Desktop CPU base (warm light beige-grey) */}
      <polygon points="-22,6 22,6 26,13 -26,13" fill="#DDDCD5" stroke="#475569" strokeWidth="1.1" strokeLinejoin="round" />
      <rect x="-24" y="10" width="48" height="6" fill="#C4C3BC" stroke="#475569" strokeWidth="1" />
      <rect x="6" y="11.5" width="13" height="2" fill="#52525B" />
      <circle cx="-18" cy="13" r="1.2" fill="#22C55E" />
      {/* Monitor neck */}
      <rect x="-5" y="2" width="10" height="5" fill="#9E9E97" stroke="#475569" strokeWidth="0.9" />
      {/* Monitor bezel */}
      <rect x="-21" y="-23" width="42" height="26" rx="2" fill="#EAE9E4" stroke="#475569" strokeWidth="1.2" />
      {/* Blue display screen */}
      <rect x="-17.5" y="-19.5" width="35" height="19" rx="1" fill={`url(#${uid}_scr)`} stroke="#234E78" strokeWidth="0.9" />
      {/* Subtle screen glare */}
      <polygon points="-16,-18 -4,-18 -14,-5 -16,-5" fill="#FFFFFF" fillOpacity="0.22" />
      {/* Angled Keyboard */}
      <polygon points="-19,17 19,17 23,22 -23,22" fill="#E6E6DF" stroke="#475569" strokeWidth="1" strokeLinejoin="round" />
    </g>
  );
}

/* =========================================================================
 * Simulation Mode Colored Packet Envelope Icon
 * ========================================================================= */

export function PtPacketEnvelope({ color = "#E8890C", label }: { color?: string; label?: string }) {
  return (
    <g>
      <rect x="-13" y="-9" width="26" height="18" rx="1.5" fill={color} stroke="#1E293B" strokeWidth="1.2" />
      <path d="M-13 -8.5 L0 2 L13 -8.5" fill="none" stroke="#FFFFFF" strokeWidth="1.3" />
      {label ? (
        <text y="6.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#FFFFFF">
          {label}
        </text>
      ) : null}
    </g>
  );
}

/* =========================================================================
 * Cable Preview Icons (for Bottom Connections Shelf)
 * ========================================================================= */

export function PtCableShelfIcon({
  kind,
}: {
  kind: "auto" | "console" | "straight" | "cross" | "fiber" | "phone" | "coaxial" | "serial" | "serial-dce" | "serial-dte";
}) {
  if (kind === "auto") {
    return (
      <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true">
        <path d="M14 2L6 11h6l-1 7 9-10h-6z" fill="#F59E0B" stroke="#92400E" strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "console") {
    return (
      <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true">
        <path d="M3 16 C8 5, 18 15, 23 4" fill="none" stroke="#0EA5E9" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "cross") {
    return (
      <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true">
        <line x1="3" y1="16" x2="23" y2="4" stroke="#1E293B" strokeWidth="2.4" strokeDasharray="4 3" />
      </svg>
    );
  }
  if (kind === "fiber") {
    return (
      <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true">
        <line x1="3" y1="15" x2="23" y2="5" stroke="#EA580C" strokeWidth="2.6" />
        <circle cx="4" cy="14.5" r="2" fill="#FDBA74" stroke="#9A3412" strokeWidth="0.8" />
        <circle cx="22" cy="5.5" r="2" fill="#FDBA74" stroke="#9A3412" strokeWidth="0.8" />
      </svg>
    );
  }
  if (kind === "phone") {
    return (
      <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true">
        <line x1="3" y1="15" x2="23" y2="5" stroke="#16A34A" strokeWidth="2.4" />
      </svg>
    );
  }
  if (kind === "coaxial") {
    return (
      <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true">
        <line x1="3" y1="15" x2="23" y2="5" stroke="#2563EB" strokeWidth="2.8" />
        <line x1="3" y1="15" x2="23" y2="5" stroke="#BAE6FD" strokeWidth="0.9" />
      </svg>
    );
  }
  if (kind === "serial" || kind === "serial-dce" || kind === "serial-dte") {
    return (
      <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true">
        <path d="M3 15 L11 8 L15 12 L23 5" fill="none" stroke="#DC2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {kind === "serial-dce" ? <circle cx="13" cy="10" r="2.2" fill="#FEF08A" stroke="#DC2626" strokeWidth="0.8" /> : null}
      </svg>
    );
  }
  return (
    <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true">
      <line x1="3" y1="16" x2="23" y2="4" stroke="#1E293B" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/* =========================================================================
 * Secondary Common Tools Bar & Simulation Icons (PT 8.2.2)
 * ========================================================================= */

export function PtDrawLineIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <line x1="3" y1="14.5" x2="15" y2="3.5" stroke="#1E293B" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="2" y="13.5" width="2.5" height="2.5" fill="#2563EB" />
      <rect x="13.5" y="2" width="2.5" height="2.5" fill="#2563EB" />
    </svg>
  );
}

export function PtDrawRectIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <rect x="2.5" y="4" width="13" height="10" rx="1" fill="#DBEAFE" stroke="#1D4ED8" strokeWidth="1.4" />
    </svg>
  );
}

export function PtDrawEllipseIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <ellipse cx="9" cy="9" rx="6.5" ry="4.8" fill="#FEF3C7" stroke="#D97706" strokeWidth="1.4" />
    </svg>
  );
}

export function PtCustomDeviceIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <rect x="3" y="4" width="12" height="10" rx="1.5" fill="#E2E8F0" stroke="#475569" strokeWidth="1.2" />
      <path d="M6 9h6M9 6v6" stroke="#16A34A" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function PtViewportIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <rect x="2.5" y="3" width="13" height="12" rx="1" fill="#FFFFFF" stroke="#475569" strokeWidth="1.1" />
      <rect x="4.5" y="5" width="6" height="5" fill="#BAE6FD" stroke="#0284C7" strokeWidth="0.9" />
      <circle cx="12.5" cy="11.5" r="2.2" fill="#E2E8F0" stroke="#475569" strokeWidth="0.9" />
    </svg>
  );
}

export function PtEyeIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M1.5 8s2.5-4 6.5-4 6.5 4 6.5 4-2.5 4-6.5 4-6.5-4-6.5-4z"
        fill="#EFF6FF"
        stroke="#1E40AF"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2.1" fill="#2563EB" />
      <circle cx="8.6" cy="7.4" r="0.6" fill="#FFFFFF" />
    </svg>
  );
}

/* =========================================================================
 * Authentic Colorful Desktop Tab App Icons (34x34 SVG)
 * ========================================================================= */

export function PtAppIpConfigIcon({ size = 34 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <rect x="4" y="5" width="28" height="24" rx="3" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1.5" />
      <rect x="4" y="5" width="28" height="6" rx="2" fill="#0284C7" />
      <text x="18" y="21" textAnchor="middle" fontSize="11" fontWeight="800" fill="#0369A1">IP</text>
      <circle cx="10" cy="25" r="1.4" fill="#16A34A" />
      <rect x="14" y="24" width="14" height="2" rx="1" fill="#38BDF8" />
    </svg>
  );
}

export function PtAppCmdIcon({ size = 34 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <rect x="4" y="6" width="28" height="24" rx="2.5" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
      <rect x="4" y="6" width="28" height="5" rx="1.5" fill="#CBD5E1" />
      <text x="10" y="22" fontSize="10" fontFamily="Consolas, monospace" fontWeight="700" fill="#22C55E">C:\&gt;_</text>
    </svg>
  );
}

export function PtAppTerminalIcon({ size = 34 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <rect x="4" y="6" width="28" height="24" rx="2.5" fill="#1E293B" stroke="#475569" strokeWidth="1.5" />
      <rect x="4" y="6" width="28" height="5" rx="1.5" fill="#38BDF8" />
      <text x="9" y="21" fontSize="9.5" fontFamily="Consolas, monospace" fontWeight="700" fill="#F8FAFC">RS232</text>
      <line x1="9" y1="25" x2="22" y2="25" stroke="#0EA5E9" strokeWidth="1.6" />
    </svg>
  );
}

export function PtAppBrowserIcon({ size = 34 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="13" fill="#38BDF8" stroke="#0369A1" strokeWidth="1.5" />
      <ellipse cx="18" cy="18" rx="6.5" ry="13" fill="none" stroke="#FFFFFF" strokeWidth="1.3" />
      <line x1="5" y1="18" x2="31" y2="18" stroke="#FFFFFF" strokeWidth="1.3" />
      <path d="M7.5 11.5h21M7.5 24.5h21" stroke="#FFFFFF" strokeWidth="1.1" />
    </svg>
  );
}

export function PtAppWirelessIcon({ size = 34 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <rect x="4" y="6" width="28" height="24" rx="3" fill="#FEF3C7" stroke="#D97706" strokeWidth="1.4" />
      <path d="M10 17a11.3 11.3 0 0 1 16 0" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" />
      <path d="M13.5 20.5a6.4 6.4 0 0 1 9 0" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="24.5" r="2" fill="#16A34A" />
    </svg>
  );
}

/** Authentic Cisco red lightning-bolt zigzag path for Serial WAN cables. */
export function serialZigzagPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const step = Math.min(14, Math.max(8, len * 0.08));
  const amp = 7;
  const p1x = mx - ux * step + px * amp;
  const p1y = my - uy * step + py * amp;
  const p2x = mx + ux * step - px * amp;
  const p2y = my + uy * step - py * amp;
  return `M ${x1} ${y1} L ${mx - ux * step * 1.4} ${my - uy * step * 1.4} L ${p1x} ${p1y} L ${p2x} ${p2y} L ${mx + ux * step * 1.4} ${my + uy * step * 1.4} L ${x2} ${y2}`;
}
