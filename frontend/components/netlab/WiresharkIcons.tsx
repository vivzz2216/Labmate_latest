"use client";

import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  active?: boolean;
}

/* =========================================================================
 * Official Wireshark 4.x App Icon & Welcome Fin
 * ========================================================================= */

export function WiresharkLogoIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="3" y="3" width="58" height="58" rx="10" fill="#2E74C0" stroke="#184C85" strokeWidth="2.5" />
      <path
        d="M8 47 L20 47 C22 30 30 16 45 12 C39 24 39 36 42 47 L56 47"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M20 47 C22 30 30 16 45 12 C39 24 39 36 42 47 Z" fill="#FFFFFF" fillOpacity="0.22" />
    </svg>
  );
}

/* =========================================================================
 * Official Wireshark 4.x Stock Toolbar Icons (resources/svg_icons/*.svg)
 * ========================================================================= */

/** Official capture-start.svg: #2960F6 (or #21DE08 when active) with #212121 outline */
export function WsCaptureStartIcon({ size = 18, className, active = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill={active ? "#21DE08" : "#2960F6"}
        d="M 3.7604729,21.101 C 3.0306203,21.101 2.7192167,20.672816 2.680291,20.293288 C 2.670551,20.079194 2.680291,19.553696 2.738678,19.096316 C 4.0913392,10.844022 10.426458,2.6890442 19.90481,3.0101831 C 20.235676,2.9907211 20.595737,3.1561552 20.858484,3.4480995 C 21.130962,3.7595069 21.267201,4.2168862 21.199081,4.6256083 C 21.169881,4.9370156 20.994722,5.2289599 20.76117,5.5890246 C 20.71251,5.6668766 20.66386,5.7349967 20.644394,5.7836541 C 18.892747,8.7614862 19.116569,14.094337 19.83669,17.782566 L 20.050779,18.580547 C 20.070239,18.658397 20.109169,18.745982 20.148089,18.833565 C 20.342716,19.32014 20.615195,20.001343 20.255133,20.565769 C 20.148089,20.740935 19.87561,21.042612 19.311191,21.081538 H 3.8285923 Z"
      />
      <path
        fill="#212121"
        d="M3.59,21.3c-.75,0-1.07-.44-1.11-.83-.01-.22,0-.76.06-1.23C3.93,10.76,10.44,2.38,20.18,2.71c.34-.02.71.15.98.45.28.32.42.79.35,1.21-.03.32-.21.62-.45.99-.05.08-.1.15-.12.2-1.8,3.06-1.57,8.54-.83,12.33l.22.82c.02.08.06.17.1.26.2.5.48,1.2.11,1.78-.11.18-.39.49-.97.53H3.66s-.04.01-.06.01ZM19.7,4.2c-8.67,0-14.42,7.59-15.68,15.24-.01.11-.02.24-.03.35h15.13c-.03-.1-.07-.19-.1-.26-.07-.17-.12-.31-.15-.43,0,.01,0,.02,0,.02,0,0-.06-.21-.13-.49l-.11-.43c-.79-4.05-1-9.98.98-13.35.01-.03.09-.16.19-.31.06-.09.16-.25.21-.34-.1,0-.21,0-.31,0Z"
      />
    </svg>
  );
}

/** Official capture-stop.svg: #DC0000 square with #212121 1.5px border */
export function WsCaptureStopIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="1.8" fill="#DC0000" stroke="#212121" strokeWidth="1.5" />
    </svg>
  );
}

/** Official capture-restart.svg: #212121 shark fin + inner circular restart loop */
export function WsCaptureRestartIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#212121"
        d="M3.59,21.3c-.75,0-1.07-.44-1.11-.83-.01-.22,0-.76.06-1.23C3.93,10.76,10.44,2.38,20.18,2.71c.34-.02.71.15.98.45.28.32.42.79.35,1.21-.03.32-.21.62-.45.99-.05.08-.1.15-.12.2-1.8,3.06-1.57,8.54-.83,12.33l.22.82c.02.08.06.17.1.26.2.5.48,1.2.11,1.78-.11.18-.39.49-.97.53H3.66s-.04.01-.06.01ZM19.7,4.2c-8.67,0-14.42,7.59-15.68,15.24-.01.11-.02.24-.03.35h15.13c-.03-.1-.07-.19-.1-.26-.07-.17-.12-.31-.15-.43l-.24-.9c-.79-4.05-1-9.98.98-13.35.06-.1.14-.22.21-.34-.1,0-.21,0-.31,0Z"
      />
      <path
        d="M16 12.2a3.8 3.8 0 1 1-2.5-3.6"
        fill="none"
        stroke="#2E9E44"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path d="M13.3 6.3 L16.3 8.9 L12.5 9.8 Z" fill="#2E9E44" />
    </svg>
  );
}

/** Capture options gear */
export function WsCaptureOptionsIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M10.4 2.5h3.2l.6 2.3a6.9 6.9 0 0 1 1.7.7l2-1.2 2.3 2.3-1.2 2c.3.5.5 1.1.7 1.7l2.3.6v3.2l-2.3.6a6.9 6.9 0 0 1-.7 1.7l1.2 2-2.3 2.3-2-1.2c-.5.3-1.1.5-1.7.7l-.6 2.3h-3.2l-.6-2.3a6.9 6.9 0 0 1-1.7-.7l-2 1.2-2.3-2.3 1.2-2a6.9 6.9 0 0 1-.7-1.7L2 13.6v-3.2l2.3-.6c.2-.6.4-1.2.7-1.7l-1.2-2 2.3-2.3 2 1.2c.5-.3 1.1-.5 1.7-.7z"
        fill="none"
        stroke="#212121"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.4" fill="none" stroke="#212121" strokeWidth="1.6" />
    </svg>
  );
}

/** Open capture file — Folder outline */
export function WsOpenFolderIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M2.5 5.5h6.2l2 2H20.5v11h-18z" fill="#E6B84D" stroke="#212121" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M4.2 10h17.3l-2.2 8.5H2.5z" fill="#F8D878" stroke="#212121" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

/** Save capture file */
export function WsSaveIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M3.5 3.5h13.5l3.5 3.5v13.5h-17z" fill="#4E72A5" stroke="#212121" strokeWidth="1.3" strokeLinejoin="round" />
      <rect x="7" y="3.5" width="8.5" height="6" fill="#DCE6F2" stroke="#212121" strokeWidth="1" />
      <rect x="6" y="12.5" width="12" height="7.5" fill="#FFFFFF" stroke="#212121" strokeWidth="1" />
    </svg>
  );
}

/** Close capture file */
export function WsCloseFileIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M5 3h9.5l4.5 4.5V20.5H5z" fill="#FFFFFF" stroke="#212121" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M14.5 3v4.5H19" fill="#DCE3EC" stroke="#212121" strokeWidth="1.1" />
      <circle cx="16.5" cy="16.5" r="4.8" fill="#DC0000" stroke="#212121" strokeWidth="1.1" />
      <path d="M14.6 14.6l3.8 3.8M18.4 14.6l-3.8 3.8" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Reload file */
export function WsReloadIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M19 10A7.5 7.5 0 0 0 6.2 7" fill="none" stroke="#212121" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19.8 5.2v5.4h-5.4z" fill="#212121" />
      <path d="M5 14A7.5 7.5 0 0 0 17.8 17" fill="none" stroke="#212121" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.2 18.8v-5.4h5.4z" fill="#212121" />
    </svg>
  );
}

/** Find a packet — clean monochrome #212121 lens */
export function WsFindIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="10.2" cy="10.2" r="5.8" fill="none" stroke="#212121" strokeWidth="1.8" />
      <path d="M14.5 14.5 L20 20" stroke="#212121" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}

/** Navigation Arrows — Wireshark 4.x #212121 outline arrows */
export function WsPrevPacketIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M18.5 12H6M11 7l-5.5 5 5.5 5" fill="none" stroke="#212121" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WsNextPacketIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M5.5 12H18M13 7l5.5 5-5.5 5" fill="none" stroke="#212121" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WsGoToPacketIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="#212121" strokeWidth="1.5" />
      <path d="M8 12h8M12.5 8.5L16 12l-3.5 3.5" fill="none" stroke="#212121" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WsFirstPacketIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <line x1="5" y1="5.5" x2="19" y2="5.5" stroke="#212121" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 19V8.5M7 13l5-5 5 5" fill="none" stroke="#212121" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WsLastPacketIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <line x1="5" y1="18.5" x2="19" y2="18.5" stroke="#212121" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 5v10.5M7 11l5 5 5-5" fill="none" stroke="#212121" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WsAutoScrollIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="4" y="3.5" width="12" height="17" rx="1.2" fill="none" stroke="#212121" strokeWidth="1.4" />
      <line x1="6.5" y1="7.5" x2="13.5" y2="7.5" stroke="#212121" strokeWidth="1.3" />
      <line x1="6.5" y1="11.5" x2="13.5" y2="11.5" stroke="#212121" strokeWidth="1.3" />
      <path d="M18.5 7v11M16 15.5l2.5 2.8 2.5-2.8" fill="none" stroke="#212121" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Official view-colorize.svg: 5 horizontal color bars (#212121, #EF2929, #538A2B, #C7B044, #212121) */
export function WsColorizeIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3" y="3.4" width="18" height="2.4" rx="0.6" fill="#212121" />
      <rect x="3" y="7.3" width="18" height="2.4" rx="0.6" fill="#EF2929" />
      <rect x="3" y="11.2" width="18" height="2.4" rx="0.6" fill="#538A2B" />
      <rect x="3" y="15.1" width="18" height="2.4" rx="0.6" fill="#C7B044" />
      <rect x="3" y="19.0" width="18" height="2.4" rx="0.6" fill="#212121" />
    </svg>
  );
}

/** Zoom In / Out / Reset (=) in Wireshark 4.x #212121 style */
export function WsZoomInIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="10.2" cy="10.2" r="6" fill="none" stroke="#212121" strokeWidth="1.7" />
      <path d="M14.8 14.8 L20 20" stroke="#212121" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M10.2 7.5v5.4M7.5 10.2h5.4" stroke="#212121" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function WsZoomOutIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="10.2" cy="10.2" r="6" fill="none" stroke="#212121" strokeWidth="1.7" />
      <path d="M14.8 14.8 L20 20" stroke="#212121" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M7.5 10.2h5.4" stroke="#212121" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Official zoom-reset.svg: '=' inside lens */
export function WsZoomResetIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="10.2" cy="10.2" r="6" fill="none" stroke="#212121" strokeWidth="1.7" />
      <path d="M14.8 14.8 L20 20" stroke="#212121" strokeWidth="2.3" strokeLinecap="round" />
      <line x1="7.5" y1="8.8" x2="12.9" y2="8.8" stroke="#212121" strokeWidth="1.7" strokeLinecap="round" />
      <line x1="7.5" y1="12" x2="12.9" y2="12" stroke="#212121" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function WsResizeColsIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <line x1="4.5" y1="4.5" x2="4.5" y2="19.5" stroke="#212121" strokeWidth="1.8" />
      <line x1="19.5" y1="4.5" x2="19.5" y2="19.5" stroke="#212121" strokeWidth="1.8" />
      <path d="M7.5 12h9M10 9.5L7.3 12l2.7 2.5M14 9.5l2.7 2.5-2.7 2.5" fill="none" stroke="#212121" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WsFollowStreamIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3.5" y="4" width="17" height="16" rx="1.5" fill="#FFFFFF" stroke="#212121" strokeWidth="1.3" />
      <line x1="6" y1="8" x2="18" y2="8" stroke="#800000" strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="12" x2="15" y2="12" stroke="#000080" strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="16" x2="17" y2="16" stroke="#800000" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function WsPacketDiagramIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="1.5" fill="#FFFFFF" stroke="#212121" strokeWidth="1.4" />
      <line x1="3" y1="9.5" x2="21" y2="9.5" stroke="#212121" strokeWidth="1.2" />
      <line x1="3" y1="14.5" x2="21" y2="14.5" stroke="#212121" strokeWidth="1.2" />
      <line x1="10" y1="4" x2="10" y2="9.5" stroke="#212121" strokeWidth="1.2" />
      <line x1="15" y1="9.5" x2="15" y2="14.5" stroke="#212121" strokeWidth="1.2" />
    </svg>
  );
}

/* =========================================================================
 * Official Display Filter Bar Icons (bookmark-display.svg, filter-clear.svg, filter-apply.svg)
 * ========================================================================= */

/** Official bookmark-display.svg: #4E72A5 steel-blue ribbon */
export function WsBookmarkIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4E72A5"
        d="M 6.19094,23.09045 C 5.6948,23.44745 5.00293,23.09285 5.00293,22.48165 V 4.625 C 5.00293,2.83007 6.458,1.375 8.25293,1.375 h 7.49837 c 1.7949,0 3.25,1.45507 3.25,3.25 v 17.85665 c 0,0.6112 -0.6919,0.9658 -1.188,0.6088 l -5.8112,-4.1809 z"
      />
    </svg>
  );
}

/** Official filter-clear.svg: #888A85 rounded square with white X cutout */
export function WsClearFilterIcon({ size = 15, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#888A85" />
      <path d="M7.5 7.5L16.5 16.5M16.5 7.5L7.5 16.5" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** Official filter-apply.svg (36x24): #4E72A5 rounded pill with white arrow */
export function WsApplyFilterArrowIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={Math.round((size * 24) / 36)} viewBox="0 0 36 24" className={className} aria-hidden="true">
      <rect x="1" y="1.5" width="34" height="21" rx="3.2" fill="#4E72A5" />
      <path d="M9 12h15.5M19 6.5L25.5 12 19 17.5" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WsInterfaceTypeIcon({ name }: { name: string }) {
  const low = name.toLowerCase();
  if (low.includes("wi-fi") || low.includes("wifi") || low.includes("wlan")) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2 6a8.5 8.5 0 0 1 12 0" fill="none" stroke="#1A73C8" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M4.2 8.5a5.5 5.5 0 0 1 7.6 0" fill="none" stroke="#1A73C8" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6.4 11a2.4 2.4 0 0 1 3.2 0" fill="none" stroke="#1A73C8" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="13.2" r="1.1" fill="#1A73C8" />
      </svg>
    );
  }
  if (low.includes("loopback")) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M12.5 7.5A4.5 4.5 0 1 0 9 12.4" fill="none" stroke="#4B6075" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12.8 4.2v3.8H9z" fill="#4B6075" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2.5" y="3" width="11" height="10" rx="1.2" fill="#DCE8F5" stroke="#365E8A" strokeWidth="1.1" />
      <rect x="5" y="5" width="6" height="4.5" fill="#1E4B7A" />
      <path d="M6.5 9.5v2M9.5 9.5v2" stroke="#E0A800" strokeWidth="1.1" />
    </svg>
  );
}

export function WsExpertStatusCircle({ level = "ok" }: { level?: "ok" | "warn" | "error" }) {
  const fill = level === "error" ? "#FF5C5C" : level === "warn" ? "#F7F253" : "#B7F774";
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6" r="5" fill={fill} stroke="#2B3440" strokeWidth="0.9" />
    </svg>
  );
}
