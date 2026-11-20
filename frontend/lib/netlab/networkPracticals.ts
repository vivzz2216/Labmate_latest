import { buildSample } from "./networkProjects";
import { connect, dhcp, emptyProject, makeDevice, MASK, ping, setDevice } from "./networkProject";
import type { Device, Model, PacketEvent, Project } from "./networkProject";

export interface PracticalFrame {
  id: string;
  title: string;
  explain: string;
  project: Project;
  events: PacketEvent[];
  device?: string;
  port?: string;
  settings?: boolean;
}

export function buildNetworkPractical(topic: string): PracticalFrame[] {
  const frames: PracticalFrame[] = [];
  let project = emptyProject();
  function device(id: string) {
    const result = project.devices.find((item) => item.id === id);
    if (!result) throw new Error("Unknown device " + id);
    return result;
  }
  function update(item: Device) {
    project = setDevice(project, item);
  }
  function configure(id: string, port: string, ip: string, mask = MASK) {
    const item = device(id);
    update({ ...item, ports: { ...item.ports, [port]: { ...item.ports[port], ip, mask } } });
  }
  function add(model: Model, x: number, y: number) {
    const item = makeDevice(project, model, x, y);
    project = { ...project, devices: [...project.devices, item] };
    return item;
  }
  function frame(title: string, explain: string, events: PacketEvent[] = [], selected?: string, port?: string, settings = false) {
    frames.push({ id: "step" + (frames.length + 1), title, explain, project, events, device: selected, port, settings });
  }
  function echo(title: string, source: string, destination: string, expected: boolean) {
    const result = ping(project, source, destination);
    if (result.ok !== expected) throw new Error(title + ": " + result.message);
    frame(title, result.message, result.events);
  }

  switch (topic) {
    case "switched-lan":
      project = buildSample("lan");
      configure("PC1", "Eth0", "192.168.10.10");
      configure("PC2", "Eth0", "192.168.10.20");
      frame("PC1 IPv4 configuration", "PC1 uses 192.168.10.10/24.", [], "PC1", "Eth0");
      frame("PC2 IPv4 configuration", "PC2 uses 192.168.10.20/24.", [], "PC2", "Eth0");
      echo("Ping from PC1 to PC2", "PC1", "192.168.10.20", true);
      echo("Ping from PC2 to PC1", "PC2", "192.168.10.10", true);
      break;
    case "static-routing":
      project = buildSample("routing");
      configure("R1", "Gi0/1", "10.0.0.1", "255.255.255.252");
      configure("R2", "Gi0/0", "10.0.0.2", "255.255.255.252");
      const remote = device("SRV1");
      const pc = makeDevice(project, "pc", remote.x, remote.y);
      update({ ...pc, id: remote.id, gateway: remote.gateway, ports: { ...pc.ports, Eth0: remote.ports.Eth0 } });
      frame("R1 routed networks", "R1 reaches the remote LAN through 10.0.0.2.", [], "R1", undefined, true);
      frame("R2 routed networks", "R2 reaches the remote LAN through 10.0.0.1.", [], "R2", undefined, true);
      echo("Ping across the static routes", "PC1", "192.168.20.10", true);
      break;
    case "vlan-isolation": {
      project = buildSample("vlan");
      frame("Switch port in VLAN 20", "Fa0/2 is assigned to VLAN 20. Fa0/1 is in VLAN 10.", [], "SW1", "Fa0/2");
      echo("Ping with separate VLANs", "PC1", "192.168.1.20", false);
      const sw = device("SW1");
      update({ ...sw, ports: { ...sw.ports, "Fa0/2": { ...sw.ports["Fa0/2"], vlan: 10 } } });
      frame("Switch port moved to VLAN 10", "Both PCs now use access ports in VLAN 10.", [], "SW1", "Fa0/2");
      echo("Ping in the same VLAN", "PC1", "192.168.1.20", true);
      break;
    }
    case "dhcp-lan": {
      project = emptyProject("DHCP address assignment");
      const server = add("server", 155, 220);
      const sw = add("switch", 480, 185);
      const first = add("pc", 340, 370);
      const second = add("pc", 645, 370);
      configure(server.id, "Eth0", "192.168.30.2");
      update({ ...device(server.id), pool: { start: "192.168.30.10", mask: MASK, size: 20, gateway: "192.168.30.1", dns: "" } });
      for (const [item, port] of [[server, "Fa0/1"], [first, "Fa0/2"], [second, "Fa0/3"]] as const) {
        project = connect(project, { device: item.id, port: "Eth0" }, { device: sw.id, port }, "auto");
      }
      frame("DHCP pool configuration", "The server offers leases on 192.168.30.0/24.", [], server.id, undefined, true);
      const leased = new Set<string>();
      for (const client of [first, second]) {
        const lease = dhcp(project, client.id, "Eth0");
        project = lease.project;
        const address = device(client.id).ports.Eth0.ip;
        if (!address.startsWith("192.168.30.") || leased.has(address)) throw new Error("Invalid DHCP lease.");
        leased.add(address);
        frame("DHCP lease for " + client.name, lease.message, lease.events, client.id, "Eth0");
      }
      break;
    }
    case "wireless-ssid":
      project = buildSample("wireless");
      update({ ...device("SRV1"), pool: null, records: {} });
      configure("SRV1", "Eth0", "192.168.40.2");
      configure("LT1", "WiFi", "192.168.40.10");
      frame("Matching wireless network name", "The laptop and access point use the same SSID.", [], "LT1", undefined, true);
      echo("Ping with a matching SSID", "LT1", "192.168.40.2", true);
      update({ ...device("LT1"), ssid: "Unmatched network" });
      frame("Changed wireless network name", "The laptop now uses a different SSID.", [], "LT1", undefined, true);
      echo("Ping with a mismatched SSID", "LT1", "192.168.40.2", false);
      break;
    default:
      throw new Error("Unknown network practical.");
  }
  return frames;
}
