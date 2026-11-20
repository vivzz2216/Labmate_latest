"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "./androidStudio.module.css";
import {
  EditorSplitMode,
  StudioDeviceProfile,
  StudioProjectPreset,
} from "@/lib/ide/androidStudioEngine";
import {
  AndroidHeadIcon,
  AndroidStudioLogoIcon,
  BuildRunConfigurationIcon,
  ChevronDownIcon,
  DebugBugIcon,
  DeviceManagerIcon,
  DownloadApkIcon,
  GradleSyncIcon,
  MoonIcon,
  RunPlayIcon,
  RunningDevicesStripeIcon,
  SdkManagerIcon,
  SearchEverywhereIcon,
  StopSquareIcon,
  SunIcon,
  VcsBranchIcon,
} from "./StudioIcons";
import type { BottomToolId, LeftToolId, RightToolId } from "./StudioStripes";

export type RunConfigurationId = "app" | "ExampleUnitTest";

interface StudioHeaderToolbarProps {
  projects: StudioProjectPreset[];
  activePreset: StudioProjectPreset;
  onSelectPreset: (presetId: string) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  activeBranch: string;
  branches: string[];
  onSelectBranch: (branch: string) => void;
  onCreateBranch: () => void;
  devices: StudioDeviceProfile[];
  activeDevice: StudioDeviceProfile;
  onSelectDevice: (deviceId: string) => void;
  runConfig: RunConfigurationId;
  onSelectRunConfig: (cfg: RunConfigurationId) => void;
  isAppRunning: boolean;
  isBuilding: boolean;
  hasApkArtifact: boolean;
  onNewProject: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRenameActiveFile: () => void;
  onSaveProject: () => void;
  onResetProject: () => void;
  onOpenFind: (replace: boolean) => void;
  onReformatCode: () => void;
  onToggleComment: () => void;
  onTriggerAutocomplete: () => void;
  onSwitchSplitMode: (mode: EditorSplitMode) => void;
  onOpenLeftTool: (tool: LeftToolId) => void;
  onOpenBottomTool: (tool: BottomToolId) => void;
  onOpenRightTool: (tool: RightToolId) => void;
  onSelectNamedFile: (kind: "main" | "manifest" | "layout") => void;
  onRunApp: (mode: "run" | "debug") => void;
  onStopApp: () => void;
  onBuildTask: (task: "compile" | "assembleDebug" | "clean" | "test") => void;
  onDownloadApk: () => void;
  onRunGitStatusTerminal: () => void;
  onOpenDeviceManager: () => void;
  onOpenCapabilities: () => void;
  onOpenSearchEverywhere: () => void;
  onOpenShortcuts: () => void;
}

type TopMenuKey =
  | "File"
  | "Edit"
  | "View"
  | "Navigate"
  | "Code"
  | "Refactor"
  | "Build"
  | "Run"
  | "Tools"
  | "Git"
  | "Help";

const TOP_MENU_NAMES: TopMenuKey[] = [
  "File",
  "Edit",
  "View",
  "Navigate",
  "Code",
  "Refactor",
  "Build",
  "Run",
  "Tools",
  "Git",
  "Help",
];

interface MenuEntry {
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  divider?: boolean;
  onClick?: () => void;
}

export function StudioHeaderToolbar({
  projects,
  activePreset,
  onSelectPreset,
  theme,
  onToggleTheme,
  activeBranch,
  branches,
  onSelectBranch,
  onCreateBranch,
  devices,
  activeDevice,
  onSelectDevice,
  runConfig,
  onSelectRunConfig,
  isAppRunning,
  isBuilding,
  hasApkArtifact,
  onNewProject,
  onNewFile,
  onNewFolder,
  onRenameActiveFile,
  onSaveProject,
  onResetProject,
  onOpenFind,
  onReformatCode,
  onToggleComment,
  onTriggerAutocomplete,
  onSwitchSplitMode,
  onOpenLeftTool,
  onOpenBottomTool,
  onOpenRightTool,
  onSelectNamedFile,
  onRunApp,
  onStopApp,
  onBuildTask,
  onDownloadApk,
  onRunGitStatusTerminal,
  onOpenDeviceManager,
  onOpenCapabilities,
  onOpenSearchEverywhere,
  onOpenShortcuts,
}: StudioHeaderToolbarProps) {
  const [openMenu, setOpenMenu] = useState<
    "project" | "vcs" | "device" | "runConfig" | null
  >(null);
  const [openTopMenu, setOpenTopMenu] = useState<TopMenuKey | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setOpenTopMenu(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setOpenTopMenu(null);
      }
    };
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const topMenuItems: Record<TopMenuKey, MenuEntry[]> = {
    File: [
      { label: "New Project...", onClick: onNewProject },
      { label: "New File / Activity...", onClick: onNewFile },
      { label: "New Folder...", onClick: onNewFolder },
      { divider: true },
      { label: "Save All Changes", shortcut: "Ctrl+S", onClick: onSaveProject },
      { label: "Sync & Validate Project", onClick: () => onBuildTask("compile") },
      { label: "Reset Project to Template", onClick: onResetProject },
      { divider: true },
      {
        label: theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme",
        onClick: onToggleTheme,
      },
    ],
    Edit: [
      { label: "Find...", shortcut: "Ctrl+F", onClick: () => onOpenFind(false) },
      { label: "Replace...", shortcut: "Ctrl+H", onClick: () => onOpenFind(true) },
      { divider: true },
      { label: "Toggle Line Comment", shortcut: "Ctrl+/", onClick: onToggleComment },
      { label: "Reformat File Code", shortcut: "Ctrl+Alt+L", onClick: onReformatCode },
    ],
    View: [
      { label: "Tool Window: Project", shortcut: "Alt+1", onClick: () => onOpenLeftTool("project") },
      { label: "Tool Window: Build", onClick: () => onOpenBottomTool("build") },
      { label: "Tool Window: Logcat", shortcut: "Alt+6", onClick: () => onOpenBottomTool("logcat") },
      { label: "Tool Window: Problems", onClick: () => onOpenBottomTool("problems") },
      { label: "Tool Window: Terminal", shortcut: "Alt+F12", onClick: () => onOpenBottomTool("terminal") },
      { label: "Tool Window: Running Devices", onClick: () => onOpenRightTool("runningDevices") },
      { divider: true },
      { label: "Editor: Code Only", onClick: () => onSwitchSplitMode("Code") },
      { label: "Editor: Split (Code + Design)", onClick: () => onSwitchSplitMode("Split") },
      { label: "Editor: Design Only", onClick: () => onSwitchSplitMode("Design") },
      { divider: true },
      {
        label: theme === "dark" ? "Theme: IntelliJ Light" : "Theme: New UI Dark",
        onClick: onToggleTheme,
      },
    ],
    Navigate: [
      { label: "Search Everywhere...", shortcut: "Double Shift", onClick: onOpenSearchEverywhere },
      { divider: true },
      { label: "Open MainActivity", onClick: () => onSelectNamedFile("main") },
      { label: "Open activity_main.xml", onClick: () => onSelectNamedFile("layout") },
      { label: "Open AndroidManifest.xml", onClick: () => onSelectNamedFile("manifest") },
    ],
    Code: [
      { label: "Show Autocomplete Suggestions", shortcut: "Ctrl+Space", onClick: onTriggerAutocomplete },
      { label: "Reformat File", shortcut: "Ctrl+Alt+L", onClick: onReformatCode },
      { label: "Comment with Line Comment", shortcut: "Ctrl+/", onClick: onToggleComment },
      { divider: true },
      { label: "Inspect Project Problems", onClick: () => onOpenBottomTool("problems") },
    ],
    Refactor: [
      { label: "Rename Current File...", shortcut: "Shift+F6", onClick: onRenameActiveFile },
    ],
    Build: [
      { label: "Make Project (Compile Java & XML)", shortcut: "Ctrl+F9", onClick: () => onBuildTask("compile") },
      { label: "Build APK(s) (:app:assembleDebug)", onClick: () => onBuildTask("assembleDebug") },
      { label: "Clean Project", onClick: () => onBuildTask("clean") },
      { label: "Run Unit Tests (:app:test)", onClick: () => onBuildTask("test") },
      { divider: true },
      {
        label: "Download Built app-debug.apk",
        disabled: !hasApkArtifact,
        onClick: onDownloadApk,
      },
    ],
    Run: [
      { label: `Run '${runConfig}'`, shortcut: "Shift+F10", onClick: () => onRunApp("run") },
      { label: `Debug '${runConfig}' (Trace Logs)`, shortcut: "Shift+F9", onClick: () => onRunApp("debug") },
      { label: "Run Unit Tests", onClick: () => onBuildTask("test") },
      {
        label: "Stop Active Session",
        shortcut: "Ctrl+F2",
        disabled: !isAppRunning,
        onClick: onStopApp,
      },
    ],
    Tools: [
      { label: "Device Manager", onClick: onOpenDeviceManager },
      { label: "Running Devices Emulator", onClick: () => onOpenRightTool("runningDevices") },
      { label: "Gradle Tasks", onClick: () => onOpenRightTool("gradle") },
      { divider: true },
      { label: "Build & Runtime Capabilities...", onClick: onOpenCapabilities },
    ],
    Git: [
      { label: "Show Modified Files (Git Panel)", shortcut: "Alt+9", onClick: () => onOpenBottomTool("vcs") },
      { label: "Run git status in Terminal", onClick: onRunGitStatusTerminal },
      { label: "Create Local Branch...", onClick: onCreateBranch },
      { divider: true },
      { label: "Revert Unsaved Changes to Template", onClick: onResetProject },
    ],
    Help: [
      { label: "Android Practicals Guide & Shortcuts", onClick: onOpenShortcuts },
      { label: "Build & Sandbox Capabilities", onClick: onOpenCapabilities },
    ],
  };

  return (
    <div ref={wrapRef}>
      {/* Authentic Desktop Main Menu Bar */}
      <nav className={styles.menuBar} aria-label="Main Menu Bar">
        {TOP_MENU_NAMES.map((menuKey) => {
          const isOpen = openTopMenu === menuKey;
          return (
            <div key={menuKey} className={styles.menuBarItemWrap}>
              <button
                type="button"
                className={`${styles.menuBarBtn} ${isOpen ? styles.menuBarBtnOpen : ""}`}
                onClick={() => {
                  setOpenMenu(null);
                  setOpenTopMenu((prev) => (prev === menuKey ? null : menuKey));
                }}
                onMouseEnter={() => {
                  if (openTopMenu !== null) {
                    setOpenTopMenu(menuKey);
                  }
                }}
                aria-expanded={isOpen}
              >
                {menuKey}
              </button>
              {isOpen && (
                <div className={styles.menuBarDropdown} role="menu">
                  {topMenuItems[menuKey].map((item, idx) =>
                    item.divider ? (
                      <div key={`div-${idx}`} className={styles.dropdownDivider} />
                    ) : (
                      <button
                        key={item.label}
                        type="button"
                        role="menuitem"
                        disabled={item.disabled}
                        className={styles.menuDropdownItem}
                        onClick={() => {
                          setOpenTopMenu(null);
                          if (item.onClick) item.onClick();
                        }}
                      >
                        <span>{item.label}</span>
                        {item.shortcut && <span className={styles.menuShortcut}>{item.shortcut}</span>}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Main Toolbar */}
      <header className={styles.mainHeader}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            className={styles.headerBrandBtn}
            title="Android Studio — LabMate Edition"
            onClick={onOpenShortcuts}
          >
            <AndroidStudioLogoIcon size={20} />
          </button>

          {/* Project Switcher + New Project */}
          <div className={styles.headerDropdownWrap}>
            <button
              type="button"
              className={`${styles.projectButton} ${openMenu === "project" ? styles.projectButtonOpen : ""}`}
              onClick={() => {
                setOpenTopMenu(null);
                setOpenMenu((p) => (p === "project" ? null : "project"));
              }}
              title={`Project: ${activePreset.name} (${activePreset.packageName})`}
            >
              <span className={styles.projectMonogram} style={{ background: activePreset.monogramBg }}>
                {activePreset.monogram}
              </span>
              <span>{activePreset.name}</span>
              <ChevronDownIcon size={13} />
            </button>
            {openMenu === "project" && (
              <div className={styles.dropdownMenu}>
                <div className={styles.dropdownSectionLabel}>Android Projects</div>
                {projects.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={styles.dropdownItem}
                    onClick={() => {
                      onSelectPreset(preset.id);
                      setOpenMenu(null);
                    }}
                  >
                    <span className={styles.dropdownItemLeft}>
                      <span
                        className={styles.projectMonogram}
                        style={{ background: preset.monogramBg, width: 18, height: 18, fontSize: 9 }}
                      >
                        {preset.monogram}
                      </span>
                      <span>{preset.name}</span>
                    </span>
                    <span className={styles.dropdownMeta}>
                      {preset.id === activePreset.id ? "Active" : preset.language === "java" ? "Java" : "Kotlin"}
                    </span>
                  </button>
                ))}
                <div className={styles.dropdownDivider} />
                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => {
                    setOpenMenu(null);
                    onNewProject();
                  }}
                >
                  <span>+ New Android Project...</span>
                </button>
              </div>
            )}
          </div>

          {/* VCS Branch Widget */}
          <div className={styles.headerDropdownWrap}>
            <button
              type="button"
              className={styles.vcsButton}
              onClick={() => {
                setOpenTopMenu(null);
                setOpenMenu((p) => (p === "vcs" ? null : "vcs"));
              }}
              title={`Git Branch: ${activeBranch}`}
            >
              <VcsBranchIcon size={15} />
              <span>{activeBranch}</span>
              <ChevronDownIcon size={13} />
            </button>
            {openMenu === "vcs" && (
              <div className={styles.dropdownMenu}>
                <div className={styles.dropdownSectionLabel}>Git Branches</div>
                {branches.map((branch) => (
                  <button
                    key={branch}
                    type="button"
                    className={styles.dropdownItem}
                    onClick={() => {
                      onSelectBranch(branch);
                      setOpenMenu(null);
                    }}
                  >
                    <span className={styles.dropdownItemLeft}>
                      <VcsBranchIcon size={14} />
                      <span>{branch}</span>
                    </span>
                    <span className={styles.dropdownMeta}>{branch === activeBranch ? "HEAD" : "Switch"}</span>
                  </button>
                ))}
                <div className={styles.dropdownDivider} />
                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => {
                    setOpenMenu(null);
                    onCreateBranch();
                  }}
                >
                  <span>+ New Branch...</span>
                </button>
                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => {
                    setOpenMenu(null);
                    onOpenBottomTool("vcs");
                  }}
                >
                  <span>View Modified Files</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={styles.headerRight}>
          {/* Target Device Dropdown */}
          <div className={styles.headerDropdownWrap}>
            <button
              type="button"
              className={`${styles.deviceSelectorBtn} ${openMenu === "device" ? styles.deviceSelectorBtnOpen : ""}`}
              onClick={() => {
                setOpenTopMenu(null);
                setOpenMenu((p) => (p === "device" ? null : "device"));
              }}
              title={`Target Device: ${activeDevice.name} (API ${activeDevice.apiLevel})`}
            >
              <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                <RunningDevicesStripeIcon size={16} />
                <span
                  style={{
                    position: "absolute",
                    right: -1,
                    bottom: -1,
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: activeDevice.booted ? "var(--as-android-green)" : "var(--as-text-muted)",
                    border: "1px solid var(--as-bg-chrome)",
                  }}
                />
              </span>
              <span>{activeDevice.name}</span>
              <ChevronDownIcon size={13} />
            </button>
            {openMenu === "device" && (
              <div className={`${styles.dropdownMenu} ${styles.dropdownMenuRight}`} style={{ minWidth: 268 }}>
                <div className={styles.dropdownSectionLabel}>Virtual Devices (Browser Runtime)</div>
                {devices.map((dev) => (
                  <button
                    key={dev.id}
                    type="button"
                    className={styles.dropdownItem}
                    onClick={() => {
                      onSelectDevice(dev.id);
                      setOpenMenu(null);
                    }}
                  >
                    <span className={styles.dropdownItemLeft}>
                      <RunningDevicesStripeIcon size={15} />
                      <span>{dev.name}</span>
                    </span>
                    <span className={styles.dropdownMeta}>
                      {dev.androidVersion} (API {dev.apiLevel})
                    </span>
                  </button>
                ))}
                <div className={styles.dropdownDivider} />
                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => {
                    setOpenMenu(null);
                    onOpenDeviceManager();
                  }}
                >
                  <span className={styles.dropdownItemLeft}>
                    <DeviceManagerIcon size={15} />
                    <span>Open Device Manager...</span>
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Run Configuration + Run / Debug / Stop */}
          <div className={`${styles.runWidgetGroup} ${isAppRunning ? styles.runWidgetRunning : ""}`}>
            <div className={styles.headerDropdownWrap}>
              <button
                type="button"
                className={styles.runConfigTrigger}
                onClick={() => {
                  setOpenTopMenu(null);
                  setOpenMenu((p) => (p === "runConfig" ? null : "runConfig"));
                }}
                title="Run Configuration"
              >
                <AndroidHeadIcon size={15} />
                <span>{runConfig}</span>
                <ChevronDownIcon size={12} />
              </button>
              {openMenu === "runConfig" && (
                <div className={`${styles.dropdownMenu} ${styles.dropdownMenuRight}`}>
                  <div className={styles.dropdownSectionLabel}>Configurations</div>
                  {(["app", "ExampleUnitTest"] as RunConfigurationId[]).map((cfg) => (
                    <button
                      key={cfg}
                      type="button"
                      className={styles.dropdownItem}
                      onClick={() => {
                        onSelectRunConfig(cfg);
                        setOpenMenu(null);
                      }}
                    >
                      <span className={styles.dropdownItemLeft}>
                        <AndroidHeadIcon size={14} />
                        <span>{cfg}</span>
                      </span>
                      <span className={styles.dropdownMeta}>{cfg === "app" ? "Android App" : "JUnit4"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className={styles.toolbarIconBtn}
              title={`Run '${runConfig}' (Shift+F10)`}
              aria-label={`Run ${runConfig}`}
              onClick={() => {
                if (runConfig === "ExampleUnitTest") {
                  onBuildTask("test");
                } else {
                  onRunApp("run");
                }
              }}
            >
              <RunPlayIcon size={15} />
            </button>

            <button
              type="button"
              className={styles.toolbarIconBtn}
              title="Debug 'app' with Verbose Lifecycle Trace (Shift+F9)"
              aria-label="Debug app"
              onClick={() => onRunApp("debug")}
            >
              <DebugBugIcon size={15} />
            </button>

            {isAppRunning && (
              <button
                type="button"
                className={styles.toolbarIconBtn}
                title={`Stop '${runConfig}' (Ctrl+F2)`}
                aria-label={`Stop ${runConfig}`}
                onClick={onStopApp}
              >
                <StopSquareIcon size={14} active />
              </button>
            )}
          </div>

          <span className={styles.toolbarSeparator} />

          <button
            type="button"
            className={`${styles.toolbarIconBtn} ${isBuilding ? styles.toolbarIconBtnActive : ""}`}
            title="Make Project (Compile Java & XML) (Ctrl+F9)"
            aria-label="Make Project"
            disabled={isBuilding}
            onClick={() => onBuildTask("compile")}
          >
            <BuildRunConfigurationIcon size={17} />
          </button>

          <button
            type="button"
            className={styles.toolbarIconBtn}
            title="Build APK Archive (:app:assembleDebug)"
            aria-label="Build APK"
            disabled={isBuilding}
            onClick={() => onBuildTask("assembleDebug")}
          >
            <DownloadApkIcon size={16} />
          </button>

          <button
            type="button"
            className={`${styles.toolbarIconBtn} ${isBuilding ? styles.toolbarIconBtnActive : ""}`}
            title="Validate Project Resources & Sync"
            aria-label="Sync Project"
            disabled={isBuilding}
            onClick={() => onBuildTask("compile")}
          >
            <GradleSyncIcon size={17} />
          </button>

          <button
            type="button"
            className={styles.toolbarIconBtn}
            title="Device Manager"
            aria-label="Device Manager"
            onClick={onOpenDeviceManager}
          >
            <DeviceManagerIcon size={17} />
          </button>

          <button
            type="button"
            className={styles.toolbarIconBtn}
            title="Build & Sandbox Capabilities"
            aria-label="Runtime Capabilities"
            onClick={onOpenCapabilities}
          >
            <SdkManagerIcon size={17} />
          </button>

          <span className={styles.toolbarSeparator} />

          <button
            type="button"
            className={styles.toolbarIconBtn}
            title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
            aria-label="Toggle IDE Theme"
            onClick={onToggleTheme}
          >
            {theme === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
          </button>

          <button
            type="button"
            className={styles.toolbarIconBtn}
            title="Search Everywhere (Double Shift)"
            aria-label="Search Everywhere"
            onClick={onOpenSearchEverywhere}
          >
            <SearchEverywhereIcon size={17} />
          </button>
        </div>
      </header>
    </div>
  );
}
