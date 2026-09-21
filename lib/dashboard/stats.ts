import {
  countActiveVehicles,
  countApprovedActive,
  countExpiringWithin,
  countPendingAuthorizations,
} from "@/lib/db/queries";

export type DashboardKpis = {
  activeAuthorizations: number;
  pendingApprovals: number;
  expiringWithin7Days: number;
  fleetVehicles: number;
};

function utcTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addUtcDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const today = utcTodayIsoDate();
  const in7Days = addUtcDays(today, 7);

  const [active, pending, expiring, fleet] = await Promise.all([
    countApprovedActive(today),
    countPendingAuthorizations(),
    countExpiringWithin(today, in7Days),
    countActiveVehicles(),
  ]);

  return {
    activeAuthorizations: active,
    pendingApprovals: pending,
    expiringWithin7Days: expiring,
    fleetVehicles: fleet,
  };
}
