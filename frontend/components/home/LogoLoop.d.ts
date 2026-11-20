import type { ComponentType, ReactNode } from "react";

type Logo = { node: ReactNode; title: string; ariaLabel?: string; href?: string };
type LogoLoopProps = {
  logos: Logo[];
  speed?: number;
  direction?: "left" | "right" | "up" | "down";
  logoHeight?: number;
  gap?: number;
  hoverSpeed?: number;
  scaleOnHover?: boolean;
  labels?: "none" | "inline" | "below" | "hover";
  ariaLabel?: string;
};
declare const LogoLoop: ComponentType<LogoLoopProps>;
export default LogoLoop;
