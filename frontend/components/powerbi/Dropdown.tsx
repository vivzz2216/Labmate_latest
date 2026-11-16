"use client";

import React from "react";

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  ariaLabel: string;
  value: string;
  options: DropdownOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  compact?: boolean;
}

/** Compact Fluent-style native select matching Power BI well and ribbon dropdowns. */
export function Dropdown({
  ariaLabel,
  value,
  options,
  placeholder = "Select field",
  onChange,
  compact = true,
}: DropdownProps) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        height: compact ? 24 : 28,
        padding: "0 6px",
        border: "1px solid #c8c6c4",
        borderRadius: 2,
        background: "#ffffff",
        color: value ? "#252423" : "#797775",
        fontSize: 11.5,
        cursor: "pointer",
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
