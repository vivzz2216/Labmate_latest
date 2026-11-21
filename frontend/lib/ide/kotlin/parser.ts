/** Recursive-descent parser for the Kotlin subset the LabMate Android studio runs. Nodes are plain objects tagged with `t`
 *  and a position `p` = [line, column]. Anything outside the subset is a syntax error with a precise position. */
import { KotlinSyntaxError, Tok, tokenize } from "./lexer";

export type Pos = [number, number];
export interface TypeRef {
  name: string;
  args: TypeRef[];
  nullable: boolean;
  fn?: { params: TypeRef[]; ret: TypeRef };
}
export interface Param {
  n: string;
  ty?: TypeRef;
  def?: any;
  vararg?: boolean;
  /** primary-constructor property */
  prop?: "val" | "var";
  p: Pos;
}
export interface FileNode {
  pkg: string;
  imports: { path: string; name: string; alias?: string; star: boolean; p: Pos }[];
  decls: any[];
}

const MODIFIERS = [
  "private", "public", "internal", "protected", "open", "abstract", "override", "final", "sealed", "data", "enum", "inner",
  "const", "lateinit", "suspend", "inline", "tailrec", "operator", "infix", "vararg", "annotation", "companion", "external", "expect", "actual",
];
const KEYWORDS = [
  "as", "break", "class", "continue", "do", "else", "false", "for", "fun", "if", "in", "interface", "is", "null", "object", "package",
  "return", "super", "this", "throw", "true", "try", "typealias", "val", "var", "when", "while",
];

export class Parser {
  toks: Tok[];
  i = 0;
  constructor(toks: Tok[]) {
    this.toks = toks;
  }

  // ---------------------------------------------------------------- token helpers
  get t(): Tok {
    return this.toks[this.i];
  }
  peek(k = 1): Tok {
    return this.toks[Math.min(this.i + k, this.toks.length - 1)];
  }
  pos(tok: Tok = this.t): Pos {
    return [tok.line, tok.col];
  }
  err(message: string, tok: Tok = this.t): never {
    throw new KotlinSyntaxError(message, tok.line, tok.col);
  }
  isOp(v: string, tok: Tok = this.t): boolean {
    return tok.k === "op" && tok.v === v;
  }
  isId(v: string, tok: Tok = this.t): boolean {
    return tok.k === "id" && tok.v === v;
  }
  acceptOp(v: string): boolean {
    if (this.isOp(v)) {
      this.i++;
      return true;
    }
    return false;
  }
  acceptId(v: string): boolean {
    if (this.isId(v)) {
      this.i++;
      return true;
    }
    return false;
  }
  expectOp(v: string): Tok {
    if (!this.isOp(v)) this.err("Expecting '" + v + "'");
    return this.toks[this.i++];
  }
  expectId(what = "an identifier"): Tok {
    if (this.t.k !== "id" || KEYWORDS.indexOf(this.t.v) >= 0) this.err("Expecting " + what);
    return this.toks[this.i++];
  }
  isIdent(tok: Tok = this.t): boolean {
    return tok.k === "id" && KEYWORDS.indexOf(tok.v) < 0;
  }
  skipSemis(): void {
    while (this.isOp(";")) this.i++;
  }
  /** a statement ends at a newline, a ';' or a closing brace */
  endOfStatement(): void {
    if (this.isOp(";")) {
      this.skipSemis();
      return;
    }
    if (this.t.nl || this.isOp("}") || this.isId("else") || this.t.k === "eof") return;
    this.err("Unexpected tokens (use ';' to separate expressions on the same line)");
  }

  // ---------------------------------------------------------------- file
  parseFile(): FileNode {
    const file: FileNode = { pkg: "", imports: [], decls: [] };
    this.skipAnnotations();
    if (this.isId("package")) {
      this.i++;
      file.pkg = this.qualifiedName();
      this.skipSemis();
    }
    while (this.isId("import")) {
      const p = this.pos();
      this.i++;
      let path = this.expectId("a package or class name").v;
      let star = false;
      while (this.acceptOp(".")) {
        if (this.acceptOp("*")) {
          star = true;
          break;
        }
        path += "." + this.expectId().v;
      }
      let alias: string | undefined;
      if (this.acceptId("as")) alias = this.expectId().v;
      const name = star ? "*" : path.split(".").pop()!;
      file.imports.push({ path, name, alias, star, p });
      this.skipSemis();
    }
    while (this.t.k !== "eof") {
      file.decls.push(this.parseTopLevel());
      this.skipSemis();
    }
    return file;
  }

  qualifiedName(): string {
    let name = this.expectId().v;
    while (this.isOp(".") && this.peek().k === "id") {
      this.i++;
      name += "." + this.toks[this.i++].v;
    }
    return name;
  }

  skipAnnotations(): void {
    while (this.isOp("@")) {
      this.i++;
      if (this.t.k === "id" && this.isOp(":", this.peek())) this.i += 2; // use-site target, e.g. @file:Suppress
      this.qualifiedName();
      // annotation arguments must touch the name: `@Preview(x)` has arguments, `@Composable () -> Unit` is a function type
      if (this.isOp("(") && this.t.start === this.toks[this.i - 1].end) this.skipBalanced("(", ")");
    }
  }
  skipBalanced(open: string, close: string): void {
    let depth = 0;
    do {
      if (this.t.k === "eof") this.err("Expecting '" + close + "'");
      if (this.isOp(open)) depth++;
      else if (this.isOp(close)) depth--;
      this.i++;
    } while (depth > 0);
  }

  parseModifiers(): string[] {
    const mods: string[] = [];
    for (;;) {
      this.skipAnnotations();
      if (this.t.k === "id" && MODIFIERS.indexOf(this.t.v) >= 0) {
        // `companion object`, `data class`, `enum class`... but a modifier word used as a name (e.g. `open()`) is left alone
        const next = this.peek();
        if (next.k === "id" || this.isOp("@", next)) {
          mods.push(this.t.v);
          this.i++;
          continue;
        }
      }
      return mods;
    }
  }

  parseTopLevel(): any {
    const mods = this.parseModifiers();
    return this.parseDeclaration(mods, true);
  }

  parseDeclaration(mods: string[], top: boolean): any {
    const tok = this.t;
    if (this.isId("class") || this.isId("interface")) return this.parseClass(mods);
    if (this.isId("object")) return this.parseObject(mods);
    if (this.isId("fun")) return this.parseFun(mods);
    if (this.isId("val") || this.isId("var")) return this.parseProperty(mods);
    if (this.isId("typealias")) {
      this.i++;
      const name = this.expectId().v;
      this.expectOp("=");
      this.parseType();
      return { t: "Alias", n: name, p: this.pos(tok) };
    }
    if (top) this.err("Expecting a top level declaration");
    this.err("Expecting a member declaration");
  }

  // ---------------------------------------------------------------- types
  parseType(): TypeRef {
    this.skipAnnotations();
    if (this.isId("suspend")) this.i++;
    if (this.isOp("(")) {
      // function type (A, B) -> R  or parenthesised type
      const save = this.i;
      this.i++;
      const params: TypeRef[] = [];
      if (!this.isOp(")")) {
        do {
          if (this.t.k === "id" && this.isOp(":", this.peek())) this.i += 2;
          params.push(this.parseType());
        } while (this.acceptOp(","));
      }
      this.expectOp(")");
      if (this.acceptOp("->")) {
        const ret = this.parseType();
        const ty: TypeRef = { name: "Function" + params.length, args: params.concat([ret]), nullable: false, fn: { params, ret } };
        if (this.acceptOp("?")) ty.nullable = true;
        return ty;
      }
      if (params.length === 1) {
        if (this.acceptOp("?")) params[0].nullable = true;
        return params[0];
      }
      this.i = save;
      this.err("Expecting a type");
    }
    let name = this.expectId("a type").v;
    // receiver function types:  Foo.() -> Unit
    while (this.isOp(".") && this.peek().k === "id") {
      this.i++;
      name += "." + this.toks[this.i++].v;
    }
    const args: TypeRef[] = [];
    if (this.isOp("<")) {
      this.i++;
      do {
        if (this.acceptOp("*")) args.push({ name: "*", args: [], nullable: false });
        else {
          if (this.isId("in") || this.isId("out")) this.i++;
          args.push(this.parseType());
        }
      } while (this.acceptOp(","));
      this.expectOp(">");
    }
    let nullable = false;
    while (this.isOp("?")) {
      this.i++;
      nullable = true;
    }
    if (this.isOp(".") && this.isOp("(", this.peek())) {
      // Receiver.() -> R
      this.i++;
      const f = this.parseType();
      return f;
    }
    return { name: name.split(".").pop()!, args, nullable };
  }

  // ---------------------------------------------------------------- declarations
  parseTypeParams(): void {
    if (this.isOp("<")) {
      let depth = 0;
      do {
        if (this.isOp("<")) depth++;
        else if (this.isOp(">")) depth--;
        this.i++;
      } while (depth > 0 && this.t.k !== "eof");
    }
  }

  parseParams(allowProps: boolean): Param[] {
    this.expectOp("(");
    const params: Param[] = [];
    while (!this.isOp(")")) {
      const mods = this.parseModifiers();
      let prop: "val" | "var" | undefined;
      if (allowProps && (this.isId("val") || this.isId("var"))) prop = this.toks[this.i++].v as any;
      const nameTok = this.expectId("a parameter name");
      let ty: TypeRef | undefined;
      if (this.acceptOp(":")) ty = this.parseType();
      let def: any;
      if (this.acceptOp("=")) def = this.parseExpr();
      params.push({ n: nameTok.v, ty, def, vararg: mods.indexOf("vararg") >= 0, prop, p: this.pos(nameTok) });
      if (!this.acceptOp(",")) break;
    }
    this.expectOp(")");
    return params;
  }

  parseFun(mods: string[]): any {
    const tok = this.t;
    this.i++; // fun
    this.parseTypeParams();
    let name = this.expectId("a function name").v;
    let receiver: string | undefined;
    while (this.isOp(".")) {
      this.i++;
      receiver = (receiver ? receiver + "." : "") + name;
      name = this.expectId("a function name").v;
    }
    const params = this.parseParams(false);
    let ret: TypeRef | undefined;
    if (this.acceptOp(":")) ret = this.parseType();
    let body: any[] | undefined;
    let exprBody: any;
    if (this.isOp("{")) body = this.parseBlock();
    else if (this.acceptOp("=")) exprBody = this.parseExpr();
    const p = this.pos(tok);
    return { t: "Fun", n: name, params, ret, body, exprBody, mods, receiver, p, namePos: this.pos(tok) };
  }

  parseProperty(mods: string[]): any {
    const tok = this.t;
    const mut = this.t.v === "var";
    this.i++;
    this.parseTypeParams();
    const nameTok = this.t;
    let names: string[] | undefined;
    let name = "";
    if (this.isOp("(")) {
      // destructuring declaration
      this.i++;
      names = [];
      do {
        names.push(this.expectId().v);
        if (this.acceptOp(":")) this.parseType();
      } while (this.acceptOp(","));
      this.expectOp(")");
    } else {
      name = this.expectId("a property name").v;
      // extension property receiver  val String.foo
      while (this.isOp(".")) {
        this.i++;
        name = this.expectId().v;
      }
    }
    let ty: TypeRef | undefined;
    if (this.acceptOp(":")) ty = this.parseType();
    let init: any;
    let delegate: any;
    if (this.acceptOp("=")) init = this.parseExpr();
    else if (this.acceptId("by")) delegate = this.parseExpr();
    // simple accessors:  get() = expr   /  get() { ... }   (a setter is parsed and ignored)
    let getter: any;
    for (;;) {
      let k = this.i;
      if (this.toks[k].k === "id" && MODIFIERS.indexOf(this.toks[k].v) >= 0) k++;
      const word = this.toks[k];
      if (!(word.k === "id" && (word.v === "get" || word.v === "set") && this.isOp("(", this.toks[k + 1]))) break;
      this.i = k + 1;
      this.expectOp("(");
      if (word.v === "set" && this.t.k === "id") this.i++;
      this.expectOp(")");
      if (this.acceptOp("=")) {
        const e = this.parseExpr();
        if (word.v === "get") getter = { exprBody: e };
      } else if (this.isOp("{")) {
        const bl = this.parseBlock();
        if (word.v === "get") getter = { body: bl };
      }
    }
    return { t: "Val", mut, n: name, names, ty, init, delegate, getter, mods, p: this.pos(nameTok), declPos: this.pos(tok) };
  }

  parseClass(mods: string[]): any {
    const tok = this.t;
    const isInterface = this.t.v === "interface";
    this.i++;
    const nameTok = this.expectId("a class name");
    this.parseTypeParams();
    let params: Param[] = [];
    let hasCtor = false;
    if (this.isId("constructor")) this.i++;
    if (this.isOp("(")) {
      params = this.parseParams(true);
      hasCtor = true;
    }
    const supers: { ty: TypeRef; args?: any[]; hasCall: boolean }[] = [];
    if (this.acceptOp(":")) {
      do {
        const ty = this.parseType();
        if (this.isOp("(")) {
          const args = this.parseArgs();
          supers.push({ ty, args, hasCall: true });
        } else supers.push({ ty, hasCall: false });
      } while (this.acceptOp(","));
    }
    let members: any[] = [];
    let entries: any[] | undefined;
    if (this.isOp("{")) {
      this.i++;
      if (mods.indexOf("enum") >= 0) entries = this.parseEnumEntries();
      members = this.parseMembers();
      this.expectOp("}");
    }
    return {
      t: "Class", n: nameTok.v, kind: isInterface ? "interface" : "class", params, hasCtor, supers, members, entries, mods,
      p: this.pos(nameTok), declPos: this.pos(tok),
    };
  }

  parseEnumEntries(): any[] {
    const entries: any[] = [];
    this.skipSemis();
    while (this.isIdent() && !(this.t.v === "fun" || this.t.v === "val" || this.t.v === "var")) {
      const nameTok = this.t;
      this.i++;
      let args: any[] = [];
      if (this.isOp("(")) args = this.parseArgs();
      entries.push({ n: nameTok.v, args, p: this.pos(nameTok) });
      if (!this.acceptOp(",")) break;
    }
    this.skipSemis();
    return entries;
  }

  parseObject(mods: string[]): any {
    const tok = this.t;
    this.i++;
    let name = "";
    let companion = mods.indexOf("companion") >= 0;
    if (this.isIdent()) name = this.toks[this.i++].v;
    const supers: any[] = [];
    if (this.acceptOp(":")) {
      do {
        const ty = this.parseType();
        if (this.isOp("(")) supers.push({ ty, args: this.parseArgs(), hasCall: true });
        else supers.push({ ty, hasCall: false });
      } while (this.acceptOp(","));
    }
    let members: any[] = [];
    if (this.acceptOp("{")) {
      members = this.parseMembers();
      this.expectOp("}");
    }
    if (!name && companion) name = "Companion";
    return { t: "Class", n: name, kind: "object", params: [], hasCtor: false, supers, members, mods, companion, p: this.pos(tok), declPos: this.pos(tok) };
  }

  parseMembers(): any[] {
    const members: any[] = [];
    this.skipSemis();
    while (!this.isOp("}")) {
      if (this.t.k === "eof") this.err("Expecting '}'");
      if (this.isId("init") && this.isOp("{", this.peek())) {
        this.i++;
        members.push({ t: "Init", body: this.parseBlock() });
      } else if (this.isId("constructor")) {
        this.err("Secondary constructors are not supported by the LabMate preview");
      } else {
        const mods = this.parseModifiers();
        members.push(this.parseDeclaration(mods, false));
      }
      this.skipSemis();
    }
    return members;
  }

  // ---------------------------------------------------------------- statements
  parseBlock(): any[] {
    this.expectOp("{");
    const stmts = this.parseStatements();
    this.expectOp("}");
    return stmts;
  }

  parseStatements(): any[] {
    const stmts: any[] = [];
    this.skipSemis();
    while (!this.isOp("}") && this.t.k !== "eof") {
      stmts.push(this.parseStatement());
      this.skipSemis();
    }
    return stmts;
  }

  /** body of an if/else/when branch/loop: a block or a single statement */
  parseBody(): any[] {
    if (this.isOp("{")) return this.parseBlock();
    return [this.parseStatement()];
  }

  parseStatement(): any {
    let label: string | undefined;
    if (this.t.k === "id" && this.isOp("@", this.peek()) && !this.peek().nl && this.peek(2).k === "id" && /^(for|while|do)$/.test(this.peek(2).v)) {
      label = this.t.v;
      this.i += 2;
    }
    const tok = this.t;
    const p = this.pos(tok);
    if (tok.k === "id") {
      switch (tok.v) {
        case "val":
        case "var": {
          const d = this.parseProperty([]);
          this.endOfStatement();
          return d;
        }
        case "fun":
          if (this.peek().k === "id" || this.isOp("<", this.peek())) {
            const f = this.parseFun([]);
            return f;
          }
          break;
        case "class":
        case "interface":
        case "object":
          if (this.peek().k === "id") return this.parseDeclaration([], false);
          break;
        case "return": {
          this.i++;
          let rlabel: string | undefined;
          if (this.isOp("@") && !this.t.nl) {
            this.i++;
            rlabel = this.expectId().v;
          }
          let e: any;
          if (!this.t.nl && !this.isOp("}") && !this.isOp(";") && this.t.k !== "eof") e = this.parseExpr();
          this.endOfStatement();
          return { t: "Ret", e, label: rlabel, p };
        }
        case "break":
        case "continue": {
          this.i++;
          let l: string | undefined;
          if (this.isOp("@") && !this.t.nl) {
            this.i++;
            l = this.expectId().v;
          }
          this.endOfStatement();
          return { t: tok.v === "break" ? "Brk" : "Cont", label: l, p };
        }
        case "for": {
          this.i++;
          this.expectOp("(");
          let names: string[] = [];
          let n = "";
          if (this.isOp("(")) {
            this.i++;
            do names.push(this.expectId().v);
            while (this.acceptOp(","));
            this.expectOp(")");
          } else {
            n = this.expectId("a loop variable").v;
            if (this.acceptOp(":")) this.parseType();
          }
          if (!this.acceptId("in")) this.err("Expecting 'in'");
          const it = this.parseExpr();
          this.expectOp(")");
          const body = this.parseBody();
          return { t: "For", n, names: names.length ? names : undefined, it, body, label, p };
        }
        case "while": {
          this.i++;
          this.expectOp("(");
          const c = this.parseExpr();
          this.expectOp(")");
          const body = this.isOp(";") ? [] : this.parseBody();
          return { t: "While", c, body, label, p };
        }
        case "do": {
          this.i++;
          const body = this.parseBody();
          if (!this.acceptId("while")) this.err("Expecting 'while'");
          this.expectOp("(");
          const c = this.parseExpr();
          this.expectOp(")");
          return { t: "DoWhile", c, body, label, p };
        }
        case "throw": {
          this.i++;
          const e = this.parseExpr();
          this.endOfStatement();
          return { t: "Throw", e, p };
        }
        default:
          break;
      }
    }
    const e = this.parseExpr();
    this.endOfStatement();
    return { t: "Expr", e, p };
  }

  // ---------------------------------------------------------------- expressions
  parseExpr(): any {
    return this.parseAssignment();
  }

  parseAssignment(): any {
    const left = this.parseDisjunction();
    const t = this.t;
    if (t.k === "op" && ["=", "+=", "-=", "*=", "/=", "%="].indexOf(t.v) >= 0) {
      if (left.t !== "Name" && left.t !== "Dot" && left.t !== "Index") this.err("The left-hand side of an assignment must be a variable or property");
      this.i++;
      const e = this.parseAssignment();
      return { t: "Assign", op: t.v, tgt: left, e, p: this.pos(t) };
    }
    return left;
  }

  parseDisjunction(): any {
    let l = this.parseConjunction();
    while (this.isOp("||")) {
      const t = this.toks[this.i++];
      l = { t: "Bin", op: "||", l, r: this.parseConjunction(), p: this.pos(t) };
    }
    return l;
  }
  parseConjunction(): any {
    let l = this.parseEquality();
    while (this.isOp("&&")) {
      const t = this.toks[this.i++];
      l = { t: "Bin", op: "&&", l, r: this.parseEquality(), p: this.pos(t) };
    }
    return l;
  }
  parseEquality(): any {
    let l = this.parseComparison();
    while (this.t.k === "op" && ["==", "!=", "===", "!=="].indexOf(this.t.v) >= 0 && !this.t.nl) {
      const t = this.toks[this.i++];
      l = { t: "Bin", op: t.v, l, r: this.parseComparison(), p: this.pos(t) };
    }
    return l;
  }
  parseComparison(): any {
    let l = this.parseNamedChecks();
    while (this.t.k === "op" && ["<", ">", "<=", ">="].indexOf(this.t.v) >= 0 && !this.t.nl) {
      const t = this.toks[this.i++];
      l = { t: "Bin", op: t.v, l, r: this.parseNamedChecks(), p: this.pos(t) };
    }
    return l;
  }
  parseNamedChecks(): any {
    let l = this.parseElvis();
    for (;;) {
      const t = this.t;
      if (t.nl) return l;
      if (this.isId("in")) {
        this.i++;
        l = { t: "Bin", op: "in", l, r: this.parseElvis(), p: this.pos(t) };
      } else if (this.isOp("!") && this.isId("in", this.peek())) {
        this.i += 2;
        l = { t: "Bin", op: "!in", l, r: this.parseElvis(), p: this.pos(t) };
      } else if (this.isId("is")) {
        this.i++;
        l = { t: "Is", e: l, ty: this.parseType(), neg: false, p: this.pos(t) };
      } else if (this.isOp("!") && this.isId("is", this.peek())) {
        this.i += 2;
        l = { t: "Is", e: l, ty: this.parseType(), neg: true, p: this.pos(t) };
      } else return l;
    }
  }
  parseElvis(): any {
    let l = this.parseInfix();
    while (this.isOp("?:")) {
      const t = this.toks[this.i++];
      l = { t: "Bin", op: "?:", l, r: this.parseInfix(), p: this.pos(t) };
    }
    return l;
  }
  parseInfix(): any {
    let l = this.parseRange();
    while (this.t.k === "id" && !this.t.nl && KEYWORDS.indexOf(this.t.v) < 0 && ["until", "downTo", "step", "to", "shl", "shr", "and", "or", "xor", "ushr", "rem", "mod", "zip", "compareTo", "equals"].indexOf(this.t.v) >= 0) {
      const t = this.toks[this.i++];
      l = { t: "Bin", op: "infix:" + t.v, l, r: this.parseRange(), p: this.pos(t) };
    }
    return l;
  }
  parseRange(): any {
    let l = this.parseAdditive();
    while ((this.isOp("..") || this.isOp("..<")) && !this.t.nl) {
      const t = this.toks[this.i++];
      l = { t: "Bin", op: t.v, l, r: this.parseAdditive(), p: this.pos(t) };
    }
    return l;
  }
  parseAdditive(): any {
    let l = this.parseMultiplicative();
    while ((this.isOp("+") || this.isOp("-")) && !this.t.nl) {
      const t = this.toks[this.i++];
      l = { t: "Bin", op: t.v, l, r: this.parseMultiplicative(), p: this.pos(t) };
    }
    return l;
  }
  parseMultiplicative(): any {
    let l = this.parseAs();
    while ((this.isOp("*") || this.isOp("/") || this.isOp("%")) && !this.t.nl) {
      const t = this.toks[this.i++];
      l = { t: "Bin", op: t.v, l, r: this.parseAs(), p: this.pos(t) };
    }
    return l;
  }
  parseAs(): any {
    let l = this.parsePrefix();
    while (this.isId("as") && !this.t.nl) {
      const t = this.toks[this.i++];
      const safe = this.acceptOp("?");
      l = { t: "As", e: l, ty: this.parseType(), safe, p: this.pos(t) };
    }
    return l;
  }
  parsePrefix(): any {
    const t = this.t;
    if (t.k === "op" && (t.v === "-" || t.v === "+" || t.v === "!" || t.v === "++" || t.v === "--")) {
      this.i++;
      const e = this.parsePrefix();
      if (t.v === "++" || t.v === "--") return { t: "Assign", op: t.v === "++" ? "+=" : "-=", tgt: e, e: { t: "Num", v: 1, kind: "Int", p: this.pos(t) }, prefix: true, p: this.pos(t) };
      return { t: "Un", op: t.v, e, p: this.pos(t) };
    }
    return this.parsePostfix();
  }

  parseArgs(): { name?: string; e: any; spread?: boolean }[] {
    this.expectOp("(");
    const args: { name?: string; e: any; spread?: boolean }[] = [];
    while (!this.isOp(")")) {
      let name: string | undefined;
      let spread = false;
      if (this.isOp("*")) {
        this.i++;
        spread = true;
      }
      if (this.t.k === "id" && this.isOp("=", this.peek()) && !this.isOp("==", this.peek())) {
        name = this.t.v;
        this.i += 2;
      }
      args.push({ name, e: this.parseExpr(), spread });
      if (!this.acceptOp(",")) break;
    }
    this.expectOp(")");
    return args;
  }

  /** speculative generic arguments after a name: <Int, String> followed by '(' */
  tryTypeArgs(): TypeRef[] | null {
    if (!this.isOp("<") || this.t.nl) return null;
    const save = this.i;
    try {
      this.i++;
      const args: TypeRef[] = [];
      do {
        if (this.acceptOp("*")) args.push({ name: "*", args: [], nullable: false });
        else args.push(this.parseType());
      } while (this.acceptOp(","));
      if (!this.isOp(">")) throw new Error("no");
      this.i++;
      if (this.isOp("(") || this.isOp("{") || this.isOp("::")) return args;
    } catch (e) {
      /* not a type argument list */
    }
    this.i = save;
    return null;
  }

  parsePostfix(): any {
    let e = this.parsePrimary();
    for (;;) {
      const t = this.t;
      if (t.k === "op") {
        if ((t.v === "." || t.v === "?.") && (!t.nl || true)) {
          // a member access may continue on the next line
          if (t.nl && !(this.peek().k === "id")) return e;
          this.i++;
          if (this.t.k !== "id") this.err("Expecting an identifier");
          const nameTok = this.toks[this.i++];
          if (nameTok.v === "class") {
            e = { t: "ClassRef", e, p: this.pos(nameTok) };
            continue;
          }
          e = { t: "Dot", o: e, n: nameTok.v, safe: t.v === "?.", p: this.pos(nameTok) };
          continue;
        }
        if (t.v === "(" && !t.nl) {
          const targs: TypeRef[] = [];
          const args = this.parseArgs();
          let lam: any;
          if (this.isOp("{") && !this.t.nl && this.lambdaFollows()) lam = this.parseLambda();
          e = { t: "Call", f: e, targs, args, lam, p: e.p };
          continue;
        }
        if (t.v === "<" && (e.t === "Name" || e.t === "Dot") && !t.nl) {
          const targs = this.tryTypeArgs();
          if (targs) {
            let args: any[] = [];
            let lam: any;
            if (this.isOp("(")) args = this.parseArgs();
            if (this.isOp("{") && !this.t.nl && this.lambdaFollows()) lam = this.parseLambda();
            e = { t: "Call", f: e, targs, args, lam, p: e.p };
            continue;
          }
        }
        if (t.v === "{" && !t.nl && (e.t === "Name" || e.t === "Dot" || e.t === "Call") && this.lambdaFollows()) {
          const lam = this.parseLambda();
          if (e.t === "Call" && !e.lam) e = { ...e, lam };
          else e = { t: "Call", f: e, targs: [], args: [], lam, p: e.p };
          continue;
        }
        if (t.v === "[" && !t.nl) {
          this.i++;
          const args: any[] = [];
          do args.push(this.parseExpr());
          while (this.acceptOp(","));
          this.expectOp("]");
          e = { t: "Index", o: e, args, p: this.pos(t) };
          continue;
        }
        if (t.v === "++" || t.v === "--") {
          if (t.nl) return e;
          this.i++;
          e = { t: "Post", op: t.v, e, p: this.pos(t) };
          continue;
        }
        if (t.v === "!!") {
          this.i++;
          e = { t: "NotNull", e, p: this.pos(t) };
          continue;
        }
        if (t.v === "::" && !t.nl) {
          this.i++;
          const nameTok = this.toks[this.i++];
          e = nameTok.v === "class" ? { t: "ClassRef", e, p: this.pos(t) } : { t: "FnRef", o: e, n: nameTok.v, p: this.pos(t) };
          continue;
        }
      }
      return e;
    }
  }

  /** a '{' after a call starts a trailing lambda (not a block) */
  lambdaFollows(): boolean {
    return this.isOp("{");
  }

  parseLambda(): any {
    const open = this.expectOp("{");
    const params: { n: string; ty?: TypeRef }[] = [];
    let hasParams = false;
    // lambda parameters:  a, b ->    or   a: Int, b: String ->    or  _ ->
    const save = this.i;
    try {
      if (this.t.k === "id" || this.isOp("(")) {
        const ps: { n: string; ty?: TypeRef }[] = [];
        if (this.isOp("(")) {
          this.i++;
          const names: string[] = [];
          do names.push(this.expectId().v);
          while (this.acceptOp(","));
          this.expectOp(")");
          ps.push({ n: "(" + names.join(",") + ")" });
        } else {
          do {
            const nameTok = this.expectId("a parameter name");
            let ty: TypeRef | undefined;
            if (this.acceptOp(":")) ty = this.parseType();
            ps.push({ n: nameTok.v, ty });
          } while (this.acceptOp(","));
        }
        if (this.isOp("->")) {
          this.i++;
          params.push.apply(params, ps);
          hasParams = true;
        } else this.i = save;
      } else if (this.isOp("->")) {
        this.i++;
        hasParams = true;
      }
    } catch (e) {
      this.i = save;
    }
    const body = this.parseStatements();
    this.expectOp("}");
    return { t: "Lam", params, hasParams, body, p: this.pos(open) };
  }

  parseStringLit(tok: Tok): any {
    const parts: any[] = [];
    for (let k = 0; k < tok.parts!.length; k++) {
      const part: any = tok.parts![k];
      if (part.text !== undefined) parts.push(part.text);
      else {
        const sub = new Parser(tokenize(part.expr, part.line, part.col));
        const expr = sub.parseExpr();
        if (sub.t.k !== "eof") sub.err("Unexpected tokens in string template");
        parts.push(expr);
      }
    }
    return { t: "Str", parts, p: this.pos(tok) };
  }

  parsePrimary(): any {
    const tok = this.t;
    const p = this.pos(tok);
    switch (tok.k) {
      case "int":
        this.i++;
        return { t: "Num", v: tok.num!, kind: tok.suffix === "L" ? "Long" : "Int", p };
      case "float":
        this.i++;
        return { t: "Num", v: tok.num!, kind: tok.suffix === "f" ? "Float" : "Double", p };
      case "str":
        this.i++;
        return this.parseStringLit(tok);
      case "char":
        this.i++;
        return { t: "Char", v: tok.v, p };
      case "eof":
        this.err("Expecting an expression");
        break;
      case "op":
        if (tok.v === "(") {
          this.i++;
          const e = this.parseExpr();
          this.expectOp(")");
          return { t: "Paren", e, p };
        }
        if (tok.v === "{") return this.parseLambda();
        if (tok.v === "[") this.err("Collection literals are not supported here (use listOf(...))");
        if (tok.v === "::") {
          this.i++;
          const nameTok = this.expectId();
          return { t: "FnRef", n: nameTok.v, p };
        }
        this.err("Expecting an expression");
        break;
      case "id":
        break;
    }
    switch (tok.v) {
      case "true":
      case "false":
        this.i++;
        return { t: "Bool", v: tok.v === "true", p };
      case "null":
        this.i++;
        return { t: "Null", p };
      case "this":
        this.i++;
        if (this.isOp("@") && !this.t.nl) {
          this.i++;
          this.expectId();
        }
        return { t: "This", p };
      case "super":
        this.i++;
        if (this.isOp("<")) this.tryTypeArgs();
        return { t: "Super", p };
      case "if":
        return this.parseIf();
      case "when":
        return this.parseWhen();
      case "try":
        return this.parseTry();
      case "object": {
        this.i++;
        const supers: any[] = [];
        if (this.acceptOp(":")) {
          do {
            const ty = this.parseType();
            if (this.isOp("(")) supers.push({ ty, args: this.parseArgs(), hasCall: true });
            else supers.push({ ty, hasCall: false });
          } while (this.acceptOp(","));
        }
        this.expectOp("{");
        const members = this.parseMembers();
        this.expectOp("}");
        return { t: "Obj", supers, members, p };
      }
      case "fun":
        this.err("Anonymous functions are not supported by the LabMate preview");
        break;
      default:
        break;
    }
    if (KEYWORDS.indexOf(tok.v) >= 0) this.err("Expecting an expression");
    this.i++;
    return { t: "Name", n: tok.v, p };
  }

  parseIf(): any {
    const tok = this.toks[this.i++];
    this.expectOp("(");
    const c = this.parseExpr();
    this.expectOp(")");
    const a = this.isOp(";") ? [] : this.parseBody();
    let b: any[] | undefined;
    // `else` may be on the next line
    const save = this.i;
    this.skipSemis();
    if (this.isId("else")) {
      this.i++;
      b = this.parseBody();
    } else this.i = save;
    return { t: "If", c, a, b, p: this.pos(tok) };
  }

  parseWhen(): any {
    const tok = this.toks[this.i++];
    let subject: any;
    if (this.isOp("(")) {
      this.i++;
      if (this.isId("val") && this.peek().k === "id") this.err("'when' subject variables are not supported");
      subject = this.parseExpr();
      this.expectOp(")");
    }
    this.expectOp("{");
    const branches: any[] = [];
    this.skipSemis();
    while (!this.isOp("}")) {
      if (this.t.k === "eof") this.err("Expecting '}'");
      let conds: any[] | null = [];
      if (this.isId("else")) {
        this.i++;
        conds = null;
      } else {
        do {
          const t = this.t;
          if (this.isId("is")) {
            this.i++;
            conds.push({ is: true, ty: this.parseType(), neg: false, p: this.pos(t) });
          } else if (this.isOp("!") && this.isId("is", this.peek())) {
            this.i += 2;
            conds.push({ is: true, ty: this.parseType(), neg: true, p: this.pos(t) });
          } else if (this.isId("in")) {
            this.i++;
            conds.push({ inn: true, e: this.parseRange(), neg: false, p: this.pos(t) });
          } else if (this.isOp("!") && this.isId("in", this.peek())) {
            this.i += 2;
            conds.push({ inn: true, e: this.parseRange(), neg: true, p: this.pos(t) });
          } else conds.push({ e: this.parseExpr(), p: this.pos(t) });
        } while (this.acceptOp(","));
      }
      if (!this.acceptOp("->")) this.err("Expecting '->'");
      const body = this.parseBody();
      branches.push({ conds, body });
      this.skipSemis();
    }
    this.expectOp("}");
    return { t: "When", s: subject, br: branches, p: this.pos(tok) };
  }

  parseTry(): any {
    const tok = this.toks[this.i++];
    const body = this.parseBlock();
    const catches: any[] = [];
    let fin: any[] | undefined;
    while (this.isId("catch")) {
      this.i++;
      this.expectOp("(");
      const n = this.expectId().v;
      this.expectOp(":");
      const ty = this.parseType();
      this.expectOp(")");
      catches.push({ n, ty, body: this.parseBlock() });
    }
    if (this.acceptId("finally")) fin = this.parseBlock();
    if (!catches.length && !fin) this.err("Expecting 'catch' or 'finally'");
    return { t: "Try", body, catches, fin, p: this.pos(tok) };
  }
}

export function parseKotlin(src: string): FileNode {
  const parser = new Parser(tokenize(src));
  return parser.parseFile();
}
