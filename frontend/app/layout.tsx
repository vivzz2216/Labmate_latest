import type { Metadata } from "next";
import "../styles/globals.css";
import { AuthProvider } from "@/contexts/BasicAuthContext";
import ProfileGate from '@/components/auth/ProfileGate';
import AdmissionGate from '@/components/auth/AdmissionGate';

export const metadata: Metadata = {
  title: {
    default: "LabMate | Lab assignments, code, and reports",
    template: "%s | LabMate",
  },
  description:
    "Upload lab manuals, work through programming questions, run code, and prepare downloadable reports in one workspace.",
  applicationName: "LabMate",
  icons: {
    icon: [
      { url: "/images/labmate-mark-black.png", media: "(prefers-color-scheme: light)" },
      { url: "/images/labmate-mark-white.png", media: "(prefers-color-scheme: dark)" },
      { url: "/favicon.ico" },
    ],
    apple: "/images/labmate-mark-black.png",
    shortcut: "/images/labmate-mark-black.png",
  },
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
        <AuthProvider><AdmissionGate><ProfileGate>{children}</ProfileGate></AdmissionGate></AuthProvider>
      </body>
    </html>
  );
}
