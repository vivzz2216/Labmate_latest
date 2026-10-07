import React from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  className?: string;
  theme?: "dark" | "light";
}

export default function LabMateLogo({
  size = "md",
  showWordmark = true,
  className = "",
  theme = "dark",
}: LogoProps) {
  const sizeMap = {
    sm: { icon: 20, font: "text-base tracking-tight", markW: 22, markH: 22 },
    md: { icon: 26, font: "text-lg tracking-tight", markW: 28, markH: 28 },
    lg: { icon: 34, font: "text-2xl tracking-tighter", markW: 36, markH: 36 },
    xl: { icon: 44, font: "text-3xl tracking-tighter", markW: 48, markH: 48 },
  };

  const { icon, font, markW, markH } = sizeMap[size];
  const textColor = theme === "dark" ? "#ffffff" : "#0a0a0a";
  const iconColor = theme === "dark" ? "#ffffff" : "#0a0a0a";

  return (
    <div
      className={`inline-flex items-center gap-2.5 font-bold select-none ${className}`}
      style={{ fontFamily: "var(--font-sans, -apple-system, sans-serif)" }}
    >
      {/* Precision Geometric Black & White Monogram */}
      <svg
        width={markW}
        height={markH}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-transform duration-300 hover:scale-105"
      >
        {/* Outer Dark Vessel Outline */}
        <rect
          x="3"
          y="3"
          width="34"
          height="34"
          rx="9"
          stroke={iconColor}
          strokeWidth="2.2"
          strokeOpacity="0.85"
        />
        {/* Minimalist Isometric Laboratory Apex & Energy Ray */}
        <path
          d="M13 14H27"
          stroke={iconColor}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M17 14V19L11 28C10.5 28.8 11.1 30 12.1 30H27.9C28.9 30 29.5 28.8 29 28L23 19V14"
          stroke={iconColor}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Core Quantum Dot / Synthesis Node */}
        <circle cx="20" cy="24" r="2.2" fill={iconColor} />
      </svg>

      {showWordmark && (
        <span
          className={`font-semibold tracking-[-0.035em] ${font}`}
          style={{
            color: textColor,
            letterSpacing: "-0.04em",
          }}
        >
          LABMATE
        </span>
      )}
    </div>
  );
}
