"use client";

import React from "react";
import { Calendar, Table2 } from "lucide-react";
import type { DatasetModel } from "@/lib/powerbi/types";
import styles from "./powerbi.module.css";

interface ModelViewProps {
  dataset: DatasetModel;
}

/** Semantic Model view showing the uploaded table schema card & column data types. */
export function ModelView({ dataset }: ModelViewProps) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        padding: 36,
        background: "#eaeaea",
        backgroundImage: "radial-gradient(#c8c6c4 1px, transparent 1px)",
        backgroundSize: "18px 18px",
        overflow: "auto",
      }}
    >
      <div
        style={{
          width: 310,
          background: "#ffffff",
          border: "1px solid #117865",
          borderRadius: 4,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "9px 12px",
            background: "#f3f2f1",
            borderBottom: "2px solid #117865",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
            <Table2 size={14} color="#117865" />
            {dataset.name}
          </span>
          <span style={{ fontSize: 10.5, color: "#605e5c" }}>
            {dataset.rows.length.toLocaleString()} rows
          </span>
        </div>

        <div style={{ padding: "6px 0", maxHeight: 420, overflowY: "auto" }}>
          {dataset.columns.map((col) => (
            <div
              key={col.name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "5px 12px",
                borderBottom: "1px solid #f3f2f1",
                fontSize: 11.5,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className={styles.sigmaGlyph}>
                  {col.isNumeric ? "Σ" : col.type === "date" ? <Calendar size={11} /> : null}
                </span>
                <span>{col.label}</span>
              </span>
              <span style={{ fontSize: 10.5, color: "#797775", textTransform: "capitalize" }}>
                {col.type} ({col.uniqueCount})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
