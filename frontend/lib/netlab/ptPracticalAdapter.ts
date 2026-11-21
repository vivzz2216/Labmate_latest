import type { PracticalFrame } from "./networkPracticals.ts";
import type {
  CableType,
  DeviceKind,
  PtCable,
  PtDevice,
  PtEvent,
  PtPduRow,
  PtSpec,
} from "./ptTypes.ts";
import { defaultServerServices } from "./ptEngine.ts";

function mapModelMeta(model: string): { type: DeviceKind; labelModel: string } {
  switch (model) {
    case "router":
      return { type: "router", labelModel: "1941" };
    case "switch":
      return { type: "switch", labelModel: "2960-24TT" };
    case "hub":
      return { type: "hub", labelModel: "Hub-PT" };
    case "wirelessRouter":
      return { type: "wireless", labelModel: "WRT300N" };
    case "accessPoint":
      return { type: "wireless", labelModel: "AccessPoint-PT" };
    case "laptop":
      return { type: "laptop", labelModel: "Laptop-PT" };
    case "server":
      return { type: "server", labelModel: "Server-PT" };
    case "printer":
      return { type: "printer", labelModel: "Printer-PT" };
    default:
      return { type: "pc", labelModel: "PC-PT" };
  }
}

export interface AdaptedPracticalFrame {
  spec: PtSpec;
  events: PtEvent[];
  pdus: PtPduRow[];
  openDeviceName: string | null;
  openPort: string | null;
  openSettings: boolean;
}

export function adaptPracticalFrame(step: PracticalFrame): AdaptedPracticalFrame {
  const idToName = new Map<string, string>();
  step.project.devices.forEach((d) => idToName.set(d.id, d.name));

  const devices: PtDevice[] = step.project.devices.map((d) => {
    const meta = mapModelMeta(d.model);
    const interfaces: PtDevice["interfaces"] = {};
    const vlanIds = new Set<number>();
    let firstIp = "";
    let firstMask = "255.255.255.0";

    Object.entries(d.ports).forEach(([portName, portCfg]) => {
      if (portCfg.vlan && portCfg.vlan > 1) vlanIds.add(portCfg.vlan);
      if (!firstIp && portCfg.ip) {
        firstIp = portCfg.ip;
        firstMask = portCfg.mask || "255.255.255.0";
      }
      interfaces[portName] = {
        ip: portCfg.ip || "",
        mask: portCfg.mask || "255.255.255.0",
        shutdown: !portCfg.enabled,
        vlan: portCfg.vlan || 1,
      };
    });

    const staticRoutes = (d.routes ?? []).map((r) => ({
      network: r.network,
      mask: r.mask,
      nextHop: r.via,
    }));

    const baseServices = d.model === "server" ? defaultServerServices() : undefined;
    const services = baseServices
      ? {
          ...baseServices,
          dhcpEnabled: Boolean(d.pool),
          dhcpStartIp: d.pool?.start || baseServices.dhcpStartIp,
          dhcpMask: d.pool?.mask || baseServices.dhcpMask,
          dhcpGateway: d.pool?.gateway || baseServices.dhcpGateway,
          dhcpDns: d.pool?.dns || baseServices.dhcpDns,
          dnsRecords:
            Object.keys(d.records ?? {}).length > 0
              ? Object.entries(d.records).map(([name, address]) => ({ name, address }))
              : baseServices.dnsRecords,
        }
      : undefined;

    return {
      type: meta.type,
      model: meta.labelModel,
      name: d.name,
      hostname: d.name,
      x: d.x,
      y: d.y,
      power: d.powered,
      ip: firstIp || undefined,
      mask: firstIp ? firstMask : undefined,
      gateway: d.gateway || undefined,
      dns: d.dns || undefined,
      ssid: d.ssid || undefined,
      vlans: Array.from(vlanIds).map((id) => ({
        id,
        name: `VLAN${String(id).padStart(4, "0")}`,
      })),
      interfaces,
      staticRoutes: staticRoutes.length ? staticRoutes : undefined,
      services,
    };
  });

  const links: PtCable[] = step.project.cables.map((c) => {
    const cableType: CableType = c.medium === "wireless" ? "auto" : (c.medium as CableType);
    return {
      a: idToName.get(c.a.device) ?? c.a.device,
      ap: c.a.port,
      b: idToName.get(c.b.device) ?? c.b.device,
      bp: c.b.port,
      cable: cableType,
    };
  });

  const events: PtEvent[] = step.events.map((ev, idx) => ({
    time: Number((idx * 0.002).toFixed(3)),
    pdu: 1,
    last: idToName.get(ev.from) ?? ev.from,
    at: idToName.get(ev.to) ?? ev.to,
    type: ev.protocol,
    info: ev.detail,
    action: ev.failed ? "dropped" : "forwarded",
  }));

  const pdus: PtPduRow[] =
    events.length > 0
      ? [
          {
            pdu: 1,
            source: step.pdu?.source ?? (events[0].last || events[0].at),
            destination: step.pdu?.destination ?? events[events.length - 1].at,
            status: (step.pdu?.success ?? !events.some((ev) => ev.action === "dropped")) ? "Successful" : "Failed",
            type: events.find((ev) => ev.type === "ICMP")?.type ?? events[0].type,
          },
        ]
      : [];

  return {
    spec: {
      name: step.title || step.project.name,
      devices,
      links,
    },
    events,
    pdus,
    openDeviceName: step.device ? idToName.get(step.device) ?? step.device : null,
    openPort: step.port ?? null,
    openSettings: Boolean(step.settings),
  };
}
