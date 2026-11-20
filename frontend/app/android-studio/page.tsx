import React from "react";
import { AndroidStudioWorkspace } from "@/components/ide/android-studio/AndroidStudioWorkspace";

export const metadata = {
  title: "Android Studio — LabMate",
  description:
    "Interactive simplified Android Studio IDE for CE/IT practicals with isolated Java compilation, XML Layout Designer, Activity & Intent Runtime, Logcat, and Terminal.",
};

export default async function AndroidStudioPage({ searchParams }: { searchParams: Promise<{ capture?: string }> }) {
  return <AndroidStudioWorkspace capture={(await searchParams).capture === "practical"} />;
}
