import { isUniqueViolation } from "@/lib/db/pool";
import {
  insertNotification,
  listApprovedEndingBetween,
  markApprovedExpired,
} from "@/lib/db/queries";
import type { Authorization, Vehicle } from "@/types/database";

export const EXPIRY_THRESHOLDS_DAYS = [7, 3, 1] as const;

export type ExpiryAlarmResult = {
  scanned: number;
  created: number;
  skipped: number;
  expiredMarked: number;
  errors: string[];
};

type AuthorizationWithVehicle = Authorization & {
  vehicles: Pick<Vehicle, "plate_number" | "make" | "model"> | null;
};

function utcTodayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function addUtcDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

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
 * for the 7 / 3 / 1 day thresholds. Also marks past-due approved rows as expired.
 */
export async function runExpiryAlarms(
  now = new Date(),
): Promise<ExpiryAlarmResult> {
  const today = utcTodayIsoDate(now);
  const maxEnd = addUtcDays(today, Math.max(...EXPIRY_THRESHOLDS_DAYS));

  const result: ExpiryAlarmResult = {
    scanned: 0,
    created: 0,
    skipped: 0,
    expiredMarked: 0,
    errors: [],
  };

  try {
    result.expiredMarked = await markApprovedExpired(today);
  } catch (error) {
    result.errors.push(
      `Failed to mark expired: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  let rows: AuthorizationWithVehicle[] = [];
  try {
    rows = await listApprovedEndingBetween({ today, maxEnd });
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error.message : "Failed to load expiring authorizations",
    );
    return result;
  }

  result.scanned = rows.length;

  for (const row of rows) {
    const daysLeft = inclusiveDaysUntil(row.end_date, today);
    if (
      !EXPIRY_THRESHOLDS_DAYS.includes(
        daysLeft as (typeof EXPIRY_THRESHOLDS_DAYS)[number],
      )
    ) {
      result.skipped += 1;
      continue;
    }

    const vehicle = Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles;
    const plate = vehicle?.plate_number ?? "vehicle";
    const dayLabel = daysLeft === 1 ? "1 day" : `${daysLeft} days`;
    const dedupeKey = expiryDedupeKey(row.id, daysLeft);

    const notifyUserId = row.requester_id ?? row.approver_id;
    if (!notifyUserId) {
      result.skipped += 1;
      continue;
    }

    try {
      await insertNotification({
        user_id: notifyUserId,
        authorization_id: row.id,
        type: "expiry_warning",
        title: `Authorization expires in ${dayLabel}`,
        body: `Your authorization for ${plate} ends on ${row.end_date} (${dayLabel} remaining).`,
        is_read: false,
        sent_at: now.toISOString(),
        dedupe_key: dedupeKey,
      });
      result.created += 1;
    } catch (insertError) {
      if (isUniqueViolation(insertError)) {
        result.skipped += 1;
        continue;
      }
      result.errors.push(
        `${row.id}: ${insertError instanceof Error ? insertError.message : "insert failed"}`,
      );
    }
  }

  return result;
}
