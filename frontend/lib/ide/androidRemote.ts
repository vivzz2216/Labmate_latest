import api from "@/lib/api";

export type AndroidBuildTask = "compile" | "assembleDebug" | "clean" | "test";

export interface AndroidBuildStep {
  id: string;
  label: string;
  status: "success" | "up-to-date" | "failed";
  durationMs: number;
  detail?: string;
}

export interface AndroidBuildDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface AndroidApkArtifact {
  filename: string;
  size_bytes: number;
  entry_count: number;
  format: string;
  base64: string;
}

export interface AndroidCapabilities {
  javac_available: boolean;
  java_available: boolean;
  kotlinc_available: boolean;
  gradle_available: boolean;
  android_sdk_available: boolean;
  native_emulator_available: boolean;
  compiler_mode: string;
  emulator_note: string;
  isolation_mode?: string;
  execution_backend?: string;
  worker_isolated?: boolean;
}

export interface RemoteAndroidBuildResult {
  success: boolean;
  task: AndroidBuildTask;
  exit_code: number;
  duration_ms: number;
  steps: AndroidBuildStep[];
  diagnostics: AndroidBuildDiagnostic[];
  logs: string[];
  error: string;
  artifact: AndroidApkArtifact | null;
  capabilities: AndroidCapabilities;
  compiled_classes: string[];
  package_name: string;
}

export type RemoteAndroidOutcome =
  | { ok: true; result: RemoteAndroidBuildResult }
  | { ok: false; status: number; reason: "signin" | "busy" | "unavailable"; requiresAuth: boolean; message: string };

export const ANDROID_SIGNIN_NOTICE =
  "Sign in to LabMate to run isolated JDK (javac) Android builds on the server. Local XML/syntax validation and the Interactive Browser Android Runtime remain active.";

export async function buildAndroidProjectRemote(
  files: Record<string, string>,
  task: AndroidBuildTask,
  packageName: string
): Promise<RemoteAndroidOutcome> {
  try {
    const { data } = await api.post(
      "/api/ide/android/build",
      { files, task, package_name: packageName },
      { timeout: 60000 }
    );
    return {
      ok: true,
      result: {
        success: Boolean(data.success),
        task: data.task || task,
        exit_code: Number(data.exit_code ?? (data.success ? 0 : 1)),
        duration_ms: Number(data.duration_ms ?? 0),
        steps: Array.isArray(data.steps) ? data.steps : [],
        diagnostics: Array.isArray(data.diagnostics) ? data.diagnostics : [],
        logs: Array.isArray(data.logs) ? data.logs : [],
        error: String(data.error ?? ""),
        artifact: data.artifact || null,
        capabilities: data.capabilities || {
          javac_available: true,
          java_available: true,
          kotlinc_available: false,
          gradle_available: false,
          android_sdk_available: false,
          native_emulator_available: false,
          compiler_mode: "javac_android_stubs",
          emulator_note: "Interactive Browser Android Runtime active.",
        },
        compiled_classes: Array.isArray(data.compiled_classes) ? data.compiled_classes : [],
        package_name: String(data.package_name ?? packageName),
      },
    };
  } catch (error: unknown) {
    const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
    const status = Number(response?.status ?? 0);
    const detail = typeof response?.data?.detail === "string" ? response.data.detail : "";
    if (status === 401 || status === 403 || status === 428) {
      return {
        ok: false,
        status,
        reason: "signin",
        requiresAuth: true,
        message: detail || ANDROID_SIGNIN_NOTICE,
      };
    }
    if (status === 409 || status === 429 || status === 503) {
      return {
        ok: false,
        status,
        reason: "busy",
        requiresAuth: false,
        message: detail || "Build queue busy. Wait a moment and try again.",
      };
    }
    return {
      ok: false,
      status,
      reason: "unavailable",
      requiresAuth: false,
      message: "Backend build service is currently unreachable. Local XML validation & Interactive Runtime remain active.",
    };
  }
}

export async function fetchAndroidCapabilitiesRemote(): Promise<AndroidCapabilities | null> {
  try {
    const { data } = await api.get("/api/ide/android/capabilities", { timeout: 10000 });
    return data as AndroidCapabilities;
  } catch {
    return null;
  }
}
