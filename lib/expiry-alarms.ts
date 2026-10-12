import { addCalendarDays, saudiTodayIsoDate } from "@/lib/business-date";
import { isEffectivelyApproved } from "@/lib/authorizations/effective-status";
import {
  listApprovedEndingBetween,
  listLogisticsApproverIdsForLocation,
  markApprovedExpired,
} from "@/lib/db/queries";
import {
  expiryEmailIsProspective,
  notifyExpiryEvent,
  type ExpiryAlertStage,
} from "@/lib/notifications/expiry-email";
import type { Authorization, Vehicle } from "@/types/database";
import { compactVehicleIdentity } from "@/lib/vehicles/identity";

export const EXPIRY_THRESHOLDS_DAYS = [3, 0] as const;

export type ExpiryAlarmResult = {
  scanned: number;
  created: number;
  skipped: number;
  expiredMarked: number;
  emailsAttempted: number;
  deliveryFailures: number;
  errors: string[];
};

type AuthorizationWithVehicle = Authorization & {
  vehicles: Pick<Vehicle, "door_number" | "plate_number" | "make" | "model"> | null;
};

function inclusiveDaysUntil(endDate: string, today: string): number {
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  const start = Date.parse(`${today}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000);
}

function expiryDedupeKey(authorizationId: string, daysLeft: number): string {
  return `${authorizationId}:expiry:${daysLeft}`;
}

/**
 * Scans approved authorizations and creates expiry_warning notifications
 * for the 3-day / expiry-day stages. Existing requester/approver in-app delivery
 * is retained; assigned active Logistics also receive deduplicated alerts/email.
 * Also retains the existing past-due approved → expired status maintenance.
 */
export async function runExpiryAlarms(
  now = new Date(),
): Promise<ExpiryAlarmResult> {
  const today = saudiTodayIsoDate(now);
  const maxEnd = addCalendarDays(today, Math.max(...EXPIRY_THRESHOLDS_DAYS));

  const result: ExpiryAlarmResult = {
    scanned: 0,
    created: 0,
    skipped: 0,
    expiredMarked: 0,
    emailsAttempted: 0,
    deliveryFailures: 0,
    errors: [],
  };

  try {
    result.expiredMarked = await markApprovedExpired(today);
  } catch {
    result.errors.push("Failed to mark expired authorizations.");
  }

  let rows: AuthorizationWithVehicle[] = [];
  try {
    rows = await listApprovedEndingBetween({ today, maxEnd });
  } catch {
    result.errors.push("Failed to load expiring authorizations.");
    return result;
  }

  result.scanned = rows.length;
  const allowEmail = expiryEmailIsProspective(today);

  for (const row of rows) {
    const daysLeft = inclusiveDaysUntil(row.end_date, today);
    if (
      !isEffectivelyApproved(row.status, row.end_date, today) ||
      !EXPIRY_THRESHOLDS_DAYS.includes(
        daysLeft as (typeof EXPIRY_THRESHOLDS_DAYS)[number],
      )
    ) {
      result.skipped += 1;
      continue;
    }

    const vehicle = Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles;
    const plate = vehicle ? compactVehicleIdentity(vehicle) : "vehicle";
    const dayLabel = daysLeft === 0 ? "today" : `${daysLeft} days`;
    const legacyUserId = row.requester_id ?? row.approver_id;
    let logisticsIds: string[] = [];
    try {
      if (row.location) logisticsIds = await listLogisticsApproverIdsForLocation(row.location);
    } catch {
      result.errors.push(`${row.id}: Failed to resolve Logistics recipients.`);
    }
    // Union prevents two in-app alerts if the original requester is also Logistics.
    const recipients = [...new Set([...logisticsIds, ...(legacyUserId ? [legacyUserId] : [])])];
    if (!recipients.length) result.skipped += 1;
    const outcomes = await Promise.all(recipients.map(recipientId => notifyExpiryEvent({
      authorizationId: row.id, recipientId, endDate: row.end_date,
      daysLeft: daysLeft as ExpiryAlertStage, today, sentAt: now.toISOString(),
      title: daysLeft === 0 ? "Authorization expires today" : `Authorization expires in ${dayLabel}`,
      body: daysLeft === 0
        ? `Your authorization for ${plate} ends today (${row.end_date}).`
        : `Your authorization for ${plate} ends on ${row.end_date} (${dayLabel} remaining).`,
      // Keep old requester/approver keys so existing 3-day in-app alerts still dedupe.
      dedupeKey: recipientId === legacyUserId
        ? expiryDedupeKey(row.id, daysLeft)
        : `authorization-expiry-${daysLeft === 3 ? "3d" : "day"}:${row.id}:${recipientId}`,
      requiresLogistics: logisticsIds.includes(recipientId),
      allowEmail,
    })));
    for (const outcome of outcomes) {
      if (outcome.created) result.created += 1;
      else result.skipped += 1;
      if (outcome.attempted) result.emailsAttempted += 1;
      if (outcome.failed) {
        result.deliveryFailures += 1;
        result.errors.push(`${row.id}: Expiry notification delivery failed.`);
      }
    }
  }

  return result;
}
