"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Star,
  MessageSquare,
  CheckCircle2,
  Send,
  Sparkles,
  ExternalLink,
  Edit3,
} from "lucide-react";
import { apiService } from "@/lib/api";
import styles from "@/app/dashboard/dashboard.module.css";

const RATING_DESCRIPTIONS: Record<number, string> = {
  1: "1 Star · Needs Improvement",
  2: "2 Stars · Fair",
  3: "3 Stars · Good",
  4: "4 Stars · Very Good! 👍",
  5: "5 Stars · Outstanding! 🚀",
};

export default function StudentFeedbackCard() {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [existingFeedback, setExistingFeedback] = useState<{
    id: number;
    rating: number | null;
    message: string;
    created_at: string | null;
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const fetchMyFeedback = useCallback(async () => {
    try {
      const res = await apiService.getMyFeedback();
      if (Array.isArray(res.feedback) && res.feedback.length > 0) {
        const latest = res.feedback[0];
        setExistingFeedback(latest);
        if (latest.rating) setRating(latest.rating);
        setMessage(latest.message);
      }
    } catch {
      // Ignore background fetch error
    }
  }, []);

  useEffect(() => {
    fetchMyFeedback();
  }, [fetchMyFeedback]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      setErrorMessage("Please write a short review or message.");
      return;
    }
    if (trimmed.length < 8) {
      setErrorMessage("Please write at least a full sentence (8+ characters) for your review.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await apiService.submitFeedback({
        rating,
        message: trimmed,
      });

      if (res.ok) {
        setSuccessMessage("Review saved! Your rating and feedback will be featured on the homepage.");
        setIsEditing(false);
        fetchMyFeedback();
      } else {
        setErrorMessage("Could not save feedback. Please try again.");
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setErrorMessage(
        typeof detail === "string" ? detail : "Failed to submit feedback. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const activeStars = hoverRating ?? rating;

  return (
    <section className={styles.panel} aria-labelledby="feedback-card-heading">
      <div className={styles.panelHeader}>
        <div className={styles.qaHeaderTitle}>
          <span className={styles.qaFeedbackIcon}>
            <Star size={17} strokeWidth={2.2} />
          </span>
          <div>
            <h2 id="feedback-card-heading">Student Feedback &amp; Review</h2>
            <p>Your rating &amp; experience will appear directly on our homepage</p>
          </div>
        </div>
        <Link href="/#reviews" className={styles.qaHomepageLink}>
          View on Homepage <ExternalLink size={12} />
        </Link>
      </div>

      <div className={styles.qaCardBody}>
        {successMessage && (
          <div className={styles.qaSuccessBanner} role="status">
            <CheckCircle2 size={16} strokeWidth={2.2} />
            <div>
              <strong>{successMessage}</strong>
              <p style={{ margin: "2px 0 0", fontSize: "11.5px" }}>
                Visitors to the homepage will now see your experience in the Student Reviews section.
              </p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className={styles.qaErrorBanner} role="alert">
            {errorMessage}
          </div>
        )}

        {existingFeedback && !isEditing ? (
          <div className={styles.qaActiveReviewBox}>
            <div className={styles.qaActiveReviewHeader}>
              <div className={styles.qaActiveReviewStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={16}
                    fill={star <= (existingFeedback.rating || 5) ? "#f59e0b" : "none"}
                    color={star <= (existingFeedback.rating || 5) ? "#f59e0b" : "var(--text-dim)"}
                  />
                ))}
                <span className={styles.qaActiveReviewScore}>
                  {existingFeedback.rating || 5} / 5 Stars
                </span>
              </div>
              <span className={styles.qaFeaturedBadge}>
                <Sparkles size={11} /> Featured on Homepage
              </span>
            </div>

            <blockquote className={styles.qaActiveReviewQuote}>
              &ldquo;{existingFeedback.message}&rdquo;
            </blockquote>

            <div className={styles.qaActiveReviewFooter}>
              <span className={styles.qaHistoryMeta}>
                Submitted{" "}
                {existingFeedback.created_at
                  ? new Date(existingFeedback.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Recently"}
              </span>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setIsEditing(true)}
              >
                <Edit3 size={13} /> Update Review
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.qaForm}>
            {/* Star Rating Picker */}
            <div className={styles.qaFieldGroup}>
              <label className={styles.qaLabel}>Rate your LabMate experience</label>
              <div className={styles.qaStarPickerRow}>
                <div
                  className={styles.qaStarsContainer}
                  role="radiogroup"
                  aria-label="Star rating out of 5"
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      role="radio"
                      aria-checked={rating === star}
                      className={styles.qaStarBtn}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      title={`${star} star${star === 1 ? "" : "s"}`}
                    >
                      <Star
                        size={22}
                        fill={star <= activeStars ? "#f59e0b" : "none"}
                        color={star <= activeStars ? "#f59e0b" : "var(--text-dim)"}
                      />
                    </button>
                  ))}
                </div>
                <span className={styles.qaRatingDesc}>
                  {RATING_DESCRIPTIONS[activeStars] || `${activeStars} Stars`}
                </span>
              </div>
            </div>

            {/* Message Textarea */}
            <div className={styles.qaFieldGroup}>
              <label htmlFor="feedback-message-input" className={styles.qaLabel}>
                Your Review &amp; Experience <span className={styles.qaRequired}>*</span>
              </label>
              <textarea
                id="feedback-message-input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How did LabMate help you? (e.g. Saved me hours before my deadline, loved the real output screenshots and formatted Word doc...)"
                rows={3}
                maxLength={1200}
                className={styles.qaTextarea}
                disabled={submitting}
              />
              <div className={styles.qaCharCount}>
                <span>{message.length} / 1200 characters</span>
                {message.length > 0 && message.length < 8 && (
                  <span style={{ color: "#e11d48" }}>Minimum 8 characters</span>
                )}
              </div>
            </div>

            <div className={styles.qaFormActions}>
              <p className={styles.qaHint}>
                ⭐️ 4 &amp; 5-star reviews from students appear publicly in the Student Reviews section on our homepage. Your email and full name remain private.
              </p>
              <div className={styles.qaBtnRow}>
                {existingFeedback && (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => setIsEditing(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting || message.trim().length < 8}
                  className={styles.primaryButton}
                >
                  <Send size={13} strokeWidth={2} />
                  {submitting ? "Submitting..." : existingFeedback ? "Update Review" : "Post to Homepage"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
