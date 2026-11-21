import { addOrUpdateCalculatedColumn, aggregateKpi, changeColumnType, handleMissingValues, parseCsvText, recomputeColumnMetas, resolveTableRows } from "./csvEngine";
import { evaluateMeasure } from "./formulaEngine";
import type { DataRow, DatasetModel, MeasureDef, PowerBiVisual, PowerBiVisualType, ReportPage, TableRelationship, ViewMode } from "./types";

export interface PowerBiPracticalFrame {
  id: string;
  title: string;
  explain: string;
  tables: DatasetModel[];
  page: ReportPage;
  view: ViewMode;
  measures: MeasureDef[];
  relationships: TableRelationship[];
  slicer?: Record<string, string[]>;
  steps?: string[];
}

const SALES = "Date,Month,Region,Product,Quantity,UnitPrice\n2026-01-12,Jan,North,Keyboard,2,500\n2026-01-20,Jan,South,Mouse,3,300\n2026-02-11,Feb,North,Mouse,4,300\n2026-02-18,Feb,South,Keyboard,1,500";
const EMPTY_PAGE = { id: "practical", name: "Results", pageFilters: {} };

export function powerBiPractical(topic: string): PowerBiPracticalFrame[] {
  const frames: PowerBiPracticalFrame[] = [];
  const sales = { ...parseCsvText(SALES, "Sales", "sales.csv"), id: "sales" };
  const calculated = addOrUpdateCalculatedColumn(sales, "SalesAmount", "[Quantity] * [UnitPrice]");
  if (calculated.error || aggregateKpi(calculated.table.rows, "SalesAmount", "sum") !== 3600) throw new Error("Sales totals failed verification.");
  const salesTable = calculated.table;
  function visual(id: string, type: PowerBiVisualType, title: string, tableId: string, xAxis: string | undefined,
    yAxis: string[], x: number, y: number, w: number, h: number): PowerBiVisual {
    return { id, type, title, tableId, xAxis, yAxis, aggregation: "sum", layout: { x, y, w, h }, visualFilters: {},
      format: { showTitle: true, showDataLabels: true, showLegend: false, accentColor: "#117865", backgroundColor: "#ffffff", showBorder: true } };
  }
  function add(title: string, explain: string, tables: DatasetModel[], view: ViewMode,
    visuals: PowerBiVisual[] = [], options: Partial<Pick<PowerBiPracticalFrame, "measures" | "relationships" | "slicer" | "steps">> = {}) {
    frames.push({ id: "step" + (frames.length + 1), title, explain, tables, view, page: { ...EMPTY_PAGE, visuals },
      measures: [], relationships: [], ...options });
  }
  const total = visual("total", "card", "Total sales", "sales", undefined, ["SalesAmount"], 24, 24, 330, 145);
  const region = visual("region", "clusteredBar", "Sales by region", "sales", "Region", ["SalesAmount"], 24, 195, 800, 430);

  if (topic === "sales-dashboard") {
    const units = renameQuantity(salesTable);
    add("Sales table with calculated column", "SalesAmount = [Units] * [UnitPrice].", [units], "table");
    add("Sales dashboard", "Total sales 3,600. North 2,200 and South 1,400.", [units], "report", [total, region]);
  } else if (topic === "clean-sales") {
    const dirty = { ...parseCsvText("Region,Quantity\nnorth,2\n North ,2\nSouth,\nsouth,3", "Sales import", "unclean-sales.csv"), id: "sales" };
    add("Raw imported data", "Four rows, including a blank quantity and inconsistent region labels.", [dirty], "table");
    const filled = handleMissingValues(dirty, "Quantity", "drop");
    const typed = changeColumnType(filled, "Quantity", "number");
    const rows = typed.rows.map<DataRow>((row) => ({ ...row, Region: String(row.Region).trim().toLowerCase().replace(/^./, (c) => c.toUpperCase()) }));
    const unique = Array.from(new Map(rows.map((row) => [JSON.stringify(row), row])).values());
    if (unique.length !== 2 || unique.some((row) => typeof row.Quantity !== "number")) throw new Error("Data cleanup failed verification.");
    add("Power Query transformations", "Two clean rows remain after standardisation, filtering and deduplication.",
      [{ ...typed, rows: unique, ...recomputeColumnMetas(typed.columns, unique) }], "table", [], {
        steps: ["Source", "Removed blank quantities", "Set Quantity to number", "Trimmed and standardised region names", "Removed duplicate rows"],
      });
  } else if (topic === "relationships") {
    const customers = { ...parseCsvText("CustomerID,Customer\n1,Asha\n2,Dev", "Customers", "customers.csv"), id: "customers", modelPosition: { x: 90, y: 120 } };
    const orders = { ...parseCsvText("OrderID,CustomerID,Amount\nA1,1,200\nA2,1,350\nA3,2,150", "Orders", "orders.csv"), id: "orders", modelPosition: { x: 470, y: 120 } };
    const tables = [orders, customers];
    const relationships: TableRelationship[] = [{ id: "customer-orders", fromTableId: "customers", fromColumn: "CustomerID",
      toTableId: "orders", toColumn: "CustomerID", cardinality: "one-to-many", active: true }];
    add("Customer and order model", "Customers[CustomerID] links one to many to Orders[CustomerID].", tables, "model", [], { relationships });
    const cards = ["Asha", "Dev"].map((name, index) => {
      const filter = { Customer: [name] };
      const rows = resolveTableRows("orders", tables, relationships, { visualFilters: filter });
      if (aggregateKpi(rows, "Amount", "sum") !== [550, 150][index]) throw new Error("Customer filter did not propagate.");
      return { ...visual("customer-" + index, "card", name, "orders", undefined, ["Amount"], 24 + 365 * index, 24, 340, 175), visualFilters: filter };
    });
    add("Orders by customer", "Asha 550. Dev 150.", tables, "report", cards, { relationships });
  } else if (topic === "dax-measures") {
    const names = ["Total Sales", "Total Units", "Average Sale"];
    const formulas = ["SUM([SalesAmount])", "SUM([Quantity])", "AVERAGE([SalesAmount])"];
    const measures = names.map((name, index) => ({ id: "measure-" + index, name, tableId: "sales", formula: formulas[index] }));
    measures.forEach((measure, i) => {
      const result = evaluateMeasure(measure.formula, salesTable.rows, salesTable.columns, measures);
      if (result.error || result.value !== [3600, 10, 900][i]) throw new Error(measure.name + " failed verification: " + (result.error || result.value));
    });
    add("Data model table with SalesAmount and explicit DAX measures", "Verified SalesAmount = [Quantity] * [UnitPrice] column and attached Total Sales, Total Units, and Average Sale measures to the sales table.", [salesTable], "table", [], { measures });
    add("Calculated measure values", "SalesAmount = [Quantity] * [UnitPrice]. " + measures.map((m) => m.name + " = " + m.formula).join(". "), [salesTable], "report",
      measures.map((m, i) => visual(m.id, "card", m.name, "sales", undefined, [m.name], 24 + 385 * i, 26, 350, 165)), { measures });
  } else if (topic === "region-slicer") {
    const report = [total, region, visual("month", "line", "Sales by month", "sales", "Month", ["SalesAmount"], 850, 195, 390, 430),
      visual("slicer", "slicer", "Region", "sales", "Region", [], 850, 25, 390, 145)];
    const slicer = { Region: ["North"] };
    const filtered = resolveTableRows("sales", [salesTable], [], { slicerFilters: slicer });
    if (aggregateKpi(filtered, "SalesAmount", "sum") !== 2200) throw new Error("The region slicer failed verification.");
    add("Report before selecting a region", "All regions contribute 3,600.", [salesTable], "report", report);
    add("Report filtered to North", "North contributes 2,200 after the region selection.", [salesTable], "report", report, { slicer });
  } else {
    throw new Error("Unknown Power BI practical.");
  }
  return frames;
}

function renameQuantity(table: DatasetModel) {
  // Recalculate using the column name required by the dashboard manual.
  const units = { ...parseCsvText(SALES.replace("Quantity", "Units"), table.name, table.fileName), id: "sales" };
  const result = addOrUpdateCalculatedColumn(units, "SalesAmount", "[Units] * [UnitPrice]");
  if (result.error) throw new Error(result.error);
  return result.table;
}
