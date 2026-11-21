"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import DashboardShell, { EmptyState, LoadingState, formatDate } from "@/components/dashboard/DashboardShell";
import { useRequireUser } from "@/components/community/useRequireUser";
import { getUpdates, markUpdatesSeen, type FeatureUpdate } from "@/lib/community";
import dashStyles from "@/app/dashboard/dashboard.module.css";
import styles from "@/components/community/community.module.css";

export default function UpdatesPage() {
  const { user } = useRequireUser();
  const [updates, setUpdates] = useState<FeatureUpdate[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    getUpdates(controller.signal)
      .then((list) => {
        setUpdates(list);
        if (list.length) markUpdatesSeen(Math.max(...list.map((u) => u.id)));
      })
      .catch(() => !controller.signal.aborted && setFailed(true));
    return () => controller.abort();
  }, [user]);

  if (!user) return null;

  return (
    <DashboardShell title="What's new" subtitle="New features and improvements in LabMate">
      <div className={styles.stack}>
        {!updates && !failed && <LoadingState message="Loading updates..." />}
        {failed && <p className={styles.error} role="alert">Could not load updates. Please try again in a moment.</p>}
        {updates && updates.length === 0 && (
          <EmptyState icon={Sparkles} title="Nothing here yet" description="New features and improvements will be announced here." />
        )}
        {(updates || []).map((u) => (
          <section key={u.id} className={dashStyles.panel} aria-label={u.title}>
            <div className={styles.body}>
              <h2 className={styles.updateTitle}>
                {u.title}
                {u.tag && <span className={styles.tag}>{u.tag}</span>}
              </h2>
              <span className={styles.muted}>{formatDate(u.created_at || undefined)}</span>
              <p className={styles.updateBody}>{u.body}</p>
            </div>
          </section>
        ))}
      </div>
    </DashboardShell>
  );
}
