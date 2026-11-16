"use client";

import React, { useState, useRef } from "react";
import styles from "./androidStudio.module.css";
import {
  DesignSurfaceMode,
  EditorSplitMode,
  PreviewWidgetNode,
  StudioFile,
  StudioProblem,
} from "@/lib/ide/androidStudioEngine";
import {
  CheckGreenIcon,
  ComposableGutterIcon,
  EditorOnlyIcon,
  EditorPreviewSplitIcon,
  ErrorCircleIcon,
  GradleFileIcon,
  KotlinFileIcon,
  KotlinGradleScriptIcon,
  ManifestFileIcon,
  MoreVerticalIcon,
  PreviewOnlyDesignIcon,
  PropertiesFileIcon,
  RestartIcon,
  RunPlayIcon,
  RunPreviewOnDeviceIcon,
  TomlFileIcon,
  WarningTriangleIcon,
  XmlFileIcon,
} from "./StudioIcons";

interface StudioEditorSplitPaneProps {
  openTabs: StudioFile[];
  activeFile: StudioFile;
  dirtyFileIds: Set<string>;
  onSelectTab: (fileId: string) => void;
  onCloseTab: (fileId: string) => void;
  onUpdateFileContent: (fileId: string, newContent: string) => void;
  splitMode: EditorSplitMode;
  onChangeSplitMode: (mode: EditorSplitMode) => void;
  designSurfaceMode: DesignSurfaceMode;
  onChangeDesignSurfaceMode: (mode: DesignSurfaceMode) => void;
  previewTree: PreviewWidgetNode;
  composeClickCount: number;
  onIncrementComposeCounter: () => void;
  onRunFromGutter: () => void;
  onDeployPreviewToDevice: () => void;
  problems: StudioProblem[];
  onOpenProblemsPanel: () => void;
  cursorPos: { line: number; col: number };
  onChangeCursorPos: (pos: { line: number; col: number }) => void;
}

export function renderFileTabIcon(file: StudioFile) {
  if (file.kind === "manifest") return <ManifestFileIcon size={15} />;
  switch (file.kind) {
    case "kotlin":
      return <KotlinFileIcon size={15} />;
    case "xml":
    case "svg":
      return <XmlFileIcon size={15} />;
    case "gradle-kts":
      return <KotlinGradleScriptIcon size={15} />;
    case "toml":
      return <TomlFileIcon size={15} />;
    case "properties":
    case "proguard":
      return <PropertiesFileIcon size={15} />;
    default:
      return <GradleFileIcon size={15} />;
  }
}

const KOTLIN_KEYWORDS = new Set([
  "package",
  "import",
  "class",
  "fun",
  "val",
  "var",
  "override",
  "private",
  "public",
  "internal",
  "protected",
  "object",
  "interface",
  "data",
  "sealed",
  "enum",
  "return",
  "if",
  "else",
  "when",
  "for",
  "while",
  "true",
  "false",
  "null",
  "by",
  "in",
  "is",
  "as",
  "super",
  "this",
  "plugins",
  "android",
  "dependencies",
]);

function highlightCodeLine(line: string, kind: StudioFile["kind"]): React.ReactNode {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
    return <span className={styles.tokComment}>{line}</span>;
  }
  if (kind === "xml" || kind === "manifest" || kind === "svg") {
    const parts: React.ReactNode[] = [];
    const regex = /(<!--[\s\S]*?-->|<\/?[a-zA-Z0-9_.:-]+|\s+[a-zA-Z0-9_:-]+(?==)|"[^"]*"|\/>|>)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith("<!--")) {
        parts.push(
          <span key={key++} className={styles.tokComment}>
            {token}
          </span>
        );
      } else if (token.startsWith("<") || token === ">" || token === "/>") {
        parts.push(
          <span key={key++} className={styles.tokTag}>
            {token}
          </span>
        );
      } else if (token.startsWith('"')) {
        parts.push(
          <span key={key++} className={styles.tokString}>
            {token}
          </span>
        );
      } else {
        parts.push(
          <span key={key++} className={styles.tokXmlNs}>
            {token}
          </span>
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }
    return parts;
  }

  const tokens: React.ReactNode[] = [];
  const tokenRegex =
    /(\/\/.*$|@[A-Za-z0-9_]+|"(?:[^"\\]|\\.)*"|\b0x[0-9A-Fa-f]+\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = tokenRegex.exec(line)) !== null) {
    if (m.index > lastIdx) {
      tokens.push(line.slice(lastIdx, m.index));
    }
    const word = m[0];
    if (word.startsWith("//")) {
      tokens.push(
        <span key={k++} className={styles.tokComment}>
          {word}
        </span>
      );
    } else if (word.startsWith("@")) {
      tokens.push(
        <span key={k++} className={styles.tokAnnotation}>
          {word}
        </span>
      );
    } else if (word.startsWith('"')) {
      tokens.push(
        <span key={k++} className={styles.tokString}>
          {word}
        </span>
      );
    } else if (/^(0x|\d)/.test(word)) {
      tokens.push(
        <span key={k++} className={styles.tokNumber}>
          {word}
        </span>
      );
    } else if (KOTLIN_KEYWORDS.has(word)) {
      tokens.push(
        <span key={k++} className={styles.tokKeyword}>
          {word}
        </span>
      );
    } else if (line[m.index + word.length] === "(") {
      tokens.push(
        <span key={k++} className={styles.tokCall}>
          {word}
        </span>
      );
    } else {
      tokens.push(word);
    }
    lastIdx = tokenRegex.lastIndex;
  }
  if (lastIdx < line.length) {
    tokens.push(line.slice(lastIdx));
  }
  return tokens;
}

export function StudioEditorSplitPane({
  openTabs,
  activeFile,
  dirtyFileIds,
  onSelectTab,
  onCloseTab,
  onUpdateFileContent,
  splitMode,
  onChangeSplitMode,
  designSurfaceMode,
  onChangeDesignSurfaceMode,
  previewTree,
  composeClickCount,
  onIncrementComposeCounter,
  onRunFromGutter,
  onDeployPreviewToDevice,
  problems,
  onOpenProblemsPanel,
  cursorPos,
  onChangeCursorPos,
}: StudioEditorSplitPaneProps) {
  const [breakpoints, setBreakpoints] = useState<Set<string>>(new Set(["main-activity:20"]));
  const [interactivePreview, setInteractivePreview] = useState(true);
  const [paletteCategory, setPaletteCategory] = useState<
    "Common" | "Text" | "Buttons" | "Widgets" | "Layouts"
  >("Common");
  const [selectedXmlWidgetId, setSelectedXmlWidgetId] = useState<string>("greetingText");

  const preRef = useRef<HTMLPreElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const lines = activeFile.content.split("\n");
  const fileProblems = problems.filter((p) => p.fileId === activeFile.id);
  const errorCount = fileProblems.filter((p) => p.severity === "error").length;
  const warnCount = fileProblems.filter((p) => p.severity === "warning").length;

  const isXmlLayoutFile = Boolean(activeFile.isLayoutXml || activeFile.id === "activity-main-xml");

  const handleTextareaScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const top = e.currentTarget.scrollTop;
    const left = e.currentTarget.scrollLeft;
    if (preRef.current) {
      preRef.current.scrollTop = top;
      preRef.current.scrollLeft = left;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = top;
    }
  };

  const updateCursorFromTextarea = (el: HTMLTextAreaElement) => {
    const pos = el.selectionStart || 0;
    const upto = el.value.slice(0, pos);
    const split = upto.split("\n");
    onChangeCursorPos({
      line: split.length,
      col: split[split.length - 1].length + 1,
    });
  };

  const toggleBreakpoint = (lineNum: number) => {
    const key = `${activeFile.id}:${lineNum}`;
    setBreakpoints((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAddXmlWidget = (tag: "Button" | "TextView" | "Switch") => {
    if (!activeFile.content.includes("</androidx.constraintlayout.widget.ConstraintLayout>")) {
      return;
    }
    const idName = `${tag.toLowerCase()}_${lines.length}`;
    const snippet =
      tag === "Button"
        ? `\n    <Button\n        android:id="@+id/${idName}"\n        android:layout_width="wrap_content"\n        android:layout_height="wrap_content"\n        android:text="Action ${tag}" />`
        : `\n    <${tag}\n        android:id="@+id/${idName}"\n        android:layout_width="wrap_content"\n        android:layout_height="wrap_content"\n        android:text="New ${tag}" />`;
    const updated = activeFile.content.replace(
      "</androidx.constraintlayout.widget.ConstraintLayout>",
      `${snippet}\n\n</androidx.constraintlayout.widget.ConstraintLayout>`
    );
    onUpdateFileContent(activeFile.id, updated);
    setSelectedXmlWidgetId(idName);
  };

  return (
    <section className={styles.editorSection} aria-label="Editor and Design Split View">
      {/* 40px Editor Tab Bar + Top-Right Code | Split | Design Segmented Toggle */}
      <div className={styles.editorTabBar}>
        <div className={styles.editorTabsScroll} role="tablist">
          {openTabs.map((tab) => {
            const isActive = tab.id === activeFile.id;
            const isDirty = dirtyFileIds.has(tab.id);
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                className={`${styles.editorTab} ${isActive ? styles.editorTabActive : ""}`}
                onClick={() => onSelectTab(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelectTab(tab.id);
                }}
              >
                {renderFileTabIcon(tab)}
                <span>{tab.tabTitle}</span>
                {isDirty && <span className={styles.tabDirtyDot} title="Modified" />}
                {openTabs.length > 1 && (
                  <button
                    type="button"
                    className={styles.tabCloseBtn}
                    title={`Close ${tab.tabTitle}`}
                    aria-label={`Close ${tab.tabTitle}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                  >
                    ×
                  </button>
                )}
                {isActive && <span className={styles.tabActiveIndicator} />}
              </div>
            );
          })}
        </div>

        {/* Right: Code | Split | Design Segmented Control */}
        <div className={styles.editorTabRightControls}>
          <div className={styles.segmentedGroup} role="group" aria-label="Editor Split Mode">
            <button
              type="button"
              className={`${styles.segmentedBtn} ${splitMode === "Code" ? styles.segmentedBtnActive : ""}`}
              title="Code"
              onClick={() => onChangeSplitMode("Code")}
            >
              <EditorOnlyIcon size={14} />
              <span>Code</span>
            </button>
            <button
              type="button"
              className={`${styles.segmentedBtn} ${splitMode === "Split" ? styles.segmentedBtnActive : ""}`}
              title="Split"
              onClick={() => onChangeSplitMode("Split")}
            >
              <EditorPreviewSplitIcon size={14} />
              <span>Split</span>
            </button>
            <button
              type="button"
              className={`${styles.segmentedBtn} ${splitMode === "Design" ? styles.segmentedBtnActive : ""}`}
              title="Design"
              onClick={() => onChangeSplitMode("Design")}
            >
              <PreviewOnlyDesignIcon size={14} />
              <span>Design</span>
            </button>
          </div>
          <button
            type="button"
            className={styles.panelActionIcon}
            title="Editor Options"
            onClick={onOpenProblemsPanel}
          >
            <MoreVerticalIcon size={14} />
          </button>
        </div>
      </div>

      {/* Main Editor + Design Split Body */}
      <div className={styles.editorMainArea}>
        {/* Left/Full Code Editor Pane */}
        {splitMode !== "Design" && (
          <div className={styles.codePaneWrap}>
            {/* Top-Right Inspection Widget */}
            <button
              type="button"
              className={styles.inspectionPill}
              title="File Inspections & Problems"
              onClick={onOpenProblemsPanel}
            >
              {errorCount > 0 ? (
                <>
                  <ErrorCircleIcon size={13} />
                  <span>{errorCount}</span>
                </>
              ) : warnCount > 0 ? (
                <>
                  <WarningTriangleIcon size={13} />
                  <span>{warnCount}</span>
                </>
              ) : (
                <CheckGreenIcon size={13} />
              )}
            </button>

            {/* Gutter */}
            <div className={styles.editorGutter} ref={gutterRef}>
              {lines.map((lineText, idx) => {
                const lineNum = idx + 1;
                const bpKey = `${activeFile.id}:${lineNum}`;
                const hasBp = breakpoints.has(bpKey);
                const isComposable = lineText.trim().startsWith("@Composable");
                const isPreview = lineText.trim().startsWith("@Preview");
                const isRunnable =
                  lineText.includes("class MainActivity") ||
                  lineText.includes("@Test") ||
                  lineText.includes("fun GreetingPreview");

                return (
                  <div key={lineNum} className={styles.gutterRow}>
                    <span
                      className={`${styles.gutterLineNum} ${
                        cursorPos.line === lineNum ? styles.gutterLineNumActive : ""
                      }`}
                      onClick={() => toggleBreakpoint(lineNum)}
                    >
                      {lineNum}
                    </span>
                    <span className={styles.gutterIconSlot}>
                      {hasBp ? (
                        <button
                          type="button"
                          className={styles.gutterBtn}
                          title="Remove Breakpoint"
                          onClick={() => toggleBreakpoint(lineNum)}
                        >
                          <span className={styles.breakpointDot} />
                        </button>
                      ) : isRunnable || isPreview ? (
                        <button
                          type="button"
                          className={styles.gutterBtn}
                          title="Run / Deploy Preview"
                          onClick={onRunFromGutter}
                        >
                          <RunPlayIcon size={12} />
                        </button>
                      ) : isComposable ? (
                        <ComposableGutterIcon size={13} />
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Code Canvas */}
            <div className={styles.editorCodeArea}>
              <div
                className={styles.currentLineHighlight}
                style={{ top: `${8 + (cursorPos.line - 1) * 21}px` }}
              />
              <pre ref={preRef} className={styles.editorHighlightPre} aria-hidden="true">
                {lines.map((ln, idx) => (
                  <React.Fragment key={idx}>
                    {highlightCodeLine(ln, activeFile.kind)}
                    {idx < lines.length - 1 ? "\n" : ""}
                  </React.Fragment>
                ))}
              </pre>
              <textarea
                className={styles.editorTextarea}
                value={activeFile.content}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                aria-label={`Code editor for ${activeFile.tabTitle}`}
                onChange={(e) => {
                  onUpdateFileContent(activeFile.id, e.target.value);
                  updateCursorFromTextarea(e.currentTarget);
                }}
                onScroll={handleTextareaScroll}
                onClick={(e) => updateCursorFromTextarea(e.currentTarget)}
                onKeyUp={(e) => updateCursorFromTextarea(e.currentTarget)}
              />
            </div>
          </div>
        )}

        {/* Right/Full Compose @Preview OR XML Layout Designer Surface */}
        {splitMode !== "Code" && (
          <div className={styles.designSurfaceRoot}>
            {isXmlLayoutFile ? (
              <>
                {/* XML Layout Design Toolbar */}
                <div className={styles.designToolbar}>
                  <div className={styles.designToolbarGroup}>
                    {(["Design", "Blueprint", "Both"] as DesignSurfaceMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`${styles.previewToolBtn} ${
                          designSurfaceMode === mode ? styles.previewToolBtnActive : ""
                        }`}
                        onClick={() => onChangeDesignSurfaceMode(mode)}
                      >
                        {mode === "Both" ? "Design + Blueprint" : mode}
                      </button>
                    ))}
                    <span className={styles.toolbarSeparator} />
                    <span style={{ fontSize: 11.5, color: "#9DA0A8" }}>
                      Pixel 8 (411 × 891 dp, 420dpi) · API 35 · Theme.MyApplication
                    </span>
                  </div>
                  <div className={styles.designToolbarGroup}>
                    <button
                      type="button"
                      className={styles.previewToolBtn}
                      onClick={() => handleAddXmlWidget("Button")}
                    >
                      + Add Button
                    </button>
                  </div>
                </div>

                {/* 3-Column XML Layout Editor: Palette+ComponentTree | Surface | Attributes */}
                <div className={styles.xmlDesignerBody}>
                  <div className={styles.xmlLeftDock}>
                    <div className={styles.xmlSectionBar}>
                      <span>Palette</span>
                    </div>
                    <div className={styles.xmlPaletteCols}>
                      <div className={styles.xmlCategoryList}>
                        {(["Common", "Text", "Buttons", "Widgets", "Layouts"] as const).map(
                          (cat) => (
                            <button
                              key={cat}
                              type="button"
                              className={`${styles.xmlPaletteItem} ${
                                paletteCategory === cat ? styles.xmlPaletteItemActive : ""
                              }`}
                              onClick={() => setPaletteCategory(cat)}
                            >
                              {cat}
                            </button>
                          )
                        )}
                      </div>
                      <div className={styles.xmlCategoryList}>
                        <button
                          type="button"
                          className={styles.xmlPaletteItem}
                          onClick={() => handleAddXmlWidget("TextView")}
                        >
                          T TextView
                        </button>
                        <button
                          type="button"
                          className={styles.xmlPaletteItem}
                          onClick={() => handleAddXmlWidget("Button")}
                        >
                          ▢ Button
                        </button>
                        <button
                          type="button"
                          className={styles.xmlPaletteItem}
                          onClick={() => handleAddXmlWidget("Switch")}
                        >
                          ⊶ Switch
                        </button>
                      </div>
                    </div>

                    <div className={styles.xmlSectionBar}>
                      <span>Component Tree</span>
                    </div>
                    <div className={styles.treeScroll}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 6px" }}>
                        ▾ ConstraintLayout (main)
                      </div>
                      {(previewTree.children || []).map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          className={`${styles.treeRow} ${
                            selectedXmlWidgetId === child.id ? styles.treeRowSelected : ""
                          }`}
                          style={{ paddingLeft: 18, height: 22 }}
                          onClick={() => setSelectedXmlWidgetId(child.id)}
                        >
                          <span>{child.id}</span>
                          <span className={styles.treeHintSuffix}>({child.type})</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Center Phone Surface(s) */}
                  <div className={styles.xmlCenterStage}>
                    {(designSurfaceMode === "Design" || designSurfaceMode === "Both") && (
                      <div className={styles.xmlSurfacePhone}>
                        <div
                          style={{
                            height: 24,
                            background: "#6650A4",
                            color: "#FFFFFF",
                            fontSize: 10.5,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0 10px",
                          }}
                        >
                          <span>9:41</span>
                          <span>5G · 100%</span>
                        </div>
                        <div
                          style={{
                            flex: 1,
                            padding: 16,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 12,
                          }}
                        >
                          {(previewTree.children || []).map((widget) => (
                            <div
                              key={widget.id}
                              onClick={() => setSelectedXmlWidgetId(widget.id)}
                              style={{
                                padding: widget.type === "Button" ? "8px 16px" : "6px 10px",
                                borderRadius: widget.type === "Button" ? 20 : 6,
                                background:
                                  widget.type === "Button" ? "#6650A4" : "rgba(102,80,164,0.08)",
                                color: widget.type === "Button" ? "#FFFFFF" : "#1C1B1F",
                                fontWeight: widget.type === "Button" ? 600 : 500,
                                fontSize: 12.5,
                                border:
                                  selectedXmlWidgetId === widget.id
                                    ? "2px solid #3574F0"
                                    : "1px dashed rgba(102,80,164,0.35)",
                                cursor: "pointer",
                                textAlign: "center",
                              }}
                            >
                              {widget.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(designSurfaceMode === "Blueprint" || designSurfaceMode === "Both") && (
                      <div className={`${styles.xmlSurfacePhone} ${styles.xmlSurfaceBlueprint}`}>
                        <div
                          style={{
                            height: 24,
                            borderBottom: "1px solid rgba(130,195,255,0.35)",
                            fontSize: 10,
                            display: "flex",
                            alignItems: "center",
                            padding: "0 10px",
                          }}
                        >
                          <span>ConstraintLayout Blueprint</span>
                        </div>
                        <div
                          style={{
                            flex: 1,
                            padding: 16,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 12,
                          }}
                        >
                          {(previewTree.children || []).map((widget) => (
                            <div
                              key={widget.id}
                              onClick={() => setSelectedXmlWidgetId(widget.id)}
                              style={{
                                padding: "7px 14px",
                                border:
                                  selectedXmlWidgetId === widget.id
                                    ? "1.5px solid #59B8FF"
                                    : "1px solid rgba(154,210,255,0.65)",
                                borderRadius: 4,
                                fontSize: 11.5,
                                color: "#D6ECFF",
                                cursor: "pointer",
                              }}
                            >
                              @{widget.id} [{widget.type}]
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Attributes Inspector */}
                  <div className={styles.xmlRightAttrs}>
                    <div className={styles.xmlSectionBar}>
                      <span>Attributes</span>
                      <span style={{ color: "#868A91", fontWeight: 400 }}>@{selectedXmlWidgetId}</span>
                    </div>
                    <div className={styles.attrGroup}>
                      <div className={styles.attrGroupTitle}>Declared Attributes</div>
                      <div className={styles.attrRow}>
                        <span className={styles.attrKey}>id</span>
                        <input
                          className={styles.attrInput}
                          value={selectedXmlWidgetId}
                          readOnly
                        />
                      </div>
                      <div className={styles.attrRow}>
                        <span className={styles.attrKey}>layout_width</span>
                        <input className={styles.attrInput} value="wrap_content" readOnly />
                      </div>
                      <div className={styles.attrRow}>
                        <span className={styles.attrKey}>layout_height</span>
                        <input className={styles.attrInput} value="wrap_content" readOnly />
                      </div>
                    </div>
                    <div className={styles.attrGroup}>
                      <div className={styles.attrGroupTitle}>Constraint Widget</div>
                      <div
                        style={{
                          height: 82,
                          border: "1px dashed #4E5157",
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          color: "#9DA0A8",
                        }}
                      >
                        0dp ↑ · ↔ 50% · ↓ 0dp
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Jetpack Compose @Preview Toolbar */}
                <div className={styles.designToolbar}>
                  <div className={styles.designToolbarGroup}>
                    <span className={styles.previewStatusBadge}>
                      <CheckGreenIcon size={12} />
                      <span>Up-to-date</span>
                    </span>
                    <button
                      type="button"
                      className={styles.previewToolBtn}
                      title="Build & Refresh (Ctrl+Shift+F5)"
                      onClick={onIncrementComposeCounter}
                    >
                      <RestartIcon size={13} />
                      <span>Refresh</span>
                    </button>
                  </div>
                  <div className={styles.designToolbarGroup}>
                    <button
                      type="button"
                      className={`${styles.previewToolBtn} ${
                        interactivePreview ? styles.previewToolBtnActive : ""
                      }`}
                      onClick={() => setInteractivePreview((v) => !v)}
                    >
                      <span>{interactivePreview ? "Interactive Mode: ON" : "Interactive Mode"}</span>
                    </button>
                    <button
                      type="button"
                      className={styles.previewToolBtn}
                      title="Deploy Preview to Device"
                      onClick={onDeployPreviewToDevice}
                    >
                      <RunPreviewOnDeviceIcon size={14} />
                      <span>Deploy Preview</span>
                    </button>
                  </div>
                </div>

                {/* Jetpack Compose @Preview Canvas */}
                <div className={styles.composeCanvasArea}>
                  <div className={styles.previewCardFrame} style={{ width: 292 }}>
                    <div className={styles.previewCardTitle}>
                      <span>GreetingPreview (@Preview)</span>
                      <span style={{ color: "#3DDC84" }}>API 35 · Material3</span>
                    </div>

                    <div
                      style={{
                        borderRadius: 12,
                        background: "#FEF7FF",
                        color: "#1D1B20",
                        padding: 18,
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        border: "1px solid #D0BCFF",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: 11,
                          color: "#6650A4",
                          fontWeight: 600,
                        }}
                      >
                        <span>Scaffold · Surface</span>
                        <span>Compose 1.7.5</span>
                      </div>

                      {(previewTree.children || []).map((node) =>
                        node.type === "Button" ? (
                          <button
                            key={node.id}
                            type="button"
                            onClick={onIncrementComposeCounter}
                            style={{
                              padding: "9px 16px",
                              borderRadius: 999,
                              border: "none",
                              background: "#6650A4",
                              color: "#FFFFFF",
                              fontWeight: 600,
                              fontSize: 12.5,
                              cursor: "pointer",
                              alignSelf: "flex-start",
                              boxShadow: "0 2px 6px rgba(102,80,164,0.35)",
                            }}
                          >
                            {node.text}
                          </button>
                        ) : (
                          <div
                            key={node.id}
                            style={{
                              fontSize: 15,
                              fontWeight: 600,
                              color: "#1D1B20",
                            }}
                          >
                            {node.text}
                          </div>
                        )
                      )}

                      <div style={{ fontSize: 11, color: "#625B71" }}>
                        Recomposition count: {composeClickCount + 1} · Click button to test state
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
