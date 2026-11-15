"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Layers,
  Cpu,
  Network,
  CheckCircle2,
  Sparkles,
  Terminal,
  UploadCloud,
  FileCode2,
  Database,
  Code2,
  BookOpen,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getLabCategory } from "@/lib/labCatalog";
import styles from "../labs.module.css";

const iconMap: Record<string, any> = {
  deep_learning: Cpu,
  distributed: Network,
  python: Terminal,
  java: FileCode2,
  cpp: Code2,
  web: Code2,
  sql: Database,
  colab: BookOpen,
  r: BookOpen,
  sma: Network,
};

const runtimeLabelMap: Record<string, string> = {
  deep_learning: "PyTorch & TensorFlow",
  distributed: "Java Multi-Process",
  python: "Python 3 Runtime",
  java: "Java OpenJDK",
  cpp: "GCC & G++ Toolchain",
  web: "Node.js & React Web",
  sql: "MySQL Server",
  colab: "Jupyter & Colab",
  r: "R & RStudio",
  sma: "Python Notebook",
};

export default function LabSectionDetailPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "";

  const category = useMemo(() => getLabCategory(slug), [slug]);

  if (!category) {
    return (
      <DashboardShell
        title="Lab Section Not Found"
        subtitle="The requested lab category does not exist."
      >
        <div className={styles.container}>
          <div className={styles.emptyFilterState}>
            <Layers size={32} />
            <h3>Lab Category Not Found</h3>
            <p style={{ marginBottom: "1.25rem" }}>
              Could not find any lab track matching &ldquo;{slug}&rdquo;.
            </p>
            <Link href="/labs" className={styles.heroPrimaryPill}>
              Back to All Lab Sections
            </Link>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const Icon = iconMap[category.track] || Layers;
  const runtimeLabel =
    runtimeLabelMap[category.track] || category.defaultLanguage.toUpperCase();

  return (
    <DashboardShell
      title={category.title}
      subtitle={category.tagline}
    >
      <div className={styles.container}>
        {/* Cosmic Hero Section Header */}
        <header className={styles.heroBanner}>
          <div className={styles.heroArc} aria-hidden="true" />
          <div className={styles.heroInner}>
            {/* Breadcrumb Navigation */}
            <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
              <Link href="/dashboard">Dashboard</Link>
              <ChevronRight size={13} className={styles.breadcrumbSeparator} />
              <Link href="/labs">Lab Sections</Link>
              <ChevronRight size={13} className={styles.breadcrumbSeparator} />
              <span className={styles.breadcrumbActive}>{category.title}</span>
            </nav>

            <div className={styles.heroGrid}>
              <div className={styles.heroContent}>
                <div className={styles.titleRow}>
                  <span
                    className={styles.titleIconBox}
                    style={{
                      background: `${category.accentColor}22`,
                      border: `1px solid ${category.accentColor}45`,
                    }}
                  >
                    <Icon size={22} color={category.accentColor} />
                  </span>
                  <h1 className={styles.title}>{category.title}</h1>
                  {category.badge && (
                    <span
                      className={`${styles.badge} ${
                        category.track === "deep_learning"
                          ? styles.badgePurple
                          : category.track === "distributed"
                            ? styles.badgeSky
                            : ""
                      }`}
                    >
                      <Sparkles size={11} /> {category.badge}
                    </span>
                  )}
                </div>

                <p className={styles.heroSubtitle}>{category.description}</p>

                <div className={styles.heroFeaturesRow}>
                  <span className={styles.heroFeatureItem}>
                    <ShieldCheck size={15} /> Sandboxed Runtime
                  </span>
                  <span className={styles.heroFeatureItem}>
                    <Zap size={15} /> Automated Code &amp; Proofs
                  </span>
                  <span className={styles.heroFeatureItem}>
                    <CheckCircle2 size={15} /> DOCX Reports
                  </span>
                </div>

                {/* Action CTAs */}
                <div className={styles.actionsBar}>
                  <Link
                    href={`/code-execution?track=${category.track}`}
                    className={styles.heroPrimaryPill}
                  >
                    <UploadCloud size={15} />
                    <span>Upload {category.shortTitle} Lab Manual</span>
                  </Link>
                  <Link
                    href={`/code-execution?track=${category.track}`}
                    className={styles.heroSecondaryPill}
                  >
                    <span>Open in Execution Studio</span>
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>

              <div className={styles.heroStats}>
                <div className={styles.heroStatTile}>
                  <span className={styles.heroStatValue}>{category.shortTitle}</span>
                  <span className={styles.heroStatLabel}>Lab Track</span>
                </div>
                <div className={styles.heroStatTile}>
                  <span className={styles.heroStatValue}>{runtimeLabel.split(" ")[0]}</span>
                  <span className={styles.heroStatLabel}>Runtime Engine</span>
                </div>
                <div className={styles.heroStatTile}>
                  <span className={styles.heroStatValue}>DOCX</span>
                  <span className={styles.heroStatLabel}>Auto Reports</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Runtime Architecture & Specs Grid */}
        <section aria-labelledby="specs-heading" className={styles.specsSection}>
          <h2 id="specs-heading" className={styles.specsHeading}>
            Runtime Architecture &amp; Specifications
          </h2>
          <div className={styles.specsGrid}>
            {category.environmentSpecs.map((spec, i) => (
              <div key={i} className={styles.specCard}>
                <div className={styles.specLabel}>{spec.label}</div>
                <div className={styles.specValue}>{spec.value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Core Capabilities */}
        <section aria-labelledby="capabilities-heading" className={styles.capabilitiesSection}>
          <h2 id="capabilities-heading" className={styles.specsHeading}>
            Key Track Capabilities
          </h2>
          <div className={styles.capabilitiesGrid}>
            {category.features.map((feat, idx) => (
              <div key={idx} className={styles.capabilityCard}>
                <CheckCircle2
                  size={16}
                  color={category.accentColor}
                  className={styles.capabilityIcon}
                />
                <p className={styles.capabilityText}>{feat}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Multi-part experiments (Social Media Analytics): pick an experiment to launch all of its parts */}
        {category.experiments.some((experiment) => experiment.parts?.length) && (
          <section aria-labelledby="experiments-heading" className={styles.capabilitiesSection}>
            <h2 id="experiments-heading" className={styles.specsHeading}>
              Experiments
            </h2>
            <div className={styles.capabilitiesGrid}>
              {category.experiments.map((experiment) => (
                <div key={experiment.id} className={styles.capabilityCard} style={{ display: "block" }}>
                  <h3 style={{ fontWeight: 600, marginBottom: 4 }}>
                    Experiment {experiment.number}: {experiment.title}
                  </h3>
                  <p className={styles.capabilityText}>{experiment.aim}</p>
                  <ul style={{ margin: "8px 0", paddingLeft: 18, fontSize: 13, opacity: 0.85 }}>
                    {(experiment.parts || []).map((part) => (
                      <li key={part.title}>
                        {part.kind === "code" ? "Code" : part.kind === "evidence" ? "Your screenshots" : "Written answer"}:{" "}
                        {part.title}
                      </li>
                    ))}
                  </ul>
                  {experiment.downloads?.map((name) => (
                    <a
                      key={name}
                      href={`/api/labs/datasets/${name}`}
                      style={{ display: "block", fontSize: 13, textDecoration: "underline" }}
                    >
                      Download practice file: {name}
                    </a>
                  ))}
                  <Link
                    href={`/code-execution?track=${category.track}&exp=${experiment.id}`}
                    className={styles.heroPrimaryPill}
                    style={{ marginTop: 10, display: "inline-flex" }}
                  >
                    <span>Launch experiment {experiment.number}</span>
                    <ArrowRight size={15} />
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Launch Studio Callout */}
        <section className={styles.launchCard}>
          <div className={styles.launchCardContent}>
            <h3>Ready to finish your {category.shortTitle} lab?</h3>
            <p>
              Upload your syllabus or assignment document (.pdf or .docx).
              LabMate automatically reads the questions, runs the code in an
              isolated sandbox, captures high-resolution visual evidence, and
              assembles your finished Word report.
            </p>
          </div>
          <Link
            href={`/code-execution?track=${category.track}`}
            className={styles.heroPrimaryPill}
          >
            <span>Launch {category.shortTitle} Studio</span>
            <ArrowRight size={15} />
          </Link>
        </section>
      </div>
    </DashboardShell>
  );
}
