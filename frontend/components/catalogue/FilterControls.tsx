"use client";

import React from "react";
import { Search, X, RotateCcw } from "lucide-react";
import type {
  ActiveFilters,
  AcademicYear,
  SemesterNumber,
  SubjectCategory,
  AcademicScheme,
} from "../../lib/mumbaiUniversity/types.ts";
import {
  DEPARTMENTS,
  ACADEMIC_YEARS,
  SEMESTERS,
  SUBJECT_CATEGORIES,
  ACADEMIC_SCHEMES,
} from "../../lib/mumbaiUniversity/types.ts";
import {
  getActiveFilterPills,
  getActiveFilterCount,
} from "../../lib/mumbaiUniversity/filterLogic.ts";
import styles from "./catalogue.module.css";

interface FilterControlsProps {
  filters: ActiveFilters;
  totalMatches: number;
  totalLabsCount: number;
  onFilterChange: <K extends keyof ActiveFilters>(
    key: K,
    value: ActiveFilters[K]
  ) => void;
  onClearAll: () => void;
  onDismissPill: (key: keyof ActiveFilters) => void;
}

export default function FilterControls({
  filters,
  totalMatches,
  totalLabsCount,
  onFilterChange,
  onClearAll,
  onDismissPill,
}: FilterControlsProps) {
  const activePills = getActiveFilterPills(filters);
  const activeCount = getActiveFilterCount(filters);

  return (
    <section className={styles.filterCard} aria-label="Curriculum Filters">
      {/* Search Input Bar */}
      <div className={styles.searchWrapper}>
        <Search size={16} className={styles.searchIcon} aria-hidden="true" />
        <input
          id="lab-search-input"
          name="lab-search"
          type="text"
          className={styles.searchInput}
          value={filters.searchQuery}
          onChange={(e) => onFilterChange("searchQuery", e.target.value)}
          placeholder="Search by lab name, subject code (e.g. VSEC102, 2344411), semester, or keyword..."
          aria-label="Search laboratory courses"
        />
        {filters.searchQuery.length > 0 && (
          <button
            type="button"
            className={styles.clearSearchBtn}
            onClick={() => onFilterChange("searchQuery", "")}
            aria-label="Clear search input"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Department Selector Pills */}
      <div className={styles.departmentSection}>
        <div className={styles.departmentHeaderRow}>
          <span className={styles.filterFieldHeading}>Computing Programmes</span>
        </div>
        <div className={styles.departmentPillsRow} role="group" aria-label="Department Filter">
          <button
            type="button"
            className={`${styles.deptPill} ${
              filters.department === "all" ? styles.deptPillActive : ""
            }`}
            onClick={() => onFilterChange("department", "all")}
          >
            All Programmes
          </button>

          {DEPARTMENTS.map((dept) => {
            const isActive = filters.department === dept.code;
            return (
              <button
                key={dept.code}
                type="button"
                className={`${styles.deptPill} ${isActive ? styles.deptPillActive : ""}`}
                onClick={() => onFilterChange("department", dept.code)}
              >
                <span>{dept.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary Dropdown Selectors Row */}
      <div className={styles.filterSelectRow}>
        {/* Academic Year */}
        <div className={styles.filterSelectGroup}>
          <label htmlFor="year-select" className={styles.selectLabel}>
            Academic Year
          </label>
          <select
            id="year-select"
            name="academicYear"
            className={styles.selectInput}
            value={filters.academicYear}
            onChange={(e) =>
              onFilterChange(
                "academicYear",
                e.target.value as AcademicYear | "all"
              )
            }
          >
            <option value="all">All Academic Years</option>
            {ACADEMIC_YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {/* Semester */}
        <div className={styles.filterSelectGroup}>
          <label htmlFor="sem-select" className={styles.selectLabel}>
            Semester
          </label>
          <select
            id="sem-select"
            name="semester"
            className={styles.selectInput}
            value={filters.semester}
            onChange={(e) => {
              const val = e.target.value;
              onFilterChange(
                "semester",
                val === "all" ? "all" : (Number(val) as SemesterNumber)
              );
            }}
          >
            <option value="all">All Semesters (I–VIII)</option>
            {SEMESTERS.map((sem) => (
              <option key={sem} value={sem}>
                {sem >= 7 ? `Semester ${sem} (Rollout AY 2027–28)` : `Semester ${sem}`}
              </option>
            ))}
          </select>
        </div>

        {/* Subject Category */}
        <div className={styles.filterSelectGroup}>
          <label htmlFor="cat-select" className={styles.selectLabel}>
            Course Category
          </label>
          <select
            id="cat-select"
            name="category"
            className={styles.selectInput}
            value={filters.category}
            onChange={(e) =>
              onFilterChange(
                "category",
                e.target.value as SubjectCategory | "all"
              )
            }
          >
            <option value="all">All Categories</option>
            {SUBJECT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Academic Scheme */}
        <div className={styles.filterSelectGroup}>
          <label htmlFor="scheme-select" className={styles.selectLabel}>
            Curriculum Scheme
          </label>
          <select
            id="scheme-select"
            name="scheme"
            className={styles.selectInput}
            value={filters.scheme}
            onChange={(e) =>
              onFilterChange(
                "scheme",
                e.target.value as AcademicScheme | "all"
              )
            }
          >
            <option value="all">All Schemes</option>
            {ACADEMIC_SCHEMES.map((scheme) => (
              <option key={scheme} value={scheme}>
                {scheme}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Filter Chips & Live Count */}
      <div className={styles.activePillsBar}>
        <div className={styles.counterLabel}>
          Showing <span className={styles.counterNumber}>{totalMatches}</span> of{" "}
          <span className={styles.counterNumber}>{totalLabsCount}</span> verified laboratories
        </div>

        {activeCount > 0 && (
          <div className={styles.pillsList}>
            {activePills.map((pill) => (
              <span key={pill.key} className={styles.activeChip}>
                <span>
                  {pill.label}: {pill.displayValue}
                </span>
                <button
                  type="button"
                  className={styles.chipDismissBtn}
                  onClick={() => onDismissPill(pill.key)}
                  aria-label={`Remove filter ${pill.label}`}
                >
                  <X size={13} />
                </button>
              </span>
            ))}

            <button
              type="button"
              className={styles.clearAllBtn}
              onClick={onClearAll}
            >
              <RotateCcw size={12} />
              <span>Clear All</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
