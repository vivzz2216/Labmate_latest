import type { Metadata } from "next";
import "../styles/globals.css";
import { AuthProvider } from "@/contexts/BasicAuthContext";

export const metadata: Metadata = {
  title: {
    default: "LabMate | Lab assignments, code, and reports",
    template: "%s | LabMate",
  },
  description:
    "Upload lab manuals, work through programming questions, run code, and prepare downloadable reports in one workspace.",
  applicationName: "LabMate",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
