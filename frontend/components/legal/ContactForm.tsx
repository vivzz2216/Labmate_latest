"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/BasicAuthContext";
import styles from "./contact.module.css";

export default function ContactForm() {
  const { user, loading } = useAuth();
  const [message, setMessage] = useState("");
  const [topic, setTopic] = useState("Lab execution & reports");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !message.trim() || state === "sending") return;
    setState("sending");
    try {
      await api.post("/api/feedback", { message: `[Contact] ${topic}\n\n${message.trim()}` });
      setState("sent");
      setMessage("");
    } catch {
      setState("failed");
    }
  };

  return (
    <form onSubmit={send} className={styles.form}>
      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="contact-name">Your name</label>
          <input id="contact-name" className={styles.input} value={user?.name || ""} readOnly placeholder="Your account name" autoComplete="name" />
        </div>
        <div className={styles.field}>
          <label htmlFor="contact-email">Email address</label>
          <input id="contact-email" className={styles.input} type="email" value={user?.email || ""} readOnly placeholder="Your account email" autoComplete="email" />
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="contact-topic">What can we help with?</label>
        <select id="contact-topic" className={styles.input} value={topic} onChange={event => { setTopic(event.target.value); setState("idle"); }} disabled={state === "sending"}>
          <option>Lab execution &amp; reports</option>
          <option>Payments &amp; refunds</option>
          <option>Account &amp; privacy</option>
          <option>Feedback &amp; partnerships</option>
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="contact-message">Your message</label>
        <textarea id="contact-message" className={styles.input} value={message}
          onChange={event => { setMessage(event.target.value); if (state !== "sending") setState("idle"); }}
          maxLength={4800} rows={5} required disabled={state === "sending"}
          placeholder="Tell us a little about what you need help with." />
        <p className={styles.hint}>{topic === "Payments & refunds" ? "Include your payment reference (starts with pay_)." : "For a lab issue, include the experiment name and what happened."}</p>
      </div>
      {user ? <>
        <button type="submit" className={styles.submit} disabled={state === "sending" || !message.trim()}>
          {state === "sending" ? "Sending..." : "Send message"} <ArrowUpRight size={16} />
        </button>
        <p className={styles.hint}>Your message is private. Replies go to the email on your account.</p>
      </> : <>
        <Link href="/?login=1" className={styles.submit}>{loading ? "Checking your account..." : "Sign in to send a message"} <ArrowUpRight size={16} /></Link>
        <p className={styles.hint}>Sign in so we can connect your request to your account and reply by email.</p>
      </>}
      <div role="status" className={styles.status} aria-live="polite">
        {state === "sent" && <span className={styles.success}><CheckCircle2 size={15} style={{ display: "inline", marginRight: 6 }} />Message sent. We will reply by email.</span>}
        {state === "failed" && <span className={styles.error}>Could not send your message. Please try again.</span>}
      </div>
    </form>
  );
}
