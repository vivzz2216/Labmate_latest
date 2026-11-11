"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Upload,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  User,
  Hash,
  BookOpen,
  Building2,
  GraduationCap,
  UserCheck,
  Sun,
  Moon,
  LogOut,
  ArrowUpRight,
  Mail,
  Copy,
  Check,
  Sparkles,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import DashboardShell, {
  EmptyState,
  LoadingState,
  formatDate,
  useDashboardTheme,
} from "@/components/dashboard/DashboardShell";
import CreditStatus from "@/components/billing/CreditStatus";
import dashStyles from "@/app/dashboard/dashboard.module.css";
import { useAuth } from "@/contexts/BasicAuthContext";
import { apiService } from "@/lib/api";
import { saveReport } from "@/lib/workflow";
import styles from "./settings.module.css";

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

type PromptPresetId = "standard" | "strict_record" | "webdev" | "sql_colab";

function buildCollegeManualPromptTemplate(
  preset: PromptPresetId,
  student: {
    name: string;
    usn: string;
    department: string;
    institution: string;
  },
): string {
  const studentHeader = [
    `Student Name: ${student.name || "<Your Name>"}`,
    `USN / Roll No: ${student.usn || "<Your USN / Roll No>"}`,
    `Department: ${student.department || "<Your Department>"}`,
    `Institution: ${student.institution || "<Your College / University>"}`,
  ].join("\n");

  if (preset === "strict_record") {
    return `You are preparing an accredited college laboratory manual for the LabMate Execution Agent.
Convert my raw college syllabus / lab questions into clean, strictly numbered experiments that the LabMate Agent will execute and compile into a Word record.

### STUDENT METADATA
${studentHeader}

### STRICT FORMATTING RULES FOR LABMATE AGENT
1. Number every experiment sequentially as:
   Experiment 1: <Experiment Title>
   Experiment 2: <Experiment Title>
2. Under each experiment, include these exact sections in order:
   Aim: <1-2 sentence objective of the experiment>
   Problem Statement: <Complete programming problem statement and input/output specifications>
   Tasks:
   - <Step-by-step functional requirements to implement>
   Expected Output: <Sample test cases, console outputs, or UI states to capture>
3. Do NOT include handwritten/drawing tasks or duplicate experiment numbers.
4. Explicitly state the target language in the heading or problem statement (Python, Java, C, C++, HTML/CSS/JS, React, Node.js, SQL, or Ubuntu/Bash).

---
PASTE RAW COLLEGE SYLLABUS / MANUAL BELOW:
[Paste your college manual questions here]`;
  }

  if (preset === "webdev") {
    return `You are formatting a Web Development (HTML/CSS/JS, React, or Node.js/Express) college lab manual for the LabMate Execution Agent.

### STUDENT METADATA
${studentHeader}

### WEB DEV MANUAL STRUCTURE FOR LABMATE AGENT
For each experiment, output:
Experiment <N>: <Title — e.g., Responsive Portfolio / Interactive Calculator / React Todo App>
Aim: <Objective of the web application>
Problem Statement: <Full UI, layout, form fields, buttons, and interactive behavior required>
Tasks:
- Specify exact form inputs, button labels, and validation rules so LabMate's headless browser agent can fill, click, and verify them automatically.
- Specify the technology stack (HTML/CSS/JS, React, or Node.js + Express).
Expected Output: <Initial rendered view and post-interaction state to screenshot>

---
PASTE RAW WEB DEV LAB QUESTIONS BELOW:
[Paste your Web Dev lab manual here]`;
  }

  if (preset === "sql_colab") {
    return `You are formatting a Database (SQL / MySQL) or Data Science (Python / Google Colab) lab manual for the LabMate Execution Agent.

### STUDENT METADATA
${studentHeader}

### SQL & DATA SCIENCE MANUAL STRUCTURE FOR LABMATE AGENT
For each experiment, output:
Experiment <N>: <Title — e.g., MySQL Joins & Triggers / Data Preprocessing & Classification in Colab>
Aim: <Objective of the query script or notebook experiment>
Problem Statement: <Complete schema/dataset description and analytical or query steps>
Tasks:
- For SQL: List CREATE TABLE, INSERT sample rows, and SELECT / JOIN / TRIGGER / PROCEDURE queries in execution order.
- For Colab / Data Science: List dataset generation/loading, preprocessing, model training, evaluation metrics, and matplotlib/seaborn plots required.
Expected Output: <Tables, query outputs, or notebook charts to capture in the report>

---
PASTE RAW SQL / DATA SCIENCE LAB MANUAL BELOW:
[Paste your lab manual here]`;
  }

  return `You are formatting my college laboratory manual so the LabMate AI Execution Agent follows every experiment specification accurately.

### STUDENT CREDENTIALS (AUTO-INJECTED BY LABMATE)
${studentHeader}

### REQUIRED MANUAL TEMPLATE (YourCollegeManualPrompt)
Format every lab exercise using the exact structure below so LabMate's parser and execution runtime preserve 100% of your manual requirements:

General Instructions
- Language: <Python | Java | C | C++ | HTML/CSS/JS | React | Node.js | SQL | Google Colab | Ubuntu Bash>
- Follow clean academic coding conventions, include student header comments when requested, and verify all outputs.

Experiment 1: <Exact Experiment Title>
Aim: <State the precise academic aim of Experiment 1>
Problem Statement: <Provide the full problem description, constraints, and sample inputs>
Tasks:
1. <Sub-task or requirement 1>
2. <Sub-task or requirement 2>
Expected Output: <Describe the console output, GUI window, SQL table, or browser state to capture>

Experiment 2: <Exact Experiment Title>
Aim: <State the precise academic aim of Experiment 2>
Problem Statement: <Provide the full problem description, constraints, and sample inputs>
Tasks:
1. <Sub-task or requirement 1>
Expected Output: <Describe the expected output to verify and screenshot>

---
PASTE YOUR RAW COLLEGE LAB MANUAL / SYLLABUS BELOW:
[Paste your college manual text here]`;
}

export default function UserDashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { theme, setTheme } = useDashboardTheme();
  const router = useRouter();

  const [assignments, setAssignments] = useState<Assignment[]>(
    () => (apiService.peekUserAssignments(user?.id) as Assignment[]) || [],
  );
  const [loading, setLoading] = useState(
    () => !apiService.peekUserAssignments(user?.id),
  );
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Student Profile & Personalization Settings State
  const [name, setName] = useState("");
  const [usn, setUsn] = useState("");
  const [department, setDepartment] = useState("");
  const [institution, setInstitution] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [collegeManualPrompt, setCollegeManualPrompt] = useState("");
  const [promptPreset, setPromptPreset] = useState<PromptPresetId>("standard");
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const [profileLoading, setProfileLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
      return;
    }

    if (user) {
      setName((prev) => prev || user.name || "");
      fetchAssignments();
      fetchProfile();
    }
  }, [user?.id, authLoading, router]);

  const fetchAssignments = async () => {
    if (!user?.id) return;
    const cached = apiService.peekUserAssignments(user.id) as Assignment[] | null;
    if (cached) {
      setAssignments(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const data: any = await apiService.getUserAssignments(user.id);
      const list = Array.isArray(data)
        ? data
        : (data?.assignments ?? data?.data ?? []);
      setAssignments(Array.isArray(list) ? list : []);
    } catch (err) {
      if (!cached) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch assignments",
        );
      }
      if ((err as any)?.response?.status !== 401 && (err as any)?.response?.status !== 403) {
        console.error("Error fetching assignments:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      setProfileLoading(true);
      const data = await apiService.getUserProfile();
      const profile = data?.profile || data || {};
      const resolvedName = profile.name || user?.name || "";
      if (resolvedName) {
        setName(resolvedName);
      }
      const resolvedDept = profile.course || "";
      const resolvedInst = profile.institution || "";
      setDepartment(resolvedDept);
      setInstitution(resolvedInst);
      const meta = profile.metadata || profile.profile_metadata || {};
      const resolvedUsn = meta.roll_number || meta.usn || meta.roll_no || "";
      setUsn(resolvedUsn);
      setAcademicYear(meta.year || "");
      setGraduationYear(meta.graduation_year || "");

      if (meta.college_manual_prompt) {
        setCollegeManualPrompt(meta.college_manual_prompt);
      } else {
        setCollegeManualPrompt(
          buildCollegeManualPromptTemplate("standard", {
            name: resolvedName,
            usn: resolvedUsn,
            department: resolvedDept,
            institution: resolvedInst,
          }),
        );
      }
    } catch (err) {
      if ((err as any)?.response?.status !== 401 && (err as any)?.response?.status !== 403) {
        console.error("Failed to load profile settings:", err);
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const saveProfileAndPrompt = async (customPromptValue?: string) => {
    setSavingProfile(true);
    setProfileMessage(null);
    const promptToSave =
      customPromptValue !== undefined ? customPromptValue : collegeManualPrompt;
    try {
      await apiService.updateUserProfile({
        name: name.trim(),
        course: department.trim(),
        institution: institution.trim(),
        profile_metadata: {
          roll_number: usn.trim(),
          usn: usn.trim(),
          department: department.trim(),
          year: academicYear.trim(),
          graduation_year: graduationYear.trim(),
          college_manual_prompt: promptToSave.trim(),
        },
      });
      setProfileMessage({
        type: "success",
        text: "Profile & College Manual Agent Prompt saved successfully!",
      });
    } catch (err: any) {
      setProfileMessage({
        type: "error",
        text:
          err?.response?.data?.detail ||
          err?.message ||
          "Failed to save profile settings.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProfileAndPrompt();
  };

  const handlePresetChange = (preset: PromptPresetId) => {
    setPromptPreset(preset);
    setCollegeManualPrompt(
      buildCollegeManualPromptTemplate(preset, {
        name: name.trim() || user?.name || "",
        usn: usn.trim(),
        department: department.trim(),
        institution: institution.trim(),
      }),
    );
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(collegeManualPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2200);
    } catch (err) {
      console.error("Failed to copy prompt:", err);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleUploadNew = () => {
    router.push("/code-execution");
  };

  const handleDownloadReport = async (assignment: Assignment) => {
    if (assignment.report_id) {
      try {
        await saveReport(
          assignment.report_id,
          assignment.report_filename ||
            `${assignment.original_filename || assignment.filename || "lab_report"}_completed.docx`,
        );
        return;
      } catch (err) {
        console.error("Failed to download report:", err);
      }
    }
    if (assignment.report_download_url) {
      window.open(assignment.report_download_url, "_blank");
    }
  };

  const getLanguageDisplay = (language?: string) => {
    switch ((language || "").toLowerCase()) {
      case "python":
        return "Python (IDLE)";
      case "colab":
        return "Python (Colab)";
      case "java":
        return "Java (Notepad)";
      case "c":
        return "C (CodeBlocks)";
      case "cpp":
        return "C++ (CodeBlocks)";
      case "webdev":
      case "html":
      case "react":
        return "Web Dev (VS Code)";
      case "sql":
        return "SQL (MySQL Workbench)";
      case "ubuntu":
        return "Ubuntu (Bash + GNOME)";
      default:
        return language ? language.toUpperCase() : "Not specified";
    }
  };

  const getStatusBadgeClass = (assignment: Assignment) => {
    if (
      assignment.completed_tasks === assignment.total_tasks &&
      assignment.total_tasks > 0
    ) {
      return styles.statusCompleted;
    } else if (assignment.failed_tasks > 0) {
      return styles.statusFailed;
    } else if (assignment.in_progress_tasks > 0) {
      return styles.statusInProgress;
    }
    return styles.statusPending;
  };

  const getStatusText = (assignment: Assignment) => {
    if (
      assignment.completed_tasks === assignment.total_tasks &&
      assignment.total_tasks > 0
    ) {
      return "Completed";
    } else if (assignment.failed_tasks > 0) {
      return "Failed";
    } else if (assignment.in_progress_tasks > 0) {
      return "In Progress";
    }
    return "Pending";
  };

  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) =>
      `${a.original_filename || a.filename} ${a.language || ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [assignments, search]);

  if (authLoading) {
    return (
      <DashboardShell
        title="Settings"
        subtitle="Manage your student profile, preferences, and account"
      >
        <div className={dashStyles.panel}>
          <LoadingState message="Loading your account settings..." />
        </div>
      </DashboardShell>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = name.trim() || user.name || "Student";

  return (
    <DashboardShell
      title="Settings"
      subtitle="Manage student credentials, YourCollegeManualPrompt template, theme preferences, and assignment history"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Filter your assignments..."
    >
      {/* Top Grid: Profile Settings (Left) + Account & Preferences (Right) */}
      <div className={styles.settingsGrid}>
        {/* Student Profile & Code Personalization Form */}
        <section className={dashStyles.panel}>
          <div className={dashStyles.panelHeader}>
            <div>
              <h2>Student Profile &amp; Code Personalization</h2>
              <p>
                Your credentials are automatically injected into generated code
                classes, test cases, and IDE window titles.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className={styles.formBody}>
            <div className={styles.fieldGrid}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="settings-name">
                  <User size={14} /> Full Student Name
                </label>
                <input
                  id="settings-name"
                  type="text"
                  className={styles.fieldInput}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  disabled={profileLoading}
                  required
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="settings-usn">
                  <Hash size={14} /> USN / Roll Number
                </label>
                <input
                  id="settings-usn"
                  type="text"
                  className={styles.fieldInput}
                  value={usn}
                  onChange={(e) => setUsn(e.target.value)}
                  placeholder="e.g. 1MS21CS042"
                  disabled={profileLoading}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="settings-dept">
                  <BookOpen size={14} /> Branch / Department
                </label>
                <input
                  id="settings-dept"
                  type="text"
                  className={styles.fieldInput}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Computer Science & Engineering"
                  disabled={profileLoading}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="settings-inst">
                  <Building2 size={14} /> College / University
                </label>
                <input
                  id="settings-inst"
                  type="text"
                  className={styles.fieldInput}
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g. Engineering College"
                  disabled={profileLoading}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="settings-year">
                  <GraduationCap size={14} /> Academic Year
                </label>
                <select
                  id="settings-year"
                  className={styles.fieldSelect}
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  disabled={profileLoading}
                >
                  <option value="">Select academic year</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="Graduate">Graduate</option>
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="settings-grad">
                  <Calendar size={14} /> Expected Graduation Year
                </label>
                <input
                  id="settings-grad"
                  type="text"
                  className={styles.fieldInput}
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  placeholder="e.g. 2026"
                  disabled={profileLoading}
                />
              </div>
            </div>

            {profileMessage && (
              <div
                role="status"
                className={`${styles.feedbackBanner} ${
                  profileMessage.type === "success"
                    ? styles.feedbackSuccess
                    : styles.feedbackError
                }`}
              >
                {profileMessage.text}
              </div>
            )}

            <div className={styles.formFooter}>
              <p className={styles.fieldHint}>
                Applied automatically to all future Python, Java, C/C++, SQL,
                and Web lab runs.
              </p>
              <button
                type="submit"
                disabled={savingProfile || profileLoading}
                className={dashStyles.primaryButton}
              >
                <UserCheck size={15} />
                {savingProfile ? "Saving Changes..." : "Save Profile Settings"}
              </button>
            </div>
          </form>
        </section>

        {/* Right Column: Account Overview & Theme Preferences */}
        <aside className={styles.rightColumn}>
          <section className={dashStyles.panel}>
            <div className={dashStyles.panelHeader}>
              <div>
                <h2>Account &amp; Appearance</h2>
                <p>Session details, experiment credits, and interface theme</p>
              </div>
            </div>

            <div className={styles.accountBody}>
              <div className={styles.profileIdentity}>
                <span className={styles.avatarLarge}>
                  {displayName.charAt(0).toUpperCase()}
                </span>
                <div className={styles.identityDetails}>
                  <h3>{displayName}</h3>
                  <p>
                    <Mail
                      size={12}
                      style={{ display: "inline", marginRight: 5 }}
                    />
                    {user.email}
                  </p>
                </div>
              </div>

              <CreditStatus />

              {user.is_admin && (
                <div className={styles.preferenceRow}>
                  <div className={styles.preferenceLabel}>
                    <strong>Platform Owner Console</strong>
                    <small>
                      View registered students, usage &amp; live Razorpay
                      revenue
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/admin/dashboard")}
                    className={dashStyles.primaryButton}
                  >
                    <ShieldCheck size={14} /> Owner Dashboard
                  </button>
                </div>
              )}

              <div className={styles.preferenceRow}>
                <div className={styles.preferenceLabel}>
                  <strong>Interface Theme</strong>
                  <small>Synced across Dashboard, Workspace &amp; Reports</small>
                </div>
                <div
                  className={styles.themeSwitcher}
                  role="group"
                  aria-label="Theme selection"
                >
                  <button
                    type="button"
                    className={`${styles.themeOption} ${
                      theme === "dark" ? styles.themeOptionActive : ""
                    }`}
                    onClick={() => setTheme("dark")}
                  >
                    <Moon size={13} /> Dark
                  </button>
                  <button
                    type="button"
                    className={`${styles.themeOption} ${
                      theme === "light" ? styles.themeOptionActive : ""
                    }`}
                    onClick={() => setTheme("light")}
                  >
                    <Sun size={13} /> Light
                  </button>
                </div>
              </div>

              <div className={styles.accountActions}>
                <button
                  type="button"
                  onClick={handleUploadNew}
                  className={dashStyles.secondaryButton}
                >
                  <Upload size={14} /> Upload New Assignment
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={styles.dangerButton}
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* YourCollegeManualPrompt — Agent Prompt Template Panel */}
      <section className={dashStyles.panel} id="your-college-manual-prompt">
        <div className={dashStyles.panelHeader}>
          <div>
            <h2>
              <Sparkles
                size={15}
                style={{
                  display: "inline",
                  marginRight: 7,
                  verticalAlign: "-2px",
                  color: "#60a5fa",
                }}
              />
              YourCollegeManualPrompt — Agent Manual Prompt Template
            </h2>
            <p>
              Copy this prompt template to structure any raw college lab manual
              or customize how the LabMate Agent follows your manual&apos;s
              conventions.
            </p>
          </div>
          <div className={styles.promptToolbarActions}>
            <button
              type="button"
              className={dashStyles.secondaryButton}
              onClick={() => handlePresetChange(promptPreset)}
              title="Reset to selected template preset with your current profile details"
            >
              <RotateCcw size={14} /> Reset Template
            </button>
            <button
              type="button"
              className={dashStyles.secondaryButton}
              onClick={handleCopyPrompt}
            >
              {copiedPrompt ? (
                <>
                  <Check size={14} /> Copied to Clipboard!
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy Agent Prompt
                </>
              )}
            </button>
            <button
              type="button"
              className={dashStyles.primaryButton}
              disabled={savingProfile || profileLoading}
              onClick={() => saveProfileAndPrompt(collegeManualPrompt)}
            >
              <UserCheck size={14} />
              {savingProfile ? "Saving..." : "Save Agent Prompt"}
            </button>
          </div>
        </div>

        <div className={styles.promptBody}>
          <div className={styles.promptTopRow}>
            <div
              className={styles.presetGroup}
              role="tablist"
              aria-label="Prompt template presets"
            >
              {(
                [
                  { id: "standard", label: "Standard College Manual" },
                  {
                    id: "strict_record",
                    label: "Strict Record (Aim / Task / Output)",
                  },
                  { id: "webdev", label: "Web Dev / Full-Stack" },
                  { id: "sql_colab", label: "SQL & Data Science (Colab)" },
                ] as { id: PromptPresetId; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={promptPreset === item.id}
                  className={`${styles.presetBtn} ${
                    promptPreset === item.id ? styles.presetBtnActive : ""
                  }`}
                  onClick={() => handlePresetChange(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.promptStepsGrid}>
            <div className={styles.promptStepCard}>
              <strong>1. Choose or Customize Template</strong>
              <span>
                Select a preset above or edit the prompt below with your
                college&apos;s specific lab manual rules.
              </span>
            </div>
            <div className={styles.promptStepCard}>
              <strong>2. Format Raw Manuals Instantly</strong>
              <span>
                Click &ldquo;Copy Agent Prompt&rdquo; and paste it with your raw
                syllabus into any AI to generate a clean `.docx` manual.
              </span>
            </div>
            <div className={styles.promptStepCard}>
              <strong>3. Saved for LabMate Agent Runs</strong>
              <span>
                Click &ldquo;Save Agent Prompt&rdquo; so LabMate&apos;s execution
                agent automatically applies your manual preferences.
              </span>
            </div>
          </div>

          <div className={styles.promptTextareaWrap}>
            <div className={styles.promptTextareaHeader}>
              <span>YourCollegeManualPrompt.txt — Agent Prompt Template</span>
              <span>
                Auto-linked to {displayName} ({usn || "No USN set"})
              </span>
            </div>
            <textarea
              aria-label="College Manual Agent Prompt Template"
              className={styles.promptTextarea}
              value={collegeManualPrompt}
              onChange={(e) => setCollegeManualPrompt(e.target.value)}
              spellCheck={false}
            />
          </div>
        </div>
      </section>

      {/* Assignment History & Task Breakdown Panel */}
      <section className={dashStyles.panel}>
        <div className={dashStyles.panelHeader}>
          <div>
            <h2>Your Assignment History</h2>
            <p>
              {filteredAssignments.length === assignments.length
                ? `${assignments.length} total lab assignment${assignments.length === 1 ? "" : "s"} tracked`
                : `Showing ${filteredAssignments.length} of ${assignments.length} assignments`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleUploadNew}
            className={dashStyles.primaryButton}
          >
            <Upload size={15} /> Upload New Assignment
          </button>
        </div>

        {error && (
          <div className={dashStyles.dashboardError} role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <LoadingState message="Loading your assignments..." />
        ) : filteredAssignments.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={search ? "No Matching Assignments" : "No Assignments Yet"}
            description={
              search
                ? "Try a different search query."
                : "Upload your first lab assignment to get started with AI-powered processing."
            }
            action={{
              label: search ? "Clear Search" : "Upload Your First Assignment",
              onClick: () => (search ? setSearch("") : handleUploadNew()),
            }}
          />
        ) : (
          <div className={styles.historyScroll}>
            {filteredAssignments.map((assignment) => (
              <article key={assignment.id} className={styles.historyRow}>
                <div className={styles.historyInfo}>
                  <div className={styles.historyTitleRow}>
                    <h3>
                      {assignment.original_filename || assignment.filename}
                    </h3>
                    <span
                      className={`${styles.statusBadge} ${getStatusBadgeClass(assignment)}`}
                    >
                      {getStatusText(assignment)}
                    </span>
                  </div>

                  <div className={styles.historyMetaRow}>
                    <span className={styles.metaItem}>
                      <Calendar size={13} />
                      <span>{formatDate(assignment.uploaded_at)}</span>
                    </span>
                    <span className={styles.metaItem}>
                      <FileText size={13} />
                      <span>{getLanguageDisplay(assignment.language)}</span>
                    </span>
                  </div>

                  <div className={styles.taskCounters}>
                    <span className={styles.counterDone}>
                      <CheckCircle size={13} />
                      {assignment.completed_tasks} completed
                    </span>
                    <span className={styles.counterFailed}>
                      <XCircle size={13} />
                      {assignment.failed_tasks} failed
                    </span>
                    <span className={styles.counterActive}>
                      <Clock size={13} />
                      {assignment.in_progress_tasks} in progress
                    </span>
                  </div>
                </div>

                <div className={styles.historyActions}>
                  {(assignment.report_download_url || assignment.report_id) && (
                    <button
                      type="button"
                      className={dashStyles.secondaryButton}
                      onClick={() => handleDownloadReport(assignment)}
                    >
                      <Download size={14} />
                      Download Report
                    </button>
                  )}
                  <button
                    type="button"
                    className={dashStyles.primaryButton}
                    onClick={() =>
                      router.push(`/code-execution?assignment=${assignment.id}`)
                    }
                  >
                    View Details <ArrowUpRight size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
