"use client";

import React from "react";

interface LoadingStateProps {
  message?: string;
}

/** Crisp Power BI dataset ingestion & visual evaluation indicator. */
export function LoadingState({ message = "Working on it... Loading dataset model" }: LoadingStateProps) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        width: "100%",
        background: "#ffffff",
        gap: 12,
        color: "#605e5c",
        fontSize: 13,
      }}
    >
      <div
        className="animate-spin"
        style={{
          width: 28,
          height: 28,
          border: "2.5px solid #e1dfdd",
          borderTopColor: "#117865",
          borderRadius: "999px",
        }}
      />
      <span>{message}</span>
    </div>
  );
}
