"use client";

import React, { useMemo, useState } from "react";
import { Play } from "lucide-react";
import { aggregateKpi, formatPowerBiNumber } from "@/lib/powerbi/csvEngine";
import type { DatasetModel } from "@/lib/powerbi/types";

interface DaxTmdlViewProps {
  mode: "dax" | "tmdl";
  dataset: DatasetModel;
}

/** Authentic read/run semantic preview for Power BI Desktop's DAX query view & TMDL view. */
export function DaxTmdlView({ mode, dataset }: DaxTmdlViewProps) {
  const numericCols = dataset.columns.filter((c) => c.isNumeric).slice(0, 4);
  const dimCol = dataset.columns.find((c) => !c.isNumeric)?.name || dataset.columns[0]?.name || "Category";

  const generatedDax = useMemo(() => {
    const measures = numericCols
      .map((c) => `  "Total ${c.label}", SUM('${dataset.name}'[${c.name}])`)
      .join(",\n");
    return `// Auto-generated DAX Query for ${dataset.name}\nEVALUATE\nSUMMARIZECOLUMNS(\n  '${dataset.name}'[${dimCol}],\n${measures || `  "Row Count", COUNTROWS('${dataset.name}')`}\n)\nORDER BY '${dataset.name}'[${dimCol}] ASC`;
  }, [dataset.name, dimCol, numericCols]);

  const generatedTmdl = useMemo(() => {
    const colLines = dataset.columns
      .map(
        (c) =>
          `\tcolumn ${c.name}\n\t\tdataType: ${c.isNumeric ? "double" : c.type === "date" ? "dateTime" : "string"}\n\t\tsummarizeBy: ${c.isNumeric ? "sum" : "none"}\n\t\tsourceColumn: ${c.name}`,
      )
      .join("\n\n");
    return `table ${dataset.name}\n\tlineageTag: pbi-${dataset.name.toLowerCase()}\n\n${colLines}\n\n\tpartition ${dataset.name} = m\n\t\tmode: import\n\t\tsource =\n\t\t\tCsv.Document(File.Contents("${dataset.fileName}"))`;
  }, [dataset.columns, dataset.fileName, dataset.name]);

  const [queryText, setQueryText] = useState(generatedDax);
  const [ranCount, setRanCount] = useState(1);

  if (mode === "tmdl") {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          padding: 16,
          overflow: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 10,
            borderBottom: "1px solid #e1dfdd",
            marginBottom: 12,
          }}
        >
          <div>
            <strong style={{ fontSize: 13 }}>TMDL Semantic Model Script</strong>
            <span style={{ marginLeft: 10, fontSize: 11.5, color: "#605e5c" }}>
              {dataset.name} ({dataset.columns.length} columns)
            </span>
          </div>
        </div>
        <pre
          style={{
            margin: 0,
            padding: 14,
            background: "#faf9f8",
            border: "1px solid #e1dfdd",
            borderRadius: 4,
            fontFamily: "Consolas, 'Courier New', monospace",
            fontSize: 12,
            lineHeight: 1.55,
            color: "#252423",
            overflowX: "auto",
            userSelect: "text",
          }}
        >
          {generatedTmdl}
        </pre>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#ffffff", minHeight: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 14px",
          background: "#f3f2f1",
          borderBottom: "1px solid #e1dfdd",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={() => setRanCount((c) => c + 1)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 26,
              padding: "0 12px",
              borderRadius: 3,
              border: 0,
              background: "#117865",
              color: "#ffffff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Play size={12} fill="#ffffff" />
            <span>Run</span>
          </button>
          <span style={{ fontSize: 11.5, color: "#605e5c" }}>
            Query 1 · Executed ({ranCount}) · {dataset.rows.length} source rows
          </span>
        </div>
      </div>

      <textarea
        aria-label="DAX query editor"
        value={queryText}
        onChange={(e) => setQueryText(e.target.value)}
        style={{
          height: 170,
          padding: 12,
          border: 0,
          borderBottom: "1px solid #e1dfdd",
          fontFamily: "Consolas, 'Courier New', monospace",
          fontSize: 12.5,
          lineHeight: 1.5,
          color: "#252423",
          resize: "none",
          outline: "none",
        }}
      />

      <div style={{ flex: 1, overflow: "auto", padding: 12, background: "#fafafa" }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 8, color: "#605e5c" }}>
          Results preview
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          {numericCols.map((col) => {
            const val = aggregateKpi(dataset.rows, col.name, "sum");
            return (
              <div
                key={col.name}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e1dfdd",
                  borderRadius: 4,
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: 11, color: "#605e5c" }}>Total {col.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#252423", marginTop: 4 }}>
                  {formatPowerBiNumber(val, col.name)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
