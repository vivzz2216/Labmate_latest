"use client";

import { useState } from "react";
import { Cable as CableIcon, Power, Terminal, X } from "lucide-react";
import { ipToInt } from "@/lib/netlab/ptEngine";
import {
  addressable, CABLING, linkUp, MASK, MODELS, normalizeRoute, portKinds, routerLike, usableHost, validMask, validPool,
} from "@/lib/netlab/networkProject";
import type { Device, PacketEvent, Pool, Port, Project } from "@/lib/netlab/networkProject";
import { newSession, prompt, runCommand } from "@/lib/netlab/networkConsole";
import { validDnsName } from "@/lib/netlab/networkProjects";
import styles from "./networkWorkspace.module.css";

interface Props {
  device: Device; project: Project; selectedPort: string; onPort: (port: string) => void;
  update: (device: Device) => void; lease: (port: string) => void;
  commandResult: (project?: Project, events?: PacketEvent[], message?: string) => void;
  close: () => void; remove: () => void;
  disconnect: (id: string) => void; openConsoleTarget: (device: string) => void;
  initialTab?: "ports" | "terminal" | "settings";
}

export function NetworkDeviceInspector({ device, project, selectedPort, onPort, update, lease, commandResult, close, remove, disconnect, openConsoleTarget, initialTab = "ports" }: Props) {
  const [tab, setTab] = useState<"ports" | "settings" | "terminal">(initialTab);
  const consoleTargets = project.cables.filter((c) => c.medium === "console" && linkUp(project, c))
    .flatMap((c) => c.a.device === device.id && c.a.port === "RS-232" ? [c.b.device]
      : c.b.device === device.id && c.b.port === "RS-232" ? [c.a.device] : []);
  return (
    <aside className={styles.inspector} aria-label="Device inspector">
      <div className={styles.inspectorTitle}>
        <div><small>{MODELS[device.model].label} · {device.id}</small><h2>{device.name}</h2></div>
        <button type="button" className={styles.iconButton} aria-label="Close device inspector" onClick={close}><X size={16} /></button>
      </div>
      <div className={styles.tabs} role="group" aria-label="Device views">
        <button type="button" aria-pressed={tab === "ports"} onClick={() => setTab("ports")}>Ports</button>
        <button type="button" aria-pressed={tab === "settings"} onClick={() => setTab("settings")}>Settings</button>
        <button type="button" aria-pressed={tab === "terminal"} onClick={() => setTab("terminal")}>Terminal</button>
      </div>
      <div className={styles.inspectorBody}>
        {tab === "ports" && <>
          <div className={styles.portList} role="group" aria-label="Device ports">
            {Object.keys(device.ports).map((port) => {
              const related = project.cables.filter(({ a, b }) => (a.device === device.id && a.port === port) || (b.device === device.id && b.port === port));
              const up = related.some((link) => linkUp(project, link));
              return <button key={port} type="button" aria-pressed={port === selectedPort} onClick={() => onPort(port)}>
                <span className={up ? styles.dotUp : styles.dotIdle} /><span>{port}</span><small>{!device.powered || !device.ports[port].enabled ? "Disabled" : up ? "Linked" : related.length ? "Down" : "Free"}</small>
              </button>;
            })}
          </div>
          {device.ports[selectedPort] && <PortEditor key={selectedPort + JSON.stringify(device.ports[selectedPort])} device={device} port={selectedPort}
            save={(config) => update({ ...device, ports: { ...device.ports, [selectedPort]: config } })}
            requestLease={() => lease(selectedPort)} />}
          {project.cables.filter(({ a, b }) => (a.device === device.id && a.port === selectedPort) || (b.device === device.id && b.port === selectedPort))
            .map((link) => {
              const other = link.a.device === device.id ? link.b : link.a;
              return <div className={styles.linkRow} key={link.id}>
                <CableIcon size={15} /><div><b>{project.devices.find((d) => d.id === other.device)?.name} · {other.port}</b><small>{CABLING[link.medium]}</small></div>
                <button type="button" className={styles.iconButton} aria-label={"Disconnect " + other.device + " " + other.port} onClick={() => disconnect(link.id)}><X size={15} /></button>
              </div>;
            })}
        </>}
        {tab === "settings" && <>
          <DeviceSettings key={[device.name, device.gateway, device.dns, device.ssid].join("|")} device={device} save={update} />
          {routerLike(device) && <RouteEditor device={device} save={update} />}
          {(routerLike(device) || device.model === "server") && <PoolEditor key={JSON.stringify(device.pool)} device={device} save={update} />}
          {device.model === "server" && <DnsEditor device={device} save={update} />}
          <div className={styles.deviceActions}>
            <button type="button" onClick={() => update({ ...device, powered: !device.powered })}><Power size={15} /> {device.powered ? "Power off" : "Power on"}</button>
            <button type="button" className={styles.danger} onClick={remove}>Delete device</button>
          </div>
        </>}
        {tab === "terminal" && <>
          {consoleTargets.map((id) => <button type="button" className={styles.consoleTarget} key={id} onClick={() => openConsoleTarget(id)}>
            <Terminal size={15} /> Open serial console to {project.devices.find((d) => d.id === id)?.name}
          </button>)}
          <DeviceConsole device={device} project={project} commandResult={commandResult} />
        </>}
      </div>
    </aside>
  );
}

function PortEditor({ device, port, save, requestLease }: { device: Device; port: string; save: (config: Port) => void; requestLease: () => void }) {
  const [draft, setDraft] = useState(device.ports[port]);
  const [error, setError] = useState("");
  const ipEnabled = addressable(device, port);
  const canLease = !routerLike(device) && ipEnabled;
  const change = (patch: Partial<Port>) => setDraft({ ...draft, ...patch });
  return <form className={styles.form} onSubmit={(event) => {
    event.preventDefault();
    if (!validMask(draft.mask) || (draft.ip && !usableHost(draft.ip, draft.mask))) return setError("Enter a valid host address and subnet mask.");
    if (!Number.isInteger(draft.vlan) || draft.vlan < 1 || draft.vlan > 4094) return setError("Enter a VLAN ID from 1 to 4094.");
    setError("");
    save({ ...draft, ip: draft.ip.trim(), mask: draft.mask.trim() });
  }}>
    <h3>{port} <small>{portKinds(device)[port]}</small></h3>
    <label className={styles.check}><input type="checkbox" checked={draft.enabled} onChange={(e) => change({ enabled: e.target.checked })} /> Interface enabled</label>
    {ipEnabled && <>
      <label>IPv4 address<input value={draft.ip} onChange={(e) => change({ ip: e.target.value })} maxLength={15} placeholder="192.168.1.10" /></label>
      <label>Subnet mask<input value={draft.mask} onChange={(e) => change({ mask: e.target.value })} maxLength={15} /></label>
    </>}
    {device.model === "switch" && port !== "Console" && <label>Access VLAN<input type="number" min="1" max="4094" value={draft.vlan || ""} onChange={(e) => change({ vlan: e.target.valueAsNumber })} /></label>}
    {error && <p className={styles.fieldError} role="alert">{error}</p>}
    <div className={styles.formActions}><button type="submit" className={styles.primary}>Apply port settings</button>
      {canLease && <button type="button" onClick={requestLease}>Request DHCP</button>}</div>
  </form>;
}

function DeviceSettings({ device, save }: { device: Device; save: (device: Device) => void }) {
  const [name, setName] = useState(device.name);
  const [gateway, setGateway] = useState(device.gateway);
  const [dns, setDns] = useState(device.dns);
  const [ssid, setSsid] = useState(device.ssid);
  const [error, setError] = useState("");
  const hasAddress = Object.keys(device.ports).some((port) => addressable(device, port));
  return <form className={styles.form} onSubmit={(e) => {
    e.preventDefault();
    if (!name.trim() || [gateway, dns].some((value) => value && ipToInt(value) === null)) return setError("Enter a name and valid IPv4 addresses.");
    setError("");
    save({ ...device, name: name.trim(), gateway: gateway.trim(), dns: dns.trim(), ssid: ssid.trim() });
  }}>
    <h3>Device settings</h3>
    <label>Name<input required value={name} maxLength={48} onChange={(e) => setName(e.target.value)} /></label>
    {hasAddress && !routerLike(device) && <label>Default gateway<input value={gateway} maxLength={15} onChange={(e) => setGateway(e.target.value)} placeholder="192.168.1.1" /></label>}
    {hasAddress && <label>DNS server<input value={dns} maxLength={15} onChange={(e) => setDns(e.target.value)} placeholder="192.168.1.2" /></label>}
    {device.ports.WiFi && <label>Wi-Fi network name (SSID)<input value={ssid} maxLength={32} onChange={(e) => setSsid(e.target.value)} /></label>}
    {error && <p role="alert" className={styles.fieldError}>{error}</p>}
    <button type="submit" className={styles.primary}>Apply device settings</button>
  </form>;
}

function RouteEditor({ device, save }: { device: Device; save: (device: Device) => void }) {
  const [network, setNetwork] = useState("");
  const [mask, setMask] = useState(MASK);
  const [via, setVia] = useState("");
  const [error, setError] = useState("");
  return <form className={styles.form} onSubmit={(e) => {
    e.preventDefault();
    try {
      const route = normalizeRoute(network.trim(), mask.trim(), via.trim());
      const remaining = device.routes.filter((r) => r.network !== route.network || r.mask !== route.mask);
      if (remaining.length >= 24) throw new Error("This router can hold 24 static routes.");
      save({ ...device, routes: [...remaining, route] });
      setNetwork(""); setVia(""); setError("");
    } catch (err) { setError((err as Error).message); }
  }}>
    <h3>Static routes</h3>
    {device.routes.map((r, i) => <div key={r.network + "/" + r.mask} className={styles.linkRow}>
      <span><b>{r.network}</b><small>{r.mask} via {r.via}</small></span>
      <button type="button" className={styles.iconButton} aria-label={"Remove route " + r.network} onClick={() => save({ ...device, routes: device.routes.filter((_, j) => j !== i) })}><X size={15} /></button>
    </div>)}
    <label>Destination network<input required maxLength={15} value={network} onChange={(e) => setNetwork(e.target.value)} /></label>
    <label>Route mask<input required maxLength={15} value={mask} onChange={(e) => setMask(e.target.value)} /></label>
    <label>Next hop<input required maxLength={15} value={via} onChange={(e) => setVia(e.target.value)} /></label>
    {error && <p role="alert" className={styles.fieldError}>{error}</p>}
    <button type="submit" className={styles.primary}>Add route</button>
  </form>;
}

function PoolEditor({ device, save }: { device: Device; save: (device: Device) => void }) {
  const [pool, setPool] = useState<Pool>(device.pool ?? { start: "", mask: MASK, size: 20, gateway: "", dns: "" });
  const [error, setError] = useState("");
  return <form className={styles.form} onSubmit={(e) => {
    e.preventDefault();
    const next = { ...pool, start: pool.start.trim(), mask: pool.mask.trim(), gateway: pool.gateway.trim(), dns: pool.dns.trim() };
    if (!validPool(next)) return setError("Enter a usable pool start, valid mask, and 1–256 leases. The gateway must be in the pool subnet.");
    setError("");
    save({ ...device, pool: next });
  }}>
    <h3>DHCP pool <small>{device.pool ? "Enabled" : "Disabled"}</small></h3>
    {([["start", "First lease"], ["mask", "Pool mask"], ["gateway", "Pool gateway"], ["dns", "Pool DNS"]] as const).map(([key, label]) =>
      <label key={key}>{label}<input value={pool[key]} maxLength={15} onChange={(e) => setPool({ ...pool, [key]: e.target.value })} /></label>)}
    <label>Maximum leases<input type="number" min="1" max="256" value={pool.size || ""} onChange={(e) => setPool({ ...pool, size: e.target.valueAsNumber })} /></label>
    {error && <p role="alert" className={styles.fieldError}>{error}</p>}
    <div className={styles.formActions}><button type="submit" className={styles.primary}>Enable DHCP pool</button>
      {device.pool && <button type="button" onClick={() => save({ ...device, pool: null })}>Disable pool</button>}</div>
  </form>;
}

function DnsEditor({ device, save }: { device: Device; save: (device: Device) => void }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  return <form className={styles.form} onSubmit={(e) => {
    e.preventDefault();
    const key = name.trim().toLowerCase();
    if (!validDnsName(key) || ipToInt(address) === null) return setError("Enter a valid host name and IPv4 address.");
    if (!Object.prototype.hasOwnProperty.call(device.records, key) && Object.keys(device.records).length >= 24) return setError("This server can hold 24 DNS records.");
    save({ ...device, records: { ...device.records, [key]: address.trim() } });
    setName(""); setAddress(""); setError("");
  }}>
    <h3>DNS records</h3>
    {Object.entries(device.records).map(([hostname, ip]) => <div key={hostname} className={styles.linkRow}>
      <span><b>{hostname}</b><small>{ip}</small></span>
      <button type="button" className={styles.iconButton} aria-label={"Remove DNS record " + hostname}
        onClick={() => save({ ...device, records: Object.fromEntries(Object.entries(device.records).filter(([key]) => key !== hostname)) })}><X size={15} /></button>
    </div>)}
    <label>Host name<input required value={name} maxLength={96} onChange={(e) => setName(e.target.value)} /></label>
    <label>IPv4 target<input required value={address} maxLength={15} onChange={(e) => setAddress(e.target.value)} /></label>
    {error && <p role="alert" className={styles.fieldError}>{error}</p>}
    <button type="submit" className={styles.primary}>Save DNS record</button>
  </form>;
}

function DeviceConsole({ device, project, commandResult }: { device: Device; project: Project; commandResult: Props["commandResult"] }) {
  const [session, setSession] = useState(newSession);
  const [lines, setLines] = useState<string[]>([]);
  const [input, setInput] = useState("");
  return <div className={styles.terminal}>
    <div className={styles.terminalHeader}><Terminal size={15} /> {device.name} terminal</div>
    <pre tabIndex={0}>{lines.length ? lines.join("\n") : "Enter ? to list commands."}</pre>
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!input.trim() || !device.powered) return;
      const result = runCommand(project, device, session, input);
      setLines([...lines, prompt(device, session) + " " + input, ...(result.output ? [result.output] : [])].slice(-80));
      setSession(result.session);
      setInput("");
      commandResult(result.project, result.events, result.output);
    }}>
      <span>{prompt(device, session)}</span>
      <input aria-label="Terminal command" value={input} disabled={!device.powered} maxLength={180} onChange={(e) => setInput(e.target.value)} placeholder={device.powered ? "Enter command" : "Device is off"} />
      <button type="submit" disabled={!device.powered || !input.trim()}>Run</button>
    </form>
  </div>;
}
