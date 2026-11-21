"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronRight, FileText, Layers, Plus, Search, Terminal, Upload } from "lucide-react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import LabIcon from "@/components/labs/LabIcon";
import { getAllLabCategories } from "@/lib/labCatalog";
import { getCategoryCodeStudioHref } from "@/lib/labStudioLaunch";
import styles from "./labsDirectory.module.css";

const runtimeLabelMap: Record<string, string> = {
  deep_learning: "Colab / Jupyter / RStudio",
  distributed: "Java",
  python: "Python",
  java: "Java",
  cpp: "C / C++",
  web: "HTML / React / Node",
  sql: "MySQL",
  colab: "Colab / Jupyter / RStudio",
  ubuntu: "Ubuntu / Bash",
  r: "R / RStudio",
  sma: "Social Media Analytics",
  networks: "Practice studios",
};

const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All Sections" },
  { id: "ai", label: "AI & Data Science" },
  { id: "systems", label: "Systems & Architecture" },
  { id: "web", label: "Web & Databases" },
  { id: "programming", label: "Programming" },
];

function shortBadge(badge?: string) {
  if (!badge) return "";
  if (badge === "Expanded Section") return "Expanded";
  if (badge === "New Dedicated Section") return "New";
  return badge;
}

export default function LabsDirectoryPage() {
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");

  const categories = useMemo(() => getAllLabCategories(), []);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return categories.filter((cat) => {
      const matchesSearch =
        query === "" ||
        cat.title.toLowerCase().includes(query) ||
        cat.tagline.toLowerCase().includes(query) ||
        cat.description.toLowerCase().includes(query) ||
        cat.features.some((f) => f.toLowerCase().includes(query));

      const matchesTag =
        selectedTag === "all" ||
        (selectedTag === "ai" && (cat.track === "deep_learning" || cat.track === "colab" || cat.track === "r")) ||
        (selectedTag === "systems" && (cat.track === "distributed" || cat.track === "ubuntu")) ||
        (selectedTag === "web" && (cat.track === "web" || cat.track === "sql")) ||
        (selectedTag === "programming" && (cat.track === "python" || cat.track === "java" || cat.track === "cpp"));

      return matchesSearch && matchesTag;
    });
  }, [categories, search, selectedTag]);

  return (
    <DashboardShell
      title="Lab Sections & Catalogs"
      subtitle="Upload college lab manuals and generate your practical reports"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search lab sections..."
    >
      <div className={styles.container}>
        <header className={styles.hero}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/dashboard">Dashboard</Link>
            <ChevronRight size={12} aria-hidden="true" />
            <span aria-current="page">Lab Sections</span>
          </nav>

          <div className={styles.heroGrid}>
            <h1 className={styles.title}>All Lab Sections</h1>

            <div className={styles.heroStats} aria-label="Catalog summary">
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>{categories.length}</span>
                <span className={styles.heroStatLabel}>Lab tracks</span>
              </div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>PDF / DOCX</span>
                <span className={styles.heroStatLabel}>Manual formats</span>
              </div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>DOCX</span>
                <span className={styles.heroStatLabel}>Auto reports</span>
              </div>
            </div>

            <div className={styles.heroMeta}>
              <p className={styles.subtitle}>
                Complete academic coursework suites with real sandbox execution and submission-ready reports.
              </p>
              <div className={styles.heroFeatures}>
                <span className={styles.heroFeature}>
                  <Check size={13} aria-hidden="true" /> Structured labs
                </span>
                <span className={styles.heroFeature}>
                  <FileText size={13} aria-hidden="true" /> Auto reports (DOCX)
                </span>
                <span className={styles.heroFeature}>
                  <Terminal size={13} aria-hidden="true" /> Real execution
                </span>
              </div>
            </div>

            <div className={styles.heroActions}>
              <Link href="/code-execution" className={`${styles.btn} ${styles.btnPrimary}`}>
                <Plus size={15} strokeWidth={2.2} aria-hidden="true" />
                <span>Upload Lab Manual</span>
              </Link>
              <a href="#catalog" className={`${styles.btn} ${styles.btnSecondary}`}>
                <span>Browse Catalog</span>
              </a>
            </div>
          </div>
        </header>

        <div id="catalog" className={styles.filterRow}>
          <div className={styles.filterPills} role="group" aria-label="Filter lab categories">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                aria-pressed={selectedTag === filter.id}
                className={`${styles.filterPill} ${selectedTag === filter.id ? styles.filterPillActive : ""}`}
                onClick={() => setSelectedTag(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className={styles.searchBox}>
            <Search size={14} aria-hidden="true" />
            <input
              type="text"
              placeholder="Filter labs..."
              aria-label="Filter labs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filteredCategories.length === 0 ? (
          <div className={styles.empty}>
            <Layers size={26} strokeWidth={1.5} aria-hidden="true" />
            <h3>No matching lab sections</h3>
            <p>Try clearing your search query or switching back to All Sections.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {filteredCategories.map((category) => {
              const badgeText = shortBadge(category.badge);
              const runtimeText = runtimeLabelMap[category.track] || category.defaultLanguage;
              const techLabels = String(runtimeText)
                .split(" / ")
                .map((t) => t.trim())
                .filter(Boolean)
                .slice(0, 3);
              const studioHref = getCategoryCodeStudioHref(category);
              const description = category.description || category.tagline;

              return (
                <article key={category.slug} className={styles.card} data-lab-slug={category.slug}>
                  <div className={styles.cardHead}>
                    <span className={styles.iconTile}>
                      <LabIcon track={category.track} size={22} />
                    </span>
                    <div className={styles.headText}>
                      <h2 className={styles.cardTitle}>{category.title}</h2>
                    </div>
                    {badgeText && <span className={styles.badge}>{badgeText}</span>}
                  </div>

                  <p className={styles.description} title={description}>
                    {description}
                  </p>

                  {category.features?.length > 0 && (
                    <ul className={styles.featureList} aria-label="Supported technologies and capabilities">
                      {category.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className={styles.featureItem} title={feature}>
                          <Check size={13} strokeWidth={2.2} aria-hidden="true" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className={styles.cardBottom}>
                    <div className={styles.chips} aria-label="Environment and report">
                      {techLabels.map((label) => (
                        <span key={label} className={styles.chip}>
                          {label}
                        </span>
                      ))}
                      <span className={styles.chip}>
                        <FileText size={12} aria-hidden="true" />
                        DOCX report
                      </span>
                    </div>

                    <div className={styles.cardActions}>
                      <Link href={`${studioHref}#assignment-setup`} className={`${styles.btn} ${styles.btnSecondary}`}>
                        <Upload size={14} aria-hidden="true" />
                        <span>Upload your manual</span>
                      </Link>
                      <Link href={studioHref} className={`${styles.btn} ${styles.btnPrimary}`}>
                        <span>Open Code Studio</span>
                        <ArrowRight size={14} className={styles.btnArrow} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
