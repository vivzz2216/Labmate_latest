"use client";

import { Star } from "lucide-react";
import { formatDate } from "@/components/dashboard/DashboardShell";
import type { PublicReview } from "@/lib/community";
import styles from "./ReviewMarquee.module.css";

function ReviewCard({ r }: { r: PublicReview }) {
  return (
    <article className={styles.card}>
      <span className={styles.stars} aria-label={`${r.rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} size={14} aria-hidden="true" fill={n <= r.rating ? "currentColor" : "none"} />
        ))}
      </span>
      <p>{r.message}</p>
      <small>{r.created_at ? formatDate(r.created_at) : ""}</small>
    </article>
  );
}

function Column({ reviews, direction, label }: { reviews: PublicReview[]; direction: "down" | "up"; label: string }) {
  if (!reviews.length) return <div className={styles.column} />;
  // Few reviews: show them still. Enough reviews: scroll them (the list is repeated once so the loop has no gap).
  const animate = reviews.length >= 2;
  const seconds = Math.max(18, reviews.length * 9);
  return (
    <div className={styles.column} role="list" aria-label={label}>
      <div
        className={`${styles.track} ${animate ? (direction === "down" ? styles.down : styles.up) : ""}`}
        style={animate ? { animationDuration: `${seconds}s` } : undefined}
      >
        {reviews.map((r) => (
          <div role="listitem" key={r.id}>
            <ReviewCard r={r} />
          </div>
        ))}
        {animate &&
          reviews.map((r) => (
            <div key={`copy-${r.id}`} aria-hidden="true">
              <ReviewCard r={r} />
            </div>
          ))}
      </div>
    </div>
  );
}

/** Two columns of student reviews that float past: the left column drifts down, the right one drifts up. Hover pauses; reduced-motion users get a plain scrollable list. */
export default function ReviewMarquee({ reviews }: { reviews: PublicReview[] }) {
  const left = reviews.filter((_, i) => i % 2 === 0);
  const right = reviews.filter((_, i) => i % 2 === 1);
  return (
    <div className={styles.wrap}>
      <Column reviews={left} direction="down" label="Student reviews, first column" />
      <Column reviews={right} direction="up" label="Student reviews, second column" />
    </div>
  );
}
