import { redirect } from "next/navigation";

import {
  hasRole,
  homePathForRole,
  PUBLIC_REQUEST_PATH,
} from "@/lib/auth/roles";
import { getCurrentProfile } from "@/lib/auth/session";
import type { Profile, UserRole } from "@/types/database";

export { getCurrentProfile };

/**
 * Signing in is admin-only: everyone else raises requests on the public form,
 * so a non-admin session is treated as no session at all.
 */
export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (profile.role !== "admin" || !profile.is_active) {
    redirect(PUBLIC_REQUEST_PATH);
  }
  return profile;
}

export async function requireRole(
  allowed: UserRole | UserRole[],
): Promise<Profile> {
  const profile = await requireUser();
  if (!hasRole(profile.role, allowed) || !profile.is_active) {
    redirect(homePathForRole(profile.role));
  }
  return profile;
}
