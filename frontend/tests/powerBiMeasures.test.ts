import test from "node:test";
import assert from "node:assert/strict";

import { aggregateByDimension, parseCsvText } from "../lib/powerbi/csvEngine.ts";
import { evaluateMeasure } from "../lib/powerbi/formulaEngine.ts";
import type { MeasureDef } from "../lib/powerbi/types.ts";

const CSV = [
  "Region,Year,Price,Qty,Amount",
  "North,2024,10,2,20",
  "North,2025,10,3,30",
  "South,2024,5,4,20",
  "South,2025,5,6,30",
  "East,2024,8,5,40",
  "East,2025,8,5,40",
].join("\n");

const table = parseCsvText(CSV, "sales.csv");
const columns = table.columns;
const rows = table.rows;
type Scope = { scope: typeof rows; all: typeof rows; groupBy?: string[] };
const value = (formula: string, context = rows, scope?: Scope, measures: MeasureDef[] = []) => {
  const r = evaluateMeasure(formula, context, columns, measures, [], scope);
  assert.equal(r.error, undefined, r.error);
  return r.value;
};
const ofRegion = (region: string) => rows.filter((r) => r.Region === region);

test("a column may be qualified with its table name, quoted or not", () => {
  assert.equal(value("SUM(Sales[Amount])"), 180);
  assert.equal(value("SUM('Sales'[Amount])"), 180);
  assert.equal(value("COUNTROWS(Sales)"), 6);
});

test("CALCULATE replaces the filter on the column it names", () => {
  // The cell is the South group, but the measure asks for North: CALCULATE drops the Region filter and applies its own.
  const scope = { scope: rows, all: rows, groupBy: ["Region"] };
  assert.equal(value('CALCULATE(SUM(Sales[Amount]), Sales[Region] = "North")', ofRegion("South"), scope), 50);
  assert.equal(value('CALCULATE(SUM(Sales[Amount]), Sales[Region] = "North")', rows, { scope: rows, all: rows }), 50);
});

test("CALCULATE keeps the other filters of the cell", () => {
  const scope = { scope: rows, all: rows, groupBy: ["Region", "Year"] };
  const southSecond = rows.filter((r) => r.Region === "South" && r.Year === 2025);
  // Region and Year are both fixed by this cell; only Region is replaced, Year 2025 stays.
  const r = evaluateMeasure('CALCULATE(SUM([Amount]), [Region] = "North")', southSecond, columns, [], [], scope);
  assert.equal(r.value, 30);
});

test("percent of total: ALL removes every filter, ALLSELECTED keeps the slicers", () => {
  const slicer2024 = rows.filter((r) => r.Year === 2024);
  const south2024 = slicer2024.filter((r) => r.Region === "South");
  const scope = { scope: slicer2024, all: rows, groupBy: ["Region"] };
  assert.equal(value("CALCULATE(SUM([Amount]), ALL(Sales))", south2024, scope), 180);
  assert.equal(value("CALCULATE(SUM([Amount]), ALLSELECTED(Sales))", south2024, scope), 80);
  assert.equal(value("DIVIDE(SUM([Amount]), CALCULATE(SUM([Amount]), ALLSELECTED(Sales)))", south2024, scope), 0.25);
});

test("CALCULATE accepts FILTER and several conditions", () => {
  const scope = { scope: rows, all: rows };
  assert.equal(value("CALCULATE(SUM([Amount]), FILTER(Sales, [Price] > 6))", rows, scope), 130);
  assert.equal(value('CALCULATE(SUM([Amount]), [Region] = "East", [Year] = 2025)', rows, scope), 40);
});

test("iterators multiply row by row", () => {
  assert.equal(value("SUMX(Sales, [Price] * [Qty])"), 10 * 2 + 10 * 3 + 5 * 4 + 5 * 6 + 8 * 5 + 8 * 5);
  assert.equal(value("MAXX(Sales, [Qty])"), 6);
  assert.equal(value("COUNTROWS(FILTER(Sales, [Qty] > 4))"), 3);
  assert.equal(value("AVERAGEX(Sales, [Amount])"), 30);
});

test("a measure that uses CALCULATE is right in every bar of a chart", () => {
  const measures: MeasureDef[] = [
    { id: "m1", name: "North Sales", tableId: "sales", formula: 'CALCULATE(SUM([Amount]), [Region] = "North")' },
    { id: "m2", name: "Share", tableId: "sales", formula: "DIVIDE(SUM([Amount]), CALCULATE(SUM([Amount]), ALL(Sales)))" },
  ];
  const scope = { scope: rows, all: rows };
  const north = aggregateByDimension(rows, "Region", ["North Sales"], "sum", "#000", { measures, columns, scope });
  assert.deepEqual(north.rows.map((r) => r.values["North Sales"]), north.rows.map(() => 50));
  const share = aggregateByDimension(rows, "Region", ["Share"], "sum", "#000", { measures, columns, scope });
  const byRegion = Object.fromEntries(share.rows.map((r) => [r.category, r.values["Share"]]));
  assert.equal(Math.round(byRegion["North"] * 1000), 278);
  assert.equal(Math.round(byRegion["East"] * 1000), 444);
});

test("a table is required where a table is expected", () => {
  const r = evaluateMeasure("SUMX([Amount], [Price])", rows, columns, []);
  assert.match(r.error ?? "", /table is expected/i);
});
