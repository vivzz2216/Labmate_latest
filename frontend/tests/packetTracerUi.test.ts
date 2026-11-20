import assert from "node:assert/strict";
import test from "node:test";
import {
  executeIosCommand,
  simulateLocalPing,
  type IosSessionState,
} from "../lib/netlab/ptEngine.ts";
import { getPresetSpec, PT_PRESETS } from "../lib/netlab/ptPresets.ts";
import type { PracticalFrame } from "../lib/netlab/networkPracticals.ts";
import { adaptPracticalFrame } from "../lib/netlab/ptPracticalAdapter.ts";

test("PT-1: all built-in PT_PRESETS build cleanly and Switched LAN / Hub Star / Static Routing ping successfully with ARP and ICMP events", () => {
  for (let i = 0; i < PT_PRESETS.length; i++) {
    const built = PT_PRESETS[i].build();
    assert.ok(typeof built.name === "string");
    assert.ok(Array.isArray(built.devices));
    assert.ok(Array.isArray(built.links));
  }

  const switchedLan = getPresetSpec("switched-lan");
  const swPing = simulateLocalPing(switchedLan, "PC0", "192.168.1.100", 1);
  assert.equal(swPing.success, true);
  assert.ok(swPing.events.some((e) => e.type === "ARP"), "expected ARP events on switched-lan");
  assert.ok(swPing.events.some((e) => e.type === "ICMP"), "expected ICMP events on switched-lan");

  const hubStar = getPresetSpec("hub-star");
  const hubPing = simulateLocalPing(hubStar, "PC0", "192.168.3.2", 1);
  assert.equal(hubPing.success, true);
  assert.ok(hubPing.events.some((e) => e.type === "ARP"));
  assert.ok(hubPing.events.some((e) => e.type === "ICMP"));

  const staticRouting = getPresetSpec("static-routing");
  const routePing = simulateLocalPing(staticRouting, "PC0", "192.168.20.10", 1);
  assert.equal(routePing.success, true);
  assert.deepEqual(routePing.path, ["PC0", "Router0", "Router1", "Server0"]);
  assert.ok(routePing.events.some((e) => e.type === "ARP"));
  assert.ok(routePing.events.some((e) => e.type === "ICMP"));
});

test("PT-2: access-vlans preset isolates VLAN 10 from VLAN 20 while allowing intra-VLAN 10 pings", () => {
  const vlans = getPresetSpec("access-vlans");

  // PC0 (Fa0/1, VLAN 10) cannot ping PC1 (Fa0/2, VLAN 20)
  const crossVlan = simulateLocalPing(vlans, "PC0", "192.168.1.20", 1);
  assert.equal(crossVlan.success, false);
  assert.match(crossVlan.error ?? "", /VLAN|unreachable/i);

  // PC0 (Fa0/1, VLAN 10) CAN ping PC2 (Fa0/3, VLAN 10)
  const sameVlan = simulateLocalPing(vlans, "PC0", "192.168.1.30", 2);
  assert.equal(sameVlan.success, true);
});

test("PT-3: Cisco IOS CLI configures VLAN membership, updates show vlan brief, and restores ping connectivity", () => {
  let spec = getPresetSpec("access-vlans");
  let session: IosSessionState = { priv: false, configMode: false, iface: null, ripMode: false };

  function runIos(cmd: string) {
    const res = executeIosCommand(spec, "Switch0", cmd, session);
    session = res.nextSession;
    if (res.updatedDevice) {
      spec = {
        ...spec,
        devices: spec.devices.map((d) => (d.name === "Switch0" ? res.updatedDevice! : d)),
      };
    }
    return res.output;
  }

  runIos("enable");
  runIos("configure terminal");
  runIos("vlan 10");
  runIos("interface FastEthernet0/2");
  runIos("switchport mode access");
  runIos("switchport access vlan 10");
  runIos("end");

  const vlanBrief = runIos("show vlan brief").join("\n");
  assert.match(vlanBrief, /10\s+Sales\s+active\s+.*Fa0\/2/);

  const after = simulateLocalPing(spec, "PC0", "192.168.1.20", 3);
  assert.equal(after.success, true);
});

test("PT-4: adaptPracticalFrame converts PracticalFrame with router, switch VLANs, PC, cables, and events cleanly", () => {
  const mockFrame: PracticalFrame = {
    id: "step-vlan",
    title: "VLAN 10 Verification",
    explain: "Both PCs share VLAN 10.",
    device: "SW1",
    port: "Fa0/2",
    settings: false,
    project: {
      version: 1 as const,
      name: "Lab Practical",
      devices: [
        {
          id: "R1",
          model: "router" as const,
          name: "Router1",
          x: 480,
          y: 120,
          powered: true,
          gateway: "",
          dns: "",
          ssid: "",
          routes: [{ network: "192.168.20.0", mask: "255.255.255.0", via: "10.0.0.2" }],
          pool: null,
          records: {},
          ports: {
            "Gi0/0": { ip: "192.168.10.1", mask: "255.255.255.0", vlan: 1, enabled: true },
          },
        },
        {
          id: "SW1",
          model: "switch" as const,
          name: "Switch1",
          x: 480,
          y: 240,
          powered: true,
          gateway: "",
          dns: "",
          ssid: "",
          routes: [],
          pool: null,
          records: {},
          ports: {
            "Fa0/1": { ip: "", mask: "255.255.255.0", vlan: 10, enabled: true },
            "Fa0/2": { ip: "", mask: "255.255.255.0", vlan: 10, enabled: true },
          },
        },
        {
          id: "PC1",
          model: "pc" as const,
          name: "PC-A",
          x: 240,
          y: 360,
          powered: true,
          gateway: "192.168.10.1",
          dns: "",
          ssid: "",
          routes: [],
          pool: null,
          records: {},
          ports: {
            Eth0: { ip: "192.168.10.10", mask: "255.255.255.0", vlan: 1, enabled: true },
          },
        },
      ],
      cables: [
        { id: "c1", a: { device: "PC1", port: "Eth0" }, b: { device: "SW1", port: "Fa0/1" }, medium: "straight" as const },
        { id: "c2", a: { device: "SW1", port: "Fa0/2" }, b: { device: "R1", port: "Gi0/0" }, medium: "straight" as const },
      ],
    },
    events: [
      { protocol: "ARP" as const, from: "PC1", to: "SW1", detail: "Who has 192.168.10.1?" },
      { protocol: "ICMP" as const, from: "PC1", to: "R1", detail: "Echo request" },
    ],
  };

  const adapted = adaptPracticalFrame(mockFrame);
  assert.equal(adapted.spec.name, "VLAN 10 Verification");
  assert.equal(adapted.spec.devices.length, 3);
  assert.equal(adapted.spec.links.length, 2);
  assert.equal(adapted.openDeviceName, "Switch1");
  assert.equal(adapted.openPort, "Fa0/2");
  assert.equal(adapted.events.length, 2);
  assert.equal(adapted.events[0].last, "PC-A");
  assert.equal(adapted.events[0].at, "Switch1");
  assert.equal(adapted.spec.devices[1].vlans?.[0]?.id, 10);
});
