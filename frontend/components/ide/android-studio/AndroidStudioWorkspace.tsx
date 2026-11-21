"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./androidStudio.module.css";
import { useStudioHook } from "../../netlab/studioHook";
import { androidPractical, type AndroidPracticalFrame } from "@/lib/ide/androidPracticals";
import {
  STUDIO_PRESETS,
  DEFAULT_UI_PRESET_ID,
  DEFAULT_DEVICES,
  AndroidViewMode,
  EditorSplitMode,
  DesignSurfaceMode,
  StudioFile,
  StudioProjectPreset,
  StudioDeviceProfile,
  LogcatEntry,
  GradleBuildStep,
  AndroidTreeNode,
  StudioProblem,
  NewProjectOptions,
  buildAndroidProjectTree,
  analyzeStudioProblems,
  extractPreviewTree,
  createInitialLogcatEntries,
  filterLogcatEntries,
  executeStudioTerminal,
  createNewAndroidProject,
  createProjectFile,
  createProjectFolder,
  renameProjectFile,
  deleteProjectFile,
  computeProjectGitStatus,
} from "@/lib/ide/androidStudioEngine";
import {
  AndroidCapabilities,
  AndroidApkArtifact,
  AndroidBuildTask,
  buildAndroidProjectRemote,
  fetchAndroidCapabilitiesRemote,
} from "@/lib/ide/androidRemote";
import {
  AndroidRuntimeSession,
  dispatchRuntimeWidgetClick,
  launchAndroidRuntimeSession,
  navigateRuntimeBack,
  parseAndroidManifest,
  toggleRuntimeCheckedValue,
  updateRuntimeInputValue,
} from "@/lib/ide/androidActivityRuntime";
import { StudioHeaderToolbar, RunConfigurationId } from "./StudioHeaderToolbar";
import {
  StudioLeftStripe,
  StudioRightStripe,
  LeftToolId,
  RightToolId,
  BottomToolId,
} from "./StudioStripes";
import { AndroidProjectTree } from "./AndroidProjectTree";
import { EditorCommandSignal, StudioEditorSplitPane } from "./StudioEditorSplitPane";
import { NotificationItem, StudioRightPanel } from "./StudioRightPanel";
import { StudioBottomWindow } from "./StudioBottomWindow";
import {
  NewProjectModal,
  ProjectItemModal,
  RuntimeCapabilitiesModal,
  SearchEverywhereModal,
  ShortcutsModal,
} from "./StudioModals";
import {
  AndroidHeadIcon,
  GradleFileIcon,
  JavaFileIcon,
  KotlinFileIcon,
  VcsBranchIcon,
  XmlFileIcon,
} from "./StudioIcons";

const LS_PROJECTS_KEY = "labmate_android_studio_projects_v2";
const LS_ACTIVE_ID_KEY = "labmate_android_studio_active_id_v2";
const LS_THEME_KEY = "labmate_android_studio_theme_v1";
const preferencesKey = (project: StudioProjectPreset) => "labmate.android.preferences:" + project.id + ":" + project.packageName;

function launchProject(project: StudioProjectPreset) {
  let preferences: Record<string, number> = {};
  try {
    const saved = JSON.parse(localStorage.getItem(preferencesKey(project)) || "{}");
    if (saved && typeof saved === "object") {
      preferences = Object.fromEntries(Object.entries(saved).filter(([, value]) => Number.isInteger(value))) as Record<string, number>;
    }
  } catch { /* A fresh app can start without stored preferences. */ }
  return launchAndroidRuntimeSession(project.files, project.packageName, preferences);
}

function clonePreset(p: StudioProjectPreset): StudioProjectPreset {
  return {
    ...p,
    folders: p.folders ? [...p.folders] : [],
    snapshotFiles: p.snapshotFiles ? p.snapshotFiles.map((f) => ({ ...f })) : p.files.map((f) => ({ ...f })),
    files: p.files.map((f) => ({ ...f })),
  };
}

function collectExpandableNodeIds(nodes: AndroidTreeNode[]): string[] {
  const out: string[] = [];
  function walk(list: AndroidTreeNode[]) {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n.children && n.children.length > 0) {
        out.push(n.id);
        walk(n.children);
      }
    }
  }
  walk(nodes);
  return out;
}

export const AndroidStudioWorkspace: React.FC<{ capture?: boolean }> = ({ capture = false }) => {
  const defaultPreset = useMemo(
    () => STUDIO_PRESETS.find((p) => p.id === DEFAULT_UI_PRESET_ID) ?? STUDIO_PRESETS[0],
    []
  );

  // Theme
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Projects catalog (presets + user created)
  const [projects, setProjects] = useState<StudioProjectPreset[]>(() =>
    STUDIO_PRESETS.map((p) => clonePreset(p))
  );
  const [activePresetId, setActivePresetId] = useState<string>(defaultPreset.id);
  const [dirtyFileIds, setDirtyFileIds] = useState<Set<string>>(() => new Set());
  const [branches, setBranches] = useState<string[]>(["main"]);
  const [activeBranch, setActiveBranch] = useState<string>("main");

  const activePreset = useMemo(() => {
    const found = projects.find((p) => p.id === activePresetId) ?? projects[0];
    return { ...found, branch: activeBranch };
  }, [projects, activePresetId, activeBranch]);

  const files = activePreset.files;

  // Tabs & Active File
  const [openTabIds, setOpenTabIds] = useState<string[]>(() =>
    defaultPreset.files.slice(0, 3).map((f) => f.id)
  );
  const [activeFileId, setActiveFileId] = useState<string>(() => defaultPreset.files[0]?.id ?? "");
  const [selectedNodeId, setSelectedNodeId] = useState<string>("node-main-activity");

  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId) ?? files[0],
    [files, activeFileId]
  );

  // View & Panels
  const [viewMode, setViewMode] = useState<AndroidViewMode>("Android");
  const [leftTab, setLeftTab] = useState<LeftToolId | null>("project");
  const [rightTab, setRightTab] = useState<RightToolId | null>("runningDevices");
  const [bottomTab, setBottomTab] = useState<BottomToolId | null>("logcat");

  // Editor State
  const [splitMode, setSplitMode] = useState<EditorSplitMode>("Split");
  const [surfaceMode, setSurfaceMode] = useState<DesignSurfaceMode>("Design");
  const [composeClickCount, setComposeClickCount] = useState<number>(0);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [commandSignal, setCommandSignal] = useState<EditorCommandSignal | null>(null);

  const treeNodes = useMemo(
    () => buildAndroidProjectTree(activePreset, viewMode),
    [activePreset, viewMode]
  );

  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() =>
    new Set([
      "node-app",
      "node-manifests",
      "node-kotlin-java",
      "node-pkg-main",
      "node-pkg-unit-test",
      "node-pkg-android-test",
      "node-res",
      "node-res-layout",
      "node-res-values",
      "node-gradle-scripts",
      "proj-root",
      "proj-app",
      "pkg-root",
    ])
  );

  // Devices & Capabilities
  const [devices, setDevices] = useState<StudioDeviceProfile[]>(DEFAULT_DEVICES);
  const [activeDeviceId, setActiveDeviceId] = useState<string>(DEFAULT_DEVICES[0].id);
  const [capabilities, setCapabilities] = useState<AndroidCapabilities | null>(null);

  const activeDevice = useMemo(
    () => devices.find((d) => d.id === activeDeviceId) ?? devices[0],
    [devices, activeDeviceId]
  );

  // Runtime & Build State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeRunConfig, setActiveRunConfig] = useState<RunConfigurationId>("app");
  const [runtimeSession, setRuntimeSession] = useState<AndroidRuntimeSession>(() => ({
    activePackageName: defaultPreset.packageName,
    appLabel: "StudentPortal",
    activityStack: [
      {
        activityName: "MainActivity",
        layoutFilePath: "app/src/main/res/layout/activity_main.xml",
        layoutName: "activity_main",
        extras: {},
        stateVars: { greetCount: 0 },
        widgetTextOverrides: {},
        inputValues: { etName: "" },
        checkedValues: {},
        visibilityOverrides: {},
      },
    ],
    toasts: [],
    isHomeScreen: false,
    recentsOpen: false,
    crashError: null,
    lastLaunchTimeMs: 0,
  }));
  const [captureFrame, setCaptureFrame] = useState("");
  useStudioHook<Record<string, never>, AndroidPracticalFrame>({
    load: () => { },
    show: (step) => {
      if (!capture) return;
      const opened = step.project.files.find((file) => file.name === step.file);
      const keyTabs = step.project.files.filter((file) =>
        ["MainActivity.java", "activity_main.xml", "SecondActivity.java"].includes(file.name) || file.id === opened?.id,
      );
      setProjects([step.project]);
      setActivePresetId(step.project.id);
      setOpenTabIds(keyTabs.length ? keyTabs.map((file) => file.id) : (opened ? [opened.id] : []));
      setActiveFileId(opened?.id || keyTabs[0]?.id || "");
      setSplitMode(step.file.endsWith(".xml") ? "Split" : "Code");
      setRuntimeSession(step.session);
      setIsRunning(true);
      setRightTab("runningDevices");
      setBottomTab(null);
      setStatusMessage(`${step.title} — ${step.explain} (Verified in LabMate's interactive Android runtime)`);
      setCaptureFrame(step.id);
    },
  }, captureFrame);
  useEffect(() => {
    if (!capture) return;
    window.__labmatePractical = androidPractical;
    return () => { delete window.__labmatePractical; };
  }, [capture]);

  const [logcatEntries, setLogcatEntries] = useState<LogcatEntry[]>(() =>
    createInitialLogcatEntries(defaultPreset.packageName)
  );
  const [logcatQuery, setLogcatQuery] = useState<string>("package:mine ");

  const [buildStatus, setBuildStatus] = useState<"idle" | "building" | "success" | "failed">("idle");
  const [buildSteps, setBuildSteps] = useState<GradleBuildStep[]>([]);
  const [buildConsoleLines, setBuildConsoleLines] = useState<string[]>([]);
  const [backendProblems, setBackendProblems] = useState<StudioProblem[]>([]);
  const [apkArtifact, setApkArtifact] = useState<AndroidApkArtifact | null>(null);
  const [runConsoleLines, setRunConsoleLines] = useState<string[]>([]);
  const [terminalHistory, setTerminalHistory] = useState<
    { id: string; command: string; output: string[] }[]
  >([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("Ready");

  // Modals
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [itemModal, setItemModal] = useState<{
    open: boolean;
    mode: "newFile" | "newFolder" | "rename";
    defaultDir: string;
    initialName: string;
    targetFileId?: string;
  }>({ open: false, mode: "newFile", defaultDir: "", initialName: "" });
  const [capsModalOpen, setCapsModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

  const lastShiftRef = useRef<number>(0);

  // Hydrate saved theme & custom projects cleanly on mount (SSR safe)
  useEffect(() => {
    if (capture) return;
    try {
      const savedTheme = localStorage.getItem(LS_THEME_KEY);
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }
      const savedProjectsRaw = localStorage.getItem(LS_PROJECTS_KEY);
      if (savedProjectsRaw) {
        const parsed = JSON.parse(savedProjectsRaw) as StudioProjectPreset[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProjects(parsed);
          const savedActive = localStorage.getItem(LS_ACTIVE_ID_KEY);
          const chosen = parsed.find((p) => p.id === savedActive) || parsed.find((p) => p.id === DEFAULT_UI_PRESET_ID) || parsed[0];
          if (chosen) {
            setActivePresetId(chosen.id);
            setOpenTabIds(chosen.files.slice(0, 3).map((f) => f.id));
            setActiveFileId(chosen.files[0]?.id ?? "");
            const launched = launchProject(chosen);
            setRuntimeSession(launched.session);
            setLogcatEntries(launched.logs);
          }
        }
      } else {
        const launched = launchProject(defaultPreset);
        setRuntimeSession(launched.session);
        setLogcatEntries(launched.logs);
      }
    } catch {
      const launched = launchProject(defaultPreset);
      setRuntimeSession(launched.session);
      setLogcatEntries(launched.logs);
    }
  }, [defaultPreset, capture]);

  const persistWorkspace = useCallback(
    (nextProjects: StudioProjectPreset[], nextActiveId: string) => {
      try {
        localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(nextProjects));
        localStorage.setItem(LS_ACTIVE_ID_KEY, nextActiveId);
      } catch {
        // Ignore storage quota warnings cleanly
      }
    },
    []
  );

  const pushNotification = useCallback((title: string, detail: string) => {
    setNotifications((prev) => [{ id: `n-${Date.now()}`, title, detail }, ...prev].slice(0, 20));
  }, []);

  const updateCurrentProject = useCallback(
    (updater: (proj: StudioProjectPreset) => StudioProjectPreset) => {
      setProjects((prev) => {
        const next = prev.map((p) => (p.id === activePresetId ? updater(p) : p));
        persistWorkspace(next, activePresetId);
        return next;
      });
    },
    [activePresetId, persistWorkspace]
  );

  const staticProblems = useMemo(() => analyzeStudioProblems(files), [files]);

  const combinedProblems = useMemo(() => {
    const merged: StudioProblem[] = [...staticProblems];
    for (let i = 0; i < backendProblems.length; i++) {
      const bp = backendProblems[i];
      const dup = merged.some((sp) => sp.fileId === bp.fileId && sp.line === bp.line && sp.message === bp.message);
      if (!dup) merged.push(bp);
    }
    return merged;
  }, [staticProblems, backendProblems]);

  const filteredLogcat = useMemo(
    () => filterLogcatEntries(logcatEntries, logcatQuery, activePreset.packageName),
    [logcatEntries, logcatQuery, activePreset.packageName]
  );

  const gitChanges = useMemo(
    () => computeProjectGitStatus(files, activePreset.snapshotFiles),
    [files, activePreset.snapshotFiles]
  );

  const previewTree = useMemo(
    () => extractPreviewTree(files, activeFile?.id ?? "main-activity", composeClickCount),
    [files, activeFile?.id, composeClickCount]
  );

  const isComposeProject = useMemo(() => {
    const manifest = parseAndroidManifest(files, activePreset.packageName);
    const launcherFile = files.find(
      (f) => f.name.replace(/\.(java|kt)$/, "") === manifest.launcherActivity
    );
    return Boolean(launcherFile && launcherFile.kind === "kotlin" && /\bsetContent\s*\{/.test(launcherFile.content) && !/\bsetContentView\s*\(/.test(launcherFile.content));
  }, [files, activePreset.packageName]);

  // Project & File Actions
  const handleSelectPreset = useCallback(
    (presetId: string) => {
      const target = projects.find((p) => p.id === presetId);
      if (!target) return;
      setActivePresetId(presetId);
      setActiveBranch(target.branch || "main");
      setOpenTabIds(target.files.slice(0, 3).map((f) => f.id));
      setActiveFileId(target.files[0]?.id ?? "");
      setDirtyFileIds(new Set());
      setBackendProblems([]);
      setApkArtifact(null);
      setBuildStatus("idle");
      setBuildSteps([]);
      setBuildConsoleLines([]);
      const launched = launchProject(target);
      setRuntimeSession(launched.session);
      setLogcatEntries(launched.logs);
      setIsRunning(false);
      persistWorkspace(projects, presetId);
      setStatusMessage(`Opened project ${target.name}`);
    },
    [projects, persistWorkspace]
  );

  const handleSelectFile = useCallback(
    (fileId: string) => {
      setActiveFileId(fileId);
      setOpenTabIds((prev) => (prev.indexOf(fileId) >= 0 ? prev : [...prev, fileId]));
      const target = files.find((f) => f.id === fileId);
      if (target?.isLayoutXml || (target?.path || "").indexOf("res/layout/") >= 0) {
        setSplitMode("Split");
      } else if (target?.hasComposePreview) {
        setSplitMode("Split");
      } else {
        setSplitMode("Code");
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
      setBackendProblems((prev) => prev.filter((p) => p.fileId !== fileId));
      setProjects((prev) => {
        const next = prev.map((p) =>
          p.id === activePresetId
            ? {
              ...p,
              files: p.files.map((f) => (f.id === fileId ? { ...f, content: newContent } : f)),
            }
            : p
        );
        persistWorkspace(next, activePresetId);
        return next;
      });
      setDirtyFileIds((prev) => {
        const next = new Set(Array.from(prev));
        next.add(fileId);
        return next;
      });
    },
    [activePresetId, persistWorkspace]
  );

  const handleCreateNewProject = useCallback(
    (opts: NewProjectOptions) => {
      const created = createNewAndroidProject(opts);
      const nextProjects = [...projects, created];
      setProjects(nextProjects);
      setActivePresetId(created.id);
      setActiveBranch("main");
      setOpenTabIds(created.files.slice(0, 3).map((f) => f.id));
      setActiveFileId(created.files[0]?.id ?? "");
      setDirtyFileIds(new Set());
      setBackendProblems([]);
      setApkArtifact(null);
      setBuildStatus("idle");
      setBuildSteps([]);
      setBuildConsoleLines([]);
      const launched = launchAndroidRuntimeSession(created.files, created.packageName);
      setRuntimeSession(launched.session);
      setLogcatEntries(launched.logs);
      persistWorkspace(nextProjects, created.id);
      setStatusMessage(`Created new project '${created.name}' (${created.packageName})`);
      pushNotification("Project Created", `${created.name} (${created.template}) ready.`);
    },
    [projects, persistWorkspace, pushNotification]
  );

  const handleSaveAll = useCallback(() => {
    persistWorkspace(projects, activePresetId);
    setDirtyFileIds(new Set());
    setStatusMessage(`Saved ${activePreset.name} changes to browser storage`);
  }, [projects, activePresetId, activePreset.name, persistWorkspace]);

  const handleResetToTemplate = useCallback(() => {
    updateCurrentProject((proj) => ({
      ...proj,
      files: (proj.snapshotFiles || proj.files).map((f) => ({ ...f })),
    }));
    setDirtyFileIds(new Set());
    setBackendProblems([]);
    setStatusMessage(`Reset ${activePreset.name} files to baseline snapshot`);
  }, [updateCurrentProject, activePreset.name]);

  // Real Backend Isolated Build (with honest offline/unauthenticated reporting)
  const handleBuildTask = useCallback(
    async (task: AndroidBuildTask): Promise<string[]> => {
      setBuildStatus("building");
      setBottomTab("build");
      setStatusMessage(`Running :app:${task}...`);
      setApkArtifact(null);

      const fileMap: Record<string, string> = {};
      for (let i = 0; i < files.length; i++) {
        fileMap[files[i].path] = files[i].content;
      }

      const outcome = await buildAndroidProjectRemote(fileMap, task, activePreset.packageName);

      if (outcome.ok) {
        const res = outcome.result;
        setBuildSteps(res.steps);
        setBuildConsoleLines(res.logs);
        setCapabilities(res.capabilities);
        setApkArtifact(res.artifact);
        setBuildStatus(res.success ? "success" : "failed");

        const mappedDiags: StudioProblem[] = res.diagnostics.map((d, idx) => {
          const matchedFile = files.find(
            (f) => f.path === d.file || d.file.endsWith("/" + f.name) || f.name === d.file
          );
          return {
            id: `javac-${idx}-${d.line}`,
            fileId: matchedFile ? matchedFile.id : files[0]?.id || "main-activity",
            fileName: matchedFile ? matchedFile.tabTitle : d.file,
            line: d.line || 1,
            column: d.column || 1,
            severity: d.severity || "error",
            message: d.message,
          };
        });
        setBackendProblems(mappedDiags);

        if (res.success) {
          const msg =
            task === "assembleDebug" && res.artifact
              ? `BUILD SUCCESSFUL in ${res.duration_ms}ms — ${res.artifact.filename} ready`
              : `BUILD SUCCESSFUL in ${res.duration_ms}ms`;
          setStatusMessage(msg);
          pushNotification(`:app:${task} Succeeded`, msg);
        } else {
          setStatusMessage(`BUILD FAILED (${res.diagnostics.length} diagnostic(s))`);
          pushNotification(`:app:${task} Failed`, res.error || "Compilation failed");
        }
        return res.logs;
      }

      // Honest reporting when backend requires sign-in or is unreachable (NO fake build success!)
      const localErrors = staticProblems.filter((p) => p.severity === "error");
      const lines = [
        `> Task :app:validateProjectLocal`,
        outcome.message,
      ];
      if (localErrors.length > 0) {
        setBuildStatus("failed");
        setBuildSteps([{ id: "local-chk", label: ":app:validateLocalSyntax", status: "failed", durationMs: 4 }]);
        localErrors.forEach((e) => lines.push(`e: ${e.fileName}:${e.line}:${e.column}: ${e.message}`));
        lines.push("BUILD FAILED (local XML/syntax errors found)");
      } else {
        setBuildStatus(outcome.requiresAuth ? "idle" : "failed");
        setBuildSteps([{ id: "local-chk", label: ":app:validateLocalSyntax", status: "success", durationMs: 3 }]);
        lines.push(`Local XML & syntax check passed (${files.length} files inspected).`);
        lines.push("Real javac compilation was NOT run because isolated backend compilation requires sign-in.");
      }
      setBuildConsoleLines(lines);
      setStatusMessage(outcome.requiresAuth ? "Sign in required for isolated javac build" : outcome.message);
      pushNotification("Backend Build Unavailable", outcome.message);
      return lines;
    },
    [files, activePreset.packageName, staticProblems, pushNotification]
  );

  const handleDownloadApk = useCallback(() => {
    if (!apkArtifact) return;
    const raw = atob(apkArtifact.base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/vnd.android.package-archive" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activePreset.name.toLowerCase()}-debug.apk`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage(`Downloaded ${a.download} (${apkArtifact.size_bytes} bytes)`);
  }, [apkArtifact, activePreset.name]);

  // Run / Debug interactive session
  const handleRunApp = useCallback(
    (mode: "run" | "debug" = "run") => {
      const blockingErrors = combinedProblems.filter((p) => p.severity === "error");
      if (blockingErrors.length > 0) {
        setIsRunning(false);
        setBottomTab("problems");
        setStatusMessage(`Cannot launch app: ${blockingErrors.length} error(s) in project`);
        setRunConsoleLines([
          "Launch aborted due to project errors:",
          ...blockingErrors.map((e) => `  ${e.fileName}:${e.line}: ${e.message}`),
        ]);
        return;
      }

      const step = launchProject(activePreset);
      setRuntimeSession(step.session);

      const debugExtra: LogcatEntry[] =
        mode === "debug"
          ? [
            {
              id: `dbg-${Date.now()}`,
              timestamp: step.logs[0]?.timestamp || "00:00:00.000",
              pid: 6410,
              tid: 6410,
              tag: "DebuggerTrace",
              packageName: activePreset.packageName,
              level: "D",
              message: `Debug trace enabled on ${activeDevice.name}; watching lifecycle, Intent & View events.`,
            },
          ]
          : [];

      setLogcatEntries((prev) => [...prev, ...debugExtra, ...step.logs]);
      setRunConsoleLines([
        `$ runtime-launch ${activePreset.packageName}/.${step.session.activityStack[0]?.activityName || "MainActivity"} on '${activeDevice.name}'`,
        ...step.stdout.map((s) => `System.out: ${s}`),
        ...(step.error
          ? [`FATAL EXCEPTION: ${step.error}`]
          : [`Started ${step.session.appLabel} cleanly in Interactive Browser Android Runtime.`]),
      ]);
      setIsRunning(!step.error);
      setRightTab("runningDevices");
      setBottomTab("logcat");
      setStatusMessage(
        step.error
          ? `Runtime exception in ${activePreset.name}: ${step.error}`
          : `${mode === "debug" ? "Debugging" : "Running"} ${activePreset.packageName} on ${activeDevice.name}`
      );
    },
    [combinedProblems, activePreset, activeDevice.name]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const now = Date.now();
        if (now - lastShiftRef.current < 320) {
          lastShiftRef.current = 0;
          setSearchModalOpen((v) => !v);
        } else {
          lastShiftRef.current = now;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveAll();
      } else if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setCommandSignal({ seq: Date.now(), kind: "format" });
      } else if ((e.ctrlKey || e.metaKey) && e.key === "F9") {
        e.preventDefault();
        handleBuildTask("compile");
      } else if (e.shiftKey && e.key === "F10") {
        e.preventDefault();
        handleRunApp("run");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSaveAll, handleBuildTask, handleRunApp]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(LS_THEME_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleTerminalCommand = useCallback(
    async (cmd: string) => {
      const lower = cmd.trim().toLowerCase();
      if (lower === "adb logcat") {
        setTerminalHistory((prev) => [
          ...prev,
          {
            id: `term-${Date.now()}`,
            command: cmd,
            output: logcatEntries.slice(-20).map((l) => `${l.timestamp} ${l.level}/${l.tag}: ${l.message}`),
          },
        ]);
        return;
      }
      if (
        lower === "./gradlew assembledebug" ||
        lower === "gradlew assembledebug" ||
        lower === "./gradlew compiledebugjava" ||
        lower === "gradlew compiledebugjava" ||
        lower === "./gradlew test" ||
        lower === "gradlew test" ||
        lower === "./gradlew clean" ||
        lower === "gradlew clean"
      ) {
        const task: AndroidBuildTask =
          lower.indexOf("assemble") >= 0
            ? "assembleDebug"
            : lower.indexOf("test") >= 0
              ? "test"
              : lower.indexOf("clean") >= 0
                ? "clean"
                : "compile";
        const outLines = await handleBuildTask(task);
        setBottomTab("terminal");
        setTerminalHistory((prev) => [
          ...prev,
          { id: `term-${Date.now()}`, command: cmd, output: outLines },
        ]);
        return;
      }

      const res = executeStudioTerminal(cmd, activePreset, devices);
      if (res.clear) {
        setTerminalHistory([]);
      } else {
        setTerminalHistory((prev) => [
          ...prev,
          { id: `term-${Date.now()}`, command: cmd, output: res.lines },
        ]);
      }
    },
    [logcatEntries, handleBuildTask, activePreset, devices]
  );

  return (
    <div className={styles.studioRoot} data-theme={theme}>
      <StudioHeaderToolbar
        projects={projects}
        activePreset={activePreset}
        onSelectPreset={handleSelectPreset}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        activeBranch={activeBranch}
        branches={branches}
        onSelectBranch={(b) => {
          setActiveBranch(b);
          setStatusMessage(`Switched branch to '${b}'`);
        }}
        onCreateBranch={() => {
          const nextBranch = `lab-work-${branches.length + 1}`;
          setBranches((prev) => [...prev, nextBranch]);
          setActiveBranch(nextBranch);
          setStatusMessage(`Created branch '${nextBranch}'`);
        }}
        devices={devices}
        activeDevice={activeDevice}
        onSelectDevice={setActiveDeviceId}
        runConfig={activeRunConfig}
        onSelectRunConfig={setActiveRunConfig}
        isAppRunning={isRunning}
        isBuilding={buildStatus === "building"}
        hasApkArtifact={Boolean(apkArtifact)}
        onNewProject={() => setNewProjectOpen(true)}
        onNewFile={() =>
          setItemModal({
            open: true,
            mode: "newFile",
            defaultDir: `app/src/main/java/${activePreset.packageName.replace(/\./g, "/")}`,
            initialName: "SecondActivity.java",
          })
        }
        onNewFolder={() =>
          setItemModal({
            open: true,
            mode: "newFolder",
            defaultDir: "app/src/main/res",
            initialName: "menu",
          })
        }
        onRenameActiveFile={() => {
          if (activeFile) {
            setItemModal({
              open: true,
              mode: "rename",
              defaultDir: "",
              initialName: activeFile.name,
              targetFileId: activeFile.id,
            });
          }
        }}
        onSaveProject={handleSaveAll}
        onResetProject={handleResetToTemplate}
        onOpenFind={(replace) =>
          setCommandSignal({ seq: Date.now(), kind: replace ? "replace" : "find" })
        }
        onReformatCode={() => setCommandSignal({ seq: Date.now(), kind: "format" })}
        onToggleComment={() => setCommandSignal({ seq: Date.now(), kind: "comment" })}
        onTriggerAutocomplete={() => setCommandSignal({ seq: Date.now(), kind: "autocomplete" })}
        onSwitchSplitMode={setSplitMode}
        onOpenLeftTool={setLeftTab}
        onOpenBottomTool={setBottomTab}
        onOpenRightTool={setRightTab}
        onSelectNamedFile={(kind) => {
          const target =
            kind === "manifest"
              ? files.find((f) => f.kind === "manifest")
              : kind === "layout"
                ? files.find((f) => f.isLayoutXml)
                : files.find((f) => f.id === "main-activity" || /MainActivity\.(java|kt)$/.test(f.name));
          if (target) handleSelectFile(target.id);
        }}
        onRunApp={handleRunApp}
        onStopApp={() => {
          setIsRunning(false);
          setStatusMessage(`Stopped ${activePreset.packageName}`);
        }}
        onBuildTask={handleBuildTask}
        onDownloadApk={handleDownloadApk}
        onRunGitStatusTerminal={() => {
          setBottomTab("terminal");
          handleTerminalCommand("git status");
        }}
        onOpenDeviceManager={() => setRightTab("deviceManager")}
        onOpenCapabilities={() => {
          setCapsModalOpen(true);
          fetchAndroidCapabilitiesRemote().then((caps) => {
            if (caps) setCapabilities(caps);
          });
        }}
        onOpenSearchEverywhere={() => setSearchModalOpen(true)}
        onOpenShortcuts={() => setShortcutsModalOpen(true)}
      />

      <div className={styles.mainArea}>
        <StudioLeftStripe
          activeLeftTool={leftTab}
          onToggleLeftTool={(t: LeftToolId) => setLeftTab((curr) => (curr === t ? null : t))}
          activeBottomTool={bottomTab}
          onToggleBottomTool={(t: BottomToolId) => setBottomTab((curr) => (curr === t ? null : t))}
          problemsCount={combinedProblems.length}
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
            onToggleExpand={(nodeId) =>
              setExpandedNodeIds((prev) => {
                const next = new Set(Array.from(prev));
                if (next.has(nodeId)) next.delete(nodeId);
                else next.add(nodeId);
                return next;
              })
            }
            onExpandAll={() => setExpandedNodeIds(new Set(collectExpandableNodeIds(treeNodes)))}
            onCollapseAll={() => setExpandedNodeIds(new Set(["node-app", "proj-root"]))}
            selectedNodeId={selectedNodeId}
            activeFileId={activeFileId}
            files={files}
            dirtyFileIds={dirtyFileIds}
            onSelectTreeNode={(node) => {
              setSelectedNodeId(node.id);
              if (node.fileId) {
                handleSelectFile(node.fileId);
              }
            }}
            onOpenFileById={handleSelectFile}
            onRequestNewFile={(dir) =>
              setItemModal({
                open: true,
                mode: "newFile",
                defaultDir: dir || `app/src/main/java/${activePreset.packageName.replace(/\./g, "/")}`,
                initialName: dir && dir.indexOf("layout") >= 0 ? "activity_detail.xml" : "DetailActivity.java",
              })
            }
            onRequestNewFolder={(dir) =>
              setItemModal({
                open: true,
                mode: "newFolder",
                defaultDir: dir || "app/src/main/res",
                initialName: "menu",
              })
            }
            onRequestRenameFile={(fileId) => {
              const target = files.find((f) => f.id === fileId);
              if (target) {
                setItemModal({
                  open: true,
                  mode: "rename",
                  defaultDir: "",
                  initialName: target.name,
                  targetFileId: fileId,
                });
              }
            }}
            onDeleteFile={(fileId) => {
              if (files.length <= 1) {
                setStatusMessage("Cannot delete the last remaining file in project.");
                return;
              }
              updateCurrentProject((proj) => deleteProjectFile(proj, fileId));
              setOpenTabIds((prev) => {
                const remaining = prev.filter((id) => id !== fileId);
                if (activeFileId === fileId) {
                  const fallback = files.find((f) => f.id !== fileId);
                  setActiveFileId(remaining[remaining.length - 1] ?? fallback?.id ?? "");
                }
                return remaining;
              });
              setStatusMessage("Deleted file from project");
            }}
            onCommitChanges={(msg) => {
              updateCurrentProject((proj) => ({
                ...proj,
                snapshotFiles: proj.files.map((f) => ({ ...f })),
              }));
              setDirtyFileIds(new Set());
              setStatusMessage(`Saved local snapshot: ${msg}`);
            }}
            onHidePanel={() => setLeftTab(null)}
          />
        )}

        <div className={styles.centerStack}>
          {activeFile && (
            <StudioEditorSplitPane
              allFiles={files}
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
              onRunFromGutter={() => handleRunApp("run")}
              onDeployPreviewToDevice={() => handleRunApp("run")}
              problems={combinedProblems}
              onOpenProblemsPanel={() => setBottomTab("problems")}
              cursorPos={cursorPos}
              onChangeCursorPos={setCursorPos}
              commandSignal={commandSignal}
            />
          )}

          {bottomTab && (
            <StudioBottomWindow
              height={235}
              projectName={activePreset.name}
              activeBranch={activeBranch}
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
              onRestartLogcat={() => {
                const step = launchProject(activePreset);
                setRuntimeSession(step.session);
                setLogcatEntries(step.logs);
              }}
              buildStatus={buildStatus}
              buildSteps={buildSteps}
              buildConsoleLines={buildConsoleLines}
              apkArtifact={apkArtifact}
              onDownloadApk={handleDownloadApk}
              runConsoleLines={runConsoleLines}
              problems={combinedProblems}
              onSelectProblem={(p: StudioProblem) => {
                handleSelectFile(p.fileId);
                setCursorPos({ line: p.line, col: p.column });
                setCommandSignal({ seq: Date.now(), kind: "gotoLine", line: p.line });
              }}
              terminalHistory={terminalHistory}
              onExecuteTerminal={handleTerminalCommand}
              onClearTerminal={() => setTerminalHistory([])}
              gitChanges={gitChanges}
              onOpenFileById={handleSelectFile}
              onResetProject={handleResetToTemplate}
            />
          )}
        </div>

        <StudioRightPanel
          activeTab={rightTab}
          projectName={activePreset.name}
          files={files}
          devices={devices}
          activeDeviceId={activeDeviceId}
          onSelectDevice={setActiveDeviceId}
          onToggleDeviceOnline={(id) =>
            setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, booted: !d.booted } : d)))
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
                androidVersion: `Android ${apiLevel >= 35 ? "15" : apiLevel === 34 ? "14" : "13"}`,
                widthDp: 412,
                heightDp: 915,
                formFactor: "Phone",
                booted: true,
              },
            ]);
            setActiveDeviceId(newId);
            setStatusMessage(`Added virtual device profile '${name}'`);
          }}
          runtimeSession={runtimeSession}
          previewTree={previewTree}
          activeAppRunning={isRunning}
          isComposeProject={isComposeProject}
          onRestartRuntimeApp={() => handleRunApp("run")}
          onInputChange={(widgetId, value) =>
            setRuntimeSession((prev) => updateRuntimeInputValue(prev, widgetId, value))
          }
          onToggleChecked={(widgetId) =>
            setRuntimeSession((prev) => toggleRuntimeCheckedValue(prev, widgetId))
          }
          onWidgetClick={(widgetId, onClickMethodName) => {
            const step = dispatchRuntimeWidgetClick(runtimeSession, files, widgetId, onClickMethodName);
            if (!capture && step.session.integerPreferences && !step.error) {
              try { localStorage.setItem(preferencesKey(activePreset), JSON.stringify(step.session.integerPreferences)); } catch { }
            }
            setRuntimeSession(step.session);
            if (step.logs.length > 0) {
              setLogcatEntries((prev) => [...prev, ...step.logs]);
            }
            if (step.stdout.length > 0) {
              setRunConsoleLines((prev) => [...prev, ...step.stdout]);
            }
            if (step.error) {
              setStatusMessage(`Runtime exception: ${step.error}`);
            } else {
              const prevTop =
                runtimeSession.activityStack[runtimeSession.activityStack.length - 1]?.activityName;
              const nextTop =
                step.session.activityStack[step.session.activityStack.length - 1]?.activityName;
              if (nextTop && nextTop !== prevTop) {
                setStatusMessage(`Active Activity: .${nextTop}`);
              }
            }
          }}
          onComposeIncrement={() => {
            setComposeClickCount((c) => {
              const next = c + 1;
              setLogcatEntries((prev) => [
                ...prev,
                {
                  id: `cmp-${Date.now()}`,
                  timestamp: new Date().toISOString().replace("T", " ").slice(0, 23),
                  pid: 6410,
                  tid: 6410,
                  tag: "ComposeRuntime",
                  packageName: activePreset.packageName,
                  level: "D",
                  message: `Button clicked -> recomposed clicks=${next}`,
                },
              ]);
              return next;
            });
          }}
          onPressBack={() => {
            const step = navigateRuntimeBack(runtimeSession);
            setRuntimeSession(step.session);
            if (step.logs.length > 0) setLogcatEntries((prev) => [...prev, ...step.logs]);
            if (step.session.isHomeScreen || step.session.activityStack.length === 0) {
              setStatusMessage("Returned to Android Launcher Home");
            } else {
              const curAct =
                step.session.activityStack[step.session.activityStack.length - 1].activityName;
              setStatusMessage(`Active Activity: .${curAct}`);
            }
          }}
          onPressHome={() => {
            setRuntimeSession((prev) => ({ ...prev, isHomeScreen: true, recentsOpen: false }));
            setStatusMessage("Returned to Android Launcher Home");
          }}
          onPressRecents={() =>
            setRuntimeSession((prev) => ({
              ...prev,
              recentsOpen: !prev.recentsOpen,
              isHomeScreen: false,
            }))
          }
          onLaunchFromHome={() => handleRunApp("run")}
          onLogEmulatorEvent={(msg) => setStatusMessage(msg)}
          onBuildTask={handleBuildTask}
          capabilities={capabilities}
          notifications={notifications}
          onClosePanel={() => setRightTab(null)}
        />

        <StudioRightStripe
          activeRightTool={rightTab}
          onToggleRightTool={(t: RightToolId) => setRightTab((curr) => (curr === t ? null : t))}
          unreadNotifications={notifications.length}
        />
      </div>

      {/* Bottom Status Bar */}
      <footer className={styles.statusBar}>
        <div className={styles.statusLeft}>
          <span className={styles.statusBreadcrumbs}>
            <AndroidHeadIcon size={13} />
            {activeFile?.breadcrumbs.map((seg, i) => (
              <React.Fragment key={`${seg}-${i}`}>
                {i > 0 && <span className={styles.statusCrumbSep}>›</span>}
                <span
                  style={{
                    color: i === activeFile.breadcrumbs.length - 1 ? "var(--as-text-primary)" : undefined,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {i === activeFile.breadcrumbs.length - 1 &&
                    (activeFile.kind === "java" ? (
                      <JavaFileIcon size={12} />
                    ) : activeFile.kind === "kotlin" ? (
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
          <span style={{ color: buildStatus === "failed" ? "var(--as-red)" : "var(--as-green)" }}>
            ● {statusMessage}
          </span>
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

      {/* Modals */}
      <NewProjectModal
        open={newProjectOpen}
        onCreateProject={handleCreateNewProject}
        onClose={() => setNewProjectOpen(false)}
      />

      <ProjectItemModal
        open={itemModal.open}
        mode={itemModal.mode}
        defaultDir={itemModal.defaultDir}
        initialName={itemModal.initialName}
        packageName={activePreset.packageName}
        onConfirm={({ dir, name, registerActivity }) => {
          if (itemModal.mode === "newFile") {
            let newFileId = "";
            updateCurrentProject((proj) => {
              const res = createProjectFile(proj, {
                parentDir: dir,
                fileName: name,
                registerInManifest: registerActivity,
              });
              newFileId = res.createdFile.id;
              return res.preset;
            });
            if (newFileId) {
              setOpenTabIds((prev) => [...prev, newFileId]);
              setActiveFileId(newFileId);
            }
            setStatusMessage(`Created file '${name}'`);
          } else if (itemModal.mode === "newFolder") {
            const folderPath = dir ? `${dir.replace(/\/+$/, "")}/${name}` : name;
            updateCurrentProject((proj) => createProjectFolder(proj, folderPath));
            setStatusMessage(`Created folder '${folderPath}'`);
          } else if (itemModal.mode === "rename" && itemModal.targetFileId) {
            const fid = itemModal.targetFileId;
            updateCurrentProject((proj) => renameProjectFile(proj, fid, name));
            setStatusMessage(`Renamed file to '${name}'`);
          }
        }}
        onClose={() => setItemModal((s) => ({ ...s, open: false }))}
      />

      <RuntimeCapabilitiesModal
        open={capsModalOpen}
        capabilities={capabilities}
        onRefresh={() =>
          fetchAndroidCapabilitiesRemote().then((caps) => {
            if (caps) setCapabilities(caps);
          })
        }
        onClose={() => setCapsModalOpen(false)}
      />

      <SearchEverywhereModal
        open={searchModalOpen}
        files={files}
        onSelectFile={handleSelectFile}
        onRunAction={(act) => {
          if (act === "newProject") setNewProjectOpen(true);
          else if (act === "run") handleRunApp("run");
          else if (act === "compile") handleBuildTask("compile");
          else if (act === "assemble") handleBuildTask("assembleDebug");
          else if (act === "format") setCommandSignal({ seq: Date.now(), kind: "format" });
          else if (act === "theme") handleToggleTheme();
          else if (act === "logcat") setBottomTab("logcat");
          else if (act === "terminal") setBottomTab("terminal");
        }}
        onClose={() => setSearchModalOpen(false)}
      />

      <ShortcutsModal open={shortcutsModalOpen} onClose={() => setShortcutsModalOpen(false)} />
    </div>
  );
};
