/** Runtime values of the LabMate Kotlin interpreter and the helpers every part of it shares: Kotlin's toString and
 *  equality, Double formatting identical to Kotlin's, Java-style String.format, exception hierarchy. */

export const NOPE: any = { nope: true };

/** Kotlin Double / Float (Int is a plain JS number; the wrapper keeps `5.0` distinct from `5`). */
export class Dbl {
  v: number;
  f: boolean;
  constructor(v: number, f?: boolean) {
    this.v = v;
    this.f = !!f;
  }
}
export class Ch {
  c: string;
  constructor(c: string) {
    this.c = c;
  }
}
export class KList {
  items: any[];
  mutable: boolean;
  /** called after a mutation (Compose state lists) */
  onChange?: () => void;
  constructor(items: any[], mutable = false) {
    this.items = items;
    this.mutable = mutable;
  }
}
export class KMap {
  m: { [k: string]: [any, any] } = {};
  mutable: boolean;
  constructor(mutable = false) {
    this.mutable = mutable;
  }
  put(k: any, v: any): any {
    const h = hashKey(k);
    const old = this.m[h] ? this.m[h][1] : null;
    this.m[h] = [k, v];
    return old;
  }
  get(k: any): any {
    const e = this.m[hashKey(k)];
    return e ? e[1] : null;
  }
  has(k: any): boolean {
    return !!this.m[hashKey(k)];
  }
  entries(): [any, any][] {
    return Object.keys(this.m).map((h) => this.m[h]);
  }
}
export class KSet {
  m: { [k: string]: any } = {};
  mutable: boolean;
  constructor(mutable = false) {
    this.mutable = mutable;
  }
  add(v: any): boolean {
    const h = hashKey(v);
    if (Object.prototype.hasOwnProperty.call(this.m, h)) return false;
    this.m[h] = v;
    return true;
  }
  has(v: any): boolean {
    return Object.prototype.hasOwnProperty.call(this.m, hashKey(v));
  }
  values(): any[] {
    return Object.keys(this.m).map((h) => this.m[h]);
  }
}
export class KPair {
  a: any;
  b: any;
  entry: boolean;
  constructor(a: any, b: any, entry = false) {
    this.a = a;
    this.b = b;
    this.entry = entry;
  }
}
/** first..last (inclusive) walking by `step` (negative for downTo) */
export class KRange {
  first: number;
  last: number;
  step: number;
  isChar: boolean;
  constructor(first: number, last: number, step = 1, isChar = false) {
    this.first = first;
    this.last = last;
    this.step = step;
    this.isChar = isChar;
  }
  toArray(): number[] {
    const out: number[] = [];
    if (this.step > 0) for (let x = this.first; x <= this.last; x += this.step) out.push(x);
    else for (let x = this.first; x >= this.last; x += this.step) out.push(x);
    return out;
  }
  has(x: number): boolean {
    if (this.step > 0) return x >= this.first && x <= this.last && (x - this.first) % this.step === 0;
    return x <= this.first && x >= this.last && (this.first - x) % -this.step === 0;
  }
}

export interface Ref {
  v: any;
  mut: boolean;
  ty?: string;
  /** property delegate (Compose state): reads and writes go to `.value` */
  del?: any;
  thunk?: () => any;
  done?: boolean;
}

export class Scope {
  vars: { [k: string]: Ref } = {};
  parent: Scope | null;
  /** implicit receiver of this scope (a method's object, an apply/with/run lambda's subject) */
  recv: any = undefined;
  hasRecv = false;
  fnName?: string;
  constructor(parent: Scope | null) {
    this.parent = parent;
  }
  declare(n: string, v: any, mut: boolean, ty?: string): Ref {
    const r: Ref = { v, mut, ty };
    this.vars[n] = r;
    return r;
  }
  lookup(n: string): Ref | null {
    let s: Scope | null = this;
    while (s) {
      const r = s.vars[n];
      if (r) return r;
      s = s.parent;
    }
    return null;
  }
}

export interface ClassInfo {
  name: string;
  decl: any;
  kind: "class" | "interface" | "object";
  superName?: string;
  superInfo?: ClassInfo;
  nativeSuper?: string;
  interfaces: string[];
  methods: { [name: string]: any[] };
  getters: { [name: string]: any };
  isData: boolean;
  isEnum: boolean;
  entries: KObj[];
  companion?: KObj;
  singleton?: KObj;
  /** scope the class was declared in */
  scope: Scope;
  abstract: boolean;
}

let nextId = 1;
export class KObj {
  cls: ClassInfo;
  f: { [k: string]: any } = {};
  native: any = null;
  id = nextId++;
  /** property delegates (var x by remember { ... }) keyed by property name */
  delegates: { [k: string]: any } = {};
  enumName?: string;
  ordinal?: number;
  constructor(cls: ClassInfo) {
    this.cls = cls;
  }
}

export class KFun {
  kind = "fun";
  name: string;
  params: any[];
  body?: any[];
  exprBody?: any;
  scope: Scope;
  isLambda: boolean;
  hasParams: boolean;
  thisObj?: any;
  decl?: any;
  constructor(name: string, params: any[], scope: Scope, isLambda: boolean) {
    this.name = name;
    this.params = params;
    this.scope = scope;
    this.isLambda = isLambda;
    this.hasParams = true;
  }
}
export class NativeFn {
  kind = "native";
  name: string;
  fn: (args: any[], named: any) => any;
  constructor(name: string, fn: (args: any[], named: any) => any) {
    this.name = name;
    this.fn = fn;
  }
}

/** A Kotlin exception (java.lang.* / kotlin.* types and their messages) */
export class KEx {
  name: string;
  message: string | null;
  cause: any = null;
  trace: string[] = [];
  constructor(name: string, message: string | null = null) {
    this.name = name;
    this.message = message;
  }
}

export class ReturnSig {
  value: any;
  label?: string;
  constructor(value: any, label?: string) {
    this.value = value;
    this.label = label;
  }
}
export class BreakSig {
  label?: string;
  constructor(label?: string) {
    this.label = label;
  }
}
export class ContinueSig {
  label?: string;
  constructor(label?: string) {
    this.label = label;
  }
}
export class ThrowSig {
  value: any;
  constructor(value: any) {
    this.value = value;
  }
}
/** the interpreter's own limits (steps, time, unsupported feature): not catchable by Kotlin try/catch */
export class StopSig {
  message: string;
  constructor(message: string) {
    this.message = message;
  }
}

// ------------------------------------------------------------------------------------------ exceptions
const EX_PARENT: { [k: string]: string } = {
  Exception: "Throwable", Error: "Throwable", RuntimeException: "Exception", IllegalArgumentException: "RuntimeException",
  IllegalStateException: "RuntimeException", ArithmeticException: "RuntimeException", NullPointerException: "RuntimeException",
  IndexOutOfBoundsException: "RuntimeException", ArrayIndexOutOfBoundsException: "IndexOutOfBoundsException",
  StringIndexOutOfBoundsException: "IndexOutOfBoundsException", NumberFormatException: "IllegalArgumentException",
  UnsupportedOperationException: "RuntimeException", ClassCastException: "RuntimeException", NoSuchElementException: "RuntimeException",
  ConcurrentModificationException: "RuntimeException", IOException: "Exception", FileNotFoundException: "IOException",
  InterruptedException: "Exception", SQLException: "Exception", SQLiteException: "RuntimeException", ActivityNotFoundException: "RuntimeException",
  NotImplementedError: "Error", StackOverflowError: "Error", OutOfMemoryError: "Error", AssertionError: "Error",
  NoSuchFieldException: "Exception", SQLiteConstraintException: "SQLiteException", SecurityException: "RuntimeException", JSONException: "Exception", Resources$NotFoundException: "RuntimeException",
};
const EX_PACKAGE: { [k: string]: string } = {
  IOException: "java.io", FileNotFoundException: "java.io", NoSuchElementException: "java.util", ConcurrentModificationException: "java.util",
  NotImplementedError: "kotlin", SQLException: "java.sql", SQLiteException: "android.database.sqlite", SQLiteConstraintException: "android.database.sqlite",
  ActivityNotFoundException: "android.content", Throwable: "java.lang",
};
export function isExceptionName(n: string): boolean {
  return n === "Throwable" || EX_PARENT[n] !== undefined;
}
export function exceptionIsA(name: string, target: string): boolean {
  let n: string | undefined = name;
  while (n) {
    if (n === target) return true;
    n = EX_PARENT[n];
  }
  return false;
}
export function exceptionFqn(name: string): string {
  return (EX_PACKAGE[name] || "java.lang") + "." + name;
}

// ------------------------------------------------------------------------------------------ numbers
export function shortestFloat32(x: number): string {
  for (let p = 1; p <= 9; p++) {
    const s = x.toPrecision(p);
    if (Math.fround(Number(s)) === x) return s;
  }
  return String(x);
}

/** Double.toString()/Float.toString() as the JVM prints them */
export function formatDouble(d: number, isFloat = false): string {
  if (d !== d) return "NaN";
  if (d === Infinity) return "Infinity";
  if (d === -Infinity) return "-Infinity";
  if (d === 0) return 1 / d < 0 ? "-0.0" : "0.0";
  const abs = Math.abs(d);
  let digits: string;
  let exp: number;
  const e = (isFloat ? Number(shortestFloat32(d)) : d).toExponential();
  const m = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(e)!;
  digits = m[2] + (m[3] || "");
  exp = parseInt(m[4], 10);
  const sign = m[1];
  if (abs >= 1e-3 && abs < 1e7) {
    let s: string;
    if (exp >= 0) {
      const intLen = exp + 1;
      s = digits.length <= intLen ? digits + "0".repeat(intLen - digits.length) + ".0" : digits.slice(0, intLen) + "." + digits.slice(intLen);
    } else s = "0." + "0".repeat(-exp - 1) + digits;
    return sign + s;
  }
  const frac = digits.slice(1) || "0";
  return sign + digits.charAt(0) + "." + frac + "E" + exp;
}

/** half-up rounding of the decimal expansion Java's Formatter works from (the shortest representation of the double) */
export function toFixedJava(x: number, prec: number): string {
  if (x !== x) return "NaN";
  if (x === Infinity) return "Infinity";
  if (x === -Infinity) return "-Infinity";
  const neg = x < 0 || (x === 0 && 1 / x < 0);
  const m = /^(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(Math.abs(x).toExponential())!;
  let digits = m[1] + (m[2] || "");
  let exp = parseInt(m[3], 10); // value = 0.d1d2... * 10^(exp+1)
  // position of the decimal point relative to the start of `digits`
  let point = exp + 1;
  if (point <= 0) {
    digits = "0".repeat(-point + 1) + digits;
    point = 1;
  }
  while (digits.length < point + prec + 1) digits += "0";
  const keep = point + prec;
  let kept = digits.slice(0, keep);
  const next = digits.charAt(keep);
  if (next >= "5") {
    // increment kept as a decimal string
    const arr = kept.split("");
    let k = arr.length - 1;
    while (k >= 0) {
      if (arr[k] === "9") {
        arr[k] = "0";
        k--;
      } else {
        arr[k] = String.fromCharCode(arr[k].charCodeAt(0) + 1);
        break;
      }
    }
    kept = (k < 0 ? "1" : "") + arr.join("");
    if (k < 0) point++;
  }
  let intPart = kept.slice(0, point) || "0";
  const fracPart = kept.slice(point);
  intPart = intPart.replace(/^0+(?=\d)/, "");
  const out = prec > 0 ? intPart + "." + fracPart : intPart;
  const isZero = /^[0.]*$/.test(out);
  return (neg && !isZero ? "-" : neg && isZero && x !== 0 ? "-" : "") + out;
}

function group(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function javaFormat(fmt: string, args: any[], str: (v: any) => string): string {
  let argIndex = 0;
  return fmt.replace(/%(\d+\$)?([-#+ 0,(]*)(\d+)?(\.\d+)?([a-zA-Z%])/g, (all, pos, flags, width, precision, conv) => {
    if (conv === "%") return "%";
    if (conv === "n") return "\n";
    const idx = pos ? parseInt(pos, 10) - 1 : argIndex++;
    if (idx >= args.length) throw new ThrowSig(new KEx("MissingFormatArgumentException", "Format specifier '" + all + "'"));
    let v = args[idx];
    const prec = precision ? parseInt(precision.slice(1), 10) : -1;
    let body: string;
    const c = conv.toLowerCase();
    if (c === "d") {
      if (typeof v !== "number" || !Number.isInteger(v)) throw new ThrowSig(new KEx("IllegalFormatConversionException", "d != " + (v instanceof Dbl ? "java.lang.Double" : "java.lang.String")));
      body = String(Math.abs(v));
      if (flags.indexOf(",") >= 0) body = group(body);
      const sign = v < 0 ? "-" : flags.indexOf("+") >= 0 ? "+" : flags.indexOf(" ") >= 0 ? " " : "";
      body = sign + body;
    } else if (c === "f" || c === "e" || c === "g") {
      const num = v instanceof Dbl ? v.v : typeof v === "number" ? NaN : NaN;
      if (!(v instanceof Dbl)) throw new ThrowSig(new KEx("IllegalFormatConversionException", conv + " != " + (typeof v === "number" ? "java.lang.Integer" : "java.lang.String")));
      const p = prec < 0 ? 6 : prec;
      if (c === "f") {
        let s = toFixedJava(Math.abs(num), p);
        if (flags.indexOf(",") >= 0) {
          const parts = s.split(".");
          s = group(parts[0]) + (parts[1] !== undefined ? "." + parts[1] : "");
        }
        body = (num < 0 || (num === 0 && 1 / num < 0) ? "-" : flags.indexOf("+") >= 0 ? "+" : flags.indexOf(" ") >= 0 ? " " : "") + s;
      } else {
        body = num.toExponential(p).replace(/e([+-])(\d)$/, "e$10$2");
        if (conv === "E") body = body.toUpperCase();
      }
    } else if (c === "s") {
      body = str(v);
      if (prec >= 0) body = body.slice(0, prec);
    } else if (c === "b") body = String(v !== null && v !== false);
    else if (c === "c") body = v instanceof Ch ? v.c : String.fromCharCode(v);
    else if (c === "x") body = (v < 0 ? v + 4294967296 : v).toString(16);
    else if (c === "o") body = v.toString(8);
    else throw new ThrowSig(new KEx("UnknownFormatConversionException", "Conversion = '" + conv + "'"));
    if (conv === conv.toUpperCase() && conv !== "%") body = body.toUpperCase();
    if (width) {
      const w = parseInt(width, 10);
      if (body.length < w) {
        if (flags.indexOf("-") >= 0) body = body + " ".repeat(w - body.length);
        else if (flags.indexOf("0") >= 0 && c !== "s") {
          const neg = /^[-+]/.test(body) ? body.charAt(0) : "";
          body = neg + "0".repeat(w - body.length) + body.slice(neg.length);
        } else body = " ".repeat(w - body.length) + body;
      }
    }
    return body;
  });
}

// ------------------------------------------------------------------------------------------ type names
export function typeName(v: any): string {
  if (v === null || v === undefined) return "Nothing?";
  if (typeof v === "number") return "Int";
  if (typeof v === "string") return "String";
  if (typeof v === "boolean") return "Boolean";
  if (v instanceof Dbl) return v.f ? "Float" : "Double";
  if (v instanceof Ch) return "Char";
  if (v instanceof KList) return v.mutable ? "MutableList" : "List";
  if (v instanceof KMap) return "Map";
  if (v instanceof KSet) return "Set";
  if (v instanceof KPair) return v.entry ? "Entry" : "Pair";
  if (v instanceof KRange) return "IntRange";
  if (v instanceof KObj) return v.cls.name;
  if (v instanceof KEx) return v.name;
  if (v instanceof KFun || v instanceof NativeFn) return "Function";
  if (v && v.kType) return v.kType;
  return "Any";
}

function classIsA(cls: ClassInfo | undefined, target: string): boolean {
  let c: ClassInfo | undefined = cls;
  while (c) {
    if (c.name === target || c.interfaces.indexOf(target) >= 0 || c.nativeSuper === target) return true;
    if (c.nativeSuper && (target === "Activity" || target === "Context") && /Activity$/.test(c.nativeSuper)) return true;
    if (c.nativeSuper && isExceptionName(c.nativeSuper) && exceptionIsA(c.nativeSuper, target)) return true;
    c = c.superInfo;
  }
  return false;
}

export function isInstance(v: any, target: string): boolean {
  if (target === "Any" || target === "Any?") return v !== null && v !== undefined;
  if (v === null || v === undefined) return false;
  if (v instanceof KObj) return classIsA(v.cls, target);
  if (v instanceof KEx) return exceptionIsA(v.name, target);
  switch (target) {
    case "Int":
    case "Long":
    case "Short":
    case "Byte":
      return typeof v === "number" && Number.isInteger(v);
    case "Double":
      return v instanceof Dbl && !v.f;
    case "Float":
      return v instanceof Dbl && v.f;
    case "Number":
      return typeof v === "number" || v instanceof Dbl;
    case "String":
    case "CharSequence":
      return typeof v === "string";
    case "Boolean":
      return typeof v === "boolean";
    case "Char":
      return v instanceof Ch;
    case "List":
    case "Collection":
    case "Iterable":
      return v instanceof KList;
    case "MutableList":
    case "ArrayList":
      return v instanceof KList && v.mutable;
    case "Map":
    case "MutableMap":
    case "HashMap":
      return v instanceof KMap;
    case "Set":
    case "MutableSet":
      return v instanceof KSet;
    case "Pair":
      return v instanceof KPair;
    case "Comparable":
      return typeof v === "number" || typeof v === "string" || v instanceof Dbl || v instanceof Ch;
    default:
      return !!(v && v.kType === target) || (v && v.isA ? v.isA(target) : false);
  }
}

// ------------------------------------------------------------------------------------------ equality / hashing / text
export function hashKey(v: any): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return "n:" + v;
  if (typeof v === "string") return "s:" + v;
  if (typeof v === "boolean") return "b:" + v;
  if (v instanceof Dbl) return "n:" + v.v;
  if (v instanceof Ch) return "c:" + v.c;
  if (v instanceof KPair) return "p:(" + hashKey(v.a) + "," + hashKey(v.b) + ")";
  if (v instanceof KList) return "l:[" + v.items.map(hashKey).join(",") + "]";
  if (v instanceof KObj) {
    if (v.cls.isData) return "d:" + v.cls.name + "(" + dataFields(v).map((k) => hashKey(v.f[k])).join(",") + ")";
    if (v.cls.isEnum) return "e:" + v.cls.name + "." + v.enumName;
    return "o:" + v.id;
  }
  return "x:" + (v && v.id !== undefined ? v.id : String(v));
}

export function dataFields(o: KObj): string[] {
  const params = (o.cls.decl.params || []).filter((p: any) => p.prop);
  return params.map((p: any) => p.n);
}

export function kEquals(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  const an = a instanceof Dbl ? a.v : a;
  const bn = b instanceof Dbl ? b.v : b;
  if (typeof an === "number" && typeof bn === "number") return an === bn;
  if (a instanceof Ch && b instanceof Ch) return a.c === b.c;
  if (a instanceof KPair && b instanceof KPair) return kEquals(a.a, b.a) && kEquals(a.b, b.b);
  if (a instanceof KList && b instanceof KList) {
    if (a.items.length !== b.items.length) return false;
    for (let i = 0; i < a.items.length; i++) if (!kEquals(a.items[i], b.items[i])) return false;
    return true;
  }
  if (a instanceof KSet && b instanceof KSet) {
    const av = a.values();
    return av.length === b.values().length && av.every((x) => b.has(x));
  }
  if (a instanceof KMap && b instanceof KMap) {
    const ae = a.entries();
    return ae.length === b.entries().length && ae.every((e) => b.has(e[0]) && kEquals(e[1], b.get(e[0])));
  }
  if (a instanceof KObj && b instanceof KObj && a.cls === b.cls && a.cls.isData) {
    return dataFields(a).every((k) => kEquals(a.f[k], b.f[k]));
  }
  return false;
}

export function compareValues(a: any, b: any): number {
  const x = a instanceof Dbl ? a.v : a instanceof Ch ? a.c : a;
  const y = b instanceof Dbl ? b.v : b instanceof Ch ? b.c : b;
  if (typeof x === "boolean" && typeof y === "boolean") return x === y ? 0 : x ? 1 : -1;
  return x < y ? -1 : x > y ? 1 : 0;
}

export function num(v: any): number {
  return v instanceof Dbl ? v.v : v;
}
