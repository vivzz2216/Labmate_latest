"use client";

import React, { useState } from "react";
import { Eraser, Trash2 } from "lucide-react";
import type { ColumnType, DatasetModel } from "@/lib/powerbi/types";
import { FILTER_OPS, describeTableStep } from "@/lib/powerbi/tableSteps";
import type { FilterOp, TableStep } from "@/lib/powerbi/tableSteps";
import { DataTable } from "./DataTable";
import { Modal } from "./Modal";

interface TransformDataModalProps {
  open: boolean;
  tables: DatasetModel[];
  activeTableId: string;
  recordedSteps?: string[];
  onClose: () => void;
  onRenameColumn: (tableId: string, oldName: string, newName: string) => void;
  onChangeColumnType: (tableId: string, colName: string, type: ColumnType) => void;
  onRemoveColumn: (tableId: string, colName: string) => void;
  onCleanMissing: (
    tableId: string,
    colName: string,
    strategy: "drop" | "fillZero" | "fillAverage" | "fillText",
  ) => void;
  /** Filter, sort, remove duplicates, replace values, keep top rows. Returns the reason when the step cannot be applied. */
  onApplyStep?: (tableId: string, step: TableStep) => string | undefined;
}

/** Simplified Power Query Transform Data Editor: rename columns, set types, clean missing values & preview. */
export function TransformDataModal({
  open,
  tables,
  activeTableId,
  recordedSteps,
  onClose,
  onRenameColumn,
  onChangeColumnType,
  onRemoveColumn,
  onCleanMissing,
  onApplyStep,
}: TransformDataModalProps) {
  const [selectedTableId, setSelectedTableId] = useState(activeTableId);
  const [appliedSteps, setAppliedSteps] = useState<string[]>(["Source", "Changed Type"]);
  const [renameValues, setRenameValues] = useState<Record<string, string>>({});

  const table =
    tables.find((t) => (t.id || t.name) === selectedTableId) || tables[0];
  const tableId = table ? table.id || table.name : "";

  const pushStep = (desc: string) => setAppliedSteps((prev) => [...prev, desc]);

  // Row transformations
  const [stepKind, setStepKind] = useState<TableStep["kind"]>("filterRows");
  const [stepColumn, setStepColumn] = useState("");
  const [stepOp, setStepOp] = useState<FilterOp>("equals");
  const [stepValue, setStepValue] = useState("");
  const [stepValue2, setStepValue2] = useState("");
  const [stepDesc, setStepDesc] = useState(false);
  const [stepError, setStepError] = useState("");
  const stepColumnName = table?.columns.some((c) => c.name === stepColumn) ? stepColumn : table?.columns[0]?.name || "";

  const applyRowStep = () => {
    if (!onApplyStep || !table) return;
    let step: TableStep;
    if (stepKind === "filterRows") step = { kind: "filterRows", column: stepColumnName, op: stepOp, value: stepValue };
    else if (stepKind === "sortRows") step = { kind: "sortRows", column: stepColumnName, desc: stepDesc };
    else if (stepKind === "replaceValues") step = { kind: "replaceValues", column: stepColumnName, find: stepValue, replace: stepValue2 };
    else if (stepKind === "keepTopRows") step = { kind: "keepTopRows", count: Number(stepValue) };
    else step = { kind: "removeDuplicates" };
    const problem = onApplyStep(tableId, step);
    setStepError(problem ?? "");
    if (!problem) pushStep(describeTableStep(step));
  };
  const needsColumn = stepKind !== "removeDuplicates" && stepKind !== "keepTopRows";
  const fieldStyle: React.CSSProperties = { height: 26, padding: "0 6px", border: "1px solid #c8c6c4", borderRadius: 2, fontSize: 11.5, background: "#ffffff" };

  return (
    <Modal
      open={open}
      title={`Power Query Editor — ${table?.name || "Dataset"}`}
      onClose={onClose}
      width={780}
      footer={
        <button
          type="button"
          onClick={onClose}
          style={{
            height: 28,
            padding: "0 16px",
            border: 0,
            background: "#117865",
            color: "#ffffff",
            fontWeight: 600,
            borderRadius: 2,
            cursor: "pointer",
          }}
        >
          Close &amp; Apply
        </button>
      }
    >
      {table ? (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 12, color: "#605e5c" }}>
              <strong>{table.rows.length.toLocaleString()}</strong> rows ×{" "}
              <strong>{table.columns.length}</strong> columns
              {(table.missingCount ?? 0) > 0 ? (
                <span style={{ color: "#ca6b14", marginLeft: 8 }}>
                  ({table.missingCount} blank/missing cells)
                </span>
              ) : null}
            </div>

            {tables.length > 1 ? (
              <select
                aria-label="Select query table"
                value={tableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                style={{
                  height: 26,
                  padding: "0 8px",
                  border: "1px solid #c8c6c4",
                  borderRadius: 2,
                  fontSize: 11.5,
                }}
              >
                {tables.map((t) => (
                  <option key={t.id || t.name} value={t.id || t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 190px", gap: 10 }}>
            <div
              style={{
                border: "1px solid #e1dfdd",
                borderRadius: 3,
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                <thead>
                  <tr style={{ background: "#f3f2f1", borderBottom: "1px solid #e1dfdd", textAlign: "left" }}>
                    <th style={{ padding: "5px 8px" }}>Column Name</th>
                    <th style={{ padding: "5px 8px" }}>Type</th>
                    <th style={{ padding: "5px 8px" }}>Missing</th>
                    <th style={{ padding: "5px 8px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {table.columns.map((col) => {
                    const draft = renameValues[col.name] ?? col.name;
                    return (
                      <tr key={col.name} style={{ borderBottom: "1px solid #f3f2f1" }}>
                        <td style={{ padding: "4px 8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              type="text"
                              aria-label={`Column name for ${col.name}`}
                              value={draft}
                              onChange={(e) =>
                                setRenameValues((p) => ({ ...p, [col.name]: e.target.value }))
                              }
                              style={{
                                width: 125,
                                height: 22,
                                padding: "0 6px",
                                border: "1px solid #c8c6c4",
                                borderRadius: 2,
                                fontSize: 11,
                              }}
                            />
                            {draft !== col.name && draft.trim() ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onRenameColumn(tableId, col.name, draft);
                                  pushStep(`Renamed "${col.name}" -> "${draft.trim()}"`);
                                }}
                                style={{
                                  height: 22,
                                  padding: "0 6px",
                                  border: 0,
                                  background: "#117865",
                                  color: "#ffffff",
                                  borderRadius: 2,
                                  fontSize: 10.5,
                                  cursor: "pointer",
                                }}
                              >
                                OK
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <select
                            aria-label={`Data type for ${col.name}`}
                            value={col.type}
                            onChange={(e) => {
                              const nextType = e.target.value as ColumnType;
                              onChangeColumnType(tableId, col.name, nextType);
                              pushStep(`Changed Type (${col.name} -> ${nextType})`);
                            }}
                            style={{
                              height: 22,
                              border: "1px solid #c8c6c4",
                              borderRadius: 2,
                              fontSize: 11,
                              background: "#ffffff",
                            }}
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                          </select>
                        </td>
                        <td style={{ padding: "4px 8px", color: (col.missingCount ?? 0) > 0 ? "#ca6b14" : "#605e5c" }}>
                          {col.missingCount ?? 0}
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            {(col.missingCount ?? 0) > 0 ? (
                              <>
                                <button
                                  type="button"
                                  title={col.isNumeric ? "Fill missing with average" : "Fill missing with Unknown"}
                                  onClick={() => {
                                    const strat = col.isNumeric ? "fillAverage" : "fillText";
                                    onCleanMissing(tableId, col.name, strat);
                                    pushStep(`Filled blanks in ${col.name}`);
                                  }}
                                  style={{
                                    height: 22,
                                    padding: "0 6px",
                                    border: "1px solid #c8c6c4",
                                    background: "#faf9f8",
                                    borderRadius: 2,
                                    fontSize: 10.5,
                                    cursor: "pointer",
                                  }}
                                >
                                  <Eraser size={10} style={{ display: "inline", marginRight: 2 }} />
                                  Fill
                                </button>
                                <button
                                  type="button"
                                  title="Drop rows with blank values in this column"
                                  onClick={() => {
                                    onCleanMissing(tableId, col.name, "drop");
                                    pushStep(`Removed blank rows (${col.name})`);
                                  }}
                                  style={{
                                    height: 22,
                                    padding: "0 6px",
                                    border: "1px solid #c8c6c4",
                                    background: "#faf9f8",
                                    borderRadius: 2,
                                    fontSize: 10.5,
                                    cursor: "pointer",
                                  }}
                                >
                                  Drop
                                </button>
                              </>
                            ) : null}
                            {table.columns.length > 1 ? (
                              <button
                                type="button"
                                title={`Remove column ${col.name}`}
                                aria-label={`Remove column ${col.name}`}
                                onClick={() => {
                                  onRemoveColumn(tableId, col.name);
                                  pushStep(`Removed Column (${col.name})`);
                                }}
                                style={{
                                  height: 22,
                                  width: 22,
                                  border: 0,
                                  background: "transparent",
                                  color: "#a4262c",
                                  cursor: "pointer",
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              style={{
                border: "1px solid #e1dfdd",
                borderRadius: 3,
                padding: 8,
                background: "#faf9f8",
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: "#252423" }}>
                APPLIED STEPS
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                {(recordedSteps || appliedSteps).map((step, i) => (
                  <div
                    key={`${step}-${i}`}
                    style={{
                      padding: "4px 6px",
                      fontSize: 11,
                      background: "#ffffff",
                      border: "1px solid #e1dfdd",
                      borderRadius: 2,
                    }}
                  >
                    {i + 1}. {step}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {onApplyStep && !recordedSteps ? (
            <div
              role="group"
              aria-label="Transform rows"
              style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, padding: 8, border: "1px solid #e1dfdd", borderRadius: 3, background: "#faf9f8" }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: "#252423" }}>TRANSFORM ROWS</span>
              <select aria-label="Transform step" value={stepKind} onChange={(e) => setStepKind(e.target.value as TableStep["kind"])} style={fieldStyle}>
                <option value="filterRows">Filter rows</option>
                <option value="sortRows">Sort rows</option>
                <option value="removeDuplicates">Remove duplicates</option>
                <option value="replaceValues">Replace values</option>
                <option value="keepTopRows">Keep top rows</option>
              </select>
              {needsColumn ? (
                <select aria-label="Step column" value={stepColumnName} onChange={(e) => setStepColumn(e.target.value)} style={fieldStyle}>
                  {table.columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {stepKind === "filterRows" ? (
                <select aria-label="Filter condition" value={stepOp} onChange={(e) => setStepOp(e.target.value as FilterOp)} style={fieldStyle}>
                  {FILTER_OPS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : null}
              {stepKind === "sortRows" ? (
                <select aria-label="Sort direction" value={stepDesc ? "desc" : "asc"} onChange={(e) => setStepDesc(e.target.value === "desc")} style={fieldStyle}>
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              ) : null}
              {(stepKind === "filterRows" && stepOp !== "notBlank") || stepKind === "replaceValues" || stepKind === "keepTopRows" ? (
                <input
                  aria-label={stepKind === "replaceValues" ? "Value to find" : stepKind === "keepTopRows" ? "Number of rows" : "Filter value"}
                  value={stepValue}
                  onChange={(e) => setStepValue(e.target.value)}
                  placeholder={stepKind === "replaceValues" ? "Find" : stepKind === "keepTopRows" ? "Rows" : "Value"}
                  style={{ ...fieldStyle, width: 110 }}
                />
              ) : null}
              {stepKind === "replaceValues" ? (
                <input aria-label="Replace with" value={stepValue2} onChange={(e) => setStepValue2(e.target.value)} placeholder="Replace with" style={{ ...fieldStyle, width: 110 }} />
              ) : null}
              <button
                type="button"
                onClick={applyRowStep}
                style={{ height: 26, padding: "0 12px", border: "1px solid #117865", background: "#117865", color: "#ffffff", fontWeight: 600, borderRadius: 2, cursor: "pointer", fontSize: 11.5 }}
              >
                Apply step
              </button>
              {stepError ? (
                <span role="alert" style={{ fontSize: 11.5, color: "#a4262c" }}>
                  {stepError}
                </span>
              ) : null}
            </div>
          ) : null}

          <DataTable columns={table.columns} rows={table.rows.slice(0, 10)} compact pageSize={10} />
        </div>
      ) : null}
    </Modal>
  );
}
