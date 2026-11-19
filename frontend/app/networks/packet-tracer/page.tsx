import type { Metadata } from "next";
import { PacketTracerStudio } from "@/components/netlab/PacketTracerStudio";

export const metadata: Metadata = {
  title: "Cisco Packet Tracer",
  description: "Cisco Packet Tracer network workspace with real-time topology layout, device CLI, and packet simulation.",
};

export default function PacketTracerStudioPage() {
  return <PacketTracerStudio />;
}
