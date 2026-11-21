"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/BasicAuthContext";
import {
  adminClosePoll, adminCreatePoll, adminCreateUpdate, adminDeletePoll, adminDeleteUpdate, apiError, getPolls, getUpdates,
  type FeatureUpdate, type Poll,
} from "@/lib/community";
import styles from "@/components/community/community.module.css";

/** Owner-only: create and close polls, publish "What's new" entries. */
export default function CommunityAdminPage() {
  const { user, loading } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [updates, setUpdates] = useState<FeatureUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState("");
  const [days, setDays] = useState("");
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [bodyText, setBodyText] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, u] = await Promise.all([getPolls(), getUpdates()]);
      setPolls(p);
      setUpdates(u);
    } catch (e) {
      setError(apiError(e, "Could not load polls and updates."));
    }
  }, []);

  useEffect(() => {
    if (user?.is_admin) load();
  }, [user, load]);

  if (loading) return <main className={styles.ownerPage} aria-busy="true"><p>Checking your session…</p></main>;
  if (!user?.is_admin) {
    return (
      <main className={styles.ownerPage}>
        <h1>Owner access only</h1>
        <p>This page is restricted to the platform owner.</p>
        <Link href="/dashboard">Return to LabMate</Link>
      </main>
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

  const createPoll = (event: FormEvent) => {
    event.preventDefault();
    act(async () => {
      await adminCreatePoll({
        question,
        description: description.trim() || undefined,
        options: options.split("\n").map((s) => s.trim()).filter(Boolean),
        closes_in_days: days.trim() ? Number(days) : undefined,
      });
      setQuestion("");
      setDescription("");
      setOptions("");
      setDays("");
    });
  };

  const createUpdate = (event: FormEvent) => {
    event.preventDefault();
    act(async () => {
      await adminCreateUpdate({ title, body: bodyText, tag: tag || undefined });
      setTitle("");
      setTag("");
      setBodyText("");
    });
  };

  return (
    <main className={styles.ownerPage}>
      <Link href="/admin/dashboard"><ArrowLeft size={14} /> Owner dashboard</Link>
      <h1>Polls and updates</h1>
      {error && <p className={styles.error} role="alert">{error}</p>}

      <section aria-label="New poll" className={styles.review}>
        <h2 className={styles.question}>New poll</h2>
        <form onSubmit={createPoll} className={styles.body} style={{ padding: 0 }}>
          <div className={styles.field}><label htmlFor="poll-q">Question</label>
            <input id="poll-q" className={styles.input} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} required /></div>
          <div className={styles.field}><label htmlFor="poll-d">Details (optional)</label>
            <input id="poll-d" className={styles.input} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></div>
          <div className={styles.field}><label htmlFor="poll-o">Options (one per line, 2 to 8)</label>
            <textarea id="poll-o" className={styles.area} value={options} onChange={(e) => setOptions(e.target.value)} required /></div>
          <div className={styles.field}><label htmlFor="poll-days">Closes after (days, optional)</label>
            <input id="poll-days" className={styles.input} type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} style={{ maxWidth: 140 }} /></div>
          <div><button type="submit" className={styles.btn}>Publish poll</button></div>
        </form>
      </section>

      <section aria-label="Polls">
        <h2 className={styles.question}>Polls</h2>
        {polls.length === 0 && <p className={styles.muted}>No polls yet.</p>}
        {polls.map((p) => (
          <article key={p.id} className={styles.review} style={{ marginTop: 8 }}>
            <div className={styles.row}>
              <span className={`${styles.pill} ${p.open ? "" : styles.pillClosed}`}>{p.open ? "Open" : "Closed"}</span>
              <strong>{p.question}</strong>
            </div>
            <ul style={{ margin: "4px 0 0 18px" }}>
              {p.options.map((o) => <li key={o.id}>{o.label}: {o.votes} ({o.percent}%)</li>)}
            </ul>
            <div className={styles.row}>
              <span className={styles.muted}>{p.total_votes} votes</span>
              {p.open && <button type="button" className={styles.btnGhost} onClick={() => act(() => adminClosePoll(p.id))}>Close poll</button>}
              <button type="button" className={`${styles.btnGhost} ${styles.btnDanger}`}
                onClick={() => window.confirm("Delete this poll and its votes?") && act(() => adminDeletePoll(p.id))}>Delete</button>
            </div>
          </article>
        ))}
      </section>

      <section aria-label="New update" className={styles.review}>
        <h2 className={styles.question}>New &quot;What&apos;s new&quot; entry</h2>
        <form onSubmit={createUpdate} className={styles.body} style={{ padding: 0 }}>
          <div className={styles.field}><label htmlFor="up-t">Title</label>
            <input id="up-t" className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required /></div>
          <div className={styles.field}><label htmlFor="up-tag">Tag</label>
            <select id="up-tag" className={styles.select} value={tag} onChange={(e) => setTag(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="">None</option><option>New</option><option>Improved</option><option>Fixed</option>
            </select></div>
          <div className={styles.field}><label htmlFor="up-b">Details</label>
            <textarea id="up-b" className={styles.area} value={bodyText} onChange={(e) => setBodyText(e.target.value)} maxLength={4000} required /></div>
          <div><button type="submit" className={styles.btn}>Publish update</button></div>
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
    </main>
  );
}
