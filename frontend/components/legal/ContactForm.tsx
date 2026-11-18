"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuth } from "@/contexts/BasicAuthContext";

/** Sends a private (unrated) message to the team through POST /api/feedback, which needs a signed-in student. */
export default function ContactForm() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  if (!user) {
    return (
      <p>
        <Link href="/?login=1">Sign in</Link> to send us a message from here. We reply to the email address on your account.
      </p>
    );
  }

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    setState("sending");
    try {
      await api.post("/api/feedback", { message: `[Contact] ${message.trim()}` });
      setState("sent");
      setMessage("");
    } catch {
      setState("failed");
    }
  };

  return (
    <form onSubmit={send} className="space-y-3">
      <label htmlFor="contact-message" className="block text-sm text-zinc-600">
        Your message (we reply to {user.email})
      </label>
      <textarea
        id="contact-message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        maxLength={4900}
        rows={6}
        required
        className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-zinc-900 shadow-sm outline-none focus:border-indigo-500"
        placeholder="Tell us what happened. For payments, include the payment reference (starts with pay_)."
      />
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={state === "sending" || !message.trim()}
          className="rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {state === "sending" ? "Sending…" : "Send message"}
        </button>
        <span role="status" className="text-sm">
          {state === "sent" && <span className="text-emerald-600">Sent. We will reply by email.</span>}
          {state === "failed" && <span className="text-red-600">Could not send. Please try again.</span>}
        </span>
      </div>
    </form>
  );
}
