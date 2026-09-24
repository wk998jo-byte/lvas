import { NextResponse } from "next/server";

import { runExpiryAlarms } from "@/lib/expiry-alarms";

/**
 * Persists approved → expired after end_date. User-facing expiry does not
 * wait for this job; it uses effectiveAuthorizationStatus().
 *
 * Production scheduler (Replit): daily GET or POST /api/cron/expiry-alarms
 * shortly after 00:05 Asia/Riyadh, with
 *   Authorization: Bearer <CRON_SECRET>
 * Store CRON_SECRET in Replit Secrets. Do not hardcode it.
 */

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // In development, allow unauthenticated manual hits for local testing.
    return process.env.NODE_ENV === "development";
  }

  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runExpiryAlarms();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Expiry alarms failed",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
