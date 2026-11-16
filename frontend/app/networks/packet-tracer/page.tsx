import type { Metadata } from "next";
import { PacketTracerStudio } from "@/components/netlab/PacketTracerStudio";

export const metadata: Metadata = {
  title: "Network Simulator Studio",
  description: "LabMate practice network simulator: hubs, switches, ARP, ICMP, routers and RIP with a Simulation-mode event list.",
};

export default function PacketTracerStudioPage() {
  return <PacketTracerStudio />;
}
