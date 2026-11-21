import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executePcCommand, simulateLocalPing } from "../lib/netlab/ptEngine.ts";
import type { PtSpec } from "../lib/netlab/ptTypes.ts";

// PC0 - Switch0 - Router0 === Router1 - Laptop0: a ping only works when both routers hold a route towards the other network.
function twoRouters(options: { forward?: boolean; back?: boolean; shutdown?: boolean; gateway?: string } = {}): PtSpec {
  const { forward = true, back = true, shutdown = false, gateway = "192.168.1.1" } = options;
  return {
    name: "two routers",
    devices: [
      { type: "pc", name: "PC0", x: 0, y: 0, ip: "192.168.1.10", mask: "255.255.255.0", gateway },
      { type: "switch", name: "Switch0", x: 0, y: 0 },
      {
        type: "router", name: "Router0", x: 0, y: 0,
        interfaces: {
          "GigabitEthernet0/0": { ip: "192.168.1.1", mask: "255.255.255.0", shutdown: false },
          "GigabitEthernet0/1": { ip: "10.0.0.1", mask: "255.255.255.252", shutdown },
        },
        staticRoutes: forward ? [{ network: "192.168.2.0", mask: "255.255.255.0", nextHop: "10.0.0.2" }] : [],
      },
      {
        type: "router", name: "Router1", x: 0, y: 0,
        interfaces: {
          "GigabitEthernet0/0": { ip: "10.0.0.2", mask: "255.255.255.252", shutdown: false },
          "GigabitEthernet0/1": { ip: "192.168.2.1", mask: "255.255.255.0", shutdown: false },
        },
        staticRoutes: back ? [{ network: "192.168.1.0", mask: "255.255.255.0", nextHop: "10.0.0.1" }] : [],
      },
      { type: "laptop", name: "Laptop0", x: 0, y: 0, ip: "192.168.2.10", mask: "255.255.255.0", gateway: "192.168.2.1" },
    ],
    links: [
      { a: "PC0", ap: "FastEthernet0", b: "Switch0", bp: "FastEthernet0/1", cable: "straight" },
      { a: "Switch0", ap: "GigabitEthernet0/1", b: "Router0", bp: "GigabitEthernet0/0", cable: "straight" },
      { a: "Router0", ap: "GigabitEthernet0/1", b: "Router1", bp: "GigabitEthernet0/0", cable: "cross" },
      { a: "Router1", ap: "GigabitEthernet0/1", b: "Laptop0", bp: "FastEthernet0", cable: "cross" },
    ],
  } as PtSpec;
}

describe("Packet Tracer local engine: routing decides whether a ping succeeds", () => {
  it("crosses two routers when both have a static route", () => {
    const r = simulateLocalPing(twoRouters(), "PC0", "192.168.2.10");
    assert.equal(r.success, true);
    assert.deepEqual(r.path.filter((n) => n.startsWith("Router")), ["Router0", "Router1"]);
  });

  it("fails when no router has a route to the far network", () => {
    assert.equal(simulateLocalPing(twoRouters({ forward: false, back: false }), "PC0", "192.168.2.10").success, false);
  });

  it("fails when the return route is missing, even though the request arrives", () => {
    assert.equal(simulateLocalPing(twoRouters({ back: false }), "PC0", "192.168.2.10").success, false);
  });

  it("fails when the router interface carrying the route is shut down", () => {
    assert.equal(simulateLocalPing(twoRouters({ shutdown: true }), "PC0", "192.168.2.10").success, false);
  });

  it("fails when the host has no usable default gateway", () => {
    assert.equal(simulateLocalPing(twoRouters({ gateway: "192.168.1.99" }), "PC0", "192.168.2.10").success, false);
  });

  it("prints a Windows-style ping whose TTL falls by one for each router crossed", () => {
    const out = executePcCommand(twoRouters(), "PC0", "ping 192.168.2.10");
    assert.ok(out.some((line) => line.includes("Reply from 192.168.2.10: bytes=32") && line.includes("TTL=126")), out.join(" / "));
    assert.ok(out.some((line) => line.includes("Sent = 4, Received = 4, Lost = 0")));
  });

  it("lists the routers in tracert and ends with the destination", () => {
    const out = executePcCommand(twoRouters(), "PC0", "tracert 192.168.2.10");
    const hops = out.filter((line) => /^\s+\d+\s/.test(line));
    assert.equal(hops.length, 3, out.join(" / "));
    assert.ok(out.includes("Trace complete."));
  });

  it("reports 100% loss with the reason when there is no route", () => {
    const out = executePcCommand(twoRouters({ forward: false, back: false }), "PC0", "ping 192.168.2.10");
    assert.ok(out.some((line) => line.includes("Received = 0, Lost = 4 (100% loss)")), out.join(" / "));
  });
});
