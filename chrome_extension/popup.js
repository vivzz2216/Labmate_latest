// LabMate Chrome Extension - Popup Controller

document.addEventListener("DOMContentLoaded", () => {
  const DEFAULT_SERVER = "http://localhost:8000";
  const DEFAULT_WEB = "http://localhost:3000";

  // Elements
  const statusBadge = document.getElementById("status-badge");
  const statusText = document.getElementById("status-text");
  const userNameEl = document.getElementById("user-name");
  const userEmailEl = document.getElementById("user-email");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const openWorkspaceBtn = document.getElementById("open-workspace-btn");
  const openDashboardBtn = document.getElementById("open-dashboard-btn");
  const serverUrlInput = document.getElementById("server-url");
  const webUrlInput = document.getElementById("web-url");
  const testConnBtn = document.getElementById("test-conn-btn");
  const saveSettingsBtn = document.getElementById("save-settings-btn");
  const connResultEl = document.getElementById("conn-result");

  let currentServerUrl = DEFAULT_SERVER;
  let currentWebUrl = DEFAULT_WEB;
  let currentToken = null;

  // Load stored state
  chrome.storage.local.get(
    ["labmate_token", "labmate_server_url", "labmate_web_url", "labmate_user"],
    (result) => {
      currentServerUrl = result.labmate_server_url || DEFAULT_SERVER;
      currentWebUrl = result.labmate_web_url || DEFAULT_WEB;
      currentToken = result.labmate_token || null;

      serverUrlInput.value = currentServerUrl;
      webUrlInput.value = currentWebUrl;

      updateAuthState(currentToken, result.labmate_user);
    }
  );

  function updateAuthState(token, user) {
    if (token) {
      statusBadge.className = "status-badge status-online";
      statusText.textContent = "Connected";

      if (user && user.email) {
        userNameEl.textContent = user.name || user.email.split("@")[0];
        userEmailEl.textContent = user.email;
      } else {
        userNameEl.textContent = "Logged-In Student";
        userEmailEl.textContent = "Token Active";
      }

      loginBtn.style.display = "none";
      logoutBtn.style.display = "inline-flex";
    } else {
      statusBadge.className = "status-badge status-warn";
      statusText.textContent = "Needs Login";

      userNameEl.textContent = "Guest Student";
      userEmailEl.textContent = "Sign in to send lab manuals";

      loginBtn.style.display = "inline-flex";
      logoutBtn.style.display = "none";
    }
  }

  // Open Workspace
  openWorkspaceBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: `${currentWebUrl}/workspace` });
  });

  // Open Dashboard
  openDashboardBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: `${currentWebUrl}/dashboard` });
  });

  // Login
  loginBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: `${currentWebUrl}/login` });
  });

  // Logout
  logoutBtn.addEventListener("click", () => {
    chrome.storage.local.remove(["labmate_token", "labmate_user"], () => {
      currentToken = null;
      updateAuthState(null, null);
    });
  });

  // Save Settings
  saveSettingsBtn.addEventListener("click", () => {
    const sUrl = serverUrlInput.value.trim().replace(/\/+$/, "") || DEFAULT_SERVER;
    const wUrl = webUrlInput.value.trim().replace(/\/+$/, "") || DEFAULT_WEB;

    chrome.storage.local.set(
      {
        labmate_server_url: sUrl,
        labmate_web_url: wUrl,
      },
      () => {
        currentServerUrl = sUrl;
        currentWebUrl = wUrl;
        showConnResult("✅ Settings saved successfully!", "success");
      }
    );
  });

  // Test Connection
  testConnBtn.addEventListener("click", async () => {
    const sUrl = serverUrlInput.value.trim().replace(/\/+$/, "") || DEFAULT_SERVER;
    showConnResult("Testing backend...", "");

    try {
      const resp = await fetch(`${sUrl}/docs`, { method: "HEAD", mode: "no-cors" });
      showConnResult(`✅ Backend reachable at ${sUrl}`, "success");
    } catch (e) {
      showConnResult(`❌ Backend unreachable: ${e.message}`, "error");
    }
  });

  function showConnResult(msg, type) {
    connResultEl.textContent = msg;
    connResultEl.className = `conn-result ${type}`;
    connResultEl.style.display = "block";
    setTimeout(() => {
      if (type === "success") connResultEl.style.display = "none";
    }, 4000);
  }
});
