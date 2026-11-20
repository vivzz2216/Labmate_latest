import assert from "node:assert/strict";
import test from "node:test";
import { connect, deleteDevice, dhcp, emptyProject, linkUp, makeDevice, MASK, ping, setDevice } from "../lib/netlab/networkProject";
import type { Device, Project } from "../lib/netlab/networkProject";
import { newSession, runCommand } from "../lib/netlab/networkConsole";
import { buildSample, openProject } from "../lib/netlab/networkProjects";

function device(project: Project, id: string) {
  const match = project.devices.find((item) => item.id === id);
  assert.ok(match, id);
  return match;
}

function port(item: Device, name: string, ip: string) {
  return { ...item, ports: { ...item.ports, [name]: { ip, mask: MASK, enabled: true, vlan: 1 } } };
}

test("a switched LAN delivers ARP and both directions of ICMP, but a down port blocks traffic", () => {
  const lan = buildSample("lan");
  const echo = ping(lan, "PC1", "192.168.1.20");
  assert.ok(echo.ok);
  assert.ok(echo.events.some((e) => e.protocol === "ARP" && e.detail.startsWith("Who has")));
  assert.ok(echo.events.some((e) => e.protocol === "ICMP" && e.from === "PC2" && e.detail.startsWith("Echo reply")));
  const sw = device(lan, "SW1");
  const down = setDevice(lan, { ...sw, ports: { ...sw.ports, "Fa0/2": { ...sw.ports["Fa0/2"], enabled: false } } });
  assert.match(ping(down, "PC1", "192.168.1.20").message, /No ARP reply/);
});

test("static routes must carry traffic in both directions", () => {
  const routing = buildSample("routing");
  assert.ok(ping(routing, "PC1", "192.168.20.10").ok);
  const withoutReturnRoute = setDevice(routing, { ...device(routing, "R2"), routes: [] });
  const result = ping(withoutReturnRoute, "PC1", "192.168.20.10");
  assert.equal(result.ok, false);
  assert.match(result.message, /reply failed/);
});

test("switch access VLANs isolate hosts and keep separate segments with reused addresses distinct", () => {
  const vlan = buildSample("vlan");
  assert.equal(ping(vlan, "PC1", "192.168.1.20").ok, false);
  const sw = device(vlan, "SW1");
  const pc3 = port(makeDevice(vlan, "pc", 150, 420), "Eth0", "192.168.1.20");
  const extended = { ...vlan, devices: [pc3, ...vlan.devices] };
  const wired = connect(extended, { device: "PC3", port: "Eth0" }, { device: "SW1", port: "Fa0/3" }, "auto");
  assert.equal(ping(wired, "PC1", "192.168.1.20").ok, false);
  const sameVlan = setDevice(wired, { ...sw, ports: { ...sw.ports, "Fa0/2": { ...sw.ports["Fa0/2"], vlan: 10 } } });
  assert.ok(ping(sameVlan, "PC1", "192.168.1.20").ok);
});

test("Wi-Fi DHCP requires the correct SSID and DNS uses the reachable server", () => {
  const wireless = buildSample("wireless");
  const laptop = device(wireless, "LT1");
  assert.throws(() => dhcp(setDevice(wireless, { ...laptop, ssid: "wrong" }), laptop.id, "WiFi"), /No reachable DHCP/);
  const lease = dhcp(wireless, laptop.id, "WiFi");
  assert.equal(device(lease.project, laptop.id).ports.WiFi.ip, "192.168.4.50");
  assert.ok(lease.events.some((e) => e.detail.startsWith("ACK 192.168.4.50")));
  const result = ping(lease.project, laptop.id, "lab.local");
  assert.ok(result.ok);
  assert.ok(result.events.some((e) => e.protocol === "DNS" && e.detail.startsWith("Answer")));
});

test("auto cabling chooses fiber and console, port occupancy is enforced, and device deletion removes its links", () => {
  const base = emptyProject();
  const pc = port(makeDevice(base, "pc", 100, 150), "Eth0", "192.168.1.30");
  const router = port(makeDevice(base, "router", 300, 150), "SFP0", "192.168.1.1");
  const server = port(makeDevice(base, "server", 500, 150), "SFP0", "192.168.1.20");
  const a = { device: router.id, port: "SFP0" };
  const b = { device: server.id, port: "SFP0" };
  const fiber = connect({ ...base, devices: [pc, router, server] }, a, b, "auto");
  assert.equal(fiber.cables[0].medium, "fiber");
  assert.ok(ping(fiber, router.id, "192.168.1.20").ok);
  assert.throws(() => connect(fiber, a, b, "auto"), /already/i);
  const withConsole = connect(fiber, { device: pc.id, port: "RS-232" }, { device: router.id, port: "Console" }, "auto");
  assert.equal(withConsole.cables[1].medium, "console");
  assert.ok(linkUp(withConsole, withConsole.cables[1]));
  assert.equal(ping(withConsole, pc.id, "192.168.1.1").ok, false);
  assert.equal(deleteDevice(withConsole, router.id).cables.length, 0);
});

test("CLI configuration mutates the project, validates masks and survives a project file round trip", () => {
  let project = buildSample("routing");
  let session = newSession();
  function cli(command: string) {
    const result = runCommand(project, device(project, "R1"), session, command);
    session = result.session;
    if (result.project) project = result.project;
    return result.output;
  }
  assert.match(cli("configure terminal"), /enable first/);
  cli("enable");
  cli("configure terminal");
  cli("hostname Lab-Router");
  cli("interface Gi0/0");
  assert.match(cli("ip address 192.168.10.1 255.0.255.0"), /mask/);
  cli("shutdown");
  assert.equal(ping(project, "PC1", "192.168.20.10").ok, false);
  cli("ip address 192.168.10.1 255.255.255.0");
  cli("no shutdown");
  cli("end");
  assert.match(cli("show running-config"), /hostname Lab-Router/);
  assert.match(cli("show ip interface brief"), /Gi0\/0\s+192\.168\.10\.1\s+up/);
  const reopened = openProject(JSON.stringify(project));
  assert.deepEqual(reopened, project);
  assert.ok(ping(reopened, "PC1", "192.168.20.10").ok);
  assert.throws(() => openProject(JSON.stringify({ ...project, cables: [...project.cables, project.cables[0]] })));
});
