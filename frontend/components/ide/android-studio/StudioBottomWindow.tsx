"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "./androidStudio.module.css";
import {
  GradleBuildStep,
  LogcatEntry,
  LogcatLevel,
  StudioDeviceProfile,
  StudioProblem,
  getLogcatTagColor,
} from "@/lib/ide/androidStudioEngine";
import {
  CheckGreenIcon,
  EmulatorRecordIcon,
  EmulatorScreenshotIcon,
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
  onEmitSampleCrash: () => void;
  buildSteps: GradleBuildStep[];
  buildConsoleLines: string[];
  runConsoleLines: string[];
  problems: StudioProblem[];
  onSelectProblem: (problem: StudioProblem) => void;
  terminalHistory: { id: string; command: string; output: string[] }[];
  onExecuteTerminal: (command: string) => void;
  onClearTerminal: () => void;
  onTakeScreenshot: () => void;
}

const LEVEL_BADGE_STYLES: Record<
  LogcatLevel,
  { bg: string; fg: string; msgColor: string }
> = {
  V: { bg: "#D6D6D6", fg: "#000000", msgColor: "#BBBBBB" },
  D: { bg: "#305D78", fg: "#BBBBBB", msgColor: "#299999" },
  I: { bg: "#6A8759", fg: "#E9F5E6", msgColor: "#ABC023" },
  W: { bg: "#BBB529", fg: "#000000", msgColor: "#BBB529" },
  E: { bg: "#CF5B56", fg: "#000000", msgColor: "#FF6B68" },
  A: { bg: "#8B3C3C", fg: "#FFFFFF", msgColor: "#FF6B68" },
};

export function StudioBottomWindow({
  height,
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
  onEmitSampleCrash,
  buildSteps,
  buildConsoleLines,
  runConsoleLines,
  problems,
  onSelectProblem,
  terminalHistory,
  onExecuteTerminal,
  onClearTerminal,
  onTakeScreenshot,
}: StudioBottomWindowProps) {
  const [logcatPaused, setLogcatPaused] = useState(false);
  const [softWrap, setSoftWrap] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [terminalInput, setTerminalInput] = useState("");
  const logcatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!logcatPaused && logcatScrollRef.current) {
      logcatScrollRef.current.scrollTop = logcatScrollRef.current.scrollHeight;
    }
  }, [filteredLogcat.length, logcatPaused]);

  const hasPackageMinePill = /\bpackage:mine\b/i.test(logcatQuery);

  const toggleQueryToken = (token: string) => {
    if (logcatQuery.includes(token)) {
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
      {/* Top Header Strip */}
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
              activeTool === "profiler" ? styles.bottomTabBtnActive : ""
            }`}
            onClick={() => onSelectTool("profiler")}
          >
            Profiler
          </button>
          <button
            type="button"
            className={`${styles.bottomTabBtn} ${
              activeTool === "aqi" ? styles.bottomTabBtnActive : ""
            }`}
            onClick={() => onSelectTool("aqi")}
          >
            App Quality Insights
          </button>
          <button
            type="button"
            className={`${styles.bottomTabBtn} ${
              activeTool === "vcs" ? styles.bottomTabBtnActive : ""
            }`}
            onClick={() => onSelectTool("vcs")}
          >
            Version Control
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
              title="Click to cycle connected emulator/device"
            >
              <RunningDevicesStripeIcon size={14} />
              <span>
                {activeDevice.name} ({activeDevice.adbSerial}) {activeDevice.androidVersion}, API{" "}
                {activeDevice.apiLevel}
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
                placeholder="Filter (package:mine tag:MainActivity level:INFO - Choreographer is:crash)"
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
                  logcatQuery.includes("level:INFO") ? styles.segmentedBtnActive : ""
                }`}
                onClick={() => toggleQueryToken("level:INFO")}
              >
                level:INFO
              </button>
              <button
                type="button"
                className={`${styles.segmentedBtn} ${
                  logcatQuery.includes("level:ERROR") ? styles.segmentedBtnActive : ""
                }`}
                onClick={() => toggleQueryToken("level:ERROR")}
              >
                level:ERROR
              </button>
              <button
                type="button"
                className={styles.segmentedBtn}
                title="Simulate AndroidRuntime Crash Log"
                onClick={onEmitSampleCrash}
              >
                + Test Crash Log
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
                title="Restart Logcat"
                onClick={onRestartLogcat}
              >
                <RestartIcon size={14} />
              </button>
              <button
                type="button"
                className={styles.panelActionIcon}
                title="Scroll to the End"
                onClick={() => {
                  if (logcatScrollRef.current) {
                    logcatScrollRef.current.scrollTop = logcatScrollRef.current.scrollHeight;
                  }
                }}
              >
                ↓
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
                title="Configure Logcat Formatting Options (Standard / Compact)"
                onClick={() => setCompactView((v) => !v)}
              >
                ≡
              </button>
              <button
                type="button"
                className={styles.panelActionIcon}
                title="Take Screenshot"
                onClick={onTakeScreenshot}
              >
                <EmulatorScreenshotIcon size={14} />
              </button>
              <button
                type="button"
                className={styles.panelActionIcon}
                title="Record Screen"
                onClick={onTakeScreenshot}
              >
                <EmulatorRecordIcon size={14} />
              </button>
            </div>

            <div className={styles.logcatConsoleScroll} ref={logcatScrollRef}>
              {filteredLogcat.length === 0 ? (
                <div style={{ color: "#868A91", padding: "12px 8px" }}>
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
                      <span style={{ color: badge.msgColor }}>{entry.message}</span>
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
              width: 245,
              borderRight: "1px solid #35373B",
              padding: 8,
              overflow: "auto",
              background: "#2B2D30",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: "#DFE1E5" }}>
              ✓ Build :app:assembleDebug
            </div>
            {buildSteps.map((step) => (
              <div
                key={step.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "3px 6px",
                  fontSize: 12,
                  color: "#CED0D6",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <CheckGreenIcon size={12} />
                  <span>{step.label}</span>
                </span>
                <span style={{ color: "#868A91", fontSize: 11 }}>
                  {step.status === "up-to-date" ? "UP-TO-DATE" : `${step.durationMs}ms`}
                </span>
              </div>
            ))}
          </div>
          <div className={styles.logcatConsoleScroll}>
            {buildConsoleLines.map((line, i) => (
              <div
                key={i}
                style={{
                  color: line.includes("BUILD SUCCESSFUL")
                    ? "#57965C"
                    : line.startsWith("> Task")
                    ? "#9DA0A8"
                    : "#BCBEC4",
                }}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. RUN TOOL WINDOW */}
      {activeTool === "run" && (
        <div className={styles.logcatConsoleScroll}>
          {runConsoleLines.map((line, i) => (
            <div
              key={i}
              style={{
                color: line.includes("Connected to process")
                  ? "#3DDC84"
                  : line.startsWith("$ adb")
                  ? "#6B9BFA"
                  : "#BCBEC4",
              }}
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {/* 4. TERMINAL TOOL WINDOW */}
      {activeTool === "terminal" && (
        <div
          className={styles.logcatConsoleScroll}
          style={{ display: "flex", flexDirection: "column", gap: 6 }}
        >
          <div style={{ color: "#868A91" }}>
            Android Studio Local Terminal (Try: <code>./gradlew assembleDebug</code>,{" "}
            <code>./gradlew test</code>, <code>adb devices</code>, <code>git status</code>)
          </div>
          {terminalHistory.map((item) => (
            <div key={item.id}>
              <div style={{ color: "#3DDC84" }}>
                PS C:\AndroidStudioProjects\MyApplication&gt; {item.command}
              </div>
              {item.output.map((out, idx) => (
                <div key={idx} style={{ color: "#DFE1E5", whiteSpace: "pre-wrap" }}>
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
            <span style={{ color: "#3DDC84", flexShrink: 0 }}>
              PS C:\AndroidStudioProjects\MyApplication&gt;
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
                color: "#FFFFFF",
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#57965C" }}>
              <CheckGreenIcon size={14} />
              <span>No problems found in project files (Kotlin 2.0.21 &amp; Android Lint clean).</span>
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
                <span style={{ color: "#DFE1E5" }}>{prob.message}</span>
                <span style={{ color: "#868A91" }}>
                  {prob.fileName}:{prob.line}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* 6. PROFILER / AQI / VCS */}
      {activeTool === "profiler" && (
        <div className={styles.logcatConsoleScroll}>
          <div style={{ color: "#3DDC84", fontWeight: 600, marginBottom: 6 }}>
            Android Profiler — Session: {activeDevice.name} (PID 14820)
          </div>
          <div style={{ display: "flex", gap: 16, color: "#CED0D6" }}>
            <div>CPU: 8.4% (RenderThread + Compose FrameClock 120Hz)</div>
            <div>Memory: 64.2 MB / 256 MB (Native 18MB, Kotlin Heap 29MB)</div>
            <div>Network: 0 B/s idle</div>
            <div>Energy: Light</div>
          </div>
        </div>
      )}

      {activeTool === "aqi" && (
        <div className={styles.logcatConsoleScroll}>
          <div style={{ color: "#DFE1E5", fontWeight: 600, marginBottom: 4 }}>
            App Quality Insights (Firebase Crashlytics)
          </div>
          <div style={{ color: "#868A91" }}>
            99.94% Crash-free users over last 7 days · 0 Fatal issues in MainActivity.kt
          </div>
        </div>
      )}

      {activeTool === "vcs" && (
        <div className={styles.logcatConsoleScroll}>
          <div style={{ color: "#6B9BFA" }}>commit 8f41c2b (HEAD -&gt; main, origin/main)</div>
          <div style={{ color: "#DFE1E5" }}>
            Author: Android Developer &lt;dev@android.example.com&gt; — Initial Jetpack Compose Material3 setup
          </div>
        </div>
      )}
    </section>
  );
}
