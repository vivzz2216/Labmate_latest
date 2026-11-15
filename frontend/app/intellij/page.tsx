import type { Metadata } from "next";
import { IntellijWorkspace } from "@/components/ide/intellij/IntellijWorkspace";

export const metadata: Metadata = {
  title: "IntelliJ IDEA — New UI Dark",
  description: "Interactive JetBrains IntelliJ IDEA New UI Dark replica with live Java execution, project explorer, and terminal.",
};

export default function IntellijReplicaPage() {
  return <IntellijWorkspace />;
}
