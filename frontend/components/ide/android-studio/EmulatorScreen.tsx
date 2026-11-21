"use client";

import React from "react";
import type { ScreenState, UiNode } from "@/lib/ide/kotlin/android";

interface EmulatorScreenProps {
  screen: ScreenState;
  onClick: (uid: string) => void;
  onInput: (uid: string, text: string) => void;
  onToggle: (uid: string, checked: boolean) => void;
  onDialogButton: (id: number) => void;
  onDismissCrash: () => void;
}

const TYPO: { [k: string]: { size: number; weight: number } } = {
  displayLarge: { size: 40, weight: 400 }, displayMedium: { size: 34, weight: 400 }, displaySmall: { size: 28, weight: 400 },
  headlineLarge: { size: 28, weight: 400 }, headlineMedium: { size: 24, weight: 400 }, headlineSmall: { size: 22, weight: 400 },
  titleLarge: { size: 22, weight: 500 }, titleMedium: { size: 16, weight: 500 }, titleSmall: { size: 14, weight: 500 },
  bodyLarge: { size: 16, weight: 400 }, bodyMedium: { size: 14, weight: 400 }, bodySmall: { size: 12, weight: 400 },
  labelLarge: { size: 14, weight: 500 }, labelMedium: { size: 12, weight: 500 }, labelSmall: { size: 11, weight: 500 },
};

function dp(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = parseFloat(String(v));
  return isNaN(n) ? undefined : n;
}

function arrangement(name: string | null | undefined, vertical: boolean): React.CSSProperties["justifyContent"] {
  if (!name) return vertical ? "flex-start" : "flex-start";
  if (/Center$/.test(name)) return "center";
  if (/SpaceBetween/.test(name)) return "space-between";
  if (/SpaceEvenly/.test(name)) return "space-evenly";
  if (/SpaceAround/.test(name)) return "space-around";
  if (/(End|Bottom)$/.test(name)) return "flex-end";
  return "flex-start";
}
function alignment(name: string | null | undefined): React.CSSProperties["alignItems"] {
  if (!name) return "flex-start";
  if (/Center/.test(name)) return "center";
  if (/(End|Bottom)/.test(name)) return "flex-end";
  return "flex-start";
}

const FONT = "Roboto, 'Segoe UI', system-ui, sans-serif";

const Compose: React.FC<{ n: UiNode; p: EmulatorScreenProps }> = ({ n, p }) => {
  const st = (n.props.style || {}) as { [k: string]: number | boolean | null | undefined };
  const base: React.CSSProperties = {};
  if (st.fillWidth) base.width = "100%";
  if (st.fillHeight) base.height = "100%";
  if (typeof st.width === "number") base.width = st.width;
  if (typeof st.height === "number") base.height = st.height;
  if (typeof st.padding === "number") base.padding = st.padding;
  if (typeof st.padX === "number") {
    base.paddingLeft = st.padX;
    base.paddingRight = st.padX;
  }
  if (typeof st.padY === "number") {
    base.paddingTop = st.padY;
    base.paddingBottom = st.padY;
  }
  if (typeof st.bg === "string") base.background = st.bg;
  if (typeof st.weight === "number") base.flex = st.weight;
  if (typeof st.alpha === "number") base.opacity = st.alpha;
  base.boxSizing = "border-box";
  const kids = (list: UiNode[]) => list.map((c) => <Compose key={c.uid} n={c} p={p} />);
  const clickable = () => p.onClick(n.uid);
  switch (n.type) {
    case "ComposeRoot":
      return <>{kids(n.children)}</>;
    case "Scaffold": {
      const top = n.children.filter((c) => c.type === "topBar");
      const body = n.children.filter((c) => c.type === "ScaffoldBody");
      const bottom = n.children.filter((c) => c.type === "bottomBar");
      const fab = n.children.filter((c) => c.type === "fab");
      return (
        <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", position: "relative", ...base }}>
          {top.map((t) => (
            <div key={t.uid}>{kids(t.children)}</div>
          ))}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "auto" }}>{body.map((b) => kids(b.children))}</div>
          {bottom.map((t) => (
            <div key={t.uid}>{kids(t.children)}</div>
          ))}
          {fab.length > 0 && <div style={{ position: "absolute", right: 16, bottom: 16 }}>{fab.map((t) => kids(t.children))}</div>}
        </div>
      );
    }
    case "TopAppBar":
    case "CenterAlignedTopAppBar":
      return (
        <div style={{ padding: "14px 16px", fontSize: 22, color: "#1C1B1F", background: "#FFFBFE", ...base }}>
          {n.children.map((t) => kids(t.children))}
        </div>
      );
    case "Column":
    case "LazyColumn":
      return (
        <div
          style={{
            display: "flex", flexDirection: "column", gap: (n.props.gap as number) || 0, minHeight: 0,
            justifyContent: arrangement(n.props.vArr as string, true), alignItems: alignment(n.props.hAlign as string),
            overflowY: n.type === "LazyColumn" ? "auto" : undefined, ...base,
          }}
          onClick={st.clickable ? clickable : undefined}
        >
          {kids(n.children)}
        </div>
      );
    case "Row":
    case "LazyRow":
      return (
        <div
          style={{
            display: "flex", flexDirection: "row", gap: (n.props.gap as number) || 0,
            justifyContent: arrangement(n.props.hArr as string, false), alignItems: alignment(n.props.vAlign as string) === "flex-start" ? "center" : alignment(n.props.vAlign as string),
            ...base,
          }}
        >
          {kids(n.children)}
        </div>
      );
    case "Box":
      return (
        <div style={{ display: "flex", justifyContent: /Center|End/.test(String(n.props.align)) ? "center" : "flex-start", alignItems: /Center/.test(String(n.props.align)) ? "center" : "flex-start", ...base }}>
          {kids(n.children)}
        </div>
      );
    case "Card":
    case "ElevatedCard":
    case "OutlinedCard":
      return (
        <div style={{ background: "#F3EDF7", borderRadius: 12, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", ...base }}>
          {kids(n.children)}
        </div>
      );
    case "Surface":
      return <div style={{ background: (n.props.bg as string) || "#FFFBFE", display: "flex", flexDirection: "column", width: "100%", height: "100%", ...base }}>{kids(n.children)}</div>;
    case "Spacer":
      return <div style={{ flexShrink: 0, ...base }} />;
    case "Divider":
    case "HorizontalDivider":
      return <div style={{ height: 1, background: "#CAC4D0", alignSelf: "stretch" }} />;
    case "Text": {
      const t = n.props.typo ? TYPO[String(n.props.typo)] : undefined;
      return (
        <span
          style={{
            color: (n.props.color as string) || "#1C1B1F", fontSize: (n.props.fontSize as number) || (t ? t.size : 14),
            fontWeight: n.props.bold ? 700 : t ? t.weight : 400, textAlign: (n.props.align as React.CSSProperties["textAlign"]) || undefined,
            whiteSpace: "pre-wrap", ...base,
          }}
          onClick={st.clickable ? clickable : undefined}
        >
          {String(n.props.text)}
        </span>
      );
    }
    case "Button":
    case "OutlinedButton":
    case "TextButton":
    case "ElevatedButton":
    case "FilledTonalButton":
    case "IconButton": {
      const outlined = n.type === "OutlinedButton";
      const text = n.type === "TextButton";
      return (
        <button
          type="button"
          disabled={n.props.enabled === false}
          onClick={clickable}
          style={{
            background: text || outlined ? "transparent" : n.type === "FilledTonalButton" ? "#E8DEF8" : "#6650A4", color: text || outlined ? "#6650A4" : n.type === "FilledTonalButton" ? "#1D192B" : "#fff",
            border: outlined ? "1px solid #79747E" : "none", borderRadius: 20, padding: "9px 22px", fontSize: 14, fontWeight: 500, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6, opacity: n.props.enabled === false ? 0.4 : 1, ...base,
          }}
        >
          {n.children.length ? kids(n.children).map((k) => k) : "Button"}
        </button>
      );
    }
    case "FloatingActionButton":
    case "ExtendedFloatingActionButton":
      return (
        <button type="button" onClick={clickable} style={{ background: "#EADDFF", color: "#21005D", border: "none", borderRadius: 16, minWidth: 56, height: 56, fontSize: 18, cursor: "pointer" }}>
          {kids(n.children)}
        </button>
      );
    case "TextField":
    case "OutlinedTextField":
      return (
        <label style={{ display: "flex", flexDirection: "column", fontSize: 12, color: "#49454F", ...base }}>
          {n.props.label ? <span>{String(n.props.label)}</span> : null}
          <input
            value={String(n.props.value ?? "")}
            placeholder={n.props.placeholder ? String(n.props.placeholder) : undefined}
            disabled={n.props.enabled === false}
            inputMode={/Number|Decimal/.test(String(n.props.keyboard)) ? "decimal" : undefined}
            onChange={(e) => p.onInput(n.uid, e.target.value)}
            style={{ border: "1px solid #79747E", borderRadius: 4, padding: "10px 12px", fontSize: 16, color: "#1C1B1F", background: "#fff", width: "100%", boxSizing: "border-box" }}
          />
        </label>
      );
    case "Checkbox":
    case "RadioButton":
      return (
        <input
          type={n.type === "Checkbox" ? "checkbox" : "radio"}
          checked={n.props.checked === true}
          onChange={() => (n.type === "RadioButton" ? p.onClick(n.uid) : p.onToggle(n.uid, !(n.props.checked === true)))}
          style={{ width: 20, height: 20, accentColor: "#6650A4" }}
        />
      );
    case "Switch":
      return (
        <input type="checkbox" role="switch" checked={n.props.checked === true} onChange={() => p.onToggle(n.uid, !(n.props.checked === true))} style={{ width: 40, height: 22, accentColor: "#6650A4" }} />
      );
    case "Slider":
      return (
        <input
          type="range" min={Number(n.props.min)} max={Number(n.props.max)} step="any" value={Number(n.props.value)}
          onChange={(e) => p.onInput(n.uid, e.target.value)} style={{ accentColor: "#6650A4", ...base }}
        />
      );
    case "CircularProgressIndicator":
      return <div style={{ width: 32, height: 32, border: "4px solid #E8DEF8", borderTopColor: "#6650A4", borderRadius: "50%" }} />;
    case "LinearProgressIndicator":
      return <progress value={n.props.progress === null ? undefined : Number(n.props.progress)} max={1} style={{ accentColor: "#6650A4", ...base }} />;
    case "Icon":
    case "Image":
      return <div title={String(n.props.description || "")} style={{ width: 24, height: 24, background: "#CAC4D0", borderRadius: 4, ...base }} />;
    default:
      return <div style={base}>{kids(n.children)}</div>;
  }
};

const View: React.FC<{ n: UiNode; p: EmulatorScreenProps; parentRow: boolean }> = ({ n, p, parentRow }) => {
  const pr = n.props;
  if (pr.visibility === 8) return null;
  const sty: React.CSSProperties = { boxSizing: "border-box" };
  if (pr.visibility === 4) sty.visibility = "hidden";
  const pad = dp(pr.padding);
  if (pad !== undefined) sty.padding = pad;
  const mar = dp(pr.margin);
  if (mar !== undefined) sty.margin = mar;
  if (pr.bg) sty.background = String(pr.bg);
  const w = String(pr.width || "");
  const h = String(pr.height || "");
  if (w === "match_parent" || w === "fill_parent") {
    if (parentRow) sty.flex = 1;
    else sty.alignSelf = "stretch";
  } else if (dp(w) !== undefined) sty.width = dp(w);
  if (h === "match_parent") {
    if (!parentRow) sty.flex = 1;
    else sty.alignSelf = "stretch";
  } else if (dp(h) !== undefined) sty.height = dp(h);
  if (pr.weight) sty.flex = Number(pr.weight);
  const kids = (row: boolean) => n.children.map((c) => <View key={c.uid} n={c} p={p} parentRow={row} />);
  const label = String(pr.text ?? "");
  const textStyle: React.CSSProperties = {
    fontSize: pr.textSize ? Number(pr.textSize) : 14, color: (pr.textColor as string) || "#000", fontWeight: pr.bold ? 700 : 400, whiteSpace: "pre-wrap", ...sty,
  };
  switch (n.type) {
    case "LinearLayout":
    case "TableLayout":
    case "TableRow": {
      const row = n.type === "TableRow" || pr.orientation !== "vertical";
      const g = String(pr.gravity || "");
      return (
        <div style={{ display: "flex", flexDirection: row ? "row" : "column", justifyContent: /center_horizontal|center/.test(g) && row ? "center" : undefined, alignItems: /center/.test(g) ? "center" : undefined, ...sty }}>
          {kids(row)}
        </div>
      );
    }
    case "ScrollView":
      return <div style={{ overflowY: "auto", ...sty }}>{kids(false)}</div>;
    case "TextView":
      return <span style={{ display: "block", ...textStyle }}>{label}</span>;
    case "Button":
    case "ImageButton":
      return (
        <button
          type="button" disabled={pr.enabled === false} onClick={() => p.onClick(n.uid)}
          style={{ background: "#6650A4", color: "#fff", border: "none", borderRadius: 20, padding: "8px 18px", fontSize: 14, cursor: "pointer", opacity: pr.enabled === false ? 0.4 : 1, alignSelf: w === "match_parent" ? "stretch" : "flex-start", ...sty }}
        >
          {label}
        </button>
      );
    case "EditText": {
      const numeric = /number|phone|decimal/.test(String(pr.inputType));
      return (
        <div style={{ display: "flex", flexDirection: "column", ...sty }}>
          <input
            value={label} placeholder={String(pr.hint || "")} inputMode={numeric ? "decimal" : undefined} disabled={pr.enabled === false}
            type={/password/i.test(String(pr.inputType)) ? "password" : "text"}
            onChange={(e) => p.onInput(n.uid, e.target.value)}
            style={{ border: "none", borderBottom: "2px solid #6650A4", padding: "8px 4px", fontSize: pr.textSize ? Number(pr.textSize) : 16, background: "transparent", color: (pr.textColor as string) || "#000", outline: "none" }}
          />
          {pr.error ? <span style={{ color: "#B3261E", fontSize: 12 }}>{String(pr.error)}</span> : null}
        </div>
      );
    }
    case "CheckBox":
    case "Switch":
    case "SwitchCompat":
    case "RadioButton":
    case "ToggleButton":
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#000", ...sty }}>
          <input
            type={n.type === "RadioButton" ? "radio" : "checkbox"} checked={pr.checked === true} disabled={pr.enabled === false}
            onChange={() => p.onClick(n.uid)} style={{ accentColor: "#6650A4", width: 18, height: 18 }}
          />
          {label}
        </label>
      );
    case "ProgressBar":
      return <progress value={Number(pr.progress)} max={Number(pr.max)} style={{ accentColor: "#6650A4", ...sty }} />;
    case "SeekBar":
      return <input type="range" value={Number(pr.progress)} max={Number(pr.max)} readOnly style={{ accentColor: "#6650A4", ...sty }} />;
    case "ListView":
      return (
        <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", ...sty }}>
          {n.children.map((c) => (
            <div key={c.uid} onClick={() => p.onClick(c.uid)} style={{ padding: "12px 8px", borderBottom: "1px solid #ddd", fontSize: 16, color: "#000", cursor: "pointer" }}>
              {String(c.props.text)}
            </div>
          ))}
        </div>
      );
    case "ImageView":
      return <div style={{ background: "#D9D9D9", minHeight: 48, minWidth: 48, ...sty }} />;
    case "Space":
      return <div style={sty} />;
    default:
      return <div style={{ display: "flex", flexDirection: "column", position: "relative", ...sty }}>{kids(false)}</div>;
  }
};

export const EmulatorScreen: React.FC<EmulatorScreenProps> = (props) => {
  const { screen, onDialogButton, onDismissCrash } = props;
  const views = screen.mode === "views";
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FFFBFE", fontFamily: FONT, overflow: "hidden" }}>
      {views && (
        <div style={{ background: "#6650A4", color: "#fff", padding: "12px 16px", fontSize: 18, fontWeight: 500, flexShrink: 0 }}>{screen.label}</div>
      )}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
        {screen.root && views && <View n={screen.root} p={props} parentRow={false} />}
        {screen.root && screen.mode === "compose" && <Compose n={screen.root} p={props} />}
        {!screen.root && !screen.crash && (
          <div style={{ margin: "auto", color: "#79747E", fontSize: 13, textAlign: "center", padding: 16 }}>
            {screen.finished ? "The app has no visible activity (it finished). Press Run to launch it again." : "This activity has not shown any content (setContentView / setContent was not called)."}
          </div>
        )}
      </div>
      {screen.toasts.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 56, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, pointerEvents: "none" }}>
          {screen.toasts.map((t, i) => (
            <div key={i} style={{ background: "rgba(50,50,50,0.92)", color: "#fff", borderRadius: 20, padding: "8px 16px", fontSize: 13, maxWidth: "85%" }}>
              {t}
            </div>
          ))}
        </div>
      )}
      {screen.dialog && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#ECE6F0", borderRadius: 24, padding: 20, width: "100%", color: "#1C1B1F" }}>
            {screen.dialog.title && <div style={{ fontSize: 20, marginBottom: 8 }}>{screen.dialog.title}</div>}
            {screen.dialog.message && <div style={{ fontSize: 14, color: "#49454F", marginBottom: 16 }}>{screen.dialog.message}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              {screen.dialog.buttons.map((b) => (
                <button key={b.id} type="button" onClick={() => onDialogButton(b.id)} style={{ background: "transparent", border: "none", color: "#6650A4", fontSize: 14, fontWeight: 500, cursor: "pointer", padding: "8px 12px" }}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {screen.crash && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div role="alertdialog" aria-label={screen.crash.title} style={{ background: "#ECE6F0", borderRadius: 24, padding: 20, width: "100%", color: "#1C1B1F" }}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>{screen.crash.title}</div>
            <div style={{ fontSize: 12, color: "#49454F", marginBottom: 16, maxHeight: 120, overflow: "auto", wordBreak: "break-word" }}>
              {screen.crash.kind === "exception" ? "The app crashed. The exception is shown in Logcat (E/AndroidRuntime)." : screen.crash.message}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={onDismissCrash} style={{ background: "transparent", border: "none", color: "#6650A4", fontSize: 14, fontWeight: 500, cursor: "pointer", padding: "8px 12px" }}>
                Close app
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
