"use client";

import React, { useRef, useState } from "react";
import { Filter, Maximize2, Minimize2, Move, Trash2 } from "lucide-react";
import type { PowerBiVisual, VisualLayout } from "@/lib/powerbi/types";
import styles from "./powerbi.module.css";

export interface DraggedFieldPayload {
  tableId: string;
  columnName: string;
  isMeasure?: boolean;
}

interface DashboardCardProps {
  visual: PowerBiVisual;
  selected: boolean;
  isFocusMode: boolean;
  readingView?: boolean;
  formatPainterActive?: boolean;
  scale: number;
  snapToGrid?: boolean;
  canvasWidth?: number;
  canvasHeight?: number;
  activeFilterCount: number;
  onSelect: () => void;
  onApplyFormatPainter?: () => void;
  onToggleFocus: () => void;
  onDelete: () => void;
  onMoveResize: (nextLayout: VisualLayout, commitHistory: boolean) => void;
  onDropField?: (payload: DraggedFieldPayload) => void;
  children: React.ReactNode;
}

type ResizeHandleDir = "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br";

const MIN_W = 140;
const MIN_H = 72;

function snapValue(val: number, enabled: boolean): number {
  if (!enabled) return Math.round(val);
  return Math.round(val / 16) * 16;
}

/** Interactive Power BI visual container with live drag-to-move, 8-handle resize, and field drop support. */
export function DashboardCard({
  visual,
  selected,
  isFocusMode,
  readingView = false,
  formatPainterActive = false,
  scale,
  snapToGrid = false,
  canvasWidth = 1280,
  canvasHeight = 720,
  activeFilterCount,
  onSelect,
  onApplyFormatPainter,
  onToggleFocus,
  onDelete,
  onMoveResize,
  onDropField,
  children,
}: DashboardCardProps) {
  const [dragOverField, setDragOverField] = useState(false);
  const dragSessionRef = useRef<{
    mode: "move" | ResizeHandleDir;
    startX: number;
    startY: number;
    orig: VisualLayout;
    latest: VisualLayout;
  } | null>(null);

  const safeScale = Math.max(0.15, scale || 1);

  const computeNextLayout = (
    mode: "move" | ResizeHandleDir,
    orig: VisualLayout,
    dxRaw: number,
    dyRaw: number,
  ): VisualLayout => {
    const dx = dxRaw / safeScale;
    const dy = dyRaw / safeScale;

    if (mode === "move") {
      const nextX = snapValue(orig.x + dx, snapToGrid);
      const nextY = snapValue(orig.y + dy, snapToGrid);
      return {
        x: Math.max(0, Math.min(canvasWidth - orig.w, nextX)),
        y: Math.max(0, Math.min(canvasHeight - orig.h, nextY)),
        w: orig.w,
        h: orig.h,
      };
    }

    let { x, y, w, h } = orig;
    if (mode.indexOf("r") !== -1) {
      const nextW = snapValue(orig.w + dx, snapToGrid);
      w = Math.max(MIN_W, Math.min(canvasWidth - x, nextW));
    }
    if (mode.indexOf("l") !== -1) {
      const proposedX = snapValue(orig.x + dx, snapToGrid);
      const clampedX = Math.max(0, Math.min(orig.x + orig.w - MIN_W, proposedX));
      w = orig.w + (orig.x - clampedX);
      x = clampedX;
    }
    if (mode.indexOf("b") !== -1) {
      const nextH = snapValue(orig.h + dy, snapToGrid);
      h = Math.max(MIN_H, Math.min(canvasHeight - y, nextH));
    }
    if (mode.indexOf("t") !== -1) {
      const proposedY = snapValue(orig.y + dy, snapToGrid);
      const clampedY = Math.max(0, Math.min(orig.y + orig.h - MIN_H, proposedY));
      h = orig.h + (orig.y - clampedY);
      y = clampedY;
    }

    return { x, y, w, h };
  };

  const beginPointerInteraction = (
    e: React.PointerEvent<HTMLElement>,
    mode: "move" | ResizeHandleDir,
  ) => {
    if (isFocusMode || readingView || e.button !== 0) return;
    e.stopPropagation();
    onSelect();

    const targetEl = e.currentTarget;
    if (typeof targetEl.setPointerCapture === "function") {
      try {
        targetEl.setPointerCapture(e.pointerId);
      } catch {
        // Ignore in synthetic events
      }
    }

    const orig = { ...visual.layout };
    dragSessionRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig,
      latest: orig,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const sess = dragSessionRef.current;
    if (!sess) return;
    const next = computeNextLayout(
      sess.mode,
      sess.orig,
      e.clientX - sess.startX,
      e.clientY - sess.startY,
    );
    sess.latest = next;
    onMoveResize(next, false);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLElement>) => {
    const sess = dragSessionRef.current;
    if (!sess) return;
    dragSessionRef.current = null;
    if (typeof e.currentTarget.releasePointerCapture === "function") {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }
    const moved =
      sess.latest.x !== sess.orig.x ||
      sess.latest.y !== sess.orig.y ||
      sess.latest.w !== sess.orig.w ||
      sess.latest.h !== sess.orig.h;
    if (moved) {
      onMoveResize(sess.latest, true);
    }
  };

  const positionStyle: React.CSSProperties = isFocusMode
    ? {
        left: 14,
        top: 14,
        width: canvasWidth - 28,
        height: canvasHeight - 28,
        zIndex: 12,
        background: visual.format.backgroundColor || "#ffffff",
      }
    : {
        left: visual.layout.x,
        top: visual.layout.y,
        width: visual.layout.w,
        height: visual.layout.h,
        zIndex: selected ? 8 : visual.zIndex || 1,
        background: visual.format.backgroundColor || "#ffffff",
      };

  const handleConfigs: Array<{ dir: ResizeHandleDir; cls: string; cursor: string; label: string }> = [
    { dir: "tl", cls: styles.handleTL, cursor: "nwse-resize", label: "Resize top-left" },
    { dir: "tc", cls: styles.handleTC, cursor: "ns-resize", label: "Resize top" },
    { dir: "tr", cls: styles.handleTR, cursor: "nesw-resize", label: "Resize top-right" },
    { dir: "ml", cls: styles.handleML, cursor: "ew-resize", label: "Resize left" },
    { dir: "mr", cls: styles.handleMR, cursor: "ew-resize", label: "Resize right" },
    { dir: "bl", cls: styles.handleBL, cursor: "nesw-resize", label: "Resize bottom-left" },
    { dir: "bc", cls: styles.handleBC, cursor: "ns-resize", label: "Resize bottom" },
    { dir: "br", cls: styles.handleBR, cursor: "nwse-resize", label: "Resize bottom-right" },
  ];

  return (
    <div
      role="region"
      aria-label={visual.title}
      data-visual-type={visual.type}
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        if (formatPainterActive && onApplyFormatPainter) {
          onApplyFormatPainter();
        } else {
          onSelect();
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.indexOf("application/x-powerbi-field") !== -1) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
          if (!dragOverField) setDragOverField(true);
        }
      }}
      onDragLeave={() => setDragOverField(false)}
      onDrop={(e) => {
        setDragOverField(false);
        const raw = e.dataTransfer.getData("application/x-powerbi-field");
        if (!raw) return;
        e.preventDefault();
        e.stopPropagation();
        try {
          const payload = JSON.parse(raw) as DraggedFieldPayload;
          if (payload?.columnName && onDropField) {
            onDropField(payload);
          }
        } catch {
          // Ignore invalid drag payload
        }
      }}
      style={positionStyle}
      className={`${styles.visualCard} ${visual.format.showBorder ? styles.visualCardBordered : ""} ${selected ? styles.visualCardSelected : ""} ${dragOverField ? styles.visualCardDropTarget : ""} ${formatPainterActive ? styles.formatPainterCursor : ""}`}
    >
      {selected && !isFocusMode && !readingView ? (
        <div className={styles.visualHandles}>
          {handleConfigs.map((hc) => (
            <span
              key={hc.dir}
              role="separator"
              aria-label={hc.label}
              className={`${styles.handleDot} ${styles.handleDotInteractive} ${hc.cls}`}
              style={{ cursor: hc.cursor }}
              onPointerDown={(e) => beginPointerInteraction(e, hc.dir)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onClick={(e) => e.stopPropagation()}
            />
          ))}
        </div>
      ) : null}

      <div
        className={styles.visualHeader}
        style={{ cursor: !isFocusMode && !readingView ? "move" : "default" }}
        onPointerDown={(e) => beginPointerInteraction(e, "move")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {visual.format.showTitle ? (
          <span className={styles.visualTitleText} title={visual.title}>
            {visual.title}
          </span>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#a19f9d" }}>
            {selected && !isFocusMode && !readingView ? <Move size={11} /> : null}
          </span>
        )}

        <div
          className={styles.visualActionBar}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {activeFilterCount > 0 ? (
            <span
              title={`${activeFilterCount} filter(s) affecting this visual`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                padding: "0 4px",
                height: 18,
                fontSize: 10,
                color: "#117865",
                background: "#e6f2ef",
                borderRadius: 2,
              }}
            >
              <Filter size={10} />
              {activeFilterCount}
            </span>
          ) : null}

          <button
            type="button"
            className={styles.visualIconBtn}
            title={isFocusMode ? "Back to report" : "Focus mode"}
            aria-label={isFocusMode ? "Exit focus mode" : `Focus mode for ${visual.title}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFocus();
            }}
          >
            {isFocusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {!isFocusMode && !readingView ? (
            <button
              type="button"
              className={styles.visualIconBtn}
              title="Remove visual"
              aria-label={`Remove ${visual.title}`}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 size={12.5} />
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.visualBody}>{children}</div>
    </div>
  );
}
