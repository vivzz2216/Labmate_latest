"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { WiresharkLogoIcon } from "./WiresharkIcons";
import { bitsText, bytesText, type LiveInterface } from "./wsModel";
import styles from "./wireshark.module.css";

export function Dialog({
  title,
  onClose,
  width,
  height,
  children,
  buttons,
  left,
}: {
  title: string;
  onClose: () => void;
  width?: number;
  height?: number;
  children: ReactNode;
  buttons?: ReactNode;
  left?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={styles.modalOverlay} onMouseDown={onClose}>
      <div className={styles.dialog} style={{ width, height }} role="dialog" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.dialogTitle}>
          <div className={styles.titleLeft}>
            <WiresharkLogoIcon size={15} />
            <span className={styles.titleText}>{title}</span>
          </div>
          <div className={styles.winCaptions}>
            <button type="button" className={`${styles.winBtn} ${styles.winClose}`} onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>
        <div className={styles.dialogBody}>{children}</div>
        <div className={styles.dialogButtons}>
          {left ? <div className={styles.dialogButtonsLeft}>{left}</div> : null}
          {buttons}
          <button type="button" className={`${styles.qtButton} ${styles.qtButtonDefault}`} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------- Capture File Properties
interface Measure {
  packets: number;
  time_span: number;
  average_pps: number | null;
  average_packet_size: number;
  bytes: number;
  average_bytes_per_second: number | null;
  average_bits_per_second: number | null;
}
export interface PropertiesData {
  file: { name: string; length: number; sha256: string; format: string; encapsulation: string; source: string };
  time: { first_packet: string; last_packet: string; elapsed: string };
  captured: Measure;
  displayed: Measure;
  displayed_percent: number;
  marked: number;
}

export function PropertiesDialog({ data, filter, onClose }: { data: PropertiesData; filter: string; onClose: () => void }) {
  const rows: [string, (m: Measure) => string][] = [
    ["Packets", (m) => String(m.packets)],
    ["Time span, s", (m) => m.time_span.toFixed(3)],
    ["Average pps", (m) => (m.average_pps === null ? "N/A" : m.average_pps.toFixed(1))],
    ["Average packet size, B", (m) => String(m.average_packet_size)],
    ["Bytes", (m) => String(m.bytes)],
    ["Average bytes/s", (m) => (m.average_bytes_per_second === null ? "N/A" : bytesText(m.average_bytes_per_second))],
    ["Average bits/s", (m) => bitsText(m.average_bits_per_second)],
  ];
  const text = [
    "File",
    `Name: ${data.file.name}`,
    `Length: ${data.file.length} bytes`,
    `Hash (SHA256): ${data.file.sha256}`,
    `Format: ${data.file.format}`,
    `Encapsulation: ${data.file.encapsulation}`,
    "",
    "Time",
    `First packet: ${data.time.first_packet}`,
    `Last packet: ${data.time.last_packet}`,
    `Elapsed: ${data.time.elapsed}`,
  ].join("\n");
  return (
    <Dialog
      title={`Wireshark · Capture File Properties · ${data.file.name}`}
      onClose={onClose}
      width={720}
      height={600}
      left={
        <button type="button" className={styles.qtButton} onClick={() => void navigator.clipboard?.writeText(text)}>
          Copy To Clipboard
        </button>
      }
    >
      <div className={styles.propText}>
        <h3>Details</h3>
        <h3>File</h3>
        <table>
          <tbody>
            <tr><th>Name:</th><td>{data.file.name}</td></tr>
            <tr><th>Length:</th><td>{data.file.length.toLocaleString()} bytes</td></tr>
            <tr><th>Hash (SHA256):</th><td style={{ fontFamily: "var(--ws-mono)" }}>{data.file.sha256}</td></tr>
            <tr><th>Format:</th><td>{data.file.format}</td></tr>
            <tr><th>Encapsulation:</th><td>{data.file.encapsulation}</td></tr>
            {data.file.source ? <tr><th>Comment:</th><td>{data.file.source}</td></tr> : null}
          </tbody>
        </table>
        <h3>Time</h3>
        <table>
          <tbody>
            <tr><th>First packet:</th><td>{data.time.first_packet} UTC</td></tr>
            <tr><th>Last packet:</th><td>{data.time.last_packet} UTC</td></tr>
            <tr><th>Elapsed:</th><td>{data.time.elapsed}</td></tr>
          </tbody>
        </table>
        <h3>Statistics</h3>
        <table>
          <thead>
            <tr><th>Measurement</th><th>Captured</th><th>Displayed</th><th>Marked</th></tr>
          </thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{value(data.captured)}</td>
                <td>{label === "Packets" ? `${data.displayed.packets} (${data.displayed_percent.toFixed(1)}%)` : value(data.displayed)}</td>
                <td>{label === "Packets" ? String(data.marked) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.dialogNote}>Display filter: {filter || "none"}</p>
      </div>
    </Dialog>
  );
}

// ------------------------------------------------------------------------------------------- Protocol Hierarchy
export interface HierarchyRow {
  protocol: string;
  abbrev: string;
  depth: number;
  percent_packets: number;
  packets: number;
  percent_bytes: number;
  bytes: number;
  bits_per_second: number | null;
  end_packets: number;
  end_bytes: number;
  end_bits_per_second: number | null;
}

function Pct({ value }: { value: number }) {
  return (
    <td className={styles.pctCell}>
      <span className={styles.pctBar} style={{ width: `${Math.max(0, Math.min(100, value)) * 0.86}%` }} />
      <span className={styles.pctText}>{value.toFixed(1)}</span>
    </td>
  );
}

export function HierarchyDialog({
  rows,
  filter,
  file,
  onClose,
  onApply,
}: {
  rows: HierarchyRow[];
  filter: string;
  file: string;
  onClose: () => void;
  onApply: (abbrev: string) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const visible = useMemo(() => {
    const out: { row: HierarchyRow; index: number; hasChildren: boolean }[] = [];
    let hideBelow: number | null = null;
    rows.forEach((row, index) => {
      if (hideBelow !== null && row.depth > hideBelow) return;
      hideBelow = null;
      const hasChildren = index + 1 < rows.length && rows[index + 1].depth > row.depth;
      out.push({ row, index, hasChildren });
      if (collapsed.has(index)) hideBelow = row.depth;
    });
    return out;
  }, [rows, collapsed]);
  return (
    <Dialog
      title={`Wireshark · Protocol Hierarchy Statistics · ${file}`}
      onClose={onClose}
      width={1000}
      height={520}
      left={<span className={styles.dialogNote}>Display filter: {filter || "none"}</span>}
      buttons={
        <button type="button" className={styles.qtButton} disabled={picked === null} onClick={() => picked !== null && onApply(rows[picked].abbrev)}>
          Apply as Filter
        </button>
      }
    >
      <div className={styles.statTableWrap}>
        <table className={styles.statTable}>
          <thead>
            <tr>
              <th style={{ minWidth: 300 }}>Protocol</th>
              <th>Percent Packets</th>
              <th>Packets</th>
              <th>Percent Bytes</th>
              <th>Bytes</th>
              <th>Bits/s</th>
              <th>End Packets</th>
              <th>End Bytes</th>
              <th>End Bits/s</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ row, index, hasChildren }) => (
              <tr key={index} className={picked === index ? styles.statRowSelected : ""} onClick={() => setPicked(index)}>
                <td style={{ paddingLeft: 6 + row.depth * 16 }}>
                  <span
                    className={styles.treeToggle}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!hasChildren) return;
                      const next = new Set(collapsed);
                      if (next.has(index)) next.delete(index);
                      else next.add(index);
                      setCollapsed(next);
                    }}
                  >
                    {hasChildren ? (collapsed.has(index) ? "▶" : "▼") : ""}
                  </span>
                  {row.protocol}
                </td>
                <Pct value={row.percent_packets} />
                <td className={styles.statNum}>{row.packets}</td>
                <Pct value={row.percent_bytes} />
                <td className={styles.statNum}>{row.bytes}</td>
                <td className={styles.statNum}>{bitsText(row.bits_per_second)}</td>
                <td className={styles.statNum}>{row.end_packets}</td>
                <td className={styles.statNum}>{row.end_bytes}</td>
                <td className={styles.statNum}>{bitsText(row.end_bits_per_second)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}

// ------------------------------------------------------------------------------------------- Conversations / Endpoints
export interface ConversationRow {
  address_a: string;
  port_a: number | null;
  address_b: string;
  port_b: number | null;
  packets: number;
  bytes: number;
  stream: number | null;
  packets_ab: number;
  bytes_ab: number;
  packets_ba: number;
  bytes_ba: number;
  rel_start: number;
  duration: number;
  bits_per_second_ab: number | null;
  bits_per_second_ba: number | null;
}
export interface EndpointRow {
  address: string;
  port: number | null;
  packets: number;
  bytes: number;
  tx_packets: number;
  tx_bytes: number;
  rx_packets: number;
  rx_bytes: number;
}

const KINDS: { id: string; label: string; field: string }[] = [
  { id: "eth", label: "Ethernet", field: "eth.addr" },
  { id: "ipv4", label: "IPv4", field: "ip.addr" },
  { id: "ipv6", label: "IPv6", field: "ipv6.addr" },
  { id: "tcp", label: "TCP", field: "tcp" },
  { id: "udp", label: "UDP", field: "udp" },
];

function conversationFilter(kind: string, row: ConversationRow) {
  const field = KINDS.find((k) => k.id === kind)!.field;
  if (kind === "tcp" || kind === "udp") {
    const ip = row.address_a.includes(":") ? "ipv6" : "ip";
    return `${ip}.addr == ${row.address_a} && ${kind}.port == ${row.port_a} && ${ip}.addr == ${row.address_b} && ${kind}.port == ${row.port_b}`;
  }
  return `${field} == ${row.address_a} && ${field} == ${row.address_b}`;
}

function endpointFilter(kind: string, row: EndpointRow) {
  if (kind === "tcp" || kind === "udp") return `${row.address.includes(":") ? "ipv6" : "ip"}.addr == ${row.address} && ${kind}.port == ${row.port}`;
  return `${KINDS.find((k) => k.id === kind)!.field} == ${row.address}`;
}

export function TrafficDialog({
  mode,
  file,
  filter,
  load,
  onClose,
  onApply,
  onFollow,
}: {
  mode: "conversations" | "endpoints";
  file: string;
  filter: string;
  load: (kind: string, limitToFilter: boolean) => Promise<{ rows: (ConversationRow | EndpointRow)[] }>;
  onClose: () => void;
  onApply: (filter: string) => void;
  onFollow: (stream: number) => void;
}) {
  const [kind, setKind] = useState("ipv4");
  const [limit, setLimit] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<(ConversationRow | EndpointRow)[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all(KINDS.map((k) => load(k.id, limit).then((d) => [k.id, d.rows.length] as const)))
      .then((pairs) => alive && setCounts(Object.fromEntries(pairs)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [load, limit]);

  useEffect(() => {
    let alive = true;
    setPicked(null);
    load(kind, limit)
      .then((data) => alive && (setRows(data.rows), setError("")))
      .catch(() => alive && setError("The statistics could not be loaded."));
    return () => {
      alive = false;
    };
  }, [kind, limit, load]);

  const ported = kind === "tcp" || kind === "udp";
  const title = mode === "conversations" ? "Conversations" : "Endpoints";
  const pickedRow = picked !== null ? rows[picked] : null;
  const pickedFilter = pickedRow
    ? mode === "conversations"
      ? conversationFilter(kind, pickedRow as ConversationRow)
      : endpointFilter(kind, pickedRow as EndpointRow)
    : "";
  return (
    <Dialog
      title={`Wireshark · ${title} · ${file}`}
      onClose={onClose}
      width={1180}
      height={560}
      left={
        <label className={styles.qtCheck}>
          <input type="checkbox" checked={limit} disabled={!filter} onChange={(event) => setLimit(event.target.checked)} />
          Limit to display filter{filter ? ` (${filter})` : ""}
        </label>
      }
      buttons={
        <>
          {mode === "conversations" && kind === "tcp" ? (
            <button
              type="button"
              className={styles.qtButton}
              disabled={!pickedRow || (pickedRow as ConversationRow).stream === null}
              onClick={() => pickedRow && onFollow((pickedRow as ConversationRow).stream ?? 0)}
            >
              Follow Stream…
            </button>
          ) : null}
          <button type="button" className={styles.qtButton} disabled={!pickedFilter} onClick={() => onApply(pickedFilter)}>
            Apply as Filter
          </button>
        </>
      }
    >
      <div className={styles.tabStrip} role="tablist">
        {KINDS.map((k) => (
          <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} className={`${styles.tab} ${kind === k.id ? styles.tabActive : ""}`} onClick={() => setKind(k.id)}>
            {k.label}
            {counts[k.id] ? ` · ${counts[k.id]}` : ""}
          </button>
        ))}
      </div>
      {error ? <p className={styles.statusError}>{error}</p> : null}
      <div className={styles.statTableWrap}>
        <table className={styles.statTable}>
          <thead>
            {mode === "conversations" ? (
              <tr>
                <th>Address A</th>
                {ported ? <th>Port A</th> : null}
                <th>Address B</th>
                {ported ? <th>Port B</th> : null}
                <th>Packets</th>
                <th>Bytes</th>
                {ported ? <th>Stream ID</th> : null}
                <th>Packets A → B</th>
                <th>Bytes A → B</th>
                <th>Packets B → A</th>
                <th>Bytes B → A</th>
                <th>Rel Start</th>
                <th>Duration</th>
                <th>Bits/s A → B</th>
                <th>Bits/s B → A</th>
              </tr>
            ) : (
              <tr>
                <th>Address</th>
                {ported ? <th>Port</th> : null}
                <th>Packets</th>
                <th>Bytes</th>
                <th>Tx Packets</th>
                <th>Tx Bytes</th>
                <th>Rx Packets</th>
                <th>Rx Bytes</th>
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row, index) =>
              mode === "conversations" ? (
                (() => {
                  const c = row as ConversationRow;
                  return (
                    <tr key={index} className={picked === index ? styles.statRowSelected : ""} onClick={() => setPicked(index)}>
                      <td>{c.address_a}</td>
                      {ported ? <td className={styles.statNum}>{c.port_a}</td> : null}
                      <td>{c.address_b}</td>
                      {ported ? <td className={styles.statNum}>{c.port_b}</td> : null}
                      <td className={styles.statNum}>{c.packets}</td>
                      <td className={styles.statNum}>{bytesText(c.bytes)} bytes</td>
                      {ported ? <td className={styles.statNum}>{c.stream}</td> : null}
                      <td className={styles.statNum}>{c.packets_ab}</td>
                      <td className={styles.statNum}>{bytesText(c.bytes_ab)} bytes</td>
                      <td className={styles.statNum}>{c.packets_ba}</td>
                      <td className={styles.statNum}>{bytesText(c.bytes_ba)} bytes</td>
                      <td className={styles.statNum}>{c.rel_start.toFixed(6)}</td>
                      <td className={styles.statNum}>{c.duration.toFixed(4)}</td>
                      <td className={styles.statNum}>{bitsText(c.bits_per_second_ab)} bits/s</td>
                      <td className={styles.statNum}>{bitsText(c.bits_per_second_ba)} bits/s</td>
                    </tr>
                  );
                })()
              ) : (
                (() => {
                  const e = row as EndpointRow;
                  return (
                    <tr key={index} className={picked === index ? styles.statRowSelected : ""} onClick={() => setPicked(index)}>
                      <td>{e.address}</td>
                      {ported ? <td className={styles.statNum}>{e.port}</td> : null}
                      <td className={styles.statNum}>{e.packets}</td>
                      <td className={styles.statNum}>{bytesText(e.bytes)} bytes</td>
                      <td className={styles.statNum}>{e.tx_packets}</td>
                      <td className={styles.statNum}>{bytesText(e.tx_bytes)} bytes</td>
                      <td className={styles.statNum}>{e.rx_packets}</td>
                      <td className={styles.statNum}>{bytesText(e.rx_bytes)} bytes</td>
                    </tr>
                  );
                })()
              ),
            )}
            {!rows.length ? (
              <tr>
                <td colSpan={15} style={{ color: "#6d6d6d" }}>
                  No {KINDS.find((k) => k.id === kind)?.label} {mode} in {limit ? "the displayed packets" : "this capture"}.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}

// ------------------------------------------------------------------------------------------- Capture Options
export interface CaptureSettings {
  interface: string;
  filter: string;
  maxPackets: number;
  maxSeconds: number;
}

export function CaptureOptionsDialog({
  interfaces,
  reason,
  initial,
  onClose,
  onStart,
}: {
  interfaces: LiveInterface[];
  reason: string;
  initial: CaptureSettings;
  onClose: () => void;
  onStart: (settings: CaptureSettings) => void;
}) {
  const [tab, setTab] = useState<"input" | "options">("input");
  const [value, setValue] = useState<CaptureSettings>(initial);
  return (
    <Dialog
      title="Wireshark · Capture Options"
      onClose={onClose}
      width={900}
      height={500}
      buttons={
        <button type="button" className={`${styles.qtButton} ${styles.qtButtonDefault}`} disabled={!interfaces.length || !value.interface} onClick={() => onStart(value)}>
          Start
        </button>
      }
    >
      <div className={styles.tabStrip} role="tablist">
        {(["input", "options"] as const).map((id) => (
          <button key={id} type="button" role="tab" className={`${styles.tab} ${tab === id ? styles.tabActive : ""}`} onClick={() => setTab(id)}>
            {id === "input" ? "Input" : "Options"}
          </button>
        ))}
      </div>
      {tab === "input" ? (
        <>
          <div className={styles.statTableWrap}>
            <table className={styles.statTable}>
              <thead>
                <tr>
                  <th style={{ minWidth: 380 }}>Interface</th>
                  <th>Link-layer Header</th>
                  <th>Promiscuous</th>
                  <th>Snaplen (B)</th>
                  <th>Capture Filter</th>
                </tr>
              </thead>
              <tbody>
                {interfaces.map((item) => (
                  <tr
                    key={item.id}
                    className={value.interface === item.id ? styles.statRowSelected : ""}
                    onClick={() => setValue({ ...value, interface: item.id })}
                    onDoubleClick={() => onStart({ ...value, interface: item.id })}
                  >
                    <td>
                      {item.name}
                      {item.description && item.description !== item.name ? `: ${item.description}` : ""}
                      {item.name !== item.id ? <span style={{ opacity: 0.7 }}> ({item.id})</span> : null}
                    </td>
                    <td>Ethernet</td>
                    <td>enabled</td>
                    <td>default</td>
                    <td>{value.interface === item.id ? value.filter : ""}</td>
                  </tr>
                ))}
                {!interfaces.length ? (
                  <tr>
                    <td colSpan={5}>
                      <strong>No interfaces found.</strong>
                      <div style={{ whiteSpace: "normal", maxWidth: 780, marginTop: 4 }}>{reason}</div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <label className={styles.captureFilterRow}>
            <span>Capture filter for selected interfaces:</span>
            <input
              className={styles.captureFilterInput}
              value={value.filter}
              placeholder="Enter a capture filter …"
              onChange={(event) => setValue({ ...value, filter: event.target.value })}
            />
          </label>
        </>
      ) : (
        <fieldset className={styles.groupBox}>
          <legend>Stop capture automatically after…</legend>
          <div className={styles.formGrid}>
            <input
              className={styles.smallInput}
              type="number"
              min={1}
              max={5000}
              value={value.maxPackets}
              onChange={(event) => setValue({ ...value, maxPackets: Math.max(1, Math.min(5000, Number(event.target.value) || 1)) })}
            />
            <span>packets (at most 5000)</span>
            <input
              className={styles.smallInput}
              type="number"
              min={1}
              max={120}
              value={value.maxSeconds}
              onChange={(event) => setValue({ ...value, maxSeconds: Math.max(1, Math.min(120, Number(event.target.value) || 1)) })}
            />
            <span>seconds (at most 120)</span>
          </div>
        </fieldset>
      )}
    </Dialog>
  );
}

// ------------------------------------------------------------------------------------------- Save / Export
export type ExportMode = "save" | "export" | "dissections";
export interface ExportChoice {
  which: "all" | "displayed" | "marked";
  format: string;
  details: boolean;
  bytes: boolean;
}

export function ExportDialog({
  mode,
  counts,
  file,
  defaultFormat,
  onClose,
  onExport,
}: {
  mode: ExportMode;
  defaultFormat?: string;
  counts: { all: number; displayed: number; marked: number };
  file: string;
  onClose: () => void;
  onExport: (choice: ExportChoice) => void;
}) {
  const [choice, setChoice] = useState<ExportChoice>({
    which: mode === "save" ? "all" : "displayed",
    format: defaultFormat ?? (mode === "dissections" ? "txt" : file.endsWith(".pcap") ? "pcap" : "pcapng"),
    details: true,
    bytes: false,
  });
  const title =
    mode === "save" ? "Save Capture File As" : mode === "export" ? "Export Specified Packets" : "Export Packet Dissections";
  return (
    <Dialog
      title={`Wireshark · ${title}`}
      onClose={onClose}
      width={560}
      height={mode === "dissections" ? 430 : 360}
      buttons={
        <button
          type="button"
          className={`${styles.qtButton} ${styles.qtButtonDefault}`}
          disabled={counts[choice.which] === 0}
          onClick={() => onExport(choice)}
        >
          Save
        </button>
      }
    >
      {mode !== "save" ? (
        <fieldset className={styles.groupBox}>
          <legend>Packet Range</legend>
          {(["all", "displayed", "marked"] as const).map((which) => (
            <label key={which} className={styles.qtCheck} style={{ display: "flex", marginBottom: 4 }}>
              <input type="radio" name="which" checked={choice.which === which} onChange={() => setChoice({ ...choice, which })} />
              <span style={{ width: 210 }}>
                {which === "all" ? "All packets" : which === "displayed" ? "All displayed packets" : "Marked packets only"}
              </span>
              <span>{counts[which]}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p>Writes all {counts.all} packets of {file} to a new capture file.</p>
      )}
      {mode === "dissections" ? (
        <fieldset className={styles.groupBox}>
          <legend>Packet Format</legend>
          <label className={styles.qtCheck} style={{ display: "flex" }}>
            <input type="checkbox" checked disabled /> Summary line
          </label>
          <label className={styles.qtCheck} style={{ display: "flex" }}>
            <input type="checkbox" checked={choice.details} disabled={choice.format === "csv"} onChange={(e) => setChoice({ ...choice, details: e.target.checked })} />
            Details: All expanded
          </label>
          <label className={styles.qtCheck} style={{ display: "flex" }}>
            <input type="checkbox" checked={choice.bytes} disabled={choice.format === "csv"} onChange={(e) => setChoice({ ...choice, bytes: e.target.checked })} />
            Bytes
          </label>
        </fieldset>
      ) : null}
      <label className={styles.captureFilterRow}>
        <span style={{ width: 70 }}>Save as:</span>
        <select className={styles.searchSelect} value={choice.format} onChange={(event) => setChoice({ ...choice, format: event.target.value })}>
          {mode === "dissections" ? (
            <>
              <option value="txt">Plain text (*.txt)</option>
              <option value="csv">Comma separated values (*.csv)</option>
            </>
          ) : (
            <>
              <option value="pcapng">Wireshark/… - pcapng (*.pcapng)</option>
              <option value="pcap">Wireshark/tcpdump/… - pcap (*.pcap)</option>
            </>
          )}
        </select>
      </label>
      <p className={styles.dialogNote}>The file is downloaded by your browser.</p>
    </Dialog>
  );
}

// ------------------------------------------------------------------------------------------- Help
export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="About this packet analyzer" onClose={onClose} width={620} height={360}>
      <div className={styles.propText}>
        <h3>LabMate packet analyzer (practice environment)</h3>
        <p>
          A simplified packet analyzer for undergraduate networking labs, laid out like Wireshark. It is not Wireshark and is not made by the
          Wireshark Foundation.
        </p>
        <p>
          It reads real .pcap and .pcapng files and decodes Ethernet, ARP, IPv4, IPv6, ICMP, ICMPv6, TCP, UDP, DNS, DHCP and HTTP from the
          captured bytes. Display filters, statistics, search and export are computed from the same packets.
        </p>
        <p>
          Not included: deep protocol dissectors, decryption, VoIP and wireless analysis, and expert-system diagnostics. For those, use Wireshark
          itself (wireshark.org).
        </p>
      </div>
    </Dialog>
  );
}

export function FilterReferenceDialog({
  data,
  onClose,
  onUse,
}: {
  data: { protocols: string[]; fields: string[] } | null;
  onClose: () => void;
  onUse: (text: string) => void;
}) {
  const [search, setSearch] = useState("");
  const items = useMemo(() => {
    if (!data) return [];
    const all = [...data.protocols.map((p) => ({ name: p, kind: "Protocol" })), ...data.fields.map((f) => ({ name: f, kind: "Field" }))];
    const q = search.trim().toLowerCase();
    return all.filter((item) => !q || item.name.includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  }, [data, search]);
  return (
    <Dialog title="Wireshark · Display Filter Reference" onClose={onClose} width={640} height={560}>
      <label className={styles.captureFilterRow}>
        <span>Search:</span>
        <input className={styles.captureFilterInput} value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
      </label>
      <div className={styles.statTableWrap}>
        <table className={styles.statTable}>
          <thead>
            <tr>
              <th style={{ minWidth: 340 }}>Name</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.name} onDoubleClick={() => onUse(item.name)}>
                <td style={{ fontFamily: "var(--ws-mono)" }}>{item.name}</td>
                <td>{item.kind}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.dialogNote}>
        Operators: == != &gt; &lt; &gt;= &lt;= contains matches and or not (&amp;&amp; || !). Double-click a name to put it in the filter bar.
      </p>
    </Dialog>
  );
}
