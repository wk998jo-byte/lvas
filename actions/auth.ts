"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";

import { fail, ok, okEmpty, type ActionResult } from "@/lib/actions";
import {
  isPasswordResetEmailConfigured,
  sendPasswordResetEmail,
} from "@/lib/auth/mail";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  clearSessionCookie,
  createSession,
  deleteSessionByToken,
  getCurrentProfile,
  SESSION_COOKIE,
  setSessionCookie,
} from "@/lib/auth/session";
import { DASHBOARD_ROLES, hasRole } from "@/lib/auth/roles";
import {
  deleteOtherSessions,
  getProfileByEmail,
  replacePasswordResetToken,
  resetPasswordWithTokenHash,
  setProfilePasswordHash,
} from "@/lib/db/queries";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations";
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

    if (
      (profile.role !== "admin" && profile.role !== "logistics_approver") ||
      !profile.is_active
    ) {
      return fail(
        "This portal is for administrators and logistics approvers. Employees submit a request at /request — no sign-in needed.",
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

export async function changePassword(input: unknown): Promise<ActionResult> {
  const session = await getCurrentProfile();
  if (!session || !session.is_active || !hasRole(session.role, DASHBOARD_ROLES)) {
    return fail("Sign in again to change your password.");
  }

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid password");
  }

  if (parsed.data.current_password === parsed.data.new_password) {
    return fail("Choose a password that is different from the current one.");
  }

  try {
    const profile = await getProfileByEmail(session.email);
    const currentOk = await verifyPassword(
      parsed.data.current_password,
      profile?.password_hash,
    );
    if (!profile || !currentOk) {
      return fail("Current password is incorrect.");
    }

    await setProfilePasswordHash(
      session.id,
      await hashPassword(parsed.data.new_password),
    );
    const jar = await cookies();
    const currentToken = jar.get(SESSION_COOKIE)?.value;
    if (currentToken) {
      await deleteOtherSessions(session.id, hashResetToken(currentToken));
    }
    return okEmpty();
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not change the password.",
    );
  }
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function resetBaseUrl(headerStore: Headers): string {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  if (process.env.NODE_ENV !== "production" && host) {
    return `${proto}://${host}`;
  }
  return "http://localhost:3000";
}

export async function requestPasswordReset(
  input: unknown,
): Promise<ActionResult<{ emailed: boolean }>> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Enter a valid email");
  }

  const emailed = ok({ emailed: true });
  const notConfigured = ok({ emailed: false });

  try {
    if (!isPasswordResetEmailConfigured()) {
      if (process.env.NODE_ENV === "production") return notConfigured;
    } else if (
      process.env.NODE_ENV === "production" &&
      !process.env.APP_URL?.trim()
    ) {
      return notConfigured;
    }

    const profile = await getProfileByEmail(parsed.data.email);
    const canReset =
      profile?.is_active && hasRole(profile.role, DASHBOARD_ROLES);
    if (!profile || !canReset) {
      return isPasswordResetEmailConfigured() ? emailed : notConfigured;
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await replacePasswordResetToken({
      profileId: profile.id,
      tokenHash: hashResetToken(token),
      expiresAt,
    });

    const headerStore = await headers();
    const resetUrl = `${resetBaseUrl(headerStore)}/reset-password/${token}`;

    if (!isPasswordResetEmailConfigured()) {
      return notConfigured;
    }

    try {
      await sendPasswordResetEmail(profile.email, resetUrl);
    } catch (error) {
      console.error(
        "LVAS password reset email failed",
        error instanceof Error ? error.message : error,
      );
    }
    return emailed;
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not send the reset email.",
    );
  }
}

export async function resetPasswordWithToken(
  input: unknown,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid reset");
  }

  try {
    const updated = await resetPasswordWithTokenHash({
      tokenHash: hashResetToken(parsed.data.token),
      passwordHash: await hashPassword(parsed.data.new_password),
    });
    if (!updated) {
      return fail("This reset link is invalid or has expired.");
    }
    return okEmpty();
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not reset the password.",
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
