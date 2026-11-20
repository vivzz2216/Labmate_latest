"use client";

import React from "react";
import {
  SemanticModelBadge,
  TileExcelBadge,
  TilePasteBadge,
  TileSampleBadge,
} from "./PowerBiDesktopIcons";
import styles from "./powerbi.module.css";

interface EmptyStateProps {
  onUploadFile: () => void;
  onLoadSocialSample: () => void;
  onOpenEnterData: () => void;
  onLoadRelationalSample: () => void;
  onOpenGetDataModal: () => void;
}

/** Matches Microsoft Power BI Desktop initial empty canvas ("Add data to your report"). */
export function EmptyState({
  onUploadFile,
  onLoadSocialSample,
  onOpenEnterData,
  onLoadRelationalSample,
  onOpenGetDataModal,
}: EmptyStateProps) {
  return (
    <div className={styles.emptyCanvasBox}>
      <div className={styles.emptyDashedInner} />
      <h1 className={styles.emptyTitle}>Add data to your report</h1>
      <p className={styles.emptySubtitle}>
        Once loaded, your tables and columns will appear in the <strong>Data</strong> pane.
      </p>

      <div className={styles.sourceTileGrid}>
        <button
          type="button"
          className={styles.sourceTile}
          onClick={onUploadFile}
          title="Import .xlsx Excel workbook or .csv file into your report"
        >
          <div className={styles.sourceTileIconBand} style={{ background: "#d6ebde" }}>
            <TileExcelBadge size={38} />
          </div>
          <span className={styles.sourceTileLabel}>Import CSV / Excel</span>
        </button>

        <button
          type="button"
          className={styles.sourceTile}
          onClick={onLoadSocialSample}
          title="Load 360-row Social Media KPI sample dataset"
        >
          <div className={styles.sourceTileIconBand} style={{ background: "#ededec" }}>
            <TileSampleBadge size={38} />
          </div>
          <span className={styles.sourceTileLabel}>Load Social KPI sample</span>
        </button>

        <button
          type="button"
          className={styles.sourceTile}
          onClick={onLoadRelationalSample}
          title="Load two related tables (Orders & Products) for Model View and cross-table filtering"
        >
          <div className={styles.sourceTileIconBand} style={{ background: "#e5eff9" }}>
            <SemanticModelBadge size={38} />
          </div>
          <span className={styles.sourceTileLabel}>Load relational tables</span>
        </button>

        <button
          type="button"
          className={styles.sourceTile}
          onClick={onOpenEnterData}
          title="Type or paste comma-separated rows manually"
        >
          <div className={styles.sourceTileIconBand} style={{ background: "#faf5e6" }}>
            <TilePasteBadge size={38} />
          </div>
          <span className={styles.sourceTileLabel}>Paste data into table</span>
        </button>
      </div>

      <button type="button" className={styles.emptyOtherLink} onClick={onOpenGetDataModal}>
        Browse sample datasets &amp; file options →
      </button>
    </div>
  );
}
