"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Maximize2, Monitor, Pencil, Plus, Smartphone, X } from "lucide-react";
import type { ReportPage } from "@/lib/powerbi/types";
import styles from "./powerbi.module.css";

interface TabsProps {
  pages: ReportPage[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onDuplicatePage: (id: string) => void;
  onRenamePage: (id: string, name: string) => void;
  onDeletePage: (id: string) => void;
  zoomPct: number;
  onZoomChange: (pct: number) => void;
  onResetZoom: () => void;
  rowCount: number;
  filteredRowCount: number;
  mobileLayoutPreview?: boolean;
  onToggleMobileLayoutPreview?: () => void;
}

/** Bottom Power BI Desktop page-tab strip + rename/duplicate/delete + zoom controls & status bar. */
export function Tabs({
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onRenamePage,
  onDeletePage,
  zoomPct,
  onZoomChange,
  onResetZoom,
  rowCount,
  filteredRowCount,
  mobileLayoutPreview = false,
  onToggleMobileLayoutPreview,
}: TabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const activeIdx = Math.max(
    1,
    pages.findIndex((p) => p.id === activePageId) + 1,
  );

  return (
    <>
      <div className={styles.pageTabsBar} role="tablist" aria-label="Report pages">
        <div className={styles.pageTabsLeft}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              paddingRight: 6,
              borderRight: "1px solid #e1dfdd",
              marginRight: 2,
            }}
          >
            <button
              type="button"
              title="Desktop 16:9 canvas layout"
              aria-label="Desktop layout"
              onClick={() => mobileLayoutPreview && onToggleMobileLayoutPreview?.()}
              className={styles.pageStripIconBtn}
              style={{ color: !mobileLayoutPreview ? "#117865" : "#797775" }}
            >
              <Monitor size={14} />
            </button>
            <button
              type="button"
              title="Mobile phone canvas preview"
              aria-label="Mobile layout preview"
              onClick={() => onToggleMobileLayoutPreview?.()}
              className={styles.pageStripIconBtn}
              style={{ color: mobileLayoutPreview ? "#117865" : "#797775" }}
            >
              <Smartphone size={13} />
            </button>
            <button
              type="button"
              title="Previous page"
              aria-label="Previous page"
              onClick={() => {
                const prev = pages[Math.max(0, activeIdx - 2)];
                if (prev) onSelectPage(prev.id);
              }}
              className={styles.pageStripIconBtn}
            >
              <ChevronLeft size={13} />
            </button>
            <button
              type="button"
              title="Next page"
              aria-label="Next page"
              onClick={() => {
                const next = pages[Math.min(pages.length - 1, activeIdx)];
                if (next) onSelectPage(next.id);
              }}
              className={styles.pageStripIconBtn}
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {pages.map((page) => {
            const isActive = page.id === activePageId;
            return (
              <div
                key={page.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectPage(page.id)}
                onDoubleClick={() => {
                  setEditingId(page.id);
                  setDraftName(page.name);
                }}
                className={`${styles.pageTab} ${isActive ? styles.pageTabActive : ""}`}
                title="Double-click to rename page"
              >
                {editingId === page.id ? (
                  <input
                    autoFocus
                    aria-label="Rename page"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => {
                      if (draftName.trim()) onRenamePage(page.id, draftName.trim());
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (draftName.trim()) onRenamePage(page.id, draftName.trim());
                        setEditingId(null);
                      } else if (e.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                    style={{
                      width: 110,
                      height: 20,
                      padding: "0 4px",
                      fontSize: 11.5,
                      border: "1px solid #117865",
                      outline: "none",
                    }}
                  />
                ) : (
                  <span>{page.name}</span>
                )}

                {isActive && editingId !== page.id ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                    <button
                      type="button"
                      aria-label={`Rename ${page.name}`}
                      title="Rename page"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(page.id);
                        setDraftName(page.name);
                      }}
                      className={styles.pageTabActionBtn}
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Duplicate ${page.name}`}
                      title="Duplicate page"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicatePage(page.id);
                      }}
                      className={styles.pageTabActionBtn}
                    >
                      <Copy size={10} />
                    </button>
                  </span>
                ) : null}

                {pages.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Remove ${page.name}`}
                    title="Delete page"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePage(page.id);
                    }}
                    className={styles.pageTabActionBtn}
                  >
                    <X size={11} />
                  </button>
                ) : null}
              </div>
            );
          })}

          <button
            type="button"
            aria-label="New page"
            title="New page"
            onClick={onAddPage}
            className={styles.addPageBtn}
          >
            <Plus size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <footer className={styles.statusBar}>
        <span>
          Page {activeIdx} of {pages.length}
          {rowCount > 0 ? ` · ${filteredRowCount.toLocaleString()} of ${rowCount.toLocaleString()} rows active` : ""}
        </span>
        <div className={styles.zoomControls}>
          <button
            type="button"
            className={styles.ribbonSmBtn}
            onClick={() => onZoomChange(Math.max(18, zoomPct - 10))}
            aria-label="Zoom out"
          >
            −
          </button>
          <input
            type="range"
            aria-label="Canvas zoom percentage"
            min={18}
            max={135}
            step={1}
            value={zoomPct}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className={styles.zoomRange}
          />
          <button
            type="button"
            className={styles.ribbonSmBtn}
            onClick={() => onZoomChange(Math.min(135, zoomPct + 10))}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className={styles.ribbonSmBtn}
            onClick={onResetZoom}
            title="Fit page to screen"
            style={{ minWidth: 38, justifyContent: "center", fontVariantNumeric: "tabular-nums" }}
          >
            {zoomPct}%
          </button>
          <button
            type="button"
            className={styles.ribbonSmBtn}
            onClick={onResetZoom}
            aria-label="Fit to page"
            title="Fit to page"
            style={{ padding: "0 4px" }}
          >
            <Maximize2 size={11} />
          </button>
        </div>
      </footer>
    </>
  );
}
