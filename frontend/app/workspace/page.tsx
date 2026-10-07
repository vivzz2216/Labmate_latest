"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Download,
  Image as ImageIcon,
  Code2,
  ExternalLink,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  X,
  Maximize2,
  Terminal,
  BookOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/BasicAuthContext";
import { apiService } from "@/lib/api";
import { saveReport } from "@/lib/workflow";
import styles from "./workspace.module.css";

interface ScreenshotItem {
  index: number;
  title: string;
  url: string | null;
  path: string;
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

  const [assignments, setAssignments] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [activeTab, setActiveTab] = useState<"screenshots" | "code" | "report">("screenshots");

  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCodeId, setCopiedCodeId] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [downloadingDoc, setDownloadingDoc] = useState(false);

  // Authentication check
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }

    fetchAssignments();
  }, [authLoading, user, router]);

  const fetchAssignments = async () => {
    if (!user?.id) return;
    try {
      setLoadingList(true);
      const data: any = await apiService.getUserAssignments(user.id);
      const list = Array.isArray(data) ? data : data?.assignments ?? [];
      setAssignments(list);
      if (list.length > 0 && selectedId === null) {
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
        const data = await apiService.getAssignmentWorkspace(selectedId);
        if (active) {
          setWorkspace(data);
        }
      } catch (err) {
        console.error("Failed to fetch assignment workspace", err);
      } finally {
        if (active) setLoadingWorkspace(false);
      }
    };

    loadWorkspace();
    return () => {
      active = false;
    };
  }, [selectedId]);

  const handleCopyCode = (id: number, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
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
    (a.original_filename || a.filename || "").toLowerCase().includes(searchQuery.toLowerCase())
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
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return isoString;
    }
  };

  return (
    <div className={styles.container}>
      {/* Top Navbar */}
      <header className={styles.navbar}>
        <div className={styles.navLeft}>
          <Link href="/dashboard" className={styles.backBtn} title="Back to Dashboard">
            <ArrowLeft size={18} />
          </Link>
          <div className={styles.brandTitle}>
            <span className={styles.brandIcon}>
              <Sparkles size={16} />
            </span>
            <h1>LabMate Workspace</h1>
          </div>
        </div>

        <div className={styles.navRight}>
          <Link href="/dashboard" className={styles.uploadNewBtn}>
            + Upload New Manual
          </Link>
          <div className={styles.userBadge}>
            <span className={styles.userDot}></span>
            <span>{user?.name || user?.email || "Student"}</span>
          </div>
        </div>
      </header>

      {/* Main Layout: Sidebar & Content Area */}
      <div className={styles.layout}>
        {/* Left Sidebar: Manuals List */}
        <aside className={styles.sidebar}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search lab manuals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.manualList}>
            {loadingList ? (
              <div className={styles.loadingSpinner}>Loading your manuals...</div>
            ) : filteredAssignments.length === 0 ? (
              <div className={styles.emptySidebar}>
                <BookOpen size={32} />
                <p>No lab manuals found</p>
                <Link href="/dashboard" className={styles.sidebarUploadLink}>
                  Upload your first manual
                </Link>
              </div>
            ) : (
              filteredAssignments.map((item) => {
                const isSelected = item.id === selectedId;
                const isCompleted = item.completed_tasks > 0 && item.completed_tasks >= item.total_tasks;

                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`${styles.manualCard} ${isSelected ? styles.manualCardActive : ""}`}
                  >
                    <div className={styles.manualCardHeader}>
                      <span className={styles.fileIcon}>
                        <FileText size={18} />
                      </span>
                      <span className={styles.manualName} title={item.original_filename || item.filename}>
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
                          <CheckCircle2 size={13} /> Done
                        </span>
                      ) : (
                        <span className={styles.statusProcessing} title="In Progress">
                          <Clock size={13} /> Active
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Workspace Main Pane */}
        <main className={styles.mainPane}>
          {loadingWorkspace ? (
            <div className={styles.loadingWorkspacePane}>
              <div className={styles.pulseLoader}></div>
              <p>Opening lab manual workspace...</p>
            </div>
          ) : !workspace ? (
            <div className={styles.noSelection}>
              <BookOpen size={48} className={styles.noSelectionIcon} />
              <h2>Select a Lab Manual</h2>
              <p>Choose an assignment from the sidebar to inspect its Word report, screenshots, and solutions.</p>
            </div>
          ) : (
            <div className={styles.contentWrap}>
              {/* Header Banner */}
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
                        Uploaded {formatDate(workspace.assignment.uploaded_at)} • {formatFileSize(workspace.assignment.file_size)}
                      </span>
                      <span className={styles.badgeSuccess}>
                        <CheckCircle2 size={13} /> {workspace.questions.length} Questions Processed
                      </span>
                    </div>
                  </div>

                  {workspace.report && (
                    <button
                      onClick={handleDownloadReport}
                      disabled={downloadingDoc}
                      className={styles.downloadReportBtn}
                      title="Download the compiled Word Report with high-res screenshots"
                    >
                      <Download size={16} />
                      {downloadingDoc ? "Downloading..." : "Download Word Report (.docx)"}
                    </button>
                  )}
                </div>

                {/* Tabs */}
                <div className={styles.tabsNav}>
                  <button
                    onClick={() => setActiveTab("screenshots")}
                    className={`${styles.tabBtn} ${activeTab === "screenshots" ? styles.tabBtnActive : ""}`}
                  >
                    <ImageIcon size={16} />
                    <span>Screenshots ({allScreenshots.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("code")}
                    className={`${styles.tabBtn} ${activeTab === "code" ? styles.tabBtnActive : ""}`}
                  >
                    <Code2 size={16} />
                    <span>Solutions & Output ({workspace.questions.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("report")}
                    className={`${styles.tabBtn} ${activeTab === "report" ? styles.tabBtnActive : ""}`}
                  >
                    <FileText size={16} />
                    <span>Word Report Document</span>
                  </button>
                </div>
              </div>

              {/* Tab 1: Screenshots Gallery */}
              {activeTab === "screenshots" && (
                <div className={styles.tabContent}>
                  {allScreenshots.length === 0 ? (
                    <div className={styles.emptyGallery}>
                      <ImageIcon size={40} />
                      <p>No execution screenshots generated for this manual yet.</p>
                    </div>
                  ) : (
                    <div className={styles.screenshotGrid}>
                      {allScreenshots.map((item, idx) => (
                        <div key={idx} className={styles.screenshotCard}>
                          <div
                            className={styles.screenshotImgWrap}
                            onClick={() =>
                              item.screenshot.url &&
                              setPreviewImage({
                                url: item.screenshot.url,
                                title: item.screenshot.title,
                              })
                            }
                          >
                            {item.screenshot.url ? (
                              <img
                                src={item.screenshot.url}
                                alt={item.screenshot.title}
                                className={styles.screenshotImg}
                                loading="lazy"
                              />
                            ) : (
                              <div className={styles.imagePlaceholder}>Generating preview...</div>
                            )}
                            <div className={styles.zoomOverlay}>
                              <Maximize2 size={20} />
                              <span>Click to zoom</span>
                            </div>
                          </div>

                          <div className={styles.screenshotCardFooter}>
                            <div>
                              <p className={styles.screenshotTitle}>{item.screenshot.title}</p>
                              <span className={styles.screenshotContext}>
                                Q{item.questionId}: {item.questionText.slice(0, 45)}...
                              </span>
                            </div>
                            {item.screenshot.url && (
                              <a
                                href={item.screenshot.url}
                                download={`${item.screenshot.title.replace(/\s+/g, "_")}.png`}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.downloadIconBtn}
                                title="Download screenshot"
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
                  <div className={styles.questionsList}>
                    {workspace.questions.map((q) => (
                      <div key={q.id} className={styles.questionCard}>
                        <div className={styles.questionCardHeader}>
                          <span className={styles.questionNumberPill}>Question {q.id}</span>
                          <h4 className={styles.questionTextHeading}>{q.question_text}</h4>
                        </div>

                        {q.code && (
                          <div className={styles.codeBlockWrap}>
                            <div className={styles.codeBlockBar}>
                              <span className={styles.codeLangLabel}>
                                <Code2 size={13} /> {q.language}
                              </span>
                              <button
                                onClick={() => handleCopyCode(q.id, q.code)}
                                className={styles.copyBtn}
                                title="Copy code"
                              >
                                {copiedCodeId === q.id ? (
                                  <>
                                    <Check size={13} /> Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy size={13} /> Copy Code
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
                              <Terminal size={13} /> Execution Console Output
                            </div>
                            <pre className={styles.outputSnippet}>
                              <code>{q.output}</code>
                            </pre>
                          </div>
                        )}

                        {q.is_theory && q.theory_answer && (
                          <div className={styles.theoryBlockWrap}>
                            <div className={styles.theoryBlockBar}>
                              <BookOpen size={13} /> Theoretical Answer
                            </div>
                            <div className={styles.theoryContent}>{q.theory_answer}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Word Report Info */}
              {activeTab === "report" && (
                <div className={styles.tabContent}>
                  {workspace.report ? (
                    <div className={styles.reportSummaryCard}>
                      <div className={styles.reportDocIcon}>
                        <FileText size={48} />
                      </div>
                      <div className={styles.reportDocDetails}>
                        <h3>{workspace.report.filename}</h3>
                        <p>
                          Generated Word report ready for academic submission. Includes original lab manual formatting,
                          clean question listings, verified program code, and authentic execution screenshots.
                        </p>
                        <div className={styles.reportMetaList}>
                          <span>• File Size: {formatFileSize(workspace.report.file_size)}</span>
                          <span>• Format: Microsoft Word (.docx)</span>
                          <span>• Status: Ready to print / submit</span>
                        </div>
                        <button
                          onClick={handleDownloadReport}
                          disabled={downloadingDoc}
                          className={styles.downloadReportBtnLarge}
                        >
                          <Download size={18} />
                          {downloadingDoc ? "Downloading Report..." : "Download Completed Word Document (.docx)"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.emptyGallery}>
                      <Clock size={40} />
                      <p>Word document is currently being compiled or queued.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Image Zoom Modal */}
      {previewImage && (
        <div className={styles.modalBackdrop} onClick={() => setPreviewImage(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>{previewImage.title}</span>
              <button onClick={() => setPreviewImage(null)} className={styles.modalCloseBtn}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalImageWrap}>
              <img src={previewImage.url} alt={previewImage.title} className={styles.modalImage} />
            </div>
            <div className={styles.modalFooter}>
              <a
                href={previewImage.url}
                download={`${previewImage.title.replace(/\s+/g, "_")}.png`}
                className={styles.downloadModalBtn}
                target="_blank"
                rel="noreferrer"
              >
                <Download size={15} /> Download Full-Resolution Screenshot
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
