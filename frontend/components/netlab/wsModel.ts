/** Types and pure helpers of the packet analyzer studio. Everything shown comes from the backend's dissection. */

export interface Row {
  no: number;
  time: number;
  epoch: number;
  source: string;
  destination: string;
  protocol: string;
  length: number;
  info: string;
  stream: number;
  udp_stream?: number;
  eth_src?: string;
  eth_dst?: string;
  ip_src?: string;
  ip_dst?: string;
  srcport?: number | null;
  dstport?: number | null;
  color: { rule: string; bg: string; fg: string };
}

export interface TreeNode {
  label: string;
  start: number;
  end: number;
  children: TreeNode[];
  abbrev?: string;
  value?: string | number;
  filter?: string;
}

export interface Detail {
  no: number;
  tree: TreeNode[];
  hex: { offset: number; hex: string[]; ascii: string }[];
  bytes: number;
  row: Row;
}

export interface StreamData {
  stream: number;
  packets: number[];
  client: string;
  server: string;
  client_packets: number;
  server_packets: number;
  turns: number;
  chunks: { side: "c" | "s"; text: string; bytes: number }[];
}

export interface BrowserPage {
  host: string;
  uri: string;
  fields: string[];
  values: Record<string, string>;
}

export interface Step {
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

/** What the report-capture service hands the page through window.__labmate.load (backend wireshark_lab.studio_state). */
export interface FrozenState {
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

export interface CaptureMeta {
  name: string;
  length: number;
  sha256: string;
  format: string;
  source_note: string;
}

export interface SampleCapture {
  id: string;
  file: string;
  title: string;
  description: string;
}

export interface LiveInterface {
  id: string;
  name: string;
  description: string;
  flags: string;
}

export type TimeFormat = "relative" | "delta" | "delta_displayed" | "datetime" | "time" | "epoch" | "utc_datetime" | "utc_time";

export const TIME_FORMATS: { id: TimeFormat; label: string; shortcut: string }[] = [
  { id: "datetime", label: "Date and Time of Day (1970-01-01 01:02:03.123456)", shortcut: "Ctrl+Alt+1" },
  { id: "time", label: "Time of Day (01:02:03.123456)", shortcut: "Ctrl+Alt+3" },
  { id: "epoch", label: "Seconds Since 1970-01-01", shortcut: "Ctrl+Alt+4" },
  { id: "relative", label: "Seconds Since Beginning of Capture", shortcut: "Ctrl+Alt+5" },
  { id: "delta", label: "Seconds Since Previous Captured Packet", shortcut: "Ctrl+Alt+6" },
  { id: "delta_displayed", label: "Seconds Since Previous Displayed Packet", shortcut: "Ctrl+Alt+7" },
  { id: "utc_datetime", label: "UTC Date and Time of Day (1970-01-01 01:02:03.123456)", shortcut: "Ctrl+Alt+8" },
  { id: "utc_time", label: "UTC Time of Day (01:02:03.123456)", shortcut: "Ctrl+Alt+0" },
];

function pad(value: number, width = 2) {
  return String(value).padStart(width, "0");
}

function clock(epoch: number, utc: boolean, withDate: boolean) {
  const whole = Math.floor(epoch);
  const micro = Math.round((epoch - whole) * 1e6);
  const date = new Date(whole * 1000);
  const y = utc ? date.getUTCFullYear() : date.getFullYear();
  const mo = utc ? date.getUTCMonth() + 1 : date.getMonth() + 1;
  const d = utc ? date.getUTCDate() : date.getDate();
  const h = utc ? date.getUTCHours() : date.getHours();
  const mi = utc ? date.getUTCMinutes() : date.getMinutes();
  const s = utc ? date.getUTCSeconds() : date.getSeconds();
  const time = `${pad(h)}:${pad(mi)}:${pad(s)}.${pad(micro, 6)}`;
  return withDate ? `${y}-${pad(mo)}-${pad(d)} ${time}` : time;
}

/** The Time column text for one row, as View > Time Display Format chooses it. */
export function formatTime(row: Row, format: TimeFormat, previousCaptured?: Row, previousDisplayed?: Row): string {
  switch (format) {
    case "datetime":
      return clock(row.epoch, false, true);
    case "time":
      return clock(row.epoch, false, false);
    case "utc_datetime":
      return clock(row.epoch, true, true);
    case "utc_time":
      return clock(row.epoch, true, false);
    case "epoch":
      return row.epoch.toFixed(6);
    case "delta":
      return (previousCaptured ? row.epoch - previousCaptured.epoch : 0).toFixed(6);
    case "delta_displayed":
      return (previousDisplayed ? row.epoch - previousDisplayed.epoch : 0).toFixed(6);
    default:
      return row.time.toFixed(6);
  }
}

/** Source/Destination text with physical-address resolution switched off: the raw MAC instead of "Intel_3a:4f:5c". */
export function address(row: Row, which: "source" | "destination", resolveMac: boolean): string {
  const shown = row[which];
  if (resolveMac) return shown;
  const ip = which === "source" ? row.ip_src : row.ip_dst;
  if (ip) return shown;
  return (which === "source" ? row.eth_src : row.eth_dst) || shown;
}

export function nodeAt(tree: TreeNode[], key: string | null): TreeNode | null {
  if (key === null) return null;
  let nodes = tree;
  let node: TreeNode | undefined;
  for (const part of key.split(".").map(Number)) {
    node = nodes[part];
    if (!node) return null;
    nodes = node.children;
  }
  return node ?? null;
}

/** The deepest details line whose bytes include `offset`, the line Wireshark selects when a byte is clicked. */
export function deepestAt(tree: TreeNode[], offset: number, path: number[] = []): string | null {
  let best: string | null = null;
  tree.forEach((node, index) => {
    if (node.end > node.start && offset >= node.start && offset < node.end) {
      const here = [...path, index];
      best = deepestAt(node.children, offset, here) ?? here.join(".");
    }
  });
  return best;
}

export function ancestors(key: string): string[] {
  const parts = key.split(".");
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("."));
}

export function allKeys(tree: TreeNode[], path: number[] = []): string[] {
  const out: string[] = [];
  tree.forEach((node, index) => {
    const here = [...path, index];
    if (node.children.length) {
      out.push(here.join("."));
      out.push(...allKeys(node.children, here));
    }
  });
  return out;
}

/** "Source Address (ip.src), 4 bytes" for the status bar. */
export function fieldStatus(node: TreeNode): string {
  const size = node.end - node.start;
  const name = node.label.replace(/^\[|\]$/g, "").split(/: |, Src| = /)[0].replace(/^[.01 ]+= /, "");
  const label = node.abbrev ? `${name} (${node.abbrev})` : name;
  return size > 0 ? `${label}, ${size} byte${size === 1 ? "" : "s"}` : label;
}

export function quoteValue(value: string | number): string {
  if (typeof value === "number") return String(value);
  if (/^(\d{1,3}(\.\d{1,3}){3}|[0-9a-f]{2}(:[0-9a-f]{2}){5}|0x[0-9a-f]+|-?\d+(\.\d+)?|[0-9a-f]{0,4}(:[0-9a-f]{0,4}){2,7})$/i.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Filters of Analyze > Conversation Filter for one packet. */
export function conversationFilters(row: Row): { label: string; filter: string }[] {
  const out: { label: string; filter: string }[] = [];
  if (row.eth_src && row.eth_dst) out.push({ label: "Ethernet", filter: `eth.addr == ${row.eth_src} && eth.addr == ${row.eth_dst}` });
  if (row.ip_src && row.ip_dst) {
    const v6 = row.ip_src.includes(":");
    out.push({ label: v6 ? "IPv6" : "IPv4", filter: `${v6 ? "ipv6" : "ip"}.addr == ${row.ip_src} && ${v6 ? "ipv6" : "ip"}.addr == ${row.ip_dst}` });
  }
  if (row.stream >= 0) out.push({ label: "TCP", filter: `tcp.stream eq ${row.stream}` });
  if ((row.udp_stream ?? -1) >= 0) out.push({ label: "UDP", filter: `udp.stream eq ${row.udp_stream}` });
  return out;
}

export function bytesText(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} G`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} M`;
  if (value >= 1e4) return `${Math.round(value / 1e3)} k`;
  return String(value);
}

export function bitsText(value: number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} G`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)} k`;
  return String(value);
}

export function errorText(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

export function download(blob: Blob, name: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
}

export const COMMON_FILTERS = [
  "ip", "ipv6", "tcp", "udp", "dns", "http", "icmp", "arp", "dhcp", "tcp.port == 80", "udp.port == 53", "ip.addr == 192.168.1.1",
  "tcp.flags.syn == 1", "tcp.flags.syn == 1 && tcp.flags.ack == 0", "tcp.flags.reset == 1", 'http.request.method == "POST"',
  'dns.qry.name contains "example"', "dns.flags.rcode != 0", "eth.dst == ff:ff:ff:ff:ff:ff", "!(arp || dns)",
];
