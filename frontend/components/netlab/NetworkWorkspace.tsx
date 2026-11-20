"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import {
  ArrowDownToLine, ArrowRight, Cable, ChevronDown, HelpCircle, Cpu, FilePlus,
  FolderOpen, Laptop, Layers, Minus, Monitor, Network, Pause, Play, Plus, Printer, Redo2,
  RotateCcw, Router, Save, Server, SkipForward, Trash2, Undo2, Wifi, X,
} from "lucide-react";
import {
  busyPort, CABLING, compatibleMedia, connect, deleteDevice, dhcp, emptyProject, linkUp,
  makeDevice, MAX_DEVICES, MODELS, ping, portKinds, setDevice,
} from "@/lib/netlab/networkProject";
import type { CableChoice, Endpoint, Medium, Model, PacketEvent, Project } from "@/lib/netlab/networkProject";
import { buildSample, openProject, SAMPLES, STORAGE_KEY, WORLD } from "@/lib/netlab/networkProjects";
import { buildNetworkPractical, type PracticalFrame } from "@/lib/netlab/networkPracticals";
import { useStudioHook } from "./studioHook";
import { NetworkDeviceInspector } from "./NetworkDeviceInspector";
import styles from "./networkWorkspace.module.css";

const ICONS = { router: Router, switch: Network, hub: Layers, wirelessRouter: Router, accessPoint: Wifi, pc: Monitor, laptop: Laptop, server: Server, printer: Printer };
const GROUPS = ["Routing", "Switching", "Wireless", "End devices"] as const;
const MEDIA: CableChoice[] = ["auto", "straight", "cross", "console", "fiber", "wireless"];
const STROKES: Record<Medium, string> = { straight: "#537186", cross: "#537186", console: "#207bbc", fiber: "#a34c08", wireless: "#5b50ac" };
const PROTOCOLS = ["All", "ARP", "ICMP", "DHCP", "DNS", "System"] as const;

interface Notice { text: string; error?: boolean }

export function NetworkWorkspace({ capture = false }: { capture?: boolean }) {
  const [project, setProject] = useState<Project>(() => buildSample("lan"));
  const [history, setHistory] = useState<{ previous: Project[]; next: Project[] }>({ previous: [], next: [] });
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState("");
  const [port, setPort] = useState("");
  const [inspectorTab, setInspectorTab] = useState<"ports" | "terminal" | "settings">("ports");
  const [captureFrame, setCaptureFrame] = useState("");
  const [workspace, setWorkspace] = useState<"logical" | "physical">("logical");
  const [group, setGroup] = useState<(typeof GROUPS)[number]>("Routing");
  const [tool, setTool] = useState<"select" | "place" | "connect">("select");
  const [model, setModel] = useState<Model>("router");
  const [medium, setMedium] = useState<CableChoice>("auto");
  const [first, setFirst] = useState<Endpoint | null>(null);
  const [picker, setPicker] = useState("");
  const [menu, setMenu] = useState("");
  const [zoom, setZoom] = useState(1);
  const [grid, setGrid] = useState(true);
  const [help, setHelp] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [mode, setMode] = useState<"real-time" | "simulation">("real-time");
  const [delay, setDelay] = useState(360);
  const [events, setEvents] = useState<PacketEvent[]>([]);
  const [outcome, setOutcome] = useState<Notice | null>(null);
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [filter, setFilter] = useState<(typeof PROTOCOLS)[number]>("All");
  const [inspected, setInspected] = useState<number | null>(null);
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<SVGSVGElement>(null);
  const eventRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; before: Project; x: number; y: number; dx: number; dy: number; moved: boolean } | null>(null);
  const pattern = useId();

  const byId = Object.fromEntries(project.devices.map((device) => [device.id, device]));
  const device = byId[selected];
  const pointedDevice = byId[picker];
  const endpoints = project.devices.filter((item) => Object.values(item.ports).some((p) => p.ip));
  const from = endpoints.some((item) => item.id === source) ? source : endpoints[0]?.id || "";
  const currentEvent = events[inspected ?? cursor];
  const shownNotice = notice ?? (cursor === events.length - 1 ? outcome : null);
  const activeFrom = currentEvent && byId[currentEvent.from];
  const activeTo = currentEvent && byId[currentEvent.to];

  useStudioHook<{ topic: string }, PracticalFrame>({
    load: () => {},
    show: (step) => {
      if (!capture) return;
      setProject(step.project);
      setSelected(step.device || "");
      setPort(step.port || "");
      setInspectorTab(step.settings ? "settings" : "ports");
      setEvents(step.events);
      setCursor(step.events.length - 1);
      setNotice({ text: step.title + " · " + step.explain });
      setCaptureFrame(step.id);
    },
  }, captureFrame);

  useEffect(() => {
    if (!capture) return;
    window.__labmatePractical = buildNetworkPractical;
    return () => { delete window.__labmatePractical; };
  }, [capture]);

  useEffect(() => {
    if (capture) { setReady(true); return; }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setProject(openProject(stored));
    } catch {
      setNotice({ text: "The saved workspace could not be restored. You can open a saved project file.", error: true });
    } finally { setReady(true); }
  }, [capture]);

  useEffect(() => {
    if (!ready || capture) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); } catch { /* Export remains available. */ }
  }, [ready, project, capture]);

  useEffect(() => {
    if (!playing) return;
    if (cursor >= events.length - 1) return;
    const timer = window.setTimeout(() => {
      setCursor(cursor + 1);
      if (cursor + 1 === events.length - 1) setPlaying(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [playing, cursor, events.length, delay]);

  useEffect(() => {
    if (playing && cursor >= 0) {
      const viewport = eventRef.current;
      const selectedRow = viewport?.querySelector<HTMLElement>("[aria-current='step']");
      if (viewport && selectedRow) {
        const row = selectedRow.getBoundingClientRect(), bounds = viewport.getBoundingClientRect();
        if (row.bottom > bounds.bottom) viewport.scrollTop += row.bottom - bounds.bottom;
        if (row.top < bounds.top) viewport.scrollTop -= bounds.top - row.top;
      }
    }
  }, [cursor, playing]);

  function addHistory(before: Project) {
    setHistory((h) => ({ previous: [...h.previous.slice(-29), before], next: [] }));
  }
  function commit(next: Project) {
    if (next === project) return;
    addHistory(project);
    setProject(next);
  }
  function undo() {
    if (!history.previous.length) return;
    setProject(history.previous[history.previous.length - 1]);
    setHistory({ previous: history.previous.slice(0, -1), next: [project, ...history.next] });
    clearPackets();
  }
  function redo() {
    if (!history.next.length) return;
    setProject(history.next[0]);
    setHistory({ previous: [...history.previous, project], next: history.next.slice(1) });
    clearPackets();
  }
  function select(id: string, tab: "ports" | "terminal" = "ports", preferredPort?: string) {
    const target = byId[id];
    setSelected(id);
    setPort(preferredPort || (target ? Object.keys(target.ports).find((p) => !["Console", "RS-232"].includes(p)) || "" : ""));
    setInspectorTab(tab);
  }
  function clearPackets() {
    setEvents([]); setOutcome(null); setCursor(-1); setPlaying(false); setInspected(null); setFilter("All");
  }
  function replace(next: Project) {
    commit(next);
    select(""); setSource(""); setDestination(""); setTool("select"); setPicker(""); setFirst(null);
    setWorkspace("logical"); clearPackets();
    setNotice({ text: next.name + " opened." });
  }
  function save(download = false) {
    if (download) {
      const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = (project.name.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "labmate-network") + ".labnet.json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice({ text: "Project exported as a LabMate JSON file." });
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      setNotice({ text: "Project saved on this browser." });
    } catch {
      setNotice({ text: "Browser storage is unavailable. Use Export project to save a copy.", error: true });
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 524_288) throw new Error("The project exceeds the 512 KB limit.");
      replace(openProject(await file.text()));
    } catch (error) {
      setNotice({ text: error instanceof SyntaxError ? "This file is not a LabMate JSON project." : (error as Error).message, error: true });
    }
  }
  function point(clientX: number, clientY: number) {
    const svg = canvasRef.current;
    const matrix = svg?.getScreenCTM();
    if (!matrix) return { x: WORLD.width / 2, y: WORLD.height / 2 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: Math.round(Math.max(48, Math.min(WORLD.width - 48, p.x))), y: Math.round(Math.max(42, Math.min(WORLD.height - 57, p.y))) };
  }
  function place(kind: Model, x: number, y: number) {
    if (project.devices.length >= MAX_DEVICES) {
      setNotice({ text: "A project supports up to " + MAX_DEVICES + " devices.", error: true });
      return;
    }
    const added = makeDevice(project, kind, x, y);
    commit({ ...project, devices: [...project.devices, added] });
    setSelected(added.id);
    setPort(Object.keys(added.ports).find((p) => !["Console", "RS-232"].includes(p)) || "");
    setInspectorTab("ports");
    setNotice({ text: added.name + " added." });
  }
  function activateCable(next: CableChoice) {
    setMedium(next); setTool("connect"); setFirst(null); setPicker(""); setWorkspace("logical");
    setNotice({ text: "Select a device and its first port." });
  }
  function activateDevice(kind: Model) {
    setModel(kind); setTool("place"); setPicker(""); setFirst(null); setWorkspace("logical");
    setNotice({ text: "Click the canvas to place " + MODELS[kind].label.toLowerCase() + "." });
  }
  function choosePort(endpoint: Endpoint) {
    if (!first) {
      setFirst(endpoint);
      setPicker("");
      setNotice({ text: "Select the second device and port." });
      return;
    }
    try {
      commit(connect(project, first, endpoint, medium));
      clearPackets();
      setNotice({ text: first.device + " " + first.port + " connected to " + endpoint.device + " " + endpoint.port + "." });
      setFirst(null);
      setPicker("");
    } catch (error) { setNotice({ text: (error as Error).message, error: true }); }
  }
  function removeSelected() {
    if (!device) return;
    commit(deleteDevice(project, device.id)); select(""); setPicker(""); setFirst(null); clearPackets();
    setNotice({ text: device.name + " and its connections removed." });
  }
  function publish(trace: PacketEvent[], text: string, error = false) {
    setEvents(trace);
    setCursor(mode === "real-time" && trace.length ? 0 : -1);
    setPlaying(mode === "real-time" && trace.length > 1);
    setInspected(null); setFilter("All");
    setNotice(null); setOutcome({ text, error });
  }
  function send() {
    if (!from || !destination.trim()) return;
    const result = ping(project, from, destination);
    publish(result.events, result.message, !result.ok);
  }
  const menus: Record<string, { text: string; action: () => void; disabled?: boolean }[]> = {
    File: [
      { text: "New blank project", action: () => replace(emptyProject()) },
      { text: "Open project file…", action: () => fileRef.current?.click() },
      { text: "Save on this browser", action: () => save() },
      { text: "Export project JSON", action: () => save(true) },
    ],
    Edit: [
      { text: "Undo", action: undo, disabled: !history.previous.length },
      { text: "Redo", action: redo, disabled: !history.next.length },
      { text: "Delete selected device", action: removeSelected, disabled: !device },
    ],
    Options: [
      { text: grid ? "Hide canvas grid" : "Show canvas grid", action: () => setGrid(!grid) },
      { text: delay === 360 ? "Slow packet playback" : "Normal packet playback", action: () => setDelay(delay === 360 ? 800 : 360) },
    ],
    View: [
      { text: "Logical workspace", action: () => setWorkspace("logical") },
      { text: "Physical workspace", action: () => setWorkspace("physical") },
      { text: "Fit topology", action: () => setZoom(1) },
    ],
    Tools: [
      { text: "Select and move devices", action: () => { setTool("select"); setPicker(""); setFirst(null); } },
      { text: "Connect ports", action: () => activateCable("auto") },
      { text: "Send ping", action: () => document.getElementById("labnet-destination")?.focus() },
      { text: "Clear packet trace", action: clearPackets },
    ],
    Extensions: [
      ...SAMPLES.map((sample) => ({ text: sample.name, action: () => replace(buildSample(sample.id)) })),
      { text: "Open guided lab library", action: () => { window.location.assign("/networks/packet-tracer?guided=1"); } },
    ],
    Help: [{ text: "Workspace guide", action: () => setHelp(true) }],
  };

  function startMove(e: ReactPointerEvent<SVGGElement>, id: string) {
    if (e.button !== 0 || tool !== "select") return;
    const p = point(e.clientX, e.clientY), item = byId[id];
    dragRef.current = { id, before: project, x: p.x, y: p.y, dx: item.x - p.x, dy: item.y - p.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: ReactPointerEvent<SVGGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const p = point(e.clientX, e.clientY);
    if (!drag.moved && Math.hypot(p.x - drag.x, p.y - drag.y) < 5) return;
    drag.moved = true;
    setProject((current) => ({
      ...current,
      devices: current.devices.map((item) => item.id === drag.id ? {
        ...item, x: Math.max(48, Math.min(WORLD.width - 48, p.x + drag.dx)),
        y: Math.max(42, Math.min(WORLD.height - 57, p.y + drag.dy)),
      } : item),
    }));
  }
  function finishMove(e: ReactPointerEvent<SVGGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (drag.moved) addHistory(drag.before);
  }
  function drop(e: DragEvent<SVGSVGElement>) {
    e.preventDefault();
    const kind = e.dataTransfer.getData("application/x-labmate-network-device");
    if (!Object.prototype.hasOwnProperty.call(MODELS, kind)) return;
    const p = point(e.clientX, e.clientY);
    place(kind as Model, p.x, p.y);
    setTool("select");
  }
  function clickDevice(e: React.MouseEvent | React.KeyboardEvent, id: string) {
    e.stopPropagation();
    if (tool === "connect") {
      if (id !== first?.device) { setPicker(id); }
      else setNotice({ text: "Choose a different device for the other end.", error: true });
    } else select(id);
  }

  const canvasW = WORLD.width / zoom, canvasH = WORLD.height / zoom;
  const box = [(WORLD.width - canvasW) / 2, (WORLD.height - canvasH) / 2, canvasW, canvasH].join(" ");
  const hasActiveTrace = activeFrom && activeTo && activeFrom.id !== activeTo.id && currentEvent.protocol !== "System";

  return <main className={styles.studio} data-capture={capture || undefined} aria-busy={!ready} onKeyDown={(e) => {
    if (e.key === "Escape") {
      if (help) setHelp(false);
      else if (menu) setMenu("");
      else if (picker || tool !== "select") { setPicker(""); setFirst(null); setTool("select"); }
      else setInspected(null);
    }
  }}>
    <header className={styles.header}>
      <Link className={styles.brand} href="/labs" aria-label="Back to LabMate labs"><Network size={20} /> LabMate <span>Network Lab</span></Link>
      <nav className={styles.menus} aria-label="Application menus">
        {Object.entries(menus).map(([name, links]) => <div key={name} className={styles.menuWrap}>
          <button type="button" aria-expanded={menu === name} onClick={() => setMenu(menu === name ? "" : name)}>{name}</button>
          {menu === name && <div className={styles.menuPanel}>
            {links.map((item) => <button key={item.text} type="button" disabled={item.disabled} onClick={() => { setMenu(""); item.action(); }}>{item.text}</button>)}
          </div>}
        </div>)}
      </nav>
      <button type="button" aria-label="Open workspace guide" className={styles.headerHelp} onClick={() => setHelp(true)}><HelpCircle size={18} /></button>
    </header>
    <div className={styles.toolbar}>
      <input aria-label="Project name" value={project.name} maxLength={96} onChange={(e) => setProject({ ...project, name: e.target.value })}
        onBlur={() => { if (!project.name.trim()) setProject({ ...project, name: "Untitled topology" }); }} />
      <div role="group" aria-label="Project controls" className={styles.toolbarGroup}>
        <button type="button" title="New project" aria-label="New project" onClick={() => replace(emptyProject())}><FilePlus size={17} /></button>
        <button type="button" title="Open project" aria-label="Open project" onClick={() => fileRef.current?.click()}><FolderOpen size={17} /></button>
        <button type="button" title="Save project" aria-label="Save project" onClick={() => save()}><Save size={17} /></button>
        <button type="button" title="Export project" aria-label="Export project" onClick={() => save(true)}><ArrowDownToLine size={17} /></button>
        <input hidden ref={fileRef} type="file" accept=".json,.labnet.json,application/json" onChange={(e) => {
          const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void importFile(file);
        }} />
      </div>
      <div role="group" aria-label="Edit controls" className={styles.toolbarGroup}>
        <button type="button" title="Undo" aria-label="Undo" disabled={!history.previous.length} onClick={undo}><Undo2 size={17} /></button>
        <button type="button" title="Redo" aria-label="Redo" disabled={!history.next.length} onClick={redo}><Redo2 size={17} /></button>
        <button type="button" title="Delete selected device" aria-label="Delete selected device" disabled={!device} onClick={removeSelected}><Trash2 size={17} /></button>
      </div>
      <div className={styles.sampleMenu}>
        <button type="button" className={styles.sampleButton} aria-expanded={menu === "Samples"} onClick={() => setMenu(menu === "Samples" ? "" : "Samples")}>Sample topologies <ChevronDown size={16} /></button>
        {menu === "Samples" && <div className={styles.menuPanel}>
          {SAMPLES.map((sample) => <button key={sample.id} type="button" onClick={() => { setMenu(""); replace(buildSample(sample.id)); }}>
            {sample.name}<small>{sample.detail}</small>
          </button>)}
        </div>}
      </div>
    </div>

    <div className={styles.mainGrid}>
      <aside className={styles.library} aria-label="Device library">
        <h2>Device library</h2>
        <div role="group" aria-label="Device types" className={styles.groupPicker}>
          {GROUPS.map((item) => <button type="button" key={item} aria-pressed={group === item} onClick={() => setGroup(item)}>{item}</button>)}
        </div>
        <div className={styles.deviceShelf} role="group" aria-label={group + " devices"}>
          {(Object.keys(MODELS) as Model[]).filter((kind) => MODELS[kind].group === group).map((kind) => {
            const Icon = ICONS[kind];
            return <button type="button" key={kind} draggable aria-pressed={tool === "place" && model === kind}
              onDragStart={(e) => { e.dataTransfer.setData("application/x-labmate-network-device", kind); e.dataTransfer.effectAllowed = "copy"; }}
              onClick={() => activateDevice(kind)}>
              <Icon size={20} /><span>{MODELS[kind].label}</span>
            </button>;
          })}
        </div>
        <div className={styles.wirePicker}>
          <h2>Connections</h2>
          <label><Cable size={16} /><select aria-label="Connection type" value={medium} onChange={(e) => activateCable(e.target.value as CableChoice)}>
            {MEDIA.map((item) => <option key={item} value={item}>{CABLING[item]}</option>)}
          </select></label>
          <button type="button" aria-pressed={tool === "connect"} onClick={() => activateCable(medium)}>{tool === "connect" ? "Restart connection" : "Connect ports"}</button>
          {tool !== "select" && <button type="button" onClick={() => { setTool("select"); setPicker(""); setFirst(null); setNotice(null); }}>Return to select</button>}
          {tool === "place" && <button type="button" onClick={() => {
            const n = project.devices.length;
            place(model, 65 + (n % 8) * 117, 52 + Math.floor(n / 8) * 85);
            setTool("select");
          }}>Place on canvas</button>}
        </div>
      </aside>

      <section className={styles.stage} aria-label="Topology workspace">
        <div className={styles.stageHeader}>
          <div role="group" aria-label="Workspace views" className={styles.segmented}>
            <button type="button" aria-pressed={workspace === "logical"} onClick={() => setWorkspace("logical")}>Logical</button>
            <button type="button" aria-pressed={workspace === "physical"} onClick={() => setWorkspace("physical")}>Physical</button>
          </div>
          <div className={styles.zoom}>
            <button type="button" title="Zoom out" aria-label="Zoom out" disabled={workspace !== "logical" || zoom <= 1} onClick={() => setZoom(Math.max(1, zoom - 0.25))}><Minus size={15} /></button>
            <button type="button" title="Fit topology" aria-label="Fit topology" disabled={workspace !== "logical"} onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
            <button type="button" title="Zoom in" aria-label="Zoom in" disabled={workspace !== "logical" || zoom >= 2} onClick={() => setZoom(Math.min(2, zoom + 0.25))}><Plus size={15} /></button>
          </div>
        </div>
        {workspace === "logical" ? <div className={styles.canvasShell}>
          <svg ref={canvasRef} className={styles.canvas} viewBox={box} aria-label="Logical topology canvas"
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
            onDrop={drop} onClick={(e) => {
              setMenu("");
              if (tool === "place") { const p = point(e.clientX, e.clientY); place(model, p.x, p.y); }
              else if (tool === "select") select("");
            }}>
            <defs><pattern id={pattern} width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.1" fill="#c5d3d9" />
            </pattern></defs>
            <rect x="0" y="0" width={WORLD.width} height={WORLD.height} fill="transparent" />
            {grid && <rect x="0" y="0" width={WORLD.width} height={WORLD.height} fill={"url(#" + pattern + ")"} />}
            {project.cables.map((link) => {
              const a = byId[link.a.device], b = byId[link.b.device], up = linkUp(project, link);
              if (!a || !b) return null;
              const dashed = link.medium === "cross" || link.medium === "wireless";
              return <g key={link.id}>
                <title>{a.name + " " + link.a.port + " ↔ " + b.name + " " + link.b.port + " · " + CABLING[link.medium] + " · " + (up ? "Up" : "Down")}</title>
                <path d={"M " + a.x + " " + a.y + " L " + b.x + " " + b.y} strokeWidth="2.5" stroke={up ? STROKES[link.medium] : "#a9534a"}
                  strokeDasharray={dashed || !up ? "8 5" : undefined} />
                <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 10} textAnchor="middle" className={styles.linkLabel}>
                  {link.medium === "wireless" ? "Wi-Fi" : link.medium === "console" ? "Console" : up ? "Link up" : "Link down"}
                </text>
              </g>;
            })}
            {project.devices.map((item) => {
              const Icon = ICONS[item.model];
              return <g key={item.id} className={styles.node} data-active={selected === item.id || first?.device === item.id}
                tabIndex={0} role="button" aria-label={item.name + " " + MODELS[item.model].label}
                transform={"translate(" + item.x + " " + item.y + ")"}
                onPointerDown={(e) => startMove(e, item.id)} onPointerMove={move} onPointerUp={finishMove} onPointerCancel={finishMove}
                onClick={(e) => clickDevice(e, item.id)} onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clickDevice(e, item.id); }
                }}>
                <rect x="-35" y="-27" width="70" height="54" rx="11" />
                <g transform="translate(-13 -13)" pointerEvents="none"><Icon size={26} strokeWidth={1.65} /></g>
                <circle cx="25" cy="-17" r="3.6" fill={item.powered ? "#22a278" : "#90372e"} />
                <text y="48" textAnchor="middle">{item.name.length > 19 ? item.name.slice(0, 18) + "…" : item.name}</text>
                <text y="65" textAnchor="middle" className={styles.nodeSub}>{MODELS[item.model].label}</text>
              </g>;
            })}
            {hasActiveTrace && <g aria-hidden="true" pointerEvents="none">
              <line x1={activeFrom.x} y1={activeFrom.y} x2={activeTo.x} y2={activeTo.y} stroke="#0c8a77" strokeWidth="4" opacity=".65" />
              <circle key={inspected ?? cursor} cx={activeTo.x} cy={activeTo.y} r="8" fill="#086d60" stroke="white" strokeWidth="3">
                <animate attributeName="cx" from={activeFrom.x} to={activeTo.x} dur={(delay * 0.88) + "ms"} fill="freeze" />
                <animate attributeName="cy" from={activeFrom.y} to={activeTo.y} dur={(delay * 0.88) + "ms"} fill="freeze" />
              </circle>
            </g>}
          </svg>
          {!project.devices.length && <p className={styles.emptyCanvas}>Drag a device here or select one and click the canvas.</p>}
          <div className={styles.canvasCaption}><span>{project.devices.length} devices</span><span>{project.cables.filter((link) => linkUp(project, link)).length} / {project.cables.length} links up</span></div>
          {pointedDevice && <div className={styles.portPopover} role="dialog" aria-label="Select connection port">
            <div><strong>{pointedDevice.name} · Select port</strong><button type="button" aria-label="Close port picker" onClick={() => setPicker("")}><X size={16} /></button></div>
            {Object.entries(portKinds(pointedDevice)).filter(([, kind]) => kind !== "virtual").map(([name, kind]) => {
              const available = first ? compatibleMedia(byId[first.device], first.port, pointedDevice, name) : null;
              const wanted = medium !== "auto" ? medium : null;
              const incompatible = first ? !available || (wanted && wanted !== available) : wanted === "console" ? !["serial", "console"].includes(kind)
                : wanted === "fiber" ? kind !== "fiber" : wanted === "wireless" ? kind !== "radio" : wanted ? kind !== "copper" : false;
              const endpoint = { device: pointedDevice.id, port: name }, occupied = busyPort(project, endpoint);
              return <button type="button" key={name} disabled={Boolean(incompatible || occupied)} onClick={() => choosePort(endpoint)}>
                {name}<small>{occupied ? "Occupied" : kind}</small>
              </button>;
            })}
          </div>}
        </div> : <div className={styles.physical}>
          <h2>Device bench</h2><p>Select equipment to inspect its connectors and power state.</p>
          <div className={styles.bench}>
            {project.devices.map((item) => {
              const Icon = ICONS[item.model];
              return <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => select(item.id)}>
                <span><Icon size={18} /> <b>{item.name}</b> <small>{item.powered ? "Powered" : "Off"}</small></span>
                <div>{Object.keys(item.ports).filter((p) => p !== "LAN").map((p) => {
                  const up = project.cables.some((c) => [c.a, c.b].some((ep) => ep.device === item.id && ep.port === p) && linkUp(project, c));
                  return <span className={up ? styles.benchUp : styles.benchPort} key={p}><i />{p}</span>;
                })}</div>
              </button>;
            })}
            {!project.devices.length && <p>Add equipment in the Logical view to populate the bench.</p>}
          </div>
        </div>}
      </section>

      {device ? <NetworkDeviceInspector key={device.id + inspectorTab} device={device} project={project} selectedPort={port} onPort={setPort}
        initialTab={inspectorTab} close={() => select("")} remove={removeSelected} update={(next) => {
          commit(setDevice(project, next)); clearPackets(); setNotice({ text: "Settings applied for " + next.name + "." });
        }} disconnect={(id) => { commit({ ...project, cables: project.cables.filter((c) => c.id !== id) }); clearPackets(); setNotice({ text: "Connection removed." }); }}
        lease={(name) => {
          try { const result = dhcp(project, device.id, name); commit(result.project); publish(result.events, result.message); }
          catch (error) { setNotice({ text: (error as Error).message, error: true }); }
        }}
        commandResult={(next, trace, message) => {
          if (next) { commit(next); clearPackets(); }
          if (trace) publish(trace, message || "Command completed.", trace.some((item) => item.failed));
        }} openConsoleTarget={(id) => select(id, "terminal")} />
        : <aside className={styles.inspector} aria-label="Device inspector"><div className={styles.inspectorTitle}><div><small>Topology</small><h2>Inspector</h2></div><Cpu size={19} /></div>
          <p className={styles.inspectorEmpty}>Select a device to view its ports, settings, and terminal.</p></aside>}
    </div>

    <section className={styles.simulation} aria-label="Packet simulation">
      <div className={styles.simulationHeader}>
        <h2>Packet timeline</h2>
        <div role="group" aria-label="Execution mode" className={styles.segmented}>
          <button type="button" aria-pressed={mode === "real-time"} onClick={() => { setMode("real-time"); setInspected(null); if (events.length > 0 && cursor < events.length - 1) setPlaying(true); }}>Real-time</button>
          <button type="button" aria-pressed={mode === "simulation"} onClick={() => { setMode("simulation"); setPlaying(false); }}>Simulation</button>
        </div>
        <div className={styles.timelineControls}>
          <button type="button" aria-label={playing ? "Pause trace" : "Play trace"} disabled={!events.length} onClick={() => {
            if (!playing && cursor >= events.length - 1) setCursor(-1);
            setInspected(null);
            setPlaying(!playing);
          }}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
          <button type="button" aria-label="Step packet trace" disabled={!events.length || cursor >= events.length - 1}
            onClick={() => { setPlaying(false); setInspected(null); setCursor(cursor + 1); }}><SkipForward size={16} /></button>
          <button type="button" aria-label="Clear packet trace" disabled={!events.length} onClick={clearPackets}><RotateCcw size={16} /></button>
        </div>
      </div>
      <form className={styles.pingForm} onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label>Source<select value={from} onChange={(e) => setSource(e.target.value)}>
          {!endpoints.length && <option value="">No configured devices</option>}
          {endpoints.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label>Destination<input id="labnet-destination" value={destination} maxLength={96} onChange={(e) => setDestination(e.target.value)} placeholder="IPv4 or DNS name" /></label>
        <button className={styles.primary} type="submit" disabled={!from || !destination.trim()}>Send ping <ArrowRight size={15} /></button>
        <label className={styles.filter}>Protocol filter<select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          {PROTOCOLS.map((item) => <option key={item}>{item}</option>)}
        </select></label>
      </form>
      {shownNotice && <p className={shownNotice.error ? styles.errorNotice : styles.notice} role={shownNotice.error ? "alert" : "status"}>{shownNotice.text}</p>}
      <div className={styles.eventScroll} ref={eventRef}>
        {events.length ? <table><thead><tr><th>Step</th><th>Protocol</th><th>From</th><th>To</th><th>Event</th></tr></thead>
          <tbody>{events.map((item, index) => (filter === "All" || item.protocol === filter) && (index <= cursor) &&
            <tr key={index} aria-current={(inspected ?? cursor) === index ? "step" : undefined} data-failed={item.failed || undefined}>
              <td>{String(index + 1).padStart(2, "0")}</td><td><span className={styles.protocol}>{item.protocol}</span></td>
              <td>{byId[item.from]?.name ?? item.from}</td><td>{byId[item.to]?.name ?? item.to}</td>
              <td><button className={styles.eventLink} type="button" onClick={() => { setPlaying(false); setInspected(index); }}>{item.detail}</button></td>
            </tr>)}</tbody>
        </table> : null}
        {!events.length && <p>Send a ping or request DHCP to see packet events here.</p>}
        {events.length > 0 && cursor < 0 && <p>Trace queued. Press Play or Step to inspect the first packet.</p>}
        {events.length > 0 && cursor >= 0 && filter !== "All" && !events.slice(0, cursor + 1).some((item) => item.protocol === filter)
          && <p>No {filter} events in the displayed steps.</p>}
      </div>
      {inspected !== null && currentEvent && <aside className={styles.packetDetail} aria-label="Packet details">
        <div><strong>{currentEvent.protocol} · Step {inspected + 1}</strong><p>{currentEvent.detail}</p></div>
        <button type="button" onClick={() => setInspected(null)} aria-label="Close packet details"><X size={16} /></button>
      </aside>}
    </section>
    {help && <div className={styles.modalBackdrop} onClick={() => setHelp(false)}>
      <section className={styles.help} role="dialog" aria-modal="true" aria-label="Workspace guide" onClick={(e) => e.stopPropagation()}>
        <div><h2>Network Lab guide</h2><button type="button" aria-label="Close guide" onClick={() => setHelp(false)}><X size={18} /></button></div>
        <ol>
          <li>Open a sample topology or place equipment from the Device library.</li>
          <li>Choose a connection and select a port on each device. Enable router ports before sending traffic.</li>
          <li>Select equipment to set its IPv4 address, mask, gateway, and other settings. Each switch port can belong to one access VLAN.</li>
          <li>Send a ping. Simulation pauses at each step when you use Step. Open an event to inspect it.</li>
          <li>Use <b>Export project</b> to share a JSON file, then <b>Open project</b> to restore it.</li>
        </ol>
        <p>This is an IPv4 practice simulator. Wi-Fi uses a matching SSID, and DHCP serves its local broadcast domain.</p>
        <button type="button" className={styles.primary} onClick={() => setHelp(false)}>Back to workspace</button>
      </section>
    </div>}
  </main>;
}
