/** Saudi business calendar. Instants in the database stay UTC. */

export const BUSINESS_TIME_ZONE = "Asia/Riyadh";

/** Standard after-hours clock stored on every authorization. */
export const FIXED_USAGE_AFTER = "19:00:00";

/**
 * Legacy start clock from the retired "extended time" question. New requests
 * never store it, but rows created while it was live stay readable.
 */
export const LEGACY_EXTENDED_USAGE_AFTER = "21:00:00";

/** End clock of an extended-hours authorization (19:00–21:00 on each date). */
export const EXTENDED_HOURS_UNTIL = "21:00:00";

export type UsageAfter = typeof FIXED_USAGE_AFTER | typeof LEGACY_EXTENDED_USAGE_AFTER;

function fullClock(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

/** Accepts HH:MM or HH:MM:SS; anything other than 19:00 or 21:00 is null. */
export function normalizeAllowedUsageAfter(value: string | null | undefined): UsageAfter | null {
  if (typeof value !== "string") return null;
  const full = fullClock(value);
  if (full === FIXED_USAGE_AFTER || full === LEGACY_EXTENDED_USAGE_AFTER) return full;
  return null;
}

/** Extended-hours authorizations are the only ones with an end clock. */
export function isExtendedHours(usageUntil: string | null | undefined): boolean {
  return typeof usageUntil === "string" && fullClock(usageUntil) === EXTENDED_HOURS_UNTIL;
}

/**
 * "19:00–21:00" for extended hours, "19:00" otherwise. Isolated LTR so the
 * range keeps its order inside Arabic text.
 */
export function formatUsageWindow(
  usageAfter: string,
  usageUntil: string | null | undefined,
): string {
  const from = usageAfter.slice(0, 5);
  if (!usageUntil) return from;
  return `\u2066${from}–${usageUntil.slice(0, 5)}\u2069`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value);
}

/**
 * Calendar date in Asia/Riyadh for `now`.
 * Do not use `toISOString().slice(0, 10)` for this — that is UTC.
 */
export function saudiTodayIsoDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Unable to resolve the Saudi business date.");
  }
  return `${year}-${month}-${day}`;
}

/** Add whole calendar days to a YYYY-MM-DD value. Not a timezone conversion. */
export function addCalendarDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isOnOrAfterSaudiToday(
  isoDate: string,
  now: Date = new Date(),
): boolean {
  return isIsoDate(isoDate) && isoDate >= saudiTodayIsoDate(now);
}
