import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  parseCsvText,
  createDefaultReportPages,
  applyDatasetFilters,
  aggregateByDimension,
  aggregateKpi,
  formatPowerBiNumber,
} from "../lib/powerbi/csvEngine.ts";

const SMA_CSV_PATH = resolve(
  process.cwd(),
  "..",
  "backend",
  "app",
  "lab_data",
  "sma",
  "social_kpi_powerbi.csv",
);

test("PBI-1: parses quoted CSV fields, detects numeric/date/text columns, and handles social_kpi_powerbi.csv", () => {
  const raw = readFileSync(SMA_CSV_PATH, "utf8");
  const model = parseCsvText(raw, "social_kpi_powerbi", "social_kpi_powerbi.csv");

  assert.equal(model.name, "social_kpi_powerbi");
  assert.equal(model.rows.length, 360);
  assert.equal(model.columns.length, 10);

  const byName = new Map(model.columns.map((c) => [c.name, c]));
  assert.equal(byName.get("date")?.type, "date");
  assert.equal(byName.get("platform")?.type, "text");
  assert.equal(byName.get("platform")?.uniqueCount, 4);
  assert.equal(byName.get("impressions")?.type, "number");
  assert.equal(byName.get("engagement_rate")?.type, "number");
});

test("PBI-2: creates non-overlapping 16:9 starter report pages for uploaded CSV", () => {
  const raw = readFileSync(SMA_CSV_PATH, "utf8");
  const model = parseCsvText(raw, "social_kpi_powerbi", "social_kpi_powerbi.csv");
  const pages = createDefaultReportPages(model);

  assert.ok(pages.length >= 2);
  const overview = pages[0];
  assert.ok(overview.visuals.length >= 6);

  // Confirm all coordinates stay within 1280x720 page canvas and include core visuals + slicer
  for (const v of overview.visuals) {
    assert.ok(v.layout.x >= 0 && v.layout.x + v.layout.w <= 1280, `${v.id} exceeds width`);
    assert.ok(v.layout.y >= 0 && v.layout.y + v.layout.h <= 720, `${v.id} exceeds height`);
  }
  assert.ok(overview.visuals.some((v) => v.type === "card"));
  assert.ok(overview.visuals.some((v) => v.type === "clusteredColumn"));
  assert.ok(overview.visuals.some((v) => v.type === "line"));
  assert.ok(overview.visuals.some((v) => v.type === "donut"));
  assert.ok(overview.visuals.some((v) => v.type === "slicer"));
});

test("PBI-3: generates clean starter report for any arbitrary user CSV without throwing", () => {
  const customCsv = [
    'region,category,"revenue, usd",orders',
    'West,"Electronics",12500.5,42',
    'East,"Books & Media",4300,19',
    'West,"Home",7800,31',
  ].join("\n");

  const model = parseCsvText(customCsv, "quarterly_sales", "quarterly_sales.csv");
  assert.equal(model.rows.length, 3);
  assert.equal(model.columns[2].name, "revenue, usd");
  assert.equal(model.columns[2].isNumeric, true);

  const pages = createDefaultReportPages(model);
  assert.ok(pages[0].visuals.length >= 4);
});

test("PBI-4: evaluates multi-scope filters (report, page, slicer, crossFilter, dateRange) conjunctively", () => {
  const raw = readFileSync(SMA_CSV_PATH, "utf8");
  const model = parseCsvText(raw, "social_kpi_powerbi", "social_kpi_powerbi.csv");

  const filtered = applyDatasetFilters(model.rows, {
    reportFilters: { platform: ["Instagram", "LinkedIn"] },
    pageFilters: {},
    slicerFilters: { platform: ["Instagram"] },
    visualFilters: {},
    crossFilter: null,
    dateRange: { column: "date", from: "2026-01-01", to: "2026-01-10" },
  });

  assert.equal(filtered.length, 10);
  assert.ok(filtered.every((r) => r.platform === "Instagram"));
  assert.ok(filtered.every((r) => String(r.date) <= "2026-01-10"));
});

test("PBI-5: computes KPI metrics, grouped aggregations, and Power BI display unit formatting", () => {
  const raw = readFileSync(SMA_CSV_PATH, "utf8");
  const model = parseCsvText(raw, "social_kpi_powerbi", "social_kpi_powerbi.csv");

  const grouped = aggregateByDimension(model.rows, "platform", ["impressions", "likes"], "sum");
  assert.equal(grouped.categories.length, 4);
  assert.ok(grouped.series.length === 2);
  assert.ok(grouped.rows[0].values.impressions > 0);

  const avgEng = aggregateKpi(model.rows, "engagement_rate", "average");
  assert.ok(avgEng > 0 && avgEng < 50);

  assert.equal(formatPowerBiNumber(1540000), "1.54M");
  assert.equal(formatPowerBiNumber(45200), "45.20K");
  assert.equal(formatPowerBiNumber(8.423, "engagement_rate"), "8.42%");
});
