import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

/**
 * Custom SVG replica of Windows `mysqlcommandlineshell.ico`:
 * Classic blue Windows console frame (#0067CD / #214F9D / #77C0EA) with orange
 * close-dot accent, #000000 inner screen, and crisp #FFFFFF bitmap `MySQL` lettering.
 */
export function MysqlCmdWindowIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer classic Windows XP/7/10 blue console frame */}
      <rect
        x="1"
        y="2"
        width="22"
        height="20"
        rx="1.5"
        fill="#0067CD"
        stroke="#214F9D"
        strokeWidth="1.2"
      />
      {/* Top specular frame highlight */}
      <line x1="2.2" y1="2.8" x2="21.8" y2="2.8" stroke="#77C0EA" strokeWidth="1" />
      {/* Mini window caption bar buttons (light blue + orange close dot) */}
      <rect x="14.5" y="3.8" width="2" height="1.8" rx="0.3" fill="#77C0EA" />
      <rect x="17.2" y="3.8" width="2" height="1.8" rx="0.3" fill="#77C0EA" />
      <rect x="19.9" y="3.8" width="2.2" height="1.8" rx="0.3" fill="#F29111" />
      {/* Pitch-black #000000 inner console screen */}
      <rect x="2.4" y="6.8" width="19.2" height="13.8" fill="#000000" stroke="#214F9D" strokeWidth="0.6" />
      {/* Crisp white bitmap "MySQL" lettering */}
      {/* M */}
      <path
        d="M3.7 16.5V10.5L5.2 13.4L6.7 10.5V16.5"
        stroke="#FFFFFF"
        strokeWidth="1.15"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      {/* y */}
      <path
        d="M8.1 12.2L9.2 14.8M10.3 12.2L8.6 16.9"
        stroke="#FFFFFF"
        strokeWidth="1.1"
        strokeLinecap="square"
      />
      {/* S */}
      <path
        d="M13.6 11.2H11.7V13.4H13.6V16.2H11.5"
        stroke="#FFFFFF"
        strokeWidth="1.1"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      {/* Q */}
      <rect x="15.0" y="11.1" width="2.3" height="5.1" stroke="#FFFFFF" strokeWidth="1.1" />
      <line x1="16.5" y1="15.1" x2="17.8" y2="16.8" stroke="#FFFFFF" strokeWidth="1.1" strokeLinecap="square" />
      {/* L */}
      <path
        d="M19.0 10.6V16.2H20.8"
        stroke="#FFFFFF"
        strokeWidth="1.1"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

/** Official Oracle MySQL Sakila dolphin emblem (#00758F teal + #F29111 orange) for menus/properties. */
export function MysqlDolphinIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3.5 17.5C4.8 12.2 8.4 6.5 14.2 5.2C16.6 4.7 18.6 5.4 19.6 6.8C18.3 7.0 17.0 7.9 16.4 9.0C17.8 9.6 19.0 10.7 20.1 12.1C18.0 11.9 16.1 12.6 14.8 14.0C12.9 15.9 12.7 18.3 13.7 20.8C11.8 20.0 10.2 18.5 9.5 16.7C7.8 17.7 5.8 18.1 3.5 17.5Z"
        fill="#00758F"
      />
      <path
        d="M8.8 7.8C10.2 5.9 12.8 4.4 15.7 4.3C14.1 2.9 11.8 2.8 10.0 4.1C9.0 4.9 8.6 6.3 8.8 7.8Z"
        fill="#F29111"
      />
      <circle cx="15.0" cy="8.1" r="0.85" fill="#FFFFFF" />
    </svg>
  );
}

/** Crisp Windows 10/11 Minimize caption glyph */
export function WinMinimizeIcon({ className }: { className?: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      className={className}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** Crisp Windows 10/11 Maximize caption glyph */
export function WinMaximizeIcon({ className }: { className?: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      className={className}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** Crisp Windows 10/11 Restore Down caption glyph */
export function WinRestoreIcon({ className }: { className?: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      className={className}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="0.5" y="2.5" width="7" height="7" stroke="currentColor" strokeWidth="1" />
      <polyline points="2.5,2.5 2.5,0.5 9.5,0.5 9.5,7.5 7.5,7.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** Crisp Windows 10/11 Close caption glyph */
export function WinCloseIcon({ className }: { className?: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.05" />
      <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.05" />
    </svg>
  );
}
