import { PROJECT_LOCATIONS, type ProjectLocation } from "@/lib/approvals/logistics-team";

/** Intended Production emails. Application routing never uses these strings. */
export const MUTEB_FINAL_APPROVER_EMAIL = "muteb@binquraya.com";
export const ABDULLAH_FINAL_APPROVER_EMAIL = "abdullah@binquraya.com";

/**
 * Seed/alignment contract only. Request and approval code must resolve the
 * final Admin from final_approver_locations, never from these lists.
 */
export const ABDULLAH_FINAL_LOCATIONS = ["Rigmove", "Rental", "Transport"] as const satisfies readonly ProjectLocation[];

export const MUTEB_FINAL_LOCATIONS = PROJECT_LOCATIONS.filter(
  (location): location is Exclude<ProjectLocation, (typeof ABDULLAH_FINAL_LOCATIONS)[number]> =>
    !(ABDULLAH_FINAL_LOCATIONS as readonly string[]).includes(location),
);

export const FINAL_APPROVER_CONFIG_ERROR =
  "Final approval is not configured for this location. Contact the fleet administrator.";

export const FINAL_APPROVER_REQUEST_CONFIG_ERROR =
  "Final approval is not configured for this request. Contact the fleet administrator.";

export const FINAL_APPROVER_FORBIDDEN =
  "You are not assigned as the final approver for this request.";

export function intendedFinalApproverEmail(location: string): string | null {
  if ((ABDULLAH_FINAL_LOCATIONS as readonly string[]).includes(location)) {
    return ABDULLAH_FINAL_APPROVER_EMAIL;
  }
  if ((MUTEB_FINAL_LOCATIONS as readonly string[]).includes(location)) {
    return MUTEB_FINAL_APPROVER_EMAIL;
  }
  return null;
}

export function assertCanonicalFinalApproverCoverage(): void {
  const mapped = new Set<string>([...MUTEB_FINAL_LOCATIONS, ...ABDULLAH_FINAL_LOCATIONS]);
  if (mapped.size !== PROJECT_LOCATIONS.length) {
    throw new Error("Final-approver seed lists must cover every canonical location once");
  }
  for (const location of PROJECT_LOCATIONS) {
    if (!mapped.has(location)) {
      throw new Error(`Missing final-approver seed location: ${location}`);
    }
  }
}
