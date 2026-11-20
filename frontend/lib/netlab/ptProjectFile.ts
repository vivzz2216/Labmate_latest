import type { PtSpec } from "./ptTypes";
import { getDevicePorts } from "./ptEngine";

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown): value is string => typeof value === "string" && value.length <= 200;
const optionalText = (value: unknown) => value === undefined || text(value);
const optionalBoolean = (value: unknown) => value === undefined || typeof value === "boolean";
const position = (value: unknown) => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 100_000;
const kinds = new Set(["pc", "laptop", "server", "printer", "ipphone", "tablet", "smartphone", "router", "switch", "hub", "wireless", "security", "cloud"]);
const media = new Set(["auto", "console", "straight", "cross", "fiber", "phone", "coaxial", "serial-dce", "serial-dte"]);
const route = (value: unknown) => object(value) && text(value.network) && text(value.mask) && text(value.nextHop);

function validDevice(value: unknown): boolean {
  if (!object(value) || !text(value.name) || !value.name.trim() || !kinds.has(String(value.type))
    || !position(value.x) || !position(value.y)) return false;
  if (!["model", "hostname", "ip", "mask", "gateway", "dns"].every((key) => optionalText(value[key]))
    || !optionalBoolean(value.power) || !optionalBoolean(value.dhcp)) return false;
  if (value.interfaces !== undefined && (!object(value.interfaces) || Object.keys(value.interfaces).length > 128
    || !Object.values(value.interfaces).every((p) => object(p) && text(p.ip) && text(p.mask) && optionalBoolean(p.shutdown) && optionalText(p.mac)))) return false;
  if (value.rip !== undefined && (!Array.isArray(value.rip) || value.rip.length > 128 || !value.rip.every(text))) return false;
  if (value.staticRoutes !== undefined && (!Array.isArray(value.staticRoutes) || value.staticRoutes.length > 128 || !value.staticRoutes.every(route))) return false;
  if (value.services !== undefined) {
    const s = value.services;
    if (!object(s) || !["httpEnabled", "dhcpEnabled", "dnsEnabled"].every((key) => typeof s[key] === "boolean")
      || !["dhcpPoolName", "dhcpGateway", "dhcpDns", "dhcpStartIp", "dhcpMask"].every((key) => text(s[key]))
      || typeof s.httpHtml !== "string" || s.httpHtml.length > 100_000
      || !Number.isInteger(s.dhcpMaxUsers) || Number(s.dhcpMaxUsers) < 1 || Number(s.dhcpMaxUsers) > 4096
      || !Array.isArray(s.dnsRecords) || s.dnsRecords.length > 128
      || !s.dnsRecords.every((r) => object(r) && text(r.name) && text(r.address))) return false;
  }
  return true;
}

export function readTopologyFile(contents: string): PtSpec {
  const fail = () => { throw new Error("Choose a valid LabMate topology JSON file."); };
  if (contents.length > 524_288) return fail();
  let value: unknown;
  try { value = JSON.parse(contents); } catch { return fail(); }
  if (!object(value) || !text(value.name) || !Array.isArray(value.devices) || value.devices.length > 48
    || !value.devices.every(validDevice) || !Array.isArray(value.links) || value.links.length > 256) return fail();
  const spec = value as unknown as PtSpec;
  const devices = new Map(spec.devices.map((d) => [d.name, d]));
  if (devices.size !== spec.devices.length) return fail();
  for (const l of spec.links) {
    if (!object(l) || !text(l.a) || !text(l.b) || !text(l.ap) || !text(l.bp)
      || (l.cable !== undefined && !media.has(l.cable)) || l.a === l.b) return fail();
    const a = devices.get(l.a), b = devices.get(l.b);
    if (!a || !b || !getDevicePorts(a).includes(l.ap) || !getDevicePorts(b).includes(l.bp)) return fail();
  }
  if (spec.notes !== undefined && (!Array.isArray(spec.notes) || spec.notes.length > 128
    || !spec.notes.every((n) => object(n) && text(n.id) && typeof n.text === "string" && n.text.length <= 4000 && position(n.x) && position(n.y)))) return fail();
  if (spec.shapes !== undefined && (!Array.isArray(spec.shapes) || spec.shapes.length > 128
    || !spec.shapes.every((s) => object(s) && text(s.id) && ["rect", "ellipse", "line"].includes(s.kind)
      && position(s.x) && position(s.y) && position(s.w) && position(s.h) && text(s.fill) && text(s.stroke)))) return fail();
  return spec;
}
