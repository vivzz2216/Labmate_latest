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
    btn.innerHTML = `
      <span class="labmate-btn-icon">⚡</span>
      <span class="labmate-btn-text">Send to LabMate</span>
    `;

    btn.addEventListener("click", handleSendToLabMate);
    toolbar.appendChild(btn);
  }

  // Main Action: Send to LabMate
  async function handleSendToLabMate(e) {
    e.preventDefault();
    e.stopPropagation();

    const btn = document.getElementById("labmate-drive-btn");
    const originalText = btn ? btn.innerHTML : "";

    chrome.storage.local.get(
      ["labmate_token", "labmate_server_url", "labmate_web_url", "labmate_user"],
      async (stored) => {
        const token = stored.labmate_token;
        const serverUrl = stored.labmate_server_url || DEFAULT_SERVER;
        const webUrl = stored.labmate_web_url || DEFAULT_WEB_URL;

        // Step 1: Check Authentication
        if (!token) {
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
            btn.innerHTML = `<span class="labmate-btn-spinner"></span> <span>Fetching from Drive...</span>`;
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
            btn.innerHTML = `<span class="labmate-btn-spinner"></span> <span>Sending to LabMate...</span>`;
          }

          // Step 3: Upload to LabMate backend
          const formData = new FormData();
          formData.append("file", fileBlob, filename);

          const uploadResp = await fetch(`${serverUrl}/api/upload`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
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
              headers: {
                Authorization: `Bearer ${token}`,
              },
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
            btn.innerHTML = originalText;
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
    modal.innerHTML = `
      <div class="labmate-modal-card">
        <div class="labmate-modal-icon">🔒</div>
        <h3>Login to LabMate</h3>
        <p>You need to be logged into your LabMate account to automatically send lab manuals to your workspace.</p>
        <div class="labmate-modal-actions">
          <a href="${webUrl}" target="_blank" id="labmate-open-login-btn" class="labmate-primary-btn">
            Open LabMate Login
          </a>
          <button id="labmate-close-modal-btn" class="labmate-secondary-btn">
            Cancel
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("labmate-close-modal-btn").addEventListener("click", () => {
      modal.remove();
    });

    document.getElementById("labmate-open-login-btn").addEventListener("click", () => {
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

    let html = `<div class="labmate-toast-msg">${message}</div>`;
    if (actionUrl) {
      html += `<a href="${actionUrl}" target="_blank" class="labmate-toast-action">Open Workspace →</a>`;
    }
    html += `<button class="labmate-toast-close">&times;</button>`;

    toast.innerHTML = html;
    document.body.appendChild(toast);

    toast.querySelector(".labmate-toast-close").addEventListener("click", () => {
      toast.remove();
    });

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
