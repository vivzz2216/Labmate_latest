"use client";

import React, { useEffect, useRef } from "react";
import {
  X,
  BookOpen,
  CheckCircle2,
  Layers,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import type {
  UniversityLabEntry,
  DepartmentCode,
} from "../../lib/mumbaiUniversity/types.ts";
import { DEPARTMENTS } from "../../lib/mumbaiUniversity/types.ts";
import {
  getDisplayCourseCode,
  getDisplayLabName,
} from "../../lib/mumbaiUniversity/filterLogic.ts";
import styles from "./catalogue.module.css";
import LabIdeSelector from "./LabIdeSelector";
import { LAB_IDE_ASSOCIATIONS } from "@/lib/mumbaiUniversity/labIdeAssociations";

interface LabDetailModalProps {
  lab: UniversityLabEntry | null;
  activeDepartment?: DepartmentCode | "all";
  onClose: () => void;
}

export default function LabDetailModal({
  lab,
  activeDepartment = "all",
  onClose,
}: LabDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const displayCode = lab ? getDisplayCourseCode(lab, activeDepartment) : "";
  const displayName = lab ? getDisplayLabName(lab, activeDepartment) : "";

  useEffect(() => {
    if (!lab) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [lab, onClose]);

  if (!lab) return null;

  return (
    <div
      className={styles.modalBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={styles.modalContent}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lab-modal-title"
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderTitleGroup}>
            <div className={styles.modalTopMetaRow}>
              <span className={styles.modalCodeBadge}>{displayCode}</span>
              <span className={styles.modalNeutralBadge}>{lab.category}</span>
              <span className={styles.modalNeutralBadge}>
                <CheckCircle2 size={12} />
                {lab.availabilityStatus}
              </span>
            </div>
            <h2 id="lab-modal-title" className={styles.modalTitle}>
              {displayName}
            </h2>
            <p className={styles.courseSubtitle}>{lab.courseName}</p>
            <p style={{color:LAB_IDE_ASSOCIATIONS[lab.id] ? "#4ade80" : "#f87171"}}>
              {LAB_IDE_ASSOCIATIONS[lab.id] ? "✓ Lab connected" : "✕ Lab not connected yet"}
            </p>
            <LabIdeSelector key={lab.id} labId={lab.id} />
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label={`Close details for ${displayName}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaItemLabel}>Academic Year</span>
              <span className={styles.metaItemValue}>{lab.year}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaItemLabel}>Semester</span>
              <span className={styles.metaItemValue}>Semester {lab.semester}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaItemLabel}>Category</span>
              <span className={styles.metaItemValue}>{lab.category}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaItemLabel}>Availability</span>
              <span className={styles.metaItemValue}>{lab.availabilityStatus}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaItemLabel}>Curriculum Scheme</span>
              <span className={styles.metaItemValue}>{lab.scheme}</span>
            </div>
          </div>

          {lab.branchCodes && Object.keys(lab.branchCodes).length > 0 && (
            <div className={styles.branchCodesBox}>
              <span className={styles.filterFieldHeading}>
                Branch-Specific Course Codes Across Computing Programmes
              </span>
              <div className={styles.branchCodesGrid}>
                {Object.entries(lab.branchCodes).map(([deptCode, code]) => {
                  const deptMeta = DEPARTMENTS.find((d) => d.code === deptCode);
                  return (
                    <div key={deptCode} className={styles.branchCodeItem}>
                      <span className={styles.branchCodeName}>
                        {deptMeta ? deptMeta.shortName : deptCode.toUpperCase()}
                      </span>
                      <span className={styles.branchCodeValue}>{code}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h4 className={styles.modalSectionTitle}>
              <BookOpen size={15} /> Course Pedagogical Scope &amp; Objectives
            </h4>
            <p
              className={styles.cardDescription}
              style={{ WebkitLineClamp: "unset", marginTop: "0.4rem" }}
            >
              {lab.description}
            </p>
          </div>

          {lab.prerequisites && lab.prerequisites.length > 0 && (
            <div>
              <h4 className={styles.modalSectionTitle}>
                <GraduationCap size={15} /> Recommended Prerequisites
              </h4>
              <div className={styles.prereqList}>
                {lab.prerequisites.map((prereq) => (
                  <span key={prereq} className={styles.modalNeutralBadge}>
                    {prereq}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className={styles.modalSectionTitle}>
              <Layers size={15} /> Verified Experiment Topic Outlines &amp; Syllabus Highlights
            </h4>
            <div className={styles.outlinesList} style={{ marginTop: "0.75rem" }}>
              {lab.detailedOutlines && lab.detailedOutlines.length > 0 ? (
                lab.detailedOutlines.map((module) => (
                  <div key={module.title} className={styles.outlineItemCard}>
                    <div className={styles.outlineItemHeader}>
                      {module.srNo && (
                        <span className={styles.outlineBadge}>
                          Module {module.srNo}
                        </span>
                      )}
                      <span>{module.title}</span>
                    </div>
                    {module.details && module.details.length > 0 && (
                      <ul className={styles.outlineBullets}>
                        {module.details.map((detail, idx) => (
                          <li key={idx}>{detail}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              ) : (
                lab.syllabusTopics.map((topic, idx) => (
                  <div key={idx} className={styles.outlineItemCard}>
                    <div className={styles.outlineItemHeader}>
                      <span className={styles.outlineBadge}>Topic {idx + 1}</span>
                      <span>{topic}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={styles.officialNoticeBox}>
            <div className={styles.officialNoticeTitle}>
              <ShieldCheck size={15} />
              <span>Official University of Mumbai NEP 2020 Specification</span>
            </div>
            This syllabus outline is drawn from the University of Mumbai Faculty of Science &amp; Technology
            NEP 2020 curriculum documents (affiliated colleges). Autonomous engineering colleges follow independent
            Academic Council syllabi and course codes.
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.modalCloseBtnPrimary}
            onClick={onClose}
          >
            Close Syllabus Details
          </button>
        </div>
      </div>
    </div>
  );
}
