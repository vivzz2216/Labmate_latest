"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import {
  CABLE_LIBRARY,
  DEVICE_CATALOG,
  defaultServerServices,
  formatShowIpRoute,
  getDevicePorts,
  isLinkUp,
  resolveAutoCable,
  simulateLocalPing,
} from "@/lib/netlab/ptEngine";
import type {
  CableType,
  DeviceModelMeta,
  PtCable,
  PtDevice,
  PtEvent,
  PtNote,
  PtPduRow,
  PtRouteRow,
  PtShape,
  PtSpec,
} from "@/lib/netlab/ptTypes";
import { PracticeBanner } from "./PracticeBanner";
import { PtDeviceModal } from "./PtDeviceModal";
import { PtPhysicalWorkspace, PtPduModal } from "./PtPduModal";
import { useStudioHook } from "./studioHook";
import styles from "./packetTracer.module.css";
import {
  PacketTracerAppIcon,
  PtActivityWizardIcon,
  PtCableShelfIcon,
  PtCanvasDeviceArtwork,
  PtCatComponentsIcon,
  PtCatConnectionsIcon,
  PtCatEndDevicesIcon,
  PtCatMiscIcon,
  PtCatMultiuserIcon,
  PtCatNetworkIcon,
  PtComplexPduIcon,
  PtCopyIcon,
  PtDeleteIcon,
  PtDrawingPaletteIcon,
  PtFastForwardIcon,
  PtInspectIcon,
  PtNewIcon,
  PtNoteIcon,
  PtOpenIcon,
  PtPacketEnvelope,
  PtPasteIcon,
  PtPowerCycleIcon,
  PtPrintIcon,
  PtRealtimeIcon,
  PtRedoIcon,
  PtResizeIcon,
  PtSaveIcon,
  PtSelectIcon,
  PtSimplePduIcon,
  PtSimulationIcon,
  PtSubCatIcon,
  PtUndoIcon,
  PtZoomInIcon,
  PtZoomOutIcon,
  PtZoomResetIcon,
} from "./PacketTracerIcons";

interface Frame {
  id: string;
  title: string;
  view: "workspace" | "simulation" | "routing";
  explain: string;
  filter: string[];
  events: PtEvent[];
  pdus: PtPduRow[];
  topology: { links: { a: string; b: string; color: string; blocked?: boolean }[]; blocked: string[] };
  mac_table?: string;
  router?: string;
  lines?: string[];
  table?: PtRouteRow[];
}
interface RunResult {
  title: string;
  spec: PtSpec;
  frames: Frame[];
  observations: string[];
}
interface Replay {
  results: { pdu: number; source: string; destination: string; success: boolean; events: PtEvent[]; error: string | null; l3_path: string[] }[];
  snapshot: { devices: { name: string; ports: { name: string; blocking: boolean }[] }[]; links: { a: string; b: string; color: string }[] };
  routing: Record<string, { table: PtRouteRow[]; show: string[] }>;
}
interface Frozen {
  tool: "packettracer";
  spec: PtSpec;
  name: string;
}

const TYPE_COLOR: Record<string, string> = { ARP: "#e8890c", ICMP: "#1e9e4a", RIP: "#7c4dbb", DNS: "#2563eb", HTTP: "#d97706" };
const LIKE = new Set(["pc", "laptop", "server", "printer", "ipphone", "tablet", "smartphone", "router", "security"]);
const MENU_ITEMS = ["File", "Edit", "Options", "View", "Tools", "Extensions", "Window", "Help"];

type MasterCat = "network" | "end" | "components" | "connections" | "misc" | "multiuser";
type NetSubCat = "routers" | "switches" | "hubs" | "wireless" | "security" | "wan";
type CanvasTool = "select" | "inspect" | "delete" | "resize" | "note" | "draw" | "simple-pdu" | "complex-pdu";

const DRAFT_KEY = "labmate.packettracer.draft";

export function PacketTracerStudio() {
  const [spec, setSpec] = useState<PtSpec | null>(null);
  const [undoStack, setUndoStack] = useState<PtSpec[]>([]);
  const [redoStack, setRedoStack] = useState<PtSpec[]>([]);
  const [name, setName] = useState("");
  const [frame, setFrame] = useState<Frame | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [index, setIndex] = useState(0);
  const [experiments, setExperiments] = useState<{ id: string; title: string }[]>([]);
  const [experiment, setExperiment] = useState("");
  const [observations, setObservations] = useState<string[]>([]);
  const [mode, setMode] = useState<"guided" | "free">("guided");
  const [actions, setActions] = useState<Record<string, unknown>[]>([]);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [routerView, setRouterView] = useState("");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  // Authentic PT 8.2 Workspace & Interaction State
  const [wsTab, setWsTab] = useState<"logical" | "physical">("logical");
  const [masterCat, setMasterCat] = useState<MasterCat>("network");
  const [netSubCat, setNetSubCat] = useState<NetSubCat>("routers");
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [placingModel, setPlacingModel] = useState<DeviceModelMeta | null>(null);
  const [placingCable, setPlacingCable] = useState<CableType | null>(null);
  const [cableStart, setCableStart] = useState<{ device: PtDevice; port: string } | null>(null);
  const [portPicker, setPortPicker] = useState<{ device: PtDevice; screenX: number; screenY: number } | null>(null);
  const [mouseSvg, setMouseSvg] = useState<{ x: number; y: number }>({ x: 500, y: 300 });
  const [dragState, setDragState] = useState<{ name: string; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const [pduSourcePick, setPduSourcePick] = useState<string | null>(null);
  const [localEvents, setLocalEvents] = useState<PtEvent[]>([]);
  const [localPdus, setLocalPdus] = useState<PtPduRow[]>([]);
  const [simFilterSet, setSimFilterSet] = useState<Set<string>>(() => new Set(["ARP", "ICMP", "RIP", "DNS", "HTTP"]));
  const [playingSim, setPlayingSim] = useState(false);
  const [simCursor, setSimCursor] = useState<number | null>(null);
  const [simSpeedMs, setSimSpeedMs] = useState(650);
  const [constantDelay, setConstantDelay] = useState(true);
  const [selectedEventModal, setSelectedEventModal] = useState<PtEvent | null>(null);
  const [openDeviceModal, setOpenDeviceModal] = useState<string | null>(null);
  const [copiedDevice, setCopiedDevice] = useState<PtDevice | null>(null);
  const [selectedDeviceName, setSelectedDeviceName] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showFiltersDialog, setShowFiltersDialog] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [simElapsed, setSimElapsed] = useState("00:00:05");
  const [canvasBg, setCanvasBg] = useState<string>("#ffffff");
  const [noteDraft, setNoteDraft] = useState<{ x: number; y: number } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [complexPduOpen, setComplexPduOpen] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const recorded = useRef(false);
  const openInput = useRef<HTMLInputElement>(null);
  const restoredDraft = useRef(false);

  const commitSpec = useCallback(
    (next: PtSpec) => {
      if (spec) {
        setUndoStack((prev) => [...prev.slice(-20), spec]);
        setRedoStack([]);
      }
      setSpec(next);
    },
    [spec],
  );

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("capture")) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "null");
      if (saved?.spec && Array.isArray(saved.spec.devices) && saved.spec.devices.length) {
        restoredDraft.current = true;
        setSpec(saved.spec);
        setName(saved.name || "Restored topology");
        setMode("free");
      }
    } catch {
      /* no stored draft, or storage blocked */
    }
  }, []);

  useEffect(() => {
    if (mode !== "free" || !spec || recorded.current) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, spec }));
    } catch {
      /* storage full or blocked: autosave is a convenience */
    }
  }, [mode, spec, name]);

  useStudioHook<Frozen, Frame>(
    {
      load: (state) => {
        recorded.current = true;
        setSpec(state.spec);
        setName(state.name);
        setTick((n) => n + 1);
      },
      show: (next) => {
        setFrame(next);
        setTick((n) => n + 1);
      },
    },
    `${tick}:${frame?.id}`,
  );

  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [openMenu]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("capture")) return;
    api
      .get("/api/netlab/packettracer/experiments")
      .then((response) => {
        setExperiments(response.data);
        if (response.data.length) setExperiment(response.data[0].id);
      })
      .catch(() => setError("The experiment list could not be loaded."));
  }, []);

  useEffect(() => {
    if (!experiment || recorded.current) return;
    if (restoredDraft.current) {
      restoredDraft.current = false;           // keep the student's autosaved topology; choosing an experiment again loads it
      return;
    }
    api
      .get(`/api/netlab/packettracer/run/${experiment}`)
      .then((response) => {
        const run: RunResult = response.data;
        setSpec(run.spec);
        setUndoStack([]);
        setRedoStack([]);
        setName(run.title);
        setFrames(run.frames);
        setObservations(run.observations);
        setIndex(0);
        setFrame(run.frames[0] ?? null);
        setActions([]);
        setReplay(null);
        setLocalEvents([]);
        setLocalPdus([]);
        setSimCursor(null);
        setPlayingSim(false);
        setRouterView("");
        setPduSourcePick(null);
        setMode("guided");
      })
      .catch(() => setError("The experiment could not be loaded."));
  }, [experiment]);

  const runActions = useCallback(
    async (next: Record<string, unknown>[]) => {
      if (!spec) return;
      try {
        const response = await api.post("/api/netlab/packettracer/replay", { spec, actions: next });
        setReplay(response.data);
        setActions(next);
        setError("");
      } catch (problem) {
        // The server engine refused the topology (for example two devices with one address, or a gateway outside its subnet).
        // Say why, then still show what the browser engine computes so the student sees the effect of the mistake.
        const detail = (problem as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
        const reason = typeof detail === "string" ? detail : "The server could not check this topology.";
        const lastAct = next[next.length - 1];
        if (lastAct?.type === "ping") {
          const sim = simulateLocalPing(spec, String(lastAct.from), String(lastAct.to), localPdus.length + 1);
          setLocalEvents((prev) => [...prev, ...sim.events]);
          setLocalPdus((prev) => [
            ...prev,
            { pdu: prev.length + 1, source: String(lastAct.from), destination: sim.targetName !== "?" ? sim.targetName : String(lastAct.to), status: sim.success ? "Successful" : "Failed" },
          ]);
          setSimCursor(0);
          setError([reason, sim.error].filter(Boolean).join(" "));
        } else {
          setError(reason);
        }
      }
    },
    [spec, localPdus.length],
  );

  const pcs = useMemo(
    () => (spec?.devices ?? []).filter((d) => ["pc", "laptop", "server"].includes(d.type)),
    [spec],
  );
  useEffect(() => {
    if (pcs.length >= 2 && (!from || !pcs.some((p) => p.name === from))) {
      setFrom(pcs[0].name);
      setTo(pcs[1].name);
    }
  }, [pcs, from]);

  const view: Frame | null = useMemo(() => {
    if (mode === "free") {
      if (replay) {
        const blocked = replay.snapshot.devices.flatMap((d) => d.ports.filter((p) => p.blocking).map((p) => `${d.name} ${p.name}`));
        const events = [...replay.results.flatMap((r) => r.events), ...localEvents];
        const pdus = [
          ...replay.results.map((r) => ({ pdu: r.pdu, source: r.source, destination: r.destination, status: r.success ? "Successful" : "Failed" })),
          ...localPdus,
        ];
        return {
          id: "free",
          title: "Free practice",
          view: "simulation",
          explain: replay.results.length ? `Last result: ${replay.results[replay.results.length - 1].success ? "successful" : "failed"}.` : "",
          filter: Array.from(simFilterSet),
          events,
          pdus,
          topology: { links: replay.snapshot.links, blocked },
        };
      }
      return {
        id: "free-local",
        title: "Free practice",
        view: "simulation",
        explain: "Interactive workspace: place devices, connect ports with cables, configure CLI/IPs, or send Simple PDUs.",
        filter: Array.from(simFilterSet),
        events: localEvents,
        pdus: localPdus,
        topology: {
          links: (spec?.links ?? []).map((l) => ({ a: l.a, b: l.b, color: spec && isLinkUp(spec, l) ? "green" : "red" })),
          blocked: [],
        },
      };
    }
    return frame;
  }, [mode, replay, frame, localEvents, localPdus, simFilterSet, spec]);

  const viewBoxObj = useMemo(() => {
    const devices = spec?.devices ?? [];
    if (!devices.length) return { minX: 0, minY: 0, w: 1000 / zoomScale, h: 600 / zoomScale };
    const xs = devices.map((d) => d.x);
    const ys = devices.map((d) => d.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const rawW = Math.max(820, Math.max(...xs) - Math.min(...xs) + 280);
    const rawH = Math.max(480, Math.max(...ys) - Math.min(...ys) + 190);
    const w = rawW / zoomScale;
    const h = rawH / zoomScale;
    return { minX: cx - w / 2, minY: cy - h / 2, w, h };
  }, [spec, zoomScale]);
  const viewBox = `${viewBoxObj.minX} ${viewBoxObj.minY} ${viewBoxObj.w} ${viewBoxObj.h}`;

  const clientToSvg = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 500, y: 300 };
      const rect = svg.getBoundingClientRect();
      const x = viewBoxObj.minX + ((clientX - rect.left) / Math.max(1, rect.width)) * viewBoxObj.w;
      const y = viewBoxObj.minY + ((clientY - rect.top) / Math.max(1, rect.height)) * viewBoxObj.h;
      return { x: Math.round(x), y: Math.round(y) };
    },
    [viewBoxObj],
  );

  const positions = useMemo(() => Object.fromEntries((spec?.devices ?? []).map((d) => [d.name, d])), [spec]);
  const typeOf = (deviceName: string) => positions[deviceName]?.type;
  const cableStrokeDash = (cable: PtCable) => {
    if (cable.cable === "cross") return "6 4";
    if (cable.cable === "straight" || cable.cable === "fiber" || cable.cable === "console") return undefined;
    return LIKE.has(typeOf(cable.a) ?? "") === LIKE.has(typeOf(cable.b) ?? "") ? "6 4" : undefined;
  };
  const cableStrokeColor = (cable: PtCable) => {
    if (cable.cable === "console") return "#0EA5E9";
    if (cable.cable === "fiber") return "#EA580C";
    if (cable.cable === "phone") return "#16A34A";
    if (cable.cable === "coaxial") return "#2563EB";
    if (cable.cable === "serial-dce" || cable.cable === "serial-dte") return "#DC2626";
    return "#1e242b";
  };
  const lightFor = (cable: PtCable, end: "a" | "b") => {
    if (spec && !isLinkUp(spec, cable)) return "#e52521";
    const found = view?.topology.links.find((l) => (l.a === cable.a && l.b === cable.b) || (l.a === cable.b && l.b === cable.a));
    const port = end === "a" ? `${cable.a} ${cable.ap}` : `${cable.b} ${cable.bp}`;
    if (view?.topology.blocked.includes(port)) return "#f2a900";
    return (found?.color ?? "green") === "green" ? "#1bb934" : "#e52521";
  };

  const typesShown = useMemo(
    () => (mode === "guided" ? new Set(view?.filter ?? []) : simFilterSet),
    [mode, view?.filter, simFilterSet],
  );
  const events = useMemo(
    () => (view?.events ?? []).filter((event) => typesShown.has(event.type)),
    [view?.events, typesShown],
  );
  const simOpen = view?.view === "simulation" || mode === "free";

  // Auto-Capture / Play animation timer in Simulation Panel
  useEffect(() => {
    if (!playingSim || !events.length) return;
    const id = setInterval(() => {
      setSimCursor((prev) => {
        const next = prev === null ? 0 : prev + 1;
        if (next >= events.length) {
          setPlayingSim(false);
          return events.length - 1;
        }
        return next;
      });
    }, simSpeedMs);
    return () => clearInterval(id);
  }, [playingSim, events.length, simSpeedMs]);

  const overlay = useMemo(() => {
    const items: { key: string; x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
    events.forEach((event, i) => {
      const a = positions[event.last];
      const b = positions[event.at];
      if (a && b && a.name !== b.name) items.push({ key: `${i}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: TYPE_COLOR[event.type] ?? "#555" });
    });
    return items;
  }, [events, positions]);

  const activeEnvelopes = useMemo(() => {
    if (!simOpen || !events.length) return [];
    if (simCursor !== null && events[simCursor]) {
      const ev = events[simCursor];
      const atDev = positions[ev.at];
      const lastDev = positions[ev.last];
      if (atDev && lastDev) {
        return [{ key: "step", x: (atDev.x + lastDev.x) / 2, y: (atDev.y + lastDev.y) / 2, color: TYPE_COLOR[ev.type] ?? "#e8890c", type: ev.type }];
      }
      if (atDev) {
        return [{ key: "step", x: atDev.x + 28, y: atDev.y - 20, color: TYPE_COLOR[ev.type] ?? "#e8890c", type: ev.type }];
      }
    }
    const seen = new Map<string, { key: string; x: number; y: number; color: string; type: string }>();
    events.slice(-4).forEach((ev) => {
      const dev = positions[ev.at];
      if (dev) seen.set(dev.name, { key: dev.name, x: dev.x + 28, y: dev.y - 20, color: TYPE_COLOR[ev.type] ?? "#e8890c", type: ev.type });
    });
    return Array.from(seen.values());
  }, [simOpen, events, positions, simCursor]);

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    setPortPicker(null);
    if (!spec || recorded.current) return;
    const pt = clientToSvg(e.clientX, e.clientY);

    if (placingModel) {
      const base = placingModel.kind === "pc" ? "PC" : placingModel.kind === "router" ? "Router" : placingModel.kind === "switch" ? "Switch" : placingModel.kind === "hub" ? "Hub" : placingModel.kind === "server" ? "Server" : placingModel.label.replace(/[^A-Za-z]/g, "");
      let n = 0;
      while (spec.devices.some((d) => d.name === `${base}${n}`)) n++;
      const newDev: PtDevice = {
        type: placingModel.kind,
        model: placingModel.model,
        name: `${base}${n}`,
        x: pt.x,
        y: pt.y,
        power: true,
        interfaces: Object.fromEntries(
          placingModel.defaultPorts.filter((p) => p !== "Console" && p !== "RS 232").map((p) => [p, { ip: "", mask: "255.255.255.0", shutdown: placingModel.kind === "router" }]),
        ),
        services: placingModel.kind === "server" ? defaultServerServices() : undefined,
      };
      commitSpec({ ...spec, devices: [...spec.devices, newDev] });
      setPlacingModel(null);
      setMode("free");
      return;
    }

    if (activeTool === "note") {
      setNoteDraft(pt);
      setNoteText("");
      return;
    }

    if (activeTool === "draw") {
      const shape: PtShape = {
        id: `shape-${Date.now()}`,
        kind: "rect",
        x: pt.x - 85,
        y: pt.y - 55,
        w: 170,
        h: 110,
        fill: "rgba(191, 219, 254, 0.35)",
        stroke: "#60a5fa",
      };
      commitSpec({ ...spec, shapes: [...(spec.shapes ?? []), shape] });
      setActiveTool("select");
      return;
    }
  };

  const handleDeviceAction = (e: React.MouseEvent, device: PtDevice) => {
    e.stopPropagation();
    if (recorded.current) {
      if (device.type === "router") setRouterView(device.name);
      return;
    }
    setSelectedDeviceName(device.name);

    if (activeTool === "delete" && spec) {
      commitSpec({
        ...spec,
        devices: spec.devices.filter((d) => d.name !== device.name),
        links: spec.links.filter((l) => l.a !== device.name && l.b !== device.name),
      });
      return;
    }

    if (placingCable && spec) {
      if (placingCable === "auto" && cableStart) {
        if (cableStart.device.name === device.name) return;
        const usedA = new Set(spec.links.flatMap((l) => (l.a === cableStart.device.name ? [l.ap] : l.b === cableStart.device.name ? [l.bp] : [])));
        const usedB = new Set(spec.links.flatMap((l) => (l.a === device.name ? [l.ap] : l.b === device.name ? [l.bp] : [])));
        const freeA = getDevicePorts(cableStart.device).find((p) => p !== "Console" && p !== "RS 232" && !usedA.has(p));
        const freeB = getDevicePorts(device).find((p) => p !== "Console" && p !== "RS 232" && !usedB.has(p));
        if (freeA && freeB) {
          const resolved = resolveAutoCable(cableStart.device, freeA, device, freeB);
          commitSpec({ ...spec, links: [...spec.links, { a: cableStart.device.name, ap: freeA, b: device.name, bp: freeB, cable: resolved }] });
          setMode("free");
        }
        setCableStart(null);
        return;
      }
      setPortPicker({ device, screenX: e.clientX, screenY: e.clientY });
      return;
    }

    if (activeTool === "simple-pdu") {
      if (!pduSourcePick) {
        setPduSourcePick(device.name);
      } else if (pduSourcePick !== device.name) {
        const target = device.ip || Object.values(device.interfaces ?? {})[0]?.ip || device.name;
        setMode("free");
        void runActions([...actions, { type: "ping", from: pduSourcePick, to: target }]);
        setPduSourcePick(null);
        setActiveTool("select");
      }
      return;
    }

    if (activeTool === "inspect") {
      if (device.type === "router") setRouterView(device.name);
      else setOpenDeviceModal(device.name);
      return;
    }

    // Default Select tool click (without drag): open full Cisco Packet Tracer Device Window
    setOpenDeviceModal(device.name);
  };

  const handlePickPort = (device: PtDevice, port: string) => {
    setPortPicker(null);
    if (!placingCable || !spec) return;
    if (!cableStart) {
      setCableStart({ device, port });
      return;
    }
    if (cableStart.device.name === device.name) return;
    const resolved = placingCable === "auto" ? resolveAutoCable(cableStart.device, cableStart.port, device, port) : placingCable;
    commitSpec({
      ...spec,
      links: [...spec.links, { a: cableStart.device.name, ap: cableStart.port, b: device.name, bp: port, cable: resolved }],
    });
    setCableStart(null);
    setMode("free");
  };

  const toggleOrDeleteCable = (cable: PtCable) => {
    if (!spec || recorded.current) return;
    if (activeTool === "delete") {
      commitSpec({ ...spec, links: spec.links.filter((l) => l !== cable) });
      return;
    }
    if (mode === "free") {
      const current = replay?.snapshot.links.find((l) => (l.a === cable.a && l.b === cable.b) || (l.a === cable.b && l.b === cable.a));
      const up = current ? current.color !== "green" : false;
      void runActions([...actions, { type: "link", a: cable.a, b: cable.b, up }]);
    }
  };

  const routingWindow = useMemo(() => {
    if (view?.view === "routing" && view.router) return { name: view.router, table: view.table ?? [], lines: view.lines ?? [] };
    if (routerView && spec) {
      const r = spec.devices.find((d) => d.name === routerView);
      if (r && r.type === "router") {
        if (replay?.routing[routerView]) return { name: routerView, table: replay.routing[routerView].table, lines: replay.routing[routerView].show };
        return { name: routerView, table: [], lines: formatShowIpRoute(spec, r) };
      }
    }
    return null;
  }, [view, routerView, replay, spec]);

  const activeDeviceObj = useMemo(
    () => (openDeviceModal && spec ? spec.devices.find((d) => d.name === openDeviceModal) ?? null : null),
    [openDeviceModal, spec],
  );

  const shelfModels = useMemo(() => {
    if (masterCat === "connections") {
      return CABLE_LIBRARY.map((c) => ({ kind: "cable" as const, cable: c.id, label: c.label }));
    }
    if (masterCat === "end" || masterCat === "components" || masterCat === "misc" || masterCat === "multiuser") {
      return DEVICE_CATALOG.end.map((m) => ({ kind: "device" as const, meta: m }));
    }
    return (DEVICE_CATALOG[netSubCat] ?? DEVICE_CATALOG.routers).map((m) => ({ kind: "device" as const, meta: m }));
  }, [masterCat, netSubCat]);

  const undo = () => {
    if (!undoStack.length || !spec) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, spec]);
    setUndoStack((u) => u.slice(0, -1));
    setSpec(prev);
  };

  const redo = () => {
    if (!redoStack.length || !spec) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, spec]);
    setRedoStack((r) => r.slice(0, -1));
    setSpec(next);
  };

  function saveTopology() {
    if (!spec) return;
    const blob = new Blob([JSON.stringify({ format: "labmate-topology", version: 1, name, spec }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${(name || "topology").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  }

  async function openTopology(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      const loaded: PtSpec = parsed?.spec ?? parsed;
      if (!loaded || !Array.isArray(loaded.devices) || !Array.isArray(loaded.links)) throw new Error("shape");
      commitSpec(loaded);
      setName(parsed?.name || file.name.replace(/\.json$/i, ""));
      setMode("free");
      setActions([]);
      setReplay(null);
      setLocalEvents([]);
      setLocalPdus([]);
      setError("");
    } catch {
      setError("This file is not a topology saved by LabMate (File > Save Topology JSON).");
    }
  }

  const getMenuEntries = (item: string): Array<{ divider: true } | { label: string; action: () => void; disabled?: boolean }> => {
    if (item === "File")
      return [
        {
          label: "New Blank Workspace",
          action: () => {
            commitSpec({ name: "Custom Topology", devices: [], links: [] });
            setName("Custom Topology");
            setMode("free");
          },
        },
        { label: "Open Topology JSON…", action: () => openInput.current?.click() },
        { label: "Save Topology JSON", action: saveTopology },
        { divider: true },
        { label: "Print Topology", action: () => window.print() },
      ];
    if (item === "Edit")
      return [
        { label: "Undo", disabled: !undoStack.length, action: undo },
        { label: "Redo", disabled: !redoStack.length, action: redo },
        { divider: true },
        {
          label: "Copy Selected Device",
          disabled: !selectedDeviceName,
          action: () => {
            const dev = spec?.devices.find((d) => d.name === selectedDeviceName);
            if (dev) setCopiedDevice(dev);
          },
        },
        {
          label: "Paste Device",
          disabled: !copiedDevice || !spec,
          action: () => {
            if (!copiedDevice || !spec) return;
            const copyName = `${copiedDevice.name}_copy`;
            commitSpec({ ...spec, devices: [...spec.devices, { ...copiedDevice, name: copyName, x: copiedDevice.x + 60, y: copiedDevice.y + 45 }] });
          },
        },
      ];
    if (item === "View")
      return [
        { label: "Logical Workspace", action: () => setWsTab("logical") },
        { label: "Physical Workspace", action: () => setWsTab("physical") },
        { divider: true },
        { label: "Zoom In", action: () => setZoomScale((z) => Math.min(1.6, +(z + 0.1).toFixed(2))) },
        { label: "Zoom Reset", action: () => setZoomScale(1) },
        { label: "Zoom Out", action: () => setZoomScale((z) => Math.max(0.6, +(z - 0.1).toFixed(2))) },
      ];
    if (item === "Options")
      return [
        { label: "Toggle Tiled Canvas Tint", action: () => setCanvasBg((b) => (b === "#ffffff" ? "#f4f7fb" : "#ffffff")) },
        { label: "Set Free Practice Mode", action: () => setMode("free") },
      ];
    return [{ label: `${item} (Practice Environment)`, disabled: true, action: () => {} }];
  };

  return (
    <div className={styles.ptRoot}>
      <PracticeBanner tool="Cisco Packet Tracer" />

      {/* Title Bar */}
      <div className={styles.titleBar}>
        <div className={styles.titleLeft}>
          <PacketTracerAppIcon size={17} />
          <span className={styles.titleText}>
            Cisco Packet Tracer — {name ? `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pkt` : "untitled.pkt"}
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

      {/* Interactive Menu Bar */}
      <div className={styles.menuBar} role="menubar" aria-label="Packet Tracer menu bar" style={{ position: "relative" }}>
        {MENU_ITEMS.map((item) => (
          <div key={item} style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <span
              className={styles.menuItem}
              style={{ background: openMenu === item ? "#dfeaf7" : undefined, cursor: "pointer" }}
              onClick={() => setOpenMenu((cur) => (cur === item ? null : item))}
            >
              {item}
            </span>
            {openMenu === item && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  minWidth: 190,
                  background: "#ffffff",
                  border: "1px solid #9aa4b2",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
                  padding: "3px 0",
                  zIndex: 80,
                }}
              >
                {getMenuEntries(item).map((entry, idx) =>
                  "divider" in entry ? (
                    <div key={idx} style={{ height: 1, background: "#e2e8f0", margin: "3px 0" }} />
                  ) : (
                    <button
                      key={entry.label}
                      type="button"
                      disabled={entry.disabled}
                      onClick={() => {
                        setOpenMenu(null);
                        entry.action();
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "4px 12px",
                        border: "none",
                        background: "transparent",
                        cursor: entry.disabled ? "default" : "pointer",
                        opacity: entry.disabled ? 0.45 : 1,
                        fontSize: 11.5,
                      }}
                    >
                      {entry.label}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Top Main Toolbar */}
      <div className={styles.mainToolbar} role="toolbar" aria-label="Main Toolbar">
        <button
          type="button"
          className={styles.tbBtn}
          title="New Topology"
          onClick={() => {
            commitSpec({ name: "Blank Topology", devices: [], links: [] });
            setName("Blank Topology");
            setMode("free");
          }}
        >
          <PtNewIcon />
        </button>
        <button type="button" className={styles.tbBtn} title="Open" onClick={() => openInput.current?.click()}>
          <PtOpenIcon />
        </button>
        <button type="button" className={styles.tbBtn} title="Save" onClick={saveTopology}>
          <PtSaveIcon />
        </button>
        <input
          ref={openInput}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Open topology file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void openTopology(file);
          }}
        />
        <button type="button" className={styles.tbBtn} title="Print" onClick={() => window.print()}>
          <PtPrintIcon />
        </button>
        <button type="button" className={styles.tbBtn} title="Activity Wizard">
          <PtActivityWizardIcon />
        </button>
        <div className={styles.tbSep} />
        <button
          type="button"
          className={styles.tbBtn}
          title="Copy"
          disabled={!selectedDeviceName}
          onClick={() => {
            const dev = spec?.devices.find((d) => d.name === selectedDeviceName);
            if (dev) setCopiedDevice(dev);
          }}
        >
          <PtCopyIcon />
        </button>
        <button
          type="button"
          className={styles.tbBtn}
          title="Paste"
          disabled={!copiedDevice || !spec}
          onClick={() => {
            if (!copiedDevice || !spec) return;
            const copyName = `${copiedDevice.name}_copy`;
            commitSpec({ ...spec, devices: [...spec.devices, { ...copiedDevice, name: copyName, x: copiedDevice.x + 60, y: copiedDevice.y + 45 }] });
          }}
        >
          <PtPasteIcon />
        </button>
        <button type="button" className={styles.tbBtn} title="Undo" disabled={!undoStack.length} onClick={undo}>
          <PtUndoIcon />
        </button>
        <button type="button" className={styles.tbBtn} title="Redo" disabled={!redoStack.length} onClick={redo}>
          <PtRedoIcon />
        </button>
        <div className={styles.tbSep} />
        <button type="button" className={styles.tbBtn} title="Zoom In" onClick={() => setZoomScale((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}>
          <PtZoomInIcon />
        </button>
        <button type="button" className={styles.tbBtn} title="Zoom to Fit / Reset" onClick={() => setZoomScale(1)}>
          <PtZoomResetIcon />
        </button>
        <button type="button" className={styles.tbBtn} title="Zoom Out" onClick={() => setZoomScale((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}>
          <PtZoomOutIcon />
        </button>
        <div className={styles.tbSep} />
        <button
          type="button"
          className={styles.tbBtn}
          title="Drawing Palette (Draw Zone)"
          onClick={() => {
            setActiveTool("draw");
            setPlacingModel(null);
            setPlacingCable(null);
          }}
        >
          <PtDrawingPaletteIcon />
        </button>
        {placingModel ? (
          <span style={{ marginLeft: 8, background: "#dbeafe", border: "1px solid #60a5fa", padding: "1px 8px", borderRadius: 3, fontSize: 11 }}>
            Click canvas to place <b>{placingModel.model}</b> (Esc / Click to place)
          </span>
        ) : placingCable ? (
          <span style={{ marginLeft: 8, background: "#fef3c7", border: "1px solid #f59e0b", padding: "1px 8px", borderRadius: 3, fontSize: 11 }}>
            {cableStart
              ? `Connecting from ${cableStart.device.name} (${cableStart.port}) — click target device`
              : `Cable mode (${placingCable}) — click source device`}
            <button
              type="button"
              onClick={() => {
                setPlacingCable(null);
                setCableStart(null);
              }}
              style={{ marginLeft: 6, fontSize: 10 }}
            >
              Cancel
            </button>
          </span>
        ) : pduSourcePick ? (
          <span style={{ marginLeft: 8, background: "#dcfce7", border: "1px solid #22c55e", padding: "1px 8px", borderRadius: 3, fontSize: 11 }}>
            PDU source: <b>{pduSourcePick}</b> — click destination device
          </span>
        ) : null}
      </div>

      {/* Logical / Physical Workspace Bar */}
      <div className={styles.workspaceBar}>
        <div className={styles.wsBarLeft}>
          <div className={styles.logPhysTabs}>
            <button type="button" className={`${styles.logPhysTab} ${wsTab === "logical" ? styles.logPhysActive : ""}`} onClick={() => setWsTab("logical")}>
              Logical
            </button>
            <button type="button" className={`${styles.logPhysTab} ${wsTab === "physical" ? styles.logPhysActive : ""}`} onClick={() => setWsTab("physical")}>
              Physical
            </button>
          </div>
          <span className={styles.coordBadge}>
            [{mouseSvg.x}, {mouseSvg.y}]
          </span>
          <span className={styles.wsToolChip}>Root</span>
          <span className={styles.wsToolChip}>New Cluster</span>
          <span className={styles.wsToolChip}>Move Object</span>
          <button
            type="button"
            className={styles.wsToolChip}
            style={{ cursor: "pointer" }}
            onClick={() => setCanvasBg((b) => (b === "#ffffff" ? "#f4f7fb" : "#ffffff"))}
          >
            Set Tiled Background
          </button>
        </div>

        {!recorded.current ? (
          <div className={styles.labControls}>
            <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span>Experiment</span>
              <select aria-label="Experiment" value={experiment} onChange={(event) => setExperiment(event.target.value)}>
                {experiments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className={mode === "guided" ? styles.ctrlActive : ""} onClick={() => setMode("guided")}>
              Guided steps
            </button>
            <button
              type="button"
              className={mode === "free" ? styles.ctrlActive : ""}
              onClick={() => {
                setMode("free");
                void runActions(actions);
              }}
            >
              Free practice
            </button>
            {mode === "guided" ? (
              <>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => {
                    setIndex(index - 1);
                    setFrame(frames[index - 1]);
                  }}
                >
                  ◀ Previous
                </button>
                <span style={{ fontSize: 11.5 }}>
                  Step {frames.length ? index + 1 : 0} of {frames.length}
                </span>
                <button
                  type="button"
                  disabled={index >= frames.length - 1}
                  onClick={() => {
                    setIndex(index + 1);
                    setFrame(frames[index + 1]);
                  }}
                >
                  Next ▶
                </button>
              </>
            ) : (
              <>
                <select aria-label="From" value={from} onChange={(event) => setFrom(event.target.value)}>
                  {pcs.map((p) => (
                    <option key={p.name}>{p.name}</option>
                  ))}
                </select>
                <span>→</span>
                <select aria-label="To" value={to} onChange={(event) => setTo(event.target.value)}>
                  {pcs.map((p) => (
                    <option key={p.name}>{p.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const target = pcs.find((p) => p.name === to)?.ip || pcs.find((p) => p.name === to)?.name;
                    if (target) void runActions([...actions, { type: "ping", from, to: target }]);
                  }}
                >
                  Send PDU
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocalEvents([]);
                    setLocalPdus([]);
                    void runActions([]);
                  }}
                >
                  Reset
                </button>
              </>
            )}
            {error ? (
              <span role="alert" style={{ color: "#b00020", fontWeight: 600 }}>
                {error}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* =================================================================
       * Middle Workspace: Logical/Physical Canvas + Tools Rail + Sim Panel
       * ================================================================= */}
      <div className={styles.middleArea}>
        <div className={styles.canvasPane} style={{ background: canvasBg }}>
          {wsTab === "physical" && spec ? (
            <PtPhysicalWorkspace spec={spec} />
          ) : (
            <svg
              ref={svgRef}
              viewBox={viewBox}
              preserveAspectRatio="xMidYMid meet"
              className={styles.canvasSvg}
              role="img"
              aria-label="Network topology"
              onClick={handleCanvasClick}
              onMouseMove={(e) => {
                const pt = clientToSvg(e.clientX, e.clientY);
                setMouseSvg(pt);
                if (dragState && spec && !recorded.current) {
                  const nx = pt.x + dragState.offsetX;
                  const ny = pt.y + dragState.offsetY;
                  setDragState((d) => (d ? { ...d, moved: true } : d));
                  setSpec({
                    ...spec,
                    devices: spec.devices.map((d) => (d.name === dragState.name ? { ...d, x: nx, y: ny } : d)),
                  });
                }
              }}
              onMouseUp={() => {
                if (dragState) setDragState(null);
              }}
            >
              <defs>
                <pattern id="ptGridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f3f7" strokeWidth="1" />
                </pattern>
              </defs>
              <rect x="-2000" y="-2000" width="5000" height="5000" fill={canvasBg === "#ffffff" ? "url(#ptGridPattern)" : canvasBg} />

              {/* User Drawn Shapes */}
              {(spec?.shapes ?? []).map((s) => (
                <rect key={s.id} x={s.x} y={s.y} width={s.w} height={s.h} fill={s.fill} stroke={s.stroke} strokeWidth={1.5} rx={6} />
              ))}

              {/* Rubber-band line during cable placement */}
              {cableStart && (
                <line
                  x1={cableStart.device.x}
                  y1={cableStart.device.y}
                  x2={mouseSvg.x}
                  y2={mouseSvg.y}
                  stroke={CABLE_LIBRARY.find((c) => c.id === placingCable)?.color ?? "#0284c7"}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                />
              )}

              {/* Cables + Authentic Green/Red/Amber Link Triangles */}
              {spec?.links.map((cable, i) => {
                const a = positions[cable.a];
                const b = positions[cable.b];
                if (!a || !b) return null;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const length = Math.hypot(dx, dy) || 1;
                const ux = dx / length;
                const uy = dy / length;
                const px = -uy;
                const py = ux;
                const spot = (end: "a" | "b") => {
                  const dev = end === "a" ? a : b;
                  const dist = dev.type === "pc" ? 39 : 43;
                  return end === "a" ? { x: a.x + ux * dist, y: a.y + uy * dist } : { x: b.x - ux * dist, y: b.y - uy * dist };
                };
                const pa = spot("a");
                const pb = spot("b");
                const colorA = lightFor(cable, "a");
                const colorB = lightFor(cable, "b");
                const vertical = Math.abs(dx) < 28;
                const lblA = vertical
                  ? { x: pa.x + 9, y: pa.y + (dy > 0 ? 4 : -4), anchor: "start" as const }
                  : { x: pa.x + (dx >= 0 ? 8 : -8), y: pa.y - 7, anchor: (dx >= 0 ? "start" : "end") as "start" | "end" };
                const lblB = vertical
                  ? { x: pb.x + 9, y: pb.y + (dy > 0 ? 2 : 10), anchor: "start" as const }
                  : { x: pb.x + (dx >= 0 ? -8 : 8), y: pb.y - 7, anchor: (dx >= 0 ? "end" : "start") as "start" | "end" };

                const tri = (pt: { x: number; y: number }, dir: number, color: string) => {
                  if (color === "#f2a900") {
                    return <circle cx={pt.x} cy={pt.y} r={5.5} fill={color} stroke="#475569" strokeWidth={0.8} />;
                  }
                  const tipX = pt.x + ux * dir * 6;
                  const tipY = pt.y + uy * dir * 6;
                  const baseX = pt.x - ux * dir * 4;
                  const baseY = pt.y - uy * dir * 4;
                  return (
                    <polygon
                      points={`${tipX},${tipY} ${baseX + px * 5},${baseY + py * 5} ${baseX - px * 5},${baseY - py * 5}`}
                      fill={color}
                      stroke="#1e293b"
                      strokeWidth={0.7}
                    />
                  );
                };

                return (
                  <g key={i} onClick={(ev) => { ev.stopPropagation(); toggleOrDeleteCable(cable); }} style={{ cursor: mode === "free" || activeTool === "delete" ? "pointer" : "default" }}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={cableStrokeColor(cable)}
                      strokeWidth={2}
                      strokeDasharray={cableStrokeDash(cable)}
                    />
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
                    {cable.cable !== "console" && (
                      <>
                        {tri(pa, 1, colorA)}
                        {tri(pb, -1, colorB)}
                      </>
                    )}
                    <text
                      x={lblA.x}
                      y={lblA.y}
                      fontSize={9.5}
                      fill="#475569"
                      stroke="#ffffff"
                      strokeWidth={3}
                      paintOrder="stroke"
                      textAnchor={lblA.anchor}
                    >
                      {cable.ap.replace("FastEthernet", "Fa").replace("GigabitEthernet", "Gi")}
                    </text>
                    <text
                      x={lblB.x}
                      y={lblB.y}
                      fontSize={9.5}
                      fill="#475569"
                      stroke="#ffffff"
                      strokeWidth={3}
                      paintOrder="stroke"
                      textAnchor={lblB.anchor}
                    >
                      {cable.bp.replace("FastEthernet", "Fa").replace("GigabitEthernet", "Gi")}
                    </text>
                  </g>
                );
              })}

              {/* Packet Flow Glow */}
              {overlay.map((item) => (
                <line
                  key={item.key}
                  x1={item.x1}
                  y1={item.y1}
                  x2={item.x2}
                  y2={item.y2}
                  stroke={item.color}
                  strokeWidth={6}
                  opacity={0.3}
                  strokeLinecap="round"
                />
              ))}

              {/* Devices */}
              {spec?.devices.map((device) => (
                <g
                  key={device.name}
                  transform={`translate(${device.x},${device.y})`}
                  onMouseDown={(ev) => {
                    if (recorded.current || activeTool !== "select" || placingCable || placingModel) return;
                    const pt = clientToSvg(ev.clientX, ev.clientY);
                    setDragState({ name: device.name, offsetX: device.x - pt.x, offsetY: device.y - pt.y, moved: false });
                  }}
                  onClick={(ev) => {
                    if (dragState?.moved) return;
                    handleDeviceAction(ev, device);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {selectedDeviceName === device.name || pduSourcePick === device.name ? (
                    <circle
                      r={35}
                      fill="none"
                      stroke={pduSourcePick === device.name ? "#1e9e4a" : "#2563eb"}
                      strokeWidth={1.6}
                      strokeDasharray="4 3"
                    />
                  ) : null}
                  <PtCanvasDeviceArtwork type={device.type} />
                  <text
                    y={device.type === "router" ? 38 : 37}
                    textAnchor="middle"
                    fontSize={12.5}
                    fontWeight={600}
                    fill="#151e29"
                    stroke="#ffffff"
                    strokeWidth={4}
                    paintOrder="stroke"
                  >
                    {device.name}
                  </text>
                  {["pc", "laptop", "server"].includes(device.type) && device.ip ? (
                    <text y={50} textAnchor="middle" fontSize={10} fill="#475569" stroke="#ffffff" strokeWidth={3} paintOrder="stroke">
                      {device.ip}
                    </text>
                  ) : null}
                </g>
              ))}

              {/* Notes */}
              {(spec?.notes ?? []).map((n) => (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  onClick={(ev) => {
                    if (activeTool === "delete" && spec) {
                      ev.stopPropagation();
                      commitSpec({ ...spec, notes: (spec.notes ?? []).filter((x) => x.id !== n.id) });
                    }
                  }}
                >
                  <rect x={-4} y={-14} width={Math.max(80, n.text.length * 7 + 14)} height={22} rx={3} fill="#fef9c3" stroke="#ca8a04" strokeWidth={1} />
                  <text x={4} y={1} fontSize={11} fill="#713f12">
                    {n.text}
                  </text>
                </g>
              ))}

              {/* Active Envelopes */}
              {activeEnvelopes.map((env) => (
                <g key={env.key} transform={`translate(${env.x}, ${env.y})`}>
                  <PtPacketEnvelope color={env.color} label={env.type} />
                </g>
              ))}
            </svg>
          )}

          {/* Port Picker Popup Menu during Cable Connection */}
          {portPicker && (
            <div
              style={{
                position: "fixed",
                left: Math.min(portPicker.screenX + 8, 1280),
                top: Math.min(portPicker.screenY + 8, 620),
                background: "#ffffff",
                border: "1px solid #64748b",
                boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
                zIndex: 90,
                minWidth: 165,
                padding: "3px 0",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: "3px 10px", fontSize: 11, fontWeight: 700, background: "#eef2f6", borderBottom: "1px solid #cbd5e1" }}>
                {portPicker.device.name} Interfaces
              </div>
              {getDevicePorts(portPicker.device).map((p) => {
                const used = spec?.links.some(
                  (l) => (l.a === portPicker.device.name && l.ap === p) || (l.b === portPicker.device.name && l.bp === p),
                );
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={used}
                    onClick={() => handlePickPort(portPicker.device, p)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "4px 12px",
                      border: "none",
                      background: "transparent",
                      cursor: used ? "default" : "pointer",
                      color: used ? "#94a3b8" : "#0f172a",
                      fontSize: 11.5,
                    }}
                  >
                    {p} {used ? "(in use)" : ""}
                  </button>
                );
              })}
            </div>
          )}

          {/* Note Input Popup */}
          {noteDraft && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "35%",
                transform: "translate(-50%, -50%)",
                background: "#fffbeb",
                border: "1px solid #d97706",
                padding: 12,
                boxShadow: "0 6px 18px rgba(0,0,0,0.2)",
                zIndex: 25,
                display: "flex",
                gap: 6,
              }}
            >
              <input
                placeholder="Type note label..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && noteText.trim() && spec) {
                    const note: PtNote = { id: `note-${Date.now()}`, x: noteDraft.x, y: noteDraft.y, text: noteText.trim() };
                    commitSpec({ ...spec, notes: [...(spec.notes ?? []), note] });
                    setNoteDraft(null);
                    setActiveTool("select");
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  if (noteText.trim() && spec) {
                    const note: PtNote = { id: `note-${Date.now()}`, x: noteDraft.x, y: noteDraft.y, text: noteText.trim() };
                    commitSpec({ ...spec, notes: [...(spec.notes ?? []), note] });
                  }
                  setNoteDraft(null);
                  setActiveTool("select");
                }}
              >
                Place
              </button>
              <button type="button" onClick={() => setNoteDraft(null)}>
                Cancel
              </button>
            </div>
          )}

          {/* Complex PDU Dialog */}
          {complexPduOpen && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "40%",
                transform: "translate(-50%, -50%)",
                background: "#f1f4f8",
                border: "1px solid #495d75",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                width: 340,
                padding: 12,
                zIndex: 25,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Create Complex PDU</div>
              <div style={{ display: "grid", gap: 7, fontSize: 11.5 }}>
                <label style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Source Device:</span>
                  <select value={from} onChange={(e) => setFrom(e.target.value)}>
                    {pcs.map((p) => (
                      <option key={p.name}>{p.name}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Destination Device:</span>
                  <select value={to} onChange={(e) => setTo(e.target.value)}>
                    {pcs.map((p) => (
                      <option key={p.name}>{p.name}</option>
                    ))}
                  </select>
                </label>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const target = pcs.find((p) => p.name === to)?.ip || to;
                      if (from && target) {
                        setMode("free");
                        void runActions([...actions, { type: "ping", from, to: target }]);
                      }
                      setComplexPduOpen(false);
                    }}
                  >
                    Create PDU
                  </button>
                  <button type="button" onClick={() => setComplexPduOpen(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Routing Table Inspect + IOS CLI Dialog */}
          {routingWindow ? (
            <div className={styles.routerWin} role="dialog" aria-label={`${routingWindow.name} routing table`}>
              <div className={styles.routerWinBar}>
                <span>{routingWindow.name} — Inspect Routing Table</span>
                {!recorded.current ? (
                  <button
                    type="button"
                    onClick={() => setRouterView("")}
                    style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
                    aria-label="Close routing table"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
              <div className={styles.routerWinBody}>
                <div style={{ flex: 1.15, overflow: "auto", background: "#ffffff", border: "1px solid #aab3bf" }}>
                  <table className={styles.ptTable}>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Network</th>
                        <th>Port</th>
                        <th>Next Hop IP</th>
                        <th>Metric</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routingWindow.table.map((row) => (
                        <tr key={row.network}>
                          <td>{row.code}</td>
                          <td>{row.network}</td>
                          <td>{row.interface}</td>
                          <td>{row.next_hop || "—"}</td>
                          <td>
                            {row.distance}/{row.metric}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <pre className={styles.routerCliPre} aria-label="show ip route">
                  {`${routingWindow.name}#show ip route\n${routingWindow.lines.join("\n")}`}
                </pre>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Vertical Common Tools Strip */}
        <div className={styles.commonToolsRail} role="toolbar" aria-label="Common Tools">
          <button
            type="button"
            className={`${styles.railBtn} ${activeTool === "select" ? styles.railBtnActive : ""}`}
            title="Select (Esc)"
            onClick={() => {
              setActiveTool("select");
              setPlacingCable(null);
              setPlacingModel(null);
            }}
          >
            <PtSelectIcon />
          </button>
          <button
            type="button"
            className={`${styles.railBtn} ${activeTool === "inspect" ? styles.railBtnActive : ""}`}
            title="Inspect (I)"
            onClick={() => setActiveTool("inspect")}
          >
            <PtInspectIcon />
          </button>
          <button
            type="button"
            className={`${styles.railBtn} ${activeTool === "delete" ? styles.railBtnActive : ""}`}
            title="Delete (Del)"
            onClick={() => setActiveTool("delete")}
          >
            <PtDeleteIcon />
          </button>
          <button
            type="button"
            className={`${styles.railBtn} ${activeTool === "resize" ? styles.railBtnActive : ""}`}
            title="Resize Shape"
            onClick={() => setActiveTool("resize")}
          >
            <PtResizeIcon />
          </button>
          <button
            type="button"
            className={`${styles.railBtn} ${activeTool === "note" ? styles.railBtnActive : ""}`}
            title="Place Note (N)"
            onClick={() => setActiveTool("note")}
          >
            <PtNoteIcon />
          </button>
          <div className={styles.railSep} />
          <button
            type="button"
            className={`${styles.railBtn} ${activeTool === "simple-pdu" ? styles.railBtnActive : ""}`}
            title="Add Simple PDU (P)"
            onClick={() => {
              setActiveTool("simple-pdu");
              setPduSourcePick(null);
              setPlacingCable(null);
              setPlacingModel(null);
            }}
          >
            <PtSimplePduIcon />
          </button>
          <button
            type="button"
            className={`${styles.railBtn} ${activeTool === "complex-pdu" ? styles.railBtnActive : ""}`}
            title="Add Complex PDU (C)"
            onClick={() => {
              setActiveTool("complex-pdu");
              setComplexPduOpen(true);
            }}
          >
            <PtComplexPduIcon />
          </button>
        </div>

        {/* Docked Right Simulation Panel (Authentic PT 8.2 Layout) */}
        {simOpen ? (
          <aside className={styles.simPanel} aria-label="Simulation Panel">
            <div className={styles.simHeader}>
              <span>Simulation Panel</span>
              <span style={{ opacity: 0.75, fontSize: 11 }}>Event List</span>
            </div>
            <div className={styles.simBody}>
              {/* 1. Event List at Top */}
              <div className={styles.eventListWrap}>
                <div className={styles.eventListTitle}>Event List</div>
                <div className={styles.eventTableScroll} aria-label="Event List">
                  <table className={styles.ptTable}>
                    <thead>
                      <tr>
                        <th style={{ width: 26 }}>Vis.</th>
                        <th style={{ width: 50 }}>Time(sec)</th>
                        <th style={{ width: 60 }}>Last Device</th>
                        <th style={{ width: 60 }}>At Device</th>
                        <th style={{ width: 52 }}>Type</th>
                        <th>Info</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event, i) => {
                        const activeIdx = simCursor ?? (events.length ? events.length - 1 : -1);
                        const isActiveRow = i === activeIdx;
                        return (
                          <tr
                            key={i}
                            onClick={() => setSelectedEventModal(event)}
                            style={{
                              cursor: "pointer",
                              background: isActiveRow
                                ? "#FFFBD6"
                                : event.action === "discarded" || event.action === "dropped"
                                  ? "#fdf0f0"
                                  : "#FFFDF5",
                              fontWeight: isActiveRow ? 600 : 400,
                            }}
                          >
                            <td style={{ textAlign: "center" }}>{isActiveRow ? "👁" : ""}</td>
                            <td>{event.time.toFixed(3)}</td>
                            <td>{event.last || "—"}</td>
                            <td>{event.at}</td>
                            <td>
                              <span
                                className={styles.protoSq}
                                style={{ width: 11, height: 11, background: TYPE_COLOR[event.type] ?? "#777" }}
                              />
                              {event.type}
                            </td>
                            <td title={event.info}>
                              {event.info}
                              {event.action === "discarded" ? " — discarded" : event.action === "dropped" ? " — dropped" : ""}
                            </td>
                          </tr>
                        );
                      })}
                      {!events.length ? (
                        <tr>
                          <td colSpan={6} style={{ color: "#64748b", padding: 8 }}>
                            No events captured yet. Send a Simple PDU to observe traffic.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Reset Simulation + Constant Delay Row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "2px 2px" }}>
                <button
                  type="button"
                  className={styles.ptControlBtn}
                  style={{ height: 22, padding: "0 10px" }}
                  onClick={() => {
                    setPlayingSim(false);
                    setSimCursor(null);
                    setLocalEvents([]);
                    setLocalPdus([]);
                  }}
                >
                  Reset Simulation
                </button>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#1e293b", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={constantDelay}
                    onChange={(e) => setConstantDelay(e.target.checked)}
                  />
                  <span>Constant Delay</span>
                </label>
              </div>

              {/* 3. Play Controls + Speed Slider */}
              <div className={styles.groupBox}>
                <div className={styles.groupTitle}>Play Controls</div>
                <div className={styles.playBtns}>
                  <button
                    type="button"
                    className={styles.ptControlBtn}
                    title="Back"
                    onClick={() => {
                      if (simCursor !== null && simCursor > 0) setSimCursor(simCursor - 1);
                      else if (mode === "guided" && index > 0) {
                        setIndex(index - 1);
                        setFrame(frames[index - 1]);
                      }
                    }}
                  >
                    |&lt; Back
                  </button>
                  <button
                    type="button"
                    className={styles.ptControlBtn}
                    title="Auto Capture / Play"
                    onClick={() => setPlayingSim((p) => !p)}
                  >
                    {playingSim ? "❚❚ Pause" : "▶ Play"}
                  </button>
                  <button
                    type="button"
                    className={styles.ptControlBtn}
                    title="Capture / Forward"
                    onClick={() => {
                      if (events.length && (simCursor === null || simCursor < events.length - 1)) {
                        setSimCursor((c) => (c === null ? 0 : c + 1));
                      } else if (mode === "guided" && index < frames.length - 1) {
                        setSimCursor(null);
                        setIndex(index + 1);
                        setFrame(frames[index + 1]);
                      }
                    }}
                  >
                    Forward &gt;|
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 10.5, color: "#475569" }}>
                  <span>Slow</span>
                  <input
                    type="range"
                    aria-label="Simulation speed"
                    min={200}
                    max={1400}
                    step={50}
                    value={1600 - simSpeedMs}
                    onChange={(e) => setSimSpeedMs(1600 - Number(e.target.value))}
                    style={{ flex: 1, height: 14, cursor: "pointer" }}
                  />
                  <span>Fast</span>
                </div>
              </div>

              {/* 4. Event List Filters — Visible Events */}
              <div className={styles.groupBox}>
                <div className={styles.groupTitle}>Event List Filters — Visible Events</div>
                <div className={styles.filterRow}>
                  <div className={styles.filterChips}>
                    {["ARP", "ICMP", "RIP"].map((type) => (
                      <span key={type}>
                        <span className={styles.protoSq} style={{ background: typesShown.has(type) ? TYPE_COLOR[type] : "#cbd5e1" }} />
                        {type}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      type="button"
                      className={styles.ptControlBtn}
                      style={{ height: 22, padding: "0 7px" }}
                      onClick={() =>
                        setSimFilterSet((prev) =>
                          prev.size >= 5 ? new Set() : new Set(["ARP", "ICMP", "RIP", "DNS", "HTTP"]),
                        )
                      }
                    >
                      Show All/None
                    </button>
                    <button
                      type="button"
                      className={styles.ptControlBtn}
                      style={{ height: 22, padding: "0 7px" }}
                      onClick={() => setShowFiltersDialog((v) => !v)}
                    >
                      Edit Filters
                    </button>
                  </div>
                </div>
                {showFiltersDialog && (
                  <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #cbd5e1", display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11 }}>
                    {["ARP", "ICMP", "RIP", "DNS", "HTTP"].map((proto) => (
                      <label key={proto}>
                        <input
                          type="checkbox"
                          checked={simFilterSet.has(proto)}
                          onChange={(e) => {
                            const next = new Set(simFilterSet);
                            if (e.target.checked) next.add(proto);
                            else next.delete(proto);
                            setSimFilterSet(next);
                          }}
                        />{" "}
                        {proto}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      {/* =================================================================
       * Cisco #049FD9 Control Strip (Time / Power Cycle / Realtime | Sim)
       * ================================================================= */}
      <div className={styles.ptModeStrip}>
        <div className={styles.ptStripLeft}>
          <PtRealtimeIcon />
          <span className={styles.stripClock}>Time: {simElapsed}</span>
          <button
            type="button"
            className={styles.stripCircleBtn}
            onClick={() => setSimElapsed("00:00:00")}
            title="Power Cycle Devices"
          >
            <PtPowerCycleIcon size={12} />
            <span>Power Cycle Devices</span>
          </button>
          <button
            type="button"
            className={styles.stripCircleBtn}
            onClick={() => setSimElapsed("00:01:30")}
            title="Fast Forward Time"
          >
            <PtFastForwardIcon size={12} />
            <span>Fast Forward Time</span>
          </button>
        </div>

        <div className={styles.modeSwitchWrap} aria-label="Mode">
          <button
            type="button"
            className={`${styles.modeBtn} ${!simOpen ? styles.modeBtnActive : ""}`}
            onClick={() => {
              if (mode === "guided" && frames.length) {
                setIndex(0);
                setFrame(frames[0]);
              }
            }}
          >
            <PtRealtimeIcon />
            <span>Realtime</span>
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${simOpen ? styles.modeBtnActive : ""}`}
            onClick={() => {
              if (mode === "guided" && frames.length > 1 && view?.view !== "simulation") {
                const simIdx = frames.findIndex((f) => f.view === "simulation");
                if (simIdx >= 0) {
                  setIndex(simIdx);
                  setFrame(frames[simIdx]);
                }
              }
            }}
          >
            <PtSimulationIcon />
            <span>Simulation</span>
          </button>
        </div>
      </div>

      {/* =================================================================
       * Bottom Dock: Device-Type Selection Panel + Scenario 0 PDU
       * ================================================================= */}
      <div className={styles.bottomDock}>
        <div className={styles.deviceBox}>
          <div className={styles.catCols}>
            <div>
              <div className={styles.catTitleStrip} style={{ marginBottom: 4 }}>
                {masterCat === "network"
                  ? `[Network Devices — ${netSubCat[0].toUpperCase()}${netSubCat.slice(1)}]`
                  : masterCat === "end"
                    ? "[End Devices]"
                    : masterCat === "connections"
                      ? "[Connections]"
                      : masterCat === "misc"
                        ? "[Miscellaneous]"
                        : masterCat === "multiuser"
                          ? "[Multiuser]"
                          : "[Components]"}
              </div>
              <div className={styles.catRow}>
                <button
                  type="button"
                  className={`${styles.catBtn} ${masterCat === "network" ? styles.catBtnActive : ""}`}
                  title="Networking Devices"
                  onClick={() => setMasterCat("network")}
                >
                  <PtCatNetworkIcon />
                </button>
                <button
                  type="button"
                  className={`${styles.catBtn} ${masterCat === "end" ? styles.catBtnActive : ""}`}
                  title="End Devices"
                  onClick={() => setMasterCat("end")}
                >
                  <PtCatEndDevicesIcon />
                </button>
                <button
                  type="button"
                  className={`${styles.catBtn} ${masterCat === "components" ? styles.catBtnActive : ""}`}
                  title="Components"
                  onClick={() => setMasterCat("components")}
                >
                  <PtCatComponentsIcon />
                </button>
                <button
                  type="button"
                  className={`${styles.catBtn} ${masterCat === "connections" ? styles.catBtnActive : ""}`}
                  title="Connections"
                  onClick={() => setMasterCat("connections")}
                >
                  <PtCatConnectionsIcon />
                </button>
                <button
                  type="button"
                  className={`${styles.catBtn} ${masterCat === "misc" ? styles.catBtnActive : ""}`}
                  title="Miscellaneous"
                  onClick={() => setMasterCat("misc")}
                >
                  <PtCatMiscIcon />
                </button>
                <button
                  type="button"
                  className={`${styles.catBtn} ${masterCat === "multiuser" ? styles.catBtnActive : ""}`}
                  title="Multiuser"
                  onClick={() => setMasterCat("multiuser")}
                >
                  <PtCatMultiuserIcon />
                </button>
              </div>
            </div>

            {masterCat === "network" ? (
              <div className={styles.subCatRow}>
                {(
                  [
                    ["routers", "Routers"],
                    ["switches", "Switches"],
                    ["hubs", "Hubs"],
                    ["wireless", "Wireless"],
                    ["security", "Security"],
                    ["wan", "WAN Emulation"],
                  ] as const
                ).map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    title={lbl}
                    className={`${styles.subBtn} ${netSubCat === k ? styles.subBtnActive : ""}`}
                    onClick={() => setNetSubCat(k)}
                  >
                    <PtSubCatIcon kind={k} />
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.subCatRow}>
                <button
                  type="button"
                  title={masterCat === "connections" ? "Cables" : masterCat === "end" ? "End Devices" : "Items"}
                  className={`${styles.subBtn} ${styles.subBtnActive}`}
                >
                  {masterCat === "connections" ? <PtCatConnectionsIcon /> : <PtCatEndDevicesIcon />}
                </button>
              </div>
            )}
          </div>

          <div className={styles.modelShelf}>
            {shelfModels.map((item) => {
              if (item.kind === "cable") {
                const active = placingCable === item.cable;
                return (
                  <button
                    key={item.cable}
                    type="button"
                    className={styles.modelCard}
                    style={{ borderColor: active ? "#2563eb" : undefined, background: active ? "#dbeafe" : undefined, cursor: "pointer" }}
                    title={item.label}
                    onClick={() => {
                      setPlacingCable(item.cable);
                      setPlacingModel(null);
                      setCableStart(null);
                      setActiveTool("select");
                    }}
                  >
                    <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                      <PtCableShelfIcon kind={item.cable} />
                    </div>
                    <span className={styles.modelLabel}>{item.label.replace("Automatically Choose Connection Type", "Auto").replace("Copper Straight-Through", "Straight").replace("Copper Cross-Over", "Cross-Over")}</span>
                  </button>
                );
              }
              const active = placingModel?.model === item.meta.model;
              return (
                <button
                  key={item.meta.model}
                  type="button"
                  className={styles.modelCard}
                  style={{ borderColor: active ? "#2563eb" : undefined, background: active ? "#dbeafe" : undefined, cursor: "pointer" }}
                  title={`Click then click canvas to place ${item.meta.model}`}
                  onClick={() => {
                    setPlacingModel(item.meta);
                    setPlacingCable(null);
                    setCableStart(null);
                  }}
                >
                  <svg width="56" height="54" viewBox="-34 -28 68 56" aria-hidden="true">
                    <PtCanvasDeviceArtwork type={item.meta.kind} compact={item.meta.kind === "pc" || item.meta.kind === "server"} />
                  </svg>
                  <span className={styles.modelLabel}>{item.meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.pduDock}>
          <div className={styles.pduBar}>
            <span>Scenario 0 — PDU List Window</span>
            <span style={{ fontWeight: 400, fontSize: 11, color: "#475569" }}>
              {view?.mac_table ? `Switch MAC: ${view.mac_table}` : `${(view?.pdus ?? []).length} PDUs`}
            </span>
          </div>
          <div className={styles.pduScroll} aria-label="PDU List">
            <table className={styles.ptTable}>
              <thead>
                <tr>
                  <th>Fire</th>
                  <th>Last Status</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Type</th>
                  <th>Color</th>
                  <th>Num</th>
                </tr>
              </thead>
              <tbody>
                {(view?.pdus ?? []).map((pdu) => (
                  <tr key={pdu.pdu}>
                    <td>●</td>
                    <td style={{ color: pdu.status === "Successful" ? "#0b7a2a" : "#b00020", fontWeight: 600 }}>{pdu.status}</td>
                    <td>{pdu.source}</td>
                    <td>{pdu.destination}</td>
                    <td>ICMP</td>
                    <td>
                      <span className={styles.protoSq} style={{ background: "#1e9e4a" }} />
                    </td>
                    <td>{pdu.pdu}</td>
                  </tr>
                ))}
                {!(view?.pdus ?? []).length ? (
                  <tr>
                    <td colSpan={7} style={{ color: "#64748b", padding: 8 }}>
                      No User Created PDUs. Use Add Simple PDU or select a simulation step.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Interactive Device Configuration Window */}
      {activeDeviceObj && spec && (
        <PtDeviceModal
          spec={spec}
          device={activeDeviceObj}
          onUpdateDevice={(updated) => {
            setSpec({
              ...spec,
              devices: spec.devices.map((d) => (d.name === activeDeviceObj.name ? updated : d)),
              links: spec.links.map((l) => ({
                ...l,
                a: l.a === activeDeviceObj.name ? updated.name : l.a,
                b: l.b === activeDeviceObj.name ? updated.name : l.b,
              })),
            });
            if (openDeviceModal === activeDeviceObj.name) setOpenDeviceModal(updated.name);
          }}
          onClose={() => setOpenDeviceModal(null)}
        />
      )}

      {/* PDU Information Modal (OSI Model + Inbound/Outbound) */}
      {selectedEventModal && spec && (
        <PtPduModal spec={spec} event={selectedEventModal} onClose={() => setSelectedEventModal(null)} />
      )}

      {!recorded.current && view?.explain ? <div className={styles.explainBar}>{view.explain}</div> : null}
      {!recorded.current && mode === "guided" && observations.length && index === frames.length - 1 ? (
        <div className={styles.explainBar}>{observations.join(" ")}</div>
      ) : null}
    </div>
  );
}
