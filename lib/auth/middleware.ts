import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/session";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/auth");
  const isPublicRoute =
    pathname === "/request" ||
    pathname.startsWith("/request/") ||
    pathname.startsWith("/track");
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

  return NextResponse.next({ request });
}
