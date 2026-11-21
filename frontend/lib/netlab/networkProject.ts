import { intToIp, ipToInt, maskToCidr, netAddress, sameSubnet, syntheticMac } from "./ptEngine.ts";

export type Model = keyof typeof MODELS;
export type Medium = "straight" | "cross" | "console" | "fiber" | "wireless";
export type CableChoice = Medium | "auto";
type PortKind = "copper" | "fiber" | "serial" | "console" | "radio" | "virtual";

export const MODELS = {
  router: { label: "Router", group: "Routing", prefix: "R", ports: { "Gi0/0": "copper", "Gi0/1": "copper", "Gi0/2": "copper", "SFP0": "fiber", "Console": "console" } },
  switch: { label: "Switch", group: "Switching", prefix: "SW", ports: { "Fa0/1": "copper", "Fa0/2": "copper", "Fa0/3": "copper", "Fa0/4": "copper", "Fa0/5": "copper", "Fa0/6": "copper", "SFP1": "fiber", "SFP2": "fiber", "Console": "console" } },
  hub: { label: "Hub", group: "Switching", prefix: "HUB", ports: { "Eth1": "copper", "Eth2": "copper", "Eth3": "copper", "Eth4": "copper" } },
  wirelessRouter: { label: "Wireless router", group: "Wireless", prefix: "WR", ports: { "WAN": "copper", "Eth1": "copper", "Eth2": "copper", "Eth3": "copper", "WiFi": "radio", "LAN": "virtual" } },
  accessPoint: { label: "Access point", group: "Wireless", prefix: "AP", ports: { "Eth0": "copper", "WiFi": "radio" } },
  pc: { label: "PC", group: "End devices", prefix: "PC", ports: { "Eth0": "copper", "RS-232": "serial" } },
  laptop: { label: "Laptop", group: "End devices", prefix: "LT", ports: { "Eth0": "copper", "RS-232": "serial", "WiFi": "radio" } },
  server: { label: "Server", group: "End devices", prefix: "SRV", ports: { "Eth0": "copper", "SFP0": "fiber" } },
  printer: { label: "Printer", group: "End devices", prefix: "PRN", ports: { "Eth0": "copper" } },
} as const satisfies Record<string, { label: string; group: string; prefix: string; ports: Record<string, PortKind> }>;

export interface Port { ip: string; mask: string; vlan: number; enabled: boolean }
export interface Endpoint { device: string; port: string }
export interface Cable { id: string; a: Endpoint; b: Endpoint; medium: Medium }
export interface Route { network: string; mask: string; via: string }
export interface Pool { start: string; mask: string; size: number; gateway: string; dns: string }
export interface Device {
  id: string; model: Model; name: string; x: number; y: number; powered: boolean;
  ports: Record<string, Port>; gateway: string; dns: string; ssid: string;
  routes: Route[]; pool: Pool | null; records: Record<string, string>;
}
export interface Project { version: 1; name: string; devices: Device[]; cables: Cable[] }
export interface PacketEvent {
  protocol: "ARP" | "ICMP" | "DHCP" | "DNS" | "System";
  from: string; to: string; detail: string; failed?: boolean;
}
export interface PingResult { ok: boolean; message: string; events: PacketEvent[] }

export const MAX_DEVICES = 48;
export const MASK = "255.255.255.0";
export const CABLING: Record<CableChoice, string> = {
  auto: "Automatic", straight: "Copper straight-through", cross: "Copper crossover",
  console: "Console cable", fiber: "Fiber", wireless: "Wi-Fi association",
};

export const emptyProject = (name = "Untitled topology"): Project => ({ version: 1, name, devices: [], cables: [] });
export const routerLike = (device: Device) => device.model === "router" || device.model === "wirelessRouter";
export const portKinds = (device: Device): Record<string, PortKind> => MODELS[device.model].ports;
const at = (project: Project, id: string) => project.devices.find((device) => device.id === id);
const endpointKey = (e: Endpoint) => e.device + "/" + e.port;
const isBridge = (device: Device) => ["hub", "switch", "accessPoint", "wirelessRouter"].includes(device.model);

export function makeDevice(project: Project, model: Model, x: number, y: number): Device {
  const meta = MODELS[model];
  let n = 1;
  while (project.devices.some((device) => device.id === meta.prefix + n || device.name === meta.prefix + n)) n++;
  const id = meta.prefix + n;
  return {
    id, model, name: id, x, y, powered: true, gateway: "", dns: "",
    ssid: model === "wirelessRouter" || model === "accessPoint" ? "LabMate Wi-Fi" : "",
    routes: [], pool: null, records: {},
    ports: Object.fromEntries(Object.keys(meta.ports).map((port) => [
      port, { ip: "", mask: MASK, vlan: 1, enabled: model !== "router" || port === "Console" },
    ])),
  };
}

export function setDevice(project: Project, device: Device): Project {
  return { ...project, devices: project.devices.map((item) => item.id === device.id ? device : item) };
}

export function deleteDevice(project: Project, id: string): Project {
  return {
    ...project, devices: project.devices.filter((device) => device.id !== id),
    cables: project.cables.filter(({ a, b }) => a.device !== id && b.device !== id),
  };
}

export function validMask(mask: string) {
  const value = ipToInt(mask);
  if (value === null) return false;
  const inverse = (~value) >>> 0;
  return (inverse & (inverse + 1)) === 0;
}
const validIp = (ip: string) => ipToInt(ip) !== null;
const sameIp = (a: string, b: string) => validIp(a) && validIp(b) && ipToInt(a) === ipToInt(b);

const mdiX = (device: Device, port: string) => isBridge(device) && !(device.model === "wirelessRouter" && port === "WAN");

export function compatibleMedia(a: Device, ap: string, b: Device, bp: string): Medium | null {
  const ak = portKinds(a)[ap], bk = portKinds(b)[bp];
  if (ak === "copper" && bk === "copper") return mdiX(a, ap) === mdiX(b, bp) ? "cross" : "straight";
  if ((ak === "serial" && bk === "console") || (ak === "console" && bk === "serial")) return "console";
  if (ak === "fiber" && bk === "fiber") return "fiber";
  const apDevice = a.model === "accessPoint" || a.model === "wirelessRouter";
  const bpDevice = b.model === "accessPoint" || b.model === "wirelessRouter";
  if (ak === "radio" && bk === "radio" && apDevice !== bpDevice) return "wireless";
  return null;
}

export function linkUp(project: Project, cable: Cable): boolean {
  const a = at(project, cable.a.device), b = at(project, cable.b.device);
  if (!a?.powered || !b?.powered || !a.ports[cable.a.port]?.enabled || !b.ports[cable.b.port]?.enabled) return false;
  if (cable.medium !== compatibleMedia(a, cable.a.port, b, cable.b.port)) return false;
  return cable.medium !== "wireless" || Boolean(a.ssid && a.ssid === b.ssid);
}

export function busyPort(project: Project, ep: Endpoint) {
  const device = at(project, ep.device);
  if (ep.port === "WiFi" && device && ["wirelessRouter", "accessPoint"].includes(device.model)) return false;
  return project.cables.some((cable) => [cable.a, cable.b].some((end) => endpointKey(end) === endpointKey(ep)));
}

export function connect(project: Project, a: Endpoint, b: Endpoint, choice: CableChoice): Project {
  const left = at(project, a.device), right = at(project, b.device);
  if (!left || !right || left === right) throw new Error("Select ports on two different devices.");
  if (busyPort(project, a) || busyPort(project, b)) throw new Error("One of those ports already has a connection.");
  const media = compatibleMedia(left, a.port, right, b.port);
  if (!media || (choice !== "auto" && choice !== media)) throw new Error("Those ports require a different connection type.");
  let number = project.cables.length + 1;
  while (project.cables.some((cable) => cable.id === "link-" + number)) number++;
  const cable = { id: "link-" + number, a, b, medium: media };
  return { ...project, cables: [...project.cables, cable] };
}

/** IPs belong to an endpoint. Bridges only forward between eligible ports. */
export function addressable(device: Device, name: string) {
  const kind = portKinds(device)[name];
  if (!kind || ["console", "serial"].includes(kind)) return false;
  if (device.model === "wirelessRouter") return name === "LAN" || name === "WAN";
  return !isBridge(device);
}

function addresses(device: Device): { ep: Endpoint; config: Port }[] {
  if (!device.powered) return [];
  return Object.entries(device.ports)
    .filter(([name, p]) => addressable(device, name) && p.enabled && validIp(p.ip) && validMask(p.mask))
    .map(([port, config]) => ({ ep: { device: device.id, port }, config }));
}

/** Search on individual ports, forwarding only inside a shared access VLAN. */
function segmentPath(project: Project, source: Endpoint, destination: Endpoint): Endpoint[] | null {
  const queue: Endpoint[][] = [[source]];
  const visited = new Set([endpointKey(source)]);
  for (let head = 0; head < queue.length; head++) {
    const path = queue[head], cur = path[path.length - 1];
    if (endpointKey(cur) === endpointKey(destination)) return path;
    const device = at(project, cur.device)!;
    const peers: Endpoint[] = [];
    for (const link of project.cables) {
      if (link.medium === "console" || !linkUp(project, link)) continue;
      if (endpointKey(link.a) === endpointKey(cur)) peers.push(link.b);
      if (endpointKey(link.b) === endpointKey(cur)) peers.push(link.a);
    }
    if (isBridge(device) && cur.port !== "WAN") {
      const ingress = device.ports[cur.port];
      for (const [port, config] of Object.entries(device.ports)) {
        const kind = portKinds(device)[port];
        if (port !== "WAN" && config.enabled && !["serial", "console"].includes(kind)
          && (device.model !== "switch" || ingress.vlan === config.vlan)) peers.push({ device: device.id, port });
      }
    }
    for (const peer of peers) {
      const key = endpointKey(peer);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push([...path, peer]);
    }
  }
  return null;
}

function eventsAlong(path: Endpoint[], protocol: PacketEvent["protocol"], detail: string): PacketEvent[] {
  return path.slice(1).flatMap((next, i) => path[i].device === next.device ? [] : [{
    protocol, from: path[i].device, to: next.device,
    detail: detail + " · " + path[i].port + " → " + next.port,
  }]);
}

function chooseHop(device: Device, ip: string) {
  const interfaces = addresses(device);
  const candidates = interfaces.filter(({ config }) => sameSubnet(config.ip, ip, config.mask))
    .map(({ ep, config }) => ({ ep, hop: ip, prefix: maskToCidr(config.mask), direct: true }));
  if (routerLike(device)) {
    for (const route of device.routes) {
      if (!validMask(route.mask) || !sameSubnet(route.network, ip, route.mask)) continue;
      const out = interfaces.find(({ config }) => sameSubnet(config.ip, route.via, config.mask));
      if (out) candidates.push({ ep: out.ep, hop: route.via, prefix: maskToCidr(route.mask), direct: false });
    }
  } else if (device.gateway) {
    const out = interfaces.find(({ config }) => sameSubnet(config.ip, device.gateway, config.mask));
    if (out) candidates.push({ ep: out.ep, hop: device.gateway, prefix: -1, direct: false });
  }
  return candidates.sort((a, b) => b.prefix - a.prefix || Number(b.direct) - Number(a.direct))[0];
}

function sendIp(project: Project, source: Device, destination: string, events: PacketEvent[], arp: Set<string>,
  protocol: "ICMP" | "DNS", detail: string): string | Device {
  let current = source;
  const visited = new Set<string>();
  const candidates = project.devices.flatMap(addresses);
  for (let ttl = 16; ttl > 0; ttl--) {
    if (visited.has(current.id)) return "Routing loop detected at " + current.name + ".";
    visited.add(current.id);
    if (addresses(current).some((entry) => sameIp(entry.config.ip, destination))) return current;
    const hop = chooseHop(current, destination);
    if (!hop) return current.name + " has no usable route or gateway to " + destination + ".";
    const paths = candidates.filter(({ config }) => sameIp(config.ip, hop.hop)).flatMap(({ ep }) => {
      const path = segmentPath(project, hop.ep, ep);
      return path ? [{ ep, path }] : [];
    });
    if (paths.length !== 1) {
      const reason = paths.length > 1 ? "Duplicate IPv4 address " + hop.hop + "." : "No ARP reply for " + hop.hop + " on " + current.name + ".";
      events.push({ protocol: "ARP", from: current.id, to: current.id, detail: reason, failed: true });
      return reason;
    }
    const [{ ep, path }] = paths;
    const cache = endpointKey(hop.ep) + ":" + hop.hop;
    if (!arp.has(cache)) {
      events.push(...eventsAlong(path, "ARP", "Who has " + hop.hop + "?"));
      events.push(...eventsAlong([...path].reverse(), "ARP", hop.hop + " is at " + syntheticMac(ep.device, ep.port)));
      arp.add(cache);
    }
    events.push(...eventsAlong(path, protocol, detail));
    const next = at(project, ep.device)!;
    if (sameIp(hop.hop, destination)) return next;
    if (!routerLike(next)) return next.name + " cannot forward packets.";
    current = next;
  }
  return "Packet TTL expired.";
}

export function ping(project: Project, from: string, target: string): PingResult {
  const source = at(project, from);
  const events: PacketEvent[] = [];
  const arp = new Set<string>();
  const fail = (message: string): PingResult => {
    events.push({ protocol: "System", from, to: from, detail: message, failed: true });
    return { ok: false, message, events };
  };
  if (!source || !addresses(source).length) return fail("The source needs an enabled port with a valid IPv4 address and mask.");
  let destination = target.trim();
  if (!validIp(destination)) {
    if (!validIp(source.dns)) return fail("Enter an IPv4 destination or configure a reachable DNS server.");
    const dnsServer = sendIp(project, source, source.dns, events, arp, "DNS", "Query " + destination);
    if (typeof dnsServer === "string") return fail(dnsServer);
    if (dnsServer.model !== "server") return fail("The configured host does not provide DNS.");
    const resolved = Object.prototype.hasOwnProperty.call(dnsServer.records, destination.toLowerCase()) ? dnsServer.records[destination.toLowerCase()] : "";
    if (!validIp(resolved)) return fail("The DNS server has no record for " + destination + ".");
    const replyTo = sourceAddress(project, source, source.dns);
    if (!replyTo) return fail("No source address is available for the DNS reply.");
    const dnsReply = sendIp(project, dnsServer, replyTo, events, arp, "DNS", "Answer " + resolved);
    if (typeof dnsReply === "string") return fail(dnsReply);
    if (dnsReply.id !== source.id) return fail("The DNS reply reached a different device with the same address.");
    destination = resolved;
  }
  const returnAddress = sourceAddress(project, source, destination);
  if (!returnAddress) return fail(source.name + " has no usable route or gateway to " + destination + ".");
  const receiver = sendIp(project, source, destination, events, arp, "ICMP", "Echo request → " + destination);
  if (typeof receiver === "string") return fail(receiver);
  const reply = sendIp(project, receiver, returnAddress, events, arp, "ICMP", "Echo reply → " + returnAddress);
  if (typeof reply === "string") return fail("Echo reached the destination, but the reply failed. " + reply);
  if (reply.id !== source.id) return fail("The echo reply reached a different device with the same address.");
  const message = "Echo reply from " + destination;
  events.push({ protocol: "System", from: receiver.id, to: from, detail: message });
  return { ok: true, message, events };
}

function sourceAddress(project: Project, source: Device, destination: string) {
  const own = addresses(source).find(({ config }) => sameIp(config.ip, destination));
  const hop = chooseHop(source, destination);
  return own?.config.ip || (hop && at(project, hop.ep.device)?.ports[hop.ep.port].ip) || "";
}

export function dhcp(project: Project, id: string, port: string): { project: Project; events: PacketEvent[]; message: string } {
  const client = at(project, id);
  if (!client?.powered || isBridge(client) || routerLike(client) || !client.ports[port]?.enabled || !addressable(client, port)) {
    throw new Error("Choose an enabled network port on an end device.");
  }
  const endpoint = { device: id, port };
  const used = new Set(project.devices.flatMap((device) => Object.entries(device.ports)
    .filter(([p]) => device.id !== id || p !== port).map(([, config]) => ipToInt(config.ip))));
  for (const server of project.devices) {
    if (!server.pool || !validPool(server.pool)) continue;
    const p = server.pool, start = ipToInt(p.start)!;
    for (const entry of addresses(server)) {
      if (!sameSubnet(entry.config.ip, p.start, p.mask) || entry.config.mask !== p.mask) continue;
      const path = segmentPath(project, endpoint, entry.ep);
      if (!path) continue;
      for (let i = 0; i < p.size; i++) {
        const value = start + i;
        if (value > 0xffffffff || used.has(value)) continue;
        const ip = intToIp(value);
        if (!sameSubnet(ip, p.start, p.mask) || !usableHost(ip, p.mask) || sameIp(ip, p.gateway) || sameIp(ip, p.dns)) continue;
        const updated = { ...client, gateway: p.gateway, dns: p.dns, ports: { ...client.ports, [port]: { ...client.ports[port], ip, mask: p.mask } } };
        const message = client.name + " leased " + ip + " from " + server.name + ".";
        return { project: setDevice(project, updated), message, events: [
          ...eventsAlong(path, "DHCP", "Discover"),
          ...eventsAlong([...path].reverse(), "DHCP", "Offer " + ip),
          ...eventsAlong(path, "DHCP", "Request " + ip),
          ...eventsAlong([...path].reverse(), "DHCP", "ACK " + ip),
        ] };
      }
    }
  }
  throw new Error("No reachable DHCP pool with a free address on this network segment.");
}

export function usableHost(ip: string, mask: string) {
  if (!validIp(ip) || !validMask(mask)) return false;
  const value = ipToInt(ip)!, bits = ipToInt(mask)!;
  const hostBits = (~bits) >>> 0, host = (value & hostBits) >>> 0;
  return value !== 0 && value < 0xe0000000 && (hostBits <= 1 || (host !== 0 && host !== hostBits));
}
export function validPool(pool: Pool) {
  return usableHost(pool.start, pool.mask) && Number.isInteger(pool.size) && pool.size >= 1 && pool.size <= 256
    && (!pool.gateway || (usableHost(pool.gateway, pool.mask) && sameSubnet(pool.gateway, pool.start, pool.mask)))
    && (!pool.dns || validIp(pool.dns));
}
export function normalizeRoute(network: string, mask: string, via: string): Route {
  if (!validIp(network) || !validMask(mask) || !validIp(via) || via === "0.0.0.0") throw new Error("Enter a valid destination, mask, and next-hop IPv4 address.");
  return { network: netAddress(network, mask), mask, via };
}
