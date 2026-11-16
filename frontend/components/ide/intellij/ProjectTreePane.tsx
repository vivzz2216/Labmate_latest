"use client";

import React, { useState } from "react";
import type { IntellijProjectPreset, JavaSymbol, VirtualFileNode } from "@/lib/ide/intellijRunner";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CollapseAllIcon,
  ExpandAllIcon,
  ExternalLibrariesIcon,
  GitIgnoreIcon,
  HideMinimizeIcon,
  JavaClassIcon,
  MethodBreadcrumbIcon,
  ModuleIcon,
  MoreVerticalIcon,
  ProjectLocateIcon,
  ScratchesIcon,
  TreeFolderIcon,
} from "./ExpUiIcons";
import styles from "./intellij.module.css";
import type { LeftToolId } from "./types";

interface ProjectTreePaneProps {
  activeTool: LeftToolId;
  preset: IntellijProjectPreset;
  tree: VirtualFileNode[];
  expandedIds: Record<string, boolean>;
  selectedFileId: string;
  width: number;
  symbols: JavaSymbol[];
  dirtyFiles: Record<string, boolean>;
  modifiedFileList: Array<{ id: string; name: string; path: string }>;
  onToggleExpand: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onLocateActiveFile: () => void;
  onSelectFile: (node: VirtualFileNode) => void;
  onSelectFileById: (id: string) => void;
  onJumpToLine: (line: number) => void;
  onCommitChanges: (message: string) => void;
  onOpenNewClassModal: () => void;
  onHidePane: () => void;
}

export function ProjectTreePane({
  activeTool,
  preset,
  tree,
  expandedIds,
  selectedFileId,
  width,
  symbols,
  modifiedFileList,
  onToggleExpand,
  onExpandAll,
  onCollapseAll,
  onLocateActiveFile,
  onSelectFile,
  onSelectFileById,
  onJumpToLine,
  onCommitChanges,
  onOpenNewClassModal,
  onHidePane,
}: ProjectTreePaneProps) {
  const [viewMode, setViewMode] = useState<"Project" | "Packages" | "Project Files">("Project");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [showExcluded, setShowExcluded] = useState(true);
  const [commitMsg, setCommitMsg] = useState("Update Java source");

  const renderNodeIcon = (node: VirtualFileNode) => {
    switch (node.kind) {
      case "project":
      case "folder":
        return <TreeFolderIcon variant="default" size={16} />;
      case "sourceRoot":
        return <TreeFolderIcon variant="sourceRoot" size={16} />;
      case "excludedFolder":
        return <TreeFolderIcon variant="excluded" size={16} />;
      case "package":
        return <TreeFolderIcon variant="package" size={16} />;
      case "java":
        return <JavaClassIcon size={16} showRunBadge={Boolean(node.isMainClass && preset.id === "HelloWorld")} />;
      case "gitignore":
        return <GitIgnoreIcon size={16} />;
      case "iml":
        return <ModuleIcon size={16} />;
      case "libraries":
        return <ExternalLibrariesIcon size={16} />;
      case "scratches":
        return <ScratchesIcon size={16} />;
      default:
        return <ModuleIcon size={15} />;
    }
  };

  const renderTreeNodes = (nodes: VirtualFileNode[], depth: number): React.ReactNode => {
    return nodes.map((node) => {
      if (!showExcluded && node.kind === "excludedFolder") {
        return null;
      }
      const isDir = Array.isArray(node.children);
      const isExpanded = Boolean(expandedIds[node.id]);
      const isSelected = node.id === selectedFileId;
      const isExcluded = node.kind === "excludedFolder";
      const label = node.displayName || node.name;

      return (
        <React.Fragment key={node.id}>
          <div className={`${styles.treeRowWrap} ${isExcluded ? styles.treeRowExcluded : ""}`}>
            <button
              type="button"
              className={`${styles.treeRowBtn} ${isSelected ? styles.treeRowSelected : ""}`}
              style={{ paddingLeft: 6 + depth * 14 }}
              onClick={() => {
                if (isDir) {
                  onToggleExpand(node.id);
                } else {
                  onSelectFile(node);
                }
              }}
              onDoubleClick={() => {
                if (!isDir) onSelectFile(node);
              }}
              title={node.path || node.name}
            >
              <span className={styles.treeChevron}>
                {isDir ? (
                  isExpanded ? (
                    <ChevronDownIcon size={11} color="#9DA0A8" />
                  ) : (
                    <ChevronRightIcon size={11} color="#9DA0A8" />
                  )
                ) : null}
              </span>
              <span className={styles.treeIconWrap}>{renderNodeIcon(node)}</span>
              <span className={`${styles.treeLabel} ${node.kind === "project" ? styles.treeRootBold : ""}`}>{label}</span>
              {node.kind === "project" && <span className={styles.treePathMuted}>{preset.rootPath}</span>}
            </button>
          </div>
          {isDir && isExpanded && node.children && node.children.length > 0 && renderTreeNodes(node.children, depth + 1)}
        </React.Fragment>
      );
    });
  };

  if (activeTool === "structure") {
    return (
      <aside className={styles.leftPane} style={{ width }} aria-label="Structure tool window">
        <div className={styles.paneHeader}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Structure</span>
          <div className={styles.paneActionRow}>
            <button type="button" className={styles.smallActionBtn} title="Hide" aria-label="Hide Structure" onClick={onHidePane}>
              <HideMinimizeIcon size={15} color="#9DA0A8" />
            </button>
          </div>
        </div>
        <div className={styles.treeScroll}>
          {symbols.length === 0 ? (
            <div style={{ padding: "14px 12px", color: "#7A7E85", fontSize: 12 }}>No structure symbols in current file.</div>
          ) : (
            symbols.map((sym, idx) => (
              <div key={`${sym.name}-${sym.line}-${idx}`} className={styles.treeRowWrap}>
                <button
                  type="button"
                  className={styles.treeRowBtn}
                  style={{ paddingLeft: sym.kind === "class" ? 10 : 24 }}
                  onClick={() => onJumpToLine(sym.line)}
                >
                  <span className={styles.treeIconWrap}>
                    {sym.kind === "class" ? <JavaClassIcon size={15} /> : <MethodBreadcrumbIcon size={14} />}
                  </span>
                  <span className={styles.treeLabel}>{sym.signature}</span>
                  <span className={styles.treePathMuted}>:{sym.line}</span>
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    );
  }

  if (activeTool === "commit") {
    return (
      <aside className={styles.leftPane} style={{ width }} aria-label="Commit tool window">
        <div className={styles.paneHeader}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Commit</span>
          <div className={styles.paneActionRow}>
            <button type="button" className={styles.smallActionBtn} title="Hide" aria-label="Hide Commit" onClick={onHidePane}>
              <HideMinimizeIcon size={15} color="#9DA0A8" />
            </button>
          </div>
        </div>
        <div style={{ padding: "8px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: "#9DA0A8" }}>
            Changes ({modifiedFileList.length})
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {modifiedFileList.length === 0 ? (
              <div style={{ color: "#7A7E85", fontSize: 12 }}>Working tree clean — edit a Java file to stage changes.</div>
            ) : (
              modifiedFileList.map((f) => (
                <div key={f.id} className={styles.treeRowWrap}>
                  <button
                    type="button"
                    className={styles.treeRowBtn}
                    style={{ paddingLeft: 8 }}
                    onClick={() => onSelectFileById(f.id)}
                    title={`Open ${f.path}`}
                  >
                    <JavaClassIcon size={14} />
                    <span className={styles.treeLabel} style={{ color: "#548AF7" }}>
                      {f.name}
                    </span>
                  </button>
                </div>
              ))
            )}
          </div>
          <textarea
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            rows={3}
            placeholder="Commit message"
            style={{
              width: "100%",
              background: "#1E1F22",
              border: "1px solid #393B40",
              borderRadius: 6,
              color: "#DFE1E5",
              padding: "7px 9px",
              fontSize: 12,
              resize: "none",
              outline: "none",
            }}
          />
          <button
            type="button"
            className={styles.dialogBtnPrimary}
            onClick={() => {
              onCommitChanges(commitMsg.trim() || "Update Java source");
            }}
          >
            Commit
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.leftPane} style={{ width }} aria-label="Project tool window">
      <div className={styles.paneHeader}>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className={styles.paneTitleBtn}
            onClick={() => {
              setViewMenuOpen((v) => !v);
              setOptionsMenuOpen(false);
            }}
          >
            <span>{viewMode}</span>
            <ChevronDownIcon size={12} color="#9DA0A8" />
          </button>
          {viewMenuOpen && (
            <div className={styles.popoverMenu} role="menu">
              {(["Project", "Packages", "Project Files"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="menuitem"
                  className={`${styles.popoverItem} ${viewMode === mode ? styles.popoverItemActive : ""}`}
                  onClick={() => {
                    setViewMode(mode);
                    setViewMenuOpen(false);
                  }}
                >
                  <span>{mode}</span>
                  <span className={styles.popoverShortcut}>{viewMode === mode ? "✓" : ""}</span>
                </button>
              ))}
              <div className={styles.popoverDivider} />
              <button
                type="button"
                role="menuitem"
                className={styles.popoverItem}
                onClick={() => {
                  onOpenNewClassModal();
                  setViewMenuOpen(false);
                }}
              >
                <span>New Java Class...</span>
              </button>
            </div>
          )}
        </div>

        <div className={styles.paneActionRow}>
          <button
            type="button"
            className={styles.smallActionBtn}
            title="Select Opened File"
            aria-label="Select Opened File"
            onClick={onLocateActiveFile}
          >
            <ProjectLocateIcon size={15} color="#9DA0A8" />
          </button>
          <button
            type="button"
            className={styles.smallActionBtn}
            title="Expand All"
            aria-label="Expand All"
            onClick={onExpandAll}
          >
            <ExpandAllIcon size={15} color="#9DA0A8" />
          </button>
          <button
            type="button"
            className={styles.smallActionBtn}
            title="Collapse All"
            aria-label="Collapse All"
            onClick={onCollapseAll}
          >
            <CollapseAllIcon size={15} color="#9DA0A8" />
          </button>

          <div style={{ position: "relative" }}>
            <button
              type="button"
              className={styles.smallActionBtn}
              title="Options"
              aria-label="Project options"
              onClick={() => {
                setOptionsMenuOpen((v) => !v);
                setViewMenuOpen(false);
              }}
            >
              <MoreVerticalIcon size={15} color="#9DA0A8" />
            </button>
            {optionsMenuOpen && (
              <div className={`${styles.popoverMenu} ${styles.popoverMenuRight}`} role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className={styles.popoverItem}
                  onClick={() => {
                    setShowExcluded((s) => !s);
                    setOptionsMenuOpen(false);
                  }}
                >
                  <span>Show Excluded Files (out)</span>
                  <span className={styles.popoverShortcut}>{showExcluded ? "✓" : ""}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.popoverItem}
                  onClick={() => {
                    onOpenNewClassModal();
                    setOptionsMenuOpen(false);
                  }}
                >
                  <span>New Java Class...</span>
                </button>
              </div>
            )}
          </div>

          <button type="button" className={styles.smallActionBtn} title="Hide" aria-label="Hide Project" onClick={onHidePane}>
            <HideMinimizeIcon size={15} color="#9DA0A8" />
          </button>
        </div>
      </div>

      <div className={styles.treeScroll} role="tree" aria-label="Project files">
        {renderTreeNodes(tree, 0)}
      </div>
    </aside>
  );
}
