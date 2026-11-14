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
  Sparkles,
  Terminal,
  UploadCloud,
  FileCode2,
  Database,
  Code2,
  BookOpen,
} from "lucide-react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getAllLabCategories, type LabCategory } from "@/lib/labCatalog";
import styles from "./labs.module.css";

const iconMap: Record<string, any> = {
  "deep_learning": Cpu,
  "distributed": Network,
  "python": Terminal,
  "java": FileCode2,
  "cpp": Code2,
  "web": Code2,
  "sql": Database,
  "colab": BookOpen,
  "r": BookOpen,
};

export default function LabsDirectoryPage() {
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");

  const categories = useMemo(() => getAllLabCategories(), []);

  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const matchesSearch =
        search.trim() === "" ||
        cat.title.toLowerCase().includes(search.toLowerCase()) ||
        cat.tagline.toLowerCase().includes(search.toLowerCase()) ||
        cat.description.toLowerCase().includes(search.toLowerCase()) ||
        cat.features.some((f) => f.toLowerCase().includes(search.toLowerCase())) ||
        cat.experiments.some((e) => e.title.toLowerCase().includes(search.toLowerCase()));

      const matchesTag =
        selectedTag === "all" ||
        (selectedTag === "ai" && (cat.track === "deep_learning" || cat.track === "colab")) ||
        (selectedTag === "systems" && (cat.track === "distributed" || cat.track === "java" || cat.track === "cpp")) ||
        (selectedTag === "web" && (cat.track === "web" || cat.track === "sql"));

      return matchesSearch && matchesTag;
    });
  }, [categories, search, selectedTag]);

  return (
    <DashboardShell
      title="Lab Sections & Catalogs"
      subtitle="Dedicated practical environments, curriculum experiment listings, and execution engines"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search lab sections, frameworks, experiments..."
    >
      <div className={styles.container}>
        {/* Navigation Breadcrumb */}
        <div className={styles.breadcrumbs}>
          <Link href="/dashboard">Dashboard</Link>
          <span className={styles.breadcrumbSeparator}>/</span>
          <span className={styles.breadcrumbActive}>Lab Sections</span>
        </div>

        {/* Header */}
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>All Lab Sections</h1>
            <span className={`${styles.badge} ${styles.badgePurple}`}>
              <Sparkles size={12} /> Production Runtimes
            </span>
          </div>
          <p className={styles.tagline}>
            Complete academic coursework suites with real sandbox execution and submission-ready Word reports
          </p>
          <p className={styles.description}>
            Select a specialized lab track to view its comprehensive experiment syllabus, verify required
            frameworks, or launch directly into the automated execution pipeline with your university manual.
          </p>
        </header>

        {/* Filter Pills */}
        <div className={styles.filterRow}>
          <div className={styles.filterPills}>
            <button
              type="button"
              className={`${styles.filterPill} ${selectedTag === "all" ? styles.filterPillActive : ""}`}
              onClick={() => setSelectedTag("all")}
            >
              All Categories ({categories.length})
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
          </div>
          <div className={styles.searchBox}>
            <Search size={15} />
            <input
              type="text"
              placeholder="Filter by keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Categories Grid */}
        <div className={styles.categoryGrid}>
          {filteredCategories.map((category) => {
            const Icon = iconMap[category.track] || Layers;
            const isHighlighted =
              category.track === "deep_learning" || category.track === "distributed";

            return (
              <article
                key={category.slug}
                className={styles.categoryCard}
                style={{
                  borderColor: isHighlighted
                    ? `rgba(${category.track === "deep_learning" ? "168, 85, 247" : "14, 165, 233"}, 0.35)`
                    : undefined,
                }}
              >
                {/* Glow effect for new sections */}
                {isHighlighted && (
                  <div
                    className={styles.cardGlow}
                    style={{
                      background: category.track === "deep_learning" ? "#a855f7" : "#0ea5e9",
                    }}
                  />
                )}

                <div>
                  <div className={styles.categoryCardHeader}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={20} color={category.accentColor} />
                        <h2 className={styles.categoryCardTitle}>{category.title}</h2>
                      </div>
                      <p className={styles.categoryCardTagline}>{category.tagline}</p>
                    </div>
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
                        {category.badge}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                    {category.description}
                  </p>

                  <ul className={styles.categoryCardFeatures}>
                    {category.features.slice(0, 3).map((feat, idx) => (
                      <li key={idx} className={styles.categoryCardFeatureItem}>
                        <CheckCircle2 size={13} color={category.accentColor} className="shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={styles.categoryCardActions}>
                  <Link
                    href={`/labs/${category.slug}`}
                    className={styles.cardPrimaryBtn}
                  >
                    <span>View Experiments ({category.experiments.length})</span>
                    <ArrowRight size={14} />
                  </Link>
                  <Link
                    href={`/code-execution?track=${category.track}`}
                    className={styles.cardSecondaryBtn}
                    title="Directly launch manual processing for this track"
                  >
                    <UploadCloud size={14} />
                    <span>Upload Manual</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}

