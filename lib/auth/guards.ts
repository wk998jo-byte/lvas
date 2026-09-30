import { redirect } from "next/navigation";

import {
  DASHBOARD_ROLES,
  hasRole,
  homePathForRole,
  PUBLIC_REQUEST_PATH,
} from "@/lib/auth/roles";
import { getCurrentProfile } from "@/lib/auth/session";
import type { Profile, UserRole } from "@/types/database";

export { getCurrentProfile };

/**
 * Dashboard sign-in is for admins and logistics approvers.
 * Employees raise requests on the public form.
 */
export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    redirect("/login");
  }
  if (!hasRole(profile.role, DASHBOARD_ROLES)) {
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
