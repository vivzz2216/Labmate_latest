import { NextResponse, type NextRequest } from "next/server";

// Lab workspaces switched off on the live site (2026-11-20). Their pages stay in the codebase; remove a path here and the
// matching track from the backend's UNAVAILABLE_LAB_TRACKS to turn a lab back on.
// LABMATE_ENABLED_LAB_PATHS ("/networks,/power-bi") turns paths back on for one deployment or a local dev server.
const ENABLED = (process.env.LABMATE_ENABLED_LAB_PATHS || "").split(",").map((item) => item.trim()).filter(Boolean);
const UNAVAILABLE_PREFIXES = ["/android-studio", "/power-bi", "/networks"].filter((prefix) => !ENABLED.includes(prefix));

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (UNAVAILABLE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/labs";
    url.search = "";
    return NextResponse.redirect(url, 307);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/android-studio/:path*", "/power-bi/:path*", "/networks/:path*"],
};
