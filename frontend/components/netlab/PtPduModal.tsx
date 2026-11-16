"use client";

import React, { useState } from "react";
import type { PtDevice, PtEvent, PtSpec } from "@/lib/netlab/ptTypes";
import { syntheticMac } from "@/lib/netlab/ptEngine";

interface PtPduModalProps {
  spec: PtSpec;
  event: PtEvent;
  onClose: () => void;
}

export function PtPduModal({ spec, event, onClose }: PtPduModalProps) {
  const [tab, setTab] = useState<"OSI" | "Inbound" | "Outbound">("OSI");
  const atDev = spec.devices.find((d) => d.name === event.at);
  const srcMac = syntheticMac(event.last || event.at);
  const dstMac = syntheticMac(event.at);
  const srcIp = atDev?.ip || Object.values(atDev?.interfaces ?? {})[0]?.ip || "192.168.1.1";

  const osiLayers = [
    { layer: "Layer 7", inDesc: event.type === "HTTP" ? "HTTP Request/Response" : "—", outDesc: "—" },
    { layer: "Layer 6", inDesc: "—", outDesc: "—" },
    { layer: "Layer 5", inDesc: "—", outDesc: "—" },
    { layer: "Layer 4", inDesc: event.type === "TCP" || event.type === "UDP" ? event.type : "—", outDesc: "—" },
    {
      layer: "Layer 3",
      inDesc: event.type === "ARP" ? "ARP Table Lookup / Update" : `IPv4 Header (${event.info})`,
      outDesc: event.action === "forwarded" ? "Routing lookup -> next hop" : event.action === "accepted" ? "Delivered locally" : "—",
    },
    {
      layer: "Layer 2",
      inDesc: `Ethernet II Frame (${srcMac} >> ${dstMac})`,
      outDesc: event.action === "discarded" ? "Frame discarded (not destination)" : `Out port MAC: ${dstMac}`,
    },
    { layer: "Layer 1", inDesc: `FastEthernet receives frame at ${event.at}`, outDesc: `Copper wire transmission` },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.28)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 75,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`PDU Information at Device ${event.at}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 620,
          maxWidth: "94vw",
          background: "#f1f4f8",
          border: "1px solid #495d75",
          boxShadow: "0 10px 28px rgba(0, 0, 0, 0.35)",
          fontFamily: '"Segoe UI", system-ui, sans-serif',
          fontSize: 12,
        }}
      >
        <div
          style={{
            height: 26,
            background: "linear-gradient(180deg, #3c658f 0%, #27486b 100%)",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 10px",
            fontWeight: 600,
          }}
        >
          <span>
            PDU Information at Device: {event.at} ({event.type})
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}
            aria-label="Close PDU dialog"
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", gap: 3, background: "#e1e5ec", borderBottom: "1px solid #aeb7c4", padding: "5px 8px 0" }}>
          {(["OSI", "Inbound", "Outbound"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: "3px 12px",
                border: "1px solid #9da7b4",
                borderBottom: tab === t ? "1px solid #fff" : "1px solid #9da7b4",
                background: tab === t ? "#fff" : "#d9dfe8",
                fontWeight: tab === t ? 600 : 400,
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t === "OSI" ? "OSI Model" : t === "Inbound" ? "Inbound PDU Details" : "Outbound PDU Details"}
            </button>
          ))}
        </div>

        <div style={{ padding: 12, background: "#ffffff" }}>
          {tab === "OSI" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: "#e9eef5" }}>
                  <th style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: 70 }}>Layer</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}>In Layers</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}>Out Layers</th>
                </tr>
              </thead>
              <tbody>
                {osiLayers.map((row) => (
                  <tr key={row.layer}>
                    <td style={{ border: "1px solid #e2e8f0", padding: "4px 6px", fontWeight: 600 }}>{row.layer}</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "4px 6px" }}>{row.inDesc}</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "4px 6px" }}>{row.outDesc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab !== "OSI" && (
            <div style={{ display: "grid", gap: 8, fontFamily: "Consolas, monospace", fontSize: 11.5 }}>
              <div style={{ border: "1px solid #94a3b8", padding: 8, background: "#f8fafc" }}>
                <strong>ETHERNET II</strong>
                <div>PREAMBLE: 101010...1011 | DST MAC: {dstMac} | SRC MAC: {srcMac} | TYPE: 0x0800</div>
              </div>
              <div style={{ border: "1px solid #94a3b8", padding: 8, background: "#f8fafc" }}>
                <strong>IP / {event.type} HEADER</strong>
                <div>
                  Device: {event.at} ({srcIp}) | Action: {event.action.toUpperCase()} | Info: {event.info}
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 11.5, color: "#334155", background: "#f8fafc", padding: 8, border: "1px solid #e2e8f0" }}>
            <b>Event Detail ({event.time.toFixed(3)}s):</b> {event.info} — Status: <b>{event.action}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PtPhysicalWorkspace({ spec }: { spec: PtSpec }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#edf1f5",
        padding: 18,
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>
        Physical Workspace: Home City &gt; Corporate Office &gt; Main Wiring Closet
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* 19-inch Equipment Rack */}
        <div
          style={{
            width: 340,
            background: "#1f242c",
            border: "4px solid #475569",
            borderRadius: 4,
            padding: 12,
            color: "#e2e8f0",
            boxShadow: "0 6px 20px rgba(0,0,0,0.22)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 8, textAlign: "center" }}>
            19&quot; NETWORK RACK (MAIN WIRING CLOSET)
          </div>
          {spec.devices
            .filter((d) => ["router", "switch", "hub", "server", "security"].includes(d.type))
            .map((d) => (
              <div
                key={d.name}
                style={{
                  height: 36,
                  background: d.type === "router" ? "#1e3a5f" : d.type === "switch" ? "#0f4c5c" : "#334155",
                  border: "1px solid #64748b",
                  marginBottom: 6,
                  padding: "0 10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                }}
              >
                <span>
                  <b>{d.name}</b> ({d.model || d.type})
                </span>
                <span style={{ color: d.power === false ? "#ef4444" : "#22c55e", fontWeight: 700 }}>
                  ● {d.power === false ? "OFF" : "PWR"}
                </span>
              </div>
            ))}
        </div>

        {/* Desk Workstation Equipment */}
        <div style={{ flex: 1, minWidth: 280, background: "#ffffff", border: "1px solid #cbd5e1", padding: 14, borderRadius: 4 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Office Desks &amp; End Stations</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            {spec.devices
              .filter((d) => !["router", "switch", "hub", "server", "security"].includes(d.type))
              .map((d) => (
                <div key={d.name} style={{ border: "1px solid #d5dce5", padding: 10, borderRadius: 3, background: "#f8fafc" }}>
                  <div style={{ fontWeight: 600 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{d.model || d.type.toUpperCase()}</div>
                  <div style={{ fontSize: 11, color: "#0369a1", marginTop: 4 }}>{d.ip || "DHCP / Unassigned"}</div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
