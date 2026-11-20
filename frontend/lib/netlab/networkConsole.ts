import { addressable, dhcp, linkUp, MASK, normalizeRoute, ping, portKinds, routerLike, setDevice, usableHost, validMask } from "./networkProject";
import type { Device, PacketEvent, Project } from "./networkProject";

export interface Session { enabled: boolean; configuring: boolean; port: string }
export const newSession = (): Session => ({ enabled: false, configuring: false, port: "" });
export const prompt = (device: Device, mode: Session) => device.name
  + (mode.port ? "(config-if)#" : mode.configuring ? "(config)#" : mode.enabled ? "#" : ">");
export interface CommandResult { output: string; session: Session; project?: Project; events?: PacketEvent[] }

export function runCommand(project: Project, device: Device, session: Session, text: string): CommandResult {
  const tokens = text.trim().split(/\s+/);
  const command = tokens.join(" ").toLowerCase();
  const [verb, noun] = tokens.map((token) => token.toLowerCase());
  const answer = (output = "", next = session): CommandResult => ({ output, session: next });
  const change = (updated: Device): CommandResult => ({ ...answer(), project: setDevice(project, updated) });
  if (!command) return answer();
  if (command === "?" || command === "help") {
    if (session.port) return answer("ip address <ip> <mask>\nno shutdown | shutdown\nswitchport access vlan <1–4094>\nexit | end");
    if (session.configuring) return answer("hostname <name>\ninterface <port>\nip route <network> <mask> <next-hop>\nexit | end");
    return answer("enable\nconfigure terminal\nshow running-config\nshow ip interface brief\nshow ip route\nping <ip-or-host>\nFor an end device: renew <port> (DHCP)");
  }
  if (command === "enable" || command === "en") return answer("", { ...session, enabled: true });
  if (command === "configure terminal" || command === "conf t") {
    return session.enabled ? answer("Enter one configuration command per line.", { ...session, configuring: true, port: "" })
      : answer("% Enter enable first.");
  }
  if (command === "exit") return answer("", session.port ? { ...session, port: "" }
    : session.configuring ? { ...session, configuring: false } : newSession());
  if (command === "end") return answer("", { ...session, configuring: false, port: "" });
  if (verb === "ping" || (verb === "do" && noun === "ping")) {
    const target = tokens[verb === "ping" ? 1 : 2];
    if (!target) return answer("% Usage: ping <IPv4 address or hostname>");
    const result = ping(project, device.id, target);
    return { ...answer(result.message), events: result.events };
  }
  if (verb === "renew") {
    try {
      const lease = dhcp(project, device.id, tokens[1] || "Eth0");
      return { ...answer(lease.message), project: lease.project, events: lease.events };
    } catch (error) {
      return answer("% " + (error as Error).message);
    }
  }
  const show = command.replace(/^do /, "");
  if (show === "show ip interface brief" || show === "sh ip int br") {
    return answer(["Interface      IPv4 address      Status", ...Object.entries(device.ports).map(([port, config]) => {
      const up = project.cables.some((link) => [link.a, link.b].some((ep) => ep.device === device.id && ep.port === port) && linkUp(project, link));
      const state = !device.powered || !config.enabled ? "administratively down" : up || port === "LAN" ? "up" : "down";
      return port.padEnd(15) + (config.ip || "unassigned").padEnd(18) + state;
    })].join("\n"));
  }
  if (show === "show ip route") {
    return answer([
      ...Object.entries(device.ports).filter(([, p]) => device.powered && p.enabled && p.ip)
        .map(([port, p]) => "C  " + p.ip + " " + p.mask + " · " + port),
      ...device.routes.map((r) => "S  " + r.network + " " + r.mask + " via " + r.via),
    ].join("\n") || "No routes configured.");
  }
  if (show === "show running-config" || show === "sh run") {
    return answer([
      "hostname " + device.name,
      ...(device.gateway ? ["ip default-gateway " + device.gateway] : []),
      ...(device.dns ? ["ip name-server " + device.dns] : []),
      ...Object.entries(device.ports).flatMap(([port, config]) => [
        "interface " + port, ...(config.ip ? [" ip address " + config.ip + " " + config.mask] : []),
        ...(device.model === "switch" && port !== "Console" ? [" switchport access vlan " + config.vlan] : []),
        config.enabled ? " no shutdown" : " shutdown",
      ]),
      ...device.routes.map((r) => ["ip route", r.network, r.mask, r.via].join(" ")),
      "end",
    ].join("\n"));
  }
  if (session.configuring && verb === "hostname") {
    return tokens.length === 2 && /^[a-z\d][a-z\d-]{0,47}$/i.test(tokens[1])
      ? change({ ...device, name: tokens[1] }) : answer("% Hostnames use letters, digits, and hyphens.");
  }
  if (session.configuring && (verb === "interface" || verb === "int")) {
    const port = Object.keys(portKinds(device)).find((p) => p.toLowerCase() === noun);
    return port ? answer("", { ...session, port }) : answer("% Unknown interface. Use show ip interface brief.");
  }
  if (session.configuring && routerLike(device) && verb === "ip" && noun === "route") {
    try {
      if (tokens.length !== 5) throw new Error("Usage: ip route <network> <mask> <next-hop>");
      const route = normalizeRoute(tokens[2], tokens[3], tokens[4]);
      const remaining = device.routes.filter((r) => r.network !== route.network || r.mask !== route.mask);
      if (remaining.length >= 24) return answer("% This router can hold 24 static routes.");
      return change({ ...device, routes: [...remaining, route] });
    } catch (error) {
      return answer("% " + (error as Error).message);
    }
  }
  if (session.port && device.ports[session.port]) {
    const port = device.ports[session.port];
    let next = port;
    if (command === "shutdown" || command === "no shutdown") next = { ...port, enabled: command === "no shutdown" };
    else if (verb === "ip" && noun === "address" && addressable(device, session.port)) {
      const ip = tokens[2], mask = tokens[3] || MASK;
      if (!ip || !validMask(mask) || !usableHost(ip, mask)) return answer("% Enter a valid host IPv4 address and contiguous subnet mask.");
      next = { ...port, ip, mask };
    } else if (device.model === "switch" && session.port !== "Console" && command.startsWith("switchport access vlan ")) {
      const vlan = Number(tokens[3]);
      if (!Number.isInteger(vlan) || vlan < 1 || vlan > 4094) return answer("% VLAN IDs run from 1–4094.");
      next = { ...port, vlan };
    }
    if (next !== port) return change({ ...device, ports: { ...device.ports, [session.port]: next } });
  }
  return answer("% Command not available in this mode. Enter ? for help.");
}
