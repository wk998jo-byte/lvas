import { findOverlappingAuthorization as findOverlapRow } from "@/lib/db/queries";

type BlockingStatus = "pending" | "approved";

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

/**
 * Returns a blocking pending/approved authorization for the same vehicle
 * whose dates overlap the requested range, if any.
 */
export async function findOverlappingAuthorization(input: {
  vehicleId: string;
  startDate: string;
  endDate: string;
  excludeId?: string;
}): Promise<{
  id: string;
  start_date: string;
  end_date: string;
  status: BlockingStatus;
} | null> {
  const match = await findOverlapRow(input);
  if (!match) return null;
  return {
    id: match.id,
    start_date: match.start_date,
    end_date: match.end_date,
    status: match.status,
  };
}

export function overlapErrorMessage(conflict: {
  start_date: string;
  end_date: string;
  status: string;
}): string {
  return [
    "This vehicle already has a",
    conflict.status,
    `authorization from ${conflict.start_date} to ${conflict.end_date}.`,
    "Choose different dates or another vehicle.",
  ].join(" ");
}
