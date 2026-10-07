// LabMate Chrome Extension - Background Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener((details) => {
  console.log("[LabMate Extension] Installed / Updated:", details.reason);

  chrome.storage.local.get(["labmate_server_url", "labmate_web_url"], (result) => {
    const updates = {};
    if (!result.labmate_server_url) {
      updates.labmate_server_url = "http://localhost:8000";
    }
    if (!result.labmate_web_url) {
      updates.labmate_web_url = "http://localhost:3000";
    }
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }
  });
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "open_tab") {
    chrome.tabs.create({ url: request.url });
    sendResponse({ status: "opened" });
  } else if (request.action === "show_notification") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: request.title || "LabMate Assistant",
      message: request.message || "",
      priority: 2,
    });
    sendResponse({ status: "notified" });
  }
  return true;
});
