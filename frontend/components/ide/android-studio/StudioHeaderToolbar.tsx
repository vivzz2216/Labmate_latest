"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "./androidStudio.module.css";
import {
  StudioDeviceProfile,
  StudioProjectPreset,
  STUDIO_PRESETS,
} from "@/lib/ide/androidStudioEngine";
import {
  AndroidHeadIcon,
  AndroidStudioLogoIcon,
  ApplyAllChangesIcon,
  ApplyCodeSwapIcon,
  AttachDebuggerIcon,
  BuildRunConfigurationIcon,
  ChevronDownIcon,
  DebugBugIcon,
  DeviceManagerIcon,
  GradleSyncIcon,
  HamburgerMenuIcon,
  MoreVerticalIcon,
  RunPlayIcon,
  RunningDevicesStripeIcon,
  SdkManagerIcon,
  SearchEverywhereIcon,
  SettingsGearIcon,
  StopSquareIcon,
  VcsBranchIcon,
} from "./StudioIcons";

export type RunConfigurationId = "app" | "ExampleUnitTest" | "ExampleInstrumentedTest";

interface StudioHeaderToolbarProps {
  activePreset: StudioProjectPreset;
  onSelectPreset: (presetId: string) => void;
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
  isGradleSyncing: boolean;
  onRunApp: (mode: "run" | "debug" | "coverage" | "profile") => void;
  onStopApp: () => void;
  onAssembleProject: () => void;
  onApplyChanges: (codeOnly: boolean) => void;
  onAttachDebugger: () => void;
  onSyncGradle: () => void;
  onOpenDeviceManager: () => void;
  onOpenSdkManager: () => void;
  onOpenSearchEverywhere: () => void;
  onOpenSettings: () => void;
  onShowToast: (msg: string) => void;
}

export function StudioHeaderToolbar({
  activePreset,
  onSelectPreset,
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
  isGradleSyncing,
  onRunApp,
  onStopApp,
  onAssembleProject,
  onApplyChanges,
  onAttachDebugger,
  onSyncGradle,
  onOpenDeviceManager,
  onOpenSdkManager,
  onOpenSearchEverywhere,
  onOpenSettings,
  onShowToast,
}: StudioHeaderToolbarProps) {
  const [openMenu, setOpenMenu] = useState<
    "main" | "project" | "vcs" | "device" | "runConfig" | "runMore" | null
  >(null);
  const barRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  const toggleMenu = (key: typeof openMenu) => {
    setOpenMenu((prev) => (prev === key ? null : key));
  };

  return (
    <header className={styles.mainHeader} ref={barRef}>
      {/* Left: Main Menu, Brand Logo, Project Widget, VCS Widget */}
      <div className={styles.headerLeft}>
        <div className={styles.headerDropdownWrap}>
          <button
            type="button"
            className={styles.headerMenuBtn}
            title="Main Menu"
            aria-label="Main Menu"
            onClick={() => toggleMenu("main")}
          >
            <HamburgerMenuIcon size={18} />
          </button>
          {openMenu === "main" && (
            <div className={styles.dropdownMenu}>
              <div className={styles.dropdownSectionLabel}>Android Studio Ladybug | 2024.2.1</div>
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  onSyncGradle();
                }}
              >
                <span>File → Sync Project with Gradle Files</span>
                <span className={styles.dropdownMeta}>Ctrl+Shift+O</span>
              </button>
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  onAssembleProject();
                }}
              >
                <span>Build → Make Project (:app:assembleDebug)</span>
                <span className={styles.dropdownMeta}>Ctrl+F9</span>
              </button>
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  onRunApp("run");
                }}
              >
                <span>Run → Run &apos;{runConfig}&apos;</span>
                <span className={styles.dropdownMeta}>Shift+F10</span>
              </button>
              <div className={styles.dropdownDivider} />
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  onOpenSdkManager();
                }}
              >
                <span>Tools → SDK Manager...</span>
              </button>
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  onOpenDeviceManager();
                }}
              >
                <span>Tools → Device Manager</span>
              </button>
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  onOpenSearchEverywhere();
                }}
              >
                <span>Navigate → Search Everywhere</span>
                <span className={styles.dropdownMeta}>Double Shift</span>
              </button>
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  onOpenSettings();
                }}
              >
                <span>File → Settings...</span>
                <span className={styles.dropdownMeta}>Ctrl+Alt+S</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className={styles.headerBrandBtn}
          title="Google Android Studio Ladybug (New UI Dark)"
          onClick={() => onShowToast("Android Studio Ladybug | 2024.2.1 Patch 2 (AGP 8.7.2, Kotlin 2.0.21)")}
        >
          <AndroidStudioLogoIcon size={20} />
        </button>

        {/* Project Widget */}
        <div className={styles.headerDropdownWrap}>
          <button
            type="button"
            className={`${styles.projectButton} ${openMenu === "project" ? styles.projectButtonOpen : ""}`}
            onClick={() => toggleMenu("project")}
            title={`Project: ${activePreset.name} (${activePreset.packageName})`}
          >
            <span
              className={styles.projectMonogram}
              style={{ background: activePreset.monogramBg }}
            >
              {activePreset.monogram}
            </span>
            <span>{activePreset.name}</span>
            <ChevronDownIcon size={13} />
          </button>
          {openMenu === "project" && (
            <div className={styles.dropdownMenu}>
              <div className={styles.dropdownSectionLabel}>Recent Android Projects</div>
              {STUDIO_PRESETS.map((preset) => (
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
                    {preset.id === activePreset.id ? "Active" : preset.packageName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* VCS Branch Widget */}
        <div className={styles.headerDropdownWrap}>
          <button
            type="button"
            className={styles.vcsButton}
            onClick={() => toggleMenu("vcs")}
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
                  <span className={styles.dropdownMeta}>
                    {branch === activeBranch ? "HEAD" : "Checkout"}
                  </span>
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
                  onShowToast(`Git Fetch & Pull completed on origin/${activeBranch} (up to date)`);
                }}
              >
                <span>Update Project (git pull)</span>
                <span className={styles.dropdownMeta}>Ctrl+T</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: Target Device + Run Config + Run/Debug + Make/ApplyChanges/GradleSync + Search/Settings */}
      <div className={styles.headerRight}>
        {/* Target Device Dropdown */}
        <div className={styles.headerDropdownWrap}>
          <button
            type="button"
            className={`${styles.deviceSelectorBtn} ${openMenu === "device" ? styles.deviceSelectorBtnOpen : ""}`}
            onClick={() => toggleMenu("device")}
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
                  background: activeDevice.booted ? "#3DDC84" : "#868A91",
                  border: "1px solid #2B2D30",
                }}
              />
            </span>
            <span>{activeDevice.name}</span>
            <ChevronDownIcon size={13} />
          </button>
          {openMenu === "device" && (
            <div className={`${styles.dropdownMenu} ${styles.dropdownMenuRight}`} style={{ minWidth: 280 }}>
              <div className={styles.dropdownSectionLabel}>Running &amp; Available Devices</div>
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
                  <span>Device Manager...</span>
                </span>
              </button>
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setOpenMenu(null);
                  onShowToast("Wi-Fi Pairing QR & 6-digit pairing dialog ready (ADB over Wi-Fi)");
                }}
              >
                <span>Pair Devices Using Wi-Fi</span>
              </button>
            </div>
          )}
        </div>

        {/* Run Configuration + Run / Debug / Stop / More */}
        <div className={`${styles.runWidgetGroup} ${isAppRunning ? styles.runWidgetRunning : ""}`}>
          <div className={styles.headerDropdownWrap}>
            <button
              type="button"
              className={styles.runConfigTrigger}
              onClick={() => toggleMenu("runConfig")}
              title="Run/Debug Configuration"
            >
              <AndroidHeadIcon size={15} />
              <span>{runConfig}</span>
              <ChevronDownIcon size={12} />
            </button>
            {openMenu === "runConfig" && (
              <div className={`${styles.dropdownMenu} ${styles.dropdownMenuRight}`}>
                <div className={styles.dropdownSectionLabel}>Android App &amp; Tests</div>
                {(["app", "ExampleUnitTest", "ExampleInstrumentedTest"] as RunConfigurationId[]).map(
                  (cfg) => (
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
                      <span className={styles.dropdownMeta}>
                        {cfg === "app" ? "Android App" : cfg === "ExampleUnitTest" ? "JUnit4" : "AndroidJUnit4"}
                      </span>
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            className={styles.toolbarIconBtn}
            title={`Run '${runConfig}' (Shift+F10)`}
            aria-label={`Run ${runConfig}`}
            onClick={() => onRunApp("run")}
          >
            <RunPlayIcon size={15} />
          </button>

          <button
            type="button"
            className={styles.toolbarIconBtn}
            title={`Debug '${runConfig}' (Shift+F9)`}
            aria-label={`Debug ${runConfig}`}
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

          <div className={styles.headerDropdownWrap}>
            <button
              type="button"
              className={styles.toolbarIconBtn}
              title="More Run/Profile Actions"
              aria-label="More Run Actions"
              onClick={() => toggleMenu("runMore")}
            >
              <MoreVerticalIcon size={15} />
            </button>
            {openMenu === "runMore" && (
              <div className={`${styles.dropdownMenu} ${styles.dropdownMenuRight}`}>
                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => {
                    setOpenMenu(null);
                    onRunApp("profile");
                  }}
                >
                  <span>Profile &apos;{runConfig}&apos; (Low Overhead)</span>
                </button>
                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => {
                    setOpenMenu(null);
                    onRunApp("coverage");
                  }}
                >
                  <span>Run &apos;{runConfig}&apos; with Coverage</span>
                </button>
                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => {
                    setOpenMenu(null);
                    onStopApp();
                  }}
                >
                  <span>Stop &apos;{runConfig}&apos;</span>
                  <span className={styles.dropdownMeta}>Ctrl+F2</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <span className={styles.toolbarSeparator} />

        {/* Android Studio Specific Toolbar Actions */}
        <button
          type="button"
          className={styles.toolbarIconBtn}
          title="Make Run Configuration (:app:assembleDebug)"
          aria-label="Make Run Configuration"
          onClick={onAssembleProject}
        >
          <BuildRunConfigurationIcon size={17} />
        </button>

        <button
          type="button"
          className={styles.toolbarIconBtn}
          title="Apply Changes and Restart Activity (Ctrl+F10)"
          aria-label="Apply Changes and Restart Activity"
          onClick={() => onApplyChanges(false)}
        >
          <ApplyAllChangesIcon size={17} />
        </button>

        <button
          type="button"
          className={styles.toolbarIconBtn}
          title="Apply Code Changes (Ctrl+Alt+F10)"
          aria-label="Apply Code Changes"
          onClick={() => onApplyChanges(true)}
        >
          <ApplyCodeSwapIcon size={17} />
        </button>

        <button
          type="button"
          className={styles.toolbarIconBtn}
          title="Attach Debugger to Android Process"
          aria-label="Attach Debugger to Android Process"
          onClick={onAttachDebugger}
        >
          <AttachDebuggerIcon size={17} />
        </button>

        <button
          type="button"
          className={`${styles.toolbarIconBtn} ${isGradleSyncing ? styles.toolbarIconBtnActive : ""}`}
          title="Sync Project with Gradle Files"
          aria-label="Sync Project with Gradle Files"
          onClick={onSyncGradle}
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
          title="SDK Manager"
          aria-label="SDK Manager"
          onClick={onOpenSdkManager}
        >
          <SdkManagerIcon size={17} />
        </button>

        <span className={styles.toolbarSeparator} />

        <button
          type="button"
          className={styles.toolbarIconBtn}
          title="Search Everywhere (Double Shift)"
          aria-label="Search Everywhere"
          onClick={onOpenSearchEverywhere}
        >
          <SearchEverywhereIcon size={17} />
        </button>

        <button
          type="button"
          className={styles.toolbarIconBtn}
          title="IDE and Project Settings"
          aria-label="IDE and Project Settings"
          onClick={onOpenSettings}
        >
          <SettingsGearIcon size={17} />
        </button>

        <button
          type="button"
          className={styles.profilePillBtn}
          title="Google Developer Account (Signed in)"
          onClick={() => onShowToast("Signed in to Google Developer Profile & Firebase App Quality Insights")}
        >
          GD
        </button>
      </div>
    </header>
  );
}
