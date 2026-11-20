"use client";

import React, { useEffect, useMemo, useState } from "react";
import { validateFormula } from "@/lib/powerbi/formulaEngine";
import type { DatasetModel, MeasureDef } from "@/lib/powerbi/types";
import { Modal } from "./Modal";

interface FormulaModalProps {
  open: boolean;
  mode: "column" | "measure";
  tables: DatasetModel[];
  initialTableId: string;
  measures: MeasureDef[];
  onClose: () => void;
  onSaveColumn: (tableId: string, name: string, formula: string) => string | undefined;
  onSaveMeasure: (tableId: string, name: string, formula: string) => void;
}

const COLUMN_TEMPLATES = [
  { label: "Subtract", snippet: "[revenue] - [cost]" },
  { label: "IF", snippet: 'IF([total_score] >= 75, "Distinction", "Pass")' },
  { label: "DIVIDE", snippet: "DIVIDE([profit], [revenue], 0)" },
  { label: "ROUND", snippet: "ROUND([margin_rate], 1)" },
  { label: "COALESCE", snippet: 'COALESCE([category], "Other")' },
];

const MEASURE_TEMPLATES = [
  { label: "SUM", snippet: "SUM([revenue])" },
  { label: "AVERAGE", snippet: "AVERAGE([engagement_rate])" },
  { label: "DIVIDE", snippet: "DIVIDE(SUM([profit]), SUM([revenue]), 0)" },
  { label: "COUNTROWS", snippet: "COUNTROWS()" },
  { label: "DISTINCTCOUNT", snippet: "DISTINCTCOUNT([platform])" },
];

/** Guided Calculated Column / Measure builder dialog with live validation & column chips. */
export function FormulaModal({
  open,
  mode,
  tables,
  initialTableId,
  measures,
  onClose,
  onSaveColumn,
  onSaveMeasure,
}: FormulaModalProps) {
  const [tableId, setTableId] = useState(initialTableId);
  const [name, setName] = useState("");
  const [formula, setFormula] = useState("");
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const activeTable = useMemo(
    () => tables.find((t) => (t.id || t.name) === tableId) || tables[0],
    [tables, tableId],
  );

  useEffect(() => {
    if (!open) return;
    setTableId(initialTableId || (tables[0] ? tables[0].id || tables[0].name : ""));
    setSubmitErr(null);
    const tbl = tables.find((t) => (t.id || t.name) === initialTableId) || tables[0];
    const firstNum = tbl?.columns.find((c) => c.isNumeric)?.name;
    const secondNum = tbl?.columns.filter((c) => c.isNumeric)[1]?.name;
    if (mode === "measure") {
      setName(firstNum ? `Total ${firstNum}` : "Row Count");
      setFormula(firstNum ? `SUM([${firstNum}])` : "COUNTROWS()");
    } else {
      setName(firstNum && secondNum ? `${firstNum}_minus_${secondNum}` : "custom_column");
      setFormula(
        firstNum && secondNum
          ? `[${firstNum}] - [${secondNum}]`
          : firstNum
            ? `ROUND([${firstNum}] * 1.1, 2)`
            : "1",
      );
    }
  }, [open, mode, initialTableId, tables]);

  const check = useMemo(() => {
    if (!open || !activeTable) return { ok: false, error: "" };
    return validateFormula(formula, mode, activeTable.rows, activeTable.columns, measures);
  }, [open, activeTable, formula, mode, measures]);

  const handleSave = () => {
    if (!activeTable) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSubmitErr("Please enter a valid name.");
      return;
    }
    if (!check.ok) {
      setSubmitErr(check.error || "Fix the formula error before saving.");
      return;
    }
    const targetId = activeTable.id || activeTable.name;
    if (mode === "column") {
      const err = onSaveColumn(targetId, trimmedName, formula);
      if (err) {
        setSubmitErr(err);
        return;
      }
    } else {
      onSaveMeasure(targetId, trimmedName, formula);
    }
    onClose();
  };

  const templates = mode === "measure" ? MEASURE_TEMPLATES : COLUMN_TEMPLATES;

  return (
    <Modal
      open={open}
      title={mode === "measure" ? "New Measure" : "New Calculated Column"}
      onClose={onClose}
      width={600}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 28,
              padding: "0 12px",
              border: "1px solid #c8c6c4",
              background: "#ffffff",
              borderRadius: 2,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
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
            {mode === "measure" ? "Create Measure" : "Add Column"}
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
              {mode === "measure" ? "Measure Name" : "Column Name"}
            </label>
            <input
              type="text"
              aria-label="Formula item name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSubmitErr(null);
              }}
              style={{
                width: "100%",
                height: 28,
                padding: "0 8px",
                border: "1px solid #c8c6c4",
                borderRadius: 2,
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
              Table
            </label>
            <select
              aria-label="Target table"
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              style={{
                width: "100%",
                height: 28,
                padding: "0 8px",
                border: "1px solid #c8c6c4",
                borderRadius: 2,
                background: "#ffffff",
              }}
            >
              {tables.map((t) => (
                <option key={t.id || t.name} value={t.id || t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
            Formula (fx)
          </label>
          <textarea
            rows={3}
            aria-label="Formula expression"
            value={formula}
            onChange={(e) => {
              setFormula(e.target.value);
              setSubmitErr(null);
            }}
            style={{
              width: "100%",
              padding: 8,
              border: "1px solid #c8c6c4",
              borderRadius: 2,
              fontFamily: "Consolas, monospace",
              fontSize: 12,
            }}
          />
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: check.ok ? "#117865" : "#a4262c",
              minHeight: 16,
            }}
          >
            {submitErr || (check.ok ? `✓ Valid — ${check.preview}` : check.error)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#605e5c", marginBottom: 4 }}>
            Insert Column Reference
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {activeTable?.columns.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setFormula((f) => `${f}${f && !f.endsWith(" ") && !f.endsWith("(") ? " " : ""}[${c.name}]`)}
                style={{
                  padding: "2px 7px",
                  fontSize: 11,
                  border: "1px solid #d2d0ce",
                  borderRadius: 2,
                  background: "#faf9f8",
                  cursor: "pointer",
                }}
              >
                [{c.name}]
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#605e5c", marginBottom: 4 }}>
            Quick Function Examples
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {templates.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setFormula(t.snippet)}
                style={{
                  padding: "2px 8px",
                  fontSize: 11,
                  border: "1px solid #c8c6c4",
                  borderRadius: 2,
                  background: "#ffffff",
                  color: "#117865",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
