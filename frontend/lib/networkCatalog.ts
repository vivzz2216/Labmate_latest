import type { LabCategory, LabExperiment, LabPart } from "./labCatalog";

// Computer Networks lab: the experiments are built in LabMate's own practice studios (a packet analyser and a network simulator).
// The packets, tables and event lists come from LabMate's engines (backend/app/netlab); the screenshots are taken automatically in
// those studios and carry a visible "LabMate practice environment" label. A student may attach a capture saved from the real Wireshark.

const experiment = (
  number: number,
  title: string,
  aim: string,
  category: string,
  frameworks: string[],
  description: string,
  expectedOutputs: string[],
  parts: LabPart[],
  workspaces: { label: string; href: string }[],
): LabExperiment => ({
  id: `net-${number}`,
  number,
  title,
  aim,
  category,
  difficulty: "Intermediate",
  frameworks,
  runtime: "theory",
  track: "networks",
  description,
  expectedOutputs,
  starterPrompt: parts.map((part) => part.text).join("\n\n"),
  parts,
  workspaces,
});

const pt = (title: string, text: string, experimentId: string): LabPart => ({
  kind: "evidence",
  title,
  text,
  studio: "packettracer",
  studioArgs: { experiment: experimentId },
});

export const NETWORKS_CATEGORY: LabCategory = {
  slug: "computer-networks",
  track: "networks",
  title: "Computer Networks Labs",
  shortTitle: "Computer Networks",
  tagline: "Packet analysis with a Wireshark-style analyser; hubs, switches and routing with a Packet Tracer-style simulator",
  description:
    "Computer Networks practicals built in LabMate's own practice studios. The packets, tables, ARP and ICMP event lists and routing tables are computed by LabMate's engines, so every explanation in the report agrees with its screenshots. The studios are simplified models, labelled as such in every screenshot; they are not Wireshark or Cisco Packet Tracer.",
  defaultLanguage: "theory",
  badge: "New",
  accentColor: "#2563eb",
  features: [
    "Packet analyser: decodes real capture bytes, display filters, packet details, hex view and Follow TCP Stream",
    "Upload the .pcap or .pcapng you saved from Wireshark, or use a built-in practice capture",
    "Network simulator: hub flooding, switch learning, ARP, ICMP, routers, RIP routing and link failure",
    "Screenshots, explanations and answer tables generated together and placed in your Word report",
  ],
  environmentSpecs: [
    { label: "Engine", value: "LabMate packet decoder and network simulator (Python)" },
    { label: "Studios", value: "/networks/wireshark and /networks/packet-tracer" },
    { label: "Capture files", value: "Ethernet .pcap and .pcapng, up to 8 MB" },
    { label: "Export Format", value: "Automatic screenshots + DOCX report" },
  ],
  experiments: [
    experiment(
      5,
      "Introduction to Wireshark and Traffic Analysis",
      "Capture and analyse ARP, DNS, ICMP, TCP and HTTP traffic, inspect packet headers and sniff a password sent over an insecure login page.",
      "Packet analysis",
      ["Packet analyser", "pcap / pcapng"],
      "Screenshots of the analyser, display filters, Ethernet and ARP details, the insecure login page, the HTTP form post and the TCP stream, with the Ethernet and ARP answer tables read from the packet bytes.",
      ["Eight screenshots with explanations", "Ethernet frame table (8 answers)", "ARP frame table (11 answers)"],
      [
        {
          kind: "evidence",
          title: "Introduction to Wireshark and traffic analysis",
          text: "Capture and analyse ARP, ICMP, DNS, TCP and HTTP traffic with Wireshark, attach each screenshot the manual lists with a brief explanation, and answer the post-experimental questions about the Ethernet and ARP frames.",
          studio: "wireshark",
          evidenceSlots: [{ id: "wireshark_pcap", label: "Your Wireshark capture (.pcap or .pcapng) - optional" }],
        },
      ],
      [{ label: "Open the packet analyser", href: "/networks/wireshark" }],
    ),
    experiment(
      7,
      "Hub and Switch in a Network Simulator",
      "Observe how a hub and a switch process ARP and ICMP packets in star and bus topologies, and build a mesh.",
      "Network simulation",
      ["Network simulator", "ARP", "ICMP"],
      "Three scenarios (star with a hub, star with a switch, bus of hubs) and a mesh exercise, each with the Simulation-mode event list and a written comment on how the devices behaved.",
      ["Topology and event-list screenshots per scenario", "Comments on ARP and switch behaviour", "Mesh topology"],
      [
        pt("Scenario 1: Star topology using a hub", "Implement Scenario 1 (star topology using a hub) and comment on the ARP packets in the Simulation-mode event list.", "exp7-1"),
        pt("Scenario 2: Star topology using a switch", "Implement Scenario 2 (star topology using a switch) and observe how the switch processes ICMP and ARP packets.", "exp7-2"),
        pt("Scenario 3: Bus topology using a hub", "Implement Scenario 3 (bus topology using hubs) and observe how the hubs process ICMP and ARP packets.", "exp7-3"),
        pt("Post-experimental exercise: Mesh topology", "Implement a mesh topology using a hub and switches.", "exp7-mesh"),
      ],
      [{ label: "Open the network simulator", href: "/networks/packet-tracer" }],
    ),
    experiment(
      9,
      "Three Routers with RIP Dynamic Routing",
      "Design a network of three routers, configure interfaces and RIP, test with Simple PDUs and show the path chosen when a router link is disabled.",
      "Routing",
      ["Network simulator", "RIP", "Routing tables"],
      "Router and host addressing tables, the routing table of each router, successful Simple PDUs between networks, and the path taken after one router-to-router link is disabled.",
      ["Configuration tables", "Routing tables after RIP converges", "Path before and after the link failure"],
      [pt("Three routers with RIP dynamic routing", "Design a network of three routers, configure the interfaces and RIP dynamic routing, test with Simple PDUs, then disable one router-to-router link and show the path the network chooses.", "exp9")],
      [{ label: "Open the network simulator", href: "/networks/packet-tracer" }],
    ),
  ],
};
