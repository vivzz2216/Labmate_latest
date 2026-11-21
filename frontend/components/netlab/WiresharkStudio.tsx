"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import api from "@/lib/api";
import { PracticeBanner } from "./PracticeBanner";
import { useStudioHook } from "./studioHook";
import styles from "./wireshark.module.css";
import {
  AboutDialog,
  CaptureOptionsDialog,
  ExportDialog,
  FilterReferenceDialog,
  HierarchyDialog,
  PropertiesDialog,
  TrafficDialog,
  type CaptureSettings,
  type ExportChoice,
  type ExportMode,
  type HierarchyRow,
  type PropertiesData,
} from "./WsDialogs";
import {
  COMMON_FILTERS,
  TIME_FORMATS,
  address,
  allKeys,
  ancestors,
  conversationFilters,
  deepestAt,
  download,
  errorText,
  fieldStatus,
  formatTime,
  nodeAt,
  type BrowserPage,
  type CaptureMeta,
  type Detail,
  type FrozenState,
  type LiveInterface,
  type Row,
  type SampleCapture,
  type Step,
  type StreamData,
  type TimeFormat,
  type TreeNode,
} from "./wsModel";
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
  WsGoToPacketIcon,
  WsInterfaceTypeIcon,
  WsLastPacketIcon,
  WsNextPacketIcon,
  WsOpenFolderIcon,
  WsPrevPacketIcon,
  WsReloadIcon,
  WsResizeColsIcon,
  WsSaveIcon,
  WsZoomInIcon,
  WsZoomOutIcon,
  WsZoomResetIcon,
} from "./WiresharkIcons";

type MenuEntry =
  | { divider: true }
  | { label: string; shortcut?: string; disabled?: boolean; checked?: boolean; action?: () => void; submenu?: MenuEntry[] };

type DialogState =
  | { kind: "properties"; data: PropertiesData }
  | { kind: "hierarchy"; rows: HierarchyRow[] }
  | { kind: "conversations" }
  | { kind: "endpoints" }
  | { kind: "capture" }
  | { kind: "export"; mode: ExportMode; format?: string }
  | { kind: "about" }
  | { kind: "reference"; data: { protocols: string[]; fields: string[] } | null }
  | null;

interface LiveInfo {
  available: boolean;
  reason: string;
  interfaces: LiveInterface[];
}

const MENU_NAMES = ["File", "Edit", "View", "Go", "Capture", "Analyze", "Statistics", "Telephony", "Wireless", "Tools", "Help"];
const COLUMNS = ["No.", "Time", "Source", "Destination", "Protocol", "Length", "Info"] as const;
const PANES = ["list", "details", "bytes"] as const;
const DEFAULT_WIDTHS = [64, 104, 200, 200, 78, 62, 760];
const NOT_HERE = "Not available in this simplified analyzer";
const RECENT_KEY = "labmate.analyzer.recentFilters";

function readRecent(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
}

function writeRecent(items: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 12)));
  } catch {
    /* storage may be unavailable; recent filters are a convenience */
  }
}

function combine(current: string, piece: string, how: "replace" | "and" | "or" | "andnot" | "ornot" | "not") {
  const cur = current.trim();
  if (how === "replace") return piece;
  if (how === "not") return `!(${piece})`;
  const join = how === "and" || how === "andnot" ? "&&" : "||";
  const neg = how === "andnot" || how === "ornot";
  if (!cur) return neg ? `!(${piece})` : piece;
  return `(${cur}) ${join} ${neg ? "!" : ""}(${piece})`;
}

export function WiresharkStudio() {
  // ------------------------------------------------------------------ capture state
  const [view, setView] = useState<Step["view"]>("welcome");
  const [rows, setRows] = useState<Row[]>([]);
  const [file, setFile] = useState("");
  const [meta, setMeta] = useState<CaptureMeta | null>(null);
  const [frozenInterfaces, setFrozenInterfaces] = useState<string[]>([]);
  const [live, setLive] = useState<LiveInfo>({ available: false, reason: "", interfaces: [] });
  const [samples, setSamples] = useState<SampleCapture[]>([]);
  const [sampleNote, setSampleNote] = useState("");
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [selectedIface, setSelectedIface] = useState("");
  const [captureFilter, setCaptureFilter] = useState("");
  const [captureLimits, setCaptureLimits] = useState({ maxPackets: 1000, maxSeconds: 60 });
  const [capturing, setCapturing] = useState<{ job: string; interface: string; started: number } | null>(null);
  const [isCaptureMode, setIsCaptureMode] = useState(false);

  // ------------------------------------------------------------------ display state
  const [filterText, setFilterText] = useState("");
  const [applied, setApplied] = useState("");
  const [filterState, setFilterState] = useState<"empty" | "valid" | "invalid" | "warn">("empty");
  const [filterMessage, setFilterMessage] = useState("");
  const [visible, setVisible] = useState<number[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [pickedNode, setPickedNode] = useState<string | null>(null);
  const [byteRange, setByteRange] = useState<{ start: number; end: number } | null>(null);
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("relative");
  const [resolveMac, setResolveMac] = useState(true);
  const [colorize, setColorize] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [zoom, setZoom] = useState(0);
  const [show, setShow] = useState({ mainToolbar: true, filterToolbar: true, statusBar: true, list: true, details: true, bytes: true });
  const [sizes, setSizes] = useState([0.46, 0.32, 0.22]);
  const [widths, setWidths] = useState<number[]>(DEFAULT_WIDTHS);
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [hoverSub, setHoverSub] = useState<string | null>(null);
  const [context, setContext] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentFilters, setRecentFilters] = useState<string[]>([]);
  const [findOpen, setFindOpen] = useState(false);
  const [find, setFind] = useState({ mode: "filter", scope: "list", query: "", caseSensitive: false });
  const [gotoOpen, setGotoOpen] = useState(false);
  const [gotoText, setGotoText] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [follow, setFollow] = useState<StreamData | null>(null);
  const [followDirection, setFollowDirection] = useState("entire");
  const [followFind, setFollowFind] = useState("");
  const [page, setPage] = useState<BrowserPage | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(0);

  const frozen = useRef<FrozenState | null>(null);
  const token = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panesRef = useRef<HTMLDivElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const filterInput = useRef<HTMLInputElement>(null);
  const findInput = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const bytesRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<Row[]>([]);
  rowsRef.current = rows;

  const inCaptureView = view === "main" || view === "follow";
  const hasFile = Boolean(token.current) && inCaptureView;

  // ------------------------------------------------------------------ start-up
  useEffect(() => {
    const capture = new URLSearchParams(window.location.search).get("capture") === "1";
    setIsCaptureMode(capture);
    setRecentFilters(readRecent());
    if (capture) return;
    api.get("/api/netlab/wireshark/samples").then((r) => (setSamples(r.data.samples), setSampleNote(r.data.note))).catch(() => undefined);
    api
      .get("/api/netlab/wireshark/capture/interfaces")
      .then((r) => {
        setLive({ available: r.data.available, reason: r.data.reason, interfaces: r.data.interfaces });
        if (r.data.interfaces?.length) setSelectedIface(r.data.interfaces[0].id);
      })
      .catch(() => setLive({ available: false, reason: "The capture service could not be reached.", interfaces: [] }));
  }, []);

  useEffect(() => {
    if (!openMenu && !context && !recentOpen) return;
    const close = () => {
      setOpenMenu(null);
      setHoverSub(null);
      setContext(null);
      setRecentOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [openMenu, context, recentOpen]);

  // ------------------------------------------------------------------ packets
  const selectPacket = useCallback(async (number: number, expandNames?: string[], pick?: string | null) => {
    let next: Detail | undefined;
    if (frozen.current) next = frozen.current.details[String(number)];
    else if (token.current) {
      try {
        next = (await api.get(`/api/netlab/wireshark/${token.current}/packet/${number}`)).data;
      } catch {
        setMessage("The capture is no longer open on the server. Open the file again.");
      }
    } else {
      setSelected(number);
      return;
    }
    if (!next) return;
    setSelected(number);
    setDetail(next);
    setByteRange(null);
    if (expandNames) {
      const keys = next.tree.map((node, index) => (expandNames.some((name) => node.label.startsWith(name)) ? String(index) : "")).filter(Boolean);
      setOpen(new Set(keys));
      setPickedNode(keys[0] ?? null);
    } else if (pick !== undefined) {
      setPickedNode(pick);
      if (pick) setOpen((prev) => new Set([...Array.from(prev), ...ancestors(pick)]));
    } else {
      setPickedNode((prev) => (prev && nodeAt(next!.tree, prev) ? prev : null));
    }
  }, []);

  const resetView = useCallback(() => {
    setApplied("");
    setFilterText("");
    setFilterState("empty");
    setFilterMessage("");
    setVisible(null);
    setSelected(null);
    setDetail(null);
    setOpen(new Set());
    setPickedNode(null);
    setMarked(new Set());
    setFollow(null);
    setSort(null);
  }, []);

  const opened = useCallback(
    (data: { token: string; rows: Row[]; file: string; meta: CaptureMeta; warning?: string }) => {
      token.current = data.token;
      frozen.current = null;
      setRows(data.rows);
      setFile(data.file);
      setMeta(data.meta);
      resetView();
      setView("main");
      setMessage(data.warning || "");
      setRecentFiles((prev) => [data.file, ...prev.filter((name) => name !== data.file)].slice(0, 6));
      if (data.rows.length) void selectPacket(data.rows[0].no);
    },
    [resetView, selectPacket],
  );

  const openCapture = useCallback(
    async (source: { file?: File; sample?: string }) => {
      setBusy("Loading…");
      setMessage("");
      try {
        const form = new FormData();
        if (source.file) form.append("file", source.file);
        if (source.sample) form.append("sample", source.sample);
        const response = await api.post("/api/netlab/wireshark/open", form, { headers: { "Content-Type": "multipart/form-data" } });
        opened(response.data);
      } catch (error) {
        setMessage(errorText(error, "The capture could not be opened."));
      } finally {
        setBusy("");
      }
    },
    [opened],
  );

  const closeCapture = useCallback(() => {
    token.current = null;
    frozen.current = null;
    setRows([]);
    setFile("");
    setMeta(null);
    resetView();
    setMessage("");
    setView("welcome");
  }, [resetView]);

  // ------------------------------------------------------------------ live capture
  const startCapture = useCallback(
    async (settings?: CaptureSettings) => {
      const iface = settings?.interface ?? selectedIface;
      if (!live.available || !iface) {
        setDialog({ kind: "capture" });
        return;
      }
      setDialog(null);
      try {
        const response = await api.post("/api/netlab/wireshark/capture/start", {
          interface: iface,
          capture_filter: settings?.filter ?? captureFilter,
          max_packets: settings?.maxPackets ?? captureLimits.maxPackets,
          max_seconds: settings?.maxSeconds ?? captureLimits.maxSeconds,
        });
        token.current = null;
        frozen.current = null;
        setRows([]);
        setFile("");
        setMeta(null);
        resetView();
        setView("main");
        const name = live.interfaces.find((item) => item.id === iface)?.name ?? iface;
        setCapturing({ job: response.data.job, interface: name, started: Date.now() });
        setMessage("");
      } catch (error) {
        setMessage(errorText(error, "The capture could not be started."));
      }
    },
    [captureFilter, captureLimits, live, resetView, selectedIface],
  );

  const stopCapture = useCallback(async () => {
    if (!capturing) return;
    const job = capturing.job;
    setCapturing(null);
    try {
      const response = await api.post(`/api/netlab/wireshark/capture/${job}/stop`);
      opened(response.data);
    } catch (error) {
      setMessage(errorText(error, "The capture could not be stopped."));
      setView(rows.length ? "main" : "welcome");
    }
  }, [capturing, opened, rows.length]);

  useEffect(() => {
    if (!capturing) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const response = await api.get(`/api/netlab/wireshark/capture/${capturing.job}`, { params: { since: rowsRef.current.length } });
        if (cancelled) return;
        if (response.data.rows.length) setRows((prev) => [...Array.from(prev), ...response.data.rows]);
        if (!response.data.running) void stopCapture();
      } catch (error) {
        if (!cancelled) {
          setMessage(errorText(error, "The capture stopped."));
          setCapturing(null);
        }
      }
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [capturing, stopCapture]);

  // ------------------------------------------------------------------ display filter
  useEffect(() => {
    const text = filterText.trim();
    if (!text) {
      setFilterState("empty");
      setFilterMessage("");
      return;
    }
    if (frozen.current) {
      const recordedStream = /^tcp\.stream eq (\d+)$/.exec(text);
      setFilterState(frozen.current.filters[text] || (recordedStream && frozen.current.streams[recordedStream[1]]) ? "valid" : "invalid");
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const result = (await api.get("/api/netlab/wireshark/check", { params: { expr: text } })).data;
        setFilterState(result.valid ? (result.warning ? "warn" : "valid") : "invalid");
        setFilterMessage(result.error || result.warning || "");
      } catch {
        /* the check is only cosmetic; Apply reports real errors */
      }
    }, 180);
    return () => window.clearTimeout(handle);
  }, [filterText]);

  const applyFilter = useCallback(
    async (expression: string) => {
      const text = expression.trim();
      setFilterText(text);
      setRecentOpen(false);
      if (!text) {
        setApplied("");
        setVisible(null);
        setFilterMessage("");
        return;
      }
      if (frozen.current) {
        const hit = frozen.current.filters[text];
        if (hit) {
          setApplied(text);
          setVisible(hit);
        } else setFilterMessage("This filter is not available in the recorded view.");
        return;
      }
      if (!token.current) {
        setFilterMessage(capturing ? "Stop the capture to apply a display filter." : "Open a capture file first.");
        return;
      }
      try {
        const response = await api.get(`/api/netlab/wireshark/${token.current}/filter`, { params: { expr: text } });
        setApplied(text);
        setVisible(response.data.numbers);
        setFilterMessage("");
        const next = [text, ...recentFilters.filter((item) => item !== text)].slice(0, 12);
        setRecentFilters(next);
        writeRecent(next);
        if (selected !== null && !response.data.numbers.includes(selected) && response.data.numbers.length) {
          void selectPacket(response.data.numbers[0]);
        }
      } catch (error) {
        setFilterState("invalid");
        setFilterMessage(errorText(error, "The filter could not be applied."));
      }
    },
    [capturing, recentFilters, selectPacket, selected],
  );

  // ------------------------------------------------------------------ follow stream
  const followStream = useCallback(async (index: number) => {
    if (frozen.current) {
      const stream = frozen.current.streams[String(index)];
      if (stream) {
        setFollow(stream);
        setView("follow");
      }
      return;
    }
    if (!token.current) return;
    try {
      const data = (await api.get(`/api/netlab/wireshark/${token.current}/stream/${index}`)).data;
      setFollow(data);
      setFollowDirection("entire");
      setView("follow");
      setFilterText(`tcp.stream eq ${index}`);
      const filtered = await api.get(`/api/netlab/wireshark/${token.current}/filter`, { params: { expr: `tcp.stream eq ${index}` } });
      setApplied(`tcp.stream eq ${index}`);
      setVisible(filtered.data.numbers);
    } catch {
      setMessage("The stream could not be loaded.");
    }
  }, []);

  // ------------------------------------------------------------------ report capture hook (backend studio_capture.py)
  useStudioHook<FrozenState, Step>(
    {
      load: (state) => {
        frozen.current = state;
        token.current = null;
        setRows(state.packets);
        setFile(state.file);
        setFrozenInterfaces(state.interfaces);
        setTick((n) => n + 1);
      },
      show: (step) => {
        const state = frozen.current;
        if (!state) return;
        setView(step.view);
        setFollow(null);
        setFollowDirection("entire");
        setFollowFind("");
        setFilterMessage("");
        setFindOpen(false);
        setGotoOpen(false);
        if (step.view === "main" || step.view === "follow") {
          const expression = step.view === "follow" ? `tcp.stream eq ${step.stream}` : step.filter ?? "";
          const numbers = step.view === "follow" ? state.streams[String(step.stream)]?.packets ?? null : state.filters[step.filter ?? ""] ?? null;
          setFilterText(expression);
          setApplied(expression);
          setVisible(expression ? numbers : null);
          if (step.select) void selectPacket(step.select, step.expand ?? []);
          if (step.view === "follow" && step.stream !== undefined) setFollow(state.streams[String(step.stream)] ?? null);
        }
        if (step.view === "browser" && step.host) setPage(state.pages[step.host] ?? null);
        setTick((n) => n + 1);
      },
    },
    `${tick}:${view}:${selected}:${applied}:${detail?.no}:${filterState}:${Array.from(open).join(",")}:${pickedNode ?? ""}:${follow?.stream ?? ""}`,
  );

  // ------------------------------------------------------------------ derived views
  const shown = useMemo(() => {
    const keep = visible ? new Set(visible) : null;
    const list = keep ? rows.filter((row) => keep.has(row.no)) : rows;
    if (!sort) return list;
    const key = (row: Row): string | number =>
      [row.no, row.epoch, row.source, row.destination, row.protocol, row.length, row.info][sort.col] as string | number;
    return [...list].sort((a, b) => {
      const x = key(a);
      const y = key(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir || a.no - b.no;
    });
  }, [rows, visible, sort]);

  const rowIndex = useMemo(() => new Map(rows.map((row, index) => [row.no, index])), [rows]);

  useEffect(() => {
    if (selected !== null) listRef.current?.querySelector(`[data-no="${selected}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected, visible, view]);

  useEffect(() => {
    if (capturing && autoScroll && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [rows.length, capturing, autoScroll]);

  useEffect(() => {
    detailsRef.current?.querySelector("[data-picked='1']")?.scrollIntoView({ block: "nearest" });
  }, [pickedNode, detail]);

  const picked = detail ? nodeAt(detail.tree, pickedNode) : null;
  const highlight = useMemo(
    () => byteRange ?? (picked && picked.end > picked.start ? { start: picked.start, end: picked.end } : null),
    [byteRange, picked],
  );

  useEffect(() => {
    if (highlight) bytesRef.current?.querySelector(`[data-offset="${highlight.start}"]`)?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const jump = useCallback(
    (to: number | "first" | "last") => {
      if (!shown.length) return;
      if (to === "first") return void selectPacket(shown[0].no);
      if (to === "last") return void selectPacket(shown[shown.length - 1].no);
      const at = shown.findIndex((row) => row.no === selected);
      const target = at < 0 ? 0 : Math.max(0, Math.min(shown.length - 1, at + to));
      void selectPacket(shown[target].no);
    },
    [shown, selected, selectPacket],
  );

  const jumpConversation = useCallback(
    (delta: 1 | -1) => {
      const current = rows.find((row) => row.no === selected);
      if (!current) return;
      const same = (row: Row) =>
        (current.stream >= 0 && row.stream === current.stream) ||
        ((current.udp_stream ?? -1) >= 0 && row.udp_stream === current.udp_stream) ||
        (!!current.ip_src && [row.ip_src, row.ip_dst].sort().join() === [current.ip_src, current.ip_dst].sort().join());
      const at = shown.findIndex((row) => row.no === selected);
      for (let i = at + delta; i >= 0 && i < shown.length; i += delta) {
        if (same(shown[i])) return void selectPacket(shown[i].no);
      }
    },
    [rows, selected, shown, selectPacket],
  );

  const gotoPacket = useCallback(
    (text: string) => {
      const number = Number(text);
      if (!Number.isInteger(number) || !rowIndex.has(number)) {
        setMessage(`There is no packet number ${text}.`);
        return;
      }
      if (visible && !visible.includes(number)) {
        setMessage(`Packet ${number} is not shown by the current display filter.`);
        return;
      }
      setGotoOpen(false);
      void selectPacket(number);
    },
    [rowIndex, visible, selectPacket],
  );

  const linkedPacket = useMemo(() => {
    if (!picked) return null;
    const match = picked.label.match(/(?:frame|In|in): (\d+)\]$/);
    return match ? Number(match[1]) : null;
  }, [picked]);

  const runFind = useCallback(
    async (backward = false) => {
      if (!find.query.trim()) return;
      if (frozen.current || !token.current) return;
      try {
        const response = await api.get(`/api/netlab/wireshark/${token.current}/find`, {
          params: { q: find.query, mode: find.mode, scope: find.scope, after: selected ?? 0, backward, case: find.caseSensitive, expr: applied },
        });
        if (!response.data.found) {
          setMessage(`No packet contained ${find.mode === "filter" ? "the filter" : "the " + find.mode} "${find.query}".`);
          return;
        }
        setMessage("");
        await selectPacket(response.data.number, undefined, response.data.path ?? null);
        setByteRange(response.data.range ? { start: response.data.range[0], end: response.data.range[1] } : null);
      } catch (error) {
        setMessage(errorText(error, "The search could not be run."));
      }
    },
    [applied, find, selectPacket, selected],
  );

  // ------------------------------------------------------------------ marks, statistics, export
  const toggleMark = useCallback((number: number | null) => {
    if (number === null) return;
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
  }, []);

  const jumpMark = useCallback(
    (delta: 1 | -1) => {
      const at = shown.findIndex((row) => row.no === selected);
      for (let i = at + delta; i >= 0 && i < shown.length; i += delta) {
        if (marked.has(shown[i].no)) return void selectPacket(shown[i].no);
      }
    },
    [marked, selected, shown, selectPacket],
  );

  const openStats = useCallback(
    async (which: "properties" | "hierarchy" | "conversations" | "endpoints") => {
      if (!token.current) {
        setMessage(frozen.current ? "Statistics are not part of the recorded view." : "Open a capture file first.");
        return;
      }
      if (which === "conversations" || which === "endpoints") return setDialog({ kind: which });
      try {
        const response = await api.get(`/api/netlab/wireshark/${token.current}/stats/${which}`, { params: { expr: applied, marked: marked.size } });
        setDialog(which === "properties" ? { kind: "properties", data: response.data } : { kind: "hierarchy", rows: response.data.rows });
      } catch (error) {
        setMessage(errorText(error, "The statistics could not be computed."));
      }
    },
    [applied, marked.size],
  );

  const loadTraffic = useCallback(
    (mode: "conversations" | "endpoints") => async (kind: string, limit: boolean) =>
      (await api.get(`/api/netlab/wireshark/${token.current}/stats/${mode}`, { params: { kind, expr: limit ? applied : "" } })).data,
    [applied],
  );
  const loadConversations = useMemo(() => loadTraffic("conversations"), [loadTraffic]);
  const loadEndpoints = useMemo(() => loadTraffic("endpoints"), [loadTraffic]);

  const runExport = useCallback(
    async (mode: ExportMode, choice: ExportChoice) => {
      if (!token.current) return;
      const params = { which: mode === "save" ? "all" : choice.which, expr: applied, marked: Array.from(marked).join(","), format: choice.format };
      try {
        const path = mode === "dissections" ? "dissections" : "export";
        const response = await api.get(`/api/netlab/wireshark/${token.current}/${path}`, {
          params: mode === "dissections" ? { ...params, details: choice.details, bytes: choice.bytes } : params,
          responseType: "blob",
        });
        const disposition = String(response.headers["content-disposition"] ?? "");
        const name = disposition.match(/filename="([^"]+)"/)?.[1] ?? `capture.${choice.format}`;
        download(response.data, name);
        setDialog(null);
        setMessage(`Saved ${name}.`);
      } catch (error) {
        setMessage(errorText(error, "The file could not be written."));
      }
    },
    [applied, marked],
  );

  const exportBytes = useCallback(() => {
    if (!detail) return;
    const bytes = new Uint8Array(detail.hex.flatMap((line) => line.hex.map((byte) => parseInt(byte, 16))));
    const range = highlight ?? { start: 0, end: bytes.length };
    download(new Blob([bytes.slice(range.start, range.end)], { type: "application/octet-stream" }), `packet-${detail.no}.bin`);
  }, [detail, highlight]);

  const copy = useCallback((text: string) => {
    void navigator.clipboard?.writeText(text).then(() => setMessage("Copied to the clipboard."), () => setMessage("The clipboard is not available."));
  }, []);

  const summaryText = useCallback(
    (row: Row) => `${row.no}\t${formatTime(row, timeFormat)}\t${address(row, "source", resolveMac)}\t${address(row, "destination", resolveMac)}\t${row.protocol}\t${row.length}\t${row.info}`,
    [resolveMac, timeFormat],
  );

  // ------------------------------------------------------------------ tree actions
  const subtreeKeys = useCallback((key: string) => {
    if (!detail) return [];
    const node = nodeAt(detail.tree, key);
    if (!node) return [];
    return [key, ...allKeys(node.children, key.split(".").map(Number))];
  }, [detail]);

  const filterFromNode = useCallback(
    (how: "replace" | "and" | "or" | "andnot" | "ornot" | "not", apply: boolean) => {
      if (!picked?.filter) {
        setMessage("This line has no field that a display filter can match.");
        return;
      }
      const text = combine(applied || filterText, picked.filter, how);
      setFilterText(text);
      if (apply) void applyFilter(text);
      else filterInput.current?.focus();
    },
    [applied, applyFilter, filterText, picked],
  );

  const filterSubmenu = (apply: boolean): MenuEntry[] => [
    { label: "Selected", action: () => filterFromNode("replace", apply), disabled: !picked?.filter },
    { label: "Not Selected", action: () => filterFromNode("not", apply), disabled: !picked?.filter },
    { label: "…and Selected", action: () => filterFromNode("and", apply), disabled: !picked?.filter },
    { label: "…or Selected", action: () => filterFromNode("or", apply), disabled: !picked?.filter },
    { label: "…and not Selected", action: () => filterFromNode("andnot", apply), disabled: !picked?.filter },
    { label: "…or not Selected", action: () => filterFromNode("ornot", apply), disabled: !picked?.filter },
  ];

  const currentRow = rows.find((row) => row.no === selected) ?? null;
  const conversationSubmenu: MenuEntry[] = currentRow
    ? conversationFilters(currentRow).map((item) => ({ label: item.label, action: () => void applyFilter(item.filter), disabled: !hasFile }))
    : [{ label: "No packet selected", disabled: true }];
  const canFollow = Boolean(currentRow && currentRow.stream >= 0);

  // ------------------------------------------------------------------ menus
  const off = (label: string, shortcut?: string): MenuEntry => ({ label, shortcut, disabled: true });
  const menus: Record<string, MenuEntry[]> = {
    File: [
      { label: "Open…", shortcut: "Ctrl+O", action: () => upload.current?.click(), disabled: !!capturing },
      { label: "Open Recent", submenu: recentFiles.length ? recentFiles.map((name) => ({ label: name, disabled: true })) : [{ label: "No recent files", disabled: true }] },
      {
        label: "Open Sample Capture",
        submenu: samples.length
          ? samples.map((sample) => ({ label: `${sample.file} — ${sample.title}`, action: () => void openCapture({ sample: sample.id }), disabled: !!capturing }))
          : [{ label: "No sample captures", disabled: true }],
      },
      off("Merge…"),
      off("Import from Hex Dump…"),
      { label: "Close", shortcut: "Ctrl+W", action: closeCapture, disabled: !inCaptureView || !!capturing },
      { divider: true },
      off("Save", "Ctrl+S"),
      { label: "Save As…", shortcut: "Ctrl+Shift+S", action: () => setDialog({ kind: "export", mode: "save" }), disabled: !hasFile },
      { divider: true },
      off("File Set"),
      { label: "Export Specified Packets…", action: () => setDialog({ kind: "export", mode: "export" }), disabled: !hasFile },
      {
        label: "Export Packet Dissections",
        submenu: [
          { label: "As Plain Text…", action: () => setDialog({ kind: "export", mode: "dissections" }), disabled: !hasFile },
          { label: "As CSV…", action: () => setDialog({ kind: "export", mode: "dissections", format: "csv" }), disabled: !hasFile },
        ],
      },
      { label: "Export Packet Bytes…", shortcut: "Ctrl+Shift+X", action: exportBytes, disabled: !detail },
      off("Export Objects"),
      { divider: true },
      off("Print…", "Ctrl+P"),
      { divider: true },
      off("Quit", "Ctrl+Q"),
    ],
    Edit: [
      {
        label: "Copy",
        submenu: [
          { label: "Summary as Text", shortcut: "Ctrl+Alt+C", action: () => currentRow && copy(summaryText(currentRow)), disabled: !currentRow },
          { label: "…as CSV", action: () => currentRow && copy(summaryText(currentRow).split("\t").map((v) => `"${v.replace(/"/g, '""')}"`).join(",")), disabled: !currentRow },
          { divider: true },
          { label: "Description", action: () => picked && copy(picked.label), disabled: !picked },
          { label: "Field Name", action: () => picked?.abbrev && copy(picked.abbrev), disabled: !picked?.abbrev },
          { label: "Value", action: () => picked?.value !== undefined && copy(String(picked.value)), disabled: picked?.value === undefined },
          { label: "As Filter", shortcut: "Ctrl+Shift+C", action: () => picked?.filter && copy(picked.filter), disabled: !picked?.filter },
        ],
      },
      { divider: true },
      { label: "Find Packet…", shortcut: "Ctrl+F", action: () => (setFindOpen(true), setTimeout(() => findInput.current?.focus(), 0)), disabled: !hasFile },
      { label: "Find Next", shortcut: "Ctrl+N", action: () => void runFind(false), disabled: !hasFile || !find.query },
      { label: "Find Previous", shortcut: "Ctrl+B", action: () => void runFind(true), disabled: !hasFile || !find.query },
      { divider: true },
      { label: "Mark/Unmark Packet", shortcut: "Ctrl+M", action: () => toggleMark(selected), disabled: selected === null },
      { label: "Mark All Displayed", shortcut: "Ctrl+Shift+M", action: () => setMarked(new Set(shown.map((row) => row.no))), disabled: !shown.length },
      { label: "Unmark All Displayed", shortcut: "Ctrl+Alt+M", action: () => setMarked((prev) => new Set(Array.from(prev).filter((n) => !shown.some((row) => row.no === n)))), disabled: !marked.size },
      { label: "Next Mark", shortcut: "Ctrl+Shift+N", action: () => jumpMark(1), disabled: !marked.size },
      { label: "Previous Mark", shortcut: "Ctrl+Shift+B", action: () => jumpMark(-1), disabled: !marked.size },
      { divider: true },
      off("Ignore/Unignore Packet", "Ctrl+D"),
      off("Set/Unset Time Reference", "Ctrl+T"),
      off("Time Shift…"),
      off("Packet Comments"),
      { divider: true },
      off("Configuration Profiles…", "Ctrl+Shift+A"),
      off("Preferences…", "Ctrl+Shift+P"),
    ],
    View: [
      { label: "Main Toolbar", checked: show.mainToolbar, action: () => setShow((s) => ({ ...s, mainToolbar: !s.mainToolbar })) },
      { label: "Filter Toolbar", checked: show.filterToolbar, action: () => setShow((s) => ({ ...s, filterToolbar: !s.filterToolbar })) },
      { label: "Status Bar", checked: show.statusBar, action: () => setShow((s) => ({ ...s, statusBar: !s.statusBar })) },
      { divider: true },
      { label: "Full Screen", shortcut: "F11", action: () => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()) },
      { divider: true },
      { label: "Packet List", checked: show.list, action: () => setShow((s) => ({ ...s, list: !s.list })) },
      { label: "Packet Details", checked: show.details, action: () => setShow((s) => ({ ...s, details: !s.details })) },
      { label: "Packet Bytes", checked: show.bytes, action: () => setShow((s) => ({ ...s, bytes: !s.bytes })) },
      { divider: true },
      { label: "Time Display Format", submenu: TIME_FORMATS.map((f) => ({ label: f.label, shortcut: f.shortcut, checked: timeFormat === f.id, action: () => setTimeFormat(f.id) })) },
      {
        label: "Name Resolution",
        submenu: [
          { label: "Resolve Physical Addresses", checked: resolveMac, action: () => setResolveMac((v) => !v) },
          off("Resolve Network Addresses"),
          off("Resolve Transport Addresses"),
        ],
      },
      {
        label: "Zoom",
        submenu: [
          { label: "Zoom In", shortcut: "Ctrl++", action: () => setZoom((z) => Math.min(6, z + 1)) },
          { label: "Zoom Out", shortcut: "Ctrl+-", action: () => setZoom((z) => Math.max(-3, z - 1)) },
          { label: "Normal Size", shortcut: "Ctrl+0", action: () => setZoom(0) },
        ],
      },
      { divider: true },
      { label: "Expand Subtrees", shortcut: "Shift+Right", action: () => pickedNode && setOpen((p) => new Set([...Array.from(p), ...subtreeKeys(pickedNode)])), disabled: !pickedNode },
      { label: "Collapse Subtrees", shortcut: "Shift+Left", action: () => pickedNode && setOpen((p) => new Set(Array.from(p).filter((k) => !subtreeKeys(pickedNode).includes(k)))), disabled: !pickedNode },
      { label: "Expand All", shortcut: "Ctrl+Right", action: () => detail && setOpen(new Set(allKeys(detail.tree))), disabled: !detail },
      { label: "Collapse All", shortcut: "Ctrl+Left", action: () => setOpen(new Set()), disabled: !detail },
      { divider: true },
      { label: "Colorize Packet List", checked: colorize, action: () => setColorize((v) => !v) },
      off("Coloring Rules…"),
      { divider: true },
      { label: "Resize Columns", shortcut: "Ctrl+Shift+R", action: () => setWidths(DEFAULT_WIDTHS) },
      { divider: true },
      { label: "Reload", shortcut: "Ctrl+R", action: () => token.current && void selectPacket(selected ?? rows[0]?.no ?? 1), disabled: !hasFile },
    ],
    Go: [
      { label: "Go to Packet…", shortcut: "Ctrl+G", action: () => setGotoOpen(true), disabled: !shown.length },
      { label: "Go to Linked Packet", action: () => linkedPacket && gotoPacket(String(linkedPacket)), disabled: !linkedPacket },
      { label: "Next Packet", shortcut: "Ctrl+Down", action: () => jump(1), disabled: !shown.length },
      { label: "Previous Packet", shortcut: "Ctrl+Up", action: () => jump(-1), disabled: !shown.length },
      { label: "Next Packet In Conversation", shortcut: "Ctrl+.", action: () => jumpConversation(1), disabled: selected === null },
      { label: "Previous Packet In Conversation", shortcut: "Ctrl+,", action: () => jumpConversation(-1), disabled: selected === null },
      { label: "First Packet", shortcut: "Ctrl+Home", action: () => jump("first"), disabled: !shown.length },
      { label: "Last Packet", shortcut: "Ctrl+End", action: () => jump("last"), disabled: !shown.length },
      { divider: true },
      { label: "Auto Scroll in Live Capture", checked: autoScroll, action: () => setAutoScroll((v) => !v) },
    ],
    Capture: [
      { label: "Options…", shortcut: "Ctrl+K", action: () => setDialog({ kind: "capture" }), disabled: !!capturing || isCaptureMode },
      { label: "Start", shortcut: "Ctrl+E", action: () => void startCapture(), disabled: !!capturing || !live.available },
      { label: "Stop", shortcut: "Ctrl+E", action: () => void stopCapture(), disabled: !capturing },
      { label: "Restart", shortcut: "Ctrl+R", action: () => void stopCapture().then(() => startCapture()), disabled: !capturing },
      off("Capture Filters…"),
      {
        label: "Refresh Interfaces",
        shortcut: "F5",
        action: () =>
          void api
            .get("/api/netlab/wireshark/capture/interfaces")
            .then((r) => setLive({ available: r.data.available, reason: r.data.reason, interfaces: r.data.interfaces }))
            .catch(() => undefined),
      },
    ],
    Analyze: [
      { label: "Display Filters…", action: () => void openReference(), disabled: false },
      off("Display Filter Macros…"),
      { divider: true },
      off("Apply as Column", "Ctrl+Shift+I"),
      { label: "Apply as Filter", submenu: filterSubmenu(true) },
      { label: "Prepare as Filter", submenu: filterSubmenu(false) },
      { label: "Conversation Filter", submenu: conversationSubmenu },
      { divider: true },
      off("Enabled Protocols…", "Ctrl+Shift+E"),
      off("Decode As…", "Ctrl+Shift+U"),
      { divider: true },
      {
        label: "Follow",
        submenu: [
          { label: "TCP Stream", shortcut: "Ctrl+Alt+Shift+T", action: () => currentRow && void followStream(currentRow.stream), disabled: !canFollow },
          off("UDP Stream", "Ctrl+Alt+Shift+U"),
          off("TLS Stream", "Ctrl+Alt+Shift+S"),
          off("HTTP Stream", "Ctrl+Alt+Shift+H"),
        ],
      },
      { divider: true },
      off("Expert Information"),
    ],
    Statistics: [
      { label: "Capture File Properties", shortcut: "Ctrl+Alt+Shift+C", action: () => void openStats("properties"), disabled: !hasFile },
      off("Resolved Addresses"),
      { label: "Protocol Hierarchy", action: () => void openStats("hierarchy"), disabled: !hasFile },
      { label: "Conversations", action: () => void openStats("conversations"), disabled: !hasFile },
      { label: "Endpoints", action: () => void openStats("endpoints"), disabled: !hasFile },
      off("Packet Lengths"),
      off("I/O Graphs"),
      off("Service Response Time"),
      { divider: true },
      off("Flow Graph"),
      off("HTTP"),
      off("DNS"),
    ],
    Telephony: [off("VoIP Calls"), off("RTP"), off("SIP Flows"), off("SIP Statistics")],
    Wireless: [off("Bluetooth ATT Server Attributes"), off("Bluetooth Devices"), off("WLAN Traffic")],
    Tools: [off("Firewall ACL Rules"), off("Credentials"), off("Lua")],
    Help: [
      { label: "Display Filter Reference", action: () => void openReference() },
      {
        label: "Sample Captures",
        submenu: samples.length
          ? samples.map((sample) => ({ label: `${sample.file} — ${sample.title}`, action: () => void openCapture({ sample: sample.id }), disabled: !!capturing }))
          : [{ label: "No sample captures", disabled: true }],
      },
      { divider: true },
      { label: "About this analyzer", action: () => setDialog({ kind: "about" }) },
    ],
  };

  async function openReference() {
    setDialog({ kind: "reference", data: null });
    try {
      const data = (await api.get("/api/netlab/wireshark/fields")).data;
      setDialog({ kind: "reference", data });
    } catch {
      setDialog({ kind: "reference", data: { protocols: [], fields: [] } });
    }
  }

  // ------------------------------------------------------------------ keyboard
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (dialog) return;
      const target = event.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
      const ctrl = event.ctrlKey || event.metaKey;
      const k = event.key.toLowerCase();
      const run = (fn: () => void) => {
        event.preventDefault();
        fn();
      };
      if (ctrl && k === "o" && !event.shiftKey) return run(() => upload.current?.click());
      if (ctrl && k === "/") return run(() => filterInput.current?.focus());
      if (ctrl && k === "f" && hasFile) return run(() => (setFindOpen(true), setTimeout(() => findInput.current?.focus(), 0)));
      if (ctrl && k === "g" && shown.length) return run(() => setGotoOpen(true));
      if (ctrl && k === "e") return run(() => void (capturing ? stopCapture() : startCapture()));
      if (ctrl && k === "k" && !isCaptureMode) return run(() => setDialog({ kind: "capture" }));
      if (ctrl && k === "w" && inCaptureView && !capturing) return run(closeCapture);
      if (ctrl && event.shiftKey && k === "s" && hasFile) return run(() => setDialog({ kind: "export", mode: "save" }));
      if (typing) return;
      if (ctrl && k === "m" && !event.shiftKey && !event.altKey) return run(() => toggleMark(selected));
      if (ctrl && k === "n") return run(() => void runFind(false));
      if (ctrl && k === "b") return run(() => void runFind(true));
      if (ctrl && event.key === "ArrowDown") return run(() => jump(1));
      if (ctrl && event.key === "ArrowUp") return run(() => jump(-1));
      if (ctrl && event.key === "Home") return run(() => jump("first"));
      if (ctrl && event.key === "End") return run(() => jump("last"));
      if (ctrl && event.key === "ArrowRight" && detail) return run(() => setOpen(new Set(allKeys(detail.tree))));
      if (ctrl && event.key === "ArrowLeft") return run(() => setOpen(new Set()));
      if (ctrl && (event.key === "+" || event.key === "=")) return run(() => setZoom((z) => Math.min(6, z + 1)));
      if (ctrl && event.key === "-") return run(() => setZoom((z) => Math.max(-3, z - 1)));
      if (ctrl && event.key === "0") return run(() => setZoom(0));
      if (ctrl && event.key === ".") return run(() => jumpConversation(1));
      if (ctrl && event.key === ",") return run(() => jumpConversation(-1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [capturing, closeCapture, detail, dialog, hasFile, inCaptureView, isCaptureMode, jump, jumpConversation, runFind, selected, shown.length, startCapture, stopCapture, toggleMark]);

  // ------------------------------------------------------------------ splitters and columns
  const panesShown = PANES.filter((key) => show[key]);
  const startDrag = (a: number, b: number) => (event: ReactMouseEvent) => {
    event.preventDefault();
    const box = panesRef.current?.getBoundingClientRect();
    if (!box) return;
    const startY = event.clientY;
    const initial = [...sizes];
    const shownTotal = panesShown.reduce((sum, key) => sum + initial[PANES.indexOf(key)], 0);
    const onMove = (move: MouseEvent) => {
      const delta = ((move.clientY - startY) / box.height) * shownTotal;
      const next = [...initial];
      const total = initial[a] + initial[b];
      next[a] = Math.max(0.08, Math.min(total - 0.08, initial[a] + delta));
      next[b] = total - next[a];
      setSizes(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startColumnDrag = (index: number) => (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const initial = widths[index];
    const onMove = (move: MouseEvent) => setWidths((prev) => prev.map((w, i) => (i === index ? Math.max(30, initial + move.clientX - startX) : w)));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ------------------------------------------------------------------ rendering helpers
  const fontSize = 12.5 + zoom;
  const renderMenu = (entries: MenuEntry[], path: string): JSX.Element => (
    <div className={path.includes("/") ? `${styles.menuDropdown} ${styles.subMenu}` : styles.menuDropdown} role="menu" onMouseDown={(event) => event.stopPropagation()}>
      {entries.map((entry, index) => {
        if ("divider" in entry) return <div key={index} className={styles.menuDivider} />;
        const key = `${path}/${entry.label}`;
        const openSub = entry.submenu && hoverSub?.startsWith(key);
        return (
          <div key={key} style={{ position: "relative" }} onMouseEnter={() => setHoverSub(entry.submenu ? key : path)}>
            <button
              type="button"
              role="menuitem"
              className={`${styles.menuDropItem} ${openSub ? styles.menuDropItemOpen : ""}`}
              disabled={entry.disabled}
              title={entry.disabled && !entry.submenu ? NOT_HERE : undefined}
              onClick={() => {
                if (entry.submenu) return setHoverSub(key);
                setOpenMenu(null);
                setContext(null);
                setHoverSub(null);
                entry.action?.();
              }}
            >
              <span className={styles.menuCheck}>{entry.checked ? "✓" : ""}</span>
              <span>{entry.label}</span>
              <span className={styles.menuShortcut}>{entry.shortcut ?? ""}</span>
              <span className={styles.menuArrow}>{entry.submenu ? "▶" : ""}</span>
            </button>
            {openSub && entry.submenu ? renderMenu(entry.submenu, key) : null}
          </div>
        );
      })}
    </div>
  );

  const showContext = (event: ReactMouseEvent, entries: MenuEntry[]) => {
    event.preventDefault();
    event.stopPropagation();
    setOpenMenu(null);
    setHoverSub("ctx");
    setContext({ x: Math.min(event.clientX, window.innerWidth - 260), y: Math.min(event.clientY, window.innerHeight - 320), entries });
  };

  const renderNode = (node: TreeNode, path: number[], depth: number): JSX.Element[] => {
    const key = path.join(".");
    const expandable = node.children.length > 0;
    const isOpen = open.has(key);
    const out: JSX.Element[] = [
      <div
        key={key}
        className={`${styles.treeNode} ${pickedNode === key ? styles.treeNodeSelected : ""}`}
        data-picked={pickedNode === key ? "1" : undefined}
        style={{ paddingLeft: 4 + depth * 16, fontSize, height: 18 + zoom }}
        onMouseDown={() => {
          setByteRange(null);
          setPickedNode(key);
        }}
        onClick={(event) => {
          if (!expandable) return;
          const toggleArea = (event.target as HTMLElement).dataset.toggle === "1";
          if (toggleArea) {
            const next = new Set(open);
            if (isOpen) next.delete(key);
            else next.add(key);
            setOpen(next);
          }
        }}
        onDoubleClick={() => {
          if (expandable) {
            const next = new Set(open);
            if (isOpen) next.delete(key);
            else next.add(key);
            setOpen(next);
          }
          const target = node.label.match(/(?:frame|In|in): (\d+)\]$/);
          if (target) gotoPacket(target[1]);
        }}
        onContextMenu={(event) => {
          setPickedNode(key);
          showContext(event, [
            { label: "Expand Subtrees", shortcut: "Shift+Right", action: () => setOpen((p) => new Set([...Array.from(p), ...subtreeKeys(key)])), disabled: !expandable },
            { label: "Collapse Subtrees", shortcut: "Shift+Left", action: () => setOpen((p) => new Set(Array.from(p).filter((k) => !subtreeKeys(key).includes(k)))), disabled: !expandable },
            { label: "Expand All", shortcut: "Ctrl+Right", action: () => detail && setOpen(new Set(allKeys(detail.tree))) },
            { label: "Collapse All", shortcut: "Ctrl+Left", action: () => setOpen(new Set()) },
            { divider: true },
            { label: "Apply as Filter", submenu: filterSubmenuFor(node, true) },
            { label: "Prepare as Filter", submenu: filterSubmenuFor(node, false) },
            { divider: true },
            {
              label: "Copy",
              submenu: [
                { label: "Description", action: () => copy(node.label) },
                { label: "Field Name", action: () => node.abbrev && copy(node.abbrev), disabled: !node.abbrev },
                { label: "Value", action: () => node.value !== undefined && copy(String(node.value)), disabled: node.value === undefined },
                { label: "As Filter", action: () => node.filter && copy(node.filter), disabled: !node.filter },
              ],
            },
            { label: "Export Packet Bytes…", action: exportBytes },
            { divider: true },
            { label: "Go to Linked Packet", action: () => linkedPacket && gotoPacket(String(linkedPacket)), disabled: !node.label.match(/(?:frame|In|in): \d+\]$/) },
          ]);
        }}
      >
        <span className={styles.treeToggle} data-toggle="1">
          {expandable ? (isOpen ? "▾" : "▸") : ""}
        </span>
        <span>{node.label}</span>
      </div>,
    ];
    if (expandable && isOpen) node.children.forEach((child, index) => out.push(...renderNode(child, [...path, index], depth + 1)));
    return out;
  };

  function filterSubmenuFor(node: TreeNode, apply: boolean): MenuEntry[] {
    const make = (how: "replace" | "and" | "or" | "andnot" | "ornot" | "not") => () => {
      if (!node.filter) return;
      const text = combine(applied || filterText, node.filter, how);
      setFilterText(text);
      if (apply) void applyFilter(text);
      else filterInput.current?.focus();
    };
    const disabled = !node.filter;
    return [
      { label: "Selected", action: make("replace"), disabled },
      { label: "Not Selected", action: make("not"), disabled },
      { label: "…and Selected", action: make("and"), disabled },
      { label: "…or Selected", action: make("or"), disabled },
      { label: "…and not Selected", action: make("andnot"), disabled },
      { label: "…or not Selected", action: make("ornot"), disabled },
    ];
  }

  const renderHex = () => {
    if (!detail) return null;
    return detail.hex.map((line) => {
      const cells: JSX.Element[] = [];
      line.hex.forEach((byte, i) => {
        const position = line.offset + i;
        const on = highlight && position >= highlight.start && position < highlight.end;
        const nextOn = highlight && position + 1 >= highlight.start && position + 1 < highlight.end && i !== 7 && i !== line.hex.length - 1;
        cells.push(
          <span
            key={`h${i}`}
            data-offset={position}
            className={`${styles.hexByte} ${on ? styles.hexHl : ""}`}
            onMouseDown={() => {
              const key = deepestAt(detail.tree, position);
              setByteRange(null);
              if (key) {
                setOpen((prev) => new Set([...Array.from(prev), ...ancestors(key)]));
                setPickedNode(key);
              }
            }}
          >
            {byte}
          </span>,
        );
        cells.push(
          <span key={`s${i}`} className={on && nextOn ? styles.hexHl : undefined}>
            {i === 7 ? "  " : " "}
          </span>,
        );
      });
      const pad = line.hex.length < 16 ? " ".repeat((16 - line.hex.length) * 3 + (line.hex.length <= 8 ? 1 : 0)) : "";
      const text = line.ascii.split("").map((char, i) => {
        const position = line.offset + i;
        const on = highlight && position >= highlight.start && position < highlight.end;
        return (
          <span key={i} className={`${styles.hexByte} ${on ? styles.hexHl : ""}`} onMouseDown={() => {
            const key = deepestAt(detail.tree, position);
            if (key) {
              setOpen((prev) => new Set([...Array.from(prev), ...ancestors(key)]));
              setPickedNode(key);
            }
          }}>
            {char}
          </span>
        );
      });
      return (
        <div key={line.offset} className={styles.hexRow} style={{ fontSize, height: 18 + zoom, lineHeight: `${18 + zoom}px` }}>
          <span className={styles.hexOffset}>{line.offset.toString(16).padStart(4, "0")}</span>
          {"   "}
          {cells}
          {pad}
          {"  "}
          {text}
        </div>
      );
    });
  };

  const listKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      jump(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home") {
      event.preventDefault();
      jump("first");
    } else if (event.key === "End") {
      event.preventDefault();
      jump("last");
    }
  };

  const treeKeyDown = (event: ReactKeyboardEvent) => {
    if (!pickedNode || !detail) return;
    const node = nodeAt(detail.tree, pickedNode);
    if (!node) return;
    if (event.key === "ArrowRight" && node.children.length) {
      event.preventDefault();
      setOpen((prev) => new Set([...Array.from(prev), ...(event.shiftKey ? subtreeKeys(pickedNode) : [pickedNode])]));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (open.has(pickedNode)) setOpen((prev) => new Set(Array.from(prev).filter((k) => (event.shiftKey ? !subtreeKeys(pickedNode).includes(k) : k !== pickedNode))));
      else if (pickedNode.includes(".")) setPickedNode(pickedNode.split(".").slice(0, -1).join("."));
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const order: string[] = [];
      const walk = (nodes: TreeNode[], path: number[]) =>
        nodes.forEach((child, index) => {
          const key = [...path, index].join(".");
          order.push(key);
          if (open.has(key)) walk(child.children, [...path, index]);
        });
      walk(detail.tree, []);
      const at = order.indexOf(pickedNode);
      const next = order[Math.max(0, Math.min(order.length - 1, at + (event.key === "ArrowDown" ? 1 : -1)))];
      if (next) {
        setByteRange(null);
        setPickedNode(next);
      }
    }
  };

  // ------------------------------------------------------------------ status bar text
  const pct = rows.length ? ((shown.length / rows.length) * 100).toFixed(1) : "0.0";
  const statusText = capturing
    ? `Capturing from ${capturing.interface}`
    : filterMessage && filterState !== "valid"
      ? filterMessage
      : message || (picked && inCaptureView ? fieldStatus(picked) : file && inCaptureView ? `File: "${file}"${meta ? ` ${(meta.length / 1024).toFixed(0)} kB` : ""}` : "Ready to load or capture");
  const statusIsError = !capturing && ((Boolean(filterMessage) && filterState === "invalid") || (/could not|no longer|There is no|is not shown/.test(message) && !picked));
  const filterClass = filterState === "invalid" ? styles.filterInvalid : filterState === "warn" ? styles.filterWarn : filterState === "valid" ? styles.filterValid : "";
  const title = capturing ? `Capturing from ${capturing.interface}` : file && inCaptureView ? file : "The Wireshark Network Analyzer";
  const interfacesForWelcome: LiveInterface[] = frozen.current
    ? frozenInterfaces.map((name) => ({ id: name, name, description: "", flags: "" }))
    : live.interfaces;

  // ------------------------------------------------------------------ render
  return (
    <div className={styles.wsRoot}>
      <PracticeBanner tool="Wireshark" />

      {view !== "browser" ? (
        <>
          <div className={styles.titleBar}>
            <div className={styles.titleLeft}>
              <WiresharkLogoIcon size={16} />
              <span className={styles.titleText}>{title}</span>
            </div>
            <div className={styles.winCaptions} aria-hidden="true">
              <button type="button" className={styles.winBtn} tabIndex={-1}>─</button>
              <button type="button" className={styles.winBtn} tabIndex={-1}>☐</button>
              <button type="button" className={`${styles.winBtn} ${styles.winClose}`} tabIndex={-1}>✕</button>
            </div>
          </div>

          <div className={styles.menuBar} role="menubar" aria-label="Menu bar">
            {MENU_NAMES.map((name) => (
              <div key={name} className={styles.menuItemWrap} onMouseDown={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  role="menuitem"
                  className={`${styles.menuBtn} ${openMenu === name ? styles.menuBtnOpen : ""}`}
                  onClick={() => {
                    setContext(null);
                    setHoverSub(name);
                    setOpenMenu((cur) => (cur === name ? null : name));
                  }}
                  onMouseEnter={() => openMenu && openMenu !== name && (setOpenMenu(name), setHoverSub(name))}
                >
                  {name}
                </button>
                {openMenu === name ? renderMenu(menus[name], name) : null}
              </div>
            ))}
          </div>

          {show.mainToolbar ? (
            <div className={styles.mainToolbar} role="toolbar" aria-label="Main toolbar">
              <button className={styles.toolBtn} title={live.available ? "Start capturing packets" : live.reason || "Start capturing packets"} aria-label="Start capturing packets" disabled={!!capturing || isCaptureMode} onClick={() => void startCapture()}>
                <WsCaptureStartIcon size={17} active={!!capturing} />
              </button>
              <button className={styles.toolBtn} title="Stop capturing packets" aria-label="Stop capturing packets" disabled={!capturing} onClick={() => void stopCapture()}>
                <WsCaptureStopIcon size={16} />
              </button>
              <button className={styles.toolBtn} title="Restart current capture" aria-label="Restart current capture" disabled={!capturing} onClick={() => void stopCapture().then(() => startCapture())}>
                <WsCaptureRestartIcon size={17} />
              </button>
              <button className={styles.toolBtn} title="Capture options" aria-label="Capture options" disabled={!!capturing || isCaptureMode} onClick={() => setDialog({ kind: "capture" })}>
                <WsCaptureOptionsIcon size={16} />
              </button>
              <div className={styles.toolSep} />
              <button className={styles.toolBtn} title="Open a capture file" aria-label="Open a capture file" disabled={!!capturing} onClick={() => upload.current?.click()}>
                <WsOpenFolderIcon size={17} />
              </button>
              <button className={styles.toolBtn} title="Save this capture file" aria-label="Save this capture file" disabled={!hasFile} onClick={() => setDialog({ kind: "export", mode: "save" })}>
                <WsSaveIcon size={16} />
              </button>
              <button className={styles.toolBtn} title="Close this capture file" aria-label="Close this capture file" disabled={!inCaptureView || !!capturing} onClick={closeCapture}>
                <WsCloseFileIcon size={16} />
              </button>
              <button className={styles.toolBtn} title="Reload this file" aria-label="Reload this file" disabled={!hasFile} onClick={() => selected !== null && void selectPacket(selected)}>
                <WsReloadIcon size={16} />
              </button>
              <div className={styles.toolSep} />
              <button className={`${styles.toolBtn} ${findOpen ? styles.toolBtnActive : ""}`} title="Find a packet" aria-label="Find a packet" disabled={!hasFile} onClick={() => (setFindOpen((v) => !v), setTimeout(() => findInput.current?.focus(), 0))}>
                <WsFindIcon size={16} />
              </button>
              <button className={styles.toolBtn} title="Go to the previous packet" aria-label="Go to the previous packet" disabled={!shown.length} onClick={() => jump(-1)}>
                <WsPrevPacketIcon size={16} />
              </button>
              <button className={styles.toolBtn} title="Go to the next packet" aria-label="Go to the next packet" disabled={!shown.length} onClick={() => jump(1)}>
                <WsNextPacketIcon size={16} />
              </button>
              <button className={`${styles.toolBtn} ${gotoOpen ? styles.toolBtnActive : ""}`} title="Go to specified packet" aria-label="Go to specified packet" disabled={!shown.length} onClick={() => setGotoOpen((v) => !v)}>
                <WsGoToPacketIcon size={16} />
              </button>
              <button className={styles.toolBtn} title="Go to the first packet" aria-label="Go to the first packet" disabled={!shown.length} onClick={() => jump("first")}>
                <WsFirstPacketIcon size={16} />
              </button>
              <button className={styles.toolBtn} title="Go to the last packet" aria-label="Go to the last packet" disabled={!shown.length} onClick={() => jump("last")}>
                <WsLastPacketIcon size={16} />
              </button>
              <button className={`${styles.toolBtn} ${autoScroll ? styles.toolBtnActive : ""}`} title="Automatically scroll to the last packet during a live capture" aria-label="Auto scroll" onClick={() => setAutoScroll((v) => !v)}>
                <WsAutoScrollIcon size={16} />
              </button>
              <div className={styles.toolSep} />
              <button className={`${styles.toolBtn} ${colorize ? styles.toolBtnActive : ""}`} title="Draw packets using your coloring rules" aria-label="Colorize packet list" onClick={() => setColorize((v) => !v)}>
                <WsColorizeIcon size={16} />
              </button>
              <div className={styles.toolSep} />
              <button className={styles.toolBtn} title="Enlarge the main window text" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(6, z + 1))}>
                <WsZoomInIcon size={16} />
              </button>
              <button className={styles.toolBtn} title="Shrink the main window text" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(-3, z - 1))}>
                <WsZoomOutIcon size={16} />
              </button>
              <button className={styles.toolBtn} title="Return the main window text to its normal size" aria-label="Normal size" onClick={() => setZoom(0)}>
                <WsZoomResetIcon size={16} />
              </button>
              <button className={styles.toolBtn} title="Resize packet list columns to fit contents" aria-label="Resize columns" disabled={!inCaptureView} onClick={() => setWidths(DEFAULT_WIDTHS)}>
                <WsResizeColsIcon size={16} />
              </button>
              <input
                ref={upload}
                type="file"
                accept=".pcap,.pcapng,.cap"
                hidden
                aria-label="Open capture file"
                onChange={(event) => {
                  const chosen = event.target.files?.[0];
                  if (chosen) void openCapture({ file: chosen });
                  event.target.value = "";
                }}
              />
            </div>
          ) : null}

          {show.filterToolbar ? (
            <div className={styles.filterToolbar}>
              <button
                type="button"
                className={styles.filterBookmarkBtn}
                title="Manage saved bookmarks."
                aria-label="Display filter bookmarks"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) =>
                  showContext(event, [
                    ...COMMON_FILTERS.map((expression) => ({ label: expression, action: () => void applyFilter(expression) })),
                    { divider: true },
                    { label: "Display Filter Reference…", action: () => void openReference() },
                  ])
                }
              >
                <WsBookmarkIcon size={15} />
              </button>
              <div className={`${styles.filterInputBox} ${filterClass}`}>
                <input
                  ref={filterInput}
                  className={styles.filterInput}
                  aria-label="Display filter"
                  spellCheck={false}
                  value={filterText}
                  placeholder="Apply a display filter … <Ctrl-/>"
                  style={{ fontSize }}
                  onChange={(event) => setFilterText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void applyFilter(filterText);
                    if (event.key === "Escape") setRecentOpen(false);
                  }}
                />
                {filterText ? (
                  <button type="button" className={styles.filterInlineBtn} title="Clear display filter" aria-label="Clear display filter" onClick={() => void applyFilter("")}>
                    <WsClearFilterIcon size={13} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className={styles.filterInlineBtn}
                  title="Recent display filters"
                  aria-label="Recent display filters"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => setRecentOpen((v) => !v)}
                >
                  <span style={{ fontSize: 9, color: "#444" }}>▾</span>
                </button>
                <button type="button" className={styles.filterInlineBtn} style={{ width: 28 }} title="Apply display filter" aria-label="Apply display filter" onClick={() => void applyFilter(filterText)}>
                  <WsApplyFilterArrowIcon size={26} />
                </button>
              </div>
              <button type="button" className={styles.filterPlusBtn} title="Add a display filter button." aria-label="Add a filter button" onClick={() => void openReference()}>
                +
              </button>
              {recentOpen ? (
                <div className={styles.filterRecent} onMouseDown={(event) => event.stopPropagation()}>
                  {recentFilters.length ? <div className={styles.filterRecentHeading}>Recent</div> : null}
                  {recentFilters.map((expression) => (
                    <button key={`r-${expression}`} type="button" className={styles.filterRecentItem} onClick={() => void applyFilter(expression)}>
                      {expression}
                    </button>
                  ))}
                  <div className={styles.filterRecentHeading}>Common filters</div>
                  {COMMON_FILTERS.map((expression) => (
                    <button key={expression} type="button" className={styles.filterRecentItem} onClick={() => void applyFilter(expression)}>
                      {expression}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {findOpen && inCaptureView ? (
            <div className={styles.searchBar}>
              <select className={styles.searchSelect} value={find.scope} onChange={(event) => setFind({ ...find, scope: event.target.value })} disabled={find.mode === "filter"} aria-label="Search in">
                <option value="list">Packet list</option>
                <option value="details">Packet details</option>
                <option value="bytes">Packet bytes</option>
              </select>
              <select className={styles.searchSelect} disabled aria-label="Character width">
                <option>Narrow (UTF-8 / ASCII)</option>
              </select>
              <label className={styles.qtCheck}>
                <input type="checkbox" checked={find.caseSensitive} onChange={(event) => setFind({ ...find, caseSensitive: event.target.checked })} />
                Case sensitive
              </label>
              <select className={styles.searchSelect} value={find.mode} onChange={(event) => setFind({ ...find, mode: event.target.value })} aria-label="Search type">
                <option value="filter">Display filter</option>
                <option value="hex">Hex value</option>
                <option value="string">String</option>
                <option value="regex">Regular Expression</option>
              </select>
              <input
                ref={findInput}
                className={styles.searchInput}
                value={find.query}
                spellCheck={false}
                placeholder={find.mode === "filter" ? "Enter a display filter" : find.mode === "hex" ? "Enter hex bytes, e.g. 00:1b:21" : "Enter text to find"}
                onChange={(event) => setFind({ ...find, query: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void runFind(event.shiftKey);
                  if (event.key === "Escape") setFindOpen(false);
                }}
              />
              <button type="button" className={`${styles.qtButton} ${styles.qtButtonDefault}`} onClick={() => void runFind(false)}>
                Find
              </button>
              <button type="button" className={styles.qtButton} onClick={() => setFindOpen(false)}>
                Cancel
              </button>
            </div>
          ) : null}

          {gotoOpen && inCaptureView ? (
            <div className={styles.searchBar}>
              <span>Go to packet:</span>
              <input
                className={styles.searchInput}
                style={{ flex: "0 0 120px", minWidth: 0 }}
                autoFocus
                value={gotoText}
                onChange={(event) => setGotoText(event.target.value.replace(/\D/g, ""))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") gotoPacket(gotoText);
                  if (event.key === "Escape") setGotoOpen(false);
                }}
              />
              <button type="button" className={`${styles.qtButton} ${styles.qtButtonDefault}`} onClick={() => gotoPacket(gotoText)}>
                Go to packet
              </button>
              <button type="button" className={styles.qtButton} onClick={() => setGotoOpen(false)}>
                Cancel
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {/* ------------------------------------------------------------ welcome page */}
      {view === "welcome" ? (
        <div className={styles.welcomeWrap}>
          <div className={styles.welcomeHeader}>
            <WiresharkLogoIcon size={30} />
            <h1>Welcome to Wireshark</h1>
          </div>
          <div className={styles.welcomeBody}>
            {!isCaptureMode ? <h2 className={styles.welcomeHeading}>Open</h2> : null}
            <div className={styles.recentList}>
              {!isCaptureMode
                ? samples.map((sample) => (
                    <button key={sample.id} type="button" className={styles.recentLink} onClick={() => void openCapture({ sample: sample.id })} disabled={!!busy}>
                      <span>{sample.file}</span>
                      <span>{sample.title}: {sample.description}</span>
                    </button>
                  ))
                : null}
              {!isCaptureMode ? (
                <button type="button" className={styles.recentLink} onClick={() => upload.current?.click()}>
                  <span>Open a .pcap or .pcapng file…</span>
                  <span>(Ctrl+O)</span>
                </button>
              ) : null}
            </div>
            {sampleNote && !isCaptureMode ? <p className={styles.welcomeNote}>{sampleNote}</p> : null}

            <h2 className={styles.welcomeHeading}>Capture</h2>
            <div className={styles.captureFilterRow}>
              <span>…using this filter:</span>
              <WsBookmarkIcon size={14} />
              <input
                className={styles.captureFilterInput}
                value={captureFilter}
                spellCheck={false}
                placeholder="Enter a capture filter …"
                onChange={(event) => setCaptureFilter(event.target.value)}
                disabled={!live.available}
              />
              <select className={styles.searchSelect} defaultValue="all" aria-label="Interfaces shown">
                <option value="all">All interfaces shown</option>
              </select>
            </div>
            <div className={styles.ifaceList} role="listbox" aria-label="Capture interfaces">
              {interfacesForWelcome.map((item) => (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={selectedIface === item.id}
                  className={`${styles.ifaceRow} ${selectedIface === item.id ? styles.ifaceSelected : ""}`}
                  onClick={() => setSelectedIface(item.id)}
                  onDoubleClick={() => live.available && void startCapture({ interface: item.id, filter: captureFilter, ...captureLimits })}
                  title={item.id}
                >
                  <div className={styles.ifaceNameWrap}>
                    <WsInterfaceTypeIcon name={item.name} />
                    <span>{item.name}</span>
                  </div>
                  <span />
                </div>
              ))}
              {!interfacesForWelcome.length ? (
                <div className={styles.ifaceEmpty}>
                  <strong>No interfaces found.</strong>
                  {live.reason || "Checking for capture interfaces…"}
                </div>
              ) : null}
            </div>
            {busy ? <p className={styles.welcomeNote}>{busy}</p> : null}
            {message ? <p className={`${styles.welcomeNote} ${styles.statusError}`} role="alert">{message}</p> : null}

            <h2 className={styles.welcomeHeading}>Learn</h2>
            <div className={styles.learnLinks}>
              <button type="button" className={styles.recentLink} onClick={() => void openReference()}>Display Filter Reference</button>
              <span>·</span>
              <button type="button" className={styles.recentLink} onClick={() => setDialog({ kind: "about" })}>About this analyzer</button>
            </div>
            <p className={styles.welcomeNote}>You are running the LabMate packet analyzer, a practice environment laid out like Wireshark.</p>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------------------ browser page (report step) */}
      {view === "browser" ? (
        <div className={styles.browserBackdrop}>
          <div className={styles.browserWin}>
            <div className={styles.browserTabStrip}>
              <div className={styles.browserTab}>
                <span>Student Portal Login</span>
                <span style={{ opacity: 0.6 }}>✕</span>
              </div>
              <div className={styles.winCaptions} aria-hidden="true">
                <button type="button" className={styles.winBtn} tabIndex={-1}>─</button>
                <button type="button" className={styles.winBtn} tabIndex={-1}>☐</button>
                <button type="button" className={`${styles.winBtn} ${styles.winClose}`} tabIndex={-1}>✕</button>
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

      {/* ------------------------------------------------------------ packet list, details, bytes */}
      {inCaptureView ? (
        <div className={styles.panes} ref={panesRef}>
          {panesShown.map((pane, position) => {
            const weight = sizes[PANES.indexOf(pane)];
            const total = panesShown.reduce((sum, key) => sum + sizes[PANES.indexOf(key)], 0);
            const splitterAfter = position < panesShown.length - 1;
            const nextPane = splitterAfter ? panesShown[position + 1] : pane;
            return (
              <div key={pane} style={{ display: "contents" }}>
                {pane === "list" ? (
                  <div className={styles.pane} style={{ flex: `${weight / total} 1 0` }} ref={listRef} tabIndex={0} onKeyDown={listKeyDown} aria-label="Packet list">
                    <table className={styles.packetTable} style={{ fontSize }}>
                      <colgroup>
                        {widths.map((width, index) => (
                          <col key={index} style={{ width }} />
                        ))}
                      </colgroup>
                      <thead>
                        <tr>
                          {COLUMNS.map((name, index) => (
                            <th
                              key={name}
                              style={{ position: "sticky", textAlign: index === 0 || index === 5 ? "right" : "left" }}
                              onClick={() => setSort((prev) => (prev && prev.col === index ? (prev.dir === 1 ? { col: index, dir: -1 } : null) : { col: index, dir: 1 }))}
                            >
                              {sort?.col === index ? <span className={styles.sortMark}>{sort.dir === 1 ? "▲" : "▼"}</span> : null}
                              {name}
                              <span className={styles.colResize} onMouseDown={startColumnDrag(index)} onClick={(event) => event.stopPropagation()} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((row, index) => {
                          const isMarked = marked.has(row.no);
                          const bg = colorize ? row.color.bg : "#ffffff";
                          const fg = colorize ? row.color.fg : "#000000";
                          const previousCaptured = rows[(rowIndex.get(row.no) ?? 0) - 1];
                          const previousDisplayed = shown[index - 1];
                          return (
                            <tr
                              key={row.no}
                              data-no={row.no}
                              className={`${styles.packetRow} ${selected === row.no ? styles.packetRowSelected : ""} ${isMarked ? styles.packetRowMarked : ""}`}
                              style={{ height: 18 + zoom }}
                              onMouseDown={() => void selectPacket(row.no)}
                              onDoubleClick={() => setShow((s) => ({ ...s, details: true }))}
                              onContextMenu={(event) => {
                                void selectPacket(row.no);
                                showContext(event, [
                                  { label: isMarked ? "Unmark Packet" : "Mark Packet", shortcut: "Ctrl+M", action: () => toggleMark(row.no) },
                                  off("Ignore Packet", "Ctrl+D"),
                                  off("Set Time Reference", "Ctrl+T"),
                                  { divider: true },
                                  { label: "Conversation Filter", submenu: conversationFilters(row).map((item) => ({ label: item.label, action: () => void applyFilter(item.filter), disabled: !hasFile })) },
                                  { divider: true },
                                  {
                                    label: "Follow",
                                    submenu: [{ label: "TCP Stream", shortcut: "Ctrl+Alt+Shift+T", action: () => void followStream(row.stream), disabled: row.stream < 0 }],
                                  },
                                  { divider: true },
                                  {
                                    label: "Copy",
                                    submenu: [
                                      { label: "Summary as Text", action: () => copy(summaryText(row)) },
                                      { label: "…as CSV", action: () => copy(summaryText(row).split("\t").map((v) => `"${v.replace(/"/g, '""')}"`).join(",")) },
                                    ],
                                  },
                                ]);
                              }}
                            >
                              {[
                                row.no,
                                formatTime(row, timeFormat, previousCaptured, previousDisplayed),
                                address(row, "source", resolveMac),
                                address(row, "destination", resolveMac),
                                row.protocol,
                                row.length,
                                row.info,
                              ].map((value, cell) => (
                                <td key={cell} className={cell === 0 || cell === 5 ? styles.numCell : undefined} style={{ background: bg, color: fg }} title={cell === 6 ? row.info : undefined}>
                                  {value}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {capturing && !rows.length ? <div className={styles.emptyPane}>Waiting for packets on {capturing.interface}…</div> : null}
                    {!capturing && !shown.length && rows.length ? <div className={styles.emptyPane}>No packets match the display filter.</div> : null}
                  </div>
                ) : null}
                {pane === "details" ? (
                  <div className={styles.pane} style={{ flex: `${weight / total} 1 0` }} ref={detailsRef} tabIndex={0} onKeyDown={treeKeyDown} aria-label="Packet details">
                    {detail ? (
                      detail.tree.flatMap((node, index) => renderNode(node, [index], 0))
                    ) : (
                      <div className={styles.emptyPane}>{capturing ? "Packet details are shown when the capture is stopped." : "No packet selected."}</div>
                    )}
                  </div>
                ) : null}
                {pane === "bytes" ? (
                  <div className={`${styles.pane} ${styles.bytesPane}`} style={{ flex: `${weight / total} 1 0` }} ref={bytesRef} aria-label="Packet bytes">
                    {renderHex()}
                  </div>
                ) : null}
                {splitterAfter ? <div className={styles.splitter} onMouseDown={startDrag(PANES.indexOf(pane), PANES.indexOf(nextPane))} /> : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ------------------------------------------------------------ Follow TCP Stream */}
      {view === "follow" && follow ? (
        <div className={styles.modalOverlay}>
          <div className={styles.followDialog} role="dialog" aria-label="Follow TCP Stream">
            <div className={styles.followTitleBar}>
              <div className={styles.followTitleLeft}>
                <WiresharkLogoIcon size={15} />
                <span>
                  Wireshark · Follow TCP Stream (tcp.stream eq {follow.stream}) · {file}
                </span>
              </div>
              <div className={styles.winCaptions}>
                <button type="button" className={`${styles.winBtn} ${styles.winClose}`} onClick={() => setView("main")} aria-label="Close">
                  ✕
                </button>
              </div>
            </div>
            <pre className={styles.followPre}>
              {follow.chunks
                .filter((chunk) => followDirection === "entire" || chunk.side === followDirection)
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
            </div>
            <div className={styles.followControlsRow}>
              <select className={styles.followSelect} value={followDirection} onChange={(event) => setFollowDirection(event.target.value)} aria-label="Direction">
                <option value="entire">Entire conversation ({follow.chunks.reduce((total, chunk) => total + chunk.bytes, 0)} bytes)</option>
                <option value="c">
                  {follow.client} → {follow.server} ({follow.chunks.filter((c) => c.side === "c").reduce((t, c) => t + c.bytes, 0)} bytes)
                </option>
                <option value="s">
                  {follow.server} → {follow.client} ({follow.chunks.filter((c) => c.side === "s").reduce((t, c) => t + c.bytes, 0)} bytes)
                </option>
              </select>
              <span>Show data as</span>
              <select className={styles.followSelect} defaultValue="ASCII" aria-label="Show data as">
                <option value="ASCII">ASCII</option>
              </select>
              <span style={{ marginLeft: "auto" }}>Stream</span>
              <input
                type="number"
                min={0}
                value={follow.stream}
                onChange={(event) => void followStream(Number(event.target.value))}
                className={styles.followSelect}
                style={{ width: 54 }}
                aria-label="Stream"
              />
            </div>
            <div className={styles.followControlsRow}>
              <span>Find:</span>
              <input className={styles.followFindInput} style={{ flex: 1 }} value={followFind} onChange={(event) => setFollowFind(event.target.value)} />
              <button
                type="button"
                className={styles.followBtn}
                onClick={() => {
                  if (!followFind) return;
                  const text = follow.chunks.map((chunk) => chunk.text).join("");
                  setMessage(text.toLowerCase().includes(followFind.toLowerCase()) ? `Found "${followFind}" in TCP stream ${follow.stream}.` : `"${followFind}" is not in TCP stream ${follow.stream}.`);
                }}
              >
                Find Next
              </button>
            </div>
            <div className={styles.followButtonBar}>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className={styles.followBtn}
                onClick={() => {
                  setView("main");
                  void applyFilter(`!(tcp.stream eq ${follow.stream})`);
                }}
              >
                Filter Out This Stream
              </button>
              <button
                type="button"
                className={styles.followBtn}
                onClick={() =>
                  download(
                    new Blob([follow.chunks.filter((c) => followDirection === "entire" || c.side === followDirection).map((c) => c.text).join("")], { type: "text/plain" }),
                    `tcp-stream-${follow.stream}.txt`,
                  )
                }
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

      {/* ------------------------------------------------------------ dialogs */}
      {dialog?.kind === "properties" ? <PropertiesDialog data={dialog.data} filter={applied} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "hierarchy" ? (
        <HierarchyDialog rows={dialog.rows} filter={applied} file={file} onClose={() => setDialog(null)} onApply={(abbrev) => (setDialog(null), void applyFilter(abbrev))} />
      ) : null}
      {dialog?.kind === "conversations" || dialog?.kind === "endpoints" ? (
        <TrafficDialog
          mode={dialog.kind}
          file={file}
          filter={applied}
          load={dialog.kind === "conversations" ? loadConversations : loadEndpoints}
          onClose={() => setDialog(null)}
          onApply={(text) => (setDialog(null), void applyFilter(text))}
          onFollow={(stream) => (setDialog(null), void followStream(stream))}
        />
      ) : null}
      {dialog?.kind === "capture" ? (
        <CaptureOptionsDialog
          interfaces={live.interfaces}
          reason={live.reason}
          initial={{ interface: selectedIface, filter: captureFilter, ...captureLimits }}
          onClose={() => setDialog(null)}
          onStart={(settings) => {
            setSelectedIface(settings.interface);
            setCaptureFilter(settings.filter);
            setCaptureLimits({ maxPackets: settings.maxPackets, maxSeconds: settings.maxSeconds });
            void startCapture(settings);
          }}
        />
      ) : null}
      {dialog?.kind === "export" ? (
        <ExportDialog
          mode={dialog.mode}
          defaultFormat={dialog.format}
          file={file}
          counts={{ all: rows.length, displayed: shown.length, marked: marked.size }}
          onClose={() => setDialog(null)}
          onExport={(choice) => void runExport(dialog.mode, choice)}
        />
      ) : null}
      {dialog?.kind === "about" ? <AboutDialog onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "reference" ? (
        <FilterReferenceDialog
          data={dialog.data}
          onClose={() => setDialog(null)}
          onUse={(text) => {
            setDialog(null);
            setFilterText((prev) => (prev ? `${prev} ${text}` : text));
            filterInput.current?.focus();
          }}
        />
      ) : null}

      {context ? (
        <div className={styles.contextMenu} style={{ left: context.x, top: context.y }} onMouseDown={(event) => event.stopPropagation()}>
          <div style={{ position: "relative" }}>{renderMenu(context.entries, "ctx")}</div>
        </div>
      ) : null}

      {/* ------------------------------------------------------------ status bar */}
      {view !== "browser" && show.statusBar ? (
        <div className={styles.statusBar}>
          <div className={`${styles.statusLeft} ${statusIsError ? styles.statusError : ""}`}>
            <WsExpertStatusCircle level={filterState === "invalid" ? "error" : filterState === "warn" ? "warn" : "none"} />
            <span>{statusText}</span>
          </div>
          <div className={styles.statusMid}>
            {(rows.length && inCaptureView) || capturing ? `Packets: ${rows.length} · Displayed: ${shown.length} (${pct}%)${marked.size ? ` · Marked: ${marked.size}` : ""}` : "No Packets"}
          </div>
          <div className={styles.statusRight}>Profile: Default</div>
        </div>
      ) : null}
    </div>
  );
}
