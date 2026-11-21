import type {
  CableType,
  DeviceKind,
  DeviceModelMeta,
  PtCable,
  PtDevice,
  PtEvent,
  PtRouteRow,
  PtSpec,
  ServerServices,
} from "./ptTypes.ts";

export const DEVICE_CATALOG: Record<string, DeviceModelMeta[]> = {
  routers: [
    { model: "1941", label: "1941", kind: "router", hasCli: true, mdiX: false, defaultPorts: ["Console", "GigabitEthernet0/0", "GigabitEthernet0/1", "Serial0/0/0", "Serial0/0/1"] },
    { model: "2901", label: "2901", kind: "router", hasCli: true, mdiX: false, defaultPorts: ["Console", "GigabitEthernet0/0", "GigabitEthernet0/1", "Serial0/0/0", "Serial0/0/1"] },
    { model: "2911", label: "2911", kind: "router", hasCli: true, mdiX: false, defaultPorts: ["Console", "GigabitEthernet0/0", "GigabitEthernet0/1", "GigabitEthernet0/2", "Serial0/0/0"] },
    { model: "1841", label: "1841", kind: "router", hasCli: true, mdiX: false, defaultPorts: ["Console", "FastEthernet0/0", "FastEthernet0/1", "Serial0/0/0", "Serial0/0/1"] },
    { model: "4321", label: "4321", kind: "router", hasCli: true, mdiX: false, defaultPorts: ["Console", "GigabitEthernet0/0/0", "GigabitEthernet0/0/1", "Serial0/1/0"] },
    { model: "4331", label: "4331", kind: "router", hasCli: true, mdiX: false, defaultPorts: ["Console", "GigabitEthernet0/0/0", "GigabitEthernet0/0/1", "GigabitEthernet0/0/2"] },
    { model: "PT-Router", label: "PT-Router", kind: "router", hasCli: true, mdiX: false, defaultPorts: ["Console", "FastEthernet0/0", "FastEthernet1/0", "FastEthernet2/0", "Serial2/0", "Serial3/0"] },
  ],
  switches: [
    { model: "2960-24TT", label: "2960-24TT", kind: "switch", hasCli: true, mdiX: true, defaultPorts: ["Console", "FastEthernet0/1", "FastEthernet0/2", "FastEthernet0/3", "FastEthernet0/4", "FastEthernet0/5", "FastEthernet0/6", "GigabitEthernet0/1", "GigabitEthernet0/2"] },
    { model: "3560-24PS", label: "3560-24PS", kind: "switch", hasCli: true, mdiX: true, defaultPorts: ["Console", "FastEthernet0/1", "FastEthernet0/2", "FastEthernet0/3", "FastEthernet0/4", "GigabitEthernet0/1", "GigabitEthernet0/2"] },
    { model: "3650-24PS", label: "3650-24PS", kind: "switch", hasCli: true, mdiX: true, defaultPorts: ["Console", "GigabitEthernet1/0/1", "GigabitEthernet1/0/2", "GigabitEthernet1/0/3", "GigabitEthernet1/0/4"] },
    { model: "PT-Switch", label: "PT-Switch", kind: "switch", hasCli: true, mdiX: true, defaultPorts: ["FastEthernet0/1", "FastEthernet1/1", "FastEthernet2/1", "FastEthernet3/1", "FastEthernet4/1", "FastEthernet5/1"] },
  ],
  hubs: [
    { model: "Hub-PT", label: "Hub-PT", kind: "hub", hasCli: false, mdiX: true, defaultPorts: ["Port 0", "Port 1", "Port 2", "Port 3", "Port 4", "Port 5"] },
    { model: "Repeater-PT", label: "Repeater-PT", kind: "hub", hasCli: false, mdiX: true, defaultPorts: ["Port 0", "Port 1"] },
    { model: "CoAxialSplitter-PT", label: "CoAxialSplitter", kind: "hub", hasCli: false, mdiX: true, defaultPorts: ["Port 0", "Port 1", "Port 2"] },
  ],
  wireless: [
    { model: "WRT300N", label: "WRT300N", kind: "wireless", hasCli: false, mdiX: true, defaultPorts: ["Internet", "Ethernet 1", "Ethernet 2", "Ethernet 3", "Ethernet 4"] },
    { model: "AccessPoint-PT", label: "AP-PT", kind: "wireless", hasCli: false, mdiX: true, defaultPorts: ["Port 0"] },
    { model: "WLC-2504", label: "WLC-2504", kind: "wireless", hasCli: true, mdiX: true, defaultPorts: ["Console", "GigabitEthernet0/0/1", "GigabitEthernet0/0/2"] },
  ],
  security: [
    { model: "ASA 5505", label: "ASA 5505", kind: "security", hasCli: true, mdiX: false, defaultPorts: ["Console", "Ethernet0/0", "Ethernet0/1", "Ethernet0/2"] },
    { model: "ASA 5506-X", label: "ASA 5506-X", kind: "security", hasCli: true, mdiX: false, defaultPorts: ["Console", "GigabitEthernet1/1", "GigabitEthernet1/2", "GigabitEthernet1/3"] },
  ],
  wan: [
    { model: "Cloud-PT", label: "Cloud-PT", kind: "cloud", hasCli: false, mdiX: true, defaultPorts: ["Ethernet6", "Serial0", "Coaxial7", "Modem4"] },
    { model: "DSL-Modem-PT", label: "DSL-Modem", kind: "cloud", hasCli: false, mdiX: true, defaultPorts: ["Port 0", "Port 1"] },
    { model: "Cable-Modem-PT", label: "Cable-Modem", kind: "cloud", hasCli: false, mdiX: true, defaultPorts: ["Port 0", "Port 1"] },
  ],
  end: [
    { model: "PC-PT", label: "PC-PT", kind: "pc", hasCli: false, mdiX: false, defaultPorts: ["RS 232", "FastEthernet0"] },
    { model: "Laptop-PT", label: "Laptop-PT", kind: "laptop", hasCli: false, mdiX: false, defaultPorts: ["RS 232", "FastEthernet0"] },
    { model: "Server-PT", label: "Server-PT", kind: "server", hasCli: false, mdiX: false, defaultPorts: ["RS 232", "FastEthernet0"] },
    { model: "Printer-PT", label: "Printer-PT", kind: "printer", hasCli: false, mdiX: false, defaultPorts: ["FastEthernet0"] },
    { model: "IP Phone-PT", label: "IP Phone", kind: "ipphone", hasCli: false, mdiX: false, defaultPorts: ["SW", "PC"] },
    { model: "Tablet-PT", label: "Tablet", kind: "tablet", hasCli: false, mdiX: false, defaultPorts: ["Wireless0"] },
    { model: "Smartphone-PT", label: "Smartphone", kind: "smartphone", hasCli: false, mdiX: false, defaultPorts: ["Wireless0"] },
  ],
};

export const CABLE_LIBRARY: { id: CableType; label: string; desc: string; color: string; dashed?: boolean }[] = [
  { id: "auto", label: "Automatically Choose Connection Type", desc: "Auto-selects Straight-Through, Cross-Over, or Serial", color: "#F59E0B" },
  { id: "console", label: "Console", desc: "Rollover light-blue cable (RS 232 to Console)", color: "#0EA5E9" },
  { id: "straight", label: "Copper Straight-Through", desc: "Connects unlike devices (e.g., PC to Switch, Router to Switch)", color: "#1E242B" },
  { id: "cross", label: "Copper Cross-Over", desc: "Connects like devices (PC-PC, Switch-Switch, Hub-Hub, Router-PC)", color: "#1E242B", dashed: true },
  { id: "fiber", label: "Fiber", desc: "Optical fiber link", color: "#EA580C" },
  { id: "phone", label: "Phone", desc: "RJ-11 voice / modem line", color: "#16A34A" },
  { id: "coaxial", label: "Coaxial", desc: "Coaxial RF / Cable TV link", color: "#2563EB" },
  { id: "serial-dce", label: "Serial DCE", desc: "WAN Serial link (DCE clock side)", color: "#DC2626" },
  { id: "serial-dte", label: "Serial DTE", desc: "WAN Serial link (DTE side)", color: "#DC2626" },
];

export function defaultServerServices(): ServerServices {
  return {
    httpEnabled: true,
    httpHtml: "<h1>Welcome to Cisco Packet Tracer HTTP Server</h1><p>LabMate University Networking Practical Server running on port 80.</p>",
    dhcpEnabled: false,
    dhcpPoolName: "serverPool",
    dhcpGateway: "192.168.1.1",
    dhcpDns: "192.168.1.254",
    dhcpStartIp: "192.168.1.10",
    dhcpMask: "255.255.255.0",
    dhcpMaxUsers: 50,
    dnsEnabled: true,
    dnsRecords: [
      { name: "www.labmate.edu", address: "192.168.1.100" },
      { name: "server.local", address: "192.168.1.100" },
    ],
  };
}

export function isEndLike(kind: string): boolean {
  return ["pc", "laptop", "server", "printer", "ipphone", "tablet", "smartphone", "router", "security"].includes(kind);
}

export function isMdiX(device: PtDevice): boolean {
  return ["hub", "switch", "wireless", "cloud"].includes(device.type);
}

export function getDevicePorts(device: PtDevice): string[] {
  const fromIfaces = device.interfaces ? Object.keys(device.interfaces) : [];
  if (device.model) {
    for (const group of Object.values(DEVICE_CATALOG)) {
      const hit = group.find((m) => m.model === device.model || m.label === device.model);
      if (hit) {
        return Array.from(new Set([...hit.defaultPorts, ...fromIfaces]));
      }
    }
  }
  if (device.type === "router") {
    return Array.from(new Set(["Console", "FastEthernet0/0", "FastEthernet0/1", "FastEthernet1/0", "FastEthernet2/0", "Serial0/0/0", ...fromIfaces]));
  }
  if (device.type === "switch") {
    return Array.from(new Set(["Console", "FastEthernet0/1", "FastEthernet0/2", "FastEthernet0/3", "FastEthernet0/4", "FastEthernet0/5", "FastEthernet0/6", "GigabitEthernet0/1", ...fromIfaces]));
  }
  if (device.type === "hub") {
    return ["Port 0", "Port 1", "Port 2", "Port 3", "Port 4", "Port 5"];
  }
  if (device.type === "server" || device.type === "laptop" || device.type === "pc") {
    return ["RS 232", "FastEthernet0"];
  }
  return ["FastEthernet0"];
}

export function syntheticMac(seedName: string, portName = "0"): string {
  let hash = 2166136261;
  const s = `${seedName}:${portName}`;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (n: number) => ((n >>> 0) & 0xff).toString(16).padStart(2, "0");
  return `00:${hex(hash)}:${hex(hash >> 8)}:${hex(hash >> 16)}:${hex(hash >> 24)}:${hex(seedName.length * 17)}`.toUpperCase();
}

export function resolveAutoCable(a: PtDevice, ap: string, b: PtDevice, bp: string): CableType {
  if (ap === "Console" || bp === "Console" || ap === "RS 232" || bp === "RS 232") return "console";
  if (ap.startsWith("Serial") || bp.startsWith("Serial")) return "serial-dce";
  if (ap.startsWith("Coaxial") || bp.startsWith("Coaxial")) return "coaxial";
  return isMdiX(a) === isMdiX(b) ? "cross" : "straight";
}

export function isCableMediaOk(a: PtDevice, ap: string, b: PtDevice, bp: string, cable?: CableType): boolean {
  const kind = cable ?? (isMdiX(a) === isMdiX(b) ? "cross" : "straight");
  if (kind === "auto") return true;
  if (kind === "console") {
    return (ap === "Console" && bp === "RS 232") || (ap === "RS 232" && bp === "Console");
  }
  if (kind === "serial-dce" || kind === "serial-dte") {
    return ap.startsWith("Serial") && bp.startsWith("Serial");
  }
  if (kind === "fiber") return true;
  const ethernetLike = (p: string) =>
    p.startsWith("FastEthernet") || p.startsWith("GigabitEthernet") || p.startsWith("Ethernet") || p.startsWith("Port ") || p === "Internet" || p === "SW" || p === "PC";
  if (!ethernetLike(ap) || !ethernetLike(bp)) return false;
  if (kind === "straight") return isMdiX(a) !== isMdiX(b);
  if (kind === "cross") return isMdiX(a) === isMdiX(b);
  return true;
}

export function isPortShutdown(dev: PtDevice, port: string): boolean {
  if (dev.power === false) return true;
  return Boolean(dev.interfaces?.[port]?.shutdown);
}

export function isLinkUp(spec: PtSpec, cable: PtCable, blockedPorts?: Set<string>): boolean {
  const a = spec.devices.find((d) => d.name === cable.a);
  const b = spec.devices.find((d) => d.name === cable.b);
  if (!a || !b) return false;
  if (a.power === false || b.power === false) return false;
  if (isPortShutdown(a, cable.ap) || isPortShutdown(b, cable.bp)) return false;
  if (blockedPorts && (blockedPorts.has(`${cable.a} ${cable.ap}`) || blockedPorts.has(`${cable.b} ${cable.bp}`))) {
    return false;
  }
  return isCableMediaOk(a, cable.ap, b, cable.bp, cable.cable);
}

export function ipToInt(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let val = 0;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
    val = (val << 8) | n;
  }
  return val >>> 0;
}

export function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function maskToCidr(mask: string): number {
  const m = ipToInt(mask);
  if (m === null) return 24;
  let bits = 0;
  for (let i = 31; i >= 0; i--) {
    if ((m >>> i) & 1) bits++;
    else break;
  }
  return bits;
}

export function sameSubnet(ipA: string, ipB: string, mask: string): boolean {
  const a = ipToInt(ipA);
  const b = ipToInt(ipB);
  const m = ipToInt(mask);
  if (a === null || b === null || m === null) return false;
  return (a & m) === (b & m);
}

export function netAddress(ip: string, mask: string): string {
  const a = ipToInt(ip);
  const m = ipToInt(mask);
  if (a === null || m === null) return ip;
  return intToIp((a & m) >>> 0);
}

/* =========================================================================
 * Local Topology Routing, Ping, Tracert, DNS Simulation
 * ========================================================================= */

export function buildRouterTable(spec: PtSpec, router: PtDevice): PtRouteRow[] {
  const rows: PtRouteRow[] = [];
  const ifaces = router.interfaces ?? {};
  for (const [port, cfg] of Object.entries(ifaces)) {
    if (!cfg.ip || cfg.shutdown) continue;
    const cidr = maskToCidr(cfg.mask || "255.255.255.0");
    rows.push({
      code: "C",
      network: `${netAddress(cfg.ip, cfg.mask || "255.255.255.0")}/${cidr}`,
      interface: port,
      next_hop: "",
      distance: 0,
      metric: 0,
    });
  }
  for (const sr of router.staticRoutes ?? []) {
    const cidr = maskToCidr(sr.mask || "255.255.255.0");
    rows.push({
      code: "S",
      network: `${netAddress(sr.network, sr.mask || "255.255.255.0")}/${cidr}`,
      interface: "via",
      next_hop: sr.nextHop,
      distance: 1,
      metric: 0,
    });
  }
  // If RIP is enabled, propagate neighbor connected networks (BFS distance vector)
  if (router.rip && router.rip.length > 0) {
    const seen = new Set(rows.map((r) => r.network));
    const queue: { dev: PtDevice; dist: number; firstHop: string; exitPort: string }[] = [];
    for (const cable of spec.links) {
      if (!isLinkUp(spec, cable)) continue;
      if (cable.a === router.name || cable.b === router.name) {
        const myPort = cable.a === router.name ? cable.ap : cable.bp;
        const peerName = cable.a === router.name ? cable.b : cable.a;
        const peerPort = cable.a === router.name ? cable.bp : cable.ap;
        const peer = spec.devices.find((d) => d.name === peerName);
        if (peer && peer.type === "router" && peer.rip && peer.rip.length > 0) {
          const hopIp = peer.interfaces?.[peerPort]?.ip ?? "";
          if (hopIp) queue.push({ dev: peer, dist: 1, firstHop: hopIp, exitPort: myPort });
        }
      }
    }
    const visitedRouters = new Set([router.name]);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visitedRouters.has(cur.dev.name)) continue;
      visitedRouters.add(cur.dev.name);
      for (const cfg of Object.values(cur.dev.interfaces ?? {})) {
        if (!cfg.ip || cfg.shutdown) continue;
        const cidr = maskToCidr(cfg.mask || "255.255.255.0");
        const net = `${netAddress(cfg.ip, cfg.mask || "255.255.255.0")}/${cidr}`;
        if (!seen.has(net)) {
          seen.add(net);
          rows.push({
            code: "R",
            network: net,
            interface: cur.exitPort,
            next_hop: cur.firstHop,
            distance: 120,
            metric: cur.dist,
          });
        }
      }
      if (cur.dist < 15) {
        for (const cable of spec.links) {
          if (!isLinkUp(spec, cable)) continue;
          const peerName = cable.a === cur.dev.name ? cable.b : cable.b === cur.dev.name ? cable.a : null;
          if (!peerName || visitedRouters.has(peerName)) continue;
          const peer = spec.devices.find((d) => d.name === peerName);
          if (peer && peer.type === "router" && peer.rip && peer.rip.length > 0) {
            queue.push({ dev: peer, dist: cur.dist + 1, firstHop: cur.firstHop, exitPort: cur.exitPort });
          }
        }
      }
    }
  }
  return rows;
}

export function formatShowIpRoute(spec: PtSpec, router: PtDevice): string[] {
  const table = buildRouterTable(spec, router);
  const lines = [
    "Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP",
    "       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area",
    "",
  ];
  for (const r of table) {
    if (r.code === "C") {
      lines.push(`C    ${r.network} is directly connected, ${r.interface}`);
    } else if (r.code === "S") {
      lines.push(`S    ${r.network} [1/0] via ${r.next_hop}`);
    } else {
      lines.push(`R    ${r.network} [${r.distance}/${r.metric}] via ${r.next_hop}, 00:00:08, ${r.interface}`);
    }
  }
  return lines;
}

export function resolveDnsName(spec: PtSpec, source: PtDevice, hostOrIp: string): string | null {
  if (ipToInt(hostOrIp) !== null) return hostOrIp;
  const dnsServers = spec.devices.filter((d) => d.type === "server" && d.services?.dnsEnabled);
  const targetServer = source.dns ? dnsServers.find((s) => s.ip === source.dns) ?? dnsServers[0] : dnsServers[0];
  const rec = targetServer?.services?.dnsRecords.find((r) => r.name.toLowerCase() === hostOrIp.toLowerCase());
  if (rec) return rec.address;
  const byDevName = spec.devices.find((d) => d.name.toLowerCase() === hostOrIp.toLowerCase() && d.ip);
  return byDevName?.ip ?? null;
}

function getPrimaryIp(dev: PtDevice): string {
  if (dev.ip) return dev.ip;
  const ifaces = dev.interfaces ? Object.values(dev.interfaces) : [];
  for (let i = 0; i < ifaces.length; i++) {
    if (ifaces[i]?.ip && !ifaces[i]?.shutdown) return ifaces[i].ip;
  }
  return ifaces[0]?.ip || "";
}

function getPrimaryMask(dev: PtDevice): string {
  if (dev.mask) return dev.mask;
  const ifaces = dev.interfaces ? Object.values(dev.interfaces) : [];
  for (let i = 0; i < ifaces.length; i++) {
    if (ifaces[i]?.ip && ifaces[i]?.mask) return ifaces[i].mask;
  }
  return "255.255.255.0";
}

/* =========================================================================
 * Layer-3 forwarding used by ping, tracert and Simple PDUs in free practice.
 *
 * A packet is delivered hop by hop as a real network would: a host sends to the destination directly when it is in the
 * host's own subnet, otherwise to its default gateway; each router looks the destination up in its routing table
 * (longest prefix match over connected, static and RIP routes) and forwards to the next hop on the matching interface.
 * Every hop must be reachable over active cables inside one Layer-2 segment (switches and hubs pass frames; routers and
 * end devices end a segment). The reply makes the same journey back, so a missing return route fails the ping too.
 * ========================================================================= */

function isEndpoint(dev: PtDevice): boolean {
  return dev.type === "router" || isEndLike(dev.type);
}

interface Hop {
  device: string;
  port: string;
}

/** Endpoints (hosts and router interfaces) reachable from one device port through switches and hubs, with the device path. */
function segmentFrom(spec: PtSpec, deviceName: string, port: string | null): Map<string, { port: string; path: string[] }> {
  const found = new Map<string, { port: string; path: string[] }>();
  const queue: { name: string; path: string[]; viaPort: string | null }[] = [];
  const visitedL2 = new Set<string>();
  for (const cable of spec.links) {
    if (!isLinkUp(spec, cable)) continue;
    let peer: string | null = null;
    let peerPort = "";
    if (cable.a === deviceName && (port === null || cable.ap === port)) {
      peer = cable.b;
      peerPort = cable.bp;
    } else if (cable.b === deviceName && (port === null || cable.bp === port)) {
      peer = cable.a;
      peerPort = cable.ap;
    }
    if (peer) queue.push({ name: peer, path: [deviceName, peer], viaPort: peerPort });
  }
  while (queue.length) {
    const cur = queue.shift()!;
    const dev = spec.devices.find((d) => d.name === cur.name);
    if (!dev || dev.power === false) continue;
    if (isEndpoint(dev)) {
      if (cur.name !== deviceName && !found.has(cur.name)) found.set(cur.name, { port: cur.viaPort ?? "", path: cur.path });
      continue;
    }
    if (visitedL2.has(cur.name)) continue;
    visitedL2.add(cur.name);
    for (const cable of spec.links) {
      if (!isLinkUp(spec, cable)) continue;
      if (cable.a === cur.name && !cur.path.includes(cable.b)) queue.push({ name: cable.b, path: [...cur.path, cable.b], viaPort: cable.bp });
      else if (cable.b === cur.name && !cur.path.includes(cable.a)) queue.push({ name: cable.a, path: [...cur.path, cable.a], viaPort: cable.ap });
    }
  }
  return found;
}

/** The device (and port) that owns an IPv4 address. */
function ownerOf(spec: PtSpec, ip: string): Hop | null {
  for (const d of spec.devices) {
    if (d.power === false) continue;
    if (d.ip === ip) return { device: d.name, port: hostPort(spec, d) };
    for (const [port, cfg] of Object.entries(d.interfaces ?? {})) {
      if (cfg.ip === ip && !cfg.shutdown && (d.type === "router" || !d.ip)) return { device: d.name, port };
    }
  }
  return null;
}

function hostPort(spec: PtSpec, dev: PtDevice): string {
  const cable = spec.links.find((l) => l.a === dev.name || l.b === dev.name);
  if (cable) return cable.a === dev.name ? cable.ap : cable.bp;
  return "FastEthernet0";
}

function longestMatch(table: PtRouteRow[], ip: string): PtRouteRow | null {
  const target = ipToInt(ip);
  if (target === null) return null;
  let best: PtRouteRow | null = null;
  let bestBits = -1;
  for (const row of table) {
    const [net, bitsText] = row.network.split("/");
    const bits = Number(bitsText);
    const netInt = ipToInt(net);
    if (netInt === null) continue;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if (((target & mask) >>> 0) === ((netInt & mask) >>> 0) && bits > bestBits) {
      best = row;
      bestBits = bits;
    }
  }
  return best;
}

/** One direction of travel. Returns the device path and the routers crossed, or the reason it stops. */
function forward(spec: PtSpec, fromName: string, srcIp: string, dstIp: string): { ok: boolean; path: string[]; routers: string[]; error?: string } {
  const src = spec.devices.find((d) => d.name === fromName)!;
  const target = ownerOf(spec, dstIp);
  const path: string[] = [fromName];
  const routers: string[] = [];
  let current = src;
  let egress: string | null = null;
  let nextHopIp: string;

  if (current.type === "router") {
    nextHopIp = dstIp;
  } else {
    const mask = current.mask || "255.255.255.0";
    if (!current.ip) return { ok: false, path, routers, error: "Request timed out." };
    if (sameSubnet(current.ip, dstIp, mask)) nextHopIp = dstIp;
    else if (!current.gateway) return { ok: false, path, routers, error: "Request timed out." };
    else if (!sameSubnet(current.ip, current.gateway, mask)) return { ok: false, path, routers, error: "Request timed out." };
    else nextHopIp = current.gateway;
  }

  for (let hops = 0; hops < 30; hops++) {
    if (current.type === "router") {
      // A router that owns the destination answers itself.
      if (Object.values(current.interfaces ?? {}).some((c) => c.ip === dstIp && !c.shutdown)) return { ok: true, path, routers };
      const route = longestMatch(buildRouterTable(spec, current), dstIp);
      if (!route) return { ok: false, path, routers, error: `Reply from ${firstIp(current)}: Destination host unreachable.` };
      if (route.code === "C") {
        egress = route.interface;
        nextHopIp = dstIp;
      } else {
        nextHopIp = route.next_hop;
        const out = Object.entries(current.interfaces ?? {}).find(
          ([, c]) => c.ip && !c.shutdown && sameSubnet(c.ip, nextHopIp, c.mask || "255.255.255.0"),
        );
        if (!out) return { ok: false, path, routers, error: `Reply from ${firstIp(current)}: Destination host unreachable.` };
        egress = out[0];
      }
    }
    const reachable = segmentFrom(spec, current.name, current.type === "router" ? egress : null);
    const owner = ownerOf(spec, nextHopIp);
    const step = owner ? reachable.get(owner.device) : undefined;
    if (!owner || !step) {
      return { ok: false, path, routers, error: current.type === "router" ? `Reply from ${firstIp(current)}: Destination host unreachable.` : "Request timed out." };
    }
    path.push(...step.path.slice(1));
    const next = spec.devices.find((d) => d.name === owner.device)!;
    if (target && next.name === target.device) return { ok: true, path, routers };
    if (next.type !== "router") return { ok: false, path, routers, error: "Request timed out." };
    routers.push(next.name);
    current = next;
    nextHopIp = dstIp;
  }
  return { ok: false, path, routers, error: "TTL expired in transit." };
}

function firstIp(dev: PtDevice): string {
  return dev.ip || Object.values(dev.interfaces ?? {}).find((c) => c.ip)?.ip || "0.0.0.0";
}

export function simulateLocalPing(
  spec: PtSpec,
  sourceName: string,
  targetHostOrIp: string,
  pduNum = 1
): {
  success: boolean;
  targetIp: string;
  targetName: string;
  path: string[];
  events: PtEvent[];
  error?: string;
  ttl?: number;
  routers?: string[];
} {
  const src = spec.devices.find((d) => d.name === sourceName);
  if (!src || src.power === false) {
    return { success: false, targetIp: targetHostOrIp, targetName: "?", path: [], events: [], error: "Device powered off." };
  }
  const targetIp = resolveDnsName(spec, src, targetHostOrIp) ?? targetHostOrIp;
  if (ipToInt(targetIp) === null) {
    return { success: false, targetIp, targetName: "?", path: [sourceName], events: [], error: `Ping request could not find host ${targetHostOrIp}. Please check the name and try again.` };
  }
  const targetDev = spec.devices.find(
    (d) =>
      d.power !== false &&
      (d.ip === targetIp || Object.values(d.interfaces ?? {}).some((cfg) => cfg.ip === targetIp && !cfg.shutdown))
  );
  if (!targetDev) {
    return { success: false, targetIp, targetName: "?", path: [sourceName], events: [], error: "Request timed out." };
  }

  // Layer-3 check before anything is drawn: the packet must really be routable there AND back (host subnet and gateway, every
  // router's routing table, interfaces that are up). Without it a ping "succeeded" whenever any cable path existed, even with no
  // route configured, and a missing return route went unnoticed.
  const there = forward(spec, src.name, firstIp(src), targetIp);
  if (!there.ok) {
    return { success: false, targetIp, targetName: targetDev.name, path: there.path.length ? there.path : [src.name], events: [], error: there.error ?? "Request timed out." };
  }
  const back = forward(spec, targetDev.name, targetIp, firstIp(src));
  if (!back.ok) {
    return { success: false, targetIp, targetName: targetDev.name, path: there.path, events: [], error: "Request timed out." };
  }

  // BFS shortest active path across green non-console cables, enforcing switch access VLAN isolation
  const portEdges = new Map<string, { port: string; peer: string; peerPort: string }[]>();
  for (let i = 0; i < spec.links.length; i++) {
    const cable = spec.links[i];
    if (cable.cable === "console") continue;
    if (!isLinkUp(spec, cable)) continue;
    const listA = portEdges.get(cable.a) ?? [];
    listA.push({ port: cable.ap, peer: cable.b, peerPort: cable.bp });
    portEdges.set(cable.a, listA);
    const listB = portEdges.get(cable.b) ?? [];
    listB.push({ port: cable.bp, peer: cable.a, peerPort: cable.ap });
    portEdges.set(cable.b, listB);
  }

  const queue: { name: string; inPort: string | null; path: string[] }[] = [
    { name: src.name, inPort: null, path: [src.name] },
  ];
  const visitedStates = new Set<string>([src.name]);
  let foundPath: string[] | null = null;

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.name === targetDev.name) {
      foundPath = cur.path;
      break;
    }
    const curDev = spec.devices.find((d) => d.name === cur.name);
    const edges = portEdges.get(cur.name) ?? [];
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      if (curDev && curDev.type === "switch" && cur.inPort) {
        const inVlan = curDev.interfaces?.[cur.inPort]?.vlan ?? 1;
        const outVlan = curDev.interfaces?.[edge.port]?.vlan ?? 1;
        if (inVlan !== outVlan) continue;
      }
      const nextDev = spec.devices.find((d) => d.name === edge.peer);
      const visitKey = nextDev?.type === "switch" ? `${edge.peer}:${edge.peerPort}` : edge.peer;
      if (!visitedStates.has(visitKey)) {
        visitedStates.add(visitKey);
        queue.push({ name: edge.peer, inPort: edge.peerPort, path: [...cur.path, edge.peer] });
      }
    }
  }

  if (!foundPath) {
    return {
      success: false,
      targetIp,
      targetName: targetDev.name,
      path: [src.name],
      events: [],
      error: "Destination host unreachable (no active same-VLAN physical link).",
    };
  }

  const srcIp = getPrimaryIp(src);
  const srcMask = getPrimaryMask(src);
  const hasRouter = foundPath.slice(1, -1).some((n) => spec.devices.find((d) => d.name === n)?.type === "router");
  if (!hasRouter && srcIp && !sameSubnet(srcIp, targetIp, srcMask)) {
    return { success: false, targetIp, targetName: targetDev.name, path: [src.name], events: [], error: "No route to host (different subnet, no router/gateway)." };
  }
  if (hasRouter && src.type !== "router" && !src.gateway) {
    return { success: false, targetIp, targetName: targetDev.name, path: [src.name], events: [], error: "No default gateway configured on host." };
  }

  const events: PtEvent[] = [];
  let t = 0.0;
  const effectiveSrcIp = srcIp || "0.0.0.0";

  // Emit realistic ARP resolution across local Layer-2 hop(s) up to target or default gateway router
  const routerHopIdx = foundPath.findIndex((n, idx) => idx > 0 && idx < foundPath!.length - 1 && spec.devices.find((d) => d.name === n)?.type === "router");
  const arpEndIdx = routerHopIdx > 0 ? routerHopIdx : foundPath.length - 1;
  const arpEndName = foundPath[arpEndIdx];
  const arpQueryIp = routerHopIdx > 0 ? (src.gateway || targetIp) : targetIp;

  events.push({
    time: Number(t.toFixed(3)),
    pdu: pduNum,
    last: "",
    at: src.name,
    type: "ARP",
    info: `ARP Request: Who has ${arpQueryIp}? Tell ${effectiveSrcIp}`,
    action: "created",
  });
  for (let i = 1; i <= arpEndIdx; i++) {
    t += 0.001;
    events.push({
      time: Number(t.toFixed(3)),
      pdu: pduNum,
      last: foundPath[i - 1],
      at: foundPath[i],
      type: "ARP",
      info: `Who has ${arpQueryIp}? Tell ${effectiveSrcIp}`,
      action: i === arpEndIdx ? "accepted" : "forwarded",
    });
  }
  for (let i = arpEndIdx - 1; i >= 0; i--) {
    t += 0.001;
    events.push({
      time: Number(t.toFixed(3)),
      pdu: pduNum,
      last: foundPath[i + 1],
      at: foundPath[i],
      type: "ARP",
      info: `${arpQueryIp} is at ${syntheticMac(arpEndName)}`,
      action: i === 0 ? "accepted" : "forwarded",
    });
  }

  // Emit ICMP Echo Request & Echo Reply across full end-to-end path
  t += 0.002;
  events.push({
    time: Number(t.toFixed(3)),
    pdu: pduNum,
    last: "",
    at: src.name,
    type: "ICMP",
    info: `Echo request to ${targetIp}`,
    action: "created",
  });
  for (let i = 1; i < foundPath.length; i++) {
    t += 0.002;
    events.push({
      time: Number(t.toFixed(3)),
      pdu: pduNum,
      last: foundPath[i - 1],
      at: foundPath[i],
      type: "ICMP",
      info: `Echo request ${effectiveSrcIp} -> ${targetIp} ttl=${128 - i + 1}`,
      action: i === foundPath.length - 1 ? "accepted" : "forwarded",
    });
  }
  for (let i = foundPath.length - 2; i >= 0; i--) {
    t += 0.002;
    events.push({
      time: Number(t.toFixed(3)),
      pdu: pduNum,
      last: foundPath[i + 1],
      at: foundPath[i],
      type: "ICMP",
      info: `Echo reply ${targetIp} -> ${effectiveSrcIp}`,
      action: i === 0 ? "accepted" : "forwarded",
    });
  }

  return {
    success: true,
    targetIp,
    targetName: targetDev.name,
    path: foundPath,
    events,
    ttl: (targetDev.type === "router" ? 255 : 128) - back.routers.length,
    routers: there.routers,
  };
}

/* =========================================================================
 * Cisco IOS CLI Interpreter (Interactive Router & Switch Terminal)
 * ========================================================================= */

export interface IosSessionState {
  priv: boolean;
  configMode: boolean;
  iface: string | null;
  ripMode: boolean;
}

export function iosPrompt(device: PtDevice, session: IosSessionState): string {
  const host = device.hostname || device.name;
  if (session.iface) return `${host}(config-if)#`;
  if (session.ripMode) return `${host}(config-router)#`;
  if (session.configMode) return `${host}(config)#`;
  if (session.priv) return `${host}#`;
  return `${host}>`;
}

export function normalizeInterfaceArg(raw: string, device: PtDevice): string {
  const low = raw.trim().toLowerCase();
  const ports = getDevicePorts(device);
  const exact = ports.find((p) => p.toLowerCase() === low);
  if (exact) return exact;
  if (low.startsWith("fa")) {
    const suffix = low.replace(/^fastethernet|^fa/, "");
    const hit = ports.find((p) => p.toLowerCase() === `fastethernet${suffix}`);
    if (hit) return hit;
  }
  if (low.startsWith("gi") || low.startsWith("g")) {
    const suffix = low.replace(/^gigabitethernet|^gi|^g/, "");
    const hit = ports.find((p) => p.toLowerCase() === `gigabitethernet${suffix}`);
    if (hit) return hit;
  }
  if (low.startsWith("se") || low.startsWith("s")) {
    const suffix = low.replace(/^serial|^se|^s/, "");
    const hit = ports.find((p) => p.toLowerCase() === `serial${suffix}`);
    if (hit) return hit;
  }
  return raw.trim();
}

export function executeIosCommand(
  spec: PtSpec,
  deviceName: string,
  command: string,
  session: IosSessionState
): { output: string[]; nextSession: IosSessionState; updatedDevice?: PtDevice } {
  const dev = spec.devices.find((d) => d.name === deviceName);
  if (!dev) return { output: ["% Device not found"], nextSession: session };
  const cmd = command.trim();
  if (!cmd) return { output: [], nextSession: session };
  const parts = cmd.split(/\s+/);
  const head = parts[0].toLowerCase();
  const nextSession: IosSessionState = { ...session };

  if (head === "?" || head === "help") {
    if (session.iface) {
      return {
        output: [
          "Interface configuration commands:",
          "  ip address <ip> <mask>        Set IP address and subnet mask",
          "  no shutdown                   Enable interface",
          "  shutdown                      Administratively disable interface",
          "  switchport mode access        Set interface to access mode",
          "  switchport access vlan <id>   Assign access VLAN (1-4094)",
          "  exit                          Exit from interface configuration mode",
        ],
        nextSession,
      };
    }
    if (session.configMode) {
      return {
        output: [
          "Configure commands:",
          "  hostname <name>                    Set system network name",
          "  interface <type/num>               Select an interface to configure",
          "  vlan <id>                          Configure a VLAN (1-4094)",
          "  router rip                         Enable RIP routing protocol",
          "  ip route <net> <mask> <next-hop>   Establish static route",
          "  end                                Exit configure mode",
        ],
        nextSession,
      };
    }
    return {
      output: [
        "Exec commands:",
        "  enable                   Turn on privileged commands",
        "  configure terminal       Enter configuration mode",
        "  show ip interface brief  Summary of interface IP status",
        "  show ip route            IP routing table",
        "  show vlan brief          Switch VLAN membership table",
        "  show arp                 Display ARP cache",
        "  show version             Display IOS software version",
        "  show running-config      Current operating configuration",
        "  show mac-address-table   Switch MAC forwarding table",
        "  ping <ip>                Send ICMP echo messages",
      ],
      nextSession,
    };
  }

  if (head === "en" || head === "enable") {
    nextSession.priv = true;
    return { output: [], nextSession };
  }
  if (head === "disable") {
    nextSession.priv = false;
    nextSession.configMode = false;
    nextSession.iface = null;
    nextSession.ripMode = false;
    return { output: [], nextSession };
  }
  if ((head === "conf" || head === "configure") && parts[1]?.toLowerCase().startsWith("t")) {
    if (!session.priv) return { output: ["% Invalid input. Enter privileged EXEC with 'enable' first."], nextSession };
    nextSession.configMode = true;
    nextSession.iface = null;
    nextSession.ripMode = false;
    return { output: ["Enter configuration commands, one per line. End with CNTL/Z."], nextSession };
  }
  if (head === "end") {
    nextSession.configMode = false;
    nextSession.iface = null;
    nextSession.ripMode = false;
    return { output: [], nextSession };
  }
  if (head === "exit") {
    if (session.iface) nextSession.iface = null;
    else if (session.ripMode) nextSession.ripMode = false;
    else if (session.configMode) nextSession.configMode = false;
    else nextSession.priv = false;
    return { output: [], nextSession };
  }

  if (session.configMode && (head === "hostname" || head === "host") && parts[1]) {
    const updatedDevice: PtDevice = { ...dev, hostname: parts[1] };
    return { output: [], nextSession, updatedDevice };
  }

  if (session.configMode && (head === "int" || head === "interface") && parts[1]) {
    const ifName = normalizeInterfaceArg(parts[1], dev);
    const ports = getDevicePorts(dev);
    if (!ports.includes(ifName)) {
      return { output: [`% Invalid interface type and number: ${parts[1]}`], nextSession };
    }
    nextSession.iface = ifName;
    nextSession.ripMode = false;
    return { output: [], nextSession };
  }

  if (session.configMode && head === "router" && parts[1]?.toLowerCase() === "rip") {
    nextSession.ripMode = true;
    nextSession.iface = null;
    return { output: [], nextSession };
  }

  if (session.ripMode && (head === "net" || head === "network") && parts[1]) {
    const rip = Array.from(new Set([...(dev.rip ?? []), parts[1]]));
    return { output: [], nextSession, updatedDevice: { ...dev, rip } };
  }

  if (session.configMode && head === "vlan" && parts[1]) {
    const vlanId = Number(parts[1]);
    if (!Number.isInteger(vlanId) || vlanId < 1 || vlanId > 4094) {
      return { output: ["% Invalid VLAN ID (must be 1..4094)"], nextSession };
    }
    if (vlanId === 1) return { output: [], nextSession };
    const existing = dev.vlans ?? [];
    const customName = parts[2] || `VLAN${String(vlanId).padStart(4, "0")}`;
    const already = existing.some((v) => v.id === vlanId);
    const nextVlans = already
      ? existing.map((v) => (v.id === vlanId && parts[2] ? { id: v.id, name: parts[2] } : v))
      : [...existing, { id: vlanId, name: customName }];
    return { output: [], nextSession, updatedDevice: { ...dev, vlans: nextVlans } };
  }

  if (session.configMode && head === "ip" && parts[1]?.toLowerCase() === "route" && parts[4]) {
    const staticRoutes = [...(dev.staticRoutes ?? []), { network: parts[2], mask: parts[3], nextHop: parts[4] }];
    return { output: [], nextSession, updatedDevice: { ...dev, staticRoutes } };
  }

  if (session.iface) {
    const cur = dev.interfaces?.[session.iface] ?? { ip: "", mask: "", shutdown: dev.type === "router" };
    const nextIfaces = { ...(dev.interfaces ?? {}) };
    if (head === "ip" && parts[1]?.toLowerCase().startsWith("add") && parts[2] && parts[3]) {
      nextIfaces[session.iface] = { ...cur, ip: parts[2], mask: parts[3] };
      return { output: [], nextSession, updatedDevice: { ...dev, interfaces: nextIfaces } };
    }
    if (head === "no" && parts[1]?.toLowerCase().startsWith("sh")) {
      nextIfaces[session.iface] = { ...cur, shutdown: false };
      return {
        output: [`%LINK-5-CHANGED: Interface ${session.iface}, changed state to up`],
        nextSession,
        updatedDevice: { ...dev, interfaces: nextIfaces },
      };
    }
    if (head === "sh" || head === "shutdown") {
      nextIfaces[session.iface] = { ...cur, shutdown: true };
      return {
        output: [`%LINK-5-CHANGED: Interface ${session.iface}, changed state to administratively down`],
        nextSession,
        updatedDevice: { ...dev, interfaces: nextIfaces },
      };
    }
    if (head.startsWith("sw") && parts[1]?.toLowerCase().startsWith("m") && parts[2]?.toLowerCase().startsWith("acc")) {
      return { output: [], nextSession };
    }
    if (head.startsWith("sw") && parts[1]?.toLowerCase().startsWith("acc") && parts[2]?.toLowerCase().startsWith("v") && parts[3]) {
      const vlanId = Number(parts[3]);
      if (!Number.isInteger(vlanId) || vlanId < 1 || vlanId > 4094) {
        return { output: ["% Invalid VLAN ID (must be 1..4094)"], nextSession };
      }
      nextIfaces[session.iface] = { ...cur, vlan: vlanId };
      const existingVlans = dev.vlans ?? [];
      const hasVlan = vlanId === 1 || existingVlans.some((v) => v.id === vlanId);
      const nextVlans = hasVlan
        ? existingVlans
        : [...existingVlans, { id: vlanId, name: `VLAN${String(vlanId).padStart(4, "0")}` }];
      return {
        output: hasVlan ? [] : [`% Access VLAN does not exist. Creating vlan ${vlanId}`],
        nextSession,
        updatedDevice: { ...dev, interfaces: nextIfaces, vlans: nextVlans },
      };
    }
  }

  // EXEC show / ping commands (also allow 'do show ...' in config mode)
  const effectiveCmd = head === "do" ? parts.slice(1).join(" ").toLowerCase() : cmd.toLowerCase();
  if (effectiveCmd.startsWith("sh ip int") || effectiveCmd.startsWith("show ip int")) {
    const lines = ["Interface              IP-Address      OK? Method Status                Protocol"];
    for (const p of getDevicePorts(dev).filter((x) => x !== "Console")) {
      const cfg = dev.interfaces?.[p];
      const linked = spec.links.some((c) => ((c.a === dev.name && c.ap === p) || (c.b === dev.name && c.bp === p)) && isLinkUp(spec, c));
      const ipStr = cfg?.ip || "unassigned";
      const st = cfg?.shutdown ? "administratively down" : linked ? "up" : "down";
      const proto = !cfg?.shutdown && linked ? "up" : "down";
      lines.push(`${p.padEnd(23)}${ipStr.padEnd(16)}YES manual ${st.padEnd(22)}${proto}`);
    }
    return { output: lines, nextSession };
  }

  if (effectiveCmd.startsWith("sh ip r") || effectiveCmd.startsWith("show ip r")) {
    return { output: formatShowIpRoute(spec, dev), nextSession };
  }

  if (effectiveCmd.startsWith("sh run") || effectiveCmd.startsWith("show run")) {
    const lines = ["Building configuration...", "", `hostname ${dev.hostname || dev.name}`, "!"];
    for (const [p, cfg] of Object.entries(dev.interfaces ?? {})) {
      lines.push(`interface ${p}`);
      if (cfg.ip) lines.push(` ip address ${cfg.ip} ${cfg.mask}`);
      lines.push(cfg.shutdown ? " shutdown" : " no shutdown");
      lines.push("!");
    }
    if (dev.rip?.length) {
      lines.push("router rip");
      for (const net of dev.rip) lines.push(` network ${net}`);
      lines.push("!");
    }
    lines.push("end");
    return { output: lines, nextSession };
  }

  if (effectiveCmd.startsWith("sh vlan") || effectiveCmd.startsWith("show vlan")) {
    const switchPorts = getDevicePorts(dev).filter((p) => p !== "Console");
    const vlanMap = new Map<number, string>();
    vlanMap.set(1, "default");
    (dev.vlans ?? []).forEach((v) => vlanMap.set(v.id, v.name));
    switchPorts.forEach((p) => {
      const vid = dev.interfaces?.[p]?.vlan ?? 1;
      if (!vlanMap.has(vid)) vlanMap.set(vid, `VLAN${String(vid).padStart(4, "0")}`);
    });
    const ids = Array.from(vlanMap.keys()).sort((a, b) => a - b);
    const lines = [
      "",
      "VLAN Name                             Status    Ports",
      "---- -------------------------------- --------- -------------------------------",
    ];
    for (let i = 0; i < ids.length; i++) {
      const vid = ids[i];
      const vname = vlanMap.get(vid) ?? `VLAN${vid}`;
      const memberPorts = switchPorts
        .filter((p) => (dev.interfaces?.[p]?.vlan ?? 1) === vid)
        .map((p) => p.replace("FastEthernet", "Fa").replace("GigabitEthernet", "Gi"));
      lines.push(`${String(vid).padEnd(5)}${vname.padEnd(33)}active    ${memberPorts.join(", ")}`);
    }
    return { output: lines, nextSession };
  }

  if (effectiveCmd.startsWith("sh ver") || effectiveCmd.startsWith("show ver")) {
    const mod = dev.model || "C2960";
    return {
      output: [
        `Cisco IOS Software, ${mod} Software (${mod}-ADVIPSERVICESK9-M), Version 15.1(4)M4`,
        `ROM: System Bootstrap, Version 15.0(1r)M15`,
        `${dev.hostname || dev.name} uptime is 0 hours, 12 minutes`,
        `cisco ${mod} processor with 524288K bytes of memory.`,
      ],
      nextSession,
    };
  }

  if (effectiveCmd.startsWith("sh arp") || effectiveCmd.startsWith("show arp")) {
    const lines = ["Protocol  Address          Age (min)  Hardware Addr   Type   Interface"];
    for (let i = 0; i < spec.devices.length; i++) {
      const d = spec.devices[i];
      if (d.name === dev.name || d.power === false) continue;
      const ip = getPrimaryIp(d);
      if (ip) {
        lines.push(`Internet  ${ip.padEnd(17)}0          ${syntheticMac(d.name).toLowerCase()}  ARPA   FastEthernet0/0`);
      }
    }
    return { output: lines, nextSession };
  }

  if (effectiveCmd.startsWith("sh mac") || effectiveCmd.startsWith("show mac")) {
    const lines = ["          Mac Address Table", "-------------------------------------------", "Vlan    Mac Address       Type        Ports", "----    -----------       --------    -----"];
    for (const c of spec.links) {
      if (!isLinkUp(spec, c)) continue;
      if (c.a === dev.name || c.b === dev.name) {
        const port = c.a === dev.name ? c.ap : c.bp;
        const peer = c.a === dev.name ? c.b : c.a;
        lines.push(`   1    ${syntheticMac(peer, port).toLowerCase()}    DYNAMIC     ${port}`);
      }
    }
    return { output: lines, nextSession };
  }

  if (effectiveCmd.startsWith("ping ")) {
    const tgt = effectiveCmd.split(/\s+/)[1];
    const sim = simulateLocalPing(spec, dev.name, tgt);
    if (sim.success) {
      return {
        output: [
          `Type escape sequence to abort.`,
          `Sending 5, 100-byte ICMP Echos to ${sim.targetIp}, timeout is 2 seconds:`,
          `!!!!!`,
          `Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms`,
        ],
        nextSession,
      };
    }
    return {
      output: [
        `Type escape sequence to abort.`,
        `Sending 5, 100-byte ICMP Echos to ${tgt}, timeout is 2 seconds:`,
        `.....`,
        `Success rate is 0 percent (0/5) — ${sim.error ?? "Timed out"}`,
      ],
      nextSession,
    };
  }

  return { output: [`% Invalid input detected for command: '${cmd}'`], nextSession };
}

/* =========================================================================
 * PC / Server / Laptop Command Prompt Interpreter
 * ========================================================================= */

export function executePcCommand(spec: PtSpec, deviceName: string, command: string): string[] {
  const dev = spec.devices.find((d) => d.name === deviceName);
  if (!dev) return ["Device not found."];
  if (dev.power === false) return ["Device is powered off."];
  const cmd = command.trim();
  if (!cmd) return [];
  const parts = cmd.split(/\s+/);
  const head = parts[0].toLowerCase();

  if (head === "help" || head === "?") {
    return [
      "Available Packet Tracer PC Commands:",
      "  ipconfig [/all]      Display IPv4 configuration",
      "  ping <ip | hostname> Test ICMP connectivity across topology",
      "  tracert <ip>         Trace Layer-3 router hops to target",
      "  arp -a               Display ARP table",
      "  nslookup <hostname>  Query DNS server on topology",
      "  cls                  Clear command window",
    ];
  }

  if (head === "ipconfig") {
    const verbose = parts[1]?.toLowerCase() === "/all";
    const out = [
      "",
      "FastEthernet0 Connection:(default port)",
      "",
      `   Connection-specific DNS Suffix..: ${verbose ? "labmate.edu" : ""}`,
    ];
    if (verbose) {
      out.push(`   Physical Address................: ${syntheticMac(dev.name, "FastEthernet0")}`);
      out.push(`   DHCP Enabled....................: ${dev.dhcp ? "Yes" : "No"}`);
    }
    out.push(`   IPv4 Address....................: ${dev.ip || "0.0.0.0"}`);
    out.push(`   Subnet Mask.....................: ${dev.mask || "0.0.0.0"}`);
    out.push(`   Default Gateway.................: ${dev.gateway || "0.0.0.0"}`);
    if (verbose) out.push(`   DNS Servers.....................: ${dev.dns || "0.0.0.0"}`);
    return out;
  }

  if (head === "ping" && parts[1]) {
    const sim = simulateLocalPing(spec, dev.name, parts[1]);
    if (!sim.success) {
      if ((sim.error || "").startsWith("Ping request could not find host")) return [sim.error as string];
      const line = sim.error || "Request timed out.";
      return [
        `Pinging ${sim.targetIp} with 32 bytes of data:`,
        "",
        line,
        line,
        line,
        line,
        "",
        `Ping statistics for ${sim.targetIp}:`,
        "    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),",
      ];
    }
    const ttl = sim.ttl ?? 128;
    return [
      `Pinging ${sim.targetIp} with 32 bytes of data:`,
      "",
      `Reply from ${sim.targetIp}: bytes=32 time<1ms TTL=${ttl}`,
      `Reply from ${sim.targetIp}: bytes=32 time<1ms TTL=${ttl}`,
      `Reply from ${sim.targetIp}: bytes=32 time<1ms TTL=${ttl}`,
      `Reply from ${sim.targetIp}: bytes=32 time<1ms TTL=${ttl}`,
      "",
      `Ping statistics for ${sim.targetIp}:`,
      "    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),",
    ];
  }

  if (head === "tracert" && parts[1]) {
    const sim = simulateLocalPing(spec, dev.name, parts[1]);
    const out = [`Tracing route to ${sim.targetIp} over a maximum of 30 hops:`, ""];
    const hops = sim.routers ?? [];
    hops.forEach((h, i) => {
      const hd = spec.devices.find((x) => x.name === h);
      // The address a router answers from is the interface the probe arrived on: the one facing the previous hop.
      const ip = Object.values(hd?.interfaces ?? {}).find((c) => c.ip && dev.ip && (i === 0 ? sameSubnet(c.ip, dev.gateway || "", c.mask || "255.255.255.0") : true))?.ip
        || Object.values(hd?.interfaces ?? {})[0]?.ip || "";
      out.push(`  ${String(i + 1).padStart(2)}   0 ms      0 ms      0 ms      ${ip}`);
    });
    if (sim.success) {
      out.push(`  ${String(hops.length + 1).padStart(2)}   0 ms      0 ms      0 ms      ${sim.targetIp}`);
      out.push("", "Trace complete.");
    } else {
      out.push(`  ${String(hops.length + 1).padStart(2)}   *         *         *         ${sim.error || "Request timed out."}`);
    }
    return out;
  }

  if (head === "arp") {
    const lines = ["  Internet Address      Physical Address      Type"];
    for (const d of spec.devices) {
      if (d.name !== dev.name && d.ip) {
        lines.push(`  ${d.ip.padEnd(22)}${syntheticMac(d.name).toLowerCase()}   dynamic`);
      }
    }
    return lines;
  }

  if (head === "nslookup" && parts[1]) {
    const resolved = resolveDnsName(spec, dev, parts[1]);
    if (!resolved) return [`*** DNS request timed out / Non-existent domain: ${parts[1]}`];
    return [`Server:  ${dev.dns || "192.168.1.254"}`, `Name:    ${parts[1]}`, `Address: ${resolved}`];
  }

  return [`'${cmd}' is not recognized. Type 'help' for supported commands.`];
}
