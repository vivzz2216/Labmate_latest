"use client";

import React, { useState } from "react";
import styles from "./androidStudio.module.css";
import {
  AndroidTreeNode,
  AndroidViewMode,
  StudioFile,
} from "@/lib/ide/androidStudioEngine";
import {
  AndroidModuleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FolderDarkIcon,
  GradleFileIcon,
  KotlinClassIcon,
  KotlinFileIcon,
  KotlinGradleScriptIcon,
  ManifestFileIcon,
  MoreVerticalIcon,
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
  onCreateNewFile: (kind: "kotlin" | "xml") => void;
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
      if (node.fileKind === "kotlin") {
        return node.label.endsWith(".kt") ? (
          <KotlinFileIcon size={16} />
        ) : (
          <KotlinClassIcon size={16} />
        );
      }
      if (node.fileKind === "xml" || node.fileKind === "svg") return <XmlFileIcon size={16} />;
      if (node.fileKind === "gradle-kts") return <KotlinGradleScriptIcon size={16} />;
      if (node.fileKind === "toml") return <TomlFileIcon size={16} />;
      if (node.fileKind === "properties" || node.fileKind === "proguard") {
        return <PropertiesFileIcon size={16} />;
      }
      return <KotlinFileIcon size={16} />;
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
  onCreateNewFile,
  onCommitChanges,
  onHidePanel,
}: AndroidProjectTreeProps) {
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState(
    "feat(ui): update Greeting composable & Material3 counter"
  );
  const [resourceTab, setResourceTab] = useState<"Drawable" | "Color" | "Layout" | "String">(
    "Color"
  );

  const modifiedFiles = files.filter((f) => dirtyFileIds.has(f.id));

  const renderTreeRow = (node: AndroidTreeNode, depth: number): React.ReactNode => {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isExpanded = expandedIds.has(node.id);
    const isSelected =
      selectedNodeId === node.id || (node.fileId !== undefined && node.fileId === activeFileId);

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
        >
          <span className={styles.treeChevron}>
            {hasChildren ? (
              isExpanded ? (
                <ChevronDownIcon size={12} color={isSelected ? "#FFFFFF" : "#9DA0A8"} />
              ) : (
                <ChevronRightIcon size={12} color={isSelected ? "#FFFFFF" : "#9DA0A8"} />
              )
            ) : null}
          </span>
          <span className={styles.treeIconWrap}>{renderNodeIcon(node)}</span>
          <span
            className={`${styles.treeLabelText} ${
              depth === 0 ? styles.treeLabelBold : ""
            }`}
          >
            {node.label}
          </span>
          {node.hint && (
            <span
              className={styles.treeHintSuffix}
              style={isSelected ? { color: "#CFD8EC" } : undefined}
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
          <div style={{ fontSize: 11.5, color: "#9DA0A8", fontWeight: 600 }}>
            Changes ({modifiedFiles.length > 0 ? modifiedFiles.length : 1} files)
          </div>
          {(modifiedFiles.length > 0 ? modifiedFiles : files.slice(0, 1)).map((f) => (
            <button
              key={f.id}
              type="button"
              className={styles.treeRow}
              style={{ paddingLeft: 8 }}
              onClick={() => onOpenFileById(f.id)}
            >
              <span className={styles.treeIconWrap}>
                {f.kind === "kotlin" ? <KotlinFileIcon size={15} /> : <XmlFileIcon size={15} />}
              </span>
              <span className={styles.treeLabelText} style={{ color: "#6B9BFA" }}>
                {f.tabTitle}
              </span>
              <span className={styles.treeHintSuffix}>{f.path}</span>
            </button>
          ))}
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Commit Message"
            style={{
              width: "100%",
              minHeight: 82,
              background: "#1E1F22",
              color: "#DFE1E5",
              border: "1px solid #4E5157",
              borderRadius: 6,
              padding: 8,
              fontSize: 12,
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => onCommitChanges(commitMessage)}
            >
              Commit
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => onCommitChanges(`${commitMessage} (pushed)`)}
            >
              Commit and Push...
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (activeLeftTool === "resources") {
    return (
      <section className={styles.sideToolPanel} style={{ width }}>
        <div className={styles.sidePanelHeader}>
          <span style={{ fontWeight: 600 }}>Resource Manager</span>
          <div className={styles.sideHeaderActions}>
            <button
              type="button"
              className={styles.panelActionIcon}
              title="Add Resource (+)"
              onClick={() => onCreateNewFile("xml")}
            >
              +
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
        <div style={{ display: "flex", gap: 4, padding: "6px 8px", borderBottom: "1px solid #35373B" }}>
          {(["Drawable", "Color", "Layout", "String"] as const).map((tab) => (
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
        <div className={styles.treeScroll} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {resourceTab === "Color" && (
            <>
              {[
                { name: "purple_80", hex: "#D0BCFF", fileId: "theme-color-kt" },
                { name: "purple_40", hex: "#6650A4", fileId: "theme-color-kt" },
                { name: "teal_200", hex: "#03DAC5", fileId: "colors-xml" },
                { name: "android_green", hex: "#3DDC84", fileId: "colors-xml" },
              ].map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={styles.treeRow}
                  style={{ height: 32, paddingLeft: 8, justifyContent: "space-between" }}
                  onClick={() => onOpenFileById(c.fileId)}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        background: c.hex,
                        border: "1px solid rgba(255,255,255,0.25)",
                      }}
                    />
                    <span>{c.name}</span>
                  </span>
                  <span className={styles.treeHintSuffix}>{c.hex}</span>
                </button>
              ))}
            </>
          )}
          {resourceTab === "Drawable" && (
            <>
              <button
                type="button"
                className={styles.treeRow}
                style={{ height: 34, paddingLeft: 8 }}
                onClick={() => onOpenFileById("manifest-xml")}
              >
                <AndroidModuleIcon size={16} />
                <span>ic_launcher_foreground.xml</span>
                <span className={styles.treeHintSuffix}>vector (108×108dp)</span>
              </button>
              <button
                type="button"
                className={styles.treeRow}
                style={{ height: 34, paddingLeft: 8 }}
                onClick={() => onOpenFileById("manifest-xml")}
              >
                <AndroidModuleIcon size={16} />
                <span>ic_launcher_background.xml</span>
                <span className={styles.treeHintSuffix}>#3DDC84</span>
              </button>
            </>
          )}
          {resourceTab === "Layout" && (
            <button
              type="button"
              className={styles.treeRow}
              style={{ height: 34, paddingLeft: 8 }}
              onClick={() => onOpenFileById("activity-main-xml")}
            >
              <XmlFileIcon size={16} />
              <span>activity_main.xml</span>
              <span className={styles.treeHintSuffix}>res/layout</span>
            </button>
          )}
          {resourceTab === "String" && (
            <button
              type="button"
              className={styles.treeRow}
              style={{ height: 34, paddingLeft: 8 }}
              onClick={() => onOpenFileById("strings-xml")}
            >
              <XmlFileIcon size={16} />
              <span>strings.xml (4 keys)</span>
              <span className={styles.treeHintSuffix}>res/values</span>
            </button>
          )}
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
            title="New Kotlin Class/File"
            onClick={() => onCreateNewFile("kotlin")}
          >
            +
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
            title="More Options"
            onClick={() => onCreateNewFile("xml")}
          >
            <MoreVerticalIcon size={14} />
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
    </section>
  );
}
