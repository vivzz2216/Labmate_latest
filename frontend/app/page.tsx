"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  FolderOpen,
  Laptop,
  Chrome,
  Upload,
  FileText,
  Sparkles,
  Layers,
  Check,
} from "lucide-react";
import LabMateLogo from "@/components/brand/LabMateLogo";
import { useAuth } from "@/contexts/BasicAuthContext";
import styles from "./home.module.css";

const LoginModal = dynamic(() => import("@/components/auth/LoginModal"), {
  ssr: false,
});

const DarkVeil = dynamic(() => import("@/components/visual/DarkVeil"), {
  ssr: false,
});

export default function HomePage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const isAuthenticated = Boolean(user);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

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
              <a href="#platforms" className={styles.navLink}>Platforms</a>
              <a href="#research" className={styles.navLink}>Research</a>
              <a href="#latest" className={styles.navLink}>Latest</a>
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
                  onClick={() => setIsLoginOpen(true)}
                  className={styles.loginTextLink}
                >
                  Log In
                </button>
                <Link href="/workspace" className={styles.pillBtnPrimary}>
                  Get Started <ArrowRight size={14} />
                </Link>
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
          Transform raw lab manuals into verified code, authentic execution evidence, and accredited Word reports.
        </p>

        <div className={styles.heroCtas}>
          <Link href="/workspace" className={styles.pillBtnPrimary}>
            <FolderOpen size={16} /> Open Student Workspace
          </Link>
          <Link href="/dashboard" className={styles.pillBtnSecondary}>
            <Laptop size={16} /> Launch Lab Studio
          </Link>
          <a
            href="#platforms"
            className={`${styles.pillBtnSecondary}`}
          >
            <Chrome size={15} /> Add to Chrome
          </a>
        </div>

        <div className={styles.metricHighlights}>
          <div className={styles.metricItem}>
            <span>100% Deterministic Verification</span>
          </div>
          <span className={styles.metricDot}>•</span>
          <div className={styles.metricItem}>
            <span>Posix Resource Ceilings</span>
          </div>
          <span className={styles.metricDot}>•</span>
          <div className={styles.metricItem}>
            <span>Collegiate Word Layouts</span>
          </div>
          <span className={styles.metricDot}>•</span>
          <div className={styles.metricItem}>
            <span>Google Drive One-Click Sync</span>
          </div>
        </div>
      </motion.header>

      {/* Hero Media Showcase Frame (No Terminal UI) */}
      <section className={styles.heroMediaSection}>
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className={styles.heroMediaCard}
        >
          <div className={styles.heroMediaCanvas}>
            <Image
              src="/images/hero_showcase.jpg"
              alt="LabMate University Curriculum Workspace"
              fill
              sizes="(max-width: 1280px) 100vw, 1280px"
              className={styles.heroCoverImage}
              priority
            />
            <div className={styles.heroMediaOverlay} />

            <div className="flex items-center justify-between z-10 w-full">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
              </div>
              <span className="text-xs font-mono text-zinc-300 bg-black/70 border border-white/15 px-3 py-1 rounded-full backdrop-blur-md">
                ● LABMATE CURRICULUM INTELLIGENCE v2.5
              </span>
            </div>

            <div className="flex items-center justify-between z-10 pt-4 border-t border-white/10 text-xs text-zinc-300">
              <span className="font-mono">AST VERIFICATION • 512MB POSIX SANDBOX • OPENXML DOCX</span>
              <span className="font-mono text-zinc-400">Curriculum Automation Engine</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ========================================================
          TECHNOLOGY & LANGUAGE PARTNER TICKER (IMAGE 2 REFERENCE)
          ======================================================== */}
      <section className={styles.langTickerSection}>
        <div className={styles.langTickerTitle}>
          We calibrate with standard engineering languages, runtimes &amp; laboratory environments:
        </div>
        <div className={styles.langTickerRow}>
          {/* Python */}
          <div className={styles.langItem} title="Python 3.11 AST Runtime">
            <svg width="22" height="22" viewBox="0 0 256 255" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M126.916.072c-64.832 0-60.784 28.115-60.784 28.115l.072 29.128h61.868v8.745H41.631S.145 61.355.145 126.77c0 65.417 36.21 63.097 36.21 63.097h21.61v-30.356s-1.165-36.21 35.632-36.21h61.362s34.475-.58 34.475-33.886V28.187S194.887.072 126.916.072zM92.802 19.66a11.12 11.12 0 0 1 11.13 11.13 11.12 11.12 0 0 1-11.13 11.13 11.12 11.12 0 0 1-11.13-11.13 11.12 11.12 0 0 1 11.13-11.13z" fill="#387EB8"/>
              <path d="M128.757 254.126c64.832 0 60.784-28.115 60.784-28.115l-.072-29.127H127.6v-8.745h86.441s41.486 4.705 41.486-60.71c0-65.416-36.21-63.098-36.21-63.098h-21.61v30.356s1.165 36.21-35.632 36.21h-61.362s-34.475.58-34.475 33.886v61.233s-5.459 28.12 62.519 28.12zm34.114-19.587a11.12 11.12 0 0 1-11.13-11.13 11.12 11.12 0 0 1 11.13-11.13 11.12 11.12 0 0 1 11.13 11.13 11.12 11.12 0 0 1-11.13 11.13z" fill="#FFE052"/>
            </svg>
            <span>Python</span>
          </div>

          {/* Java */}
          <div className={styles.langItem} title="Java OpenJDK 17">
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

          {/* Linux POSIX */}
          <div className={styles.langItem} title="Linux POSIX Kernel with RLIMIT Isolation">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C9.5 2 8 4 8 7c0 1.2.2 2.6.5 3.8C7.2 11.4 6 13 6 15c0 2.8 2.2 5 5 5h2c2.8 0 5-2.2 5-5 0-2-1.2-3.6-2.5-4.2.3-1.2.5-2.6.5-3.8 0-3-1.5-5-4-5z" fill="#FCC624"/>
              <path d="M12 3c-1.8 0-3 1.5-3 4 0 1.2.3 2.5.6 3.6.4-.1.9-.2 1.4-.2.9 0 1.7.3 2.4.7.4-.1.8-.1 1.2-.1.3 0 .7.1 1 .2.3-1.1.6-2.4.6-3.6 0-2.5-1.2-4-3.2-4z" fill="#18181b"/>
              <circle cx="10.5" cy="6.5" r="1" fill="#ffffff"/>
              <circle cx="13.5" cy="6.5" r="1" fill="#ffffff"/>
              <circle cx="10.7" cy="6.5" r=".5" fill="#000000"/>
              <circle cx="13.7" cy="6.5" r=".5" fill="#000000"/>
              <path d="M11 8.5c0-.3.4-.5 1-.5s1 .2 1 .5l-.3 1h-1.4L11 8.5z" fill="#E67E22"/>
            </svg>
            <span>POSIX Linux</span>
          </div>

          {/* Docker */}
          <div className={styles.langItem} title="Docker Sandboxed Runtimes">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 8.5h2v2h-2zm-3 0h2v2h-2zm-3 0h2v2H7zm6-3h2v2h-2zm-3 0h2v2h-2zm6 6h2v2h-2zm-3 0h2v2h-2zm-3 0h2v2H7zm-3 0h2v2H4z" fill="#2496ED"/>
              <path d="M22.5 13.5c-.3 0-.6-.1-.8-.2-.5-.3-.9-.6-1.5-.6-.7 0-1.4.3-1.8.8-1-1-2.4-1.5-3.8-1.5H3c-.6 0-1 .4-1 1 0 3.9 3.1 7 7 7 4.2 0 7.8-2.6 8.7-6.5.9.1 1.8-.1 2.5-.7.5-.4.8-1 .9-1.6-.4.2-.8.3-1.3.3h-.7v.1z" fill="#2496ED"/>
            </svg>
            <span>Docker</span>
          </div>

          {/* Word OpenXML */}
          <div className={styles.langItem} title="Collegiate Microsoft Word OpenXML Engine">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#2B579A"/>
              <path d="M14 2v6h6" fill="#1B3A6B"/>
              <path d="M8 12.5l1.2 5.5 1.5-4 1.5 4 1.2-5.5h-1l-.8 4.2-1.4-4.2h-.9l-1.4 4.2-.8-4.2H8z" fill="#ffffff"/>
            </svg>
            <span>Word DOCX</span>
          </div>

          {/* Google Drive */}
          <div className={styles.langItem} title="Google Drive Native Syllabus Ingestion">
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

      {/* ========================================================
          SECTION 1 (IMAGE 4): Three Platforms on Real-World Intelligence
          ======================================================== */}
      <section id="platforms" className={styles.threePlatformsSection}>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className={styles.threePlatformsHeading}
        >
          Three platforms built on-top of the same Real-World Intelligence models
        </motion.h2>

        <div className={styles.threePlatformsGrid}>
          {/* Column 1: LabMate Studio */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={styles.platformCol}
          >
            <div className={styles.platformColLabel}>LabMate Studio</div>
            <div className={styles.platformVisualCard}>
              <Image
                src="/images/platform_studio.jpg"
                alt="LabMate Studio"
                fill
                sizes="(max-width: 900px) 100vw, 33vw"
                className={styles.cardImage}
              />
            </div>
            <h3 className={styles.platformColTitle}>
              Your complete Lab Studio with everything you need, to solve and run any assignment you want.
            </h3>
            <p className={styles.platformColDesc}>
              An all-in-one cloud-based IDE that offers endless ways to parse manuals, generate clean algorithms, and run code in one workspace. Built for students and faculty.
            </p>
            <div className={styles.platformColActions}>
              <Link href="/dashboard" className={styles.pillBtnBlack}>Try now</Link>
              <Link href="/dashboard" className={styles.pillBtnGhost}>Learn more</Link>
              <Link href="/dashboard" className={styles.pillBtnGhost}>For Colleges</Link>
            </div>
          </motion.div>

          {/* Column 2: LabMate Workspace */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={styles.platformCol}
          >
            <div className={styles.platformColLabel}>LabMate Workspace</div>
            <div className={styles.platformVisualCard}>
              <Image
                src="/images/platform_workspace.jpg"
                alt="LabMate Workspace"
                fill
                sizes="(max-width: 900px) 100vw, 33vw"
                className={styles.cardImage}
              />
            </div>
            <h3 className={styles.platformColTitle}>
              The unified evidence hub for students to organize reports, code, and execution proofs.
            </h3>
            <p className={styles.platformColDesc}>
              Permanent cloud storage powered by Cloudflare R2. Access all your compiled Word documents, high-res execution screenshots, and solution versions in one place.
            </p>
            <div className={styles.platformColActions}>
              <Link href="/workspace" className={styles.pillBtnBlack}>Open Workspace</Link>
              <Link href="/workspace" className={styles.pillBtnGhost}>View documentation</Link>
              <Link href="/workspace" className={styles.pillBtnGhost}>For Enterprise</Link>
            </div>
          </motion.div>

          {/* Column 3: LabMate Drive */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className={styles.platformCol}
          >
            <div className={styles.platformColLabel}>LabMate Drive</div>
            <div className={styles.platformVisualCard}>
              <Image
                src="/images/platform_drive.jpg"
                alt="LabMate Drive"
                fill
                sizes="(max-width: 900px) 100vw, 33vw"
                className={styles.cardImage}
              />
            </div>
            <h3 className={styles.platformColTitle}>
              A native browser extension to send manuals directly from Google Drive in one click.
            </h3>
            <p className={styles.platformColDesc}>
              Integrates directly into Google Drive and Docs file previews. Detects PDF/DOCX manuals and automatically streams them to your LabMate backend with session token sync.
            </p>
            <div className={styles.platformColActions}>
              <Link href="/workspace" className={styles.pillBtnBlack}>Add to Chrome</Link>
              <Link href="/workspace" className={styles.pillBtnGhost}>Contact Team</Link>
            </div>
          </motion.div>
        </div>

        <div className={styles.platformFinePrint}>
          Used by 40,000+ engineering students. Try free, cancel anytime.
        </div>
      </section>

      {/* ========================================================
          SECTION 2: LabMate Curriculum Research (with DarkVeil Background)
          ======================================================== */}
      <section id="research" className={styles.researchSection}>
        <div className={styles.researchCard}>
          <div className={styles.researchVeilWrap}>
            <DarkVeil
              hueShift={125}
              speed={0.4}
              noiseIntensity={0.02}
              scanlineIntensity={0.08}
              scanlineFrequency={0.003}
              warpAmount={0.06}
              resolutionScale={1}
            />
            <div className={styles.researchVeilOverlay} />
          </div>

          <div className={styles.researchLeftCol}>
            <div className={styles.researchLabel}>Curriculum Intelligence Research</div>
            <h2 className={styles.researchHeading}>
              We are engineering deterministic language and execution models that decompose ambiguous engineering syllabi into compliant code, isolated POSIX runtimes, and institutional laboratory records.
            </h2>
            <div>
              <Link href="/workspace" className={styles.pillBtnSecondary}>
                Explore Research Architecture
              </Link>
            </div>
          </div>

          <div className={styles.researchRightCol}>
            {/* Row 1: AST Code Synthesis */}
            <div className={styles.researchRowItem}>
              <div className={styles.researchRowHeader}>
                <span className={styles.researchRowTitle}>AST Code Synthesis & Multi-Language Verification</span>
                <ArrowUpRight size={18} className={styles.researchArrowIcon} />
              </div>
              <p className={styles.researchRowDesc}>
                Targeted compilers for C, C++, Java, Python, and Web Development that enforce strict algorithmic correctness with zero hallucinated third-party dependencies.
              </p>
            </div>

            {/* Row 2: Hardened POSIX Kernel Sandbox */}
            <div className={styles.researchRowItem}>
              <div className={styles.researchRowHeader}>
                <span className={styles.researchRowTitle}>Hardened POSIX Kernel Sandbox</span>
                <ArrowUpRight size={18} className={styles.researchArrowIcon} />
              </div>
              <p className={styles.researchRowDesc}>
                Kernel-level isolation featuring Linux RLIMIT memory ceilings (512MB), CPU cycle timeouts, and forbidden system calls to guarantee fail-safe student execution.
              </p>
            </div>

            {/* Row 3: Collegiate OpenXML Document Engine */}
            <div className={styles.researchRowItem}>
              <div className={styles.researchRowHeader}>
                <span className={styles.researchRowTitle}>Collegiate OpenXML Document Engine</span>
                <ArrowUpRight size={18} className={styles.researchArrowIcon} />
              </div>
              <p className={styles.researchRowDesc}>
                Deterministic Word (.docx) publication engine producing institutional lab manuals with department headers, aim, algorithms, high-res execution captures, and viva rubrics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 3: See the latest from LabMate
          ======================================================== */}
      <section id="latest" className={styles.latestSection}>
        <h2 className={styles.latestHeading}>See the latest from LabMate</h2>

        <div className={styles.latestGrid}>
          {/* Card 1: Collaborative Student & Faculty Workspaces */}
          <div className={styles.latestCard}>
            <div className={styles.latestThumb}>
              <Image
                src="/images/latest_team.jpg"
                alt="Collaborative Student and Faculty Workspaces"
                fill
                sizes="(max-width: 860px) 100vw, 680px"
                className={styles.cardImage}
              />
            </div>
            <div className={styles.latestCardContent}>
              <h3 className={styles.latestCardTitle}>Collaborative Student & Faculty Workspaces</h3>
              <p className={styles.latestCardDesc}>
                Unified lab workspaces with automated manual distribution and cohort assignment tracking.
              </p>
              <Link href="/workspace" className={styles.latestLearnMoreLink}>
                Learn more <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* Card 2: Accredited Word (.docx) Lab Manuals */}
          <div className={styles.latestCard}>
            <div className={styles.latestThumb}>
              <Image
                src="/images/latest_docx.jpg"
                alt="Accredited Word Lab Manuals"
                fill
                sizes="(max-width: 860px) 100vw, 680px"
                className={styles.cardImage}
              />
            </div>
            <div className={styles.latestCardContent}>
              <h3 className={styles.latestCardTitle}>Accredited Word (.docx) Lab Records</h3>
              <p className={styles.latestCardDesc}>
                Instantly compile accredited lab records with verified algorithms, code, and faculty signoff.
              </p>
              <Link href="/workspace" className={styles.latestLearnMoreLink}>
                Learn more <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* Card 3: Authentic Terminal & Execution Evidence */}
          <div className={styles.latestCard}>
            <div className={styles.latestThumb}>
              <Image
                src="/images/latest_evidence.jpg"
                alt="Authentic Terminal and Execution Evidence"
                fill
                sizes="(max-width: 860px) 100vw, 680px"
                className={styles.cardImage}
              />
            </div>
            <div className={styles.latestCardContent}>
              <h3 className={styles.latestCardTitle}>Authentic 1080p Execution Evidence</h3>
              <p className={styles.latestCardDesc}>
                High-definition visual proofs rendered directly from our isolated sandbox to verify execution.
              </p>
              <Link href="/workspace" className={styles.latestLearnMoreLink}>
                Learn more <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* Card 4: Cloudflare R2 Durable Academic Cloud */}
          <div className={styles.latestCard}>
            <div className={styles.latestThumb}>
              <Image
                src="/images/latest_storage.jpg"
                alt="Cloudflare R2 Durable Academic Cloud"
                fill
                sizes="(max-width: 860px) 100vw, 680px"
                className={styles.cardImage}
              />
            </div>
            <div className={styles.latestCardContent}>
              <h3 className={styles.latestCardTitle}>Cloudflare R2 Durable Academic Cloud</h3>
              <p className={styles.latestCardDesc}>
                Zero-egress distributed cloud storage preserving student records, logs, and compiled manuals.
              </p>
              <Link href="/workspace" className={styles.latestLearnMoreLink}>
                Learn more <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Institutional Curriculum Partner Ticker */}
      <section className={styles.tickerSection}>
        <div className={styles.tickerTitle}>
          Calibrated for Standard University Curricula & Accreditation Frameworks
        </div>
        <div className={styles.tickerRow}>
          <div className={styles.tickerItem}>VTU Belagavi</div>
          <div className={styles.tickerItem}>Anna University</div>
          <div className={styles.tickerItem}>Mumbai University</div>
          <div className={styles.tickerItem}>APJ Abdul Kalam TU</div>
          <div className={styles.tickerItem}>Autonomous Institutes</div>
          <div className={styles.tickerItem}>CS & AI Engineering Depts</div>
        </div>
      </section>

      {/* Minimalist Runway Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          <div className={styles.footerBrandCol}>
            <LabMateLogo size="md" theme="dark" />
            <p className="text-xs text-zinc-500 leading-relaxed max-w-sm">
              The foundational AI lab manual intelligence engine for engineering colleges,
              curriculum automation, and student workspace management.
            </p>
          </div>

          <div>
            <div className={styles.footerColTitle}>Platform</div>
            <ul className={styles.footerNavList}>
              <li><Link href="/workspace" className={styles.footerLink}>Student Workspace</Link></li>
              <li><Link href="/dashboard" className={styles.footerLink}>Lab Studio IDE</Link></li>
              <li><Link href="/reports" className={styles.footerLink}>Report Composer</Link></li>
              <li><a href="#platforms" className={styles.footerLink}>Drive Extension</a></li>
            </ul>
          </div>

          <div>
            <div className={styles.footerColTitle}>Architecture</div>
            <ul className={styles.footerNavList}>
              <li><a href="#research" className={styles.footerLink}>AST Code Synthesizer</a></li>
              <li><a href="#research" className={styles.footerLink}>Hardened POSIX Sandbox</a></li>
              <li><a href="#research" className={styles.footerLink}>Collegiate OpenXML Engine</a></li>
              <li><a href="#research" className={styles.footerLink}>Deterministic Execution Proofs</a></li>
            </ul>
          </div>

          <div>
            <div className={styles.footerColTitle}>Resources</div>
            <ul className={styles.footerNavList}>
              <li><Link href="/workspace" className={styles.footerLink}>Documentation</Link></li>
              <li><Link href="/dashboard" className={styles.footerLink}>Syllabus Support</Link></li>
              <li><a href="#platforms" className={styles.footerLink}>Drive Extension</a></li>
              <li><a href="mailto:support@labmate.ai" className={styles.footerLink}>Contact Team</a></li>
            </ul>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <div>© {new Date().getFullYear()} LabMate AI Inc. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <span className="hover:text-zinc-400 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-zinc-400 cursor-pointer">Terms of Service</span>
            <span className="hover:text-zinc-400 cursor-pointer">Security Whitepaper</span>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      {isLoginOpen && (
        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
        />
      )}
    </div>
  );
}
