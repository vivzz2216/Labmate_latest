import type { Metadata } from "next";
import { PowerBiWorkspace } from "@/components/powerbi/PowerBiWorkspace";

export const metadata: Metadata = {
  title: "Power BI Desktop Studio",
  description:
    "Interactive Power BI Desktop report-authoring replica for CSV dataset exploration and manual screenshots.",
};

export default function PowerBiReplicaPage() {
  return <PowerBiWorkspace />;
}
