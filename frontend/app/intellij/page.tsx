import LabIdeSelector from "@/components/catalogue/LabIdeSelector";
import type { Metadata } from "next";
import { IntellijWorkspace } from "@/components/ide/intellij/IntellijWorkspace";

export const metadata: Metadata = {
  title: "IntelliJ IDEA — New UI Dark",
  description: "Interactive JetBrains IntelliJ IDEA New UI Dark replica with live Java execution, project explorer, and terminal.",
};

export default async function IntellijReplicaPage({ searchParams }: { searchParams: Promise<{ muLab?: string; ide?: string; assignment?: string; capture?: string }> }) {
  const context = await searchParams;
  if (context.capture === "report") return <IntellijWorkspace reportCapture />;
  return <><LabIdeSelector labId={context.muLab || ""} preferredIde={context.ide} assignment={context.assignment} /><IntellijWorkspace /></>;
}
