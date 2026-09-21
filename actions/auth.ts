"use server";

import { fail, ok, okEmpty, type ActionResult } from "@/lib/actions";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  clearSessionCookie,
  createSession,
  deleteSessionByToken,
  SESSION_COOKIE,
  setSessionCookie,
} from "@/lib/auth/session";
import { getProfileByEmail, setProfilePasswordHash } from "@/lib/db/queries";
import { cookies } from "next/headers";

function sanitizeNextPath(next?: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}

async function maybeBootstrapPassword(input: {
  profileId: string;
  email: string;
  password: string;
  currentHash: string | null;
}): Promise<boolean> {
  if (input.currentHash) return false;

  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!bootstrapEmail || !bootstrapPassword) return false;
  if (input.email.trim().toLowerCase() !== bootstrapEmail) return false;
  if (input.password !== bootstrapPassword) return false;

  const passwordHash = await hashPassword(input.password);
  await setProfilePasswordHash(input.profileId, passwordHash);
  return true;
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
  next?: string | null;
}): Promise<ActionResult<{ next: string }>> {
  const email = input.email.trim();
  const password = input.password;

  if (!email || !password) {
    return fail("Email and password are required.");
  }

  try {
    const profile = await getProfileByEmail(email);
    if (!profile) {
      return fail("Invalid email or password.");
    }

    let passwordOk = await verifyPassword(password, profile.password_hash);
    if (!passwordOk) {
      const bootstrapped = await maybeBootstrapPassword({
        profileId: profile.id,
        email: profile.email,
        password,
        currentHash: profile.password_hash,
      });
      passwordOk = bootstrapped;
    }

    if (!passwordOk) {
      return fail("Invalid email or password.");
    }

    if (profile.role !== "admin" || !profile.is_active) {
      return fail(
        "This portal is for administrators only. Submit your request at /request — no sign-in needed.",
      );
    }

    const token = await createSession(profile.id);
    await setSessionCookie(token);
    return ok({ next: sanitizeNextPath(input.next) });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Sign-in failed.",
    );
  }
}

export async function signOut(): Promise<ActionResult> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    await deleteSessionByToken(token);
    await clearSessionCookie();
    return okEmpty();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Sign-out failed.");
  }
}
