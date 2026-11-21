"use client";

import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import DashboardShell, { EmptyState, LoadingState, formatDate } from "@/components/dashboard/DashboardShell";
import { useRequireUser } from "@/components/community/useRequireUser";
import { apiError, getPolls, votePoll, type Poll } from "@/lib/community";
import dashStyles from "@/app/dashboard/dashboard.module.css";
import styles from "@/components/community/community.module.css";

function PollCard({ poll, onChange }: { poll: Poll; onChange: (p: Poll) => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const answered = poll.my_option_id !== null;
  const showResults = answered || !poll.open;

  const vote = async (optionId: number) => {
    if (!poll.open || busy !== null || optionId === poll.my_option_id) return;
    setBusy(optionId);
    setError(null);
    try {
      onChange(await votePoll(poll.id, optionId));
      window.dispatchEvent(new Event("labmate-polls-changed"));
    } catch (e) {
      setError(apiError(e, "Could not save your vote. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={dashStyles.panel} aria-label={poll.question}>
      <div className={styles.body}>
        <div className={styles.row}>
          <span className={`${styles.pill} ${poll.open ? "" : styles.pillClosed}`}>{poll.open ? "Open" : "Closed"}</span>
          <span className={styles.muted}>
            {poll.total_votes} {poll.total_votes === 1 ? "vote" : "votes"}
            {poll.created_at ? ` · started ${formatDate(poll.created_at)}` : ""}
            {poll.open && poll.closes_at ? ` · closes ${formatDate(poll.closes_at)}` : ""}
          </span>
        </div>
        <h2 className={styles.question}>{poll.question}</h2>
        {poll.description && <p className={styles.muted}>{poll.description}</p>}
        <div role="radiogroup" aria-label={poll.question} style={{ display: "grid", gap: 8 }}>
          {poll.options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={poll.my_option_id === o.id}
              disabled={!poll.open || busy !== null}
              className={`${styles.option} ${poll.my_option_id === o.id ? styles.mine : ""}`}
              onClick={() => vote(o.id)}
            >
              {showResults && <span className={styles.bar} style={{ width: `${o.percent}%` }} />}
              <span className={styles.optionText}>
                {o.label}
                {poll.my_option_id === o.id ? " (your vote)" : ""}
              </span>
              {showResults && <span className={styles.pct}>{o.percent}% · {o.votes}</span>}
            </button>
          ))}
        </div>
        {poll.open && <p className={styles.muted}>{answered ? "You can change your vote until the poll closes." : "Choose an option to vote. Results appear after you vote."}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
    </section>
  );
}

export default function PollsPage() {
  const { user } = useRequireUser();
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    getPolls(controller.signal).then(setPolls).catch(() => !controller.signal.aborted && setFailed(true));
    return () => controller.abort();
  }, [user]);

  if (!user) return null;
  const replace = (p: Poll) => setPolls((prev) => (prev ? prev.map((x) => (x.id === p.id ? p : x)) : prev));
  const open = (polls || []).filter((p) => p.open);
  const closed = (polls || []).filter((p) => !p.open);

  return (
    <DashboardShell title="Polls" subtitle="Help decide what LabMate builds next">
      <div className={styles.stack}>
        {!polls && !failed && <LoadingState message="Loading polls..." />}
        {failed && <p className={styles.error} role="alert">Could not load polls. Please try again in a moment.</p>}
        {polls && polls.length === 0 && (
          <EmptyState icon={ListChecks} title="No polls yet" description="When the team asks a question, it will appear here." />
        )}
        {open.map((p) => <PollCard key={p.id} poll={p} onChange={replace} />)}
        {closed.length > 0 && <h3 className={styles.muted}>Closed polls</h3>}
        {closed.map((p) => <PollCard key={p.id} poll={p} onChange={replace} />)}
      </div>
    </DashboardShell>
  );
}
