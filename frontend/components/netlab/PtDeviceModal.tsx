"use client";

import React, { useMemo, useRef, useState } from "react";
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

interface PtDeviceModalProps {
  spec: PtSpec;
  device: PtDevice;
  onUpdateDevice: (updated: PtDevice) => void;
  onClose: () => void;
}

type ModalTab = "Physical" | "Config" | "CLI" | "Desktop" | "Services" | "Attributes";
type DesktopApp = "grid" | "ipconfig" | "cmd" | "browser";

const PHYSICAL_MODULES: Record<string, { desc: string; ports: string }> = {
  "HWIC-2T": {
    desc: "The HWIC-2T provides two high-speed serial ports with Smart Serial connectors for WAN connectivity.",
    ports: "2x Serial",
  },
  "NM-1FE-TX": {
    desc: "Single-port 10/100BASE-TX FastEthernet network module for IEEE 802.3u copper LAN links.",
    ports: "1x FastEthernet",
  },
  "PT-COVER": {
    desc: "Blank EMI shield cover plate installed in unused WIC/HWIC chassis expansion slots.",
    ports: "Blank Plate",
  },
  "WIC-1ENET": {
    desc: "Single-port 10Mbps Ethernet WAN interface card for legacy RJ-45 LAN/WAN uplinks.",
    ports: "1x Ethernet",
  },
};

export function PtDeviceModal({ spec, device, onUpdateDevice, onClose }: PtDeviceModalProps) {
  const isNetworkCli = ["router", "switch", "security"].includes(device.type);
  const isEnd = ["pc", "laptop", "server", "tablet", "smartphone", "printer"].includes(device.type);
  const isServer = device.type === "server";

  const tabs: ModalTab[] = useMemo(() => {
    if (isServer) return ["Physical", "Config", "Services", "Desktop", "Attributes"];
    if (isEnd) return ["Physical", "Config", "Desktop", "Attributes"];
    if (isNetworkCli) return ["Physical", "Config", "CLI", "Attributes"];
    return ["Physical", "Config", "Attributes"];
  }, [isServer, isEnd, isNetworkCli]);

  const [tab, setTab] = useState<ModalTab>(isNetworkCli ? "Config" : isEnd ? "Desktop" : "Config");
  const [configSection, setConfigSection] = useState<string>("Settings");
  const [selectedModule, setSelectedModule] = useState<string>("HWIC-2T");
  const [physicalZoom, setPhysicalZoom] = useState<number>(1);

  // Desktop app state
  const [desktopApp, setDesktopApp] = useState<DesktopApp>("grid");
  const [cmdLines, setCmdLines] = useState<string[]>([
    "Cisco Packet Tracer PC Command Line 1.0",
    "",
  ]);
  const [cmdInput, setCmdInput] = useState("");
  const [browserUrl, setBrowserUrl] = useState("http://192.168.1.100");
  const [browserHtml, setBrowserHtml] = useState<string>("");

  // CLI state
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
  const [iosEcho, setIosEcho] = useState<string[]>([]);

  // Config subform inputs
  const [ripInput, setRipInput] = useState("");
  const [staticNet, setStaticNet] = useState("");
  const [staticMask, setStaticMask] = useState("255.255.255.0");
  const [staticHop, setStaticHop] = useState("");
  const [dnsNameInput, setDnsNameInput] = useState("");
  const [dnsIpInput, setDnsIpInput] = useState("");

  const cliInputRef = useRef<HTMLInputElement>(null);
  const cmdInputRef = useRef<HTMLInputElement>(null);

  const ports = useMemo(() => getDevicePorts(device).filter((p) => p !== "Console" && p !== "RS 232"), [device]);
  const services = device.services ?? defaultServerServices();

  const handleRunIos = () => {
    const line = cliInput;
    const promptStr = iosPrompt(device, iosSession);
    const res = executeIosCommand(spec, device.name, line, iosSession);
    setCliLines((prev) => [...prev, `${promptStr}${line}`, ...res.output]);
    setIosSession(res.nextSession);
    if (res.updatedDevice) onUpdateDevice(res.updatedDevice);
    setCliInput("");
  };

  const handleRunCmd = () => {
    const line = cmdInput;
    if (line.trim().toLowerCase() === "cls") {
      setCmdLines([]);
      setCmdInput("");
      return;
    }
    const out = executePcCommand(spec, device.name, line);
    setCmdLines((prev) => [...prev, `C:\\>${line}`, ...out]);
    setCmdInput("");
  };

  const handleBrowserGo = () => {
    const cleanHost = browserUrl.replace(/^https?:\/\//i, "").split("/")[0].trim();
    const resolvedIp = resolveDnsName(spec, device, cleanHost) ?? cleanHost;
    const srv = spec.devices.find(
      (d) =>
        d.type === "server" &&
        d.power !== false &&
        (d.ip === resolvedIp || Object.values(d.interfaces ?? {}).some((c) => c.ip === resolvedIp))
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

  const updateIface = (port: string, patch: Partial<{ ip: string; mask: string; shutdown: boolean }>) => {
    const cur = device.interfaces?.[port] ?? { ip: "", mask: "", shutdown: false };
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
    setIosEcho((prev) => [...prev.slice(-4), ...echo]);
  };

  const selectedPort = configSection.startsWith("iface:") ? configSection.slice(6) : "";
  const ifaceCfg = selectedPort ? device.interfaces?.[selectedPort] ?? { ip: "", mask: "", shutdown: false } : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.32)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 70,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`${device.name} Configuration`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 780,
          maxWidth: "95vw",
          height: 560,
          maxHeight: "90vh",
          background: "#f0f2f5",
          border: "1px solid #495d75",
          boxShadow: "0 12px 36px rgba(0, 0, 0, 0.35)",
          display: "flex",
          flexDirection: "column",
          fontFamily: '"Segoe UI", system-ui, sans-serif',
          fontSize: 12,
        }}
      >
        {/* Title Bar (Light Qt Chrome) */}
        <div
          style={{
            height: 28,
            background: "linear-gradient(180deg, #eff2f5 0%, #e1e6ec 100%)",
            color: "#1e293b",
            borderBottom: "1px solid #bcc4cf",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 10px",
            fontWeight: 600,
          }}
        >
          <span>
            {device.name} {device.model ? `(${device.model})` : ""}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
            aria-label="Close device window"
          >
            ✕
          </button>
        </div>

        {/* Packet Tracer Tabs Row */}
        <div
          style={{
            display: "flex",
            background: "#e1e5ec",
            borderBottom: "1px solid #aeb7c4",
            padding: "5px 8px 0",
            gap: 3,
          }}
        >
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: "4px 14px",
                border: "1px solid #9da7b4",
                borderBottom: tab === t ? "1px solid #f5f7fa" : "1px solid #9da7b4",
                background: tab === t ? "#f5f7fa" : "#d9dfe8",
                fontWeight: tab === t ? 600 : 400,
                borderRadius: "3px 3px 0 0",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, background: "#f5f7fa", padding: 10, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* ==============================================================
           * TAB 1: PHYSICAL DEVICE VIEW (Brushed Metal + Zoom + Modules)
           * ============================================================== */}
          {tab === "Physical" && (
            <div style={{ flex: 1, display: "flex", gap: 10, minHeight: 0 }}>
              <div style={{ width: 190, display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}>
                <div style={{ flex: 1, background: "#ffffff", border: "1px solid #c5cbd3", padding: 6, overflow: "auto" }}>
                  <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, color: "#1e293b", borderBottom: "1px solid #e2e8f0", paddingBottom: 3 }}>MODULES</div>
                  {Object.keys(PHYSICAL_MODULES).map((mod) => {
                    const active = selectedModule === mod;
                    return (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => setSelectedModule(mod)}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          width: "100%",
                          textAlign: "left",
                          padding: "4px 6px",
                          border: active ? "1px solid #3b82f6" : "1px solid #e2e8f0",
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
                <div style={{ height: 110, background: "#ffffff", border: "1px solid #c5cbd3", padding: 8, fontSize: 10.5, color: "#334155", overflow: "auto" }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: "#0f172a" }}>{selectedModule}</div>
                  <div>{PHYSICAL_MODULES[selectedModule]?.desc}</div>
                </div>
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                {/* Zoom Controls Bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#e8ecf1", border: "1px solid #c5cbd3", padding: "4px 8px" }}>
                  <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 11.5 }}>Physical Device View</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => setPhysicalZoom((z) => Math.min(1.25, Number((z + 0.1).toFixed(2))))}
                      style={{ fontSize: 11, padding: "2px 8px", background: "#ffffff", border: "1px solid #9da7b4", borderRadius: 2, cursor: "pointer" }}
                    >
                      Zoom In
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhysicalZoom(1)}
                      style={{ fontSize: 11, padding: "2px 8px", background: "#ffffff", border: "1px solid #9da7b4", borderRadius: 2, cursor: "pointer" }}
                    >
                      Original Size
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhysicalZoom((z) => Math.max(0.8, Number((z - 0.1).toFixed(2))))}
                      style={{ fontSize: 11, padding: "2px 8px", background: "#ffffff", border: "1px solid #9da7b4", borderRadius: 2, cursor: "pointer" }}
                    >
                      Zoom Out
                    </button>
                  </div>
                </div>

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
                    {/* Top Cisco Emblem + Model Strip */}
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

                    {/* Expansion Slots, Ports, Console/Aux & Rocker Switch */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      {/* HWIC Slotted Bay */}
                      {device.type === "router" && (
                        <div style={{ background: "#4b5563", border: "1px solid #1f2937", padding: "6px 8px", borderRadius: 2, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d1d5db", border: "1px solid #111827" }} />
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: 9, color: "#f9fafb", fontWeight: 700 }}>{selectedModule} BAY</span>
                            <div style={{ display: "flex", gap: 4 }}>
                              <div style={{ width: 28, height: 11, background: "#0f172a", border: "1px solid #9ca3af", fontSize: 8, color: "#93c5fd", textAlign: "center", lineHeight: "10px" }}>S0/0/0</div>
                              <div style={{ width: 28, height: 11, background: "#0f172a", border: "1px solid #9ca3af", fontSize: 8, color: "#93c5fd", textAlign: "center", lineHeight: "10px" }}>S0/0/1</div>
                            </div>
                          </div>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d1d5db", border: "1px solid #111827" }} />
                        </div>
                      )}

                      {/* Console / Aux + LAN RJ-45 Ports */}
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

                      {/* Black I/O Rocker Switch */}
                      <div style={{ textAlign: "center", background: "#374151", border: "1px solid #111827", padding: "5px 8px", borderRadius: 2, color: "#f9fafb" }}>
                        <div style={{ fontSize: 8.5, marginBottom: 4, letterSpacing: 0.5, fontWeight: 700 }}>POWER</div>
                        <button
                          type="button"
                          onClick={() => onUpdateDevice({ ...device, power: device.power === false ? true : false })}
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
                    — Toggle the I/O rocker switch to power cycle device.
                  </span>
                  <span style={{ color: "#64748b", fontSize: 10.5 }}>Slot Module: {selectedModule}</span>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
           * TAB 2: CONFIG (Settings, Routing Static/RIP, Interfaces)
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
                    <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
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
                          onClick={() => {
                            if (!ripInput.trim()) return;
                            onUpdateDevice({ ...device, rip: Array.from(new Set([...(device.rip ?? []), ripInput.trim()])) });
                            setIosEcho((prev) => [...prev.slice(-3), `${device.hostname || device.name}(config-router)#network ${ripInput.trim()}`]);
                            setRipInput("");
                          }}
                          style={{ height: 24, padding: "0 12px" }}
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
                              onClick={() => onUpdateDevice({ ...device, rip: (device.rip ?? []).filter((x) => x !== n) })}
                              style={{ fontSize: 11 }}
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
                          <div key={i} style={{ padding: "2px 4px" }}>
                            {sr.network} / {sr.mask} via {sr.nextHop}
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
                      <label style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8 }}>
                        <span>IPv4 Address</span>
                        <input
                          value={isEnd ? device.ip || "" : ifaceCfg.ip || ""}
                          onChange={(e) => {
                            if (isEnd) onUpdateDevice({ ...device, ip: e.target.value });
                            else updateIface(selectedPort, { ip: e.target.value });
                          }}
                          style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }}
                        />
                      </label>
                      <label style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8 }}>
                        <span>Subnet Mask</span>
                        <input
                          value={isEnd ? device.mask || "" : ifaceCfg.mask || ""}
                          onChange={(e) => {
                            if (isEnd) onUpdateDevice({ ...device, mask: e.target.value });
                            else updateIface(selectedPort, { mask: e.target.value });
                          }}
                          style={{ height: 24, border: "1px solid #94a3b8", padding: "0 6px" }}
                        />
                      </label>
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
           * TAB 3: CISCO IOS CLI
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
                  value={cliInput}
                  onChange={(e) => setCliInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRunIos();
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
           * TAB 4: DESKTOP (IP Config, Command Prompt, Web Browser)
           * ============================================================== */}
          {tab === "Desktop" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {desktopApp === "grid" && (
                <div
                  style={{
                    flex: 1,
                    background: "linear-gradient(180deg, #dce9f9 0%, #bfd6f2 100%)",
                    border: "1px solid #93b4d8",
                    padding: 20,
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 130px)",
                    gap: 18,
                    alignContent: "start",
                  }}
                >
                  {[
                    { id: "ipconfig" as const, title: "IP Configuration", icon: "🌐" },
                    { id: "cmd" as const, title: "Command Prompt", icon: "C:\\>" },
                    { id: "browser" as const, title: "Web Browser", icon: "🌍" },
                  ].map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setDesktopApp(app.id)}
                      style={{
                        height: 98,
                        background: "#ffffff",
                        border: "1px solid #6b95c9",
                        borderRadius: 4,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        cursor: "pointer",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                      }}
                    >
                      <span style={{ fontSize: app.id === "cmd" ? 18 : 24, fontWeight: 700, color: "#1d4ed8" }}>{app.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: 11.5 }}>{app.title}</span>
                    </button>
                  ))}
                </div>
              )}

              {desktopApp !== "grid" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", border: "1px solid #94a3b8", background: "#ffffff", minHeight: 0 }}>
                  <div style={{ background: "#dce4ee", borderBottom: "1px solid #aeb7c4", padding: "4px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>
                      {desktopApp === "ipconfig" ? "IP Configuration" : desktopApp === "cmd" ? "Command Prompt" : "Web Browser"}
                    </strong>
                    <button type="button" onClick={() => setDesktopApp("grid")} style={{ padding: "1px 8px" }}>
                      ✕ Back to Desktop
                    </button>
                  </div>

                  {desktopApp === "ipconfig" && (
                    <div style={{ padding: 16, display: "grid", gap: 10, maxWidth: 420 }}>
                      <div style={{ display: "flex", gap: 16 }}>
                        <label>
                          <input
                            type="radio"
                            checked={!device.dhcp}
                            onChange={() => onUpdateDevice({ ...device, dhcp: false })}
                          />{" "}
                          Static
                        </label>
                        <label>
                          <input
                            type="radio"
                            checked={Boolean(device.dhcp)}
                            onChange={() => onUpdateDevice({ ...device, dhcp: true })}
                          />{" "}
                          DHCP
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
                          value={cmdInput}
                          onChange={(e) => setCmdInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRunCmd();
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
                        <button type="button" onClick={handleBrowserGo} style={{ padding: "0 12px" }}>
                          Go
                        </button>
                      </div>
                      <div
                        style={{ flex: 1, padding: 16, overflow: "auto" }}
                        dangerouslySetInnerHTML={{
                          __html: browserHtml || "<p>Enter a Server IP or DNS name above and click <b>Go</b>.</p>",
                        }}
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
