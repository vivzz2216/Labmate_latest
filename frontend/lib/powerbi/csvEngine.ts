import { POWERBI_SERIES_PALETTE } from "./palette.ts";
import type {
  AggregationFn,
  ColumnMeta,
  ColumnType,
  DataRow,
  DatasetModel,
  FilterEvaluationInput,
  GroupedAggregationResult,
  PowerBiVisual,
  PowerBiVisualType,
  ReportPage,
} from "./types.ts";

const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/;
const DATE_SLASH_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
const NUMERIC_RE = /^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?$/;

function parseCsvLine(line: string): string[] {
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
    } else if (ch === "," && !inQuotes) {
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

function toHumanLabel(col: string): string {
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
  const nonEmpty = values.filter((v) => v !== "" && v !== "null" && v !== "NULL" && v !== "NaN");
  if (nonEmpty.length === 0) return "text";

  const dateMatches = nonEmpty.filter((v) => DATE_ISO_RE.test(v) || DATE_SLASH_RE.test(v)).length;
  if (dateMatches / nonEmpty.length >= 0.8) return "date";

  const numMatches = nonEmpty.filter((v) => NUMERIC_RE.test(v)).length;
  if (numMatches / nonEmpty.length >= 0.85) return "number";

  return "text";
}

function toNumberValue(raw: string): number {
  const normalized = raw.replace(/[,%\s]/g, "");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

export function parseCsvText(
  csvText: string,
  tableName = "UploadedDataset",
  fileName = "dataset.csv",
): DatasetModel {
  const records = splitCsvRecords(csvText);
  if (records.length === 0) {
    return { name: tableName, fileName, columns: [], rows: [] };
  }

  const rawHeaders = parseCsvLine(records[0]);
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h, idx) => {
    const base = h || `Column_${idx + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });

  const parsedRowsRaw = records.slice(1).map((line) => parseCsvLine(line));

  const columnValues = headers.map((_, colIdx) =>
    parsedRowsRaw.map((cells) => (cells[colIdx] !== undefined ? cells[colIdx] : "")),
  );

  const columns: ColumnMeta[] = headers.map((name, colIdx) => {
    const vals = columnValues[colIdx];
    const type = inferColumnType(vals);
    const unique = Array.from(new Set(vals.filter((v) => v !== "")));
    let min: number | undefined;
    let max: number | undefined;

    if (type === "number") {
      const nums = vals.filter((v) => NUMERIC_RE.test(v)).map(toNumberValue);
      if (nums.length > 0) {
        min = Math.min(...nums);
        max = Math.max(...nums);
      }
    }

    return {
      name,
      label: toHumanLabel(name),
      type,
      isNumeric: type === "number",
      uniqueCount: unique.length,
      min,
      max,
      sampleValues: unique.slice(0, 6),
    };
  });

  const rows: DataRow[] = parsedRowsRaw.map((cells) => {
    const row: DataRow = {};
    columns.forEach((col, idx) => {
      const raw = cells[idx] !== undefined ? cells[idx] : "";
      row[col.name] = col.isNumeric && NUMERIC_RE.test(raw) ? toNumberValue(raw) : raw;
    });
    return row;
  });

  return {
    name: tableName.replace(/\.csv$/i, ""),
    fileName,
    columns,
    rows,
  };
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
    for (const map of filterMaps) {
      for (const [col, allowed] of Object.entries(map)) {
        if (allowed && allowed.length > 0 && !allowed.includes(String(row[col] ?? ""))) {
          return false;
        }
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
): number {
  if (!field || rows.length === 0) return 0;
  if (aggregation === "count") return rows.length;
  const nums = rows
    .map((r) => Number(r[field]))
    .filter((n) => Number.isFinite(n));
  return reduceNumbers(nums, aggregation);
}

export function aggregateByDimension(
  rows: DataRow[],
  xAxis: string | undefined,
  yFields: string[],
  aggregation: AggregationFn = "sum",
  primaryColor: string = POWERBI_SERIES_PALETTE[0],
): GroupedAggregationResult {
  const fields = yFields.length > 0 ? yFields : [];
  const buckets = new Map<string, DataRow[]>();

  if (!xAxis) {
    const label = "All";
    buckets.set(label, rows);
  } else {
    for (const row of rows) {
      const key = String(row[xAxis] ?? "(Blank)");
      const list = buckets.get(key);
      if (list) list.push(row);
      else buckets.set(key, [row]);
    }
  }

  const series = fields.map((f, idx) => ({
    key: f,
    label: toHumanLabel(f),
    color: idx === 0 ? primaryColor : POWERBI_SERIES_PALETTE[idx % POWERBI_SERIES_PALETTE.length],
  }));

  const groupedRows = Array.from(buckets.entries()).map(([category, groupRows]) => {
    const values: Record<string, number> = {};
    let total = 0;
    for (const f of fields) {
      const effAgg = isRateOrPercentageColumn(f) && aggregation === "sum" ? "average" : aggregation;
      const val = aggregateKpi(groupRows, f, effAgg);
      values[f] = val;
      total += val;
    }
    return { category, values, total };
  });

  // Sort chronologically for date dimensions, otherwise descending by first series (classic PBI behavior)
  const looksLikeDate =
    groupedRows.length > 1 &&
    groupedRows.slice(0, 5).every((r) => DATE_ISO_RE.test(r.category) || DATE_SLASH_RE.test(r.category));

  groupedRows.sort((a, b) => {
    if (looksLikeDate) return a.category.localeCompare(b.category);
    const primary = fields[0];
    if (!primary) return a.category.localeCompare(b.category);
    return (b.values[primary] ?? 0) - (a.values[primary] ?? 0);
  });

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

  if (type === "slicer") return xAxis ? toHumanLabel(xAxis) : "Slicer";
  if (type === "card") {
    const col = yAxis[0] || xAxis;
    return col ? `${aggWord} of ${toHumanLabel(col)}` : "KPI Card";
  }
  if (yAxis.length > 0 && xAxis) {
    const yLabels = yAxis.map((f) => `${isRateOrPercentageColumn(f) ? "Avg" : aggWord} of ${toHumanLabel(f)}`).join(" & ");
    return `${yLabels} by ${toHumanLabel(xAxis)}`;
  }
  if (yAxis.length > 0) return `${toHumanLabel(yAxis[0])}`;
  return "New Visual";
}

export function createDefaultReportPages(dataset: DatasetModel): ReportPage[] {
  const textCols = dataset.columns.filter((c) => c.type === "text");
  const dateCols = dataset.columns.filter((c) => c.type === "date");
  const numCols = dataset.columns.filter((c) => c.isNumeric);

  const primaryCat = textCols[0]?.name || dataset.columns[0]?.name || "Category";
  const dateCol = dateCols[0]?.name || primaryCat;

  const metric1 = numCols[0]?.name;
  const metric2 = numCols[1]?.name || metric1;
  const metric3 = numCols[2]?.name || metric1;
  const metric4 = numCols.find((c) => isRateOrPercentageColumn(c.name))?.name || numCols[3]?.name || metric2;

  const visualsPage1: PowerBiVisual[] = [];

  const kpiCandidates = [metric1, metric2, metric3, metric4].filter(Boolean) as string[];
  const kpiWidth = 228;
  kpiCandidates.slice(0, 4).forEach((m, i) => {
    const agg: AggregationFn = isRateOrPercentageColumn(m) ? "average" : "sum";
    visualsPage1.push({
      id: `v-kpi-${i + 1}`,
      type: "card",
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

  // Top-right Slicer card for quick manual screenshots & filtering
  visualsPage1.push({
    id: "v-slicer-1",
    type: "slicer",
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
      title: getVisualDefaultTitle("clusteredBar", primaryCat, [metric4 || metric1], isRateOrPercentageColumn(metric4 || metric1) ? "average" : "sum"),
      xAxis: primaryCat,
      yAxis: [metric4 || metric1],
      aggregation: isRateOrPercentageColumn(metric4 || metric1) ? "average" : "sum",
      layout: { x: 386, y: 428, w: 578, h: 276 },
      format: defaultFormat("#12239E"),
      visualFilters: {},
    });
  }

  // Bottom-right Summary Data Table
  visualsPage1.push({
    id: "v-table-1",
    type: "table",
    title: `${toHumanLabel(primaryCat)} Summary`,
    xAxis: primaryCat,
    yAxis: numCols.slice(0, 3).map((c) => c.name),
    aggregation: "sum",
    layout: { x: 980, y: 274, w: 284, h: 430 },
    format: defaultFormat(POWERBI_SERIES_PALETTE[0]),
    visualFilters: {},
  });

  // Page 2: Channel / Metric Deep Dive
  const visualsPage2: PowerBiVisual[] = [];
  if (metric1) {
    visualsPage2.push({
      id: "v-p2-area",
      type: "area",
      title: getVisualDefaultTitle("area", dateCol, [metric1, metric2 || metric1].filter((v, i, a) => a.indexOf(v) === i), "sum"),
      xAxis: dateCol,
      yAxis: [metric1, metric2 || metric1].filter((v, i, a) => a.indexOf(v) === i),
      aggregation: "sum",
      layout: { x: 16, y: 16, w: 618, h: 332 },
      format: defaultFormat("#118DFF"),
      visualFilters: {},
    });

    visualsPage2.push({
      id: "v-p2-funnel",
      type: "funnel",
      title: getVisualDefaultTitle("funnel", primaryCat, [metric3 || metric1], "sum"),
      xAxis: primaryCat,
      yAxis: [metric3 || metric1],
      aggregation: "sum",
      layout: { x: 648, y: 16, w: 616, h: 332 },
      format: defaultFormat("#E66C37"),
      visualFilters: {},
    });

    visualsPage2.push({
      id: "v-p2-pie",
      type: "pie",
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
      name: "Trend & Breakdown",
      visuals: visualsPage2,
      pageFilters: {},
    },
  ];
}
