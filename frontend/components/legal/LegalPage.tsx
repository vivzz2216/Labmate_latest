import Link from "next/link";
import type { ReactNode } from "react";
import LabMateLogo from "@/components/brand/LabMateLogo";

/** Public support address. Set NEXT_PUBLIC_SUPPORT_EMAIL on the frontend service; it is read at build time. */
export const SUPPORT_EMAIL = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "").trim();
export const BUSINESS_NAME = "LabMate";
export const POLICY_UPDATED = "18 November 2026";

export function SupportContact() {
  return SUPPORT_EMAIL ? (
    <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
  ) : (
    <Link href="/contact">our contact page</Link>
  );
}

const LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/contact", label: "Contact" },
];

export default function LegalPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-zinc-600">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" aria-label="LabMate home">
            <LabMateLogo size="md" theme="light" />
          </Link>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl" style={{ fontFamily: "var(--font-heading)" }}>
          {title}
        </h1>
        <p className="mb-8 text-sm text-zinc-500">Last updated: {POLICY_UPDATED}</p>
        {intro && <div className="mb-10 text-base leading-7 text-zinc-600">{intro}</div>}
        <div className="space-y-10 text-[15px] leading-7 [&_a]:text-indigo-600 [&_a]:underline [&_a:hover]:text-indigo-500 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-950 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_p+p]:mt-3 [&_ul+p]:mt-4[&_strong]:text-zinc-950 [&_ul]:mt-3 [&_ul]:space-y-2">
          {children}
        </div>
      </main>

      <footer className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>© {new Date().getFullYear()} {BUSINESS_NAME}. All rights reserved.</div>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-zinc-900">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
