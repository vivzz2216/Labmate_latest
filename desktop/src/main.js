const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  dialog,
  ipcMain,
  session,
  shell,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { createConfigStore } = require("./config");
const { classifyNavigation, validateServerUrl } = require("./security");

const CONNECT_PAGE_PATH = path.join(__dirname, "connect.html");
const CONNECT_PAGE_URL = pathToFileURL(CONNECT_PAGE_PATH).href;
const ICON_PATH = path.join(__dirname, "..", "assets", "icon.png");

let mainWindow = null;
let configStore = null;
let lastLoadError = "";
let activeAppOrigin = null;

function isLocalConnectSender(event) {
  try {
    const senderUrl = event?.senderFrame?.url || "";
    return senderUrl === CONNECT_PAGE_URL || senderUrl.startsWith(`${CONNECT_PAGE_URL}?`);
  } catch {
    return false;
  }
}

function buildAppMenu() {
  const navigatePath = (subpath) => {
    if (!mainWindow || !activeAppOrigin) return;
    mainWindow.loadURL(`${activeAppOrigin}${subpath}`);
  };

  const template = [
    {
      label: "LabMate",
      submenu: [
        { label: "Dashboard", accelerator: "CmdOrCtrl+D", click: () => navigatePath("/dashboard") },
        { label: "Code Studio", accelerator: "CmdOrCtrl+N", click: () => navigatePath("/code-execution") },
        { label: "Sample Reports", click: () => navigatePath("/samples") },
        { type: "separator" },
        {
          label: "Server Settings...",
          click: () => {
            lastLoadError = "";
            if (mainWindow) mainWindow.loadFile(CONNECT_PAGE_PATH);
          },
        },
        { type: "separator" },
        { role: "quit", label: "Exit LabMate" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About LabMate Desktop",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About LabMate Desktop",
              message: `LabMate Desktop v${app.getVersion()}`,
              detail: `Connected Server: ${activeAppOrigin || "Not connected"}`,
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function configureSessionSecurity() {
  const sess = session.defaultSession;

  sess.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  sess.on("will-download", (_event, item) => {
    const filename = item.getFilename();
    const downloadsDir = app.getPath("downloads");
    const targetPath = path.join(downloadsDir, filename);
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
    item.setSavePath(targetPath);

    item.once("done", (_doneEvent, state) => {
      if (state === "completed") {
        const note = new Notification({
          title: "LabMate Report Saved",
          body: `${filename} saved to Downloads. Click to open.`,
        });
        note.on("click", () => {
          shell.openPath(targetPath);
        });
        note.show();
      }
    });
  });
}

function attachWindowGuards(win) {
  const { webContents } = win;

  webContents.on("will-navigate", (event, targetUrl) => {
    if (targetUrl.startsWith(CONNECT_PAGE_URL)) return;
    const verdict = classifyNavigation(targetUrl, activeAppOrigin);
    if (verdict === "allow-internal") return;

    event.preventDefault();
    if (verdict === "open-external") {
      shell.openExternal(targetUrl);
    }
  });

  webContents.setWindowOpenHandler(({ url }) => {
    const verdict = classifyNavigation(url, activeAppOrigin);
    if (verdict === "allow-payment-popup") {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 520,
          height: 700,
          parent: win,
          modal: false,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
          },
        },
      };
    }

    if (verdict === "allow-internal") {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 1180,
          height: 780,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
          },
        },
      };
    }

    if (verdict === "open-external") {
      shell.openExternal(url);
    }

    return { action: "deny" };
  });

  webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3 || validatedURL.startsWith("file://")) return;
    lastLoadError = `Could not connect to ${validatedURL}: ${errorDescription} (${errorCode})`;
    win.loadFile(CONNECT_PAGE_PATH);
  });
}

async function loadLabMateServer(serverUrl) {
  const checked = validateServerUrl(serverUrl);
  if (!checked.valid) {
    lastLoadError = checked.reason;
    return mainWindow.loadFile(CONNECT_PAGE_PATH);
  }
  activeAppOrigin = checked.origin;
  lastLoadError = "";
  return mainWindow.loadURL(checked.url);
}

function createMainWindow() {
  const current = configStore.get();

  mainWindow = new BrowserWindow({
    width: current.windowBounds.width,
    height: current.windowBounds.height,
    minWidth: 900,
    minHeight: 640,
    title: "LabMate",
    backgroundColor: "#090d16",
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("resize", () => {
    if (!mainWindow || mainWindow.isMaximized()) return;
    const [width, height] = mainWindow.getSize();
    configStore.setWindowBounds({ width, height });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  attachWindowGuards(mainWindow);

  if (process.env.LABMATE_DESKTOP_URL || current.configuredByUser) {
    loadLabMateServer(current.serverUrl);
  } else {
    // Attempt default server cleanly; did-fail-load drops gracefully to connect.html if unreachable.
    loadLabMateServer(current.serverUrl);
  }
}

function registerIpc() {
  ipcMain.handle("labmate:get-version", (event) => {
    if (!isLocalConnectSender(event)) return null;
    return app.getVersion();
  });

  ipcMain.handle("labmate:get-config", (event) => {
    if (!isLocalConnectSender(event)) return null;
    const cfg = configStore.get();
    return {
      serverUrl: cfg.serverUrl,
      lastError: lastLoadError,
    };
  });

  ipcMain.handle("labmate:connect-server", async (event, rawUrl) => {
    if (!isLocalConnectSender(event)) {
      return { ok: false, error: "Unauthorized caller." };
    }
    const checked = validateServerUrl(rawUrl);
    if (!checked.valid) {
      return { ok: false, error: checked.reason };
    }
    try {
      const updated = configStore.setServerUrl(checked.url);
      await loadLabMateServer(updated.serverUrl);
      return { ok: true, serverUrl: updated.serverUrl };
    } catch (err) {
      return { ok: false, error: err?.message || "Connection failed." };
    }
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.setAppUserModelId("com.labmate.desktop");

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    configStore = createConfigStore(app.getPath("userData"));
    configureSessionSecurity();
    buildAppMenu();
    registerIpc();
    createMainWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
