"use client";

import React from "react";
import styles from "./powerbi.module.css";

interface NavigationItemProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}

/** Single view-switcher button in the Power BI Desktop left vertical rail. */
export function NavigationItem({ label, active, onClick, icon }: NavigationItemProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`${styles.railNavItem} ${active ? styles.railNavItemActive : ""}`}
    >
      {icon}
    </button>
  );
}
