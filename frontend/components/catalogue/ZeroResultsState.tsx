"use client";

import React from "react";
import { SearchX, RotateCcw } from "lucide-react";
import styles from "./catalogue.module.css";

interface ZeroResultsStateProps {
  searchQuery: string;
  onClearFilters: () => void;
}

export default function ZeroResultsState({
  searchQuery,
  onClearFilters,
}: ZeroResultsStateProps) {
  return (
    <div className={styles.emptyContainer} role="status" aria-live="polite">
      <div className={styles.emptyIconWrapper}>
        <SearchX size={22} />
      </div>

      <div>
        <h3 className={styles.emptyTitle}>No matching laboratories found</h3>
        <p className={styles.emptySubtitle}>
          {searchQuery
            ? `No verified Mumbai University NEP 2020 computing laboratories matched "${searchQuery}" under your active filters.`
            : "No verified Mumbai University laboratories matched your active combination of filters."}
        </p>
      </div>

      <button
        type="button"
        className={styles.rolloutResetBtn}
        onClick={onClearFilters}
      >
        <RotateCcw size={15} />
        <span>Reset All Filters</span>
      </button>
    </div>
  );
}
