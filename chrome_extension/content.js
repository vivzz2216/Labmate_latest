// LabMate Chrome Extension - Google Drive & Docs Content Script

(() => {
  const DEFAULT_SERVER = "http://localhost:8000";
  const DEFAULT_WEB_URL = "http://localhost:3000";

  let lastCheckedUrl = "";

  // Helper to extract file ID from Google Drive URL
  function getGoogleDriveFileId() {
    const match = window.location.href.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return match[1];

    const previewMatch = window.location.href.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (previewMatch && previewMatch[1]) return previewMatch[1];

    // Try finding open preview dialog in DOM
    const previewDialog = document.querySelector('[role="dialog"]');
    if (previewDialog) {
      const link = previewDialog.querySelector('a[href*="/file/d/"]');
      if (link) {
        const linkMatch = link.href.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (linkMatch) return linkMatch[1];
      }
    }

    return null;
  }

  // Get current document name from Google Drive preview header
  function getDocumentTitle() {
    // Check Drive preview title element
    const titleEl =
      document.querySelector('[role="dialog"] [aria-label*="."]') ||
      document.querySelector('meta[property="og:title"]') ||
      document.querySelector('div[data-tooltip*=".pdf"]') ||
      document.querySelector('div[data-tooltip*=".docx"]');

    if (titleEl) {
      const title =
        titleEl.getAttribute("data-tooltip") ||
        titleEl.getAttribute("aria-label") ||
        titleEl.getAttribute("content") ||
        titleEl.innerText;
      if (title && (title.endsWith(".pdf") || title.endsWith(".docx") || title.endsWith(".doc"))) {
        return title.trim();
      }
    }

    const docTitle = document.title.replace(/ - Google Drive.*$/, "").trim();
    if (docTitle.endsWith(".pdf") || docTitle.endsWith(".docx")) {
      return docTitle;
    }

    return "lab_manual.pdf";
  }

  function sanitizeHttpUrl(rawUrl, fallback = null) {
    if (!rawUrl || typeof rawUrl !== "string") return fallback;
    try {
      const parsed = new URL(rawUrl, DEFAULT_WEB_URL);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : fallback;
    } catch {
      return fallback;
    }
  }

  function setButtonContent(btn, iconClass, iconText, labelText) {
    if (!btn) return;
    const iconSpan = document.createElement("span");
    iconSpan.className = iconClass;
    if (iconText) iconSpan.textContent = iconText;
    const textSpan = document.createElement("span");
    if (iconClass === "labmate-btn-icon") textSpan.className = "labmate-btn-text";
    textSpan.textContent = labelText;
    btn.replaceChildren(iconSpan, textSpan);
  }

  // Inject LabMate button into Drive preview toolbar
  function injectToolbarButton() {
    if (document.getElementById("labmate-drive-btn")) return;

    // Look for Google Drive preview top action bar (near print/download buttons)
    const toolbar =
      document.querySelector('[role="toolbar"]') ||
      document.querySelector('[aria-label="Download"]')?.parentElement?.parentElement ||
      document.querySelector('[data-tooltip="Download"]')?.parentElement ||
      document.querySelector('header');

    if (!toolbar) return;

    const btn = document.createElement("button");
    btn.id = "labmate-drive-btn";
    btn.className = "labmate-injected-btn";
    setButtonContent(btn, "labmate-btn-icon", "⚡", "Send to LabMate");

    btn.addEventListener("click", handleSendToLabMate);
    toolbar.appendChild(btn);
  }

  // Main Action: Send to LabMate
  async function handleSendToLabMate(e) {
    e.preventDefault();
    e.stopPropagation();

    const btn = document.getElementById("labmate-drive-btn");

    chrome.storage.local.get(
      ["labmate_token", "labmate_csrf_token", "labmate_server_url", "labmate_web_url", "labmate_user"],
      async (stored) => {
        const token = stored.labmate_token;
        const csrfToken = stored.labmate_csrf_token;
        const serverUrl = sanitizeHttpUrl(stored.labmate_server_url, DEFAULT_SERVER).replace(/\/+$/, "");
        const webUrl = sanitizeHttpUrl(stored.labmate_web_url, DEFAULT_WEB_URL).replace(/\/+$/, "");

        // Step 1: Check Authentication + CSRF token required by /api/upload
        if (!token || !csrfToken) {
          showLoginModal(webUrl);
          return;
        }

        const fileId = getGoogleDriveFileId();
        if (!fileId) {
          showToast("⚠️ Could not detect file ID. Please open the file preview first.", "warning");
          return;
        }

        const filename = getDocumentTitle();

        try {
          if (btn) {
            setButtonContent(btn, "labmate-btn-spinner", "", "Fetching from Drive...");
            btn.disabled = true;
          }

          // Step 2: Download file bytes from Google Drive
          const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
          const fileResp = await fetch(downloadUrl, { credentials: "include" });

          if (!fileResp.ok) {
            throw new Error(`Google Drive returned status ${fileResp.status}`);
          }

          const fileBlob = await fileResp.blob();

          if (btn) {
            setButtonContent(btn, "labmate-btn-spinner", "", "Sending to LabMate...");
          }

          // Step 3: Upload to LabMate backend
          const formData = new FormData();
          formData.append("file", fileBlob, filename);

          const authHeaders = {
            Authorization: `Bearer ${token}`,
            "X-CSRF-Token": csrfToken,
          };

          const uploadResp = await fetch(`${serverUrl}/api/upload`, {
            method: "POST",
            headers: authHeaders,
            body: formData,
          });

          if (!uploadResp.ok) {
            const errData = await uploadResp.json().catch(() => ({}));
            throw new Error(errData.detail || "Upload to LabMate failed");
          }

          const uploadData = await uploadResp.json();

          // Step 4: Automatically trigger extraction workflow
          try {
            await fetch(`${serverUrl}/api/workflows/${uploadData.id}/extract`, {
              method: "POST",
              headers: authHeaders,
            });
          } catch (wfErr) {
            console.warn("Auto-extract trigger note:", wfErr);
          }

          // Step 5: Show Success Toast with link to Workspace
          showToast(
            `✅ "${filename}" sent to LabMate! Your report and execution screenshots are compiling.`,
            "success",
            `${webUrl}/workspace`
          );
        } catch (err) {
          console.error("[LabMate Extension Error]", err);
          showToast(`❌ Failed to send: ${err.message}`, "error");
        } finally {
          if (btn) {
            setButtonContent(btn, "labmate-btn-icon", "⚡", "Send to LabMate");
            btn.disabled = false;
          }
        }
      }
    );
  }

  // In-page Login Modal
  function showLoginModal(webUrl) {
    if (document.getElementById("labmate-login-modal")) return;

    const modal = document.createElement("div");
    modal.id = "labmate-login-modal";
    modal.className = "labmate-modal-backdrop";

    const card = document.createElement("div");
    card.className = "labmate-modal-card";

    const icon = document.createElement("div");
    icon.className = "labmate-modal-icon";
    icon.textContent = "🔒";

    const heading = document.createElement("h3");
    heading.textContent = "Login to LabMate";

    const desc = document.createElement("p");
    desc.textContent =
      "You need to be logged into your LabMate account to automatically send lab manuals to your workspace.";

    const actions = document.createElement("div");
    actions.className = "labmate-modal-actions";

    const loginLink = document.createElement("a");
    loginLink.href = sanitizeHttpUrl(webUrl, DEFAULT_WEB_URL);
    loginLink.target = "_blank";
    loginLink.rel = "noopener noreferrer";
    loginLink.id = "labmate-open-login-btn";
    loginLink.className = "labmate-primary-btn";
    loginLink.textContent = "Open LabMate Login";

    const cancelBtn = document.createElement("button");
    cancelBtn.id = "labmate-close-modal-btn";
    cancelBtn.className = "labmate-secondary-btn";
    cancelBtn.textContent = "Cancel";

    actions.appendChild(loginLink);
    actions.appendChild(cancelBtn);
    card.appendChild(icon);
    card.appendChild(heading);
    card.appendChild(desc);
    card.appendChild(actions);
    modal.appendChild(card);

    document.body.appendChild(modal);

    cancelBtn.addEventListener("click", () => {
      modal.remove();
    });

    loginLink.addEventListener("click", () => {
      modal.remove();
    });
  }

  // Interactive Toast Notification
  function showToast(message, type = "info", actionUrl = null) {
    const existing = document.getElementById("labmate-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "labmate-toast";
    toast.className = `labmate-toast labmate-toast-${type}`;

    // Build the toast from DOM nodes: the message can contain a Drive filename or a server
    // error, so it must never be parsed as HTML on drive.google.com.
    const msg = document.createElement("div");
    msg.className = "labmate-toast-msg";
    msg.textContent = String(message);
    toast.appendChild(msg);

    if (actionUrl) {
      const link = document.createElement("a");
      link.className = "labmate-toast-action";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      // Only http(s) links are allowed; anything else (javascript:, data:) is dropped.
      try {
        const parsed = new URL(actionUrl, window.location.href);
        if (parsed.protocol === "https:" || parsed.protocol === "http:") link.href = parsed.href;
      } catch (_) { /* leave href unset */ }
      link.textContent = "Open Workspace →";
      toast.appendChild(link);
    }

    const closeBtn = document.createElement("button");
    closeBtn.className = "labmate-toast-close";
    closeBtn.textContent = "×";
    toast.appendChild(closeBtn);
    document.body.appendChild(toast);

    toast.querySelector(".labmate-toast-close").addEventListener("click", () => {
      toast.remove();
    });
    toast.appendChild(closeBtn);

    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 7000);
  }

  // MutationObserver to watch Google Drive SPA page changes
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastCheckedUrl) {
      lastCheckedUrl = window.location.href;
    }
    injectToolbarButton();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(injectToolbarButton, 1500);
})();
