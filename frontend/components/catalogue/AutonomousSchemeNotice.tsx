"use client";

import React from "react";
import { Building2, RotateCcw, ShieldCheck } from "lucide-react";
import styles from "./catalogue.module.css";

interface AutonomousSchemeNoticeProps {
  onSwitchToMU: () => void;
  onClearFilters: () => void;
}

export default function AutonomousSchemeNotice({
  onSwitchToMU,
  onClearFilters,
}: AutonomousSchemeNoticeProps) {
  return (
    <div
      className={styles.rolloutContainer}
      role="status"
      aria-live="polite"
    >
      <div className={styles.rolloutIconWrapper}>
        <Building2 size={22} />
      </div>

      <div>
        <h3 className={styles.rolloutTitle}>
          Autonomous Colleges Curriculum Distinction
        </h3>
        <p className={styles.rolloutText}>
          Autonomous engineering colleges affiliated with the University of Mumbai govern curricula
          through their own Boards of Studies and Academic Councils, setting independent course
          codes, semester mappings, and laboratory syllabi separate from the centralized MU NEP 2020
          affiliated-college PDFs.
        </p>
        <p className={styles.rolloutText}>
          To maintain strict curriculum integrity, zero unverified or speculative
          autonomous courses are fabricated in this catalogue. Students of
          autonomous institutions should consult their respective institute
          academic handbooks for institutional course listings.
        </p>
      </div>

      <div className={styles.noticeActionsRow}>
        <button
          type="button"
          className={styles.rolloutResetBtn}
          onClick={onSwitchToMU}
        >
          <ShieldCheck size={15} />
          <span>Switch to Mumbai University NEP 2020</span>
        </button>
        <button
          type="button"
          className={styles.secondaryOutlineBtn}
          onClick={onClearFilters}
        >
          <RotateCcw size={15} />
          <span>View All Schemes</span>
        </button>
      </div>
    </div>
  );
}
