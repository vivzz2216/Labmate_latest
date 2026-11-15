import type { Metadata } from "next";
import { DbBrowserWorkspace } from "@/components/ide/db-browser/DbBrowserWorkspace";

export const metadata: Metadata = {
  title: "DB Browser for SQLite",
  description:
    "Interactive DB Browser for SQLite database workbench with Northwind schema, SQL query execution, data browsing, and PRAGMA editing.",
};

export default function DbBrowserPage() {
  return <DbBrowserWorkspace />;
}
