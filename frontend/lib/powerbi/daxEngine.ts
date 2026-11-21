/**
 * A small DAX evaluator for the Power BI studio: the subset used in undergraduate BI labs, computed from the loaded rows.
 *
 * Queries:   EVALUATE ROW("Name", expr, ...)
 *            EVALUATE SUMMARIZECOLUMNS('T'[col], ..., "Name", expr, ...) [ORDER BY ... [ASC|DESC]]
 *            EVALUATE 'T'      EVALUATE FILTER('T', condition)      EVALUATE TOPN(n, 'T', 'T'[col], DESC)
 *            DEFINE MEASURE 'T'[Name] = expr ... EVALUATE ...
 * Scalars:   SUM AVERAGE MIN MAX COUNT COUNTA COUNTROWS DISTINCTCOUNT DIVIDE CALCULATE IF ROUND ABS BLANK
 *            SUMX/AVERAGEX('T', row expression), arithmetic, comparisons, && || NOT, measure references [Name].
 * Anything outside the subset is reported as an error; nothing is ever made up.
 */
import type { DataRow } from "./types";

export class DaxError extends Error {}

type Token = { kind: "num" | "str" | "ident" | "col" | "table" | "op" | "eof"; value: string; table?: string };

const KEYWORDS = new Set(["EVALUATE", "DEFINE", "MEASURE", "ORDER", "BY", "ASC", "DESC", "VAR", "RETURN"]);

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (text.startsWith("//", i) || text.startsWith("--", i)) {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 2;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(text[i + 1] ?? ""))) {
      const m = /^[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/.exec(text.slice(i))!;
      tokens.push({ kind: "num", value: m[0] });
      i += m[0].length;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      let out = "";
      while (j < text.length) {
        if (text[j] === '"' && text[j + 1] === '"') {
          out += '"';
          j += 2;
        } else if (text[j] === '"') break;
        else out += text[j++];
      }
      if (j >= text.length) throw new DaxError("A text value is missing its closing quote.");
      tokens.push({ kind: "str", value: out });
      i = j + 1;
      continue;
    }
    if (ch === "'" || /[A-Za-z_]/.test(ch)) {
      // 'Table'[Column], Table[Column], 'Table', FUNCTION or keyword
      let name = "";
      let quoted = false;
      if (ch === "'") {
        const end = text.indexOf("'", i + 1);
        if (end < 0) throw new DaxError("A table name is missing its closing quote.");
        name = text.slice(i + 1, end);
        i = end + 1;
        quoted = true;
      } else {
        const m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(text.slice(i))!;
        name = m[0];
        i += name.length;
      }
      if (text[i] === "[") {
        const end = text.indexOf("]", i);
        if (end < 0) throw new DaxError("A column reference is missing its closing bracket.");
        tokens.push({ kind: "col", value: text.slice(i + 1, end), table: name });
        i = end + 1;
        continue;
      }
      if (quoted) tokens.push({ kind: "table", value: name });
      else tokens.push({ kind: "ident", value: name });
      continue;
    }
    if (ch === "[") {
      const end = text.indexOf("]", i);
      if (end < 0) throw new DaxError("A column or measure reference is missing its closing bracket.");
      tokens.push({ kind: "col", value: text.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    const two = text.slice(i, i + 2);
    if (["<=", ">=", "<>", "&&", "||"].includes(two)) {
      tokens.push({ kind: "op", value: two });
      i += 2;
      continue;
    }
    if ("+-*/(),=<>&^".includes(ch)) {
      tokens.push({ kind: "op", value: ch });
      i++;
      continue;
    }
    throw new DaxError(`The character "${ch}" is not valid here.`);
  }
  tokens.push({ kind: "eof", value: "" });
  return tokens;
}

// --------------------------------------------------------------------------------------- expression tree
type Node =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "blank" }
  | { t: "col"; table?: string; name: string }
  | { t: "table"; name: string }
  | { t: "call"; name: string; args: Node[] }
  | { t: "bin"; op: string; a: Node; b: Node }
  | { t: "neg"; a: Node }
  | { t: "not"; a: Node };

class Parser {
  i = 0;
  constructor(private tokens: Token[]) {}
  peek() {
    return this.tokens[this.i];
  }
  take() {
    return this.tokens[this.i++];
  }
  isOp(v: string) {
    const t = this.peek();
    return t.kind === "op" && t.value === v;
  }
  isWord(v: string) {
    const t = this.peek();
    return t.kind === "ident" && t.value.toUpperCase() === v;
  }
  expectOp(v: string) {
    if (!this.isOp(v)) throw new DaxError(`Expected "${v}" but found "${this.peek().value || "end of query"}".`);
    this.take();
  }
  expression(): Node {
    return this.or();
  }
  or(): Node {
    let left = this.and();
    while (this.isOp("||")) {
      this.take();
      left = { t: "bin", op: "||", a: left, b: this.and() };
    }
    return left;
  }
  and(): Node {
    let left = this.comparison();
    while (this.isOp("&&")) {
      this.take();
      left = { t: "bin", op: "&&", a: left, b: this.comparison() };
    }
    return left;
  }
  comparison(): Node {
    let left = this.concat();
    while (["=", "<>", "<", ">", "<=", ">="].some((o) => this.isOp(o))) {
      const op = this.take().value;
      left = { t: "bin", op, a: left, b: this.concat() };
    }
    return left;
  }
  concat(): Node {
    let left = this.additive();
    while (this.isOp("&")) {
      this.take();
      left = { t: "bin", op: "&", a: left, b: this.additive() };
    }
    return left;
  }
  additive(): Node {
    let left = this.term();
    while (this.isOp("+") || this.isOp("-")) {
      const op = this.take().value;
      left = { t: "bin", op, a: left, b: this.term() };
    }
    return left;
  }
  term(): Node {
    let left = this.power();
    while (this.isOp("*") || this.isOp("/")) {
      const op = this.take().value;
      left = { t: "bin", op, a: left, b: this.power() };
    }
    return left;
  }
  power(): Node {
    const base = this.unary();
    if (this.isOp("^")) {
      this.take();
      return { t: "bin", op: "^", a: base, b: this.power() };
    }
    return base;
  }
  unary(): Node {
    if (this.isOp("-")) {
      this.take();
      return { t: "neg", a: this.unary() };
    }
    if (this.isOp("+")) {
      this.take();
      return this.unary();
    }
    if (this.isWord("NOT")) {
      this.take();
      return { t: "not", a: this.unary() };
    }
    return this.primary();
  }
  primary(): Node {
    const tok = this.take();
    if (tok.kind === "num") return { t: "num", v: Number(tok.value) };
    if (tok.kind === "str") return { t: "str", v: tok.value };
    if (tok.kind === "col") return { t: "col", table: tok.table, name: tok.value };
    if (tok.kind === "table") return { t: "table", name: tok.value };
    if (tok.kind === "op" && tok.value === "(") {
      const inner = this.expression();
      this.expectOp(")");
      return inner;
    }
    if (tok.kind === "ident") {
      const upper = tok.value.toUpperCase();
      if (upper === "TRUE" || upper === "FALSE") {
        if (this.isOp("(")) {
          this.take();
          this.expectOp(")");
        }
        return { t: "num", v: upper === "TRUE" ? 1 : 0 };
      }
      if (this.isOp("(")) {
        this.take();
        const args: Node[] = [];
        if (!this.isOp(")")) {
          args.push(this.expression());
          while (this.isOp(",")) {
            this.take();
            args.push(this.expression());
          }
        }
        this.expectOp(")");
        if (upper === "BLANK") return { t: "blank" };
        return { t: "call", name: upper, args };
      }
      if (KEYWORDS.has(upper)) throw new DaxError(`"${tok.value}" cannot be used here.`);
      return { t: "table", name: tok.value };
    }
    throw new DaxError(tok.kind === "eof" ? "The expression ends too early." : `"${tok.value}" was not expected here.`);
  }
}

// --------------------------------------------------------------------------------------- evaluation
export interface DaxModel {
  table: string;
  columns: string[];
  rows: DataRow[];
  measures: Record<string, string>;
}

type Value = number | string | null;
type Context = { rows: DataRow[]; row?: DataRow; depth: number };

function resolveColumn(model: DaxModel, node: { table?: string; name: string }): string {
  if (node.table && node.table.toLowerCase() !== model.table.toLowerCase()) {
    throw new DaxError(`There is no table named '${node.table}'. The loaded table is '${model.table}'.`);
  }
  const hit = model.columns.find((c) => c.toLowerCase() === node.name.toLowerCase());
  if (!hit) throw new DaxError(`The column '${model.table}'[${node.name}] does not exist.`);
  return hit;
}

function measureName(model: DaxModel, name: string): string | null {
  return Object.keys(model.measures).find((m) => m.toLowerCase() === name.toLowerCase()) ?? null;
}

function num(v: Value): number {
  if (v === null || v === "") return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n)) throw new DaxError(`Cannot convert the text "${v}" to a number.`);
  return n;
}

function truthy(v: Value): boolean {
  if (v === null) return false;
  if (typeof v === "number") return v !== 0;
  return v !== "";
}

function tableRows(model: DaxModel, node: Node, ctx: Context): DataRow[] {
  if (node.t === "table") {
    if (node.name.toLowerCase() !== model.table.toLowerCase()) throw new DaxError(`There is no table named '${node.name}'.`);
    return ctx.rows;
  }
  if (node.t === "call" && node.name === "FILTER") {
    if (node.args.length !== 2) throw new DaxError("FILTER takes a table and a condition.");
    const base = tableRows(model, node.args[0], ctx);
    return base.filter((row) => truthy(evaluate(model, node.args[1], { rows: [row], row, depth: ctx.depth })));
  }
  if (node.t === "call" && node.name === "ALL") return model.rows;
  throw new DaxError("A table is expected here (the table name, FILTER(...) or ALL(...)).");
}

function columnValues(model: DaxModel, node: Node, ctx: Context): Value[] {
  if (node.t !== "col") throw new DaxError("A column reference such as 'Table'[Column] is expected here.");
  if (!node.table && measureName(model, node.name)) throw new DaxError(`[${node.name}] is a measure; aggregate a column here.`);
  const col = resolveColumn(model, node);
  return ctx.rows.map((r) => (r[col] === undefined ? null : (r[col] as Value)));
}

function aggregate(fn: string, values: number[]): number | null {
  if (!values.length) return null;
  switch (fn) {
    case "SUM":
      return values.reduce((a, b) => a + b, 0);
    case "AVERAGE":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "MIN":
      return Math.min(...values);
    case "MAX":
      return Math.max(...values);
    default:
      return null;
  }
}

export function evaluate(model: DaxModel, node: Node, ctx: Context): Value {
  if (ctx.depth > 40) throw new DaxError("The measures refer to each other in a loop.");
  switch (node.t) {
    case "num":
      return node.v;
    case "str":
      return node.v;
    case "blank":
      return null;
    case "neg":
      return -num(evaluate(model, node.a, ctx));
    case "not":
      return truthy(evaluate(model, node.a, ctx)) ? 0 : 1;
    case "col": {
      const measure = !node.table ? measureName(model, node.name) : null;
      if (measure) return evaluate(model, parseExpression(model.measures[measure]), { rows: ctx.rows, depth: ctx.depth + 1 });
      const col = resolveColumn(model, node);
      if (!ctx.row) throw new DaxError(`A single value for column '${col}' cannot be determined. Wrap it in an aggregation such as SUM.`);
      return (ctx.row[col] as Value) ?? null;
    }
    case "table":
      throw new DaxError(`The table '${node.name}' cannot be used as a single value.`);
    case "bin": {
      if (node.op === "&&") return truthy(evaluate(model, node.a, ctx)) && truthy(evaluate(model, node.b, ctx)) ? 1 : 0;
      if (node.op === "||") return truthy(evaluate(model, node.a, ctx)) || truthy(evaluate(model, node.b, ctx)) ? 1 : 0;
      const a = evaluate(model, node.a, ctx);
      const b = evaluate(model, node.b, ctx);
      if (node.op === "&") return `${a ?? ""}${b ?? ""}`;
      if (["=", "<>", "<", ">", "<=", ">="].includes(node.op)) {
        const textual = typeof a === "string" && typeof b === "string" && !(Number.isFinite(Number(a)) && Number.isFinite(Number(b)));
        const x = textual ? String(a).toLowerCase() : num(a);
        const y = textual ? String(b).toLowerCase() : num(b);
        const r = node.op === "=" ? x === y : node.op === "<>" ? x !== y : node.op === "<" ? x < y : node.op === ">" ? x > y : node.op === "<=" ? x <= y : x >= y;
        return r ? 1 : 0;
      }
      if (a === null && b === null) return null;
      const x = num(a);
      const y = num(b);
      if (node.op === "+") return x + y;
      if (node.op === "-") return x - y;
      if (node.op === "*") return x * y;
      if (node.op === "^") return Math.pow(x, y);
      return x / y;                                     // like DAX: 1/0 is Infinity; DIVIDE() returns BLANK instead
    }
    case "call":
      return call(model, node, ctx);
  }
}

function call(model: DaxModel, node: { name: string; args: Node[] }, ctx: Context): Value {
  const { name, args } = node;
  const need = (n: number) => {
    if (args.length < n) throw new DaxError(`${name} needs ${n} argument${n === 1 ? "" : "s"}.`);
  };
  switch (name) {
    case "SUM":
    case "AVERAGE":
    case "MIN":
    case "MAX": {
      need(1);
      if (args.length === 2 && (name === "MIN" || name === "MAX")) {
        const x = num(evaluate(model, args[0], ctx));
        const y = num(evaluate(model, args[1], ctx));
        return name === "MIN" ? Math.min(x, y) : Math.max(x, y);
      }
      const values = columnValues(model, args[0], ctx).filter((v) => v !== null && v !== "").map(num);
      return aggregate(name, values);
    }
    case "COUNT":
    case "COUNTA": {
      need(1);
      const values = columnValues(model, args[0], ctx).filter((v) => v !== null && v !== "");
      return name === "COUNT" ? values.filter((v) => Number.isFinite(Number(v))).length : values.length;
    }
    case "DISTINCTCOUNT": {
      need(1);
      return new Set(columnValues(model, args[0], ctx).map((v) => String(v))).size;
    }
    case "COUNTROWS":
      need(1);
      return tableRows(model, args[0], ctx).length;
    case "SUMX":
    case "AVERAGEX":
    case "MINX":
    case "MAXX": {
      need(2);
      const rows = tableRows(model, args[0], ctx);
      const values = rows.map((row) => num(evaluate(model, args[1], { rows: [row], row, depth: ctx.depth })));
      return aggregate(name.slice(0, -1), values);
    }
    case "DIVIDE": {
      need(2);
      const a = evaluate(model, args[0], ctx);
      const b = num(evaluate(model, args[1], ctx));
      if (b === 0) return args[2] ? evaluate(model, args[2], ctx) : null;
      return a === null ? null : num(a) / b;
    }
    case "CALCULATE": {
      need(1);
      let rows = ctx.rows;
      for (const filter of args.slice(1)) {
        if (filter.t === "call" && filter.name === "ALL") {
          rows = model.rows;
          continue;
        }
        // A column condition replaces any existing filter on that column, as CALCULATE does.
        const cols = new Set<string>();
        const collect = (n: Node) => {
          if (n.t === "col" && (n.table || !measureName(model, n.name))) cols.add(resolveColumn(model, n));
          if (n.t === "bin") {
            collect(n.a);
            collect(n.b);
          }
          if (n.t === "not" || n.t === "neg") collect(n.a);
        };
        collect(filter);
        const base = cols.size ? widen(model, rows, cols) : rows;
        rows = base.filter((row) => truthy(evaluate(model, filter, { rows: [row], row, depth: ctx.depth })));
      }
      return evaluate(model, args[0], { rows, depth: ctx.depth + 1 });
    }
    case "IF": {
      need(2);
      return truthy(evaluate(model, args[0], ctx)) ? evaluate(model, args[1], ctx) : args[2] ? evaluate(model, args[2], ctx) : null;
    }
    case "ROUND": {
      need(1);
      const digits = args[1] ? num(evaluate(model, args[1], ctx)) : 0;
      const f = Math.pow(10, digits);
      return Math.round(num(evaluate(model, args[0], ctx)) * f) / f;
    }
    case "ABS":
      need(1);
      return Math.abs(num(evaluate(model, args[0], ctx)));
    case "SQRT":
      need(1);
      return Math.sqrt(num(evaluate(model, args[0], ctx)));
    case "ISBLANK":
      need(1);
      return evaluate(model, args[0], ctx) === null ? 1 : 0;
    default:
      throw new DaxError(`The function ${name} is not supported in this studio. Supported: SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, COUNTROWS, DISTINCTCOUNT, SUMX, AVERAGEX, DIVIDE, CALCULATE, FILTER, ALL, IF, ROUND, ABS, SQRT, ISBLANK, BLANK.`);
  }
}

/** The rows a CALCULATE filter on `replaced` columns starts from: the current context with the filters on those columns removed.
 * The context is rebuilt from the columns that hold a single value in it (a visual's category or a SUMMARIZECOLUMNS group);
 * when the context cannot be rebuilt that way, the current rows are kept, so slicer selections are never lost. */
function widen(model: DaxModel, contextRows: DataRow[], replaced: Set<string>): DataRow[] {
  if (contextRows.length === model.rows.length) return model.rows;
  const single = (c: string) => new Set(contextRows.map((r) => String(r[c]))).size <= 1;
  const keys = model.columns.filter((c) => !replaced.has(c) && single(c));
  if (!keys.length) return Array.from(replaced).every(single) ? model.rows : contextRows;
  return model.rows.filter((r) => keys.every((c) => String(r[c]) === String(contextRows[0][c])));
}

export function parseExpression(text: string): Node {
  const parser = new Parser(tokenize(text));
  const node = parser.expression();
  if (parser.peek().kind !== "eof") throw new DaxError(`"${parser.peek().value}" was not expected after the expression.`);
  return node;
}

/** Value of a measure over a set of rows (a visual's filter context). Returns null for BLANK. */
export function evaluateMeasure(model: DaxModel, name: string, rows: DataRow[]): number | null {
  const key = measureName(model, name);
  if (!key) return null;
  const value = evaluate(model, parseExpression(model.measures[key]), { rows, depth: 0 });
  return value === null ? null : num(value);
}

/** "Margin % = DIVIDE(...)" from the New measure bar: the measure's name and expression. */
export function parseMeasureDefinition(text: string, model: DaxModel): { name: string; expression: string } {
  const m = /^\s*([^=]+?)\s*=\s*([\s\S]+)$/.exec(text);
  if (!m) throw new DaxError('Write the measure as  Name = expression, for example  Margin % = DIVIDE(SUM(sales[profit]), SUM(sales[revenue]))');
  const name = m[1].replace(/^\[|\]$/g, "").trim();
  if (!name) throw new DaxError("The measure needs a name before the = sign.");
  if (model.columns.some((c) => c.toLowerCase() === name.toLowerCase())) throw new DaxError(`"${name}" is already a column name.`);
  const expression = m[2].trim();
  const probe: DaxModel = { ...model, measures: { ...model.measures, [name]: expression } };
  evaluate(probe, parseExpression(expression), { rows: model.rows, depth: 0 });        // validate now, so errors show at once
  return { name, expression };
}

export interface DaxResult {
  columns: string[];
  rows: Value[][];
}

/** Run an EVALUATE query against the model. */
export function runQuery(text: string, model: DaxModel): DaxResult {
  const tokens = tokenize(text);
  const p = new Parser(tokens);
  const local: DaxModel = { ...model, measures: { ...model.measures } };
  if (p.isWord("DEFINE")) {
    p.take();
    while (p.isWord("MEASURE")) {
      p.take();
      const ref = p.take();
      if (ref.kind !== "col") throw new DaxError("Write  MEASURE 'Table'[Name] = expression.");
      p.expectOp("=");
      const start = p.i;
      p.expression();
      const exprText = tokensToText(tokens.slice(start, p.i));
      local.measures[ref.value] = exprText;
    }
  }
  if (!p.isWord("EVALUATE")) throw new DaxError("A DAX query starts with EVALUATE (optionally after DEFINE MEASURE ...).");
  p.take();
  const tableExpr = p.expression();
  let order: { key: Node; desc: boolean }[] = [];
  if (p.isWord("ORDER")) {
    p.take();
    if (!p.isWord("BY")) throw new DaxError("Expected BY after ORDER.");
    p.take();
    do {
      if (p.isOp(",")) p.take();
      const key = p.expression();
      let desc = false;
      if (p.isWord("DESC") || p.isWord("ASC")) desc = p.take().value.toUpperCase() === "DESC";
      order.push({ key, desc });
    } while (p.isOp(","));
  }
  if (p.peek().kind !== "eof") throw new DaxError(`"${p.peek().value}" was not expected here.`);
  const result = evaluateTable(local, tableExpr);
  if (order.length) {
    const index = (key: Node) => {
      const label = key.t === "col" ? key.name : key.t === "str" ? key.v : "";
      const i = result.columns.findIndex((c) => c.toLowerCase() === label.toLowerCase() || c.toLowerCase().endsWith(`[${label.toLowerCase()}]`));
      if (i < 0) throw new DaxError(`ORDER BY refers to "${label}", which is not a column of the result.`);
      return i;
    };
    const keys = order.map((o) => ({ i: index(o.key), desc: o.desc }));
    result.rows.sort((a, b) => {
      for (const k of keys) {
        const x = a[k.i];
        const y = b[k.i];
        const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true });
        if (cmp) return k.desc ? -cmp : cmp;
      }
      return 0;
    });
  }
  return result;
}

function tokensToText(tokens: Token[]): string {
  return tokens
    .map((t) => (t.kind === "str" ? `"${t.value.replace(/"/g, '""')}"` : t.kind === "col" ? `${t.table ? `'${t.table}'` : ""}[${t.value}]` : t.kind === "table" ? `'${t.value}'` : t.value))
    .join(" ");
}

function evaluateTable(model: DaxModel, node: Node): DaxResult {
  const all: Context = { rows: model.rows, depth: 0 };
  if (node.t === "table" || (node.t === "call" && (node.name === "FILTER" || node.name === "ALL"))) {
    const rows = tableRows(model, node, all);
    return { columns: model.columns.map((c) => `${model.table}[${c}]`), rows: rows.slice(0, 500).map((r) => model.columns.map((c) => (r[c] as Value) ?? null)) };
  }
  if (node.t === "call" && node.name === "ROW") {
    if (!node.args.length || node.args.length % 2) throw new DaxError('ROW takes pairs of "Name", expression.');
    const columns: string[] = [];
    const values: Value[] = [];
    for (let i = 0; i < node.args.length; i += 2) {
      const label = node.args[i];
      if (label.t !== "str") throw new DaxError('Each ROW column needs a quoted name, for example ROW("Total", SUM(t[x])).');
      columns.push(`[${label.v}]`);
      values.push(evaluate(model, node.args[i + 1], all));
    }
    return { columns, rows: [values] };
  }
  if (node.t === "call" && node.name === "SUMMARIZECOLUMNS") {
    const groupCols: string[] = [];
    let i = 0;
    while (i < node.args.length && node.args[i].t === "col") {
      groupCols.push(resolveColumn(model, node.args[i] as { table?: string; name: string }));
      i++;
    }
    const measures: { label: string; expr: Node }[] = [];
    for (; i < node.args.length; i += 2) {
      const label = node.args[i];
      if (label.t !== "str" || !node.args[i + 1]) throw new DaxError('After the grouping columns, SUMMARIZECOLUMNS takes pairs of "Name", expression.');
      measures.push({ label: label.v, expr: node.args[i + 1] });
    }
    const groups = new Map<string, DataRow[]>();
    for (const row of model.rows) {
      const key = groupCols.map((c) => String(row[c] ?? "")).join("\u0001");
      const list = groups.get(key);
      if (list) list.push(row);
      else groups.set(key, [row]);
    }
    if (!groupCols.length) groups.set("", model.rows);
    const rows: Value[][] = [];
    for (const groupRows of Array.from(groups.values())) {
      const values = measures.map((m) => evaluate(model, m.expr, { rows: groupRows, depth: 0 }));
      if (measures.length && values.every((v) => v === null)) continue;          // SUMMARIZECOLUMNS drops all-blank rows
      rows.push([...groupCols.map((c) => (groupRows[0][c] as Value) ?? null), ...values]);
    }
    return { columns: [...groupCols.map((c) => `${model.table}[${c}]`), ...measures.map((m) => `[${m.label}]`)], rows };
  }
  if (node.t === "call" && node.name === "TOPN") {
    if (node.args.length < 2) throw new DaxError("TOPN takes a count, a table and an order expression.");
    const n = num(evaluate(model, node.args[0], all));
    const base = evaluateTable(model, node.args[1]);
    if (node.args[2]) {
      const desc = !(node.args[3] && node.args[3].t === "table" && node.args[3].name.toUpperCase() === "ASC");
      const rowsRaw = tableRows(model, node.args[1], all);
      const scored = rowsRaw.map((row, idx) => ({ idx, v: num(evaluate(model, node.args[2], { rows: [row], row, depth: 0 })) }));
      scored.sort((a, b) => (desc ? b.v - a.v : a.v - b.v));
      return { columns: base.columns, rows: scored.slice(0, n).map((s) => base.rows[s.idx]) };
    }
    return { columns: base.columns, rows: base.rows.slice(0, n) };
  }
  // A scalar after EVALUATE is an error in DAX; say so plainly.
  throw new DaxError("EVALUATE needs a table: the table name, ROW(...), SUMMARIZECOLUMNS(...), FILTER(...) or TOPN(...).");
}
