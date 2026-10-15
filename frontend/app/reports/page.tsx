"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileText, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/BasicAuthContext";
import { apiService } from "@/lib/api";
import { errorMessage, saveReport } from "@/lib/workflow";
import styles from "./reports.module.css";

interface Assignment {
  id: number;
  filename?: string;
  original_filename?: string;
  uploaded_at?: string;
  total_tasks?: number;
  completed_tasks?: number;
  report_id?: number;
  report_filename?: string;
  report_download_url?: string;
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }

    let active = true;
    setLoading(true);
    setError("");
    apiService
      .getUserAssignments(user.id)
      .then((response: any) => {
        const list = Array.isArray(response)
          ? response
          : (response?.assignments ?? response?.data ?? []);
        if (active) setAssignments(Array.isArray(list) ? list : []);
      })
      .catch((cause) => {
        console.error("Failed to load reports", cause);
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, user, router]);

  const reports = useMemo(
    () => assignments.filter((assignment) => assignment.report_id || assignment.report_download_url),
    [assignments],
  );

  async function download(assignment: Assignment) {
    if (!assignment.report_id) {
      setError("This report is not available for download yet. Refresh and try again.");
      return;
    }
    setDownloadingId(assignment.id);
    setError("");
    try {
      await saveReport(
        assignment.report_id,
        assignment.report_filename || `${assignment.original_filename || assignment.filename || "lab-report"}_completed.docx`,
      );
    } catch (cause) {
      console.error("Failed to download report", cause);
      setError(errorMessage(cause));
    } finally {
      setDownloadingId(null);
    }
  }

  if (authLoading || (!user && loading)) {
    return <main className={styles.loading}><Loader2 className={styles.spinner} />Loading your reports…</main>;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/dashboard" className={styles.back}><ArrowLeft size={17} /> Dashboard</Link>
        <div className={styles.identity}><span className={styles.mark}><FileText size={17} /></span><span>LabMate <b>Reports</b></span></div>
        <span className={styles.account}>{user?.name || user?.email || "Student"}</span>
      </header>

      <section className={styles.content}>
        <p className={styles.eyebrow}>YOUR LAB RECORDS</p>
        <h1>Reports</h1>
        <p className={styles.intro}>Download the finished Word reports generated from your lab manuals.</p>

        {error && <div className={styles.error} role="alert">{error}</div>}
        {loading ? (
          <div className={styles.state}><Loader2 className={styles.spinner} />Loading reports…</div>
        ) : reports.length ? (
          <div className={styles.list}>
            {reports.map((assignment) => {
              const filename = assignment.original_filename || assignment.filename || "Lab manual";
              const date = assignment.uploaded_at
                ? new Date(assignment.uploaded_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                : "";
              return (
                <article className={styles.card} key={assignment.id}>
                  <div className={styles.fileIcon}><FileText size={22} /></div>
                  <div className={styles.details}>
                    <h2>{filename}</h2>
                    <p>{assignment.completed_tasks ?? assignment.total_tasks ?? 0} exercises completed{date ? ` · ${date}` : ""}</p>
                    <span className={styles.ready}>Ready to download</span>
                  </div>
                  <button className={styles.download} onClick={() => download(assignment)} disabled={downloadingId === assignment.id}>
                    {downloadingId === assignment.id ? <Loader2 className={styles.spinner} size={16} /> : <Download size={16} />}
                    {downloadingId === assignment.id ? "Preparing…" : "Download Word"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}><FileText size={24} /></span>
            <h2>No reports yet</h2>
            <p>Upload a lab manual and execute it. Your finished Word report will appear here.</p>
            <Link href="/dashboard" className={styles.upload}>Go to Dashboard</Link>
          </div>
        )}
      </section>
    </main>
  );
}
