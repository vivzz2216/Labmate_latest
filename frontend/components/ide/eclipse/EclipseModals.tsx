import React, { useState } from "react";
import { EclipseGlobeIcon, NewClassIcon, NewPackageIcon } from "./eclipseIcons";
import type { WorkspaceProject } from "./eclipseData";
import styles from "./eclipse.module.css";

interface NewClassModalProps {
  projects: WorkspaceProject[];
  defaultProjectId: string;
  defaultPackage: string;
  onCreate: (projectId: string, packageName: string, className: string, includeMain: boolean) => void;
  onClose: () => void;
}

export function NewClassModal({
  projects,
  defaultProjectId,
  defaultPackage,
  onCreate,
  onClose,
}: NewClassModalProps) {
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [packageName, setPackageName] = useState(defaultPackage);
  const [className, setClassName] = useState("MyClass");
  const [includeMain, setIncludeMain] = useState(true);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = className.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      setError("Type name is not valid. Use a valid Java identifier.");
      return;
    }
    const pkg = packageName.trim();
    if (pkg && !/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(pkg)) {
      setError("Package name is not valid.");
      return;
    }
    onCreate(projectId, pkg, trimmed, includeMain);
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.eclipseDialog} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="New Java Class">
        <div className={styles.dialogTitleBar}>
          <span className={styles.dialogTitleLeft}>
            <NewClassIcon size={14} />
            <span>New Java Class</span>
          </span>
          <button type="button" className={styles.dialogCloseBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className={styles.dialogBanner}>
          <div>
            <div className={styles.dialogBannerTitle}>Java Class</div>
            <div className={styles.dialogBannerSub}>Create a new Java class in the selected source folder.</div>
          </div>
          <NewClassIcon size={24} />
        </div>
        <form onSubmit={handleSubmit} className={styles.dialogBody}>
          {error && <div className={styles.dialogError}>{error}</div>}
          <label className={styles.dialogRow}>
            <span>Source folder:</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={styles.dialogInput}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}/src
                </option>
              ))}
            </select>
          </label>
          <label className={styles.dialogRow}>
            <span>Package:</span>
            <input
              type="text"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              placeholder="(default)"
              className={styles.dialogInput}
            />
          </label>
          <label className={styles.dialogRow}>
            <span>Name:</span>
            <input
              type="text"
              value={className}
              onChange={(e) => {
                setClassName(e.target.value);
                setError("");
              }}
              autoFocus
              className={styles.dialogInput}
            />
          </label>
          <div className={styles.dialogCheckGroup}>
            <div className={styles.dialogCheckHeading}>Which method stubs would you like to create?</div>
            <label className={styles.dialogCheck}>
              <input type="checkbox" checked={includeMain} onChange={(e) => setIncludeMain(e.target.checked)} />
              <span>public static void main(String[] args)</span>
            </label>
          </div>
          <div className={styles.dialogFooter}>
            <button type="submit" className={styles.dialogPrimaryBtn}>
              Finish
            </button>
            <button type="button" className={styles.dialogBtn} onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface NewPackageModalProps {
  projects: WorkspaceProject[];
  defaultProjectId: string;
  onCreate: (projectId: string, packageName: string) => void;
  onClose: () => void;
}

export function NewPackageModal({ projects, defaultProjectId, onCreate, onClose }: NewPackageModalProps) {
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [packageName, setPackageName] = useState("com.example");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pkg = packageName.trim();
    if (!pkg || !/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(pkg)) {
      setError("Enter a valid Java package name (e.g. com.openclassrooms).");
      return;
    }
    onCreate(projectId, pkg);
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.eclipseDialog} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="New Java Package">
        <div className={styles.dialogTitleBar}>
          <span className={styles.dialogTitleLeft}>
            <NewPackageIcon size={14} />
            <span>New Java Package</span>
          </span>
          <button type="button" className={styles.dialogCloseBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className={styles.dialogBanner}>
          <div>
            <div className={styles.dialogBannerTitle}>Java Package</div>
            <div className={styles.dialogBannerSub}>Creates folders corresponding to a Java package.</div>
          </div>
          <NewPackageIcon size={24} />
        </div>
        <form onSubmit={handleSubmit} className={styles.dialogBody}>
          {error && <div className={styles.dialogError}>{error}</div>}
          <label className={styles.dialogRow}>
            <span>Source folder:</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={styles.dialogInput}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}/src
                </option>
              ))}
            </select>
          </label>
          <label className={styles.dialogRow}>
            <span>Name:</span>
            <input
              type="text"
              value={packageName}
              onChange={(e) => {
                setPackageName(e.target.value);
                setError("");
              }}
              autoFocus
              className={styles.dialogInput}
            />
          </label>
          <div className={styles.dialogFooter}>
            <button type="submit" className={styles.dialogPrimaryBtn}>
              Finish
            </button>
            <button type="button" className={styles.dialogBtn} onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PreferencesModalProps {
  fontSize: number;
  showWhitespace: boolean;
  showLineNumbers: boolean;
  markOccurrences: boolean;
  stdinInput: string;
  onSave: (prefs: {
    fontSize: number;
    showWhitespace: boolean;
    showLineNumbers: boolean;
    markOccurrences: boolean;
    stdinInput: string;
  }) => void;
  onClose: () => void;
}

export function PreferencesModal({
  fontSize,
  showWhitespace,
  showLineNumbers,
  markOccurrences,
  stdinInput,
  onSave,
  onClose,
}: PreferencesModalProps) {
  const [size, setSize] = useState(fontSize);
  const [ws, setWs] = useState(showWhitespace);
  const [nums, setNums] = useState(showLineNumbers);
  const [mark, setMark] = useState(markOccurrences);
  const [stdin, setStdin] = useState(stdinInput);

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.eclipseDialog} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Preferences">
        <div className={styles.dialogTitleBar}>
          <span className={styles.dialogTitleLeft}>
            <EclipseGlobeIcon size={14} />
            <span>Preferences</span>
          </span>
          <button type="button" className={styles.dialogCloseBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className={styles.dialogBody}>
          <div className={styles.dialogSectionTitle}>General &gt; Editors &gt; Text Editors</div>
          <label className={styles.dialogRow}>
            <span>Editor font size (px):</span>
            <input
              type="number"
              min={11}
              max={18}
              value={size}
              onChange={(e) => setSize(Math.min(18, Math.max(11, Number(e.target.value) || 13)))}
              className={styles.dialogInput}
            />
          </label>
          <label className={styles.dialogCheck}>
            <input type="checkbox" checked={nums} onChange={(e) => setNums(e.target.checked)} />
            <span>Show line numbers</span>
          </label>
          <label className={styles.dialogCheck}>
            <input type="checkbox" checked={ws} onChange={(e) => setWs(e.target.checked)} />
            <span>Show whitespace characters (¶)</span>
          </label>
          <label className={styles.dialogCheck}>
            <input type="checkbox" checked={mark} onChange={(e) => setMark(e.target.checked)} />
            <span>Mark occurrences of selected Java identifier</span>
          </label>
          <div className={styles.dialogSectionTitle}>Run/Debug &gt; Standard Input (Scanner System.in)</div>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            rows={3}
            placeholder="Optional stdin lines passed to Scanner(System.in)..."
            className={styles.dialogTextarea}
          />
          <div className={styles.dialogFooter}>
            <button
              type="button"
              className={styles.dialogPrimaryBtn}
              onClick={() => {
                onSave({
                  fontSize: size,
                  showWhitespace: ws,
                  showLineNumbers: nums,
                  markOccurrences: mark,
                  stdinInput: stdin,
                });
                onClose();
              }}
            >
              Apply and Close
            </button>
            <button type="button" className={styles.dialogBtn} onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AboutEclipseModal({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.eclipseDialog} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="About Eclipse IDE">
        <div className={styles.dialogTitleBar}>
          <span className={styles.dialogTitleLeft}>
            <EclipseGlobeIcon size={14} />
            <span>About Eclipse IDE</span>
          </span>
          <button type="button" className={styles.dialogCloseBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className={styles.aboutBody}>
          <EclipseGlobeIcon size={44} />
          <div>
            <div className={styles.aboutHeading}>Eclipse IDE for Java Developers</div>
            <div className={styles.aboutSub}>Version: 2018-09 (4.9.0) · JavaSE-1.8</div>
            <div className={styles.aboutDesc}>
              Interactive browser workspace powered by the LabMate TypeScript Java interpreter and JDT diagnostic engine.
            </div>
          </div>
        </div>
        <div className={styles.dialogFooter} style={{ padding: "0 14px 12px" }}>
          <button type="button" className={styles.dialogPrimaryBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
