/** Inclusive day count between ISO date strings (YYYY-MM-DD). */
export function inclusiveDayCount(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

export function formatDurationLabel(startDate: string, endDate: string): string {
  const days = inclusiveDayCount(startDate, endDate);
  if (days <= 0) return "";
  return days === 1 ? "1 day" : `${days} days`;
}

/** Normalize HTML time input values to HH:MM:SS for Postgres `time`. */
export function normalizeUsageAfter(value: string): string {
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  return trimmed;
}
