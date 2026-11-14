"use client";

import React, { useEffect, useState } from "react";
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
  Search,
  X,
  ChevronRight,
  Sun,
  Moon,
  UploadCloud,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { SiC, SiCplusplus, SiHtml5, SiPython } from "react-icons/si";
import { FaJava } from "react-icons/fa";
import LabMateLogo from "@/components/brand/LabMateLogo";
import { useAuth } from "@/contexts/BasicAuthContext";
import styles from "@/app/dashboard/dashboard.module.css";

export interface Assignment {
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

export const languageMeta: Record<
  string,
  { label: string; icon: any; className: string }
> = {
  python: { label: "Python", icon: SiPython, className: styles.python },
  colab: { label: "Python Notebook", icon: SiPython, className: styles.python },
  java: { label: "Java", icon: FaJava, className: styles.java },
  c: { label: "C", icon: SiC, className: styles.c },
  cpp: { label: "C++", icon: SiCplusplus, className: styles.cpp },
  webdev: { label: "Web Development", icon: SiHtml5, className: styles.html },
  "web-dev": { label: "Web Development", icon: SiHtml5, className: styles.html },
  html: { label: "Web Development", icon: SiHtml5, className: styles.html },
  react: { label: "React (Web Dev)", icon: SiHtml5, className: styles.html },
  node: { label: "Node.js (Web Dev)", icon: SiHtml5, className: styles.html },
  sql: { label: "SQL", icon: Terminal, className: styles.c },
  ubuntu: { label: "Ubuntu / Linux", icon: Terminal, className: styles.fileIcon },
  r: { label: "R / RStudio", icon: Terminal, className: styles.fileIcon },
  deep_learning: { label: "Deep Learning", icon: SiPython, className: styles.python },
  "deep-learning": { label: "Deep Learning", icon: SiPython, className: styles.python },
  distributed: { label: "Distributed Computing", icon: FaJava, className: styles.java },
  "distributed-computing": { label: "Distributed Computing", icon: FaJava, className: styles.java },
};

export function formatDate(value?: string) {
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

export function getLanguage(language?: string) {
  const key = (language || "").toLowerCase();
  return (
    languageMeta[key] || {
      label: language ? language.toUpperCase() : "Auto-detected",
      icon: FileText,
      className: styles.fileIcon,
    }
  );
}

export function getProgress(assignment: Assignment) {
  return assignment.total_tasks
    ? Math.min(
        100,
        Math.round((assignment.completed_tasks / assignment.total_tasks) * 100),
      )
    : 0;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  tone,
}: {
  icon: any;
  label: string;
  value: number | string;
  subtext?: string;
  tone: "blue" | "green";
}) {
  return (
    <article className={styles.statCard}>
      <span
        className={`${styles.statIcon} ${tone === "green" ? styles.statGreen : styles.statBlue}`}
      >
        <Icon size={20} strokeWidth={1.8} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>
          {subtext ?? (value === 0 ? "No activity yet" : "Across your lab manuals")}
        </small>
      </div>
    </article>
  );
}

export function LoadingState({
  message = "Loading your lab manuals...",
}: {
  message?: string;
}) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.spinner} />
      <p>{message}</p>
    </div>
  );
}

export function EmptyState({
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
        <Icon size={compact ? 20 : 24} strokeWidth={1.8} />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action && (
        <button
          type="button"
          className={styles.emptyAction}
          onClick={action.onClick}
        >
          <Plus size={14} strokeWidth={2} /> {action.label}
        </button>
      )}
    </div>
  );
}

export const dashboardNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", matchPrefix: "/dashboard" },
  { label: "Lab Sections", icon: Layers, href: "/labs", matchPrefix: "/labs" },
  { label: "Workspace", icon: FolderGit2, href: "/workspace", matchPrefix: "/workspace" },
  { label: "My Labs", icon: Terminal, href: "/code-execution", matchPrefix: "/code-execution" },
  { label: "Reports", icon: FileText, href: "/reports", matchPrefix: "/reports" },
  { label: "Settings", icon: Settings, href: "/user-dashboard?tab=settings", matchPrefix: "/user-dashboard" },
];

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  headerActions?: React.ReactNode;
  lockViewport?: boolean;
  children: React.ReactNode;
}

export function useDashboardTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("labmate_dashboard_theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    }
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "labmate_dashboard_theme" && (e.newValue === "light" || e.newValue === "dark")) {
        setTheme(e.newValue);
      }
    };
    const handleCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "light" || detail === "dark") {
        setTheme(detail);
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("labmate-theme-change", handleCustom);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("labmate-theme-change", handleCustom);
    };
  }, []);

  const setAndPersistTheme = (nextTheme: "dark" | "light") => {
    setTheme(nextTheme);
    localStorage.setItem("labmate_dashboard_theme", nextTheme);
    window.dispatchEvent(new CustomEvent("labmate-theme-change", { detail: nextTheme }));
  };

  const toggleTheme = () => {
    setAndPersistTheme(theme === "dark" ? "light" : "dark");
  };

  return { theme, setTheme: setAndPersistTheme, toggleTheme };
}

export default function DashboardShell({
  title,
  subtitle,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search labs, reports...",
  headerActions,
  lockViewport = false,
  children,
}: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useDashboardTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("labmate_sidebar_collapsed");
      if (saved === "true") {
        setSidebarCollapsed(true);
      }
    } catch {
      // ignore storage errors
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        const target = e.target as HTMLElement;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        toggleSidebarCollapsed();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("labmate_sidebar_collapsed", String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const displayName = user?.name?.trim() || "Student";

  const navItems = user?.is_admin
    ? [
        ...dashboardNavItems,
        {
          label: "Owner Admin",
          icon: ShieldCheck,
          href: "/admin/dashboard",
          matchPrefix: "/admin",
        },
      ]
    : dashboardNavItems;

  useEffect(() => {
    navItems.forEach((item) => {
      try {
        router.prefetch(item.href);
      } catch {
        // ignore prefetch errors
      }
    });
  }, [router, user?.is_admin]);

  const go = (href: string) => {
    setMobileNavOpen(false);
    router.push(href);
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div
      className={`${styles.shell} ${sidebarCollapsed ? styles.shellCollapsed : ""}`}
      data-theme={theme}
    >
      <div className={styles.ambientGlow} />

      {/* Unified Fixed Sidebar */}
      <aside
        className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ""} ${mobileNavOpen ? styles.sidebarOpen : ""}`}
      >
        <div className={styles.sidebarTop}>
          {sidebarCollapsed ? (
            <Link
              href="/dashboard"
              className={styles.brandCollapsed}
              aria-label="LabMate Dashboard"
              data-tooltip="LabMate"
            >
              <LabMateLogo
                size="sm"
                theme="dark"
                showWordmark={false}
              />
            </Link>
          ) : (
            <>
              <Link
                href="/dashboard"
                className={styles.brand}
                aria-label="LabMate Dashboard"
                title="LabMate Dashboard"
              >
                <LabMateLogo
                  size="sm"
                  theme="dark"
                  showWordmark={true}
                />
              </Link>
              <button
                type="button"
                className={styles.sidebarToggleBtn}
                onClick={toggleSidebarCollapsed}
                aria-label="Collapse sidebar (Ctrl+B)"
                title="Collapse sidebar (Ctrl+B)"
              >
                <PanelLeftClose size={16} strokeWidth={1.85} />
              </button>
            </>
          )}
          <button
            className={styles.mobileClose}
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        <nav className={styles.sidebarNav} aria-label="Primary navigation">
          {navItems.map(({ label, icon: Icon, href, matchPrefix }) => {
            const active =
              matchPrefix === "/dashboard"
                ? pathname === "/dashboard"
                : Boolean(pathname?.startsWith(matchPrefix));
            return (
              <button
                key={label}
                type="button"
                className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                onClick={() => go(href)}
                aria-current={active ? "page" : undefined}
                data-tooltip={sidebarCollapsed ? label : undefined}
                title={!sidebarCollapsed ? undefined : label}
              >
                <Icon size={18} strokeWidth={1.85} />
                {!sidebarCollapsed && <span>{label}</span>}
              </button>
            );
          })}
        </nav>

        <div className={styles.sidebarBottom}>
          {sidebarCollapsed && (
            <button
              type="button"
              className={styles.sidebarExpandBtn}
              onClick={toggleSidebarCollapsed}
              aria-label="Expand sidebar (Ctrl+B)"
              data-tooltip="Expand sidebar"
              title="Expand sidebar (Ctrl+B)"
            >
              <PanelLeftOpen size={17} strokeWidth={1.85} />
            </button>
          )}
          <button
            type="button"
            className={styles.signOut}
            onClick={handleLogout}
            data-tooltip={sidebarCollapsed ? "Sign out" : undefined}
            title={sidebarCollapsed ? "Sign out" : undefined}
          >
            <LogOut size={16} strokeWidth={1.8} />
            {!sidebarCollapsed && <span>Sign out</span>}
          </button>
          <div
            className={styles.account}
            onClick={() => go("/user-dashboard?tab=settings")}
            role="button"
            tabIndex={0}
            data-tooltip={sidebarCollapsed ? displayName : undefined}
            title={sidebarCollapsed ? `${displayName} (${user?.email || "Account"})` : undefined}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                go("/user-dashboard?tab=settings");
              }
            }}
            aria-label="Account and settings"
          >
            <span className={styles.accountAvatar}>
              {displayName.charAt(0).toUpperCase()}
            </span>
            {!sidebarCollapsed && (
              <>
                <span className={styles.accountText}>
                  <strong>{displayName}</strong>
                  <small>{user?.email || "Student Account"}</small>
                </span>
                <ChevronRight size={14} strokeWidth={2} />
              </>
            )}
          </div>
        </div>
      </aside>

      {mobileNavOpen && (
        <button
          type="button"
          className={styles.scrim}
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}

      {/* Main Content Area */}
      <section
        className={`${styles.content} ${lockViewport ? styles.contentLocked : ""}`}
      >
        <header className={styles.topbar}>
          <div className={styles.topbarTitle}>
            {sidebarCollapsed && (
              <button
                type="button"
                className={styles.topbarSidebarToggle}
                onClick={toggleSidebarCollapsed}
                aria-label="Expand sidebar (Ctrl+B)"
                title="Expand sidebar (Ctrl+B)"
              >
                <PanelLeftOpen size={16} strokeWidth={1.85} />
              </button>
            )}
            <button
              type="button"
              className={styles.mobileMenu}
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className={styles.topbarHeadingWrap}>
              <h1>{title}</h1>
              {subtitle && <span className={styles.topbarSubtitle}>{subtitle}</span>}
            </div>
          </div>

          <div className={styles.topbarActions}>
            {typeof onSearchChange === "function" && (
              <label className={styles.search}>
                <Search size={15} strokeWidth={1.8} />
                <input
                  value={searchValue || ""}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                />
                {searchValue && (
                  <button
                    type="button"
                    className={styles.searchClear}
                    onClick={() => onSearchChange("")}
                    aria-label="Clear search"
                  >
                    <X size={13} strokeWidth={2} />
                  </button>
                )}
              </label>
            )}

            <button
              type="button"
              className={styles.themeToggle}
              onClick={toggleTheme}
              title={
                theme === "dark"
                  ? "Switch to Light Theme"
                  : "Switch to Dark Theme"
              }
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

            {headerActions !== undefined ? (
              headerActions
            ) : (
              <button
                type="button"
                className={styles.topbarUploadBtn}
                onClick={() => go("/code-execution")}
              >
                <UploadCloud size={15} strokeWidth={2} />
                <span>New Lab</span>
              </button>
            )}
          </div>
        </header>

        <main
          className={`${styles.main} ${lockViewport ? styles.mainLocked : ""}`}
        >
          {children}
        </main>
      </section>
    </div>
  );
}
