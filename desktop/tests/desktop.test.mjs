import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");

test("validateServerUrl enforces HTTPS for remote Railway URLs and permits loopback for local dev", () => {
  const { validateServerUrl } = require(path.join(desktopRoot, "src/security.js"));

  assert.deepEqual(validateServerUrl("https://labmate-prod.up.railway.app/"), {
    valid: true,
    url: "https://labmate-prod.up.railway.app",
    origin: "https://labmate-prod.up.railway.app",
    isLocal: false,
  });

  assert.deepEqual(validateServerUrl("http://localhost:3000/dashboard"), {
    valid: true,
    url: "http://localhost:3000",
    origin: "http://localhost:3000",
    isLocal: true,
  });

  assert.equal(validateServerUrl("http://127.0.0.1:3000").valid, true);
  assert.equal(validateServerUrl("http://insecure-remote.example.com").valid, false);
  assert.equal(validateServerUrl("file:///C:/Windows/System32/cmd.exe").valid, false);
  assert.equal(validateServerUrl("javascript:alert(1)").valid, false);
  assert.equal(validateServerUrl("not-a-url").valid, false);
});

test("classifyNavigation isolates internal origin, allows Razorpay checkout popups, opens safe external HTTPS, and blocks dangerous schemes", () => {
  const { classifyNavigation } = require(path.join(desktopRoot, "src/security.js"));
  const appOrigin = "https://labmate.up.railway.app";

  assert.equal(classifyNavigation("https://labmate.up.railway.app/dashboard", appOrigin), "allow-internal");
  assert.equal(classifyNavigation("https://api.razorpay.com/v1/checkout/embedded", appOrigin), "allow-payment-popup");
  assert.equal(classifyNavigation("https://checkout.razorpay.com/v1/checkout.js", appOrigin), "allow-payment-popup");
  assert.equal(classifyNavigation("https://github.com/docs", appOrigin), "open-external");

  assert.equal(classifyNavigation("http://evil.example.com/phish", appOrigin), "deny");
  assert.equal(classifyNavigation("file:///C:/secret.txt", appOrigin), "deny");
  assert.equal(classifyNavigation("javascript:alert(1)", appOrigin), "deny");
  assert.equal(classifyNavigation("vbscript:msgbox(1)", appOrigin), "deny");
});

test("config store persists validated server URL and rejects unsafe URLs", () => {
  const { createConfigStore } = require(path.join(desktopRoot, "src/config.js"));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "labmate-desktop-cfg-"));
  try {
    const store = createConfigStore(tmpDir, { defaultServerUrl: "https://app.labmate.ai" });
    assert.equal(store.get().serverUrl, "https://app.labmate.ai");

    const updated = store.setServerUrl("http://localhost:3000");
    assert.equal(updated.serverUrl, "http://localhost:3000");
    assert.equal(store.get().serverUrl, "http://localhost:3000");

    assert.throws(() => store.setServerUrl("http://untrusted-http.example.com"), /HTTPS/i);

    // Tampered config file on disk must fall back safely
    fs.writeFileSync(path.join(tmpDir, "config.json"), JSON.stringify({ serverUrl: "file:///C:/bad" }));
    assert.equal(store.get().serverUrl, "https://app.labmate.ai");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("build-checksums computes accurate SHA256SUMS.txt for installer artifacts", () => {
  const { writeChecksumsFile } = require(path.join(desktopRoot, "scripts/build-checksums.mjs"));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "labmate-sha-"));
  try {
    const exePath = path.join(tmpDir, "LabMate-Setup-1.0.0.exe");
    const msiPath = path.join(tmpDir, "LabMate-1.0.0.msi");
    fs.writeFileSync(exePath, "dummy-exe-bytes");
    fs.writeFileSync(msiPath, "dummy-msi-bytes");

    const outPath = writeChecksumsFile(tmpDir);
    const content = fs.readFileSync(outPath, "utf8");
    const expectedExeHash = crypto.createHash("sha256").update("dummy-exe-bytes").digest("hex");
    assert.ok(content.includes(`${expectedExeHash}  LabMate-Setup-1.0.0.exe`));
    assert.ok(content.includes("LabMate-1.0.0.msi"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("main.js and electron-builder.yml enforce Electron security hardening and code-signing config", () => {
  const mainSrc = fs.readFileSync(path.join(desktopRoot, "src/main.js"), "utf8");
  const preloadSrc = fs.readFileSync(path.join(desktopRoot, "src/preload.js"), "utf8");
  const builderCfg = fs.readFileSync(path.join(desktopRoot, "electron-builder.yml"), "utf8");

  assert.match(mainSrc, /nodeIntegration:\s*false/);
  assert.match(mainSrc, /contextIsolation:\s*true/);
  assert.match(mainSrc, /sandbox:\s*true/);
  assert.match(mainSrc, /webSecurity:\s*true/);
  assert.match(mainSrc, /allowRunningInsecureContent:\s*false/);
  assert.match(mainSrc, /setPermissionRequestHandler/);
  assert.match(mainSrc, /setWindowOpenHandler/);
  assert.match(mainSrc, /requestSingleInstanceLock/);

  assert.match(preloadSrc, /contextBridge\.exposeInMainWorld/);
  assert.doesNotMatch(preloadSrc, /fs\.readFile|child_process/);

  assert.match(builderCfg, /appId:\s*com\.labmate\.desktop/);
  assert.match(builderCfg, /asar:\s*true/);
  assert.match(builderCfg, /sign:|signtool|azureSignOptions|signAndEditExecutable/);
});
