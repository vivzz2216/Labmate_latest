"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FILTER_OPS, applyQuerySteps, describeStep } from "@/lib/powerbi/powerQuery";
import type { FilterOp, QueryStep } from "@/lib/powerbi/powerQuery";
import type { DatasetModel } from "@/lib/powerbi/types";
import { DataTable } from "./DataTable";
import { Modal } from "./Modal";

type StepKind = QueryStep["kind"];

const KINDS: { id: StepKind; label: string }[] = [
  { id: "removeColumns", label: "Remove columns" },
  { id: "renameColumn", label: "Rename column" },
  { id: "filterRows", label: "Filter rows" },
  { id: "removeDuplicates", label: "Remove duplicates" },
  { id: "removeBlankRows", label: "Remove blank rows" },
  { id: "changeType", label: "Change type" },
  { id: "sortRows", label: "Sort rows" },
  { id: "replaceValues", label: "Replace values" },
  { id: "keepTopRows", label: "Keep top rows" },
];

interface PowerQueryEditorProps {
  open: boolean;
  source: DatasetModel | null;
  steps: QueryStep[];
  onClose: () => void;
  onApply: (steps: QueryStep[]) => void;
}

const field: React.CSSProperties = { height: 28, border: "1px solid #c8c6c4", borderRadius: 3, padding: "0 6px", fontSize: 12, background: "#fff" };
const btn: React.CSSProperties = { height: 28, padding: "0 12px", border: "1px solid #c8c6c4", borderRadius: 3, background: "#fff", cursor: "pointer", fontSize: 12 };

export function PowerQueryEditor({ open, source, steps, onClose, onApply }: PowerQueryEditorProps) {
  const [draft, setDraft] = useState<QueryStep[]>(steps);
  const [kind, setKind] = useState<StepKind>("filterRows");
  const [column, setColumn] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [text2, setText2] = useState("");
  const [op, setOp] = useState<FilterOp>("equals");
  const [type, setType] = useState<"number" | "text">("number");
  const [desc, setDesc] = useState(false);

  useEffect(() => {
    if (open) setDraft(steps);
  }, [open, steps]);

  const result = useMemo(() => (source ? applyQuerySteps(source, draft) : null), [source, draft]);
  // columns available at the end of the current steps
  const current = useMemo(() => (result ? result.dataset.columns.map((c) => c.name) : []), [result]);

  useEffect(() => {
    if (current.length && current.indexOf(column) < 0) setColumn(current[0]);
  }, [current, column]);

  if (!source || !result) return null;

  const needsColumn = kind !== "removeDuplicates" && kind !== "removeBlankRows" && kind !== "keepTopRows" && kind !== "removeColumns";

  const buildStep = (): QueryStep | null => {
    switch (kind) {
      case "removeColumns":
        return columns.length ? { kind, columns } : null;
      case "renameColumn":
        return text.trim() ? { kind, from: column, to: text.trim() } : null;
      case "filterRows":
        return op === "notBlank" || text !== "" ? { kind, column, op, value: text } : null;
      case "removeDuplicates":
      case "removeBlankRows":
        return { kind };
      case "changeType":
        return { kind, column, type };
      case "sortRows":
        return { kind, column, desc };
      case "replaceValues":
        return text !== "" ? { kind, column, find: text, replace: text2 } : null;
      case "keepTopRows": {
        const n = Number(text);
        return text.trim() !== "" && n >= 0 && Math.floor(n) === n ? { kind, count: n } : null;
      }
      default:
        return null;
    }
  };

  const addStep = () => {
    const step = buildStep();
    if (!step) return;
    setDraft((prev) => prev.concat([step]));
    setText("");
    setText2("");
    setColumns([]);
  };

  return (
    <Modal open={open} title={`Power Query Editor — ${source.name}`} onClose={onClose} width={980}>
      <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 12, fontSize: 12.5 }} data-testid="power-query-editor">
        <div style={{ border: "1px solid #e1dfdd", borderRadius: 3, background: "#faf9f8", padding: 8, alignSelf: "start" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Applied Steps</div>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }} aria-label="Applied steps">
            <li style={{ padding: "4px 6px", background: "#fff", border: "1px solid #e1dfdd", borderRadius: 3 }}>Source ({source.rows.length} rows)</li>
            {draft.map((s, i) => (
              <li
                key={i}
                style={{
                  padding: "4px 6px", background: result.error && result.error.stepIndex === i ? "#fde7e9" : "#fff",
                  border: "1px solid " + (result.error && result.error.stepIndex === i ? "#d13438" : "#e1dfdd"), borderRadius: 3,
                  display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center",
                }}
              >
                <span style={{ wordBreak: "break-word" }}>{describeStep(s)}</span>
                <button type="button" aria-label={`Delete step ${i + 1}`} title="Delete step" onClick={() => setDraft((prev) => prev.filter((_, k) => k !== i))} style={{ border: 0, background: "transparent", cursor: "pointer", color: "#a4262c", fontSize: 14 }}>
                  ✕
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: 8, border: "1px solid #e1dfdd", borderRadius: 3, background: "#faf9f8" }}>
            <select aria-label="Transformation" value={kind} onChange={(e) => setKind(e.target.value as StepKind)} style={field}>
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            {needsColumn && (
              <select aria-label="Column" value={column} onChange={(e) => setColumn(e.target.value)} style={field}>
                {current.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
            {kind === "removeColumns" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} aria-label="Columns to remove">
                {current.map((c) => (
                  <label key={c} style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
                    <input type="checkbox" checked={columns.indexOf(c) >= 0} onChange={(e) => setColumns((prev) => (e.target.checked ? prev.concat([c]) : prev.filter((x) => x !== c)))} />
                    {c}
                  </label>
                ))}
              </div>
            )}
            {kind === "filterRows" && (
              <>
                <select aria-label="Operator" value={op} onChange={(e) => setOp(e.target.value as FilterOp)} style={field}>
                  {FILTER_OPS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {op !== "notBlank" && <input aria-label="Value" placeholder="Value" value={text} onChange={(e) => setText(e.target.value)} style={field} />}
              </>
            )}
            {kind === "renameColumn" && <input aria-label="New name" placeholder="New column name" value={text} onChange={(e) => setText(e.target.value)} style={field} />}
            {kind === "changeType" && (
              <select aria-label="Data type" value={type} onChange={(e) => setType(e.target.value as "number" | "text")} style={field}>
                <option value="number">Decimal number</option>
                <option value="text">Text</option>
              </select>
            )}
            {kind === "sortRows" && (
              <select aria-label="Sort order" value={desc ? "desc" : "asc"} onChange={(e) => setDesc(e.target.value === "desc")} style={field}>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            )}
            {kind === "replaceValues" && (
              <>
                <input aria-label="Value to find" placeholder="Value to find" value={text} onChange={(e) => setText(e.target.value)} style={field} />
                <input aria-label="Replace with" placeholder="Replace with" value={text2} onChange={(e) => setText2(e.target.value)} style={field} />
              </>
            )}
            {kind === "keepTopRows" && <input aria-label="Number of rows" placeholder="Number of rows" value={text} onChange={(e) => setText(e.target.value)} style={{ ...field, width: 120 }} />}
            <button type="button" onClick={addStep} style={{ ...btn, background: "#117865", color: "#fff", borderColor: "#117865" }}>
              Add step
            </button>
          </div>

          {result.error && (
            <div role="alert" style={{ padding: "6px 10px", background: "#fde7e9", border: "1px solid #d13438", borderRadius: 3, color: "#a4262c" }}>
              Expression.Error in step {result.error.stepIndex + 1}: {result.error.message} Delete the step to continue.
            </div>
          )}

          <div style={{ color: "#605e5c" }}>
            <strong>{result.dataset.rows.length.toLocaleString()}</strong> rows × <strong>{result.dataset.columns.length}</strong> columns after the applied steps
            {result.dataset.rows.length !== source.rows.length ? ` (source has ${source.rows.length.toLocaleString()})` : ""}.
          </div>
          <div style={{ overflow: "auto", maxHeight: 280 }}>
            <DataTable columns={result.dataset.columns} rows={result.dataset.rows} compact pageSize={8} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={onClose} style={btn}>
              Discard
            </button>
            <button
              type="button"
              disabled={!!result.error}
              onClick={() => onApply(draft)}
              style={{ ...btn, background: result.error ? "#c8c6c4" : "#117865", color: "#fff", borderColor: result.error ? "#c8c6c4" : "#117865", fontWeight: 600 }}
            >
              Close &amp; Apply
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
