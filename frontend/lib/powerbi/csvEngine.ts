import { evaluateCalculatedColumn, evaluateMeasure } from "./formulaEngine.ts";
import { POWERBI_SERIES_PALETTE } from "./palette.ts";
import type {
  AggregationFn,
  ColumnMeta,
  ColumnType,
  DataRow,
  DatasetModel,
  FilterEvaluationInput,
  GroupedAggregationResult,
  MeasureDef,
  PivotMatrixResult,
  PowerBiVisual,
  PowerBiVisualType,
  ReportPage,
  TableRelationship,
} from "./types.ts";

const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/;
const DATE_SLASH_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
const NUMERIC_RE = /^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?$/;
const MISSING_TOKENS = new Set(["", "null", "na", "n/a", "nan", "none", "-", "nil"]);

export function isMissingCellValue(raw: string | number | null | undefined): boolean {
  if (raw === null || raw === undefined) return true;
  if (typeof raw === "number") return !Number.isFinite(raw);
  return MISSING_TOKENS.has(raw.trim().toLowerCase());
}

function detectDelimiter(headerLine: string): "," | "\t" | ";" {
  let commas = 0;
  let tabs = 0;
  let semis = 0;
  let inQuotes = false;
  for (let i = 0; i < headerLine.length; i++) {
    const ch = headerLine[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === ",") commas++;
      else if (ch === "\t") tabs++;
      else if (ch === ";") semis++;
    }
  }
  if (commas >= tabs && commas >= semis) return ",";
  if (tabs >= semis) return "\t";
  return ";";
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

function splitCsvRecords(raw: string): string[] {
  const cleaned = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '"') {
      if (inQuotes && cleaned[i + 1] === '"') {
        current += '""';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === "\n" && !inQuotes) {
      if (current.trim().length > 0) {
        records.push(current);
      }
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) {
    records.push(current);
  }
  return records;
}

export function toHumanLabel(col: string): string {
  return col
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function isRateOrPercentageColumn(colName: string): boolean {
  const lower = colName.toLowerCase();
  return (
    lower.includes("rate") ||
    lower.includes("pct") ||
    lower.includes("percent") ||
    lower.includes("ratio") ||
    lower.includes("avg") ||
    lower.includes("score")
  );
}

function inferColumnType(values: string[]): ColumnType {
  const nonEmpty = values.filter((v) => !isMissingCellValue(v));
  if (nonEmpty.length === 0) return "text";

  const dateMatches = nonEmpty.filter((v) => DATE_ISO_RE.test(v) || DATE_SLASH_RE.test(v)).length;
  if (dateMatches / nonEmpty.length >= 0.8) return "date";

  const numMatches = nonEmpty.filter((v) => NUMERIC_RE.test(v)).length;
  if (numMatches / nonEmpty.length >= 0.75) return "number";

  return "text";
}

function toNumberValue(raw: string): number | null {
  const normalized = raw.replace(/[,%\s]/g, "");
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

export function recomputeColumnMetas(
  existingCols: ColumnMeta[],
  rows: DataRow[],
): { columns: ColumnMeta[]; missingCount: number; invalidCount: number } {
  let totalMissing = 0;
  let totalInvalid = 0;

  const columns: ColumnMeta[] = existingCols.map((col) => {
    let missingCount = 0;
    let invalidCount = 0;
    const uniqueSet = new Set<string>();
    const nums: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      const val = rows[i][col.name];
      if (isMissingCellValue(val)) {
        missingCount++;
        continue;
      }
      if (col.isNumeric) {
        if (typeof val === "number" && Number.isFinite(val)) {
          nums.push(val);
          uniqueSet.add(String(val));
        } else {
          invalidCount++;
        }
      } else {
        const s = String(val).trim();
        if (col.type === "date" && !DATE_ISO_RE.test(s) && !DATE_SLASH_RE.test(s)) {
          invalidCount++;
        }
        uniqueSet.add(s);
      }
    }

    totalMissing += missingCount;
    totalInvalid += invalidCount;

    const min = nums.length > 0 ? Math.min(...nums) : undefined;
    const max = nums.length > 0 ? Math.max(...nums) : undefined;

    return {
      ...col,
      isNumeric: col.type === "number",
      uniqueCount: uniqueSet.size,
      min,
      max,
      missingCount,
      invalidCount,
      sampleValues: Array.from(uniqueSet).slice(0, 6),
    };
  });

  return { columns, missingCount: totalMissing, invalidCount: totalInvalid };
}

export function buildDatasetFromGrid(
  rawHeaders: string[],
  parsedRowsRaw: string[][],
  tableName = "UploadedDataset",
  fileName = "dataset.csv",
): DatasetModel {
  if (rawHeaders.length === 0) {
    return { name: tableName, fileName, columns: [], rows: [], missingCount: 0, invalidCount: 0 };
  }

  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h, idx) => {
    const base = h.trim() || `Column_${idx + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });

  const columnValues = headers.map((_, colIdx) =>
    parsedRowsRaw.map((cells) => (cells[colIdx] !== undefined ? String(cells[colIdx]).trim() : "")),
  );

  let totalMissing = 0;
  let totalInvalid = 0;

  const columns: ColumnMeta[] = headers.map((name, colIdx) => {
    const vals = columnValues[colIdx];
    const type = inferColumnType(vals);
    const uniqueSet = new Set<string>();
    const nums: number[] = [];
    let missingCount = 0;
    let invalidCount = 0;

    for (let r = 0; r < vals.length; r++) {
      const v = vals[r];
      if (isMissingCellValue(v)) {
        missingCount++;
        continue;
      }
      if (type === "number") {
        if (NUMERIC_RE.test(v)) {
          const n = toNumberValue(v);
          if (n !== null) {
            nums.push(n);
            uniqueSet.add(v);
          } else {
            invalidCount++;
          }
        } else {
          invalidCount++;
        }
      } else {
        if (type === "date" && !DATE_ISO_RE.test(v) && !DATE_SLASH_RE.test(v)) {
          invalidCount++;
        }
        uniqueSet.add(v);
      }
    }

    totalMissing += missingCount;
    totalInvalid += invalidCount;

    return {
      name,
      label: toHumanLabel(name),
      type,
      isNumeric: type === "number",
      uniqueCount: uniqueSet.size,
      min: nums.length > 0 ? Math.min(...nums) : undefined,
      max: nums.length > 0 ? Math.max(...nums) : undefined,
      sampleValues: Array.from(uniqueSet).slice(0, 6),
      missingCount,
      invalidCount,
    };
  });

  const rows: DataRow[] = parsedRowsRaw.map((cells) => {
    const row: DataRow = {};
    for (let idx = 0; idx < columns.length; idx++) {
      const col = columns[idx];
      const raw = cells[idx] !== undefined ? String(cells[idx]).trim() : "";
      if (isMissingCellValue(raw)) {
        row[col.name] = null;
      } else if (col.isNumeric) {
        row[col.name] = NUMERIC_RE.test(raw) ? toNumberValue(raw) : null;
      } else {
        row[col.name] = raw;
      }
    }
    return row;
  });

  const cleanName = tableName.replace(/\.(csv|tsv|txt|xlsx|xls)$/i, "");
  return {
    id: `tbl-${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`,
    name: cleanName,
    fileName,
    columns,
    rows,
    missingCount: totalMissing,
    invalidCount: totalInvalid,
  };
}

export function parseCsvText(
  csvText: string,
  tableName = "UploadedDataset",
  fileName = "dataset.csv",
): DatasetModel {
  const records = splitCsvRecords(csvText);
  if (records.length === 0) {
    return { name: tableName, fileName, columns: [], rows: [], missingCount: 0, invalidCount: 0 };
  }

  const delimiter = detectDelimiter(records[0]);
  const rawHeaders = parseDelimitedLine(records[0], delimiter);
  const parsedRowsRaw = records.slice(1).map((line) => parseDelimitedLine(line, delimiter));
  return buildDatasetFromGrid(rawHeaders, parsedRowsRaw, tableName, fileName);
}

export function formatPowerBiNumber(value: number, columnName?: string): string {
  if (!Number.isFinite(value)) return "0";
  if (columnName && isRateOrPercentageColumn(columnName)) {
    return `${value.toFixed(2)}%`;
  }
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}bn`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(2)}K`;
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function applyDatasetFilters(
  rows: DataRow[],
  filters: FilterEvaluationInput,
): DataRow[] {
  const filterMaps = [
    filters.reportFilters,
    filters.pageFilters,
    filters.slicerFilters,
    filters.visualFilters,
  ].filter(Boolean) as Record<string, string[]>[];

  return rows.filter((row) => {
    for (let m = 0; m < filterMaps.length; m++) {
      const entries = Object.entries(filterMaps[m]);
      for (let e = 0; e < entries.length; e++) {
        const [col, allowed] = entries[e];
        if (allowed && allowed.length > 0 && allowed.indexOf(String(row[col] ?? "")) === -1) {
          return false;
        }
      }
    }
    if (filters.numericFilters) {
      const nEntries = Object.entries(filters.numericFilters);
      for (let i = 0; i < nEntries.length; i++) {
        const [col, bounds] = nEntries[i];
        if (bounds.min === undefined && bounds.max === undefined) continue;
        const val = row[col];
        const num = typeof val === "number" ? val : Number(val);
        if (!Number.isFinite(num)) return false;
        if (bounds.min !== undefined && num < bounds.min) return false;
        if (bounds.max !== undefined && num > bounds.max) return false;
      }
    }
    if (filters.crossFilter) {
      const { column, value } = filters.crossFilter;
      if (String(row[column] ?? "") !== value) return false;
    }
    if (filters.dateRange && (filters.dateRange.from || filters.dateRange.to)) {
      const cell = String(row[filters.dateRange.column] ?? "");
      if (filters.dateRange.from && cell < filters.dateRange.from) return false;
      if (filters.dateRange.to && cell > filters.dateRange.to) return false;
    }
    return true;
  });
}

function resolveFilterMapForTable(
  table: DatasetModel,
  map: Record<string, string[]> | undefined,
): Record<string, string[]> {
  if (!map) return {};
  const colNames = new Set(table.columns.map((c) => c.name));
  const out: Record<string, string[]> = {};
  const entries = Object.entries(map);
  for (let i = 0; i < entries.length; i++) {
    const [k, v] = entries[i];
    if (colNames.has(k) && v && v.length > 0) {
      out[k] = v;
    }
  }
  return out;
}

export function resolveTableRows(
  tableId: string | undefined,
  tables: DatasetModel[],
  relationships: TableRelationship[],
  filters: FilterEvaluationInput,
): DataRow[] {
  const target = (tableId ? tables.find((t) => (t.id || t.name) === tableId) : tables[0]) || tables[0];
  if (!target) return [];

  const targetId = target.id || target.name;
  const directFilters: FilterEvaluationInput = {
    reportFilters: resolveFilterMapForTable(target, filters.reportFilters),
    pageFilters: resolveFilterMapForTable(target, filters.pageFilters),
    slicerFilters: resolveFilterMapForTable(target, filters.slicerFilters),
    visualFilters: resolveFilterMapForTable(target, filters.visualFilters),
    numericFilters: filters.numericFilters,
    crossFilter:
      filters.crossFilter &&
      (!filters.crossFilter.tableId ||
        filters.crossFilter.tableId === targetId ||
        target.columns.some((c) => c.name === filters.crossFilter!.column))
        ? filters.crossFilter
        : null,
    dateRange:
      filters.dateRange && target.columns.some((c) => c.name === filters.dateRange!.column)
        ? filters.dateRange
        : null,
  };

  let rows = applyDatasetFilters(target.rows, directFilters);

  // Propagate active relationships from any other table that has active filters matching its columns
  for (let r = 0; r < relationships.length; r++) {
    const rel = relationships[r];
    if (!rel.active) continue;

    let localCol: string | null = null;
    let otherTableId: string | null = null;
    let otherCol: string | null = null;

    if (rel.fromTableId === targetId) {
      localCol = rel.fromColumn;
      otherTableId = rel.toTableId;
      otherCol = rel.toColumn;
    } else if (rel.toTableId === targetId) {
      localCol = rel.toColumn;
      otherTableId = rel.fromTableId;
      otherCol = rel.fromColumn;
    }

    if (!localCol || !otherTableId || !otherCol) continue;
    const otherTable = tables.find((t) => (t.id || t.name) === otherTableId);
    if (!otherTable) continue;

    const otherDirect: FilterEvaluationInput = {
      reportFilters: resolveFilterMapForTable(otherTable, filters.reportFilters),
      pageFilters: resolveFilterMapForTable(otherTable, filters.pageFilters),
      slicerFilters: resolveFilterMapForTable(otherTable, filters.slicerFilters),
      visualFilters: resolveFilterMapForTable(otherTable, filters.visualFilters),
      crossFilter:
        filters.crossFilter &&
        (filters.crossFilter.tableId === otherTableId ||
          otherTable.columns.some((c) => c.name === filters.crossFilter!.column))
          ? filters.crossFilter
          : null,
    };

    const hasAnyOtherFilter =
      Object.keys(otherDirect.reportFilters || {}).length > 0 ||
      Object.keys(otherDirect.pageFilters || {}).length > 0 ||
      Object.keys(otherDirect.slicerFilters || {}).length > 0 ||
      Object.keys(otherDirect.visualFilters || {}).length > 0 ||
      Boolean(otherDirect.crossFilter);

    if (!hasAnyOtherFilter) continue;

    const filteredOther = applyDatasetFilters(otherTable.rows, otherDirect);
    const allowedJoinKeys = new Set<string>();
    for (let i = 0; i < filteredOther.length; i++) {
      const k = filteredOther[i][otherCol];
      if (!isMissingCellValue(k)) allowedJoinKeys.add(String(k));
    }

    rows = rows.filter((row) => {
      const lk = row[localCol!];
      return !isMissingCellValue(lk) && allowedJoinKeys.has(String(lk));
    });
  }

  return rows;
}

function reduceNumbers(nums: number[], fn: AggregationFn): number {
  if (nums.length === 0) return 0;
  switch (fn) {
    case "count":
      return nums.length;
    case "average":
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    case "min":
      return Math.min(...nums);
    case "max":
      return Math.max(...nums);
    case "sum":
    default:
      return nums.reduce((a, b) => a + b, 0);
  }
}

export function aggregateKpi(
  rows: DataRow[],
  field: string,
  aggregation: AggregationFn = "sum",
  measures?: MeasureDef[],
  columns?: ColumnMeta[],
): number {
  if (!field) return 0;
  if (measures && measures.length > 0) {
    const matched = measures.find((m) => m.name === field);
    if (matched) {
      return evaluateMeasure(matched.formula, rows, columns || [], measures).value;
    }
  }
  if (rows.length === 0) return 0;
  if (aggregation === "count") {
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      const v = rows[i][field];
      if (!isMissingCellValue(v)) count++;
    }
    return count;
  }
  const nums: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i][field];
    if (v === null || v === undefined || v === "") continue;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[,%\s]/g, ""));
    if (Number.isFinite(n)) nums.push(n);
  }
  return reduceNumbers(nums, aggregation);
}

export interface AggregateOptions {
  legendCol?: string;
  sortBy?: "value" | "category";
  sortDir?: "asc" | "desc";
  perFieldAggregations?: Record<string, AggregationFn>;
  measures?: MeasureDef[];
  columns?: ColumnMeta[];
  palette?: readonly string[];
}

export function aggregateByDimension(
  rows: DataRow[],
  xAxis: string | undefined,
  yFields: string[],
  aggregation: AggregationFn = "sum",
  primaryColor: string = POWERBI_SERIES_PALETTE[0],
  options: AggregateOptions = {},
): GroupedAggregationResult {
  const fields = yFields.length > 0 ? yFields : [];
  const palette = options.palette || POWERBI_SERIES_PALETTE;
  const buckets = new Map<string, DataRow[]>();

  if (!xAxis) {
    buckets.set("All", rows);
  } else {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const raw = row[xAxis];
      const key = isMissingCellValue(raw) ? "(Blank)" : String(raw);
      const list = buckets.get(key);
      if (list) list.push(row);
      else buckets.set(key, [row]);
    }
  }

  // Optional Legend column splits the first Y field across distinct legend series
  if (options.legendCol && fields.length > 0) {
    const metricField = fields[0];
    const effAgg =
      options.perFieldAggregations?.[metricField] ||
      (isRateOrPercentageColumn(metricField) && aggregation === "sum" ? "average" : aggregation);

    const legendTotals = new Map<string, number>();
    const legendBuckets = new Map<string, DataRow[]>();
    for (let i = 0; i < rows.length; i++) {
      const lv = isMissingCellValue(rows[i][options.legendCol])
        ? "(Blank)"
        : String(rows[i][options.legendCol]);
      const arr = legendBuckets.get(lv);
      if (arr) arr.push(rows[i]);
      else legendBuckets.set(lv, [rows[i]]);
    }
    Array.from(legendBuckets.entries()).forEach(([lv, lRows]) => {
      legendTotals.set(lv, aggregateKpi(lRows, metricField, effAgg, options.measures, options.columns));
    });

    const sortedLegendKeys = Array.from(legendTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
    const topLegendKeys = sortedLegendKeys.slice(0, 7);
    const hasOther = sortedLegendKeys.length > 7;
    const finalSeriesKeys = hasOther ? [...topLegendKeys, "Other"] : topLegendKeys;

    const series = finalSeriesKeys.map((key, idx) => ({
      key,
      label: key,
      color: idx === 0 && primaryColor ? primaryColor : palette[idx % palette.length],
    }));

    const groupedRows = Array.from(buckets.entries()).map(([category, groupRows]) => {
      const subMap = new Map<string, DataRow[]>();
      for (let i = 0; i < groupRows.length; i++) {
        const rawLv = groupRows[i][options.legendCol!];
        const lv = isMissingCellValue(rawLv) ? "(Blank)" : String(rawLv);
        const targetKey = topLegendKeys.indexOf(lv) !== -1 ? lv : "Other";
        const arr = subMap.get(targetKey);
        if (arr) arr.push(groupRows[i]);
        else subMap.set(targetKey, [groupRows[i]]);
      }

      const values: Record<string, number> = {};
      let total = 0;
      for (let s = 0; s < finalSeriesKeys.length; s++) {
        const sk = finalSeriesKeys[s];
        const subRows = subMap.get(sk) || [];
        const val = subRows.length
          ? aggregateKpi(subRows, metricField, effAgg, options.measures, options.columns)
          : 0;
        values[sk] = val;
        total += val;
      }
      return { category, values, total };
    });

    sortGroupedRows(groupedRows, finalSeriesKeys[0], options.sortBy, options.sortDir);
    const allValues = groupedRows.flatMap((r) => finalSeriesKeys.map((k) => r.values[k] ?? 0));
    return {
      categories: groupedRows.map((r) => r.category),
      series,
      rows: groupedRows,
      maxVal: allValues.length > 0 ? Math.max(...allValues, 0) : 0,
      minVal: allValues.length > 0 ? Math.min(...allValues, 0) : 0,
    };
  }

  const series = fields.map((f, idx) => ({
    key: f,
    label: toHumanLabel(f),
    color: idx === 0 ? primaryColor : palette[idx % palette.length],
  }));

  const groupedRows = Array.from(buckets.entries()).map(([category, groupRows]) => {
    const values: Record<string, number> = {};
    let total = 0;
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      const baseAgg = options.perFieldAggregations?.[f] || aggregation;
      const effAgg = isRateOrPercentageColumn(f) && baseAgg === "sum" ? "average" : baseAgg;
      const val = aggregateKpi(groupRows, f, effAgg, options.measures, options.columns);
      values[f] = val;
      total += val;
    }
    return { category, values, total };
  });

  sortGroupedRows(groupedRows, fields[0], options.sortBy, options.sortDir);

  const allValues = groupedRows.flatMap((r) => fields.map((f) => r.values[f] ?? 0));
  const maxVal = allValues.length > 0 ? Math.max(...allValues, 0) : 0;
  const minVal = allValues.length > 0 ? Math.min(...allValues, 0) : 0;

  return {
    categories: groupedRows.map((r) => r.category),
    series,
    rows: groupedRows,
    maxVal,
    minVal,
  };
}

function sortGroupedRows(
  groupedRows: Array<{ category: string; values: Record<string, number>; total: number }>,
  primaryKey: string | undefined,
  sortBy?: "value" | "category",
  sortDir?: "asc" | "desc",
) {
  if (sortBy === "category") {
    const dir = sortDir === "desc" ? -1 : 1;
    groupedRows.sort((a, b) => a.category.localeCompare(b.category) * dir);
    return;
  }
  if (sortBy === "value" && primaryKey) {
    const dir = sortDir === "asc" ? 1 : -1;
    groupedRows.sort((a, b) => ((a.values[primaryKey] ?? 0) - (b.values[primaryKey] ?? 0)) * dir);
    return;
  }

  const looksLikeDate =
    groupedRows.length > 1 &&
    groupedRows
      .slice(0, 5)
      .every((r) => DATE_ISO_RE.test(r.category) || DATE_SLASH_RE.test(r.category));

  groupedRows.sort((a, b) => {
    if (looksLikeDate) return a.category.localeCompare(b.category);
    if (!primaryKey) return a.category.localeCompare(b.category);
    return (b.values[primaryKey] ?? 0) - (a.values[primaryKey] ?? 0);
  });
}

export function buildPivotMatrix(
  rows: DataRow[],
  rowField: string | undefined,
  colField: string | undefined,
  valueField: string | undefined,
  aggregation: AggregationFn = "sum",
  measures?: MeasureDef[],
  columns?: ColumnMeta[],
): PivotMatrixResult {
  const effRowField = rowField || columns?.find((c) => !c.isNumeric)?.name;
  const effValField = valueField || columns?.find((c) => c.isNumeric)?.name;

  if (!effRowField || !effValField || rows.length === 0) {
    return {
      rowHeaders: [],
      colHeaders: [],
      cells: {},
      rowTotals: {},
      colTotals: {},
      grandTotal: 0,
    };
  }

  const effAgg =
    isRateOrPercentageColumn(effValField) && aggregation === "sum" ? "average" : aggregation;

  const rowSet = new Set<string>();
  const colSet = new Set<string>();
  const cellRowsMap = new Map<string, Map<string, DataRow[]>>();
  const rowAllMap = new Map<string, DataRow[]>();
  const colAllMap = new Map<string, DataRow[]>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rKey = isMissingCellValue(row[effRowField]) ? "(Blank)" : String(row[effRowField]);
    const cKey = colField
      ? isMissingCellValue(row[colField])
        ? "(Blank)"
        : String(row[colField])
      : toHumanLabel(effValField);

    rowSet.add(rKey);
    colSet.add(cKey);

    let rMap = cellRowsMap.get(rKey);
    if (!rMap) {
      rMap = new Map<string, DataRow[]>();
      cellRowsMap.set(rKey, rMap);
    }
    const existing = rMap.get(cKey);
    if (existing) existing.push(row);
    else rMap.set(cKey, [row]);

    const rAll = rowAllMap.get(rKey);
    if (rAll) rAll.push(row);
    else rowAllMap.set(rKey, [row]);

    const cAll = colAllMap.get(cKey);
    if (cAll) cAll.push(row);
    else colAllMap.set(cKey, [row]);
  }

  const rowTotals: Record<string, number> = {};
  Array.from(rowSet).forEach((rKey) => {
    rowTotals[rKey] = aggregateKpi(
      rowAllMap.get(rKey) || [],
      effValField,
      effAgg,
      measures,
      columns,
    );
  });

  const colTotals: Record<string, number> = {};
  Array.from(colSet).forEach((cKey) => {
    colTotals[cKey] = aggregateKpi(
      colAllMap.get(cKey) || [],
      effValField,
      effAgg,
      measures,
      columns,
    );
  });

  const rowHeaders = Array.from(rowSet)
    .sort((a, b) => (rowTotals[b] ?? 0) - (rowTotals[a] ?? 0))
    .slice(0, 25);
  const colHeaders = Array.from(colSet)
    .sort((a, b) => (colTotals[b] ?? 0) - (colTotals[a] ?? 0))
    .slice(0, 10);

  const cells: Record<string, Record<string, number>> = {};
  for (let r = 0; r < rowHeaders.length; r++) {
    const rk = rowHeaders[r];
    cells[rk] = {};
    const rMap = cellRowsMap.get(rk);
    for (let c = 0; c < colHeaders.length; c++) {
      const ck = colHeaders[c];
      const cellRows = rMap?.get(ck) || [];
      cells[rk][ck] = cellRows.length
        ? aggregateKpi(cellRows, effValField, effAgg, measures, columns)
        : 0;
    }
  }

  const grandTotal = aggregateKpi(rows, effValField, effAgg, measures, columns);
  return { rowHeaders, colHeaders, cells, rowTotals, colTotals, grandTotal };
}

function defaultFormat(accentColor: string = POWERBI_SERIES_PALETTE[0]) {
  return {
    showTitle: true,
    showDataLabels: true,
    showLegend: true,
    accentColor,
    backgroundColor: "#ffffff",
    showBorder: true,
  };
}

export function getVisualDefaultTitle(
  type: PowerBiVisualType,
  xAxis: string | undefined,
  yAxis: string[],
  aggregation: AggregationFn,
): string {
  const aggWord =
    aggregation === "average"
      ? "Average"
      : aggregation === "count"
        ? "Count"
        : aggregation === "min"
          ? "Min"
          : aggregation === "max"
            ? "Max"
            : "Sum";

  if (type === "textbox") return "Text box";
  if (type === "slicer") return xAxis ? toHumanLabel(xAxis) : "Slicer";
  if (type === "card") {
    const col = yAxis[0] || xAxis;
    return col ? `${aggWord} of ${toHumanLabel(col)}` : "KPI Card";
  }
  if (yAxis.length > 0 && xAxis) {
    const yLabels = yAxis
      .map((f) => `${isRateOrPercentageColumn(f) ? "Avg" : aggWord} of ${toHumanLabel(f)}`)
      .join(" & ");
    return `${yLabels} by ${toHumanLabel(xAxis)}`;
  }
  if (yAxis.length > 0) return `${toHumanLabel(yAxis[0])}`;
  return "New Visual";
}

export function createDefaultReportPages(dataset: DatasetModel): ReportPage[] {
  const tableId = dataset.id || dataset.name;
  const textCols = dataset.columns.filter((c) => c.type === "text");
  const dateCols = dataset.columns.filter((c) => c.type === "date");
  const numCols = dataset.columns.filter((c) => c.isNumeric);

  const primaryCat = textCols[0]?.name || dataset.columns[0]?.name || "Category";
  const secondaryCat = textCols[1]?.name || primaryCat;
  const dateCol = dateCols[0]?.name || primaryCat;

  const metric1 = numCols[0]?.name;
  const metric2 = numCols[1]?.name || metric1;
  const metric3 = numCols[2]?.name || metric1;
  const metric4 =
    numCols.find((c) => isRateOrPercentageColumn(c.name))?.name || numCols[3]?.name || metric2;

  const visualsPage1: PowerBiVisual[] = [];

  const kpiCandidates = [metric1, metric2, metric3, metric4].filter(Boolean) as string[];
  const kpiWidth = 228;
  kpiCandidates.slice(0, 4).forEach((m, i) => {
    const agg: AggregationFn = isRateOrPercentageColumn(m) ? "average" : "sum";
    visualsPage1.push({
      id: `v-kpi-${i + 1}`,
      type: "card",
      tableId,
      title: toHumanLabel(m),
      yAxis: [m],
      aggregation: agg,
      layout: { x: 16 + i * (kpiWidth + 12), y: 16, w: kpiWidth, h: 102 },
      format: {
        ...defaultFormat(POWERBI_SERIES_PALETTE[i % POWERBI_SERIES_PALETTE.length]),
        showTitle: false,
      },
      visualFilters: {},
    });
  });

  visualsPage1.push({
    id: "v-slicer-1",
    type: "slicer",
    tableId,
    title: toHumanLabel(primaryCat),
    xAxis: primaryCat,
    yAxis: [],
    aggregation: "count",
    layout: { x: 980, y: 16, w: 284, h: 244 },
    format: defaultFormat(POWERBI_SERIES_PALETTE[0]),
    visualFilters: {},
  });

  if (metric1) {
    visualsPage1.push({
      id: "v-col-1",
      type: "clusteredColumn",
      tableId,
      title: getVisualDefaultTitle(
        "clusteredColumn",
        primaryCat,
        metric2 && metric2 !== metric1 ? [metric1, metric2] : [metric1],
        "sum",
      ),
      xAxis: primaryCat,
      yAxis: metric2 && metric2 !== metric1 ? [metric1, metric2] : [metric1],
      aggregation: "sum",
      layout: { x: 16, y: 132, w: 468, h: 282 },
      format: defaultFormat(POWERBI_SERIES_PALETTE[0]),
      visualFilters: {},
    });

    visualsPage1.push({
      id: "v-line-1",
      type: "line",
      tableId,
      title: getVisualDefaultTitle("line", dateCol, [metric3 || metric1], "sum"),
      xAxis: dateCol,
      yAxis: [metric3 || metric1],
      aggregation: "sum",
      layout: { x: 498, y: 132, w: 466, h: 282 },
      format: defaultFormat(POWERBI_SERIES_PALETTE[0]),
      visualFilters: {},
    });

    visualsPage1.push({
      id: "v-donut-1",
      type: "donut",
      tableId,
      title: getVisualDefaultTitle("donut", primaryCat, [metric1], "sum"),
      xAxis: primaryCat,
      yAxis: [metric1],
      aggregation: "sum",
      layout: { x: 16, y: 428, w: 356, h: 276 },
      format: defaultFormat(POWERBI_SERIES_PALETTE[0]),
      visualFilters: {},
    });

    visualsPage1.push({
      id: "v-bar-1",
      type: "clusteredBar",
      tableId,
      title: getVisualDefaultTitle(
        "clusteredBar",
        primaryCat,
        [metric4 || metric1],
        isRateOrPercentageColumn(metric4 || metric1) ? "average" : "sum",
      ),
      xAxis: primaryCat,
      yAxis: [metric4 || metric1],
      aggregation: isRateOrPercentageColumn(metric4 || metric1) ? "average" : "sum",
      layout: { x: 386, y: 428, w: 578, h: 276 },
      format: defaultFormat("#12239E"),
      visualFilters: {},
    });
  }

  visualsPage1.push({
    id: "v-table-1",
    type: "table",
    tableId,
    title: `${toHumanLabel(primaryCat)} Summary`,
    xAxis: primaryCat,
    yAxis: numCols.slice(0, 3).map((c) => c.name),
    aggregation: "sum",
    layout: { x: 980, y: 274, w: 284, h: 430 },
    format: defaultFormat(POWERBI_SERIES_PALETTE[0]),
    visualFilters: {},
  });

  const visualsPage2: PowerBiVisual[] = [];
  if (metric1) {
    visualsPage2.push({
      id: "v-p2-area",
      type: "area",
      tableId,
      title: getVisualDefaultTitle(
        "area",
        dateCol,
        [metric1, metric2 || metric1].filter((v, i, a) => a.indexOf(v) === i),
        "sum",
      ),
      xAxis: dateCol,
      yAxis: [metric1, metric2 || metric1].filter((v, i, a) => a.indexOf(v) === i),
      aggregation: "sum",
      layout: { x: 16, y: 16, w: 618, h: 332 },
      format: defaultFormat("#118DFF"),
      visualFilters: {},
    });

    visualsPage2.push({
      id: "v-p2-matrix",
      type: "matrix",
      tableId,
      title: `${toHumanLabel(primaryCat)} × ${toHumanLabel(secondaryCat)} Matrix`,
      xAxis: primaryCat,
      legend: secondaryCat !== primaryCat ? secondaryCat : undefined,
      yAxis: [metric1],
      aggregation: "sum",
      layout: { x: 648, y: 16, w: 616, h: 332 },
      format: defaultFormat("#117865"),
      visualFilters: {},
    });

    visualsPage2.push({
      id: "v-p2-pie",
      type: "pie",
      tableId,
      title: getVisualDefaultTitle("pie", primaryCat, [metric2 || metric1], "sum"),
      xAxis: primaryCat,
      yAxis: [metric2 || metric1],
      aggregation: "sum",
      layout: { x: 16, y: 362, w: 420, h: 342 },
      format: defaultFormat("#118DFF"),
      visualFilters: {},
    });

    visualsPage2.push({
      id: "v-p2-table",
      type: "table",
      tableId,
      title: `${dataset.name} Detailed Table`,
      xAxis: dateCol,
      yAxis: numCols.slice(0, 5).map((c) => c.name),
      aggregation: "sum",
      layout: { x: 450, y: 362, w: 814, h: 342 },
      format: defaultFormat("#118DFF"),
      visualFilters: {},
    });
  }

  return [
    {
      id: "page-1",
      name: dataset.name.toLowerCase().includes("social") ? "Social Media Overview" : "Page 1",
      visuals: visualsPage1,
      pageFilters: {},
    },
    {
      id: "page-2",
      name: "Matrix & Breakdown",
      visuals: visualsPage2,
      pageFilters: {},
    },
  ];
}

// ---------- Data Operations (Rename, Change Type, Missing Values, Calculated Columns) ----------

export function renameTableColumn(
  table: DatasetModel,
  oldName: string,
  newNameRaw: string,
): DatasetModel {
  const trimmed = newNameRaw.trim();
  if (!trimmed || trimmed === oldName) return table;
  if (table.columns.some((c) => c.name === trimmed)) return table;

  const columns = table.columns.map((c) =>
    c.name === oldName ? { ...c, name: trimmed, label: toHumanLabel(trimmed) } : c,
  );
  const rows = table.rows.map((row) => {
    const next: DataRow = {};
    const keys = Object.keys(row);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      next[k === oldName ? trimmed : k] = row[k];
    }
    return next;
  });

  return { ...table, columns, rows };
}

export function changeColumnType(
  table: DatasetModel,
  colName: string,
  newType: ColumnType,
): DatasetModel {
  const rows = table.rows.map((row) => {
    const val = row[colName];
    if (isMissingCellValue(val)) return { ...row, [colName]: null };

    if (newType === "number") {
      if (typeof val === "number") return row;
      const n = toNumberValue(String(val));
      return { ...row, [colName]: n };
    }
    return { ...row, [colName]: String(val) };
  });

  const updatedCols = table.columns.map((c) =>
    c.name === colName ? { ...c, type: newType, isNumeric: newType === "number" } : c,
  );
  const metaSummary = recomputeColumnMetas(updatedCols, rows);
  return {
    ...table,
    columns: metaSummary.columns,
    rows,
    missingCount: metaSummary.missingCount,
    invalidCount: metaSummary.invalidCount,
  };
}

export function removeTableColumn(table: DatasetModel, colName: string): DatasetModel {
  if (table.columns.length <= 1) return table;
  const columns = table.columns.filter((c) => c.name !== colName);
  const rows = table.rows.map((row) => {
    const copy = { ...row };
    delete copy[colName];
    return copy;
  });
  const metaSummary = recomputeColumnMetas(columns, rows);
  return {
    ...table,
    columns: metaSummary.columns,
    rows,
    missingCount: metaSummary.missingCount,
    invalidCount: metaSummary.invalidCount,
  };
}

export function handleMissingValues(
  table: DatasetModel,
  colName: string,
  strategy: "drop" | "fillZero" | "fillAverage" | "fillText",
  fillText = "Unknown",
): DatasetModel {
  const colMeta = table.columns.find((c) => c.name === colName);
  if (!colMeta) return table;

  let nextRows: DataRow[];
  if (strategy === "drop") {
    nextRows = table.rows.filter((r) => !isMissingCellValue(r[colName]));
  } else {
    let replacement: string | number = fillText;
    if (strategy === "fillZero") {
      replacement = colMeta.isNumeric ? 0 : "0";
    } else if (strategy === "fillAverage") {
      const avg = aggregateKpi(table.rows, colName, "average");
      replacement = Number(avg.toFixed(2));
    }
    nextRows = table.rows.map((r) =>
      isMissingCellValue(r[colName]) ? { ...r, [colName]: replacement } : r,
    );
  }

  const metaSummary = recomputeColumnMetas(table.columns, nextRows);
  return recomputeCalculatedColumns({
    ...table,
    columns: metaSummary.columns,
    rows: nextRows,
    missingCount: metaSummary.missingCount,
    invalidCount: metaSummary.invalidCount,
  });
}

export function addOrUpdateCalculatedColumn(
  table: DatasetModel,
  colNameRaw: string,
  formula: string,
): { table: DatasetModel; error?: string } {
  const colName = colNameRaw.trim();
  if (!colName) return { table, error: "Column name is required." };

  const baseCols = table.columns.filter((c) => c.name !== colName);
  const evalRes = evaluateCalculatedColumn(formula, table.rows, baseCols);
  if (evalRes.error) {
    return { table, error: evalRes.error };
  }

  const newRows = table.rows.map((row, idx) => ({
    ...row,
    [colName]: evalRes.values[idx],
  }));

  const newColMeta: ColumnMeta = {
    name: colName,
    label: toHumanLabel(colName),
    type: evalRes.inferredType,
    isNumeric: evalRes.inferredType === "number",
    uniqueCount: 0,
    sampleValues: [],
    isCalculated: true,
    formula,
  };

  const exists = table.columns.some((c) => c.name === colName);
  const updatedCols = exists
    ? table.columns.map((c) => (c.name === colName ? newColMeta : c))
    : [...table.columns, newColMeta];

  const metaSummary = recomputeColumnMetas(updatedCols, newRows);
  return {
    table: {
      ...table,
      columns: metaSummary.columns,
      rows: newRows,
      missingCount: metaSummary.missingCount,
      invalidCount: metaSummary.invalidCount,
    },
  };
}

export function recomputeCalculatedColumns(table: DatasetModel): DatasetModel {
  let current = table;
  const calcCols = current.columns.filter((c) => c.isCalculated && c.formula);
  for (let i = 0; i < calcCols.length; i++) {
    const col = calcCols[i];
    const res = addOrUpdateCalculatedColumn(current, col.name, col.formula!);
    if (!res.error) current = res.table;
  }
  return current;
}

export function autoDetectRelationships(
  tables: DatasetModel[],
  existing: TableRelationship[] = [],
): TableRelationship[] {
  const out = [...existing];
  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      const tA = tables[i];
      const tB = tables[j];
      const idA = tA.id || tA.name;
      const idB = tB.id || tB.name;

      for (let ca = 0; ca < tA.columns.length; ca++) {
        const colA = tA.columns[ca];
        if (colA.type === "number" && !colA.name.toLowerCase().includes("id")) continue;
        const colB = tB.columns.find((c) => c.name.toLowerCase() === colA.name.toLowerCase());
        if (!colB) continue;

        const alreadyExists = out.some(
          (r) =>
            ((r.fromTableId === idA && r.toTableId === idB) ||
              (r.fromTableId === idB && r.toTableId === idA)) &&
            r.fromColumn.toLowerCase() === colA.name.toLowerCase(),
        );
        if (alreadyExists) continue;

        const aUnique = colA.uniqueCount === tA.rows.length;
        const bUnique = colB.uniqueCount === tB.rows.length;

        out.push({
          id: `rel-${Date.now().toString(36)}-${i}-${j}-${ca}`,
          fromTableId: !aUnique && bUnique ? idA : idB,
          fromColumn: !aUnique && bUnique ? colA.name : colB.name,
          toTableId: !aUnique && bUnique ? idB : idA,
          toColumn: !aUnique && bUnique ? colB.name : colA.name,
          cardinality: aUnique && bUnique ? "one-to-one" : "many-to-one",
          active: true,
        });
      }
    }
  }
  return out;
}

export function exportTableToCsv(table: DatasetModel): string {
  const escape = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = table.columns.map((c) => escape(c.name)).join(",");
  const lines = table.rows.map((row) =>
    table.columns.map((c) => escape(row[c.name])).join(","),
  );
  return [header, ...lines].join("\n");
}
