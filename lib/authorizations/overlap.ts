export type ActiveAuthorizationConflict = {
  id: string;
  authorized_to: string;
  start_date: string;
  end_date: string;
};

/**
 * True when [startA, endA] overlaps [startB, endB] (inclusive date ranges).
 */
export function datesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA <= endB && endA >= startB;
}

export function formatAuthorizationDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(`${value}T00:00:00.000Z`));
  } catch {
    return value;
  }
}

export function activeAuthorizationError(
  conflict: ActiveAuthorizationConflict,
): string {
  return `Vehicle has an active authorization for ${conflict.authorized_to} until ${formatAuthorizationDate(conflict.end_date)}.`;
}
