"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReportCapture, type JavaReportFrame } from "@/lib/ide/reportCapture";
import {
  analyzeJavaDiagnostics,
  executeTerminalCommand,
  extractJavaSymbols,
  indexVirtualFiles,
  INTELLIJ_PRESETS,
  runJavaProgram,
  type IntellijProjectPreset,
  type JavaDiagnostic,
  type JavaRunResult,
  type RunConfiguration,
  type VirtualFileNode,
} from "@/lib/ide/intellijRunner";
import { OFFLINE_NOTICE, parseJavacDiagnostics, runJavaRemote } from "@/lib/ide/javaRemote";
import { BottomToolWindow } from "./BottomToolWindow";
import { CodeEditorPane, computeCursorFromOffset, computeOffsetFromCursor } from "./CodeEditorPane";
import { HeaderToolbar } from "./HeaderToolbar";
import styles from "./intellij.module.css";
import { ProjectTreePane } from "./ProjectTreePane";
import { RightDrawerPane } from "./RightDrawerPane";
import { GoToLineModal, NewClassModal, SearchEverywhereModal, type SearchActionItem } from "./SearchEverywhereModal";
import { StatusBreadcrumbBar } from "./StatusBreadcrumbBar";
import { LeftToolStripe, RightToolStripe } from "./ToolWindowStripes";
import type {
  BottomToolId,
  BuildLogEntry,
  EditorCursor,
  LeftToolId,
  NotificationItem,
  RightToolId,
  TerminalEntry,
} from "./types";

function collectDefaultExpanded(nodes: VirtualFileNode[], acc: Record<string, boolean> = {}): Record<string, boolean> {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.expandedByDefault) {
      acc[n.id] = true;
    }
    if (n.children && n.children.length > 0) {
      collectDefaultExpanded(n.children, acc);
    }
  }
  return acc;
}

function collectAllFolders(nodes: VirtualFileNode[], expanded: boolean, acc: Record<string, boolean> = {}): Record<string, boolean> {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (Array.isArray(n.children)) {
      acc[n.id] = expanded;
      if (n.children.length > 0) {
        collectAllFolders(n.children, expanded, acc);
      }
    }
  }
  return acc;
}

function collectDefaultContents(nodes: VirtualFileNode[], acc: Record<string, string> = {}): Record<string, string> {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.content !== undefined) {
      acc[n.id] = n.content;
    }
    if (n.children && n.children.length > 0) {
      collectDefaultContents(n.children, acc);
    }
  }
  return acc;
}

function findPathAncestorIds(nodes: VirtualFileNode[], targetId: string, path: string[] = []): string[] | null {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.id === targetId) return path;
    if (n.children && n.children.length > 0) {
      const found = findPathAncestorIds(n.children, targetId, path.concat([n.id]));
      if (found) return found;
    }
  }
  return null;
}

function insertJavaClassIntoTree(
  nodes: VirtualFileNode[],
  targetPackageId: string,
  newNode: VirtualFileNode,
): VirtualFileNode[] {
  return nodes.map((n) => {
    if (n.id === targetPackageId && Array.isArray(n.children)) {
      return { ...n, children: n.children.concat([newNode]) };
    }
    if (n.children && n.children.length > 0) {
      return { ...n, children: insertJavaClassIntoTree(n.children, targetPackageId, newNode) };
    }
    return n;
  });
}

function cloneTreeWithUpdatedContent(
  nodes: VirtualFileNode[],
  contents: Record<string, string>,
): VirtualFileNode[] {
  return nodes.map((n) => ({
    ...n,
    content: n.content !== undefined && contents[n.id] !== undefined ? contents[n.id] : n.content,
    children: n.children ? cloneTreeWithUpdatedContent(n.children, contents) : undefined,
  }));
}

export function IntellijWorkspace({ reportCapture = false }: { reportCapture?: boolean } = {}) {
  const initialPreset = INTELLIJ_PRESETS[0];

  const [presetId, setPresetId] = useState<IntellijProjectPreset["id"]>(initialPreset.id);
  const [customTrees, setCustomTrees] = useState<Record<string, VirtualFileNode[]>>({
    HelloWorld: INTELLIJ_PRESETS[0].tree,
    "intellij-samples": INTELLIJ_PRESETS[1].tree,
  });
  const [fileContents, setFileContents] = useState<Record<string, string>>(() => ({
    ...collectDefaultContents(INTELLIJ_PRESETS[0].tree),
    ...collectDefaultContents(INTELLIJ_PRESETS[1].tree),
  }));
  const [dirtyFiles, setDirtyFiles] = useState<Record<string, boolean>>({});
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() =>
    collectDefaultExpanded(initialPreset.tree),
  );

  const [openTabIds, setOpenTabIds] = useState<string[]>([initialPreset.defaultFileId]);
  const [activeFileId, setActiveFileId] = useState<string>(initialPreset.defaultFileId);
  const [cursor, setCursor] = useState<EditorCursor>(initialPreset.defaultCursor);

  const [leftTool, setLeftTool] = useState<LeftToolId | null>("project");
  const [bottomTool, setBottomTool] = useState<BottomToolId | null>("run");
  const [rightTool, setRightTool] = useState<RightToolId | null>(null);

  const [leftWidth, setLeftWidth] = useState(310);
  const [bottomHeight, setBottomHeight] = useState(215);
  const [editorFontSize, setEditorFontSize] = useState(13);
  const [softWrap, setSoftWrap] = useState(false);
  const [lineEnding, setLineEnding] = useState<"LF" | "CRLF">("LF");
  const [encoding, setEncoding] = useState<"UTF-8" | "UTF-16" | "ISO-8859-1">("UTF-8");
  const [indentMode, setIndentMode] = useState<"4 spaces" | "2 spaces" | "Tab">("4 spaces");
  const [readerMode, setReaderMode] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  const [gitEnabledByPreset, setGitEnabledByPreset] = useState<Record<string, boolean>>({
    HelloWorld: false,
    "intellij-samples": true,
  });
  const [gitBranchByPreset, setGitBranchByPreset] = useState<Record<string, string>>({
    HelloWorld: "main",
    "intellij-samples": "main",
  });
  const [gitLog, setGitLog] = useState<Array<{ hash: string; message: string; author: string; time: string }>>([
    { hash: "a4c8192", message: "Update async debugging sample queue", author: "JetBrains Dev", time: "2h ago" },
    { hash: "7f19d04", message: "Add UserTestData fixture runner", author: "JetBrains Dev", time: "1d ago" },
  ]);

  const [runConfigsByPreset, setRunConfigsByPreset] = useState<Record<string, RunConfiguration[]>>({
    HelloWorld: INTELLIJ_PRESETS[0].runConfigs,
    "intellij-samples": INTELLIJ_PRESETS[1].runConfigs,
  });
  const [activeRunConfigId, setActiveRunConfigId] = useState<string>(initialPreset.defaultRunConfigId);
  const [isRunning, setIsRunning] = useState(false);
  const [stdinText, setStdinText] = useState("");
  const [jdkCheck, setJdkCheck] = useState<{ fileId: string; code: string; diagnostics: JavaDiagnostic[] } | null>(null);
  const [lastRunResult, setLastRunResult] = useState<JavaRunResult | null>(() =>
    runJavaProgram(INTELLIJ_PRESETS[0].tree[0]?.children?.[2]?.children?.[0]?.children?.[0]?.content || "", "HelloWorld"),
  );

  const [breakpointsByFile, setBreakpointsByFile] = useState<Record<string, Record<number, boolean>>>({});
  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>([
    {
      id: "term-welcome",
      prompt: "",
      command: "",
      outputLines: ["IntelliJ IDEA Embedded Terminal — Java 21 (OpenJDK 21.0.4)"],
    },
  ]);
  const [buildLogs, setBuildLogs] = useState<BuildLogEntry[]>([
    {
      id: "build-init",
      timestamp: "just now",
      status: "success",
      summary: "Build completed successfully in 118 ms",
      details: ["Compiled HelloWorld.java -> out/production/HelloWorld/com/example/java/HelloWorld.class"],
    },
  ]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "notif-1",
      title: "Project SDK configured",
      detail: "openjdk-21 (Java 21.0.4) indexed and ready.",
      time: "just now",
      kind: "info",
    },
  ]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [goToLineOpen, setGoToLineOpen] = useState(false);
  const [newClassOpen, setNewClassOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastShiftTimeRef = useRef<number>(0);

  useReportCapture<JavaReportFrame>(reportCapture, ({ filename, code, output, showOutput }) => {
    const id = "report-source";
    const className = filename.replace(/\.java$/i, "");
    const config = { id, name: className, mainClass: className, fileId: id };
    setCustomTrees(prev => ({ ...prev, HelloWorld: [{ id, name: filename, path: filename, kind: "java", content: code }] }));
    setFileContents({ [id]: code });
    setOpenTabIds([id]);
    setActiveFileId(id);
    setCursor({ line: 1, col: 1 });
    setLeftTool(null);
    setBottomTool(showOutput ? "run" : null);
    setBottomHeight(380);
    setSoftWrap(true);
    setJdkCheck({ fileId: id, code, diagnostics: [] });
    setRunConfigsByPreset(prev => ({ ...prev, HelloWorld: [config] }));
    setActiveRunConfigId(id);
    setLastRunResult(showOutput ? {
      success: true, exitCode: 0, className, commandLine: "", stdout: output, stderr: "",
      outputLines: output.split("\n"), diagnostics: [], durationMs: 0,
    } : null);
  });

  const activePreset = useMemo(() => {
    const preset = INTELLIJ_PRESETS.find((item) => item.id === presetId) || INTELLIJ_PRESETS[0];
    return reportCapture ? { ...preset, name: "Lab", badgeText: "L", moduleName: "Lab", rootPath: "Lab" } : preset;
  }, [presetId, reportCapture]);

  const activeTree = useMemo(
    () => cloneTreeWithUpdatedContent(customTrees[presetId] || activePreset.tree, fileContents),
    [customTrees, presetId, activePreset.tree, fileContents],
  );

  const filesById = useMemo(() => indexVirtualFiles(activeTree), [activeTree]);
  const allFileNodes = useMemo(
    () => Object.keys(filesById).map((k) => filesById[k]).filter((n) => n.content !== undefined),
    [filesById],
  );

  const activeFile = filesById[activeFileId] || null;
  const activeCode = activeFile ? (fileContents[activeFile.id] ?? activeFile.content ?? "") : "";

  const openTabs = useMemo(
    () => openTabIds.map((id) => filesById[id]).filter((n): n is VirtualFileNode => Boolean(n)),
    [openTabIds, filesById],
  );

  const runConfigs = runConfigsByPreset[presetId] || activePreset.runConfigs;
  const activeRunConfig = runConfigs.find((c) => c.id === activeRunConfigId) || runConfigs[0];

  // After a run on the real JDK the markers come from javac (cleared when the text changes); the offline analyzer only
  // describes files that never ran on the JDK.
  const diagnostics = useMemo(() => {
    if (!activeFile || activeFile.kind !== "java") return [];
    if (jdkCheck && jdkCheck.fileId === activeFile.id) return jdkCheck.code === activeCode ? jdkCheck.diagnostics : [];
    return analyzeJavaDiagnostics(activeCode);
  }, [activeFile, activeCode, jdkCheck]);

  const symbols = useMemo(() => {
    if (!activeFile || activeFile.kind !== "java") return [];
    return extractJavaSymbols(activeCode);
  }, [activeFile, activeCode]);

  const pushNotification = useCallback((title: string, detail: string, kind: NotificationItem["kind"] = "info") => {
    setNotifications((prev) => [
      { id: "n-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6), title, detail, time: "just now", kind },
      ...prev,
    ]);
  }, []);

  const jumpToLine = useCallback(
    (line: number, col = 1) => {
      const ta = textareaRef.current;
      const offset = computeOffsetFromCursor(activeCode, line, col);
      setCursor(computeCursorFromOffset(activeCode, offset));
      if (ta) {
        requestAnimationFrame(() => {
          ta.focus();
          ta.setSelectionRange(offset, offset);
          const lineHeight = Math.round(editorFontSize * 1.62);
          const targetScroll = Math.max(0, (line - 4) * lineHeight);
          ta.scrollTop = targetScroll;
        });
      }
    },
    [activeCode, editorFontSize],
  );

  const handleSelectFile = useCallback(
    (node: VirtualFileNode) => {
      if (node.content === undefined) return;
      setOpenTabIds((prev) => (prev.indexOf(node.id) !== -1 ? prev : prev.concat([node.id])));
      setActiveFileId(node.id);
      setCursor({ line: 1, col: 1 });
      const ancestors = findPathAncestorIds(activeTree, node.id);
      if (ancestors) {
        setExpandedIds((prev) => {
          const next = { ...prev };
          for (let i = 0; i < ancestors.length; i++) next[ancestors[i]] = true;
          return next;
        });
      }
      // Match run config if file has one
      const matchingCfg = runConfigs.find((c) => c.fileId === node.id);
      if (matchingCfg) {
        setActiveRunConfigId(matchingCfg.id);
      }
    },
    [activeTree, runConfigs],
  );

  const handleSwitchPreset = useCallback((nextId: IntellijProjectPreset["id"]) => {
    const target = INTELLIJ_PRESETS.find((p) => p.id === nextId);
    if (!target) return;
    setPresetId(target.id);
    setExpandedIds((prev) => ({
      ...prev,
      ...collectDefaultExpanded(customTrees[target.id] || target.tree),
    }));
    setOpenTabIds([target.defaultFileId]);
    setActiveFileId(target.defaultFileId);
    setActiveRunConfigId(target.defaultRunConfigId);
    setCursor(target.defaultCursor);

    if (target.id === "intellij-samples") {
      setBottomTool(null);
    } else {
      setBottomTool("run");
      const hwCode = fileContents["hw-java"] ?? target.tree[0]?.children?.[2]?.children?.[0]?.children?.[0]?.content ?? "";
      setLastRunResult(runJavaProgram(hwCode, "HelloWorld"));
    }
  }, [customTrees, fileContents]);

  const executeRun = useCallback(
    async (targetFileId: string, debugMode = false) => {
      const node = filesById[targetFileId] || activeFile;
      if (!node) return;
      const source = fileContents[node.id] ?? node.content ?? "";
      setIsRunning(true);
      setBottomTool("run");

      // Real JDK on the backend; the offline interpreter only when the user cannot run on the server (and the console says so).
      const simpleName = node.displayName || node.name.replace(/\.java$/, "");
      const remote = await runJavaRemote(source, stdinText);
      if (!remote.ok && remote.reason === "busy") {
        setIsRunning(false);
        return;
      }
      let result: JavaRunResult;
      if (remote.ok) {
        const r = remote.result;
        const pkg = /^\s*package\s+([\w.]+)\s*;/m.exec(source)?.[1];
        const className = r.className || simpleName;
        const fq = pkg ? `${pkg}.${className}` : className;
        const diagnostics = parseJavacDiagnostics(r.stderr).map((d) => ({ ...d, code: "javac" }));
        setJdkCheck({ fileId: node.id, code: source, diagnostics });
        const trimmed = r.stdout.replace(/\r?\n$/, "");
        const outLines = trimmed ? trimmed.split("\n") : [];
        const errLines = r.stderr.trim() ? r.stderr.trim().split("\n") : [];
        const combined = outLines.concat(errLines);
        if (combined.length > 0) combined.push("");
        combined.push("Process finished with exit code " + r.exitCode);
        result = {
          success: r.success,
          exitCode: r.exitCode,
          className: fq,
          commandLine: `java -Dfile.encoding=UTF-8 -classpath out/production/${className} ${fq}`,
          stdout: r.stdout,
          stderr: r.stderr,
          outputLines: combined,
          diagnostics,
          durationMs: Math.max(1, r.durationMs),
        };
      } else {
        result = runJavaProgram(source, simpleName);
        result.outputLines = [OFFLINE_NOTICE, ""].concat(result.outputLines);
      }
      if (debugMode) {
        const bps = Object.keys(breakpointsByFile[node.id] || {}).filter((ln) => breakpointsByFile[node.id][Number(ln)]);
        const debugBanner =
          bps.length > 0
            ? [`Connected to target VM, address: '127.0.0.1:54912', breakpoints active at line(s) ${bps.join(", ")}`]
            : ["Connected to target VM, address: '127.0.0.1:54912', transport: 'socket'"];
        result.outputLines = debugBanner.concat(result.outputLines);
      }

      setLastRunResult(result);
      setDirtyFiles((prev) => ({ ...prev, [node.id]: false }));
      setBuildLogs((prev) => [
        {
          id: "b-" + Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          status: result.success ? "success" : "failed",
          summary: result.success
            ? `Build completed in ${result.durationMs} ms`
            : "Build failed with compilation error(s)",
          details: result.success
            ? [`Executed ${result.className} (exit code ${result.exitCode})`]
            : result.stderr.split("\n"),
        },
        ...prev,
      ]);
      setTimeout(() => setIsRunning(false), 260);
    },
    [filesById, activeFile, fileContents, breakpointsByFile, stdinText],
  );

  const handleCreateNewClass = useCallback(
    (className: string) => {
      const targetPkgId = presetId === "HelloWorld" ? "hw-pkg" : "samples-debugging";
      const pkgName = presetId === "HelloWorld" ? "com.example.java" : "com.jetbrains.debugging";
      const basePath =
        presetId === "HelloWorld"
          ? "src/com/example/java/" + className + ".java"
          : "java-samples/src/main/java/com/jetbrains/debugging/" + className + ".java";
      const newId = "user-" + className.toLowerCase() + "-" + Date.now();
      const template = [
        "package " + pkgName + ";",
        "",
        "public class " + className + " {",
        "    public static void main(String[] args) {",
        "        System.out.println(\"Running " + className + "!\");",
        "    }",
        "}",
        "",
      ].join("\n");

      const newNode: VirtualFileNode = {
        id: newId,
        name: className + ".java",
        displayName: className,
        path: basePath,
        kind: "java",
        isMainClass: true,
        content: template,
      };

      setCustomTrees((prev) => ({
        ...prev,
        [presetId]: insertJavaClassIntoTree(prev[presetId] || activePreset.tree, targetPkgId, newNode),
      }));
      setFileContents((prev) => ({ ...prev, [newId]: template }));
      setExpandedIds((prev) => ({ ...prev, [targetPkgId]: true }));
      setOpenTabIds((prev) => prev.concat([newId]));
      setActiveFileId(newId);
      setCursor({ line: 5, col: 9 });

      const newCfgId = "rc-" + newId;
      setRunConfigsByPreset((prev) => ({
        ...prev,
        [presetId]: (prev[presetId] || activePreset.runConfigs).concat([
          {
            id: newCfgId,
            name: className,
            mainClass: pkgName + "." + className,
            fileId: newId,
          },
        ]),
      }));
      setActiveRunConfigId(newCfgId);
      pushNotification("Created Java Class", `${className}.java added under ${pkgName}.`, "success");
    },
    [presetId, activePreset.tree, activePreset.runConfigs, pushNotification],
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (mod && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setGoToLineOpen(true);
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (activeFile) {
          setDirtyFiles((prev) => ({ ...prev, [activeFile.id]: false }));
          pushNotification("Saved", `${activeFile.name} saved.`);
        }
        return;
      }
      if ((e.shiftKey && e.key === "F10") || (mod && e.key === "Enter")) {
        e.preventDefault();
        executeRun(activeRunConfig.fileId, false);
        return;
      }
      if (e.altKey && e.key === "1") {
        e.preventDefault();
        setLeftTool((t) => (t === "project" ? null : "project"));
        return;
      }
      if (e.altKey && e.key === "4") {
        e.preventDefault();
        setBottomTool((t) => (t === "run" ? null : "run"));
        return;
      }
      if (e.altKey && e.key === "6") {
        e.preventDefault();
        setBottomTool((t) => (t === "problems" ? null : "problems"));
        return;
      }
      if (e.altKey && e.key === "7") {
        e.preventDefault();
        setLeftTool((t) => (t === "structure" ? null : "structure"));
        return;
      }
      if (e.altKey && e.key === "F12") {
        e.preventDefault();
        setBottomTool((t) => (t === "terminal" ? null : "terminal"));
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const now = Date.now();
        if (now - lastShiftTimeRef.current < 340) {
          setSearchOpen(true);
          lastShiftTimeRef.current = 0;
        } else {
          lastShiftTimeRef.current = now;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [activeFile, activeRunConfig.fileId, executeRun, pushNotification]);

  // Splitters dragging
  const startLeftResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = leftWidth;
    const onMove = (ev: MouseEvent) => {
      setLeftWidth(Math.max(180, Math.min(480, startW + (ev.clientX - startX))));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startBottomResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = bottomHeight;
    const onMove = (ev: MouseEvent) => {
      setBottomHeight(Math.max(120, Math.min(480, startH - (ev.clientY - startY))));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const searchActions: SearchActionItem[] = useMemo(
    () => [
      {
        id: "run-active",
        label: `Run '${activeRunConfig.name}'`,
        shortcut: "Shift+F10",
        onTrigger: () => executeRun(activeRunConfig.fileId, false),
      },
      {
        id: "new-class",
        label: "New Java Class...",
        shortcut: "Ctrl+N",
        onTrigger: () => setNewClassOpen(true),
      },
      {
        id: "toggle-terminal",
        label: "Open Terminal Tool Window",
        shortcut: "Alt+F12",
        onTrigger: () => setBottomTool("terminal"),
      },
      {
        id: "toggle-problems",
        label: "Open Problems Tool Window",
        shortcut: "Alt+6",
        onTrigger: () => setBottomTool("problems"),
      },
      {
        id: "switch-samples",
        label: presetId === "HelloWorld" ? "Switch Project: intellij-samples" : "Switch Project: HelloWorld",
        onTrigger: () => handleSwitchPreset(presetId === "HelloWorld" ? "intellij-samples" : "HelloWorld"),
      },
      {
        id: "goto-line",
        label: "Go to Line:Column...",
        shortcut: "Ctrl+G",
        onTrigger: () => setGoToLineOpen(true),
      },
    ],
    [activeRunConfig, executeRun, presetId, handleSwitchPreset],
  );

  const modifiedFileList = useMemo(
    () =>
      Object.keys(dirtyFiles)
        .filter((id) => dirtyFiles[id] && filesById[id])
        .map((id) => ({ id, name: filesById[id].name, path: filesById[id].path })),
    [dirtyFiles, filesById],
  );

  const handleRunTerminal = (rawCmd: string) => {
    const out = executeTerminalCommand(rawCmd, activePreset, filesById, activeFileId);
    if (out.clear) {
      setTerminalEntries([]);
      return;
    }
    setTerminalEntries((prev) => [
      ...prev,
      {
        id: "t-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        prompt: activePreset.rootPath + " %",
        command: rawCmd,
        outputLines: out.lines,
      },
    ]);
  };

  const handleResetWorkspace = () => {
    setCustomTrees({
      HelloWorld: INTELLIJ_PRESETS[0].tree,
      "intellij-samples": INTELLIJ_PRESETS[1].tree,
    });
    setFileContents({
      ...collectDefaultContents(INTELLIJ_PRESETS[0].tree),
      ...collectDefaultContents(INTELLIJ_PRESETS[1].tree),
    });
    setDirtyFiles({});
    setRunConfigsByPreset({
      HelloWorld: INTELLIJ_PRESETS[0].runConfigs,
      "intellij-samples": INTELLIJ_PRESETS[1].runConfigs,
    });
    setPresetId("HelloWorld");
    setExpandedIds(collectDefaultExpanded(INTELLIJ_PRESETS[0].tree));
    setOpenTabIds([INTELLIJ_PRESETS[0].defaultFileId]);
    setActiveFileId(INTELLIJ_PRESETS[0].defaultFileId);
    setActiveRunConfigId(INTELLIJ_PRESETS[0].defaultRunConfigId);
    setCursor(INTELLIJ_PRESETS[0].defaultCursor);
    setLeftTool("project");
    setBottomTool("run");
    setRightTool(null);
    setReaderMode(false);
    setEncoding("UTF-8");
    setIndentMode("4 spaces");
    setReadOnly(false);
    setLastRunResult(
      runJavaProgram(INTELLIJ_PRESETS[0].tree[0]?.children?.[2]?.children?.[0]?.children?.[0]?.content || "", "HelloWorld"),
    );
    pushNotification("Workspace Restored", "Default HelloWorld project layout and code restored.");
  };

  return (
    <div className={styles.workspaceRoot}>
      <HeaderToolbar
        presets={INTELLIJ_PRESETS}
        activePreset={activePreset}
        gitEnabled={Boolean(gitEnabledByPreset[presetId])}
        gitBranch={gitBranchByPreset[presetId] || "main"}
        runConfigs={runConfigs}
        activeRunConfig={activeRunConfig}
        isRunning={isRunning}
        editorFontSize={editorFontSize}
        softWrap={softWrap}
        onSelectPreset={handleSwitchPreset}
        onSelectRunConfig={(cfgId) => {
          setActiveRunConfigId(cfgId);
          const cfg = runConfigs.find((c) => c.id === cfgId);
          if (cfg && filesById[cfg.fileId]) {
            handleSelectFile(filesById[cfg.fileId]);
          }
        }}
        onRunActiveConfig={(debugMode) => executeRun(activeRunConfig.fileId, Boolean(debugMode))}
        onEnableGit={() => {
          setGitEnabledByPreset((prev) => ({ ...prev, [presetId]: true }));
          pushNotification("Git Repository Created", `Initialized Git repository in ${activePreset.rootPath}.`, "success");
        }}
        onSwitchBranch={(b) => {
          setGitBranchByPreset((prev) => ({ ...prev, [presetId]: b }));
          pushNotification("Git Checkout", `Checked out branch '${b}'.`);
        }}
        onOpenSearchEverywhere={() => setSearchOpen(true)}
        onOpenNewClassModal={() => setNewClassOpen(true)}
        onOpenCommitPane={() => setLeftTool("commit")}
        onChangeFontSize={setEditorFontSize}
        onToggleSoftWrap={() => setSoftWrap((s) => !s)}
        onToggleBottomPane={() => setBottomTool((b) => (b ? null : "run"))}
        onResetWorkspace={handleResetWorkspace}
        onNotify={(t, d) => pushNotification(t, d)}
      />

      <div className={styles.mainWorkspace}>
        <LeftToolStripe
          activeLeft={leftTool}
          activeBottom={bottomTool}
          gitEnabled={Boolean(gitEnabledByPreset[presetId])}
          problemCount={diagnostics.length}
          onToggleLeft={(id) => setLeftTool((cur) => (cur === id ? null : id))}
          onToggleBottom={(id) => setBottomTool((cur) => (cur === id ? null : id))}
          onOpenMoreTools={() => setSearchOpen(true)}
        />

        <div className={styles.centerShell}>
          <div className={styles.upperSplit}>
            {leftTool && (
              <>
                <ProjectTreePane
                  activeTool={leftTool}
                  preset={activePreset}
                  tree={activeTree}
                  expandedIds={expandedIds}
                  selectedFileId={activeFileId}
                  width={leftWidth}
                  symbols={symbols}
                  dirtyFiles={dirtyFiles}
                  modifiedFileList={modifiedFileList}
                  onToggleExpand={(id) => setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }))}
                  onExpandAll={() => setExpandedIds(collectAllFolders(activeTree, true))}
                  onCollapseAll={() => setExpandedIds(collectAllFolders(activeTree, false))}
                  onLocateActiveFile={() => {
                    if (activeFile) handleSelectFile(activeFile);
                  }}
                  onSelectFile={handleSelectFile}
                  onSelectFileById={(id) => {
                    const node = filesById[id];
                    if (node) handleSelectFile(node);
                  }}
                  onJumpToLine={(line) => jumpToLine(line, 1)}
                  onCommitChanges={(msg) => {
                    const shortHash = Math.random().toString(16).slice(2, 9);
                    setGitLog((prev) => [{ hash: shortHash, message: msg, author: "You", time: "just now" }, ...prev]);
                    setDirtyFiles({});
                    pushNotification("Committed", `[${gitBranchByPreset[presetId] || "main"} ${shortHash}] ${msg}`, "success");
                  }}
                  onOpenNewClassModal={() => setNewClassOpen(true)}
                  onHidePane={() => setLeftTool(null)}
                />
                <div className={styles.vSplitter} onMouseDown={startLeftResize} role="separator" aria-orientation="vertical" />
              </>
            )}

            <CodeEditorPane
              openTabs={openTabs}
              activeFile={activeFile}
              presetId={activePreset.id}
              code={activeCode}
              cursor={cursor}
              fontSize={editorFontSize}
              indentUnit={indentMode === "2 spaces" ? "  " : indentMode === "Tab" ? "\t" : "    "}
              readOnly={readOnly}
              softWrap={softWrap}
              dirtyFiles={dirtyFiles}
              diagnostics={diagnostics}
              symbols={symbols}
              breakpoints={breakpointsByFile[activeFileId] || {}}
              textareaRef={textareaRef}
              onSelectTab={(id) => {
                setActiveFileId(id);
                setCursor({ line: 1, col: 1 });
              }}
              onCloseTab={(id) => {
                setOpenTabIds((prev) => {
                  const next = prev.filter((t) => t !== id);
                  if (activeFileId === id) {
                    setActiveFileId(next[next.length - 1] || "");
                  }
                  return next;
                });
              }}
              onCloseOtherTabs={() => {
                if (activeFileId) setOpenTabIds([activeFileId]);
              }}
              onChangeCode={(nextCode) => {
                if (!activeFile) return;
                setFileContents((prev) => ({ ...prev, [activeFile.id]: nextCode }));
                setDirtyFiles((prev) => ({ ...prev, [activeFile.id]: true }));
              }}
              onCursorChange={setCursor}
              onToggleBreakpoint={(line) => {
                if (!activeFile) return;
                setBreakpointsByFile((prev) => {
                  const fileBps = prev[activeFile.id] || {};
                  return {
                    ...prev,
                    [activeFile.id]: { ...fileBps, [line]: !fileBps[line] },
                  };
                });
              }}
              onRunCurrentFile={() => {
                if (!activeFile) return;
                const matching = runConfigs.find((c) => c.fileId === activeFile.id);
                if (matching) setActiveRunConfigId(matching.id);
                executeRun(activeFile.id, false);
              }}
              onOpenProblemsTab={() => setBottomTool("problems")}
              onJumpToLine={(line) => jumpToLine(line, 1)}
            />
          </div>

          {bottomTool && (
            <>
              <div className={styles.hSplitter} onMouseDown={startBottomResize} role="separator" aria-orientation="horizontal" />
              <BottomToolWindow
                activeTool={bottomTool}
                height={bottomHeight}
                preset={activePreset}
                activeRunConfig={activeRunConfig}
                runResult={lastRunResult}
                isRunning={isRunning}
                softWrap={softWrap}
                stdin={stdinText}
                onStdinChange={setStdinText}
                diagnostics={diagnostics}
                activeFileName={activeFile?.name || "HelloWorld.java"}
                terminalEntries={terminalEntries}
                buildLogs={buildLogs}
                gitEnabled={Boolean(gitEnabledByPreset[presetId])}
                gitBranch={gitBranchByPreset[presetId] || "main"}
                gitLog={gitLog}
                onSelectBottomTool={setBottomTool}
                onHide={() => setBottomTool(null)}
                onRerun={() => executeRun(activeRunConfig.fileId, false)}
                onStopRun={() => {
                  setIsRunning(false);
                  if (lastRunResult && isRunning) {
                    setLastRunResult({
                      ...lastRunResult,
                      outputLines: lastRunResult.outputLines.concat(["Process finished with exit code 130 (interrupted)"]),
                    });
                  }
                }}
                onClearRunConsole={() => setLastRunResult(null)}
                onCaptureThreadDump={() => {
                  const dump = [
                    "Full thread dump OpenJDK 64-Bit Server VM (21.0.4+7-LTS):",
                    '"main" #1 prio=5 os_prio=31 tid=0x00007f9c14008800 runnable',
                    `   at ${activeRunConfig.mainClass}.main(${activeFile?.name || "HelloWorld.java"}:${cursor.line})`,
                    "",
                  ];
                  setLastRunResult((prev) =>
                    prev
                      ? { ...prev, outputLines: prev.outputLines.concat(dump) }
                      : {
                          success: true,
                          exitCode: 0,
                          className: activeRunConfig.mainClass,
                          commandLine: "",
                          stdout: "",
                          stderr: "",
                          outputLines: dump,
                          diagnostics: [],
                          durationMs: 1,
                        },
                  );
                }}
                onToggleSoftWrap={() => setSoftWrap((s) => !s)}
                onJumpToLine={jumpToLine}
                onRunTerminalCommand={handleRunTerminal}
                onTriggerBuild={() => {
                  const diags = analyzeJavaDiagnostics(activeCode).filter((d) => d.severity === "error");
                  setBuildLogs((prev) => [
                    {
                      id: "b-" + Date.now(),
                      timestamp: new Date().toLocaleTimeString(),
                      status: diags.length === 0 ? "success" : "failed",
                      summary:
                        diags.length === 0
                          ? "Build completed successfully in 84 ms"
                          : `Build failed with ${diags.length} error(s)`,
                      details:
                        diags.length === 0
                          ? [`Compiled ${activeFile?.name || "project"} -> out/production/${activePreset.moduleName}/`]
                          : diags.map((d) => `${activeFile?.name}:${d.line}: error: ${d.message}`),
                    },
                    ...prev,
                  ]);
                }}
                onEnableGit={() => setGitEnabledByPreset((prev) => ({ ...prev, [presetId]: true }))}
              />
            </>
          )}
        </div>

        {rightTool && (
          <RightDrawerPane
            activeRight={rightTool}
            preset={activePreset}
            notifications={notifications}
            onClearNotifications={() => setNotifications([])}
            onRunActiveConfig={() => executeRun(activeRunConfig.fileId, false)}
            onHide={() => setRightTool(null)}
          />
        )}

        <RightToolStripe
          activeRight={rightTool}
          unreadNotifications={notifications.length}
          onToggleRight={(id) => setRightTool((cur) => (cur === id ? null : id))}
        />
      </div>

      <StatusBreadcrumbBar
        preset={activePreset}
        activeFile={activeFile}
        symbols={symbols}
        cursor={cursor}
        lineEnding={lineEnding}
        encoding={encoding}
        indentLabel={indentMode}
        readerMode={readerMode}
        readOnly={readOnly}
        onJumpToLine={(line) => jumpToLine(line, 1)}
        onOpenGoToLine={() => setGoToLineOpen(true)}
        onToggleReaderMode={() => {
          setReaderMode((rm) => {
            const next = !rm;
            pushNotification("Reader Mode", next ? "Reader mode enabled for distraction-free viewing." : "Reader mode disabled.");
            return next;
          });
        }}
        onToggleLineEnding={() => setLineEnding((le) => (le === "LF" ? "CRLF" : "LF"))}
        onCycleEncoding={() => {
          setEncoding((enc) => {
            const next = enc === "UTF-8" ? "UTF-16" : enc === "UTF-16" ? "ISO-8859-1" : "UTF-8";
            pushNotification("File Encoding", `File encoding set to ${next}.`);
            return next;
          });
        }}
        onCycleIndent={() => {
          setIndentMode((im) => {
            const next = im === "4 spaces" ? "2 spaces" : im === "2 spaces" ? "Tab" : "4 spaces";
            pushNotification("Indentation", `Editor indent set to ${next}.`);
            return next;
          });
        }}
        onToggleReadOnly={() => setReadOnly((r) => !r)}
        onLocateInProject={() => {
          setLeftTool("project");
          if (activeFile) handleSelectFile(activeFile);
        }}
      />

      <SearchEverywhereModal
        open={searchOpen}
        files={allFileNodes}
        actions={searchActions}
        onClose={() => setSearchOpen(false)}
        onSelectFile={handleSelectFile}
      />

      <GoToLineModal
        open={goToLineOpen}
        initialLine={cursor.line}
        onClose={() => setGoToLineOpen(false)}
        onGo={(line, col) => jumpToLine(line, col)}
      />

      <NewClassModal
        open={newClassOpen}
        onClose={() => setNewClassOpen(false)}
        onCreate={handleCreateNewClass}
      />
    </div>
  );
}
