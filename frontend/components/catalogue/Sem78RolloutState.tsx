"use client";

import React from "react";
import { CalendarClock, ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { SEMESTER_7_8_ROLLOUT_METADATA } from "../../lib/mumbaiUniversity/catalogueData.ts";
import styles from "./catalogue.module.css";

interface Sem78RolloutStateProps {
  onResetSemester: () => void;
}

export default function Sem78RolloutState({
  onResetSemester,
}: Sem78RolloutStateProps) {
  return (
    <div
      className={styles.rolloutContainer}
      role="status"
      aria-live="polite"
    >
      <div className={styles.rolloutIconWrapper}>
        <CalendarClock size={22} />
      </div>

      <div>
        <h3 className={styles.rolloutTitle}>
          {SEMESTER_7_8_ROLLOUT_METADATA.headline}
        </h3>
        <p className={styles.rolloutText}>
          {SEMESTER_7_8_ROLLOUT_METADATA.description}
        </p>
      </div>

      {/* Official NEP 2020 Implementation Timeline Stepper */}
      <div className={styles.timelineStepper}>
        {SEMESTER_7_8_ROLLOUT_METADATA.implementationMilestones.map((item) => {
          const isScheduled = item.status === "Scheduled Rollout";
          return (
            <div key={item.year} className={styles.stepperItem}>
              <span className={styles.stepperYear}>{item.year}</span>
              <span className={styles.stepperSems}>{item.semesters}</span>
              <span
                className={`${styles.stepperStatus} ${
                  isScheduled ? styles.stepperScheduled : ""
                }`}
              >
                {isScheduled ? <Clock size={12} /> : <CheckCircle2 size={12} />}
                <span>{item.status}</span>
              </span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className={styles.rolloutResetBtn}
        onClick={onResetSemester}
      >
        <ArrowLeft size={15} />
        <span>Switch to Semesters I–VI (Verified NEP Syllabi)</span>
      </button>
    </div>
  );
}
