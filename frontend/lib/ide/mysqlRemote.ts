import api from "@/lib/api";
import { formatAsciiTable, formatVerticalRows, type MysqlOutputBlock, type MysqlValue } from "./mysqlEngine";

/** One statement run by a real MySQL server (see backend/app/routers/ide_mysql.py). */
export interface RemoteMysqlResult {
  success: boolean;
  type?: string;
  columns?: string[];
  rows?: (string | null)[][];
  numeric?: boolean[];
  affected?: number;
  info?: string;
  elapsed: number;
  database?: string;
  truncated?: boolean;
  errorCode?: number;
  sqlstate?: string;
  error?: string;
}

export type RemoteMysqlOutcome =
  | { ok: true; result: RemoteMysqlResult }
  | { ok: false; reason: "signin" | "busy" | "unavailable"; message: string };

export const MYSQL_OFFLINE_NOTICE =
  "Sign in to run against a real MySQL server. This is the offline practice interpreter: it supports only part of MySQL, so results may differ.";

export async function runMysqlRemote(statement: string): Promise<RemoteMysqlOutcome> {
  try {
    const { data } = await api.post("/api/ide/mysql/execute", { statement }, { timeout: 30000 });
    return {
      ok: true,
      result: {
        success: Boolean(data.success),
        type: data.type,
        columns: data.columns,
        rows: data.rows,
        numeric: data.numeric,
        affected: data.affected,
        info: data.info,
        elapsed: Number(data.elapsed ?? 0),
        database: data.database,
        truncated: Boolean(data.truncated),
        errorCode: data.error_code,
        sqlstate: data.sqlstate,
        error: data.error,
      },
    };
  } catch (error: unknown) {
    const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
    const detail = typeof response?.data?.detail === "string" ? response.data.detail : "";
    if (response?.status === 401 || response?.status === 403 || response?.status === 428) {
      return { ok: false, reason: "signin", message: detail || MYSQL_OFFLINE_NOTICE };
    }
    if (response?.status === 429 || response?.status === 503) {
      const waiting = detail === "high_traffic_waiting_room";
      return { ok: false, reason: "busy", message: waiting ? "LabMate is very busy and you are waiting in line, so the real MySQL server is paused for you." : detail || "Please wait and try again." };
    }
    return { ok: false, reason: "unavailable", message: "The MySQL server is not reachable right now." };
  }
}

export async function resetMysqlRemote(): Promise<void> {
  try {
    await api.post("/api/ide/mysql/reset", {});
  } catch {
    /* the session also expires on its own */
  }
}

const timing = (seconds: number) => "(" + seconds.toFixed(2) + " sec)";
const rowWord = (n: number) => (n === 1 ? "1 row" : n + " rows");

/** Print a server reply the way the mysql command-line client does. */
export function renderRemoteMysql(result: RemoteMysqlResult, vertical: boolean): MysqlOutputBlock {
  if (!result.success) {
    return { kind: "error", text: "ERROR " + (result.errorCode ?? 1105) + " (" + (result.sqlstate || "HY000") + "): " + (result.error || "error") };
  }
  const t = timing(result.elapsed);
  if (result.columns && result.columns.length > 0) {
    const rows = (result.rows ?? []) as MysqlValue[][];
    if (rows.length === 0) return { kind: "text", text: "Empty set " + t };
    if (vertical) {
      return { kind: "vertical", text: formatVerticalRows(result.columns, rows) + "\n" + rowWord(rows.length) + " in set " + t };
    }
    return { kind: "table", text: formatAsciiTable(result.columns, rows, result.numeric) + "\n" + rowWord(rows.length) + " in set " + t };
  }
  if ((result.type || "").toUpperCase() === "USE") return { kind: "text", text: "Database changed" };
  const n = result.affected ?? 0;
  const base = "Query OK, " + rowWord(n) + " affected " + t;
  return { kind: "status", text: result.info && result.info.trim() ? base + "\n" + result.info.trim() : base };
}
