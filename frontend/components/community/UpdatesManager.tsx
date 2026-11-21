"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/BasicAuthContext";
import {
  adminCreateUpdate, adminDeleteUpdate, apiError, getUpdates,
  type FeatureUpdate,
} from "@/lib/community";
import styles from "@/components/community/community.module.css";

/** Owner-only: publish "What's new" entries. */
export default function UpdatesManager({ embedded = false }: { embedded?: boolean }) {
  const { user, loading } = useAuth();
  const [updates, setUpdates] = useState<FeatureUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const load = useCallback(async () => {
    try {
      const u = await getUpdates();
      setUpdates(u);
    } catch (e) {
      setError(apiError(e, "Could not load updates."));
    }
  }, []);

  useEffect(() => {
    if (user?.is_admin) load();
  }, [user, load]);

  if (loading) return <div className={styles.ownerPage} aria-busy="true"><p>Checking your session…</p></div>;
  if (!user?.is_admin) {
    return (
      <div className={embedded ? styles.body : styles.ownerPage}>
        <h1>Owner access only</h1>
        <p>This page is restricted to the platform owner.</p>
        <Link href="/dashboard">Return to LabMate</Link>
      </div>
    );
  }

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(apiError(e, "That did not work. Please try again."));
    }
  };

  const createUpdate = (event: FormEvent) => {
    event.preventDefault();
    if (publishing) return;
    setPublishing(true);
    setPublished(false);
    setError(null);
    void (async () => {
      try {
      await adminCreateUpdate({ title, body: bodyText, tag: tag || undefined });
      setTitle("");
      setTag("");
      setBodyText("");
      setPublished(true);
      await load();
      } catch (error) {
        setError(apiError(error, "Could not publish this update. Please try again."));
      } finally {
        setPublishing(false);
      }
    })();
  };

  return (
    <div className={embedded ? styles.body : styles.ownerPage}>
      {!embedded && <Link href="/admin/dashboard"><ArrowLeft size={14} /> Owner dashboard</Link>}
      <h2>Publish to What&apos;s new</h2>
      {error && <p className={styles.error} role="alert">{error}</p>}

      <section aria-label="New update" className={styles.review}>
        <h2 className={styles.question}>New &quot;What&apos;s new&quot; entry</h2>
        <form onSubmit={createUpdate} className={styles.body} style={{ padding: 0 }}>
          <div className={styles.field}><label htmlFor="up-t">Title</label>
            <input id="up-t" className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} minLength={3} required /></div>
          <div className={styles.field}><label htmlFor="up-tag">Tag</label>
            <select id="up-tag" className={styles.select} value={tag} onChange={(e) => setTag(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="">None</option><option>New</option><option>Improved</option><option>Fixed</option>
            </select></div>
          <div className={styles.field}><label htmlFor="up-b">Details</label>
            <textarea id="up-b" className={styles.area} value={bodyText} onChange={(e) => setBodyText(e.target.value)} maxLength={4000} minLength={3} required /></div>
          <div><button type="submit" className={styles.btn} disabled={publishing}>{publishing ? "Publishing..." : "Publish update"}</button></div>
          {published && <p role="status">Published to What&apos;s new.</p>}
        </form>
      </section>

      <section aria-label="Updates">
        <h2 className={styles.question}>Published updates</h2>
        {updates.length === 0 && <p className={styles.muted}>Nothing published yet.</p>}
        {updates.map((u) => (
          <article key={u.id} className={styles.review} style={{ marginTop: 8 }}>
            <div className={styles.row}>
              <strong>{u.title}</strong>{u.tag && <span className={styles.tag}>{u.tag}</span>}
              <button type="button" className={`${styles.btnGhost} ${styles.btnDanger}`} style={{ marginLeft: "auto" }}
                onClick={() => window.confirm("Delete this update?") && act(() => adminDeleteUpdate(u.id))}>Delete</button>
            </div>
            <p className={styles.updateBody}>{u.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
