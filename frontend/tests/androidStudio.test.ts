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
  createNewAndroidProject,
  createProjectFile,
  createProjectFolder,
  renameProjectFile,
  deleteProjectFile,
  computeProjectGitStatus,
} from "../lib/ide/androidStudioEngine.ts";
import type { AndroidTreeNode, StudioProblem } from "../lib/ide/androidStudioEngine.ts";
import {
  parseAndroidLayoutXml,
  updateElementAttributeInXml,
  insertComponentIntoLayoutXml,
  removeComponentFromLayoutXml,
  formatAndroidXml,
  formatJavaOrKotlinCode,
} from "../lib/ide/androidXmlLayout.ts";
import {
  launchAndroidRuntimeSession,
  updateRuntimeInputValue,
  dispatchRuntimeWidgetClick,
  navigateRuntimeBack,
} from "../lib/ide/androidActivityRuntime.ts";

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

  it("scaffolds Java Android projects and performs file/folder CRUD and git status diff", () => {
    const proj = createNewAndroidProject({
      appName: "Lab Portal",
      packageName: "edu.college.labportal",
      template: "two-activity-java",
      minSdk: 24,
    });
    assert.equal(proj.name, "LabPortal");
    assert.equal(proj.language, "java");
    assert.ok(proj.files.some((f) => f.path === "app/src/main/java/edu/college/labportal/MainActivity.java"));
    assert.ok(proj.files.some((f) => f.path === "app/src/main/AndroidManifest.xml"));
    assert.ok(proj.files.some((f) => f.path === "app/build.gradle"));
    assert.ok(proj.files.some((f) => f.path === "settings.gradle"));

    const added = createProjectFile(proj, {
      parentDir: "app/src/main/java/edu/college/labportal",
      fileName: "ProfileActivity.java",
      registerInManifest: true,
    });
    assert.equal(added.createdFile.kind, "java");
    const manifestAfter = added.preset.files.find((f) => f.kind === "manifest");
    assert.ok(manifestAfter?.content.includes(".ProfileActivity"));

    const withFolder = createProjectFolder(added.preset, "app/src/main/res/menu");
    const projTree = buildAndroidProjectTree(withFolder, "Project");
    assert.ok(JSON.stringify(projTree).includes("menu"));

    const renamed = renameProjectFile(withFolder, added.createdFile.id, "UserProfileActivity.java");
    assert.ok(renamed.files.some((f) => f.name === "UserProfileActivity.java"));

    const changes = computeProjectGitStatus(renamed.files, proj.snapshotFiles);
    assert.ok(changes.some((c) => c.status === "added" && c.path.includes("UserProfileActivity.java")));
    assert.ok(changes.some((c) => c.status === "modified" && c.path.includes("AndroidManifest.xml")));

    const deleted = deleteProjectFile(renamed, added.createdFile.id);
    assert.ok(!deleted.files.some((f) => f.id === added.createdFile.id));
  });

  it("parses XML layouts, inserts widgets, updates attributes, and formats code cleanly", () => {
    const portal = STUDIO_PRESETS.find((p) => p.id === "student-portal-java")!;
    const xmlFile = portal.files.find((f) => f.name === "activity_main.xml")!;
    const parsed = parseAndroidLayoutXml(xmlFile.content);
    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.root?.shortTag, "LinearLayout");
    assert.ok((parsed.root?.children.length || 0) >= 5);

    const inserted = insertComponentIntoLayoutXml(xmlFile.content, "EditText", ["etName"]);
    assert.ok(inserted.xml.includes(`<EditText`));
    assert.ok(inserted.xml.includes(`@+id/${inserted.insertedId}`));

    const updated = updateElementAttributeInXml(inserted.xml, inserted.insertedId, "android:hint", "Roll Number");
    assert.ok(updated.includes('android:hint="Roll Number"'));

    const removed = removeComponentFromLayoutXml(updated, inserted.insertedId);
    assert.ok(!removed.includes(inserted.insertedId));

    const formattedXml = formatAndroidXml(xmlFile.content);
    assert.ok(formattedXml.includes("<LinearLayout"));

    const formattedJava = formatJavaOrKotlinCode("public class A{\nvoid x(){\nint y=1;\n}\n}");
    assert.ok(formattedJava.includes("    void x() {") || formattedJava.includes("    void x(){"));
  });

  it("executes real Activity handlers, Intent navigation with extras, Toasts, and calculator runtime errors", () => {
    const portal = STUDIO_PRESETS.find((p) => p.id === "student-portal-java")!;
    const launched = launchAndroidRuntimeSession(portal.files, portal.packageName);
    assert.equal(launched.error, null);
    assert.equal(launched.session.activityStack[0].activityName, "MainActivity");

    // Empty name triggers validation Toast + warning log
    const emptyClick = dispatchRuntimeWidgetClick(launched.session, portal.files, "btnGreet");
    assert.ok(emptyClick.session.toasts.some((t) => t.message.includes("Please enter your name")));
    assert.ok(emptyClick.logs.some((l) => l.level === "W" && l.message.includes("Empty name")));

    // Typing name + Greet updates TextView, clicking Open Details navigates via Intent to SecondActivity
    let cur = updateRuntimeInputValue(emptyClick.session, "etName", "Aarav");
    const greetRes = dispatchRuntimeWidgetClick(cur, portal.files, "btnGreet");
    const topFrame = greetRes.session.activityStack[greetRes.session.activityStack.length - 1];
    assert.equal(topFrame.widgetTextOverrides.tvStatus, "Hello, Aarav! (1)");

    const navRes = dispatchRuntimeWidgetClick(greetRes.session, portal.files, "btnOpenDetails");
    assert.equal(navRes.session.activityStack.length, 2);
    assert.equal(navRes.session.activityStack[1].activityName, "SecondActivity");
    assert.ok(navRes.session.activityStack[1].widgetTextOverrides.tvSummary.includes("Welcome to SecondActivity, Aarav!"));

    const backRes = navigateRuntimeBack(navRes.session);
    assert.equal(backRes.session.activityStack.length, 1);
    assert.equal(backRes.session.activityStack[0].activityName, "MainActivity");

    // Calculator divide by zero logs real E entry + error message
    const calc = STUDIO_PRESETS.find((p) => p.id === "calculator-java")!;
    let calcSession = launchAndroidRuntimeSession(calc.files, calc.packageName).session;
    calcSession = updateRuntimeInputValue(calcSession, "etFirstNumber", "12");
    calcSession = updateRuntimeInputValue(calcSession, "etSecondNumber", "0");
    const divZero = dispatchRuntimeWidgetClick(calcSession, calc.files, "btnDiv");
    assert.equal(divZero.session.activityStack[0].widgetTextOverrides.tvResult, "Error: / by 0");
    assert.ok(divZero.logs.some((l) => l.level === "E" && l.message.includes("Division by zero")));
  });
});
