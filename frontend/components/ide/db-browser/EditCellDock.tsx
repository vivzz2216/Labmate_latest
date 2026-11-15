"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  detectCellDataType,
  utf8ByteLength,
  type SqlValue,
} from "@/lib/ide/sqliteEngine";
import {
  CellAppLinkIcon,
  CellExportIcon,
  CellExternalIcon,
  CellImportIcon,
  CellNullIcon,
  CellPlainTextIcon,
  CellWordWrapIcon,
  GearIcon,
  PrintIcon,
} from "./DbBrowserIcons";
import type { SelectedGridCell } from "./ResultsGrid";
import styles from "./db-browser.module.css";

type EditMode = "Text" | "Binary" | "JSON" | "XML" | "Image";

interface EditCellDockProps {
  selectedCell: SelectedGridCell | null;
  onApplyCell: (cell: SelectedGridCell, newValue: SqlValue) => void;
  onToggleUndock: () => void;
  onHideDock: () => void;
  onStatusNotice: (msg: string) => void;
  heightStyle: React.CSSProperties;
}

function toHexDump(str: string): string {
  const lines: string[] = [];
  for (let i = 0; i < str.length; i += 16) {
    const chunk = str.slice(i, i + 16);
    const hexParts: string[] = [];
    let ascii = "";
    for (let j = 0; j < chunk.length; j++) {
      const code = chunk.charCodeAt(j);
      hexParts.push((code & 0xff).toString(16).padStart(2, "0").toUpperCase());
      ascii += code >= 32 && code < 127 ? chunk[j] : ".";
    }
    const addr = i.toString(16).padStart(8, "0").toUpperCase();
    lines.push(addr + "  " + hexParts.join(" ").padEnd(48, " ") + "  " + ascii);
  }
  return lines.join("\n");
}

export function EditCellDock({
  selectedCell,
  onApplyCell,
  onToggleUndock,
  onHideDock,
  onStatusNotice,
  heightStyle,
}: EditCellDockProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [mode, setMode] = useState<EditMode>("Text");
  const [wordWrap, setWordWrap] = useState(true);
  const [autoFormat, setAutoFormat] = useState(false);
  const [draftIsNull, setDraftIsNull] = useState(true);
  const [draftText, setDraftText] = useState("");
  const [showGearTip, setShowGearTip] = useState(false);

  useEffect(() => {
    if (!selectedCell || selectedCell.value === null) {
      setDraftIsNull(true);
      setDraftText("");
    } else {
      setDraftIsNull(false);
      setDraftText(String(selectedCell.value));
    }
  }, [selectedCell]);

  const parsedDraftValue: SqlValue = useMemo(() => {
    if (draftIsNull) return null;
    if (
      selectedCell &&
      typeof selectedCell.value === "number" &&
      draftText.trim() !== "" &&
      !isNaN(Number(draftText))
    ) {
      return Number(draftText);
    }
    return draftText;
  }, [draftIsNull, draftText, selectedCell]);

  const isModified = useMemo(() => {
    if (!selectedCell) return false;
    if (selectedCell.value === null && draftIsNull) return false;
    if (selectedCell.value === null && !draftIsNull) return true;
    if (selectedCell.value !== null && draftIsNull) return true;
    return String(selectedCell.value) !== draftText;
  }, [draftIsNull, draftText, selectedCell]);

  const canApply = Boolean(
    selectedCell &&
      selectedCell.tableName &&
      selectedCell.sourceRowIndex !== undefined &&
      selectedCell.sourceRowIndex >= 0 &&
      isModified
  );

  const byteCount = draftIsNull ? 0 : utf8ByteLength(draftText);
  const typeLabel = detectCellDataType(draftIsNull ? null : parsedDraftValue);

  const displayReadOnlyText = useMemo(() => {
    if (draftIsNull) return "";
    if (mode === "Binary") return toHexDump(draftText);
    if (mode === "JSON") {
      try {
        return JSON.stringify(JSON.parse(draftText), null, 2);
      } catch {
        return draftText;
      }
    }
    return draftText;
  }, [draftIsNull, draftText, mode]);

  const handleExportCell = () => {
    const content = draftIsNull ? "" : draftText;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (selectedCell?.columnName || "cell") + ".txt";
    a.click();
    URL.revokeObjectURL(url);
    onStatusNotice("Exported cell contents");
  };

  return (
    <div className={styles.dockPanel} style={heightStyle}>
      <div className={styles.dockHeader}>
        <span className={styles.dockTitle}>Edit Database Cell</span>
        <div className={styles.dockHeaderActions}>
          <button
            type="button"
            className={styles.dockMiniBtn}
            title="Undock / Toggle Expand"
            aria-label="Undock Edit Database Cell"
            onClick={onToggleUndock}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="1" y="3" width="6" height="6" stroke="#555555" strokeWidth="1" />
              <path d="M3 3V1H9V7H7" stroke="#555555" strokeWidth="1" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.dockMiniBtn}
            title="Close Edit Database Cell"
            aria-label="Close Edit Database Cell"
            onClick={onHideDock}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2L8 8M8 2L2 8" stroke="#555555" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.editCellToolbar}>
        <div className={styles.editCellModeGroup} style={{ position: "relative" }}>
          <span>Mode:</span>
          <select
            aria-label="Cell Edit Mode"
            className={styles.winSelect}
            value={mode}
            onChange={(e) => setMode(e.target.value as EditMode)}
          >
            <option value="Text">Text</option>
            <option value="Binary">Binary</option>
            <option value="JSON">JSON</option>
            <option value="XML">XML</option>
            <option value="Image">Image</option>
          </select>
          <button
            type="button"
            className={styles.iconBtn}
            title="Editor Mode Settings"
            aria-label="Editor Mode Settings"
            onClick={() => setShowGearTip((prev) => !prev)}
          >
            <GearIcon size={16} />
          </button>
          {showGearTip && (
            <div
              style={{
                position: "absolute",
                top: 26,
                left: 44,
                background: "#ffffff",
                border: "1px solid #999999",
                padding: "6px 8px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                zIndex: 50,
                width: 190,
                fontSize: 11,
              }}
            >
              <div>Encoding: UTF-8</div>
              <div style={{ color: "#555555", marginTop: 2 }}>
                {selectedCell?.tableName
                  ? "Editing " + selectedCell.tableName + "." + selectedCell.columnName
                  : "Select any table cell to edit"}
              </div>
            </div>
          )}
        </div>

        <div className={styles.editCellActionsGroup}>
          <button
            type="button"
            className={styles.iconBtn + (wordWrap ? " " + styles.iconBtnActive : "")}
            title="Wrap lines on word boundaries"
            aria-label="Wrap lines on word boundaries"
            onClick={() => setWordWrap((w) => !w)}
          >
            <CellPlainTextIcon size={15} />
          </button>
          <button
            type="button"
            className={styles.iconBtn + (autoFormat ? " " + styles.iconBtnActive : "")}
            title="Auto-format: pretty print on loading, compact on saving."
            aria-label="Auto-format"
            onClick={() => {
              const nextAuto = !autoFormat;
              setAutoFormat(nextAuto);
              if (!draftIsNull && draftText.trim()) {
                try {
                  const parsedJson = JSON.parse(draftText);
                  setDraftText(
                    nextAuto ? JSON.stringify(parsedJson, null, 2) : JSON.stringify(parsedJson)
                  );
                } catch {
                  // Non-JSON cell text stays untouched
                }
              }
              onStatusNotice(nextAuto ? "Auto-format enabled" : "Auto-format disabled");
            }}
          >
            <CellWordWrapIcon size={15} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            title="Import from file"
            aria-label="Import from file"
            onClick={() => fileInputRef.current?.click()}
          >
            <CellImportIcon size={15} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                setDraftIsNull(false);
                setDraftText(String(reader.result || ""));
              };
              reader.readAsText(file);
            }}
          />
          <button
            type="button"
            className={styles.iconBtn}
            title="Export to file"
            aria-label="Export to file"
            onClick={handleExportCell}
          >
            <CellExportIcon size={15} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            title="Open in external application"
            aria-label="Open in external application"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(draftIsNull ? "NULL" : draftText).catch(() => {});
              }
              onStatusNotice("Copied cell content for external application");
            }}
          >
            <CellExternalIcon size={15} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            title="Open in default application or browser"
            aria-label="Open in default application or browser"
            onClick={() => {
              const trimmed = draftIsNull ? "" : draftText.trim();
              if (/^https?:\/\//i.test(trimmed)) {
                window.open(trimmed, "_blank", "noopener,noreferrer");
                onStatusNotice("Opened cell URL in browser");
              } else {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(draftIsNull ? "NULL" : draftText).catch(() => {});
                }
                onStatusNotice("Prepared cell content for default application (" + byteCount + " bytes)");
              }
            }}
          >
            <CellAppLinkIcon size={15} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            title="Set as NULL"
            aria-label="Set as NULL"
            onClick={() => {
              setDraftIsNull(true);
              setDraftText("");
            }}
          >
            <CellNullIcon size={15} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            title="Open preview dialog for printing displayed text"
            aria-label="Open preview dialog for printing displayed text"
            onClick={() => onStatusNotice("Print preview ready for cell (" + byteCount + " bytes)")}
          >
            <PrintIcon size={15} />
          </button>
        </div>
      </div>

      <div
        className={styles.editCellEditorBox}
        onClick={() => {
          if (draftIsNull && selectedCell) {
            setDraftIsNull(false);
            setTimeout(() => textareaRef.current?.focus(), 0);
          }
        }}
      >
        {draftIsNull ? (
          <>
            <div className={styles.nullMarginStrip}>NULL</div>
            <div
              style={{
                flex: 1,
                background: "#ffffff",
                cursor: selectedCell ? "text" : "default",
              }}
            />
          </>
        ) : (
          <textarea
            ref={textareaRef}
            aria-label="Edit Database Cell Editor"
            className={styles.editCellTextarea}
            style={{ whiteSpace: wordWrap ? "pre-wrap" : "pre" }}
            readOnly={mode === "Binary"}
            value={mode === "Binary" ? displayReadOnlyText : draftText}
            onChange={(e) => {
              setDraftIsNull(false);
              setDraftText(e.target.value);
            }}
          />
        )}
      </div>

      <div className={styles.editCellFooter}>
        <div className={styles.editCellMeta}>
          <span>Type of data currently in cell: {typeLabel}</span>
          <span>{byteCount} byte(s)</span>
        </div>
        <button
          type="button"
          className={styles.winButton}
          disabled={!canApply}
          onClick={() => {
            if (selectedCell && canApply) {
              onApplyCell(selectedCell, parsedDraftValue);
            }
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
