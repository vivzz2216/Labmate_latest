/** The Android side of the LabMate Kotlin runtime: it runs the student's activities for real (the View system built from layout XML,
 *  Jetpack Compose recomposition, Intents between activities, Log/Toast, SharedPreferences, an in-memory SQLite) and exposes the
 *  resulting screen as a UiNode tree the emulator draws.
 *
 *  Not Android: no real device, no threads/coroutines/network/Fragments/RecyclerView/Room. What is unsupported fails loudly. */
import { Interp, NsObj, ClassVal } from "./interp";
import type { Host } from "./interp";
import { checkKotlin } from "./checker";
import type { Diagnostic } from "./checker";
import { stdGlobal } from "./stdlib";
import { Database, SqlError } from "./sql";
import { Dbl, KEx, KList, KObj, KMap, KFun, NativeFn, NOPE, StopSig, ThrowSig, exceptionFqn, isExceptionName, num } from "./values";

// ------------------------------------------------------------------------------------------ public types
export interface UiNode {
  uid: string;
  type: string;
  props: { [k: string]: any };
  children: UiNode[];
}
export interface LogLine {
  ts: number;
  level: "V" | "D" | "I" | "W" | "E";
  tag: string;
  message: string;
  crash?: boolean;
}
export interface CrashInfo {
  kind: "exception" | "limit" | "unsupported";
  process: string;
  title: string;
  message: string;
}
export interface DialogInfo {
  title: string;
  message: string;
  buttons: { id: number; label: string }[];
}
export interface ScreenState {
  activity: string;
  label: string;
  mode: "views" | "compose" | "none";
  root: UiNode | null;
  toasts: string[];
  dialog: DialogInfo | null;
  crash: CrashInfo | null;
  canGoBack: boolean;
  version: number;
  finished: boolean;
}
export interface ProjectFile {
  path: string;
  name: string;
  kind: string;
  content: string;
  isTest?: boolean;
}

/** lowercase global functions the checker should accept (uppercase names are always accepted) */
export const ANDROID_LOWER_GLOBALS = [
  "remember", "rememberSaveable", "mutableStateOf", "mutableIntStateOf", "mutableFloatStateOf", "mutableDoubleStateOf", "mutableStateListOf",
  "mutableStateMapOf", "derivedStateOf", "setContent", "enableEdgeToEdge", "isSystemInDarkTheme", "darkColorScheme", "lightColorScheme",
  "dynamicDarkColorScheme", "dynamicLightColorScheme", "items", "item", "itemsIndexed", "rememberScrollState", "rememberLazyListState",
  "viewModel", "android", "stringResource", "painterResource", "dp", "sp", "getValue", "setValue", "by", "lifecycleScope", "arrayListOf",
];
export const ANDROID_MEMBERS = [
  "findViewById", "setContentView", "finish", "startActivity", "startActivityForResult", "getSharedPreferences", "runOnUiThread", "getString",
  "setTitle", "title", "intent", "getIntent", "applicationContext", "baseContext", "resources", "supportActionBar", "window", "setContent",
  "enableEdgeToEdge", "getSystemService", "packageName", "isFinishing", "recreate", "setResult", "onBackPressed", "layoutInflater", "assets",
  "readableDatabase", "writableDatabase", "getReadableDatabase", "getWritableDatabase", "databaseName", "close", "applicationInfo", "onBackPressedDispatcher",
  "setSupportActionBar", "getApplicationContext", "viewModelScope", "contentResolver", "getResources", "lifecycle", "application",
];

// ------------------------------------------------------------------------------------------ XML
export interface XNode {
  tag: string;
  attrs: { [k: string]: string };
  children: XNode[];
  text: string;
}
function decodeEntities(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
export function parseXml(src: string): XNode {
  let i = 0;
  const n = src.length;
  const root: XNode = { tag: "#root", attrs: {}, children: [], text: "" };
  const stack: XNode[] = [root];
  while (i < n) {
    if (src.charAt(i) !== "<") {
      const j = src.indexOf("<", i);
      const end = j < 0 ? n : j;
      stack[stack.length - 1].text += decodeEntities(src.slice(i, end));
      i = end;
      continue;
    }
    if (src.substr(i, 4) === "<!--") {
      const j = src.indexOf("-->", i);
      if (j < 0) throw new Error("Unterminated comment in XML");
      i = j + 3;
      continue;
    }
    if (src.substr(i, 2) === "<?") {
      const j = src.indexOf("?>", i);
      i = j < 0 ? n : j + 2;
      continue;
    }
    if (src.substr(i, 9) === "<![CDATA[") {
      const j = src.indexOf("]]>", i);
      stack[stack.length - 1].text += src.slice(i + 9, j < 0 ? n : j);
      i = j < 0 ? n : j + 3;
      continue;
    }
    if (src.charAt(i + 1) === "/") {
      const j = src.indexOf(">", i);
      const name = src.slice(i + 2, j).trim();
      const top = stack.pop();
      if (!top || stack.length === 0 || top.tag !== name) throw new Error("Unexpected closing tag </" + name + ">" + (top && top.tag !== "#root" ? " (expected </" + top.tag + ">)" : ""));
      i = j + 1;
      continue;
    }
    // start tag
    let j = i + 1;
    let quote = "";
    while (j < n) {
      const c = src.charAt(j);
      if (quote) {
        if (c === quote) quote = "";
      } else if (c === '"' || c === "'") quote = c;
      else if (c === ">") break;
      j++;
    }
    if (j >= n) throw new Error("Unterminated tag");
    let body = src.slice(i + 1, j);
    const selfClose = body.charAt(body.length - 1) === "/";
    if (selfClose) body = body.slice(0, -1);
    const m = /^([^\s/>]+)/.exec(body);
    if (!m) throw new Error("Malformed tag");
    const node: XNode = { tag: m[1], attrs: {}, children: [], text: "" };
    const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let am: RegExpExecArray | null;
    while ((am = re.exec(body.slice(m[1].length)))) node.attrs[am[1]] = decodeEntities(am[3] !== undefined ? am[3] : am[4]);
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
    i = j + 1;
  }
  if (stack.length > 1) throw new Error("Unclosed tag <" + stack[stack.length - 1].tag + ">");
  if (!root.children.length) throw new Error("Empty XML document");
  return root.children[0];
}

// ------------------------------------------------------------------------------------------ colours
const NAMED: { [k: string]: number } = {
  red: 0xffff0000, green: 0xff00ff00, blue: 0xff0000ff, black: 0xff000000, white: 0xffffffff, gray: 0xff888888, grey: 0xff888888,
  lightgray: 0xffcccccc, darkgray: 0xff444444, yellow: 0xffffff00, cyan: 0xff00ffff, magenta: 0xffff00ff, transparent: 0x00000000,
  aqua: 0xff00ffff, fuchsia: 0xffff00ff, lime: 0xff00ff00, maroon: 0xff800000, navy: 0xff000080, olive: 0xff808000, purple: 0xff800080,
  silver: 0xffc0c0c0, teal: 0xff008080,
};
class ColorVal {
  kType = "Color";
  argb: number;
  constructor(argb: number) {
    this.argb = argb >>> 0;
  }
  get css(): string {
    const a = ((this.argb >>> 24) & 255) / 255;
    return "rgba(" + ((this.argb >>> 16) & 255) + "," + ((this.argb >>> 8) & 255) + "," + (this.argb & 255) + "," + (Math.round(a * 1000) / 1000) + ")";
  }
  getProp(name: string): any {
    if (name === "value") return this.argb;
    return NOPE;
  }
  call(name: string, args: any[]): any {
    if (name === "copy") return new ColorVal(this.argb);
    if (name === "toString") return "Color(" + this.argb + ")";
    return NOPE;
  }
}
function parseColorString(s: string): number | null {
  const t = s.trim();
  let m = /^#([0-9a-fA-F]{6})$/.exec(t);
  if (m) return (0xff000000 | parseInt(m[1], 16)) >>> 0;
  m = /^#([0-9a-fA-F]{8})$/.exec(t);
  if (m) return parseInt(m[1], 16) >>> 0;
  m = /^#([0-9a-fA-F]{3})$/.exec(t);
  if (m) return (0xff000000 | parseInt(m[1].charAt(0) + m[1].charAt(0) + m[1].charAt(1) + m[1].charAt(1) + m[1].charAt(2) + m[1].charAt(2), 16)) >>> 0;
  const named = NAMED[t.toLowerCase()];
  return named !== undefined ? named : null;
}
function cssColor(v: any): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof ColorVal) return v.css;
  if (typeof v === "number") return new ColorVal(v).css;
  if (v instanceof Dbl) return new ColorVal(v.v).css;
  if (typeof v === "string") {
    const p = parseColorString(v);
    return p === null ? null : new ColorVal(p).css;
  }
  return null;
}

// ------------------------------------------------------------------------------------------ loose namespaces (Compose constants)
class Tok {
  kType = "Token";
  name: string;
  extra: { [k: string]: any };
  constructor(name: string, extra: { [k: string]: any } = {}) {
    this.name = name;
    this.extra = extra;
  }
  getProp(n: string): any {
    if (Object.prototype.hasOwnProperty.call(this.extra, n)) return this.extra[n];
    return new Tok(this.name + "." + n);
  }
  call(n: string, args: any[], named: any): any {
    if (n === "toString") return this.name;
    return new Tok(this.name + "." + n, { args, named });
  }
  invoke(args: any[], named: any): any {
    return new Tok(this.name + "()", { args, named });
  }
  toString(): string {
    return this.name;
  }
}

class ModObj {
  kType = "Modifier";
  ops: { n: string; a: any[]; named: any }[];
  constructor(ops: { n: string; a: any[]; named: any }[] = []) {
    this.ops = ops;
  }
  call(name: string, args: any[], named: any): any {
    if (name === "toString") return "Modifier";
    return new ModObj(this.ops.concat([{ n: name, a: args, named: named || {} }]));
  }
  getProp(): any {
    return NOPE;
  }
}

// ------------------------------------------------------------------------------------------ the runtime
interface ViewAttrs {
  [k: string]: string;
}
let nextUid = 1;

class AView {
  kType: string;
  attrs: ViewAttrs;
  children: AView[] = [];
  parent: AView | null = null;
  uid = "v" + nextUid++;
  id = -1;
  text = "";
  hint = "";
  textColor: string | null = null;
  textSize: number | null = null;
  bold = false;
  bg: string | null = null;
  visibility = 0;
  enabled = true;
  checked = false;
  progress = 0;
  max = 100;
  tag: any = null;
  error: string | null = null;
  inputType = "";
  onClick: any = null;
  onChecked: any = null;
  onItemClick: any = null;
  watchers: any[] = [];
  adapter: any = null;
  imageRes = "";
  rt: AndroidRuntime;
  constructor(rt: AndroidRuntime, kType: string, attrs: ViewAttrs) {
    this.rt = rt;
    this.kType = kType;
    this.attrs = attrs;
  }
  isA(n: string): boolean {
    return this.kType === n || (n === "View") || (n === "TextView" && (this.kType === "Button" || this.kType === "EditText" || this.kType === "CheckBox")) || (n === "ViewGroup" && this.children.length >= 0 && /Layout$|ScrollView$/.test(this.kType));
  }
  toString(): string {
    return "android.widget." + this.kType + "{" + this.uid + " id=" + this.id + "}";
  }
  getProp(name: string, it: Interp): any {
    switch (name) {
      case "text":
        return this.text;
      case "hint":
        return this.hint;
      case "visibility":
        return this.visibility;
      case "isEnabled":
      case "enabled":
        return this.enabled;
      case "isChecked":
      case "checked":
        return this.checked;
      case "progress":
        return this.progress;
      case "max":
        return this.max;
      case "tag":
        return this.tag;
      case "id":
        return this.id;
      case "error":
        return this.error;
      case "childCount":
        return this.children.length;
      case "parent":
        return this.parent;
      case "adapter":
        return this.adapter;
      case "textSize":
        return new Dbl(this.textSize || 14);
      case "isClickable":
        return true;
      default:
        return NOPE;
    }
  }
  setProp(name: string, v: any, it: Interp): boolean {
    switch (name) {
      case "text":
        this.setText(v, it);
        return true;
      case "hint":
        this.hint = this.str(v, it);
        return true;
      case "visibility":
        this.visibility = num(v);
        return true;
      case "isEnabled":
      case "enabled":
        this.enabled = v === true;
        return true;
      case "isChecked":
      case "checked":
        this.checked = v === true;
        return true;
      case "progress":
        this.progress = num(v);
        return true;
      case "max":
        this.max = num(v);
        return true;
      case "tag":
        this.tag = v;
        return true;
      case "error":
        this.error = v === null ? null : this.str(v, it);
        return true;
      case "adapter":
        this.adapter = v;
        return true;
      case "textSize":
        this.textSize = num(v);
        return true;
      default:
        return false;
    }
  }
  str(v: any, it: Interp): string {
    if (typeof v === "number" && this.rt.strings.byId[v] !== undefined) return this.rt.strings.byId[v];
    if (typeof v === "number") throw new ThrowSig(new KEx("Resources$NotFoundException", "String resource ID #0x" + v.toString(16)));
    return it.kStr(v);
  }
  setText(v: any, it: Interp): void {
    this.text = v === null ? "" : this.str(v, it);
    this.rt.touch();
  }
  call(name: string, args: any[], named: any, it: Interp): any {
    const a0 = args[0];
    switch (name) {
      case "setText":
        this.setText(a0, it);
        return undefined;
      case "getText":
        return this.text;
      case "setHint":
        this.hint = this.str(a0, it);
        return undefined;
      case "setOnClickListener":
        this.onClick = a0;
        return undefined;
      case "setOnLongClickListener":
      case "setOnTouchListener":
      case "setOnFocusChangeListener":
      case "setOnEditorActionListener":
      case "setLayoutParams":
      case "setPadding":
      case "setAlpha":
      case "setContentDescription":
      case "setTypeface":
      case "setGravity":
      case "setLines":
      case "setMaxLines":
      case "setInputType":
      case "setSelection":
      case "requestFocus":
      case "clearFocus":
      case "invalidate":
      case "requestLayout":
        return undefined;
      case "setOnItemClickListener":
        this.onItemClick = a0;
        return undefined;
      case "setOnCheckedChangeListener":
        this.onChecked = a0;
        return undefined;
      case "addTextChangedListener":
        this.watchers.push(a0);
        return undefined;
      case "setVisibility":
        this.visibility = num(a0);
        return undefined;
      case "getVisibility":
        return this.visibility;
      case "setEnabled":
        this.enabled = a0 === true;
        return undefined;
      case "isEnabled":
        return this.enabled;
      case "setChecked":
        this.checked = a0 === true;
        return undefined;
      case "isChecked":
        return this.checked;
      case "toggle":
        this.checked = !this.checked;
        return undefined;
      case "setProgress":
        this.progress = num(a0);
        return undefined;
      case "getProgress":
        return this.progress;
      case "setMax":
        this.max = num(a0);
        return undefined;
      case "setTag":
        this.tag = a0;
        return undefined;
      case "getTag":
        return this.tag;
      case "setError":
        this.error = a0 === null ? null : it.kStr(a0);
        return undefined;
      case "setTextColor":
        this.textColor = cssColor(a0);
        return undefined;
      case "setTextSize":
        this.textSize = num(args[args.length - 1]);
        return undefined;
      case "setBackgroundColor":
        this.bg = cssColor(a0);
        return undefined;
      case "setBackgroundResource":
      case "setImageResource":
        this.imageRes = String(a0);
        return undefined;
      case "setAdapter":
        this.adapter = a0;
        return undefined;
      case "getId":
        return this.id;
      case "getChildCount":
        return this.children.length;
      case "getChildAt":
        return this.children[a0] || null;
      case "addView":
        if (a0 instanceof AView) {
          a0.parent = this;
          this.children.push(a0);
        }
        return undefined;
      case "removeView":
        this.children = this.children.filter((c) => c !== a0);
        return undefined;
      case "removeAllViews":
        this.children = [];
        return undefined;
      case "findViewById":
        return this.rt.findIn(this, a0);
      case "performClick":
        this.rt.clickView(this);
        return true;
      case "post":
        it.callFn(a0, []);
        return true;
      case "toString":
        return this.toString();
      default:
        return NOPE;
    }
  }
}

interface ActivityRec {
  cls: string;
  obj: KObj;
  native: ActivityNative;
  root: AView | null;
  compose: any | null;
  slots: { [k: string]: any };
  label: string;
  intent: IntentObj;
  finished: boolean;
  resultCode: number;
}

class IntentObj {
  kType = "Intent";
  target: string | null;
  action: string | null;
  extras: { [k: string]: any } = {};
  data: any = null;
  constructor(target: string | null, action: string | null = null) {
    this.target = target;
    this.action = action;
  }
  getProp(name: string): any {
    if (name === "action") return this.action;
    if (name === "extras") {
      const m = new KMap(false);
      Object.keys(this.extras).forEach((k) => m.put(k, this.extras[k]));
      return m;
    }
    if (name === "data") return this.data;
    return NOPE;
  }
  call(name: string, args: any[], named: any, it: Interp): any {
    if (/^put(Extra|String|Int|Boolean|Double|Long|Float)?$/.test(name) && args.length >= 2) {
      this.extras[it.kStr(args[0])] = args[1];
      return this;
    }
    const get = /^get(String|Int|Boolean|Double|Long|Float|Char)Extra$/.exec(name);
    if (get) {
      const k = it.kStr(args[0]);
      if (Object.prototype.hasOwnProperty.call(this.extras, k)) return this.extras[k];
      if (get[1] === "String") return null;
      return args.length > 1 ? args[1] : get[1] === "Boolean" ? false : get[1] === "Double" || get[1] === "Float" ? new Dbl(0) : 0;
    }
    switch (name) {
      case "hasExtra":
        return Object.prototype.hasOwnProperty.call(this.extras, it.kStr(args[0]));
      case "setAction":
        this.action = it.kStr(args[0]);
        return this;
      case "setData":
        this.data = args[0];
        return this;
      case "addFlags":
      case "setFlags":
      case "setType":
      case "setPackage":
        return this;
      case "putExtras":
        return this;
      case "toString":
        return "Intent { " + (this.target ? "cmp=" + this.target : "act=" + this.action) + " }";
      default:
        return NOPE;
    }
  }
}

class PrefsObj {
  kType = "SharedPreferences";
  store: { [k: string]: any };
  constructor(store: { [k: string]: any }) {
    this.store = store;
  }
  call(name: string, args: any[], named: any, it: Interp): any {
    const k = args.length ? it.kStr(args[0]) : "";
    const get = /^get(String|Int|Boolean|Float|Long|StringSet)$/.exec(name);
    if (get) return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : args[1];
    switch (name) {
      case "contains":
        return Object.prototype.hasOwnProperty.call(this.store, k);
      case "getAll": {
        const m = new KMap(false);
        Object.keys(this.store).forEach((x) => m.put(x, this.store[x]));
        return m;
      }
      case "edit": {
        const pending: { [k: string]: any } = {};
        const removed: { [k: string]: boolean } = {};
        let cleared = false;
        const store = this.store;
        const ed: any = {
          kType: "SharedPreferences.Editor",
          call(n: string, a: any[]): any {
            if (/^put(String|Int|Boolean|Float|Long|StringSet)$/.test(n)) {
              pending[a[0]] = a[1];
              delete removed[a[0]];
              return ed;
            }
            if (n === "remove") {
              removed[a[0]] = true;
              delete pending[a[0]];
              return ed;
            }
            if (n === "clear") {
              cleared = true;
              return ed;
            }
            if (n === "apply" || n === "commit") {
              if (cleared) Object.keys(store).forEach((x) => delete store[x]);
              Object.keys(removed).forEach((x) => delete store[x]);
              Object.keys(pending).forEach((x) => (store[x] = pending[x]));
              return n === "commit" ? true : undefined;
            }
            return NOPE;
          },
        };
        return ed;
      }
      default:
        return NOPE;
    }
  }
}

class CursorObj {
  kType = "Cursor";
  cols: string[];
  rows: any[][];
  pos = -1;
  closed = false;
  constructor(cols: string[], rows: any[][]) {
    this.cols = cols;
    this.rows = rows;
  }
  private cell(it: Interp, i: number): any {
    if (this.closed) it.throwEx("IllegalStateException", "attempt to re-open an already-closed object: Cursor");
    if (this.pos < 0 || this.pos >= this.rows.length) it.throwEx("SQLiteException", "Index " + this.pos + " requested, with a size of " + this.rows.length);
    if (i < 0 || i >= this.cols.length) it.throwEx("IllegalArgumentException", "Invalid column index " + i);
    return this.rows[this.pos][i];
  }
  getProp(name: string): any {
    if (name === "count") return this.rows.length;
    if (name === "columnCount") return this.cols.length;
    if (name === "position") return this.pos;
    if (name === "isClosed") return this.closed;
    return NOPE;
  }
  call(name: string, args: any[], named: any, it: Interp): any {
    switch (name) {
      case "moveToFirst":
        this.pos = 0;
        return this.rows.length > 0;
      case "moveToLast":
        this.pos = this.rows.length - 1;
        return this.rows.length > 0;
      case "moveToNext":
        this.pos++;
        return this.pos < this.rows.length;
      case "moveToPrevious":
        this.pos--;
        return this.pos >= 0;
      case "moveToPosition":
        this.pos = args[0];
        return this.pos >= 0 && this.pos < this.rows.length;
      case "isAfterLast":
        return this.pos >= this.rows.length;
      case "isBeforeFirst":
        return this.pos < 0;
      case "isFirst":
        return this.pos === 0;
      case "isLast":
        return this.pos === this.rows.length - 1;
      case "getCount":
        return this.rows.length;
      case "getColumnIndex": {
        const i = this.cols.findIndex((c) => c.toLowerCase() === String(args[0]).toLowerCase());
        return i;
      }
      case "getColumnIndexOrThrow": {
        const i = this.cols.findIndex((c) => c.toLowerCase() === String(args[0]).toLowerCase());
        if (i < 0) it.throwEx("IllegalArgumentException", "column '" + args[0] + "' does not exist. Available columns: [" + this.cols.join(", ") + "]");
        return i;
      }
      case "getColumnName":
        return this.cols[args[0]];
      case "getInt":
      case "getLong":
      case "getShort": {
        const v = this.cell(it, args[0]);
        return v === null ? 0 : Math.trunc(Number(v));
      }
      case "getDouble":
      case "getFloat": {
        const v = this.cell(it, args[0]);
        return new Dbl(v === null ? 0 : Number(v));
      }
      case "getString": {
        const v = this.cell(it, args[0]);
        return v === null ? null : String(v);
      }
      case "isNull":
        return this.cell(it, args[0]) === null;
      case "close":
        this.closed = true;
        return undefined;
      default:
        return NOPE;
    }
  }
}

class ContentValuesObj {
  kType = "ContentValues";
  m: { [k: string]: any } = {};
  call(name: string, args: any[], named: any, it: Interp): any {
    if (name === "put") {
      this.m[it.kStr(args[0])] = args[1];
      return undefined;
    }
    if (name === "get" || name === "getAsString" || name === "getAsInteger") return Object.prototype.hasOwnProperty.call(this.m, args[0]) ? this.m[args[0]] : null;
    if (name === "containsKey") return Object.prototype.hasOwnProperty.call(this.m, args[0]);
    if (name === "size") return Object.keys(this.m).length;
    return NOPE;
  }
  getProp(name: string): any {
    return name === "size" ? Object.keys(this.m).length : NOPE;
  }
}

class DbObj {
  kType = "SQLiteDatabase";
  db: Database;
  open = true;
  constructor(db: Database) {
    this.db = db;
  }
  private run<T>(it: Interp, f: () => T): T {
    if (!this.open) it.throwEx("IllegalStateException", "attempt to re-open an already-closed object: SQLiteDatabase");
    try {
      return f();
    } catch (e) {
      if (e instanceof SqlError) throw new ThrowSig(new KEx(e.kind, e.message));
      throw e;
    }
  }
  private where(sel: any, argv: any): { sql: string; params: any[] } {
    return { sql: sel ? " WHERE " + sel : "", params: argv instanceof KList ? argv.items.slice() : [] };
  }
  call(name: string, args: any[], named: any, it: Interp): any {
    const arr = (v: any) => (v instanceof KList ? v.items.slice() : []);
    switch (name) {
      case "execSQL":
        return this.run(it, () => (this.db.exec(args[0], arr(args[1])), undefined));
      case "rawQuery":
        return this.run(it, () => {
          const r = this.db.exec(args[0], arr(args[1]));
          return new CursorObj(r.columns, r.rows);
        });
      case "insert":
      case "insertOrThrow":
        return this.run(it, () => {
          try {
            return this.db.insertValues(args[0], (args[2] as ContentValuesObj).m);
          } catch (e) {
            if (name === "insert" && e instanceof SqlError && e.kind === "SQLiteConstraintException") return -1;
            throw e;
          }
        });
      case "update":
        return this.run(it, () => {
          const cv = (args[1] as ContentValuesObj).m;
          const w = this.where(args[2], args[3]);
          const keys = Object.keys(cv);
          const r = this.db.exec("UPDATE " + args[0] + " SET " + keys.map((k) => k + " = ?").join(", ") + w.sql, keys.map((k) => cv[k]).concat(w.params));
          return r.rows[0][0];
        });
      case "delete":
        return this.run(it, () => {
          const w = this.where(args[1], args[2]);
          return this.db.exec("DELETE FROM " + args[0] + w.sql, w.params).rows[0][0];
        });
      case "query":
        return this.run(it, () => {
          const cols = args[1] instanceof KList ? args[1].items.join(", ") : "*";
          const w = this.where(args[2], args[3]);
          let sql = "SELECT " + cols + " FROM " + args[0] + w.sql;
          if (args[4]) sql += " GROUP BY " + args[4];
          if (args[6]) sql += " ORDER BY " + args[6];
          const r = this.db.exec(sql, w.params);
          return new CursorObj(r.columns, r.rows);
        });
      case "close":
        this.open = false;
        return undefined;
      case "isOpen":
        return this.open;
      case "beginTransaction":
      case "setTransactionSuccessful":
      case "endTransaction":
        return undefined;
      default:
        return NOPE;
    }
  }
  getProp(name: string): any {
    if (name === "isOpen") return this.open;
    return NOPE;
  }
}

/** native base of a user activity */
class ActivityNative {
  kType = "Activity";
  rt: AndroidRuntime;
  obj: KObj;
  rec: ActivityRec;
  constructor(rt: AndroidRuntime, obj: KObj) {
    this.rt = rt;
    this.obj = obj;
    this.rec = {
      cls: obj.cls.name, obj, native: this, root: null, compose: null, slots: {}, label: rt.labelFor(obj.cls.name),
      intent: rt.pendingIntent || new IntentObj(null), finished: false, resultCode: 0,
    };
    rt.stack.push(this.rec);
  }
  getProp(name: string, it: Interp): any {
    switch (name) {
      case "intent":
        return this.rec.intent;
      case "applicationContext":
      case "baseContext":
      case "application":
        return this.obj;
      case "title":
        return this.rec.label;
      case "isFinishing":
        return this.rec.finished;
      case "packageName":
        return this.rt.pkg;
      default:
        return NOPE;
    }
  }
  setProp(name: string, v: any, it: Interp): boolean {
    if (name === "title") {
      this.rec.label = it.kStr(v);
      return true;
    }
    return false;
  }
  call(name: string, args: any[], named: any, it: Interp): any {
    const rt = this.rt;
    switch (name) {
      case "setContentView": {
        let v = args[0];
        if (typeof v === "number") v = rt.inflateLayoutById(v, it);
        if (!(v instanceof AView)) it.throwEx("IllegalArgumentException", "setContentView expects a layout id or a View");
        this.rec.root = v;
        this.rec.compose = null;
        rt.touch();
        return undefined;
      }
      case "setContent":
        this.rec.compose = args[args.length - 1];
        this.rec.root = null;
        rt.touch();
        return undefined;
      case "findViewById": {
        if (!this.rec.root) return null;
        return rt.findIn(this.rec.root, args[0]);
      }
      case "finish":
      case "finishAffinity":
        rt.finishActivity(this.rec);
        return undefined;
      case "startActivity":
      case "startActivityForResult":
        rt.startActivity(args[0], it);
        return undefined;
      case "getSharedPreferences":
        return rt.prefs(String(args[0]));
      case "getPreferences":
        return rt.prefs(this.rec.cls);
      case "runOnUiThread":
        it.callFn(args[0], []);
        return undefined;
      case "getString":
        return rt.strings.byId[args[0]] !== undefined ? rt.strings.byId[args[0]] : it.throwEx("Resources$NotFoundException", "String resource ID #0x" + Number(args[0]).toString(16));
      case "setTitle":
        this.rec.label = it.kStr(args[0]);
        return undefined;
      case "getTitle":
        return this.rec.label;
      case "getIntent":
        return this.rec.intent;
      case "getApplicationContext":
      case "getBaseContext":
        return this.obj;
      case "setResult":
        this.rec.resultCode = num(args[0]);
        return undefined;
      case "onBackPressed":
        rt.back();
        return undefined;
      case "enableEdgeToEdge":
      case "setSupportActionBar":
      case "overridePendingTransition":
      case "invalidateOptionsMenu":
      case "requestWindowFeature":
        return undefined;
      case "getPackageName":
        return rt.pkg;
      case "getSystemService":
        return null;
      case "isFinishing":
        return this.rec.finished;
      case "recreate":
        return undefined;
      case "toString":
        return rt.pkg + "." + this.rec.cls + "@" + this.obj.id;
      default:
        return NOPE;
    }
  }
  superCall(name: string): any {
    return NOPE;
  }
}

class SqlHelperNative {
  kType = "SQLiteOpenHelper";
  rt: AndroidRuntime;
  obj: KObj;
  dbName: string;
  version: number;
  db: DbObj | null = null;
  constructor(rt: AndroidRuntime, obj: KObj, args: any[]) {
    this.rt = rt;
    this.obj = obj;
    this.dbName = args[1] === null || args[1] === undefined ? ":memory:" : String(args[1]);
    this.version = typeof args[3] === "number" ? args[3] : 1;
  }
  open(it: Interp): DbObj {
    if (this.db && this.db.open) return this.db;
    let fresh = false;
    let store = this.rt.databases[this.dbName];
    if (!store) {
      store = this.rt.databases[this.dbName] = new Database();
      fresh = true;
    }
    this.db = new DbObj(store);
    if (fresh) {
      const m = it.findMethod(this.obj.cls, "onCreate", 1);
      if (m) it.callUser(m.fn, [this.db], {}, this.obj, m.cls);
      this.rt.versions[this.dbName] = this.version;
    } else if (this.rt.versions[this.dbName] < this.version) {
      const m = it.findMethod(this.obj.cls, "onUpgrade", 3);
      if (m) it.callUser(m.fn, [this.db, this.rt.versions[this.dbName], this.version], {}, this.obj, m.cls);
      this.rt.versions[this.dbName] = this.version;
    }
    return this.db;
  }
  getProp(name: string, it: Interp): any {
    if (name === "writableDatabase" || name === "readableDatabase") return this.open(it);
    if (name === "databaseName") return this.dbName;
    return NOPE;
  }
  call(name: string, args: any[], named: any, it: Interp): any {
    if (name === "getWritableDatabase" || name === "getReadableDatabase") return this.open(it);
    if (name === "close") {
      if (this.db) this.db.open = false;
      return undefined;
    }
    if (name === "getDatabaseName") return this.dbName;
    return NOPE;
  }
}

class PlainNative {
  kType = "Native";
  call(): any {
    return NOPE;
  }
  getProp(): any {
    return NOPE;
  }
}

class ArrayAdapterObj {
  kType = "ArrayAdapter";
  items: KList;
  constructor(items: KList) {
    this.items = items;
  }
  getProp(name: string): any {
    return name === "count" ? this.items.items.length : NOPE;
  }
  call(name: string, args: any[], named: any, it: Interp): any {
    switch (name) {
      case "add":
        this.items.items.push(args[0]);
        return undefined;
      case "clear":
        this.items.items.length = 0;
        return undefined;
      case "getCount":
        return this.items.items.length;
      case "getItem":
        return this.items.items[args[0]];
      case "notifyDataSetChanged":
        return undefined;
      default:
        return NOPE;
    }
  }
}

const VIEW_TYPES = ["View", "TextView", "Button", "EditText", "ImageView", "ImageButton", "LinearLayout", "RelativeLayout", "FrameLayout", "ConstraintLayout", "ScrollView", "CheckBox", "RadioButton", "RadioGroup", "Switch", "ToggleButton", "ProgressBar", "ListView", "Spinner", "SeekBar", "TableLayout", "TableRow", "CardView", "Space", "SwitchCompat", "AppCompatTextView", "AppCompatButton", "AppCompatEditText"];
const COMPOSE_PARAMS: { [n: string]: string[] } = {
  Text: ["text", "modifier", "color", "fontSize", "fontStyle", "fontWeight", "fontFamily", "letterSpacing", "textDecoration", "textAlign"],
  Button: ["onClick", "modifier", "enabled"], OutlinedButton: ["onClick", "modifier", "enabled"], TextButton: ["onClick", "modifier", "enabled"],
  ElevatedButton: ["onClick", "modifier", "enabled"], FilledTonalButton: ["onClick", "modifier", "enabled"], IconButton: ["onClick", "modifier", "enabled"],
  FloatingActionButton: ["onClick", "modifier"], ExtendedFloatingActionButton: ["onClick", "modifier"],
  Column: ["modifier", "verticalArrangement", "horizontalAlignment"], Row: ["modifier", "horizontalArrangement", "verticalAlignment"],
  Box: ["modifier", "contentAlignment"], Card: ["modifier", "shape", "colors", "elevation"], ElevatedCard: ["modifier"], OutlinedCard: ["modifier"],
  Surface: ["modifier", "shape", "color"], LazyColumn: ["modifier", "state", "contentPadding", "reverseLayout", "verticalArrangement", "horizontalAlignment"],
  LazyRow: ["modifier"], Spacer: ["modifier"], TextField: ["value", "onValueChange", "modifier", "enabled", "readOnly", "textStyle", "label"],
  OutlinedTextField: ["value", "onValueChange", "modifier", "enabled", "readOnly", "textStyle", "label"], Checkbox: ["checked", "onCheckedChange", "modifier", "enabled"],
  Switch: ["checked", "onCheckedChange", "modifier", "enabled"], RadioButton: ["selected", "onClick", "modifier", "enabled"],
  Slider: ["value", "onValueChange", "modifier", "enabled", "valueRange"], Divider: ["modifier"], HorizontalDivider: ["modifier"],
  CircularProgressIndicator: ["modifier"], LinearProgressIndicator: ["progress", "modifier"], Icon: ["imageVector", "contentDescription", "modifier"],
  Image: ["painter", "contentDescription", "modifier"], Scaffold: ["modifier", "topBar", "bottomBar", "snackbarHost", "floatingActionButton"],
  TopAppBar: ["title", "modifier"], CenterAlignedTopAppBar: ["title", "modifier"], Dialog: [], AlertDialog: [], Snackbar: [], ListItem: [],
};
const COMPOSE_NAMES = Object.keys(COMPOSE_PARAMS);
/** classes students meet in Android labs that the LabMate runtime does not implement: using them fails with a clear message */
const UNSUPPORTED_CLASSES = ["RecyclerView", "ViewPager", "ViewPager2", "WebView", "MediaPlayer", "Camera", "LocationManager", "SensorManager", "Retrofit", "OkHttpClient", "RoomDatabase", "Room", "AsyncTask", "CountDownTimer", "Timer", "WorkManager", "NotificationManager", "NotificationCompat", "FirebaseAuth", "MapView", "BottomNavigationView", "NavController", "TabLayout", "Spinner", "ViewModelProvider", "LiveData", "MutableLiveData"];
const NAMESPACES = [
  "Arrangement", "Alignment", "FontWeight", "FontStyle", "TextAlign", "TextOverflow", "ContentScale", "KeyboardType", "ImeAction", "Icons",
  "ButtonDefaults", "CardDefaults", "TextFieldDefaults", "MaterialTheme", "Typography", "CircleShape", "TextDecoration", "FontFamily",
  "VisualTransformation", "Brush", "Shapes", "Dispatchers", "Locale", "TopAppBarDefaults", "SurfaceDefaults", "ListItemDefaults",
];
const LOOSE_CTORS = ["KeyboardOptions", "PaddingValues", "RoundedCornerShape", "TextStyle", "SpanStyle", "BorderStroke", "CornerRadius", "Offset", "Size", "TextRange", "Typography", "Shapes", "CircleShape", "ButtonColors"];

export class AndroidRuntime implements Host {
  interp: Interp;
  files: ProjectFile[];
  pkg = "com.example.myapplication";
  logs: LogLine[] = [];
  stack: ActivityRec[] = [];
  toasts: { text: string; until: number }[] = [];
  dialog: { title: string; message: string; buttons: { id: number; label: string; handler: any }[] } | null = null;
  crash: CrashInfo | null = null;
  version = 0;
  listeners: (() => void)[] = [];
  pendingIntent: IntentObj | null = null;
  databases: { [n: string]: Database } = {};
  versions: { [n: string]: number } = {};
  prefStores: { [n: string]: { [k: string]: any } } = {};
  manifestActivities: string[] = [];
  mainActivity = "MainActivity";
  labels: { [cls: string]: string } = {};
  appLabel = "My Application";
  strings: { byName: { [n: string]: string }; byId: { [n: number]: string } } = { byName: {}, byId: {} };
  colors: { [n: string]: string } = {};
  layouts: { [n: string]: XNode } = {};
  layoutIds: { [n: string]: number } = {};
  layoutNames: { [id: number]: string } = {};
  idByName: { [n: string]: number } = {};
  idCounter = 0x7f0a0001;
  diagnostics: Diagnostic[] = [];
  private built = false;
  private cur: { parent: UiNode; handlers: { [uid: string]: any }; counters: { [k: string]: number }; rec: ActivityRec | null } | null = null;
  private handlers: { [uid: string]: any } = {};
  private composeError: boolean = false;

  constructor(files: ProjectFile[]) {
    this.files = files;
    this.interp = new Interp(this);
  }

  // ------------------------------------------------------------------------------------------ build
  subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((x) => x !== fn);
    };
  }
  touch(): void {
    this.version++;
  }
  log(level: LogLine["level"], tag: string, message: string, crash = false): void {
    this.logs.push({ ts: Date.now(), level, tag, message, crash });
    if (this.logs.length > 2000) this.logs.splice(0, this.logs.length - 2000);
  }
  labelFor(cls: string): string {
    return this.labels[cls] || this.appLabel;
  }

  private scanResources(): void {
    this.strings = { byName: {}, byId: {} };
    this.layouts = {};
    this.layoutIds = {};
    this.layoutNames = {};
    this.idByName = {};
    this.colors = {};
    this.manifestActivities = [];
    this.labels = {};
    let layoutCounter = 0x7f040001;
    let stringCounter = 0x7f0b0001;
    this.files.forEach((f) => {
      if (f.kind === "manifest" || /AndroidManifest\.xml$/.test(f.path)) {
        try {
          const x = parseXml(f.content);
          if (x.attrs["package"]) this.pkg = x.attrs["package"];
          const app = x.children.filter((c) => c.tag === "application")[0];
          if (app) {
            const resolveLabel = (v: string | undefined): string | null => {
              if (!v) return null;
              const m = /^@string\/(.+)$/.exec(v);
              return m ? this.strings.byName[m[1]] || null : v;
            };
            this.appLabel = resolveLabel(app.attrs["android:label"]) || this.appLabel;
            app.children.forEach((a) => {
              if (a.tag !== "activity") return;
              const nm = (a.attrs["android:name"] || "").replace(/^.*\./, "");
              this.manifestActivities.push(nm);
              if (a.attrs["android:label"]) this.labels[nm] = resolveLabel(a.attrs["android:label"]) || this.appLabel;
              const isMain = JSON.stringify(a).indexOf("android.intent.action.MAIN") >= 0;
              if (isMain) this.mainActivity = nm;
            });
          }
        } catch (e) {
          /* reported by the XML checks */
        }
      }
    });
    this.files.forEach((f) => {
      if (/res\/values\/.*\.xml$/.test(f.path)) {
        try {
          const x = parseXml(f.content);
          x.children.forEach((c) => {
            if (c.tag === "string") {
              this.strings.byName[c.attrs["name"]] = c.text.trim();
              this.strings.byId[stringCounter] = c.text.trim();
              this.idByName["string/" + c.attrs["name"]] = stringCounter++;
            } else if (c.tag === "color") this.colors[c.attrs["name"]] = c.text.trim();
          });
        } catch (e) {
          /* ignore */
        }
      }
      const lm = /res\/layout[^/]*\/([^/]+)\.xml$/.exec(f.path);
      if (lm) {
        try {
          this.layouts[lm[1]] = parseXml(f.content);
          this.layoutIds[lm[1]] = layoutCounter;
          this.layoutNames[layoutCounter++] = lm[1];
          this.collectIds(this.layouts[lm[1]]);
        } catch (e) {
          /* reported by the XML checks */
        }
      }
    });
    // the default app label may reference strings declared after the manifest
    this.files.forEach((f) => {
      if (/AndroidManifest\.xml$/.test(f.path)) {
        const m = /<application[^>]*android:label="@string\/([^"]+)"/.exec(f.content);
        if (m && this.strings.byName[m[1]]) this.appLabel = this.strings.byName[m[1]];
      }
    });
  }
  private collectIds(x: XNode): void {
    const id = x.attrs["android:id"];
    if (id) {
      const m = /^@\+?id\/(.+)$/.exec(id);
      if (m && this.idByName["id/" + m[1]] === undefined) this.idByName["id/" + m[1]] = this.idCounter++;
    }
    x.children.forEach((c) => this.collectIds(c));
  }

  /** compile: syntax + reference checks. Returns the diagnostics (errors block Run). */
  build(): Diagnostic[] {
    this.scanResources();
    const kt = this.files.filter((f) => f.kind === "kotlin" && !f.isTest && !/\/(test|androidTest)\//.test(f.path));
    const known = (n: string) => ANDROID_LOWER_GLOBALS.indexOf(n) >= 0;
    const member = (n: string) => ANDROID_MEMBERS.indexOf(n) >= 0;
    const res = checkKotlin(kt.map((f) => ({ name: f.name, src: f.content })), { isKnownGlobal: known, isInheritedMember: member });
    this.diagnostics = res.diagnostics;
    if (!res.diagnostics.some((d) => d.severity === "error")) {
      try {
        this.interp.load(res.asts);
        this.built = true;
      } catch (e: any) {
        this.diagnostics.push({ severity: "error", file: "", line: 1, col: 1, message: e && e.message ? e.message : String(e) });
      }
    }
    return this.diagnostics;
  }

  // ------------------------------------------------------------------------------------------ Host
  stdout(text: string, newline: boolean): void {
    if (!newline) {
      this.partial = (this.partial || "") + text;
      return;
    }
    this.log("I", "System.out", (this.partial || "") + text);
    this.partial = "";
  }
  partial = "";
  isNativeClass(name: string): boolean {
    if (UNSUPPORTED_CLASSES.indexOf(name) >= 0) return true;
    return VIEW_TYPES.indexOf(name) >= 0 || ["Intent", "ContentValues", "Bundle", "ArrayAdapter", "AlertDialog", "Handler"].indexOf(name) >= 0 || (LOOSE_CTORS.indexOf(name) >= 0) || name === "Color";
  }
  construct(name: string, args: any[], named: any, it: Interp): any {
    // `Button(...)`, `Switch(...)`, `Slider(...)` inside a composition are Compose composables, not android.widget views
    if (this.cur && COMPOSE_NAMES.indexOf(name) >= 0) return NOPE;
    if (UNSUPPORTED_CLASSES.indexOf(name) >= 0) it.throwEx("UnsupportedOperationException", name + " is not supported in the LabMate Android runtime");
    if (VIEW_TYPES.indexOf(name) >= 0) {
      const v = new AView(this, name.replace(/^AppCompat/, ""), {});
      if (name === "Button" || name === "AppCompatButton") v.enabled = true;
      return v;
    }
    switch (name) {
      case "Intent": {
        if (args.length >= 2 && args[1] instanceof ClassVal) return new IntentObj(args[1].info.name);
        if (args.length >= 1 && typeof args[0] === "string") {
          const i = new IntentObj(null, args[0]);
          if (args[1] && args[1].kType === "Uri") i.data = args[1];
          return i;
        }
        return new IntentObj(null);
      }
      case "ContentValues":
        return new ContentValuesObj();
      case "Bundle":
        return new ContentValuesObj();
      case "ArrayAdapter": {
        const list = args.filter((a) => a instanceof KList)[0];
        return new ArrayAdapterObj(list || new KList([], true));
      }
      case "Color":
        return this.colorCtor(args, it);
      default:
        if (LOOSE_CTORS.indexOf(name) >= 0) return new Tok(name, { args, named });
        return NOPE;
    }
  }
  private colorCtor(args: any[], it: Interp): any {
    const v = args[0];
    if (typeof v === "number" && args.length === 1) return new ColorVal(v);
    if (args.length >= 3) return new ColorVal(((255 << 24) | (num(args[0]) << 16) | (num(args[1]) << 8) | num(args[2])) >>> 0);
    return new ColorVal(typeof v === "number" ? v : 0xff000000);
  }
  createNativeBase(superName: string, obj: KObj, args: any[], it: Interp): any {
    if (/Activity$/.test(superName)) return new ActivityNative(this, obj);
    if (superName === "SQLiteOpenHelper") return new SqlHelperNative(this, obj, args);
    if (superName === "Fragment" || superName === "DialogFragment" || superName === "RecyclerView.Adapter" || superName === "Service" || superName === "BroadcastReceiver") {
      throw new StopSig(superName + " is not supported in the LabMate Android runtime.");
    }
    return new PlainNative();
  }

  resolveGlobal(name: string, it: Interp): any {
    const g = this.androidGlobal(name, it);
    if (g !== NOPE) return g;
    return stdGlobal(it, name);
  }

  private fn(name: string, f: (a: any[], n: any) => any): NativeFn {
    return new NativeFn(name, f);
  }

  private resNs(): any {
    const rt = this;
    const section = (prefix: string, ids: boolean) => ({
      kType: "R." + prefix,
      getProp(n: string, it: Interp): any {
        const v = rt.idByName[prefix + "/" + n];
        if (v !== undefined) return v;
        if (prefix === "layout" && rt.layoutIds[n] !== undefined) return rt.layoutIds[n];
        if (prefix === "color" && rt.colors[n] !== undefined) return 0;
        return it.throwEx("UnsupportedOperationException", "Unresolved reference: R." + prefix + "." + n);
      },
    });
    return {
      kType: "R",
      getProp(n: string): any {
        if (["id", "layout", "string", "color", "drawable", "mipmap", "style", "dimen", "array", "menu", "xml", "raw", "anim"].indexOf(n) >= 0) {
          const s: any = section(n, true);
          if (n === "layout") {
            s.getProp = (nm: string, it: Interp) => {
              if (rt.layoutIds[nm] !== undefined) return rt.layoutIds[nm];
              return it.throwEx("UnsupportedOperationException", "Unresolved reference: R.layout." + nm);
            };
          }
          if (n === "drawable" || n === "mipmap" || n === "raw" || n === "anim" || n === "menu" || n === "xml" || n === "style" || n === "dimen" || n === "array") s.getProp = (nm: string) => 0x7f080000 + nm.length;
          return s;
        }
        return NOPE;
      },
    };
  }

  private androidGlobal(name: string, it: Interp): any {
    switch (name) {
      case "R":
        return this.resNs();
      case "android":
        return new Tok("android");
      case "Log": {
        const mk = (lvl: LogLine["level"]) =>
          this.fn(lvl.toLowerCase(), (a) => {
            let msg = it.kStr(a[1]);
            if (a[2] instanceof KEx) msg += "\n" + it.kStr(a[2]);
            this.log(lvl, it.kStr(a[0]), msg);
            return 0;
          });
        return new NsObj("Log", { v: mk("V"), d: mk("D"), i: mk("I"), w: mk("W"), e: mk("E"), wtf: mk("E") });
      }
      case "Toast":
        return new NsObj("Toast", {
          LENGTH_SHORT: 0,
          LENGTH_LONG: 1,
          makeText: this.fn("makeText", (a) => {
            const text = typeof a[1] === "number" && this.strings.byId[a[1]] !== undefined ? this.strings.byId[a[1]] : it.kStr(a[1]);
            const dur = a[2] === 1 ? 3500 : 2000;
            return { kType: "Toast", call: (n: string) => (n === "show" ? (this.toasts.push({ text, until: Date.now() + dur }), this.touch(), undefined) : NOPE) };
          }),
        });
      case "Snackbar":
        return new NsObj("Snackbar", {
          LENGTH_SHORT: -1, LENGTH_LONG: 0, LENGTH_INDEFINITE: -2,
          make: this.fn("make", (a) => {
            const text = it.kStr(a[1]);
            const o: any = { kType: "Snackbar", call: (n: string) => (n === "show" ? (this.toasts.push({ text, until: Date.now() + 3000 }), this.touch(), undefined) : n === "setAction" ? o : NOPE) };
            return o;
          }),
        });
      case "View":
        return new NsObj("View", { VISIBLE: 0, INVISIBLE: 4, GONE: 8 });
      case "Intent":
        return new NsObj("Intent", { ACTION_VIEW: "android.intent.action.VIEW", ACTION_SEND: "android.intent.action.SEND", ACTION_MAIN: "android.intent.action.MAIN", ACTION_DIAL: "android.intent.action.DIAL", FLAG_ACTIVITY_NEW_TASK: 0x10000000, FLAG_ACTIVITY_CLEAR_TOP: 0x4000000, EXTRA_TEXT: "android.intent.extra.TEXT" });
      case "Uri":
        return new NsObj("Uri", { parse: this.fn("parse", (a) => ({ kType: "Uri", s: String(a[0]), toString: () => String(a[0]) })) });
      case "Context":
        return new NsObj("Context", { MODE_PRIVATE: 0, MODE_APPEND: 32768, INPUT_METHOD_SERVICE: "input_method" });
      case "Looper":
        return new NsObj("Looper", { getMainLooper: this.fn("getMainLooper", () => ({ kType: "Looper" })) });
      case "Color": {
        const rt = this;
        const o: any = {
          kType: "Color",
          getProp(n: string): any {
            const named = NAMED[n.toLowerCase()];
            if (n === "Unspecified") return new ColorVal(0);
            if (named !== undefined) return /^[A-Z]+$/.test(n) ? named : new ColorVal(named);
            return NOPE;
          },
          call(n: string, a: any[], nm: any, it2: Interp): any {
            if (n === "parseColor") {
              const p = parseColorString(String(a[0]));
              if (p === null) it2.throwEx("IllegalArgumentException", "Unknown color");
              return p;
            }
            if (n === "rgb") return ((255 << 24) | (num(a[0]) << 16) | (num(a[1]) << 8) | num(a[2])) >>> 0;
            if (n === "argb") return ((num(a[0]) << 24) | (num(a[1]) << 16) | (num(a[2]) << 8) | num(a[3])) >>> 0;
            return NOPE;
          },
          invoke(a: any[], nm: any, it2: Interp): any {
            return rt.colorCtor(a, it2);
          },
        };
        return o;
      }
      case "AlertDialog":
        return this.alertBuilderNs(it);
      case "Modifier":
        return new ModObj();
      case "MaterialTheme": {
        const mt: any = new Tok("MaterialTheme", {});
        mt.invoke = (a: any[], n: any) => {
          const content = n.content || a[a.length - 1];
          return it.callFn(content, []);
        };
        return mt;
      }
      case "isSystemInDarkTheme":
        return this.fn(name, () => false);
      case "darkColorScheme":
      case "lightColorScheme":
      case "dynamicDarkColorScheme":
      case "dynamicLightColorScheme":
        return this.fn(name, (a, n) => new Tok("colorScheme", n || {}));
      case "enableEdgeToEdge":
        return this.fn(name, () => undefined);
      case "setContent":
        return NOPE;
      case "remember":
      case "rememberSaveable":
        return this.fn(name, (a) => this.remember(a, it));
      case "mutableStateOf":
      case "mutableIntStateOf":
      case "mutableFloatStateOf":
      case "mutableDoubleStateOf":
        return this.fn(name, (a) => new MState(a[0]));
      case "derivedStateOf":
        return this.fn(name, (a) => ({
          isDelegate: true,
          kType: "State",
          getValue: () => it.callFn(a[0], []),
          setValue: () => it.throwEx("UnsupportedOperationException", "derivedStateOf is read-only"),
          getProp: (n: string) => (n === "value" ? it.callFn(a[0], []) : NOPE),
        }));
      case "mutableStateListOf":
        return this.fn(name, (a) => new KList(a.slice(), true));
      case "mutableStateMapOf":
        return this.fn(name, () => new KMap(true));
      case "LaunchedEffect":
      case "SideEffect":
      case "DisposableEffect":
        return this.fn(name, (a) => {
          const key = this.slotKey(it, "effect");
          const slots = this.curSlots();
          if (slots && slots[key] === undefined) {
            slots[key] = true;
            const body = a[a.length - 1];
            if (name !== "DisposableEffect") it.callFn(body, []);
          }
          return undefined;
        });
      case "rememberScrollState":
      case "rememberLazyListState":
        return this.fn(name, () => new Tok("ScrollState"));
      case "stringResource":
        return this.fn(name, (a) => (this.strings.byId[a[0]] !== undefined ? this.strings.byId[a[0]] : it.throwEx("Resources$NotFoundException", "String resource ID #0x" + Number(a[0]).toString(16))));
      case "painterResource":
        return this.fn(name, (a) => new Tok("painter"));
      case "items":
      case "itemsIndexed":
        return this.fn(name, (a) => {
          const list = a[0] instanceof KList ? a[0].items : a[0] && a[0].values ? a[0].values() : [];
          const content = a[a.length - 1];
          list.forEach((x: any, i: number) => (name === "items" ? it.callFn(content, [x]) : it.callFn(content, [i, x])));
          return undefined;
        });
      case "item":
        return this.fn(name, (a) => it.callFn(a[a.length - 1], []));
      case "viewModel":
        return this.fn(name, () => it.throwEx("UnsupportedOperationException", "viewModel() is not supported in the LabMate runtime"));
      default:
        break;
    }
    if (COMPOSE_NAMES.indexOf(name) >= 0) return this.composable(name, it);
    if (NAMESPACES.indexOf(name) >= 0) return new Tok(name);
    if (LOOSE_CTORS.indexOf(name) >= 0) {
      const t: any = new Tok(name);
      return t;
    }
    return NOPE;
  }

  // ------------------------------------------------------------------------------------------ AlertDialog
  private alertBuilderNs(it: Interp): any {
    const rt = this;
    const builderCtor = (): any => {
      const d = { title: "", message: "", buttons: [] as { id: number; label: string; handler: any }[] };
      const b: any = {
        kType: "AlertDialog.Builder",
        call(n: string, a: any[]): any {
          switch (n) {
            case "setTitle":
              d.title = it.kStr(a[0]);
              return b;
            case "setMessage":
              d.message = it.kStr(a[0]);
              return b;
            case "setPositiveButton":
              d.buttons.push({ id: -1, label: it.kStr(a[0]), handler: a[1] });
              return b;
            case "setNegativeButton":
              d.buttons.push({ id: -2, label: it.kStr(a[0]), handler: a[1] });
              return b;
            case "setNeutralButton":
              d.buttons.push({ id: -3, label: it.kStr(a[0]), handler: a[1] });
              return b;
            case "setCancelable":
            case "setIcon":
              return b;
            case "show":
            case "create": {
              rt.dialog = d;
              rt.touch();
              return b;
            }
            default:
              return NOPE;
          }
        },
      };
      return b;
    };
    return {
      kType: "AlertDialog",
      getProp: (n: string) => (n === "Builder" ? { kType: "AlertDialog.Builder", invoke: () => builderCtor() } : NOPE),
      call: (n: string) => (n === "Builder" ? builderCtor() : NOPE),
    };
  }

  // ------------------------------------------------------------------------------------------ resources / inflation
  inflateLayoutById(id: number, it: Interp): AView {
    const name = this.layoutNames[id];
    if (!name) it.throwEx("Resources$NotFoundException", "Resource ID #0x" + id.toString(16));
    return this.inflate(this.layouts[name], it, null);
  }
  inflate(x: XNode, it: Interp, parent: AView | null): AView {
    const kType = x.tag.replace(/^.*\./, "");
    if (kType === "include" || kType === "merge" || kType === "fragment" || kType === "androidx.fragment.app.FragmentContainerView") {
      throw new StopSig("<" + x.tag + "> in a layout is not supported in the LabMate runtime");
    }
    if (UNSUPPORTED_CLASSES.indexOf(kType) >= 0) throw new StopSig("<" + kType + "> in a layout is not supported in the LabMate Android runtime");
    const attrs: ViewAttrs = {};
    Object.keys(x.attrs).forEach((k) => (attrs[k.replace(/^android:/, "").replace(/^app:/, "")] = x.attrs[k]));
    const v = new AView(this, kType, attrs);
    v.parent = parent;
    const idm = /^@\+?id\/(.+)$/.exec(attrs["id"] || "");
    if (idm) v.id = this.idByName["id/" + idm[1]];
    const res = (s: string | undefined): string => {
      if (!s) return "";
      const m = /^@string\/(.+)$/.exec(s);
      return m ? (this.strings.byName[m[1]] !== undefined ? this.strings.byName[m[1]] : s) : s;
    };
    v.text = res(attrs["text"]);
    v.hint = res(attrs["hint"]);
    const colorOf = (s: string | undefined): string | null => {
      if (!s) return null;
      const m = /^@color\/(.+)$/.exec(s);
      if (m) return this.colors[m[1]] ? cssColor(this.colors[m[1]]) : null;
      return cssColor(s);
    };
    v.textColor = colorOf(attrs["textColor"]);
    v.bg = colorOf(attrs["background"]);
    if (attrs["textSize"]) v.textSize = parseFloat(attrs["textSize"]);
    v.bold = /bold/.test(attrs["textStyle"] || "");
    v.visibility = attrs["visibility"] === "gone" ? 8 : attrs["visibility"] === "invisible" ? 4 : 0;
    v.enabled = attrs["enabled"] !== "false";
    v.checked = attrs["checked"] === "true";
    v.progress = parseInt(attrs["progress"] || "0", 10) || 0;
    v.max = parseInt(attrs["max"] || "100", 10) || 100;
    v.inputType = attrs["inputType"] || "";
    v.children = x.children.map((c) => this.inflate(c, it, v));
    return v;
  }
  findIn(root: AView, id: any): AView | null {
    if (typeof id !== "number") return null;
    if (root.id === id) return root;
    for (let i = 0; i < root.children.length; i++) {
      const f = this.findIn(root.children[i], id);
      if (f) return f;
    }
    return null;
  }
  prefs(name: string): PrefsObj {
    if (!this.prefStores[name]) this.prefStores[name] = {};
    return new PrefsObj(this.prefStores[name]);
  }

  // ------------------------------------------------------------------------------------------ activity lifecycle
  private runGuarded(label: string, f: () => void): boolean {
    if (this.crash) return false;
    try {
      f();
      return true;
    } catch (e: any) {
      this.handleFailure(e, label);
      return false;
    }
  }
  private handleFailure(e: any, label: string): void {
    if (e instanceof ThrowSig) {
      const ex = e.value;
      let name = "Exception";
      let message: string | null = null;
      if (ex instanceof KEx) {
        name = ex.name;
        message = ex.message;
      } else if (ex instanceof KObj) {
        name = ex.cls.name;
        message = ex.f.message === undefined ? null : ex.f.message;
      }
      const fqn = isExceptionName(name) ? exceptionFqn(name) : name;
      const unsupported = /^Unresolved reference|not available in the LabMate runtime|not supported in the LabMate/.test(message || "");
      const text = fqn + (message ? ": " + message : "");
      this.crash = unsupported
        ? { kind: "unsupported", process: this.pkg, title: "Not supported by the LabMate runtime", message: message || text }
        : { kind: "exception", process: this.pkg, title: this.appLabel + " keeps stopping", message: text };
      this.log("E", "AndroidRuntime", "FATAL EXCEPTION: main\nProcess: " + this.pkg + ", PID: 4242\n" + text + "\n\tat " + this.pkg + "." + label, true);
    } else if (e instanceof StopSig) {
      this.crash = { kind: "limit", process: this.pkg, title: "Stopped by the LabMate runtime", message: e.message };
      this.log("E", "LabMate", e.message, true);
    } else {
      this.crash = { kind: "unsupported", process: this.pkg, title: "Runtime error", message: String(e && e.message ? e.message : e) };
      this.log("E", "LabMate", String(e && e.stack ? e.stack : e), true);
    }
    this.touch();
  }

  launch(clsName: string, intent: IntentObj | null): boolean {
    const info = this.interp.classes[clsName];
    if (!info) {
      this.handleFailure(new ThrowSig(new KEx("ClassNotFoundException", 'Didn\'t find class "' + this.pkg + "." + clsName + '"')), "launch");
      return false;
    }
    this.pendingIntent = intent;
    let rec: ActivityRec | null = null;
    const ok = this.runGuarded(clsName + ".onCreate", () => {
      this.interp.startClock(8000);
      const obj: KObj = this.interp.instantiate(info, [], {});
      rec = this.stack[this.stack.length - 1];
      this.log("I", "ActivityTaskManager", "Displayed " + this.pkg + "/." + clsName);
      const m = this.interp.findMethod(info, "onCreate", 1);
      if (m) this.interp.callUser(m.fn, [null], {}, obj, m.cls);
      ["onStart", "onResume"].forEach((n) => {
        const mm = this.interp.findMethod(info, n, 0);
        if (mm) this.interp.callUser(mm.fn, [], {}, obj, mm.cls);
      });
    });
    this.pendingIntent = null;
    this.touch();
    return ok && rec !== null;
  }

  // ---- editor preview: renders one @Preview @Composable function with the same engine (no activity involved)
  private previewRec: ActivityRec | null = null;
  startPreview(fnName: string): void {
    this.stack = [];
    this.crash = null;
    this.dialog = null;
    this.toasts = [];
    this.previewRec = {
      cls: "Preview", obj: null as any, native: null as any, root: null,
      compose: new NativeFn("preview", () => this.interp.callGlobalFun(fnName, [], {})), slots: {}, label: fnName,
      intent: new IntentObj(null), finished: false, resultCode: 0,
    };
  }
  previewScreen(): ScreenState {
    const base: ScreenState = {
      activity: "Preview", label: "Preview", mode: "none", root: null, toasts: [], dialog: null, crash: this.crash, canGoBack: false, version: this.version, finished: false,
    };
    if (!this.previewRec || this.crash) return base;
    try {
      base.root = this.recompose(this.previewRec);
      base.mode = "compose";
    } catch (e) {
      this.handleFailure(e, "Preview");
      base.crash = this.crash;
    }
    if (this.dialog) base.dialog = { title: this.dialog.title, message: this.dialog.message, buttons: this.dialog.buttons.map((b) => ({ id: b.id, label: b.label })) };
    return base;
  }

  closeApp(): void {
    this.crash = null;
    this.stack = [];
    this.dialog = null;
    this.touch();
  }

  /** Run: compile (if needed) and start the launcher activity on a fresh "device" (databases and preferences are wiped, as after an uninstall) */
  start(): boolean {
    this.stack = [];
    this.crash = null;
    this.toasts = [];
    this.dialog = null;
    this.databases = {};
    this.prefStores = {};
    this.versions = {};
    this.touch();
    if (!this.built) return false;
    const main = this.interp.classes[this.mainActivity] ? this.mainActivity : this.interp.classes["MainActivity"] ? "MainActivity" : "";
    if (!main) {
      this.handleFailure(new ThrowSig(new KEx("ClassNotFoundException", "Launcher activity " + this.mainActivity + " not found")), "start");
      return false;
    }
    this.log("I", "ActivityManager", "Start proc " + this.pkg + " for activity " + this.pkg + "/." + main);
    return this.launch(main, null);
  }

  startActivity(intent: any, it: Interp): void {
    if (!(intent instanceof IntentObj)) it.throwEx("IllegalArgumentException", "startActivity expects an Intent");
    if (!intent.target) {
      this.log("I", "ActivityTaskManager", "Implicit intent " + (intent.action || "") + " " + (intent.data ? it.kStr(intent.data) : "") + " was sent (not handled by LabMate)");
      this.toasts.push({ text: "Implicit intent: " + (intent.action || "") + " (no other app in the LabMate emulator)", until: Date.now() + 2500 });
      this.touch();
      return;
    }
    if (this.manifestActivities.indexOf(intent.target) < 0) {
      it.throwEx("ActivityNotFoundException", "Unable to find explicit activity class {" + this.pkg + "/" + this.pkg + "." + intent.target + "}; have you declared this activity in your AndroidManifest.xml, or does your intent not match its declared <intent-filter>?");
    }
    // launching runs a nested onCreate; failures there crash the app (they are caught by launch())
    const ok = this.launch(intent.target, intent);
    void ok;
  }

  finishActivity(rec: ActivityRec): void {
    rec.finished = true;
    this.stack = this.stack.filter((r) => r !== rec);
    if (!this.stack.length) this.log("I", "ActivityTaskManager", "Activity " + rec.cls + " finished; the task is empty");
    this.touch();
  }
  back(): void {
    if (this.dialog) {
      this.dialog = null;
      this.touch();
      return;
    }
    const top = this.stack[this.stack.length - 1];
    if (!top) return;
    // a user-defined onBackPressed() is honoured
    const m = this.interp.findMethod(top.obj.cls, "onBackPressed", 0);
    if (m && !this.crash) {
      this.runGuarded(top.cls + ".onBackPressed", () => this.interp.callUser(m.fn, [], {}, top.obj, m.cls));
      return;
    }
    this.finishActivity(top);
  }

  // ------------------------------------------------------------------------------------------ events
  clickView(v: AView): void {
    if (!v.enabled || this.crash) return;
    this.runGuarded("onClick", () => {
      this.interp.startClock(5000);
      if (v.kType === "CheckBox" || v.kType === "Switch" || v.kType === "RadioButton" || v.kType === "ToggleButton" || v.kType === "SwitchCompat") {
        if (v.kType === "RadioButton" && v.checked) return;
        v.checked = !v.checked;
        this.fire(v.onChecked, [v, v.checked]);
      }
      this.fire(v.onClick, [v], "onClick");
    });
    this.touch();
  }
  private fire(handler: any, args: any[], method?: string): void {
    if (handler === null || handler === undefined) return;
    if (handler instanceof KObj && method) {
      const m = this.interp.findMethod(handler.cls, method, args.length);
      if (m) {
        this.interp.callUser(m.fn, args, {}, handler, m.cls);
        return;
      }
    }
    this.interp.callFn(handler, args);
  }
  private findViewByUid(root: AView | null, uid: string): AView | null {
    if (!root) return null;
    const base = uid.split("#")[0];
    if (root.uid === base) return root;
    for (let i = 0; i < root.children.length; i++) {
      const f = this.findViewByUid(root.children[i], uid);
      if (f) return f;
    }
    return null;
  }
  /** a tap on the node with this uid */
  click(uid: string): void {
    if (this.crash) return;
    const top = this.stack[this.stack.length - 1];
    if (uid.indexOf("dlg:") === 0) {
      const id = parseInt(uid.slice(4), 10);
      const d = this.dialog;
      this.dialog = null;
      if (d) {
        const b = d.buttons.filter((x) => x.id === id)[0];
        if (b && b.handler) this.runGuarded("onClick", () => this.interp.callFn(b.handler, [null, id]));
      }
      this.touch();
      return;
    }
    if (top && top.root) {
      const v = this.findViewByUid(top.root, uid);
      if (v) {
        const hash = uid.indexOf("#");
        if (hash > 0 && v.adapter) {
          const pos = parseInt(uid.slice(hash + 1), 10);
          this.runGuarded("onItemClick", () => this.fire(v.onItemClick, [v, null, pos, pos], "onItemClick"));
          this.touch();
          return;
        }
        this.clickView(v);
        return;
      }
    }
    const h = this.handlers[uid];
    if (h && h.click) {
      this.runGuarded("onClick", () => {
        this.interp.startClock(5000);
        this.interp.callFn(h.click, []);
      });
      this.touch();
    }
  }
  input(uid: string, text: string): void {
    if (this.crash) return;
    const top = this.stack[this.stack.length - 1];
    if (top && top.root) {
      const v = this.findViewByUid(top.root, uid);
      if (v) {
        v.text = text;
        this.runGuarded("afterTextChanged", () => {
          this.interp.startClock(5000);
          v.watchers.forEach((w) => {
            if (w instanceof KObj) {
              const b = this.interp.findMethod(w.cls, "beforeTextChanged", 4);
              const o = this.interp.findMethod(w.cls, "onTextChanged", 4);
              const a = this.interp.findMethod(w.cls, "afterTextChanged", 1);
              if (o) this.interp.callUser(o.fn, [text, 0, 0, text.length], {}, w, o.cls);
              if (b) void b;
              if (a) this.interp.callUser(a.fn, [text], {}, w, a.cls);
            } else this.interp.callFn(w, [text]);
          });
        });
        this.touch();
        return;
      }
    }
    const h = this.handlers[uid];
    if (h && h.change) {
      this.runGuarded("onValueChange", () => {
        this.interp.startClock(5000);
        this.interp.callFn(h.change, [h.numeric ? new Dbl(parseFloat(text) || 0) : text]);
      });
      this.touch();
    }
  }
  toggle(uid: string, checked: boolean): void {
    const h = this.handlers[uid];
    if (h && h.toggle) {
      this.runGuarded("onCheckedChange", () => this.interp.callFn(h.toggle, [checked]));
      this.touch();
    }
  }

  // ------------------------------------------------------------------------------------------ Compose
  private slotKey(it: Interp, kind: string): string {
    const c = this.cur;
    const p = it.callNode && it.callNode.p ? it.callNode.p[0] + ":" + it.callNode.p[1] : "?";
    const base = kind + "@" + p;
    if (!c) return base;
    c.counters[base] = (c.counters[base] || 0) + 1;
    return base + "#" + c.counters[base];
  }
  private curSlots(): { [k: string]: any } | null {
    return this.cur && this.cur.rec ? this.cur.rec.slots : null;
  }
  private remember(args: any[], it: Interp): any {
    const key = this.slotKey(it, "remember");
    const slots = this.curSlots();
    const calc = args[args.length - 1];
    const keys = args.slice(0, args.length - 1);
    if (!slots) return it.callFn(calc, []);
    const existing = slots[key];
    if (existing && existing.keys.length === keys.length && keys.every((k, i) => it.equals(k, existing.keys[i]))) return existing.v;
    const v = it.callFn(calc, []);
    slots[key] = { v, keys };
    return v;
  }

  private modStyle(m: any, it: Interp, node: UiNode): void {
    const st: { [k: string]: any } = {};
    if (m instanceof ModObj) {
      m.ops.forEach((o) => {
        const a = o.a;
        const n = (x: any) => (x === undefined || x === null || typeof x === "object" && !(x instanceof Dbl) ? null : num(x));
        switch (o.n) {
          case "fillMaxWidth":
            st.fillWidth = true;
            break;
          case "fillMaxHeight":
            st.fillHeight = true;
            break;
          case "fillMaxSize":
            st.fillWidth = true;
            st.fillHeight = true;
            break;
          case "padding":
            if (a.length === 1 && n(a[0]) !== null) st.padding = n(a[0]);
            else {
              const nm = o.named;
              st.padding = n(nm.all);
              if (nm.horizontal !== undefined) st.padX = n(nm.horizontal);
              if (nm.vertical !== undefined) st.padY = n(nm.vertical);
              if (a.length === 2) {
                st.padX = n(a[0]);
                st.padY = n(a[1]);
              }
            }
            break;
          case "size":
            st.width = n(a[0]);
            st.height = n(a.length > 1 ? a[1] : a[0]);
            break;
          case "width":
            st.width = n(a[0]);
            break;
          case "height":
            st.height = n(a[0]);
            break;
          case "background":
            st.bg = cssColor(a[0] || o.named.color);
            break;
          case "weight":
            st.weight = n(a[0]);
            break;
          case "alpha":
            st.alpha = n(a[0]);
            break;
          case "clickable":
            if (a.length) {
              this.cur!.handlers[node.uid] = { click: a[a.length - 1] };
              st.clickable = true;
            }
            break;
          default:
            break;
        }
      });
    }
    node.props.style = st;
  }

  private composable(name: string, it: Interp): any {
    const params = COMPOSE_PARAMS[name];
    return this.fn(name, (args, named) => {
      const cur = this.cur;
      if (!cur) it.throwEx("IllegalStateException", name + " must be called from a @Composable function (inside setContent { })");
      const trailing = !!(it.callNode && it.callNode.lam);
      const p: { [k: string]: any } = {};
      const positional = trailing ? args.slice(0, args.length - 1) : args.slice();
      const lam = trailing ? args[args.length - 1] : null;
      positional.forEach((v, i) => {
        if (params[i]) p[params[i]] = v;
      });
      Object.keys(named || {}).forEach((k) => (p[k] = named[k]));
      const parent = cur!.parent;
      const node: UiNode = { uid: parent.uid + "." + parent.children.length, type: name, props: {}, children: [] };
      parent.children.push(node);
      this.modStyle(p.modifier, it, node);
      const handlers = cur!.handlers;
      const content = (lamOrContent: any, extraArgs: any[] = []) => {
        if (!lamOrContent) return;
        const saved = cur!.parent;
        cur!.parent = node;
        try {
          it.callFn(lamOrContent, extraArgs);
        } finally {
          cur!.parent = saved;
        }
      };
      const section = (label: string, fnv: any, extraArgs: any[] = []) => {
        if (!fnv) return;
        const sec: UiNode = { uid: node.uid + "." + label, type: label, props: {}, children: [] };
        node.children.push(sec);
        const saved = cur!.parent;
        cur!.parent = sec;
        try {
          it.callFn(fnv, extraArgs);
        } finally {
          cur!.parent = saved;
        }
      };
      switch (name) {
        case "Text":
          node.props.text = p.text === undefined || p.text === null ? "" : it.kStr(p.text);
          node.props.color = cssColor(p.color);
          node.props.fontSize = p.fontSize !== undefined && typeof num(p.fontSize) === "number" && !(p.fontSize instanceof Tok) ? num(p.fontSize) : null;
          node.props.bold = p.fontWeight instanceof Tok && /Bold|SemiBold|Black/.test(p.fontWeight.name);
          node.props.align = p.textAlign instanceof Tok ? p.textAlign.name.replace(/^TextAlign\./, "") : null;
          if (p.style instanceof Tok) node.props.typo = p.style.name.replace(/^MaterialTheme\.typography\./, "");
          return undefined;
        case "Button":
        case "OutlinedButton":
        case "TextButton":
        case "ElevatedButton":
        case "FilledTonalButton":
        case "IconButton":
        case "FloatingActionButton":
        case "ExtendedFloatingActionButton":
          node.props.enabled = p.enabled !== false;
          if (p.onClick) handlers[node.uid] = Object.assign(handlers[node.uid] || {}, { click: p.onClick });
          content(lam || p.content);
          return undefined;
        case "TextField":
        case "OutlinedTextField":
          node.props.value = p.value === undefined || p.value === null ? "" : it.kStr(p.value);
          node.props.enabled = p.enabled !== false;
          if (p.label) {
            const lb: UiNode = { uid: node.uid + ".label", type: "Label", props: {}, children: [] };
            const saved = cur!.parent;
            cur!.parent = lb;
            try {
              it.callFn(p.label, []);
            } finally {
              cur!.parent = saved;
            }
            node.props.label = lb.children.length ? lb.children[0].props.text : "";
          }
          if (p.placeholder) {
            const pb: UiNode = { uid: node.uid + ".ph", type: "Label", props: {}, children: [] };
            const saved = cur!.parent;
            cur!.parent = pb;
            try {
              it.callFn(p.placeholder, []);
            } finally {
              cur!.parent = saved;
            }
            node.props.placeholder = pb.children.length ? pb.children[0].props.text : "";
          }
          if (p.keyboardOptions instanceof Tok && p.keyboardOptions.extra.named && p.keyboardOptions.extra.named.keyboardType instanceof Tok) node.props.keyboard = p.keyboardOptions.extra.named.keyboardType.name;
          if (p.singleLine === true) node.props.singleLine = true;
          handlers[node.uid] = Object.assign(handlers[node.uid] || {}, { change: p.onValueChange });
          return undefined;
        case "Checkbox":
        case "Switch":
          node.props.checked = p.checked === true;
          node.props.enabled = p.enabled !== false;
          handlers[node.uid] = Object.assign(handlers[node.uid] || {}, { toggle: p.onCheckedChange });
          return undefined;
        case "RadioButton":
          node.props.checked = p.selected === true;
          if (p.onClick) handlers[node.uid] = Object.assign(handlers[node.uid] || {}, { click: p.onClick });
          return undefined;
        case "Slider": {
          node.props.value = num(p.value);
          const r = p.valueRange;
          node.props.min = r && r.first !== undefined ? num(r.first) : 0;
          node.props.max = r && r.last !== undefined ? num(r.last) : 1;
          handlers[node.uid] = Object.assign(handlers[node.uid] || {}, { change: p.onValueChange, numeric: true });
          return undefined;
        }
        case "Scaffold": {
          section("topBar", p.topBar);
          const body: UiNode = { uid: node.uid + ".body", type: "ScaffoldBody", props: {}, children: [] };
          node.children.push(body);
          const saved = cur!.parent;
          cur!.parent = body;
          try {
            it.callFn(lam || p.content, [new Tok("PaddingValues")]);
          } finally {
            cur!.parent = saved;
          }
          section("bottomBar", p.bottomBar);
          section("fab", p.floatingActionButton);
          return undefined;
        }
        case "TopAppBar":
        case "CenterAlignedTopAppBar":
          section("title", p.title);
          return undefined;
        case "Column":
          node.props.hAlign = p.horizontalAlignment instanceof Tok ? p.horizontalAlignment.name : null;
          node.props.vArr = p.verticalArrangement instanceof Tok ? p.verticalArrangement.name : null;
          node.props.gap = p.verticalArrangement instanceof Tok && p.verticalArrangement.extra.args ? num(p.verticalArrangement.extra.args[0]) : 0;
          content(lam || p.content);
          return undefined;
        case "Row":
          node.props.vAlign = p.verticalAlignment instanceof Tok ? p.verticalAlignment.name : null;
          node.props.hArr = p.horizontalArrangement instanceof Tok ? p.horizontalArrangement.name : null;
          node.props.gap = p.horizontalArrangement instanceof Tok && p.horizontalArrangement.extra.args ? num(p.horizontalArrangement.extra.args[0]) : 0;
          content(lam || p.content);
          return undefined;
        case "LazyColumn":
        case "LazyRow":
          node.props.gap = p.verticalArrangement instanceof Tok && p.verticalArrangement.extra.args ? num(p.verticalArrangement.extra.args[0]) : 0;
          content(lam || p.content);
          return undefined;
        case "Box":
          node.props.align = p.contentAlignment instanceof Tok ? p.contentAlignment.name : null;
          content(lam || p.content);
          return undefined;
        case "Card":
        case "ElevatedCard":
        case "OutlinedCard":
        case "Surface":
          if (name === "Surface" && p.color !== undefined) node.props.bg = cssColor(p.color);
          content(lam || p.content);
          return undefined;
        case "Icon":
          node.props.description = p.contentDescription ? it.kStr(p.contentDescription) : "";
          return undefined;
        case "Image":
          node.props.description = p.contentDescription ? it.kStr(p.contentDescription) : "";
          return undefined;
        case "LinearProgressIndicator":
          node.props.progress = p.progress === undefined ? null : num(p.progress);
          return undefined;
        case "AlertDialog": {
          const title = p.title ? this.textOf(p.title, it) : "";
          const message = p.text ? this.textOf(p.text, it) : "";
          const buttons: { id: number; label: string; handler: any }[] = [];
          const addBtn = (fnv: any, id: number, onClick: any) => {
            if (!fnv) return;
            buttons.push({ id, label: this.textOfButton(fnv, it), handler: onClick });
          };
          addBtn(p.confirmButton, -1, p.onDismissRequest);
          addBtn(p.dismissButton, -2, p.onDismissRequest);
          this.dialog = { title, message, buttons };
          return undefined;
        }
        default:
          content(lam || p.content);
          return undefined;
      }
    });
  }
  private textOf(fnv: any, it: Interp): string {
    const tmp: UiNode = { uid: "tmp", type: "tmp", props: {}, children: [] };
    const saved = this.cur!.parent;
    this.cur!.parent = tmp;
    try {
      it.callFn(fnv, []);
    } finally {
      this.cur!.parent = saved;
    }
    return tmp.children.length ? String(tmp.children[0].props.text || "") : "";
  }
  private textOfButton(fnv: any, it: Interp): string {
    const tmp: UiNode = { uid: "tmpb", type: "tmp", props: {}, children: [] };
    const saved = this.cur!.parent;
    this.cur!.parent = tmp;
    try {
      it.callFn(fnv, []);
    } finally {
      this.cur!.parent = saved;
    }
    const b = tmp.children[0];
    return b && b.children.length ? String(b.children[0].props.text || "Button") : "Button";
  }

  private recompose(rec: ActivityRec): UiNode {
    const root: UiNode = { uid: "c", type: "ComposeRoot", props: {}, children: [] };
    this.cur = { parent: root, handlers: {}, counters: {}, rec };
    try {
      this.interp.startClock(5000);
      this.interp.callFn(rec.compose, []);
    } finally {
      this.handlers = this.cur.handlers;
      this.cur = null;
    }
    return root;
  }

  // ------------------------------------------------------------------------------------------ rendering
  private viewToNode(v: AView, it: Interp, activityLabel: string): UiNode {
    const node: UiNode = {
      uid: v.uid,
      type: v.kType,
      props: {
        text: v.text, hint: v.hint, textColor: v.textColor, textSize: v.textSize, bold: v.bold, bg: v.bg, visibility: v.visibility, enabled: v.enabled,
        checked: v.checked, progress: v.progress, max: v.max, inputType: v.inputType, error: v.error,
        orientation: v.attrs["orientation"] || null, gravity: v.attrs["gravity"] || null, width: v.attrs["layout_width"] || null,
        height: v.attrs["layout_height"] || null, weight: v.attrs["layout_weight"] || null,
        padding: v.attrs["padding"] || null, margin: v.attrs["layout_margin"] || null, id: v.id,
      },
      children: v.children.map((c) => this.viewToNode(c, it, activityLabel)),
    };
    if (v.adapter instanceof ArrayAdapterObj) {
      node.children = v.adapter.items.items.map((x: any, i: number) => ({
        uid: v.uid + "#" + i, type: "ListItem", props: { text: it.kStr(x) }, children: [],
      }));
    }
    return node;
  }

  screen(): ScreenState {
    const top = this.stack[this.stack.length - 1];
    const now = Date.now();
    this.toasts = this.toasts.filter((t) => t.until > now);
    const base: ScreenState = {
      activity: top ? top.cls : "", label: top ? top.label : this.appLabel, mode: "none", root: null, toasts: this.toasts.map((t) => t.text),
      dialog: null, crash: this.crash, canGoBack: this.stack.length > 0, version: this.version, finished: !top,
    };
    if (this.crash || !top) return base;
    try {
      if (top.root) {
        base.mode = "views";
        base.root = this.viewToNode(top.root, this.interp, top.label);
      } else if (top.compose) {
        base.mode = "compose";
        const savedDialog = this.dialog;
        base.root = this.recompose(top);
        if (this.dialog && this.dialog !== savedDialog) {
          /* dialog raised by composition */
        }
      }
    } catch (e) {
      this.handleFailure(e, top.cls + ".setContent");
      base.crash = this.crash;
      base.root = null;
    }
    if (this.dialog) {
      const d = this.dialog;
      base.dialog = { title: d.title, message: d.message, buttons: d.buttons.map((b) => ({ id: b.id, label: b.label })) };
    }
    return base;
  }
}

class MState {
  isDelegate = true;
  kType = "MutableState";
  v: any;
  constructor(v: any) {
    this.v = v;
  }
  getValue(): any {
    return this.v;
  }
  setValue(x: any): void {
    this.v = x;
  }
  getProp(name: string): any {
    return name === "value" ? this.v : NOPE;
  }
  setProp(name: string, x: any): boolean {
    if (name === "value") {
      this.v = x;
      return true;
    }
    return false;
  }
  call(name: string): any {
    if (name === "component1") return this.v;
    return NOPE;
  }
}

export { KFun };

/** compile-time check only (no execution): used for live Problems while the student types */
export function checkProject(files: ProjectFile[]): Diagnostic[] {
  const kt = files.filter((f) => f.kind === "kotlin" && !f.isTest && !/\/(test|androidTest)\//.test(f.path));
  return checkKotlin(kt.map((f) => ({ name: f.name, src: f.content })), {
    isKnownGlobal: (n) => ANDROID_LOWER_GLOBALS.indexOf(n) >= 0,
    isInheritedMember: (n) => ANDROID_MEMBERS.indexOf(n) >= 0,
  }).diagnostics;
}
