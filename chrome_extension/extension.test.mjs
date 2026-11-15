import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const syncAuthSrc = fs.readFileSync(path.join(__dirname, "sync_auth.js"), "utf8");
const contentSrc = fs.readFileSync(path.join(__dirname, "content.js"), "utf8");
const popupSrc = fs.readFileSync(path.join(__dirname, "popup.js"), "utf8");
const basicAuthSrc = fs.readFileSync(
  path.resolve(__dirname, "..", "frontend", "contexts", "BasicAuthContext.tsx"),
  "utf8"
);

function createElementMock(tagName) {
  const el = {
    tagName: tagName.toUpperCase(),
    id: "",
    className: "",
    href: "",
    target: "",
    rel: "",
    disabled: false,
    title: "",
    children: [],
    parentElement: null,
    _textContent: "",
    _innerHTML: "",
    _innerHTMLWrites: [],
    _listeners: new Map(),
    set textContent(v) {
      this._textContent = String(v);
    },
    get textContent() {
      if (this._textContent) return this._textContent;
      return this.children.map((c) => c.textContent).join("");
    },
    set innerHTML(v) {
      this._innerHTML = String(v);
      this._innerHTMLWrites.push(String(v));
    },
    get innerHTML() {
      return this._innerHTML;
    },
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    },
    replaceChildren(...nodes) {
      this.children = [];
      for (const node of nodes) {
        this.appendChild(node);
      }
    },
    remove() {
      if (this.parentElement) {
        this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
        this.parentElement = null;
      }
    },
    addEventListener(type, fn) {
      if (!this._listeners.has(type)) this._listeners.set(type, []);
      this._listeners.get(type).push(fn);
    },
    async click() {
      for (const fn of this._listeners.get("click") || []) {
        await fn({ preventDefault() {}, stopPropagation() {} });
      }
    },
    querySelector(selector) {
      if (selector.startsWith(".")) {
        const cls = selector.slice(1);
        return this.children.find((c) => c.className.split(/\s+/).includes(cls)) || null;
      }
      if (selector.startsWith("#")) {
        const id = selector.slice(1);
        return this.children.find((c) => c.id === id) || null;
      }
      return null;
    },
  };
  return el;
}

function createDocumentMock(urlTitle = "manual<img src=x onerror=alert(1)>.docx") {
  const body = createElementMock("body");
  const allById = new Map();
  const doc = {
    title: `${urlTitle} - Google Drive`,
    body,
    createElement(tag) {
      return createElementMock(tag);
    },
    getElementById(id) {
      if (allById.has(id)) return allById.get(id);
      const visit = (node) => {
        if (node.id === id) return node;
        for (const ch of node.children || []) {
          const found = visit(ch);
          if (found) return found;
        }
        return null;
      };
      return visit(body);
    },
    querySelector(sel) {
      if (sel === '[role="toolbar"]') return body;
      if (sel.includes("role=\"heading\"")) return null;
      return null;
    },
    addEventListener() {},
  };
  const origAppend = body.appendChild.bind(body);
  body.appendChild = (ch) => {
    if (ch.id) allById.set(ch.id, ch);
    return origAppend(ch);
  };
  return doc;
}

test("sync_auth pushes csrf token and responds to same-tab labmate:auth-changed event", () => {
  const store = {};
  const listeners = new Map();
  const ls = new Map();

  const ctx = {
    console,
    Date,
    localStorage: {
      getItem: (k) => ls.get(k) ?? null,
    },
    window: {
      location: { origin: "https://app.labmate.ai" },
      addEventListener: (ev, fn) => {
        if (!listeners.has(ev)) listeners.set(ev, []);
        listeners.get(ev).push(fn);
      },
      dispatchEvent: (ev) => {
        for (const fn of listeners.get(ev.type) || []) fn(ev);
      },
    },
    document: { addEventListener: () => {} },
    chrome: {
      storage: {
        local: {
          set: (obj, cb) => {
            Object.assign(store, obj);
            cb?.();
          },
          remove: (keys, cb) => {
            for (const k of keys) delete store[k];
            cb?.();
          },
        },
      },
    },
  };

  vm.runInNewContext(syncAuthSrc, ctx);
  assert.ok(listeners.has("labmate:auth-changed"), "Expected labmate:auth-changed listener");
  assert.equal(store.labmate_server_url, "https://app.labmate.ai");
  assert.equal(store.labmate_web_url, "https://app.labmate.ai");

  ls.set("labmate_access_token", "jwt-abc");
  ls.set("labmate_csrf_token", "csrf-xyz");
  ls.set("labmate_user", JSON.stringify({ id: 7, email: "s@example.com" }));
  ctx.window.dispatchEvent({ type: "labmate:auth-changed" });

  assert.equal(store.labmate_token, "jwt-abc");
  assert.equal(store.labmate_csrf_token, "csrf-xyz");
});

test("content.js sends X-CSRF-Token on upload/extract and renders safe DOM text without XSS", async () => {
  const doc = createDocumentMock("evil<img src=x onerror=alert(1)>.docx");
  const fetchCalls = [];
  const storageData = {
    labmate_token: "jwt-abc",
    labmate_csrf_token: "csrf-xyz",
    labmate_server_url: "https://api.labmate.test",
    labmate_web_url: "https://app.labmate.test",
    labmate_user: { id: 1 },
  };

  class FakeFormData {
    append() {}
  }

  class FakeMutationObserver {
    observe() {}
  }

  const ctx = {
    console,
    URL,
    FormData: FakeFormData,
    MutationObserver: FakeMutationObserver,
    setTimeout,
    clearTimeout,
    document: doc,
    window: {
      location: { href: "https://drive.google.com/file/d/FILE1234567890/view" },
      addEventListener() {},
    },
    chrome: {
      storage: {
        local: {
          get: (keys, cb) => {
            const out = {};
            for (const k of keys) {
              if (k in storageData) out[k] = storageData[k];
            }
            cb(out);
          },
        },
      },
    },
    fetch: async (url, init = {}) => {
      fetchCalls.push({ url, init });
      if (String(url).startsWith("https://drive.google.com/")) {
        return { ok: true, status: 200, blob: async () => new Blob(["pdf"]) };
      }
      if (String(url).endsWith("/api/upload")) {
        return { ok: true, status: 200, json: async () => ({ id: 99 }) };
      }
      return { ok: true, status: 200, json: async () => ({ status: "ok" }) };
    },
  };

  vm.runInNewContext(contentSrc, ctx);
  // Wait briefly for initial toolbar injection timeout? Or invoke injected button once MutationObserver/timer runs
  await new Promise((r) => setTimeout(r, 1600));
  const btn = doc.getElementById("labmate-drive-btn");
  assert.ok(btn, "Toolbar button should be injected");

  await btn.click();
  await new Promise((r) => setTimeout(r, 50));

  const uploadCall = fetchCalls.find((c) => c.url.endsWith("/api/upload"));
  const extractCall = fetchCalls.find((c) => c.url.endsWith("/api/workflows/99/extract"));
  assert.ok(uploadCall, "Expected POST /api/upload");
  assert.ok(extractCall, "Expected POST /api/workflows/99/extract");
  assert.equal(uploadCall.init.headers["X-CSRF-Token"], "csrf-xyz");
  assert.equal(extractCall.init.headers["X-CSRF-Token"], "csrf-xyz");

  const toast = doc.getElementById("labmate-toast");
  assert.ok(toast, "Expected completion toast");
  assert.deepEqual(toast._innerHTMLWrites, [], "showToast must never write toast.innerHTML");
  const msgNode = toast.querySelector(".labmate-toast-msg");
  assert.ok(msgNode.textContent.includes("evil<img src=x onerror=alert(1)>.docx"));
});

test("BasicAuthContext dispatches labmate:auth-changed and popup clears csrf token on logout", () => {
  assert.match(basicAuthSrc, /labmate:auth-changed/);
  assert.match(popupSrc, /labmate_csrf_token/);
});
