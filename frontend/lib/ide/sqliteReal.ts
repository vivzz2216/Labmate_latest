// Real SQLite (sql.js: the official SQLite compiled to WebAssembly) behind the DB Browser replica.
// The replica keeps its own snapshot model (tables, rows, views...) for the Browse Data / Structure tabs,
// but every statement the student runs is executed by the genuine SQLite engine and the snapshot is read back from it.
import type {
  ColumnSchema,
  IndexSchema,
  PragmaState,
  SqlSnapshot,
  SqlValue,
  TableSchema,
  TriggerSchema,
  ViewSchema,
} from "./sqliteEngine";

export type SqlJsStatic = any;
export type SqlJsDatabase = any;

let SQL: SqlJsStatic | null = null;
let loading: Promise<boolean> | null = null;

export function setRealSqlite(engine: SqlJsStatic | null): void {
  SQL = engine;
}
export function hasRealSqlite(): boolean {
  return SQL !== null;
}

/** Browser: load /sqljs/sql-wasm.js once, then initialise the wasm. Resolves false if it cannot be loaded (the offline interpreter is used then). */
export function loadRealSqlite(): Promise<boolean> {
  if (SQL) return Promise.resolve(true);
  if (typeof window === "undefined") return Promise.resolve(false);
  if (loading) return loading;
  loading = new Promise<boolean>((resolve) => {
    const start = () => {
      const init = (window as any).initSqlJs;
      if (!init) return resolve(false);
      init({ locateFile: (file: string) => "/sqljs/" + file })
        .then((engine: SqlJsStatic) => {
          SQL = engine;
          resolve(true);
        })
        .catch(() => resolve(false));
    };
    if ((window as any).initSqlJs) return start();
    const script = document.createElement("script");
    script.src = "/sqljs/sql-wasm.js";
    script.onload = start;
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return loading;
}

const live = new WeakMap<object, SqlJsDatabase>();

const quote = (name: string) => '"' + name.replace(/"/g, '""') + '"';

function toValue(v: unknown): SqlValue {
  if (v === null || v === undefined) return null;
  if (v instanceof Uint8Array) return "[BLOB " + v.length + " bytes]";
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  return String(v);
}

function sqlLiteral(v: SqlValue): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

/** Rebuild a database from a snapshot (used when the snapshot was produced somewhere else, e.g. after Revert Changes). */
function buildFromSnapshot(snap: SqlSnapshot): SqlJsDatabase {
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = OFF");
  const sequences: TableSchema[] = [];
  for (const name of snap.tableOrder) {
    const t = snap.tables[name];
    if (!t) continue;
    if (/^sqlite_/i.test(name)) {
      // SQLite creates sqlite_sequence itself (when the first AUTOINCREMENT table appears); its rows are restored below.
      if (name === "sqlite_sequence") sequences.push(t);
      continue;
    }
    db.run(t.createSql);
    const cols = t.columns.map((c) => quote(c.name)).join(",");
    for (const row of t.rows) {
      db.run("INSERT INTO " + quote(t.name) + " (" + cols + ") VALUES (" + t.columns.map((c) => sqlLiteral(row[c.name] ?? null)).join(",") + ")");
    }
  }
  for (const seq of sequences) {
    for (const row of seq.rows) {
      if (db.exec("SELECT 1 FROM sqlite_master WHERE name = 'sqlite_sequence'").length) {
        db.run("DELETE FROM sqlite_sequence WHERE name = " + sqlLiteral(row["name"] ?? null));
        db.run("INSERT INTO sqlite_sequence (name, seq) VALUES (" + sqlLiteral(row["name"] ?? null) + "," + sqlLiteral(row["seq"] ?? null) + ")");
      }
    }
  }
  for (const idx of snap.indices) {
    try { db.run(idx.createSql); } catch { /* auto indexes already exist */ }
  }
  for (const v of snap.views) db.run(v.createSql);
  for (const tr of snap.triggers) db.run(tr.createSql);
  applyPragmas(db, snap.pragmas);
  return db;
}

function applyPragmas(db: SqlJsDatabase, p: PragmaState): void {
  db.run("PRAGMA foreign_keys = " + (p.foreign_keys ? "ON" : "OFF"));
  db.run("PRAGMA recursive_triggers = " + (p.recursive_triggers ? "ON" : "OFF"));
  db.run("PRAGMA user_version = " + Number(p.user_version || 0));
}

function readPragmas(db: SqlJsDatabase, previous: PragmaState): PragmaState {
  const one = (name: string): unknown => {
    const r = db.exec("PRAGMA " + name);
    return r.length ? r[0].values[0][0] : undefined;
  };
  const next = { ...previous };
  const fk = one("foreign_keys");
  if (fk !== undefined) next.foreign_keys = Number(fk) === 1;
  const rt = one("recursive_triggers");
  if (rt !== undefined) next.recursive_triggers = Number(rt) === 1;
  const uv = one("user_version");
  if (uv !== undefined) next.user_version = Number(uv);
  const sv = one("schema_version");
  if (sv !== undefined) next.schema_version = Number(sv);
  return next;
}

/** Read tables, rows, indexes, views and triggers back from the real database. */
function readSnapshot(db: SqlJsDatabase, previous: SqlSnapshot): SqlSnapshot {
  const master = db.exec("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_autoindex%' ORDER BY rowid");
  const rows: unknown[][] = master.length ? master[0].values : [];
  const tables: Record<string, TableSchema> = {};
  const found: string[] = [];
  const indices: IndexSchema[] = [];
  const views: ViewSchema[] = [];
  const triggers: TriggerSchema[] = [];
  for (const [type, name, tbl, sql] of rows as [string, string, string, string | null][]) {
    if (type === "table") {
      const info = db.exec("PRAGMA table_info(" + quote(name) + ")");
      const uniqueCols = new Set<string>();
      const il = db.exec("PRAGMA index_list(" + quote(name) + ")");
      if (il.length) {
        for (const r of il[0].values as unknown[][]) {
          if (r[3] === "u" && Number(r[2]) === 1) {
            const ii = db.exec("PRAGMA index_info(" + quote(String(r[1])) + ")");
            if (ii.length && ii[0].values.length === 1) uniqueCols.add(String(ii[0].values[0][2]));
          }
        }
      }
      const createSql = sql || "";
      const pkCount = info.length ? (info[0].values as unknown[][]).filter((c) => Number(c[5]) > 0).length : 0;
      const columns: ColumnSchema[] = (info.length ? (info[0].values as unknown[][]) : []).map((c) => {
        const colName = String(c[1]);
        const type = String(c[2] || "");
        const notNull = Number(c[3]) === 1;
        const dflt = c[4] === null || c[4] === undefined ? null : toValue(c[4]);
        const isPk = Number(c[5]) > 0;
        const auto = isPk && pkCount === 1 && /\bAUTOINCREMENT\b/i.test(createSql);
        const parts = [type || ""];
        if (isPk) parts.push("PRIMARY KEY" + (auto ? " AUTOINCREMENT" : ""));
        if (notNull) parts.push("NOT NULL");
        if (dflt !== null) parts.push("DEFAULT " + dflt);
        const prev = previous.tables[name]?.columns.find((x) => x.name === colName);
        return {
          name: colName,
          type,
          notNull,
          primaryKey: isPk,
          autoIncrement: auto,
          defaultValue: dflt,
          unique: uniqueCols.has(colName),
          definitionSql: prev?.definitionSql ?? parts.filter(Boolean).join(" "),
        };
      });
      const data = db.exec("SELECT * FROM " + quote(name));
      const tableRows: Record<string, SqlValue>[] = [];
      if (data.length) {
        const cols: string[] = data[0].columns;
        for (const vals of data[0].values as unknown[][]) {
          const rec: Record<string, SqlValue> = {};
          cols.forEach((cn, i) => (rec[cn] = toValue(vals[i])));
          tableRows.push(rec);
        }
      }
      tables[name] = { name, columns, rows: tableRows, createSql };
      found.push(name);
    } else if (type === "index" && sql) {
      const ii = db.exec("PRAGMA index_info(" + quote(name) + ")");
      const il = db.exec("PRAGMA index_list(" + quote(tbl) + ")");
      let unique = /^\s*CREATE\s+UNIQUE/i.test(sql);
      if (il.length) {
        const hit = (il[0].values as unknown[][]).find((r) => r[1] === name);
        if (hit) unique = Number(hit[2]) === 1;
      }
      indices.push({
        name,
        tableName: tbl,
        columns: ii.length ? (ii[0].values as unknown[][]).map((r) => String(r[2])) : [],
        unique,
        createSql: sql,
      });
    } else if (type === "view" && sql) {
      const m = sql.match(/\bAS\b\s*([\s\S]*)$/i);
      views.push({ name, selectSql: m ? m[1].trim() : sql, createSql: sql });
    } else if (type === "trigger" && sql) {
      triggers.push({ name, tableName: tbl, createSql: sql });
    }
  }
  const order = previous.tableOrder.filter((n) => found.includes(n)).concat(found.filter((n) => !previous.tableOrder.includes(n)));
  return {
    ...previous,
    tables,
    tableOrder: order,
    indices,
    views,
    triggers,
    pragmas: readPragmas(db, previous.pragmas),
  };
}

export interface RealStatement {
  ok: boolean;
  isQuery: boolean;
  columns: string[];
  rows: SqlValue[][];
  rowsAffected: number;
  error?: string;
  /** true where SQLite stored a REAL that happens to be whole (DB Browser prints it as 38000.0). */
  realCells?: boolean[][];
}

function databaseFor(working: SqlSnapshot): SqlJsDatabase {
  const cached = live.get(working);
  if (cached) {
    live.delete(working);
    return cached;
  }
  return buildFromSnapshot(working);
}

/**
 * Run statements one after another on the real engine.
 * Returns the per-statement results and the snapshot afterwards (statements that succeeded before an error stay applied, as in DB Browser).
 */
export function runRealBatch(
  working: SqlSnapshot,
  statements: string[],
  onStatement?: (index: number, result: RealStatement, elapsedMs: number) => void
): { results: RealStatement[]; snapshot: SqlSnapshot } {
  const db = databaseFor(working);
  const results: RealStatement[] = [];
  for (let i = 0; i < statements.length; i++) {
    const t0 = Date.now();
    let res: RealStatement;
    try {
      const stmt = db.prepare(statements[i]);
      try {
        const names: string[] = stmt.getColumnNames();
        if (names.length > 0) {
          const rows: SqlValue[][] = [];
          const realCells: boolean[][] = [];
          // With useBigInt, INTEGER storage comes back as bigint and REAL as number, so whole REALs stay recognisable.
          while (stmt.step()) {
            const raw = stmt.get(null, { useBigInt: true }) as unknown[];
            realCells.push(raw.map((v) => typeof v === "number" && Number.isInteger(v)));
            rows.push(raw.map((v) => toValue(typeof v === "bigint" ? Number(v) : v)));
          }
          res = { ok: true, isQuery: true, columns: names, rows, rowsAffected: 0, realCells };
        } else {
          stmt.step();
          res = { ok: true, isQuery: false, columns: [], rows: [], rowsAffected: db.getRowsModified() };
        }
      } finally {
        stmt.free();
      }
    } catch (e) {
      res = { ok: false, isQuery: false, columns: [], rows: [], rowsAffected: 0, error: e instanceof Error ? e.message : String(e) };
    }
    results.push(res);
    onStatement?.(i, res, Math.max(1, Date.now() - t0));
    if (!res.ok) break;
  }
  const snapshot = readSnapshot(db, working);
  live.set(snapshot, db);
  return { results, snapshot };
}

export function discardRealDatabase(working: SqlSnapshot): void {
  const db = live.get(working);
  if (db) {
    live.delete(working);
    try { db.close(); } catch { /* already closed */ }
  }
}
