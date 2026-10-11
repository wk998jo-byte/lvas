import roster from "@/lib/approvals/logistics-roster.json";

export const PROJECT_LOCATIONS = [
  "Dhahran Base",
  "Asset Department",
  "Facility",
  "Fabshop-Salsil",
  "Jafurah",
  "MGS",
  "Rastanura",
  "Yanbu",
  "Zuluf",
] as const;

export type ProjectLocation = (typeof PROJECT_LOCATIONS)[number];

export function isProjectLocation(value: string): value is ProjectLocation {
  return (PROJECT_LOCATIONS as readonly string[]).includes(value);
}

export function pendingStageLabel(stage: number): string {
  return stage === 1 ? "Awaiting logistics" : "Awaiting final approval";
}

export type LogisticsRosterEntry = {
  fullName: string;
  email: string;
  badge: string;
  position: string;
  locations: ProjectLocation[];
};

function expandLocations(locations: string[]): ProjectLocation[] {
  if (
    locations.length === 0 ||
    locations.some((location) => !isProjectLocation(location)) ||
    new Set(locations).size !== locations.length
  ) {
    throw new Error("Logistics roster must use explicit official locations");
  }
  return locations as ProjectLocation[];
}

export const LOGISTICS_ROSTER: LogisticsRosterEntry[] = roster.map((entry) => ({
  fullName: entry.fullName,
  email: entry.email,
  badge: entry.badge,
  position: entry.position,
  locations: expandLocations(entry.locations),
}));
