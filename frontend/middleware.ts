import { NextResponse, type NextRequest } from "next/server";

// Lab workspaces switched off on the live site (2026-11-20). Their pages stay in the codebase; remove a path here and the
// matching track from the backend's UNAVAILABLE_LAB_TRACKS to turn a lab back on.
const UNAVAILABLE_PREFIXES = ["/android-studio", "/power-bi", "/networks"];

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
