"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  FileText,
  Moon,
  Sparkles,
  Sun,
  Terminal,
} from "lucide-react";
import LabMateLogo from "@/components/brand/LabMateLogo";
import { useDashboardTheme } from "@/components/dashboard/DashboardShell";
import { useAuth } from "@/contexts/BasicAuthContext";
import styles from "./home.module.css";
import PricingSection from '@/components/billing/PricingSection';
import LabShowcase from '@/components/home/LabShowcase';
import StudentReviews from '@/components/home/StudentReviews';
import RuntimeLogos from '@/components/home/RuntimeLogos';

const LoginModal = dynamic(() => import("@/components/auth/LoginModal"), {
  ssr: false,
});

export default function HomePage() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useDashboardTheme();
  const isAuthenticated = Boolean(user);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [authDestination, setAuthDestination] = useState<"/dashboard" | "/code-execution">("/dashboard");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('login') === '1' && !user) setIsLoginOpen(true);
  }, [user]);

  const requireAccount = (event: React.MouseEvent<HTMLElement>, destination: "/dashboard" | "/code-execution") => {
    if (isAuthenticated) return;
    event.preventDefault();
    setAuthDestination(destination);
    setIsLoginOpen(true);
  };

  return (
    <div className={styles.page} data-theme={theme}>
      {/* Sticky Runway-Style Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navContainer}>
          <div className="flex items-center gap-8">
            <Link href="/" aria-label="LabMate Home">
              <LabMateLogo size="md" theme={theme} />
            </Link>
            <div className={styles.navLinks}>
              <a href="#how-it-works" className={styles.navLink}>How it works</a>
              <Link href="/labs" className={styles.navLink}>Lab catalogue</Link>
              <a href="#labs" className={styles.navLink}>Screenshot styles</a>
              <a href="#pricing" className={styles.navLink}>Pricing</a>
            </div>
          </div>

          <div className={styles.navActions}>
            <button
              type="button"
              onClick={toggleTheme}
              className={styles.themeBtn}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
            </button>
            {isAuthenticated ? (
              <>
                <Link href="/workspace" className={styles.pillBtnPrimary}>
                  Workspace
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
                <Link href="/dashboard" onClick={(event) => requireAccount(event, "/dashboard")} className={styles.pillBtnPrimary}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section: rendered visible on the server. It used to start at opacity 0 and appear only once
          JavaScript had loaded, so slow phones showed a blank screen first. */}
      <motion.header
        initial={{ y: 12 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={styles.heroSection}
      >
        <h1 className={styles.heroHeading}>
          Upload your lab manual. <br />
          <span className={styles.heroSerifAccent}>Get the finished record.</span>
        </h1>

        <p className={styles.heroDescription}>
          LabMate turns your lab manual into tested code, real execution screenshots, and a formatted Word report.
        </p>

        <div className={styles.heroCtas}>
          <Link
            href="/code-execution"
            onClick={(event) => requireAccount(event, "/code-execution")}
            className={styles.ctaPrimaryBtn}
          >
            Upload a manual
          </Link>
          <Link href="/labs" className={styles.ctaSecondaryBtn}>
            See lab sections
          </Link>
        </div>
        <p className={styles.heroTrialNote}>100 experiments free. No card needed.</p>

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
          initial={{ scale: 0.98 }}
          animate={{ scale: 1 }}
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

      <RuntimeLogos />

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
              <Link href="/code-execution" onClick={(event) => requireAccount(event, "/code-execution")} className={styles.pillBtnPrimary}>
                Upload a manual
              </Link>
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
            <p>No switching between an AI chat, an IDE, a screenshot tool, and Word. LabMate runs the code for real and records the actual output, so you can check every result before you submit.</p>
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
            <div className={styles.ctaVeilOverlay} />
          </div>
          <div className={styles.ctaContent}>
            <h2 id="cta-heading" className={styles.ctaHeading}>Ready to finish your lab record?</h2>
            <p className={styles.ctaDescription}>
              Upload your manual, run real execution in isolated sandboxes, and download your finished Word report with code and captured screenshots.
            </p>
            <div className={styles.ctaActions}>
              <Link href="/code-execution" className={styles.ctaPrimaryBtn}>
                Upload a manual
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
            <LabMateLogo size="md" theme={theme} />
            <p className={styles.footerTagline}>
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
            <div className={styles.footerColTitle}>Explore</div>
            <ul className={styles.footerNavList}>
              <li><a href="#how-it-works" className={styles.footerLink}>How it works</a></li>
              <li><a href="#labs" className={styles.footerLink}>Screenshot styles</a></li>
              <li><a href="#pricing" className={styles.footerLink}>Pricing</a></li>
              <li><Link href="/contact" className={styles.footerLink}>Contact</Link></li>
            </ul>
          </div>

          <div>
            <div className={styles.footerColTitle}>Supported Runtimes</div>
            <ul className={styles.footerNavList}>
              <li><Link href="/labs/deep-learning" className={styles.footerLink}>Deep Learning (PyTorch/TF)</Link></li>
              <li><Link href="/labs/distributed-computing" className={styles.footerLink}>Distributed Computing (Java)</Link></li>
              <li><Link href="/labs" className={styles.footerLink}>Python, Java &amp; C/C++</Link></li>
              <li><Link href="/labs" className={styles.footerLink}>Web, SQL &amp; Colab</Link></li>
            </ul>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <div>© {new Date().getFullYear()} LabMate. All rights reserved.</div>
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/privacy" className={styles.footerLink}>Privacy Policy</Link>
            <Link href="/terms" className={styles.footerLink}>Terms of Service</Link>
            <Link href="/refund-policy" className={styles.footerLink}>Refund Policy</Link>
            <Link href="/contact" className={styles.footerLink}>Contact</Link>
          </nav>
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