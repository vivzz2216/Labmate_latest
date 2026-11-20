"use client";

import React from "react";
import type { ViewMode } from "@/lib/powerbi/types";
import { NavigationItem } from "./NavigationItem";
import { LeftRailIcon } from "./PowerBiDesktopIcons";
import styles from "./powerbi.module.css";

interface SidebarProps {
  activeView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}

/** Authentic 44px Power BI Desktop left navigation rail: Report, Data/Table, and Model views. */
export function Sidebar({ activeView, onChangeView }: SidebarProps) {
  return (
    <aside className={styles.leftRail} aria-label="Power BI View Switcher">
      <NavigationItem
        label="Report view"
        active={activeView === "report"}
        onClick={() => onChangeView("report")}
        icon={<LeftRailIcon kind="report" size={18} />}
      />
      <NavigationItem
        label="Table view"
        active={activeView === "table"}
        onClick={() => onChangeView("table")}
        icon={<LeftRailIcon kind="table" size={18} />}
      />
      <NavigationItem
        label="Model view"
        active={activeView === "model"}
        onClick={() => onChangeView("model")}
        icon={<LeftRailIcon kind="model" size={18} />}
      />
    </aside>
  );
}
