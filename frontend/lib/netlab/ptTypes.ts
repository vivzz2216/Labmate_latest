export type DeviceKind =
  | "pc"
  | "laptop"
  | "server"
  | "printer"
  | "ipphone"
  | "tablet"
  | "smartphone"
  | "router"
  | "switch"
  | "hub"
  | "wireless"
  | "security"
  | "cloud";

export type CableType =
  | "auto"
  | "console"
  | "straight"
  | "cross"
  | "fiber"
  | "phone"
  | "coaxial"
  | "serial-dce"
  | "serial-dte";

export interface PortConfig {
  name: string;
  ip: string;
  mask: string;
  shutdown?: boolean;
  bandwidth?: string;
  mac?: string;
}

export interface ServerServices {
  httpEnabled: boolean;
  httpHtml: string;
  dhcpEnabled: boolean;
  dhcpPoolName: string;
  dhcpGateway: string;
  dhcpDns: string;
  dhcpStartIp: string;
  dhcpMask: string;
  dhcpMaxUsers: number;
  dnsEnabled: boolean;
  dnsRecords: { name: string; address: string }[];
}

export interface PtDevice {
  type: "pc" | "hub" | "switch" | "router" | DeviceKind;
  model?: string;
  name: string;
  hostname?: string;
  x: number;
  y: number;
  power?: boolean;
  ip?: string;
  mask?: string;
  gateway?: string;
  dns?: string;
  dhcp?: boolean;
  interfaces?: Record<string, { ip: string; mask: string; shutdown?: boolean; mac?: string }>;
  rip?: string[];
  staticRoutes?: { network: string; mask: string; nextHop: string }[];
  services?: ServerServices;
}

export interface PtCable {
  a: string;
  ap: string;
  b: string;
  bp: string;
  cable?: CableType;
}

export interface PtNote {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface PtShape {
  id: string;
  kind: "rect" | "ellipse" | "line";
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  stroke: string;
}

export interface PtSpec {
  name: string;
  devices: PtDevice[];
  links: PtCable[];
  notes?: PtNote[];
  shapes?: PtShape[];
  backgroundTint?: string;
}

export interface PtEvent {
  time: number;
  pdu: number;
  last: string;
  at: string;
  type: string;
  info: string;
  action: string;
}

export interface PtPduRow {
  pdu: number;
  source: string;
  destination: string;
  status: string;
  type?: string;
}

export interface PtRouteRow {
  code: string;
  network: string;
  interface: string;
  next_hop: string;
  metric: number;
  distance: number;
}

export interface DeviceModelMeta {
  model: string;
  label: string;
  kind: DeviceKind;
  defaultPorts: string[];
  hasCli: boolean;
  mdiX: boolean; // true = switch/hub (MDI-X), false = router/pc/server (MDI)
}
