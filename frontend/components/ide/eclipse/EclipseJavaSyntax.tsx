import React from "react";
import styles from "./eclipse.module.css";

const ECLIPSE_KEYWORDS: Record<string, true> = {
  abstract: true,
  assert: true,
  boolean: true,
  break: true,
  byte: true,
  case: true,
  catch: true,
  char: true,
  class: true,
  const: true,
  continue: true,
  default: true,
  do: true,
  double: true,
  else: true,
  enum: true,
  extends: true,
  false: true,
  final: true,
  finally: true,
  float: true,
  for: true,
  goto: true,
  if: true,
  implements: true,
  import: true,
  instanceof: true,
  int: true,
  interface: true,
  long: true,
  native: true,
  new: true,
  null: true,
  package: true,
  private: true,
  protected: true,
  public: true,
  return: true,
  short: true,
  static: true,
  strictfp: true,
  super: true,
  switch: true,
  synchronized: true,
  this: true,
  throw: true,
  throws: true,
  transient: true,
  true: true,
  try: true,
  var: true,
  void: true,
  volatile: true,
  while: true,
};

interface Segment {
  text: string;
  kind: "plain" | "keyword" | "string" | "comment" | "javadoc" | "todo" | "staticField" | "annotation";
}

function renderWhitespaceText(text: string, showWhitespace: boolean, keyPrefix: string): React.ReactNode {
  if (!showWhitespace) return text;
  const parts: React.ReactNode[] = [];
  let buf = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    if (ch === "\t") {
      if (buf) {
        parts.push(buf);
        buf = "";
      }
      parts.push(
        <span key={`${keyPrefix}-t-${i}`} className={styles.wsTab}>
          {"\t"}
        </span>,
      );
    } else if (ch === " ") {
      if (buf) {
        parts.push(buf);
        buf = "";
      }
      parts.push(
        <span key={`${keyPrefix}-s-${i}`} className={styles.wsSpace}>
          ·
        </span>,
      );
    } else {
      buf += ch;
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

function tokenizeLineComments(commentText: string, isJavadoc: boolean): Segment[] {
  const segs: Segment[] = [];
  const baseKind: Segment["kind"] = isJavadoc ? "javadoc" : "comment";
  const regex = /\b(TODO|FIXME|XXX)\b/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null = regex.exec(commentText);
  while (match !== null) {
    if (match.index > lastIdx) {
      segs.push({ text: commentText.slice(lastIdx, match.index), kind: baseKind });
    }
    segs.push({ text: match[0], kind: "todo" });
    lastIdx = match.index + match[0].length;
    match = regex.exec(commentText);
  }
  if (lastIdx < commentText.length) {
    segs.push({ text: commentText.slice(lastIdx), kind: baseKind });
  }
  return segs;
}

export function highlightJavaLines(code: string): Segment[][] {
  const rawLines = code.split("\n");
  const result: Segment[][] = [];
  let inBlockComment = false;
  let inJavadoc = false;

  for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx += 1) {
    const line = rawLines[lineIdx];
    const segs: Segment[] = [];
    let i = 0;
    let lastWord = "";
    let lastWasDot = false;

    while (i < line.length) {
      if (inBlockComment) {
        const endIdx = line.indexOf("*/", i);
        if (endIdx === -1) {
          const rest = line.slice(i);
          const cSegs = tokenizeLineComments(rest, inJavadoc);
          for (let k = 0; k < cSegs.length; k += 1) segs.push(cSegs[k]);
          i = line.length;
        } else {
          const part = line.slice(i, endIdx + 2);
          const cSegs = tokenizeLineComments(part, inJavadoc);
          for (let k = 0; k < cSegs.length; k += 1) segs.push(cSegs[k]);
          i = endIdx + 2;
          inBlockComment = false;
          inJavadoc = false;
        }
        continue;
      }

      const ch = line.charAt(i);

      // Line comment
      if (ch === "/" && line.charAt(i + 1) === "/") {
        const cSegs = tokenizeLineComments(line.slice(i), false);
        for (let k = 0; k < cSegs.length; k += 1) segs.push(cSegs[k]);
        break;
      }

      // Block / Javadoc comment start
      if (ch === "/" && line.charAt(i + 1) === "*") {
        inJavadoc = line.charAt(i + 2) === "*" && line.charAt(i + 3) !== "/";
        inBlockComment = true;
        const endIdx = line.indexOf("*/", i + 2);
        if (endIdx === -1) {
          const cSegs = tokenizeLineComments(line.slice(i), inJavadoc);
          for (let k = 0; k < cSegs.length; k += 1) segs.push(cSegs[k]);
          break;
        } else {
          const part = line.slice(i, endIdx + 2);
          const cSegs = tokenizeLineComments(part, inJavadoc);
          for (let k = 0; k < cSegs.length; k += 1) segs.push(cSegs[k]);
          i = endIdx + 2;
          inBlockComment = false;
          inJavadoc = false;
          continue;
        }
      }

      // String literal
      if (ch === '"') {
        let j = i + 1;
        while (j < line.length) {
          if (line.charAt(j) === "\\") {
            j += 2;
          } else if (line.charAt(j) === '"') {
            j += 1;
            break;
          } else {
            j += 1;
          }
        }
        segs.push({ text: line.slice(i, j), kind: "string" });
        i = j;
        lastWasDot = false;
        continue;
      }

      // Char literal
      if (ch === "'") {
        let j = i + 1;
        while (j < line.length) {
          if (line.charAt(j) === "\\") {
            j += 2;
          } else if (line.charAt(j) === "'") {
            j += 1;
            break;
          } else {
            j += 1;
          }
        }
        segs.push({ text: line.slice(i, j), kind: "string" });
        i = j;
        lastWasDot = false;
        continue;
      }

      // Annotation
      if (ch === "@") {
        let j = i + 1;
        while (j < line.length && /[A-Za-z0-9_.]/.test(line.charAt(j))) j += 1;
        segs.push({ text: line.slice(i, j), kind: "annotation" });
        i = j;
        lastWasDot = false;
        continue;
      }

      // Identifier or keyword
      if (/[A-Za-z_$]/.test(ch)) {
        let j = i + 1;
        while (j < line.length && /[A-Za-z0-9_$]/.test(line.charAt(j))) j += 1;
        const word = line.slice(i, j);
        if (Object.prototype.hasOwnProperty.call(ECLIPSE_KEYWORDS, word)) {
          segs.push({ text: word, kind: "keyword" });
        } else if (
          lastWasDot &&
          ((lastWord === "System" && (word === "out" || word === "err" || word === "in")) ||
            (lastWord === "Math" && (word === "PI" || word === "E")) ||
            (lastWord === "Integer" && (word === "MAX_VALUE" || word === "MIN_VALUE")))
        ) {
          segs.push({ text: word, kind: "staticField" });
        } else {
          segs.push({ text: word, kind: "plain" });
        }
        lastWord = word;
        lastWasDot = false;
        i = j;
        continue;
      }

      // Plain runs (whitespace, punctuation, numbers)
      let j = i + 1;
      while (j < line.length) {
        const next = line.charAt(j);
        if (next === "/" || next === '"' || next === "'" || next === "@" || /[A-Za-z_$]/.test(next)) {
          break;
        }
        j += 1;
      }
      const plainText = line.slice(i, j);
      segs.push({ text: plainText, kind: "plain" });
      if (plainText.trim() === ".") {
        lastWasDot = true;
      } else if (plainText.trim() !== "") {
        lastWasDot = false;
      }
      i = j;
    }

    result.push(segs);
  }

  return result;
}

interface EclipseJavaSyntaxProps {
  code: string;
  activeLine: number;
  errorLines: Record<number, true>;
  highlightWord: string;
  showWhitespace: boolean;
}

function renderWithOccurrences(
  text: string,
  highlightWord: string,
  showWhitespace: boolean,
  keyPrefix: string,
): React.ReactNode {
  if (!highlightWord || highlightWord.length < 2) {
    return renderWhitespaceText(text, showWhitespace, keyPrefix);
  }
  const parts: React.ReactNode[] = [];
  let idx = 0;
  let pos = text.indexOf(highlightWord);
  while (pos !== -1) {
    const beforeCh = pos > 0 ? text.charAt(pos - 1) : "";
    const afterCh = pos + highlightWord.length < text.length ? text.charAt(pos + highlightWord.length) : "";
    const wholeWord = (!beforeCh || !/[A-Za-z0-9_$]/.test(beforeCh)) && (!afterCh || !/[A-Za-z0-9_$]/.test(afterCh));
    if (wholeWord) {
      if (pos > idx) {
        parts.push(renderWhitespaceText(text.slice(idx, pos), showWhitespace, `${keyPrefix}-b-${pos}`));
      }
      parts.push(
        <span key={`${keyPrefix}-occ-${pos}`} className={styles.occurrenceMark}>
          {renderWhitespaceText(highlightWord, showWhitespace, `${keyPrefix}-o-${pos}`)}
        </span>,
      );
      idx = pos + highlightWord.length;
    } else {
      const endPos = pos + highlightWord.length;
      parts.push(renderWhitespaceText(text.slice(idx, endPos), showWhitespace, `${keyPrefix}-p-${pos}`));
      idx = endPos;
    }
    pos = text.indexOf(highlightWord, pos + highlightWord.length);
  }
  if (idx < text.length) {
    parts.push(renderWhitespaceText(text.slice(idx), showWhitespace, `${keyPrefix}-end`));
  }
  return parts;
}

export function EclipseJavaSyntax({
  code,
  activeLine,
  errorLines,
  highlightWord,
  showWhitespace,
}: EclipseJavaSyntaxProps) {
  const lines = React.useMemo(() => highlightJavaLines(code), [code]);

  return (
    <div className={styles.syntaxLayer} aria-hidden="true">
      {lines.map((segs, idx) => {
        const lineNum = idx + 1;
        const isCurrent = lineNum === activeLine;
        const hasError = Boolean(errorLines[lineNum]);
        return (
          <div
            key={lineNum}
            className={`${styles.syntaxLine} ${isCurrent ? styles.syntaxLineActive : ""} ${
              hasError ? styles.syntaxLineError : ""
            }`}
          >
            {segs.length === 0 ? (
              showWhitespace ? <span className={styles.wsCr}> </span> : " "
            ) : (
              segs.map((seg, sIdx) => {
                const key = `${lineNum}-${sIdx}`;
                if (seg.kind === "keyword") {
                  return (
                    <span key={key} className={styles.tokKeyword}>
                      {seg.text}
                    </span>
                  );
                }
                if (seg.kind === "string") {
                  return (
                    <span key={key} className={styles.tokString}>
                      {renderWhitespaceText(seg.text, showWhitespace, key)}
                    </span>
                  );
                }
                if (seg.kind === "comment") {
                  return (
                    <span key={key} className={styles.tokComment}>
                      {renderWhitespaceText(seg.text, showWhitespace, key)}
                    </span>
                  );
                }
                if (seg.kind === "javadoc") {
                  return (
                    <span key={key} className={styles.tokJavadoc}>
                      {renderWhitespaceText(seg.text, showWhitespace, key)}
                    </span>
                  );
                }
                if (seg.kind === "todo") {
                  return (
                    <span key={key} className={styles.tokTodo}>
                      {seg.text}
                    </span>
                  );
                }
                if (seg.kind === "staticField") {
                  return (
                    <span key={key} className={styles.tokStaticField}>
                      {seg.text}
                    </span>
                  );
                }
                if (seg.kind === "annotation") {
                  return (
                    <span key={key} className={styles.tokAnnotation}>
                      {seg.text}
                    </span>
                  );
                }
                return (
                  <React.Fragment key={key}>
                    {renderWithOccurrences(seg.text, highlightWord, showWhitespace, key)}
                  </React.Fragment>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}
