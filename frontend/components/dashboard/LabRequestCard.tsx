"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  HelpCircle,
  Send,
  CheckCircle2,
  Clock,
  Sparkles,
  Plus,
  Layers,
  ChevronRight,
} from "lucide-react";
import { apiService } from "@/lib/api";
import styles from "@/app/dashboard/dashboard.module.css";

interface SavedRequest {
  id: number;
  question: string;
  lab_name: string;
  details: string | null;
  status: string;
  created_at: string | null;
}

const POPULAR_SUGGESTIONS = [
  "Android Studio / Mobile Computing",
  "NS2 / Network Simulation",
  "MATLAB / Signal Processing",
  "Docker & Kubernetes",
  "Big Data (Hadoop / Spark)",
  "Microprocessor 8085 / 8086",
  "Computer Graphics (OpenGL)",
  "Compiler Design (Lex / Yacc)",
];

export default function LabRequestCard() {
  const [labName, setLabName] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [savedRequests, setSavedRequests] = useState<SavedRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [showForm, setShowForm] = useState(true);

  const fetchMyRequests = useCallback(async () => {
    try {
      const res = await apiService.getMyLabRequests();
      if (Array.isArray(res.requests)) {
        setSavedRequests(res.requests);
      }
    } catch {
      // Ignore initial background fetch error silently
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    fetchMyRequests();
  }, [fetchMyRequests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = labName.trim();
    if (!trimmed) {
      setErrorMessage("Please enter the lab or subject name you need.");
      return;
    }
    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await apiService.submitLabRequest({
        question: "What lab do you need?",
        lab_name: trimmed,
        details: details.trim() || undefined,
      });

      if (res.ok) {
        setSuccessMessage(`Saved! We recorded your request for "${trimmed}".`);
        setLabName("");
        setDetails("");
        fetchMyRequests();
      } else {
        setErrorMessage("Could not save your request. Please try again.");
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setErrorMessage(
        typeof detail === "string" ? detail : "Failed to save your answer. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectChip = (chip: string) => {
    setLabName(chip);
    setErrorMessage("");
  };

  return (
    <section className={styles.panel} aria-labelledby="lab-qa-heading">
      <div className={styles.panelHeader}>
        <div className={styles.qaHeaderTitle}>
          <span className={styles.qaHeaderIcon}>
            <HelpCircle size={17} strokeWidth={2.2} />
          </span>
          <div>
            <h2 id="lab-qa-heading">What lab do you need?</h2>
            <p>Tell us what practical or subject your college requires next</p>
          </div>
        </div>
        {savedRequests.length > 0 && (
          <span className={styles.qaCountBadge}>
            {savedRequests.length} {savedRequests.length === 1 ? "request saved" : "requests saved"}
          </span>
        )}
      </div>

      <div className={styles.qaCardBody}>
        {successMessage && (
          <div className={styles.qaSuccessBanner} role="status">
            <CheckCircle2 size={16} strokeWidth={2.2} />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className={styles.qaErrorBanner} role="alert">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.qaForm}>
          <div className={styles.qaFieldGroup}>
            <label htmlFor="qa-lab-input" className={styles.qaLabel}>
              Lab, subject, or software tool <span className={styles.qaRequired}>*</span>
            </label>
            <input
              id="qa-lab-input"
              type="text"
              value={labName}
              onChange={(e) => setLabName(e.target.value)}
              placeholder="e.g. Mobile Computing Android Lab, NS2, MATLAB..."
              maxLength={200}
              className={styles.qaTextInput}
              disabled={submitting}
            />
          </div>

          {/* Quick Suggestions Chips */}
          <div className={styles.qaChipsContainer}>
            <span className={styles.qaChipsLabel}>Quick suggestions:</span>
            <div className={styles.qaChipsRow}>
              {POPULAR_SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  className={`${styles.qaChip} ${labName === sug ? styles.qaChipActive : ""}`}
                  onClick={() => handleSelectChip(sug)}
                  disabled={submitting}
                >
                  <Sparkles size={11} /> {sug}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.qaFieldGroup}>
            <label htmlFor="qa-details-input" className={styles.qaLabel}>
              Additional details / syllabus notes <span className={styles.qaOptional}>(optional)</span>
            </label>
            <textarea
              id="qa-details-input"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g. 5th Sem Computer Engg, Mumbai University, includes socket programming..."
              maxLength={1000}
              rows={2}
              className={styles.qaTextarea}
              disabled={submitting}
            />
          </div>

          <div className={styles.qaFormActions}>
            <p className={styles.qaHint}>
              Your answer is saved to your account. Our engineering team prioritizes new lab templates by student demand.
            </p>
            <button
              type="submit"
              disabled={submitting || !labName.trim()}
              className={styles.primaryButton}
            >
              <Send size={13} strokeWidth={2} />
              {submitting ? "Saving Answer..." : "Save My Answer"}
            </button>
          </div>
        </form>

        {/* Saved Requests List */}
        {savedRequests.length > 0 && (
          <div className={styles.qaHistorySection}>
            <h3 className={styles.qaHistoryHeading}>
              <Clock size={13} /> Your Submitted Lab Requests ({savedRequests.length})
            </h3>
            <div className={styles.qaHistoryList}>
              {savedRequests.map((req) => (
                <div key={req.id} className={styles.qaHistoryItem}>
                  <div className={styles.qaHistoryMain}>
                    <strong className={styles.qaHistoryName}>{req.lab_name}</strong>
                    {req.details && <p className={styles.qaHistoryDetails}>{req.details}</p>}
                    <span className={styles.qaHistoryMeta}>
                      {req.created_at
                        ? new Date(req.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Recently saved"}
                    </span>
                  </div>
                  <span className={styles.qaStatusPill}>
                    <CheckCircle2 size={12} /> {req.status === "received" ? "Saved & Received" : req.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
