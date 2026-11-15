export type DiagnosticSeverity = "error" | "warning" | "info";

export interface JavaDiagnostic {
  line: number;
  column: number;
  severity: DiagnosticSeverity;
  message: string;
  code: string;
}

export interface JavaSymbol {
  kind: "class" | "method" | "field";
  name: string;
  signature: string;
  line: number;
  isMain?: boolean;
}

export interface JavaRunResult {
  success: boolean;
  exitCode: number;
  className: string;
  commandLine: string;
  stdout: string;
  stderr: string;
  outputLines: string[];
  diagnostics: JavaDiagnostic[];
  durationMs: number;
}

export type JavaTokenType =
  | "keyword"
  | "string"
  | "char"
  | "number"
  | "comment"
  | "annotation"
  | "staticField"
  | "methodDecl"
  | "type"
  | "identifier"
  | "operator"
  | "punctuation"
  | "whitespace";

export interface JavaToken {
  type: JavaTokenType;
  text: string;
}

export interface VirtualFileNode {
  id: string;
  name: string;
  displayName?: string;
  path: string;
  kind: "project" | "folder" | "sourceRoot" | "excludedFolder" | "package" | "java" | "file" | "gitignore" | "iml" | "libraries" | "scratches";
  content?: string;
  children?: VirtualFileNode[];
  expandedByDefault?: boolean;
  isMainClass?: boolean;
}

export interface RunConfiguration {
  id: string;
  name: string;
  mainClass: string;
  fileId: string;
  args?: string;
}

export interface IntellijProjectPreset {
  id: "HelloWorld" | "intellij-samples";
  name: string;
  badgeText: string;
  badgeGradient: string;
  rootPath: string;
  moduleName: string;
  hasGit: boolean;
  gitBranch: string;
  defaultFileId: string;
  defaultCursor: { line: number; col: number };
  defaultRunConfigId: string;
  runConfigs: RunConfiguration[];
  tree: VirtualFileNode[];
}

export const HELLO_WORLD_JAVA = [
  "package com.example.java;",
  "",
  "public class HelloWorld {",
  "    public static void main(String[] args) {",
  "        System.out.println(\"Hello World!\");",
  "    }",
  "}",
  "",
].join("\n");

export const ASYNC_SCHEDULER_JAVA = [
  "package com.jetbrains.debugging;",
  "",
  "import org.jetbrains.annotations.Async;",
  "",
  "import java.util.concurrent.BlockingQueue;",
  "import java.util.concurrent.LinkedBlockingQueue;",
  "",
  "public class AsyncSchedulerExample {",
  "    // Inspect async stack traces across producer/consumer threads",
  "",
  "    public static void main(String[] args) throws InterruptedException {",
  "        final var messageQueue = new MessageQueue();",
  "        new Thread(() -> {",
  "            try {",
  "                while (true) {",
  "                    messageQueue.processNext();",
  "                }",
  "            } catch (InterruptedException e) {",
  "                e.printStackTrace();",
  "            }",
  "        }).start();",
  "        messageQueue.schedule(\"message 1\");",
  "        messageQueue.schedule(\"message 2\");",
  "        messageQueue.schedule(\"message 3\");",
  "    }",
  "",
  "    private static final class MessageQueue {",
  "        private final BlockingQueue<String> queue = new LinkedBlockingQueue<>();",
  "",
  "        private void schedule(@Async.Schedule String message) throws InterruptedException {",
  "            queue.put(message);",
  "        }",
  "",
  "        private void process(@Async.Execute String message) {",
  "            // Put a breakpoint here",
  "            System.out.println(\"Processing \" + message);",
  "        }",
  "",
  "        private void processNext() throws InterruptedException {",
  "            process(queue.take());",
  "        }",
  "    }",
  "}",
  "",
].join("\n");

export const USER_TEST_DATA_JAVA = [
  "package com.jetbrains.debugging;",
  "",
  "public class UserTestData {",
  "    public static void main(String[] args) {",
  "        String[] users = {\"Alice\", \"Bob\", \"Charlie\"};",
  "        for (int i = 0; i < users.length; i++) {",
  "            System.out.println(\"Loaded test user #\" + (i + 1) + \": \" + users[i]);",
  "        }",
  "        System.out.println(\"Total fixtures ready: \" + users.length);",
  "    }",
  "}",
  "",
].join("\n");

export const LAMBDA_EVALUATION_JAVA = [
  "package com.jetbrains.debugging;",
  "",
  "public class LambdaEvaluation {",
  "    public static void main(String[] args) {",
  "        int[] numbers = {2, 4, 6, 8, 10};",
  "        int sum = 0;",
  "        for (int n : numbers) {",
  "            sum += n * n;",
  "        }",
  "        System.out.println(\"Sum of squares = \" + sum);",
  "    }",
  "}",
  "",
].join("\n");

export const INTELLIJ_PRESETS: IntellijProjectPreset[] = [
  {
    id: "HelloWorld",
    name: "HelloWorld",
    badgeText: "HW",
    badgeGradient: "linear-gradient(135deg, #9B51E0 0%, #F76E7C 100%)",
    rootPath: "~/IdeaProjects/HelloWorld",
    moduleName: "HelloWorld",
    hasGit: false,
    gitBranch: "main",
    defaultFileId: "hw-java",
    defaultCursor: { line: 5, col: 42 },
    defaultRunConfigId: "rc-helloworld",
    runConfigs: [
      {
        id: "rc-helloworld",
        name: "HelloWorld",
        mainClass: "com.example.java.HelloWorld",
        fileId: "hw-java",
      },
    ],
    tree: [
      {
        id: "hw-root",
        name: "HelloWorld",
        path: "",
        kind: "project",
        expandedByDefault: true,
        children: [
          {
            id: "hw-idea",
            name: ".idea",
            path: ".idea",
            kind: "folder",
            expandedByDefault: false,
            children: [
              {
                id: "hw-idea-misc",
                name: "misc.xml",
                path: ".idea/misc.xml",
                kind: "file",
                content:
                  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<project version=\"4\">\n  <component name=\"ProjectRootManager\" version=\"2\" languageLevel=\"JDK_21\" project-jdk-name=\"openjdk-21\" />\n</project>\n",
              },
            ],
          },
          {
            id: "hw-out",
            name: "out",
            path: "out",
            kind: "excludedFolder",
            expandedByDefault: false,
            children: [
              {
                id: "hw-out-class",
                name: "HelloWorld.class",
                path: "out/production/HelloWorld/com/example/java/HelloWorld.class",
                kind: "file",
                content: "// Compiled bytecode for com.example.java.HelloWorld (JDK 21)\n",
              },
            ],
          },
          {
            id: "hw-src",
            name: "src",
            path: "src",
            kind: "sourceRoot",
            expandedByDefault: true,
            children: [
              {
                id: "hw-pkg",
                name: "com.example.java",
                path: "src/com/example/java",
                kind: "package",
                expandedByDefault: true,
                children: [
                  {
                    id: "hw-java",
                    name: "HelloWorld.java",
                    displayName: "HelloWorld",
                    path: "src/com/example/java/HelloWorld.java",
                    kind: "java",
                    isMainClass: true,
                    content: HELLO_WORLD_JAVA,
                  },
                ],
              },
            ],
          },
          {
            id: "hw-gitignore",
            name: ".gitignore",
            path: ".gitignore",
            kind: "gitignore",
            content: "# Default ignored files\n/shelf/\n/workspace.xml\nout/\n*.iml\n",
          },
          {
            id: "hw-iml",
            name: "HelloWorld.iml",
            path: "HelloWorld.iml",
            kind: "iml",
            content:
              "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<module type=\"JAVA_MODULE\" version=\"4\">\n  <component name=\"NewModuleRootManager\" inherit-compiler-output=\"true\">\n    <exclude-output />\n    <content url=\"file://$MODULE_DIR$\">\n      <sourceFolder url=\"file://$MODULE_DIR$/src\" isTestSource=\"false\" />\n    </content>\n    <orderEntry type=\"inheritedJdk\" />\n    <orderEntry type=\"sourceFolder\" forTests=\"false\" />\n  </component>\n</module>\n",
          },
          {
            id: "hw-libs",
            name: "External Libraries",
            path: "External Libraries",
            kind: "libraries",
            expandedByDefault: false,
            children: [
              {
                id: "hw-jdk21",
                name: "openjdk-21 (java version \"21.0.4\")",
                path: "External Libraries/openjdk-21",
                kind: "folder",
                children: [],
              },
            ],
          },
          {
            id: "hw-scratches",
            name: "Scratches and Consoles",
            path: "Scratches and Consoles",
            kind: "scratches",
            expandedByDefault: false,
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: "intellij-samples",
    name: "intellij-samples",
    badgeText: "IS",
    badgeGradient: "linear-gradient(135deg, #3574F0 0%, #6B57FF 100%)",
    rootPath: "~/IdeaProjects/intellij-samples",
    moduleName: "java-samples",
    hasGit: true,
    gitBranch: "main",
    defaultFileId: "sample-async",
    defaultCursor: { line: 8, col: 14 },
    defaultRunConfigId: "rc-usertestdata",
    runConfigs: [
      {
        id: "rc-usertestdata",
        name: "UserTestData",
        mainClass: "com.jetbrains.debugging.UserTestData",
        fileId: "sample-usertestdata",
      },
      {
        id: "rc-async",
        name: "AsyncSchedulerExample",
        mainClass: "com.jetbrains.debugging.AsyncSchedulerExample",
        fileId: "sample-async",
      },
      {
        id: "rc-lambda",
        name: "LambdaEvaluation",
        mainClass: "com.jetbrains.debugging.LambdaEvaluation",
        fileId: "sample-lambda",
      },
    ],
    tree: [
      {
        id: "samples-root",
        name: "java",
        path: "java-samples/src/main/java",
        kind: "sourceRoot",
        expandedByDefault: true,
        children: [
          {
            id: "samples-jetbrains",
            name: "com.jetbrains",
            path: "java-samples/src/main/java/com/jetbrains",
            kind: "package",
            expandedByDefault: true,
            children: [
              {
                id: "samples-analysis",
                name: "analysis",
                path: "java-samples/src/main/java/com/jetbrains/analysis",
                kind: "package",
                expandedByDefault: false,
                children: [],
              },
              {
                id: "samples-code",
                name: "code",
                path: "java-samples/src/main/java/com/jetbrains/code",
                kind: "package",
                expandedByDefault: false,
                children: [],
              },
              {
                id: "samples-completion",
                name: "completion",
                path: "java-samples/src/main/java/com/jetbrains/completion",
                kind: "package",
                expandedByDefault: false,
                children: [],
              },
              {
                id: "samples-debugging",
                name: "debugging",
                path: "java-samples/src/main/java/com/jetbrains/debugging",
                kind: "package",
                expandedByDefault: true,
                children: [
                  {
                    id: "sample-async",
                    name: "AsyncSchedulerExample.java",
                    displayName: "AsyncSchedulerExample",
                    path: "java-samples/src/main/java/com/jetbrains/debugging/AsyncSchedulerExample.java",
                    kind: "java",
                    isMainClass: true,
                    content: ASYNC_SCHEDULER_JAVA,
                  },
                  {
                    id: "sample-usertestdata",
                    name: "UserTestData.java",
                    displayName: "UserTestData",
                    path: "java-samples/src/main/java/com/jetbrains/debugging/UserTestData.java",
                    kind: "java",
                    isMainClass: true,
                    content: USER_TEST_DATA_JAVA,
                  },
                  {
                    id: "sample-lambda",
                    name: "LambdaEvaluation.java",
                    displayName: "LambdaEvaluation",
                    path: "java-samples/src/main/java/com/jetbrains/debugging/LambdaEvaluation.java",
                    kind: "java",
                    isMainClass: true,
                    content: LAMBDA_EVALUATION_JAVA,
                  },
                ],
              },
              {
                id: "samples-editing",
                name: "editing",
                path: "java-samples/src/main/java/com/jetbrains/editing",
                kind: "package",
                expandedByDefault: false,
                children: [],
              },
              {
                id: "samples-entity",
                name: "entity",
                path: "java-samples/src/main/java/com/jetbrains/entity",
                kind: "package",
                expandedByDefault: false,
                children: [],
              },
              {
                id: "samples-flow",
                name: "flow",
                path: "java-samples/src/main/java/com/jetbrains/flow",
                kind: "package",
                expandedByDefault: false,
                children: [],
              },
              {
                id: "samples-formatting",
                name: "formatting",
                path: "java-samples/src/main/java/com/jetbrains/formatting",
                kind: "package",
                expandedByDefault: false,
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
];

const JAVA_KEYWORDS: Record<string, boolean> = {
  abstract: true,
  assert: true,
  boolean: true,
  break: true,
  byte: true,
  case: true,
  catch: true,
  char: true,
  class: true,
  const: true,
  continue: true,
  default: true,
  do: true,
  double: true,
  else: true,
  enum: true,
  extends: true,
  final: true,
  finally: true,
  float: true,
  for: true,
  goto: true,
  if: true,
  implements: true,
  import: true,
  instanceof: true,
  int: true,
  interface: true,
  long: true,
  native: true,
  new: true,
  package: true,
  private: true,
  protected: true,
  public: true,
  return: true,
  short: true,
  static: true,
  strictfp: true,
  super: true,
  switch: true,
  synchronized: true,
  this: true,
  throw: true,
  throws: true,
  transient: true,
  try: true,
  var: true,
  void: true,
  volatile: true,
  while: true,
  true: true,
  false: true,
  null: true,
};

const STATIC_FIELDS: Record<string, boolean> = {
  out: true,
  err: true,
  in: true,
  PI: true,
  E: true,
  MAX_VALUE: true,
  MIN_VALUE: true,
};

/**
 * Tokenize a single Java source line for IntelliJ New UI Dark (Islands Dark) syntax highlighting.
 */
export function tokenizeJavaLine(line: string, inBlockComment: boolean): { tokens: JavaToken[]; inBlockComment: boolean } {
  const tokens: JavaToken[] = [];
  let i = 0;
  let blockComment = inBlockComment;
  let prevNonSpaceWord = "";
  let prevNonSpaceChar = "";

  while (i < line.length) {
    if (blockComment) {
      const closeIdx = line.indexOf("*/", i);
      if (closeIdx === -1) {
        tokens.push({ type: "comment", text: line.slice(i) });
        i = line.length;
      } else {
        tokens.push({ type: "comment", text: line.slice(i, closeIdx + 2) });
        i = closeIdx + 2;
        blockComment = false;
      }
      continue;
    }

    const ch = line[i];

    // Whitespace
    if (ch === " " || ch === "\t") {
      let j = i + 1;
      while (j < line.length && (line[j] === " " || line[j] === "\t")) j++;
      tokens.push({ type: "whitespace", text: line.slice(i, j) });
      i = j;
      continue;
    }

    // Line comment
    if (ch === "/" && line[i + 1] === "/") {
      tokens.push({ type: "comment", text: line.slice(i) });
      break;
    }

    // Block comment start
    if (ch === "/" && line[i + 1] === "*") {
      const closeIdx = line.indexOf("*/", i + 2);
      if (closeIdx === -1) {
        tokens.push({ type: "comment", text: line.slice(i) });
        blockComment = true;
        break;
      } else {
        tokens.push({ type: "comment", text: line.slice(i, closeIdx + 2) });
        i = closeIdx + 2;
        continue;
      }
    }

    // String literal
    if (ch === "\"") {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === "\\") {
          j += 2;
          continue;
        }
        if (line[j] === "\"") {
          j++;
          break;
        }
        j++;
      }
      tokens.push({ type: "string", text: line.slice(i, j) });
      prevNonSpaceWord = "";
      prevNonSpaceChar = "\"";
      i = j;
      continue;
    }

    // Char literal
    if (ch === "'") {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === "\\") {
          j += 2;
          continue;
        }
        if (line[j] === "'") {
          j++;
          break;
        }
        j++;
      }
      tokens.push({ type: "char", text: line.slice(i, j) });
      prevNonSpaceWord = "";
      prevNonSpaceChar = "'";
      i = j;
      continue;
    }

    // Annotation (supports @Async.Schedule)
    if (ch === "@") {
      let j = i + 1;
      while (j < line.length && /[A-Za-z0-9_$.]/.test(line[j])) {
        j++;
      }
      tokens.push({ type: "annotation", text: line.slice(i, j) });
      prevNonSpaceWord = line.slice(i, j);
      prevNonSpaceChar = "@";
      i = j;
      continue;
    }

    // Number literal
    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /[0-9._xXa-fA-FlLdDfF]/.test(line[j])) {
        j++;
      }
      tokens.push({ type: "number", text: line.slice(i, j) });
      prevNonSpaceWord = "";
      prevNonSpaceChar = "0";
      i = j;
      continue;
    }

    // Identifier or Keyword
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /[A-Za-z0-9_$]/.test(line[j])) {
        j++;
      }
      const word = line.slice(i, j);
      let k = j;
      while (k < line.length && (line[k] === " " || line[k] === "\t")) k++;
      const nextNonSpace = k < line.length ? line[k] : "";

      let tokenType: JavaTokenType = "identifier";
      if (JAVA_KEYWORDS[word]) {
        tokenType = "keyword";
      } else if (prevNonSpaceChar === "." && STATIC_FIELDS[word] && nextNonSpace !== "(") {
        tokenType = "staticField";
      } else if (
        nextNonSpace === "(" &&
        prevNonSpaceWord &&
        !JAVA_KEYWORDS[prevNonSpaceWord] &&
        prevNonSpaceChar !== "." &&
        prevNonSpaceWord !== "new"
      ) {
        // Likely a method declaration: returnType methodName(
        tokenType = "methodDecl";
      } else if (nextNonSpace === "(" && prevNonSpaceWord === "void") {
        tokenType = "methodDecl";
      }

      tokens.push({ type: tokenType, text: word });
      prevNonSpaceWord = word;
      prevNonSpaceChar = word[word.length - 1];
      i = j;
      continue;
    }

    // Operators / Punctuation
    if ("{}()[];,.".indexOf(ch) !== -1) {
      tokens.push({ type: "punctuation", text: ch });
      prevNonSpaceWord = "";
      prevNonSpaceChar = ch;
      i++;
      continue;
    }

    tokens.push({ type: "operator", text: ch });
    prevNonSpaceWord = "";
    prevNonSpaceChar = ch;
    i++;
  }

  return { tokens, inBlockComment: blockComment };
}

/**
 * Extract class, method, and main symbols for gutter run triangles, Structure pane, and breadcrumbs.
 */
export function extractJavaSymbols(code: string): JavaSymbol[] {
  const lines = code.split(/\r?\n/);
  const symbols: JavaSymbol[] = [];
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    let trimmed = raw.trim();
    if (!trimmed) continue;

    if (inBlockComment) {
      if (trimmed.indexOf("*/") !== -1) {
        inBlockComment = false;
      }
      continue;
    }
    if (trimmed.indexOf("/*") === 0) {
      if (trimmed.indexOf("*/") === -1) inBlockComment = true;
      continue;
    }
    if (trimmed.indexOf("//") === 0) continue;

    // Strip trailing comment for inspection
    const lineCommentIdx = trimmed.indexOf("//");
    if (lineCommentIdx !== -1) {
      trimmed = trimmed.slice(0, lineCommentIdx).trim();
    }

    const classMatch = /^(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)/.exec(
      trimmed,
    );
    if (classMatch) {
      symbols.push({
        kind: "class",
        name: classMatch[1],
        signature: "class " + classMatch[1],
        line: i + 1,
      });
      continue;
    }

    const mainMatch = /\bpublic\s+static\s+void\s+main\s*\(/.exec(trimmed);
    if (mainMatch) {
      symbols.push({
        kind: "method",
        name: "main",
        signature: "main(String[])",
        line: i + 1,
        isMain: true,
      });
      continue;
    }

    const methodMatch =
      /^(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?([A-Za-z_$][A-Za-z0-9_$<>\[\]]*)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(([^)]*)\)\s*(?:throws\s+[A-Za-z0-9_$,\s]+)?\{?$/.exec(
        trimmed,
      );
    if (methodMatch && !JAVA_KEYWORDS[methodMatch[2]] && methodMatch[1] !== "new" && methodMatch[1] !== "return") {
      symbols.push({
        kind: "method",
        name: methodMatch[2],
        signature: methodMatch[2] + "(" + methodMatch[3].trim() + "): " + methodMatch[1],
        line: i + 1,
      });
    }
  }

  return symbols;
}

/**
 * Analyze Java source code for basic syntax errors and inspections.
 * Clean programs like HelloWorld.java produce zero diagnostics.
 */
export function analyzeJavaDiagnostics(code: string): JavaDiagnostic[] {
  const diagnostics: JavaDiagnostic[] = [];
  const lines = code.split(/\r?\n/);

  const braceStack: Array<{ ch: string; line: number; col: number }> = [];
  let inBlockComment = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNum = idx + 1;
    const raw = lines[idx];
    let i = 0;
    let codeOnly = "";
    let unclosedStringCol = -1;

    while (i < raw.length) {
      if (inBlockComment) {
        const end = raw.indexOf("*/", i);
        if (end === -1) {
          i = raw.length;
        } else {
          i = end + 2;
          inBlockComment = false;
        }
        continue;
      }

      const ch = raw[i];
      if (ch === "/" && raw[i + 1] === "/") {
        break;
      }
      if (ch === "/" && raw[i + 1] === "*") {
        const end = raw.indexOf("*/", i + 2);
        if (end === -1) {
          inBlockComment = true;
          break;
        }
        i = end + 2;
        continue;
      }

      if (ch === "\"") {
        const startCol = i + 1;
        let j = i + 1;
        let closed = false;
        while (j < raw.length) {
          if (raw[j] === "\\") {
            j += 2;
            continue;
          }
          if (raw[j] === "\"") {
            closed = true;
            j++;
            break;
          }
          j++;
        }
        if (!closed) {
          unclosedStringCol = startCol;
          diagnostics.push({
            line: lineNum,
            column: startCol,
            severity: "error",
            message: "Unclosed string literal",
            code: "javac.unclosed.str",
          });
        }
        codeOnly += "\"\"";
        i = j;
        continue;
      }

      if (ch === "'") {
        let j = i + 1;
        let closed = false;
        while (j < raw.length) {
          if (raw[j] === "\\") {
            j += 2;
            continue;
          }
          if (raw[j] === "'") {
            closed = true;
            j++;
            break;
          }
          j++;
        }
        if (!closed) {
          diagnostics.push({
            line: lineNum,
            column: i + 1,
            severity: "error",
            message: "Unclosed character literal",
            code: "javac.unclosed.char",
          });
        }
        codeOnly += "''";
        i = j;
        continue;
      }

      if (ch === "{" || ch === "(" || ch === "[") {
        braceStack.push({ ch, line: lineNum, col: i + 1 });
      } else if (ch === "}" || ch === ")" || ch === "]") {
        const expected = ch === "}" ? "{" : ch === ")" ? "(" : "[";
        const top = braceStack[braceStack.length - 1];
        if (!top || top.ch !== expected) {
          diagnostics.push({
            line: lineNum,
            column: i + 1,
            severity: "error",
            message: "Unexpected '" + ch + "'",
            code: "javac.unexpected.token",
          });
        } else {
          braceStack.pop();
        }
      }

      codeOnly += ch;
      i++;
    }

    const trimmed = codeOnly.trim();
    if (trimmed && unclosedStringCol === -1) {
      // Warning for non-terminating while(true) without break statement (matches AsyncSchedulerExample inspection!)
      if (/\bwhile\s*\(\s*true\s*\)/.test(trimmed)) {
        const hasBreak = /\bbreak\s*;/.test(code);
        if (!hasBreak) {
          diagnostics.push({
            line: lineNum,
            column: raw.indexOf("while") + 1,
            severity: "warning",
            message: "'while' statement cannot complete without throwing an exception",
            code: "InfiniteLoopStatement",
          });
        }
      }

      // Check missing semicolon on simple single-line statements
      const lastChar = trimmed[trimmed.length - 1];
      const endsProperly =
        lastChar === ";" ||
        lastChar === "{" ||
        lastChar === "}" ||
        lastChar === ":" ||
        lastChar === "," ||
        lastChar === "(" ||
        trimmed[0] === "@";

      const isControlHeader =
        /^(?:if|else|for|while|switch|try|catch|finally|public|private|protected|class|interface|enum|package|import)\b/.test(
          trimmed,
        );

      const isMethodSignatureLine =
        lastChar === ")" &&
        /^(?:(?:public|private|protected|static|final|abstract|synchronized)\s+)*[A-Za-z_$][A-Za-z0-9_<>\[\]]*\s+[A-Za-z_$][A-Za-z0-9_$]*\s*\([^)]*\)$/.test(
          trimmed,
        );

      const looksLikeStatement =
        !endsProperly &&
        !isMethodSignatureLine &&
        (!isControlHeader ||
          /^(?:package|import|return|throw)\b/.test(trimmed) ||
          /^(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?[A-Za-z_$][A-Za-z0-9_<>\[\]]*\s+[A-Za-z_$][A-Za-z0-9_$]*\s*=/.test(
            trimmed,
          ));

      // Also catch `System.out.println(...)` or `int x = 5` missing `;`
      const isCallOrAssignMissingSemi =
        !endsProperly &&
        !isMethodSignatureLine &&
        (/^[A-Za-z_$][A-Za-z0-9_$.\[\]]*\s*\(.*\)$/.test(trimmed) ||
          /^[A-Za-z_$][A-Za-z0-9_$.\[\]]*\s*(?:\+\+|--|\+=|-=|\*=|\/=|=).*$/.test(trimmed) ||
          looksLikeStatement);

      if (isCallOrAssignMissingSemi) {
        diagnostics.push({
          line: lineNum,
          column: raw.length,
          severity: "error",
          message: "';' expected",
          code: "javac.expected.semi",
        });
      }
    }
  }

  for (let i = 0; i < braceStack.length; i++) {
    const unclosed = braceStack[i];
    diagnostics.push({
      line: unclosed.line,
      column: unclosed.col,
      severity: "error",
      message: "Reached end of file while parsing (unclosed '" + unclosed.ch + "')",
      code: "javac.eof.brace",
    });
  }

  return diagnostics;
}

/* ==================== Lightweight Pure-TS Java Interpreter ==================== */

interface RuntimeEnv {
  vars: Record<string, unknown>;
  parent: RuntimeEnv | null;
}

interface ParsedMethod {
  name: string;
  params: string[];
  bodyTokens: string[];
}

class ReturnSignal {
  value: unknown;
  constructor(value: unknown) {
    this.value = value;
  }
}

class BreakSignal {}
class ContinueSignal {}

function tokenizeForExec(code: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      i++;
      continue;
    }
    if (ch === "/" && code[i + 1] === "/") {
      const nl = code.indexOf("\n", i);
      i = nl === -1 ? code.length : nl + 1;
      continue;
    }
    if (ch === "/" && code[i + 1] === "*") {
      const end = code.indexOf("*/", i + 2);
      i = end === -1 ? code.length : end + 2;
      continue;
    }
    if (ch === "\"") {
      let j = i + 1;
      while (j < code.length) {
        if (code[j] === "\\") {
          j += 2;
          continue;
        }
        if (code[j] === "\"") {
          j++;
          break;
        }
        j++;
      }
      tokens.push(code.slice(i, j));
      i = j;
      continue;
    }
    if (ch === "'") {
      let j = i + 1;
      while (j < code.length) {
        if (code[j] === "\\") {
          j += 2;
          continue;
        }
        if (code[j] === "'") {
          j++;
          break;
        }
        j++;
      }
      tokens.push(code.slice(i, j));
      i = j;
      continue;
    }
    if (ch === "@") {
      let j = i + 1;
      while (j < code.length && /[A-Za-z0-9_$.]/.test(code[j])) j++;
      tokens.push(code.slice(i, j));
      i = j;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < code.length && /[0-9._xXa-fA-FlLdDfF]/.test(code[j])) j++;
      tokens.push(code.slice(i, j));
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < code.length && /[A-Za-z0-9_$]/.test(code[j])) j++;
      tokens.push(code.slice(i, j));
      i = j;
      continue;
    }
    const two = code.slice(i, i + 2);
    if (
      two === "==" ||
      two === "!=" ||
      two === "<=" ||
      two === ">=" ||
      two === "&&" ||
      two === "||" ||
      two === "++" ||
      two === "--" ||
      two === "+=" ||
      two === "-=" ||
      two === "*=" ||
      two === "/=" ||
      two === "%=" ||
      two === "->"
    ) {
      tokens.push(two);
      i += 2;
      continue;
    }
    tokens.push(ch);
    i++;
  }
  return tokens;
}

function unescapeJavaString(raw: string): string {
  const inner = raw.slice(1, -1);
  let out = "";
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "\\" && i + 1 < inner.length) {
      const next = inner[i + 1];
      if (next === "n") out += "\n";
      else if (next === "t") out += "\t";
      else if (next === "r") out += "\r";
      else if (next === "\"") out += "\"";
      else if (next === "'") out += "'";
      else if (next === "\\") out += "\\";
      else out += next;
      i++;
    } else {
      out += inner[i];
    }
  }
  return out;
}

function formatPrintf(fmt: string, args: unknown[]): string {
  let argIdx = 0;
  let result = "";
  for (let i = 0; i < fmt.length; i++) {
    if (fmt[i] === "%" && i + 1 < fmt.length) {
      if (fmt[i + 1] === "%") {
        result += "%";
        i++;
        continue;
      }
      if (fmt[i + 1] === "n") {
        result += "\n";
        i++;
        continue;
      }
      let j = i + 1;
      let spec = "";
      while (j < fmt.length && /[0-9.\-+ #]/.test(fmt[j])) {
        spec += fmt[j];
        j++;
      }
      const conv = j < fmt.length ? fmt[j] : "";
      const val = argIdx < args.length ? args[argIdx++] : undefined;
      if (conv === "d") {
        result += String(Math.trunc(Number(val ?? 0)));
        i = j;
        continue;
      }
      if (conv === "f") {
        const dotIdx = spec.indexOf(".");
        const prec = dotIdx !== -1 ? parseInt(spec.slice(dotIdx + 1), 10) : 6;
        result += Number(val ?? 0).toFixed(isNaN(prec) ? 6 : prec);
        i = j;
        continue;
      }
      if (conv === "s" || conv === "b" || conv === "c") {
        result += String(val ?? "null");
        i = j;
        continue;
      }
    }
    result += fmt[i];
  }
  return result;
}

class JavaInterpreter {
  private stdoutBuf = "";
  private stderrBuf = "";
  private steps = 0;
  private maxSteps = 20000;
  private methods: Record<string, ParsedMethod> = {};
  private staticVars: RuntimeEnv = { vars: {}, parent: null };

  public run(tokens: string[]): { stdout: string; stderr: string; exitCode: number } {
    this.collectClassMembers(tokens);

    const mainMethod = this.methods["main"];
    if (!mainMethod) {
      throw new Error("Error: Main method not found in class, please define the main method as:\n   public static void main(String[] args)");
    }

    const env: RuntimeEnv = { vars: { args: [] }, parent: this.staticVars };
    try {
      this.execBlock(mainMethod.bodyTokens, env);
    } catch (err) {
      if (err instanceof ReturnSignal) {
        // Normal return from main
      } else if (err instanceof Error) {
        this.stderrBuf += "Exception in thread \"main\" " + err.message + "\n";
        return { stdout: this.stdoutBuf, stderr: this.stderrBuf, exitCode: 1 };
      }
    }
    return { stdout: this.stdoutBuf, stderr: this.stderrBuf, exitCode: 0 };
  }

  private findMatching(tokens: string[], openIdx: number, openCh: string, closeCh: string): number {
    let depth = 0;
    for (let i = openIdx; i < tokens.length; i++) {
      if (tokens[i] === openCh) depth++;
      else if (tokens[i] === closeCh) {
        depth--;
        if (depth === 0) return i;
      }
    }
    return tokens.length - 1;
  }

  private collectClassMembers(tokens: string[]): void {
    // Find outer class `{ ... }`
    let i = 0;
    while (i < tokens.length && tokens[i] !== "class") i++;
    while (i < tokens.length && tokens[i] !== "{") i++;
    if (i >= tokens.length) return;

    const classEnd = this.findMatching(tokens, i, "{", "}");
    this.scanClassBody(tokens.slice(i + 1, classEnd));
  }

  private scanClassBody(body: string[]): void {
    let i = 0;
    while (i < body.length) {
      // Skip annotations
      while (i < body.length && body[i].charAt(0) === "@") {
        i++;
        if (body[i] === "(") {
          i = this.findMatching(body, i, "(", ")") + 1;
        }
      }
      if (i >= body.length) break;

      // Skip modifiers
      while (
        i < body.length &&
        (body[i] === "public" ||
          body[i] === "private" ||
          body[i] === "protected" ||
          body[i] === "static" ||
          body[i] === "final" ||
          body[i] === "abstract" ||
          body[i] === "synchronized")
      ) {
        i++;
      }
      if (i >= body.length) break;

      // Nested class
      if (body[i] === "class") {
        while (i < body.length && body[i] !== "{") i++;
        if (i < body.length) {
          const innerEnd = this.findMatching(body, i, "{", "}");
          this.scanClassBody(body.slice(i + 1, innerEnd));
          i = innerEnd + 1;
        }
        continue;
      }

      // Scan ahead for `;`, `=`, `(`, or `{`
      let j = i;
      while (j < body.length && body[j] !== ";" && body[j] !== "=" && body[j] !== "(" && body[j] !== "{") {
        if (body[j] === "<") {
          j = this.findMatching(body, j, "<", ">") + 1;
          continue;
        }
        j++;
      }
      if (j >= body.length) break;

      if (body[j] === "(" && j > i) {
        const methodName = body[j - 1];
        const paramsEnd = this.findMatching(body, j, "(", ")");
        const paramTokens = body.slice(j + 1, paramsEnd);
        const params: string[] = [];
        let p = 0;
        while (p < paramTokens.length) {
          let comma = p;
          while (comma < paramTokens.length && paramTokens[comma] !== ",") comma++;
          if (comma > p) {
            params.push(paramTokens[comma - 1]);
          }
          p = comma + 1;
        }
        let b = paramsEnd + 1;
        while (b < body.length && body[b] !== "{") b++;
        if (b < body.length) {
          const bodyEnd = this.findMatching(body, b, "{", "}");
          this.methods[methodName] = {
            name: methodName,
            params,
            bodyTokens: body.slice(b + 1, bodyEnd),
          };
          i = bodyEnd + 1;
          continue;
        }
      }

      // Field declaration ending with `;`
      while (j < body.length && body[j] !== ";") j++;
      if (j < body.length && body[j] === ";") {
        const eqIdx = body.slice(i, j).indexOf("=");
        if (eqIdx !== -1 && eqIdx > 0) {
          const varName = body[i + eqIdx - 1];
          const exprTokens = body.slice(i + eqIdx + 1, j);
          this.staticVars.vars[varName] = this.evalExpr(exprTokens, this.staticVars);
        }
        i = j + 1;
        continue;
      }
      i++;
    }
  }

  private tick(): void {
    this.steps++;
    if (this.steps > this.maxSteps) {
      throw new Error("Execution stopped: exceeded step limit (possible infinite loop)");
    }
  }

  private getVar(env: RuntimeEnv, name: string): unknown {
    let cur: RuntimeEnv | null = env;
    while (cur) {
      if (Object.prototype.hasOwnProperty.call(cur.vars, name)) {
        return cur.vars[name];
      }
      cur = cur.parent;
    }
    return undefined;
  }

  private setVar(env: RuntimeEnv, name: string, value: unknown): void {
    let cur: RuntimeEnv | null = env;
    while (cur) {
      if (Object.prototype.hasOwnProperty.call(cur.vars, name)) {
        cur.vars[name] = value;
        return;
      }
      cur = cur.parent;
    }
    env.vars[name] = value;
  }

  private execBlock(tokens: string[], env: RuntimeEnv): void {
    let i = 0;
    while (i < tokens.length) {
      this.tick();
      i = this.execStatement(tokens, i, env);
    }
  }

  private isTypeStart(tokens: string[], idx: number): boolean {
    const t = tokens[idx];
    if (t === "final") return true;
    if (
      t === "int" ||
      t === "long" ||
      t === "double" ||
      t === "float" ||
      t === "boolean" ||
      t === "char" ||
      t === "String" ||
      t === "var"
    ) {
      return true;
    }
    // Check `Type varName = ...` or `Type[] varName = ...`
    if (/^[A-Z][A-Za-z0-9_$]*$/.test(t)) {
      let next = idx + 1;
      if (tokens[next] === "<") {
        next = this.findMatching(tokens, next, "<", ">") + 1;
      }
      while (tokens[next] === "[" && tokens[next + 1] === "]") next += 2;
      const ident = tokens[next];
      if (ident && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(ident) && (tokens[next + 1] === "=" || tokens[next + 1] === ";")) {
        return true;
      }
    }
    return false;
  }

  private execStatement(tokens: string[], idx: number, env: RuntimeEnv): number {
    this.tick();
    const t = tokens[idx];
    if (!t || t === ";") return idx + 1;

    // Block `{ ... }`
    if (t === "{") {
      const end = this.findMatching(tokens, idx, "{", "}");
      const childEnv: RuntimeEnv = { vars: {}, parent: env };
      this.execBlock(tokens.slice(idx + 1, end), childEnv);
      return end + 1;
    }

    // `return`
    if (t === "return") {
      let semi = idx + 1;
      while (semi < tokens.length && tokens[semi] !== ";") semi++;
      const val = semi > idx + 1 ? this.evalExpr(tokens.slice(idx + 1, semi), env) : undefined;
      throw new ReturnSignal(val);
    }

    if (t === "break") {
      throw new BreakSignal();
    }

    if (t === "continue") {
      throw new ContinueSignal();
    }

    // `if (...) stmt [else stmt]`
    if (t === "if" && tokens[idx + 1] === "(") {
      const condEnd = this.findMatching(tokens, idx + 1, "(", ")");
      const cond = Boolean(this.evalExpr(tokens.slice(idx + 2, condEnd), env));
      const thenStart = condEnd + 1;
      const thenEnd = this.skipOrExecBranch(tokens, thenStart, env, cond);
      if (tokens[thenEnd] === "else") {
        return this.skipOrExecBranch(tokens, thenEnd + 1, env, !cond);
      }
      return thenEnd;
    }

    // `while (...) stmt`
    if (t === "while" && tokens[idx + 1] === "(") {
      const condEnd = this.findMatching(tokens, idx + 1, "(", ")");
      const condTokens = tokens.slice(idx + 2, condEnd);
      const bodyStart = condEnd + 1;
      const bodyEnd = this.findStatementEnd(tokens, bodyStart);
      const bodySlice = tokens.slice(bodyStart, bodyEnd);
      let iter = 0;
      while (Boolean(this.evalExpr(condTokens, env))) {
        this.tick();
        iter++;
        // Special safe guard for `while (true)` pattern like AsyncSchedulerExample
        if (iter > 1 && condTokens.length === 1 && condTokens[0] === "true") {
          break;
        }
        try {
          this.execStatement(bodySlice, 0, env);
        } catch (sig) {
          if (sig instanceof BreakSignal) break;
          if (sig instanceof ContinueSignal) continue;
          throw sig;
        }
      }
      return bodyEnd;
    }

    // `for (...) stmt` (supports classic and enhanced for-each)
    if (t === "for" && tokens[idx + 1] === "(") {
      const parenEnd = this.findMatching(tokens, idx + 1, "(", ")");
      const header = tokens.slice(idx + 2, parenEnd);
      const bodyStart = parenEnd + 1;
      const bodyEnd = this.findStatementEnd(tokens, bodyStart);
      const bodySlice = tokens.slice(bodyStart, bodyEnd);
      const loopEnv: RuntimeEnv = { vars: {}, parent: env };

      const colonIdx = header.indexOf(":");
      if (colonIdx !== -1) {
        const varName = header[colonIdx - 1];
        const iterable = this.evalExpr(header.slice(colonIdx + 1), env);
        if (Array.isArray(iterable)) {
          for (let k = 0; k < iterable.length; k++) {
            this.tick();
            loopEnv.vars[varName] = iterable[k];
            try {
              this.execStatement(bodySlice, 0, loopEnv);
            } catch (sig) {
              if (sig instanceof BreakSignal) break;
              if (sig instanceof ContinueSignal) continue;
              throw sig;
            }
          }
        }
        return bodyEnd;
      }

      const semi1 = header.indexOf(";");
      const semi2 = header.indexOf(";", semi1 + 1);
      const initTokens = semi1 !== -1 ? header.slice(0, semi1) : [];
      const condTokens = semi1 !== -1 && semi2 !== -1 ? header.slice(semi1 + 1, semi2) : [];
      const stepTokens = semi2 !== -1 ? header.slice(semi2 + 1) : [];

      if (initTokens.length > 0) {
        this.execSimpleTokens(initTokens, loopEnv);
      }
      while (condTokens.length === 0 || Boolean(this.evalExpr(condTokens, loopEnv))) {
        this.tick();
        try {
          this.execStatement(bodySlice, 0, loopEnv);
        } catch (sig) {
          if (sig instanceof BreakSignal) break;
          if (sig instanceof ContinueSignal) {
            if (stepTokens.length > 0) this.execSimpleTokens(stepTokens, loopEnv);
            continue;
          }
          throw sig;
        }
        if (stepTokens.length > 0) {
          this.execSimpleTokens(stepTokens, loopEnv);
        }
      }
      return bodyEnd;
    }

    // `try { ... } catch (...) { ... }`
    if (t === "try" && tokens[idx + 1] === "{") {
      const tryEnd = this.findMatching(tokens, idx + 1, "{", "}");
      try {
        this.execBlock(tokens.slice(idx + 2, tryEnd), { vars: {}, parent: env });
      } catch (err) {
        if (err instanceof ReturnSignal || err instanceof BreakSignal || err instanceof ContinueSignal) {
          throw err;
        }
        // Ignore caught runtime exceptions if catch exists
      }
      let next = tryEnd + 1;
      while (tokens[next] === "catch") {
        next++;
        if (tokens[next] === "(") next = this.findMatching(tokens, next, "(", ")") + 1;
        if (tokens[next] === "{") next = this.findMatching(tokens, next, "{", "}") + 1;
      }
      if (tokens[next] === "finally" && tokens[next + 1] === "{") {
        const finEnd = this.findMatching(tokens, next + 1, "{", "}");
        this.execBlock(tokens.slice(next + 2, finEnd), { vars: {}, parent: env });
        next = finEnd + 1;
      }
      return next;
    }

    // Regular semicolon-terminated statement
    const stmtEnd = this.findStatementEnd(tokens, idx);
    const stmtTokens = tokens.slice(idx, stmtEnd);
    // Strip trailing `;`
    if (stmtTokens[stmtTokens.length - 1] === ";") {
      stmtTokens.pop();
    }
    this.execSimpleTokens(stmtTokens, env);
    return stmtEnd;
  }

  private findStatementEnd(tokens: string[], idx: number): number {
    if (tokens[idx] === "{") {
      return this.findMatching(tokens, idx, "{", "}") + 1;
    }
    if (tokens[idx] === "if" || tokens[idx] === "while" || tokens[idx] === "for") {
      let i = idx + 1;
      if (tokens[i] === "(") i = this.findMatching(tokens, i, "(", ")") + 1;
      i = this.findStatementEnd(tokens, i);
      if (tokens[idx] === "if" && tokens[i] === "else") {
        return this.findStatementEnd(tokens, i + 1);
      }
      return i;
    }
    let i = idx;
    let parenDepth = 0;
    let braceDepth = 0;
    while (i < tokens.length) {
      if (tokens[i] === "(") parenDepth++;
      else if (tokens[i] === ")") parenDepth--;
      else if (tokens[i] === "{") braceDepth++;
      else if (tokens[i] === "}") {
        if (braceDepth === 0) return i + 1;
        braceDepth--;
        if (braceDepth === 0 && parenDepth === 0 && (tokens[i + 1] === "." || tokens[i + 1] === ")")) {
          // chained call after anonymous/lambda block like `new Thread(() -> {...}).start();`
        } else if (braceDepth === 0 && parenDepth === 0) {
          return i + 1;
        }
      } else if (tokens[i] === ";" && parenDepth === 0 && braceDepth === 0) {
        return i + 1;
      }
      i++;
    }
    return i;
  }

  private skipOrExecBranch(tokens: string[], startIdx: number, env: RuntimeEnv, shouldExec: boolean): number {
    const endIdx = this.findStatementEnd(tokens, startIdx);
    if (shouldExec) {
      this.execStatement(tokens.slice(startIdx, endIdx), 0, env);
    }
    return endIdx;
  }

  private execSimpleTokens(tokens: string[], env: RuntimeEnv): void {
    if (tokens.length === 0) return;

    // Handle `new Thread(() -> { ... }).start()` gracefully without looping forever
    if (tokens[0] === "new" && tokens[1] === "Thread") {
      return;
    }

    // Variable declaration: [final] Type[<>][[]] name [= expr]
    if (this.isTypeStart(tokens, 0)) {
      let p = 0;
      if (tokens[p] === "final") p++;
      p++; // type token
      if (tokens[p] === "<") p = this.findMatching(tokens, p, "<", ">") + 1;
      while (tokens[p] === "[" && tokens[p + 1] === "]") p += 2;
      const varName = tokens[p];
      if (!varName) return;
      if (tokens[p + 1] === "=") {
        const rhs = tokens.slice(p + 2);
        env.vars[varName] = this.evalExpr(rhs, env);
      } else {
        env.vars[varName] = 0;
      }
      return;
    }

    // Assignment or compound assignment: `name = expr`, `arr[i] = expr`, `i++`, `++i`
    if (tokens.length === 2 && (tokens[1] === "++" || tokens[1] === "--")) {
      const cur = Number(this.getVar(env, tokens[0]) ?? 0);
      this.setVar(env, tokens[0], tokens[1] === "++" ? cur + 1 : cur - 1);
      return;
    }
    if (tokens.length === 2 && (tokens[0] === "++" || tokens[0] === "--")) {
      const cur = Number(this.getVar(env, tokens[1]) ?? 0);
      this.setVar(env, tokens[1], tokens[0] === "++" ? cur + 1 : cur - 1);
      return;
    }

    if (
      tokens.length >= 3 &&
      (tokens[1] === "=" || tokens[1] === "+=" || tokens[1] === "-=" || tokens[1] === "*=" || tokens[1] === "/=" || tokens[1] === "%=")
    ) {
      const target = tokens[0];
      const rhsVal = this.evalExpr(tokens.slice(2), env);
      if (tokens[1] === "=") {
        this.setVar(env, target, rhsVal);
      } else {
        const prev = this.getVar(env, target);
        if (tokens[1] === "+=") {
          this.setVar(env, target, typeof prev === "string" || typeof rhsVal === "string" ? String(prev ?? "") + String(rhsVal ?? "") : Number(prev ?? 0) + Number(rhsVal ?? 0));
        } else if (tokens[1] === "-=") {
          this.setVar(env, target, Number(prev ?? 0) - Number(rhsVal ?? 0));
        } else if (tokens[1] === "*=") {
          this.setVar(env, target, Number(prev ?? 0) * Number(rhsVal ?? 0));
        } else if (tokens[1] === "/=") {
          this.setVar(env, target, Number(prev ?? 0) / Number(rhsVal ?? 1));
        } else if (tokens[1] === "%=") {
          this.setVar(env, target, Number(prev ?? 0) % Number(rhsVal ?? 1));
        }
      }
      return;
    }

    // Array element assignment: `arr[idx] = val`
    if (tokens[1] === "[") {
      const closeBracket = this.findMatching(tokens, 1, "[", "]");
      if (tokens[closeBracket + 1] === "=") {
        const arr = this.getVar(env, tokens[0]);
        const idxVal = Number(this.evalExpr(tokens.slice(2, closeBracket), env));
        const val = this.evalExpr(tokens.slice(closeBracket + 2), env);
        if (Array.isArray(arr)) {
          arr[idxVal] = val;
        }
        return;
      }
    }

    // Otherwise evaluate as expression (e.g. System.out.println(...) or method call)
    this.evalExpr(tokens, env);
  }

  private evalExpr(tokens: string[], env: RuntimeEnv): unknown {
    if (tokens.length === 0) return undefined;
    let pos = 0;

    const peek = (): string | undefined => tokens[pos];
    const consume = (): string => tokens[pos++];

    const parsePrimary = (): unknown => {
      const t = peek();
      if (t === undefined) return undefined;

      // Array initializer `{1, 2, 3}`
      if (t === "{") {
        consume();
        const items: unknown[] = [];
        while (pos < tokens.length && peek() !== "}") {
          items.push(parseTernary());
          if (peek() === ",") consume();
        }
        if (peek() === "}") consume();
        return items;
      }

      // Parenthesized expr
      if (t === "(") {
        consume();
        // Check cast like `(int) x` or `(double) x`
        const nextTok = peek();
        if (
          (nextTok === "int" || nextTok === "double" || nextTok === "long" || nextTok === "float" || nextTok === "String") &&
          tokens[pos + 1] === ")"
        ) {
          const castType = consume();
          consume(); // `)`
          const val = parseUnary();
          if (castType === "int" || castType === "long") return Math.trunc(Number(val));
          if (castType === "double" || castType === "float") return Number(val);
          return String(val);
        }
        const val = parseTernary();
        if (peek() === ")") consume();
        return val;
      }

      // `new Type(...)` or `new Type[n]`
      if (t === "new") {
        consume();
        const typeName = consume();
        if (peek() === "<") {
          pos = this.findMatching(tokens, pos, "<", ">") + 1;
        }
        if (peek() === "[") {
          consume();
          const len = Number(parseTernary());
          if (peek() === "]") consume();
          if (peek() === "{") {
            return parsePrimary();
          }
          const arr: unknown[] = [];
          for (let k = 0; k < len; k++) arr.push(typeName === "String" ? "" : 0);
          return arr;
        }
        if (peek() === "(") {
          const parenEnd = this.findMatching(tokens, pos, "(", ")");
          pos = parenEnd + 1;
        }
        if (typeName === "MessageQueue") {
          return { __isMessageQueue: true, queue: [] as string[] };
        }
        return { __class: typeName };
      }

      // String literal
      if (t.charAt(0) === "\"") {
        consume();
        return unescapeJavaString(t);
      }

      // Char literal
      if (t.charAt(0) === "'") {
        consume();
        return t.slice(1, -1);
      }

      // Booleans / null
      if (t === "true") {
        consume();
        return true;
      }
      if (t === "false") {
        consume();
        return false;
      }
      if (t === "null") {
        consume();
        return null;
      }

      // Number
      if (/^[0-9]/.test(t)) {
        consume();
        const cleaned = t.replace(/[lLdDfF_]$/g, "").replace(/_/g, "");
        return Number(cleaned);
      }

      // Identifier, method call, or member chain (`System.out.println(...)`)
      if (/^[A-Za-z_$]/.test(t)) {
        const rootName = consume();

        // Direct function call
        if (peek() === "(") {
          const args = parseArgList();
          return this.invokeFunction(rootName, args, env);
        }

        // Check `System.out.*` / `System.err.*` / `Math.*` / `Integer.*`
        if (rootName === "System" && peek() === ".") {
          consume(); // `.`
          const streamName = consume(); // `out` or `err`
          if (peek() === ".") {
            consume(); // `.`
            const method = consume();
            const args = parseArgList();
            return this.invokeSystemOut(streamName === "err", method, args);
          }
        }

        if (rootName === "Math" && peek() === ".") {
          consume();
          const fn = consume();
          if (peek() === "(") {
            const args = parseArgList();
            return this.invokeMath(fn, args);
          }
          if (fn === "PI") return Math.PI;
          if (fn === "E") return Math.E;
        }

        if (rootName === "Integer" && peek() === ".") {
          consume();
          const fn = consume();
          if (peek() === "(") {
            const args = parseArgList();
            if (fn === "parseInt") return parseInt(String(args[0] ?? "0"), 10);
          }
          if (fn === "MAX_VALUE") return 2147483647;
          if (fn === "MIN_VALUE") return -2147483648;
        }

        if (rootName === "Double" && peek() === ".") {
          consume();
          const fn = consume();
          if (peek() === "(") {
            const args = parseArgList();
            if (fn === "parseDouble") return parseFloat(String(args[0] ?? "0"));
          }
        }

        let value = this.getVar(env, rootName);

        // Chained `.member` / `[index]` / `++` / `--`
        while (peek() === "." || peek() === "[" || peek() === "++" || peek() === "--") {
          const op = peek();
          if (op === "++" || op === "--") {
            consume();
            const oldNum = Number(value ?? 0);
            this.setVar(env, rootName, op === "++" ? oldNum + 1 : oldNum - 1);
            return oldNum;
          }
          if (op === "[") {
            consume();
            const index = Number(parseTernary());
            if (peek() === "]") consume();
            if (Array.isArray(value) || typeof value === "string") {
              value = value[index];
            } else {
              value = undefined;
            }
            continue;
          }
          if (op === ".") {
            consume();
            const member = consume();
            if (peek() === "(") {
              const args = parseArgList();
              value = this.invokeInstanceMethod(value, member, args, env);
            } else if (member === "length" && (Array.isArray(value) || typeof value === "string")) {
              value = value.length;
            } else {
              value = undefined;
            }
          }
        }

        return value;
      }

      consume();
      return undefined;
    };

    const parseArgList = (): unknown[] => {
      const args: unknown[] = [];
      if (peek() === "(") {
        consume();
        while (pos < tokens.length && peek() !== ")") {
          args.push(parseTernary());
          if (peek() === ",") consume();
        }
        if (peek() === ")") consume();
      }
      return args;
    };

    const parseUnary = (): unknown => {
      const t = peek();
      if (t === "!") {
        consume();
        return !Boolean(parseUnary());
      }
      if (t === "-") {
        consume();
        return -Number(parseUnary());
      }
      if (t === "+") {
        consume();
        return +Number(parseUnary());
      }
      if (t === "++" || t === "--") {
        consume();
        const name = peek();
        if (name) {
          consume();
          const next = Number(this.getVar(env, name) ?? 0) + (t === "++" ? 1 : -1);
          this.setVar(env, name, next);
          return next;
        }
      }
      return parsePrimary();
    };

    const parseMul = (): unknown => {
      let left = parseUnary();
      while (peek() === "*" || peek() === "/" || peek() === "%") {
        const op = consume();
        const right = parseUnary();
        if (op === "*") left = Number(left) * Number(right);
        else if (op === "/") left = Number(left) / Number(right);
        else left = Number(left) % Number(right);
      }
      return left;
    };

    const parseAdd = (): unknown => {
      let left = parseMul();
      while (peek() === "+" || peek() === "-") {
        const op = consume();
        const right = parseMul();
        if (op === "+") {
          if (typeof left === "string" || typeof right === "string") {
            left = String(left === null ? "null" : left) + String(right === null ? "null" : right);
          } else {
            left = Number(left) + Number(right);
          }
        } else {
          left = Number(left) - Number(right);
        }
      }
      return left;
    };

    const parseRel = (): unknown => {
      let left = parseAdd();
      while (peek() === "<" || peek() === "<=" || peek() === ">" || peek() === ">=") {
        const op = consume();
        const right = parseAdd();
        if (op === "<") left = Number(left) < Number(right);
        else if (op === "<=") left = Number(left) <= Number(right);
        else if (op === ">") left = Number(left) > Number(right);
        else left = Number(left) >= Number(right);
      }
      return left;
    };

    const parseEq = (): unknown => {
      let left = parseRel();
      while (peek() === "==" || peek() === "!=") {
        const op = consume();
        const right = parseRel();
        left = op === "==" ? left === right : left !== right;
      }
      return left;
    };

    const parseAnd = (): unknown => {
      let left = parseEq();
      while (peek() === "&&") {
        consume();
        const right = parseEq();
        left = Boolean(left) && Boolean(right);
      }
      return left;
    };

    const parseOr = (): unknown => {
      let left = parseAnd();
      while (peek() === "||") {
        consume();
        const right = parseAnd();
        left = Boolean(left) || Boolean(right);
      }
      return left;
    };

    const parseTernary = (): unknown => {
      const cond = parseOr();
      if (peek() === "?") {
        consume();
        const thenVal = parseTernary();
        if (peek() === ":") consume();
        const elseVal = parseTernary();
        return cond ? thenVal : elseVal;
      }
      return cond;
    };

    return parseTernary();
  }

  private invokeSystemOut(isErr: boolean, method: string, args: unknown[]): undefined {
    let text = "";
    if (method === "println") {
      text = (args.length > 0 ? String(args[0] === null ? "null" : args[0]) : "") + "\n";
    } else if (method === "print") {
      text = args.length > 0 ? String(args[0] === null ? "null" : args[0]) : "";
    } else if (method === "printf") {
      const fmt = String(args[0] ?? "");
      text = formatPrintf(fmt, args.slice(1));
    }
    if (isErr) this.stderrBuf += text;
    else this.stdoutBuf += text;
    return undefined;
  }

  private invokeMath(fn: string, args: unknown[]): number {
    const a = Number(args[0] ?? 0);
    const b = Number(args[1] ?? 0);
    if (fn === "abs") return Math.abs(a);
    if (fn === "max") return Math.max(a, b);
    if (fn === "min") return Math.min(a, b);
    if (fn === "sqrt") return Math.sqrt(a);
    if (fn === "pow") return Math.pow(a, b);
    if (fn === "floor") return Math.floor(a);
    if (fn === "ceil") return Math.ceil(a);
    if (fn === "round") return Math.round(a);
    return 0;
  }

  private invokeInstanceMethod(target: unknown, method: string, args: unknown[], env: RuntimeEnv): unknown {
    // Handle `MessageQueue` async sample calls (`schedule` -> `process`, `processNext` -> `process`)
    if (target && typeof target === "object" && (target as { __isMessageQueue?: boolean }).__isMessageQueue) {
      const mq = target as { queue: string[] };
      if (method === "schedule") {
        const msg = String(args[0] ?? "");
        if (this.methods["process"]) {
          this.invokeFunction("process", [msg], env);
        } else {
          this.stdoutBuf += "Processing " + msg + "\n";
        }
        return undefined;
      }
      if (method === "processNext") {
        if (mq.queue.length > 0) {
          const msg = mq.queue.shift() || "";
          this.invokeFunction("process", [msg], env);
        }
        return undefined;
      }
    }

    if (typeof target === "string") {
      if (method === "length") return target.length;
      if (method === "toUpperCase") return target.toUpperCase();
      if (method === "toLowerCase") return target.toLowerCase();
      if (method === "trim") return target.trim();
      if (method === "equals") return target === String(args[0]);
      if (method === "equalsIgnoreCase") return target.toLowerCase() === String(args[0]).toLowerCase();
      if (method === "contains") return target.indexOf(String(args[0])) !== -1;
      if (method === "charAt") return target.charAt(Number(args[0]));
      if (method === "substring") {
        return args.length >= 2
          ? target.substring(Number(args[0]), Number(args[1]))
          : target.substring(Number(args[0]));
      }
    }

    if (method === "printStackTrace") {
      return undefined;
    }

    if (this.methods[method]) {
      return this.invokeFunction(method, args, env);
    }

    return undefined;
  }

  private invokeFunction(name: string, args: unknown[], callerEnv: RuntimeEnv): unknown {
    const fn = this.methods[name];
    if (!fn) return undefined;
    const fnEnv: RuntimeEnv = { vars: {}, parent: this.staticVars };
    for (let i = 0; i < fn.params.length; i++) {
      fnEnv.vars[fn.params[i]] = args[i];
    }
    // Also expose parent local variables if inner helper accesses outer static/final
    if (!fnEnv.parent) fnEnv.parent = callerEnv;
    try {
      this.execBlock(fn.bodyTokens, fnEnv);
    } catch (sig) {
      if (sig instanceof ReturnSignal) {
        return sig.value;
      }
      throw sig;
    }
    return undefined;
  }
}

/**
 * Compile and run a Java class source string in pure TypeScript.
 */
export function runJavaProgram(code: string, preferredClassName?: string): JavaRunResult {
  const startMs = Date.now();
  const diagnostics = analyzeJavaDiagnostics(code);
  const errors = diagnostics.filter((d) => d.severity === "error");

  const pkgMatch = /^\s*package\s+([A-Za-z0-9_.]+)\s*;/m.exec(code);
  const clsMatch = /\bclass\s+([A-Za-z_$][A-Za-z0-9_$]*)/.exec(code);
  const simpleName = clsMatch ? clsMatch[1] : preferredClassName || "Main";
  const fqName = pkgMatch ? pkgMatch[1] + "." + simpleName : simpleName;
  const cmdLine =
    "/Library/Java/JavaVirtualMachines/openjdk-21.jdk/Contents/Home/bin/java -Dfile.encoding=UTF-8 -classpath out/production/" +
    simpleName +
    " " +
    fqName;

  if (errors.length > 0) {
    const errLines = errors.map(
      (e) => simpleName + ".java:" + e.line + ":" + e.column + ": error: " + e.message,
    );
    return {
      success: false,
      exitCode: 1,
      className: fqName,
      commandLine: cmdLine,
      stdout: "",
      stderr: errLines.join("\n"),
      outputLines: errLines.concat(["", "Process finished with exit code 1"]),
      diagnostics,
      durationMs: Math.max(1, Date.now() - startMs),
    };
  }

  const tokens = tokenizeForExec(code);
  const interpreter = new JavaInterpreter();
  const execRes = interpreter.run(tokens);

  const rawOut = execRes.stdout.replace(/\r?\n$/, "");
  const stdoutLines = rawOut ? rawOut.split("\n") : [];
  const stderrLines = execRes.stderr.trim() ? execRes.stderr.trim().split("\n") : [];
  const combined = stdoutLines.concat(stderrLines);
  if (combined.length > 0) combined.push("");
  combined.push("Process finished with exit code " + execRes.exitCode);

  return {
    success: execRes.exitCode === 0,
    exitCode: execRes.exitCode,
    className: fqName,
    commandLine: cmdLine,
    stdout: execRes.stdout,
    stderr: execRes.stderr,
    outputLines: combined,
    diagnostics,
    durationMs: Math.max(4, Date.now() - startMs),
  };
}

/**
 * Flatten a virtual project tree into a dictionary of id -> VirtualFileNode for quick lookup.
 */
export function indexVirtualFiles(nodes: VirtualFileNode[], out: Record<string, VirtualFileNode> = {}): Record<string, VirtualFileNode> {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    out[n.id] = n;
    if (n.children && n.children.length > 0) {
      indexVirtualFiles(n.children, out);
    }
  }
  return out;
}

/**
 * Find a file node by filename or path inside a project tree.
 */
export function findVirtualFileByName(nodes: VirtualFileNode[], queryName: string): VirtualFileNode | null {
  const norm = queryName.trim().toLowerCase();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (
      n.content !== undefined &&
      (n.name.toLowerCase() === norm ||
        (n.displayName && n.displayName.toLowerCase() === norm) ||
        n.path.toLowerCase() === norm)
    ) {
      return n;
    }
    if (n.children && n.children.length > 0) {
      const found = findVirtualFileByName(n.children, queryName);
      if (found) return found;
    }
  }
  return null;
}

export interface TerminalCommandOutput {
  lines: string[];
  clear?: boolean;
}

/**
 * Execute simulated shell commands inside IntelliJ's embedded Terminal tool window.
 */
export function executeTerminalCommand(
  rawInput: string,
  preset: IntellijProjectPreset,
  filesById: Record<string, VirtualFileNode>,
  activeFileId: string,
): TerminalCommandOutput {
  const cmd = rawInput.trim();
  if (!cmd) return { lines: [] };

  const parts = cmd.split(/\s+/);
  const bin = parts[0].toLowerCase();

  if (bin === "clear" || bin === "cls") {
    return { lines: [], clear: true };
  }

  if (bin === "help") {
    return {
      lines: [
        "Available shell commands:",
        "  pwd, ls, ls -la, cat <file>, javac <File.java>, java <ClassName>, java -version, git status, git branch, clear",
      ],
    };
  }

  if (bin === "pwd") {
    const homeExpanded = preset.rootPath.replace(/^~/, "/Users/developer");
    return { lines: [homeExpanded] };
  }

  if (bin === "ls") {
    if (preset.id === "HelloWorld") {
      return { lines: [".gitignore    .idea/        HelloWorld.iml  out/          src/"] };
    }
    return { lines: [".gitignore    .idea/        java-samples/ pom.xml       README.md"] };
  }

  if (bin === "java" && (parts[1] === "-version" || parts[1] === "--version")) {
    return {
      lines: [
        "openjdk version \"21.0.4\" 2024-07-16",
        "OpenJDK Runtime Environment (build 21.0.4+7-LTS)",
        "OpenJDK 64-Bit Server VM (build 21.0.4+7-LTS, mixed mode, sharing)",
      ],
    };
  }

  if (bin === "echo") {
    return { lines: [cmd.slice(4).trim().replace(/^["']|["']$/g, "")] };
  }

  if (bin === "git") {
    const sub = (parts[1] || "").toLowerCase();
    if (!preset.hasGit) {
      return { lines: ["fatal: not a git repository (or any of the parent directories): .git"] };
    }
    if (sub === "branch") {
      return { lines: ["* " + preset.gitBranch] };
    }
    if (sub === "status") {
      return {
        lines: [
          "On branch " + preset.gitBranch,
          "Your branch is up to date with 'origin/" + preset.gitBranch + "'.",
          "",
          "nothing to commit, working tree clean",
        ],
      };
    }
    if (sub === "log") {
      return {
        lines: [
          "commit a4c8192 (HEAD -> " + preset.gitBranch + ")",
          "Author: JetBrains Samples <dev@jetbrains.com>",
          "    Update async debugging examples",
        ],
      };
    }
    return { lines: ["git: '" + (parts[1] || "") + "' is not a git command. See 'git status' or 'git branch'."] };
  }

  if (bin === "cat" && parts[1]) {
    const match = findVirtualFileByName(preset.tree, parts[1]);
    if (match && match.content !== undefined) {
      return { lines: match.content.replace(/\n$/, "").split("\n") };
    }
    return { lines: ["cat: " + parts[1] + ": No such file or directory"] };
  }

  if (bin === "javac") {
    const targetName = parts[1];
    const targetNode = targetName ? findVirtualFileByName(preset.tree, targetName) : filesById[activeFileId];
    if (!targetNode || targetNode.content === undefined) {
      return { lines: ["error: file not found: " + (targetName || "")] };
    }
    const diags = analyzeJavaDiagnostics(targetNode.content).filter((d) => d.severity === "error");
    if (diags.length > 0) {
      return {
        lines: diags.map((d) => targetNode.name + ":" + d.line + ": error: " + d.message),
      };
    }
    return { lines: ["Compiled " + targetNode.name + " -> out/production/" + preset.moduleName + "/"] };
  }

  if (bin === "java" && parts[1]) {
    const target = parts[1].replace(/\.java$/, "");
    const targetNode = findVirtualFileByName(preset.tree, target + ".java") || filesById[activeFileId];
    if (!targetNode || targetNode.content === undefined) {
      return { lines: ["Error: Could not find or load main class " + parts[1]] };
    }
    const res = runJavaProgram(targetNode.content, target);
    const out = res.stdout ? res.stdout.replace(/\n$/, "").split("\n") : [];
    const err = res.stderr ? res.stderr.replace(/\n$/, "").split("\n") : [];
    return { lines: out.concat(err) };
  }

  return { lines: ["zsh: command not found: " + parts[0] + " (type 'help' for supported commands)"] };
}
