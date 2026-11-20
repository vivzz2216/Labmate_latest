"use client";

import React, { useRef, useState } from "react";
import { Calculator, Calendar, FunctionSquare, Link2, Sparkles, Table2 } from "lucide-react";
import type {
  DatasetModel,
  MeasureDef,
  TableRelationship,
} from "@/lib/powerbi/types";
import styles from "./powerbi.module.css";

interface ModelViewProps {
  tables: DatasetModel[];
  measures: MeasureDef[];
  relationships: TableRelationship[];
  onMoveTableCard: (tableId: string, pos: { x: number; y: number }) => void;
  onAutoDetectRelationships: () => void;
  onOpenManageRelationships: () => void;
}

const CARD_W = 280;
const CARD_H = 260;

/** Interactive Semantic Model diagram showing draggable table cards, SVG relationships & Properties panel. */
export function ModelView({
  tables,
  measures,
  relationships,
  onMoveTableCard,
  onAutoDetectRelationships,
  onOpenManageRelationships,
}: ModelViewProps) {
  const [selectedItem, setSelectedItem] = useState<{
    kind: "table" | "column";
    tableId: string;
    columnName?: string;
  } | null>(null);

  const dragRef = useRef<{
    tableId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const getPos = (t: DatasetModel, idx: number) =>
    t.modelPosition || { x: 40 + (idx % 3) * 340, y: 36 + Math.floor(idx / 3) * 300 };

  const activeSelectionTable =
    tables.find((t) => (t.id || t.name) === selectedItem?.tableId) || tables[0];
  const activeSelectionCol = activeSelectionTable?.columns.find(
    (c) => c.name === selectedItem?.columnName,
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div className={styles.modelToolbar}>
        <button
          type="button"
          className={styles.ribbonSmBtn}
          onClick={onOpenManageRelationships}
        >
          <Link2 size={13} color="#117865" /> Manage relationships ({relationships.length})
        </button>
        <button
          type="button"
          className={styles.ribbonSmBtn}
          onClick={onAutoDetectRelationships}
          disabled={tables.length < 2}
        >
          <Sparkles size={13} color="#117865" /> Auto-detect relationships
        </button>
        <span style={{ fontSize: 11, color: "#605e5c", marginLeft: "auto" }}>
          {tables.length} table(s) · Drag cards to arrange model
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div className={styles.modelCanvas}>
          {/* SVG Relationship Lines */}
          <svg
            width="100%"
            height="100%"
            style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 }}
          >
            {relationships.map((rel) => {
              const fromIdx = tables.findIndex((t) => (t.id || t.name) === rel.fromTableId);
              const toIdx = tables.findIndex((t) => (t.id || t.name) === rel.toTableId);
              if (fromIdx === -1 || toIdx === -1) return null;
              const p1 = getPos(tables[fromIdx], fromIdx);
              const p2 = getPos(tables[toIdx], toIdx);
              const c1 = p1.x + CARD_W / 2;
              const c2 = p2.x + CARD_W / 2;
              const p1LeftOfP2 = c1 <= c2;
              const x1 = p1LeftOfP2 ? p1.x + CARD_W : p1.x;
              const y1 = p1.y + 90;
              const x2 = p1LeftOfP2 ? p2.x : p2.x + CARD_W;
              const y2 = p2.y + 90;
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;
              const b1x = p1LeftOfP2 ? x1 + 14 : x1 - 14;
              const b2x = p1LeftOfP2 ? x2 - 14 : x2 + 14;

              return (
                <g key={rel.id}>
                  <path
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={rel.active ? "#117865" : "#a19f9d"}
                    strokeWidth={2}
                    strokeDasharray={rel.active ? undefined : "5 4"}
                  />
                  <circle cx={b1x} cy={y1} r={9} fill="#ffffff" stroke="#117865" />
                  <text
                    x={b1x}
                    y={y1 + 3.5}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontWeight={700}
                    fill="#117865"
                  >
                    {rel.cardinality === "one-to-one" ? "1" : "*"}
                  </text>
                  <circle cx={b2x} cy={y2} r={9} fill="#ffffff" stroke="#117865" />
                  <text
                    x={b2x}
                    y={y2 + 3.5}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontWeight={700}
                    fill="#117865"
                  >
                    1
                  </text>
                  <rect
                    x={midX - 42}
                    y={midY - 9}
                    width={84}
                    height={18}
                    rx={9}
                    fill="#ffffff"
                    stroke="#c8c6c4"
                  />
                  <text
                    x={midX}
                    y={midY + 3}
                    textAnchor="middle"
                    fontSize={9.5}
                    fill="#252423"
                    fontWeight={600}
                  >
                    {rel.fromColumn}
                  </text>
                </g>
              );
            })}
          </svg>

          {tables.map((table, idx) => {
            const tableId = table.id || table.name;
            const pos = getPos(table, idx);
            const tableMeasures = measures.filter((m) => m.tableId === tableId);

            return (
              <div
                key={tableId}
                style={{
                  position: "absolute",
                  left: pos.x,
                  top: pos.y,
                  width: CARD_W,
                  maxHeight: CARD_H + 60,
                  zIndex: 2,
                  background: "#ffffff",
                  border:
                    selectedItem?.tableId === tableId
                      ? "1.5px solid #117865"
                      : "1px solid #c8c6c4",
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
                    padding: "8px 10px",
                    background: "#f3f2f1",
                    borderBottom: "2px solid #117865",
                    cursor: "move",
                  }}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setSelectedItem({ kind: "table", tableId });
                    dragRef.current = {
                      tableId,
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: pos.x,
                      origY: pos.y,
                    };
                  }}
                  onPointerMove={(e) => {
                    const d = dragRef.current;
                    if (!d || d.tableId !== tableId) return;
                    onMoveTableCard(tableId, {
                      x: Math.max(12, Math.round(d.origX + (e.clientX - d.startX))),
                      y: Math.max(12, Math.round(d.origY + (e.clientY - d.startY))),
                    });
                  }}
                  onPointerUp={(e) => {
                    if (dragRef.current?.tableId === tableId) {
                      dragRef.current = null;
                      try {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      } catch {
                        // ignore
                      }
                    }
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                    <Table2 size={14} color="#117865" />
                    {table.name}
                  </span>
                  <span style={{ fontSize: 10.5, color: "#605e5c" }}>
                    {table.rows.length.toLocaleString()} rows
                  </span>
                </div>

                <div style={{ padding: "4px 0", maxHeight: 230, overflowY: "auto" }}>
                  {tableMeasures.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "4px 10px",
                        borderBottom: "1px solid #f3f2f1",
                        fontSize: 11.5,
                        background: "#faf9f8",
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                        <Calculator size={11} color="#117865" />
                        {m.name}
                      </span>
                      <span style={{ fontSize: 10, color: "#117865" }}>Measure</span>
                    </div>
                  ))}
                  {table.columns.map((col) => (
                    <div
                      key={col.name}
                      onClick={() => setSelectedItem({ kind: "column", tableId, columnName: col.name })}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "4px 10px",
                        borderBottom: "1px solid #f3f2f1",
                        fontSize: 11.5,
                        cursor: "pointer",
                        background:
                          selectedItem?.tableId === tableId &&
                          selectedItem?.columnName === col.name
                            ? "#e6f2ef"
                            : undefined,
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span className={styles.sigmaGlyph}>
                          {col.isCalculated ? (
                            <FunctionSquare size={11} color="#117865" />
                          ) : col.isNumeric ? (
                            "Σ"
                          ) : col.type === "date" ? (
                            <Calendar size={11} />
                          ) : null}
                        </span>
                        <span>{col.label}</span>
                      </span>
                      <span style={{ fontSize: 10, color: "#797775", textTransform: "capitalize" }}>
                        {col.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Properties Pane */}
        <aside className={styles.modelPropertiesPane} aria-label="Properties pane">
          <div className={styles.paneHeader}>
            <span>Properties</span>
          </div>
          <div className={styles.paneBodyScroll}>
            {activeSelectionCol ? (
              <div style={{ display: "grid", gap: 8, fontSize: 11.5 }}>
                <div>
                  <div style={{ fontSize: 10.5, color: "#605e5c" }}>Column Name</div>
                  <div style={{ fontWeight: 600 }}>{activeSelectionCol.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: "#605e5c" }}>Data Type</div>
                  <div style={{ textTransform: "capitalize" }}>{activeSelectionCol.type}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: "#605e5c" }}>Distinct Values</div>
                  <div>{activeSelectionCol.uniqueCount}</div>
                </div>
                {(activeSelectionCol.missingCount ?? 0) > 0 ? (
                  <div>
                    <div style={{ fontSize: 10.5, color: "#605e5c" }}>Missing Values</div>
                    <div style={{ color: "#ca6b14" }}>{activeSelectionCol.missingCount}</div>
                  </div>
                ) : null}
                {activeSelectionCol.formula ? (
                  <div>
                    <div style={{ fontSize: 10.5, color: "#605e5c" }}>Formula</div>
                    <code style={{ fontSize: 11, color: "#117865" }}>{activeSelectionCol.formula}</code>
                  </div>
                ) : null}
              </div>
            ) : activeSelectionTable ? (
              <div style={{ display: "grid", gap: 8, fontSize: 11.5 }}>
                <div>
                  <div style={{ fontSize: 10.5, color: "#605e5c" }}>Table</div>
                  <div style={{ fontWeight: 600 }}>{activeSelectionTable.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: "#605e5c" }}>Source File</div>
                  <div>{activeSelectionTable.fileName}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: "#605e5c" }}>Rows</div>
                  <div>{activeSelectionTable.rows.length.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: "#605e5c" }}>Columns</div>
                  <div>{activeSelectionTable.columns.length}</div>
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
