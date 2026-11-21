import type { Metadata } from "next";
import { PowerBiWorkspace } from "@/components/powerbi/PowerBiWorkspace";

export const metadata: Metadata = {
  title: "Power BI practice lab",
  description:
    "Practice building Power BI style reports from a CSV file: Power Query steps, DAX measures, visuals, slicers and screenshots. A teaching simulation, not Microsoft Power BI.",
};

export default function PowerBiReplicaPage() {
  return <PowerBiWorkspace />;
}
