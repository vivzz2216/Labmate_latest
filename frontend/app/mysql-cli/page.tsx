import LabIdeSelector from "@/components/catalogue/LabIdeSelector";
import type { Metadata } from "next";
import { MysqlCliWorkspace } from "@/components/ide/mysql-cli/MysqlCliWorkspace";

export const metadata: Metadata = {
  title: "MySQL 8.0 Command Line Client - Unicode",
  description:
    "Interactive Windows MySQL 8.0 Command Line Client replica with preloaded SQL lab databases.",
};

export default async function MysqlCliPage({ searchParams }: { searchParams: Promise<{ muLab?: string; ide?: string; assignment?: string }> }) {
  const context = await searchParams;
  return <><LabIdeSelector labId={context.muLab || ""} preferredIde={context.ide} assignment={context.assignment} /><MysqlCliWorkspace /></>;
}
