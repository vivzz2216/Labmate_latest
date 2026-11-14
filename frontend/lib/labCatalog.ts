import catalog from "./lab-catalog.json";
import { LabLanguage } from "./workflow";

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

