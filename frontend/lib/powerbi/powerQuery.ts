/** A small Power Query engine: ordered, editable transformation steps applied to the loaded table.
 *  Steps always start again from the untouched source table, so deleting a step re-derives the data (as Applied Steps do). */
import { parseCsvText } from "./csvEngine";
import type { DataRow, DatasetModel } from "./types";

export type FilterOp = "equals" | "notEquals" | "gt" | "gte" | "lt" | "lte" | "contains" | "notBlank";

export type QueryStep =
  | { kind: "removeColumns"; columns: string[] }
  | { kind: "renameColumn"; from: string; to: string }
  | { kind: "filterRows"; column: string; op: FilterOp; value: string }
  | { kind: "removeDuplicates" }
  | { kind: "removeBlankRows" }
  | { kind: "changeType"; column: string; type: "number" | "text" }
  | { kind: "sortRows"; column: string; desc: boolean }
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

export function describeStep(step: QueryStep): string {
  switch (step.kind) {
    case "removeColumns":
      return "Removed Columns (" + step.columns.join(", ") + ")";
    case "renameColumn":
      return "Renamed Columns (" + step.from + " → " + step.to + ")";
    case "filterRows": {
      const op = FILTER_OPS.filter((o) => o.id === step.op)[0];
      return "Filtered Rows (" + step.column + " " + (op ? op.label : step.op) + (step.op === "notBlank" ? "" : " " + step.value) + ")";
    }
    case "removeDuplicates":
      return "Removed Duplicates";
    case "removeBlankRows":
      return "Removed Blank Rows";
    case "changeType":
      return "Changed Type (" + step.column + " → " + (step.type === "number" ? "number" : "text") + ")";
    case "sortRows":
      return "Sorted Rows (" + step.column + (step.desc ? " descending" : " ascending") + ")";
    case "replaceValues":
      return "Replaced Value (" + step.column + ": " + step.find + " → " + step.replace + ")";
    case "keepTopRows":
      return "Kept Top Rows (" + step.count + ")";
    default:
      return "Step";
  }
}

export interface QueryResult {
  dataset: DatasetModel;
  /** original column name -> final column name, for columns that were renamed (so visuals keep working) */
  renames: Record<string, string>;
  /** names of the source columns that no longer exist */
  removed: string[];
  /** set when a step could not be applied; the result then reflects the steps before it */
  error?: { stepIndex: number; message: string };
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function isBlank(v: string | number | undefined): boolean {
  return v === undefined || v === null || String(v).trim() === "";
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const na = Number(a);
  const nb = Number(b);
  if (!isNaN(na) && !isNaN(nb) && String(a).trim() !== "" && String(b).trim() !== "") return na - nb;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

export function applyQuerySteps(source: DatasetModel, steps: QueryStep[]): QueryResult {
  let names = source.columns.map((c) => c.name);
  let rows: DataRow[] = source.rows.map((r) => {
    const copy: DataRow = {};
    names.forEach((n) => (copy[n] = r[n]));
    return copy;
  });
  const typeOverride: Record<string, "number" | "text"> = {};
  const origin: Record<string, string> = {};
  names.forEach((n) => (origin[n] = n));
  let error: QueryResult["error"];

  const need = (col: string): void => {
    if (names.indexOf(col) < 0) throw new Error("The column '" + col + "' of the table wasn't found.");
  };

  for (let i = 0; i < steps.length && !error; i++) {
    const step = steps[i];
    try {
      switch (step.kind) {
        case "removeColumns": {
          if (!step.columns.length) throw new Error("Choose at least one column to remove.");
          step.columns.forEach(need);
          const drop: Record<string, boolean> = {};
          step.columns.forEach((c) => (drop[c] = true));
          names = names.filter((n) => !drop[n]);
          if (!names.length) throw new Error("A table needs at least one column.");
          rows = rows.map((r) => {
            const c: DataRow = {};
            names.forEach((n) => (c[n] = r[n]));
            return c;
          });
          break;
        }
        case "renameColumn": {
          need(step.from);
          const to = step.to.trim();
          if (!to) throw new Error("The new column name cannot be empty.");
          if (to !== step.from && names.indexOf(to) >= 0) throw new Error("A column named '" + to + "' already exists.");
          names = names.map((n) => (n === step.from ? to : n));
          rows = rows.map((r) => {
            const c: DataRow = {};
            Object.keys(r).forEach((k) => (c[k === step.from ? to : k] = r[k]));
            return c;
          });
          Object.keys(origin).forEach((k) => {
            if (origin[k] === step.from) origin[k] = to;
          });
          if (typeOverride[step.from]) {
            typeOverride[to] = typeOverride[step.from];
            delete typeOverride[step.from];
          }
          break;
        }
        case "filterRows": {
          need(step.column);
          const target = step.value;
          const numTarget = Number(target);
          rows = rows.filter((r) => {
            const v = r[step.column];
            switch (step.op) {
              case "notBlank":
                return !isBlank(v);
              case "contains":
                return String(v).toLowerCase().indexOf(target.toLowerCase()) >= 0;
              case "equals":
                return String(v) === target || (target.trim() !== "" && !isNaN(numTarget) && Number(v) === numTarget && !isBlank(v));
              case "notEquals":
                return !(String(v) === target || (target.trim() !== "" && !isNaN(numTarget) && Number(v) === numTarget && !isBlank(v)));
              default: {
                if (isBlank(v)) return false;
                const useNum = target.trim() !== "" && !isNaN(numTarget) && !isNaN(Number(v));
                const c = useNum ? Number(v) - numTarget : String(v) < target ? -1 : String(v) > target ? 1 : 0;
                return step.op === "gt" ? c > 0 : step.op === "gte" ? c >= 0 : step.op === "lt" ? c < 0 : c <= 0;
              }
            }
          });
          break;
        }
        case "removeDuplicates": {
          const seen: Record<string, boolean> = {};
          rows = rows.filter((r) => {
            const key = JSON.stringify(names.map((n) => r[n]));
            if (seen[key]) return false;
            seen[key] = true;
            return true;
          });
          break;
        }
        case "removeBlankRows":
          rows = rows.filter((r) => names.some((n) => !isBlank(r[n])));
          break;
        case "changeType": {
          need(step.column);
          typeOverride[step.column] = step.type;
          if (step.type === "number") {
            const bad = rows.filter((r) => !isBlank(r[step.column]) && isNaN(Number(String(r[step.column]).replace(/[,%\s]/g, ""))))[0];
            if (bad) throw new Error("We couldn't convert '" + String(bad[step.column]) + "' to a number.");
            rows = rows.map((r) => {
              const c: DataRow = {};
              Object.keys(r).forEach((k) => (c[k] = r[k]));
              c[step.column] = isBlank(r[step.column]) ? "" : Number(String(r[step.column]).replace(/[,%\s]/g, ""));
              return c;
            });
          } else {
            rows = rows.map((r) => {
              const c: DataRow = {};
              Object.keys(r).forEach((k) => (c[k] = r[k]));
              c[step.column] = String(r[step.column]);
              return c;
            });
          }
          break;
        }
        case "sortRows": {
          need(step.column);
          const indexed = rows.map((r, idx) => ({ r, idx }));
          indexed.sort((a, b) => {
            const c = compare(a.r[step.column], b.r[step.column]);
            return (step.desc ? -c : c) || a.idx - b.idx;
          });
          rows = indexed.map((x) => x.r);
          break;
        }
        case "replaceValues": {
          need(step.column);
          rows = rows.map((r) => {
            const c: DataRow = {};
            Object.keys(r).forEach((k) => (c[k] = r[k]));
            if (String(r[step.column]) === step.find) c[step.column] = typeOverride[step.column] === "text" || isNaN(Number(step.replace)) || step.replace.trim() === "" ? step.replace : Number(step.replace);
            return c;
          });
          break;
        }
        case "keepTopRows": {
          if (!(step.count >= 0) || Math.floor(step.count) !== step.count) throw new Error("Enter a whole number of rows to keep.");
          rows = rows.slice(0, step.count);
          break;
        }
        default:
          break;
      }
    } catch (e) {
      error = { stepIndex: i, message: e instanceof Error ? e.message : String(e) };
    }
  }

  // Rebuild the typed table (types, labels, distinct counts) from the transformed rows.
  const csv = [names.map(csvCell).join(",")]
    .concat(rows.map((r) => names.map((n) => csvCell(isBlank(r[n]) ? "" : r[n])).join(",")))
    .join("\n");
  const rebuilt = parseCsvText(csv, source.name, source.fileName);
  rebuilt.columns = rebuilt.columns.map((c) => {
    const forced = typeOverride[c.name];
    if (!forced) return c;
    return { ...c, type: forced, isNumeric: forced === "number" };
  });
  rebuilt.rows = rows.map((r) => {
    const c: DataRow = {};
    names.forEach((n) => {
      c[n] = typeOverride[n] === "text" ? String(isBlank(r[n]) ? "" : r[n]) : typeOverride[n] === "number" ? (isBlank(r[n]) ? "" : Number(r[n])) : r[n];
    });
    // parseCsvText numeric inference decides the numeric columns; keep their values numeric
    rebuilt.columns.forEach((col) => {
      if (col.isNumeric && !isBlank(c[col.name])) c[col.name] = Number(String(c[col.name]).replace(/[,%\s]/g, ""));
    });
    return c;
  });

  const renames: Record<string, string> = {};
  const removed: string[] = [];
  Object.keys(origin).forEach((k) => {
    if (names.indexOf(origin[k]) < 0) removed.push(k);
    else if (origin[k] !== k) renames[k] = origin[k];
  });
  return { dataset: rebuilt, renames, removed, error };
}
