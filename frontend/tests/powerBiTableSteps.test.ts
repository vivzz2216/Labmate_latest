import test from "node:test";
import assert from "node:assert/strict";

import { parseCsvText } from "../lib/powerbi/csvEngine.ts";
import { applyTableStep, describeTableStep } from "../lib/powerbi/tableSteps.ts";
import type { TableStep } from "../lib/powerbi/tableSteps.ts";

const CSV = ["Name,Region,Sales", "Asha,North,120", "Ravi,South,80", "Meera,North,200", "Ravi,South,80", "Kabir,East,", "Zoya,East,45"].join("\n");
const table = parseCsvText(CSV, "sales.csv");
const run = (step: TableStep, t = table) => applyTableStep(t, step);
const names = (t: typeof table) => t.rows.map((r) => r.Name);

test("filter rows compares numbers as numbers", () => {
  assert.deepEqual(names(run({ kind: "filterRows", column: "Sales", op: "gt", value: "100" }).table), ["Asha", "Meera"]);
  assert.deepEqual(names(run({ kind: "filterRows", column: "Sales", op: "lte", value: "80" }).table), ["Ravi", "Ravi", "Zoya"]);
  // 9 < 80 numerically, but "9" > "80" as text: the filter must not compare as text.
  const many = parseCsvText("n\n9\n80\n100", "n.csv");
  assert.deepEqual(applyTableStep(many, { kind: "filterRows", column: "n", op: "lt", value: "80" }).table.rows.map((r) => r.n), [9]);
});

test("filter rows by text and blanks", () => {
  assert.deepEqual(names(run({ kind: "filterRows", column: "Region", op: "equals", value: "north" }).table), ["Asha", "Meera"]);
  assert.deepEqual(names(run({ kind: "filterRows", column: "Region", op: "contains", value: "ou" }).table), ["Ravi", "Ravi"]);
  assert.deepEqual(names(run({ kind: "filterRows", column: "Sales", op: "notBlank", value: "" }).table), ["Asha", "Ravi", "Meera", "Ravi", "Zoya"]);
});

test("column statistics are recomputed after a step", () => {
  const out = run({ kind: "filterRows", column: "Sales", op: "gt", value: "100" }).table;
  const sales = out.columns.find((c) => c.name === "Sales")!;
  assert.equal(sales.min, 120);
  assert.equal(sales.max, 200);
  assert.equal(out.missingCount, 0);
});

test("sort rows numerically, blanks last, stable", () => {
  assert.deepEqual(names(run({ kind: "sortRows", column: "Sales", desc: false }).table), ["Zoya", "Ravi", "Ravi", "Asha", "Meera", "Kabir"]);
  assert.deepEqual(names(run({ kind: "sortRows", column: "Sales", desc: true }).table), ["Meera", "Asha", "Ravi", "Ravi", "Zoya", "Kabir"]);
});

test("remove duplicates keeps the first of identical rows", () => {
  const out = run({ kind: "removeDuplicates" }).table;
  assert.equal(out.rows.length, 5);
  assert.deepEqual(names(out), ["Asha", "Ravi", "Meera", "Kabir", "Zoya"]);
});

test("replace values keeps numeric columns numeric", () => {
  const out = run({ kind: "replaceValues", column: "Sales", find: "80", replace: "85" }).table;
  assert.deepEqual(out.rows.map((r) => r.Sales).filter((v) => v === 85).length, 2);
  assert.equal(typeof out.rows[1].Sales, "number");
  const text = run({ kind: "replaceValues", column: "Region", find: "East", replace: "West" }).table;
  assert.deepEqual(text.rows.map((r) => r.Region).slice(-2), ["West", "West"]);
});

test("keep top rows", () => {
  assert.equal(run({ kind: "keepTopRows", count: 2 }).table.rows.length, 2);
  assert.match(run({ kind: "keepTopRows", count: 0 }).error ?? "", /whole number/);
});

test("a step on a missing column is refused and leaves the table alone", () => {
  const r = run({ kind: "sortRows", column: "Nope", desc: false });
  assert.match(r.error ?? "", /no column named "Nope"/);
  assert.equal(r.table, table);
});

test("steps are described in Power Query's words", () => {
  assert.equal(describeTableStep({ kind: "filterRows", column: "Sales", op: "gt", value: "100" }), "Filtered Rows (Sales is greater than 100)");
  assert.equal(describeTableStep({ kind: "sortRows", column: "Sales", desc: true }), "Sorted Rows (Sales descending)");
});
