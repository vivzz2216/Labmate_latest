import type { Metadata } from "next";
import { WiresharkStudio } from "@/components/netlab/WiresharkStudio";

export const metadata: Metadata = {
  title: "Packet Analyzer Studio",
  description: "LabMate practice packet analyser: open a capture, apply display filters, read headers and follow TCP streams.",
};

export default function WiresharkStudioPage() {
  return <WiresharkStudio />;
}
