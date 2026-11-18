const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const PAYMENT_ORIGINS = new Set([
  "https://api.razorpay.com",
  "https://checkout.razorpay.com",
]);

/**
 * Validates and normalizes a LabMate server URL.
 * Remote URLs must use HTTPS; HTTP is restricted strictly to loopback addresses.
 */
function validateServerUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, reason: "Server URL is required." };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, reason: "Invalid URL format." };
  }

  const isLocal = LOCAL_HOSTS.has(parsed.hostname);
  if (parsed.protocol === "https:") {
    return {
      valid: true,
      url: parsed.origin,
      origin: parsed.origin,
      isLocal,
    };
  }

  if (parsed.protocol === "http:" && isLocal) {
    return {
      valid: true,
      url: parsed.origin,
      origin: parsed.origin,
      isLocal: true,
    };
  }

  return {
    valid: false,
    reason: "Remote servers must use HTTPS (HTTP is only allowed for localhost).",
  };
}

/**
 * Classifies an attempted navigation or window-open request to enforce strict origin isolation.
 */
function classifyNavigation(targetUrl, appOrigin) {
  if (!targetUrl || typeof targetUrl !== "string") return "deny";

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return "deny";
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "deny";
  }

  if (appOrigin && parsed.origin === appOrigin) {
    return "allow-internal";
  }

  if (PAYMENT_ORIGINS.has(parsed.origin)) {
    return "allow-payment-popup";
  }

  if (parsed.protocol === "https:") {
    return "open-external";
  }

  return "deny";
}

module.exports = {
  LOCAL_HOSTS,
  PAYMENT_ORIGINS,
  validateServerUrl,
  classifyNavigation,
};
