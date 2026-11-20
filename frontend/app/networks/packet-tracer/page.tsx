import type { Metadata } from "next";
import { PacketTracerStudio } from "@/components/netlab/PacketTracerStudio";

export const metadata: Metadata = {
  title: "Cisco Packet Tracer — LabMate",
  description: "Cisco Packet Tracer 8.2 network simulation workspace with Logical & Physical views, Cisco IOS CLI, VLANs, routing, and OSI packet inspection.",
};

export default async function PacketTracerStudioPage({ searchParams }: { searchParams: Promise<{ capture?: string; guided?: string; workspace?: string }> }) {
  const params = await searchParams;
  return <PacketTracerStudio capturePractical={params.capture === "practical"} />;
}
