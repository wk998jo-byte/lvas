import { inclusiveDayCount } from "@/lib/dates";
import type { UserRole } from "@/types/database";

export type RoleRequestLimit = {
  /** Longest authorization window the role may request, in days. */
  maxDurationDays: number;
  /** Days that must pass after the previous request before submitting again. */
  cooldownDays: number;
  /** Human readable cadence, e.g. "once every 3 months". */
  cadenceLabel: string;
  /** Human readable window, e.g. "up to 3 months". */
  durationLabel: string;
};

/** `null` means the role is exempt from request limits (admin). */
export const ROLE_REQUEST_LIMITS: Record<UserRole, RoleRequestLimit | null> = {
  manager_requester: {
    maxDurationDays: 90,
    cooldownDays: 90,
    cadenceLabel: "once every 3 months",
    durationLabel: "up to 3 months (90 days)",
  },
  supervisor_requester: {
    maxDurationDays: 30,
    cooldownDays: 1,
    cadenceLabel: "once every day",
    durationLabel: "1 day, or custom up to 1 month (30 days)",
  },
  other_employee: {
    maxDurationDays: 30,
    cooldownDays: 1,
    cadenceLabel: "once every day",
    durationLabel: "1 day, or custom up to 1 month (30 days)",
  },
  admin: null,
};

/** Roles that pick a 1-day default with an optional custom window up to max. */
export function hasOneDayOrCustomDuration(role: UserRole): boolean {
  return role === "supervisor_requester" || role === "other_employee";
}

export function getRoleRequestLimit(role: UserRole): RoleRequestLimit | null {
  return ROLE_REQUEST_LIMITS[role];
}

/** Statuses that consume the role's allowance; rejected/cancelled do not. */
export const LIMIT_COUNTED_STATUSES = ["pending", "approved"] as const;

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function durationExceedsLimit(
  startDate: string,
  endDate: string,
  limit: RoleRequestLimit,
): boolean {
  return inclusiveDayCount(startDate, endDate) > limit.maxDurationDays;
}

export function durationLimitMessage(limit: RoleRequestLimit): string {
  return `Your role allows authorizations of ${limit.durationLabel}. Shorten the date range.`;
}

export function cooldownMessage(
  limit: RoleRequestLimit,
  nextAllowedAt: Date,
): string {
  return `Your role can submit a request ${limit.cadenceLabel}. The next request is available on ${formatIsoDate(nextAllowedAt)}.`;
}
