"use client";

import React from "react";

interface DateRangePickerProps {
  from: string;
  to: string;
  min?: string;
  max?: string;
  onChange: (next: { from: string; to: string }) => void;
  onClear?: () => void;
}

/** Compact Fluent date-range inputs modeled after Power BI Between Slicer controls. */
export function DateRangePicker({
  from,
  to,
  min,
  max,
  onChange,
  onClear,
}: DateRangePickerProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <input
        type="date"
        aria-label="Start date"
        value={from}
        min={min}
        max={to || max}
        onChange={(e) => onChange({ from: e.target.value, to })}
        style={{
          height: 24,
          padding: "0 6px",
          border: "1px solid #c8c6c4",
          borderRadius: 2,
          fontSize: 11,
          color: "#252423",
          background: "#ffffff",
        }}
      />
      <span style={{ fontSize: 11, color: "#605e5c" }}>to</span>
      <input
        type="date"
        aria-label="End date"
        value={to}
        min={from || min}
        max={max}
        onChange={(e) => onChange({ from, to: e.target.value })}
        style={{
          height: 24,
          padding: "0 6px",
          border: "1px solid #c8c6c4",
          borderRadius: 2,
          fontSize: 11,
          color: "#252423",
          background: "#ffffff",
        }}
      />
      {(from || to) && onClear ? (
        <button
          type="button"
          onClick={onClear}
          style={{
            height: 24,
            padding: "0 8px",
            border: "1px solid #c8c6c4",
            borderRadius: 2,
            background: "#f3f2f1",
            color: "#252423",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}
