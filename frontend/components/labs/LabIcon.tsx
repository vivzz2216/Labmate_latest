import type { ComponentType, SVGProps } from "react";
import { BarChart3, Database, Layers, Network } from "lucide-react";
import {
  SiAndroidstudio,
  SiCisco,
  SiCplusplus,
  SiGooglecolab,
  SiOpenjdk,
  SiPython,
  SiPytorch,
  SiR,
  SiReact,
  SiUbuntu,
  SiWireshark,
} from "react-icons/si";

type IconProps = { size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: boolean | "true" | "false" };
type IconComponent = ComponentType<IconProps> | ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

/**
 * One monochrome mark per lab track. Technology logos come from the Simple Icons set (react-icons/si), the official brand
 * glyphs, drawn in a single colour (currentColor) so they follow the card's black / silver theme. Tracks that are not a single
 * product, or whose logo is a wordmark that is unreadable at icon size (MySQL), use a Lucide line icon.
 */
const BRAND: Record<string, IconComponent> = {
  deep_learning: SiPytorch,
  python: SiPython,
  java: SiOpenjdk,
  cpp: SiCplusplus,
  web: SiReact,
  colab: SiGooglecolab,
  r: SiR,
  ubuntu: SiUbuntu,
};

const LINE: Record<string, IconComponent> = {
  distributed: Network,
  networks: Network,
  sql: Database,
  sma: BarChart3,
};

/** Marks for the practice studios (genuine brand glyphs; Power BI has no glyph in the set, so it gets a line icon). */
const STUDIO: Record<string, IconComponent> = {
  "packet-tracer": SiCisco,
  wireshark: SiWireshark,
  "power-bi": BarChart3,
  "android-studio": SiAndroidstudio,
};

export function StudioIcon({ studio, size = 22 }: { studio: string; size?: number }) {
  const Glyph = (STUDIO[studio] || Layers) as ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean | "true" | "false" }>;
  return <Glyph size={size} strokeWidth={1.6} aria-hidden="true" />;
}

export default function LabIcon({ track, size = 22 }: { track: string; size?: number }) {
  const Brand = BRAND[track];
  if (Brand) {
    const Mark = Brand as ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" | "false" }>;
    return <Mark size={size} aria-hidden="true" />;
  }
  const Line = (LINE[track] || Layers) as ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean | "true" | "false" }>;
  return <Line size={size} strokeWidth={1.6} aria-hidden="true" />;
}
