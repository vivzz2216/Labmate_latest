"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { readTopologyFile } from "@/lib/netlab/ptProjectFile";
import {
  CABLE_LIBRARY,
  DEVICE_CATALOG,
  defaultServerServices,
  formatShowIpRoute,
  getDevicePorts,
  isLinkUp,
  maskToCidr,
  resolveAutoCable,
  simulateLocalPing,
  syntheticMac,
} from "@/lib/netlab/ptEngine";
import { getPresetSpec, PT_PRESETS } from "@/lib/netlab/ptPresets";
import { adaptPracticalFrame } from "@/lib/netlab/ptPracticalAdapter";
import { buildNetworkPractical, type PracticalFrame } from "@/lib/netlab/networkPracticals";
import type {
  CableType,
  DeviceModelMeta,
  PtCable,
  PtDevice,
  PtEvent,
  PtNote,
  PtPduRow,
  PtPreferences,
  PtRouteRow,
  PtShape,
  PtSpec,
} from "@/lib/netlab/ptTypes";
import { PtDeviceModal, type ModalTab } from "./PtDeviceModal";
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
  PtCustomDeviceIcon,
  PtDeleteIcon,
  PtDrawEllipseIcon,
  PtDrawLineIcon,
  PtDrawRectIcon,
  PtDrawingPaletteIcon,
  PtEyeIcon,
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
  PtViewportIcon,
  PtZoomInIcon,
  PtZoomOutIcon,
  PtZoomResetIcon,
  serialZigzagPath,
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

const TYPE_COLOR: Record<string, string> = { ARP: "#e8890c", ICMP: "#1e9e4a", RIP: "#7c4dbb", DNS: "#2563eb", HTTP: "#d97706", DHCP: "#0284c7" };
const LIKE = new Set(["pc", "laptop", "server", "printer", "ipphone", "tablet", "smartphone", "router", "security"]);
const MENU_ITEMS = ["File", "Edit", "Options", "View", "Tools", "Extensions", "Window", "Help"];

type MasterCat = "network" | "end" | "components" | "connections" | "misc" | "multiuser";
type NetSubCat = "routers" | "switches" | "hubs" | "wireless" | "security" | "wan";
type CanvasTool =
  | "select"
  | "inspect"
  | "delete"
  | "resize"
  | "note"
  | "draw-line"
  | "draw-rect"
  | "draw-ellipse"
  | "simple-pdu"
  | "complex-pdu";

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600) % 100).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function isPracticalFrame(step: unknown): step is PracticalFrame {
  return Boolean(step && typeof step === "object" && "project" in step);
}

export function PacketTracerStudio({ capturePractical = false }: { capturePractical?: boolean }) {
  const [spec, setSpec] = useState<PtSpec | null>(() => getPresetSpec("switched-lan"));
  const [undoStack, setUndoStack] = useState<PtSpec[]>([]);
  const [redoStack, setRedoStack] = useState<PtSpec[]>([]);
  const [name, setName] = useState("Switched LAN");
  const [selectedPresetId, setSelectedPresetId] = useState("switched-lan");
  const [frame, setFrame] = useState<Frame | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [index, setIndex] = useState(0);
  const [experiments, setExperiments] = useState<{ id: string; title: string }[]>([]);
  const [experiment, setExperiment] = useState("");
  const [mode, setMode] = useState<"guided" | "free">("free");
  const [actions, setActions] = useState<Record<string, unknown>[]>([]);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [routerView, setRouterView] = useState("");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  // Authentic PT 8.2.2 Workspace & Interaction State
  const [wsTab, setWsTab] = useState<"logical" | "physical">("logical");
  const [masterCat, setMasterCat] = useState<MasterCat>("network");
  const [netSubCat, setNetSubCat] = useState<NetSubCat>("routers");
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [placingModel, setPlacingModel] = useState<DeviceModelMeta | null>(null);
  const [placingCable, setPlacingCable] = useState<CableType | null>(null);
  const [cableStart, setCableStart] = useState<{ device: PtDevice; port: string } | null>(null);
  const [portPicker, setPortPicker] = useState<{ device: PtDevice; screenX: number; screenY: number } | null>(null);
  const [mouseSvg, setMouseSvg] = useState<{ x: number; y: number }>({ x: 480, y: 280 });
  const [dragState, setDragState] = useState<{ name: string; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const [hoveredDevice, setHoveredDevice] = useState<{ device: PtDevice; screenX: number; screenY: number } | null>(null);
  const [hoveredShelfLabel, setHoveredShelfLabel] = useState<string | null>(null);
  const [pduSourcePick, setPduSourcePick] = useState<string | null>(null);
  const [localEvents, setLocalEvents] = useState<PtEvent[]>([]);
  const [localPdus, setLocalPdus] = useState<PtPduRow[]>([]);
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [scenarios, setScenarios] = useState<string[]>(["Scenario 0"]);
  const [pduCollapsed, setPduCollapsed] = useState(false);
  const [simFilterSet, setSimFilterSet] = useState<Set<string>>(() => new Set(["ARP", "ICMP", "RIP", "DNS", "HTTP", "DHCP"]));
  const [playingSim, setPlayingSim] = useState(false);
  const [freeSimOpen, setFreeSimOpen] = useState(false);
  const [simCursor, setSimCursor] = useState<number | null>(null);
  const [simSpeedMs, setSimSpeedMs] = useState(650);
  const [constantDelay, setConstantDelay] = useState(true);
  const [selectedEventModal, setSelectedEventModal] = useState<PtEvent | null>(null);
  const [openDeviceModal, setOpenDeviceModal] = useState<string | null>(null);
  const [modalInit, setModalInit] = useState<{ tab?: ModalTab; section?: string; desktopApp?: "grid" | "ipconfig" | "cmd" | "terminal" | "browser" | "wireless" }>({});
  const [copiedDevice, setCopiedDevice] = useState<PtDevice | null>(null);
  const [selectedDeviceName, setSelectedDeviceName] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showFiltersDialog, setShowFiltersDialog] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(5);
  const [converging, setConverging] = useState(false);
  const [canvasBg, setCanvasBg] = useState<string>("#ffffff");
  const [noteDraft, setNoteDraft] = useState<{ x: number; y: number } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [complexPduOpen, setComplexPduOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState<"about" | "shortcuts" | null>(null);
  const [prefs, setPrefs] = useState<PtPreferences>({
    showPortLabels: true,
    showModelLabels: true,
    showNameLabels: true,
    showIpLabels: false,
    showGrid: false,
    showLinkLights: true,
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const projectFileRef = useRef<HTMLInputElement>(null);
  const recorded = useRef(false);

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

  useStudioHook<Frozen, Frame | PracticalFrame>(
    {
      load: (state) => {
        recorded.current = true;
        setSpec(state.spec);
        setName(state.name);
        setMode("guided");
        setTick((n) => n + 1);
      },
      show: (next) => {
        if (isPracticalFrame(next)) {
          recorded.current = true;
          const adapted = adaptPracticalFrame(next);
          setSpec(adapted.spec);
          setName(adapted.spec.name);
          setLocalEvents(adapted.events);
          setLocalPdus(adapted.pdus);
          setReplay(null);
          setActions([]);
          setMode("free");
          setFreeSimOpen(adapted.events.length > 0);
          setSimCursor(adapted.events.length > 0 ? adapted.events.length - 1 : null);
          if (adapted.openDeviceName) {
            const devObj = adapted.spec.devices.find((d) => d.name === adapted.openDeviceName);
            if (devObj?.type === "server" && adapted.openSettings) {
              setModalInit({ tab: "Services" });
            } else if ((devObj?.type === "laptop" || devObj?.type === "tablet" || devObj?.type === "smartphone") && adapted.openSettings) {
              setModalInit({ tab: "Desktop", desktopApp: "wireless" });
            } else {
              const sec = adapted.openPort
                ? `iface:${adapted.openPort}`
                : devObj?.type === "router" && adapted.openSettings
                  ? "Static"
                  : "Settings";
              setModalInit({ tab: "Config", section: sec });
            }
            setOpenDeviceModal(adapted.openDeviceName);
          } else {
            setOpenDeviceModal(null);
          }
          setTick((n) => n + 1);
          return;
        }
        setOpenDeviceModal(null);
        setSimCursor(null);
        setFrame(next);
        setMode("guided");
        setTick((n) => n + 1);
      },
    },
    `${tick}:${frame?.id}:${openDeviceModal ?? ""}:${modalInit.tab ?? ""}:${modalInit.section ?? ""}:${modalInit.desktopApp ?? ""}`,
  );

  // Register headless capture helper when opened with ?capture=practical
  useEffect(() => {
    if (!capturePractical) return;
    window.__labmatePractical = buildNetworkPractical;
    return () => {
      delete window.__labmatePractical;
    };
  }, [capturePractical]);

  // Close menus on outside click
  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [openMenu]);

  // Silently probe optional backend guided experiments without showing scary errors if offline
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (capturePractical || params.get("capture")) return;
    api
      .get("/api/netlab/packettracer/experiments")
      .then((response) => {
        if (Array.isArray(response.data)) setExperiments(response.data);
      })
      .catch(() => {
        // Built-in PT_PRESETS work offline cleanly
      });
  }, [capturePractical]);

  const loadPresetTopology = useCallback((presetId: string) => {
    const built = getPresetSpec(presetId);
    setSelectedPresetId(presetId);
    setExperiment("");
    setSpec(built);
    setUndoStack([]);
    setRedoStack([]);
    setName(built.name);
    setFrames([]);
    setFrame(null);
    setIndex(0);
    setActions([]);
    setReplay(null);
    setLocalEvents([]);
    setLocalPdus([]);
    setSimCursor(null);
    setPlayingSim(false);
    setFreeSimOpen(false);
    setRouterView("");
    setOpenDeviceModal(null);
    setPduSourcePick(null);
    setCableStart(null);
    setPlacingCable(null);
    setPlacingModel(null);
    setError("");
    setMode("free");
  }, []);

  const loadGuidedExperiment = useCallback((expId: string) => {
    setExperiment(expId);
    setSelectedPresetId("");
    api
      .get(`/api/netlab/packettracer/run/${expId}`)
      .then((response) => {
        const run: RunResult = response.data;
        setSpec(run.spec);
        setUndoStack([]);
        setRedoStack([]);
        setName(run.title);
        setFrames(run.frames);
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
        setError("");
      })
      .catch(() => {
        setError("Could not load backend experiment; switched to local Switched LAN.");
        loadPresetTopology("switched-lan");
      });
  }, [loadPresetTopology]);

  const runActions = useCallback(
    async (next: Record<string, unknown>[], fallbackLocal = true) => {
      if (!spec) return;
      const lastAct = next[next.length - 1];
      if (fallbackLocal && lastAct?.type === "ping") {
        const sim = simulateLocalPing(spec, String(lastAct.from), String(lastAct.to), localPdus.length + 1);
        setLocalEvents((prev) => [...prev, ...sim.events]);
        setLocalPdus((prev) => [
          ...prev,
          {
            pdu: prev.length + 1,
            source: String(lastAct.from),
            destination: sim.targetName !== "?" ? sim.targetName : String(lastAct.to),
            status: sim.success ? "Successful" : "Failed",
            type: "ICMP",
          },
        ]);
        if (sim.events.length > 0) setSimCursor(0);
        setError(sim.error ?? "");
        return;
      }
      try {
        const response = await api.post("/api/netlab/packettracer/replay", { spec, actions: next });
        setReplay(response.data);
        setActions(next);
        setError("");
      } catch {
        if (lastAct?.type === "ping") {
          const sim = simulateLocalPing(spec, String(lastAct.from), String(lastAct.to), localPdus.length + 1);
          setLocalEvents((prev) => [...prev, ...sim.events]);
          setLocalPdus((prev) => [
            ...prev,
            {
              pdu: prev.length + 1,
              source: String(lastAct.from),
              destination: sim.targetName !== "?" ? sim.targetName : String(lastAct.to),
              status: sim.success ? "Successful" : "Failed",
              type: "ICMP",
            },
          ]);
          setSimCursor(0);
          setError(sim.error ?? "");
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
          title: name || "Topology Workspace",
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
        title: name || "Topology Workspace",
        view: "simulation",
        explain: "Place devices, wire ports with cables, configure IP/CLI, or send Simple PDUs.",
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
  }, [mode, replay, frame, localEvents, localPdus, simFilterSet, spec, name]);

  const simOpen = mode === "free" ? freeSimOpen : view?.view === "simulation";

  // Live Realtime elapsed clock (pauses cleanly in Simulation mode or static capture)
  useEffect(() => {
    if (simOpen || recorded.current) return;
    const id = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [simOpen]);

  const viewBoxObj = useMemo(() => {
    const devices = spec?.devices ?? [];
    if (!devices.length) return { minX: 0, minY: 0, w: 960 / zoomScale, h: 540 / zoomScale };
    const xs = devices.map((d) => d.x);
    const ys = devices.map((d) => d.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const rawW = Math.max(820, Math.max(...xs) - Math.min(...xs) + 280);
    const rawH = Math.max(480, Math.max(...ys) - Math.min(...ys) + 210);
    const w = rawW / zoomScale;
    const h = rawH / zoomScale;
    return { minX: cx - w / 2, minY: cy - h / 2, w, h };
  }, [spec, zoomScale]);
  const viewBox = `${viewBoxObj.minX} ${viewBoxObj.minY} ${viewBoxObj.w} ${viewBoxObj.h}`;

  const clientToSvg = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 480, y: 270 };
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
    if (converging) return "#f2a900";
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

  // Auto-Capture / Play animation timer in Simulation Panel
  useEffect(() => {
    if (!playingSim || !events.length) return;
    const id = window.setInterval(() => {
      setSimCursor((prev) => {
        const next = prev === null ? 0 : prev + 1;
        if (next >= events.length) {
          setPlayingSim(false);
          return events.length - 1;
        }
        return next;
      });
    }, simSpeedMs);
    return () => window.clearInterval(id);
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

  const placeModelAt = useCallback(
    (modelMeta: DeviceModelMeta, pt: { x: number; y: number }) => {
      if (!spec || recorded.current) return;
      const base =
        modelMeta.kind === "pc"
          ? "PC"
          : modelMeta.kind === "router"
            ? "Router"
            : modelMeta.kind === "switch"
              ? "Switch"
              : modelMeta.kind === "hub"
                ? "Hub"
                : modelMeta.kind === "server"
                  ? "Server"
                  : modelMeta.kind === "laptop"
                    ? "Laptop"
                    : modelMeta.kind === "wireless"
                      ? "WirelessRouter"
                      : modelMeta.label.replace(/[^A-Za-z]/g, "") || "Device";
      let n = 0;
      while (spec.devices.some((d) => d.name === `${base}${n}`)) n++;
      const newDev: PtDevice = {
        type: modelMeta.kind,
        model: modelMeta.model,
        name: `${base}${n}`,
        hostname: `${base}${n}`,
        x: pt.x,
        y: pt.y,
        power: true,
        ssid: modelMeta.kind === "wireless" || modelMeta.kind === "laptop" ? "LabMate Wi-Fi" : undefined,
        vlans: modelMeta.kind === "switch" ? [] : undefined,
        interfaces: Object.fromEntries(
          modelMeta.defaultPorts
            .filter((p) => p !== "Console" && p !== "RS 232")
            .map((p) => [p, { ip: "", mask: "255.255.255.0", shutdown: modelMeta.kind === "router", vlan: 1 }]),
        ),
        services: modelMeta.kind === "server" ? defaultServerServices() : undefined,
      };
      commitSpec({ ...spec, devices: [...spec.devices, newDev] });
      setPlacingModel(null);
      setMode("free");
    },
    [spec, commitSpec],
  );

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    setPortPicker(null);
    if (!spec || recorded.current) return;
    const pt = clientToSvg(e.clientX, e.clientY);

    if (placingModel) {
      placeModelAt(placingModel, pt);
      return;
    }

    if (activeTool === "note") {
      setNoteDraft(pt);
      setNoteText("");
      return;
    }

    if (activeTool === "draw-rect" || activeTool === "draw-ellipse" || activeTool === "draw-line") {
      const kind = activeTool === "draw-line" ? "line" : activeTool === "draw-ellipse" ? "ellipse" : "rect";
      const shape: PtShape = {
        id: `shape-${Date.now()}`,
        kind,
        x: pt.x - 85,
        y: pt.y - 55,
        w: 170,
        h: 110,
        fill: kind === "ellipse" ? "rgba(254, 243, 199, 0.45)" : "rgba(191, 219, 254, 0.35)",
        stroke: kind === "ellipse" ? "#d97706" : kind === "line" ? "#334155" : "#2563eb",
      };
      commitSpec({ ...spec, shapes: [...(spec.shapes ?? []), shape] });
      setActiveTool("select");
      return;
    }

    setSelectedDeviceName(null);
  };

  const handleDeviceAction = (e: React.MouseEvent, device: PtDevice) => {
    e.stopPropagation();
    if (recorded.current) {
      if (device.type === "router") setRouterView(device.name);
      return;
    }
    setSelectedDeviceName(device.name);
    setHoveredDevice(null);

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
        const target = device.ip || Object.values(device.interfaces ?? {}).find((c) => Boolean(c.ip))?.ip || device.name;
        setMode("free");
        void runActions([...actions, { type: "ping", from: pduSourcePick, to: target }]);
        setPduSourcePick(null);
        setActiveTool("select");
      }
      return;
    }

    if (activeTool === "inspect") {
      if (device.type === "router") setRouterView(device.name);
      else {
        setModalInit({});
        setOpenDeviceModal(device.name);
      }
      return;
    }

    setModalInit({});
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
      void runActions([...actions, { type: "link", a: cable.a, b: cable.b, up }], false);
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

  const undo = useCallback(() => {
    if (!undoStack.length || !spec) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, spec]);
    setUndoStack((u) => u.slice(0, -1));
    setSpec(prev);
  }, [undoStack, spec]);

  const redo = useCallback(() => {
    if (!redoStack.length || !spec) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, spec]);
    setRedoStack((r) => r.slice(0, -1));
    setSpec(next);
  }, [redoStack, spec]);

  const saveJson = useCallback(() => {
    if (!spec) return;
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `${(name || "topology").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [spec, name]);

  // Global Keyboard Shortcuts (Esc, Del, Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+V, I, N, P, C)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        setOpenMenu(null);
        setPortPicker(null);
        setPrefsOpen(false);
        setHelpOpen(null);
        setComplexPduOpen(false);
        setPlacingCable(null);
        setPlacingModel(null);
        setCableStart(null);
        setPduSourcePick(null);
        setActiveTool("select");
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedDeviceName && spec && !openDeviceModal) {
        e.preventDefault();
        commitSpec({
          ...spec,
          devices: spec.devices.filter((d) => d.name !== selectedDeviceName),
          links: spec.links.filter((l) => l.a !== selectedDeviceName && l.b !== selectedDeviceName),
        });
        setSelectedDeviceName(null);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && selectedDeviceName) {
        const dev = spec?.devices.find((d) => d.name === selectedDeviceName);
        if (dev) setCopiedDevice(dev);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && copiedDevice && spec) {
        const copyName = `${copiedDevice.name}_copy`;
        commitSpec({
          ...spec,
          devices: [...spec.devices, { ...copiedDevice, name: copyName, x: copiedDevice.x + 60, y: copiedDevice.y + 45 }],
        });
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || openDeviceModal) return;

      const k = e.key.toLowerCase();
      if (k === "i") setActiveTool("inspect");
      else if (k === "n") setActiveTool("note");
      else if (k === "p") {
        setActiveTool("simple-pdu");
        setPduSourcePick(null);
        setPlacingCable(null);
        setPlacingModel(null);
      } else if (k === "c") {
        setActiveTool("complex-pdu");
        setComplexPduOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedDeviceName, spec, openDeviceModal, copiedDevice, commitSpec, undo, redo]);

  const triggerPowerCycle = () => {
    setElapsedSeconds(0);
    setConverging(true);
    window.setTimeout(() => setConverging(false), 1400);
  };

  const getMenuEntries = (item: string): Array<{ divider: true } | { label: string; shortcut?: string; action: () => void; disabled?: boolean }> => {
    if (item === "File")
      return [
        { label: "New", shortcut: "Ctrl+N", action: () => loadPresetTopology("blank") },
        { label: "Open…", shortcut: "Ctrl+O", action: () => projectFileRef.current?.click() },
        { label: "Save", shortcut: "Ctrl+S", disabled: !spec, action: saveJson },
        { label: "Reset to Switched LAN", action: () => loadPresetTopology("switched-lan") },
        { divider: true },
        { label: "Print…", shortcut: "Ctrl+P", action: () => window.print() },
      ];
    if (item === "Edit")
      return [
        { label: "Undo", shortcut: "Ctrl+Z", disabled: !undoStack.length, action: undo },
        { label: "Redo", shortcut: "Ctrl+Y", disabled: !redoStack.length, action: redo },
        { divider: true },
        {
          label: "Copy",
          shortcut: "Ctrl+C",
          disabled: !selectedDeviceName,
          action: () => {
            const dev = spec?.devices.find((d) => d.name === selectedDeviceName);
            if (dev) setCopiedDevice(dev);
          },
        },
        {
          label: "Paste",
          shortcut: "Ctrl+V",
          disabled: !copiedDevice || !spec,
          action: () => {
            if (!copiedDevice || !spec) return;
            const copyName = `${copiedDevice.name}_copy`;
            commitSpec({ ...spec, devices: [...spec.devices, { ...copiedDevice, name: copyName, x: copiedDevice.x + 60, y: copiedDevice.y + 45 }] });
          },
        },
        {
          label: "Delete Selected Device",
          shortcut: "Del",
          disabled: !selectedDeviceName || !spec,
          action: () => {
            if (!selectedDeviceName || !spec) return;
            commitSpec({
              ...spec,
              devices: spec.devices.filter((d) => d.name !== selectedDeviceName),
              links: spec.links.filter((l) => l.a !== selectedDeviceName && l.b !== selectedDeviceName),
            });
            setSelectedDeviceName(null);
          },
        },
      ];
    if (item === "Options")
      return [
        { label: "Preferences…", shortcut: "Ctrl+R", action: () => setPrefsOpen(true) },
        { divider: true },
        { label: `${prefs.showPortLabels ? "✓ " : ""}Show Port Labels Always`, action: () => setPrefs((p) => ({ ...p, showPortLabels: !p.showPortLabels })) },
        { label: `${prefs.showModelLabels ? "✓ " : ""}Show Device Model Labels`, action: () => setPrefs((p) => ({ ...p, showModelLabels: !p.showModelLabels })) },
        { label: `${prefs.showIpLabels ? "✓ " : ""}Show IP Labels on Canvas`, action: () => setPrefs((p) => ({ ...p, showIpLabels: !p.showIpLabels })) },
        { label: `${prefs.showGrid ? "✓ " : ""}Show Workspace Grid`, action: () => setPrefs((p) => ({ ...p, showGrid: !p.showGrid })) },
      ];
    if (item === "View")
      return [
        { label: "Logical Workspace", shortcut: "Shift+L", action: () => setWsTab("logical") },
        { label: "Physical Workspace", shortcut: "Shift+P", action: () => setWsTab("physical") },
        { divider: true },
        { label: "Realtime Mode", shortcut: "Shift+R", action: () => { setMode("free"); setFreeSimOpen(false); setPlayingSim(false); } },
        { label: "Simulation Mode", shortcut: "Shift+S", action: () => { setMode("free"); setFreeSimOpen(true); } },
        { divider: true },
        { label: "Zoom In", shortcut: "Ctrl++", action: () => setZoomScale((z) => Math.min(1.6, +(z + 0.1).toFixed(2))) },
        { label: "Zoom Reset", shortcut: "Ctrl+0", action: () => setZoomScale(1) },
        { label: "Zoom Out", shortcut: "Ctrl+-", action: () => setZoomScale((z) => Math.max(0.6, +(z - 0.1).toFixed(2))) },
      ];
    if (item === "Tools")
      return [
        { label: "Select", shortcut: "Esc", action: () => { setActiveTool("select"); setPlacingCable(null); setPlacingModel(null); } },
        { label: "Inspect", shortcut: "I", action: () => setActiveTool("inspect") },
        { label: "Delete", shortcut: "Del", action: () => setActiveTool("delete") },
        { label: "Place Note", shortcut: "N", action: () => setActiveTool("note") },
        { divider: true },
        { label: "Add Simple PDU", shortcut: "P", action: () => { setActiveTool("simple-pdu"); setPduSourcePick(null); } },
        { label: "Add Complex PDU", shortcut: "C", action: () => { setActiveTool("complex-pdu"); setComplexPduOpen(true); } },
      ];
    if (item === "Extensions")
      return PT_PRESETS.filter((p) => p.id !== "blank").map((preset) => ({
        label: `Load: ${preset.title}`,
        action: () => loadPresetTopology(preset.id),
      }));
    if (item === "Window")
      return [
        { label: `${!pduCollapsed ? "✓ " : ""}Show Scenario PDU List`, action: () => setPduCollapsed((c) => !c) },
        { label: `${simOpen ? "✓ " : ""}Show Simulation Panel`, action: () => { setMode("free"); setFreeSimOpen((o) => !o); } },
        { divider: true },
        { label: "Close All Open Windows", action: () => { setOpenDeviceModal(null); setRouterView(""); setSelectedEventModal(null); setComplexPduOpen(false); } },
      ];
    return [
      { label: "Keyboard Shortcuts…", action: () => setHelpOpen("shortcuts") },
      { divider: true },
      { label: "About Cisco Packet Tracer…", action: () => setHelpOpen("about") },
    ];
  };

  const activeCatCaption = useMemo(() => {
    if (hoveredShelfLabel) return hoveredShelfLabel;
    if (masterCat === "network") {
      const labelMap: Record<NetSubCat, string> = {
        routers: "Routers",
        switches: "Switches",
        hubs: "Hubs",
        wireless: "Wireless Devices",
        security: "Security",
        wan: "WAN Emulation",
      };
      return `[${labelMap[netSubCat]}]`;
    }
    if (masterCat === "end") return "[End Devices]";
    if (masterCat === "connections") return "[Connections]";
    if (masterCat === "components") return "[Components]";
    if (masterCat === "misc") return "[Miscellaneous]";
    return "[Multiuser]";
  }, [hoveredShelfLabel, masterCat, netSubCat]);

  const statusHint = useMemo(() => {
    if (placingModel) return `Click on Logical canvas to place ${placingModel.model} (Esc to cancel)`;
    if (placingCable) {
      return cableStart
        ? `Connecting from ${cableStart.device.name} (${cableStart.port}) — click target device`
        : `Click first device to connect ${placingCable} cable (Esc to cancel)`;
    }
    if (activeTool === "simple-pdu") {
      return pduSourcePick ? `Click destination device for Simple PDU from ${pduSourcePick}` : "Click source device to send Simple PDU (ICMP Ping)";
    }
    if (activeTool === "delete") return "Click any device, cable, note, or shape to delete";
    if (activeTool === "inspect") return "Click a router or device to inspect its routing table / configuration";
    if (activeTool === "note") return "Click anywhere on the canvas to place a sticky annotation note";
    if (activeTool === "resize") return "Click a drawn zone shape on the canvas to cycle its size";
    if (activeTool.startsWith("draw-")) return "Click on the canvas to place annotation zone shape";
    return error || "Click a device to configure CLI/IP/Desktop, or drag to reposition";
  }, [placingModel, placingCable, cableStart, activeTool, pduSourcePick, error]);

  const activeDropdownValue = experiment ? `exp:${experiment}` : `preset:${selectedPresetId || "switched-lan"}`;

  return (
    <div className={styles.ptRoot}>
      {/* Clean Title Bar (No extraneous LabMate Simulation clutter) */}
      <div className={styles.titleBar}>
        <div className={styles.titleLeft}>
          <PacketTracerAppIcon size={16} />
          <span className={styles.titleText}>
            Cisco Packet Tracer - {spec?.name ? `${spec.name}.pkt` : name ? `${name}.pkt` : "Untitled.pkt"}
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

      {/* Classic 8-Item Menu Bar */}
      <div className={styles.menuBar} role="menubar" aria-label="Packet Tracer menu bar">
        {MENU_ITEMS.map((item) => (
          <div key={item} style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={openMenu === item}
              className={`${styles.menuItem} ${openMenu === item ? styles.menuItemOpen : ""}`}
              onClick={() => setOpenMenu((cur) => (cur === item ? null : item))}
            >
              {item}
            </button>
            {openMenu === item && (
              <div className={styles.menuDropdown}>
                {getMenuEntries(item).map((entry, idx) =>
                  "divider" in entry ? (
                    <div key={idx} className={styles.menuDivider} />
                  ) : (
                    <button
                      key={entry.label}
                      type="button"
                      disabled={entry.disabled}
                      onClick={() => {
                        setOpenMenu(null);
                        entry.action();
                      }}
                      className={`${styles.menuEntry} ${entry.disabled ? styles.menuEntryDisabled : ""}`}
                    >
                      <span>{entry.label}</span>
                      {entry.shortcut && <span className={styles.menuShortcut}>{entry.shortcut}</span>}
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
        <div className={styles.mainToolbarLeft}>
          <button type="button" className={styles.tbBtn} title="New Blank Topology (Ctrl+N)" onClick={() => loadPresetTopology("blank")}>
            <PtNewIcon />
          </button>
          <input
            ref={projectFileRef}
            hidden
            type="file"
            accept=".json,application/json"
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              try {
                if (file.size > 524_288) throw new Error("Choose a topology file smaller than 512 KB.");
                const opened = readTopologyFile(await file.text());
                commitSpec(opened);
                setName(opened.name);
                setMode("free");
                setReplay(null);
                setActions([]);
                setLocalEvents([]);
                setLocalPdus([]);
                setOpenDeviceModal(null);
                setSelectedDeviceName(null);
                setPortPicker(null);
                setCableStart(null);
                setPlacingCable(null);
                setPlacingModel(null);
                setActiveTool("select");
                setSimCursor(null);
                setPlayingSim(false);
                setError("");
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          />
          <button type="button" className={styles.tbBtn} title="Open Topology JSON (Ctrl+O)" onClick={() => projectFileRef.current?.click()}>
            <PtOpenIcon />
          </button>
          <button type="button" className={styles.tbBtn} title="Save Topology JSON (Ctrl+S)" disabled={!spec} onClick={saveJson}>
            <PtSaveIcon />
          </button>
          <button type="button" className={styles.tbBtn} title="Print Topology (Ctrl+P)" onClick={() => window.print()}>
            <PtPrintIcon />
          </button>
          <button type="button" className={styles.tbBtn} title="Preferences (Ctrl+R)" onClick={() => setPrefsOpen(true)}>
            <PtActivityWizardIcon />
          </button>
          <div className={styles.tbSep} />
          <button
            type="button"
            className={styles.tbBtn}
            title="Copy Device (Ctrl+C)"
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
            title="Paste Device (Ctrl+V)"
            disabled={!copiedDevice || !spec}
            onClick={() => {
              if (!copiedDevice || !spec) return;
              const copyName = `${copiedDevice.name}_copy`;
              commitSpec({ ...spec, devices: [...spec.devices, { ...copiedDevice, name: copyName, x: copiedDevice.x + 60, y: copiedDevice.y + 45 }] });
            }}
          >
            <PtPasteIcon />
          </button>
          <button type="button" className={styles.tbBtn} title="Undo (Ctrl+Z)" disabled={!undoStack.length} onClick={undo}>
            <PtUndoIcon />
          </button>
          <button type="button" className={styles.tbBtn} title="Redo (Ctrl+Y)" disabled={!redoStack.length} onClick={redo}>
            <PtRedoIcon />
          </button>
          <div className={styles.tbSep} />
          <button type="button" className={styles.tbBtn} title="Zoom In (Ctrl++)" onClick={() => setZoomScale((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}>
            <PtZoomInIcon />
          </button>
          <button type="button" className={styles.tbBtn} title="Zoom Reset (Ctrl+0)" onClick={() => setZoomScale(1)}>
            <PtZoomResetIcon />
          </button>
          <button type="button" className={styles.tbBtn} title="Zoom Out (Ctrl+-)" onClick={() => setZoomScale((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}>
            <PtZoomOutIcon />
          </button>
          <div className={styles.tbSep} />
          <button
            type="button"
            className={`${styles.tbBtn} ${activeTool === "draw-rect" ? styles.tbBtnActive : ""}`}
            title="Drawing Palette (Draw Zone)"
            onClick={() => {
              setActiveTool("draw-rect");
              setPlacingModel(null);
              setPlacingCable(null);
            }}
          >
            <PtDrawingPaletteIcon />
          </button>
          <div className={styles.tbSep} />
          <button
            type="button"
            className={`${styles.tbBtn} ${activeTool === "simple-pdu" ? styles.tbBtnActive : ""}`}
            title="Add Simple PDU (P)"
            onClick={() => {
              setActiveTool("simple-pdu");
              setPduSourcePick(null);
              setPlacingCable(null);
              setPlacingModel(null);
            }}
          >
            <PtSimplePduIcon size={16} />
          </button>
          <button
            type="button"
            className={`${styles.tbBtn} ${activeTool === "complex-pdu" ? styles.tbBtnActive : ""}`}
            title="Add Complex PDU (C)"
            onClick={() => {
              setActiveTool("complex-pdu");
              setComplexPduOpen(true);
            }}
          >
            <PtComplexPduIcon size={16} />
          </button>
        </div>

        {/* Classic Qt Topology Selector */}
        {!recorded.current && (
          <div className={styles.labControls}>
            <label htmlFor="pt-topology-select" className={styles.labControlsLabel}>
              Topology:
            </label>
            <select
              id="pt-topology-select"
              aria-label="Topology"
              className={styles.qtSelect}
              value={activeDropdownValue}
              onChange={(event) => {
                const val = event.target.value;
                if (val.startsWith("exp:")) loadGuidedExperiment(val.slice(4));
                else if (val.startsWith("preset:")) loadPresetTopology(val.slice(7));
              }}
            >
              <optgroup label="Built-in Topologies">
                {PT_PRESETS.map((item) => (
                  <option key={item.id} value={`preset:${item.id}`}>
                    {item.title}
                  </option>
                ))}
              </optgroup>
              {experiments.length > 0 && (
                <optgroup label="Guided Lab Experiments">
                  {experiments.map((item) => (
                    <option key={item.id} value={`exp:${item.id}`}>
                      {item.title}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {frames.length > 1 && mode === "guided" && (
              <>
                <button
                  type="button"
                  className={styles.qtStepBtn}
                  disabled={index === 0}
                  onClick={() => {
                    setIndex(index - 1);
                    setFrame(frames[index - 1]);
                  }}
                >
                  ◀
                </button>
                <span style={{ fontSize: 11, color: "#334155" }}>
                  Frame {index + 1} / {frames.length}
                </span>
                <button
                  type="button"
                  className={styles.qtStepBtn}
                  disabled={index >= frames.length - 1}
                  onClick={() => {
                    setIndex(index + 1);
                    setFrame(frames[index + 1]);
                  }}
                >
                  ▶
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Horizontal Secondary Common Tools Bar (Authentic PT 8.2.2) */}
      <div className={styles.commonToolsBar} role="toolbar" aria-label="Common Tools">
        <div className={styles.commonToolsLeft}>
          <button
            type="button"
            className={`${styles.railBtn} ${activeTool === "select" ? styles.railBtnActive : ""}`}
            title="Select (Esc)"
            onClick={() => {
              setActiveTool("select");
              setPlacingCable(null);
              setPlacingModel(null);
              setPduSourcePick(null);
            }}
          >
            <PtSelectIcon size={16} />
          </button>
          <button
            type="button"
            className={`${styles.railBtn} ${activeTool === "inspect" ? styles.railBtnActive : ""}`}
            title="Inspect Routing Table / Config (I)"
            onClick={() => {
              setActiveTool("inspect");
              setPlacingCable(null);
              setPlacingModel(null);
            }}
          >
            <PtInspectIcon size={16} />
          </button>
          <button
            type="button"
            className={`${styles.railBtn} ${activeTool === "delete" ? styles.railBtnActive : ""}`}
            title="Delete (Del)"
            onClick={() => {
              setActiveTool("delete");
              setPlacingCable(null);
              setPlacingModel(null);
            }}
          >
            <PtDeleteIcon size={16} />
          </button>
          <button
            type="button"
            className={`${styles.railBtn} ${activeTool === "resize" ? styles.railBtnActive : ""}`}
            title="Resize Shape"
            onClick={() => setActiveTool("resize")}
          >
            <PtResizeIcon size={16} />
          </button>
          <button
            type="button"
            className={`${styles.railBtn} ${activeTool === "note" ? styles.railBtnActive : ""}`}
            title="Place Note (N)"
            onClick={() => {
              setActiveTool("note");
              setPlacingCable(null);
              setPlacingModel(null);
            }}
          >
            <PtNoteIcon size={16} />
          </button>
          <div className={styles.railSep} />
          <button
            type="button"
            className={`${styles.railBtn} ${activeTool === "draw-line" ? styles.railBtnActive : ""}`}
            title="Draw Line"
            onClick={() => {
              setActiveTool("draw-line");
              setPlacingCable(null);
              setPlacingModel(null);
            }}
          >
            <PtDrawLineIcon size={15} />
          </button>
          <button
            type="button"
            className={`${styles.railBtn} ${activeTool === "draw-rect" ? styles.railBtnActive : ""}`}
            title="Draw Rectangle Zone"
            onClick={() => {
              setActiveTool("draw-rect");
              setPlacingCable(null);
              setPlacingModel(null);
            }}
          >
            <PtDrawRectIcon size={15} />
          </button>
          <button
            type="button"
            className={`${styles.railBtn} ${activeTool === "draw-ellipse" ? styles.railBtnActive : ""}`}
            title="Draw Ellipse Zone"
            onClick={() => {
              setActiveTool("draw-ellipse");
              setPlacingCable(null);
              setPlacingModel(null);
            }}
          >
            <PtDrawEllipseIcon size={15} />
          </button>
          <button
            type="button"
            className={styles.railBtn}
            title="Place Quick PC Workstation"
            onClick={() => {
              const pcMeta = DEVICE_CATALOG.end[0];
              setPlacingModel(pcMeta);
              setPlacingCable(null);
            }}
          >
            <PtCustomDeviceIcon size={15} />
          </button>
          <button
            type="button"
            className={styles.railBtn}
            title="Reset Zoom to 100%"
            onClick={() => setZoomScale(1)}
          >
            <PtViewportIcon size={15} />
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
            <PtSimplePduIcon size={16} />
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
            <PtComplexPduIcon size={16} />
          </button>
        </div>

        <span className={styles.toolHint} title={statusHint}>
          {statusHint}
        </span>
      </div>

      {/* Logical / Physical Workspace Navigation Bar (Authentic PT 8.2 Qt Gray Sub-Bar) */}
      <div className={styles.workspaceBar}>
        <div className={styles.wsBarLeft}>
          <div className={styles.logPhysTabs}>
            <button
              type="button"
              className={`${styles.logPhysTab} ${wsTab === "logical" ? styles.logPhysActive : ""}`}
              onClick={() => setWsTab("logical")}
            >
              Logical
            </button>
            <button
              type="button"
              className={`${styles.logPhysTab} ${wsTab === "physical" ? styles.logPhysActive : ""}`}
              onClick={() => setWsTab("physical")}
            >
              Physical
            </button>
          </div>
          <div className={styles.wsSubControls}>
            <span className={styles.coordBadge}>
              [{mouseSvg.x}, {mouseSvg.y}]
            </span>
            <button type="button" className={styles.wsToolChip} onClick={() => setZoomScale(1)}>
              Root
            </button>
            <button
              type="button"
              className={styles.wsToolChip}
              onClick={() => setActiveTool("draw-rect")}
            >
              New Cluster
            </button>
            <button
              type="button"
              className={styles.wsToolChip}
              onClick={() => setActiveTool("select")}
            >
              Move Object
            </button>
            <button
              type="button"
              className={styles.wsToolChip}
              onClick={() => setCanvasBg((b) => (b === "#ffffff" ? "#f4f6f9" : "#ffffff"))}
            >
              Set Tiled Background
            </button>
          </div>
        </div>

        <div className={styles.wsBarRight}>
          <span>{Math.round(zoomScale * 100)}%</span>
          <span>·</span>
          <span>{(spec?.devices ?? []).length} devices</span>
        </div>
      </div>

      {/* =================================================================
       * Middle Workspace: Logical/Physical Canvas + Docked Simulation Panel
       * ================================================================= */}
      <div className={styles.middleArea}>
        <div className={styles.canvasPane} style={{ background: canvasBg }}>
          {wsTab === "physical" && spec ? (
            <PtPhysicalWorkspace
              spec={spec}
              onSelectDevice={(devName) => {
                setModalInit({});
                setOpenDeviceModal(devName);
              }}
            />
          ) : (
            <svg
              ref={svgRef}
              viewBox={viewBox}
              preserveAspectRatio="xMidYMid meet"
              className={styles.canvasSvg}
              role="img"
              aria-label="Network topology"
              onClick={handleCanvasClick}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("application/x-labmate-pt-model")) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  setMouseSvg(clientToSvg(e.clientX, e.clientY));
                }
              }}
              onDrop={(e) => {
                const rawModel = e.dataTransfer.getData("application/x-labmate-pt-model");
                if (!rawModel) return;
                e.preventDefault();
                try {
                  const meta = JSON.parse(rawModel) as DeviceModelMeta;
                  placeModelAt(meta, clientToSvg(e.clientX, e.clientY));
                } catch {
                  // Ignore malformed drop payload
                }
              }}
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
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e9edf2" strokeWidth="1" />
                </pattern>
              </defs>
              <rect
                x="-2000"
                y="-2000"
                width="5000"
                height="5000"
                fill={prefs.showGrid ? "url(#ptGridPattern)" : canvasBg}
              />

              {/* User Drawn Shapes */}
              {(spec?.shapes ?? []).map((s) => (
                <g
                  key={s.id}
                  onClick={(ev) => {
                    if (!spec) return;
                    if (activeTool === "delete") {
                      ev.stopPropagation();
                      commitSpec({ ...spec, shapes: (spec.shapes ?? []).filter((x) => x.id !== s.id) });
                    } else if (activeTool === "resize") {
                      ev.stopPropagation();
                      const nextW = s.w > 220 ? 150 : Math.round(s.w * 1.25);
                      const nextH = s.h > 160 ? 95 : Math.round(s.h * 1.25);
                      commitSpec({
                        ...spec,
                        shapes: (spec.shapes ?? []).map((x) => (x.id === s.id ? { ...x, w: nextW, h: nextH } : x)),
                      });
                    }
                  }}
                  style={{ cursor: activeTool === "delete" || activeTool === "resize" ? "pointer" : "default" }}
                >
                  {s.kind === "line" ? (
                    <line x1={s.x} y1={s.y + s.h} x2={s.x + s.w} y2={s.y} stroke={s.stroke} strokeWidth={2.5} />
                  ) : s.kind === "ellipse" ? (
                    <ellipse cx={s.x + s.w / 2} cy={s.y + s.h / 2} rx={s.w / 2} ry={s.h / 2} fill={s.fill} stroke={s.stroke} strokeWidth={1.5} />
                  ) : (
                    <rect x={s.x} y={s.y} width={s.w} height={s.h} fill={s.fill} stroke={s.stroke} strokeWidth={1.5} rx={4} />
                  )}
                </g>
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

              {/* Faint cursor placement preview when a model is armed */}
              {placingModel && (
                <g transform={`translate(${mouseSvg.x}, ${mouseSvg.y})`} opacity={0.48} style={{ pointerEvents: "none" }}>
                  <PtCanvasDeviceArtwork type={placingModel.kind} />
                </g>
              )}

              {/* Cables + Authentic Zigzag Serial + Link Triangles */}
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

                const isSerial = cable.cable === "serial-dce" || cable.cable === "serial-dte";

                return (
                  <g
                    key={i}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      toggleOrDeleteCable(cable);
                    }}
                    style={{ cursor: mode === "free" || activeTool === "delete" ? "pointer" : "default" }}
                  >
                    {isSerial ? (
                      <path
                        d={serialZigzagPath(a.x, a.y, b.x, b.y)}
                        fill="none"
                        stroke="#DC2626"
                        strokeWidth={2.1}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : (
                      <line
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={cableStrokeColor(cable)}
                        strokeWidth={2}
                        strokeDasharray={cableStrokeDash(cable)}
                      />
                    )}
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
                    {prefs.showLinkLights && cable.cable !== "console" && (
                      <>
                        {tri(pa, 1, colorA)}
                        {tri(pb, -1, colorB)}
                      </>
                    )}
                    {prefs.showPortLabels && (
                      <>
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
                          {cable.ap.replace("FastEthernet", "Fa").replace("GigabitEthernet", "Gi").replace("Serial", "Se")}
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
                          {cable.bp.replace("FastEthernet", "Fa").replace("GigabitEthernet", "Gi").replace("Serial", "Se")}
                        </text>
                      </>
                    )}
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
                  opacity={0.28}
                  strokeLinecap="round"
                />
              ))}

              {/* Devices (with Model + Name labels & Hover Property Tooltip trigger) */}
              {spec?.devices.map((device) => (
                <g
                  key={device.name}
                  transform={`translate(${device.x},${device.y})`}
                  onMouseEnter={(ev) => {
                    if (dragState || recorded.current || openDeviceModal) return;
                    setHoveredDevice({ device, screenX: ev.clientX, screenY: ev.clientY });
                  }}
                  onMouseLeave={() => setHoveredDevice(null)}
                  onMouseDown={(ev) => {
                    if (recorded.current || activeTool !== "select" || placingCable || placingModel) return;
                    const pt = clientToSvg(ev.clientX, ev.clientY);
                    setHoveredDevice(null);
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
                  {prefs.showModelLabels && device.model && (
                    <text
                      y={device.type === "router" ? 33 : 32}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontWeight={500}
                      fill="#526070"
                      stroke="#ffffff"
                      strokeWidth={3}
                      paintOrder="stroke"
                    >
                      {device.model}
                    </text>
                  )}
                  {prefs.showNameLabels && (
                    <text
                      y={device.type === "router" ? (prefs.showModelLabels && device.model ? 44 : 36) : prefs.showModelLabels && device.model ? 43 : 35}
                      textAnchor="middle"
                      fontSize={11.5}
                      fontWeight={600}
                      fill="#151e29"
                      stroke="#ffffff"
                      strokeWidth={3.5}
                      paintOrder="stroke"
                    >
                      {device.name}
                    </text>
                  )}
                  {prefs.showIpLabels && device.ip && (
                    <text
                      y={prefs.showModelLabels && device.model ? 54 : 47}
                      textAnchor="middle"
                      fontSize={9.5}
                      fill="#0369a1"
                      stroke="#ffffff"
                      strokeWidth={3}
                      paintOrder="stroke"
                    >
                      {device.ip}
                    </text>
                  )}
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

          {/* Classic PT Property Hover Tooltip */}
          {hoveredDevice && !dragState && !openDeviceModal && (
            <div
              className={styles.ptTooltip}
              style={{
                left: Math.min(hoveredDevice.screenX + 14, typeof window !== "undefined" ? window.innerWidth - 405 : 900),
                top: Math.min(hoveredDevice.screenY + 12, typeof window !== "undefined" ? window.innerHeight - 210 : 500),
              }}
            >
              <div className={styles.tooltipHeader}>
                <span>
                  {hoveredDevice.device.name} ({hoveredDevice.device.model || hoveredDevice.device.type})
                </span>
                <span style={{ color: hoveredDevice.device.power === false ? "#b91c1c" : "#15803d" }}>
                  {hoveredDevice.device.power === false ? "Power Off" : "Up"}
                </span>
              </div>
              <table className={styles.tooltipTable}>
                <thead>
                  <tr>
                    <th>Port</th>
                    <th>Link</th>
                    <th>IP Address</th>
                    <th>MAC</th>
                  </tr>
                </thead>
                <tbody>
                  {getDevicePorts(hoveredDevice.device)
                    .filter((p) => p !== "Console" && p !== "RS 232")
                    .slice(0, 5)
                    .map((p) => {
                      const cfg = hoveredDevice.device.interfaces?.[p];
                      const linked = spec?.links.some(
                        (c) => ((c.a === hoveredDevice.device.name && c.ap === p) || (c.b === hoveredDevice.device.name && c.bp === p)) && isLinkUp(spec, c),
                      );
                      const rawIp = cfg?.ip || (p === "FastEthernet0" || p === "Eth0" ? hoveredDevice.device.ip : "") || "";
                      const mask = cfg?.mask || hoveredDevice.device.mask || "255.255.255.0";
                      const ipText = rawIp ? `${rawIp}/${maskToCidr(mask)}` : "Not Set";
                      const macText = syntheticMac(hoveredDevice.device.name, p);
                      return (
                        <tr key={p}>
                          <td>{p.replace("FastEthernet", "Fa").replace("GigabitEthernet", "Gi")}</td>
                          <td style={{ color: linked ? "#15803d" : "#b91c1c" }}>{linked ? "Up" : "Down"}</td>
                          <td>{ipText}</td>
                          <td>{macText}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {hoveredDevice.device.gateway && (
                <div style={{ marginTop: 3, fontSize: 10, color: "#475569" }}>
                  Gateway: <b>{hoveredDevice.device.gateway}</b>
                </div>
              )}
            </div>
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
                minWidth: 170,
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
                    className={styles.menuEntry}
                    style={{ color: used ? "#94a3b8" : "#0f172a" }}
                  >
                    <span>
                      {p} {used ? "(in use)" : ""}
                    </span>
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
                padding: 10,
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
                className={styles.ptQtBtn}
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
              <button type="button" className={styles.ptQtBtn} onClick={() => setNoteDraft(null)}>
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
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Source Device:</span>
                  <select className={styles.qtSelect} value={from} onChange={(e) => setFrom(e.target.value)}>
                    {pcs.map((p) => (
                      <option key={p.name}>{p.name}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Destination Device:</span>
                  <select className={styles.qtSelect} value={to} onChange={(e) => setTo(e.target.value)}>
                    {pcs.map((p) => (
                      <option key={p.name}>{p.name}</option>
                    ))}
                  </select>
                </label>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 6 }}>
                  <button
                    type="button"
                    className={styles.ptQtBtn}
                    onClick={() => {
                      const target = pcs.find((p) => p.name === to)?.ip || to;
                      if (from && target) {
                        setMode("free");
                        setFreeSimOpen(true);
                        void runActions([...actions, { type: "ping", from, to: target }]);
                      }
                      setComplexPduOpen(false);
                      setActiveTool("select");
                    }}
                  >
                    Create PDU
                  </button>
                  <button
                    type="button"
                    className={styles.ptQtBtn}
                    onClick={() => {
                      setComplexPduOpen(false);
                      setActiveTool("select");
                    }}
                  >
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
                    className={styles.ptDialogCloseBtn}
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

        {/* Docked Right Simulation Panel (Authentic PT 8.2.2 Light Qt Chrome) */}
        {simOpen ? (
          <aside className={styles.simPanel} aria-label="Simulation Panel">
            <div className={styles.simHeader}>
              <span>Simulation Panel</span>
              <button
                type="button"
                className={styles.simCloseBtn}
                title="Switch to Realtime"
                onClick={() => {
                  setFreeSimOpen(false);
                  setPlayingSim(false);
                }}
              >
                ✕
              </button>
            </div>
            <div className={styles.simBody}>
              {/* 1. Event List */}
              <div className={styles.eventListWrap}>
                <div className={styles.eventListTitle}>Event List</div>
                <div className={styles.eventTableScroll} aria-label="Event List">
                  <table className={styles.ptTable}>
                    <thead>
                      <tr>
                        <th style={{ width: 26 }}>Vis.</th>
                        <th style={{ width: 50 }}>Time(sec)</th>
                        <th style={{ width: 60 }}>Last Dev</th>
                        <th style={{ width: 60 }}>At Dev</th>
                        <th style={{ width: 54 }}>Type</th>
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
                                  : "#FFFFFF",
                              fontWeight: isActiveRow ? 600 : 400,
                            }}
                          >
                            <td style={{ textAlign: "center" }}>{isActiveRow ? <PtEyeIcon size={13} /> : ""}</td>
                            <td>{event.time.toFixed(3)}</td>
                            <td>{event.last || "—"}</td>
                            <td>{event.at}</td>
                            <td>
                              <span
                                className={styles.protoSq}
                                style={{ width: 10, height: 10, background: TYPE_COLOR[event.type] ?? "#777" }}
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
                          <td colSpan={6} style={{ color: "#64748b", padding: 8, whiteSpace: "normal" }}>
                            No events captured yet. Send a Simple PDU (P) between two hosts to observe ARP &amp; ICMP packets.
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
                  <input type="checkbox" checked={constantDelay} onChange={(e) => setConstantDelay(e.target.checked)} />
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
                          prev.size >= 6 ? new Set() : new Set(["ARP", "ICMP", "RIP", "DNS", "HTTP", "DHCP"]),
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
                    {["ARP", "ICMP", "RIP", "DNS", "HTTP", "DHCP"].map((proto) => (
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
       * Classic Qt Bottom Control Strip (Time / Power Cycle / Realtime | Sim)
       * ================================================================= */}
      <div className={styles.ptModeStrip}>
        <div className={styles.ptStripLeft}>
          <PtRealtimeIcon size={14} />
          <span className={styles.stripClock}>Time: {formatClock(elapsedSeconds)}</span>
          <button
            type="button"
            className={styles.stripBtn}
            onClick={triggerPowerCycle}
            title="Power Cycle Devices (Reset & Reconverge)"
          >
            <PtPowerCycleIcon size={12} />
            <span>Power Cycle Devices</span>
          </button>
          <button
            type="button"
            className={styles.stripBtn}
            onClick={() => {
              setElapsedSeconds((s) => s + 30);
              setConverging(false);
            }}
            title="Fast Forward Time (+30s)"
          >
            <PtFastForwardIcon size={12} />
            <span>Fast Forward Time</span>
          </button>
        </div>

        <div className={styles.modeSwitchWrap} aria-label="Mode">
          <button
            type="button"
            className={`${styles.modeBtn} ${!simOpen ? styles.modeBtnRealtimeActive : ""}`}
            aria-pressed={!simOpen}
            onClick={() => {
              if (mode === "free") {
                setFreeSimOpen(false);
                setPlayingSim(false);
              }
              if (mode === "guided" && frames.length) {
                setIndex(0);
                setFrame(frames[0]);
              }
            }}
          >
            <PtRealtimeIcon size={14} />
            <span>Realtime</span>
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${simOpen ? styles.modeBtnSimActive : ""}`}
            aria-pressed={Boolean(simOpen)}
            onClick={() => {
              if (mode === "free") setFreeSimOpen(true);
              if (mode === "guided" && frames.length > 1 && view?.view !== "simulation") {
                const simIdx = frames.findIndex((f) => f.view === "simulation");
                if (simIdx >= 0) {
                  setIndex(simIdx);
                  setFrame(frames[simIdx]);
                }
              }
            }}
          >
            <PtSimulationIcon size={14} />
            <span>Simulation</span>
          </button>
        </div>
      </div>

      {/* =================================================================
       * Bottom Dock: Device-Type Selection Box + Model Shelf + Collapsible PDU Window
       * ================================================================= */}
      <div className={styles.bottomDock}>
        <div className={styles.deviceBox}>
          <div className={styles.catCols}>
            <div className={styles.catGridArea}>
              <div className={styles.catRow}>
                <button
                  type="button"
                  className={`${styles.catBtn} ${masterCat === "network" ? styles.catBtnActive : ""}`}
                  title="Network Devices"
                  onClick={() => setMasterCat("network")}
                  onMouseEnter={() => setHoveredShelfLabel("Network Devices")}
                  onMouseLeave={() => setHoveredShelfLabel(null)}
                >
                  <PtCatNetworkIcon />
                </button>
                <button
                  type="button"
                  className={`${styles.catBtn} ${masterCat === "end" ? styles.catBtnActive : ""}`}
                  title="End Devices"
                  onClick={() => setMasterCat("end")}
                  onMouseEnter={() => setHoveredShelfLabel("End Devices")}
                  onMouseLeave={() => setHoveredShelfLabel(null)}
                >
                  <PtCatEndDevicesIcon />
                </button>
                <button
                  type="button"
                  className={`${styles.catBtn} ${masterCat === "components" ? styles.catBtnActive : ""}`}
                  title="Components"
                  onClick={() => setMasterCat("components")}
                  onMouseEnter={() => setHoveredShelfLabel("Components")}
                  onMouseLeave={() => setHoveredShelfLabel(null)}
                >
                  <PtCatComponentsIcon />
                </button>
                <button
                  type="button"
                  className={`${styles.catBtn} ${masterCat === "connections" ? styles.catBtnActive : ""}`}
                  title="Connections"
                  onClick={() => setMasterCat("connections")}
                  onMouseEnter={() => setHoveredShelfLabel("Connections")}
                  onMouseLeave={() => setHoveredShelfLabel(null)}
                >
                  <PtCatConnectionsIcon />
                </button>
                <button
                  type="button"
                  className={`${styles.catBtn} ${masterCat === "misc" ? styles.catBtnActive : ""}`}
                  title="Miscellaneous"
                  onClick={() => setMasterCat("misc")}
                  onMouseEnter={() => setHoveredShelfLabel("Miscellaneous")}
                  onMouseLeave={() => setHoveredShelfLabel(null)}
                >
                  <PtCatMiscIcon />
                </button>
                <button
                  type="button"
                  className={`${styles.catBtn} ${masterCat === "multiuser" ? styles.catBtnActive : ""}`}
                  title="Multiuser"
                  onClick={() => setMasterCat("multiuser")}
                  onMouseEnter={() => setHoveredShelfLabel("Multiuser")}
                  onMouseLeave={() => setHoveredShelfLabel(null)}
                >
                  <PtCatMultiuserIcon />
                </button>
              </div>

              {masterCat === "network" ? (
                <div className={styles.subCatRow}>
                  {(
                    [
                      ["routers", "Routers"],
                      ["switches", "Switches"],
                      ["hubs", "Hubs"],
                      ["wireless", "Wireless Devices"],
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
                      onMouseEnter={() => setHoveredShelfLabel(lbl)}
                      onMouseLeave={() => setHoveredShelfLabel(null)}
                    >
                      <PtSubCatIcon kind={k} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className={styles.subCatRow}>
                  <button
                    type="button"
                    title={masterCat === "connections" ? "Cables" : "Devices"}
                    className={`${styles.subBtn} ${styles.subBtnActive}`}
                  >
                    {masterCat === "connections" ? <PtCatConnectionsIcon /> : <PtCatEndDevicesIcon />}
                  </button>
                </div>
              )}
            </div>

            <div className={styles.catCaption}>{activeCatCaption}</div>
          </div>

          <div className={styles.modelShelf}>
            {shelfModels.map((item) => {
              if (item.kind === "cable") {
                const active = placingCable === item.cable;
                return (
                  <button
                    key={item.cable}
                    type="button"
                    className={`${styles.modelCard} ${active ? styles.modelCardActive : ""}`}
                    style={{ cursor: "pointer" }}
                    title={item.label}
                    onMouseEnter={() => setHoveredShelfLabel(item.label)}
                    onMouseLeave={() => setHoveredShelfLabel(null)}
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
                    <span className={styles.modelLabel}>
                      {item.label
                        .replace("Automatically Choose Connection Type", "Auto")
                        .replace("Copper Straight-Through", "Copper Straight")
                        .replace("Copper Cross-Over", "Copper Cross")}
                    </span>
                  </button>
                );
              }
              const active = placingModel?.model === item.meta.model;
              return (
                <button
                  key={item.meta.model}
                  type="button"
                  draggable
                  onDragStart={(ev) => {
                    ev.dataTransfer.setData("application/x-labmate-pt-model", JSON.stringify(item.meta));
                    ev.dataTransfer.effectAllowed = "copy";
                  }}
                  className={`${styles.modelCard} ${active ? styles.modelCardActive : ""}`}
                  title={`Click or drag onto canvas to place ${item.meta.model}`}
                  onMouseEnter={() => setHoveredShelfLabel(`${item.meta.model} (${item.meta.label})`)}
                  onMouseLeave={() => setHoveredShelfLabel(null)}
                  onClick={() => {
                    setPlacingModel(item.meta);
                    setPlacingCable(null);
                    setCableStart(null);
                    setActiveTool("select");
                  }}
                >
                  <svg width="56" height="50" viewBox="-34 -28 68 56" aria-hidden="true">
                    <PtCanvasDeviceArtwork type={item.meta.kind} compact={item.meta.kind === "pc" || item.meta.kind === "server"} />
                  </svg>
                  <span className={styles.modelLabel}>{item.meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Vertical Collapse Toggle Strip + Collapsible Scenario 0 PDU Dock */}
        <button
          type="button"
          className={styles.pduCollapseStrip}
          title={pduCollapsed ? "Expand PDU List Window" : "Collapse PDU List Window"}
          aria-label={pduCollapsed ? "Expand PDU List Window" : "Collapse PDU List Window"}
          onClick={() => setPduCollapsed((c) => !c)}
        >
          {pduCollapsed ? "◀" : "▶"}
        </button>

        {!pduCollapsed && (
          <div className={styles.pduDock}>
            <div className={styles.pduBar}>
              <span>{scenarios[scenarioIdx] ?? "Scenario 0"} — PDU List</span>
              <div className={styles.pduBarControls}>
                <select
                  aria-label="Active scenario"
                  className={styles.pduScenarioSelect}
                  value={scenarioIdx}
                  onChange={(e) => setScenarioIdx(Number(e.target.value))}
                >
                  {scenarios.map((s, idx) => (
                    <option key={s} value={idx}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.pduMiniBtn}
                  onClick={() => {
                    const nextName = `Scenario ${scenarios.length}`;
                    setScenarios((prev) => [...prev, nextName]);
                    setScenarioIdx(scenarios.length);
                  }}
                >
                  New
                </button>
                <button
                  type="button"
                  className={styles.pduMiniBtn}
                  disabled={!localPdus.length && !localEvents.length}
                  onClick={() => {
                    setLocalPdus([]);
                    setLocalEvents([]);
                    setSimCursor(null);
                  }}
                >
                  Delete
                </button>
              </div>
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
                    <th>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {(view?.pdus ?? []).map((pdu, idx) => (
                    <tr key={`${pdu.pdu}-${idx}`}>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className={styles.pduFireBtn}
                          title={`Re-fire ${pdu.source} -> ${pdu.destination}`}
                          onClick={() => {
                            if (mode === "free") {
                              void runActions([...actions, { type: "ping", from: pdu.source, to: pdu.destination }]);
                            }
                          }}
                        >
                          ●
                        </button>
                      </td>
                      <td style={{ color: pdu.status === "Successful" ? "#0b7a2a" : "#b00020", fontWeight: 600 }}>{pdu.status}</td>
                      <td>{pdu.source}</td>
                      <td>{pdu.destination}</td>
                      <td>{pdu.type || "ICMP"}</td>
                      <td>
                        <span className={styles.protoSq} style={{ background: "#1e9e4a" }} />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 0 }}
                          title="Remove PDU"
                          onClick={() => setLocalPdus((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!(view?.pdus ?? []).length ? (
                    <tr>
                      <td colSpan={7} style={{ color: "#64748b", padding: 8, whiteSpace: "normal" }}>
                        No User Created PDUs. Use Add Simple PDU (P) or select a simulation frame.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Device Configuration Window */}
      {activeDeviceObj && spec && (
        <PtDeviceModal
          key={`${activeDeviceObj.name}:${modalInit.tab ?? ""}:${modalInit.section ?? ""}:${modalInit.desktopApp ?? ""}`}
          spec={spec}
          device={activeDeviceObj}
          initialTab={modalInit.tab}
          initialConfigSection={modalInit.section}
          initialDesktopApp={modalInit.desktopApp}
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
          onUpdatePeerDevice={(updatedPeer) => {
            setSpec({
              ...spec,
              devices: spec.devices.map((d) => (d.name === updatedPeer.name ? updatedPeer : d)),
            });
          }}
          onClose={() => setOpenDeviceModal(null)}
        />
      )}

      {/* PDU Information Modal (OSI Model + Inbound/Outbound) */}
      {selectedEventModal && spec && (
        <PtPduModal spec={spec} event={selectedEventModal} onClose={() => setSelectedEventModal(null)} />
      )}

      {/* Preferences Modal (Options > Preferences...) */}
      {prefsOpen && (
        <div className={styles.ptDialogBackdrop} onClick={() => setPrefsOpen(false)}>
          <div
            role="dialog"
            aria-label="Preferences"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className={`${styles.ptDialog} ${styles.ptPrefModal}`}
          >
            <div className={styles.ptDialogHeader} style={{ cursor: "default" }}>
              <span>Preferences — Interface &amp; Labels</span>
              <button type="button" className={styles.ptDialogCloseBtn} onClick={() => setPrefsOpen(false)} aria-label="Close Preferences">
                ✕
              </button>
            </div>
            <div style={{ padding: 14, display: "grid", gap: 9, background: "#f5f7fa" }}>
              {(
                [
                  ["showPortLabels", "Always Show Port Labels in Logical Workspace"],
                  ["showModelLabels", "Show Device Model Labels"],
                  ["showNameLabels", "Show Device Name Labels"],
                  ["showIpLabels", "Show IPv4 Address Labels on Canvas"],
                  ["showGrid", "Show Logical Workspace Grid Lines"],
                  ["showLinkLights", "Show Link Status Triangles"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={prefs[key]}
                    onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <button type="button" className={styles.ptQtBtn} onClick={() => setPrefsOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help / About / Shortcuts Modal */}
      {helpOpen && (
        <div className={styles.ptDialogBackdrop} onClick={() => setHelpOpen(null)}>
          <div
            role="dialog"
            aria-label={helpOpen === "about" ? "About Cisco Packet Tracer" : "Keyboard Shortcuts"}
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className={`${styles.ptDialog} ${styles.ptPrefModal}`}
          >
            <div className={styles.ptDialogHeader} style={{ cursor: "default" }}>
              <span>{helpOpen === "about" ? "About Cisco Packet Tracer Workspace" : "Keyboard Shortcuts"}</span>
              <button type="button" className={styles.ptDialogCloseBtn} onClick={() => setHelpOpen(null)} aria-label="Close help">
                ✕
              </button>
            </div>
            <div style={{ padding: 14, background: "#f5f7fa", display: "grid", gap: 8 }}>
              {helpOpen === "about" ? (
                <>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Cisco Packet Tracer — LabMate Desktop Edition</div>
                  <div style={{ color: "#334155", lineHeight: 1.45 }}>
                    Interactive desktop-faithful network simulator supporting Logical &amp; Physical views, Copper/Fiber/Console/Serial cabling, Cisco IOS CLI, VLAN isolation, Static/RIP routing, HTTP/DHCP/DNS services, and Simulation Event inspection.
                  </div>
                </>
              ) : (
                <table className={styles.ptTable}>
                  <thead>
                    <tr>
                      <th>Shortcut</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Esc", "Return to Select tool / Cancel action"],
                      ["I", "Inspect device / routing table"],
                      ["N", "Place canvas note"],
                      ["P", "Add Simple PDU (ICMP Ping)"],
                      ["C", "Add Complex PDU"],
                      ["Del", "Delete selected device"],
                      ["Ctrl+Z / Ctrl+Y", "Undo / Redo topology edits"],
                      ["Ctrl+C / Ctrl+V", "Copy / Paste selected device"],
                    ].map(([k, desc]) => (
                      <tr key={k}>
                        <td style={{ fontWeight: 600, fontFamily: "Consolas, monospace" }}>{k}</td>
                        <td>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" className={styles.ptQtBtn} onClick={() => setHelpOpen(null)}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
