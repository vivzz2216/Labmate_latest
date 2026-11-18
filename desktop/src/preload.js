const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("labmateDesktop", {
  getConfig: () => ipcRenderer.invoke("labmate:get-config"),
  connectToServer: (serverUrl) => ipcRenderer.invoke("labmate:connect-server", serverUrl),
  getAppVersion: () => ipcRenderer.invoke("labmate:get-version"),
});
