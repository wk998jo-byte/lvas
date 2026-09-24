import { saudiTodayIsoDate } from "@/lib/business-date";
import type { AuthorizationStatus } from "@/types/database";

/**
 * Display / gate status for an authorization.
 * Approved rows remain valid through the Saudi calendar end_date.
 * After that date they are treated as expired even if cron has not
 * persisted status='expired' yet.
 */
export function effectiveAuthorizationStatus(
  status: AuthorizationStatus,
  endDate: string,
  saudiToday: string = saudiTodayIsoDate(),
): AuthorizationStatus {
  if (status === "approved" && endDate < saudiToday) {
    return "expired";
  }
  return status;
}

export function isEffectivelyApproved(
  status: AuthorizationStatus,
  endDate: string,
  saudiToday: string = saudiTodayIsoDate(),
): boolean {
  return effectiveAuthorizationStatus(status, endDate, saudiToday) === "approved";
}
