import type { UserRole } from "@/types/database";

export const ROLES = {
  MANAGER_REQUESTER: "manager_requester",
  SUPERVISOR_REQUESTER: "supervisor_requester",
  OTHER_EMPLOYEE: "other_employee",
  ADMIN: "admin",
} as const satisfies Record<string, UserRole>;

/** Every role that can submit authorization requests (everyone but admin). */
export const REQUESTER_ROLES: UserRole[] = [
  "manager_requester",
  "supervisor_requester",
  "other_employee",
];

export const ALL_ROLES: UserRole[] = [...REQUESTER_ROLES, "admin"];

export function hasRole(
  userRole: UserRole | null | undefined,
  allowed: UserRole | UserRole[],
): boolean {
  if (!userRole) return false;
  const list = Array.isArray(allowed) ? allowed : [allowed];
  return list.includes(userRole);
}

export function isRequesterRole(role: UserRole | null | undefined): boolean {
  return hasRole(role, REQUESTER_ROLES);
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "manager_requester":
      return "Manager Requester";
    case "supervisor_requester":
      return "Supervisor Requester";
    case "other_employee":
    default:
      return "Other Employee";
  }
}

/** Public route anyone can use to raise a request without signing in. */
export const PUBLIC_REQUEST_PATH = "/request";

/** Only admins have a dashboard; everyone else belongs on the public form. */
export function homePathForRole(role: UserRole): string {
  return role === "admin" ? "/" : PUBLIC_REQUEST_PATH;
}
