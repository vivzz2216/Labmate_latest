"use client";

import React from "react";
import { formatPowerBiNumber } from "@/lib/powerbi/csvEngine";
import type { AggregationFn } from "@/lib/powerbi/types";
import styles from "./powerbi.module.css";

interface MetricCardProps {
  value: number;
  field: string;
  label: string;
  aggregation: AggregationFn;
  showDataLabels?: boolean;
}

/** Single-number Power BI KPI Card visual with crisp tabular typography. */
export function MetricCard({
  value,
  field,
  label,
  aggregation,
  showDataLabels = true,
}: MetricCardProps) {
  const displayValue = showDataLabels ? formatPowerBiNumber(value, field) : "—";
  const prefix =
    aggregation === "average"
      ? "Avg "
      : aggregation === "count"
        ? "Count of "
        : aggregation === "min"
          ? "Min "
          : aggregation === "max"
            ? "Max "
            : "";

  return (
    <div className={styles.kpiCenterWrap}>
      <div className={styles.kpiBigValue}>{displayValue}</div>
      <div className={styles.kpiSubLabel}>{`${prefix}${label}`}</div>
    </div>
  );
}
