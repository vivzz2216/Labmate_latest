/** Real code-driven Android Activity, Intent, Manifest, and Event-Listener runtime for LabMate's Interactive Emulator. */

import type {
  AndroidResources,
  BasicLayoutFileInput,
  XmlLayoutElement,
} from "./androidXmlLayout.ts";
import {
  parseAndroidLayoutXml,
  parseAndroidResources,
  resolveResourceValue,
} from "./androidXmlLayout.ts";

export interface RuntimeLogEntry {
  id: string;
  timestamp: string;
  pid: number;
  tid: number;
  tag: string;
  packageName: string;
  level: "V" | "D" | "I" | "W" | "E" | "A";
  message: string;
  isCrash?: boolean;
}

export interface ParsedManifest {
  packageName: string;
  appLabel: string;
  declaredActivities: string[];
  launcherActivity: string;
}

export interface ActivityBackStackFrame {
  activityName: string;
  layoutFilePath: string;
  layoutName: string;
  extras: Record<string, string>;
  stateVars: Record<string, string | number | boolean>;
  widgetTextOverrides: Record<string, string>;
  inputValues: Record<string, string>;
  checkedValues: Record<string, boolean>;
  visibilityOverrides: Record<string, "visible" | "invisible" | "gone">;
}

export interface ToastNotice {
  id: string;
  message: string;
  timestamp: number;
}

export interface AndroidRuntimeSession {
  activePackageName: string;
  appLabel: string;
  activityStack: ActivityBackStackFrame[];
  toasts: ToastNotice[];
  isHomeScreen: boolean;
  recentsOpen: boolean;
  crashError: string | null;
  lastLaunchTimeMs: number;
  integerPreferences?: Record<string, number>;
}

export interface RuntimeStepResult {
  session: AndroidRuntimeSession;
  logs: RuntimeLogEntry[];
  stdout: string[];
  error: string | null;
}

function nowLogTime(): string {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function makeLog(
  level: RuntimeLogEntry["level"],
  tag: string,
  packageName: string,
  message: string,
  seq: number,
  isCrash?: boolean
): RuntimeLogEntry {
  return {
    id: `rt-${Date.now()}-${seq}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: nowLogTime(),
    pid: 6410,
    tid: 6410,
    tag,
    packageName,
    level,
    message,
    isCrash,
  };
}

function normalizeActivityClassName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "MainActivity";
  const lastDot = trimmed.lastIndexOf(".");
  return lastDot >= 0 ? trimmed.slice(lastDot + 1) : trimmed;
}

export function parseAndroidManifest(
  files: BasicLayoutFileInput[],
  fallbackPackage = "com.example.myapp"
): ParsedManifest {
  const resources = parseAndroidResources(files);
  const manifestFile = files.find(
    (f) => f.name === "AndroidManifest.xml" || (f.path || "").indexOf("AndroidManifest.xml") >= 0
  );
  if (!manifestFile) {
    return {
      packageName: fallbackPackage,
      appLabel: "My Application",
      declaredActivities: ["MainActivity"],
      launcherActivity: "MainActivity",
    };
  }

  const content = manifestFile.content;
  const pkgMatch = /package\s*=\s*"([^"]+)"/.exec(content);
  const labelMatch = /<application[\s\S]*?android:label\s*=\s*"([^"]+)"/.exec(content);
  const appLabel = labelMatch ? resolveResourceValue(labelMatch[1], resources) : "My Application";

  const declaredActivities: string[] = [];
  let launcherActivity = "";

  // Match self-closing or paired <activity> tags
  const actRe = /<activity\b([\s\S]*?)(?:\/>|>([\s\S]*?)<\/activity>)/g;
  let am = actRe.exec(content);
  while (am) {
    const attrs = am[1] || "";
    const body = am[2] || "";
    const nameMatch = /android:name\s*=\s*"([^"]+)"/.exec(attrs);
    if (nameMatch) {
      const shortName = normalizeActivityClassName(nameMatch[1]);
      if (declaredActivities.indexOf(shortName) < 0) {
        declaredActivities.push(shortName);
      }
      if (
        body.indexOf("android.intent.action.MAIN") >= 0 &&
        body.indexOf("android.intent.category.LAUNCHER") >= 0
      ) {
        launcherActivity = shortName;
      }
    }
    am = actRe.exec(content);
  }

  if (declaredActivities.length === 0) declaredActivities.push("MainActivity");
  if (!launcherActivity) launcherActivity = declaredActivities[0];

  return {
    packageName: pkgMatch ? pkgMatch[1] : fallbackPackage,
    appLabel,
    declaredActivities,
    launcherActivity,
  };
}

function findBraceBlock(source: string, openBraceIndex: number): { body: string; endIndex: number } {
  let depth = 0;
  let inDouble = false;
  let inSingle = false;
  let inLineComment = false;
  let inBlockComment = false;
  const n = source.length;

  for (let i = openBraceIndex; i < n; i++) {
    const ch = source.charAt(i);
    const next = source.charAt(i + 1);
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inDouble) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === '"') inDouble = false;
      continue;
    }
    if (inSingle) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === "'") inSingle = false;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return {
          body: source.slice(openBraceIndex + 1, i),
          endIndex: i + 1,
        };
      }
    }
  }
  return { body: source.slice(openBraceIndex + 1), endIndex: n };
}

function findMatchingParen(source: string, openParenIndex: number): number {
  let depth = 0;
  let inDouble = false;
  let inSingle = false;
  const n = source.length;
  for (let i = openParenIndex; i < n; i++) {
    const ch = source.charAt(i);
    if (inDouble) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === '"') inDouble = false;
      continue;
    }
    if (inSingle) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === "'") inSingle = false;
      continue;
    }
    if (ch === '"') inDouble = true;
    else if (ch === "'") inSingle = true;
    else if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return n - 1;
}

interface ParsedActivityInfo {
  className: string;
  layoutName: string;
  isCompose: boolean;
  fieldDecls: Array<{ name: string; expr: string }>;
  varToViewId: Record<string, string>;
  onCreateBody: string;
  clickHandlersByViewId: Record<string, string>;
  namedMethods: Record<string, string>;
}

function stripListenersFromBody(body: string): string {
  // Remove setOnClickListener(...) blocks from onCreate linear execution so click handlers only run on tap.
  let result = "";
  let i = 0;
  const re = /(?:[A-Za-z_][A-Za-z0-9_]*|findViewById\s*\([^)]*\))\s*\.\s*setOnClickListener\s*\(/g;
  let m = re.exec(body);
  while (m) {
    result += body.slice(i, m.index);
    const parenOpen = body.indexOf("(", m.index + m[0].length - 1);
    const parenClose = findMatchingParen(body, parenOpen);
    let end = parenClose + 1;
    // Handle Kotlin trailing lambda setOnClickListener { ... }
    if (body.charAt(parenClose - 1) === "(" && body.slice(end).trim().charAt(0) === "{") {
      const braceIdx = body.indexOf("{", end);
      end = findBraceBlock(body, braceIdx).endIndex;
    }
    if (body.charAt(end) === ";") end++;
    i = end;
    re.lastIndex = end;
    m = re.exec(body);
  }
  result += body.slice(i);
  return result;
}

export function parseActivityClass(source: string): ParsedActivityInfo {
  const clsMatch = /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(source);
  const className = clsMatch ? clsMatch[1] : "MainActivity";
  const layoutMatch = /\bsetContentView\s*\(\s*R\.layout\.([A-Za-z_][A-Za-z0-9_]*)\s*\)/.exec(source);
  const isCompose = /\bsetContent\s*\{/.test(source) && !layoutMatch;
  const layoutName = layoutMatch ? layoutMatch[1] : "activity_main";

  const varToViewId: Record<string, string> = {};
  const findRe = /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:\([^)]+\)\s*)?findViewById(?:<[^>]+>)?\s*\(\s*R\.id\.([A-Za-z_][A-Za-z0-9_]*)\s*\)/g;
  let fm = findRe.exec(source);
  while (fm) {
    varToViewId[fm[1]] = fm[2];
    fm = findRe.exec(source);
  }

  // Class-level field initializers like `private int count = 0;` or `private var count = 0`
  const fieldDecls: Array<{ name: string; expr: string }> = [];
  const clsBraceIdx = source.indexOf("{", clsMatch ? clsMatch.index : 0);
  const classBody = clsBraceIdx >= 0 ? findBraceBlock(source, clsBraceIdx).body : source;
  const headerPart = classBody.split(/\b(?:override\s+fun|protected\s+void|public\s+void|void|fun)\s+onCreate\b/)[0] || "";
  const fieldRe = /(?:private|public|protected)?\s*(?:int|double|float|long|boolean|String|val|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^;\n]+);?/g;
  let fld = fieldRe.exec(headerPart);
  while (fld) {
    if (fld[2].indexOf("findViewById") < 0 && fld[2].indexOf("mutableStateOf") < 0) {
      fieldDecls.push({ name: fld[1], expr: fld[2].trim() });
    }
    fld = fieldRe.exec(headerPart);
  }

  // Extract onCreate body
  let onCreateBody = "";
  const onCreateMatch = /\bonCreate\s*\([^)]*\)\s*\{/.exec(source);
  if (onCreateMatch) {
    const braceIdx = source.indexOf("{", onCreateMatch.index);
    const fullOnCreate = findBraceBlock(source, braceIdx).body;
    onCreateBody = stripListenersFromBody(fullOnCreate);
  }

  // Extract setOnClickListener bindings (lambda, anonymous OnClickListener, Kotlin trailing lambda)
  const clickHandlersByViewId: Record<string, string> = {};
  const listenerRe = /([A-Za-z_][A-Za-z0-9_]*|findViewById\s*\(\s*R\.id\.[A-Za-z_][A-Za-z0-9_]*\s*\))\s*\.\s*setOnClickListener\s*(?:\(|\{)/g;
  let lm = listenerRe.exec(source);
  while (lm) {
    const targetRaw = lm[1].trim();
    const directIdMatch = /R\.id\.([A-Za-z_][A-Za-z0-9_]*)/.exec(targetRaw);
    const viewId = directIdMatch ? directIdMatch[1] : varToViewId[targetRaw];
    const delim = source.charAt(lm.index + lm[0].length - 1);
    let body = "";
    if (delim === "{") {
      body = findBraceBlock(source, lm.index + lm[0].length - 1).body;
    } else {
      const parenOpen = lm.index + lm[0].length - 1;
      const parenClose = findMatchingParen(source, parenOpen);
      const inner = source.slice(parenOpen + 1, parenClose);
      // Look for either `public void onClick(...) { ... }` or `v -> { ... }`
      const onClickMatch = /\bonClick\s*\([^)]*\)\s*\{/.exec(inner);
      if (onClickMatch) {
        body = findBraceBlock(inner, inner.indexOf("{", onClickMatch.index)).body;
      } else {
        const lambdaBrace = inner.indexOf("{");
        if (lambdaBrace >= 0) {
          body = findBraceBlock(inner, lambdaBrace).body;
        } else {
          const arrowIdx = inner.indexOf("->");
          if (arrowIdx >= 0) {
            body = inner.slice(arrowIdx + 2).trim();
          }
        }
      }
      // If Kotlin empty parens setOnClickListener() { ... }
      if (!body) {
        const afterParen = source.slice(parenClose + 1).trim();
        if (afterParen.charAt(0) === "{") {
          body = findBraceBlock(source, source.indexOf("{", parenClose + 1)).body;
        }
      }
    }
    if (viewId && body.trim()) {
      clickHandlersByViewId[viewId] = body;
    }
    lm = listenerRe.exec(source);
  }

  // Extract named XML onClick methods: public void handleClick(View v) { ... }
  const namedMethods: Record<string, string> = {};
  const methodRe = /(?:public|private|protected)?\s*(?:void|fun)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*(?:View\s+[A-Za-z_]\w*|[A-Za-z_]\w*\s*:\s*View)\s*\)\s*\{/g;
  let mm = methodRe.exec(source);
  while (mm) {
    const braceIdx = source.indexOf("{", mm.index);
    namedMethods[mm[1]] = findBraceBlock(source, braceIdx).body;
    mm = methodRe.exec(source);
  }

  return {
    className,
    layoutName,
    isCompose,
    fieldDecls,
    varToViewId,
    onCreateBody,
    clickHandlersByViewId,
    namedMethods,
  };
}

interface ExecContext {
  frame: ActivityBackStackFrame;
  varToViewId: Record<string, string>;
  intents: Record<string, { targetActivity: string; extras: Record<string, string> }>;
  resources: AndroidResources;
  manifest: ParsedManifest;
  logs: RuntimeLogEntry[];
  stdout: string[];
  toasts: ToastNotice[];
  pendingStartActivity: { activityName: string; extras: Record<string, string> } | null;
  pendingFinish: boolean;
  returned: boolean;
  xmlInitialTexts: Record<string, string>;
  seq: number;
  integerPreferences?: Record<string, number>;
}

function getLiveWidgetText(ctx: ExecContext, viewId: string): string {
  if (ctx.frame.inputValues[viewId] !== undefined) return ctx.frame.inputValues[viewId];
  if (ctx.frame.widgetTextOverrides[viewId] !== undefined) return ctx.frame.widgetTextOverrides[viewId];
  return ctx.xmlInitialTexts[viewId] ?? "";
}

function splitTopLevelArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = "";
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let inDouble = false;
  let inSingle = false;

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr.charAt(i);
    if (inDouble) {
      current += ch;
      if (ch === "\\" && i + 1 < argsStr.length) {
        current += argsStr.charAt(++i);
        continue;
      }
      if (ch === '"') inDouble = false;
      continue;
    }
    if (inSingle) {
      current += ch;
      if (ch === "\\" && i + 1 < argsStr.length) {
        current += argsStr.charAt(++i);
        continue;
      }
      if (ch === "'") inSingle = false;
      continue;
    }
    if (ch === '"') inDouble = true;
    else if (ch === "'") inSingle = true;
    else if (ch === "(") parenDepth++;
    else if (ch === ")") parenDepth--;
    else if (ch === "{") braceDepth++;
    else if (ch === "}") braceDepth--;
    else if (ch === "[") bracketDepth++;
    else if (ch === "]") bracketDepth--;
    else if (ch === "," && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
      if (current.trim()) args.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function evalSimpleJavaExpr(rawExpr: string, ctx: ExecContext): string | number | boolean {
  const expr = rawExpr.trim();
  if (!expr) return "";

  // String literal
  if (/^"(?:\\.|[^"\\])*"$/.test(expr)) {
    const raw = expr.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    // Support Kotlin string templates $var and ${expr}
    return raw.replace(/\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (_all, braced: string, simple: string) => {
      return String(evalSimpleJavaExpr(braced || simple, ctx));
    });
  }
  if (/^-?\d+(\.\d+)?$/.test(expr)) {
    return Number(expr);
  }
  if (expr === "true") return true;
  if (expr === "false") return false;
  if (expr === "null") return "";

  // Parenthesized expression
  if (expr.charAt(0) === "(" && findMatchingParen(expr, 0) === expr.length - 1) {
    return evalSimpleJavaExpr(expr.slice(1, -1), ctx);
  }

  // Unary !
  if (expr.charAt(0) === "!" && expr.charAt(1) !== "=") {
    return !Boolean(evalSimpleJavaExpr(expr.slice(1), ctx));
  }

  // Find lowest-precedence binary operators outside quotes & parens
  function findOp(ops: string[]): { idx: number; op: string } | null {
    let paren = 0;
    let inD = false;
    let inS = false;
    for (let i = expr.length - 1; i >= 0; i--) {
      const ch = expr.charAt(i);
      if (ch === '"' && (i === 0 || expr.charAt(i - 1) !== "\\") && !inS) {
        inD = !inD;
        continue;
      }
      if (ch === "'" && (i === 0 || expr.charAt(i - 1) !== "\\") && !inD) {
        inS = !inS;
        continue;
      }
      if (inD || inS) continue;
      if (ch === ")") paren++;
      else if (ch === "(") paren--;
      if (paren !== 0) continue;

      for (let o = 0; o < ops.length; o++) {
        const op = ops[o];
        if (i - op.length + 1 >= 0 && expr.slice(i - op.length + 1, i + 1) === op) {
          const startIdx = i - op.length + 1;
          // Avoid matching `==` when looking for `<`/`>`, or `||` when looking for `|`
          if (op === "+" && startIdx === 0) continue;
          if (op === "-" && (startIdx === 0 || /[+\-*/%(<>=!&|,]/.test(expr.slice(0, startIdx).trim().slice(-1)))) {
            continue;
          }
          if ((op === ">" || op === "<") && expr.charAt(startIdx + 1) === "=") continue;
          if ((op === "=" || op === "!") && expr.charAt(startIdx + 1) !== "=") continue;
          return { idx: startIdx, op };
        }
      }
    }
    return null;
  }

  const orOp = findOp(["||"]);
  if (orOp) {
    return (
      Boolean(evalSimpleJavaExpr(expr.slice(0, orOp.idx), ctx)) ||
      Boolean(evalSimpleJavaExpr(expr.slice(orOp.idx + 2), ctx))
    );
  }
  const andOp = findOp(["&&"]);
  if (andOp) {
    return (
      Boolean(evalSimpleJavaExpr(expr.slice(0, andOp.idx), ctx)) &&
      Boolean(evalSimpleJavaExpr(expr.slice(andOp.idx + 2), ctx))
    );
  }
  const cmpOp = findOp(["==", "!=", "<=", ">=", "<", ">"]);
  if (cmpOp) {
    const l = evalSimpleJavaExpr(expr.slice(0, cmpOp.idx), ctx);
    const r = evalSimpleJavaExpr(expr.slice(cmpOp.idx + cmpOp.op.length), ctx);
    if (cmpOp.op === "==") return l == r;
    if (cmpOp.op === "!=") return l != r;
    if (cmpOp.op === "<=") return Number(l) <= Number(r);
    if (cmpOp.op === ">=") return Number(l) >= Number(r);
    if (cmpOp.op === "<") return Number(l) < Number(r);
    return Number(l) > Number(r);
  }
  const addOp = findOp(["+", "-"]);
  if (addOp) {
    const l = evalSimpleJavaExpr(expr.slice(0, addOp.idx), ctx);
    const r = evalSimpleJavaExpr(expr.slice(addOp.idx + 1), ctx);
    if (addOp.op === "+") {
      if (typeof l === "string" || typeof r === "string") {
        return String(l) + String(r);
      }
      return Number(l) + Number(r);
    }
    return Number(l) - Number(r);
  }
  const mulOp = findOp(["*", "/", "%"]);
  if (mulOp) {
    const l = Number(evalSimpleJavaExpr(expr.slice(0, mulOp.idx), ctx));
    const r = Number(evalSimpleJavaExpr(expr.slice(mulOp.idx + 1), ctx));
    if (mulOp.op === "*") return l * r;
    if (mulOp.op === "%") {
      if (r === 0) throw new Error("ArithmeticException: / by zero");
      return l % r;
    }
    if (r === 0) throw new Error("ArithmeticException: / by zero");
    return l / r;
  }

  const getPref = /^getSharedPreferences\(\s*"([^"]+)"\s*,\s*MODE_PRIVATE\s*\)\.getInt\(\s*"([^"]+)"\s*,\s*([\s\S]+)\)$/.exec(expr);
  if (getPref) {
    return ctx.integerPreferences?.[JSON.stringify([getPref[1], getPref[2]])]
      ?? Number(evalSimpleJavaExpr(getPref[3], ctx));
  }

  // Built-in Android & Java helper calls
  const parseIntM = /^(?:Integer\.parseInt|Double\.parseDouble|Float\.parseFloat)\s*\(([\s\S]+)\)$/.exec(expr);
  if (parseIntM) {
    const argVal = String(evalSimpleJavaExpr(parseIntM[1], ctx)).trim();
    if (!argVal || isNaN(Number(argVal))) {
      throw new Error(`NumberFormatException: For input string: "${argVal}"`);
    }
    return expr.indexOf("Integer.parseInt") === 0 ? parseInt(argVal, 10) : parseFloat(argVal);
  }

  const strValM = /^(?:String\.valueOf|Integer\.toString|Double\.toString)\s*\(([\s\S]+)\)$/.exec(expr);
  if (strValM) {
    return String(evalSimpleJavaExpr(strValM[1], ctx));
  }

  const mathRoundM = /^Math\.(round|sqrt|abs|floor|ceil)\s*\(([\s\S]+)\)$/.exec(expr);
  if (mathRoundM) {
    const v = Number(evalSimpleJavaExpr(mathRoundM[2], ctx));
    if (mathRoundM[1] === "round") return Math.round(v);
    if (mathRoundM[1] === "sqrt") return Math.sqrt(v);
    if (mathRoundM[1] === "abs") return Math.abs(v);
    if (mathRoundM[1] === "floor") return Math.floor(v);
    return Math.ceil(v);
  }

  const getStringResM = /^getString\s*\(\s*R\.string\.([A-Za-z_][A-Za-z0-9_]*)\s*\)$/.exec(expr);
  if (getStringResM) {
    return ctx.resources.strings[getStringResM[1]] ?? "";
  }

  const extraStrM = /^(?:getIntent\(\)|intent)\s*\.\s*getStringExtra\s*\(([\s\S]+)\)$/.exec(expr);
  if (extraStrM) {
    const key = String(evalSimpleJavaExpr(extraStrM[1], ctx));
    return ctx.frame.extras[key] ?? "";
  }

  const extraIntM = /^(?:getIntent\(\)|intent)\s*\.\s*getIntExtra\s*\(([\s\S]+)\)$/.exec(expr);
  if (extraIntM) {
    const args = splitTopLevelArgs(extraIntM[1]);
    const key = String(evalSimpleJavaExpr(args[0] || '""', ctx));
    const defVal = args[1] ? Number(evalSimpleJavaExpr(args[1], ctx)) : 0;
    const raw = ctx.frame.extras[key];
    return raw !== undefined && raw !== "" && !isNaN(Number(raw)) ? Number(raw) : defVal;
  }

  // View reads: findViewById(R.id.etName).getText().toString().trim() or var.getText().toString()
  const directFindGetText = /^findViewById(?:<[^>]+>)?\s*\(\s*R\.id\.([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*\.\s*(?:getText\(\)|text)(?:\.toString\(\))?(.*)$/.exec(expr);
  if (directFindGetText) {
    return applyStringSuffix(getLiveWidgetText(ctx, directFindGetText[1]), directFindGetText[2], ctx);
  }

  const varGetText = /^([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*(?:getText\(\)|text)(?:\.toString\(\))?(.*)$/.exec(expr);
  if (varGetText && ctx.varToViewId[varGetText[1]]) {
    const viewId = ctx.varToViewId[varGetText[1]];
    return applyStringSuffix(getLiveWidgetText(ctx, viewId), varGetText[2], ctx);
  }

  const isCheckedM = /^([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*isChecked\s*\(\s*\)$/.exec(expr);
  if (isCheckedM && ctx.varToViewId[isCheckedM[1]]) {
    return Boolean(ctx.frame.checkedValues[ctx.varToViewId[isCheckedM[1]]]);
  }

  const methodOnVarM = /^([A-Za-z_][A-Za-z0-9_]*)(\.[A-Za-z_][\s\S]+)$/.exec(expr);
  if (methodOnVarM && ctx.frame.stateVars[methodOnVarM[1]] !== undefined) {
    return applyStringSuffix(String(ctx.frame.stateVars[methodOnVarM[1]]), methodOnVarM[2], ctx);
  }

  const ridM = /^R\.id\.([A-Za-z_][A-Za-z0-9_]*)$/.exec(expr);
  if (ridM) {
    return "id:" + ridM[1];
  }

  if (ctx.frame.stateVars[expr] !== undefined) {
    return ctx.frame.stateVars[expr];
  }

  return expr.replace(/^"|"$/g, "");
}

function applyStringSuffix(baseVal: string, chain: string, ctx: ExecContext): string | number | boolean {
  let cur: string | number | boolean = baseVal;
  let rest = chain.trim();
  while (rest.charAt(0) === ".") {
    if (rest.indexOf(".trim()") === 0) {
      cur = String(cur).trim();
      rest = rest.slice(".trim()".length).trim();
    } else if (rest.indexOf(".isEmpty()") === 0) {
      cur = String(cur).length === 0;
      rest = rest.slice(".isEmpty()".length).trim();
    } else if (rest.indexOf(".length()") === 0 || rest.indexOf(".length") === 0) {
      cur = String(cur).length;
      rest = rest.slice(rest.indexOf(".length()") === 0 ? 9 : 7).trim();
    } else if (rest.indexOf(".toUpperCase()") === 0) {
      cur = String(cur).toUpperCase();
      rest = rest.slice(".toUpperCase()".length).trim();
    } else if (rest.indexOf(".toLowerCase()") === 0) {
      cur = String(cur).toLowerCase();
      rest = rest.slice(".toLowerCase()".length).trim();
    } else if (rest.indexOf(".equalsIgnoreCase(") === 0 || rest.indexOf(".equals(") === 0 || rest.indexOf(".contains(") === 0) {
      const parenIdx = rest.indexOf("(");
      const endParen = findMatchingParen(rest, parenIdx);
      const arg = String(evalSimpleJavaExpr(rest.slice(parenIdx + 1, endParen), ctx));
      if (rest.indexOf(".equalsIgnoreCase(") === 0) {
        cur = String(cur).toLowerCase() === arg.toLowerCase();
      } else if (rest.indexOf(".equals(") === 0) {
        cur = String(cur) === arg;
      } else {
        cur = String(cur).indexOf(arg) >= 0;
      }
      rest = rest.slice(endParen + 1).trim();
    } else {
      break;
    }
  }
  return cur;
}

type AstStatement =
  | { kind: "if"; cond: string; thenBlock: string; elseBlock?: string }
  | { kind: "simple"; text: string };

function splitStatements(body: string): AstStatement[] {
  const stmts: AstStatement[] = [];
  let i = 0;
  const n = body.length;

  function skipWsAndComments() {
    while (i < n) {
      const ch = body.charAt(i);
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (body.substr(i, 2) === "//") {
        const nl = body.indexOf("\n", i);
        i = nl < 0 ? n : nl + 1;
        continue;
      }
      if (body.substr(i, 2) === "/*") {
        const end = body.indexOf("*/", i + 2);
        i = end < 0 ? n : end + 2;
        continue;
      }
      break;
    }
  }

  while (i < n) {
    skipWsAndComments();
    if (i >= n) break;

    if (body.slice(i).indexOf("if") === 0 && !/[A-Za-z0-9_]/.test(body.charAt(i + 2) || "")) {
      const parenIdx = body.indexOf("(", i + 2);
      if (parenIdx >= 0) {
        const parenClose = findMatchingParen(body, parenIdx);
        const cond = body.slice(parenIdx + 1, parenClose).trim();
        let after = parenClose + 1;
        while (after < n && /\s/.test(body.charAt(after))) after++;
        let thenBlock = "";
        if (body.charAt(after) === "{") {
          const blk = findBraceBlock(body, after);
          thenBlock = blk.body;
          i = blk.endIndex;
        } else {
          const semi = body.indexOf(";", after);
          thenBlock = semi >= 0 ? body.slice(after, semi + 1) : body.slice(after);
          i = semi >= 0 ? semi + 1 : n;
        }
        skipWsAndComments();
        let elseBlock: string | undefined;
        if (body.slice(i).indexOf("else") === 0 && !/[A-Za-z0-9_]/.test(body.charAt(i + 4) || "")) {
          let afterElse = i + 4;
          while (afterElse < n && /\s/.test(body.charAt(afterElse))) afterElse++;
          if (body.charAt(afterElse) === "{") {
            const eBlk = findBraceBlock(body, afterElse);
            elseBlock = eBlk.body;
            i = eBlk.endIndex;
          } else {
            // else if (...) { ... }
            const restStmts = body.slice(afterElse);
            const semiOrBrace = restStmts.indexOf("{");
            if (/^if\s*\(/.test(restStmts) && semiOrBrace >= 0) {
              const innerBlk = findBraceBlock(body, afterElse + semiOrBrace);
              elseBlock = body.slice(afterElse, innerBlk.endIndex);
              i = innerBlk.endIndex;
            } else {
              const semi = body.indexOf(";", afterElse);
              elseBlock = semi >= 0 ? body.slice(afterElse, semi + 1) : body.slice(afterElse);
              i = semi >= 0 ? semi + 1 : n;
            }
          }
        }
        stmts.push({ kind: "if", cond, thenBlock, elseBlock });
        continue;
      }
    }

    // Read a single statement terminated by `;` (or newline for Kotlin when parens balanced)
    let start = i;
    let inD = false;
    let inS = false;
    let paren = 0;
    let brace = 0;
    while (i < n) {
      const ch = body.charAt(i);
      if (inD) {
        if (ch === "\\") {
          i += 2;
          continue;
        }
        if (ch === '"') inD = false;
        i++;
        continue;
      }
      if (inS) {
        if (ch === "\\") {
          i += 2;
          continue;
        }
        if (ch === "'") inS = false;
        i++;
        continue;
      }
      if (ch === '"') inD = true;
      else if (ch === "'") inS = true;
      else if (ch === "(") paren++;
      else if (ch === ")") paren = Math.max(0, paren - 1);
      else if (ch === "{") brace++;
      else if (ch === "}") brace = Math.max(0, brace - 1);
      else if (ch === ";" && paren === 0 && brace === 0) {
        const text = body.slice(start, i).trim();
        if (text) stmts.push({ kind: "simple", text });
        i++;
        start = i;
        break;
      } else if (ch === "\n" && paren === 0 && brace === 0) {
        const soFar = body.slice(start, i).trim();
        const endsWithChain = /[+\-*/=.,(&|]$/.test(soFar);
        if (soFar && !endsWithChain && !/\b(?:val|var|int|double|String|boolean)\s*$/.test(soFar)) {
          // Peek next non-whitespace line to see if it starts with `.`
          let k = i + 1;
          while (k < n && (body.charAt(k) === " " || body.charAt(k) === "\t")) k++;
          if (body.charAt(k) !== ".") {
            stmts.push({ kind: "simple", text: soFar });
            i++;
            start = i;
            break;
          }
        }
      }
      i++;
    }
    if (i >= n) {
      const tail = body.slice(start).trim();
      if (tail) stmts.push({ kind: "simple", text: tail });
    }
  }

  return stmts;
}

function executeBlock(body: string, ctx: ExecContext, depth = 0): void {
  if (depth > 8 || ctx.returned || ctx.pendingFinish || ctx.pendingStartActivity) return;
  const stmts = splitStatements(body);
  for (let i = 0; i < stmts.length; i++) {
    if (ctx.returned || ctx.pendingFinish || ctx.pendingStartActivity) return;
    const stmt = stmts[i];
    if (stmt.kind === "if") {
      if (Boolean(evalSimpleJavaExpr(stmt.cond, ctx))) {
        executeBlock(stmt.thenBlock, ctx, depth + 1);
      } else if (stmt.elseBlock) {
        executeBlock(stmt.elseBlock, ctx, depth + 1);
      }
      continue;
    }

    const line = stmt.text.trim();
    if (!line || line.indexOf("super.onCreate") === 0 || line.indexOf("setContentView") === 0 || line.indexOf("EdgeToEdge") === 0) {
      continue;
    }
    if (line === "return") {
      ctx.returned = true;
      return;
    }
    if (line === "finish()") {
      ctx.pendingFinish = true;
      return;
    }

    const putPref = /^getSharedPreferences\(\s*"([^"]+)"\s*,\s*MODE_PRIVATE\s*\)\.edit\(\)\.putInt\(\s*"([^"]+)"\s*,\s*([\s\S]+)\)\.apply\(\)$/.exec(line);
    if (putPref && ctx.integerPreferences) {
      ctx.integerPreferences[JSON.stringify([putPref[1], putPref[2]])] = Number(evalSimpleJavaExpr(putPref[3], ctx)) | 0;
      continue;
    }

    // findViewById bindings encountered inside helper methods or onCreate
    const findM = /^(?:[A-Za-z_][\w<>]*\s+)?([A-Za-z_]\w*)\s*=\s*(?:\([^)]+\)\s*)?findViewById(?:<[^>]+>)?\s*\(\s*R\.id\.([A-Za-z_]\w*)\s*\)$/.exec(line);
    if (findM) {
      ctx.varToViewId[findM[1]] = findM[2];
      continue;
    }

    // Intent creation: Intent intent = new Intent(MainActivity.this, SecondActivity.class)
    const intentNewM = /^(?:(?:Intent|val|var)\s+)?([A-Za-z_]\w*)\s*=\s*(?:new\s+)?Intent\s*\(\s*[^,]+,\s*([A-Za-z0-9_.]+?)(?:\.class|::class\.java)\s*\)$/.exec(line);
    if (intentNewM) {
      ctx.intents[intentNewM[1]] = {
        targetActivity: normalizeActivityClassName(intentNewM[2]),
        extras: {},
      };
      continue;
    }

    // intent.putExtra("key", val)
    const putExtraM = /^([A-Za-z_]\w*)\s*\.\s*putExtra\s*\(([\s\S]+)\)$/.exec(line);
    if (putExtraM && ctx.intents[putExtraM[1]]) {
      const args = splitTopLevelArgs(putExtraM[2]);
      if (args.length >= 2) {
        const key = String(evalSimpleJavaExpr(args[0], ctx));
        const val = String(evalSimpleJavaExpr(args[1], ctx));
        ctx.intents[putExtraM[1]].extras[key] = val;
      }
      continue;
    }

    // startActivity(intent) or startActivity(new Intent(..., SecondActivity.class))
    const startInlineM = /^startActivity\s*\(\s*(?:new\s+)?Intent\s*\(\s*[^,]+,\s*([A-Za-z0-9_.]+?)(?:\.class|::class\.java)\s*\)\s*\)$/.exec(line);
    if (startInlineM) {
      ctx.pendingStartActivity = {
        activityName: normalizeActivityClassName(startInlineM[1]),
        extras: {},
      };
      return;
    }
    const startVarM = /^startActivity\s*\(\s*([A-Za-z_]\w*)\s*\)$/.exec(line);
    if (startVarM && ctx.intents[startVarM[1]]) {
      ctx.pendingStartActivity = {
        activityName: ctx.intents[startVarM[1]].targetActivity,
        extras: { ...ctx.intents[startVarM[1]].extras },
      };
      return;
    }

    // view.setText(...) or findViewById(R.id.id).setText(...)
    const setTextDirect = /^findViewById(?:<[^>]+>)?\s*\(\s*R\.id\.([A-Za-z_]\w*)\s*\)\s*\.\s*setText\s*\(([\s\S]+)\)$/.exec(line);
    if (setTextDirect) {
      const val = String(evalSimpleJavaExpr(setTextDirect[2], ctx));
      ctx.frame.widgetTextOverrides[setTextDirect[1]] = val;
      if (ctx.frame.inputValues[setTextDirect[1]] !== undefined) {
        ctx.frame.inputValues[setTextDirect[1]] = val;
      }
      continue;
    }
    const setTextVar = /^([A-Za-z_]\w*)\s*\.\s*(?:setText\s*\(([\s\S]+)\)|text\s*=\s*([\s\S]+))$/.exec(line);
    if (setTextVar && ctx.varToViewId[setTextVar[1]]) {
      const viewId = ctx.varToViewId[setTextVar[1]];
      const val = String(evalSimpleJavaExpr(setTextVar[2] ?? setTextVar[3], ctx));
      ctx.frame.widgetTextOverrides[viewId] = val;
      if (ctx.frame.inputValues[viewId] !== undefined) {
        ctx.frame.inputValues[viewId] = val;
      }
      continue;
    }

    // view.setVisibility(View.GONE | INVISIBLE | VISIBLE)
    const setVisM = /^([A-Za-z_]\w*)\s*\.\s*setVisibility\s*\(\s*View\.(VISIBLE|INVISIBLE|GONE)\s*\)$/.exec(line);
    if (setVisM && ctx.varToViewId[setVisM[1]]) {
      ctx.frame.visibilityOverrides[ctx.varToViewId[setVisM[1]]] =
        setVisM[2].toLowerCase() as "visible" | "invisible" | "gone";
      continue;
    }

    // Toast.makeText(ctx, expr, ...).show()
    const toastM = /^Toast\s*\.\s*makeText\s*\(([\s\S]+)\)\s*(?:\.\s*show\s*\(\s*\))?$/.exec(line);
    if (toastM) {
      const args = splitTopLevelArgs(toastM[1]);
      if (args.length >= 2) {
        const msg = String(evalSimpleJavaExpr(args[1], ctx));
        ctx.toasts.push({
          id: `toast-${Date.now()}-${ctx.seq++}`,
          message: msg,
          timestamp: Date.now(),
        });
        ctx.logs.push(makeLog("I", "Toast", ctx.manifest.packageName, msg, ctx.seq++));
      }
      continue;
    }

    // Log.d(tag, msg)
    const logM = /^Log\s*\.\s*(v|d|i|w|e|wtf)\s*\(([\s\S]+)\)$/.exec(line);
    if (logM) {
      const args = splitTopLevelArgs(logM[2]);
      if (args.length >= 2) {
        const tag = String(evalSimpleJavaExpr(args[0], ctx));
        const msg = String(evalSimpleJavaExpr(args[1], ctx));
        const char = logM[1].toUpperCase();
        const level: RuntimeLogEntry["level"] = char === "WTF" ? "A" : (char as RuntimeLogEntry["level"]);
        ctx.logs.push(makeLog(level, tag, ctx.manifest.packageName, msg, ctx.seq++));
      }
      continue;
    }

    // System.out.println(...) / println(...)
    const printM = /^(?:System\.out\.)?println\s*\(([\s\S]+)\)$/.exec(line);
    if (printM) {
      const msg = String(evalSimpleJavaExpr(printM[1], ctx));
      ctx.stdout.push(msg);
      ctx.logs.push(makeLog("I", "System.out", ctx.manifest.packageName, msg, ctx.seq++));
      continue;
    }

    // Increment / decrement: count++ / count--
    const incM = /^([A-Za-z_]\w*)\s*(\+\+|--)$/.exec(line);
    if (incM) {
      const prev = Number(ctx.frame.stateVars[incM[1]] ?? 0);
      ctx.frame.stateVars[incM[1]] = incM[2] === "++" ? prev + 1 : prev - 1;
      continue;
    }

    // Compound assignment += / -=
    const compAssignM = /^([A-Za-z_]\w*)\s*(\+=|-=|\*=)\s*([\s\S]+)$/.exec(line);
    if (compAssignM) {
      const cur = ctx.frame.stateVars[compAssignM[1]] ?? 0;
      const rhs = evalSimpleJavaExpr(compAssignM[3], ctx);
      if (compAssignM[2] === "+=") {
        ctx.frame.stateVars[compAssignM[1]] =
          typeof cur === "string" || typeof rhs === "string"
            ? String(cur) + String(rhs)
            : Number(cur) + Number(rhs);
      } else if (compAssignM[2] === "-=") {
        ctx.frame.stateVars[compAssignM[1]] = Number(cur) - Number(rhs);
      } else {
        ctx.frame.stateVars[compAssignM[1]] = Number(cur) * Number(rhs);
      }
      continue;
    }

    // Variable declaration or assignment: [Type] name = expr
    const assignM = /^(?:(?:final|val|var|int|double|float|long|boolean|String|CharSequence)\s+)?([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/.exec(line);
    if (assignM) {
      ctx.frame.stateVars[assignM[1]] = evalSimpleJavaExpr(assignM[2], ctx);
    }
  }
}

export function findActivitySourceFile(files: BasicLayoutFileInput[], activityName: string): BasicLayoutFileInput | undefined {
  const short = normalizeActivityClassName(activityName);
  return (
    files.find((f) => f.name === short || f.name === short + ".java" || f.name === short + ".kt") ||
    files.find((f) => (f.path || "").endsWith("/" + short + ".java") || (f.path || "").endsWith("/" + short + ".kt")) ||
    files.find((f) => new RegExp(`\\bclass\\s+${short}\\b`).test(f.content))
  );
}

function collectInitialXmlTexts(root: XmlLayoutElement | null, resources: AndroidResources): {
  texts: Record<string, string>;
  inputs: Record<string, string>;
  checked: Record<string, boolean>;
} {
  const texts: Record<string, string> = {};
  const inputs: Record<string, string> = {};
  const checked: Record<string, boolean> = {};

  function walk(el: XmlLayoutElement | null) {
    if (!el) return;
    const val = el.attrs["android:text"] !== undefined ? resolveResourceValue(el.attrs["android:text"], resources) : "";
    if (el.id) {
      texts[el.id] = val;
      if (el.shortTag === "EditText") inputs[el.id] = val;
      if (el.shortTag === "CheckBox" || el.shortTag === "Switch" || el.shortTag === "RadioButton") {
        checked[el.id] = el.attrs["android:checked"] === "true";
      }
    }
    for (let i = 0; i < el.children.length; i++) walk(el.children[i]);
  }
  walk(root);
  return { texts, inputs, checked };
}

function createActivityFrame(
  files: BasicLayoutFileInput[],
  manifest: ParsedManifest,
  activityName: string,
  extras: Record<string, string>,
  existingToasts: ToastNotice[],
  integerPreferences: Record<string, number> = {},
): RuntimeStepResult & { frame: ActivityBackStackFrame } {
  const resources = parseAndroidResources(files);
  const srcFile = findActivitySourceFile(files, activityName);
  const logs: RuntimeLogEntry[] = [];
  const stdout: string[] = [];
  let seq = 1;

  if (manifest.declaredActivities.indexOf(activityName) < 0 && srcFile) {
    // Declared check only rejects explicit Intent jumps; fallback warns for launcher
    logs.push(
      makeLog(
        "W",
        "PackageParser",
        manifest.packageName,
        `Activity ${activityName} not explicitly listed in AndroidManifest.xml`,
        seq++
      )
    );
  }

  const parsedInfo = srcFile ? parseActivityClass(srcFile.content) : null;
  const layoutName = parsedInfo ? parsedInfo.layoutName : "activity_main";
  const layoutFile =
    files.find((f) => f.name === `${layoutName}.xml` || (f.path || "").endsWith(`/${layoutName}.xml`)) ||
    files.find((f) => (f.path || "").indexOf("res/layout/") >= 0);
  const layoutFilePath = layoutFile?.path || layoutFile?.name || `app/src/main/res/layout/${layoutName}.xml`;

  const parsedXml = layoutFile ? parseAndroidLayoutXml(layoutFile.content) : { root: null, errors: [] };
  const initialXml = collectInitialXmlTexts(parsedXml.root, resources);

  const frame: ActivityBackStackFrame = {
    activityName,
    layoutFilePath,
    layoutName,
    extras,
    stateVars: {},
    widgetTextOverrides: {},
    inputValues: initialXml.inputs,
    checkedValues: initialXml.checked,
    visibilityOverrides: {},
  };

  if (parsedInfo) {
    for (let i = 0; i < parsedInfo.fieldDecls.length; i++) {
      const f = parsedInfo.fieldDecls[i];
      try {
        frame.stateVars[f.name] = evalSimpleJavaExpr(f.expr, {
          frame,
          varToViewId: parsedInfo.varToViewId,
          intents: {},
          resources,
          manifest,
          logs: [],
          stdout: [],
          toasts: [],
          pendingStartActivity: null,
          pendingFinish: false,
          returned: false,
          xmlInitialTexts: initialXml.texts,
          seq: 1,
        });
      } catch {
        frame.stateVars[f.name] = f.expr;
      }
    }
  }

  logs.push(
    makeLog(
      "I",
      "ActivityTaskManager",
      "system_process",
      `START u0 {cmp=${manifest.packageName}/.${activityName}}`,
      seq++
    )
  );

  const ctx: ExecContext = {
    frame,
    integerPreferences,
    varToViewId: parsedInfo ? parsedInfo.varToViewId : {},
    intents: {},
    resources,
    manifest,
    logs,
    stdout,
    toasts: [...existingToasts],
    pendingStartActivity: null,
    pendingFinish: false,
    returned: false,
    xmlInitialTexts: initialXml.texts,
    seq,
  };

  let error: string | null = null;
  if (parsedInfo && parsedInfo.onCreateBody) {
    try {
      executeBlock(parsedInfo.onCreateBody, ctx);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      logs.push(makeLog("E", "AndroidRuntime", manifest.packageName, `FATAL EXCEPTION: ${error}`, ctx.seq++, true));
    }
  }

  logs.push(
    makeLog(
      "I",
      "Choreographer",
      manifest.packageName,
      `Displayed ${manifest.packageName}/.${activityName}`,
      ctx.seq++
    )
  );

  const session: AndroidRuntimeSession = {
    activePackageName: manifest.packageName,
    appLabel: manifest.appLabel,
    activityStack: [frame],
    toasts: ctx.toasts.slice(-3),
    isHomeScreen: false,
    recentsOpen: false,
    crashError: error,
    lastLaunchTimeMs: Date.now(),
    integerPreferences,
  };

  return { session, frame, logs, stdout, error };
}

export function launchAndroidRuntimeSession(
  files: BasicLayoutFileInput[],
  fallbackPackage = "com.example.myapp",
  integerPreferences: Record<string, number> = {},
): RuntimeStepResult {
  const manifest = parseAndroidManifest(files, fallbackPackage);
  const launched = createActivityFrame(files, manifest, manifest.launcherActivity, {}, [], { ...integerPreferences });
  return {
    session: launched.session,
    logs: launched.logs,
    stdout: launched.stdout,
    error: launched.error,
  };
}

export function updateRuntimeInputValue(
  session: AndroidRuntimeSession,
  widgetId: string,
  value: string
): AndroidRuntimeSession {
  if (session.activityStack.length === 0) return session;
  const topIndex = session.activityStack.length - 1;
  const updatedStack = session.activityStack.map((frame, idx) =>
    idx === topIndex
      ? { ...frame, inputValues: { ...frame.inputValues, [widgetId]: value } }
      : frame
  );
  return { ...session, activityStack: updatedStack };
}

export function toggleRuntimeCheckedValue(
  session: AndroidRuntimeSession,
  widgetId: string
): AndroidRuntimeSession {
  if (session.activityStack.length === 0) return session;
  const topIndex = session.activityStack.length - 1;
  const updatedStack = session.activityStack.map((frame, idx) =>
    idx === topIndex
      ? {
          ...frame,
          checkedValues: {
            ...frame.checkedValues,
            [widgetId]: !Boolean(frame.checkedValues[widgetId]),
          },
        }
      : frame
  );
  return { ...session, activityStack: updatedStack };
}

export function dispatchRuntimeWidgetClick(
  session: AndroidRuntimeSession,
  files: BasicLayoutFileInput[],
  widgetId: string,
  onClickMethodName?: string
): RuntimeStepResult {
  if (session.activityStack.length === 0 || session.crashError) {
    return { session, logs: [], stdout: [], error: session.crashError };
  }

  const manifest = parseAndroidManifest(files, session.activePackageName);
  const resources = parseAndroidResources(files);
  const topFrame = session.activityStack[session.activityStack.length - 1];
  const clonedFrame: ActivityBackStackFrame = {
    ...topFrame,
    extras: { ...topFrame.extras },
    stateVars: { ...topFrame.stateVars },
    widgetTextOverrides: { ...topFrame.widgetTextOverrides },
    inputValues: { ...topFrame.inputValues },
    checkedValues: { ...topFrame.checkedValues },
    visibilityOverrides: { ...topFrame.visibilityOverrides },
  };

  const srcFile = findActivitySourceFile(files, clonedFrame.activityName);
  const parsedInfo = srcFile ? parseActivityClass(srcFile.content) : null;
  const layoutFile =
    files.find((f) => (f.path || f.name) === clonedFrame.layoutFilePath) ||
    files.find((f) => f.name === `${clonedFrame.layoutName}.xml`);
  const parsedXml = layoutFile ? parseAndroidLayoutXml(layoutFile.content) : { root: null, errors: [] };
  const initialXml = collectInitialXmlTexts(parsedXml.root, resources);

  const handlerBody =
    (parsedInfo && parsedInfo.clickHandlersByViewId[widgetId]) ||
    (parsedInfo && onClickMethodName ? parsedInfo.namedMethods[onClickMethodName] : "") ||
    "";

  const logs: RuntimeLogEntry[] = [];
  const stdout: string[] = [];
  const ctx: ExecContext = {
    frame: clonedFrame,
    integerPreferences: { ...session.integerPreferences },
    varToViewId: parsedInfo ? parsedInfo.varToViewId : {},
    intents: {},
    resources,
    manifest,
    logs,
    stdout,
    toasts: [...session.toasts],
    pendingStartActivity: null,
    pendingFinish: false,
    returned: false,
    xmlInitialTexts: initialXml.texts,
    seq: 1,
  };

  let error: string | null = null;
  if (handlerBody) {
    try {
      executeBlock(handlerBody, ctx);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      logs.push(makeLog("E", "AndroidRuntime", manifest.packageName, `FATAL EXCEPTION in onClick: ${error}`, ctx.seq++, true));
    }
  } else {
    logs.push(
      makeLog(
        "D",
        "View",
        manifest.packageName,
        `Touch click dispatched on @+id/${widgetId} (no setOnClickListener handler bound)`,
        ctx.seq++
      )
    );
  }

  let nextStack = [...session.activityStack.slice(0, -1), clonedFrame];
  let isHome = false;

  if (!error && ctx.pendingFinish) {
    logs.push(
      makeLog("I", clonedFrame.activityName, manifest.packageName, `onPause / finish() called`, ctx.seq++)
    );
    if (nextStack.length > 1) {
      nextStack = nextStack.slice(0, -1);
    } else {
      isHome = true;
    }
  }

  if (!error && ctx.pendingStartActivity) {
    const targetName = ctx.pendingStartActivity.activityName;
    if (manifest.declaredActivities.indexOf(targetName) < 0) {
      error = `android.content.ActivityNotFoundException: Unable to find explicit activity class {${manifest.packageName}/${manifest.packageName}.${targetName}}; have you declared this activity in your AndroidManifest.xml?`;
      logs.push(makeLog("E", "AndroidRuntime", manifest.packageName, error, ctx.seq++, true));
    } else {
      const nextAct = createActivityFrame(
        files,
        manifest,
        targetName,
        ctx.pendingStartActivity.extras,
        ctx.toasts,
        ctx.integerPreferences,
      );
      nextStack = [...nextStack, nextAct.frame];
      for (let i = 0; i < nextAct.logs.length; i++) logs.push(nextAct.logs[i]);
      for (let i = 0; i < nextAct.stdout.length; i++) stdout.push(nextAct.stdout[i]);
      if (nextAct.error) error = nextAct.error;
    }
  }

  return {
    session: {
      ...session,
      activityStack: nextStack,
      toasts: ctx.toasts.slice(-3),
      isHomeScreen: isHome,
      recentsOpen: false,
      crashError: error,
      integerPreferences: ctx.integerPreferences,
    },
    logs,
    stdout,
    error,
  };
}

export function navigateRuntimeBack(
  session: AndroidRuntimeSession
): { session: AndroidRuntimeSession; logs: RuntimeLogEntry[] } {
  if (session.recentsOpen) {
    return { session: { ...session, recentsOpen: false }, logs: [] };
  }
  if (session.crashError) {
    return {
      session: { ...session, crashError: null, isHomeScreen: true },
      logs: [],
    };
  }
  if (session.isHomeScreen) {
    return { session, logs: [] };
  }
  if (session.activityStack.length > 1) {
    const popped = session.activityStack[session.activityStack.length - 1];
    const resumed = session.activityStack[session.activityStack.length - 2];
    return {
      session: {
        ...session,
        activityStack: session.activityStack.slice(0, -1),
      },
      logs: [
        makeLog("I", "ActivityTaskManager", "system_process", `Back pressed: finished ${popped.activityName}, resumed ${resumed.activityName}`, 1),
      ],
    };
  }
  return {
    session: { ...session, isHomeScreen: true },
    logs: [
      makeLog("I", "ActivityTaskManager", "system_process", "Returned to Android Launcher Home", 1),
    ],
  };
}
