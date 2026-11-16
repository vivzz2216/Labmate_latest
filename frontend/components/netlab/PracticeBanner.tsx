"use client";

/**
 * The permanent label of a LabMate practice environment. It is part of the page, so it appears in every screenshot taken of the
 * studio, and it says plainly that the tool is a model and not the real product.
 */
export function PracticeBanner({ tool }: { tool: string }) {
  return (
    <div
      role="note"
      style={{
        background: "#fff4cf",
        color: "#5b4300",
        borderBottom: "1px solid #e3c766",
        fontSize: 11.5,
        lineHeight: "18px",
        padding: "0 10px",
        display: "flex",
        justifyContent: "space-between",
        fontFamily: "Segoe UI, system-ui, sans-serif",
      }}
    >
      <span>
        <strong>LabMate practice environment</strong> — a simplified model for learning. It is not {tool}.
      </span>
      <span>Packets and results are computed by LabMate&apos;s own engine.</span>
    </div>
  );
}
