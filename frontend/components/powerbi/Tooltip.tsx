"use client";

import React from "react";

interface TooltipProps {
  visible: boolean;
  x: number;
  y: number;
  title: string;
  rows: Array<{ label: string; value: string; color?: string }>;
}

/** Crisp Power BI dark callout tooltip matching official desktop chart hover behavior. */
export function Tooltip({ visible, x, y, title, rows }: TooltipProps) {
  if (!visible) return null;

  return (
    <div
      role="tooltip"
      style={{
        position: "fixed",
        left: x + 12,
        top: y + 12,
        zIndex: 80,
        minWidth: 148,
        maxWidth: 240,
        padding: "7px 10px",
        background: "#252423",
        color: "#ffffff",
        borderRadius: 2,
        boxShadow: "0 2px 8px rgba(0,0,0,0.22)",
        pointerEvents: "none",
        fontSize: 11,
        lineHeight: 1.4,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.16)", paddingBottom: 3 }}>
        {title}
      </div>
      {rows.map((row) => (
        <div
          key={row.label}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginTop: 2,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#e1dfdd" }}>
            {row.color ? (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 99,
                  background: row.color,
                  display: "inline-block",
                }}
              />
            ) : null}
            {row.label}
          </span>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
