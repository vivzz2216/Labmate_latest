"use client";

import React from "react";
import {
  BuildHammerIcon,
  CommitStripeIcon,
  DatabaseCylinderIcon,
  GitBranchIcon,
  MavenMIcon,
  MoreHorizontalIcon,
  NotificationsBellIcon,
  ProblemsStripeIcon,
  ProjectFolderStripeIcon,
  RunStripeIcon,
  StructureStripeIcon,
  TerminalStripeIcon,
} from "./ExpUiIcons";
import styles from "./intellij.module.css";
import type { BottomToolId, LeftToolId, RightToolId } from "./types";

interface LeftToolStripeProps {
  activeLeft: LeftToolId | null;
  activeBottom: BottomToolId | null;
  gitEnabled: boolean;
  problemCount: number;
  onToggleLeft: (id: LeftToolId) => void;
  onToggleBottom: (id: BottomToolId) => void;
  onOpenMoreTools: () => void;
}

export function LeftToolStripe({
  activeLeft,
  activeBottom,
  gitEnabled,
  problemCount,
  onToggleLeft,
  onToggleBottom,
  onOpenMoreTools,
}: LeftToolStripeProps) {
  return (
    <aside className={`${styles.toolStripe} ${styles.toolStripeLeft}`} aria-label="Left tool window bar">
      <div className={styles.stripeGroup}>
        <button
          type="button"
          className={`${styles.stripeBtn} ${activeLeft === "project" ? styles.stripeBtnActiveSoft : ""}`}
          title="Project (Alt+1)"
          aria-label="Project tool window"
          aria-pressed={activeLeft === "project"}
          onClick={() => onToggleLeft("project")}
        >
          <ProjectFolderStripeIcon size={18} color={activeLeft === "project" ? "#FFFFFF" : "#9DA0A8"} />
        </button>

        {gitEnabled && (
          <button
            type="button"
            className={`${styles.stripeBtn} ${activeLeft === "commit" ? styles.stripeBtnActiveSoft : ""}`}
            title="Commit (Alt+0)"
            aria-label="Commit tool window"
            aria-pressed={activeLeft === "commit"}
            onClick={() => onToggleLeft("commit")}
          >
            <CommitStripeIcon size={18} color={activeLeft === "commit" ? "#FFFFFF" : "#9DA0A8"} />
          </button>
        )}

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeLeft === "structure" ? styles.stripeBtnActiveSoft : ""}`}
          title="Structure (Alt+7)"
          aria-label="Structure tool window"
          aria-pressed={activeLeft === "structure"}
          onClick={() => onToggleLeft("structure")}
        >
          <StructureStripeIcon size={18} color={activeLeft === "structure" ? "#FFFFFF" : "#9DA0A8"} />
        </button>

        <button
          type="button"
          className={styles.stripeBtn}
          title="More Tool Windows"
          aria-label="More tool windows"
          onClick={onOpenMoreTools}
        >
          <MoreHorizontalIcon size={17} color="#9DA0A8" />
        </button>
      </div>

      <div className={styles.stripeGroup}>
        <button
          type="button"
          className={`${styles.stripeBtn} ${activeBottom === "run" ? styles.stripeBtnActiveBlue : ""}`}
          title="Run (Alt+4)"
          aria-label="Run tool window"
          aria-pressed={activeBottom === "run"}
          onClick={() => onToggleBottom("run")}
        >
          <RunStripeIcon size={18} color={activeBottom === "run" ? "#FFFFFF" : "#9DA0A8"} />
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeBottom === "build" ? styles.stripeBtnActiveBlue : ""}`}
          title="Build"
          aria-label="Build tool window"
          aria-pressed={activeBottom === "build"}
          onClick={() => onToggleBottom("build")}
        >
          <BuildHammerIcon size={18} color={activeBottom === "build" ? "#FFFFFF" : "#9DA0A8"} />
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeBottom === "terminal" ? styles.stripeBtnActiveBlue : ""}`}
          title="Terminal (Alt+F12)"
          aria-label="Terminal tool window"
          aria-pressed={activeBottom === "terminal"}
          onClick={() => onToggleBottom("terminal")}
        >
          <TerminalStripeIcon size={18} color={activeBottom === "terminal" ? "#FFFFFF" : "#9DA0A8"} />
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeBottom === "problems" ? styles.stripeBtnActiveBlue : ""}`}
          title="Problems (Alt+6)"
          aria-label="Problems tool window"
          aria-pressed={activeBottom === "problems"}
          onClick={() => onToggleBottom("problems")}
        >
          <ProblemsStripeIcon size={18} color={activeBottom === "problems" ? "#FFFFFF" : "#9DA0A8"} />
          {problemCount > 0 && activeBottom !== "problems" && <span className={styles.stripeBadgeDot} />}
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeBottom === "git" ? styles.stripeBtnActiveBlue : ""}`}
          title="Git (Alt+9)"
          aria-label="Git tool window"
          aria-pressed={activeBottom === "git"}
          onClick={() => onToggleBottom("git")}
        >
          <GitBranchIcon size={18} color={activeBottom === "git" ? "#FFFFFF" : "#9DA0A8"} />
        </button>
      </div>
    </aside>
  );
}

interface RightToolStripeProps {
  activeRight: RightToolId | null;
  unreadNotifications: number;
  onToggleRight: (id: RightToolId) => void;
}

export function RightToolStripe({ activeRight, unreadNotifications, onToggleRight }: RightToolStripeProps) {
  return (
    <aside className={`${styles.toolStripe} ${styles.toolStripeRight}`} aria-label="Right tool window bar">
      <div className={styles.stripeGroup}>
        <button
          type="button"
          className={`${styles.stripeBtn} ${activeRight === "notifications" ? styles.stripeBtnActiveSoft : ""}`}
          title="Notifications"
          aria-label="Notifications tool window"
          aria-pressed={activeRight === "notifications"}
          onClick={() => onToggleRight("notifications")}
        >
          <NotificationsBellIcon size={18} color={activeRight === "notifications" ? "#FFFFFF" : "#9DA0A8"} />
          {unreadNotifications > 0 && activeRight !== "notifications" && <span className={styles.stripeBadgeDot} />}
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeRight === "database" ? styles.stripeBtnActiveSoft : ""}`}
          title="Database"
          aria-label="Database tool window"
          aria-pressed={activeRight === "database"}
          onClick={() => onToggleRight("database")}
        >
          <DatabaseCylinderIcon size={18} color={activeRight === "database" ? "#FFFFFF" : "#9DA0A8"} />
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeRight === "maven" ? styles.stripeBtnActiveSoft : ""}`}
          title="Maven"
          aria-label="Maven tool window"
          aria-pressed={activeRight === "maven"}
          onClick={() => onToggleRight("maven")}
        >
          <MavenMIcon size={18} color={activeRight === "maven" ? "#FFFFFF" : "#9DA0A8"} />
        </button>
      </div>
      <div />
    </aside>
  );
}
