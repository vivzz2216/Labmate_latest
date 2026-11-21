"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./androidStudio.module.css";
import type { ScreenState } from "@/lib/ide/kotlin/android";
import { EmulatorScreen } from "./EmulatorScreen";
import {
  DesignSurfaceMode,
  EditorSplitMode,
  PreviewWidgetNode,
  StudioFile,
  StudioProblem,
} from "@/lib/ide/androidStudioEngine";
import {
  PaletteWidgetKind,
  XmlLayoutElement,
  collectAllXmlIds,
  formatAndroidXml,
  formatJavaOrKotlinCode,
  insertComponentIntoLayoutXml,
  parseAndroidLayoutXml,
  parseAndroidResources,
  removeComponentFromLayoutXml,
  resolveResourceValue,
  updateElementAttributeInXml,
} from "@/lib/ide/androidXmlLayout";
import {
  CheckGreenIcon,
  ComposableGutterIcon,
  EditorOnlyIcon,
  EditorPreviewSplitIcon,
  ErrorCircleIcon,
  GradleFileIcon,
  JavaFileIcon,
  KotlinFileIcon,
  KotlinGradleScriptIcon,
  ManifestFileIcon,
  PreviewOnlyDesignIcon,
  PropertiesFileIcon,
  RestartIcon,
  RunPlayIcon,
  RunPreviewOnDeviceIcon,
  TomlFileIcon,
  WarningTriangleIcon,
  XmlFileIcon,
} from "./StudioIcons";

export interface EditorCommandSignal {
  seq: number;
  kind: "find" | "replace" | "format" | "comment" | "autocomplete" | "gotoLine";
  line?: number;
}

interface StudioEditorSplitPaneProps {
  allFiles: StudioFile[];
  openTabs: StudioFile[];
  activeFile: StudioFile;
  dirtyFileIds: Set<string>;
  onSelectTab: (fileId: string) => void;
  onCloseTab: (fileId: string) => void;
  onUpdateFileContent: (fileId: string, newContent: string) => void;
  splitMode: EditorSplitMode;
  onChangeSplitMode: (mode: EditorSplitMode) => void;
  designSurfaceMode: DesignSurfaceMode;
  onChangeDesignSurfaceMode: (mode: DesignSurfaceMode) => void;
  previewTree: PreviewWidgetNode;
  composeClickCount: number;
  onIncrementComposeCounter: () => void;
  /** Kotlin projects: the @Preview function run by the same engine as the emulator. Undefined for Java/XML projects. */
  composePreview?: { screen: ScreenState | null; fn: string | null; message: string | null };
  onPreviewClick?: (uid: string) => void;
  onPreviewInput?: (uid: string, text: string) => void;
  onPreviewToggle?: (uid: string, checked: boolean) => void;
  onPreviewDialogButton?: (id: number) => void;
  onRunFromGutter: () => void;
  onDeployPreviewToDevice: () => void;
  problems: StudioProblem[];
  onOpenProblemsPanel: () => void;
  cursorPos: { line: number; col: number };
  onChangeCursorPos: (pos: { line: number; col: number }) => void;
  commandSignal?: EditorCommandSignal | null;
}

export function renderFileTabIcon(file: StudioFile) {
  if (file.kind === "manifest") return <ManifestFileIcon size={15} />;
  switch (file.kind) {
    case "java":
      return <JavaFileIcon size={15} />;
    case "kotlin":
      return <KotlinFileIcon size={15} />;
    case "xml":
    case "svg":
      return <XmlFileIcon size={15} />;
    case "gradle-kts":
      return <KotlinGradleScriptIcon size={15} />;
    case "gradle":
      return <GradleFileIcon size={15} />;
    case "toml":
      return <TomlFileIcon size={15} />;
    case "properties":
    case "proguard":
      return <PropertiesFileIcon size={15} />;
    default:
      return <GradleFileIcon size={15} />;
  }
}

const CODE_KEYWORDS = new Set([
  "package",
  "import",
  "public",
  "private",
  "protected",
  "internal",
  "class",
  "interface",
  "extends",
  "implements",
  "enum",
  "object",
  "data",
  "sealed",
  "abstract",
  "static",
  "final",
  "void",
  "fun",
  "val",
  "var",
  "override",
  "int",
  "double",
  "float",
  "long",
  "boolean",
  "char",
  "byte",
  "short",
  "return",
  "if",
  "else",
  "when",
  "switch",
  "case",
  "default",
  "break",
  "continue",
  "for",
  "while",
  "do",
  "try",
  "catch",
  "finally",
  "throw",
  "throws",
  "new",
  "true",
  "false",
  "null",
  "by",
  "in",
  "is",
  "as",
  "super",
  "this",
  "plugins",
  "android",
  "defaultConfig",
  "buildTypes",
  "compileOptions",
  "dependencies",
  "implementation",
  "testImplementation",
  "include",
]);

function highlightCodeLine(line: string, kind: StudioFile["kind"]): React.ReactNode {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
    return <span className={styles.tokComment}>{line}</span>;
  }
  if (kind === "xml" || kind === "manifest" || kind === "svg") {
    const parts: React.ReactNode[] = [];
    const regex = /(<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/?[a-zA-Z0-9_.:-]+|\s+[a-zA-Z0-9_:-]+(?==)|"[^"]*"|\/>|>)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith("<!--") || token.startsWith("<?")) {
        parts.push(
          <span key={key++} className={styles.tokComment}>
            {token}
          </span>
        );
      } else if (token.startsWith("<") || token === ">" || token === "/>") {
        parts.push(
          <span key={key++} className={styles.tokTag}>
            {token}
          </span>
        );
      } else if (token.startsWith('"')) {
        parts.push(
          <span key={key++} className={styles.tokString}>
            {token}
          </span>
        );
      } else {
        parts.push(
          <span key={key++} className={styles.tokXmlNs}>
            {token}
          </span>
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }
    return parts;
  }

  const tokens: React.ReactNode[] = [];
  const tokenRegex =
    /(\/\/.*$|@[A-Za-z0-9_]+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b0x[0-9A-Fa-f]+\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = tokenRegex.exec(line)) !== null) {
    if (m.index > lastIdx) {
      tokens.push(line.slice(lastIdx, m.index));
    }
    const word = m[0];
    if (word.startsWith("//")) {
      tokens.push(
        <span key={k++} className={styles.tokComment}>
          {word}
        </span>
      );
    } else if (word.startsWith("@")) {
      tokens.push(
        <span key={k++} className={styles.tokAnnotation}>
          {word}
        </span>
      );
    } else if (word.startsWith('"') || word.startsWith("'")) {
      tokens.push(
        <span key={k++} className={styles.tokString}>
          {word}
        </span>
      );
    } else if (/^(0x|\d)/.test(word)) {
      tokens.push(
        <span key={k++} className={styles.tokNumber}>
          {word}
        </span>
      );
    } else if (CODE_KEYWORDS.has(word)) {
      tokens.push(
        <span key={k++} className={styles.tokKeyword}>
          {word}
        </span>
      );
    } else if (line[m.index + word.length] === "(") {
      tokens.push(
        <span key={k++} className={styles.tokCall}>
          {word}
        </span>
      );
    } else if (/^[A-Z]/.test(word)) {
      tokens.push(
        <span key={k++} className={styles.tokProperty}>
          {word}
        </span>
      );
    } else {
      tokens.push(word);
    }
    lastIdx = tokenRegex.lastIndex;
  }
  if (lastIdx < line.length) {
    tokens.push(line.slice(lastIdx));
  }
  return tokens;
}

interface CompletionItem {
  label: string;
  detail: string;
  insertText: string;
}

const PALETTE_ITEMS: Array<{ kind: PaletteWidgetKind; category: "Common" | "Text" | "Buttons" | "Layouts"; icon: string }> = [
  { kind: "TextView", category: "Text", icon: "T" },
  { kind: "EditText", category: "Text", icon: "ab" },
  { kind: "Button", category: "Buttons", icon: "▢" },
  { kind: "ImageView", category: "Common", icon: "🖼" },
  { kind: "CheckBox", category: "Buttons", icon: "☑" },
  { kind: "Switch", category: "Buttons", icon: "⊶" },
  { kind: "LinearLayout", category: "Layouts", icon: "▤" },
  { kind: "RelativeLayout", category: "Layouts", icon: "▥" },
  { kind: "ConstraintLayout", category: "Layouts", icon: "⊞" },
];

function findElementByIdOrUid(node: XmlLayoutElement | null, target: string): XmlLayoutElement | null {
  if (!node) return null;
  if (target && (node.id === target || node.uid === target)) return node;
  for (let i = 0; i < node.children.length; i++) {
    const hit = findElementByIdOrUid(node.children[i], target);
    if (hit) return hit;
  }
  return null;
}

export function StudioEditorSplitPane({
  allFiles,
  openTabs,
  activeFile,
  dirtyFileIds,
  onSelectTab,
  onCloseTab,
  onUpdateFileContent,
  splitMode,
  onChangeSplitMode,
  designSurfaceMode,
  onChangeDesignSurfaceMode,
  previewTree,
  composeClickCount,
  onIncrementComposeCounter,
  composePreview,
  onPreviewClick,
  onPreviewInput,
  onPreviewToggle,
  onPreviewDialogButton,
  onRunFromGutter,
  onDeployPreviewToDevice,
  problems,
  onOpenProblemsPanel,
  cursorPos,
  onChangeCursorPos,
  commandSignal,
}: StudioEditorSplitPaneProps) {
  const [breakpoints, setBreakpoints] = useState<Set<string>>(new Set());
  const [interactivePreview, setInteractivePreview] = useState(true);
  const [paletteCategory, setPaletteCategory] = useState<"Common" | "Text" | "Buttons" | "Layouts">("Common");
  const [selectedXmlId, setSelectedXmlId] = useState<string>("");

  // Find & Replace Bar
  const [showFindBar, setShowFindBar] = useState(false);
  const [showReplaceRow, setShowReplaceRow] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [findCaseSensitive, setFindCaseSensitive] = useState(false);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  // Autocomplete
  const [acState, setAcState] = useState<{
    open: boolean;
    prefixStart: number;
    items: CompletionItem[];
    selectedIndex: number;
  }>({ open: false, prefixStart: 0, items: [], selectedIndex: 0 });

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const lines = activeFile.content.split("\n");
  const fileProblems = problems.filter((p) => p.fileId === activeFile.id);
  const errorCount = fileProblems.filter((p) => p.severity === "error").length;
  const warnCount = fileProblems.filter((p) => p.severity === "warning").length;

  const isXmlLayoutFile = Boolean(activeFile.isLayoutXml || activeFile.path.indexOf("res/layout/") >= 0);

  const parsedResources = useMemo(() => parseAndroidResources(allFiles), [allFiles]);
  const parsedXmlTree = useMemo(
    () => (isXmlLayoutFile ? parseAndroidLayoutXml(activeFile.content) : { root: null, errors: [] }),
    [isXmlLayoutFile, activeFile.content]
  );

  const selectedElement = useMemo(() => {
    if (!parsedXmlTree.root) return null;
    const hit = selectedXmlId ? findElementByIdOrUid(parsedXmlTree.root, selectedXmlId) : null;
    return hit || parsedXmlTree.root.children[0] || parsedXmlTree.root;
  }, [parsedXmlTree.root, selectedXmlId]);

  const allXmlIds = useMemo(() => {
    const combined: string[] = [];
    for (let i = 0; i < allFiles.length; i++) {
      if (allFiles[i].isLayoutXml || allFiles[i].path.indexOf("res/layout/") >= 0) {
        const res = parseAndroidLayoutXml(allFiles[i].content);
        const ids = collectAllXmlIds(res.root);
        for (let j = 0; j < ids.length; j++) {
          if (combined.indexOf(ids[j]) < 0) combined.push(ids[j]);
        }
      }
    }
    return combined;
  }, [allFiles]);

  // Compute Find matches
  const findMatches = useMemo(() => {
    if (!findQuery) return [];
    const hay = findCaseSensitive ? activeFile.content : activeFile.content.toLowerCase();
    const needle = findCaseSensitive ? findQuery : findQuery.toLowerCase();
    const hits: number[] = [];
    let pos = 0;
    while (pos <= hay.length - needle.length) {
      const found = hay.indexOf(needle, pos);
      if (found < 0) break;
      hits.push(found);
      pos = found + Math.max(1, needle.length);
    }
    return hits;
  }, [activeFile.content, findQuery, findCaseSensitive]);

  const jumpToOffset = (offset: number, length: number) => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(offset, offset + length);
    const lineNum = el.value.slice(0, offset).split("\n").length;
    el.scrollTop = Math.max(0, (lineNum - 5) * 21);
    onChangeCursorPos({
      line: lineNum,
      col: offset - el.value.lastIndexOf("\n", offset - 1),
    });
  };

  const buildCompletions = (source: string, cursorOffset: number): { prefixStart: number; items: CompletionItem[] } => {
    const before = source.slice(0, cursorOffset);
    const tokenMatch = /([A-Za-z0-9_.:@+/]*)$/.exec(before);
    const token = tokenMatch ? tokenMatch[1] : "";
    const prefixStart = cursorOffset - token.length;
    const lower = token.toLowerCase();

    const pool: CompletionItem[] = [];
    if (activeFile.kind === "xml" || activeFile.kind === "manifest") {
      [
        { label: "TextView", detail: "android.widget", insertText: '<TextView\n    android:id="@+id/tvItem"\n    android:layout_width="wrap_content"\n    android:layout_height="wrap_content"\n    android:text="Label" />' },
        { label: "EditText", detail: "android.widget", insertText: '<EditText\n    android:id="@+id/etInput"\n    android:layout_width="match_parent"\n    android:layout_height="wrap_content"\n    android:hint="Enter text" />' },
        { label: "Button", detail: "android.widget", insertText: '<Button\n    android:id="@+id/btnAction"\n    android:layout_width="wrap_content"\n    android:layout_height="wrap_content"\n    android:text="Submit" />' },
        { label: "ImageView", detail: "android.widget", insertText: '<ImageView\n    android:id="@+id/ivIcon"\n    android:layout_width="48dp"\n    android:layout_height="48dp"\n    android:src="@drawable/ic_launcher_foreground" />' },
        { label: "LinearLayout", detail: "android.widget", insertText: '<LinearLayout\n    android:layout_width="match_parent"\n    android:layout_height="wrap_content"\n    android:orientation="vertical">\n</LinearLayout>' },
        { label: "android:id", detail: "XML Attribute", insertText: 'android:id="@+id/"' },
        { label: "android:layout_width", detail: "XML Attribute", insertText: 'android:layout_width="match_parent"' },
        { label: "android:layout_height", detail: "XML Attribute", insertText: 'android:layout_height="wrap_content"' },
        { label: "android:text", detail: "XML Attribute", insertText: 'android:text=""' },
        { label: "android:hint", detail: "XML Attribute", insertText: 'android:hint=""' },
        { label: "android:orientation", detail: "XML Attribute", insertText: 'android:orientation="vertical"' },
        { label: "android:textSize", detail: "XML Attribute", insertText: 'android:textSize="16sp"' },
        { label: "android:padding", detail: "XML Attribute", insertText: 'android:padding="16dp"' },
      ].forEach((c) => pool.push(c));
    } else {
      for (let i = 0; i < allXmlIds.length; i++) {
        pool.push({
          label: `R.id.${allXmlIds[i]}`,
          detail: "View ID",
          insertText: `R.id.${allXmlIds[i]}`,
        });
      }
      [
        { label: "findViewById", detail: "Activity", insertText: "findViewById(R.id.)" },
        { label: "setOnClickListener", detail: "View", insertText: "setOnClickListener(v -> {\n    \n})" },
        { label: "Toast.makeText", detail: "android.widget", insertText: 'Toast.makeText(this, "", Toast.LENGTH_SHORT).show();' },
        { label: "Intent", detail: "android.content", insertText: "Intent intent = new Intent(this, SecondActivity.class);\nstartActivity(intent);" },
        { label: "Log.i", detail: "android.util", insertText: 'Log.i("MainActivity", "");' },
        { label: "Log.d", detail: "android.util", insertText: 'Log.d("MainActivity", "");' },
        { label: "Log.e", detail: "android.util", insertText: 'Log.e("MainActivity", "");' },
        { label: "EditText", detail: "android.widget", insertText: "EditText" },
        { label: "TextView", detail: "android.widget", insertText: "TextView" },
        { label: "Button", detail: "android.widget", insertText: "Button" },
        { label: "AppCompatActivity", detail: "androidx.appcompat", insertText: "AppCompatActivity" },
        { label: "setContentView", detail: "Activity", insertText: "setContentView(R.layout.activity_main);" },
      ].forEach((c) => pool.push(c));
    }

    const filtered = token
      ? pool.filter((p) => p.label.toLowerCase().indexOf(lower) >= 0)
      : pool;
    return { prefixStart, items: filtered.slice(0, 10) };
  };

  const applyCompletion = (item: CompletionItem) => {
    const el = textareaRef.current;
    if (!el) return;
    const end = el.selectionStart || 0;
    const next = el.value.slice(0, acState.prefixStart) + item.insertText + el.value.slice(end);
    onUpdateFileContent(activeFile.id, next);
    const caret = acState.prefixStart + item.insertText.length;
    setAcState((s) => ({ ...s, open: false }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const handleFormatActiveFile = () => {
    const formatted =
      activeFile.kind === "xml" || activeFile.kind === "manifest"
        ? formatAndroidXml(activeFile.content)
        : formatJavaOrKotlinCode(activeFile.content);
    onUpdateFileContent(activeFile.id, formatted);
  };

  const handleToggleLineComment = () => {
    const el = textareaRef.current;
    if (!el) return;
    const val = el.value;
    const selStart = el.selectionStart || 0;
    const lineStart = val.lastIndexOf("\n", selStart - 1) + 1;
    const lineEndRaw = val.indexOf("\n", selStart);
    const lineEnd = lineEndRaw < 0 ? val.length : lineEndRaw;
    const line = val.slice(lineStart, lineEnd);
    const isXml = activeFile.kind === "xml" || activeFile.kind === "manifest";

    let nextLine = line;
    if (isXml) {
      const m = /^(\s*)<!--\s?([\s\S]*?)\s?-->$/.exec(line);
      nextLine = m ? `${m[1]}${m[2]}` : line.replace(/^(\s*)(.+)$/, "$1<!-- $2 -->");
    } else {
      const m = /^(\s*)\/\/\s?(.*)$/.exec(line);
      nextLine = m ? `${m[1]}${m[2]}` : line.replace(/^(\s*)(.*)$/, "$1// $2");
    }
    const nextVal = val.slice(0, lineStart) + nextLine + val.slice(lineEnd);
    onUpdateFileContent(activeFile.id, nextVal);
  };

  // Respond to Main Menu / Problems click commands
  useEffect(() => {
    if (!commandSignal) return;
    if (commandSignal.kind === "find") {
      setShowFindBar(true);
      setShowReplaceRow(false);
    } else if (commandSignal.kind === "replace") {
      setShowFindBar(true);
      setShowReplaceRow(true);
    } else if (commandSignal.kind === "format") {
      handleFormatActiveFile();
    } else if (commandSignal.kind === "comment") {
      handleToggleLineComment();
    } else if (commandSignal.kind === "autocomplete") {
      const el = textareaRef.current;
      if (el) {
        const res = buildCompletions(el.value, el.selectionStart || 0);
        setAcState({ open: res.items.length > 0, prefixStart: res.prefixStart, items: res.items, selectedIndex: 0 });
      }
    } else if (commandSignal.kind === "gotoLine" && commandSignal.line) {
      const targetLine = Math.max(1, commandSignal.line);
      const split = activeFile.content.split("\n");
      let offset = 0;
      for (let i = 0; i < Math.min(targetLine - 1, split.length); i++) {
        offset += split[i].length + 1;
      }
      jumpToOffset(offset, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandSignal?.seq]);

  const handleTextareaScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const top = e.currentTarget.scrollTop;
    const left = e.currentTarget.scrollLeft;
    if (preRef.current) {
      preRef.current.scrollTop = top;
      preRef.current.scrollLeft = left;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = top;
    }
  };

  const updateCursorFromTextarea = (el: HTMLTextAreaElement) => {
    const pos = el.selectionStart || 0;
    const upto = el.value.slice(0, pos);
    const split = upto.split("\n");
    onChangeCursorPos({
      line: split.length,
      col: split[split.length - 1].length + 1,
    });
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const val = el.value;

    // Autocomplete keyboard navigation
    if (acState.open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAcState((s) => ({ ...s, selectedIndex: (s.selectedIndex + 1) % s.items.length }));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAcState((s) => ({ ...s, selectedIndex: (s.selectedIndex - 1 + s.items.length) % s.items.length }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const chosen = acState.items[acState.selectedIndex];
        if (chosen) applyCompletion(chosen);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setAcState((s) => ({ ...s, open: false }));
        return;
      }
    }

    // Ctrl+Space triggers autocomplete
    if ((e.ctrlKey || e.metaKey) && e.code === "Space") {
      e.preventDefault();
      const res = buildCompletions(val, start);
      setAcState({ open: res.items.length > 0, prefixStart: res.prefixStart, items: res.items, selectedIndex: 0 });
      return;
    }

    // Ctrl+F / Ctrl+H / Ctrl+/
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      setShowFindBar(true);
      setShowReplaceRow(false);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
      e.preventDefault();
      setShowFindBar(true);
      setShowReplaceRow(true);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "/") {
      e.preventDefault();
      handleToggleLineComment();
      return;
    }

    // Tab indentation
    if (e.key === "Tab") {
      e.preventDefault();
      const next = val.slice(0, start) + "    " + val.slice(end);
      onUpdateFileContent(activeFile.id, next);
      requestAnimationFrame(() => {
        el.setSelectionRange(start + 4, start + 4);
        updateCursorFromTextarea(el);
      });
      return;
    }

    // Enter smart auto-indent
    if (e.key === "Enter") {
      e.preventDefault();
      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
      const curLine = val.slice(lineStart, start);
      const baseIndent = /^\s*/.exec(curLine)?.[0] || "";
      const extraIndent = /[\{\>]$/.test(curLine.trim()) && curLine.trim().indexOf("/>") < 0 ? "    " : "";
      const insert = "\n" + baseIndent + extraIndent;
      const next = val.slice(0, start) + insert + val.slice(end);
      onUpdateFileContent(activeFile.id, next);
      const caret = start + insert.length;
      requestAnimationFrame(() => {
        el.setSelectionRange(caret, caret);
        updateCursorFromTextarea(el);
      });
      return;
    }

    // Auto-closing brackets & quotes
    const pairs: Record<string, string> = {
      "(": ")",
      "[": "]",
      "{": "}",
      '"': '"',
      "'": "'",
    };
    const closers = [")", "]", "}", '"', "'"];
    if (closers.indexOf(e.key) >= 0 && val.charAt(start) === e.key && start === end) {
      e.preventDefault();
      requestAnimationFrame(() => {
        el.setSelectionRange(start + 1, start + 1);
      });
      return;
    }
    if (pairs[e.key]) {
      e.preventDefault();
      const selected = val.slice(start, end);
      const next = val.slice(0, start) + e.key + selected + pairs[e.key] + val.slice(end);
      onUpdateFileContent(activeFile.id, next);
      requestAnimationFrame(() => {
        el.setSelectionRange(start + 1, start + 1 + selected.length);
      });
      return;
    }
  };

  const toggleBreakpoint = (lineNum: number) => {
    const key = `${activeFile.id}:${lineNum}`;
    setBreakpoints((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAddXmlWidget = (kind: PaletteWidgetKind) => {
    const res = insertComponentIntoLayoutXml(activeFile.content, kind, allXmlIds);
    onUpdateFileContent(activeFile.id, res.xml);
    setSelectedXmlId(res.insertedId);
  };

  const handleUpdateXmlAttr = (attrKey: string, value: string) => {
    if (!selectedElement) return;
    const nextXml = updateElementAttributeInXml(
      activeFile.content,
      selectedElement.id || selectedElement.uid,
      attrKey,
      value
    );
    onUpdateFileContent(activeFile.id, nextXml);
    if (attrKey === "android:id" && value.trim()) {
      setSelectedXmlId(value.replace(/^@\+?id\//, "").trim());
    }
  };

  const handleDeleteSelectedWidget = () => {
    if (!selectedElement || selectedElement === parsedXmlTree.root) return;
    const nextXml = removeComponentFromLayoutXml(
      activeFile.content,
      selectedElement.id || selectedElement.uid
    );
    onUpdateFileContent(activeFile.id, nextXml);
    setSelectedXmlId("");
  };

  const renderXmlTreeNode = (node: XmlLayoutElement, depth: number): React.ReactNode => {
    const isSel = selectedElement && selectedElement.uid === node.uid;
    return (
      <React.Fragment key={node.uid}>
        <button
          type="button"
          className={`${styles.treeRow} ${isSel ? styles.treeRowSelected : ""}`}
          style={{ paddingLeft: 8 + depth * 12, height: 22 }}
          onClick={() => setSelectedXmlId(node.id)}
        >
          <span>{node.shortTag}</span>
          <span className={styles.treeHintSuffix}>@{node.id}</span>
        </button>
        {node.children.map((ch) => renderXmlTreeNode(ch, depth + 1))}
      </React.Fragment>
    );
  };

  const renderXmlPreviewElement = (node: XmlLayoutElement): React.ReactNode => {
    const isSel = selectedElement && selectedElement.uid === node.uid;
    const textVal = resolveResourceValue(node.attrs["android:text"], parsedResources);
    const hintVal = resolveResourceValue(node.attrs["android:hint"], parsedResources);
    const textSizeRaw = parseFloat(node.attrs["android:textSize"] || "");
    const textColorRaw = node.attrs["android:textColor"]
      ? resolveResourceValue(node.attrs["android:textColor"], parsedResources)
      : undefined;
    const bgRaw = node.attrs["android:background"]
      ? resolveResourceValue(node.attrs["android:background"], parsedResources)
      : undefined;

    const selBorder = isSel ? "2px solid #3574F0" : undefined;

    if (
      node.shortTag === "LinearLayout" ||
      node.shortTag === "RelativeLayout" ||
      node.shortTag === "ConstraintLayout" ||
      node.shortTag === "FrameLayout" ||
      node.shortTag === "ScrollView"
    ) {
      const isHorizontal = node.attrs["android:orientation"] === "horizontal";
      return (
        <div
          key={node.uid}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedXmlId(node.id);
          }}
          style={{
            display: "flex",
            flexDirection: isHorizontal ? "row" : "column",
            gap: 8,
            padding: 10,
            width: "100%",
            flex: node === parsedXmlTree.root ? 1 : undefined,
            background: bgRaw || (node === parsedXmlTree.root ? "transparent" : "rgba(53,116,240,0.04)"),
            border: selBorder || (node !== parsedXmlTree.root ? "1px dashed rgba(102,80,164,0.35)" : undefined),
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {node.children.map((ch) => renderXmlPreviewElement(ch))}
        </div>
      );
    }

    if (node.shortTag === "Button") {
      return (
        <button
          key={node.uid}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedXmlId(node.id);
          }}
          style={{
            padding: "7px 14px",
            borderRadius: 18,
            background: bgRaw || "#6650A4",
            color: textColorRaw || "#FFFFFF",
            fontWeight: 600,
            fontSize: isNaN(textSizeRaw) ? 12 : Math.max(10, Math.min(20, textSizeRaw * 0.78)),
            border: selBorder || "none",
            cursor: "pointer",
            alignSelf: node.attrs["android:layout_width"] === "match_parent" ? "stretch" : "flex-start",
          }}
        >
          {textVal || "Button"}
        </button>
      );
    }

    if (node.shortTag === "EditText") {
      return (
        <div
          key={node.uid}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedXmlId(node.id);
          }}
          style={{
            width: "100%",
            padding: "6px 8px",
            borderRadius: 6,
            border: selBorder || "1px solid #9E97A8",
            background: "#FFFFFF",
            color: textVal ? "#1C1B1F" : "#79747E",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {textVal || hintVal || "EditText"}
        </div>
      );
    }

    if (node.shortTag === "ImageView") {
      return (
        <div
          key={node.uid}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedXmlId(node.id);
          }}
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: bgRaw || "#E8DEF8",
            border: selBorder || "1px solid #C4B5FD",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#3574F0",
            fontSize: 18,
            cursor: "pointer",
          }}
          title={node.attrs["android:src"] || "ImageView"}
        >
          ▲
        </div>
      );
    }

    if (node.shortTag === "CheckBox" || node.shortTag === "Switch") {
      return (
        <div
          key={node.uid}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedXmlId(node.id);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 6px",
            border: selBorder,
            borderRadius: 4,
            fontSize: 12,
            color: textColorRaw || "#1C1B1F",
            cursor: "pointer",
          }}
        >
          <span>{node.shortTag === "CheckBox" ? "☐" : "⊶"}</span>
          <span>{textVal || node.shortTag}</span>
        </div>
      );
    }

    // TextView
    return (
      <div
        key={node.uid}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedXmlId(node.id);
        }}
        style={{
          padding: "3px 5px",
          borderRadius: 4,
          background: bgRaw || "transparent",
          color: textColorRaw || "#1C1B1F",
          fontSize: isNaN(textSizeRaw) ? 13 : Math.max(10, Math.min(24, textSizeRaw * 0.78)),
          fontWeight: textSizeRaw >= 18 ? 600 : 400,
          border: selBorder || "1px dashed rgba(102,80,164,0.22)",
          cursor: "pointer",
        }}
      >
        {textVal || "TextView"}
      </div>
    );
  };

  const renderBlueprintElement = (node: XmlLayoutElement): React.ReactNode => {
    const isSel = selectedElement && selectedElement.uid === node.uid;
    return (
      <div
        key={node.uid}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedXmlId(node.id);
        }}
        style={{
          padding: node.children.length > 0 ? "6px 8px" : "4px 8px",
          border: isSel ? "1.5px solid #FFFFFF" : "1px solid rgba(154,210,255,0.65)",
          borderRadius: 4,
          fontSize: 10.5,
          color: "#D6ECFF",
          display: "flex",
          flexDirection: "column",
          gap: 5,
          cursor: "pointer",
        }}
      >
        <span>@{node.id} [{node.shortTag}]</span>
        {node.children.map((ch) => renderBlueprintElement(ch))}
      </div>
    );
  };

  const caretTopPx = 8 + Math.min(cursorPos.line, 20) * 21;

  return (
    <section className={styles.editorSection} aria-label="Editor and Design Split View">
      {/* 40px Editor Tab Bar */}
      <div className={styles.editorTabBar}>
        <div className={styles.editorTabsScroll} role="tablist">
          {openTabs.map((tab) => {
            const isActive = tab.id === activeFile.id;
            const isDirty = dirtyFileIds.has(tab.id);
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                className={`${styles.editorTab} ${isActive ? styles.editorTabActive : ""}`}
                onClick={() => onSelectTab(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelectTab(tab.id);
                }}
              >
                {renderFileTabIcon(tab)}
                <span>{tab.tabTitle}</span>
                {isDirty && <span className={styles.tabDirtyDot} title="Modified" />}
                {openTabs.length > 1 && (
                  <button
                    type="button"
                    className={styles.tabCloseBtn}
                    title={`Close ${tab.tabTitle}`}
                    aria-label={`Close ${tab.tabTitle}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                  >
                    ×
                  </button>
                )}
                {isActive && <span className={styles.tabActiveIndicator} />}
              </div>
            );
          })}
        </div>

        <div className={styles.editorTabRightControls}>
          <button
            type="button"
            className={styles.previewToolBtn}
            title="Reformat Code (Ctrl+Alt+L)"
            onClick={handleFormatActiveFile}
          >
            Format
          </button>
          <div className={styles.segmentedGroup} role="group" aria-label="Editor Split Mode">
            <button
              type="button"
              className={`${styles.segmentedBtn} ${splitMode === "Code" ? styles.segmentedBtnActive : ""}`}
              title="Code"
              onClick={() => onChangeSplitMode("Code")}
            >
              <EditorOnlyIcon size={14} />
              <span>Code</span>
            </button>
            <button
              type="button"
              className={`${styles.segmentedBtn} ${splitMode === "Split" ? styles.segmentedBtnActive : ""}`}
              title="Split"
              onClick={() => onChangeSplitMode("Split")}
            >
              <EditorPreviewSplitIcon size={14} />
              <span>Split</span>
            </button>
            <button
              type="button"
              className={`${styles.segmentedBtn} ${splitMode === "Design" ? styles.segmentedBtnActive : ""}`}
              title="Design"
              onClick={() => onChangeSplitMode("Design")}
            >
              <PreviewOnlyDesignIcon size={14} />
              <span>Design</span>
            </button>
          </div>
        </div>
      </div>

      {/* Find & Replace Bar */}
      {showFindBar && splitMode !== "Design" && (
        <div className={styles.findReplaceBar} role="search" aria-label="Find and Replace">
          <input
            type="text"
            className={styles.findInput}
            placeholder="Find in file..."
            value={findQuery}
            autoFocus
            onChange={(e) => {
              setFindQuery(e.target.value);
              setCurrentMatchIdx(0);
            }}
          />
          <button
            type="button"
            className={styles.secondaryBtn}
            style={{ height: 24, padding: "0 8px" }}
            onClick={() => setFindCaseSensitive((v) => !v)}
            title="Match Case"
          >
            {findCaseSensitive ? "Cc ✓" : "Cc"}
          </button>
          <span style={{ color: "var(--as-text-muted)", fontSize: 11.5 }}>
            {findMatches.length === 0 ? "0 results" : `${(currentMatchIdx % findMatches.length) + 1}/${findMatches.length}`}
          </span>
          <button
            type="button"
            className={styles.secondaryBtn}
            style={{ height: 24, padding: "0 8px" }}
            disabled={findMatches.length === 0}
            onClick={() => {
              const prev = (currentMatchIdx - 1 + findMatches.length) % findMatches.length;
              setCurrentMatchIdx(prev);
              jumpToOffset(findMatches[prev], findQuery.length);
            }}
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            style={{ height: 24, padding: "0 8px" }}
            disabled={findMatches.length === 0}
            onClick={() => {
              const next = (currentMatchIdx + 1) % findMatches.length;
              setCurrentMatchIdx(next);
              jumpToOffset(findMatches[next], findQuery.length);
            }}
          >
            ↓
          </button>
          {showReplaceRow && (
            <>
              <input
                type="text"
                className={styles.findInput}
                placeholder="Replace with..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
              />
              <button
                type="button"
                className={styles.secondaryBtn}
                style={{ height: 24, padding: "0 8px" }}
                disabled={findMatches.length === 0}
                onClick={() => {
                  const idx = findMatches[currentMatchIdx % findMatches.length];
                  const next =
                    activeFile.content.slice(0, idx) +
                    replaceText +
                    activeFile.content.slice(idx + findQuery.length);
                  onUpdateFileContent(activeFile.id, next);
                }}
              >
                Replace
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                style={{ height: 24, padding: "0 8px" }}
                disabled={findMatches.length === 0}
                onClick={() => {
                  const flags = findCaseSensitive ? "g" : "gi";
                  const escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                  const next = activeFile.content.replace(new RegExp(escaped, flags), replaceText);
                  onUpdateFileContent(activeFile.id, next);
                }}
              >
                Replace All
              </button>
            </>
          )}
          <button
            type="button"
            className={styles.panelActionIcon}
            title="Close Find Bar"
            onClick={() => setShowFindBar(false)}
          >
            ×
          </button>
        </div>
      )}

      {/* Main Editor + Design Split Body */}
      <div className={styles.editorMainArea}>
        {splitMode !== "Design" && (
          <div className={styles.codePaneWrap}>
            <button
              type="button"
              className={styles.inspectionPill}
              title="File Inspections & Problems"
              onClick={onOpenProblemsPanel}
            >
              {errorCount > 0 ? (
                <>
                  <ErrorCircleIcon size={13} />
                  <span>{errorCount}</span>
                </>
              ) : warnCount > 0 ? (
                <>
                  <WarningTriangleIcon size={13} />
                  <span>{warnCount}</span>
                </>
              ) : (
                <CheckGreenIcon size={13} />
              )}
            </button>

            <div className={styles.editorGutter} ref={gutterRef}>
              {lines.map((lineText, idx) => {
                const lineNum = idx + 1;
                const bpKey = `${activeFile.id}:${lineNum}`;
                const hasBp = breakpoints.has(bpKey);
                const lineProblem = fileProblems.find((p) => p.line === lineNum);
                const isComposable = lineText.trim().startsWith("@Composable");
                const isPreview = lineText.trim().startsWith("@Preview");
                const isRunnable =
                  lineText.includes("class MainActivity") ||
                  lineText.includes("@Test") ||
                  lineText.includes("fun GreetingPreview");

                return (
                  <div key={lineNum} className={styles.gutterRow}>
                    <span
                      className={`${styles.gutterLineNum} ${cursorPos.line === lineNum ? styles.gutterLineNumActive : ""
                        }`}
                      onClick={() => toggleBreakpoint(lineNum)}
                    >
                      {lineNum}
                    </span>
                    <span className={styles.gutterIconSlot} title={lineProblem?.message}>
                      {lineProblem && lineProblem.severity === "error" ? (
                        <span className={styles.gutterErrorDot} />
                      ) : lineProblem && lineProblem.severity === "warning" ? (
                        <span className={styles.gutterWarnDot} />
                      ) : hasBp ? (
                        <button
                          type="button"
                          className={styles.gutterBtn}
                          title="Remove Breakpoint"
                          onClick={() => toggleBreakpoint(lineNum)}
                        >
                          <span className={styles.breakpointDot} />
                        </button>
                      ) : isRunnable || isPreview ? (
                        <button
                          type="button"
                          className={styles.gutterBtn}
                          title="Run Activity"
                          onClick={onRunFromGutter}
                        >
                          <RunPlayIcon size={12} />
                        </button>
                      ) : isComposable ? (
                        <ComposableGutterIcon size={13} />
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className={styles.editorCodeArea}>
              <div
                className={styles.currentLineHighlight}
                style={{ top: `${8 + (cursorPos.line - 1) * 21}px` }}
              />
              {fileProblems
                .filter((p) => p.severity === "error")
                .map((err) => (
                  <div
                    key={err.id}
                    className={styles.editorLineError}
                    style={{ top: `${8 + (Math.max(1, err.line) - 1) * 21}px` }}
                    title={err.message}
                  />
                ))}
              <pre ref={preRef} className={styles.editorHighlightPre} aria-hidden="true">
                {lines.map((ln, idx) => (
                  <React.Fragment key={idx}>
                    {highlightCodeLine(ln, activeFile.kind)}
                    {idx < lines.length - 1 ? "\n" : ""}
                  </React.Fragment>
                ))}
              </pre>
              <textarea
                ref={textareaRef}
                className={styles.editorTextarea}
                value={activeFile.content}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                aria-label={`Code editor for ${activeFile.tabTitle}`}
                onChange={(e) => {
                  const nextVal = e.target.value;
                  const pos = e.currentTarget.selectionStart || 0;
                  onUpdateFileContent(activeFile.id, nextVal);
                  updateCursorFromTextarea(e.currentTarget);

                  // Trigger contextual autocomplete on `.` or `:` or explicit request
                  const ch = nextVal.charAt(pos - 1);
                  if (ch === "." || ch === ":" || acState.open) {
                    const res = buildCompletions(nextVal, pos);
                    if (res.items.length > 0) {
                      setAcState({
                        open: true,
                        prefixStart: res.prefixStart,
                        items: res.items,
                        selectedIndex: 0,
                      });
                    } else {
                      setAcState((s) => ({ ...s, open: false }));
                    }
                  }
                }}
                onKeyDown={handleEditorKeyDown}
                onScroll={handleTextareaScroll}
                onClick={(e) => {
                  updateCursorFromTextarea(e.currentTarget);
                  if (acState.open) setAcState((s) => ({ ...s, open: false }));
                }}
                onKeyUp={(e) => updateCursorFromTextarea(e.currentTarget)}
              />

              {acState.open && acState.items.length > 0 && (
                <div
                  className={styles.autocompletePopup}
                  style={{ top: caretTopPx + 4, left: 28 }}
                  role="listbox"
                  aria-label="Code Autocomplete Suggestions"
                >
                  {acState.items.map((item, idx) => (
                    <button
                      key={item.label}
                      type="button"
                      role="option"
                      aria-selected={idx === acState.selectedIndex}
                      className={`${styles.autocompleteItem} ${idx === acState.selectedIndex ? styles.autocompleteItemActive : ""
                        }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyCompletion(item);
                      }}
                    >
                      <span>{item.label}</span>
                      <span style={{ fontSize: 10.5, opacity: 0.7 }}>{item.detail}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right/Full Layout Editor OR Compose Preview Surface */}
        {splitMode !== "Code" && (
          <div className={styles.designSurfaceRoot}>
            {isXmlLayoutFile ? (
              <>
                <div className={styles.designToolbar}>
                  <div className={styles.designToolbarGroup}>
                    {(["Design", "Blueprint", "Both"] as DesignSurfaceMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`${styles.previewToolBtn} ${designSurfaceMode === mode ? styles.previewToolBtnActive : ""
                          }`}
                        onClick={() => onChangeDesignSurfaceMode(mode)}
                      >
                        {mode === "Both" ? "Design + Blueprint" : mode}
                      </button>
                    ))}
                    <span className={styles.toolbarSeparator} />
                    <span style={{ fontSize: 11.5, color: "var(--as-text-secondary)" }}>
                      {parsedXmlTree.root?.shortTag || "Layout"} · API 35
                    </span>
                  </div>
                  <div className={styles.designToolbarGroup}>
                    {selectedElement && selectedElement !== parsedXmlTree.root && (
                      <button
                        type="button"
                        className={styles.previewToolBtn}
                        style={{ color: "var(--as-red)" }}
                        title="Remove Selected Component"
                        onClick={handleDeleteSelectedWidget}
                      >
                        Delete @{selectedElement.id}
                      </button>
                    )}
                  </div>
                </div>

                <div className={styles.xmlDesignerBody}>
                  {/* Palette + Recursive Component Tree */}
                  <div className={styles.xmlLeftDock}>
                    <div className={styles.xmlSectionBar}>
                      <span>Palette</span>
                    </div>
                    <div style={{ display: "flex", gap: 2, padding: "4px", borderBottom: "1px solid var(--as-border-panel)", flexWrap: "wrap" }}>
                      {(["Common", "Text", "Buttons", "Layouts"] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          className={`${styles.xmlPaletteItem} ${paletteCategory === cat ? styles.xmlPaletteItemActive : ""
                            }`}
                          style={{ width: "auto", padding: "2px 6px", fontSize: 10.5 }}
                          onClick={() => setPaletteCategory(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <div className={styles.xmlPaletteCols}>
                      {PALETTE_ITEMS.filter(
                        (p) => paletteCategory === "Common" || p.category === paletteCategory
                      ).map((item) => (
                        <button
                          key={item.kind}
                          type="button"
                          className={styles.xmlPaletteItem}
                          title={`Add <${item.kind}> to layout`}
                          onClick={() => handleAddXmlWidget(item.kind)}
                        >
                          {item.icon} {item.kind}
                        </button>
                      ))}
                    </div>

                    <div className={styles.xmlSectionBar}>
                      <span>Component Tree</span>
                    </div>
                    <div className={styles.treeScroll}>
                      {parsedXmlTree.root ? (
                        renderXmlTreeNode(parsedXmlTree.root, 0)
                      ) : (
                        <div style={{ padding: 8, fontSize: 11, color: "var(--as-red)" }}>
                          Fix XML syntax errors to inspect component tree.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Center Design / Blueprint Surface */}
                  <div className={styles.xmlCenterStage}>
                    {(designSurfaceMode === "Design" || designSurfaceMode === "Both") && (
                      <div className={styles.xmlSurfacePhone}>
                        <div
                          style={{
                            height: 26,
                            background: "#3574F0",
                            color: "#FFFFFF",
                            fontSize: 11,
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0 10px",
                          }}
                        >
                          <span>{parsedResources.strings.app_name || "Android App"}</span>
                          <span style={{ fontSize: 9.5, opacity: 0.85 }}>{activeFile.name}</span>
                        </div>
                        <div style={{ flex: 1, padding: 8, display: "flex", flexDirection: "column", overflow: "auto" }}>
                          {parsedXmlTree.root ? (
                            renderXmlPreviewElement(parsedXmlTree.root)
                          ) : (
                            <div style={{ color: "#B3261E", padding: 12, fontSize: 11.5 }}>
                              Invalid XML: {parsedXmlTree.errors[0]?.message || "Parse failed"}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(designSurfaceMode === "Blueprint" || designSurfaceMode === "Both") && (
                      <div className={`${styles.xmlSurfacePhone} ${styles.xmlSurfaceBlueprint}`}>
                        <div
                          style={{
                            height: 26,
                            borderBottom: "1px solid rgba(130,195,255,0.35)",
                            fontSize: 10.5,
                            display: "flex",
                            alignItems: "center",
                            padding: "0 10px",
                          }}
                        >
                          <span>{parsedXmlTree.root?.shortTag || "Layout"} Blueprint</span>
                        </div>
                        <div style={{ flex: 1, padding: 8, display: "flex", flexDirection: "column", overflow: "auto" }}>
                          {parsedXmlTree.root ? renderBlueprintElement(parsedXmlTree.root) : null}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Interactive Attributes Inspector */}
                  <div className={styles.xmlRightAttrs}>
                    <div className={styles.xmlSectionBar}>
                      <span>Attributes</span>
                      <span style={{ color: "var(--as-text-muted)", fontWeight: 400 }}>
                        @{selectedElement?.id || "none"}
                      </span>
                    </div>
                    {selectedElement ? (
                      <>
                        <div className={styles.attrGroup}>
                          <div className={styles.attrGroupTitle}>Identity &amp; Text</div>
                          <div className={styles.attrRow}>
                            <span className={styles.attrKey}>id</span>
                            <input
                              className={styles.attrInput}
                              aria-label="Attribute android:id"
                              value={selectedElement.attrs["android:id"] || ""}
                              onChange={(e) => handleUpdateXmlAttr("android:id", e.target.value)}
                            />
                          </div>
                          {selectedElement.shortTag !== "ImageView" && (
                            <div className={styles.attrRow}>
                              <span className={styles.attrKey}>text</span>
                              <input
                                className={styles.attrInput}
                                aria-label="Attribute android:text"
                                value={selectedElement.attrs["android:text"] || ""}
                                onChange={(e) => handleUpdateXmlAttr("android:text", e.target.value)}
                              />
                            </div>
                          )}
                          {selectedElement.shortTag === "EditText" && (
                            <div className={styles.attrRow}>
                              <span className={styles.attrKey}>hint</span>
                              <input
                                className={styles.attrInput}
                                aria-label="Attribute android:hint"
                                value={selectedElement.attrs["android:hint"] || ""}
                                onChange={(e) => handleUpdateXmlAttr("android:hint", e.target.value)}
                              />
                            </div>
                          )}
                          {selectedElement.shortTag === "ImageView" && (
                            <div className={styles.attrRow}>
                              <span className={styles.attrKey}>src</span>
                              <input
                                className={styles.attrInput}
                                aria-label="Attribute android:src"
                                value={selectedElement.attrs["android:src"] || ""}
                                onChange={(e) => handleUpdateXmlAttr("android:src", e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                        <div className={styles.attrGroup}>
                          <div className={styles.attrGroupTitle}>Layout &amp; Appearance</div>
                          <div className={styles.attrRow}>
                            <span className={styles.attrKey}>width</span>
                            <input
                              className={styles.attrInput}
                              aria-label="Attribute android:layout_width"
                              value={selectedElement.attrs["android:layout_width"] || "wrap_content"}
                              onChange={(e) => handleUpdateXmlAttr("android:layout_width", e.target.value)}
                            />
                          </div>
                          <div className={styles.attrRow}>
                            <span className={styles.attrKey}>height</span>
                            <input
                              className={styles.attrInput}
                              aria-label="Attribute android:layout_height"
                              value={selectedElement.attrs["android:layout_height"] || "wrap_content"}
                              onChange={(e) => handleUpdateXmlAttr("android:layout_height", e.target.value)}
                            />
                          </div>
                          {selectedElement.shortTag === "LinearLayout" && (
                            <div className={styles.attrRow}>
                              <span className={styles.attrKey}>orient</span>
                              <select
                                className={styles.attrInput}
                                aria-label="Attribute android:orientation"
                                value={selectedElement.attrs["android:orientation"] || "vertical"}
                                onChange={(e) => handleUpdateXmlAttr("android:orientation", e.target.value)}
                              >
                                <option value="vertical">vertical</option>
                                <option value="horizontal">horizontal</option>
                              </select>
                            </div>
                          )}
                          <div className={styles.attrRow}>
                            <span className={styles.attrKey}>textSize</span>
                            <input
                              className={styles.attrInput}
                              aria-label="Attribute android:textSize"
                              placeholder="16sp"
                              value={selectedElement.attrs["android:textSize"] || ""}
                              onChange={(e) => handleUpdateXmlAttr("android:textSize", e.target.value)}
                            />
                          </div>
                          <div className={styles.attrRow}>
                            <span className={styles.attrKey}>color</span>
                            <input
                              className={styles.attrInput}
                              aria-label="Attribute android:textColor"
                              placeholder="#1C1B1F"
                              value={selectedElement.attrs["android:textColor"] || ""}
                              onChange={(e) => handleUpdateXmlAttr("android:textColor", e.target.value)}
                            />
                          </div>
                          <div className={styles.attrRow}>
                            <span className={styles.attrKey}>padding</span>
                            <input
                              className={styles.attrInput}
                              aria-label="Attribute android:padding"
                              placeholder="12dp"
                              value={selectedElement.attrs["android:padding"] || ""}
                              onChange={(e) => handleUpdateXmlAttr("android:padding", e.target.value)}
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: 10, fontSize: 11.5, color: "var(--as-text-muted)" }}>
                        Select a component in the layout preview to edit its XML attributes.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={styles.designToolbar}>
                  <div className={styles.designToolbarGroup}>
                    <span className={styles.previewStatusBadge}>
                      <CheckGreenIcon size={12} />
                      <span>Preview Ready</span>
                    </span>
                    <button
                      type="button"
                      className={styles.previewToolBtn}
                      title="Refresh Preview"
                      onClick={onIncrementComposeCounter}
                    >
                      <RestartIcon size={13} />
                      <span>Refresh</span>
                    </button>
                  </div>
                  <div className={styles.designToolbarGroup}>
                    <button
                      type="button"
                      className={`${styles.previewToolBtn} ${interactivePreview ? styles.previewToolBtnActive : ""
                        }`}
                      onClick={() => setInteractivePreview((v) => !v)}
                    >
                      <span>{interactivePreview ? "Interactive Mode: ON" : "Interactive Mode"}</span>
                    </button>
                    <button
                      type="button"
                      className={styles.previewToolBtn}
                      title="Run in Device Emulator"
                      onClick={onDeployPreviewToDevice}
                    >
                      <RunPreviewOnDeviceIcon size={14} />
                      <span>Run on Emulator</span>
                    </button>
                  </div>
                </div>

                {composePreview ? (
                <div className={styles.composeCanvasArea}>
                  <div className={styles.previewCardFrame} style={{ width: 292 }}>
                    <div className={styles.previewCardTitle}>
                      <span>{composePreview.fn ? `${composePreview.fn} (@Preview)` : "Preview"}</span>
                      <span style={{ color: "#3DDC84" }}>LabMate preview</span>
                    </div>
                    {composePreview.screen ? (
                      <div style={{ height: 340, background: "#FFFBFE", borderRadius: 12, overflow: "hidden", border: "1px solid #D0BCFF", display: "flex", flexDirection: "column" }}>
                        <EmulatorScreen
                          screen={composePreview.screen}
                          onClick={(uid) => interactivePreview && onPreviewClick && onPreviewClick(uid)}
                          onInput={(uid, text) => interactivePreview && onPreviewInput && onPreviewInput(uid, text)}
                          onToggle={(uid, checked) => interactivePreview && onPreviewToggle && onPreviewToggle(uid, checked)}
                          onDialogButton={(id) => onPreviewDialogButton && onPreviewDialogButton(id)}
                          onDismissCrash={() => onIncrementComposeCounter()}
                        />
                      </div>
                    ) : (
                      <div style={{ padding: 16, fontSize: 12, lineHeight: 1.5, color: "#625B71", background: "#FEF7FF", borderRadius: 12, border: "1px solid #D0BCFF" }}>
                        {composePreview.message
                          ? composePreview.message
                          : "No @Preview function found. Add @Preview @Composable fun MyPreview() { ... } to see it here."}
                      </div>
                    )}
                  </div>
                </div>
                ) : (
                <div className={styles.composeCanvasArea}>
                  <div className={styles.previewCardFrame} style={{ width: 292 }}>
                    <div className={styles.previewCardTitle}>
                      <span>{activeFile.tabTitle} Preview</span>
                      <span style={{ color: "var(--as-android-green)" }}>API 35</span>
                    </div>

                    <div
                      style={{
                        borderRadius: 12,
                        background: "#FEF7FF",
                        color: "#1D1B20",
                        padding: 18,
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        border: "1px solid #D0BCFF",
                      }}
                    >
                      {(previewTree.children || []).map((node) =>
                        node.type === "Button" ? (
                          <button
                            key={node.id}
                            type="button"
                            onClick={onIncrementComposeCounter}
                            style={{
                              padding: "9px 16px",
                              borderRadius: 999,
                              border: "none",
                              background: "#6650A4",
                              color: "#FFFFFF",
                              fontWeight: 600,
                              fontSize: 12.5,
                              cursor: "pointer",
                              alignSelf: "flex-start",
                            }}
                          >
                            {node.text}
                          </button>
                        ) : (
                          <div key={node.id} style={{ fontSize: 15, fontWeight: 600, color: "#1D1B20" }}>
                            {node.text}
                          </div>
                        )
                      )}
                      {activeFile.hasComposePreview && (
                        <div style={{ fontSize: 11, color: "#625B71" }}>
                          State recompositions: {composeClickCount + 1}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
