export type ColumnType = "text" | "number" | "date";

export interface ColumnMeta {
  name: string;
  label: string;
  type: ColumnType;
  isNumeric: boolean;
  /** A DAX measure created with New measure (not a column of the file). */
  isMeasure?: boolean;
  uniqueCount: number;
  min?: number;
  max?: number;
  sampleValues: string[];
}

export type AggregationFn = "sum" | "average" | "count" | "min" | "max";

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
  | "matrix";

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

export interface PowerBiVisual {
  id: string;
  type: PowerBiVisualType;
  title: string;
  xAxis?: string;
  yAxis: string[];
  legend?: string;
  tooltipFields?: string[];
  aggregation: AggregationFn;
  layout: VisualLayout;
  format: VisualFormat;
  visualFilters: Record<string, string[]>;
}

export interface ReportPage {
  id: string;
  name: string;
  hidden?: boolean;
  visuals: PowerBiVisual[];
  pageFilters: Record<string, string[]>;
}

export type DataRow = Record<string, string | number>;

export interface DatasetModel {
  name: string;
  fileName: string;
  columns: ColumnMeta[];
  rows: DataRow[];
}

export type ViewMode = "report" | "table" | "model" | "dax" | "tmdl";

export type RibbonTab =
  | "File"
  | "Home"
  | "Insert"
  | "Modeling"
  | "Design"
  | "View"
  | "Optimize"
  | "Help"
  | "Format";

export interface CrossFilterSelection {
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
