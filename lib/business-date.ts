/** Saudi business calendar. Instants in the database stay UTC. */

export const BUSINESS_TIME_ZONE = "Asia/Riyadh";

/** Fixed after-hours clock stored on every authorization. */
export const FIXED_USAGE_AFTER = "19:00:00";

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
