import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function backendUrl() {
  let raw = process.env.BACKEND_URL;
  try {
    const envLocalPath = path.resolve(process.cwd(), ".env.local");
    if (process.env.NODE_ENV !== 'production' && fs.existsSync(envLocalPath)) {
      const content = fs.readFileSync(envLocalPath, "utf-8");
      const match = content.match(/^BACKEND_URL=(.*)$/m);
      if (match && match[1].trim()) {
        raw = match[1].trim();
      }
    }
  } catch {
    // fallback
  }
  if (!raw) {
    raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  }
  raw = raw.trim().replace(/\/+$/, "");
  const value = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid BACKEND_URL");
  return parsed.origin;
}

export async function proxyBackend(req: NextRequest) {
  const url = new URL(req.url);
  const headers = new Headers();
  for (const name of ["accept", "content-type", "authorization", "x-csrf-token", "x-beta-key", "cookie", "range", "if-none-match", "if-modified-since"]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("x-beta-key") && process.env.BETA_KEY) headers.set("x-beta-key", process.env.BETA_KEY);
  // Railway's edge sets X-Real-IP. Authenticate our relay so backend callers
  // cannot spoof it and every student does not share the proxy's rate bucket.
  if (process.env.TRUSTED_PROXY_KEY && process.env.RAILWAY_ENVIRONMENT_ID) {
    const clientIp = req.headers.get('x-real-ip');
    if (clientIp) {
      headers.set('x-labmate-client-ip', clientIp);
      headers.set('x-labmate-proxy-key', process.env.TRUSTED_PROXY_KEY);
    }
  }
  const init: RequestInit & { duplex?: "half" } = {
    method: req.method, headers, redirect: "manual", cache: "no-store", signal: req.signal,
  };
  if (!["GET", "HEAD"].includes(req.method) && req.body) {
    init.body = req.body;
    init.duplex = "half";
  }
  try {
    const upstream = await fetch(`${backendUrl()}${url.pathname}${url.search}`, init);
    const responseHeaders = new Headers();
    for (const name of ["content-type", "content-disposition", "cache-control", "etag", "last-modified", "content-range", "accept-ranges", "www-authenticate", "retry-after"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append("set-cookie", cookie);
    const location = upstream.headers.get("location");
    if (location) {
      const redirect = new URL(location, backendUrl());
      responseHeaders.set("location", redirect.origin === backendUrl() ? `${redirect.pathname}${redirect.search}${redirect.hash}` : redirect.href);
    }
    const body = req.method === "HEAD" || [204, 205, 304].includes(upstream.status) ? null : upstream.body;
    return new NextResponse(body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return NextResponse.json({ detail: "Backend service is unavailable." }, { status: 502 });
  }
}
