"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

/** Desktop-sharp Power BI dialog container supporting Escape dismissal. */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = 560,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(37, 36, 35, 0.36)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: width,
          background: "#ffffff",
          border: "1px solid #c8c6c4",
          borderRadius: 4,
          boxShadow: "0 8px 28px rgba(0, 0, 0, 0.18)",
          color: "#252423",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            background: "#f3f2f1",
            borderBottom: "1px solid #e1dfdd",
          }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</span>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              border: 0,
              borderRadius: 2,
              background: "transparent",
              color: "#605e5c",
              cursor: "pointer",
            }}
          >
            <X size={15} />
          </button>
        </div>
        <div style={{ padding: 16, maxHeight: "72vh", overflowY: "auto" }}>{children}</div>
        {footer ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
              padding: "10px 14px",
              background: "#faf9f8",
              borderTop: "1px solid #e1dfdd",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
