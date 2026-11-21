import type { LabCategory } from "./labCatalog";
import type { LabLanguage } from "./workflow";

const TRACK_LANGUAGE_VARIANTS: Record<string, LabLanguage[]> = {
  deep_learning: ["auto", "colab", "python", "r"],
  "deep-learning": ["auto", "colab", "python", "r"],
  colab: ["auto", "colab", "python", "r"],
  distributed: ["distributed"],
  "distributed-computing": ["distributed"],
  python: ["python"],
  java: ["java"],
  cpp: ["cpp", "c"],
  "c-cpp": ["cpp", "c"],
  c: ["c", "cpp"],
  web: ["html", "react", "node"],
  "web-development": ["html", "react", "node"],
  sql: ["sql"],
  r: ["r"],
  sma: ["auto", "colab", "python", "r"],
  "social-media-analytics": ["auto", "colab", "python", "r"],
};

export function normalizeTrackKey(slugOrTrack: string): string {
  return (slugOrTrack || "").trim().toLowerCase().replace(/_/g, "-");
}

export function findCategoryInList(
  categories: LabCategory[],
  slugOrTrack: string,
): LabCategory | undefined {
  const key = normalizeTrackKey(slugOrTrack);
  if (!key) return undefined;
  return categories.find(
    (cat) => normalizeTrackKey(cat.slug) === key || normalizeTrackKey(cat.track) === key,
  );
}

export function getCategoryCodeStudioHref(category: { slug: string; track: string }): string {
  const params = new URLSearchParams({
    lab: category.slug,
    track: category.track,
  });
  return `/code-execution?${params.toString()}`;
}

export function getAllowedLanguagesForTrack(slugOrTrack: string): LabLanguage[] {
  const key = normalizeTrackKey(slugOrTrack);
  const underscoreKey = key.replace(/-/g, "_");
  return TRACK_LANGUAGE_VARIANTS[key] || TRACK_LANGUAGE_VARIANTS[underscoreKey] || [];
}

export function resolveTrackLanguage(
  slugOrTrack: string,
  categories?: LabCategory[],
  expId?: string | null,
): LabLanguage {
  const cat = categories ? findCategoryInList(categories, slugOrTrack) : undefined;
  const allowed = getAllowedLanguagesForTrack(slugOrTrack);
  if (allowed.length > 0) return allowed[0];
  if (cat?.defaultLanguage) return cat.defaultLanguage;
  return "auto";
}

