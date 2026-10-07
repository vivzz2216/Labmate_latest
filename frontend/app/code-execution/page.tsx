"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";

const DotGrid = dynamic<any>(() => import("@/components/visual/DotGrid"), {
  ssr: false,
});

const LatticeLoader = dynamic<any>(() => import("@/components/visual/LatticeLoader"), {
  ssr: false,
});
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  Download,
  FileText,
  ImageIcon,
  ListChecks,
  Loader2,
  RefreshCw,
  Terminal,
  Trash2,
  Upload,
  X,
  BookOpen,
  Sparkles,
  Archive,
  Layers,
  Info,
} from "lucide-react";
import api, { apiService, type UploadResponse } from "@/lib/api";
import { useAuth } from "@/contexts/BasicAuthContext";
import StudentProfileModal from "@/components/dashboard/StudentProfileModal";
import LabMateLogo from "@/components/brand/LabMateLogo";
import {
  errorMessage,
  saveReport,
  workflowApi,
  type LabLanguage,
  type LabQuestion,
  type LabWorkflow,
  type ManualMode,
  type BatchItem,
} from "@/lib/workflow";
import styles from "./processing.module.css";

const languages: { value: LabLanguage; label: string }[] = [
  { value: "auto", label: "Use detected languages" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "html", label: "HTML / CSS / JavaScript" },
  { value: "react", label: "React" },
  { value: "node", label: "Node.js" },
];
const stages = [
  {
    title: "Read document",
    description: "Read the uploaded PDF or Word file.",
    icon: FileText,
    key: "extract",
  },
  {
    title: "Find questions",
    description: "Extract and review the actual questions.",
    icon: ListChecks,
    key: "review",
  },
  {
    title: "Generate & run",
    description: "Create answers, run code, capture output.",
    icon: Code2,
    key: "generate",
  },
  {
    title: "Create Word report",
    description: "Combine your original file and results.",
    icon: ImageIcon,
    key: "report",
  },
];
const outputName = (name: string) =>
  (name
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .slice(0, 60) || "lab_assignment") + "_completed";

export default function AssignmentPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<UploadResponse | null>(null);
  const [workflow, setWorkflow] = useState<LabWorkflow | null>(null);
  const [questions, setQuestions] = useState<LabQuestion[]>([]);
  const [language, setLanguage] = useState<LabLanguage>("auto");
  const [screenshotStyle, setScreenshotStyle] = useState<string>("style_1");
  const [instructions, setInstructions] = useState("");
  const [filename, setFilename] = useState("lab_report");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [preview, setPreview] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [manualMode, setManualMode] = useState<ManualMode>("code_only");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [processingTriggered, setProcessingTriggered] = useState(false);

  const running =
    workflow?.status === "queued" || workflow?.status === "processing" || workflow?.status === "extracting";
  const isProcessingActive = processingTriggered || running || batchProcessing;
  const complete = workflow?.status === "completed";
  const failed = workflow?.status === "failed" || workflow?.status === "paused";
  const progress = workflow?.progress || 0;
  const resultsDone = workflow?.results.length || 0;
  const total = workflow?.questions.length || questions.length;
  const warningCount =
    workflow?.results.filter((result) => result.status === "failed").length ||
    0;

  const applyWorkflow = (data: LabWorkflow, restoreFields = false) => {
    setWorkflow(data);
    if (data.status === "ready" || restoreFields) setQuestions(data.questions);
    if (restoreFields) {
      setLanguage(data.language);
      setInstructions(data.instructions);
      setFilename(data.output_name);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    let active = true;
    const id = Number(
      new URLSearchParams(window.location.search).get("assignment"),
    );
    if (!Number.isSafeInteger(id) || id < 1) return;
    const restore = async () => {
      setBusy(true);
      try {
        const assignment = (await api.get(`/api/assignments/${id}`)).data;
        if (!active) return;
        setUpload({
          ...assignment,
          file_size: assignment.file_size || 0,
          file_type: assignment.original_filename.split(".").pop() || "docx",
        });
        setFilename(outputName(assignment.original_filename));
        try {
          const state = await workflowApi.status(id);
          if (active) applyWorkflow(state, true);
        } catch (requestError: any) {
          if (requestError?.response?.status !== 404) throw requestError;
        }
      } catch (requestError) {
        if (active) setError(errorMessage(requestError));
      } finally {
        if (active) setBusy(false);
      }
    };
    restore();
    return () => {
      active = false;
    };
  }, [authLoading, user?.id, router]);

  useEffect(() => {
    if (!upload || !running) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const state = await workflowApi.status(upload.id);
        if (active) {
          applyWorkflow(state);
          setError("");
        }
      } catch (requestError) {
        if (active) setError(errorMessage(requestError));
      }
      if (active) timer = setTimeout(poll, workflow?.status === "queued" ? 5000 : 3000);
    };
    timer = setTimeout(poll, 1000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [upload?.id, running]);

  useEffect(() => {
    if (!upload || !complete || !workflow?.report) return;
    let active = true;
    setPreviewLoading(true);
    workflowApi
      .preview(upload.id)
      .then((html) => {
        if (active) setPreview(html);
      })
      .catch((requestError) => {
        if (active) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [upload?.id, complete, workflow?.report?.id]);

  const extract = async (id: number) => {
    const state = await workflowApi.extract(id);
    applyWorkflow(state);
  };

  const uploadFile = async (file?: File) => {
    if (!file || busy || running) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setError("Choose a PDF or Word (.docx) document.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Choose a document smaller than 50 MB.");
      return;
    }
    setBusy(true);
    setError("");
    setPreview("");
    setWorkflow(null);
    setQuestions([]);
    try {
      const uploaded = await apiService.uploadFile(file);
      setUpload(uploaded);
      setFilename(outputName(uploaded.original_filename));
      router.replace(`/code-execution?assignment=${uploaded.id}`, {
        scroll: false,
      });
      await extract(uploaded.id);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const handleFiles = async (fileList?: FileList | File[] | null) => {
    if (!fileList || !fileList.length || busy || running || batchProcessing) return;
    const files = Array.from(fileList);
    if (files.length > 10) {
      setError("Maximum 10 documents can be uploaded at once.");
      return;
    }

    if (files.length === 1) {
      setIsBatchMode(false);
      setBatchItems([]);
      uploadFile(files[0]);
      return;
    }

    // Multiple files (2 to 10 files)
    setIsBatchMode(true);
    setUpload(null);
    setWorkflow(null);
    setQuestions([]);
    setError("");

    const initialItems: BatchItem[] = files.map((f, i) => ({
      id: `batch_${Date.now()}_${i}`,
      file: f,
      status: "idle",
      progress: 0,
      stage: "Queued",
    }));
    setBatchItems(initialItems);
    setBatchProcessing(true);

    try {
      for (let i = 0; i < initialItems.length; i++) {
        const item = initialItems[i];
        if (!/\.(pdf|docx)$/i.test(item.file.name)) {
          setBatchItems((prev) =>
            prev.map((it, idx) =>
              idx === i
                ? { ...it, status: "failed", stage: "Unsupported format", error: "Only PDF or DOCX allowed" }
                : it
            )
          );
          continue;
        }

        setBatchItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: "uploading", stage: "Uploading document", progress: 15 } : it
          )
        );

        try {
          const uploaded = await apiService.uploadFile(item.file);
          setBatchItems((prev) =>
            prev.map((it, idx) =>
              idx === i
                ? { ...it, uploadId: uploaded.id, status: "extracting", stage: "Extracting questions", progress: 30 }
                : it
            )
          );

          // Trigger extraction
          let wf = await workflowApi.extract(uploaded.id);
          let attempts = 0;
          while (
            (wf.status === "extracting" || (wf.status === "queued" && wf.stage === "extract")) &&
            attempts < 35
          ) {
            await new Promise((r) => setTimeout(r, 2000));
            wf = await workflowApi.status(uploaded.id);
            attempts++;
          }

          if (wf.status === "ready" && wf.questions && wf.questions.length > 0) {
            setBatchItems((prev) =>
              prev.map((it, idx) =>
                idx === i
                  ? { ...it, status: "processing", stage: `Generating ${wf.questions.length} exercises`, progress: 50 }
                  : it
              )
            );

            // Process with selected manualMode
            let runWf = await workflowApi.process(uploaded.id, {
              questions: wf.questions,
              language: "auto",
              instructions: "",
              output_name: outputName(item.file.name),
              screenshot_style: screenshotStyle,
              mode: manualMode,
            });

            let runAttempts = 0;
            while (
              (runWf.status === "processing" || runWf.status === "queued" || runWf.status === "extracting") &&
              runAttempts < 180
            ) {
              await new Promise((r) => setTimeout(r, 3000));
              runWf = await workflowApi.status(uploaded.id);
              runAttempts++;
              setBatchItems((prev) =>
                prev.map((it, idx) =>
                  idx === i
                    ? {
                        ...it,
                        stage: runWf.stage || "Capturing IDE screenshots",
                        progress: Math.max(50, runWf.progress || 60),
                      }
                    : it
                )
              );
            }

            if (runWf.status === "completed" && runWf.report) {
              setBatchItems((prev) =>
                prev.map((it, idx) =>
                  idx === i
                    ? {
                        ...it,
                        status: "completed",
                        stage: "Manual Ready",
                        progress: 100,
                        reportId: runWf.report!.id,
                        reportFilename: runWf.report!.filename,
                        workflow: runWf,
                      }
                    : it
                )
              );
            } else {
              setBatchItems((prev) =>
                prev.map((it, idx) =>
                  idx === i
                    ? {
                        ...it,
                        status: "failed",
                        stage: runWf.error || "Failed",
                        progress: 100,
                        error: runWf.error || "Execution warning",
                      }
                    : it
                )
              );
            }
          } else {
            setBatchItems((prev) =>
              prev.map((it, idx) =>
                idx === i
                  ? { ...it, status: "failed", stage: wf.error || "No questions found", error: wf.error }
                  : it
              )
            );
          }
        } catch (fileErr: any) {
          setBatchItems((prev) =>
            prev.map((it, idx) =>
              idx === i ? { ...it, status: "failed", stage: "Error", error: fileErr?.message || "Failed" } : it
            )
          );
        }
      }
    } finally {
      setBatchProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const downloadAllBatch = async () => {
    const completed = batchItems.filter((it) => it.status === "completed" && it.reportId);
    if (!completed.length) return;
    for (const it of completed) {
      if (it.reportId && it.reportFilename) {
        await saveReport(it.reportId, it.reportFilename);
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  };

  const process = async () => {
    if (!upload || !questions.length || busy || running) return;
    if (questions.some((question) => !question.text.trim())) {
      setError("Every question needs some text.");
      setShowQuestions(true);
      return;
    }
    setProcessingTriggered(true);
    setBusy(true);
    setError("");
    setPreview("");
    try {
      applyWorkflow(
        await workflowApi.process(upload.id, {
          questions,
          language,
          instructions,
          output_name: filename || "lab_report",
          screenshot_style: screenshotStyle,
          mode: manualMode,
        }),
      );
    } catch (requestError) {
      setProcessingTriggered(false);
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const retryExtraction = async () => {
    if (!upload) return;
    setBusy(true);
    setError("");
    try {
      await extract(upload.id);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!workflow?.report) return;
    setDownloading(true);
    try {
      await saveReport(workflow.report.id, workflow.report.filename);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setDownloading(false);
    }
  };

  const reset = () => {
    setProcessingTriggered(false);
    setUpload(null);
    setWorkflow(null);
    setQuestions([]);
    setPreview("");
    setError("");
    router.replace("/code-execution");
  };
  const stageIndex = complete
    ? 4
    : workflow?.stage === "report"
      ? 3
      : ["generate", "execute", "capture"].includes(workflow?.stage || "")
        ? 2
        : workflow?.status === "ready"
          ? 2
          : 0;
  const statusText = complete
    ? "Word document ready"
    : failed
      ? "Processing needs attention"
      : workflow?.status === "queued"
        ? `Waiting in the queue${workflow.queue_position ? ` · position ${workflow.queue_position}` : ""}`
      : workflow?.status === "ready"
        ? `${total} questions ready to review`
        : running
          ? "Processing in progress"
          : busy
            ? "Uploading document"
            : "Ready for your assignment";

  const getActionLabel = () => {
    if (complete) return "Word report ready";
    if (failed) return workflow?.error || "Processing failed";
    if (isBatchMode && batchProcessing) {
      const activeItem = batchItems.find(
        (b) => b.status === "uploading" || b.status === "processing" || b.status === "extracting"
      );
      if (activeItem) return `Processing ${activeItem.file.name} (${activeItem.stage})`;
      return "Processing batch documents...";
    }
    if (isProcessingActive) {
      if (busy && !running) return "Initializing sandbox execution pipeline...";
      if (workflow?.status === "extracting") return "Decomposing syllabus & testcases...";
      if (workflow?.status === "queued") {
        return workflow.queue_position
          ? `Queued in sandbox pipeline (position ${workflow.queue_position})...`
          : "Queued in sandbox pipeline...";
      }
      if (running) {
        const lastLog = workflow?.logs?.length ? workflow.logs[workflow.logs.length - 1].message : "";
        if (lastLog && !lastLog.toLowerCase().includes("complete")) {
          return lastLog;
        }
        if (workflow?.stage === "extract") return "Extracting questions & aims...";
        if (workflow?.stage === "generate") return "Synthesizing verified code in 5 languages...";
        if (workflow?.stage === "execute") return "Executing in 512MB POSIX sandbox...";
        if (workflow?.stage === "capture") return "Capturing terminal output & proofs...";
        if (workflow?.stage === "report") return "Compiling accredited Word report...";
        return "Executing assignment pipeline...";
      }
      return "Initializing sandbox execution pipeline...";
    }
    return "Waiting for assignment document";
  };

  return (
    <div className={styles.page}>
      {/* Background DotGrid: pure CSS dot matrix, instant 0ms load */}
      <div className={styles.pageDotsContainer} />

      <StudentProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
      <section className={styles.content}>
        <header className={styles.header}>
          <div className={styles.headerLead}>
            <Link href="/" className={styles.brand} aria-label="LabMate home">
              <LabMateLogo size="sm" theme="dark" />
            </Link>
            <div className={styles.headerCopy}>
              <h1>Code execution</h1>
              <p>Turn a lab manual into tested code and a submission-ready report.</p>
            </div>
          </div>
          <div className={styles.account}>
            <span className={styles.topAvatar}>{user?.name?.charAt(0).toUpperCase() || "L"}</span>
            <strong>{user?.name || "LabMate"}</strong>
          </div>
        </header>

        <main className={styles.layout}>
        <aside className={styles.setupPanel}>
          <h2 className={styles.panelTitle}>Build your lab report</h2>
          <p className={styles.setupIntro}>
            Configure the source, review the extracted questions, then run the verified pipeline.
          </p>
          <div className={styles.step}>
            <span className={styles.stepNumber}>1</span>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <h2>Upload assignment</h2>
                <button
                  type="button"
                  className={styles.personalizeBtn}
                  onClick={() => setShowProfileModal(true)}
                  title="Configure real student name and USN for code outputs"
                >
                  <Sparkles size={13} color="#16a34a" /> Personalize
                </button>
              </div>
              <p>PDF or DOCX · up to 10 documents</p>

              {/* Mode Toggle: Code Only vs Theory & Code */}
              <div style={{ marginTop: "8px", marginBottom: "12px" }}>
                <div className={styles.modeSelector}>
                  <button
                    type="button"
                    className={`${styles.modeButton} ${manualMode === "code_only" ? styles.modeButtonActive : ""}`}
                    onClick={() => setManualMode("code_only")}
                    disabled={running || busy || batchProcessing}
                  >
                    <Code2 size={14} /> Code Only
                  </button>
                  <button
                    type="button"
                    className={`${styles.modeButton} ${manualMode === "theory_and_code" ? styles.modeButtonActive : ""}`}
                    onClick={() => setManualMode("theory_and_code")}
                    disabled={running || busy || batchProcessing}
                  >
                    <BookOpen size={14} /> Theory &amp; Code
                  </button>
                </div>
                {manualMode === "theory_and_code" && (
                  <div className={styles.handwrittenNotice}>
                    <Info size={13} style={{ flexShrink: 0, marginTop: "2px" }} />
                    <span>Theory answers will be included. Handwritten questions are automatically detected and excluded.</span>
                  </div>
                )}
              </div>

              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx"
                multiple
                hidden
                onChange={(event) => handleFiles(event.target.files)}
              />

              {isBatchMode && batchItems.length > 0 ? (
                <div className={styles.batchSection}>
                  <div className={styles.batchHeader}>
                    <strong>
                      Batch Progress: {batchItems.filter((b) => b.status === "completed").length} / {batchItems.length} Completed
                    </strong>
                    {batchItems.some((b) => b.status === "completed") && (
                      <button className={styles.batchZipButton} onClick={downloadAllBatch} title="Download all finished manuals">
                        <Archive size={14} /> Download All
                      </button>
                    )}
                  </div>
                  {batchItems.map((item) => (
                    <div key={item.id} className={styles.batchItemCard}>
                      <FileText size={20} className={styles.batchFileIcon} />
                      <div className={styles.batchItemInfo}>
                        <span className={styles.batchItemName}>{item.file.name}</span>
                        <div className={styles.batchItemMeta}>
                          <span>{(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
                          <span>·</span>
                          <span>{item.stage}</span>
                        </div>
                        {item.status !== "completed" && item.status !== "failed" && (
                          <div className={styles.batchItemProgress}>
                            <div className={styles.batchItemProgressBar} style={{ width: `${item.progress}%` }} />
                          </div>
                        )}
                      </div>
                      <span
                        className={`${styles.badgeStatus} ${
                          item.status === "completed"
                            ? styles.badgeCompleted
                            : item.status === "processing" || item.status === "extracting"
                              ? styles.badgeProcessing
                              : item.status === "failed"
                                ? styles.badgeFailed
                                : styles.badgePending
                        }`}
                      >
                        {item.status}
                      </span>
                      {item.status === "completed" && item.reportId && (
                        <button
                          onClick={() => saveReport(item.reportId!, item.reportFilename || "lab_manual.docx")}
                          className={styles.batchDownloadButton}
                          title="Download document"
                        >
                          <Download size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      setIsBatchMode(false);
                      setBatchItems([]);
                      reset();
                    }}
                    className={styles.clearBatchButton}
                  >
                    Clear Batch &amp; Upload New
                  </button>
                </div>
              ) : upload ? (
                <div className={styles.fileCard}>
                  <FileText size={26} />
                  <div>
                    <strong>{upload.original_filename}</strong>
                    <small>
                      {upload.file_size
                        ? `${(upload.file_size / 1024 / 1024).toFixed(2)} MB · `
                        : ""}
                      Uploaded
                    </small>
                  </div>
                  <CheckCircle2 className={styles.fileCheck} size={19} />
                  <button
                    onClick={reset}
                    disabled={running || busy}
                    aria-label="Choose another document"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ) : (
                <button
                  className={`${styles.dropZone} ${dragging ? styles.dragging : ""}`}
                  onClick={() => inputRef.current?.click()}
                  disabled={busy || batchProcessing}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    handleFiles(event.dataTransfer.files);
                  }}
                >
                  <Upload size={27} />
                  <strong>
                    {busy || batchProcessing
                      ? "Uploading..."
                      : "Choose or drop up to 10 manuals"}
                  </strong>
                  <small>PDF or Word documents · Max 10 files</small>
                </button>
              )}
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>2</span>
            <div>
              <h2>Extract &amp; analyze</h2>
              <p>Find questions in your document.</p>
              <div className={styles.statusRow}>
                {workflow?.status === "extracting" || (workflow?.status === "queued" && workflow.stage === "extract") ? (
                  <Loader2 className={styles.spin} size={18} />
                ) : (
                  <ListChecks size={19} />
                )}
                <span>
                  {workflow?.status === "extracting"
                    ? "Reading and extracting..."
                    : workflow?.status === "queued" && workflow.stage === "extract"
                      ? "Queued for question extraction"
                    : questions.length
                      ? `${questions.length} questions extracted`
                      : "Waiting for a document"}
                </span>
              </div>
              {upload && !running && !questions.length && (
                <button
                  className={styles.textButton}
                  disabled={busy}
                  onClick={retryExtraction}
                >
                  Extract questions <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>3</span>
            <div>
              <h2>Programming language</h2>
              <p>Use the detected language or choose one.</p>
              <select
                aria-label="Programming language"
                value={language}
                disabled={running || busy}
                onChange={(event) =>
                  setLanguage(event.target.value as LabLanguage)
                }
              >
                {languages.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {(language === "python" || language === "auto") && (
                <div style={{ marginTop: "12px" }}>
                  <label className={styles.screenshotLabel}>
                    Python IDLE Screenshot Style
                  </label>
                  <select
                    aria-label="Python screenshot layout style"
                    value={screenshotStyle}
                    disabled={running || busy}
                    onChange={(event) => setScreenshotStyle(event.target.value)}
                  >
                    <option value="style_1">Style 1: Output Down (Editor on Top, Shell Below)</option>
                    <option value="style_2">Style 2: Output Side (Editor Left, Shell on Side)</option>
                    <option value="style_3">Style 3: Two Different Windows (Side by Side)</option>
                  </select>
                </div>
              )}
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>4</span>
            <div>
              <h2>Extracted questions</h2>
              <p>Review and edit before processing.</p>
              <button
                className={styles.questionsButton}
                onClick={() => setShowQuestions(!showQuestions)}
                disabled={!questions.length || running}
              >
                <FileText size={19} />
                <span>{questions.length} questions detected</span>
                <span>
                  {showQuestions ? "Hide" : "Review"} <ChevronDown size={14} />
                </span>
              </button>
              {showQuestions && (
                <div className={styles.questionEditor}>
                  {questions.map((question, index) => (
                    <label key={question.id}>
                      <strong>
                        Question {index + 1} · {question.language}
                      </strong>
                      <textarea
                        value={question.text}
                        onChange={(event) =>
                          setQuestions(
                            questions.map((q) =>
                              q.id === question.id
                                ? { ...q, text: event.target.value }
                                : q,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>5</span>
            <div>
              <h2>
                Additional instructions <span>(optional)</span>
              </h2>
              <p>Add requirements, constraints, or notes.</p>
              <textarea
                aria-label="Additional instructions"
                value={instructions}
                maxLength={5000}
                disabled={running || busy}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="e.g. Use functions, follow the manual format, and explain the sample inputs."
              />
            </div>
          </div>
          <div className={`${styles.step} ${styles.lastStep}`}>
            <span className={styles.stepNumber}>6</span>
            <div>
              <h2>File settings</h2>
              <p>Your original assignment plus answers and screenshots.</p>
              <label className={styles.filenameLabel}>
                File name
                <div>
                  <input
                    aria-label="Output file name"
                    value={filename}
                    maxLength={80}
                    disabled={running || busy}
                    onChange={(event) =>
                      setFilename(
                        event.target.value.replace(/[^A-Za-z0-9_-]/g, "_"),
                      )
                    }
                  />
                  <span>.docx</span>
                </div>
              </label>
              <div className={styles.formatRow}>
                <span>Output format</span>
                <strong>Word document (.docx)</strong>
              </div>
            </div>
          </div>
          {error && (
            <div className={styles.errorBox} role="alert">
              {error}
            </div>
          )}
          <button
            className={styles.startButton}
            disabled={!questions.length || running || busy || complete}
            onClick={process}
          >
            {running || busy ? (
              <Loader2 className={styles.spin} size={18} />
            ) : (
              <Code2 size={19} />
            )}
            {complete
              ? "Report completed"
              : running
                ? "Processing..."
                : "Start processing"}
            <ArrowRight size={18} />
          </button>
        </aside>
        <section className={styles.workspaceBox}>
          {/* Dedicated Dot UI for right-hand workspace */}
          <DotGrid
            dotColor="#ffffff"
            backgroundColor="transparent"
            spacing={22}
            dotSize={1.6}
            baseOpacity={0.22}
            isProcessing={isProcessingActive}
          />

          {/* Floating top bar with logs button */}
          <div className={styles.workspaceOverlayTop}>
            <button
              className={styles.darkLogsBtn}
              onClick={() => setShowLogs(!showLogs)}
            >
              <Terminal size={14} />
              {showLogs ? "Hide logs" : "View logs"}
            </button>
          </div>

          {/* Center of the right box: LatticeLoader listing what it is doing */}
          <div className={styles.centerStageBox}>
            <div className={styles.loaderGlassCard}>
              <LatticeLoader
                status={complete ? "done" : failed ? "error" : "working"}
                label={getActionLabel()}
                doneLabel="Completed in"
                errorLabel="Paused after"
                pattern="orbit"
                grid={3}
                shape="round"
                color={isProcessingActive ? "#ffffff" : "#94a3b8"}
                doneColor="#22c55e"
                errorColor="#ef4444"
                cellSize={7}
                gap={3}
                fontSize={16}
                step={90}
                idleOpacity={isProcessingActive ? 0.25 : 0.15}
                glow={isProcessingActive}
                glowColor="#d4d4d8"
                showTimer={isProcessingActive || complete}
                elapsed={!isProcessingActive && !complete ? 0 : undefined}
              />

              {complete && (
                <button
                  className={styles.downloadDoneBtn}
                  onClick={download}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 className={styles.spin} size={16} />
                  ) : (
                    <Download size={16} />
                  )}
                  Download Word Report (.docx)
                </button>
              )}

              {failed && (
                <div className={styles.failedActions}>
                  <p className={styles.failedText}>
                    {workflow?.error || "Processing encountered an issue."}
                  </p>
                  <button
                    className={styles.retryBtn}
                    onClick={questions.length ? process : retryExtraction}
                    disabled={busy}
                  >
                    <RefreshCw size={15} />
                    Retry {questions.length ? "processing" : "extraction"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Floating log drawer when user views logs */}
          {showLogs && (
            <div className={styles.floatingLogPanel}>
              <div className={styles.logPanelHeader}>
                <span>Execution Logs</span>
                <button onClick={() => setShowLogs(false)} aria-label="Close logs">
                  <X size={15} />
                </button>
              </div>
              <div className={styles.logList}>
                {workflow?.logs?.length ? (
                  workflow.logs.map((log, index) => (
                    <div key={index} className={styles.logEntry}>
                      <time>{new Date(log.time).toLocaleTimeString()}</time>
                      <span>{log.message}</span>
                    </div>
                  ))
                ) : (
                  <p className={styles.logEmpty}>No events logged yet.</p>
                )}
              </div>
            </div>
          )}
        </section>
        </main>
      </section>
    </div>
  );
}
