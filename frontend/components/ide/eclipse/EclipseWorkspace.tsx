"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReportCapture, type JavaReportFrame } from "@/lib/ide/reportCapture";
import {
  analyzeJavaProblems,
  executeJavaCode,
  extractFoldableMethodLines,
  extractTodoTasks,
  formatJavaCode,
  inspectJavaAtLine,
} from "@/lib/ide/eclipseRunner";
import type { EclipseProblem, JavaExecutionResult } from "@/lib/ide/eclipseRunner";
import { OFFLINE_NOTICE, parseJavacDiagnostics, runJavaRemote } from "@/lib/ide/javaRemote";
import {
  formatEclipseTimestamp,
  getResourceFolderPath,
  getWorkspaceFilePath,
  INITIAL_CONSOLE_LAUNCH,
  INITIAL_FILES,
  INITIAL_PROJECTS,
  JRE_JAR_ENTRIES,
  type ConsoleLaunchRecord,
  type WorkspaceJavaFile,
  type WorkspaceProject,
} from "./eclipseData";
import {
  BlockSelectIcon,
  BreadcrumbPageIcon,
  ClearConsoleIcon,
  CollapseAllIcon,
  ConsoleStderrToggleIcon,
  ConsoleStdoutToggleIcon,
  ConsoleTabIcon,
  CoverageRunIcon,
  DebugBugIcon,
  DeclarationTabIcon,
  DisplayConsoleIcon,
  EclipseGlobeIcon,
  ErrorMarkerIcon,
  ExternalToolsIcon,
  JavaBrowsingIcon,
  JavaFileIcon,
  JavaPerspectiveIcon,
  JavaProjectFolderIcon,
  JavadocTabIcon,
  JreBooksIcon,
  LastEditIcon,
  LinkWithEditorIcon,
  MarkOccurrencesIcon,
  NavBackIcon,
  NavForwardIcon,
  NewClassIcon,
  NewPackageIcon,
  NewWizardIcon,
  NextAnnotationIcon,
  OpenConsoleIcon,
  OpenPerspectiveIcon,
  OpenTypeIcon,
  PackageCubeIcon,
  PackageExplorerTabIcon,
  PinConsoleIcon,
  PrevAnnotationIcon,
  PrintViewIcon,
  ProblemsTabIcon,
  RemoveAllLaunchesIcon,
  RemoveLaunchIcon,
  RunPlayIcon,
  SaveAllFloppyIcon,
  SaveFloppyIcon,
  ScrollLockIcon,
  SearchFlashlightIcon,
  ShowWhitespaceIcon,
  SkipBreakpointsIcon,
  SourceFolderIcon,
  TerminateSquareIcon,
  TodoClipboardIcon,
  UserProfileIcon,
  ViewFiltersIcon,
  WordWrapIcon,
} from "./eclipseIcons";
import { EclipseJavaSyntax } from "./EclipseJavaSyntax";
import {
  AboutEclipseModal,
  NewClassModal,
  NewPackageModal,
  PreferencesModal,
} from "./EclipseModals";
import styles from "./eclipse.module.css";

type BottomTabId = "problems" | "javadoc" | "declaration" | "console";
type MaximizedPane = "none" | "left" | "editor" | "bottom";
type PerspectiveId = "java" | "debug";

interface MenuEntry {
  label?: string;
  shortcut?: string;
  action?: () => void;
  disabled?: boolean;
  separator?: boolean;
}

export function EclipseWorkspace({ reportCapture = false }: { reportCapture?: boolean } = {}) {
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const workbenchRef = useRef<HTMLDivElement | null>(null);
  const consoleBodyRef = useRef<HTMLDivElement | null>(null);

  // Workspace files & projects
  const [projects, setProjects] = useState<WorkspaceProject[]>(INITIAL_PROJECTS);
  const [files, setFiles] = useState<WorkspaceJavaFile[]>(INITIAL_FILES);
  const [extraPackages, setExtraPackages] = useState<Array<{ projectId: string; packageName: string }>>([]);
  const [openTabIds, setOpenTabIds] = useState<string[]>(["file-hw-openclassrooms"]);
  const [activeFileId, setActiveFileId] = useState<string>("file-hw-openclassrooms");
  const [selectedTreeKey, setSelectedTreeKey] = useState<string>("file:file-hw-openclassrooms");

  // Package explorer expand state (matching screenshot: es collapsed, HelloWorld & src & packages expanded)
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "proj:proj-es": false,
    "proj:proj-helloworld": true,
    "jre:proj-helloworld": false,
    "src:proj-helloworld": true,
    "pkg:proj-helloworld:": true,
    "pkg:proj-helloworld:com.openclassrooms": true,
  });

  // Navigation history
  const [navHistory, setNavHistory] = useState<string[]>(["file-hw-openclassrooms"]);
  const [navIndex, setNavIndex] = useState<number>(0);

  // Layout & pane visibility
  const [leftWidth, setLeftWidth] = useState<number>(282);
  const [bottomHeight, setBottomHeight] = useState<number>(220);
  const [showPackageExplorer, setShowPackageExplorer] = useState<boolean>(true);
  const [showBottomPane, setShowBottomPane] = useState<boolean>(true);
  const [maximizedPane, setMaximizedPane] = useState<MaximizedPane>("none");
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTabId>("console");
  const [perspective, setPerspective] = useState<PerspectiveId>("java");

  // Editor state
  const [cursorLine, setCursorLine] = useState<number>(1);
  const [cursorCol, setCursorCol] = useState<number>(1);
  const [wordUnderCursor, setWordUnderCursor] = useState<string>("");
  const [breakpoints, setBreakpoints] = useState<Record<string, Record<number, true>>>({});
  const [skipAllBreakpoints, setSkipAllBreakpoints] = useState<boolean>(false);
  const [markOccurrences, setMarkOccurrences] = useState<boolean>(true);
  const [showWhitespace, setShowWhitespace] = useState<boolean>(false);
  const [showLineNumbers, setShowLineNumbers] = useState<boolean>(true);
  const [showBreadcrumb, setShowBreadcrumb] = useState<boolean>(false);
  const [editorFontSize, setEditorFontSize] = useState<number>(13);
  const [linkWithEditor, setLinkWithEditor] = useState<boolean>(false);
  const [showJreLibrary, setShowJreLibrary] = useState<boolean>(true);
  const [buildAuto, setBuildAuto] = useState<boolean>(true);
  const [stdinInput, setStdinInput] = useState<string>("");

  // Console state
  const [launches, setLaunches] = useState<ConsoleLaunchRecord[]>([INITIAL_CONSOLE_LAUNCH]);
  const [activeLaunchId, setActiveLaunchId] = useState<string>(INITIAL_CONSOLE_LAUNCH.id);
  const [launchCounter, setLaunchCounter] = useState<number>(2);
  const [consoleScrollLock, setConsoleScrollLock] = useState<boolean>(false);
  const [consoleWordWrap, setConsoleWordWrap] = useState<boolean>(false);
  const [consolePin, setConsolePin] = useState<boolean>(false);
  const [showOnStdout, setShowOnStdout] = useState<boolean>(true);
  const [showOnStderr, setShowOnStderr] = useState<boolean>(true);

  useReportCapture<JavaReportFrame>(reportCapture, ({ filename, code, output, showOutput }) => {
    const id = "report-source";
    setProjects([{ id: "lab", name: "Lab", hasMaven: false, hasWarning: false, jreLabel: "Java" }]);
    const packageName = /^\s*package\s+([\w.]+)\s*;/m.exec(code)?.[1] || "";
    setFiles([{ id, projectId: "lab", packageName, fileName: filename, code, savedCode: code }]);
    setOpenTabIds([id]);
    setActiveFileId(id);
    setSelectedTreeKey("file:" + id);
    setShowPackageExplorer(false);
    setShowBottomPane(showOutput);
    setBottomHeight(380);
    setConsoleWordWrap(true);
    setConsoleScrollLock(true);
    setLaunches(showOutput ? [{ id, label: filename, headerText: `${filename} [Java Application]`,
      stdout: output, stderr: "", terminated: true }] : []);
    setActiveLaunchId(id);
  });

  // Menus, dropdowns, modals, status message
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openToolDropdown, setOpenToolDropdown] = useState<string | null>(null);
  const [quickAccessQuery, setQuickAccessQuery] = useState<string>("");
  const [quickAccessOpen, setQuickAccessOpen] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<null | "newClass" | "newPackage" | "prefs" | "about">(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [treeContextMenu, setTreeContextMenu] = useState<{
    x: number;
    y: number;
    projectId: string;
    packageName?: string;
    fileId?: string;
  } | null>(null);

  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId) || files[0],
    [files, activeFileId],
  );

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeFile.projectId) || projects[1],
    [projects, activeFile],
  );

  const activeWindowTitle = useMemo(() => {
    if (!activeFile || !activeProject) return "Eclipse IDE";
    return `Eclipse - ${getWorkspaceFilePath(activeFile, activeProject.name)} - Eclipse IDE`;
  }, [activeFile, activeProject]);

  const activeDirty = activeFile ? activeFile.code !== activeFile.savedCode : false;
  const anyDirty = useMemo(() => files.some((f) => f.code !== f.savedCode), [files]);

  // Once a file has been compiled on the real JDK its markers come from javac (and clear when the text changes);
  // the offline analyzer only describes files that never ran on the JDK.
  const [jdkCheck, setJdkCheck] = useState<{ fileId: string; code: string; problems: EclipseProblem[] } | null>(null);

  const activeProblems = useMemo(() => {
    if (!activeFile || !activeProject) return [];
    if (jdkCheck && jdkCheck.fileId === activeFile.id) return jdkCheck.code === activeFile.code ? jdkCheck.problems : [];
    return analyzeJavaProblems(
      activeFile.code,
      activeFile.fileName,
      getResourceFolderPath(activeFile, activeProject.name),
    );
  }, [activeFile, activeProject, jdkCheck]);

  const errorLineMap = useMemo(() => {
    const map: Record<number, true> = {};
    for (let i = 0; i < activeProblems.length; i += 1) {
      if (activeProblems[i].severity === "error") {
        map[activeProblems[i].line] = true;
      }
    }
    return map;
  }, [activeProblems]);

  const todoTasks = useMemo(() => (activeFile ? extractTodoTasks(activeFile.code) : []), [activeFile]);
  const foldableLines = useMemo(() => {
    const list = activeFile ? extractFoldableMethodLines(activeFile.code) : [];
    const map: Record<number, true> = {};
    for (let i = 0; i < list.length; i += 1) map[list[i]] = true;
    return map;
  }, [activeFile]);

  const todoLineMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (let i = 0; i < todoTasks.length; i += 1) {
      map[todoTasks[i].line] = todoTasks[i].text;
    }
    return map;
  }, [todoTasks]);

  const codeInfo = useMemo(
    () => inspectJavaAtLine(activeFile ? activeFile.code : "", cursorLine),
    [activeFile, cursorLine],
  );

  const activeLaunch = useMemo(
    () => launches.find((l) => l.id === activeLaunchId) || launches[launches.length - 1] || null,
    [launches, activeLaunchId],
  );

  const flashStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleGlobalClick = () => {
      setOpenMenu(null);
      setOpenToolDropdown(null);
      setTreeContextMenu(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  // Auto-scroll console when stdout updates unless scroll-locked
  useEffect(() => {
    if (!consoleScrollLock && consoleBodyRef.current) {
      consoleBodyRef.current.scrollTop = consoleBodyRef.current.scrollHeight;
    }
  }, [launches, activeLaunchId, consoleScrollLock]);

  const updateCursorFromTextarea = useCallback((el: HTMLTextAreaElement) => {
    const pos = el.selectionStart || 0;
    const text = el.value;
    const before = text.slice(0, pos);
    const lines = before.split("\n");
    const ln = lines.length;
    const col = lines[lines.length - 1].length + 1;
    setCursorLine(ln);
    setCursorCol(col);

    // Extract identifier under caret for Mark Occurrences
    let start = pos;
    let end = pos;
    while (start > 0 && /[A-Za-z0-9_$]/.test(text.charAt(start - 1))) start -= 1;
    while (end < text.length && /[A-Za-z0-9_$]/.test(text.charAt(end))) end += 1;
    const word = text.slice(start, end);
    setWordUnderCursor(/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(word) ? word : "");
  }, []);

  const openFileInEditor = useCallback(
    (fileId: string, pushHistory = true) => {
      setOpenTabIds((prev) => (prev.indexOf(fileId) !== -1 ? prev : [...prev, fileId]));
      setActiveFileId(fileId);
      setSelectedTreeKey(`file:${fileId}`);
      if (pushHistory) {
        setNavHistory((prev) => {
          const head = prev.slice(0, navIndex + 1);
          if (head[head.length - 1] === fileId) return head;
          return [...head, fileId];
        });
        setNavIndex((prev) => {
          const sliced = navHistory.slice(0, prev + 1);
          return sliced[sliced.length - 1] === fileId ? prev : sliced.length;
        });
      }
      if (linkWithEditor) {
        const f = files.find((item) => item.id === fileId);
        if (f) {
          setExpandedNodes((prev) => ({
            ...prev,
            [`proj:${f.projectId}`]: true,
            [`src:${f.projectId}`]: true,
            [`pkg:${f.projectId}:${f.packageName}`]: true,
          }));
        }
      }
    },
    [files, linkWithEditor, navHistory, navIndex],
  );

  const closeEditorTab = useCallback(
    (fileId: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setOpenTabIds((prev) => {
        const next = prev.filter((id) => id !== fileId);
        if (activeFileId === fileId) {
          setActiveFileId(next.length > 0 ? next[next.length - 1] : "");
        }
        return next;
      });
    },
    [activeFileId],
  );

  const updateActiveCode = useCallback(
    (newCode: string) => {
      if (!activeFile) return;
      setFiles((prev) => prev.map((f) => (f.id === activeFile.id ? { ...f, code: newCode } : f)));
    },
    [activeFile],
  );

  const handleSaveCurrent = useCallback(() => {
    if (!activeFile) return;
    setFiles((prev) => prev.map((f) => (f.id === activeFile.id ? { ...f, savedCode: f.code } : f)));
    flashStatus(`Saved ${activeFile.fileName}`);
  }, [activeFile, flashStatus]);

  const handleSaveAll = useCallback(() => {
    setFiles((prev) => prev.map((f) => ({ ...f, savedCode: f.code })));
    flashStatus("Saved all modified Java resources");
  }, [flashStatus]);

  const handleRunJava = useCallback(
    async (mode: "run" | "debug" | "coverage" = "run") => {
      if (!activeFile) return;
      // Eclipse auto-saves modified resources on Run
      setFiles((prev) => prev.map((f) => (f.id === activeFile.id ? { ...f, savedCode: f.code } : f)));

      // Real JDK on the backend; the offline interpreter only when the user cannot run on the server (and the console says so).
      flashStatus(`Launching ${activeFile.fileName}...`);
      const remote = await runJavaRemote(activeFile.code, stdinInput);
      if (!remote.ok && remote.reason === "busy") {
        flashStatus(remote.message);
        return;
      }
      let result: JavaExecutionResult;
      if (remote.ok) {
        const resourcePath = activeProject ? getResourceFolderPath(activeFile, activeProject.name) : "";
        setJdkCheck({
          fileId: activeFile.id,
          code: activeFile.code,
          problems: parseJavacDiagnostics(remote.result.stderr).map((d, index) => ({
            id: `javac-${index}-${d.line}`,
            severity: d.severity,
            message: d.message,
            resource: activeFile.fileName,
            path: resourcePath,
            line: d.line,
            type: "Java Problem",
          })),
        });
        const pkg = /^\s*package\s+([\w.]+)\s*;/m.exec(activeFile.code)?.[1] ?? "";
        result = {
          success: remote.result.success,
          stdout: remote.result.stdout,
          stderr: remote.result.stderr,
          exitCode: remote.result.exitCode,
          durationMs: remote.result.durationMs,
          packageName: pkg,
          className: remote.result.className,
          problems: [],
        };
      } else {
        result = executeJavaCode(activeFile.code, stdinInput);
        result = { ...result, stderr: `[LabMate] ${OFFLINE_NOTICE}\n${result.stderr}`.trimEnd() };
      }
      const nextNum = launchCounter + 1;
      setLaunchCounter(nextNum);

      const classLabel = result.className || activeFile.fileName.replace(/\.java$/, "");
      const timestamp = formatEclipseTimestamp(new Date());
      const modeTag = mode === "debug" ? " [Debug]" : mode === "coverage" ? " [Coverage]" : "";
      const headerText = `<terminated> ${classLabel} (${nextNum}) [Java Application${modeTag}] C:\\Program Files\\Java\\jdk1.8.0_131\\bin\\javaw.exe (${timestamp})`;

      let extraOut = result.stdout;
      if (mode === "coverage" && result.success) {
        extraOut += `\n[EclEmma] Coverage for ${classLabel}: 100.0% instructions covered\n`;
      } else if (mode === "debug" && !skipAllBreakpoints) {
        const fileBps = breakpoints[activeFile.id] || {};
        const bpLines = Object.keys(fileBps);
        if (bpLines.length > 0) {
          extraOut = `[Debugger] Hit line breakpoint(s) at line ${bpLines.join(", ")} -> resumed\n` + extraOut;
        }
      }

      const newRecord: ConsoleLaunchRecord = {
        id: `launch-${nextNum}-${Date.now()}`,
        label: `${classLabel} (${nextNum}) [Java Application]`,
        headerText,
        stdout: extraOut,
        stderr: result.stderr,
        terminated: true,
      };

      setLaunches((prev) => [...prev, newRecord]);
      setActiveLaunchId(newRecord.id);
      setShowBottomPane(true);
      if ((result.stderr && showOnStderr) || (!result.stderr && showOnStdout)) {
        setActiveBottomTab("console");
      }
      flashStatus(
        result.success
          ? `Terminated ${classLabel} (${result.durationMs}ms)`
          : `${classLabel} terminated with errors`,
      );
    },
    [
      activeFile,
      activeProject,
      breakpoints,
      flashStatus,
      launchCounter,
      showOnStderr,
      showOnStdout,
      skipAllBreakpoints,
      stdinInput,
    ],
  );

  const handleFormatCode = useCallback(() => {
    if (!activeFile) return;
    updateActiveCode(formatJavaCode(activeFile.code));
    flashStatus(`Formatted ${activeFile.fileName}`);
  }, [activeFile, flashStatus, updateActiveCode]);

  const handleToggleComment = useCallback(() => {
    const el = editorRef.current;
    if (!el || !activeFile) return;
    const text = activeFile.code;
    const selStart = el.selectionStart;
    const selEnd = el.selectionEnd;

    const lineStart = text.lastIndexOf("\n", Math.max(0, selStart - 1)) + 1;
    let lineEnd = text.indexOf("\n", selEnd);
    if (lineEnd === -1) lineEnd = text.length;

    const block = text.slice(lineStart, lineEnd);
    const lines = block.split("\n");
    const allCommented = lines.every((l) => l.trim() === "" || l.trim().indexOf("//") === 0);

    const nextLines = lines.map((l) => {
      if (l.trim() === "") return l;
      if (allCommented) {
        return l.replace(/^(\s*)\/\/\s?/, "$1");
      }
      return l.replace(/^(\s*)/, "$1// ");
    });

    const nextCode = text.slice(0, lineStart) + nextLines.join("\n") + text.slice(lineEnd);
    updateActiveCode(nextCode);
    flashStatus(allCommented ? "Uncommented selection" : "Commented selection");
  }, [activeFile, flashStatus, updateActiveCode]);

  const jumpToLine = useCallback(
    (lineNum: number) => {
      const el = editorRef.current;
      if (!el || !activeFile) return;
      const lines = activeFile.code.split("\n");
      const clamped = Math.max(1, Math.min(lines.length, lineNum));
      let offset = 0;
      for (let i = 0; i < clamped - 1; i += 1) {
        offset += lines[i].length + 1;
      }
      el.focus();
      el.setSelectionRange(offset, offset);
      setCursorLine(clamped);
      setCursorCol(1);
    },
    [activeFile],
  );

  const handleStepAnnotation = useCallback(
    (dir: -1 | 1) => {
      const linesSet: number[] = [];
      for (let i = 0; i < activeProblems.length; i += 1) linesSet.push(activeProblems[i].line);
      for (let i = 0; i < todoTasks.length; i += 1) {
        if (linesSet.indexOf(todoTasks[i].line) === -1) linesSet.push(todoTasks[i].line);
      }
      linesSet.sort((a, b) => a - b);
      if (linesSet.length === 0) {
        flashStatus("No annotations in active editor");
        return;
      }
      if (dir === 1) {
        const next = linesSet.find((l) => l > cursorLine) || linesSet[0];
        jumpToLine(next);
      } else {
        const prevList = linesSet.filter((l) => l < cursorLine);
        const prev = prevList.length > 0 ? prevList[prevList.length - 1] : linesSet[linesSet.length - 1];
        jumpToLine(prev);
      }
    },
    [activeProblems, cursorLine, flashStatus, jumpToLine, todoTasks],
  );

  const handleNavBack = useCallback(() => {
    if (navIndex > 0) {
      const targetIdx = navIndex - 1;
      setNavIndex(targetIdx);
      openFileInEditor(navHistory[targetIdx], false);
    }
  }, [navHistory, navIndex, openFileInEditor]);

  const handleNavForward = useCallback(() => {
    if (navIndex < navHistory.length - 1) {
      const targetIdx = navIndex + 1;
      setNavIndex(targetIdx);
      openFileInEditor(navHistory[targetIdx], false);
    }
  }, [navHistory, navIndex, openFileInEditor]);

  const handleCreateClass = useCallback(
    (projectId: string, packageName: string, className: string, includeMain: boolean) => {
      const pkgLine = packageName ? `package ${packageName};\n\n` : "";
      const mainBody = includeMain
        ? `\n\tpublic static void main(String[] args) {\n\t\t// TODO Auto-generated method stub\n\t\tSystem.out.println("Hello from ${className}!");\n\t}\n`
        : "\n";
      const code = `${pkgLine}public class ${className} {\n${mainBody}\n}\n`;
      const id = `file-${Date.now()}`;
      const newFile: WorkspaceJavaFile = {
        id,
        projectId,
        packageName,
        fileName: `${className}.java`,
        code,
        savedCode: code,
      };
      setFiles((prev) => [...prev, newFile]);
      setExpandedNodes((prev) => ({
        ...prev,
        [`proj:${projectId}`]: true,
        [`src:${projectId}`]: true,
        [`pkg:${projectId}:${packageName}`]: true,
      }));
      setActiveModal(null);
      openFileInEditor(id);
      flashStatus(`Created ${className}.java`);
    },
    [flashStatus, openFileInEditor],
  );

  const handleCreatePackage = useCallback(
    (projectId: string, packageName: string) => {
      setExtraPackages((prev) => {
        if (prev.some((p) => p.projectId === projectId && p.packageName === packageName)) return prev;
        return [...prev, { projectId, packageName }];
      });
      setExpandedNodes((prev) => ({
        ...prev,
        [`proj:${projectId}`]: true,
        [`src:${projectId}`]: true,
        [`pkg:${projectId}:${packageName}`]: true,
      }));
      setActiveModal(null);
      flashStatus(`Created package ${packageName}`);
    },
    [flashStatus],
  );

  const handleDeleteFile = useCallback(
    (fileId: string) => {
      if (files.length <= 1) {
        flashStatus("Cannot delete the last remaining file in workspace");
        return;
      }
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      closeEditorTab(fileId);
      flashStatus("Deleted Java compilation unit");
    },
    [closeEditorTab, files.length, flashStatus],
  );

  const handleToggleBreakpoint = useCallback(
    (lineNum: number) => {
      if (!activeFile) return;
      setBreakpoints((prev) => {
        const cur = prev[activeFile.id] || {};
        const nextFileMap: Record<number, true> = { ...cur };
        if (nextFileMap[lineNum]) {
          delete nextFileMap[lineNum];
        } else {
          nextFileMap[lineNum] = true;
        }
        return { ...prev, [activeFile.id]: nextFileMap };
      });
    },
    [activeFile],
  );

  // Keyboard shortcuts inside Eclipse IDE
  const handleGlobalKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (e.shiftKey) handleSaveAll();
        else handleSaveCurrent();
      } else if (mod && e.key === "F11") {
        e.preventDefault();
        handleRunJava("run");
      } else if (e.key === "F11" && !mod) {
        e.preventDefault();
        handleRunJava("debug");
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        handleFormatCode();
      } else if (mod && e.key === "/") {
        e.preventDefault();
        handleToggleComment();
      } else if (mod && e.key.toLowerCase() === "m") {
        e.preventDefault();
        setMaximizedPane((prev) => (prev === "editor" ? "none" : "editor"));
      }
    },
    [handleFormatCode, handleRunJava, handleSaveAll, handleSaveCurrent, handleToggleComment],
  );

  // Editor Tab / Enter auto-indent handling
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (e.key === "Tab") {
      e.preventDefault();
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const val = el.value;
      const next = val.slice(0, start) + "\t" + val.slice(end);
      updateActiveCode(next);
      requestAnimationFrame(() => {
        if (editorRef.current) {
          editorRef.current.setSelectionRange(start + 1, start + 1);
          updateCursorFromTextarea(editorRef.current);
        }
      });
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const val = el.value;
      const lineStart = val.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const currentLineText = val.slice(lineStart, start);
      const indentMatch = currentLineText.match(/^[\t ]*/);
      let indent = indentMatch ? indentMatch[0] : "";
      if (currentLineText.trim().slice(-1) === "{") {
        indent += "\t";
      }
      const next = val.slice(0, start) + "\n" + indent + val.slice(end);
      updateActiveCode(next);
      const caret = start + 1 + indent.length;
      requestAnimationFrame(() => {
        if (editorRef.current) {
          editorRef.current.setSelectionRange(caret, caret);
          updateCursorFromTextarea(editorRef.current);
        }
      });
    }
  };

  // Sash dragging
  const startVerticalDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const initialW = leftWidth;
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(180, Math.min(520, initialW + (ev.clientX - startX)));
      setLeftWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startHorizontalDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const initialH = bottomHeight;
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(110, Math.min(460, initialH - (ev.clientY - startY)));
      setBottomHeight(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Quick Access commands + files
  const quickAccessItems = useMemo(() => {
    const items: Array<{ label: string; category: string; run: () => void }> = [
      { label: "Run as Java Application", category: "Run", run: () => handleRunJava("run") },
      { label: "Debug as Java Application", category: "Run", run: () => handleRunJava("debug") },
      { label: "New Java Class", category: "New", run: () => setActiveModal("newClass") },
      { label: "New Java Package", category: "New", run: () => setActiveModal("newPackage") },
      { label: "Save", category: "File", run: handleSaveCurrent },
      { label: "Save All", category: "File", run: handleSaveAll },
      { label: "Format", category: "Source", run: handleFormatCode },
      { label: "Toggle Comment", category: "Source", run: handleToggleComment },
      { label: "Clear Console", category: "Console", run: () => setLaunches([]) },
      {
        label: "Show View: Package Explorer",
        category: "Views",
        run: () => setShowPackageExplorer(true),
      },
      {
        label: "Show View: Console",
        category: "Views",
        run: () => {
          setShowBottomPane(true);
          setActiveBottomTab("console");
        },
      },
      {
        label: "Show View: Problems",
        category: "Views",
        run: () => {
          setShowBottomPane(true);
          setActiveBottomTab("problems");
        },
      },
      {
        label: "Show View: Javadoc",
        category: "Views",
        run: () => {
          setShowBottomPane(true);
          setActiveBottomTab("javadoc");
        },
      },
      { label: "Toggle Whitespace Characters", category: "Editor", run: () => setShowWhitespace((v) => !v) },
      { label: "Preferences...", category: "Window", run: () => setActiveModal("prefs") },
    ];
    for (let i = 0; i < files.length; i += 1) {
      const f = files[i];
      const proj = projects.find((p) => p.id === f.projectId);
      items.push({
        label: `${f.fileName} - ${proj ? proj.name : ""}/${f.packageName || "(default package)"}`,
        category: "Resource",
        run: () => openFileInEditor(f.id),
      });
    }
    const q = quickAccessQuery.trim().toLowerCase();
    if (!q) return items.slice(0, 10);
    return items.filter(
      (it) => it.label.toLowerCase().indexOf(q) !== -1 || it.category.toLowerCase().indexOf(q) !== -1,
    );
  }, [
    files,
    handleFormatCode,
    handleRunJava,
    handleSaveAll,
    handleSaveCurrent,
    handleToggleComment,
    openFileInEditor,
    projects,
    quickAccessQuery,
  ]);

  // Menu bar specification
  const topMenus: Record<string, MenuEntry[]> = {
    File: [
      { label: "New Class...", shortcut: "", action: () => setActiveModal("newClass") },
      { label: "New Package...", shortcut: "", action: () => setActiveModal("newPackage") },
      { separator: true },
      { label: "Save", shortcut: "Ctrl+S", action: handleSaveCurrent, disabled: !activeDirty },
      { label: "Save All", shortcut: "Ctrl+Shift+S", action: handleSaveAll, disabled: !anyDirty },
      { separator: true },
      {
        label: "Close",
        shortcut: "Ctrl+W",
        action: () => activeFile && closeEditorTab(activeFile.id),
        disabled: !activeFile,
      },
      { label: "Close All", shortcut: "Ctrl+Shift+W", action: () => setOpenTabIds([]) },
      { separator: true },
      { label: "Print...", shortcut: "Ctrl+P", action: () => window.print() },
    ],
    Edit: [
      {
        label: "Select All",
        shortcut: "Ctrl+A",
        action: () => {
          if (editorRef.current) {
            editorRef.current.focus();
            editorRef.current.select();
          }
        },
      },
      { separator: true },
      {
        label: "Find / Quick Access...",
        shortcut: "Ctrl+3",
        action: () => setQuickAccessOpen(true),
      },
    ],
    Source: [
      { label: "Toggle Comment", shortcut: "Ctrl+/", action: handleToggleComment },
      { label: "Format", shortcut: "Ctrl+Shift+F", action: handleFormatCode },
      { separator: true },
      {
        label: "Insert System.out.println()",
        action: () => {
          if (!activeFile || !editorRef.current) return;
          const pos = editorRef.current.selectionStart;
          const next =
            activeFile.code.slice(0, pos) +
            'System.out.println("");' +
            activeFile.code.slice(editorRef.current.selectionEnd);
          updateActiveCode(next);
        },
      },
    ],
    Refactor: [
      {
        label: "Reset HelloWorld Sample",
        action: () => {
          setFiles(INITIAL_FILES);
          setOpenTabIds(["file-hw-openclassrooms"]);
          setActiveFileId("file-hw-openclassrooms");
          flashStatus("Reset workspace to initial HelloWorld state");
        },
      },
    ],
    Navigate: [
      { label: "Back", shortcut: "Alt+Left", action: handleNavBack, disabled: navIndex <= 0 },
      {
        label: "Forward",
        shortcut: "Alt+Right",
        action: handleNavForward,
        disabled: navIndex >= navHistory.length - 1,
      },
      { separator: true },
      { label: "Next Annotation", shortcut: "Ctrl+.", action: () => handleStepAnnotation(1) },
      { label: "Previous Annotation", shortcut: "Ctrl+,", action: () => handleStepAnnotation(-1) },
      {
        label: "Show in Package Explorer",
        action: () => {
          setShowPackageExplorer(true);
          if (activeFile) {
            setExpandedNodes((prev) => ({
              ...prev,
              [`proj:${activeFile.projectId}`]: true,
              [`src:${activeFile.projectId}`]: true,
              [`pkg:${activeFile.projectId}:${activeFile.packageName}`]: true,
            }));
            setSelectedTreeKey(`file:${activeFile.id}`);
          }
        },
      },
    ],
    Search: [
      { label: "Quick Access...", shortcut: "Ctrl+3", action: () => setQuickAccessOpen(true) },
      {
        label: "Find TODO Tasks",
        action: () => {
          if (todoTasks.length > 0) jumpToLine(todoTasks[0].line);
          else flashStatus("No TODO tasks in active file");
        },
      },
    ],
    Project: [
      {
        label: `${buildAuto ? "✓ " : "   "}Build Automatically`,
        action: () => setBuildAuto((v) => !v),
      },
      {
        label: "Clean...",
        action: () => {
          setLaunches([]);
          flashStatus("Cleaned workspace projects");
        },
      },
    ],
    Run: [
      { label: "Run as Java Application", shortcut: "Ctrl+F11", action: () => handleRunJava("run") },
      { label: "Debug as Java Application", shortcut: "F11", action: () => handleRunJava("debug") },
      { separator: true },
      {
        label: "Toggle Line Breakpoint",
        shortcut: "Ctrl+Shift+B",
        action: () => handleToggleBreakpoint(cursorLine),
      },
      {
        label: `${skipAllBreakpoints ? "✓ " : "   "}Skip All Breakpoints`,
        action: () => setSkipAllBreakpoints((v) => !v),
      },
      { separator: true },
      { label: "Clear Console", action: () => setLaunches([]) },
    ],
    Window: [
      {
        label: "Show Package Explorer",
        action: () => {
          setShowPackageExplorer(true);
          setMaximizedPane("none");
        },
      },
      {
        label: "Show Console",
        action: () => {
          setShowBottomPane(true);
          setActiveBottomTab("console");
          setMaximizedPane("none");
        },
      },
      {
        label: "Show Problems",
        action: () => {
          setShowBottomPane(true);
          setActiveBottomTab("problems");
          setMaximizedPane("none");
        },
      },
      {
        label: "Show Javadoc",
        action: () => {
          setShowBottomPane(true);
          setActiveBottomTab("javadoc");
          setMaximizedPane("none");
        },
      },
      {
        label: "Show Declaration",
        action: () => {
          setShowBottomPane(true);
          setActiveBottomTab("declaration");
          setMaximizedPane("none");
        },
      },
      { separator: true },
      { label: "Java Perspective", action: () => setPerspective("java") },
      { label: "Debug Perspective", action: () => setPerspective("debug") },
      {
        label: "Reset Perspective",
        action: () => {
          setShowPackageExplorer(true);
          setShowBottomPane(true);
          setMaximizedPane("none");
          setLeftWidth(282);
          setBottomHeight(220);
          setPerspective("java");
        },
      },
      { separator: true },
      { label: "Preferences...", action: () => setActiveModal("prefs") },
    ],
    Help: [
      { label: "About Eclipse IDE", action: () => setActiveModal("about") },
    ],
  };

  const toggleNode = (key: string) => {
    setExpandedNodes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const collapseAllTree = () => {
    setExpandedNodes({});
  };

  const editorLineCount = useMemo(
    () => (activeFile ? activeFile.code.split("\n").length : 1),
    [activeFile],
  );

  const activeBreakpointsForFile = activeFile ? breakpoints[activeFile.id] || {} : {};
  const problemErrorsCount = activeProblems.filter((p) => p.severity === "error").length;
  const problemWarningsCount = activeProblems.filter((p) => p.severity === "warning").length;

  return (
    <div ref={workbenchRef} className={styles.eclipseRoot} onKeyDown={handleGlobalKeyDown}>
      {/* Window Title Bar */}
      <div className={styles.titleBar}>
        <div className={styles.titleLeft}>
          <EclipseGlobeIcon size={16} />
          <span className={styles.titleText}>{activeWindowTitle}</span>
        </div>
        <div className={styles.winCaptions}>
          <button
            type="button"
            className={styles.winBtn}
            title="Minimize"
            aria-label="Minimize window"
            onClick={() => flashStatus("Window minimized state simulated")}
          >
            ─
          </button>
          <button
            type="button"
            className={styles.winBtn}
            title="Maximize / Fullscreen"
            aria-label="Maximize window"
            onClick={() => {
              try {
                if (document.fullscreenElement) {
                  void document.exitFullscreen();
                } else {
                  void workbenchRef.current?.requestFullscreen();
                }
              } catch {
                setMaximizedPane((prev) => (prev === "editor" ? "none" : "editor"));
              }
            }}
          >
            □
          </button>
          <button
            type="button"
            className={`${styles.winBtn} ${styles.winCloseBtn}`}
            title="Close"
            aria-label="Close window"
            onClick={() => {
              setFiles(INITIAL_FILES);
              setOpenTabIds(["file-hw-openclassrooms"]);
              setActiveFileId("file-hw-openclassrooms");
              setLaunches([INITIAL_CONSOLE_LAUNCH]);
              setActiveLaunchId(INITIAL_CONSOLE_LAUNCH.id);
              setLaunchCounter(2);
              flashStatus("Workspace restored");
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Menu Bar */}
      <div className={styles.menuBar} role="menubar">
        {Object.keys(topMenus).map((menuName) => {
          const isOpen = openMenu === menuName;
          return (
            <div
              key={menuName}
              className={styles.menuWrap}
              onClick={(e) => {
                e.stopPropagation();
                setOpenToolDropdown(null);
                setOpenMenu(isOpen ? null : menuName);
              }}
              onMouseEnter={() => {
                if (openMenu && openMenu !== menuName) setOpenMenu(menuName);
              }}
            >
              <button
                type="button"
                className={`${styles.menuItemBtn} ${isOpen ? styles.menuItemBtnOpen : ""}`}
                role="menuitem"
              >
                {menuName}
              </button>
              {isOpen && (
                <div className={styles.menuDropdown} role="menu">
                  {topMenus[menuName].map((entry, idx) =>
                    entry.separator ? (
                      <div key={idx} className={styles.menuSep} />
                    ) : (
                      <button
                        key={idx}
                        type="button"
                        className={styles.menuActionBtn}
                        disabled={entry.disabled}
                        onClick={() => {
                          setOpenMenu(null);
                          if (entry.action) entry.action();
                        }}
                      >
                        <span>{entry.label}</span>
                        {entry.shortcut && <span className={styles.menuShortcut}>{entry.shortcut}</span>}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Coolbar / Main Toolbar */}
      <div className={styles.coolBar} role="toolbar" aria-label="Main Toolbar">
        <div className={styles.coolLeft}>
          {/* New Wizard + dropdown */}
          <div className={styles.toolBtnGroup} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.toolBtn}
              title="New (Alt+Shift+N)"
              onClick={() => setActiveModal("newClass")}
            >
              <NewWizardIcon />
            </button>
            <button
              type="button"
              className={styles.toolCaretBtn}
              aria-label="New menu"
              onClick={() => setOpenToolDropdown(openToolDropdown === "new" ? null : "new")}
            >
              ▾
            </button>
            {openToolDropdown === "new" && (
              <div className={styles.toolDropdown}>
                <button
                  type="button"
                  className={styles.menuActionBtn}
                  onClick={() => {
                    setOpenToolDropdown(null);
                    setActiveModal("newClass");
                  }}
                >
                  <span>Class</span>
                </button>
                <button
                  type="button"
                  className={styles.menuActionBtn}
                  onClick={() => {
                    setOpenToolDropdown(null);
                    setActiveModal("newPackage");
                  }}
                >
                  <span>Package</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className={styles.toolBtn}
            title="Save (Ctrl+S)"
            disabled={!activeDirty}
            onClick={handleSaveCurrent}
          >
            <SaveFloppyIcon active={activeDirty} />
          </button>

          <button
            type="button"
            className={styles.toolBtn}
            title="Save All (Ctrl+Shift+S)"
            disabled={!anyDirty}
            onClick={handleSaveAll}
          >
            <SaveAllFloppyIcon active={anyDirty} />
          </button>

          <span className={styles.coolGrip} />

          {/* User Profile dropdown */}
          <div className={styles.toolBtnGroup} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.toolBtn}
              title="Workspace User & Preferences"
              onClick={() => setOpenToolDropdown(openToolDropdown === "user" ? null : "user")}
            >
              <UserProfileIcon />
            </button>
            <button
              type="button"
              className={styles.toolCaretBtn}
              aria-label="User menu"
              onClick={() => setOpenToolDropdown(openToolDropdown === "user" ? null : "user")}
            >
              ▾
            </button>
            {openToolDropdown === "user" && (
              <div className={styles.toolDropdown}>
                <button
                  type="button"
                  className={styles.menuActionBtn}
                  onClick={() => {
                    setOpenToolDropdown(null);
                    setActiveModal("prefs");
                  }}
                >
                  <span>Preferences...</span>
                </button>
                <button
                  type="button"
                  className={styles.menuActionBtn}
                  onClick={() => {
                    setOpenToolDropdown(null);
                    setActiveModal("about");
                  }}
                >
                  <span>About Eclipse IDE</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className={styles.toolBtn}
            title="Print (Ctrl+P)"
            onClick={() => window.print()}
          >
            <PrintViewIcon />
          </button>

          <button
            type="button"
            className={`${styles.toolBtn} ${skipAllBreakpoints ? styles.toolBtnToggled : ""}`}
            title="Skip All Breakpoints"
            onClick={() => setSkipAllBreakpoints((v) => !v)}
          >
            <SkipBreakpointsIcon active={skipAllBreakpoints} />
          </button>

          <span className={styles.coolGrip} />

          {/* Debug */}
          <div className={styles.toolBtnGroup} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.toolBtn}
              title="Debug HelloWorld (F11)"
              onClick={() => handleRunJava("debug")}
            >
              <DebugBugIcon />
            </button>
            <button
              type="button"
              className={styles.toolCaretBtn}
              aria-label="Debug options"
              onClick={() => setOpenToolDropdown(openToolDropdown === "debug" ? null : "debug")}
            >
              ▾
            </button>
            {openToolDropdown === "debug" && (
              <div className={styles.toolDropdown}>
                <button
                  type="button"
                  className={styles.menuActionBtn}
                  onClick={() => {
                    setOpenToolDropdown(null);
                    handleRunJava("debug");
                  }}
                >
                  <span>Debug as Java Application</span>
                </button>
                <button
                  type="button"
                  className={styles.menuActionBtn}
                  onClick={() => {
                    setOpenToolDropdown(null);
                    setPerspective("debug");
                  }}
                >
                  <span>Switch to Debug Perspective</span>
                </button>
              </div>
            )}
          </div>

          {/* Run */}
          <div className={styles.toolBtnGroup} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.toolBtn}
              title="Run HelloWorld (Ctrl+F11)"
              onClick={() => handleRunJava("run")}
            >
              <RunPlayIcon />
            </button>
            <button
              type="button"
              className={styles.toolCaretBtn}
              aria-label="Run options"
              onClick={() => setOpenToolDropdown(openToolDropdown === "run" ? null : "run")}
            >
              ▾
            </button>
            {openToolDropdown === "run" && (
              <div className={styles.toolDropdown}>
                <button
                  type="button"
                  className={styles.menuActionBtn}
                  onClick={() => {
                    setOpenToolDropdown(null);
                    handleRunJava("run");
                  }}
                >
                  <span>Run as Java Application</span>
                  <span className={styles.menuShortcut}>Ctrl+F11</span>
                </button>
                <button
                  type="button"
                  className={styles.menuActionBtn}
                  onClick={() => {
                    setOpenToolDropdown(null);
                    setActiveModal("prefs");
                  }}
                >
                  <span>Configure Standard Input...</span>
                </button>
              </div>
            )}
          </div>

          {/* Coverage */}
          <div className={styles.toolBtnGroup} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.toolBtn}
              title="Coverage As Java Application"
              onClick={() => handleRunJava("coverage")}
            >
              <CoverageRunIcon />
            </button>
            <button
              type="button"
              className={styles.toolCaretBtn}
              aria-label="Coverage options"
              onClick={() => handleRunJava("coverage")}
            >
              ▾
            </button>
          </div>

          {/* External Tools */}
          <div className={styles.toolBtnGroup} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.toolBtn}
              title="External Tools"
              onClick={() => handleFormatCode()}
            >
              <ExternalToolsIcon />
            </button>
            <button
              type="button"
              className={styles.toolCaretBtn}
              aria-label="External tools options"
              onClick={() => setOpenToolDropdown(openToolDropdown === "ext" ? null : "ext")}
            >
              ▾
            </button>
            {openToolDropdown === "ext" && (
              <div className={styles.toolDropdown}>
                <button
                  type="button"
                  className={styles.menuActionBtn}
                  onClick={() => {
                    setOpenToolDropdown(null);
                    handleFormatCode();
                  }}
                >
                  <span>Format Java Source</span>
                </button>
              </div>
            )}
          </div>

          <span className={styles.coolGrip} />

          {/* New Package & New Class */}
          <button
            type="button"
            className={styles.toolBtn}
            title="New Java Package"
            onClick={() => setActiveModal("newPackage")}
          >
            <NewPackageIcon />
          </button>
          <div className={styles.toolBtnGroup}>
            <button
              type="button"
              className={styles.toolBtn}
              title="New Java Class"
              onClick={() => setActiveModal("newClass")}
            >
              <NewClassIcon />
            </button>
            <button
              type="button"
              className={styles.toolCaretBtn}
              aria-label="New type"
              onClick={() => setActiveModal("newClass")}
            >
              ▾
            </button>
          </div>

          <span className={styles.coolGrip} />

          {/* Search & Editor presentation toggles */}
          <button
            type="button"
            className={styles.toolBtn}
            title="Open Type / Search"
            onClick={() => setQuickAccessOpen((v) => !v)}
          >
            <OpenTypeIcon />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            title="Search Workspace"
            onClick={() => setQuickAccessOpen(true)}
          >
            <SearchFlashlightIcon />
          </button>
          <button
            type="button"
            className={`${styles.toolBtn} ${markOccurrences ? styles.toolBtnToggled : ""}`}
            title="Toggle Mark Occurrences"
            onClick={() => setMarkOccurrences((v) => !v)}
          >
            <MarkOccurrencesIcon />
          </button>
          <button
            type="button"
            className={`${styles.toolBtn} ${showBreadcrumb ? styles.toolBtnToggled : ""}`}
            title="Toggle Breadcrumb"
            onClick={() => setShowBreadcrumb((v) => !v)}
          >
            <BreadcrumbPageIcon />
          </button>
          <button
            type="button"
            className={`${styles.toolBtn} ${consoleWordWrap ? styles.toolBtnToggled : ""}`}
            title="Toggle Block Selection / Console Wrap"
            onClick={() => setConsoleWordWrap((v) => !v)}
          >
            <BlockSelectIcon />
          </button>
          <button
            type="button"
            className={`${styles.toolBtn} ${showWhitespace ? styles.toolBtnToggled : ""}`}
            title="Show Whitespace Characters"
            onClick={() => setShowWhitespace((v) => !v)}
          >
            <ShowWhitespaceIcon />
          </button>

          <span className={styles.coolGrip} />

          {/* Annotation & Back/Forward Nav */}
          <button
            type="button"
            className={styles.toolBtn}
            title="Previous Annotation"
            onClick={() => handleStepAnnotation(-1)}
          >
            <PrevAnnotationIcon />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            title="Next Annotation"
            onClick={() => handleStepAnnotation(1)}
          >
            <NextAnnotationIcon />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            title="Last Edit Location"
            onClick={() => jumpToLine(cursorLine)}
          >
            <LastEditIcon />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            title="Back"
            disabled={navIndex <= 0}
            onClick={handleNavBack}
          >
            <NavBackIcon disabled={navIndex <= 0} />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            title="Forward"
            disabled={navIndex >= navHistory.length - 1}
            onClick={handleNavForward}
          >
            <NavForwardIcon disabled={navIndex >= navHistory.length - 1} />
          </button>
        </div>

        {/* Right Coolbar: Quick Access & Perspectives */}
        <div className={styles.coolRight}>
          <div className={styles.quickAccessWrap} onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              className={styles.quickAccessInput}
              placeholder="Quick Access"
              aria-label="Quick Access"
              value={quickAccessQuery}
              onFocus={() => setQuickAccessOpen(true)}
              onChange={(e) => {
                setQuickAccessQuery(e.target.value);
                setQuickAccessOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuickAccessOpen(false);
                if (e.key === "Enter" && quickAccessItems.length > 0) {
                  quickAccessItems[0].run();
                  setQuickAccessOpen(false);
                  setQuickAccessQuery("");
                }
              }}
            />
            {quickAccessOpen && (
              <div className={styles.quickAccessPopup}>
                <div className={styles.quickAccessHeader}>Quick Access (Commands & Resources)</div>
                {quickAccessItems.length === 0 ? (
                  <div className={styles.quickAccessItem}>No matching commands or files</div>
                ) : (
                  quickAccessItems.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={styles.quickAccessItem}
                      onClick={() => {
                        item.run();
                        setQuickAccessOpen(false);
                        setQuickAccessQuery("");
                      }}
                    >
                      <span>{item.label}</span>
                      <span className={styles.quickAccessCategory}>{item.category}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <span className={styles.coolGrip} />

          <button
            type="button"
            className={styles.toolBtn}
            title="Open Perspective"
            onClick={() => setPerspective((p) => (p === "java" ? "debug" : "java"))}
          >
            <OpenPerspectiveIcon />
          </button>
          <span className={styles.perspDivider} />
          <button
            type="button"
            className={styles.toolBtn}
            title="Show Package Explorer"
            onClick={() => {
              setShowPackageExplorer(true);
              setMaximizedPane("none");
            }}
          >
            <JavaBrowsingIcon />
          </button>
          <button
            type="button"
            className={`${styles.toolBtn} ${perspective === "java" ? styles.toolBtnToggled : ""}`}
            title="Java Perspective"
            onClick={() => setPerspective("java")}
          >
            <JavaPerspectiveIcon />
          </button>
          <button
            type="button"
            className={`${styles.toolBtn} ${perspective === "debug" ? styles.toolBtnToggled : ""}`}
            title="Debug Perspective"
            onClick={() => setPerspective("debug")}
          >
            <DebugBugIcon />
          </button>
        </div>
      </div>

      {/* Main Workbench Area */}
      <div className={styles.workbenchBody}>
        {/* Left Column: Package Explorer */}
        {showPackageExplorer && maximizedPane !== "editor" && maximizedPane !== "bottom" && (
          <>
            <div
              className={`${styles.leftColumn} ${styles.viewCard}`}
              style={{
                width: maximizedPane === "left" ? "100%" : `${leftWidth}px`,
                flex: maximizedPane === "left" ? 1 : "0 0 auto",
              }}
            >
              <div className={styles.viewHeader}>
                <div className={styles.tabsStrip}>
                  <div
                    className={`${styles.viewTab} ${styles.viewTabActive}`}
                    onDoubleClick={() => setMaximizedPane((p) => (p === "left" ? "none" : "left"))}
                  >
                    <PackageExplorerTabIcon size={14} />
                    <span>Package Explorer</span>
                    <button
                      type="button"
                      className={styles.tabCloseIcon}
                      aria-label="Close Package Explorer"
                      onClick={() => {
                        setShowPackageExplorer(false);
                        setMaximizedPane("none");
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className={styles.viewActions}>
                  <button
                    type="button"
                    className={styles.viewMiniBtn}
                    title="Collapse All"
                    onClick={collapseAllTree}
                  >
                    <CollapseAllIcon size={13} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.viewMiniBtn} ${linkWithEditor ? styles.viewMiniBtnActive : ""}`}
                    title="Link with Editor"
                    onClick={() => setLinkWithEditor((v) => !v)}
                  >
                    <LinkWithEditorIcon size={13} />
                  </button>
                  <span className={styles.viewMiniDivider} />
                  <button
                    type="button"
                    className={styles.viewMiniBtn}
                    title="Toggle JRE System Library visibility"
                    onClick={() => setShowJreLibrary((v) => !v)}
                  >
                    <ViewFiltersIcon size={13} />
                  </button>
                  <button
                    type="button"
                    className={styles.viewMiniBtn}
                    title="Minimize"
                    onClick={() => {
                      setShowPackageExplorer(false);
                      setMaximizedPane("none");
                    }}
                  >
                    ─
                  </button>
                  <button
                    type="button"
                    className={styles.viewMiniBtn}
                    title="Maximize"
                    onClick={() => setMaximizedPane((p) => (p === "left" ? "none" : "left"))}
                  >
                    □
                  </button>
                </div>
              </div>

              <div className={styles.treeContainer} role="tree" aria-label="Package Explorer">
                {projects.map((proj) => {
                  const projKey = `proj:${proj.id}`;
                  const projExpanded = Boolean(expandedNodes[projKey]);
                  const projFiles = files.filter((f) => f.projectId === proj.id);

                  // Unique sorted package names: "(default package)" first if present, then named packages
                  const pkgNames: string[] = [];
                  for (let i = 0; i < projFiles.length; i += 1) {
                    if (pkgNames.indexOf(projFiles[i].packageName) === -1) {
                      pkgNames.push(projFiles[i].packageName);
                    }
                  }
                  for (let i = 0; i < extraPackages.length; i += 1) {
                    if (
                      extraPackages[i].projectId === proj.id &&
                      pkgNames.indexOf(extraPackages[i].packageName) === -1
                    ) {
                      pkgNames.push(extraPackages[i].packageName);
                    }
                  }
                  pkgNames.sort((a, b) => {
                    if (a === "" && b !== "") return -1;
                    if (b === "" && a !== "") return 1;
                    return a.localeCompare(b);
                  });

                  const jreKey = `jre:${proj.id}`;
                  const jreExpanded = Boolean(expandedNodes[jreKey]);
                  const srcKey = `src:${proj.id}`;
                  const srcExpanded = Boolean(expandedNodes[srcKey]);

                  return (
                    <div key={proj.id}>
                      <div
                        className={styles.treeRow}
                        onClick={() => {
                          setSelectedTreeKey(projKey);
                          toggleNode(projKey);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setTreeContextMenu({ x: e.clientX, y: e.clientY, projectId: proj.id });
                        }}
                      >
                        <button
                          type="button"
                          className={styles.treeChevronBtn}
                          aria-label={`Toggle ${proj.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleNode(projKey);
                          }}
                        >
                          {projExpanded ? "⌄" : "›"}
                        </button>
                        <span
                          className={`${styles.treeLabelPill} ${
                            selectedTreeKey === projKey ? styles.treeRowSelected : ""
                          }`}
                        >
                          <JavaProjectFolderIcon
                            size={15}
                            hasMaven={proj.hasMaven}
                            hasWarning={proj.hasWarning}
                          />
                          <span className={styles.treeText}>{proj.name}</span>
                        </span>
                      </div>

                      {projExpanded && (
                        <div>
                          {/* JRE System Library [JavaSE-1.8] */}
                          {showJreLibrary && (
                            <div>
                              <div
                                className={styles.treeRow}
                                style={{ paddingLeft: 16 }}
                                onClick={() => {
                                  setSelectedTreeKey(jreKey);
                                  toggleNode(jreKey);
                                }}
                              >
                                <button
                                  type="button"
                                  className={styles.treeChevronBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleNode(jreKey);
                                  }}
                                >
                                  {jreExpanded ? "⌄" : "›"}
                                </button>
                                <span
                                  className={`${styles.treeLabelPill} ${
                                    selectedTreeKey === jreKey ? styles.treeRowSelected : ""
                                  }`}
                                >
                                  <JreBooksIcon size={15} />
                                  <span className={styles.treeText}>
                                    JRE System Library{" "}
                                    <span className={styles.treeJreVersion}>[JavaSE-1.8]</span>
                                  </span>
                                </span>
                              </div>
                              {jreExpanded &&
                                JRE_JAR_ENTRIES.map((jar) => (
                                  <div key={jar} className={styles.treeRow} style={{ paddingLeft: 36 }}>
                                    <span className={styles.treeChevronSpacer} />
                                    <span className={styles.treeLabelPill}>
                                      <PackageCubeIcon size={13} />
                                      <span className={styles.treeText}>{jar}</span>
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}

                          {/* src source folder */}
                          <div
                            className={styles.treeRow}
                            style={{ paddingLeft: 16 }}
                            onClick={() => {
                              setSelectedTreeKey(srcKey);
                              toggleNode(srcKey);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setTreeContextMenu({ x: e.clientX, y: e.clientY, projectId: proj.id });
                            }}
                          >
                            <button
                              type="button"
                              className={styles.treeChevronBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleNode(srcKey);
                              }}
                            >
                              {srcExpanded ? "⌄" : "›"}
                            </button>
                            <span
                              className={`${styles.treeLabelPill} ${
                                selectedTreeKey === srcKey ? styles.treeRowSelected : ""
                              }`}
                            >
                              <SourceFolderIcon size={15} />
                              <span className={styles.treeText}>src</span>
                            </span>
                          </div>

                          {srcExpanded &&
                            pkgNames.map((pkgName) => {
                              const pkgKey = `pkg:${proj.id}:${pkgName}`;
                              const pkgExpanded = Boolean(expandedNodes[pkgKey]);
                              const pkgFiles = projFiles.filter((f) => f.packageName === pkgName);
                              const pkgDisplay = pkgName || "(default package)";

                              return (
                                <div key={pkgKey}>
                                  <div
                                    className={styles.treeRow}
                                    style={{ paddingLeft: 32 }}
                                    onClick={() => {
                                      setSelectedTreeKey(pkgKey);
                                      toggleNode(pkgKey);
                                    }}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      setTreeContextMenu({
                                        x: e.clientX,
                                        y: e.clientY,
                                        projectId: proj.id,
                                        packageName: pkgName,
                                      });
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className={styles.treeChevronBtn}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleNode(pkgKey);
                                      }}
                                    >
                                      {pkgExpanded ? "⌄" : "›"}
                                    </button>
                                    <span
                                      className={`${styles.treeLabelPill} ${
                                        selectedTreeKey === pkgKey ? styles.treeRowSelected : ""
                                      }`}
                                    >
                                      <PackageCubeIcon size={14} />
                                      <span className={styles.treeText}>{pkgDisplay}</span>
                                    </span>
                                  </div>

                                  {pkgExpanded &&
                                    pkgFiles.map((file) => {
                                      const fKey = `file:${file.id}`;
                                      return (
                                        <div
                                          key={file.id}
                                          className={styles.treeRow}
                                          style={{ paddingLeft: 48 }}
                                          onClick={() => openFileInEditor(file.id)}
                                          onDoubleClick={() => openFileInEditor(file.id)}
                                          onContextMenu={(e) => {
                                            e.preventDefault();
                                            setTreeContextMenu({
                                              x: e.clientX,
                                              y: e.clientY,
                                              projectId: proj.id,
                                              packageName: file.packageName,
                                              fileId: file.id,
                                            });
                                          }}
                                        >
                                          <span className={styles.treeChevronBtn}>›</span>
                                          <span
                                            className={`${styles.treeLabelPill} ${
                                              selectedTreeKey === fKey ? styles.treeRowSelected : ""
                                            }`}
                                          >
                                            <JavaFileIcon size={14} />
                                            <span className={styles.treeText}>{file.fileName}</span>
                                          </span>
                                        </div>
                                      );
                                    })}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {maximizedPane === "none" && <div className={styles.vSash} onMouseDown={startVerticalDrag} />}
          </>
        )}

        {/* Right Column: Code Editor + Bottom Views */}
        {maximizedPane !== "left" && (
          <div className={styles.rightColumn}>
            {/* Center Java Editor */}
            {maximizedPane !== "bottom" && (
              <div className={styles.viewCard} style={{ flex: 1 }}>
                <div className={styles.viewHeader}>
                  <div className={styles.tabsStrip}>
                    {openTabIds.map((tabId) => {
                      const f = files.find((item) => item.id === tabId);
                      if (!f) return null;
                      const isActive = f.id === activeFileId;
                      const isDirty = f.code !== f.savedCode;
                      return (
                        <div
                          key={f.id}
                          className={`${styles.viewTab} ${isActive ? styles.viewTabActive : ""}`}
                          onClick={() => openFileInEditor(f.id)}
                          onDoubleClick={() =>
                            setMaximizedPane((p) => (p === "editor" ? "none" : "editor"))
                          }
                        >
                          <JavaFileIcon size={14} />
                          <span>
                            {isDirty && <span className={styles.tabDirtyStar}>*</span>}
                            {f.fileName}
                          </span>
                          <button
                            type="button"
                            className={styles.tabCloseIcon}
                            aria-label={`Close ${f.fileName}`}
                            onClick={(e) => closeEditorTab(f.id, e)}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className={styles.viewActions}>
                    <button
                      type="button"
                      className={styles.viewMiniBtn}
                      title="Minimize"
                      onClick={() => setMaximizedPane("bottom")}
                    >
                      ─
                    </button>
                    <button
                      type="button"
                      className={styles.viewMiniBtn}
                      title="Maximize"
                      onClick={() => setMaximizedPane((p) => (p === "editor" ? "none" : "editor"))}
                    >
                      □
                    </button>
                  </div>
                </div>

                {/* Optional Breadcrumb Bar */}
                {showBreadcrumb && activeFile && (
                  <div className={styles.debugStrip}>
                    <span>
                      {activeProject.name} &gt; src &gt; {activeFile.packageName || "(default package)"} &gt;{" "}
                      {activeFile.fileName}
                    </span>
                    <span>Line {cursorLine}</span>
                  </div>
                )}

                {/* Optional Debug Perspective Banner */}
                {perspective === "debug" && activeFile && (
                  <div className={styles.debugStrip}>
                    <span>
                      Debug Perspective — Breakpoints:{" "}
                      {Object.keys(activeBreakpointsForFile).length > 0
                        ? Object.keys(activeBreakpointsForFile).join(", ")
                        : "Click editor gutter to toggle"}
                    </span>
                    <button
                      type="button"
                      className={styles.dialogBtn}
                      onClick={() => handleRunJava("debug")}
                    >
                      Resume / Debug
                    </button>
                  </div>
                )}

                {/* Editor Content Area */}
                <div className={styles.editorCardBody}>
                  {activeFile && openTabIds.length > 0 ? (
                    <>
                      <div className={styles.editorScrollWrap}>
                        {/* Gutter */}
                        {showLineNumbers && (
                          <div className={styles.editorGutter}>
                            {Array.from({ length: editorLineCount }, (_, idx) => {
                              const lineNum = idx + 1;
                              const hasTodo = Boolean(todoLineMap[lineNum]);
                              const hasErr = Boolean(errorLineMap[lineNum]);
                              const hasBp = Boolean(activeBreakpointsForFile[lineNum]);
                              const isFold = Boolean(foldableLines[lineNum]);
                              return (
                                <div key={lineNum} className={styles.gutterRow}>
                                  <span
                                    className={styles.gutterAnnoCol}
                                    title={
                                      hasErr
                                        ? "Syntax error on this line"
                                        : hasTodo
                                          ? todoLineMap[lineNum]
                                          : hasBp
                                            ? "Breakpoint (click to remove)"
                                            : "Click to toggle breakpoint"
                                    }
                                    onClick={() => handleToggleBreakpoint(lineNum)}
                                  >
                                    {hasErr ? (
                                      <ErrorMarkerIcon size={12} />
                                    ) : hasBp ? (
                                      <span
                                        style={{
                                          width: 8,
                                          height: 8,
                                          borderRadius: "50%",
                                          background: skipAllBreakpoints ? "#9AA5B4" : "#2563EB",
                                          display: "inline-block",
                                        }}
                                      />
                                    ) : hasTodo ? (
                                      <TodoClipboardIcon size={13} />
                                    ) : isFold ? (
                                      <span className={styles.foldDot}>−</span>
                                    ) : null}
                                  </span>
                                  <span className={styles.gutterLineNum}>{lineNum}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Synchronized Syntax Layer + Editable Textarea */}
                        <div
                          className={styles.editorCodeStage}
                          style={{ fontSize: `${editorFontSize}px` }}
                        >
                          <EclipseJavaSyntax
                            code={activeFile.code}
                            activeLine={cursorLine}
                            errorLines={errorLineMap}
                            highlightWord={markOccurrences ? wordUnderCursor : ""}
                            showWhitespace={showWhitespace}
                          />
                          <textarea
                            ref={editorRef}
                            className={styles.editorTextarea}
                            style={{ fontSize: `${editorFontSize}px` }}
                            value={activeFile.code}
                            spellCheck={false}
                            autoCapitalize="off"
                            autoComplete="off"
                            autoCorrect="off"
                            aria-label={`Java editor for ${activeFile.fileName}`}
                            onChange={(e) => {
                              updateActiveCode(e.target.value);
                              updateCursorFromTextarea(e.currentTarget);
                            }}
                            onClick={(e) => updateCursorFromTextarea(e.currentTarget)}
                            onKeyUp={(e) => updateCursorFromTextarea(e.currentTarget)}
                            onSelect={(e) => updateCursorFromTextarea(e.currentTarget)}
                            onKeyDown={handleEditorKeyDown}
                          />
                        </div>
                      </div>

                      {/* Right Overview Ruler */}
                      <div className={styles.overviewRuler} aria-hidden="true">
                        {todoTasks.map((t) => (
                          <div
                            key={`todo-${t.line}`}
                            className={styles.rulerTodoMark}
                            style={{
                              top: `${Math.min(92, (t.line / Math.max(1, editorLineCount)) * 88 + 2)}%`,
                            }}
                            title={`TODO (line ${t.line}): ${t.text}`}
                            onClick={() => jumpToLine(t.line)}
                          />
                        ))}
                        {activeProblems
                          .filter((p) => p.severity === "error")
                          .map((p) => (
                            <div
                              key={p.id}
                              className={styles.rulerErrorMark}
                              style={{
                                top: `${Math.min(92, (p.line / Math.max(1, editorLineCount)) * 88 + 2)}%`,
                              }}
                              title={`Error (line ${p.line}): ${p.message}`}
                              onClick={() => jumpToLine(p.line)}
                            />
                          ))}
                      </div>
                    </>
                  ) : (
                    <div className={styles.consoleBody} style={{ padding: 24, color: "#6b7280" }}>
                      No editor open. Select a Java file in Package Explorer or create a new class.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Horizontal Sash */}
            {showBottomPane && maximizedPane === "none" && (
              <div className={styles.hSash} onMouseDown={startHorizontalDrag} />
            )}

            {/* Bottom Pane: Problems, Javadoc, Declaration, Console */}
            {showBottomPane && maximizedPane !== "editor" && (
              <div
                className={styles.viewCard}
                style={{
                  height: maximizedPane === "bottom" ? "100%" : `${bottomHeight}px`,
                  flex: maximizedPane === "bottom" ? 1 : "0 0 auto",
                }}
              >
                <div className={styles.viewHeader}>
                  <div className={styles.tabsStrip}>
                    <button
                      type="button"
                      className={`${styles.viewTab} ${
                        activeBottomTab === "problems" ? styles.viewTabActive : ""
                      }`}
                      onClick={() => setActiveBottomTab("problems")}
                    >
                      <ProblemsTabIcon size={14} active={activeBottomTab === "problems"} />
                      <span>
                        Problems{problemErrorsCount > 0 ? ` (${problemErrorsCount})` : ""}
                      </span>
                    </button>

                    <button
                      type="button"
                      className={`${styles.viewTab} ${
                        activeBottomTab === "javadoc" ? styles.viewTabActive : ""
                      }`}
                      onClick={() => setActiveBottomTab("javadoc")}
                    >
                      <JavadocTabIcon size={14} active={activeBottomTab === "javadoc"} />
                      <span>Javadoc</span>
                    </button>

                    <button
                      type="button"
                      className={`${styles.viewTab} ${
                        activeBottomTab === "declaration" ? styles.viewTabActive : ""
                      }`}
                      onClick={() => setActiveBottomTab("declaration")}
                    >
                      <DeclarationTabIcon size={14} active={activeBottomTab === "declaration"} />
                      <span>Declaration</span>
                    </button>

                    <div
                      className={`${styles.viewTab} ${
                        activeBottomTab === "console" ? styles.viewTabActive : ""
                      }`}
                      onClick={() => setActiveBottomTab("console")}
                      onDoubleClick={() =>
                        setMaximizedPane((p) => (p === "bottom" ? "none" : "bottom"))
                      }
                    >
                      <ConsoleTabIcon size={14} />
                      <span>Console</span>
                      <span
                        className={styles.tabCloseIcon}
                        role="button"
                        tabIndex={0}
                        aria-label="Close Console"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowBottomPane(false);
                          setMaximizedPane("none");
                        }}
                      >
                        ×
                      </span>
                    </div>
                  </div>

                  <div className={styles.viewActions}>
                    <button
                      type="button"
                      className={styles.viewMiniBtn}
                      title="Minimize"
                      onClick={() => {
                        setShowBottomPane(false);
                        setMaximizedPane("none");
                      }}
                    >
                      ─
                    </button>
                    <button
                      type="button"
                      className={styles.viewMiniBtn}
                      title="Maximize"
                      onClick={() => setMaximizedPane((p) => (p === "bottom" ? "none" : "bottom"))}
                    >
                      □
                    </button>
                  </div>
                </div>

                {/* Console Sub-Toolbar + Body */}
                {activeBottomTab === "console" && (
                  <>
                    <div className={styles.consoleSubToolbar}>
                      <button
                        type="button"
                        className={styles.viewMiniBtn}
                        title="Terminate"
                        disabled={!activeLaunch || activeLaunch.terminated}
                        onClick={() => {
                          if (!activeLaunch) return;
                          setLaunches((prev) =>
                            prev.map((l) =>
                              l.id === activeLaunch.id ? { ...l, terminated: true } : l,
                            ),
                          );
                        }}
                      >
                        <TerminateSquareIcon active={Boolean(activeLaunch && !activeLaunch.terminated)} />
                      </button>
                      <button
                        type="button"
                        className={styles.viewMiniBtn}
                        title="Remove Launch"
                        disabled={!activeLaunch}
                        onClick={() => {
                          if (!activeLaunch) return;
                          setLaunches((prev) => prev.filter((l) => l.id !== activeLaunch.id));
                        }}
                      >
                        <RemoveLaunchIcon active={Boolean(activeLaunch)} />
                      </button>
                      <button
                        type="button"
                        className={styles.viewMiniBtn}
                        title="Remove All Terminated Launches"
                        disabled={launches.length === 0}
                        onClick={() => setLaunches([])}
                      >
                        <RemoveAllLaunchesIcon active={launches.length > 0} />
                      </button>

                      <span className={styles.viewMiniDivider} />

                      <button
                        type="button"
                        className={styles.viewMiniBtn}
                        title="Clear Console"
                        onClick={() => {
                          if (!activeLaunch) return;
                          setLaunches((prev) =>
                            prev.map((l) =>
                              l.id === activeLaunch.id ? { ...l, stdout: "", stderr: "" } : l,
                            ),
                          );
                        }}
                      >
                        <ClearConsoleIcon />
                      </button>
                      <button
                        type="button"
                        className={`${styles.viewMiniBtn} ${
                          consoleScrollLock ? styles.viewMiniBtnActive : ""
                        }`}
                        title="Scroll Lock"
                        onClick={() => setConsoleScrollLock((v) => !v)}
                      >
                        <ScrollLockIcon />
                      </button>
                      <button
                        type="button"
                        className={`${styles.viewMiniBtn} ${
                          consoleWordWrap ? styles.viewMiniBtnActive : ""
                        }`}
                        title="Word Wrap"
                        onClick={() => setConsoleWordWrap((v) => !v)}
                      >
                        <WordWrapIcon />
                      </button>
                      <button
                        type="button"
                        className={`${styles.viewMiniBtn} ${showOnStdout ? styles.viewMiniBtnActive : ""}`}
                        title="Show Console When Standard Out Changes"
                        onClick={() => setShowOnStdout((v) => !v)}
                      >
                        <ConsoleStdoutToggleIcon />
                      </button>
                      <button
                        type="button"
                        className={`${styles.viewMiniBtn} ${showOnStderr ? styles.viewMiniBtnActive : ""}`}
                        title="Show Console When Standard Error Changes"
                        onClick={() => setShowOnStderr((v) => !v)}
                      >
                        <ConsoleStderrToggleIcon />
                      </button>

                      <span className={styles.viewMiniDivider} />

                      <button
                        type="button"
                        className={`${styles.viewMiniBtn} ${consolePin ? styles.viewMiniBtnActive : ""}`}
                        title="Pin Console"
                        onClick={() => setConsolePin((v) => !v)}
                      >
                        <PinConsoleIcon />
                      </button>

                      <div className={styles.toolBtnGroup} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={styles.viewMiniBtn}
                          title="Display Selected Console"
                          onClick={() =>
                            setOpenToolDropdown(openToolDropdown === "dispCon" ? null : "dispCon")
                          }
                        >
                          <DisplayConsoleIcon />
                        </button>
                        <button
                          type="button"
                          className={styles.toolCaretBtn}
                          aria-label="Display console menu"
                          onClick={() =>
                            setOpenToolDropdown(openToolDropdown === "dispCon" ? null : "dispCon")
                          }
                        >
                          ▾
                        </button>
                        {openToolDropdown === "dispCon" && (
                          <div className={styles.toolDropdown} style={{ right: 0, left: "auto" }}>
                            {launches.length === 0 ? (
                              <div className={styles.menuActionBtn}>No consoles</div>
                            ) : (
                              launches.map((l) => (
                                <button
                                  key={l.id}
                                  type="button"
                                  className={styles.menuActionBtn}
                                  onClick={() => {
                                    setActiveLaunchId(l.id);
                                    setOpenToolDropdown(null);
                                  }}
                                >
                                  <span>{l.label}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      <div className={styles.toolBtnGroup} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={styles.viewMiniBtn}
                          title="Open Console (Run)"
                          onClick={() => handleRunJava("run")}
                        >
                          <OpenConsoleIcon />
                        </button>
                        <button
                          type="button"
                          className={styles.toolCaretBtn}
                          aria-label="Open console menu"
                          onClick={() => handleRunJava("run")}
                        >
                          ▾
                        </button>
                      </div>
                    </div>

                    <div ref={consoleBodyRef} className={styles.consoleBody}>
                      {activeLaunch ? (
                        <>
                          <div className={styles.consoleHeaderLine}>{activeLaunch.headerText}</div>
                          {activeLaunch.stdout && (
                            <pre
                              className={`${styles.consoleOutputPre} ${
                                consoleWordWrap ? styles.consoleOutputWrap : ""
                              }`}
                            >
                              {activeLaunch.stdout}
                            </pre>
                          )}
                          {activeLaunch.stderr && (
                            <pre className={styles.consoleErrPre}>{activeLaunch.stderr}</pre>
                          )}
                        </>
                      ) : (
                        <div className={styles.consoleHeaderLine} style={{ color: "#6b7280" }}>
                          No consoles to display at this time. Click Run (Ctrl+F11) to launch.
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Problems View */}
                {activeBottomTab === "problems" && (
                  <div className={styles.problemsWrap}>
                    <div className={styles.problemsSummary}>
                      {problemErrorsCount} errors, {problemWarningsCount} warnings, 0 others
                    </div>
                    <table className={styles.problemsTable}>
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Resource</th>
                          <th>Path</th>
                          <th>Location</th>
                          <th>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeProblems.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ color: "#6b7280", padding: "8px" }}>
                              No problems detected in active compilation unit.
                            </td>
                          </tr>
                        ) : (
                          activeProblems.map((prob) => (
                            <tr
                              key={prob.id}
                              className={styles.problemsRow}
                              onClick={() => jumpToLine(prob.line)}
                            >
                              <td>
                                {prob.severity === "error" ? "⊗ " : "⚠ "}
                                {prob.message}
                              </td>
                              <td>{prob.resource}</td>
                              <td>{prob.path}</td>
                              <td>line {prob.line}</td>
                              <td>{prob.type}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Javadoc View */}
                {activeBottomTab === "javadoc" && (
                  <div className={styles.infoViewBody}>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                      {codeInfo.javadoc}
                    </pre>
                  </div>
                )}

                {/* Declaration View */}
                {activeBottomTab === "declaration" && (
                  <div className={styles.declarationBody}>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                      {codeInfo.declaration}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className={styles.statusBar}>
        <div className={styles.statusSpacer}>{statusMessage}</div>
        <div className={styles.statusCell}>Writable</div>
        <div className={styles.statusCell}>Smart Insert</div>
        <div className={`${styles.statusCell} ${styles.statusCoords}`}>
          {cursorLine} : {cursorCol}
        </div>
        <div className={styles.statusGrip} />
      </div>

      {/* Package Explorer Context Menu */}
      {treeContextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: treeContextMenu.x, top: treeContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={styles.menuActionBtn}
            onClick={() => {
              setTreeContextMenu(null);
              setActiveModal("newClass");
            }}
          >
            <span>New &gt; Class</span>
          </button>
          <button
            type="button"
            className={styles.menuActionBtn}
            onClick={() => {
              setTreeContextMenu(null);
              setActiveModal("newPackage");
            }}
          >
            <span>New &gt; Package</span>
          </button>
          {treeContextMenu.fileId && (
            <>
              <div className={styles.menuSep} />
              <button
                type="button"
                className={styles.menuActionBtn}
                onClick={() => {
                  const id = treeContextMenu.fileId!;
                  setTreeContextMenu(null);
                  openFileInEditor(id);
                  setTimeout(() => handleRunJava("run"), 0);
                }}
              >
                <span>Run As &gt; Java Application</span>
              </button>
              <button
                type="button"
                className={styles.menuActionBtn}
                onClick={() => {
                  const id = treeContextMenu.fileId!;
                  setTreeContextMenu(null);
                  handleDeleteFile(id);
                }}
              >
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {activeModal === "newClass" && (
        <NewClassModal
          projects={projects}
          defaultProjectId={activeFile ? activeFile.projectId : "proj-helloworld"}
          defaultPackage={activeFile ? activeFile.packageName : "com.openclassrooms"}
          onCreate={handleCreateClass}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === "newPackage" && (
        <NewPackageModal
          projects={projects}
          defaultProjectId={activeFile ? activeFile.projectId : "proj-helloworld"}
          onCreate={handleCreatePackage}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === "prefs" && (
        <PreferencesModal
          fontSize={editorFontSize}
          showWhitespace={showWhitespace}
          showLineNumbers={showLineNumbers}
          markOccurrences={markOccurrences}
          stdinInput={stdinInput}
          onSave={(prefs) => {
            setEditorFontSize(prefs.fontSize);
            setShowWhitespace(prefs.showWhitespace);
            setShowLineNumbers(prefs.showLineNumbers);
            setMarkOccurrences(prefs.markOccurrences);
            setStdinInput(prefs.stdinInput);
            flashStatus("Preferences updated");
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === "about" && <AboutEclipseModal onClose={() => setActiveModal(null)} />}
    </div>
  );
}
