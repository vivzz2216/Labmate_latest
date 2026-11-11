"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  Download,
  FileCheck2,
  FileText,
  FolderGit2,
  Layers,
  Loader2,
} from "lucide-react";
import DashboardShell, {
  EmptyState,
  LoadingState,
  StatCard,
  formatDate,
  getLanguage,
} from "@/components/dashboard/DashboardShell";
import dashStyles from "@/app/dashboard/dashboard.module.css";
import { useAuth } from "@/contexts/BasicAuthContext";
import { apiService } from "@/lib/api";
import { errorMessage, saveReport } from "@/lib/workflow";
import styles from "./reports.module.css";

interface Assignment {
  id: number;
  filename?: string;
  original_filename?: string;
  language?: string;
  uploaded_at?: string;
  total_tasks?: number;
  completed_tasks?: number;
  report_id?: number;
  report_filename?: string;
  report_download_url?: string;
}

type LanguageCategory =
  | "all"
  | "python"
  | "java"
  | "webdev"
  | "c_cpp"
  | "sql"
  | "ubuntu";

const LANGUAGE_FILTERS: { id: LanguageCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "webdev", label: "Web Dev" },
  { id: "c_cpp", label: "C / C++" },
  { id: "sql", label: "SQL" },
  { id: "ubuntu", label: "Ubuntu" },
];

function detectCategory(assignment: Assignment): LanguageCategory | "other" {
  const lang = (assignment.language || "").toLowerCase().trim();
  const name = (
    assignment.original_filename ||
    assignment.filename ||
    ""
  ).toLowerCase();

  if (
    lang === "python" ||
    lang === "colab" ||
    /\b(python|colab|ipynb|pandas|numpy|py)\b/.test(name)
  ) {
    return "python";
  }
  if (lang === "java" || /\bjava\b/.test(name)) {
    return "java";
  }
  if (
    lang === "webdev" ||
    lang === "web-dev" ||
    lang === "html" ||
    lang === "react" ||
    lang === "node" ||
    /\b(web|web-dev|webdev|html|css|js|javascript|react|node|frontend)\b/.test(
      name,
    )
  ) {
    return "webdev";
  }
  if (
    lang === "c" ||
    lang === "cpp" ||
    lang === "c++" ||
    /\b(cpp|c\+\+|clang|gcc)\b/.test(name)
  ) {
    return "c_cpp";
  }
  if (lang === "sql" || /\b(sql|mysql|postgres|dbms|database)\b/.test(name)) {
    return "sql";
  }
  if (lang === "ubuntu" || /\b(ubuntu|linux|bash|shell|os)\b/.test(name)) {
    return "ubuntu";
  }
  return "other";
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>(
    () => (apiService.peekUserAssignments(user?.id) as Assignment[]) || [],
  );
  const [loading, setLoading] = useState(
    () => !apiService.peekUserAssignments(user?.id),
  );
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<LanguageCategory>("all");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }

    let active = true;
    const cached = apiService.peekUserAssignments(user.id) as Assignment[] | null;
    if (cached) {
      setAssignments(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError("");
    apiService
      .getUserAssignments(user.id)
      .then((response: any) => {
        const list = Array.isArray(response)
          ? response
          : (response?.assignments ?? response?.data ?? []);
        if (active) setAssignments(Array.isArray(list) ? list : []);
      })
      .catch((cause: any) => {
        if (cause?.response?.status !== 401 && cause?.response?.status !== 403) {
          console.error("Failed to load reports", cause);
        }
        if (active && !cached) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, user?.id, router]);

  const allReports = useMemo(
    () =>
      assignments.filter(
        (assignment) => assignment.report_id || assignment.report_download_url,
      ),
    [assignments],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<LanguageCategory, number> = {
      all: allReports.length,
      python: 0,
      java: 0,
      webdev: 0,
      c_cpp: 0,
      sql: 0,
      ubuntu: 0,
    };
    for (const report of allReports) {
      const cat = detectCategory(report);
      if (cat !== "other") {
        counts[cat] += 1;
      }
    }
    return counts;
  }, [allReports]);

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allReports.filter((assignment) => {
      const cat = detectCategory(assignment);
      if (selectedCategory !== "all" && cat !== selectedCategory) {
        return false;
      }
      if (!query) return true;

      const meta = getLanguage(assignment.language);
      const searchableText = [
        assignment.original_filename || "",
        assignment.filename || "",
        assignment.language || "",
        meta.label,
        cat === "webdev" ? "web-dev webdev web development html css js react" : "",
        cat === "c_cpp" ? "c c++ cpp" : "",
        cat === "python" ? "python py colab notebook" : "",
        cat === "java" ? "java" : "",
        cat === "sql" ? "sql dbms database" : "",
        cat === "ubuntu" ? "ubuntu linux bash shell" : "",
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [allReports, search, selectedCategory]);

  const exercisesDocumented = useMemo(
    () =>
      allReports.reduce(
        (sum, item) => sum + (item.completed_tasks ?? item.total_tasks ?? 0),
        0,
      ),
    [allReports],
  );

  async function download(assignment: Assignment) {
    if (!assignment.report_id) {
      setError(
        "This report is not available for download yet. Refresh and try again.",
      );
      return;
    }
    setDownloadingId(assignment.id);
    setError("");
    try {
      await saveReport(
        assignment.report_id,
        assignment.report_filename ||
        `${assignment.original_filename || assignment.filename || "lab-report"}_completed.docx`,
      );
    } catch (cause) {
      console.error("Failed to download report", cause);
      setError(errorMessage(cause));
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <DashboardShell
      title="Reports"
      subtitle="Download finished Word reports compiled from your lab manuals"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search reports by name or language..."
      lockViewport={true}
    >
      {/* Reports Summary KPI Row */}
      <section className={dashStyles.statsGrid} aria-label="Reports summary">
        <StatCard
          icon={FileCheck2}
          label="Reports Ready"
          value={allReports.length}
          subtext={
            allReports.length > 0
              ? "Formatted .docx documents"
              : "No reports generated yet"
          }
          tone="blue"
        />
        <StatCard
          icon={CheckCircle2}
          label="Exercises Documented"
          value={exercisesDocumented}
          subtext="Verified solutions & outputs"
          tone="green"
        />
        <StatCard
          icon={Layers}
          label="Manuals Tracked"
          value={assignments.length}
          subtext="Total uploaded lab manuals"
          tone="blue"
        />
      </section>

      {/* Main Reports List Panel */}
      <section className={dashStyles.panel} style={{ flex: 1, minHeight: 0 }}>
        <div className={dashStyles.panelHeader}>
          <div>
            <h2>Accredited Lab Records</h2>
            <p>
              {filteredReports.length === allReports.length &&
              selectedCategory === "all" &&
              !search
                ? `${allReports.length} report${allReports.length === 1 ? "" : "s"} available for download`
                : `Showing ${filteredReports.length} of ${allReports.length} reports`}
            </p>
          </div>
          <button
            type="button"
            className={dashStyles.linkButton}
            onClick={() => router.push("/workspace")}
          >
            Inspect in Workspace <ChevronRight size={14} strokeWidth={2.2} />
          </button>
        </div>

        {/* Language / Category Filter Bar */}
        <div
          className={styles.filterBar}
          role="tablist"
          aria-label="Filter reports by language"
        >
          <div className={styles.filterPillsWrap}>
            {LANGUAGE_FILTERS.map((filter) => {
              const active = selectedCategory === filter.id;
              const count = categoryCounts[filter.id];
              return (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`${styles.langFilterBtn} ${active ? styles.langFilterBtnActive : ""}`}
                  onClick={() => setSelectedCategory(filter.id)}
                >
                  <span>{filter.label}</span>
                  <span className={styles.filterCount}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className={dashStyles.dashboardError} role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <LoadingState message="Loading your reports…" />
        ) : filteredReports.length > 0 ? (
          <div className={styles.reportsScrollWrap}>
            {filteredReports.map((assignment) => {
              const filename =
                assignment.original_filename ||
                assignment.filename ||
                "Lab manual";
              const date = formatDate(assignment.uploaded_at);
              const meta = getLanguage(assignment.language);
              const LangIcon = meta.icon;

              return (
                <article className={styles.reportCard} key={assignment.id}>
                  <div className={styles.reportMain}>
                    <div className={styles.fileIcon}>
                      <LangIcon className={meta.className} size={20} />
                    </div>
                    <div className={styles.details}>
                      <div className={styles.titleRow}>
                        <h3 title={filename}>{filename}</h3>
                        <span className={styles.readyBadge}>
                          <CheckCircle2 size={12} /> Ready to download
                        </span>
                      </div>
                      <div className={styles.metaRow}>
                        <span>{meta.label}</span>
                        <span>·</span>
                        <span>
                          {assignment.completed_tasks ??
                            assignment.total_tasks ??
                            0}{" "}
                          exercises completed
                        </span>
                        {date !== "—" && (
                          <>
                            <span>·</span>
                            <span>{date}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={dashStyles.secondaryButton}
                      onClick={() =>
                        router.push(`/workspace?assignment=${assignment.id}`)
                      }
                    >
                      <FolderGit2 size={15} /> Workspace
                    </button>
                    <button
                      type="button"
                      className={dashStyles.primaryButton}
                      onClick={() => download(assignment)}
                      disabled={downloadingId === assignment.id}
                    >
                      {downloadingId === assignment.id ? (
                        <Loader2 className={styles.spin} size={15} />
                      ) : (
                        <Download size={15} />
                      )}
                      {downloadingId === assignment.id
                        ? "Preparing…"
                        : "Download Word"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title={
              search || selectedCategory !== "all"
                ? "No matching reports"
                : "No reports yet"
            }
            description={
              search || selectedCategory !== "all"
                ? "Try selecting 'All' or clearing your search query."
                : "Upload a lab manual and execute it. Your finished Word report will appear here."
            }
            action={
              search || selectedCategory !== "all"
                ? {
                    label: "Reset filters",
                    onClick: () => {
                      setSearch("");
                      setSelectedCategory("all");
                    },
                  }
                : {
                    label: "Upload Assignment",
                    onClick: () => router.push("/code-execution"),
                  }
            }
          />
        )}
      </section>
    </DashboardShell>
  );
}
