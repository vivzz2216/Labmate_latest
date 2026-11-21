import LabIdeSelector from "@/components/catalogue/LabIdeSelector";
import type { Metadata } from "next";
import { EclipseWorkspace } from "@/components/ide/eclipse/EclipseWorkspace";

export const metadata: Metadata = {
  title: "Eclipse IDE",
  description:
    "Interactive Java Eclipse IDE replica with Package Explorer, JDT syntax highlighting, diagnostics, and live Java execution.",
};

export default async function EclipseIdePage({ searchParams }: { searchParams: Promise<{ muLab?: string; ide?: string; assignment?: string; capture?: string }> }) {
  const context = await searchParams;
  if (context.capture === "report") return <EclipseWorkspace reportCapture />;
  return <><LabIdeSelector labId={context.muLab || ""} preferredIde={context.ide} assignment={context.assignment} /><EclipseWorkspace /></>;
}
