"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import type { DatasetModel, TableRelationship } from "@/lib/powerbi/types";
import { Modal } from "./Modal";

interface RelationshipsModalProps {
  open: boolean;
  tables: DatasetModel[];
  relationships: TableRelationship[];
  onClose: () => void;
  onAddRelationship: (rel: Omit<TableRelationship, "id">) => void;
  onToggleActive: (id: string) => void;
  onDeleteRelationship: (id: string) => void;
  onAutoDetect: () => void;
}

/** Dialog to create, toggle, auto-detect, and remove semantic model relationships across tables. */
export function RelationshipsModal({
  open,
  tables,
  relationships,
  onClose,
  onAddRelationship,
  onToggleActive,
  onDeleteRelationship,
  onAutoDetect,
}: RelationshipsModalProps) {
  const [fromTableId, setFromTableId] = useState("");
  const [fromColumn, setFromColumn] = useState("");
  const [toTableId, setToTableId] = useState("");
  const [toColumn, setToColumn] = useState("");
  const [cardinality, setCardinality] = useState<TableRelationship["cardinality"]>("many-to-one");

  useEffect(() => {
    if (!open || tables.length < 2) return;
    const id0 = tables[0].id || tables[0].name;
    const id1 = tables[1].id || tables[1].name;
    setFromTableId(id0);
    setFromColumn(tables[0].columns[0]?.name || "");
    setToTableId(id1);
    setToColumn(tables[1].columns[0]?.name || "");
  }, [open, tables]);

  const fromTbl = tables.find((t) => (t.id || t.name) === fromTableId);
  const toTbl = tables.find((t) => (t.id || t.name) === toTableId);

  const tableLabel = (id: string) =>
    tables.find((t) => (t.id || t.name) === id)?.name || id;

  return (
    <Modal
      open={open}
      title="Manage Relationships"
      onClose={onClose}
      width={620}
      footer={
        <button
          type="button"
          onClick={onClose}
          style={{
            height: 28,
            padding: "0 14px",
            border: 0,
            background: "#117865",
            color: "#ffffff",
            fontWeight: 600,
            borderRadius: 2,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#605e5c" }}>
            Active relationships propagate slicer and cross-filters across related tables.
          </span>
          <button
            type="button"
            disabled={tables.length < 2}
            onClick={onAutoDetect}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 26,
              padding: "0 10px",
              border: "1px solid #c8c6c4",
              background: "#faf9f8",
              borderRadius: 2,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: tables.length < 2 ? "default" : "pointer",
            }}
          >
            <Sparkles size={12} color="#117865" /> Auto-detect
          </button>
        </div>

        <div style={{ border: "1px solid #e1dfdd", borderRadius: 3, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead>
              <tr style={{ background: "#f3f2f1", borderBottom: "1px solid #e1dfdd", textAlign: "left" }}>
                <th style={{ padding: "5px 8px" }}>Active</th>
                <th style={{ padding: "5px 8px" }}>From (Table.Column)</th>
                <th style={{ padding: "5px 8px" }}>To (Table.Column)</th>
                <th style={{ padding: "5px 8px" }}>Cardinality</th>
                <th style={{ padding: "5px 8px" }}></th>
              </tr>
            </thead>
            <tbody>
              {relationships.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 12, textAlign: "center", color: "#797775" }}>
                    No relationships yet. Load 2+ tables and click Auto-detect or add one below.
                  </td>
                </tr>
              ) : (
                relationships.map((rel) => (
                  <tr key={rel.id} style={{ borderBottom: "1px solid #f3f2f1" }}>
                    <td style={{ padding: "5px 8px" }}>
                      <input
                        type="checkbox"
                        checked={rel.active}
                        onChange={() => onToggleActive(rel.id)}
                        style={{ accentColor: "#117865" }}
                      />
                    </td>
                    <td style={{ padding: "5px 8px" }}>
                      {tableLabel(rel.fromTableId)}.<strong>{rel.fromColumn}</strong>
                    </td>
                    <td style={{ padding: "5px 8px" }}>
                      {tableLabel(rel.toTableId)}.<strong>{rel.toColumn}</strong>
                    </td>
                    <td style={{ padding: "5px 8px" }}>{rel.cardinality}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right" }}>
                      <button
                        type="button"
                        aria-label="Delete relationship"
                        onClick={() => onDeleteRelationship(rel.id)}
                        style={{ border: 0, background: "transparent", color: "#a4262c", cursor: "pointer" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {tables.length >= 2 ? (
          <div style={{ padding: 10, background: "#faf9f8", border: "1px solid #e1dfdd", borderRadius: 3, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600 }}>Create New Relationship</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <select
                aria-label="From table"
                value={fromTableId}
                onChange={(e) => {
                  const id = e.target.value;
                  setFromTableId(id);
                  const t = tables.find((x) => (x.id || x.name) === id);
                  setFromColumn(t?.columns[0]?.name || "");
                }}
                style={{ height: 26, border: "1px solid #c8c6c4", borderRadius: 2, fontSize: 11.5 }}
              >
                {tables.map((t) => (
                  <option key={t.id || t.name} value={t.id || t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="From column"
                value={fromColumn}
                onChange={(e) => setFromColumn(e.target.value)}
                style={{ height: 26, border: "1px solid #c8c6c4", borderRadius: 2, fontSize: 11.5 }}
              >
                {fromTbl?.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="To table"
                value={toTableId}
                onChange={(e) => {
                  const id = e.target.value;
                  setToTableId(id);
                  const t = tables.find((x) => (x.id || x.name) === id);
                  setToColumn(t?.columns[0]?.name || "");
                }}
                style={{ height: 26, border: "1px solid #c8c6c4", borderRadius: 2, fontSize: 11.5 }}
              >
                {tables.map((t) => (
                  <option key={t.id || t.name} value={t.id || t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="To column"
                value={toColumn}
                onChange={(e) => setToColumn(e.target.value)}
                style={{ height: 26, border: "1px solid #c8c6c4", borderRadius: 2, fontSize: 11.5 }}
              >
                {toTbl?.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <select
                aria-label="Cardinality"
                value={cardinality}
                onChange={(e) => setCardinality(e.target.value as TableRelationship["cardinality"])}
                style={{ height: 26, border: "1px solid #c8c6c4", borderRadius: 2, fontSize: 11.5 }}
              >
                <option value="many-to-one">Many to one (*:1)</option>
                <option value="one-to-one">One to one (1:1)</option>
                <option value="one-to-many">One to many (1:*)</option>
              </select>
              <button
                type="button"
                disabled={!fromTableId || !toTableId || fromTableId === toTableId || !fromColumn || !toColumn}
                onClick={() =>
                  onAddRelationship({
                    fromTableId,
                    fromColumn,
                    toTableId,
                    toColumn,
                    cardinality,
                    active: true,
                  })
                }
                style={{
                  height: 26,
                  padding: "0 12px",
                  border: 0,
                  background: "#117865",
                  color: "#ffffff",
                  fontWeight: 600,
                  borderRadius: 2,
                  fontSize: 11.5,
                  cursor: fromTableId === toTableId ? "default" : "pointer",
                  opacity: fromTableId === toTableId ? 0.5 : 1,
                }}
              >
                Add Relationship
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
