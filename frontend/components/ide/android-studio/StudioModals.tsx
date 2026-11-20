"use client";

import React, { useEffect, useState } from "react";
import styles from "./androidStudio.module.css";
import {
  AndroidProjectTemplate,
  NewProjectOptions,
  StudioFile,
} from "@/lib/ide/androidStudioEngine";
import type { AndroidCapabilities } from "@/lib/ide/androidRemote";
import {
  AndroidHeadIcon,
  AndroidStudioLogoIcon,
  GradleFileIcon,
  JavaFileIcon,
  KotlinFileIcon,
  SdkManagerIcon,
  SearchEverywhereIcon,
  XmlFileIcon,
} from "./StudioIcons";

interface NewProjectModalProps {
  open: boolean;
  onCreateProject: (opts: NewProjectOptions) => void;
  onClose: () => void;
}

const PROJECT_TEMPLATES: Array<{
  id: AndroidProjectTemplate;
  title: string;
  lang: string;
  desc: string;
}> = [
  {
    id: "two-activity-java",
    title: "Two-Activity Navigation App",
    lang: "Java · Views",
    desc: "MainActivity + SecondActivity, EditText, Toast, Explicit Intent extras & Back navigation.",
  },
  {
    id: "calculator-java",
    title: "Simple Calculator Practical",
    lang: "Java · Views",
    desc: "Arithmetic GUI with EditText number parsing, Logcat errors & Toast validation.",
  },
  {
    id: "empty-views-java",
    title: "Empty Views Activity",
    lang: "Java · Views",
    desc: "Classic ConstraintLayout XML + AppCompatActivity starter for Android lab experiments.",
  },
  {
    id: "empty-views-kotlin",
    title: "Empty Views Activity (Kotlin)",
    lang: "Kotlin · Views",
    desc: "Kotlin Activity wired to LinearLayout XML with EditText & Button click listener.",
  },
  {
    id: "compose-kotlin",
    title: "Empty Compose Activity",
    lang: "Kotlin · Compose",
    desc: "Material3 Composable function with @Preview canvas and interactive counter.",
  },
];

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  open,
  onCreateProject,
  onClose,
}) => {
  const [template, setTemplate] = useState<AndroidProjectTemplate>("two-activity-java");
  const [appName, setAppName] = useState("My Android Lab");
  const [pkgName, setPkgName] = useState("com.example.myandroidlab");
  const [pkgTouched, setPkgTouched] = useState(false);
  const [minSdk, setMinSdk] = useState(24);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const handleAppNameChange = (val: string) => {
    setAppName(val);
    if (!pkgTouched) {
      const slug = val.toLowerCase().replace(/[^a-z0-9]/g, "") || "myapp";
      setPkgName(`com.example.${slug}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) {
      setError("Enter an application name.");
      return;
    }
    if (!/^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)+$/.test(pkgName.trim())) {
      setError("Package name must have at least two dot-separated identifiers (e.g. com.example.myapp).");
      return;
    }
    onCreateProject({
      appName: appName.trim(),
      packageName: pkgName.trim(),
      template,
      minSdk,
    });
    onClose();
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={styles.modalDialog}
        style={{ width: 640 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="New Android Project"
      >
        <div className={styles.modalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AndroidStudioLogoIcon size={18} />
            <span>New Project — Choose Template &amp; Configure</span>
          </div>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6, color: "var(--as-text-secondary)" }}>
                Project Template
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {PROJECT_TEMPLATES.map((t) => {
                  const selected = template === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplate(t.id)}
                      style={{
                        textAlign: "left",
                        padding: "9px 10px",
                        borderRadius: 6,
                        border: selected ? "1.5px solid var(--as-accent)" : "1px solid var(--as-border-subtle)",
                        background: selected ? "var(--as-accent-soft)" : "var(--as-bg-card)",
                        color: "var(--as-text-primary)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600 }}>
                        <span>{t.title}</span>
                        <span style={{ fontSize: 10.5, color: "var(--as-android-green)" }}>{t.lang}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--as-text-secondary)", marginTop: 3 }}>
                        {t.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                <span style={{ color: "var(--as-text-secondary)" }}>Name</span>
                <input
                  type="text"
                  className={styles.findInput}
                  style={{ height: 30, width: "100%" }}
                  value={appName}
                  onChange={(e) => handleAppNameChange(e.target.value)}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                <span style={{ color: "var(--as-text-secondary)" }}>Package name</span>
                <input
                  type="text"
                  className={styles.findInput}
                  style={{ height: 30, width: "100%" }}
                  value={pkgName}
                  onChange={(e) => {
                    setPkgTouched(true);
                    setPkgName(e.target.value);
                  }}
                />
              </label>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
              <span style={{ color: "var(--as-text-secondary)" }}>Minimum SDK:</span>
              <select
                className={styles.findInput}
                style={{ height: 28, width: 220 }}
                value={minSdk}
                onChange={(e) => setMinSdk(Number(e.target.value))}
              >
                <option value={24}>API 24 (&quot;Nougat&quot;; Android 7.0)</option>
                <option value={26}>API 26 (&quot;Oreo&quot;; Android 8.0)</option>
                <option value={30}>API 30 (&quot;R&quot;; Android 11.0)</option>
              </select>
            </label>

            {error && <div style={{ color: "var(--as-red)", fontSize: 12 }}>{error}</div>}
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.modalBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={`${styles.modalBtn} ${styles.modalBtnPrimary}`}>
              Finish &amp; Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ProjectItemModalProps {
  open: boolean;
  mode: "newFile" | "newFolder" | "rename";
  defaultDir: string;
  initialName: string;
  packageName: string;
  onConfirm: (opts: { dir: string; name: string; registerActivity: boolean }) => void;
  onClose: () => void;
}

export const ProjectItemModal: React.FC<ProjectItemModalProps> = ({
  open,
  mode,
  defaultDir,
  initialName,
  packageName,
  onConfirm,
  onClose,
}) => {
  const pkgPath = packageName.replace(/\./g, "/");
  const [dir, setDir] = useState(defaultDir || `app/src/main/java/${pkgPath}`);
  const [name, setName] = useState(initialName || "");
  const [registerActivity, setRegisterActivity] = useState(true);

  useEffect(() => {
    if (open) {
      setDir(defaultDir || (mode === "newFolder" ? "app/src/main/res" : `app/src/main/java/${pkgPath}`));
      setName(initialName || (mode === "newFile" ? "ThirdActivity.java" : mode === "newFolder" ? "menu" : ""));
      setRegisterActivity(true);
    }
  }, [open, mode, defaultDir, initialName, pkgPath]);

  if (!open) return null;

  const title =
    mode === "newFile"
      ? "New Android File / Activity"
      : mode === "newFolder"
      ? "New Project Folder"
      : "Rename Project File";

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={styles.modalDialog}
        style={{ width: 460 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className={styles.modalHeader}>
          <span>{title}</span>
          <button type="button" className={styles.iconBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            onConfirm({ dir: dir.trim(), name: name.trim(), registerActivity });
            onClose();
          }}
        >
          <div className={styles.modalBody} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mode !== "rename" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                <span style={{ color: "var(--as-text-secondary)" }}>Parent Folder</span>
                <input
                  type="text"
                  className={styles.findInput}
                  style={{ height: 28, width: "100%" }}
                  value={dir}
                  onChange={(e) => setDir(e.target.value)}
                />
              </label>
            )}
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              <span style={{ color: "var(--as-text-secondary)" }}>
                {mode === "newFolder" ? "Folder Name" : "File Name (.java, .kt, .xml, .gradle)"}
              </span>
              <input
                type="text"
                autoFocus
                className={styles.findInput}
                style={{ height: 28, width: "100%" }}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {mode === "newFile" && /Activity\.(java|kt)$/i.test(name.trim()) && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={registerActivity}
                  onChange={(e) => setRegisterActivity(e.target.checked)}
                />
                <span>Register &lt;activity&gt; inside AndroidManifest.xml</span>
              </label>
            )}
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.modalBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={`${styles.modalBtn} ${styles.modalBtnPrimary}`}>
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface RuntimeCapabilitiesModalProps {
  open: boolean;
  capabilities: AndroidCapabilities | null;
  onRefresh: () => void;
  onClose: () => void;
}

export const RuntimeCapabilitiesModal: React.FC<RuntimeCapabilitiesModalProps> = ({
  open,
  capabilities,
  onRefresh,
  onClose,
}) => {
  if (!open) return null;

  const rows = [
    {
      tool: "Java Compiler (javac + Cleanroom Android APIs & R.java)",
      available: capabilities ? capabilities.javac_available : null,
      detail: capabilities?.javac_available
        ? "Compiles real .java classes and reports genuine javac line diagnostics in an isolated sandbox."
        : "Sign in to LabMate to query isolated worker javac compiler status.",
    },
    {
      tool: "JVM Unit Test Runner",
      available: capabilities ? capabilities.java_available : null,
      detail: "Executes JUnit4 @Test methods in isolated JVM process when signed in.",
    },
    {
      tool: "XML & AndroidManifest.xml Parser",
      available: true,
      detail: "Full client + server XML structure checks, XXE protection, and resource validation.",
    },
    {
      tool: "Interactive Browser Android Runtime",
      available: true,
      detail: "Executes Activities, EditText inputs, Button Clicks, Toast, Logcat, Intent extras & Back stack.",
    },
    {
      tool: "Kotlin Compiler (kotlinc)",
      available: capabilities ? capabilities.kotlinc_available : false,
      detail: capabilities?.kotlinc_available
        ? "kotlinc available on worker."
        : "kotlinc CLI is not installed in the container; Kotlin sources use browser syntax & runtime checks.",
    },
    {
      tool: "Full Android SDK (Gradle / aapt2 / d8 / KVM Emulator)",
      available: false,
      detail:
        "Native Android SDK platform binaries and KVM hardware AVD emulator are not installed inside web containers. Builds produce bytecode ZIP APK archives and run inside the Interactive Browser Runtime.",
    },
  ];

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={styles.modalDialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Build and Runtime Capabilities"
      >
        <div className={styles.modalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SdkManagerIcon size={16} />
            <span>Android Build &amp; Runtime Environment</span>
          </div>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <table className={styles.sdkTable}>
            <thead>
              <tr>
                <th>Component</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tool}>
                  <td style={{ fontWeight: 600 }}>{r.tool}</td>
                  <td>
                    <span
                      style={{
                        color:
                          r.available === true
                            ? "var(--as-green)"
                            : r.available === null
                            ? "var(--as-yellow)"
                            : "var(--as-text-muted)",
                        fontWeight: 600,
                      }}
                    >
                      {r.available === true
                        ? "Supported"
                        : r.available === null
                        ? "Sign-in Check"
                        : "Not Installed"}
                    </span>
                  </td>
                  <td style={{ color: "var(--as-text-secondary)" }}>{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.modalBtn} onClick={onRefresh}>
            Refresh Worker Status
          </button>
          <button type="button" className={`${styles.modalBtn} ${styles.modalBtnPrimary}`} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface SearchEverywhereModalProps {
  open: boolean;
  files: StudioFile[];
  onSelectFile: (fileId: string) => void;
  onRunAction: (action: string) => void;
  onClose: () => void;
}

export const SearchEverywhereModal: React.FC<SearchEverywhereModalProps> = ({
  open,
  files,
  onSelectFile,
  onRunAction,
  onClose,
}) => {
  const [query, setQuery] = useState("");

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const matchedFiles = files.filter(
    (f) =>
      !q ||
      f.name.toLowerCase().includes(q) ||
      f.tabTitle.toLowerCase().includes(q) ||
      f.path.toLowerCase().includes(q)
  );

  const actions = [
    { id: "newProject", label: "New Android Project...", shortcut: "" },
    { id: "run", label: "Run 'app' on Interactive Emulator", shortcut: "Shift+F10" },
    { id: "compile", label: "Make Project (Compile Java & XML)", shortcut: "Ctrl+F9" },
    { id: "assemble", label: "Build Debug APK (:app:assembleDebug)", shortcut: "" },
    { id: "format", label: "Reformat Active File Code", shortcut: "Ctrl+Alt+L" },
    { id: "theme", label: "Toggle Dark / Light Theme", shortcut: "" },
    { id: "logcat", label: "Open Logcat Tool Window", shortcut: "Alt+6" },
    { id: "terminal", label: "Open Terminal Tool Window", shortcut: "Alt+F12" },
  ].filter((a) => !q || a.label.toLowerCase().includes(q));

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={styles.modalDialog}
        style={{ width: 560 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Search Everywhere"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: "var(--as-bg-elevated)",
            borderBottom: "1px solid var(--as-border-subtle)",
          }}
        >
          <SearchEverywhereIcon size={16} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files, layouts, or IDE actions..."
            autoFocus
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--as-text-primary)",
              fontSize: 13,
            }}
          />
          <span style={{ fontSize: 11, color: "var(--as-text-muted)" }}>Double Shift</span>
        </div>

        <div className={styles.modalBody} style={{ maxHeight: 340, padding: 8 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "var(--as-text-muted)",
              padding: "4px 8px",
              textTransform: "uppercase",
            }}
          >
            Files &amp; Resources
          </div>
          {matchedFiles.map((f) => (
            <div
              key={f.id}
              onClick={() => {
                onSelectFile(f.id);
                onClose();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderRadius: 5,
                cursor: "pointer",
                fontSize: 12.5,
                color: "var(--as-text-primary)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {f.kind === "java" ? (
                  <JavaFileIcon size={15} />
                ) : f.kind === "kotlin" ? (
                  <KotlinFileIcon size={15} />
                ) : f.kind === "xml" || f.kind === "manifest" ? (
                  <XmlFileIcon size={15} />
                ) : (
                  <GradleFileIcon size={15} />
                )}
                <span>{f.tabTitle}</span>
              </span>
              <span style={{ fontSize: 11, color: "var(--as-text-muted)" }}>{f.path}</span>
            </div>
          ))}

          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "var(--as-text-muted)",
              padding: "8px 8px 4px",
              textTransform: "uppercase",
            }}
          >
            Actions
          </div>
          {actions.map((act) => (
            <div
              key={act.id}
              onClick={() => {
                onRunAction(act.id);
                onClose();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderRadius: 5,
                cursor: "pointer",
                fontSize: 12.5,
                color: "var(--as-text-primary)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AndroidHeadIcon size={14} />
                <span>{act.label}</span>
              </span>
              <span style={{ fontSize: 11, color: "var(--as-text-muted)" }}>{act.shortcut}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onClose }) => {
  if (!open) return null;
  const rows = [
    ["Ctrl + S", "Save all modified project files to browser storage"],
    ["Ctrl + F / Ctrl + H", "Find / Replace inside the active editor tab"],
    ["Ctrl + Alt + L", "Reformat Java / Kotlin / XML / Gradle file"],
    ["Ctrl + Space", "Trigger code & XML attribute autocomplete"],
    ["Ctrl + /", "Toggle line comment"],
    ["Ctrl + F9", "Compile Java + validate XML/Manifest via isolated backend"],
    ["Shift + F10", "Run 'app' inside the Interactive Android Emulator"],
    ["Double Shift", "Open Search Everywhere"],
  ];
  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalDialog} style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span>Android Studio — LabMate Practical Guide &amp; Shortcuts</span>
          <button type="button" className={styles.iconBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>
          <table className={styles.sdkTable}>
            <thead>
              <tr>
                <th>Shortcut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{k}</td>
                  <td style={{ color: "var(--as-text-secondary)" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={`${styles.modalBtn} ${styles.modalBtnPrimary}`} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
