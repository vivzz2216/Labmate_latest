import type { Metadata } from "next";
import { PowerBiWorkspace } from "@/components/powerbi/PowerBiWorkspace";

export const metadata: Metadata = {
  title: "Power BI Desktop Studio",
  description:
    "Interactive Power BI Desktop report-authoring replica for CSV dataset exploration and manual screenshots.",
};

export default async function PowerBiReplicaPage({ searchParams }: { searchParams: Promise<{ capture?: string }> }) {
  return <PowerBiWorkspace capture={(await searchParams).capture === "practical"} />;
}
