"use client";

import React, { useMemo, useState } from "react";
import styles from "./androidStudio.module.css";
import { RightToolId } from "./StudioStripes";
import {
  PreviewWidgetNode,
  StudioDeviceProfile,
  StudioFile,
} from "@/lib/ide/androidStudioEngine";
import {
  AndroidRuntimeSession,
} from "@/lib/ide/androidActivityRuntime";
import {
  XmlLayoutElement,
  parseAndroidLayoutXml,
  parseAndroidResources,
  resolveResourceValue,
} from "@/lib/ide/androidXmlLayout";
import type { AndroidBuildTask, AndroidCapabilities } from "@/lib/ide/androidRemote";
import {
  AndroidHeadIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FolderDarkIcon,
  GradleFileIcon,
  GradleSyncIcon,
  MoreVerticalIcon,
  RestartIcon,
  RunPlayIcon,
  RunningDevicesStripeIcon,
  StopSquareIcon,
} from "./StudioIcons";

export interface GradleTaskItem {
  id: string;
  task: AndroidBuildTask;
  name: string;
  group: "build" | "verification";
  description: string;
}

export const DEFAULT_GRADLE_TASKS: GradleTaskItem[] = [
  { id: "gt-compile", task: "compile", name: "compileDebugJavaWithJavac", group: "build", description: "Validates XML/Manifest and compiles Java via isolated javac" },
  { id: "gt-assemble", task: "assembleDebug", name: "assembleDebug", group: "build", description: "Compiles sources and packages debug APK archive" },
  { id: "gt-clean", task: "clean", name: "clean", group: "build", description: "Clears previous build artifacts" },
  { id: "gt-test", task: "test", name: "testDebugUnitTest", group: "verification", description: "Runs JUnit unit tests via isolated JVM" },
];

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
}

interface StudioRightPanelProps {
  activeTab: RightToolId | null;
  projectName: string;
  files: StudioFile[];
  devices: StudioDeviceProfile[];
  activeDeviceId: string;
  onSelectDevice: (id: string) => void;
  onToggleDeviceOnline: (id: string) => void;
  onCreateVirtualDevice: (name: string, apiLevel: number) => void;
  runtimeSession: AndroidRuntimeSession;
  previewTree: PreviewWidgetNode;
  activeAppRunning: boolean;
  isComposeProject: boolean;
  onRestartRuntimeApp: () => void;
  onInputChange: (widgetId: string, value: string) => void;
  onToggleChecked: (widgetId: string) => void;
  onWidgetClick: (widgetId: string, onClickMethodName?: string) => void;
  onComposeIncrement: () => void;
  onPressBack: () => void;
  onPressHome: () => void;
  onPressRecents: () => void;
  onLaunchFromHome: () => void;
  onLogEmulatorEvent: (msg: string) => void;
  onBuildTask: (task: AndroidBuildTask) => void;
  capabilities: AndroidCapabilities | null;
  notifications: NotificationItem[];
  onClosePanel: () => void;
}

export const StudioRightPanel: React.FC<StudioRightPanelProps> = ({
  activeTab,
  projectName,
  files,
  devices,
  activeDeviceId,
  onSelectDevice,
  onToggleDeviceOnline,
  onCreateVirtualDevice,
  runtimeSession,
  previewTree,
  activeAppRunning,
  isComposeProject,
  onRestartRuntimeApp,
  onInputChange,
  onToggleChecked,
  onWidgetClick,
  onComposeIncrement,
  onPressBack,
  onPressHome,
  onPressRecents,
  onLaunchFromHome,
  onLogEmulatorEvent,
  onBuildTask,
  capabilities,
  notifications,
  onClosePanel,
}) => {
  const [deviceRotated, setDeviceRotated] = useState(false);
  const [screenOn, setScreenOn] = useState(true);
  const [expandedTaskGroups, setExpandedTaskGroups] = useState<Set<string>>(
    () => new Set(["build", "verification"])
  );
  const [creatingAvd, setCreatingAvd] = useState(false);
  const [newAvdName, setNewAvdName] = useState("Pixel 8 Pro API 35");
  const [newAvdApi, setNewAvdApi] = useState(35);

  const resources = useMemo(() => parseAndroidResources(files), [files]);

  const topFrame =
    runtimeSession.activityStack.length > 0
      ? runtimeSession.activityStack[runtimeSession.activityStack.length - 1]
      : null;

  const activeLayoutFile = useMemo(() => {
    if (!topFrame) return null;
    return (
      files.find((f) => f.path === topFrame.layoutFilePath || f.name === `${topFrame.layoutName}.xml`) ||
      files.find((f) => f.isLayoutXml) ||
      null
    );
  }, [files, topFrame]);

  const parsedLayout = useMemo(
    () => (activeLayoutFile ? parseAndroidLayoutXml(activeLayoutFile.content) : { root: null, errors: [] }),
    [activeLayoutFile]
  );

  if (!activeTab) return null;

  const activeDevice = devices.find((d) => d.id === activeDeviceId) ?? devices[0];

  const toggleGroup = (g: string) => {
    setExpandedTaskGroups((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const handleDownloadScreenshot = () => {
    const title = topFrame ? `${runtimeSession.appLabel} (${topFrame.activityName})` : runtimeSession.appLabel;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="540">
      <rect width="320" height="540" rx="24" fill="#101114"/>
      <rect x="12" y="36" width="296" height="480" rx="14" fill="#F7F2FA"/>
      <rect x="12" y="36" width="296" height="42" rx="8" fill="#6750A4"/>
      <text x="26" y="62" fill="#FFFFFF" font-family="sans-serif" font-size="14" font-weight="600">${title.replace(/[<>&"]/g, "")}</text>
      <text x="26" y="106" fill="#1C1B1F" font-family="sans-serif" font-size="12">Device: ${(activeDevice?.name || "").replace(/[<>&"]/g, "")}</text>
      <text x="26" y="128" fill="#49454F" font-family="sans-serif" font-size="11">Package: ${runtimeSession.activePackageName}</text>
    </svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName}_emulator_screen.svg`;
    a.click();
    URL.revokeObjectURL(url);
    onLogEmulatorEvent(`Saved emulator snapshot ${projectName}_emulator_screen.svg`);
  };

  const renderInteractiveXmlNode = (node: XmlLayoutElement): React.ReactNode => {
    if (!topFrame) return null;
    const vis = topFrame.visibilityOverrides[node.id];
    if (vis === "gone") return null;
    const invisible = vis === "invisible";

    const overrideText = topFrame.widgetTextOverrides[node.id];
    const resolvedXmlText =
      node.attrs["android:text"] !== undefined
        ? resolveResourceValue(node.attrs["android:text"], resources)
        : "";
    const textVal = overrideText !== undefined ? overrideText : resolvedXmlText;
    const hintVal = resolveResourceValue(node.attrs["android:hint"], resources);
    const onClickMethod = node.attrs["android:onClick"];

    if (
      node.shortTag === "LinearLayout" ||
      node.shortTag === "RelativeLayout" ||
      node.shortTag === "ConstraintLayout" ||
      node.shortTag === "FrameLayout" ||
      node.shortTag === "ScrollView"
    ) {
      const horiz = node.attrs["android:orientation"] === "horizontal";
      return (
        <div
          key={node.uid}
          style={{
            display: "flex",
            flexDirection: horiz ? "row" : "column",
            gap: 8,
            padding: node === parsedLayout.root ? 10 : 6,
            width: "100%",
            opacity: invisible ? 0 : 1,
          }}
        >
          {node.children.map((ch) => renderInteractiveXmlNode(ch))}
        </div>
      );
    }

    if (node.shortTag === "Button") {
      return (
        <button
          key={node.uid}
          type="button"
          className={styles.emulatorInteractiveBtn}
          style={{
            width: node.attrs["android:layout_width"] === "match_parent" ? "100%" : undefined,
            alignSelf: node.attrs["android:layout_width"] === "match_parent" ? "stretch" : "flex-start",
            visibility: invisible ? "hidden" : "visible",
          }}
          onClick={() => onWidgetClick(node.id, onClickMethod)}
        >
          {textVal || "Button"}
        </button>
      );
    }

    if (node.shortTag === "EditText") {
      const val = topFrame.inputValues[node.id] !== undefined ? topFrame.inputValues[node.id] : resolvedXmlText;
      const isNumber = (node.attrs["android:inputType"] || "").indexOf("number") >= 0;
      return (
        <input
          key={node.uid}
          type="text"
          inputMode={isNumber ? "decimal" : "text"}
          className={styles.emulatorInputField}
          aria-label={hintVal || node.id}
          placeholder={hintVal || node.id}
          value={val}
          onChange={(e) => onInputChange(node.id, e.target.value)}
        />
      );
    }

    if (node.shortTag === "ImageView") {
      return (
        <div
          key={node.uid}
          onClick={() => onWidgetClick(node.id, onClickMethod)}
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: "#E8DEF8",
            border: "1px solid #C4B5FD",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          title={node.attrs["android:contentDescription"] || node.id}
        >
          <AndroidHeadIcon size={22} />
        </div>
      );
    }

    if (node.shortTag === "CheckBox" || node.shortTag === "Switch") {
      const checked = Boolean(topFrame.checkedValues[node.id]);
      return (
        <label
          key={node.uid}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11.5,
            color: "#1C1B1F",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={() => {
              onToggleChecked(node.id);
              onWidgetClick(node.id, onClickMethod);
            }}
          />
          <span>{textVal || node.shortTag}</span>
        </label>
      );
    }

    const sizeRaw = parseFloat(node.attrs["android:textSize"] || "");
    const colorRaw = node.attrs["android:textColor"]
      ? resolveResourceValue(node.attrs["android:textColor"], resources)
      : undefined;

    return (
      <div
        key={node.uid}
        style={{
          fontSize: isNaN(sizeRaw) ? 12.5 : Math.max(10.5, Math.min(20, sizeRaw * 0.78)),
          fontWeight: sizeRaw >= 18 ? 700 : 400,
          color: colorRaw || "#1C1B1F",
          lineHeight: 1.35,
          visibility: invisible ? "hidden" : "visible",
          wordBreak: "break-word",
        }}
      >
        {textVal}
      </div>
    );
  };

  const titleLabel =
    activeTab === "runningDevices"
      ? "Running Devices"
      : activeTab === "deviceManager"
      ? "Device Manager"
      : activeTab === "gradle"
      ? "Gradle"
      : "Notifications";

  const latestToast =
    runtimeSession.toasts.length > 0
      ? runtimeSession.toasts[runtimeSession.toasts.length - 1]
      : null;

  return (
    <aside className={styles.rightDock} aria-label="Right Tool Window">
      <div className={styles.toolWindowHeader}>
        <div className={styles.toolWindowTitleGroup}>
          <span style={{ fontWeight: 600, fontSize: 12 }}>{titleLabel}</span>
          {activeTab === "runningDevices" && activeDevice && (
            <span
              style={{
                fontSize: 11,
                color: "var(--as-text-muted)",
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
              title="Run Project Validation"
              onClick={() => onBuildTask("compile")}
            >
              <GradleSyncIcon size={14} />
            </button>
          )}
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

      {/* RUNNING DEVICES (Interactive Code-Driven Emulator) */}
      {activeTab === "runningDevices" && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div className={styles.emulatorToolbar}>
            <button
              type="button"
              className={styles.iconBtn}
              title="Power / Screen Toggle"
              onClick={() => {
                setScreenOn((s) => !s);
                onLogEmulatorEvent(screenOn ? "Screen turned OFF" : "Screen woken");
              }}
            >
              ⏻
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title="Restart App Session"
              onClick={onRestartRuntimeApp}
            >
              <RestartIcon size={13} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title="Rotate Orientation"
              onClick={() => setDeviceRotated((r) => !r)}
            >
              ⟲
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title="Back"
              aria-label="Emulator Back"
              onClick={onPressBack}
            >
              ◁
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title="Home"
              aria-label="Emulator Home"
              onClick={onPressHome}
            >
              ○
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title="Overview / Recents"
              aria-label="Emulator Recents"
              onClick={onPressRecents}
            >
              □
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title="Download Screen Snapshot"
              onClick={handleDownloadScreenshot}
            >
              📷
            </button>
          </div>

          <div className={styles.emulatorBody}>
            <div
              className={styles.emulatorBezel}
              style={
                deviceRotated
                  ? { width: 290, minHeight: 225, borderRadius: 22 }
                  : undefined
              }
            >
              <div className={styles.emulatorCameraCutout} />
              <div className={styles.emulatorStatusBar}>
                <span>9:41</span>
                <span>API {activeDevice?.apiLevel || 35}</span>
              </div>

              <div
                className={`${styles.emulatorScreenContent} ${
                  !screenOn ? styles.phoneScreenOff : ""
                }`}
                style={{ position: "relative" }}
              >
                {!screenOn ? (
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => setScreenOn(true)}
                  >
                    Wake Screen
                  </button>
                ) : runtimeSession.crashError ? (
                  <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, margin: "auto" }}>
                    <div
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #DB5C5C",
                        borderRadius: 12,
                        padding: 12,
                        boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#B3261E", marginBottom: 4 }}>
                        {runtimeSession.appLabel} keeps stopping
                      </div>
                      <div style={{ fontSize: 11, color: "#49454F", marginBottom: 10, wordBreak: "break-word" }}>
                        {runtimeSession.crashError}
                      </div>
                      <button
                        type="button"
                        className={styles.emulatorInteractiveBtn}
                        style={{ background: "#B3261E", width: "100%" }}
                        onClick={onRestartRuntimeApp}
                      >
                        Restart App
                      </button>
                    </div>
                  </div>
                ) : runtimeSession.recentsOpen ? (
                  <div
                    style={{
                      flex: 1,
                      background: "#1C1B1F",
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#CAC4D0" }}>Recent Apps</div>
                    <button
                      type="button"
                      onClick={onPressRecents}
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 12,
                        background: "#2B2930",
                        border: "1px solid #49454F",
                        color: "#FFFFFF",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{runtimeSession.appLabel}</div>
                      <div style={{ fontSize: 10.5, color: "#CAC4D0", marginTop: 2 }}>
                        {topFrame ? `.${topFrame.activityName}` : "Running"} — Tap to resume
                      </div>
                    </button>
                  </div>
                ) : runtimeSession.isHomeScreen ? (
                  <div
                    style={{
                      flex: 1,
                      background: "linear-gradient(160deg, #1E293B 0%, #0F172A 100%)",
                      padding: 18,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>Android Launcher</div>
                    <button
                      type="button"
                      onClick={onLaunchFromHome}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        background: "transparent",
                        border: "none",
                        color: "#FFFFFF",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          background: "#3574F0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
                        }}
                      >
                        <AndroidHeadIcon size={26} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 500 }}>{runtimeSession.appLabel}</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={styles.emulatorAppBar} style={{ justifyContent: "space-between" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        {runtimeSession.activityStack.length > 1 && (
                          <button
                            type="button"
                            onClick={onPressBack}
                            aria-label="Navigate Up"
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "#FFFFFF",
                              cursor: "pointer",
                              padding: "0 4px 0 0",
                              fontSize: 13,
                            }}
                          >
                            ←
                          </button>
                        )}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {runtimeSession.appLabel}
                        </span>
                      </span>
                      <span style={{ fontSize: 10, opacity: 0.85 }}>
                        {topFrame ? `.${topFrame.activityName}` : ""}
                      </span>
                    </div>

                    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
                      {!isComposeProject && parsedLayout.root ? (
                        renderInteractiveXmlNode(parsedLayout.root)
                      ) : (
                        <div className={styles.emulatorCard}>
                          {(previewTree.children || []).map((node) =>
                            node.type === "Button" ? (
                              <button
                                key={node.id}
                                type="button"
                                className={styles.emulatorInteractiveBtn}
                                onClick={onComposeIncrement}
                              >
                                {node.text}
                              </button>
                            ) : (
                              <div key={node.id} style={{ fontSize: 13, fontWeight: 600, color: "#1C1B1F" }}>
                                {node.text}
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    {latestToast && (
                      <div className={styles.emulatorToastOverlay} role="status">
                        {latestToast.message}
                      </div>
                    )}
                  </>
                )}

                {screenOn && (
                  <div className={styles.phoneNavBar}>
                    <button
                      type="button"
                      className={styles.phoneNavBtn}
                      title="Back"
                      onClick={onPressBack}
                    >
                      ◁
                    </button>
                    <button
                      type="button"
                      className={styles.phoneNavBtn}
                      title="Home"
                      onClick={onPressHome}
                    >
                      ○
                    </button>
                    <button
                      type="button"
                      className={styles.phoneNavBtn}
                      title="Overview"
                      onClick={onPressRecents}
                    >
                      □
                    </button>
                  </div>
                )}
              </div>
              <div className={styles.emulatorGesturePill} />
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 10.5,
                color: "var(--as-text-muted)",
                textAlign: "center",
                lineHeight: 1.4,
              }}
              title={
                capabilities?.emulator_note ||
                "Interactive Browser Android Runtime (XML + Activity execution). Native AVD/KVM emulator is unavailable inside web containers."
              }
            >
              {activeAppRunning ? "Interactive Android Runtime (Active)" : "Interactive Android Runtime (Ready)"}
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
              borderBottom: "1px solid var(--as-border-panel)",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--as-text-muted)" }}>
              Browser Runtime Profiles ({devices.length})
            </span>
            <button
              type="button"
              className={styles.modalBtn}
              style={{ height: 22, padding: "0 8px", fontSize: 11 }}
              onClick={() => setCreatingAvd((v) => !v)}
            >
              + Add Device Profile
            </button>
          </div>

          {creatingAvd && (
            <div
              style={{
                padding: 10,
                background: "var(--as-bg-elevated)",
                borderBottom: "1px solid var(--as-border-panel)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <input
                type="text"
                value={newAvdName}
                onChange={(e) => setNewAvdName(e.target.value)}
                placeholder="Device Profile Name"
                style={{
                  background: "var(--as-bg-input)",
                  border: "1px solid var(--as-border-comp)",
                  borderRadius: 4,
                  color: "var(--as-text-primary)",
                  padding: "4px 8px",
                  fontSize: 11.5,
                }}
              />
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <label style={{ fontSize: 11, color: "var(--as-text-muted)" }}>API:</label>
                <select
                  value={newAvdApi}
                  onChange={(e) => setNewAvdApi(Number(e.target.value))}
                  style={{
                    background: "var(--as-bg-input)",
                    border: "1px solid var(--as-border-comp)",
                    borderRadius: 4,
                    color: "var(--as-text-primary)",
                    fontSize: 11,
                    padding: "2px 6px",
                  }}
                >
                  <option value={35}>API 35 (Android 15.0)</option>
                  <option value={34}>API 34 (Android 14.0)</option>
                  <option value={33}>API 33 (Android 13.0)</option>
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
                  Create
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
                  borderColor: dev.id === activeDeviceId ? "var(--as-accent)" : undefined,
                }}
                onClick={() => onSelectDevice(dev.id)}
              >
                <RunningDevicesStripeIcon size={18} />
                <div className={styles.deviceMeta}>
                  <span className={styles.deviceTitle}>{dev.name}</span>
                  <span className={styles.deviceSub}>
                    {dev.androidVersion} · API {dev.apiLevel} · {dev.widthDp}×{dev.heightDp}dp
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.iconBtn}
                  title={dev.booted ? "Stop Runtime Device" : "Activate Runtime Device"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleDeviceOnline(dev.id);
                  }}
                >
                  {dev.booted ? <StopSquareIcon size={14} /> : <RunPlayIcon size={14} />}
                </button>
              </div>
            ))}
            <div style={{ padding: "8px 6px", fontSize: 11, color: "var(--as-text-muted)", lineHeight: 1.45 }}>
              Native QEMU/KVM AVD emulator is unavailable in the browser/server sandbox; running launches the code-driven Interactive Android Runtime.
            </div>
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
              color: "var(--as-text-primary)",
            }}
          >
            <GradleFileIcon size={15} />
            <span>{projectName} (:app)</span>
          </div>
          {(["build", "verification"] as const).map((grp) => {
            const items = DEFAULT_GRADLE_TASKS.filter((t) => t.group === grp);
            const open = expandedTaskGroups.has(grp);
            return (
              <div key={grp}>
                <div className={styles.gradleTaskRow} onClick={() => toggleGroup(grp)}>
                  {open ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                  <FolderDarkIcon size={14} />
                  <span style={{ fontWeight: 500 }}>{grp}</span>
                </div>
                {open &&
                  items.map((item) => (
                    <div
                      key={item.id}
                      className={styles.gradleTaskRow}
                      style={{ paddingLeft: 26 }}
                      onClick={() => onBuildTask(item.task)}
                      title={item.description}
                    >
                      <GradleFileIcon size={13} />
                      <span style={{ color: "var(--as-text-primary)" }}>{item.name}</span>
                    </div>
                  ))}
              </div>
            );
          })}
          <div style={{ padding: "10px 8px", fontSize: 11, color: "var(--as-text-muted)", lineHeight: 1.45 }}>
            {capabilities
              ? `Compiler backend: ${capabilities.compiler_mode} (javac=${capabilities.javac_available ? "yes" : "no"}, gradle=${capabilities.gradle_available ? "yes" : "no"})`
              : "Tasks run XML validation & isolated JDK compilation on the LabMate backend when signed in."}
          </div>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, overflow: "auto" }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: "var(--as-text-primary)" }}>
            Event Log
          </div>
          {notifications.length === 0 ? (
            <div style={{ fontSize: 11.5, color: "var(--as-text-muted)" }}>
              No build or runtime events recorded yet.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: "var(--as-bg-card)",
                  border: "1px solid var(--as-border-panel)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 11.5, color: "var(--as-text-primary)" }}>
                  {n.title}
                </div>
                <div style={{ fontSize: 11, color: "var(--as-text-secondary)", marginTop: 2 }}>
                  {n.detail}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
};
