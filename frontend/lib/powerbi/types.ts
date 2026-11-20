export type ColumnType = "text" | "number" | "date";

export type AggregationFn = "sum" | "average" | "count" | "min" | "max";

export interface ColumnMeta {
  name: string;
  label: string;
  type: ColumnType;
  isNumeric: boolean;
  uniqueCount: number;
  min?: number;
  max?: number;
  sampleValues: string[];
  missingCount?: number;
  invalidCount?: number;
  isCalculated?: boolean;
  formula?: string;
  defaultAggregation?: AggregationFn;
}

export interface MeasureDef {
  id: string;
  name: string;
  tableId: string;
  formula: string;
  format?: "auto" | "number" | "currency" | "percent";
}

export interface TableRelationship {
  id: string;
  fromTableId: string;
  fromColumn: string;
  toTableId: string;
  toColumn: string;
  cardinality: "many-to-one" | "one-to-many" | "one-to-one";
  active: boolean;
}

export type PowerBiVisualType =
  | "stackedBar"
  | "stackedColumn"
  | "clusteredBar"
  | "clusteredColumn"
  | "line"
  | "area"
  | "pie"
  | "donut"
  | "funnel"
  | "scatter"
  | "treemap"
  | "gauge"
  | "card"
  | "slicer"
  | "table"
  | "matrix"
  | "textbox";

export interface VisualLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VisualFormat {
  showTitle: boolean;
  showDataLabels: boolean;
  showLegend: boolean;
  accentColor: string;
  backgroundColor: string;
  showBorder: boolean;
}

export interface VisualAnalytics {
  showAverageLine?: boolean;
  constantLineValue?: number;
  constantLineLabel?: string;
}

export interface NumericRangeFilter {
  min?: number;
  max?: number;
}

export interface PowerBiVisual {
  id: string;
  type: PowerBiVisualType;
  title: string;
  tableId?: string;
  xAxis?: string;
  yAxis: string[];
  legend?: string;
  tooltipFields?: string[];
  aggregation: AggregationFn;
  perFieldAggregations?: Record<string, AggregationFn>;
  sortBy?: "value" | "category";
  sortDir?: "asc" | "desc";
  textContent?: string;
  fontSize?: number;
  layout: VisualLayout;
  format: VisualFormat;
  analytics?: VisualAnalytics;
  visualFilters: Record<string, string[]>;
  numericFilters?: Record<string, NumericRangeFilter>;
  zIndex?: number;
}

export interface ReportPage {
  id: string;
  name: string;
  hidden?: boolean;
  visuals: PowerBiVisual[];
  pageFilters: Record<string, string[]>;
  numericFilters?: Record<string, NumericRangeFilter>;
}

export type DataRow = Record<string, string | number | null>;

export interface DatasetModel {
  id?: string;
  name: string;
  fileName: string;
  columns: ColumnMeta[];
  rows: DataRow[];
  missingCount?: number;
  invalidCount?: number;
  modelPosition?: { x: number; y: number };
}

export type ViewMode = "report" | "table" | "model";

export type RibbonTab =
  | "File"
  | "Home"
  | "Insert"
  | "Modeling"
  | "View"
  | "Format";

export interface CrossFilterSelection {
  tableId?: string;
  column: string;
  value: string;
  sourceVisualId: string;
}

export interface DateRangeFilter {
  column: string;
  from: string;
  to: string;
}

export interface FilterEvaluationInput {
  reportFilters?: Record<string, string[]>;
  pageFilters?: Record<string, string[]>;
  slicerFilters?: Record<string, string[]>;
  visualFilters?: Record<string, string[]>;
  numericFilters?: Record<string, NumericRangeFilter>;
  crossFilter?: CrossFilterSelection | null;
  dateRange?: DateRangeFilter | null;
}

export interface GroupedSeries {
  key: string;
  label: string;
  color: string;
}

export interface GroupedRow {
  category: string;
  values: Record<string, number>;
  total: number;
}

export interface GroupedAggregationResult {
  categories: string[];
  series: GroupedSeries[];
  rows: GroupedRow[];
  maxVal: number;
  minVal: number;
}

export interface PivotMatrixResult {
  rowHeaders: string[];
  colHeaders: string[];
  cells: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  grandTotal: number;
}

export interface PowerBiTheme {
  id: string;
  name: string;
  palette: readonly string[];
  canvasBg: string;
  visualBg: string;
}
