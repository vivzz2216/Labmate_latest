import type { Metadata } from "next";
import { WiresharkStudio } from "@/components/netlab/WiresharkStudio";

export const metadata: Metadata = {
  title: "Wireshark",
  description: "Wireshark network packet analyzer: open packet captures, inspect frame protocols, apply display filters, and follow TCP streams.",
};

export default function WiresharkStudioPage() {
  return <WiresharkStudio />;
}
