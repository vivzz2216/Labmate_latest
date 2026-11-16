"use client";

import React, { useState } from "react";
import styles from "./androidStudio.module.css";
import { SdkPackageItem, StudioFile } from "@/lib/ide/androidStudioEngine";
import {
  AndroidHeadIcon,
  SdkManagerIcon,
  SearchEverywhereIcon,
  KotlinFileIcon,
  XmlFileIcon,
  GradleFileIcon,
} from "./StudioIcons";

interface SdkManagerModalProps {
  open: boolean;
  packages: SdkPackageItem[];
  onTogglePackage: (id: string) => void;
  onApplySdkChanges: () => void;
  onClose: () => void;
}

export const SdkManagerModal: React.FC<SdkManagerModalProps> = ({
  open,
  packages,
  onTogglePackage,
  onApplySdkChanges,
  onClose,
}) => {
  const [sdkTab, setSdkTab] = useState<"platforms" | "tools">("platforms");

  if (!open) return null;

  const filtered = packages.filter((p) =>
    sdkTab === "platforms" ? p.category === "platform" : p.category === "tool"
  );

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={styles.modalDialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="SDK Manager"
      >
        <div className={styles.modalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SdkManagerIcon size={16} />
            <span>Settings for New Projects — Android SDK</span>
          </div>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            aria-label="Close SDK Manager"
          >
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <div style={{ fontSize: 12, color: "#DFE1E5", marginBottom: 8 }}>
            Android SDK Location:{" "}
            <code
              style={{
                background: "#1E1F22",
                padding: "2px 6px",
                borderRadius: 4,
                border: "1px solid #393B40",
              }}
            >
              /Users/developer/Library/Android/sdk
            </code>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              borderBottom: "1px solid #393B40",
              marginBottom: 8,
            }}
          >
            <button
              type="button"
              onClick={() => setSdkTab("platforms")}
              style={{
                background: "transparent",
                border: "none",
                borderBottom:
                  sdkTab === "platforms"
                    ? "2px solid #3574F0"
                    : "2px solid transparent",
                color: sdkTab === "platforms" ? "#DFE1E5" : "#6F737A",
                padding: "6px 4px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              SDK Platforms
            </button>
            <button
              type="button"
              onClick={() => setSdkTab("tools")}
              style={{
                background: "transparent",
                border: "none",
                borderBottom:
                  sdkTab === "tools"
                    ? "2px solid #3574F0"
                    : "2px solid transparent",
                color: sdkTab === "tools" ? "#DFE1E5" : "#6F737A",
                padding: "6px 4px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              SDK Tools
            </button>
          </div>

          <table className={styles.sdkTable}>
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Name</th>
                <th>API Level</th>
                <th>Revision</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pkg) => (
                <tr key={pkg.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={pkg.installed}
                      onChange={() => onTogglePackage(pkg.id)}
                    />
                  </td>
                  <td style={{ color: "#DFE1E5", fontWeight: 500 }}>{pkg.name}</td>
                  <td>{pkg.apiLevel}</td>
                  <td>{pkg.revision}</td>
                  <td>
                    <span
                      style={{
                        color: pkg.installed ? "#57965C" : "#6F737A",
                        fontWeight: pkg.installed ? 600 : 400,
                      }}
                    >
                      {pkg.installed
                        ? `Installed (${pkg.sizeLabel})`
                        : `Not installed (${pkg.sizeLabel})`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.modalBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.modalBtn}
            onClick={onApplySdkChanges}
          >
            Apply
          </button>
          <button
            type="button"
            className={`${styles.modalBtn} ${styles.modalBtnPrimary}`}
            onClick={() => {
              onApplySdkChanges();
              onClose();
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

interface SearchEverywhereModalProps {
  open: boolean;
  files: StudioFile[];
  onSelectFile: (fileId: string) => void;
  onRunAction: (action: string) => void;
  onClose: () => void;
}

export const SearchEverywhereModal: React.FC<SearchEverywhereModalProps> = ({
  open,
  files,
  onSelectFile,
  onRunAction,
  onClose,
}) => {
  const [query, setQuery] = useState("");

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const matchedFiles = files.filter(
    (f) =>
      !q ||
      f.name.toLowerCase().includes(q) ||
      f.tabTitle.toLowerCase().includes(q) ||
      f.path.toLowerCase().includes(q)
  );

  const actions = [
    { id: "run", label: "Run 'app'", shortcut: "⌃R" },
    { id: "sync", label: "Sync Project with Gradle Files", shortcut: "⇧⌘O" },
    { id: "sdk", label: "Open Android SDK Manager", shortcut: "⌘," },
    { id: "logcat", label: "Activate Logcat Tool Window", shortcut: "⌘6" },
  ].filter((a) => !q || a.label.toLowerCase().includes(q));

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={styles.modalDialog}
        style={{ width: 560 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Search Everywhere"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: "#2B2D30",
            borderBottom: "1px solid #393B40",
          }}
        >
          <SearchEverywhereIcon size={16} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type / to see commands, or search classes, files, symbols, actions..."
            autoFocus
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#DFE1E5",
              fontSize: 13,
            }}
          />
          <span style={{ fontSize: 11, color: "#6F737A" }}>Double ⇧</span>
        </div>

        <div className={styles.modalBody} style={{ maxHeight: 340, padding: 8 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "#6F737A",
              padding: "4px 8px",
              textTransform: "uppercase",
            }}
          >
            Files &amp; Classes
          </div>
          {matchedFiles.map((f) => (
            <div
              key={f.id}
              onClick={() => {
                onSelectFile(f.id);
                onClose();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderRadius: 5,
                cursor: "pointer",
                fontSize: 12.5,
                color: "#DFE1E5",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {f.kind === "kotlin" ? (
                  <KotlinFileIcon size={15} />
                ) : f.kind === "xml" || f.kind === "manifest" ? (
                  <XmlFileIcon size={15} />
                ) : (
                  <GradleFileIcon size={15} />
                )}
                <span>{f.tabTitle}</span>
              </span>
              <span style={{ fontSize: 11, color: "#6F737A" }}>{f.path}</span>
            </div>
          ))}

          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "#6F737A",
              padding: "8px 8px 4px",
              textTransform: "uppercase",
            }}
          >
            Actions
          </div>
          {actions.map((act) => (
            <div
              key={act.id}
              onClick={() => {
                onRunAction(act.id);
                onClose();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderRadius: 5,
                cursor: "pointer",
                fontSize: 12.5,
                color: "#DFE1E5",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AndroidHeadIcon size={14} />
                <span>{act.label}</span>
              </span>
              <span style={{ fontSize: 11, color: "#6F737A" }}>{act.shortcut}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
