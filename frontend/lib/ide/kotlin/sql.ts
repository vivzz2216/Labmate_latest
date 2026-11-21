/** A small in-memory SQL engine behind the Android SQLiteDatabase emulation: CREATE/DROP TABLE, INSERT, SELECT (columns, *, COUNT/SUM/AVG/MIN/MAX,
 *  WHERE, ORDER BY, LIMIT), UPDATE, DELETE. It is not SQLite: anything outside this subset raises SqlError("... not supported"). */

export class SqlError extends Error {
  kind: string;
  constructor(message: string, kind = "SQLiteException") {
    super(message);
    this.kind = kind;
    Object.setPrototypeOf(this, SqlError.prototype);
  }
}

interface Column {
  name: string;
  type: string;
  pk: boolean;
  auto: boolean;
  notNull: boolean;
  unique: boolean;
}
interface Table {
  name: string;
  cols: Column[];
  rows: any[][];
  nextId: number;
}
export interface ResultSet {
  columns: string[];
  rows: any[][];
}

type Tok = { k: "id" | "num" | "str" | "op" | "param"; v: string };

function lex(sql: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < sql.length) {
    const c = sql.charAt(i);
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "'") {
      let s = "";
      i++;
      while (i < sql.length && !(sql.charAt(i) === "'" && sql.charAt(i + 1) !== "'")) {
        if (sql.charAt(i) === "'" && sql.charAt(i + 1) === "'") {
          s += "'";
          i += 2;
        } else s += sql.charAt(i++);
      }
      if (i >= sql.length) throw new SqlError('unrecognized token: "\'' + s + '" (code 1 SQLITE_ERROR)');
      i++;
      out.push({ k: "str", v: s });
      continue;
    }
    if (c === '"' || c === "`" || c === "[") {
      const close = c === "[" ? "]" : c;
      let j = i + 1;
      while (j < sql.length && sql.charAt(j) !== close) j++;
      out.push({ k: "id", v: sql.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(sql.charAt(i + 1)))) {
      let j = i;
      while (j < sql.length && /[0-9.]/.test(sql.charAt(j))) j++;
      out.push({ k: "num", v: sql.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < sql.length && /[A-Za-z0-9_$]/.test(sql.charAt(j))) j++;
      out.push({ k: "id", v: sql.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "?") {
      out.push({ k: "param", v: "?" });
      i++;
      continue;
    }
    const two = sql.substr(i, 2);
    if (["<=", ">=", "<>", "!=", "||"].indexOf(two) >= 0) {
      out.push({ k: "op", v: two });
      i += 2;
      continue;
    }
    if ("(),*=<>+-/;.%".indexOf(c) >= 0) {
      out.push({ k: "op", v: c });
      i++;
      continue;
    }
    throw new SqlError('unrecognized token: "' + c + '" (code 1 SQLITE_ERROR)');
  }
  return out;
}

class P {
  t: Tok[];
  i = 0;
  params: any[];
  pi = 0;
  sql: string;
  constructor(sql: string, params: any[]) {
    this.sql = sql;
    this.t = lex(sql);
    this.params = params;
  }
  get cur(): Tok | undefined {
    return this.t[this.i];
  }
  kw(w: string): boolean {
    const c = this.cur;
    return !!c && c.k === "id" && c.v.toUpperCase() === w;
  }
  accept(w: string): boolean {
    if (this.kw(w)) {
      this.i++;
      return true;
    }
    return false;
  }
  acceptOp(o: string): boolean {
    const c = this.cur;
    if (c && c.k === "op" && c.v === o) {
      this.i++;
      return true;
    }
    return false;
  }
  fail(near?: string): never {
    const c = this.cur;
    throw new SqlError('near "' + (near || (c ? c.v : "")) + '": syntax error (code 1 SQLITE_ERROR): , while compiling: ' + this.sql);
  }
  expect(w: string): void {
    if (!this.accept(w)) this.fail();
  }
  expectOp(o: string): void {
    if (!this.acceptOp(o)) this.fail();
  }
  ident(): string {
    const c = this.cur;
    if (!c || c.k !== "id") this.fail();
    this.i++;
    return c!.v;
  }
}

function typeAffinity(ty: string): string {
  const t = ty.toUpperCase();
  if (t.indexOf("INT") >= 0) return "INTEGER";
  if (/CHAR|CLOB|TEXT/.test(t)) return "TEXT";
  if (/REAL|FLOA|DOUB/.test(t)) return "REAL";
  return t || "BLOB";
}
function coerce(v: any, ty: string): any {
  if (v === null || v === undefined) return null;
  if (ty === "INTEGER" && typeof v === "string" && /^-?\d+$/.test(v.trim())) return parseInt(v, 10);
  if (ty === "REAL" && typeof v === "string" && !isNaN(parseFloat(v)) && /^-?[\d.]+$/.test(v.trim())) return parseFloat(v);
  if (ty === "TEXT" && typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

type Expr = (row: any[], t: Table | null) => any;

export class Database {
  tables: { [n: string]: Table } = {};
  inTx = false;

  private table(name: string): Table {
    const t = this.tables[name.toLowerCase()];
    if (!t) throw new SqlError("no such table: " + name + " (code 1 SQLITE_ERROR)");
    return t;
  }
  private colIndex(t: Table, n: string): number {
    const i = t.cols.findIndex((c) => c.name.toLowerCase() === n.toLowerCase());
    if (i < 0) throw new SqlError("no such column: " + n + " (code 1 SQLITE_ERROR)");
    return i;
  }

  // ------------------------------------------------------------------- expressions
  private parseExpr(p: P, t: Table | null): Expr {
    return this.parseOr(p, t);
  }
  private parseOr(p: P, t: Table | null): Expr {
    let l = this.parseAnd(p, t);
    while (p.accept("OR")) {
      const a = l;
      const b = this.parseAnd(p, t);
      l = (r, tt) => (a(r, tt) ? 1 : 0) || (b(r, tt) ? 1 : 0);
    }
    return l;
  }
  private parseAnd(p: P, t: Table | null): Expr {
    let l = this.parseNot(p, t);
    while (p.accept("AND")) {
      const a = l;
      const b = this.parseNot(p, t);
      l = (r, tt) => (a(r, tt) && b(r, tt) ? 1 : 0);
    }
    return l;
  }
  private parseNot(p: P, t: Table | null): Expr {
    if (p.accept("NOT")) {
      const e = this.parseNot(p, t);
      return (r, tt) => (e(r, tt) ? 0 : 1);
    }
    return this.parseCmp(p, t);
  }
  private parseCmp(p: P, t: Table | null): Expr {
    const l = this.parseAdd(p, t);
    const c = p.cur;
    if (p.accept("IS")) {
      const neg = p.accept("NOT");
      p.expect("NULL");
      return (r, tt) => ((l(r, tt) === null) !== neg ? 1 : 0);
    }
    if (p.kw("LIKE") || (p.kw("NOT") && p.t[p.i + 1] && p.t[p.i + 1].v.toUpperCase() === "LIKE")) {
      const neg = p.accept("NOT");
      p.expect("LIKE");
      const pat = this.parseAdd(p, t);
      return (r, tt) => {
        const re = new RegExp("^" + String(pat(r, tt)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", "i");
        return re.test(String(l(r, tt))) !== neg ? 1 : 0;
      };
    }
    if (p.kw("IN")) {
      p.i++;
      p.expectOp("(");
      const items: Expr[] = [];
      do items.push(this.parseAdd(p, t));
      while (p.acceptOp(","));
      p.expectOp(")");
      return (r, tt) => (items.some((x) => x(r, tt) === l(r, tt)) ? 1 : 0);
    }
    if (c && c.k === "op" && ["=", "<", ">", "<=", ">=", "<>", "!="].indexOf(c.v) >= 0) {
      p.i++;
      const rgt = this.parseAdd(p, t);
      return (r, tt) => {
        const a = l(r, tt);
        const b = rgt(r, tt);
        if (a === null || b === null) return null;
        switch (c.v) {
          case "=":
            return a === b || (typeof a !== typeof b && String(a) === String(b)) ? 1 : 0;
          case "<>":
          case "!=":
            return a === b || (typeof a !== typeof b && String(a) === String(b)) ? 0 : 1;
          case "<":
            return a < b ? 1 : 0;
          case ">":
            return a > b ? 1 : 0;
          case "<=":
            return a <= b ? 1 : 0;
          default:
            return a >= b ? 1 : 0;
        }
      };
    }
    return l;
  }
  private parseAdd(p: P, t: Table | null): Expr {
    let l = this.parseMul(p, t);
    for (;;) {
      const c = p.cur;
      if (c && c.k === "op" && (c.v === "+" || c.v === "-" || c.v === "||")) {
        p.i++;
        const a = l;
        const b = this.parseMul(p, t);
        const op = c.v;
        l = (r, tt) => (op === "||" ? String(a(r, tt)) + String(b(r, tt)) : op === "+" ? a(r, tt) + b(r, tt) : a(r, tt) - b(r, tt));
      } else return l;
    }
  }
  private parseMul(p: P, t: Table | null): Expr {
    let l = this.parseAtom(p, t);
    for (;;) {
      const c = p.cur;
      if (c && c.k === "op" && (c.v === "*" || c.v === "/" || c.v === "%")) {
        p.i++;
        const a = l;
        const b = this.parseAtom(p, t);
        const op = c.v;
        l = (r, tt) => (op === "*" ? a(r, tt) * b(r, tt) : op === "/" ? a(r, tt) / b(r, tt) : a(r, tt) % b(r, tt));
      } else return l;
    }
  }
  private parseAtom(p: P, t: Table | null): Expr {
    const c = p.cur;
    if (!c) p.fail("end of statement");
    if (c!.k === "num") {
      p.i++;
      const n = parseFloat(c!.v);
      return () => n;
    }
    if (c!.k === "str") {
      p.i++;
      return () => c!.v;
    }
    if (c!.k === "param") {
      p.i++;
      const v = p.params[p.pi++];
      return () => (v === undefined ? null : v);
    }
    if (c!.k === "op" && c!.v === "(") {
      p.i++;
      const e = this.parseExpr(p, t);
      p.expectOp(")");
      return e;
    }
    if (c!.k === "op" && c!.v === "-") {
      p.i++;
      const e = this.parseAtom(p, t);
      return (r, tt) => -e(r, tt);
    }
    if (c!.k === "id") {
      p.i++;
      if (c!.v.toUpperCase() === "NULL") return () => null;
      let name = c!.v;
      if (p.acceptOp(".")) name = p.ident();
      if (!t) throw new SqlError("no such column: " + name + " (code 1 SQLITE_ERROR)");
      const idx = this.colIndex(t, name);
      return (r) => r[idx];
    }
    p.fail();
    return () => null;
  }

  // ------------------------------------------------------------------- statements
  exec(sql: string, params: any[] = []): ResultSet {
    const p = new P(sql.replace(/;\s*$/, ""), params);
    if (!p.cur) throw new SqlError("not an error (code 21 SQLITE_MISUSE)");
    if (p.accept("CREATE")) return this.create(p);
    if (p.accept("DROP")) return this.drop(p);
    if (p.accept("INSERT")) return this.insert(p);
    if (p.accept("SELECT")) return this.select(p);
    if (p.accept("UPDATE")) return this.update(p);
    if (p.accept("DELETE")) return this.del(p);
    if (p.accept("BEGIN") || p.accept("COMMIT") || p.accept("END") || p.accept("ROLLBACK") || p.accept("PRAGMA")) return { columns: [], rows: [] };
    throw new SqlError('near "' + p.cur!.v + '": syntax error (code 1 SQLITE_ERROR): , while compiling: ' + sql);
  }

  private create(p: P): ResultSet {
    p.expect("TABLE");
    let ifNot = false;
    if (p.accept("IF")) {
      p.expect("NOT");
      p.expect("EXISTS");
      ifNot = true;
    }
    const name = p.ident();
    if (this.tables[name.toLowerCase()]) {
      if (ifNot) return { columns: [], rows: [] };
      throw new SqlError("table " + name + " already exists (code 1 SQLITE_ERROR)");
    }
    p.expectOp("(");
    const cols: Column[] = [];
    do {
      if (p.kw("PRIMARY") || p.kw("FOREIGN") || p.kw("UNIQUE")) {
        // table constraint: skip to the matching ')'
        while (p.cur && !(p.cur.k === "op" && (p.cur.v === "," || p.cur.v === ")"))) {
          if ((p.cur as any).v === "(") while (p.cur && (p.cur as any).v !== ")") p.i++;
          p.i++;
        }
        continue;
      }
      const cn = p.ident();
      let ty = "";
      while (p.cur && p.cur.k === "id" && ["PRIMARY", "NOT", "NULL", "UNIQUE", "DEFAULT", "AUTOINCREMENT", "REFERENCES", "CHECK"].indexOf(p.cur.v.toUpperCase()) < 0) {
        ty += p.cur.v;
        p.i++;
        if (p.acceptOp("(")) {
          while (!p.acceptOp(")")) p.i++;
        }
      }
      const col: Column = { name: cn, type: typeAffinity(ty), pk: false, auto: false, notNull: false, unique: false };
      for (;;) {
        if (p.accept("PRIMARY")) {
          p.expect("KEY");
          col.pk = true;
        } else if (p.accept("AUTOINCREMENT")) col.auto = true;
        else if (p.accept("NOT")) {
          p.expect("NULL");
          col.notNull = true;
        } else if (p.accept("NULL")) continue;
        else if (p.accept("UNIQUE")) col.unique = true;
        else if (p.accept("DEFAULT")) p.i++;
        else break;
      }
      cols.push(col);
    } while (p.acceptOp(","));
    p.expectOp(")");
    this.tables[name.toLowerCase()] = { name, cols, rows: [], nextId: 1 };
    return { columns: [], rows: [] };
  }

  private drop(p: P): ResultSet {
    p.expect("TABLE");
    if (p.accept("IF")) p.expect("EXISTS");
    const name = p.ident();
    delete this.tables[name.toLowerCase()];
    return { columns: [], rows: [] };
  }

  /** returns [rowid] of the inserted row in `columns` */
  private insert(p: P): ResultSet {
    p.accept("OR");
    p.accept("REPLACE");
    p.accept("IGNORE");
    p.expect("INTO");
    const t = this.table(p.ident());
    let names: string[] = t.cols.map((c) => c.name);
    if (p.acceptOp("(")) {
      names = [];
      do names.push(p.ident());
      while (p.acceptOp(","));
      p.expectOp(")");
    }
    p.expect("VALUES");
    let last = -1;
    do {
      p.expectOp("(");
      const vals: any[] = [];
      do vals.push(this.parseExpr(p, null)([], null));
      while (p.acceptOp(","));
      p.expectOp(")");
      if (vals.length !== names.length) throw new SqlError(vals.length + " values for " + names.length + " columns (code 1 SQLITE_ERROR)");
      const row: any[] = t.cols.map(() => null);
      names.forEach((n, i) => {
        row[this.colIndex(t, n)] = vals[i];
      });
      last = this.insertRow(t, row);
    } while (p.acceptOp(","));
    return { columns: ["rowid"], rows: [[last]] };
  }

  insertRow(t: Table, row: any[]): number {
    t.cols.forEach((c, i) => {
      row[i] = coerce(row[i], c.type);
      if (c.pk && c.type === "INTEGER" && (row[i] === null || row[i] === undefined)) row[i] = t.nextId;
    });
    t.cols.forEach((c, i) => {
      if (c.notNull && row[i] === null) throw new SqlError("NOT NULL constraint failed: " + t.name + "." + c.name + " (code 1299 SQLITE_CONSTRAINT_NOTNULL)", "SQLiteConstraintException");
      if ((c.pk || c.unique) && row[i] !== null && t.rows.some((r) => r[i] === row[i])) {
        throw new SqlError((c.pk ? "UNIQUE constraint failed: " : "UNIQUE constraint failed: ") + t.name + "." + c.name + " (code " + (c.pk ? "1555 SQLITE_CONSTRAINT_PRIMARYKEY" : "2067 SQLITE_CONSTRAINT_UNIQUE") + ")", "SQLiteConstraintException");
      }
    });
    t.rows.push(row);
    const pkIdx = t.cols.findIndex((c) => c.pk && c.type === "INTEGER");
    if (pkIdx >= 0 && typeof row[pkIdx] === "number" && row[pkIdx] >= t.nextId) t.nextId = row[pkIdx] + 1;
    else if (pkIdx < 0) t.nextId++;
    return pkIdx >= 0 ? row[pkIdx] : t.rows.length;
  }

  private select(p: P): ResultSet {
    // select list: parse lazily after we know the table
    const listStart = p.i;
    let depth = 0;
    while (p.cur && !(depth === 0 && p.kw("FROM"))) {
      if (p.cur.k === "op" && p.cur.v === "(") depth++;
      if (p.cur.k === "op" && p.cur.v === ")") depth--;
      p.i++;
    }
    const listEnd = p.i;
    let t: Table | null = null;
    if (p.accept("FROM")) t = this.table(p.ident());
    const afterFrom = p.i;
    // WHERE
    let where: Expr | null = null;
    const savedPi = p.pi;
    if (p.accept("WHERE")) where = this.parseExpr(p, t);
    let groupBy: string | null = null;
    if (p.accept("GROUP")) {
      p.expect("BY");
      groupBy = p.ident();
    }
    const order: { e: Expr; desc: boolean }[] = [];
    if (p.accept("ORDER")) {
      p.expect("BY");
      do {
        const e = this.parseExpr(p, t);
        const desc = p.accept("DESC");
        p.accept("ASC");
        order.push({ e, desc });
      } while (p.acceptOp(","));
    }
    let limit = Infinity;
    let offset = 0;
    if (p.accept("LIMIT")) {
      limit = this.parseExpr(p, null)([], null);
      if (p.accept("OFFSET")) offset = this.parseExpr(p, null)([], null);
    }
    if (p.cur) p.fail();
    void afterFrom;
    void savedPi;

    let rows = t ? t.rows.slice() : [[]];
    const tt = t;
    if (where) rows = rows.filter((r) => !!where!(r, tt));
    // select items
    const sub = new P(p.sql, []);
    sub.t = p.t.slice(listStart, listEnd);
    sub.pi = 0;
    sub.params = p.params;
    // parameters in the select list are rare; where-clause params were consumed in order above
    const items: { name: string; star?: boolean; agg?: string; arg?: Expr; expr?: Expr }[] = [];
    do {
      if (sub.acceptOp("*")) {
        items.push({ name: "*", star: true });
        continue;
      }
      const c = sub.cur;
      const nxt = sub.t[sub.i + 1];
      if (c && c.k === "id" && ["COUNT", "SUM", "AVG", "MIN", "MAX", "TOTAL"].indexOf(c.v.toUpperCase()) >= 0 && nxt && nxt.v === "(") {
        const agg = c.v.toUpperCase();
        sub.i += 2;
        let arg: Expr | undefined;
        let label = agg + "(";
        if (sub.acceptOp("*")) label += "*";
        else {
          sub.accept("DISTINCT");
          const start = sub.i;
          arg = this.parseExpr(sub, t);
          label += sub.t.slice(start, sub.i).map((x) => x.v).join("");
        }
        sub.expectOp(")");
        label += ")";
        let alias = label;
        if (sub.accept("AS")) alias = sub.ident();
        items.push({ name: alias, agg, arg });
        continue;
      }
      const start = sub.i;
      const e = this.parseExpr(sub, t);
      let nm = sub.t.slice(start, sub.i).map((x) => x.v).join("");
      if (sub.accept("AS")) nm = sub.ident();
      else if (sub.i - start === 1 && sub.t[start].k === "id") nm = sub.t[start].v;
      items.push({ name: nm, expr: e });
    } while (sub.acceptOp(","));

    const hasAgg = items.some((i) => i.agg);
    const compute = (group: any[][]): any[] =>
      items.map((it) => {
        if (it.star) return null;
        if (it.agg) {
          const vals = it.arg ? group.map((r) => it.arg!(r, tt)).filter((v) => v !== null) : group.map(() => 1);
          switch (it.agg) {
            case "COUNT":
              return vals.length;
            case "SUM":
              return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
            case "TOTAL":
              return vals.reduce((a, b) => a + b, 0);
            case "AVG":
              return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
            case "MIN":
              return vals.length ? vals.reduce((a, b) => (b < a ? b : a)) : null;
            default:
              return vals.length ? vals.reduce((a, b) => (b > a ? b : a)) : null;
          }
        }
        return group.length ? it.expr!(group[0], tt) : null;
      });

    let out: any[][];
    let columns: string[];
    if (hasAgg) {
      if (groupBy && t) {
        const gi = this.colIndex(t, groupBy);
        const groups: { [k: string]: any[][] } = {};
        const keys: string[] = [];
        rows.forEach((r) => {
          const k = String(r[gi]);
          if (!groups[k]) {
            groups[k] = [];
            keys.push(k);
          }
          groups[k].push(r);
        });
        out = keys.map((k) => compute(groups[k]));
      } else out = [compute(rows)];
      columns = items.map((i) => i.name);
    } else {
      if (order.length)
        rows.sort((a, b) => {
          for (let i = 0; i < order.length; i++) {
            const x = order[i].e(a, tt);
            const y = order[i].e(b, tt);
            if (x === y) continue;
            const c = x === null ? -1 : y === null ? 1 : x < y ? -1 : 1;
            return order[i].desc ? -c : c;
          }
          return 0;
        });
      columns = [];
      items.forEach((i) => {
        if (i.star && t) t.cols.forEach((c) => columns.push(c.name));
        else columns.push(i.name);
      });
      out = rows.map((r) => {
        let res: any[] = [];
        items.forEach((i) => {
          if (i.star) res = res.concat(r);
          else res.push(i.expr!(r, tt));
        });
        return res;
      });
    }
    return { columns, rows: out.slice(offset, limit === Infinity ? undefined : offset + limit) };
  }

  private update(p: P): ResultSet {
    const t = this.table(p.ident());
    p.expect("SET");
    const sets: { idx: number; e: Expr }[] = [];
    do {
      const n = p.ident();
      p.expectOp("=");
      sets.push({ idx: this.colIndex(t, n), e: this.parseExpr(p, t) });
    } while (p.acceptOp(","));
    let where: Expr | null = null;
    if (p.accept("WHERE")) where = this.parseExpr(p, t);
    if (p.cur) p.fail();
    let n = 0;
    t.rows.forEach((r) => {
      if (!where || where(r, t)) {
        const vals = sets.map((s) => s.e(r, t));
        sets.forEach((s, i) => (r[s.idx] = coerce(vals[i], t.cols[s.idx].type)));
        n++;
      }
    });
    return { columns: ["changes"], rows: [[n]] };
  }

  private del(p: P): ResultSet {
    p.expect("FROM");
    const t = this.table(p.ident());
    let where: Expr | null = null;
    if (p.accept("WHERE")) where = this.parseExpr(p, t);
    if (p.cur) p.fail();
    const before = t.rows.length;
    t.rows = where ? t.rows.filter((r) => !where!(r, t)) : [];
    return { columns: ["changes"], rows: [[before - t.rows.length]] };
  }

  /** helper for db.insert(table, null, ContentValues) */
  insertValues(table: string, values: { [k: string]: any }): number {
    const t = this.table(table);
    const row: any[] = t.cols.map(() => null);
    Object.keys(values).forEach((k) => (row[this.colIndex(t, k)] = values[k]));
    return this.insertRow(t, row);
  }
}
