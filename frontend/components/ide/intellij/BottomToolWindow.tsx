"use client";

import React, { useEffect, useRef, useState } from "react";
import type { IntellijProjectPreset, JavaDiagnostic, JavaRunResult, RunConfiguration } from "@/lib/ide/intellijRunner";
import {
  ArrowDownSmallIcon,
  ArrowUpSmallIcon,
  CheckGreenIcon,
  ErrorCircleIcon,
  GitBranchIcon,
  HideMinimizeIcon,
  MoreVerticalIcon,
  RerunIcon,
  RunConfigAppIcon,
  SoftWrapIcon,
  StopSquareIcon,
  ThreadDumpCameraIcon,
  WarningTriangleIcon,
} from "./ExpUiIcons";
import styles from "./intellij.module.css";
import type { BottomToolId, BuildLogEntry, TerminalEntry } from "./types";

interface BottomToolWindowProps {
  activeTool: BottomToolId;
  height: number;
  preset: IntellijProjectPreset;
  activeRunConfig: RunConfiguration;
  runResult: JavaRunResult | null;
  isRunning: boolean;
  softWrap: boolean;
  diagnostics: JavaDiagnostic[];
  activeFileName: string;
  terminalEntries: TerminalEntry[];
  buildLogs: BuildLogEntry[];
  gitEnabled: boolean;
  gitBranch: string;
  gitLog: Array<{ hash: string; message: string; author: string; time: string }>;
  onSelectBottomTool: (id: BottomToolId) => void;
  onHide: () => void;
  onRerun: () => void;
  onStopRun: () => void;
  onClearRunConsole: () => void;
  onCaptureThreadDump: () => void;
  onToggleSoftWrap: () => void;
  onJumpToLine: (line: number, col?: number) => void;
  onRunTerminalCommand: (cmd: string) => void;
  onTriggerBuild: () => void;
  onEnableGit: () => void;
}

export function BottomToolWindow({
  activeTool,
  height,
  preset,
  activeRunConfig,
  runResult,
  isRunning,
  softWrap,
  diagnostics,
  activeFileName,
  terminalEntries,
  buildLogs,
  gitEnabled,
  gitBranch,
  gitLog,
  onSelectBottomTool,
  onHide,
  onRerun,
  onStopRun,
  onClearRunConsole,
  onCaptureThreadDump,
  onToggleSoftWrap,
  onJumpToLine,
  onRunTerminalCommand,
  onTriggerBuild,
  onEnableGit,
}: BottomToolWindowProps) {
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const terminalInputRef = useRef<HTMLInputElement | null>(null);

  const [showCommandLine, setShowCommandLine] = useState(false);
  const [moreRunOpen, setMoreRunOpen] = useState(false);
  const [termInput, setTermInput] = useState("");
  const [termHistory, setTermHistory] = useState<string[]>([]);
  const [termHistIdx, setTermHistIdx] = useState(-1);

  useEffect(() => {
    if (activeTool === "run" && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [runResult, activeTool]);

  useEffect(() => {
    if (activeTool === "terminal" && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalEntries, activeTool]);

  const titleLabel =
    activeTool === "run"
      ? "Run"
      : activeTool === "build"
        ? "Build"
        : activeTool === "terminal"
          ? "Terminal"
          : activeTool === "problems"
            ? "Problems"
            : "Git";

  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const cmd = termInput;
      if (cmd.trim()) {
        setTermHistory((prev) => [cmd, ...prev]);
      }
      setTermHistIdx(-1);
      setTermInput("");
      onRunTerminalCommand(cmd);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (termHistory.length > 0) {
        const nextIdx = Math.min(termHistory.length - 1, termHistIdx + 1);
        setTermHistIdx(nextIdx);
        setTermInput(termHistory[nextIdx]);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (termHistIdx <= 0) {
        setTermHistIdx(-1);
        setTermInput("");
      } else {
        const nextIdx = termHistIdx - 1;
        setTermHistIdx(nextIdx);
        setTermInput(termHistory[nextIdx]);
      }
    }
  };

  const renderRunTab = () => (
    <div className={styles.bottomBody}>
      {/* Left Vertical Console Action Rail */}
      <div className={styles.consoleLeftToolbar} aria-label="Console actions">
        <button
          type="button"
          className={styles.smallActionBtn}
          title={`Rerun '${activeRunConfig.name}'`}
          aria-label="Rerun"
          onClick={onRerun}
        >
          <RerunIcon size={15} />
        </button>
        <button
          type="button"
          className={styles.smallActionBtn}
          title="Stop"
          aria-label="Stop"
          onClick={onStopRun}
        >
          <StopSquareIcon size={15} active={isRunning} />
        </button>
        <button
          type="button"
          className={styles.smallActionBtn}
          title="Get Thread Dump"
          aria-label="Get Thread Dump"
          onClick={onCaptureThreadDump}
        >
          <ThreadDumpCameraIcon size={15} color="#9DA0A8" />
        </button>
        <button
          type="button"
          className={`${styles.smallActionBtn} ${softWrap ? styles.smallActionBtnActive : ""}`}
          title="Soft-Wrap"
          aria-label="Toggle Soft-Wrap"
          onClick={onToggleSoftWrap}
        >
          <SoftWrapIcon size={15} color={softWrap ? "#DFE1E5" : "#9DA0A8"} />
        </button>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className={styles.smallActionBtn}
            title="More Console Options"
            aria-label="More Console Options"
            onClick={() => setMoreRunOpen((v) => !v)}
          >
            <MoreVerticalIcon size={15} color="#9DA0A8" />
          </button>
          {moreRunOpen && (
            <div className={styles.popoverMenu} style={{ left: 32, top: 0 }} role="menu">
              <button
                type="button"
                role="menuitem"
                className={styles.popoverItem}
                onClick={() => {
                  setShowCommandLine((s) => !s);
                  setMoreRunOpen(false);
                }}
              >
                <span>{showCommandLine ? "Hide Command Line" : "Show Command Line"}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.popoverItem}
                onClick={() => {
                  onClearRunConsole();
                  setMoreRunOpen(false);
                }}
              >
                <span>Clear All</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Console Surface (#1E1F22) */}
      <div className={styles.consoleSurfaceWrap}>
        <div className={styles.consoleMiniGutter}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button
              type="button"
              className={styles.consoleMiniGutterBtn}
              title="Scroll to Top"
              onClick={() => {
                if (consoleRef.current) consoleRef.current.scrollTop = 0;
              }}
            >
              <ArrowUpSmallIcon size={12} color="#6F737A" />
            </button>
            <button
              type="button"
              className={styles.consoleMiniGutterBtn}
              title="Scroll to Bottom"
              onClick={() => {
                if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
              }}
            >
              <ArrowDownSmallIcon size={12} color="#6F737A" />
            </button>
          </div>
          <button
            type="button"
            className={styles.consoleMiniGutterBtn}
            title="Toggle Command Line"
            onClick={() => setShowCommandLine((s) => !s)}
            style={{ fontSize: 11, fontFamily: "monospace" }}
          >
            &gt;
          </button>
        </div>

        <div ref={consoleRef} className={styles.consoleOutput} aria-live="polite">
          {showCommandLine && runResult && (
            <div className={`${styles.consoleLine} ${styles.consoleLineCmd} ${softWrap ? styles.consoleLineWrap : styles.consoleLineNowrap}`}>
              {runResult.commandLine}
            </div>
          )}
          {!runResult ? (
            <div className={styles.consoleLine} style={{ color: "#7A7E85" }}>
              Click the green Run button (▷) to execute {activeRunConfig.name}.
            </div>
          ) : (
            runResult.outputLines.map((line, i) => {
              const isErrLine = !runResult.success && line.indexOf("error:") !== -1;
              return (
                <div
                  key={i}
                  className={`${styles.consoleLine} ${isErrLine ? styles.consoleLineErr : ""} ${
                    softWrap ? styles.consoleLineWrap : styles.consoleLineNowrap
                  }`}
                >
                  {line === "" ? "\u00A0" : line}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  const renderTerminalTab = () => (
    <div
      ref={terminalRef}
      className={styles.terminalContainer}
      onClick={() => terminalInputRef.current?.focus()}
    >
      {terminalEntries.map((entry) => (
        <div key={entry.id} style={{ marginBottom: 4 }}>
          {entry.command !== "" && (
            <div>
              <span className={styles.terminalPromptLabel}>{entry.prompt}</span>{" "}
              <span style={{ color: "#DFE1E5" }}>{entry.command}</span>
            </div>
          )}
          {entry.outputLines.map((l, idx) => (
            <div key={idx} style={{ whiteSpace: "pre-wrap" }}>
              {l || "\u00A0"}
            </div>
          ))}
        </div>
      ))}
      <div className={styles.terminalPromptLine}>
        <span className={styles.terminalPromptLabel}>{preset.rootPath} %</span>
        <input
          ref={terminalInputRef}
          type="text"
          className={styles.terminalInput}
          value={termInput}
          onChange={(e) => setTermInput(e.target.value)}
          onKeyDown={handleTerminalKeyDown}
          aria-label="IntelliJ embedded terminal input"
          placeholder="Type 'help', 'javac HelloWorld.java', 'java HelloWorld', 'ls', 'pwd'..."
        />
      </div>
    </div>
  );

  const renderProblemsTab = () => (
    <div className={styles.bottomListScroll}>
      {diagnostics.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 6px", color: "#9DA0A8" }}>
          <CheckGreenIcon size={15} />
          <span>No problems have been detected in {activeFileName}</span>
        </div>
      ) : (
        diagnostics.map((d, idx) => (
          <button
            key={`${d.line}-${d.column}-${idx}`}
            type="button"
            className={styles.problemRow}
            onClick={() => onJumpToLine(d.line, d.column)}
          >
            {d.severity === "error" ? <ErrorCircleIcon size={14} /> : <WarningTriangleIcon size={14} />}
            <span>{d.message}</span>
            <span className={styles.problemLocation}>
              {activeFileName}:{d.line}:{d.column}
            </span>
          </button>
        ))
      )}
    </div>
  );

  const renderBuildTab = () => (
    <div className={styles.bottomListScroll}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ color: "#9DA0A8", fontSize: 12 }}>Project: {preset.name} (JDK 21)</span>
        <button type="button" className={styles.dialogBtnSecondary} onClick={onTriggerBuild}>
          Rebuild Project
        </button>
      </div>
      {buildLogs.map((log) => (
        <div key={log.id} className={styles.drawerCard} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 500 }}>
            {log.status === "success" ? <CheckGreenIcon size={14} /> : <ErrorCircleIcon size={14} />}
            <span>{log.summary}</span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "#7A7E85" }}>{log.timestamp}</span>
          </div>
          {log.details.map((d, i) => (
            <div key={i} style={{ marginTop: 3, fontSize: 12, color: "#9DA0A8", fontFamily: "var(--font-mono), monospace" }}>
              {d}
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  const renderGitTab = () => (
    <div className={styles.bottomListScroll}>
      {!gitEnabled ? (
        <div style={{ padding: "12px 6px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#9DA0A8" }}>Version control is not initialized for {preset.name}.</span>
          <button type="button" className={styles.dialogBtnPrimary} onClick={onEnableGit}>
            Create Git Repository
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, color: "#9DA0A8", marginBottom: 2 }}>
            Branch: <strong style={{ color: "#DFE1E5" }}>{gitBranch}</strong>
          </div>
          {gitLog.map((c) => (
            <div key={c.hash} className={styles.problemRow} style={{ cursor: "default" }}>
              <GitBranchIcon size={14} color="#548AF7" />
              <span style={{ fontFamily: "var(--font-mono), monospace", color: "#548AF7", fontSize: 11.5 }}>{c.hash}</span>
              <span>{c.message}</span>
              <span className={styles.problemLocation}>
                {c.author} · {c.time}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <section className={styles.bottomPane} style={{ height }} aria-label={`${titleLabel} tool window`}>
      <div className={styles.bottomHeader}>
        <div className={styles.bottomHeaderLeft}>
          <span className={styles.bottomPaneTitle}>{titleLabel}</span>

          {activeTool === "run" && (
            <button
              type="button"
              className={`${styles.bottomTab} ${styles.bottomTabActive}`}
              onClick={() => onSelectBottomTool("run")}
            >
              <RunConfigAppIcon size={14} color="#548AF7" />
              <span>{activeRunConfig.name}</span>
              <span
                role="button"
                tabIndex={-1}
                aria-label="Close Run tab"
                style={{ color: "#9DA0A8", marginLeft: 4 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onHide();
                }}
              >
                ×
              </span>
              <span className={styles.tabActiveIndicator} />
            </button>
          )}

          {activeTool === "terminal" && (
            <button
              type="button"
              className={`${styles.bottomTab} ${styles.bottomTabActive}`}
              onClick={() => terminalInputRef.current?.focus()}
            >
              <span>Local (zsh)</span>
              <span className={styles.tabActiveIndicator} />
            </button>
          )}

          {activeTool === "problems" && (
            <button
              type="button"
              className={`${styles.bottomTab} ${styles.bottomTabActive}`}
              onClick={() => onSelectBottomTool("problems")}
            >
              <span>File ({diagnostics.length})</span>
              <span className={styles.tabActiveIndicator} />
            </button>
          )}

          {activeTool === "build" && (
            <button
              type="button"
              className={`${styles.bottomTab} ${styles.bottomTabActive}`}
              onClick={onTriggerBuild}
            >
              <span>Build Output</span>
              <span className={styles.tabActiveIndicator} />
            </button>
          )}

          {activeTool === "git" && (
            <button
              type="button"
              className={`${styles.bottomTab} ${styles.bottomTabActive}`}
              onClick={() => onSelectBottomTool("git")}
            >
              <span>Log</span>
              <span className={styles.tabActiveIndicator} />
            </button>
          )}
        </div>

        <div className={styles.paneActionRow}>
          <button
            type="button"
            className={styles.smallActionBtn}
            title="Switch to Terminal"
            aria-label="More bottom options"
            onClick={() => onSelectBottomTool(activeTool === "run" ? "terminal" : "run")}
          >
            <MoreVerticalIcon size={15} color="#9DA0A8" />
          </button>
          <button type="button" className={styles.smallActionBtn} title="Hide" aria-label="Hide bottom tool window" onClick={onHide}>
            <HideMinimizeIcon size={15} color="#9DA0A8" />
          </button>
        </div>
      </div>

      {activeTool === "run" && renderRunTab()}
      {activeTool === "terminal" && renderTerminalTab()}
      {activeTool === "problems" && renderProblemsTab()}
      {activeTool === "build" && renderBuildTab()}
      {activeTool === "git" && renderGitTab()}
    </section>
  );
}
