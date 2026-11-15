"use client";

import React from "react";
import type { IntellijProjectPreset, JavaSymbol, VirtualFileNode } from "@/lib/ide/intellijRunner";
import {
  ChevronRightIcon,
  JavaClassIcon,
  LockPadlockIcon,
  MethodBreadcrumbIcon,
  ModuleIcon,
  ReaderOffIcon,
  TreeFolderIcon,
} from "./ExpUiIcons";
import styles from "./intellij.module.css";
import type { EditorCursor } from "./types";

interface StatusBreadcrumbBarProps {
  preset: IntellijProjectPreset;
  activeFile: VirtualFileNode | null;
  symbols: JavaSymbol[];
  cursor: EditorCursor;
  lineEnding: "LF" | "CRLF";
  encoding: "UTF-8" | "UTF-16" | "ISO-8859-1";
  indentLabel: "4 spaces" | "2 spaces" | "Tab";
  readerMode: boolean;
  readOnly: boolean;
  onJumpToLine: (line: number) => void;
  onOpenGoToLine: () => void;
  onToggleReaderMode: () => void;
  onToggleLineEnding: () => void;
  onCycleEncoding: () => void;
  onCycleIndent: () => void;
  onToggleReadOnly: () => void;
  onLocateInProject: () => void;
}

export function StatusBreadcrumbBar({
  preset,
  activeFile,
  symbols,
  cursor,
  lineEnding,
  encoding,
  indentLabel,
  readerMode,
  readOnly,
  onJumpToLine,
  onOpenGoToLine,
  onToggleReaderMode,
  onToggleLineEnding,
  onCycleEncoding,
  onCycleIndent,
  onToggleReadOnly,
  onLocateInProject,
}: StatusBreadcrumbBarProps) {
  // Determine nearest enclosing method symbol at or before cursor.line
  const activeMethod = React.useMemo(() => {
    let best: JavaSymbol | null = null;
    for (let i = 0; i < symbols.length; i++) {
      const sym = symbols[i];
      if (sym.kind === "method" && sym.line <= cursor.line) {
        best = sym;
      }
    }
    return best;
  }, [symbols, cursor.line]);

  const pathSegments = React.useMemo(() => {
    if (!activeFile) return [];
    return activeFile.path.split("/").filter(Boolean);
  }, [activeFile]);

  return (
    <footer className={styles.statusBar} aria-label="Breadcrumb and status bar">
      {/* Left Breadcrumbs */}
      <nav className={styles.breadcrumbs} aria-label="File breadcrumb">
        <button type="button" className={styles.crumbBtn} onClick={onLocateInProject} title={preset.rootPath}>
          {preset.id === "HelloWorld" && <ModuleIcon size={14} />}
          <span>{preset.name}</span>
        </button>

        {pathSegments.map((seg, idx) => {
          const isLastSegment = idx === pathSegments.length - 1;
          const displaySeg = isLastSegment && activeFile?.displayName ? activeFile.displayName : seg;
          const isSource = seg === "src";
          const isModule = seg === "java-samples";
          const isPkg = !isSource && !isModule && !isLastSegment && seg !== "main" && seg !== "java";

          return (
            <React.Fragment key={`${seg}-${idx}`}>
              <span className={styles.crumbSep}>
                <ChevronRightIcon size={10} color="#6F737A" />
              </span>
              <button
                type="button"
                className={`${styles.crumbBtn} ${isLastSegment && !activeMethod ? styles.crumbBtnActive : ""}`}
                onClick={onLocateInProject}
              >
                {isModule ? (
                  <ModuleIcon size={13} />
                ) : isSource ? (
                  <TreeFolderIcon variant="sourceRoot" size={14} />
                ) : isLastSegment && activeFile?.kind === "java" ? (
                  <JavaClassIcon size={14} showRunBadge={Boolean(activeFile.isMainClass && preset.id === "HelloWorld")} />
                ) : isPkg ? (
                  <TreeFolderIcon variant="package" size={14} />
                ) : (
                  <TreeFolderIcon variant="default" size={14} />
                )}
                <span>{displaySeg}</span>
              </button>
            </React.Fragment>
          );
        })}

        {activeMethod && (
          <>
            <span className={styles.crumbSep}>
              <ChevronRightIcon size={10} color="#6F737A" />
            </span>
            <button
              type="button"
              className={`${styles.crumbBtn} ${styles.crumbBtnActive}`}
              onClick={() => onJumpToLine(activeMethod.line)}
              title={`Jump to ${activeMethod.signature}`}
            >
              <MethodBreadcrumbIcon size={13} />
              <span>{activeMethod.name}</span>
            </button>
          </>
        )}
      </nav>

      {/* Right Status Widgets */}
      <div className={styles.statusWidgets}>
        <button
          type="button"
          className={styles.statusWidgetBtn}
          onClick={onOpenGoToLine}
          title="Go to Line/Column (Ctrl+G)"
        >
          {cursor.line}:{cursor.col}
        </button>

        <button
          type="button"
          className={styles.statusWidgetBtn}
          onClick={onToggleReaderMode}
          title={readerMode ? "Reader Mode: On (click to disable)" : "Reader Mode / Inspections (click to toggle)"}
          aria-label="Reader Mode"
          aria-pressed={readerMode}
        >
          <ReaderOffIcon size={14} color={readerMode ? "#548AF7" : "#9DA0A8"} />
        </button>

        <button
          type="button"
          className={styles.statusWidgetBtn}
          onClick={onToggleLineEnding}
          title="Line Separator (click to toggle LF / CRLF)"
        >
          {lineEnding}
        </button>

        <button
          type="button"
          className={styles.statusWidgetBtn}
          onClick={onCycleEncoding}
          title={`File Encoding: ${encoding} (click to cycle)`}
        >
          {encoding}
        </button>

        <button
          type="button"
          className={styles.statusWidgetBtn}
          onClick={onCycleIndent}
          title={`Indent: ${indentLabel} (click to cycle)`}
        >
          {indentLabel}
        </button>

        <button
          type="button"
          className={styles.statusWidgetBtn}
          onClick={onToggleReadOnly}
          title={readOnly ? "Read-only (click to make writable)" : "Writable (click to toggle Read-only)"}
          aria-label="Toggle read-only mode"
        >
          <LockPadlockIcon size={13} locked={readOnly} color={readOnly ? "#E0A82E" : "#9DA0A8"} />
        </button>
      </div>
    </footer>
  );
}
