import { NextResponse, type NextRequest } from "next/server";

// Ubuntu stays off; Power BI Desktop, Android Studio, and Computer Networks studios are enabled.
const UNAVAILABLE_PREFIXES: string[] = [];

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
  matcher: [],
};
