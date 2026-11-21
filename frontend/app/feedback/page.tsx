"use client";

import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import DashboardShell, { EmptyState, LoadingState } from "@/components/dashboard/DashboardShell";
import RateLabMate from "@/components/feedback/RateLabMate";
import ReviewMarquee from "@/components/community/ReviewMarquee";
import { useRequireUser } from "@/components/community/useRequireUser";
import { getReviews, type PublicReview } from "@/lib/community";
import dashStyles from "@/app/dashboard/dashboard.module.css";
import styles from "@/components/community/community.module.css";

const PAGE = 12; // the API serves at most 12 reviews per request
const MAX_REVIEWS = 36;

interface Summary {
  total: number;
  average: number | null;
  reviews: PublicReview[];
}

async function loadAll(signal?: AbortSignal): Promise<Summary> {
  const first = await getReviews(PAGE, 0, signal, true);
  const reviews = [...first.reviews];
  while (reviews.length < Math.min(first.total, MAX_REVIEWS)) {
    const next = await getReviews(PAGE, reviews.length, signal, true);
    if (!next.reviews.length) break;
    reviews.push(...next.reviews);
  }
  return { total: first.total, average: first.average_rating, reviews };
}

export default function FeedbackPage() {
  const { user } = useRequireUser();
  const [data, setData] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    loadAll(controller.signal).then(setData).catch(() => !controller.signal.aborted && setFailed(true));
    return () => controller.abort();
  }, []);

  const refresh = useCallback(() => {
    loadAll().then(setData).catch(() => setFailed(true));
  }, []);

  if (!user) return null;
  const rounded = data?.average ? Math.round(data.average) : 0;

  return (
    <DashboardShell title="Ratings & reviews" subtitle="Rate LabMate and read what other students say">
      <div className={styles.pairGrid}>
        <section className={`${dashStyles.panel} ${styles.fill}`} aria-label="Rate LabMate">
          <div className={dashStyles.panelHeader}>
            <div>
              <h2>Rate LabMate</h2>
              <p>Your feedback goes straight to the team</p>
            </div>
          </div>
          <RateLabMate padded onSent={refresh} />
        </section>

        <section className={`${dashStyles.panel} ${styles.fill}`} aria-label="Student reviews summary">
          <div className={dashStyles.panelHeader}>
            <div>
              <h2>What students say</h2>
              <p>Names and account details stay private</p>
            </div>
          </div>
          <div className={`${styles.body} ${styles.centerBody}`}>
            {!data && !failed && <LoadingState message="Loading reviews..." />}
            {failed && <p className={styles.error} role="alert">Could not load reviews. Please try again in a moment.</p>}
            {data && data.total === 0 && (
              <EmptyState compact icon={Star} title="No reviews yet" description="Be the first: rate LabMate on the left." />
            )}
            {data && data.total > 0 && (
              <>
                <div className={styles.avgRow}>
                  <span className={styles.avgBig}>{data.average?.toFixed(1)}</span>
                  <span className={styles.muted}>out of 5</span>
                </div>
                <span className={styles.stars} aria-label={`${data.average?.toFixed(1)} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={22} aria-hidden="true" fill={n <= rounded ? "currentColor" : "none"} />
                  ))}
                </span>
                <p className={styles.muted}>
                  Based on {data.total} student {data.total === 1 ? "review" : "reviews"}
                </p>
              </>
            )}
          </div>
        </section>
      </div>

      {data && data.reviews.length > 0 && (
        <section className={styles.marqueeSection} aria-label="Reviews from other students">
          <h2 className={styles.marqueeTitle}>From other students</h2>
          <ReviewMarquee reviews={data.reviews} />
        </section>
      )}
    </DashboardShell>
  );
}
