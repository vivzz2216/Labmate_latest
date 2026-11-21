"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Layers,
  ArrowRight,
  Cpu,
  Network,
  CheckCircle2,
  Search,
  Terminal,
  FileCode2,
  Database,
  Code2,
  BookOpen,
  FileText,
  FlaskConical,
  Plus,
  ChevronRight,
} from "lucide-react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getAllLabCategories } from "@/lib/labCatalog";
import styles from "./labs.module.css";

const iconMap: Record<string, any> = {
  deep_learning: Cpu,
  distributed: Network,
  python: Terminal,
  java: FileCode2,
  cpp: Code2,
  web: Code2,
  sql: Database,
  colab: BookOpen,
  ubuntu: Terminal,
  r: BookOpen,
  sma: Network,
  networks: Network,
};

const runtimeLabelMap: Record<string, string> = {
  deep_learning: "PyTorch / TensorFlow",
  distributed: "Java",
  python: "Python",
  java: "Java",
  cpp: "C / C++",
  web: "HTML / React / Node",
  sql: "MySQL",
  colab: "Jupyter / Colab",
  ubuntu: "Ubuntu / Bash",
  r: "R / RStudio",
  sma: "Social Media Analytics",
  networks: "Practice studios",
};

const practiceStudios = [
  { name: "Cisco Packet Tracer", href: "/networks/packet-tracer", description: "Build topologies and trace packets through your network." },
  { name: "Wireshark", href: "/networks/wireshark", description: "Open packet captures, apply filters, and inspect protocol details." },
  { name: "Power BI", href: "/power-bi", description: "Import data, build reports, and calculate DAX measures." },
  { name: "Android Studio", href: "/android-studio", description: "Edit Android projects and run activities in a browser device preview." },
];

function badgeClass(track: string) {
  if (track === "deep_learning") return styles.badgePurple;
  if (track === "distributed") return styles.badgeSky;
  if (track === "python" || track === "colab") return styles.badgeEmerald;
  return "";
}

function shortBadge(badge?: string) {
  if (!badge) return "";
  if (badge === "Expanded Section") return "Expanded";
  return badge;
}

export default function LabsDirectoryPage() {
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");

  const categories = useMemo(() => getAllLabCategories(), []);
  const visibleStudios = selectedTag === "all" || selectedTag === "systems"
    ? practiceStudios.filter(studio => `${studio.name} ${studio.description}`.toLowerCase().includes(search.trim().toLowerCase()))
    : [];

  const totalExperiments = useMemo(
    () => categories.reduce((sum, cat) => sum + cat.experiments.length, 0),
    [categories],
  );

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return categories.filter((cat) => {
      const matchesSearch =
        query === "" ||
        cat.title.toLowerCase().includes(query) ||
        cat.tagline.toLowerCase().includes(query) ||
        cat.description.toLowerCase().includes(query) ||
        cat.features.some((f) => f.toLowerCase().includes(query)) ||
        cat.experiments.some((e) => e.title.toLowerCase().includes(query));

      const matchesTag =
        selectedTag === "all" ||
        (selectedTag === "ai" &&
          (cat.track === "deep_learning" || cat.track === "colab" || cat.track === "r")) ||
        (selectedTag === "systems" &&
          (cat.track === "distributed" || cat.track === "ubuntu")) ||
        (selectedTag === "web" &&
          (cat.track === "web" || cat.track === "sql")) ||
        (selectedTag === "programming" &&
          (cat.track === "python" ||
            cat.track === "java" ||
            cat.track === "cpp"));

      return matchesSearch && matchesTag;
    });
  }, [categories, search, selectedTag]);

  return (
    <DashboardShell
      title="Lab Sections & Catalogs"
      subtitle="Dedicated practical environments, curriculum experiment listings, and execution engines"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search labs, experiments, frameworks..."
    >
      <div className={styles.container}>
        {/* Cosmic Hero Banner */}
        <header className={styles.heroBanner}>
          <div className={styles.heroArc} aria-hidden="true" />
          <div className={styles.heroInner}>
            <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
              <Link href="/dashboard">Dashboard</Link>
              <ChevronRight size={13} className={styles.breadcrumbSeparator} />
              <span className={styles.breadcrumbActive}>Lab Sections</span>
            </nav>

            <div className={styles.heroGrid}>
              <div className={styles.heroContent}>
                <div className={styles.titleRow}>
                  <h1 className={styles.title}>All Lab Sections</h1>
                </div>
                <p className={styles.heroSubtitle}>
                  Complete academic coursework suites with real sandbox execution
                  and submission-ready reports.
                </p>

                <div className={styles.heroFeaturesRow}>
                  <span className={styles.heroFeatureItem}>
                    <CheckCircle2 size={15} /> Structured labs
                  </span>
                  <span className={styles.heroFeatureItem}>
                    <Layers size={15} /> Auto reports (DOCX)
                  </span>
                  <span className={styles.heroFeatureItem}>
                    <Terminal size={15} /> Real execution
                  </span>
                </div>

                <div className={styles.actionsBar}>
                  <Link
                    href="/code-execution"
                    className={styles.heroPrimaryPill}
                  >
                    <Plus size={15} strokeWidth={2.4} />
                    <span>Upload Lab Manual</span>
                  </Link>
                  <a href="#catalog" className={styles.heroSecondaryPill}>
                    <span>Browse Catalog</span>
                  </a>
                </div>
              </div>

              <div className={styles.heroStats}>
                <div className={styles.heroStatTile}>
                  <span className={styles.heroStatValue}>
                    {categories.length}
                  </span>
                  <span className={styles.heroStatLabel}>Lab Tracks</span>
                </div>
                <div className={styles.heroStatTile}>
                  <span className={styles.heroStatValue}>
                    {totalExperiments}
                  </span>
                  <span className={styles.heroStatLabel}>Experiments</span>
                </div>
                <div className={styles.heroStatTile}>
                  <span className={styles.heroStatValue}>DOCX</span>
                  <span className={styles.heroStatLabel}>Auto Reports</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Filter Toolbar */}
        <div id="catalog" className={styles.filterRow}>
          <div
            className={styles.filterPills}
            role="group"
            aria-label="Filter lab categories"
          >
            <button
              type="button"
              className={`${styles.filterPill} ${selectedTag === "all" ? styles.filterPillActive : ""}`}
              onClick={() => setSelectedTag("all")}
            >
              All Sections
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${selectedTag === "ai" ? styles.filterPillActive : ""}`}
              onClick={() => setSelectedTag("ai")}
            >
              AI &amp; Data Science
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${selectedTag === "systems" ? styles.filterPillActive : ""}`}
              onClick={() => setSelectedTag("systems")}
            >
              Systems &amp; Architecture
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${selectedTag === "web" ? styles.filterPillActive : ""}`}
              onClick={() => setSelectedTag("web")}
            >
              Web &amp; Databases
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${selectedTag === "programming" ? styles.filterPillActive : ""}`}
              onClick={() => setSelectedTag("programming")}
            >
              Programming
            </button>
          </div>

          <div className={styles.searchBox}>
            <Search size={14} />
            <input
              type="text"
              placeholder="Filter labs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {visibleStudios.length > 0 && (
          <section aria-labelledby="practice-studios-title" style={{ marginBlock: "1.5rem" }}>
            <h2 id="practice-studios-title" className={styles.categoryCardTitle}>Practice workspaces</h2>
            <div className={styles.categoryGrid} style={{ marginTop: ".75rem" }}>
              {visibleStudios.map(studio => (
                <Link key={studio.href} href={studio.href} className={styles.categoryCard}>
                  <h3 className={styles.categoryCardTitle}>{studio.name}</h3>
                  <p className={styles.categoryCardTagline}>{studio.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
        {/* 3-Column Minimalist Cards Grid */}
        {filteredCategories.length === 0 && visibleStudios.length === 0 ? (
          <div className={styles.emptyFilterState}>
            <Layers size={28} />
            <h3>No matching lab sections</h3>
            <p>
              Try clearing your search query or switching back to All Sections.
            </p>
          </div>
        ) : (
          <div className={styles.categoryGrid}>
            {filteredCategories.map((category) => {
              const Icon = iconMap[category.track] || Layers;
              const badgeText = shortBadge(category.badge);
              const runtimeText =
                runtimeLabelMap[category.track] || category.defaultLanguage;

              return (
                <Link
                  key={category.slug}
                  href={`/labs/${category.slug}`}
                  className={styles.categoryCard}
                >
                  <div>
                    <div className={styles.categoryCardTop}>
                      <span
                        className={styles.categoryIconWrap}
                        style={{
                          background: `${category.accentColor}20`,
                          border: `1px solid ${category.accentColor}38`,
                        }}
                      >
                        <Icon size={19} color={category.accentColor} />
                      </span>

                      {badgeText && (
                        <span
                          className={`${styles.badge} ${badgeClass(category.track)}`}
                        >
                          {badgeText}
                        </span>
                      )}
                    </div>

                    <h2 className={styles.categoryCardTitle}>
                      {category.title}
                    </h2>
                    <p className={styles.categoryCardTagline}>
                      {category.tagline}
                    </p>
                  </div>

                  <div className={styles.categoryCardFooter}>
                    <div className={styles.cardMetaRow}>
                      <span className={styles.cardMetaItem}>
                        <FlaskConical size={13} />
                        {category.experiments.length} Experiments
                      </span>
                      <span className={styles.cardMetaItem}>
                        <BookOpen size={13} />
                        {runtimeText}
                      </span>
                      <span className={styles.cardMetaItem}>
                        <FileText size={13} />
                        DOCX Reports
                      </span>
                    </div>

                    <span className={styles.cardArrowBtn} aria-hidden="true">
                      <ArrowRight size={15} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
