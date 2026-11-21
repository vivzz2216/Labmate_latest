/** Tree-walking interpreter for the Kotlin subset of the LabMate Android studio.
 *
 *  It really executes the student's code: classes, objects, data/enum classes, lambdas, collections, string templates,
 *  exceptions. Android and Jetpack Compose are provided through a `Host` (see android.ts). Calls into anything the runtime
 *  does not implement fail loudly (UnsupportedFeature), never silently. */
import {
  BreakSig, Ch, ClassInfo, ContinueSig, Dbl, KEx, KFun, KList, KMap, KObj, KPair, KRange, KSet, NOPE, NativeFn, Ref, ReturnSig, Scope,
  StopSig, ThrowSig, compareValues, dataFields, formatDouble, hashKey, isExceptionName, isInstance, kEquals, num, typeName, exceptionFqn,
} from "./values";
import { callBuiltinMember, getBuiltinProp, globalFunctions } from "./stdlib";

export interface Host {
  stdout(text: string, newline: boolean): void;
  /** value of a global name the Kotlin stdlib does not define (Android/Compose namespaces and functions), or NOPE */
  resolveGlobal(name: string, it: Interp): any;
  /** construct a native class, or NOPE when `name` is not one */
  construct(name: string, args: any[], named: any, it: Interp): any;
  /** create the native base of a user class that extends an Android/Java class */
  createNativeBase(superName: string, obj: KObj, args: any[], it: Interp): any;
  isNativeClass(name: string): boolean;
}

export class ClassVal {
  info: ClassInfo;
  constructor(info: ClassInfo) {
    this.info = info;
  }
}
export class NsObj {
  kType: string;
  members: { [k: string]: any };
  constructor(kType: string, members: { [k: string]: any }) {
    this.kType = kType;
    this.members = members;
  }
}
const UNINIT = { uninit: true };

export class Interp {
  host: Host;
  classes: { [n: string]: ClassInfo } = {};
  funs: { [n: string]: any[] } = {};
  ext: { [n: string]: any[] } = {};
  props: { [n: string]: Ref } = {};
  globalScope = new Scope(null);
  steps = 0;
  limit = 4000000;
  deadline = 0;
  depth = 0;
  nativeImports: { [n: string]: boolean } = {};
  files: any[] = [];

  constructor(host: Host) {
    this.host = host;
  }

  // ------------------------------------------------------------------------------------------ limits
  tick(): void {
    if (++this.steps > this.limit) throw new StopSig("The program ran too long (more than " + this.limit.toLocaleString("en-US") + " steps). Is there an infinite loop?");
    if ((this.steps & 4095) === 0 && this.deadline && Date.now() > this.deadline) throw new StopSig("The program ran for more than " + Math.round((this.deadline - this.startedAt) / 1000) + " seconds and was stopped. Is there an infinite loop?");
  }
  startedAt = 0;
  /** the call expression being evaluated when a host function is invoked (lets Compose key `remember` by source position) */
  callNode: any = null;
  startClock(ms: number): void {
    this.steps = 0;
    this.startedAt = Date.now();
    this.deadline = this.startedAt + ms;
  }

  // ------------------------------------------------------------------------------------------ loading
  load(files: { name: string; ast: any }[]): void {
    this.files = files;
    const sc = this.globalScope;
    files.forEach((f) => f.ast.decls.forEach((d: any) => this.registerDecl(d, sc, f.name)));
    // supers resolve after every class is known
    Object.keys(this.classes).forEach((n) => this.linkClass(this.classes[n]));
  }

  registerDecl(d: any, scope: Scope, file: string): void {
    if (d.t === "Class") this.registerClass(d, scope, file);
    else if (d.t === "Fun") {
      d.file = file;
      if (d.receiver) (this.ext[d.n] = this.ext[d.n] || []).push(d);
      else (this.funs[d.n] = this.funs[d.n] || []).push(d);
    } else if (d.t === "Val") {
      const self = this;
      if (d.names) throw new StopSig("Top-level destructuring declarations are not supported");
      const ref: Ref = { v: undefined, mut: d.mut, ty: d.ty && d.ty.name, done: false };
      ref.thunk = () => (d.delegate ? self.ev(d.delegate, self.globalScope) : d.init ? self.ev(d.init, self.globalScope) : null);
      this.props[d.n] = ref;
    }
  }

  registerClass(d: any, scope: Scope, file: string): ClassInfo {
    const info: ClassInfo = {
      name: d.n, decl: d, kind: d.kind, interfaces: [], methods: {}, getters: {}, isData: d.mods.indexOf("data") >= 0, isEnum: d.mods.indexOf("enum") >= 0,
      entries: [], scope, abstract: d.kind === "interface" || d.mods.indexOf("abstract") >= 0 || d.mods.indexOf("sealed") >= 0,
    };
    d.members.forEach((m: any) => {
      if (m.t === "Fun") {
        m.file = file;
        (info.methods[m.n] = info.methods[m.n] || []).push(m);
      } else if (m.t === "Val" && m.getter) info.getters[m.n] = m.getter;
      else if (m.t === "Class" && m.companion) (info as any).companionDecl = m;
      else if (m.t === "Class") this.registerClass(m, scope, file);
    });
    if (d.n) this.classes[d.n] = info;
    return info;
  }

  linkClass(info: ClassInfo): void {
    info.decl.supers.forEach((s: any) => {
      const n = s.ty.name;
      const sup = this.classes[n];
      if (sup && sup.kind !== "interface" && !info.superInfo && sup !== info) {
        info.superInfo = sup;
        info.superName = n;
      } else if (sup) info.interfaces.push(n);
      else if (s.hasCall || this.host.isNativeClass(n) || isExceptionName(n)) {
        if (!info.nativeSuper) info.nativeSuper = n;
        else info.interfaces.push(n);
      } else info.interfaces.push(n);
    });
  }

  // ------------------------------------------------------------------------------------------ errors
  throwEx(name: string, message: string | null = null): never {
    throw new ThrowSig(new KEx(name, message));
  }
  npe(what?: string): never {
    this.throwEx("NullPointerException", what || null);
  }

  // ------------------------------------------------------------------------------------------ text
  kStr(v: any): string {
    if (v === null || v === undefined) return "null";
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    if (v instanceof Dbl) return formatDouble(v.v, v.f);
    if (v instanceof Ch) return v.c;
    if (v instanceof KList) return "[" + v.items.map((x) => this.kStr(x)).join(", ") + "]";
    if (v instanceof KSet) return "[" + v.values().map((x) => this.kStr(x)).join(", ") + "]";
    if (v instanceof KMap) return "{" + v.entries().map((e) => this.kStr(e[0]) + "=" + this.kStr(e[1])).join(", ") + "}";
    if (v instanceof KPair) return v.entry ? this.kStr(v.a) + "=" + this.kStr(v.b) : "(" + this.kStr(v.a) + ", " + this.kStr(v.b) + ")";
    if (v instanceof KRange) return v.isChar ? String.fromCharCode(v.first) + ".." + String.fromCharCode(v.last) : v.first + (v.step > 1 || v.step < -1 ? ".." + v.last + " step " + Math.abs(v.step) : v.step < 0 ? " downTo " + v.last : ".." + v.last);
    if (v instanceof KObj) {
      const m = this.findMethod(v.cls, "toString", 0);
      if (m) return this.kStr(this.callUser(m.fn, [], {}, v, m.cls));
      if (v.cls.isEnum) return String(v.enumName);
      if (v.cls.isData) return v.cls.name + "(" + dataFields(v).map((k) => k + "=" + this.kStr(v.f[k])).join(", ") + ")";
      if (v.native && v.native.toString && v.native.toString !== Object.prototype.toString) return String(v.native.toString());
      if (v.cls.nativeSuper && isExceptionName(v.cls.nativeSuper)) return v.cls.name + (v.f.message != null ? ": " + this.kStr(v.f.message) : "");
      return v.cls.name + "@" + (v.id * 7919).toString(16);
    }
    if (v instanceof KEx) return exceptionFqn(v.name) + (v.message !== null ? ": " + v.message : "");
    if (v instanceof ClassVal) return "class " + v.info.name;
    if (v instanceof KFun || v instanceof NativeFn) return "Function";
    if (v && typeof v.toString === "function" && v.toString !== Object.prototype.toString) return String(v.toString());
    return String(v && v.kType ? v.kType : v);
  }

  equals(a: any, b: any): boolean {
    if (a instanceof KObj && !a.cls.isData) {
      const m = this.findMethod(a.cls, "equals", 1);
      if (m) return this.callUser(m.fn, [b], {}, a, m.cls) === true;
    }
    return kEquals(a, b);
  }
  compare(a: any, b: any): number {
    if (a instanceof KObj) {
      const m = this.findMethod(a.cls, "compareTo", 1);
      if (m) return num(this.callUser(m.fn, [b], {}, a, m.cls));
      this.throwEx("ClassCastException", a.cls.name + " cannot be cast to class java.lang.Comparable");
    }
    return compareValues(a, b);
  }

  // ------------------------------------------------------------------------------------------ classes and calls
  findMethod(cls: ClassInfo | undefined, name: string, argc: number, named?: any): { fn: any; cls: ClassInfo } | null {
    let c: ClassInfo | undefined = cls;
    while (c) {
      const list = c.methods[name];
      if (list) {
        let pick: any = null;
        for (let i = 0; i < list.length; i++) {
          const f = list[i];
          const required = f.params.filter((p: any) => !p.def && !p.vararg).length;
          const hasVararg = f.params.some((p: any) => p.vararg);
          if ((argc >= required && (argc <= f.params.length || hasVararg)) || (named && Object.keys(named).length)) {
            if (!f.body && !f.exprBody) continue; // abstract
            pick = f;
            if (argc === f.params.length) break;
          }
        }
        if (pick) return { fn: pick, cls: c };
      }
      // interfaces with default bodies
      for (let k = 0; k < c.interfaces.length; k++) {
        const ic = this.classes[c.interfaces[k]];
        if (ic) {
          const m = this.findMethod(ic, name, argc, named);
          if (m) return m;
        }
      }
      c = c.superInfo;
    }
    return null;
  }

  hasMethod(cls: ClassInfo | undefined, name: string): boolean {
    let c: ClassInfo | undefined = cls;
    while (c) {
      if (c.methods[name]) return true;
      for (let k = 0; k < c.interfaces.length; k++) {
        const ic = this.classes[c.interfaces[k]];
        if (ic && this.hasMethod(ic, name)) return true;
      }
      c = c.superInfo;
    }
    return false;
  }

  /** call a user function declaration with positional/named arguments */
  callUser(fn: any, args: any[], named: any, thisObj: any, cls?: ClassInfo): any {
    const f = new KFun(fn.n, fn.params, cls ? cls.scope : this.globalScope, false);
    f.body = fn.body;
    f.exprBody = fn.exprBody;
    f.decl = fn;
    f.thisObj = thisObj;
    if (thisObj === undefined && !fn.receiver) f.thisObj = undefined;
    return this.invoke(f, args, named);
  }

  invoke(fn: KFun, args: any[], named: any): any {
    if (++this.depth > 450) {
      this.depth = 0;
      this.throwEx("StackOverflowError", null);
    }
    this.tick();
    try {
      const sc = new Scope(fn.scope);
      if (fn.thisObj !== undefined) {
        sc.recv = fn.thisObj;
        sc.hasRecv = true;
      }
      sc.fnName = fn.name;
      this.bindParams(fn, args, named, sc);
      try {
        if (fn.exprBody) return this.ev(fn.exprBody, sc);
        if (fn.body) return this.execBlock(fn.body, sc);
        return undefined;
      } catch (e) {
        if (e instanceof ReturnSig) {
          if (fn.isLambda ? e.label !== undefined && e.label === (fn as any).label : e.label === undefined || e.label === fn.name) return e.value;
        }
        throw e;
      }
    } finally {
      this.depth--;
    }
  }

  bindParams(fn: KFun, args: any[], named: any, sc: Scope): void {
    const params = fn.params;
    if (fn.isLambda) {
      if (!fn.hasParams) {
        if (args.length >= 1) sc.declare("it", args[0], false);
        return;
      }
      if (params.length > 1 && args.length === 1 && args[0] instanceof KPair) args = [args[0].a, args[0].b];
      params.forEach((p: any, i: number) => {
        if (p.n.charAt(0) === "(") {
          this.destructure(args[i], p.n.slice(1, -1).split(","), sc, false);
        } else if (p.n !== "_") sc.declare(p.n, args[i] === undefined ? null : args[i], false);
      });
      return;
    }
    // a trailing lambda `f(a) { ... }` binds to the LAST parameter, even when earlier ones keep their defaults
    const lastArg = args.length ? args[args.length - 1] : undefined;
    if (lastArg && lastArg.trailing && params.length > args.length && params.length) {
      const lp = params[params.length - 1];
      if (lp.ty && lp.ty.fn && !(named && Object.prototype.hasOwnProperty.call(named, lp.n))) {
        named = Object.assign({}, named || {});
        named[lp.n] = lastArg;
        args = args.slice(0, args.length - 1);
      }
    }
    let ai = 0;
    for (let i = 0; i < params.length; i++) {
      const p = params[i];
      if (p.vararg) {
        const rest: any[] = [];
        while (ai < args.length) rest.push(args[ai++]);
        if (named && named[p.n] !== undefined) rest.push.apply(rest, named[p.n].items);
        sc.declare(p.n, new KList(rest.length === 1 && rest[0] instanceof KList && false ? rest[0].items : rest, false), false);
        continue;
      }
      let v: any;
      if (named && Object.prototype.hasOwnProperty.call(named, p.n)) v = named[p.n];
      else if (ai < args.length) v = args[ai++];
      else if (p.def) v = this.ev(p.def, sc);
      else this.throwEx("IllegalArgumentException", "No value passed for parameter '" + p.n + "' in " + fn.name);
      sc.declare(p.n, v, false, p.ty && p.ty.name);
    }
  }

  destructure(value: any, names: string[], sc: Scope, mut: boolean): void {
    names.forEach((n, i) => {
      let v: any;
      if (value instanceof KPair) v = i === 0 ? value.a : value.b;
      else if (value instanceof KList) v = value.items[i];
      else if (value instanceof KObj && value.cls.isData) v = value.f[dataFields(value)[i]];
      else this.throwEx("UnsupportedOperationException", "Cannot destructure a " + typeName(value));
      if (n !== "_") sc.declare(n.trim(), v, mut);
    });
  }

  /** call any callable value */
  callFn(fn: any, args: any[], named: any = {}): any {
    if (fn instanceof KFun) return this.invoke(fn, args, named);
    if (fn instanceof NativeFn) return fn.fn(args, named);
    if (fn instanceof ClassVal) return this.instantiate(fn.info, args, named);
    if (fn instanceof KObj) {
      const m = this.findMethod(fn.cls, "invoke", args.length);
      if (m) return this.callUser(m.fn, args, named, fn, m.cls);
      // a user object implementing a single-method listener interface
      const names = Object.keys(fn.cls.methods);
      if (names.length === 1) return this.callUser(fn.cls.methods[names[0]][0], args, named, fn, fn.cls);
    }
    if (fn && typeof fn.invoke === "function") return fn.invoke(args, named, this);
    if (fn === null || fn === undefined) this.npe("Attempt to invoke a function on a null object reference");
    this.throwEx("UnsupportedOperationException", "Value of type " + typeName(fn) + " is not callable");
  }

  instantiate(info: ClassInfo, args: any[], named: any): any {
    if (info.kind === "object") return this.getSingleton(info);
    if (info.abstract) this.throwEx("InstantiationError", "Cannot create an instance of an abstract class or interface: " + info.name);
    const obj = new KObj(info);
    this.initObject(obj, info, args, named);
    return obj;
  }

  getSingleton(info: ClassInfo): KObj {
    if (!info.singleton) {
      const obj = new KObj(info);
      info.singleton = obj;
      this.initObject(obj, info, [], {});
    }
    return info.singleton;
  }

  companionOf(info: ClassInfo): KObj | null {
    const decl = (info as any).companionDecl;
    if (!decl) return null;
    if (!info.companion) {
      const ci = this.registerClass(decl, info.scope, "");
      this.linkClass(ci);
      const obj = new KObj(ci);
      info.companion = obj;
      this.initObject(obj, ci, [], {});
    }
    return info.companion;
  }

  initObject(obj: KObj, info: ClassInfo, args: any[], named: any): void {
    const d = info.decl;
    const sc = new Scope(info.scope);
    sc.recv = obj;
    sc.hasRecv = true;
    const fake = new KFun(info.name, d.params, info.scope, false);
    this.bindParams(fake, args, named, sc);
    d.params.forEach((p: any) => {
      if (p.prop) obj.f[p.n] = sc.vars[p.n].v;
    });
    // super constructor
    const callSuper = d.supers.filter((s: any) => s.hasCall)[0];
    if (info.superInfo) {
      let sargs: any[] = [];
      let snamed: any = {};
      if (callSuper && callSuper.ty.name === info.superName) {
        const ev = this.evalArgList(callSuper.args, sc);
        sargs = ev.args;
        snamed = ev.named;
      }
      this.initObject(obj, info.superInfo, sargs, snamed);
    } else if (info.nativeSuper) {
      let sargs: any[] = [];
      if (callSuper) sargs = this.evalArgList(callSuper.args, sc).args;
      if (isExceptionName(info.nativeSuper)) {
        obj.f.message = sargs.length ? sargs[0] : null;
        obj.f.cause = sargs.length > 1 ? sargs[1] : null;
      } else obj.native = this.host.createNativeBase(info.nativeSuper, obj, sargs, this);
    }
    if (info.isEnum && obj.enumName === undefined) {
      /* entries are created by registerEnum */
    }
    // member initialisers and init blocks in declaration order
    d.members.forEach((m: any) => {
      if (m.t === "Val" && !m.getter) {
        if (m.delegate) {
          const del = this.ev(m.delegate, sc);
          obj.delegates[m.n] = del;
        } else if (m.init) obj.f[m.n] = this.ev(m.init, sc);
        else if (m.mods && m.mods.indexOf("lateinit") >= 0) obj.f[m.n] = UNINIT;
        else obj.f[m.n] = null;
      } else if (m.t === "Init") this.execBlock(m.body, new Scope(sc));
    });
  }

  ensureEnum(info: ClassInfo): void {
    if (info.entries.length || !info.isEnum) return;
    (info.decl.entries || []).forEach((e: any, i: number) => {
      const obj = new KObj(info);
      obj.enumName = e.n;
      obj.ordinal = i;
      info.entries.push(obj);
      const sc = new Scope(info.scope);
      const ev = this.evalArgList(e.args, sc);
      this.initObject(obj, info, ev.args, ev.named);
    });
  }

  // ------------------------------------------------------------------------------------------ names and members
  readRef(r: Ref): any {
    if (r.del) return r.del.getValue();
    if (r.thunk && !r.done) {
      r.done = true;
      r.v = r.thunk();
      const d = r.v;
      if (d && d.isDelegate) {
        r.del = d;
        return d.getValue();
      }
    }
    if (r.v === UNINIT) this.throwEx("UninitializedPropertyAccessException", "lateinit property has not been initialized");
    return r.v;
  }

  receivers(scope: Scope): any[] {
    const out: any[] = [];
    let s: Scope | null = scope;
    while (s) {
      if (s.hasRecv && out.indexOf(s.recv) < 0) out.push(s.recv);
      s = s.parent;
    }
    return out;
  }

  /** property `name` on an implicit receiver (this, apply/with subject) */
  recvGet(recv: any, name: string): any {
    if (recv instanceof KObj) {
      let c: KObj | null = recv;
      if (Object.prototype.hasOwnProperty.call(c.f, name)) {
        const v = c.f[name];
        if (v === UNINIT) this.throwEx("UninitializedPropertyAccessException", "lateinit property " + name + " has not been initialized");
        return v;
      }
      if (recv.delegates[name]) return recv.delegates[name].getValue();
      let k: ClassInfo | undefined = recv.cls;
      while (k) {
        if (k.getters[name]) return this.evalGetter(recv, k, k.getters[name]);
        k = k.superInfo;
      }
      if (recv.cls.isEnum && (name === "name" || name === "ordinal")) return name === "name" ? recv.enumName : recv.ordinal;
      if (recv.native) {
        const v = recv.native.getProp ? recv.native.getProp(name, this) : NOPE;
        if (v !== NOPE) return v;
      }
      if (recv.cls.nativeSuper && isExceptionName(recv.cls.nativeSuper) && (name === "message" || name === "cause")) return recv.f[name];
      const comp = this.companionOf(recv.cls);
      if (comp && Object.prototype.hasOwnProperty.call(comp.f, name)) return comp.f[name];
      return NOPE;
    }
    const b = getBuiltinProp(this, recv, name);
    if (b !== NOPE) return b;
    if (recv && recv.getProp) return recv.getProp(name, this);
    return NOPE;
  }

  evalGetter(obj: KObj, cls: ClassInfo, getter: any): any {
    const sc = new Scope(cls.scope);
    sc.recv = obj;
    sc.hasRecv = true;
    if (getter.exprBody) return this.ev(getter.exprBody, sc);
    try {
      return this.execBlock(getter.body, sc);
    } catch (e) {
      if (e instanceof ReturnSig) return e.value;
      throw e;
    }
  }

  lookupName(n: string, scope: Scope, pos: any): any {
    const r = scope.lookup(n);
    if (r) return this.readRef(r);
    const recvs = this.receivers(scope);
    for (let i = 0; i < recvs.length; i++) {
      const v = this.recvGet(recvs[i], n);
      if (v !== NOPE) return v;
    }
    const g = this.props[n];
    if (g) return this.readRef(g);
    const c = this.classes[n];
    if (c) {
      if (c.kind === "object") return this.getSingleton(c);
      return new ClassVal(c);
    }
    if (this.funs[n]) return new NativeFn(n, (a, nm) => this.callGlobalFun(n, a, nm));
    const h = this.host.resolveGlobal(n, this);
    if (h !== NOPE) return h;
    if (globalFunctions[n]) return new NativeFn(n, (a, nm) => globalFunctions[n](this, a, nm));
    this.throwEx("UnsupportedOperationException", "Unresolved reference: " + n + (pos ? " (line " + pos[0] + ")" : ""));
  }

  callGlobalFun(name: string, args: any[], named: any): any {
    const list = this.funs[name];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const required = f.params.filter((p: any) => !p.def && !p.vararg).length;
      if ((args.length >= required && (args.length <= f.params.length || f.params.some((p: any) => p.vararg))) || (named && Object.keys(named).length)) {
        return this.callUser(f, args, named, undefined);
      }
    }
    this.throwEx("IllegalArgumentException", "No matching overload of " + name + " for " + args.length + " argument(s)");
  }

  getMember(obj: any, name: string, safe: boolean, pos: any): any {
    if (obj === null || obj === undefined) {
      if (safe) return null;
      this.npe("Attempt to read property '" + name + "' on a null object reference");
    }
    if (obj instanceof ClassVal) return this.classMember(obj.info, name);
    if (obj instanceof NsObj) {
      if (Object.prototype.hasOwnProperty.call(obj.members, name)) return obj.members[name];
      this.throwEx("UnsupportedOperationException", obj.kType + "." + name + " is not available in the LabMate runtime");
    }
    if (obj instanceof KObj) {
      const v = this.recvGet(obj, name);
      if (v !== NOPE) return v;
      // a method used as a function reference is not supported; report clearly
      this.throwEx("UnsupportedOperationException", "Unresolved reference: " + name + " on " + obj.cls.name);
    }
    const b = getBuiltinProp(this, obj, name);
    if (b !== NOPE) return b;
    if (obj && typeof obj.getProp === "function") {
      const v = obj.getProp(name, this);
      if (v !== NOPE) return v;
    }
    // user extension property / zero-argument extension function used as property is not Kotlin; report
    this.throwEx("UnsupportedOperationException", "Unresolved reference: " + name + " on " + typeName(obj));
  }

  classMember(info: ClassInfo, name: string): any {
    if (name === "java" || name === "kotlin") return new ClassVal(info);
    if (name === "simpleName" || name === "name") return info.name;
    if (info.isEnum) {
      this.ensureEnum(info);
      const e = info.entries.filter((x) => x.enumName === name)[0];
      if (e) return e;
      if (name === "entries") return new KList(info.entries.slice(), false);
    }
    if (info.kind === "object") {
      const so = this.getSingleton(info);
      const v = this.recvGet(so, name);
      if (v !== NOPE) return v;
    }
    const comp = this.companionOf(info);
    if (comp) {
      const v = this.recvGet(comp, name);
      if (v !== NOPE) return v;
    }
    // nested class used as a qualifier
    if (this.classes[name]) return new ClassVal(this.classes[name]);
    this.throwEx("UnsupportedOperationException", "Unresolved reference: " + name + " on " + info.name);
  }

  setMember(obj: any, name: string, value: any, pos: any): void {
    if (obj === null || obj === undefined) this.npe("Attempt to write property '" + name + "' on a null object reference");
    if (obj instanceof KObj) {
      if (obj.delegates[name]) {
        obj.delegates[name].setValue(value);
        return;
      }
      if (Object.prototype.hasOwnProperty.call(obj.f, name) || !obj.native) {
        obj.f[name] = value;
        return;
      }
      if (obj.native && obj.native.setProp && obj.native.setProp(name, value, this)) return;
      obj.f[name] = value;
      return;
    }
    if (obj instanceof ClassVal) {
      const comp = this.companionOf(obj.info) || (obj.info.kind === "object" ? this.getSingleton(obj.info) : null);
      if (comp) {
        comp.f[name] = value;
        return;
      }
    }
    if (obj && typeof obj.setProp === "function" && obj.setProp(name, value, this)) return;
    this.throwEx("UnsupportedOperationException", "Cannot assign to '" + name + "' on " + typeName(obj));
  }

  callMember(obj: any, name: string, args: any[], named: any, node: any, safe: boolean): any {
    if (obj === null || obj === undefined) {
      if (safe) return null;
      this.npe("Attempt to invoke virtual method '" + name + "()' on a null object reference");
    }
    // scope functions work on any receiver
    switch (name) {
      case "let":
        if (args.length === 1) return this.callFn(args[0], [obj]);
        break;
      case "also":
        if (args.length === 1) {
          this.callFn(args[0], [obj]);
          return obj;
        }
        break;
      case "apply":
        if (args.length === 1) {
          this.callWithReceiver(args[0], obj);
          return obj;
        }
        break;
      case "run":
        if (args.length === 1 && (args[0] instanceof KFun)) return this.callWithReceiver(args[0], obj);
        break;
      case "takeIf":
        if (args.length === 1) return this.callFn(args[0], [obj]) === true ? obj : null;
        break;
      case "takeUnless":
        if (args.length === 1) return this.callFn(args[0], [obj]) === true ? null : obj;
        break;
      case "to":
        if (args.length === 1) return new KPair(obj, args[0]);
        break;
      default:
        break;
    }
    if (obj instanceof ClassVal) {
      const info = obj.info;
      if (info.isEnum) {
        this.ensureEnum(info);
        if (name === "values") return new KList(info.entries.slice(), false);
        if (name === "valueOf") {
          const e = info.entries.filter((x) => x.enumName === args[0])[0];
          if (!e) this.throwEx("IllegalArgumentException", "No enum constant " + info.name + "." + args[0]);
          return e;
        }
      }
      const target = info.kind === "object" ? this.getSingleton(info) : this.companionOf(info);
      if (target) {
        const m = this.findMethod(target.cls, name, args.length, named);
        if (m) return this.callUser(m.fn, args, named, target, m.cls);
      }
      if (name === "toString") return "class " + info.name;
      this.throwEx("UnsupportedOperationException", "Unresolved reference: " + name + " in " + info.name);
    }
    if (obj instanceof NsObj) {
      const m = obj.members[name];
      if (m === undefined) this.throwEx("UnsupportedOperationException", obj.kType + "." + name + "() is not available in the LabMate runtime");
      return this.callFn(m, args, named);
    }
    if (obj instanceof KObj) {
      const m = this.findMethod(obj.cls, name, args.length, named);
      if (m) return this.callUser(m.fn, args, named, obj, m.cls);
      if (obj.native && obj.native.call) {
        const v = obj.native.call(name, args, named, this);
        if (v !== NOPE) return v;
      }
      if (obj.cls.isData) {
        if (name === "copy") {
          const o = new KObj(obj.cls);
          const fields = dataFields(obj);
          fields.forEach((k) => (o.f[k] = obj.f[k]));
          Object.keys(named || {}).forEach((k) => (o.f[k] = named[k]));
          args.forEach((a, i) => (o.f[fields[i]] = a));
          return o;
        }
        const cm = /^component(\d+)$/.exec(name);
        if (cm) return obj.f[dataFields(obj)[parseInt(cm[1], 10) - 1]];
      }
      if (obj.cls.isEnum) {
        if (name === "name") return obj.enumName;
        if (name === "ordinal") return obj.ordinal;
        if (name === "compareTo") return (obj.ordinal as number) - (args[0].ordinal as number);
      }
      if (obj.cls.nativeSuper && isExceptionName(obj.cls.nativeSuper)) {
        if (name === "printStackTrace") {
          this.host.stdout(this.kStr(obj), true);
          return undefined;
        }
        if (name === "getMessage") return obj.f.message;
      }
      if (name === "toString") return this.kStr(obj);
      if (name === "equals") return this.equals(obj, args[0]);
      if (name === "hashCode") return obj.id;
      // a property holding a function
      const pv = this.recvGet(obj, name);
      if (pv !== NOPE && (pv instanceof KFun || pv instanceof NativeFn)) return this.callFn(pv, args, named);
    } else {
      const v = callBuiltinMember(this, obj, name, args, named);
      if (v !== NOPE) return v;
      if (obj && typeof obj.call === "function") {
        const r = obj.call(name, args, named, this);
        if (r !== NOPE) return r;
      }
      if (obj instanceof KEx) {
        if (name === "printStackTrace") {
          this.host.stdout(this.kStr(obj), true);
          return undefined;
        }
        if (name === "getMessage") return obj.message;
      }
    }
    // user extension functions
    const exts = this.ext[name];
    if (exts) {
      const tn = typeName(obj);
      for (let i = 0; i < exts.length; i++) {
        const e = exts[i];
        const rt = String(e.receiver).split(".").pop();
        if (rt === tn || rt === "Any" || (rt === "Number" && (tn === "Int" || tn === "Double")) || (obj instanceof KObj && isInstance(obj, String(rt))) || (rt === "List" && obj instanceof KList) || (rt === "String" && typeof obj === "string")) {
          return this.callUser(e, args, named, obj);
        }
      }
    }
    if (name === "toString") return this.kStr(obj);
    if (name === "equals") return this.equals(obj, args[0]);
    if (name === "hashCode") return 0;
    this.throwEx("UnsupportedOperationException", "Unresolved reference: " + name + " on " + typeName(obj) + (node && node.p ? " (line " + node.p[0] + ")" : ""));
  }

  callWithReceiver(fn: any, recv: any, args: any[] = []): any {
    if (fn instanceof KFun) {
      const g = new KFun(fn.name, fn.params, fn.scope, fn.isLambda);
      g.body = fn.body;
      g.exprBody = fn.exprBody;
      g.hasParams = fn.hasParams;
      g.thisObj = recv;
      (g as any).label = (fn as any).label;
      return this.invoke(g, args.length ? args : [recv], {});
    }
    return this.callFn(fn, [recv]);
  }

  // ------------------------------------------------------------------------------------------ arguments
  evalArgList(args: any[], scope: Scope): { args: any[]; named: any } {
    const out: any[] = [];
    const named: any = {};
    args.forEach((a: any) => {
      const v = this.ev(a.e, scope);
      if (a.spread && v instanceof KList) out.push.apply(out, v.items);
      else if (a.name) named[a.name] = v;
      else out.push(v);
    });
    return { args: out, named };
  }

  evalCallArgs(node: any, scope: Scope, calleeName?: string): { args: any[]; named: any } {
    const r = this.evalArgList(node.args, scope);
    if (node.lam) {
      const lam = this.ev(node.lam, scope);
      (lam as any).label = calleeName;
      (lam as any).trailing = true;
      r.args.push(lam);
    }
    return r;
  }

  evalCall(node: any, scope: Scope): any {
    this.tick();
    const f = node.f;
    if (f.t === "Name") {
      const name = f.n;
      const { args, named } = this.evalCallArgs(node, scope, name);
      const local = scope.lookup(name);
      if (local) return this.callFn(this.readRef(local), args, named);
      // implicit receiver members (this.method(), apply/with subject)
      const recvs = this.receivers(scope);
      for (let i = 0; i < recvs.length; i++) {
        const r = recvs[i];
        if (r instanceof KObj) {
          const m = this.findMethod(r.cls, name, args.length, named);
          if (m) return this.callUser(m.fn, args, named, r, m.cls);
          if (r.native && r.native.call) {
            const v = r.native.call(name, args, named, this);
            if (v !== NOPE) return v;
          }
          const comp = this.companionOf(r.cls);
          if (comp) {
            const m2 = this.findMethod(comp.cls, name, args.length, named);
            if (m2) return this.callUser(m2.fn, args, named, comp, m2.cls);
          }
          if (r.cls.isEnum && (name === "values" || name === "valueOf")) return this.callMember(new ClassVal(r.cls), name, args, named, node, false);
          const pv = this.recvGet(r, name);
          if (pv !== NOPE && (pv instanceof KFun || pv instanceof NativeFn)) return this.callFn(pv, args, named);
        } else if (r !== null && r !== undefined) {
          if (r.call) {
            const v = r.call(name, args, named, this);
            if (v !== NOPE) return v;
          }
          const v = callBuiltinMember(this, r, name, args, named);
          if (v !== NOPE) return v;
        }
      }
      if (this.funs[name]) return this.callGlobalFun(name, args, named);
      const cls = this.classes[name];
      if (cls) return this.instantiate(cls, args, named);
      if (this.host.isNativeClass(name)) {
        const o = this.host.construct(name, args, named, this);
        if (o !== NOPE) return o;
      }
      if (isExceptionName(name)) return new KEx(name, args.length && args[0] !== null ? this.kStr(args[0]) : null);
      const h = this.host.resolveGlobal(name, this);
      if (h !== NOPE) {
        this.callNode = node;
        return this.callFn(h, args, named);
      }
      if (globalFunctions[name]) return globalFunctions[name](this, args, named, node);
      if (this.ext[name]) {
        // extension called without receiver inside an apply/with block
      }
      this.throwEx("UnsupportedOperationException", "Unresolved reference: " + name + " (line " + node.p[0] + ")");
    }
    if (f.t === "Dot") {
      if (f.o.t === "Super") {
        const { args, named } = this.evalCallArgs(node, scope, f.n);
        return this.callSuper(scope, f.n, args, named);
      }
      let obj: any;
      // `Foo.bar()` where Foo is a class/namespace not shadowed by a variable
      if (f.o.t === "Name" && !scope.lookup(f.o.n)) obj = this.lookupName(f.o.n, scope, f.o.p);
      else obj = this.ev(f.o, scope);
      const { args, named } = this.evalCallArgs(node, scope, f.n);
      return this.callMember(obj, f.n, args, named, node, f.safe);
    }
    const callee = this.ev(f, scope);
    const { args, named } = this.evalCallArgs(node, scope);
    return this.callFn(callee, args, named);
  }

  callSuper(scope: Scope, name: string, args: any[], named: any): any {
    const recvs = this.receivers(scope);
    const self = recvs[0];
    if (!(self instanceof KObj)) return undefined;
    // find the class whose method is running: the innermost fnName scope
    let cls: ClassInfo | undefined = self.cls;
    const sup = cls.superInfo;
    if (sup) {
      const m = this.findMethod(sup, name, args.length, named);
      if (m) return this.callUser(m.fn, args, named, self, m.cls);
    }
    // interface defaults
    for (let i = 0; i < self.cls.interfaces.length; i++) {
      const ic = this.classes[self.cls.interfaces[i]];
      if (ic) {
        const m = this.findMethod(ic, name, args.length, named);
        if (m) return this.callUser(m.fn, args, named, self, m.cls);
      }
    }
    if (self.native && self.native.superCall) {
      const v = self.native.superCall(name, args, named, this);
      if (v !== NOPE) return v;
    }
    if (self.cls.nativeSuper && isExceptionName(self.cls.nativeSuper)) return name === "toString" ? this.kStr(self) : undefined;
    if (name === "toString") return self.cls.name + "@" + self.id;
    if (name === "equals") return self === args[0];
    if (name === "hashCode") return self.id;
    return undefined; // calling an Android lifecycle super method (onCreate, onStart ...) has nothing to do here
  }

  // ------------------------------------------------------------------------------------------ statements
  execBlock(stmts: any[], scope: Scope): any {
    let last: any = undefined;
    for (let i = 0; i < stmts.length; i++) last = this.exec(stmts[i], scope);
    return last;
  }

  runBody(stmts: any[], scope: Scope): any {
    return this.execBlock(stmts, new Scope(scope));
  }

  exec(s: any, scope: Scope): any {
    switch (s.t) {
      case "Expr":
        return this.ev(s.e, scope);
      case "Val":
        return this.execVal(s, scope);
      case "Fun": {
        const f = new KFun(s.n, s.params, scope, false);
        f.body = s.body;
        f.exprBody = s.exprBody;
        scope.declare(s.n, f, false);
        return undefined;
      }
      case "Class": {
        const info = this.registerClass(s, scope, "");
        this.linkClass(info);
        return undefined;
      }
      case "Ret":
        throw new ReturnSig(s.e ? this.ev(s.e, scope) : undefined, s.label);
      case "Brk":
        throw new BreakSig(s.label);
      case "Cont":
        throw new ContinueSig(s.label);
      case "Throw": {
        const v = this.ev(s.e, scope);
        if (v === null) this.npe();
        throw new ThrowSig(v);
      }
      case "For":
        return this.execFor(s, scope);
      case "While":
        return this.execWhile(s, scope, false);
      case "DoWhile":
        return this.execWhile(s, scope, true);
      default:
        throw new StopSig("Unsupported statement: " + s.t);
    }
  }

  execVal(s: any, scope: Scope): any {
    if (s.names) {
      this.destructure(this.ev(s.init, scope), s.names, scope, s.mut);
      return undefined;
    }
    if (s.delegate) {
      const d = this.ev(s.delegate, scope);
      const r = scope.declare(s.n, undefined, s.mut, s.ty && s.ty.name);
      if (d && d.isDelegate) r.del = d;
      else r.v = d;
      return undefined;
    }
    if (!s.init) {
      scope.declare(s.n, s.mods && s.mods.indexOf("lateinit") >= 0 ? UNINIT : null, s.mut, s.ty && s.ty.name);
      return undefined;
    }
    let v = this.ev(s.init, scope);
    if (s.ty && s.ty.name === "Float" && v instanceof Dbl) v = new Dbl(Math.fround(v.v), true);
    if (s.ty && s.ty.name === "Double" && typeof v === "number") v = new Dbl(v);
    scope.declare(s.n, v, s.mut, s.ty && s.ty.name);
    return undefined;
  }

  loopLabelMatches(sig: { label?: string }, label?: string): boolean {
    return sig.label === undefined || sig.label === label;
  }

  execWhile(s: any, scope: Scope, post: boolean): any {
    let first = post;
    for (;;) {
      this.tick();
      if (!first && this.ev(s.c, scope) !== true) break;
      first = false;
      try {
        this.execBlock(s.body, new Scope(scope));
      } catch (e) {
        if (e instanceof BreakSig && this.loopLabelMatches(e, s.label)) break;
        if (e instanceof ContinueSig && this.loopLabelMatches(e, s.label)) {
          if (post && this.ev(s.c, scope) !== true) break;
          continue;
        }
        throw e;
      }
      if (post && this.ev(s.c, scope) !== true) break;
    }
    return undefined;
  }

  iterate(v: any): any[] {
    if (v instanceof KRange) {
      if (v.step === 0) this.throwEx("UnsupportedOperationException", "Cannot iterate over a floating-point range");
      return v.isChar ? v.toArray().map((c) => new Ch(String.fromCharCode(c))) : v.toArray();
    }
    if (v instanceof KList) return v.items.slice();
    if (v instanceof KSet) return v.values();
    if (v instanceof KMap) return v.entries().map((e) => new KPair(e[0], e[1], true));
    if (typeof v === "string") return v.split("").map((c) => new Ch(c));
    if (v === null || v === undefined) this.npe("Attempt to iterate over a null reference");
    this.throwEx("UnsupportedOperationException", typeName(v) + " is not iterable");
  }

  execFor(s: any, scope: Scope): any {
    const items = this.iterate(this.ev(s.it, scope));
    for (let i = 0; i < items.length; i++) {
      this.tick();
      const inner = new Scope(scope);
      if (s.names) this.destructure(items[i], s.names, inner, false);
      else inner.declare(s.n, items[i], false);
      try {
        this.execBlock(s.body, inner);
      } catch (e) {
        if (e instanceof BreakSig && this.loopLabelMatches(e, s.label)) break;
        if (e instanceof ContinueSig && this.loopLabelMatches(e, s.label)) continue;
        throw e;
      }
    }
    return undefined;
  }

  // ------------------------------------------------------------------------------------------ expressions
  ev(n: any, scope: Scope): any {
    switch (n.t) {
      case "Num":
        return n.kind === "Double" ? new Dbl(n.v) : n.kind === "Float" ? new Dbl(Math.fround(n.v), true) : n.v;
      case "Str": {
        let out = "";
        for (let i = 0; i < n.parts.length; i++) {
          const p = n.parts[i];
          out += typeof p === "string" ? p : this.kStr(this.ev(p, scope));
        }
        return out;
      }
      case "Char":
        return new Ch(n.v);
      case "Bool":
        return n.v;
      case "Null":
        return null;
      case "Paren":
        return this.ev(n.e, scope);
      case "Name":
        return this.lookupName(n.n, scope, n.p);
      case "This": {
        let s: Scope | null = scope;
        while (s) {
          if (s.hasRecv) return s.recv;
          s = s.parent;
        }
        throw new StopSig("'this' is not defined in this context");
      }
      case "Un":
        return this.evUnary(n, scope);
      case "Post": {
        const old = this.ev(n.e, scope);
        this.assignTo(n.e, this.arith(n.op === "++" ? "+" : "-", old, 1, n), scope);
        return old;
      }
      case "Assign":
        return this.evAssign(n, scope);
      case "Bin":
        return this.evBinary(n, scope);
      case "Is": {
        const r = isInstance(this.ev(n.e, scope), n.ty.name);
        return n.neg ? !r : r;
      }
      case "As": {
        const v = this.ev(n.e, scope);
        if (v === null) {
          if (n.ty.nullable || n.safe) return null;
          this.throwEx("NullPointerException", "null cannot be cast to non-null type " + n.ty.name);
        }
        if (isInstance(v, n.ty.name) || n.ty.name === "Any") return v;
        if (n.ty.name === "Double" && typeof v === "number") return new Dbl(v);
        if (n.safe) return null;
        if (this.host.isNativeClass(n.ty.name) || (v && v.kType)) return v; // views and other native objects are not type-checked
        this.throwEx("ClassCastException", "class " + typeName(v) + " cannot be cast to class " + n.ty.name);
      }
      case "NotNull": {
        const v = this.ev(n.e, scope);
        if (v === null || v === undefined) this.npe();
        return v;
      }
      case "Dot": {
        if (n.o.t === "Super") return undefined;
        let obj: any;
        if (n.o.t === "Name" && !scope.lookup(n.o.n)) obj = this.lookupName(n.o.n, scope, n.o.p);
        else obj = this.ev(n.o, scope);
        return this.getMember(obj, n.n, n.safe, n.p);
      }
      case "Call":
        return this.evalCall(n, scope);
      case "Index":
        return this.evIndex(n, scope);
      case "If": {
        const c = this.ev(n.c, scope);
        if (c === true) return this.runBody(n.a, scope);
        if (n.b) return this.runBody(n.b, scope);
        return undefined;
      }
      case "When":
        return this.evWhen(n, scope);
      case "Lam": {
        const f = new KFun("<lambda>", n.params, scope, true);
        f.body = n.body;
        f.hasParams = n.hasParams;
        return f;
      }
      case "Try":
        return this.evTry(n, scope);
      case "Obj":
        return this.evObject(n, scope);
      case "ClassRef": {
        const v = n.e.t === "Name" ? this.lookupName(n.e.n, scope, n.p) : this.ev(n.e, scope);
        return v;
      }
      case "FnRef":
        return this.evFnRef(n, scope);
      default:
        throw new StopSig("Unsupported expression: " + n.t);
    }
  }

  evFnRef(n: any, scope: Scope): any {
    if (n.o) {
      const target = n.o.t === "Name" && !scope.lookup(n.o.n) ? this.lookupName(n.o.n, scope, n.p) : this.ev(n.o, scope);
      return new NativeFn(n.n, (args, named) => (target instanceof ClassVal && !target.info.isEnum && args.length ? this.callMember(args[0], n.n, args.slice(1), named, n, false) : this.callMember(target, n.n, args, named, n, false)));
    }
    return new NativeFn(n.n, (args, named) => {
      if (this.funs[n.n]) return this.callGlobalFun(n.n, args, named);
      if (this.classes[n.n]) return this.instantiate(this.classes[n.n], args, named);
      return this.callFn(this.lookupName(n.n, scope, n.p), args, named);
    });
  }

  evObject(n: any, scope: Scope): any {
    const decl = { t: "Class", n: "<anonymous>", kind: "class", params: [], hasCtor: false, supers: n.supers, members: n.members, mods: [], p: n.p };
    const info = this.registerClass(decl, scope, "");
    delete this.classes["<anonymous>"];
    this.linkClass(info);
    const obj = new KObj(info);
    this.initObject(obj, info, [], {});
    return obj;
  }

  evTry(n: any, scope: Scope): any {
    try {
      try {
        return this.runBody(n.body, scope);
      } catch (e: any) {
        let thrown: any = null;
        if (e instanceof ThrowSig) thrown = e.value;
        else if (e instanceof RangeError && /call stack/i.test(String(e.message))) thrown = new KEx("StackOverflowError", null);
        if (thrown === null) throw e;
        for (let i = 0; i < n.catches.length; i++) {
          const c = n.catches[i];
          if (isInstance(thrown, c.ty.name) || (c.ty.name === "Throwable") || (c.ty.name === "Exception" && !(thrown instanceof KEx && thrown.name.indexOf("Error") >= 0 && thrown.name !== "IllegalStateException"))) {
            const inner = new Scope(scope);
            inner.declare(c.n, thrown, false);
            return this.execBlock(c.body, inner);
          }
        }
        throw e instanceof ThrowSig ? e : new ThrowSig(thrown);
      }
    } finally {
      if (n.fin) this.runBody(n.fin, scope);
    }
  }

  evWhen(n: any, scope: Scope): any {
    const hasSubject = n.s !== undefined && n.s !== null;
    const subject = hasSubject ? this.ev(n.s, scope) : undefined;
    for (let i = 0; i < n.br.length; i++) {
      const br = n.br[i];
      if (br.conds === null) return this.runBody(br.body, scope);
      for (let k = 0; k < br.conds.length; k++) {
        const c = br.conds[k];
        let hit: boolean;
        if (c.is) hit = isInstance(subject, c.ty.name) !== c.neg;
        else if (c.inn) hit = this.contains(this.ev(c.e, scope), subject) !== c.neg;
        else if (hasSubject) hit = this.equals(subject, this.ev(c.e, scope));
        else hit = this.ev(c.e, scope) === true;
        if (hit) return this.runBody(br.body, scope);
      }
    }
    return undefined;
  }

  evIndex(n: any, scope: Scope): any {
    const o = this.ev(n.o, scope);
    const idx = n.args.map((a: any) => this.ev(a, scope));
    return this.getIndex(o, idx[0]);
  }

  getIndex(o: any, i: any): any {
    if (o === null || o === undefined) this.npe("Attempt to index a null reference");
    if (o instanceof KList) {
      if (typeof i !== "number" || i < 0 || i >= o.items.length) this.throwEx("IndexOutOfBoundsException", "Index " + i + " out of bounds for length " + o.items.length);
      return o.items[i];
    }
    if (o instanceof KMap) return o.get(i);
    if (typeof o === "string") {
      if (i < 0 || i >= o.length) this.throwEx("StringIndexOutOfBoundsException", "index " + i + ", length " + o.length);
      return new Ch(o.charAt(i));
    }
    if (o && typeof o.getIndex === "function") return o.getIndex(i, this);
    this.throwEx("UnsupportedOperationException", "Cannot index into " + typeName(o));
  }

  setIndex(o: any, i: any, v: any): void {
    if (o instanceof KList) {
      if (!o.mutable) this.throwEx("UnsupportedOperationException", "Read-only list");
      if (typeof i !== "number" || i < 0 || i >= o.items.length) this.throwEx("IndexOutOfBoundsException", "Index " + i + " out of bounds for length " + o.items.length);
      o.items[i] = v;
      if (o.onChange) o.onChange();
      return;
    }
    if (o instanceof KMap) {
      if (!o.mutable) this.throwEx("UnsupportedOperationException", "Read-only map");
      o.put(i, v);
      return;
    }
    this.throwEx("UnsupportedOperationException", "Cannot assign into " + typeName(o));
  }

  evUnary(n: any, scope: Scope): any {
    const v = this.ev(n.e, scope);
    if (n.op === "!") {
      if (typeof v !== "boolean") this.throwEx("ClassCastException", "Operator ! needs a Boolean");
      return !v;
    }
    if (n.op === "-") {
      if (v instanceof Dbl) return new Dbl(-v.v, v.f);
      if (v instanceof KObj) return this.callMember(v, "unaryMinus", [], {}, n, false);
      return -v;
    }
    return v;
  }

  assignTo(target: any, value: any, scope: Scope): void {
    if (target.t === "Name") {
      const r = scope.lookup(target.n);
      if (r) {
        if (!r.mut && !r.del) this.throwEx("IllegalStateException", "Val cannot be reassigned: " + target.n);
        if (r.del) r.del.setValue(value);
        else {
          if (r.ty === "Double" && typeof value === "number") value = new Dbl(value);
          r.v = value;
        }
        return;
      }
      const recvs = this.receivers(scope);
      for (let i = 0; i < recvs.length; i++) {
        const rv = recvs[i];
        if (rv instanceof KObj) {
          if (Object.prototype.hasOwnProperty.call(rv.f, target.n) || rv.delegates[target.n]) {
            this.setMember(rv, target.n, value, target.p);
            return;
          }
          const comp = this.companionOf(rv.cls);
          if (comp && Object.prototype.hasOwnProperty.call(comp.f, target.n)) {
            comp.f[target.n] = value;
            return;
          }
          if (rv.native && rv.native.setProp && rv.native.setProp(target.n, value, this)) return;
        } else if (rv && rv.setProp && rv.setProp(target.n, value, this)) return;
      }
      const g = this.props[target.n];
      if (g) {
        this.readRef(g);
        if (g.del) g.del.setValue(value);
        else g.v = value;
        return;
      }
      this.throwEx("UnsupportedOperationException", "Unresolved reference: " + target.n);
    }
    if (target.t === "Dot") {
      let obj: any;
      if (target.o.t === "Name" && !scope.lookup(target.o.n)) obj = this.lookupName(target.o.n, scope, target.o.p);
      else obj = this.ev(target.o, scope);
      if (obj === null && target.safe) return;
      this.setMember(obj, target.n, value, target.p);
      return;
    }
    if (target.t === "Index") {
      const o = this.ev(target.o, scope);
      this.setIndex(o, this.ev(target.args[0], scope), value);
      return;
    }
    throw new StopSig("Invalid assignment target");
  }

  evAssign(n: any, scope: Scope): any {
    let value: any;
    if (n.op === "=") value = this.ev(n.e, scope);
    else {
      const cur = this.ev(n.tgt, scope);
      const rhs = this.ev(n.e, scope);
      // a MutableList `+=` appends in place
      if (cur instanceof KList && cur.mutable && n.op === "+=") {
        this.callMember(cur, "add", [rhs], {}, n, false);
        return undefined;
      }
      value = this.arith(n.op.slice(0, -1), cur, rhs, n);
    }
    this.assignTo(n.tgt, value, scope);
    return n.prefix ? value : undefined;
  }

  contains(container: any, x: any): boolean {
    if (container instanceof KRange) return typeof num(x) === "number" && (container.isChar ? x instanceof Ch && container.has(x.c.charCodeAt(0)) : container.step === 0 ? num(x) >= container.first && num(x) <= container.last : container.has(num(x)));
    if (container instanceof KList) return container.items.some((e) => this.equals(e, x));
    if (container instanceof KSet) return container.has(x);
    if (container instanceof KMap) return container.has(x);
    if (typeof container === "string") return container.indexOf(this.kStr(x)) >= 0;
    if (container instanceof KObj) return this.callMember(container, "contains", [x], {}, null, false) === true;
    this.throwEx("UnsupportedOperationException", "'in' is not supported for " + typeName(container));
  }

  evBinary(n: any, scope: Scope): any {
    const op: string = n.op;
    if (op === "&&") {
      const l = this.ev(n.l, scope);
      return l === true && this.ev(n.r, scope) === true;
    }
    if (op === "||") {
      const l = this.ev(n.l, scope);
      return l === true || this.ev(n.r, scope) === true;
    }
    if (op === "?:") {
      const l = this.ev(n.l, scope);
      return l !== null && l !== undefined ? l : this.ev(n.r, scope);
    }
    const a = this.ev(n.l, scope);
    const b = this.ev(n.r, scope);
    switch (op) {
      case "==":
        return this.equals(a, b);
      case "!=":
        return !this.equals(a, b);
      case "===":
        return a === b || (a instanceof Ch && b instanceof Ch && a.c === b.c);
      case "!==":
        return !(a === b);
      case "<":
        return this.compare(a, b) < 0;
      case ">":
        return this.compare(a, b) > 0;
      case "<=":
        return this.compare(a, b) <= 0;
      case ">=":
        return this.compare(a, b) >= 0;
      case "in":
        return this.contains(b, a);
      case "!in":
        return !this.contains(b, a);
      case "..": {
        if (a instanceof Ch) return new KRange(a.c.charCodeAt(0), (b as Ch).c.charCodeAt(0), 1, true);
        if (a instanceof Dbl || b instanceof Dbl) return new KRange(num(a), num(b), 0);
        return new KRange(a, b, 1);
      }
      case "..<":
        return new KRange(a, b - 1, 1);
      case "infix:until":
        if (a instanceof Ch) return new KRange(a.c.charCodeAt(0), (b as Ch).c.charCodeAt(0) - 1, 1, true);
        return new KRange(a, b - 1, 1);
      case "infix:downTo":
        if (a instanceof Ch) return new KRange(a.c.charCodeAt(0), (b as Ch).c.charCodeAt(0), -1, true);
        return new KRange(a, b, -1);
      case "infix:step":
        if (a instanceof KRange) {
          if (b <= 0) this.throwEx("IllegalArgumentException", "Step must be positive, was: " + b);
          return new KRange(a.first, a.last, a.step < 0 ? -b : b, a.isChar);
        }
        break;
      case "infix:to":
        return new KPair(a, b);
      case "infix:and":
        return typeof a === "boolean" ? a && b : a & b;
      case "infix:or":
        return typeof a === "boolean" ? a || b : a | b;
      case "infix:xor":
        return typeof a === "boolean" ? a !== b : a ^ b;
      case "infix:shl":
        return a << b;
      case "infix:shr":
        return a >> b;
      case "infix:ushr":
        return a >>> b;
      case "infix:rem":
      case "infix:mod":
        return this.arith("%", a, b, n);
      case "infix:zip":
      case "infix:compareTo":
      case "infix:equals":
        return this.callMember(a, op.slice(6), [b], {}, n, false);
      default:
        break;
    }
    return this.arith(op, a, b, n);
  }

  arith(op: string, a: any, b: any, node: any): any {
    if (a === null || a === undefined || b === null || b === undefined) {
      if (op === "+" && typeof a === "string") return a + this.kStr(b);
      if (a === null || a === undefined) this.npe("Cannot apply '" + op + "' to a null value");
    }
    if (op === "+" && (typeof a === "string")) return a + this.kStr(b);
    if (a instanceof KObj) {
      const nm = op === "+" ? "plus" : op === "-" ? "minus" : op === "*" ? "times" : op === "/" ? "div" : "rem";
      return this.callMember(a, nm, [b], {}, node, false);
    }
    if (op === "+" && a instanceof KList) return new KList(a.items.concat(b instanceof KList ? b.items : [b]), false);
    if (op === "-" && a instanceof KList) return new KList(a.items.filter((x) => !(b instanceof KList ? b.items.some((y) => this.equals(x, y)) : this.equals(x, b))), false);
    if (op === "+" && a instanceof KSet) {
      const s = new KSet(false);
      a.values().forEach((x) => s.add(x));
      (b instanceof KSet ? b.values() : b instanceof KList ? b.items : [b]).forEach((x: any) => s.add(x));
      return s;
    }
    if (op === "+" && a instanceof KMap) {
      const m = new KMap(false);
      a.entries().forEach((e) => m.put(e[0], e[1]));
      if (b instanceof KPair) m.put(b.a, b.b);
      else if (b instanceof KMap) b.entries().forEach((e) => m.put(e[0], e[1]));
      return m;
    }
    if (a instanceof Ch) {
      if (b instanceof Ch && op === "-") return a.c.charCodeAt(0) - b.c.charCodeAt(0);
      if (typeof b === "number" && (op === "+" || op === "-")) return new Ch(String.fromCharCode(a.c.charCodeAt(0) + (op === "+" ? b : -b)));
    }
    if (typeof a === "boolean" || typeof b === "boolean" || typeof a === "string") this.throwEx("UnsupportedOperationException", "Operator '" + op + "' cannot be applied to " + typeName(a) + " and " + typeName(b));
    const dbl = a instanceof Dbl || b instanceof Dbl;
    const x = num(a);
    const y = num(b);
    if (typeof x !== "number" || typeof y !== "number") this.throwEx("UnsupportedOperationException", "Operator '" + op + "' cannot be applied to " + typeName(a) + " and " + typeName(b));
    const isFloat = dbl && (!(a instanceof Dbl) || a.f) && (!(b instanceof Dbl) || b.f);
    let r: number;
    switch (op) {
      case "+":
        r = x + y;
        break;
      case "-":
        r = x - y;
        break;
      case "*":
        r = x * y;
        break;
      case "/":
        if (!dbl) {
          if (y === 0) this.throwEx("ArithmeticException", "/ by zero");
          return Math.trunc(x / y);
        }
        r = x / y;
        break;
      case "%":
        if (!dbl && y === 0) this.throwEx("ArithmeticException", "/ by zero");
        r = x % y;
        break;
      default:
        throw new StopSig("Unsupported operator " + op);
    }
    return dbl ? new Dbl(isFloat ? Math.fround(r) : r, isFloat) : r;
  }
}

export { hashKey };
