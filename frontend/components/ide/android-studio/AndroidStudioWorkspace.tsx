"use client";

import React, { useRef, useState, useMemo, useCallback, useEffect } from "react";
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
  logcatTime,
  filterLogcatEntries,
  executeStudioTerminal,
} from "@/lib/ide/androidStudioEngine";
import { AndroidRuntime, checkProject } from "@/lib/ide/kotlin/android";
import type { ScreenState, ProjectFile } from "@/lib/ide/kotlin/android";
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

const FILES_KEY = "labmate.androidstudio.files.v1";

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

  // Keep the student's code in this browser: restore it after a reload, save it as they type.
  const filesRestored = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(FILES_KEY) || "null");
      if (saved && typeof saved === "object") {
        setProjectFilesMap((prev) => {
          const next = { ...prev };
          for (const [presetId, files] of Object.entries(saved as Record<string, { id: string; content: string }[]>)) {
            if (!next[presetId] || !Array.isArray(files)) continue;
            next[presetId] = next[presetId].map((f) => {
              const stored = files.find((x) => x.id === f.id);
              return stored && typeof stored.content === "string" ? { ...f, content: stored.content } : f;
            });
          }
          return next;
        });
      }
    } catch {
      /* nothing saved, or storage blocked */
    }
    filesRestored.current = true;
  }, []);
  useEffect(() => {
    if (!filesRestored.current) return;
    const handle = window.setTimeout(() => {
      try {
        const compact = Object.fromEntries(
          Object.entries(projectFilesMap).map(([presetId, files]) => [presetId, files.map((f) => ({ id: f.id, content: f.content }))]),
        );
        window.localStorage.setItem(FILES_KEY, JSON.stringify(compact));
      } catch {
        /* storage full or blocked: autosave is a convenience */
      }
    }, 400);
    return () => window.clearTimeout(handle);
  }, [projectFilesMap]);
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
  const [logcatEntries, setLogcatEntries] = useState<LogcatEntry[]>([]);
  const [logcatQuery, setLogcatQuery] = useState<string>("package:mine ");
  // The running "device": a real execution of the student's Kotlin (see lib/ide/kotlin). null until Run succeeds.
  const rtRef = useRef<AndroidRuntime | null>(null);
  const logClearRef = useRef<number>(0);
  const [screen, setScreen] = useState<ScreenState | null>(null);
  const [buildSteps, setBuildSteps] = useState<GradleBuildStep[]>([]);
  const [buildConsoleLines, setBuildConsoleLines] = useState<string[]>([
    "Nothing has been built yet. Press Run (Shift+F10) to compile the project and start it in the emulator.",
  ]);
  const [runConsoleLines, setRunConsoleLines] = useState<string[]>([
    "The app is not running. Press Run (Shift+F10).",
  ]);
  const [terminalHistory, setTerminalHistory] = useState<
    { id: string; command: string; output: string[] }[]
  >([
    {
      id: "term-init",
      command: "help",
      output: [
        "LabMate shell. Try: ./gradlew assembleDebug (compiles your Kotlin in the browser), adb logcat -d, pwd, ls, clear",
      ],
    },
  ]);
  const [statusMessage, setStatusMessage] = useState<string>(
    "Ready. Press Run to compile and launch the app"
  );

  // Modals
  const [sdkModalOpen, setSdkModalOpen] = useState<boolean>(false);
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);

  // Derived project tree, diagnostics, filtered logcat, and live preview
  const treeNodes = useMemo(
    () => buildAndroidProjectTree(activePreset, viewMode),
    [activePreset, viewMode]
  );

  const projectFilesForRuntime = useMemo<ProjectFile[]>(
    () =>
      files.map((f) => ({
        path: f.path,
        name: f.tabTitle,
        kind: f.kind,
        content: f.content,
        isTest: f.isTest,
      })),
    [files]
  );

  // Problems = real compiler diagnostics for Kotlin (syntax, unresolved references, literal type mismatches, val reassignment)
  // plus the XML well-formedness checks and TODO notes of the older analyser.
  const problems = useMemo(() => {
    const legacy = analyzeStudioProblems(files);
    const kindById: Record<string, string> = {};
    const idByName: Record<string, string> = {};
    files.forEach((f) => {
      kindById[f.id] = f.kind;
      idByName[f.tabTitle] = f.id;
    });
    const out: StudioProblem[] = legacy.filter(
      (p) => kindById[p.fileId] !== "kotlin" || p.severity !== "error" || p.id.indexOf("-unresolved-") >= 0
    );
    let diags: ReturnType<typeof checkProject> = [];
    try {
      diags = checkProject(projectFilesForRuntime);
    } catch (e) {
      diags = [];
    }
    diags.forEach((d, i) => {
      const dup = out.some((p) => p.fileId === idByName[d.file] && p.line === d.line && p.message === d.message);
      if (dup) return;
      out.push({
        id: `ck-${i}-${d.line}-${d.col}`,
        fileId: idByName[d.file] ?? "",
        fileName: d.file,
        line: d.line,
        column: d.col,
        severity: d.severity,
        message: d.message,
      });
    });
    return out;
  }, [files, projectFilesForRuntime]);

  const filteredLogcat = useMemo(
    () => filterLogcatEntries(logcatEntries, logcatQuery, activePreset.packageName),
    [logcatEntries, logcatQuery, activePreset.packageName]
  );

  // Compose @Preview: run the first @Preview function of the project with the same engine as the emulator.
  const previewRtRef = useRef<AndroidRuntime | null>(null);
  const [composePreview, setComposePreview] = useState<{ screen: ScreenState | null; fn: string | null; message: string | null }>({ screen: null, fn: null, message: null });
  const refreshComposePreview = useCallback(() => {
    const kt = projectFilesForRuntime.filter((f) => f.kind === "kotlin" && !f.isTest);
    const ordered = kt.filter((f) => f.name === activeFile?.tabTitle).concat(kt.filter((f) => f.name !== activeFile?.tabTitle));
    let fn: string | null = null;
    for (let i = 0; i < ordered.length && !fn; i++) {
      const m = /@Preview[^\n]*\n(?:\s*@\w+[^\n]*\n)*\s*fun\s+(\w+)\s*\(/.exec(ordered[i].content);
      if (m) fn = m[1];
    }
    if (!fn) {
      previewRtRef.current = null;
      setComposePreview({ screen: null, fn: null, message: null });
      return;
    }
    try {
      const rt = new AndroidRuntime(projectFilesForRuntime);
      const diags = rt.build().filter((d) => d.severity === "error");
      if (diags.length) {
        previewRtRef.current = null;
        setComposePreview({ screen: null, fn, message: `Preview unavailable: fix the ${diags.length} error(s) in Problems first (first: ${diags[0].file}:${diags[0].line} ${diags[0].message}).` });
        return;
      }
      rt.startPreview(fn);
      previewRtRef.current = rt;
      setComposePreview({ screen: rt.previewScreen(), fn, message: null });
    } catch (e) {
      previewRtRef.current = null;
      setComposePreview({ screen: null, fn, message: "Preview unavailable: " + (e instanceof Error ? e.message : String(e)) });
    }
  }, [projectFilesForRuntime, activeFile?.tabTitle]);
  useEffect(() => {
    const t = setTimeout(refreshComposePreview, 450);
    return () => clearTimeout(t);
  }, [refreshComposePreview, composeClickCount]);
  const syncPreview = useCallback(() => {
    const rt = previewRtRef.current;
    if (rt) setComposePreview((prev) => ({ ...prev, screen: rt.previewScreen() }));
  }, []);

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
    rtRef.current = null;
    setScreen(null);
    setLogcatEntries([]);
    setIsRunning(false);
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

  // Pull the runtime's current screen and log into React state.
  const syncRuntime = useCallback(() => {
    const rt = rtRef.current;
    if (!rt) return;
    const sc = rt.screen();
    setScreen(sc);
    const from = logClearRef.current;
    const pkg = activePreset.packageName;
    setLogcatEntries(
      rt.logs.slice(from).map((l, i) => ({
        id: `lc-${from + i}`,
        timestamp: logcatTime(l.ts),
        pid: 4242,
        tid: 4242,
        tag: l.tag,
        packageName: l.tag === "ActivityManager" || l.tag === "ActivityTaskManager" ? "system_process" : pkg,
        level: l.level,
        message: l.message,
        isCrash: l.crash,
      }))
    );
    setIsRunning(sc.crash === null && !sc.finished);
  }, [activePreset.packageName]);

  // Toasts disappear by themselves.
  useEffect(() => {
    if (!screen || screen.toasts.length === 0) return;
    const t = setTimeout(syncRuntime, 2600);
    return () => clearTimeout(t);
  }, [screen, syncRuntime]);

  // Compile the project. Returns the runtime when the build succeeded.
  const compileProject = useCallback(
    (label: string): { rt: AndroidRuntime | null; lines: string[]; steps: GradleBuildStep[] } => {
      const t0 = Date.now();
      const rt = new AndroidRuntime(projectFilesForRuntime);
      const diags = rt.build();
      const kotlinCount = projectFilesForRuntime.filter((f) => f.kind === "kotlin" && !f.isTest).length;
      const xmlErrors = problems.filter((p) => p.severity === "error" && p.id.indexOf("xml") >= 0);
      const errors = diags.filter((d) => d.severity === "error");
      const ms = Math.max(1, Date.now() - t0);
      const lines: string[] = [
        `Executing: ${label}`,
        `Compiling ${kotlinCount} Kotlin source file(s) in the browser (LabMate does not use Gradle or the real Kotlin compiler)`,
      ];
      const steps: GradleBuildStep[] = [];
      if (xmlErrors.length) {
        lines.push("> Task :app:processDebugResources FAILED");
        xmlErrors.forEach((p) => lines.push(`e: ${p.fileName}:${p.line}:${p.column} ${p.message}`));
        steps.push({ id: "s-res", label: ":app:processDebugResources", status: "failed", durationMs: ms });
      }
      lines.push("> Task :app:compileDebugKotlin" + (errors.length ? " FAILED" : ""));
      diags.forEach((d) => lines.push(`${d.severity === "error" ? "e" : "w"}: ${d.file}:${d.line}:${d.col} ${d.message}`));
      steps.push({ id: "s-kt", label: ":app:compileDebugKotlin", status: errors.length ? "failed" : "success", durationMs: ms });
      const failed = errors.length + xmlErrors.length;
      lines.push("");
      if (failed) {
        lines.push(`BUILD FAILED in ${ms}ms`, `${failed} error(s). Fix them in the Problems tab.`);
        return { rt: null, lines, steps };
      }
      lines.push(`BUILD SUCCESSFUL in ${ms}ms`);
      return { rt, lines, steps };
    },
    [projectFilesForRuntime, problems]
  );

  const handleRunApp = useCallback(() => {
    const built = compileProject("compile and run :app on the LabMate emulator");
    setBuildSteps(built.steps);
    setBuildConsoleLines(built.lines);
    if (!built.rt) {
      setIsRunning(false);
      setBottomTab("build");
      setStatusMessage("Build failed. See Build Output / Problems");
      return;
    }
    const rt = built.rt;
    rt.start();
    rtRef.current = rt;
    logClearRef.current = 0;
    setRunConsoleLines([
      `Launching 'app' on ${activeDevice.name}`,
      `$ am start -n ${activePreset.packageName}/.MainActivity`,
      "The compiled app runs inside LabMate (a Kotlin interpreter, not a real Android device). Output appears in Logcat.",
    ]);
    syncRuntime();
    setRightTab("runningDevices");
    setBottomTab(rt.crash ? "logcat" : "logcat");
    setStatusMessage(
      rt.crash ? `App crashed on launch: ${rt.crash.message}` : `Launched ${activePreset.packageName} on ${activeDevice.name}`
    );
  }, [compileProject, activeDevice, activePreset.packageName, syncRuntime]);

  const handleApplyChanges = useCallback(
    (codeOnly: boolean) => {
      // LabMate has no hot-swap: applying changes recompiles and restarts the app.
      void codeOnly;
      handleRunApp();
    },
    [handleRunApp]
  );

  const handleSyncGradle = useCallback(() => {
    setStatusMessage("LabMate does not use Gradle: there is nothing to sync. Press Run to compile.");
    setBottomTab("build");
    setBuildConsoleLines([
      "Gradle sync is not part of LabMate: the project is compiled in the browser when you press Run.",
      "The build.gradle.kts files are shown for reference and are not read.",
    ]);
  }, []);

  const handleAssembleProject = useCallback(() => {
    const built = compileProject(":app:assembleDebug");
    setBuildSteps(built.steps);
    setBuildConsoleLines(built.lines);
    setBottomTab("build");
    setStatusMessage(built.rt ? "Build successful" : "Build failed. See Build Output / Problems");
  }, [compileProject]);

  const handleEmuClick = useCallback(
    (uid: string) => {
      if (rtRef.current) rtRef.current.click(uid);
      syncRuntime();
    },
    [syncRuntime]
  );
  const handleEmuInput = useCallback(
    (uid: string, text: string) => {
      if (rtRef.current) rtRef.current.input(uid, text);
      syncRuntime();
    },
    [syncRuntime]
  );
  const handleEmuToggle = useCallback(
    (uid: string, checked: boolean) => {
      if (rtRef.current) rtRef.current.toggle(uid, checked);
      syncRuntime();
    },
    [syncRuntime]
  );
  const handleEmuDialogButton = useCallback(
    (id: number) => {
      if (rtRef.current) rtRef.current.click("dlg:" + id);
      syncRuntime();
    },
    [syncRuntime]
  );
  const handleEmuDismissCrash = useCallback(() => {
    if (rtRef.current) rtRef.current.closeApp();
    syncRuntime();
    setIsRunning(false);
  }, [syncRuntime]);

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
              composePreview={composePreview}
              onPreviewClick={(uid) => {
                if (previewRtRef.current) previewRtRef.current.click(uid);
                syncPreview();
              }}
              onPreviewInput={(uid, text) => {
                if (previewRtRef.current) previewRtRef.current.input(uid, text);
                syncPreview();
              }}
              onPreviewToggle={(uid, checked) => {
                if (previewRtRef.current) previewRtRef.current.toggle(uid, checked);
                syncPreview();
              }}
              onPreviewDialogButton={(id) => {
                if (previewRtRef.current) previewRtRef.current.click("dlg:" + id);
                syncPreview();
              }}
              onDeployPreviewToDevice={() => handleRunApp()}
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
              onClearLogcat={() => {
                logClearRef.current = rtRef.current ? rtRef.current.logs.length : 0;
                setLogcatEntries([]);
              }}
              onRestartLogcat={() => {
                logClearRef.current = 0;
                syncRuntime();
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
                const norm = cmd.trim().toLowerCase();
                let res = executeStudioTerminal(cmd, activePreset, devices);
                if (norm === "./gradlew assembledebug" || norm === "gradlew assembledebug") {
                  const built = compileProject(":app:assembleDebug");
                  res = { lines: built.lines };
                } else if (norm === "adb logcat -d" || norm === "adb logcat") {
                  const rt = rtRef.current;
                  res = {
                    lines: rt && rt.logs.length
                      ? rt.logs.map((l) => `${logcatTime(l.ts)} ${l.level}/${l.tag}: ${l.message}`)
                      : ["(logcat is empty: press Run to start the app)"],
                  };
                }
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
                setStatusMessage("LabMate cannot save emulator screenshots: use your operating system's screenshot tool")
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
            if (msg === "KEYCODE_BACK" && rtRef.current) {
              rtRef.current.back();
              syncRuntime();
            } else if (msg === "KEYCODE_BACK") {
              setStatusMessage("No app is running");
            } else {
              setStatusMessage(msg.indexOf("KEYCODE") === 0 ? `${msg} is not simulated by LabMate` : msg);
            }
          }}
          screen={screen}
          onEmuClick={handleEmuClick}
          onEmuInput={handleEmuInput}
          onEmuToggle={handleEmuToggle}
          onEmuDialogButton={handleEmuDialogButton}
          onEmuDismissCrash={handleEmuDismissCrash}
          gradleTasks={DEFAULT_GRADLE_TASKS}
          onExecuteGradleTask={(taskName) => {
            if (taskName === "assembleDebug") {
              handleAssembleProject();
            } else {
              setBottomTab("build");
              setBuildConsoleLines([
                `:app:${taskName} is not supported: LabMate compiles Kotlin in the browser and only implements assembleDebug (the Run button).`,
              ]);
              setStatusMessage(`:app:${taskName} is not supported by LabMate`);
            }
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
        <span
          style={{ marginLeft: "auto", padding: "0 10px", fontSize: 11, color: "#E8A33D", whiteSpace: "nowrap" }}
          title="Kotlin runs in a browser interpreter, not the real Kotlin compiler or an Android device. Not supported: Gradle, third-party libraries, threads/coroutines, network, Fragments, RecyclerView, Room, sensors."
          data-testid="practice-label"
        >
          LabMate practice environment: not the real Android Studio
        </span>
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
