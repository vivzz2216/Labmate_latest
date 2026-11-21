import {
  addressable, busyPort, compatibleMedia, connect, emptyProject, makeDevice, MASK, MAX_DEVICES, MODELS,
  normalizeRoute, portKinds, setDevice, usableHost, validMask, validPool,
} from "./networkProject.ts";
import type { Device, Medium, Model, Pool, Project } from "./networkProject.ts";
import { ipToInt } from "./ptEngine.ts";

export const WORLD = { width: 960, height: 560 };
export const STORAGE_KEY = "labmate.network-workspace.v1";
export const SAMPLES = [
  { id: "lan", name: "Switched LAN", detail: "ARP and ICMP between two hosts" },
  { id: "routing", name: "Static routing", detail: "Two subnets and two forwarding routers" },
  { id: "wireless", name: "Wireless and DHCP", detail: "Join an access point and lease an address" },
  { id: "vlan", name: "Access VLANs", detail: "Compare two broadcast domains" },
] as const;
export type SampleId = (typeof SAMPLES)[number]["id"];

export function buildSample(id: SampleId): Project {
  let project = emptyProject(SAMPLES.find((sample) => sample.id === id)!.name);
  function add(model: Model, x: number, y: number, settings: Partial<Device> = {}) {
    const device = { ...makeDevice(project, model, x, y), ...settings };
    project = { ...project, devices: [...project.devices, device] };
    return device.id;
  }
  function configure(id: string, port: string, ip: string, vlan = 1) {
    const device = project.devices.find((d) => d.id === id)!;
    project = setDevice(project, { ...device, ports: { ...device.ports, [port]: { ip, mask: MASK, vlan, enabled: true } } });
  }
  function wire(a: string, ap: string, b: string, bp: string) {
    project = connect(project, { device: a, port: ap }, { device: b, port: bp }, "auto");
  }
  if (id === "routing") {
    const left = add("pc", 125, 320, { gateway: "192.168.10.1" });
    const r1 = add("router", 350, 225, { routes: [normalizeRoute("192.168.20.0", MASK, "10.0.0.2")] });
    const r2 = add("router", 610, 225, { routes: [normalizeRoute("192.168.10.0", MASK, "10.0.0.1")] });
    const right = add("server", 835, 320, { gateway: "192.168.20.1" });
    configure(left, "Eth0", "192.168.10.10");
    configure(r1, "Gi0/0", "192.168.10.1"); configure(r1, "Gi0/1", "10.0.0.1");
    configure(r2, "Gi0/0", "10.0.0.2"); configure(r2, "Gi0/1", "192.168.20.1");
    configure(right, "Eth0", "192.168.20.10");
    wire(left, "Eth0", r1, "Gi0/0"); wire(r1, "Gi0/1", r2, "Gi0/0"); wire(r2, "Gi0/1", right, "Eth0");
  } else if (id === "wireless") {
    const laptop = add("laptop", 226, 310, { ssid: "LabMate Wi-Fi" });
    const ap = add("accessPoint", 480, 210);
    const server = add("server", 735, 310, {
      pool: { start: "192.168.4.50", mask: MASK, size: 20, gateway: "", dns: "192.168.4.2" },
      records: { "lab.local": "192.168.4.2" },
    });
    configure(server, "Eth0", "192.168.4.2");
    wire(laptop, "WiFi", ap, "WiFi"); wire(ap, "Eth0", server, "Eth0");
  } else {
    const vlan = id === "vlan";
    const sw = add("switch", 480, 200);
    const first = add("pc", 240, 342);
    const second = add("pc", 720, 342);
    configure(first, "Eth0", "192.168.1.10"); configure(second, "Eth0", "192.168.1.20");
    configure(sw, "Fa0/1", "", vlan ? 10 : 1); configure(sw, "Fa0/2", "", vlan ? 20 : 1);
    wire(first, "Eth0", sw, "Fa0/1"); wire(second, "Eth0", sw, "Fa0/2");
  }
  return project;
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function string(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}
function address(value: unknown): value is string {
  return string(value, 15) && (!value || ipToInt(value) !== null);
}
function id(value: unknown): value is string {
  return string(value, 64) && /^[\w-]+$/.test(value) && !["__proto__", "constructor", "prototype"].includes(value);
}

export function openProject(contents: string): Project {
  if (contents.length > 524_288) throw new Error("The project exceeds the 512 KB limit.");
  const raw: unknown = JSON.parse(contents);
  if (!object(raw) || raw.version !== 1 || !string(raw.name, 96) || !raw.name.trim()
    || !Array.isArray(raw.devices) || raw.devices.length > MAX_DEVICES
    || !Array.isArray(raw.cables) || raw.cables.length > 200) throw new Error("This is not a supported LabMate network project.");
  const project = emptyProject(raw.name);
  for (const item of raw.devices) {
    if (!object(item) || !id(item.id) || project.devices.some((d) => d.id === item.id)
      || !string(item.model, 30) || !Object.prototype.hasOwnProperty.call(MODELS, item.model)
      || !string(item.name, 48) || !item.name.trim() || typeof item.powered !== "boolean"
      || typeof item.x !== "number" || typeof item.y !== "number" || !Number.isFinite(item.x) || !Number.isFinite(item.y)
      || !address(item.gateway) || !address(item.dns) || !string(item.ssid, 32)
      || !object(item.ports) || !Array.isArray(item.routes) || item.routes.length > 24 || !object(item.records)) {
      throw new Error("The project contains an invalid device.");
    }
    const model = item.model as Model;
    const device = makeDevice(project, model, Math.max(48, Math.min(WORLD.width - 48, item.x)), Math.max(48, Math.min(WORLD.height - 48, item.y)));
    Object.assign(device, { id: item.id, name: item.name, powered: item.powered, gateway: item.gateway, dns: item.dns, ssid: item.ssid });
    for (const port of Object.keys(portKinds(device))) {
      const config = item.ports[port];
      if (!object(config) || !address(config.ip) || !string(config.mask, 15) || !validMask(config.mask)
        || typeof config.enabled !== "boolean" || typeof config.vlan !== "number"
        || !Number.isInteger(config.vlan) || config.vlan < 1 || config.vlan > 4094
        || (config.ip && (!addressable(device, port) || !usableHost(config.ip, config.mask)))) {
        throw new Error("The project contains an invalid port configuration.");
      }
      device.ports[port] = { ip: config.ip, mask: config.mask, vlan: config.vlan, enabled: config.enabled };
    }
    device.routes = item.routes.map((route: unknown) => {
      if (!object(route) || !address(route.network) || !address(route.mask) || !address(route.via)) throw new Error("Invalid static route.");
      return normalizeRoute(route.network, route.mask, route.via);
    });
    if (item.pool !== null) {
      const pool = item.pool;
      if (!object(pool) || !address(pool.start) || !address(pool.mask) || !address(pool.gateway) || !address(pool.dns)
        || typeof pool.size !== "number" || !validPool(pool as unknown as Pool)) throw new Error("Invalid DHCP pool.");
      device.pool = { start: pool.start, mask: pool.mask, size: pool.size, gateway: pool.gateway, dns: pool.dns };
    }
    const records = Object.entries(item.records);
    if (records.length > 24) throw new Error("Invalid DNS records.");
    for (const [name, ip] of records) {
      if (!validDnsName(name) || !address(ip) || !ip) throw new Error("Invalid DNS record.");
      device.records[name.toLowerCase()] = ip;
    }
    project.devices.push(device);
  }
  for (const item of raw.cables) {
    if (!object(item) || !id(item.id) || project.cables.some((c) => c.id === item.id)
      || !object(item.a) || !id(item.a.device) || !string(item.a.port, 32)
      || !object(item.b) || !id(item.b.device) || !string(item.b.port, 32)) throw new Error("Invalid cable.");
    const a = { device: item.a.device, port: item.a.port }, b = { device: item.b.device, port: item.b.port };
    const left = project.devices.find((d) => d.id === a.device), right = project.devices.find((d) => d.id === b.device);
    if (!left || !right || left === right || !item.medium || compatibleMedia(left, a.port, right, b.port) !== item.medium
      || busyPort(project, a) || busyPort(project, b)) throw new Error("Invalid cable or occupied port in the project.");
    project.cables.push({ id: item.id, a, b, medium: item.medium as Medium });
  }
  return project;
}

export const validDnsName = (name: string) => name.length <= 96 && /^[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(name)
  && !["__proto__", "constructor", "prototype"].includes(name.toLowerCase());
