export interface WsRow {
  no: number;
  time: number;
  source: string;
  destination: string;
  protocol: string;
  length: number;
  info: string;
  stream: number;
  color: { rule: string; bg: string; fg: string };
}

export interface WsTreeNode {
  label: string;
  start: number;
  end: number;
  children: WsTreeNode[];
}

export interface WsDetail {
  no: number;
  tree: WsTreeNode[];
  hex: { offset: number; hex: string[]; ascii: string }[];
  bytes: number;
  row: WsRow;
}

export interface WsStreamData {
  stream: number;
  packets: number[];
  client: string;
  server: string;
  client_packets: number;
  server_packets: number;
  turns: number;
  chunks: { side: "c" | "s"; text: string; bytes: number }[];
}

function makeHexRows(bytes: number[]): { offset: number; hex: string[]; ascii: string }[] {
  const out: { offset: number; hex: string[]; ascii: string }[] = [];
  for (let off = 0; off < bytes.length; off += 16) {
    const chunk = bytes.slice(off, off + 16);
    const hex = chunk.map((b) => b.toString(16).padStart(2, "0"));
    const ascii = chunk.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ".")).join("");
    out.push({ offset: off, hex, ascii });
  }
  return out;
}

function padBytes(prefix: number[], len: number): number[] {
  const arr = [...prefix];
  while (arr.length < len) arr.push((arr.length * 13 + 7) & 0x7e);
  return arr.slice(0, len);
}

export function buildEducationalHttpsDnsCapture(): {
  file: string;
  packets: WsRow[];
  details: Record<string, WsDetail>;
  streams: Record<string, WsStreamData>;
} {
  const rows: WsRow[] = [
    { no: 1, time: 0.0, source: "Intel_42:10:01", destination: "Broadcast", protocol: "ARP", length: 60, info: "Who has 192.168.1.1? Tell 192.168.1.15", stream: -1, color: { rule: "ARP", bg: "#FAF0D7", fg: "#12272E" } },
    { no: 2, time: 0.00112, source: "Cisco_01:02:03", destination: "Intel_42:10:01", protocol: "ARP", length: 60, info: "192.168.1.1 is at 00:0c:29:01:02:03", stream: -1, color: { rule: "ARP", bg: "#FAF0D7", fg: "#12272E" } },
    { no: 3, time: 0.0154, source: "192.168.1.15", destination: "8.8.8.8", protocol: "DNS", length: 74, info: "Standard query 0x1a2b A www.google.com", stream: -1, color: { rule: "UDP", bg: "#DAEEFF", fg: "#12272E" } },
    { no: 4, time: 0.0321, source: "8.8.8.8", destination: "192.168.1.15", protocol: "DNS", length: 90, info: "Standard query response 0x1a2b A www.google.com A 142.250.193.68", stream: -1, color: { rule: "UDP", bg: "#DAEEFF", fg: "#12272E" } },
    { no: 5, time: 0.0342, source: "192.168.1.15", destination: "142.250.193.68", protocol: "TCP", length: 66, info: "54321 → 443 [SYN] Seq=0 Win=64240 Len=0 MSS=1460 WS=256", stream: 0, color: { rule: "TCP SYN/FIN", bg: "#A0A0A0", fg: "#12272E" } },
    { no: 6, time: 0.0489, source: "142.250.193.68", destination: "192.168.1.15", protocol: "TCP", length: 66, info: "443 → 54321 [SYN, ACK] Seq=0 Ack=1 Win=65535 Len=0 MSS=1412", stream: 0, color: { rule: "TCP SYN/FIN", bg: "#A0A0A0", fg: "#12272E" } },
    { no: 7, time: 0.0493, source: "192.168.1.15", destination: "142.250.193.68", protocol: "TCP", length: 54, info: "54321 → 443 [ACK] Seq=1 Ack=1 Win=131328 Len=0", stream: 0, color: { rule: "TCP", bg: "#E7E6FF", fg: "#12272E" } },
    { no: 8, time: 0.0518, source: "192.168.1.15", destination: "142.250.193.68", protocol: "TLSv1.3", length: 248, info: "Client Hello (SNI=www.google.com)", stream: 0, color: { rule: "TCP", bg: "#E7E6FF", fg: "#12272E" } },
    { no: 9, time: 0.0681, source: "142.250.193.68", destination: "192.168.1.15", protocol: "TLSv1.3", length: 186, info: "Server Hello, Change Cipher Spec", stream: 0, color: { rule: "TCP", bg: "#E7E6FF", fg: "#12272E" } },
    { no: 10, time: 0.1204, source: "192.168.1.15", destination: "192.168.1.1", protocol: "ICMP", length: 74, info: "Echo (ping) request  id=0x0002, seq=1/256, ttl=128 (reply in 11)", stream: -1, color: { rule: "ICMP", bg: "#FCE0FF", fg: "#12272E" } },
    { no: 11, time: 0.1219, source: "192.168.1.1", destination: "192.168.1.15", protocol: "ICMP", length: 74, info: "Echo (ping) reply    id=0x0002, seq=1/256, ttl=64 (request in 10)", stream: -1, color: { rule: "ICMP", bg: "#FCE0FF", fg: "#12272E" } },
    { no: 12, time: 0.1852, source: "192.168.1.15", destination: "142.250.193.68", protocol: "TCP", length: 54, info: "54321 → 443 [FIN, ACK] Seq=195 Ack=133 Win=131328 Len=0", stream: 0, color: { rule: "TCP SYN/FIN", bg: "#A0A0A0", fg: "#12272E" } },
  ];

  const details: Record<string, WsDetail> = {};
  for (const row of rows) {
    const raw = padBytes(
      row.protocol === "ARP"
        ? [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x1b, 0x21, 0x42, 0x10, 0x01, 0x08, 0x06, 0x00, 0x01, 0x08, 0x00, 0x06, 0x04, 0x00, row.no === 1 ? 1 : 2]
        : [0x00, 0x0c, 0x29, 0x01, 0x02, 0x03, 0x00, 0x1b, 0x21, 0x42, 0x10, 0x01, 0x08, 0x00, 0x45, 0x00, 0x00, row.length - 14, 0x12, 0x34, 0x40, 0x00, 0x40, row.protocol === "DNS" ? 17 : row.protocol === "ICMP" ? 1 : 6],
      row.length,
    );

    const tree: WsTreeNode[] = [
      { label: `Frame ${row.no}: ${row.length} bytes on wire (${row.length * 8} bits), ${row.length} bytes captured`, start: 0, end: row.length, children: [] },
      {
        label: `Ethernet II, Src: ${row.source}, Dst: ${row.destination}`,
        start: 0,
        end: 14,
        children: [
          { label: "Destination: 00:0c:29:01:02:03", start: 0, end: 6, children: [] },
          { label: "Source: 00:1b:21:42:10:01", start: 6, end: 12, children: [] },
          { label: `Type: ${row.protocol === "ARP" ? "ARP (0x0806)" : "IPv4 (0x0800)"}`, start: 12, end: 14, children: [] },
        ],
      },
    ];

    if (row.protocol === "ARP") {
      tree.push({
        label: `Address Resolution Protocol (${row.no === 1 ? "request" : "reply"})`,
        start: 14,
        end: 42,
        children: [
          { label: "Hardware type: Ethernet (1)", start: 14, end: 16, children: [] },
          { label: "Protocol type: IPv4 (0x0800)", start: 16, end: 18, children: [] },
          { label: `Opcode: ${row.no === 1 ? "request (1)" : "reply (2)"}`, start: 20, end: 22, children: [] },
          { label: "Sender IP address: 192.168.1.15", start: 28, end: 32, children: [] },
          { label: "Target IP address: 192.168.1.1", start: 38, end: 42, children: [] },
        ],
      });
    } else {
      tree.push({
        label: `Internet Protocol Version 4, Src: ${row.source}, Dst: ${row.destination}`,
        start: 14,
        end: 34,
        children: [
          { label: "0100 .... = Version: 4", start: 14, end: 15, children: [] },
          { label: ".... 0101 = Header Length: 20 bytes (5)", start: 14, end: 15, children: [] },
          { label: "Time to Live: 64", start: 22, end: 23, children: [] },
          { label: `Source Address: ${row.source}`, start: 26, end: 30, children: [] },
          { label: `Destination Address: ${row.destination}`, start: 30, end: 34, children: [] },
        ],
      });

      if (row.protocol === "DNS") {
        tree.push({
          label: `User Datagram Protocol, Src Port: ${row.no === 3 ? 51204 : 53}, Dst Port: ${row.no === 3 ? 53 : 51204}`,
          start: 34,
          end: 42,
          children: [],
        });
        tree.push({
          label: `Domain Name System (${row.no === 3 ? "query" : "response"})`,
          start: 42,
          end: row.length,
          children: [
            { label: "Transaction ID: 0x1a2b", start: 42, end: 44, children: [] },
            { label: `Flags: ${row.no === 3 ? "0x0100 Standard query" : "0x8180 Standard query response, No error"}`, start: 44, end: 46, children: [] },
            { label: "Queries: www.google.com: type A, class IN", start: 46, end: row.length, children: [] },
          ],
        });
      } else if (row.protocol === "ICMP") {
        tree.push({
          label: `Internet Control Message Protocol (${row.no === 10 ? "Echo request" : "Echo reply"})`,
          start: 34,
          end: row.length,
          children: [
            { label: `Type: ${row.no === 10 ? "8 (Echo (ping) request)" : "0 (Echo (ping) reply)"}`, start: 34, end: 35, children: [] },
            { label: "Code: 0", start: 35, end: 36, children: [] },
          ],
        });
      } else {
        tree.push({
          label: `Transmission Control Protocol, Src Port: ${row.source === "192.168.1.15" ? 54321 : 443}, Dst Port: ${row.source === "192.168.1.15" ? 443 : 54321}`,
          start: 34,
          end: 54,
          children: [
            { label: `Source Port: ${row.source === "192.168.1.15" ? 54321 : 443}`, start: 34, end: 36, children: [] },
            { label: `Destination Port: ${row.source === "192.168.1.15" ? 443 : 54321}`, start: 36, end: 38, children: [] },
            { label: `Info: ${row.info}`, start: 38, end: 54, children: [] },
          ],
        });
      }
    }

    details[String(row.no)] = {
      no: row.no,
      tree,
      hex: makeHexRows(raw),
      bytes: row.length,
      row,
    };
  }

  return {
    file: "google-dns-tls.pcapng",
    packets: rows,
    details,
    streams: {
      "0": {
        stream: 0,
        packets: [5, 6, 7, 8, 9, 12],
        client: "192.168.1.15:54321",
        server: "142.250.193.68:443",
        client_packets: 4,
        server_packets: 2,
        turns: 2,
        chunks: [
          { side: "c", text: "...TLSv1.3 Client Hello (SNI: www.google.com)...", bytes: 194 },
          { side: "s", text: "...TLSv1.3 Server Hello (Encrypted Application Data)...", bytes: 132 },
        ],
      },
    },
  };
}

export function evaluateSampleFilter(rows: WsRow[], expr: string): { ok: boolean; numbers?: number[]; error?: string } {
  const e = expr.trim().toLowerCase();
  if (!e) return { ok: true, numbers: rows.map((r) => r.no) };
  if (["dns", "tcp", "udp", "icmp", "arp", "http", "tls"].includes(e)) {
    const hits = rows.filter((r) => {
      if (e === "udp") return r.protocol === "DNS" || r.protocol === "UDP";
      if (e === "tcp") return r.protocol === "TCP" || r.protocol === "TLSv1.3" || r.protocol === "HTTP";
      if (e === "tls") return r.protocol === "TLSv1.3";
      return r.protocol.toLowerCase() === e;
    });
    return { ok: true, numbers: hits.map((r) => r.no) };
  }
  const ipMatch = e.match(/^ip\.addr\s*==\s*([0-9.]+)$/);
  if (ipMatch) {
    const ip = ipMatch[1];
    return { ok: true, numbers: rows.filter((r) => r.source === ip || r.destination === ip).map((r) => r.no) };
  }
  const portMatch = e.match(/^tcp\.port\s*==\s*(\d+)$/);
  if (portMatch) {
    const port = portMatch[1];
    return {
      ok: true,
      numbers: rows.filter((r) => (r.protocol === "TCP" || r.protocol === "TLSv1.3") && r.info.includes(port)).map((r) => r.no),
    };
  }
  const dnsContains = e.match(/^dns\.qry\.name\s+contains\s+"([^"]+)"$/);
  if (dnsContains) {
    const sub = dnsContains[1];
    return {
      ok: true,
      numbers: rows.filter((r) => r.protocol === "DNS" && r.info.toLowerCase().includes(sub)).map((r) => r.no),
    };
  }
  return { ok: false, error: `"${expr}" is not a valid display filter syntax.` };
}
