"use client";

import React, { useEffect, useState } from "react";
import type { ParsedExcelSheet } from "@/lib/powerbi/excelParser";
import { DataTable } from "./DataTable";
import { Modal } from "./Modal";

interface ExcelNavigatorModalProps {
  open: boolean;
  fileName: string;
  sheets: ParsedExcelSheet[];
  onClose: () => void;
  onConfirmLoad: (selected: ParsedExcelSheet[]) => void;
}

/** Authentic Power BI Excel Navigator dialog for selecting sheets from multi-sheet .xlsx workbooks. */
export function ExcelNavigatorModal({
  open,
  fileName,
  sheets,
  onClose,
  onConfirmLoad,
}: ExcelNavigatorModalProps) {
  const [checkedNames, setCheckedNames] = useState<string[]>([]);
  const [previewName, setPreviewName] = useState<string>("");

  useEffect(() => {
    if (!open || sheets.length === 0) return;
    setCheckedNames([sheets[0].sheetName]);
    setPreviewName(sheets[0].sheetName);
  }, [open, sheets]);

  const previewSheet = sheets.find((s) => s.sheetName === previewName) || sheets[0];

  return (
    <Modal
      open={open}
      title={`Navigator — ${fileName}`}
      onClose={onClose}
      width={720}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 28,
              padding: "0 12px",
              border: "1px solid #c8c6c4",
              background: "#ffffff",
              borderRadius: 2,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={checkedNames.length === 0}
            onClick={() => {
              const selected = sheets.filter((s) => checkedNames.indexOf(s.sheetName) !== -1);
              if (selected.length > 0) onConfirmLoad(selected);
            }}
            style={{
              height: 28,
              padding: "0 16px",
              border: 0,
              background: "#117865",
              color: "#ffffff",
              fontWeight: 600,
              borderRadius: 2,
              cursor: checkedNames.length === 0 ? "default" : "pointer",
              opacity: checkedNames.length === 0 ? 0.5 : 1,
            }}
          >
            Load ({checkedNames.length})
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12 }}>
        <div
          style={{
            border: "1px solid #e1dfdd",
            borderRadius: 3,
            padding: 8,
            background: "#faf9f8",
            maxHeight: 300,
            overflowY: "auto",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "#605e5c", marginBottom: 6 }}>
            Worksheets ({sheets.length})
          </div>
          {sheets.map((s) => {
            const isChecked = checkedNames.indexOf(s.sheetName) !== -1;
            const isPreview = previewSheet?.sheetName === s.sheetName;
            return (
              <div
                key={s.sheetName}
                onClick={() => setPreviewName(s.sheetName)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 6px",
                  borderRadius: 2,
                  background: isPreview ? "#e6f2ef" : "transparent",
                  cursor: "pointer",
                  fontSize: 11.5,
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() =>
                    setCheckedNames((prev) =>
                      prev.indexOf(s.sheetName) !== -1
                        ? prev.filter((n) => n !== s.sheetName)
                        : [...prev, s.sheetName],
                    )
                  }
                  style={{ accentColor: "#117865" }}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.sheetName}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ minWidth: 0 }}>
          {previewSheet ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>
                {previewSheet.sheetName}{" "}
                <span style={{ fontWeight: 400, color: "#605e5c" }}>
                  ({previewSheet.dataset.rows.length} rows × {previewSheet.dataset.columns.length} cols)
                </span>
              </div>
              <DataTable
                columns={previewSheet.dataset.columns}
                rows={previewSheet.dataset.rows.slice(0, 8)}
                compact
                pageSize={8}
              />
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
