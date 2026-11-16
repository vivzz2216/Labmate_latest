"use client";

import React from "react";

interface DiagramField {
  label: string;
  bits: number;
  start: number;
  end: number;
}

interface DiagramLayer {
  title: string;
  fields: DiagramField[];
}

function BitRuler() {
  return (
    <div style={{ marginBottom: 2 }}>
      {/* Bit numbers 0, 15, 16, 31 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(32, minmax(0, 1fr))", fontSize: 9.5, color: "#334155", lineHeight: "12px" }}>
        {Array.from({ length: 32 }, (_, i) => (
          <span key={i} style={{ textAlign: i === 31 ? "right" : "left" }}>
            {i === 0 || i === 15 || i === 16 || i === 31 ? i : ""}
          </span>
        ))}
      </div>
      {/* Horizontal 32-bit axis with crisp vertical tick marks */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(32, minmax(0, 1fr))", borderBottom: "1px solid #475569", height: 7, alignItems: "end" }}>
        {Array.from({ length: 32 }, (_, i) => {
          const major = i === 0 || i === 8 || i === 15 || i === 16 || i === 24 || i === 31;
          return (
            <div
              key={i}
              style={{
                borderLeft: i === 31 ? "none" : "1px solid #64748b",
                borderRight: i === 31 ? "1px solid #64748b" : "none",
                height: major ? 7 : 3.5,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function WsPacketDiagram({
  layersText,
  protocol,
  highlightRange,
  onSelectRange,
}: {
  layersText: string[];
  protocol: string;
  highlightRange: { start: number; end: number } | null;
  onSelectRange: (start: number, end: number) => void;
}) {
  const joined = layersText.join("\n");
  const layers: DiagramLayer[] = [];

  if (joined.includes("Ethernet II")) {
    layers.push({
      title: "Ethernet II",
      fields: [
        { label: "Destination (bits 0–31)", bits: 32, start: 0, end: 6 },
        { label: "Destination (cont. 32–47)", bits: 16, start: 0, end: 6 },
        { label: "Source (bits 0–15)", bits: 16, start: 6, end: 12 },
        { label: "Source (cont. 16–47)", bits: 32, start: 6, end: 12 },
        { label: "Type: IPv4 / ARP (16)", bits: 16, start: 12, end: 14 },
      ],
    });
  }

  if (joined.includes("Address Resolution Protocol")) {
    layers.push({
      title: "Address Resolution Protocol",
      fields: [
        { label: "Hardware type", bits: 16, start: 14, end: 16 },
        { label: "Protocol type", bits: 16, start: 16, end: 18 },
        { label: "HW size", bits: 8, start: 18, end: 19 },
        { label: "Proto size", bits: 8, start: 19, end: 20 },
        { label: "Opcode", bits: 16, start: 20, end: 22 },
        { label: "Sender MAC address (bytes 0–3)", bits: 32, start: 22, end: 28 },
        { label: "Sender MAC (4–5)", bits: 16, start: 22, end: 28 },
        { label: "Sender IP (0–1)", bits: 16, start: 28, end: 32 },
        { label: "Sender IP (2–3)", bits: 16, start: 28, end: 32 },
        { label: "Target MAC (0–1)", bits: 16, start: 32, end: 38 },
        { label: "Target MAC address (bytes 2–5)", bits: 32, start: 32, end: 38 },
        { label: "Target IP address (32)", bits: 32, start: 38, end: 42 },
      ],
    });
  }

  if (joined.includes("Internet Protocol Version 4")) {
    layers.push({
      title: "Internet Protocol Version 4",
      fields: [
        { label: "Version", bits: 4, start: 14, end: 15 },
        { label: "Hdr Len", bits: 4, start: 14, end: 15 },
        { label: "Differentiated Services", bits: 8, start: 15, end: 16 },
        { label: "Total Length", bits: 16, start: 16, end: 18 },
        { label: "Identification", bits: 16, start: 18, end: 20 },
        { label: "Flags", bits: 3, start: 20, end: 21 },
        { label: "Fragment Offset", bits: 13, start: 20, end: 22 },
        { label: "Time to Live", bits: 8, start: 22, end: 23 },
        { label: "Protocol", bits: 8, start: 23, end: 24 },
        { label: "Header Checksum", bits: 16, start: 24, end: 26 },
        { label: "Source Address", bits: 32, start: 26, end: 30 },
        { label: "Destination Address", bits: 32, start: 30, end: 34 },
      ],
    });
  }

  if (joined.includes("Transmission Control Protocol")) {
    layers.push({
      title: "Transmission Control Protocol",
      fields: [
        { label: "Source Port", bits: 16, start: 34, end: 36 },
        { label: "Destination Port", bits: 16, start: 36, end: 38 },
        { label: "Sequence Number", bits: 32, start: 38, end: 42 },
        { label: "Acknowledgment Number", bits: 32, start: 42, end: 46 },
        { label: "Data Offset", bits: 4, start: 46, end: 47 },
        { label: "Flags", bits: 12, start: 46, end: 48 },
        { label: "Window", bits: 16, start: 48, end: 50 },
        { label: "Checksum", bits: 16, start: 50, end: 52 },
        { label: "Urgent Pointer", bits: 16, start: 52, end: 54 },
      ],
    });
  } else if (joined.includes("User Datagram Protocol")) {
    layers.push({
      title: "User Datagram Protocol",
      fields: [
        { label: "Source Port", bits: 16, start: 34, end: 36 },
        { label: "Destination Port", bits: 16, start: 36, end: 38 },
        { label: "Length", bits: 16, start: 38, end: 40 },
        { label: "Checksum", bits: 16, start: 40, end: 42 },
      ],
    });
  } else if (joined.includes("Internet Control Message Protocol")) {
    layers.push({
      title: "Internet Control Message Protocol",
      fields: [
        { label: "Type", bits: 8, start: 34, end: 35 },
        { label: "Code", bits: 8, start: 35, end: 36 },
        { label: "Checksum", bits: 16, start: 36, end: 38 },
        { label: "Identifier", bits: 16, start: 38, end: 40 },
        { label: "Sequence Number", bits: 16, start: 40, end: 42 },
      ],
    });
  }

  if (protocol === "DNS" || joined.includes("Domain Name System")) {
    layers.push({
      title: "Domain Name System",
      fields: [
        { label: "Transaction ID", bits: 16, start: 42, end: 44 },
        { label: "Flags", bits: 16, start: 44, end: 46 },
        { label: "Questions", bits: 16, start: 46, end: 48 },
        { label: "Answer RRs", bits: 16, start: 48, end: 50 },
      ],
    });
  }

  return (
    <div style={{ padding: "8px 12px", overflow: "auto", fontFamily: '"Segoe UI", Tahoma, sans-serif', fontSize: 11 }}>
      {layers.map((layer) => (
        <div key={layer.title} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "#111827", marginBottom: 4 }}>{layer.title}</div>
          <BitRuler />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(32, minmax(0, 1fr))", borderLeft: "1px solid #475569" }}>
            {layer.fields.map((f, idx) => {
              const selected = highlightRange && highlightRange.start === f.start && highlightRange.end === f.end;
              return (
                <button
                  key={`${f.label}-${idx}`}
                  type="button"
                  onClick={() => onSelectRange(f.start, f.end)}
                  style={{
                    gridColumn: `span ${f.bits}`,
                    border: "none",
                    borderRight: "1px solid #475569",
                    borderBottom: "1px solid #475569",
                    background: selected ? "#3072cc" : "#ffffff",
                    color: selected ? "#ffffff" : "#111827",
                    padding: "4px 4px",
                    fontSize: 10.5,
                    cursor: "pointer",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textAlign: "center",
                  }}
                  title={`${f.label} (bytes ${f.start}..${f.end})`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
