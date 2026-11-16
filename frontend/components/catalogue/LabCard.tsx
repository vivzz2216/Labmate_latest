"use client";

import React from "react";
import Image from "next/image";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/BasicAuthContext";
import { LAB_IDE_ASSOCIATIONS, labIdeHref } from "@/lib/mumbaiUniversity/labIdeAssociations";
import type {
  UniversityLabEntry,
  DepartmentCode,
} from "../../lib/mumbaiUniversity/types.ts";
import {
  getDisplayCourseCode,
  getDisplayLabName,
} from "../../lib/mumbaiUniversity/filterLogic.ts";
import { getLabVisualMeta } from "../../lib/mumbaiUniversity/labVisuals.ts";
import styles from "./catalogue.module.css";

interface LabCardProps {
  lab: UniversityLabEntry;
  activeDepartment: DepartmentCode | "all";
  onOpenDetails: (lab: UniversityLabEntry) => void;
}

function formatBranchLabel(dept: DepartmentCode): string {
  if (dept === "ce") return "CS";
  if (dept === "it") return "IT";
  if (dept === "cse_aiml") return "AIML";
  if (dept === "cse_ds") return "DataSci";
  return dept.toUpperCase();
}

export default function LabCard({
  lab,
  activeDepartment,
  onOpenDetails,
}: LabCardProps) {
  const router = useRouter();
  const {user} = useAuth();
  const displayCode = getDisplayCourseCode(lab, activeDepartment);
  const displayName = getDisplayLabName(lab, activeDepartment);
  const visual = getLabVisualMeta(lab);
  const hasDetailedOutlines =
    lab.detailedOutlines && lab.detailedOutlines.length > 0;
  const showCourseSubtitle =
    lab.courseName && lab.courseName.trim() !== displayName.trim();

  return (
    <article
      className={styles.labCard}
      aria-labelledby={`lab-title-${lab.id}`}
    >
      {/* Top Subject Image Frame */}
      <div className={styles.cardMedia}>
        <Image
          src={visual.imageSrc}
          alt={visual.altText}
          width={640}
          height={220}
          className={styles.cardMediaImg}
          unoptimized
        />
        <span className={styles.codeOverlayBadge}>{displayCode}</span>
      </div>

      {/* Main Content */}
      <div className={styles.cardBody}>
        <p className={styles.cardMetaLine}>
          {LAB_IDE_ASSOCIATIONS[lab.id] ? <span style={{display:"inline-flex",verticalAlign:"middle",marginRight:6,color:"#4ade80"}} title="Lab connected"><CheckCircle2 size={15} aria-label="Lab connected" /></span> : <span style={{display:"inline-flex",verticalAlign:"middle",marginRight:6,color:"#f87171"}} title="Lab not connected yet"><XCircle size={15} aria-label="Lab not connected yet" /></span>}
          Sem {lab.semester} &middot; {lab.year} &middot; {lab.category}
        </p>

        <div className={styles.cardTitleGroup}>
          <h3 id={`lab-title-${lab.id}`} className={styles.labTitle}>
            {displayName}
          </h3>
          {showCourseSubtitle && (
            <p className={styles.courseSubtitle}>{lab.courseName}</p>
          )}
        </div>

        <p className={styles.cardDescription}>{lab.description}</p>

        <div className={styles.cardBranchesRow}>
          {lab.isCommon && lab.departments.length === 6 ? (
            <span className={styles.neutralBranchTag}>Common (All 6 Branches)</span>
          ) : (
            lab.departments.map((dept) => (
              <span key={dept} className={styles.neutralBranchTag}>
                {formatBranchLabel(dept)}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Footer Action */}
      <div className={styles.cardFooter} style={{flexWrap:"wrap"}}>
        {LAB_IDE_ASSOCIATIONS[lab.id] && <Link className={styles.viewDetailsBtn} style={{textDecoration:"none"}} href={labIdeHref(lab.id)!} aria-label={`Open workspace for ${displayName}`} onClick={event=>{
          try {
            const choice=localStorage.getItem("labmate:lab-ide:"+(user?.id || "guest")+":"+lab.id);
            if(choice){event.preventDefault();router.push(labIdeHref(lab.id,choice)!);}
          } catch {}
        }}>Open Workspace</Link>}
        <span className={styles.footerMetaText}>
          {hasDetailedOutlines
            ? `${lab.detailedOutlines?.length} Modules · ${lab.scheme}`
            : lab.scheme}
        </span>
        <button
          type="button"
          className={styles.viewDetailsBtn}
          onClick={() => onOpenDetails(lab)}
          aria-label={`View syllabus and experiment outline for ${displayName}`}
        >
          <span>Syllabus &amp; Outlines</span>
          <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
