"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderGit2,
  Terminal,
  FileText,
  Settings,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  UploadCloud,
  X,
  CheckCircle2,
  ChevronRight,
  Download,
  Bell,
  Sun,
  Moon,
  Layers,
  ArrowUpRight,
  FileCheck2,
} from "lucide-react";
import { SiC, SiCplusplus, SiHtml5, SiPython } from "react-icons/si";
import { FaJava } from "react-icons/fa";
import LabMateLogo from "@/components/brand/LabMateLogo";
import UserOnboarding from "@/components/auth/UserOnboarding";
import { useAuth } from "@/contexts/BasicAuthContext";
import { apiService } from "@/lib/api";
import { errorMessage, saveReport } from "@/lib/workflow";
import styles from "./dashboard.module.css";

interface Assignment {
  id: number;
  filename: string;
  original_filename: string;
  language?: string;
  uploaded_at: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  in_progress_tasks: number;
  report_download_url?: string;
  report_id?: number;
  report_filename?: string;
}

const DEMO_ASSIGNMENTS: Assignment[] = [
  {
    id: 1,
    filename: "Data_Structures_Lab_Manual.pdf",
    original_filename: "Data_Structures_Lab_Manual.pdf",
    language: "python",
    uploaded_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    total_tasks: 12,
    completed_tasks: 12,
    failed_tasks: 0,
    in_progress_tasks: 0,
    report_download_url: "/api/reports/1/download",
    report_id: 1,
    report_filename: "Data_Structures_Lab_Report.docx",
  },
  {
    id: 2,
    filename: "Operating_Systems_Process_Scheduling.pdf",
    original_filename: "Operating_Systems_Process_Scheduling.pdf",
    language: "c",
    uploaded_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    total_tasks: 8,
    completed_tasks: 6,
    failed_tasks: 0,
    in_progress_tasks: 2,
    report_download_url: "",
  },
  {
    id: 3,
    filename: "Object_Oriented_Programming_Java.pdf",
    original_filename: "Object_Oriented_Programming_Java.pdf",
    language: "java",
    uploaded_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    total_tasks: 10,
    completed_tasks: 10,
    failed_tasks: 0,
    in_progress_tasks: 0,
    report_download_url: "/api/reports/3/download",
    report_id: 3,
    report_filename: "Java_OOP_Accredited_Manual.docx",
  },
];

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Workspace", icon: FolderGit2, href: "/workspace" },
  { label: "My Labs", icon: Terminal, href: "/code-execution" },
  { label: "Reports", icon: FileText, href: "/reports" },
  { label: "Settings", icon: Settings, href: "/user-dashboard?tab=settings" },
];

const languageMeta: Record<
  string,
  { label: string; icon: any; className: string }
> = {
  python: { label: "Python", icon: SiPython, className: styles.python },
  java: { label: "Java", icon: FaJava, className: styles.java },
  c: { label: "C", icon: SiC, className: styles.c },
  cpp: { label: "C++", icon: SiCplusplus, className: styles.cpp },
  webdev: { label: "Web Development", icon: SiHtml5, className: styles.html },
  html: { label: "Web Development", icon: SiHtml5, className: styles.html },
};

function Brand({ theme }: { theme: "dark" | "light" }) {
  return (
    <Link href="/" className={styles.brand} aria-label="LabMate Home">
      <LabMateLogo size="sm" theme={theme} />
    </Link>
  );
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function getLanguage(language?: string) {
  return (
    languageMeta[language || ""] || {
      label: language || "Not specified",
      icon: FileText,
      className: styles.fileIcon,
    }
  );
}

function getProgress(assignment: Assignment) {
  return assignment.total_tasks
    ? Math.min(
        100,
        Math.round((assignment.completed_tasks / assignment.total_tasks) * 100),
      )
    : 0;
}

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    user,
    checkProfileComplete,
    signOut,
    loading: authLoading,
  } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dual Theme State: "dark" (Runway-grade homepage aesthetic) & "light" (classic light theme)
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    // Read saved theme or default to "dark" matching homepage
    const saved = localStorage.getItem("labmate_dashboard_theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("labmate_dashboard_theme", nextTheme);
  };

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      try {
        if (!user) {
          // If not logged in yet, show preview data so dashboard can be tested seamlessly
          if (active) {
            setAssignments(DEMO_ASSIGNMENTS);
            setLoading(false);
          }
          return;
        }

        const profileComplete = await checkProfileComplete();
        if (active) setShowOnboarding(!profileComplete);

        const response: any = await apiService.getUserAssignments(user.id);
        const list = Array.isArray(response)
          ? response
          : (response?.assignments ?? response?.data ?? []);
        
        if (active) {
          if (Array.isArray(list) && list.length > 0) {
            setAssignments(list);
          } else {
            // If user has 0 assignments, fallback to demo assignments for a populated preview
            setAssignments(DEMO_ASSIGNMENTS);
          }
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
        if (active) setAssignments(DEMO_ASSIGNMENTS);
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
  }, [authLoading, checkProfileComplete, user]);

  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? assignments.filter((a) =>
          `${a.original_filename || a.filename} ${a.language || ""}`
            .toLowerCase()
            .includes(query),
        )
      : assignments;
  }, [assignments, search]);

  const questionsSolved = assignments.reduce(
    (sum, assignment) => sum + (assignment.completed_tasks || 0),
    0,
  );
  const reportsReady = assignments.filter((a) =>
    Boolean(a.report_download_url),
  ).length;
  const activeLabs = assignments.filter((a) => getProgress(a) < 100).length;
  const continuedLab = assignments.find((a) => getProgress(a) < 100);
  const reports = assignments.filter((a) => a.report_download_url).slice(0, 4);
  const displayName = user?.name?.trim() || "Student";

  const go = (href: string) => {
    setMobileNavOpen(false);
    router.push(href);
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <>
      <UserOnboarding
        isOpen={showOnboarding}
        onComplete={async () => {
          await checkProfileComplete();
          setShowOnboarding(false);
        }}
      />
      <div className={styles.shell} data-theme={theme}>
        {/* Subtle Ambient Radial Glow (Runway Homepage Style) */}
        <div className={styles.ambientGlow} />

        {/* Sidebar */}
        <aside
          className={`${styles.sidebar} ${mobileNavOpen ? styles.sidebarOpen : ""}`}
        >
          <div className={styles.sidebarTop}>
            <Brand theme={theme} />
            <button
              className={styles.mobileClose}
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
          </div>

          <nav className={styles.sidebarNav} aria-label="Dashboard navigation">
            {navItems.map(({ label, icon: Icon, href }) => {
              const active =
                href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname?.startsWith(href.split("?")[0]);
              return (
                <button
                  key={label}
                  className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                  onClick={() => go(href)}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          <div className={styles.sidebarBottom}>
            <button className={styles.signOut} onClick={handleLogout}>
              <LogOut size={16} strokeWidth={1.8} /> Sign out
            </button>
            <div className={styles.account} onClick={() => go("/user-dashboard")}>
              <span className={styles.accountAvatar}>
                {displayName.charAt(0).toUpperCase()}
              </span>
              <span className={styles.accountText}>
                <strong>{displayName}</strong>
                <small>{user?.email || "Student Account"}</small>
              </span>
              <ChevronRight size={15} strokeWidth={2} />
            </div>
          </div>
        </aside>

        {mobileNavOpen && (
          <button
            className={styles.scrim}
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation overlay"
          />
        )}

        <section className={styles.content}>
          {/* Topbar */}
          <header className={styles.topbar}>
            <div className={styles.topbarTitle}>
              <button
                className={styles.mobileMenu}
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
              >
                <Menu size={20} />
              </button>
              <h1>Dashboard</h1>
            </div>

            <div className={styles.topbarActions}>
              <label className={styles.search}>
                <Search size={16} strokeWidth={1.8} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search labs, reports..."
                  aria-label="Search labs and reports"
                />
              </label>

              {/* Theme Toggle Button */}
              <button
                className={styles.themeToggle}
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme (Homepage Style)"}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <>
                    <Sun size={15} strokeWidth={2} />
                    <span>Light</span>
                  </>
                ) : (
                  <>
                    <Moon size={15} strokeWidth={2} />
                    <span>Dark</span>
                  </>
                )}
              </button>

              <button
                className={styles.notification}
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell size={17} strokeWidth={1.8} />
              </button>

              <span className={styles.topAvatar}>
                {displayName.charAt(0).toUpperCase()}
              </span>
              <strong className={styles.topName}>{displayName}</strong>
              <ChevronRight className={styles.topChevron} size={15} strokeWidth={2} />
            </div>
          </header>

          {/* Main Dashboard Canvas */}
          <main className={styles.main}>
            {/* Welcome Banner Card */}
            <section className={styles.welcomeCard}>
              <div className={styles.welcomeCopy}>
                <h2>
                  Welcome back, <span>{displayName}</span>
                </h2>
                <p>
                  Upload syllabus PDFs or lab manuals to decompose problem statements, compile deterministic solutions, and export accredited Word records.
                </p>
                <div className={styles.welcomeActions}>
                  <button
                    className={styles.primaryButton}
                    onClick={() => go("/code-execution")}
                  >
                    <UploadCloud size={17} strokeWidth={2} /> Upload Assignment
                  </button>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => go("/reports")}
                  >
                    <FileText size={17} strokeWidth={1.8} /> View Reports
                  </button>
                </div>
              </div>
            </section>

            {/* Workspace Totals Grid */}
            <section className={styles.statsGrid} aria-label="Workspace totals">
              <StatCard
                icon={Layers}
                label="Active Labs"
                value={activeLabs}
                tone="blue"
              />
              <StatCard
                icon={CheckCircle2}
                label="Questions Solved"
                value={questionsSolved}
                tone="green"
              />
              <StatCard
                icon={FileCheck2}
                label="Reports Ready"
                value={reportsReady}
                tone="blue"
              />
            </section>

            {/* Split Content Layout */}
            <div className={styles.dashboardGrid}>
              {/* Left Panel: Recent Labs */}
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2>Recent Lab Assignments</h2>
                    <p>{assignments.length} total manuals tracked</p>
                  </div>
                  {assignments.length > 0 && (
                    <button
                      className={styles.linkButton}
                      onClick={() => go("/code-execution")}
                    >
                      View all <ChevronRight size={14} strokeWidth={2.2} />
                    </button>
                  )}
                </div>

                {loading ? (
                  <LoadingState />
                ) : filteredAssignments.length === 0 ? (
                  <EmptyState
                    icon={FolderGit2}
                    title={search ? "No matching labs" : "No labs yet"}
                    description={
                      search
                        ? "Try a different search query."
                        : "Upload your first department lab manual to begin."
                    }
                    action={
                      !search
                        ? {
                            label: "Upload assignment",
                            onClick: () => go("/code-execution"),
                          }
                        : undefined
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
          </main>
        </section>
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone: "blue" | "green";
}) {
  return (
    <article className={styles.statCard}>
      <span
        className={`${styles.statIcon} ${tone === "green" ? styles.statGreen : styles.statBlue}`}
      >
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{value === 0 ? "No activity yet" : "From university cohort"}</small>
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.spinner} />
      <p>Loading your lab manuals...</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: any;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  compact?: boolean;
}) {
  return (
    <div
      className={`${styles.emptyState} ${compact ? styles.emptyCompact : ""}`}
    >
      <span className={styles.emptyIcon}>
        <Icon size={compact ? 20 : 26} strokeWidth={1.8} />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action && (
        <button className={styles.emptyAction} onClick={action.onClick}>
          <Plus size={14} strokeWidth={2} /> {action.label}
        </button>
      )}
    </div>
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
    <div className={styles.tableWrap}>
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
            className={styles.labRow}
            key={assignment.id}
            onClick={() => onOpen(assignment.id)}
          >
            <span className={styles.labName}>
              <span className={styles.labIcon}>
                <Icon className={meta.className} size={20} />
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
              <span className={styles.progressTrack}>
                <span style={{ width: `${progress}%` }} />
              </span>
              <small>{progress}%</small>
            </span>
            <span>{formatDate(assignment.uploaded_at)}</span>
            <span className={styles.rowAction}>
              <span className={styles.rowActionBtn}>
                Open <ArrowUpRight size={13} strokeWidth={2.2} />
              </span>
              <MoreHorizontal size={16} strokeWidth={1.8} />
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
        <Icon className={meta.className} size={22} />
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
        <button onClick={onOpen}>
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
      {downloadError && <p role="alert">{downloadError}</p>}
      {reports.map((report) => (
        <div className={styles.reportRow} key={report.id}>
          <span className={styles.reportIcon}>
            <FileText size={17} strokeWidth={1.8} />
          </span>
          <span>
            <strong>{report.original_filename || report.filename}</strong>
            <small>Ready · {formatDate(report.uploaded_at)}</small>
          </span>
          {report.report_download_url && (
            <button
              className={styles.downloadBtn}
              onClick={() => download(report)}
              disabled={downloading === report.id}
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
