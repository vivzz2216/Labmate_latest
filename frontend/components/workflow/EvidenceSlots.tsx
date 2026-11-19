"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { workflowApi, type EvidenceItem, type LabQuestion } from "@/lib/workflow";

interface Props {
  question: LabQuestion;
  uploadId: number | null;
  // Creates the assignment on first use, so a screenshot can be attached before the run starts.
  ensureUpload: () => Promise<number>;
  // A change after a finished run puts the assignment back in review; the page must reload its state to offer a new run.
  onReportOutdated?: (uploadId: number) => void;
  disabled?: boolean;
}

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_CAPTURE_BYTES = 8 * 1024 * 1024;
const DATASET_SLOT = "powerbi_dataset";
const CAPTURE_SLOT = "wireshark_pcap";

// Screenshots the student made in an outside tool (Power BI, Canva, ParseHub, Google Trends, Similarweb).
// LabMate only writes the procedure; these files are the student's own and go into the report as they are.
export default function EvidenceSlots({ question, uploadId, ensureUpload, onReportOutdated, disabled }: Props) {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [busySlot, setBusySlot] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const previewsRef = useRef<Record<number, string>>({});

  const refresh = useCallback(async (id: number) => {
    const rows = (await workflowApi.listEvidence(id)).filter((row) => row.question_id === question.id);
    setItems(rows);
    const next: Record<number, string> = {};
    for (const row of rows) {
      next[row.id] = previewsRef.current[row.id];
      // A dataset (CSV) or a capture (.pcap) is not an image: it has no preview.
      if (!next[row.id] && row.slot !== DATASET_SLOT && row.slot !== CAPTURE_SLOT) {
        try {
          next[row.id] = URL.createObjectURL(await workflowApi.evidenceImage(id, row.id));
        } catch {
          // A missing preview must not hide the slot itself.
        }
      }
    }
    for (const [key, url] of Object.entries(previewsRef.current)) {
      if (!rows.some((row) => String(row.id) === key)) URL.revokeObjectURL(url);
    }
    previewsRef.current = next;
    setPreviews(next);
  }, [question.id]);

  useEffect(() => {
    if (uploadId) refresh(uploadId).catch(() => undefined);
  }, [uploadId, refresh]);

  useEffect(
    () => () => {
      Object.values(previewsRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const choose = async (slotId: string, file: File | undefined) => {
    if (!file) return;
    setError("");
    setMessage("");
    if (file.size > (slotId === CAPTURE_SLOT ? MAX_CAPTURE_BYTES : MAX_BYTES)) {
      setError(slotId === DATASET_SLOT ? "The dataset is larger than 5 MB." : slotId === CAPTURE_SLOT ? "The capture is larger than 8 MB." : "That file is larger than 5 MB.");
      return;
    }
    setBusySlot(slotId);
    try {
      const id = uploadId ?? (await ensureUpload());
      const saved = await workflowApi.uploadEvidence(id, question.id, slotId, file);
      if (saved.report_outdated) {
        setMessage(slotId === DATASET_SLOT ? "Dataset saved. Generate the report again to rebuild the dashboard."
          : slotId === CAPTURE_SLOT ? "Capture saved. Generate the report again to analyse it."
          : "Screenshot saved. Generate the report again to include it.");
        onReportOutdated?.(id);
      }
      await refresh(id);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || (slotId === DATASET_SLOT ? "The dataset could not be uploaded." : slotId === CAPTURE_SLOT ? "The capture could not be uploaded." : "The screenshot could not be uploaded."));
    } finally {
      setBusySlot("");
    }
  };

  const remove = async (item: EvidenceItem) => {
    if (!uploadId) return;
    setError("");
    setBusySlot(item.slot);
    try {
      const result = await workflowApi.deleteEvidence(uploadId, item.id);
      if (result.report_outdated) {
        setMessage("Screenshot removed. Generate the report again to update it.");
        onReportOutdated?.(uploadId);
      }
      await refresh(uploadId);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || "The screenshot could not be removed.");
    } finally {
      setBusySlot("");
    }
  };

  const hasDataset = (question.evidence_slots || []).some((slot) => slot.id === DATASET_SLOT);
  const studioName = question.studio === "wireshark" ? "Wireshark" : question.studio === "packettracer" ? "Cisco Packet Tracer" : "";

  return (
    <div style={{ margin: "10px 0 14px", display: "grid", gap: 10 }}>
      {studioName ? (
        <p style={{ fontSize: 13, opacity: 0.8, margin: 0 }}>
          <strong>Built automatically.</strong> LabMate generates this part directly in {studioName} and captures the execution screenshots for you.
          {question.studio === "wireshark"
            ? " If you have your own packet capture (.pcap / .pcapng), attach it below to use your capture data."
            : ""}
        </p>
      ) : hasDataset ? (
        <p style={{ fontSize: 13, opacity: 0.8, margin: 0 }}>
          <strong>Upload your dataset (CSV, up to 5 MB) &mdash; required.</strong> LabMate loads it into its Power BI Desktop
          studio, builds the dashboard from your columns and captures it for the report. If you already built the dashboard in
          Power BI yourself, attach that screenshot instead and the dataset is not needed. Your course certificate is always
          your own upload; a slot left empty appears in the report as &ldquo;Not attached&rdquo;.
        </p>
      ) : (
        <p style={{ fontSize: 13, opacity: 0.8, margin: 0 }}>
          Add your own screenshots from the tool (PNG, JPG or PDF, up to 5 MB). LabMate never creates these images; a slot left
          empty appears in the report as &ldquo;Not attached&rdquo;.
        </p>
      )}
      {(question.evidence_slots || []).map((slot) => {
        const item = items.find((row) => row.slot === slot.id);
        const isDataset = slot.id === DATASET_SLOT;
        const isCapture = slot.id === CAPTURE_SLOT;
        return (
          <div
            key={slot.id}
            style={{ border: "1px solid rgba(128,128,128,.35)", borderRadius: 8, padding: 10, display: "flex", gap: 12, alignItems: "center" }}
          >
            {isDataset || isCapture ? (
              <div
                style={{ width: 96, height: 64, borderRadius: 4, background: "rgba(128,128,128,.15)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 600 }}
                aria-hidden="true"
              >
                {isCapture ? "PCAP" : "CSV"}
              </div>
            ) : item && previews[item.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previews[item.id]} alt={slot.label} style={{ width: 96, height: 64, objectFit: "cover", borderRadius: 4 }} />
            ) : (
              <div style={{ width: 96, height: 64, borderRadius: 4, background: "rgba(128,128,128,.15)" }} aria-hidden="true" />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: "block", fontSize: 14 }}>{slot.label}</strong>
              <span style={{ fontSize: 12, opacity: 0.75 }}>{item ? `Attached: ${item.filename}` : isDataset ? "Required: not uploaded yet" : isCapture ? "Optional: a practice capture is used when none is attached" : "Not attached yet"}</span>
            </div>
            <label style={{ cursor: disabled || busySlot ? "not-allowed" : "pointer", fontSize: 13, textDecoration: "underline" }}>
              {busySlot === slot.id ? "Uploading..." : item ? "Replace" : "Choose file"}
              <input
                type="file"
                accept={isDataset ? ".csv,text/csv,text/plain" : isCapture ? ".pcap,.pcapng,.cap" : "image/png,image/jpeg,application/pdf"}
                disabled={disabled || Boolean(busySlot)}
                style={{ display: "none" }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  void choose(slot.id, file);
                }}
              />
            </label>
            {item && (
              <button
                type="button"
                disabled={disabled || Boolean(busySlot)}
                onClick={() => void remove(item)}
                style={{ fontSize: 13, textDecoration: "underline", background: "none", border: 0, cursor: "pointer" }}
              >
                Remove
              </button>
            )}
          </div>
        );
      })}
      {message && <p role="status" style={{ fontSize: 13, margin: 0 }}>{message}</p>}
      {error && <p role="alert" style={{ fontSize: 13, margin: 0, color: "#b42318" }}>{error}</p>}
    </div>
  );
}
