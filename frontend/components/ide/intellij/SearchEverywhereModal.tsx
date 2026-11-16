"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { VirtualFileNode } from "@/lib/ide/intellijRunner";
import { JavaClassIcon, ModuleIcon, PlayOutlineIcon, SearchEverywhereIcon } from "./ExpUiIcons";
import styles from "./intellij.module.css";

export interface SearchActionItem {
  id: string;
  label: string;
  shortcut?: string;
  onTrigger: () => void;
}

interface SearchEverywhereModalProps {
  open: boolean;
  files: VirtualFileNode[];
  actions: SearchActionItem[];
  onClose: () => void;
  onSelectFile: (node: VirtualFileNode) => void;
}

export function SearchEverywhereModal({
  open,
  files,
  actions,
  onClose,
  onSelectFile,
}: SearchEverywhereModalProps) {
  const [tab, setTab] = useState<"all" | "classes" | "files" | "actions">("all");
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const results: Array<{
      id: string;
      kind: "class" | "file" | "action";
      title: string;
      subtitle: string;
      shortcut?: string;
      onActivate: () => void;
    }> = [];

    if (tab === "all" || tab === "classes" || tab === "files") {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f.content === undefined) continue;
        if (tab === "classes" && f.kind !== "java") continue;
        const nameMatch = f.name.toLowerCase().indexOf(q) !== -1 || f.path.toLowerCase().indexOf(q) !== -1;
        if (!q || nameMatch) {
          results.push({
            id: "f-" + f.id,
            kind: f.kind === "java" ? "class" : "file",
            title: f.kind === "java" ? f.displayName || f.name : f.name,
            subtitle: f.path,
            onActivate: () => onSelectFile(f),
          });
        }
      }
    }

    if (tab === "all" || tab === "actions") {
      for (let i = 0; i < actions.length; i++) {
        const a = actions[i];
        if (!q || a.label.toLowerCase().indexOf(q) !== -1) {
          results.push({
            id: "a-" + a.id,
            kind: "action",
            title: a.label,
            subtitle: "Action",
            shortcut: a.shortcut,
            onActivate: a.onTrigger,
          });
        }
      }
    }

    return results;
  }, [tab, query, files, actions, onSelectFile]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(items.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter" && items[selectedIdx]) {
      e.preventDefault();
      items[selectedIdx].onActivate();
      onClose();
    }
  };

  return (
    <div className={styles.modalBackdrop} onMouseDown={onClose}>
      <div className={styles.searchModal} onMouseDown={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className={styles.searchTabRow}>
          {(["all", "classes", "files", "actions"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`${styles.searchTabBtn} ${tab === t ? styles.searchTabBtnActive : ""}`}
              onClick={() => {
                setTab(t);
                setSelectedIdx(0);
              }}
            >
              {t === "all" ? "All" : t === "classes" ? "Classes" : t === "files" ? "Files" : "Actions"}
            </button>
          ))}
        </div>

        <div className={styles.searchInputRow}>
          <SearchEverywhereIcon size={16} color="#9DA0A8" />
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Search classes, files, or IDE actions..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
          />
        </div>

        <div className={styles.searchResults}>
          {items.length === 0 ? (
            <div style={{ padding: "18px 12px", textAlign: "center", color: "#7A7E85", fontSize: 12.5 }}>
              No matching classes, files, or actions found
            </div>
          ) : (
            items.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.searchResultRow} ${idx === selectedIdx ? styles.searchResultRowActive : ""}`}
                onClick={() => {
                  item.onActivate();
                  onClose();
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                  {item.kind === "class" ? (
                    <JavaClassIcon size={15} />
                  ) : item.kind === "file" ? (
                    <ModuleIcon size={14} />
                  ) : (
                    <PlayOutlineIcon size={14} color="#9DA0A8" />
                  )}
                  <span>{item.title}</span>
                </span>
                <span className={styles.searchResultSub}>{item.shortcut || item.subtitle}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface GoToLineModalProps {
  open: boolean;
  initialLine: number;
  onClose: () => void;
  onGo: (line: number, col: number) => void;
}

export function GoToLineModal({ open, initialLine, onClose, onGo }: GoToLineModalProps) {
  const [val, setVal] = useState(String(initialLine));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setVal(String(initialLine));
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open, initialLine]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parts = val.split(":");
    const line = Math.max(1, parseInt(parts[0] || "1", 10) || 1);
    const col = Math.max(1, parseInt(parts[1] || "1", 10) || 1);
    onGo(line, col);
    onClose();
  };

  return (
    <div className={styles.modalBackdrop} onMouseDown={onClose}>
      <form className={styles.dialogBox} onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className={styles.dialogTitle}>Go to Line:Column</div>
        <input
          ref={inputRef}
          type="text"
          className={styles.dialogInput}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="e.g. 5 or 5:42"
        />
        <div className={styles.dialogFooter}>
          <button type="button" className={styles.dialogBtnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.dialogBtnPrimary}>
            OK
          </button>
        </div>
      </form>
    </div>
  );
}

interface NewClassModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (className: string) => void;
}

export function NewClassModal({ open, onClose, onCreate }: NewClassModalProps) {
  const [className, setClassName] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setClassName("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = className.replace(/\.java$/i, "").replace(/[^A-Za-z0-9_$]/g, "");
    if (!cleaned) return;
    onCreate(cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
    onClose();
  };

  return (
    <div className={styles.modalBackdrop} onMouseDown={onClose}>
      <form className={styles.dialogBox} onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className={styles.dialogTitle}>New Java Class</div>
        <input
          ref={inputRef}
          type="text"
          className={styles.dialogInput}
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          placeholder="Class name (e.g. Fibonacci)"
        />
        <div className={styles.dialogFooter}>
          <button type="button" className={styles.dialogBtnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.dialogBtnPrimary}>
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
