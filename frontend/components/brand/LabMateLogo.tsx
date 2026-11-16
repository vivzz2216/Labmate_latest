import React from "react";
import Image from "next/image";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  className?: string;
  theme?: "dark" | "light";
}

const SIZE_MAP = {
  sm: { width: 82, height: 22, markSize: 22 },
  md: { width: 105, height: 28, markSize: 28 },
  lg: { width: 134, height: 36, markSize: 36 },
  xl: { width: 179, height: 48, markSize: 48 },
} as const;

export default function LabMateLogo({
  size = "md",
  showWordmark = true,
  className = "",
  theme = "dark",
}: LogoProps) {
  const { width, height, markSize } = SIZE_MAP[size];
  const targetWidth = showWordmark ? width : markSize;
  const targetHeight = showWordmark ? height : markSize;

  const src = showWordmark
    ? theme === "dark"
      ? "/images/labmate-logo-white.png"
      : "/images/labmate-logo-black.png"
    : theme === "dark"
      ? "/images/labmate-mark-white.png"
      : "/images/labmate-mark-black.png";

  return (
    <span
      className={`inline-flex items-center select-none shrink-0 ${className}`}
      style={{ width: targetWidth, height: targetHeight }}
    >
      <Image
        src={src}
        alt="LabMate"
        width={targetWidth}
        height={targetHeight}
        priority
        unoptimized
        style={{
          width: targetWidth,
          height: targetHeight,
          objectFit: "contain",
          display: "block",
        }}
      />
    </span>
  );
}
