"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Download,
  Image as ImageIcon,
  Code2,
  Search,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  X,
  Maximize2,
  Terminal,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";
import DashboardShell, {
  EmptyState,
  LoadingState,
  getLanguage,
} from "@/components/dashboard/DashboardShell";
import dashStyles from "@/app/dashboard/dashboard.module.css";
import { useAuth } from "@/contexts/BasicAuthContext";
import { apiService } from "@/lib/api";
import { saveReport } from "@/lib/workflow";
import styles from "./workspace.module.css";

interface ScreenshotItem {
  index: number;
  title: string;
  url: string | null;
}

interface QuestionItem {
  id: number;
  question_text: string;
  code: string;
  output: string;
  status: string;
  language: string;
  is_theory: boolean;
  theory_answer?: string;
  error_message?: string;
  project_files?: Record<string, string>;
  screenshots: ScreenshotItem[];
}

interface WorkspaceData {
  assignment: {
    id: number;
    filename: string;
    original_filename: string;
    language: string;
    uploaded_at: string;
    file_type: string;
    file_size: number;
    status: string;
    progress: number;
    stage: string;
    error?: string | null;
  };
  report: {
    id: number;
    filename: string;
    download_url: string;
    file_size: number;
  } | null;
  questions: QuestionItem[];
}

export default function WorkspacePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [assignments, setAssignments] = useState<any[]>(
    () => apiService.peekUserAssignments(user?.id) || [],
  );
  const [loadingList, setLoadingList] = useState(
    () => !apiService.peekUserAssignments(user?.id),
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [activeTab, setActiveTab] = useState<"screenshots" | "code" | "report">("screenshots");

  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCodeId, setCopiedCodeId] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [downloadingDoc, setDownloadingDoc] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [workspaceError, setWorkspaceError] = useState('');

  // Authentication check & initial fetch
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }

    fetchAssignments();
  }, [authLoading, user?.id, router]);

  const fetchAssignments = async () => {
    if (!user?.id) return;
    const cached = apiService.peekUserAssignments(user.id);
    if (cached) {
      setAssignments(cached);
      setLoadingList(false);
      if (cached.length > 0 && selectedId === null) {
        const requestedId =
          typeof window !== "undefined"
            ? Number(new URLSearchParams(window.location.search).get("assignment"))
            : NaN;
        if (Number.isSafeInteger(requestedId) && requestedId > 0 && cached.some((a: any) => a.id === requestedId)) {
          setSelectedId(requestedId);
        } else {
          setSelectedId(cached[0].id);
        }
      }
    } else {
      setLoadingList(true);
    }
    try {
      const data: any = await apiService.getUserAssignments(user.id);
      const list = Array.isArray(data) ? data : data?.assignments ?? data?.data ?? [];
      setAssignments(list);

      const requestedId =
        typeof window !== "undefined"
          ? Number(new URLSearchParams(window.location.search).get("assignment"))
          : NaN;
      if (Number.isSafeInteger(requestedId) && requestedId > 0 && list.some((a: any) => a.id === requestedId)) {
        setSelectedId(requestedId);
      } else if (list.length > 0 && selectedId === null) {
        setSelectedId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load user assignments", err);
    } finally {
      setLoadingList(false);
    }
  };

  // Load selected assignment workspace
  useEffect(() => {
    if (!selectedId) return;
    let active = true;

    const loadWorkspace = async () => {
      try {
        setLoadingWorkspace(true);
        setWorkspaceError('');
        setWorkspace(null);
        const data = await apiService.getAssignmentWorkspace(selectedId);
        if (active) {
          setWorkspace(data);
        }
      } catch (err) {
        console.error("Failed to fetch assignment workspace", err);
        if (active) setWorkspaceError('This workspace could not be loaded. Select it again to retry.');
      } finally {
        if (active) setLoadingWorkspace(false);
      }
    };

    loadWorkspace();
    return () => {
      active = false;
    };
  }, [selectedId]);

  const handleCopyCode = async (id: number, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId(null), 2000);
    } catch {
      setWorkspaceError('Clipboard access was denied. Select and copy the code directly.');
    }
  };

  const handleDownloadReport = async () => {
    if (!workspace?.report) return;
    try {
      setDownloadingDoc(true);
      await saveReport(workspace.report.id, workspace.report.filename);
    } catch (err) {
      console.error("Failed to download report", err);
    } finally {
      setDownloadingDoc(false);
    }
  };

  const filteredAssignments = assignments.filter((a) =>
    `${a.original_filename || a.filename || ""} ${a.language || ""}`
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase()),
  );

  const allScreenshots: { questionId: number; questionText: string; screenshot: ScreenshotItem }[] = [];
  if (workspace?.questions) {
    workspace.questions.forEach((q) => {
      (q.screenshots || []).forEach((s) => {
        allScreenshots.push({
          questionId: q.id,
          questionText: q.question_text,
          screenshot: s,
        });
      });
    });
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 KB";
    if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return Number.isNaN(d.getTime())
        ? isoString
        : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return isoString;
    }
  };

  return (
    <DashboardShell
      title="Workspace"
      subtitle="Inspect execution screenshots, verified solutions, and Word reports"
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search lab manuals..."
    >
      {workspaceError && <p role="alert" className={styles.executionError}>{workspaceError}</p>}
      <div className={styles.workspaceGrid}>
        {/* Left Panel: Manuals List */}
        <aside className={styles.manualsPanel}>
          <div className={styles.manualsHeader}>
            <h2>Lab Manuals</h2>
            <span className={styles.manualsCount}>{filteredAssignments.length}</span>
          </div>

          <div className={styles.searchBox}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Filter manuals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
              aria-label="Filter lab manuals"
            />
          </div>

          <div className={styles.manualList}>
            {loadingList ? (
              <LoadingState message="Loading your manuals..." />
            ) : filteredAssignments.length === 0 ? (
              <EmptyState
                compact
                icon={BookOpen}
                title={searchQuery ? "No matching manuals" : "No lab manuals found"}
                description={
                  searchQuery
                    ? "Try a different search query."
                    : "Upload your first manual to inspect its workspace."
                }
                action={
                  !searchQuery
                    ? {
                        label: "Upload manual",
                        onClick: () => router.push("/code-execution"),
                      }
                    : undefined
                }
              />
            ) : (
              filteredAssignments.map((item) => {
                const isSelected = item.id === selectedId;
                const isCompleted =
                  item.completed_tasks > 0 && item.completed_tasks >= item.total_tasks;
                const meta = getLanguage(item.language);
                const LangIcon = meta.icon;

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`${styles.manualCard} ${isSelected ? styles.manualCardActive : ""}`}
                  >
                    <div className={styles.manualCardHeader}>
                      <span className={styles.fileIconWrap}>
                        <LangIcon className={meta.className} size={16} />
                      </span>
                      <span
                        className={styles.manualName}
                        title={item.original_filename || item.filename}
                      >
                        {item.original_filename || item.filename}
                      </span>
                    </div>

                    <div className={styles.manualCardMeta}>
                      <span className={styles.langPill}>
                        {item.language ? item.language.toUpperCase() : "AUTO"}
                      </span>
                      <span className={styles.datePill}>{formatDate(item.uploaded_at)}</span>
                      {isCompleted ? (
                        <span className={styles.statusCompleted} title="Completed">
                          <CheckCircle2 size={12} /> Done
                        </span>
                      ) : (
                        <span className={styles.statusProcessing} title="In Progress">
                          <Clock size={12} /> Active
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Pane: Selected Manual Workspace */}
        <section className={styles.mainPane}>
          {loadingWorkspace ? (
            <div className={styles.statePanel}>
              <LoadingState message="Opening lab manual workspace..." />
            </div>
          ) : !workspace ? (
            <div className={styles.statePanel}>
              <EmptyState
                icon={BookOpen}
                title="Select a Lab Manual"
                description="Choose an assignment from the left panel to inspect its Word report, screenshots, and solutions."
                action={{
                  label: "Upload New Manual",
                  onClick: () => router.push("/code-execution"),
                }}
              />
            </div>
          ) : (
            <>
              {/* Assignment Header Card */}
              <div className={styles.assignmentHeader}>
                <div className={styles.assignmentTitleRow}>
                  <div>
                    <h2 className={styles.assignmentTitle}>
                      {workspace.assignment.original_filename || workspace.assignment.filename}
                    </h2>
                    <div className={styles.assignmentSubRow}>
                      <span className={styles.badgeLang}>
                        {workspace.assignment.language?.toUpperCase() || "AUTO"}
                      </span>
                      <span className={styles.subMeta}>
                        Uploaded {formatDate(workspace.assignment.uploaded_at)} ·{" "}
                        {formatFileSize(workspace.assignment.file_size)}
                      </span>
                      <span className={styles.badgeSuccess}>
                        <CheckCircle2 size={13} /> {workspace.questions.length} Questions Processed
                      </span>
                    </div>
                  </div>

                  <div className={styles.headerActions}>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/code-execution?assignment=${workspace.assignment.id}`)
                      }
                      className={dashStyles.secondaryButton}
                    >
                      Open in Studio <ArrowUpRight size={15} />
                    </button>

                    {workspace.report && (
                      <button
                        type="button"
                        onClick={handleDownloadReport}
                        disabled={downloadingDoc}
                        className={dashStyles.primaryButton}
                        title="Download the compiled Word Report with high-res screenshots"
                      >
                        <Download size={15} />
                        {downloadingDoc ? "Downloading..." : "Download Word Report (.docx)"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabs Navigation */}
                <div className={styles.tabsNav} role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "screenshots"}
                    onClick={() => setActiveTab("screenshots")}
                    className={`${styles.tabBtn} ${activeTab === "screenshots" ? styles.tabBtnActive : ""}`}
                  >
                    <ImageIcon size={15} />
                    <span>Screenshots ({allScreenshots.length})</span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "code"}
                    onClick={() => setActiveTab("code")}
                    className={`${styles.tabBtn} ${activeTab === "code" ? styles.tabBtnActive : ""}`}
                  >
                    <Code2 size={15} />
                    <span>Solutions &amp; Output ({workspace.questions.length})</span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "report"}
                    onClick={() => setActiveTab("report")}
                    className={`${styles.tabBtn} ${activeTab === "report" ? styles.tabBtnActive : ""}`}
                  >
                    <FileText size={15} />
                    <span>Word Report Document</span>
                  </button>
                </div>
              </div>

              {/* Tab 1: Screenshots Gallery */}
              {activeTab === "screenshots" && (
                <div className={styles.tabContent}>
                  {allScreenshots.length === 0 ? (
                    <div className={styles.statePanel}>
                      <EmptyState
                        icon={ImageIcon}
                        title="No execution screenshots yet"
                        description="Run this lab manual in the studio to capture authentic IDE and terminal outputs."
                        action={{
                          label: "Open in Lab Studio",
                          onClick: () =>
                            router.push(`/code-execution?assignment=${workspace.assignment.id}`),
                        }}
                      />
                    </div>
                  ) : (
                    <div className={styles.screenshotGrid}>
                      {allScreenshots.map((item, idx) => (
                        <div key={idx} className={styles.screenshotCard}>
                          <div
                            className={styles.screenshotImgWrap}
                            role={item.screenshot.url && !imageErrors[item.screenshot.url] ? 'button' : undefined}
                            tabIndex={item.screenshot.url && !imageErrors[item.screenshot.url] ? 0 : -1}
                            aria-label={`View ${item.screenshot.title}`}
                            onKeyDown={(event) => {
                              if ((event.key === 'Enter' || event.key === ' ') && item.screenshot.url && !imageErrors[item.screenshot.url]) {
                                event.preventDefault();
                                setPreviewImage({url: item.screenshot.url, title: item.screenshot.title});
                              }
                            }}
                            onClick={() =>
                              item.screenshot.url && !imageErrors[item.screenshot.url] &&
                              setPreviewImage({
                                url: item.screenshot.url,
                                title: item.screenshot.title,
                              })
                            }
                          >
                            {item.screenshot.url && !imageErrors[item.screenshot.url] ? (
                              <img
                                src={item.screenshot.url}
                                alt={item.screenshot.title}
                                className={styles.screenshotImg}
                                loading="lazy"
                                onError={() => setImageErrors(previous => ({...previous, [item.screenshot.url!]: true}))}
                              />
                            ) : (
                              <div className={styles.imagePlaceholder}>Screenshot unavailable. Check the Word report.</div>
                            )}
                            {item.screenshot.url && !imageErrors[item.screenshot.url] && <div className={styles.zoomOverlay}>
                              <Maximize2 size={18} />
                              <span>Click to zoom</span>
                            </div>}
                          </div>

                          <div className={styles.screenshotCardFooter}>
                            <div className={styles.screenshotFooterText}>
                              <p className={styles.screenshotTitle}>{item.screenshot.title}</p>
                              <span className={styles.screenshotContext}>
                                Q{item.questionId}: {item.questionText.slice(0, 52)}
                                {item.questionText.length > 52 ? "…" : ""}
                              </span>
                            </div>
                            {item.screenshot.url && !imageErrors[item.screenshot.url] && (
                              <a
                                href={item.screenshot.url}
                                download={`${item.screenshot.title.replace(/\s+/g, "_")}.png`}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.downloadIconBtn}
                                title="Download screenshot"
                                aria-label={`Download ${item.screenshot.title}`}
                              >
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Code & Outputs */}
              {activeTab === "code" && (
                <div className={styles.tabContent}>
                  {workspace.questions.length === 0 ? (
                    <div className={styles.statePanel}>
                      <EmptyState
                        icon={Code2}
                        title="No questions extracted yet"
                        description="Open this assignment in Lab Studio to extract and solve questions."
                      />
                    </div>
                  ) : (
                    <div className={styles.questionsList}>
                      {workspace.questions.map((q) => (
                        <div key={q.id} className={styles.questionCard}>
                          <div className={styles.questionCardHeader}>
                            <span className={styles.questionNumberPill}>Question {q.id}</span>
                            <h4 className={styles.questionTextHeading}>{q.question_text}</h4>
                          </div>

                          <p className={styles.questionStatus}>Status: {q.status}</p>
                          {q.error_message && <p role="alert" className={styles.executionError}>{q.error_message}</p>}
                          {Object.entries(q.project_files || {}).map(([filename, source]) => (
                            <details key={filename} className={styles.codeBlockWrap}>
                              <summary className={styles.codeBlockBar}>{filename}</summary>
                              <pre className={styles.codeSnippet}><code>{source}</code></pre>
                            </details>
                          ))}
                          {q.code && !Object.keys(q.project_files || {}).length && (
                            <div className={styles.codeBlockWrap}>
                              <div className={styles.codeBlockBar}>
                                <span className={styles.codeLangLabel}>
                                  <Code2 size={13} /> {q.language}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyCode(q.id, q.code)}
                                  className={styles.copyBtn}
                                  title="Copy code"
                                >
                                  {copiedCodeId === q.id ? (
                                    <>
                                      <Check size={12} /> Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={12} /> Copy Code
                                    </>
                                  )}
                                </button>
                              </div>
                              <pre className={styles.codeSnippet}>
                                <code>{q.code}</code>
                              </pre>
                            </div>
                          )}

                          {q.output && (
                            <div className={styles.outputBlockWrap}>
                              <div className={styles.outputBlockBar}>
                                <span className={styles.codeLangLabel}>
                                  <Terminal size={13} /> Execution Console Output
                                </span>
                              </div>
                              <pre className={styles.outputSnippet}>
                                <code>{q.output}</code>
                              </pre>
                            </div>
                          )}

                          {q.is_theory && q.theory_answer && (
                            <div className={styles.theoryBlockWrap}>
                              <div className={styles.theoryBlockBar}>
                                <span className={styles.codeLangLabel}>
                                  <BookOpen size={13} /> Theoretical Answer
                                </span>
                              </div>
                              <div className={styles.theoryContent}>{q.theory_answer}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Word Report Info */}
              {activeTab === "report" && (
                <div className={styles.tabContent}>
                  {workspace.report ? (
                    <div className={styles.reportSummaryCard}>
                      <div className={styles.reportDocIcon}>
                        <FileText size={38} />
                      </div>
                      <div className={styles.reportDocDetails}>
                        <h3>{workspace.report.filename}</h3>
                        <p>
                          Generated Word report ready for academic submission. Includes original
                          lab manual formatting, clean question listings, verified program code,
                          and authentic execution screenshots.
                        </p>
                        <div className={styles.reportMetaList}>
                          <span>• File Size: {formatFileSize(workspace.report.file_size)}</span>
                          <span>• Format: Microsoft Word (.docx)</span>
                          <span>• Status: Ready to print / submit</span>
                        </div>
                        <div className={styles.reportActions}>
                          <button
                            type="button"
                            onClick={handleDownloadReport}
                            disabled={downloadingDoc}
                            className={dashStyles.primaryButton}
                          >
                            <Download size={16} />
                            {downloadingDoc
                              ? "Downloading Report..."
                              : "Download Completed Word Document (.docx)"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.statePanel}>
                      <EmptyState
                        icon={Clock}
                        title="Word report not compiled yet"
                        description="Word document is currently being compiled or awaiting execution in the Lab Studio."
                        action={{
                          label: "Open in Lab Studio",
                          onClick: () =>
                            router.push(`/code-execution?assignment=${workspace.assignment.id}`),
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Image Zoom Modal */}
      {previewImage && (
        <div className={styles.modalBackdrop} onClick={() => setPreviewImage(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>{previewImage.title}</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className={styles.modalCloseBtn}
                aria-label="Close preview"
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalImageWrap}>
              <img src={previewImage.url} alt={previewImage.title} className={styles.modalImage} />
            </div>
            <div className={styles.modalFooter}>
              <a
                href={previewImage.url}
                download={`${previewImage.title.replace(/\s+/g, "_")}.png`}
                className={dashStyles.primaryButton}
                target="_blank"
                rel="noreferrer"
              >
                <Download size={15} /> Download Full-Resolution Screenshot
              </a>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
