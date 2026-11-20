import catalog from "./lab-catalog.json";
import { LabLanguage } from "./workflow";

// A multi-part experiment (Social Media Analytics) is launched as one question per part:
//   theory   - a written answer,
//   code     - a Python notebook run on LabMate practice data,
//   evidence - work done in an outside tool; LabMate writes the procedure and the student uploads their own screenshots.
export type LabPartKind = "theory" | "code" | "evidence";

export interface LabEvidenceSlot {
  id: string;
  label: string;
}

export interface LabPart {
  kind: LabPartKind;
  title: string;
  text: string;
  builtinDatasets?: string[];
  evidenceSlots?: LabEvidenceSlot[];
  // A part LabMate builds itself in a practice studio (Computer Networks): the packet analyser or the network simulator.
  studio?: "wireshark" | "packettracer" | "powerbi" | "android";
  studioArgs?: Record<string, string>;
}

export interface LabExperiment {
  id: string;
  number: number;
  title: string;
  aim: string;
  category: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  frameworks: string[];
  runtime: LabLanguage;
  track: string;
  description: string;
  prerequisites?: string[];
  expectedOutputs: string[];
  starterPrompt: string;
  parts?: LabPart[];
  // Practice files students can download for their exercises.
  downloads?: string[];
  // Practice studios the student can open and use directly (Computer Networks).
  workspaces?: { label: string; href: string }[];
}

export interface LabCategory {
  slug: string;
  track: string;
  title: string;
  shortTitle: string;
  tagline: string;
  description: string;
  defaultLanguage: LabLanguage;
  badge?: string;
  accentColor: string;
  features: string[];
  environmentSpecs: { label: string; value: string }[];
  experiments: LabExperiment[];
}

export const LAB_CATEGORIES = catalog as LabCategory[];

export function getLabCategory(slugOrTrack: string): LabCategory | undefined {
  const normalized = slugOrTrack.toLowerCase().replace(/_/g, "-");
  return LAB_CATEGORIES.find(
    (c) =>
      c.slug.toLowerCase() === normalized ||
      c.track.toLowerCase().replace(/_/g, "-") === normalized,
  );
}

export function getAllLabCategories(): LabCategory[] {
  return LAB_CATEGORIES;
}

export function getExperimentsByTrack(track: string): LabExperiment[] {
  const category = getLabCategory(track);
  return category ? category.experiments : [];
}

