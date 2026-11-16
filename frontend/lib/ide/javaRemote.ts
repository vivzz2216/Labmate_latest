import api from "@/lib/api";

/** Result of compiling and running a Java file on the backend's real JDK (see backend/app/routers/ide_java.py). */
export interface RemoteJavaResult {
  phase: "compile" | "run";
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  className: string;
  durationMs: number;
}

export type RemoteJavaOutcome =
  | { ok: true; result: RemoteJavaResult }
  | { ok: false; reason: "signin" | "busy" | "unavailable"; message: string };

export const WAITING_NOTICE =
  "LabMate is very busy and you are waiting in line, so running on the real JDK is paused for you. Open your dashboard to see your place.";

export const OFFLINE_NOTICE =
  "Sign in to run on the real JDK. This is the offline practice interpreter: it supports only part of Java, so results may differ.";

export async function runJavaRemote(code: string, stdin: string): Promise<RemoteJavaOutcome> {
  try {
    const { data } = await api.post("/api/ide/java/run", { code, stdin }, { timeout: 90000 });
    return {
      ok: true,
      result: {
        phase: data.phase,
        success: Boolean(data.success),
        stdout: String(data.stdout ?? ""),
        stderr: String(data.stderr ?? ""),
        exitCode: Number(data.exit_code ?? 1),
        className: String(data.class_name ?? ""),
        durationMs: Number(data.duration_ms ?? 0),
      },
    };
  } catch (error: unknown) {
    const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
    const detail = typeof response?.data?.detail === "string" ? response.data.detail : "";
    if (response?.status === 401 || response?.status === 403 || response?.status === 428) {
      return { ok: false, reason: "signin", message: detail || OFFLINE_NOTICE };
    }
    if (response?.status === 503 && detail === "high_traffic_waiting_room") {
      return { ok: false, reason: "busy", message: WAITING_NOTICE };
    }
    if (response?.status === 409 || response?.status === 429) {
      return { ok: false, reason: "busy", message: detail || "Please wait and try again." };
    }
    return { ok: false, reason: "unavailable", message: "The Java runtime is not reachable right now." };
  }
}

export interface JavacDiagnostic {
  line: number;
  column: number;
  severity: "error" | "warning";
  message: string;
}

/** javac prints "File.java:5: error: message", the source line, then a caret line whose position is the column. */
export function parseJavacDiagnostics(stderr: string): JavacDiagnostic[] {
  const lines = stderr.split(/\r?\n/);
  const found: JavacDiagnostic[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^[\w$]+\.java:(\d+): (error|warning): (.*)$/.exec(lines[i]);
    if (!match) continue;
    let column = 1;
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j += 1) {
      const caret = lines[j].indexOf("^");
      if (caret >= 0 && /^\s*\^\s*$/.test(lines[j])) {
        column = caret + 1;
        break;
      }
    }
    found.push({ line: Number(match[1]), column, severity: match[2] as "error" | "warning", message: match[3] });
  }
  return found;
}
