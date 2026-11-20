"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  defaultServerServices,
  executeIosCommand,
  executePcCommand,
  getDevicePorts,
  iosPrompt,
  resolveDnsName,
  syntheticMac,
  type IosSessionState,
} from "@/lib/netlab/ptEngine";
import type { PtDevice, PtSpec } from "@/lib/netlab/ptTypes";
import {
  PtAppBrowserIcon,
  PtAppCmdIcon,
  PtAppIpConfigIcon,
  PtAppTerminalIcon,
  PtAppWirelessIcon,
} from "./PacketTracerIcons";
import styles from "./packetTracer.module.css";

export type ModalTab = "Physical" | "Config" | "CLI" | "Desktop" | "Services" | "Attributes";
type DesktopApp = "grid" | "ipconfig" | "cmd" | "terminal" | "browser" | "wireless";

interface PtDeviceModalProps {
  spec: PtSpec;
  device: PtDevice;
  initialTab?: ModalTab;
  initialConfigSection?: string;
  onUpdateDevice: (updated: PtDevice) => void;
  onUpdatePeerDevice?: (updated: PtDevice) => void;
  onClose: () => void;
}

const PHYSICAL_MODULES: Record<string, { desc: string; ports: string; addedPorts: string[] }> = {
  "HWIC-2T": {
    desc: "The HWIC-2T provides two high-speed serial ports with Smart Serial connectors for WAN connectivity.",
    ports: "2x Serial",
    addedPorts: ["Serial0/1/0", "Serial0/1/1"],
  },
  "NM-1FE-TX": {
    desc: "Single-port 10/100BASE-TX FastEthernet network module for IEEE 802.3u copper LAN links.",
    ports: "1x FastEthernet",
    addedPorts: ["FastEthernet1/0"],
  },
  "PT-COVER": {
    desc: "Blank EMI shield cover plate installed in unused WIC/HWIC chassis expansion slots.",
    ports: "Blank Plate",
    addedPorts: [],
  },
  "WIC-1ENET": {
    desc: "Single-port 10Mbps Ethernet WAN interface card for legacy RJ-45 LAN/WAN uplinks.",
    ports: "1x Ethernet",
    addedPorts: ["Ethernet0/1/0"],
  },
};

export function PtDeviceModal({
  spec,
  device,
  initialTab,
  initialConfigSection,
  onUpdateDevice,
  onUpdatePeerDevice,
  onClose,
}: PtDeviceModalProps) {
  const isNetworkCli = ["router", "switch", "security"].includes(device.type);
  const isEnd = ["pc", "laptop", "server", "tablet", "smartphone", "printer"].includes(device.type);
  const isServer = device.type === "server";
  const isWirelessClient = ["laptop", "tablet", "smartphone"].includes(device.type);
  const tabId = useId();

  const tabs: ModalTab[] = useMemo(() => {
    if (isServer) return ["Physical", "Config", "Services", "Desktop", "Attributes"];
    if (isEnd) return ["Physical", "Config", "Desktop", "Attributes"];
    if (isNetworkCli) return ["Physical", "Config", "CLI", "Attributes"];
    return ["Physical", "Config", "Attributes"];
  }, [isServer, isEnd, isNetworkCli]);

  const fallbackTab: ModalTab = isNetworkCli ? "Config" : isEnd ? "Desktop" : "Config";
  const resolvedInitialTab = initialTab && tabs.includes(initialTab) ? initialTab : fallbackTab;

  const [tab, setTab] = useState<ModalTab>(resolvedInitialTab);
  const [configSection, setConfigSection] = useState<string>(initialConfigSection || "Settings");
  const [selectedModule, setSelectedModule] = useState<string>("HWIC-2T");
  const [physicalZoom, setPhysicalZoom] = useState<number>(1);
  const [moduleWarning, setModuleWarning] = useState<string>("");

  // Draggable window offset + Always on Top state
  const [pinnedTop, setPinnedTop] = useState<boolean>(false);
  const [winOffset, setWinOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragWinRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    const onMove = (ev: MouseEvent) => {
      if (!dragWinRef.current) return;
      const d = dragWinRef.current;
      setWinOffset({
        x: Math.max(-420, Math.min(420, d.origX + (ev.clientX - d.startX))),
        y: Math.max(-240, Math.min(240, d.origY + (ev.clientY - d.startY))),
      });
    };
    const onUp = () => {
      dragWinRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Desktop apps state
  const [desktopApp, setDesktopApp] = useState<DesktopApp>("grid");
  const [cmdLines, setCmdLines] = useState<string[]>(["Cisco Packet Tracer PC Command Line 1.0", ""]);
  const [cmdInput, setCmdInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [cmdHistIdx, setCmdHistIdx] = useState<number>(-1);
  const [browserUrl, setBrowserUrl] = useState("http://192.168.1.100");
  const [browserHtml, setBrowserHtml] = useState<string>("");

  // RS232 Terminal over Console cable
  const [termConnected, setTermConnected] = useState(false);
  const [termSession, setTermSession] = useState<IosSessionState>({
    priv: false,
    configMode: false,
    iface: null,
    ripMode: false,
  });
  const [termLines, setTermLines] = useState<string[]>([]);
  const [termInput, setTermInput] = useState("");

  // CLI state (with Up/Down command history)
  const [iosSession, setIosSession] = useState<IosSessionState>({
    priv: false,
    configMode: false,
    iface: null,
    ripMode: false,
  });
  const [cliLines, setCliLines] = useState<string[]>([
    `Cisco IOS Software, ${device.model || "PT"} Software, Experimental Simulation`,
    "Type 'enable' or '?' for available commands.",
    "",
  ]);
  const [cliInput, setCliInput] = useState("");
  const [cliHistory, setCliHistory] = useState<string[]>([]);
  const [cliHistIdx, setCliHistIdx] = useState<number>(-1);
  const [iosEcho, setIosEcho] = useState<string[]>([]);

  // Config subform inputs
  const [ripInput, setRipInput] = useState("");
  const [staticNet, setStaticNet] = useState("");
  const [staticMask, setStaticMask] = useState("255.255.255.0");
  const [staticHop, setStaticHop] = useState("");
  const [vlanIdInput, setVlanIdInput] = useState("");
  const [vlanNameInput, setVlanNameInput] = useState("");
  const [dnsNameInput, setDnsNameInput] = useState("");
  const [dnsIpInput, setDnsIpInput] = useState("");

  const cliInputRef = useRef<HTMLInputElement>(null);
  const cmdInputRef = useRef<HTMLInputElement>(null);
  const termInputRef = useRef<HTMLInputElement>(null);

  const ports = useMemo(() => getDevicePorts(device).filter((p) => p !== "Console" && p !== "RS 232"), [device]);
  const services = device.services ?? defaultServerServices();

  const consoleTarget = useMemo(() => {
    const link = spec.links.find(
      (l) =>
        (l.cable === "console" || l.ap === "Console" || l.bp === "Console") &&
        (l.a === device.name || l.b === device.name),
    );
    if (!link) return null;
    const peerName = link.a === device.name ? link.b : link.a;
    return spec.devices.find((d) => d.name === peerName) ?? null;
  }, [spec, device.name]);

  const wirelessAps = useMemo(
    () => spec.devices.filter((d) => d.type === "wireless" && d.power !== false),
    [spec.devices],
  );

  const handleRunIos = () => {
    const line = cliInput;
    const promptStr = iosPrompt(device, iosSession);
    const res = executeIosCommand(spec, device.name, line, iosSession);
    setCliLines((prev) => [...prev, `${promptStr}${line}`, ...res.output]);
    setIosSession(res.nextSession);
    if (res.updatedDevice) onUpdateDevice(res.updatedDevice);
    if (line.trim()) {
      setCliHistory((prev) => [...prev, line]);
      setCliHistIdx(-1);
    }
    setCliInput("");
  };

  const handleRunCmd = () => {
    const line = cmdInput;
    if (line.trim()) {
      setCmdHistory((prev) => [...prev, line]);
      setCmdHistIdx(-1);
    }
    if (line.trim().toLowerCase() === "cls") {
      setCmdLines([]);
      setCmdInput("");
      return;
    }
    const out = executePcCommand(spec, device.name, line);
    setCmdLines((prev) => [...prev, `C:\\>${line}`, ...out]);
    setCmdInput("");
  };

  const handleOpenTerminal = () => {
    setTermConnected(false);
    setDesktopApp("terminal");
  };

  const handleConnectTerminal = () => {
    if (!consoleTarget || consoleTarget.power === false) {
      setTermConnected(false);
      return;
    }
    setTermConnected(true);
    setTermSession({ priv: false, configMode: false, iface: null, ripMode: false });
    setTermLines([
      `Serial Console connected (9600-8-N-1) -> ${consoleTarget.name}`,
      `Cisco IOS Software, ${consoleTarget.model || "1941"} Software`,
      "Type 'enable' or '?' for available commands.",
      "",
    ]);
  };

  const handleRunTermIos = () => {
    if (!consoleTarget) return;
    const line = termInput;
    const promptStr = iosPrompt(consoleTarget, termSession);
    const res = executeIosCommand(spec, consoleTarget.name, line, termSession);
    setTermLines((prev) => [...prev, `${promptStr}${line}`, ...res.output]);
    setTermSession(res.nextSession);
    if (res.updatedDevice && onUpdatePeerDevice) {
      onUpdatePeerDevice(res.updatedDevice);
    }
    setTermInput("");
  };

  const handleBrowserGo = () => {
    const cleanHost = browserUrl.replace(/^https?:\/\//i, "").split("/")[0].trim();
    const resolvedIp = resolveDnsName(spec, device, cleanHost) ?? cleanHost;
    const srv = spec.devices.find(
      (d) =>
        d.type === "server" &&
        d.power !== false &&
        (d.ip === resolvedIp || Object.values(d.interfaces ?? {}).some((c) => c.ip === resolvedIp)),
    );
    if (!srv) {
      setBrowserHtml(`<p style="color:#b91c1c"><b>Host Name Unresolved / Request Timeout:</b> Could not reach <code>${cleanHost}</code>.</p>`);
      return;
    }
    const srvSvc = srv.services ?? defaultServerServices();
    if (!srvSvc.httpEnabled) {
      setBrowserHtml(`<p style="color:#b91c1c"><b>Connection Refused:</b> HTTP service is turned OFF on ${srv.name}.</p>`);
      return;
    }
    setBrowserHtml(srvSvc.httpHtml);
  };

  const handleInsertModule = () => {
    if (device.power !== false) {
      setModuleWarning("Cannot add a module when the power is on.");
      return;
    }
    const meta = PHYSICAL_MODULES[selectedModule];
    if (!meta) return;
    setModuleWarning("");
    const nextIfaces = { ...(device.interfaces ?? {}) };
    meta.addedPorts.forEach((p) => {
      if (!nextIfaces[p]) {
        nextIfaces[p] = { ip: "", mask: "255.255.255.0", shutdown: device.type === "router" };
      }
    });
    onUpdateDevice({
      ...device,
      installedModules: [...(device.installedModules ?? []), selectedModule],
      interfaces: nextIfaces,
    });
  };

  const updateIface = (port: string, patch: Partial<{ ip: string; mask: string; shutdown: boolean; vlan: number }>) => {
    const cur = device.interfaces?.[port] ?? { ip: "", mask: "255.255.255.0", shutdown: false };
    const nextIf = { ...cur, ...patch };
    const updated: PtDevice = {
      ...device,
      interfaces: { ...(device.interfaces ?? {}), [port]: nextIf },
    };
    onUpdateDevice(updated);
    const echo = [`${device.hostname || device.name}(config)#interface ${port}`];
    if (patch.ip !== undefined || patch.mask !== undefined) {
      echo.push(`${device.hostname || device.name}(config-if)#ip address ${nextIf.ip || "<unset>"} ${nextIf.mask || "<unset>"}`);
    }
    if (patch.shutdown !== undefined) {
      echo.push(`${device.hostname || device.name}(config-if)#${patch.shutdown ? "shutdown" : "no shutdown"}`);
    }
    if (patch.vlan !== undefined) {
      echo.push(`${device.hostname || device.name}(config-if)#switchport access vlan ${patch.vlan}`);
    }
    setIosEcho((prev) => [...prev.slice(-4), ...echo]);
  };

  const selectedPort = configSection.startsWith("iface:") ? configSection.slice(6) : "";
  const ifaceCfg = selectedPort ? device.interfaces?.[selectedPort] ?? { ip: "", mask: "255.255.255.0", shutdown: false, vlan: 1 } : null;

  const vlanOptions = useMemo(() => {
    const map = new Map<number, string>();
    map.set(1, "default");
    (device.vlans ?? []).forEach((v) => map.set(v.id, v.name));
    Object.values(device.interfaces ?? {}).forEach((cfg) => {
      if (cfg.vlan && !map.has(cfg.vlan)) map.set(cfg.vlan, `VLAN${String(cfg.vlan).padStart(4, "0")}`);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [device.vlans, device.interfaces]);

  return (
    <div
      className={styles.ptDialogBackdrop}
      style={{ zIndex: pinnedTop ? 95 : 75 }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`${device.name} Configuration`}
        aria-modal="true"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        onClick={(e) => e.stopPropagation()}
        className={styles.ptDialog}
        style={{
          width: 780,
          maxWidth: "95vw",
          height: 560,
          maxHeight: "90vh",
          transform: `translate(${winOffset.x}px, ${winOffset.y}px)`,
        }}
      >
        {/* Title Bar (Draggable Light Qt Chrome) */}
        <div
          className={styles.ptDialogHeader}
          onMouseDown={(e) => {
            dragWinRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              origX: winOffset.x,
              origY: winOffset.y,
            };
          }}
        >
          <span>
            {device.name} {device.model ? `(${device.model})` : ""}
          </span>
          <div className={styles.ptDialogHeaderControls} onMouseDown={(e) => e.stopPropagation()}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 400, cursor: "pointer" }}>
              <input type="checkbox" checked={pinnedTop} onChange={(e) => setPinnedTop(e.target.checked)} />
              <span>Top</span>
            </label>
            <button
              type="button"
              onClick={onClose}
              className={styles.ptDialogCloseBtn}
              aria-label="Close device window"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Packet Tracer Tabs Row */}
        <div
          role="tablist"
          aria-label="Device configuration views"
          onKeyDown={(event) => {
            const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
            if (!offset && event.key !== "Home" && event.key !== "End") return;
            event.preventDefault();
            const index =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? tabs.length - 1
                  : (tabs.indexOf(tab) + offset + tabs.length) % tabs.length;
            setTab(tabs[index]);
            event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]")[index]?.focus();
          }}
          className={styles.ptDialogTabs}
        >
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={tabId + "-" + t}
              aria-selected={tab === t}
              aria-controls={tabId + "-panel"}
              tabIndex={tab === t ? 0 : -1}
              onClick={() => setTab(t)}
              className={`${styles.ptDialogTab} ${tab === t ? styles.ptDialogTabActive : ""}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div
          role="tabpanel"
          id={tabId + "-panel"}
          aria-labelledby={tabId + "-" + tab}
          style={{ flex: 1, minHeight: 0, background: "#f5f7fa", padding: 10, display: "flex", flexDirection: "column", overflow: "hidden" }}
        >
          {/* ==============================================================
           * TAB 1: PHYSICAL DEVICE VIEW (Brushed Metal + Power Guard + Modules)
           * ============================================================== */}
          {tab === "Physical" && (
            <div style={{ flex: 1, display: "flex", gap: 10, minHeight: 0 }}>
              <div style={{ width: 195, display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}>
                <div style={{ flex: 1, background: "#ffffff", border: "1px solid #c5cbd3", padding: 6, overflow: "auto" }}>
                  <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, color: "#1e293b", borderBottom: "1px solid #e2e8f0", paddingBottom: 3 }}>
                    MODULES
                  </div>
                  {Object.keys(PHYSICAL_MODULES).map((mod) => {
                    const active = selectedModule === mod;
                    return (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => {
                          setSelectedModule(mod);
                          setModuleWarning("");
                        }}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          width: "100%",
                          textAlign: "left",
                          padding: "4px 6px",
                          border: active ? "1px solid #0078d4" : "1px solid #e2e8f0",
                          marginBottom: 4,
                          background: active ? "#dbeafe" : "#f8fafc",
                          fontSize: 11,
                          fontWeight: active ? 600 : 400,
                          cursor: "pointer",
                        }}
                      >
                        <span>{mod}</span>
                        <span style={{ color: "#64748b", fontSize: 10 }}>{PHYSICAL_MODULES[mod].ports}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ height: 120, background: "#ffffff", border: "1px solid #c5cbd3", padding: 8, fontSize: 10.5, color: "#334155", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div style={{ overflow: "auto" }}>
                    <div style={{ fontWeight: 700, marginBottom: 3, color: "#0f172a" }}>{selectedModule}</div>
                    <div>{PHYSICAL_MODULES[selectedModule]?.desc}</div>
                  </div>
                  <button type="button" className={styles.ptQtBtn} onClick={handleInsertModule}>
                    Insert Module
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#e8ecf1", border: "1px solid #c5cbd3", padding: "4px 8px" }}>
                  <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 11.5 }}>Physical Device View</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      type="button"
                      className={styles.ptQtBtn}
                      style={{ height: 21, padding: "0 8px", fontSize: 11 }}
                      onClick={() => setPhysicalZoom((z) => Math.min(1.25, Number((z + 0.1).toFixed(2))))}
                    >
                      Zoom In
                    </button>
                    <button
                      type="button"
                      className={styles.ptQtBtn}
                      style={{ height: 21, padding: "0 8px", fontSize: 11 }}
                      onClick={() => setPhysicalZoom(1)}
                    >
                      Original Size
                    </button>
                    <button
                      type="button"
                      className={styles.ptQtBtn}
                      style={{ height: 21, padding: "0 8px", fontSize: 11 }}
                      onClick={() => setPhysicalZoom((z) => Math.max(0.8, Number((z - 0.1).toFixed(2))))}
                    >
                      Zoom Out
                    </button>
                  </div>
                </div>

                {moduleWarning && (
                  <div
                    role="alert"
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #ef4444",
                      color: "#991b1b",
                      padding: "5px 9px",
                      fontSize: 11.5,
                      fontWeight: 600,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>{moduleWarning}</span>
                    <button type="button" onClick={() => setModuleWarning("")} style={{ background: "none", border: "none", color: "#991b1b", cursor: "pointer" }}>
                      ✕
                    </button>
                  </div>
                )}

                {/* Brushed-Metal Faceplate */}
                <div style={{ flex: 1, background: "#dde3ea", border: "1px solid #c5cbd3", padding: 14, overflow: "auto", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div
                    style={{
                      transform: `scale(${physicalZoom})`,
                      transformOrigin: "center center",
                      background: "linear-gradient(180deg, #cfd4da 0%, #aeb5bd 45%, #8c939b 100%)",
                      border: "2px solid #596069",
                      borderRadius: 3,
                      padding: "14px 16px",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65), 0 4px 12px rgba(0,0,0,0.18)",
                      color: "#111827",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #6b7280", paddingBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ background: "#005073", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 6px", letterSpacing: 0.8, borderRadius: 2 }}>
                          CISCO
                        </span>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#1f2937", letterSpacing: 0.5 }}>
                          {device.model || device.type.toUpperCase()} {isNetworkCli ? "Series" : ""}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: device.power === false ? "#4b5563" : "#22c55e",
                            boxShadow: device.power === false ? "none" : "0 0 6px #22c55e",
                            border: "1px solid #1f2937",
                          }}
                        />
                        <span>SYS PWR</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      {device.type === "router" && (
                        <div style={{ background: "#4b5563", border: "1px solid #1f2937", padding: "6px 8px", borderRadius: 2, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d1d5db", border: "1px solid #111827" }} />
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: 9, color: "#f9fafb", fontWeight: 700 }}>
                              {device.installedModules?.length ? device.installedModules[device.installedModules.length - 1] : selectedModule} BAY
                            </span>
                            <div style={{ display: "flex", gap: 4 }}>
                              <div style={{ width: 28, height: 11, background: "#0f172a", border: "1px solid #9ca3af", fontSize: 8, color: "#93c5fd", textAlign: "center", lineHeight: "10px" }}>S0/0/0</div>
                              <div style={{ width: 28, height: 11, background: "#0f172a", border: "1px solid #9ca3af", fontSize: 8, color: "#93c5fd", textAlign: "center", lineHeight: "10px" }}>S0/0/1</div>
                            </div>
                          </div>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d1d5db", border: "1px solid #111827" }} />
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
                        {isNetworkCli && (
                          <>
                            <div style={{ background: "#2c313a", border: "1px solid #111827", padding: "4px 6px", borderRadius: 2, textAlign: "center" }}>
                              <div style={{ width: 16, height: 11, background: "#06b6d4", border: "1px solid #0e7490", margin: "0 auto 3px" }} />
                              <div style={{ fontSize: 8.5, color: "#67e8f9", fontWeight: 700 }}>CONSOLE</div>
                            </div>
                            <div style={{ background: "#2c313a", border: "1px solid #111827", padding: "4px 6px", borderRadius: 2, textAlign: "center" }}>
                              <div style={{ width: 16, height: 11, background: "#0ea5e9", border: "1px solid #0369a1", margin: "0 auto 3px" }} />
                              <div style={{ fontSize: 8.5, color: "#bae6fd", fontWeight: 700 }}>AUX</div>
                            </div>
                          </>
                        )}
                        {ports.slice(0, 6).map((p) => (
                          <div
                            key={p}
                            style={{
                              padding: "4px 6px",
                              background: "#262b33",
                              border: "1px solid #111827",
                              borderRadius: 2,
                              fontSize: 9,
                              color: "#f1f5f9",
                              textAlign: "center",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 3 }}>
                              <span
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: "50%",
                                  background: device.power === false ? "#4b5563" : "#22c55e",
                                }}
                              />
                              <div style={{ width: 16, height: 11, background: "#030712", border: "1px solid #9ca3af" }} />
                            </div>
                            <span>{p.replace("FastEthernet", "Fa").replace("GigabitEthernet", "Gi")}</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ textAlign: "center", background: "#374151", border: "1px solid #111827", padding: "5px 8px", borderRadius: 2, color: "#f9fafb" }}>
                        <div style={{ fontSize: 8.5, marginBottom: 4, letterSpacing: 0.5, fontWeight: 700 }}>POWER</div>
                        <button
                          type="button"
                          aria-label="Power switch"
                          onClick={() => {
                            setModuleWarning("");
                            onUpdateDevice({ ...device, power: device.power === false ? true : false });
                          }}
                          style={{
                            width: 34,
                            height: 28,
                            borderRadius: 2,
                            border: "1px solid #030712",
                            background: device.power === false ? "linear-gradient(180deg, #1f2937 0%, #111827 100%)" : "linear-gradient(180deg, #111827 0%, #374151 100%)",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: 10,
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "2px 0",
                          }}
                        >
                          <span style={{ color: device.power === false ? "#6b7280" : "#22c55e" }}>I</span>
                          <span style={{ color: device.power === false ? "#ef4444" : "#6b7280" }}>O</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ background: "#fff", border: "1px solid #c5cbd3", padding: "6px 10px", fontSize: 11, color: "#334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>
                    <strong>Chassis Status:</strong> Power is{" "}
                    <strong style={{ color: device.power === false ? "#b91c1c" : "#15803d" }}>
                      {device.power === false ? "OFF (ports inactive)" : "ON"}
                    </strong>{" "}
                    — Turn power OFF before inserting expansion modules.
                  </span>
                  <span style={{ color: "#64748b", fontSize: 10.5 }}>
                    Installed: {device.installedModules?.length ? device.installedModules.join(", ") : "Stock chassis"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
           * TAB 2: CONFIG (Settings, VLAN Database, Routing Static/RIP, Interfaces)
           * ============================================================== */}
          {tab === "Config" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
              <div style={{ flex: 1, display: "flex", gap: 10, minHeight: 0 }}>
                <div style={{ width: 185, background: "#ffffff", border: "1px solid #cbd5e1", overflow: "auto", padding: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: "#475569", padding: "3px 6px" }}>GLOBAL</div>
                  <button
                    type="button"
                    onClick={() => setConfigSection("Settings")}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "4px 10px",
                      border: "none",
                      background: configSection === "Settings" ? "#dbeafe" : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    Settings
                  </button>

                  {device.type === "switch" && (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 11, color: "#475569", padding: "6px 6px 3px" }}>SWITCHING</div>
                      <button
                        type="button"
                        onClick={() => setConfigSection("VLAN")}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "4px 10px",
                          border: "none",
                          background: configSection === "VLAN" ? "#dbeafe" : "transparent",
                          cursor: "pointer",
                        }}
                      >
                        VLAN Database
                      </button>
                    </>
                  )}

                  {device.type === "router" && (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 11, color: "#475569", padding: "6px 6px 3px" }}>ROUTING</div>
                      {["Static", "RIP"].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setConfigSection(sec)}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "4px 10px",
                            border: "none",
                            background: configSection === sec ? "#dbeafe" : "transparent",
                            cursor: "pointer",
                          }}
                        >
                          {sec}
                        </button>
                      ))}
                    </>
                  )}

                  <div style={{ fontWeight: 700, fontSize: 11, color: "#475569", padding: "6px 6px 3px" }}>INTERFACE</div>
                  {ports.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setConfigSection(`iface:${p}`)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "4px 10px",
                        border: "none",
                        background: configSection === `iface:${p}` ? "#dbeafe" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div style={{ flex: 1, background: "#ffffff", border: "1px solid #cbd5e1", padding: 12, overflow: "auto" }}>
                  {configSection === "Settings" && (
                    <div style={{ display: "grid", gap: 10, maxWidth: 430 }}>
                      <h4 style={{ margin: 0 }}>Global Settings</h4>
                      <label style={{ display: "grid", gridTemplateColumns: "130px 1fr", alignItems: "center", gap: 8 }}>
                        <span>Display Name</span>
                        <input
                          value={device.name}
                          onChange={(e) => onUpdateDevice({ ...device, name: e.target.value })}
                          style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }}
                        />
                      </label>
                      {isNetworkCli && (
                        <label style={{ display: "grid", gridTemplateColumns: "130px 1fr", alignItems: "center", gap: 8 }}>
                          <span>Hostname</span>
                          <input
                            value={device.hostname || device.name}
                            onChange={(e) => onUpdateDevice({ ...device, hostname: e.target.value })}
                            style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }}
                          />
                        </label>
                      )}
                      {device.type === "wireless" && (
                        <label style={{ display: "grid", gridTemplateColumns: "130px 1fr", alignItems: "center", gap: 8 }}>
                          <span>Wireless SSID</span>
                          <input
                            value={device.ssid || "LabMate Wi-Fi"}
                            onChange={(e) => onUpdateDevice({ ...device, ssid: e.target.value })}
                            style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }}
                          />
                        </label>
                      )}
                      {isEnd && (
                        <>
                          <label style={{ display: "grid", gridTemplateColumns: "130px 1fr", alignItems: "center", gap: 8 }}>
                            <span>Default Gateway</span>
                            <input
                              value={device.gateway || ""}
                              onChange={(e) => onUpdateDevice({ ...device, gateway: e.target.value })}
                              placeholder="192.168.1.1"
                              style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }}
                            />
                          </label>
                          <label style={{ display: "grid", gridTemplateColumns: "130px 1fr", alignItems: "center", gap: 8 }}>
                            <span>DNS Server</span>
                            <input
                              value={device.dns || ""}
                              onChange={(e) => onUpdateDevice({ ...device, dns: e.target.value })}
                              placeholder="192.168.1.254"
                              style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }}
                            />
                          </label>
                        </>
                      )}
                    </div>
                  )}

                  {configSection === "VLAN" && device.type === "switch" && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <h4 style={{ margin: 0 }}>VLAN Database</h4>
                      <div style={{ display: "grid", gridTemplateColumns: "110px 1fr auto", gap: 6 }}>
                        <input
                          placeholder="VLAN Number"
                          value={vlanIdInput}
                          onChange={(e) => setVlanIdInput(e.target.value)}
                          style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }}
                        />
                        <input
                          placeholder="VLAN Name (e.g. Sales)"
                          value={vlanNameInput}
                          onChange={(e) => setVlanNameInput(e.target.value)}
                          style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }}
                        />
                        <button
                          type="button"
                          className={styles.ptQtBtn}
                          onClick={() => {
                            const vid = Number(vlanIdInput);
                            if (!Number.isInteger(vid) || vid < 2 || vid > 4094) return;
                            const vname = vlanNameInput.trim() || `VLAN${String(vid).padStart(4, "0")}`;
                            const existing = device.vlans ?? [];
                            const nextVlans = existing.some((v) => v.id === vid)
                              ? existing.map((v) => (v.id === vid ? { id: vid, name: vname } : v))
                              : [...existing, { id: vid, name: vname }];
                            onUpdateDevice({ ...device, vlans: nextVlans });
                            setIosEcho((prev) => [...prev.slice(-3), `${device.hostname || device.name}(config)#vlan ${vid}`, `${device.hostname || device.name}(config-vlan)#name ${vname}`]);
                            setVlanIdInput("");
                            setVlanNameInput("");
                          }}
                        >
                          Add
                        </button>
                      </div>
                      <div style={{ border: "1px solid #cbd5e1", minHeight: 120, padding: 6 }}>
                        {vlanOptions.map(([vid, vname]) => (
                          <div key={vid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 6px", borderBottom: "1px solid #f1f5f9" }}>
                            <span>
                              <b>{vid}</b> : {vname}
                            </span>
                            {vid !== 1 && (
                              <button
                                type="button"
                                className={styles.ptQtBtn}
                                style={{ height: 20, padding: "0 8px", fontSize: 10.5 }}
                                onClick={() =>
                                  onUpdateDevice({
                                    ...device,
                                    vlans: (device.vlans ?? []).filter((v) => v.id !== vid),
                                  })
                                }
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {configSection === "RIP" && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <h4 style={{ margin: 0 }}>RIP Routing</h4>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          placeholder="Network e.g. 192.168.1.0"
                          value={ripInput}
                          onChange={(e) => setRipInput(e.target.value)}
                          style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px", flex: 1 }}
                        />
                        <button
                          type="button"
                          className={styles.ptQtBtn}
                          onClick={() => {
                            if (!ripInput.trim()) return;
                            onUpdateDevice({ ...device, rip: Array.from(new Set([...(device.rip ?? []), ripInput.trim()])) });
                            setIosEcho((prev) => [...prev.slice(-3), `${device.hostname || device.name}(config-router)#network ${ripInput.trim()}`]);
                            setRipInput("");
                          }}
                        >
                          Add
                        </button>
                      </div>
                      <div style={{ border: "1px solid #cbd5e1", minHeight: 110, padding: 6 }}>
                        {(device.rip ?? []).map((n) => (
                          <div key={n} style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px" }}>
                            <span>{n}</span>
                            <button
                              type="button"
                              className={styles.ptQtBtn}
                              style={{ height: 20, padding: "0 8px", fontSize: 10.5 }}
                              onClick={() => onUpdateDevice({ ...device, rip: (device.rip ?? []).filter((x) => x !== n) })}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {configSection === "Static" && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <h4 style={{ margin: 0 }}>Static Routes</h4>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 5 }}>
                        <input placeholder="Network" value={staticNet} onChange={(e) => setStaticNet(e.target.value)} style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }} />
                        <input placeholder="Mask" value={staticMask} onChange={(e) => setStaticMask(e.target.value)} style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }} />
                        <input placeholder="Next Hop" value={staticHop} onChange={(e) => setStaticHop(e.target.value)} style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }} />
                        <button
                          type="button"
                          className={styles.ptQtBtn}
                          onClick={() => {
                            if (!staticNet.trim() || !staticHop.trim()) return;
                            onUpdateDevice({
                              ...device,
                              staticRoutes: [...(device.staticRoutes ?? []), { network: staticNet.trim(), mask: staticMask.trim(), nextHop: staticHop.trim() }],
                            });
                            setStaticNet("");
                            setStaticHop("");
                          }}
                        >
                          Add
                        </button>
                      </div>
                      <div style={{ border: "1px solid #cbd5e1", minHeight: 100, padding: 6 }}>
                        {(device.staticRoutes ?? []).map((sr, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px" }}>
                            <span>
                              {sr.network} / {sr.mask} via {sr.nextHop}
                            </span>
                            <button
                              type="button"
                              className={styles.ptQtBtn}
                              style={{ height: 20, padding: "0 8px", fontSize: 10.5 }}
                              onClick={() =>
                                onUpdateDevice({
                                  ...device,
                                  staticRoutes: (device.staticRoutes ?? []).filter((_, idx) => idx !== i),
                                })
                              }
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {ifaceCfg && (
                    <div style={{ display: "grid", gap: 10, maxWidth: 430 }}>
                      <h4 style={{ margin: 0 }}>{selectedPort}</h4>
                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={!ifaceCfg.shutdown}
                          onChange={(e) => updateIface(selectedPort, { shutdown: !e.target.checked })}
                        />
                        <span>Port Status: On</span>
                      </label>
                      <div style={{ fontSize: 11.5, color: "#475569" }}>
                        MAC Address: <code>{ifaceCfg.mac || syntheticMac(device.name, selectedPort)}</code>
                      </div>
                      {device.type === "switch" ? (
                        <label style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8 }}>
                          <span>VLAN (Access)</span>
                          <select
                            value={String(ifaceCfg.vlan ?? 1)}
                            onChange={(e) => updateIface(selectedPort, { vlan: Number(e.target.value) })}
                            style={{ height: 24, border: "1px solid #94a3b8", background: "#ffffff", padding: "0 6px" }}
                          >
                            {vlanOptions.map(([vid, vname]) => (
                              <option key={vid} value={String(vid)}>
                                {vid}: {vname}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <>
                          <label style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8 }}>
                            <span>IPv4 Address</span>
                            <input
                              value={isEnd ? device.ip || ifaceCfg.ip || "" : ifaceCfg.ip || ""}
                              onChange={(e) => {
                                if (isEnd) onUpdateDevice({ ...device, ip: e.target.value });
                                updateIface(selectedPort, { ip: e.target.value });
                              }}
                              style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }}
                            />
                          </label>
                          <label style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8 }}>
                            <span>Subnet Mask</span>
                            <input
                              value={isEnd ? device.mask || ifaceCfg.mask || "" : ifaceCfg.mask || ""}
                              onChange={(e) => {
                                if (isEnd) onUpdateDevice({ ...device, mask: e.target.value });
                                updateIface(selectedPort, { mask: e.target.value });
                              }}
                              style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }}
                            />
                          </label>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isNetworkCli && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 3 }}>Equivalent IOS Commands</div>
                  <pre
                    style={{
                      margin: 0,
                      height: 66,
                      background: "#ffffff",
                      border: "1px solid #c5cbd3",
                      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
                      padding: 6,
                      font: '11px Consolas, "Courier New", monospace',
                      overflow: "auto",
                    }}
                  >
                    {iosEcho.join("\n") || `${device.hostname || device.name}#`}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* ==============================================================
           * TAB 3: CISCO IOS CLI (with Up/Down command history)
           * ============================================================== */}
          {tab === "CLI" && (
            <div
              onClick={() => cliInputRef.current?.focus()}
              style={{
                flex: 1,
                background: "#000000",
                color: "#D4D4D4",
                border: "1px solid #475569",
                padding: 10,
                fontFamily: 'Consolas, "Courier New", monospace',
                fontSize: 12,
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {cliLines.map((ln, idx) => (
                <div key={idx} style={{ whiteSpace: "pre-wrap", minHeight: 16 }}>
                  {ln}
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center" }}>
                <span>{iosPrompt(device, iosSession)}</span>
                <input
                  ref={cliInputRef}
                  aria-label="Device CLI command"
                  value={cliInput}
                  onChange={(e) => setCliInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRunIos();
                    else if (e.key === "ArrowUp" && cliHistory.length) {
                      e.preventDefault();
                      const nextIdx = cliHistIdx === -1 ? cliHistory.length - 1 : Math.max(0, cliHistIdx - 1);
                      setCliHistIdx(nextIdx);
                      setCliInput(cliHistory[nextIdx]);
                    } else if (e.key === "ArrowDown" && cliHistory.length) {
                      e.preventDefault();
                      if (cliHistIdx === -1) return;
                      if (cliHistIdx >= cliHistory.length - 1) {
                        setCliHistIdx(-1);
                        setCliInput("");
                      } else {
                        const nextIdx = cliHistIdx + 1;
                        setCliHistIdx(nextIdx);
                        setCliInput(cliHistory[nextIdx]);
                      }
                    }
                  }}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#f8fafc",
                    font: "inherit",
                    marginLeft: 4,
                  }}
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* ==============================================================
           * TAB 4: DESKTOP (Colorful PT SVG App Icons + Terminal + Wireless)
           * ============================================================== */}
          {tab === "Desktop" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {desktopApp === "grid" && (
                <div className={styles.ptDesktopGrid}>
                  {[
                    { id: "ipconfig" as const, title: "IP Configuration", icon: <PtAppIpConfigIcon /> },
                    { id: "cmd" as const, title: "Command Prompt", icon: <PtAppCmdIcon /> },
                    { id: "terminal" as const, title: "Terminal", icon: <PtAppTerminalIcon /> },
                    { id: "browser" as const, title: "Web Browser", icon: <PtAppBrowserIcon /> },
                    ...(isWirelessClient ? [{ id: "wireless" as const, title: "PC Wireless", icon: <PtAppWirelessIcon /> }] : []),
                  ].map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => (app.id === "terminal" ? handleOpenTerminal() : setDesktopApp(app.id))}
                      className={styles.ptDesktopAppTile}
                    >
                      <span aria-hidden="true">{app.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: 11 }}>{app.title}</span>
                    </button>
                  ))}
                </div>
              )}

              {desktopApp !== "grid" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", border: "1px solid #94a3b8", background: "#ffffff", minHeight: 0 }}>
                  <div style={{ background: "#dce4ee", borderBottom: "1px solid #aeb7c4", padding: "4px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>
                      {desktopApp === "ipconfig"
                        ? "IP Configuration"
                        : desktopApp === "cmd"
                          ? "Command Prompt"
                          : desktopApp === "terminal"
                            ? "Terminal (RS 232 Console)"
                            : desktopApp === "wireless"
                              ? "PC Wireless"
                              : "Web Browser"}
                    </strong>
                    <button type="button" className={styles.ptQtBtn} style={{ height: 20, padding: "0 8px", fontSize: 11 }} onClick={() => setDesktopApp("grid")}>
                      ✕ Back to Desktop
                    </button>
                  </div>

                  {desktopApp === "ipconfig" && (
                    <div style={{ padding: 16, display: "grid", gap: 10, maxWidth: 420 }}>
                      <div style={{ display: "flex", gap: 16 }}>
                        <label>
                          <input type="radio" checked={!device.dhcp} onChange={() => onUpdateDevice({ ...device, dhcp: false })} /> Static
                        </label>
                        <label>
                          <input type="radio" checked={Boolean(device.dhcp)} onChange={() => onUpdateDevice({ ...device, dhcp: true })} /> DHCP
                        </label>
                      </div>
                      <label style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, alignItems: "center" }}>
                        <span>IPv4 Address</span>
                        <input value={device.ip || ""} onChange={(e) => onUpdateDevice({ ...device, ip: e.target.value })} style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }} />
                      </label>
                      <label style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, alignItems: "center" }}>
                        <span>Subnet Mask</span>
                        <input value={device.mask || ""} onChange={(e) => onUpdateDevice({ ...device, mask: e.target.value })} style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }} />
                      </label>
                      <label style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, alignItems: "center" }}>
                        <span>Default Gateway</span>
                        <input value={device.gateway || ""} onChange={(e) => onUpdateDevice({ ...device, gateway: e.target.value })} style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }} />
                      </label>
                      <label style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, alignItems: "center" }}>
                        <span>DNS Server</span>
                        <input value={device.dns || ""} onChange={(e) => onUpdateDevice({ ...device, dns: e.target.value })} style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }} />
                      </label>
                    </div>
                  )}

                  {desktopApp === "cmd" && (
                    <div
                      onClick={() => cmdInputRef.current?.focus()}
                      style={{
                        flex: 1,
                        background: "#000000",
                        color: "#f1f5f9",
                        padding: 10,
                        fontFamily: 'Consolas, "Courier New", monospace',
                        fontSize: 12,
                        overflow: "auto",
                      }}
                    >
                      {cmdLines.map((ln, i) => (
                        <div key={i} style={{ whiteSpace: "pre-wrap", minHeight: 16 }}>
                          {ln}
                        </div>
                      ))}
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <span>C:\&gt;</span>
                        <input
                          ref={cmdInputRef}
                          aria-label="PC command"
                          value={cmdInput}
                          onChange={(e) => setCmdInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRunCmd();
                            else if (e.key === "ArrowUp" && cmdHistory.length) {
                              e.preventDefault();
                              const nextIdx = cmdHistIdx === -1 ? cmdHistory.length - 1 : Math.max(0, cmdHistIdx - 1);
                              setCmdHistIdx(nextIdx);
                              setCmdInput(cmdHistory[nextIdx]);
                            } else if (e.key === "ArrowDown" && cmdHistory.length) {
                              e.preventDefault();
                              if (cmdHistIdx === -1) return;
                              if (cmdHistIdx >= cmdHistory.length - 1) {
                                setCmdHistIdx(-1);
                                setCmdInput("");
                              } else {
                                const nextIdx = cmdHistIdx + 1;
                                setCmdHistIdx(nextIdx);
                                setCmdInput(cmdHistory[nextIdx]);
                              }
                            }
                          }}
                          style={{
                            flex: 1,
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: "#ffffff",
                            font: "inherit",
                            marginLeft: 4,
                          }}
                          autoFocus
                        />
                      </div>
                    </div>
                  )}

                  {desktopApp === "terminal" && !termConnected && (
                    <div style={{ padding: 16, display: "grid", gap: 10, maxWidth: 420 }}>
                      <div style={{ fontWeight: 700 }}>Terminal Configuration</div>
                      <div style={{ border: "1px solid #cbd5e1", background: "#f8fafc", padding: 10, display: "grid", gridTemplateColumns: "140px 1fr", gap: 6, fontSize: 11.5 }}>
                        <span>Bits Per Second:</span>
                        <span>9600</span>
                        <span>Data Bits:</span>
                        <span>8</span>
                        <span>Parity:</span>
                        <span>None</span>
                        <span>Stop Bits:</span>
                        <span>1</span>
                        <span>Flow Control:</span>
                        <span>None</span>
                      </div>
                      {consoleTarget ? (
                        <div style={{ fontSize: 11.5, color: "#15803d" }}>
                          Console link detected to <b>{consoleTarget.name}</b> ({consoleTarget.power === false ? "Powered OFF" : "Ready"}).
                        </div>
                      ) : (
                        <div style={{ fontSize: 11.5, color: "#b91c1c" }}>
                          No active console cable connected to RS 232. Connect a blue Console cable to a Router or Switch Console port.
                        </div>
                      )}
                      <div>
                        <button
                          type="button"
                          className={styles.ptQtBtn}
                          disabled={!consoleTarget || consoleTarget.power === false}
                          onClick={handleConnectTerminal}
                        >
                          Ok (Open Console)
                        </button>
                      </div>
                    </div>
                  )}

                  {desktopApp === "terminal" && termConnected && consoleTarget && (
                    <div
                      onClick={() => termInputRef.current?.focus()}
                      style={{
                        flex: 1,
                        background: "#000000",
                        color: "#e2e8f0",
                        padding: 10,
                        fontFamily: 'Consolas, "Courier New", monospace',
                        fontSize: 12,
                        overflow: "auto",
                      }}
                    >
                      {termLines.map((ln, idx) => (
                        <div key={idx} style={{ whiteSpace: "pre-wrap", minHeight: 16 }}>
                          {ln}
                        </div>
                      ))}
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <span>{iosPrompt(consoleTarget, termSession)}</span>
                        <input
                          ref={termInputRef}
                          aria-label="Console terminal command"
                          value={termInput}
                          onChange={(e) => setTermInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRunTermIos();
                          }}
                          style={{
                            flex: 1,
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: "#ffffff",
                            font: "inherit",
                            marginLeft: 4,
                          }}
                          autoFocus
                        />
                      </div>
                    </div>
                  )}

                  {desktopApp === "wireless" && (
                    <div style={{ padding: 16, display: "grid", gap: 10, maxWidth: 420 }}>
                      <div style={{ fontWeight: 700 }}>PC Wireless Adapter</div>
                      <label style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
                        <span>Target SSID</span>
                        <input
                          value={device.ssid || ""}
                          onChange={(e) => onUpdateDevice({ ...device, ssid: e.target.value })}
                          placeholder="LabMate Wi-Fi"
                          style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }}
                        />
                      </label>
                      <div style={{ fontSize: 11.5, color: "#334155" }}>
                        Available Access Points:{" "}
                        {wirelessAps.length
                          ? wirelessAps.map((ap) => (
                            <button
                              key={ap.name}
                              type="button"
                              className={styles.ptQtBtn}
                              style={{ height: 20, padding: "0 8px", fontSize: 11, marginLeft: 4 }}
                              onClick={() => onUpdateDevice({ ...device, ssid: ap.ssid || "LabMate Wi-Fi" })}
                            >
                              {ap.name} ({ap.ssid || "LabMate Wi-Fi"})
                            </button>
                          ))
                          : "None active"}
                      </div>
                      <div style={{ fontSize: 11.5, color: wirelessAps.some((ap) => (ap.ssid || "LabMate Wi-Fi") === device.ssid) ? "#15803d" : "#b91c1c" }}>
                        Status:{" "}
                        {wirelessAps.some((ap) => (ap.ssid || "LabMate Wi-Fi") === device.ssid)
                          ? `Associated with ${device.ssid}`
                          : "Not associated (SSID mismatch or no AP)"}
                      </div>
                    </div>
                  )}

                  {desktopApp === "browser" && (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                      <div style={{ display: "flex", gap: 6, padding: 8, borderBottom: "1px solid #cbd5e1", background: "#f8fafc" }}>
                        <span>URL:</span>
                        <input
                          value={browserUrl}
                          onChange={(e) => setBrowserUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleBrowserGo();
                          }}
                          style={{ flex: 1, height: 24, border: "1px solid #94a3b8", padding: "0 6px" }}
                        />
                        <button type="button" className={styles.ptQtBtn} onClick={handleBrowserGo}>
                          Go
                        </button>
                      </div>
                      <iframe
                        title="Simulated web page"
                        sandbox=""
                        style={{ flex: 1, width: "100%", border: 0, background: "#ffffff" }}
                        srcDoc={browserHtml || "<p>Enter a Server IP or DNS name above and click <b>Go</b>.</p>"}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ==============================================================
           * TAB 5: SERVER SERVICES (HTTP, DHCP, DNS)
           * ============================================================== */}
          {tab === "Services" && (
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, overflow: "auto" }}>
              <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", padding: 10 }}>
                <h4 style={{ margin: "0 0 8px" }}>HTTP Service</h4>
                <label style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={services.httpEnabled}
                    onChange={(e) => onUpdateDevice({ ...device, services: { ...services, httpEnabled: e.target.checked } })}
                  />
                  <span>HTTP Server On</span>
                </label>
                <textarea
                  value={services.httpHtml}
                  onChange={(e) => onUpdateDevice({ ...device, services: { ...services, httpHtml: e.target.value } })}
                  rows={5}
                  style={{ width: "100%", font: "11px Consolas, monospace", padding: 6 }}
                />

                <h4 style={{ margin: "12px 0 6px" }}>DHCP Service</h4>
                <label style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    checked={services.dhcpEnabled}
                    onChange={(e) => onUpdateDevice({ ...device, services: { ...services, dhcpEnabled: e.target.checked } })}
                  />
                  <span>DHCP Server On</span>
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 5, fontSize: 11.5 }}>
                  <span>Default Gateway</span>
                  <input
                    value={services.dhcpGateway}
                    onChange={(e) => onUpdateDevice({ ...device, services: { ...services, dhcpGateway: e.target.value } })}
                  />
                  <span>Start IP</span>
                  <input
                    value={services.dhcpStartIp}
                    onChange={(e) => onUpdateDevice({ ...device, services: { ...services, dhcpStartIp: e.target.value } })}
                  />
                </div>
              </div>

              <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", padding: 10 }}>
                <h4 style={{ margin: "0 0 8px" }}>DNS Service</h4>
                <label style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={services.dnsEnabled}
                    onChange={(e) => onUpdateDevice({ ...device, services: { ...services, dnsEnabled: e.target.checked } })}
                  />
                  <span>DNS Service On</span>
                </label>
                <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                  <input placeholder="Name (e.g. site.edu)" value={dnsNameInput} onChange={(e) => setDnsNameInput(e.target.value)} style={{ flex: 1 }} />
                  <input placeholder="IP Address" value={dnsIpInput} onChange={(e) => setDnsIpInput(e.target.value)} style={{ width: 110 }} />
                  <button
                    type="button"
                    className={styles.ptQtBtn}
                    onClick={() => {
                      if (!dnsNameInput.trim() || !dnsIpInput.trim()) return;
                      onUpdateDevice({
                        ...device,
                        services: {
                          ...services,
                          dnsRecords: [...services.dnsRecords, { name: dnsNameInput.trim(), address: dnsIpInput.trim() }],
                        },
                      });
                      setDnsNameInput("");
                      setDnsIpInput("");
                    }}
                  >
                    Add
                  </button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: "#e2e8f0" }}>
                      <th style={{ textAlign: "left", padding: 4 }}>Resource Name</th>
                      <th style={{ textAlign: "left", padding: 4 }}>Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.dnsRecords.map((rec, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: 4 }}>{rec.name}</td>
                        <td style={{ padding: 4 }}>{rec.address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==============================================================
           * TAB 6: ATTRIBUTES
           * ============================================================== */}
          {tab === "Attributes" && (
            <div style={{ flex: 1, background: "#ffffff", border: "1px solid #c5cbd3", padding: 12, overflow: "auto" }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#1e293b", marginBottom: 8 }}>
                Device Attributes — {device.name}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                <thead>
                  <tr style={{ background: "#e8ecf1", borderBottom: "1px solid #c5cbd3" }}>
                    <th style={{ textAlign: "left", padding: "6px 8px", width: 220 }}>Attribute</th>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Device Name", device.name],
                    ["Hostname", device.hostname || device.name],
                    ["Model", device.model || device.type.toUpperCase()],
                    ["Power", device.power === false ? "Off" : "On"],
                    ["MTU", "1500"],
                    ["Subnet Mask", device.mask || device.interfaces?.[ports[0]]?.mask || "255.255.255.0"],
                    ["IPv4 Address", device.ip || device.interfaces?.[ports[0]]?.ip || "Not configured"],
                    ["Active Ports", `${ports.length} (${ports.slice(0, 3).join(", ")}${ports.length > 3 ? "…" : ""})`],
                  ].map(([k, v]) => (
                    <tr key={k} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "5px 8px", fontWeight: 600, color: "#334155" }}>{k}</td>
                      <td style={{ padding: "5px 8px", fontFamily: 'Consolas, "Courier New", monospace', color: "#0f172a" }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
