"use client";

import React, { useState, useMemo, useCallback } from "react";
import styles from "./androidStudio.module.css";
import {
  STUDIO_PRESETS,
  DEFAULT_DEVICES,
  DEFAULT_SDK_PACKAGES,
  AndroidViewMode,
  EditorSplitMode,
  DesignSurfaceMode,
  StudioFile,
  StudioDeviceProfile,
  SdkPackageItem,
  LogcatEntry,
  GradleBuildStep,
  AndroidTreeNode,
  StudioProblem,
  buildAndroidProjectTree,
  analyzeStudioProblems,
  extractPreviewTree,
  createInitialLogcatEntries,
  filterLogcatEntries,
  runAndroidApp,
  executeStudioTerminal,
} from "@/lib/ide/androidStudioEngine";
import { StudioHeaderToolbar, RunConfigurationId } from "./StudioHeaderToolbar";
import {
  StudioLeftStripe,
  StudioRightStripe,
  LeftToolId,
  RightToolId,
  BottomToolId,
} from "./StudioStripes";
import { AndroidProjectTree } from "./AndroidProjectTree";
import { StudioEditorSplitPane } from "./StudioEditorSplitPane";
import { StudioRightPanel, DEFAULT_GRADLE_TASKS } from "./StudioRightPanel";
import { StudioBottomWindow } from "./StudioBottomWindow";
import { SdkManagerModal, SearchEverywhereModal } from "./StudioModals";
import {
  AndroidHeadIcon,
  KotlinFileIcon,
  XmlFileIcon,
  GradleFileIcon,
  VcsBranchIcon,
} from "./StudioIcons";

export const AndroidStudioWorkspace: React.FC = () => {
  // Project preset state
  const [activePresetId, setActivePresetId] = useState<string>(STUDIO_PRESETS[0].id);
  const [projectFilesMap, setProjectFilesMap] = useState<Record<string, StudioFile[]>>(() => {
    const init: Record<string, StudioFile[]> = {};
    STUDIO_PRESETS.forEach((p) => {
      init[p.id] = p.files.map((f) => ({ ...f }));
    });
    return init;
  });
  const [dirtyFileIds, setDirtyFileIds] = useState<Set<string>>(() => new Set());
  const [branches, setBranches] = useState<string[]>([
    "main",
    "compose-material3",
    "feature/logcat-v2",
  ]);
  const [activeBranch, setActiveBranch] = useState<string>("main");

  const activePresetBase = useMemo(
    () => STUDIO_PRESETS.find((p) => p.id === activePresetId) ?? STUDIO_PRESETS[0],
    [activePresetId]
  );

  const files = useMemo(
    () => projectFilesMap[activePresetId] ?? activePresetBase.files,
    [projectFilesMap, activePresetId, activePresetBase.files]
  );

  const activePreset = useMemo(
    () => ({
      ...activePresetBase,
      branch: activeBranch,
      files,
    }),
    [activePresetBase, activeBranch, files]
  );

  // Open tabs & active file
  const [openTabIds, setOpenTabIds] = useState<string[]>([
    "main-activity",
    "activity-main-xml",
    "gradle-module",
  ]);
  const [activeFileId, setActiveFileId] = useState<string>("main-activity");
  const [selectedNodeId, setSelectedNodeId] = useState<string>("node-main-activity");

  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId) ?? files[0],
    [files, activeFileId]
  );

  // View modes & docks
  const [viewMode, setViewMode] = useState<AndroidViewMode>("Android");
  const [leftTab, setLeftTab] = useState<LeftToolId | null>("project");
  const [rightTab, setRightTab] = useState<RightToolId | null>("runningDevices");
  const [bottomTab, setBottomTab] = useState<BottomToolId | null>("logcat");

  // Editor Split Mode (Code | Split | Design) & Surface Mode (Design | Blueprint | Both)
  const [splitMode, setSplitMode] = useState<EditorSplitMode>("Split");
  const [surfaceMode, setSurfaceMode] = useState<DesignSurfaceMode>("Design");
  const [composeClickCount, setComposeClickCount] = useState<number>(0);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({
    line: 18,
    col: 29,
  });

  // Tree expansion state
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    () =>
      new Set([
        "node-app",
        "node-manifests",
        "node-kotlin-java",
        "node-pkg-main",
        "node-ui-theme",
        "node-pkg-android-test",
        "node-pkg-unit-test",
        "node-res",
        "node-res-layout",
        "node-res-values",
        "node-gradle-scripts",
        "proj-root",
        "proj-app",
        "proj-gradle",
        "pkg-root",
      ])
  );

  // Devices & SDK packages
  const [devices, setDevices] = useState<StudioDeviceProfile[]>(DEFAULT_DEVICES);
  const [activeDeviceId, setActiveDeviceId] = useState<string>(DEFAULT_DEVICES[0].id);
  const [sdkPackages, setSdkPackages] = useState<SdkPackageItem[]>(DEFAULT_SDK_PACKAGES);

  // Runtime / Build / Logcat / Terminal state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSyncingGradle, setIsSyncingGradle] = useState<boolean>(false);
  const [activeRunConfig, setActiveRunConfig] = useState<RunConfigurationId>("app");
  const [logcatEntries, setLogcatEntries] = useState<LogcatEntry[]>(() =>
    createInitialLogcatEntries(STUDIO_PRESETS[0].packageName)
  );
  const [logcatQuery, setLogcatQuery] = useState<string>("package:mine ");
  const [buildSteps, setBuildSteps] = useState<GradleBuildStep[]>([
    { id: "s1", label: ":app:preBuild", status: "up-to-date", durationMs: 12 },
    { id: "s2", label: ":app:compileDebugKotlin", status: "success", durationMs: 410 },
    { id: "s3", label: ":app:assembleDebug", status: "success", durationMs: 690 },
  ]);
  const [buildConsoleLines, setBuildConsoleLines] = useState<string[]>([
    "Executing tasks: [:app:assembleDebug] in project ~/AndroidStudioProjects/MyApplication",
    "> Task :app:preBuild UP-TO-DATE",
    "> Task :app:compileDebugKotlin",
    "> Task :app:mergeDebugResources",
    "> Task :app:assembleDebug",
    "",
    "BUILD SUCCESSFUL in 1s",
    "33 actionable tasks: 4 executed, 29 up-to-date",
  ]);
  const [runConsoleLines, setRunConsoleLines] = useState<string[]>([
    "$ adb -s emulator-5554 shell am start -n \"com.example.myapplication/com.example.myapplication.MainActivity\"",
    "Connected to process 6410 on device 'Medium Phone API 35'.",
  ]);
  const [terminalHistory, setTerminalHistory] = useState<
    { id: string; command: string; output: string[] }[]
  >([
    {
      id: "term-init",
      command: "./gradlew --version",
      output: [
        "Gradle 8.9 (Kotlin 2.0.21, AGP 8.7.2)",
        "Type './gradlew assembleDebug', './gradlew test', 'adb devices', or 'help'",
      ],
    },
  ]);
  const [statusMessage, setStatusMessage] = useState<string>(
    "Gradle sync finished in 840 ms (cached)"
  );

  // Modals
  const [sdkModalOpen, setSdkModalOpen] = useState<boolean>(false);
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);

  // Derived project tree, diagnostics, filtered logcat, and live preview
  const treeNodes = useMemo(
    () => buildAndroidProjectTree(activePreset, viewMode),
    [activePreset, viewMode]
  );

  const problems = useMemo(() => analyzeStudioProblems(files), [files]);

  const filteredLogcat = useMemo(
    () => filterLogcatEntries(logcatEntries, logcatQuery, activePreset.packageName),
    [logcatEntries, logcatQuery, activePreset.packageName]
  );

  const previewTree = useMemo(
    () => extractPreviewTree(files, activeFile?.id ?? "main-activity", composeClickCount),
    [files, activeFile?.id, composeClickCount]
  );

  const activeDevice = useMemo(
    () => devices.find((d) => d.id === activeDeviceId) ?? devices[0],
    [devices, activeDeviceId]
  );

  // Handlers
  const handleSelectPreset = useCallback((presetId: string) => {
    const target = STUDIO_PRESETS.find((p) => p.id === presetId);
    if (!target) return;
    setActivePresetId(presetId);
    setActiveBranch(target.branch);
    const firstFile = target.files[0];
    if (firstFile) {
      setOpenTabIds(target.files.slice(0, 3).map((f) => f.id));
      setActiveFileId(firstFile.id);
    }
    setLogcatEntries(createInitialLogcatEntries(target.packageName));
    setStatusMessage(`Switched project to ${target.name}`);
  }, []);

  const handleSelectFile = useCallback(
    (fileId: string) => {
      setActiveFileId(fileId);
      setOpenTabIds((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]));
      const target = files.find((f) => f.id === fileId);
      if (target?.isLayoutXml) {
        setSplitMode("Design");
        setSurfaceMode("Both");
      } else if (target?.hasComposePreview) {
        setSplitMode("Split");
      }
    },
    [files]
  );

  const handleCloseTab = useCallback(
    (fileId: string) => {
      setOpenTabIds((prev) => {
        const next = prev.filter((id) => id !== fileId);
        if (activeFileId === fileId) {
          setActiveFileId(next[next.length - 1] ?? files[0]?.id ?? "");
        }
        return next;
      });
    },
    [activeFileId, files]
  );

  const handleUpdateFileContent = useCallback(
    (fileId: string, newContent: string) => {
      setProjectFilesMap((prev) => {
        const list = prev[activePresetId] ?? [];
        return {
          ...prev,
          [activePresetId]: list.map((f) =>
            f.id === fileId ? { ...f, content: newContent } : f
          ),
        };
      });
      setDirtyFileIds((prev) => {
        const next = new Set(prev);
        next.add(fileId);
        return next;
      });
    },
    [activePresetId]
  );

  const handleRunApp = useCallback(() => {
    const res = runAndroidApp(
      files,
      activeFile?.id ?? "main-activity",
      activeDevice,
      composeClickCount
    );
    setBuildSteps(res.buildSteps);
    setBuildConsoleLines(res.stdout);
    setRunConsoleLines(res.stdout);
    if (res.logcatEmitted.length > 0) {
      setLogcatEntries((prev) => [...prev, ...res.logcatEmitted]);
    }
    if (res.success) {
      setIsRunning(true);
      setBottomTab("logcat");
      setRightTab("runningDevices");
      setStatusMessage(
        `Launched ${activePreset.packageName}.MainActivity on ${activeDevice.name}`
      );
    } else {
      setIsRunning(false);
      setBottomTab("build");
      setStatusMessage("Gradle build failed — see Build Output / Problems");
    }
  }, [files, activeFile?.id, activeDevice, composeClickCount, activePreset.packageName]);

  const handleApplyChanges = useCallback(
    (codeOnly: boolean) => {
      const now = new Date();
      const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(now.getDate()).padStart(2, "0")} ${String(
        now.getHours()
      ).padStart(2, "0")}:${String(now.getMinutes()).padStart(
        2,
        "0"
      )}:${String(now.getSeconds()).padStart(2, "0")}.412`;
      setLogcatEntries((prev) => [
        ...prev,
        {
          id: `lc-apply-${Date.now()}`,
          timestamp: ts,
          pid: 6142,
          tid: 6142,
          tag: "StudioDeploy",
          packageName: activePreset.packageName,
          level: "I",
          message: codeOnly
            ? `Applied code changes to ${activeDevice.adbSerial} without activity restart (140 ms)`
            : `Applied changes and restarted MainActivity on ${activeDevice.adbSerial} (210 ms)`,
        },
      ]);
      setIsRunning(true);
      setStatusMessage(
        codeOnly
          ? `Applied Code Changes to ${activeDevice.name}`
          : `Applied Changes & Restarted Activity on ${activeDevice.name}`
      );
    },
    [activePreset.packageName, activeDevice]
  );

  const handleSyncGradle = useCallback(() => {
    setIsSyncingGradle(true);
    setStatusMessage("Syncing project with Gradle files...");
    setBottomTab("build");
    setBuildConsoleLines([
      "Starting Gradle Daemon...",
      "Gradle Daemon started in 342 ms",
      "> Configure project :app",
      "Resolved Kotlin 2.0.21, AGP 8.7.2, Compose BOM 2024.10.01",
      "",
      "CONFIGURE SUCCESSFUL in 820 ms",
    ]);
    setTimeout(() => {
      setIsSyncingGradle(false);
      setStatusMessage("Gradle sync finished in 820 ms");
    }, 180);
  }, []);

  const handleAssembleProject = useCallback(() => {
    const res = runAndroidApp(
      files,
      activeFile?.id ?? "main-activity",
      activeDevice,
      composeClickCount
    );
    setBuildSteps(res.buildSteps);
    setBuildConsoleLines(res.stdout);
    setBottomTab("build");
    setStatusMessage(
      res.success ? "BUILD SUCCESSFUL in 840 ms" : "BUILD FAILED — check errors"
    );
  }, [files, activeFile?.id, activeDevice, composeClickCount]);

  const handleToggleNode = useCallback((nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const handleCreateNewFile = useCallback(
    (kind: "kotlin" | "xml") => {
      const idx = files.length + 1;
      const clean = kind === "kotlin" ? `FeatureScreen${idx}` : `fragment_card_${idx}`;
      const ext = kind === "kotlin" ? ".kt" : ".xml";
      const id = `custom-${clean.toLowerCase()}-${Date.now() % 1000}`;
      const newFile: StudioFile = {
        id,
        name: kind === "kotlin" ? clean : `${clean}${ext}`,
        tabTitle: `${clean}${ext}`,
        path:
          kind === "kotlin"
            ? `app/src/main/java/${activePreset.packageName.replace(/\./g, "/")}/${clean}.kt`
            : `app/src/main/res/layout/${clean}.xml`,
        breadcrumbs:
          kind === "kotlin"
            ? [
                activePreset.name,
                "app",
                "src",
                "main",
                "java",
                activePreset.packageName,
                `${clean}.kt`,
              ]
            : [activePreset.name, "app", "res", "layout", `${clean}.xml`],
        kind,
        hasComposePreview: kind === "kotlin",
        isLayoutXml: kind === "xml",
        content:
          kind === "kotlin"
            ? `package ${activePreset.packageName}\n\nimport androidx.compose.material3.Text\nimport androidx.compose.runtime.Composable\nimport androidx.compose.ui.tooling.preview.Preview\n\n@Composable\nfun ${clean}() {\n    Text(text = "Hello from ${clean}")\n}\n\n@Preview(showBackground = true)\n@Composable\nfun ${clean}Preview() {\n    ${clean}()\n}\n`
            : `<?xml version="1.0" encoding="utf-8"?>\n<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"\n    android:layout_width="match_parent"\n    android:layout_height="match_parent"\n    android:orientation="vertical"\n    android:padding="16dp">\n\n    <TextView\n        android:layout_width="wrap_content"\n        android:layout_height="wrap_content"\n        android:text="${clean} Layout" />\n</LinearLayout>\n`,
      };
      setProjectFilesMap((prev) => ({
        ...prev,
        [activePresetId]: [...(prev[activePresetId] ?? []), newFile],
      }));
      setOpenTabIds((prev) => [...prev, id]);
      setActiveFileId(id);
      setStatusMessage(`Created ${newFile.tabTitle}`);
    },
    [files.length, activePreset.packageName, activePreset.name, activePresetId]
  );

  return (
    <div className={styles.studioRoot}>
      {/* Top 40px Main Header Toolbar */}
      <StudioHeaderToolbar
        activePreset={activePreset}
        onSelectPreset={handleSelectPreset}
        activeBranch={activeBranch}
        branches={branches}
        onSelectBranch={(b) => {
          setActiveBranch(b);
          setStatusMessage(`Checked out branch '${b}'`);
        }}
        onCreateBranch={() => {
          const nextBranch = `feature/compose-${branches.length + 1}`;
          setBranches((prev) => [...prev, nextBranch]);
          setActiveBranch(nextBranch);
          setStatusMessage(`Created and checked out branch '${nextBranch}'`);
        }}
        devices={devices}
        activeDevice={activeDevice}
        onSelectDevice={setActiveDeviceId}
        runConfig={activeRunConfig}
        onSelectRunConfig={setActiveRunConfig}
        isAppRunning={isRunning}
        isGradleSyncing={isSyncingGradle}
        onRunApp={() => handleRunApp()}
        onStopApp={() => {
          setIsRunning(false);
          setStatusMessage(`Stopped ${activePreset.packageName} on ${activeDevice.name}`);
        }}
        onAssembleProject={handleAssembleProject}
        onApplyChanges={handleApplyChanges}
        onAttachDebugger={() =>
          setStatusMessage(`Attached LLDB/JDWP debugger to ${activeDevice.adbSerial}`)
        }
        onSyncGradle={handleSyncGradle}
        onOpenDeviceManager={() => setRightTab("deviceManager")}
        onOpenSdkManager={() => setSdkModalOpen(true)}
        onOpenSearchEverywhere={() => setSearchModalOpen(true)}
        onOpenSettings={() => setSdkModalOpen(true)}
        onShowToast={(msg) => setStatusMessage(msg)}
      />

      {/* Main Dock Area: Left Stripe + Project Tree + Center Editor/Split + Right Panel + Right Stripe */}
      <div className={styles.mainArea}>
        <StudioLeftStripe
          activeLeftTool={leftTab}
          onToggleLeftTool={(t: LeftToolId) =>
            setLeftTab((curr) => (curr === t ? null : t))
          }
          activeBottomTool={bottomTab}
          onToggleBottomTool={(t: BottomToolId) =>
            setBottomTab((curr) => (curr === t ? null : t))
          }
          problemsCount={problems.length}
          isAppRunning={isRunning}
        />

        {leftTab && (
          <AndroidProjectTree
            width={270}
            activeLeftTool={leftTab}
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
            treeNodes={treeNodes}
            expandedIds={expandedNodeIds}
            onToggleExpand={handleToggleNode}
            onExpandAll={() =>
              setExpandedNodeIds(
                new Set([
                  "node-app",
                  "node-manifests",
                  "node-kotlin-java",
                  "node-pkg-main",
                  "node-ui-theme",
                  "node-pkg-android-test",
                  "node-pkg-unit-test",
                  "node-res",
                  "node-res-drawable",
                  "node-res-layout",
                  "node-res-mipmap",
                  "node-res-values",
                  "node-gradle-scripts",
                  "proj-root",
                  "proj-app",
                  "proj-gradle",
                  "pkg-root",
                ])
              )
            }
            onCollapseAll={() => setExpandedNodeIds(new Set(["node-app"]))}
            selectedNodeId={selectedNodeId}
            activeFileId={activeFileId}
            files={files}
            dirtyFileIds={dirtyFileIds}
            onSelectTreeNode={(node: AndroidTreeNode) => {
              setSelectedNodeId(node.id);
              if (node.fileId) {
                handleSelectFile(node.fileId);
              } else {
                handleToggleNode(node.id);
              }
            }}
            onOpenFileById={handleSelectFile}
            onCreateNewFile={handleCreateNewFile}
            onCommitChanges={(msg) => {
              setDirtyFileIds(new Set());
              setStatusMessage(`Committed changes to ${activeBranch}: "${msg}"`);
            }}
            onHidePanel={() => setLeftTab(null)}
          />
        )}

        {/* Center Stack: Editor Split Pane + Bottom Tool Window */}
        <div className={styles.centerStack}>
          {activeFile && (
            <StudioEditorSplitPane
              openTabs={openTabIds
                .map((id) => files.find((f) => f.id === id))
                .filter((f): f is StudioFile => Boolean(f))}
              activeFile={activeFile}
              dirtyFileIds={dirtyFileIds}
              onSelectTab={handleSelectFile}
              onCloseTab={handleCloseTab}
              onUpdateFileContent={handleUpdateFileContent}
              splitMode={splitMode}
              onChangeSplitMode={setSplitMode}
              designSurfaceMode={surfaceMode}
              onChangeDesignSurfaceMode={setSurfaceMode}
              previewTree={previewTree}
              composeClickCount={composeClickCount}
              onIncrementComposeCounter={() => setComposeClickCount((c) => c + 1)}
              onRunFromGutter={handleRunApp}
              onDeployPreviewToDevice={() => {
                handleRunApp();
                setStatusMessage(`Deployed @Preview to ${activeDevice.name}`);
              }}
              problems={problems}
              onOpenProblemsPanel={() => setBottomTab("problems")}
              cursorPos={cursorPos}
              onChangeCursorPos={setCursorPos}
            />
          )}

          {bottomTab && (
            <StudioBottomWindow
              height={235}
              activeTool={bottomTab}
              onSelectTool={setBottomTab}
              onHide={() => setBottomTab(null)}
              devices={devices}
              activeDevice={activeDevice}
              onSelectDevice={setActiveDeviceId}
              logcatEntries={logcatEntries}
              filteredLogcat={filteredLogcat}
              logcatQuery={logcatQuery}
              onChangeLogcatQuery={setLogcatQuery}
              onClearLogcat={() => setLogcatEntries([])}
              onRestartLogcat={() =>
                setLogcatEntries(createInitialLogcatEntries(activePreset.packageName))
              }
              onEmitSampleCrash={() => {
                const now = new Date();
                const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
                  2,
                  "0"
                )}-${String(now.getDate()).padStart(2, "0")} ${String(
                  now.getHours()
                ).padStart(2, "0")}:${String(now.getMinutes()).padStart(
                  2,
                  "0"
                )}:${String(now.getSeconds()).padStart(2, "0")}.801`;
                setLogcatEntries((prev) => [
                  ...prev,
                  {
                    id: `lc-crash-${Date.now()}`,
                    timestamp: ts,
                    pid: 6142,
                    tid: 6142,
                    tag: "AndroidRuntime",
                    packageName: activePreset.packageName,
                    level: "E",
                    isCrash: true,
                    message:
                      "FATAL EXCEPTION: main — java.lang.IllegalStateException: Sample simulated error in MainActivity.kt:24",
                  },
                ]);
              }}
              buildSteps={buildSteps}
              buildConsoleLines={buildConsoleLines}
              runConsoleLines={runConsoleLines}
              problems={problems}
              onSelectProblem={(p: StudioProblem) => {
                handleSelectFile(p.fileId);
                setCursorPos({ line: p.line, col: p.column });
              }}
              terminalHistory={terminalHistory}
              onExecuteTerminal={(cmd: string) => {
                const res = executeStudioTerminal(cmd, activePreset, devices);
                if (res.clear) {
                  setTerminalHistory([]);
                } else {
                  setTerminalHistory((prev) => [
                    ...prev,
                    {
                      id: `term-${Date.now()}`,
                      command: cmd,
                      output: res.lines,
                    },
                  ]);
                }
              }}
              onClearTerminal={() => setTerminalHistory([])}
              onTakeScreenshot={() =>
                setStatusMessage(
                  `Captured screenshot from ${activeDevice.name} (${activeDevice.adbSerial})`
                )
              }
            />
          )}
        </div>

        {/* Right Dock (Running Devices Emulator / Device Manager / Gradle) */}
        <StudioRightPanel
          activeTab={rightTab}
          devices={devices}
          activeDeviceId={activeDeviceId}
          onSelectDevice={setActiveDeviceId}
          onToggleDeviceOnline={(id) =>
            setDevices((prev) =>
              prev.map((d) => (d.id === id ? { ...d, booted: !d.booted } : d))
            )
          }
          onCreateVirtualDevice={(name, apiLevel) => {
            const newId = `avd-${Date.now()}`;
            setDevices((prev) => [
              ...prev,
              {
                id: newId,
                name,
                adbSerial: `emulator-${5556 + prev.length * 2}`,
                apiLevel,
                androidVersion: `Android ${apiLevel === 35 ? "15" : "14"}`,
                widthDp: 412,
                heightDp: 915,
                formFactor: "Phone",
                booted: true,
              },
            ]);
            setActiveDeviceId(newId);
            setStatusMessage(`Created and booted AVD: ${name}`);
          }}
          previewTree={previewTree}
          activeAppRunning={isRunning}
          onTriggerEmulatorInteraction={(msg) => {
            const now = new Date();
            const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
              2,
              "0"
            )}-${String(now.getDate()).padStart(2, "0")} ${String(
              now.getHours()
            ).padStart(2, "0")}:${String(now.getMinutes()).padStart(
              2,
              "0"
            )}:${String(now.getSeconds()).padStart(2, "0")}.519`;
            setLogcatEntries((prev) => [
              ...prev,
              {
                id: `lc-emu-${Date.now()}`,
                timestamp: ts,
                pid: 6142,
                tid: 6142,
                tag: "ComposePreview",
                packageName: activePreset.packageName,
                level: "D",
                message: msg,
              },
            ]);
            setStatusMessage(`Emulator: ${msg}`);
          }}
          gradleTasks={DEFAULT_GRADLE_TASKS}
          onExecuteGradleTask={(taskName) => {
            setBottomTab("build");
            setBuildConsoleLines([
              `Executing tasks: [:app:${taskName}] in project ~/AndroidStudioProjects/${activePreset.name}`,
              `> Task :app:${taskName}`,
              `BUILD SUCCESSFUL in 610 ms`,
            ]);
            setStatusMessage(`Completed Gradle task :app:${taskName}`);
          }}
          onSyncGradle={handleSyncGradle}
          onClosePanel={() => setRightTab(null)}
        />

        <StudioRightStripe
          activeRightTool={rightTab}
          onToggleRightTool={(t: RightToolId) =>
            setRightTab((curr) => (curr === t ? null : t))
          }
          unreadNotifications={0}
        />
      </div>

      {/* Bottom 24px Status Bar */}
      <footer className={styles.statusBar}>
        <div className={styles.statusLeft}>
          <span className={styles.statusBreadcrumbs}>
            <AndroidHeadIcon size={13} />
            {activeFile?.breadcrumbs.map((seg, i) => (
              <React.Fragment key={`${seg}-${i}`}>
                {i > 0 && <span className={styles.statusCrumbSep}>›</span>}
                <span
                  style={{
                    color:
                      i === activeFile.breadcrumbs.length - 1 ? "#DFE1E5" : undefined,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {i === activeFile.breadcrumbs.length - 1 &&
                    (activeFile.kind === "kotlin" ? (
                      <KotlinFileIcon size={12} />
                    ) : activeFile.kind === "xml" || activeFile.kind === "manifest" ? (
                      <XmlFileIcon size={12} />
                    ) : (
                      <GradleFileIcon size={12} />
                    ))}
                  {seg}
                </span>
              </React.Fragment>
            ))}
          </span>
          <span style={{ color: "#57965C" }}>● {statusMessage}</span>
        </div>

        <div className={styles.statusRight}>
          <span className={styles.statusItem}>
            {cursorPos.line}:{cursorPos.col}
          </span>
          <span className={styles.statusItem}>LF</span>
          <span className={styles.statusItem}>UTF-8</span>
          <span className={styles.statusItem}>4 spaces</span>
          <span className={styles.statusItem} title="Git Branch">
            <VcsBranchIcon size={12} />
            {activeBranch}
          </span>
        </div>
      </footer>

      {/* Modals: SDK Manager & Search Everywhere */}
      <SdkManagerModal
        open={sdkModalOpen}
        packages={sdkPackages}
        onTogglePackage={(id) =>
          setSdkPackages((prev) =>
            prev.map((p) => (p.id === id ? { ...p, installed: !p.installed } : p))
          )
        }
        onApplySdkChanges={() =>
          setStatusMessage("Updated Android SDK packages in /Library/Android/sdk")
        }
        onClose={() => setSdkModalOpen(false)}
      />

      <SearchEverywhereModal
        open={searchModalOpen}
        files={files}
        onSelectFile={handleSelectFile}
        onRunAction={(act) => {
          if (act === "run") handleRunApp();
          else if (act === "sync") handleSyncGradle();
          else if (act === "sdk") setSdkModalOpen(true);
          else if (act === "logcat") setBottomTab("logcat");
        }}
        onClose={() => setSearchModalOpen(false)}
      />
    </div>
  );
};
