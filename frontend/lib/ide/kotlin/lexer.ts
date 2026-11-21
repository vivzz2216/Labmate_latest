/** Kotlin lexer for the LabMate Android studio. Produces tokens with line/column and a "newline before" flag (Kotlin's
 *  statement ends are newline-sensitive). String templates are split into text and expression-source parts. */

export type TokKind = "id" | "int" | "float" | "str" | "char" | "op" | "eof";
export type StrPart = { text: string } | { expr: string; line: number; col: number };

export interface Tok {
  k: TokKind;
  v: string;
  line: number;
  col: number;
  nl: boolean;
  /** start/end offsets in the source */
  start: number;
  end: number;
  parts?: StrPart[];
  num?: number;
  suffix?: string;
}

export class KotlinSyntaxError extends Error {
  line: number;
  col: number;
  constructor(message: string, line: number, col: number) {
    super(message);
    this.line = line;
    this.col = col;
  }
}

const OPS3 = ["===", "!==", "..<", "?.", "?:", "::", "..", "->", "==", "!=", "<=", ">=", "&&", "||", "++", "--", "+=", "-=", "*=", "/=", "%=", "!!"];
const SINGLE = "+-*/%=<>!?:;,.()[]{}@&|^~";

function isIdStart(c: string): boolean {
  return /[A-Za-z_$À-￿]/.test(c);
}
function isIdPart(c: string): boolean {
  return /[A-Za-z0-9_À-￿]/.test(c);
}

export function tokenize(src: string, baseLine = 1, baseCol = 1): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let line = baseLine;
  let col = baseCol;
  let nl = false;
  const n = src.length;

  const advance = (count: number) => {
    for (let k = 0; k < count; k++) {
      if (src.charAt(i) === "\n") {
        line++;
        col = 1;
      } else col++;
      i++;
    }
  };
  const push = (t: Tok) => {
    toks.push(t);
    nl = false;
  };

  while (i < n) {
    const c = src.charAt(i);
    if (c === "\n") {
      nl = true;
      advance(1);
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") {
      advance(1);
      continue;
    }
    if (c === "/" && src.charAt(i + 1) === "/") {
      while (i < n && src.charAt(i) !== "\n") advance(1);
      continue;
    }
    if (c === "/" && src.charAt(i + 1) === "*") {
      const startLine = line;
      const startCol = col;
      let depth = 1;
      advance(2);
      while (i < n && depth > 0) {
        if (src.charAt(i) === "/" && src.charAt(i + 1) === "*") {
          depth++;
          advance(2);
        } else if (src.charAt(i) === "*" && src.charAt(i + 1) === "/") {
          depth--;
          advance(2);
        } else {
          if (src.charAt(i) === "\n") nl = true;
          advance(1);
        }
      }
      if (depth > 0) throw new KotlinSyntaxError("Unclosed comment", startLine, startCol);
      continue;
    }
    const startLine = line;
    const startCol = col;
    const start = i;

    // strings
    if (c === '"') {
      const raw = src.substr(i, 3) === '"""';
      const quote = raw ? '"""' : '"';
      advance(quote.length);
      const parts: StrPart[] = [];
      let text = "";
      let closed = false;
      while (i < n) {
        if (src.substr(i, quote.length) === quote && (!raw || src.substr(i, 4) !== '""""')) {
          advance(quote.length);
          closed = true;
          break;
        }
        const ch = src.charAt(i);
        if (!raw && ch === "\n") break;
        if (ch === "\\" && !raw) {
          const e = src.charAt(i + 1);
          const map: any = { n: "\n", t: "\t", r: "\r", b: "\b", "\\": "\\", '"': '"', "'": "'", $: "$", "0": "\0" };
          if (e === "u") {
            const hex = src.substr(i + 2, 4);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new KotlinSyntaxError("Illegal escape: \\u" + hex, line, col);
            text += String.fromCharCode(parseInt(hex, 16));
            advance(6);
          } else if (map[e] !== undefined) {
            text += map[e];
            advance(2);
          } else throw new KotlinSyntaxError("Illegal escape: '\\" + e + "'", line, col);
          continue;
        }
        if (ch === "$" && src.charAt(i + 1) === "{") {
          if (text) parts.push({ text });
          text = "";
          const exprLine = line;
          const exprCol = col + 2;
          advance(2);
          const exprStart = i;
          let depth = 1;
          while (i < n && depth > 0) {
            const d = src.charAt(i);
            if (d === '"') {
              // nested string inside the template expression
              advance(1);
              while (i < n && src.charAt(i) !== '"') {
                if (src.charAt(i) === "\\") advance(1);
                advance(1);
              }
              advance(1);
              continue;
            }
            if (d === "{") depth++;
            else if (d === "}") {
              depth--;
              if (depth === 0) break;
            }
            advance(1);
          }
          if (depth > 0) throw new KotlinSyntaxError("Unclosed string template: missing '}'", exprLine, exprCol);
          parts.push({ expr: src.slice(exprStart, i), line: exprLine, col: exprCol });
          advance(1);
          continue;
        }
        if (ch === "$" && isIdStart(src.charAt(i + 1)) && src.charAt(i + 1) !== "$") {
          if (text) parts.push({ text });
          text = "";
          const exprLine = line;
          const exprCol = col + 1;
          advance(1);
          const s = i;
          while (i < n && isIdPart(src.charAt(i))) advance(1);
          parts.push({ expr: src.slice(s, i), line: exprLine, col: exprCol });
          continue;
        }
        text += ch;
        advance(1);
      }
      if (!closed) throw new KotlinSyntaxError("Unclosed string literal", startLine, startCol);
      if (text || parts.length === 0) parts.push({ text });
      push({ k: "str", start, v: "", line: startLine, col: startCol, nl, end: i, parts });
      continue;
    }
    if (c === "'") {
      let value = "";
      advance(1);
      if (src.charAt(i) === "\\") {
        const e = src.charAt(i + 1);
        const map: any = { n: "\n", t: "\t", r: "\r", b: "\b", "\\": "\\", "'": "'", '"': '"', $: "$", "0": "\0" };
        if (e === "u") {
          value = String.fromCharCode(parseInt(src.substr(i + 2, 4), 16));
          advance(6);
        } else if (map[e] !== undefined) {
          value = map[e];
          advance(2);
        } else throw new KotlinSyntaxError("Illegal escape: '\\" + e + "'", line, col);
      } else {
        value = src.charAt(i);
        advance(1);
      }
      if (src.charAt(i) !== "'") throw new KotlinSyntaxError("Incorrect character literal", startLine, startCol);
      advance(1);
      push({ k: "char", start, v: value, line: startLine, col: startCol, nl, end: i });
      continue;
    }
    // numbers
    if (/[0-9]/.test(c)) {
      let text = "";
      let isFloat = false;
      let value = 0;
      if (c === "0" && /[xX]/.test(src.charAt(i + 1))) {
        advance(2);
        while (/[0-9a-fA-F_]/.test(src.charAt(i))) {
          text += src.charAt(i);
          advance(1);
        }
        value = parseInt(text.replace(/_/g, ""), 16);
      } else if (c === "0" && /[bB]/.test(src.charAt(i + 1))) {
        advance(2);
        while (/[01_]/.test(src.charAt(i))) {
          text += src.charAt(i);
          advance(1);
        }
        value = parseInt(text.replace(/_/g, ""), 2);
      } else {
        while (/[0-9_]/.test(src.charAt(i))) {
          text += src.charAt(i);
          advance(1);
        }
        if (src.charAt(i) === "." && /[0-9]/.test(src.charAt(i + 1))) {
          isFloat = true;
          text += ".";
          advance(1);
          while (/[0-9_]/.test(src.charAt(i))) {
            text += src.charAt(i);
            advance(1);
          }
        }
        if (/[eE]/.test(src.charAt(i)) && /[-+0-9]/.test(src.charAt(i + 1))) {
          isFloat = true;
          text += src.charAt(i);
          advance(1);
          if (/[-+]/.test(src.charAt(i))) {
            text += src.charAt(i);
            advance(1);
          }
          while (/[0-9]/.test(src.charAt(i))) {
            text += src.charAt(i);
            advance(1);
          }
        }
        value = parseFloat(text.replace(/_/g, ""));
      }
      let suffix = "";
      if (/[fF]/.test(src.charAt(i)) && !isIdPart(src.charAt(i + 1))) {
        suffix = "f";
        isFloat = true;
        advance(1);
      } else if (src.charAt(i) === "L" && !isIdPart(src.charAt(i + 1))) {
        suffix = "L";
        advance(1);
      }
      push({ k: isFloat ? "float" : "int", start, v: src.slice(start, i), line: startLine, col: startCol, nl, end: i, num: value, suffix });
      continue;
    }
    if (isIdStart(c)) {
      if (c === "`") {
        // handled below
      }
      while (i < n && isIdPart(src.charAt(i))) advance(1);
      push({ k: "id", start, v: src.slice(start, i), line: startLine, col: startCol, nl, end: i });
      continue;
    }
    if (c === "`") {
      advance(1);
      const s = i;
      while (i < n && src.charAt(i) !== "`") advance(1);
      const name = src.slice(s, i);
      advance(1);
      push({ k: "id", start, v: name, line: startLine, col: startCol, nl, end: i });
      continue;
    }
    let matched = "";
    for (let k = 0; k < OPS3.length; k++) {
      if (src.substr(i, OPS3[k].length) === OPS3[k]) {
        matched = OPS3[k];
        break;
      }
    }
    if (!matched && SINGLE.indexOf(c) >= 0) matched = c;
    if (!matched) throw new KotlinSyntaxError("Illegal character: '" + c + "'", startLine, startCol);
    advance(matched.length);
    push({ k: "op", start, v: matched, line: startLine, col: startCol, nl, end: i });
  }
  toks.push({ k: "eof", start: i, v: "", line, col, nl: true, end: i });
  return toks;
}
