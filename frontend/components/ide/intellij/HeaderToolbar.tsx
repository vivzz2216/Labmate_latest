"use client";

import React, { useEffect, useRef, useState } from "react";
import type { IntellijProjectPreset, RunConfiguration } from "@/lib/ide/intellijRunner";
import {
  ChevronDownIcon,
  CodeWithMeIcon,
  DebugBugIcon,
  GitBranchIcon,
  MoreVerticalIcon,
  PlayOutlineIcon,
  RunConfigAppIcon,
  SearchEverywhereIcon,
  SettingsGearIcon,
} from "./ExpUiIcons";
import styles from "./intellij.module.css";

interface HeaderToolbarProps {
  presets: IntellijProjectPreset[];
  activePreset: IntellijProjectPreset;
  gitEnabled: boolean;
  gitBranch: string;
  runConfigs: RunConfiguration[];
  activeRunConfig: RunConfiguration;
  isRunning: boolean;
  editorFontSize: number;
  softWrap: boolean;
  onSelectPreset: (id: IntellijProjectPreset["id"]) => void;
  onSelectRunConfig: (id: string) => void;
  onRunActiveConfig: (debugMode?: boolean) => void;
  onEnableGit: () => void;
  onSwitchBranch: (branch: string) => void;
  onOpenSearchEverywhere: () => void;
  onOpenNewClassModal: () => void;
  onOpenCommitPane: () => void;
  onChangeFontSize: (size: number) => void;
  onToggleSoftWrap: () => void;
  onToggleBottomPane: () => void;
  onResetWorkspace: () => void;
  onNotify: (title: string, detail: string) => void;
}

type OpenMenu = "project" | "vcs" | "runConfig" | "runMore" | "cwm" | "settings" | null;

export function HeaderToolbar({
  presets,
  activePreset,
  gitEnabled,
  gitBranch,
  runConfigs,
  activeRunConfig,
  isRunning,
  editorFontSize,
  softWrap,
  onSelectPreset,
  onSelectRunConfig,
  onRunActiveConfig,
  onEnableGit,
  onSwitchBranch,
  onOpenSearchEverywhere,
  onOpenNewClassModal,
  onOpenCommitPane,
  onChangeFontSize,
  onToggleSoftWrap,
  onToggleBottomPane,
  onResetWorkspace,
  onNotify,
}: HeaderToolbarProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, []);

  const showBlueRunPill = isRunning || activePreset.id === "intellij-samples";
  const runIconColor = showBlueRunPill ? "#FFFFFF" : "#57965C";
  const runTextColor = showBlueRunPill ? "#FFFFFF" : "#9DA0A8";

  const handleToggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <header ref={barRef} className={styles.headerToolbar}>
      {/* Left: Traffic Lights + Project Switcher + VCS */}
      <div className={styles.headerLeft}>
        <div className={styles.trafficLights} aria-label="Window controls">
          <button
            type="button"
            className={`${styles.trafficDot} ${styles.trafficRed}`}
            title="Reset workspace"
            aria-label="Reset workspace"
            onClick={onResetWorkspace}
          />
          <button
            type="button"
            className={`${styles.trafficDot} ${styles.trafficYellow}`}
            title="Minimize bottom panel"
            aria-label="Minimize bottom panel"
            onClick={onToggleBottomPane}
          />
          <button
            type="button"
            className={`${styles.trafficDot} ${styles.trafficGreen}`}
            title="Toggle fullscreen"
            aria-label="Toggle fullscreen"
            onClick={handleToggleFullscreen}
          />
        </div>

        {/* Project Switcher */}
        <div className={styles.headerDropdownWrap}>
          <button
            type="button"
            className={`${styles.projectButton} ${openMenu === "project" ? styles.projectButtonOpen : ""}`}
            onClick={() => setOpenMenu((m) => (m === "project" ? null : "project"))}
            title="Switch project workspace"
          >
            <span className={styles.projectBadge} style={{ background: activePreset.badgeGradient }}>
              {activePreset.badgeText}
            </span>
            <span>{activePreset.name}</span>
            <ChevronDownIcon size={12} color="#9DA0A8" />
          </button>

          {openMenu === "project" && (
            <div className={styles.popoverMenu} role="menu">
              <div className={styles.popoverHeader}>Recent Projects</div>
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="menuitem"
                  className={`${styles.popoverItem} ${p.id === activePreset.id ? styles.popoverItemActive : ""}`}
                  onClick={() => {
                    onSelectPreset(p.id);
                    setOpenMenu(null);
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span className={styles.projectBadge} style={{ background: p.badgeGradient, width: 16, height: 16, fontSize: 8 }}>
                      {p.badgeText}
                    </span>
                    <span>{p.name}</span>
                  </span>
                  <span className={styles.popoverShortcut}>{p.id === activePreset.id ? "Active" : ""}</span>
                </button>
              ))}
              <div className={styles.popoverDivider} />
              <button
                type="button"
                role="menuitem"
                className={styles.popoverItem}
                onClick={() => {
                  onOpenNewClassModal();
                  setOpenMenu(null);
                }}
              >
                <span>New Java Class...</span>
                <span className={styles.popoverShortcut}>Ctrl+N</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.popoverItem}
                onClick={() => {
                  onResetWorkspace();
                  setOpenMenu(null);
                }}
              >
                <span>Reload All from Disk</span>
              </button>
            </div>
          )}
        </div>

        {/* VCS Widget */}
        <div className={styles.headerDropdownWrap}>
          <button
            type="button"
            className={styles.vcsButton}
            onClick={() => setOpenMenu((m) => (m === "vcs" ? null : "vcs"))}
            title="Version Control"
          >
            {gitEnabled ? (
              <>
                <GitBranchIcon size={15} color="#DFE1E5" />
                <span>{gitBranch}</span>
                <span className={styles.incomingDot} title="Synced with origin">
                  ↙
                </span>
                <ChevronDownIcon size={12} color="#9DA0A8" />
              </>
            ) : (
              <>
                <span>Version control</span>
                <ChevronDownIcon size={12} color="#9DA0A8" />
              </>
            )}
          </button>

          {openMenu === "vcs" && (
            <div className={styles.popoverMenu} role="menu">
              {!gitEnabled ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.popoverItem}
                    onClick={() => {
                      onEnableGit();
                      setOpenMenu(null);
                    }}
                  >
                    <span>Enable Version Control Integration...</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.popoverItem}
                    onClick={() => {
                      onEnableGit();
                      setOpenMenu(null);
                    }}
                  >
                    <span>Create Git Repository...</span>
                  </button>
                </>
              ) : (
                <>
                  <div className={styles.popoverHeader}>Local Branches</div>
                  {["main", "feature/async-traces", "lab-exercise"].map((b) => (
                    <button
                      key={b}
                      type="button"
                      role="menuitem"
                      className={`${styles.popoverItem} ${b === gitBranch ? styles.popoverItemActive : ""}`}
                      onClick={() => {
                        onSwitchBranch(b);
                        setOpenMenu(null);
                      }}
                    >
                      <span>{b}</span>
                      <span className={styles.popoverShortcut}>{b === gitBranch ? "HEAD" : ""}</span>
                    </button>
                  ))}
                  <div className={styles.popoverDivider} />
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.popoverItem}
                    onClick={() => {
                      onOpenCommitPane();
                      setOpenMenu(null);
                    }}
                  >
                    <span>Commit...</span>
                    <span className={styles.popoverShortcut}>Ctrl+K</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.popoverItem}
                    onClick={() => {
                      onNotify("Git Update", "All files are up to date on origin/" + gitBranch + ".");
                      setOpenMenu(null);
                    }}
                  >
                    <span>Update Project</span>
                    <span className={styles.popoverShortcut}>Ctrl+T</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Run Configuration Widget + Code With Me + Search + Settings */}
      <div className={styles.headerRight}>
        <div className={`${styles.runWidgetGroup} ${showBlueRunPill ? styles.runWidgetGroupBlue : ""}`}>
          <div className={styles.headerDropdownWrap}>
            <button
              type="button"
              className={styles.runConfigTrigger}
              onClick={() => setOpenMenu((m) => (m === "runConfig" ? null : "runConfig"))}
              title="Select Run/Debug Configuration"
            >
              <RunConfigAppIcon size={15} color={runTextColor} />
              <span>{activeRunConfig.name}</span>
              <ChevronDownIcon size={12} color={runTextColor} />
            </button>

            {openMenu === "runConfig" && (
              <div className={`${styles.popoverMenu} ${styles.popoverMenuRight}`} role="menu">
                <div className={styles.popoverHeader}>Run Configurations</div>
                {runConfigs.map((cfg) => (
                  <button
                    key={cfg.id}
                    type="button"
                    role="menuitem"
                    className={`${styles.popoverItem} ${cfg.id === activeRunConfig.id ? styles.popoverItemActive : ""}`}
                    onClick={() => {
                      onSelectRunConfig(cfg.id);
                      setOpenMenu(null);
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <RunConfigAppIcon size={14} color="#548AF7" />
                      <span>{cfg.name}</span>
                    </span>
                    <span className={styles.popoverShortcut}>{cfg.id === activeRunConfig.id ? "✓" : ""}</span>
                  </button>
                ))}
                <div className={styles.popoverDivider} />
                <button
                  type="button"
                  role="menuitem"
                  className={styles.popoverItem}
                  onClick={() => {
                    onRunActiveConfig(false);
                    setOpenMenu(null);
                  }}
                >
                  <span>Run &apos;{activeRunConfig.name}&apos;</span>
                  <span className={styles.popoverShortcut}>Ctrl+R</span>
                </button>
              </div>
            )}
          </div>

          {showBlueRunPill && <span className={styles.runWidgetDivider} />}

          <button
            type="button"
            className={styles.headerIconBtn}
            title={`Run '${activeRunConfig.name}'`}
            aria-label={`Run ${activeRunConfig.name}`}
            onClick={() => onRunActiveConfig(false)}
          >
            <PlayOutlineIcon size={15} color={runIconColor} />
          </button>

          <button
            type="button"
            className={styles.headerIconBtn}
            title={`Debug '${activeRunConfig.name}'`}
            aria-label={`Debug ${activeRunConfig.name}`}
            onClick={() => onRunActiveConfig(true)}
          >
            <DebugBugIcon size={15} color={runIconColor} />
          </button>

          <div className={styles.headerDropdownWrap}>
            <button
              type="button"
              className={styles.headerIconBtn}
              title="More Run Actions"
              aria-label="More Run Actions"
              onClick={() => setOpenMenu((m) => (m === "runMore" ? null : "runMore"))}
            >
              <MoreVerticalIcon size={15} color={showBlueRunPill ? "#FFFFFF" : "#9DA0A8"} />
            </button>

            {openMenu === "runMore" && (
              <div className={`${styles.popoverMenu} ${styles.popoverMenuRight}`} role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className={styles.popoverItem}
                  onClick={() => {
                    onRunActiveConfig(false);
                    setOpenMenu(null);
                  }}
                >
                  <span>Run &apos;{activeRunConfig.name}&apos;</span>
                  <span className={styles.popoverShortcut}>Shift+F10</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.popoverItem}
                  onClick={() => {
                    onRunActiveConfig(true);
                    setOpenMenu(null);
                  }}
                >
                  <span>Debug &apos;{activeRunConfig.name}&apos;</span>
                  <span className={styles.popoverShortcut}>Shift+F9</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.popoverItem}
                  onClick={() => {
                    onRunActiveConfig(false);
                    onNotify("Coverage Runner", "Line coverage: 100% of executed statements in " + activeRunConfig.name + ".");
                    setOpenMenu(null);
                  }}
                >
                  <span>Run with Coverage</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={styles.headerSpacerSmall} />

        {/* Code With Me */}
        <div className={styles.headerDropdownWrap}>
          <button
            type="button"
            className={styles.headerIconBtn}
            title="Code With Me"
            aria-label="Code With Me"
            onClick={() => setOpenMenu((m) => (m === "cwm" ? null : "cwm"))}
          >
            <CodeWithMeIcon size={16} color="#CED0D6" />
          </button>

          {openMenu === "cwm" && (
            <div className={`${styles.popoverMenu} ${styles.popoverMenuRight}`} role="menu">
              <div className={styles.popoverHeader}>Code With Me</div>
              <button
                type="button"
                role="menuitem"
                className={styles.popoverItem}
                onClick={() => {
                  onNotify("Code With Me", "Session ready: invite link copied for collaborative pair programming.");
                  setOpenMenu(null);
                }}
              >
                <span>Enable Access &amp; Copy Link...</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.popoverItem}
                onClick={() => {
                  onNotify("Code With Me", "Lobby permissions set to Read & Edit for guest peers.");
                  setOpenMenu(null);
                }}
              >
                <span>Permissions: Full Sync</span>
              </button>
            </div>
          )}
        </div>

        {/* Search Everywhere */}
        <button
          type="button"
          className={styles.headerIconBtn}
          title="Search Everywhere (Double Shift / Ctrl+K)"
          aria-label="Search Everywhere"
          onClick={onOpenSearchEverywhere}
        >
          <SearchEverywhereIcon size={17} color="#CED0D6" />
        </button>

        {/* Settings */}
        <div className={styles.headerDropdownWrap}>
          <button
            type="button"
            className={styles.headerIconBtn}
            title="Settings"
            aria-label="Settings"
            onClick={() => setOpenMenu((m) => (m === "settings" ? null : "settings"))}
          >
            <SettingsGearIcon size={17} color="#CED0D6" />
          </button>

          {openMenu === "settings" && (
            <div className={`${styles.popoverMenu} ${styles.popoverMenuRight}`} role="menu">
              <div className={styles.popoverHeader}>Quick Settings</div>
              <button
                type="button"
                role="menuitem"
                className={styles.popoverItem}
                onClick={() => {
                  const next = editorFontSize === 13 ? 14 : editorFontSize === 14 ? 15 : 13;
                  onChangeFontSize(next);
                  setOpenMenu(null);
                }}
              >
                <span>Editor Font Size</span>
                <span className={styles.popoverShortcut}>{editorFontSize}px</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.popoverItem}
                onClick={() => {
                  onToggleSoftWrap();
                  setOpenMenu(null);
                }}
              >
                <span>Soft-Wrap Console &amp; Editor</span>
                <span className={styles.popoverShortcut}>{softWrap ? "On" : "Off"}</span>
              </button>
              <div className={styles.popoverDivider} />
              <button
                type="button"
                role="menuitem"
                className={styles.popoverItem}
                onClick={() => {
                  onOpenNewClassModal();
                  setOpenMenu(null);
                }}
              >
                <span>New Java Class...</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.popoverItem}
                onClick={() => {
                  onResetWorkspace();
                  setOpenMenu(null);
                }}
              >
                <span>Restore Default Layout &amp; Code</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
