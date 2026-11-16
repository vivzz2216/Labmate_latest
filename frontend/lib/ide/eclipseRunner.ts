// Pure TypeScript educational Java lexer, parser, interpreter, formatter, and diagnostics engine
// for the Eclipse IDE replica. Zero external dependencies or @/ path aliases.

export interface EclipseProblem {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  resource: string;
  path: string;
  line: number;
  type: string;
}

export interface JavaExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  packageName: string;
  className: string;
  problems: EclipseProblem[];
}

export interface JavaSymbolInfo {
  kind: "package" | "class" | "method" | "field";
  name: string;
  signature: string;
  javadoc: string;
  line: number;
}

export interface TodoTaskItem {
  line: number;
  text: string;
}

type TokenType =
  | "keyword"
  | "ident"
  | "number"
  | "string"
  | "char"
  | "op"
  | "punct"
  | "eof";

interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

const JAVA_KEYWORDS: Record<string, true> = {
  abstract: true,
  boolean: true,
  break: true,
  byte: true,
  case: true,
  catch: true,
  char: true,
  class: true,
  continue: true,
  default: true,
  do: true,
  double: true,
  else: true,
  extends: true,
  false: true,
  final: true,
  finally: true,
  float: true,
  for: true,
  if: true,
  implements: true,
  import: true,
  instanceof: true,
  int: true,
  interface: true,
  long: true,
  new: true,
  null: true,
  package: true,
  private: true,
  protected: true,
  public: true,
  return: true,
  short: true,
  static: true,
  super: true,
  switch: true,
  this: true,
  throw: true,
  throws: true,
  true: true,
  try: true,
  var: true,
  void: true,
  while: true,
};

const TYPE_KEYWORDS: Record<string, true> = {
  boolean: true,
  byte: true,
  char: true,
  double: true,
  float: true,
  int: true,
  long: true,
  short: true,
  var: true,
  void: true,
};

const MODIFIER_KEYWORDS: Record<string, true> = {
  abstract: true,
  final: true,
  private: true,
  protected: true,
  public: true,
  static: true,
};

const MULTI_OPS = [
  ">>>=",
  ">>>",
  "<<=",
  ">>=",
  "...",
  "++",
  "--",
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "<<",
  ">>",
  "->",
];

function isAlphaStart(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 36;
}

function isDigit(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return c >= 48 && c <= 57;
}

function isAlphaNum(ch: string): boolean {
  return isAlphaStart(ch) || isDigit(ch);
}

function unescapeCharContent(raw: string): string {
  if (raw === "\\n") return "\n";
  if (raw === "\\t") return "\t";
  if (raw === "\\r") return "\r";
  if (raw === "\\\\") return "\\";
  if (raw === "\\'") return "'";
  if (raw === '\\"') return '"';
  if (raw === "\\0") return "\0";
  return raw;
}

function tokenizeJava(source: string): {
  tokens: Token[];
  lexErrors: Array<{ line: number; message: string }>;
} {
  const tokens: Token[] = [];
  const lexErrors: Array<{ line: number; message: string }> = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const len = source.length;

  while (i < len) {
    const ch = source.charAt(i);

    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      line += 1;
      col = 1;
      i += 1;
      continue;
    }
    if (ch === " " || ch === "\t") {
      i += 1;
      col += 1;
      continue;
    }

    // Line comment
    if (ch === "/" && source.charAt(i + 1) === "/") {
      while (i < len && source.charAt(i) !== "\n") {
        i += 1;
      }
      continue;
    }

    // Block comment
    if (ch === "/" && source.charAt(i + 1) === "*") {
      const startLine = line;
      i += 2;
      col += 2;
      let closed = false;
      while (i < len) {
        if (source.charAt(i) === "*" && source.charAt(i + 1) === "/") {
          i += 2;
          col += 2;
          closed = true;
          break;
        }
        if (source.charAt(i) === "\n") {
          line += 1;
          col = 1;
        } else {
          col += 1;
        }
        i += 1;
      }
      if (!closed) {
        lexErrors.push({ line: startLine, message: "Unclosed block comment /*" });
      }
      continue;
    }

    // String literal
    if (ch === '"') {
      const startLine = line;
      const startCol = col;
      i += 1;
      col += 1;
      let out = "";
      let closed = false;
      while (i < len) {
        const cur = source.charAt(i);
        if (cur === "\n" || cur === "\r") {
          break;
        }
        if (cur === "\\") {
          const next = source.charAt(i + 1);
          if (next === "n") out += "\n";
          else if (next === "t") out += "\t";
          else if (next === "r") out += "\r";
          else if (next === "\\") out += "\\";
          else if (next === '"') out += '"';
          else if (next === "'") out += "'";
          else out += next;
          i += 2;
          col += 2;
          continue;
        }
        if (cur === '"') {
          closed = true;
          i += 1;
          col += 1;
          break;
        }
        out += cur;
        i += 1;
        col += 1;
      }
      if (!closed) {
        lexErrors.push({ line: startLine, message: "String literal is not properly closed by a double-quote" });
      }
      tokens.push({ type: "string", value: out, line: startLine, col: startCol });
      continue;
    }

    // Char literal
    if (ch === "'") {
      const startLine = line;
      const startCol = col;
      i += 1;
      col += 1;
      let raw = "";
      let closed = false;
      while (i < len) {
        const cur = source.charAt(i);
        if (cur === "\n" || cur === "\r") break;
        if (cur === "\\") {
          raw += cur + source.charAt(i + 1);
          i += 2;
          col += 2;
          continue;
        }
        if (cur === "'") {
          closed = true;
          i += 1;
          col += 1;
          break;
        }
        raw += cur;
        i += 1;
        col += 1;
      }
      if (!closed) {
        lexErrors.push({ line: startLine, message: "Invalid character constant" });
      }
      tokens.push({ type: "char", value: unescapeCharContent(raw), line: startLine, col: startCol });
      continue;
    }

    // Annotations (@Override, etc.)
    if (ch === "@") {
      const startCol = col;
      i += 1;
      col += 1;
      while (i < len && (isAlphaNum(source.charAt(i)) || source.charAt(i) === ".")) {
        i += 1;
        col += 1;
      }
      // Ignore annotation arguments if present
      if (source.charAt(i) === "(") {
        let depth = 0;
        while (i < len) {
          const c = source.charAt(i);
          if (c === "(") depth += 1;
          else if (c === ")") {
            depth -= 1;
            if (depth === 0) {
              i += 1;
              col += 1;
              break;
            }
          } else if (c === "\n") {
            line += 1;
            col = 1;
            i += 1;
            continue;
          }
          i += 1;
          col += 1;
        }
      }
      void startCol;
      continue;
    }

    // Number literal
    if (isDigit(ch) || (ch === "." && isDigit(source.charAt(i + 1)))) {
      const startCol = col;
      let numStr = "";
      let hasDot = false;
      while (i < len) {
        const c = source.charAt(i);
        if (isDigit(c) || c === "_") {
          if (c !== "_") numStr += c;
          i += 1;
          col += 1;
        } else if (c === "." && !hasDot && isDigit(source.charAt(i + 1))) {
          hasDot = true;
          numStr += c;
          i += 1;
          col += 1;
        } else if ((c === "e" || c === "E") && (isDigit(source.charAt(i + 1)) || source.charAt(i + 1) === "+" || source.charAt(i + 1) === "-")) {
          numStr += c;
          i += 1;
          col += 1;
          if (source.charAt(i) === "+" || source.charAt(i) === "-") {
            numStr += source.charAt(i);
            i += 1;
            col += 1;
          }
        } else {
          break;
        }
      }
      // Optional numeric suffix L, l, F, f, D, d
      const suf = source.charAt(i);
      if (suf === "L" || suf === "l" || suf === "F" || suf === "f" || suf === "D" || suf === "d") {
        if (suf === "F" || suf === "f" || suf === "D" || suf === "d") {
          if (numStr.indexOf(".") === -1) numStr += ".0";
        }
        i += 1;
        col += 1;
      }
      tokens.push({ type: "number", value: numStr, line, col: startCol });
      continue;
    }

    // Identifier or Keyword
    if (isAlphaStart(ch)) {
      const startCol = col;
      let word = "";
      while (i < len && isAlphaNum(source.charAt(i))) {
        word += source.charAt(i);
        i += 1;
        col += 1;
      }
      const isKw = Object.prototype.hasOwnProperty.call(JAVA_KEYWORDS, word);
      tokens.push({ type: isKw ? "keyword" : "ident", value: word, line, col: startCol });
      continue;
    }

    // Multi-character operators
    let matchedOp = "";
    for (let m = 0; m < MULTI_OPS.length; m += 1) {
      const op = MULTI_OPS[m];
      if (source.slice(i, i + op.length) === op) {
        matchedOp = op;
        break;
      }
    }
    if (matchedOp) {
      tokens.push({ type: "op", value: matchedOp, line, col });
      i += matchedOp.length;
      col += matchedOp.length;
      continue;
    }

    // Punctuation
    if ("(){}[];,.:?".indexOf(ch) !== -1) {
      tokens.push({ type: ch === "?" || ch === ":" ? "op" : "punct", value: ch, line, col });
      i += 1;
      col += 1;
      continue;
    }

    // Single-character operator
    if ("+-*/%=<>!&|^~".indexOf(ch) !== -1) {
      tokens.push({ type: "op", value: ch, line, col });
      i += 1;
      col += 1;
      continue;
    }

    lexErrors.push({ line, message: `Unexpected character '${ch}'` });
    i += 1;
    col += 1;
  }

  tokens.push({ type: "eof", value: "", line, col });
  return { tokens, lexErrors };
}

// ============================================================================
// AST Definitions
// ============================================================================

type ExprNode =
  | { kind: "literal"; value: RuntimeValue; rawType: "int" | "double" | "string" | "boolean" | "char" | "null"; line: number }
  | { kind: "ident"; name: string; line: number }
  | { kind: "this"; line: number }
  | { kind: "member"; object: ExprNode; property: string; line: number }
  | { kind: "index"; object: ExprNode; index: ExprNode; line: number }
  | { kind: "call"; callee: ExprNode; args: ExprNode[]; line: number }
  | { kind: "newArray"; elemType: string; dims: ExprNode[]; initializer?: ExprNode[]; line: number }
  | { kind: "arrayLit"; elements: ExprNode[]; line: number }
  | { kind: "newObject"; className: string; args: ExprNode[]; line: number }
  | { kind: "cast"; targetType: string; expr: ExprNode; line: number }
  | { kind: "unary"; op: string; expr: ExprNode; prefix: boolean; line: number }
  | { kind: "binary"; op: string; left: ExprNode; right: ExprNode; line: number }
  | { kind: "assign"; op: string; target: ExprNode; value: ExprNode; line: number }
  | { kind: "ternary"; cond: ExprNode; thenExpr: ExprNode; elseExpr: ExprNode; line: number };

type StmtNode =
  | { kind: "block"; statements: StmtNode[]; line: number }
  | { kind: "empty"; line: number }
  | { kind: "expr"; expr: ExprNode; line: number }
  | { kind: "varDecl"; varType: string; declarators: Array<{ name: string; init: ExprNode | null }>; line: number }
  | { kind: "if"; cond: ExprNode; thenBranch: StmtNode; elseBranch: StmtNode | null; line: number }
  | { kind: "while"; cond: ExprNode; body: StmtNode; line: number }
  | { kind: "doWhile"; body: StmtNode; cond: ExprNode; line: number }
  | { kind: "for"; init: StmtNode | null; cond: ExprNode | null; update: ExprNode[]; body: StmtNode; line: number }
  | { kind: "forEach"; varType: string; varName: string; iterable: ExprNode; body: StmtNode; line: number }
  | { kind: "switch"; expr: ExprNode; cases: Array<{ label: ExprNode | null; stmts: StmtNode[] }>; line: number }
  | { kind: "return"; expr: ExprNode | null; line: number }
  | { kind: "break"; line: number }
  | { kind: "continue"; line: number }
  | { kind: "throw"; expr: ExprNode; line: number }
  | { kind: "try"; tryBlock: StmtNode; catches: Array<{ varName: string; block: StmtNode }>; finallyBlock: StmtNode | null; line: number };

interface MethodDecl {
  name: string;
  returnType: string;
  isStatic: boolean;
  isConstructor: boolean;
  params: Array<{ type: string; name: string; isVarArgs: boolean }>;
  body: StmtNode;
  line: number;
  javadoc: string;
}

interface FieldDecl {
  name: string;
  fieldType: string;
  isStatic: boolean;
  init: ExprNode | null;
  line: number;
}

interface ClassDecl {
  name: string;
  fields: FieldDecl[];
  methods: MethodDecl[];
  line: number;
  javadoc: string;
}

interface ParsedProgram {
  packageName: string;
  imports: string[];
  classes: ClassDecl[];
}

// ============================================================================
// Recursive-Descent Java Parser
// ============================================================================

class ParseError extends Error {
  line: number;
  constructor(message: string, line: number) {
    super(message);
    this.line = line;
  }
}

class JavaParser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  private peek(offset = 0): Token {
    const idx = this.pos + offset;
    if (idx >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1];
    }
    return this.tokens[idx];
  }

  private advance(): Token {
    const tok = this.peek(0);
    if (tok.type !== "eof") {
      this.pos += 1;
    }
    return tok;
  }

  private check(value: string): boolean {
    const t = this.peek(0);
    return t.type !== "eof" && t.type !== "string" && t.type !== "char" && t.value === value;
  }

  private match(value: string): boolean {
    if (this.check(value)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(value: string, message?: string): Token {
    const tok = this.peek(0);
    if (tok.type === "string" || tok.type === "char" || tok.value !== value) {
      throw new ParseError(message || `Syntax error on token "${tok.value || "EOF"}", expected "${value}"`, tok.line);
    }
    return this.advance();
  }

  private skipTypeArgs(): void {
    if (!this.check("<")) return;
    let depth = 0;
    const saved = this.pos;
    while (this.peek(0).type !== "eof") {
      const val = this.peek(0).value;
      if (val === "<") depth += 1;
      else if (val === ">") {
        depth -= 1;
        this.advance();
        if (depth === 0) return;
        continue;
      } else if (val === ">>") {
        depth -= 2;
        this.advance();
        if (depth <= 0) return;
        continue;
      } else if (val === ";" || val === "{" || val === "(") {
        this.pos = saved;
        return;
      }
      this.advance();
    }
    this.pos = saved;
  }

  private parseTypeName(): string {
    const tok = this.peek(0);
    if (tok.type !== "ident" && !Object.prototype.hasOwnProperty.call(TYPE_KEYWORDS, tok.value)) {
      throw new ParseError(`Expected type name near "${tok.value}"`, tok.line);
    }
    let name = this.advance().value;
    while (this.check(".") && this.peek(1).type === "ident") {
      this.advance();
      name += "." + this.advance().value;
    }
    if (this.check("<")) {
      this.skipTypeArgs();
    }
    while (this.check("[") && this.peek(1).value === "]") {
      this.advance();
      this.advance();
      name += "[]";
    }
    return name;
  }

  private looksLikeTypeStart(): boolean {
    const tok = this.peek(0);
    if (Object.prototype.hasOwnProperty.call(TYPE_KEYWORDS, tok.value)) return true;
    if (tok.type !== "ident") return false;
    // Check ahead for: Type ident, Type<...> ident, Type[] ident
    let idx = 1;
    while (this.peek(idx).value === "." && this.peek(idx + 1).type === "ident") {
      idx += 2;
    }
    if (this.peek(idx).value === "<") {
      let depth = 1;
      idx += 1;
      while (this.peek(idx).type !== "eof" && depth > 0) {
        const v = this.peek(idx).value;
        if (v === "<") depth += 1;
        else if (v === ">") depth -= 1;
        else if (v === ">>") depth -= 2;
        else if (v === ";" || v === "{") return false;
        idx += 1;
      }
    }
    while (this.peek(idx).value === "[" && this.peek(idx + 1).value === "]") {
      idx += 2;
    }
    return this.peek(idx).type === "ident";
  }

  public parseProgram(): ParsedProgram {
    let packageName = "";
    const imports: string[] = [];
    const classes: ClassDecl[] = [];

    if (this.match("package")) {
      const parts: string[] = [];
      parts.push(this.advance().value);
      while (this.match(".")) {
        parts.push(this.advance().value);
      }
      packageName = parts.join(".");
      this.expect(";", "Syntax error, insert ';' to complete PackageDeclaration");
    }

    while (this.match("import")) {
      if (this.match("static")) {
        // skip static import marker
      }
      const parts: string[] = [];
      while (this.peek(0).type !== "eof" && !this.check(";")) {
        parts.push(this.advance().value);
      }
      imports.push(parts.join(""));
      this.expect(";", "Syntax error, insert ';' to complete ImportDeclaration");
    }

    while (this.peek(0).type !== "eof") {
      if (this.match(";")) continue;
      classes.push(this.parseClassDecl());
    }

    return { packageName, imports, classes };
  }

  private parseClassDecl(): ClassDecl {
    while (Object.prototype.hasOwnProperty.call(MODIFIER_KEYWORDS, this.peek(0).value)) {
      this.advance();
    }
    const kindTok = this.peek(0);
    if (kindTok.value !== "class" && kindTok.value !== "interface") {
      throw new ParseError(`Syntax error on token "${kindTok.value}", expected "class"`, kindTok.line);
    }
    this.advance();
    const nameTok = this.peek(0);
    if (nameTok.type !== "ident") {
      throw new ParseError("Expected class name", nameTok.line);
    }
    const className = this.advance().value;
    if (this.check("<")) this.skipTypeArgs();
    if (this.match("extends")) {
      this.parseTypeName();
    }
    if (this.match("implements")) {
      this.parseTypeName();
      while (this.match(",")) this.parseTypeName();
    }
    this.expect("{", "Syntax error, insert '{' to complete ClassBody");

    const fields: FieldDecl[] = [];
    const methods: MethodDecl[] = [];

    while (!this.check("}") && this.peek(0).type !== "eof") {
      if (this.match(";")) continue;
      // Static initializer block: static { ... }
      if (this.check("static") && this.peek(1).value === "{") {
        this.advance();
        this.parseBlock();
        continue;
      }

      let isStatic = false;
      while (Object.prototype.hasOwnProperty.call(MODIFIER_KEYWORDS, this.peek(0).value)) {
        if (this.peek(0).value === "static") isStatic = true;
        this.advance();
      }
      if (this.check("<")) this.skipTypeArgs();

      // Constructor?
      if (this.peek(0).value === className && this.peek(1).value === "(") {
        const line = this.peek(0).line;
        this.advance();
        const params = this.parseParamList();
        if (this.match("throws")) {
          this.parseTypeName();
          while (this.match(",")) this.parseTypeName();
        }
        const body = this.parseBlock();
        methods.push({
          name: className,
          returnType: className,
          isStatic: false,
          isConstructor: true,
          params,
          body,
          line,
          javadoc: "",
        });
        continue;
      }

      const memberLine = this.peek(0).line;
      const memberType = this.parseTypeName();
      const memberNameTok = this.peek(0);
      if (memberNameTok.type !== "ident") {
        throw new ParseError(`Expected identifier after type "${memberType}"`, memberNameTok.line);
      }
      const memberName = this.advance().value;

      if (this.check("(")) {
        const params = this.parseParamList();
        // Support C-style array brackets after params
        while (this.check("[") && this.peek(1).value === "]") {
          this.advance();
          this.advance();
        }
        if (this.match("throws")) {
          this.parseTypeName();
          while (this.match(",")) this.parseTypeName();
        }
        let body: StmtNode;
        if (this.match(";")) {
          body = { kind: "block", statements: [], line: memberLine };
        } else {
          body = this.parseBlock();
        }
        methods.push({
          name: memberName,
          returnType: memberType,
          isStatic,
          isConstructor: false,
          params,
          body,
          line: memberLine,
          javadoc: "",
        });
      } else {
        // Field declaration(s)
        while (this.check("[") && this.peek(1).value === "]") {
          this.advance();
          this.advance();
        }
        const firstInit = this.match("=") ? this.parseVarInit(memberType) : null;
        fields.push({
          name: memberName,
          fieldType: memberType,
          isStatic,
          init: firstInit,
          line: memberLine,
        });
        while (this.match(",")) {
          const nextName = this.advance().value;
          const nextInit = this.match("=") ? this.parseVarInit(memberType) : null;
          fields.push({
            name: nextName,
            fieldType: memberType,
            isStatic,
            init: nextInit,
            line: memberLine,
          });
        }
        this.expect(";", "Syntax error, insert ';' to complete FieldDeclaration");
      }
    }

    this.expect("}", "Syntax error, insert '}' to complete ClassBody");
    return {
      name: className,
      fields,
      methods,
      line: nameTok.line,
      javadoc: "",
    };
  }

  private parseParamList(): Array<{ type: string; name: string; isVarArgs: boolean }> {
    this.expect("(");
    const params: Array<{ type: string; name: string; isVarArgs: boolean }> = [];
    while (!this.check(")") && this.peek(0).type !== "eof") {
      if (this.check("final")) this.advance();
      let pType = this.parseTypeName();
      let isVarArgs = false;
      if (this.match("...")) {
        isVarArgs = true;
        pType += "[]";
      }
      const pName = this.advance().value;
      while (this.check("[") && this.peek(1).value === "]") {
        this.advance();
        this.advance();
        pType += "[]";
      }
      params.push({ type: pType, name: pName, isVarArgs });
      if (!this.match(",")) break;
    }
    this.expect(")", "Expected ')' after parameter list");
    return params;
  }

  private parseBlock(): StmtNode {
    const open = this.expect("{", "Syntax error, insert '{' to complete Block");
    const statements: StmtNode[] = [];
    while (!this.check("}") && this.peek(0).type !== "eof") {
      statements.push(this.parseStatement());
    }
    this.expect("}", "Syntax error, insert '}' to complete Block");
    return { kind: "block", statements, line: open.line };
  }

  private parseVarInit(varType: string): ExprNode {
    if (this.check("{")) {
      return this.parseArrayLiteral();
    }
    void varType;
    return this.parseExpr();
  }

  private parseArrayLiteral(): ExprNode {
    const open = this.expect("{");
    const elements: ExprNode[] = [];
    while (!this.check("}") && this.peek(0).type !== "eof") {
      if (this.check("{")) {
        elements.push(this.parseArrayLiteral());
      } else {
        elements.push(this.parseExpr());
      }
      if (!this.match(",")) break;
    }
    this.expect("}");
    return { kind: "arrayLit", elements, line: open.line };
  }

  private parseStatement(): StmtNode {
    const tok = this.peek(0);

    if (this.check("{")) return this.parseBlock();
    if (this.match(";")) return { kind: "empty", line: tok.line };

    if (this.match("if")) {
      this.expect("(");
      const cond = this.parseExpr();
      this.expect(")");
      const thenBranch = this.parseStatement();
      const elseBranch = this.match("else") ? this.parseStatement() : null;
      return { kind: "if", cond, thenBranch, elseBranch, line: tok.line };
    }

    if (this.match("while")) {
      this.expect("(");
      const cond = this.parseExpr();
      this.expect(")");
      const body = this.parseStatement();
      return { kind: "while", cond, body, line: tok.line };
    }

    if (this.match("do")) {
      const body = this.parseStatement();
      this.expect("while");
      this.expect("(");
      const cond = this.parseExpr();
      this.expect(")");
      this.expect(";", "Syntax error, insert ';' to complete DoStatement");
      return { kind: "doWhile", body, cond, line: tok.line };
    }

    if (this.match("for")) {
      this.expect("(");
      // Check enhanced for-each: for (Type name : iterable)
      if (this.isForEachHeader()) {
        if (this.check("final")) this.advance();
        const varType = this.parseTypeName();
        const varName = this.advance().value;
        this.expect(":");
        const iterable = this.parseExpr();
        this.expect(")");
        const body = this.parseStatement();
        return { kind: "forEach", varType, varName, iterable, body, line: tok.line };
      }

      let init: StmtNode | null = null;
      if (!this.match(";")) {
        if (this.check("final") || this.looksLikeTypeStart()) {
          if (this.check("final")) this.advance();
          init = this.parseVarDeclNoSemi();
          this.expect(";");
        } else {
          const exprs: StmtNode[] = [];
          exprs.push({ kind: "expr", expr: this.parseExpr(), line: this.peek(0).line });
          while (this.match(",")) {
            exprs.push({ kind: "expr", expr: this.parseExpr(), line: this.peek(0).line });
          }
          this.expect(";");
          init = exprs.length === 1 ? exprs[0] : { kind: "block", statements: exprs, line: tok.line };
        }
      }
      const cond = this.check(";") ? null : this.parseExpr();
      this.expect(";");
      const update: ExprNode[] = [];
      if (!this.check(")")) {
        update.push(this.parseExpr());
        while (this.match(",")) {
          update.push(this.parseExpr());
        }
      }
      this.expect(")");
      const body = this.parseStatement();
      return { kind: "for", init, cond, update, body, line: tok.line };
    }

    if (this.match("switch")) {
      this.expect("(");
      const expr = this.parseExpr();
      this.expect(")");
      this.expect("{");
      const cases: Array<{ label: ExprNode | null; stmts: StmtNode[] }> = [];
      while (!this.check("}") && this.peek(0).type !== "eof") {
        let label: ExprNode | null = null;
        if (this.match("case")) {
          label = this.parseExpr();
          this.expect(":");
        } else if (this.match("default")) {
          this.expect(":");
        } else {
          throw new ParseError("Expected 'case' or 'default' inside switch", this.peek(0).line);
        }
        const stmts: StmtNode[] = [];
        while (!this.check("case") && !this.check("default") && !this.check("}") && this.peek(0).type !== "eof") {
          stmts.push(this.parseStatement());
        }
        cases.push({ label, stmts });
      }
      this.expect("}");
      return { kind: "switch", expr, cases, line: tok.line };
    }

    if (this.match("return")) {
      const expr = this.check(";") ? null : this.parseExpr();
      this.expect(";", "Syntax error, insert ';' to complete ReturnStatement");
      return { kind: "return", expr, line: tok.line };
    }

    if (this.match("break")) {
      this.expect(";", "Syntax error, insert ';' to complete Statement");
      return { kind: "break", line: tok.line };
    }

    if (this.match("continue")) {
      this.expect(";", "Syntax error, insert ';' to complete Statement");
      return { kind: "continue", line: tok.line };
    }

    if (this.match("throw")) {
      const expr = this.parseExpr();
      this.expect(";", "Syntax error, insert ';' to complete ThrowStatement");
      return { kind: "throw", expr, line: tok.line };
    }

    if (this.match("try")) {
      const tryBlock = this.parseBlock();
      const catches: Array<{ varName: string; block: StmtNode }> = [];
      while (this.match("catch")) {
        this.expect("(");
        this.parseTypeName();
        while (this.match("|")) this.parseTypeName();
        const varName = this.advance().value;
        this.expect(")");
        const block = this.parseBlock();
        catches.push({ varName, block });
      }
      const finallyBlock = this.match("finally") ? this.parseBlock() : null;
      return { kind: "try", tryBlock, catches, finallyBlock, line: tok.line };
    }

    if (this.check("final") || this.looksLikeTypeStart()) {
      if (this.check("final")) this.advance();
      const decl = this.parseVarDeclNoSemi();
      this.expect(";", "Syntax error, insert ';' to complete LocalVariableDeclarationStatement");
      return decl;
    }

    const expr = this.parseExpr();
    this.expect(";", "Syntax error, insert ';' to complete Statement");
    return { kind: "expr", expr, line: tok.line };
  }

  private isForEachHeader(): boolean {
    const saved = this.pos;
    if (this.check("final")) this.advance();
    if (!this.looksLikeTypeStart()) {
      this.pos = saved;
      return false;
    }
    try {
      this.parseTypeName();
      if (this.peek(0).type === "ident" && this.peek(1).value === ":") {
        this.pos = saved;
        return true;
      }
    } catch {
      // ignore
    }
    this.pos = saved;
    return false;
  }

  private parseVarDeclNoSemi(): StmtNode {
    const line = this.peek(0).line;
    const varType = this.parseTypeName();
    const declarators: Array<{ name: string; init: ExprNode | null }> = [];
    while (true) {
      const nameTok = this.peek(0);
      if (nameTok.type !== "ident") {
        throw new ParseError(`Expected variable name near "${nameTok.value}"`, nameTok.line);
      }
      const name = this.advance().value;
      while (this.check("[") && this.peek(1).value === "]") {
        this.advance();
        this.advance();
      }
      const init = this.match("=") ? this.parseVarInit(varType) : null;
      declarators.push({ name, init });
      if (!this.match(",")) break;
    }
    return { kind: "varDecl", varType, declarators, line };
  }

  private parseExpr(): ExprNode {
    return this.parseAssign();
  }

  private parseAssign(): ExprNode {
    const left = this.parseTernary();
    const tok = this.peek(0);
    if (
      tok.type === "op" &&
      (tok.value === "=" ||
        tok.value === "+=" ||
        tok.value === "-=" ||
        tok.value === "*=" ||
        tok.value === "/=" ||
        tok.value === "%=")
    ) {
      this.advance();
      const value = this.parseAssign();
      return { kind: "assign", op: tok.value, target: left, value, line: tok.line };
    }
    return left;
  }

  private parseTernary(): ExprNode {
    const cond = this.parseOr();
    if (this.match("?")) {
      const thenExpr = this.parseExpr();
      this.expect(":");
      const elseExpr = this.parseTernary();
      return { kind: "ternary", cond, thenExpr, elseExpr, line: cond.line };
    }
    return cond;
  }

  private parseOr(): ExprNode {
    let left = this.parseAnd();
    while (this.match("||")) {
      const right = this.parseAnd();
      left = { kind: "binary", op: "||", left, right, line: left.line };
    }
    return left;
  }

  private parseAnd(): ExprNode {
    let left = this.parseEquality();
    while (this.match("&&")) {
      const right = this.parseEquality();
      left = { kind: "binary", op: "&&", left, right, line: left.line };
    }
    return left;
  }

  private parseEquality(): ExprNode {
    let left = this.parseRelational();
    while (this.check("==") || this.check("!=")) {
      const op = this.advance().value;
      const right = this.parseRelational();
      left = { kind: "binary", op, left, right, line: left.line };
    }
    return left;
  }

  private parseRelational(): ExprNode {
    let left = this.parseAdditive();
    while (this.check("<") || this.check("<=") || this.check(">") || this.check(">=") || this.check("instanceof")) {
      const op = this.advance().value;
      const right = this.parseAdditive();
      left = { kind: "binary", op, left, right, line: left.line };
    }
    return left;
  }

  private parseAdditive(): ExprNode {
    let left = this.parseMultiplicative();
    while (this.check("+") || this.check("-")) {
      const op = this.advance().value;
      const right = this.parseMultiplicative();
      left = { kind: "binary", op, left, right, line: left.line };
    }
    return left;
  }

  private parseMultiplicative(): ExprNode {
    let left = this.parseUnary();
    while (this.check("*") || this.check("/") || this.check("%")) {
      const op = this.advance().value;
      const right = this.parseUnary();
      left = { kind: "binary", op, left, right, line: left.line };
    }
    return left;
  }

  private parseUnary(): ExprNode {
    const tok = this.peek(0);
    if (
      tok.type === "op" &&
      (tok.value === "++" || tok.value === "--" || tok.value === "!" || tok.value === "-" || tok.value === "+")
    ) {
      this.advance();
      const expr = this.parseUnary();
      return { kind: "unary", op: tok.value, expr, prefix: true, line: tok.line };
    }
    // Check type cast: (int) x, (double) x, (char) x, (String) x
    if (tok.type === "punct" && tok.value === "(" && this.looksLikeCast()) {
      this.advance();
      const targetType = this.parseTypeName();
      this.expect(")");
      const expr = this.parseUnary();
      return { kind: "cast", targetType, expr, line: tok.line };
    }
    return this.parsePostfix();
  }

  private looksLikeCast(): boolean {
    const saved = this.pos;
    if (!this.match("(")) return false;
    const t = this.peek(0);
    if (!Object.prototype.hasOwnProperty.call(TYPE_KEYWORDS, t.value) && t.type !== "ident") {
      this.pos = saved;
      return false;
    }
    try {
      this.parseTypeName();
      if (!this.match(")")) {
        this.pos = saved;
        return false;
      }
      const next = this.peek(0);
      const ok =
        next.type === "ident" ||
        next.type === "number" ||
        next.type === "string" ||
        next.type === "char" ||
        next.value === "(" ||
        next.value === "new" ||
        next.value === "!" ||
        next.value === "-";
      this.pos = saved;
      return ok;
    } catch {
      this.pos = saved;
      return false;
    }
  }

  private parsePostfix(): ExprNode {
    let expr = this.parsePrimary();
    while (true) {
      if (this.match(".")) {
        const propTok = this.advance();
        expr = { kind: "member", object: expr, property: propTok.value, line: propTok.line };
      } else if (this.match("(")) {
        const args: ExprNode[] = [];
        while (!this.check(")") && this.peek(0).type !== "eof") {
          args.push(this.parseExpr());
          if (!this.match(",")) break;
        }
        this.expect(")", "Expected ')' after arguments");
        expr = { kind: "call", callee: expr, args, line: expr.line };
      } else if (this.match("[")) {
        const index = this.parseExpr();
        this.expect("]", "Expected ']'");
        expr = { kind: "index", object: expr, index, line: expr.line };
      } else if (this.check("++") || this.check("--")) {
        const op = this.advance().value;
        expr = { kind: "unary", op, expr, prefix: false, line: expr.line };
      } else {
        break;
      }
    }
    return expr;
  }

  private parsePrimary(): ExprNode {
    const tok = this.peek(0);

    if (tok.type === "number") {
      this.advance();
      const isFloat = tok.value.indexOf(".") !== -1 || tok.value.indexOf("e") !== -1 || tok.value.indexOf("E") !== -1;
      const numVal = isFloat ? parseFloat(tok.value) : parseInt(tok.value, 10);
      return {
        kind: "literal",
        value: { tag: isFloat ? "double" : "int", val: numVal },
        rawType: isFloat ? "double" : "int",
        line: tok.line,
      };
    }

    if (tok.type === "string") {
      this.advance();
      return {
        kind: "literal",
        value: { tag: "string", val: tok.value },
        rawType: "string",
        line: tok.line,
      };
    }

    if (tok.type === "char") {
      this.advance();
      return {
        kind: "literal",
        value: { tag: "char", val: tok.value },
        rawType: "char",
        line: tok.line,
      };
    }

    if (tok.value === "true" || tok.value === "false") {
      this.advance();
      return {
        kind: "literal",
        value: { tag: "boolean", val: tok.value === "true" },
        rawType: "boolean",
        line: tok.line,
      };
    }

    if (tok.value === "null") {
      this.advance();
      return {
        kind: "literal",
        value: { tag: "null" },
        rawType: "null",
        line: tok.line,
      };
    }

    if (tok.value === "this") {
      this.advance();
      return { kind: "this", line: tok.line };
    }

    if (this.match("(")) {
      const inner = this.parseExpr();
      this.expect(")", "Expected ')'");
      return inner;
    }

    if (this.match("new")) {
      let typeName = this.advance().value;
      while (this.check(".") && this.peek(1).type === "ident") {
        this.advance();
        typeName += "." + this.advance().value;
      }
      if (this.check("<")) this.skipTypeArgs();
      if (this.check("[")) {
        const dims: ExprNode[] = [];
        while (this.match("[")) {
          if (!this.check("]")) {
            dims.push(this.parseExpr());
          }
          this.expect("]");
        }
        let initializer: ExprNode[] | undefined;
        if (this.check("{")) {
          const lit = this.parseArrayLiteral();
          if (lit.kind === "arrayLit") initializer = lit.elements;
        }
        return { kind: "newArray", elemType: typeName, dims, initializer, line: tok.line };
      }
      this.expect("(");
      const args: ExprNode[] = [];
      while (!this.check(")") && this.peek(0).type !== "eof") {
        args.push(this.parseExpr());
        if (!this.match(",")) break;
      }
      this.expect(")");
      return { kind: "newObject", className: typeName, args, line: tok.line };
    }

    if (tok.type === "ident") {
      this.advance();
      return { kind: "ident", name: tok.value, line: tok.line };
    }

    throw new ParseError(`Syntax error on token "${tok.value || "EOF"}"`, tok.line);
  }
}

// ============================================================================
// Runtime Values & Evaluator
// ============================================================================

type RuntimeValue =
  | { tag: "int"; val: number }
  | { tag: "double"; val: number }
  | { tag: "boolean"; val: boolean }
  | { tag: "char"; val: string }
  | { tag: "string"; val: string }
  | { tag: "null" }
  | { tag: "array"; elemType: string; items: RuntimeValue[] }
  | { tag: "list"; items: RuntimeValue[] }
  | { tag: "scanner"; raw: string; pos: number }
  | { tag: "object"; className: string; fields: Record<string, RuntimeValue> }
  | { tag: "classRef"; name: string }
  | { tag: "sysOut" }
  | { tag: "sysErr" }
  | { tag: "void" };

interface ScopeFrame {
  vars: Record<string, { type: string; value: RuntimeValue }>;
  parent: ScopeFrame | null;
}

class ReturnSignal {
  value: RuntimeValue;
  constructor(value: RuntimeValue) {
    this.value = value;
  }
}

class BreakSignal {}
class ContinueSignal {}

class JavaRuntimeError extends Error {
  javaType: string;
  line: number;
  constructor(javaType: string, message: string, line: number) {
    super(message);
    this.javaType = javaType;
    this.line = line;
  }
}

function defaultForType(typeName: string): RuntimeValue {
  if (typeName === "int" || typeName === "long" || typeName === "short" || typeName === "byte") {
    return { tag: "int", val: 0 };
  }
  if (typeName === "double" || typeName === "float") {
    return { tag: "double", val: 0.0 };
  }
  if (typeName === "boolean") {
    return { tag: "boolean", val: false };
  }
  if (typeName === "char") {
    return { tag: "char", val: "\0" };
  }
  return { tag: "null" };
}

function toNumber(v: RuntimeValue, line: number): number {
  if (v.tag === "int" || v.tag === "double") return v.val;
  if (v.tag === "char") return v.val.length > 0 ? v.val.charCodeAt(0) : 0;
  throw new JavaRuntimeError("TypeMismatch", `Cannot convert ${v.tag} to number`, line);
}

function isDoubleVal(v: RuntimeValue): boolean {
  return v.tag === "double";
}

function toBoolean(v: RuntimeValue, line: number): boolean {
  if (v.tag === "boolean") return v.val;
  throw new JavaRuntimeError("TypeMismatch", `Type mismatch: cannot convert from ${v.tag} to boolean`, line);
}

function valueToString(v: RuntimeValue): string {
  if (v.tag === "string") return v.val;
  if (v.tag === "int" || v.tag === "double") return String(v.val);
  if (v.tag === "boolean") return v.val ? "true" : "false";
  if (v.tag === "char") return v.val;
  if (v.tag === "null") return "null";
  if (v.tag === "list") {
    return "[" + v.items.map(valueToString).join(", ") + "]";
  }
  if (v.tag === "array") {
    return "[" + v.items.map(valueToString).join(", ") + "]";
  }
  if (v.tag === "object") {
    return `${v.className}@${Math.abs(v.className.length * 1337).toString(16)}`;
  }
  return "";
}

function formatPrintf(fmt: string, args: RuntimeValue[]): string {
  let out = "";
  let argIdx = 0;
  let i = 0;
  while (i < fmt.length) {
    const ch = fmt.charAt(i);
    if (ch !== "%") {
      out += ch;
      i += 1;
      continue;
    }
    if (i + 1 < fmt.length && fmt.charAt(i + 1) === "%") {
      out += "%";
      i += 2;
      continue;
    }
    if (i + 1 < fmt.length && fmt.charAt(i + 1) === "n") {
      out += "\n";
      i += 2;
      continue;
    }
    // Parse optional width and precision: %[flags][width][.precision]specifier
    let j = i + 1;
    let spec = "";
    while (j < fmt.length) {
      const c = fmt.charAt(j);
      spec += c;
      if ("dfscebgxX".indexOf(c) !== -1) {
        j += 1;
        break;
      }
      j += 1;
    }
    const code = spec.charAt(spec.length - 1);
    const mods = spec.slice(0, spec.length - 1);
    const val = argIdx < args.length ? args[argIdx] : { tag: "null" as const };
    argIdx += 1;

    let formatted = "";
    if (code === "d") {
      const n = val.tag === "int" || val.tag === "double" ? Math.trunc(val.val) : 0;
      formatted = String(n);
    } else if (code === "f") {
      const n = val.tag === "int" || val.tag === "double" ? val.val : 0;
      const dotPos = mods.indexOf(".");
      const prec = dotPos !== -1 ? parseInt(mods.slice(dotPos + 1), 10) : 6;
      formatted = n.toFixed(isNaN(prec) ? 6 : prec);
    } else if (code === "s") {
      formatted = valueToString(val);
    } else if (code === "c") {
      formatted = val.tag === "char" ? val.val : valueToString(val).slice(0, 1);
    } else if (code === "b") {
      formatted = val.tag === "boolean" ? (val.val ? "true" : "false") : val.tag !== "null" ? "true" : "false";
    } else if (code === "x" || code === "X") {
      const n = val.tag === "int" || val.tag === "double" ? Math.trunc(val.val) : 0;
      formatted = code === "X" ? n.toString(16).toUpperCase() : n.toString(16);
    } else {
      formatted = valueToString(val);
    }

    // Handle minimal width padding
    const dotIdx = mods.indexOf(".");
    const widthPart = dotIdx !== -1 ? mods.slice(0, dotIdx) : mods;
    const leftAlign = widthPart.indexOf("-") === 0;
    const cleanWidth = leftAlign ? widthPart.slice(1) : widthPart;
    const width = parseInt(cleanWidth, 10);
    if (!isNaN(width) && width > formatted.length) {
      const padChar = !leftAlign && cleanWidth.charAt(0) === "0" ? "0" : " ";
      const pad = new Array(width - formatted.length + 1).join(padChar);
      formatted = leftAlign ? formatted + pad : pad + formatted;
    }

    out += formatted;
    i = j;
  }
  return out;
}

class JavaInterpreter {
  private classesByName: Record<string, ClassDecl> = {};
  private staticFields: Record<string, Record<string, RuntimeValue>> = {};
  private stdout = "";
  private stderr = "";
  private steps = 0;
  private depth = 0;
  private stdinInput: string;
  private maxSteps = 80000;
  private maxDepth = 200;

  constructor(program: ParsedProgram, stdinInput = "") {
    this.stdinInput = stdinInput;
    for (let i = 0; i < program.classes.length; i += 1) {
      const cls = program.classes[i];
      this.classesByName[cls.name] = cls;
      this.staticFields[cls.name] = {};
    }
  }

  public run(): { stdout: string; stderr: string; exitCode: number; entryClass: string } {
    const classNames = Object.keys(this.classesByName);
    let entryClass: ClassDecl | null = null;
    let mainMethod: MethodDecl | null = null;

    for (let i = 0; i < classNames.length; i += 1) {
      const cls = this.classesByName[classNames[i]];
      for (let m = 0; m < cls.methods.length; m += 1) {
        const meth = cls.methods[m];
        if (meth.name === "main" && meth.isStatic) {
          entryClass = cls;
          mainMethod = meth;
          break;
        }
      }
      if (mainMethod) break;
    }

    if (!entryClass || !mainMethod) {
      const firstName = classNames.length > 0 ? classNames[0] : "Main";
      throw new JavaRuntimeError(
        "NoSuchMethodError",
        `Main method not found in class ${firstName}, please define the main method as:\n   public static void main(String[] args)`,
        1,
      );
    }

    // Initialize static fields
    const rootScope: ScopeFrame = { vars: {}, parent: null };
    for (let i = 0; i < classNames.length; i += 1) {
      const cls = this.classesByName[classNames[i]];
      for (let f = 0; f < cls.fields.length; f += 1) {
        const field = cls.fields[f];
        if (field.isStatic) {
          const val = field.init
            ? this.evalExpr(field.init, rootScope, null, cls.name)
            : defaultForType(field.fieldType);
          this.staticFields[cls.name][field.name] = val;
        }
      }
    }

    const argsVal: RuntimeValue = { tag: "array", elemType: "String", items: [] };
    this.invokeMethod(entryClass.name, mainMethod, [argsVal], null);

    return {
      stdout: this.stdout,
      stderr: this.stderr,
      exitCode: 0,
      entryClass: entryClass.name,
    };
  }

  private tick(line: number): void {
    this.steps += 1;
    if (this.steps > this.maxSteps) {
      throw new JavaRuntimeError(
        "ExecutionTimeoutException",
        "Execution aborted: exceeded maximum step limit (possible infinite loop)",
        line,
      );
    }
  }

  private lookupVar(name: string, scope: ScopeFrame, selfObj: RuntimeValue | null, currentClass: string): RuntimeValue | null {
    let cur: ScopeFrame | null = scope;
    while (cur) {
      if (Object.prototype.hasOwnProperty.call(cur.vars, name)) {
        return cur.vars[name].value;
      }
      cur = cur.parent;
    }
    if (selfObj && selfObj.tag === "object" && Object.prototype.hasOwnProperty.call(selfObj.fields, name)) {
      return selfObj.fields[name];
    }
    if (
      Object.prototype.hasOwnProperty.call(this.staticFields, currentClass) &&
      Object.prototype.hasOwnProperty.call(this.staticFields[currentClass], name)
    ) {
      return this.staticFields[currentClass][name];
    }
    return null;
  }

  private assignVar(name: string, val: RuntimeValue, scope: ScopeFrame, selfObj: RuntimeValue | null, currentClass: string, line: number): void {
    let cur: ScopeFrame | null = scope;
    while (cur) {
      if (Object.prototype.hasOwnProperty.call(cur.vars, name)) {
        cur.vars[name].value = val;
        return;
      }
      cur = cur.parent;
    }
    if (selfObj && selfObj.tag === "object" && Object.prototype.hasOwnProperty.call(selfObj.fields, name)) {
      selfObj.fields[name] = val;
      return;
    }
    if (
      Object.prototype.hasOwnProperty.call(this.staticFields, currentClass) &&
      Object.prototype.hasOwnProperty.call(this.staticFields[currentClass], name)
    ) {
      this.staticFields[currentClass][name] = val;
      return;
    }
    throw new JavaRuntimeError("CompilationError", `${name} cannot be resolved to a variable`, line);
  }

  private execStmt(stmt: StmtNode, scope: ScopeFrame, selfObj: RuntimeValue | null, currentClass: string): void {
    this.tick(stmt.line);

    switch (stmt.kind) {
      case "empty":
        return;
      case "block": {
        const inner: ScopeFrame = { vars: {}, parent: scope };
        for (let i = 0; i < stmt.statements.length; i += 1) {
          this.execStmt(stmt.statements[i], inner, selfObj, currentClass);
        }
        return;
      }
      case "expr":
        this.evalExpr(stmt.expr, scope, selfObj, currentClass);
        return;
      case "varDecl": {
        for (let i = 0; i < stmt.declarators.length; i += 1) {
          const dec = stmt.declarators[i];
          let val: RuntimeValue = defaultForType(stmt.varType);
          if (dec.init) {
            val = this.evalExpr(dec.init, scope, selfObj, currentClass);
            // Coerce int literal into double variable if declared double/float
            if ((stmt.varType === "double" || stmt.varType === "float") && val.tag === "int") {
              val = { tag: "double", val: val.val };
            }
          }
          scope.vars[dec.name] = { type: stmt.varType, value: val };
        }
        return;
      }
      case "if": {
        const cond = toBoolean(this.evalExpr(stmt.cond, scope, selfObj, currentClass), stmt.line);
        if (cond) {
          this.execStmt(stmt.thenBranch, scope, selfObj, currentClass);
        } else if (stmt.elseBranch) {
          this.execStmt(stmt.elseBranch, scope, selfObj, currentClass);
        }
        return;
      }
      case "while": {
        while (toBoolean(this.evalExpr(stmt.cond, scope, selfObj, currentClass), stmt.line)) {
          this.tick(stmt.line);
          try {
            this.execStmt(stmt.body, scope, selfObj, currentClass);
          } catch (sig) {
            if (sig instanceof BreakSignal) break;
            if (sig instanceof ContinueSignal) continue;
            throw sig;
          }
        }
        return;
      }
      case "doWhile": {
        do {
          this.tick(stmt.line);
          try {
            this.execStmt(stmt.body, scope, selfObj, currentClass);
          } catch (sig) {
            if (sig instanceof BreakSignal) break;
            if (sig instanceof ContinueSignal) {
              // proceed to cond
            } else {
              throw sig;
            }
          }
        } while (toBoolean(this.evalExpr(stmt.cond, scope, selfObj, currentClass), stmt.line));
        return;
      }
      case "for": {
        const loopScope: ScopeFrame = { vars: {}, parent: scope };
        if (stmt.init) {
          this.execStmt(stmt.init, loopScope, selfObj, currentClass);
        }
        while (stmt.cond === null || toBoolean(this.evalExpr(stmt.cond, loopScope, selfObj, currentClass), stmt.line)) {
          this.tick(stmt.line);
          try {
            this.execStmt(stmt.body, loopScope, selfObj, currentClass);
          } catch (sig) {
            if (sig instanceof BreakSignal) break;
            if (!(sig instanceof ContinueSignal)) throw sig;
          }
          for (let u = 0; u < stmt.update.length; u += 1) {
            this.evalExpr(stmt.update[u], loopScope, selfObj, currentClass);
          }
        }
        return;
      }
      case "forEach": {
        const colVal = this.evalExpr(stmt.iterable, scope, selfObj, currentClass);
        if (colVal.tag !== "array" && colVal.tag !== "list") {
          throw new JavaRuntimeError("TypeMismatch", "Can only iterate over an array or Iterable", stmt.line);
        }
        const items = colVal.items;
        for (let i = 0; i < items.length; i += 1) {
          this.tick(stmt.line);
          const iterScope: ScopeFrame = { vars: {}, parent: scope };
          iterScope.vars[stmt.varName] = { type: stmt.varType, value: items[i] };
          try {
            this.execStmt(stmt.body, iterScope, selfObj, currentClass);
          } catch (sig) {
            if (sig instanceof BreakSignal) break;
            if (!(sig instanceof ContinueSignal)) throw sig;
          }
        }
        return;
      }
      case "switch": {
        const targetVal = this.evalExpr(stmt.expr, scope, selfObj, currentClass);
        const switchScope: ScopeFrame = { vars: {}, parent: scope };
        let matched = false;
        let defaultIdx = -1;
        for (let c = 0; c < stmt.cases.length; c += 1) {
          if (stmt.cases[c].label === null) {
            defaultIdx = c;
          } else {
            const labelVal = this.evalExpr(stmt.cases[c].label!, scope, selfObj, currentClass);
            if (this.valuesEqual(targetVal, labelVal)) {
              matched = true;
              try {
                for (let k = c; k < stmt.cases.length; k += 1) {
                  for (let s = 0; s < stmt.cases[k].stmts.length; s += 1) {
                    this.execStmt(stmt.cases[k].stmts[s], switchScope, selfObj, currentClass);
                  }
                }
              } catch (sig) {
                if (!(sig instanceof BreakSignal)) throw sig;
              }
              break;
            }
          }
        }
        if (!matched && defaultIdx !== -1) {
          try {
            for (let k = defaultIdx; k < stmt.cases.length; k += 1) {
              for (let s = 0; s < stmt.cases[k].stmts.length; s += 1) {
                this.execStmt(stmt.cases[k].stmts[s], switchScope, selfObj, currentClass);
              }
            }
          } catch (sig) {
            if (!(sig instanceof BreakSignal)) throw sig;
          }
        }
        return;
      }
      case "return": {
        const val = stmt.expr ? this.evalExpr(stmt.expr, scope, selfObj, currentClass) : ({ tag: "void" } as RuntimeValue);
        throw new ReturnSignal(val);
      }
      case "break":
        throw new BreakSignal();
      case "continue":
        throw new ContinueSignal();
      case "throw": {
        const val = this.evalExpr(stmt.expr, scope, selfObj, currentClass);
        const msg = val.tag === "object" && val.fields.message ? valueToString(val.fields.message) : valueToString(val);
        throw new JavaRuntimeError(val.tag === "object" ? val.className : "Exception", msg, stmt.line);
      }
      case "try": {
        try {
          this.execStmt(stmt.tryBlock, scope, selfObj, currentClass);
        } catch (err) {
          if (err instanceof ReturnSignal || err instanceof BreakSignal || err instanceof ContinueSignal) {
            if (stmt.finallyBlock) this.execStmt(stmt.finallyBlock, scope, selfObj, currentClass);
            throw err;
          }
          if (stmt.catches.length > 0) {
            const catchScope: ScopeFrame = { vars: {}, parent: scope };
            const msgText = err instanceof Error ? err.message : String(err);
            catchScope.vars[stmt.catches[0].varName] = {
              type: "Exception",
              value: {
                tag: "object",
                className: err instanceof JavaRuntimeError ? err.javaType : "Exception",
                fields: { message: { tag: "string", val: msgText } },
              },
            };
            this.execStmt(stmt.catches[0].block, catchScope, selfObj, currentClass);
          } else {
            if (stmt.finallyBlock) this.execStmt(stmt.finallyBlock, scope, selfObj, currentClass);
            throw err;
          }
        }
        if (stmt.finallyBlock) {
          this.execStmt(stmt.finallyBlock, scope, selfObj, currentClass);
        }
        return;
      }
    }
  }

  private valuesEqual(a: RuntimeValue, b: RuntimeValue): boolean {
    if (a.tag === "null" && b.tag === "null") return true;
    if (a.tag === "null" || b.tag === "null") return false;
    if ((a.tag === "int" || a.tag === "double") && (b.tag === "int" || b.tag === "double")) {
      return a.val === b.val;
    }
    if (a.tag === "string" && b.tag === "string") return a.val === b.val;
    if (a.tag === "boolean" && b.tag === "boolean") return a.val === b.val;
    if (a.tag === "char" && b.tag === "char") return a.val === b.val;
    return a === b;
  }

  private evalExpr(expr: ExprNode, scope: ScopeFrame, selfObj: RuntimeValue | null, currentClass: string): RuntimeValue {
    this.tick(expr.line);

    switch (expr.kind) {
      case "literal":
        return expr.value;
      case "this":
        if (!selfObj) throw new JavaRuntimeError("CompilationError", "Cannot use this in a static context", expr.line);
        return selfObj;
      case "ident": {
        const local = this.lookupVar(expr.name, scope, selfObj, currentClass);
        if (local !== null) return local;
        if (
          expr.name === "System" ||
          expr.name === "Math" ||
          expr.name === "Integer" ||
          expr.name === "Double" ||
          expr.name === "Boolean" ||
          expr.name === "Character" ||
          expr.name === "String" ||
          expr.name === "Arrays" ||
          Object.prototype.hasOwnProperty.call(this.classesByName, expr.name)
        ) {
          return { tag: "classRef", name: expr.name };
        }
        throw new JavaRuntimeError("CompilationError", `${expr.name} cannot be resolved to a variable`, expr.line);
      }
      case "arrayLit": {
        const items = expr.elements.map((e) => this.evalExpr(e, scope, selfObj, currentClass));
        return { tag: "array", elemType: "Object", items };
      }
      case "newArray": {
        if (expr.initializer) {
          const items = expr.initializer.map((e) => this.evalExpr(e, scope, selfObj, currentClass));
          return { tag: "array", elemType: expr.elemType, items };
        }
        if (expr.dims.length === 0) {
          return { tag: "array", elemType: expr.elemType, items: [] };
        }
        const size = Math.trunc(toNumber(this.evalExpr(expr.dims[0], scope, selfObj, currentClass), expr.line));
        if (size < 0) {
          throw new JavaRuntimeError("NegativeArraySizeException", String(size), expr.line);
        }
        const items: RuntimeValue[] = [];
        if (expr.dims.length === 1) {
          for (let i = 0; i < size; i += 1) items.push(defaultForType(expr.elemType));
        } else {
          const innerSize = Math.trunc(toNumber(this.evalExpr(expr.dims[1], scope, selfObj, currentClass), expr.line));
          for (let i = 0; i < size; i += 1) {
            const inner: RuntimeValue[] = [];
            for (let j = 0; j < innerSize; j += 1) inner.push(defaultForType(expr.elemType));
            items.push({ tag: "array", elemType: expr.elemType, items: inner });
          }
        }
        return { tag: "array", elemType: expr.elemType, items };
      }
      case "newObject": {
        const args = expr.args.map((a) => this.evalExpr(a, scope, selfObj, currentClass));
        if (expr.className === "ArrayList" || expr.className === "java.util.ArrayList") {
          return { tag: "list", items: [] };
        }
        if (expr.className === "Scanner" || expr.className === "java.util.Scanner") {
          const sourceText = args.length > 0 && args[0].tag === "string" ? args[0].val : this.stdinInput;
          return { tag: "scanner", raw: sourceText, pos: 0 };
        }
        if (expr.className === "StringBuilder" || expr.className === "StringBuffer") {
          const initStr = args.length > 0 ? valueToString(args[0]) : "";
          return { tag: "object", className: expr.className, fields: { __buf: { tag: "string", val: initStr } } };
        }
        if (expr.className === "Exception" || expr.className === "RuntimeException" || expr.className === "IllegalArgumentException") {
          const msg = args.length > 0 ? valueToString(args[0]) : "";
          return { tag: "object", className: expr.className, fields: { message: { tag: "string", val: msg } } };
        }
        const cls = this.classesByName[expr.className];
        if (!cls) {
          throw new JavaRuntimeError("CompilationError", `${expr.className} cannot be resolved to a type`, expr.line);
        }
        const obj: RuntimeValue = { tag: "object", className: cls.name, fields: {} };
        for (let f = 0; f < cls.fields.length; f += 1) {
          const field = cls.fields[f];
          if (!field.isStatic) {
            obj.fields[field.name] = field.init
              ? this.evalExpr(field.init, scope, obj, cls.name)
              : defaultForType(field.fieldType);
          }
        }
        for (let m = 0; m < cls.methods.length; m += 1) {
          if (cls.methods[m].isConstructor && cls.methods[m].params.length === args.length) {
            this.invokeMethod(cls.name, cls.methods[m], args, obj);
            break;
          }
        }
        return obj;
      }
      case "member": {
        // Handle System.in
        if (expr.object.kind === "ident" && expr.object.name === "System" && expr.property === "in") {
          return { tag: "classRef", name: "System.in" };
        }
        const target = this.evalExpr(expr.object, scope, selfObj, currentClass);
        if (target.tag === "classRef") {
          if (target.name === "System" && expr.property === "out") return { tag: "sysOut" };
          if (target.name === "System" && expr.property === "err") return { tag: "sysErr" };
          if (target.name === "Math" && expr.property === "PI") return { tag: "double", val: Math.PI };
          if (target.name === "Math" && expr.property === "E") return { tag: "double", val: Math.E };
          if (target.name === "Integer" && expr.property === "MAX_VALUE") return { tag: "int", val: 2147483647 };
          if (target.name === "Integer" && expr.property === "MIN_VALUE") return { tag: "int", val: -2147483648 };
          if (
            Object.prototype.hasOwnProperty.call(this.staticFields, target.name) &&
            Object.prototype.hasOwnProperty.call(this.staticFields[target.name], expr.property)
          ) {
            return this.staticFields[target.name][expr.property];
          }
        }
        if (target.tag === "array" && expr.property === "length") {
          return { tag: "int", val: target.items.length };
        }
        if (target.tag === "object" && Object.prototype.hasOwnProperty.call(target.fields, expr.property)) {
          return target.fields[expr.property];
        }
        throw new JavaRuntimeError("NullPointerException", `Cannot read field "${expr.property}"`, expr.line);
      }
      case "index": {
        const arr = this.evalExpr(expr.object, scope, selfObj, currentClass);
        const idx = Math.trunc(toNumber(this.evalExpr(expr.index, scope, selfObj, currentClass), expr.line));
        if (arr.tag !== "array") {
          throw new JavaRuntimeError("CompilationError", "The type of the expression must be an array type", expr.line);
        }
        if (idx < 0 || idx >= arr.items.length) {
          throw new JavaRuntimeError("ArrayIndexOutOfBoundsException", `Index ${idx} out of bounds for length ${arr.items.length}`, expr.line);
        }
        return arr.items[idx];
      }
      case "call":
        return this.evalCall(expr.callee, expr.args, scope, selfObj, currentClass, expr.line);
      case "cast": {
        const val = this.evalExpr(expr.expr, scope, selfObj, currentClass);
        if (expr.targetType === "int" || expr.targetType === "long") {
          return { tag: "int", val: Math.trunc(toNumber(val, expr.line)) };
        }
        if (expr.targetType === "double" || expr.targetType === "float") {
          return { tag: "double", val: toNumber(val, expr.line) };
        }
        if (expr.targetType === "char") {
          const code = Math.trunc(toNumber(val, expr.line));
          return { tag: "char", val: String.fromCharCode(code) };
        }
        if (expr.targetType === "String") {
          return { tag: "string", val: valueToString(val) };
        }
        return val;
      }
      case "unary": {
        if (expr.op === "!") {
          return { tag: "boolean", val: !toBoolean(this.evalExpr(expr.expr, scope, selfObj, currentClass), expr.line) };
        }
        if (expr.op === "-") {
          const v = this.evalExpr(expr.expr, scope, selfObj, currentClass);
          return { tag: isDoubleVal(v) ? "double" : "int", val: -toNumber(v, expr.line) };
        }
        if (expr.op === "+") {
          const v = this.evalExpr(expr.expr, scope, selfObj, currentClass);
          return { tag: isDoubleVal(v) ? "double" : "int", val: toNumber(v, expr.line) };
        }
        if (expr.op === "++" || expr.op === "--") {
          const delta = expr.op === "++" ? 1 : -1;
          const oldVal = this.evalExpr(expr.expr, scope, selfObj, currentClass);
          const nextNum = toNumber(oldVal, expr.line) + delta;
          const nextVal: RuntimeValue = { tag: isDoubleVal(oldVal) ? "double" : "int", val: nextNum };
          this.writeTarget(expr.expr, nextVal, scope, selfObj, currentClass, expr.line);
          return expr.prefix ? nextVal : oldVal;
        }
        throw new JavaRuntimeError("CompilationError", `Unsupported unary operator ${expr.op}`, expr.line);
      }
      case "binary": {
        if (expr.op === "&&") {
          const leftBool = toBoolean(this.evalExpr(expr.left, scope, selfObj, currentClass), expr.line);
          if (!leftBool) return { tag: "boolean", val: false };
          return { tag: "boolean", val: toBoolean(this.evalExpr(expr.right, scope, selfObj, currentClass), expr.line) };
        }
        if (expr.op === "||") {
          const leftBool = toBoolean(this.evalExpr(expr.left, scope, selfObj, currentClass), expr.line);
          if (leftBool) return { tag: "boolean", val: true };
          return { tag: "boolean", val: toBoolean(this.evalExpr(expr.right, scope, selfObj, currentClass), expr.line) };
        }
        const left = this.evalExpr(expr.left, scope, selfObj, currentClass);
        const right = this.evalExpr(expr.right, scope, selfObj, currentClass);
        if (expr.op === "+") {
          if (left.tag === "string" || right.tag === "string") {
            return { tag: "string", val: valueToString(left) + valueToString(right) };
          }
          const isD = isDoubleVal(left) || isDoubleVal(right);
          return { tag: isD ? "double" : "int", val: toNumber(left, expr.line) + toNumber(right, expr.line) };
        }
        if (expr.op === "-") {
          const isD = isDoubleVal(left) || isDoubleVal(right);
          return { tag: isD ? "double" : "int", val: toNumber(left, expr.line) - toNumber(right, expr.line) };
        }
        if (expr.op === "*") {
          const isD = isDoubleVal(left) || isDoubleVal(right);
          return { tag: isD ? "double" : "int", val: toNumber(left, expr.line) * toNumber(right, expr.line) };
        }
        if (expr.op === "/") {
          const isD = isDoubleVal(left) || isDoubleVal(right);
          const denom = toNumber(right, expr.line);
          if (!isD && denom === 0) {
            throw new JavaRuntimeError("ArithmeticException", "/ by zero", expr.line);
          }
          const res = toNumber(left, expr.line) / denom;
          return { tag: isD ? "double" : "int", val: isD ? res : Math.trunc(res) };
        }
        if (expr.op === "%") {
          const isD = isDoubleVal(left) || isDoubleVal(right);
          const denom = toNumber(right, expr.line);
          if (!isD && denom === 0) {
            throw new JavaRuntimeError("ArithmeticException", "/ by zero", expr.line);
          }
          return { tag: isD ? "double" : "int", val: toNumber(left, expr.line) % denom };
        }
        if (expr.op === "==") return { tag: "boolean", val: this.valuesEqual(left, right) };
        if (expr.op === "!=") return { tag: "boolean", val: !this.valuesEqual(left, right) };
        if (expr.op === "<") return { tag: "boolean", val: toNumber(left, expr.line) < toNumber(right, expr.line) };
        if (expr.op === "<=") return { tag: "boolean", val: toNumber(left, expr.line) <= toNumber(right, expr.line) };
        if (expr.op === ">") return { tag: "boolean", val: toNumber(left, expr.line) > toNumber(right, expr.line) };
        if (expr.op === ">=") return { tag: "boolean", val: toNumber(left, expr.line) >= toNumber(right, expr.line) };
        throw new JavaRuntimeError("CompilationError", `Unsupported operator ${expr.op}`, expr.line);
      }
      case "assign": {
        const rhs = this.evalExpr(expr.value, scope, selfObj, currentClass);
        if (expr.op === "=") {
          this.writeTarget(expr.target, rhs, scope, selfObj, currentClass, expr.line);
          return rhs;
        }
        const cur = this.evalExpr(expr.target, scope, selfObj, currentClass);
        let nextVal: RuntimeValue;
        if (expr.op === "+=" && (cur.tag === "string" || rhs.tag === "string")) {
          nextVal = { tag: "string", val: valueToString(cur) + valueToString(rhs) };
        } else {
          const a = toNumber(cur, expr.line);
          const b = toNumber(rhs, expr.line);
          const isD = isDoubleVal(cur) || isDoubleVal(rhs);
          let num = a;
          if (expr.op === "+=") num = a + b;
          else if (expr.op === "-=") num = a - b;
          else if (expr.op === "*=") num = a * b;
          else if (expr.op === "/=") {
            if (!isD && b === 0) throw new JavaRuntimeError("ArithmeticException", "/ by zero", expr.line);
            num = isD ? a / b : Math.trunc(a / b);
          } else if (expr.op === "%=") {
            num = a % b;
          }
          nextVal = { tag: isD ? "double" : "int", val: num };
        }
        this.writeTarget(expr.target, nextVal, scope, selfObj, currentClass, expr.line);
        return nextVal;
      }
      case "ternary": {
        const cond = toBoolean(this.evalExpr(expr.cond, scope, selfObj, currentClass), expr.line);
        return cond
          ? this.evalExpr(expr.thenExpr, scope, selfObj, currentClass)
          : this.evalExpr(expr.elseExpr, scope, selfObj, currentClass);
      }
    }
  }

  private writeTarget(
    target: ExprNode,
    val: RuntimeValue,
    scope: ScopeFrame,
    selfObj: RuntimeValue | null,
    currentClass: string,
    line: number,
  ): void {
    if (target.kind === "ident") {
      this.assignVar(target.name, val, scope, selfObj, currentClass, line);
      return;
    }
    if (target.kind === "index") {
      const arr = this.evalExpr(target.object, scope, selfObj, currentClass);
      const idx = Math.trunc(toNumber(this.evalExpr(target.index, scope, selfObj, currentClass), line));
      if (arr.tag !== "array") {
        throw new JavaRuntimeError("CompilationError", "Target is not an array", line);
      }
      if (idx < 0 || idx >= arr.items.length) {
        throw new JavaRuntimeError("ArrayIndexOutOfBoundsException", `Index ${idx} out of bounds for length ${arr.items.length}`, line);
      }
      arr.items[idx] = val;
      return;
    }
    if (target.kind === "member") {
      const obj = this.evalExpr(target.object, scope, selfObj, currentClass);
      if (obj.tag === "object") {
        obj.fields[target.property] = val;
        return;
      }
      if (obj.tag === "classRef" && Object.prototype.hasOwnProperty.call(this.staticFields, obj.name)) {
        this.staticFields[obj.name][target.property] = val;
        return;
      }
    }
    throw new JavaRuntimeError("CompilationError", "The left-hand side of an assignment must be a variable", line);
  }

  private evalCall(
    callee: ExprNode,
    argExprs: ExprNode[],
    scope: ScopeFrame,
    selfObj: RuntimeValue | null,
    currentClass: string,
    line: number,
  ): RuntimeValue {
    const args = argExprs.map((a) => this.evalExpr(a, scope, selfObj, currentClass));

    // Bare method call in current class: foo(...)
    if (callee.kind === "ident") {
      const cls = this.classesByName[currentClass];
      if (cls) {
        for (let m = 0; m < cls.methods.length; m += 1) {
          if (cls.methods[m].name === callee.name && !cls.methods[m].isConstructor && cls.methods[m].params.length === args.length) {
            return this.invokeMethod(currentClass, cls.methods[m], args, cls.methods[m].isStatic ? null : selfObj);
          }
        }
      }
      throw new JavaRuntimeError("CompilationError", `The method ${callee.name}() is undefined for the type ${currentClass}`, line);
    }

    if (callee.kind === "member") {
      const receiver = this.evalExpr(callee.object, scope, selfObj, currentClass);
      const method = callee.property;

      // System.out / System.err
      if (receiver.tag === "sysOut" || receiver.tag === "sysErr") {
        const isErr = receiver.tag === "sysErr";
        let text = "";
        if (method === "println") {
          text = (args.length > 0 ? valueToString(args[0]) : "") + "\n";
        } else if (method === "print") {
          text = args.length > 0 ? valueToString(args[0]) : "";
        } else if (method === "printf") {
          const fmt = args.length > 0 ? valueToString(args[0]) : "";
          text = formatPrintf(fmt, args.slice(1));
        }
        if (isErr) this.stderr += text;
        else this.stdout += text;
        return { tag: "void" };
      }

      // Static class calls: Math, Integer, Double, String, Arrays, UserClass
      if (receiver.tag === "classRef") {
        if (receiver.name === "Math") {
          const a = args.length > 0 ? toNumber(args[0], line) : 0;
          const b = args.length > 1 ? toNumber(args[1], line) : 0;
          if (method === "abs") return { tag: isDoubleVal(args[0]) ? "double" : "int", val: Math.abs(a) };
          if (method === "max") return { tag: isDoubleVal(args[0]) || isDoubleVal(args[1]) ? "double" : "int", val: Math.max(a, b) };
          if (method === "min") return { tag: isDoubleVal(args[0]) || isDoubleVal(args[1]) ? "double" : "int", val: Math.min(a, b) };
          if (method === "pow") return { tag: "double", val: Math.pow(a, b) };
          if (method === "sqrt") return { tag: "double", val: Math.sqrt(a) };
          if (method === "cbrt") return { tag: "double", val: Math.cbrt(a) };
          if (method === "round") return { tag: "int", val: Math.round(a) };
          if (method === "floor") return { tag: "double", val: Math.floor(a) };
          if (method === "ceil") return { tag: "double", val: Math.ceil(a) };
          if (method === "random") return { tag: "double", val: Math.random() };
          if (method === "sin") return { tag: "double", val: Math.sin(a) };
          if (method === "cos") return { tag: "double", val: Math.cos(a) };
          if (method === "tan") return { tag: "double", val: Math.tan(a) };
          if (method === "log") return { tag: "double", val: Math.log(a) };
          if (method === "log10") return { tag: "double", val: Math.log10(a) };
        }
        if (receiver.name === "Integer") {
          if (method === "parseInt") {
            const parsed = parseInt(valueToString(args[0]).trim(), 10);
            if (isNaN(parsed)) throw new JavaRuntimeError("NumberFormatException", `For input string: "${valueToString(args[0])}"`, line);
            return { tag: "int", val: parsed };
          }
          if (method === "toString") return { tag: "string", val: String(Math.trunc(toNumber(args[0], line))) };
        }
        if (receiver.name === "Double") {
          if (method === "parseDouble") {
            const parsed = parseFloat(valueToString(args[0]).trim());
            if (isNaN(parsed)) throw new JavaRuntimeError("NumberFormatException", `For input string: "${valueToString(args[0])}"`, line);
            return { tag: "double", val: parsed };
          }
          if (method === "toString") return { tag: "string", val: String(toNumber(args[0], line)) };
        }
        if (receiver.name === "Boolean" && method === "parseBoolean") {
          return { tag: "boolean", val: valueToString(args[0]).toLowerCase() === "true" };
        }
        if (receiver.name === "String") {
          if (method === "valueOf") return { tag: "string", val: valueToString(args[0]) };
          if (method === "format") return { tag: "string", val: formatPrintf(valueToString(args[0]), args.slice(1)) };
        }
        if (receiver.name === "Character") {
          const ch = valueToString(args[0]).charAt(0);
          if (method === "isDigit") return { tag: "boolean", val: isDigit(ch) };
          if (method === "isLetter") return { tag: "boolean", val: isAlphaStart(ch) && ch !== "_" && ch !== "$" };
          if (method === "toUpperCase") return { tag: "char", val: ch.toUpperCase() };
          if (method === "toLowerCase") return { tag: "char", val: ch.toLowerCase() };
        }
        if (receiver.name === "Arrays") {
          const arr = args[0];
          if (arr && arr.tag === "array") {
            if (method === "toString") return { tag: "string", val: "[" + arr.items.map(valueToString).join(", ") + "]" };
            if (method === "sort") {
              arr.items.sort((x, y) => {
                if ((x.tag === "int" || x.tag === "double") && (y.tag === "int" || y.tag === "double")) return x.val - y.val;
                return valueToString(x).localeCompare(valueToString(y));
              });
              return { tag: "void" };
            }
            if (method === "fill" && args.length >= 2) {
              for (let i = 0; i < arr.items.length; i += 1) arr.items[i] = args[1];
              return { tag: "void" };
            }
          }
        }
        const cls = this.classesByName[receiver.name];
        if (cls) {
          for (let m = 0; m < cls.methods.length; m += 1) {
            if (cls.methods[m].name === method && cls.methods[m].isStatic && cls.methods[m].params.length === args.length) {
              return this.invokeMethod(cls.name, cls.methods[m], args, null);
            }
          }
        }
      }

      // String instance methods
      if (receiver.tag === "string") {
        const s = receiver.val;
        if (method === "length") return { tag: "int", val: s.length };
        if (method === "isEmpty") return { tag: "boolean", val: s.length === 0 };
        if (method === "charAt") {
          const idx = Math.trunc(toNumber(args[0], line));
          if (idx < 0 || idx >= s.length) throw new JavaRuntimeError("StringIndexOutOfBoundsException", `Index ${idx} out of bounds for length ${s.length}`, line);
          return { tag: "char", val: s.charAt(idx) };
        }
        if (method === "substring") {
          const a = Math.trunc(toNumber(args[0], line));
          const b = args.length > 1 ? Math.trunc(toNumber(args[1], line)) : s.length;
          return { tag: "string", val: s.slice(a, b) };
        }
        if (method === "indexOf") return { tag: "int", val: s.indexOf(valueToString(args[0])) };
        if (method === "contains") return { tag: "boolean", val: s.indexOf(valueToString(args[0])) !== -1 };
        if (method === "startsWith") return { tag: "boolean", val: s.indexOf(valueToString(args[0])) === 0 };
        if (method === "endsWith") {
          const suffix = valueToString(args[0]);
          return { tag: "boolean", val: s.slice(s.length - suffix.length) === suffix };
        }
        if (method === "equals") return { tag: "boolean", val: args[0].tag === "string" && s === args[0].val };
        if (method === "equalsIgnoreCase") return { tag: "boolean", val: args[0].tag === "string" && s.toLowerCase() === args[0].val.toLowerCase() };
        if (method === "compareTo") {
          const other = valueToString(args[0]);
          return { tag: "int", val: s < other ? -1 : s > other ? 1 : 0 };
        }
        if (method === "toUpperCase") return { tag: "string", val: s.toUpperCase() };
        if (method === "toLowerCase") return { tag: "string", val: s.toLowerCase() };
        if (method === "trim") return { tag: "string", val: s.trim() };
        if (method === "replace") {
          const target = valueToString(args[0]);
          const rep = valueToString(args[1]);
          return { tag: "string", val: s.split(target).join(rep) };
        }
        if (method === "split") {
          const parts = s.split(valueToString(args[0])).map((p): RuntimeValue => ({ tag: "string", val: p }));
          return { tag: "array", elemType: "String", items: parts };
        }
      }

      // ArrayList methods
      if (receiver.tag === "list") {
        if (method === "add") {
          if (args.length === 2) {
            receiver.items.splice(Math.trunc(toNumber(args[0], line)), 0, args[1]);
          } else {
            receiver.items.push(args[0]);
          }
          return { tag: "boolean", val: true };
        }
        if (method === "get") {
          const idx = Math.trunc(toNumber(args[0], line));
          if (idx < 0 || idx >= receiver.items.length) throw new JavaRuntimeError("IndexOutOfBoundsException", `Index ${idx} out of bounds`, line);
          return receiver.items[idx];
        }
        if (method === "set") {
          const idx = Math.trunc(toNumber(args[0], line));
          const old = receiver.items[idx];
          receiver.items[idx] = args[1];
          return old;
        }
        if (method === "remove") {
          const idx = Math.trunc(toNumber(args[0], line));
          const removed = receiver.items.splice(idx, 1);
          return removed[0] || { tag: "null" };
        }
        if (method === "size") return { tag: "int", val: receiver.items.length };
        if (method === "isEmpty") return { tag: "boolean", val: receiver.items.length === 0 };
        if (method === "contains") {
          for (let i = 0; i < receiver.items.length; i += 1) {
            if (this.valuesEqual(receiver.items[i], args[0])) return { tag: "boolean", val: true };
          }
          return { tag: "boolean", val: false };
        }
        if (method === "clear") {
          receiver.items = [];
          return { tag: "void" };
        }
      }

      // Scanner methods (unified stream position across tokens & lines)
      if (receiver.tag === "scanner") {
        const peekToken = (): { token: string; endPos: number } => {
          let p = receiver.pos;
          while (p < receiver.raw.length && /\s/.test(receiver.raw.charAt(p))) {
            p += 1;
          }
          let endPos = p;
          while (endPos < receiver.raw.length && !/\s/.test(receiver.raw.charAt(endPos))) {
            endPos += 1;
          }
          return { token: receiver.raw.slice(p, endPos), endPos };
        };
        if (method === "hasNext") {
          return { tag: "boolean", val: peekToken().token.length > 0 };
        }
        if (method === "hasNextInt") {
          const tok = peekToken().token;
          return { tag: "boolean", val: /^[+-]?\d+$/.test(tok) };
        }
        if (method === "hasNextDouble") {
          const tok = peekToken().token;
          return { tag: "boolean", val: /^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(tok) };
        }
        if (method === "hasNextLine") {
          return { tag: "boolean", val: receiver.pos < receiver.raw.length };
        }
        if (method === "next") {
          const { token, endPos } = peekToken();
          receiver.pos = endPos;
          return { tag: "string", val: token };
        }
        if (method === "nextLine") {
          if (receiver.pos >= receiver.raw.length) {
            return { tag: "string", val: "" };
          }
          let end = receiver.pos;
          while (
            end < receiver.raw.length &&
            receiver.raw.charAt(end) !== "\n" &&
            receiver.raw.charAt(end) !== "\r"
          ) {
            end += 1;
          }
          const ln = receiver.raw.slice(receiver.pos, end);
          if (end < receiver.raw.length && receiver.raw.charAt(end) === "\r") end += 1;
          if (end < receiver.raw.length && receiver.raw.charAt(end) === "\n") end += 1;
          receiver.pos = end;
          return { tag: "string", val: ln };
        }
        if (method === "nextInt") {
          const { token, endPos } = peekToken();
          receiver.pos = endPos;
          const n = parseInt(token, 10);
          return { tag: "int", val: isNaN(n) ? 0 : n };
        }
        if (method === "nextDouble") {
          const { token, endPos } = peekToken();
          receiver.pos = endPos;
          const n = parseFloat(token);
          return { tag: "double", val: isNaN(n) ? 0 : n };
        }
        if (method === "close") return { tag: "void" };
      }

      // User object methods & StringBuilder
      if (receiver.tag === "object") {
        if (receiver.className === "StringBuilder" || receiver.className === "StringBuffer") {
          const cur = receiver.fields.__buf && receiver.fields.__buf.tag === "string" ? receiver.fields.__buf.val : "";
          if (method === "append") {
            receiver.fields.__buf = { tag: "string", val: cur + (args.length > 0 ? valueToString(args[0]) : "") };
            return receiver;
          }
          if (method === "toString") return { tag: "string", val: cur };
          if (method === "length") return { tag: "int", val: cur.length };
          if (method === "reverse") {
            receiver.fields.__buf = { tag: "string", val: cur.split("").reverse().join("") };
            return receiver;
          }
        }
        if (method === "getMessage" && receiver.fields.message) {
          return receiver.fields.message;
        }
        const cls = this.classesByName[receiver.className];
        if (cls) {
          for (let m = 0; m < cls.methods.length; m += 1) {
            if (cls.methods[m].name === method && !cls.methods[m].isConstructor && cls.methods[m].params.length === args.length) {
              return this.invokeMethod(cls.name, cls.methods[m], args, receiver);
            }
          }
        }
      }

      if (method === "toString") return { tag: "string", val: valueToString(receiver) };
      if (method === "equals") return { tag: "boolean", val: args.length > 0 && this.valuesEqual(receiver, args[0]) };

      throw new JavaRuntimeError("CompilationError", `Cannot invoke ${method}()`, line);
    }

    throw new JavaRuntimeError("CompilationError", "Invalid method call expression", line);
  }

  private invokeMethod(className: string, method: MethodDecl, args: RuntimeValue[], selfObj: RuntimeValue | null): RuntimeValue {
    this.depth += 1;
    if (this.depth > this.maxDepth) {
      this.depth -= 1;
      throw new JavaRuntimeError("StackOverflowError", "Maximum call stack depth exceeded", method.line);
    }
    const frame: ScopeFrame = { vars: {}, parent: null };
    for (let i = 0; i < method.params.length; i += 1) {
      const p = method.params[i];
      frame.vars[p.name] = { type: p.type, value: i < args.length ? args[i] : defaultForType(p.type) };
    }
    try {
      this.execStmt(method.body, frame, selfObj, className);
      this.depth -= 1;
      return { tag: "void" };
    } catch (sig) {
      this.depth -= 1;
      if (sig instanceof ReturnSignal) {
        return sig.value;
      }
      throw sig;
    }
  }
}

// ============================================================================
// Public API: Execute, Diagnostics, Tasks, Symbols, Formatter
// ============================================================================

export function extractTodoTasks(code: string): TodoTaskItem[] {
  const lines = code.split(/\r?\n/);
  const items: TodoTaskItem[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const idx = lines[i].indexOf("//");
    if (idx !== -1) {
      const comment = lines[i].slice(idx + 2).trim();
      if (/^TODO\b/i.test(comment)) {
        items.push({ line: i + 1, text: comment });
      }
    }
  }
  return items;
}

export function extractFoldableMethodLines(code: string): number[] {
  const { tokens } = tokenizeJava(code);
  try {
    const prog = new JavaParser(tokens).parseProgram();
    const lines: number[] = [];
    for (let c = 0; c < prog.classes.length; c += 1) {
      for (let m = 0; m < prog.classes[c].methods.length; m += 1) {
        lines.push(prog.classes[c].methods[m].line);
      }
    }
    return lines;
  } catch {
    // Fallback heuristic if code temporarily has a syntax error while typing
    const rawLines = code.split(/\r?\n/);
    const lines: number[] = [];
    for (let i = 0; i < rawLines.length; i += 1) {
      if (/\b(public|private|protected|static)\b.*\(.*\)\s*\{/.test(rawLines[i])) {
        lines.push(i + 1);
      }
    }
    return lines;
  }
}

export function analyzeJavaProblems(
  code: string,
  resourceName = "HelloWorld.java",
  resourcePath = "/HelloWorld/src/com/openclassrooms",
): EclipseProblem[] {
  const problems: EclipseProblem[] = [];
  const { tokens, lexErrors } = tokenizeJava(code);

  for (let i = 0; i < lexErrors.length; i += 1) {
    problems.push({
      id: `lex-${i}-${lexErrors[i].line}`,
      severity: "error",
      message: lexErrors[i].message,
      resource: resourceName,
      path: resourcePath,
      line: lexErrors[i].line,
      type: "Java Problem",
    });
  }

  // Balance check for brackets
  const stack: Array<{ ch: string; line: number }> = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.type !== "punct") continue;
    if (t.value === "{" || t.value === "(" || t.value === "[") {
      stack.push({ ch: t.value, line: t.line });
    } else if (t.value === "}" || t.value === ")" || t.value === "]") {
      const expected = t.value === "}" ? "{" : t.value === ")" ? "(" : "[";
      if (stack.length === 0 || stack[stack.length - 1].ch !== expected) {
        problems.push({
          id: `brace-extra-${i}`,
          severity: "error",
          message: `Syntax error on token "${t.value}", delete this token`,
          resource: resourceName,
          path: resourcePath,
          line: t.line,
          type: "Java Problem",
        });
      } else {
        stack.pop();
      }
    }
  }
  for (let s = 0; s < stack.length; s += 1) {
    const closing = stack[s].ch === "{" ? "}" : stack[s].ch === "(" ? ")" : "]";
    problems.push({
      id: `brace-open-${s}`,
      severity: "error",
      message: `Syntax error, insert "${closing}" to complete block`,
      resource: resourceName,
      path: resourcePath,
      line: stack[s].line,
      type: "Java Problem",
    });
  }

  if (problems.length === 0) {
    try {
      const prog = new JavaParser(tokens).parseProgram();
      if (prog.classes.length === 0) {
        problems.push({
          id: "no-class",
          severity: "warning",
          message: "No class declaration found in compilation unit",
          resource: resourceName,
          path: resourcePath,
          line: 1,
          type: "Java Problem",
        });
      }
    } catch (err) {
      const line = err instanceof ParseError ? err.line : 1;
      const msg = err instanceof Error ? err.message : "Syntax error";
      problems.push({
        id: `parse-${line}`,
        severity: "error",
        message: msg,
        resource: resourceName,
        path: resourcePath,
        line,
        type: "Java Problem",
      });
    }
  }

  return problems;
}

export function inspectJavaAtLine(
  code: string,
  lineNumber: number,
): { javadoc: string; declaration: string; symbols: JavaSymbolInfo[] } {
  const symbols: JavaSymbolInfo[] = [];
  const rawLines = code.split(/\r?\n/);
  const { tokens } = tokenizeJava(code);
  let pkgName = "";

  try {
    const prog = new JavaParser(tokens).parseProgram();
    pkgName = prog.packageName;
    if (pkgName) {
      symbols.push({
        kind: "package",
        name: pkgName,
        signature: `package ${pkgName};`,
        javadoc: `Package declaration ${pkgName}. Organizes related Java classes and interfaces.`,
        line: 1,
      });
    }
    for (let c = 0; c < prog.classes.length; c += 1) {
      const cls = prog.classes[c];
      symbols.push({
        kind: "class",
        name: cls.name,
        signature: `public class ${cls.name}`,
        javadoc: `public class ${cls.name}\nextends Object\n\nCompilation unit class defined in ${pkgName || "(default package)"}.`,
        line: cls.line,
      });
      for (let f = 0; f < cls.fields.length; f += 1) {
        const fld = cls.fields[f];
        symbols.push({
          kind: "field",
          name: fld.name,
          signature: `${fld.isStatic ? "static " : ""}${fld.fieldType} ${fld.name}`,
          javadoc: `Field ${fld.name} of type ${fld.fieldType} in ${cls.name}.`,
          line: fld.line,
        });
      }
      for (let m = 0; m < cls.methods.length; m += 1) {
        const meth = cls.methods[m];
        const paramsStr = meth.params.map((p) => `${p.type} ${p.name}`).join(", ");
        const sig = `${meth.isStatic ? "public static " : "public "}${meth.returnType} ${meth.name}(${paramsStr})`;
        symbols.push({
          kind: "method",
          name: meth.name,
          signature: sig,
          javadoc:
            meth.name === "main"
              ? `public static void main(String[] args)\n\nEntry point invoked by the Java Virtual Machine when launching ${cls.name}.\n\nParameters:\n  args - command-line arguments passed to the application`
              : `${sig}\n\nMember method of ${cls.name}.`,
          line: meth.line,
        });
      }
    }
  } catch {
    // Fallback if code is currently invalid while typing
  }

  const lineText = rawLines[lineNumber - 1] || "";
  if (lineText.indexOf("System.out.println") !== -1) {
    return {
      javadoc:
        "void java.io.PrintStream.println(String x)\n\nPrints a String and then terminates the line. This method behaves as though it invokes print(String) and then println().\n\nParameters:\n  x - The String to be printed.",
      declaration: "public void println(String x)",
      symbols,
    };
  }
  if (lineText.indexOf("System.out.print") !== -1) {
    return {
      javadoc:
        "void java.io.PrintStream.print(String s)\n\nPrints a string. If the argument is null then the string \"null\" is printed.",
      declaration: "public void print(String s)",
      symbols,
    };
  }

  let best: JavaSymbolInfo | null = null;
  for (let i = 0; i < symbols.length; i += 1) {
    if (symbols[i].line <= lineNumber) {
      best = symbols[i];
    }
  }
  if (!best && symbols.length > 0) best = symbols[0];

  return {
    javadoc: best ? best.javadoc : "Select a Java element in the editor to view its Javadoc.",
    declaration: best ? best.signature : "// No Java element selected",
    symbols,
  };
}

export function executeJavaCode(code: string, stdinInput = ""): JavaExecutionResult {
  const start = Date.now();
  const problems = analyzeJavaProblems(code);
  const { tokens } = tokenizeJava(code);

  let packageName = "";
  let className = "Main";

  // Quick extraction of package & class even if compile fails
  for (let i = 0; i < tokens.length - 1; i += 1) {
    if (tokens[i].value === "package" && !packageName) {
      const parts: string[] = [];
      let j = i + 1;
      while (j < tokens.length && tokens[j].value !== ";" && tokens[j].type !== "eof") {
        if (tokens[j].value !== ".") parts.push(tokens[j].value);
        j += 1;
      }
      packageName = parts.join(".");
    }
    if (tokens[i].value === "class" && tokens[i + 1].type === "ident") {
      className = tokens[i + 1].value;
      break;
    }
  }

  const fatalProblems = problems.filter((p) => p.severity === "error");
  if (fatalProblems.length > 0) {
    const first = fatalProblems[0];
    const qualified = packageName ? `${packageName}.${className}` : className;
    const stderr =
      `Exception in thread "main" java.lang.Error: Unresolved compilation problem: \n` +
      `\t${first.message}\n\n` +
      `\tat ${qualified}.main(${className}.java:${first.line})\n`;
    return {
      success: false,
      stdout: "",
      stderr,
      exitCode: 1,
      durationMs: Math.max(1, Date.now() - start),
      packageName,
      className,
      problems,
    };
  }

  try {
    const prog = new JavaParser(tokens).parseProgram();
    const interp = new JavaInterpreter(prog, stdinInput);
    const res = interp.run();
    return {
      success: true,
      stdout: res.stdout,
      stderr: res.stderr,
      exitCode: res.exitCode,
      durationMs: Math.max(1, Date.now() - start),
      packageName: prog.packageName,
      className: res.entryClass,
      problems,
    };
  } catch (err) {
    const qualified = packageName ? `${packageName}.${className}` : className;
    if (err instanceof JavaRuntimeError) {
      const stderr =
        `Exception in thread "main" java.lang.${err.javaType}: ${err.message}\n` +
        `\tat ${qualified}.main(${className}.java:${err.line})\n`;
      return {
        success: false,
        stdout: "",
        stderr,
        exitCode: 1,
        durationMs: Math.max(1, Date.now() - start),
        packageName,
        className,
        problems,
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      stdout: "",
      stderr: `Exception in thread "main" java.lang.RuntimeException: ${msg}\n`,
      exitCode: 1,
      durationMs: Math.max(1, Date.now() - start),
      packageName,
      className,
      problems,
    };
  }
}

export function formatJavaCode(code: string): string {
  const lines = code.split(/\r?\n/);
  const out: string[] = [];
  let indent = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      out.push("");
      continue;
    }
    if (trimmed.charAt(0) === "}") {
      indent = Math.max(0, indent - 1);
    }
    const tabs = new Array(indent + 1).join("\t");
    out.push(tabs + trimmed);
    // Adjust indent for trailing '{' (outside single-line comments)
    const commentIdx = trimmed.indexOf("//");
    const codePart = commentIdx !== -1 ? trimmed.slice(0, commentIdx).trim() : trimmed;
    if (codePart.length > 0 && codePart.charAt(codePart.length - 1) === "{") {
      indent += 1;
    }
  }

  return out.join("\n");
}
