/** Compile-time checks for the Kotlin the student wrote. This is NOT a full Kotlin compiler: it reports syntax errors (from the
 *  parser) plus three classes of definite error: unresolved references, literal type mismatches and reassigning a `val`.
 *  It is conservative: when it is not sure a program is wrong it stays silent (the interpreter then reports any real failure
 *  at run time). */
import { parseKotlin } from "./parser";
import { KotlinSyntaxError } from "./lexer";
import { globalFunctions } from "./stdlib";

export interface Diagnostic {
  severity: "error" | "warning" | "info";
  file: string;
  line: number;
  col: number;
  message: string;
}

const ALWAYS_KNOWN = ["it", "field", "value", "this", "super", "null", "true", "false", "args", "println", "print", "TODO", "arrayOf", "listOf", "mapOf", "setOf"];
const RECEIVER_LAMBDA_CALLS = ["apply", "run", "with", "buildString", "also", "let", "use", "runCatching", "buildList", "buildMap", "forEach", "map", "filter", "repeat", "remember", "LaunchedEffect", "launch", "lazy", "block"];
const LITERAL_TYPES: { [k: string]: string[] } = {
  Int: ["Int"], Long: ["Int", "Long"], Short: ["Int"], Byte: ["Int"], Double: ["Double"], Float: ["Float"],
  String: ["String"], Boolean: ["Boolean"], Char: ["Char"],
};

function litType(e: any): string | null {
  if (!e) return null;
  if (e.t === "Paren") return litType(e.e);
  if (e.t === "Num") return e.kind;
  if (e.t === "Str") return "String";
  if (e.t === "Bool") return "Boolean";
  if (e.t === "Char") return "Char";
  if (e.t === "Null") return "Null";
  return null;
}
function typeName(ty: any): string {
  return ty && ty.name ? ty.name + (ty.nullable ? "?" : "") : "?";
}
function litMismatch(ty: any, e: any): string | null {
  if (!ty || ty.fn || (ty.args && ty.args.length)) return null;
  const lt = litType(e);
  if (!lt) return null;
  if (lt === "Null") return ty.nullable ? null : LITERAL_TYPES[ty.name] || /^[A-Z]/.test(ty.name) ? "Null can not be a value of a non-null type " + ty.name : null;
  const ok = LITERAL_TYPES[ty.name];
  if (!ok) return null;
  if (ok.indexOf(lt) >= 0) return null;
  return "Type mismatch: inferred type is " + lt + " but " + typeName(ty) + " was expected";
}

export interface CheckOptions {
  /** names (functions, properties, classes) the Android runtime provides on top of the Kotlin stdlib */
  isKnownGlobal: (name: string) => boolean;
  /** member names a class extending an Android/Java base may call without a receiver */
  isInheritedMember: (name: string) => boolean;
}

export function checkKotlin(files: { name: string; src: string }[], opts: CheckOptions): { diagnostics: Diagnostic[]; asts: { name: string; ast: any }[] } {
  const diagnostics: Diagnostic[] = [];
  const asts: { name: string; ast: any }[] = [];
  files.forEach((f) => {
    try {
      asts.push({ name: f.name, ast: parseKotlin(f.src) });
    } catch (e: any) {
      if (e && typeof e.line === "number") diagnostics.push({ severity: "error", file: f.name, line: e.line, col: e.col, message: e.message });
      else throw e;
    }
  });
  if (diagnostics.length) return { diagnostics, asts };

  // ---- global declarations across all files
  const globalNames: { [n: string]: boolean } = {};
  const classMembers: { [cls: string]: { [n: string]: boolean } } = {};
  const classSupers: { [cls: string]: string[] } = {};
  const funSigs: { [n: string]: any[] } = {};
  const add = (n: string) => (globalNames[n] = true);
  asts.forEach((f) =>
    f.ast.imports.forEach((im: any) => add(im.alias || im.name))
  );
  const registerClass = (d: any) => {
    add(d.n);
    const m: { [n: string]: boolean } = {};
    (d.params || []).forEach((p: any) => (m[p.n] = true));
    (d.members || []).forEach((mm: any) => {
      if (mm.t === "Fun" || mm.t === "Val") {
        if (mm.names) mm.names.forEach((x: string) => (m[x] = true));
        else m[mm.n] = true;
      } else if (mm.t === "Class") {
        add(mm.n);
        registerClass(mm);
      }
    });
    (d.entries || []).forEach((e: any) => (m[e.n] = true));
    if (d.companion) (d.companion.members || []).forEach((mm: any) => mm.n && (m[mm.n] = true));
    classMembers[d.n] = m;
    classSupers[d.n] = (d.supers || []).map((s: any) => s.ty.name);
  };
  asts.forEach((f) =>
    f.ast.decls.forEach((d: any) => {
      if (d.t === "Class") registerClass(d);
      else if (d.t === "Fun") {
        add(d.n);
        (funSigs[d.n] = funSigs[d.n] || []).push(d);
      } else if (d.t === "Val") {
        if (d.names) d.names.forEach(add);
        else add(d.n);
      }
    })
  );
  const enumEntries: { [n: string]: boolean } = {};
  Object.keys(classMembers).forEach((c) => Object.keys(classMembers[c]).forEach((n) => (enumEntries[n] = true)));

  const memberOf = (cls: string, n: string, seen: { [k: string]: boolean } = {}): "yes" | "no" | "unknown" => {
    if (seen[cls]) return "no";
    seen[cls] = true;
    if (classMembers[cls] && classMembers[cls][n]) return "yes";
    const sup = classSupers[cls];
    if (!sup) return "unknown";
    let unknown = !classMembers[cls];
    for (let i = 0; i < sup.length; i++) {
      if (classMembers[sup[i]]) {
        const r = memberOf(sup[i], n, seen);
        if (r === "yes") return "yes";
        if (r === "unknown") unknown = true;
      } else unknown = true; // a native / library base class
    }
    return unknown ? "unknown" : "no";
  };

  const known = (n: string): boolean =>
    ALWAYS_KNOWN.indexOf(n) >= 0 || !!globalNames[n] || !!globalFunctions[n] || opts.isKnownGlobal(n) || /^[A-Z]/.test(n);

  const err = (file: string, p: any, message: string) => diagnostics.push({ severity: "error", file, line: p ? p[0] : 1, col: p ? p[1] : 1, message });

  // ---- walk one function / lambda / initialiser with hoisted local names
  const collectLocals = (node: any, into: { [n: string]: "val" | "var" | "param" | "mixed" }, top = true): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((x) => collectLocals(x, into, top));
      return;
    }
    const decl = (n: string, kind: "val" | "var" | "param") => {
      into[n] = into[n] && into[n] !== kind ? "mixed" : kind;
    };
    if (node.t === "Val") {
      const kind = node.mut ? "var" : "val";
      if (node.names) node.names.forEach((x: string) => decl(x, "var"));
      else if (node.n) decl(node.n, node.init === undefined && !node.delegate ? "var" : node.delegate ? "var" : kind);
    } else if (node.t === "For") {
      if (node.names) node.names.forEach((x: string) => decl(x, "param"));
      else if (node.n) decl(node.n, "param");
    } else if (node.t === "Try") {
      (node.catches || []).forEach((c: any) => decl(c.n, "param"));
    } else if (node.t === "Lam") {
      (node.params || []).forEach((p: any) => (p.n && p.n.charAt(0) === "(" ? p.n.slice(1, -1).split(",").forEach((x: string) => decl(x, "param")) : p.n && decl(p.n, "param")));
    } else if (node.t === "Fun" && !top) {
      decl(node.n, "param");
      (node.params || []).forEach((p: any) => decl(p.n, "param"));
    } else if (node.t === "Class" && !top) {
      decl(node.n, "param");
      return;
    }
    Object.keys(node).forEach((k) => {
      if (k === "p" || k === "ty" || k === "declPos" || k === "namePos") return;
      const v = node[k];
      if (v && typeof v === "object") collectLocals(v, into, false);
    });
  };

  const checkBody = (
    file: string,
    node: any,
    locals: { [n: string]: string },
    clsName: string | null,
    recvDepth: number,
    ctx: { ret?: any }
  ): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((x) => checkBody(file, x, locals, clsName, recvDepth, ctx));
      return;
    }
    const visit = (x: any, d = recvDepth) => checkBody(file, x, locals, clsName, d, ctx);
    switch (node.t) {
      case "Name": {
        const n = node.n;
        if (locals[n] || known(n)) return;
        if (recvDepth > 0) return;
        if (clsName) {
          const r = memberOf(clsName, n);
          if (r === "yes") return;
          if (r === "unknown" && opts.isInheritedMember(n)) return;
        }
        if (enumEntries[n] && recvDepth > 0) return;
        err(file, node.p, "Unresolved reference: " + n);
        return;
      }
      case "Call": {
        const f = node.f;
        if (f && f.t === "Name") {
          const n = f.n;
          if (!locals[n] && !known(n) && recvDepth === 0) {
            let ok = false;
            if (clsName) {
              const r = memberOf(clsName, n);
              ok = r === "yes" || (r === "unknown" && opts.isInheritedMember(n));
            }
            if (!ok) err(file, f.p, "Unresolved reference: " + n);
          }
          // literal argument type check against a unique top-level overload
          const sigs = funSigs[n];
          if (sigs && sigs.length === 1 && !locals[n]) {
            const params = sigs[0].params;
            (node.args || []).forEach((a: any, i: number) => {
              if (a.name || a.spread || !params[i] || params[i].vararg) return;
              const msg = litMismatch(params[i].ty, a.e);
              if (msg) err(file, a.e.p, msg);
            });
          }
        } else visit(f);
        (node.args || []).forEach((a: any) => visit(a.e));
        if (node.lam) {
          const callee = f && f.t === "Name" ? f.n : f && f.t === "Dot" ? f.n : "";
          visitLambda(node.lam, RECEIVER_LAMBDA_CALLS.indexOf(callee) >= 0 || !(callee && (globalFunctions[callee] || callee === "with")) ? recvDepth + (RECEIVER_LAMBDA_CALLS.indexOf(callee) >= 0 || /^[A-Z]/.test(callee) || (f && f.t === "Dot") ? 1 : 0) : recvDepth);
        }
        return;
      }
      case "Lam":
        visitLambda(node, recvDepth);
        return;
      case "Dot":
        visit(node.o);
        return;
      case "Val": {
        if (node.ty && node.init) {
          const msg = litMismatch(node.ty, node.init);
          if (msg) err(file, node.init.p || node.p, msg);
        }
        if (node.init) visit(node.init);
        if (node.getter) visit(node.getter);
        if (node.delegate) visit(node.delegate);
        return;
      }
      case "Assign": {
        const tgt = node.tgt;
        if (tgt && tgt.t === "Name") {
          if (locals[tgt.n] === "val" && node.op === "=") err(file, tgt.p, "Val cannot be reassigned");
          else if (locals[tgt.n] === "val") err(file, tgt.p, "Val cannot be reassigned");
          visit(tgt);
        } else visit(tgt);
        visit(node.e);
        return;
      }
      case "Ret": {
        if (node.e && ctx.ret) {
          const msg = litMismatch(ctx.ret, node.e);
          if (msg) err(file, node.e.p || node.p, msg);
        }
        visit(node.e);
        return;
      }
      case "Fun":
      case "Class":
        return; // nested declarations are checked on their own
      case "Str":
        (node.parts || []).forEach((part: any) => typeof part === "object" && visit(part));
        return;
      default:
        Object.keys(node).forEach((k) => {
          if (k === "p" || k === "ty" || k === "declPos" || k === "namePos") return;
          const v = node[k];
          if (v && typeof v === "object") visit(v);
        });
    }
  };

  const visitLambdaFile = { cur: "" };
  const visitLambda = (lam: any, depth: number) => {
    // lambda-local names are already hoisted into the enclosing function's `locals`
    checkBody(visitLambdaFile.cur, lam.body, curLocals.v, curCls.v, depth, curCtx.v);
  };
  const curLocals = { v: {} as { [n: string]: string } };
  const curCls = { v: null as string | null };
  const curCtx = { v: {} as { ret?: any } };

  const checkFunction = (file: string, fn: any, cls: string | null, outer: { [n: string]: string }) => {
    const locals: { [n: string]: any } = {};
    Object.keys(outer).forEach((k) => (locals[k] = outer[k] === "val" ? "param" : outer[k]));
    (fn.params || []).forEach((p: any) => (locals[p.n] = "param"));
    collectLocals(fn.body, locals);
    // a name declared as `val` anywhere stays "val" only if not also assigned elsewhere as var (collectLocals marks mixed)
    Object.keys(locals).forEach((k) => {
      if (locals[k] === "mixed") locals[k] = "param";
    });
    (fn.params || []).forEach((p: any) => {
      locals[p.n] = "param";
      if (p.def) {
        const msg = litMismatch(p.ty, p.def);
        if (msg) err(file, p.def.p || p.p, msg);
      }
    });
    const saved = { l: curLocals.v, c: curCls.v, x: curCtx.v, f: visitLambdaFile.cur };
    curLocals.v = locals;
    curCls.v = cls;
    curCtx.v = { ret: fn.ret };
    visitLambdaFile.cur = file;
    if (fn.body) {
      if (fn.exprBody) {
        const msg = litMismatch(fn.ret, fn.body);
        if (msg) err(file, fn.body.p || fn.p, msg);
        checkBody(file, fn.body, locals, cls, 0, curCtx.v);
      } else checkBody(file, fn.body, locals, cls, 0, curCtx.v);
    }
    curLocals.v = saved.l;
    curCls.v = saved.c;
    curCtx.v = saved.x;
    visitLambdaFile.cur = saved.f;
  };

  const checkClass = (file: string, d: any, outerLocals: { [n: string]: string } = {}) => {
    const clsLocals: { [n: string]: string } = {};
    Object.keys(outerLocals).forEach((k) => (clsLocals[k] = outerLocals[k]));
    (d.params || []).forEach((p: any) => (clsLocals[p.n] = "param"));
    (d.members || []).forEach((m: any) => {
      if (m.t === "Fun") checkFunction(file, m, d.n, clsLocals);
      else if (m.t === "Val") {
        checkFunction(file, { params: [], body: [m.init, m.getter, m.delegate].filter(Boolean), exprBody: false, ret: null }, d.n, clsLocals);
        if (m.ty && m.init) {
          const msg = litMismatch(m.ty, m.init);
          if (msg) err(file, m.init.p || m.p, msg);
        }
      } else if (m.t === "Init") checkFunction(file, { params: [], body: m.body, ret: null }, d.n, clsLocals);
      else if (m.t === "Class") checkClass(file, m, clsLocals);
    });
    (d.params || []).forEach((p: any) => {
      if (p.def) {
        const msg = litMismatch(p.ty, p.def);
        if (msg) err(file, p.def.p || p.p, msg);
      }
    });
    if (d.companion) checkClass(file, { ...d.companion, n: d.n }, clsLocals);
  };

  asts.forEach((f) =>
    f.ast.decls.forEach((d: any) => {
      if (d.t === "Fun") checkFunction(f.name, d, null, {});
      else if (d.t === "Class") checkClass(f.name, d);
      else if (d.t === "Val") {
        checkFunction(f.name, { params: [], body: [d.init, d.getter, d.delegate].filter(Boolean), ret: null }, null, {});
        if (d.ty && d.init) {
          const msg = litMismatch(d.ty, d.init);
          if (msg) err(f.name, d.init.p || d.p, msg);
        }
      }
    })
  );

  // de-duplicate (a node can be reached twice through hoisting)
  const seen: { [k: string]: boolean } = {};
  const unique = diagnostics.filter((d) => {
    const k = d.file + ":" + d.line + ":" + d.col + ":" + d.message;
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });
  unique.sort((a, b) => (a.file === b.file ? a.line - b.line || a.col - b.col : a.file < b.file ? -1 : 1));
  return { diagnostics: unique, asts };
}

export { KotlinSyntaxError };
