import { buildDatasetFromGrid } from "./csvEngine.ts";
import type { DatasetModel } from "./types.ts";

export interface ParsedExcelSheet {
  sheetName: string;
  dataset: DatasetModel;
}

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

const EXCEL_DATE_NUMFMT_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function readUint16LE(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readUint32LE(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

async function inflateRawBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Excel decompression is unavailable in this environment.");
  }
  const ds = new DecompressionStream("deflate-raw");
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const stream = new Blob([copy]).stream().pipeThrough(ds);
  const resBuf = await new Response(stream).arrayBuffer();
  return new Uint8Array(resBuf);
}

function parseZipDirectory(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minOffset = Math.max(0, bytes.length - 65558);
  let eocdOffset = -1;

  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error("Invalid .xlsx file: ZIP directory signature not found.");
  }

  const totalEntries = readUint16LE(view, eocdOffset + 10);
  const cdOffset = readUint32LE(view, eocdOffset + 16);
  const entries: ZipEntry[] = [];
  let ptr = cdOffset;

  for (let idx = 0; idx < totalEntries && ptr + 46 <= bytes.length; idx++) {
    if (readUint32LE(view, ptr) !== 0x02014b50) break;
    const method = readUint16LE(view, ptr + 10);
    const compressedSize = readUint32LE(view, ptr + 20);
    const uncompressedSize = readUint32LE(view, ptr + 24);
    const nameLen = readUint16LE(view, ptr + 28);
    const extraLen = readUint16LE(view, ptr + 30);
    const commentLen = readUint16LE(view, ptr + 32);
    const localHeaderOffset = readUint32LE(view, ptr + 42);
    const nameBytes = bytes.subarray(ptr + 46, ptr + 46 + nameLen);
    const name = decodeUtf8(nameBytes);
    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

async function readZipEntryText(bytes: Uint8Array, entry: ZipEntry): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const loc = entry.localHeaderOffset;
  if (loc + 30 > bytes.length || readUint32LE(view, loc) !== 0x04034b50) {
    throw new Error(`Corrupt .xlsx entry: ${entry.name}`);
  }
  const nameLen = readUint16LE(view, loc + 26);
  const extraLen = readUint16LE(view, loc + 28);
  const dataStart = loc + 30 + nameLen + extraLen;
  const payload = bytes.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.method === 0) {
    return decodeUtf8(payload);
  }
  if (entry.method === 8) {
    const raw = await inflateRawBytes(payload);
    return decodeUtf8(raw);
  }
  throw new Error(`Unsupported compression method (${entry.method}) in .xlsx archive.`);
}

function unescapeXml(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function getAttr(attrText: string, name: string): string {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*"([^"]*)"`, "i");
  const match = attrText.match(re);
  return match ? unescapeXml(match[1]) : "";
}

function parseSharedStrings(xml: string): string[] {
  const result: string[] = [];
  const siRe = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml)) !== null) {
    const inner = m[1];
    const tParts: string[] = [];
    const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(inner)) !== null) {
      tParts.push(unescapeXml(tm[1]));
    }
    result.push(tParts.join(""));
  }
  return result;
}

function parseDateStyleIndices(stylesXml: string): Set<number> {
  const customDateFmtIds = new Set<number>();
  const numFmtRe = /<numFmt\s+([^>]*?)\/?>/g;
  let nm: RegExpExecArray | null;
  while ((nm = numFmtRe.exec(stylesXml)) !== null) {
    const attrs = nm[1];
    const id = Number(getAttr(attrs, "numFmtId"));
    const code = getAttr(attrs, "formatCode").toLowerCase();
    if (
      Number.isFinite(id) &&
      (code.includes("yy") || code.includes("dd") || (code.includes("mm") && !code.includes("h:mm:ss")))
    ) {
      customDateFmtIds.add(id);
    }
  }

  const dateStyleIndices = new Set<number>();
  const cellXfsMatch = stylesXml.match(/<cellXfs(?:\s[^>]*)?>([\s\S]*?)<\/cellXfs>/);
  if (cellXfsMatch) {
    const xfRe = /<xf\s+([^>]*?)(?:\/>|>[\s\S]*?<\/xf>)/g;
    let xm: RegExpExecArray | null;
    let idx = 0;
    while ((xm = xfRe.exec(cellXfsMatch[1])) !== null) {
      const fmtId = Number(getAttr(xm[1], "numFmtId"));
      if (EXCEL_DATE_NUMFMT_IDS.has(fmtId) || customDateFmtIds.has(fmtId)) {
        dateStyleIndices.add(idx);
      }
      idx++;
    }
  }
  return dateStyleIndices;
}

function excelSerialToIsoDate(serial: number): string {
  const days = Math.floor(serial);
  if (!Number.isFinite(days) || days < 1 || days > 2958465) return String(serial);
  const utcMs = Date.UTC(1899, 11, 30) + days * 86400000;
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function colRefToIndex(ref: string): number {
  const lettersMatch = ref.match(/^([A-Za-z]+)/);
  if (!lettersMatch) return -1;
  const letters = lettersMatch[1].toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
}

function parseWorksheetXml(
  xml: string,
  sharedStrings: string[],
  dateStyles: Set<number>,
): { headers: string[]; rows: string[][] } {
  const grid: string[][] = [];
  let maxCols = 0;

  const rowRe = /<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml)) !== null) {
    const rowBody = rm[1];
    const rowArr: string[] = [];
    let fallbackCol = 0;

    const cellRe = /<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rowBody)) !== null) {
      const attrs = cm[1];
      const inner = cm[2] || "";
      const ref = getAttr(attrs, "r");
      const cellType = getAttr(attrs, "t");
      const styleIdx = Number(getAttr(attrs, "s") || "-1");

      const colIdx = ref ? colRefToIndex(ref) : fallbackCol;
      fallbackCol = colIdx + 1;
      if (colIdx < 0) continue;

      let valueStr = "";
      if (cellType === "inlineStr") {
        const itParts: string[] = [];
        const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
        let tm: RegExpExecArray | null;
        while ((tm = tRe.exec(inner)) !== null) {
          itParts.push(unescapeXml(tm[1]));
        }
        valueStr = itParts.join("");
      } else {
        const vMatch = inner.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/);
        const rawV = vMatch ? unescapeXml(vMatch[1]).trim() : "";
        if (cellType === "s") {
          const sIdx = Number(rawV);
          valueStr = Number.isInteger(sIdx) && sharedStrings[sIdx] !== undefined ? sharedStrings[sIdx] : "";
        } else if (cellType === "b") {
          valueStr = rawV === "1" ? "True" : "False";
        } else if (cellType === "e") {
          valueStr = "";
        } else if (rawV !== "" && cellType !== "str" && dateStyles.has(styleIdx)) {
          const num = Number(rawV);
          valueStr = Number.isFinite(num) ? excelSerialToIsoDate(num) : rawV;
        } else {
          valueStr = rawV;
        }
      }

      while (rowArr.length <= colIdx) rowArr.push("");
      rowArr[colIdx] = valueStr.trim();
      if (colIdx + 1 > maxCols) maxCols = colIdx + 1;
    }

    if (rowArr.some((cell) => cell !== "")) {
      grid.push(rowArr);
    }
  }

  if (grid.length === 0 || maxCols === 0) {
    return { headers: [], rows: [] };
  }

  const normalized = grid.map((r) => {
    const out = r.slice();
    while (out.length < maxCols) out.push("");
    return out;
  });

  const headers = normalized[0];
  const rows = normalized.slice(1);
  return { headers, rows };
}

function parseSpreadsheetMlXml(xmlText: string, fileName: string): ParsedExcelSheet[] {
  const sheets: ParsedExcelSheet[] = [];
  const wsRe = /<Worksheet\s+([^>]*)>([\s\S]*?)<\/Worksheet>/gi;
  let wm: RegExpExecArray | null;

  while ((wm = wsRe.exec(xmlText)) !== null) {
    const sheetName = getAttr(wm[1], "ss:Name") || getAttr(wm[1], "Name") || `Sheet${sheets.length + 1}`;
    const body = wm[2];
    const grid: string[][] = [];
    const rowRe = /<Row(?:\s[^>]*)?>([\s\S]*?)<\/Row>/gi;
    let rm: RegExpExecArray | null;

    while ((rm = rowRe.exec(body)) !== null) {
      const cells: string[] = [];
      const cellRe = /<Cell(?:\s([^>]*))?>([\s\S]*?)<\/Cell>/gi;
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(rm[1])) !== null) {
        const idxAttr = cm[1] ? Number(getAttr(cm[1], "ss:Index")) : NaN;
        if (Number.isFinite(idxAttr) && idxAttr >= 1) {
          while (cells.length < idxAttr - 1) cells.push("");
        }
        const dataMatch = cm[2].match(/<Data(?:\s[^>]*)?>([\s\S]*?)<\/Data>/i);
        cells.push(dataMatch ? unescapeXml(dataMatch[1]).trim() : "");
      }
      if (cells.some((c) => c !== "")) grid.push(cells);
    }

    if (grid.length >= 2) {
      const maxCols = Math.max(...grid.map((r) => r.length));
      const padded = grid.map((r) => {
        const copy = r.slice();
        while (copy.length < maxCols) copy.push("");
        return copy;
      });
      const dataset = buildDatasetFromGrid(padded[0], padded.slice(1), sheetName, fileName);
      if (dataset.columns.length > 0 && dataset.rows.length > 0) {
        sheets.push({ sheetName, dataset });
      }
    }
  }
  return sheets;
}

export async function parseExcelArrayBuffer(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<ParsedExcelSheet[]> {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4) {
    throw new Error("The selected Excel file is empty.");
  }

  // Legacy binary BIFF8 .xls (OLE2 compound file) starts with D0 CF 11 E0
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    throw new Error(
      "Legacy binary .xls format is not supported directly. Save or export as .xlsx (Excel Workbook) or .csv and re-upload.",
    );
  }

  // XML Spreadsheet 2003 (.xls XML)
  const head = decodeUtf8(bytes.subarray(0, Math.min(256, bytes.length))).trimStart();
  if (head.startsWith("<")) {
    const parsedXml = parseSpreadsheetMlXml(decodeUtf8(bytes), fileName);
    if (parsedXml.length === 0) {
      throw new Error("No valid data tables were found inside the XML Excel file.");
    }
    return parsedXml;
  }

  // OOXML .xlsx (ZIP archive)
  const entries = parseZipDirectory(bytes);
  const entryMap = new Map<string, ZipEntry>();
  for (let i = 0; i < entries.length; i++) {
    entryMap.set(entries[i].name.replace(/\\/g, "/"), entries[i]);
  }

  const workbookEntry = entryMap.get("xl/workbook.xml");
  if (!workbookEntry) {
    throw new Error("Could not find xl/workbook.xml inside .xlsx file.");
  }
  const workbookXml = await readZipEntryText(bytes, workbookEntry);

  const relsEntry = entryMap.get("xl/_rels/workbook.xml.rels");
  const relsXml = relsEntry ? await readZipEntryText(bytes, relsEntry) : "";
  const relTargetMap = new Map<string, string>();
  const relRe = /<Relationship\s+([^>]*?)\/?>/g;
  let relm: RegExpExecArray | null;
  while ((relm = relRe.exec(relsXml)) !== null) {
    const id = getAttr(relm[1], "Id");
    const target = getAttr(relm[1], "Target").replace(/^\/+/, "");
    if (id && target) {
      relTargetMap.set(id, target.startsWith("xl/") ? target : `xl/${target}`);
    }
  }

  const sharedEntry = entryMap.get("xl/sharedStrings.xml");
  const sharedStrings = sharedEntry ? parseSharedStrings(await readZipEntryText(bytes, sharedEntry)) : [];

  const stylesEntry = entryMap.get("xl/styles.xml");
  const dateStyles = stylesEntry ? parseDateStyleIndices(await readZipEntryText(bytes, stylesEntry)) : new Set<number>();

  const sheets: ParsedExcelSheet[] = [];
  const sheetRe = /<sheet\s+([^>]*?)\/?>/g;
  let sm: RegExpExecArray | null;
  let idx = 0;

  while ((sm = sheetRe.exec(workbookXml)) !== null) {
    idx++;
    const name = getAttr(sm[1], "name") || `Sheet${idx}`;
    const rid = getAttr(sm[1], "r:id") || getAttr(sm[1], "id");
    const targetPath = (rid && relTargetMap.get(rid)) || `xl/worksheets/sheet${idx}.xml`;
    const wsEntry = entryMap.get(targetPath);
    if (!wsEntry) continue;

    const wsXml = await readZipEntryText(bytes, wsEntry);
    const { headers, rows } = parseWorksheetXml(wsXml, sharedStrings, dateStyles);
    if (headers.length === 0 || rows.length === 0) continue;

    const dataset = buildDatasetFromGrid(headers, rows, name, fileName);
    if (dataset.columns.length > 0 && dataset.rows.length > 0) {
      sheets.push({ sheetName: name, dataset });
    }
  }

  if (sheets.length === 0) {
    throw new Error("No non-empty worksheets were found in the uploaded .xlsx workbook.");
  }
  return sheets;
}
