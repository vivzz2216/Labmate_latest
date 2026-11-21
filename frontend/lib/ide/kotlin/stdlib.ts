/** The slice of the Kotlin standard library (and java.lang / java.util basics) the LabMate runtime implements. */
import type { Interp } from "./interp";
import { NsObj } from "./interp";
import {
  Ch, Dbl, KEx, KList, KMap, KObj, KPair, KRange, KSet, NOPE, NativeFn, ThrowSig, javaFormat, num, typeName,
} from "./values";

const D = (x: number) => new Dbl(x);
const L = (items: any[], mutable = false) => new KList(items, mutable);
type Fn = (it: Interp, args: any[], named: any, node?: any) => any;

function parseIntStrict(it: Interp, s: string, radix = 10): number {
  const re = radix === 10 ? /^[+-]?\d+$/ : /^[+-]?[0-9a-zA-Z]+$/;
  if (!re.test(s) || isNaN(parseInt(s, radix))) it.throwEx("NumberFormatException", 'For input string: "' + s + '"' + (radix !== 10 ? " under radix " + radix : ""));
  return parseInt(s, radix);
}
function parseDoubleStrict(it: Interp, s: string): number {
  const t = s.trim();
  if (!/^[+-]?(\d+\.?\d*([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?|NaN|Infinity)$/.test(t)) it.throwEx("NumberFormatException", s === "" ? "empty String" : 'For input string: "' + s + '"');
  return t === "NaN" ? NaN : parseFloat(t);
}
function intOrNull(s: string): number | null {
  return /^[+-]?\d+$/.test(s) && isFinite(parseInt(s, 10)) ? parseInt(s, 10) : null;
}
function doubleOrNull(s: string): number | null {
  const t = s.trim();
  return /^[+-]?(\d+\.?\d*([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?)$/.test(t) ? parseFloat(t) : null;
}
function pad(s: string, n: number, ch: string, start: boolean): string {
  if (s.length >= n) return s;
  const fill = new Array(n - s.length + 1).join(ch);
  return start ? fill + s : s + fill;
}

// ------------------------------------------------------------------------------------------ properties
export function getBuiltinProp(it: Interp, o: any, name: string): any {
  if (typeof o === "string") {
    if (name === "length") return o.length;
    if (name === "indices") return new KRange(0, o.length - 1);
    if (name === "lastIndex") return o.length - 1;
    return NOPE;
  }
  if (o instanceof KList) {
    if (name === "size") return o.items.length;
    if (name === "indices") return new KRange(0, o.items.length - 1);
    if (name === "lastIndex") return o.items.length - 1;
    return NOPE;
  }
  if (o instanceof KMap) {
    if (name === "size") return o.entries().length;
    if (name === "keys") {
      const s = new KSet(false);
      o.entries().forEach((e) => s.add(e[0]));
      return s;
    }
    if (name === "values") return L(o.entries().map((e) => e[1]));
    if (name === "entries") {
      const s = new KSet(false);
      o.entries().forEach((e) => s.add(new KPair(e[0], e[1], true)));
      return L(o.entries().map((e) => new KPair(e[0], e[1], true)));
    }
    return NOPE;
  }
  if (o instanceof KSet) return name === "size" ? o.values().length : NOPE;
  if (o instanceof KPair) {
    if (name === "first" || name === "key") return o.a;
    if (name === "second" || name === "value") return o.b;
    return NOPE;
  }
  if (o instanceof KRange) {
    if (name === "first") return o.isChar ? new Ch(String.fromCharCode(o.first)) : o.first;
    if (name === "last") return o.isChar ? new Ch(String.fromCharCode(o.last)) : o.last;
    if (name === "step") return Math.abs(o.step);
    return NOPE;
  }
  if (o instanceof Ch) {
    if (name === "code") return o.c.charCodeAt(0);
    return NOPE;
  }
  if (o instanceof Dbl) {
    if (name === "absoluteValue") return new Dbl(Math.abs(o.v), o.f);
    if (name === "dp" || name === "sp") return o;
    return NOPE;
  }
  if (typeof o === "number") {
    if (name === "absoluteValue") return Math.abs(o);
    if (name === "dp" || name === "sp") return new Dbl(o);
    return NOPE;
  }
  if (o instanceof KEx) {
    if (name === "message" || name === "localizedMessage") return o.message;
    if (name === "cause") return o.cause;
    return NOPE;
  }
  return NOPE;
}

// ------------------------------------------------------------------------------------------ member calls
export function callBuiltinMember(it: Interp, o: any, name: string, args: any[], named: any): any {
  if (typeof o === "string") return stringMember(it, o, name, args, named);
  if (typeof o === "number" || o instanceof Dbl) return numberMember(it, o, name, args, named);
  if (o instanceof Ch) return charMember(it, o, name, args);
  if (typeof o === "boolean") {
    if (name === "not") return !o;
    if (name === "toString") return String(o);
    return NOPE;
  }
  if (o instanceof KList) return listMember(it, o, name, args, named);
  if (o instanceof KMap) return mapMember(it, o, name, args, named);
  if (o instanceof KSet) return setMember(it, o, name, args, named);
  if (o instanceof KPair) {
    if (name === "component1") return o.a;
    if (name === "component2") return o.b;
    if (name === "toList") return L([o.a, o.b]);
    if (name === "toString") return it.kStr(o);
    if (name === "copy") return new KPair(args[0] !== undefined ? args[0] : o.a, args[1] !== undefined ? args[1] : o.b);
    return NOPE;
  }
  if (o instanceof KRange) {
    if (name === "reversed") return new KRange(o.last, o.first, -o.step, o.isChar);
    if (name === "step") return new KRange(o.first, o.last, o.step < 0 ? -args[0] : args[0], o.isChar);
    if (name === "contains") return it.contains(o, args[0]);
    if (name === "isEmpty") return o.toArray().length === 0;
    if (name === "random") {
      const a = o.toArray();
      return a[Math.floor(Math.random() * a.length)];
    }
    const items: any[] = o.isChar ? o.toArray().map((c) => new Ch(String.fromCharCode(c))) : o.toArray();
    return iterableOp(it, items, name, args, named);
  }
  if (o instanceof KEx) {
    if (name === "stackTraceToString") return it.kStr(o);
    return NOPE;
  }
  return NOPE;
}

function cmpBy(it: Interp, fn: any, desc = false) {
  return (a: any, b: any) => {
    const c = it.compare(it.callFn(fn, [a]), it.callFn(fn, [b]));
    return desc ? -c : c;
  };
}

function charMember(it: Interp, c: Ch, name: string, args: any[]): any {
  const ch = c.c;
  switch (name) {
    case "isDigit":
      return /[0-9]/.test(ch);
    case "isLetter":
      return /[A-Za-zÀ-￿]/.test(ch);
    case "isLetterOrDigit":
      return /[A-Za-z0-9À-￿]/.test(ch);
    case "isUpperCase":
      return ch !== ch.toLowerCase() && ch === ch.toUpperCase();
    case "isLowerCase":
      return ch !== ch.toUpperCase() && ch === ch.toLowerCase();
    case "isWhitespace":
      return /\s/.test(ch);
    case "uppercase":
      return ch.toUpperCase();
    case "lowercase":
      return ch.toLowerCase();
    case "uppercaseChar":
      return new Ch(ch.toUpperCase());
    case "lowercaseChar":
      return new Ch(ch.toLowerCase());
    case "digitToInt":
      if (!/[0-9a-zA-Z]/.test(ch)) it.throwEx("IllegalArgumentException", "Char " + ch + " is not a decimal digit");
      return parseInt(ch, 36);
    case "toInt":
    case "code":
      return ch.charCodeAt(0);
    case "toString":
      return ch;
    case "plus":
      return typeof args[0] === "string" ? ch + args[0] : new Ch(String.fromCharCode(ch.charCodeAt(0) + args[0]));
    case "minus":
      return args[0] instanceof Ch ? ch.charCodeAt(0) - args[0].c.charCodeAt(0) : new Ch(String.fromCharCode(ch.charCodeAt(0) - args[0]));
    case "compareTo":
      return ch < args[0].c ? -1 : ch > args[0].c ? 1 : 0;
    case "equals":
      return args[0] instanceof Ch && args[0].c === ch;
    default:
      return NOPE;
  }
}

function numberMember(it: Interp, o: any, name: string, args: any[], named: any): any {
  const isD = o instanceof Dbl;
  const v = num(o);
  switch (name) {
    case "toString":
      return args.length && typeof args[0] === "number" ? v.toString(args[0]) : it.kStr(o);
    case "toInt":
    case "toLong":
    case "toShort":
    case "toByte": {
      if (v !== v) return 0;
      return Math.trunc(Math.max(Math.min(v, 2147483647), -2147483648));
    }
    case "toDouble":
      return new Dbl(v);
    case "toFloat":
      return new Dbl(Math.fround(v), true);
    case "toChar":
      return new Ch(String.fromCharCode(v));
    case "roundToInt":
    case "roundToLong":
      return Math.floor(v + 0.5);
    case "plus":
      return it.arith("+", o, args[0], null);
    case "minus":
      return it.arith("-", o, args[0], null);
    case "times":
      return it.arith("*", o, args[0], null);
    case "div":
      return it.arith("/", o, args[0], null);
    case "rem":
    case "mod":
      return it.arith("%", o, args[0], null);
    case "unaryMinus":
      return isD ? new Dbl(-v, o.f) : -v;
    case "inc":
      return v + 1;
    case "dec":
      return v - 1;
    case "compareTo":
      return v < num(args[0]) ? -1 : v > num(args[0]) ? 1 : 0;
    case "equals":
      return typeof num(args[0]) === "number" && num(args[0]) === v;
    case "coerceAtLeast":
      return it.compare(o, args[0]) < 0 ? args[0] : o;
    case "coerceAtMost":
      return it.compare(o, args[0]) > 0 ? args[0] : o;
    case "coerceIn": {
      const lo = args[0] instanceof KRange ? args[0].first : args[0];
      const hi = args[0] instanceof KRange ? args[0].last : args[1];
      return v < num(lo) ? lo : v > num(hi) ? hi : o;
    }
    case "pow":
      return new Dbl(Math.pow(v, num(args[0])));
    case "isNaN":
      return v !== v;
    case "isInfinite":
      return v === Infinity || v === -Infinity;
    case "sign":
      return isD ? new Dbl(Math.sign(v)) : Math.sign(v);
    case "until":
      return new KRange(v, args[0] - 1);
    case "downTo":
      return new KRange(v, args[0], -1);
    case "rangeTo":
      return new KRange(v, args[0]);
    case "shl":
      return v << args[0];
    case "shr":
      return v >> args[0];
    case "and":
      return v & args[0];
    case "or":
      return v | args[0];
    case "xor":
      return v ^ args[0];
    case "toBigDecimal":
      return o;
    default:
      return NOPE;
  }
}

function stringMember(it: Interp, s: string, name: string, args: any[], named: any): any {
  const str = (x: any) => it.kStr(x);
  switch (name) {
    case "lowercase":
    case "toLowerCase":
      return s.toLowerCase();
    case "uppercase":
    case "toUpperCase":
      return s.toUpperCase();
    case "trim":
      return s.trim();
    case "trimStart":
      return s.replace(/^\s+/, "");
    case "trimEnd":
      return s.replace(/\s+$/, "");
    case "trimIndent": {
      const lines = s.split("\n");
      while (lines.length && lines[0].trim() === "") lines.shift();
      while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
      const indent = Math.min.apply(null, lines.filter((l) => l.trim() !== "").map((l) => (/^\s*/.exec(l) as any)[0].length).concat([1000]));
      return lines.map((l) => l.slice(Math.min(indent, l.length))).join("\n");
    }
    case "trimMargin": {
      const m = args.length ? str(args[0]) : "|";
      return s.split("\n").map((l) => (l.trim().indexOf(m) === 0 ? l.slice(l.indexOf(m) + m.length) : l)).filter((_, i, a) => !(i === 0 && a[0].trim() === "") ).join("\n");
    }
    case "split": {
      const delims = args.filter((a) => typeof a === "string");
      let parts: string[];
      if (args[0] && args[0].kType === "Regex") parts = s.split(args[0].re);
      else if (delims.length === 1) parts = s.split(delims[0]);
      else {
        const re = new RegExp("(" + delims.map((d: string) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")");
        parts = s.split(re).filter((_, i) => i % 2 === 0);
      }
      return L(parts);
    }
    case "substring": {
      const a = args[0];
      const b = args.length > 1 ? args[1] : s.length;
      if (a < 0 || b > s.length || a > b) it.throwEx("StringIndexOutOfBoundsException", "begin " + a + ", end " + b + ", length " + s.length);
      return s.substring(a, b);
    }
    case "substringBefore": {
      const i = s.indexOf(args[0]);
      return i < 0 ? (args[1] !== undefined ? args[1] : s) : s.slice(0, i);
    }
    case "substringAfter": {
      const i = s.indexOf(args[0]);
      return i < 0 ? (args[1] !== undefined ? args[1] : s) : s.slice(i + args[0].length);
    }
    case "contains": {
      if (args[0] && args[0].kType === "Regex") return args[0].re.test(s);
      const ic = named && named.ignoreCase === true || args[1] === true;
      const t = args[0] instanceof Ch ? args[0].c : str(args[0]);
      return ic ? s.toLowerCase().indexOf(t.toLowerCase()) >= 0 : s.indexOf(t) >= 0;
    }
    case "startsWith":
      return ((named && named.ignoreCase) || args[1] === true ? s.toLowerCase().indexOf(str(args[0]).toLowerCase()) === 0 : s.indexOf(str(args[0])) === 0);
    case "endsWith": {
      const t = args[0] instanceof Ch ? args[0].c : str(args[0]);
      return ((named && named.ignoreCase) || args[1] === true ? s.toLowerCase().endsWith(t.toLowerCase()) : s.endsWith(t));
    }
    case "indexOf":
      return s.indexOf(args[0] instanceof Ch ? args[0].c : str(args[0]), args[1] || 0);
    case "lastIndexOf":
      return s.lastIndexOf(args[0] instanceof Ch ? args[0].c : str(args[0]));
    case "replace": {
      if (args[0] && args[0].kType === "Regex") return s.replace(new RegExp(args[0].re.source, "g" + args[0].re.flags.replace("g", "")), str(args[1]).replace(/\$/g, "$$$$"));
      const from = args[0] instanceof Ch ? args[0].c : str(args[0]);
      const to = args[1] instanceof Ch ? args[1].c : str(args[1]);
      return s.split(from).join(to);
    }
    case "replaceFirst":
      return s.replace(args[0] instanceof Ch ? args[0].c : str(args[0]), args[1] instanceof Ch ? args[1].c : str(args[1]));
    case "replaceFirstChar": {
      if (!s) return s;
      const r = it.callFn(args[0], [new Ch(s.charAt(0))]);
      return (r instanceof Ch ? r.c : str(r)) + s.slice(1);
    }
    case "capitalize":
      return s.charAt(0).toUpperCase() + s.slice(1);
    case "decapitalize":
      return s.charAt(0).toLowerCase() + s.slice(1);
    case "isEmpty":
      return s.length === 0;
    case "isNotEmpty":
      return s.length > 0;
    case "isBlank":
      return s.trim().length === 0;
    case "isNotBlank":
      return s.trim().length > 0;
    case "isNullOrEmpty":
      return s.length === 0;
    case "isNullOrBlank":
      return s.trim().length === 0;
    case "orEmpty":
      return s;
    case "ifEmpty":
      return s.length === 0 ? it.callFn(args[0], []) : s;
    case "toInt":
    case "toLong":
    case "toShort":
    case "toByte":
      return parseIntStrict(it, s, args[0] || 10);
    case "toIntOrNull":
    case "toLongOrNull":
      return intOrNull(s);
    case "toDouble":
      return new Dbl(parseDoubleStrict(it, s));
    case "toFloat":
      return new Dbl(Math.fround(parseDoubleStrict(it, s)), true);
    case "toDoubleOrNull":
    case "toFloatOrNull": {
      const d = doubleOrNull(s);
      return d === null ? null : new Dbl(d);
    }
    case "toBoolean":
      return s.toLowerCase() === "true";
    case "toCharArray":
      return L(s.split("").map((c) => new Ch(c)), true);
    case "toList":
      return L(s.split("").map((c) => new Ch(c)));
    case "toRegex":
      return makeRegex(s);
    case "reversed":
      return s.split("").reverse().join("");
    case "repeat":
      return new Array(args[0] + 1).join(s);
    case "take":
      return s.slice(0, args[0]);
    case "drop":
      return s.slice(args[0]);
    case "takeLast":
      return args[0] === 0 ? "" : s.slice(-args[0]);
    case "dropLast":
      return s.slice(0, Math.max(0, s.length - args[0]));
    case "first":
      if (!s.length) it.throwEx("NoSuchElementException", "Char sequence is empty.");
      return new Ch(s.charAt(0));
    case "last":
      if (!s.length) it.throwEx("NoSuchElementException", "Char sequence is empty.");
      return new Ch(s.charAt(s.length - 1));
    case "firstOrNull":
      return s.length ? new Ch(s.charAt(0)) : null;
    case "lastOrNull":
      return s.length ? new Ch(s.charAt(s.length - 1)) : null;
    case "get":
      return it.getIndex(s, args[0]);
    case "padStart":
      return pad(s, args[0], args[1] instanceof Ch ? args[1].c : " ", true);
    case "padEnd":
      return pad(s, args[0], args[1] instanceof Ch ? args[1].c : " ", false);
    case "format":
      return javaFormat(s, args, str);
    case "equals":
      return (named && named.ignoreCase) || args[1] === true ? typeof args[0] === "string" && s.toLowerCase() === args[0].toLowerCase() : s === args[0];
    case "compareTo":
      return s < args[0] ? -1 : s > args[0] ? 1 : 0;
    case "toString":
      return s;
    case "hashCode": {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      return h;
    }
    case "lines":
      return L(s.split(/\r?\n/));
    case "matches":
      return args[0] && args[0].kType === "Regex" ? new RegExp("^(?:" + args[0].re.source + ")$", args[0].re.flags).test(s) : false;
    case "plus":
      return s + str(args[0]);
    case "count":
      return args.length ? s.split("").filter((c) => it.callFn(args[0], [new Ch(c)]) === true).length : s.length;
    case "chars":
      return L(s.split("").map((c) => c.charCodeAt(0)));
    case "contentEquals":
      return s === args[0];
    case "removePrefix":
      return s.indexOf(args[0]) === 0 ? s.slice(args[0].length) : s;
    case "removeSuffix":
      return s.endsWith(args[0]) ? s.slice(0, s.length - args[0].length) : s;
    case "removeRange":
      return s.slice(0, args[0]) + s.slice(args[1]);
    default: {
      // collection operators on the characters (map, filter, any, all, forEach, ...)
      if (["map", "filter", "filterNot", "forEach", "forEachIndexed", "any", "all", "none", "mapIndexed", "sumOf", "asSequence", "withIndex", "groupBy", "partition", "sorted", "distinct", "indexOfFirst", "indexOfLast", "find", "takeWhile", "dropWhile", "joinToString", "zip", "fold", "reduce", "associate", "toSet", "toMutableList", "sortedBy", "count", "max", "min", "maxOrNull", "minOrNull"].indexOf(name) < 0) return NOPE;
      const r = iterableOp(it, s.split("").map((c) => new Ch(c)), name, args, named);
      if (r instanceof KList && (name === "filter" || name === "filterNot" || name === "takeWhile" || name === "dropWhile") && r.items.every((x) => x instanceof Ch)) return r.items.map((x) => x.c).join("");
      return r;
    }
  }
}

// ------------------------------------------------------------------------------------------ collections
function needMutable(it: Interp, ok: boolean): void {
  if (!ok) it.throwEx("UnsupportedOperationException", null);
}

function listMember(it: Interp, o: KList, name: string, args: any[], named: any): any {
  const a = o.items;
  const changed = () => {
    if (o.onChange) o.onChange();
  };
  switch (name) {
    case "add":
      needMutable(it, o.mutable);
      if (args.length === 2) {
        if (args[0] < 0 || args[0] > a.length) it.throwEx("IndexOutOfBoundsException", "Index: " + args[0] + ", Size: " + a.length);
        a.splice(args[0], 0, args[1]);
      } else a.push(args[0]);
      changed();
      return true;
    case "addAll": {
      needMutable(it, o.mutable);
      const src = args[args.length - 1];
      const items = src instanceof KList ? src.items : src instanceof KSet ? src.values() : [];
      if (args.length === 2) (a.splice as any).apply(a, [args[0], 0].concat(items));
      else a.push.apply(a, items);
      changed();
      return items.length > 0;
    }
    case "remove": {
      needMutable(it, o.mutable);
      const i = a.findIndex((x) => it.equals(x, args[0]));
      if (i >= 0) a.splice(i, 1);
      changed();
      return i >= 0;
    }
    case "removeAt": {
      needMutable(it, o.mutable);
      if (args[0] < 0 || args[0] >= a.length) it.throwEx("IndexOutOfBoundsException", "Index " + args[0] + " out of bounds for length " + a.length);
      const r = a.splice(args[0], 1)[0];
      changed();
      return r;
    }
    case "removeFirst":
    case "removeLast": {
      needMutable(it, o.mutable);
      if (!a.length) it.throwEx("NoSuchElementException", "List is empty.");
      const r = name === "removeFirst" ? a.shift() : a.pop();
      changed();
      return r;
    }
    case "removeAll":
    case "removeIf": {
      needMutable(it, o.mutable);
      const before = a.length;
      const keep = a.filter((x) => (name === "removeIf" ? it.callFn(args[0], [x]) !== true : !(args[0] instanceof KList && args[0].items.some((y) => it.equals(x, y)))));
      a.length = 0;
      a.push.apply(a, keep);
      changed();
      return a.length !== before;
    }
    case "clear":
      needMutable(it, o.mutable);
      a.length = 0;
      changed();
      return undefined;
    case "set": {
      needMutable(it, o.mutable);
      if (args[0] < 0 || args[0] >= a.length) it.throwEx("IndexOutOfBoundsException", "Index " + args[0] + " out of bounds for length " + a.length);
      const old = a[args[0]];
      a[args[0]] = args[1];
      changed();
      return old;
    }
    case "get":
      return it.getIndex(o, args[0]);
    case "sort":
    case "sortDescending":
    case "sortBy":
    case "sortByDescending":
    case "reverse":
    case "shuffle": {
      needMutable(it, o.mutable);
      if (name === "reverse") a.reverse();
      else if (name === "shuffle") a.sort(() => Math.random() - 0.5);
      else {
        const sorted = iterableOp(it, a, name === "sort" ? "sorted" : name === "sortDescending" ? "sortedDescending" : name === "sortBy" ? "sortedBy" : "sortedByDescending", args, named) as KList;
        a.length = 0;
        a.push.apply(a, sorted.items);
      }
      changed();
      return undefined;
    }
    case "subList":
      return L(a.slice(args[0], args[1]));
    case "toString":
      return it.kStr(o);
    case "equals":
      return it.equals(o, args[0]);
    case "hashCode":
      return a.length;
    case "toTypedArray":
    case "toIntArray":
    case "toDoubleArray":
      return L(a.slice(), true);
    case "contentToString":
      return it.kStr(o);
    case "asReversed":
      return L(a.slice().reverse());
    default:
      return iterableOp(it, a, name, args, named);
  }
}

function setMember(it: Interp, o: KSet, name: string, args: any[], named: any): any {
  switch (name) {
    case "add":
      needMutable(it, o.mutable);
      return o.add(args[0]);
    case "addAll": {
      needMutable(it, o.mutable);
      let changed = false;
      const src = args[0];
      (src instanceof KList ? src.items : src instanceof KSet ? src.values() : []).forEach((x: any) => {
        if (o.add(x)) changed = true;
      });
      return changed;
    }
    case "remove": {
      needMutable(it, o.mutable);
      const had = o.has(args[0]);
      const keep = o.values().filter((x) => !it.equals(x, args[0]));
      o.m = {};
      keep.forEach((x) => o.add(x));
      return had;
    }
    case "clear":
      needMutable(it, o.mutable);
      o.m = {};
      return undefined;
    case "contains":
      return o.has(args[0]);
    case "toString":
      return it.kStr(o);
    case "equals":
      return it.equals(o, args[0]);
    case "union":
    case "plus": {
      const s = new KSet(false);
      o.values().forEach((x) => s.add(x));
      (args[0] instanceof KSet ? args[0].values() : args[0] instanceof KList ? args[0].items : [args[0]]).forEach((x: any) => s.add(x));
      return s;
    }
    case "intersect": {
      const s = new KSet(false);
      const other = args[0] instanceof KSet ? args[0] : (() => { const t = new KSet(); (args[0] as KList).items.forEach((x) => t.add(x)); return t; })();
      o.values().forEach((x) => other.has(x) && s.add(x));
      return s;
    }
    case "subtract":
    case "minus": {
      const s = new KSet(false);
      const other = args[0] instanceof KSet ? args[0].values() : args[0] instanceof KList ? args[0].items : [args[0]];
      o.values().forEach((x) => !other.some((y: any) => it.equals(x, y)) && s.add(x));
      return s;
    }
    default:
      return iterableOp(it, o.values(), name, args, named);
  }
}

function mapMember(it: Interp, o: KMap, name: string, args: any[], named: any): any {
  switch (name) {
    case "put":
      needMutable(it, o.mutable);
      return o.put(args[0], args[1]);
    case "set":
      needMutable(it, o.mutable);
      o.put(args[0], args[1]);
      return undefined;
    case "get":
      return o.get(args[0]);
    case "getValue":
      if (!o.has(args[0])) it.throwEx("NoSuchElementException", "Key " + it.kStr(args[0]) + " is missing in the map.");
      return o.get(args[0]);
    case "getOrDefault":
      return o.has(args[0]) ? o.get(args[0]) : args[1];
    case "getOrElse":
      return o.has(args[0]) ? o.get(args[0]) : it.callFn(args[1], []);
    case "getOrPut": {
      if (o.has(args[0])) return o.get(args[0]);
      const v = it.callFn(args[1], []);
      o.put(args[0], v);
      return v;
    }
    case "containsKey":
      return o.has(args[0]);
    case "containsValue":
      return o.entries().some((e) => it.equals(e[1], args[0]));
    case "remove": {
      needMutable(it, o.mutable);
      const old = o.get(args[0]);
      const keep = o.entries().filter((e) => !it.equals(e[0], args[0]));
      o.m = {};
      keep.forEach((e) => o.put(e[0], e[1]));
      return old;
    }
    case "clear":
      needMutable(it, o.mutable);
      o.m = {};
      return undefined;
    case "putAll":
      needMutable(it, o.mutable);
      args[0].entries().forEach((e: any) => o.put(e[0], e[1]));
      return undefined;
    case "isEmpty":
      return o.entries().length === 0;
    case "isNotEmpty":
      return o.entries().length > 0;
    case "forEach":
      o.entries().forEach((e) => it.callFn(args[0], [new KPair(e[0], e[1], true)]));
      return undefined;
    case "mapValues":
    case "mapKeys": {
      const m = new KMap(false);
      o.entries().forEach((e) => {
        const r = it.callFn(args[0], [new KPair(e[0], e[1], true)]);
        if (name === "mapValues") m.put(e[0], r);
        else m.put(r, e[1]);
      });
      return m;
    }
    case "filter":
    case "filterKeys":
    case "filterValues": {
      const m = new KMap(false);
      o.entries().forEach((e) => {
        const ok = name === "filter" ? it.callFn(args[0], [new KPair(e[0], e[1], true)]) : it.callFn(args[0], [name === "filterKeys" ? e[0] : e[1]]);
        if (ok === true) m.put(e[0], e[1]);
      });
      return m;
    }
    case "toMap":
    case "toMutableMap": {
      const m = new KMap(name === "toMutableMap");
      o.entries().forEach((e) => m.put(e[0], e[1]));
      return m;
    }
    case "toList":
      return L(o.entries().map((e) => new KPair(e[0], e[1])));
    case "toString":
      return it.kStr(o);
    case "equals":
      return it.equals(o, args[0]);
    case "plus": {
      return it.arith("+", o, args[0], null);
    }
    default:
      return iterableOp(it, o.entries().map((e) => new KPair(e[0], e[1], true)), name, args, named);
  }
}

function sumOf(it: Interp, values: any[]): any {
  let dbl = false;
  let total = 0;
  values.forEach((v) => {
    if (v instanceof Dbl) dbl = true;
    total += num(v);
  });
  return dbl ? new Dbl(total) : total;
}

function iterableOp(it: Interp, a: any[], name: string, args: any[], named: any): any {
  const call = (f: any, ...xs: any[]) => it.callFn(f, xs);
  const f = args[0];
  switch (name) {
    case "isEmpty":
      return a.length === 0;
    case "isNotEmpty":
      return a.length > 0;
    case "isNullOrEmpty":
      return a.length === 0;
    case "orEmpty":
      return L(a);
    case "contains":
      return a.some((x) => it.equals(x, f));
    case "containsAll":
      return (f as KList).items.every((y) => a.some((x) => it.equals(x, y)));
    case "indexOf":
      return a.findIndex((x) => it.equals(x, f));
    case "lastIndexOf": {
      for (let i = a.length - 1; i >= 0; i--) if (it.equals(a[i], f)) return i;
      return -1;
    }
    case "indexOfFirst":
      return a.findIndex((x) => call(f, x) === true);
    case "indexOfLast": {
      for (let i = a.length - 1; i >= 0; i--) if (call(f, a[i]) === true) return i;
      return -1;
    }
    case "first":
      if (f) {
        const r = a.find((x) => call(f, x) === true);
        if (r === undefined) it.throwEx("NoSuchElementException", "Collection contains no element matching the predicate.");
        return r;
      }
      if (!a.length) it.throwEx("NoSuchElementException", "List is empty.");
      return a[0];
    case "last":
      if (f) {
        for (let i = a.length - 1; i >= 0; i--) if (call(f, a[i]) === true) return a[i];
        it.throwEx("NoSuchElementException", "Collection contains no element matching the predicate.");
      }
      if (!a.length) it.throwEx("NoSuchElementException", "List is empty.");
      return a[a.length - 1];
    case "firstOrNull":
      if (f) {
        const r = a.find((x) => call(f, x) === true);
        return r === undefined ? null : r;
      }
      return a.length ? a[0] : null;
    case "find": {
      const r = a.find((x) => call(f, x) === true);
      return r === undefined ? null : r;
    }
    case "lastOrNull": {
      if (f) {
        for (let i = a.length - 1; i >= 0; i--) if (call(f, a[i]) === true) return a[i];
        return null;
      }
      return a.length ? a[a.length - 1] : null;
    }
    case "single":
      if (a.length !== 1) it.throwEx(a.length ? "IllegalArgumentException" : "NoSuchElementException", a.length ? "List has more than one element." : "List is empty.");
      return a[0];
    case "getOrNull":
      return f >= 0 && f < a.length ? a[f] : null;
    case "getOrElse":
      return f >= 0 && f < a.length ? a[f] : call(args[1], f);
    case "elementAt":
      if (f < 0 || f >= a.length) it.throwEx("IndexOutOfBoundsException", "Index " + f + " out of bounds for length " + a.length);
      return a[f];
    case "random":
      if (!a.length) it.throwEx("NoSuchElementException", "Collection is empty.");
      return a[Math.floor(Math.random() * a.length)];
    case "forEach":
      a.forEach((x) => call(f, x));
      return undefined;
    case "forEachIndexed":
      a.forEach((x, i) => call(f, i, x));
      return undefined;
    case "onEach":
      a.forEach((x) => call(f, x));
      return L(a);
    case "map":
      return L(a.map((x) => call(f, x)));
    case "mapIndexed":
      return L(a.map((x, i) => call(f, i, x)));
    case "mapNotNull":
      return L(a.map((x) => call(f, x)).filter((x) => x !== null && x !== undefined));
    case "flatMap": {
      const out: any[] = [];
      a.forEach((x) => {
        const r = call(f, x);
        (r instanceof KList ? r.items : r instanceof KSet ? r.values() : [r]).forEach((y: any) => out.push(y));
      });
      return L(out);
    }
    case "flatten": {
      const out: any[] = [];
      a.forEach((x) => (x instanceof KList ? x.items : x.values()).forEach((y: any) => out.push(y)));
      return L(out);
    }
    case "filter":
      return L(a.filter((x) => call(f, x) === true));
    case "filterNot":
      return L(a.filter((x) => call(f, x) !== true));
    case "filterIndexed":
      return L(a.filter((x, i) => call(f, i, x) === true));
    case "filterNotNull":
      return L(a.filter((x) => x !== null && x !== undefined));
    case "filterIsInstance":
      return L(a);
    case "any":
      return f ? a.some((x) => call(f, x) === true) : a.length > 0;
    case "all":
      return a.every((x) => call(f, x) === true);
    case "none":
      return f ? !a.some((x) => call(f, x) === true) : a.length === 0;
    case "count":
      return f ? a.filter((x) => call(f, x) === true).length : a.length;
    case "sum":
      return sumOf(it, a);
    case "sumOf":
    case "sumBy":
    case "sumByDouble": {
      const vals = a.map((x) => call(f, x));
      return name === "sumByDouble" ? D(num(sumOf(it, vals))) : sumOf(it, vals);
    }
    case "average": {
      if (!a.length) return D(NaN);
      return D(a.reduce((s, x) => s + num(x), 0) / a.length);
    }
    case "max":
    case "min":
    case "maxOrNull":
    case "minOrNull": {
      if (!a.length) {
        if (name === "max" || name === "min") it.throwEx("NoSuchElementException", "Collection is empty.");
        return null;
      }
      let best = a[0];
      a.forEach((x) => {
        const c = it.compare(x, best);
        if ((name.indexOf("max") === 0 && c > 0) || (name.indexOf("min") === 0 && c < 0)) best = x;
      });
      return best;
    }
    case "maxBy":
    case "minBy":
    case "maxByOrNull":
    case "minByOrNull":
    case "maxOf":
    case "minOf": {
      if (!a.length) {
        if (name.indexOf("OrNull") < 0) it.throwEx("NoSuchElementException", "Collection is empty.");
        return null;
      }
      let best = a[0];
      let bestKey = call(f, a[0]);
      a.forEach((x) => {
        const k = call(f, x);
        const c = it.compare(k, bestKey);
        if ((name.indexOf("max") === 0 && c > 0) || (name.indexOf("min") === 0 && c < 0)) {
          best = x;
          bestKey = k;
        }
      });
      return name === "maxOf" || name === "minOf" ? bestKey : best;
    }
    case "sorted":
      return L(a.slice().sort((x, y) => it.compare(x, y)));
    case "sortedDescending":
      return L(a.slice().sort((x, y) => it.compare(y, x)));
    case "sortedBy":
      return L(a.slice().sort(cmpBy(it, f)));
    case "sortedByDescending":
      return L(a.slice().sort(cmpBy(it, f, true)));
    case "sortedWith":
      return L(a.slice().sort((x, y) => num(it.callFn(f, [x, y]))));
    case "reversed":
      return L(a.slice().reverse());
    case "distinct": {
      const s = new KSet(false);
      a.forEach((x) => s.add(x));
      return L(s.values());
    }
    case "take":
      return L(a.slice(0, f));
    case "drop":
      return L(a.slice(f));
    case "takeLast":
      return L(f === 0 ? [] : a.slice(-f));
    case "dropLast":
      return L(a.slice(0, Math.max(0, a.length - f)));
    case "takeWhile": {
      const out: any[] = [];
      for (let i = 0; i < a.length; i++) {
        if (call(f, a[i]) !== true) break;
        out.push(a[i]);
      }
      return L(out);
    }
    case "dropWhile": {
      let i = 0;
      while (i < a.length && call(f, a[i]) === true) i++;
      return L(a.slice(i));
    }
    case "toList":
    case "asSequence":
    case "asIterable":
    case "toMutableList":
    case "asList":
      return L(a.slice(), name === "toMutableList");
    case "toSet":
    case "toMutableSet": {
      const s = new KSet(name === "toMutableSet");
      a.forEach((x) => s.add(x));
      return s;
    }
    case "withIndex":
      return L(a.map((x, i) => new KPair(i, x)));
    case "zip":
      return L(a.slice(0, Math.min(a.length, (f as KList).items.length)).map((x, i) => new KPair(x, (f as KList).items[i])));
    case "joinToString": {
      const sep = named && named.separator !== undefined ? named.separator : typeof args[0] === "string" ? args[0] : ", ";
      const prefix = named && named.prefix !== undefined ? named.prefix : typeof args[1] === "string" ? args[1] : "";
      const postfix = named && named.postfix !== undefined ? named.postfix : typeof args[2] === "string" ? args[2] : "";
      const transform = named && named.transform ? named.transform : args.filter((x) => x && (x.kind === "fun" || x.kind === "native"))[0];
      return prefix + a.map((x) => (transform ? it.kStr(call(transform, x)) : it.kStr(x))).join(sep) + postfix;
    }
    case "fold": {
      let acc = f;
      a.forEach((x) => (acc = call(args[1], acc, x)));
      return acc;
    }
    case "reduce": {
      if (!a.length) it.throwEx("UnsupportedOperationException", "Empty collection can't be reduced.");
      let acc = a[0];
      for (let i = 1; i < a.length; i++) acc = call(f, acc, a[i]);
      return acc;
    }
    case "groupBy": {
      const m = new KMap(false);
      a.forEach((x) => {
        const k = call(f, x);
        const cur = m.get(k);
        if (cur) cur.items.push(args[1] ? call(args[1], x) : x);
        else m.put(k, L([args[1] ? call(args[1], x) : x], true));
      });
      return m;
    }
    case "associate": {
      const m = new KMap(false);
      a.forEach((x) => {
        const p = call(f, x) as KPair;
        m.put(p.a, p.b);
      });
      return m;
    }
    case "associateBy": {
      const m = new KMap(false);
      a.forEach((x) => m.put(call(f, x), x));
      return m;
    }
    case "associateWith": {
      const m = new KMap(false);
      a.forEach((x) => m.put(x, call(f, x)));
      return m;
    }
    case "partition": {
      const yes: any[] = [];
      const no: any[] = [];
      a.forEach((x) => (call(f, x) === true ? yes : no).push(x));
      return new KPair(L(yes), L(no));
    }
    case "chunked": {
      const out: any[] = [];
      for (let i = 0; i < a.length; i += f) out.push(L(a.slice(i, i + f)));
      return L(out);
    }
    case "windowed": {
      const out: any[] = [];
      for (let i = 0; i + f <= a.length; i += args[1] || 1) out.push(L(a.slice(i, i + f)));
      return L(out);
    }
    case "plus":
      return L(a.concat(f instanceof KList ? f.items : [f]));
    case "minus":
      return L(a.filter((x) => !it.equals(x, f)));
    case "subList":
      return L(a.slice(f, args[1]));
    case "iterator":
      return L(a);
    case "toString":
      return it.kStr(L(a));
    case "intersect":
    case "union":
    case "subtract":
      return NOPE;
    default:
      return NOPE;
  }
}

// ------------------------------------------------------------------------------------------ StringBuilder, Regex
class SB {
  kType = "StringBuilder";
  s = "";
  call(name: string, args: any[], named: any, it: Interp): any {
    switch (name) {
      case "append":
        this.s += it.kStr(args[0]);
        return this;
      case "appendLine":
        this.s += (args.length ? it.kStr(args[0]) : "") + "\n";
        return this;
      case "toString":
        return this.s;
      case "insert":
        this.s = this.s.slice(0, args[0]) + it.kStr(args[1]) + this.s.slice(args[0]);
        return this;
      case "reverse":
        this.s = this.s.split("").reverse().join("");
        return this;
      case "clear":
        this.s = "";
        return this;
      case "setLength":
        this.s = this.s.slice(0, args[0]);
        return undefined;
      case "deleteCharAt":
        this.s = this.s.slice(0, args[0]) + this.s.slice(args[0] + 1);
        return this;
      case "isEmpty":
        return this.s.length === 0;
      case "isNotEmpty":
        return this.s.length > 0;
      case "get":
      case "charAt":
        return new Ch(this.s.charAt(args[0]));
      case "length":
        return this.s.length;
      default:
        return stringMember(it, this.s, name, args, named);
    }
  }
  getProp(name: string): any {
    return name === "length" ? this.s.length : NOPE;
  }
  toString(): string {
    return this.s;
  }
}

function makeRegex(src: string, ignoreCase = false): any {
  return {
    kType: "Regex",
    re: new RegExp(src, ignoreCase ? "i" : ""),
    toString() {
      return src;
    },
    call(name: string, args: any[], named: any, it: Interp) {
      const re: RegExp = this.re;
      switch (name) {
        case "matches":
          return new RegExp("^(?:" + re.source + ")$", re.flags).test(args[0]);
        case "containsMatchIn":
          return re.test(args[0]);
        case "find": {
          const m = re.exec(args[0]);
          return m ? matchResult(m) : null;
        }
        case "findAll":
          return L((args[0].match(new RegExp(re.source, re.flags + "g")) || []).map((x: string) => matchResult([x] as any)));
        case "replace":
          return args[0].replace(new RegExp(re.source, "g" + re.flags), it.kStr(args[1]));
        case "split":
          return L(args[0].split(re));
        default:
          return NOPE;
      }
    },
  };
}
function matchResult(m: RegExpExecArray): any {
  return {
    kType: "MatchResult",
    getProp(name: string) {
      if (name === "value") return m[0];
      if (name === "groupValues") return L(Array.prototype.slice.call(m).map((x: any) => x || ""));
      return NOPE;
    },
  };
}

// ------------------------------------------------------------------------------------------ globals
function makeList(args: any[], mutable: boolean): KList {
  return L(args.length === 1 && args[0] instanceof KList && false ? args[0].items.slice() : args.slice(), mutable);
}
function makeMap(it: Interp, args: any[], mutable: boolean): KMap {
  const m = new KMap(mutable);
  args.forEach((p) => {
    if (!(p instanceof KPair)) it.throwEx("IllegalArgumentException", "mapOf expects pairs (key to value)");
    m.put(p.a, p.b);
  });
  return m;
}
function makeSet(args: any[], mutable: boolean): KSet {
  const s = new KSet(mutable);
  args.forEach((x) => s.add(x));
  return s;
}
function fill(it: Interp, n: number, init: any, mutable: boolean): KList {
  const out: any[] = [];
  for (let i = 0; i < n; i++) out.push(typeof init === "function" ? init(i) : init && (init.kind === "fun" || init.kind === "native") ? it.callFn(init, [i]) : init);
  return L(out, mutable);
}

export const globalFunctions: { [n: string]: Fn } = {
  println: (it, a) => (it.host.stdout(a.length ? it.kStr(a[0]) : "", true), undefined),
  print: (it, a) => (it.host.stdout(it.kStr(a[0]), false), undefined),
  listOf: (it, a) => makeList(a, false),
  mutableListOf: (it, a) => makeList(a, true),
  arrayListOf: (it, a) => makeList(a, true),
  arrayOf: (it, a) => makeList(a, true),
  intArrayOf: (it, a) => makeList(a, true),
  doubleArrayOf: (it, a) => makeList(a.map((x) => (x instanceof Dbl ? x : D(x))), true),
  booleanArrayOf: (it, a) => makeList(a, true),
  charArrayOf: (it, a) => makeList(a, true),
  emptyList: () => L([]),
  listOfNotNull: (it, a) => L(a.filter((x) => x !== null)),
  setOf: (it, a) => makeSet(a, false),
  mutableSetOf: (it, a) => makeSet(a, true),
  hashSetOf: (it, a) => makeSet(a, true),
  linkedSetOf: (it, a) => makeSet(a, true),
  emptySet: () => new KSet(false),
  mapOf: (it, a) => makeMap(it, a, false),
  mutableMapOf: (it, a) => makeMap(it, a, true),
  hashMapOf: (it, a) => makeMap(it, a, true),
  linkedMapOf: (it, a) => makeMap(it, a, true),
  emptyMap: () => new KMap(false),
  Pair: (it, a) => new KPair(a[0], a[1]),
  repeat: (it, a) => {
    for (let i = 0; i < a[0]; i++) it.callFn(a[1], [i]);
    return undefined;
  },
  require: (it, a) => {
    if (a[0] !== true) it.throwEx("IllegalArgumentException", a[1] ? (typeof a[1] === "string" ? a[1] : it.kStr(it.callFn(a[1], []))) : "Failed requirement.");
    return undefined;
  },
  requireNotNull: (it, a) => {
    if (a[0] === null) it.throwEx("IllegalArgumentException", a[1] ? it.kStr(it.callFn(a[1], [])) : "Required value was null.");
    return a[0];
  },
  check: (it, a) => {
    if (a[0] !== true) it.throwEx("IllegalStateException", a[1] ? (typeof a[1] === "string" ? a[1] : it.kStr(it.callFn(a[1], []))) : "Check failed.");
    return undefined;
  },
  checkNotNull: (it, a) => {
    if (a[0] === null) it.throwEx("IllegalStateException", "Required value was null.");
    return a[0];
  },
  assert: (it, a) => {
    if (a[0] !== true) it.throwEx("AssertionError", "Assertion failed");
    return undefined;
  },
  error: (it, a) => it.throwEx("IllegalStateException", it.kStr(a[0])),
  TODO: (it, a) => it.throwEx("NotImplementedError", "An operation is not implemented" + (a.length ? ": " + it.kStr(a[0]) : "."))
  ,
  maxOf: (it, a) => a.reduce((m, x) => (it.compare(x, m) > 0 ? x : m)),
  minOf: (it, a) => a.reduce((m, x) => (it.compare(x, m) < 0 ? x : m)),
  run: (it, a) => it.callFn(a[0], []),
  with: (it, a) => it.callWithReceiver(a[1], a[0]),
  lazy: (it, a) => {
    let done = false;
    let value: any;
    return {
      isDelegate: true,
      getValue() {
        if (!done) {
          done = true;
          value = it.callFn(a[0], []);
        }
        return value;
      },
      setValue() {
        it.throwEx("UnsupportedOperationException", "Val cannot be reassigned");
      },
    };
  },
  buildString: (it, a) => {
    const sb = new SB();
    it.callWithReceiver(a[0], sb);
    return sb.s;
  },
  StringBuilder: (it, a) => {
    const sb = new SB();
    if (a.length && typeof a[0] === "string") sb.s = a[0];
    return sb;
  },
  readLine: () => null,
  readln: (it) => it.throwEx("RuntimeException", "readln() has no input in the LabMate preview"),
  arrayOfNulls: (it, a) => fill(it, a[0], null, true),
  Array: (it, a) => fill(it, a[0], a[1], true),
  IntArray: (it, a) => fill(it, a[0], a[1] || 0, true),
  DoubleArray: (it, a) => fill(it, a[0], a[1] || D(0), true),
  BooleanArray: (it, a) => fill(it, a[0], a[1] || false, true),
  List: (it, a) => fill(it, a[0], a[1], false),
  MutableList: (it, a) => fill(it, a[0], a[1], true),
  ArrayList: (it, a) => L(a.length && a[0] instanceof KList ? a[0].items.slice() : [], true),
  HashMap: () => new KMap(true),
  LinkedHashMap: () => new KMap(true),
  HashSet: () => new KSet(true),
  LinkedHashSet: () => new KSet(true),
  compareBy: (it, a) => new NativeFn("comparator", (x) => it.compare(it.callFn(a[0], [x[0]]), it.callFn(a[0], [x[1]]))),
  compareByDescending: (it, a) => new NativeFn("comparator", (x) => -it.compare(it.callFn(a[0], [x[0]]), it.callFn(a[0], [x[1]]))),
  Regex: (it, a, n) => makeRegex(a[0], (a[1] && a[1].enumName === "IGNORE_CASE") || false),
  // kotlin.math
  sqrt: (it, a) => D(Math.sqrt(num(a[0]))),
  abs: (it, a) => (a[0] instanceof Dbl ? new Dbl(Math.abs(a[0].v), a[0].f) : Math.abs(a[0])),
  pow: (it, a) => D(Math.pow(num(a[0]), num(a[1]))),
  floor: (it, a) => D(Math.floor(num(a[0]))),
  ceil: (it, a) => D(Math.ceil(num(a[0]))),
  round: (it, a) => D(Math.round(num(a[0]))),
  sin: (it, a) => D(Math.sin(num(a[0]))),
  cos: (it, a) => D(Math.cos(num(a[0]))),
  tan: (it, a) => D(Math.tan(num(a[0]))),
  ln: (it, a) => D(Math.log(num(a[0]))),
  log10: (it, a) => D(Math.log10(num(a[0]))),
  exp: (it, a) => D(Math.exp(num(a[0]))),
  max: (it, a) => (it.compare(a[0], a[1]) >= 0 ? a[0] : a[1]),
  min: (it, a) => (it.compare(a[0], a[1]) <= 0 ? a[0] : a[1]),
};

function staticNs(): { [n: string]: (it: Interp) => any } {
  const fn = (name: string, f: (it: Interp, a: any[]) => any) => new NativeFn(name, (a: any[]) => f(currentInterp!, a));
  return {
    Math: () => new NsObj("Math", {
      PI: D(Math.PI), E: D(Math.E),
      sqrt: fn("sqrt", (it, a) => D(Math.sqrt(num(a[0])))), pow: fn("pow", (it, a) => D(Math.pow(num(a[0]), num(a[1])))),
      abs: fn("abs", (it, a) => (a[0] instanceof Dbl ? new Dbl(Math.abs(a[0].v), a[0].f) : Math.abs(a[0]))),
      max: fn("max", (it, a) => (a[0] instanceof Dbl || a[1] instanceof Dbl ? D(Math.max(num(a[0]), num(a[1]))) : Math.max(a[0], a[1]))),
      min: fn("min", (it, a) => (a[0] instanceof Dbl || a[1] instanceof Dbl ? D(Math.min(num(a[0]), num(a[1]))) : Math.min(a[0], a[1]))),
      floor: fn("floor", (it, a) => D(Math.floor(num(a[0])))), ceil: fn("ceil", (it, a) => D(Math.ceil(num(a[0])))),
      round: fn("round", (it, a) => Math.floor(num(a[0]) + 0.5)), sin: fn("sin", (it, a) => D(Math.sin(num(a[0])))),
      cos: fn("cos", (it, a) => D(Math.cos(num(a[0])))), tan: fn("tan", (it, a) => D(Math.tan(num(a[0])))),
      log: fn("log", (it, a) => D(Math.log(num(a[0])))), log10: fn("log10", (it, a) => D(Math.log10(num(a[0])))),
      exp: fn("exp", (it, a) => D(Math.exp(num(a[0])))), random: fn("random", () => D(Math.random())),
      toRadians: fn("toRadians", (it, a) => D((num(a[0]) * Math.PI) / 180)), toDegrees: fn("toDegrees", (it, a) => D((num(a[0]) * 180) / Math.PI)),
    }),
    System: () => new NsObj("System", {
      currentTimeMillis: fn("currentTimeMillis", () => Date.now()), nanoTime: fn("nanoTime", () => Math.floor(Date.now() * 1e6)),
      lineSeparator: fn("lineSeparator", () => "\n"),
      out: new NsObj("PrintStream", { println: fn("println", (it, a) => (it.host.stdout(a.length ? it.kStr(a[0]) : "", true), undefined)), print: fn("print", (it, a) => (it.host.stdout(it.kStr(a[0]), false), undefined)) }),
    }),
    Integer: () => new NsObj("Integer", {
      MAX_VALUE: 2147483647, MIN_VALUE: -2147483648,
      parseInt: fn("parseInt", (it, a) => parseIntStrict(it, a[0], a[1] || 10)), valueOf: fn("valueOf", (it, a) => (typeof a[0] === "string" ? parseIntStrict(it, a[0]) : a[0])),
      toString: fn("toString", (it, a) => String(a[0])), compare: fn("compare", (it, a) => (a[0] < a[1] ? -1 : a[0] > a[1] ? 1 : 0)),
      toBinaryString: fn("toBinaryString", (it, a) => (a[0] >>> 0).toString(2)), toHexString: fn("toHexString", (it, a) => (a[0] >>> 0).toString(16)),
    }),
    Int: () => new NsObj("Int", { MAX_VALUE: 2147483647, MIN_VALUE: -2147483648 }),
    Long: () => new NsObj("Long", { MAX_VALUE: 9223372036854775807, MIN_VALUE: -9223372036854775808, parseLong: fn("parseLong", (it, a) => parseIntStrict(it, a[0])) }),
    Double: () => new NsObj("Double", { MAX_VALUE: D(Number.MAX_VALUE), MIN_VALUE: D(5e-324), NaN: D(NaN), POSITIVE_INFINITY: D(Infinity), NEGATIVE_INFINITY: D(-Infinity), parseDouble: fn("parseDouble", (it, a) => D(parseDoubleStrict(it, a[0]))), valueOf: fn("valueOf", (it, a) => D(num(a[0]))), compare: fn("compare", (it, a) => (num(a[0]) < num(a[1]) ? -1 : num(a[0]) > num(a[1]) ? 1 : 0)) }),
    Float: () => new NsObj("Float", { MAX_VALUE: new Dbl(3.4028235e38, true), parseFloat: fn("parseFloat", (it, a) => new Dbl(Math.fround(parseDoubleStrict(it, a[0])), true)) }),
    Boolean: () => new NsObj("Boolean", { parseBoolean: fn("parseBoolean", (it, a) => String(a[0]).toLowerCase() === "true") }),
    String: () => new NsObj("String", {
      format: fn("format", (it, a) => javaFormat(a[0], a.slice(1), (v) => it.kStr(v))),
      valueOf: fn("valueOf", (it, a) => it.kStr(a[0])), join: fn("join", (it, a) => (a[1] instanceof KList ? a[1].items : a.slice(1)).map((x: any) => it.kStr(x)).join(a[0])),
    }),
    Character: () => new NsObj("Character", {
      isDigit: fn("isDigit", (it, a) => /[0-9]/.test(a[0].c)), isLetter: fn("isLetter", (it, a) => /[A-Za-z]/.test(a[0].c)),
      isUpperCase: fn("isUpperCase", (it, a) => /[A-Z]/.test(a[0].c)), isLowerCase: fn("isLowerCase", (it, a) => /[a-z]/.test(a[0].c)),
      toUpperCase: fn("toUpperCase", (it, a) => new Ch(a[0].c.toUpperCase())), toLowerCase: fn("toLowerCase", (it, a) => new Ch(a[0].c.toLowerCase())),
      getNumericValue: fn("getNumericValue", (it, a) => parseInt(a[0].c, 36)),
    }),
    Thread: () => new NsObj("Thread", { sleep: fn("sleep", () => undefined) }),
    Collections: () => new NsObj("Collections", {
      sort: fn("sort", (it, a) => (a[0].items.sort((x: any, y: any) => it.compare(x, y)), undefined)),
      reverse: fn("reverse", (it, a) => (a[0].items.reverse(), undefined)),
      max: fn("max", (it, a) => a[0].items.reduce((m: any, x: any) => (it.compare(x, m) > 0 ? x : m))),
      min: fn("min", (it, a) => a[0].items.reduce((m: any, x: any) => (it.compare(x, m) < 0 ? x : m))),
      unmodifiableList: fn("unmodifiableList", (it, a) => L(a[0].items.slice())), emptyList: fn("emptyList", () => L([])),
    }),
    Arrays: () => new NsObj("Arrays", {
      toString: fn("toString", (it, a) => it.kStr(a[0])), asList: fn("asList", (it, a) => L(a.length === 1 && a[0] instanceof KList ? a[0].items.slice() : a)),
      sort: fn("sort", (it, a) => (a[0].items.sort((x: any, y: any) => it.compare(x, y)), undefined)),
    }),
    Objects: () => new NsObj("Objects", { equals: fn("equals", (it, a) => it.equals(a[0], a[1])), hash: fn("hash", (it, a) => a.length) }),
    Random: () => new NsObj("Random", {
      nextInt: fn("nextInt", (it, a) => (a.length === 2 ? a[0] + Math.floor(Math.random() * (a[1] - a[0])) : a.length === 1 ? Math.floor(Math.random() * a[0]) : Math.floor(Math.random() * 4294967296) - 2147483648)),
      nextDouble: fn("nextDouble", () => D(Math.random())), nextBoolean: fn("nextBoolean", () => Math.random() < 0.5),
    }),
    RegexOption: () => new NsObj("RegexOption", { IGNORE_CASE: { enumName: "IGNORE_CASE" } }),
    Unit: () => new NsObj("Unit", {}),
  };
}

let currentInterp: Interp | null = null;
let nsTable: { [n: string]: (it: Interp) => any } | null = null;
/** namespace objects of the Kotlin/Java standard library (Math, System, Integer ...) by name, or NOPE */
export function stdGlobal(it: Interp, name: string): any {
  currentInterp = it;
  if (!nsTable) nsTable = staticNs();
  const f = nsTable[name];
  return f ? f(it) : NOPE;
}

export { typeName, KObj, ThrowSig };
