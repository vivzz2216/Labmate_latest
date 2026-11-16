import LabIdeSelector from "@/components/catalogue/LabIdeSelector";
import type { Metadata } from "next";
import { DbBrowserWorkspace } from "@/components/ide/db-browser/DbBrowserWorkspace";

export const metadata: Metadata = {
  title: "DB Browser for SQLite",
  description:
    "Interactive DB Browser for SQLite database workbench with Northwind schema, SQL query execution, data browsing, and PRAGMA editing.",
};

export default async function DbBrowserPage({ searchParams }: { searchParams: Promise<{ muLab?: string; ide?: string; assignment?: string }> }) {
  const context = await searchParams;
  return <><LabIdeSelector labId={context.muLab || ""} preferredIde={context.ide} assignment={context.assignment} /><DbBrowserWorkspace /></>;
}
