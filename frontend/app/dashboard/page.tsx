"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FolderGit2,
  FileText,
  Plus,
  UploadCloud,
  CheckCircle2,
  ChevronRight,
  Download,
  Layers,
  ArrowUpRight,
  FileCheck2,
  Sparkles,
} from "lucide-react";
import DashboardShell, {
  type Assignment,
  EmptyState,
  LoadingState,
  StatCard,
  formatDate,
  getLanguage,
  getProgress,
} from "@/components/dashboard/DashboardShell";
import { useAuth } from "@/contexts/BasicAuthContext";
import { apiService } from "@/lib/api";
import { errorMessage, saveReport } from "@/lib/workflow";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const router = useRouter();
  const {
    user,
    loading: authLoading,
  } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>(
    () => (apiService.peekUserAssignments(user?.id) as Assignment[]) || [],
  );
  const [loading, setLoading] = useState(
    () => !apiService.peekUserAssignments(user?.id),
  );
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("all");

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      if (!user) {
        router.replace("/");
        return;
      }

      const cached = apiService.peekUserAssignments(user.id) as Assignment[] | null;
      if (cached) {
        setAssignments(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setLoadError("");

      try {
        const response = await apiService.getUserAssignments(user.id);
        if (!active) return;

        const list = Array.isArray(response)
          ? response
          : ((response as any)?.assignments ?? (response as any)?.data ?? []);

        setAssignments(Array.isArray(list) ? list : []);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
        if (active && !cached) {
          setAssignments([]);
          setLoadError(
            "We couldn't load your lab manuals. Please refresh the page and try again.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    if (!authLoading) {
      loadDashboard();
    }

    return () => {
      active = false;
    };
  }, [authLoading, router, user?.id]);

  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assignments.filter((a) => {
      const matchesQuery = !query
        ? true
        : `${a.original_filename || a.filename} ${a.language || ""}`
            .toLowerCase()
            .includes(query);
      if (!matchesQuery) return false;
      const progress = getProgress(a);
      if (statusFilter === "active") return progress < 100;
      if (statusFilter === "completed") return progress >= 100;
      return true;
    });
  }, [assignments, search, statusFilter]);

  const totalQuestions = assignments.reduce(
    (sum, assignment) => sum + (assignment.total_tasks || 0),
    0,
  );
  const questionsSolved = assignments.reduce(
    (sum, assignment) => sum + (assignment.completed_tasks || 0),
    0,
  );
  const completionRate =
    totalQuestions > 0 ? Math.round((questionsSolved / totalQuestions) * 100) : 0;

  const reportsReady = assignments.filter((a) =>
    Boolean(a.report_download_url || a.report_id),
  ).length;
  const activeLabs = assignments.filter((a) => getProgress(a) < 100).length;
  const continuedLab = assignments.find((a) => getProgress(a) < 100);
  const reports = assignments
    .filter((a) => a.report_download_url || a.report_id)
    .slice(0, 6);
  const displayName = user?.name?.trim() || "Student";

  const go = (href: string) => {
    router.push(href);
  };

  return (
    <>
      <DashboardShell
        title="Dashboard"
        subtitle="Overview of your lab manuals, execution progress, and reports"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search labs, languages, reports..."
        lockViewport={true}
      >
        {/* Streamlined Command Banner */}
        <section className={styles.welcomeCard}>
          <div className={styles.welcomeCopy}>
            <span className={styles.welcomeEyebrow}>
              <Sparkles size={13} /> Lab Intelligence Studio
            </span>
            <h2>
              Welcome back, <span>{displayName}</span>
            </h2>
            <p>
              {assignments.length === 0
                ? "Upload a syllabus PDF or Word lab manual to extract questions, run verified solutions, and export a formatted report."
                : `You have ${activeLabs} active lab${activeLabs === 1 ? "" : "s"} in progress and ${reportsReady} accredited Word report${reportsReady === 1 ? "" : "s"} ready for submission.`}
            </p>
          </div>
          <div className={styles.welcomeActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => go("/code-execution")}
            >
              <UploadCloud size={16} strokeWidth={2} /> Upload Assignment
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => go("/workspace")}
            >
              <FolderGit2 size={16} strokeWidth={1.8} /> Open Workspace
            </button>
          </div>
        </section>

        {/* Workspace Totals Grid */}
        <section className={styles.statsGrid} aria-label="Workspace totals">
          <StatCard
            icon={Layers}
            label="Active Labs"
            value={activeLabs}
            subtext={
              assignments.length === 0
                ? "No manuals uploaded yet"
                : `${assignments.length} total manual${assignments.length === 1 ? "" : "s"} tracked`
            }
            tone="blue"
          />
          <StatCard
            icon={CheckCircle2}
            label="Questions Solved"
            value={questionsSolved}
            subtext={
              totalQuestions > 0
                ? `${completionRate}% completion (${questionsSolved}/${totalQuestions})`
                : "Across your lab manuals"
            }
            tone="green"
          />
          <StatCard
            icon={FileCheck2}
            label="Reports Ready"
            value={reportsReady}
            subtext={
              reportsReady > 0
                ? "Accredited .docx ready to export"
                : "Complete a lab to generate"
            }
            tone="blue"
          />
        </section>

        {/* Split Content Layout */}
        <div className={styles.dashboardGrid}>
          {/* Left Panel: Recent Labs with Independent Vertical Scroll */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Recent Lab Assignments</h2>
                <p>
                  {filteredAssignments.length === assignments.length
                    ? `${assignments.length} total manuals tracked`
                    : `Showing ${filteredAssignments.length} of ${assignments.length} manuals`}
                </p>
              </div>
              <div className={styles.panelHeaderControls}>
                {assignments.length > 0 && (
                  <div
                    className={styles.filterGroup}
                    role="group"
                    aria-label="Filter assignments by status"
                  >
                    <button
                      type="button"
                      className={`${styles.filterPill} ${statusFilter === "all" ? styles.filterPillActive : ""}`}
                      onClick={() => setStatusFilter("all")}
                    >
                      All ({assignments.length})
                    </button>
                    <button
                      type="button"
                      className={`${styles.filterPill} ${statusFilter === "active" ? styles.filterPillActive : ""}`}
                      onClick={() => setStatusFilter("active")}
                    >
                      In Progress ({activeLabs})
                    </button>
                    <button
                      type="button"
                      className={`${styles.filterPill} ${statusFilter === "completed" ? styles.filterPillActive : ""}`}
                      onClick={() => setStatusFilter("completed")}
                    >
                      Done ({assignments.length - activeLabs})
                    </button>
                  </div>
                )}
                {assignments.length > 0 && (
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => go("/code-execution")}
                  >
                    Open Studio <ChevronRight size={14} strokeWidth={2.2} />
                  </button>
                )}
              </div>
            </div>

            {loadError && (
              <p role="alert" className={styles.dashboardError}>
                {loadError}
              </p>
            )}
            {loading ? (
              <LoadingState />
            ) : filteredAssignments.length === 0 ? (
              <EmptyState
                icon={FolderGit2}
                title={
                  search || statusFilter !== "all"
                    ? "No matching labs"
                    : "No labs yet"
                }
                description={
                  search || statusFilter !== "all"
                    ? "Try clearing your search or switching the status filter."
                    : "Upload your first department lab manual to begin."
                }
                action={
                  !search && statusFilter === "all"
                    ? {
                        label: "Upload assignment",
                        onClick: () => go("/code-execution"),
                      }
                    : {
                        label: "Reset filters",
                        onClick: () => {
                          setSearch("");
                          setStatusFilter("all");
                        },
                      }
                }
              />
            ) : (
              <LabTable
                assignments={filteredAssignments}
                onOpen={(id) => go(`/code-execution?assignment=${id}`)}
              />
            )}
          </section>

          {/* Right Rail: Continue Working & Recent Reports */}
          <aside className={styles.rightRail}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Continue Working</h2>
                  <p>
                    {continuedLab
                      ? "Pick up right where you left off."
                      : "Active labs in progress appear here."}
                  </p>
                </div>
              </div>

              {continuedLab ? (
                <ContinueCard
                  assignment={continuedLab}
                  onOpen={() =>
                    go(`/code-execution?assignment=${continuedLab.id}`)
                  }
                />
              ) : (
                <EmptyState
                  compact
                  icon={Plus}
                  title="All labs completed"
                  description="Upload a new lab assignment to continue."
                  action={{
                    label: "Upload Lab",
                    onClick: () => go("/code-execution"),
                  }}
                />
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Recent Reports</h2>
                  <p>{reportsReady} accredited documents ready</p>
                </div>
                {reportsReady > 0 && (
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => go("/reports")}
                  >
                    View all <ChevronRight size={14} strokeWidth={2.2} />
                  </button>
                )}
              </div>

              {reports.length === 0 ? (
                <EmptyState
                  compact
                  icon={FileText}
                  title="No reports generated"
                  description="Completed lab records will appear here for download."
                />
              ) : (
                <ReportList reports={reports} />
              )}
            </section>
          </aside>
        </div>
      </DashboardShell>
    </>
  );
}

function LabTable({
  assignments,
  onOpen,
}: {
  assignments: Assignment[];
  onOpen: (id: number) => void;
}) {
  return (
    <div className={styles.tableWrap} role="region" aria-label="Recent lab assignments list" tabIndex={0}>
      <div className={styles.tableHead}>
        <span>Lab / Language</span>
        <span>Questions</span>
        <span>Progress</span>
        <span>Updated</span>
        <span style={{ textAlign: "right" }}>Action</span>
      </div>
      {assignments.map((assignment) => {
        const meta = getLanguage(assignment.language);
        const Icon = meta.icon;
        const progress = getProgress(assignment);
        return (
          <button
            type="button"
            className={styles.labRow}
            key={assignment.id}
            onClick={() => onOpen(assignment.id)}
          >
            <span className={styles.labName}>
              <span className={styles.labIcon}>
                <Icon className={meta.className} size={19} />
              </span>
              <span>
                <strong>
                  {assignment.original_filename || assignment.filename}
                </strong>
                <small>{meta.label}</small>
              </span>
            </span>
            <span>
              {assignment.completed_tasks} / {assignment.total_tasks}
            </span>
            <span className={styles.progressCell}>
              <span
                className={`${styles.progressTrack} ${progress >= 100 ? styles.progressComplete : ""}`}
              >
                <span style={{ width: `${progress}%` }} />
              </span>
              <small>{progress}%</small>
            </span>
            <span>{formatDate(assignment.uploaded_at)}</span>
            <span className={styles.rowAction}>
              <span className={styles.rowActionBtn}>
                Open <ArrowUpRight size={13} strokeWidth={2.2} />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ContinueCard({
  assignment,
  onOpen,
}: {
  assignment: Assignment;
  onOpen: () => void;
}) {
  const meta = getLanguage(assignment.language);
  const Icon = meta.icon;
  const progress = getProgress(assignment);
  return (
    <div className={styles.continueCard}>
      <div className={styles.continueTitle}>
        <Icon className={meta.className} size={20} />
        <strong>{assignment.original_filename || assignment.filename}</strong>
        <span>{meta.label}</span>
      </div>
      <p>
        {assignment.completed_tasks} of {assignment.total_tasks} questions
        completed
      </p>
      <span className={styles.progressTrack}>
        <span style={{ width: `${progress}%` }} />
      </span>
      <div className={styles.continueFooter}>
        <span>{progress}% complete</span>
        <button type="button" onClick={onOpen}>
          Continue lab <ChevronRight size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

function ReportList({ reports }: { reports: Assignment[] }) {
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState<number | null>(null);

  const download = async (report: Assignment) => {
    if (!report.report_id) return;
    setDownloading(report.id);
    setDownloadError("");
    try {
      await saveReport(
        report.report_id,
        report.report_filename || "lab_report.docx",
      );
    } catch (error) {
      setDownloadError(errorMessage(error));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className={styles.reportList}>
      {downloadError && <p role="alert" className={styles.dashboardError}>{downloadError}</p>}
      {reports.map((report) => (
        <div className={styles.reportRow} key={report.id}>
          <span className={styles.reportIcon}>
            <FileText size={16} strokeWidth={1.8} />
          </span>
          <span>
            <strong>{report.original_filename || report.filename}</strong>
            <small>Ready · {formatDate(report.uploaded_at)}</small>
          </span>
          {(report.report_download_url || report.report_id) && (
            <button
              type="button"
              className={styles.downloadBtn}
              onClick={() => download(report)}
              disabled={downloading === report.id || !report.report_id}
              title={`Download ${report.original_filename || report.filename}`}
              aria-label={`Download ${report.original_filename || report.filename}`}
            >
              <Download size={15} strokeWidth={2} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
