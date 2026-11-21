"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import api from "@/lib/api";
import { buildEducationalHttpsDnsCapture, evaluateSampleFilter } from "@/lib/netlab/wsSampleCapture";
import { PracticeBanner } from "./PracticeBanner";
import { WsPacketDiagram } from "./WsPacketDiagram";
import { useStudioHook } from "./studioHook";
import styles from "./wireshark.module.css";
import {
  WiresharkLogoIcon,
  WsApplyFilterArrowIcon,
  WsAutoScrollIcon,
  WsBookmarkIcon,
  WsCaptureOptionsIcon,
  WsCaptureRestartIcon,
  WsCaptureStartIcon,
  WsCaptureStopIcon,
  WsClearFilterIcon,
  WsCloseFileIcon,
  WsColorizeIcon,
  WsExpertStatusCircle,
  WsFindIcon,
  WsFirstPacketIcon,
  WsFollowStreamIcon,
  WsGoToPacketIcon,
  WsInterfaceTypeIcon,
  WsLastPacketIcon,
  WsNextPacketIcon,
  WsOpenFolderIcon,
  WsPacketDiagramIcon,
  WsPrevPacketIcon,
  WsReloadIcon,
  WsResizeColsIcon,
  WsSaveIcon,
  WsZoomInIcon,
  WsZoomOutIcon,
  WsZoomResetIcon,
} from "./WiresharkIcons";

interface Row {
  no: number;
  time: number;
  source: string;
  destination: string;
  protocol: string;
  length: number;
  info: string;
  stream: number;
  color: { rule: string; bg: string; fg: string };
}
interface TreeNode {
  label: string;
  start: number;
  end: number;
  children: TreeNode[];
}
interface Detail {
  no: number;
  tree: TreeNode[];
  hex: { offset: number; hex: string[]; ascii: string }[];
  bytes: number;
  row: Row;
}
interface StreamData {
  stream: number;
  packets: number[];
  client: string;
  server: string;
  client_packets: number;
  server_packets: number;
  turns: number;
  chunks: { side: "c" | "s"; text: string; bytes: number }[];
}
interface BrowserPage {
  host: string;
  uri: string;
  fields: string[];
  values: Record<string, string>;
}
interface Step {
  id: string;
  view: "welcome" | "main" | "browser" | "follow";
  filter?: string;
  select?: number;
  expand?: string[];
  host?: string;
  uri?: string;
  stream?: number;
  title: string;
}
interface FrozenState {
  tool: "wireshark";
  source: string;
  packets: Row[];
  details: Record<string, Detail>;
  filters: Record<string, number[]>;
  streams: Record<string, StreamData>;
  pages: Record<string, BrowserPage>;
  interfaces: string[];
  file: string;
}

const MENU_ITEMS = ["File", "Edit", "View", "Go", "Capture", "Analyze", "Statistics", "Telephony", "Wireless", "Tools", "Help"];
const QUICK_FILTERS = ["arp", "http", "tcp", "udp", "icmp", "dns", 'ip.addr == 192.168.1.1', "tcp.port == 443", 'dns.qry.name contains "google"', 'http.request.method == "POST"'];

function Spark({ seed, selected }: { seed: number; selected?: boolean }) {
  const pts: string[] = [];
  for (let i = 0; i < 32; i++) {
    const val = Math.abs(Math.sin(i * 0.68 + seed * 1.4) * 0.65 + Math.cos(i * 1.3 + seed) * 0.35);
    const y = 18 - Math.round(val * 14);
    pts.push(`${i * 4.5},${y}`);
  }
  const poly = pts.join(" ");
  return (
    <svg width="144" height="20" aria-hidden="true">
      <polyline points={poly} fill="none" stroke={selected ? "#0F4C81" : "#1D6FD8"} strokeWidth="1.25" />
    </svg>
  );
}

function nodeKey(path: number[]) {
  return path.join(".");
}

function findByPrefix(tree: TreeNode[], names: string[]): { key: string; node: TreeNode }[] {
  const found: { key: string; node: TreeNode }[] = [];
  tree.forEach((node, index) => {
    if (names.some((name) => node.label.startsWith(name))) found.push({ key: nodeKey([index]), node });
  });
  return found;
}

export function WiresharkStudio() {
  const [view, setView] = useState<Step["view"]>("welcome");
  const [rows, setRows] = useState<Row[]>([]);
  const [file, setFile] = useState("");
  const [interfaces, setInterfaces] = useState<string[]>(["Ethernet", "Wi-Fi", "Loopback: Adapter for loopback traffic capture"]);
  const [selectedIface, setSelectedIface] = useState(0);
  const [filterText, setFilterText] = useState("");
  const [applied, setApplied] = useState("");
  const [filterError, setFilterError] = useState("");
  const [visible, setVisible] = useState<number[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [pickedNode, setPickedNode] = useState<string | null>(null);
  const [follow, setFollow] = useState<StreamData | null>(null);
  const [page, setPage] = useState<BrowserPage | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(0);

  // Authentic Wireshark UI interactive toggles
  const [colorize, setColorize] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showDiagram, setShowDiagram] = useState(false);
  const [diagramRange, setDiagramRange] = useState<{ start: number; end: number } | null>(null);
  const [localSampleMode, setLocalSampleMode] = useState(false);
  const [statsModal, setStatsModal] = useState<"hierarchy" | "properties" | null>(null);
  const [zoomDelta, setZoomDelta] = useState(0);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [followFind, setFollowFind] = useState("");
  const [followDirection, setFollowDirection] = useState("entire");
  const [isCaptureMode, setIsCaptureMode] = useState(false);

  const localDetailsRef = useRef<Record<string, Detail>>({});
  const localStreamsRef = useRef<Record<string, StreamData>>({});

  const frozen = useRef<FrozenState | null>(null);
  const token = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const upload = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsCaptureMode(new URLSearchParams(window.location.search).get("capture") === "1");
  }, []);

  useEffect(() => {
    if (!openMenu && !showBookmarks) return;
    const close = () => {
      setOpenMenu(null);
      setShowBookmarks(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [openMenu, showBookmarks]);

  const selectPacket = useCallback(
    async (number: number, expandNames?: string[]) => {
      setDiagramRange(null);
      let next: Detail | undefined;
      if (frozen.current) next = frozen.current.details[String(number)];
      else if (localSampleMode) next = localDetailsRef.current[String(number)];
      else if (token.current) {
        try {
          next = (await api.get(`/api/netlab/wireshark/${token.current}/packet/${number}`)).data;
        } catch {
          setMessage("The capture is no longer open on the server. Open the file again.");
        }
      }
      if (!next) return;
      setSelected(number);
      setDetail(next);
      const wanted = findByPrefix(next.tree, expandNames ?? []);
      setOpen(new Set(wanted.map((item) => item.key)));
      setPickedNode(wanted.length ? wanted[0].key : null);
    },
    [localSampleMode],
  );

  const applyFilter = useCallback(async (expression: string) => {
    const text = expression.trim();
    setFilterError("");
    if (!text) {
      setApplied("");
      setVisible(null);
      return;
    }
    if (localSampleMode) {
      const res = evaluateSampleFilter(rows, text);
      if (res.ok) {
        setApplied(text);
        setVisible(res.numbers ?? []);
      } else {
        setFilterError(res.error ?? "Invalid filter syntax.");
      }
      return;
    }
    if (frozen.current) {
      const hit = frozen.current.filters[text];
      if (hit) {
        setApplied(text);
        setVisible(hit);
      } else {
        setFilterError("This filter is not available in the recorded view.");
      }
      return;
    }
    if (!token.current) return;
    try {
      const response = await api.get(`/api/netlab/wireshark/${token.current}/filter`, { params: { expr: text } });
      setApplied(text);
      setVisible(response.data.numbers);
    } catch (error: unknown) {
      const detailText = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFilterError(typeof detailText === "string" ? detailText : "The filter could not be applied.");
    }
  }, [localSampleMode, rows]);

  const openGoogleDnsSample = useCallback(() => {
    const sample = buildEducationalHttpsDnsCapture();
    token.current = null;
    frozen.current = null;
    localDetailsRef.current = sample.details;
    localStreamsRef.current = sample.streams;
    setLocalSampleMode(true);
    setRows(sample.packets);
    setFile(sample.file);
    setApplied("");
    setFilterText("");
    setFilterError("");
    setVisible(null);
    setSelected(1);
    setDetail(sample.details["1"]);
    setFollow(null);
    setMessage("");
    setView("main");
  }, []);

  const openCapture = useCallback(async (picked?: File) => {
    setBusy("Reading the capture…");
    setMessage("");
    try {
      const form = new FormData();
      if (picked) form.append("file", picked);
      else form.append("scenario", "true");
      const response = await api.post("/api/netlab/wireshark/open", form, { headers: { "Content-Type": "multipart/form-data" } });
      token.current = response.data.token;
      frozen.current = null;
      setLocalSampleMode(false);
      setRows(response.data.rows);
      setFile(response.data.file);
      setInterfaces(response.data.interfaces);
      setApplied("");
      setFilterText("");
      setFilterError("");
      setVisible(null);
      setSelected(null);
      setDetail(null);
      setFollow(null);
      setView("main");
      if (response.data.rows?.length) {
        const firstNo = response.data.rows[0].no;
        setTimeout(async () => {
          if (!token.current) return;
          try {
            const firstDetail = (await api.get(`/api/netlab/wireshark/${token.current}/packet/${firstNo}`)).data;
            setSelected(firstNo);
            setDetail(firstDetail);
            setOpen(new Set());
            setPickedNode(null);
          } catch {
            /* ignore initial auto-select failure */
          }
        }, 0);
      }
    } catch (error: unknown) {
      const detailText = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMessage(typeof detailText === "string" ? detailText : "The capture could not be opened.");
    } finally {
      setBusy("");
    }
  }, []);

  const closeCapture = useCallback(() => {
    token.current = null;
    frozen.current = null;
    setLocalSampleMode(false);
    setRows([]);
    setFile("");
    setApplied("");
    setFilterText("");
    setFilterError("");
    setVisible(null);
    setSelected(null);
    setDetail(null);
    setFollow(null);
    setMessage("");
    setView("welcome");
  }, []);

  const followStream = useCallback(async (index: number) => {
    if (frozen.current) {
      const s = frozen.current.streams[String(index)] ?? null;
      if (s) {
        setFollow(s);
        setView("follow");
      }
      return;
    }
    if (localSampleMode) {
      const s = localStreamsRef.current[String(index)] ?? null;
      if (s) {
        setFollow(s);
        setView("follow");
      }
      return;
    }
    if (!token.current) return;
    try {
      const data = (await api.get(`/api/netlab/wireshark/${token.current}/stream/${index}`)).data;
      setFollow(data);
      setView("follow");
    } catch {
      setMessage("The stream could not be loaded.");
    }
  }, [localSampleMode]);

  // --- Capture hook for automated LabMate screenshots ---
  useStudioHook<FrozenState, Step>(
    {
      load: (state) => {
        frozen.current = state;
        token.current = null;
        setRows(state.packets);
        setFile(state.file);
        setInterfaces(state.interfaces);
        setTick((n) => n + 1);
      },
      show: (step) => {
        const state = frozen.current;
        if (!state) return;
        setView(step.view);
        setFollow(null);
        setFilterError("");
        if (step.view === "main" || step.view === "follow") {
          const expression = step.view === "follow" ? `tcp.stream eq ${step.stream}` : step.filter ?? "";
          const numbers = step.view === "follow" ? state.streams[String(step.stream)]?.packets ?? null : state.filters[step.filter ?? ""] ?? null;
          setFilterText(expression);
          setApplied(expression);
          setVisible(expression ? numbers : null);
          if (step.select) void selectPacket(step.select, step.expand);
          if (step.view === "follow" && step.stream !== undefined) setFollow(state.streams[String(step.stream)] ?? null);
        }
        if (step.view === "browser" && step.host) setPage(state.pages[step.host] ?? null);
        setTick((n) => n + 1);
      },
    },
    `${tick}:${view}:${selected}:${applied}:${detail?.no}`,
  );

  useEffect(() => {
    if (selected !== null) listRef.current?.querySelector(`[data-no="${selected}"]`)?.scrollIntoView({ block: "center" });
  }, [selected, visible, view]);

  const shown = useMemo(() => {
    if (!visible) return rows;
    const keep = new Set(visible);
    return rows.filter((row) => keep.has(row.no));
  }, [rows, visible]);

  const jumpRelative = useCallback(
    (delta: number | "first" | "last") => {
      if (!shown.length) return;
      if (delta === "first") {
        void selectPacket(shown[0].no);
        return;
      }
      if (delta === "last") {
        void selectPacket(shown[shown.length - 1].no);
        return;
      }
      const curIdx = shown.findIndex((r) => r.no === selected);
      const targetIdx = curIdx < 0 ? 0 : Math.max(0, Math.min(shown.length - 1, curIdx + delta));
      void selectPacket(shown[targetIdx].no);
    },
    [shown, selected, selectPacket],
  );

  const runFind = useCallback(() => {
    const q = findQuery.trim().toLowerCase();
    if (!q || !shown.length) return;
    const startIdx = Math.max(0, shown.findIndex((r) => r.no === selected) + 1);
    const ordered = [...shown.slice(startIdx), ...shown.slice(0, startIdx)];
    const match = ordered.find(
      (r) =>
        (/^\d+$/.test(q) && r.no === Number(q)) ||
        r.info.toLowerCase().includes(q) ||
        r.protocol.toLowerCase().includes(q) ||
        r.source.toLowerCase().includes(q) ||
        r.destination.toLowerCase().includes(q),
    );
    if (match) void selectPacket(match.no);
    else setMessage(`No packet matching "${findQuery}" found.`);
  }, [findQuery, shown, selected, selectPacket]);

  const highlight = useMemo(() => {
    if (diagramRange) return diagramRange;
    if (!detail || pickedNode === null) return null;
    let nodes = detail.tree;
    let node: TreeNode | undefined;
    for (const part of pickedNode.split(".").map(Number)) {
      node = nodes[part];
      if (!node) return null;
      nodes = node.children;
    }
    return node && node.end > node.start ? { start: node.start, end: node.end } : null;
  }, [detail, pickedNode, diagramRange]);

  const renderNode = (node: TreeNode, path: number[], depth: number): JSX.Element[] => {
    const key = nodeKey(path);
    const expandable = node.children.length > 0;
    const isOpen = open.has(key);
    const out: JSX.Element[] = [
      <div
        key={key}
        className={`${styles.treeNode} ${pickedNode === key ? styles.treeNodeSelected : ""}`}
        style={{ paddingLeft: 6 + depth * 15, fontSize: `${11.5 + zoomDelta}px` }}
        onClick={() => {
          setDiagramRange(null);
          setPickedNode(key);
          if (expandable) {
            const next = new Set(open);
            if (isOpen) next.delete(key);
            else next.add(key);
            setOpen(next);
          }
        }}
      >
        <span className={styles.treeToggle}>{expandable ? (isOpen ? "▼" : "▶") : ""}</span>
        <span>{node.label}</span>
      </div>,
    ];
    if (expandable && isOpen) node.children.forEach((child, index) => out.push(...renderNode(child, [...path, index], depth + 1)));
    return out;
  };

  const renderHex = () => {
    if (!detail) return null;
    return detail.hex.map((line) => {
      const cells = line.hex.map((byte, i) => {
        const position = line.offset + i;
        const on = highlight && position >= highlight.start && position < highlight.end;
        return (
          <span key={i} className={on ? styles.hexHl : undefined}>
            {byte}
            {i === 7 ? "  " : " "}
          </span>
        );
      });
      const pad = line.hex.length < 16 ? " ".repeat((16 - line.hex.length) * 3 + (line.hex.length <= 8 ? 1 : 0)) : "";
      const text = line.ascii.split("").map((char, i) => {
        const position = line.offset + i;
        const on = highlight && position >= highlight.start && position < highlight.end;
        return (
          <span key={i} className={on ? styles.hexHl : undefined}>
            {char}
          </span>
        );
      });
      return (
        <div key={line.offset} className={styles.hexRow} style={{ fontSize: `${11.5 + zoomDelta}px` }}>
          <span className={styles.hexOffset}>{line.offset.toString(16).padStart(4, "0")}</span>
          {"  "}
          {cells}
          {pad}
          {"  "}
          {text}
        </div>
      );
    });
  };

  const canFollowStream = Boolean(detail && detail.row.stream >= 0 && detail.row.protocol !== "ARP");
  const filterClass = filterError ? styles.filterInvalid : applied ? styles.filterValid : "";
  const pct = rows.length ? ((shown.length / rows.length) * 100).toFixed(1) : "0.0";
  const inCaptureView = view === "main" || view === "follow";
  const canSaveCapture = inCaptureView && Boolean(token.current) && !localSampleMode;

  async function saveCapture() {
    const id = token.current;
    if (!id) return;
    try {
      const response = await api.get<Blob>(`/api/netlab/wireshark/${id}/download`, { responseType: "blob" });
      const disposition = String(response.headers["content-disposition"] || "");
      const filename = /filename="(capture\.pcap(?:ng)?)"/.exec(disposition)?.[1] || "capture.pcap";
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage("Could not save this capture. Reopen it and try again.");
    }
  }

  const getMenuEntries = (
    name: string,
  ): Array<{ divider: true } | { label: string; shortcut?: string; disabled?: boolean; action: () => void }> => {
    if (name === "File")
      return [
        { label: "Open...", shortcut: "Ctrl+O", action: () => upload.current?.click() },
        { label: "Save capture", disabled: !canSaveCapture, action: () => void saveCapture() },
        { label: "Open Practice Capture (HTTP/ARP)", shortcut: "", action: () => void openCapture() },
        { label: "Open Sample: DNS (google.com) + TLS :443", shortcut: "", action: openGoogleDnsSample },
        { divider: true },
        { label: "Close", shortcut: "Ctrl+W", disabled: !inCaptureView, action: closeCapture },
      ];
    if (name === "Edit")
      return [
        { label: "Find Packet...", shortcut: "Ctrl+F", disabled: !inCaptureView, action: () => setFindOpen((v) => !v) },
      ];
    if (name === "View")
      return [
        { label: colorize ? "✓ Colorize Packet List" : "Colorize Packet List", shortcut: "", action: () => setColorize((v) => !v) },
        { label: showDiagram ? "✓ Packet Diagram" : "Packet Diagram", shortcut: "", action: () => setShowDiagram((v) => !v) },
        { divider: true },
        { label: "Expand All Layers", shortcut: "", disabled: !detail, action: () => detail && setOpen(new Set(detail.tree.map((_, i) => String(i)))) },
        { label: "Collapse All Layers", shortcut: "", disabled: !detail, action: () => setOpen(new Set()) },
        { divider: true },
        { label: "Zoom In", shortcut: "Ctrl++", action: () => setZoomDelta((z) => Math.min(4, z + 1)) },
        { label: "Zoom Out", shortcut: "Ctrl+-", action: () => setZoomDelta((z) => Math.max(-2, z - 1)) },
        { label: "Normal Size", shortcut: "Ctrl+=", action: () => setZoomDelta(0) },
      ];
    if (name === "Statistics")
      return [
        { label: "Capture File Properties", disabled: !inCaptureView, action: () => setStatsModal("properties") },
        { label: "Protocol Hierarchy", disabled: !inCaptureView, action: () => setStatsModal("hierarchy") },
      ];
    if (name === "Go")
      return [
        { label: "Previous Packet", shortcut: "Ctrl+Up", disabled: !shown.length, action: () => jumpRelative(-1) },
        { label: "Next Packet", shortcut: "Ctrl+Down", disabled: !shown.length, action: () => jumpRelative(1) },
        { label: "First Packet", shortcut: "Ctrl+Home", disabled: !shown.length, action: () => jumpRelative("first") },
        { label: "Last Packet", shortcut: "Ctrl+End", disabled: !shown.length, action: () => jumpRelative("last") },
      ];
    if (name === "Capture")
      return [
        { label: "Start", shortcut: "Ctrl+E", action: () => void openCapture() },
        { label: "Stop", shortcut: "Ctrl+E", disabled: view === "welcome", action: closeCapture },
        { label: "Restart", shortcut: "Ctrl+R", disabled: view === "welcome", action: () => void openCapture() },
      ];
    if (name === "Analyze")
      return [
        { label: "Apply Display Filter", shortcut: "Enter", disabled: !inCaptureView, action: () => void applyFilter(filterText) },
        { label: "Clear Display Filter", shortcut: "", disabled: !inCaptureView, action: () => { setFilterText(""); void applyFilter(""); } },
        { divider: true },
        { label: "Follow > TCP Stream", shortcut: "Ctrl+Alt+Shift+T", disabled: !canFollowStream, action: () => detail && void followStream(detail.row.stream) },
      ];
    return [{ label: `${name} options (practice workspace)`, disabled: true, action: () => {} }];
  };

  return (
    <div className={styles.wsRoot}>
      <PracticeBanner tool="Wireshark" />

      {view !== "browser" ? (
        <>
          {/* Windows Title Bar */}
          <div className={styles.titleBar}>
            <div className={styles.titleLeft}>
              <WiresharkLogoIcon size={17} />
              <span className={styles.titleText}>
                {file ? `${file} — Wireshark` : "The Wireshark Network Analyzer"}
              </span>
            </div>
            <div className={styles.winCaptions} aria-hidden="true">
              <button type="button" className={styles.winBtn} tabIndex={-1}>
                ─
              </button>
              <button type="button" className={styles.winBtn} tabIndex={-1}>
                ☐
              </button>
              <button type="button" className={`${styles.winBtn} ${styles.winClose}`} tabIndex={-1}>
                ✕
              </button>
            </div>
          </div>

          {/* Menu Bar */}
          <div className={styles.menuBar} role="menubar" aria-label="Wireshark menu bar">
            {MENU_ITEMS.map((item) => (
              <div key={item} className={styles.menuItemWrap} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  role="menuitem"
                  className={`${styles.menuBtn} ${openMenu === item ? styles.menuBtnOpen : ""}`}
                  onClick={() => setOpenMenu((cur) => (cur === item ? null : item))}
                >
                  {item}
                </button>
                {openMenu === item && (
                  <div className={styles.menuDropdown} role="menu">
                    {getMenuEntries(item).map((entry, idx) => {
                      if ("divider" in entry) {
                        return <div key={idx} className={styles.menuDivider} />;
                      }
                      return (
                        <button
                          key={entry.label}
                          type="button"
                          role="menuitem"
                          className={styles.menuDropItem}
                          disabled={entry.disabled}
                          onClick={() => {
                            setOpenMenu(null);
                            entry.action();
                          }}
                        >
                          <span>{entry.label}</span>
                          {entry.shortcut ? <span className={styles.menuShortcut}>{entry.shortcut}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Main Toolbar */}
          <div className={styles.mainToolbar} role="toolbar" aria-label="Main Toolbar">
            <button className={styles.toolBtn} title="Start capturing packets" aria-label="Start capturing packets" onClick={() => void openCapture()}>
              <WsCaptureStartIcon size={18} />
            </button>
            <button className={styles.toolBtn} title="Stop capturing packets" aria-label="Stop capture" disabled={view === "welcome"} onClick={closeCapture}>
              <WsCaptureStopIcon size={17} />
            </button>
            <button className={styles.toolBtn} title="Restart current capture" aria-label="Restart capture" disabled={view === "welcome"} onClick={() => void openCapture()}>
              <WsCaptureRestartIcon size={18} />
            </button>
            <button className={styles.toolBtn} title="Capture options" aria-label="Capture options" onClick={() => setMessage(`Selected interface: ${interfaces[selectedIface] ?? "Ethernet"}`)}>
              <WsCaptureOptionsIcon size={17} />
            </button>

            <div className={styles.toolSep} />

            <button className={styles.toolBtn} title="Open a capture file" aria-label="Open a capture file" onClick={() => upload.current?.click()}>
              <WsOpenFolderIcon size={18} />
            </button>
            <button className={styles.toolBtn} title="Save this capture file" aria-label="Save capture file" disabled={!canSaveCapture} onClick={() => void saveCapture()}>
              <WsSaveIcon size={17} />
            </button>
            <button className={styles.toolBtn} title="Close this capture file" aria-label="Close capture file" disabled={!inCaptureView} onClick={closeCapture}>
              <WsCloseFileIcon size={17} />
            </button>
            <button className={styles.toolBtn} title="Reload this file" aria-label="Reload file" disabled={!inCaptureView} onClick={() => void openCapture()}>
              <WsReloadIcon size={17} />
            </button>

            <div className={styles.toolSep} />

            <button className={`${styles.toolBtn} ${findOpen ? styles.toolBtnActive : ""}`} title="Find a packet" aria-label="Find packet" disabled={!inCaptureView} onClick={() => setFindOpen((v) => !v)}>
              <WsFindIcon size={17} />
            </button>
            <button className={styles.toolBtn} title="Go to previous packet" aria-label="Previous packet" disabled={!shown.length} onClick={() => jumpRelative(-1)}>
              <WsPrevPacketIcon size={17} />
            </button>
            <button className={styles.toolBtn} title="Go to next packet" aria-label="Next packet" disabled={!shown.length} onClick={() => jumpRelative(1)}>
              <WsNextPacketIcon size={17} />
            </button>
            <button className={styles.toolBtn} title="Go to specified packet" aria-label="Go to packet" disabled={!shown.length} onClick={() => setFindOpen(true)}>
              <WsGoToPacketIcon size={17} />
            </button>
            <button className={styles.toolBtn} title="Go to the first packet" aria-label="First packet" disabled={!shown.length} onClick={() => jumpRelative("first")}>
              <WsFirstPacketIcon size={17} />
            </button>
            <button className={styles.toolBtn} title="Go to the last packet" aria-label="Last packet" disabled={!shown.length} onClick={() => jumpRelative("last")}>
              <WsLastPacketIcon size={17} />
            </button>
            <button className={`${styles.toolBtn} ${autoScroll ? styles.toolBtnActive : ""}`} title="Auto scroll in live capture" aria-label="Auto scroll" onClick={() => setAutoScroll((v) => !v)}>
              <WsAutoScrollIcon size={17} />
            </button>

            <div className={styles.toolSep} />

            <button className={`${styles.toolBtn} ${colorize ? styles.toolBtnActive : ""}`} title="Colorize Packet List" aria-label="Colorize Packet List" onClick={() => setColorize((v) => !v)}>
              <WsColorizeIcon size={17} />
            </button>
            <button className={styles.toolBtn} title="Zoom In" aria-label="Zoom In" onClick={() => setZoomDelta((z) => Math.min(4, z + 1))}>
              <WsZoomInIcon size={17} />
            </button>
            <button className={styles.toolBtn} title="Zoom Out" aria-label="Zoom Out" onClick={() => setZoomDelta((z) => Math.max(-2, z - 1))}>
              <WsZoomOutIcon size={17} />
            </button>
            <button className={styles.toolBtn} title="Normal Size" aria-label="Normal Size" onClick={() => setZoomDelta(0)}>
              <WsZoomResetIcon size={17} />
            </button>
            <button className={styles.toolBtn} title="Resize packet list columns to fit contents" aria-label="Resize columns" disabled={!inCaptureView}>
              <WsResizeColsIcon size={17} />
            </button>

            <div className={styles.toolSep} />

            <button
              className={styles.toolBtn}
              title="Follow TCP Stream"
              aria-label="Follow TCP stream"
              disabled={!canFollowStream}
              onClick={() => detail && void followStream(detail.row.stream)}
            >
              <WsFollowStreamIcon size={17} />
            </button>
            <button
              className={`${styles.toolBtn} ${showDiagram ? styles.toolBtnActive : ""}`}
              title="Toggle Packet Diagram Pane"
              aria-label="Toggle Packet Diagram"
              disabled={!inCaptureView}
              onClick={() => setShowDiagram((v) => !v)}
            >
              <WsPacketDiagramIcon size={17} />
            </button>

            <input
              ref={upload}
              type="file"
              accept=".pcap,.pcapng,.cap"
              hidden
              aria-label="Open capture file"
              onChange={(event) => {
                const picked = event.target.files?.[0];
                if (picked) void openCapture(picked);
                event.target.value = "";
              }}
            />
          </div>

          {/* Display Filter Toolbar */}
          <div className={styles.filterToolbar}>
            <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={styles.filterBookmarkBtn}
                title="Display filter bookmarks"
                aria-label="Display filter bookmarks"
                onClick={() => setShowBookmarks((v) => !v)}
              >
                <WsBookmarkIcon size={15} />
              </button>
              {showBookmarks && (
                <div className={styles.menuDropdown} style={{ minWidth: 230 }}>
                  {QUICK_FILTERS.map((expr) => (
                    <button
                      key={expr}
                      type="button"
                      className={styles.menuDropItem}
                      style={{ paddingLeft: 12 }}
                      onClick={() => {
                        setShowBookmarks(false);
                        setFilterText(expr);
                        if (inCaptureView) void applyFilter(expr);
                      }}
                    >
                      <span>{expr}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={`${styles.filterInputBox} ${filterClass}`}>
              <input
                className={styles.filterInput}
                aria-label="Display filter"
                value={filterText}
                placeholder="Apply a display filter ... <Ctrl-/>"
                onChange={(event) => setFilterText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void applyFilter(filterText);
                }}
              />
              {filterText ? (
                <button
                  type="button"
                  className={styles.filterInlineBtn}
                  title="Clear display filter"
                  aria-label="Clear"
                  onClick={() => {
                    setFilterText("");
                    void applyFilter("");
                  }}
                >
                  <WsClearFilterIcon size={14} />
                </button>
              ) : null}
              <button
                type="button"
                className={styles.filterInlineBtn}
                title="Filter History"
                aria-label="Filter History"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBookmarks((v) => !v);
                }}
              >
                <span style={{ fontSize: 9, color: "#555753" }}>▾</span>
              </button>
              <button
                type="button"
                className={styles.filterInlineBtn}
                style={{ width: 29, height: 22 }}
                title="Apply display filter"
                aria-label="Apply"
                onClick={() => void applyFilter(filterText)}
              >
                <WsApplyFilterArrowIcon size={28} />
              </button>
            </div>

            <button
              type="button"
              className={styles.filterActionBtn}
              title="Display filter presets"
              onClick={(e) => {
                e.stopPropagation();
                setShowBookmarks((v) => !v);
              }}
            >
              Expression…
            </button>
            {filterText && (
              <button
                type="button"
                className={styles.filterActionBtn}
                onClick={() => {
                  setFilterText("");
                  void applyFilter("");
                }}
              >
                Clear
              </button>
            )}
          </div>

          {findOpen && inCaptureView && (
            <div className={styles.filterToolbar} style={{ background: "#eef3f8" }}>
              <span style={{ fontWeight: 600 }}>Find:</span>
              <input
                className={styles.filterInputBox}
                style={{ maxWidth: 320, padding: "0 8px", background: "#fff" }}
                placeholder="Search packet Info, Protocol, or IP…"
                value={findQuery}
                onChange={(e) => setFindQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runFind();
                }}
              />
              <button type="button" className={styles.filterActionBtn} onClick={runFind}>
                Find
              </button>
              <button type="button" className={styles.filterActionBtn} onClick={() => setFindOpen(false)}>
                Close
              </button>
            </div>
          )}

          {filterError ? <div className={styles.filterErrorStrip}>{filterError}</div> : null}
        </>
      ) : null}

      {/* =================================================================
       * View 1: Authentic Wireshark 4.x Welcome / Interface Window
       * ================================================================= */}
      {view === "welcome" ? (
        <div className={styles.welcomeWrap}>
          <div className={styles.welcomeHeroBand}>
            <div className={styles.welcomeBrandRow}>
              <WiresharkLogoIcon size={26} />
              <h1>Welcome to Wireshark</h1>
            </div>
            <p className={styles.welcomeSubtitle}>LabMate Practice Capture Engine · Version 4.2</p>
          </div>

          <div className={styles.welcomeBody}>
            <div>
              <h2 className={styles.welcomeHeading}>Capture</h2>
              <div className={styles.captureFilterRow}>
                <span>…using this filter:</span>
                <WsBookmarkIcon size={14} />
                <input
                  className={styles.captureFilterInput}
                  placeholder="Enter a capture filter …"
                  readOnly
                />
                <select className={styles.followSelect} defaultValue="all" aria-label="Interface filter" style={{ height: 24 }}>
                  <option value="all">All interfaces shown</option>
                  <option value="wired">Wired</option>
                </select>
              </div>

              <div className={styles.ifaceList} role="listbox" aria-label="Capture interfaces">
                {interfaces.map((name, index) => (
                  <div
                    key={name}
                    role="option"
                    aria-selected={selectedIface === index}
                    className={`${styles.ifaceRow} ${selectedIface === index ? styles.ifaceSelected : ""}`}
                    onClick={() => setSelectedIface(index)}
                    onDoubleClick={() => void openCapture()}
                  >
                    <div className={styles.ifaceNameWrap}>
                      <WsInterfaceTypeIcon name={name} />
                      <span className={styles.ifaceName}>{name}</span>
                    </div>
                    <Spark seed={index + 1} selected={selectedIface === index} />
                  </div>
                ))}
              </div>

              {!isCaptureMode && (
                <div className={styles.welcomeActions}>
                  <button type="button" className={styles.btnPrimary} onClick={() => void openCapture()} disabled={!!busy}>
                    Start a practice capture
                  </button>
                  <button type="button" className={styles.btnSecondary} onClick={() => upload.current?.click()} disabled={!!busy}>
                    Open a .pcap or .pcapng file
                  </button>
                </div>
              )}

              {busy ? <p style={{ marginTop: 10 }}>{busy}</p> : null}
              {message ? (
                <p role="alert" style={{ color: "#b00020", marginTop: 10 }}>
                  {message}
                </p>
              ) : null}
            </div>

            <div>
              <h2 className={styles.welcomeHeading}>Open</h2>
              <div className={styles.recentList}>
                <button type="button" className={styles.recentLink} onClick={() => void openCapture()}>
                  <WsOpenFolderIcon size={15} />
                  <span>practice-capture.pcap (Built-in ARP, DNS, ICMP, TCP &amp; HTTP lab capture · 40 packets)</span>
                </button>
                <button type="button" className={styles.recentLink} onClick={openGoogleDnsSample}>
                  <WsOpenFolderIcon size={15} />
                  <span>google-dns-tls-sample.pcapng [Simulated] (DNS query for www.google.com + TCP/TLS port 443 · 12 packets)</span>
                </button>
                <button type="button" className={styles.recentLink} onClick={() => upload.current?.click()}>
                  <WsOpenFolderIcon size={15} />
                  <span>Browse for your own .pcap or .pcapng file…</span>
                </button>
              </div>
            </div>

            <div className={styles.learnBox}>
              <h2 className={styles.welcomeHeading} style={{ marginTop: 0 }}>
                Learn
              </h2>
              <div className={styles.learnLinks}>
                <span>User&apos;s Guide</span>
                <span>·</span>
                <span>Wiki</span>
                <span>·</span>
                <span>Questions and Answers</span>
                <span>·</span>
                <span>Mailing Lists</span>
              </div>
              <p>
                Double-click an interface above (or click the blue shark fin in the toolbar) to inspect packet traffic. Use{" "}
                <code>arp</code>, <code>http</code>, <code>tcp</code>, <code>icmp</code>, <code>dns</code>, or{" "}
                <code>ip.addr == 192.168.1.1</code>.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* =================================================================
       * View 2: Authentic Windows 11 Microsoft Edge Login Page
       * ================================================================= */}
      {view === "browser" ? (
        <div className={styles.browserBackdrop}>
          <div className={styles.browserWin}>
            <div className={styles.browserTabStrip}>
              <div className={styles.browserTab}>
                <span>Student Portal Login</span>
                <span style={{ opacity: 0.6 }}>✕</span>
              </div>
              <div className={styles.winCaptions} aria-hidden="true">
                <button type="button" className={styles.winBtn} tabIndex={-1}>
                  ─
                </button>
                <button type="button" className={styles.winBtn} tabIndex={-1}>
                  ☐
                </button>
                <button type="button" className={`${styles.winBtn} ${styles.winClose}`} tabIndex={-1}>
                  ✕
                </button>
              </div>
            </div>
            <div className={styles.browserToolbar}>
              <div className={styles.browserNavBtns} aria-hidden="true">
                <span>←</span>
                <span>→</span>
                <span>↻</span>
              </div>
              <div className={styles.browserUrlBar}>
                <span className={styles.notSecureBadge}>ⓘ Not secure</span>
                <span>
                  http://{page?.host ?? ""}
                  {page?.uri ?? ""}
                </span>
              </div>
            </div>
            <div className={styles.browserPage}>
              <div className={styles.loginCard}>
                <h3>Student Portal Login</h3>
                {(page?.fields?.length ? page.fields : ["uname", "pass"]).map((field) => {
                  const isPassword = /pass|pwd|secret/i.test(field);
                  const value = page?.values?.[field] ?? "";
                  return (
                    <div key={field}>
                      <label>{isPassword ? "Password" : "Username"}</label>
                      <div className={styles.loginField}>{isPassword ? "•".repeat(Math.max(value.length, 8)) : value}</div>
                    </div>
                  );
                })}
                <div className={styles.loginSubmit}>Login</div>
                <p style={{ fontSize: 11.5, color: "#7a5b12", marginTop: 14, marginBottom: 0 }}>
                  This page is served over HTTP without TLS, so the form credentials are transmitted in plain text on the wire.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* =================================================================
       * View 3: Main 3-Pane Packet Dissection View (List + Tree + Bytes)
       * ================================================================= */}
      {inCaptureView ? (
        <div className={`${styles.panes} ${open.size > 0 ? styles.panesDeep : ""}`}>
          <div className={styles.packetListPane} ref={listRef}>
            <table className={styles.packetTable} style={{ fontSize: `${11.5 + zoomDelta}px` }}>
              <colgroup>
                <col style={{ width: 62 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 185 }} />
                <col style={{ width: 185 }} />
                <col style={{ width: 88 }} />
                <col style={{ width: 68 }} />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Protocol</th>
                  <th>Length</th>
                  <th>Info</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => {
                  const bg = colorize ? row.color.bg : "#ffffff";
                  const fg = colorize ? row.color.fg : "#111111";
                  return (
                    <tr
                      key={row.no}
                      data-no={row.no}
                      className={`${styles.packetRow} ${selected === row.no ? styles.packetRowSelected : ""}`}
                      onClick={() => void selectPacket(row.no)}
                    >
                      <td style={{ background: bg, color: fg }}>{row.no}</td>
                      <td style={{ background: bg, color: fg }}>{row.time.toFixed(6)}</td>
                      <td style={{ background: bg, color: fg }}>{row.source}</td>
                      <td style={{ background: bg, color: fg }}>{row.destination}</td>
                      <td style={{ background: bg, color: fg }}>{row.protocol}</td>
                      <td style={{ background: bg, color: fg }}>{row.length}</td>
                      <td style={{ background: bg, color: fg }} title={row.info}>
                        {row.info}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.packetDetailsPane} aria-label="Packet details">
            {detail ? (
              detail.tree.flatMap((node, index) => renderNode(node, [index], 0))
            ) : (
              <div style={{ padding: "8px 12px", color: "#777777" }}>Select a packet to inspect its protocol layers.</div>
            )}
          </div>

          <div className={styles.packetBytesPane} aria-label="Packet bytes" style={{ display: "flex", gap: 0, padding: 0 }}>
            <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "4px 10px" }}>
              {renderHex()}
            </div>
            {showDiagram && detail ? (
              <div style={{ flex: 1, minWidth: 0, borderLeft: "1px solid #cbd5e1", background: "#ffffff", overflow: "auto" }} aria-label="Packet diagram">
                <WsPacketDiagram
                  layersText={detail.tree.map((t) => t.label)}
                  protocol={detail.row.protocol}
                  highlightRange={highlight}
                  onSelectRange={(start, end) => setDiagramRange({ start, end })}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* =================================================================
       * Modal: Statistics (Protocol Hierarchy / Capture File Properties)
       * ================================================================= */}
      {statsModal ? (
        <div className={styles.modalOverlay} onClick={() => setStatsModal(null)}>
          <div className={styles.followDialog} style={{ width: 560, height: 380 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Wireshark Statistics">
            <div className={styles.followTitleBar}>
              <div className={styles.followTitleLeft}>
                <WiresharkLogoIcon size={15} />
                <span>{statsModal === "hierarchy" ? `Protocol Hierarchy Statistics · ${file}` : `Capture File Properties · ${file}`}</span>
              </div>
              <button type="button" className={`${styles.winBtn} ${styles.winClose}`} onClick={() => setStatsModal(null)}>✕</button>
            </div>
            <div style={{ flex: 1, background: "#fff", margin: 10, border: "1px solid #cbd5e1", padding: 12, overflow: "auto", fontSize: 12 }}>
              {statsModal === "properties" ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {[
                      ["File name", file || "practice-capture.pcap"],
                      ["Capture source", localSampleMode ? "Simulated Lab Sample Dataset" : "LabMate Practice Packet Engine"],
                      ["Total packets", String(rows.length)],
                      ["Displayed packets", `${shown.length} (${pct}%)`],
                      ["Active display filter", applied || "(none)"],
                      ["Data link encapsulation", "Ethernet (LINKTYPE_ETHERNET)"],
                    ].map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "5px 8px", fontWeight: 600, width: 190 }}>{k}</td>
                        <td style={{ padding: "5px 8px" }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#eef2f6", textAlign: "left" }}>
                      <th style={{ padding: "5px 8px" }}>Protocol</th>
                      <th style={{ padding: "5px 8px" }}>Packets</th>
                      <th style={{ padding: "5px 8px" }}>Percent Packets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(
                      rows.reduce((map, r) => map.set(r.protocol, (map.get(r.protocol) ?? 0) + 1), new Map<string, number>()),
                    ).map(([proto, count]) => (
                      <tr key={proto} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "5px 8px", fontWeight: 600 }}>{proto}</td>
                        <td style={{ padding: "5px 8px" }}>{count}</td>
                        <td style={{ padding: "5px 8px" }}>{rows.length ? ((count / rows.length) * 100).toFixed(1) : "0.0"}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* =================================================================
       * Modal: Follow TCP Stream
       * ================================================================= */}
      {view === "follow" && follow ? (
        <div className={styles.modalOverlay}>
          <div className={styles.followDialog} role="dialog" aria-label="Follow TCP Stream">
            <div className={styles.followTitleBar}>
              <div className={styles.followTitleLeft}>
                <WiresharkLogoIcon size={15} />
                <span>
                  Follow TCP Stream (tcp.stream eq {follow.stream}) · {file}
                </span>
              </div>
              <div className={styles.winCaptions} aria-hidden="true">
                <button type="button" className={`${styles.winBtn} ${styles.winClose}`} onClick={() => setView("main")}>
                  ✕
                </button>
              </div>
            </div>

            <pre className={styles.followPre}>
              {follow.chunks
                .filter((c) => followDirection === "entire" || c.side === followDirection)
                .map((chunk, index) => (
                  <span key={index} className={chunk.side === "c" ? styles.chunkClient : styles.chunkServer}>
                    {chunk.text}
                  </span>
                ))}
            </pre>

            <div className={styles.followMetaRow}>
              <span>
                {follow.client_packets} client pkts, {follow.server_packets} server pkts, {follow.turns} turns.
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ color: "#800000", fontWeight: 600 }}>■ Client ({follow.client})</span>
                <span style={{ color: "#000080", fontWeight: 600 }}>■ Server ({follow.server})</span>
              </div>
            </div>

            <div className={styles.followControlsRow}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <select
                  className={styles.followSelect}
                  value={followDirection}
                  onChange={(e) => setFollowDirection(e.target.value)}
                >
                  <option value="entire">
                    Entire conversation ({follow.chunks.reduce((total, chunk) => total + chunk.bytes, 0)} bytes)
                  </option>
                  <option value="c">
                    {follow.client} → {follow.server}
                  </option>
                  <option value="s">
                    {follow.server} → {follow.client}
                  </option>
                </select>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>Show and save data as:</span>
                <select className={styles.followSelect} defaultValue="ASCII">
                  <option value="ASCII">ASCII</option>
                  <option value="UTF-8">UTF-8</option>
                  <option value="Hex Dump">Hex Dump</option>
                  <option value="Raw">Raw</option>
                </select>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span>Stream</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={follow.stream}
                  onChange={(e) => void followStream(Number(e.target.value))}
                  className={styles.followSelect}
                  style={{ width: 46 }}
                />
              </label>

              <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
                <span>Find:</span>
                <input
                  className={styles.followFindInput}
                  value={followFind}
                  onChange={(e) => setFollowFind(e.target.value)}
                  placeholder="Find text…"
                />
                <button
                  type="button"
                  className={styles.followBtn}
                  onClick={() => {
                    if (!followFind) return;
                    const fullText = follow.chunks.map((c) => c.text).join("");
                    if (fullText.toLowerCase().includes(followFind.toLowerCase())) {
                      setMessage(`Found "${followFind}" in TCP stream ${follow.stream}.`);
                    } else {
                      setMessage(`"${followFind}" not found in TCP stream ${follow.stream}.`);
                    }
                  }}
                >
                  Find Next
                </button>
              </div>
            </div>

            <div className={styles.followButtonBar}>
              <button type="button" className={styles.followBtn}>
                Help
              </button>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className={styles.followBtn}
                onClick={() => {
                  const nextFilter = `!(tcp.stream eq ${follow.stream})`;
                  setFilterText(nextFilter);
                  void applyFilter(nextFilter);
                  setView("main");
                }}
              >
                Filter Out This Stream
              </button>
              <button type="button" className={styles.followBtn} onClick={() => window.print()}>
                Print
              </button>
              <button
                type="button"
                className={styles.followBtn}
                onClick={() => {
                  const txt = follow.chunks.map((c) => c.text).join("");
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
                  a.download = `tcp-stream-${follow.stream}.txt`;
                  a.click();
                }}
              >
                Save as…
              </button>
              <button type="button" className={styles.followBtn} onClick={() => setView("main")}>
                Back
              </button>
              <button type="button" className={styles.followBtn} onClick={() => setView("main")}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* =================================================================
       * Status Bar
       * ================================================================= */}
      {view !== "browser" ? (
        <div className={styles.statusBar}>
          <div className={styles.statusLeft}>
            <WsExpertStatusCircle level={filterError ? "error" : rows.length ? "ok" : "warn"} />
            <span>{message || (file ? `File: "${file}"` : "Ready to load or capture")}</span>
          </div>
          <div className={styles.statusRight}>
            <span>
              {rows.length
                ? `Packets: ${rows.length} · Displayed: ${shown.length} (${pct}%)`
                : "No packets"}
            </span>
            <span className={styles.statusDivider}>|</span>
            <span>Profile: Default</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
