import type { Metadata } from "next";
import { MysqlCliWorkspace } from "@/components/ide/mysql-cli/MysqlCliWorkspace";

export const metadata: Metadata = {
  title: "MySQL 8.0 Command Line Client - Unicode",
  description:
    "Interactive Windows MySQL 8.0 Command Line Client replica with preloaded SQL lab databases.",
};

export default function MysqlCliPage() {
  return <MysqlCliWorkspace />;
}
