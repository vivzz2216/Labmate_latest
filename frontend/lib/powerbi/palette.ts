export const POWERBI_TOKENS = {
  tealAccent: "#117865",
  tealHover: "#0d5e4f",
  tealSoft: "#e6f2ef",
  canvasOuter: "#eaeaea",
  canvasPage: "#ffffff",
  chromeSurface: "#f3f2f1",
  chromeWhite: "#ffffff",
  paneSurface: "#fafafa",
  borderSubtle: "#e1dfdd",
  borderStrong: "#c8c6c4",
  textPrimary: "#252423",
  textSecondary: "#605e5c",
  textMuted: "#797775",
} as const;

/** Official Power BI Desktop default qualitative chart palette (observed from Microsoft docs & Desktop) */
export const POWERBI_SERIES_PALETTE = [
  "#118DFF",
  "#12239E",
  "#E66C37",
  "#6B007B",
  "#E044A7",
  "#744EC2",
  "#D9B300",
  "#D64550",
] as const;

export const VISUAL_GALLERY_ITEMS: ReadonlyArray<{
  type:
    | "stackedBar"
    | "stackedColumn"
    | "clusteredBar"
    | "clusteredColumn"
    | "line"
    | "area"
    | "pie"
    | "donut"
    | "treemap"
    | "funnel"
    | "scatter"
    | "gauge"
    | "card"
    | "slicer"
    | "table"
    | "matrix";
  label: string;
}> = [
  { type: "stackedBar", label: "Stacked bar chart" },
  { type: "stackedColumn", label: "Stacked column chart" },
  { type: "clusteredBar", label: "Clustered bar chart" },
  { type: "clusteredColumn", label: "Clustered column chart" },
  { type: "line", label: "Line chart" },
  { type: "area", label: "Area chart" },
  { type: "funnel", label: "Funnel" },
  { type: "scatter", label: "Scatter chart" },
  { type: "pie", label: "Pie chart" },
  { type: "donut", label: "Donut chart" },
  { type: "treemap", label: "Treemap" },
  { type: "gauge", label: "Gauge" },
  { type: "card", label: "Card" },
  { type: "slicer", label: "Slicer" },
  { type: "table", label: "Table" },
  { type: "matrix", label: "Matrix" },
];
