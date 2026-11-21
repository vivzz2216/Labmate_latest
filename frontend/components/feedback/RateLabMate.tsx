"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/BasicAuthContext";
import styles from "./RateLabMate.module.css";

const LABELS = ["Poor", "Fair", "Good", "Very good", "Excellent"];
const MAX = 1000;
const KEY = "labmate.feedback.sent.v1";

interface RateLabMateProps {
  /** where the form is shown; only used for the heading text */
  prompt?: string;
  /** hide the form for 30 days after the student has sent feedback from this browser (used on the report-ready screen) */
  rememberSent?: boolean;
  /** pads the form when it is not inside a panel body */
  padded?: boolean;
  /** called after the feedback was saved */
  onSent?: () => void;
}

/** Star rating plus a comment, sent to POST /api/feedback. Rated feedback may be shown anonymously on the home page (see /api/feedback/reviews). */
export default function RateLabMate({ prompt = "How was your experience with LabMate?", rememberSent = false, padded = false, onSent }: RateLabMateProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!rememberSent || !user) return;
    try {
      const at = Number(window.localStorage.getItem(`${KEY}.${user.id}`) || 0);
      if (at && Date.now() - at < 30 * 24 * 3600 * 1000) setHidden(true);
    } catch {
      /* storage blocked: show the form */
    }
  }, [rememberSent, user]);

  if (hidden) return null;
  const wrap = `${styles.form} ${padded ? styles.formPad : ""}`;

  if (!user) {
    return (
      <div className={wrap}>
        <p className={styles.prompt}>
          <Link href="/?login=1">Sign in</Link> to rate LabMate and tell us what to improve.
        </p>
      </div>
    );
  }

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!rating || !message.trim()) return;
    setState("sending");
    try {
      await api.post("/api/feedback", { rating, message: message.trim() });
      setState("sent");
      if (onSent) onSent();
      try {
        if (rememberSent) window.localStorage.setItem(`${KEY}.${user.id}`, String(Date.now()));
      } catch {
        /* ignore */
      }
    } catch {
      setState("failed");
    }
  };

  if (state === "sent") {
    return (
      <div className={wrap} role="status">
        <p className={styles.ok}>Thank you! Your feedback was sent.</p>
        <p className={styles.note}>We read every message. Ratings with a comment may appear anonymously on the LabMate home page.</p>
      </div>
    );
  }

  const shown = hover || rating;
  return (
    <form className={wrap} onSubmit={send}>
      <p className={styles.prompt}>{prompt}</p>
      <div role="radiogroup" aria-label="Rating" className={styles.stars} onMouseLeave={() => setHover(0)}>
        {LABELS.map((label, i) => {
          const n = i + 1;
          const on = n <= shown;
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} out of 5, ${label}`}
              title={label}
              className={`${styles.star} ${on ? styles.starOn : ""}`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(0)}
            >
              <Star size={18} fill={on ? "currentColor" : "none"} aria-hidden="true" />
            </button>
          );
        })}
        <span className={styles.note} style={{ alignSelf: "center", marginLeft: 6 }}>{shown ? LABELS[shown - 1] : "Choose a rating"}</span>
      </div>
      <label className={styles.label} htmlFor="rate-labmate-message">
        What worked well, or what should we improve?
      </label>
      <textarea
        id="rate-labmate-message"
        className={styles.textarea}
        value={message}
        maxLength={MAX}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Your comment"
      />
      <div className={styles.row}>
        <button type="submit" className={styles.submit} disabled={state === "sending" || !rating || !message.trim()}>
          {state === "sending" ? "Sending…" : "Send feedback"}
        </button>
        <span role="status" className={styles.err}>
          {state === "failed" ? "Could not send. Please try again." : ""}
        </span>
        <span className={styles.counter}>{message.length}/{MAX}</span>
      </div>
      <p className={styles.note}>Your name and email are never shown. Ratings with a comment may appear anonymously on the LabMate home page.</p>
    </form>
  );
}
