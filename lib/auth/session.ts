import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { query, queryOne } from "@/lib/db/pool";
import type { Profile } from "@/types/database";

export const SESSION_COOKIE = "lvas_session";
const SESSION_DAYS = 7;

export type SessionProfile = Profile;

function sessionMaxAgeSeconds(): number {
  return SESSION_DAYS * 24 * 60 * 60;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionCookieOptions(maxAge = sessionMaxAgeSeconds()) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

const PROFILE_COLUMNS = `
  p.id, p.full_name, p.email, p.role, p.department, p.is_active, p.created_at, p.updated_at
`;

export async function createSession(profileId: string): Promise<string> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds() * 1000);
  await query(
    `
      insert into sessions (profile_id, token_hash, expires_at)
      values ($1, $2, $3)
    `,
    [profileId, hashToken(token), expiresAt.toISOString()],
  );
  return token;
}

export async function deleteSessionByToken(token: string | undefined | null) {
  if (!token) return;
  await query(`delete from sessions where token_hash = $1`, [hashToken(token)]);
}

export async function deleteExpiredSessions() {
  await query(`delete from sessions where expires_at < timezone('utc', now())`);
}

export async function getProfileBySessionToken(
  token: string | undefined | null,
): Promise<SessionProfile | null> {
  if (!token) return null;

  const row = await queryOne<SessionProfile>(
    `
      select ${PROFILE_COLUMNS}
      from profiles p
      join sessions s on s.profile_id = p.id
      where s.token_hash = $1
        and s.expires_at > timezone('utc', now())
    `,
    [hashToken(token)],
  );

  return row;
}

export async function getCurrentProfile(): Promise<SessionProfile | null> {
  const jar = await cookies();
  return getProfileBySessionToken(jar.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", sessionCookieOptions(0));
}
