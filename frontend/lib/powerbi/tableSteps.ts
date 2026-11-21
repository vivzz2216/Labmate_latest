/** Row-level Power Query steps for the Transform Data editor: filter, sort, remove duplicates, replace values and keep top rows.
 *  Each step is a pure function of a table, so it plugs into the workspace's existing mutateTable(). Rename, change type, remove
 *  column and clean missing values are handled by csvEngine already. */
import { isMissingCellValue, recomputeColumnMetas, recomputeCalculatedColumns } from "./csvEngine.ts";
import type { DataRow, DatasetModel } from "./types.ts";

export type FilterOp = "equals" | "notEquals" | "gt" | "gte" | "lt" | "lte" | "contains" | "notBlank";

export type TableStep =
  | { kind: "filterRows"; column: string; op: FilterOp; value: string }
  | { kind: "sortRows"; column: string; desc: boolean }
  | { kind: "removeDuplicates" }
  | { kind: "replaceValues"; column: string; find: string; replace: string }
  | { kind: "keepTopRows"; count: number };

export const FILTER_OPS: { id: FilterOp; label: string }[] = [
  { id: "equals", label: "equals" },
  { id: "notEquals", label: "does not equal" },
  { id: "gt", label: "is greater than" },
  { id: "gte", label: "is greater than or equal to" },
  { id: "lt", label: "is less than" },
  { id: "lte", label: "is less than or equal to" },
  { id: "contains", label: "contains" },
  { id: "notBlank", label: "is not blank" },
];

export function describeTableStep(step: TableStep): string {
  switch (step.kind) {
    case "filterRows": {
      const op = FILTER_OPS.find((o) => o.id === step.op);
      return `Filtered Rows (${step.column} ${op ? op.label : step.op}${step.op === "notBlank" ? "" : " " + step.value})`;
    }
    case "sortRows":
      return `Sorted Rows (${step.column} ${step.desc ? "descending" : "ascending"})`;
    case "removeDuplicates":
      return "Removed Duplicates";
    case "replaceValues":
      return `Replaced Value (${step.column}: ${step.find} → ${step.replace})`;
    case "keepTopRows":
      return `Kept Top Rows (${step.count})`;
  }
}

type Cell = string | number | null | undefined;

function asNumber(v: Cell): number | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Numbers compare as numbers, everything else as text; blanks always sort last. */
function compareCells(a: Cell, b: Cell): number {
  const na = asNumber(a);
  const nb = asNumber(b);
  if (na !== null && nb !== null) return na - nb;
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" });
}

function keepRow(cell: Cell, op: FilterOp, value: string): boolean {
  if (op === "notBlank") return !isMissingCellValue(cell);
  if (op === "contains") return String(cell ?? "").toLowerCase().includes(value.toLowerCase());
  const c = asNumber(cell);
  const v = asNumber(value);
  const numeric = c !== null && v !== null;
  const order = numeric ? (c as number) - (v as number) : String(cell ?? "").localeCompare(value, undefined, { sensitivity: "base" });
  switch (op) {
    case "equals":
      return numeric ? order === 0 : String(cell ?? "").trim().toLowerCase() === value.trim().toLowerCase();
    case "notEquals":
      return numeric ? order !== 0 : String(cell ?? "").trim().toLowerCase() !== value.trim().toLowerCase();
    case "gt":
      return !isMissingCellValue(cell) && order > 0;
    case "gte":
      return !isMissingCellValue(cell) && order >= 0;
    case "lt":
      return !isMissingCellValue(cell) && order < 0;
    case "lte":
      return !isMissingCellValue(cell) && order <= 0;
  }
  return true;
}

function rebuilt(table: DatasetModel, rows: DataRow[]): DatasetModel {
  const meta = recomputeColumnMetas(table.columns, rows);
  return recomputeCalculatedColumns({ ...table, rows, columns: meta.columns, missingCount: meta.missingCount, invalidCount: meta.invalidCount });
}

/** Applies one step. A step that cannot be applied (a column that does not exist, a count below 1) returns the table unchanged
 *  together with the reason. */
export function applyTableStep(table: DatasetModel, step: TableStep): { table: DatasetModel; error?: string } {
  const has = (name: string) => table.columns.some((c) => c.name === name);
  switch (step.kind) {
    case "filterRows": {
      if (!has(step.column)) return { table, error: `There is no column named "${step.column}".` };
      if (step.op !== "notBlank" && step.value.trim() === "" && step.op !== "contains") return { table, error: "Enter a value to compare with." };
      return { table: rebuilt(table, table.rows.filter((r) => keepRow(r[step.column], step.op, step.value))) };
    }
    case "sortRows": {
      if (!has(step.column)) return { table, error: `There is no column named "${step.column}".` };
      const sign = step.desc ? -1 : 1;
      const sorted = table.rows
        .map((row, index) => ({ row, index }))
        .sort((a, b) => {
          const ma = isMissingCellValue(a.row[step.column]);
          const mb = isMissingCellValue(b.row[step.column]);
          if (ma !== mb) return ma ? 1 : -1;
          return sign * compareCells(a.row[step.column], b.row[step.column]) || a.index - b.index;
        })
        .map((x) => x.row);
      return { table: rebuilt(table, sorted) };
    }
    case "removeDuplicates": {
      const seen = new Set<string>();
      const kept = table.rows.filter((row) => {
        const key = JSON.stringify(table.columns.map((c) => row[c.name] ?? null));
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return { table: rebuilt(table, kept) };
    }
    case "replaceValues": {
      if (!has(step.column)) return { table, error: `There is no column named "${step.column}".` };
      if (step.find === "") return { table, error: "Enter the value to find." };
      const numeric = table.columns.find((c) => c.name === step.column)?.isNumeric === true;
      const replacement: string | number = numeric && asNumber(step.replace) !== null ? (asNumber(step.replace) as number) : step.replace;
      const rows = table.rows.map((row) => {
        const cell = row[step.column];
        const same = numeric && asNumber(step.find) !== null ? asNumber(cell) === asNumber(step.find) : String(cell ?? "") === step.find;
        return same ? { ...row, [step.column]: replacement } : row;
      });
      return { table: rebuilt(table, rows) };
    }
    case "keepTopRows": {
      if (!Number.isInteger(step.count) || step.count < 1) return { table, error: "Enter a whole number of rows, 1 or more." };
      return { table: rebuilt(table, table.rows.slice(0, step.count)) };
    }
  }
}
