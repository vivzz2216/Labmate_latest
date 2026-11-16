"use client";

import React from "react";
import styles from "./androidStudio.module.css";
import {
  AppQualityInsightsStripeIcon,
  BuildStripeIcon,
  CommitStripeIcon,
  DeviceManagerIcon,
  GeminiSparkleIcon,
  GradleStripeIcon,
  LogcatStripeIcon,
  NotificationsStripeIcon,
  ProblemsStripeIcon,
  ProfilerStripeIcon,
  ProjectStripeIcon,
  ResourceManagerStripeIcon,
  RunStripeIcon,
  RunningDevicesStripeIcon,
  TerminalStripeIcon,
  VcsStripeIcon,
} from "./StudioIcons";

export type LeftToolId = "project" | "commit" | "resources";
export type BottomToolId =
  | "logcat"
  | "build"
  | "run"
  | "terminal"
  | "problems"
  | "vcs"
  | "profiler"
  | "aqi";
export type RightToolId = "runningDevices" | "gradle" | "deviceManager" | "notifications" | "gemini";

interface StudioLeftStripeProps {
  activeLeftTool: LeftToolId | null;
  onToggleLeftTool: (tool: LeftToolId) => void;
  activeBottomTool: BottomToolId | null;
  onToggleBottomTool: (tool: BottomToolId) => void;
  problemsCount: number;
  isAppRunning: boolean;
}

export function StudioLeftStripe({
  activeLeftTool,
  onToggleLeftTool,
  activeBottomTool,
  onToggleBottomTool,
  problemsCount,
  isAppRunning,
}: StudioLeftStripeProps) {
  return (
    <aside className={`${styles.toolStripe} ${styles.toolStripeLeft}`} aria-label="Left Tool Window Bar">
      <div className={styles.stripeGroup}>
        <button
          type="button"
          className={`${styles.stripeBtn} ${activeLeftTool === "project" ? styles.stripeBtnActive : ""}`}
          title="Project (Alt+1)"
          aria-label="Project Tool Window"
          onClick={() => onToggleLeftTool("project")}
        >
          <ProjectStripeIcon size={18} />
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeLeftTool === "commit" ? styles.stripeBtnActive : ""}`}
          title="Commit (Alt+0)"
          aria-label="Commit Tool Window"
          onClick={() => onToggleLeftTool("commit")}
        >
          <CommitStripeIcon size={18} />
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeLeftTool === "resources" ? styles.stripeBtnActive : ""}`}
          title="Resource Manager"
          aria-label="Resource Manager Tool Window"
          onClick={() => onToggleLeftTool("resources")}
        >
          <ResourceManagerStripeIcon size={18} />
        </button>
      </div>

      <div className={styles.stripeGroup}>
        <div className={styles.stripeDivider} />

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeBottomTool === "logcat" ? styles.stripeBtnActive : ""}`}
          title="Logcat (Alt+6)"
          aria-label="Logcat Tool Window"
          onClick={() => onToggleBottomTool("logcat")}
        >
          <LogcatStripeIcon size={18} />
          {isAppRunning && <span className={styles.stripeDot} style={{ background: "#3DDC84" }} />}
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeBottomTool === "build" ? styles.stripeBtnActive : ""}`}
          title="Build"
          aria-label="Build Tool Window"
          onClick={() => onToggleBottomTool("build")}
        >
          <BuildStripeIcon size={18} />
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeBottomTool === "run" ? styles.stripeBtnActive : ""}`}
          title="Run (Alt+4)"
          aria-label="Run Tool Window"
          onClick={() => onToggleBottomTool("run")}
        >
          <RunStripeIcon size={18} />
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeBottomTool === "terminal" ? styles.stripeBtnActive : ""}`}
          title="Terminal (Alt+F12)"
          aria-label="Terminal Tool Window"
          onClick={() => onToggleBottomTool("terminal")}
        >
          <TerminalStripeIcon size={18} />
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeBottomTool === "problems" ? styles.stripeBtnActive : ""}`}
          title={`Problems (${problemsCount})`}
          aria-label="Problems Tool Window"
          onClick={() => onToggleBottomTool("problems")}
        >
          <ProblemsStripeIcon size={18} />
          {problemsCount > 0 && <span className={`${styles.stripeDot} ${styles.stripeDotRed}`} />}
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeBottomTool === "profiler" ? styles.stripeBtnActive : ""}`}
          title="Android Profiler"
          aria-label="Android Profiler Tool Window"
          onClick={() => onToggleBottomTool("profiler")}
        >
          <ProfilerStripeIcon size={18} />
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeBottomTool === "aqi" ? styles.stripeBtnActive : ""}`}
          title="App Quality Insights (Firebase Crashlytics)"
          aria-label="App Quality Insights Tool Window"
          onClick={() => onToggleBottomTool("aqi")}
        >
          <AppQualityInsightsStripeIcon size={18} />
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeBottomTool === "vcs" ? styles.stripeBtnActive : ""}`}
          title="Version Control / Git (Alt+9)"
          aria-label="Version Control Tool Window"
          onClick={() => onToggleBottomTool("vcs")}
        >
          <VcsStripeIcon size={18} />
        </button>
      </div>
    </aside>
  );
}

interface StudioRightStripeProps {
  activeRightTool: RightToolId | null;
  onToggleRightTool: (tool: RightToolId) => void;
  unreadNotifications: number;
}

export function StudioRightStripe({
  activeRightTool,
  onToggleRightTool,
  unreadNotifications,
}: StudioRightStripeProps) {
  return (
    <aside className={`${styles.toolStripe} ${styles.toolStripeRight}`} aria-label="Right Tool Window Bar">
      <div className={styles.stripeGroup}>
        <button
          type="button"
          className={`${styles.stripeBtn} ${activeRightTool === "notifications" ? styles.stripeBtnActive : ""}`}
          title="Notifications"
          aria-label="Notifications Tool Window"
          onClick={() => onToggleRightTool("notifications")}
        >
          <NotificationsStripeIcon size={18} />
          {unreadNotifications > 0 && <span className={styles.stripeDot} />}
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeRightTool === "gradle" ? styles.stripeBtnActive : ""}`}
          title="Gradle"
          aria-label="Gradle Tool Window"
          onClick={() => onToggleRightTool("gradle")}
        >
          <GradleStripeIcon size={18} />
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeRightTool === "deviceManager" ? styles.stripeBtnActive : ""}`}
          title="Device Manager"
          aria-label="Device Manager Tool Window"
          onClick={() => onToggleRightTool("deviceManager")}
        >
          <DeviceManagerIcon size={18} />
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeRightTool === "runningDevices" ? styles.stripeBtnActive : ""}`}
          title="Running Devices (Embedded Android Emulator)"
          aria-label="Running Devices Tool Window"
          onClick={() => onToggleRightTool("runningDevices")}
        >
          <RunningDevicesStripeIcon size={18} />
        </button>

        <button
          type="button"
          className={`${styles.stripeBtn} ${activeRightTool === "gemini" ? styles.stripeBtnActive : ""}`}
          title="Gemini in Android Studio"
          aria-label="Gemini in Android Studio"
          onClick={() => onToggleRightTool("gemini")}
        >
          <GeminiSparkleIcon size={18} />
        </button>
      </div>
    </aside>
  );
}
