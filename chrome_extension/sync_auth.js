// Auto-sync authentication state from LabMate Web App to the Chrome Extension
(() => {
  const syncToken = () => {
    try {
      const token = localStorage.getItem("labmate_access_token");
      const user = localStorage.getItem("labmate_user");
      const apiUrl = window.location.origin.includes("localhost")
        ? "http://localhost:8000"
        : window.location.origin;

      if (token) {
        chrome.storage.local.set(
          {
            labmate_token: token,
            labmate_user: user ? JSON.parse(user) : null,
            labmate_server_url: apiUrl,
            labmate_web_url: window.location.origin,
            last_synced: Date.now(),
          },
          () => {
            console.log("[LabMate Extension] Auth session synced successfully.");
          }
        );
      } else {
        chrome.storage.local.remove(["labmate_token", "labmate_user"]);
      }
    } catch (e) {
      console.warn("[LabMate Extension] Could not sync auth state", e);
    }
  };

  syncToken();
  window.addEventListener("storage", syncToken);
})();
