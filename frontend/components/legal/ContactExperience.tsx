"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Mail, Moon, Sun } from "lucide-react";
import LabMateLogo from "@/components/brand/LabMateLogo";
import { useDashboardTheme } from "@/components/dashboard/DashboardShell";
import { SUPPORT_EMAIL } from "./LegalPage";
import ContactForm from "./ContactForm";
import styles from "./contact.module.css";

export default function ContactExperience() {
  const { theme, toggleTheme } = useDashboardTheme();
  return (
    <div className={styles.page} data-theme={theme}>
      <header className={styles.header}>
        <Link href="/" aria-label="LabMate home"><LabMateLogo theme={theme} size="md" /></Link>
        <div className={styles.headerActions}>
          <button type="button" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className={styles.theme}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link href="/" className={styles.back}><ArrowLeft size={15} /> Back to home</Link>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.layout}>
          <aside className={styles.visual}>
            <Image src="/images/contact/team.jpg" alt="People collaborating on a coding project around a table" fill priority sizes="(max-width: 760px) 100vw, 48vw" className={styles.photo} />
            <div className={styles.overlay} />
            <div className={styles.visualCopy}>
              <span className={styles.eyebrow}>HERE FOR YOUR NEXT PRACTICAL</span>
              <h2>A little help.{" "}<br />A lot less{" "}<br /><em>busywork.</em></h2>
              <p>From your first upload to your finished lab record, we’re here to help you keep moving.</p>
              {SUPPORT_EMAIL && <a className={styles.email} href={`mailto:${SUPPORT_EMAIL}`}><Mail size={17} />{SUPPORT_EMAIL}</a>}
            </div>
            <a className={styles.credit} href="https://unsplash.com/photos/group-of-people-using-laptop-computer-QckxruozjRg" target="_blank" rel="noreferrer">Photography by Annie Spratt / Unsplash</a>
          </aside>
          <section className={styles.formPanel} aria-labelledby="contact-title">
            <span className={styles.eyebrow}>CONTACT LABMATE</span>
            <h1 id="contact-title">Let’s talk.</h1>
            <p className={styles.intro}>A question, a roadblock, or an idea? Tell us what’s on your mind.</p>
            <ContactForm />
            <p className={styles.response}>We usually reply within 2 working days.</p>
          </section>
        </div>
        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} LabMate</span>
          <div><Link href="/refund-policy">Payments &amp; refunds</Link><Link href="/privacy">Privacy policy</Link></div>
        </footer>
      </main>
    </div>
  );
}
