"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  Terminal,
  FileCode,
} from "lucide-react";
import styles from "./SampleReportsShowcase.module.css";
import {
  SAMPLE_CATEGORIES,
  SAMPLE_DOCUMENTS,
  type SampleDoc,
} from "@/lib/sampleDocsData";

export default function SampleReportsShowcase() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeDocId, setActiveDocId] = useState<string>("r-exp1-vectors");

  const filteredDocs =
    selectedCategory === "all"
      ? SAMPLE_DOCUMENTS
      : SAMPLE_DOCUMENTS.filter((doc) => doc.subjectCategory === selectedCategory);

  const activeDoc: SampleDoc =
    SAMPLE_DOCUMENTS.find((d) => d.id === activeDocId) || SAMPLE_DOCUMENTS[0];

  return (
    <section
      id="samples"
      className={styles.section}
      aria-labelledby="samples-heading"
    >
      {/* Header */}
      <div className={styles.sectionHeader}>
        <div className={styles.badge}>
          <span className={styles.badgeDot} />
          <span>Proof of Work &amp; Accredited Outputs</span>
        </div>
        <h2 id="samples-heading" className={styles.title}>
          Before &amp; After:{" "}
          <span className={styles.titleHighlight}>Real Manuals In, Submission Reports Out.</span>
        </h2>
        <p className={styles.description}>
          Students ask us: <em>&ldquo;What does the generated Word report actually look like?&rdquo;</em> Review the exact transformation below. Download genuine .docx lab records compiled with 1080p IDE evidence, OxML academic styling, and oral viva questions.
        </p>
      </div>

      {/* Category Tabs */}
      <div className={styles.categoryTabs} role="tablist" aria-label="Sample document categories">
        {SAMPLE_CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              role="tab"
              aria-selected={isActive}
              className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ""}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Featured Inspector: Before vs After Dual Panel */}
      <div className={styles.comparisonCard}>
        <div className={styles.comparisonHeader}>
          <div className={styles.docMeta}>
            <span className={styles.expTag}>
              <Layers size={13} /> {activeDoc.experimentNumber} &bull; {activeDoc.categoryLabel}
            </span>
            <h3 className={styles.docHeading}>{activeDoc.title}</h3>
            <span className={styles.docSub}>{activeDoc.subject} &bull; {activeDoc.syllabusCode}</span>
          </div>

          <div className={styles.headerActions}>
            {activeDoc.rawDownloadUrl && (
              <a
                href={activeDoc.rawDownloadUrl}
                download
                className={styles.downloadRawBtn}
                title="Download the raw student prompt before LabMate processing"
              >
                <FileCode size={14} />
                <span>Raw Manual ({activeDoc.before.fileSize})</span>
              </a>
            )}
            <a
              href={activeDoc.after.downloadUrl}
              download
              className={styles.downloadDocxBtn}
              title="Download submission-grade Word (.docx) document"
            >
              <Download size={14} />
              <span>Download Finished .DOCX ({activeDoc.after.fileSize})</span>
            </a>
          </div>
        </div>

        {/* Before vs After Grid */}
        <div className={styles.comparisonGrid}>
          {/* Panel 1: Before */}
          <div className={`${styles.panel} ${styles.panelBefore}`}>
            <div className={styles.panelBadgeRow}>
              <span className={styles.statusPillBefore}>
                <AlertTriangle size={12} /> Before · Raw Manual
              </span>
              <span className={styles.fileMetaText}>
                {activeDoc.before.fileType} &bull; {activeDoc.before.fileSize}
              </span>
            </div>

            <h4 className={styles.panelTitle}>{activeDoc.before.title}</h4>
            <p className={styles.panelDesc}>{activeDoc.before.description}</p>

            <div className={styles.rawSnippetBox}>
              {activeDoc.before.rawSnippet}
            </div>

            <div className={styles.frictionList}>
              {activeDoc.before.painPoints.map((pain, idx) => (
                <div key={idx} className={styles.frictionItem}>
                  <AlertTriangle size={14} className={styles.frictionIcon} />
                  <span>{pain}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Panel 2: After */}
          <div className={`${styles.panel} ${styles.panelAfter}`}>
            <div className={styles.panelBadgeRow}>
              <span className={styles.statusPillAfter}>
                <Sparkles size={12} /> After · LabMate Word Output
              </span>
              <span className={styles.fileMetaText}>
                {activeDoc.after.pages} Pages &bull; {activeDoc.after.screenshotsCount} Captures &bull; {activeDoc.after.fileSize}
              </span>
            </div>

            <h4 className={styles.panelTitle}>{activeDoc.after.title}</h4>
            <p className={styles.panelDesc}>{activeDoc.after.description}</p>

            {/* Visual Screenshot Preview */}
            <div className={styles.afterPreviewWrap}>
              <Image
                src={activeDoc.after.previewImage}
                alt={`${activeDoc.title} verified execution output`}
                fill
                sizes="(max-width: 900px) 100vw, 560px"
                className={styles.afterImage}
              />
              <div className={styles.afterOverlayBadge}>
                <Terminal size={12} />
                <span>{activeDoc.after.ideTheme}</span>
              </div>
            </div>

            <div className={styles.highlightsList}>
              {activeDoc.after.highlights.map((item, idx) => (
                <div key={idx} className={styles.highlightItem}>
                  <CheckCircle2 size={14} className={styles.checkIcon} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Document Library Section */}
      <div className={styles.libraryTitle}>
        <span>All Verified Lab Records in Library</span>
        <Link href="/samples" className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
          Open dedicated archive <ExternalLink size={12} />
        </Link>
      </div>

      <div className={styles.libraryGrid}>
        {filteredDocs.map((doc) => {
          const isSelected = doc.id === activeDocId;
          return (
            <div
              key={doc.id}
              className={`${styles.docCard} ${isSelected ? styles.docCardActive : ""}`}
            >
              <div>
                <div className={styles.cardTop}>
                  <span className={styles.cardCatBadge}>{doc.categoryLabel}</span>
                  <span className={styles.cardFormatBadge}>.DOCX</span>
                </div>

                <h4 className={styles.cardTitle}>{doc.title}</h4>
                <div className={styles.cardSubject}>{doc.subject}</div>

                <div className={styles.cardStatsRow}>
                  <span><FileText size={12} /> {doc.after.pages} pgs</span>
                  <span>&bull;</span>
                  <span><Terminal size={12} /> {doc.after.screenshotsCount} caps</span>
                  <span>&bull;</span>
                  <span>{doc.after.fileSize}</span>
                </div>
              </div>

              <div className={styles.cardActions}>
                <button
                  type="button"
                  className={styles.cardPreviewBtn}
                  onClick={() => {
                    setActiveDocId(doc.id);
                    // Smooth scroll to comparison card
                    const el = document.getElementById("samples");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {isSelected ? "Inspecting" : "Inspect Before/After"}
                </button>
                <a
                  href={doc.after.downloadUrl}
                  download
                  className={styles.cardDownloadBtn}
                  title={`Download ${doc.title} .docx`}
                >
                  <Download size={13} />
                  <span>Download</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom CTA Box */}
      <div className={styles.bottomCta}>
        <div className={styles.ctaText}>
          <h4>Looking for another university syllabus or semester lab manual?</h4>
          <p>
            Browse our full archive of 50+ college manuals across Mumbai University, VTU, Anna University, and SPPU.
          </p>
        </div>
        <div className={styles.ctaButtons}>
          <Link href="/samples" className={styles.ctaLinkSecondary}>
            Browse Full Archive <ArrowRight size={14} />
          </Link>
          <Link href="/code-execution" className={styles.ctaLinkPrimary}>
            Process Your Own Manual <Sparkles size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
