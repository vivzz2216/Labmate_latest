"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Terminal,
  Sparkles,
} from "lucide-react";
import LabMateLogo from "@/components/brand/LabMateLogo";
import { useAuth } from "@/contexts/BasicAuthContext";
import styles from "./home.module.css";
import PricingSection from '@/components/billing/PricingSection';
import LabShowcase from '@/components/home/LabShowcase';
import StudentReviews from '@/components/home/StudentReviews';

const LoginModal = dynamic(() => import("@/components/auth/LoginModal"), {
  ssr: false,
});

const DarkVeil = dynamic(() => import("@/components/visual/DarkVeil"), {
  ssr: false,
});

const SpecularButton = dynamic(
  () => import("@/components/ui/SpecularButton"),
  { ssr: false }
);

export default function HomePage() {
  const { user, signOut } = useAuth();
  const isAuthenticated = Boolean(user);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [authDestination, setAuthDestination] = useState<"/dashboard" | "/code-execution">("/dashboard");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('login') === '1' && !user) setIsLoginOpen(true);
  }, [user]);

  const requireAccount = (event: React.MouseEvent<HTMLButtonElement>, destination: "/dashboard" | "/code-execution") => {
    if (isAuthenticated) return;
    event.preventDefault();
    setAuthDestination(destination);
    setIsLoginOpen(true);
  };

  return (
    <div className={styles.page}>
      {/* Ambient background glow */}
      <div className={styles.backgroundGlow} />

      {/* Sticky Runway-Style Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navContainer}>
          <div className="flex items-center gap-8">
            <Link href="/" aria-label="LabMate Home">
              <LabMateLogo size="md" theme="dark" />
            </Link>
            <div className={styles.navLinks}>
              <a href="#how-it-works" className={styles.navLink}>How It Works</a>
              <a href="#features" className={styles.navLink}>Features</a>
              <Link href="/labs" className={styles.navLink}>Lab Sections</Link>
              <a href="#labs" className={styles.navLink}>Labs &amp; templates</a>
              <a href="#reviews" className={styles.navLink}>Reviews</a>
              <a href="#pricing" className={styles.navLink}>Pricing</a>
              <Link href="/workspace" className={styles.navLink}>Workspace</Link>
            </div>
          </div>

          <div className={styles.navActions}>
            {isAuthenticated ? (
              <>
                <Link href="/workspace" className={styles.pillBtnPrimary}>
                  Workspace <ArrowRight size={14} />
                </Link>
                <button onClick={signOut} className={styles.loginTextLink}>
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setAuthDestination("/dashboard");
                    setIsLoginOpen(true);
                  }}
                  className={styles.loginTextLink}
                >
                  Log In
                </button>
                <SpecularButton
                  href="/dashboard"
                  onClick={(event) => requireAccount(event, "/dashboard")}
                  size="sm"
                  radius={9999}
                  tint="#ffffff"
                  tintOpacity={0.14}
                  textColor="#ffffff"
                  lineColor="#ffffff"
                  baseColor="#71717a"
                  intensity={1}
                  glow={0.8}
                >
                  Get Started <ArrowRight size={14} />
                </SpecularButton>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={styles.heroSection}
      >
        <h1 className={styles.heroHeading}>
          Building Autonomous <br />
          <span className={styles.heroSerifAccent}>Lab Intelligence.</span>
        </h1>

        <p className={styles.heroDescription}>
          Transform raw lab manuals into tested code, execution evidence, and formatted Word reports.
        </p>

        <div className={styles.metricHighlights}>
          <div className={styles.metricItem}>
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>Automatic Question Parsing</span>
          </div>
          <span className={styles.metricDot}>•</span>
          <div className={styles.metricItem}>
            <Terminal size={13} className="text-sky-400" />
            <span>Real 1080p Terminal Screenshots</span>
          </div>
          <span className={styles.metricDot}>•</span>
          <div className={styles.metricItem}>
            <FileText size={13} className="text-indigo-400" />
            <span>Submission-Ready Word &amp; PDF</span>
          </div>
          <span className={styles.metricDot}>•</span>
          <div className={styles.metricItem}>
            <Sparkles size={13} className="text-amber-400" />
            <span>Python, C/C++, Java &amp; Web</span>
          </div>
        </div>
      </motion.header>

      {/* LabMate workflow showcase */}
      <section className={styles.heroMediaSection}>
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className={styles.heroMediaCard}
        >
          <div className={styles.heroMediaCanvas}>
            <Image
              src="/images/hero-section.png"
              alt="LabMate workflow: upload, code execution, terminal evidence, and completed report"
              fill
              sizes="(max-width: 1280px) 100vw, 1280px"
              className={styles.heroCoverImage}
              priority
            />
          </div>
        </motion.div>
      </section>

      {/* ========================================================
          SUPPORTED LANGUAGES & RUNTIMES TICKER
          ======================================================== */}
      <section id="runtimes" className={styles.langTickerSection}>
        <div className={styles.langTickerTitle}>
          Supported programming languages, runtimes &amp; laboratory tools:
        </div>
        <div className={styles.langTickerRow}>
          {/* Python */}
          <div className={styles.langItem} title="Python 3 Runtime">
            <svg width="22" height="22" viewBox="0 0 256 255" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M126.916.072c-64.832 0-60.784 28.115-60.784 28.115l.072 29.128h61.868v8.745H41.631S.145 61.355.145 126.77c0 65.417 36.21 63.097 36.21 63.097h21.61v-30.356s-1.165-36.21 35.632-36.21h61.362s34.475-.58 34.475-33.886V28.187S194.887.072 126.916.072zM92.802 19.66a11.12 11.12 0 0 1 11.13 11.13 11.12 11.12 0 0 1-11.13 11.13 11.12 11.12 0 0 1-11.13-11.13 11.12 11.12 0 0 1 11.13-11.13z" fill="#387EB8"/>
              <path d="M128.757 254.126c64.832 0 60.784-28.115 60.784-28.115l-.072-29.127H127.6v-8.745h86.441s41.486 4.705 41.486-60.71c0-65.416-36.21-63.098-36.21-63.098h-21.61v30.356s1.165 36.21-35.632 36.21h-61.362s-34.475.58-34.475 33.886v61.233s-5.459 28.12 62.519 28.12zm34.114-19.587a11.12 11.12 0 0 1-11.13-11.13 11.12 11.12 0 0 1 11.13-11.13 11.12 11.12 0 0 1 11.13 11.13 11.12 11.12 0 0 1-11.13 11.13z" fill="#FFE052"/>
            </svg>
            <span>Python</span>
          </div>

          {/* Java */}
          <div className={styles.langItem} title="Java OpenJDK">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8.86 19.06c2.46.23 6.37.23 8.78-.34.22-.05.41.13.34.35-.41 1.25-2.73 2.1-5.71 2.1-3.23 0-5.74-.98-5.83-2.31 0-.15.13-.25.28-.24.71.13 1.47.24 2.14.44z" fill="#E76F00"/>
              <path d="M7.74 16.5c3.08.31 7.97.23 10.98-.48.24-.06.44.15.35.38-.6 1.58-3.56 2.62-7.44 2.62-4.14 0-7.36-1.22-7.49-2.88 0-.19.16-.32.35-.31.95.17 2.14.36 3.25.67z" fill="#E76F00"/>
              <path d="M13.62 10.22c1.23 1.43-.32 2.76-1.85 3.86-1.34.97-2.78 1.83-4.13 2.8-.39.28-.06.75.34.61 2.22-.76 4.41-1.63 6.37-2.85 2.53-1.57 3.52-3.4 1.76-5.44-1.23-1.42-2.14-2.86-.49-4.88.24-.29-.02-.68-.37-.53-2.45 1.05-3.32 3.65-1.63 6.43z" fill="#5382A1"/>
              <path d="M18.88 14.97c1.37-.87 2.12-2.02 2.12-3.32 0-.3-.04-.6-.11-.89-.08-.34-.48-.42-.68-.16-.62.82-1.5 1.4-2.52 1.76-.2.07-.27.32-.13.48.38.45.89.84 1.32 1.13.25.17.47.38.64.63.15.22.42.23.57.04z" fill="#5382A1"/>
            </svg>
            <span>Java</span>
          </div>

          {/* C / C++ */}
          <div className={styles.langItem} title="C / C++ GCC & G++ Toolchain">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 6.5v11L12 22l10-4.5v-11L12 2zm0 2.2l7.8 3.5L12 11.2 4.2 7.7 12 4.2zm-8 4.7l7 3.2v7.7l-7-3.2V8.9zm9 10.9v-7.7l7-3.2v7.7l-7 3.2z" fill="#00599C"/>
              <path d="M12.5 10.5h1v1.3h1.3v1h-1.3v1.3h-1v-1.3h-1.3v-1h1.3v-1.3zm3.5 0h1v1.3h1.3v1H17v1.3h-1v-1.3h-1.3v-1H16v-1.3z" fill="#ffffff"/>
            </svg>
            <span>C / C++</span>
          </div>

          {/* WebDev */}
          <div className={styles.langItem} title="HTML5, CSS3, JavaScript & TypeScript">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="20" height="20" rx="4" fill="#F7DF1E"/>
              <path d="M7 16.5c.5.8 1.4 1.3 2.4 1.3 1.3 0 2.1-.8 2.1-2.4v-6.2H9.8v6.2c0 .6-.3.9-.8.9-.4 0-.7-.3-.9-.6l-1.1.8zm6.5 1.3c1.5 0 2.4-.7 2.8-1.5l-1.4-.8c-.3.5-.7.8-1.4.8-.8 0-1.4-.4-1.4-1.1 0-.8.6-1.1 1.7-1.4 1.6-.4 2.7-1 2.7-2.4 0-1.4-1.1-2.3-2.6-2.3-1.4 0-2.3.6-2.8 1.6l1.3.8c.3-.5.7-.9 1.4-.9.7 0 1.2.4 1.2.9 0 .6-.5.9-1.4 1.2-1.7.5-2.9 1-2.9 2.5 0 1.6 1.2 2.6 2.7 2.6z" fill="#000000"/>
            </svg>
            <span>WebDev</span>
          </div>

          {/* Execution runner */}
          <div className={styles.langItem} title="Code Execution Runner">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="4" width="20" height="16" rx="3" stroke="#2496ED" strokeWidth="1.7"/>
              <path d="m6 9 3 3-3 3m6 0h6" stroke="#2496ED" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Code Runner</span>
          </div>

          {/* Word DOCX */}
          <div className={styles.langItem} title="Word (.docx) Report Generator">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#2B579A"/>
              <path d="M14 2v6h6" fill="#1B3A6B"/>
              <path d="M8 12.5l1.2 5.5 1.5-4 1.5 4 1.2-5.5h-1l-.8 4.2-1.4-4.2h-.9l-1.4 4.2-.8-4.2H8z" fill="#ffffff"/>
            </svg>
            <span>Word DOCX</span>
          </div>

          {/* Google Drive */}
          <div className={styles.langItem} title="Google Drive Integration">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8.2 3.8L2.5 13.8l3.8 6.5 5.7-9.9L8.2 3.8z" fill="#0066DA"/>
              <path d="M15.8 3.8H8.2l3.8 6.6 5.8 10L21.5 14 15.8 3.8z" fill="#00AC47"/>
              <path d="M6.3 20.3h11.5l3.8-6.5H10.1L6.3 20.3z" fill="#EA4335"/>
              <path d="M15.8 3.8h-7.6L12 10.4l3.8-6.6z" fill="#FFBA00"/>
            </svg>
            <span>Google Drive</span>
          </div>

        </div>
      </section>

      {/* The student's two-step workflow */}
      <section id="how-it-works" aria-labelledby="workflow-heading" className={styles.workflowSection}>
        <div className={styles.workflowHeader}>
          <h2 id="workflow-heading" className={styles.workflowHeading}>
            Your lab manual.<br />Your finished Word record.
            <span>Just 2 steps.</span>
          </h2>
          <p className={styles.workflowIntro}>
            Upload your manual, start execution, and download the result. LabMate handles everything in between.
          </p>
        </div>
        <ol className={styles.workflowSteps}>
          <li className={styles.workflowStep}>
            <span className={styles.stepNumber} aria-hidden="true">01</span>
            <div className={styles.stepContent}>
              <h3>Upload your lab manual</h3>
              <p>Choose your PDF or Word (.docx) file. LabMate reads the manual and extracts the programming questions for you.</p>
              <div className={styles.fileFormats} aria-label="Accepted manual formats">
                <FileText size={15} aria-hidden="true" />
                <span>PDF</span><span className={styles.formatDivider} aria-hidden="true" /><span>Word (.docx)</span>
              </div>
              <SpecularButton
                href="/code-execution"
                onClick={(event) => requireAccount(event, "/code-execution")}
                size="sm"
                radius={9999}
                tint="#ffffff"
                tintOpacity={0.14}
                textColor="#ffffff"
                lineColor="#38bdf8"
                baseColor="#0284c7"
                intensity={1.1}
                glow={1}
              >
                Upload a manual <ArrowRight size={16} aria-hidden="true" />
              </SpecularButton>
            </div>
          </li>
          <li className={styles.workflowStep}>
            <span className={styles.stepNumber} aria-hidden="true">02</span>
            <div className={styles.stepContent}>
              <h3>Execute &amp; download your Word report</h3>
              <p>
                Click <strong>Start processing</strong> to begin execution. LabMate generates the code, runs it, captures the output screenshots, and puts everything into your report.
              </p>
              <p className={styles.downloadNote}>
                When it finishes, click <strong>Download Word Report (.docx)</strong>. Your completed lab record is ready.
              </p>
            </div>
          </li>
        </ol>
        <div id="features" className={styles.automationNote}>
          <CheckCircle2 size={24} aria-hidden="true" />
          <div>
            <h3>Code, execution, screenshots, and the Word file—all automatic.</h3>
            <p>No copying code from ChatGPT, running it in an IDE, taking screenshots, or pasting them into Word yourself. Upload, execute, download.</p>
          </div>
        </div>
      </section>

      <LabShowcase />
      <StudentReviews />

      <PricingSection />

      {/* ========================================================
          CALL TO ACTION
          ======================================================== */}
      <section className={styles.ctaSection} aria-labelledby="cta-heading">
        <div className={styles.ctaCard}>
          <div className={styles.ctaVeilWrap} aria-hidden="true">
            <DarkVeil hueShift={125} speed={0.4} noiseIntensity={0.02} scanlineIntensity={0.08} scanlineFrequency={0.003} warpAmount={0.06} />
            <div className={styles.ctaVeilOverlay} />
          </div>
          <div className={styles.ctaContent}>
            <h2 id="cta-heading" className={styles.ctaHeading}>Ready to finish your lab record?</h2>
            <p className={styles.ctaDescription}>
              Upload your manual, run real execution in isolated sandboxes, and download your finished Word report with code and captured screenshots.
            </p>
            <div className={styles.ctaActions}>
              <Link href="/code-execution" className={styles.ctaPrimaryBtn}>
                Upload a manual <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/workspace" className={styles.ctaSecondaryBtn}>
                Go to workspace
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Clean Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          <div className={styles.footerBrandCol}>
            <LabMateLogo size="md" theme="dark" />
            <p className="text-xs text-zinc-500 leading-relaxed max-w-sm">
              The automated lab manual intelligence tool for engineering students.
              Turn any raw manual into complete code, real terminal screenshots, and submission-ready reports.
            </p>
          </div>

          <div>
            <div className={styles.footerColTitle}>Product</div>
            <ul className={styles.footerNavList}>
              <li><Link href="/labs" className={styles.footerLink}>All Lab Sections</Link></li>
              <li><Link href="/workspace" className={styles.footerLink}>Student Workspace</Link></li>
              <li><Link href="/dashboard" className={styles.footerLink}>Lab Studio IDE</Link></li>
              <li><Link href="/reports" className={styles.footerLink}>Download Reports</Link></li>
            </ul>
          </div>

          <div>
            <div className={styles.footerColTitle}>Capabilities</div>
            <ul className={styles.footerNavList}>
              <li><a href="#how-it-works" className={styles.footerLink}>Question Parser</a></li>
              <li><a href="#how-it-works" className={styles.footerLink}>Code Runner</a></li>
              <li><a href="#features" className={styles.footerLink}>Terminal Screenshots</a></li>
              <li><a href="#how-it-works" className={styles.footerLink}>Word (.docx) Export</a></li>
            </ul>
          </div>

          <div>
            <div className={styles.footerColTitle}>Supported Runtimes</div>
            <ul className={styles.footerNavList}>
              <li><Link href="/labs/deep-learning" className={styles.footerLink}>Deep Learning (PyTorch/TF)</Link></li>
              <li><Link href="/labs/distributed-computing" className={styles.footerLink}>Distributed Computing (Java)</Link></li>
              <li><a href="#runtimes" className={styles.footerLink}>Python 3 &amp; Colab</a></li>
              <li><a href="#runtimes" className={styles.footerLink}>Java OpenJDK &amp; C/C++</a></li>
              <li><a href="#runtimes" className={styles.footerLink}>HTML5 &amp; WebDev</a></li>
            </ul>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <div>© {new Date().getFullYear()} LabMate AI. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <span className="hover:text-zinc-400 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-zinc-400 cursor-pointer">Terms of Service</span>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      {isLoginOpen && (
        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          redirectTo={authDestination}
        />
      )}
    </div>
  );
}
