import type { PowerBiTheme, PowerBiVisualType } from "./types.ts";

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

export const POWERBI_THEMES: ReadonlyArray<PowerBiTheme> = [
  {
    id: "default",
    name: "Default",
    palette: POWERBI_SERIES_PALETTE,
    canvasBg: "#ffffff",
    visualBg: "#ffffff",
  },
  {
    id: "executive",
    name: "Executive",
    palette: ["#117865", "#252423", "#D9B300", "#01B8AA", "#FD625E", "#8AD4EB", "#A66999", "#374649"],
    canvasBg: "#faf9f8",
    visualBg: "#ffffff",
  },
  {
    id: "frontier",
    name: "Frontier",
    palette: ["#41A4FF", "#0066C2", "#31C48D", "#E05A47", "#7D4CDB", "#F59E0B", "#0E9F6E", "#6B7280"],
    canvasBg: "#ffffff",
    visualBg: "#ffffff",
  },
  {
    id: "innovate",
    name: "Innovate",
    palette: ["#6B007B", "#E044A7", "#118DFF", "#E66C37", "#00B294", "#F2C80F", "#374649", "#5F6B6D"],
    canvasBg: "#fcfbfd",
    visualBg: "#ffffff",
  },
  {
    id: "highContrast",
    name: "High Contrast",
    palette: ["#0078D4", "#D83B01", "#107C10", "#5C2D91", "#B4009E", "#FFB900", "#008272", "#323130"],
    canvasBg: "#ffffff",
    visualBg: "#ffffff",
  },
  {
    id: "solar",
    name: "Solar",
    palette: ["#D97706", "#0D9488", "#2563EB", "#DC2626", "#7C3AED", "#059669", "#DB2777", "#4B5563"],
    canvasBg: "#fffdf9",
    visualBg: "#ffffff",
  },
];

export const VISUAL_GALLERY_ITEMS: ReadonlyArray<{
  type: PowerBiVisualType;
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
  { type: "textbox", label: "Text box" },
];
