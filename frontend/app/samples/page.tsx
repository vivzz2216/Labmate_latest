"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  Download,
  FileText,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Layers,
  Sparkles,
  X,
  FileCode,
  BookOpen,
  Award,
} from "lucide-react";
import LabMateLogo from "@/components/brand/LabMateLogo";
import styles from "./samples.module.css";
import {
  SAMPLE_CATEGORIES,
  SAMPLE_DOCUMENTS,
  type SampleDoc,
} from "@/lib/sampleDocsData";

export default function SampleReportsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [inspectDoc, setInspectDoc] = useState<SampleDoc | null>(null);

  const filteredDocs = SAMPLE_DOCUMENTS.filter((doc) => {
    const matchesCategory =
      selectedCategory === "all" || doc.subjectCategory === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      doc.title.toLowerCase().includes(q) ||
      doc.subject.toLowerCase().includes(q) ||
      doc.experimentNumber.toLowerCase().includes(q) ||
      doc.categoryLabel.toLowerCase().includes(q) ||
      doc.after.ideTheme.toLowerCase().includes(q);

    return matchesCategory && matchesSearch;
  });

  return (
    <div className={styles.page}>
      <div className={styles.backgroundGlow} />

      {/* Sticky Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navContainer}>
          <div className="flex items-center gap-8">
            <Link href="/" aria-label="LabMate Home">
              <LabMateLogo size="md" theme="dark" />
            </Link>
            <div className={styles.navLinks}>
              <Link href="/" className={styles.navLink}>Home</Link>
              <Link href="/#how-it-works" className={styles.navLink}>How It Works</Link>
              <Link href="/labs" className={styles.navLink}>Lab Sections</Link>
              <span className={`${styles.navLink} ${styles.navLinkActive}`}>Sample Reports</span>
              <Link href="/workspace" className={styles.navLink}>Workspace</Link>
            </div>
          </div>

          <div className={styles.navActions}>
            <Link href="/code-execution" className={styles.uploadNavBtn}>
              Upload a Manual <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className={styles.container}>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.heroBadge}>
            <Award size={12} className="text-emerald-400" />
            <span>Collegiate Word (.DOCX) Quality Assurance</span>
          </div>

          <h1 className={styles.heroHeading}>
            Verified Sample Reports &amp; <br />
            <span className={styles.heroHighlight}>Before vs. After Archive</span>
          </h1>

          <p className={styles.heroSubtitle}>
            Inspect real Word documents compiled by LabMate for engineering and science students.
            Review how raw, messy syllabus prompts are transformed into accredited lab records with 1080p IDE evidence, verified code, and oral exam preparation.
          </p>
        </section>

        {/* Anatomy of an Accredited Lab Record */}
        <section className={styles.anatomySection}>
          <div className={styles.anatomyTitle}>
            <Sparkles size={16} className="text-amber-400" />
            <span>The 5 Sections Inside Every LabMate Generated Word Record</span>
          </div>
          <div className={styles.anatomyGrid}>
            <div className={styles.anatomyStep}>
              <span className={styles.anatomyStepNum}>SECTION 01</span>
              <h4 className={styles.anatomyStepTitle}>Academic Metadata &amp; Cover</h4>
              <p className={styles.anatomyStepDesc}>Student Roll No, Institution name, Department, Academic Year, and formal Course Code.</p>
            </div>
            <div className={styles.anatomyStep}>
              <span className={styles.anatomyStepNum}>SECTION 02</span>
              <h4 className={styles.anatomyStepTitle}>Formal Aim &amp; Theory</h4>
              <p className={styles.anatomyStepDesc}>Structured objectives, hardware/software specifications, and mathematical definitions.</p>
            </div>
            <div className={styles.anatomyStep}>
              <span className={styles.anatomyStepNum}>SECTION 03</span>
              <h4 className={styles.anatomyStepTitle}>Tested, Bug-Free Code</h4>
              <p className={styles.anatomyStepDesc}>Full executable scripts tested inside isolated runtime sandboxes with zero syntax errors.</p>
            </div>
            <div className={styles.anatomyStep}>
              <span className={styles.anatomyStepNum}>SECTION 04</span>
              <h4 className={styles.anatomyStepTitle}>1080p Console &amp; IDE Proof</h4>
              <p className={styles.anatomyStepDesc}>Real terminal, RStudio, IDLE, and MySQL screenshots pre-scaled to university margin twips.</p>
            </div>
            <div className={styles.anatomyStep}>
              <span className={styles.anatomyStepNum}>SECTION 05</span>
              <h4 className={styles.anatomyStepTitle}>Viva-Voce Oral Exam Q&amp;A</h4>
              <p className={styles.anatomyStepDesc}>5 to 10 typical external examiner questions with model answers for final practical exams.</p>
            </div>
          </div>
        </section>

        {/* Filter and Search Bar */}
        <div className={styles.filterBar}>
          <div className={styles.searchWrap}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search experiments, languages (e.g. regression, vectors, oop, mysql)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className={styles.categoryPills} role="tablist">
            {SAMPLE_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  className={`${styles.categoryPill} ${isActive ? styles.categoryPillActive : ""}`}
                  onClick={() => setSelectedCategory(cat.id)}
                  type="button"
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Documents Grid */}
        <div className={styles.docsGrid}>
          {filteredDocs.map((doc) => (
            <div key={doc.id} className={styles.docCard}>
              <div>
                <div className={styles.cardHeader}>
                  <span className={styles.cardBadge}>{doc.categoryLabel}</span>
                  <span className={styles.cardSyllabus}>{doc.syllabusCode}</span>
                </div>

                <h3 className={styles.cardTitle}>{doc.title}</h3>
                <div className={styles.cardSubject}>{doc.subject}</div>

                <div className={styles.cardMetrics}>
                  <div>
                    <div className={styles.metricValue}>{doc.after.pages}</div>
                    <div className={styles.metricLabel}>Pages</div>
                  </div>
                  <div>
                    <div className={styles.metricValue}>{doc.after.screenshotsCount}</div>
                    <div className={styles.metricLabel}>Screenshots</div>
                  </div>
                  <div>
                    <div className={styles.metricValue}>{doc.after.fileSize}</div>
                    <div className={styles.metricLabel}>Docx Size</div>
                  </div>
                </div>
              </div>

              <div className={styles.cardActions}>
                <button
                  type="button"
                  className={styles.inspectBtn}
                  onClick={() => setInspectDoc(doc)}
                >
                  Inspect Before/After
                </button>
                <a
                  href={doc.after.downloadUrl}
                  download
                  className={styles.downloadBtn}
                  title={`Download ${doc.title} (.docx)`}
                >
                  <Download size={14} />
                  <span>Download .DOCX</span>
                </a>
              </div>
            </div>
          ))}
        </div>

        {filteredDocs.length === 0 && (
          <div className="text-center py-20 text-zinc-500">
            <BookOpen size={36} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No sample documents matched your search query.</p>
            <button
              onClick={() => { setSearchQuery(""); setSelectedCategory("all"); }}
              className="mt-3 text-xs text-sky-400 underline cursor-pointer"
            >
              Reset filters
            </button>
          </div>
        )}
      </main>

      {/* Before vs After Detailed Inspection Modal */}
      {inspectDoc && (
        <div className={styles.modalOverlay} onClick={() => setInspectDoc(null)}>
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              className={styles.modalCloseBtn}
              onClick={() => setInspectDoc(null)}
              aria-label="Close inspection modal"
            >
              <X size={18} />
            </button>

            <div className="mb-6">
              <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                {inspectDoc.experimentNumber} &bull; {inspectDoc.categoryLabel}
              </span>
              <h2 className="text-2xl font-bold text-white mt-1">{inspectDoc.title}</h2>
              <p className="text-xs text-zinc-400 mt-1">{inspectDoc.subject} &bull; {inspectDoc.syllabusCode}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Before Column */}
              <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold">
                      <AlertTriangle size={12} /> Before (Raw Manual)
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">{inspectDoc.before.fileSize}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-2">{inspectDoc.before.title}</h4>
                  <p className="text-xs text-zinc-400 mb-3 leading-relaxed">{inspectDoc.before.description}</p>
                  
                  <div className="bg-black/60 rounded-lg p-3 text-xs font-mono text-zinc-300 whitespace-pre-wrap max-h-40 overflow-y-auto mb-4 border border-zinc-800">
                    {inspectDoc.before.rawSnippet}
                  </div>

                  <div className="space-y-2 mb-4">
                    {inspectDoc.before.painPoints.map((pain, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-red-300">
                        <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" />
                        <span>{pain}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {inspectDoc.rawDownloadUrl && (
                  <a
                    href={inspectDoc.rawDownloadUrl}
                    download
                    className="inline-flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg border border-zinc-700 hover:border-zinc-500 text-xs text-zinc-300 hover:text-white transition-colors"
                  >
                    <FileCode size={13} />
                    <span>Download Raw Prompt ({inspectDoc.before.fileSize})</span>
                  </a>
                )}
              </div>

              {/* After Column */}
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                      <Sparkles size={12} /> After (LabMate Word Output)
                    </span>
                    <span className="text-xs text-emerald-400 font-mono font-medium">{inspectDoc.after.fileSize}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-2">{inspectDoc.after.title}</h4>
                  <p className="text-xs text-zinc-400 mb-3 leading-relaxed">{inspectDoc.after.description}</p>

                  <div className="relative aspect-video rounded-lg overflow-hidden border border-zinc-700 bg-black mb-4">
                    <Image
                      src={inspectDoc.after.previewImage}
                      alt="Verified IDE output"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur px-2 py-0.5 rounded text-[10px] text-emerald-300 flex items-center gap-1 border border-emerald-500/30">
                      <Terminal size={10} />
                      <span>{inspectDoc.after.ideTheme}</span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {inspectDoc.after.highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-zinc-200">
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <a
                  href={inspectDoc.after.downloadUrl}
                  download
                  className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors shadow-lg"
                >
                  <Download size={14} />
                  <span>Download Completed .DOCX ({inspectDoc.after.fileSize})</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className={styles.footer}>
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>&copy; {new Date().getFullYear()} LabMate AI &bull; Automated Lab Manual Intelligence</div>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-zinc-400">Home</Link>
            <Link href="/labs" className="hover:text-zinc-400">All Labs</Link>
            <Link href="/workspace" className="hover:text-zinc-400">Workspace</Link>
            <Link href="/code-execution" className="hover:text-zinc-400">Upload Manual</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
