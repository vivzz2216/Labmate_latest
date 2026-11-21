import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { LabCategory } from "../lib/labCatalog.ts";
import * as labStudioLaunch from "../lib/labStudioLaunch.ts";
import {
  getAllowedLanguagesForTrack,
  getCategoryCodeStudioHref,
  resolveTrackLanguage,
} from "../lib/labStudioLaunch.ts";

const categories = JSON.parse(
  fs.readFileSync(path.resolve("frontend/lib/lab-catalog.json"), "utf-8").replace(/^\uFEFF/, ""),
) as LabCategory[];

const EXPECTED_TRACK_LANGUAGES: Record<string, string> = {
  "deep-learning": "auto",
  "distributed-computing": "distributed",
  python: "python",
  java: "java",
  "c-cpp": "cpp",
  "web-development": "html",
  sql: "sql",
  colab: "auto",
  r: "r",
  "social-media-analytics": "auto",
};

test("Every lab category generates a manual-first Code Studio URL and contains zero hardcoded experiments", () => {
  assert.equal(categories.length, 10);

  for (const cat of categories) {
    assert.deepEqual(cat.experiments, [], `${cat.slug} must have no preloaded experiments`);
    const href = getCategoryCodeStudioHref(cat);
    assert.ok(href.startsWith("/code-execution?"), `Expected /code-execution link for ${cat.slug}, got ${href}`);
    const params = new URLSearchParams(href.split("?")[1]);
    assert.equal(params.get("lab"), cat.slug);
    assert.equal(params.get("track"), cat.track);

    const expectedLang = EXPECTED_TRACK_LANGUAGES[cat.slug];
    assert.equal(resolveTrackLanguage(cat.slug, categories), expectedLang);
    assert.equal(resolveTrackLanguage(cat.track, categories), expectedLang);
  }
});

test("Manual-first launch module does not expose hardcoded experiment builders or default selections", () => {
  assert.equal("buildQuestionsForExperiments" in labStudioLaunch, false);
  assert.equal("getDefaultSelectedExperimentIds" in labStudioLaunch, false);
});

test("Deep Learning and Notebook tracks support Google Colab, Jupyter Notebook, and R / RStudio", () => {
  for (const track of ["deep-learning", "colab", "social-media-analytics"]) {
    assert.deepEqual(getAllowedLanguagesForTrack(track), ["auto", "colab", "python", "r"]);
  }
  assert.deepEqual(getAllowedLanguagesForTrack("distributed-computing"), ["distributed"]);
  assert.deepEqual(getAllowedLanguagesForTrack("sql"), ["sql"]);
  assert.deepEqual(getAllowedLanguagesForTrack("r"), ["r"]);
  assert.deepEqual(getAllowedLanguagesForTrack("c-cpp"), ["cpp", "c"]);
  assert.deepEqual(getAllowedLanguagesForTrack("web-development"), ["html", "react", "node"]);
});

test("Code Studio opens clean for uploaded manuals and supports all three notebook environments", () => {
  const studioSrc = fs.readFileSync(
    path.resolve("frontend/app/code-execution/page.tsx"),
    "utf-8",
  );
  assert.ok(!studioSrc.includes("automatically loaded from catalog"));
  assert.ok(!/Experiment\s+[1-8]\b/i.test(studioSrc));
  assert.ok(studioSrc.includes('<option value="colab">Google Colab</option>'));
  assert.ok(studioSrc.includes('<option value="jupyter">Jupyter Notebook</option>'));
  assert.ok(studioSrc.includes('<option value="r">R / RStudio</option>'));
});

test("Lab Sections cards are non-clickable containers with explicit Open Code Studio buttons and no Lab details route", () => {
  const pageSrc = fs.readFileSync(
    path.resolve("frontend/app/labs/page.tsx"),
    "utf-8",
  );
  assert.ok(!/<Link[\s\S]{0,160}styles\.categoryCard/.test(pageSrc), "Card container must not be a Link");
  assert.ok(pageSrc.includes("<article"), "Each category card should be rendered as a semantic <article>");
  assert.ok(pageSrc.includes("Open Code Studio"), "Each card must have an explicit Open Code Studio button");
  assert.ok(!pageSrc.includes("Lab details"), "Lab details button must be removed");
  assert.equal(fs.existsSync(path.resolve("frontend/app/labs/[slug]/page.tsx")), false, "/labs/[slug] page must be deleted");
});

test("Mumbai University catalogue cards replace Syllabus & Outlines with direct Open Code Studio links", () => {
  const cardSrc = fs.readFileSync(
    path.resolve("frontend/components/catalogue/LabCard.tsx"),
    "utf-8",
  );
  const assocSrc = fs.readFileSync(
    path.resolve("frontend/lib/mumbaiUniversity/labIdeAssociations.ts"),
    "utf-8",
  );
  assert.ok(!cardSrc.includes("Syllabus &amp; Outlines"));
  assert.ok(cardSrc.includes("Open Code Studio"));
  assert.ok(cardSrc.includes("muLabCodeStudioHref"));
  assert.ok(assocSrc.includes("export function muLabCodeStudioHref"));
});
