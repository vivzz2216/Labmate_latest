const fs = require("fs");
const path = require("path");
const { validateServerUrl } = require("./security");

const FALLBACK_DEFAULT_URL = process.env.LABMATE_DESKTOP_URL || "http://localhost:3000";

function createConfigStore(userDataDir, options = {}) {
  const configFile = path.join(userDataDir, "config.json");
  const candidateDefault = options.defaultServerUrl || FALLBACK_DEFAULT_URL;
  const checkedDefault = validateServerUrl(candidateDefault);
  const safeDefaultUrl = checkedDefault.valid ? checkedDefault.url : "http://localhost:3000";

  function readRaw() {
    try {
      if (!fs.existsSync(configFile)) return {};
      const parsed = JSON.parse(fs.readFileSync(configFile, "utf8"));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeRaw(data) {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(configFile, JSON.stringify(data, null, 2), "utf8");
  }

  function get() {
    const raw = readRaw();
    const check = validateServerUrl(raw.serverUrl);
    return {
      serverUrl: check.valid ? check.url : safeDefaultUrl,
      configuredByUser: Boolean(check.valid && raw.configuredByUser),
      windowBounds:
        raw.windowBounds &&
        typeof raw.windowBounds.width === "number" &&
        typeof raw.windowBounds.height === "number"
          ? raw.windowBounds
          : { width: 1360, height: 860 },
    };
  }

  function setServerUrl(nextUrl) {
    const check = validateServerUrl(nextUrl);
    if (!check.valid) {
      throw new Error(check.reason || "Invalid server URL.");
    }
    const current = get();
    const updated = {
      ...current,
      serverUrl: check.url,
      configuredByUser: true,
    };
    writeRaw(updated);
    return updated;
  }

  function setWindowBounds(bounds) {
    if (!bounds || typeof bounds.width !== "number" || typeof bounds.height !== "number") {
      return get();
    }
    const current = readRaw();
    const checked = validateServerUrl(current.serverUrl);
    const updated = {
      ...get(),
      ...(checked.valid ? { serverUrl: checked.url } : {}),
      windowBounds: {
        width: Math.max(900, Math.round(bounds.width)),
        height: Math.max(640, Math.round(bounds.height)),
      },
    };
    writeRaw(updated);
    return updated;
  }

  return {
    configFile,
    get,
    setServerUrl,
    setWindowBounds,
  };
}

module.exports = {
  createConfigStore,
};
