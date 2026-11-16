import React from "react";
import { AndroidStudioWorkspace } from "@/components/ide/android-studio/AndroidStudioWorkspace";

export const metadata = {
  title: "Android Studio Ladybug | New UI Dark Clone — LabMate",
  description:
    "Interactive 100% pixel-faithful Google Android Studio (Ladybug / Meerkat New UI Dark) clone with Jetpack Compose @Preview, XML Layout Designer, Logcat, Gradle, and Running Devices Android Emulator.",
};

export default function AndroidStudioPage() {
  return <AndroidStudioWorkspace />;
}
