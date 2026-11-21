import type { ColumnMeta, ColumnType, DataRow, MeasureDef } from "./types.ts";

type Scalar = string | number | boolean | null;

type TokenKind =
  | "number"
  | "string"
  | "bool"
  | "field"
  | "ident"
  | "op"
  | "lparen"
  | "rparen"
  | "comma";

interface Token {
  kind: TokenKind;
  value: string;
  pos: number;
}

type ExprNode =
  | { kind: "literal"; value: Scalar }
  | { kind: "field"; name: string }
  | { kind: "unary"; op: string; arg: ExprNode }
  | { kind: "binary"; op: string; left: ExprNode; right: ExprNode }
  | { kind: "call"; fn: string; args: ExprNode[] };

const KEYWORDS_LOGICAL = new Set(["AND", "OR", "NOT"]);

function findColumnCaseInsensitive(name: string, columns: ColumnMeta[]): string | undefined {
  const exact = columns.find((c) => c.name === name || c.label === name);
  if (exact) return exact.name;
  const lower = name.toLowerCase();
  const ci = columns.find((c) => c.name.toLowerCase() === lower || c.label.toLowerCase() === lower);
  return ci?.name;
}

function findMeasureCaseInsensitive(name: string, measures: MeasureDef[]): MeasureDef | undefined {
  const exact = measures.find((m) => m.name === name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  return measures.find((m) => m.name.toLowerCase() === lower);
}

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = formula.length;

  while (i < n) {
    const ch = formula[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Strip optional 'TableName'[Field] prefix
    if (ch === "'" && i + 1 < n) {
      let j = i + 1;
      while (j < n && formula[j] !== "'") j++;
      if (j + 1 < n && formula[j + 1] === "[") {
        i = j + 1;
        continue;
      }
      // Otherwise treat single-quoted string
      const strVal = formula.slice(i + 1, j);
      tokens.push({ kind: "string", value: strVal, pos: i });
      i = j + 1;
      continue;
    }

    // Quoted string "..."
    if (ch === '"') {
      let j = i + 1;
      let val = "";
      while (j < n) {
        if (formula[j] === '"' && formula[j + 1] === '"') {
          val += '"';
          j += 2;
        } else if (formula[j] === '"') {
          j++;
          break;
        } else {
          val += formula[j];
          j++;
        }
      }
      tokens.push({ kind: "string", value: val, pos: i });
      i = j;
      continue;
    }

    // Bracketed [Field Name]
    if (ch === "[") {
      const closeIdx = formula.indexOf("]", i + 1);
      if (closeIdx === -1) {
        throw new Error(`Unclosed bracket '[' at position ${i + 1}`);
      }
      const fieldName = formula.slice(i + 1, closeIdx).trim();
      if (!fieldName) {
        throw new Error(`Empty field reference '[]' at position ${i + 1}`);
      }
      tokens.push({ kind: "field", value: fieldName, pos: i });
      i = closeIdx + 1;
      continue;
    }

    // Number literal
    if (/[0-9]/.test(ch) || (ch === "." && i + 1 < n && /[0-9]/.test(formula[i + 1]))) {
      let j = i;
      let seenDot = false;
      while (j < n && (/[0-9]/.test(formula[j]) || (formula[j] === "." && !seenDot))) {
        if (formula[j] === ".") seenDot = true;
        j++;
      }
      tokens.push({ kind: "number", value: formula.slice(i, j), pos: i });
      i = j;
      continue;
    }

    // Punctuation
    if (ch === "(") {
      tokens.push({ kind: "lparen", value: "(", pos: i });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen", value: ")", pos: i });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ kind: "comma", value: ",", pos: i });
      i++;
      continue;
    }

    // Two-char operators
    const two = formula.slice(i, i + 2);
    if (
      two === "<=" ||
      two === ">=" ||
      two === "<>" ||
      two === "!=" ||
      two === "==" ||
      two === "&&" ||
      two === "||"
    ) {
      tokens.push({ kind: "op", value: two, pos: i });
      i += 2;
      continue;
    }

    // Single-char operators
    if ("+-*/=<>&!".indexOf(ch) !== -1) {
      tokens.push({ kind: "op", value: ch, pos: i });
      i++;
      continue;
    }

    // Identifiers & keywords
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_.]/.test(formula[j])) j++;
      const word = formula.slice(i, j);
      const upper = word.toUpperCase();
      if (formula[j] === "[") {
        // Sales[Region]: the table name only qualifies the column, which is looked up in the table the measure belongs to.
        i = j;
        continue;
      }
      if (upper === "TRUE" || upper === "FALSE") {
        tokens.push({ kind: "bool", value: upper, pos: i });
      } else if (KEYWORDS_LOGICAL.has(upper)) {
        tokens.push({ kind: "op", value: upper, pos: i });
      } else {
        tokens.push({ kind: "ident", value: word, pos: i });
      }
      i = j;
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at position ${i + 1}`);
  }

  return tokens;
}

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    const t = this.tokens[this.pos];
    this.pos++;
    return t;
  }

  parse(): ExprNode {
    if (this.tokens.length === 0) {
      throw new Error("Formula is empty.");
    }
    const expr = this.parseOr();
    if (this.pos < this.tokens.length) {
      const leftover = this.tokens[this.pos];
      throw new Error(`Unexpected token '${leftover.value}' at position ${leftover.pos + 1}`);
    }
    return expr;
  }

  private parseOr(): ExprNode {
    let left = this.parseAnd();
    while (
      this.peek()?.kind === "op" &&
      (this.peek()?.value === "||" || this.peek()?.value === "OR")
    ) {
      const op = this.consume().value;
      const right = this.parseAnd();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseAnd(): ExprNode {
    let left = this.parseNot();
    while (
      this.peek()?.kind === "op" &&
      (this.peek()?.value === "&&" || this.peek()?.value === "AND")
    ) {
      const op = this.consume().value;
      const right = this.parseNot();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseNot(): ExprNode {
    const tok = this.peek();
    if (tok?.kind === "op" && (tok.value === "NOT" || tok.value === "!")) {
      this.consume();
      return { kind: "unary", op: "NOT", arg: this.parseNot() };
    }
    return this.parseComparison();
  }

  private parseComparison(): ExprNode {
    let left = this.parseAdd();
    while (
      this.peek()?.kind === "op" &&
      ["=", "==", "<>", "!=", "<", ">", "<=", ">="].indexOf(this.peek()!.value) !== -1
    ) {
      const op = this.consume().value;
      const right = this.parseAdd();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseAdd(): ExprNode {
    let left = this.parseMul();
    while (
      this.peek()?.kind === "op" &&
      ["+", "-", "&"].indexOf(this.peek()!.value) !== -1
    ) {
      const op = this.consume().value;
      const right = this.parseMul();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseMul(): ExprNode {
    let left = this.parseUnary();
    while (
      this.peek()?.kind === "op" &&
      ["*", "/"].indexOf(this.peek()!.value) !== -1
    ) {
      const op = this.consume().value;
      const right = this.parseUnary();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseUnary(): ExprNode {
    const tok = this.peek();
    if (tok?.kind === "op" && (tok.value === "-" || tok.value === "+")) {
      this.consume();
      return { kind: "unary", op: tok.value, arg: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExprNode {
    const tok = this.peek();
    if (!tok) {
      throw new Error("Unexpected end of formula.");
    }

    if (tok.kind === "number") {
      this.consume();
      return { kind: "literal", value: Number(tok.value) };
    }
    if (tok.kind === "string") {
      this.consume();
      return { kind: "literal", value: tok.value };
    }
    if (tok.kind === "bool") {
      this.consume();
      return { kind: "literal", value: tok.value === "TRUE" };
    }
    if (tok.kind === "field") {
      this.consume();
      return { kind: "field", name: tok.value };
    }
    if (tok.kind === "lparen") {
      this.consume();
      const inner = this.parseOr();
      if (this.peek()?.kind !== "rparen") {
        throw new Error(`Expected ')' near position ${tok.pos + 1}`);
      }
      this.consume();
      return inner;
    }
    if (tok.kind === "ident") {
      this.consume();
      const upper = tok.value.toUpperCase();
      if (this.peek()?.kind === "lparen") {
        this.consume(); // '('
        const args: ExprNode[] = [];
        if (this.peek()?.kind !== "rparen") {
          args.push(this.parseOr());
          while (this.peek()?.kind === "comma") {
            this.consume();
            args.push(this.parseOr());
          }
        }
        if (this.peek()?.kind !== "rparen") {
          throw new Error(`Expected ')' after arguments to ${tok.value}(...)`);
        }
        this.consume();
        if (upper === "BLANK" && args.length === 0) {
          return { kind: "literal", value: null };
        }
        return { kind: "call", fn: upper, args };
      }
      if (upper === "NULL" || upper === "BLANK") {
        return { kind: "literal", value: null };
      }
      return { kind: "field", name: tok.value };
    }

    throw new Error(`Unexpected token '${tok.value}' at position ${tok.pos + 1}`);
  }
}

function parseFormulaAst(rawFormula: string): ExprNode {
  const trimmed = rawFormula.trim().replace(/^=\s*/, "");
  const tokens = tokenize(trimmed);
  return new Parser(tokens).parse();
}

function toNum(v: Scalar): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toBool(v: Scalar): boolean {
  if (v === null || v === undefined || v === "") return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0 && Number.isFinite(v);
  return String(v).toLowerCase() !== "false" && String(v) !== "0";
}

function compareScalars(a: Scalar, b: Scalar): number {
  const an = toNum(a);
  const bn = toNum(b);
  if (an !== null && bn !== null) {
    return an < bn ? -1 : an > bn ? 1 : 0;
  }
  const as = a === null ? "" : String(a);
  const bs = b === null ? "" : String(b);
  return as.localeCompare(bs);
}

function evalRowAst(node: ExprNode, row: DataRow, columns: ColumnMeta[]): Scalar {
  switch (node.kind) {
    case "literal":
      return node.value;
    case "field": {
      const colName = findColumnCaseInsensitive(node.name, columns);
      if (!colName) {
        throw new Error(`Unknown column '[${node.name}]'`);
      }
      const val = row[colName];
      return val === undefined ? null : val;
    }
    case "unary": {
      const v = evalRowAst(node.arg, row, columns);
      if (node.op === "NOT") return !toBool(v);
      const n = toNum(v);
      if (n === null) return null;
      return node.op === "-" ? -n : n;
    }
    case "binary": {
      const op = node.op;
      if (op === "&&" || op === "AND") {
        return toBool(evalRowAst(node.left, row, columns)) && toBool(evalRowAst(node.right, row, columns));
      }
      if (op === "||" || op === "OR") {
        return toBool(evalRowAst(node.left, row, columns)) || toBool(evalRowAst(node.right, row, columns));
      }
      const lv = evalRowAst(node.left, row, columns);
      const rv = evalRowAst(node.right, row, columns);
      if (op === "&") {
        return `${lv ?? ""}${rv ?? ""}`;
      }
      if (op === "=" || op === "==") {
        if (lv === null && rv === null) return true;
        if (lv === null || rv === null) return false;
        const ln = toNum(lv);
        const rn = toNum(rv);
        if (ln !== null && rn !== null) return ln === rn;
        return String(lv) === String(rv);
      }
      if (op === "<>" || op === "!=") {
        if (lv === null && rv === null) return false;
        if (lv === null || rv === null) return true;
        const ln = toNum(lv);
        const rn = toNum(rv);
        if (ln !== null && rn !== null) return ln !== rn;
        return String(lv) !== String(rv);
      }
      if (op === "<" || op === ">" || op === "<=" || op === ">=") {
        if (lv === null || rv === null) return false;
        const cmp = compareScalars(lv, rv);
        if (op === "<") return cmp < 0;
        if (op === ">") return cmp > 0;
        if (op === "<=") return cmp <= 0;
        return cmp >= 0;
      }

      const ln = toNum(lv);
      const rn = toNum(rv);
      if (ln === null || rn === null) return null;
      if (op === "+") return ln + rn;
      if (op === "-") return ln - rn;
      if (op === "*") return ln * rn;
      if (op === "/") return rn === 0 ? null : ln / rn;
      return null;
    }
    case "call": {
      const fn = node.fn;
      if (fn === "IF") {
        if (node.args.length < 2) throw new Error("IF requires at least 2 arguments");
        const cond = toBool(evalRowAst(node.args[0], row, columns));
        if (cond) return evalRowAst(node.args[1], row, columns);
        return node.args[2] ? evalRowAst(node.args[2], row, columns) : null;
      }
      if (fn === "AND") {
        return node.args.every((a) => toBool(evalRowAst(a, row, columns)));
      }
      if (fn === "OR") {
        return node.args.some((a) => toBool(evalRowAst(a, row, columns)));
      }
      if (fn === "NOT") {
        if (node.args.length !== 1) throw new Error("NOT requires 1 argument");
        return !toBool(evalRowAst(node.args[0], row, columns));
      }
      if (fn === "DIVIDE") {
        if (node.args.length < 2) throw new Error("DIVIDE requires 2 or 3 arguments");
        const num = toNum(evalRowAst(node.args[0], row, columns));
        const den = toNum(evalRowAst(node.args[1], row, columns));
        const alt = node.args[2] ? evalRowAst(node.args[2], row, columns) : null;
        if (num === null || den === null || den === 0) return alt;
        return num / den;
      }
      if (fn === "ROUND") {
        if (node.args.length < 1) throw new Error("ROUND requires 1 or 2 arguments");
        const v = toNum(evalRowAst(node.args[0], row, columns));
        const digits = node.args[1] ? toNum(evalRowAst(node.args[1], row, columns)) ?? 0 : 0;
        if (v === null) return null;
        const factor = Math.pow(10, Math.round(digits));
        return Math.round(v * factor) / factor;
      }
      if (fn === "ABS") {
        if (node.args.length !== 1) throw new Error("ABS requires 1 argument");
        const v = toNum(evalRowAst(node.args[0], row, columns));
        return v === null ? null : Math.abs(v);
      }
      if (fn === "UPPER" || fn === "LOWER" || fn === "LEN") {
        if (node.args.length !== 1) throw new Error(`${fn} requires 1 argument`);
        const v = evalRowAst(node.args[0], row, columns);
        const s = v === null ? "" : String(v);
        if (fn === "UPPER") return s.toUpperCase();
        if (fn === "LOWER") return s.toLowerCase();
        return s.length;
      }
      if (fn === "LEFT" || fn === "RIGHT") {
        if (node.args.length < 1) throw new Error(`${fn} requires 1 or 2 arguments`);
        const s = String(evalRowAst(node.args[0], row, columns) ?? "");
        const cnt = node.args[1] ? Math.max(0, Math.floor(toNum(evalRowAst(node.args[1], row, columns)) ?? 1)) : 1;
        return fn === "LEFT" ? s.slice(0, cnt) : s.slice(Math.max(0, s.length - cnt));
      }
      if (fn === "CONCAT" || fn === "CONCATENATE") {
        return node.args.map((a) => String(evalRowAst(a, row, columns) ?? "")).join("");
      }
      if (fn === "COALESCE") {
        for (let i = 0; i < node.args.length; i++) {
          const val = evalRowAst(node.args[i], row, columns);
          if (val !== null && val !== "") return val;
        }
        return null;
      }
      if (fn === "YEAR" || fn === "MONTH" || fn === "DAY") {
        if (node.args.length !== 1) throw new Error(`${fn} requires 1 argument`);
        const raw = evalRowAst(node.args[0], row, columns);
        if (!raw) return null;
        const dt = new Date(String(raw));
        if (Number.isNaN(dt.getTime())) return null;
        if (fn === "YEAR") return dt.getUTCFullYear();
        if (fn === "MONTH") return dt.getUTCMonth() + 1;
        return dt.getUTCDate();
      }
      throw new Error(`Unsupported row function '${fn}'.`);
    }
  }
}

export function evaluateCalculatedColumn(
  formula: string,
  rows: DataRow[],
  columns: ColumnMeta[],
): { values: Array<string | number | null>; inferredType: ColumnType; error?: string } {
  try {
    const ast = parseFormulaAst(formula);
    const values: Array<string | number | null> = [];
    let numCount = 0;
    let nonNullCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const res = evalRowAst(ast, rows[i], columns);
      if (res === null || res === undefined || res === "") {
        values.push(null);
      } else if (typeof res === "boolean") {
        values.push(res ? "True" : "False");
        nonNullCount++;
      } else if (typeof res === "number") {
        values.push(Number.isFinite(res) ? res : null);
        if (Number.isFinite(res)) {
          numCount++;
          nonNullCount++;
        }
      } else {
        values.push(res);
        nonNullCount++;
      }
    }

    const inferredType: ColumnType =
      nonNullCount > 0 && numCount === nonNullCount ? "number" : "text";
    return { values, inferredType };
  } catch (err) {
    return {
      values: rows.map(() => null),
      inferredType: "text",
      error: err instanceof Error ? err.message : "Invalid calculated column formula",
    };
  }
}

const AGG_FNS = new Set(["SUM", "AVERAGE", "AVG", "COUNT", "COUNTROWS", "DISTINCTCOUNT", "MIN", "MAX"]);
const ITERATOR_FNS = new Set(["SUMX", "AVERAGEX", "MINX", "MAXX", "COUNTX"]);

/**
 * The rows a measure sees. `rows` is the filter context of the cell being drawn (a visual's category, a card's whole data).
 * `scope` is the table after the report, page, slicer and cross filters but without the visual's own grouping, and `all` is the
 * whole table: CALCULATE needs them to replace or remove filters, as DAX does.
 */
export interface MeasureScope {
  scope: DataRow[];
  all: DataRow[];
  /** The columns that define the cell being drawn (a visual's category, legend, matrix row and column). Without them the cell is
   *  taken to be the whole scope. */
  groupBy?: string[];
}

interface MeasureCtx {
  rows: DataRow[];
  sc: MeasureScope;
}

function collectFields(node: ExprNode, out: Set<string>) {
  if (node.kind === "field") out.add(node.name);
  else if (node.kind === "unary") collectFields(node.arg, out);
  else if (node.kind === "binary") {
    collectFields(node.left, out);
    collectFields(node.right, out);
  } else if (node.kind === "call") node.args.forEach((a) => collectFields(a, out));
}

/** The rows a CALCULATE filter on `replaced` columns starts from: the context with the filters on those columns removed.
 *  The context is rebuilt from the columns that hold a single value in it (a visual's category); when it cannot be rebuilt
 *  that way the current rows are kept, so slicer selections are never lost. */
function widenContext(ctx: MeasureCtx, replaced: Set<string>, columns: ColumnMeta[]): DataRow[] {
  const base = ctx.sc.scope;
  const groupBy = (ctx.sc.groupBy ?? []).map((g) => findColumnCaseInsensitive(g, columns)).filter((g): g is string => Boolean(g));
  if (groupBy.length === 0 || ctx.rows.length === 0) return ctx.rows.length === base.length || groupBy.length === 0 ? base : ctx.rows;
  // The cell is fixed by its grouping columns. Dropping the ones CALCULATE names (and keeping the rest) gives the rows it starts from.
  const kept = groupBy.filter((c) => !replaced.has(c));
  const row = ctx.rows[0];
  return base.filter((r) => kept.every((c) => String(r[c]) === String(row[c])));
}

function isTableReference(node: ExprNode, columns: ColumnMeta[], measures: MeasureDef[]): boolean {
  return node.kind === "field" && !findColumnCaseInsensitive(node.name, columns) && !findMeasureCaseInsensitive(node.name, measures);
}

/** A table expression: the table name, FILTER(table, condition), ALL(...) or ALLSELECTED(...). */
function evalTable(node: ExprNode, ctx: MeasureCtx, columns: ColumnMeta[], measures: MeasureDef[]): DataRow[] {
  if (isTableReference(node, columns, measures)) return ctx.rows;
  if (node.kind === "call") {
    if (node.fn === "ALL" || node.fn === "REMOVEFILTERS") {
      const arg = node.args[0];
      if (arg && !isTableReference(arg, columns, measures)) return widenContext(ctx, new Set([findColumnCaseInsensitive((arg as { name: string }).name, columns) ?? ""]), columns);
      return ctx.sc.all;
    }
    if (node.fn === "ALLSELECTED") return ctx.sc.scope;
    if (node.fn === "FILTER") {
      if (node.args.length !== 2) throw new Error("FILTER takes a table and a condition: FILTER(Table, [Column] > 10)");
      const base = evalTable(node.args[0], ctx, columns, measures);
      return base.filter((row) => toBool(evalRowAst(node.args[1], row, columns)));
    }
  }
  throw new Error("A table is expected here: the table name, FILTER(...), ALL(...) or ALLSELECTED(...).");
}

function evalMeasureAst(
  node: ExprNode,
  ctx: MeasureCtx,
  columns: ColumnMeta[],
  measures: MeasureDef[],
  visited: string[],
): Scalar {
  const rows = ctx.rows;
  const again = (n: ExprNode, c: MeasureCtx = ctx) => evalMeasureAst(n, c, columns, measures, visited);
  switch (node.kind) {
    case "literal":
      return node.value;
    case "field": {
      const measure = findMeasureCaseInsensitive(node.name, measures);
      if (measure) {
        if (visited.indexOf(measure.name.toLowerCase()) !== -1) {
          throw new Error(`Circular reference detected in measure '[${measure.name}]'`);
        }
        const nestedAst = parseFormulaAst(measure.formula);
        return evalMeasureAst(nestedAst, ctx, columns, measures, [...visited, measure.name.toLowerCase()]);
      }
      throw new Error(
        `Column '[${node.name}]' cannot be referenced without an aggregation like SUM([${node.name}]) inside a measure.`,
      );
    }
    case "unary": {
      const v = again(node.arg);
      if (node.op === "NOT") return !toBool(v);
      const n = toNum(v);
      if (n === null) return null;
      return node.op === "-" ? -n : n;
    }
    case "binary": {
      const op = node.op;
      const lv = again(node.left);
      const rv = again(node.right);
      if (op === "&&" || op === "AND") return toBool(lv) && toBool(rv);
      if (op === "||" || op === "OR") return toBool(lv) || toBool(rv);
      if (op === "=" || op === "==") return compareScalars(lv, rv) === 0;
      if (op === "<>" || op === "!=") return compareScalars(lv, rv) !== 0;
      if (op === "<") return compareScalars(lv, rv) < 0;
      if (op === ">") return compareScalars(lv, rv) > 0;
      if (op === "<=") return compareScalars(lv, rv) <= 0;
      if (op === ">=") return compareScalars(lv, rv) >= 0;
      if (op === "&") return `${lv ?? ""}${rv ?? ""}`;

      const ln = toNum(lv);
      const rn = toNum(rv);
      if (ln === null || rn === null) return 0;
      if (op === "+") return ln + rn;
      if (op === "-") return ln - rn;
      if (op === "*") return ln * rn;
      if (op === "/") return rn === 0 ? 0 : ln / rn;
      return 0;
    }
    case "call": {
      const fn = node.fn;
      if (fn === "COUNTROWS") {
        if (node.args.length === 0) return rows.length;
        return evalTable(node.args[0], ctx, columns, measures).length;
      }
      if (fn === "CALCULATE") {
        if (node.args.length < 1) throw new Error("CALCULATE needs an expression: CALCULATE(SUM([Sales]), [Region] = \"North\")");
        let scoped = rows;
        const conditions: ExprNode[] = [];
        for (const filter of node.args.slice(1)) {
          const isTableFn = filter.kind === "call" && (filter.fn === "ALL" || filter.fn === "REMOVEFILTERS" || filter.fn === "ALLSELECTED" || filter.fn === "FILTER");
          if (isTableFn) scoped = evalTable(filter, { rows: scoped, sc: ctx.sc }, columns, measures);
          else conditions.push(filter);
        }
        if (conditions.length > 0) {
          // Column conditions replace any filter already on the columns they name (all of them together), then must all hold.
          const replaced = new Set<string>();
          conditions.forEach((condition) => {
            const used = new Set<string>();
            collectFields(condition, used);
            used.forEach((name) => {
              const col = findColumnCaseInsensitive(name, columns);
              if (col) replaced.add(col);
            });
          });
          const start = scoped === rows && replaced.size > 0 ? widenContext({ rows, sc: ctx.sc }, replaced, columns) : scoped;
          scoped = start.filter((row) => conditions.every((condition) => toBool(evalRowAst(condition, row, columns))));
        }
        return evalMeasureAst(node.args[0], { rows: scoped, sc: ctx.sc }, columns, measures, visited);
      }
      if (ITERATOR_FNS.has(fn)) {
        if (node.args.length !== 2) throw new Error(`${fn} takes a table and an expression: ${fn}(Table, [Price] * [Qty])`);
        const tableRows = evalTable(node.args[0], ctx, columns, measures);
        const picked: Scalar[] = tableRows.map((row) => evalRowAst(node.args[1], row, columns));
        if (fn === "COUNTX") return picked.filter((v) => v !== null && v !== undefined && v !== "").length;
        const nums = picked.map(toNum).filter((n): n is number => n !== null);
        if (nums.length === 0) return 0;
        if (fn === "SUMX") return nums.reduce((a, b) => a + b, 0);
        if (fn === "AVERAGEX") return nums.reduce((a, b) => a + b, 0) / nums.length;
        if (fn === "MINX") return Math.min(...nums);
        return Math.max(...nums);
      }
      if (AGG_FNS.has(fn)) {
        if (node.args.length !== 1) {
          throw new Error(`${fn} requires exactly 1 argument`);
        }
        const argNode = node.args[0];
        if (fn === "COUNT") {
          let cnt = 0;
          for (let i = 0; i < rows.length; i++) {
            const val = evalRowAst(argNode, rows[i], columns);
            if (val !== null && val !== undefined && val !== "") cnt++;
          }
          return cnt;
        }
        if (fn === "DISTINCTCOUNT") {
          const uniq = new Set<string>();
          for (let i = 0; i < rows.length; i++) {
            const val = evalRowAst(argNode, rows[i], columns);
            if (val !== null && val !== undefined && val !== "") {
              uniq.add(String(val));
            }
          }
          return uniq.size;
        }
        const nums: number[] = [];
        for (let i = 0; i < rows.length; i++) {
          const num = toNum(evalRowAst(argNode, rows[i], columns));
          if (num !== null) nums.push(num);
        }
        if (nums.length === 0) return 0;
        if (fn === "SUM") return nums.reduce((a, b) => a + b, 0);
        if (fn === "AVERAGE" || fn === "AVG") return nums.reduce((a, b) => a + b, 0) / nums.length;
        if (fn === "MIN") return Math.min(...nums);
        if (fn === "MAX") return Math.max(...nums);
      }

      if (fn === "DIVIDE") {
        if (node.args.length < 2) throw new Error("DIVIDE requires 2 or 3 arguments");
        const num = toNum(again(node.args[0]));
        const den = toNum(again(node.args[1]));
        const alt = node.args[2] ? toNum(again(node.args[2])) ?? 0 : 0;
        if (num === null || den === null || den === 0) return alt;
        return num / den;
      }
      if (fn === "IF") {
        if (node.args.length < 2) throw new Error("IF requires at least 2 arguments");
        const cond = toBool(again(node.args[0]));
        if (cond) return again(node.args[1]);
        return node.args[2] ? again(node.args[2]) : 0;
      }
      if (fn === "ROUND") {
        const v = toNum(again(node.args[0]));
        const d = node.args[1] ? toNum(again(node.args[1])) ?? 0 : 0;
        if (v === null) return 0;
        const factor = Math.pow(10, Math.round(d));
        return Math.round(v * factor) / factor;
      }
      if (fn === "ABS") {
        const v = toNum(again(node.args[0]));
        return v === null ? 0 : Math.abs(v);
      }
      if (fn === "SQRT") {
        const v = toNum(again(node.args[0]));
        return v === null || v < 0 ? 0 : Math.sqrt(v);
      }
      if (fn === "ISBLANK") {
        const v = again(node.args[0]);
        return v === null || v === undefined || v === "";
      }
      throw new Error(`Unsupported measure function '${fn}'.`);
    }
  }
}

export function evaluateMeasure(
  formula: string,
  rows: DataRow[],
  columns: ColumnMeta[],
  measures: MeasureDef[] = [],
  visited: string[] = [],
  scope?: MeasureScope,
): { value: number; error?: string } {
  try {
    const ast = parseFormulaAst(formula);
    const res = evalMeasureAst(ast, { rows, sc: scope ?? { scope: rows, all: rows } }, columns, measures, visited);
    const num = toNum(res);
    return { value: num ?? 0 };
  } catch (err) {
    return {
      value: 0,
      error: err instanceof Error ? err.message : "Invalid measure formula",
    };
  }
}

export function validateFormula(
  formula: string,
  mode: "column" | "measure",
  rows: DataRow[],
  columns: ColumnMeta[],
  measures: MeasureDef[] = [],
): { ok: boolean; error?: string; preview?: string } {
  if (!formula.trim()) {
    return { ok: false, error: "Enter a formula (e.g. SUM([revenue])). " };
  }
  if (mode === "column") {
    const res = evaluateCalculatedColumn(formula, rows.slice(0, 5), columns);
    if (res.error) return { ok: false, error: res.error };
    const first = res.values.find((v) => v !== null && v !== "");
    return {
      ok: true,
      preview: first !== undefined ? `Sample row -> ${String(first)}` : "Valid formula (blank sample)",
    };
  }
  const res = evaluateMeasure(formula, rows, columns, measures);
  if (res.error) return { ok: false, error: res.error };
  return {
    ok: true,
    preview: `Result -> ${Number.isInteger(res.value) ? res.value.toLocaleString("en-US") : res.value.toFixed(2)}`,
  };
}
