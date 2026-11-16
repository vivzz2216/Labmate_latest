"use client";

import React, { useMemo, useState } from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import LabCard from "@/components/catalogue/LabCard";
import LabDetailModal from "@/components/catalogue/LabDetailModal";
import FilterControls from "@/components/catalogue/FilterControls";
import Sem78RolloutState from "@/components/catalogue/Sem78RolloutState";
import ZeroResultsState from "@/components/catalogue/ZeroResultsState";
import AutonomousSchemeNotice from "@/components/catalogue/AutonomousSchemeNotice";

import {
  MUMBAI_UNIVERSITY_LABS,
} from "@/lib/mumbaiUniversity/catalogueData";
import {
  filterLabs,
  isSem78RolloutActive,
  DEFAULT_FILTERS,
} from "@/lib/mumbaiUniversity/filterLogic";
import type {
  ActiveFilters,
  UniversityLabEntry,
} from "@/lib/mumbaiUniversity/types";
import styles from "@/components/catalogue/catalogue.module.css";

export default function MumbaiUniversityCataloguePage() {
  const [filters, setFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);
  const [selectedLab, setSelectedLab] = useState<UniversityLabEntry | null>(null);

  const filteredLabs = useMemo(() => {
    return filterLabs(MUMBAI_UNIVERSITY_LABS, filters);
  }, [filters]);

  const rolloutActive = isSem78RolloutActive(filters);

  const handleFilterChange = <K extends keyof ActiveFilters>(
    key: K,
    value: ActiveFilters[K]
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleClearAll = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const handleDismissPill = (key: keyof ActiveFilters) => {
    setFilters((prev) => ({
      ...prev,
      [key]: DEFAULT_FILTERS[key],
    }));
  };

  const handleResetSemesterFromRollout = () => {
    setFilters((prev) => ({
      ...prev,
      semester: "all",
      academicYear: "all",
    }));
  };

  return (
    <DashboardShell
      title="Mumbai University Engineering Laboratory Catalogue"
      subtitle="Official NEP 2020 curriculum directory across Semesters I–VI"
    >
      <div className={styles.catalogueContainer}>
        {/* Clean Editorial Directory Header */}
        <header className={styles.directoryHeader}>
          <div className={styles.directoryTitleRow}>
            <h1 className={styles.directoryTitle}>
              Mumbai University Labs
            </h1>
            <div className={styles.directoryStatsInline}>
              <span>{MUMBAI_UNIVERSITY_LABS.length} labs · Sem I–VI</span>
              <span className={styles.statDivider} aria-hidden="true">&middot;</span>
              <span>6 Programmes</span>
            </div>
          </div>
        </header>

        {/* Filter Controls & Search */}
        <FilterControls
          filters={filters}
          totalMatches={filteredLabs.length}
          totalLabsCount={MUMBAI_UNIVERSITY_LABS.length}
          onFilterChange={handleFilterChange}
          onClearAll={handleClearAll}
          onDismissPill={handleDismissPill}
        />

        {/* Dynamic Content: Rollout State, Autonomous Scheme Notice, Zero Matches, or Lab Card Grid */}
        {rolloutActive ? (
          <Sem78RolloutState onResetSemester={handleResetSemesterFromRollout} />
        ) : filters.scheme === "Autonomous Colleges" ? (
          <AutonomousSchemeNotice
            onSwitchToMU={() =>
              handleFilterChange("scheme", "Mumbai University NEP 2020")
            }
            onClearFilters={() => handleFilterChange("scheme", "all")}
          />
        ) : filteredLabs.length === 0 ? (
          <ZeroResultsState
            searchQuery={filters.searchQuery}
            onClearFilters={handleClearAll}
          />
        ) : (
          <section
            className={styles.cardGrid}
            aria-label="Matching Laboratory Courses"
          >
            {filteredLabs.map((lab) => (
              <LabCard
                key={lab.id}
                lab={lab}
                activeDepartment={filters.department}
                onOpenDetails={(labToOpen) => setSelectedLab(labToOpen)}
              />
            ))}
          </section>
        )}
      </div>

      {/* Accessible Laboratory Details Modal */}
      <LabDetailModal
        lab={selectedLab}
        activeDepartment={filters.department}
        onClose={() => setSelectedLab(null)}
      />
    </DashboardShell>
  );
}
