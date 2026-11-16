"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  tokenizeJavaLine,
  type JavaDiagnostic,
  type JavaSymbol,
  type JavaTokenType,
  type VirtualFileNode,
} from "@/lib/ide/intellijRunner";
import {
  ArrowDownSmallIcon,
  ArrowUpSmallIcon,
  CheckGreenIcon,
  ErrorCircleIcon,
  JavaClassIcon,
  ModuleIcon,
  MoreVerticalIcon,
  PlayFilledIcon,
  PlayOutlineIcon,
  WarningTriangleIcon,
} from "./ExpUiIcons";
import styles from "./intellij.module.css";
import type { EditorCursor } from "./types";

interface CodeEditorPaneProps {
  openTabs: VirtualFileNode[];
  activeFile: VirtualFileNode | null;
  presetId: "HelloWorld" | "intellij-samples";
  code: string;
  cursor: EditorCursor;
  fontSize: number;
  indentUnit: string;
  readOnly: boolean;
  softWrap: boolean;
  dirtyFiles: Record<string, boolean>;
  diagnostics: JavaDiagnostic[];
  symbols: JavaSymbol[];
  breakpoints: Record<number, boolean>;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCloseOtherTabs: () => void;
  onChangeCode: (nextCode: string) => void;
  onCursorChange: (cursor: EditorCursor) => void;
  onToggleBreakpoint: (line: number) => void;
  onRunCurrentFile: () => void;
  onOpenProblemsTab: () => void;
  onJumpToLine: (line: number) => void;
}

function getTokenClassName(type: JavaTokenType): string {
  switch (type) {
    case "keyword":
      return styles.tokKeyword;
    case "string":
      return styles.tokString;
    case "char":
      return styles.tokChar;
    case "number":
      return styles.tokNumber;
    case "comment":
      return styles.tokComment;
    case "annotation":
      return styles.tokAnnotation;
    case "staticField":
      return styles.tokStaticField;
    case "methodDecl":
      return styles.tokMethodDecl;
    case "punctuation":
      return styles.tokPunctuation;
    case "operator":
      return styles.tokOperator;
    default:
      return styles.tokIdentifier;
  }
}

export function computeCursorFromOffset(text: string, offset: number): EditorCursor {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, safeOffset);
  const parts = before.split("\n");
  return {
    line: parts.length,
    col: parts[parts.length - 1].length + 1,
  };
}

export function computeOffsetFromCursor(text: string, line: number, col: number): number {
  const lines = text.split("\n");
  const targetLineIdx = Math.max(0, Math.min(line - 1, lines.length - 1));
  let offset = 0;
  for (let i = 0; i < targetLineIdx; i++) {
    offset += lines[i].length + 1;
  }
  const maxCol = lines[targetLineIdx].length;
  return offset + Math.max(0, Math.min(col - 1, maxCol));
}

export function CodeEditorPane({
  openTabs,
  activeFile,
  presetId,
  code,
  cursor,
  fontSize,
  indentUnit,
  readOnly,
  softWrap,
  dirtyFiles,
  diagnostics,
  symbols,
  breakpoints,
  textareaRef,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onChangeCode,
  onCursorChange,
  onToggleBreakpoint,
  onRunCurrentFile,
  onOpenProblemsTab,
  onJumpToLine,
}: CodeEditorPaneProps) {
  const preRef = useRef<HTMLPreElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const [diagCursorIdx, setDiagCursorIdx] = useState(0);

  const lines = useMemo(() => code.split("\n"), [code]);
  const lineHeight = Math.round(fontSize * 1.62);

  const isJavaFile = activeFile?.kind === "java" || activeFile?.name.endsWith(".java");

  const tokenizedLines = useMemo(() => {
    let inBlock = false;
    return lines.map((line) => {
      if (!isJavaFile) {
        return [{ type: "identifier" as JavaTokenType, text: line }];
      }
      const res = tokenizeJavaLine(line, inBlock);
      inBlock = res.inBlockComment;
      return res.tokens;
    });
  }, [lines, isJavaFile]);

  const runnableLines = useMemo(() => {
    const map: Record<number, JavaSymbol> = {};
    for (let i = 0; i < symbols.length; i++) {
      const sym = symbols[i];
      if (sym.kind === "class" || sym.isMain) {
        map[sym.line] = sym;
      }
    }
    return map;
  }, [symbols]);

  const diagByLine = useMemo(() => {
    const map: Record<number, JavaDiagnostic> = {};
    for (let i = 0; i < diagnostics.length; i++) {
      const d = diagnostics[i];
      if (!map[d.line] || d.severity === "error") {
        map[d.line] = d;
      }
    }
    return map;
  }, [diagnostics]);

  const errorCount = useMemo(() => diagnostics.filter((d) => d.severity === "error").length, [diagnostics]);
  const warningCount = useMemo(() => diagnostics.filter((d) => d.severity === "warning").length, [diagnostics]);

  const syncScroll = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    setScrollTop(ta.scrollTop);
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
  };

  const syncCursor = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = computeCursorFromOffset(ta.value, ta.selectionStart ?? 0);
    onCursorChange(pos);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;
    const ta = e.currentTarget;

    if (e.key === "Tab") {
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = ta.value.slice(0, start) + indentUnit + ta.value.slice(end);
      onChangeCode(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + indentUnit.length;
        syncCursor();
      });
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = ta.value.slice(0, start);
      const lastNewline = before.lastIndexOf("\n");
      const currentLineText = before.slice(lastNewline + 1);
      const indentMatch = /^(\s*)/.exec(currentLineText);
      let indent = indentMatch ? indentMatch[1] : "";
      if (currentLineText.trim().endsWith("{")) {
        indent += indentUnit;
      }
      const insertText = "\n" + indent;
      const next = ta.value.slice(0, start) + insertText + ta.value.slice(end);
      onChangeCode(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + insertText.length;
        syncCursor();
      });
    }
  };

  const stepDiagnostic = (dir: 1 | -1) => {
    if (diagnostics.length === 0) return;
    const nextIdx = (diagCursorIdx + dir + diagnostics.length) % diagnostics.length;
    setDiagCursorIdx(nextIdx);
    onJumpToLine(diagnostics[nextIdx].line);
  };

  const renderTabIcon = (tab: VirtualFileNode) => {
    if (tab.kind === "java") {
      return <JavaClassIcon size={15} showRunBadge={Boolean(tab.isMainClass && presetId === "HelloWorld")} />;
    }
    return <ModuleIcon size={14} />;
  };

  const activeLineOffsetTop = (cursor.line - 1) * lineHeight + 8 - scrollTop;

  return (
    <section className={styles.editorSection} aria-label="Code editor">
      {/* Editor Tab Bar */}
      <div className={styles.editorTabBar}>
        <div className={styles.editorTabsScroll} role="tablist" aria-label="Open files">
          {openTabs.map((tab) => {
            const isActive = activeFile?.id === tab.id;
            const isDirty = Boolean(dirtyFiles[tab.id]);
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                className={`${styles.editorTab} ${isActive ? styles.editorTabActive : ""}`}
                onClick={() => onSelectTab(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectTab(tab.id);
                  }
                }}
              >
                {renderTabIcon(tab)}
                <span>{tab.name}</span>
                {isDirty && <span className={styles.tabDirtyDot} title="Modified" />}
                <button
                  type="button"
                  className={styles.tabCloseBtn}
                  aria-label={`Close ${tab.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                >
                  ×
                </button>
                {isActive && <span className={styles.tabActiveIndicator} />}
              </div>
            );
          })}
        </div>

        <div className={styles.editorTabRightActions} style={{ position: "relative" }}>
          <button
            type="button"
            className={styles.smallActionBtn}
            title="Tab Actions"
            aria-label="Editor tab actions"
            onClick={() => setTabMenuOpen((o) => !o)}
          >
            <MoreVerticalIcon size={15} color="#9DA0A8" />
          </button>
          {tabMenuOpen && (
            <div className={`${styles.popoverMenu} ${styles.popoverMenuRight}`} role="menu">
              <button
                type="button"
                role="menuitem"
                className={styles.popoverItem}
                onClick={() => {
                  onRunCurrentFile();
                  setTabMenuOpen(false);
                }}
              >
                <span>Run Current File</span>
                <span className={styles.popoverShortcut}>Shift+F10</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.popoverItem}
                onClick={() => {
                  onCloseOtherTabs();
                  setTabMenuOpen(false);
                }}
              >
                <span>Close Other Tabs</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Editor Canvas */}
      {!activeFile ? (
        <div className={styles.editorEmptyState}>
          <div>No file is open</div>
          <div style={{ fontSize: 12 }}>Select a file from the Project tree or press Ctrl+K to Search Everywhere</div>
        </div>
      ) : (
        <div className={styles.editorCanvasWrap}>
          {/* Top-right Inspection Status Pill */}
          <div
            className={`${styles.inspectionBadge} ${diagnostics.length === 0 ? styles.inspectionBadgeClean : ""}`}
            title={
              diagnostics.length === 0
                ? "No problems found"
                : `${errorCount} error(s), ${warningCount} warning(s) — click to open Problems`
            }
            onClick={() => {
              if (diagnostics.length > 0) onOpenProblemsTab();
            }}
          >
            {diagnostics.length === 0 ? (
              <CheckGreenIcon size={15} />
            ) : (
              <>
                {errorCount > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#F07B7B" }}>
                    <ErrorCircleIcon size={13} />
                    <span>{errorCount}</span>
                  </span>
                )}
                {warningCount > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#E0A82E" }}>
                    <WarningTriangleIcon size={13} />
                    <span>{warningCount}</span>
                  </span>
                )}
                <button
                  type="button"
                  className={styles.inspectionNavBtn}
                  title="Previous Problem"
                  onClick={(e) => {
                    e.stopPropagation();
                    stepDiagnostic(-1);
                  }}
                >
                  <ArrowUpSmallIcon size={11} color="#9DA0A8" />
                </button>
                <button
                  type="button"
                  className={styles.inspectionNavBtn}
                  title="Next Problem"
                  onClick={(e) => {
                    e.stopPropagation();
                    stepDiagnostic(1);
                  }}
                >
                  <ArrowDownSmallIcon size={11} color="#9DA0A8" />
                </button>
              </>
            )}
          </div>

          {/* Gutter */}
          <div ref={gutterRef} className={styles.editorGutter} style={{ lineHeight: `${lineHeight}px` }}>
            {lines.map((_, idx) => {
              const lineNum = idx + 1;
              const runnable = runnableLines[lineNum];
              const hasBp = Boolean(breakpoints[lineNum]);
              const isActiveLine = cursor.line === lineNum;
              return (
                <div key={lineNum} className={styles.gutterRow} style={{ height: lineHeight }}>
                  <span
                    className={`${styles.gutterLineNum} ${isActiveLine ? styles.gutterLineNumActive : ""}`}
                    onClick={() => onToggleBreakpoint(lineNum)}
                    title="Click to toggle breakpoint"
                  >
                    {lineNum}
                  </span>
                  <span className={styles.gutterActionSlot}>
                    {hasBp ? (
                      <button
                        type="button"
                        className={styles.gutterRunBtn}
                        onClick={() => onToggleBreakpoint(lineNum)}
                        title={`Breakpoint on line ${lineNum}`}
                      >
                        <span className={styles.breakpointDot} />
                      </button>
                    ) : runnable && isJavaFile ? (
                      <button
                        type="button"
                        className={styles.gutterRunBtn}
                        onClick={onRunCurrentFile}
                        title={`Run '${runnable.name}'`}
                        aria-label={`Run ${runnable.name}`}
                      >
                        {presetId === "intellij-samples" && runnable.isMain ? (
                          <PlayFilledIcon size={12} color="#57965C" />
                        ) : (
                          <PlayOutlineIcon size={13} color="#57965C" />
                        )}
                      </button>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Code Highlight Layer + Editable Textarea */}
          <div className={styles.editorCodeArea}>
            <div className={styles.currentLineHighlight} style={{ top: activeLineOffsetTop, height: lineHeight }} />

            <pre
              ref={preRef}
              aria-hidden="true"
              className={styles.editorHighlightPre}
              style={{
                fontSize,
                lineHeight: `${lineHeight}px`,
                whiteSpace: softWrap ? "pre-wrap" : "pre",
              }}
            >
              {tokenizedLines.map((tokens, lineIdx) => {
                const lineNum = lineIdx + 1;
                const diag = diagByLine[lineNum];
                const diagClass =
                  diag?.severity === "error"
                    ? styles.diagUnderlineError
                    : diag?.severity === "warning"
                      ? styles.diagUnderlineWarning
                      : "";

                return (
                  <div key={lineNum} style={{ minHeight: lineHeight }}>
                    {tokens.length === 0 ? (
                      " "
                    ) : (
                      <span className={diagClass}>
                        {tokens.map((tok, tIdx) => (
                          <span key={tIdx} className={getTokenClassName(tok.type)}>
                            {tok.text}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                );
              })}
            </pre>

            <textarea
              ref={textareaRef}
              className={styles.editorTextarea}
              value={code}
              readOnly={readOnly}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              aria-label={`Code editor for ${activeFile.name}`}
              style={{
                fontSize,
                lineHeight: `${lineHeight}px`,
                whiteSpace: softWrap ? "pre-wrap" : "pre",
              }}
              onChange={(e) => {
                onChangeCode(e.target.value);
                requestAnimationFrame(syncCursor);
              }}
              onScroll={syncScroll}
              onKeyDown={handleKeyDown}
              onKeyUp={syncCursor}
              onClick={syncCursor}
              onSelect={syncCursor}
            />

            {/* Right scrollbar diagnostic ticks */}
            {diagnostics.length > 0 && (
              <div className={styles.scrollbarMarkerTrack}>
                {diagnostics.map((d, i) => {
                  const pct = Math.min(96, Math.max(3, (d.line / Math.max(1, lines.length)) * 100));
                  return (
                    <span
                      key={`${d.line}-${i}`}
                      className={styles.scrollbarMarkerTick}
                      style={{
                        top: `${pct}%`,
                        background: d.severity === "error" ? "#DB5860" : "#E0A82E",
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
