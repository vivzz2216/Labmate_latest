"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Star } from "lucide-react";
import styles from "./HomepageSections.module.css";

type Review = { id: number; rating: number; message: string; created_at: string | null };
type ReviewPage = { reviews: Review[]; total: number; average_rating: number | null };

export default function StudentReviews() {
  const section = useRef<HTMLElement>(null);
  const [data, setData] = useState<ReviewPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const load = useCallback(async (offset = 0) => {
    setBusy(true); setError(false);
    try {
      const response = await fetch(`/api/feedback/reviews?limit=6&offset=${offset}`, { signal: AbortSignal.timeout(8000), credentials: "omit" });
      if (!response.ok) throw new Error("Reviews unavailable");
      const page: ReviewPage = await response.json();
      if (!Array.isArray(page.reviews) || !Number.isFinite(page.total)) throw new Error("Invalid review response");
      setData(previous => ({ ...page, reviews: offset ? [...(previous?.reviews || []), ...page.reviews] : page.reviews }));
    } catch { setError(true); } finally { setBusy(false); }
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { void load(); observer.disconnect(); }
    }, { rootMargin: "300px" });
    if (section.current) observer.observe(section.current);
    return () => observer.disconnect();
  }, [load]);

  return <section id="reviews" ref={section} className={styles.section} aria-labelledby="reviews-heading">
    <div className={styles.sectionHeader}>
      <h2 id="reviews-heading">Student reviews.</h2>
      <p>Ratings and experiences from students. Names and account details stay private.</p>
    </div>
    {data && data.total > 0 && <div className={styles.reviewSummary}>
      <Star size={23} aria-hidden="true" /><strong>{data.average_rating?.toFixed(1)}</strong><span>out of 5 · {data.total} student {data.total === 1 ? "review" : "reviews"}</span>
    </div>}
    {data?.reviews.length ? <div className={styles.reviewGrid}>{data.reviews.map(review => <article key={review.id} className={styles.review}>
      <div className={styles.stars} aria-label={`${review.rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map(n => <Star key={n} size={15} aria-hidden="true" fill={n <= review.rating ? "currentColor" : "none"} />)}</div>
      <blockquote>{review.message}</blockquote>
      <footer><span>Student</span>{review.created_at && <time dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</time>}</footer>
    </article>)}</div> : <div className={styles.reviewEmpty}>
      <MessageSquare size={28} aria-hidden="true" />
      <div><h3>{error ? "Reviews are temporarily unavailable." : data ? "Your experience could be the first." : "Student voices belong here."}</h3>
        <p>{error ? "Please try again in a moment." : data ? "No ratings have been shared yet. Student feedback will appear here as it arrives." : "Loading ratings and feedback from students."}</p></div>
    </div>}
    {(error || (data && data.reviews.length < data.total)) && <button className={styles.moreReviews} disabled={busy} onClick={() => void load(data?.reviews.length || 0)}>
      {busy ? "Loading…" : error ? "Retry loading reviews" : "Show more reviews"}
    </button>}
  </section>;
}
