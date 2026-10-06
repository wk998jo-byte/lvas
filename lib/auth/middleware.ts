import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/session";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth");
  const isPublicRoute =
    pathname === "/request" ||
    pathname.startsWith("/request/") ||
    pathname.startsWith("/track") ||
    pathname.startsWith("/verify/") ||
    pathname === "/status" ||
    pathname.startsWith("/status/");
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".");
  const isCron = pathname.startsWith("/api/cron");

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession && !isAuthRoute && !isPublicAsset && !isPublicRoute && !isCron) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? "/request" : "/login";
    url.search = "";
    if (url.pathname === "/login") {
      url.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next({ request });
  if (pathname.startsWith("/verify/")) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return response;
}
