"use client";

import React from "react";
import {
  TileExcelBadge,
  TilePasteBadge,
  TileSampleBadge,
  TileSqlBadge,
} from "./PowerBiDesktopIcons";
import styles from "./powerbi.module.css";

interface EmptyStateProps {
  onUploadCsv: () => void;
  onLoadSocialSample: () => void;
  onOpenEnterData: () => void;
  onLoadRetailSample: () => void;
  onOpenGetDataModal: () => void;
}

/** Matches Microsoft Power BI Desktop initial empty canvas ("Add data to your report"). */
export function EmptyState({
  onUploadCsv,
  onLoadSocialSample,
  onOpenEnterData,
  onLoadRetailSample,
  onOpenGetDataModal,
}: EmptyStateProps) {
  return (
    <div className={styles.emptyCanvasBox}>
      <div className={styles.emptyDashedInner} />
      <h1 className={styles.emptyTitle}>Add data to your report</h1>
      <p className={styles.emptySubtitle}>
        Once loaded, your data will appear in the <strong>Data</strong> pane.
      </p>

      <div className={styles.sourceTileGrid}>
        <button
          type="button"
          className={styles.sourceTile}
          onClick={onUploadCsv}
          title="Import CSV or Excel workbook into report"
        >
          <div className={styles.sourceTileIconBand} style={{ background: "#d6ebde" }}>
            <TileExcelBadge size={38} />
          </div>
          <span className={styles.sourceTileLabel}>Import data from Excel</span>
        </button>

        <button
          type="button"
          className={styles.sourceTile}
          onClick={onLoadRetailSample}
          title="Load sample relational warehouse table"
        >
          <div className={styles.sourceTileIconBand} style={{ background: "#e5eff9" }}>
            <TileSqlBadge size={38} />
          </div>
          <span className={styles.sourceTileLabel}>Import data from SQL Server</span>
        </button>

        <button
          type="button"
          className={styles.sourceTile}
          onClick={onOpenEnterData}
          title="Paste comma-separated rows manually"
        >
          <div className={styles.sourceTileIconBand} style={{ background: "#faf5e6" }}>
            <TilePasteBadge size={38} />
          </div>
          <span className={styles.sourceTileLabel}>Paste data into a blank table</span>
        </button>

        <button
          type="button"
          className={styles.sourceTile}
          onClick={onLoadSocialSample}
          title="Load Social KPI CSV sample dataset"
        >
          <div className={styles.sourceTileIconBand} style={{ background: "#ededec" }}>
            <TileSampleBadge size={38} />
          </div>
          <span className={styles.sourceTileLabel}>Use sample data</span>
        </button>
      </div>

      <button type="button" className={styles.emptyOtherLink} onClick={onOpenGetDataModal}>
        Get data from another source →
      </button>
    </div>
  );
}
