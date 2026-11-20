import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateRawSync } from "node:zlib";

import {
  parseCsvText,
  createDefaultReportPages,
  applyDatasetFilters,
  aggregateByDimension,
  aggregateKpi,
  formatPowerBiNumber,
  renameTableColumn,
  changeColumnType,
  handleMissingValues,
  addOrUpdateCalculatedColumn,
  buildPivotMatrix,
  resolveTableRows,
  autoDetectRelationships,
} from "../lib/powerbi/csvEngine.ts";
import { parseExcelArrayBuffer } from "../lib/powerbi/excelParser.ts";
import { evaluateMeasure } from "../lib/powerbi/formulaEngine.ts";
import {
  RELATIONAL_ORDERS_CSV,
  RELATIONAL_PRODUCTS_CSV,
} from "../lib/powerbi/sampleCsv.ts";
import type { MeasureDef } from "../lib/powerbi/types.ts";

const SMA_CSV_PATH = resolve(
  process.cwd(),
  "..",
  "backend",
  "app",
  "lab_data",
  "sma",
  "social_kpi_powerbi.csv",
);

function buildTestZip(entries: Array<{ name: string; data: string }>): ArrayBuffer {
  const localParts: Buffer[] = [];
  const cdParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const rawBuf = Buffer.from(entry.data, "utf8");
    const compBuf = deflateRawSync(rawBuf);

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0, 6);
    lfh.writeUInt16LE(8, 8);
    lfh.writeUInt16LE(0, 10);
    lfh.writeUInt16LE(0, 12);
    lfh.writeUInt32LE(0, 14);
    lfh.writeUInt32LE(compBuf.length, 18);
    lfh.writeUInt32LE(rawBuf.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);

    const localChunk = Buffer.concat([lfh, nameBuf, compBuf]);
    localParts.push(localChunk);

    const cdfh = Buffer.alloc(46);
    cdfh.writeUInt32LE(0x02014b50, 0);
    cdfh.writeUInt16LE(20, 4);
    cdfh.writeUInt16LE(20, 6);
    cdfh.writeUInt16LE(0, 8);
    cdfh.writeUInt16LE(8, 10);
    cdfh.writeUInt16LE(0, 12);
    cdfh.writeUInt16LE(0, 14);
    cdfh.writeUInt32LE(0, 16);
    cdfh.writeUInt32LE(compBuf.length, 20);
    cdfh.writeUInt32LE(rawBuf.length, 24);
    cdfh.writeUInt16LE(nameBuf.length, 28);
    cdfh.writeUInt16LE(0, 30);
    cdfh.writeUInt16LE(0, 32);
    cdfh.writeUInt16LE(0, 34);
    cdfh.writeUInt16LE(0, 36);
    cdfh.writeUInt32LE(0, 38);
    cdfh.writeUInt32LE(offset, 42);

    cdParts.push(Buffer.concat([cdfh, nameBuf]));
    offset += localChunk.length;
  }

  const cdBuf = Buffer.concat(cdParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  const full = Buffer.concat([...localParts, cdBuf, eocd]);
  return full.buffer.slice(full.byteOffset, full.byteOffset + full.byteLength);
}

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

test("PBI-6: handles missing and invalid values gracefully without corrupting averages", () => {
  const dirtyCsv = [
    "region,sales,units",
    "North,100,10",
    "North,N/A,20",
    "South,,30",
    "South,null,bad",
    "East,200,40",
  ].join("\n");

  const model = parseCsvText(dirtyCsv, "dirty", "dirty.csv");
  const salesCol = model.columns.find((c) => c.name === "sales");
  const unitsCol = model.columns.find((c) => c.name === "units");

  assert.equal(salesCol?.type, "number");
  assert.equal(unitsCol?.type, "number");
  assert.equal(model.rows[1].sales, null);
  assert.equal(model.rows[2].sales, null);
  assert.equal(model.rows[3].units, null);
  assert.ok((model.missingCount ?? 0) >= 3);
  assert.ok((model.invalidCount ?? 0) >= 1);

  // Average of valid sales (100 and 200) must be 150, NOT diluted by nulls!
  assert.equal(aggregateKpi(model.rows, "sales", "average"), 150);
  assert.equal(aggregateKpi(model.rows, "sales", "min"), 100);
  assert.equal(aggregateKpi(model.rows, "sales", "max"), 200);
  assert.equal(aggregateKpi(model.rows, "sales", "count"), 2);
});

test("PBI-7: parses real multi-sheet .xlsx ZIP archive including sharedStrings and Excel dates", async () => {
  const xlsxBuf = buildTestZip([
    {
      name: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8"?>
        <workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <sheets>
            <sheet name="Sales" sheetId="1" r:id="rId1"/>
            <sheet name="Targets" sheetId="2" r:id="rId2"/>
          </sheets>
        </workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8"?>
        <Relationships>
          <Relationship Id="rId1" Target="worksheets/sheet1.xml"/>
          <Relationship Id="rId2" Target="worksheets/sheet2.xml"/>
        </Relationships>`,
    },
    {
      name: "xl/sharedStrings.xml",
      data: `<?xml version="1.0" encoding="UTF-8"?>
        <sst>
          <si><t>order_date</t></si>
          <si><t>region</t></si>
          <si><t>revenue</t></si>
          <si><t>North</t></si>
          <si><t>West</t></si>
          <si><t>target</t></si>
        </sst>`,
    },
    {
      name: "xl/styles.xml",
      data: `<?xml version="1.0" encoding="UTF-8"?>
        <styleSheet>
          <cellXfs>
            <xf numFmtId="0"/>
            <xf numFmtId="14"/>
          </cellXfs>
        </styleSheet>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet>
          <sheetData>
            <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
            <row r="2"><c r="A2" s="1"><v>46023</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>5400</v></c></row>
            <row r="3"><c r="A3" s="1"><v>46024</v></c><c r="B3" t="s"><v>4</v></c><c r="C3" t="e"><v>#N/A</v></c></row>
          </sheetData>
        </worksheet>`,
    },
    {
      name: "xl/worksheets/sheet2.xml",
      data: `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet>
          <sheetData>
            <row r="1"><c r="A1" t="s"><v>1</v></c><c r="B1" t="s"><v>5</v></c></row>
            <row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2"><v>10000</v></c></row>
          </sheetData>
        </worksheet>`,
    },
  ]);

  const sheets = await parseExcelArrayBuffer(xlsxBuf, "college_lab.xlsx");
  assert.equal(sheets.length, 2);
  assert.equal(sheets[0].sheetName, "Sales");
  assert.equal(sheets[0].dataset.rows.length, 2);
  assert.equal(sheets[0].dataset.rows[0].order_date, "2026-01-01");
  assert.equal(sheets[0].dataset.rows[0].region, "North");
  assert.equal(sheets[0].dataset.rows[0].revenue, 5400);
  assert.equal(sheets[0].dataset.rows[1].revenue, null);
  assert.equal(sheets[1].sheetName, "Targets");
  assert.equal(sheets[1].dataset.rows[0].target, 10000);
});

test("PBI-8: evaluates calculated column formulas including IF, DIVIDE, and string expressions", () => {
  const csv = "region,revenue,cost\nNorth,1000,600\nSouth,500,500\nEast,200,0";
  const model = parseCsvText(csv, "calc_test", "calc_test.csv");

  const r1 = addOrUpdateCalculatedColumn(model, "profit", "[revenue] - [cost]");
  assert.equal(r1.error, undefined);
  assert.equal(r1.table.rows[0].profit, 400);
  assert.equal(r1.table.rows[1].profit, 0);

  const r2 = addOrUpdateCalculatedColumn(
    r1.table,
    "margin_tier",
    'IF(DIVIDE([profit], [revenue], 0) >= 0.3, "High", "Standard")',
  );
  assert.equal(r2.error, undefined);
  assert.equal(r2.table.rows[0].margin_tier, "High");
  assert.equal(r2.table.rows[1].margin_tier, "Standard");
});

test("PBI-9: evaluates filter-context measures with nested measure references", () => {
  const model = parseCsvText(RELATIONAL_ORDERS_CSV, "Orders", "orders.csv");
  const measures: MeasureDef[] = [
    { id: "m1", name: "Total Sales", tableId: model.id || "Orders", formula: "SUM([sales_amount])" },
    { id: "m2", name: "Order Count", tableId: model.id || "Orders", formula: "COUNTROWS()" },
    {
      id: "m3",
      name: "Avg Order Value",
      tableId: model.id || "Orders",
      formula: "DIVIDE([Total Sales], [Order Count], 0)",
    },
  ];

  const avgOrder = evaluateMeasure("[Avg Order Value]", model.rows, model.columns, measures);
  assert.equal(avgOrder.error, undefined);
  assert.ok(avgOrder.value > 2000 && avgOrder.value < 6000);

  const byRegion = aggregateByDimension(model.rows, "region", ["Avg Order Value"], "sum", "#118DFF", {
    measures,
    columns: model.columns,
  });
  assert.equal(byRegion.categories.length, 4);
  assert.ok(byRegion.rows[0].values["Avg Order Value"] > 0);
});

test("PBI-10: renames columns, converts types, and cleans missing values", () => {
  const csv = "dept,score\nCS,88\nCS,\nIT,92";
  const model = parseCsvText(csv, "grades", "grades.csv");

  const renamed = renameTableColumn(model, "score", "exam_score");
  assert.ok(renamed.columns.some((c) => c.name === "exam_score"));
  assert.equal(renamed.rows[0].exam_score, 88);

  const filled = handleMissingValues(renamed, "exam_score", "fillAverage");
  assert.equal(filled.rows[1].exam_score, 90);

  const asText = changeColumnType(filled, "exam_score", "text");
  assert.equal(asText.columns.find((c) => c.name === "exam_score")?.type, "text");
  assert.equal(asText.rows[0].exam_score, "88");
});

test("PBI-11: computes pivot matrix, legend split series, sorting, and numeric range filters", () => {
  const model = parseCsvText(RELATIONAL_ORDERS_CSV, "Orders", "orders.csv");

  const matrix = buildPivotMatrix(
    model.rows,
    "region",
    "product_id",
    "sales_amount",
    "sum",
    undefined,
    model.columns,
  );
  assert.equal(matrix.rowHeaders.length, 4);
  assert.equal(matrix.colHeaders.length, 5);
  assert.ok(matrix.grandTotal > 0);

  const withLegend = aggregateByDimension(model.rows, "region", ["sales_amount"], "sum", "#118DFF", {
    legendCol: "product_id",
    sortBy: "category",
    sortDir: "asc",
  });
  assert.equal(withLegend.categories[0], "East");
  assert.equal(withLegend.series.length, 5);

  const filteredHighQty = applyDatasetFilters(model.rows, {
    numericFilters: { quantity: { min: 7 } },
  });
  assert.ok(filteredHighQty.length > 0);
  assert.ok(filteredHighQty.every((r) => Number(r.quantity) >= 7));
});

test("PBI-12: detects multi-table relationships and propagates filters across related tables", () => {
  const orders = parseCsvText(RELATIONAL_ORDERS_CSV, "Orders", "orders.csv");
  const products = parseCsvText(RELATIONAL_PRODUCTS_CSV, "Products", "products.csv");
  const rels = autoDetectRelationships([orders, products]);

  assert.equal(rels.length, 1);
  assert.equal(rels[0].fromColumn.toLowerCase(), "product_id");

  const hardwareOrders = resolveTableRows(orders.id || orders.name, [orders, products], rels, {
    slicerFilters: { category: ["Hardware"] },
  });
  assert.ok(hardwareOrders.length > 0 && hardwareOrders.length < orders.rows.length);
  assert.ok(hardwareOrders.every((o) => o.product_id === "P01" || o.product_id === "P03"));
});
