import React from "react";
import { AndroidStudioWorkspace } from "@/components/ide/android-studio/AndroidStudioWorkspace";

export const metadata = {
  title: "Android Studio practice lab — LabMate",
  description:
    "Practice Android and Kotlin in the browser: edit layouts and Compose code, build, run in an emulator and read Logcat. A teaching simulation of Android Studio, not the real IDE.",
};

export default function AndroidStudioPage() {
  return <AndroidStudioWorkspace />;
}
