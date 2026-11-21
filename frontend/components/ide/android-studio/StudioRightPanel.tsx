"use client";

import React, { useState } from "react";
import styles from "./androidStudio.module.css";
import { RightToolId } from "./StudioStripes";
import {
  StudioDeviceProfile,
  PreviewWidgetNode,
} from "@/lib/ide/androidStudioEngine";
import type { ScreenState } from "@/lib/ide/kotlin/android";
import { EmulatorScreen } from "./EmulatorScreen";
import {
  AndroidHeadIcon,
  RunningDevicesStripeIcon,
  GradleFileIcon,
  GradleSyncIcon,
  RunPlayIcon,
  StopSquareIcon,
  MoreVerticalIcon,
  FolderDarkIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  GeminiSparkleIcon,
} from "./StudioIcons";

export interface GradleTaskItem {
  id: string;
  name: string;
  group: "build" | "verification" | "install" | "android" | "help";
  description: string;
}

export const DEFAULT_GRADLE_TASKS: GradleTaskItem[] = [
  { id: "gt-1", name: "assembleDebug", group: "build", description: "Assembles main debug APK" },
  { id: "gt-2", name: "assembleRelease", group: "build", description: "Assembles main release APK" },
  { id: "gt-3", name: "clean", group: "build", description: "Deletes the build directory" },
  { id: "gt-4", name: "testDebugUnitTest", group: "verification", description: "Runs unit tests for debug build" },
  { id: "gt-5", name: "lintDebug", group: "verification", description: "Runs Android lint on debug variant" },
  { id: "gt-6", name: "installDebug", group: "install", description: "Installs the Debug build on connected device" },
  { id: "gt-7", name: "signingReport", group: "android", description: "Displays signing info for each variant" },
  { id: "gt-8", name: "dependencies", group: "help", description: "Displays all dependencies declared in :app" },
];

interface StudioRightPanelProps {
  activeTab: RightToolId | null;
  devices: StudioDeviceProfile[];
  activeDeviceId: string;
  onSelectDevice: (id: string) => void;
  onToggleDeviceOnline: (id: string) => void;
  onCreateVirtualDevice: (name: string, apiLevel: number) => void;
  previewTree: PreviewWidgetNode;
  activeAppRunning: boolean;
  onTriggerEmulatorInteraction: (message: string) => void;
  screen?: ScreenState | null;
  onEmuClick?: (uid: string) => void;
  onEmuInput?: (uid: string, text: string) => void;
  onEmuToggle?: (uid: string, checked: boolean) => void;
  onEmuDialogButton?: (id: number) => void;
  onEmuDismissCrash?: () => void;
  gradleTasks: GradleTaskItem[];
  onExecuteGradleTask: (taskName: string) => void;
  onSyncGradle: () => void;
  onClosePanel: () => void;
}

export const StudioRightPanel: React.FC<StudioRightPanelProps> = ({
  activeTab,
  devices,
  activeDeviceId,
  onSelectDevice,
  onToggleDeviceOnline,
  onCreateVirtualDevice,
  previewTree,
  activeAppRunning,
  onTriggerEmulatorInteraction,
  screen,
  onEmuClick,
  onEmuInput,
  onEmuToggle,
  onEmuDialogButton,
  onEmuDismissCrash,
  gradleTasks,
  onExecuteGradleTask,
  onSyncGradle,
  onClosePanel,
}) => {
  const [emuClicks, setEmuClicks] = useState(0);
  const [deviceRotated, setDeviceRotated] = useState(false);
  const [expandedTaskGroups, setExpandedTaskGroups] = useState<Set<string>>(
    () => new Set(["build", "verification", "install"])
  );
  const [creatingAvd, setCreatingAvd] = useState(false);
  const [newAvdName, setNewAvdName] = useState("Pixel 9 Pro XL API 35");
  const [newAvdApi, setNewAvdApi] = useState(35);

  if (!activeTab) return null;

  const activeDevice = devices.find((d) => d.id === activeDeviceId) ?? devices[0];

  const textNodes = previewTree.children.filter(
    (c) => c.type === "Text" || c.type === "TextView"
  );
  const btnNode = previewTree.children.find((c) => c.type === "Button");
  const greetingText = textNodes[0]?.text ?? "Hello Android!";
  const subtitleText =
    textNodes[1]?.text ?? "Jetpack Compose Material3 • API 35";
  const buttonLabel = btnNode?.text ?? "Tap Action";

  const toggleGroup = (g: string) => {
    setExpandedTaskGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const groups = ["build", "verification", "install", "android", "help"] as const;

  const titleLabel =
    activeTab === "runningDevices"
      ? "Running Devices"
      : activeTab === "deviceManager"
      ? "Device Manager"
      : activeTab === "gradle"
      ? "Gradle"
      : activeTab === "gemini"
      ? "Gemini in Android Studio"
      : "Notifications";

  return (
    <aside className={styles.rightDock} aria-label="Right Tool Window">
      {/* Header */}
      <div className={styles.toolWindowHeader}>
        <div className={styles.toolWindowTitleGroup}>
          <span style={{ fontWeight: 600, fontSize: 12 }}>{titleLabel}</span>
          {activeTab === "runningDevices" && activeDevice && (
            <span
              style={{
                fontSize: 11,
                color: "#6F737A",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <RunningDevicesStripeIcon size={13} />
              {activeDevice.name}
            </span>
          )}
        </div>
        <div className={styles.toolWindowActions}>
          {activeTab === "gradle" && (
            <button
              type="button"
              className={styles.iconBtn}
              title="Reload All Gradle Projects"
              onClick={onSyncGradle}
            >
              <GradleSyncIcon size={14} />
            </button>
          )}
          <button type="button" className={styles.iconBtn} title="More Options">
            <MoreVerticalIcon size={14} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            title="Hide"
            onClick={onClosePanel}
          >
            —
          </button>
        </div>
      </div>

      {/* RUNNING DEVICES (Interactive Android Emulator) */}
      {activeTab === "runningDevices" && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div className={styles.emulatorToolbar}>
            <button
              type="button"
              className={styles.iconBtn}
              title="Power"
              onClick={() =>
                onTriggerEmulatorInteraction("Power button pressed (screen wake)")
              }
            >
              ⏻
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title="Volume Up"
              onClick={() => onTriggerEmulatorInteraction("KEYCODE_VOLUME_UP")}
            >
              🔊
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title="Rotate Left"
              onClick={() => {
                setDeviceRotated((r) => !r);
                onTriggerEmulatorInteraction("Rotated device orientation");
              }}
            >
              ⟲
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title="Back"
              onClick={() => onTriggerEmulatorInteraction("KEYCODE_BACK")}
            >
              ◁
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title="Home"
              onClick={() => onTriggerEmulatorInteraction("KEYCODE_HOME")}
            >
              ○
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title="Overview / Recents"
              onClick={() => onTriggerEmulatorInteraction("KEYCODE_APP_SWITCH")}
            >
              □
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title="Take Screenshot"
              onClick={() =>
                onTriggerEmulatorInteraction(
                  "LabMate cannot save emulator screenshots: use your operating system's screenshot tool"
                )
              }
            >
              📷
            </button>
          </div>

          <div className={styles.emulatorBody}>
            <div
              className={styles.emulatorBezel}
              style={
                deviceRotated
                  ? { width: 290, height: 220, borderRadius: 22 }
                  : undefined
              }
            >
              <div className={styles.emulatorCameraCutout} />
              <div className={styles.emulatorStatusBar}>
                <span>9:41</span>
                <span>5G 100%</span>
              </div>
              <div className={styles.emulatorScreenContent} style={{ padding: 0, overflow: "hidden" }}>
                {screen ? (
                  <EmulatorScreen
                    screen={screen}
                    onClick={(uid) => onEmuClick && onEmuClick(uid)}
                    onInput={(uid, text) => onEmuInput && onEmuInput(uid, text)}
                    onToggle={(uid, checked) => onEmuToggle && onEmuToggle(uid, checked)}
                    onDialogButton={(id) => onEmuDialogButton && onEmuDialogButton(id)}
                    onDismissCrash={() => onEmuDismissCrash && onEmuDismissCrash()}
                  />
                ) : (
                  <div style={{ margin: "auto", padding: 16, textAlign: "center", color: "#79747E", fontSize: 12 }}>
                    No app is running. Press Run (Shift+F10) to compile the project and start it here.
                  </div>
                )}
              </div>
              <div className={styles.emulatorGesturePill} />
            </div>
          </div>
        </div>
      )}

      {/* DEVICE MANAGER */}
      {activeTab === "deviceManager" && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 10px",
              borderBottom: "1px solid #393B40",
            }}
          >
            <span style={{ fontSize: 11, color: "#6F737A" }}>
              Virtual &amp; Physical Devices ({devices.length})
            </span>
            <button
              type="button"
              className={styles.modalBtn}
              style={{ height: 22, padding: "0 8px", fontSize: 11 }}
              onClick={() => setCreatingAvd((v) => !v)}
            >
              + Create Virtual Device
            </button>
          </div>

          {creatingAvd && (
            <div
              style={{
                padding: 10,
                background: "#1E1F22",
                borderBottom: "1px solid #393B40",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <input
                type="text"
                value={newAvdName}
                onChange={(e) => setNewAvdName(e.target.value)}
                placeholder="AVD Name"
                style={{
                  background: "#2B2D30",
                  border: "1px solid #4E5157",
                  borderRadius: 4,
                  color: "#DFE1E5",
                  padding: "4px 8px",
                  fontSize: 11.5,
                }}
              />
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <label style={{ fontSize: 11, color: "#6F737A" }}>API:</label>
                <select
                  value={newAvdApi}
                  onChange={(e) => setNewAvdApi(Number(e.target.value))}
                  style={{
                    background: "#2B2D30",
                    border: "1px solid #4E5157",
                    borderRadius: 4,
                    color: "#DFE1E5",
                    fontSize: 11,
                    padding: "2px 6px",
                  }}
                >
                  <option value={35}>API 35 (Android 15.0 VanillaIceCream)</option>
                  <option value={34}>API 34 (Android 14.0 UpsideDownCake)</option>
                  <option value={33}>API 33 (Android 13.0 Tiramisu)</option>
                </select>
                <button
                  type="button"
                  className={`${styles.modalBtn} ${styles.modalBtnPrimary}`}
                  style={{ height: 22, padding: "0 8px", fontSize: 11, marginLeft: "auto" }}
                  onClick={() => {
                    if (newAvdName.trim()) {
                      onCreateVirtualDevice(newAvdName.trim(), newAvdApi);
                      setCreatingAvd(false);
                    }
                  }}
                >
                  Finish
                </button>
              </div>
            </div>
          )}

          <div className={styles.deviceList}>
            {devices.map((dev) => (
              <div
                key={dev.id}
                className={styles.deviceCard}
                style={{
                  borderColor: dev.id === activeDeviceId ? "#3574F0" : undefined,
                }}
                onClick={() => onSelectDevice(dev.id)}
              >
                <RunningDevicesStripeIcon size={18} />
                <div className={styles.deviceMeta}>
                  <span className={styles.deviceTitle}>{dev.name}</span>
                  <span className={styles.deviceSub}>
                    {dev.androidVersion} • API {dev.apiLevel} • {dev.widthDp}×{dev.heightDp}dp
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.iconBtn}
                  title={dev.booted ? "Stop AVD" : "Start AVD"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleDeviceOnline(dev.id);
                  }}
                >
                  {dev.booted ? <StopSquareIcon size={14} /> : <RunPlayIcon size={14} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GRADLE TASKS */}
      {activeTab === "gradle" && (
        <div className={styles.gradleTaskList}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 8px",
              fontWeight: 600,
              color: "#DFE1E5",
            }}
          >
            <GradleFileIcon size={15} />
            <span>MyApplication (:app)</span>
          </div>
          {groups.map((grp) => {
            const items = gradleTasks.filter((t) => t.group === grp);
            if (items.length === 0) return null;
            const open = expandedTaskGroups.has(grp);
            return (
              <div key={grp}>
                <div
                  className={styles.gradleTaskRow}
                  onClick={() => toggleGroup(grp)}
                >
                  {open ? (
                    <ChevronDownIcon size={12} />
                  ) : (
                    <ChevronRightIcon size={12} />
                  )}
                  <FolderDarkIcon size={14} />
                  <span style={{ fontWeight: 500 }}>{grp}</span>
                </div>
                {open &&
                  items.map((task) => (
                    <div
                      key={task.id}
                      className={styles.gradleTaskRow}
                      style={{ paddingLeft: 26 }}
                      onClick={() => onExecuteGradleTask(task.name)}
                      title={task.description}
                    >
                      <GradleFileIcon size={13} />
                      <span style={{ color: "#DFE1E5" }}>{task.name}</span>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {/* GEMINI IN ANDROID STUDIO */}
      {activeTab === "gemini" && (
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
            <GeminiSparkleIcon size={16} />
            <span>Gemini in Android Studio</span>
          </div>
          <p style={{ fontSize: 12, color: "#B4B8BF", lineHeight: 1.5, margin: 0 }}>
            Ask Gemini to generate Jetpack Compose `@Preview` functions, explain Logcat stack traces, or optimize Gradle build scripts.
          </p>
          <button
            type="button"
            className={`${styles.modalBtn} ${styles.modalBtnPrimary}`}
            onClick={() =>
              onTriggerEmulatorInteraction("Gemini suggested @Composable modifier optimization")
            }
          >
            Suggest Compose Optimization
          </button>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <div style={{ padding: 14, fontSize: 12, color: "#B4B8BF" }}>
          <div style={{ fontWeight: 600, color: "#DFE1E5", marginBottom: 6 }}>
            Gradle &amp; SDK Notifications
          </div>
          <div>• Android Gradle Plugin 8.7.2 is up to date.</div>
          <div>• Emulator Medium Phone API 35 connected on adb:5554.</div>
        </div>
      )}
    </aside>
  );
};
