"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  Play,
  Copy,
  Check,
  ChevronRight,
  ShieldCheck,
  Info,
} from "lucide-react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getLabCategory, type LabExperiment } from "@/lib/labCatalog";
import styles from "../labs.module.css";

const iconMap: Record<string, any> = {
  "deep_learning": Cpu,
  "distributed": Network,
  "python": Terminal,
  "java": FileCode2,
  "cpp": Code2,
  "web": Code2,
  "sql": Database,
  "colab": BookOpen,
};

export default function LabSectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || "";

  const category = useMemo(() => getLabCategory(slug), [slug]);

  const [search, setSearch] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const subcategories = useMemo(() => {
    if (!category) return [];
    const set = new Set<string>();
    category.experiments.forEach((exp) => set.add(exp.category));
    return Array.from(set);
  }, [category]);

  const filteredExperiments = useMemo(() => {
    if (!category) return [];
    return category.experiments.filter((exp) => {
      const matchesSearch =
        search.trim() === "" ||
        exp.title.toLowerCase().includes(search.toLowerCase()) ||
        exp.aim.toLowerCase().includes(search.toLowerCase()) ||
        exp.description.toLowerCase().includes(search.toLowerCase()) ||
        exp.frameworks.some((fw) => fw.toLowerCase().includes(search.toLowerCase()));

      const matchesSub =
        selectedSubcategory === "all" || exp.category === selectedSubcategory;

      return matchesSearch && matchesSub;
    });
  }, [category, search, selectedSubcategory]);

  const copyPrompt = (exp: LabExperiment) => {
    navigator.clipboard.writeText(exp.starterPrompt);
    setCopiedId(exp.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const launchExperiment = (exp: LabExperiment) => {
    const query = new URLSearchParams({
      track: category?.track || "auto",
      prompt: exp.starterPrompt,
      exp: exp.id,
    });
    router.push(`/code-execution?${query.toString()}`);
  };

  if (!category) {
    return (
      <DashboardShell
        title="Lab Section Not Found"
        subtitle="The requested lab category does not exist."
      >
        <div className={styles.container}>
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold text-white mb-4">Lab Category Not Found</h1>
            <p className="text-zinc-400 mb-6">
              Could not find any lab track matching &ldquo;{slug}&rdquo;.
            </p>
            <Link href="/labs" className={styles.primaryBtn}>
              Back to All Lab Sections
            </Link>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const Icon = iconMap[category.track] || Layers;

  return (
    <DashboardShell
      title={category.title}
      subtitle={category.tagline}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={`Search within ${category.shortTitle} experiments...`}
    >
      <div className={styles.container}>
        {/* Breadcrumb Navigation */}
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <span className={styles.breadcrumbSeparator}>/</span>
          <Link href="/labs">Lab Sections</Link>
          <span className={styles.breadcrumbSeparator}>/</span>
          <span className={styles.breadcrumbActive}>{category.title}</span>
        </nav>

        {/* Section Header */}
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <div className="flex items-center gap-3">
              <span
                style={{
                  display: "inline-flex",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  background: `${category.accentColor}20`,
                  border: `1px solid ${category.accentColor}40`,
                }}
              >
                <Icon size={28} color={category.accentColor} />
              </span>
              <h1 className={styles.title}>{category.title}</h1>
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
                <Sparkles size={12} /> {category.badge}
              </span>
            )}
          </div>
          <p className={styles.tagline}>{category.tagline}</p>
          <p className={styles.description}>{category.description}</p>

          {/* Action CTAs */}
          <div className={styles.actionsBar}>
            <Link
              href={`/code-execution?track=${category.track}`}
              className={styles.primaryBtn}
            >
              <UploadCloud size={16} />
              <span>Upload {category.shortTitle} Lab Manual</span>
            </Link>
            <a href="#experiments" className={styles.secondaryBtn}>
              <span>Browse All {category.experiments.length} Experiments</span>
              <ChevronRight size={16} />
            </a>
          </div>
        </header>

        {/* Environment Specs Grid */}
        <section aria-labelledby="specs-heading" className="mb-8">
          <h2 id="specs-heading" className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-3">
            Runtime Architecture &amp; Environment
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

        {/* Experiments Section */}
        <section id="experiments" aria-labelledby="experiments-heading">
          <div className={styles.experimentSectionHeader}>
            <div>
              <h2 id="experiments-heading" className={styles.experimentSectionTitle}>
                Curriculum Experiment Catalog
              </h2>
              <span className={styles.experimentCountBadge}>
                Showing {filteredExperiments.length} of {category.experiments.length} practicals
              </span>
            </div>
          </div>

          {/* Subcategory & Filter Pills */}
          <div className={styles.filterRow}>
            <div className={styles.filterPills}>
              <button
                type="button"
                className={`${styles.filterPill} ${selectedSubcategory === "all" ? styles.filterPillActive : ""}`}
                onClick={() => setSelectedSubcategory("all")}
              >
                All Topics ({category.experiments.length})
              </button>
              {subcategories.map((subcat) => (
                <button
                  key={subcat}
                  type="button"
                  className={`${styles.filterPill} ${selectedSubcategory === subcat ? styles.filterPillActive : ""}`}
                  onClick={() => setSelectedSubcategory(subcat)}
                >
                  {subcat}
                </button>
              ))}
            </div>
            <div className={styles.searchBox}>
              <Search size={15} />
              <input
                type="text"
                placeholder="Search experiments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Experiments List */}
          <div className={styles.experimentList}>
            {filteredExperiments.map((exp) => (
              <article key={exp.id} className={styles.experimentCard}>
                <div className={styles.experimentHeaderRow}>
                  <div className={styles.experimentTitleCol}>
                    <div className={styles.experimentMetaTags}>
                      <span className={styles.expNumberPill}>Exp {exp.number}</span>
                      <span className={styles.expCategoryPill}>{exp.category}</span>
                      <span className={styles.expDifficultyPill}>{exp.difficulty}</span>
                    </div>
                    <h3 className={styles.experimentTitle}>{exp.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyPrompt(exp)}
                      className={styles.secondaryBtn}
                      style={{ padding: "0.45rem 0.75rem", fontSize: "0.8rem" }}
                      title="Copy student prompt to clipboard"
                    >
                      {copiedId === exp.id ? (
                        <>
                          <Check size={13} color="#4ade80" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy Prompt</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => launchExperiment(exp)}
                      className={styles.runLabBtn}
                    >
                      <Play size={13} fill="currentColor" />
                      <span>Run / Solve Lab</span>
                    </button>
                  </div>
                </div>

                {/* Aim */}
                <div className={styles.experimentAimBox}>
                  <span className={styles.experimentAimLabel}>Aim:</span>
                  <span>{exp.aim}</span>
                </div>

                {/* Description */}
                <p className="text-xs text-zinc-400 leading-relaxed mb-2">
                  {exp.description}
                </p>

                {/* Expected Outputs */}
                <div className="mt-3 mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">
                    Expected Report Deliverables
                  </span>
                  <div className="flex flex-col gap-1">
                    {exp.expectedOutputs.map((out, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-xs text-zinc-300">
                        <CheckCircle2 size={12} color="#10b981" className="shrink-0" />
                        <span>{out}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer / Framework Tags */}
                <div className={styles.experimentFooterRow}>
                  <div className={styles.frameworksList}>
                    <span className="text-[11px] text-zinc-500 font-medium">Frameworks:</span>
                    {exp.frameworks.map((fw, idx) => (
                      <span key={idx} className={styles.frameworkTag}>
                        {fw}
                      </span>
                    ))}
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    Target Runtime: <strong className="text-zinc-400 capitalize">{exp.runtime}</strong>
                  </span>
                </div>
              </article>
            ))}

            {filteredExperiments.length === 0 && (
              <div className="text-center py-12 text-zinc-500 text-sm">
                No experiments found matching &ldquo;{search}&rdquo;. Try another search term.
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

