import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  STUDIO_PRESETS,
  DEFAULT_DEVICES,
  LOGCAT_TAG_PALETTE,
  getLogcatTagColor,
  createInitialLogcatEntries,
  filterLogcatEntries,
  buildAndroidProjectTree,
  analyzeStudioProblems,
  extractPreviewTree,
  runAndroidApp,
  executeStudioTerminal,
} from "../lib/ide/androidStudioEngine.ts";
import type { AndroidTreeNode, StudioProblem } from "../lib/ide/androidStudioEngine.ts";

describe("Android Studio Engine (Ladybug / Meerkat ExpUI Dark)", () => {
  it("provides authentic Android project presets with MainActivity.kt, activity_main.xml, and build.gradle.kts", () => {
    assert.ok(STUDIO_PRESETS.length >= 2);
    const first = STUDIO_PRESETS[0];
    assert.equal(first.name, "MyApplication");
    const fileIds = first.files.map((f) => f.id);
    assert.ok(fileIds.includes("main-activity"));
    assert.ok(fileIds.includes("activity-main-xml"));
    assert.ok(fileIds.includes("gradle-module"));
  });

  it("builds virtualized Android View tree with manifests, java test tints, res, and Gradle Scripts", () => {
    const preset = STUDIO_PRESETS[0];
    const androidTree = buildAndroidProjectTree(preset, "Android");
    assert.equal(androidTree.length, 2);
    assert.equal(androidTree[0].label, "app");
    assert.equal(androidTree[1].label, "Gradle Scripts");

    const appChildren = androidTree[0].children ?? [];
    const labels = appChildren.map((c: AndroidTreeNode) => c.label);
    assert.deepEqual(labels, ["manifests", "kotlin+java", "res"]);

    const javaChildren = appChildren[1].children ?? [];
    const androidTestPkg = javaChildren.find((c: AndroidTreeNode) =>
      c.label.includes("(androidTest)")
    );
    assert.ok(androidTestPkg, "Expected (androidTest) package node");
    assert.equal(androidTestPkg.isTest, true);

    const gradleScripts = androidTree[1].children ?? [];
    const gradleAppNode = gradleScripts.find(
      (n: AndroidTreeNode) => n.fileId === "gradle-module"
    );
    assert.ok(gradleAppNode);
    assert.equal(gradleAppNode.hint, "(Module :app)");
  });

  it("filters Logcat v2 queries (package:mine, tag:, level:, -negation, ~regex)", () => {
    const initial = createInitialLogcatEntries("com.example.myapplication");
    const filtered = filterLogcatEntries(
      initial,
      "package:mine level:INFO -tag:Choreographer",
      "com.example.myapplication"
    );
    assert.ok(filtered.length > 0);
    assert.ok(
      filtered.every((e) => e.packageName === "com.example.myapplication")
    );
    assert.ok(filtered.every((e) => e.tag !== "Choreographer"));
    assert.ok(filtered.every((e) => ["I", "W", "E", "A"].includes(e.level)));
  });

  it("assigns deterministic 16-color Logcat tag colors", () => {
    const colorA = getLogcatTagColor("MainActivity");
    const colorB = getLogcatTagColor("MainActivity");
    assert.equal(colorA, colorB);
    assert.ok(LOGCAT_TAG_PALETTE.includes(colorA));
  });

  it("extracts Compose @Preview and runs APK build + Logcat emission", () => {
    const preset = STUDIO_PRESETS[0];
    const preview = extractPreviewTree(preset.files, "main-activity", 0);
    assert.equal(preview.type, "Column");
    assert.ok(
      preview.children.some((c) => (c.text ?? "").includes("Android"))
    );

    const runRes = runAndroidApp(
      preset.files,
      "main-activity",
      DEFAULT_DEVICES[0],
      0
    );
    assert.equal(runRes.success, true);
    assert.ok(runRes.buildSteps.length >= 4);
    assert.ok(runRes.logcatEmitted.length >= 1);
  });

  it("detects syntax problems and executes Gradle/ADB terminal commands", () => {
    const preset = STUDIO_PRESETS[0];
    const brokenFiles = preset.files.map((f) =>
      f.id === "main-activity" ? { ...f, content: f.content + "\n}" } : f
    );
    const problems = analyzeStudioProblems(brokenFiles);
    assert.ok(problems.some((p: StudioProblem) => p.severity === "error"));

    const adb = executeStudioTerminal("adb devices", preset, DEFAULT_DEVICES);
    assert.ok(adb.lines.some((l: string) => l.includes("List of devices attached")));

    const assemble = executeStudioTerminal(
      "./gradlew assembleDebug",
      preset,
      DEFAULT_DEVICES
    );
    assert.ok(assemble.lines.some((l: string) => l.includes("BUILD SUCCESSFUL")));
  });
});
