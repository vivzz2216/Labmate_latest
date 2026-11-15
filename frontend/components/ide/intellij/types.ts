import type { IntellijProjectPreset, JavaDiagnostic, JavaRunResult } from "@/lib/ide/intellijRunner";

export type LeftToolId = "project" | "commit" | "structure";
export type BottomToolId = "run" | "build" | "terminal" | "problems" | "git";
export type RightToolId = "notifications" | "database" | "maven";

export interface TerminalEntry {
  id: string;
  prompt: string;
  command: string;
  outputLines: string[];
}

export interface BuildLogEntry {
  id: string;
  timestamp: string;
  status: "success" | "failed";
  summary: string;
  details: string[];
}

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  kind: "info" | "warning" | "success";
}

export interface EditorCursor {
  line: number;
  col: number;
}

export interface IntellijWorkspaceState {
  activePresetId: IntellijProjectPreset["id"];
  openTabIds: string[];
  activeFileId: string;
  leftTool: LeftToolId | null;
  bottomTool: BottomToolId | null;
  rightTool: RightToolId | null;
  lastRunResult: JavaRunResult | null;
  diagnostics: JavaDiagnostic[];
}
