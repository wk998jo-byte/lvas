import type { Employee, Profile } from "@/types/database";

/**
 * A request is raised either from a signed-in profile or, via the public form,
 * on behalf of an HR directory employee. Admin views read both through this.
 */
export type RequesterProfileRef = Pick<
  Profile,
  "full_name" | "email" | "department"
> | null;

export type RequesterEmployeeRef = Pick<
  Employee,
  "full_name" | "badge" | "department" | "mobile"
> | null;

export type RequesterInfo = {
  name: string;
  /** Email for account requests, mobile number for public ones. */
  contact: string | null;
  department: string | null;
  badge: string | null;
  source: "account" | "public";
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function resolveRequester(input: {
  profile?: RequesterProfileRef | RequesterProfileRef[];
  employee?: RequesterEmployeeRef | RequesterEmployeeRef[];
  contactMobile?: string | null;
}): RequesterInfo {
  const employee = one(input.employee);
  if (employee) {
    return {
      name: employee.full_name?.trim() || `Badge ${employee.badge}`,
      contact: input.contactMobile ?? employee.mobile ?? null,
      department: employee.department,
      badge: employee.badge,
      source: "public",
    };
  }

  const profile = one(input.profile);
  return {
    name: profile?.full_name?.trim() || profile?.email || "Requester",
    contact: profile?.email ?? null,
    department: profile?.department ?? null,
    badge: null,
    source: "account",
  };
}

/** Columns every admin query needs to render the requester of a request. */
export const REQUESTER_SELECT = `
  requester:profiles!authorizations_requester_id_fkey ( full_name, email, department ),
  employees ( full_name, badge, department, mobile )
`;
