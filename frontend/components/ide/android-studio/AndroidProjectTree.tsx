"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./androidStudio.module.css";
import {
  AndroidTreeNode,
  AndroidViewMode,
  StudioFile,
} from "@/lib/ide/androidStudioEngine";
import { parseAndroidResources } from "@/lib/ide/androidXmlLayout";
import {
  AndroidModuleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FilePlusIcon,
  FolderDarkIcon,
  FolderPlusIcon,
  GradleFileIcon,
  JavaFileIcon,
  KotlinClassIcon,
  KotlinFileIcon,
  KotlinGradleScriptIcon,
  ManifestFileIcon,
  PackageFolderIcon,
  PropertiesFileIcon,
  ResourcesRootFolderIcon,
  SourceRootFolderIcon,
  TomlFileIcon,
  XmlFileIcon,
} from "./StudioIcons";
import { LeftToolId } from "./StudioStripes";

interface AndroidProjectTreeProps {
  width: number;
  activeLeftTool: LeftToolId;
  viewMode: AndroidViewMode;
  onChangeViewMode: (mode: AndroidViewMode) => void;
  treeNodes: AndroidTreeNode[];
  expandedIds: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  selectedNodeId: string;
  activeFileId: string;
  files: StudioFile[];
  dirtyFileIds: Set<string>;
  onSelectTreeNode: (node: AndroidTreeNode) => void;
  onOpenFileById: (fileId: string) => void;
  onRequestNewFile: (targetDir?: string) => void;
  onRequestNewFolder: (targetDir?: string) => void;
  onRequestRenameFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onCommitChanges: (message: string) => void;
  onHidePanel: () => void;
}

export function renderNodeIcon(node: AndroidTreeNode) {
  switch (node.kind) {
    case "module":
      return <AndroidModuleIcon size={16} />;
    case "source-root":
      return <SourceRootFolderIcon size={16} />;
    case "resources-root":
      return <ResourcesRootFolderIcon size={16} />;
    case "package":
      return <PackageFolderIcon size={16} />;
    case "gradle-root":
      return <GradleFileIcon size={16} />;
    case "file": {
      if (node.fileKind === "manifest") return <ManifestFileIcon size={16} />;
      if (node.fileKind === "java") return <JavaFileIcon size={16} />;
      if (node.fileKind === "kotlin") {
        return node.label.endsWith(".kt") ? (
          <KotlinFileIcon size={16} />
        ) : (
          <KotlinClassIcon size={16} />
        );
      }
      if (node.fileKind === "xml" || node.fileKind === "svg") return <XmlFileIcon size={16} />;
      if (node.fileKind === "gradle-kts") return <KotlinGradleScriptIcon size={16} />;
      if (node.fileKind === "gradle") return <GradleFileIcon size={16} />;
      if (node.fileKind === "toml") return <TomlFileIcon size={16} />;
      if (node.fileKind === "properties" || node.fileKind === "proguard") {
        return <PropertiesFileIcon size={16} />;
      }
      return <JavaFileIcon size={16} />;
    }
    case "folder":
    default:
      return <FolderDarkIcon size={16} />;
  }
}

export function AndroidProjectTree({
  width,
  activeLeftTool,
  viewMode,
  onChangeViewMode,
  treeNodes,
  expandedIds,
  onToggleExpand,
  onExpandAll,
  onCollapseAll,
  selectedNodeId,
  activeFileId,
  files,
  dirtyFileIds,
  onSelectTreeNode,
  onOpenFileById,
  onRequestNewFile,
  onRequestNewFolder,
  onRequestRenameFile,
  onDeleteFile,
  onCommitChanges,
  onHidePanel,
}: AndroidProjectTreeProps) {
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState("Update Android practical sources");
  const [resourceTab, setResourceTab] = useState<"Drawable" | "Color" | "Layout" | "String">("Layout");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: AndroidTreeNode;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const closeMenu = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  const modifiedFiles = files.filter((f) => dirtyFileIds.has(f.id));
  const resources = parseAndroidResources(files);

  const renderTreeRow = (node: AndroidTreeNode, depth: number): React.ReactNode => {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isExpanded = expandedIds.has(node.id);
    const isSelected =
      selectedNodeId === node.id || (node.fileId !== undefined && node.fileId === activeFileId);
    const isDirty = node.fileId !== undefined && dirtyFileIds.has(node.fileId);

    return (
      <React.Fragment key={node.id}>
        <button
          type="button"
          className={`${styles.treeRow} ${node.isTest ? styles.treeRowTestTint : ""} ${
            isSelected ? styles.treeRowSelected : ""
          }`}
          style={{ paddingLeft: `${8 + depth * 15}px` }}
          onClick={() => {
            if (hasChildren) {
              onToggleExpand(node.id);
            }
            onSelectTreeNode(node);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            onSelectTreeNode(node);
            setContextMenu({ x: e.clientX, y: e.clientY, node });
          }}
        >
          <span className={styles.treeChevron}>
            {hasChildren ? (
              isExpanded ? (
                <ChevronDownIcon size={12} color={isSelected ? "var(--as-bg-selected-text)" : "var(--as-text-secondary)"} />
              ) : (
                <ChevronRightIcon size={12} color={isSelected ? "var(--as-bg-selected-text)" : "var(--as-text-secondary)"} />
              )
            ) : null}
          </span>
          <span className={styles.treeIconWrap}>{renderNodeIcon(node)}</span>
          <span
            className={`${styles.treeLabelText} ${depth === 0 ? styles.treeLabelBold : ""}`}
            style={isDirty && !isSelected ? { color: "var(--as-accent)" } : undefined}
          >
            {node.label}
          </span>
          {node.hint && (
            <span
              className={styles.treeHintSuffix}
              style={isSelected ? { opacity: 0.8 } : undefined}
            >
              {node.hint}
            </span>
          )}
        </button>
        {hasChildren &&
          isExpanded &&
          node.children!.map((child) => renderTreeRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  if (activeLeftTool === "commit") {
    return (
      <section className={styles.sideToolPanel} style={{ width }}>
        <div className={styles.sidePanelHeader}>
          <span style={{ fontWeight: 600 }}>Commit</span>
          <div className={styles.sideHeaderActions}>
            <button
              type="button"
              className={styles.panelActionIcon}
              title="Hide (Shift+Esc)"
              onClick={onHidePanel}
            >
              —
            </button>
          </div>
        </div>
        <div className={styles.treeScroll} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11.5, color: "var(--as-text-secondary)", fontWeight: 600 }}>
            Unsaved / Modified ({modifiedFiles.length})
          </div>
          {modifiedFiles.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--as-text-muted)", padding: "4px 6px" }}>
              No uncommitted changes. Edit a file to stage changes.
            </div>
          ) : (
            modifiedFiles.map((f) => (
              <button
                key={f.id}
                type="button"
                className={styles.treeRow}
                style={{ paddingLeft: 8 }}
                onClick={() => onOpenFileById(f.id)}
              >
                <span className={styles.treeIconWrap}>
                  {f.kind === "java" ? (
                    <JavaFileIcon size={15} />
                  ) : f.kind === "kotlin" ? (
                    <KotlinFileIcon size={15} />
                  ) : (
                    <XmlFileIcon size={15} />
                  )}
                </span>
                <span className={styles.treeLabelText} style={{ color: "var(--as-accent)" }}>
                  {f.tabTitle}
                </span>
                <span className={styles.treeHintSuffix}>{f.path}</span>
              </button>
            ))
          )}
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Checkpoint message"
            style={{
              width: "100%",
              minHeight: 76,
              background: "var(--as-bg-input)",
              color: "var(--as-text-primary)",
              border: "1px solid var(--as-border-comp)",
              borderRadius: 6,
              padding: 8,
              fontSize: 12,
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => onCommitChanges(commitMessage)}
          >
            Save Snapshot
          </button>
        </div>
      </section>
    );
  }

  if (activeLeftTool === "resources") {
    const colorKeys = Object.keys(resources.colors);
    const stringKeys = Object.keys(resources.strings);
    const layoutFiles = files.filter((f) => f.isLayoutXml || f.path.indexOf("res/layout/") >= 0);
    const drawableFiles = files.filter((f) => f.path.indexOf("res/drawable/") >= 0);
    const colorsFile = files.find((f) => f.name === "colors.xml");
    const stringsFile = files.find((f) => f.name === "strings.xml");

    return (
      <section className={styles.sideToolPanel} style={{ width }}>
        <div className={styles.sidePanelHeader}>
          <span style={{ fontWeight: 600 }}>Resource Manager</span>
          <div className={styles.sideHeaderActions}>
            <button
              type="button"
              className={styles.panelActionIcon}
              title="Add Layout Resource (+)"
              onClick={() => onRequestNewFile("app/src/main/res/layout")}
            >
              <FilePlusIcon size={14} />
            </button>
            <button
              type="button"
              className={styles.panelActionIcon}
              title="Hide"
              onClick={onHidePanel}
            >
              —
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, padding: "6px 8px", borderBottom: "1px solid var(--as-border-panel)" }}>
          {(["Layout", "Color", "String", "Drawable"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`${styles.segmentedBtn} ${resourceTab === tab ? styles.segmentedBtnActive : ""}`}
              onClick={() => setResourceTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className={styles.treeScroll} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {resourceTab === "Layout" &&
            layoutFiles.map((lf) => (
              <button
                key={lf.id}
                type="button"
                className={styles.treeRow}
                style={{ height: 30, paddingLeft: 8 }}
                onClick={() => onOpenFileById(lf.id)}
              >
                <XmlFileIcon size={15} />
                <span>{lf.name}</span>
                <span className={styles.treeHintSuffix}>res/layout</span>
              </button>
            ))}

          {resourceTab === "Color" &&
            (colorKeys.length > 0 ? (
              colorKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={styles.treeRow}
                  style={{ height: 30, paddingLeft: 8, justifyContent: "space-between" }}
                  onClick={() => colorsFile && onOpenFileById(colorsFile.id)}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        background: resources.colors[key],
                        border: "1px solid var(--as-border-comp)",
                      }}
                    />
                    <span>{key}</span>
                  </span>
                  <span className={styles.treeHintSuffix}>{resources.colors[key]}</span>
                </button>
              ))
            ) : (
              <div style={{ fontSize: 12, color: "var(--as-text-muted)", padding: 8 }}>
                No colors defined in res/values/colors.xml.
              </div>
            ))}

          {resourceTab === "String" &&
            (stringKeys.length > 0 ? (
              stringKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={styles.treeRow}
                  style={{ height: 30, paddingLeft: 8, justifyContent: "space-between" }}
                  onClick={() => stringsFile && onOpenFileById(stringsFile.id)}
                >
                  <span>@string/{key}</span>
                  <span className={styles.treeHintSuffix}>{resources.strings[key]}</span>
                </button>
              ))
            ) : (
              <div style={{ fontSize: 12, color: "var(--as-text-muted)", padding: 8 }}>
                No strings defined in strings.xml.
              </div>
            ))}

          {resourceTab === "Drawable" &&
            (drawableFiles.length > 0 ? (
              drawableFiles.map((df) => (
                <button
                  key={df.id}
                  type="button"
                  className={styles.treeRow}
                  style={{ height: 30, paddingLeft: 8 }}
                  onClick={() => onOpenFileById(df.id)}
                >
                  <XmlFileIcon size={15} />
                  <span>{df.name}</span>
                  <span className={styles.treeHintSuffix}>res/drawable</span>
                </button>
              ))
            ) : (
              <div style={{ fontSize: 12, color: "var(--as-text-muted)", padding: 8 }}>
                No drawable XML files found.
              </div>
            ))}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.sideToolPanel} style={{ width }} aria-label="Project Tool Window">
      <div className={styles.sidePanelHeader}>
        <div className={styles.headerDropdownWrap}>
          <button
            type="button"
            className={styles.sideViewDropdownBtn}
            onClick={() => setViewDropdownOpen((v) => !v)}
            title="Project View Mode"
          >
            <AndroidModuleIcon size={15} />
            <span>{viewMode}</span>
            <ChevronDownIcon size={12} />
          </button>
          {viewDropdownOpen && (
            <div className={styles.dropdownMenu} style={{ minWidth: 190 }}>
              {(["Android", "Project", "Packages"] as AndroidViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => {
                    onChangeViewMode(mode);
                    setViewDropdownOpen(false);
                  }}
                >
                  <span className={styles.dropdownItemLeft}>
                    {mode === "Android" ? (
                      <AndroidModuleIcon size={15} />
                    ) : mode === "Project" ? (
                      <FolderDarkIcon size={15} />
                    ) : (
                      <PackageFolderIcon size={15} />
                    )}
                    <span>{mode}</span>
                  </span>
                  {mode === viewMode && <span className={styles.dropdownMeta}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.sideHeaderActions}>
          <button
            type="button"
            className={styles.panelActionIcon}
            title="New File / Activity..."
            aria-label="New File"
            onClick={() => onRequestNewFile()}
          >
            <FilePlusIcon size={14} />
          </button>
          <button
            type="button"
            className={styles.panelActionIcon}
            title="New Folder..."
            aria-label="New Folder"
            onClick={() => onRequestNewFolder()}
          >
            <FolderPlusIcon size={14} />
          </button>
          <button
            type="button"
            className={styles.panelActionIcon}
            title="Expand All"
            onClick={onExpandAll}
          >
            ⇕
          </button>
          <button
            type="button"
            className={styles.panelActionIcon}
            title="Collapse All"
            onClick={onCollapseAll}
          >
            ⇈
          </button>
          <button
            type="button"
            className={styles.panelActionIcon}
            title="Hide (Shift+Esc)"
            onClick={onHidePanel}
          >
            —
          </button>
        </div>
      </div>

      <div className={styles.treeScroll} role="tree" aria-label="Android Project Hierarchy">
        {treeNodes.map((node) => renderTreeRow(node, 0))}
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          className={styles.contextMenu}
          style={{ left: Math.min(contextMenu.x, 260), top: Math.min(contextMenu.y, 520) }}
          role="menu"
        >
          {contextMenu.node.fileId ? (
            <>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  const fid = contextMenu.node.fileId!;
                  setContextMenu(null);
                  onOpenFileById(fid);
                }}
              >
                <span>Open in Editor</span>
              </button>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  const fid = contextMenu.node.fileId!;
                  setContextMenu(null);
                  onRequestRenameFile(fid);
                }}
              >
                <span>Rename...</span>
              </button>
              <div className={styles.dropdownDivider} />
              <button
                type="button"
                className={styles.menuDropdownItem}
                style={{ color: "var(--as-red)" }}
                onClick={() => {
                  const fid = contextMenu.node.fileId!;
                  setContextMenu(null);
                  onDeleteFile(fid);
                }}
              >
                <span>Delete File</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  const dir = contextMenu.node.folderPath;
                  setContextMenu(null);
                  onRequestNewFile(dir);
                }}
              >
                <span>New File / Activity...</span>
              </button>
              <button
                type="button"
                className={styles.menuDropdownItem}
                onClick={() => {
                  const dir = contextMenu.node.folderPath;
                  setContextMenu(null);
                  onRequestNewFolder(dir);
                }}
              >
                <span>New Folder...</span>
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
