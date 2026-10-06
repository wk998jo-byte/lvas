import { effectiveAuthorizationStatus } from "@/lib/authorizations/effective-status";
import { BUSINESS_TIME_ZONE, FIXED_USAGE_AFTER, saudiTodayIsoDate } from "@/lib/business-date";
import type { AuthorizationStatus } from "@/types/database";

/** Read-only input. No contact, ID fragments, justification or approver data. */
export type GateAuthorizationRow = {
  id: string;
  status: AuthorizationStatus;
  start_date: string;
  end_date: string;
  usage_after: string;
  location: string | null;
  vehicle: { plate_number: string; make: string; model: string } | null;
  requester: { full_name: string; badge: string | null } | null;
};

/** The only data passed to the gate UI; no token or internal database IDs. */
export type GateVerificationResultData = {
  state: "valid" | "not_yet_valid" | "invalid" | "unavailable";
  reason: string;
  checkedAt: string;
  details?: {
    driver: string;
    badge: string | null;
    plate: string;
    vehicle: string;
    location: string | null;
    startDate: string;
    endDate: string;
    usageAfter: string;
    reference: string;
  };
};

export function gateResult(
  state: GateVerificationResultData["state"],
  reason: string,
  now: Date = new Date(),
): GateVerificationResultData {
  return {
    state,
    reason,
    // Send an unambiguous instant; the UI formats it once in Asia/Riyadh.
    checkedAt: now.toISOString(),
  };
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Scan-time decision only. Never writes status or relies on cron expiry. */
export function evaluateGateAuthorization(
  row: GateAuthorizationRow | null,
  now: Date = new Date(),
): GateVerificationResultData {
  if (!row) return gateResult("invalid", "Authorization not found / invalid QR.", now);
  if (row.status === "cancelled") return gateResult("invalid", "Authorization cancelled.", now);
  if (row.status === "rejected") return gateResult("invalid", "Authorization rejected.", now);
  if (row.status === "expired") return gateResult("invalid", "Authorization expired.", now);
  if (row.status !== "approved") return gateResult("invalid", "Authorization is not approved.", now);
  if (!validDate(row.start_date) || !validDate(row.end_date) || row.start_date > row.end_date) {
    return gateResult("invalid", "Authorization details are not valid.", now);
  }
  const today = saudiTodayIsoDate(now);
  if (effectiveAuthorizationStatus(row.status, row.end_date, today) !== "approved") {
    return gateResult("invalid", "Authorization expired.", now);
  }
  if (!row.vehicle || !row.requester || !row.requester.full_name?.trim()) {
    return gateResult("invalid", "Required vehicle or requester is unavailable.", now);
  }
  // Corrupt/legacy non-fixed usage rules are denied, never silently reinterpreted.
  if (row.usage_after !== FIXED_USAGE_AFTER && row.usage_after !== FIXED_USAGE_AFTER.slice(0, 5)) {
    return gateResult("invalid", "Authorization usage rule is not valid.", now);
  }
  if (today < row.start_date) {
    return gateResult("not_yet_valid", "Authorization not yet valid.", now);
  }
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).format(now);
  if (clock < FIXED_USAGE_AFTER) {
    return gateResult("not_yet_valid", "Valid only after 19:00 Saudi time.", now);
  }
  return {
    ...gateResult("valid", "Approved for after-hours use.", now),
    details: {
      driver: row.requester.full_name,
      badge: row.requester.badge,
      plate: row.vehicle.plate_number,
      vehicle: `${row.vehicle.make} ${row.vehicle.model}`,
      location: row.location,
      startDate: row.start_date,
      endDate: row.end_date,
      usageAfter: "19:00",
      reference: row.id.slice(0, 8).toUpperCase(),
    },
  };
}
