/** Recursive Android XML layout parser, resource resolver, live serializer, and code/XML formatters. */

export interface BasicLayoutFileInput {
  id?: string;
  name: string;
  path?: string;
  content: string;
}

export interface XmlLayoutElement {
  uid: string;
  tag: string;
  shortTag: string;
  id: string;
  attrs: Record<string, string>;
  children: XmlLayoutElement[];
  line: number;
}

export interface XmlParseError {
  line: number;
  message: string;
}

export interface XmlParseResult {
  root: XmlLayoutElement | null;
  errors: XmlParseError[];
}

export interface AndroidResources {
  strings: Record<string, string>;
  colors: Record<string, string>;
  drawables: string[];
}

export type PaletteWidgetKind =
  | "TextView"
  | "EditText"
  | "Button"
  | "ImageView"
  | "LinearLayout"
  | "RelativeLayout"
  | "ConstraintLayout"
  | "CheckBox"
  | "Switch";

export function normalizeAndroidId(rawId: string | undefined): string {
  if (!rawId) return "";
  return rawId.replace(/^@\+?id\//, "").trim();
}

export function shortTagName(tag: string): string {
  const idx = tag.lastIndexOf(".");
  return idx >= 0 ? tag.slice(idx + 1) : tag;
}

export function parseAndroidResources(files: BasicLayoutFileInput[]): AndroidResources {
  const strings: Record<string, string> = {};
  const colors: Record<string, string> = {};
  const drawables: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const rel = f.path || f.name;
    if (rel.indexOf("res/values/") >= 0 || f.name === "strings.xml" || f.name === "colors.xml") {
      const strRe = /<string\s+name="([^"]+)">([\s\S]*?)<\/string>/g;
      let sm = strRe.exec(f.content);
      while (sm) {
        strings[sm[1]] = sm[2].trim();
        sm = strRe.exec(f.content);
      }
      const colRe = /<color\s+name="([^"]+)">([\s\S]*?)<\/color>/g;
      let cm = colRe.exec(f.content);
      while (cm) {
        colors[cm[1]] = cm[2].trim();
        cm = colRe.exec(f.content);
      }
    }
    if (rel.indexOf("res/drawable/") >= 0) {
      const stem = f.name.replace(/\.[^.]+$/, "");
      if (drawables.indexOf(stem) < 0) drawables.push(stem);
    }
  }

  return { strings, colors, drawables };
}

export function resolveResourceValue(raw: string | undefined, resources: AndroidResources): string {
  if (!raw) return "";
  const v = raw.trim();
  if (v.indexOf("@string/") === 0) {
    const key = v.slice("@string/".length);
    if (resources.strings[key] !== undefined) return resources.strings[key];
  }
  if (v.indexOf("@color/") === 0) {
    const key = v.slice("@color/".length);
    if (resources.colors[key] !== undefined) return resources.colors[key];
  }
  return v;
}

interface ParsedAttr {
  key: string;
  value: string;
}

function parseAttributesList(attrText: string): ParsedAttr[] {
  const list: ParsedAttr[] = [];
  const re = /([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*"([^"]*)"/g;
  let m = re.exec(attrText);
  while (m) {
    list.push({ key: m[1], value: m[2] });
    m = re.exec(attrText);
  }
  return list;
}

interface RawXmlTagToken {
  kind: "open" | "close";
  tag: string;
  selfClosing: boolean;
  attrs: ParsedAttr[];
  attrsMap: Record<string, string>;
  start: number;
  end: number;
  line: number;
}

function tokenizeXmlTags(xmlSource: string): { tokens: RawXmlTagToken[]; errors: XmlParseError[] } {
  const tokens: RawXmlTagToken[] = [];
  const errors: XmlParseError[] = [];
  const n = xmlSource.length;
  let i = 0;

  function lineAt(offset: number): number {
    let line = 1;
    for (let k = 0; k < offset && k < n; k++) {
      if (xmlSource.charAt(k) === "\n") line++;
    }
    return line;
  }

  while (i < n) {
    const lt = xmlSource.indexOf("<", i);
    if (lt < 0) break;

    if (xmlSource.substr(lt, 4) === "<!--") {
      const endComment = xmlSource.indexOf("-->", lt + 4);
      if (endComment < 0) {
        errors.push({ line: lineAt(lt), message: "Unclosed XML comment" });
        break;
      }
      i = endComment + 3;
      continue;
    }

    if (xmlSource.substr(lt, 2) === "<?") {
      const endDecl = xmlSource.indexOf("?>", lt + 2);
      if (endDecl < 0) {
        errors.push({ line: lineAt(lt), message: "Unclosed XML processing instruction" });
        break;
      }
      i = endDecl + 2;
      continue;
    }

    if (xmlSource.substr(lt, 2) === "<!") {
      errors.push({ line: lineAt(lt), message: "DOCTYPE declarations are not allowed in Android layout XML" });
      const endBang = xmlSource.indexOf(">", lt + 2);
      i = endBang < 0 ? n : endBang + 1;
      continue;
    }

    // Scan until unquoted '>'
    let inDouble = false;
    let inSingle = false;
    let gt = -1;
    for (let j = lt + 1; j < n; j++) {
      const ch = xmlSource.charAt(j);
      if (!inSingle && ch === '"') inDouble = !inDouble;
      else if (!inDouble && ch === "'") inSingle = !inSingle;
      else if (!inDouble && !inSingle && ch === ">") {
        gt = j;
        break;
      }
    }

    if (gt < 0) {
      errors.push({ line: lineAt(lt), message: "Unclosed XML tag bracket '<'" });
      break;
    }

    const inside = xmlSource.slice(lt + 1, gt).trim();
    const isClosing = inside.charAt(0) === "/";
    const selfClosing = !isClosing && inside.charAt(inside.length - 1) === "/";
    const stripped = inside
      .replace(/^\//, "")
      .replace(/\/$/, "")
      .trim();
    const nameMatch = /^([A-Za-z_][A-Za-z0-9_.:-]*)/.exec(stripped);
    if (!nameMatch) {
      errors.push({ line: lineAt(lt), message: `Malformed XML tag near '<${inside.slice(0, 20)}>'` });
      i = gt + 1;
      continue;
    }

    const tag = nameMatch[1];
    const attrText = stripped.slice(tag.length);
    const attrs = isClosing ? [] : parseAttributesList(attrText);
    const attrsMap: Record<string, string> = {};
    for (let a = 0; a < attrs.length; a++) {
      attrsMap[attrs[a].key] = attrs[a].value;
    }

    tokens.push({
      kind: isClosing ? "close" : "open",
      tag,
      selfClosing,
      attrs,
      attrsMap,
      start: lt,
      end: gt + 1,
      line: lineAt(lt),
    });
    i = gt + 1;
  }

  return { tokens, errors };
}

export function parseAndroidLayoutXml(xmlSource: string): XmlParseResult {
  const { tokens, errors } = tokenizeXmlTags(xmlSource);
  const stack: XmlLayoutElement[] = [];
  let root: XmlLayoutElement | null = null;
  let seq = 0;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.kind === "open") {
      seq++;
      const uid = "el-" + seq;
      const id = normalizeAndroidId(tok.attrsMap["android:id"]) || uid;
      const el: XmlLayoutElement = {
        uid,
        tag: tok.tag,
        shortTag: shortTagName(tok.tag),
        id,
        attrs: tok.attrsMap,
        children: [],
        line: tok.line,
      };
      if (stack.length === 0) {
        root = el;
      } else {
        stack[stack.length - 1].children.push(el);
      }
      if (!tok.selfClosing) {
        stack.push(el);
      }
    } else {
      if (stack.length === 0) {
        errors.push({ line: tok.line, message: `Unexpected closing tag </${tok.tag}>` });
      } else {
        const top = stack[stack.length - 1];
        if (top.tag !== tok.tag) {
          errors.push({
            line: tok.line,
            message: `Mismatched XML tag: expected </${top.tag}>, found </${tok.tag}>`,
          });
        }
        stack.pop();
      }
    }
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    errors.push({ line: unclosed.line, message: `Unclosed XML element <${unclosed.tag}>` });
  }

  return { root, errors };
}

export function collectAllXmlIds(root: XmlLayoutElement | null): string[] {
  const ids: string[] = [];
  function walk(node: XmlLayoutElement | null) {
    if (!node) return;
    const explicit = normalizeAndroidId(node.attrs["android:id"]);
    if (explicit && ids.indexOf(explicit) < 0) ids.push(explicit);
    for (let i = 0; i < node.children.length; i++) {
      walk(node.children[i]);
    }
  }
  walk(root);
  return ids;
}

export function updateElementAttributeInXml(
  xmlSource: string,
  targetIdOrUid: string,
  attrName: string,
  newValue: string
): string {
  const { tokens } = tokenizeXmlTags(xmlSource);
  let seq = 0;
  let targetTok: RawXmlTagToken | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.kind !== "open") continue;
    seq++;
    const uid = "el-" + seq;
    const normId = normalizeAndroidId(tok.attrsMap["android:id"]);
    if (uid === targetIdOrUid || (normId && normId === targetIdOrUid)) {
      targetTok = tok;
      break;
    }
  }

  if (!targetTok) return xmlSource;

  // Determine indentation of the opening tag
  const lineStart = xmlSource.lastIndexOf("\n", targetTok.start - 1) + 1;
  const linePrefix = xmlSource.slice(lineStart, targetTok.start);
  const baseIndent = /^\s*/.exec(linePrefix)?.[0] || "";
  const attrIndent = baseIndent + "    ";

  let valueToWrite = newValue;
  if (attrName === "android:id" && newValue.trim() && newValue.indexOf("@") !== 0) {
    valueToWrite = "@+id/" + newValue.trim().replace(/[^A-Za-z0-9_]/g, "");
  }

  const nextAttrs: ParsedAttr[] = [];
  let updated = false;
  for (let i = 0; i < targetTok.attrs.length; i++) {
    const item = targetTok.attrs[i];
    if (item.key === attrName) {
      if (valueToWrite !== "") {
        nextAttrs.push({ key: attrName, value: valueToWrite });
      }
      updated = true;
    } else {
      nextAttrs.push(item);
    }
  }
  if (!updated && valueToWrite !== "") {
    nextAttrs.push({ key: attrName, value: valueToWrite });
  }

  const attrLines = nextAttrs.map((a) => `${attrIndent}${a.key}="${a.value}"`).join("\n");
  const ending = targetTok.selfClosing ? " />" : ">";
  const replacement =
    nextAttrs.length > 0 ? `<${targetTok.tag}\n${attrLines}${ending}` : `<${targetTok.tag}${ending}`;

  return xmlSource.slice(0, targetTok.start) + replacement + xmlSource.slice(targetTok.end);
}

function makeUniqueWidgetId(prefix: string, existingIds: string[]): string {
  let idx = 1;
  while (existingIds.indexOf(prefix + idx) >= 0) {
    idx++;
  }
  return prefix + idx;
}

export function insertComponentIntoLayoutXml(
  xmlSource: string,
  componentType: PaletteWidgetKind,
  existingIds: string[] = []
): { xml: string; insertedId: string } {
  const parsed = parseAndroidLayoutXml(xmlSource);
  const allIds = collectAllXmlIds(parsed.root);
  for (let i = 0; i < existingIds.length; i++) {
    if (allIds.indexOf(existingIds[i]) < 0) allIds.push(existingIds[i]);
  }

  const rootTag = parsed.root ? parsed.root.tag : "";
  const isConstraintParent = rootTag.indexOf("ConstraintLayout") >= 0;

  let prefix = "view";
  let tag = componentType as string;
  const extraAttrs: string[] = [];

  if (componentType === "TextView") {
    prefix = "textView";
    extraAttrs.push('android:text="TextView"', 'android:textSize="16sp"', 'android:textColor="#1C1B1F"');
  } else if (componentType === "EditText") {
    prefix = "editText";
    extraAttrs.push(
      'android:hint="Enter input"',
      'android:inputType="text"',
      'android:minHeight="44dp"',
      'android:padding="8dp"'
    );
  } else if (componentType === "Button") {
    prefix = "button";
    extraAttrs.push('android:text="Submit"');
  } else if (componentType === "ImageView") {
    prefix = "imageView";
    extraAttrs.push('android:src="@drawable/ic_launcher_foreground"', 'android:contentDescription="App Image"');
  } else if (componentType === "CheckBox") {
    prefix = "checkBox";
    extraAttrs.push('android:text="Accept option"', 'android:checked="false"');
  } else if (componentType === "Switch") {
    prefix = "switchView";
    extraAttrs.push('android:text="Enable option"', 'android:checked="true"');
  } else if (componentType === "LinearLayout") {
    prefix = "linearLayout";
    extraAttrs.push('android:orientation="vertical"', 'android:padding="12dp"');
  } else if (componentType === "RelativeLayout") {
    prefix = "relativeLayout";
    extraAttrs.push('android:padding="12dp"');
  } else if (componentType === "ConstraintLayout") {
    prefix = "constraintLayout";
    tag = "androidx.constraintlayout.widget.ConstraintLayout";
    extraAttrs.push('android:padding="12dp"');
  }

  const insertedId = makeUniqueWidgetId(prefix, allIds);
  const isContainer =
    componentType === "LinearLayout" ||
    componentType === "RelativeLayout" ||
    componentType === "ConstraintLayout";

  const width = componentType === "EditText" || isContainer ? "match_parent" : "wrap_content";
  const height = "wrap_content";

  if (isConstraintParent) {
    extraAttrs.push(
      'app:layout_constraintStart_toStartOf="parent"',
      'app:layout_constraintEnd_toEndOf="parent"',
      'app:layout_constraintTop_toTopOf="parent"'
    );
  }

  const lines = [
    `    <${tag}`,
    `        android:id="@+id/${insertedId}"`,
    `        android:layout_width="${width}"`,
    `        android:layout_height="${height}"`,
  ];
  for (let i = 0; i < extraAttrs.length; i++) {
    lines.push(`        ${extraAttrs[i]}`);
  }
  const snippet = isContainer
    ? lines.join("\n") + `>\n    </${tag}>`
    : lines.join("\n") + " />";

  const rootClose = rootTag ? xmlSource.lastIndexOf(`</${rootTag}>`) : xmlSource.lastIndexOf("</");
  if (rootClose > 0) {
    const before = xmlSource.slice(0, rootClose).replace(/\s*$/, "");
    const after = xmlSource.slice(rootClose);
    return {
      xml: `${before}\n\n${snippet}\n\n${after}`,
      insertedId,
    };
  }

  return {
    xml: `${xmlSource.trim()}\n${snippet}\n`,
    insertedId,
  };
}

export function removeComponentFromLayoutXml(xmlSource: string, targetIdOrUid: string): string {
  const { tokens } = tokenizeXmlTags(xmlSource);
  let seq = 0;
  let openIdx = -1;
  let closeIdx = -1;
  let openTok: RawXmlTagToken | null = null;
  const openStack: number[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.kind === "open") {
      seq++;
      const uid = "el-" + seq;
      const normId = normalizeAndroidId(tok.attrsMap["android:id"]);
      // Never delete the root node (seq === 1)
      if (seq > 1 && openIdx < 0 && (uid === targetIdOrUid || (normId && normId === targetIdOrUid))) {
        openIdx = i;
        openTok = tok;
        if (tok.selfClosing) {
          closeIdx = i;
          break;
        }
        openStack.push(i);
        continue;
      }
      if (openIdx >= 0 && !tok.selfClosing) {
        openStack.push(i);
      }
    } else if (openIdx >= 0) {
      openStack.pop();
      if (openStack.length === 0) {
        closeIdx = i;
        break;
      }
    }
  }

  if (openIdx < 0 || closeIdx < 0 || !openTok) return xmlSource;

  const spanStart = tokens[openIdx].start;
  const spanEnd = tokens[closeIdx].end;
  const before = xmlSource.slice(0, spanStart).replace(/[ \t]*\r?\n?$/, "");
  const after = xmlSource.slice(spanEnd).replace(/^\r?\n/, "");
  return `${before}\n${after}`;
}

export function formatAndroidXml(xmlSource: string): string {
  const { tokens, errors } = tokenizeXmlTags(xmlSource);
  if (errors.length > 0 || tokens.length === 0) return xmlSource;

  const headerMatch = /^\s*(<\?xml[\s\S]*?\?>)/.exec(xmlSource);
  const out: string[] = [];
  if (headerMatch) {
    out.push(headerMatch[1]);
  }

  let depth = 0;
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    const indent = "    ".repeat(depth);
    if (tok.kind === "open") {
      const next = tokens[i + 1];
      const textBetween =
        next && !tok.selfClosing && next.kind === "close" && next.tag === tok.tag
          ? xmlSource.slice(tok.end, next.start).trim()
          : null;

      if (textBetween !== null && tok.attrs.length <= 2) {
        const inlineAttrs = tok.attrs.map((a) => ` ${a.key}="${a.value}"`).join("");
        out.push(`${indent}<${tok.tag}${inlineAttrs}>${textBetween}</${tok.tag}>`);
        i += 2;
        continue;
      }

      if (tok.attrs.length <= 1) {
        const inlineAttrs = tok.attrs.map((a) => ` ${a.key}="${a.value}"`).join("");
        out.push(`${indent}<${tok.tag}${inlineAttrs}${tok.selfClosing ? " />" : ">"}`);
      } else {
        const attrLines = tok.attrs.map((a) => `${indent}    ${a.key}="${a.value}"`).join("\n");
        out.push(`${indent}<${tok.tag}\n${attrLines}${tok.selfClosing ? " />" : ">"}`);
      }
      if (!tok.selfClosing) depth++;
    } else {
      depth = Math.max(0, depth - 1);
      out.push(`${"    ".repeat(depth)}</${tok.tag}>`);
    }
    i++;
  }

  return out.join("\n") + "\n";
}

export function formatJavaOrKotlinCode(source: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let indent = 0;
  let blankStreak = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      blankStreak++;
      if (blankStreak <= 1 && out.length > 0) out.push("");
      continue;
    }
    blankStreak = 0;

    if (trimmed.charAt(0) === "}") {
      indent = Math.max(0, indent - 1);
    }

    out.push("    ".repeat(indent) + trimmed);

    // Strip strings and line comments before counting net braces on this line
    const stripped = trimmed
      .replace(/\/\/.*$/, "")
      .replace(/"(?:\\.|[^"\\])*"/g, '""')
      .replace(/'(?:\\.|[^'\\])*'/g, "''");
    let net = 0;
    for (let k = 0; k < stripped.length; k++) {
      if (stripped.charAt(k) === "{") net++;
      else if (stripped.charAt(k) === "}") net--;
    }
    if (trimmed.charAt(0) === "}") {
      // Initial leading '}' already decremented indent above
      net += 1;
    }
    indent = Math.max(0, indent + net);
  }

  return out.join("\n").replace(/\n*$/, "\n");
}
