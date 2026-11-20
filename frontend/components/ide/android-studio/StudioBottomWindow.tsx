"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "./androidStudio.module.css";
import {
  GitFileStatusEntry,
  GradleBuildStep,
  LogcatEntry,
  LogcatLevel,
  StudioDeviceProfile,
  StudioProblem,
  getLogcatTagColor,
} from "@/lib/ide/androidStudioEngine";
import type { AndroidApkArtifact } from "@/lib/ide/androidRemote";
import {
  CheckGreenIcon,
  DownloadApkIcon,
  ErrorCircleIcon,
  FilterFunnelIcon,
  PauseBarsIcon,
  RestartIcon,
  RunningDevicesStripeIcon,
  SoftWrapIcon,
  TrashDeleteIcon,
  WarningTriangleIcon,
} from "./StudioIcons";
import { BottomToolId } from "./StudioStripes";

interface StudioBottomWindowProps {
  height: number;
  projectName: string;
  activeBranch: string;
  activeTool: BottomToolId;
  onSelectTool: (tool: BottomToolId) => void;
  onHide: () => void;
  devices: StudioDeviceProfile[];
  activeDevice: StudioDeviceProfile;
  onSelectDevice: (deviceId: string) => void;
  logcatEntries: LogcatEntry[];
  filteredLogcat: LogcatEntry[];
  logcatQuery: string;
  onChangeLogcatQuery: (q: string) => void;
  onClearLogcat: () => void;
  onRestartLogcat: () => void;
  buildStatus: "idle" | "building" | "success" | "failed";
  buildSteps: GradleBuildStep[];
  buildConsoleLines: string[];
  apkArtifact: AndroidApkArtifact | null;
  onDownloadApk: () => void;
  runConsoleLines: string[];
  problems: StudioProblem[];
  onSelectProblem: (problem: StudioProblem) => void;
  terminalHistory: { id: string; command: string; output: string[] }[];
  onExecuteTerminal: (command: string) => void;
  onClearTerminal: () => void;
  gitChanges: GitFileStatusEntry[];
  onOpenFileById: (fileId: string) => void;
  onResetProject: () => void;
}

const LEVEL_BADGE_STYLES: Record<
  LogcatLevel,
  { bg: string; fg: string; msgVar: string }
> = {
  V: { bg: "#D6D6D6", fg: "#000000", msgVar: "var(--as-text-muted)" },
  D: { bg: "#305D78", fg: "#FFFFFF", msgVar: "var(--as-syn-call)" },
  I: { bg: "#57965C", fg: "#FFFFFF", msgVar: "var(--as-green)" },
  W: { bg: "#E0A82E", fg: "#000000", msgVar: "var(--as-yellow)" },
  E: { bg: "#DB5C5C", fg: "#FFFFFF", msgVar: "var(--as-red)" },
  A: { bg: "#8B3C3C", fg: "#FFFFFF", msgVar: "var(--as-red)" },
};

export function StudioBottomWindow({
  height,
  projectName,
  activeBranch,
  activeTool,
  onSelectTool,
  onHide,
  devices,
  activeDevice,
  onSelectDevice,
  filteredLogcat,
  logcatQuery,
  onChangeLogcatQuery,
  onClearLogcat,
  onRestartLogcat,
  buildStatus,
  buildSteps,
  buildConsoleLines,
  apkArtifact,
  onDownloadApk,
  runConsoleLines,
  problems,
  onSelectProblem,
  terminalHistory,
  onExecuteTerminal,
  onClearTerminal,
  gitChanges,
  onOpenFileById,
  onResetProject,
}: StudioBottomWindowProps) {
  const [logcatPaused, setLogcatPaused] = useState(false);
  const [softWrap, setSoftWrap] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [terminalInput, setTerminalInput] = useState("");
  const logcatScrollRef = useRef<HTMLDivElement | null>(null);
  const termScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!logcatPaused && logcatScrollRef.current) {
      logcatScrollRef.current.scrollTop = logcatScrollRef.current.scrollHeight;
    }
  }, [filteredLogcat.length, logcatPaused]);

  useEffect(() => {
    if (activeTool === "terminal" && termScrollRef.current) {
      termScrollRef.current.scrollTop = termScrollRef.current.scrollHeight;
    }
  }, [activeTool, terminalHistory.length]);

  const hasPackageMinePill = /\bpackage:mine\b/i.test(logcatQuery);

  const toggleQueryToken = (token: string) => {
    if (logcatQuery.indexOf(token) >= 0) {
      onChangeLogcatQuery(logcatQuery.replace(token, "").replace(/\s+/g, " ").trim());
    } else {
      onChangeLogcatQuery(`${logcatQuery.trim()} ${token}`.trim());
    }
  };

  return (
    <section
      className={styles.bottomToolWindow}
      style={{ height }}
      aria-label="Bottom Tool Window"
    >
      <div className={styles.bottomHeaderBar}>
        <div className={styles.bottomTitleTabs}>
          <button
            type="button"
            className={`${styles.bottomTabBtn} ${
              activeTool === "logcat" ? styles.bottomTabBtnActive : ""
            }`}
            onClick={() => onSelectTool("logcat")}
          >
            Logcat
          </button>
          <button
            type="button"
            className={`${styles.bottomTabBtn} ${
              activeTool === "build" ? styles.bottomTabBtnActive : ""
            }`}
            onClick={() => onSelectTool("build")}
          >
            Build
          </button>
          <button
            type="button"
            className={`${styles.bottomTabBtn} ${
              activeTool === "run" ? styles.bottomTabBtnActive : ""
            }`}
            onClick={() => onSelectTool("run")}
          >
            Run
          </button>
          <button
            type="button"
            className={`${styles.bottomTabBtn} ${
              activeTool === "terminal" ? styles.bottomTabBtnActive : ""
            }`}
            onClick={() => onSelectTool("terminal")}
          >
            Terminal
          </button>
          <button
            type="button"
            className={`${styles.bottomTabBtn} ${
              activeTool === "problems" ? styles.bottomTabBtnActive : ""
            }`}
            onClick={() => onSelectTool("problems")}
          >
            Problems ({problems.length})
          </button>
          <button
            type="button"
            className={`${styles.bottomTabBtn} ${
              activeTool === "vcs" ? styles.bottomTabBtnActive : ""
            }`}
            onClick={() => onSelectTool("vcs")}
          >
            Git ({gitChanges.length})
          </button>
        </div>

        <div className={styles.sideHeaderActions}>
          <button
            type="button"
            className={styles.panelActionIcon}
            title="Minimize Tool Window"
            onClick={onHide}
          >
            —
          </button>
        </div>
      </div>

      {/* 1. LOGCAT TOOL WINDOW */}
      {activeTool === "logcat" && (
        <>
          <div className={styles.logcatFilterToolbar}>
            <button
              type="button"
              className={styles.logcatDeviceSelect}
              onClick={() => {
                const idx = devices.findIndex((d) => d.id === activeDevice.id);
                const next = devices[(idx + 1) % devices.length];
                onSelectDevice(next.id);
              }}
              title="Click to cycle target device"
            >
              <RunningDevicesStripeIcon size={14} />
              <span>
                {activeDevice.name} ({activeDevice.adbSerial}) {activeDevice.androidVersion}
              </span>
              <span>⌄</span>
            </button>

            <div className={styles.logcatQueryBox}>
              <FilterFunnelIcon size={14} />
              <input
                type="text"
                className={styles.logcatQueryInput}
                value={logcatQuery}
                aria-label="Logcat Query Filter"
                placeholder="Filter (package:mine tag:MainActivity level:INFO is:crash)"
                onChange={(e) => onChangeLogcatQuery(e.target.value)}
              />
              {logcatQuery && (
                <button
                  type="button"
                  className={styles.tabCloseBtn}
                  title="Clear Logcat query"
                  onClick={() => onChangeLogcatQuery("")}
                >
                  ×
                </button>
              )}
            </div>

            <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                className={`${styles.segmentedBtn} ${
                  hasPackageMinePill ? styles.segmentedBtnActive : ""
                }`}
                onClick={() => toggleQueryToken("package:mine")}
              >
                package:mine
              </button>
              <button
                type="button"
                className={`${styles.segmentedBtn} ${
                  logcatQuery.indexOf("level:INFO") >= 0 ? styles.segmentedBtnActive : ""
                }`}
                onClick={() => toggleQueryToken("level:INFO")}
              >
                level:INFO
              </button>
              <button
                type="button"
                className={`${styles.segmentedBtn} ${
                  logcatQuery.indexOf("level:ERROR") >= 0 ? styles.segmentedBtnActive : ""
                }`}
                onClick={() => toggleQueryToken("level:ERROR")}
              >
                level:ERROR
              </button>
            </div>
          </div>

          <div className={styles.logcatBodyRow}>
            <div className={styles.logcatLeftToolbar} aria-label="Logcat Actions">
              <button
                type="button"
                className={styles.panelActionIcon}
                title="Clear Logcat"
                onClick={onClearLogcat}
              >
                <TrashDeleteIcon size={14} />
              </button>
              <button
                type="button"
                className={`${styles.panelActionIcon} ${
                  logcatPaused ? styles.toolbarIconBtnActive : ""
                }`}
                title={logcatPaused ? "Resume Logcat" : "Pause Logcat"}
                onClick={() => setLogcatPaused((v) => !v)}
              >
                <PauseBarsIcon size={14} />
              </button>
              <button
                type="button"
                className={styles.panelActionIcon}
                title="Restart Runtime Logcat"
                onClick={onRestartLogcat}
              >
                <RestartIcon size={14} />
              </button>
              <button
                type="button"
                className={`${styles.panelActionIcon} ${
                  softWrap ? styles.toolbarIconBtnActive : ""
                }`}
                title="Soft-Wrap"
                onClick={() => setSoftWrap((v) => !v)}
              >
                <SoftWrapIcon size={14} />
              </button>
              <button
                type="button"
                className={`${styles.panelActionIcon} ${
                  compactView ? styles.toolbarIconBtnActive : ""
                }`}
                title="Compact Formatting"
                onClick={() => setCompactView((v) => !v)}
              >
                ≡
              </button>
            </div>

            <div className={styles.logcatConsoleScroll} ref={logcatScrollRef}>
              {filteredLogcat.length === 0 ? (
                <div style={{ color: "var(--as-text-muted)", padding: "12px 8px" }}>
                  No logcat entries match query &quot;{logcatQuery}&quot;.
                </div>
              ) : (
                filteredLogcat.map((entry) => {
                  const badge = LEVEL_BADGE_STYLES[entry.level];
                  const tagColor = getLogcatTagColor(entry.tag);
                  return (
                    <div
                      key={entry.id}
                      className={`${styles.logcatRow} ${softWrap ? styles.logcatRowWrap : ""}`}
                    >
                      <span className={styles.logcatTimestamp}>{entry.timestamp}</span>
                      {!compactView && (
                        <span className={styles.logcatPid}>
                          {entry.pid}-{entry.tid}
                        </span>
                      )}
                      <span className={styles.logcatTag} style={{ color: tagColor }}>
                        {entry.tag}
                      </span>
                      {!compactView && (
                        <span className={styles.logcatPkg}>{entry.packageName}</span>
                      )}
                      <span
                        className={styles.logcatLevelBadge}
                        style={{ backgroundColor: badge.bg, color: badge.fg }}
                      >
                        {entry.level}
                      </span>
                      <span style={{ color: badge.msgVar }}>{entry.message}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* 2. BUILD TOOL WINDOW */}
      {activeTool === "build" && (
        <div className={styles.logcatBodyRow}>
          <div
            style={{
              width: 268,
              borderRight: "1px solid var(--as-border-panel)",
              padding: 8,
              overflow: "auto",
              background: "var(--as-bg-chrome)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 12, color: "var(--as-text-primary)" }}>
              {buildStatus === "building"
                ? "Building :app..."
                : buildStatus === "success"
                ? "✓ Build Succeeded"
                : buildStatus === "failed"
                ? "✕ Build Failed"
                : "Build Not Run Yet"}
            </div>
            {buildSteps.map((step) => (
              <div
                key={step.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "3px 4px",
                  fontSize: 11.5,
                  color: "var(--as-text-primary)",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {step.status === "failed" ? (
                    <ErrorCircleIcon size={12} />
                  ) : (
                    <CheckGreenIcon size={12} />
                  )}
                  <span>{step.label}</span>
                </span>
                <span style={{ color: "var(--as-text-muted)", fontSize: 11 }}>
                  {step.durationMs}ms
                </span>
              </div>
            ))}
            {apkArtifact && (
              <button
                type="button"
                className={styles.primaryBtn}
                style={{ marginTop: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                onClick={onDownloadApk}
              >
                <DownloadApkIcon size={14} />
                <span>Download {apkArtifact.filename} ({Math.max(1, Math.round(apkArtifact.size_bytes / 1024))} KB)</span>
              </button>
            )}
          </div>
          <div className={styles.logcatConsoleScroll}>
            {buildConsoleLines.length === 0 ? (
              <div style={{ color: "var(--as-text-muted)" }}>
                Click Build (Ctrl+F9) or Build APK in the toolbar/menu to validate XML and compile Java sources via isolated javac.
              </div>
            ) : (
              buildConsoleLines.map((line, i) => (
                <div
                  key={i}
                  style={{
                    color:
                      line.indexOf("BUILD SUCCESSFUL") >= 0
                        ? "var(--as-green)"
                        : line.indexOf("FAILED") >= 0 || line.indexOf("error:") >= 0
                        ? "var(--as-red)"
                        : line.indexOf("> Task") === 0
                        ? "var(--as-text-secondary)"
                        : "var(--as-text-code)",
                  }}
                >
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. RUN TOOL WINDOW */}
      {activeTool === "run" && (
        <div className={styles.logcatConsoleScroll}>
          {runConsoleLines.length === 0 ? (
            <div style={{ color: "var(--as-text-muted)" }}>
              Press Run (Shift+F10) to start the interactive Activity session.
            </div>
          ) : (
            runConsoleLines.map((line, i) => (
              <div
                key={i}
                style={{
                  color:
                    line.indexOf("EXCEPTION") >= 0 || line.indexOf("error:") >= 0
                      ? "var(--as-red)"
                      : line.indexOf("Started") >= 0 || line.indexOf("Launched") >= 0
                      ? "var(--as-green)"
                      : "var(--as-text-code)",
                }}
              >
                {line}
              </div>
            ))
          )}
        </div>
      )}

      {/* 4. TERMINAL TOOL WINDOW */}
      {activeTool === "terminal" && (
        <div
          ref={termScrollRef}
          className={styles.logcatConsoleScroll}
          style={{ display: "flex", flexDirection: "column", gap: 6 }}
        >
          <div style={{ color: "var(--as-text-muted)" }}>
            Android Studio Project Terminal — Supported: <code>ls</code>, <code>cat &lt;path&gt;</code>,{" "}
            <code>pwd</code>, <code>git status</code>, <code>adb devices</code>,{" "}
            <code>./gradlew assembleDebug</code>, <code>./gradlew test</code>, <code>clear</code>
          </div>
          {terminalHistory.map((item) => (
            <div key={item.id}>
              <div style={{ color: "var(--as-android-green)", fontWeight: 600 }}>
                ~/AndroidStudioProjects/{projectName}$ {item.command}
              </div>
              {item.output.map((out, idx) => (
                <div key={idx} style={{ color: "var(--as-text-code)", whiteSpace: "pre-wrap" }}>
                  {out}
                </div>
              ))}
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!terminalInput.trim()) return;
              if (terminalInput.trim().toLowerCase() === "clear") {
                onClearTerminal();
              } else {
                onExecuteTerminal(terminalInput);
              }
              setTerminalInput("");
            }}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ color: "var(--as-android-green)", fontWeight: 600, flexShrink: 0 }}>
              ~/AndroidStudioProjects/{projectName}$
            </span>
            <input
              type="text"
              value={terminalInput}
              onChange={(e) => setTerminalInput(e.target.value)}
              placeholder="./gradlew assembleDebug"
              aria-label="Terminal Command Input"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--as-text-primary)",
                fontFamily: "inherit",
                fontSize: 12,
              }}
            />
          </form>
        </div>
      )}

      {/* 5. PROBLEMS TOOL WINDOW */}
      {activeTool === "problems" && (
        <div className={styles.logcatConsoleScroll}>
          {problems.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--as-green)" }}>
              <CheckGreenIcon size={14} />
              <span>No problems found in project files.</span>
            </div>
          ) : (
            problems.map((prob) => (
              <div
                key={prob.id}
                onClick={() => onSelectProblem(prob)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 6px",
                  cursor: "pointer",
                  borderRadius: 4,
                }}
              >
                {prob.severity === "error" ? (
                  <ErrorCircleIcon size={14} />
                ) : (
                  <WarningTriangleIcon size={14} />
                )}
                <span style={{ color: "var(--as-text-primary)" }}>{prob.message}</span>
                <span style={{ color: "var(--as-text-muted)" }}>
                  {prob.fileName}:{prob.line}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* 6. GIT / VERSION CONTROL */}
      {activeTool === "vcs" && (
        <div className={styles.logcatConsoleScroll} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "var(--as-accent)", fontWeight: 600 }}>
              Branch: {activeBranch} · {gitChanges.length} local change(s)
            </span>
            <button
              type="button"
              className={styles.secondaryBtn}
              style={{ height: 24, padding: "0 10px", fontSize: 11.5 }}
              onClick={onResetProject}
            >
              Reset Changes to Template
            </button>
          </div>
          {gitChanges.length === 0 ? (
            <div style={{ color: "var(--as-text-muted)" }}>
              Working tree clean — all project files match baseline snapshot.
            </div>
          ) : (
            gitChanges.map((ch) => (
              <div
                key={ch.path}
                onClick={() => ch.fileId && onOpenFileById(ch.fileId)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: ch.fileId ? "pointer" : "default",
                  padding: "2px 4px",
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 11,
                    color:
                      ch.status === "added"
                        ? "var(--as-green)"
                        : ch.status === "deleted"
                        ? "var(--as-red)"
                        : "var(--as-accent)",
                    minWidth: 66,
                  }}
                >
                  {ch.status.toUpperCase()}
                </span>
                <span style={{ color: "var(--as-text-primary)" }}>{ch.path}</span>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
