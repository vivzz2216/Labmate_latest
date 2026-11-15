"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

/** Compact table pagination strip used inside Power BI Table View. */
export function Pagination({ page, pageSize, totalItems, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(totalItems, safePage * pageSize);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 12px",
        background: "#f3f2f1",
        borderTop: "1px solid #e1dfdd",
        fontSize: 11.5,
        color: "#605e5c",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span>
        Showing {start}–{end} of {totalItems.toLocaleString()} rows
      </span>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 24,
            padding: "0 7px",
            border: "1px solid #c8c6c4",
            borderRadius: 2,
            background: "#ffffff",
            color: "#252423",
            cursor: safePage <= 1 ? "default" : "pointer",
            opacity: safePage <= 1 ? 0.45 : 1,
          }}
        >
          <ChevronLeft size={13} />
        </button>
        <span>
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 24,
            padding: "0 7px",
            border: "1px solid #c8c6c4",
            borderRadius: 2,
            background: "#ffffff",
            color: "#252423",
            cursor: safePage >= totalPages ? "default" : "pointer",
            opacity: safePage >= totalPages ? 0.45 : 1,
          }}
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
