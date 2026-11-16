"use client";

import React from "react";
import { Filter, Maximize2, Minimize2, Trash2 } from "lucide-react";
import type { PowerBiVisual } from "@/lib/powerbi/types";
import styles from "./powerbi.module.css";

interface DashboardCardProps {
  visual: PowerBiVisual;
  selected: boolean;
  isFocusMode: boolean;
  activeFilterCount: number;
  onSelect: () => void;
  onToggleFocus: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

/** Power BI visual bounding container with 8 resize handles and floating visual header icons. */
export function DashboardCard({
  visual,
  selected,
  isFocusMode,
  activeFilterCount,
  onSelect,
  onToggleFocus,
  onDelete,
  children,
}: DashboardCardProps) {
  const positionStyle: React.CSSProperties = isFocusMode
    ? {
        left: 14,
        top: 14,
        width: 1252,
        height: 692,
        zIndex: 12,
        background: visual.format.backgroundColor || "#ffffff",
      }
    : {
        left: visual.layout.x,
        top: visual.layout.y,
        width: visual.layout.w,
        height: visual.layout.h,
        background: visual.format.backgroundColor || "#ffffff",
      };

  return (
    <div
      role="region"
      aria-label={visual.title}
      data-visual-type={visual.type}
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      style={positionStyle}
      className={`${styles.visualCard} ${visual.format.showBorder ? styles.visualCardBordered : ""} ${selected ? styles.visualCardSelected : ""}`}
    >
      {selected && !isFocusMode ? (
        <div className={styles.visualHandles} aria-hidden="true">
          <span className={`${styles.handleDot} ${styles.handleTL}`} />
          <span className={`${styles.handleDot} ${styles.handleTC}`} />
          <span className={`${styles.handleDot} ${styles.handleTR}`} />
          <span className={`${styles.handleDot} ${styles.handleML}`} />
          <span className={`${styles.handleDot} ${styles.handleMR}`} />
          <span className={`${styles.handleDot} ${styles.handleBL}`} />
          <span className={`${styles.handleDot} ${styles.handleBC}`} />
          <span className={`${styles.handleDot} ${styles.handleBR}`} />
        </div>
      ) : null}

      <div className={styles.visualHeader}>
        {visual.format.showTitle ? (
          <span className={styles.visualTitleText} title={visual.title}>
            {visual.title}
          </span>
        ) : (
          <span />
        )}

        <div className={styles.visualActionBar}>
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

          {!isFocusMode ? (
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
